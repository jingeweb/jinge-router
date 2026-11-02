import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

// The eight findings from the router review. These assert the desired behavior,
// and intentionally fail on the pre-fix source (no skips or expected-failure flags).
import { api, flush, mount, query, rt } from './harness.mjs';

void test('R1: switching a deep branch preserves its shared parent outlet', async () => {
  const app = mount('/shell/group/a'),
    shell = query('shell');
  api.navigateRouter(app.core, '/shell/other');
  await flush();
  assert.equal(query('shell'), shell);
  assert.equal(query('other')?.textContent, 'Other');
  assert.equal(app.core[api.CORE_VIEWS].length, 2);
  assert.equal(app.events.filter((e) => e === 'unmount:a').length, 1);
  assert.equal(app.events.filter((e) => e === 'unmount:group').length, 1);
  assert.equal(app.events.includes('unmount:shell'), false);
  api.navigateRouter(app.core, '/shell/group/b');
  await flush();
  assert.equal(query('b')?.textContent, 'B');
});
void test('R2: child-to-parent navigation clears the outlet without indexing past the match', () => {
  const app = mount('/shell/other'),
    shell = query('shell');
  assert.doesNotThrow(() => api.updateLocation(app.core, '/shell'));
  assert.equal(query('shell'), shell);
  assert.equal(query('other'), null);
  assert.equal(app.core[api.CORE_VIEWS].length, 2);
  assert.doesNotThrow(() => api.updateLocation(app.core, '/shell'));
});
void test('R3: hash query is parsed separately and changes without remounting the page', async () => {
  const app = mount('/index.html?outer=ignored#/users/1?tab=hello+world', {
    mode: 'hash',
  });
  assert.equal(query('user-id')?.textContent, '1');
  assert.equal(query('query')?.textContent, 'hello world');
  assert.equal(app.core[api.QUERY].outer, undefined);
  const user = query('user');
  api.navigateRouter(app.core, '/users/1?tab=next');
  await flush();
  assert.equal(query('user'), user);
  assert.equal(query('query').textContent, 'next');
  api.navigateRouter(app.core, '/users/1');
  await flush();
  assert.equal(app.core[api.QUERY].tab, undefined);
});
void test('R4a: base root and trailing slash match the root route', () => {
  const app = mount('/app', { baseHref: '/app/' });
  assert.equal(query('page')?.textContent, 'Home');
  api.updateLocation(app.core, '/app/');
  assert.equal(query('page')?.textContent, 'Home');
});
void test('R4b: a path outside the base boundary must not match inside it', () => {
  const core = api.createRouter({ baseHref: '/app', routes: api.makeRoutes() });
  api.updateLocation(core, '/application/about');
  assert.equal(core[api.MATCH_ROUTE]?.length ?? 0, 0);
});
void test('R4c: navigation and redirects retain baseHref', async () => {
  const app = mount('/app/', { baseHref: '/app' });
  api.navigateRouter(app.core, '/about');
  await flush();
  assert.equal(location.pathname, '/app/about');
  assert.equal(query('page').textContent, 'About');
  api.navigateRouter(app.core, '/old');
  await flush();
  assert.equal(location.pathname, '/app/about');
  api.navigateRouter(app.core, '/jump');
  await flush();
  assert.equal(location.pathname, '/app/jump/child');
  assert.equal(query('other')?.textContent, 'Other');
});
void test('R5: changing route definitions removes old params from reused VMs', async () => {
  const app = mount('/users/42'),
    params = app.core[api.PARAMS][0],
    values = [];
  const off = rt.vmWatch(params, 'id', (value) => values.push(value));
  api.navigateRouter(app.core, '/about');
  await flush();
  assert.equal(app.core[api.PARAMS][0], params);
  assert.equal(params.id, undefined);
  assert.equal(Object.hasOwn(params, 'id'), false);
  assert.deepEqual(values, [undefined]);
  off();
});
void test('R6: noActive does not freeze dynamic hrefs, including default RouterHref', async () => {
  const app = mount('/', { noActive: true });
  app.state.to = '/users/2';
  await flush();
  assert.equal(query('custom-link').getAttribute('href'), '/users/2');
  assert.equal(
    [...document.querySelectorAll('a')]
      .find((a) => a.textContent === 'Dynamic')
      .getAttribute('href'),
    '/users/2',
  );
  assert.equal(query('custom-link').getAttribute('data-active'), 'false');
});
void test('R7a: hash mode generates native anchor URLs in the current document', () => {
  mount('/index.html#/about', { mode: 'hash' });
  assert.equal(query('custom-link').getAttribute('href'), '#/about');
  assert.equal(new URL(query('custom-link').href).pathname, '/index.html');
});
void test('R7b: hash new-window links use the same resolved destination', () => {
  mount('/index.html#/', { mode: 'hash', open: true });
  const open = mock.method(window, 'open', () => null);
  try {
    query('custom-link').click();
    assert.equal(open.mock.calls[0].arguments[0], '#/about');
  } finally {
    open.mock.restore();
  }
});
void test('R7c: native anchor URLs include the deployment base', () => {
  mount('/app/about', { baseHref: '/app' });
  assert.equal(query('custom-link').getAttribute('href'), '/app/about');
});
void test('R8: exactActiveClass works without activeClass', () => {
  mount('/about');
  const exact = [...document.querySelectorAll('a')].find((a) => a.textContent === 'Exact only');
  assert.equal(exact.className, 'selected');
});
