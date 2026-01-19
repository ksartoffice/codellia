import * as parse5 from 'parse5';
import type { DefaultTreeAdapterTypes } from 'parse5';
import type { MonacoType } from './monaco';
import {
  mediaQueriesMatch,
  parseCssRules,
  selectorMatches,
  splitSelectors,
} from './css-rules';

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

export type PreviewController = {
  sendRender: () => void;
  sendCssUpdate: (cssText: string) => void;
  sendExternalScripts: (scripts: string[]) => void;
  sendLiveHighlightUpdate: (enabled: boolean) => void;
  requestRunJs: () => void;
  requestDisableJs: () => void;
  queueInitialJsRun: () => void;
  flushPendingJsAction: () => void;
  resetCanonicalCache: () => void;
  clearSelectionHighlight: () => void;
  clearCssSelectionHighlight: () => void;
  handleIframeLoad: () => void;
  handleMessage: (event: MessageEvent) => void;
};

type PreviewControllerDeps = {
  iframe: HTMLIFrameElement;
  postId: number;
  targetOrigin: string;
  monaco: MonacoType;
  htmlModel: import('monaco-editor').editor.ITextModel;
  cssModel: import('monaco-editor').editor.ITextModel;
  jsModel: import('monaco-editor').editor.ITextModel;
  htmlEditor: import('monaco-editor').editor.IStandaloneCodeEditor;
  cssEditor: import('monaco-editor').editor.IStandaloneCodeEditor;
  focusHtmlEditor: () => void;
  getPreviewCss: () => string;
  getShadowDomEnabled: () => boolean;
  getLiveHighlightEnabled: () => boolean;
  getJsEnabled: () => boolean;
  getExternalScripts: () => string[];
  isTailwindEnabled: () => boolean;
};

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

