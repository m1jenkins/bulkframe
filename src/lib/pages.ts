const BLOCKED = [
  /^chrome:\/\//i,
  /^chrome-extension:\/\//i,
  /^edge:\/\//i,
  /^about:/i,
  /^devtools:\/\//i,
  /^view-source:/i,
  /^https:\/\/chrome(webstore)?\.google\.com\//i,
  /^https:\/\/chromewebstore\.google\.com\//i,
  /^https:\/\/microsoftedge\.microsoft\.com\/addons/i,
];

export function isScannableUrl(url?: string | null): boolean {
  if (!url) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  return !BLOCKED.some((re) => re.test(url));
}

export function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || 'unknown';
  } catch {
    return 'unknown';
  }
}
