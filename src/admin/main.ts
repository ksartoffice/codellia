// filepath: src/admin/main.ts
import './style.css';
import { emmetCSS, emmetHTML } from 'emmet-monaco-es';
import * as parse5 from 'parse5';
import type { DefaultTreeAdapterTypes } from 'parse5';
import { initSettings, type SettingsData } from './settings';
import { runSetupWizard } from './setup-wizard';
import { mountToolbar, type ToolbarApi } from './toolbar';

// wp-api-fetch は admin 側でグローバル wp.apiFetch として使える
declare const wp: any;

type MonacoType = typeof import('monaco-editor');

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

type SourceRange = {
  startOffset: number;
  endOffset: number;
};

type CssRuleInfo = {
  selectorText: string;
  startOffset: number;
  endOffset: number;
  mediaQueries: string[];
};

type ShortcodePlaceholder = {
  id: string;
  shortcode: string;
  startOffset: number;
  endOffset: number;
};

type CanonicalResult = {
  canonicalHTML: string;
  map: Record<string, SourceRange>;
  shortcodes: ShortcodePlaceholder[];
  error?: string;
};

type ImportPayload = {
  version: number;
  html: string;
  css: string;
  tailwind: boolean;
  generatedCss?: string;
  js?: string;
  jsEnabled?: boolean;
  externalScripts?: string[];
  shadowDomEnabled?: boolean;
  shortcodeEnabled?: boolean;
};

type ImportResult = {
  payload: ImportPayload;
  settingsData?: SettingsData;
};

type ExportPayload = {
  version: 1;
  html: string;
  css: string;
  tailwind: boolean;
  generatedCss: string;
  js: string;
  jsEnabled: boolean;
  externalScripts: string[];
  shadowDomEnabled: boolean;
  shortcodeEnabled: boolean;
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}



// filepath: src/admin/main.ts
async function loadMonaco(vsPath: string): Promise<MonacoType> {
  const req = (window as any).require || (window as any).requirejs;
  if (!req) throw new Error('Monaco AMD loader (window.require) not found.');

  req.config({ paths: { vs: vsPath } });

  return await new Promise((resolve, reject) => {
    req(['vs/editor/editor.main'], () => {
      if (!window.monaco) return reject(new Error('window.monaco is missing after load.'));
      resolve(window.monaco);
    });
  });
}


function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  let t: number | undefined;
  return (...args: Parameters<T>) => {
    window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), ms);
  };
}

const LC_ATTR_NAME = 'data-lc-id';
const SC_PLACEHOLDER_ATTR = 'data-lc-sc-placeholder';
const SHORTCODE_REGEX =
  /\[(\[?)([\w-]+)(?![\w-])([^\]\/]*(?:\/(?!\])|[^\]])*?)(?:(\/)\]|](?:([^\[]*?(?:\[(?!\/\2\])[^\[]*?)*?)\[\/\2\])?)(\]?)/g;
const DEFAULT_TAILWIND_CSS =
  '@layer theme, base, components, utilities;\n' +
  '@import "tailwindcss/theme.css" layer(theme);\n' +
  '@import "tailwindcss/preflight.css" layer(base);\n' +
  '@import "tailwindcss/utilities.css" layer(utilities);\n' +
  '\n' +
  '@theme {\n' +
  '  /* ... */\n' +
  '}\n';

function isElement(node: DefaultTreeAdapterTypes.Node): node is DefaultTreeAdapterTypes.Element {
  return (node as DefaultTreeAdapterTypes.Element).tagName !== undefined;
}

function isParentNode(node: DefaultTreeAdapterTypes.Node): node is DefaultTreeAdapterTypes.ParentNode {
  return Array.isArray((node as DefaultTreeAdapterTypes.ParentNode).childNodes);
}

