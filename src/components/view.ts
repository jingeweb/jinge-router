import {
  type ComponentHost,
  type JNode,
  type PropsWithSlots,
  ROOT_NODES,
  __,
  addMountFn,
  addUnmountFn,
  createComment,
  getComponentContext,
  setComponentContext,
} from 'jinge';
import { VIEW_NAME_PATH } from '../common';
import { getRouterCoreContext } from '../core';
import { deregisterView, registerView } from '../core/view';

export interface RouterViewProps {
  /**
   * 该属性为单向绑定属性。
   */
  name?: 'default' | string;
  /**
   * <router-view/> 在切换路由时，销毁旧的内容的模式。
   * 默认情况下是 'before'（destroy old content before resolved），
   *   即在加载好目标路由的 resolves 和 component class 之前，就先销毁旧的元素，
   *   如果有 loading element 的话，同时渲染提示加载状态的元素。
   *   这种模式的优点是可以立即响应用户的路由切换交互，缺点是如果目标路由的加载很快，
   *   loading element 就会一闪而过，视觉上不好。
   * 还可以使用 'after'（destroy old content after resolved），
   *   即在加载好目标路由的 resolves 和 component class 之后才销毁旧的元素并渲染新内容元素。
   *   这种模式的优点是视觉上的切换很顺畅，缺点是如果目标路由的加载比较耗时的话，
   *   会有一种卡顿未响应路由切换的感觉。
   *
   * 该属性为单向绑定属性。
   */
  doc?: 'before' | 'after';
}

export function RouterView(
  this: ComponentHost,
  props: PropsWithSlots<
    RouterViewProps,
    | JNode
    | {
        error?: JNode;
        loading?: JNode;
      }
  >,
) {
  const router = getRouterCoreContext(this);
  const namePath = [
    ...getComponentContext<string[]>(this, VIEW_NAME_PATH),
    props.name ?? 'default',
  ];
  setComponentContext(this, VIEW_NAME_PATH, namePath);

  addMountFn(this, () => {
    registerView(router, namePath, this, props.doc ?? 'before');
  });

  addUnmountFn(this, () => {
    deregisterView(router, namePath);
  });

  const placeholder = createComment('router-view');
  this[ROOT_NODES].push(placeholder);
  return this[ROOT_NODES];
}
