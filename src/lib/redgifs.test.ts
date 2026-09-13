import assert from 'node:assert/strict';
import { test } from 'node:test';
import { upgradeRedgifsMediaUrl } from './redgifs.ts';

test('upgrades RedGifs poster JPEGs to the HD mp4', () => {
  const result = upgradeRedgifsMediaUrl('https://media.redgifs.com/SqueakyHelplessWisent-poster.jpg');
  assert.deepEqual(result, {
    url: 'https://media.redgifs.com/SqueakyHelplessWisent.mp4',
    poster: 'https://media.redgifs.com/SqueakyHelplessWisent-poster.jpg',
  });
});

test('upgrades RedGifs mobile thumbnails and SD clips to the HD mp4', () => {
  assert.equal(
    upgradeRedgifsMediaUrl('https://media.redgifs.com/SqueakyHelplessWisent-mobile.jpg')?.url,
    'https://media.redgifs.com/SqueakyHelplessWisent.mp4',
  );
  assert.equal(
    upgradeRedgifsMediaUrl('https://media.redgifs.com/SqueakyHelplessWisent-mobile.mp4')?.url,
    'https://media.redgifs.com/SqueakyHelplessWisent.mp4',
  );
});

test('keeps an HD RedGifs mp4 and attaches a poster for previews', () => {
  const result = upgradeRedgifsMediaUrl('https://media.redgifs.com/SqueakyHelplessWisent.mp4');
  assert.deepEqual(result, {
    url: 'https://media.redgifs.com/SqueakyHelplessWisent.mp4',
    poster: 'https://media.redgifs.com/SqueakyHelplessWisent-poster.jpg',
  });
});

test('does not invent an mp4 from a lowercase watch URL', () => {
  assert.equal(upgradeRedgifsMediaUrl('https://www.redgifs.com/watch/squeakyhelplesswisent'), null);
});

test('does not treat unrelated images as RedGifs clips', () => {
  assert.equal(upgradeRedgifsMediaUrl('https://cdn.example.com/SqueakyHelplessWisent-poster.jpg'), null);
  assert.equal(upgradeRedgifsMediaUrl('https://media.redgifs.com/logo.png'), null);
});
