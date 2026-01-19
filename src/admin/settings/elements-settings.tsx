import { createElement, useCallback, useEffect, useState } from '@wordpress/element';

export type ElementsSettingsApi = {
  subscribeSelection: (listener: (lcId: string | null) => void) => () => void;
  subscribeContentChange: (listener: () => void) => () => void;
  getElementText: (lcId: string) => string | null;
  updateElementText: (lcId: string, text: string) => boolean;
};

type ElementsSettingsPanelProps = {
  api?: ElementsSettingsApi;
};

export function ElementsSettingsPanel({ api }: ElementsSettingsPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const fieldId = 'lc-elements-text';

  const refreshText = useCallback(() => {
    if (!api?.getElementText || !selectedId) {
      setValue('');
      setIsVisible(false);
      return;
    }
    const next = api.getElementText(selectedId);
    if (typeof next === 'string') {
      setIsVisible(true);
      setValue((prev) => (prev === next ? prev : next));
    } else {
      setValue('');
      setIsVisible(false);
    }
  }, [api, selectedId]);

  useEffect(() => {
    if (!api?.subscribeSelection) {
      return;
    }
    return api.subscribeSelection((lcId) => {
      setSelectedId(lcId);
    });
  }, [api]);

  useEffect(() => {
    refreshText();
  }, [refreshText]);

  useEffect(() => {
    if (!api?.subscribeContentChange) {
      return;
    }
    return api.subscribeContentChange(() => {
      refreshText();
    });
  }, [api, refreshText]);

  const handleChange = (event: { target: HTMLTextAreaElement }) => {
    const nextValue = event.target.value;
    setValue(nextValue);
    if (selectedId && api?.updateElementText) {
      api.updateElementText(selectedId, nextValue);
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="lc-settingsSection">
      <div className="lc-settingsSectionTitle">要素</div>
      <div className="lc-formGroup">
        <label className="lc-formLabel" htmlFor={fieldId}>
          テキスト
        </label>
        <textarea
          id={fieldId}
          className="lc-formInput"
          rows={4}
          value={value}
          onChange={handleChange}
        />
      </div>
    </div>
  );
}
