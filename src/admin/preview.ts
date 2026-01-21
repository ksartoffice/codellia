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
  sendExternalStyles: (styles: string[]) => void;
  sendLiveHighlightUpdate: (enabled: boolean) => void;
  sendElementsTabState: (open: boolean) => void;
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
  getExternalStyles: () => string[];
  isTailwindEnabled: () => boolean;
  renderShortcodes?: (items: ShortcodePlaceholder[]) => Promise<Record<string, string>>;
  onSelect?: (lcId: string) => void;
  onOpenElementsTab?: () => void;
};

const LC_ATTR_NAME = 'data-lc-id';
const SC_PLACEHOLDER_ATTR = 'data-lc-sc-placeholder';
const SHORTCODE_REGEX =
  /\[(\[?)([\w-]+)(?![\w-])([^\]\/]*(?:\/(?!\])|[^\]])*?)(?:(\/)\]|](?:([^\[]*?(?:\[(?!\/\2\])[^\[]*?)*?)\[\/\2\])?)(\]?)/g;
const HTML_NS = 'http://www.w3.org/1999/xhtml';
const SKIP_SHORTCODE_TAGS = new Set(['script', 'style', 'textarea']);

function isElement(node: DefaultTreeAdapterTypes.Node): node is DefaultTreeAdapterTypes.Element {
  return (node as DefaultTreeAdapterTypes.Element).tagName !== undefined;
}

function isParentNode(node: DefaultTreeAdapterTypes.Node): node is DefaultTreeAdapterTypes.ParentNode {
  return Array.isArray((node as DefaultTreeAdapterTypes.ParentNode).childNodes);
}

function isTemplateElement(node: DefaultTreeAdapterTypes.Element): node is DefaultTreeAdapterTypes.Template {
  return node.tagName === 'template' && Boolean((node as DefaultTreeAdapterTypes.Template).content);
}

function isTextNode(node: DefaultTreeAdapterTypes.Node): node is DefaultTreeAdapterTypes.TextNode {
  return (node as DefaultTreeAdapterTypes.TextNode).nodeName === '#text';
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

function createTextNode(value: string): DefaultTreeAdapterTypes.TextNode {
  return {
    nodeName: '#text',
    value,
    parentNode: null,
  };
}

function createPlaceholderNode(id: string): DefaultTreeAdapterTypes.Element {
  return {
    nodeName: 'span',
    tagName: 'span',
    attrs: [{ name: SC_PLACEHOLDER_ATTR, value: id }],
    namespaceURI: HTML_NS,
    childNodes: [],
    parentNode: null,
  };
}

function splitTextWithShortcodes(
  text: string,
  nextId: () => string,
  shortcodes: ShortcodePlaceholder[]
): DefaultTreeAdapterTypes.Node[] | null {
  if (!text.includes('[')) {
    return null;
  }
  SHORTCODE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null = null;
  let lastIndex = 0;
  let changed = false;
  const nodes: DefaultTreeAdapterTypes.Node[] = [];

  while ((match = SHORTCODE_REGEX.exec(text))) {
    const full = match[0];
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      nodes.push(createTextNode(text.slice(lastIndex, matchIndex)));
    }
    const isEscaped = match[1] === '[' && match[6] === ']';
    if (isEscaped) {
      const unescaped = full.slice(1, -1);
      nodes.push(createTextNode(unescaped));
    } else {
      const id = nextId();
      nodes.push(createPlaceholderNode(id));
      shortcodes.push({
        id,
        shortcode: full,
        startOffset: matchIndex,
        endOffset: matchIndex + full.length,
      });
    }
    lastIndex = matchIndex + full.length;
    changed = true;
  }

  if (!changed) {
    return null;
  }

  if (lastIndex < text.length) {
    nodes.push(createTextNode(text.slice(lastIndex)));
  }

  return nodes;
}

function replaceShortcodesWithPlaceholders(html: string): {
  htmlWithPlaceholders: string;
  shortcodes: ShortcodePlaceholder[];
} {
  if (!html.includes('[')) {
    return { htmlWithPlaceholders: html, shortcodes: [] };
  }

  const fragment = parse5.parseFragment(html);
  const shortcodes: ShortcodePlaceholder[] = [];
  let seq = 0;
  const nextId = () => `sc-${++seq}`;

  const walk = (node: DefaultTreeAdapterTypes.ParentNode) => {
    const children = node.childNodes || [];
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i];
      if (isElement(child)) {
        if (SKIP_SHORTCODE_TAGS.has(child.tagName)) {
          continue;
        }
        walk(child);
        if (isTemplateElement(child)) {
          walk(child.content);
        }
        continue;
      }
      if (isTextNode(child)) {
        const replacementNodes = splitTextWithShortcodes(child.value, nextId, shortcodes);
        if (replacementNodes) {
          children.splice(i, 1, ...replacementNodes);
          replacementNodes.forEach((nodeItem) => {
            nodeItem.parentNode = node;
          });
          i += replacementNodes.length - 1;
        }
        continue;
      }
      if (isParentNode(child)) {
        walk(child);
      }
    }
  };

  walk(fragment);

  return {
    htmlWithPlaceholders: parse5.serialize(fragment),
    shortcodes,
  };
}

