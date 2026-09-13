import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  advanceDeepLoad,
  initialDeepLoadState,
  type DeepLoadSnapshot,
} from './pageLoad.ts';

function snap(partial: Partial<DeepLoadSnapshot> = {}): DeepLoadSnapshot {
  return { scrollHeight: 2000, uniqueImages: 12, mediaCount: 12, ...partial };
}

test('keeps scrolling while unique images grow even if page height is flat', () => {
  let state = initialDeepLoadState();
  const startedAt = 0;
  const opts = { minRounds: 2, idleLimit: 3, maxMs: 30_000, maxRounds: 20, heightSlack: 80 };

  ({ next: state } = advanceDeepLoad(state, snap({ uniqueImages: 8, scrollHeight: 4000 }), 100, startedAt, opts));
  const second = advanceDeepLoad(state, snap({ uniqueImages: 20, scrollHeight: 4000 }), 200, startedAt, opts);
  assert.equal(second.stop, false);
  assert.equal(second.next.idleRounds, 0);
});

test('does not stop before the minimum number of scroll rounds', () => {
  let state = initialDeepLoadState();
  const startedAt = 0;
  const opts = { minRounds: 4, idleLimit: 1, maxMs: 30_000, maxRounds: 20 };
  const frozen = snap({ uniqueImages: 3, scrollHeight: 800, mediaCount: 3 });
  for (let i = 0; i < 3; i++) {
    const step = advanceDeepLoad(state, frozen, i * 100, startedAt, opts);
    assert.equal(step.stop, false, `round ${i + 1} should continue`);
    state = step.next;
  }
});

test('stops once the feed is idle after the minimum rounds', () => {
  let state = initialDeepLoadState();
  const startedAt = 0;
  const opts = { minRounds: 2, idleLimit: 2, maxMs: 30_000, maxRounds: 20 };
  const frozen = snap();
  let last = advanceDeepLoad(state, frozen, 100, startedAt, opts);
  last = advanceDeepLoad(last.next, frozen, 200, startedAt, opts);
  last = advanceDeepLoad(last.next, frozen, 300, startedAt, opts);
  assert.equal(last.stop, true);
});

test('stops when the time budget is exhausted', () => {
  const first = advanceDeepLoad(
    initialDeepLoadState(),
    snap({ uniqueImages: 40 }),
    40_000,
    0,
    { maxMs: 30_000, minRounds: 8, maxRounds: 70 },
  );
  assert.equal(first.stop, true);
});

test('stops when the round cap is hit', () => {
  const prev = { lastHeight: 1000, lastUnique: 10, lastMedia: 10, idleRounds: 0, rounds: 4 };
  const result = advanceDeepLoad(prev, snap({ uniqueImages: 11, scrollHeight: 2000 }), 1000, 0, {
    maxRounds: 5,
    minRounds: 2,
    maxMs: 30_000,
  });
  assert.equal(result.stop, true);
  assert.equal(result.next.rounds, 5);
});
