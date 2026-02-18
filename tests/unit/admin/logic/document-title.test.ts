import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildEditorDocumentTitleLabel,
  createDocumentTitleSync,
  extractAdminTitleSuffix,
} from '../../../../src/admin/logic/document-title';

describe('document title logic', () => {
  beforeEach(() => {
    document.title = 'Codellia < Test Site - WordPress';
  });

  it('builds editor title label with fallback', () => {
    expect(buildEditorDocumentTitleLabel('My Page')).toBe('Codellia Editor: My Page');
    expect(buildEditorDocumentTitleLabel('')).toBe('Codellia Editor: Untitled');
  });

  it('extracts admin suffix using configured separators', () => {
    expect(extractAdminTitleSuffix('Codellia < Test Site', [' < '])).toBe(' < Test Site');
    expect(extractAdminTitleSuffix('Codellia &lsaquo; Test Site', [' &lsaquo; '])).toBe(
      ' &lsaquo; Test Site'
    );
  });

  it('syncs document title while preserving suffix', () => {
    const sync = createDocumentTitleSync('Codellia < Test Site - WordPress', [' < ']);
    sync('Landing');
    expect(document.title).toBe('Codellia Editor: Landing < Test Site - WordPress');
  });
});
