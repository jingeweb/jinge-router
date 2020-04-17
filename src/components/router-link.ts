import {
  Component, ComponentAttributes, Router
} from 'jinge/src/core';

export type RouterLinkTarget = '_blank' | '_self';

export class RouterLinkComponent extends Component {
  to: string;
  target: RouterLinkTarget;

  constructor(attrs: ComponentAttributes) {
    super(attrs);

    this.to = attrs.to as string;
    this.target = attrs.target as RouterLinkTarget || '_self';
  }
}