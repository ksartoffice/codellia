import { __ } from '@wordpress/i18n';

import { ImagePlus, Lightbulb, Play } from 'lucide';
import { renderLucideIcon } from './lucide-icons';

type LayoutRefs = {
  app: HTMLDivElement;
  toolbar: HTMLDivElement;
  compactEditorTabs: HTMLDivElement;
  compactEditorActions: HTMLDivElement;
  compactHtmlTab: HTMLButtonElement;
  compactCssTab: HTMLButtonElement;
  compactJsTab: HTMLButtonElement;
  compactAddMediaButton: HTMLButtonElement;
  compactRunButton: HTMLButtonElement;
  compactShadowHintButton: HTMLButtonElement;
  htmlHeader: HTMLDivElement;
  htmlTitle: HTMLSpanElement;
  addMediaButton: HTMLButtonElement;
  htmlEditorDiv: HTMLDivElement;
  cssEditorDiv: HTMLDivElement;
  jsEditorDiv: HTMLDivElement;
  htmlPane: HTMLDivElement;
  cssPane: HTMLDivElement;
  cssTab: HTMLButtonElement;
  jsTab: HTMLButtonElement;
  jsControls: HTMLDivElement;
  runButton: HTMLButtonElement;
  shadowHintButton: HTMLButtonElement;
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

function createCompactActionButton(
  className: string,
  label: string,
  iconSvg: string
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);

  const icon = el('span', 'cd-compactEditorActionIcon');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = iconSvg;

  const text = el('span', 'cd-compactEditorActionLabel');
  text.textContent = label;

  button.append(icon, text);
  return button;
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

  const compactIcons = {
    media: renderLucideIcon(ImagePlus, {
      class: 'lucide lucide-image-plus-icon lucide-image-plus',
    }),
    run: renderLucideIcon(Play, {
      class: 'lucide lucide-play-icon lucide-play',
    }),
    hint: renderLucideIcon(Lightbulb, {
      class: 'lucide lucide-lightbulb-icon lucide-lightbulb',
    }),
  };

  const compactEditorTabs = el('div', 'cd-compactEditorTabs');
  const compactEditorTabsList = el('div', 'cd-editorTabs cd-compactEditorTabsList');
  const compactEditorActions = el('div', 'cd-compactEditorActions');
  const compactHtmlTab = document.createElement('button');
  compactHtmlTab.type = 'button';
  compactHtmlTab.className = 'cd-editorTab cd-compactEditorTab is-active';
  compactHtmlTab.textContent = __( 'HTML', 'codellia' );
  const compactCssTab = document.createElement('button');
  compactCssTab.type = 'button';
  compactCssTab.className = 'cd-editorTab cd-compactEditorTab';
  compactCssTab.textContent = __( 'CSS', 'codellia' );
  const compactJsTab = document.createElement('button');
  compactJsTab.type = 'button';
  compactJsTab.className = 'cd-editorTab cd-compactEditorTab';
  compactJsTab.textContent = __( 'JavaScript', 'codellia' );
  compactEditorTabsList.append(compactHtmlTab, compactCssTab, compactJsTab);
  const compactAddMediaButton = createCompactActionButton(
    'cd-editorAction cd-compactEditorAction cd-compactEditorAction-media',
    __( 'Add Media', 'codellia' ),
    compactIcons.media
  );
  const compactRunButton = createCompactActionButton(
    'cd-editorAction cd-compactEditorAction cd-compactEditorAction-run',
    __( 'Run', 'codellia' ),
    compactIcons.run
  );
  const compactShadowHintButton = createCompactActionButton(
    'cd-editorAction cd-compactEditorAction cd-compactEditorAction-hint',
    __( 'Shadow DOM Hint', 'codellia' ),
    compactIcons.hint
  );
  compactEditorActions.append(compactAddMediaButton, compactRunButton, compactShadowHintButton);
  compactEditorTabs.append(compactEditorTabsList, compactEditorActions);

  const htmlPane = el('div', 'cd-editorPane cd-editorPane-html is-active');
  const htmlHeader = el('div', 'cd-editorHeader cd-editorHeader-tabs');
  const htmlTitle = el('span', 'cd-editorTitle');
  htmlTitle.textContent = __( 'HTML', 'codellia' );
  const htmlActions = el('div', 'cd-editorActions');
  const addMediaButton = document.createElement('button');
  addMediaButton.type = 'button';
  addMediaButton.className = 'cd-editorAction cd-editorAction-media';
  addMediaButton.textContent = __( 'Add Media', 'codellia' );
  htmlActions.append(addMediaButton);
  htmlHeader.append(htmlTitle, htmlActions);
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
  const shadowHintButton = document.createElement('button');
  shadowHintButton.type = 'button';
  shadowHintButton.className = 'cd-editorAction cd-editorAction-hint';
  shadowHintButton.textContent = __( 'Shadow DOM Hint', 'codellia' );
  jsControls.append(shadowHintButton, runButton);

  cssHeader.append(cssTabs, jsControls);
  const cssWrap = el('div', 'cd-editorWrap cd-editorWrap-tabs');
  const cssEditorDiv = el('div', 'cd-editor cd-editor-css is-active');
  const jsEditorDiv = el('div', 'cd-editor cd-editor-js');
  cssWrap.append(cssEditorDiv, jsEditorDiv);
  cssPane.append(cssHeader, cssWrap);

  const editorResizer = el('div', 'cd-editorResizer');

  left.append(compactEditorTabs, htmlPane, editorResizer, cssPane);

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
    compactEditorTabs,
    compactEditorActions,
    compactHtmlTab,
    compactCssTab,
    compactJsTab,
    compactAddMediaButton,
    compactRunButton,
    compactShadowHintButton,
    htmlHeader,
    htmlTitle,
    addMediaButton,
    htmlEditorDiv,
    cssEditorDiv,
    jsEditorDiv,
    htmlPane,
    cssPane,
    cssTab,
    jsTab,
    jsControls,
    runButton,
    shadowHintButton,
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

