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
  post_id: number;
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
  post_id: number;
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
    return { error: __( 'Import file is not a valid JSON object.', 'wp-livecode' ) };
  }

  if (raw.version !== 1) {
    return { error: __( 'Unsupported import version.', 'wp-livecode' ) };
  }

  if (typeof raw.html !== 'string') {
    return { error: __( 'Invalid HTML value.', 'wp-livecode' ) };
  }

  if (typeof raw.css !== 'string') {
    return { error: __( 'Invalid CSS value.', 'wp-livecode' ) };
  }

  if (typeof raw.tailwindEnabled !== 'boolean') {
    return { error: __( 'Invalid tailwindEnabled value.', 'wp-livecode' ) };
  }

  if (raw.generatedCss !== undefined && typeof raw.generatedCss !== 'string') {
    return { error: __( 'Invalid generatedCss value.', 'wp-livecode' ) };
  }

  if (raw.js !== undefined && typeof raw.js !== 'string') {
    return { error: __( 'Invalid JavaScript value.', 'wp-livecode' ) };
  }

  if (raw.jsEnabled !== undefined && typeof raw.jsEnabled !== 'boolean') {
    return { error: __( 'Invalid jsEnabled value.', 'wp-livecode' ) };
  }

  if (raw.shadowDomEnabled !== undefined && typeof raw.shadowDomEnabled !== 'boolean') {
    return { error: __( 'Invalid shadowDomEnabled value.', 'wp-livecode' ) };
  }

  if (raw.shortcodeEnabled !== undefined && typeof raw.shortcodeEnabled !== 'boolean') {
    return { error: __( 'Invalid shortcodeEnabled value.', 'wp-livecode' ) };
  }

  if (raw.liveHighlightEnabled !== undefined && typeof raw.liveHighlightEnabled !== 'boolean') {
    return { error: __( 'Invalid liveHighlightEnabled value.', 'wp-livecode' ) };
  }

  if (
    raw.externalScripts !== undefined &&
    (!Array.isArray(raw.externalScripts) || raw.externalScripts.some((item: any) => typeof item !== 'string'))
  ) {
    return { error: __( 'Invalid externalScripts value.', 'wp-livecode' ) };
  }

  if (
    raw.externalStyles !== undefined &&
    (!Array.isArray(raw.externalStyles) || raw.externalStyles.some((item: any) => typeof item !== 'string'))
  ) {
    return { error: __( 'Invalid externalStyles value.', 'wp-livecode' ) };
  }

  return {
    data: {
      version: 1,
      html: raw.html,
      css: raw.css,
      tailwindEnabled: raw.tailwindEnabled,
      generatedCss: raw.generatedCss,
      js: raw.js ?? '',
      jsEnabled: raw.jsEnabled ?? false,
      externalScripts: raw.externalScripts ?? [],
      externalStyles: raw.externalStyles ?? [],
      shadowDomEnabled: raw.shadowDomEnabled ?? false,
      shortcodeEnabled: raw.shortcodeEnabled ?? false,
      liveHighlightEnabled: raw.liveHighlightEnabled,
    },
  };
}

function SetupWizard({
  post_id,
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
      setError(__( 'Invalid JSON file.', 'wp-livecode' ));
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
          throw new Error(__( 'Import unavailable.', 'wp-livecode' ));
        }
        if (!importPayload) {
          throw new Error(__( 'Select a JSON file to import.', 'wp-livecode' ));
        }

        const response: ImportResponse = await apiFetch({
          url: importRestUrl,
          method: 'POST',
          data: {
            post_id,
            payload: importPayload,
          },
        });

        if (!response?.ok) {
          throw new Error(response?.error || __( 'Import failed.', 'wp-livecode' ));
        }

        if (response.importWarnings?.length) {
          console.warn('[WP LiveCode] Import warnings', response.importWarnings);
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
            post_id,
            mode,
          },
        });

        if (!response?.ok) {
          throw new Error(response?.error || __( 'Setup failed.', 'wp-livecode' ));
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
        <div className="lc-setupTitle">{__( 'Choose editor mode', 'wp-livecode' )}</div>
        <div className="lc-setupIntro">
          {__(
            'Select TailwindCSS or Normal mode. This choice cannot be changed later.',
            'wp-livecode'
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
                {__( 'Normal (HTML/CSS)', 'wp-livecode' )}
              </span>
              <span className="lc-setupOptionDesc">
                {__( 'Edit HTML and CSS directly with Monaco.', 'wp-livecode' )}
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
                {__( 'TailwindCSS', 'wp-livecode' )}
              </span>
              <span className="lc-setupOptionDesc">
                {__( 'Use utility classes. CSS is compiled automatically.', 'wp-livecode' )}
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
                {__( 'Import JSON', 'wp-livecode' )}
              </span>
              <span className="lc-setupOptionDesc">
                {__( 'Restore from an exported LiveCode JSON file.', 'wp-livecode' )}
              </span>
            </span>
          </label>
        </div>
        {mode === 'import' ? (
          <div className="lc-setupImport">
            <label className="lc-btn lc-btn-secondary lc-setupFileLabel">
              {__( 'Choose JSON file', 'wp-livecode' )}
              <input
                className="lc-setupFileInput"
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
              />
            </label>
            <div className="lc-setupFileName">
              {importFileName || __( 'No file selected.', 'wp-livecode' )}
            </div>
          </div>
        ) : null}
        <div className="lc-setupNote">
          {__( 'This choice is locked for this LiveCode page.', 'wp-livecode' )}
        </div>
        <div className="lc-setupError">{error || ''}</div>
        <div className="lc-setupActions">
          {backUrl ? (
            <a className="lc-btn lc-btn-secondary" href={backUrl}>
              {__( 'Back', 'wp-livecode' )}
            </a>
          ) : null}
          <button
            className="lc-btn lc-btn-primary"
            type="button"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? __( 'Saving...', 'wp-livecode' ) : __( 'Continue', 'wp-livecode' )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function runSetupWizard(config: SetupWizardConfig): Promise<SetupWizardResult> {
  const { container, apiFetch } = config;

  if (!apiFetch) {
    container.textContent = __( 'Setup unavailable.', 'wp-livecode' );
    return Promise.reject(new Error(__( 'wp.apiFetch is unavailable.', 'wp-livecode' )));
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
        post_id={config.post_id}
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
