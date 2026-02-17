import './style.css';
import {
  initSettings,
  type PendingSettingsState,
  type SettingsApi,
  type SettingsData,
} from './settings';
import { runSetupWizard } from './setup-wizard';
import { mountToolbar, type ToolbarApi, type ViewportMode } from './toolbar';
import { buildLayout } from './layout';
import { initMonacoEditors, type MonacoType } from './monaco';
import { createPreviewController, type PreviewController } from './preview';
import { getEditableElementAttributes, getEditableElementText } from './element-text';
import {
  createTailwindCompiler,
  type TailwindCompiler,
} from './persistence';
import { resolveDefaultLayout, resolveLayout } from './domain/layout';
import { createDocumentTitleSync } from './domain/document-title';
import { buildMediaHtml } from './domain/media-html';
import { createSaveExportController } from './controllers/save-export-controller';
import { createModalController } from './controllers/modal-controller';
import {
  createNotices,
  NOTICE_ERROR_DURATION_MS,
  NOTICE_IDS,
  NOTICE_SUCCESS_DURATION_MS,
} from './ui/notices';
import { debounce } from './utils/debounce';
import type { AppConfig } from './types/app-config';
import { resolveInitialState } from './bootstrap/resolve-initial-state';
import { __, sprintf } from '@wordpress/i18n';

// wp-api-fetch は admin 側でグローバル wp.apiFetch として使える
declare const wp: any;

declare global {
  interface Window {
    CODELLIA: AppConfig;
    monaco?: MonacoType;
    require?: any; // AMD loader
  }
}

const COMPACT_EDITOR_BREAKPOINT = 900;
const HTML_WORD_WRAP_STORAGE_KEY = 'codellia.html.wordWrap';
type CompactEditorTab = 'html' | 'css' | 'js';
type HtmlWordWrapMode = 'off' | 'on';

const readHtmlWordWrapMode = (): HtmlWordWrapMode => {
  try {
    return window.localStorage.getItem(HTML_WORD_WRAP_STORAGE_KEY) === 'on' ? 'on' : 'off';
  } catch {
    return 'off';
  }
};

const saveHtmlWordWrapMode = (mode: HtmlWordWrapMode) => {
  try {
    window.localStorage.setItem(HTML_WORD_WRAP_STORAGE_KEY, mode);
  } catch {
    // Ignore storage errors and keep editing.
  }
};

