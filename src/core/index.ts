import {
  type AnyFn,
  CONTEXT,
  type ComponentHost,
  type DeregisterFn,
  UPDATE_RENDER,
  arrayPushIfNotExist,
  arrayRemove,
  isComponent,
  isFunction,
  isObject,
  isString,
  registerEvent,
  vm,
} from 'jinge';
import { compile, match } from 'path-to-regexp';
import {
  type LoadRouteLocationFn,
  type GuardFn,
  type RouteInstance,
  type RouteLocation,
  type MatchRoute,
  LinkTarget,
  Route,
} from '../common';
import { cloneParamsOrQuery, encodeParamsOrQuery, isParamsOrQuerySameOrInclude } from '../util';
import {
  addGuard,
  addRoute,
  getPathnameAndSearch,
  matchRoutePath,
  normPath,
  parseQuery,
  rollback,
} from './helper';
import { prepareUpdateView, shouldUpdateView, updateErrView, updateView, ViewNode } from './view';
import { RouteInfo } from './info';

export const ROUTER_CORE = Symbol('routerCore');

export function getRouterCoreContext(comp: ComponentHost) {
  const router = comp[CONTEXT]?.[ROUTER_CORE] as RouterCore;
  if (!router) throw new Error('missing RouterCore context');
  return router;
}

export interface RouterOptions {
  mode: 'hash' | 'html5';
  baseHref?: string;
}
export class RouterCore {
  mode: 'hash' | 'html5';
  #started = false;
  #dereg?: () => void;
  routes: RouteInstance[] = [];
  routeInstanceMap = new Map<string, RouteInstance>();

  views = new Map<string, ViewNode>();

  info = new RouteInfo({}, {});

  #asyncKey = 0;
  readonly baseHref: string;

  beforeGuard = new Set<GuardFn<boolean>>();
  afterGuard = new Set<(from: RouteInfo, to: RouteInfo) => void>();

  constructor({ mode, baseHref = '/' }: RouterOptions) {
    this.mode = mode;
    baseHref = normPath(baseHref);
    if (!baseHref.endsWith('/')) {
      baseHref += '/';
    }
    this.baseHref = baseHref;
  }

  beforeEach(guardFn: GuardFn<boolean>): DeregisterFn {
    return addGuard(this.beforeGuard, guardFn);
  }

  afterEach(guardFn: GuardFn): DeregisterFn {
    return addGuard(this.afterGuard, guardFn);
  }

  register(route: Route): RouterCore {
    if (this.#started) {
      throw new Error("can't register after Router.start()");
    }
    addRoute(this.routeInstanceMap, route, this.routes);
    return this;
  }

  start() {
    if (this.#started) return;
    this.#started = true;

    const isHashMode = this.mode === 'hash';
    this.#dereg = registerEvent(
      window as unknown as HTMLElement,
      isHashMode ? 'hashchange' : 'popstate',
      isHashMode ? this.#onHashChange.bind(this) : this.#onStateChange.bind(this),
    );
    if (isHashMode) {
      this.#onHashChange();
    } else {
      this.#onStateChange();
    }
  }

