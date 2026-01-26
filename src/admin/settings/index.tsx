import {
  createElement,
  Fragment,
  createPortal,
  createRoot,
  render,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { DesignSettingsPanel } from './design-settings';
import { ElementsSettingsPanel, type ElementsSettingsApi } from './elements-settings';

type SettingsOption = {
  value: string;
  label: string;
};

type SettingsAuthor = {
  id: number;
  name: string;
};

type SettingsCategory = {
  id: number;
  name: string;
};

export type SettingsData = {
  title: string;
  status: string;
  visibility: 'public' | 'private' | 'password';
  password?: string;
  dateLocal?: string;
  dateLabel?: string;
  slug: string;
  viewUrl?: string;
  author: number;
  commentStatus: 'open' | 'closed';
  pingStatus: 'open' | 'closed';
  template: string;
  format: string;
  categories: number[];
  tags: string[];
  featuredImageId: number;
  featuredImageUrl?: string;
  featuredImageAlt?: string;
  statusOptions: SettingsOption[];
  authors: SettingsAuthor[];
  templates: SettingsOption[];
  formats: SettingsOption[];
  categoriesList: SettingsCategory[];
  canPublish: boolean;
  canTrash: boolean;
  jsEnabled: boolean;
  shadowDomEnabled: boolean;
  shortcodeEnabled: boolean;
  singlePageEnabled: boolean;
  liveHighlightEnabled: boolean;
  canEditJs: boolean;
  externalScripts: string[];
  externalStyles: string[];
};

type SettingsConfig = {
  container: HTMLElement;
  header?: HTMLElement;
  data: SettingsData;
  restUrl: string;
  postId: number;
  backUrl?: string;
  apiFetch?: (args: any) => Promise<any>;
  onJsToggle?: (enabled: boolean) => void;
  onShadowDomToggle?: (enabled: boolean) => void;
  onShortcodeToggle?: (enabled: boolean) => void;
  onLiveHighlightToggle?: (enabled: boolean) => void;
  onExternalScriptsChange?: (scripts: string[]) => void;
  onExternalStylesChange?: (styles: string[]) => void;
  onTabChange?: (tab: SettingsTab) => void;
  onSettingsUpdate?: (settings: SettingsData) => void;
  onClosePanel?: () => void;
  elementsApi?: ElementsSettingsApi;
};

type UpdateResponse = {
  ok?: boolean;
  error?: string;
  settings?: SettingsData;
  redirectUrl?: string;
};

type UpdateSettings = (updates: Record<string, any>) => Promise<UpdateResponse>;

type ModalProps = {
  title: string;
  onClose: () => void;
  error?: string;
  children: JSX.Element | JSX.Element[];
};

type ActiveModal =
  | 'status'
  | 'featured'
  | null;

type SettingsTab = 'post' | 'design' | 'elements';

type StatusPresetValue = 'draft' | 'pending' | 'private' | 'publish';

type StatusPreset = {
  value: StatusPresetValue;
  status: string;
  visibility: SettingsData['visibility'];
};

const STATUS_PRESETS: StatusPreset[] = [
  { value: 'draft', status: 'draft', visibility: 'public' },
  { value: 'pending', status: 'pending', visibility: 'public' },
  { value: 'private', status: 'private', visibility: 'private' },
  { value: 'publish', status: 'publish', visibility: 'public' },
];

function getErrorMessage(error: unknown, fallback = __( 'Update failed.', 'wp-livecode' )) {
  if (typeof error === 'string' && error.trim()) return error;
  if (error instanceof Error) {
    if (error.message && error.message !== '[object Object]') return error.message;
    const cause = (error as { cause?: unknown }).cause;
    if (cause) return getErrorMessage(cause, fallback);
  }
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
    const errorField = (error as { error?: unknown }).error;
    if (typeof errorField === 'string' && errorField.trim()) return errorField;
    const nestedMessage = (errorField as { message?: unknown })?.message;
    if (typeof nestedMessage === 'string' && nestedMessage.trim()) return nestedMessage;
  }
  return fallback;
}

function getOptionLabel(options: SettingsOption[], value: string) {
  return options.find((option) => option.value === value)?.label || value || '-';
}

