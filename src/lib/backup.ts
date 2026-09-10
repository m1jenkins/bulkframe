import { db } from '../db';
import { DEFAULT_SETTINGS, type Settings } from './types';
import { getSettings, saveSettings } from './settings';

export interface BackupPayload {
  version: 1;
  exportedAt: number;
  scans?: Awaited<ReturnType<typeof db.scans.toArray>>;
  favorites?: Awaited<ReturnType<typeof db.favorites.toArray>>;
  folders?: Awaited<ReturnType<typeof db.folders.toArray>>;
  library?: Awaited<ReturnType<typeof db.library.toArray>>;
  rules?: Awaited<ReturnType<typeof db.rules.toArray>>;
  savedSearches?: Awaited<ReturnType<typeof db.savedSearches.toArray>>;
  analytics?: Awaited<ReturnType<typeof db.analytics.toArray>>;
  settings?: Settings;
}

export async function exportBackup(sections: {
  scans?: boolean;
  favorites?: boolean;
  analytics?: boolean;
  settings?: boolean;
}): Promise<BackupPayload> {
  const payload: BackupPayload = { version: 1, exportedAt: Date.now() };
  if (sections.scans) {
    payload.scans = await db.scans.toArray();
    payload.savedSearches = await db.savedSearches.toArray();
    payload.library = await db.library.toArray();
    payload.rules = await db.rules.toArray();
  }
  if (sections.favorites) {
    payload.favorites = await db.favorites.toArray();
    payload.folders = await db.folders.toArray();
  }
  if (sections.analytics) payload.analytics = await db.analytics.toArray();
  if (sections.settings) payload.settings = await getSettings();
  return payload;
}

export async function importBackup(
  payload: BackupPayload,
  sections: { scans?: boolean; favorites?: boolean; analytics?: boolean; settings?: boolean },
) {
  if (sections.scans) {
    if (Array.isArray(payload.scans)) await db.scans.bulkPut(payload.scans);
    if (Array.isArray(payload.savedSearches)) await db.savedSearches.bulkPut(payload.savedSearches);
    if (Array.isArray(payload.library)) await db.library.bulkPut(payload.library);
    if (Array.isArray(payload.rules)) await db.rules.bulkPut(payload.rules);
  }
  if (sections.favorites) {
    if (Array.isArray(payload.favorites)) await db.favorites.bulkPut(payload.favorites);
    if (Array.isArray(payload.folders)) await db.folders.bulkPut(payload.folders);
  }
  if (sections.analytics && Array.isArray(payload.analytics)) await db.analytics.bulkPut(payload.analytics);
  if (sections.settings && payload.settings) {
    await saveSettings({ ...DEFAULT_SETTINGS, ...payload.settings });
  }
}

export async function resetSection(section: 'scans' | 'favorites' | 'analytics' | 'settings') {
  if (section === 'scans') {
    await db.scans.clear();
    await db.savedSearches.clear();
  }
  if (section === 'favorites') {
    await db.favorites.clear();
    await db.folders.clear();
  }
  if (section === 'analytics') await db.analytics.clear();
  if (section === 'settings') await saveSettings(DEFAULT_SETTINGS);
}
