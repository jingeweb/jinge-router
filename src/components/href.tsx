import { type JNode, type Props, cx, isUndefined } from 'jinge';
import { RouterLink, type RouterLinkProps } from './link';

export interface RouterHrefProps {
  to: RouterLinkProps['to'];
  activeClass?: string;
  exactActiveClass?: string;
  className?: string;
}
export function RouterHref(
  props: Props<{
    props: RouterHrefProps;
    children: JNode;
  }>,
) {
  const noActive = isUndefined(props.activeClass);
  return (
    <RouterLink to={props.to} noActive={noActive}>
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
