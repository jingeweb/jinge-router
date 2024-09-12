import { normPath } from './helper';

export const PATH_TYPE_LIT = 0;
export const PATH_TYPE_NUM = 1;
export const PATH_TYPE_STR = 2;
export const PATH_TYPE_ANY = 3;
export interface PathSegment {
  type: 0 | 1 | 2 | 3;
  value?: string;
}

export function parsePath(path: string, isNestRoute: boolean): PathSegment[] {
  const segs = normPath(path).split('/').slice(1); // normPath 后一定以 / 打头，去掉第一个 ''
  const pathSegs = segs.map((pathSeg, idx) => {
    const fc = pathSeg.charCodeAt(0);
    if (fc === 42) {
      if (isNestRoute) throw new Error('嵌套父路由的 path 不能使用星号');
      if (idx !== segs.length - 1) throw new Error('path 中星号只能在末尾出现');
      return { type: PATH_TYPE_ANY };
    } else if (fc !== 58) {
      return { type: PATH_TYPE_LIT, value: pathSeg };
    } else if (pathSeg.endsWith('<num>')) {
      return { type: PATH_TYPE_NUM, value: pathSeg.slice(1, pathSeg.length - 5) };
    } else {
      return { type: PATH_TYPE_STR, value: pathSeg.slice(1) };
    }
  }) as PathSegment[];
  return pathSegs;
}
