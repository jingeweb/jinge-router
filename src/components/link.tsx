import {
  type ComponentHost,
  type JNode,
  type PropsWithSlots,
  addUnmountFn,
  classnames,
  isObject,
  vm,
  vmWatch,
} from 'jinge';
import { isParamsOrQuerySameOrInclude } from '../util';
import type { LinkTarget, RouteLocation } from '../common';
import { getRouterCoreContext } from '../core';

export interface RouterLinkProps {
  className?: string;
  style?: string;
  activeClass?: string;
  to: string | RouteLocation;
  target?: LinkTarget;
  replace?: boolean;
}


export function RouterLink(this: ComponentHost, props: PropsWithSlots<RouterLinkProps, JNode>) {

  const router = getRouterCoreContext(this);
  const calcIsActive = (to: RouterLinkProps['to']) => {
    let isActive = router.includes(to);
    if (isActive && isObject(to) && to.query) {
      isActive = isParamsOrQuerySameOrInclude(to.query, router.info.query);
    }
    return isActive;
  }
  const state = vm({
    isActive: false,
    href: router.href(props.to)
  });

  addUnmountFn(this, vmWatch(props, 'to', (v) => {
    state.href = router.href(v);
    state.isActive = calcIsActive(v);
  }))


  return <a
    className={classnames(state.isActive && props.activeClass, props.className)}
    style={props.style}
    target={props.target ?? '_self'}
    href={state.href}
    onClick={(e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey) {
        return;
      }
      e.preventDefault(); // prevent default <a> jump
      router.go(props.to, {
        target: props.target,
        replace: props.replace,
      });
    }}
  >
    {props.children}
  </a>
}

