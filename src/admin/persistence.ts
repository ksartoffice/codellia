import type { ExportPayload } from './types';

type ApiFetch = (args: any) => Promise<any>;

type TailwindCompilerDeps = {
  apiFetch: ApiFetch;
  restCompileUrl: string;
  postId: number;
  getHtml: () => string;
  getCss: () => string;
  isTailwindEnabled: () => boolean;
  onCssCompiled: (css: string) => void;
  onStatus: (text: string) => void;
  onStatusClear: () => void;
};

export type TailwindCompiler = {
  compile: () => Promise<void>;
  isInFlight: () => boolean;
};

export function createTailwindCompiler(deps: TailwindCompilerDeps): TailwindCompiler {
  let tailwindCompileToken = 0;
  let tailwindCompileInFlight = false;
  let tailwindCompileQueued = false;

  const compile = async () => {
    if (!deps.isTailwindEnabled()) return;
    if (tailwindCompileInFlight) {
      tailwindCompileQueued = true;
      return;
    }
    tailwindCompileInFlight = true;
    tailwindCompileQueued = false;
    const currentToken = ++tailwindCompileToken;

    try {
      const res = await deps.apiFetch({
        url: deps.restCompileUrl,
        method: 'POST',
        data: {
          postId: deps.postId,
          html: deps.getHtml(),
          css: deps.getCss(),
        },
      });

      if (currentToken !== tailwindCompileToken) {
        return;
      }
      if (!deps.isTailwindEnabled()) {
        return;
      }

      if (res?.ok && typeof res.css === 'string') {
        deps.onCssCompiled(res.css);
        deps.onStatusClear();
      } else {
        deps.onStatus('Tailwind compile failed.');
      }
    } catch (e: any) {
      if (currentToken !== tailwindCompileToken) {
        return;
      }
      deps.onStatus(`Tailwind error: ${e?.message ?? e}`);
    } finally {
      if (currentToken === tailwindCompileToken) {
        tailwindCompileInFlight = false;
      }
      if (deps.isTailwindEnabled() && tailwindCompileQueued) {
        tailwindCompileQueued = false;
        compile();
      }
    }
  };

  return {
    compile,
    isInFlight: () => tailwindCompileInFlight,
  };
}

type SaveParams = {
  apiFetch: ApiFetch;
  restUrl: string;
  postId: number;
  html: string;
  css: string;
  tailwindEnabled: boolean;
  canEditJavaScript: boolean;
  js: string;
  jsEnabled: boolean;
};

export async function saveLivecode(params: SaveParams): Promise<{ ok: boolean; error?: string }> {
  try {
    const payload: Record<string, any> = {
      postId: params.postId,
      html: params.html,
      css: params.css,
      tailwind: params.tailwindEnabled,
    };
    if (params.canEditJavaScript) {
      payload.js = params.js;
      payload.jsEnabled = params.jsEnabled;
    }
    const res = await params.apiFetch({
      url: params.restUrl,
      method: 'POST',
      data: payload,
    });

    if (res?.ok) {
      return { ok: true };
    }
    return { ok: false, error: 'Save failed.' };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

type ExportParams = {
  apiFetch: ApiFetch;
  restCompileUrl: string;
  postId: number;
  html: string;
  css: string;
  tailwindEnabled: boolean;
  tailwindCss: string;
  js: string;
  jsEnabled: boolean;
  externalScripts: string[];
  externalStyles: string[];
  shadowDomEnabled: boolean;
  shortcodeEnabled: boolean;
  liveHighlightEnabled: boolean;
};

export async function exportLivecode(params: ExportParams): Promise<{ ok: boolean; error?: string }> {
  try {
    let generatedCss = '';
    if (params.tailwindEnabled) {
      try {
        const res = await params.apiFetch({
          url: params.restCompileUrl,
          method: 'POST',
          data: {
            postId: params.postId,
            html: params.html,
            css: params.css,
          },
        });

        if (res?.ok && typeof res.css === 'string') {
          generatedCss = res.css;
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[WP LiveCode] Export compile failed', error);
      }
    }

    const payload: ExportPayload = {
      version: 1,
      html: params.html,
      css: params.css,
      tailwind: params.tailwindEnabled,
      generatedCss: params.tailwindEnabled ? (generatedCss || params.tailwindCss) : '',
      js: params.js,
      jsEnabled: params.jsEnabled,
      externalScripts: [...params.externalScripts],
      externalStyles: [...params.externalStyles],
      shadowDomEnabled: params.shadowDomEnabled,
      shortcodeEnabled: params.shortcodeEnabled,
      liveHighlightEnabled: params.liveHighlightEnabled,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `livecode-${params.postId}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 500);

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? e };
  }
}
