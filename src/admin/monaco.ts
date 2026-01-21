import { emmetCSS, emmetHTML } from 'emmet-monaco-es';

export type MonacoType = typeof import('monaco-editor');

export type MonacoSetup = {
  monaco: MonacoType;
  htmlModel: import('monaco-editor').editor.ITextModel;
  cssModel: import('monaco-editor').editor.ITextModel;
  jsModel: import('monaco-editor').editor.ITextModel;
  htmlEditor: import('monaco-editor').editor.IStandaloneCodeEditor;
  cssEditor: import('monaco-editor').editor.IStandaloneCodeEditor;
  jsEditor: import('monaco-editor').editor.IStandaloneCodeEditor;
};

type MonacoInitOptions = {
  vsPath: string;
  initialHtml: string;
  initialCss: string;
  initialJs: string;
  tailwindEnabled: boolean;
  useTailwindDefault: boolean;
  canEditJs: boolean;
  htmlContainer: HTMLElement;
  cssContainer: HTMLElement;
  jsContainer: HTMLElement;
};

const DEFAULT_TAILWIND_CSS =
  '@layer theme, base, components, utilities;\n' +
  '@import "tailwindcss/theme.css" layer(theme);\n' +
  '@import "tailwindcss/preflight.css" layer(base);\n' +
  '@import "tailwindcss/utilities.css" layer(utilities);\n' +
  '\n' +
  '@theme {\n' +
  '  /* ... */\n' +
  '}\n';

export async function loadMonaco(vsPath: string): Promise<MonacoType> {
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

export async function initMonacoEditors(options: MonacoInitOptions): Promise<MonacoSetup> {
  const monaco = await loadMonaco(options.vsPath);

  emmetHTML(monaco, ['html']);
  emmetCSS(monaco, ['css']);

  const initialCss =
    options.tailwindEnabled && options.initialCss.trim() === '' && options.useTailwindDefault
      ? DEFAULT_TAILWIND_CSS
      : options.initialCss;

  const htmlModel = monaco.editor.createModel(options.initialHtml ?? '', 'html');
  const cssModel = monaco.editor.createModel(initialCss ?? '', 'css');
  const jsModel = monaco.editor.createModel(options.initialJs ?? '', 'javascript');

  const htmlEditor = monaco.editor.create(options.htmlContainer, {
    model: htmlModel,
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
  });

  const cssEditor = monaco.editor.create(options.cssContainer, {
    model: cssModel,
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
  });

  const jsEditor = monaco.editor.create(options.jsContainer, {
    model: jsModel,
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
    readOnly: !options.canEditJs,
  });

  return {
    monaco,
    htmlModel,
    cssModel,
    jsModel,
    htmlEditor,
    cssEditor,
    jsEditor,
  };
}
