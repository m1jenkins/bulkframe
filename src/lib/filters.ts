import { orientationOf } from './images';
import type { FilterState, ImageCandidate, ImageType } from './types';
import { DEFAULT_FILTERS } from './types';

export function emptyFilters(): FilterState {
  return { ...DEFAULT_FILTERS, orientations: [], types: [] };
}

export function matchesFilter(image: ImageCandidate, filters: FilterState): boolean {
  const { minWidth, minHeight, maxWidth, maxHeight, orientations, types, minBytes, maxBytes } =
    filters;
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
  const counts = {
    jpeg: 0,
    png: 0,
    gif: 0,
    bmp: 0,
    svg: 0,
    tiff: 0,
    webp: 0,
    other: 0,
  };
  for (const img of images) counts[img.type] += 1;
  return counts;
}

export function totalBytes(images: ImageCandidate[]): number {
  return images.reduce((sum, img) => sum + (img.byteSize ?? 0), 0);
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
