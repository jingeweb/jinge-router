import {
  type AnyFn,
  CONTEXT,
  type ComponentHost,
  DEFAULT_SLOT,
  ROOT_NODES,
  SLOTS,
  createComment,
  createEle,
  createFragment,
  destroyComponent,
  getFirstDOM,
  handleRenderDone,
  isComponent,
  isFunction,
  isObject,
  newComponentWithDefaultSlot,
  renderFunctionComponent,
  renderSlotFunction,
  setAttribute,
} from 'jinge';
import type { GuardFn, MatchRoute } from '../common';
import { BEFORE_ROUTE_LEAVE } from '../hook';
import { CORE_VIEWS, ROUTER_CORE, type RouterCore } from './router';

export interface ViewNode {
  name: string;
  component: ComponentHost;
  views: Map<string, ViewNode>;
  doc: 'before' | 'after';
}

export function getViewsToUpdate(
  views: Map<string, ViewNode>,
  resetLv: number,
  curLv = 0,
  viewsToUpdate: ViewNode[] = [],
): ViewNode[] {
  views.forEach((node) => {
    if (curLv >= resetLv) {
      viewsToUpdate.push(node);
    } else if (node.views) {
      getViewsToUpdate(node.views, resetLv, curLv + 1, viewsToUpdate);
    }
  });
  return viewsToUpdate;
}

export function updateView(viewComponent: ComponentHost, routeMatchItem: MatchRoute) {
  const roots = viewComponent[ROOT_NODES];
  const oldEl = roots[0];
  const oldIsComp = isComponent(oldEl);
  const $el = oldIsComp ? getFirstDOM(oldEl) : (oldEl as unknown as Node);
  const $pa = $el.parentNode as Node;
  const removeOldEl = () => {
    if (oldIsComp) {
      destroyComponent(oldEl);
    } else {
      $pa.removeChild($el);
    }
  };

  let fc: AnyFn | null = null;
  if (routeMatchItem) {
    fc = routeMatchItem.route.components[viewName];
    if (!fc) {
      console.warn(`Component of <router-view/> named "${viewName}" not provided.`);
    }
  }
  if (!fc) {
    const newEl = createComment('router-view');
    $pa.insertBefore(newEl, $el);
    removeOldEl();
    roots[0] = newEl;
    return;
  }

  const newEl = newComponentWithDefaultSlot(viewComponent[CONTEXT]);
  const nodes = renderFunctionComponent(newEl, fc);

  $pa.insertBefore(nodes.length > 1 ? createFragment(nodes) : nodes[0], $el);
  removeOldEl();
  roots[0] = newEl;
  handleRenderDone(newEl);
}

export async function shouldUpdateView(view: ComponentHost, from: RouteInfo, to: RouteInfo) {
  const el = view[ROOT_NODES][0];
  if (!isComponent(el)) {
    return true;
  }
  const fn = (
    el as unknown as {
      [BEFORE_ROUTE_LEAVE]: GuardFn<boolean | void>;
    }
  )[BEFORE_ROUTE_LEAVE];
  if (isFunction(fn)) {
    return await fn(from, to);
  }
  return true;
}

export function deregisterView(router: RouterCore, viewDeep: number) {
  const views = router[CORE_VIEWS];
  views.splice(viewDeep - 1, views.length - viewDeep + 1);
}

export function registerView(router: RouterCore, viewComponent: ComponentHost, viewDeep: number) {
  const views = router[CORE_VIEWS];
  if (viewDeep - 1 !== views.length) throw new Error('bad view deep');
  views.push(viewComponent);
  // updateView(viewComponent, viewName, router.info.routePath[viewNamePath.length - 1]);
}
