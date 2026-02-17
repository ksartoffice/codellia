import type { SettingsData } from '../settings';

export type SetupResponse = {
  ok?: boolean;
  error?: string;
  tailwindEnabled?: boolean;
};

export type ImportResponse = {
  ok?: boolean;
  error?: string;
  html?: string;
  tailwindEnabled?: boolean;
  settingsData?: SettingsData;
  importWarnings?: string[];
  importedImages?: Array<{
    sourceUrl: string;
    attachmentId: number;
    attachmentUrl: string;
  }>;
};

export type SaveResponse = {
  ok?: boolean;
  error?: string;
  settings?: SettingsData;
};

export type CompileTailwindResponse = {
  ok?: boolean;
  error?: string;
  css?: string;
};
