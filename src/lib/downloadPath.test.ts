import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  coerceFolder,
  conflictName,
  destFolderLabel,
  downloadRoute,
  folderHandleKey,
  isAbsoluteFolder,
  joinDownloadPath,
  relativeFolder,
  sanitizeFolder,
  uniquifyFilename,
} from './downloadPath.ts';

test('keeps absolute unix destinations instead of nesting them under Downloads', () => {
  assert.equal(sanitizeFolder('/Users/user/PeekIngest/drop'), '/Users/user/PeekIngest/drop');
  assert.equal(isAbsoluteFolder('/Users/user/PeekIngest/drop'), true);
  assert.deepEqual(downloadRoute('/Users/user/PeekIngest/drop'), {
    kind: 'filesystem',
    folder: '/Users/user/PeekIngest/drop',
  });
});

test('restores a leading slash when an absolute home path was stripped', () => {
  assert.equal(coerceFolder('Users/user/PeekIngest/drop'), '/Users/user/PeekIngest/drop');
  assert.deepEqual(downloadRoute('Users/user/PeekIngest/drop'), {
    kind: 'filesystem',
    folder: '/Users/user/PeekIngest/drop',
  });
});

test('relative destinations still stay under Downloads', () => {
  assert.equal(sanitizeFolder('\\Foo\\../bar\\'), 'Foo/bar');
  assert.equal(coerceFolder('Bulkframe/{domain}'), 'Bulkframe/{domain}');
  assert.deepEqual(downloadRoute('Bulkframe/example.com'), {
    kind: 'browser',
    folder: 'Bulkframe/example.com',
  });
  assert.equal(destFolderLabel('Bulkframe/example.com'), 'Downloads/Bulkframe/example.com');
  assert.equal(destFolderLabel('/Users/user/PeekIngest/drop'), '/Users/user/PeekIngest/drop');
});

test('file URLs and Windows drive paths stay absolute', () => {
  assert.equal(sanitizeFolder('file:///Users/user/PeekIngest/drop'), '/Users/user/PeekIngest/drop');
  assert.equal(sanitizeFolder('C:\\Users\\user\\PeekIngest\\drop'), 'C:/Users/user/PeekIngest/drop');
  assert.equal(isAbsoluteFolder('C:/Users/user/PeekIngest/drop'), true);
});

test('handle keys ignore date and domain tokens so one grant covers nested days', () => {
  assert.equal(folderHandleKey('/Users/user/PeekIngest/drop/{date}'), '/Users/user/PeekIngest/drop');
  assert.equal(relativeFolder('/Users/user/PeekIngest/drop', '/Users/user/PeekIngest/drop/2026-09-13'), '2026-09-13');
  assert.equal(relativeFolder('/Users/user/PeekIngest/drop', '/Users/user/PeekIngest/drop'), '');
});

test('joinDownloadPath keeps the absolute folder on the saved filename', () => {
  assert.equal(
    joinDownloadPath('/Users/user/PeekIngest/drop', 'hero.jpg'),
    '/Users/user/PeekIngest/drop/hero.jpg',
  );
  assert.equal(joinDownloadPath('Bulkframe', 'hero.jpg'), 'Bulkframe/hero.jpg');
});

test('uniquify skips names that are already present unless overwrite is requested', () => {
  assert.equal(uniquifyFilename('hero.jpg', ['hero.jpg', 'hero (1).jpg']), 'hero (2).jpg');
  assert.equal(conflictName('overwrite', 'hero.jpg', ['hero.jpg']), 'hero.jpg');
});
