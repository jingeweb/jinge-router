export function normPath(p: string): string {
  if (p.startsWith('#')) p = p.slice(1);
  if (!p || p === '/') return '/';
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.endsWith('/')) p = p.slice(0, p.length - 1);
  return p.replace(/[/\\]+/g, '/');
}

/** 将路由内的目标地址转换为浏览器地址，保留 query 等后缀。 */
export function getRouteHref(to: string, baseHref: string, mode: 'hash' | 'html5') {
  const path = baseHref === '/' ? to : `${baseHref}${to.startsWith('/') ? '' : '/'}${to}`;
  return (mode === 'hash' ? '#' : '') + path;
}

export function updateHistoryState(href: string, replace = false) {
  if (replace) {
    history.replaceState(null, '', href);
  } else {
    history.pushState(null, '', href);
  }
  window.setImmediate(() => dispatchEvent(new PopStateEvent('popstate')));
}
