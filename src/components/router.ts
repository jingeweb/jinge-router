import {
  Component, ComponentAttributes
} from 'jinge';
import {
  RouteDefine, Router
} from '../router';

export interface RouterAttributes extends ComponentAttributes {
  router?: Router | 'html5' | 'hash';
  otherwise?: string | RouteDefine;
  routes?: RouteDefine[];
}

export class RouterComponent extends Component {
  __router: Router;

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
    if (attrs.otherwise) {
      router.otherwise(attrs.otherwise);
    }
    super(attrs);

    this.__router = router;
    this.__setContext('#router', router);
  }

  __afterRender(): void {
    this.__router.start();
  }
}

