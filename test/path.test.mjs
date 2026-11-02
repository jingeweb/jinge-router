import assert from 'node:assert/strict';
import { test } from 'node:test';

import { api } from './harness.mjs';
const {
  normPath,
  parsePath,
  PATH_TYPE_LIT: LIT,
  PATH_TYPE_NUM: NUM,
  PATH_TYPE_STR: STR,
  PATH_TYPE_ANY: ANY,
} = api;
for (const [input, expected] of [
  ['', '/'],
  ['/', '/'],
  ['#/', '/'],
  ['users/', '/users'],
  ['#/a//b/', '/a/b'],
  ['/a\\b', '/a/b'],
]) {
  void test(`normPath(${JSON.stringify(input)})`, () => assert.equal(normPath(input), expected));
}
void test('parse literal, string, number and wildcard segments', () => {
  assert.deepEqual(parsePath('/users/:id<num>/:slug/*', false), [
    { type: LIT, value: 'users' },
    { type: NUM, value: 'id' },
    { type: STR, value: 'slug' },
    { type: ANY },
  ]);
  assert.deepEqual(parsePath('/', false), [{ type: LIT, value: '' }]);
});
void test('reject wildcard in nested parents and non-final wildcard', () => {
  assert.throws(() => parsePath('/a/*', true), /星号/);
  assert.throws(() => parsePath('/a/*/b', false), /末尾/);
});
