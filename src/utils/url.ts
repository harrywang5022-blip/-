export function getRecommendedShareOrigin(): {
  currentOrigin: string;
  recommendedOrigin: string;
  isDevUrl: boolean;
  sharedUrl: string;
  pathname: string;
} {
  const current = typeof window !== 'undefined' ? window.location.origin : '';
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const isDev = current.includes('ais-dev-');

  // Convert ais-dev- to ais-pre- for public sharing without 403 Forbidden
  const shared = isDev ? current.replace('ais-dev-', 'ais-pre-') : current;

  return {
    currentOrigin: current,
    recommendedOrigin: shared,
    isDevUrl: isDev,
    sharedUrl: shared,
    pathname,
  };
}

export function buildJoinUrl(roomId: string, baseOrigin?: string): string {
  const info = getRecommendedShareOrigin();
  const origin = baseOrigin || info.recommendedOrigin;
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

  try {
    const base = origin.startsWith('http') ? origin : `https://${origin}`;
    const url = new URL(base);
    // If the baseOrigin did not specify a pathname and we are currently on a subpath (e.g. /my-repo/)
    if (url.pathname === '/' && currentPath && currentPath !== '/') {
      url.pathname = currentPath;
    }
    url.searchParams.set('room', roomId);
    return url.toString();
  } catch {
    return `${origin}?room=${roomId}`;
  }
}
