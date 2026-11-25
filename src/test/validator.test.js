/**
 * validator.test.js
 * Node --test tests for src/js/validator.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateImport } from '../js/validator.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TS = 1_700_000_000_000;

function validState() {
  return {
    version: '1',
    packs: [
      {
        id: 'pack-01',
        name: 'Test Pack',
        createdAt: TS,
        cards: [
          {
            id: 'card-01',
            question: 'What is 2+2?',
            answer: 'Four',
            createdAt: TS,
            dueAt: TS,
            streak: 0,
            assessments: [],
          },
        ],
      },
    ],
    sessions: 0,
    motionEnabled: false,
  };
}

function wrap(state) {
  return JSON.stringify({ version: '1', data: state });
}

function validRaw() { return wrap(validState()); }

// ─── Valid ────────────────────────────────────────────────────────────────────

test('valid file → ok:true with data', () => {
  const result = validateImport(validRaw());
  assert.equal(result.ok, true);
  assert.ok(result.data);
  assert.equal(result.data.version, '1');
});

test('valid file with assessments → ok:true', () => {
  const state = validState();
  state.packs[0].cards[0].assessments = [
    { id: 'a-01', value: 'Remembered', timestamp: TS },
    { id: 'a-02', value: 'Remembered', timestamp: TS + 1000 },
  ];
  state.packs[0].cards[0].streak = 2;
  state.packs[0].cards[0].dueAt = TS + 1000 + 3 * 86_400_000;
  const result = validateImport(wrap(state));
  assert.equal(result.ok, true);
});

// ─── Envelope errors ─────────────────────────────────────────────────────────

test('empty string → ok:false', () => {
  assert.equal(validateImport('').ok, false);
});

test('whitespace-only string → ok:false', () => {
  assert.equal(validateImport('   \n  ').ok, false);
});

test('non-JSON string → ok:false', () => {
  const r = validateImport('this is not json');
  assert.equal(r.ok, false);
  assert.match(r.error, /not valid JSON/i);
});

test('version "2" → ok:false', () => {
  const r = validateImport(JSON.stringify({ version: '2', data: validState() }));
  assert.equal(r.ok, false);
  assert.match(r.error, /unrecognised/i);
});

test('version "0" → ok:false', () => {
  assert.equal(validateImport(JSON.stringify({ version: '0', data: validState() })).ok, false);
});

test('missing data field → ok:false', () => {
  const r = validateImport(JSON.stringify({ version: '1' }));
  assert.equal(r.ok, false);
  assert.match(r.error, /data/i);
});

// ─── Size guard ───────────────────────────────────────────────────────────────

test('size > 2MB → ok:false', () => {
  const r = validateImport(validRaw(), 2_097_153);
  assert.equal(r.ok, false);
  assert.match(r.error, /2 MB/);
});

test('size exactly 2MB → ok (not rejected by size alone)', () => {
  // Size itself is fine; content is valid
  const raw = validRaw();
  const result = validateImport(raw, 2_097_152);
  assert.equal(result.ok, true);
});

// ─── State field errors ───────────────────────────────────────────────────────

test('missing packs array → ok:false', () => {
  const state = validState();
  delete state.packs;
  assert.equal(validateImport(wrap(state)).ok, false);
});

test('sessions not integer → ok:false', () => {
  const state = validState();
  state.sessions = '5';
  assert.equal(validateImport(wrap(state)).ok, false);
});

test('sessions negative → ok:false', () => {
  const state = validState();
  state.sessions = -1;
  assert.equal(validateImport(wrap(state)).ok, false);
});

test('motionEnabled not boolean → ok:false', () => {
  const state = validState();
  state.motionEnabled = 'yes';
  assert.equal(validateImport(wrap(state)).ok, false);
});

// ─── Pack errors ──────────────────────────────────────────────────────────────

test('bad pack id (spaces) → ok:false', () => {
  const state = validState();
  state.packs[0].id = 'bad id';
  assert.equal(validateImport(wrap(state)).ok, false);
});

test('bad pack id (angle bracket) → ok:false', () => {
  const state = validState();
  state.packs[0].id = '<script>';
  assert.equal(validateImport(wrap(state)).ok, false);
});

test('pack name too long → ok:false', () => {
  const state = validState();
  state.packs[0].name = 'x'.repeat(201);
  assert.equal(validateImport(wrap(state)).ok, false);
});

test('duplicate pack id → ok:false', () => {
  const state = validState();
  const p2 = { ...state.packs[0], id: 'pack-01', cards: [] };
  state.packs.push(p2);
  assert.equal(validateImport(wrap(state)).ok, false);
});

// ─── Card errors ──────────────────────────────────────────────────────────────

test('missing required card fields → ok:false', () => {
  const state = validState();
  delete state.packs[0].cards[0].question;
  assert.equal(validateImport(wrap(state)).ok, false);
});

test('question too long → ok:false', () => {
  const state = validState();
  state.packs[0].cards[0].question = 'q'.repeat(2001);
  assert.equal(validateImport(wrap(state)).ok, false);
});

test('answer too long → ok:false', () => {
  const state = validState();
  state.packs[0].cards[0].answer = 'a'.repeat(2001);
  assert.equal(validateImport(wrap(state)).ok, false);
});

test('card streak negative → ok:false', () => {
  const state = validState();
  state.packs[0].cards[0].streak = -1;
  assert.equal(validateImport(wrap(state)).ok, false);
});

test('duplicate card id → ok:false', () => {
  const state = validState();
  state.packs[0].cards.push({ ...state.packs[0].cards[0], id: 'card-01' });
  assert.equal(validateImport(wrap(state)).ok, false);
});

test('bad card id format → ok:false', () => {
  const state = validState();
  state.packs[0].cards[0].id = 'bad card';
  assert.equal(validateImport(wrap(state)).ok, false);
});

// ─── Assessment errors ────────────────────────────────────────────────────────

test('backwards timestamp → ok:false', () => {
  const state = validState();
  state.packs[0].cards[0].assessments = [
    { id: 'a-01', value: 'Remembered', timestamp: TS + 1000 },
    { id: 'a-02', value: 'Remembered', timestamp: TS },      // backwards
  ];
  state.packs[0].cards[0].streak = 1;
  assert.equal(validateImport(wrap(state)).ok, false);
});

test('equal consecutive timestamps (non-decreasing) → ok:true', () => {
  const state = validState();
  state.packs[0].cards[0].assessments = [
    { id: 'a-01', value: 'Remembered', timestamp: TS },
    { id: 'a-02', value: 'Remembered', timestamp: TS }, // equal OK
  ];
  state.packs[0].cards[0].streak = 2;
  state.packs[0].cards[0].dueAt = TS + 3 * 86_400_000;
  assert.equal(validateImport(wrap(state)).ok, true);
});

test('invalid assessment value → ok:false', () => {
  const state = validState();
  state.packs[0].cards[0].assessments = [
    { id: 'a-01', value: 'Good', timestamp: TS },
  ];
  state.packs[0].cards[0].streak = 0;
  assert.equal(validateImport(wrap(state)).ok, false);
});

test('duplicate assessment id → ok:false', () => {
  const state = validState();
  state.packs[0].cards[0].assessments = [
    { id: 'a-01', value: 'Remembered', timestamp: TS },
    { id: 'a-01', value: 'Remembered', timestamp: TS + 1 }, // duplicate
  ];
  state.packs[0].cards[0].streak = 2;
  assert.equal(validateImport(wrap(state)).ok, false);
});

// ─── Streak consistency ───────────────────────────────────────────────────────

test('streak disagrees with trailing history → ok:false', () => {
  const state = validState();
  // history has 1 trailing Remembered, but streak=3
  state.packs[0].cards[0].assessments = [
    { id: 'a-01', value: 'Remembered', timestamp: TS },
  ];
  state.packs[0].cards[0].streak = 3; // wrong
  assert.equal(validateImport(wrap(state)).ok, false);
});

test('streak 0 matches empty assessments → ok:true', () => {
  const state = validState();
  assert.equal(validateImport(wrap(state)).ok, true);
});

// ─── Property test: robustness against random mutations ───────────────────────

function prng(seed) {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 0xFFFFFFFF; };
}

test('Property 10: 1000 randomly mutated payloads all return ok:false', () => {
  const rand = prng(0x900DBAD);
  const base = JSON.parse(validRaw());
  let failures = 0;

  for (let run = 0; run < 1000; run++) {
    // Create a structurally broken payload by applying one of several mutations
    const mutation = Math.floor(rand() * 10);
    let payload;

    if (mutation === 0) {
      payload = JSON.stringify({ version: '2', data: base.data });
    } else if (mutation === 1) {
      payload = JSON.stringify({ version: '1' }); // missing data
    } else if (mutation === 2) {
      const d = JSON.parse(JSON.stringify(base.data));
      delete d.packs;
      payload = JSON.stringify({ version: '1', data: d });
    } else if (mutation === 3) {
      const d = JSON.parse(JSON.stringify(base.data));
      if (d.packs[0]?.cards[0]) d.packs[0].cards[0].question = '';
      payload = JSON.stringify({ version: '1', data: d });
    } else if (mutation === 4) {
      const d = JSON.parse(JSON.stringify(base.data));
      if (d.packs[0]?.cards[0]) d.packs[0].cards[0].id = 'bad id!!';
      payload = JSON.stringify({ version: '1', data: d });
    } else if (mutation === 5) {
      const d = JSON.parse(JSON.stringify(base.data));
      d.sessions = -1;
      payload = JSON.stringify({ version: '1', data: d });
    } else if (mutation === 6) {
      const d = JSON.parse(JSON.stringify(base.data));
      d.motionEnabled = null;
      payload = JSON.stringify({ version: '1', data: d });
    } else if (mutation === 7) {
      const d = JSON.parse(JSON.stringify(base.data));
      if (d.packs[0]?.cards[0]) {
        d.packs[0].cards[0].assessments = [
          { id: 'a1', value: 'Remembered', timestamp: 1000 },
          { id: 'a2', value: 'Remembered', timestamp: 500 }, // backwards
        ];
        d.packs[0].cards[0].streak = 1;
      }
      payload = JSON.stringify({ version: '1', data: d });
    } else if (mutation === 8) {
      const d = JSON.parse(JSON.stringify(base.data));
      if (d.packs[0]?.cards[0]) {
        d.packs[0].cards[0].streak = 999; // disagrees with empty history
      }
      payload = JSON.stringify({ version: '1', data: d });
    } else {
      // mutation 9: wrong data type for data
      payload = JSON.stringify({ version: '1', data: 'a string' });
    }

    const r = validateImport(payload);
    if (r.ok) failures++;
  }

  assert.equal(failures, 0, `${failures} mutated payloads incorrectly returned ok:true`);
});
