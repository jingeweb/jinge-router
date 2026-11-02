import {
  type ComponentHost,
  type JNode,
  type WithChildren,
  addMountFn,
  registerEvent,
  setComponentContext,
} from 'jinge';

import { MODE, ROUTER_CORE, type RouterCore, updateLocation, updateQuery } from '../core/router';

export interface RouterProps {
  router: RouterCore;
}
export function Router(props: RouterProps & WithChildren<JNode>, host: ComponentHost) {
  const core = props.router;
  setComponentContext(host, ROUTER_CORE, core);
  const readLocation = () => {
    if (core[MODE] !== 'hash') return [location.pathname, location.search];
    const hash = location.hash.slice(1);
    const queryIdx = hash.indexOf('?');
    return queryIdx < 0 ? [hash, ''] : [hash.slice(0, queryIdx), hash.slice(queryIdx)];
  };
  let [pathname, search] = readLocation();
  try {
    updateLocation(core, pathname, search);
  } catch (ex) {
    console.error(ex);
  }
  addMountFn(host, () => {
    return registerEvent(window, 'popstate', () => {
      const [p, s] = readLocation();
      // console.log('popstate', pn, s, pathname, search);
      if (pathname === p) {
        if (search === s) return; // nothing changed
        search = s;
        updateQuery(core, search);
      } else {
        pathname = p;
        try {
          updateLocation(core, p, search === s ? undefined : s);
        } catch (ex) {
          console.error(ex);
        }
        search = s;
      }
    });
  });

  return <>{props.children}</>;
}
// BEGIN_DROP_IN_PRODUCTION
window.__JINGE_HMR__?.registerFunctionComponent(Router, 'jinge-router::router');
// END_DROP_IN_PRODUCTION
