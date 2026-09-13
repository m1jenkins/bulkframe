import { duplicateIds } from './hash.ts';
import { orientationOf, resolutionBucket } from './images.ts';
import type { FilterState, ImageCandidate, ImageType, MediaKind, MediaQuality, Orientation } from './types.ts';
import {
  DEFAULT_FILTERS,
  IMAGE_TYPES,
  KIND_LABELS,
  KIND_TYPES,
  MEDIA_KINDS,
  MEDIA_QUALITIES,
  QUALITY_LABELS,
  TYPE_LABELS,
  kindOf,
} from './types.ts';

export function emptyFilters(): FilterState {
  return {
    ...DEFAULT_FILTERS,
    orientations: [],
    types: [],
    quality: 'good',
    hideDuplicates: false,
  };
}

function optionalFinite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function normalizeFilters(input?: Partial<FilterState> | null): FilterState {
  const base = emptyFilters();
  if (!input || typeof input !== 'object') return base;
  const orientations = Array.isArray(input.orientations)
    ? input.orientations.filter((value): value is Orientation =>
        value === 'portrait' || value === 'landscape' || value === 'square',
      )
    : [];
  const types = Array.isArray(input.types)
    ? input.types.filter((value): value is ImageType => IMAGE_TYPES.includes(value))
    : [];
  const quality = MEDIA_QUALITIES.includes(input.quality as MediaQuality)
    ? (input.quality as MediaQuality)
    : base.quality;
  return {
    ...base,
    quality,
    orientations,
    types,
    hideDuplicates: Boolean(input.hideDuplicates),
    minWidth: optionalFinite(input.minWidth),
    minHeight: optionalFinite(input.minHeight),
    maxWidth: optionalFinite(input.maxWidth),
    maxHeight: optionalFinite(input.maxHeight),
    minBytes: optionalFinite(input.minBytes),
    maxBytes: optionalFinite(input.maxBytes),
    minEdge: optionalFinite(input.minEdge),
  };
}

export function applyScheduleFilters(
  images: ImageCandidate[],
  filters?: Partial<FilterState> | null,
): ImageCandidate[] {
  const next = normalizeFilters(filters);
  return applyFilters(images, next, duplicateIds(images));
}

export function summarizeFilters(filters: FilterState): string {
  const parts: string[] = [QUALITY_LABELS[filters.quality ?? 'good']];
  const kinds = MEDIA_KINDS.filter((kind) => isKindActive(filters.types, kind));
  if (kinds.length && kinds.length < MEDIA_KINDS.length) {
    parts.push(kinds.map((kind) => KIND_LABELS[kind]).join(', '));
  } else if (filters.types.length) {
    parts.push(filters.types.map((type) => TYPE_LABELS[type]).join(', '));
  }
  if (filters.hideDuplicates) parts.push('Hide dups');
  if (filters.minEdge) parts.push(`${filters.minEdge}px+`);
  if (filters.minBytes) parts.push(`${Math.round(filters.minBytes / 1024)} KB+`);
  if (filters.orientations.length) {
    parts.push(filters.orientations.map((value) => value[0]!.toUpperCase() + value.slice(1)).join('/'));
  }
  return parts.join(' · ');
}

export type QualityTier = 'low' | 'good' | 'high';

export function mediaQuality(image: ImageCandidate): QualityTier {
  if (image.type === 'svg') return 'low';

  const bucket = resolutionBucket(image.width, image.height);
  if (bucket === 'L' || bucket === 'XL') return 'high';
  if (bucket === 'M') return 'good';
  if (bucket === 'S') return 'low';

  const bytes = image.byteSize ?? 0;
  if (!bytes) return 'good';

  if (image.type === 'mp4' || image.type === 'webm') {
    if (bytes >= 5 * 1024 * 1024) return 'high';
    if (bytes >= 400 * 1024) return 'good';
    return 'low';
  }
  if (image.type === 'gif') {
    if (bytes >= 1.5 * 1024 * 1024) return 'high';
    if (bytes >= 150 * 1024) return 'good';
    return 'low';
  }
  if (bytes >= 800 * 1024) return 'high';
  if (bytes >= 80 * 1024) return 'good';
  return 'low';
}

export function matchesQuality(image: ImageCandidate, min: MediaQuality | undefined): boolean {
  if (!min || min === 'any') return true;
  const tier = mediaQuality(image);
  if (min === 'high') return tier === 'high';
  return tier === 'good' || tier === 'high';
}

