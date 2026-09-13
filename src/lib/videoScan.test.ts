import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickVideoFile } from './videoScan.ts';

test('prefers the video file over the poster image', () => {
  const result = pickVideoFile({
    currentSrc: 'https://cdn.example.com/clip.mp4',
    poster: 'https://cdn.example.com/clip.jpg',
  });
  assert.deepEqual(result, {
    url: 'https://cdn.example.com/clip.mp4',
    poster: 'https://cdn.example.com/clip.jpg',
  });
});

test('uses source tags when the video element has no src yet', () => {
  const result = pickVideoFile({
    sourceSrcs: ['https://cdn.example.com/clip.webm', 'https://cdn.example.com/clip.mp4'],
  });
  assert.equal(result?.url, 'https://cdn.example.com/clip.mp4');
});

test('ignores blob and HLS URLs and falls back to a RedGifs poster upgrade', () => {
  const result = pickVideoFile({
    currentSrc: 'blob:https://www.redgifs.com/abc',
    src: 'https://api.redgifs.com/v2/gifs/squeakyhelplesswisent/hd.m3u8',
    poster: 'https://media.redgifs.com/SqueakyHelplessWisent-poster.jpg',
  });
  assert.deepEqual(result, {
    url: 'https://media.redgifs.com/SqueakyHelplessWisent.mp4',
    poster: 'https://media.redgifs.com/SqueakyHelplessWisent-poster.jpg',
  });
});

test('returns null when there is only a non-RedGifs poster', () => {
  assert.equal(pickVideoFile({ poster: 'https://cdn.example.com/poster.jpg' }), null);
});
