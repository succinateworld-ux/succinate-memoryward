/**
 * scheduler.test.js
 * Node --test tests for src/js/scheduler.js
 * No external dependencies.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schedule, INTERVALS_MS, MAX_TIMESTAMP } from '../js/scheduler.js';

const NOW = 1_700_000_000_000; // fixed seed

function card(overrides = {}) {
  return {
    id: 'c1', question: 'Q', answer: 'A',
    createdAt: NOW, dueAt: NOW, streak: 0, assessments: [],
    ...overrides,
  };
}

// ─── Immutability ─────────────────────────────────────────────────────────────

test('schedule returns a new object (immutable)', () => {
  const c = card();
  const result = schedule(c, 'Again', NOW);
  assert.notStrictEqual(result, c);
  assert.equal(c.dueAt, NOW);       // original untouched
  assert.equal(c.streak, 0);
});

// ─── Again ────────────────────────────────────────────────────────────────────

test('Again: dueAt = nowMs + 10 min, streak = 0', () => {
  const result = schedule(card(), 'Again', NOW);
  assert.equal(result.dueAt, NOW + 600_000);
  assert.equal(result.streak, 0);
});

test('Again: streak resets from non-zero', () => {
  const result = schedule(card({ streak: 5 }), 'Again', NOW);
  assert.equal(result.streak, 0);
});

// ─── Hard ─────────────────────────────────────────────────────────────────────

test('Hard: dueAt = nowMs + 1 day, streak = 0', () => {
  const result = schedule(card(), 'Hard', NOW);
  assert.equal(result.dueAt, NOW + 86_400_000);
  assert.equal(result.streak, 0);
});

test('Hard: streak resets from non-zero', () => {
  const result = schedule(card({ streak: 3 }), 'Hard', NOW);
  assert.equal(result.streak, 0);
});

// ─── Remembered progression ───────────────────────────────────────────────────

const EXPECTED_INTERVALS = [
  86_400_000,         // streak 0 → 1 day
  3  * 86_400_000,    // streak 1 → 3 days
  7  * 86_400_000,    // streak 2 → 7 days
  14 * 86_400_000,    // streak 3 → 14 days
  30 * 86_400_000,    // streak 4 → 30 days (cap)
];

for (let s = 0; s <= 4; s++) {
  test(`Remembered streak ${s}: dueAt = nowMs + ${EXPECTED_INTERVALS[s] / 86_400_000} days`, () => {
    const result = schedule(card({ streak: s }), 'Remembered', NOW);
    assert.equal(result.dueAt, NOW + EXPECTED_INTERVALS[s]);
    assert.equal(result.streak, s + 1);
  });
}

test('Remembered streak 4: capped at 30 days (streak >= 4 uses same interval)', () => {
  for (const s of [4, 5, 10, 100]) {
    const result = schedule(card({ streak: s }), 'Remembered', NOW);
    assert.equal(result.dueAt, NOW + 30 * 86_400_000, `streak=${s}`);
    assert.equal(result.streak, s + 1, `streak=${s}`);
  }
});

// ─── Multi-step sequence ──────────────────────────────────────────────────────

test('Again → Hard → Remembered × 3 produces correct sequence', () => {
  let c = card();
  c = schedule(c, 'Again',      NOW);
  assert.equal(c.streak, 0);
  assert.equal(c.dueAt, NOW + 600_000);

  c = schedule(c, 'Hard',       NOW + 600_000);
  assert.equal(c.streak, 0);
  assert.equal(c.dueAt, NOW + 600_000 + 86_400_000);

  c = schedule(c, 'Remembered', NOW + 86_400_000);
  assert.equal(c.streak, 1);
  assert.equal(c.dueAt, NOW + 86_400_000 + 86_400_000);

  c = schedule(c, 'Remembered', NOW + 2 * 86_400_000);
  assert.equal(c.streak, 2);
  assert.equal(c.dueAt, NOW + 2 * 86_400_000 + 3 * 86_400_000);

  c = schedule(c, 'Remembered', NOW + 5 * 86_400_000);
  assert.equal(c.streak, 3);
  assert.equal(c.dueAt, NOW + 5 * 86_400_000 + 7 * 86_400_000);
});

// ─── Determinism ─────────────────────────────────────────────────────────────

test('identical inputs produce identical output (determinism)', () => {
  const c = card({ streak: 2 });
  const r1 = schedule(c, 'Remembered', NOW);
  const r2 = schedule(c, 'Remembered', NOW);
  assert.deepEqual(r1, r2);
});

// ─── Validation guards ────────────────────────────────────────────────────────

test('negative nowMs throws RangeError', () => {
  assert.throws(() => schedule(card(), 'Again', -1), RangeError);
});

test('non-integer nowMs throws RangeError', () => {
  assert.throws(() => schedule(card(), 'Again', 1.5), RangeError);
});

test('nowMs > Number.MAX_SAFE_INTEGER throws RangeError', () => {
  assert.throws(() => schedule(card(), 'Again', Number.MAX_SAFE_INTEGER + 1), RangeError);
});

test('unknown assessment value throws TypeError', () => {
  assert.throws(() => schedule(card(), 'Good', NOW), TypeError);
});

test('null card throws TypeError', () => {
  assert.throws(() => schedule(null, 'Again', NOW), TypeError);
});

// ─── Property tests (generated sequences) ─────────────────────────────────────

// Seeded PRNG (xorshift32) so tests are reproducible
function prng(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

const VALUES = ['Again', 'Hard', 'Remembered'];

test('Property 1: dueAt > createdAt after any sequence (1000 runs)', () => {
  const rand = prng(0xDEADBEEF);
  for (let run = 0; run < 1000; run++) {
    let c = card({ createdAt: Math.floor(rand() * 1e12) });
    let nowMs = c.createdAt;
    const steps = 1 + Math.floor(rand() * 8);
    for (let i = 0; i < steps; i++) {
      const v = VALUES[Math.floor(rand() * 3)];
      c = schedule(c, v, nowMs);
      nowMs = c.dueAt; // advance clock
    }
    assert.ok(c.dueAt > c.createdAt,
      `run ${run}: dueAt ${c.dueAt} should be > createdAt ${c.createdAt}`);
  }
});

test('Property 2: Scheduler determinism (500 paired runs)', () => {
  const rand = prng(0xC0FFEE);
  for (let run = 0; run < 500; run++) {
    const startMs = Math.floor(rand() * 1e12);
    const steps = 1 + Math.floor(rand() * 6);
    const seq = Array.from({ length: steps },
      () => VALUES[Math.floor(rand() * 3)]);

    let c1 = card({createdAt:startMs,dueAt:startMs}), c2 = card({createdAt:startMs,dueAt:startMs});
    let now = startMs;
    for (const v of seq) {
      c1 = schedule(c1, v, now);
      c2 = schedule(c2, v, now);
      now += 86_400_000;
    }
    assert.equal(c1.dueAt, c2.dueAt, `run ${run}: dueAt mismatch`);
    assert.equal(c1.streak, c2.streak, `run ${run}: streak mismatch`);
  }
});

test('Property 3: Again always sets dueAt = nowMs + 600_000 (500 runs)', () => {
  const rand = prng(0xABCD1234);
  for (let run = 0; run < 500; run++) {
    const nowMs = Math.floor(rand() * (MAX_TIMESTAMP - 2_592_000_001));
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) continue;
    const result = schedule(card({ createdAt:0, dueAt:0, streak: Math.floor(rand() * 10) }), 'Again', nowMs);
    assert.equal(result.dueAt, nowMs + 600_000, `run ${run}`);
  }
});

test('Property 4: Hard always sets dueAt = nowMs + 86400000 (500 runs)', () => {
  const rand = prng(0xFEEDBAC);
  for (let run = 0; run < 500; run++) {
    const nowMs = Math.floor(rand() * (MAX_TIMESTAMP - 2_592_000_001));
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) continue;
    const result = schedule(card({ createdAt:0, dueAt:0, streak: Math.floor(rand() * 10) }), 'Hard', nowMs);
    assert.equal(result.dueAt, nowMs + 86_400_000, `run ${run}`);
  }
});

test('Property 5: Remembered dueAt = nowMs + INTERVALS_MS[min(streak,4)] (500 runs)', () => {
  const rand = prng(0x12345678);
  for (let run = 0; run < 500; run++) {
    const nowMs = Math.floor(rand() * Number.MAX_SAFE_INTEGER / 2);
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) continue;
    const streak = Math.floor(rand() * 20);
    const result = schedule(card({ streak }), 'Remembered', nowMs);
    const expected = nowMs + INTERVALS_MS[Math.min(streak, 4)];
    assert.equal(result.dueAt, expected, `run ${run} streak=${streak}`);
  }
});
