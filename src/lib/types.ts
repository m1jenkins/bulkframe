export type ImageType =
  | 'jpeg'
  | 'png'
  | 'gif'
  | 'bmp'
  | 'svg'
  | 'tiff'
  | 'webp'
  | 'other';

export type Orientation = 'portrait' | 'landscape' | 'square';

export type DownloadFormat = 'original' | 'jpg' | 'png';

export type Workflow = 'popup' | 'dashboard' | 'wand';

export type ConflictAction = 'uniquify' | 'overwrite' | 'prompt';

export type ThemeMode = 'system' | 'light' | 'dark';

export type VisualStyle = 'default' | 'graphite' | 'ocean' | 'ember' | 'jade';

export type ScanSource = 'page' | 'tabs' | 'links';

export const IMAGE_TYPES: ImageType[] = [
  'jpeg',
  'png',
  'gif',
  'bmp',
  'svg',
  'tiff',
  'webp',
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
  other: 'Other',
};

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
  hideDuplicates: boolean;
  similarGroup?: string;
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
};

export const DEFAULT_SETTINGS: Settings = {
  openInSidePanel: false,
  askWhereToSave: false,
  showTooltips: true,
  downloadFormat: 'original',
  skipTypes: [],
  skip1x1: true,
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
