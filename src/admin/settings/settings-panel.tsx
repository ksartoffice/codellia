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
  const shortcodeText = `[codellia post_id="${postId}"]`;

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
      <div className="cd-settingsSection">
        <div className="cd-settingsSectionTitle">
          {__( 'Output settings', 'codellia' )}
        </div>
        <div className="cd-settingsItem cd-settingsToggle">
          <div className="cd-settingsItemLabel">
            {__( 'Enable shortcode', 'codellia' )}
          </div>
          <label className="cd-toggle">
            <input
              type="checkbox"
              checked={shortcodeEnabled}
              aria-label={__( 'Enable shortcode', 'codellia' )}
              onChange={(event) => onToggleShortcode(event.target.checked)}
              disabled={disabled}
            />
            <span className="cd-toggleTrack" aria-hidden="true" />
          </label>
        </div>
        {shortcodeEnabled ? (
          <Fragment>
            <div className="cd-settingsScriptRow">
              <input
                ref={shortcodeInputRef}
                type="text"
                className="cd-formInput cd-settingsScriptInput"
                value={shortcodeText}
                readOnly
                aria-label={__( 'Codellia shortcode', 'codellia' )}
              />
              <button
                className="cd-btn cd-btn-secondary"
                type="button"
                onClick={handleCopyShortcode}
                aria-label={__( 'Copy shortcode', 'codellia' )}
              >
                {copyState === 'copied'
                  ? __( 'Copied', 'codellia' )
                  : __( 'Copy', 'codellia' )}
              </button>
            </div>
            {copyState === 'copied' ? (
              <div className="cd-settingsHelp">{__( 'Copied.', 'codellia' )}</div>
            ) : null}
            {copyState === 'error' ? (
              <div className="cd-settingsError">{__( 'Copy failed.', 'codellia' )}</div>
            ) : null}
            <div className="cd-settingsItem cd-settingsToggle">
              <div className="cd-settingsItemLabel">
                {__( 'Do not publish as single page', 'codellia' )}
              </div>
              <label className="cd-toggle">
                <input
                  type="checkbox"
                  checked={!singlePageEnabled}
                  aria-label={__( 'Do not publish as single page', 'codellia' )}
                  onChange={(event) => onToggleSinglePage(!event.target.checked)}
                  disabled={disabled}
                />
                <span className="cd-toggleTrack" aria-hidden="true" />
              </label>
            </div>
            <div className="cd-settingsHelp">
              {__(
                'You can paste this into a shortcode block in Gutenberg or Elementor.',
                'codellia'
              )}
            </div>
          </Fragment>
        ) : null}
        {disabled ? (
          <div className="cd-settingsHelp">
            {__( 'Requires unfiltered_html capability.', 'codellia' )}
          </div>
        ) : null}
        {error ? <div className="cd-settingsError">{error}</div> : null}
      </div>

      <div className="cd-settingsSection">
        <div className="cd-settingsSectionTitle">
          {__( 'Rendering settings', 'codellia' )}
        </div>
        <div className="cd-settingsItem cd-settingsToggle">
          <div className="cd-settingsItemLabel">
            {__( 'Enable Shadow DOM (DSD)', 'codellia' )}
          </div>
          <label className="cd-toggle">
            <input
              type="checkbox"
              checked={shadowDomEnabled}
              aria-label={__( 'Enable Shadow DOM (DSD)', 'codellia' )}
              onChange={(event) => onToggleShadowDom(event.target.checked)}
              disabled={disabled}
            />
            <span className="cd-toggleTrack" aria-hidden="true" />
          </label>
        </div>
        <div className="cd-settingsHelp">
          {__( 'Prevents interference with existing theme CSS.', 'codellia' )}
        </div>
      </div>

      <div className="cd-settingsSection">
        <div className="cd-settingsSectionTitle">
          {__( 'External resource settings', 'codellia' )}
        </div>
        {canEditJs ? (
          <Fragment>
            <div className="cd-settingsItemLabel">{__( 'External scripts', 'codellia' )}</div>
            {hasScripts ? (
              <div className="cd-settingsScriptList">
                {externalScripts.map((scriptUrl, index) => (
                  <div className="cd-settingsScriptRow" key={`script-${index}`}>
                    <input
                      type="url"
                      className="cd-formInput cd-settingsScriptInput"
                      placeholder={__( 'https://example.com/script.js', 'codellia' )}
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
                      className="cd-btn cd-btn-danger cd-settingsScriptButton"
                      type="button"
                      onClick={() => handleRemoveScript(index)}
                      disabled={disabled}
                      aria-label={__( 'Remove external script', 'codellia' )}
                    >
                      {__( 'Remove', 'codellia' )}
                    </button>
                  </div>
                ))}
                <button
                  className="cd-btn cd-btn-secondary cd-settingsScriptAdd"
                  type="button"
                  onClick={handleAddScript}
                  disabled={!canAddScript}
                  aria-label={__( 'Add external script', 'codellia' )}
                >
                  {`+ ${__( 'Add', 'codellia' )}`}
                </button>
              </div>
            ) : (
              <button
                className="cd-btn cd-btn-secondary"
                type="button"
                onClick={handleAddScript}
                disabled={!canAddScript}
              >
                {__( 'Add external script', 'codellia' )}
              </button>
            )}
            <div className="cd-settingsHelp">
              {/* translators: %d: maximum number of items. */}
              {sprintf(
                __(
                  'Only URLs starting with https:// are allowed. You can add up to %d items.',
                  'codellia'
                ),
                MAX_EXTERNAL_SCRIPTS
              )}
            </div>
            {externalScriptsError ? (
              <div className="cd-settingsError">{externalScriptsError}</div>
            ) : null}
          </Fragment>
        ) : null}
        <div className="cd-settingsItemLabel">{__( 'External styles', 'codellia' )}</div>
        {hasStyles ? (
          <div className="cd-settingsScriptList">
            {externalStyles.map((styleUrl, index) => (
              <div className="cd-settingsScriptRow" key={`style-${index}`}>
                <input
                  type="url"
                  className="cd-formInput cd-settingsScriptInput"
                  placeholder={__( 'https://example.com/style.css', 'codellia' )}
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
                  className="cd-btn cd-btn-danger cd-settingsScriptButton"
                  type="button"
                  onClick={() => handleRemoveStyle(index)}
                  disabled={disabled}
                  aria-label={__( 'Remove external style', 'codellia' )}
                >
                  {__( 'Remove', 'codellia' )}
                </button>
              </div>
            ))}
            <button
              className="cd-btn cd-btn-secondary cd-settingsScriptAdd"
              type="button"
              onClick={handleAddStyle}
              disabled={!canAddStyle}
              aria-label={__( 'Add external style', 'codellia' )}
            >
              {`+ ${__( 'Add', 'codellia' )}`}
            </button>
          </div>
        ) : (
          <button
            className="cd-btn cd-btn-secondary"
            type="button"
            onClick={handleAddStyle}
            disabled={!canAddStyle}
          >
            {__( 'Add external style', 'codellia' )}
          </button>
        )}
        <div className="cd-settingsHelp">
          {/* translators: %d: maximum number of items. */}
          {sprintf(
            __( 'Only URLs starting with https:// are allowed. You can add up to %d items.', 'codellia' ),
            MAX_EXTERNAL_STYLES
          )}
        </div>
        {externalStylesError ? (
          <div className="cd-settingsError">{externalStylesError}</div>
        ) : null}
      </div>

      <div className="cd-settingsSection">
        <div className="cd-settingsSectionTitle">
          {__( 'Display settings', 'codellia' )}
        </div>
        <div className="cd-settingsItem cd-settingsToggle">
          <div className="cd-settingsItemLabel">
            {__( 'Enable live edit highlight', 'codellia' )}
          </div>
          <label className="cd-toggle">
            <input
              type="checkbox"
              checked={liveHighlightEnabled}
              aria-label={__( 'Enable live edit highlight', 'codellia' )}
              onChange={(event) => onToggleLiveHighlight(event.target.checked)}
            />
            <span className="cd-toggleTrack" aria-hidden="true" />
          </label>
        </div>
      </div>
    </Fragment>
  );
}

