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

  addMountFn(this, () => {
    updateLocation(core, pathname, search).catch((err) => console.error(err));
    return registerEvent(window as unknown as HTMLElement, 'popstate', () => {
      const { pathname: pn, search: s } = location;
      if (pathname === pn) {
        if (search === s) return; // nothing changed
        search = s;
        updateQuery(core, search);
      } else {
        pathname = pn;
        search = s;
        updateLocation(core, pn, search).catch((err) => {
          console.error(err);
        });
      }
    });
  });

  return renderSlotFunction(this, this[SLOTS][DEFAULT_SLOT]);
}
