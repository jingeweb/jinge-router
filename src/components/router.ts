import { Attributes, Component } from 'jinge';
import { RouteDefine } from '../common';
import { Router } from '../router';

export class RouterComponent extends Component {
  _router: Router;

  constructor(
    attrs: Attributes<{
      router?: Router | 'html5' | 'hash';
      routes?: RouteDefine[];
      baseHref?: string;
    }>,
  ) {
    let router: Router;
    if (attrs.router instanceof Router) {
      router = attrs.router as Router;
    } else if (attrs.router === 'hash') {
      router = new Router({
        mode: 'hash',
      });
    } else {
      router = new Router({
        mode: 'html5',
      });
    }
    attrs.routes?.forEach((rd) => {
      router.register(rd);
    });
    super(attrs);

    this._router = router;
    this.baseHref = attrs.baseHref || '/';

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
