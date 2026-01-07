import {
  createElement,
  Fragment,
  createPortal,
  createRoot,
  render,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from '@wordpress/element';

type SettingsOption = {
  value: string;
  label: string;
};

type SettingsAuthor = {
  id: number;
  name: string;
};

type SettingsCategory = {
  id: number;
  name: string;
};

export type SettingsData = {
  title: string;
  status: string;
  visibility: 'public' | 'private' | 'password';
  password?: string;
  dateLocal?: string;
  dateLabel?: string;
  slug: string;
  author: number;
  commentStatus: 'open' | 'closed';
  pingStatus: 'open' | 'closed';
  template: string;
  format: string;
  categories: number[];
  tags: string[];
  featuredImageId: number;
  featuredImageUrl?: string;
  featuredImageAlt?: string;
  statusOptions: SettingsOption[];
  authors: SettingsAuthor[];
  templates: SettingsOption[];
  formats: SettingsOption[];
  categoriesList: SettingsCategory[];
  canPublish: boolean;
  canTrash: boolean;
};

type SettingsConfig = {
  container: HTMLElement;
  data: SettingsData;
  restUrl: string;
  postId: number;
  backUrl?: string;
  apiFetch?: (args: any) => Promise<any>;
};

type UpdateResponse = {
  ok?: boolean;
  error?: string;
  settings?: SettingsData;
  redirectUrl?: string;
};

type UpdateSettings = (updates: Record<string, any>) => Promise<UpdateResponse>;

type ModalProps = {
  title: string;
  onClose: () => void;
  error?: string;
  children: JSX.Element | JSX.Element[];
};

type ActiveModal =
  | 'status'
  | 'publish'
  | 'slug'
  | 'author'
  | 'template'
  | 'discussion'
  | 'format'
  | 'featured'
  | 'categories'
  | 'tags'
  | null;

const VISIBILITY_OPTIONS = [
  { value: 'public', label: '公開' },
  { value: 'private', label: '非公開' },
  { value: 'password', label: 'パスワード保護' },
];

function formatDateForSave(value: string) {
  if (!value) return '';
  return `${value.replace('T', ' ')}:00`;
}

function getOptionLabel(options: SettingsOption[], value: string) {
  return options.find((option) => option.value === value)?.label || value || '-';
}

function getVisibilityLabel(value: SettingsData['visibility']) {
  return VISIBILITY_OPTIONS.find((option) => option.value === value)?.label || value;
}

function createChipList(items: string[]) {
  return (
    <div className="lc-chipList">
      {items.length ? (
        items.map((item) => (
          <span className="lc-chip" key={item}>
            {item}
          </span>
        ))
      ) : (
        <span className="lc-chipEmpty">未設定</span>
      )}
    </div>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="lc-settingsSection">
      <div className="lc-settingsSectionTitle">{title}</div>
      {children}
    </div>
  );
}

function SettingsItem({
  label,
  value,
  onClick,
}: {
  label: string;
  value: JSX.Element | string;
  onClick?: () => void;
}) {
  const handleKeyDown = (event: { key: string; preventDefault: () => void }) => {
    if (!onClick) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`lc-settingsItem${onClick ? ' is-clickable' : ''}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="lc-settingsItemLabel">{label}</div>
      <div className="lc-settingsItemValue">{value}</div>
    </div>
  );
}

function Modal({ title, onClose, error, children }: ModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="lc-modal">
      <div className="lc-modalBackdrop" onClick={onClose} />
      <div className="lc-modalDialog" role="dialog" aria-modal="true">
        <div className="lc-modalHeader">
          <div className="lc-modalTitle">{title}</div>
          <button className="lc-modalClose" type="button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="lc-modalBody">{children}</div>
        <div className="lc-modalError">{error || ''}</div>
      </div>
    </div>,
    document.body
  );
}

function StatusModal({
  settings,
  onClose,
  updateSettings,
}: {
  settings: SettingsData;
  onClose: () => void;
  updateSettings: UpdateSettings;
}) {
  const [status, setStatus] = useState(settings.status);
  const [visibility, setVisibility] = useState(settings.visibility);
  const [password, setPassword] = useState(settings.password || '');
  const [error, setError] = useState('');

  const onSubmit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setError('');
    try {
      await updateSettings({ status, visibility, password });
      onClose();
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  return (
    <Modal title="ステータスと公開範囲" onClose={onClose} error={error}>
      <form className="lc-modalForm" onSubmit={onSubmit}>
        <div className="lc-formGroup">
          <div className="lc-formLabel">ステータス</div>
          {settings.statusOptions.map((option) => (
            <label className="lc-radioRow" key={option.value}>
              <input
                type="radio"
                name="lc-status"
                value={option.value}
                checked={status === option.value}
                disabled={option.value === 'publish' && !settings.canPublish}
                onChange={() => setStatus(option.value)}
              />
              <span className="lc-radioText">{option.label}</span>
            </label>
          ))}
        </div>
        <div className="lc-formGroup">
          <div className="lc-formLabel">公開範囲</div>
          {VISIBILITY_OPTIONS.map((option) => (
            <label className="lc-radioRow" key={option.value}>
              <input
                type="radio"
                name="lc-visibility"
                value={option.value}
                checked={visibility === option.value}
                onChange={() => setVisibility(option.value as SettingsData['visibility'])}
              />
              <span>{option.label}</span>
            </label>
          ))}
          <div className={`lc-formRow${visibility === 'password' ? ' is-visible' : ''}`}>
            <input
              type="text"
              className="lc-formInput"
              placeholder="パスワード"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        </div>
        <div className="lc-modalActions">
          <button className="lc-btn lc-btn-secondary" type="button" onClick={onClose}>
            キャンセル
          </button>
          <button className="lc-btn lc-btn-primary" type="submit">
            保存
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PublishModal({
  settings,
  onClose,
  updateSettings,
}: {
  settings: SettingsData;
  onClose: () => void;
  updateSettings: UpdateSettings;
}) {
  const [date, setDate] = useState(settings.dateLocal || '');
  const [error, setError] = useState('');

  const onSubmit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setError('');
    try {
      await updateSettings({ date: formatDateForSave(date) });
      onClose();
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  return (
    <Modal title="公開" onClose={onClose} error={error}>
      <form className="lc-modalForm" onSubmit={onSubmit}>
        <div className="lc-formGroup">
          <div className="lc-formLabel">公開日時</div>
          <input
            type="datetime-local"
            className="lc-formInput"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <div className="lc-modalActions">
          <button className="lc-btn lc-btn-secondary" type="button" onClick={onClose}>
            キャンセル
          </button>
          <button className="lc-btn lc-btn-primary" type="submit">
            保存
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SlugModal({
  settings,
  onClose,
  updateSettings,
}: {
  settings: SettingsData;
  onClose: () => void;
  updateSettings: UpdateSettings;
}) {
  const [slug, setSlug] = useState(settings.slug || '');
  const [error, setError] = useState('');

  const onSubmit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setError('');
    try {
      await updateSettings({ slug });
      onClose();
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  return (
    <Modal title="スラッグ" onClose={onClose} error={error}>
      <form className="lc-modalForm" onSubmit={onSubmit}>
        <div className="lc-formGroup">
          <div className="lc-formLabel">スラッグ</div>
          <input
            type="text"
            className="lc-formInput"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
          />
        </div>
        <div className="lc-modalActions">
          <button className="lc-btn lc-btn-secondary" type="button" onClick={onClose}>
            キャンセル
          </button>
          <button className="lc-btn lc-btn-primary" type="submit">
            保存
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AuthorModal({
  settings,
  onClose,
  updateSettings,
}: {
  settings: SettingsData;
  onClose: () => void;
  updateSettings: UpdateSettings;
}) {
  const [author, setAuthor] = useState(String(settings.author));
  const [error, setError] = useState('');

  const onSubmit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setError('');
    try {
      await updateSettings({ author: Number(author) });
      onClose();
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  return (
    <Modal title="投稿者" onClose={onClose} error={error}>
      <form className="lc-modalForm" onSubmit={onSubmit}>
        <div className="lc-formGroup">
          <div className="lc-formLabel">投稿者</div>
          <select
            className="lc-formSelect"
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
          >
            {settings.authors.map((authorItem) => (
              <option key={authorItem.id} value={authorItem.id}>
                {authorItem.name}
              </option>
            ))}
          </select>
        </div>
        <div className="lc-modalActions">
          <button className="lc-btn lc-btn-secondary" type="button" onClick={onClose}>
            キャンセル
          </button>
          <button className="lc-btn lc-btn-primary" type="submit">
            保存
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TemplateModal({
  settings,
  onClose,
  updateSettings,
}: {
  settings: SettingsData;
  onClose: () => void;
  updateSettings: UpdateSettings;
}) {
  const [template, setTemplate] = useState(settings.template);
  const [error, setError] = useState('');

  const onSubmit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setError('');
    try {
      await updateSettings({ template });
      onClose();
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  return (
    <Modal title="テンプレート" onClose={onClose} error={error}>
      <form className="lc-modalForm" onSubmit={onSubmit}>
        <div className="lc-formGroup">
          <div className="lc-formLabel">テンプレート</div>
          <select
            className="lc-formSelect"
            value={template}
            onChange={(event) => setTemplate(event.target.value)}
          >
            {settings.templates.map((templateItem) => (
              <option key={templateItem.value} value={templateItem.value}>
                {templateItem.label}
              </option>
            ))}
          </select>
        </div>
        <div className="lc-modalActions">
          <button className="lc-btn lc-btn-secondary" type="button" onClick={onClose}>
            キャンセル
          </button>
          <button className="lc-btn lc-btn-primary" type="submit">
            保存
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DiscussionModal({
  settings,
  onClose,
  updateSettings,
}: {
  settings: SettingsData;
  onClose: () => void;
  updateSettings: UpdateSettings;
}) {
  const [commentOpen, setCommentOpen] = useState(settings.commentStatus === 'open');
  const [pingOpen, setPingOpen] = useState(settings.pingStatus === 'open');
  const [error, setError] = useState('');

  const onSubmit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setError('');
    try {
      await updateSettings({
        commentStatus: commentOpen ? 'open' : 'closed',
        pingStatus: pingOpen ? 'open' : 'closed',
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  return (
    <Modal title="ディスカッション" onClose={onClose} error={error}>
      <form className="lc-modalForm" onSubmit={onSubmit}>
        <div className="lc-formGroup">
          <div className="lc-formLabel">コメント</div>
          <label className="lc-checkboxRow">
            <input
              type="checkbox"
              checked={commentOpen}
              onChange={(event) => setCommentOpen(event.target.checked)}
            />
            コメントを許可
          </label>
          <label className="lc-checkboxRow">
            <input
              type="checkbox"
              checked={pingOpen}
              onChange={(event) => setPingOpen(event.target.checked)}
            />
            トラックバック/ピンバックを許可
          </label>
        </div>
        <div className="lc-modalActions">
          <button className="lc-btn lc-btn-secondary" type="button" onClick={onClose}>
            キャンセル
          </button>
          <button className="lc-btn lc-btn-primary" type="submit">
            保存
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FormatModal({
  settings,
  onClose,
  updateSettings,
}: {
  settings: SettingsData;
  onClose: () => void;
  updateSettings: UpdateSettings;
}) {
  const [format, setFormat] = useState(settings.format);
  const [error, setError] = useState('');

  const onSubmit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setError('');
    try {
      await updateSettings({ format });
      onClose();
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  return (
    <Modal title="フォーマット" onClose={onClose} error={error}>
      <form className="lc-modalForm" onSubmit={onSubmit}>
        <div className="lc-formGroup">
          <div className="lc-formLabel">フォーマット</div>
          <select
            className="lc-formSelect"
            value={format}
            onChange={(event) => setFormat(event.target.value)}
          >
            {settings.formats.map((formatItem) => (
              <option key={formatItem.value} value={formatItem.value}>
                {formatItem.label}
              </option>
            ))}
          </select>
        </div>
        <div className="lc-modalActions">
          <button className="lc-btn lc-btn-secondary" type="button" onClick={onClose}>
            キャンセル
          </button>
          <button className="lc-btn lc-btn-primary" type="submit">
            保存
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FeaturedModal({
  settings,
  onClose,
  updateSettings,
}: {
  settings: SettingsData;
  onClose: () => void;
  updateSettings: UpdateSettings;
}) {
  const [imageId, setImageId] = useState(
    settings.featuredImageId ? String(settings.featuredImageId) : ''
  );
  const [imageUrl, setImageUrl] = useState(settings.featuredImageUrl || '');
  const [imageAlt, setImageAlt] = useState(settings.featuredImageAlt || '');
  const [error, setError] = useState('');
  const media = (window as any).wp?.media;

  const handleSelect = () => {
    if (!media) return;
    const frame = media({
      title: 'アイキャッチ画像を選択',
      button: { text: '選択' },
      multiple: false,
    });
    frame.on('select', () => {
      const attachment = frame.state().get('selection').first()?.toJSON();
      if (!attachment) return;
      setImageId(String(attachment.id || ''));
      setImageUrl(attachment.sizes?.medium?.url || attachment.url || '');
      setImageAlt(attachment.alt || '');
    });
    frame.open();
  };

  const onSubmit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setError('');
    try {
      const featuredImageId = Number(imageId || 0);
      await updateSettings({ featuredImageId });
      onClose();
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  const handleRemove = async () => {
    setError('');
    try {
      await updateSettings({ featuredImageId: 0 });
      onClose();
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  return (
    <Modal title="アイキャッチ画像" onClose={onClose} error={error}>
      <form className="lc-modalForm" onSubmit={onSubmit}>
        <div className="lc-featurePreview">
          {imageUrl ? <img src={imageUrl} alt={imageAlt} /> : '画像が設定されていません'}
        </div>
        <div className="lc-formGroup">
          <div className="lc-formLabel">画像</div>
          <button className="lc-btn" type="button" onClick={handleSelect} disabled={!media}>
            メディアライブラリから選択
          </button>
          <input
            type="number"
            className="lc-formInput"
            placeholder="添付ファイルID"
            value={imageId}
            onChange={(event) => setImageId(event.target.value)}
          />
        </div>
        <div className="lc-modalActions">
          <button className="lc-btn lc-btn-secondary" type="button" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="lc-btn lc-btn-danger"
            type="button"
            onClick={handleRemove}
            disabled={!settings.featuredImageId}
          >
            削除
          </button>
          <button className="lc-btn lc-btn-primary" type="submit">
            保存
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CategoriesModal({
  settings,
  onClose,
  updateSettings,
}: {
  settings: SettingsData;
  onClose: () => void;
  updateSettings: UpdateSettings;
}) {
  const [selected, setSelected] = useState(() => new Set(settings.categories));
  const [newCategory, setNewCategory] = useState('');
  const [error, setError] = useState('');

  const toggleCategory = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const onSubmit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setError('');
    try {
      await updateSettings({
        categories: Array.from(selected),
        newCategory: newCategory.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  return (
    <Modal title="カテゴリー" onClose={onClose} error={error}>
      <form className="lc-modalForm" onSubmit={onSubmit}>
        <div className="lc-formGroup">
          <div className="lc-formLabel">カテゴリー</div>
          {settings.categoriesList.map((category) => (
            <label className="lc-checkboxRow" key={category.id}>
              <input
                type="checkbox"
                checked={selected.has(category.id)}
                onChange={() => toggleCategory(category.id)}
              />
              {category.name}
            </label>
          ))}
        </div>
        <div className="lc-formGroup">
          <div className="lc-formLabel">新規カテゴリー</div>
          <input
            type="text"
            className="lc-formInput"
            placeholder="カテゴリー名"
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
          />
        </div>
        <div className="lc-modalActions">
          <button className="lc-btn lc-btn-secondary" type="button" onClick={onClose}>
            キャンセル
          </button>
          <button className="lc-btn lc-btn-primary" type="submit">
            保存
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TagsModal({
  settings,
  onClose,
  updateSettings,
}: {
  settings: SettingsData;
  onClose: () => void;
  updateSettings: UpdateSettings;
}) {
  const [tags, setTags] = useState(settings.tags.join(', '));
  const [error, setError] = useState('');

  const onSubmit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setError('');
    try {
      await updateSettings({
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  return (
    <Modal title="タグ" onClose={onClose} error={error}>
      <form className="lc-modalForm" onSubmit={onSubmit}>
        <div className="lc-formGroup">
          <div className="lc-formLabel">タグ</div>
          <input
            type="text"
            className="lc-formInput"
            placeholder="タグをカンマ区切りで入力"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />
          <div className="lc-formHint">例: landing, update, hero</div>
        </div>
        <div className="lc-modalActions">
          <button className="lc-btn lc-btn-secondary" type="button" onClick={onClose}>
            キャンセル
          </button>
          <button className="lc-btn lc-btn-primary" type="submit">
            保存
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SettingsSidebar({ data, restUrl, postId, backUrl, apiFetch }: SettingsConfig) {
  const [settings, setSettings] = useState<SettingsData>({ ...data });
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [titleDraft, setTitleDraft] = useState(settings.title || '');
  const [titleError, setTitleError] = useState('');

  useEffect(() => {
    setTitleDraft(settings.title || '');
  }, [settings.title]);

  const updateSettings = useCallback(
    async (updates: Record<string, any>) => {
      const response = await apiFetch?.({
        url: restUrl,
        method: 'POST',
        data: {
          postId,
          updates,
        },
      });

      if (!response?.ok) {
        throw new Error(response?.error || 'Update failed.');
      }

      if (response?.settings) {
        setSettings(response.settings as SettingsData);
      }

      return response;
    },
    [apiFetch, restUrl, postId]
  );

  const handleTitleSave = async () => {
    setTitleError('');
    try {
      await updateSettings({ title: titleDraft });
    } catch (err: any) {
      setTitleError(err?.message || String(err));
    }
  };

  const handleTrash = async () => {
    if (!window.confirm('この投稿をゴミ箱へ移動しますか？')) {
      return;
    }
    try {
      const response = await updateSettings({ status: 'trash' });
      if (response?.redirectUrl) {
        window.location.href = response.redirectUrl;
      } else if (backUrl) {
        window.location.href = backUrl;
      }
    } catch (err: any) {
      window.alert(err?.message || String(err));
    }
  };

  const statusText = useMemo(
    () => `${getOptionLabel(settings.statusOptions, settings.status)} / ${getVisibilityLabel(settings.visibility)}`,
    [settings.statusOptions, settings.status, settings.visibility]
  );

  const categoryNames = useMemo(
    () =>
      settings.categoriesList
        .filter((category) => settings.categories.includes(category.id))
        .map((category) => category.name),
    [settings.categories, settings.categoriesList]
  );

  return (
    <Fragment>
      <div className="lc-settingsTitle">
        <div className="lc-settingsTitleLabel">タイトル</div>
        <div className="lc-settingsTitleRow">
          <input
            type="text"
            className="lc-formInput lc-settingsTitleInput"
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleTitleSave();
              }
            }}
          />
          <button
            className="lc-btn lc-btn-primary lc-settingsTitleSave"
            type="button"
            onClick={handleTitleSave}
            disabled={titleDraft === settings.title}
          >
            保存
          </button>
        </div>
        <div className="lc-settingsTitleError">{titleError}</div>
      </div>

      <SettingsSection title="投稿">
        <SettingsItem label="ステータスと公開範囲" value={statusText} onClick={() => setActiveModal('status')} />
        <SettingsItem
          label="公開"
          value={settings.dateLabel || '今すぐ'}
          onClick={() => setActiveModal('publish')}
        />
        <SettingsItem label="スラッグ" value={settings.slug || '-'} onClick={() => setActiveModal('slug')} />
        <SettingsItem
          label="投稿者"
          value={settings.authors.find((author) => author.id === settings.author)?.name || '-'}
          onClick={() => setActiveModal('author')}
        />
        <SettingsItem
          label="テンプレート"
          value={getOptionLabel(settings.templates, settings.template)}
          onClick={() => setActiveModal('template')}
        />
        <SettingsItem
          label="ディスカッション"
          value={settings.commentStatus === 'open' ? '受付中' : '停止中'}
          onClick={() => setActiveModal('discussion')}
        />
        <SettingsItem
          label="フォーマット"
          value={getOptionLabel(settings.formats, settings.format)}
          onClick={() => setActiveModal('format')}
        />
        {settings.canTrash && (
          <button className="lc-btn lc-btn-danger lc-settingsTrash" type="button" onClick={handleTrash}>
            ゴミ箱へ移動
          </button>
        )}
      </SettingsSection>

      <SettingsSection title="アイキャッチ画像">
        <SettingsItem
          label="アイキャッチ画像"
          value={
            settings.featuredImageUrl ? (
              <img
                src={settings.featuredImageUrl}
                alt={settings.featuredImageAlt || ''}
                className="lc-featureThumb"
              />
            ) : (
              '設定'
            )
          }
          onClick={() => setActiveModal('featured')}
        />
      </SettingsSection>

      <SettingsSection title="カテゴリー">
        <SettingsItem
          label="カテゴリー"
          value={createChipList(categoryNames)}
          onClick={() => setActiveModal('categories')}
        />
      </SettingsSection>

      <SettingsSection title="タグ">
        <SettingsItem label="タグ" value={createChipList(settings.tags)} onClick={() => setActiveModal('tags')} />
      </SettingsSection>

      {activeModal === 'status' ? (
        <StatusModal settings={settings} onClose={() => setActiveModal(null)} updateSettings={updateSettings} />
      ) : null}
      {activeModal === 'publish' ? (
        <PublishModal settings={settings} onClose={() => setActiveModal(null)} updateSettings={updateSettings} />
      ) : null}
      {activeModal === 'slug' ? (
        <SlugModal settings={settings} onClose={() => setActiveModal(null)} updateSettings={updateSettings} />
      ) : null}
      {activeModal === 'author' ? (
        <AuthorModal settings={settings} onClose={() => setActiveModal(null)} updateSettings={updateSettings} />
      ) : null}
      {activeModal === 'template' ? (
        <TemplateModal settings={settings} onClose={() => setActiveModal(null)} updateSettings={updateSettings} />
      ) : null}
      {activeModal === 'discussion' ? (
        <DiscussionModal settings={settings} onClose={() => setActiveModal(null)} updateSettings={updateSettings} />
      ) : null}
      {activeModal === 'format' ? (
        <FormatModal settings={settings} onClose={() => setActiveModal(null)} updateSettings={updateSettings} />
      ) : null}
      {activeModal === 'featured' ? (
        <FeaturedModal settings={settings} onClose={() => setActiveModal(null)} updateSettings={updateSettings} />
      ) : null}
      {activeModal === 'categories' ? (
        <CategoriesModal settings={settings} onClose={() => setActiveModal(null)} updateSettings={updateSettings} />
      ) : null}
      {activeModal === 'tags' ? (
        <TagsModal settings={settings} onClose={() => setActiveModal(null)} updateSettings={updateSettings} />
      ) : null}
    </Fragment>
  );
}

export function initSettings(config: SettingsConfig) {
  const { container, apiFetch } = config;

  if (!apiFetch) {
    container.textContent = 'Settings unavailable.';
    return;
  }

  const root = typeof createRoot === 'function' ? createRoot(container) : null;
  const node = <SettingsSidebar {...config} />;
  if (root) {
    root.render(node);
  } else {
    render(node, container);
  }
}
