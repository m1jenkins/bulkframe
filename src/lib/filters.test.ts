import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyFilters,
  emptyFilters,
  isKindActive,
  matchesFilter,
  mediaQuality,
  toggleKind,
} from './filters.ts';
import type { FilterState, ImageCandidate } from './types.ts';

function cand(partial: Partial<ImageCandidate> = {}): ImageCandidate {
  return {
    id: partial.id ?? 'i',
    url: 'https://example.com/a.jpg',
    pageUrl: 'https://example.com',
    type: 'jpeg',
    filename: 'a.jpg',
    source: 'img',
    ...partial,
  };
}

test('classifies photos from resolution buckets', () => {
  assert.equal(mediaQuality(cand({ width: 64, height: 64 })), 'low');
  assert.equal(mediaQuality(cand({ width: 800, height: 600 })), 'good');
  assert.equal(mediaQuality(cand({ width: 1920, height: 1080 })), 'high');
});

test('treats SVGs as low-quality icons', () => {
  assert.equal(mediaQuality(cand({ type: 'svg', width: 1024, height: 1024 })), 'low');
});

test('classifies gifs and videos from pixels or file size', () => {
  assert.equal(mediaQuality(cand({ type: 'gif', width: 200, height: 200 })), 'low');
  assert.equal(mediaQuality(cand({ type: 'gif', width: 640, height: 640 })), 'good');
  assert.equal(mediaQuality(cand({ type: 'mp4', width: 320, height: 180 })), 'low');
  assert.equal(mediaQuality(cand({ type: 'mp4', width: 1280, height: 720 })), 'good');
  assert.equal(mediaQuality(cand({ type: 'webm', width: 1920, height: 1080 })), 'high');
  assert.equal(mediaQuality(cand({ type: 'gif', byteSize: 200 * 1024 })), 'good');
  assert.equal(mediaQuality(cand({ type: 'mp4', byteSize: 6 * 1024 * 1024 })), 'high');
});

test('keeps files with no size data when dimensions are unknown', () => {
  assert.equal(mediaQuality(cand()), 'good');
  assert.equal(mediaQuality(cand({ byteSize: 10 * 1024 })), 'low');
  assert.equal(mediaQuality(cand({ byteSize: 900 * 1024 })), 'high');
});

test('Hide low is the default and drops tiny thumbs', () => {
  const tiny = cand({ id: 'tiny', width: 64, height: 64 });
  const photo = cand({ id: 'photo', width: 1200, height: 800 });
  const visible = applyFilters([tiny, photo], emptyFilters());
  assert.deepEqual(
    visible.map((img) => img.id),
    ['photo'],
  );
});

test('Any quality keeps low-resolution media', () => {
  const tiny = cand({ width: 64, height: 64 });
  const filters: FilterState = { ...emptyFilters(), quality: 'any' };
  assert.equal(matchesFilter(tiny, filters), true);
});

test('High only keeps HD-ish files', () => {
  const good = cand({ width: 800, height: 600 });
  const high = cand({ width: 1920, height: 1080 });
  const filters: FilterState = { ...emptyFilters(), quality: 'high' };
  assert.equal(matchesFilter(good, filters), false);
  assert.equal(matchesFilter(high, filters), true);
});

test('minEdge uses the shorter side so wide banners can still fail', () => {
  const banner = cand({ width: 1920, height: 400 });
  const photo = cand({ width: 1920, height: 1080 });
  const filters: FilterState = { ...emptyFilters(), quality: 'any', minEdge: 640 };
  assert.equal(matchesFilter(banner, filters), false);
  assert.equal(matchesFilter(photo, filters), true);
});

test('kind chips isolate then combine media types', () => {
  assert.deepEqual(toggleKind([], 'photo'), ['jpeg', 'png', 'webp', 'bmp', 'tiff']);
  const photosAndGifs = toggleKind(toggleKind([], 'photo'), 'gif');
  assert.ok(photosAndGifs.includes('gif'));
  assert.ok(photosAndGifs.includes('jpeg'));
  assert.equal(isKindActive([], 'photo'), false);
  assert.equal(isKindActive(photosAndGifs, 'photo'), true);
  assert.equal(isKindActive(photosAndGifs, 'video'), false);
});
