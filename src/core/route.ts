import type { FC } from 'jinge';

import { type PathSegment, parsePath } from './path';

export type RouteParams = Record<string, string | number>;
export type RouteQuery = Record<string, string>;
interface Ctx {
  params: RouteParams;
  query: RouteQuery;
}
export interface RouteLoc extends Ctx {
  route: Route;
}
// export type GuardFn<T = void> = (from: RouteLoc, to: RouteLoc) => void | T | Promise<void | T>;
interface BaseRoute {
  /** 路由的唯一标识，没有特别的作用，仅用于比如 onBeforeEnter 这一类的守护回调可以更方便地识别是哪个路由。 */
  // id?: string;
  // onAfterLeave?: GuardFn<boolean>;
  // onBeforeEnter?: GuardFn;
}
export interface RedirectRoute extends BaseRoute {
  path: string;
  redirectTo: string | ((ctx: Ctx) => string);
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

export function parseRoute(routeDefine: Route) {
  let routeType: 0 | 1 | 2 | 3 = ROUTE_TYPE_NORMAL;
  if ((routeDefine as RedirectRoute).redirectTo) routeType = ROUTE_TYPE_REDIRECT;
  else if ((routeDefine as NestRoute).children) routeType = ROUTE_TYPE_NEST;
  else if (!(routeDefine as NormalRoute).path) routeType = ROUTE_TYPE_INDEX;

  const parsedRoute: ParsedRoute = [
    routeType,
    routeDefine,
    routeType === ROUTE_TYPE_INDEX ? undefined : parsePath((routeDefine as NormalRoute).path),
    routeType === ROUTE_TYPE_NEST
      ? (routeDefine as NestRoute).children.map((childRouteDefine) => parseRoute(childRouteDefine))
      : undefined,
  ];
  return parsedRoute;
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
    if (seg.type === 'lit') {
      if (seg.value !== v) return undefined;
    } else if (seg.type === 'num') {
      if (!/^\d+$/.test(v)) return undefined;
      params[seg.value ?? ''] = parseInt(v);
    } else {
      params[seg.value ?? ''] = v;
    }
    pi++;
  }
  if (routeType === ROUTE_TYPE_NEST) {
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
export function matchRoutes(pathname: string, routes: ParsedRoute[]) {
  const segs = pathname.split('/').slice(1); // pathname 一定以 / 打头，去掉第一个 ''
  for (const route of routes) {
    const matchedRoutePath = getMatchRoutePath(segs, route, 0);
    if (matchedRoutePath) return matchedRoutePath;
  }
  return undefined;
}
