import './style.css';
import { initSettings, type SettingsData } from './settings';
import { runSetupWizard } from './setup-wizard';
import { mountToolbar, type ToolbarApi } from './toolbar';
import { buildLayout } from './layout';
import { initMonacoEditors, type MonacoType } from './monaco';
import { createPreviewController, type PreviewController } from './preview';
import { getEditableElementAttributes, getEditableElementText } from './element-text';
import {
  createTailwindCompiler,
  exportLivecode,
  saveLivecode,
  type TailwindCompiler,
} from './persistence';
import type { ImportResult } from './types';

// wp-api-fetch は admin 側でグローバル wp.apiFetch として使える
declare const wp: any;

declare global {
  interface Window {
    WP_LIVECODE: {
      postId: number;
      initialHtml: string;
      initialCss: string;
      initialJs: string;
      jsEnabled: boolean;
      canEditJavaScript: boolean;
      previewUrl: string;
      monacoVsPath: string;
      restUrl: string;
      restCompileUrl: string;
      setupRestUrl: string;
      importRestUrl: string;
      settingsRestUrl: string;
      settingsData: SettingsData;
      backUrl?: string;
      tailwindEnabled?: boolean;
      setupRequired?: boolean;
      restNonce: string;
    };
    monaco?: MonacoType;
    require?: any; // AMD loader
  }
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  let t: number | undefined;
  return (...args: Parameters<T>) => {
    window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), ms);
  };
}

