import type { FC } from 'jinge';

import { PATH_TYPE_ANY, PATH_TYPE_LIT, PATH_TYPE_NUM, type PathSegment, parsePath } from './path';

export type RouteParams = Record<string, string | number>;
export type RouteQuery = Record<string, string>;

// export type GuardFn<T = void> = (from: RouteLoc, to: RouteLoc) => void | T | Promise<void | T>;
interface BaseRoute {
  /** 路由的唯一标识，没有特别的作用，仅用于比如 onBeforeEnter 这一类的守护回调可以更方便地识别是哪个路由。 */
  // id?: string;
  // onAfterLeave?: GuardFn<boolean>;
  // onBeforeEnter?: GuardFn;
}
export interface RedirectRoute extends BaseRoute {
  path: string;
  redirectTo: string;
}
export type NormalRoute = BaseRoute & {
  path: string;
  component: FC;
};
export type IndexRoute = BaseRoute & {
  component: FC;
};
export type NestRoute = BaseRoute & {
  path: string;
  component?: FC;
  redirectChild?: string;
  children: Route[];
};
export type Route = NormalRoute | RedirectRoute | IndexRoute | NestRoute;

export const ROUTE_TYPE_NORMAL = 0;
export const ROUTE_TYPE_INDEX = 1;
export const ROUTE_TYPE_REDIRECT = 2;
export const ROUTE_TYPE_NEST = 3;

export type ParsedRoute = [
  0 | 1 | 2 | 3,
  Route,
  PathSegment[] | undefined,
  ParsedRoute[] | undefined,
];

function getRouteSortWeight(r: ParsedRoute) {
  const path = r[2];
  if (!path?.length) return 0;
  const anyIdx = path.findIndex((p) => p.type === PATH_TYPE_ANY);
  if (anyIdx < 0) return 1;
  /** any(星号)越靠前的路由权重越大（理论上不可能有超过 0xffff 长度的路由），优先级越低，越放在后面去判定匹配。 */
  return 0xffff - anyIdx;
}
export function parseRoutes(routeDefines: Route[]) {
  let hasIndex = false;
  const routes = routeDefines.map((routeDefine) => {
    let routeType: 0 | 1 | 2 | 3 = ROUTE_TYPE_NORMAL;
    if ((routeDefine as RedirectRoute).redirectTo) routeType = ROUTE_TYPE_REDIRECT;
    else if ((routeDefine as NestRoute).children) routeType = ROUTE_TYPE_NEST;
    else if (!(routeDefine as NormalRoute).path) {
      if (hasIndex) throw new Error('Index 路由不能重复定义');
      routeType = ROUTE_TYPE_INDEX;
      hasIndex = true;
    }

    const parsedRoute: ParsedRoute = [
      routeType,
      routeDefine,
      routeType === ROUTE_TYPE_INDEX
        ? undefined
        : parsePath((routeDefine as NormalRoute).path, routeType === ROUTE_TYPE_NEST),
      routeType === ROUTE_TYPE_NEST ? parseRoutes((routeDefine as NestRoute).children) : undefined,
    ];
    return parsedRoute;
  });

  routes.sort((ra, rb) => {
    const wa = getRouteSortWeight(ra);
    const wb = getRouteSortWeight(rb);
    return wa > wb ? 1 : wa < wb ? -1 : 0;
  });
  // console.log(routes);
  return routes;
}

export type MatchedRoute = [ParsedRoute, RouteParams];

function getMatchRoutePath(
  pathSegs: string[],
  route: ParsedRoute,
  pi: number,
): MatchedRoute[] | undefined {
  const [routeType, , routePathSegs, children] = route;
  if (!routePathSegs) return undefined;
  if (pathSegs.length - pi < routePathSegs.length) return undefined;
  const params: RouteParams = {};
  for (const seg of routePathSegs) {
    const v = pathSegs[pi];
    if (seg.type === PATH_TYPE_ANY) {
      // 星号直接匹配成功
      return [[route, params]];
    } else if (seg.type === PATH_TYPE_LIT) {
      if (seg.value !== v) return undefined;
    } else if (seg.type === PATH_TYPE_NUM) {
      if (!/^\d+$/.test(v)) return undefined;
      params[seg.value ?? ''] = parseInt(v);
    } else {
      params[seg.value ?? ''] = v;
    }
    pi++;
  }
  if (routeType === ROUTE_TYPE_NEST && pi < pathSegs.length) {
    for (const childRoute of children!) {
      const childMatchedRoutePath = getMatchRoutePath(pathSegs, childRoute, pi);
      if (childMatchedRoutePath) {
        return [[route, params], ...childMatchedRoutePath];
      }
    }
    return undefined;
  } else if (pi !== pathSegs.length) {
    return undefined;
  } else {
    return [[route, params]];
  }
}
export function matchRoutes(pathSegs: string[], routes: ParsedRoute[]) {
  for (const route of routes) {
    const matchedRoutePath = getMatchRoutePath(pathSegs, route, 0);
    if (matchedRoutePath) return matchedRoutePath;
  }
  return undefined;
}
