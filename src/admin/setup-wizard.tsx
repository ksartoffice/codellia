import {
  createElement,
  Fragment,
  createRoot,
  render,
  useState,
} from '@wordpress/element';
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
  tailwindEnabled?: boolean;
  settingsData?: SettingsData;
};

function validateImportPayload(raw: any): { data?: ImportPayload; error?: string } {
  if (!raw || typeof raw !== 'object') {
    return { error: 'Import file is not a valid JSON object.' };
  }

  if (raw.version !== 1) {
    return { error: 'Unsupported import version.' };
  }

  if (typeof raw.html !== 'string') {
    return { error: 'Invalid HTML value.' };
  }

  if (typeof raw.css !== 'string') {
    return { error: 'Invalid CSS value.' };
  }

  if (typeof raw.tailwind !== 'boolean') {
    return { error: 'Invalid tailwind flag.' };
  }

  if (raw.generatedCss !== undefined && typeof raw.generatedCss !== 'string') {
    return { error: 'Invalid generatedCss value.' };
  }

  if (raw.js !== undefined && typeof raw.js !== 'string') {
    return { error: 'Invalid JavaScript value.' };
  }

  if (raw.jsEnabled !== undefined && typeof raw.jsEnabled !== 'boolean') {
    return { error: 'Invalid jsEnabled value.' };
  }

  if (raw.shadowDomEnabled !== undefined && typeof raw.shadowDomEnabled !== 'boolean') {
    return { error: 'Invalid shadowDomEnabled value.' };
  }

  if (raw.shortcodeEnabled !== undefined && typeof raw.shortcodeEnabled !== 'boolean') {
    return { error: 'Invalid shortcodeEnabled value.' };
  }

  if (raw.liveHighlightEnabled !== undefined && typeof raw.liveHighlightEnabled !== 'boolean') {
    return { error: 'Invalid liveHighlightEnabled value.' };
  }

  if (
    raw.externalScripts !== undefined &&
    (!Array.isArray(raw.externalScripts) || raw.externalScripts.some((item: any) => typeof item !== 'string'))
  ) {
    return { error: 'Invalid externalScripts value.' };
  }

  return {
    data: {
      version: 1,
      html: raw.html,
      css: raw.css,
      tailwind: raw.tailwind,
      generatedCss: raw.generatedCss,
      js: raw.js ?? '',
      jsEnabled: raw.jsEnabled ?? false,
      externalScripts: raw.externalScripts ?? [],
      shadowDomEnabled: raw.shadowDomEnabled ?? false,
      shortcodeEnabled: raw.shortcodeEnabled ?? false,
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
      setError('Invalid JSON file.');
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
          throw new Error('Import unavailable.');
        }
        if (!importPayload) {
          throw new Error('Select a JSON file to import.');
        }

        const response: ImportResponse = await apiFetch({
          url: importRestUrl,
          method: 'POST',
          data: {
            postId,
            payload: importPayload,
          },
        });

        if (!response?.ok) {
          throw new Error(response?.error || 'Import failed.');
        }

        onComplete({
          tailwindEnabled: Boolean(response.tailwindEnabled ?? importPayload.tailwind),
          imported: {
            payload: importPayload,
            settingsData: response.settingsData,
          },
        });
      } else {
        const response: SetupResponse = await apiFetch({
          url: restUrl,
          method: 'POST',
          data: {
            postId,
            mode,
          },
        });

        if (!response?.ok) {
          throw new Error(response?.error || 'Setup failed.');
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
        <div className="lc-setupTitle">Choose editor mode</div>
        <div className="lc-setupIntro">
          Select TailwindCSS or Normal mode. This choice cannot be changed later.
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
              <span className="lc-setupOptionTitle">Normal (HTML/CSS)</span>
              <span className="lc-setupOptionDesc">
                Edit HTML and CSS directly with Monaco.
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
              <span className="lc-setupOptionTitle">TailwindCSS</span>
              <span className="lc-setupOptionDesc">
                Use utility classes. CSS is compiled automatically.
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
              <span className="lc-setupOptionTitle">Import JSON</span>
              <span className="lc-setupOptionDesc">
                Restore from an exported LiveCode JSON file.
              </span>
            </span>
          </label>
        </div>
        {mode === 'import' ? (
          <div className="lc-setupImport">
            <label className="lc-btn lc-btn-secondary lc-setupFileLabel">
              Choose JSON file
              <input
                className="lc-setupFileInput"
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
              />
            </label>
            <div className="lc-setupFileName">
              {importFileName || 'No file selected.'}
            </div>
          </div>
        ) : null}
        <div className="lc-setupNote">
          This choice is locked for this LiveCode page.
        </div>
        <div className="lc-setupError">{error || ''}</div>
        <div className="lc-setupActions">
          {backUrl ? (
            <a className="lc-btn lc-btn-secondary" href={backUrl}>
              Back
            </a>
          ) : null}
          <button
            className="lc-btn lc-btn-primary"
            type="button"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function runSetupWizard(config: SetupWizardConfig): Promise<SetupWizardResult> {
  const { container, apiFetch } = config;

  if (!apiFetch) {
    container.textContent = 'Setup unavailable.';
    return Promise.reject(new Error('wp.apiFetch is unavailable.'));
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