function isTemplateElement(node: DefaultTreeAdapterTypes.Element): node is DefaultTreeAdapterTypes.Template {
  return node.tagName === 'template' && Boolean((node as DefaultTreeAdapterTypes.Template).content);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function upsertLcAttr(el: DefaultTreeAdapterTypes.Element, lcId: string) {
  const existing = el.attrs.find((attr) => attr.name === LC_ATTR_NAME);
  if (existing) {
    existing.value = lcId;
  } else {
    el.attrs.push({ name: LC_ATTR_NAME, value: lcId });
  }
}

function getExistingLcId(el: DefaultTreeAdapterTypes.Element): string | null {
  const attr = el.attrs.find((item) => item.name === LC_ATTR_NAME);
  return attr ? attr.value : null;
}

function resolveRange(
  loc: DefaultTreeAdapterTypes.Element['sourceCodeLocation'],
  parentRange: SourceRange | null,
  mapOffsetToOriginal?: (offset: number) => number
): SourceRange | null {
  if (loc && typeof loc.startOffset === 'number' && typeof loc.endOffset === 'number') {
    const start = mapOffsetToOriginal ? mapOffsetToOriginal(loc.startOffset) : loc.startOffset;
    const end = mapOffsetToOriginal ? mapOffsetToOriginal(loc.endOffset) : loc.endOffset;
    return { startOffset: start, endOffset: end };
  }
  return parentRange ? { ...parentRange } : null;
}

function walkCanonicalTree(
  node: DefaultTreeAdapterTypes.ParentNode,
  parentRange: SourceRange | null,
  map: Record<string, SourceRange>,
  nextId: () => string,
  mapOffsetToOriginal?: (offset: number) => number,
  rangeOverride?: Record<string, SourceRange>
) {
  const children = node.childNodes || [];

  for (const child of children) {
    if (isElement(child)) {
      const existingId = getExistingLcId(child);
      const lcId = existingId ?? nextId();
      upsertLcAttr(child, lcId);
      const range =
        (rangeOverride && rangeOverride[lcId]) ||
        resolveRange(child.sourceCodeLocation, parentRange, mapOffsetToOriginal);
      if (range) {
        map[lcId] = range;
      }
      walkCanonicalTree(child, range ?? parentRange, map, nextId, mapOffsetToOriginal, rangeOverride);

      if (isTemplateElement(child)) {
        walkCanonicalTree(
          child.content,
          range ?? parentRange,
          map,
          nextId,
          mapOffsetToOriginal,
          rangeOverride
        );
      }
    } else if (isParentNode(child)) {
      walkCanonicalTree(child, parentRange, map, nextId, mapOffsetToOriginal, rangeOverride);
    }
  }
}

// canonical HTML を生成しつつ data-lc-id とソース位置のマッピングを保持
function canonicalizeHtml(html: string): CanonicalResult {
  try {
    const fragment = parse5.parseFragment(html, { sourceCodeLocationInfo: true });
    const map: Record<string, SourceRange> = {};
    let seq = 0;
    const nextId = () => `lc-${++seq}`;

    walkCanonicalTree(fragment, null, map, nextId);

    return { canonicalHTML: parse5.serialize(fragment), map, shortcodes: [] };
  } catch (error: any) {
    console.error('[WP LiveCode] canonicalizeHtml failed', error);
    return {
      canonicalHTML: html,
      map: {},
      shortcodes: [],
      error: error?.message ?? String(error),
    };
  }
}

function splitSelectors(selectorText: string): string[] {
  const result: string[] = [];
  let buffer = '';
  let inString: string | null = null;
  let parenDepth = 0;
  let bracketDepth = 0;

  for (let i = 0; i < selectorText.length; i++) {
    const char = selectorText[i];
    if (inString) {
      if (char === '\\') {
        buffer += char;
        i += 1;
        if (i < selectorText.length) {
          buffer += selectorText[i];
        }
        continue;
      }
      if (char === inString) {
        inString = null;
      }
      buffer += char;
      continue;
    }

    if (char === '"' || char === "'") {
      inString = char;
      buffer += char;
      continue;
    }

    if (char === '(') {
      parenDepth += 1;
      buffer += char;
      continue;
    }

    if (char === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      buffer += char;
      continue;
    }

    if (char === '[') {
      bracketDepth += 1;
      buffer += char;
      continue;
    }

    if (char === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      buffer += char;
      continue;
    }

    if (char === ',' && parenDepth === 0 && bracketDepth === 0) {
      const trimmed = buffer.trim();
      if (trimmed) {
        result.push(trimmed);
      }
      buffer = '';
      continue;
    }

    buffer += char;
  }

  const trimmed = buffer.trim();
  if (trimmed) {
    result.push(trimmed);
  }

  return result;
}

function parseCssRules(cssText: string): CssRuleInfo[] {
  const rules: CssRuleInfo[] = [];
  const stack: Array<{
    type: 'rule' | 'at-rule';
    selectorText?: string;
    startOffset: number;
    atRuleName?: string;
    mediaQueries?: string[];
  }> = [];
  const mediaStack: string[] = [];
  let preludeStart = 0;
  let inComment = false;
  let inString: string | null = null;
  let ruleDepth = 0;

  const pushRule = (selectorText: string, startOffset: number) => {
    stack.push({
      type: 'rule',
      selectorText,
      startOffset,
      mediaQueries: [...mediaStack],
    });
    ruleDepth += 1;
  };

  const pushAtRule = (name: string, startOffset: number, params: string) => {
    stack.push({ type: 'at-rule', atRuleName: name, startOffset });
    if (name === 'media') {
      mediaStack.push(params.trim());
    }
  };

  for (let i = 0; i < cssText.length; i++) {
    const char = cssText[i];
    const next = cssText[i + 1];

    if (inComment) {
      if (char === '*' && next === '/') {
        inComment = false;
        i += 1;
      }
      continue;
    }

    if (inString) {
      if (char === '\\') {
        i += 1;
        continue;
      }
      if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === '/' && next === '*') {
      inComment = true;
      i += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      inString = char;
      continue;
    }

    if (char === '{') {
      const prelude = cssText.slice(preludeStart, i).trim();
      if (prelude) {
        if (prelude.startsWith('@')) {
          const match = /^@([\w-]+)\s*(.*)$/.exec(prelude);
          const name = match ? match[1].toLowerCase() : '';
          const params = match ? match[2] : '';
          pushAtRule(name, preludeStart, params);
        } else {
          pushRule(prelude, preludeStart);
        }
      } else {
        stack.push({ type: 'at-rule', atRuleName: '', startOffset: preludeStart });
      }
      preludeStart = i + 1;
      continue;
    }

    if (char === '}') {
      const ctx = stack.pop();
      if (ctx?.type === 'rule') {
        ruleDepth = Math.max(0, ruleDepth - 1);
        rules.push({
          selectorText: ctx.selectorText || '',
          startOffset: ctx.startOffset,
          endOffset: i + 1,
          mediaQueries: ctx.mediaQueries || [],
        });
      } else if (ctx?.type === 'at-rule' && ctx.atRuleName === 'media') {
        mediaStack.pop();
      }
      preludeStart = i + 1;
      continue;
    }

    if (char === ';' && ruleDepth === 0) {
      preludeStart = i + 1;
      continue;
    }
  }

  return rules;
}

function selectorMatches(element: Element, selector: string): boolean {
  const trimmed = selector.trim();
  if (!trimmed) return false;
  try {
    return element.matches(trimmed);
  } catch (error) {
    const cleaned = trimmed.replace(
      /::?(before|after|first-line|first-letter|selection|placeholder|marker|backdrop|file-selector-button|cue|part\([^)]*\)|slotted\([^)]*\))/gi,
      ''
    );
    if (cleaned !== trimmed) {
      try {
        return element.matches(cleaned);
      } catch {
        return false;
      }
    }
    return false;
  }
}

