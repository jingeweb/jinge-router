import { vm } from 'jinge';
import type { MatchRoute } from '../common';

export const ROUTEPATH = Symbol();
export class RouteInfo {
  pathname = '';
  [ROUTEPATH]: MatchRoute[] = [];
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  constructor(params: Record<string, unknown>, query: Record<string, unknown>) {
    this.params = params;
    this.query = query;
    return vm(this);
  }
  get routePath() {
    return this[ROUTEPATH];
  }
}
