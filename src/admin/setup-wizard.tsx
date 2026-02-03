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
    return { error: __( 'Import file is not a valid JSON object.', 'codellia' ) };
  }

  if (raw.version !== 1) {
    return { error: __( 'Unsupported import version.', 'codellia' ) };
  }

  if (typeof raw.html !== 'string') {
    return { error: __( 'Invalid HTML value.', 'codellia' ) };
  }

  if (typeof raw.css !== 'string') {
    return { error: __( 'Invalid CSS value.', 'codellia' ) };
  }

  if (typeof raw.tailwindEnabled !== 'boolean') {
    return { error: __( 'Invalid tailwindEnabled value.', 'codellia' ) };
  }

  if (raw.generatedCss !== undefined && typeof raw.generatedCss !== 'string') {
    return { error: __( 'Invalid generatedCss value.', 'codellia' ) };
  }

  if (raw.js !== undefined && typeof raw.js !== 'string') {
    return { error: __( 'Invalid JavaScript value.', 'codellia' ) };
  }

  if (raw.shadowDomEnabled !== undefined && typeof raw.shadowDomEnabled !== 'boolean') {
    return { error: __( 'Invalid shadowDomEnabled value.', 'codellia' ) };
  }

  if (raw.shortcodeEnabled !== undefined && typeof raw.shortcodeEnabled !== 'boolean') {
    return { error: __( 'Invalid shortcodeEnabled value.', 'codellia' ) };
  }

  if (raw.singlePageEnabled !== undefined && typeof raw.singlePageEnabled !== 'boolean') {
    return { error: __( 'Invalid singlePageEnabled value.', 'codellia' ) };
  }

  if (raw.liveHighlightEnabled !== undefined && typeof raw.liveHighlightEnabled !== 'boolean') {
    return { error: __( 'Invalid liveHighlightEnabled value.', 'codellia' ) };
  }

  if (
    raw.externalScripts !== undefined &&
    (!Array.isArray(raw.externalScripts) || raw.externalScripts.some((item: any) => typeof item !== 'string'))
  ) {
    return { error: __( 'Invalid externalScripts value.', 'codellia' ) };
  }

  if (
    raw.externalStyles !== undefined &&
    (!Array.isArray(raw.externalStyles) || raw.externalStyles.some((item: any) => typeof item !== 'string'))
  ) {
    return { error: __( 'Invalid externalStyles value.', 'codellia' ) };
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
      setError(__( 'Invalid JSON file.', 'codellia' ));
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
          throw new Error(__( 'Import unavailable.', 'codellia' ));
        }
        if (!importPayload) {
          throw new Error(__( 'Select a JSON file to import.', 'codellia' ));
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
          throw new Error(response?.error || __( 'Import failed.', 'codellia' ));
        }

        if (response.importWarnings?.length) {
          console.warn('[Codellia] Import warnings', response.importWarnings);
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
          throw new Error(response?.error || __( 'Setup failed.', 'codellia' ));
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
    <div className="cd-setupOverlay">
      <div className="cd-setupCard" role="dialog" aria-modal="true">
        <div className="cd-setupTitle">{__( 'Choose editor mode', 'codellia' )}</div>
        <div className="cd-setupIntro">
          {__(
            'Select TailwindCSS or Normal mode. This choice cannot be changed later.',
            'codellia'
          )}
        </div>
        <div className="cd-setupOptions">
          <label className={`cd-setupOption${mode === 'normal' ? ' is-active' : ''}`}>
            <input
              type="radio"
              name="cd-setup-mode"
              value="normal"
              checked={mode === 'normal'}
              onChange={() => setMode('normal')}
            />
            <span className="cd-setupOptionBody">
              <span className="cd-setupOptionTitle">
                {__( 'Normal (HTML/CSS)', 'codellia' )}
              </span>
              <span className="cd-setupOptionDesc">
                {__( 'Edit HTML and CSS directly with Monaco.', 'codellia' )}
              </span>
            </span>
          </label>
          <label className={`cd-setupOption${mode === 'tailwind' ? ' is-active' : ''}`}>
            <input
              type="radio"
              name="cd-setup-mode"
              value="tailwind"
              checked={mode === 'tailwind'}
              onChange={() => setMode('tailwind')}
            />
            <span className="cd-setupOptionBody">
              <span className="cd-setupOptionTitle">
                {__( 'TailwindCSS', 'codellia' )}
              </span>
              <span className="cd-setupOptionDesc">
                {__( 'Use utility classes. CSS is compiled automatically.', 'codellia' )}
              </span>
            </span>
          </label>
          <label className={`cd-setupOption${mode === 'import' ? ' is-active' : ''}`}>
            <input
              type="radio"
              name="cd-setup-mode"
              value="import"
              checked={mode === 'import'}
              onChange={() => setMode('import')}
            />
            <span className="cd-setupOptionBody">
              <span className="cd-setupOptionTitle">
                {__( 'Import JSON', 'codellia' )}
              </span>
              <span className="cd-setupOptionDesc">
                {__( 'Restore from an exported Codellia JSON file.', 'codellia' )}
              </span>
            </span>
          </label>
        </div>
        {mode === 'import' ? (
          <div className="cd-setupImport">
            <label className="cd-btn cd-btn-secondary cd-setupFileLabel">
              {__( 'Choose JSON file', 'codellia' )}
              <input
                className="cd-setupFileInput"
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
              />
            </label>
            <div className="cd-setupFileName">
              {importFileName || __( 'No file selected.', 'codellia' )}
            </div>
          </div>
        ) : null}
        <div className="cd-setupNote">
          {__( 'This choice is locked for this Codellia page.', 'codellia' )}
        </div>
        <div className="cd-setupError">{error || ''}</div>
        <div className="cd-setupActions">
          {backUrl ? (
            <a className="cd-btn cd-btn-secondary" href={backUrl}>
              {__( 'Back', 'codellia' )}
            </a>
          ) : null}
          <button
            className="cd-btn cd-btn-primary"
            type="button"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? __( 'Saving...', 'codellia' ) : __( 'Continue', 'codellia' )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function runSetupWizard(config: SetupWizardConfig): Promise<SetupWizardResult> {
  const { container, apiFetch } = config;

  if (!apiFetch) {
    container.textContent = __( 'Setup unavailable.', 'codellia' );
    return Promise.reject(new Error(__( 'wp.apiFetch is unavailable.', 'codellia' )));
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

