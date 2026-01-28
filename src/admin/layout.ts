import { __ } from '@wordpress/i18n';

type LayoutRefs = {
  app: HTMLDivElement;
  toolbar: HTMLDivElement;
  htmlHeader: HTMLDivElement;
  htmlEditorDiv: HTMLDivElement;
  cssEditorDiv: HTMLDivElement;
  jsEditorDiv: HTMLDivElement;
  htmlPane: HTMLDivElement;
  cssPane: HTMLDivElement;
  cssTab: HTMLButtonElement;
  jsTab: HTMLButtonElement;
  jsControls: HTMLDivElement;
  runButton: HTMLButtonElement;
  editorResizer: HTMLDivElement;
  main: HTMLDivElement;
  left: HTMLDivElement;
  right: HTMLDivElement;
  resizer: HTMLDivElement;
  iframe: HTMLIFrameElement;
  previewBadge: HTMLDivElement;
  settings: HTMLElement;
  settingsHeader: HTMLDivElement;
  settingsBody: HTMLDivElement;
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string) {
  const element = document.createElement(tag);
  if (cls) element.className = cls;
  return element;
}

export function buildLayout(root: HTMLElement): LayoutRefs {
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
  htmlHeader.textContent = __( 'HTML', 'wp-livecode' );
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
  cssTab.textContent = __( 'CSS', 'wp-livecode' );
  const jsTab = document.createElement('button');
  jsTab.type = 'button';
  jsTab.className = 'lc-editorTab';
  jsTab.textContent = __( 'JavaScript', 'wp-livecode' );
  cssTabs.append(cssTab, jsTab);

  const jsControls = el('div', 'lc-editorActions');
  const runButton = document.createElement('button');
  runButton.type = 'button';
  runButton.className = 'lc-editorAction';
  runButton.textContent = __( 'Run', 'wp-livecode' );
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
  const previewBadge = el('div', 'lc-previewBadge');
  previewBadge.setAttribute('role', 'status');
  previewBadge.setAttribute('aria-live', 'polite');
  previewBadge.setAttribute('aria-atomic', 'true');
  right.append(iframe, previewBadge);

  main.append(left, resizer, right, settings);
  app.append(toolbar, main);
  root.append(app);

  return {
    app,
    toolbar,
    htmlHeader,
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
    previewBadge,
    settings,
    settingsHeader,
    settingsBody,
  };
}

export type { LayoutRefs };
