import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildEditorDocumentTitleLabel,
  createDocumentTitleSync,
  extractAdminTitleSuffix,
} from '../../../../src/admin/logic/document-title';

describe('document title logic', () => {
  beforeEach(() => {
    document.title = 'CazeArt < Test Site - WordPress';
  });

  it('builds editor title label with fallback', () => {
    expect(buildEditorDocumentTitleLabel('My Page')).toBe('CazeArt Live Code Editor: My Page');
    expect(buildEditorDocumentTitleLabel('')).toBe('CazeArt Live Code Editor: Untitled');
  });

  it('extracts admin suffix using configured separators', () => {
    expect(extractAdminTitleSuffix('CazeArt < Test Site', [' < '])).toBe(' < Test Site');
    expect(extractAdminTitleSuffix('CazeArt &lsaquo; Test Site', [' &lsaquo; '])).toBe(
      ' &lsaquo; Test Site'
    );
  });

  it('syncs document title while preserving suffix', () => {
    const sync = createDocumentTitleSync('CazeArt < Test Site - WordPress', [' < ']);
    sync('Landing');
    expect(document.title).toBe('CazeArt Live Code Editor: Landing < Test Site - WordPress');
  });
});