function applyShortcodeResults(
  html: string,
  shortcodes: ShortcodePlaceholder[],
  results: Record<string, string>
): string {
  if (!shortcodes.length) {
    return html;
  }
  let output = html;
  shortcodes.forEach((entry) => {
    const placeholder = `<span ${SC_PLACEHOLDER_ATTR}="${entry.id}"></span>`;
    const replacement = Object.prototype.hasOwnProperty.call(results, entry.id)
      ? results[entry.id]
      : entry.shortcode;
    output = output.split(placeholder).join(replacement ?? '');
  });
  return output;
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
  let pendingElementsTabOpen: boolean | null = null;
  let canonicalCache: CanonicalResult | null = null;
  let canonicalCacheHtml = '';
  let canonicalDomCacheHtml = '';
  let canonicalDomRoot: HTMLElement | null = null;
  let lcSourceMap: Record<string, SourceRange> = {};
  let lastCanonicalError: string | null = null;
  let lastShortcodeSourceHtml = '';
  let lastShortcodeRenderedHtml = '';
  let renderToken = 0;
  let selectionDecorations: string[] = [];
  let cssSelectionDecorations: string[] = [];
  let lastSelectedLcId: string | null = null;
  const overviewHighlightColor = 'rgba(96, 165, 250, 0.35)';
  let elementsTabOpen = false;

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
    lastShortcodeSourceHtml = '';
    lastShortcodeRenderedHtml = '';
  };

  const renderShortcodesIfNeeded = async (html: string, token: number) => {
    if (!deps.renderShortcodes) {
      return html;
    }
    if (html === lastShortcodeSourceHtml) {
      return lastShortcodeRenderedHtml || html;
    }
    const { htmlWithPlaceholders, shortcodes } = replaceShortcodesWithPlaceholders(html);
    if (!shortcodes.length) {
      lastShortcodeSourceHtml = html;
      lastShortcodeRenderedHtml = htmlWithPlaceholders;
      return htmlWithPlaceholders;
    }
    try {
      const results = await deps.renderShortcodes(shortcodes);
      if (token !== renderToken) {
        return html;
      }
      const resolved = applyShortcodeResults(htmlWithPlaceholders, shortcodes, results || {});
      lastShortcodeSourceHtml = html;
      lastShortcodeRenderedHtml = resolved;
      return resolved;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[WP LiveCode] Shortcode render failed', error);
      return htmlWithPlaceholders;
    }
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
      cssText: deps.getPreviewCss(),
      shadowDomEnabled: deps.getShadowDomEnabled(),
      liveHighlightEnabled: deps.getLiveHighlightEnabled(),
    };
    if (!previewReady) {
      pendingRender = true;
      return;
    }
    const currentToken = ++renderToken;
    const dispatch = async () => {
      const html = await renderShortcodesIfNeeded(canonical.canonicalHTML, currentToken);
      if (currentToken !== renderToken) {
        return;
      }
      if (!previewReady) {
        pendingRender = true;
        return;
      }
      deps.iframe.contentWindow?.postMessage(
        { ...payload, canonicalHTML: html },
        deps.targetOrigin
      );
    };
    void dispatch();
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

  const sendExternalStyles = (styles: string[]) => {
    if (!previewReady) {
      return;
    }
    deps.iframe.contentWindow?.postMessage(
      {
        type: 'LC_EXTERNAL_STYLES',
        urls: styles,
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

  const sendElementsTabState = (open: boolean) => {
    elementsTabOpen = open;
    if (!previewReady) {
      pendingElementsTabOpen = open;
      return;
    }
    deps.iframe.contentWindow?.postMessage(
      {
        type: 'LC_SET_ELEMENTS_TAB_OPEN',
        open,
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
      sendExternalStyles(deps.getExternalStyles());
      queueInitialJsRun();
      flushPendingJsAction();
      if (pendingElementsTabOpen !== null) {
        const nextOpen = pendingElementsTabOpen;
        pendingElementsTabOpen = null;
        sendElementsTabState(nextOpen);
      } else {
        sendElementsTabState(elementsTabOpen);
      }
    }

    if (data?.type === 'LC_SELECT' && typeof data.lcId === 'string') {
      deps.onSelect?.(data.lcId);
      highlightByLcId(data.lcId);
    }

    if (data?.type === 'LC_OPEN_ELEMENTS_TAB') {
      deps.onOpenElementsTab?.();
    }
  };

  return {
    sendRender,
    sendCssUpdate,
    sendExternalScripts,
    sendExternalStyles,
    sendLiveHighlightUpdate,
    sendElementsTabState,
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
