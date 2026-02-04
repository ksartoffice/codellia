import {
  createElement,
  Fragment,
  createRoot,
  render,
  useEffect,
  useState,
} from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import {
  ChevronLeft,
  ChevronDown,
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
  X,
} from 'lucide';
import { renderLucideIcon } from './lucide-icons';

export type ViewportMode = 'desktop' | 'tablet' | 'mobile';

type ToolbarState = {
  backUrl: string;
  listUrl: string;
  canUndo: boolean;
  canRedo: boolean;
  editorCollapsed: boolean;
  settingsOpen: boolean;
  tailwindEnabled: boolean;
  viewportMode: ViewportMode;
  hasUnsavedChanges: boolean;
  viewPostUrl: string;
  postStatus: string;
  postTitle: string;
};

type ToolbarHandlers = {
  onUndo: () => void;
  onRedo: () => void;
  onToggleEditor: () => void;
  onSave: () => Promise<{ ok: boolean; error?: string }>;
  onExport: () => void;
  onToggleSettings: () => void;
  onViewportChange: (mode: ViewportMode) => void;
  onUpdateTitle: (title: string) => Promise<{ ok: boolean; error?: string }>;
  onUpdateStatus: (status: 'draft' | 'pending' | 'private' | 'publish') => Promise<{
    ok: boolean;
    error?: string;
  }>;
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
  chevronDown: renderLucideIcon(ChevronDown, {
    class: 'lucide lucide-chevron-down-icon lucide-chevron-down',
  }),
  close: renderLucideIcon(X, {
    class: 'lucide lucide-x-icon lucide-x',
  }),
};

function IconLabel({ label, svg }: { label: string; svg: string }) {
  return (
    <Fragment>
      <span className="cd-btnIcon" dangerouslySetInnerHTML={{ __html: svg }} />
      <span className="cd-btnLabel">{label}</span>
    </Fragment>
  );
}

