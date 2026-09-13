import type { ConflictAction } from './types';

const ILLEGAL = /[<>"|?*\u0000-\u001f]/g;

export type DownloadRoute =
  | { kind: 'browser'; folder: string }
  | { kind: 'filesystem'; folder: string };

export function fileUrlToPath(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'file:') return value;
    let path = decodeURIComponent(url.pathname);
    if (/^\/[a-zA-Z]:\//.test(path)) path = path.slice(1);
    return path;
  } catch {
    return value;
  }
}

export function isAbsoluteFolder(folder: string): boolean {
  const trimmed = folder.trim();
  const value = trimmed.toLowerCase().startsWith('file:') ? fileUrlToPath(trimmed) : trimmed;
  if (/^[a-zA-Z]:[\\/]/.test(value)) return true;
  if (value.startsWith('\\\\') || value.startsWith('//')) return true;
  return value.startsWith('/');
}

export function sanitizeFolder(folder: string): string {
  const trimmed = folder.trim();
  let value = trimmed.toLowerCase().startsWith('file:') ? fileUrlToPath(trimmed) : trimmed;
  const absolute = isAbsoluteFolder(value);
  value = value.replace(/\\/g, '/').replace(/\.\./g, '').replace(ILLEGAL, '_');
  if (absolute) {
    const drive = /^([a-zA-Z]:)(\/.*)?$/.exec(value);
    value = drive ? `${drive[1]}${(drive[2] || '').replace(/:/g, '_')}` : value.replace(/:/g, '_');
  } else {
    value = value.replace(/:/g, '_').replace(/^\/+/, '');
  }
  value = value.replace(/\/+/g, '/');
  if (value !== '/' && !/^[a-zA-Z]:\/?$/.test(value)) value = value.replace(/\/$/, '');
  return value;
}

export function coerceFolder(folder: string): string {
  const sanitized = sanitizeFolder(folder);
  if (isAbsoluteFolder(sanitized)) return sanitized;
  if (/^Users\/[^/]+\//.test(sanitized) || /^home\/[^/]+\//.test(sanitized)) {
    return sanitizeFolder(`/${sanitized}`);
  }
  return sanitized;
}

export function folderHandleKey(folder: string): string {
  return coerceFolder(folder.replaceAll('{date}', '').replaceAll('{domain}', ''));
}

export function relativeFolder(root: string, expanded: string): string {
  const from = coerceFolder(root);
  const to = coerceFolder(expanded);
  if (!from || to === from) return '';
  const prefix = from.endsWith('/') ? from : `${from}/`;
  if (!to.startsWith(prefix)) return '';
  return to.slice(prefix.length);
}

export function joinDownloadPath(folder: string | undefined, filename: string): string {
  const name = filename.replace(/^\/+/, '');
  if (!folder) return name;
  const cleanFolder = coerceFolder(folder);
  return cleanFolder ? `${cleanFolder.replace(/\/$/, '')}/${name}` : name;
}

export function downloadRoute(folder: string | undefined): DownloadRoute {
  const value = folder ? coerceFolder(folder) : '';
  if (value && isAbsoluteFolder(value)) return { kind: 'filesystem', folder: value };
  return { kind: 'browser', folder: value };
}

export function uniquifyFilename(filename: string, taken: Iterable<string>): string {
  const used = taken instanceof Set ? taken : new Set(taken);
  if (!used.has(filename)) return filename;
  const dot = filename.lastIndexOf('.');
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot) : '';
  for (let i = 1; i < 10_000; i++) {
    const candidate = `${stem} (${i})${ext}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error('Could not choose a unique filename');
}

export function conflictName(conflict: ConflictAction, filename: string, taken: Iterable<string>): string {
  if (conflict === 'overwrite') return filename;
  return uniquifyFilename(filename, taken);
}

export function destFolderLabel(folder: string): string {
  const dest = coerceFolder(folder);
  if (!dest) return 'Downloads (top level)';
  if (isAbsoluteFolder(dest)) return dest;
  return `Downloads/${dest}`;
}
