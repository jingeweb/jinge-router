import {
  type ComponentHost,
  DEFAULT_SLOT,
  type JNode,
  type PropsWithSlots,
  SLOTS,
  addMountFn,
  addUnmountFn,
  getFirstDOM,
  registerEvent,
  renderSlotFunction,
  vm,
  vmWatch,
} from 'jinge';
import { getRouterCoreContext } from '../core';
import { navigateRouter } from '../core/navigate';

export interface RouterLinkProps {
  /** 是否在新窗口中打开链接。等价于 <a target="_blank" /> */
  open?: boolean;
  /**
   * 链接的跳转目标地址。如果是 '..' 代表上一级路由。
   */
  to: string;
  /**
   * 当 open 不为 true 时，当前窗口的跳转是否是替换 history state。
   */
  replace?: boolean;
  /**
   * 默认情况下，RouterLink 会给渲染的第一个根 DOM 添加 onClick 事件跳转路由。
   * 如果和第三方组件库集成时不希望有这个添加 onclick 事件的逻辑，可配置 noEvent: true。
   */
  noEvent?: boolean;
}
export interface RouterLinkState {
  href: string;
  active: boolean;
  exactActive: boolean;
}
export function RouterLink(
  this: ComponentHost,
  props: PropsWithSlots<RouterLinkProps, (vm: RouterLinkState) => JNode>,
) {
  const core = getRouterCoreContext(this);
  const state: RouterLinkState = vm({
    href: props.to,
    active: false,
    exactActive: false,
  });
  addUnmountFn(
    this,
    vmWatch(props, 'to', (v) => (state.href = v)),
  );

  addMountFn(this, () => {
    if (props.noEvent) return;
    const el = getFirstDOM(this);
    if (el.nodeType !== 1) return;
    return registerEvent(el as Element, 'click', (evt) => {
      evt.preventDefault();
      if (props.open) {
        window.open(state.href);
      } else {
        navigateRouter(core, props.to, {
          replace: props.replace,
        });
      }
    });
  });
  return renderSlotFunction(this, this[SLOTS][DEFAULT_SLOT], state);
}

// BEGIN_DROP_IN_PRODUCTION
window.__JINGE_HMR__?.registerFunctionComponent(RouterLink, 'jinge-router::router-link');
// END_DROP_IN_PRODUCTION
