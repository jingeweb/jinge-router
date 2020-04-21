import {
  Component, ComponentAttributes
} from 'jinge';
import {
  RouteDefine
} from '../common';
import {
  Router
} from '../router';

export interface RouterAttributes extends ComponentAttributes {
  router?: Router | 'html5' | 'hash';
  routes?: RouteDefine[];
}

export class RouterComponent extends Component {
  _router: Router;

  constructor(attrs: RouterAttributes) {
    let router: Router;
    if (attrs.router instanceof Router) {
      router = attrs.router as Router;
    } else if (attrs.router === 'hash') {
      router = new Router({
        mode: 'hash'
      });
    } else {
      router = new Router({
        mode: 'html5'
      });
    }
    if (attrs.routes) {
      (attrs.routes as RouteDefine[]).forEach(rd => {
        router.register(rd);
      });
    }
    super(attrs);
   
    this._router = router;
    this.baseHref = attrs.baseHref as string || '/';

    this.__setContext('router', router);
    this.__notify('load', this._router);
  }

  get baseHref(): string {
    return this._router.baseHref;
  }

  set baseHref(v: string) {
    this._router.baseHref = v;
  }

  __afterRender(): void {
    this._router.start();
  }
}

