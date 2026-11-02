// Browser regressions corresponding to R1–R8 in ../regressions.test.mjs.
import { expect, navigate, openApp, test } from './helpers.mjs';

test('R1: deep branch changes preserve the parent and render the destination', async ({ page }) => {
  await openApp(page, '/shell/group/a');
  await page.getByTestId('shell').evaluate((el) => {
    el.dataset.retained = 'yes';
  });
  await navigate(page, '/shell/other');
  await expect(page.getByTestId('other')).toHaveText('Other');
  await expect(page.getByTestId('shell')).toHaveAttribute('data-retained', 'yes');
  await navigate(page, '/shell/group/b');
  await expect(page.getByTestId('b')).toHaveText('B');
});
test('R2: returning to an empty parent outlet clears the previous child', async ({ page }) => {
  await openApp(page, '/shell/other');
  await navigate(page, '/shell');
  await expect(page.getByTestId('other')).toHaveCount(0);
  await expect(page.getByTestId('shell')).toHaveText('Shell');
  await navigate(page, '/shell/group/a');
  await expect(page.getByTestId('a')).toHaveText('A');
});
test('R3: hash query supports direct entry, edits, deletion and history', async ({ page }) => {
  await openApp(page, '/index.html?outer=ignored#/users/1?tab=hello+world', {
    mode: 'hash',
  });
  await expect(page.getByTestId('user-id')).toHaveText('1');
  await expect(page.getByTestId('query')).toHaveText('hello world');
  expect(await page.evaluate(() => window.app.core[window.fixture.QUERY].outer)).toBeUndefined();
  await navigate(page, '/users/1?tab=next');
  await expect(page.getByTestId('query')).toHaveText('next');
  await navigate(page, '/users/1');
  await expect(page.getByTestId('query')).toHaveText('undefined');
  await page.goBack();
  await expect(page.getByTestId('query')).toHaveText('next');
});
test('R4: base root, client navigation, redirects and native URLs stay in the base', async ({
  page,
}) => {
  await openApp(page, '/app', { baseHref: '/app/' });
  await expect(page.getByTestId('page')).toHaveText('Home');
  await expect(page.getByTestId('custom-link')).toHaveAttribute('href', '/app/about');
  await page.getByRole('link', { name: 'About', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/about$/);
  await navigate(page, '/old');
  await expect(page).toHaveURL(/\/app\/about$/);
  await navigate(page, '/jump');
  await expect(page).toHaveURL(/\/app\/jump\/child$/);
  await expect(page.getByTestId('other')).toHaveText('Other');
  await page.reload();
  await expect(page.getByTestId('other')).toHaveText('Other');
});
test('R5: a new route cannot read params left over from the previous route', async ({ page }) => {
  await openApp(page, '/users/42');
  await navigate(page, '/about');
  await expect(page.getByTestId('stale-id')).toHaveText('undefined');
  expect(await page.evaluate(() => Object.keys(window.app.core[window.fixture.PARAMS][0]))).toEqual(
    [],
  );
});
test('R6: noActive and default RouterHref keep their native targets reactive', async ({ page }) => {
  await openApp(page, '/', { noActive: true });
  await page.evaluate(() => {
    window.app.state.to = '/users/2';
  });
  await expect(page.getByTestId('custom-link')).toHaveAttribute('href', '/users/2');
  await expect(page.getByRole('link', { name: 'Dynamic', exact: true })).toHaveAttribute(
    'href',
    '/users/2',
  );
  await page.getByTestId('custom-link').click();
  await expect(page.getByTestId('user-id')).toHaveText('2');
});
test('R7a: native hash anchor opened in a new tab reaches the routed page', async ({
  page,
  context,
}) => {
  await openApp(page, '/index.html#/', { mode: 'hash' });
  const href = await page.getByTestId('custom-link').getAttribute('href');
  expect(href).toBe('#/about');
  // This follows the actual native href without the RouterLink click interceptor.
  const other = await context.newPage();
  await other.goto(new URL(href, page.url()).href);
  await expect(other).toHaveURL(/index\.html#\/about$/);
  await expect(other.getByTestId('page')).toHaveText('About');
});
test('R7b: open=true opens the resolved hash URL in a real popup', async ({ page }) => {
  await openApp(page, '/index.html#/', { mode: 'hash', open: true });
  const popupPromise = page.waitForEvent('popup');
  await page.getByTestId('custom-link').click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/index\.html#\/about$/);
  await expect(popup.getByTestId('page')).toHaveText('About');
});
test('R8: exactActiveClass alone tracks entering and leaving the target', async ({ page }) => {
  await openApp(page, '/about');
  const link = page.getByRole('link', { name: 'Exact only', exact: true });
  await expect(link).toHaveClass('selected');
  await navigate(page, '/');
  await expect(link).toHaveClass('');
});
