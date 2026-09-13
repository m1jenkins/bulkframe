import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inferType, previewUrl, typeToExt } from './images.ts';

test('classifies mp4 and webm URLs as video types', () => {
  assert.equal(inferType('https://media.redgifs.com/SqueakyHelplessWisent.mp4'), 'mp4');
  assert.equal(inferType('https://cdn.example.com/clip.webm'), 'webm');
  assert.equal(inferType('https://cdn.example.com/clip.mp4', 'video/mp4'), 'mp4');
});

test('keeps the mp4 extension even when the download format is jpg', () => {
  assert.equal(typeToExt('mp4', 'jpg'), 'mp4');
  assert.equal(typeToExt('webm', 'png'), 'webm');
});

test('previewUrl uses a poster for videos so tiles are not blank', () => {
  assert.equal(
    previewUrl({
      url: 'https://media.redgifs.com/SqueakyHelplessWisent.mp4',
      poster: 'https://media.redgifs.com/SqueakyHelplessWisent-poster.jpg',
      type: 'mp4',
    }),
    'https://media.redgifs.com/SqueakyHelplessWisent-poster.jpg',
  );
});
