import {
  Component,
  setAttribute,
  MessengerListener,
  removeEvent,
  addEvent,
  __,
  isObject,
  watch,
  unwatch,
  Attributes,
} from 'jinge';
import { isParamsOrQuerySameOrInclude } from '../util';
import { RouteJumpTarget, RouteLocation } from '../common';
import { Router } from '../router';
import _tpl from './link.html';

export class RouterLinkComponent extends Component {
  static template = _tpl;

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
  style: string;
  isActive: boolean;

  constructor(
    attrs: Attributes<{
      to: string | RouteLocation;
      text: string;
      target: RouteJumpTarget;
      replace: boolean;
      class: string;
      style: string;
      active: string;
    }>,
  ) {
    super(attrs);

    this.to = attrs.to;
    this.text = attrs.text || '';
    this.target = attrs.target || '_self';
    this.replace = !!attrs.replace;
    this.active = attrs.active;

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
  _onRc() {
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
  _onClick(e: KeyboardEvent) {
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

  __afterRender() {
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

  __beforeDestroy() {
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
  _upT() {
    if (this._tag <= 0) {
      setAttribute(this._el, 'target', this.target);
    }
  }

  /**
   * @internal
   *
   * update href and active class
   */
  _upHa() {
    this._upH();
    this._upA();
  }

  /**
   * @internal
   *
   * update href attribute of link
   */
  _upH() {
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
  _upA() {
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
