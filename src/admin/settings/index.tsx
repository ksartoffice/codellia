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
import { __ } from '@wordpress/i18n';
import { DesignSettingsPanel } from './design-settings';
import { ElementsSettingsPanel, type ElementsSettingsApi } from './elements-settings';

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
  jsEnabled: boolean;
  shadowDomEnabled: boolean;
  shortcodeEnabled: boolean;
  liveHighlightEnabled: boolean;
  canEditJavaScript: boolean;
  externalScripts: string[];
  externalStyles: string[];
};

type SettingsConfig = {
  container: HTMLElement;
  header?: HTMLElement;
  data: SettingsData;
  restUrl: string;
  postId: number;
  backUrl?: string;
  apiFetch?: (args: any) => Promise<any>;
  onJavaScriptToggle?: (enabled: boolean) => void;
  onShadowDomToggle?: (enabled: boolean) => void;
  onShortcodeToggle?: (enabled: boolean) => void;
  onLiveHighlightToggle?: (enabled: boolean) => void;
  onExternalScriptsChange?: (scripts: string[]) => void;
  onExternalStylesChange?: (styles: string[]) => void;
  onTabChange?: (tab: SettingsTab) => void;
  onClosePanel?: () => void;
  elementsApi?: ElementsSettingsApi;
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

type SettingsTab = 'post' | 'design' | 'elements';

const VISIBILITY_OPTIONS = [
  { value: 'public', label: __( 'Public', 'wp-livecode' ) },
  { value: 'private', label: __( 'Private', 'wp-livecode' ) },
  { value: 'password', label: __( 'Password protected', 'wp-livecode' ) },
];

function getErrorMessage(error: unknown, fallback = __( 'Update failed.', 'wp-livecode' )) {
  if (typeof error === 'string' && error.trim()) return error;
  if (error instanceof Error) {
    if (error.message && error.message !== '[object Object]') return error.message;
    const cause = (error as { cause?: unknown }).cause;
    if (cause) return getErrorMessage(cause, fallback);
  }
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
    const errorField = (error as { error?: unknown }).error;
    if (typeof errorField === 'string' && errorField.trim()) return errorField;
    const nestedMessage = (errorField as { message?: unknown })?.message;
    if (typeof nestedMessage === 'string' && nestedMessage.trim()) return nestedMessage;
  }
  return fallback;
}

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
        <span className="lc-chipEmpty">{__( 'Not set', 'wp-livecode' )}</span>
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
          <button
            className="lc-modalClose"
            type="button"
            onClick={onClose}
            aria-label={__( 'Close', 'wp-livecode' )}
          >
            ÁE
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
    <Modal title={__( 'Status & visibility', 'wp-livecode' )} onClose={onClose} error={error}>
      <form className="lc-modalForm" onSubmit={onSubmit}>
        <div className="lc-formGroup">
          <div className="lc-formLabel">{__( 'Status', 'wp-livecode' )}</div>
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
          <div className="lc-formLabel">{__( 'Visibility', 'wp-livecode' )}</div>
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
              placeholder={__( 'Password', 'wp-livecode' )}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        </div>
        <div className="lc-modalActions">
          <button className="lc-btn lc-btn-secondary" type="button" onClick={onClose}>
            {__( 'Cancel', 'wp-livecode' )}
          </button>
          <button className="lc-btn lc-btn-primary" type="submit">
            {__( 'Save', 'wp-livecode' )}
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
    <Modal title={__( 'Publish', 'wp-livecode' )} onClose={onClose} error={error}>
      <form className="lc-modalForm" onSubmit={onSubmit}>
        <div className="lc-formGroup">
          <div className="lc-formLabel">{__( 'Publish date', 'wp-livecode' )}</div>
          <input
            type="datetime-local"
            className="lc-formInput"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <div className="lc-modalActions">
          <button className="lc-btn lc-btn-secondary" type="button" onClick={onClose}>
            {__( 'Cancel', 'wp-livecode' )}
          </button>
          <button className="lc-btn lc-btn-primary" type="submit">
            {__( 'Save', 'wp-livecode' )}
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
    <Modal title={__( 'Slug', 'wp-livecode' )} onClose={onClose} error={error}>
      <form className="lc-modalForm" onSubmit={onSubmit}>
        <div className="lc-formGroup">
          <div className="lc-formLabel">{__( 'Slug', 'wp-livecode' )}</div>
          <input
            type="text"
            className="lc-formInput"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
          />
        </div>
        <div className="lc-modalActions">
          <button className="lc-btn lc-btn-secondary" type="button" onClick={onClose}>
            {__( 'Cancel', 'wp-livecode' )}
          </button>
          <button className="lc-btn lc-btn-primary" type="submit">
            {__( 'Save', 'wp-livecode' )}
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
    <Modal title={__( 'Author', 'wp-livecode' )} onClose={onClose} error={error}>
      <form className="lc-modalForm" onSubmit={onSubmit}>
        <div className="lc-formGroup">
          <div className="lc-formLabel">{__( 'Author', 'wp-livecode' )}</div>
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
            {__( 'Cancel', 'wp-livecode' )}
          </button>
          <button className="lc-btn lc-btn-primary" type="submit">
            {__( 'Save', 'wp-livecode' )}
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
    <Modal title={__( 'Template', 'wp-livecode' )} onClose={onClose} error={error}>
      <form className="lc-modalForm" onSubmit={onSubmit}>
        <div className="lc-formGroup">
          <div className="lc-formLabel">{__( 'Template', 'wp-livecode' )}</div>
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
            {__( 'Cancel', 'wp-livecode' )}
          </button>
          <button className="lc-btn lc-btn-primary" type="submit">
            {__( 'Save', 'wp-livecode' )}
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
    <Modal title={__( 'Discussion', 'wp-livecode' )} onClose={onClose} error={error}>
      <form className="lc-modalForm" onSubmit={onSubmit}>
        <div className="lc-formGroup">
          <div className="lc-formLabel">{__( 'Comments', 'wp-livecode' )}</div>
          <label className="lc-checkboxRow">
            <input
              type="checkbox"
              checked={commentOpen}
              onChange={(event) => setCommentOpen(event.target.checked)}
            />
            {__( 'Allow comments', 'wp-livecode' )}
          </label>
          <label className="lc-checkboxRow">
            <input
              type="checkbox"
              checked={pingOpen}
              onChange={(event) => setPingOpen(event.target.checked)}
            />
            {__( 'Allow trackbacks/pingbacks', 'wp-livecode' )}
          </label>
        </div>
        <div className="lc-modalActions">
          <button className="lc-btn lc-btn-secondary" type="button" onClick={onClose}>
            {__( 'Cancel', 'wp-livecode' )}
          </button>
          <button className="lc-btn lc-btn-primary" type="submit">
            {__( 'Save', 'wp-livecode' )}
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
    <Modal title={__( 'Format', 'wp-livecode' )} onClose={onClose} error={error}>
      <form className="lc-modalForm" onSubmit={onSubmit}>
        <div className="lc-formGroup">
          <div className="lc-formLabel">{__( 'Format', 'wp-livecode' )}</div>
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
            {__( 'Cancel', 'wp-livecode' )}
          </button>
          <button className="lc-btn lc-btn-primary" type="submit">
            {__( 'Save', 'wp-livecode' )}
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
      title: __( 'Select featured image', 'wp-livecode' ),
      button: { text: __( 'Select', 'wp-livecode' ) },
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
    <Modal title={__( 'Featured image', 'wp-livecode' )} onClose={onClose} error={error}>
      <form className="lc-modalForm" onSubmit={onSubmit}>
        <div className="lc-featurePreview">
          {imageUrl ? (
            <img src={imageUrl} alt={imageAlt} />
          ) : (
            __( 'No image set.', 'wp-livecode' )
          )}
        </div>
        <div className="lc-formGroup">
          <div className="lc-formLabel">{__( 'Image', 'wp-livecode' )}</div>
          <button className="lc-btn" type="button" onClick={handleSelect} disabled={!media}>
            {__( 'Select from media library', 'wp-livecode' )}
          </button>
          <input
            type="number"
            className="lc-formInput"
            placeholder={__( 'Attachment ID', 'wp-livecode' )}
            value={imageId}
            onChange={(event) => setImageId(event.target.value)}
          />
        </div>
        <div className="lc-modalActions">
          <button className="lc-btn lc-btn-secondary" type="button" onClick={onClose}>
            {__( 'Cancel', 'wp-livecode' )}
          </button>
          <button
            className="lc-btn lc-btn-danger"
            type="button"
            onClick={handleRemove}
            disabled={!settings.featuredImageId}
          >
            {__( 'Remove', 'wp-livecode' )}
          </button>
          <button className="lc-btn lc-btn-primary" type="submit">
            {__( 'Save', 'wp-livecode' )}
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
    <Modal title={__( 'Categories', 'wp-livecode' )} onClose={onClose} error={error}>
      <form className="lc-modalForm" onSubmit={onSubmit}>
        <div className="lc-formGroup">
          <div className="lc-formLabel">{__( 'Categories', 'wp-livecode' )}</div>
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
          <div className="lc-formLabel">{__( 'New category', 'wp-livecode' )}</div>
          <input
            type="text"
            className="lc-formInput"
            placeholder={__( 'Category name', 'wp-livecode' )}
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
          />
        </div>
        <div className="lc-modalActions">
          <button className="lc-btn lc-btn-secondary" type="button" onClick={onClose}>
            {__( 'Cancel', 'wp-livecode' )}
          </button>
          <button className="lc-btn lc-btn-primary" type="submit">
            {__( 'Save', 'wp-livecode' )}
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
    <Modal title={__( 'Tags', 'wp-livecode' )} onClose={onClose} error={error}>
      <form className="lc-modalForm" onSubmit={onSubmit}>
        <div className="lc-formGroup">
          <div className="lc-formLabel">{__( 'Tags', 'wp-livecode' )}</div>
          <input
            type="text"
            className="lc-formInput"
            placeholder={__( 'Enter tags separated by commas', 'wp-livecode' )}
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />
          <div className="lc-formHint">
            {__( 'Example: landing, update, hero', 'wp-livecode' )}
          </div>
        </div>
        <div className="lc-modalActions">
          <button className="lc-btn lc-btn-secondary" type="button" onClick={onClose}>
            {__( 'Cancel', 'wp-livecode' )}
          </button>
          <button className="lc-btn lc-btn-primary" type="submit">
            {__( 'Save', 'wp-livecode' )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SettingsSidebar({
  data,
  restUrl,
  postId,
  backUrl,
  apiFetch,
  header,
  onJavaScriptToggle,
  onShadowDomToggle,
  onShortcodeToggle,
  onLiveHighlightToggle,
  onExternalScriptsChange,
  onExternalStylesChange,
  onTabChange,
  onClosePanel,
  elementsApi,
}: SettingsConfig) {
  const [settings, setSettings] = useState<SettingsData>({ ...data });
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('post');
  const resolveLiveHighlightEnabled = (value?: boolean) =>
    value === undefined ? true : Boolean(value);
  const [jsEnabled, setJsEnabled] = useState(Boolean(data.jsEnabled));
  const [shadowDomEnabled, setShadowDomEnabled] = useState(Boolean(data.shadowDomEnabled));
  const [shortcodeEnabled, setShortcodeEnabled] = useState(Boolean(data.shortcodeEnabled));
  const [liveHighlightEnabled, setLiveHighlightEnabled] = useState(
    resolveLiveHighlightEnabled(data.liveHighlightEnabled)
  );
  const [designError, setDesignError] = useState('');
  const [externalScripts, setExternalScripts] = useState<string[]>(data.externalScripts || []);
  const [externalScriptsError, setExternalScriptsError] = useState('');
  const [externalStyles, setExternalStyles] = useState<string[]>(data.externalStyles || []);
  const [externalStylesError, setExternalStylesError] = useState('');
  const [titleDraft, setTitleDraft] = useState(settings.title || '');
  const [titleError, setTitleError] = useState('');

  useEffect(() => {
    setTitleDraft(settings.title || '');
  }, [settings.title]);

  useEffect(() => {
    setJsEnabled(Boolean(settings.jsEnabled));
  }, [settings.jsEnabled]);

  useEffect(() => {
    setShadowDomEnabled(Boolean(settings.shadowDomEnabled));
  }, [settings.shadowDomEnabled]);

  useEffect(() => {
    setShortcodeEnabled(Boolean(settings.shortcodeEnabled));
  }, [settings.shortcodeEnabled]);

  useEffect(() => {
    setLiveHighlightEnabled(resolveLiveHighlightEnabled(settings.liveHighlightEnabled));
  }, [settings.liveHighlightEnabled]);

  useEffect(() => {
    onTabChange?.(activeTab);
  }, [activeTab, onTabChange]);

  useEffect(() => {
    const handleOpenElementsTab = () => {
      setActiveTab('elements');
      setActiveModal(null);
    };
    window.addEventListener('lc-open-elements-tab', handleOpenElementsTab);
    return () => {
      window.removeEventListener('lc-open-elements-tab', handleOpenElementsTab);
    };
  }, []);

  useEffect(() => {
    setExternalScripts(settings.externalScripts || []);
    onExternalScriptsChange?.(settings.externalScripts || []);
  }, [settings.externalScripts, onExternalScriptsChange]);

  useEffect(() => {
    setExternalStyles(settings.externalStyles || []);
    onExternalStylesChange?.(settings.externalStyles || []);
  }, [settings.externalStyles, onExternalStylesChange]);

  useEffect(() => {
    onJavaScriptToggle?.(jsEnabled);
  }, [jsEnabled, onJavaScriptToggle]);

  useEffect(() => {
    onShadowDomToggle?.(shadowDomEnabled);
  }, [shadowDomEnabled, onShadowDomToggle]);

  useEffect(() => {
    onShortcodeToggle?.(shortcodeEnabled);
  }, [shortcodeEnabled, onShortcodeToggle]);

  useEffect(() => {
    onLiveHighlightToggle?.(liveHighlightEnabled);
  }, [liveHighlightEnabled, onLiveHighlightToggle]);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    setActiveModal(null);
  };

  const updateSettings = useCallback(
    async (updates: Record<string, any>) => {
      const response = await apiFetch?.({
        url: restUrl,
        method: 'POST',
        data: {
          post_id: postId,
          updates,
        },
      });

      if (!response?.ok) {
        throw new Error(getErrorMessage(response?.error, __( 'Update failed.', 'wp-livecode' )));
      }

      if (response?.settings) {
        setSettings(response.settings as SettingsData);
      }

      return response;
    },
    [apiFetch, restUrl, postId]
  );

  const canEditJavaScript = Boolean(settings.canEditJavaScript);

  const normalizeList = (list: string[]) =>
    list
      .map((entry) => entry.trim())
      .filter(Boolean);

  const isSameList = (left: string[], right: string[]) =>
    left.length === right.length && left.every((value, index) => value === right[index]);

  const handleJavaScriptToggle = async (enabled: boolean) => {
    if (!canEditJavaScript) {
      return;
    }
    setDesignError('');
    setJsEnabled(enabled);
    try {
      await updateSettings({ jsEnabled: enabled });
    } catch (err: any) {
      setDesignError(err?.message || String(err));
      setJsEnabled(Boolean(settings.jsEnabled));
    }
  };

  const handleShadowDomToggle = async (enabled: boolean) => {
    if (!canEditJavaScript) {
      return;
    }
    setDesignError('');
    setShadowDomEnabled(enabled);
    try {
      await updateSettings({ shadowDomEnabled: enabled });
    } catch (err: any) {
      setDesignError(err?.message || String(err));
      setShadowDomEnabled(Boolean(settings.shadowDomEnabled));
    }
  };

  const handleShortcodeToggle = async (enabled: boolean) => {
    if (!canEditJavaScript) {
      return;
    }
    setDesignError('');
    setShortcodeEnabled(enabled);
    try {
      await updateSettings({ shortcodeEnabled: enabled });
    } catch (err: any) {
      setDesignError(err?.message || String(err));
      setShortcodeEnabled(Boolean(settings.shortcodeEnabled));
    }
  };

  const handleLiveHighlightToggle = async (enabled: boolean) => {
    setDesignError('');
    setLiveHighlightEnabled(enabled);
    try {
      await updateSettings({ liveHighlightEnabled: enabled });
    } catch (err: any) {
      setDesignError(err?.message || String(err));
      setLiveHighlightEnabled(resolveLiveHighlightEnabled(settings.liveHighlightEnabled));
    }
  };

  const handleExternalScriptsChange = (next: string[]) => {
    setExternalScripts(next);
  };

  const handleExternalScriptsCommit = async (next: string[]) => {
    if (!canEditJavaScript) {
      return;
    }
    const normalizedNext = normalizeList(next);
    const normalizedCurrent = normalizeList(settings.externalScripts || []);
    if (isSameList(normalizedNext, normalizedCurrent)) {
      setExternalScripts(normalizedNext);
      return;
    }
    setExternalScriptsError('');
    setExternalScripts(next);
    try {
      await updateSettings({ externalScripts: normalizedNext });
    } catch (err: any) {
      setExternalScriptsError(getErrorMessage(err, __( 'Update failed.', 'wp-livecode' )));
      setExternalScripts(settings.externalScripts || []);
    }
  };

  const handleExternalStylesChange = (next: string[]) => {
    setExternalStyles(next);
  };

  const handleExternalStylesCommit = async (next: string[]) => {
    if (!canEditJavaScript) {
      return;
    }
    const normalizedNext = normalizeList(next);
    const normalizedCurrent = normalizeList(settings.externalStyles || []);
    if (isSameList(normalizedNext, normalizedCurrent)) {
      setExternalStyles(normalizedNext);
      return;
    }
    setExternalStylesError('');
    setExternalStyles(next);
    try {
      await updateSettings({ externalStyles: normalizedNext });
    } catch (err: any) {
      setExternalStylesError(getErrorMessage(err, __( 'Update failed.', 'wp-livecode' )));
      setExternalStyles(settings.externalStyles || []);
    }
  };

  const handleTitleSave = async () => {
    setTitleError('');
    try {
      await updateSettings({ title: titleDraft });
    } catch (err: any) {
      setTitleError(err?.message || String(err));
    }
  };

  const handleTrash = async () => {
    if (!window.confirm(__( 'Move this post to the trash?', 'wp-livecode' ))) {
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

  const tabs = (
    <div className="lc-settingsTabsRow">
      <div
        className="lc-settingsTabs"
        role="tablist"
        aria-label={__( 'Settings tabs', 'wp-livecode' )}
      >
        <button
          className={`lc-settingsTab${activeTab === 'post' ? ' is-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activeTab === 'post'}
          onClick={() => handleTabChange('post')}
        >
          {__( 'Post', 'wp-livecode' )}
        </button>
        <button
          className={`lc-settingsTab${activeTab === 'design' ? ' is-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activeTab === 'design'}
          onClick={() => handleTabChange('design')}
        >
          {__( 'Design', 'wp-livecode' )}
        </button>
        <button
          className={`lc-settingsTab${activeTab === 'elements' ? ' is-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activeTab === 'elements'}
          onClick={() => handleTabChange('elements')}
        >
          {__( 'Elements', 'wp-livecode' )}
        </button>
      </div>
      <button
        className="lc-settingsClose"
        type="button"
        aria-label={__( 'Close settings panel', 'wp-livecode' )}
        onClick={() => onClosePanel?.()}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-x-icon lucide-x"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  );

  const tabsNode = header ? createPortal(tabs, header) : tabs;

  return (
    <Fragment>
      {tabsNode}

      {activeTab === 'post' ? (
        <Fragment>
          <div className="lc-settingsTitle">
            <div className="lc-settingsTitleLabel">{__( 'Title', 'wp-livecode' )}</div>
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
                {__( 'Save', 'wp-livecode' )}
              </button>
            </div>
            <div className="lc-settingsTitleError">{titleError}</div>
          </div>

          <SettingsSection title={__( 'Post', 'wp-livecode' )}>
            <SettingsItem
              label={__( 'Status & visibility', 'wp-livecode' )}
              value={statusText}
              onClick={() => setActiveModal('status')}
            />
            <SettingsItem
              label={__( 'Publish', 'wp-livecode' )}
              value={settings.dateLabel || __( 'Immediately', 'wp-livecode' )}
              onClick={() => setActiveModal('publish')}
            />
            <SettingsItem
              label={__( 'Slug', 'wp-livecode' )}
              value={settings.slug || '-'}
              onClick={() => setActiveModal('slug')}
            />
            <SettingsItem
              label={__( 'Author', 'wp-livecode' )}
              value={settings.authors.find((author) => author.id === settings.author)?.name || '-'}
              onClick={() => setActiveModal('author')}
            />
            <SettingsItem
              label={__( 'Template', 'wp-livecode' )}
              value={getOptionLabel(settings.templates, settings.template)}
              onClick={() => setActiveModal('template')}
            />
            <SettingsItem
              label={__( 'Discussion', 'wp-livecode' )}
              value={
                settings.commentStatus === 'open'
                  ? __( 'Open', 'wp-livecode' )
                  : __( 'Closed', 'wp-livecode' )
              }
              onClick={() => setActiveModal('discussion')}
            />
            <SettingsItem
              label={__( 'Format', 'wp-livecode' )}
              value={getOptionLabel(settings.formats, settings.format)}
              onClick={() => setActiveModal('format')}
            />
            {settings.canTrash && (
              <button className="lc-btn lc-btn-danger lc-settingsTrash" type="button" onClick={handleTrash}>
                {__( 'Move to trash', 'wp-livecode' )}
              </button>
            )}
          </SettingsSection>

          <SettingsSection title={__( 'Featured image', 'wp-livecode' )}>
            <SettingsItem
              label={__( 'Featured image', 'wp-livecode' )}
              value={
                settings.featuredImageUrl ? (
                  <img
                    src={settings.featuredImageUrl}
                    alt={settings.featuredImageAlt || ''}
                    className="lc-featureThumb"
                  />
                ) : (
                  __( 'Set', 'wp-livecode' )
                )
              }
              onClick={() => setActiveModal('featured')}
            />
          </SettingsSection>

          <SettingsSection title={__( 'Categories', 'wp-livecode' )}>
            <SettingsItem
              label={__( 'Categories', 'wp-livecode' )}
              value={createChipList(categoryNames)}
              onClick={() => setActiveModal('categories')}
            />
          </SettingsSection>

          <SettingsSection title={__( 'Tags', 'wp-livecode' )}>
            <SettingsItem
              label={__( 'Tags', 'wp-livecode' )}
              value={createChipList(settings.tags)}
              onClick={() => setActiveModal('tags')}
            />
          </SettingsSection>
        </Fragment>
      ) : null}

      {activeTab === 'design' ? (
        <DesignSettingsPanel
          postId={postId}
          jsEnabled={jsEnabled}
          onToggleJavaScript={handleJavaScriptToggle}
          shadowDomEnabled={shadowDomEnabled}
          onToggleShadowDom={handleShadowDomToggle}
          shortcodeEnabled={shortcodeEnabled}
          onToggleShortcode={handleShortcodeToggle}
          liveHighlightEnabled={liveHighlightEnabled}
          onToggleLiveHighlight={handleLiveHighlightToggle}
          externalScripts={externalScripts}
          onChangeExternalScripts={handleExternalScriptsChange}
          onCommitExternalScripts={handleExternalScriptsCommit}
          externalStyles={externalStyles}
          onChangeExternalStyles={handleExternalStylesChange}
          onCommitExternalStyles={handleExternalStylesCommit}
          disabled={!canEditJavaScript}
          error={designError}
          externalScriptsError={externalScriptsError}
          externalStylesError={externalStylesError}
        />
      ) : null}

      {activeTab === 'elements' ? <ElementsSettingsPanel api={elementsApi} /> : null}

      {activeTab === 'post' && activeModal === 'status' ? (
        <StatusModal settings={settings} onClose={() => setActiveModal(null)} updateSettings={updateSettings} />
      ) : null}
      {activeTab === 'post' && activeModal === 'publish' ? (
        <PublishModal settings={settings} onClose={() => setActiveModal(null)} updateSettings={updateSettings} />
      ) : null}
      {activeTab === 'post' && activeModal === 'slug' ? (
        <SlugModal settings={settings} onClose={() => setActiveModal(null)} updateSettings={updateSettings} />
      ) : null}
      {activeTab === 'post' && activeModal === 'author' ? (
        <AuthorModal settings={settings} onClose={() => setActiveModal(null)} updateSettings={updateSettings} />
      ) : null}
      {activeTab === 'post' && activeModal === 'template' ? (
        <TemplateModal settings={settings} onClose={() => setActiveModal(null)} updateSettings={updateSettings} />
      ) : null}
      {activeTab === 'post' && activeModal === 'discussion' ? (
        <DiscussionModal settings={settings} onClose={() => setActiveModal(null)} updateSettings={updateSettings} />
      ) : null}
      {activeTab === 'post' && activeModal === 'format' ? (
        <FormatModal settings={settings} onClose={() => setActiveModal(null)} updateSettings={updateSettings} />
      ) : null}
      {activeTab === 'post' && activeModal === 'featured' ? (
        <FeaturedModal settings={settings} onClose={() => setActiveModal(null)} updateSettings={updateSettings} />
      ) : null}
      {activeTab === 'post' && activeModal === 'categories' ? (
        <CategoriesModal settings={settings} onClose={() => setActiveModal(null)} updateSettings={updateSettings} />
      ) : null}
      {activeTab === 'post' && activeModal === 'tags' ? (
        <TagsModal settings={settings} onClose={() => setActiveModal(null)} updateSettings={updateSettings} />
      ) : null}
    </Fragment>
  );
}

export function initSettings(config: SettingsConfig) {
  const { container, apiFetch } = config;

  if (!apiFetch) {
    container.textContent = __( 'Settings unavailable.', 'wp-livecode' );
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
