import { type AnyFn, type ComponentHost, isString } from 'jinge';
import type {
  CurrentRoute,
  MatchRoute,
  Route,
  RouteDefine,
  RouteInstance,
  RouteLocation,
} from '../common';
import { encodeParamsOrQuery } from '../util';
import { compile, match } from 'path-to-regexp';
import { RouterView } from '../components';
import type { RouterCore } from '.';
import { updateView } from './view';

export function normPath(p: string): string {
  if (!p?.startsWith('/')) p = `/${p}`;
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

export function parseQuery(search: string): Record<string, string | boolean | number> {
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

export function addRoute(
  map: Map<string, RouteInstance>,
  routeDefine: Route,
  container: RouteInstance[],
  parent?: RouteInstance,
) {
  const hasChild = routeDefine.children && routeDefine.children.length > 0;
  const path = normPath(routeDefine.path + (hasChild ? '/' : ''));
  const name = routeDefine.name || (parent ? parent.name : '') + routeDefine.path;
  if (map.has(name)) {
    throw new Error(`duplicated route name: ${name}`);
  }

  const routeInstance: RouteInstance = {
    name: name,
    parent,
    p2r: {
      match: match(path, { end: !hasChild, decode: decodeURIComponent }),
      toPath: compile(path),
    },
    define: routeDefine,
    components: {},
  };
  map.set(name, routeInstance);
  if (hasChild) {
    routeInstance.children = [];
    routeDefine.children!.forEach((cr) => {
      addRoute(map, cr, routeInstance.children!, routeInstance);
    });
  }
  container.push(routeInstance);
}

export function matchRoutePath(
  pathname: string,
  routes: RouteInstance[],
  parentPath: MatchRoute[] = [],
): MatchRoute[] {
  routes.find((route) => {
    const matches = route.p2r.match(pathname);
    if (matches) {
      /**
       * 子路由继承父亲路由的 params
       */
      const params = parentPath.reduce((pv, it) => {
        return { ...pv, ...it.params };
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

export function rollback(currentInfo: CurrentRoute, mode: string) {
  const _search = encodeParamsOrQuery(currentInfo.query);
  const _url = currentInfo.pathname + (_search ? `?${_search}` : '');
  history.replaceState(null, '', (mode === 'hash' ? '#' : '') + _url);
}

export function getPathnameAndSearch(
  destination: string | RouteLocation,
  roteInstanceMap: Map<string, RouteInstance>,
  baseHref: string,
): {
  pathname: string;
  search: string;
} {
  if (isString(destination)) {
    destination = { name: destination as string };
  }
  const name = destination.name;
  const route = roteInstanceMap.get(name);
  if (!route) {
    throw new Error(`target route name "${name}" not found.`);
  }
  const rs: RouteInstance[] = [route];
  let _p: RouteInstance | undefined = route;
  while ((_p = _p.parent)) {
    rs.unshift(_p);
  }
  return {
    pathname: normPath(
      `${baseHref}/${rs.reduce((pv, it) => {
        return `${pv}/${it.p2r.toPath(destination.params)}`;
      }, '')}`,
    ),
    search: destination.query
      ? Object.entries(destination.query)
          .map(([k, v]) => {
            return `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`;
          })
          .join('&')
      : '',
  };
}

export function addGuard(arr: Set<AnyFn>, fn: AnyFn): AnyFn {
  arr.add(fn);
  return () => arr.delete(fn);
}
