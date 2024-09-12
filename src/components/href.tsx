import { type ComponentHost, type JNode, type PropsWithSlots, cx } from "jinge";
import { RouterLink, type RouterLinkProps } from "./link";

export interface RouterHrefProps {
  to: RouterLinkProps['to'],
  activeClass?: string;
  className?: string;
}
export function RouterHref(this: ComponentHost, props: PropsWithSlots<RouterHrefProps, JNode>) {
  return <RouterLink to={props.to}>{(vm) => <a className={cx(props.className, vm.active && props.activeClass)} href={vm.href}>{props.children}</a>}</RouterLink>
}