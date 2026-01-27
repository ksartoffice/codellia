import {
  createElement,
  Fragment,
  createRoot,
  render,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
  ChevronLeft,
  Download,
  ExternalLink,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Redo2,
  Save,
  Settings,
  Smartphone,
  Tablet,
  Undo2,
} from 'lucide';
import { renderLucideIcon } from './lucide-icons';

type ToolbarState = {
  backUrl: string;
  canUndo: boolean;
  canRedo: boolean;
  editorCollapsed: boolean;
  settingsOpen: boolean;
  tailwindEnabled: boolean;
  statusText: string;
  hasUnsavedChanges: boolean;
  viewPostUrl: string;
  postStatus: string;
};

type ToolbarHandlers = {
  onUndo: () => void;
  onRedo: () => void;
  onToggleEditor: () => void;
  onSave: () => void;
  onExport: () => void;
  onToggleSettings: () => void;
};

export type ToolbarApi = {
  update: (next: Partial<ToolbarState>) => void;
};

const ICONS = {
  back: renderLucideIcon(ChevronLeft, {
    class: 'lucide lucide-chevron-left-icon lucide-chevron-left',
  }),
  wordpress:
    '<?xml version="1.0" encoding="utf-8"?><svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 122.88 122.88" style="enable-background:new 0 0 122.88 122.88" xml:space="preserve"><style type="text/css">.st0{fill:#e6e8ea;}</style><g><path class="st0" d="M61.44,0C27.51,0,0,27.51,0,61.44c0,33.93,27.51,61.44,61.44,61.44c33.93,0,61.44-27.51,61.44-61.44 C122.88,27.51,95.37,0,61.44,0L61.44,0z M106.37,36.88c0.22,1.63,0.34,3.38,0.34,5.26c0,5.19-0.97,11.03-3.89,18.34l-15.64,45.21 c15.22-8.87,25.46-25.37,25.46-44.25C112.64,52.54,110.37,44.17,106.37,36.88L106.37,36.88z M62.34,65.92l-15.36,44.64 c4.59,1.35,9.44,2.09,14.46,2.09c5.96,0,11.68-1.03,17-2.9c-0.14-0.22-0.26-0.45-0.37-0.71L62.34,65.92L62.34,65.92z M96,58.86 c0-6.33-2.27-10.71-4.22-14.12c-2.6-4.22-5.03-7.79-5.03-12.01c0-4.71,3.57-9.09,8.6-9.09c0.23,0,0.44,0.03,0.66,0.04 c-9.11-8.35-21.25-13.44-34.57-13.44c-17.89,0-33.62,9.18-42.78,23.08c1.2,0.04,2.33,0.06,3.3,0.06c5.35,0,13.65-0.65,13.65-0.65 c2.76-0.16,3.08,3.89,0.33,4.22c0,0-2.77,0.32-5.86,0.49l18.64,55.46l11.21-33.6l-7.98-21.86c-2.76-0.16-5.37-0.49-5.37-0.49 c-2.76-0.16-2.44-4.38,0.32-4.22c0,0,8.45,0.65,13.48,0.65c5.35,0,13.65-0.65,13.65-0.65c2.76-0.16,3.08,3.89,0.33,4.22 c0,0-2.78,0.32-5.86,0.49L87,92.47l5.28-16.74C94.63,68.42,96,63.24,96,58.86L96,58.86z M10.24,61.44 c0,20.27,11.78,37.78,28.86,46.08L14.67,40.6C11.83,46.97,10.24,54.01,10.24,61.44L10.24,61.44z M61.44,3.69 c7.8,0,15.36,1.53,22.48,4.54c3.42,1.45,6.72,3.24,9.81,5.32c3.06,2.07,5.94,4.44,8.55,7.05c2.61,2.61,4.99,5.49,7.05,8.55 c2.09,3.09,3.88,6.39,5.32,9.81c3.01,7.12,4.54,14.68,4.54,22.48c0,7.8-1.53,15.36-4.54,22.48c-1.45,3.42-3.24,6.72-5.32,9.81 c-2.07,3.06-4.44,5.94-7.05,8.55c-2.61,2.61-5.49,4.99-8.55,7.05c-3.09,2.09-6.39,3.88-9.81,5.32c-7.12,3.01-14.68,4.54-22.48,4.54 c-7.8,0-15.36-1.53-22.48-4.54c-3.42-1.45-6.72-3.24-9.81-5.32c-3.06-2.07-5.94-4.44-8.55-7.05c-2.61-2.61-4.99-5.49-7.05-8.55 c-2.09-3.09-3.88-6.39-5.32-9.81C5.21,76.8,3.69,69.24,3.69,61.44c0-7.8,1.53-15.36,4.54-22.48c1.45-3.42,3.24-6.72,5.32-9.81 c2.07-3.06,4.44-5.94,7.05-8.55c2.61-2.61,5.49-4.99,8.55-7.05c3.09-2.09,6.39-3.88,9.81-5.32C46.08,5.21,53.64,3.69,61.44,3.69 L61.44,3.69z"/></g></svg>',
  undo: renderLucideIcon(Undo2, {
    class: 'lucide lucide-undo2-icon lucide-undo-2',
  }),
  redo: renderLucideIcon(Redo2, {
    class: 'lucide lucide-redo2-icon lucide-redo-2',
  }),
  save: renderLucideIcon(Save, {
    class: 'lucide lucide-save-icon lucide-save',
  }),
  export: renderLucideIcon(Download, {
    class: 'lucide lucide-download-icon lucide-download',
  }),
  viewPost: renderLucideIcon(ExternalLink, {
    class: 'lucide lucide-external-link-icon lucide-external-link',
  }),
  panelClose: renderLucideIcon(PanelLeftClose, {
    class: 'lucide lucide-panel-left-close-icon lucide-panel-left-close',
  }),
  panelOpen: renderLucideIcon(PanelLeftOpen, {
    class: 'lucide lucide-panel-left-open-icon lucide-panel-left-open',
  }),
  desktop: renderLucideIcon(Monitor, {
    class: 'lucide lucide-monitor-icon lucide-monitor',
  }),
  tablet: renderLucideIcon(Tablet, {
    class: 'lucide lucide-tablet-icon lucide-tablet',
  }),
  mobile: renderLucideIcon(Smartphone, {
    class: 'lucide lucide-smartphone-icon lucide-smartphone',
  }),
  settings: renderLucideIcon(Settings, {
    class: 'lucide lucide-settings-icon lucide-settings',
  }),
};