export function matchesFilter(image: ImageCandidate, filters: FilterState): boolean {
  const { minWidth, minHeight, maxWidth, maxHeight, orientations, types, minBytes, maxBytes } =
    filters;
  if (!matchesQuality(image, filters.quality)) return false;
  if (filters.minEdge) {
    const w = image.width ?? 0;
    const h = image.height ?? 0;
    if (!w || !h || Math.min(w, h) < filters.minEdge) return false;
  }
  if (minWidth && (image.width ?? 0) < minWidth) return false;
  if (minHeight && (image.height ?? 0) < minHeight) return false;
  if (maxWidth && (image.width ?? Infinity) > maxWidth) return false;
  if (maxHeight && (image.height ?? Infinity) > maxHeight) return false;
  if (orientations.length) {
    const o = orientationOf(image.width, image.height);
    if (!o || !orientations.includes(o)) return false;
  }
  if (types.length && !types.includes(image.type)) return false;
  if (minBytes != null && (image.byteSize ?? 0) < minBytes) return false;
  if (maxBytes != null && (image.byteSize ?? Infinity) > maxBytes) return false;
  return true;
}

export function applyFilters(
  images: ImageCandidate[],
  filters: FilterState,
  duplicateIds?: Set<string>,
): ImageCandidate[] {
  return images.filter((img) => {
    if (!matchesFilter(img, filters)) return false;
    if (filters.hideDuplicates && duplicateIds?.has(img.id)) return false;
    return true;
  });
}

export function typeCounts(images: ImageCandidate[]): Record<ImageType, number> {
  const counts = Object.fromEntries(IMAGE_TYPES.map((type) => [type, 0])) as Record<ImageType, number>;
  for (const img of images) counts[img.type] += 1;
  return counts;
}

export function kindCounts(images: ImageCandidate[]): Record<MediaKind, number> {
  const counts = Object.fromEntries(MEDIA_KINDS.map((kind) => [kind, 0])) as Record<MediaKind, number>;
  for (const img of images) counts[kindOf(img.type)] += 1;
  return counts;
}

export function isKindActive(types: ImageType[], kind: MediaKind): boolean {
  if (!types.length) return false;
  return KIND_TYPES[kind].some((type) => types.includes(type));
}

export function toggleKind(types: ImageType[], kind: MediaKind): ImageType[] {
  const kindTypes = KIND_TYPES[kind];
  if (!types.length) return [...kindTypes];
  const selected = new Set(types);
  const on = kindTypes.every((type) => selected.has(type));
  if (on) kindTypes.forEach((type) => selected.delete(type));
  else kindTypes.forEach((type) => selected.add(type));
  const next = IMAGE_TYPES.filter((type) => selected.has(type));
  if (!next.length || next.length === IMAGE_TYPES.length) return [];
  return next;
}

export function totalBytes(images: ImageCandidate[]): number {
  return images.reduce((sum, img) => sum + (img.byteSize ?? 0), 0);
}

export function isDefaultFilters(filters: FilterState): boolean {
  return (
    (filters.quality ?? 'good') === 'good' &&
    filters.orientations.length === 0 &&
    filters.types.length === 0 &&
    !filters.hideDuplicates &&
    filters.minWidth == null &&
    filters.minHeight == null &&
    filters.maxWidth == null &&
    filters.maxHeight == null &&
    filters.minBytes == null &&
    filters.maxBytes == null &&
    filters.minEdge == null
  );
}

export type SortKey = 'pixels' | 'size' | 'width' | 'type';

export function sortImages(images: ImageCandidate[], key: SortKey, dir: 'desc' | 'asc' = 'desc') {
  const sign = dir === 'desc' ? -1 : 1;
  return [...images].sort((a, b) => {
    const av =
      key === 'pixels'
        ? (a.width ?? 0) * (a.height ?? 0)
        : key === 'size'
          ? (a.byteSize ?? 0)
          : key === 'width'
            ? (a.width ?? 0)
            : a.type;
    const bv =
      key === 'pixels'
        ? (b.width ?? 0) * (b.height ?? 0)
        : key === 'size'
          ? (b.byteSize ?? 0)
          : key === 'width'
            ? (b.width ?? 0)
            : b.type;
    if (av < bv) return -1 * sign;
    if (av > bv) return 1 * sign;
    return 0;
  });
}
