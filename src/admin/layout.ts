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
  const app = el('div', 'cd-app');

  // Toolbar (React mount point)
  const toolbar = el('div', 'cd-toolbar');

  // Main split
  const main = el('div', 'cd-main');
  const left = el('div', 'cd-left');
  const resizer = el('div', 'cd-resizer');
  const right = el('div', 'cd-right');
  const settings = el('aside', 'cd-settings');
  settings.id = 'cd-settings';
  const settingsInner = el('div', 'cd-settingsInner');
  const settingsHeader = el('div', 'cd-settingsHeader');
  const settingsBody = el('div', 'cd-settingsBody');
  settingsInner.append(settingsHeader, settingsBody);
  settings.append(settingsInner);

  const htmlPane = el('div', 'cd-editorPane cd-editorPane-html is-active');
  const htmlHeader = el('div', 'cd-editorHeader');
  htmlHeader.textContent = __( 'HTML', 'codellia' );
  const htmlWrap = el('div', 'cd-editorWrap');
  const htmlEditorDiv = el('div', 'cd-editor cd-editor-html');
  htmlWrap.append(htmlEditorDiv);
  htmlPane.append(htmlHeader, htmlWrap);

  const cssPane = el('div', 'cd-editorPane cd-editorPane-css');
  const cssHeader = el('div', 'cd-editorHeader cd-editorHeader-tabs');
  const cssTabs = el('div', 'cd-editorTabs');
  const cssTab = document.createElement('button');
  cssTab.type = 'button';
  cssTab.className = 'cd-editorTab is-active';
  cssTab.textContent = __( 'CSS', 'codellia' );
  const jsTab = document.createElement('button');
  jsTab.type = 'button';
  jsTab.className = 'cd-editorTab';
  jsTab.textContent = __( 'JavaScript', 'codellia' );
  cssTabs.append(cssTab, jsTab);

  const jsControls = el('div', 'cd-editorActions');
  const runButton = document.createElement('button');
  runButton.type = 'button';
  runButton.className = 'cd-editorAction';
  runButton.textContent = __( 'Run', 'codellia' );
  jsControls.append(runButton);

  cssHeader.append(cssTabs, jsControls);
  const cssWrap = el('div', 'cd-editorWrap cd-editorWrap-tabs');
  const cssEditorDiv = el('div', 'cd-editor cd-editor-css is-active');
  const jsEditorDiv = el('div', 'cd-editor cd-editor-js');
  cssWrap.append(cssEditorDiv, jsEditorDiv);
  cssPane.append(cssHeader, cssWrap);

  const editorResizer = el('div', 'cd-editorResizer');

  left.append(htmlPane, editorResizer, cssPane);

  // Preview
  const iframe = document.createElement('iframe');
  iframe.className = 'cd-iframe';
  iframe.referrerPolicy = 'no-referrer-when-downgrade';
  const previewBadge = el('div', 'cd-previewBadge');
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

