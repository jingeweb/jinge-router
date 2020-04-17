/**
 * Copied from https://github.com/ui-router/react/blob/master/src/reactViews.tsx
 * Modified by Yuhang Ge
 */

import {
  services,
  ViewService,
  PathNode,
  ViewConfig
} from '@uirouter/core';
import {
  ComponentConstructor,
  JingeStateObject,
  JingeViewDefinition,
  JingeViewDeclaration
} from './common';

export function jingeViewsBuilder(state: JingeStateObject): JingeViewDefinition {
  const views: JingeViewDefinition = {};
  let viewsDefinitionObject: JingeViewDefinition;
  if (!state.views) {
    viewsDefinitionObject = {
      'default': {
        component: state.component
      }
    };
  } else {
    viewsDefinitionObject = Object.fromEntries(Object.keys(state.views).map(k => {
      const _decl = state.views[k];
      if ((_decl as JingeViewDeclaration).component) {
        return [k, _decl as JingeViewDeclaration];
      }
      return [k, {
        component: _decl as ComponentConstructor
      } as JingeViewDeclaration];
    }));
  }

  for (const name in viewsDefinitionObject) {
    const config = viewsDefinitionObject[name];
    if (Object.keys(config).length === 0)
      continue;
    config.$type = 'jinge';
    config.$context = state;
    config.$name = name || 'default';

    const normalized = ViewService.normalizeUIViewTarget(config.$context, config.$name);
    config.$uiViewName = normalized.uiViewName;
    config.$uiViewContextAnchor = normalized.uiViewContextAnchor;

    views[config.$name] = config;
  }
  return views;
}

let AUTO_INC_ID = 0;

export class JingeViewConfig implements ViewConfig {
  loaded: boolean;
  $id: number;
  path: PathNode[];
  viewDecl: JingeViewDeclaration;

  constructor(path: PathNode[], viewDecl: JingeViewDeclaration) {
    this.loaded = true;
    this.$id = AUTO_INC_ID++;
    this.path = path;
    this.viewDecl = viewDecl;
    // console.log('new config', this.$id, viewDecl);
  }

  load(): Promise<JingeViewConfig> {
    return services.$q.when(this);
  }
}
