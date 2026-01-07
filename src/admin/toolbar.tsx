import {
  createElement,
  Fragment,
  createRoot,
  render,
} from '@wordpress/element';

type ToolbarState = {
  backUrl: string;
  canUndo: boolean;
  canRedo: boolean;
  editorCollapsed: boolean;
  settingsOpen: boolean;
  tailwindEnabled: boolean;
  statusText: string;
};

type ToolbarHandlers = {
  onUndo: () => void;
  onRedo: () => void;
  onToggleEditor: () => void;
  onSave: () => void;
  onToggleSettings: () => void;
};

export type ToolbarApi = {
  update: (next: Partial<ToolbarState>) => void;
};

const ICONS = {
  back: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-left-icon lucide-chevron-left"><path d="m15 18-6-6 6-6"/></svg>',
  undo: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-undo2-icon lucide-undo-2"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>',
  redo: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-redo2-icon lucide-redo-2"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"/></svg>',
  save: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-save-icon lucide-save"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>',
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
  onUndo,
  onRedo,
  onToggleEditor,
  onSave,
  onToggleSettings,
}: ToolbarState & ToolbarHandlers) {
  const toggleLabel = editorCollapsed ? 'Show' : 'Hide';
  const toggleIcon = editorCollapsed ? ICONS.panelOpen : ICONS.panelClose;
  return (
    <Fragment>
      <div className="lc-toolbarGroup lc-toolbarLeft">
        <a className="lc-btn lc-btn-back" href={backUrl}>
          <IconLabel label="Back to WordPress" svg={ICONS.back} />
        </a>
        <button
          className={`lc-btn lc-btn-muted lc-btn-stack${canUndo ? ' is-active' : ''}`}
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-disabled={!canUndo}
        >
          <IconLabel label="Undo" svg={ICONS.undo} />
        </button>
        <button
          className={`lc-btn lc-btn-muted lc-btn-stack${canRedo ? ' is-active' : ''}`}
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          aria-disabled={!canRedo}
        >
          <IconLabel label="Redo" svg={ICONS.redo} />
        </button>
        <button className="lc-btn lc-btn-stack" type="button" onClick={onToggleEditor}>
          <IconLabel label={toggleLabel} svg={toggleIcon} />
        </button>
      </div>
      <div className="lc-toolbarGroup lc-toolbarCenter">
        <span className="lc-status">{statusText}</span>
      </div>
      <div className="lc-toolbarGroup lc-toolbarRight">
        {tailwindEnabled ? (
          <span
            className="lc-tailwindBadge"
            title="TailwindCSS enabled"
            aria-label="TailwindCSS enabled"
            role="img"
            dangerouslySetInnerHTML={{ __html: TAILWIND_ICON }}
          />
        ) : null}
        <button className="lc-btn lc-btn-primary lc-btn-stack" type="button" onClick={onSave}>
          <IconLabel label="Save" svg={ICONS.save} />
        </button>
        <button
          className={`lc-btn lc-btn-settings lc-btn-stack${settingsOpen ? ' is-active' : ''}`}
          type="button"
          onClick={onToggleSettings}
          aria-expanded={settingsOpen}
          aria-controls="lc-settings"
        >
          <IconLabel label="Settings" svg={ICONS.settings} />
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
