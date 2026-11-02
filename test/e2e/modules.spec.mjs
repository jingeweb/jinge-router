import { expect, navigate, openApp, test } from './helpers.mjs';

test('html5 initial render, client navigation, back, forward and reload', async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId('page')).toHaveText('Home');
  await page.getByRole('link', { name: 'About', exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByTestId('page')).toHaveText('About');
  await page.goBack();
  await expect(page.getByTestId('page')).toHaveText('Home');
  await page.goForward();
  await expect(page.getByTestId('page')).toHaveText('About');
  await page.reload();
  await expect(page.getByTestId('page')).toHaveText('About');
});
test('hash click navigation, history and direct entry', async ({ page }) => {
  await openApp(page, '/index.html#/users/1', { mode: 'hash' });
  await expect(page.getByTestId('user-index')).toHaveText('Index');
  await page.getByRole('link', { name: 'About', exact: true }).click();
  await expect(page).toHaveURL(/index\.html#\/about$/);
  await expect(page.getByTestId('page')).toHaveText('About');
  await page.goBack();
  await expect(page.getByTestId('user-id')).toHaveText('1');
});
test('query changes retain DOM identity and update bindings', async ({ page }) => {
  await openApp(page, '/users/1?tab=first');
  await page.getByTestId('user').evaluate((el) => {
    el.dataset.retained = 'yes';
  });
  await navigate(page, '/users/1?tab=second');
  await expect(page.getByTestId('query')).toHaveText('second');
  await expect(page.getByTestId('user')).toHaveAttribute('data-retained', 'yes');
  await navigate(page, '/users/1');
  await expect(page.getByTestId('query')).toHaveText('undefined');
});
test('nested params update retained layouts and leaf components', async ({ page }) => {
  await openApp(page, '/users/1/posts/a');
  await expect(page.getByTestId('post')).toHaveText('1:a');
  await page.getByTestId('post').evaluate((el) => {
    el.dataset.retained = 'yes';
  });
  await navigate(page, '/users/2/posts/b');
  await expect(page.getByTestId('post')).toHaveText('2:b');
  await expect(page.getByTestId('post')).toHaveAttribute('data-retained', 'yes');
  await expect(page.getByTestId('user-id')).toHaveText('2');
});
test('nested sibling navigation runs leaf cleanup exactly once', async ({ page }) => {
  await openApp(page, '/shell/group/a');
  await navigate(page, '/shell/group/b');
  await expect(page.getByTestId('b')).toHaveText('B');
  const events = await page.evaluate(() => window.app.events);
  expect(events.filter((e) => e === 'unmount:a')).toHaveLength(1);
  expect(events.filter((e) => e === 'mount:b')).toHaveLength(1);
  expect(events).not.toContain('unmount:group');
});
test('redirect replaces its history entry', async ({ page }) => {
  await openApp(page);
  await navigate(page, '/old');
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByTestId('page')).toHaveText('About');
  await page.goBack();
  await expect(page.getByTestId('page')).toHaveText('Home');
});
test('redirectChild and componentless index routes mount their outlets', async ({ page }) => {
  await openApp(page, '/jump');
  await expect(page).toHaveURL(/\/jump\/child$/);
  await expect(page.getByTestId('other')).toHaveText('Other');
  await navigate(page, '/auto');
  await expect(page.getByTestId('auto-index')).toHaveText('Auto index');
});
test('useNavigate replace and numeric back preserve history behavior', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('go-user').click();
  await expect(page.getByTestId('user-id')).toHaveText('2');
  await page.getByTestId('replace-about').click();
  await expect(page.getByTestId('page')).toHaveText('About');
  await page.getByTestId('back').click();
  await expect(page.getByTestId('page')).toHaveText('Home');
});
test('active/exact state and dynamic link target follow route and VM changes', async ({ page }) => {
  await openApp(page, '/shell/group/a', { to: '/shell' });
  const link = page.getByTestId('custom-link');
  await expect(link).toHaveAttribute('data-active', 'true');
  await expect(link).toHaveAttribute('data-exact', 'false');
  await page.evaluate(() => {
    window.app.state.to = '/shell/group/a';
  });
  await expect(link).toHaveAttribute('data-exact', 'true');
  await page.evaluate(() => {
    window.app.state.to = '/about';
  });
  await expect(link).toHaveAttribute('href', '/about');
  await link.click();
  await expect(page.getByRole('link', { name: 'About', exact: true })).toHaveClass(
    'about-link active exact',
  );
});
test('noEvent permits native anchor navigation and fresh document loading', async ({ page }) => {
  await openApp(page, '/', { noEvent: true });
  await page.evaluate(() => {
    window.oldDocumentMarker = true;
  });
  await page.getByTestId('custom-link').click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByTestId('page')).toHaveText('About');
  expect(await page.evaluate(() => window.oldDocumentMarker)).toBeUndefined();
});
test('wildcard and unmatched routes render and recover', async ({ page }) => {
  await openApp(page, '/files/a/b');
  await expect(page.getByTestId('wildcard')).toHaveText('Fallback');
  await navigate(page, '/missing');
  await expect(page.getByTestId('wildcard')).toHaveCount(0);
  await navigate(page, '/');
  await expect(page.getByTestId('page')).toHaveText('Home');
});
test('unmount detaches route updates and clears outlets/subscriptions', async ({ page }) => {
  await openApp(page, '/users/1/posts/a');
  const state = await page.evaluate(() => {
    const { app, fixture } = window;
    app.dispose();
    const events = [...app.events];
    fixture.navigateRouter(app.core, '/about');
    return {
      views: app.core[fixture.CORE_VIEWS].length,
      subscribers: app.core[fixture.ON_CHANGE].size,
      events,
    };
  });
  expect(state.views).toBe(0);
  expect(state.subscribers).toBe(0);
  expect(await page.locator('body').textContent()).toBe('');
  expect(await page.evaluate(() => window.app.events)).toEqual(state.events);
});
