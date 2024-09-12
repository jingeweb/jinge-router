import {
  type ComponentHost,
  DEFAULT_SLOT,
  type JNode,
  type PropsWithSlots,
  SLOTS,
  addMountFn,
  registerEvent,
  renderSlotFunction,
  setComponentContext,
} from 'jinge';
import { ROUTER_CORE, type RouterCore, updateLocation, updateQuery } from '../core/router';

export interface RouterProps {
  router: RouterCore;
}
export function Router(this: ComponentHost, props: PropsWithSlots<RouterProps, JNode>) {
  const core = props.router;
  setComponentContext(this, ROUTER_CORE, core);
  let { pathname, search } = location;
  try {
    updateLocation(core, pathname, search === '' ? undefined : search);
  } catch (ex) {
    console.error(ex);
  }
  addMountFn(this, () => {
    return registerEvent(window as unknown as HTMLElement, 'popstate', () => {
      const { pathname: pn, search: s } = location;
      // console.log('popstate', pn, s, pathname, search);
      if (pathname === pn) {
        if (search === s) return; // nothing changed
        search = s;
        updateQuery(core, search);
      } else {
        pathname = pn;
        try {
          updateLocation(core, pn, search === s ? undefined : s);
        } catch (ex) {
          console.error(ex);
        }
        search = s;
      }
    });
  });

  return renderSlotFunction(this, this[SLOTS][DEFAULT_SLOT]);
}

// BEGIN_DROP_IN_PRODUCTION
window.__JINGE_HMR__?.registerFunctionComponent(Router, 'jinge-router::router');
// END_DROP_IN_PRODUCTION
