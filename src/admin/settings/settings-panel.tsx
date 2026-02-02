import { createElement, Fragment, useEffect, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

type SettingsPanelProps = {
  postId: number;
  canEditJs: boolean;
  shadowDomEnabled: boolean;
  onToggleShadowDom: (enabled: boolean) => void;
  shortcodeEnabled: boolean;
  onToggleShortcode: (enabled: boolean) => void;
  singlePageEnabled: boolean;
  onToggleSinglePage: (enabled: boolean) => void;
  liveHighlightEnabled: boolean;
  onToggleLiveHighlight: (enabled: boolean) => void;
  externalScripts: string[];
  onChangeExternalScripts: (scripts: string[]) => void;
  onCommitExternalScripts: (scripts: string[]) => void;
  externalStyles: string[];
  onChangeExternalStyles: (styles: string[]) => void;
  onCommitExternalStyles: (styles: string[]) => void;
  disabled?: boolean;
  error?: string;
  externalScriptsError?: string;
  externalStylesError?: string;
};

const MAX_EXTERNAL_SCRIPTS = 5;
const MAX_EXTERNAL_STYLES = 5;

export function SettingsPanel({
  postId,
  canEditJs,
  shadowDomEnabled,
  onToggleShadowDom,
  shortcodeEnabled,
  onToggleShortcode,
  singlePageEnabled,
  onToggleSinglePage,
  liveHighlightEnabled,
  onToggleLiveHighlight,
  externalScripts,
  onChangeExternalScripts,
  onCommitExternalScripts,
  externalStyles,
  onChangeExternalStyles,
  onCommitExternalStyles,
  disabled = false,
  error,
  externalScriptsError,
  externalStylesError,
}: SettingsPanelProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const copyTimeoutRef = useRef<number | null>(null);
  const shortcodeInputRef = useRef<HTMLInputElement | null>(null);
  const canAddScript = !disabled && externalScripts.length < MAX_EXTERNAL_SCRIPTS;
  const hasScripts = externalScripts.length > 0;
  const canAddStyle = !disabled && externalStyles.length < MAX_EXTERNAL_STYLES;
  const hasStyles = externalStyles.length > 0;
  const shortcodeText = `[codenagi post_id="${postId}"]`;

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const setCopyFeedback = (state: 'copied' | 'error') => {
    setCopyState(state);
    if (copyTimeoutRef.current) {
      window.clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = window.setTimeout(() => {
      setCopyState('idle');
    }, 2000);
  };

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

  const updateStyleAt = (index: number, value: string, commit: boolean) => {
    const next = externalStyles.map((entry, idx) => (idx === index ? value : entry));
    if (commit) {
      onCommitExternalStyles(next);
    } else {
      onChangeExternalStyles(next);
    }
  };

  const handleAddStyle = () => {
    if (!canAddStyle) return;
    onChangeExternalStyles([...externalStyles, '']);
  };

  const handleRemoveStyle = (index: number) => {
    if (disabled) return;
    const next = externalStyles.filter((_, idx) => idx !== index);
    onChangeExternalStyles(next);
    onCommitExternalStyles(next);
  };

  const handleCopyShortcode = async () => {
    if (!shortcodeText) return;
    let copied = false;
    if (window.navigator?.clipboard?.writeText) {
      try {
        await window.navigator.clipboard.writeText(shortcodeText);
        copied = true;
      } catch {
        copied = false;
      }
    }

    if (!copied && shortcodeInputRef.current) {
      shortcodeInputRef.current.focus();
      shortcodeInputRef.current.select();
      try {
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      }
      shortcodeInputRef.current.setSelectionRange(0, 0);
    }

    setCopyFeedback(copied ? 'copied' : 'error');
  };

  return (
    <Fragment>
      <div className="lc-settingsSection">
        <div className="lc-settingsSectionTitle">
          {__( 'Output settings', 'wp-livecode' )}
        </div>
        <div className="lc-settingsItem lc-settingsToggle">
          <div className="lc-settingsItemLabel">
            {__( 'Enable shortcode', 'wp-livecode' )}
          </div>
          <label className="lc-toggle">
            <input
              type="checkbox"
              checked={shortcodeEnabled}
              aria-label={__( 'Enable shortcode', 'wp-livecode' )}
              onChange={(event) => onToggleShortcode(event.target.checked)}
              disabled={disabled}
            />
            <span className="lc-toggleTrack" aria-hidden="true" />
          </label>
        </div>
        {shortcodeEnabled ? (
          <Fragment>
            <div className="lc-settingsScriptRow">
              <input
                ref={shortcodeInputRef}
                type="text"
                className="lc-formInput lc-settingsScriptInput"
                value={shortcodeText}
                readOnly
                aria-label={__( 'CodeNagi shortcode', 'wp-livecode' )}
              />
              <button
                className="lc-btn lc-btn-secondary"
                type="button"
                onClick={handleCopyShortcode}
                aria-label={__( 'Copy shortcode', 'wp-livecode' )}
              >
                {copyState === 'copied'
                  ? __( 'Copied', 'wp-livecode' )
                  : __( 'Copy', 'wp-livecode' )}
              </button>
            </div>
            {copyState === 'copied' ? (
              <div className="lc-settingsHelp">{__( 'Copied.', 'wp-livecode' )}</div>
            ) : null}
            {copyState === 'error' ? (
              <div className="lc-settingsError">{__( 'Copy failed.', 'wp-livecode' )}</div>
            ) : null}
            <div className="lc-settingsItem lc-settingsToggle">
              <div className="lc-settingsItemLabel">
                {__( 'Do not publish as single page', 'wp-livecode' )}
              </div>
              <label className="lc-toggle">
                <input
                  type="checkbox"
                  checked={!singlePageEnabled}
                  aria-label={__( 'Do not publish as single page', 'wp-livecode' )}
                  onChange={(event) => onToggleSinglePage(!event.target.checked)}
                  disabled={disabled}
                />
                <span className="lc-toggleTrack" aria-hidden="true" />
              </label>
            </div>
            <div className="lc-settingsHelp">
              {__(
                'You can paste this into a shortcode block in Gutenberg or Elementor.',
                'wp-livecode'
              )}
            </div>
          </Fragment>
        ) : null}
        {disabled ? (
          <div className="lc-settingsHelp">
            {__( 'Requires unfiltered_html capability.', 'wp-livecode' )}
          </div>
        ) : null}
        {error ? <div className="lc-settingsError">{error}</div> : null}
      </div>

      <div className="lc-settingsSection">
        <div className="lc-settingsSectionTitle">
          {__( 'Rendering settings', 'wp-livecode' )}
        </div>
        <div className="lc-settingsItem lc-settingsToggle">
          <div className="lc-settingsItemLabel">
            {__( 'Enable Shadow DOM (DSD)', 'wp-livecode' )}
          </div>
          <label className="lc-toggle">
            <input
              type="checkbox"
              checked={shadowDomEnabled}
              aria-label={__( 'Enable Shadow DOM (DSD)', 'wp-livecode' )}
              onChange={(event) => onToggleShadowDom(event.target.checked)}
              disabled={disabled}
            />
            <span className="lc-toggleTrack" aria-hidden="true" />
          </label>
        </div>
        <div className="lc-settingsHelp">
          {__( 'Prevents interference with existing theme CSS.', 'wp-livecode' )}
        </div>
      </div>

      <div className="lc-settingsSection">
        <div className="lc-settingsSectionTitle">
          {__( 'External resource settings', 'wp-livecode' )}
        </div>
        {canEditJs ? (
          <Fragment>
            <div className="lc-settingsItemLabel">{__( 'External scripts', 'wp-livecode' )}</div>
            {hasScripts ? (
              <div className="lc-settingsScriptList">
                {externalScripts.map((scriptUrl, index) => (
                  <div className="lc-settingsScriptRow" key={`script-${index}`}>
                    <input
                      type="url"
                      className="lc-formInput lc-settingsScriptInput"
                      placeholder={__( 'https://example.com/script.js', 'wp-livecode' )}
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
                      aria-label={__( 'Remove external script', 'wp-livecode' )}
                    >
                      {__( 'Remove', 'wp-livecode' )}
                    </button>
                  </div>
                ))}
                <button
                  className="lc-btn lc-btn-secondary lc-settingsScriptAdd"
                  type="button"
                  onClick={handleAddScript}
                  disabled={!canAddScript}
                  aria-label={__( 'Add external script', 'wp-livecode' )}
                >
                  {`+ ${__( 'Add', 'wp-livecode' )}`}
                </button>
              </div>
            ) : (
              <button
                className="lc-btn lc-btn-secondary"
                type="button"
                onClick={handleAddScript}
                disabled={!canAddScript}
              >
                {__( 'Add external script', 'wp-livecode' )}
              </button>
            )}
            <div className="lc-settingsHelp">
              {/* translators: %d: maximum number of items. */}
              {sprintf(
                __(
                  'Only URLs starting with https:// are allowed. You can add up to %d items.',
                  'wp-livecode'
                ),
                MAX_EXTERNAL_SCRIPTS
              )}
            </div>
            {externalScriptsError ? (
              <div className="lc-settingsError">{externalScriptsError}</div>
            ) : null}
          </Fragment>
        ) : null}
        <div className="lc-settingsItemLabel">{__( 'External styles', 'wp-livecode' )}</div>
        {hasStyles ? (
          <div className="lc-settingsScriptList">
            {externalStyles.map((styleUrl, index) => (
              <div className="lc-settingsScriptRow" key={`style-${index}`}>
                <input
                  type="url"
                  className="lc-formInput lc-settingsScriptInput"
                  placeholder={__( 'https://example.com/style.css', 'wp-livecode' )}
                  value={styleUrl}
                  onChange={(event) => updateStyleAt(index, event.target.value, false)}
                  onBlur={(event) => updateStyleAt(index, event.target.value, true)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      updateStyleAt(index, (event.target as HTMLInputElement).value, true);
                    }
                  }}
                  disabled={disabled}
                />
                <button
                  className="lc-btn lc-btn-danger lc-settingsScriptButton"
                  type="button"
                  onClick={() => handleRemoveStyle(index)}
                  disabled={disabled}
                  aria-label={__( 'Remove external style', 'wp-livecode' )}
                >
                  {__( 'Remove', 'wp-livecode' )}
                </button>
              </div>
            ))}
            <button
              className="lc-btn lc-btn-secondary lc-settingsScriptAdd"
              type="button"
              onClick={handleAddStyle}
              disabled={!canAddStyle}
              aria-label={__( 'Add external style', 'wp-livecode' )}
            >
              {`+ ${__( 'Add', 'wp-livecode' )}`}
            </button>
          </div>
        ) : (
          <button
            className="lc-btn lc-btn-secondary"
            type="button"
            onClick={handleAddStyle}
            disabled={!canAddStyle}
          >
            {__( 'Add external style', 'wp-livecode' )}
          </button>
        )}
        <div className="lc-settingsHelp">
          {/* translators: %d: maximum number of items. */}
          {sprintf(
            __( 'Only URLs starting with https:// are allowed. You can add up to %d items.', 'wp-livecode' ),
            MAX_EXTERNAL_STYLES
          )}
        </div>
        {externalStylesError ? (
          <div className="lc-settingsError">{externalStylesError}</div>
        ) : null}
      </div>

      <div className="lc-settingsSection">
        <div className="lc-settingsSectionTitle">
          {__( 'Display settings', 'wp-livecode' )}
        </div>
        <div className="lc-settingsItem lc-settingsToggle">
          <div className="lc-settingsItemLabel">
            {__( 'Enable live edit highlight', 'wp-livecode' )}
          </div>
          <label className="lc-toggle">
            <input
              type="checkbox"
              checked={liveHighlightEnabled}
              aria-label={__( 'Enable live edit highlight', 'wp-livecode' )}
              onChange={(event) => onToggleLiveHighlight(event.target.checked)}
            />
            <span className="lc-toggleTrack" aria-hidden="true" />
          </label>
        </div>
      </div>
    </Fragment>
  );
}
