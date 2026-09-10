import { DEFAULT_SETTINGS, type Settings } from './types';

const KEY = 'bulkframe.settings';

export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(KEY);
  return { ...DEFAULT_SETTINGS, ...(stored[KEY] as Partial<Settings> | undefined) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await browser.storage.local.set({ [KEY]: next });
  return next;
}

export function watchSettings(cb: (settings: Settings) => void): () => void {
  const listener = (changes: { [key: string]: { newValue?: unknown } }, area: string) => {
    if (area !== 'local' || !changes[KEY]) return;
    cb({ ...DEFAULT_SETTINGS, ...(changes[KEY].newValue as Partial<Settings>) });
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
