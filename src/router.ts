import {
  Messenger, Component, ComponentAttributes,
  addEvent, removeEvent, isString, isFunction
} from 'jinge';
import {
  pathToRegexp, Key
} from 'path-to-regexp';

export interface RouterOptions {
  mode: 'hash' | 'html5';
  baseHref?: string;
}

export type ComponentConstructor = {
  create(attrs: ComponentAttributes): Component;
};
export type LoadComponentFn = (params: Record<string, unknown>, query: Record<string, unknown>, resolves: Record<string, unknown>) => Promise<ComponentConstructor>;
export type LoadDependencyFn = (params: Record<string, unknown>, query: Record<string, unknown>) => unknown | Promise<unknown>;
export type RouteDependency = LoadDependencyFn | string | number | object;
export interface RouteDefine {
  path: string;
  redirect?: string;
  component?: LoadComponentFn | ComponentConstructor;
  resolves?: {
    [k: string]: RouteDependency;
  };
}

type Route = {
  regexp: RegExp;
  keys: Key[];
  define: RouteDefine;
  component: ComponentConstructor;
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
  } else if (/^\d+$/.test(v)) {
    return Number(v);
  } else {
    return v as string;
  }
}

function parseQuery(search: string): Record<string, string | boolean | number> {
  const segments = search.substring(1).split('&');
  if (segments.length === 0) return;
  return Object.fromEntries(segments.map(seg => {
    const pair = seg.split('=').map(decodeURIComponent);
    return [pair[0], pair.length <= 1 ? true : parseVal(pair[1])];
  }));
}

export interface RouteInfo {
  route: RouteDefine;
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  resolves: Record<string, unknown>;
}

export class Router extends Messenger {
  __mode: 'hash' | 'html5';
  __started: boolean;
  __handler: EventListener;
  __routes: Route[];
  __otherwize: Route;
  __current: RouteInfo;

  readonly baseHref: string;

  constructor({mode, baseHref = '/'}: RouterOptions) {
    baseHref = normPath(baseHref);
    if (!baseHref.endsWith('/')) {
      throw new Error('baseHref must be ends with "/"');
    }
    super();
    this.__mode = mode;
    this.__started = false;
    this.__handler = null;
    this.__routes = [];

    this.baseHref = baseHref;
  }

  register(route: RouteDefine): Router {
    route.path = normPath(route.path);
    const keys: Key[] = [];
    const regexp = pathToRegexp(route.path, keys);
    const _route: Route = {
      regexp, keys, define: route
    };
    this.__routes.push(_route);
    return this;
  }

  otherwize(targetPath: string): void;
  otherwize(route: RouteDefine): void;
  otherwise(route: string | RouteDefine): void {
    if (isString(route)) {
      route = normPath(route as string);
      const _route = this.__routes.find(r => r.define.path === route as string);
      if (!_route) throw new Error('redirect path not found.');
      this.__otherwize = _route;
    } else {
      this.register(route as RouteDefine);
      this.__otherwize = this.__routes[this.__routes.length - 1];
    }
    return this;
  }

  start(): void {
    if (this.__started) return;
    this.__started = true;
    if (this.__mode === 'hash') {
      this.__handler =  this._onHashChange.bind(this);
      addEvent(window, 'hashchange', this.__handler);
      this._onHashChange();
    } else {
      this.__handler = this._onStateChange.bind(this);
      addEvent(window, 'popstate', this.__handler);
      this._onStateChange();
    }
  }

  destroy(): void {
    if (!this.__started) return;
    removeEvent(window, this.__mode === 'hash' ? 'hashchange' : 'statechange', this.__handler);
  }

  _onHashChange(): void {
    const hash = location.hash.slice(1);
    const qi = hash.indexOf('?');
    this._update(hash.substring(0, qi), hash.substring(qi + 1));
  }

  _onStateChange(): void {
    this._update(location.pathname, location.search);
  }

  async _update(pathname: string, search: string): void {
    pathname = normPath(pathname);
    if (this.baseHref !== '/' && pathname.startsWith(this.baseHref)) {
      pathname = pathname.substring(this.baseHref.length);
    }
    let matchRoute: Route;
    let matches: RegExpMatchArray;
    this.__routes.find(route => {
      matches = pathname.match(route.regexp);
      if (matches) {
        matchRoute = route;
      }
      return !!matches;
    });
    if (!matchRoute) {
      if (!this.__otherwize) {
        return;
      }
      matchRoute = this.__otherwize;
    }
    const query = search ? parseQuery(search) : {};
    const params = matchRoute.keys.length > 0 ? Object.fromEntries(matchRoute.keys.map((key, i) => {
      return [key.name, parseVal(matches[i + 1])];
    })) : {};
    const deps = matchRoute.define.resolves;
    const resolves: Record<string, unknown> = {};
    for(const k in deps) {
      const dep = deps[k];
      if (isFunction(dep)) {
        resolves[k] = await dep(params, query);
      } else {
        resolves[k] = dep;
      }
    }
    if (!matchRoute.component) {
      let  ComponentClazz = matchRoute.define.component;
      if (isFunction(ComponentClazz)) {
        ComponentClazz = await (comp as LoadComponentFn)(params, query, resolves);
      }
      matchRoute.component = ComponentClazz;
    }
    
    this.__current = {
      route: matchRoute,
      params,
      query,
      resolves
    };
    this.__notify('route-update', this.__current);
  }
}