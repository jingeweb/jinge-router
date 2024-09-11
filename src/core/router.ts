// import {
//   type AnyFn,
//   CONTEXT,
//   type ComponentHost,
//   type DeregisterFn,
//   UPDATE_RENDER,
//   VM_IGNORED,
//   arrayPushIfNotExist,
//   arrayRemove,
//   isComponent,
//   isFunction,
//   isObject,
//   isString,
//   registerEvent,
//   vm,
// } from 'jinge';
// import { compile, match } from 'path-to-regexp';
// import type {
//   GuardFn,
//   LinkTarget,
//   LoadRouteLocationFn,
//   MatchRoute,
//   Route,
//   RouteInstance,
//   RouteLocation,
// } from '../common';
// import { cloneParamsOrQuery, encodeParamsOrQuery, isParamsOrQuerySameOrInclude } from '../util';
// import {
//   addGuard,
//   addRoute,
//   getPathnameAndSearch,
//   matchRoutePath,
//   normPath,
//   parseQuery,
//   rollback,
// } from './helper';
// import {
//   type ViewNode,
//   prepareUpdateView,
//   shouldUpdateView,
//   updateErrView,
//   updateView,
// } from './view';
// import { RouteInfo } from './info';

import { CONTEXT, type ComponentHost, VM_IGNORED, VM_RAW, type ViewModel, vm } from 'jinge';
import { normPath } from './helper';
import {
  type GuardFn,
  type MatchedRoute,
  type ParsedRoute,
  type Route,
  matchRoutes,
  parseRoute,
} from './route';

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

// export interface RouterOptions {
//   mode: 'hash' | 'html5';
//   baseHref?: string;
// }
// export class Html5Router {
//   #started = false;
//   #dereg?: () => void;
//   routes: RouteInstance[] = [];
//   routeInstanceMap = new Map<string, RouteInstance>();

//   views = new Map<string, ViewNode>();

//   info = new RouteInfo({}, {});

//   #asyncKey = 0;
//   readonly baseHref: string;

//   beforeGuard = new Set<GuardFn<boolean>>();
//   afterGuard = new Set<(from: RouteInfo, to: RouteInfo) => void>();

//   constructor({ mode, baseHref = '/' }: RouterOptions) {
//     this.mode = mode;
//     baseHref = normPath(baseHref);
//     if (!baseHref.endsWith('/')) {
//       baseHref += '/';
//     }
//     this.baseHref = baseHref;
//   }

//   beforeEach(guardFn: GuardFn<boolean>): DeregisterFn {
//     return addGuard(this.beforeGuard, guardFn);
//   }

//   afterEach(guardFn: GuardFn): DeregisterFn {
//     return addGuard(this.afterGuard, guardFn);
//   }

//   register(route: Route): RouterCore {
//     if (this.#started) {
//       throw new Error("can't register after Router.start()");
//     }
//     addRoute(this.routeInstanceMap, route, this.routes);
//     return this;
//   }

//   start() {
//     if (this.#started) return;
//     this.#started = true;

//     const isHashMode = this.mode === 'hash';
//     this.#dereg = registerEvent(
//       window as unknown as HTMLElement,
//       isHashMode ? 'hashchange' : 'popstate',
//       isHashMode ? this.#onHashChange.bind(this) : this.#onStateChange.bind(this),
//     );
//     if (isHashMode) {
//       this.#onHashChange();
//     } else {
//       this.#onStateChange();
//     }
//   }

//   destroy() {
//     if (!this.#started) return;
//     this.#dereg?.();
//   }

//   #onHashChange() {
//     const hash = location.hash.slice(1);
//     const qi = hash.indexOf('?');
//     this.#update(qi > 0 ? hash.substring(0, qi) : hash, qi > 0 ? hash.substring(qi + 1) : '').catch(
//       (err) => console.error(err),
//     );
//   }

//   #onStateChange() {
//     this.#update(location.pathname, location.search ? location.search.substring(1) : '').catch(
//       (err) => console.error(err),
//     );
//   }

