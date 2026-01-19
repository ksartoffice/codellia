import { createElement, useCallback, useEffect, useState } from '@wordpress/element';

export type ElementsSettingsAttribute = {
  name: string;
  value: string;
};

export type ElementsSettingsApi = {
  subscribeSelection: (listener: (lcId: string | null) => void) => () => void;
  subscribeContentChange: (listener: () => void) => () => void;
  getElementText: (lcId: string) => string | null;
  updateElementText: (lcId: string, text: string) => boolean;
  getElementAttributes?: (lcId: string) => ElementsSettingsAttribute[] | null;
  updateElementAttributes?: (lcId: string, attributes: ElementsSettingsAttribute[]) => boolean;
};

type ElementsSettingsPanelProps = {
  api?: ElementsSettingsApi;
};

export function ElementsSettingsPanel({ api }: ElementsSettingsPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [attributes, setAttributes] = useState<ElementsSettingsAttribute[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [hasText, setHasText] = useState(false);
  const fieldId = 'lc-elements-text';

  const refreshElement = useCallback(() => {
    if (!selectedId) {
      setValue('');
      setAttributes([]);
      setIsVisible(false);
      setHasText(false);
      return;
    }
    const nextText = api?.getElementText ? api.getElementText(selectedId) : null;
    const nextAttributes = api?.getElementAttributes
      ? api.getElementAttributes(selectedId)
      : null;
    const hasNextText = typeof nextText === 'string';
    const hasNextAttributes = Array.isArray(nextAttributes);
    setIsVisible(hasNextText || hasNextAttributes);
    setHasText(hasNextText);
    if (hasNextText) {
      setValue((prev) => (prev === nextText ? prev : nextText));
    } else {
      setValue('');
    }
    setAttributes(hasNextAttributes ? nextAttributes : []);
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
    refreshElement();
  }, [refreshElement]);

  useEffect(() => {
    if (!api?.subscribeContentChange) {
      return;
    }
    return api.subscribeContentChange(() => {
      refreshElement();
    });
  }, [api, refreshElement]);

  const handleChange = (event: { target: HTMLTextAreaElement }) => {
    const nextValue = event.target.value;
    setValue(nextValue);
    if (selectedId && api?.updateElementText) {
      api.updateElementText(selectedId, nextValue);
    }
  };

  const commitAttributes = useCallback(
    (nextAttributes: ElementsSettingsAttribute[]) => {
      setAttributes(nextAttributes);
      if (!selectedId || !api?.updateElementAttributes) {
        return;
      }
      const payload = nextAttributes
        .map((attr) => ({ name: attr.name.trim(), value: attr.value }))
        .filter((attr) => attr.name !== '');
      api.updateElementAttributes(selectedId, payload);
    },
    [api, selectedId]
  );

  const handleAttributeNameChange = (index: number, name: string) => {
    const sanitized = name.replace(/[^A-Za-z0-9:_.-]/g, '');
    const next = attributes.map((attr, idx) =>
      idx === index ? { ...attr, name: sanitized } : attr
    );
    commitAttributes(next);
  };

  const handleAttributeValueChange = (index: number, value: string) => {
    const next = attributes.map((attr, idx) =>
      idx === index ? { ...attr, value } : attr
    );
    commitAttributes(next);
  };

  const handleRemoveAttribute = (index: number) => {
    const next = attributes.filter((_, idx) => idx !== index);
    commitAttributes(next);
  };

  const handleAddAttribute = () => {
    setAttributes((prev) => [...prev, { name: '', value: '' }]);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="lc-settingsSection">
      <div className="lc-settingsSectionTitle">要素</div>
      {hasText ? (
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
      ) : null}
      <div className="lc-formGroup">
        <div className="lc-formLabel">属性</div>
        <div className="lc-settingsScriptList">
          {attributes.map((attr, index) => (
            <div className="lc-settingsScriptRow" key={`attr-${index}`}>
              <input
                type="text"
                className="lc-formInput lc-settingsAttrNameInput"
                placeholder="属性名"
                value={attr.name}
                onChange={(event) => handleAttributeNameChange(index, event.target.value)}
              />
              <input
                type="text"
                className="lc-formInput lc-settingsScriptInput"
                placeholder="値"
                value={attr.value}
                onChange={(event) => handleAttributeValueChange(index, event.target.value)}
              />
              <button
                className="lc-btn lc-btn-danger lc-settingsScriptButton"
                type="button"
                onClick={() => handleRemoveAttribute(index)}
                aria-label="属性を削除"
              >
                削除
              </button>
            </div>
          ))}
          <button
            className="lc-btn lc-btn-secondary lc-settingsScriptAdd"
            type="button"
            onClick={handleAddAttribute}
          >
            属性を追加
          </button>
        </div>
      </div>
    </div>
  );
}
