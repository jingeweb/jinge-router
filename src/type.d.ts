import type { JingeHmrRuntime } from 'jinge';

declare module '*.html' {
  const resource: string;
  export = resource;
}

declare global {
  interface Window {
    __JINGE_HMR__?: JingeHmrRuntime;
  }
}
