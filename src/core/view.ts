import {
  CONTEXT,
  type ComponentHost,
  type FC,
  ROOT_NODES,
  createComment,
  createFragment,
  destroyComponentContent,
  getLastDOM,
  handleRenderDone,
  insertBefore,
  newComponentWithDefaultSlot,
  renderFunctionComponent,
} from 'jinge';
import { CORE_VIEWS, type RouterCore } from './router';

export function renderView(view: ComponentHost, fc?: FC) {
  const lastEl = getLastDOM(view);
  const $pa = lastEl.parentNode as Node;
  const placeholder = createComment('router-view');
  insertBefore($pa, placeholder, lastEl);
  destroyComponentContent(view);
  if (!fc) {
    view[ROOT_NODES].push(placeholder);
    return;
  }

  const newEl = newComponentWithDefaultSlot(view[CONTEXT]);
  const nodes = renderFunctionComponent(newEl, fc);

  $pa.insertBefore(nodes.length > 1 ? createFragment(nodes) : nodes[0], placeholder);
  $pa.removeChild(placeholder);
  view[ROOT_NODES].push(newEl);
  handleRenderDone(newEl);
}

export function deregisterView(router: RouterCore, viewDeep: number) {
  const views = router[CORE_VIEWS];
  views.splice(viewDeep - 1, views.length - viewDeep + 1);
}

export function registerView(router: RouterCore, viewComponent: ComponentHost, viewDeep: number) {
  const views = router[CORE_VIEWS];
  if (viewDeep - 1 !== views.length) throw new Error('bad view deep');
  views.push(viewComponent);
}
