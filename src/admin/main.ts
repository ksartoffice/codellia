import './style.css';
import { createElement, createRoot, render } from '@wordpress/element';
import { initSettings, type SettingsData } from './settings';
import { runSetupWizard } from './setup-wizard';
import { mountToolbar, type ToolbarApi, type ViewportMode } from './toolbar';
import { buildLayout } from './layout';
import { initMonacoEditors, type MonacoType } from './monaco';
import { createPreviewController, type PreviewController } from './preview';
import { getEditableElementAttributes, getEditableElementText } from './element-text';
import {
  createTailwindCompiler,
  exportCodellia,
  saveCodellia,
  type TailwindCompiler,
} from './persistence';
import type { ImportResult } from './types';
import { __, sprintf } from '@wordpress/i18n';

// wp-api-fetch は admin 側でグローバル wp.apiFetch として使える
declare const wp: any;

declare global {
  interface Window {
    CODELLIA: {
      post_id: number;
      initialHtml: string;
      initialCss: string;
      initialJs: string;
      canEditJs: boolean;
      previewUrl: string;
      iframePreviewUrl?: string;
      monacoVsPath: string;
      restUrl: string;
      restCompileUrl: string;
      renderShortcodesUrl: string;
      setupRestUrl: string;
      importRestUrl: string;
      settingsRestUrl: string;
      settingsData: SettingsData;
      backUrl?: string;
      listUrl?: string;
      tailwindEnabled?: boolean;
      setupRequired?: boolean;
      restNonce: string;
    };
    monaco?: MonacoType;
    require?: any; // AMD loader
  }
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  let t: number | undefined;
  return (...args: Parameters<T>) => {
    window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), ms);
  };
}

const VIEWPORT_TARGET_WIDTH = 1280;
const VIEWPORT_TRIGGER_WIDTH = 900;
const VIEWPORT_ORIGINAL_ATTR = 'data-codellia-original-viewport';

const applySmallScreenViewport = () => {
  const meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
  if (!meta) {
    return;
  }

  if (!meta.hasAttribute(VIEWPORT_ORIGINAL_ATTR)) {
    const original = meta.getAttribute('content') ?? '';
    meta.setAttribute(VIEWPORT_ORIGINAL_ATTR, original);
  }

  const original = meta.getAttribute(VIEWPORT_ORIGINAL_ATTR) ?? '';
  const isSmallScreen =
    Math.min(window.screen.width, window.screen.height) <= VIEWPORT_TRIGGER_WIDTH;

  if (isSmallScreen) {
    const nextContent = `width=${VIEWPORT_TARGET_WIDTH}`;
    if (meta.getAttribute('content') !== nextContent) {
      meta.setAttribute('content', nextContent);
    }
  } else if (meta.getAttribute('content') !== original) {
    meta.setAttribute('content', original);
  }
};

const initSmallScreenViewport = () => {
  applySmallScreenViewport();
  const refresh = debounce(() => applySmallScreenViewport(), 150);
  window.addEventListener('resize', refresh);
  window.addEventListener('orientationchange', refresh);
};

const resolveLayout = (value?: string): 'default' | 'standalone' | 'frame' | 'theme' => {
  if (value === 'standalone' || value === 'frame' || value === 'theme' || value === 'default') {
    return value;
  }
  return 'default';
};

const resolveDefaultLayout = (value?: string): 'standalone' | 'frame' | 'theme' => {
  if (value === 'standalone' || value === 'frame' || value === 'theme') {
    return value;
  }
  return 'theme';
};

const NOTICE_STORE = 'core/notices';
const NOTICE_IDS = {
  monaco: 'cd-monaco',
  save: 'cd-save',
  export: 'cd-export',
  tailwind: 'cd-tailwind',
  layoutFallback: 'cd-layout-fallback',
};
const NOTICE_SUCCESS_DURATION_MS = 3000;
const NOTICE_ERROR_DURATION_MS = 5000;
const NOTICE_OFFSET_GAP_PX = 8;

const syncNoticeOffset = () => {
  const toolbar = document.querySelector('.cd-toolbar') as HTMLElement | null;
  if (!toolbar) {
    return;
  }
  const base = toolbar.getBoundingClientRect().bottom + NOTICE_OFFSET_GAP_PX;
  const list = document.querySelector('.cd-noticeHost .components-snackbar-list') as HTMLElement | null;
  const noticeContainer = list?.querySelector('.components-snackbar-list__notices') as HTMLElement | null;
  const firstNotice = noticeContainer?.firstElementChild as HTMLElement | null;
  const noticeHeight = firstNotice?.getBoundingClientRect().height ?? 0;
  const offset = Math.max(0, Math.round(base + noticeHeight));
  document.documentElement.style.setProperty('--cd-notice-offset-top', `${offset}px`);
};

const createSnackbar = (
  status: 'success' | 'error' | 'info' | 'warning',
  message: string,
  id?: string,
  autoDismissMs?: number
) => {
  if (!wp?.data?.dispatch) {
    return;
  }
  const options: Record<string, any> = {
    type: 'snackbar',
    isDismissible: true,
  };
  if (id) {
    options.id = id;
  }
  wp.data.dispatch(NOTICE_STORE).createNotice(status, message, options);
  window.setTimeout(() => {
    syncNoticeOffset();
  }, 0);
  if (id && autoDismissMs) {
    window.setTimeout(() => {
      wp.data.dispatch(NOTICE_STORE).removeNotice(id);
      syncNoticeOffset();
    }, autoDismissMs);
  }
};

const removeNotice = (id: string) => {
  if (!wp?.data?.dispatch) {
    return;
  }
  wp.data.dispatch(NOTICE_STORE).removeNotice(id);
  window.setTimeout(() => {
    syncNoticeOffset();
  }, 0);
};

const mountNotices = () => {
  if (!wp?.components?.SnackbarList || !wp?.data?.useSelect) {
    return;
  }
  if (document.querySelector('.cd-noticeHost')) {
    return;
  }
  const host = document.createElement('div');
  host.className = 'cd-noticeHost';
  document.body.append(host);

  const SnackbarList = wp.components.SnackbarList;
  const useSelect = wp.data.useSelect;
  const Notices = () => {
    const notices = useSelect((select: any) => select(NOTICE_STORE).getNotices(), []);
    const snackbarNotices = Array.isArray(notices)
      ? notices.filter((notice: any) => notice.type === 'snackbar')
      : [];
    return createElement(SnackbarList, {
      notices: snackbarNotices,
      onRemove: (id: string) => removeNotice(id),
    });
  };

  const root = typeof createRoot === 'function' ? createRoot(host) : null;
  const node = createElement(Notices);
  if (root) {
    root.render(node);
  } else {
    render(node, host);
  }
  window.setTimeout(() => {
    syncNoticeOffset();
  }, 0);
};

