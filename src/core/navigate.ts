import { isNumber } from '../../../jinge/src/util';
import { updateHistoryState } from './helper';
import type { RouterCore } from './router';

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
  let href = to;
  if (to === '..') {
    // todo
    href = '/';
  }
  updateHistoryState(href, options?.replace);
}
