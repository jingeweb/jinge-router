import { normPath } from './helper';

export interface PathSegment {
  type: 'lit' | 'num' | 'str';
  value?: string;
}
export function parsePath(path: string): PathSegment[] {
  path = normPath(path);
  return path
    .split('/')
    .slice(1) // normPath 后一定以 / 打头，去掉第一个 ''
    .map((pathSeg) => {
      if (pathSeg.charCodeAt(0) !== 58) {
        return { type: 'lit', value: pathSeg };
      } else if (pathSeg.endsWith('<num>')) {
        return { type: 'num', value: pathSeg.slice(1, pathSeg.length - 5) };
      } else {
        return { type: 'str', value: pathSeg.slice(1) };
      }
    }) as PathSegment[];
}
