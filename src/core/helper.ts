import type { AnyFn } from 'jinge';

export function normPath(p: string): string {
  if (!p || p === '/') return p;
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.endsWith('/')) p = p.slice(0, p.length - 1);
  return p.replace(/[/\\]+/g, '/');
}

export function addGuard(arr: Set<AnyFn>, fn: AnyFn): AnyFn {
  arr.add(fn);
  return () => arr.delete(fn);
}