export function createPreviewController(deps: PreviewControllerDeps): PreviewController {
  let previewReady = false;
  let pendingRender = false;
  let pendingJsAction: 'run' | 'disable' | null = null;
  let initialJsPending = true;
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
    const html = deps.htmlModel.getValue();
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
    deps.iframe.contentWindow?.postMessage(
      {
        type: 'LC_INIT',
        postId: deps.postId,
      },
      deps.targetOrigin
    );
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
      cssText: deps.getPreviewCss(),
      shadowDomEnabled: deps.getShadowDomEnabled(),
      liveHighlightEnabled: deps.getLiveHighlightEnabled(),
    };
    if (!previewReady) {
      pendingRender = true;
      return;
    }
    deps.iframe.contentWindow?.postMessage(payload, deps.targetOrigin);
  };

  const sendCssUpdate = (cssText: string) => {
    if (!previewReady) {
      return;
    }
    deps.iframe.contentWindow?.postMessage(
      {
        type: 'LC_SET_CSS',
        cssText: cssText,
      },
      deps.targetOrigin
    );
  };

  const requestRunJs = () => {
    if (!deps.getJsEnabled()) return;
    if (!deps.jsModel) {
      pendingJsAction = 'run';
      return;
    }
    if (!previewReady) {
      pendingJsAction = 'run';
      return;
    }
    deps.iframe.contentWindow?.postMessage(
      {
        type: 'LC_RUN_JS',
        jsText: deps.jsModel.getValue(),
      },
      deps.targetOrigin
    );
  };

  const requestDisableJs = () => {
    if (!previewReady) {
      pendingJsAction = 'disable';
      return;
    }
    deps.iframe.contentWindow?.postMessage({ type: 'LC_DISABLE_JS' }, deps.targetOrigin);
  };

  const sendExternalScripts = (scripts: string[]) => {
    if (!previewReady) {
      return;
    }
    deps.iframe.contentWindow?.postMessage(
      {
        type: 'LC_EXTERNAL_SCRIPTS',
        urls: scripts,
      },
      deps.targetOrigin
    );
  };

  const sendLiveHighlightUpdate = (enabled: boolean) => {
    if (!previewReady) {
      return;
    }
    deps.iframe.contentWindow?.postMessage(
      {
        type: 'LC_SET_HIGHLIGHT',
        liveHighlightEnabled: enabled,
      },
      deps.targetOrigin
    );
  };

  const queueInitialJsRun = () => {
    if (!initialJsPending || !deps.getJsEnabled() || !deps.jsModel) {
      return;
    }
    if (!deps.jsModel.getValue().trim()) {
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
      requestRunJs();
    } else if (action === 'disable') {
      requestDisableJs();
    }
  };

  const clearSelectionHighlight = () => {
    selectionDecorations = deps.htmlModel.deltaDecorations(selectionDecorations, []);
    cssSelectionDecorations = deps.cssModel.deltaDecorations(cssSelectionDecorations, []);
  };

  const clearCssSelectionHighlight = () => {
    cssSelectionDecorations = deps.cssModel.deltaDecorations(cssSelectionDecorations, []);
  };

  const highlightCssByLcId = (lcId: string) => {
    lastSelectedLcId = lcId;
    if (deps.isTailwindEnabled()) {
      cssSelectionDecorations = deps.cssModel.deltaDecorations(cssSelectionDecorations, []);
      return;
    }
    const cssText = deps.cssModel.getValue();
    if (!cssText.trim()) {
      cssSelectionDecorations = deps.cssModel.deltaDecorations(cssSelectionDecorations, []);
      return;
    }
    const root = getCanonicalDomRoot();
    const target = root?.querySelector(`[${LC_ATTR_NAME}="${lcId}"]`);
    if (!target) {
      cssSelectionDecorations = deps.cssModel.deltaDecorations(cssSelectionDecorations, []);
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
      cssSelectionDecorations = deps.cssModel.deltaDecorations(cssSelectionDecorations, []);
      return;
    }
    cssSelectionDecorations = deps.cssModel.deltaDecorations(
      cssSelectionDecorations,
      matched.map((rule) => {
        const startPos = deps.cssModel.getPositionAt(rule.startOffset);
        const endPos = deps.cssModel.getPositionAt(rule.endOffset);
        return {
          range: new deps.monaco.Range(
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
              position: deps.monaco.editor.OverviewRulerLane.Full,
            },
          },
        };
      })
    );
    const first = matched[0];
    if (first) {
      const startPos = deps.cssModel.getPositionAt(first.startOffset);
      const endPos = deps.cssModel.getPositionAt(first.endOffset);
      const range = new deps.monaco.Range(
        startPos.lineNumber,
        startPos.column,
        endPos.lineNumber,
        endPos.column
      );
      deps.cssEditor.revealRangeInCenter(range, deps.monaco.editor.ScrollType.Smooth);
    }
  };

  const highlightByLcId = (lcId: string) => {
    const rangeInfo = lcSourceMap[lcId];
    if (!rangeInfo) {
      console.warn('[WP LiveCode] No source map for lc-id:', lcId);
      return;
    }
    deps.focusHtmlEditor();
    const startPos = deps.htmlModel.getPositionAt(rangeInfo.startOffset);
    const endPos = deps.htmlModel.getPositionAt(rangeInfo.endOffset);
    const monacoRange = new deps.monaco.Range(
      startPos.lineNumber,
      startPos.column,
      endPos.lineNumber,
      endPos.column
    );
    selectionDecorations = deps.htmlModel.deltaDecorations(selectionDecorations, [
      {
        range: monacoRange,
        options: {
          className: 'lc-highlight-line',
          inlineClassName: 'lc-highlight-inline',
          overviewRuler: {
            color: overviewHighlightColor,
            position: deps.monaco.editor.OverviewRulerLane.Full,
          },
        },
      },
    ]);
    deps.htmlEditor.revealRangeInCenter(monacoRange, deps.monaco.editor.ScrollType.Smooth);
    deps.htmlEditor.focus();
    highlightCssByLcId(lcId);
  };

  const handleIframeLoad = () => {
    previewReady = false;
    pendingRender = true;
    initialJsPending = true;
    sendInit();
  };

  const handleMessage = (event: MessageEvent) => {
    if (event.origin !== deps.targetOrigin) return;
    const data = event.data;

    if (data?.type === 'LC_READY') {
      previewReady = true;
      if (pendingRender) {
        pendingRender = false;
      }
      sendRender();
      sendExternalScripts(deps.getJsEnabled() ? deps.getExternalScripts() : []);
      queueInitialJsRun();
      flushPendingJsAction();
    }

    if (data?.type === 'LC_SELECT' && typeof data.lcId === 'string') {
      highlightByLcId(data.lcId);
    }
  };

  return {
    sendRender,
    sendCssUpdate,
    sendExternalScripts,
    sendLiveHighlightUpdate,
    requestRunJs,
    requestDisableJs,
    queueInitialJsRun,
    flushPendingJsAction,
    resetCanonicalCache,
    clearSelectionHighlight,
    clearCssSelectionHighlight,
    handleIframeLoad,
    handleMessage,
  };
}
