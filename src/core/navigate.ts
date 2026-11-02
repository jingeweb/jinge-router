import { isNumber } from 'jinge';

import { getRouteHref, updateHistoryState } from './helper';
import { BASE_HREF, MODE, type RouterCore } from './router';

export function navigateRouter(
  core: RouterCore,
  to: string | number,
  options?: {
    replace?: boolean;
  },
) {
  if (isNumber(to)) {
    history.go(to);
    return;
  }
  if (to === '..') {
    throw 'todo';
  }
  updateHistoryState(getRouteHref(to, core[BASE_HREF], core[MODE]), options?.replace);
}
