import {
  createElement,
  Fragment,
  createPortal,
  createRoot,
  render,
  useCallback,
  useEffect,
  useState,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { X } from 'lucide';
import { renderLucideIcon } from '../lucide-icons';
import { SettingsPanel } from './settings-panel';
import { ElementPanel, type ElementPanelApi } from './element-panel';

type SettingsOption = {
  value: string;
  label: string;
};

type SettingsAuthor = {
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
  featuredImageId: number;
  featuredImageUrl?: string;
  featuredImageAlt?: string;
  statusOptions: SettingsOption[];
  authors: SettingsAuthor[];
  templates: SettingsOption[];
  formats: SettingsOption[];
  canPublish: boolean;
  canTrash: boolean;
  layout?: 'default' | 'standalone' | 'frame' | 'theme';
  defaultLayout?: 'standalone' | 'frame' | 'theme';
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
  onShadowDomToggle?: (enabled: boolean) => void;
  onShortcodeToggle?: (enabled: boolean) => void;
  onLiveHighlightToggle?: (enabled: boolean) => void;
  onExternalScriptsChange?: (scripts: string[]) => void;
  onExternalStylesChange?: (styles: string[]) => void;
  onTabChange?: (tab: SettingsTab) => void;
  onSettingsUpdate?: (settings: SettingsData) => void;
  onClosePanel?: () => void;
  elementsApi?: ElementPanelApi;
};

type UpdateResponse = {
  ok?: boolean;
  error?: string;
  settings?: SettingsData;
  redirectUrl?: string;
};

type UpdateSettings = (updates: Record<string, any>) => Promise<UpdateResponse>;

type SettingsTab = 'settings' | 'elements';

const CLOSE_ICON = renderLucideIcon(X, {
  class: 'lucide lucide-x-icon lucide-x',
});

function getErrorMessage(error: unknown, fallback = __( 'Update failed.', 'codellia' )) {
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



function SettingsSidebar({
  data,
  restUrl,
  postId,
  backUrl,
  apiFetch,
  header,
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
  const [activeTab, setActiveTab] = useState<SettingsTab>('settings');
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
  const resolveSinglePageEnabled = (value?: boolean) =>
    value === undefined ? true : Boolean(value);
  const resolveLiveHighlightEnabled = (value?: boolean) =>
    value === undefined ? true : Boolean(value);
  const [layout, setLayout] = useState(resolveLayout(data.layout));
  const [defaultLayout, setDefaultLayout] = useState(resolveDefaultLayout(data.defaultLayout));
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

  useEffect(() => {
    setShadowDomEnabled(Boolean(settings.shadowDomEnabled));
  }, [settings.shadowDomEnabled]);

  useEffect(() => {
    setLayout(resolveLayout(settings.layout));
  }, [settings.layout]);

  useEffect(() => {
    setDefaultLayout(resolveDefaultLayout(settings.defaultLayout));
  }, [settings.defaultLayout]);

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
    };
    window.addEventListener('cd-open-elements-tab', handleOpenElementsTab);
    return () => {
      window.removeEventListener('cd-open-elements-tab', handleOpenElementsTab);
    };
  }, []);

  useEffect(() => {
    const handleSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail || !detail.settings) {
        return;
      }
      setSettings((prev) => ({ ...prev, ...detail.settings }));
    };
    window.addEventListener('cd-settings-updated', handleSettingsUpdated as EventListener);
    return () => {
      window.removeEventListener('cd-settings-updated', handleSettingsUpdated as EventListener);
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
        throw new Error(getErrorMessage(response?.error, __( 'Update failed.', 'codellia' )));
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

  const handleLayoutChange = async (
    next: 'default' | 'standalone' | 'frame' | 'theme'
  ) => {
    if (!canEditJs) {
      return;
    }
    setDesignError('');
    setLayout(next);
    try {
      await updateSettings({ layout: next });
    } catch (err: any) {
      setDesignError(err?.message || String(err));
      setLayout(resolveLayout(settings.layout));
    }
  };

  const handleShortcodeToggle = async (enabled: boolean) => {
    if (!canEditJs) {
      return;
    }
    setDesignError('');
    setShortcodeEnabled(enabled);
    const shouldEnableSinglePage = !enabled && !singlePageEnabled;
    if (shouldEnableSinglePage) {
      setSinglePageEnabled(true);
    }
    try {
      if (shouldEnableSinglePage) {
        await updateSettings({ shortcodeEnabled: enabled, singlePageEnabled: true });
      } else {
        await updateSettings({ shortcodeEnabled: enabled });
      }
    } catch (err: any) {
      setDesignError(err?.message || String(err));
      setShortcodeEnabled(Boolean(settings.shortcodeEnabled));
      if (shouldEnableSinglePage) {
        setSinglePageEnabled(resolveSinglePageEnabled(settings.singlePageEnabled));
      }
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
      setExternalScriptsError(getErrorMessage(err, __( 'Update failed.', 'codellia' )));
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
      setExternalStylesError(getErrorMessage(err, __( 'Update failed.', 'codellia' )));
      setExternalStyles(settings.externalStyles || []);
    }
  };

  const tabs = (
    <div className="cd-settingsTabsRow">
      <div
        className="cd-settingsTabs"
        role="tablist"
        aria-label={__( 'Settings tabs', 'codellia' )}
      >
        <button
          className={`cd-settingsTab${activeTab === 'settings' ? ' is-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activeTab === 'settings'}
          onClick={() => handleTabChange('settings')}
        >
          {__( 'Settings', 'codellia' )}
        </button>
        <button
          className={`cd-settingsTab${activeTab === 'elements' ? ' is-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activeTab === 'elements'}
          onClick={() => handleTabChange('elements')}
        >
          {__( 'Elements', 'codellia' )}
        </button>
      </div>
      <button
        className="cd-settingsClose"
        type="button"
        aria-label={__( 'Close settings panel', 'codellia' )}
        onClick={() => onClosePanel?.()}
      >
        <span
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: CLOSE_ICON }}
        />
      </button>
    </div>
  );

  const tabsNode = header ? createPortal(tabs, header) : tabs;

  return (
    <Fragment>
      {tabsNode}

      {activeTab === 'settings' ? (
        <SettingsPanel
          postId={postId}
          canEditJs={canEditJs}
          layout={layout}
          defaultLayout={defaultLayout}
          onChangeLayout={handleLayoutChange}
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

      {activeTab === 'elements' ? <ElementPanel api={elementsApi} /> : null}

    </Fragment>
  );
}

export function initSettings(config: SettingsConfig) {
  const { container, apiFetch } = config;

  if (!apiFetch) {
    container.textContent = __( 'Settings unavailable.', 'codellia' );
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

