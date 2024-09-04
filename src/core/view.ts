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
import { RouterCore } from '.';
import { RouteInfo } from './info';

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

export function updateErrView(viewComponent: ComponentHost, err: unknown) {
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
  err = isObject(err) ? err.message || err.toString() : err;
  const errRenderFn = viewComponent[SLOTS].error;
  if (!errRenderFn) {
    const newEl = createEle('p', err as string);
    setAttribute(newEl, 'style', 'color: red;');
    $pa.insertBefore(newEl, $el);
    removeOldEl();
    roots[0] = newEl;
    return;
  }
  const newEl = newComponentWithDefaultSlot(viewComponent[CONTEXT]);
  const nodes = renderSlotFunction(newEl, errRenderFn);
  $pa.insertBefore(nodes.length > 1 ? createFragment(nodes) : nodes[0], $el);
  removeOldEl();
  roots[0] = newEl;
  handleRenderDone(newEl);
}
export function updateView(
  viewComponent: ComponentHost,
  viewName: string,
  routeMatchItem: MatchRoute,
) {
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

export function prepareUpdateView(view: ComponentHost) {
  const roots = view[ROOT_NODES];
  const oldEl = roots[0];
  const oldIsComp = isComponent(oldEl);
  const $el = oldIsComp ? getFirstDOM(oldEl) : oldEl;
  const $pa = $el.parentNode as Node;

  const $cursor: Node = document.createComment('router-view');
  $pa.insertBefore($cursor, $el);

  if (oldIsComp) {
    destroyComponent(oldEl);
  } else {
    $pa.removeChild($el);
  }

  /**
   *
   * ````tsx
   * <router-view>
   * {{
   *  loading: <div><i class="loading"/>正在加载...</div>
   *  error:<div>加载失败，请刷新浏览器重试。</div>
   * }}
   * </router-view>
   * ````
   * 或
   * ```tsx
   * <router-view><div>正在加载...</div></router-view>
   * ```
   */
  const loadingRenderFn = view[SLOTS].loading || view[SLOTS][DEFAULT_SLOT];
  if (!loadingRenderFn) {
    roots[0] = $cursor;
    return;
  }

  const loadingEl = newComponentWithDefaultSlot(view[CONTEXT]);
  const nodes = renderSlotFunction(loadingEl, loadingRenderFn);
  $pa.insertBefore(nodes.length > 1 ? createFragment(nodes) : nodes[0], $cursor);
  $pa.removeChild($cursor);

  roots[0] = loadingEl;
}

export function deregisterView(router: RouterCore, viewNamePath: string[]) {
  let node: ViewNode | undefined = router as unknown as ViewNode;
  for (let i = 0; i < viewNamePath.length - 1; i++) {
    node = node.views.get(viewNamePath[i]);
    if (!node) return;
  }
  if (!node.views) {
    return;
  }
  node.views.delete(viewNamePath[viewNamePath.length - 1]);
}

export function registerView(
  router: RouterCore,
  viewNamePath: string[],
  viewComponent: ComponentHost,
  doc: 'before' | 'after',
) {
  let node = router as unknown as ViewNode;
  for (let i = 0; i < viewNamePath.length - 1; i++) {
    node = node.views.get(viewNamePath[i])!;
  }

  const viewName = viewNamePath[viewNamePath.length - 1];
  if (node.views.has(viewName)) {
    throw new Error(`dulplicated view name: ${viewName} at path: ${viewNamePath.join('->')}`);
  }
  node.views.set(viewName, {
    name: viewName,
    doc,
    component: viewComponent,
    views: new Map(),
  });
  if (viewNamePath.length > router.info.routePath.length) {
    return;
  }
  updateView(viewComponent, viewName, router.info.routePath[viewNamePath.length - 1]);
}