async function main() {
  const cfg = window.CODELLIA;
  const initialViewUrl = cfg.settingsData?.viewUrl || '';
  const postId = cfg.post_id;
  const mount = document.getElementById('codellia-app');
  if (!mount) return;
  initSmallScreenViewport();
  mountNotices();

  const ui = buildLayout(mount);
  ui.resizer.setAttribute('role', 'separator');
  ui.resizer.setAttribute('aria-orientation', 'vertical');
  ui.editorResizer.setAttribute('role', 'separator');
  ui.editorResizer.setAttribute('aria-orientation', 'horizontal');

  const PREVIEW_BADGE_HIDE_MS = 2200;
  const PREVIEW_BADGE_TRANSITION_MS = 320;
  let previewBadgeTimer: number | undefined;
  let previewBadgeRaf = 0;

  const updatePreviewBadge = () => {
    const width = Math.round(ui.iframe.getBoundingClientRect().width);
    if (width > 0) {
      ui.previewBadge.textContent = `${width}px`;
    }
  };

  const showPreviewBadge = () => {
    updatePreviewBadge();
    ui.previewBadge.classList.add('is-visible');
    window.clearTimeout(previewBadgeTimer);
    previewBadgeTimer = window.setTimeout(() => {
      ui.previewBadge.classList.remove('is-visible');
    }, PREVIEW_BADGE_HIDE_MS);
  };

  const showPreviewBadgeAfterLayout = () => {
    if (isStackedLayout()) {
      applyViewportLayout();
      showPreviewBadge();
      return;
    }
    let done = false;
    const finalize = () => {
      if (done) return;
      done = true;
      ui.left.removeEventListener('transitionend', onTransitionEnd);
      applyViewportLayout();
      showPreviewBadge();
    };
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.propertyName === 'width' || event.propertyName === 'flex-basis') {
        finalize();
      }
    };
    ui.left.addEventListener('transitionend', onTransitionEnd, { once: true });
    window.setTimeout(finalize, PREVIEW_BADGE_TRANSITION_MS);
  };

  const schedulePreviewBadge = () => {
    if (previewBadgeRaf) {
      return;
    }
    previewBadgeRaf = window.requestAnimationFrame(() => {
      previewBadgeRaf = 0;
      showPreviewBadge();
    });
  };

  let toolbarApi: ToolbarApi | null = null;
  let tailwindEnabled = Boolean(cfg.tailwindEnabled);
  let importedState: ImportResult | null = null;
  let importedGeneratedCss = '';

  // REST nonce middleware
  if (wp?.apiFetch?.createNonceMiddleware) {
    wp.apiFetch.use(wp.apiFetch.createNonceMiddleware(cfg.restNonce));
  }

  if (cfg.setupRequired) {
    if (!cfg.setupRestUrl || !wp?.apiFetch) {
      ui.app.textContent = __( 'Setup wizard unavailable.', 'codellia' );
      return;
    }

    const setupHost = document.createElement('div');
    setupHost.className = 'cd-setupHost';
    document.body.append(setupHost);

    try {
      const result = await runSetupWizard({
        container: setupHost,
        postId,
        restUrl: cfg.setupRestUrl,
        importRestUrl: cfg.importRestUrl,
        apiFetch: wp?.apiFetch,
        backUrl: cfg.listUrl || cfg.backUrl,
        initialTailwindEnabled: tailwindEnabled,
      });
      tailwindEnabled = result.tailwindEnabled;
      if (result.imported) {
        importedState = result.imported;
        importedGeneratedCss = result.imported.payload.generatedCss || '';
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[Codellia] Setup failed', error);
      ui.app.textContent = __( 'Setup failed.', 'codellia' );
      return;
    } finally {
      setupHost.remove();
    }
  }

  if (importedState) {
    const payload = importedState.payload;
    cfg.initialHtml = payload.html;
    cfg.initialCss = payload.css;
    cfg.initialJs = payload.js ?? '';
    cfg.tailwindEnabled = payload.tailwindEnabled;
    tailwindEnabled = payload.tailwindEnabled;
    cfg.settingsData =
      importedState.settingsData ?? {
        ...cfg.settingsData,
        externalScripts: payload.externalScripts ?? [],
        externalStyles: payload.externalStyles ?? [],
        shadowDomEnabled: payload.shadowDomEnabled ?? false,
        shortcodeEnabled: payload.shortcodeEnabled ?? cfg.settingsData.shortcodeEnabled ?? false,
        singlePageEnabled:
          payload.singlePageEnabled ?? cfg.settingsData.singlePageEnabled ?? true,
        liveHighlightEnabled:
          payload.liveHighlightEnabled ?? cfg.settingsData.liveHighlightEnabled ?? true,
      };
    if (initialViewUrl && cfg.settingsData && !cfg.settingsData.viewUrl) {
      cfg.settingsData.viewUrl = initialViewUrl;
    }
  }

  let monaco: MonacoType;
  let htmlModel: import('monaco-editor').editor.ITextModel;
  let cssModel: import('monaco-editor').editor.ITextModel;
  let jsModel: import('monaco-editor').editor.ITextModel;
  let htmlEditor: import('monaco-editor').editor.IStandaloneCodeEditor;
  let cssEditor: import('monaco-editor').editor.IStandaloneCodeEditor;
  let jsEditor: import('monaco-editor').editor.IStandaloneCodeEditor;
  let activeEditor = null as null | import('monaco-editor').editor.IStandaloneCodeEditor;
  let tailwindCss = importedGeneratedCss;
  let editorCollapsed = false;
  let settingsOpen = false;
  let viewportMode: ViewportMode = 'desktop';
  let activeSettingsTab: 'settings' | 'elements' = 'settings';
  const canEditJs = Boolean(cfg.canEditJs);
  let jsEnabled = true;
  let shadowDomEnabled = Boolean(cfg.settingsData?.shadowDomEnabled);
  let shortcodeEnabled = Boolean(cfg.settingsData?.shortcodeEnabled);
  let singlePageEnabled = cfg.settingsData?.singlePageEnabled ?? true;
  let liveHighlightEnabled = cfg.settingsData?.liveHighlightEnabled ?? true;
  let externalScripts = Array.isArray(cfg.settingsData?.externalScripts)
    ? [...cfg.settingsData.externalScripts]
    : [];
  let externalStyles = Array.isArray(cfg.settingsData?.externalStyles)
    ? [...cfg.settingsData.externalStyles]
    : [];
  let activeCssTab: 'css' | 'js' = 'css';
  let editorsReady = false;
  let hasUnsavedChanges = false;
  let saveInFlight: Promise<{ ok: boolean; error?: string }> | null = null;
  let lastSaved = { html: '', css: '', js: '' };
  let viewPostUrl = cfg.settingsData?.viewUrl || '';
  let postStatus = cfg.settingsData?.status || 'draft';
  let postTitle = cfg.settingsData?.title || '';
  let layoutMode = resolveLayout(cfg.settingsData?.layout);
  let defaultLayout = resolveDefaultLayout(cfg.settingsData?.defaultLayout);

  let preview: PreviewController | null = null;
  let tailwindCompiler: TailwindCompiler | null = null;
  let sendRenderDebounced: (() => void) | null = null;
  let compileTailwindDebounced: (() => void) | null = null;
  let selectedLcId: string | null = null;
  let suppressSelectionClear = 0;
  const selectionListeners = new Set<(lcId: string | null) => void>();
  const contentListeners = new Set<() => void>();

  const notifySelection = () => {
    selectionListeners.forEach((listener) => listener(selectedLcId));
  };

  const subscribeSelection = (listener: (lcId: string | null) => void) => {
    selectionListeners.add(listener);
    listener(selectedLcId);
    return () => selectionListeners.delete(listener);
  };

  const notifyContentChange = () => {
    contentListeners.forEach((listener) => listener());
  };

  const subscribeContentChange = (listener: () => void) => {
    contentListeners.add(listener);
    return () => contentListeners.delete(listener);
  };

  const getUnsavedFlags = () => {
    if (!htmlModel || !cssModel || !jsModel) {
      return { html: false, css: false, js: false, hasAny: false };
    }
    const htmlDirty = htmlModel.getValue() !== lastSaved.html;
    const cssDirty = cssModel.getValue() !== lastSaved.css;
    const jsDirty = jsModel.getValue() !== lastSaved.js;
    return { html: htmlDirty, css: cssDirty, js: jsDirty, hasAny: htmlDirty || cssDirty || jsDirty };
  };

  const syncUnsavedUi = () => {
    const { html, css, js, hasAny } = getUnsavedFlags();
    ui.htmlHeader.classList.toggle('has-unsaved', html);
    ui.cssTab.classList.toggle('has-unsaved', css);
    ui.jsTab.classList.toggle('has-unsaved', js);
    if (hasAny !== hasUnsavedChanges) {
      hasUnsavedChanges = hasAny;
      toolbarApi?.update({ hasUnsavedChanges });
    }
  };

  const markSavedState = () => {
    if (!htmlModel || !cssModel || !jsModel) {
      return;
    }
    lastSaved = {
      html: htmlModel.getValue(),
      css: cssModel.getValue(),
      js: jsModel.getValue(),
    };
    syncUnsavedUi();
  };

  const syncElementsTabState = () => {
    preview?.sendElementsTabState(settingsOpen && activeSettingsTab === 'elements');
  };

  const getResolvedLayout = () => (layoutMode === 'default' ? defaultLayout : layoutMode);
  const isThemeLayoutActive = () => getResolvedLayout() === 'theme';

  const setSettingsOpen = (open: boolean) => {
    settingsOpen = open;
    ui.app.classList.toggle('is-settings-open', open);
    toolbarApi?.update({ settingsOpen: open });
    syncElementsTabState();
    applyViewportLayout();
  };

  async function handleExport() {
    if (!htmlModel || !cssModel || !jsModel) {
      createSnackbar(
        'error',
        __( 'Export unavailable.', 'codellia' ),
        NOTICE_IDS.export,
        NOTICE_ERROR_DURATION_MS
      );
      return;
    }

    createSnackbar('info', __( 'Exporting...', 'codellia' ), NOTICE_IDS.export);

    const result = await exportCodellia({
      apiFetch: wp.apiFetch,
      restCompileUrl: cfg.restCompileUrl,
      postId,
      html: htmlModel.getValue(),
      css: cssModel.getValue(),
      tailwindEnabled,
      tailwindCss,
      js: jsModel.getValue(),
      externalScripts,
      externalStyles,
      shadowDomEnabled,
      shortcodeEnabled,
      singlePageEnabled,
      liveHighlightEnabled,
    });

    if (result.ok) {
      createSnackbar(
        'success',
        __( 'Exported.', 'codellia' ),
        NOTICE_IDS.export,
        NOTICE_SUCCESS_DURATION_MS
      );
      return;
    }

    if (result.error) {
      /* translators: %s: error message. */
      createSnackbar(
        'error',
        sprintf(__( 'Export error: %s', 'codellia' ), result.error),
        NOTICE_IDS.export,
        NOTICE_ERROR_DURATION_MS
      );
    } else {
      createSnackbar(
        'error',
        __( 'Export failed.', 'codellia' ),
        NOTICE_IDS.export,
        NOTICE_ERROR_DURATION_MS
      );
    }
  }

  async function handleSave(): Promise<{ ok: boolean; error?: string }> {
    if (!htmlModel || !cssModel) {
      return { ok: false, error: __( 'Save failed.', 'codellia' ) };
    }
    if (!getUnsavedFlags().hasAny) {
      return { ok: true };
    }
    if (saveInFlight) {
      return await saveInFlight;
    }
    saveInFlight = (async () => {
    createSnackbar('info', __( 'Saving...', 'codellia' ), NOTICE_IDS.save);

      const result = await saveCodellia({
        apiFetch: wp.apiFetch,
        restUrl: cfg.restUrl,
        postId,
        html: htmlModel.getValue(),
        css: cssModel.getValue(),
        tailwindEnabled,
        canEditJs,
        js: jsModel.getValue(),
      });

      if (result.ok) {
        markSavedState();
        createSnackbar(
          'success',
          __( 'Saved.', 'codellia' ),
          NOTICE_IDS.save,
          NOTICE_SUCCESS_DURATION_MS
        );
        return { ok: true };
      } else if (result.error) {
        /* translators: %s: error message. */
        createSnackbar(
          'error',
          sprintf(__( 'Save error: %s', 'codellia' ), result.error),
          NOTICE_IDS.save,
          NOTICE_ERROR_DURATION_MS
        );
        return { ok: false, error: result.error };
      } else {
        createSnackbar(
          'error',
          __( 'Save failed.', 'codellia' ),
          NOTICE_IDS.save,
          NOTICE_ERROR_DURATION_MS
        );
        return { ok: false, error: __( 'Save failed.', 'codellia' ) };
      }
    })();

    try {
      return await saveInFlight;
    } finally {
      saveInFlight = null;
    }
  }

  const runSaveShortcut = async () => {
    await handleSave();
  };

  const registerSaveShortcut = (
    editorInstance: import('monaco-editor').editor.IStandaloneCodeEditor
  ) => {
    editorInstance.addAction({
      id: 'codellia.save',
      label: __( 'Save', 'codellia' ),
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: runSaveShortcut,
    });
  };

  const basePreviewUrl = cfg.iframePreviewUrl || cfg.previewUrl;
  const buildPreviewLayoutUrl = (url: string, layout: string) => {
    if (!url) {
      return url;
    }
    try {
      const previewUrl = new URL(url, window.location.origin);
      if (layout && layout !== 'default') {
        previewUrl.searchParams.set('codellia_layout', layout);
      } else {
        previewUrl.searchParams.delete('codellia_layout');
      }
      return previewUrl.toString();
    } catch {
      return url;
    }
  };
  const getPreviewUrl = () => buildPreviewLayoutUrl(basePreviewUrl, layoutMode);
  const buildPreviewRefreshUrl = (url: string) => {
    if (!url) {
      return url;
    }
    try {
      const refreshUrl = new URL(url, window.location.origin);
      refreshUrl.searchParams.set('codellia_refresh', Date.now().toString());
      return refreshUrl.toString();
    } catch {
      const hasQuery = url.includes('?');
      const hashIndex = url.indexOf('#');
      const suffix = `${hasQuery ? '&' : '?'}codellia_refresh=${Date.now()}`;
      if (hashIndex === -1) {
        return url + suffix;
      }
      return url.slice(0, hashIndex) + suffix + url.slice(hashIndex);
    }
  };

  toolbarApi = mountToolbar(
    ui.toolbar,
    {
      backUrl: cfg.backUrl || '/wp-admin/',
      listUrl: cfg.listUrl || '',
      canUndo: false,
      canRedo: false,
      editorCollapsed,
      settingsOpen,
      tailwindEnabled,
      viewportMode,
      hasUnsavedChanges: false,
      viewPostUrl,
      postStatus,
      postTitle,
    },
    {
      onUndo: () => activeEditor?.trigger('toolbar', 'undo', null),
      onRedo: () => activeEditor?.trigger('toolbar', 'redo', null),
      onToggleEditor: () => setEditorCollapsed(!editorCollapsed),
      onSave: handleSave,
      onExport: handleExport,
      onToggleSettings: () => setSettingsOpen(!settingsOpen),
      onViewportChange: (mode) => setViewportMode(mode),
      onUpdateTitle: async (nextTitle) => {
        if (!cfg.settingsRestUrl || !wp?.apiFetch) {
          return { ok: false, error: __( 'Settings unavailable.', 'codellia' ) };
        }
        try {
          const response = await wp.apiFetch({
            url: cfg.settingsRestUrl,
            method: 'POST',
            data: {
              post_id: postId,
              updates: { title: nextTitle },
            },
          });
          if (!response?.ok) {
            return { ok: false, error: response?.error || __( 'Update failed.', 'codellia' ) };
          }
          const nextSettings = response.settings as SettingsData | undefined;
          const resolvedTitle =
            nextSettings && typeof nextSettings.title === 'string'
              ? nextSettings.title
              : nextTitle;
          postTitle = resolvedTitle;
          toolbarApi?.update({ postTitle });
          window.dispatchEvent(
            new CustomEvent('cd-title-updated', { detail: { title: resolvedTitle } })
          );
          if (basePreviewUrl) {
            ui.iframe.src = buildPreviewRefreshUrl(getPreviewUrl());
          }
          return { ok: true };
        } catch (error: any) {
          return {
            ok: false,
            error: error?.message || __( 'Update failed.', 'codellia' ),
          };
        }
      },
      onUpdateStatus: async (nextStatus) => {
        if (!cfg.settingsRestUrl || !wp?.apiFetch) {
          return { ok: false, error: __( 'Settings unavailable.', 'codellia' ) };
        }
        const updates =
          nextStatus === 'private'
            ? { status: 'private', visibility: 'private' }
            : { status: nextStatus, visibility: 'public' };
        try {
          const response = await wp.apiFetch({
            url: cfg.settingsRestUrl,
            method: 'POST',
            data: {
              post_id: postId,
              updates,
            },
          });
          if (!response?.ok) {
            return { ok: false, error: response?.error || __( 'Update failed.', 'codellia' ) };
          }
          const nextSettings = response.settings as SettingsData | undefined;
          postStatus =
            nextSettings && typeof nextSettings.status === 'string'
              ? nextSettings.status
              : nextStatus;
          toolbarApi?.update({ postStatus });
          return { ok: true };
        } catch (error: any) {
          return {
            ok: false,
            error: error?.message || __( 'Update failed.', 'codellia' ),
          };
        }
      },
    }
  );
  syncNoticeOffset();
  window.setTimeout(syncNoticeOffset, 0);
  createSnackbar('info', __( 'Loading Monaco...', 'codellia' ), NOTICE_IDS.monaco);

  // iframe
  ui.iframe.src = getPreviewUrl();
  const targetOrigin = new URL(getPreviewUrl()).origin;

  // Monaco
  const monacoSetup = await initMonacoEditors({
    vsPath: cfg.monacoVsPath,
    initialHtml: cfg.initialHtml ?? '',
    initialCss: cfg.initialCss ?? '',
    initialJs: cfg.initialJs ?? '',
    tailwindEnabled,
    useTailwindDefault: !importedState,
    canEditJs,
    htmlContainer: ui.htmlEditorDiv,
    cssContainer: ui.cssEditorDiv,
    jsContainer: ui.jsEditorDiv,
  });

  ({ monaco, htmlModel, cssModel, jsModel, htmlEditor, cssEditor, jsEditor } = monacoSetup);

  registerSaveShortcut(htmlEditor);
  registerSaveShortcut(cssEditor);
  registerSaveShortcut(jsEditor);

  removeNotice(NOTICE_IDS.monaco);
  markSavedState();

  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!hasUnsavedChanges) {
      return;
    }
    event.preventDefault();
    event.returnValue = __( 'You may have unsaved changes.', 'codellia' );
  };

  window.addEventListener('beforeunload', handleBeforeUnload);

  const applyHtmlEdit = (startOffset: number, endOffset: number, nextText: string) => {
    suppressSelectionClear += 1;
    const start = htmlModel.getPositionAt(startOffset);
    const end = htmlModel.getPositionAt(endOffset);
    htmlModel.pushEditOperations(
      [],
      [
        {
          range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
          text: nextText,
        },
      ],
      () => null
    );
    suppressSelectionClear = Math.max(0, suppressSelectionClear - 1);
  };

  const isValidAttributeName = (name: string) => /^[A-Za-z0-9:_.-]+$/.test(name);

  const escapeAttributeValue = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const normalizeAttributes = (attrs: { name: string; value: string }[]) => {
    const seen = new Set<string>();
    const normalized: { name: string; value: string }[] = [];
    for (let i = attrs.length - 1; i >= 0; i -= 1) {
      const name = attrs[i].name.trim();
      if (!name || name === 'data-codellia-id' || !isValidAttributeName(name) || seen.has(name)) {
        continue;
      }
      seen.add(name);
      normalized.push({ name, value: attrs[i].value });
    }
    return normalized.reverse();
  };

  const elementsApi = {
    subscribeSelection,
    subscribeContentChange,
    getElementText: (lcId: string) => {
      const info = getEditableElementText(htmlModel.getValue(), lcId);
      return info ? info.text : null;
    },
    updateElementText: (lcId: string, text: string) => {
      const html = htmlModel.getValue();
      const info = getEditableElementText(html, lcId);
      if (!info) {
        return false;
      }
      if (info.text === text) {
        return true;
      }
      applyHtmlEdit(info.startOffset, info.endOffset, text);
      return true;
    },
    getElementAttributes: (lcId: string) => {
      const info = getEditableElementAttributes(htmlModel.getValue(), lcId);
      return info ? info.attributes : null;
    },
    updateElementAttributes: (lcId: string, attributes: { name: string; value: string }[]) => {
      const html = htmlModel.getValue();
      const info = getEditableElementAttributes(html, lcId);
      if (!info) {
        return false;
      }
      const normalized = normalizeAttributes(attributes);
      const attrText = normalized.length
        ? ` ${normalized
            .map((attr) => `${attr.name}="${escapeAttributeValue(attr.value)}"`)
            .join(' ')}`
        : '';
      const closing = info.selfClosing ? ' />' : '>';
      const nextStartTag = `<${info.tagName}${attrText}${closing}`;
      const currentStartTag = html.slice(info.startOffset, info.endOffset);
      if (currentStartTag === nextStartTag) {
        return true;
      }
      applyHtmlEdit(info.startOffset, info.endOffset, nextStartTag);
      return true;
    },
  };

  const updateUndoRedoState = () => {
    const model = activeEditor?.getModel();
    const canUndo = Boolean(model && model.canUndo());
    const canRedo = Boolean(model && model.canRedo());
    toolbarApi?.update({ canUndo, canRedo });
  };

  const setActiveEditor = (
    editorInstance: import('monaco-editor').editor.IStandaloneCodeEditor,
    pane: HTMLElement
  ) => {
    activeEditor = editorInstance;
    ui.htmlPane.classList.toggle('is-active', pane === ui.htmlPane);
    ui.cssPane.classList.toggle('is-active', pane === ui.cssPane);
    updateUndoRedoState();
  };

  const updateJsUi = () => {
    ui.jsTab.style.display = canEditJs ? '' : 'none';
    ui.jsTab.disabled = !canEditJs;
    ui.jsControls.style.display = canEditJs && activeCssTab === 'js' ? '' : 'none';
    ui.runButton.disabled = !jsEnabled || !canEditJs;
    ui.shadowHintButton.style.display = shadowDomEnabled ? '' : 'none';
    ui.shadowHintButton.disabled = !shadowDomEnabled || !canEditJs;
  };

  const shadowHintTitle = __( 'Shadow DOM Hint', 'codellia' );
  const shadowHintLead = __(
    'When Shadow DOM is enabled, HTML is rendered inside the Shadow Root.',
    'codellia'
  );
  const shadowHintDetail = __(
    'Use the root below (scoped to this script) instead of document to query elements.',
    'codellia'
  );
  const shadowHintCode =
    "const root = document.currentScript?.closest('codellia-output')?.shadowRoot || document;";
  const shadowHintNote = __(
    'Note: root can be Document or ShadowRoot; create* APIs are only on Document.',
    'codellia'
  );

  let shadowHintModal: HTMLDivElement | null = null;
  let shadowHintModalKeyHandler: ((event: KeyboardEvent) => void) | null = null;

  const copyToClipboard = async (text: string): Promise<boolean> => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // fallback below
      }
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    textarea.remove();
    return ok;
  };

  const closeShadowHintModal = () => {
    if (!shadowHintModal) return;
    shadowHintModal.remove();
    shadowHintModal = null;
    if (shadowHintModalKeyHandler) {
      window.removeEventListener('keydown', shadowHintModalKeyHandler);
      shadowHintModalKeyHandler = null;
    }
  };

  const openShadowHintModal = () => {
    if (shadowHintModal || !shadowDomEnabled) return;

    const modal = document.createElement('div');
    modal.className = 'cd-modal';
    const backdrop = document.createElement('div');
    backdrop.className = 'cd-modalBackdrop';
    backdrop.addEventListener('click', closeShadowHintModal);

    const dialog = document.createElement('div');
    dialog.className = 'cd-modalDialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', shadowHintTitle);

    const header = document.createElement('div');
    header.className = 'cd-modalHeader';
    const title = document.createElement('div');
    title.className = 'cd-modalTitle';
    title.textContent = shadowHintTitle;
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'cd-modalClose';
    closeButton.setAttribute('aria-label', __( 'Close', 'codellia' ));
    closeButton.textContent = '×';
    closeButton.addEventListener('click', closeShadowHintModal);
    header.append(title, closeButton);

    const body = document.createElement('div');
    body.className = 'cd-modalBody';
    const bodyWrap = document.createElement('div');
    bodyWrap.className = 'cd-hintBody';
    const lead = document.createElement('p');
    lead.className = 'cd-hintText';
    lead.textContent = shadowHintLead;
    const detail = document.createElement('p');
    detail.className = 'cd-hintText';
    detail.textContent = shadowHintDetail;
    const codeBlock = document.createElement('pre');
    codeBlock.className = 'cd-hintCode';
    codeBlock.textContent = shadowHintCode;
    const note = document.createElement('p');
    note.className = 'cd-hintText';
    note.textContent = shadowHintNote;
    bodyWrap.append(lead, detail, codeBlock, note);
    body.append(bodyWrap);

    const actions = document.createElement('div');
    actions.className = 'cd-modalActions';
    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'cd-btn cd-btn-secondary';
    copyButton.textContent = __( 'Copy', 'codellia' );
    copyButton.addEventListener('click', async () => {
      const ok = await copyToClipboard(shadowHintCode);
      if (ok) {
        copyButton.textContent = __( 'Copied', 'codellia' );
        window.setTimeout(() => {
          copyButton.textContent = __( 'Copy', 'codellia' );
        }, 1400);
      }
    });
    const closeAction = document.createElement('button');
    closeAction.type = 'button';
    closeAction.className = 'cd-btn cd-btn-primary';
    closeAction.textContent = __( 'Close', 'codellia' );
    closeAction.addEventListener('click', closeShadowHintModal);
    actions.append(copyButton, closeAction);

    dialog.append(header, body, actions);
    modal.append(backdrop, dialog);
    document.body.appendChild(modal);
    shadowHintModal = modal;

    shadowHintModalKeyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeShadowHintModal();
      }
    };
    window.addEventListener('keydown', shadowHintModalKeyHandler);
  };

  const missingMarkersTitle = __( 'Theme layout unavailable', 'codellia' );
  const missingMarkersBody = __(
    'This theme does not output "the_content", so the preview cannot be rendered. Codellia will switch the layout to Frame.',
    'codellia'
  );
  const missingMarkersActionLabel = __( 'OK', 'codellia' );
  const missingMarkersFallbackLayout: 'standalone' | 'frame' = 'frame';

  let missingMarkersModal: HTMLDivElement | null = null;
  let missingMarkersInFlight = false;
  let missingMarkersHandled = false;

  const closeMissingMarkersModal = () => {
    if (!missingMarkersModal) return;
    missingMarkersModal.remove();
    missingMarkersModal = null;
  };

  const applyMissingMarkersLayout = async () => {
    if (missingMarkersInFlight) {
      return false;
    }
    if (!cfg.settingsRestUrl || !wp?.apiFetch) {
      createSnackbar(
        'error',
        __( 'Settings unavailable.', 'codellia' ),
        NOTICE_IDS.layoutFallback,
        NOTICE_ERROR_DURATION_MS
      );
      return false;
    }
    missingMarkersInFlight = true;
    try {
      const response = await wp.apiFetch({
        url: cfg.settingsRestUrl,
        method: 'POST',
        data: {
          post_id: postId,
          updates: { layout: missingMarkersFallbackLayout },
        },
      });
      if (!response?.ok) {
        createSnackbar(
          'error',
          response?.error || __( 'Update failed.', 'codellia' ),
          NOTICE_IDS.layoutFallback,
          NOTICE_ERROR_DURATION_MS
        );
        return false;
      }
      const nextSettings = response.settings as SettingsData | undefined;
      const nextLayout = resolveLayout(nextSettings?.layout ?? missingMarkersFallbackLayout);
      layoutMode = nextLayout;
      if (nextSettings && typeof nextSettings.defaultLayout === 'string') {
        defaultLayout = resolveDefaultLayout(nextSettings.defaultLayout);
      }
      window.dispatchEvent(
        new CustomEvent('cd-settings-updated', {
          detail: { settings: nextSettings ?? { layout: nextLayout } },
        })
      );
      if (basePreviewUrl) {
        ui.iframe.src = buildPreviewRefreshUrl(getPreviewUrl());
      }
      missingMarkersHandled = true;
      return true;
    } catch (error: any) {
      createSnackbar(
        'error',
        error?.message || __( 'Update failed.', 'codellia' ),
        NOTICE_IDS.layoutFallback,
        NOTICE_ERROR_DURATION_MS
      );
      return false;
    } finally {
      missingMarkersInFlight = false;
    }
  };

  const openMissingMarkersModal = () => {
    if (missingMarkersModal) return;

    const modal = document.createElement('div');
    modal.className = 'cd-modal';
    const backdrop = document.createElement('div');
    backdrop.className = 'cd-modalBackdrop';

    const dialog = document.createElement('div');
    dialog.className = 'cd-modalDialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', missingMarkersTitle);

    const header = document.createElement('div');
    header.className = 'cd-modalHeader';
    const title = document.createElement('div');
    title.className = 'cd-modalTitle';
    title.textContent = missingMarkersTitle;
    header.append(title);

    const body = document.createElement('div');
    body.className = 'cd-modalBody';
    const bodyText = document.createElement('p');
    bodyText.className = 'cd-hintText';
    bodyText.textContent = missingMarkersBody;
    body.append(bodyText);

    const actions = document.createElement('div');
    actions.className = 'cd-modalActions';
    const okButton = document.createElement('button');
    okButton.type = 'button';
    okButton.className = 'cd-btn cd-btn-primary';
    okButton.textContent = missingMarkersActionLabel;
    okButton.addEventListener('click', async () => {
      if (missingMarkersInFlight) return;
      okButton.disabled = true;
      const ok = await applyMissingMarkersLayout();
      if (ok) {
        closeMissingMarkersModal();
        return;
      }
      okButton.disabled = false;
    });
    actions.append(okButton);

    dialog.append(header, body, actions);
    modal.append(backdrop, dialog);
    document.body.appendChild(modal);
    missingMarkersModal = modal;
  };

  const handleMissingMarkers = () => {
    if (missingMarkersHandled) return;
    if (!isThemeLayoutActive()) return;
    openMissingMarkersModal();
  };

  const setCssTab = (tab: 'css' | 'js') => {
    const nextTab = tab === 'js' && !canEditJs ? 'css' : tab;
    activeCssTab = nextTab;
    ui.cssTab.classList.toggle('is-active', nextTab === 'css');
    ui.jsTab.classList.toggle('is-active', nextTab === 'js');
    ui.cssEditorDiv.classList.toggle('is-active', nextTab === 'css');
    ui.jsEditorDiv.classList.toggle('is-active', nextTab === 'js');
    updateJsUi();
    if (!editorsReady) {
      return;
    }
    if (nextTab === 'js') {
      setActiveEditor(jsEditor, ui.cssPane);
      jsEditor.focus();
    } else {
      setActiveEditor(cssEditor, ui.cssPane);
      cssEditor.focus();
    }
  };

  const focusHtmlEditor = () => {
    htmlEditor.focus();
    setActiveEditor(htmlEditor, ui.htmlPane);
  };

  const getPreviewCss = () => (tailwindEnabled ? tailwindCss : cssModel.getValue());

  preview = createPreviewController({
    iframe: ui.iframe,
    postId,
    targetOrigin,
    monaco,
    htmlModel,
    cssModel,
    jsModel,
    htmlEditor,
    cssEditor,
    focusHtmlEditor,
    getPreviewCss,
    getShadowDomEnabled: () => shadowDomEnabled,
    getLiveHighlightEnabled: () => liveHighlightEnabled,
    getJsEnabled: () => jsEnabled,
    getExternalScripts: () => externalScripts,
    getExternalStyles: () => externalStyles,
    isTailwindEnabled: () => tailwindEnabled,
    renderShortcodes: async (items) => {
      if (!cfg.renderShortcodesUrl || !wp?.apiFetch) {
        return {};
      }
      try {
        const res = await wp.apiFetch({
          url: cfg.renderShortcodesUrl,
          method: 'POST',
          data: {
            post_id: postId,
            shortcodes: items.map((item) => ({ id: item.id, shortcode: item.shortcode })),
          },
        });
        if (res?.ok && res.results && typeof res.results === 'object') {
          return res.results as Record<string, string>;
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[Codellia] Shortcode render failed', error);
      }
      return {};
    },
    onSelect: (lcId) => {
      selectedLcId = lcId;
      notifySelection();
    },
    onOpenElementsTab: () => {
      if (!settingsOpen) {
        setSettingsOpen(true);
      }
      if (activeSettingsTab !== 'elements') {
        window.dispatchEvent(new CustomEvent('cd-open-elements-tab'));
      }
    },
    onMissingMarkers: () => {
      handleMissingMarkers();
    },
  });
  syncElementsTabState();

  tailwindCompiler = createTailwindCompiler({
    apiFetch: wp.apiFetch,
    restCompileUrl: cfg.restCompileUrl,
    postId,
    getHtml: () => htmlModel.getValue(),
    getCss: () => cssModel.getValue(),
    isTailwindEnabled: () => tailwindEnabled,
    onCssCompiled: (css) => {
      tailwindCss = css;
      preview?.sendCssUpdate(css);
    },
    onStatus: (text) => createSnackbar('error', text, NOTICE_IDS.tailwind, NOTICE_ERROR_DURATION_MS),
    onStatusClear: () => removeNotice(NOTICE_IDS.tailwind),
  });

  sendRenderDebounced = debounce(() => preview?.sendRender(), 120);
  compileTailwindDebounced = debounce(() => tailwindCompiler?.compile(), 300);

  const setJsEnabled = (enabled: boolean) => {
    jsEnabled = enabled;
    if ((!jsEnabled || !canEditJs) && activeCssTab === 'js') {
      setCssTab('css');
    } else {
      updateJsUi();
    }
    if (!preview) {
      return;
    }
    if (!enabled) {
      preview.sendExternalScripts([]);
      preview.requestDisableJs();
      return;
    }
    preview.sendExternalScripts(externalScripts);
    preview.queueInitialJsRun();
  };

  const setShadowDomEnabled = (enabled: boolean) => {
    shadowDomEnabled = enabled;
    updateJsUi();
    if (!shadowDomEnabled) {
      closeShadowHintModal();
    }
    preview?.sendRender();
    preview?.sendExternalScripts(jsEnabled ? externalScripts : []);
    preview?.sendExternalStyles(externalStyles);
    if (!jsEnabled) {
      preview?.requestDisableJs();
      return;
    }
    preview?.requestRunJs();
  };

  const setLiveHighlightEnabled = (enabled: boolean) => {
    liveHighlightEnabled = enabled;
    preview?.sendLiveHighlightUpdate(enabled);
  };

  const setTailwindEnabled = (enabled: boolean) => {
    tailwindEnabled = enabled;
    ui.app.classList.toggle('is-tailwind', enabled);
    toolbarApi?.update({ tailwindEnabled: enabled });
    if (enabled) {
      preview?.sendRender();
      tailwindCompiler?.compile();
    } else {
      if (editorSplitActive && lastHtmlHeight > 0) {
        setEditorSplitHeight(lastHtmlHeight);
      }
      preview?.sendRender();
    }
  };

  setActiveEditor(htmlEditor, ui.htmlPane);
  ui.htmlPane.addEventListener('click', () => htmlEditor.focus());
  ui.cssPane.addEventListener('click', () => {
    if (activeCssTab === 'js') {
      jsEditor.focus();
    } else {
      cssEditor.focus();
    }
  });
  htmlEditor.onDidFocusEditorText(() => setActiveEditor(htmlEditor, ui.htmlPane));
  cssEditor.onDidFocusEditorText(() => setCssTab('css'));
  jsEditor.onDidFocusEditorText(() => setCssTab('js'));
  ui.cssTab.addEventListener('click', () => setCssTab('css'));
  ui.jsTab.addEventListener('click', () => setCssTab('js'));
  editorsReady = true;
  updateJsUi();

  initSettings({
    container: ui.settingsBody,
    header: ui.settingsHeader,
    data: cfg.settingsData,
    restUrl: cfg.settingsRestUrl,
    postId,
    backUrl: cfg.backUrl,
    apiFetch: wp?.apiFetch,
    onShadowDomToggle: setShadowDomEnabled,
    onShortcodeToggle: (enabled) => {
      shortcodeEnabled = enabled;
    },
    onLiveHighlightToggle: setLiveHighlightEnabled,
    onExternalScriptsChange: (scripts) => {
      externalScripts = scripts;
      preview?.sendExternalScripts(jsEnabled ? externalScripts : []);
    },
    onExternalStylesChange: (styles) => {
      externalStyles = styles;
      preview?.sendExternalStyles(externalStyles);
    },
    onTabChange: (tab) => {
      activeSettingsTab = tab;
      syncElementsTabState();
    },
    onSettingsUpdate: (nextSettings) => {
      if (typeof nextSettings.viewUrl === 'string') {
        viewPostUrl = nextSettings.viewUrl;
      }
      postStatus = nextSettings.status || postStatus;
      postTitle = nextSettings.title || postTitle;
      singlePageEnabled = nextSettings.singlePageEnabled ?? singlePageEnabled;
      const currentResolved = getResolvedLayout();
      const nextLayout = resolveLayout(nextSettings.layout);
      const nextDefaultLayout =
        typeof nextSettings.defaultLayout === 'string'
          ? resolveDefaultLayout(nextSettings.defaultLayout)
          : defaultLayout;
      if (typeof nextSettings.defaultLayout === 'string') {
        defaultLayout = nextDefaultLayout;
      }
      if (nextLayout !== layoutMode) {
        layoutMode = nextLayout;
      }
      const nextResolved = nextLayout === 'default' ? nextDefaultLayout : nextLayout;
      if (nextResolved !== currentResolved) {
        ui.iframe.src = buildPreviewRefreshUrl(getPreviewUrl());
      }
      toolbarApi?.update({ viewPostUrl, postStatus, postTitle });
    },
    onClosePanel: () => setSettingsOpen(false),
    elementsApi,
  });

  ui.runButton.addEventListener('click', () => {
    if (!jsEnabled || !canEditJs) return;
    preview?.requestRunJs();
  });
  ui.shadowHintButton.addEventListener('click', () => {
    if (!shadowDomEnabled) return;
    openShadowHintModal();
  });

  const minLeftWidth = 320;
  const minRightWidth = 360;
  const desktopMinPreviewWidth = 1024;
  const viewportPresetWidths = {
    mobile: 375,
    tablet: 768,
  } as const;
  const minEditorPaneHeight = 160;
  let isResizing = false;
  let isEditorResizing = false;
  let startX = 0;
  let startY = 0;
  let startWidth = 0;
  let startHeight = 0;
  let lastLeftWidth = ui.left.getBoundingClientRect().width || minLeftWidth;
  let lastHtmlHeight = 0;
  let editorSplitActive = false;

  const getMainAvailableWidth = () => {
    const mainRect = ui.main.getBoundingClientRect();
    const settingsWidth = ui.settings.getBoundingClientRect().width;
    const resizerWidth = ui.resizer.getBoundingClientRect().width;
    return Math.max(0, mainRect.width - settingsWidth - resizerWidth);
  };

  const getPreviewAreaWidth = () => {
    return Math.max(0, ui.right.getBoundingClientRect().width);
  };

  const isStackedLayout = () => {
    return window.getComputedStyle(ui.main).flexDirection === 'column';
  };

  const ensurePreviewWidth = (minWidth: number) => {
    if (editorCollapsed || isStackedLayout()) {
      return;
    }
    const available = getMainAvailableWidth();
    const minPreviewWidth = Math.max(minRightWidth, minWidth);
    const maxLeftWidth = Math.max(minLeftWidth, available - minPreviewWidth);
    const currentLeft = ui.left.getBoundingClientRect().width;
    const nextLeft = Math.min(currentLeft, maxLeftWidth);
    if (Math.abs(currentLeft - nextLeft) > 0.5) {
      setLeftWidth(nextLeft);
    }
  };

  function applyViewportLayout(forceFit = false) {
    if (viewportMode === 'desktop') {
      ui.iframe.style.width = '100%';
      ui.iframe.style.margin = '0';
      if (forceFit) {
        ensurePreviewWidth(desktopMinPreviewWidth);
      }
      return;
    }

    const presetWidth = viewportPresetWidths[viewportMode];
    const previewAreaWidth = getPreviewAreaWidth();
    const targetWidth = Math.min(presetWidth, previewAreaWidth || presetWidth);
    ui.iframe.style.width = `${targetWidth}px`;
    ui.iframe.style.margin = '0 auto';
    if (forceFit) {
      ensurePreviewWidth(presetWidth);
    }
  }

  function setViewportMode(mode: ViewportMode) {
    const isSameMode = viewportMode === mode;
    viewportMode = mode;
    if (!isSameMode) {
      toolbarApi?.update({ viewportMode });
    }
    applyViewportLayout(true);
    showPreviewBadgeAfterLayout();
  }

  const setLeftWidth = (width: number) => {
    const clamped = Math.max(minLeftWidth, width);
    lastLeftWidth = clamped;
    ui.left.style.flex = `0 0 ${clamped}px`;
    ui.left.style.width = `${clamped}px`;
  };

  const clearLeftWidth = () => {
    ui.left.style.flex = '';
    ui.left.style.width = '';
  };

  const clearEditorSplit = () => {
    ui.htmlPane.style.flex = '';
    ui.htmlPane.style.height = '';
    ui.cssPane.style.flex = '';
    ui.cssPane.style.height = '';
  };

  const setEditorSplitHeight = (height: number) => {
    const leftRect = ui.left.getBoundingClientRect();
    const resizerHeight = ui.editorResizer.getBoundingClientRect().height;
    const available = Math.max(0, leftRect.height - resizerHeight);
    if (available <= 0) return;
    const maxHtmlHeight = Math.max(0, available - minEditorPaneHeight);
    const minHtmlHeight = Math.min(minEditorPaneHeight, maxHtmlHeight);
    const clamped = Math.min(maxHtmlHeight, Math.max(minHtmlHeight, height));
    lastHtmlHeight = clamped;
    editorSplitActive = true;
    ui.htmlPane.style.flex = `0 0 ${clamped}px`;
    ui.htmlPane.style.height = `${clamped}px`;
    ui.cssPane.style.flex = '1 1 auto';
    ui.cssPane.style.height = '';
  };

  const setEditorCollapsed = (collapsed: boolean) => {
    editorCollapsed = collapsed;
    ui.app.classList.toggle('is-editor-collapsed', collapsed);
    toolbarApi?.update({ editorCollapsed: collapsed });
    if (collapsed) {
      const currentWidth = ui.left.getBoundingClientRect().width;
      if (currentWidth > 0) {
        lastLeftWidth = currentWidth;
      }
      ui.left.style.width = `${currentWidth}px`;
      ui.left.style.flex = `0 0 ${currentWidth}px`;
      ui.left.getBoundingClientRect();
      ui.left.style.width = '0px';
      ui.left.style.flex = '0 0 0';
    } else {
      clearLeftWidth();
      setLeftWidth(lastLeftWidth || minLeftWidth);
    }
    applyViewportLayout();
    showPreviewBadgeAfterLayout();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!isResizing) return;
    const mainRect = ui.main.getBoundingClientRect();
    const settingsWidth = ui.settings.getBoundingClientRect().width;
    const resizerWidth = ui.resizer.getBoundingClientRect().width;
    const available = mainRect.width - settingsWidth - resizerWidth;
    const maxLeftWidth = Math.max(minLeftWidth, available - minRightWidth);
    const nextWidth = Math.min(maxLeftWidth, Math.max(minLeftWidth, startWidth + event.clientX - startX));
    setLeftWidth(nextWidth);
    if (viewportMode !== 'desktop') {
      applyViewportLayout();
    }
    schedulePreviewBadge();
  };

  const stopResizing = (event?: PointerEvent) => {
    if (!isResizing) return;
    isResizing = false;
    ui.app.classList.remove('is-resizing');
    if (event) {
      try {
        ui.resizer.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore if pointer capture isn't active.
      }
    }
  };

  ui.resizer.addEventListener('pointerdown', (event) => {
    if (editorCollapsed) {
      return;
    }
    isResizing = true;
    startX = event.clientX;
    startWidth = ui.left.getBoundingClientRect().width;
    ui.app.classList.add('is-resizing');
    ui.resizer.setPointerCapture(event.pointerId);
    showPreviewBadge();
  });

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', stopResizing);
  ui.resizer.addEventListener('pointerup', stopResizing);
  ui.resizer.addEventListener('pointercancel', stopResizing);

  const onEditorPointerMove = (event: PointerEvent) => {
    if (!isEditorResizing) return;
    const nextHeight = startHeight + event.clientY - startY;
    setEditorSplitHeight(nextHeight);
  };

  const stopEditorResizing = (event?: PointerEvent) => {
    if (!isEditorResizing) return;
    isEditorResizing = false;
    ui.app.classList.remove('is-resizing');
    if (event) {
      try {
        ui.editorResizer.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore if pointer capture isn't active.
      }
    }
  };

  ui.editorResizer.addEventListener('pointerdown', (event) => {
    if (editorCollapsed) {
      return;
    }
    isEditorResizing = true;
    startY = event.clientY;
    startHeight = ui.htmlPane.getBoundingClientRect().height;
    ui.app.classList.add('is-resizing');
    ui.editorResizer.setPointerCapture(event.pointerId);
  });

  window.addEventListener('pointermove', onEditorPointerMove);
  window.addEventListener('pointerup', stopEditorResizing);
  ui.editorResizer.addEventListener('pointerup', stopEditorResizing);
  ui.editorResizer.addEventListener('pointercancel', stopEditorResizing);

  window.addEventListener(
    'resize',
    debounce(() => {
      applyViewportLayout();
      syncNoticeOffset();
    }, 100)
  );

  setTailwindEnabled(tailwindEnabled);
  setJsEnabled(jsEnabled);
  preview?.flushPendingJsAction();
  applyViewportLayout(true);

  htmlModel.onDidChangeContent(() => {
    preview?.resetCanonicalCache();
    preview?.clearSelectionHighlight();
    sendRenderDebounced?.();
    if (tailwindEnabled) {
      compileTailwindDebounced?.();
    }
    updateUndoRedoState();
    if (suppressSelectionClear === 0) {
      selectedLcId = null;
      notifySelection();
    }
    notifyContentChange();
    syncUnsavedUi();
  });
  cssModel.onDidChangeContent(() => {
    if (!tailwindEnabled) {
      sendRenderDebounced?.();
    }
    if (tailwindEnabled) {
      compileTailwindDebounced?.();
    }
    preview?.clearSelectionHighlight();
    preview?.clearCssSelectionHighlight();
    updateUndoRedoState();
    syncUnsavedUi();
  });

  jsModel.onDidChangeContent(() => {
    updateUndoRedoState();
    syncUnsavedUi();
  });

  // Handle iframe load event
  ui.iframe.addEventListener('load', () => {
    preview?.handleIframeLoad();
  });

  // Handle messages from iframe to parent for DOM selection and initialization
  window.addEventListener('message', (event) => {
    preview?.handleMessage(event);
  });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
});


