import type { AnyFn } from 'jinge';
import type { MatchFunction, PathFunction } from 'path-to-regexp';
import type { RouteInfo } from './core/info';

export const VIEW_NAME_PATH = Symbol('#viewNamePath');

interface Ctx {
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  data?: Record<string, unknown>;
}
export type RouteLocation = ({ path: string } | { name: string }) & {
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
};

export type LoadRouteLocationFn = (ctx: Ctx) => Promise<string | RouteLocation>;

export type GuardFn<T = void> = (from: RouteInfo, to: RouteInfo) => void | T | Promise<void | T>;

type LoadComponentFn = (ctx: Ctx) => AnyFn | Promise<AnyFn>;
interface BaseRoute {
  onLeave?: GuardFn<boolean>;
  onEnter?: GuardFn;
  loader?: (ctx: Ctx) => Record<string, unknown> | Promise<Record<string, unknown>>;
}
export interface RedirectRoute extends BaseRoute {
  redirectTo: RouteLocation;
}
export type NormalRoute = BaseRoute & {
  path: string;
  name?: string;
  children?: Route[];
} & (
    | { component: AnyFn | Record<string, AnyFn> }
    | {
        lazyComponent: LoadComponentFn | Record<string, LoadComponentFn>;
      }
  );
export type Route = NormalRoute | RedirectRoute;

export interface MatchRoute {
  route: RouteInstance;
  params?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

export interface RouteInstance {
  name: string;
  define: Route;
  redirect?: string | RouteLocation | LoadRouteLocationFn;
  parent?: RouteInstance;
  p2r: { match: MatchFunction<any>; toPath: PathFunction<any> };
  components: Record<string, AnyFn>;
  children?: RouteInstance[];
}

export type LinkTarget = '_self' | '_blank';
