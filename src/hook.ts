import type { GuardFn } from './common';
import { getCurrentComponentHost } from 'jinge';
import { getRouterCoreContext } from './core';

export const BEFORE_ROUTE_LEAVE = Symbol('beforeRouteLeaveCallback');

export function beforeRouteLeave(guardFn: GuardFn) {
  const el = getCurrentComponentHost() as unknown as {
    [BEFORE_ROUTE_LEAVE]: GuardFn;
  };
  if (el[BEFORE_ROUTE_LEAVE]) throw new Error('duplicated beforeRouteLeave hook');
  el[BEFORE_ROUTE_LEAVE] = guardFn;
}

export function useRouter() {
  return getRouterCoreContext(getCurrentComponentHost());
}
