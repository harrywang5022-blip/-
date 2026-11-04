// URL helper for resolving shareable links between AI Studio Dev and Shared URLs

export function getRecommendedShareOrigin(): {
  currentOrigin: string;
  recommendedOrigin: string;
  isDevUrl: boolean;
  sharedUrl: string;
} {
  const current = typeof window !== 'undefined' ? window.location.origin : '';
  const isDev = current.includes('ais-dev-');

  // Convert ais-dev- to ais-pre- for public sharing without 403 Forbidden
  const shared = isDev ? current.replace('ais-dev-', 'ais-pre-') : current;

  return {
    currentOrigin: current,
    recommendedOrigin: shared,
    isDevUrl: isDev,
    sharedUrl: shared,
  };
}

export function buildJoinUrl(roomId: string, baseOrigin?: string): string {
  const origin = baseOrigin || getRecommendedShareOrigin().recommendedOrigin;
  return `${origin}?room=${roomId}`;
}
