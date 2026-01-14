import { createElement, Fragment, useEffect, useRef, useState } from '@wordpress/element';

type DesignSettingsPanelProps = {
  postId: number;
  enableJavaScript: boolean;
  onToggleJavaScript: (enabled: boolean) => void;
  enableShadowDom: boolean;
  onToggleShadowDom: (enabled: boolean) => void;
  enableShortcode: boolean;
  onToggleShortcode: (enabled: boolean) => void;
  externalScripts: string[];
  onChangeExternalScripts: (scripts: string[]) => void;
  onCommitExternalScripts: (scripts: string[]) => void;
  disabled?: boolean;
  error?: string;
  externalScriptsError?: string;
};

const MAX_EXTERNAL_SCRIPTS = 5;

export function DesignSettingsPanel({
  postId,
  enableJavaScript,
  onToggleJavaScript,
  enableShadowDom,
  onToggleShadowDom,
  enableShortcode,
  onToggleShortcode,
  externalScripts,
  onChangeExternalScripts,
  onCommitExternalScripts,
  disabled = false,
  error,
  externalScriptsError,
}: DesignSettingsPanelProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const copyTimeoutRef = useRef<number | null>(null);
  const shortcodeInputRef = useRef<HTMLInputElement | null>(null);
  const canAddScript = !disabled && externalScripts.length < MAX_EXTERNAL_SCRIPTS;
  const hasScripts = externalScripts.length > 0;
  const shortcodeText = `[livecode post_id="${postId}"]`;

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
        <div className="lc-settingsItem lc-settingsToggle">
          <div className="lc-settingsItemLabel">Shadow DOMを有効にする</div>
          <label className="lc-toggle">
            <input
              type="checkbox"
              checked={enableShadowDom}
              aria-label="Shadow DOMを有効にする"
              onChange={(event) => onToggleShadowDom(event.target.checked)}
              disabled={disabled}
            />
            <span className="lc-toggleTrack" aria-hidden="true" />
          </label>
        </div>
        <div className="lc-settingsItem lc-settingsToggle">
          <div className="lc-settingsItemLabel">ショートコード化を有効にする</div>
          <label className="lc-toggle">
            <input
              type="checkbox"
              checked={enableShortcode}
              aria-label="ショートコード化を有効にする"
              onChange={(event) => onToggleShortcode(event.target.checked)}
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

      {enableJavaScript ? (
        <div className="lc-settingsSection">
          <div className="lc-settingsSectionTitle">External Scripts</div>
        {hasScripts ? (
          <div className="lc-settingsScriptList">
            {externalScripts.map((scriptUrl, index) => (
              <div className="lc-settingsScriptRow" key={`script-${index}`}>
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
      ) : null}
      {enableShortcode ? (
        <div className="lc-settingsSection">
          <div className="lc-settingsSectionTitle">ショートコード</div>
          <div className="lc-settingsHelp">
            GutenbergやElementorのショートコードブロックに貼り付けて使用できます。
          </div>
          <div className="lc-settingsScriptRow">
            <input
              ref={shortcodeInputRef}
              type="text"
              className="lc-formInput lc-settingsScriptInput"
              value={shortcodeText}
              readOnly
              aria-label="LiveCodeショートコード"
            />
            <button
              className="lc-btn lc-btn-secondary"
              type="button"
              onClick={handleCopyShortcode}
              aria-label="ショートコードをコピー"
            >
              {copyState === 'copied' ? 'コピー済み' : 'コピー'}
            </button>
          </div>
          {copyState === 'copied' ? (
            <div className="lc-settingsHelp">コピーしました。</div>
          ) : null}
          {copyState === 'error' ? (
            <div className="lc-settingsError">コピーに失敗しました。</div>
          ) : null}
        </div>
      ) : null}
    </Fragment>
  );
}
