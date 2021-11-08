import {
  Component,
  setAttribute,
  ComponentAttributes,
  MessengerListener,
  removeEvent,
  addEvent,
  __,
  isObject,
  watch,
  unwatch,
} from 'jinge';
import { RouteJumpTarget, RouteLocation, isParamsOrQuerySameOrInclude } from '../common';
import { Router } from '../router';

export class RouterLinkComponent extends Component {
  static get template(): string {
    return `
<a
 slot-use:default
 e:class="!className && !(isActive && active) ? _udef : (className || '') + (isActive && active ? (className ? ' ' : '') + active : '')"
 e:style="style"
>
\${text}
</a>`;
  }

  _router: Router;
  _el: HTMLElement;
  _tag: number;
  _active: string;
  _target: RouteJumpTarget;
  _to: string | RouteLocation;
  /**
   * router changed handler
   */
  _rch: MessengerListener;
  /**
   * click handler
   */
  _clh: EventListener;
  /**
   * query watched
   */
  _qw: boolean;
  /**
   * router onChange deregister
   */
  _rcd: () => void;

  replace: boolean;
  text: string;
  className: string;
  style: string;
  isActive: boolean;

  constructor(attrs: ComponentAttributes) {
    super(attrs);

    this.to = attrs.to as string | RouteLocation;
    this.text = (attrs.text as string) || '';
    this.target = (attrs.target as RouteJumpTarget) || '_self';
    this.replace = !!attrs.replace;
    this.className = attrs.class as string;
    this.style = attrs.style as string;
    this.active = attrs.active as string;

    this._router = this.__getContext('router') as Router;
    if (!this._router) {
      throw new Error('Context named "router" not found.');
    }
    this._tag = attrs[__].slots?.default ? 0 : -1;
    this._el = null;
    this._qw = false; // query is watched
    this._clh = this._onClick.bind(this); // click handler
    this._rch = this._onRc.bind(this);
    this._rcd = null; // router onChange deregister
  }

  /**
   * @internal
   *
   * handle router changed event/guard
   */
  _onRc(): void {
    this._upA();
  }

  get target(): RouteJumpTarget {
    return this._target;
  }

  set target(v: RouteJumpTarget) {
    if (this._target === v) return;
    this._target = v;
    this._upT();
  }

  get active(): string {
    return this._active;
  }

  set active(v: string) {
    if (this._active === v) return;
    if (this._tag >= 0 && this._active && this._el) {
      this._el.classList.remove(this._active); // remove previous active class
    }
    this._active = v;
    this.__updateIfNeed(this._upA);
  }

  get to(): string | RouteLocation {
    return this._to;
  }

  set to(v: string | RouteLocation) {
    if (this._to === v) return;
    this._to = v;
    this.__updateIfNeed(this._upHa);
  }

  /**
   * @internal
   */
  _onClick(e: KeyboardEvent): void {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey) {
      return;
    }
    if (this._tag <= 0) {
      e.preventDefault(); // prevent default <a> jump
    }
    this._router.go(this._to, {
      target: this.target,
      replace: this.replace,
    });
  }

  __afterRender(): void {
    const el = this.__firstDOM as HTMLElement;
    if (this._tag >= 0) {
      this._tag = el.tagName === 'A' ? 0 : 1;
    }
    this._el = el;
    this._upT();
    this._upHa();
    this._rcd = this._router.afterEach(() => {
      this._onRc();
    });
    addEvent(el, 'click', this._clh);
  }

  __beforeDestroy(): void {
    removeEvent(this._el, 'click', this._clh);
    this._rcd();
    if (this._qw) {
      unwatch(this._router.__info, 'query.*', this._rch);
    }
  }

  /**
   * @internal
   *
   * update target attribute of link
   */
  _upT(): void {
    if (this._tag <= 0) {
      setAttribute(this._el, 'target', this.target);
    }
  }

  /**
   * @internal
   *
   * update href and active class
   */
  _upHa(): void {
    this._upH();
    this._upA();
  }

  /**
   * @internal
   *
   * update href attribute of link
   */
  _upH(): void {
    if (this._tag <= 0) {
      let href;
      if (!this._to || !(href = this._router.href(this._to))) {
        this._el.removeAttribute('href');
      } else {
        setAttribute(this._el, 'href', href);
      }
    }
  }

  /**
   * @internal
   *
   * update active class of link
   */
  _upA(): void {
    let isActive = this._to && this._router.includes(this._to);
    if (isActive && isObject(this._to) && (this._to as RouteLocation).query) {
      if (!this._qw) {
        watch(this._router.__info, 'query.*', this._rch);
        this._qw = true;
      }
      isActive = isParamsOrQuerySameOrInclude((this._to as RouteLocation).query, this._router.__info?.query);
    } else if (this._qw) {
      this._qw = false;
      unwatch(this._router.__info, 'query.*', this._rch);
    }
    if (this.isActive === isActive) {
      return;
    }
    this.isActive = isActive;
    if (!this._active || this._tag < 0) {
      return;
    }
    if (this.isActive) {
      this._el.classList.add(this._active);
    } else {
      this._el.classList.remove(this._active);
    }
  }
}
