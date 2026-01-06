// filepath: src/admin/main.ts
import './style.css';
import * as parse5 from 'parse5';
import type { DefaultTreeAdapterTypes } from 'parse5';
import { initSettings, type SettingsData } from './settings';

// wp-api-fetch は admin 側でグローバル wp.apiFetch として使える
declare const wp: any;

type MonacoType = typeof import('monaco-editor');

declare global {
  interface Window {
    WP_LIVECODE: {
      postId: number;
      initialHtml: string;
      initialCss: string;
      previewUrl: string;
      monacoVsPath: string;
      restUrl: string;
      restCompileUrl: string;
      settingsRestUrl: string;
      settingsData: SettingsData;
      backUrl?: string;
      tailwindEnabled?: boolean;
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

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

const ICONS = {
  back: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-left-icon lucide-chevron-left"><path d="m15 18-6-6 6-6"/></svg>',
  undo: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-undo2-icon lucide-undo-2"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>',
  redo: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-redo2-icon lucide-redo-2"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"/></svg>',
  save: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-save-icon lucide-save"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>',
  panelClose: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-panel-left-close-icon lucide-panel-left-close"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m16 15-3-3 3-3"/></svg>',
  panelOpen: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-panel-left-open-icon lucide-panel-left-open"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m14 9 3 3-3 3"/></svg>',
  settings: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings-icon lucide-settings"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>',
};

function applyIconLabel(
  target: HTMLElement,
  label: string,
  svg: string,
  stacked = false
) {
  const icon = el('span', 'lc-btnIcon');
  icon.innerHTML = svg;
  const text = el('span', 'lc-btnLabel');
  text.textContent = label;
  target.append(icon, text);
  if (stacked) {
    target.classList.add('lc-btn-stack');
  }
}

function updateButtonIcon(target: HTMLElement, label: string, svg: string) {
  const labelEl = target.querySelector<HTMLElement>('.lc-btnLabel');
  const iconEl = target.querySelector<HTMLElement>('.lc-btnIcon');
  if (labelEl) labelEl.textContent = label;
  if (iconEl) iconEl.innerHTML = svg;
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

    return { canonicalHTML: parse5.serialize(fragment), map };
  } catch (error: any) {
    console.error('[WP LiveCode] canonicalizeHtml failed', error);
    return {
      canonicalHTML: html,
      map: {},
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

  // Toolbar
  const toolbar = el('div', 'lc-toolbar');
  const toolbarLeft = el('div', 'lc-toolbarGroup lc-toolbarLeft');
  const toolbarCenter = el('div', 'lc-toolbarGroup lc-toolbarCenter');
  const toolbarRight = el('div', 'lc-toolbarGroup lc-toolbarRight');

  const backLink = el('a', 'lc-btn lc-btn-back');
  applyIconLabel(backLink, 'Back to WordPress', ICONS.back);

  const btnUndo = el('button', 'lc-btn');
  btnUndo.type = 'button';
  applyIconLabel(btnUndo, 'Undo', ICONS.undo, true);
  const btnRedo = el('button', 'lc-btn');
  btnRedo.type = 'button';
  applyIconLabel(btnRedo, 'Redo', ICONS.redo, true);
  const btnToggleEditor = el('button', 'lc-btn');
  btnToggleEditor.type = 'button';
  applyIconLabel(btnToggleEditor, 'Hide', ICONS.panelClose, true);
  const btnSave = el('button', 'lc-btn lc-btn-primary');
  btnSave.type = 'button';
  applyIconLabel(btnSave, 'Save', ICONS.save, true);
  const tailwindToggle = el('label', 'lc-toggle');
  const tailwindCheckbox = document.createElement('input');
  tailwindCheckbox.type = 'checkbox';
  tailwindCheckbox.className = 'lc-toggleCheckbox';
  const tailwindLabel = el('span', 'lc-toggleLabel');
  tailwindLabel.textContent = 'TailwindCSS: Off';
  tailwindToggle.append(tailwindCheckbox, tailwindLabel);
  const btnSettings = el('button', 'lc-btn lc-btn-settings');
  btnSettings.type = 'button';
  applyIconLabel(btnSettings, 'Settings', ICONS.settings, true);
  btnSettings.setAttribute('aria-expanded', 'false');
  btnSettings.setAttribute('aria-controls', 'lc-settings');
  const status = el('span', 'lc-status');
  status.textContent = '';

  toolbarLeft.append(backLink, btnUndo, btnRedo, btnToggleEditor, btnSave);
  toolbarCenter.append(status);
  toolbarRight.append(tailwindToggle, btnSettings);
  toolbar.append(toolbarLeft, toolbarCenter, toolbarRight);

  // Main split
  const main = el('div', 'lc-main');
  const left = el('div', 'lc-left');
  const resizer = el('div', 'lc-resizer');
  const right = el('div', 'lc-right');
  const settings = el('aside', 'lc-settings');
  settings.id = 'lc-settings';
  const settingsInner = el('div', 'lc-settingsInner');
  const settingsHeader = el('div', 'lc-settingsHeader');
  settingsHeader.textContent = 'Settings';
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
  const cssHeader = el('div', 'lc-editorHeader');
  cssHeader.textContent = 'CSS';
  const cssWrap = el('div', 'lc-editorWrap');
  const cssEditorDiv = el('div', 'lc-editor lc-editor-css');
  cssWrap.append(cssEditorDiv);
  cssPane.append(cssHeader, cssWrap);

  left.append(htmlPane, cssPane);

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
    backLink,
    btnUndo,
    btnRedo,
    btnToggleEditor,
    btnSave,
    btnSettings,
    tailwindCheckbox,
    tailwindLabel,
    tailwindToggle,
    status,
    htmlEditorDiv,
    cssEditorDiv,
    htmlPane,
    cssPane,
    main,
    left,
    right,
    resizer,
    iframe,
    settings,
    settingsBody,
  };
}

async function main() {
  const cfg = window.WP_LIVECODE;
  const mount = document.getElementById('wp-livecode-app');
  if (!mount) return;

  const ui = buildLayout(mount);
  ui.backLink.href = cfg.backUrl || '/wp-admin/';
  ui.resizer.setAttribute('role', 'separator');
  ui.resizer.setAttribute('aria-orientation', 'vertical');

  // REST nonce middleware
  if (wp?.apiFetch?.createNonceMiddleware) {
    wp.apiFetch.use(wp.apiFetch.createNonceMiddleware(cfg.restNonce));
  }

  initSettings({
    container: ui.settingsBody,
    data: cfg.settingsData,
    restUrl: cfg.settingsRestUrl,
    postId: cfg.postId,
    backUrl: cfg.backUrl,
    apiFetch: wp?.apiFetch,
  });

  // iframe
  ui.iframe.src = cfg.previewUrl;
  const targetOrigin = new URL(cfg.previewUrl).origin;

  // Monaco
  ui.status.textContent = 'Loading Monaco...';
  const monaco = await loadMonaco(cfg.monacoVsPath);

  const htmlModel = monaco.editor.createModel(cfg.initialHtml ?? '', 'html');
  const cssModel = monaco.editor.createModel(cfg.initialCss ?? '', 'css');

  let activeEditor = null as null | import('monaco-editor').editor.IStandaloneCodeEditor;
  let tailwindEnabled = false;
  let tailwindCss = '';
  let tailwindCompileToken = 0;
  let tailwindCompileInFlight = false;
  let tailwindCompileQueued = false;
  let saveInProgress = false;

  const htmlEditor = monaco.editor.create(ui.htmlEditorDiv, {
    model: htmlModel,
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
  });

  const cssEditor = monaco.editor.create(ui.cssEditorDiv, {
    model: cssModel,
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
  });

  ui.status.textContent = '';

  const setActiveEditor = (
    editorInstance: import('monaco-editor').editor.IStandaloneCodeEditor,
    pane: HTMLElement
  ) => {
    activeEditor = editorInstance;
    ui.htmlPane.classList.toggle('is-active', pane === ui.htmlPane);
    ui.cssPane.classList.toggle('is-active', pane === ui.cssPane);
  };

  setActiveEditor(htmlEditor, ui.htmlPane);
  ui.htmlPane.addEventListener('click', () => htmlEditor.focus());
  ui.cssPane.addEventListener('click', () => cssEditor.focus());
  htmlEditor.onDidFocusEditorText(() => setActiveEditor(htmlEditor, ui.htmlPane));
  cssEditor.onDidFocusEditorText(() => setActiveEditor(cssEditor, ui.cssPane));

  const minLeftWidth = 320;
  const minRightWidth = 360;
  let isResizing = false;
  let editorCollapsed = false;
  let startX = 0;
  let startWidth = 0;
  let lastLeftWidth = ui.left.getBoundingClientRect().width || minLeftWidth;

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

  const setEditorCollapsed = (collapsed: boolean) => {
    editorCollapsed = collapsed;
    ui.app.classList.toggle('is-editor-collapsed', collapsed);
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
      updateButtonIcon(ui.btnToggleEditor, 'Show', ICONS.panelOpen);
    } else {
      clearLeftWidth();
      setLeftWidth(lastLeftWidth || minLeftWidth);
      updateButtonIcon(ui.btnToggleEditor, 'Hide', ICONS.panelClose);
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

  ui.btnToggleEditor.addEventListener('click', () => {
    setEditorCollapsed(!editorCollapsed);
  });

  const setStatus = (text: string) => {
    if (saveInProgress && text === '') {
      return;
    }
    ui.status.textContent = text;
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
        sendRender();
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
    ui.tailwindCheckbox.checked = enabled;
    ui.app.classList.toggle('is-tailwind', enabled);
    ui.tailwindToggle.classList.toggle('is-on', enabled);
    ui.tailwindLabel.textContent = enabled ? 'TailwindCSS: On' : 'TailwindCSS: Off';
    if (enabled && activeEditor === cssEditor) {
      htmlEditor.focus();
      setActiveEditor(htmlEditor, ui.htmlPane);
    }
    if (enabled) {
      tailwindCss = cssModel.getValue();
      sendRender();
      compileTailwind();
    } else {
      sendRender();
    }
  };

  ui.tailwindCheckbox.addEventListener('change', (event) => {
    const checked = (event.target as HTMLInputElement)?.checked ?? false;
    setTailwindEnabled(checked);
  });

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
    };
    if (!previewReady) {
      pendingRender = true;
      return;
    }
    ui.iframe.contentWindow?.postMessage(payload, targetOrigin);
  };

  const sendRenderDebounced = debounce(sendRender, 120);
  setTailwindEnabled(Boolean(cfg.tailwindEnabled));

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
  });
  cssModel.onDidChangeContent(() => {
    sendRenderDebounced();
    selectionDecorations = htmlModel.deltaDecorations(selectionDecorations, []);
    clearCssSelectionHighlight();
  });

  // 初回の iframe load 後に送る
  ui.iframe.addEventListener('load', () => {
    previewReady = false;
    pendingRender = true;
    sendInit();
  });

  // Toolbar actions
  ui.btnUndo.addEventListener('click', () => activeEditor?.trigger('toolbar', 'undo', null));
  ui.btnRedo.addEventListener('click', () => activeEditor?.trigger('toolbar', 'redo', null));

  ui.btnSave.addEventListener('click', async () => {
    saveInProgress = true;
    ui.status.textContent = 'Saving...';

    try {
      const cssForSave = tailwindEnabled ? '' : cssModel.getValue();
      const res = await wp.apiFetch({
        url: cfg.restUrl,
        method: 'POST',
        data: {
          postId: cfg.postId,
          html: htmlModel.getValue(),
          css: cssForSave,
          tailwind: tailwindEnabled,
        },
      });

      if (res?.ok) {
        ui.status.textContent = 'Saved.';
        window.setTimeout(() => {
          if (!tailwindCompileInFlight) {
            ui.status.textContent = '';
          }
        }, 1200);
      } else {
        ui.status.textContent = 'Save failed.';
      }
    } catch (e: any) {
      ui.status.textContent = `Save error: ${e?.message ?? e}`;
    } finally {
      saveInProgress = false;
    }
  });

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
    }

    if (data?.type === 'LC_SELECT' && typeof data.lcId === 'string') {
      highlightByLcId(data.lcId);
    }
  });

  let settingsOpen = false;
  const setSettingsOpen = (open: boolean) => {
    settingsOpen = open;
    ui.app.classList.toggle('is-settings-open', open);
    ui.btnSettings.classList.toggle('is-active', open);
    ui.btnSettings.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  ui.btnSettings.addEventListener('click', () => {
    setSettingsOpen(!settingsOpen);
  });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
});
