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

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  return node;
}

function createSection(title: string) {
  const section = el('div', 'lc-settingsSection');
  const heading = el('div', 'lc-settingsSectionTitle');
  heading.textContent = title;
  section.append(heading);
  return section;
}

function createItem(label: string, valueText: string, onClick?: () => void, valueNode?: HTMLElement) {
  const row = el('div', 'lc-settingsItem');
  const labelEl = el('div', 'lc-settingsItemLabel');
  labelEl.textContent = label;
  const valueEl = el('div', 'lc-settingsItemValue');
  if (valueNode) {
    valueEl.append(valueNode);
  } else {
    valueEl.textContent = valueText;
  }

  row.append(labelEl, valueEl);

  if (onClick) {
    row.classList.add('is-clickable');
    row.tabIndex = 0;
    row.setAttribute('role', 'button');
    row.addEventListener('click', onClick);
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onClick();
      }
    });
  }

  return row;
}

function createModal(title: string) {
  const overlay = el('div', 'lc-modal');
  const backdrop = el('div', 'lc-modalBackdrop');
  const dialog = el('div', 'lc-modalDialog');
  const header = el('div', 'lc-modalHeader');
  const titleEl = el('div', 'lc-modalTitle');
  titleEl.textContent = title;
  const closeBtn = el('button', 'lc-modalClose');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  header.append(titleEl, closeBtn);

  const body = el('div', 'lc-modalBody');
  const footer = el('div', 'lc-modalFooter');
  const error = el('div', 'lc-modalError');

  dialog.append(header, body, error, footer);
  overlay.append(backdrop, dialog);
  document.body.append(overlay);

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      close();
    }
  };

  document.addEventListener('keydown', onKeyDown);

  backdrop.addEventListener('click', close);
  closeBtn.addEventListener('click', close);

  return { overlay, body, footer, error, close };
}

function formatDateForSave(value: string) {
  if (!value) return '';
  return `${value.replace('T', ' ')}:00`;
}

function getOptionLabel(options: SettingsOption[], value: string) {
  return options.find((option) => option.value === value)?.label || value || '-';
}

function createChipList(items: string[]) {
  const wrap = el('div', 'lc-chipList');
  if (!items.length) {
    const empty = el('span', 'lc-chipEmpty');
    empty.textContent = '未設定';
    wrap.append(empty);
    return wrap;
  }
  for (const item of items) {
    const chip = el('span', 'lc-chip');
    chip.textContent = item;
    wrap.append(chip);
  }
  return wrap;
}