  destroy() {
    if (!this.#started) return;
    this.#dereg?.();
  }

  #onHashChange() {
    const hash = location.hash.slice(1);
    const qi = hash.indexOf('?');
    this.#update(qi > 0 ? hash.substring(0, qi) : hash, qi > 0 ? hash.substring(qi + 1) : '').catch(
      (err) => console.error(err),
    );
  }

  #onStateChange() {
    this.#update(location.pathname, location.search ? location.search.substring(1) : '').catch(
      (err) => console.error(err),
    );
  }

  async #update(pathname: string, search?: string | RouteParamsOrQuery): Promise<void> {
    pathname = normPath(pathname);
    if (this.baseHref !== '/' && pathname.startsWith(this.baseHref)) {
      pathname = pathname.substring(this.baseHref.length - 1);
    }
    const query: RouteParamsOrQuery = (
      search
        ? isString(search)
          ? parseQuery(search as string)
          : cloneParamsOrQuery(search as RouteParamsOrQuery)
        : {}
    ) as RouteParamsOrQuery;

    /**
     * 由于路由跳转是异步过程，期间会有多处异步等待。如果某个路由还在跳转的过程中，
     * 业务层又发起了新的路由跳转，则应该忽略之前的跳转。
     */

    // 使用 asyncKey 和闭包配合来判断异步回调是否过期，如果过期则直接忽略接下来的逻辑。
    const asyncKey = ++this.#asyncKey;
    const currentInfo = this.info;

    /**
     * 如果 pathname 没有发生变化，说明不可能出现 router-view 的更新，
     * 可能是什么都没有变，或者 url 的 query 部分发生变化，这种情况下简单地将
     * 新的 query 赋值给旧的 query 既可，ViewModel 层面会自动将更新传递给业务组件。
     */
    if (pathname === currentInfo.pathname) {
      if (!isParamsOrQuerySameOrInclude(query, currentInfo.query)) {
        currentInfo.query = vm(query);
      }
      return;
    }

    // console.log('up', asyncKey);

    const newMatchPath = matchRoutePath(pathname, this.routes);
    if (newMatchPath.length === 0) {
      console.warn('no route match path:', pathname);
      return;
    }
    const last = newMatchPath[newMatchPath.length - 1];
    const newRouteInfo: CurrentRoute = vm({
      pathname: pathname,
      routePath: newMatchPath,
      query,
      // clone last route params as final params
      params: { ...last.params },
    });
    let redirect = last.route.redirect;

    if (redirect) {
      if (isFunction(redirect)) {
        redirect = await (redirect as LoadRouteLocationFn)(newRouteInfo.params, newRouteInfo.query);
        if (asyncKey !== this.#asyncKey) {
          return;
        }
      } else if (isString(redirect)) {
        redirect = {
          name: redirect as string,
          params: newRouteInfo.params,
          query: newRouteInfo.query,
        };
      }
      this.go(redirect as RouteLocation, {
        replace: true,
      });
      return;
    }

    let sameLevel = -1;
    let shouldUpdateParams = false;
    for (let i = 0; i < currentInfo.routePath.length; i++) {
      if (i >= newMatchPath.length) break;
      const oldIt = currentInfo.routePath[i];
      const newIt = newMatchPath[i];
      if (oldIt.route !== newIt.route) {
        break;
      }
      if (!isParamsOrQuerySameOrInclude(newIt.params, oldIt.params)) {
        if (newIt.route.define.dynamic) {
          oldIt.params = newIt.params;
          shouldUpdateParams = true;
        } else {
          break;
        }
      }
      sameLevel = i;
    }
    if (
      currentInfo.routePath.length === newMatchPath.length &&
      sameLevel === newMatchPath.length - 1
    ) {
      const shouldUpdateQuery = !isParamsOrQuerySameOrInclude(query, currentInfo.query);
      const oldRouteInfo =
        shouldUpdateQuery || shouldUpdateParams ? Object.assign({}, currentInfo) : currentInfo;
      if (shouldUpdateParams) {
        Object.assign(currentInfo.params, newRouteInfo.params);
        currentInfo.pathname = newRouteInfo.pathname;
      }
      if (shouldUpdateQuery) {
        Object.assign(currentInfo.query, query);
      }
      this.afterGuard.forEach((fn) => {
        fn(oldRouteInfo, newRouteInfo);
      });
      return;
    }

    const routeIdxToUpdate = sameLevel + 1;
    const viewsToUpdate = getViewsToUpdate(this.views, routeIdxToUpdate);
    for (let i = 0; i < viewsToUpdate.length; i++) {
      const vtp = viewsToUpdate[i];
      const shouldUpdate = await shouldUpdateView(vtp.component, currentInfo, newRouteInfo);
      // console.log(asyncKey, this.__asyncKey);
      if (asyncKey !== this.#asyncKey) {
        /**
         * 由于异步等待的过程中，路由有可能会再次发生变化，
         * 通过闭包变量的方式，保证上下文逻辑响应同一次的路由变化。
         */
        return;
      }
      if (shouldUpdate === false) {
        /**
         * 由于浏览器并不能截获 url 变化，只能是在 url 已经变化后响应。
         * 因此，如果业务层（通过 __routeShouldLeave 回调）阻止了路由的变化，
         * 则需要恢复浏览器 url 。
         */
        return rollback(currentInfo, this.mode);
      }
    }

    if (currentInfo.routePath.length > routeIdxToUpdate) {
      /**
       * 通知通过 router.beforeEach() 注册的守护函数路由即将跳转。
       * 如果守护函数显式地返回 `false`，则会阻止路由切换。
       */
      for await (const fn of this.beforeGuard) {
        const shouldLeave = await fn(currentInfo, newRouteInfo);
        if (this.#asyncKey !== asyncKey) {
          return;
        }
        if (shouldLeave === false) {
          return rollback(currentInfo, this.mode);
        }
      }
      /**
       * 通知即将变更的路由 onLeave 回调。当前版本只会通知最顶部的路由。
       * 未来版本要考虑可能子路由也应该通知？
       *
       * onLeave 回调返回显式地 `false`，则会阻止路由的切换。
       */
      const routeDef = currentInfo.routePath[routeIdxToUpdate].route.define;
      if (isFunction(routeDef.onLeave)) {
        const shouldLeave = await routeDef.onLeave(currentInfo, newRouteInfo);
        if (this.#asyncKey !== asyncKey) {
          return;
        }
        if (shouldLeave === false) {
          return rollback(currentInfo, this.mode);
        }
      }
    }

    viewsToUpdate.forEach((vtp) => {
      vtp.views.clear();
      if (vtp.doc === 'before') {
        prepareUpdateView(vtp.component);
      }
    });

    if (newRouteInfo.routePath.length > routeIdxToUpdate) {
      for (let i = routeIdxToUpdate; i < newRouteInfo.routePath.length; i++) {
        const routeDef = newRouteInfo.routePath[i].route.define;
        if (isFunction(routeDef.onEnter)) {
          await routeDef.onEnter(currentInfo, newRouteInfo);
          if (this.#asyncKey !== asyncKey) {
            return;
          }
        }
      }
    }

    let parentResolves = newMatchPath.slice(0, routeIdxToUpdate).reduce(
      (pv, it) => {
        return Object.assign(pv, it.resolves);
      },
      {} as Record<string, unknown>,
    );

    for (let i = routeIdxToUpdate; i < newMatchPath.length; i++) {
      const matchedRoute = newMatchPath[i];
      const resolveDefs = matchedRoute.route.define.resolves;
      const currentResolves = { ...parentResolves };
      const promises: Promise<unknown>[] = [];
      resolveDefs &&
        Object.keys(resolveDefs).forEach((k) => {
          const resolveOrFn = resolveDefs[k];
          if (isFunction(resolveOrFn)) {
            try {
              const rtn = (resolveOrFn as LoadDependencyFn)(
                matchedRoute.params,
                newRouteInfo.query,
                parentResolves,
              );
              if (
                isObject(rtn) &&
                isFunction((rtn as { then: (value: unknown) => Promise<void> }).then)
              ) {
                promises.push(
                  (rtn as { then: (value: unknown) => Promise<void> }).then((rr: unknown) => {
                    currentResolves[k] = rr;
                  }),
                );
              } else {
                currentResolves[k] = rtn;
              }
            } catch (ex) {
              viewsToUpdate.forEach((vtp) => {
                updateErrView(vtp.component, ex);
              });
              throw ex;
            }
          } else {
            currentResolves[k] = resolveOrFn;
          }
        });

      let loadedComClasses = matchedRoute.route.components;
      if (!loadedComClasses) {
        const comClasses = matchedRoute.route.define.components || {};
        loadedComClasses = {};
        if (matchedRoute.route.define.component) {
          comClasses.default = matchedRoute.route.define.component;
        }
        Object.keys(comClasses).forEach((cn) => {
          const FuncComp = comClasses[cn];
          if (isFunction(FuncComp) && !isComponent(FuncComp)) {
            try {
              const r = (FuncComp as LoadComponentFn)(
                matchedRoute.params,
                newRouteInfo.query,
                currentResolves,
              );
              if (isObject(r) && isFunction((r as Promise<AnyFn>).then)) {
                promises.push(
                  (r as Promise<AnyFn>).then((rr) => {
                    loadedComClasses[cn] = rr;
                  }),
                );
              } else {
                loadedComClasses[cn] = FuncComp as unknown as AnyFn;
              }
            } catch (ex) {
              viewsToUpdate.forEach((vtp) => {
                updateErrView(vtp.component, ex);
              });
              throw ex;
            }
          } else {
            loadedComClasses[cn] = FuncComp as AnyFn;
          }
        });
      }

      try {
        await Promise.all(promises);
      } catch (ex) {
        if (asyncKey === this.#asyncKey) {
          viewsToUpdate.forEach((vtp) => {
            updateErrView(vtp.component, ex);
          });
        }
        throw ex;
      }
      // 如果回调已经过期，或组件已被销毁，直接忽略后续逻辑。
      if (asyncKey !== this.#asyncKey) {
        return;
      }
      matchedRoute.route.components = loadedComClasses;
      matchedRoute.resolves = currentResolves;
      parentResolves = currentResolves;
    }

    const oldRouteInfo = Object.assign({}, currentInfo);
    Object.assign(currentInfo, newRouteInfo);

    viewsToUpdate.forEach((vtp) => {
      updateView(vtp.component, vtp.name, newRouteInfo, newMatchPath[routeIdxToUpdate]);
    });

    this.afterGuard.forEach((fn) => {
      fn(oldRouteInfo, newRouteInfo);
    });
  }

  /**
   * current location url path parameters
   */
  get params(): RouteParamsOrQuery {
    return this.info?.params;
  }

  /**
   * current location url query/search
   */
  get query(): RouteParamsOrQuery {
    return this.info?.query;
  }

  /**
   * current matched route
   */
  get current(): MatchRoute {
    const rp = this.info.routePath;
    if (!rp || rp.length === 0) throw new Error('route match not found');
    return rp[rp.length - 1];
  }

  includes(destination: string | RouteLocation, checkQuery = false): boolean {
    if (!this.info || this.info.routePath.length === 0) return false;
    if (isString(destination)) {
      destination = { name: destination as string };
    }
    const name = destination.name;
    const route = this.routeInstanceMap.get(name);
    if (!route) {
      return false;
    }
    if (
      checkQuery &&
      destination.query &&
      !isParamsOrQuerySameOrInclude(destination.query ?? {}, this.info.query, false)
    ) {
      return false;
    }
    return (
      this.info.routePath.findIndex((it) => {
        return (
          it.route === route &&
          isParamsOrQuerySameOrInclude(destination.params ?? {}, it.params, false)
        );
      }) >= 0
    );
  }

  href(destination: string | RouteLocation): string {
    const pathAndSearch = getPathnameAndSearch(destination, this.routeInstanceMap, this.baseHref);
    if (!pathAndSearch) {
      return '';
    }
    const { pathname, search } = pathAndSearch;
    const path = search ? `${pathname}?${search}` : pathname;
    return this.mode === 'hash' ? `#${path}` : path;
  }

  go(
    destination: string | RouteLocation,
    {
      target = '_self',
      replace = false,
    }: {
      target?: LinkTarget;
      replace?: boolean;
    } = {
      target: '_self',
      replace: false,
    },
  ) {
    const pathAndSearch = getPathnameAndSearch(destination, this.routeInstanceMap, this.baseHref);
    if (!pathAndSearch) {
      return;
    }
    const { pathname, search } = pathAndSearch;
    const path = search ? `${pathname}?${search}` : pathname;
    const isHashMode = this.mode === 'hash';
    const url = isHashMode ? `${location.pathname}#${path}` : path;

    if (target === '_blank') {
      window.open(url, '_blank');
      return;
    }
    if (replace) {
      history.replaceState(null, '', url);
    } else {
      history.pushState(null, '', url);
    }
    this._update(pathname, (destination as RouteLocation).query);
  }
}
