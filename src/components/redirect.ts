import {
  Component
} from 'jinge';

/**
 * @internal
 */
export class RouterParentComponent extends Component {
  static get template(): string {
    return `
<!-- import { RouterViewComponent }  from './view'; -->
<RouterViewComponent doc="after"/>`;
  }
}
