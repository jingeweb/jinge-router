import {
  CONTEXT,
  type ComponentHost,
  VM_IGNORED,
  type ViewModel,
  destroyComponent,
  destroyViewModelCore,
  vm,
} from 'jinge';
import { normPath, updateHistoryState } from './helper';
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
import { RouterView } from '../components';

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

export interface RouterCore {
  [VM_IGNORED]: true;
  [CORE_VIEWS]: ComponentHost[];
  [BASE_HREF]: string;
  [QUERY]: RouteQuery;
  [ROUTES]: ParsedRoute[];
  [MATCH_ROUTE]?: MatchedRoute[];
  [PARAMS]: RouteParams[];
  [ON_CHANGE]: Set<(matchedRoutePath: MatchedRoute[]) => void>;
}

export function createRouter({ baseHref, routes }: RouterOptions) {
  const core: RouterCore = {
    [VM_IGNORED]: true,
    [CORE_VIEWS]: [],
    [BASE_HREF]: normPath(baseHref ?? '/'),
    [QUERY]: vm({}),
    [ROUTES]: parseRoutes(routes),
    [PARAMS]: [],
    [ON_CHANGE]: new Set(),
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
  if (baseHref !== '/' && pathname.startsWith(baseHref)) {
    pathname = pathname.substring(baseHref.length - 1);
  }

  const matchedRoutePath = matchRoutes(pathname, core[ROUTES]) ?? [];
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
      updateHistoryState((routeDefine as RedirectRoute).redirectTo, true);
      return; // important!!
    } else if (routeType === ROUTE_TYPE_NEST) {
      const redirectTo = (routeDefine as NestRoute).redirectChild;
      if (redirectTo) {
        updateHistoryState(normPath(`${pathname}/${redirectTo}`), true);
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
  for (let i = x + 1; i < prevMatchedRoutePathLen; i++) {
    // 反过来，从深层级的 RouterView 到浅层级销毁。
    const idx = prevMatchedRoutePathLen - 1 - i;
    if (idx === 0 || idx >= views.length - 1) continue;
    const view = views[idx];
    destroyComponent(view);
  }

  search !== undefined && updateQuery(core, search);
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
      const vmParams = paramsList[i];
      Object.entries(mergedParams).forEach(([k, v]) => {
        vmParams[k] = v;
      });
    }
  }

  core[ON_CHANGE].forEach((fn) => fn(matchedRoutePath));

  if (!matchedRoutePathLen && views.length > 0) {
    renderView(views[0]);
    return;
  }
  if (x + 1 >= views.length) {
    return;
  }
  const view = views[x + 1];
  const [routeType, routeDefine] = matchedRoutePath[x + 1][0];
  if (routeType === ROUTE_TYPE_REDIRECT) throw new Error('assert-failed');
  else if (routeType === ROUTE_TYPE_NEST) {
    renderView(view, (routeDefine as NestRoute).component ?? RouterView);
  } else {
    renderView(view, (routeDefine as NormalRoute).component);
  }
}
