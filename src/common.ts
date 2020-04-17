import {
  _ViewDeclaration, ViewContext,
  StateObject
} from '@uirouter/core';
import {
  Component
} from 'jinge';

export interface ComponentConstructor {
  create(attrs: object): Component;
}

export interface JingeViewDeclaration extends _ViewDeclaration {
  component?: ComponentConstructor; 
}
export interface JingeViewDefinition {
  [k: string]: JingeViewDeclaration;
}
export interface JingeStateObject extends StateObject {
  component?: ComponentConstructor;
  views: {
    [k: string]: JingeViewDeclaration;
  };
}
export interface UIViewAddress {
  context: ViewContext;
  fqn: string;
}