function Toolbar({
  backUrl,
  listUrl,
  canUndo,
  canRedo,
  editorCollapsed,
  settingsOpen,
  tailwindEnabled,
  hasUnsavedChanges,
  viewPostUrl,
  postStatus,
  postTitle,
  viewportMode,
  onUndo,
  onRedo,
  onToggleEditor,
  onSave,
  onExport,
  onToggleSettings,
  onViewportChange,
  onUpdateTitle,
  onUpdateStatus,
}: ToolbarState & ToolbarHandlers) {
  const [titleModalOpen, setTitleModalOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [titleError, setTitleError] = useState('');
  const [titleSaving, setTitleSaving] = useState(false);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const toggleLabel = editorCollapsed
    ? __( 'Show code', 'codellia' )
    : __( 'Hide code', 'codellia' );
  const toggleIcon = editorCollapsed ? ICONS.panelOpen : ICONS.panelClose;
  const isPublished = postStatus === 'publish' || postStatus === 'private';
  const isDraft = postStatus === 'draft' || postStatus === 'auto-draft';
  const viewPostLabel = isPublished ? __( 'View post', 'codellia' ) : __( 'Preview', 'codellia' );
  const settingsTitle = settingsOpen
    ? __( 'Close settings', 'codellia' )
    : __( 'Settings', 'codellia' );
  const viewportDesktopLabel = __( 'Desktop', 'codellia' );
  const viewportTabletLabel = __( 'Tablet', 'codellia' );
  const viewportMobileLabel = __( 'Mobile', 'codellia' );
  const isViewportDesktop = viewportMode === 'desktop';
  const isViewportTablet = viewportMode === 'tablet';
  const isViewportMobile = viewportMode === 'mobile';
  const previewLink = buildPreviewUrl(viewPostUrl);
  const targetUrl = isPublished ? viewPostUrl : previewLink;
  const showViewPost = Boolean(targetUrl);
  const showListLink = Boolean(listUrl);
  const backLabel = __( 'Back to WordPress', 'codellia' );
  const showBackMenu = Boolean(backUrl) || showListLink;
  const resolvedTitle = postTitle?.trim() || __( 'Untitled', 'codellia' );
  const draftSuffix = isDraft ? __( '(Draft)', 'codellia' ) : '';
  const titleText = draftSuffix ? `${resolvedTitle} ${draftSuffix}` : resolvedTitle;
  const titleTooltip = resolvedTitle;
  const normalizedStatus = postStatus === 'auto-draft' ? 'draft' : postStatus;
  const tailwindBadgeLabel = __( 'Tailwind CSS', 'codellia' );
  const tailwindTooltip = __( 'Editing in Tailwind CSS mode', 'codellia' );
  const listLabel = __( 'Codellia pages', 'codellia' );
  const saveLabel =
    normalizedStatus === 'draft'
      ? __( 'Save draft', 'codellia' )
      : normalizedStatus === 'pending'
        ? __( 'Save for review', 'codellia' )
        : normalizedStatus === 'private'
          ? __( 'Update as private', 'codellia' )
          : __( 'Update', 'codellia' );
  const statusActions = [
    { value: 'publish' as const, label: __( 'Publish', 'codellia' ) },
    { value: 'pending' as const, label: __( 'Move to review', 'codellia' ) },
    { value: 'private' as const, label: __( 'Make private', 'codellia' ) },
    { value: 'draft' as const, label: __( 'Revert to draft', 'codellia' ) },
  ];
  useEffect(() => {
    if (!titleModalOpen) {
      setTitleDraft(resolvedTitle);
      setTitleError('');
    }
  }, [resolvedTitle, titleModalOpen]);

  const openTitleModal = () => {
    setTitleDraft(resolvedTitle);
    setTitleError('');
    setTitleModalOpen(true);
  };

  const closeTitleModal = () => {
    if (titleSaving) {
      return;
    }
    setTitleModalOpen(false);
  };

  const handleTitleSave = async () => {
    if (titleSaving) {
      return;
    }
    setTitleSaving(true);
    setTitleError('');
    const result = await onUpdateTitle(titleDraft.trim());
    if (result.ok) {
      setTitleModalOpen(false);
    } else {
      setTitleError(result.error || __( 'Update failed.', 'codellia' ));
    }
    setTitleSaving(false);
  };

  const handleTitleKeyDown = (event: { key: string; preventDefault: () => void }) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openTitleModal();
    }
  };

  const handleTitleInputKeyDown = (event: { key: string; preventDefault: () => void }) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleTitleSave();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeTitleModal();
    }
  };

  useEffect(() => {
    if (!saveMenuOpen) {
      return;
    }
    const handleDocClick = () => setSaveMenuOpen(false);
    document.addEventListener('click', handleDocClick);
    return () => {
      document.removeEventListener('click', handleDocClick);
    };
  }, [saveMenuOpen]);

  const toggleSaveMenu = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    setSaveMenuOpen((prev) => !prev);
  };

  const handleStatusSelect = async (
    event: { stopPropagation: () => void },
    nextStatus: 'draft' | 'pending' | 'private' | 'publish'
  ) => {
    event.stopPropagation();
    if (statusSaving || nextStatus === normalizedStatus) {
      return;
    }
    setStatusSaving(true);
    if (hasUnsavedChanges) {
      const saveResult = await onSave();
      if (!saveResult.ok) {
        setStatusSaving(false);
        return;
      }
    }
    const result = await onUpdateStatus(nextStatus);
    setStatusSaving(false);
    if (result.ok) {
      setSaveMenuOpen(false);
    }
  };
  return (
    <Fragment>
      <div className="cd-toolbarGroup cd-toolbarLeft">
        <div className="cd-backMenu">
          <a
            className="cd-btn cd-btn-back"
            href={backUrl}
            aria-label={backLabel}
          >
            <span className="cd-btnIcon" dangerouslySetInnerHTML={{ __html: ICONS.back }} />
            <span
              className="cd-btnIcon cd-btnIcon-wordpress"
              dangerouslySetInnerHTML={{ __html: ICONS.wordpress }}
            />
          </a>
          {showBackMenu ? (
            <div className="cd-backMenuDropdown">
              <a className="cd-backMenuItem" href={backUrl}>
                {backLabel}
              </a>
              {showListLink ? (
                <a className="cd-backMenuItem" href={listUrl}>
                  {listLabel}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
        <button
          className={`cd-btn cd-btn-muted cd-btn-icon${canUndo ? ' is-active' : ''}`}
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label={__( 'Undo', 'codellia' )}
          data-tooltip={__( 'Undo', 'codellia' )}
        >
          <span className="cd-btnIcon" dangerouslySetInnerHTML={{ __html: ICONS.undo }} />
        </button>
        <button
          className={`cd-btn cd-btn-muted cd-btn-icon${canRedo ? ' is-active' : ''}`}
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label={__( 'Redo', 'codellia' )}
          data-tooltip={__( 'Redo', 'codellia' )}
        >
          <span className="cd-btnIcon" dangerouslySetInnerHTML={{ __html: ICONS.redo }} />
        </button>
      </div>
      <div className="cd-toolbarGroup cd-toolbarCenter">
        <div
          className="cd-toolbarTitle"
          data-tooltip={titleTooltip}
          aria-label={titleText}
          role="button"
          tabIndex={0}
          onClick={openTitleModal}
          onKeyDown={handleTitleKeyDown}
        >
          <span className="cd-toolbarTitleText">{resolvedTitle}</span>
          {draftSuffix ? (
            <span className="cd-toolbarTitleSuffix">{draftSuffix}</span>
          ) : null}
        </div>
        <div className="cd-toolbarCluster cd-toolbarCluster-viewports">
          <button
            className={`cd-btn cd-btn-icon cd-btn-viewport${isViewportDesktop ? ' is-active' : ''}`}
            type="button"
            aria-label={viewportDesktopLabel}
            aria-pressed={isViewportDesktop}
            data-tooltip={viewportDesktopLabel}
            onClick={() => onViewportChange('desktop')}
          >
            <span className="cd-btnIcon" dangerouslySetInnerHTML={{ __html: ICONS.desktop }} />
          </button>
          <button
            className={`cd-btn cd-btn-icon cd-btn-viewport${isViewportTablet ? ' is-active' : ''}`}
            type="button"
            aria-label={viewportTabletLabel}
            aria-pressed={isViewportTablet}
            data-tooltip={viewportTabletLabel}
            onClick={() => onViewportChange('tablet')}
          >
            <span className="cd-btnIcon" dangerouslySetInnerHTML={{ __html: ICONS.tablet }} />
          </button>
          <button
            className={`cd-btn cd-btn-icon cd-btn-viewport${isViewportMobile ? ' is-active' : ''}`}
            type="button"
            aria-label={viewportMobileLabel}
            aria-pressed={isViewportMobile}
            data-tooltip={viewportMobileLabel}
            onClick={() => onViewportChange('mobile')}
          >
            <span className="cd-btnIcon" dangerouslySetInnerHTML={{ __html: ICONS.mobile }} />
          </button>
        </div>
        <div className="cd-toolbarCluster cd-toolbarCluster-divider">
          <button
            className="cd-btn cd-btn-icon"
            type="button"
            onClick={onToggleEditor}
            aria-label={toggleLabel}
            data-tooltip={toggleLabel}
          >
            <span className="cd-btnIcon" dangerouslySetInnerHTML={{ __html: toggleIcon }} />
          </button>
        </div>
      </div>
      {titleModalOpen ? (
        <div className="cd-modal">
          <div className="cd-modalBackdrop" onClick={closeTitleModal} />
          <div className="cd-modalDialog" role="dialog" aria-modal="true">
            <div className="cd-modalHeader">
              <div className="cd-modalTitle">{__( 'Title', 'codellia' )}</div>
              <button
                className="cd-modalClose"
                type="button"
                onClick={closeTitleModal}
                aria-label={__( 'Close', 'codellia' )}
              >
                <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS.close }} />
              </button>
            </div>
            <div className="cd-modalBody">
              <form
                className="cd-modalForm"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleTitleSave();
                }}
              >
                <div className="cd-formGroup">
                  <label className="cd-formLabel" htmlFor="cd-title-modal-input">
                    {__( 'Title', 'codellia' )}
                  </label>
                  <input
                    id="cd-title-modal-input"
                    className="cd-formInput"
                    type="text"
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    onKeyDown={handleTitleInputKeyDown}
                    autoFocus
                  />
                </div>
                {titleError ? <div className="cd-modalError">{titleError}</div> : null}
                <div className="cd-modalActions">
                  <button
                    className="cd-btn cd-btn-secondary"
                    type="button"
                    onClick={closeTitleModal}
                  >
                    {__( 'Cancel', 'codellia' )}
                  </button>
                  <button className="cd-btn cd-btn-primary" type="submit" disabled={titleSaving}>
                    {titleSaving ? __( 'Saving...', 'codellia' ) : __( 'Save', 'codellia' )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
      <div className="cd-toolbarGroup cd-toolbarRight">
        <div className="cd-toolbarCluster">
          {tailwindEnabled ? (
            <span
              className="cd-tailwindBadge"
              title={tailwindTooltip}
              aria-label={tailwindTooltip}
              data-tooltip={tailwindTooltip}
            >
              {tailwindBadgeLabel}
            </span>
          ) : null}
          {showViewPost ? (
            <a
              className="cd-btn cd-btn-icon cd-btn-view"
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={viewPostLabel}
              data-tooltip={viewPostLabel}
            >
              <span className="cd-btnIcon" dangerouslySetInnerHTML={{ __html: ICONS.viewPost }} />
            </a>
          ) : null}
          <button
            className={`cd-btn cd-btn-settings cd-btn-icon${settingsOpen ? ' is-active' : ''}`}
            type="button"
            onClick={onToggleSettings}
            aria-label={settingsTitle}
            aria-expanded={settingsOpen}
            aria-controls="cd-settings"
            data-tooltip={settingsTitle}
          >
            <span className="cd-btnIcon" dangerouslySetInnerHTML={{ __html: ICONS.settings }} />
          </button>
          <button
            className="cd-btn"
            type="button"
            onClick={onExport}
          >
            <IconLabel label={__( 'Export', 'codellia' )} svg={ICONS.export} />
          </button>
          <div className="cd-splitButton">
            <button
              className={`cd-btn cd-btn-save cd-splitButton-main${hasUnsavedChanges ? ' is-unsaved' : ''}`}
              type="button"
              onClick={onSave}
            >
              <IconLabel label={saveLabel} svg={ICONS.save} />
            </button>
            <button
              className={`cd-btn cd-btn-save cd-btn-icon cd-splitButton-toggle${hasUnsavedChanges ? ' is-unsaved' : ''}`}
              type="button"
              aria-haspopup="menu"
              aria-expanded={saveMenuOpen}
              aria-label={__( 'Save options', 'codellia' )}
              data-tooltip={__( 'Save options', 'codellia' )}
              onClick={toggleSaveMenu}
            >
              <span className="cd-btnIcon" dangerouslySetInnerHTML={{ __html: ICONS.chevronDown }} />
            </button>
            {saveMenuOpen ? (
              <div
                className="cd-splitMenu"
                role="menu"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="cd-splitMenuTitle">
                  {/* translators: %s: current status label. */}
                  {sprintf(
                    __( 'Status: %s', 'codellia' ),
                    normalizedStatus === 'draft'
                      ? __( 'Draft', 'codellia' )
                      : normalizedStatus === 'pending'
                        ? __( 'Pending', 'codellia' )
                        : normalizedStatus === 'private'
                          ? __( 'Private', 'codellia' )
                          : normalizedStatus === 'future'
                            ? __( 'Scheduled', 'codellia' )
                            : __( 'Published', 'codellia' )
                  )}
                </div>
                <div className="cd-splitMenuList">
                  {statusActions
                    .filter((option) => option.value !== normalizedStatus)
                    .map((option) => (
                      <button
                        key={option.value}
                        className="cd-splitMenuItem"
                        type="button"
                        role="menuitem"
                        onClick={(event) => handleStatusSelect(event, option.value)}
                        disabled={statusSaving}
                      >
                        <span className="cd-splitMenuLabel">{option.label}</span>
                      </button>
                    ))}
                </div>
              </div>
            ) : null}
          </div>
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

