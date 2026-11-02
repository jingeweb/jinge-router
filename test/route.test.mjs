import assert from 'node:assert/strict';
import { test } from 'node:test';

import { api } from './harness.mjs';
const {
  parseRoutes,
  matchRoutes,
  ROUTE_TYPE_NORMAL,
  ROUTE_TYPE_NEST,
  ROUTE_TYPE_INDEX,
  ROUTE_TYPE_REDIRECT,
} = api;
const component = () => {};
void test('parse route kinds, preserve definitions, put index first without mutating input', () => {
  const child = [{ path: 'child', component }, { component }];
  const defs = [
    { path: '/old', redirectTo: '/new' },
    { path: '/new', component },
    { path: '/parent', component, children: child },
  ];
  const parsed = parseRoutes(defs);
  assert.deepEqual(
    parsed.map((r) => r[0]),
    [ROUTE_TYPE_REDIRECT, ROUTE_TYPE_NORMAL, ROUTE_TYPE_NEST],
  );
  assert.equal(parsed[0][1], defs[0]);
  assert.equal(parsed[2][3][0][0], ROUTE_TYPE_INDEX);
  assert.equal(child[0].path, 'child');
});
void test('duplicate index routes are rejected at each level', () => {
  assert.throws(() => parseRoutes([{ component }, { component }]), /Index/);
  assert.throws(
    () => parseRoutes([{ path: '/p', children: [{ component }, { component }] }]),
    /Index/,
  );
});
void test('match literal paths only at full length, including root', () => {
  const routes = parseRoutes([
    { path: '/', component },
    { path: '/a', component },
  ]);
  assert.equal(matchRoutes('/', routes)[0][0][1].path, '/');
  assert.equal(matchRoutes('/a', routes)[0][0][1].path, '/a');
  for (const path of ['/ab', '/a/b', '/missing'])
    assert.equal(matchRoutes(path, routes), undefined);
});
void test('numeric params are numbers and reject non-digit values', () => {
  const routes = parseRoutes([{ path: '/users/:id<num>', component }]);
  assert.deepEqual(matchRoutes('/users/0042', routes)[0][1], { id: 42 });
  for (const value of ['abc', '-1', '1.5', '12x'])
    assert.equal(matchRoutes(`/users/${value}`, routes), undefined);
});
void test('nested matching captures params per level and backtracks between branches', () => {
  const routes = parseRoutes([
    {
      path: '/org/:org',
      children: [
        { path: 'users/:id<num>', component },
        { path: ':kind/:slug', component },
      ],
    },
  ]);
  assert.deepEqual(
    matchRoutes('/org/acme/users/4', routes).map((r) => r[1]),
    [{ org: 'acme' }, { id: 4 }],
  );
  assert.deepEqual(
    matchRoutes('/org/acme/docs/readme', routes).map((r) => r[1]),
    [{ org: 'acme' }, { kind: 'docs', slug: 'readme' }],
  );
  assert.equal(matchRoutes('/org/acme', routes).length, 1);
  assert.equal(matchRoutes('/org/acme/users/4/more', routes), undefined);
});
void test('wildcards are lower priority and deeper wildcards win over broad ones', () => {
  const routes = parseRoutes([
    { path: '/*', component },
    { path: '/files/*', component },
    { path: '/files/readme', component },
  ]);
  assert.equal(matchRoutes('/files/readme', routes)[0][0][1].path, '/files/readme');
  assert.equal(matchRoutes('/files/a/b', routes)[0][0][1].path, '/files/*');
  assert.equal(matchRoutes('/missing', routes)[0][0][1].path, '/*');
});
void test('parameter and literal routes with equal priority preserve declaration order', () => {
  const routes = parseRoutes([
    { path: '/:name', component },
    { path: '/fixed', component },
  ]);
  assert.equal(matchRoutes('/fixed', routes)[0][0][1].path, '/:name');
});
