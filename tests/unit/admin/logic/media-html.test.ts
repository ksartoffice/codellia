import { describe, expect, it } from 'vitest';
import { buildMediaHtml } from '../../../../src/admin/logic/media-html';

describe('media html logic', () => {
  it('builds image html with escaped attributes', () => {
    const html = buildMediaHtml({
      type: 'image',
      url: 'https://example.com/image.jpg',
      alt: '"quote"',
    });

    expect(html).toContain('<img');
    expect(html).toContain('src="https://example.com/image.jpg"');
    expect(html).toContain('alt="&quot;quote&quot;"');
  });

  it('builds video html for video attachments', () => {
    const html = buildMediaHtml({
      type: 'video',
      url: 'https://example.com/video.mp4',
    });
    expect(html).toBe('<video controls src="https://example.com/video.mp4"></video>');
  });

  it('builds file link html and escapes label text', () => {
    const html = buildMediaHtml({
      type: 'application',
      url: 'https://example.com/file.pdf',
      title: { rendered: 'A < B' },
    });
    expect(html).toBe('<a href="https://example.com/file.pdf">A &lt; B</a>');
  });

  it('returns empty string when url is missing', () => {
    expect(buildMediaHtml({ type: 'file' })).toBe('');
  });
});
