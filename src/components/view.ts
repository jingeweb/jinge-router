import {
  type ComponentHost,
  ROOT_NODES,
  addMountFn,
  addUnmountFn,
  createComment,
  setComponentContext,
} from 'jinge';
import { ROUTE_VIEW_DEEP, getRouteViewDeepContext, getRouterCoreContext } from '../core/router';
import { deregisterView, registerView } from '../core/view';

export function RouterView(this: ComponentHost) {
  const core = getRouterCoreContext(this);
  const viewDeep = getRouteViewDeepContext(this) + 1;
  setComponentContext(this, ROUTE_VIEW_DEEP, viewDeep);

  addMountFn(this, () => {
    registerView(core, this, viewDeep);
  });
  addUnmountFn(this, () => {
    deregisterView(core, viewDeep);
  });

  const placeholder = createComment('router-view');
  this[ROOT_NODES].push(placeholder);
  return this[ROOT_NODES] as Node[];
}

// BEGIN_DROP_IN_PRODUCTION
window.__JINGE_HMR__?.registerFunctionComponent(RouterView, 'jinge-router::router-view');
// END_DROP_IN_PRODUCTION
