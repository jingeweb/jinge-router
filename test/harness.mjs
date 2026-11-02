import { JSDOM } from 'jsdom';
import { afterEach, beforeEach } from 'node:test';
const dom = new JSDOM('<!doctype html><body></body>', {
  url: 'http://localhost/',
});
for (const name of [
  'window',
  'document',
  'Node',
  'Element',
  'HTMLElement',
  'SVGElement',
  'Text',
  'Comment',
  'Event',
  'MouseEvent',
  'DocumentFragment',
  'location',
  'history',
  'PopStateEvent',
]) {
  globalThis[name] = dom.window[name];
}
globalThis.OffscreenCanvas = class {};
globalThis.dispatchEvent = window.dispatchEvent.bind(window);
export const api = await import('./.compiled/app.js');
export const { rt } = api;
// Browser globals: router history notifications use jinge's microtask polyfill.
globalThis.setImmediate = window.setImmediate;
globalThis.clearImmediate = window.clearImmediate;
export const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
export function mount(url = '/', options = {}) {
  history.replaceState(null, '', url);
  return api.mountApp(options);
}
beforeEach(() => {
  history.replaceState(null, '', '/');
});
afterEach(async () => {
  api.disposeApp();
  document.body.replaceChildren();
  await flush();
});
export const query = (testId) => document.querySelector(`[data-testid="${testId}"]`);
