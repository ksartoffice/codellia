import { createElement, Fragment, createRoot, render } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
  resolveDefaultTemplateMode,
  resolveTemplateMode,
  type DefaultTemplateMode,
  type TemplateMode,
} from '../logic/template-mode';
import type { SettingsData } from '../settings';
import type { ApiFetch } from '../types/api-fetch';

type SnackbarStatus = 'success' | 'error' | 'info' | 'warning';

type ModalControllerDeps = {
  apiFetch: ApiFetch;
  settingsRestUrl?: string;
  postId: number;
  getShadowDomEnabled: () => boolean;
  isThemeTemplateModeActive: () => boolean;
  getDefaultTemplateMode: () => DefaultTemplateMode;
  setTemplateModes: (templateMode: TemplateMode, defaultTemplateMode: DefaultTemplateMode) => void;
  applySettingsToSidebar: (settings: Partial<SettingsData>) => void;
  refreshPreview: () => void;
  createSnackbar: (
    status: SnackbarStatus,
    message: string,
    id?: string,
    autoDismissMs?: number
  ) => void;
  noticeIds: {
    templateFallback: string;
  };
  noticeErrorMs: number;
};

type ShadowHintModalProps = {
  title: string;
  lead: string;
  detail: string;
  note: string;
  code: string;
  closeLabel: string;
  copyLabel: string;
  onClose: () => void;
  onCopy: () => void;
};

type MissingMarkersModalProps = {
  title: string;
  body: string;
  actionLabel: string;
  inFlight: boolean;
  onConfirm: () => void;
};

