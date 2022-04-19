import {
  Component,
  ComponentAttributes,
  attrs,
  RenderFn,
  $$,
  __,
  isComponent,
  isFunction,
  assertRenderResults,
  createFragment,
  isObject,
  warn,
  createElement,
} from 'jinge';
import { RouterView, VIEW_NAME_PATH, RouterInfo, RouteMatchPathItem } from '../common';
import { Router } from '../router';

interface RouterContentComponent extends Component {
  __routeShouldLeave(from: RouterInfo, to: RouterInfo): Promise<boolean>;
}

function createEl(renderFn: RenderFn, context: Record<string | symbol, unknown>): Component {
  const el = new Component(
    attrs({
      [__]: {
        context,
        slots: {
          default: renderFn,
        },
      },
    }),
  );
  return el[$$].proxy as Component;
}

export class RouterViewComponent extends Component implements RouterView {
  _router: Router;
  _name: string;
  _path: string[];
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
   */
  _doc: string;

  resolving: boolean;

  constructor(
    attrs: ComponentAttributes & {
      name: 'default' | string;
      doc: 'before' | 'after';
    },
  ) {
    super(attrs);
    this._name = attrs.name || 'default';
    this._doc = attrs.doc || 'before';
    this._router = this.__getContext('router') as Router;
    if (!this._router) {
      throw new Error('Context named "router" not found.');
    }
    const parentNamePath = this.__getContext(VIEW_NAME_PATH) as string[];
    this._path = [...(parentNamePath || []), this._name];
    this.__setContext(VIEW_NAME_PATH, this._path, true);

    this.resolving = false;
  }

  __afterRender(): void {
    this._router.__regView(this._path, this);
  }

  __render(): Node[] {
    const el = document.createComment('router-view');
    this[__].rootNodes.push(el);
    return this[__].rootNodes as Node[];
  }

  /**
   * @internal
   */
  async _shouldUpdateView(from: RouterInfo, to: RouterInfo): Promise<boolean> {
    const el = this[__].rootNodes[0] as RouterContentComponent;
    if (!isComponent(el)) {
      return true;
    }
    if (isFunction(el.__routeShouldLeave)) {
      return await el.__routeShouldLeave(from, to);
    }
    return true;
  }

  /**
   * @internal
   */
  _doUpdateView(err: unknown, current: RouterInfo, routeMatchItem: RouteMatchPathItem): void {
    const roots = this[__].rootNodes;
    const oldEl = roots[0] as Component;
    const oldIsComp = isComponent(oldEl);
    const $el = oldIsComp ? oldEl.__firstDOM : (oldEl as unknown as Node);
    const $pa = $el.parentNode;
    const removeOldEl = (): void => {
      if (oldIsComp) {
        oldEl.__destroy(true);
      } else {
        $pa.removeChild($el);
      }
    };

    if (err) {
      err = isObject(err) ? (err as Error).message || err.toString() : err;
      const errRenderFn = this[__].slots?.error;
      if (!errRenderFn) {
        const newEl = createElement('p', { style: 'color: red;' }, err as string);
        $pa.insertBefore(newEl, $el);
        removeOldEl();
        roots[0] = newEl;
        return;
      }
      const newEl = createEl(errRenderFn, this[__].context);
      (newEl as Component & { error: unknown }).error = err;
      const ns = assertRenderResults(newEl.__render());
      $pa.insertBefore(ns.length > 1 ? createFragment(ns) : ns[0], $el);
      removeOldEl();
      roots[0] = newEl;
      newEl.__handleAfterRender();
      return;
    }

    let CompClazz = null;
    if (routeMatchItem) {
      CompClazz = routeMatchItem.route.components[this._name];
      if (!CompClazz) {
        warn(`Component of <router-view/> named "${this._name}" not provided.`);
      }
    }
    if (!CompClazz) {
      const newEl = document.createComment('router-view');
      $pa.insertBefore(newEl, $el);
      removeOldEl();
      roots[0] = newEl;
      return;
    }

    const newEl = CompClazz.create(
      attrs({
        ...routeMatchItem.resolves,
        [__]: {
          context: this[__].context,
        },
      }),
    );
    const ns = assertRenderResults(newEl.__render());
    $pa.insertBefore(ns.length > 1 ? createFragment(ns) : ns[0], $el);
    removeOldEl();
    roots[0] = newEl;
    newEl.__handleAfterRender();
  }

  /**
   * @internal
   */
  _prepareUpdateView(): void {
    if (this._doc !== 'before') {
      return;
    }
    const roots = this[__].rootNodes;
    const oldEl = roots[0] as Component;
    const oldIsComp = isComponent(oldEl);
    const $el = oldIsComp ? oldEl.__firstDOM : (oldEl as unknown as Node);
    const $pa = $el.parentNode;

    const $cursor: Node = document.createComment('--');
    $pa.insertBefore($cursor, $el);

    if (oldIsComp) {
      oldEl.__destroy(true);
    } else {
      $pa.removeChild($el);
    }

    /**
     *
     * ````html
     * <router-view>
     * <div slot:default><i class="loading"/>正在加载...</div>
     * <div slot:error>加载失败，请刷新浏览器重试。</div>
     * </router-view>
     * ````
     */
    const loadingRenderFn = this[__].slots?.default;
    if (!loadingRenderFn) {
      roots[0] = $cursor;
      return;
    }

    const loadingEl = createEl(loadingRenderFn, this[__].context);
    const ns = assertRenderResults(loadingEl.__render());
    $pa.insertBefore(ns.length > 1 ? createFragment(ns) : ns[0], $cursor);
    $pa.removeChild($cursor);

    roots[0] = loadingEl;
  }

  __beforeDestroy(): void {
    this._router.__deregView(this._path);
  }
}