const TAILWIND_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 54 33"><g clip-path="url(#prefix__clip0)"><path fill="#38bdf8" fill-rule="evenodd" d="M27 0c-7.2 0-11.7 3.6-13.5 10.8 2.7-3.6 5.85-4.95 9.45-4.05 2.054.513 3.522 2.004 5.147 3.653C30.744 13.09 33.808 16.2 40.5 16.2c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.513-3.522-2.004-5.147-3.653C36.756 3.11 33.692 0 27 0zM13.5 16.2C6.3 16.2 1.8 19.8 0 27c2.7-3.6 5.85-4.95 9.45-4.05 2.054.514 3.522 2.004 5.147 3.653C17.244 29.29 20.308 32.4 27 32.4c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.513-3.522-2.004-5.147-3.653C23.256 19.31 20.192 16.2 13.5 16.2z" clip-rule="evenodd"/></g><defs><clipPath id="prefix__clip0"><path fill="#fff" d="M0 0h54v32.4H0z"/></clipPath></defs></svg>';

function IconLabel({ label, svg }: { label: string; svg: string }) {
  return (
    <Fragment>
      <span className="lc-btnIcon" dangerouslySetInnerHTML={{ __html: svg }} />
      <span className="lc-btnLabel">{label}</span>
    </Fragment>
  );
}

function Toolbar({
  backUrl,
  canUndo,
  canRedo,
  editorCollapsed,
  settingsOpen,
  tailwindEnabled,
  statusText,
  hasUnsavedChanges,
  viewPostUrl,
  postStatus,
  onUndo,
  onRedo,
  onToggleEditor,
  onSave,
  onExport,
  onToggleSettings,
}: ToolbarState & ToolbarHandlers) {
  const toggleLabel = editorCollapsed ? __( 'Show', 'wp-livecode' ) : __( 'Hide', 'wp-livecode' );
  const toggleIcon = editorCollapsed ? ICONS.panelOpen : ICONS.panelClose;
  const isPublished = postStatus === 'publish' || postStatus === 'private';
  const viewPostLabel = isPublished ? __( 'View post', 'wp-livecode' ) : __( 'Preview', 'wp-livecode' );
  const settingsLabel = settingsOpen ? __( 'Close', 'wp-livecode' ) : __( 'Settings', 'wp-livecode' );
  const settingsTitle = settingsOpen
    ? __( 'Close settings', 'wp-livecode' )
    : __( 'Settings', 'wp-livecode' );
  const viewportDesktopLabel = __( 'Desktop', 'wp-livecode' );
  const viewportTabletLabel = __( 'Tablet', 'wp-livecode' );
  const viewportMobileLabel = __( 'Mobile', 'wp-livecode' );
  const showUnsaved = statusText === '' && hasUnsavedChanges;
  const statusLabel =
    statusText || (showUnsaved ? __( 'Unsaved changes', 'wp-livecode' ) : '');
  const previewLink = buildPreviewUrl(viewPostUrl);
  const targetUrl = isPublished ? viewPostUrl : previewLink;
  const showViewPost = Boolean(targetUrl);
  return (
    <Fragment>
      <div className="lc-toolbarGroup lc-toolbarLeft">
        <a
          className="lc-btn lc-btn-back"
          href={backUrl}
          aria-label={__( 'Back to WordPress', 'wp-livecode' )}
          title={__( 'Back to WordPress', 'wp-livecode' )}
        >
          <span className="lc-btnIcon" dangerouslySetInnerHTML={{ __html: ICONS.back }} />
          <span
            className="lc-btnIcon lc-btnIcon-wordpress"
            dangerouslySetInnerHTML={{ __html: ICONS.wordpress }}
          />
        </a>
        <button
          className={`lc-btn lc-btn-muted lc-btn-stack${canUndo ? ' is-active' : ''}`}
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title={__( 'Undo', 'wp-livecode' )}
        >
          <IconLabel label={__( 'Undo', 'wp-livecode' )} svg={ICONS.undo} />
        </button>
        <button
          className={`lc-btn lc-btn-muted lc-btn-stack${canRedo ? ' is-active' : ''}`}
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title={__( 'Redo', 'wp-livecode' )}
        >
          <IconLabel label={__( 'Redo', 'wp-livecode' )} svg={ICONS.redo} />
        </button>
        <button className="lc-btn lc-btn-stack" type="button" onClick={onToggleEditor}>
          <IconLabel label={toggleLabel} svg={toggleIcon} />
        </button>
      </div>
      <div className="lc-toolbarGroup lc-toolbarCenter">
        <span className={`lc-status${showUnsaved ? ' is-unsaved' : ''}`}>{statusLabel}</span>
      </div>
      <div className="lc-toolbarGroup lc-toolbarRight">
        <div className="lc-toolbarCluster lc-toolbarCluster-viewports">
          <button
            className="lc-btn lc-btn-icon lc-btn-viewport"
            type="button"
            title={viewportDesktopLabel}
            aria-label={viewportDesktopLabel}
          >
            <span className="lc-btnIcon" dangerouslySetInnerHTML={{ __html: ICONS.desktop }} />
          </button>
          <button
            className="lc-btn lc-btn-icon lc-btn-viewport"
            type="button"
            title={viewportTabletLabel}
            aria-label={viewportTabletLabel}
          >
            <span className="lc-btnIcon" dangerouslySetInnerHTML={{ __html: ICONS.tablet }} />
          </button>
          <button
            className="lc-btn lc-btn-icon lc-btn-viewport"
            type="button"
            title={viewportMobileLabel}
            aria-label={viewportMobileLabel}
          >
            <span className="lc-btnIcon" dangerouslySetInnerHTML={{ __html: ICONS.mobile }} />
          </button>
        </div>
        <div className="lc-toolbarCluster lc-toolbarCluster-main">
          {tailwindEnabled ? (
            <span
              className="lc-tailwindBadge"
              title={__( 'TailwindCSS enabled', 'wp-livecode' )}
              aria-label={__( 'TailwindCSS enabled', 'wp-livecode' )}
              role="img"
              dangerouslySetInnerHTML={{ __html: TAILWIND_ICON }}
            />
          ) : null}
          {showViewPost ? (
            <a
              className="lc-btn lc-btn-stack lc-btn-view"
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={viewPostLabel}
              aria-label={viewPostLabel}
            >
              <IconLabel label={viewPostLabel} svg={ICONS.viewPost} />
            </a>
          ) : null}
          <button
            className={`lc-btn lc-btn-save lc-btn-stack${hasUnsavedChanges ? ' is-unsaved' : ''}`}
            type="button"
            onClick={onSave}
            title={__( 'Save', 'wp-livecode' )}
          >
            <IconLabel label={__( 'Save', 'wp-livecode' )} svg={ICONS.save} />
          </button>
          <button
            className="lc-btn lc-btn-stack"
            type="button"
            onClick={onExport}
            title={__( 'Export', 'wp-livecode' )}
          >
            <IconLabel label={__( 'Export', 'wp-livecode' )} svg={ICONS.export} />
          </button>
          <button
            className={`lc-btn lc-btn-settings lc-btn-stack${settingsOpen ? ' is-active' : ''}`}
            type="button"
            onClick={onToggleSettings}
            title={settingsTitle}
            aria-label={settingsTitle}
            aria-expanded={settingsOpen}
            aria-controls="lc-settings"
          >
            <IconLabel label={settingsLabel} svg={ICONS.settings} />
          </button>
        </div>
      </div>
    </Fragment>
  );
}

function buildPreviewUrl(url: string) {
  if (!url) {
    return '';
  }

  try {
    const previewUrl = new URL(url, window.location.origin);
    previewUrl.searchParams.set('preview', 'true');
    return previewUrl.toString();
  } catch {
    const hashIndex = url.indexOf('#');
    const hasQuery = url.includes('?');
    const suffix = (hasQuery ? '&' : '?') + 'preview=true';
    if (hashIndex === -1) {
      return url + suffix;
    }
    return url.slice(0, hashIndex) + suffix + url.slice(hashIndex);
  }
}

export function mountToolbar(
  container: HTMLElement,
  initialState: ToolbarState,
  handlers: ToolbarHandlers
): ToolbarApi {
  let state: ToolbarState = { ...initialState };
  const root = typeof createRoot === 'function' ? createRoot(container) : null;
  const doRender = () => {
    const node = <Toolbar {...state} {...handlers} />;
    if (root) {
      root.render(node);
    } else {
      render(node, container);
    }
  };

  doRender();

  return {
    update(next: Partial<ToolbarState>) {
      state = { ...state, ...next };
      doRender();
    },
  };
}
