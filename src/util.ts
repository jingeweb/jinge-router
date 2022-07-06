import { isObject, isUndefined } from 'jinge';
import { RouteParamsOrQuery } from './common';

/**
 * @param strict 如果 strict 为 false，则返回 src 是否被 dst 包含；否则返回 src 是否和 dst 完全相同。strict 默认为 true。
 */
export function isParamsOrQuerySameOrInclude(src: RouteParamsOrQuery, dst: RouteParamsOrQuery, strict = true): boolean {
  if (!src) return !dst;
  if (!dst) return !src;
  let kc = 0;
  for (const k in src) {
    const sv = src[k];
    const dv = dst[k];
    if (strict) {
      if (sv !== dv) return false;
    } else {
      if (isUndefined(dv) || dv === null) {
        if (!isUndefined(sv) && sv !== null) {
          return false;
        }
      } else if (sv !== dv) {
        return false;
      }
    }
    kc++;
  }
  if (strict && kc !== Object.keys(dst).length) {
    return false;
  }
  return true;
}

export function cloneParamsOrQuery(v: RouteParamsOrQuery): RouteParamsOrQuery {
  return Object.fromEntries(
    Object.keys(v).map((k) => {
      return [k, v[k]];
    }),
  );
}

export function encodeParamsOrQuery(v: RouteParamsOrQuery): string {
  if (!isObject(v)) return '';
  return Object.keys(v)
    .map((k) => {
      return encodeURIComponent(k) + '=' + encodeURIComponent(v[k] as string);
    })
    .join('&');
}
