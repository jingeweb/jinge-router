/// <reference types="vite/client" />

import type { JingeHmrRuntime } from 'jinge';

declare global {
  interface Window {
    __JINGE_HMR__?: JingeHmrRuntime;
  }
}
