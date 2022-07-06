import { Component, ViewModelObject } from 'jinge';
import { MatchFunction, PathFunction } from 'path-to-regexp';

interface ComponentConstructor {
  create(attrs: Record<string, unknown>): Component;
}

/**
 * @internal
 */
export { ComponentConstructor };

export interface RouterView {
  /**
   * @internal
   */
  _shouldUpdateView(from: RouterInfo, to: RouterInfo): Promise<boolean>;
  /**
   * @internal
   */
  _prepareUpdateView(current: RouterInfo, route: RouteMatchPathItem): void;
  /**
   * @internal
   */
  _doUpdateView(err: unknown, current?: RouterInfo, route?: RouteMatchPathItem): void;
}
export type RouteParamsOrQuery = Record<string, unknown>;
/**
 * @internal
 */
export const VIEW_NAME_PATH = Symbol('#viewNamePath');
export type LoadComponentFn = (
  params: RouteParamsOrQuery,
  query: RouteParamsOrQuery,
  resolves: Record<string, unknown>,
) => ComponentConstructor | Promise<ComponentConstructor>;
export type LoadDependencyFn = (
  params: RouteParamsOrQuery,
  query: RouteParamsOrQuery,
  parentResolves: Record<string, unknown>,
) => unknown | Promise<unknown>;
export type RouteDependency = LoadDependencyFn | string | number | boolean | Record<string, unknown>;
export type RouteLocation = {
  name: string;
  params?: RouteParamsOrQuery;
  query?: RouteParamsOrQuery;
};
export type LoadRouteLocationFn = (
  params: RouteParamsOrQuery,
  query: RouteParamsOrQuery,
) => Promise<string | RouteLocation>;

export type RouteGuardFn<T = void> = (from: RouterInfo, to: RouterInfo) => void | T | Promise<void | T>;
export interface RouteDefine {
  path: string;
  name?: string;
  dynamic?: boolean;
  redirect?: string | RouteLocation | LoadRouteLocationFn;
  component?: LoadComponentFn | ComponentConstructor;
  components?: Record<string, LoadComponentFn | ComponentConstructor>;
  resolves?: {
    [k: string]: RouteDependency;
  };
  children?: RouteDefine[];
  onLeave?: RouteGuardFn<boolean>;
  onEnter?: RouteGuardFn;
}
export interface RouteMatchPathItem {
  route: RouteInstance;
  params: RouteParamsOrQuery;
  resolves?: Record<string, unknown>;
}
export type RouteMatchPath = RouteMatchPathItem[];
export interface RouterInfo extends ViewModelObject {
  /**
   * current location.pathname
   */
  _pathname: string;
  /**
   * match route path
   */
  _routePath: RouteMatchPath;
  /**
   * current url path parameters
   */
  params: RouteParamsOrQuery & ViewModelObject;
  /**
   * current url query
   */
  query: RouteParamsOrQuery & ViewModelObject;
}
export interface RouteInstance {
  name: string;
  define: RouteDefine;
  redirect?: string | RouteLocation | LoadRouteLocationFn;
  parent?: RouteInstance;
  p2r: { match: MatchFunction; toPath: PathFunction };
  components: Record<string, ComponentConstructor>;
  children?: RouteInstance[];
}

export type RouteJumpTarget = '_self' | '_blank';
export type RouteJumpOptions = {
  target?: RouteJumpTarget;
  replace?: boolean;
};
