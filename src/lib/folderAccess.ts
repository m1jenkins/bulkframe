import {
  coerceFolder,
  conflictName,
  folderHandleKey,
  isAbsoluteFolder,
  relativeFolder,
} from './downloadPath';
import type { ConflictAction } from './types';

const DB_NAME = 'bulkframe.folder-handles';
const STORE = 'handles';
const GRANTED_FOLDERS_KEY = 'bulkframe.grantedFolders';

type DirHandle = FileSystemDirectoryHandle & {
  queryPermission?: (opts: { mode: 'readwrite' }) => Promise<PermissionState | 'prompt' | 'granted' | 'denied'>;
  requestPermission?: (opts: { mode: 'readwrite' }) => Promise<PermissionState | 'prompt' | 'granted' | 'denied'>;
};

type PickerWindow = Window & {
  showDirectoryPicker?: (opts: { mode: 'readwrite' }) => Promise<DirHandle>;
};

function openHandlesDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open folder access storage'));
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openHandlesDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('Folder access storage failed'));
    });
  } finally {
    db.close();
  }
}

async function grantedFolderKeys(): Promise<string[]> {
  const stored = await browser.storage.local.get(GRANTED_FOLDERS_KEY);
  const value = stored[GRANTED_FOLDERS_KEY];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export async function markFolderGranted(key: string): Promise<void> {
  const list = await grantedFolderKeys();
  if (!list.includes(key)) list.push(key);
  await browser.storage.local.set({ [GRANTED_FOLDERS_KEY]: list });
}

export async function storeFolderHandle(key: string, handle: DirHandle): Promise<void> {
  await withStore('readwrite', (store) => store.put(handle, key));
}

export async function loadFolderHandle(destFolder: string): Promise<DirHandle | undefined> {
  const key = folderHandleKey(destFolder);
  const handle = await withStore<DirHandle | undefined>('readonly', (store) => store.get(key));
  return handle ?? undefined;
}

export async function assertFolderHandleStored(destFolder: string): Promise<void> {
  const folder = folderHandleKey(destFolder);
  if (!isAbsoluteFolder(folder)) return;
  if ((await grantedFolderKeys()).includes(folder)) return;
  const handle = await loadFolderHandle(folder).catch(() => undefined);
  if (!handle) {
    throw new Error(`Allow folder access on the Scheduled page to save to ${folder}.`);
  }
}

export async function hasFolderAccess(destFolder: string): Promise<boolean> {
  const folder = coerceFolder(destFolder);
  if (!isAbsoluteFolder(folder)) return true;
  const handle = await loadFolderHandle(folder);
  if (!handle) {
    if ((await grantedFolderKeys()).includes(folderHandleKey(destFolder))) return true;
    return false;
  }
  if (!handle.queryPermission) return true;
  try {
    return (await handle.queryPermission({ mode: 'readwrite' })) === 'granted';
  } catch {
    return true;
  }
}

export async function pickAndStoreFolderHandle(
  destFolder: string,
): Promise<{ name: string; expectedName: string; mismatch: boolean }> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) throw new Error('This browser cannot save outside the Downloads folder. Use Chrome.');
  const key = folderHandleKey(destFolder);
  if (!isAbsoluteFolder(key)) throw new Error('Enter an absolute folder path first.');
  const expectedName = key.split('/').filter(Boolean).pop() || key;
  const handle = await picker({ mode: 'readwrite' });
  await storeFolderHandle(key, handle);
  await markFolderGranted(key);
  return { name: handle.name, expectedName, mismatch: handle.name !== expectedName };
}

async function ensurePermission(handle: DirHandle, folder: string): Promise<void> {
  const query = (await handle.queryPermission?.({ mode: 'readwrite' }).catch(() => 'prompt')) ?? 'granted';
  if (query === 'granted') return;
  const next = (await handle.requestPermission?.({ mode: 'readwrite' }).catch(() => 'denied')) ?? 'denied';
  if (next !== 'granted') {
    throw new Error(`Allow folder access on the Scheduled page to save to ${folder}.`);
  }
}

async function fileExists(dir: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

async function resolveChildDir(root: FileSystemDirectoryHandle, relative: string): Promise<FileSystemDirectoryHandle> {
  let dir = root;
  for (const segment of relative.split('/').filter(Boolean)) {
    dir = await dir.getDirectoryHandle(segment, { create: true });
  }
  return dir;
}

export async function writeBlobToFolder(opts: {
  destFolder: string;
  filename: string;
  blob: Blob;
  conflict: ConflictAction;
}): Promise<string> {
  const folder = coerceFolder(opts.destFolder);
  const key = folderHandleKey(folder);
  const handle = await loadFolderHandle(key);
  if (!handle) throw new Error(`Allow folder access on the Scheduled page to save to ${key}.`);
  await ensurePermission(handle, key);
  const dir = await resolveChildDir(handle, relativeFolder(key, folder));
  const taken: string[] = [];
  if (opts.conflict !== 'overwrite' && (await fileExists(dir, opts.filename))) taken.push(opts.filename);
  let name = conflictName(opts.conflict, opts.filename, taken);
  if (opts.conflict !== 'overwrite') {
    for (let i = 0; i < 10_000 && (await fileExists(dir, name)); i++) {
      taken.push(name);
      name = conflictName(opts.conflict, opts.filename, taken);
    }
  }
  const file = await dir.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  await writable.write(opts.blob);
  await writable.close();
  return name;
}