function resolveStatusPresetValue(
  status: string,
  visibility: SettingsData['visibility']
): StatusPresetValue {
  if (status === 'private' || visibility === 'private') return 'private';
  if (status === 'pending') return 'pending';
  if (status === 'draft' || status === 'auto-draft') return 'draft';
  if (status === 'publish' || status === 'future') return 'publish';
  return 'draft';
}

function getStatusLabel(settings: SettingsData) {
  const presetValue = resolveStatusPresetValue(settings.status, settings.visibility);
  const preset = STATUS_PRESETS.find((option) => option.value === presetValue);
  if (preset) {
    return getOptionLabel(settings.statusOptions, preset.value);
  }
  return getOptionLabel(settings.statusOptions, settings.status);
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="lc-settingsSection">
      <div className="lc-settingsSectionTitle">{title}</div>
      {children}
    </div>
  );
}

function SettingsItem({
  label,
  value,
  onClick,
}: {
  label: string;
  value: JSX.Element | string;
  onClick?: () => void;
}) {
  const handleKeyDown = (event: { key: string; preventDefault: () => void }) => {
    if (!onClick) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`lc-settingsItem${onClick ? ' is-clickable' : ''}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="lc-settingsItemLabel">{label}</div>
      <div className="lc-settingsItemValue">{value}</div>
    </div>
  );
}

function Modal({ title, onClose, error, children }: ModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="lc-modal">
      <div className="lc-modalBackdrop" onClick={onClose} />
      <div className="lc-modalDialog" role="dialog" aria-modal="true">
        <div className="lc-modalHeader">
          <div className="lc-modalTitle">{title}</div>
          <button
            className="lc-modalClose"
            type="button"
            onClick={onClose}
            aria-label={__( 'Close', 'wp-livecode' )}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-x-icon lucide-x"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div className="lc-modalBody">{children}</div>
        <div className="lc-modalError">{error || ''}</div>
      </div>
    </div>,
    document.body
  );
}

function StatusModal({
  settings,
  onClose,
  updateSettings,
}: {
  settings: SettingsData;
  onClose: () => void;
  updateSettings: UpdateSettings;
}) {
  const [presetValue, setPresetValue] = useState<StatusPresetValue>(
    resolveStatusPresetValue(settings.status, settings.visibility)
  );
  const [error, setError] = useState('');

  const onSubmit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setError('');
    try {
      const preset = STATUS_PRESETS.find((option) => option.value === presetValue) || STATUS_PRESETS[0];
      await updateSettings({ status: preset.status, visibility: preset.visibility });
      onClose();
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  return (
    <Modal title={__( 'Status', 'wp-livecode' )} onClose={onClose} error={error}>
      <form className="lc-modalForm" onSubmit={onSubmit}>
        <div className="lc-formGroup">
          <div className="lc-formLabel">{__( 'Status', 'wp-livecode' )}</div>
          {STATUS_PRESETS.map((option) => (
            <label className="lc-radioRow" key={option.value}>
              <input
                type="radio"
                name="lc-status"
                value={option.value}
                checked={presetValue === option.value}
                disabled={option.value === 'publish' && !settings.canPublish}
                onChange={() => setPresetValue(option.value)}
              />
              <span className="lc-radioText">
                {getOptionLabel(settings.statusOptions, option.value)}
              </span>
            </label>
          ))}
        </div>
        <div className="lc-modalActions">
          <button className="lc-btn lc-btn-secondary" type="button" onClick={onClose}>
            {__( 'Cancel', 'wp-livecode' )}
          </button>
          <button className="lc-btn lc-btn-primary" type="submit">
            {__( 'Save', 'wp-livecode' )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FeaturedModal({
  settings,
  onClose,
  updateSettings,
}: {
  settings: SettingsData;
  onClose: () => void;
  updateSettings: UpdateSettings;
}) {
  const [imageId, setImageId] = useState(
    settings.featuredImageId ? String(settings.featuredImageId) : ''
  );
  const [imageUrl, setImageUrl] = useState(settings.featuredImageUrl || '');
  const [imageAlt, setImageAlt] = useState(settings.featuredImageAlt || '');
  const [error, setError] = useState('');
  const media = (window as any).wp?.media;

  const handleSelect = () => {
    if (!media) return;
    const frame = media({
      title: __( 'Select featured image', 'wp-livecode' ),
      button: { text: __( 'Select', 'wp-livecode' ) },
      multiple: false,
    });
    frame.on('select', () => {
      const attachment = frame.state().get('selection').first()?.toJSON();
      if (!attachment) return;
      setImageId(String(attachment.id || ''));
      setImageUrl(attachment.sizes?.medium?.url || attachment.url || '');
      setImageAlt(attachment.alt || '');
    });
    frame.open();
  };

  const onSubmit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setError('');
    try {
      const featuredImageId = Number(imageId || 0);
      await updateSettings({ featuredImageId });
      onClose();
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  const handleRemove = async () => {
    setError('');
    try {
      await updateSettings({ featuredImageId: 0 });
      onClose();
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  return (
    <Modal title={__( 'Featured image', 'wp-livecode' )} onClose={onClose} error={error}>
      <form className="lc-modalForm" onSubmit={onSubmit}>
        <div className="lc-featurePreview">
          {imageUrl ? (
            <img src={imageUrl} alt={imageAlt} />
          ) : (
            __( 'No image set.', 'wp-livecode' )
          )}
        </div>
        <div className="lc-formGroup">
          <div className="lc-formLabel">{__( 'Image', 'wp-livecode' )}</div>
          <button className="lc-btn" type="button" onClick={handleSelect} disabled={!media}>
            {__( 'Select from media library', 'wp-livecode' )}
          </button>
          <input
            type="number"
            className="lc-formInput"
            placeholder={__( 'Attachment ID', 'wp-livecode' )}
            value={imageId}
            onChange={(event) => setImageId(event.target.value)}
          />
        </div>
        <div className="lc-modalActions">
          <button className="lc-btn lc-btn-secondary" type="button" onClick={onClose}>
            {__( 'Cancel', 'wp-livecode' )}
          </button>
          <button
            className="lc-btn lc-btn-danger"
            type="button"
            onClick={handleRemove}
            disabled={!settings.featuredImageId}
          >
            {__( 'Remove', 'wp-livecode' )}
          </button>
          <button className="lc-btn lc-btn-primary" type="submit">
            {__( 'Save', 'wp-livecode' )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SettingsSidebar({
  data,
  restUrl,
  postId,
  backUrl,
  apiFetch,
  header,
  onJsToggle,
  onShadowDomToggle,
  onShortcodeToggle,
  onLiveHighlightToggle,
  onExternalScriptsChange,
  onExternalStylesChange,
  onTabChange,
  onSettingsUpdate,
  onClosePanel,
  elementsApi,
}: SettingsConfig) {
  const [settings, setSettings] = useState<SettingsData>({ ...data });
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('post');
  const resolveSinglePageEnabled = (value?: boolean) =>
    value === undefined ? true : Boolean(value);
  const resolveLiveHighlightEnabled = (value?: boolean) =>
    value === undefined ? true : Boolean(value);
  const [jsEnabled, setJsEnabled] = useState(Boolean(data.jsEnabled));
  const [shadowDomEnabled, setShadowDomEnabled] = useState(Boolean(data.shadowDomEnabled));
  const [shortcodeEnabled, setShortcodeEnabled] = useState(Boolean(data.shortcodeEnabled));
  const [singlePageEnabled, setSinglePageEnabled] = useState(
    resolveSinglePageEnabled(data.singlePageEnabled)
  );
  const [liveHighlightEnabled, setLiveHighlightEnabled] = useState(
    resolveLiveHighlightEnabled(data.liveHighlightEnabled)
  );
  const [designError, setDesignError] = useState('');
  const [externalScripts, setExternalScripts] = useState<string[]>(data.externalScripts || []);
  const [externalScriptsError, setExternalScriptsError] = useState('');
  const [externalStyles, setExternalStyles] = useState<string[]>(data.externalStyles || []);
  const [externalStylesError, setExternalStylesError] = useState('');
  const [titleDraft, setTitleDraft] = useState(settings.title || '');
  const [titleError, setTitleError] = useState('');

  useEffect(() => {
    setTitleDraft(settings.title || '');
  }, [settings.title]);

  useEffect(() => {
    setJsEnabled(Boolean(settings.jsEnabled));
  }, [settings.jsEnabled]);

  useEffect(() => {
    setShadowDomEnabled(Boolean(settings.shadowDomEnabled));
  }, [settings.shadowDomEnabled]);

  useEffect(() => {
    setShortcodeEnabled(Boolean(settings.shortcodeEnabled));
  }, [settings.shortcodeEnabled]);

  useEffect(() => {
    setSinglePageEnabled(resolveSinglePageEnabled(settings.singlePageEnabled));
  }, [settings.singlePageEnabled]);

  useEffect(() => {
    setLiveHighlightEnabled(resolveLiveHighlightEnabled(settings.liveHighlightEnabled));
  }, [settings.liveHighlightEnabled]);

  useEffect(() => {
    onTabChange?.(activeTab);
  }, [activeTab, onTabChange]);

  useEffect(() => {
    const handleOpenElementsTab = () => {
      setActiveTab('elements');
      setActiveModal(null);
    };
    window.addEventListener('lc-open-elements-tab', handleOpenElementsTab);
    return () => {
      window.removeEventListener('lc-open-elements-tab', handleOpenElementsTab);
    };
  }, []);

  useEffect(() => {
    setExternalScripts(settings.externalScripts || []);
    onExternalScriptsChange?.(settings.externalScripts || []);
  }, [settings.externalScripts, onExternalScriptsChange]);

  useEffect(() => {
    setExternalStyles(settings.externalStyles || []);
    onExternalStylesChange?.(settings.externalStyles || []);
  }, [settings.externalStyles, onExternalStylesChange]);

  useEffect(() => {
    onJsToggle?.(jsEnabled);
  }, [jsEnabled, onJsToggle]);

  useEffect(() => {
    onShadowDomToggle?.(shadowDomEnabled);
  }, [shadowDomEnabled, onShadowDomToggle]);

  useEffect(() => {
    onShortcodeToggle?.(shortcodeEnabled);
  }, [shortcodeEnabled, onShortcodeToggle]);

  useEffect(() => {
    onLiveHighlightToggle?.(liveHighlightEnabled);
  }, [liveHighlightEnabled, onLiveHighlightToggle]);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    setActiveModal(null);
  };

  const updateSettings = useCallback(
    async (updates: Record<string, any>) => {
      const response = await apiFetch?.({
        url: restUrl,
        method: 'POST',
        data: {
          post_id: postId,
          updates,
        },
      });

      if (!response?.ok) {
        throw new Error(getErrorMessage(response?.error, __( 'Update failed.', 'wp-livecode' )));
      }

      if (response?.settings) {
        const nextSettings = response.settings as SettingsData;
        setSettings(nextSettings);
        onSettingsUpdate?.(nextSettings);
      }

      return response;
    },
    [apiFetch, restUrl, postId, onSettingsUpdate]
  );

  const canEditJs = Boolean(settings.canEditJs);

  const normalizeList = (list: string[]) =>
    list
      .map((entry) => entry.trim())
      .filter(Boolean);

  const isSameList = (left: string[], right: string[]) =>
    left.length === right.length && left.every((value, index) => value === right[index]);

  const handleJsToggle = async (enabled: boolean) => {
    if (!canEditJs) {
      return;
    }
    setDesignError('');
    setJsEnabled(enabled);
    try {
      await updateSettings({ jsEnabled: enabled });
    } catch (err: any) {
      setDesignError(err?.message || String(err));
      setJsEnabled(Boolean(settings.jsEnabled));
    }
  };

  const handleShadowDomToggle = async (enabled: boolean) => {
    if (!canEditJs) {
      return;
    }
    setDesignError('');
    setShadowDomEnabled(enabled);
    try {
      await updateSettings({ shadowDomEnabled: enabled });
    } catch (err: any) {
      setDesignError(err?.message || String(err));
      setShadowDomEnabled(Boolean(settings.shadowDomEnabled));
    }
  };

  const handleShortcodeToggle = async (enabled: boolean) => {
    if (!canEditJs) {
      return;
    }
    setDesignError('');
    setShortcodeEnabled(enabled);
    try {
      await updateSettings({ shortcodeEnabled: enabled });
    } catch (err: any) {
      setDesignError(err?.message || String(err));
      setShortcodeEnabled(Boolean(settings.shortcodeEnabled));
    }
  };

  const handleSinglePageToggle = async (enabled: boolean) => {
    if (!canEditJs) {
      return;
    }
    setDesignError('');
    setSinglePageEnabled(enabled);
    try {
      await updateSettings({ singlePageEnabled: enabled });
    } catch (err: any) {
      setDesignError(err?.message || String(err));
      setSinglePageEnabled(resolveSinglePageEnabled(settings.singlePageEnabled));
    }
  };

  const handleLiveHighlightToggle = async (enabled: boolean) => {
    setDesignError('');
    setLiveHighlightEnabled(enabled);
    try {
      await updateSettings({ liveHighlightEnabled: enabled });
    } catch (err: any) {
      setDesignError(err?.message || String(err));
      setLiveHighlightEnabled(resolveLiveHighlightEnabled(settings.liveHighlightEnabled));
    }
  };

  const handleExternalScriptsChange = (next: string[]) => {
    setExternalScripts(next);
  };

  const handleExternalScriptsCommit = async (next: string[]) => {
    if (!canEditJs) {
      return;
    }
    const normalizedNext = normalizeList(next);
    const normalizedCurrent = normalizeList(settings.externalScripts || []);
    if (isSameList(normalizedNext, normalizedCurrent)) {
      setExternalScripts(normalizedNext);
      return;
    }
    setExternalScriptsError('');
    setExternalScripts(next);
    try {
      await updateSettings({ externalScripts: normalizedNext });
    } catch (err: any) {
      setExternalScriptsError(getErrorMessage(err, __( 'Update failed.', 'wp-livecode' )));
      setExternalScripts(settings.externalScripts || []);
    }
  };

  const handleExternalStylesChange = (next: string[]) => {
    setExternalStyles(next);
  };

  const handleExternalStylesCommit = async (next: string[]) => {
    if (!canEditJs) {
      return;
    }
    const normalizedNext = normalizeList(next);
    const normalizedCurrent = normalizeList(settings.externalStyles || []);
    if (isSameList(normalizedNext, normalizedCurrent)) {
      setExternalStyles(normalizedNext);
      return;
    }
    setExternalStylesError('');
    setExternalStyles(next);
    try {
      await updateSettings({ externalStyles: normalizedNext });
    } catch (err: any) {
      setExternalStylesError(getErrorMessage(err, __( 'Update failed.', 'wp-livecode' )));
      setExternalStyles(settings.externalStyles || []);
    }
  };

  const handleTitleSave = async () => {
    setTitleError('');
    try {
      await updateSettings({ title: titleDraft });
    } catch (err: any) {
      setTitleError(err?.message || String(err));
    }
  };

  const handleTrash = async () => {
    if (!window.confirm(__( 'Move this post to the trash?', 'wp-livecode' ))) {
      return;
    }
    try {
      const response = await updateSettings({ status: 'trash' });
      if (response?.redirectUrl) {
        window.location.href = response.redirectUrl;
      } else if (backUrl) {
        window.location.href = backUrl;
      }
    } catch (err: any) {
      window.alert(err?.message || String(err));
    }
  };

  const statusText = useMemo(
    () => getStatusLabel(settings),
    [settings.status, settings.visibility, settings.statusOptions]
  );

  const tabs = (
    <div className="lc-settingsTabsRow">
      <div
        className="lc-settingsTabs"
        role="tablist"
        aria-label={__( 'Settings tabs', 'wp-livecode' )}
      >
        <button
          className={`lc-settingsTab${activeTab === 'post' ? ' is-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activeTab === 'post'}
          onClick={() => handleTabChange('post')}
        >
          {__( 'Post', 'wp-livecode' )}
        </button>
        <button
          className={`lc-settingsTab${activeTab === 'design' ? ' is-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activeTab === 'design'}
          onClick={() => handleTabChange('design')}
        >
          {__( 'Design', 'wp-livecode' )}
        </button>
        <button
          className={`lc-settingsTab${activeTab === 'elements' ? ' is-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activeTab === 'elements'}
          onClick={() => handleTabChange('elements')}
        >
          {__( 'Elements', 'wp-livecode' )}
        </button>
      </div>
      <button
        className="lc-settingsClose"
        type="button"
        aria-label={__( 'Close settings panel', 'wp-livecode' )}
        onClick={() => onClosePanel?.()}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-x-icon lucide-x"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  );

  const tabsNode = header ? createPortal(tabs, header) : tabs;

  return (
    <Fragment>
      {tabsNode}

      {activeTab === 'post' ? (
        <Fragment>
          <div className="lc-settingsTitle">
            <div className="lc-settingsTitleLabel">{__( 'Title', 'wp-livecode' )}</div>
            <div className="lc-settingsTitleRow">
              <input
                type="text"
                className="lc-formInput lc-settingsTitleInput"
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleTitleSave();
                  }
                }}
              />
              <button
                className="lc-btn lc-btn-primary lc-settingsTitleSave"
                type="button"
                onClick={handleTitleSave}
                disabled={titleDraft === settings.title}
              >
                {__( 'Save', 'wp-livecode' )}
              </button>
            </div>
            <div className="lc-settingsTitleError">{titleError}</div>
          </div>

          <SettingsSection title={__( 'Post', 'wp-livecode' )}>
            <SettingsItem
              label={__( 'Status', 'wp-livecode' )}
              value={statusText}
              onClick={() => setActiveModal('status')}
            />
            {settings.canTrash && (
              <button className="lc-btn lc-btn-danger lc-settingsTrash" type="button" onClick={handleTrash}>
                {__( 'Move to trash', 'wp-livecode' )}
              </button>
            )}
          </SettingsSection>

          <SettingsSection title={__( 'Featured image', 'wp-livecode' )}>
            <SettingsItem
              label={__( 'Featured image', 'wp-livecode' )}
              value={
                settings.featuredImageUrl ? (
                  <img
                    src={settings.featuredImageUrl}
                    alt={settings.featuredImageAlt || ''}
                    className="lc-featureThumb"
                  />
                ) : (
                  __( 'Set', 'wp-livecode' )
                )
              }
              onClick={() => setActiveModal('featured')}
            />
          </SettingsSection>

        </Fragment>
      ) : null}

      {activeTab === 'design' ? (
        <DesignSettingsPanel
          postId={postId}
          jsEnabled={jsEnabled}
          onToggleJs={handleJsToggle}
          shadowDomEnabled={shadowDomEnabled}
          onToggleShadowDom={handleShadowDomToggle}
          shortcodeEnabled={shortcodeEnabled}
          onToggleShortcode={handleShortcodeToggle}
          singlePageEnabled={singlePageEnabled}
          onToggleSinglePage={handleSinglePageToggle}
          liveHighlightEnabled={liveHighlightEnabled}
          onToggleLiveHighlight={handleLiveHighlightToggle}
          externalScripts={externalScripts}
          onChangeExternalScripts={handleExternalScriptsChange}
          onCommitExternalScripts={handleExternalScriptsCommit}
          externalStyles={externalStyles}
          onChangeExternalStyles={handleExternalStylesChange}
          onCommitExternalStyles={handleExternalStylesCommit}
          disabled={!canEditJs}
          error={designError}
          externalScriptsError={externalScriptsError}
          externalStylesError={externalStylesError}
        />
      ) : null}

      {activeTab === 'elements' ? <ElementsSettingsPanel api={elementsApi} /> : null}

      {activeTab === 'post' && activeModal === 'status' ? (
        <StatusModal settings={settings} onClose={() => setActiveModal(null)} updateSettings={updateSettings} />
      ) : null}
      {activeTab === 'post' && activeModal === 'featured' ? (
        <FeaturedModal settings={settings} onClose={() => setActiveModal(null)} updateSettings={updateSettings} />
      ) : null}
    </Fragment>
  );
}

export function initSettings(config: SettingsConfig) {
  const { container, apiFetch } = config;

  if (!apiFetch) {
    container.textContent = __( 'Settings unavailable.', 'wp-livecode' );
    return;
  }

  const root = typeof createRoot === 'function' ? createRoot(container) : null;
  const node = <SettingsSidebar {...config} />;
  if (root) {
    root.render(node);
  } else {
    render(node, container);
  }
}
