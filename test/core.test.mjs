import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

import { api, flush, rt } from './harness.mjs';
const {
  createRouter,
  updateLocation,
  updateQuery,
  QUERY,
  PARAMS,
  MATCH_ROUTE,
  ON_CHANGE,
  CORE_VIEWS,
  MODE,
  BASE_HREF,
} = api;
const component = () => {};
void test('createRouter initializes isolated cores and ignores VM wrapping', () => {
  const a = createRouter({ routes: [] }),
    b = createRouter({ routes: [] });
  assert.equal(a[MODE], 'html5');
  assert.equal(a[BASE_HREF], '/');
  assert.equal(rt.vm({ core: a }).core, a);
  assert.notEqual(a[QUERY], b[QUERY]);
  assert.notEqual(a[CORE_VIEWS], b[CORE_VIEWS]);
  assert.equal(a[ON_CHANGE].size, 0);
});
void test('query VM keeps identity and notifies additions, edits and removals', async () => {
  const core = createRouter({ routes: [] }),
    query = core[QUERY],
    values = [];
  const off = rt.vmWatch(query, 'name', (value) => values.push(value));
  updateQuery(core, '?name=hello+world&tag=%E4%B8%AD&repeat=first&repeat=last');
  await flush();
  assert.equal(query.name, 'hello world');
  assert.equal(query.tag, '中');
  assert.equal(query.repeat, 'first');
  updateQuery(core, '?name=next');
  await flush();
  assert.deepEqual(Object.keys(query), ['name']);
  updateQuery(core, '');
  await flush();
  assert.equal(core[QUERY], query);
  assert.deepEqual(Object.keys(query), []);
  assert.deepEqual(values, ['hello world', 'next', undefined]);
  off();
});
void test('location merges parent params and child overrides, retaining VM identity', () => {
  const core = createRouter({
    routes: [{ path: '/org/:id', children: [{ path: ':id<num>', component }] }],
  });
  updateLocation(core, '/org/acme/2', '?q=one');
  const parent = core[PARAMS][0],
    child = core[PARAMS][1];
  assert.deepEqual({ ...parent }, { id: 'acme' });
  assert.deepEqual({ ...child }, { id: 2 });
  updateLocation(core, '/org/other/3');
  assert.equal(core[PARAMS][0], parent);
  assert.equal(core[PARAMS][1], child);
  assert.equal(parent.id, 'other');
  assert.equal(child.id, 3);
  assert.equal(core[QUERY].q, 'one');
});
void test('change subscribers observe committed match, params and query, and can unsubscribe', () => {
  const core = createRouter({ routes: [{ path: '/:id', component }] });
  const seen = [];
  const fn = (match) => seen.push([match === core[MATCH_ROUTE], core[PARAMS][0].id, core[QUERY].q]);
  core[ON_CHANGE].add(fn);
  updateLocation(core, '/one', '?q=first');
  core[ON_CHANGE].delete(fn);
  updateLocation(core, '/two');
  assert.deepEqual(seen, [[true, 'one', 'first']]);
});
void test('unmatched location clears matches and param slots', () => {
  const core = createRouter({ routes: [{ path: '/ok', component }] });
  updateLocation(core, '/ok');
  updateLocation(core, '/missing');
  assert.deepEqual(core[MATCH_ROUTE], []);
  assert.equal(core[PARAMS].length, 0);
});
void test('nested parent selects index child', () => {
  const index = { component };
  const core = createRouter({
    routes: [{ path: '/p', children: [{ path: 'child', component }, index] }],
  });
  updateLocation(core, '/p');
  assert.equal(core[MATCH_ROUTE][1][0][1], index);
});
void test('redirect and redirectChild replace history and dispatch popstate asynchronously', async () => {
  const core = createRouter({
    routes: [
      { path: '/old', redirectTo: '/new' },
      { path: '/p', redirectChild: 'child', children: [] },
    ],
  });
  const replace = mock.method(history, 'replaceState');
  const calls = [];
  const listener = () => calls.push(location.pathname);
  window.addEventListener('popstate', listener);
  try {
    updateLocation(core, '/old');
    assert.equal(location.pathname, '/new');
    assert.deepEqual(calls, []);
    await flush();
    updateLocation(core, '/p');
    await flush();
    assert.deepEqual(calls, ['/new', '/p/child']);
    assert.equal(replace.mock.callCount(), 2);
    assert.equal(core[MATCH_ROUTE], undefined);
  } finally {
    window.removeEventListener('popstate', listener);
    replace.mock.restore();
  }
});
void test('updateHistoryState supports push and replace', async () => {
  const before = history.length;
  api.updateHistoryState('/one');
  assert.equal(history.length, before + 1);
  api.updateHistoryState('/two', true);
  assert.equal(history.length, before + 1);
  assert.equal(location.pathname, '/two');
  await flush();
});
void test('navigateRouter forwards history deltas and builds hash destinations', async () => {
  const core = createRouter({ mode: 'hash', routes: [] });
  const go = mock.method(history, 'go', () => {});
  try {
    api.navigateRouter(core, -2);
    assert.deepEqual(go.mock.calls[0].arguments, [-2]);
  } finally {
    go.mock.restore();
  }
  api.navigateRouter(core, '/about', { replace: true });
  assert.equal(location.hash, '#/about');
  await flush();
});
