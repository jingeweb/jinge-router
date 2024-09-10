import type { AnyFn } from 'jinge';
import { encodeParamsOrQuery } from '../util';

export function normPath(p: string): string {
  if (!p || p === '/') return p;
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.endsWith('/')) p = p.slice(0, p.length - 1);
  return p.replace(/[/\\]+/g, '/');
}

// export function matchRoutePath(
//   pathname: string,
//   routes: RouteInstance[],
//   parentPath: MatchRoute[] = [],
// ): MatchRoute[] {
//   routes.find((route) => {
//     const matches = route.p2r.match(pathname);
//     if (matches) {
//       /**
//        * 子路由继承父亲路由的 params
//        */
//       const params = parentPath.reduce((pv, it) => {
//         return { ...pv, ...it.params };
//       }, {});
//       parentPath.push({
//         route,
//         params: Object.assign(params, matches.params),
//       });
//       if (route.children) {
//         matchRoutePath(pathname.substring(matches.path.length - 1), route.children, parentPath);
//       }
//     }
//     return !!matches;
//   });
//   return parentPath;
// }

export function rollback(currentInfo: CurrentRoute, mode: string) {
  const _search = encodeParamsOrQuery(currentInfo.query);
  const _url = currentInfo.pathname + (_search ? `?${_search}` : '');
  history.replaceState(null, '', (mode === 'hash' ? '#' : '') + _url);
}

// export function getPathnameAndSearch(
//   destination: string | RouteLocation,
//   roteInstanceMap: Map<string, RouteInstance>,
//   baseHref: string,
// ): {
//   pathname: string;
//   search: string;
// } {
//   if (isString(destination)) {
//     destination = { name: destination as string };
//   }
//   const name = destination.name;
//   const route = roteInstanceMap.get(name);
//   if (!route) {
//     throw new Error(`target route name "${name}" not found.`);
//   }
//   const rs: RouteInstance[] = [route];
//   let _p: RouteInstance | undefined = route;
//   while ((_p = _p.parent)) {
//     rs.unshift(_p);
//   }
//   return {
//     pathname: normPath(
//       `${baseHref}/${rs.reduce((pv, it) => {
//         return `${pv}/${it.p2r.toPath(destination.params)}`;
//       }, '')}`,
//     ),
//     search: destination.query
//       ? Object.entries(destination.query)
//           .map(([k, v]) => {
//             return `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`;
//           })
//           .join('&')
//       : '',
//   };
// }

export function addGuard(arr: Set<AnyFn>, fn: AnyFn): AnyFn {
  arr.add(fn);
  return () => arr.delete(fn);
}
