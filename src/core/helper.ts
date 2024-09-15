export function normPath(p: string): string {
  if (p.startsWith('#')) p = p.slice(1);
  if (!p || p === '/') return '/';
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.endsWith('/')) p = p.slice(0, p.length - 1);
  return p.replace(/[/\\]+/g, '/');
}
export function updateHistoryState(href: string, replace = false) {
  if (replace) {
    history.replaceState(null, '', href);
  } else {
    history.pushState(null, '', href);
  }
  setImmediate(() => dispatchEvent(new PopStateEvent('popstate')));
}
