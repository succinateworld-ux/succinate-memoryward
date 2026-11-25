/**
 * roomState.test.js
 * Node --test tests for src/js/roomState.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRoomState, trailingStreak } from '../js/roomState.js';

function a(value, timestamp = 0) { return { value, timestamp }; }

// ─── Unit tests ───────────────────────────────────────────────────────────────

test('empty array → dim', () => {
  assert.equal(computeRoomState([]), 'dim');
});

test('null/undefined → dim (graceful)', () => {
  assert.equal(computeRoomState(null), 'dim');
  assert.equal(computeRoomState(undefined), 'dim');
});

test('[Remembered] → lit', () => {
  assert.equal(computeRoomState([a('Remembered')]), 'lit');
});

test('[Remembered, Remembered] → lit', () => {
  assert.equal(computeRoomState([a('Remembered'), a('Remembered')]), 'lit');
});

test('[Remembered × 3] → bright', () => {
  assert.equal(
    computeRoomState([a('Remembered'), a('Remembered'), a('Remembered')]),
    'bright'
  );
});

test('[Remembered × 5] → bright', () => {
  const arr = Array.from({ length: 5 }, () => a('Remembered'));
  assert.equal(computeRoomState(arr), 'bright');
});

test('[Again] → dim', () => {
  assert.equal(computeRoomState([a('Again')]), 'dim');
});

test('[Hard] → dim', () => {
  assert.equal(computeRoomState([a('Hard')]), 'dim');
});

test('[Remembered × 3, Again] → dim (streak reset)', () => {
  assert.equal(
    computeRoomState([
      a('Remembered'), a('Remembered'), a('Remembered'), a('Again')
    ]),
    'dim'
  );
});

test('[Remembered × 3, Hard] → dim (streak reset by Hard)', () => {
  assert.equal(
    computeRoomState([
      a('Remembered'), a('Remembered'), a('Remembered'), a('Hard')
    ]),
    'dim'
  );
});

test('[Remembered, Hard, Remembered, Remembered] → lit', () => {
  assert.equal(
    computeRoomState([
      a('Remembered'), a('Hard'), a('Remembered'), a('Remembered')
    ]),
    'lit'
  );
});

test('[Again, Remembered, Remembered, Remembered] → bright', () => {
  assert.equal(
    computeRoomState([
      a('Again'), a('Remembered'), a('Remembered'), a('Remembered')
    ]),
    'bright'
  );
});

// ─── trailingStreak unit tests ────────────────────────────────────────────────

test('trailingStreak: empty → 0', () => {
  assert.equal(trailingStreak([]), 0);
});
test('trailingStreak: [Remembered × 3] → 3', () => {
  assert.equal(
    trailingStreak([a('Remembered'), a('Remembered'), a('Remembered')]),
    3
  );
});
test('trailingStreak: [Remembered, Again, Remembered] → 1', () => {
  assert.equal(
    trailingStreak([a('Remembered'), a('Again'), a('Remembered')]),
    1
  );
});

// ─── Property test: streak computation ───────────────────────────────────────

function prng(seed) {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 0xFFFFFFFF; };
}

const VALUES = ['Again', 'Hard', 'Remembered'];

test('Property 6: RoomState trailing streak matches independent count (1000 runs)', () => {
  const rand = prng(0xBADF00D);
  for (let run = 0; run < 1000; run++) {
    const len = Math.floor(rand() * 12);
    const assessments = Array.from({ length: len },
      () => a(VALUES[Math.floor(rand() * 3)]));

    // Independent reference implementation
    let refStreak = 0;
    for (let i = assessments.length - 1; i >= 0; i--) {
      if (assessments[i].value === 'Remembered') refStreak++;
      else break;
    }

    const actual = computeRoomState(assessments);

    if (refStreak === 0)       assert.equal(actual, 'dim',    `run ${run}`);
    else if (refStreak <= 2)   assert.equal(actual, 'lit',    `run ${run}`);
    else                       assert.equal(actual, 'bright', `run ${run}`);
  }
});
