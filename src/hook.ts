import { getCurrentComponentHost } from 'jinge';
import { PARAMS, QUERY, getRouteViewDeepContext, getRouterCoreContext } from './core/router';
import type { RouteParams, RouteQuery } from './core/route';
import { navigateRouter } from './core/navigate';

export function useQuery() {
  return getRouterCoreContext(getCurrentComponentHost())[QUERY] as RouteQuery;
}

export function useParams<T extends RouteParams = RouteParams>() {
  const comp = getCurrentComponentHost();
  const paramsList = getRouterCoreContext(comp)[PARAMS];
  const viewDeep = getRouteViewDeepContext(comp);
  return paramsList[viewDeep - 1] as T;
}

export function useNavigate() {
  const comp = getCurrentComponentHost();
  const core = getRouterCoreContext(comp);
  return function navigate(to: string | number, options?: { replace?: boolean }) {
    navigateRouter(core, to, options);
  };
}
