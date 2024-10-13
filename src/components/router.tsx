import {
  type ComponentHost,
  type JNode,
  type Props,
  addMountFn,
  registerEvent,
  setComponentContext,
} from 'jinge';
import { MODE, ROUTER_CORE, type RouterCore, updateLocation, updateQuery } from '../core/router';

export interface RouterProps {
  router: RouterCore;
}
export function Router(
  this: ComponentHost,
  props: Props<{
    props: RouterProps;
    children: JNode;
  }>,
) {
  const core = props.router;
  setComponentContext(this, ROUTER_CORE, core);
  let search = location.search;
  let pathname = core[MODE] === 'hash' ? location.hash : location.pathname;
  try {
    updateLocation(core, pathname, search === '' ? undefined : search);
  } catch (ex) {
    console.error(ex);
  }
  addMountFn(this, () => {
    return registerEvent(window as unknown as HTMLElement, 'popstate', () => {
      const s = location.search;
      const p = core[MODE] === 'hash' ? location.hash : location.pathname;
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
