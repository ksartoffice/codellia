import {
  createElement,
  Fragment,
  createRoot,
  render,
  useState,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import type { SettingsData } from './settings';
import type { ImportPayload } from './types';

type SetupWizardConfig = {
  container: HTMLElement;
  postId: number;
  restUrl: string;
  importRestUrl?: string;
  apiFetch?: (args: any) => Promise<any>;
  backUrl?: string;
  initialTailwindEnabled?: boolean;
};

type SetupWizardResult = {
  tailwindEnabled: boolean;
  imported?: {
    payload: ImportPayload;
    settingsData?: SettingsData;
  };
};

type SetupWizardProps = {
  postId: number;
  restUrl: string;
  importRestUrl?: string;
  apiFetch: (args: any) => Promise<any>;
  backUrl?: string;
  initialTailwindEnabled?: boolean;
  onComplete: (result: SetupWizardResult) => void;
};

type SetupResponse = {
  ok?: boolean;
  error?: string;
  tailwindEnabled?: boolean;
};

type ImportResponse = {
  ok?: boolean;
  error?: string;
  html?: string;
  tailwindEnabled?: boolean;
  settingsData?: SettingsData;
  importWarnings?: string[];
  importedImages?: Array<{
    sourceUrl: string;
    attachmentId: number;
    attachmentUrl: string;
  }>;
};

function validateImportPayload(raw: any): { data?: ImportPayload; error?: string } {
  if (!raw || typeof raw !== 'object') {
    return { error: __( 'Import file is not a valid JSON object.', 'codenagi' ) };
  }

  if (raw.version !== 1) {
    return { error: __( 'Unsupported import version.', 'codenagi' ) };
  }

  if (typeof raw.html !== 'string') {
    return { error: __( 'Invalid HTML value.', 'codenagi' ) };
  }

  if (typeof raw.css !== 'string') {
    return { error: __( 'Invalid CSS value.', 'codenagi' ) };
  }

  if (typeof raw.tailwindEnabled !== 'boolean') {
    return { error: __( 'Invalid tailwindEnabled value.', 'codenagi' ) };
  }

  if (raw.generatedCss !== undefined && typeof raw.generatedCss !== 'string') {
    return { error: __( 'Invalid generatedCss value.', 'codenagi' ) };
  }

  if (raw.js !== undefined && typeof raw.js !== 'string') {
    return { error: __( 'Invalid JavaScript value.', 'codenagi' ) };
  }

  if (raw.shadowDomEnabled !== undefined && typeof raw.shadowDomEnabled !== 'boolean') {
    return { error: __( 'Invalid shadowDomEnabled value.', 'codenagi' ) };
  }

  if (raw.shortcodeEnabled !== undefined && typeof raw.shortcodeEnabled !== 'boolean') {
    return { error: __( 'Invalid shortcodeEnabled value.', 'codenagi' ) };
  }

  if (raw.singlePageEnabled !== undefined && typeof raw.singlePageEnabled !== 'boolean') {
    return { error: __( 'Invalid singlePageEnabled value.', 'codenagi' ) };
  }

  if (raw.liveHighlightEnabled !== undefined && typeof raw.liveHighlightEnabled !== 'boolean') {
    return { error: __( 'Invalid liveHighlightEnabled value.', 'codenagi' ) };
  }

  if (
    raw.externalScripts !== undefined &&
    (!Array.isArray(raw.externalScripts) || raw.externalScripts.some((item: any) => typeof item !== 'string'))
  ) {
    return { error: __( 'Invalid externalScripts value.', 'codenagi' ) };
  }

  if (
    raw.externalStyles !== undefined &&
    (!Array.isArray(raw.externalStyles) || raw.externalStyles.some((item: any) => typeof item !== 'string'))
  ) {
    return { error: __( 'Invalid externalStyles value.', 'codenagi' ) };
  }

  return {
    data: {
      version: 1,
      html: raw.html,
      css: raw.css,
      tailwindEnabled: raw.tailwindEnabled,
      generatedCss: raw.generatedCss,
      js: raw.js ?? '',
      externalScripts: raw.externalScripts ?? [],
      externalStyles: raw.externalStyles ?? [],
      shadowDomEnabled: raw.shadowDomEnabled ?? false,
      shortcodeEnabled: raw.shortcodeEnabled ?? false,
      singlePageEnabled: raw.singlePageEnabled ?? true,
      liveHighlightEnabled: raw.liveHighlightEnabled,
    },
  };
}

function SetupWizard({
  postId,
  restUrl,
  importRestUrl,
  apiFetch,
  backUrl,
  initialTailwindEnabled,
  onComplete,
}: SetupWizardProps) {
  const [mode, setMode] = useState<'normal' | 'tailwind' | 'import'>(
    initialTailwindEnabled ? 'tailwind' : 'normal'
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [importPayload, setImportPayload] = useState<ImportPayload | null>(null);
  const [importFileName, setImportFileName] = useState('');

  const handleFileChange = async (event: any) => {
    const input = event?.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      setImportFileName('');
      setImportPayload(null);
      return;
    }

    setImportFileName(file.name);
    setError('');

    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const result = validateImportPayload(raw);
      if (result.error) {
        setError(result.error);
        setImportPayload(null);
        return;
      }
      setImportPayload(result.data || null);
    } catch (err: any) {
      setError(__( 'Invalid JSON file.', 'codenagi' ));
      setImportPayload(null);
    }
  };

  const handleSubmit = async () => {
    if (saving) return;
    setError('');
    setSaving(true);
    try {
      if (mode === 'import') {
        if (!importRestUrl) {
          throw new Error(__( 'Import unavailable.', 'codenagi' ));
        }
        if (!importPayload) {
          throw new Error(__( 'Select a JSON file to import.', 'codenagi' ));
        }

        const response: ImportResponse = await apiFetch({
          url: importRestUrl,
          method: 'POST',
          data: {
            post_id: postId,
            payload: importPayload,
          },
        });

        if (!response?.ok) {
          throw new Error(response?.error || __( 'Import failed.', 'codenagi' ));
        }

        if (response.importWarnings?.length) {
          console.warn('[CodeNagi] Import warnings', response.importWarnings);
        }

        const normalizedPayload = response.html
          ? { ...importPayload, html: response.html }
          : importPayload;

        onComplete({
          tailwindEnabled: Boolean(response.tailwindEnabled ?? importPayload.tailwindEnabled),
          imported: {
            payload: normalizedPayload,
            settingsData: response.settingsData,
          },
        });
      } else {
        const response: SetupResponse = await apiFetch({
          url: restUrl,
          method: 'POST',
          data: {
            post_id: postId,
            mode,
          },
        });

        if (!response?.ok) {
          throw new Error(response?.error || __( 'Setup failed.', 'codenagi' ));
        }

        onComplete({ tailwindEnabled: Boolean(response.tailwindEnabled) });
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="lc-setupOverlay">
      <div className="lc-setupCard" role="dialog" aria-modal="true">
        <div className="lc-setupTitle">{__( 'Choose editor mode', 'codenagi' )}</div>
        <div className="lc-setupIntro">
          {__(
            'Select TailwindCSS or Normal mode. This choice cannot be changed later.',
            'codenagi'
          )}
        </div>
        <div className="lc-setupOptions">
          <label className={`lc-setupOption${mode === 'normal' ? ' is-active' : ''}`}>
            <input
              type="radio"
              name="lc-setup-mode"
              value="normal"
              checked={mode === 'normal'}
              onChange={() => setMode('normal')}
            />
            <span className="lc-setupOptionBody">
              <span className="lc-setupOptionTitle">
                {__( 'Normal (HTML/CSS)', 'codenagi' )}
              </span>
              <span className="lc-setupOptionDesc">
                {__( 'Edit HTML and CSS directly with Monaco.', 'codenagi' )}
              </span>
            </span>
          </label>
          <label className={`lc-setupOption${mode === 'tailwind' ? ' is-active' : ''}`}>
            <input
              type="radio"
              name="lc-setup-mode"
              value="tailwind"
              checked={mode === 'tailwind'}
              onChange={() => setMode('tailwind')}
            />
            <span className="lc-setupOptionBody">
              <span className="lc-setupOptionTitle">
                {__( 'TailwindCSS', 'codenagi' )}
              </span>
              <span className="lc-setupOptionDesc">
                {__( 'Use utility classes. CSS is compiled automatically.', 'codenagi' )}
              </span>
            </span>
          </label>
          <label className={`lc-setupOption${mode === 'import' ? ' is-active' : ''}`}>
            <input
              type="radio"
              name="lc-setup-mode"
              value="import"
              checked={mode === 'import'}
              onChange={() => setMode('import')}
            />
            <span className="lc-setupOptionBody">
              <span className="lc-setupOptionTitle">
                {__( 'Import JSON', 'codenagi' )}
              </span>
              <span className="lc-setupOptionDesc">
                {__( 'Restore from an exported CodeNagi JSON file.', 'codenagi' )}
              </span>
            </span>
          </label>
        </div>
        {mode === 'import' ? (
          <div className="lc-setupImport">
            <label className="lc-btn lc-btn-secondary lc-setupFileLabel">
              {__( 'Choose JSON file', 'codenagi' )}
              <input
                className="lc-setupFileInput"
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
              />
            </label>
            <div className="lc-setupFileName">
              {importFileName || __( 'No file selected.', 'codenagi' )}
            </div>
          </div>
        ) : null}
        <div className="lc-setupNote">
          {__( 'This choice is locked for this CodeNagi page.', 'codenagi' )}
        </div>
        <div className="lc-setupError">{error || ''}</div>
        <div className="lc-setupActions">
          {backUrl ? (
            <a className="lc-btn lc-btn-secondary" href={backUrl}>
              {__( 'Back', 'codenagi' )}
            </a>
          ) : null}
          <button
            className="lc-btn lc-btn-primary"
            type="button"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? __( 'Saving...', 'codenagi' ) : __( 'Continue', 'codenagi' )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function runSetupWizard(config: SetupWizardConfig): Promise<SetupWizardResult> {
  const { container, apiFetch } = config;

  if (!apiFetch) {
    container.textContent = __( 'Setup unavailable.', 'codenagi' );
    return Promise.reject(new Error(__( 'wp.apiFetch is unavailable.', 'codenagi' )));
  }

  return new Promise((resolve) => {
    const root = typeof createRoot === 'function' ? createRoot(container) : null;
    const onComplete = (result: SetupWizardResult) => {
      if (root) {
        root.unmount();
      } else {
        render(<Fragment />, container);
      }
      resolve(result);
    };

    const node = (
      <SetupWizard
        postId={config.postId}
        restUrl={config.restUrl}
        importRestUrl={config.importRestUrl}
        apiFetch={apiFetch}
        backUrl={config.backUrl}
        initialTailwindEnabled={config.initialTailwindEnabled}
        onComplete={onComplete}
      />
    );

    if (root) {
      root.render(node);
    } else {
      render(node, container);
    }
  });
}

