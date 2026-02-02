import { test, expect } from '@playwright/test';

const adminUser = process.env.WP_ADMIN_USER ?? '';
const adminPass = process.env.WP_ADMIN_PASS ?? '';
const postId = process.env.CODENAGI_POST_ID ?? '';
const baseUrlRaw = process.env.WP_BASE_URL ?? 'http://localhost';
const baseUrl = (() => {
  const url = new URL(baseUrlRaw);
  if (!url.pathname.endsWith('/')) {
    url.pathname += '/';
  }
  return url;
})();

test.skip(
  !adminUser || !adminPass || !postId,
  'Set WP_ADMIN_USER, WP_ADMIN_PASS, and CODENAGI_POST_ID.'
);

const loginAndGetPreviewUrl = async (page: import('@playwright/test').Page): Promise<string> => {
  const loginUrl = new URL('wp-login.php', baseUrl).toString();
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
  await page.fill('#user_login', adminUser);
  await page.fill('#user_pass', adminPass);
  await page.click('#wp-submit');
  await page.waitForLoadState('networkidle');

  const adminUrl = new URL('wp-admin/admin.php', baseUrl);
  adminUrl.searchParams.set('page', 'codenagi');
  adminUrl.searchParams.set('post_id', postId);
  await page.goto(adminUrl.toString(), { waitUntil: 'domcontentloaded' });

  const handle = await page.waitForFunction(() => {
    return (window as any).CODENAGI?.iframePreviewUrl || null;
  });
  const previewUrl = await handle.jsonValue();
  if (typeof previewUrl !== 'string' || previewUrl.length === 0) {
    throw new Error('iframePreviewUrl not found. Check CODENAGI_POST_ID and login.');
  }
  return previewUrl;
};

test('preview postMessage handshake works', async ({ page }) => {
  const previewUrl = await loginAndGetPreviewUrl(page);

  const messages: Array<{ type?: string }> = [];

  await page.goto(new URL('./', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ url }) => {
      const iframe = document.createElement('iframe');
      iframe.id = 'lc-preview-frame';
      iframe.src = url;
      iframe.style.width = '800px';
      iframe.style.height = '600px';
      document.body.appendChild(iframe);
    },
    { url: previewUrl }
  );

  await page.waitForSelector('#lc-preview-frame');

  const readyPromise = page.evaluate(() => {
    return new Promise<{ type?: string }>((resolve) => {
      const handler = (event: MessageEvent) => {
        if (event.data && event.data.type === 'CODENAGI_READY') {
          window.removeEventListener('message', handler as EventListener);
          resolve(event.data);
        }
      };
      window.addEventListener('message', handler as EventListener);
    });
  });

  await page.evaluate(() => {
    const iframe = document.getElementById('lc-preview-frame') as HTMLIFrameElement | null;
    iframe?.contentWindow?.postMessage({ type: 'CODENAGI_INIT' }, '*');
  });

  const ready = await readyPromise;
  messages.push(ready);

  expect(messages.some((message) => message.type === 'CODENAGI_READY')).toBe(true);
});

test('preview ignores postMessage when allowedOrigin mismatches', async ({ page }) => {
  const previewUrl = await loginAndGetPreviewUrl(page);

  await page.goto('about:blank', { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ url }) => {
      const iframe = document.createElement('iframe');
      iframe.id = 'lc-preview-frame';
      iframe.src = url;
      iframe.style.width = '800px';
      iframe.style.height = '600px';
      document.body.appendChild(iframe);
    },
    { url: previewUrl }
  );

  await page.waitForSelector('#lc-preview-frame');

  const outcome = await page.evaluate(() => {
    return new Promise<'ready' | 'timeout'>((resolve) => {
      const handler = (event: MessageEvent) => {
        if (event.data && event.data.type === 'CODENAGI_READY') {
          window.removeEventListener('message', handler as EventListener);
          resolve('ready');
        }
      };
      window.addEventListener('message', handler as EventListener);
      const iframe = document.getElementById('lc-preview-frame') as HTMLIFrameElement | null;
      iframe?.contentWindow?.postMessage({ type: 'CODENAGI_INIT' }, '*');
      window.setTimeout(() => {
        window.removeEventListener('message', handler as EventListener);
        resolve('timeout');
      }, 400);
    });
  });

  expect(outcome).toBe('timeout');
});

