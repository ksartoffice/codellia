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

function isCommentNode(node: DefaultTreeAdapterTypes.Node): boolean {
  return node.nodeName === '#comment';
}

function isValidTagName(tagName: string) {
  return /^[a-z][a-z0-9-]*$/i.test(tagName);
}

function isEditableChild(node: DefaultTreeAdapterTypes.Node) {
  if (isTextNode(node)) {
    return true;
  }
  if (isCommentNode(node)) {
    return true;
  }
  if (isElement(node)) {
    if (!isValidTagName(node.tagName)) {
      return true;
    }
    return ALLOWED_INLINE_TAGS.has(node.tagName);
  }
  return false;
}

function getExistingLcId(el: DefaultTreeAdapterTypes.Element): string | null {
  const attr = el.attrs.find((item) => item.name === LC_ATTR_NAME);
  return attr ? attr.value : null;
}

function findClosingTagOffset(html: string, tagName: string, fromOffset: number) {
  const name = tagName.toLowerCase();
  const tagRegex = /<\/?([a-z0-9-]+)(?:\s[^>]*)?>/gi;
  tagRegex.lastIndex = fromOffset;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(html)) !== null) {
    const fullTag = match[0];
    const matchName = match[1].toLowerCase();
    if (matchName !== name) {
      continue;
    }
    const isEndTag = fullTag.startsWith('</');
    if (isEndTag) {
      if (depth === 0) {
        return match.index;
      }
      depth -= 1;
      continue;
    }
    if (VOID_TAGS.has(matchName)) {
      continue;
    }
    if (/\/\s*>$/.test(fullTag)) {
      continue;
    }
    depth += 1;
  }
  return null;
}

function getInnerRange(
  html: string,
  tagName: string,
  loc: DefaultTreeAdapterTypes.Element['sourceCodeLocation']
): InnerRange | null {
  if (!loc) {
    return null;
  }
  const start =
    loc.startTag && typeof loc.startTag.endOffset === 'number'
      ? loc.startTag.endOffset
      : loc.startOffset;
  let end =
    loc.endTag && typeof loc.endTag.startOffset === 'number' ? loc.endTag.startOffset : null;
  let fallback: number | null = null;
  if (typeof start === 'number') {
    fallback = findClosingTagOffset(html, tagName, start);
    if (fallback !== null && (end === null || fallback < end)) {
      end = fallback;
    }
  }
  if (end === null && typeof loc.endOffset === 'number') {
    end = loc.endOffset;
  }
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
  console.log('[getEditableElementText] html:', html, 'lcId:', lcId);

  const walk = (node: DefaultTreeAdapterTypes.ParentNode) => {
    for (const child of node.childNodes || []) {
      if (isElement(child)) {
        const existingId = getExistingLcId(child);
        const id = existingId ?? `lc-${++seq}`;
        console.log('[getEditableElementText] Element - tagName:', child.tagName, 'id:', id, 'existingId:', existingId);
        
        if (id === lcId) {
          console.log('[getEditableElementText] Found matching element');
          
          if (VOID_TAGS.has(child.tagName)) {
            console.log('[getEditableElementText] Element is a VOID_TAG, returning null');
            result = null;
            return;
          }
          
          const range = getInnerRange(html, child.tagName, child.sourceCodeLocation);
          console.log('[getEditableElementText] range:', range);
          if (!range) {
            console.log('[getEditableElementText] No range found, returning null');
            result = null;
            return;
          }
          
          const childNodes = child.childNodes || [];
          console.log('[getEditableElementText] childNodes count:', childNodes.length);
          childNodes.forEach((node, idx) => {
            console.log(`  [childNode ${idx}]`, {
              isText: isTextNode(node),
              isElement: isElement(node),
              tagName: isElement(node) ? (node as DefaultTreeAdapterTypes.Element).tagName : undefined,
              textContent: isTextNode(node) ? (node as DefaultTreeAdapterTypes.TextNode).value : undefined,
            });
          });
          
          const isEditable = childNodes.every((entry) => isEditableChild(entry));
          console.log('[getEditableElementText] isEditable:', isEditable);
          
          if (!isEditable) {
            console.log('[getEditableElementText] Not all children are editable, returning null');
            result = null;
            return;
          }
          
          result = {
            text: html.slice(range.startOffset, range.endOffset),
            startOffset: range.startOffset,
            endOffset: range.endOffset,
          };
          console.log('[getEditableElementText] Result text:', result.text);
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
  console.log('[getEditableElementText] Final result:', result);
  return result;
}
