export type ImageType =
  | 'jpeg'
  | 'png'
  | 'gif'
  | 'bmp'
  | 'svg'
  | 'tiff'
  | 'webp'
  | 'mp4'
  | 'webm'
  | 'other';

export type Orientation = 'portrait' | 'landscape' | 'square';

export type MediaQuality = 'any' | 'good' | 'high';

export type MediaKind = 'photo' | 'gif' | 'video' | 'other';

export type DownloadFormat = 'original' | 'jpg' | 'png';

export type Workflow = 'popup' | 'dashboard' | 'wand' | 'schedule';

export type ConflictAction = 'uniquify' | 'overwrite' | 'prompt';

export type ThemeMode = 'system' | 'light' | 'dark';

export type VisualStyle = 'default' | 'graphite' | 'ocean' | 'ember' | 'jade';

export type ScanSource = 'page' | 'tabs' | 'links' | 'schedule';

export const WORKFLOWS: Workflow[] = ['popup', 'dashboard', 'wand', 'schedule'];

export const IMAGE_TYPES: ImageType[] = [
  'jpeg',
  'png',
  'gif',
  'bmp',
  'svg',
  'tiff',
  'webp',
  'mp4',
  'webm',
  'other',
];

export const TYPE_LABELS: Record<ImageType, string> = {
  jpeg: 'JPEG',
  png: 'PNG',
  gif: 'GIF',
  bmp: 'BMP',
  svg: 'SVG',
  tiff: 'TIFF',
  webp: 'WebP',
  mp4: 'MP4',
  webm: 'WebM',
  other: 'Other',
};

export const MEDIA_QUALITIES: MediaQuality[] = ['any', 'good', 'high'];

export const QUALITY_LABELS: Record<MediaQuality, string> = {
  any: 'Any',
  good: 'Hide low',
  high: 'High only',
};

export const MEDIA_KINDS: MediaKind[] = ['photo', 'gif', 'video', 'other'];

export const KIND_LABELS: Record<MediaKind, string> = {
  photo: 'Photos',
  gif: 'GIFs',
  video: 'Videos',
  other: 'Other',
};

export const KIND_TYPES: Record<MediaKind, ImageType[]> = {
  photo: ['jpeg', 'png', 'webp', 'bmp', 'tiff'],
  gif: ['gif'],
  video: ['mp4', 'webm'],
  other: ['svg', 'other'],
};

export function kindOf(type: ImageType): MediaKind {
  if (type === 'gif') return 'gif';
  if (type === 'mp4' || type === 'webm') return 'video';
  if (type === 'svg' || type === 'other') return 'other';
  return 'photo';
}

export interface ImageCandidate {
  id: string;
  url: string;
  pageUrl: string;
  width?: number;
  height?: number;
  byteSize?: number;
  mime?: string;
  type: ImageType;
  filename: string;
  alt?: string;
  poster?: string;
  source: 'img' | 'srcset' | 'background' | 'video' | 'canvas' | 'meta' | 'svg';
  hash?: string;
  fetchError?: string;
}

export interface ScanRecord {
  id: string;
  createdAt: number;
  sourceType: ScanSource;
  title: string;
  domain: string;
  urls: string[];
  images: ImageCandidate[];
}

export interface FavoriteFolder {
  id: string;
  name: string;
  createdAt: number;
}

export interface FavoriteRecord {
  id: string;
  image: ImageCandidate;
  folderId?: string;
  tags: string[];
  createdAt: number;
}

export interface DownloadRecord {
  id: string;
  url: string;
  pageUrl?: string;
  filename: string;
  folder?: string;
  byteSize?: number;
  width?: number;
  height?: number;
  type: ImageType;
  format: DownloadFormat;
  status: 'complete' | 'failed';
  error?: string;
  timestamp: number;
  workflow: Workflow;
  chromeDownloadId?: number;
}

export interface DownloadRule {
  id: string;
  name: string;
  matchType: 'extension' | 'domain' | 'minSize' | 'orientation';
  value: string;
  destFolder: string;
  conflict: ConflictAction;
  enabled: boolean;
  order: number;
}

export interface FilterState {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  orientations: Orientation[];
  types: ImageType[];
  minBytes?: number;
  maxBytes?: number;
  minEdge?: number;
  hideDuplicates: boolean;
  quality: MediaQuality;
  similarGroup?: string;
}

export interface ScheduledScan {
  id: string;
  createdAt: number;
  url: string;
  time: string;
  destFolder: string;
  download: boolean;
  enabled: boolean;
  name: string;
  armedAt: number;
  filters: FilterState;
  lastRunAt?: number;
  lastAttemptAt?: number;
  lastError?: string;
  lastScanId?: string;
  lastCount?: number;
  lastDownloaded?: number;
}

export interface SavedSearch {
  id: string;
  name: string;
  createdAt: number;
  filters: FilterState;
  scanId?: string;
}

export interface Settings {
  openInSidePanel: boolean;
  askWhereToSave: boolean;
  showTooltips: boolean;
  downloadFormat: DownloadFormat;
  skipTypes: ImageType[];
  skip1x1: boolean;
  skipRedditAvatars: boolean;
  theme: ThemeMode;
  style: VisualStyle;
  renameEnabled: boolean;
  renamePattern: string;
  renameSeparator: string;
  conflict: ConflictAction;
}

export interface AnalyticsEvent {
  id: string;
  type: 'scan' | 'download';
  timestamp: number;
  domain?: string;
  count?: number;
  byteSize?: number;
  imageType?: ImageType;
  width?: number;
  height?: number;
  workflow?: Workflow;
}

export const DEFAULT_FILTERS: FilterState = {
  orientations: [],
  types: [],
  hideDuplicates: false,
  quality: 'good',
};

export const DEFAULT_SETTINGS: Settings = {
  openInSidePanel: false,
  askWhereToSave: false,
  showTooltips: true,
  downloadFormat: 'original',
  skipTypes: [],
  skip1x1: true,
  skipRedditAvatars: true,
  theme: 'system',
  style: 'default',
  renameEnabled: false,
  renamePattern: '{filename}',
  renameSeparator: '-',
  conflict: 'uniquify',
};

export type DateRangeKey =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'wtd'
  | 'mtd'
  | 'last12'
  | 'ytd'
  | 'all'
  | 'custom';

export interface DateRange {
  key: DateRangeKey;
  from?: number;
  to?: number;
}
