import {
  type ComponentHost,
  type JNode,
  type Props,
  addMountFn,
  addUnmountFn,
  getFirstDOM,
  registerEvent,
  vm,
  vmWatch,
} from 'jinge';
import { MATCH_ROUTE, ON_CHANGE, ROUTES, getRouterCoreContext } from '../core';
import { navigateRouter } from '../core/navigate';
import { type MatchedRoute, type RouteParams, matchRoutes } from '../core/route';

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
  /**
   * 默认情况下会计算当前 link 是否是 active 和 exactActive 状态。如果配置为 true，则不会计算，始终在 slot 中传递 false
   */
  noActive?: boolean;
}
export interface RouterLinkState {
  href: string;
  active: boolean;
  exactActive: boolean;
}

function isParamsSame(pa: RouteParams, pb: RouteParams) {
  const ka = Object.keys(pa);
  const kb = Object.keys(pb);
  if (ka.length === 0) return kb.length === 0;
  else if (ka.length !== kb.length) return false;
  return !ka.some((key) => {
    return pa[key] !== pb[key];
  });
}
export function RouterLink(
  this: ComponentHost,
  props: Props<{
    props: RouterLinkProps;
    children: (vm: RouterLinkState) => JNode;
  }>,
) {
  const core = getRouterCoreContext(this);

  const state = vm({
    href: props.to,
    active: false,
    exactActive: false,
  });
  addMountFn(this, () => {
    if (props.noEvent) return;
    const el = getFirstDOM(this);
    if (el.nodeType !== 1) return;
    return registerEvent(el as Element, 'click', (evt) => {
      evt.preventDefault();
      if (props.open) {
        window.open(props.to);
      } else {
        navigateRouter(core, props.to, {
          replace: props.replace,
        });
      }
    });
  });

  const calcActive = props.noActive !== true;
  let toRoutePath = calcActive ? matchRoutes(props.to, core[ROUTES]) : undefined;

  const update = (curRoutePath?: MatchedRoute[]) => {
    const toLen = toRoutePath?.length ?? 0;
    const curLen = curRoutePath?.length ?? 0;
    if (toLen === 0 || curLen === 0 || toLen > curLen) {
      state.active = false;
      state.exactActive = false;
      return;
    }
    for (let i = 0; i < toLen; i++) {
      const to = toRoutePath![i];
      const cur = curRoutePath![i];
      if (to[0][1] !== cur[0][1] || !isParamsSame(to[1], cur[1])) {
        state.active = false;
        state.exactActive = false;
        return;
      }
    }
    state.active = true;
    state.exactActive = toLen === curLen;
  };

  if (calcActive) {
    update(core[MATCH_ROUTE]); // init calc

    addUnmountFn(
      this,
      vmWatch(props, 'to', (v) => {
        state.href = props.to;
        toRoutePath = matchRoutes(v, core[ROUTES]);
        update(core[MATCH_ROUTE]);
      }),
    );

    const onChange = (matchRoutePath: MatchedRoute[]) => {
      update(matchRoutePath);
    };
    core[ON_CHANGE].add(onChange);
    addUnmountFn(this, () => {
      core[ON_CHANGE].delete(onChange);
    });
  }
  return <>{props.children({ ...state })}</>;
}
