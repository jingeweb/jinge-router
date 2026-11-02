import { type JNode, type WithChildren, cx, isUndefined } from 'jinge';

import { RouterLink, type RouterLinkProps } from './link';

export interface RouterHrefProps {
  to: RouterLinkProps['to'];
  activeClass?: string;
  exactActiveClass?: string;
  className?: string;
}
export function RouterHref(props: RouterHrefProps & WithChildren<JNode>) {
  return (
    <RouterLink
      to={props.to}
      noActive={isUndefined(props.activeClass) && isUndefined(props.exactActiveClass)}
    >
      {(vm) => (
        <a
          className={cx(
            props.className,
            vm.active && props.activeClass,
            vm.exactActive && props.exactActiveClass,
          )}
          href={vm.href}
        >
          {props.children}
        </a>
      )}
    </RouterLink>
  );
}
// BEGIN_DROP_IN_PRODUCTION
window.__JINGE_HMR__?.registerFunctionComponent(RouterHref, 'jinge-router::router-href');
// END_DROP_IN_PRODUCTION
