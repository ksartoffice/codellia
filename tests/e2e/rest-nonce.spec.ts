import { test, expect } from '@playwright/test';

const adminUser = process.env.WP_ADMIN_USER ?? '';
const adminPass = process.env.WP_ADMIN_PASS ?? '';
const postIdRaw = process.env.CODELLIA_POST_ID ?? '';
const baseUrlRaw = process.env.WP_BASE_URL ?? 'http://localhost';
const baseUrl = (() => {
  const url = new URL(baseUrlRaw);
  if (!url.pathname.endsWith('/')) {
    url.pathname += '/';
  }
  return url;
})();

test.skip(
  !adminUser || !adminPass || !postIdRaw,
  'Set WP_ADMIN_USER, WP_ADMIN_PASS, and CODELLIA_POST_ID.'
);

const login = async (page: import('@playwright/test').Page): Promise<void> => {
  const loginUrl = new URL('wp-login.php', baseUrl).toString();
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
  await page.fill('#user_login', adminUser);
  await page.fill('#user_pass', adminPass);
  await page.click('#wp-submit');
  await page.waitForLoadState('networkidle');
};

test('REST rejects missing nonce for cookie auth', async ({ page }) => {
  await login(page);

  const cookies = await page.context().cookies();
  const hasLoggedInCookie = cookies.some((cookie) =>
    cookie.name.startsWith('wordpress_logged_in')
  );
  expect(hasLoggedInCookie).toBe(true);

  const postId = Number(postIdRaw);
  const response = await page.request.post(
    new URL('wp-json/codellia/v1/save', baseUrl).toString(),
    {
      data: {
        post_id: Number.isNaN(postId) ? postIdRaw : postId,
        html: '<p>Test</p>',
      },
    }
  );

  expect(response.status()).toBe(401);
});
