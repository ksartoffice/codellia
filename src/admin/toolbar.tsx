import {
  createElement,
  Fragment,
  createRoot,
  render,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';

type ToolbarState = {
  backUrl: string;
  canUndo: boolean;
  canRedo: boolean;
  editorCollapsed: boolean;
  settingsOpen: boolean;
  tailwindEnabled: boolean;
  statusText: string;
  hasUnsavedChanges: boolean;
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
  back: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-left-icon lucide-chevron-left"><path d="m15 18-6-6 6-6"/></svg>',
  wordpress:
    '<?xml version="1.0" encoding="utf-8"?><svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 122.88 122.88" style="enable-background:new 0 0 122.88 122.88" xml:space="preserve"><style type="text/css">.st0{fill:#e6e8ea;}</style><g><path class="st0" d="M61.44,0C27.51,0,0,27.51,0,61.44c0,33.93,27.51,61.44,61.44,61.44c33.93,0,61.44-27.51,61.44-61.44 C122.88,27.51,95.37,0,61.44,0L61.44,0z M106.37,36.88c0.22,1.63,0.34,3.38,0.34,5.26c0,5.19-0.97,11.03-3.89,18.34l-15.64,45.21 c15.22-8.87,25.46-25.37,25.46-44.25C112.64,52.54,110.37,44.17,106.37,36.88L106.37,36.88z M62.34,65.92l-15.36,44.64 c4.59,1.35,9.44,2.09,14.46,2.09c5.96,0,11.68-1.03,17-2.9c-0.14-0.22-0.26-0.45-0.37-0.71L62.34,65.92L62.34,65.92z M96,58.86 c0-6.33-2.27-10.71-4.22-14.12c-2.6-4.22-5.03-7.79-5.03-12.01c0-4.71,3.57-9.09,8.6-9.09c0.23,0,0.44,0.03,0.66,0.04 c-9.11-8.35-21.25-13.44-34.57-13.44c-17.89,0-33.62,9.18-42.78,23.08c1.2,0.04,2.33,0.06,3.3,0.06c5.35,0,13.65-0.65,13.65-0.65 c2.76-0.16,3.08,3.89,0.33,4.22c0,0-2.77,0.32-5.86,0.49l18.64,55.46l11.21-33.6l-7.98-21.86c-2.76-0.16-5.37-0.49-5.37-0.49 c-2.76-0.16-2.44-4.38,0.32-4.22c0,0,8.45,0.65,13.48,0.65c5.35,0,13.65-0.65,13.65-0.65c2.76-0.16,3.08,3.89,0.33,4.22 c0,0-2.78,0.32-5.86,0.49L87,92.47l5.28-16.74C94.63,68.42,96,63.24,96,58.86L96,58.86z M10.24,61.44 c0,20.27,11.78,37.78,28.86,46.08L14.67,40.6C11.83,46.97,10.24,54.01,10.24,61.44L10.24,61.44z M61.44,3.69 c7.8,0,15.36,1.53,22.48,4.54c3.42,1.45,6.72,3.24,9.81,5.32c3.06,2.07,5.94,4.44,8.55,7.05c2.61,2.61,4.99,5.49,7.05,8.55 c2.09,3.09,3.88,6.39,5.32,9.81c3.01,7.12,4.54,14.68,4.54,22.48c0,7.8-1.53,15.36-4.54,22.48c-1.45,3.42-3.24,6.72-5.32,9.81 c-2.07,3.06-4.44,5.94-7.05,8.55c-2.61,2.61-5.49,4.99-8.55,7.05c-3.09,2.09-6.39,3.88-9.81,5.32c-7.12,3.01-14.68,4.54-22.48,4.54 c-7.8,0-15.36-1.53-22.48-4.54c-3.42-1.45-6.72-3.24-9.81-5.32c-3.06-2.07-5.94-4.44-8.55-7.05c-2.61-2.61-4.99-5.49-7.05-8.55 c-2.09-3.09-3.88-6.39-5.32-9.81C5.21,76.8,3.69,69.24,3.69,61.44c0-7.8,1.53-15.36,4.54-22.48c1.45-3.42,3.24-6.72,5.32-9.81 c2.07-3.06,4.44-5.94,7.05-8.55c2.61-2.61,5.49-4.99,8.55-7.05c3.09-2.09,6.39-3.88,9.81-5.32C46.08,5.21,53.64,3.69,61.44,3.69 L61.44,3.69z"/></g></svg>',
  undo: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-undo2-icon lucide-undo-2"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>',
  redo: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-redo2-icon lucide-redo-2"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"/></svg>',
  save: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-save-icon lucide-save"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>',
  export: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download-icon lucide-download"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>',
  panelClose: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-panel-left-close-icon lucide-panel-left-close"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m16 15-3-3 3-3"/></svg>',
  panelOpen: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-panel-left-open-icon lucide-panel-left-open"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m14 9 3 3-3 3"/></svg>',
  settings: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings-icon lucide-settings"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>',
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
  onUndo,
  onRedo,
  onToggleEditor,
  onSave,
  onExport,
  onToggleSettings,
}: ToolbarState & ToolbarHandlers) {
  const toggleLabel = editorCollapsed ? __( 'Show', 'wp-livecode' ) : __( 'Hide', 'wp-livecode' );
  const toggleIcon = editorCollapsed ? ICONS.panelOpen : ICONS.panelClose;
  const settingsLabel = settingsOpen ? __( 'Close', 'wp-livecode' ) : __( 'Settings', 'wp-livecode' );
  const settingsTitle = settingsOpen
    ? __( 'Close settings', 'wp-livecode' )
    : __( 'Settings', 'wp-livecode' );
  const showUnsaved = statusText === '' && hasUnsavedChanges;
  const statusLabel =
    statusText || (showUnsaved ? __( 'Unsaved changes', 'wp-livecode' ) : '');
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
        {tailwindEnabled ? (
          <span
            className="lc-tailwindBadge"
            title={__( 'TailwindCSS enabled', 'wp-livecode' )}
            aria-label={__( 'TailwindCSS enabled', 'wp-livecode' )}
            role="img"
            dangerouslySetInnerHTML={{ __html: TAILWIND_ICON }}
          />
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
    </Fragment>
  );
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
