import { upgradeRedgifsMediaUrl } from './redgifs.ts';

const VIDEO_FILE = /\.(mp4|m4v|webm|mov|mkv)$/i;

function looksLikeVideoFile(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.startsWith('blob:') || lower.startsWith('javascript:')) return false;
  if (lower.includes('.m3u8')) return false;
  const path = (url.split('#')[0] ?? url).split('?')[0] ?? url;
  return VIDEO_FILE.test(path);
}

function scoreVideoUrl(url: string): number {
  const lower = url.toLowerCase();
  let score = 0;
  if (lower.includes('.mp4')) score += 3;
  if (lower.includes('.webm')) score += 2;
  if (!lower.includes('-mobile') && !lower.includes('-silent')) score += 2;
  return score;
}

export function pickVideoFile(input: {
  src?: string;
  currentSrc?: string;
  poster?: string;
  sourceSrcs?: string[];
}): { url: string; poster?: string } | null {
  const raw = [input.currentSrc, input.src, ...(input.sourceSrcs ?? [])].filter((url): url is string => Boolean(url));
  const playable = raw
    .filter(looksLikeVideoFile)
    .map((url) => upgradeRedgifsMediaUrl(url)?.url ?? url)
    .sort((a, b) => scoreVideoUrl(b) - scoreVideoUrl(a));
  const posterUpgrade = input.poster ? upgradeRedgifsMediaUrl(input.poster) : null;
  const poster = input.poster || posterUpgrade?.poster;
  if (playable[0]) return { url: playable[0], poster };
  if (posterUpgrade) return { url: posterUpgrade.url, poster: input.poster || posterUpgrade.poster };
  return null;
}
