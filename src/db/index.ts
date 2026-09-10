import Dexie, { type Table } from 'dexie';
import type {
  AnalyticsEvent,
  DownloadRecord,
  DownloadRule,
  FavoriteFolder,
  FavoriteRecord,
  SavedSearch,
  ScanRecord,
} from '../lib/types';

export class BulkframeDB extends Dexie {
  scans!: Table<ScanRecord, string>;
  favorites!: Table<FavoriteRecord, string>;
  folders!: Table<FavoriteFolder, string>;
  library!: Table<DownloadRecord, string>;
  rules!: Table<DownloadRule, string>;
  savedSearches!: Table<SavedSearch, string>;
  analytics!: Table<AnalyticsEvent, string>;

  constructor() {
    super('bulkframe');
    this.version(1).stores({
      scans: 'id, createdAt, domain, sourceType',
      favorites: 'id, createdAt, folderId, *tags',
      folders: 'id, name, createdAt',
      library: 'id, timestamp, status, type, filename, url',
      rules: 'id, order, enabled, matchType',
      savedSearches: 'id, createdAt, name',
      analytics: 'id, type, timestamp, domain',
    });
  }
}

export const db = new BulkframeDB();