function mediaQueriesMatch(queries: string[]): boolean {
  if (!queries.length) return true;
  return queries.every((query) => {
    if (!query) return true;
    try {
      return window.matchMedia(query).matches;
    } catch {
      return true;
    }
  });
}

function buildLayout(root: HTMLElement) {
  const app = el('div', 'lc-app');

  // Toolbar (React mount point)
  const toolbar = el('div', 'lc-toolbar');

  // Main split
  const main = el('div', 'lc-main');
  const left = el('div', 'lc-left');
  const resizer = el('div', 'lc-resizer');
  const right = el('div', 'lc-right');
  const settings = el('aside', 'lc-settings');
  settings.id = 'lc-settings';
  const settingsInner = el('div', 'lc-settingsInner');
  const settingsHeader = el('div', 'lc-settingsHeader');
  const settingsBody = el('div', 'lc-settingsBody');
  settingsInner.append(settingsHeader, settingsBody);
  settings.append(settingsInner);

  const htmlPane = el('div', 'lc-editorPane lc-editorPane-html is-active');
  const htmlHeader = el('div', 'lc-editorHeader');
  htmlHeader.textContent = 'HTML';
  const htmlWrap = el('div', 'lc-editorWrap');
  const htmlEditorDiv = el('div', 'lc-editor lc-editor-html');
  htmlWrap.append(htmlEditorDiv);
  htmlPane.append(htmlHeader, htmlWrap);

  const cssPane = el('div', 'lc-editorPane lc-editorPane-css');
  const cssHeader = el('div', 'lc-editorHeader lc-editorHeader-tabs');
  const cssTabs = el('div', 'lc-editorTabs');
  const cssTab = document.createElement('button');
  cssTab.type = 'button';
  cssTab.className = 'lc-editorTab is-active';
  cssTab.textContent = 'CSS';
  const jsTab = document.createElement('button');
  jsTab.type = 'button';
  jsTab.className = 'lc-editorTab';
  jsTab.textContent = 'JavaScript';
  cssTabs.append(cssTab, jsTab);

  const jsControls = el('div', 'lc-editorActions');
  const runButton = document.createElement('button');
  runButton.type = 'button';
  runButton.className = 'lc-editorAction';
  runButton.textContent = 'Run';
  jsControls.append(runButton);

  cssHeader.append(cssTabs, jsControls);
  const cssWrap = el('div', 'lc-editorWrap lc-editorWrap-tabs');
  const cssEditorDiv = el('div', 'lc-editor lc-editor-css is-active');
  const jsEditorDiv = el('div', 'lc-editor lc-editor-js');
  cssWrap.append(cssEditorDiv, jsEditorDiv);
  cssPane.append(cssHeader, cssWrap);

  const editorResizer = el('div', 'lc-editorResizer');

  left.append(htmlPane, editorResizer, cssPane);

  // Preview
  const iframe = document.createElement('iframe');
  iframe.className = 'lc-iframe';
  iframe.referrerPolicy = 'no-referrer-when-downgrade';
  right.append(iframe);

  main.append(left, resizer, right, settings);
  app.append(toolbar, main);
  root.append(app);

  return {
    app,
    toolbar,
    htmlEditorDiv,
    cssEditorDiv,
    jsEditorDiv,
    htmlPane,
    cssPane,
    cssTab,
    jsTab,
    jsControls,
    runButton,
    editorResizer,
    main,
    left,
    right,
    resizer,
    iframe,
    settings,
    settingsHeader,
    settingsBody,
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
        shadowDomEnabled: payload.shadowDomEnabled ?? false,
        shortcodeEnabled: payload.shortcodeEnabled ?? cfg.settingsData.shortcodeEnabled ?? false,
      };
  }

  let htmlModel: import('monaco-editor').editor.ITextModel;
  let cssModel: import('monaco-editor').editor.ITextModel;
  let jsModel: import('monaco-editor').editor.ITextModel;
  let cssEditor: import('monaco-editor').editor.IStandaloneCodeEditor;
  let jsEditor: import('monaco-editor').editor.IStandaloneCodeEditor;
  let activeEditor = null as null | import('monaco-editor').editor.IStandaloneCodeEditor;
  let tailwindCss = importedGeneratedCss;
  let tailwindCompileToken = 0;
  let tailwindCompileInFlight = false;
  let tailwindCompileQueued = false;
  let saveInProgress = false;
  let editorCollapsed = false;
  let settingsOpen = false;
  let jsEnabled = Boolean(cfg.jsEnabled);
  let shadowDomEnabled = Boolean(cfg.settingsData?.shadowDomEnabled);
  let shortcodeEnabled = Boolean(cfg.settingsData?.shortcodeEnabled);
  let externalScripts = Array.isArray(cfg.settingsData?.externalScripts)
    ? [...cfg.settingsData.externalScripts]
    : [];
  let activeCssTab: 'css' | 'js' = 'css';
  let editorsReady = false;
  let pendingJsAction: 'run' | 'disable' | null = null;
  let sendRunJs: (() => void) | null = null;
  let sendDisableJs: (() => void) | null = null;
  let initialJsPending = true;
  const canEditJavaScript = Boolean(cfg.canEditJavaScript);

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
  const monaco = await loadMonaco(cfg.monacoVsPath);

  emmetHTML(monaco, ['html']);
  emmetCSS(monaco, ['css']);

  htmlModel = monaco.editor.createModel(cfg.initialHtml ?? '', 'html');
  const useTailwindDefault = !importedState;
  const initialCss =
    tailwindEnabled && (cfg.initialCss ?? '').trim() === '' && useTailwindDefault
      ? DEFAULT_TAILWIND_CSS
      : (cfg.initialCss ?? '');
  cssModel = monaco.editor.createModel(initialCss, 'css');
  jsModel = monaco.editor.createModel(cfg.initialJs ?? '', 'javascript');

  const htmlEditor = monaco.editor.create(ui.htmlEditorDiv, {
    model: htmlModel,
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
  });

  cssEditor = monaco.editor.create(ui.cssEditorDiv, {
    model: cssModel,
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
  });

  jsEditor = monaco.editor.create(ui.jsEditorDiv, {
    model: jsModel,
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
    readOnly: !canEditJavaScript,
  });

  toolbarApi?.update({ statusText: '' });

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

  const setJavaScriptEnabled = (enabled: boolean) => {
    jsEnabled = enabled;
    if (!jsEnabled && activeCssTab === 'js') {
      setCssTab('css');
    } else {
      updateJsUi();
    }
    if (!sendRunJs || !sendDisableJs) {
      if (!enabled) {
        pendingJsAction = 'disable';
      }
      return;
    }
    if (!enabled) {
      sendExternalScripts([]);
      sendDisableJs();
      return;
    }
    sendExternalScripts(externalScripts);
    queueInitialJsRun();
  };

  const setShadowDomEnabled = (enabled: boolean) => {
    shadowDomEnabled = enabled;
    sendRender();
    sendExternalScripts(jsEnabled ? externalScripts : []);
    if (!jsEnabled) {
      sendDisableJs?.();
      return;
    }
    if (sendRunJs) {
      sendRunJs();
    } else {
      pendingJsAction = 'run';
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
    onExternalScriptsChange: (scripts) => {
      externalScripts = scripts;
      sendExternalScripts(jsEnabled ? externalScripts : []);
    },
  });

  ui.runButton.addEventListener('click', () => {
    if (!jsEnabled) return;
    if (sendRunJs) {
      sendRunJs();
    } else {
      pendingJsAction = 'run';
    }
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

  const setStatus = (text: string) => {
    if (saveInProgress && text === '') {
      return;
    }
    toolbarApi?.update({ statusText: text });
  };

  const getPreviewCss = () => (tailwindEnabled ? tailwindCss : cssModel.getValue());

  const compileTailwind = async () => {
    if (!tailwindEnabled) return;
    if (tailwindCompileInFlight) {
      tailwindCompileQueued = true;
      return;
    }
    tailwindCompileInFlight = true;
    tailwindCompileQueued = false;
    const currentToken = ++tailwindCompileToken;

    try {
      const res = await wp.apiFetch({
        url: cfg.restCompileUrl,
        method: 'POST',
        data: {
          postId: cfg.postId,
          html: htmlModel.getValue(),
          css: cssModel.getValue(),
        },
      });

      if (currentToken !== tailwindCompileToken) {
        return;
      }
      if (!tailwindEnabled) {
        return;
      }

      if (res?.ok && typeof res.css === 'string') {
        tailwindCss = res.css;
        if (!saveInProgress) {
          setStatus('');
        }
        sendCssUpdate(tailwindCss);
      } else {
        setStatus('Tailwind compile failed.');
      }
    } catch (e: any) {
      if (currentToken !== tailwindCompileToken) {
        return;
      }
      setStatus(`Tailwind error: ${e?.message ?? e}`);
    } finally {
      if (currentToken === tailwindCompileToken) {
        tailwindCompileInFlight = false;
      }
      if (tailwindEnabled && tailwindCompileQueued) {
        tailwindCompileQueued = false;
        compileTailwindDebounced();
      }
    }
  };

  const compileTailwindDebounced = debounce(compileTailwind, 300);

  const setTailwindEnabled = (enabled: boolean) => {
    tailwindEnabled = enabled;
    ui.app.classList.toggle('is-tailwind', enabled);
    toolbarApi?.update({ tailwindEnabled: enabled });
    if (enabled) {
      sendRender();
      compileTailwind();
    } else {
      if (editorSplitActive && lastHtmlHeight > 0) {
        setEditorSplitHeight(lastHtmlHeight);
      }
      sendRender();
    }
  };

  // Preview render (canonicalize HTML + keep lc-id -> source map)
  let previewReady = false;
  let pendingRender = false;
  let canonicalCache: CanonicalResult | null = null;
  let canonicalCacheHtml = '';
  let canonicalDomCacheHtml = '';
  let canonicalDomRoot: HTMLElement | null = null;
  let lcSourceMap: Record<string, SourceRange> = {};
  let lastCanonicalError: string | null = null;
  let selectionDecorations: string[] = [];
  let cssSelectionDecorations: string[] = [];
  let lastSelectedLcId: string | null = null;
  const overviewHighlightColor = 'rgba(96, 165, 250, 0.35)';

  const getCanonical = () => {
    const html = htmlModel.getValue();
    if (canonicalCache && html === canonicalCacheHtml) {
      return canonicalCache;
    }
    canonicalCacheHtml = html;
    canonicalCache = canonicalizeHtml(html);
    return canonicalCache;
  };

  const resetCanonicalCache = () => {
    canonicalCache = null;
    canonicalCacheHtml = '';
    canonicalDomCacheHtml = '';
    canonicalDomRoot = null;
  };

  const getCanonicalDomRoot = () => {
    const canonical = getCanonical();
    if (canonicalDomRoot && canonical.canonicalHTML === canonicalDomCacheHtml) {
      return canonicalDomRoot;
    }
    const doc = document.implementation.createHTMLDocument('');
    const wrapper = doc.createElement('div');
    wrapper.innerHTML = canonical.canonicalHTML || '';
    doc.body.appendChild(wrapper);
    canonicalDomCacheHtml = canonical.canonicalHTML || '';
    canonicalDomRoot = wrapper;
    return wrapper;
  };

  const sendInit = () => {
    ui.iframe.contentWindow?.postMessage({
      type: 'LC_INIT',
      postId: cfg.postId,
    }, targetOrigin);
  };

  const sendRender = () => {
    const canonical = getCanonical();
    lcSourceMap = canonical.map;

    if (canonical.error && canonical.error !== lastCanonicalError) {
      console.error('[WP LiveCode] Falling back to raw HTML for preview:', canonical.error);
      lastCanonicalError = canonical.error;
    } else if (!canonical.error) {
      lastCanonicalError = null;
    }

    const payload = {
      type: 'LC_RENDER',
      canonicalHTML: canonical.canonicalHTML,
      cssText: getPreviewCss(),
      shadowDomEnabled,
    };
    if (!previewReady) {
      pendingRender = true;
      return;
    }
    ui.iframe.contentWindow?.postMessage(payload, targetOrigin);
  };

  const sendRenderDebounced = debounce(sendRender, 120);
  const sendCssUpdate = (cssText: string) => {
    if (!previewReady) {
      return;
    }
    ui.iframe.contentWindow?.postMessage(
      {
        type: 'LC_SET_CSS',
        cssText: cssText,
      },
      targetOrigin
    );
  };
  sendRunJs = () => {
    if (!jsEnabled) return;
    if (!jsModel) {
      pendingJsAction = 'run';
      return;
    }
    if (!previewReady) {
      pendingJsAction = 'run';
      return;
    }
    ui.iframe.contentWindow?.postMessage(
      {
        type: 'LC_RUN_JS',
        jsText: jsModel.getValue(),
      },
      targetOrigin
    );
  };

  sendDisableJs = () => {
    if (!previewReady) {
      pendingJsAction = 'disable';
      return;
    }
    ui.iframe.contentWindow?.postMessage({ type: 'LC_DISABLE_JS' }, targetOrigin);
  };

  function sendExternalScripts(scripts: string[]) {
    if (!previewReady) {
      return;
    }
    ui.iframe.contentWindow?.postMessage(
      {
        type: 'LC_EXTERNAL_SCRIPTS',
        urls: scripts,
      },
      targetOrigin
    );
  }

  const queueInitialJsRun = () => {
    if (!initialJsPending || !jsEnabled || !jsModel) {
      return;
    }
    if (!jsModel.getValue().trim()) {
      initialJsPending = false;
      return;
    }
    initialJsPending = false;
    pendingJsAction = 'run';
  };

  const flushPendingJsAction = () => {
    if (!pendingJsAction) return;
    const action = pendingJsAction;
    pendingJsAction = null;
    if (action === 'run') {
      sendRunJs?.();
    } else if (action === 'disable') {
      sendDisableJs?.();
    }
  };

  setTailwindEnabled(tailwindEnabled);
  setJavaScriptEnabled(jsEnabled);
  flushPendingJsAction();

  const clearSelectionHighlight = () => {
    selectionDecorations = htmlModel.deltaDecorations(selectionDecorations, []);
    cssSelectionDecorations = cssModel.deltaDecorations(cssSelectionDecorations, []);
  };

  const clearCssSelectionHighlight = () => {
    cssSelectionDecorations = cssModel.deltaDecorations(cssSelectionDecorations, []);
  };

  const highlightCssByLcId = (lcId: string) => {
    lastSelectedLcId = lcId;
    if (tailwindEnabled) {
      cssSelectionDecorations = cssModel.deltaDecorations(cssSelectionDecorations, []);
      return;
    }
    const cssText = cssModel.getValue();
    if (!cssText.trim()) {
      cssSelectionDecorations = cssModel.deltaDecorations(cssSelectionDecorations, []);
      return;
    }
    const root = getCanonicalDomRoot();
    const target = root?.querySelector(`[${LC_ATTR_NAME}="${lcId}"]`);
    if (!target) {
      cssSelectionDecorations = cssModel.deltaDecorations(cssSelectionDecorations, []);
      return;
    }
    const rules = parseCssRules(cssText);
    const matched = rules.filter((rule) => {
      if (!mediaQueriesMatch(rule.mediaQueries)) return false;
      const cleanedSelectorText = rule.selectorText.replace(/\/\*[\s\S]*?\*\//g, ' ');
      const selectors = splitSelectors(cleanedSelectorText);
      return selectors.some((selector) => selectorMatches(target, selector));
    });
    if (!matched.length) {
      cssSelectionDecorations = cssModel.deltaDecorations(cssSelectionDecorations, []);
      return;
    }
    cssSelectionDecorations = cssModel.deltaDecorations(
      cssSelectionDecorations,
      matched.map((rule) => {
        const startPos = cssModel.getPositionAt(rule.startOffset);
        const endPos = cssModel.getPositionAt(rule.endOffset);
        return {
          range: new monaco.Range(
            startPos.lineNumber,
            startPos.column,
            endPos.lineNumber,
            endPos.column
          ),
          options: {
            className: 'lc-highlight-line',
            inlineClassName: 'lc-highlight-inline',
            overviewRuler: {
              color: overviewHighlightColor,
              position: monaco.editor.OverviewRulerLane.Full,
            },
          },
        };
      })
    );
    const first = matched[0];
    if (first) {
      const startPos = cssModel.getPositionAt(first.startOffset);
      const endPos = cssModel.getPositionAt(first.endOffset);
      const range = new monaco.Range(
        startPos.lineNumber,
        startPos.column,
        endPos.lineNumber,
        endPos.column
      );
      cssEditor.revealRangeInCenter(range, monaco.editor.ScrollType.Smooth);
    }
  };

  const highlightByLcId = (lcId: string) => {
    const rangeInfo = lcSourceMap[lcId];
    if (!rangeInfo) {
      console.warn('[WP LiveCode] No source map for lc-id:', lcId);
      return;
    }
    htmlEditor.focus();
    setActiveEditor(htmlEditor, ui.htmlPane);
    const startPos = htmlModel.getPositionAt(rangeInfo.startOffset);
    const endPos = htmlModel.getPositionAt(rangeInfo.endOffset);
    const monacoRange = new monaco.Range(
      startPos.lineNumber,
      startPos.column,
      endPos.lineNumber,
      endPos.column
    );
    selectionDecorations = htmlModel.deltaDecorations(selectionDecorations, [
      {
        range: monacoRange,
        options: {
          className: 'lc-highlight-line',
          inlineClassName: 'lc-highlight-inline',
          overviewRuler: {
            color: overviewHighlightColor,
            position: monaco.editor.OverviewRulerLane.Full,
          },
        },
      },
    ]);
    htmlEditor.revealRangeInCenter(monacoRange, monaco.editor.ScrollType.Smooth);
    htmlEditor.focus();
    highlightCssByLcId(lcId);
  };

  htmlModel.onDidChangeContent(() => {
    resetCanonicalCache();
    clearSelectionHighlight();
    sendRenderDebounced();
    if (tailwindEnabled) {
      compileTailwindDebounced();
    }
    updateUndoRedoState();
  });
  cssModel.onDidChangeContent(() => {
    if (!tailwindEnabled) {
      sendRenderDebounced();
    }
    if (tailwindEnabled) {
      compileTailwindDebounced();
    }
    selectionDecorations = htmlModel.deltaDecorations(selectionDecorations, []);
    clearCssSelectionHighlight();
    updateUndoRedoState();
  });

  jsModel.onDidChangeContent(() => {
    updateUndoRedoState();
  });

  // 初回の iframe load 後に送る
  ui.iframe.addEventListener('load', () => {
    previewReady = false;
    pendingRender = true;
    initialJsPending = true;
    sendInit();
  });

  async function handleExport() {
    if (!htmlModel || !cssModel || !jsModel) {
      setStatus('Export unavailable.');
      return;
    }

    setStatus('Exporting...');

    try {
      let generatedCss = '';
      if (tailwindEnabled) {
        try {
          const res = await wp.apiFetch({
            url: cfg.restCompileUrl,
            method: 'POST',
            data: {
              postId: cfg.postId,
              html: htmlModel.getValue(),
              css: cssModel.getValue(),
            },
          });

          if (res?.ok && typeof res.css === 'string') {
            generatedCss = res.css;
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('[WP LiveCode] Export compile failed', error);
        }
      }

      const payload: ExportPayload = {
        version: 1,
        html: htmlModel.getValue(),
        css: cssModel.getValue(),
        tailwind: tailwindEnabled,
        generatedCss: tailwindEnabled ? (generatedCss || tailwindCss) : '',
        js: jsModel.getValue(),
        jsEnabled,
        externalScripts: [...externalScripts],
        shadowDomEnabled,
        shortcodeEnabled,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `livecode-${cfg.postId}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 500);

      setStatus('Exported.');
      window.setTimeout(() => {
        if (!saveInProgress) {
          setStatus('');
        }
      }, 1200);
    } catch (e: any) {
      setStatus(`Export error: ${e?.message ?? e}`);
    }
  }

  async function handleSave() {
    if (!htmlModel || !cssModel) {
      return;
    }
    saveInProgress = true;
    setStatus('Saving...');

    try {
      const cssForSave = cssModel.getValue();
      const payload: Record<string, any> = {
        postId: cfg.postId,
        html: htmlModel.getValue(),
        css: cssForSave,
        tailwind: tailwindEnabled,
      };
      if (canEditJavaScript) {
        payload.js = jsModel.getValue();
        payload.jsEnabled = jsEnabled;
      }
      const res = await wp.apiFetch({
        url: cfg.restUrl,
        method: 'POST',
        data: payload,
      });

      if (res?.ok) {
        setStatus('Saved.');
        window.setTimeout(() => {
          if (!tailwindCompileInFlight) {
            setStatus('');
          }
        }, 1200);
      } else {
        setStatus('Save failed.');
      }
    } catch (e: any) {
      setStatus(`Save error: ${e?.message ?? e}`);
    } finally {
      saveInProgress = false;
    }
  }

  // iframe -> parent への通信：DOM セレクタの受け取りや初期化に用いる
  window.addEventListener('message', (event) => {
    if (event.origin !== targetOrigin) return;
    const data = event.data;

    if (data?.type === 'LC_READY') {
      previewReady = true;
      if (pendingRender) {
        pendingRender = false;
      }
      sendRender();
      sendExternalScripts(jsEnabled ? externalScripts : []);
      queueInitialJsRun();
      flushPendingJsAction();
    }

    if (data?.type === 'LC_SELECT' && typeof data.lcId === 'string') {
      highlightByLcId(data.lcId);
    }
  });

  const setSettingsOpen = (open: boolean) => {
    settingsOpen = open;
    ui.app.classList.toggle('is-settings-open', open);
    toolbarApi?.update({ settingsOpen: open });
  };
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
});
