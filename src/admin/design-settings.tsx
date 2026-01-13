import { createElement } from '@wordpress/element';

type DesignSettingsPanelProps = {
  enableJavaScript: boolean;
  onToggleJavaScript: (enabled: boolean) => void;
  disabled?: boolean;
  error?: string;
};

export function DesignSettingsPanel({
  enableJavaScript,
  onToggleJavaScript,
  disabled = false,
  error,
}: DesignSettingsPanelProps) {
  return (
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
  );
}