//   /**
//    * current location url path parameters
//    */
//   get params(): RouteParamsOrQuery {
//     return this.info?.params;
//   }

//   /**
//    * current location url query/search
//    */
//   get query(): RouteParamsOrQuery {
//     return this.info?.query;
//   }

//   /**
//    * current matched route
//    */
//   get current(): MatchRoute {
//     const rp = this.info.routePath;
//     if (!rp || rp.length === 0) throw new Error('route match not found');
//     return rp[rp.length - 1];
//   }

//   includes(destination: string | RouteLocation, checkQuery = false): boolean {
//     if (!this.info || this.info.routePath.length === 0) return false;
//     if (isString(destination)) {
//       destination = { name: destination as string };
//     }
//     const name = destination.name;
//     const route = this.routeInstanceMap.get(name);
//     if (!route) {
//       return false;
//     }
//     if (
//       checkQuery &&
//       destination.query &&
//       !isParamsOrQuerySameOrInclude(destination.query ?? {}, this.info.query, false)
//     ) {
//       return false;
//     }
//     return (
//       this.info.routePath.findIndex((it) => {
//         return (
//           it.route === route &&
//           isParamsOrQuerySameOrInclude(destination.params ?? {}, it.params, false)
//         );
//       }) >= 0
//     );
//   }

//   href(destination: string | RouteLocation): string {
//     const pathAndSearch = getPathnameAndSearch(destination, this.routeInstanceMap, this.baseHref);
//     if (!pathAndSearch) {
//       return '';
//     }
//     const { pathname, search } = pathAndSearch;
//     const path = search ? `${pathname}?${search}` : pathname;
//     return this.mode === 'hash' ? `#${path}` : path;
//   }

//   go(
//     destination: string | RouteLocation,
//     {
//       target = '_self',
//       replace = false,
//     }: {
//       target?: LinkTarget;
//       replace?: boolean;
//     } = {
//       target: '_self',
//       replace: false,
//     },
//   ) {
//     const pathAndSearch = getPathnameAndSearch(destination, this.routeInstanceMap, this.baseHref);
//     if (!pathAndSearch) {
//       return;
//     }
//     const { pathname, search } = pathAndSearch;
//     const path = search ? `${pathname}?${search}` : pathname;
//     const isHashMode = this.mode === 'hash';
//     const url = isHashMode ? `${location.pathname}#${path}` : path;

//     if (target === '_blank') {
//       window.open(url, '_blank');
//       return;
//     }
//     if (replace) {
//       history.replaceState(null, '', url);
//     } else {
//       history.pushState(null, '', url);
//     }
//     this._update(pathname, (destination as RouteLocation).query);
//   }
// }

export interface RouterOptions {
  routes: Route[];
  onBeforeEach?: GuardFn;
  onAfterEach?: GuardFn;
  baseHref?: string;
}

export const CORE_VIEWS = Symbol('coreViews');
export const BASE_HREF = Symbol('baseHref');
export const QUERY = Symbol('query');
export const ROUTES = Symbol('routes');
export const MATCH_ROUTE = Symbol('matchRoute');

function createQuery() {
  const sp = new URLSearchParams();
  const query = new Proxy(sp, {
    get(target, p) {
      if (p === VM_RAW) return undefined;
      if (p === VM_IGNORED) return false;
      return target.get(p as string);
    },
    set(target, p, v) {
      target.set(p as string, v);
      return true;
    },
  });
  return vm(query); // 使用 vm 包裹后，业务层通过 useQuery() 拿到的 query 可以 watch 监听
}

export interface RouterCore {
  [VM_IGNORED]: true;
  [CORE_VIEWS]: ComponentHost[];
  [BASE_HREF]: string;
  [QUERY]: Record<string, string>;
  [ROUTES]: ParsedRoute[];
  [MATCH_ROUTE]?: MatchedRoute[];
}

