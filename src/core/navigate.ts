import { isNumber } from '../../../jinge/src/util';
import { updateHistoryState } from './helper';
import { MODE, type RouterCore } from './router';

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
