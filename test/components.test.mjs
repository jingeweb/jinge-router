import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

import { api, flush, mount, query, rt } from './harness.mjs';
void test('Router provides context, renders initial location and registers the root outlet', () => {
  const app = mount('/about?tab=info');
  assert.equal(query('page').textContent, 'About');
  assert.equal(query('query').textContent, 'info');
  assert.equal(app.core[api.CORE_VIEWS].length, 1);
  assert.equal(api.getRouterCoreContext(app.core[api.CORE_VIEWS][0]), app.core);
  assert.equal(api.getRouteViewDeepContext(app.core[api.CORE_VIEWS][0]), 1);
  assert.throws(() => api.getRouterCoreContext(new rt.ComponentHost()), /missing RouterCore/);
});
void test('Router updates query without replacing the routed component', async () => {
  const app = mount('/users/1?tab=first'),
    user = query('user');
  api.navigateRouter(app.core, '/users/1?tab=next');
  await flush();
  assert.equal(query('user'), user);
  assert.equal(query('query').textContent, 'next');
  api.navigateRouter(app.core, '/users/1');
  await flush();
  assert.equal(query('query').textContent, 'undefined');
  assert.equal(app.events.filter((e) => e === 'mount:user').length, 1);
});
void test('useParams updates a retained component and exposes merged params in descendants', async () => {
  const app = mount('/users/1/posts/a'),
    user = query('user'),
    post = query('post');
  assert.equal(post.textContent, '1:a');
  api.navigateRouter(app.core, '/users/2/posts/b');
  await flush();
  assert.equal(query('user'), user);
  assert.equal(query('post'), post);
  assert.equal(query('user-id').textContent, '2');
  assert.equal(post.textContent, '2:b');
});
void test('sibling leaf navigation retains layouts and balances lifecycle callbacks', async () => {
  const app = mount('/shell/group/a'),
    shell = query('shell'),
    group = query('group');
  api.navigateRouter(app.core, '/shell/group/b');
  await flush();
  assert.equal(query('shell'), shell);
  assert.equal(query('group'), group);
  assert.equal(query('a'), null);
  assert.equal(query('b').textContent, 'B');
  assert.equal(app.events.filter((e) => e === 'unmount:a').length, 1);
  assert.equal(app.events.filter((e) => e === 'mount:b').length, 1);
});
void test('componentless nesting renders index through an implicit RouterView', () => {
  const app = mount('/auto');
  assert.equal(query('auto-index').textContent, 'Auto index');
  assert.equal(app.core[api.CORE_VIEWS].length, 2);
});
void test('unmatched routes empty the outlet and subsequent navigation recovers', async () => {
  const app = mount('/about');
  api.navigateRouter(app.core, '/missing');
  await flush();
  assert.equal(query('page'), null);
  api.navigateRouter(app.core, '/');
  await flush();
  assert.equal(query('page').textContent, 'Home');
});
void test('RouterLink click uses replace and useNavigate handles button navigation', async () => {
  const app = mount('/', { replace: true });
  const length = history.length;
  query('custom-link').click();
  await flush();
  assert.equal(location.pathname, '/about');
  assert.equal(history.length, length);
  query('go-user').click();
  await flush();
  assert.equal(query('user-id').textContent, '2');
  assert.equal(app.core[api.PARAMS][0].id, 2);
});
void test('RouterLink supports noEvent and explicit new-window navigation', async () => {
  mount('/', { noEvent: true });
  const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
  query('custom-link').addEventListener('click', (e) => e.preventDefault(), {
    once: true,
  });
  query('custom-link').dispatchEvent(evt);
  await flush();
  assert.equal(location.pathname, '/');
  mount('/', { open: true });
  const open = mock.method(window, 'open', () => null);
  try {
    query('custom-link').click();
    assert.equal(open.mock.calls[0].arguments[0], '/about');
  } finally {
    open.mock.restore();
  }
});
void test('RouterLink reports ancestor/exact state and updates target, href and active reactively', async () => {
  const app = mount('/shell/group/a', { to: '/shell' });
  assert.equal(query('custom-link').getAttribute('data-active'), 'true');
  assert.equal(query('custom-link').getAttribute('data-exact'), 'false');
  app.state.to = '/shell/group/a';
  await flush();
  assert.equal(query('custom-link').getAttribute('href'), '/shell/group/a');
  assert.equal(query('custom-link').getAttribute('data-exact'), 'true');
  app.state.to = '/about';
  await flush();
  assert.equal(query('custom-link').getAttribute('data-active'), 'false');
});
void test('RouterHref combines className and active/exact classes', () => {
  mount('/about');
  assert.equal(document.querySelector('.about-link').className, 'about-link active exact');
});
void test('unmount removes outlets, link subscriptions, popstate listener and DOM', async () => {
  const app = mount('/users/1/posts/a');
  assert.ok(app.core[api.ON_CHANGE].size > 0);
  const off = mock.method(window, 'removeEventListener');
  app.dispose();
  assert.equal(app.core[api.CORE_VIEWS].length, 0);
  assert.equal(app.core[api.ON_CHANGE].size, 0);
  assert.equal(document.body.childNodes.length, 0);
  assert.ok(off.mock.calls.some((c) => c.arguments[0] === 'popstate'));
  off.mock.restore();
  const events = [...app.events];
  api.navigateRouter(app.core, '/about');
  await flush();
  assert.deepEqual(app.events, events);
});
void test('view helpers preserve sibling DOM, support multi-root replacement and empty placeholders', () => {
  const view = new rt.ComponentHost();
  const before = document.createTextNode('before'),
    after = document.createTextNode('after');
  const placeholder = document.createComment('outlet');
  view[rt.ROOT_NODES].push(placeholder);
  document.body.append(before, placeholder, after);
  const fc = (_, host) => {
    const nodes = [document.createTextNode('A'), document.createTextNode('B')];
    host[rt.ROOT_NODES].push(...nodes);
    return nodes;
  };
  api.renderView(view, fc);
  assert.equal(document.body.textContent, 'beforeABafter');
  api.renderView(view);
  assert.equal(document.body.textContent, 'beforeafter');
  assert.equal(view[rt.ROOT_NODES][0].nodeType, Node.COMMENT_NODE);
  rt.destroyComponent(view);
});
void test('registerView rejects gaps in outlet depth', () => {
  const core = api.createRouter({ routes: [] });
  assert.throws(() => api.registerView(core, new rt.ComponentHost(), 2), /bad view deep/);
});