export function createRouter({ baseHref, routes }: RouterOptions) {
  const core: RouterCore = {
    [VM_IGNORED]: true,
    [CORE_VIEWS]: [],
    [BASE_HREF]: normPath(baseHref ?? '/'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [QUERY]: createQuery() as any,
    [ROUTES]: routes.map((routeDefine) => parseRoute(routeDefine)),
  };
  return core;
}

export function updateQuery(core: RouterCore, search: string) {
  const newSp = new URLSearchParams(search);
  const query = core[QUERY] as ViewModel;
  const oldSp = query[VM_RAW] as URLSearchParams;
  for (const k of oldSp.keys()) {
    if (!newSp.has(k)) {
      query[k] = undefined; // 先将 query[k] 置为 undefined，触发 ViewModel 的变更及变更通知。
      oldSp.delete(k);
    } else {
      query[k] = newSp.get(k);
    }
  }
  for (const k of newSp.keys()) {
    if (!oldSp.has(k)) {
      query[k] = newSp.get(k);
    }
  }
}

export async function updateLocation(core: RouterCore, pathname: string, search: string) {
  pathname = normPath(pathname);
  const baseHref = core[BASE_HREF];
  if (baseHref !== '/' && pathname.startsWith(baseHref)) {
    pathname = pathname.substring(baseHref.length - 1);
  }

  const matchedRoutePath = matchRoutes(pathname, core[ROUTES]);
  const prevMatchedRoutePath = core[MATCH_ROUTE];

  // /**
  //  * 由于路由跳转是异步过程，期间会有多处异步等待。如果某个路由还在跳转的过程中，
  //  * 业务层又发起了新的路由跳转，则应该忽略之前的跳转。
  //  */

  // // 使用 asyncKey 和闭包配合来判断异步回调是否过期，如果过期则直接忽略接下来的逻辑。
  // const asyncKey = ++this.#asyncKey;
  // const currentInfo = this.info;

  // // console.log('up', asyncKey);

  // const newMatchPath = matchRoutePath(pathname, this.routes);
  // if (newMatchPath.length === 0) {
  //   console.warn('no route match path:', pathname);
  //   return;
  // }
  // const last = newMatchPath[newMatchPath.length - 1];
  // const newRouteInfo: CurrentRoute = vm({
  //   pathname: pathname,
  //   routePath: newMatchPath,
  //   query,
  //   // clone last route params as final params
  //   params: { ...last.params },
  // });
  // let redirect = last.route.redirect;

  // if (redirect) {
  //   if (isFunction(redirect)) {
  //     redirect = await (redirect as LoadRouteLocationFn)(newRouteInfo.params, newRouteInfo.query);
  //     if (asyncKey !== this.#asyncKey) {
  //       return;
  //     }
  //   } else if (isString(redirect)) {
  //     redirect = {
  //       name: redirect as string,
  //       params: newRouteInfo.params,
  //       query: newRouteInfo.query,
  //     };
  //   }
  //   this.go(redirect as RouteLocation, {
  //     replace: true,
  //   });
  //   return;
  // }

  // let sameLevel = -1;
  // let shouldUpdateParams = false;
  // for (let i = 0; i < currentInfo.routePath.length; i++) {
  //   if (i >= newMatchPath.length) break;
  //   const oldIt = currentInfo.routePath[i];
  //   const newIt = newMatchPath[i];
  //   if (oldIt.route !== newIt.route) {
  //     break;
  //   }
  //   if (!isParamsOrQuerySameOrInclude(newIt.params, oldIt.params)) {
  //     if (newIt.route.define.dynamic) {
  //       oldIt.params = newIt.params;
  //       shouldUpdateParams = true;
  //     } else {
  //       break;
  //     }
  //   }
  //   sameLevel = i;
  // }
  // if (
  //   currentInfo.routePath.length === newMatchPath.length &&
  //   sameLevel === newMatchPath.length - 1
  // ) {
  //   const shouldUpdateQuery = !isParamsOrQuerySameOrInclude(query, currentInfo.query);
  //   const oldRouteInfo =
  //     shouldUpdateQuery || shouldUpdateParams ? Object.assign({}, currentInfo) : currentInfo;
  //   if (shouldUpdateParams) {
  //     Object.assign(currentInfo.params, newRouteInfo.params);
  //     currentInfo.pathname = newRouteInfo.pathname;
  //   }
  //   if (shouldUpdateQuery) {
  //     Object.assign(currentInfo.query, query);
  //   }
  //   this.afterGuard.forEach((fn) => {
  //     fn(oldRouteInfo, newRouteInfo);
  //   });
  //   return;
  // }

  // const routeIdxToUpdate = sameLevel + 1;
  // const viewsToUpdate = getViewsToUpdate(this.views, routeIdxToUpdate);
  // for (let i = 0; i < viewsToUpdate.length; i++) {
  //   const vtp = viewsToUpdate[i];
  //   const shouldUpdate = await shouldUpdateView(vtp.component, currentInfo, newRouteInfo);
  //   // console.log(asyncKey, this.__asyncKey);
  //   if (asyncKey !== this.#asyncKey) {
  //     /**
  //      * 由于异步等待的过程中，路由有可能会再次发生变化，
  //      * 通过闭包变量的方式，保证上下文逻辑响应同一次的路由变化。
  //      */
  //     return;
  //   }
  //   if (shouldUpdate === false) {
  //     /**
  //      * 由于浏览器并不能截获 url 变化，只能是在 url 已经变化后响应。
  //      * 因此，如果业务层（通过 __routeShouldLeave 回调）阻止了路由的变化，
  //      * 则需要恢复浏览器 url 。
  //      */
  //     return rollback(currentInfo, this.mode);
  //   }
  // }

  // if (currentInfo.routePath.length > routeIdxToUpdate) {
  //   /**
  //    * 通知通过 router.beforeEach() 注册的守护函数路由即将跳转。
  //    * 如果守护函数显式地返回 `false`，则会阻止路由切换。
  //    */
  //   for await (const fn of this.beforeGuard) {
  //     const shouldLeave = await fn(currentInfo, newRouteInfo);
  //     if (this.#asyncKey !== asyncKey) {
  //       return;
  //     }
  //     if (shouldLeave === false) {
  //       return rollback(currentInfo, this.mode);
  //     }
  //   }
  //   /**
  //    * 通知即将变更的路由 onLeave 回调。当前版本只会通知最顶部的路由。
  //    * 未来版本要考虑可能子路由也应该通知？
  //    *
  //    * onLeave 回调返回显式地 `false`，则会阻止路由的切换。
  //    */
  //   const routeDef = currentInfo.routePath[routeIdxToUpdate].route.define;
  //   if (isFunction(routeDef.onLeave)) {
  //     const shouldLeave = await routeDef.onLeave(currentInfo, newRouteInfo);
  //     if (this.#asyncKey !== asyncKey) {
  //       return;
  //     }
  //     if (shouldLeave === false) {
  //       return rollback(currentInfo, this.mode);
  //     }
  //   }
  // }

  // viewsToUpdate.forEach((vtp) => {
  //   vtp.views.clear();
  //   if (vtp.doc === 'before') {
  //     prepareUpdateView(vtp.component);
  //   }
  // });

  // if (newRouteInfo.routePath.length > routeIdxToUpdate) {
  //   for (let i = routeIdxToUpdate; i < newRouteInfo.routePath.length; i++) {
  //     const routeDef = newRouteInfo.routePath[i].route.define;
  //     if (isFunction(routeDef.onEnter)) {
  //       await routeDef.onEnter(currentInfo, newRouteInfo);
  //       if (this.#asyncKey !== asyncKey) {
  //         return;
  //       }
  //     }
  //   }
  // }

  // let parentResolves = newMatchPath.slice(0, routeIdxToUpdate).reduce(
  //   (pv, it) => {
  //     return Object.assign(pv, it.resolves);
  //   },
  //   {} as Record<string, unknown>,
  // );

  // for (let i = routeIdxToUpdate; i < newMatchPath.length; i++) {
  //   const matchedRoute = newMatchPath[i];
  //   const resolveDefs = matchedRoute.route.define.resolves;
  //   const currentResolves = { ...parentResolves };
  //   const promises: Promise<unknown>[] = [];
  //   resolveDefs &&
  //     Object.keys(resolveDefs).forEach((k) => {
  //       const resolveOrFn = resolveDefs[k];
  //       if (isFunction(resolveOrFn)) {
  //         try {
  //           const rtn = (resolveOrFn as LoadDependencyFn)(
  //             matchedRoute.params,
  //             newRouteInfo.query,
  //             parentResolves,
  //           );
  //           if (
  //             isObject(rtn) &&
  //             isFunction((rtn as { then: (value: unknown) => Promise<void> }).then)
  //           ) {
  //             promises.push(
  //               (rtn as { then: (value: unknown) => Promise<void> }).then((rr: unknown) => {
  //                 currentResolves[k] = rr;
  //               }),
  //             );
  //           } else {
  //             currentResolves[k] = rtn;
  //           }
  //         } catch (ex) {
  //           viewsToUpdate.forEach((vtp) => {
  //             updateErrView(vtp.component, ex);
  //           });
  //           throw ex;
  //         }
  //       } else {
  //         currentResolves[k] = resolveOrFn;
  //       }
  //     });

  //   let loadedComClasses = matchedRoute.route.components;
  //   if (!loadedComClasses) {
  //     const comClasses = matchedRoute.route.define.components || {};
  //     loadedComClasses = {};
  //     if (matchedRoute.route.define.component) {
  //       comClasses.default = matchedRoute.route.define.component;
  //     }
  //     Object.keys(comClasses).forEach((cn) => {
  //       const FuncComp = comClasses[cn];
  //       if (isFunction(FuncComp) && !isComponent(FuncComp)) {
  //         try {
  //           const r = (FuncComp as LoadComponentFn)(
  //             matchedRoute.params,
  //             newRouteInfo.query,
  //             currentResolves,
  //           );
  //           if (isObject(r) && isFunction((r as Promise<AnyFn>).then)) {
  //             promises.push(
  //               (r as Promise<AnyFn>).then((rr) => {
  //                 loadedComClasses[cn] = rr;
  //               }),
  //             );
  //           } else {
  //             loadedComClasses[cn] = FuncComp as unknown as AnyFn;
  //           }
  //         } catch (ex) {
  //           viewsToUpdate.forEach((vtp) => {
  //             updateErrView(vtp.component, ex);
  //           });
  //           throw ex;
  //         }
  //       } else {
  //         loadedComClasses[cn] = FuncComp as AnyFn;
  //       }
  //     });
  //   }

  //   try {
  //     await Promise.all(promises);
  //   } catch (ex) {
  //     if (asyncKey === this.#asyncKey) {
  //       viewsToUpdate.forEach((vtp) => {
  //         updateErrView(vtp.component, ex);
  //       });
  //     }
  //     throw ex;
  //   }
  //   // 如果回调已经过期，或组件已被销毁，直接忽略后续逻辑。
  //   if (asyncKey !== this.#asyncKey) {
  //     return;
  //   }
  //   matchedRoute.route.components = loadedComClasses;
  //   matchedRoute.resolves = currentResolves;
  //   parentResolves = currentResolves;
  // }

  // const oldRouteInfo = Object.assign({}, currentInfo);
  // Object.assign(currentInfo, newRouteInfo);

  // viewsToUpdate.forEach((vtp) => {
  //   updateView(vtp.component, vtp.name, newRouteInfo, newMatchPath[routeIdxToUpdate]);
  // });

  // this.afterGuard.forEach((fn) => {
  //   fn(oldRouteInfo, newRouteInfo);
  // });
}
