import { createElement, type IconNode, type SVGProps } from 'lucide';

export function renderLucideIcon(icon: IconNode, attrs: SVGProps = {}): string {
  if (typeof document === 'undefined') {
    return '';
  }

  const element = createElement(icon, attrs);
  return element.outerHTML;
}