function ShadowHintModal({
  title,
  lead,
  detail,
  note,
  code,
  closeLabel,
  copyLabel,
  onClose,
  onCopy,
}: ShadowHintModalProps) {
  return (
    <div className="cd-modal">
      <div className="cd-modalBackdrop" onClick={onClose} />
      <div className="cd-modalDialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="cd-modalHeader">
          <div className="cd-modalTitle">{title}</div>
          <button
            type="button"
            className="cd-modalClose"
            aria-label={closeLabel}
            onClick={onClose}
          >
            x
          </button>
        </div>
        <div className="cd-modalBody">
          <div className="cd-hintBody">
            <p className="cd-hintText">{lead}</p>
            <p className="cd-hintText">{detail}</p>
            <pre className="cd-hintCode">{code}</pre>
            <p className="cd-hintText">{note}</p>
          </div>
        </div>
        <div className="cd-modalActions">
          <button type="button" className="cd-btn cd-btn-secondary" onClick={onCopy}>
            {copyLabel}
          </button>
          <button type="button" className="cd-btn cd-btn-primary" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function MissingMarkersModal({
  title,
  body,
  actionLabel,
  inFlight,
  onConfirm,
}: MissingMarkersModalProps) {
  return (
    <div className="cd-modal">
      <div className="cd-modalBackdrop" />
      <div className="cd-modalDialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="cd-modalHeader">
          <div className="cd-modalTitle">{title}</div>
        </div>
        <div className="cd-modalBody">
          <p className="cd-hintText">{body}</p>
        </div>
        <div className="cd-modalActions">
          <button
            type="button"
            className="cd-btn cd-btn-primary"
            disabled={inFlight}
            onClick={onConfirm}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const closeLabel = __('Close', 'codellia');
  const copyLabel = __('Copy', 'codellia');
  const copiedLabel = __('Copied', 'codellia');

  const missingMarkersTitle = __('Theme template unavailable', 'codellia');
  const missingMarkersBody = __(
    'This theme does not output "the_content", so the preview cannot be rendered. Codellia will switch the template mode to Frame.',
    'codellia'
  );
  const missingMarkersActionLabel = __('OK', 'codellia');
  const missingMarkersRetryNotice = __(
    'Preview markers are still missing after switching template mode. The current template does not output "the_content".',
    'codellia'
  );
  const missingMarkersFallbackTemplateMode: 'standalone' | 'frame' = 'frame';

  let modalHost: HTMLDivElement | null = null;
  let modalRoot: ReturnType<typeof createRoot> | null = null;
  let shadowHintOpen = false;
  let shadowHintCopied = false;
  let shadowHintCopiedTimer: number | undefined;
  let missingMarkersOpen = false;
  let missingMarkersInFlight = false;
  let lastMissingMarkersNoticeAt = 0;
  const missingMarkersNoticeCooldownMs = 1500;

  const ensureMounted = () => {
    if (modalHost) {
      return;
    }
    modalHost = document.createElement('div');
    modalHost.className = 'cd-modalHost';
    document.body.appendChild(modalHost);
    if (typeof createRoot === 'function') {
      modalRoot = createRoot(modalHost);
    }
    window.addEventListener('keydown', handleKeydown);
  };

  const unmountIfIdle = () => {
    if (shadowHintOpen || missingMarkersOpen) {
      return;
    }
    window.removeEventListener('keydown', handleKeydown);
    window.clearTimeout(shadowHintCopiedTimer);
    shadowHintCopiedTimer = undefined;
    shadowHintCopied = false;
    if (modalRoot?.unmount) {
      modalRoot.unmount();
    } else if (modalHost) {
      render(<Fragment />, modalHost);
    }
    modalRoot = null;
    modalHost?.remove();
    modalHost = null;
  };

  const renderModals = () => {
    if (!modalHost) {
      return;
    }
    const node = (
      <Fragment>
        {shadowHintOpen ? (
          <ShadowHintModal
            title={shadowHintTitle}
            lead={shadowHintLead}
            detail={shadowHintDetail}
            note={shadowHintNote}
            code={shadowHintCode}
            closeLabel={closeLabel}
            copyLabel={shadowHintCopied ? copiedLabel : copyLabel}
            onClose={closeShadowHintModal}
            onCopy={() => {
              void copyShadowHintCode();
            }}
          />
        ) : null}
        {missingMarkersOpen ? (
          <MissingMarkersModal
            title={missingMarkersTitle}
            body={missingMarkersBody}
            actionLabel={missingMarkersActionLabel}
            inFlight={missingMarkersInFlight}
            onConfirm={() => {
              void confirmMissingMarkersFallback();
            }}
          />
        ) : null}
      </Fragment>
    );
    if (modalRoot) {
      modalRoot.render(node);
      return;
    }
    render(node, modalHost);
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') {
      return;
    }
    if (shadowHintOpen) {
      closeShadowHintModal();
    }
  };

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

  const copyShadowHintCode = async () => {
    const ok = await copyToClipboard(shadowHintCode);
    if (!ok || !shadowHintOpen) {
      return;
    }
    shadowHintCopied = true;
    renderModals();
    window.clearTimeout(shadowHintCopiedTimer);
    shadowHintCopiedTimer = window.setTimeout(() => {
      shadowHintCopied = false;
      if (shadowHintOpen) {
        renderModals();
      }
    }, 1400);
  };

  const closeShadowHintModal = () => {
    if (!shadowHintOpen) return;
    shadowHintOpen = false;
    shadowHintCopied = false;
    window.clearTimeout(shadowHintCopiedTimer);
    shadowHintCopiedTimer = undefined;
    renderModals();
    unmountIfIdle();
  };

  const openShadowHintModal = () => {
    if (shadowHintOpen || !deps.getShadowDomEnabled()) return;
    ensureMounted();
    shadowHintOpen = true;
    shadowHintCopied = false;
    renderModals();
  };

  const closeMissingMarkersModal = () => {
    if (!missingMarkersOpen) return;
    missingMarkersOpen = false;
    renderModals();
    unmountIfIdle();
  };

  const applyMissingMarkersTemplateMode = async () => {
    if (missingMarkersInFlight) {
      return false;
    }
    if (!deps.settingsRestUrl || !deps.apiFetch) {
      deps.createSnackbar(
        'error',
        __('Settings unavailable.', 'codellia'),
        deps.noticeIds.templateFallback,
        deps.noticeErrorMs
      );
      return false;
    }
    missingMarkersInFlight = true;
    renderModals();
    try {
      const response = await deps.apiFetch({
        url: deps.settingsRestUrl,
        method: 'POST',
        data: {
          post_id: deps.postId,
          updates: { templateMode: missingMarkersFallbackTemplateMode },
        },
      });
      if (!response?.ok) {
        deps.createSnackbar(
          'error',
          response?.error || __('Update failed.', 'codellia'),
          deps.noticeIds.templateFallback,
          deps.noticeErrorMs
        );
        return false;
      }
      const nextSettings = response.settings as SettingsData | undefined;
      const nextTemplateMode = resolveTemplateMode(
        nextSettings?.templateMode ?? missingMarkersFallbackTemplateMode
      );
      const nextDefaultTemplateMode =
        nextSettings && typeof nextSettings.defaultTemplateMode === 'string'
          ? resolveDefaultTemplateMode(nextSettings.defaultTemplateMode)
          : deps.getDefaultTemplateMode();
      deps.setTemplateModes(nextTemplateMode, nextDefaultTemplateMode);
      deps.applySettingsToSidebar(nextSettings ?? { templateMode: nextTemplateMode });
      deps.refreshPreview();
      return true;
    } catch (error: any) {
      deps.createSnackbar(
        'error',
        error?.message || __('Update failed.', 'codellia'),
        deps.noticeIds.templateFallback,
        deps.noticeErrorMs
      );
      return false;
    } finally {
      missingMarkersInFlight = false;
      renderModals();
    }
  };

  const confirmMissingMarkersFallback = async () => {
    if (missingMarkersInFlight) {
      return;
    }
    const ok = await applyMissingMarkersTemplateMode();
    if (ok) {
      closeMissingMarkersModal();
    }
  };

  const openMissingMarkersModal = () => {
    if (missingMarkersOpen) return;
    ensureMounted();
    missingMarkersOpen = true;
    renderModals();
  };

  const handleMissingMarkers = () => {
    if (deps.isThemeTemplateModeActive()) {
      openMissingMarkersModal();
      return;
    }

    const now = Date.now();
    if (now - lastMissingMarkersNoticeAt < missingMarkersNoticeCooldownMs) {
      return;
    }
    lastMissingMarkersNoticeAt = now;
    deps.createSnackbar(
      'error',
      missingMarkersRetryNotice,
      deps.noticeIds.templateFallback,
      deps.noticeErrorMs
    );
  };

  return {
    openShadowHintModal,
    closeShadowHintModal,
    handleMissingMarkers,
  };
}

