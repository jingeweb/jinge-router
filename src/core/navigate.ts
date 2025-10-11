import { MODE, type RouterCore } from './router';

import { isNumber } from 'jinge';
import { updateHistoryState } from './helper';

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
  const hashPrefix = core[MODE] === 'hash' ? '#' : '';
  if (to === '..') {
    throw 'todo';
  }
  updateHistoryState(hashPrefix + to, options?.replace);
}
