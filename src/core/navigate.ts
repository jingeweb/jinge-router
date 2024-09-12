import { isNumber } from '../../../jinge/src/util';
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
  const replace = !!options?.replace;
  let href = to;
  if (to === '..') {
    // todo
    href = '/';
  }
  if (replace) {
    history.replaceState(null, '', href);
  } else {
    history.pushState(null, '', href);
  }
  dispatchEvent(new PopStateEvent('popstate'));
}
