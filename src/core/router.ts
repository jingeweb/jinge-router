import {
  CONTEXT,
  type ComponentHost,
  VM_IGNORED,
  type ViewModel,
  destroyViewModelCore,
  vm,
} from 'jinge';

import { RouterView } from '../components';
import { getRouteHref, normPath, updateHistoryState } from './helper';
import {
  type MatchedRoute,
  type NestRoute,
  type NormalRoute,
  type ParsedRoute,
  ROUTE_TYPE_INDEX,
  ROUTE_TYPE_NEST,
  ROUTE_TYPE_REDIRECT,
  type RedirectRoute,
  type Route,
  type RouteParams,
  type RouteQuery,
  matchRoutes,
  parseRoutes,
} from './route';
import { renderView } from './view';

export const ROUTER_CORE = Symbol('routerCore');
export const ROUTE_VIEW_DEEP = Symbol('routeViewDeep');
export function getRouterCoreContext(comp: ComponentHost) {
  const router = comp[CONTEXT]?.[ROUTER_CORE] as RouterCore;
  if (!router) throw new Error('missing RouterCore context');
  return router;
}
export function getRouteViewDeepContext(comp: ComponentHost) {
  return (comp[CONTEXT]?.[ROUTE_VIEW_DEEP] as number) ?? 0;
}

export interface RouterOptions {
  routes: Route[];
  mode?: 'hash' | 'html5';
  // onBeforeEach?: GuardFn;
  // onAfterEach?: GuardFn;
  baseHref?: string;
}

export const CORE_VIEWS = Symbol('coreViews');
export const BASE_HREF = Symbol('baseHref');
export const QUERY = Symbol('query');
export const ROUTES = Symbol('routes');
export const MATCH_ROUTE = Symbol('matchRoute');
export const PARAMS = Symbol('params');
export const ON_CHANGE = Symbol('onChange');
export const MODE = Symbol('mode');

export interface RouterCore {
  [VM_IGNORED]: true;
  [CORE_VIEWS]: ComponentHost[];
  [BASE_HREF]: string;
  [QUERY]: RouteQuery;
  [ROUTES]: ParsedRoute[];
  [MATCH_ROUTE]?: MatchedRoute[];
  [PARAMS]: RouteParams[];
  [ON_CHANGE]: Set<(matchedRoutePath: MatchedRoute[]) => void>;
  [MODE]: 'html5' | 'hash';
}

export function createRouter({ baseHref, routes, mode }: RouterOptions) {
  const core: RouterCore = {
    [VM_IGNORED]: true,
    [CORE_VIEWS]: [],
    [BASE_HREF]: normPath(baseHref ?? '/'),
    [QUERY]: vm({}),
    [ROUTES]: parseRoutes(routes),
    [PARAMS]: [],
    [ON_CHANGE]: new Set(),
    [MODE]: mode ?? 'html5',
  };
  // console.log(core);
  return core;
}

export function updateQuery(core: RouterCore, search: string) {
  const newSp = new URLSearchParams(search);
  const query = core[QUERY] as ViewModel;
  for (const k of Object.keys(query)) {
    if (!newSp.has(k)) {
      query[k] = undefined; // 先将 query[k] 置为 undefined，触发 ViewModel 的变更及变更通知。
      delete query[k];
    } else {
      query[k] = newSp.get(k);
    }
  }
  for (const k of newSp.keys()) {
    if (!(k in query)) {
      query[k] = newSp.get(k);
    }
  }
}

