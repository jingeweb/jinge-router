import {
  isString,
  isObject,
  isComponent,
  vm,
  warn,
  isFunction,
  registerEvent,
  arrayPushIfNotExist,
  arrayRemove,
  DeregisterFn,
} from 'jinge';
import { match, compile } from 'path-to-regexp';
import {
  RouterView,
  RouteDefine,
  RouteParamsOrQuery,
  RouteJumpOptions,
  RouteMatchPathItem,
  RouteGuardFn,
  LoadDependencyFn,
  RouteMatchPath,
  RouteInstance,
  RouterInfo,
  RouteLocation,
  LoadRouteLocationFn,
  LoadComponentFn,
  ComponentConstructor,
} from './common';
import { RouterParentComponent } from './components/redirect';
import { cloneParamsOrQuery, encodeParamsOrQuery, isParamsOrQuerySameOrInclude } from './util';

export interface RouterOptions {
  mode: 'hash' | 'html5';
  baseHref?: string;
}

function normPath(p: string): string {
  if (!p || !p.startsWith('/')) p = '/' + p;
  return p.replace(/[/\\]+/g, '/');
}

function parseVal(v: unknown): string | number | boolean {
  if (v === 'true') {
    return true;
  } else if (v === 'false') {
    return false;
  } else if (/^\d+$/.test(v as string)) {
    return Number(v);
  } else {
    return v as string;
  }
}

function parseQuery(search: string): Record<string, string | boolean | number> {
  const segments = search
    .split('&')
    .map((s) => s.trim())
    .filter((s) => !!s);
  if (segments.length === 0) return {};
  return Object.fromEntries(
    segments.map((seg) => {
      const pair = seg.split('=').map(decodeURIComponent);
      return [pair[0], pair.length <= 1 ? true : parseVal(pair[1])];
    }),
  );
}

function addRoute(
  map: Map<string, RouteInstance>,
  route: RouteDefine,
  container: RouteInstance[],
  parent: RouteInstance = null,
) {
  const hasChild = route.children && route.children.length > 0;
  const path = normPath(route.path + (hasChild ? '/' : ''));
  const name = route.name || (parent ? parent.name : '') + route.path;
  if (map.has(name)) {
    throw new Error('duplicated route name: ' + name);
  }
  if (hasChild && !route.component && !route.components) {
    route.component = RouterParentComponent;
  }
  const _route: RouteInstance = {
    name: name,
    parent,
    p2r: {
      match: match(path, { end: !hasChild, decode: decodeURIComponent }),
      toPath: compile(path),
    },
    define: route,
    components: null,
    redirect: route.redirect,
  };
  map.set(name, _route);
  if (hasChild) {
    _route.children = [];
    route.children.forEach((cr) => {
      addRoute(map, cr, _route.children, _route);
    });
  }
  container.push(_route);
}

function matchRoutePath(pathname: string, routes: RouteInstance[], parentPath: RouteMatchPath = []): RouteMatchPath {
  routes.find((route) => {
    const matches = route.p2r.match(pathname);
    if (matches) {
      /**
       * 子路由继承父亲路由的 params
       */
      const params = parentPath.reduce((pv, it) => {
        return Object.assign({}, it.params);
      }, {});
      parentPath.push({
        route,
        params: Object.assign(params, matches.params),
      });
      if (route.children) {
        matchRoutePath(pathname.substring(matches.path.length - 1), route.children, parentPath);
      }
    }
    return !!matches;
  });
  return parentPath;
}

function rollback(currentInfo: RouterInfo, mode: string) {
  const _search = encodeParamsOrQuery(currentInfo.query);
  const _url = currentInfo._pathname + (_search ? '?' + _search : '');
  history.replaceState(null, '', (mode === 'hash' ? '#' : '') + _url);
}

export interface ViewNode {
  component: RouterView;
  __views: Map<string, ViewNode>;
}

