import { getCurrentComponentHost } from 'jinge';
import { PARAMS, QUERY, getRouteViewDeepContext, getRouterCoreContext } from './core/router';
import type { RouteParams, RouteQuery } from './core/route';

export function useQuery() {
  return getRouterCoreContext(getCurrentComponentHost())[QUERY] as RouteQuery;
}

export function useParams() {
  const comp = getCurrentComponentHost();
  const paramsList = getRouterCoreContext(comp)[PARAMS];
  const viewDeep = getRouteViewDeepContext(comp);
  return paramsList[viewDeep] as RouteParams;
}