export function updateLocation(core: RouterCore, pathname: string, search?: string) {
  pathname = normPath(pathname);
  const baseHref = core[BASE_HREF];
  let withinBase = true;
  if (baseHref !== '/') {
    if (pathname === baseHref) pathname = '/';
    else if (pathname.startsWith(`${baseHref}/`)) {
      pathname = pathname.substring(baseHref.length);
    } else {
      withinBase = false;
    }
  }

  const matchedRoutePath = (withinBase ? matchRoutes(pathname, core[ROUTES]) : undefined) ?? [];
  let matchedRoutePathLen = matchedRoutePath.length;
  const prevMatchedRoutePath = core[MATCH_ROUTE] ?? [];
  const prevMatchedRoutePathLen = prevMatchedRoutePath.length;
  if (!matchedRoutePathLen && !prevMatchedRoutePathLen) {
    return;
  }

  if (matchedRoutePathLen > 0) {
    const [routeType, routeDefine, , children] = matchedRoutePath[matchedRoutePathLen - 1][0];
    if (routeType === ROUTE_TYPE_REDIRECT) {
      /** 如果匹配的路由的最后一个是 redirect 路由，直接跳转到目标。 */
      updateHistoryState(
        getRouteHref((routeDefine as RedirectRoute).redirectTo, baseHref, core[MODE]),
        true,
      );
      return; // important!!
    } else if (routeType === ROUTE_TYPE_NEST) {
      const redirectTo = (routeDefine as NestRoute).redirectChild;
      if (redirectTo) {
        updateHistoryState(
          getRouteHref(normPath(`${pathname}/${redirectTo}`), baseHref, core[MODE]),
          true,
        );
        return;
      }
      // 如果匹配的路由是嵌套路由，且 children 第一个是 Index 路由，则将 Index 添加到匹配，接下来渲染。
      // 注意 parseRoutes 函数会排序，保证 Index 路由如果有一定是第一个。
      const firstChild = children?.[0];
      if (firstChild && firstChild[0] === ROUTE_TYPE_INDEX) {
        matchedRoutePath.push([firstChild, {}]);
        matchedRoutePathLen += 1;
      }
    }
  }
  core[MATCH_ROUTE] = matchedRoutePath;

  let x = -1;
  for (let i = 0; i < prevMatchedRoutePathLen; i++) {
    if (i >= matchedRoutePathLen) {
      break;
    }
    const pmp = prevMatchedRoutePath[i];
    const mp = matchedRoutePath[i];
    if (pmp[0][1] !== mp[0][1]) {
      break;
    }
    x = i;
  }
  // console.log(x, prevMatchedRoutePath, matchedRoutePathLen);
  const views = core[CORE_VIEWS];
  // 保留第一个变化位置的出口，清理其内容时由组件树递归销毁旧子树。
  // 必须先清理，再更新/销毁 params VM，避免旧组件继续监听新路由的数据。
  const view = views[x + 1];
  if (view) renderView(view);

  if (search !== undefined) updateQuery(core, search);
  const paramsList = core[PARAMS];

  const dropParamsCount = paramsList.length - matchedRoutePathLen;
  for (let i = 0; i < dropParamsCount; i++) {
    destroyViewModelCore(paramsList.pop() as ViewModel);
  }
  let mergedParams: RouteParams = {};
  for (let i = 0; i < matchedRoutePathLen; i++) {
    mergedParams = { ...mergedParams, ...matchedRoutePath[i][1] };
    if (i >= paramsList.length) {
      paramsList.push(vm(mergedParams));
    } else {
      const vmParams = paramsList[i] as ViewModel;
      for (const k of Object.keys(vmParams)) {
        if (!Object.hasOwn(mergedParams, k)) {
          vmParams[k] = undefined;
          delete vmParams[k];
        }
      }
      Object.entries(mergedParams).forEach(([k, v]) => {
        vmParams[k] = v;
      });
    }
  }

  core[ON_CHANGE].forEach((fn) => fn(matchedRoutePath));

  if (!view || x + 1 >= matchedRoutePathLen) {
    return;
  }
  const [routeType, routeDefine] = matchedRoutePath[x + 1][0];
  if (routeType === ROUTE_TYPE_REDIRECT) throw new Error('assert-failed');
  else if (routeType === ROUTE_TYPE_NEST) {
    renderView(view, (routeDefine as NestRoute).component ?? RouterView);
  } else {
    renderView(view, (routeDefine as NormalRoute).component);
  }
}
