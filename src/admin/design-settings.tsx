import { createElement } from '@wordpress/element';

type DesignSettingsPanelProps = {
  enableJavaScript: boolean;
  onToggleJavaScript: (enabled: boolean) => void;
};

export function DesignSettingsPanel({
  enableJavaScript,
  onToggleJavaScript,
}: DesignSettingsPanelProps) {
  return (
    <div className="lc-settingsSection">
      <div className="lc-settingsSectionTitle">デザイン</div>
      <div className="lc-settingsItem lc-settingsToggle">
        <div className="lc-settingsItemLabel">JavaScriptを有効にする</div>
        <label className="lc-toggle">
          <input
            type="checkbox"
            checked={enableJavaScript}
            aria-label="JavaScriptを有効にする"
            onChange={(event) => onToggleJavaScript(event.target.checked)}
          />
          <span className="lc-toggleTrack" aria-hidden="true" />
        </label>
      </div>
    </div>
  );
}
