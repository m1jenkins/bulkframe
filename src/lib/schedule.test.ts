import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  alarmName,
  expandScheduleFolder,
  localOccurrenceOnDay,
  normalizeTime,
  nextLocalOccurrence,
  parseTime,
  sanitizeFolder,
  scheduleIdFromAlarm,
  shouldRunMissed,
} from './scheduleLogic.ts';

test('normalizes clock times and rejects invalid values', () => {
  assert.deepEqual(parseTime('9:05'), { hours: 9, minutes: 5 });
  assert.equal(normalizeTime('9:05'), '09:05');
  assert.equal(normalizeTime('21:00:00'), '21:00');
  assert.equal(normalizeTime('24:00'), null);
  assert.equal(normalizeTime('noon'), null);
});

test('next occurrence stays on the same local day when the time is still ahead', () => {
  const from = new Date(2026, 8, 13, 8, 0, 0).getTime();
  const next = nextLocalOccurrence('09:30', from);
  assert.equal(next, new Date(2026, 8, 13, 9, 30, 0).getTime());
});

test('next occurrence rolls to the following day after the scheduled time', () => {
  const from = new Date(2026, 8, 13, 21, 0, 0).getTime();
  const next = nextLocalOccurrence('09:30', from);
  assert.equal(next, new Date(2026, 8, 14, 9, 30, 0).getTime());
});

test('missed-run catch-up fires once after the local scheduled time', () => {
  const now = new Date(2026, 8, 13, 10, 0, 0).getTime();
  const todayAt = localOccurrenceOnDay('09:00', new Date(now));
  const createdBefore = todayAt - 60_000;
  assert.equal(shouldRunMissed({ enabled: true, time: '09:00', createdAt: createdBefore }, now), true);
  assert.equal(shouldRunMissed({ enabled: true, time: '09:00', createdAt: createdBefore, armedAt: todayAt + 60_000 }, now), false);
  assert.equal(
    shouldRunMissed({ enabled: true, time: '09:00', createdAt: createdBefore, lastAttemptAt: todayAt - 1 }, now),
    true,
  );
  assert.equal(
    shouldRunMissed({ enabled: true, time: '09:00', createdAt: createdBefore, lastAttemptAt: todayAt }, now),
    false,
  );
  assert.equal(shouldRunMissed({ enabled: true, time: '21:00', createdAt: createdBefore }, now), false);
  assert.equal(shouldRunMissed({ enabled: false, time: '09:00', createdAt: createdBefore }, now), false);
  assert.equal(shouldRunMissed({ enabled: true, time: '09:00', createdAt: todayAt + 60_000 }, now), false);
});

test('folder paths stay under Downloads and expand date/domain tokens', () => {
  assert.equal(sanitizeFolder('\\Foo\\../bar\\'), 'Foo/bar');
  const at = new Date(2026, 8, 13, 15, 0, 0);
  assert.equal(
    expandScheduleFolder('Bulkframe/{domain}/{date}', 'https://www.example.com/gallery', at),
    'Bulkframe/example.com/2026-09-13',
  );
});

test('absolute schedule folders keep their real disk path', () => {
  const at = new Date(2026, 8, 13, 15, 0, 0);
  assert.equal(
    expandScheduleFolder('/Users/user/PeekIngest/drop', 'https://example.com/gallery', at),
    '/Users/user/PeekIngest/drop',
  );
  assert.equal(
    expandScheduleFolder('Users/user/PeekIngest/drop', 'https://example.com/gallery', at),
    '/Users/user/PeekIngest/drop',
  );
});

test('alarm names round-trip schedule ids', () => {
  const name = alarmName('sched_abc');
  assert.equal(name, 'bf-sched:sched_abc');
  assert.equal(scheduleIdFromAlarm(name), 'sched_abc');
  assert.equal(scheduleIdFromAlarm('other'), null);
});
