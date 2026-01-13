import { createElement, Fragment } from '@wordpress/element';

type DesignSettingsPanelProps = {
  enableJavaScript: boolean;
  onToggleJavaScript: (enabled: boolean) => void;
  externalScripts: string[];
  onChangeExternalScripts: (scripts: string[]) => void;
  onCommitExternalScripts: (scripts: string[]) => void;
  disabled?: boolean;
  error?: string;
  externalScriptsError?: string;
};

const MAX_EXTERNAL_SCRIPTS = 5;

export function DesignSettingsPanel({
  enableJavaScript,
  onToggleJavaScript,
  externalScripts,
  onChangeExternalScripts,
  onCommitExternalScripts,
  disabled = false,
  error,
  externalScriptsError,
}: DesignSettingsPanelProps) {
  const canAddScript = !disabled && externalScripts.length < MAX_EXTERNAL_SCRIPTS;
  const hasScripts = externalScripts.length > 0;

  const updateScriptAt = (index: number, value: string, commit: boolean) => {
    const next = externalScripts.map((entry, idx) => (idx === index ? value : entry));
    if (commit) {
      onCommitExternalScripts(next);
    } else {
      onChangeExternalScripts(next);
    }
  };

  const handleAddScript = () => {
    if (!canAddScript) return;
    onChangeExternalScripts([...externalScripts, '']);
  };

  const handleRemoveScript = (index: number) => {
    if (disabled) return;
    const next = externalScripts.filter((_, idx) => idx !== index);
    onChangeExternalScripts(next);
    onCommitExternalScripts(next);
  };

  return (
    <Fragment>
      <div className="lc-settingsSection">
        <div className="lc-settingsSectionTitle">JavaScript設定</div>
        <div className="lc-settingsItem lc-settingsToggle">
          <div className="lc-settingsItemLabel">JavaScriptを有効にする</div>
          <label className="lc-toggle">
            <input
              type="checkbox"
              checked={enableJavaScript}
              aria-label="JavaScriptを有効にする"
              onChange={(event) => onToggleJavaScript(event.target.checked)}
              disabled={disabled}
            />
            <span className="lc-toggleTrack" aria-hidden="true" />
          </label>
        </div>
        {disabled ? (
          <div className="lc-settingsHelp">Requires unfiltered_html capability.</div>
        ) : null}
        {error ? <div className="lc-settingsError">{error}</div> : null}
      </div>

      <div className="lc-settingsSection">
        <div className="lc-settingsSectionTitle">External Scripts</div>
        {hasScripts ? (
          <div className="lc-settingsScriptList">
            {externalScripts.map((scriptUrl, index) => (
              <div className="lc-settingsScriptRow" key={`${index}-${scriptUrl}`}>
                <input
                  type="url"
                  className="lc-formInput lc-settingsScriptInput"
                  placeholder="https://example.com/script.js"
                  value={scriptUrl}
                  onChange={(event) => updateScriptAt(index, event.target.value, false)}
                  onBlur={(event) => updateScriptAt(index, event.target.value, true)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      updateScriptAt(index, (event.target as HTMLInputElement).value, true);
                    }
                  }}
                  disabled={disabled}
                />
                <button
                  className="lc-btn lc-btn-danger lc-settingsScriptButton"
                  type="button"
                  onClick={() => handleRemoveScript(index)}
                  disabled={disabled}
                  aria-label="外部スクリプトを削除"
                >
                  削除
                </button>
              </div>
            ))}
            <button
              className="lc-btn lc-btn-secondary lc-settingsScriptAdd"
              type="button"
              onClick={handleAddScript}
              disabled={!canAddScript}
              aria-label="外部スクリプトを追加"
            >
              + 追加
            </button>
          </div>
        ) : (
          <button
            className="lc-btn lc-btn-secondary"
            type="button"
            onClick={handleAddScript}
            disabled={!canAddScript}
          >
            外部スクリプトを追加
          </button>
        )}
        <div className="lc-settingsHelp">
          https:// から始まるURLのみ。最大{MAX_EXTERNAL_SCRIPTS}件まで追加できます。
        </div>
        {externalScriptsError ? (
          <div className="lc-settingsError">{externalScriptsError}</div>
        ) : null}
      </div>
    </Fragment>
  );
}