function getPathnameAndSearch(
  destination: string | RouteLocation,
  __map: Map<string, RouteInstance>,
  baseHref: string,
): {
  pathname: string;
  search: string;
} {
  if (isString(destination)) {
    destination = { name: destination as string };
  }
  const name = (destination as RouteLocation).name;
  const route = __map.get(name);
  if (!route) {
    warn(`target route name "${name}" not found.`);
    return null;
  }
  const rs: RouteInstance[] = [route];
  let _p = route;
  while ((_p = _p.parent)) {
    rs.unshift(_p);
  }
  return {
    pathname: normPath(
      baseHref +
        '/' +
        rs.reduce((pv, it) => {
          return pv + '/' + it.p2r.toPath((destination as RouteLocation).params);
        }, ''),
    ),
    search: Object.keys((destination as RouteLocation).query || {})
      .map((k) => {
        return encodeURIComponent(k) + '=' + encodeURIComponent((destination as RouteLocation).query[k] as string);
      })
      .join('&'),
  };
}

function getViewsToUpdate(
  views: Map<string, ViewNode>,
  resetLv: number,
  curLv = 0,
  viewsToUpdate: ViewNode[] = [],
): ViewNode[] {
  views.forEach((node) => {
    if (curLv >= resetLv) {
      viewsToUpdate.push(node);
    } else if (node.__views) {
      getViewsToUpdate(node.__views, resetLv, curLv + 1, viewsToUpdate);
    }
  });
  return viewsToUpdate;
}

function addGuard(arr: unknown[], fn: unknown): DeregisterFn {
  arrayPushIfNotExist(arr, fn);
  return () => {
    arrayRemove(arr, fn);
  };
}

export class Router {
  __mode: 'hash' | 'html5';
  __started: boolean;
  __dereg: () => void;
  __routes: RouteInstance[];
  __map: Map<string, RouteInstance>;
  __views: Map<string, ViewNode>;
  __info: RouterInfo;
  __asyncKey: number;
  __base: string;
  __guard: {
    before: RouteGuardFn<boolean>[];
    after: ((from: RouterInfo, to: RouterInfo) => void)[];
  };

  constructor({ mode, baseHref = '/' }: RouterOptions) {
    this.__mode = mode;
    this.__started = false;
    this.__dereg = null;
    this.__routes = [];
    this.__map = new Map();
    this.__views = null;
    this.__guard = {
      before: [],
      after: [],
    };
    this.__info = vm({
      _pathname: null,
      _routePath: [],
      params: vm({}),
      query: vm({}),
    });
    this.__asyncKey = 0;

    this.baseHref = baseHref;
  }

  get baseHref(): string {
    return this.__base;
  }

  set baseHref(v: string) {
    v = normPath(v);
    if (!v.endsWith('/')) {
      v += '/';
    }
    this.__base = v;
  }

  beforeEach(guardFn: RouteGuardFn<boolean>): DeregisterFn {
    return addGuard(this.__guard.before, guardFn);
  }

  afterEach(guardFn: RouteGuardFn): DeregisterFn {
    return addGuard(this.__guard.after, guardFn);
  }

