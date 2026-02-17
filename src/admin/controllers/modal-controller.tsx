import { createElement, Fragment, createRoot, render } from '@wordpress/element';
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

  const missingMarkersTitle = __('Theme layout unavailable', 'codellia');
  const missingMarkersBody = __(
    'This theme does not output "the_content", so the preview cannot be rendered. Codellia will switch the layout to Frame.',
    'codellia'
  );
  const missingMarkersActionLabel = __('OK', 'codellia');
  const missingMarkersFallbackLayout: 'standalone' | 'frame' = 'frame';

  let modalHost: HTMLDivElement | null = null;
  let modalRoot: ReturnType<typeof createRoot> | null = null;
  let shadowHintOpen = false;
  let shadowHintCopied = false;
  let shadowHintCopiedTimer: number | undefined;
  let missingMarkersOpen = false;
  let missingMarkersInFlight = false;
  let missingMarkersHandled = false;

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
    renderModals();
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
      renderModals();
    }
  };

  const confirmMissingMarkersFallback = async () => {
    if (missingMarkersInFlight) {
      return;
    }
    const ok = await applyMissingMarkersLayout();
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

