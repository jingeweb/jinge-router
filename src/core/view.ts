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
import { CORE_VIEWS, MATCH_ROUTE, type RouterCore } from './router';
import { type NestRoute, type NormalRoute, ROUTE_TYPE_NEST, ROUTE_TYPE_REDIRECT } from './route';
import { RouterView } from '../components';

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
  // console.log(views);
}

export function registerView(router: RouterCore, view: ComponentHost, viewDeep: number) {
  const views = router[CORE_VIEWS];
  if (viewDeep - 1 !== views.length) throw new Error('bad view deep');
  views.push(view);
  const matchedRoutePath = router[MATCH_ROUTE];
  if (matchedRoutePath && matchedRoutePath.length > viewDeep - 1) {
    const [routeType, routeDefine] = matchedRoutePath[viewDeep - 1][0];
    if (routeType === ROUTE_TYPE_REDIRECT) throw new Error('assert-failed');
    else if (routeType === ROUTE_TYPE_NEST) {
      renderView(view, (routeDefine as NestRoute).component ?? RouterView);
    } else {
      renderView(view, (routeDefine as NormalRoute).component);
    }
  }
}