async function main() {
  const cfg = window.WP_LIVECODE;
  const mount = document.getElementById('wp-livecode-app');
  if (!mount) return;

  const ui = buildLayout(mount);
  ui.resizer.setAttribute('role', 'separator');
  ui.resizer.setAttribute('aria-orientation', 'vertical');
  ui.editorResizer.setAttribute('role', 'separator');
  ui.editorResizer.setAttribute('aria-orientation', 'horizontal');

  let toolbarApi: ToolbarApi | null = null;
  let tailwindEnabled = Boolean(cfg.tailwindEnabled);
  let importedState: ImportResult | null = null;
  let importedGeneratedCss = '';

  // REST nonce middleware
  if (wp?.apiFetch?.createNonceMiddleware) {
    wp.apiFetch.use(wp.apiFetch.createNonceMiddleware(cfg.restNonce));
  }

  if (cfg.setupRequired) {
    if (!cfg.setupRestUrl || !wp?.apiFetch) {
      ui.app.textContent = 'Setup wizard unavailable.';
      return;
    }

    const setupHost = document.createElement('div');
    setupHost.className = 'lc-setupHost';
    document.body.append(setupHost);

    try {
      const result = await runSetupWizard({
        container: setupHost,
        postId: cfg.postId,
        restUrl: cfg.setupRestUrl,
        importRestUrl: cfg.importRestUrl,
        apiFetch: wp?.apiFetch,
        backUrl: cfg.backUrl,
        initialTailwindEnabled: tailwindEnabled,
      });
      tailwindEnabled = result.tailwindEnabled;
      if (result.imported) {
        importedState = result.imported;
        importedGeneratedCss = result.imported.payload.generatedCss || '';
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[WP LiveCode] Setup failed', error);
      ui.app.textContent = 'Setup failed.';
      return;
    } finally {
      setupHost.remove();
    }
  }

  if (importedState) {
    const payload = importedState.payload;
    cfg.initialHtml = payload.html;
    cfg.initialCss = payload.css;
    cfg.initialJs = payload.js ?? '';
    cfg.jsEnabled = payload.jsEnabled ?? false;
    cfg.tailwindEnabled = payload.tailwind;
    tailwindEnabled = payload.tailwind;
    cfg.settingsData =
      importedState.settingsData ?? {
        ...cfg.settingsData,
        jsEnabled: payload.jsEnabled ?? false,
        externalScripts: payload.externalScripts ?? [],
        externalStyles: payload.externalStyles ?? [],
        shadowDomEnabled: payload.shadowDomEnabled ?? false,
        shortcodeEnabled: payload.shortcodeEnabled ?? cfg.settingsData.shortcodeEnabled ?? false,
        liveHighlightEnabled:
          payload.liveHighlightEnabled ?? cfg.settingsData.liveHighlightEnabled ?? true,
      };
  }

  let monaco: MonacoType;
  let htmlModel: import('monaco-editor').editor.ITextModel;
  let cssModel: import('monaco-editor').editor.ITextModel;
  let jsModel: import('monaco-editor').editor.ITextModel;
  let htmlEditor: import('monaco-editor').editor.IStandaloneCodeEditor;
  let cssEditor: import('monaco-editor').editor.IStandaloneCodeEditor;
  let jsEditor: import('monaco-editor').editor.IStandaloneCodeEditor;
  let activeEditor = null as null | import('monaco-editor').editor.IStandaloneCodeEditor;
  let tailwindCss = importedGeneratedCss;
  let saveInProgress = false;
  let editorCollapsed = false;
  let settingsOpen = false;
  let activeSettingsTab: 'post' | 'design' | 'elements' = 'post';
  let jsEnabled = Boolean(cfg.jsEnabled);
  let shadowDomEnabled = Boolean(cfg.settingsData?.shadowDomEnabled);
  let shortcodeEnabled = Boolean(cfg.settingsData?.shortcodeEnabled);
  let liveHighlightEnabled = cfg.settingsData?.liveHighlightEnabled ?? true;
  let externalScripts = Array.isArray(cfg.settingsData?.externalScripts)
    ? [...cfg.settingsData.externalScripts]
    : [];
  let externalStyles = Array.isArray(cfg.settingsData?.externalStyles)
    ? [...cfg.settingsData.externalStyles]
    : [];
  let activeCssTab: 'css' | 'js' = 'css';
  let editorsReady = false;
  const canEditJavaScript = Boolean(cfg.canEditJavaScript);

  let preview: PreviewController | null = null;
  let tailwindCompiler: TailwindCompiler | null = null;
  let sendRenderDebounced: (() => void) | null = null;
  let compileTailwindDebounced: (() => void) | null = null;
  let selectedLcId: string | null = null;
  let suppressSelectionClear = 0;
  const selectionListeners = new Set<(lcId: string | null) => void>();
  const contentListeners = new Set<() => void>();

  const notifySelection = () => {
    selectionListeners.forEach((listener) => listener(selectedLcId));
  };

  const subscribeSelection = (listener: (lcId: string | null) => void) => {
    selectionListeners.add(listener);
    listener(selectedLcId);
    return () => selectionListeners.delete(listener);
  };

  const notifyContentChange = () => {
    contentListeners.forEach((listener) => listener());
  };

  const subscribeContentChange = (listener: () => void) => {
    contentListeners.add(listener);
    return () => contentListeners.delete(listener);
  };

  const setStatus = (text: string) => {
    if (saveInProgress && text === '') {
      return;
    }
    toolbarApi?.update({ statusText: text });
  };

  const syncElementsTabState = () => {
    preview?.sendElementsTabState(settingsOpen && activeSettingsTab === 'elements');
  };

  const setSettingsOpen = (open: boolean) => {
    settingsOpen = open;
    ui.app.classList.toggle('is-settings-open', open);
    toolbarApi?.update({ settingsOpen: open });
    syncElementsTabState();
  };

  async function handleExport() {
    if (!htmlModel || !cssModel || !jsModel) {
      setStatus('Export unavailable.');
      return;
    }

    setStatus('Exporting...');

    const result = await exportLivecode({
      apiFetch: wp.apiFetch,
      restCompileUrl: cfg.restCompileUrl,
      postId: cfg.postId,
      html: htmlModel.getValue(),
      css: cssModel.getValue(),
      tailwindEnabled,
      tailwindCss,
      js: jsModel.getValue(),
      jsEnabled,
      externalScripts,
      externalStyles,
      shadowDomEnabled,
      shortcodeEnabled,
      liveHighlightEnabled,
    });

    if (result.ok) {
      setStatus('Exported.');
      window.setTimeout(() => {
        if (!saveInProgress) {
          setStatus('');
        }
      }, 1200);
      return;
    }

    setStatus(`Export error: ${result.error ?? 'Export failed.'}`);
  }

  async function handleSave() {
    if (!htmlModel || !cssModel) {
      return;
    }
    saveInProgress = true;
    setStatus('Saving...');

    const result = await saveLivecode({
      apiFetch: wp.apiFetch,
      restUrl: cfg.restUrl,
      postId: cfg.postId,
      html: htmlModel.getValue(),
      css: cssModel.getValue(),
      tailwindEnabled,
      canEditJavaScript,
      js: jsModel.getValue(),
      jsEnabled,
    });

    if (result.ok) {
      setStatus('Saved.');
      window.setTimeout(() => {
        if (!tailwindCompiler?.isInFlight()) {
          setStatus('');
        }
      }, 1200);
    } else if (result.error === 'Save failed.') {
      setStatus('Save failed.');
    } else {
      setStatus(`Save error: ${result.error ?? 'Save failed.'}`);
    }

    saveInProgress = false;
  }

  toolbarApi = mountToolbar(
    ui.toolbar,
    {
      backUrl: cfg.backUrl || '/wp-admin/',
      canUndo: false,
      canRedo: false,
      editorCollapsed,
      settingsOpen,
      tailwindEnabled,
      statusText: 'Loading Monaco...',
    },
    {
      onUndo: () => activeEditor?.trigger('toolbar', 'undo', null),
      onRedo: () => activeEditor?.trigger('toolbar', 'redo', null),
      onToggleEditor: () => setEditorCollapsed(!editorCollapsed),
      onSave: handleSave,
      onExport: handleExport,
      onToggleSettings: () => setSettingsOpen(!settingsOpen),
    }
  );

  // iframe
  ui.iframe.src = cfg.previewUrl;
  const targetOrigin = new URL(cfg.previewUrl).origin;

  // Monaco
  const monacoSetup = await initMonacoEditors({
    vsPath: cfg.monacoVsPath,
    initialHtml: cfg.initialHtml ?? '',
    initialCss: cfg.initialCss ?? '',
    initialJs: cfg.initialJs ?? '',
    tailwindEnabled,
    useTailwindDefault: !importedState,
    canEditJavaScript,
    htmlContainer: ui.htmlEditorDiv,
    cssContainer: ui.cssEditorDiv,
    jsContainer: ui.jsEditorDiv,
  });

  ({ monaco, htmlModel, cssModel, jsModel, htmlEditor, cssEditor, jsEditor } = monacoSetup);

  toolbarApi?.update({ statusText: '' });

  const applyHtmlEdit = (startOffset: number, endOffset: number, nextText: string) => {
    suppressSelectionClear += 1;
    const start = htmlModel.getPositionAt(startOffset);
    const end = htmlModel.getPositionAt(endOffset);
    htmlModel.pushEditOperations(
      [],
      [
        {
          range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
          text: nextText,
        },
      ],
      () => null
    );
    suppressSelectionClear = Math.max(0, suppressSelectionClear - 1);
  };

  const isValidAttributeName = (name: string) => /^[A-Za-z0-9:_.-]+$/.test(name);

  const escapeAttributeValue = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const normalizeAttributes = (attrs: { name: string; value: string }[]) => {
    const seen = new Set<string>();
    const normalized: { name: string; value: string }[] = [];
    for (let i = attrs.length - 1; i >= 0; i -= 1) {
      const name = attrs[i].name.trim();
      if (!name || name === 'data-lc-id' || !isValidAttributeName(name) || seen.has(name)) {
        continue;
      }
      seen.add(name);
      normalized.push({ name, value: attrs[i].value });
    }
    return normalized.reverse();
  };

  const elementsApi = {
    subscribeSelection,
    subscribeContentChange,
    getElementText: (lcId: string) => {
      const info = getEditableElementText(htmlModel.getValue(), lcId);
      return info ? info.text : null;
    },
    updateElementText: (lcId: string, text: string) => {
      const html = htmlModel.getValue();
      const info = getEditableElementText(html, lcId);
      if (!info) {
        return false;
      }
      if (info.text === text) {
        return true;
      }
      applyHtmlEdit(info.startOffset, info.endOffset, text);
      return true;
    },
    getElementAttributes: (lcId: string) => {
      const info = getEditableElementAttributes(htmlModel.getValue(), lcId);
      return info ? info.attributes : null;
    },
    updateElementAttributes: (lcId: string, attributes: { name: string; value: string }[]) => {
      const html = htmlModel.getValue();
      const info = getEditableElementAttributes(html, lcId);
      if (!info) {
        return false;
      }
      const normalized = normalizeAttributes(attributes);
      const attrText = normalized.length
        ? ` ${normalized
            .map((attr) => `${attr.name}="${escapeAttributeValue(attr.value)}"`)
            .join(' ')}`
        : '';
      const closing = info.selfClosing ? ' />' : '>';
      const nextStartTag = `<${info.tagName}${attrText}${closing}`;
      const currentStartTag = html.slice(info.startOffset, info.endOffset);
      if (currentStartTag === nextStartTag) {
        return true;
      }
      applyHtmlEdit(info.startOffset, info.endOffset, nextStartTag);
      return true;
    },
  };

  const updateUndoRedoState = () => {
    const model = activeEditor?.getModel();
    const canUndo = Boolean(model && model.canUndo());
    const canRedo = Boolean(model && model.canRedo());
    toolbarApi?.update({ canUndo, canRedo });
  };

  const setActiveEditor = (
    editorInstance: import('monaco-editor').editor.IStandaloneCodeEditor,
    pane: HTMLElement
  ) => {
    activeEditor = editorInstance;
    ui.htmlPane.classList.toggle('is-active', pane === ui.htmlPane);
    ui.cssPane.classList.toggle('is-active', pane === ui.cssPane);
    updateUndoRedoState();
  };

  const updateJsUi = () => {
    ui.jsTab.style.display = jsEnabled ? '' : 'none';
    ui.jsTab.disabled = !jsEnabled;
    ui.jsControls.style.display = jsEnabled && activeCssTab === 'js' ? '' : 'none';
    ui.runButton.disabled = !jsEnabled;
  };

  const setCssTab = (tab: 'css' | 'js') => {
    const nextTab = tab === 'js' && !jsEnabled ? 'css' : tab;
    activeCssTab = nextTab;
    ui.cssTab.classList.toggle('is-active', nextTab === 'css');
    ui.jsTab.classList.toggle('is-active', nextTab === 'js');
    ui.cssEditorDiv.classList.toggle('is-active', nextTab === 'css');
    ui.jsEditorDiv.classList.toggle('is-active', nextTab === 'js');
    updateJsUi();
    if (!editorsReady) {
      return;
    }
    if (nextTab === 'js') {
      setActiveEditor(jsEditor, ui.cssPane);
      jsEditor.focus();
    } else {
      setActiveEditor(cssEditor, ui.cssPane);
      cssEditor.focus();
    }
  };

  const focusHtmlEditor = () => {
    htmlEditor.focus();
    setActiveEditor(htmlEditor, ui.htmlPane);
  };

  const getPreviewCss = () => (tailwindEnabled ? tailwindCss : cssModel.getValue());

  preview = createPreviewController({
    iframe: ui.iframe,
    postId: cfg.postId,
    targetOrigin,
    monaco,
    htmlModel,
    cssModel,
    jsModel,
    htmlEditor,
    cssEditor,
    focusHtmlEditor,
    getPreviewCss,
    getShadowDomEnabled: () => shadowDomEnabled,
    getLiveHighlightEnabled: () => liveHighlightEnabled,
    getJsEnabled: () => jsEnabled,
    getExternalScripts: () => externalScripts,
    getExternalStyles: () => externalStyles,
    isTailwindEnabled: () => tailwindEnabled,
    onSelect: (lcId) => {
      selectedLcId = lcId;
      notifySelection();
    },
    onOpenElementsTab: () => {
      if (!settingsOpen) {
        setSettingsOpen(true);
      }
      if (activeSettingsTab !== 'elements') {
        window.dispatchEvent(new CustomEvent('lc-open-elements-tab'));
      }
    },
  });
  syncElementsTabState();

  tailwindCompiler = createTailwindCompiler({
    apiFetch: wp.apiFetch,
    restCompileUrl: cfg.restCompileUrl,
    postId: cfg.postId,
    getHtml: () => htmlModel.getValue(),
    getCss: () => cssModel.getValue(),
    isTailwindEnabled: () => tailwindEnabled,
    onCssCompiled: (css) => {
      tailwindCss = css;
      preview?.sendCssUpdate(css);
    },
    onStatus: setStatus,
    onStatusClear: () => {
      if (!saveInProgress) {
        setStatus('');
      }
    },
  });

  sendRenderDebounced = debounce(() => preview?.sendRender(), 120);
  compileTailwindDebounced = debounce(() => tailwindCompiler?.compile(), 300);

  const setJavaScriptEnabled = (enabled: boolean) => {
    jsEnabled = enabled;
    if (!jsEnabled && activeCssTab === 'js') {
      setCssTab('css');
    } else {
      updateJsUi();
    }
    if (!preview) {
      return;
    }
    if (!enabled) {
      preview.sendExternalScripts([]);
      preview.requestDisableJs();
      return;
    }
    preview.sendExternalScripts(externalScripts);
    preview.queueInitialJsRun();
  };

  const setShadowDomEnabled = (enabled: boolean) => {
    shadowDomEnabled = enabled;
    preview?.sendRender();
    preview?.sendExternalScripts(jsEnabled ? externalScripts : []);
    preview?.sendExternalStyles(externalStyles);
    if (!jsEnabled) {
      preview?.requestDisableJs();
      return;
    }
    preview?.requestRunJs();
  };

  const setLiveHighlightEnabled = (enabled: boolean) => {
    liveHighlightEnabled = enabled;
    preview?.sendLiveHighlightUpdate(enabled);
  };

  const setTailwindEnabled = (enabled: boolean) => {
    tailwindEnabled = enabled;
    ui.app.classList.toggle('is-tailwind', enabled);
    toolbarApi?.update({ tailwindEnabled: enabled });
    if (enabled) {
      preview?.sendRender();
      tailwindCompiler?.compile();
    } else {
      if (editorSplitActive && lastHtmlHeight > 0) {
        setEditorSplitHeight(lastHtmlHeight);
      }
      preview?.sendRender();
    }
  };

  setActiveEditor(htmlEditor, ui.htmlPane);
  ui.htmlPane.addEventListener('click', () => htmlEditor.focus());
  ui.cssPane.addEventListener('click', () => {
    if (activeCssTab === 'js') {
      jsEditor.focus();
    } else {
      cssEditor.focus();
    }
  });
  htmlEditor.onDidFocusEditorText(() => setActiveEditor(htmlEditor, ui.htmlPane));
  cssEditor.onDidFocusEditorText(() => setCssTab('css'));
  jsEditor.onDidFocusEditorText(() => setCssTab('js'));
  ui.cssTab.addEventListener('click', () => setCssTab('css'));
  ui.jsTab.addEventListener('click', () => setCssTab('js'));
  editorsReady = true;
  updateJsUi();

  initSettings({
    container: ui.settingsBody,
    header: ui.settingsHeader,
    data: cfg.settingsData,
    restUrl: cfg.settingsRestUrl,
    postId: cfg.postId,
    backUrl: cfg.backUrl,
    apiFetch: wp?.apiFetch,
    onJavaScriptToggle: setJavaScriptEnabled,
    onShadowDomToggle: setShadowDomEnabled,
    onShortcodeToggle: (enabled) => {
      shortcodeEnabled = enabled;
    },
    onLiveHighlightToggle: setLiveHighlightEnabled,
    onExternalScriptsChange: (scripts) => {
      externalScripts = scripts;
      preview?.sendExternalScripts(jsEnabled ? externalScripts : []);
    },
    onExternalStylesChange: (styles) => {
      externalStyles = styles;
      preview?.sendExternalStyles(externalStyles);
    },
    onTabChange: (tab) => {
      activeSettingsTab = tab;
      syncElementsTabState();
    },
    onClosePanel: () => setSettingsOpen(false),
    elementsApi,
  });

  ui.runButton.addEventListener('click', () => {
    if (!jsEnabled) return;
    preview?.requestRunJs();
  });

  const minLeftWidth = 320;
  const minRightWidth = 360;
  const minEditorPaneHeight = 160;
  let isResizing = false;
  let isEditorResizing = false;
  let startX = 0;
  let startY = 0;
  let startWidth = 0;
  let startHeight = 0;
  let lastLeftWidth = ui.left.getBoundingClientRect().width || minLeftWidth;
  let lastHtmlHeight = 0;
  let editorSplitActive = false;

  const setLeftWidth = (width: number) => {
    const clamped = Math.max(minLeftWidth, width);
    lastLeftWidth = clamped;
    ui.left.style.flex = `0 0 ${clamped}px`;
    ui.left.style.width = `${clamped}px`;
  };

  const clearLeftWidth = () => {
    ui.left.style.flex = '';
    ui.left.style.width = '';
  };

  const clearEditorSplit = () => {
    ui.htmlPane.style.flex = '';
    ui.htmlPane.style.height = '';
    ui.cssPane.style.flex = '';
    ui.cssPane.style.height = '';
  };

  const setEditorSplitHeight = (height: number) => {
    const leftRect = ui.left.getBoundingClientRect();
    const resizerHeight = ui.editorResizer.getBoundingClientRect().height;
    const available = Math.max(0, leftRect.height - resizerHeight);
    if (available <= 0) return;
    const maxHtmlHeight = Math.max(0, available - minEditorPaneHeight);
    const minHtmlHeight = Math.min(minEditorPaneHeight, maxHtmlHeight);
    const clamped = Math.min(maxHtmlHeight, Math.max(minHtmlHeight, height));
    lastHtmlHeight = clamped;
    editorSplitActive = true;
    ui.htmlPane.style.flex = `0 0 ${clamped}px`;
    ui.htmlPane.style.height = `${clamped}px`;
    ui.cssPane.style.flex = '1 1 auto';
    ui.cssPane.style.height = '';
  };

  const setEditorCollapsed = (collapsed: boolean) => {
    editorCollapsed = collapsed;
    ui.app.classList.toggle('is-editor-collapsed', collapsed);
    toolbarApi?.update({ editorCollapsed: collapsed });
    if (collapsed) {
      const currentWidth = ui.left.getBoundingClientRect().width;
      if (currentWidth > 0) {
        lastLeftWidth = currentWidth;
      }
      ui.left.style.width = `${currentWidth}px`;
      ui.left.style.flex = `0 0 ${currentWidth}px`;
      ui.left.getBoundingClientRect();
      ui.left.style.width = '0px';
      ui.left.style.flex = '0 0 0';
    } else {
      clearLeftWidth();
      setLeftWidth(lastLeftWidth || minLeftWidth);
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!isResizing) return;
    const mainRect = ui.main.getBoundingClientRect();
    const settingsWidth = ui.settings.getBoundingClientRect().width;
    const resizerWidth = ui.resizer.getBoundingClientRect().width;
    const available = mainRect.width - settingsWidth - resizerWidth;
    const maxLeftWidth = Math.max(minLeftWidth, available - minRightWidth);
    const nextWidth = Math.min(maxLeftWidth, Math.max(minLeftWidth, startWidth + event.clientX - startX));
    setLeftWidth(nextWidth);
  };

  const stopResizing = (event?: PointerEvent) => {
    if (!isResizing) return;
    isResizing = false;
    ui.app.classList.remove('is-resizing');
    if (event) {
      try {
        ui.resizer.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore if pointer capture isn't active.
      }
    }
  };

  ui.resizer.addEventListener('pointerdown', (event) => {
    if (editorCollapsed) {
      return;
    }
    isResizing = true;
    startX = event.clientX;
    startWidth = ui.left.getBoundingClientRect().width;
    ui.app.classList.add('is-resizing');
    ui.resizer.setPointerCapture(event.pointerId);
  });

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', stopResizing);
  ui.resizer.addEventListener('pointerup', stopResizing);
  ui.resizer.addEventListener('pointercancel', stopResizing);

  const onEditorPointerMove = (event: PointerEvent) => {
    if (!isEditorResizing) return;
    const nextHeight = startHeight + event.clientY - startY;
    setEditorSplitHeight(nextHeight);
  };

  const stopEditorResizing = (event?: PointerEvent) => {
    if (!isEditorResizing) return;
    isEditorResizing = false;
    ui.app.classList.remove('is-resizing');
    if (event) {
      try {
        ui.editorResizer.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore if pointer capture isn't active.
      }
    }
  };

  ui.editorResizer.addEventListener('pointerdown', (event) => {
    if (editorCollapsed) {
      return;
    }
    isEditorResizing = true;
    startY = event.clientY;
    startHeight = ui.htmlPane.getBoundingClientRect().height;
    ui.app.classList.add('is-resizing');
    ui.editorResizer.setPointerCapture(event.pointerId);
  });

  window.addEventListener('pointermove', onEditorPointerMove);
  window.addEventListener('pointerup', stopEditorResizing);
  ui.editorResizer.addEventListener('pointerup', stopEditorResizing);
  ui.editorResizer.addEventListener('pointercancel', stopEditorResizing);

  setTailwindEnabled(tailwindEnabled);
  setJavaScriptEnabled(jsEnabled);
  preview?.flushPendingJsAction();

  htmlModel.onDidChangeContent(() => {
    preview?.resetCanonicalCache();
    preview?.clearSelectionHighlight();
    sendRenderDebounced?.();
    if (tailwindEnabled) {
      compileTailwindDebounced?.();
    }
    updateUndoRedoState();
    if (suppressSelectionClear === 0) {
      selectedLcId = null;
      notifySelection();
    }
    notifyContentChange();
  });
  cssModel.onDidChangeContent(() => {
    if (!tailwindEnabled) {
      sendRenderDebounced?.();
    }
    if (tailwindEnabled) {
      compileTailwindDebounced?.();
    }
    preview?.clearSelectionHighlight();
    preview?.clearCssSelectionHighlight();
    updateUndoRedoState();
  });

  jsModel.onDidChangeContent(() => {
    updateUndoRedoState();
  });

  // 初回の iframe load 後に送る
  ui.iframe.addEventListener('load', () => {
    preview?.handleIframeLoad();
  });

  // iframe -> parent への通信：DOM セレクタの受け取りや初期化に用いる
  window.addEventListener('message', (event) => {
    preview?.handleMessage(event);
  });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
});
