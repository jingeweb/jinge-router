import { type JNode, type PropsWithSlots, cx, isUndefined } from 'jinge';
import { RouterLink, type RouterLinkProps } from './link';

export interface RouterHrefProps {
  to: RouterLinkProps['to'];
  activeClass?: string;
  exactActiveClass?: string;
  className?: string;
}
export function RouterHref(props: PropsWithSlots<RouterHrefProps, JNode>) {
  const noActive = isUndefined(props.activeClass);
  return (
    <RouterLink to={props.to} noActive={noActive}>
      {(vm) => (
        <a className={cx(props.className, vm.exactActive ? props.exactActiveClass : (vm.active && props.activeClass))} href={vm.href}>
          {props.children}
        </a>
      )}
    </RouterLink>
  );
}
