import {
  type ComponentHost,
  DEFAULT_SLOT,
  type JNode,
  type PropsWithSlots,
  SLOTS,
  addMountFn,
  addUnmountFn,
  renderSlotFunction,
  setComponentContext,
} from 'jinge';
import { ROUTER_CORE, type Router } from '../core';

export interface RouterProps {
  router: Router;
}
export function Router(this: ComponentHost, props: PropsWithSlots<RouterProps, JNode>) {
  const router = props.router;
  setComponentContext(this, ROUTER_CORE, router);

  addMountFn(this, () => {
    router.start();
  });

  addUnmountFn(this, () => {
    router.destroy();
  });

  return renderSlotFunction(this, this[SLOTS][DEFAULT_SLOT]);
}
