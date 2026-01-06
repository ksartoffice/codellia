// filepath: src/admin/main.ts
import './style.css';
import * as parse5 from 'parse5';
import type { DefaultTreeAdapterTypes } from 'parse5';

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
      restNonce: string;
    };
    monaco?: MonacoType;
    require?: any; // AMD loader
  }
}

type Tab = 'html' | 'css';

type SourceRange = {
  startOffset: number;
  endOffset: number;
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

function buildLayout(root: HTMLElement) {
  const app = el('div', 'lc-app');

  // Toolbar
  const toolbar = el('div', 'lc-toolbar');
  const btnUndo = el('button', 'button lc-btn');
  btnUndo.textContent = 'Undo';
  const btnRedo = el('button', 'button lc-btn');
  btnRedo.textContent = 'Redo';
  const btnSave = el('button', 'button button-primary lc-btn');
  btnSave.textContent = 'Save';
  const tailwindToggle = el('label', 'lc-toggle');
  const tailwindCheckbox = document.createElement('input');
  tailwindCheckbox.type = 'checkbox';
  tailwindCheckbox.className = 'lc-toggleCheckbox';
  const tailwindLabel = el('span', 'lc-toggleLabel');
  tailwindLabel.textContent = 'TailwindCSS: Off';
  tailwindToggle.append(tailwindCheckbox, tailwindLabel);
  const status = el('span', 'lc-status');
  status.textContent = '';

  toolbar.append(btnUndo, btnRedo, btnSave, tailwindToggle, status);

  // Main split
  const main = el('div', 'lc-main');
  const left = el('div', 'lc-left');
  const right = el('div', 'lc-right');

  // Tabs
  const tabs = el('div', 'lc-tabs');
  const tabHtml = el('button', 'lc-tab is-active');
  tabHtml.textContent = 'HTML';
  tabHtml.dataset.tab = 'html';
  const tabCss = el('button', 'lc-tab');
  tabCss.textContent = 'CSS';
  tabCss.dataset.tab = 'css';
  tabs.append(tabHtml, tabCss);

  // Editor container
  const editorWrap = el('div', 'lc-editorWrap');
  const editorDiv = el('div', 'lc-editor');
  editorWrap.append(editorDiv);

  left.append(tabs, editorWrap);

  // Preview
  const iframe = document.createElement('iframe');
  iframe.className = 'lc-iframe';
  iframe.referrerPolicy = 'no-referrer-when-downgrade';
  right.append(iframe);

  main.append(left, right);
  app.append(toolbar, main);
  root.append(app);

  return {
    btnUndo,
    btnRedo,
    btnSave,
    tailwindCheckbox,
    tailwindLabel,
    tailwindToggle,
    status,
    tabHtml,
    tabCss,
    editorDiv,
    iframe,
  };
}

async function main() {
  const cfg = window.WP_LIVECODE;
  const mount = document.getElementById('wp-livecode-app');
  if (!mount) return;

  const ui = buildLayout(mount);

  // REST nonce middleware
  if (wp?.apiFetch?.createNonceMiddleware) {
    wp.apiFetch.use(wp.apiFetch.createNonceMiddleware(cfg.restNonce));
  }

  // iframe
  ui.iframe.src = cfg.previewUrl;
  const targetOrigin = new URL(cfg.previewUrl).origin;

  // Monaco
  ui.status.textContent = 'Loading Monaco...';
  const monaco = await loadMonaco(cfg.monacoVsPath);

  const htmlModel = monaco.editor.createModel(cfg.initialHtml ?? '', 'html');
  const cssModel = monaco.editor.createModel(cfg.initialCss ?? '', 'css');

  let activeTab: Tab = 'html';
  let tailwindEnabled = false;

  const editor = monaco.editor.create(ui.editorDiv, {
    model: htmlModel,
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
  });

  ui.status.textContent = '';

  function setActiveTab(tab: Tab) {
    activeTab = tab;

    // tab UI
    ui.tabHtml.classList.toggle('is-active', tab === 'html');
    ui.tabCss.classList.toggle('is-active', tab === 'css');

    editor.setModel(tab === 'html' ? htmlModel : cssModel);
    editor.focus();
  }

  const setTailwindEnabled = (enabled: boolean) => {
    tailwindEnabled = enabled;
    ui.tabCss.classList.toggle('is-hidden', enabled);
    ui.tailwindToggle.classList.toggle('is-on', enabled);
    ui.tailwindLabel.textContent = enabled ? 'TailwindCSS: On' : 'TailwindCSS: Off';
    if (enabled && activeTab === 'css') {
      setActiveTab('html');
    }
  };

  ui.tabHtml.addEventListener('click', () => setActiveTab('html'));
  ui.tabCss.addEventListener('click', () => setActiveTab('css'));
  ui.tailwindCheckbox.addEventListener('change', (event) => {
    const checked = (event.target as HTMLInputElement)?.checked ?? false;
    setTailwindEnabled(checked);
  });
  setTailwindEnabled(false);

  // Preview render (canonicalize HTML + keep lc-id -> source map)
  let previewReady = false;
  let pendingRender = false;
  let canonicalCache: CanonicalResult | null = null;
  let canonicalCacheHtml = '';
  let lcSourceMap: Record<string, SourceRange> = {};
  let lastCanonicalError: string | null = null;
  let selectionDecorations: string[] = [];

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
      cssText: cssModel.getValue(),
    };
    if (!previewReady) {
      pendingRender = true;
      return;
    }
    ui.iframe.contentWindow?.postMessage(payload, targetOrigin);
  };

  const sendRenderDebounced = debounce(sendRender, 120);

  const clearSelectionHighlight = () => {
    selectionDecorations = htmlModel.deltaDecorations(selectionDecorations, []);
  };

  const highlightByLcId = (lcId: string) => {
    const rangeInfo = lcSourceMap[lcId];
    if (!rangeInfo) {
      console.warn('[WP LiveCode] No source map for lc-id:', lcId);
      return;
    }
    setActiveTab('html');
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
    editor.revealRangeInCenter(monacoRange, monaco.editor.ScrollType.Smooth);
    editor.focus();
  };

  htmlModel.onDidChangeContent(() => {
    resetCanonicalCache();
    clearSelectionHighlight();
    sendRenderDebounced();
  });
  cssModel.onDidChangeContent(sendRenderDebounced);

  // 初回の iframe load 後に送る
  ui.iframe.addEventListener('load', () => {
    previewReady = false;
    pendingRender = true;
    sendInit();
  });

  // Toolbar actions
  ui.btnUndo.addEventListener('click', () => editor.trigger('toolbar', 'undo', null));
  ui.btnRedo.addEventListener('click', () => editor.trigger('toolbar', 'redo', null));

  ui.btnSave.addEventListener('click', async () => {
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
        window.setTimeout(() => (ui.status.textContent = ''), 1200);
      } else {
        ui.status.textContent = 'Save failed.';
      }
    } catch (e: any) {
      ui.status.textContent = `Save error: ${e?.message ?? e}`;
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
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
});
