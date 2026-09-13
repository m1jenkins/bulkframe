const CDN_HOST = /^(?:media|thumbs\d*|files)\.redgifs\.com$/i;
const ASSET_EXT = /\.(?:jpe?g|png|webp|gif|mp4|webm|m4v)$/i;
const QUALITY_SUFFIX = /-(poster|mobile|silent|tiny|thumbnail|vthumbnail)$/i;
const GIF_ID = /^[A-Z][a-z0-9]*[A-Z][a-zA-Z0-9]*$/;

export function upgradeRedgifsMediaUrl(raw: string): { url: string; poster: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, '');
  if (!CDN_HOST.test(host)) return null;
  const file = parsed.pathname.split('/').filter(Boolean).pop() || '';
  const stem = file.replace(ASSET_EXT, '');
  if (!stem || stem === file) return null;
  const id = stem.replace(QUALITY_SUFFIX, '');
  if (!GIF_ID.test(id)) return null;
  return {
    url: `https://media.redgifs.com/${id}.mp4`,
    poster: `https://media.redgifs.com/${id}-poster.jpg`,
  };
}
