import {
  createElement,
  Fragment,
  createRoot,
  render,
  useState,
} from '@wordpress/element';

type SetupWizardConfig = {
  container: HTMLElement;
  postId: number;
  restUrl: string;
  apiFetch?: (args: any) => Promise<any>;
  backUrl?: string;
  initialTailwindEnabled?: boolean;
};

type SetupWizardResult = {
  tailwindEnabled: boolean;
};

type SetupWizardProps = {
  postId: number;
  restUrl: string;
  apiFetch: (args: any) => Promise<any>;
  backUrl?: string;
  initialTailwindEnabled?: boolean;
  onComplete: (tailwindEnabled: boolean) => void;
};

type SetupResponse = {
  ok?: boolean;
  error?: string;
  tailwindEnabled?: boolean;
};

function SetupWizard({
  postId,
  restUrl,
  apiFetch,
  backUrl,
  initialTailwindEnabled,
  onComplete,
}: SetupWizardProps) {
  const [mode, setMode] = useState<'normal' | 'tailwind'>(
    initialTailwindEnabled ? 'tailwind' : 'normal'
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (saving) return;
    setError('');
    setSaving(true);
    try {
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

      onComplete(Boolean(response.tailwindEnabled));
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
        </div>
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
    const onComplete = (tailwindEnabled: boolean) => {
      if (root) {
        root.unmount();
      } else {
        render(<Fragment />, container);
      }
      resolve({ tailwindEnabled });
    };

    const node = (
      <SetupWizard
        postId={config.postId}
        restUrl={config.restUrl}
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
