import { extFromFilename } from './images';
import { orientationOf } from './images';
import { domainFromUrl } from './pages';
import type { ConflictAction, DownloadRule, ImageCandidate } from './types';

export function matchRule(rule: DownloadRule, image: ImageCandidate): boolean {
  if (!rule.enabled) return false;
  switch (rule.matchType) {
    case 'extension': {
      const ext = extFromFilename(image.filename) || image.type;
      return ext.toLowerCase() === String(rule.value).toLowerCase().replace(/^\./, '');
    }
    case 'domain':
      return domainFromUrl(image.pageUrl || image.url).includes(rule.value.toLowerCase());
    case 'minSize': {
      const min = Number(rule.value);
      return (image.byteSize ?? 0) >= min;
    }
    case 'orientation':
      return orientationOf(image.width, image.height) === rule.value;
    default:
      return false;
  }
}

export function firstMatchingRule(rules: DownloadRule[], image: ImageCandidate): DownloadRule | undefined {
  return [...rules]
    .sort((a, b) => a.order - b.order)
    .find((rule) => matchRule(rule, image));
}

export function joinDownloadPath(folder: string | undefined, filename: string): string {
  const cleanFolder = (folder || '')
    .replace(/^[\\/]+/, '')
    .replace(/\.\./g, '')
    .replace(/\\/g, '/');
  return cleanFolder ? `${cleanFolder.replace(/\/$/, '')}/${filename}` : filename;
}

export function conflictFor(rules: DownloadRule[], image: ImageCandidate, fallback: ConflictAction): ConflictAction {
  return firstMatchingRule(rules, image)?.conflict ?? fallback;
}