async function main() {
  const cfg = window.CODELLIA;
  const postId = cfg.post_id;
  const mount = document.getElementById('codellia-app');
  if (!mount) return;
  const notices = createNotices({ wp });
  const { createSnackbar, mountNotices, removeNotice, syncNoticeOffset } = notices;
  mountNotices();

  const ui = buildLayout(mount);
  ui.resizer.setAttribute('role', 'separator');
  ui.resizer.setAttribute('aria-orientation', 'vertical');
  ui.editorResizer.setAttribute('role', 'separator');
  ui.editorResizer.setAttribute('aria-orientation', 'horizontal');

  const PREVIEW_BADGE_HIDE_MS = 2200;
  const PREVIEW_BADGE_TRANSITION_MS = 320;
  const compactDesktopViewportWidth = 1280;
  const viewportPresetWidths = {
    mobile: 375,
    tablet: 768,
  } as const;
  let previewBadgeTimer: number | undefined;
  let previewBadgeRaf = 0;

  const updatePreviewBadge = () => {
    const width = compactEditorMode
      ? viewportMode === 'desktop'
        ? compactDesktopViewportWidth
        : viewportPresetWidths[viewportMode]
      : viewportMode === 'desktop'
        ? Math.round(ui.iframe.getBoundingClientRect().width)
        : Math.round(
            Math.min(
              viewportPresetWidths[viewportMode],
              Math.max(0, ui.right.getBoundingClientRect().width) || viewportPresetWidths[viewportMode]
            )
          );
    if (width > 0) {
      ui.previewBadge.textContent = `${width}px`;
    }
  };

  const showPreviewBadge = () => {
    updatePreviewBadge();
    ui.previewBadge.classList.add('is-visible');
    window.clearTimeout(previewBadgeTimer);
    previewBadgeTimer = window.setTimeout(() => {
      ui.previewBadge.classList.remove('is-visible');
    }, PREVIEW_BADGE_HIDE_MS);
  };

  const showPreviewBadgeAfterLayout = () => {
    if (isStackedLayout()) {
      applyViewportLayout();
      showPreviewBadge();
      return;
    }
    let done = false;
    const finalize = () => {
      if (done) return;
      done = true;
      ui.left.removeEventListener('transitionend', onTransitionEnd);
      applyViewportLayout();
      showPreviewBadge();
    };
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.propertyName === 'width' || event.propertyName === 'flex-basis') {
        finalize();
      }
    };
    ui.left.addEventListener('transitionend', onTransitionEnd, { once: true });
    window.setTimeout(finalize, PREVIEW_BADGE_TRANSITION_MS);
  };

  const schedulePreviewBadge = () => {
    if (previewBadgeRaf) {
      return;
    }
    previewBadgeRaf = window.requestAnimationFrame(() => {
      previewBadgeRaf = 0;
      showPreviewBadge();
    });
  };

  let toolbarApi: ToolbarApi | null = null;
  let setupResult: Awaited<ReturnType<typeof runSetupWizard>> | undefined;

  // REST nonce middleware
  if (wp?.apiFetch?.createNonceMiddleware) {
    wp.apiFetch.use(wp.apiFetch.createNonceMiddleware(cfg.restNonce));
  }

  if (cfg.setupRequired) {
    if (!cfg.setupRestUrl || !wp?.apiFetch) {
      ui.app.textContent = __( 'Setup wizard unavailable.', 'codellia' );
      return;
    }

    const setupHost = document.createElement('div');
    setupHost.className = 'cd-setupHost';
    document.body.append(setupHost);

    try {
      setupResult = await runSetupWizard({
        container: setupHost,
        postId,
        restUrl: cfg.setupRestUrl,
        importRestUrl: cfg.importRestUrl,
        apiFetch: wp?.apiFetch,
        backUrl: cfg.listUrl || cfg.backUrl,
        initialTailwindEnabled: Boolean(cfg.tailwindEnabled),
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[Codellia] Setup failed', error);
      ui.app.textContent = __( 'Setup failed.', 'codellia' );
      return;
    } finally {
      setupHost.remove();
    }
  }

  const initialState = resolveInitialState(cfg, setupResult);
  let tailwindEnabled = initialState.tailwindEnabled;
  let htmlWordWrapMode: HtmlWordWrapMode = readHtmlWordWrapMode();

  let monaco: MonacoType;
  let htmlModel: import('monaco-editor').editor.ITextModel;
  let cssModel: import('monaco-editor').editor.ITextModel;
  let jsModel: import('monaco-editor').editor.ITextModel;
  let htmlEditor: import('monaco-editor').editor.IStandaloneCodeEditor;
  let cssEditor: import('monaco-editor').editor.IStandaloneCodeEditor;
  let jsEditor: import('monaco-editor').editor.IStandaloneCodeEditor;
  let activeEditor = null as null | import('monaco-editor').editor.IStandaloneCodeEditor;
  let tailwindCss = initialState.importedGeneratedCss;
  let editorCollapsed = false;
  let settingsOpen = false;
  let viewportMode: ViewportMode = 'desktop';
  let activeSettingsTab: 'settings' | 'elements' = 'settings';
  const canEditJs = Boolean(cfg.canEditJs);
  let jsEnabled = true;
  let shadowDomEnabled = Boolean(initialState.settingsData?.shadowDomEnabled);
  let shortcodeEnabled = Boolean(initialState.settingsData?.shortcodeEnabled);
  let singlePageEnabled = initialState.settingsData?.singlePageEnabled ?? true;
  let liveHighlightEnabled = initialState.settingsData?.liveHighlightEnabled ?? true;
  let externalScripts = Array.isArray(initialState.settingsData?.externalScripts)
    ? [...initialState.settingsData.externalScripts]
    : [];
  let externalStyles = Array.isArray(initialState.settingsData?.externalStyles)
    ? [...initialState.settingsData.externalStyles]
    : [];
  let activeCssTab: 'css' | 'js' = 'css';
  let compactEditorMode = false;
  let compactEditorTab: CompactEditorTab = 'html';
  let editorsReady = false;
  let hasUnsavedChanges = false;
  let pendingSettingsUpdates: Record<string, unknown> = {};
  let hasUnsavedSettings = false;
  let hasSettingsValidationErrors = false;
  let viewPostUrl = initialState.settingsData?.viewUrl || '';
  let postStatus = initialState.settingsData?.status || 'draft';
  let postTitle = initialState.settingsData?.title || '';
  let postSlug = initialState.settingsData?.slug || '';
  let layoutMode = resolveLayout(initialState.settingsData?.layout);
  let defaultLayout = resolveDefaultLayout(initialState.settingsData?.defaultLayout);
  const syncDocumentTitle = createDocumentTitleSync(document.title, cfg.adminTitleSeparators);
  syncDocumentTitle(postTitle);

  let preview: PreviewController | null = null;
  let settingsApi: SettingsApi | null = null;
  let modalController: ReturnType<typeof createModalController> | null = null;
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

  let saveExportController: ReturnType<typeof createSaveExportController> | null = null;

  const getUnsavedFlags = () => {
    if (!saveExportController) {
      return {
        html: false,
        css: false,
        js: false,
        settings: hasUnsavedSettings,
        hasAny: hasUnsavedSettings,
      };
    }
    return saveExportController.getUnsavedFlags();
  };

  const syncUnsavedUi = () => {
    saveExportController?.syncUnsavedUi();
  };

  const markSavedState = () => {
    saveExportController?.markSavedState();
  };

  const syncElementsTabState = () => {
    preview?.sendElementsTabState(settingsOpen && activeSettingsTab === 'elements');
  };

  const getResolvedLayout = () => (layoutMode === 'default' ? defaultLayout : layoutMode);
  const isThemeLayoutActive = () => getResolvedLayout() === 'theme';

  const setSettingsOpen = (open: boolean) => {
    settingsOpen = open;
    ui.app.classList.toggle('is-settings-open', open);
    toolbarApi?.update({ settingsOpen: open });
    syncElementsTabState();
    applyViewportLayout();
  };

  const applySavedSettings = (nextSettings: SettingsData, refreshPreview: boolean) => {
    const currentResolved = getResolvedLayout();
    if (typeof nextSettings.viewUrl === 'string') {
      viewPostUrl = nextSettings.viewUrl;
    }
    postStatus = nextSettings.status || postStatus;
    postTitle = nextSettings.title || postTitle;
    postSlug = nextSettings.slug || postSlug;
    shadowDomEnabled = Boolean(nextSettings.shadowDomEnabled);
    shortcodeEnabled = Boolean(nextSettings.shortcodeEnabled);
    singlePageEnabled = nextSettings.singlePageEnabled ?? singlePageEnabled;
    liveHighlightEnabled = nextSettings.liveHighlightEnabled ?? liveHighlightEnabled;
    externalScripts = Array.isArray(nextSettings.externalScripts)
      ? [...nextSettings.externalScripts]
      : [];
    externalStyles = Array.isArray(nextSettings.externalStyles)
      ? [...nextSettings.externalStyles]
      : [];
    const nextLayout = resolveLayout(nextSettings.layout);
    const nextDefaultLayout =
      typeof nextSettings.defaultLayout === 'string'
        ? resolveDefaultLayout(nextSettings.defaultLayout)
        : defaultLayout;
    if (typeof nextSettings.defaultLayout === 'string') {
      defaultLayout = nextDefaultLayout;
    }
    layoutMode = nextLayout;
    setShadowDomEnabled(shadowDomEnabled);
    setLiveHighlightEnabled(liveHighlightEnabled);
    toolbarApi?.update({ viewPostUrl, postStatus, postTitle, postSlug });
    syncDocumentTitle(postTitle);

    const nextResolved = nextLayout === 'default' ? nextDefaultLayout : nextLayout;
    if ((refreshPreview || nextResolved !== currentResolved) && basePreviewUrl) {
      ui.iframe.src = buildPreviewRefreshUrl(getPreviewUrl());
    }
  };

  saveExportController = createSaveExportController({
    apiFetch: wp.apiFetch,
    restUrl: cfg.restUrl,
    restCompileUrl: cfg.restCompileUrl,
    postId,
    canEditJs,
    getHtmlModel: () => htmlModel,
    getCssModel: () => cssModel,
    getJsModel: () => jsModel,
    getTailwindEnabled: () => tailwindEnabled,
    getTailwindCss: () => tailwindCss,
    getExternalScripts: () => externalScripts,
    getExternalStyles: () => externalStyles,
    getShadowDomEnabled: () => shadowDomEnabled,
    getShortcodeEnabled: () => shortcodeEnabled,
    getSinglePageEnabled: () => singlePageEnabled,
    getLiveHighlightEnabled: () => liveHighlightEnabled,
    getPendingSettingsState: () => ({
      pendingSettingsUpdates,
      hasUnsavedSettings,
      hasSettingsValidationErrors,
    }),
    clearPendingSettingsState: () => {
      pendingSettingsUpdates = {};
      hasUnsavedSettings = false;
      hasSettingsValidationErrors = false;
    },
    applySavedSettings,
    applySettingsToSidebar: (settings) => settingsApi?.applySettings(settings),
    createSnackbar,
    noticeIds: {
      save: NOTICE_IDS.save,
      export: NOTICE_IDS.export,
    },
    noticeSuccessMs: NOTICE_SUCCESS_DURATION_MS,
    noticeErrorMs: NOTICE_ERROR_DURATION_MS,
    uiDirtyTargets: {
      htmlTitle: ui.htmlTitle,
      cssTab: ui.cssTab,
      jsTab: ui.jsTab,
      compactHtmlTab: ui.compactHtmlTab,
      compactCssTab: ui.compactCssTab,
      compactJsTab: ui.compactJsTab,
    },
    onUnsavedChange: (nextHasUnsavedChanges) => {
      hasUnsavedChanges = nextHasUnsavedChanges;
      toolbarApi?.update({ hasUnsavedChanges });
    },
  });

  async function handleExport() {
    await saveExportController?.handleExport();
  }

  async function handleSave(): Promise<{ ok: boolean; error?: string }> {
    if (!saveExportController) {
      return { ok: false, error: __('Save failed.', 'codellia') };
    }
    return await saveExportController.handleSave();
  }

  const runSaveShortcut = async () => {
    await handleSave();
  };

  const registerSaveShortcut = (
    editorInstance: import('monaco-editor').editor.IStandaloneCodeEditor
  ) => {
    editorInstance.addAction({
      id: 'codellia.save',
      label: __( 'Save', 'codellia' ),
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: runSaveShortcut,
    });
  };

  const registerHtmlWordWrapAction = (
    editorInstance: import('monaco-editor').editor.IStandaloneCodeEditor
  ) => {
    editorInstance.addAction({
      id: 'codellia.toggleHtmlWordWrap',
      label: __( 'Toggle HTML word wrap', 'codellia' ),
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.KeyZ],
      run: () => {
        htmlWordWrapMode = htmlWordWrapMode === 'on' ? 'off' : 'on';
        editorInstance.updateOptions({ wordWrap: htmlWordWrapMode });
        saveHtmlWordWrapMode(htmlWordWrapMode);
      },
    });
  };

  const basePreviewUrl = cfg.iframePreviewUrl || cfg.previewUrl;
  const buildPreviewLayoutUrl = (url: string, layout: string) => {
    if (!url) {
      return url;
    }
    try {
      const previewUrl = new URL(url, window.location.origin);
      if (layout && layout !== 'default') {
        previewUrl.searchParams.set('codellia_layout', layout);
      } else {
        previewUrl.searchParams.delete('codellia_layout');
      }
      return previewUrl.toString();
    } catch {
      return url;
    }
  };
  const getPreviewUrl = () => buildPreviewLayoutUrl(basePreviewUrl, layoutMode);
  const buildPreviewRefreshUrl = (url: string) => {
    if (!url) {
      return url;
    }
    try {
      const refreshUrl = new URL(url, window.location.origin);
      refreshUrl.searchParams.set('codellia_refresh', Date.now().toString());
      return refreshUrl.toString();
    } catch {
      const hasQuery = url.includes('?');
      const hashIndex = url.indexOf('#');
      const suffix = `${hasQuery ? '&' : '?'}codellia_refresh=${Date.now()}`;
      if (hashIndex === -1) {
        return url + suffix;
      }
      return url.slice(0, hashIndex) + suffix + url.slice(hashIndex);
    }
  };

  modalController = createModalController({
    apiFetch: wp.apiFetch,
    settingsRestUrl: cfg.settingsRestUrl,
    postId,
    getShadowDomEnabled: () => shadowDomEnabled,
    isThemeLayoutActive,
    getDefaultLayout: () => defaultLayout,
    setLayoutModes: (nextLayout, nextDefaultLayout) => {
      layoutMode = nextLayout;
      defaultLayout = nextDefaultLayout;
    },
    applySettingsToSidebar: (settings) => settingsApi?.applySettings(settings),
    refreshPreview: () => {
      if (basePreviewUrl) {
        ui.iframe.src = buildPreviewRefreshUrl(getPreviewUrl());
      }
    },
    createSnackbar,
    noticeIds: {
      layoutFallback: NOTICE_IDS.layoutFallback,
    },
    noticeErrorMs: NOTICE_ERROR_DURATION_MS,
  });

  toolbarApi = mountToolbar(
    ui.toolbar,
    {
      backUrl: cfg.backUrl || '/wp-admin/',
      listUrl: cfg.listUrl || '',
      canUndo: false,
      canRedo: false,
      editorCollapsed,
      compactEditorMode,
      settingsOpen,
      tailwindEnabled,
      viewportMode,
      hasUnsavedChanges: false,
      viewPostUrl,
      postStatus,
      postTitle,
      postSlug,
    },
    {
      onUndo: () => activeEditor?.trigger('toolbar', 'undo', null),
      onRedo: () => activeEditor?.trigger('toolbar', 'redo', null),
      onToggleEditor: () => setEditorCollapsed(!editorCollapsed),
      onSave: handleSave,
      onExport: handleExport,
      onToggleSettings: () => setSettingsOpen(!settingsOpen),
      onViewportChange: (mode) => setViewportMode(mode),
      onUpdatePostIdentity: async ({ title, slug }) => {
        if (!cfg.settingsRestUrl || !wp?.apiFetch) {
          return { ok: false, error: __( 'Settings unavailable.', 'codellia' ) };
        }
        try {
          const response = await wp.apiFetch({
            url: cfg.settingsRestUrl,
            method: 'POST',
            data: {
              post_id: postId,
              updates: {
                title,
                slug,
              },
            },
          });
          if (!response?.ok) {
            return { ok: false, error: response?.error || __( 'Update failed.', 'codellia' ) };
          }
          const nextSettings = response.settings as SettingsData | undefined;
          const nextTitle =
            nextSettings && typeof nextSettings.title === 'string'
              ? nextSettings.title
              : title;
          const nextSlug =
            nextSettings && typeof nextSettings.slug === 'string'
              ? nextSettings.slug
              : slug;
          postTitle = nextTitle;
          postSlug = nextSlug;
          toolbarApi?.update({ postTitle, postSlug });
          settingsApi?.applySettings({ title: postTitle, slug: postSlug });
          syncDocumentTitle(postTitle);
          window.dispatchEvent(
            new CustomEvent('cd-title-updated', { detail: { title: postTitle, slug: postSlug } })
          );
          if (basePreviewUrl) {
            ui.iframe.src = buildPreviewRefreshUrl(getPreviewUrl());
          }
          return { ok: true };
        } catch (error: any) {
          return {
            ok: false,
            error: error?.message || __( 'Update failed.', 'codellia' ),
          };
        }
      },
      onUpdateStatus: async (nextStatus) => {
        if (!cfg.settingsRestUrl || !wp?.apiFetch) {
          return { ok: false, error: __( 'Settings unavailable.', 'codellia' ) };
        }
        const updates =
          nextStatus === 'private'
            ? { status: 'private', visibility: 'private' }
            : { status: nextStatus, visibility: 'public' };
        try {
          const response = await wp.apiFetch({
            url: cfg.settingsRestUrl,
            method: 'POST',
            data: {
              post_id: postId,
              updates,
            },
          });
          if (!response?.ok) {
            return { ok: false, error: response?.error || __( 'Update failed.', 'codellia' ) };
          }
          const nextSettings = response.settings as SettingsData | undefined;
          postStatus =
            nextSettings && typeof nextSettings.status === 'string'
              ? nextSettings.status
              : nextStatus;
          toolbarApi?.update({ postStatus });
          return { ok: true };
        } catch (error: any) {
          return {
            ok: false,
            error: error?.message || __( 'Update failed.', 'codellia' ),
          };
        }
      },
    }
  );
  syncNoticeOffset();
  window.setTimeout(syncNoticeOffset, 0);
  createSnackbar('info', __( 'Loading Monaco...', 'codellia' ), NOTICE_IDS.monaco);

  // iframe
  ui.iframe.src = getPreviewUrl();
  const targetOrigin = new URL(getPreviewUrl()).origin;

  // Monaco
  const monacoSetup = await initMonacoEditors({
    vsPath: cfg.monacoVsPath,
    initialHtml: initialState.initialHtml,
    initialCss: initialState.initialCss,
    initialJs: initialState.initialJs,
    htmlWordWrap: htmlWordWrapMode,
    tailwindEnabled,
    useTailwindDefault: !setupResult?.imported,
    canEditJs,
    htmlContainer: ui.htmlEditorDiv,
    cssContainer: ui.cssEditorDiv,
    jsContainer: ui.jsEditorDiv,
  });

  ({ monaco, htmlModel, cssModel, jsModel, htmlEditor, cssEditor, jsEditor } = monacoSetup);

  registerSaveShortcut(htmlEditor);
  registerSaveShortcut(cssEditor);
  registerSaveShortcut(jsEditor);
  registerHtmlWordWrapAction(htmlEditor);

  removeNotice(NOTICE_IDS.monaco);
  markSavedState();

  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!hasUnsavedChanges) {
      return;
    }
    event.preventDefault();
    event.returnValue = __( 'You may have unsaved changes.', 'codellia' );
  };

  window.addEventListener('beforeunload', handleBeforeUnload);

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

  const insertHtmlAtSelection = (text: string) => {
    const selection = htmlEditor.getSelection();
    const cursor = htmlEditor.getPosition();
    const range =
      selection ||
      new monaco.Range(
        cursor?.lineNumber || 1,
        cursor?.column || 1,
        cursor?.lineNumber || 1,
        cursor?.column || 1
      );
    htmlEditor.pushUndoStop();
    htmlModel.pushEditOperations(
      [],
      [{ range, text }],
      (inverseOperations) => {
        const inverseRange = inverseOperations[0]?.range;
        if (!inverseRange) {
          return null;
        }
        const end = inverseRange.getEndPosition();
        return [new monaco.Selection(end.lineNumber, end.column, end.lineNumber, end.column)];
      }
    );
    htmlEditor.pushUndoStop();
  };

  const openMediaModal = () => {
    if (typeof wp?.media !== 'function') {
      createSnackbar(
        'error',
        __( 'Media library is unavailable.', 'codellia' ),
        NOTICE_IDS.media,
        NOTICE_ERROR_DURATION_MS
      );
      return;
    }

    const frame = wp.media({
      frame: 'post',
      state: 'insert',
      title: __( 'Select media to insert into HTML.', 'codellia' ),
      button: {
        text: __( 'Insert into HTML', 'codellia' ),
      },
      multiple: false,
    });

    frame.on('insert', (selectionArg: any) => {
      const state = frame.state?.();
      const selection = selectionArg || state?.get?.('selection');
      const selectedModel = selection?.first?.();
      const attachment = selectedModel?.toJSON?.();
      if (!attachment || typeof attachment !== 'object') {
        return;
      }
      const display =
        typeof state?.display === 'function'
          ? state.display(selectedModel)?.toJSON?.()
          : undefined;
      const html = buildMediaHtml(
        attachment as Record<string, unknown>,
        display && typeof display === 'object' ? (display as Record<string, unknown>) : undefined,
        wp?.media?.string?.props
      );
      if (!html) {
        createSnackbar(
          'warning',
          __( 'The selected media has no URL and was not inserted.', 'codellia' ),
          NOTICE_IDS.media,
          NOTICE_ERROR_DURATION_MS
        );
        return;
      }
      setActiveEditor(htmlEditor, ui.htmlPane);
      htmlEditor.focus();
      insertHtmlAtSelection(html);
    });

    frame.open();
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
      if (!name || name === 'data-codellia-id' || !isValidAttributeName(name) || seen.has(name)) {
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

  const getViewportWidth = () => Math.round(window.visualViewport?.width ?? window.innerWidth);

  const syncCompactEditorUi = () => {
    const isHtmlTab = compactEditorTab === 'html';
    const isJsTab = compactEditorTab === 'js';
    ui.compactHtmlTab.classList.toggle('is-active', compactEditorTab === 'html');
    ui.compactCssTab.classList.toggle('is-active', compactEditorTab === 'css');
    ui.compactJsTab.classList.toggle('is-active', compactEditorTab === 'js');
    ui.htmlPane.classList.toggle('is-compact-visible', compactEditorTab === 'html');
    ui.cssPane.classList.toggle('is-compact-visible', compactEditorTab !== 'html');
    ui.compactAddMediaButton.style.display = isHtmlTab ? '' : 'none';
    ui.compactRunButton.style.display = isJsTab && canEditJs ? '' : 'none';
    ui.compactShadowHintButton.style.display = isJsTab && shadowDomEnabled && canEditJs ? '' : 'none';
  };

  const setActiveEditor = (
    editorInstance: import('monaco-editor').editor.IStandaloneCodeEditor,
    pane: HTMLElement
  ) => {
    activeEditor = editorInstance;
    ui.htmlPane.classList.toggle('is-active', pane === ui.htmlPane);
    ui.cssPane.classList.toggle('is-active', pane === ui.cssPane);
    if (compactEditorMode) {
      compactEditorTab = pane === ui.htmlPane ? 'html' : activeCssTab === 'js' ? 'js' : 'css';
      syncCompactEditorUi();
    }
    updateUndoRedoState();
  };

  const updateJsUi = () => {
    const isCompactJsTab = compactEditorTab === 'js';
    const isCompactHtmlTab = compactEditorTab === 'html';
    ui.jsTab.style.display = canEditJs ? '' : 'none';
    ui.jsTab.disabled = !canEditJs;
    ui.compactJsTab.style.display = canEditJs ? '' : 'none';
    ui.compactJsTab.disabled = !canEditJs;
    ui.jsControls.style.display = canEditJs && activeCssTab === 'js' ? '' : 'none';
    ui.runButton.disabled = !jsEnabled || !canEditJs;
    ui.compactAddMediaButton.style.display = isCompactHtmlTab ? '' : 'none';
    ui.compactRunButton.style.display = isCompactJsTab && canEditJs ? '' : 'none';
    ui.compactRunButton.disabled = !jsEnabled || !canEditJs;
    ui.shadowHintButton.style.display = shadowDomEnabled ? '' : 'none';
    ui.shadowHintButton.disabled = !shadowDomEnabled || !canEditJs;
    ui.compactShadowHintButton.style.display =
      isCompactJsTab && shadowDomEnabled && canEditJs ? '' : 'none';
    ui.compactShadowHintButton.disabled = !shadowDomEnabled || !canEditJs;
  };

  const openShadowHintModal = () => modalController?.openShadowHintModal();
  const closeShadowHintModal = () => modalController?.closeShadowHintModal();
  const handleMissingMarkers = () => modalController?.handleMissingMarkers();

  const setCssTab = (
    tab: 'css' | 'js',
    options: { focus?: boolean; syncCompactTab?: boolean } = {}
  ) => {
    const nextTab = tab === 'js' && !canEditJs ? 'css' : tab;
    activeCssTab = nextTab;
    ui.cssTab.classList.toggle('is-active', nextTab === 'css');
    ui.jsTab.classList.toggle('is-active', nextTab === 'js');
    ui.cssEditorDiv.classList.toggle('is-active', nextTab === 'css');
    ui.jsEditorDiv.classList.toggle('is-active', nextTab === 'js');
    if (compactEditorMode && options.syncCompactTab !== false) {
      compactEditorTab = nextTab;
      syncCompactEditorUi();
    }
    updateJsUi();
    if (!editorsReady) {
      return;
    }
    if (nextTab === 'js') {
      setActiveEditor(jsEditor, ui.cssPane);
      if (options.focus !== false) {
        jsEditor.focus();
      }
    } else {
      setActiveEditor(cssEditor, ui.cssPane);
      if (options.focus !== false) {
        cssEditor.focus();
      }
    }
  };

  const setCompactEditorTab = (
    tab: CompactEditorTab,
    options: { focus?: boolean } = {}
  ) => {
    const nextTab = tab === 'js' && !canEditJs ? 'css' : tab;
    compactEditorTab = nextTab;
    syncCompactEditorUi();
    if (!editorsReady) {
      return;
    }
    if (nextTab === 'html') {
      setActiveEditor(htmlEditor, ui.htmlPane);
      if (options.focus !== false) {
        htmlEditor.focus();
      }
      return;
    }
    setCssTab(nextTab, { focus: options.focus, syncCompactTab: false });
  };

  const updateCompactEditorMode = () => {
    const nextCompact = getViewportWidth() < COMPACT_EDITOR_BREAKPOINT;
    if (nextCompact === compactEditorMode) {
      if (compactEditorMode) {
        syncCompactEditorUi();
      }
      return;
    }
    compactEditorMode = nextCompact;
    ui.app.classList.toggle('is-compact-editors', compactEditorMode);
    toolbarApi?.update({ compactEditorMode });
    if (compactEditorMode) {
      ui.htmlPane.style.flex = '';
      ui.htmlPane.style.height = '';
      ui.cssPane.style.flex = '';
      ui.cssPane.style.height = '';
      const nextTab: CompactEditorTab =
        activeEditor === htmlEditor ? 'html' : activeCssTab === 'js' ? 'js' : 'css';
      setCompactEditorTab(nextTab, { focus: false });
      return;
    }
    ui.htmlPane.classList.remove('is-compact-visible');
    ui.cssPane.classList.remove('is-compact-visible');
    if (activeEditor === htmlEditor) {
      setActiveEditor(htmlEditor, ui.htmlPane);
      return;
    }
    setCssTab(activeCssTab, { focus: false, syncCompactTab: false });
  };

  const focusHtmlEditor = () => {
    if (compactEditorMode) {
      setCompactEditorTab('html', { focus: false });
    }
    setActiveEditor(htmlEditor, ui.htmlPane);
    htmlEditor.focus();
  };

  const getPreviewCss = () => (tailwindEnabled ? tailwindCss : cssModel.getValue());

  preview = createPreviewController({
    iframe: ui.iframe,
    postId,
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
    renderShortcodes: async (items) => {
      if (!cfg.renderShortcodesUrl || !wp?.apiFetch) {
        return {};
      }
      try {
        const res = await wp.apiFetch({
          url: cfg.renderShortcodesUrl,
          method: 'POST',
          data: {
            post_id: postId,
            shortcodes: items.map((item) => ({ id: item.id, shortcode: item.shortcode })),
          },
        });
        if (res?.ok && res.results && typeof res.results === 'object') {
          return res.results as Record<string, string>;
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[Codellia] Shortcode render failed', error);
      }
      return {};
    },
    onSelect: (lcId) => {
      selectedLcId = lcId;
      notifySelection();
    },
    onOpenElementsTab: () => {
      if (!settingsOpen) {
        setSettingsOpen(true);
      }
      if (activeSettingsTab !== 'elements') {
        settingsApi?.openTab('elements');
      }
    },
    onMissingMarkers: () => {
      handleMissingMarkers();
    },
  });
  syncElementsTabState();

  tailwindCompiler = createTailwindCompiler({
    apiFetch: wp.apiFetch,
    restCompileUrl: cfg.restCompileUrl,
    postId,
    getHtml: () => htmlModel.getValue(),
    getCss: () => cssModel.getValue(),
    isTailwindEnabled: () => tailwindEnabled,
    onCssCompiled: (css) => {
      tailwindCss = css;
      preview?.sendCssUpdate(css);
    },
    onStatus: (text) => createSnackbar('error', text, NOTICE_IDS.tailwind, NOTICE_ERROR_DURATION_MS),
    onStatusClear: () => removeNotice(NOTICE_IDS.tailwind),
  });

  sendRenderDebounced = debounce(() => preview?.sendRender(), 120);
  compileTailwindDebounced = debounce(() => tailwindCompiler?.compile(), 300);

  const setJsEnabled = (enabled: boolean) => {
    jsEnabled = enabled;
    if ((!jsEnabled || !canEditJs) && activeCssTab === 'js') {
      setCssTab('css', { focus: false });
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
    updateJsUi();
    if (!shadowDomEnabled) {
      closeShadowHintModal();
    }
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
  htmlEditor.onDidFocusEditorText(() => {
    if (compactEditorMode) {
      setCompactEditorTab('html', { focus: false });
      return;
    }
    setActiveEditor(htmlEditor, ui.htmlPane);
  });
  cssEditor.onDidFocusEditorText(() => setCssTab('css', { focus: false }));
  jsEditor.onDidFocusEditorText(() => setCssTab('js', { focus: false }));
  ui.addMediaButton.addEventListener('click', openMediaModal);
  ui.compactAddMediaButton.addEventListener('click', openMediaModal);
  ui.cssTab.addEventListener('click', () => setCssTab('css', { focus: true }));
  ui.jsTab.addEventListener('click', () => setCssTab('js', { focus: true }));
  ui.compactHtmlTab.addEventListener('click', () => setCompactEditorTab('html', { focus: true }));
  ui.compactCssTab.addEventListener('click', () => setCompactEditorTab('css', { focus: true }));
  ui.compactJsTab.addEventListener('click', () => setCompactEditorTab('js', { focus: true }));
  editorsReady = true;
  updateJsUi();
  updateCompactEditorMode();

  settingsApi = initSettings({
    container: ui.settingsBody,
    header: ui.settingsHeader,
    data: initialState.settingsData,
    postId,
    onLayoutChange: (nextLayout) => {
      const currentResolved = getResolvedLayout();
      layoutMode = resolveLayout(nextLayout);
      const nextResolved = getResolvedLayout();
      if (nextResolved !== currentResolved && basePreviewUrl) {
        ui.iframe.src = buildPreviewRefreshUrl(getPreviewUrl());
      }
    },
    onShadowDomToggle: setShadowDomEnabled,
    onShortcodeToggle: (enabled) => {
      shortcodeEnabled = enabled;
    },
    onSinglePageToggle: (enabled) => {
      singlePageEnabled = enabled;
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
    onPendingUpdatesChange: (nextState: PendingSettingsState) => {
      pendingSettingsUpdates = { ...nextState.updates };
      hasUnsavedSettings = nextState.hasUnsavedSettings;
      hasSettingsValidationErrors = nextState.hasValidationErrors;
      syncUnsavedUi();
    },
    onClosePanel: () => setSettingsOpen(false),
    elementsApi,
  });

  ui.runButton.addEventListener('click', () => {
    if (!jsEnabled || !canEditJs) return;
    preview?.requestRunJs();
  });
  ui.compactRunButton.addEventListener('click', () => {
    if (!jsEnabled || !canEditJs) return;
    preview?.requestRunJs();
  });
  ui.shadowHintButton.addEventListener('click', () => {
    if (!shadowDomEnabled) return;
    openShadowHintModal();
  });
  ui.compactShadowHintButton.addEventListener('click', () => {
    if (!shadowDomEnabled || !canEditJs) return;
    openShadowHintModal();
  });

  const minLeftWidth = 320;
  const minRightWidth = 360;
  const desktopMinPreviewWidth = 1024;
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

  const getMainAvailableWidth = () => {
    const mainRect = ui.main.getBoundingClientRect();
    const settingsWidth = ui.settings.getBoundingClientRect().width;
    const resizerWidth = ui.resizer.getBoundingClientRect().width;
    return Math.max(0, mainRect.width - settingsWidth - resizerWidth);
  };

  const getPreviewAreaWidth = () => {
    return Math.max(0, ui.right.getBoundingClientRect().width);
  };

  const isStackedLayout = () => {
    return window.getComputedStyle(ui.main).flexDirection === 'column';
  };

  const ensurePreviewWidth = (minWidth: number) => {
    if (editorCollapsed || isStackedLayout()) {
      return;
    }
    const available = getMainAvailableWidth();
    const minPreviewWidth = Math.max(minRightWidth, minWidth);
    const maxLeftWidth = Math.max(minLeftWidth, available - minPreviewWidth);
    const currentLeft = ui.left.getBoundingClientRect().width;
    const nextLeft = Math.min(currentLeft, maxLeftWidth);
    if (Math.abs(currentLeft - nextLeft) > 0.5) {
      setLeftWidth(nextLeft);
    }
  };

  function applyViewportLayout(forceFit = false) {
    const clearScaledViewportStyles = () => {
      ui.iframe.style.transform = '';
      ui.iframe.style.transformOrigin = '';
      ui.iframe.style.height = '100%';
      ui.iframe.style.maxWidth = '';
    };

    if (compactEditorMode) {
      const presetWidth =
        viewportMode === 'desktop' ? compactDesktopViewportWidth : viewportPresetWidths[viewportMode];
      const safePresetWidth = Math.max(1, presetWidth);
      const previewAreaWidth = getPreviewAreaWidth();
      const scale =
        previewAreaWidth > 0 ? Math.min(1, previewAreaWidth / safePresetWidth) : 1;

      ui.iframe.style.width = `${safePresetWidth}px`;
      ui.iframe.style.margin = '0 auto';
      ui.iframe.style.maxWidth = 'none';
      ui.iframe.style.transformOrigin = 'left top';
      if (scale < 0.999) {
        ui.iframe.style.transform = `scale(${scale})`;
        ui.iframe.style.height = `calc(100% / ${scale})`;
      } else {
        ui.iframe.style.transform = '';
        ui.iframe.style.height = '100%';
      }
      return;
    }

    clearScaledViewportStyles();

    if (viewportMode === 'desktop') {
      ui.iframe.style.width = '100%';
      ui.iframe.style.margin = '0';
      if (forceFit) {
        ensurePreviewWidth(desktopMinPreviewWidth);
      }
      return;
    }

    const presetWidth = viewportPresetWidths[viewportMode];
    const previewAreaWidth = getPreviewAreaWidth();
    const targetWidth = Math.min(presetWidth, previewAreaWidth || presetWidth);
    ui.iframe.style.width = `${targetWidth}px`;
    ui.iframe.style.margin = '0 auto';
    if (forceFit) {
      ensurePreviewWidth(presetWidth);
    }
  }

  function setViewportMode(mode: ViewportMode) {
    const isSameMode = viewportMode === mode;
    viewportMode = mode;
    if (!isSameMode) {
      toolbarApi?.update({ viewportMode });
    }
    applyViewportLayout(true);
    showPreviewBadgeAfterLayout();
  }

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
    applyViewportLayout();
    showPreviewBadgeAfterLayout();
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
    if (viewportMode !== 'desktop') {
      applyViewportLayout();
    }
    schedulePreviewBadge();
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
    showPreviewBadge();
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

  const handleViewportResize = debounce(() => {
    updateCompactEditorMode();
    applyViewportLayout();
    syncNoticeOffset();
  }, 100);
  window.addEventListener('resize', handleViewportResize);
  window.visualViewport?.addEventListener('resize', handleViewportResize);

  setTailwindEnabled(tailwindEnabled);
  setJsEnabled(jsEnabled);
  preview?.flushPendingJsAction();
  applyViewportLayout(true);

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
    syncUnsavedUi();
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
    syncUnsavedUi();
  });

  jsModel.onDidChangeContent(() => {
    updateUndoRedoState();
    syncUnsavedUi();
  });

  // Handle iframe load event
  ui.iframe.addEventListener('load', () => {
    preview?.handleIframeLoad();
  });

  // Handle messages from iframe to parent for DOM selection and initialization
  window.addEventListener('message', (event) => {
    preview?.handleMessage(event);
  });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
});