  /**
   * @internal
   */
  __regView(viewNamePath: string[], viewComponent: RouterView) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let node = this as unknown as ViewNode;
    for (let i = 0; i < viewNamePath.length - 1; i++) {
      node = node.__views.get(viewNamePath[i]);
    }
    if (!node.__views) {
      node.__views = new Map();
    }
    const viewName = viewNamePath[viewNamePath.length - 1];
    if (node.__views.has(viewName)) {
      throw new Error('dulplicated view name: ' + viewName + ' at path: ' + viewNamePath.join('->'));
    }
    node.__views.set(viewName, {
      component: viewComponent,
      __views: null,
    });
    if (viewNamePath.length > this.__info._routePath.length) {
      return;
    }
    viewComponent._doUpdateView(null, this.__info, this.__info._routePath[viewNamePath.length - 1]);
  }

  /**
   * @internal
   */
  __deregView(viewNamePath: string[]) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let node = this as unknown as ViewNode;
    for (let i = 0; i < viewNamePath.length - 1; i++) {
      node = node.__views.get(viewNamePath[i]);
      if (!node) return;
    }
    if (!node.__views) {
      return;
    }
    node.__views.delete(viewNamePath[viewNamePath.length - 1]);
  }

  register(route: RouteDefine): Router {
    if (this.__started) {
      throw new Error("can't register after Router.start()");
    }
    addRoute(this.__map, route, this.__routes);
    return this;
  }

  start() {
    if (this.__started) return;
    this.__started = true;

    // checkName(this.__map, this.__routes);
    // console.log(this.__routes);
    const isHashMode = this.__mode === 'hash';
    this.__dereg = registerEvent(
      window as unknown as HTMLElement,
      isHashMode ? 'hashchange' : 'popstate',
      isHashMode ? this._onHashChange.bind(this) : this._onStateChange.bind(this),
    );
    if (isHashMode) {
      this._onHashChange();
    } else {
      this._onStateChange();
    }
  }

  destroy() {
    if (!this.__started) return;
    this.__dereg?.();
  }

  /**
   * @internal
   */
  _onErr(err: unknown) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  /**
   * @internal
   */
  _onHashChange() {
    const hash = location.hash.slice(1);
    const qi = hash.indexOf('?');
    this._update(qi > 0 ? hash.substring(0, qi) : hash, qi > 0 ? hash.substring(qi + 1) : '').catch((err) =>
      this._onErr(err),
    );
  }

  /**
   * @internal
   */
  _onStateChange() {
    this._update(location.pathname, location.search ? location.search.substring(1) : '').catch((err) =>
      this._onErr(err),
    );
  }

  /**
   * @internal
   */
  async _update(pathname: string, search: string | RouteParamsOrQuery): Promise<void> {
    pathname = normPath(pathname);
    if (this.__base !== '/' && pathname.startsWith(this.__base)) {
      pathname = pathname.substring(this.__base.length - 1);
    }
    const query: RouteParamsOrQuery = (
      search ? (isString(search) ? parseQuery(search as string) : cloneParamsOrQuery(search as RouteParamsOrQuery)) : {}
    ) as RouteParamsOrQuery;

    /**
     * 由于路由跳转是异步过程，期间会有多处异步等待。如果某个路由还在跳转的过程中，
     * 业务层又发起了新的路由跳转，则应该忽略之前的跳转。
     */

    // 使用 asyncKey 和闭包配合来判断异步回调是否过期，如果过期则直接忽略接下来的逻辑。
    const asyncKey = ++this.__asyncKey;
    const currentInfo = this.__info;

    /**
     * 如果 pathname 没有发生变化，说明不可能出现 router-view 的更新，
     * 可能是什么都没有变，或者 url 的 query 部分发生变化，这种情况下简单地将
     * 新的 query 赋值给旧的 query 既可，ViewModel 层面会自动将更新传递给业务组件。
     */
    if (pathname === currentInfo._pathname) {
      if (!isParamsOrQuerySameOrInclude(query, currentInfo.query)) {
        currentInfo.query = vm(query);
      }
      return;
    }

    // console.log('up', asyncKey);

    const newMatchPath = matchRoutePath(pathname, this.__routes);
    if (newMatchPath.length === 0) {
      warn('no route match path:', pathname);
      return;
    }
    const last = newMatchPath[newMatchPath.length - 1];
    const newRouteInfo: RouterInfo = vm({
      _pathname: pathname,
      _routePath: newMatchPath,
      query: vm(query),
      // clone last route params as final params
      params: vm(Object.assign({}, last.params)),
    });
    let redirect = last.route.redirect;

    if (redirect) {
      if (isFunction(redirect)) {
        redirect = await (redirect as LoadRouteLocationFn)(newRouteInfo.params, newRouteInfo.query);
        if (asyncKey !== this.__asyncKey) {
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
    for (let i = 0; i < currentInfo._routePath.length; i++) {
      if (i >= newMatchPath.length) break;
      const oldIt = currentInfo._routePath[i];
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
    if (currentInfo._routePath.length === newMatchPath.length && sameLevel === newMatchPath.length - 1) {
      const shouldUpdateQuery = !isParamsOrQuerySameOrInclude(query, currentInfo.query);
      const oldRouteInfo = shouldUpdateQuery || shouldUpdateParams ? Object.assign({}, currentInfo) : currentInfo;
      if (shouldUpdateParams) {
        Object.assign(currentInfo.params, newRouteInfo.params);
        currentInfo._pathname = newRouteInfo._pathname;
      }
      if (shouldUpdateQuery) {
        Object.assign(currentInfo.query, query);
      }
      this.__guard.after.forEach((fn) => {
        fn(oldRouteInfo, newRouteInfo);
      });
      return;
    }

    const routeIdxToUpdate = sameLevel + 1;
    const viewsToUpdate = getViewsToUpdate(this.__views, routeIdxToUpdate);
    for (let i = 0; i < viewsToUpdate.length; i++) {
      const vtp = viewsToUpdate[i];
      const shouldUpdate = await vtp.component._shouldUpdateView(currentInfo, newRouteInfo);
      // console.log(asyncKey, this.__asyncKey);
      if (asyncKey !== this.__asyncKey) {
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
        return rollback(currentInfo, this.__mode);
      }
    }

    if (currentInfo._routePath.length > routeIdxToUpdate) {
      /**
       * 通知通过 router.beforeEach() 注册的守护函数路由即将跳转。
       * 如果守护函数显式地返回 `false`，则会阻止路由切换。
       */
      const beforeEachGuardFns = this.__guard.before;
      for (let i = 0; i < beforeEachGuardFns.length; i++) {
        const shouldLeave = await beforeEachGuardFns[i](currentInfo, newRouteInfo);
        if (this.__asyncKey !== asyncKey) {
          return;
        }
        if (shouldLeave === false) {
          return rollback(currentInfo, this.__mode);
        }
      }
      /**
       * 通知即将变更的路由 onLeave 回调。当前版本只会通知最顶部的路由。
       * 未来版本要考虑可能子路由也应该通知？
       *
       * onLeave 回调返回显式地 `false`，则会阻止路由的切换。
       */
      const routeDef = currentInfo._routePath[routeIdxToUpdate].route.define;
      if (isFunction(routeDef.onLeave)) {
        const shouldLeave = await routeDef.onLeave(currentInfo, newRouteInfo);
        if (this.__asyncKey !== asyncKey) {
          return;
        }
        if (shouldLeave === false) {
          return rollback(currentInfo, this.__mode);
        }
      }
    }

    viewsToUpdate.forEach((vtp) => {
      vtp.__views?.clear();
      vtp.component._prepareUpdateView(newRouteInfo, newMatchPath[routeIdxToUpdate]);
    });

    if (newRouteInfo._routePath.length > routeIdxToUpdate) {
      for (let i = routeIdxToUpdate; i < newRouteInfo._routePath.length; i++) {
        const routeDef = newRouteInfo._routePath[i].route.define;
        if (isFunction(routeDef.onEnter)) {
          await routeDef.onEnter(currentInfo, newRouteInfo);
          if (this.__asyncKey !== asyncKey) {
            return;
          }
        }
      }
    }

    let parentResolves = newMatchPath.slice(0, routeIdxToUpdate).reduce((pv, it) => {
      return Object.assign(pv, it.resolves);
    }, {} as Record<string, unknown>);

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
              const rtn = (resolveOrFn as LoadDependencyFn)(matchedRoute.params, newRouteInfo.query, parentResolves);
              if (isObject(rtn) && isFunction((rtn as { then: (value: unknown) => Promise<void> }).then)) {
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
                vtp.component._doUpdateView(ex);
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
          const CompClazz = comClasses[cn];
          if (isFunction(CompClazz) && !isComponent(CompClazz)) {
            try {
              const r = (CompClazz as LoadComponentFn)(matchedRoute.params, newRouteInfo.query, currentResolves);
              if (isObject(r) && isFunction((r as Promise<ComponentConstructor>).then)) {
                promises.push(
                  (r as Promise<ComponentConstructor>).then((rr) => {
                    loadedComClasses[cn] = rr;
                  }),
                );
              } else {
                loadedComClasses[cn] = CompClazz as unknown as ComponentConstructor;
              }
            } catch (ex) {
              viewsToUpdate.forEach((vtp) => {
                vtp.component._doUpdateView(ex);
              });
              throw ex;
            }
          } else {
            loadedComClasses[cn] = CompClazz as ComponentConstructor;
          }
        });
      }

      try {
        await Promise.all(promises);
      } catch (ex) {
        if (asyncKey === this.__asyncKey) {
          viewsToUpdate.forEach((vtp) => {
            vtp.component._doUpdateView(ex);
          });
        }
        throw ex;
      }
      // 如果回调已经过期，或组件已被销毁，直接忽略后续逻辑。
      if (asyncKey !== this.__asyncKey) {
        return;
      }
      matchedRoute.route.components = loadedComClasses;
      matchedRoute.resolves = currentResolves;
      parentResolves = currentResolves;
    }

    const oldRouteInfo = Object.assign({}, currentInfo);
    Object.assign(currentInfo, newRouteInfo);

    viewsToUpdate.forEach((vtp) => {
      vtp.component._doUpdateView(null, newRouteInfo, newMatchPath[routeIdxToUpdate]);
    });

    this.__guard.after.forEach((fn) => {
      fn(oldRouteInfo, newRouteInfo);
    });
  }

  /**
   * current location url path parameters
   */
  get params(): RouteParamsOrQuery {
    return this.__info?.params;
  }

  /**
   * current location url query/search
   */
  get query(): RouteParamsOrQuery {
    return this.__info?.query;
  }

  /**
   * current matched route
   */
  get current(): RouteMatchPathItem {
    const rp = this.__info?._routePath;
    if (!rp || rp.length === 0) return null;
    return rp[rp.length - 1];
  }

  includes(destination: string | RouteLocation, checkQuery = false): boolean {
    if (!this.__info || this.__info._routePath.length === 0) return false;
    if (isString(destination)) {
      destination = { name: destination as string };
    }
    const name = (destination as RouteLocation).name;
    const route = this.__map.get(name);
    if (!route) {
      return false;
    }
    if (
      checkQuery &&
      (destination as RouteLocation).query &&
      !isParamsOrQuerySameOrInclude((destination as RouteLocation).query, this.__info.query, false)
    ) {
      return false;
    }
    return (
      this.__info._routePath.findIndex((it) => {
        return (
          it.route === route &&
          isParamsOrQuerySameOrInclude((destination as RouteLocation).params || {}, it.params || {}, false)
        );
      }) >= 0
    );
  }

  href(destination: string | RouteLocation): string {
    const pathAndSearch = getPathnameAndSearch(destination, this.__map, this.__base);
    if (!pathAndSearch) {
      return null;
    }
    const { pathname, search } = pathAndSearch;
    const path = search ? pathname + '?' + search : pathname;
    return this.__mode === 'hash' ? '#' + path : path;
  }

  go(
    destination: string | RouteLocation,
    { target = '_self', replace = false }: RouteJumpOptions = {
      target: '_self',
      replace: false,
    },
  ) {
    const pathAndSearch = getPathnameAndSearch(destination, this.__map, this.__base);
    if (!pathAndSearch) {
      return;
    }
    const { pathname, search } = pathAndSearch;
    const path = search ? pathname + '?' + search : pathname;
    const isHashMode = this.__mode === 'hash';
    const url = isHashMode ? location.pathname + '#' + path : path;

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
