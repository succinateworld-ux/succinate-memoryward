/**
 * store.test.js
 * Node --test tests for src/js/store.js
 * Uses a mock localStorage — no browser required.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, STORE_KEY } from '../js/store.js';

const TS = 1_700_000_000_000;

// ─── Mock localStorage ───────────────────────────────────────────────────────

function mockStorage(initialData = {}) {
  const store = { ...initialData };
  return {
    getItem(key)        { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, val)   { store[key] = val; },
    removeItem(key)     { delete store[key]; },
    _data()             { return store; },
  };
}

function throwingStorage(throwOnSet = true, throwOnGet = false) {
  return {
    getItem(key)  {
      if (throwOnGet) throw new Error('getItem disabled');
      return null;
    },
    setItem()     {
      if (throwOnSet) throw new Error('QuotaExceededError');
    },
    removeItem()  {},
  };
}

function validState(overrides = {}) {
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
    ...overrides,
  };
}

// ─── read() ───────────────────────────────────────────────────────────────────

test('read: absent key returns {ok:true, data:null}', () => {
  const s = createStore(mockStorage());
  const r = s.read();
  assert.equal(r.ok, true);
  assert.equal(r.data, null);
});

test('read: valid saved state returns {ok:true, data:state}', () => {
  const state = validState();
  const storage = mockStorage({ [STORE_KEY]: JSON.stringify(state) });
  const s = createStore(storage);
  const r = s.read();
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, state);
});

test('read: corrupt JSON returns {ok:false} and preserves raw', () => {
  const storage = mockStorage({ [STORE_KEY]: 'not-json{{{' });
  const s = createStore(storage);
  const r = s.read();
  assert.equal(r.ok, false);
  assert.ok(r.error.length > 0);
  assert.ok(r.raw !== undefined);
});

test('read: storage.getItem throws returns {ok:false}', () => {
  const s = createStore(throwingStorage(false, true));
  const r = s.read();
  assert.equal(r.ok, false);
  assert.match(r.error, /read failed/i);
});

test('read: corrupt state (validation fails) returns {ok:false} not {ok:true,data:null}', () => {
  // A JSON object that parses but fails state validation
  const bad = JSON.stringify({ version: '1', packs: null, sessions: 0, motionEnabled: false });
  const storage = mockStorage({ [STORE_KEY]: bad });
  const s = createStore(storage);
  const r = s.read();
  assert.equal(r.ok, false);
  assert.ok(r.error.length > 0);
  // Must NOT return data:null silently — that would erase the user's data
  assert.equal(r.data, undefined);
});

// ─── write() ─────────────────────────────────────────────────────────────────

test('write: valid state → stored under STORE_KEY', () => {
  const storage = mockStorage();
  const s = createStore(storage);
  const state = validState();
  const r = s.write(state);
  assert.equal(r.ok, true);
  const stored = JSON.parse(storage.getItem(STORE_KEY));
  assert.deepEqual(stored, state);
});

test('write then read returns deep-equal state', () => {
  const storage = mockStorage();
  const s = createStore(storage);
  const state = validState({ sessions: 3, motionEnabled: true });
  s.write(state);
  const r = s.read();
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, state);
});

test('write: invalid state → returns {ok:false}, storage unchanged', () => {
  const storage = mockStorage({ [STORE_KEY]: JSON.stringify(validState()) });
  const s = createStore(storage);
  const badState = { version: '1', packs: 'not-an-array', sessions: 0, motionEnabled: false };
  const r = s.write(badState);
  assert.equal(r.ok, false);
  // Previous value preserved
  const still = JSON.parse(storage.getItem(STORE_KEY));
  assert.equal(still.packs[0].id, 'pack-01');
});

test('write: storage.setItem throws → returns {ok:false}', () => {
  const s = createStore(throwingStorage(true, false));
  const r = s.write(validState());
  assert.equal(r.ok, false);
  assert.match(r.error, /write failed/i);
});

test('write: motionEnabled persists through read/write cycle', () => {
  const storage = mockStorage();
  const s = createStore(storage);
  const state = validState({ motionEnabled: true });
  s.write(state);
  const r = s.read();
  assert.equal(r.ok, true);
  assert.equal(r.data.motionEnabled, true);
});

// ─── createStore validation ───────────────────────────────────────────────────

test('createStore throws if storage has no getItem', () => {
  assert.throws(() => createStore({}), TypeError);
});

// ─── Property 7: persistence round-trip ──────────────────────────────────────

function prng(seed) {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 0xFFFFFFFF; };
}

test('Property 7: JSON.stringify(JSON.parse(serialised)) === serialised (500 round-trips)', () => {
  const rand = prng(0x1EADBEEF);
  for (let run = 0; run < 500; run++) {
    const state = validState({
      sessions: Math.floor(rand() * 100),
      motionEnabled: rand() > 0.5,
    });
    const serialised = JSON.stringify(state);
    const storage = mockStorage();
    const subject = createStore(storage);
    assert.equal(subject.write(state).ok, true);
    const restored = subject.read();
    assert.equal(restored.ok, true);
    const reserialised = JSON.stringify(restored.data);
    assert.equal(serialised, reserialised, `run ${run}: round-trip not byte-identical`);
  }
});
