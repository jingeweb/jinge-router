import {
  type ComponentHost,
  ROOT_NODES,
  addMountFn,
  addUnmountFn,
  createComment,
  setComponentContext,
} from 'jinge';
import {
  ROUTE_VIEW_DEEP,
  getRouteViewDeepContext,
  getRouterCoreContext,
} from '../core/router';
import { deregisterView, registerView } from '../core/view';

export function RouterView(_: unknown, host: ComponentHost) {
  const core = getRouterCoreContext(host);
  const viewDeep = getRouteViewDeepContext(host) + 1;
  setComponentContext(host, ROUTE_VIEW_DEEP, viewDeep);

  addMountFn(host, () => {
    registerView(core, host, viewDeep);
  });
  addUnmountFn(host, () => {
    deregisterView(core, viewDeep);
  });

  const placeholder = createComment('router-view');
  host[ROOT_NODES].push(placeholder);
  return host[ROOT_NODES] as Node[];
}

// BEGIN_DROP_IN_PRODUCTION
window.__JINGE_HMR__?.registerFunctionComponent(
  RouterView,
  'jinge-router::router-view',
);
// END_DROP_IN_PRODUCTION
