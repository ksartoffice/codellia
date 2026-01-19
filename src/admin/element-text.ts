import * as parse5 from 'parse5';
import type { DefaultTreeAdapterTypes } from 'parse5';

type InnerRange = {
  startOffset: number;
  endOffset: number;
};

type ElementTextInfo = InnerRange & {
  text: string;
};

const ALLOWED_INLINE_TAGS = new Set(['br', 'span']);
const LC_ATTR_NAME = 'data-lc-id';
const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

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
  return node.nodeName === '#text';
}

function isEditableChild(node: DefaultTreeAdapterTypes.Node) {
  if (isTextNode(node)) {
    return true;
  }
  if (isElement(node)) {
    return ALLOWED_INLINE_TAGS.has(node.tagName);
  }
  return false;
}

function getExistingLcId(el: DefaultTreeAdapterTypes.Element): string | null {
  const attr = el.attrs.find((item) => item.name === LC_ATTR_NAME);
  return attr ? attr.value : null;
}

function getInnerRange(
  loc: DefaultTreeAdapterTypes.Element['sourceCodeLocation']
): InnerRange | null {
  if (!loc) {
    return null;
  }
  const start =
    loc.startTag && typeof loc.startTag.endOffset === 'number'
      ? loc.startTag.endOffset
      : loc.startOffset;
  const end =
    loc.endTag && typeof loc.endTag.startOffset === 'number' ? loc.endTag.startOffset : loc.endOffset;
  if (typeof start !== 'number' || typeof end !== 'number') {
    return null;
  }
  if (end < start) {
    return null;
  }
  return { startOffset: start, endOffset: end };
}

export function getEditableElementText(html: string, lcId: string): ElementTextInfo | null {
  const fragment = parse5.parseFragment(html, { sourceCodeLocationInfo: true });
  let seq = 0;
  let result: ElementTextInfo | null = null;

  const walk = (node: DefaultTreeAdapterTypes.ParentNode) => {
    for (const child of node.childNodes || []) {
      if (isElement(child)) {
        const existingId = getExistingLcId(child);
        const id = existingId ?? `lc-${++seq}`;
        if (id === lcId) {
          if (VOID_TAGS.has(child.tagName)) {
            result = null;
            return;
          }
          const range = getInnerRange(child.sourceCodeLocation);
          if (!range) {
            result = null;
            return;
          }
          const isEditable = (child.childNodes || []).every((entry) => isEditableChild(entry));
          if (!isEditable) {
            result = null;
            return;
          }
          result = {
            text: html.slice(range.startOffset, range.endOffset),
            startOffset: range.startOffset,
            endOffset: range.endOffset,
          };
          return;
        }
        walk(child);
        if (result) return;
        if (isTemplateElement(child)) {
          walk(child.content);
          if (result) return;
        }
      } else if (isParentNode(child)) {
        walk(child);
        if (result) return;
      }
    }
  };

  walk(fragment);
  return result;
}