export function initSettings(config: SettingsConfig) {
  const { container, restUrl, postId, apiFetch, backUrl } = config;
  let state: SettingsData = { ...config.data };

  if (!apiFetch) {
    container.textContent = 'Settings unavailable.';
    return;
  }

  const updateSettings = async (updates: Record<string, any>) => {
    const response = await apiFetch({
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
      state = response.settings as SettingsData;
    }

    render();
    return response;
  };

  const openStatusModal = () => {
    const modal = createModal('ステータスと公開範囲');
    const form = document.createElement('form');
    form.className = 'lc-modalForm';

    const statusGroup = el('div', 'lc-formGroup');
    const statusLabel = el('div', 'lc-formLabel');
    statusLabel.textContent = 'ステータス';
    statusGroup.append(statusLabel);

    state.statusOptions.forEach((option) => {
      const row = el('label', 'lc-radioRow');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'lc-status';
      radio.value = option.value;
      radio.checked = option.value === state.status;
      radio.disabled = option.value === 'publish' && !state.canPublish;
      const text = el('span', 'lc-radioText');
      text.textContent = option.label;
      row.append(radio, text);
      statusGroup.append(row);
    });

    const visibilityGroup = el('div', 'lc-formGroup');
    const visibilityLabel = el('div', 'lc-formLabel');
    visibilityLabel.textContent = '公開範囲';
    visibilityGroup.append(visibilityLabel);

    const visibilityOptions = [
      { value: 'public', label: '公開' },
      { value: 'private', label: '非公開' },
      { value: 'password', label: 'パスワード保護' },
    ];

    const passwordRow = el('div', 'lc-formRow');
    const passwordInput = document.createElement('input');
    passwordInput.type = 'text';
    passwordInput.className = 'lc-formInput';
    passwordInput.placeholder = 'パスワード';
    passwordInput.value = state.password || '';
    passwordRow.append(passwordInput);

    visibilityOptions.forEach((option) => {
      const row = el('label', 'lc-radioRow');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'lc-visibility';
      radio.value = option.value;
      radio.checked = option.value === state.visibility;
      row.append(radio, document.createTextNode(option.label));
      visibilityGroup.append(row);
    });

    const updatePasswordVisibility = () => {
      const selected = form.querySelector<HTMLInputElement>('input[name="lc-visibility"]:checked');
      if (selected?.value === 'password') {
        passwordRow.classList.add('is-visible');
      } else {
        passwordRow.classList.remove('is-visible');
      }
    };

    form.addEventListener('change', updatePasswordVisibility);
    updatePasswordVisibility();

    visibilityGroup.append(passwordRow);

    const actions = el('div', 'lc-modalActions');
    const cancel = el('button', 'lc-btn lc-btn-secondary');
    cancel.type = 'button';
    cancel.textContent = 'キャンセル';
    const save = el('button', 'lc-btn lc-btn-primary');
    save.type = 'submit';
    save.textContent = '保存';
    actions.append(cancel, save);

    cancel.addEventListener('click', modal.close);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      modal.error.textContent = '';
      try {
        const status = form.querySelector<HTMLInputElement>('input[name="lc-status"]:checked')?.value;
        const visibility = form.querySelector<HTMLInputElement>('input[name="lc-visibility"]:checked')?.value;
        const password = passwordInput.value;
        await updateSettings({ status, visibility, password });
        modal.close();
      } catch (err: any) {
        modal.error.textContent = err?.message || String(err);
      }
    });

    form.append(statusGroup, visibilityGroup, actions);
    modal.body.append(form);
  };

  const openPublishModal = () => {
    const modal = createModal('公開');
    const form = document.createElement('form');
    form.className = 'lc-modalForm';

    const row = el('div', 'lc-formGroup');
    const label = el('div', 'lc-formLabel');
    label.textContent = '公開日時';
    const input = document.createElement('input');
    input.type = 'datetime-local';
    input.className = 'lc-formInput';
    input.value = state.dateLocal || '';
    row.append(label, input);

    const actions = el('div', 'lc-modalActions');
    const cancel = el('button', 'lc-btn lc-btn-secondary');
    cancel.type = 'button';
    cancel.textContent = 'キャンセル';
    const save = el('button', 'lc-btn lc-btn-primary');
    save.type = 'submit';
    save.textContent = '保存';
    actions.append(cancel, save);

    cancel.addEventListener('click', modal.close);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      modal.error.textContent = '';
      try {
        const date = formatDateForSave(input.value);
        await updateSettings({ date });
        modal.close();
      } catch (err: any) {
        modal.error.textContent = err?.message || String(err);
      }
    });

    form.append(row, actions);
    modal.body.append(form);
  };

  const openSlugModal = () => {
    const modal = createModal('スラッグ');
    const form = document.createElement('form');
    form.className = 'lc-modalForm';

    const row = el('div', 'lc-formGroup');
    const label = el('div', 'lc-formLabel');
    label.textContent = 'スラッグ';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'lc-formInput';
    input.value = state.slug || '';
    row.append(label, input);

    const actions = el('div', 'lc-modalActions');
    const cancel = el('button', 'lc-btn lc-btn-secondary');
    cancel.type = 'button';
    cancel.textContent = 'キャンセル';
    const save = el('button', 'lc-btn lc-btn-primary');
    save.type = 'submit';
    save.textContent = '保存';
    actions.append(cancel, save);

    cancel.addEventListener('click', modal.close);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      modal.error.textContent = '';
      try {
        await updateSettings({ slug: input.value });
        modal.close();
      } catch (err: any) {
        modal.error.textContent = err?.message || String(err);
      }
    });

    form.append(row, actions);
    modal.body.append(form);
  };

  const openAuthorModal = () => {
    const modal = createModal('投稿者');
    const form = document.createElement('form');
    form.className = 'lc-modalForm';

    const row = el('div', 'lc-formGroup');
    const label = el('div', 'lc-formLabel');
    label.textContent = '投稿者';
    const select = document.createElement('select');
    select.className = 'lc-formSelect';
    state.authors.forEach((author) => {
      const option = document.createElement('option');
      option.value = String(author.id);
      option.textContent = author.name;
      option.selected = author.id === state.author;
      select.append(option);
    });
    row.append(label, select);

    const actions = el('div', 'lc-modalActions');
    const cancel = el('button', 'lc-btn lc-btn-secondary');
    cancel.type = 'button';
    cancel.textContent = 'キャンセル';
    const save = el('button', 'lc-btn lc-btn-primary');
    save.type = 'submit';
    save.textContent = '保存';
    actions.append(cancel, save);

    cancel.addEventListener('click', modal.close);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      modal.error.textContent = '';
      try {
        await updateSettings({ author: Number(select.value) });
        modal.close();
      } catch (err: any) {
        modal.error.textContent = err?.message || String(err);
      }
    });

    form.append(row, actions);
    modal.body.append(form);
  };

  const openTemplateModal = () => {
    const modal = createModal('テンプレート');
    const form = document.createElement('form');
    form.className = 'lc-modalForm';

    const row = el('div', 'lc-formGroup');
    const label = el('div', 'lc-formLabel');
    label.textContent = 'テンプレート';
    const select = document.createElement('select');
    select.className = 'lc-formSelect';
    state.templates.forEach((template) => {
      const option = document.createElement('option');
      option.value = template.value;
      option.textContent = template.label;
      option.selected = template.value === state.template;
      select.append(option);
    });
    row.append(label, select);

    const actions = el('div', 'lc-modalActions');
    const cancel = el('button', 'lc-btn lc-btn-secondary');
    cancel.type = 'button';
    cancel.textContent = 'キャンセル';
    const save = el('button', 'lc-btn lc-btn-primary');
    save.type = 'submit';
    save.textContent = '保存';
    actions.append(cancel, save);

    cancel.addEventListener('click', modal.close);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      modal.error.textContent = '';
      try {
        await updateSettings({ template: select.value });
        modal.close();
      } catch (err: any) {
        modal.error.textContent = err?.message || String(err);
      }
    });

    form.append(row, actions);
    modal.body.append(form);
  };

  const openDiscussionModal = () => {
    const modal = createModal('ディスカッション');
    const form = document.createElement('form');
    form.className = 'lc-modalForm';

    const row = el('div', 'lc-formGroup');
    const label = el('div', 'lc-formLabel');
    label.textContent = 'コメント';
    const commentRow = el('label', 'lc-checkboxRow');
    const commentBox = document.createElement('input');
    commentBox.type = 'checkbox';
    commentBox.checked = state.commentStatus === 'open';
    commentRow.append(commentBox, document.createTextNode('コメントを許可'));

    const pingRow = el('label', 'lc-checkboxRow');
    const pingBox = document.createElement('input');
    pingBox.type = 'checkbox';
    pingBox.checked = state.pingStatus === 'open';
    pingRow.append(pingBox, document.createTextNode('トラックバック/ピンバックを許可'));

    row.append(label, commentRow, pingRow);

    const actions = el('div', 'lc-modalActions');
    const cancel = el('button', 'lc-btn lc-btn-secondary');
    cancel.type = 'button';
    cancel.textContent = 'キャンセル';
    const save = el('button', 'lc-btn lc-btn-primary');
    save.type = 'submit';
    save.textContent = '保存';
    actions.append(cancel, save);

    cancel.addEventListener('click', modal.close);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      modal.error.textContent = '';
      try {
        await updateSettings({
          commentStatus: commentBox.checked ? 'open' : 'closed',
          pingStatus: pingBox.checked ? 'open' : 'closed',
        });
        modal.close();
      } catch (err: any) {
        modal.error.textContent = err?.message || String(err);
      }
    });

    form.append(row, actions);
    modal.body.append(form);
  };

  const openFormatModal = () => {
    const modal = createModal('フォーマット');
    const form = document.createElement('form');
    form.className = 'lc-modalForm';

    const row = el('div', 'lc-formGroup');
    const label = el('div', 'lc-formLabel');
    label.textContent = 'フォーマット';
    const select = document.createElement('select');
    select.className = 'lc-formSelect';
    state.formats.forEach((format) => {
      const option = document.createElement('option');
      option.value = format.value;
      option.textContent = format.label;
      option.selected = format.value === state.format;
      select.append(option);
    });
    row.append(label, select);

    const actions = el('div', 'lc-modalActions');
    const cancel = el('button', 'lc-btn lc-btn-secondary');
    cancel.type = 'button';
    cancel.textContent = 'キャンセル';
    const save = el('button', 'lc-btn lc-btn-primary');
    save.type = 'submit';
    save.textContent = '保存';
    actions.append(cancel, save);

    cancel.addEventListener('click', modal.close);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      modal.error.textContent = '';
      try {
        await updateSettings({ format: select.value });
        modal.close();
      } catch (err: any) {
        modal.error.textContent = err?.message || String(err);
      }
    });

    form.append(row, actions);
    modal.body.append(form);
  };

  const openFeaturedModal = () => {
    const modal = createModal('アイキャッチ画像');
    const form = document.createElement('form');
    form.className = 'lc-modalForm';

    const preview = el('div', 'lc-featurePreview');
    const img = document.createElement('img');
    img.alt = state.featuredImageAlt || '';
    img.src = state.featuredImageUrl || '';
    if (state.featuredImageUrl) {
      preview.append(img);
    } else {
      preview.textContent = '画像が設定されていません';
    }

    const selectRow = el('div', 'lc-formGroup');
    const selectLabel = el('div', 'lc-formLabel');
    selectLabel.textContent = '画像';
    const selectButton = el('button', 'lc-btn');
    selectButton.type = 'button';
    selectButton.textContent = 'メディアライブラリから選択';

    const idInput = document.createElement('input');
    idInput.type = 'number';
    idInput.className = 'lc-formInput';
    idInput.placeholder = '添付ファイルID';
    idInput.value = state.featuredImageId ? String(state.featuredImageId) : '';

    const media = (window as any).wp?.media;
    if (media) {
      selectButton.addEventListener('click', () => {
        const frame = media({
          title: 'アイキャッチ画像を選択',
          button: { text: '選択' },
          multiple: false,
        });
        frame.on('select', () => {
          const attachment = frame.state().get('selection').first()?.toJSON();
          if (!attachment) return;
          idInput.value = String(attachment.id || '');
          img.src = attachment.sizes?.medium?.url || attachment.url || '';
          img.alt = attachment.alt || '';
          if (!preview.contains(img)) {
            preview.textContent = '';
            preview.append(img);
          }
        });
        frame.open();
      });
    } else {
      selectButton.disabled = true;
    }

    selectRow.append(selectLabel, selectButton, idInput);

    const actions = el('div', 'lc-modalActions');
    const cancel = el('button', 'lc-btn lc-btn-secondary');
    cancel.type = 'button';
    cancel.textContent = 'キャンセル';
    const remove = el('button', 'lc-btn lc-btn-danger');
    remove.type = 'button';
    remove.textContent = '削除';
    remove.disabled = !state.featuredImageId;
    const save = el('button', 'lc-btn lc-btn-primary');
    save.type = 'submit';
    save.textContent = '保存';
    actions.append(cancel, remove, save);

    cancel.addEventListener('click', modal.close);
    remove.addEventListener('click', async () => {
      modal.error.textContent = '';
      try {
        await updateSettings({ featuredImageId: 0 });
        modal.close();
      } catch (err: any) {
        modal.error.textContent = err?.message || String(err);
      }
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      modal.error.textContent = '';
      try {
        const featuredImageId = Number(idInput.value || 0);
        await updateSettings({ featuredImageId });
        modal.close();
      } catch (err: any) {
        modal.error.textContent = err?.message || String(err);
      }
    });

    form.append(preview, selectRow, actions);
    modal.body.append(form);
  };

  const openCategoriesModal = () => {
    const modal = createModal('カテゴリー');
    const form = document.createElement('form');
    form.className = 'lc-modalForm';

    const list = el('div', 'lc-formGroup');
    const label = el('div', 'lc-formLabel');
    label.textContent = 'カテゴリー';
    list.append(label);

    const selected = new Set(state.categories);
    state.categoriesList.forEach((category) => {
      const row = el('label', 'lc-checkboxRow');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = String(category.id);
      checkbox.checked = selected.has(category.id);
      row.append(checkbox, document.createTextNode(category.name));
      list.append(row);
    });

    const newRow = el('div', 'lc-formGroup');
    const newLabel = el('div', 'lc-formLabel');
    newLabel.textContent = '新規カテゴリー';
    const newInput = document.createElement('input');
    newInput.type = 'text';
    newInput.className = 'lc-formInput';
    newInput.placeholder = 'カテゴリー名';
    newRow.append(newLabel, newInput);

    const actions = el('div', 'lc-modalActions');
    const cancel = el('button', 'lc-btn lc-btn-secondary');
    cancel.type = 'button';
    cancel.textContent = 'キャンセル';
    const save = el('button', 'lc-btn lc-btn-primary');
    save.type = 'submit';
    save.textContent = '保存';
    actions.append(cancel, save);

    cancel.addEventListener('click', modal.close);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      modal.error.textContent = '';
      try {
        const ids = Array.from(list.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
          .filter((input) => input.checked)
          .map((input) => Number(input.value));
        await updateSettings({
          categories: ids,
          newCategory: newInput.value.trim(),
        });
        modal.close();
      } catch (err: any) {
        modal.error.textContent = err?.message || String(err);
      }
    });

    form.append(list, newRow, actions);
    modal.body.append(form);
  };

  const openTagsModal = () => {
    const modal = createModal('タグ');
    const form = document.createElement('form');
    form.className = 'lc-modalForm';

    const row = el('div', 'lc-formGroup');
    const label = el('div', 'lc-formLabel');
    label.textContent = 'タグ';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'lc-formInput';
    input.placeholder = 'タグをカンマ区切りで入力';
    input.value = state.tags.join(', ');
    row.append(label, input);

    const hint = el('div', 'lc-formHint');
    hint.textContent = '例: landing, update, hero';
    row.append(hint);

    const actions = el('div', 'lc-modalActions');
    const cancel = el('button', 'lc-btn lc-btn-secondary');
    cancel.type = 'button';
    cancel.textContent = 'キャンセル';
    const save = el('button', 'lc-btn lc-btn-primary');
    save.type = 'submit';
    save.textContent = '保存';
    actions.append(cancel, save);

    cancel.addEventListener('click', modal.close);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      modal.error.textContent = '';
      try {
        const tags = input.value
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean);
        await updateSettings({ tags });
        modal.close();
      } catch (err: any) {
        modal.error.textContent = err?.message || String(err);
      }
    });

    form.append(row, actions);
    modal.body.append(form);
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

  const render = () => {
    container.innerHTML = '';

    const postSection = createSection('投稿');
    const statusText = `${getOptionLabel(state.statusOptions, state.status)} / ${
      state.visibility === 'private'
        ? '非公開'
        : state.visibility === 'password'
        ? 'パスワード保護'
        : '公開'
    }`;
    postSection.append(
      createItem('ステータスと公開範囲', statusText, openStatusModal),
      createItem('公開', state.dateLabel || '今すぐ', openPublishModal),
      createItem('スラッグ', state.slug || '-', openSlugModal),
      createItem(
        '投稿者',
        state.authors.find((author) => author.id === state.author)?.name || '-',
        openAuthorModal
      ),
      createItem(
        'テンプレート',
        getOptionLabel(state.templates, state.template),
        openTemplateModal
      ),
      createItem(
        'ディスカッション',
        state.commentStatus === 'open' ? '受付中' : '停止中',
        openDiscussionModal
      ),
      createItem('フォーマット', getOptionLabel(state.formats, state.format), openFormatModal)
    );

    if (state.canTrash) {
      const trashButton = el('button', 'lc-btn lc-btn-danger lc-settingsTrash');
      trashButton.type = 'button';
      trashButton.textContent = 'ゴミ箱へ移動';
      trashButton.addEventListener('click', handleTrash);
      postSection.append(trashButton);
    }

    const imageSection = createSection('アイキャッチ画像');
    const imageNode = state.featuredImageUrl
      ? (() => {
          const img = document.createElement('img');
          img.src = state.featuredImageUrl || '';
          img.alt = state.featuredImageAlt || '';
          img.className = 'lc-featureThumb';
          return img;
        })()
      : undefined;
    imageSection.append(
      createItem(
        'アイキャッチ画像',
        state.featuredImageUrl ? '変更' : '設定',
        openFeaturedModal,
        imageNode
      )
    );

    const categoriesSection = createSection('カテゴリー');
    const categoryNames = state.categoriesList
      .filter((category) => state.categories.includes(category.id))
      .map((category) => category.name);
    categoriesSection.append(
      createItem('カテゴリー', '', openCategoriesModal, createChipList(categoryNames))
    );

    const tagsSection = createSection('タグ');
    tagsSection.append(createItem('タグ', '', openTagsModal, createChipList(state.tags)));

    container.append(postSection, imageSection, categoriesSection, tagsSection);
  };

  render();
}
