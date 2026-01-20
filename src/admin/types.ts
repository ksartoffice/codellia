import type { SettingsData } from './settings';

export type ImportPayload = {
  version: number;
  html: string;
  css: string;
  tailwind: boolean;
  generatedCss?: string;
  js?: string;
  jsEnabled?: boolean;
  externalScripts?: string[];
  externalStyles?: string[];
  shadowDomEnabled?: boolean;
  shortcodeEnabled?: boolean;
  liveHighlightEnabled?: boolean;
};

export type ImportResult = {
  payload: ImportPayload;
  settingsData?: SettingsData;
};

export type ExportPayload = {
  version: 1;
  html: string;
  css: string;
  tailwind: boolean;
  generatedCss: string;
  js: string;
  jsEnabled: boolean;
  externalScripts: string[];
  externalStyles: string[];
  shadowDomEnabled: boolean;
  shortcodeEnabled: boolean;
  liveHighlightEnabled: boolean;
};
