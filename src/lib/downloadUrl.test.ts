import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blobToDataUrl, downloadStrategy, isDirectlyDownloadable } from './downloadUrl.ts';

test('http(s) and data URLs can be passed straight to chrome.downloads', () => {
  assert.equal(isDirectlyDownloadable('https://cdn.example.com/a.jpg'), true);
  assert.equal(isDirectlyDownloadable('http://example.com/a.png'), true);
  assert.equal(isDirectlyDownloadable('data:image/png;base64,aaa'), true);
  assert.equal(isDirectlyDownloadable('blob:https://example.com/123'), false);
});

test('original-format web images download from the source URL, not a SW blob URL', () => {
  assert.equal(downloadStrategy('https://cdn.example.com/hero.jpg', 'original'), 'direct');
  assert.equal(downloadStrategy('http://example.com/hero.jpg', 'original'), 'direct');
  assert.equal(downloadStrategy('data:image/png;base64,aaa', 'original'), 'direct');
});

test('converted downloads still need a blob', () => {
  assert.equal(downloadStrategy('https://cdn.example.com/hero.jpg', 'jpg'), 'blob');
  assert.equal(downloadStrategy('https://cdn.example.com/hero.jpg', 'png'), 'blob');
});

test('page blob URLs cannot be fetched by the extension download manager', () => {
  assert.equal(downloadStrategy('blob:https://example.com/abc', 'original'), 'blob');
});

test('blobToDataUrl produces a data URL chrome.downloads can fetch', async () => {
  const blob = new Blob(['hello'], { type: 'text/plain' });
  const url = await blobToDataUrl(blob);
  assert.match(url, /^data:text\/plain;base64,/);
  const base64 = url.split(',')[1] ?? '';
  assert.equal(Buffer.from(base64, 'base64').toString(), 'hello');
});
