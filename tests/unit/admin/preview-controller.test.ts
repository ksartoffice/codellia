import { describe, expect, it, vi } from 'vitest';
import { createPreviewController } from '../../../src/admin/preview';

const flushAsync = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

function createModel(value: string) {
  return {
    getValue: () => value,
    deltaDecorations: () => [],
    getPositionAt: () => ({ lineNumber: 1, column: 1 }),
  };
}

describe('preview shortcode rendering', () => {
  it('re-renders shortcodes on every render request even when HTML is unchanged', async () => {
    const postMessage = vi.fn();
    const renderShortcodes = vi.fn().mockResolvedValue({ 'sc-1': '<div>rendered</div>' });
    const htmlModel = createModel('<div>[ez-toc]</div>');
    const cssModel = createModel('');
    const jsModel = createModel('');

    const controller = createPreviewController({
      iframe: { contentWindow: { postMessage } } as unknown as HTMLIFrameElement,
      postId: 1,
      targetOrigin: 'https://example.com',
      monaco: {} as any,
      htmlModel: htmlModel as any,
      cssModel: cssModel as any,
      jsModel: jsModel as any,
      htmlEditor: { revealRangeInCenter: () => {}, focus: () => {} } as any,
      cssEditor: { revealRangeInCenter: () => {} } as any,
      focusHtmlEditor: () => {},
      getPreviewCss: () => '',
      getShadowDomEnabled: () => false,
      getLiveHighlightEnabled: () => true,
      getJsEnabled: () => false,
      getExternalScripts: () => [],
      getExternalStyles: () => [],
      isTailwindEnabled: () => false,
      renderShortcodes,
    });

    controller.handleMessage({
      origin: 'https://example.com',
      data: { type: 'CODELLIA_READY' },
    } as MessageEvent);
    await flushAsync();
    renderShortcodes.mockClear();

    controller.sendRender();
    await flushAsync();
    controller.sendRender();
    await flushAsync();

    expect(renderShortcodes).toHaveBeenCalledTimes(2);
  });
});

