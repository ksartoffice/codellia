import { __ } from '@wordpress/i18n';
import {
  resolveDefaultLayout,
  resolveLayout,
  type DefaultLayoutMode,
  type LayoutMode,
} from '../domain/layout';
import type { SettingsData } from '../settings';
import type { ApiFetch } from '../types/api-fetch';

type SnackbarStatus = 'success' | 'error' | 'info' | 'warning';

type ModalControllerDeps = {
  apiFetch: ApiFetch;
  settingsRestUrl?: string;
  postId: number;
  getShadowDomEnabled: () => boolean;
  isThemeLayoutActive: () => boolean;
  getDefaultLayout: () => DefaultLayoutMode;
  setLayoutModes: (layout: LayoutMode, defaultLayout: DefaultLayoutMode) => void;
  applySettingsToSidebar: (settings: Partial<SettingsData>) => void;
  refreshPreview: () => void;
  createSnackbar: (
    status: SnackbarStatus,
    message: string,
    id?: string,
    autoDismissMs?: number
  ) => void;
  noticeIds: {
    layoutFallback: string;
  };
  noticeErrorMs: number;
};

export function createModalController(deps: ModalControllerDeps) {
  const shadowHintTitle = __('Shadow DOM Hint', 'codellia');
  const shadowHintLead = __(
    'When Shadow DOM is enabled, HTML is rendered inside the Shadow Root.',
    'codellia'
  );
  const shadowHintDetail = __(
    'Use the root below (scoped to this script) instead of document to query elements.',
    'codellia'
  );
  const shadowHintCode =
    "const root = document.currentScript?.closest('codellia-output')?.shadowRoot || document;";
  const shadowHintNote = __(
    'Note: root can be Document or ShadowRoot; create* APIs are only on Document.',
    'codellia'
  );

  const missingMarkersTitle = __('Theme layout unavailable', 'codellia');
  const missingMarkersBody = __(
    'This theme does not output "the_content", so the preview cannot be rendered. Codellia will switch the layout to Frame.',
    'codellia'
  );
  const missingMarkersActionLabel = __('OK', 'codellia');
  const missingMarkersFallbackLayout: 'standalone' | 'frame' = 'frame';

  let shadowHintModal: HTMLDivElement | null = null;
  let shadowHintModalKeyHandler: ((event: KeyboardEvent) => void) | null = null;

  let missingMarkersModal: HTMLDivElement | null = null;
  let missingMarkersInFlight = false;
  let missingMarkersHandled = false;

  const copyToClipboard = async (text: string): Promise<boolean> => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // fallback below
      }
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    textarea.remove();
    return ok;
  };

  const closeShadowHintModal = () => {
    if (!shadowHintModal) return;
    shadowHintModal.remove();
    shadowHintModal = null;
    if (shadowHintModalKeyHandler) {
      window.removeEventListener('keydown', shadowHintModalKeyHandler);
      shadowHintModalKeyHandler = null;
    }
  };

  const openShadowHintModal = () => {
    if (shadowHintModal || !deps.getShadowDomEnabled()) return;

    const modal = document.createElement('div');
    modal.className = 'cd-modal';
    const backdrop = document.createElement('div');
    backdrop.className = 'cd-modalBackdrop';
    backdrop.addEventListener('click', closeShadowHintModal);

    const dialog = document.createElement('div');
    dialog.className = 'cd-modalDialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', shadowHintTitle);

    const header = document.createElement('div');
    header.className = 'cd-modalHeader';
    const title = document.createElement('div');
    title.className = 'cd-modalTitle';
    title.textContent = shadowHintTitle;
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'cd-modalClose';
    closeButton.setAttribute('aria-label', __('Close', 'codellia'));
    closeButton.textContent = '×';
    closeButton.addEventListener('click', closeShadowHintModal);
    header.append(title, closeButton);

    const body = document.createElement('div');
    body.className = 'cd-modalBody';
    const bodyWrap = document.createElement('div');
    bodyWrap.className = 'cd-hintBody';
    const lead = document.createElement('p');
    lead.className = 'cd-hintText';
    lead.textContent = shadowHintLead;
    const detail = document.createElement('p');
    detail.className = 'cd-hintText';
    detail.textContent = shadowHintDetail;
    const codeBlock = document.createElement('pre');
    codeBlock.className = 'cd-hintCode';
    codeBlock.textContent = shadowHintCode;
    const note = document.createElement('p');
    note.className = 'cd-hintText';
    note.textContent = shadowHintNote;
    bodyWrap.append(lead, detail, codeBlock, note);
    body.append(bodyWrap);

    const actions = document.createElement('div');
    actions.className = 'cd-modalActions';
    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'cd-btn cd-btn-secondary';
    copyButton.textContent = __('Copy', 'codellia');
    copyButton.addEventListener('click', async () => {
      const ok = await copyToClipboard(shadowHintCode);
      if (ok) {
        copyButton.textContent = __('Copied', 'codellia');
        window.setTimeout(() => {
          copyButton.textContent = __('Copy', 'codellia');
        }, 1400);
      }
    });
    const closeAction = document.createElement('button');
    closeAction.type = 'button';
    closeAction.className = 'cd-btn cd-btn-primary';
    closeAction.textContent = __('Close', 'codellia');
    closeAction.addEventListener('click', closeShadowHintModal);
    actions.append(copyButton, closeAction);

    dialog.append(header, body, actions);
    modal.append(backdrop, dialog);
    document.body.appendChild(modal);
    shadowHintModal = modal;

    shadowHintModalKeyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeShadowHintModal();
      }
    };
    window.addEventListener('keydown', shadowHintModalKeyHandler);
  };

  const closeMissingMarkersModal = () => {
    if (!missingMarkersModal) return;
    missingMarkersModal.remove();
    missingMarkersModal = null;
  };

  const applyMissingMarkersLayout = async () => {
    if (missingMarkersInFlight) {
      return false;
    }
    if (!deps.settingsRestUrl || !deps.apiFetch) {
      deps.createSnackbar(
        'error',
        __('Settings unavailable.', 'codellia'),
        deps.noticeIds.layoutFallback,
        deps.noticeErrorMs
      );
      return false;
    }
    missingMarkersInFlight = true;
    try {
      const response = await deps.apiFetch({
        url: deps.settingsRestUrl,
        method: 'POST',
        data: {
          post_id: deps.postId,
          updates: { layout: missingMarkersFallbackLayout },
        },
      });
      if (!response?.ok) {
        deps.createSnackbar(
          'error',
          response?.error || __('Update failed.', 'codellia'),
          deps.noticeIds.layoutFallback,
          deps.noticeErrorMs
        );
        return false;
      }
      const nextSettings = response.settings as SettingsData | undefined;
      const nextLayout = resolveLayout(nextSettings?.layout ?? missingMarkersFallbackLayout);
      const nextDefaultLayout =
        nextSettings && typeof nextSettings.defaultLayout === 'string'
          ? resolveDefaultLayout(nextSettings.defaultLayout)
          : deps.getDefaultLayout();
      deps.setLayoutModes(nextLayout, nextDefaultLayout);
      deps.applySettingsToSidebar(nextSettings ?? { layout: nextLayout });
      deps.refreshPreview();
      missingMarkersHandled = true;
      return true;
    } catch (error: any) {
      deps.createSnackbar(
        'error',
        error?.message || __('Update failed.', 'codellia'),
        deps.noticeIds.layoutFallback,
        deps.noticeErrorMs
      );
      return false;
    } finally {
      missingMarkersInFlight = false;
    }
  };

  const openMissingMarkersModal = () => {
    if (missingMarkersModal) return;

    const modal = document.createElement('div');
    modal.className = 'cd-modal';
    const backdrop = document.createElement('div');
    backdrop.className = 'cd-modalBackdrop';

    const dialog = document.createElement('div');
    dialog.className = 'cd-modalDialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', missingMarkersTitle);

    const header = document.createElement('div');
    header.className = 'cd-modalHeader';
    const title = document.createElement('div');
    title.className = 'cd-modalTitle';
    title.textContent = missingMarkersTitle;
    header.append(title);

    const body = document.createElement('div');
    body.className = 'cd-modalBody';
    const bodyText = document.createElement('p');
    bodyText.className = 'cd-hintText';
    bodyText.textContent = missingMarkersBody;
    body.append(bodyText);

    const actions = document.createElement('div');
    actions.className = 'cd-modalActions';
    const okButton = document.createElement('button');
    okButton.type = 'button';
    okButton.className = 'cd-btn cd-btn-primary';
    okButton.textContent = missingMarkersActionLabel;
    okButton.addEventListener('click', async () => {
      if (missingMarkersInFlight) return;
      okButton.disabled = true;
      const ok = await applyMissingMarkersLayout();
      if (ok) {
        closeMissingMarkersModal();
        return;
      }
      okButton.disabled = false;
    });
    actions.append(okButton);

    dialog.append(header, body, actions);
    modal.append(backdrop, dialog);
    document.body.appendChild(modal);
    missingMarkersModal = modal;
  };

  const handleMissingMarkers = () => {
    if (missingMarkersHandled) return;
    if (!deps.isThemeLayoutActive()) return;
    openMissingMarkersModal();
  };

  return {
    openShadowHintModal,
    closeShadowHintModal,
    handleMissingMarkers,
  };
}
