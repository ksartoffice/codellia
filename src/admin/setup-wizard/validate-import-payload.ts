import { __ } from '@wordpress/i18n';
import type { ImportPayload } from '../types';

type ValidationResult = { data?: ImportPayload; error?: string };

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

export function validateImportPayload(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { error: __('Import file is not a valid JSON object.', 'codellia') };
  }

  const payload = raw as Record<string, unknown>;

  if (payload.version !== 1) {
    return { error: __('Unsupported import version.', 'codellia') };
  }

  if (typeof payload.html !== 'string') {
    return { error: __('Invalid HTML value.', 'codellia') };
  }

  if (typeof payload.css !== 'string') {
    return { error: __('Invalid CSS value.', 'codellia') };
  }

  if (typeof payload.tailwindEnabled !== 'boolean') {
    return { error: __('Invalid tailwindEnabled value.', 'codellia') };
  }

  if (payload.generatedCss !== undefined && typeof payload.generatedCss !== 'string') {
    return { error: __('Invalid generatedCss value.', 'codellia') };
  }

  if (payload.js !== undefined && typeof payload.js !== 'string') {
    return { error: __('Invalid JavaScript value.', 'codellia') };
  }

  if (payload.shadowDomEnabled !== undefined && typeof payload.shadowDomEnabled !== 'boolean') {
    return { error: __('Invalid shadowDomEnabled value.', 'codellia') };
  }

  if (payload.shortcodeEnabled !== undefined && typeof payload.shortcodeEnabled !== 'boolean') {
    return { error: __('Invalid shortcodeEnabled value.', 'codellia') };
  }

  if (payload.singlePageEnabled !== undefined && typeof payload.singlePageEnabled !== 'boolean') {
    return { error: __('Invalid singlePageEnabled value.', 'codellia') };
  }

  if (payload.liveHighlightEnabled !== undefined && typeof payload.liveHighlightEnabled !== 'boolean') {
    return { error: __('Invalid liveHighlightEnabled value.', 'codellia') };
  }

  if (payload.externalScripts !== undefined && !isStringArray(payload.externalScripts)) {
    return { error: __('Invalid externalScripts value.', 'codellia') };
  }

  if (payload.externalStyles !== undefined && !isStringArray(payload.externalStyles)) {
    return { error: __('Invalid externalStyles value.', 'codellia') };
  }

  return {
    data: {
      version: 1,
      html: payload.html,
      css: payload.css,
      tailwindEnabled: payload.tailwindEnabled,
      generatedCss: payload.generatedCss,
      js: payload.js ?? '',
      externalScripts: payload.externalScripts ?? [],
      externalStyles: payload.externalStyles ?? [],
      shadowDomEnabled: payload.shadowDomEnabled ?? false,
      shortcodeEnabled: payload.shortcodeEnabled ?? false,
      singlePageEnabled: payload.singlePageEnabled ?? true,
      liveHighlightEnabled: payload.liveHighlightEnabled as boolean | undefined,
    },
  };
}
