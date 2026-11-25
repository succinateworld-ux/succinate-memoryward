/**
 * persistence.test.js
 * Property-based tests for assessment history integrity,
 * export/import round-trip, card creation validation, and field-length enforcement.
 * Node --test, no external dependencies.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, STORE_KEY } from '../js/store.js';
import { validateImport } from '../js/validator.js';
import { schedule } from '../js/scheduler.js';

const TS = 1_700_000_000_000;

function prng(seed) {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 0xFFFFFFFF; };
}

function mockStorage() {
  const store = {};
  return {
    getItem(k)      { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v)   { store[k] = v; },
    removeItem(k)   { delete store[k]; },
  };
}

function validState(cards = []) {
  return {
    version: '1',
    packs: [{
      id: 'pack-01', name: 'Test', createdAt: TS,
      cards,
    }],
    sessions: 0,
    motionEnabled: false,
  };
}

const VALUES = ['Again', 'Hard', 'Remembered'];

function buildCard(assessmentValues, rand) {
  // Build a valid card with assessments whose timestamps are non-decreasing
  // and whose streak matches the trailing Remembered count
  let ts = TS;
  let card = {
    id: 'card-01',
    question: 'Q',
    answer: 'A',
    createdAt: TS,
    dueAt: TS,
    streak: 0,
    assessments: [],
  };
  for (const [i,value] of assessmentValues.entries()) {
    card={...schedule(card,value,ts),assessments:[...card.assessments,{id:`a-${i}`,value,timestamp:ts}]};
    ts+=Math.floor(rand()*1000);
  }
  return card;
}

// ─── Property 8: Self-assessment history integrity ───────────────────────────

test('Property 8: assessment sequence survives store write/read (500 sequences)', () => {
  const rand = prng(0xFACEFACE);
  for (let run = 0; run < 500; run++) {
    const len = Math.floor(rand() * 10);
    const values = Array.from({ length: len }, () => VALUES[Math.floor(rand() * 3)]);
    const card = buildCard(values, rand);
    const state = validState([card]);

    const storage = mockStorage();
    const store = createStore(storage);
    const wr = store.write(state);
    assert.equal(wr.ok, true, `run ${run}: write failed`);

    const rr = store.read();
    assert.equal(rr.ok, true, `run ${run}: read failed`);

    const readBack = rr.data.packs[0].cards[0].assessments;
    assert.equal(readBack.length, values.length, `run ${run}: length mismatch`);
    for (let i = 0; i < values.length; i++) {
      assert.equal(readBack[i].value, values[i], `run ${run} i=${i}: value mismatch`);
      assert.equal(readBack[i].timestamp, card.assessments[i].timestamp,
        `run ${run} i=${i}: timestamp mismatch`);
    }
  }
});

// ─── Property 9: Export/import round-trip ────────────────────────────────────

test('Property 9: export → import → export produces identical version and data (200 runs)', () => {
  const rand = prng(0x0DD1CAFE);
  for (let run = 0; run < 200; run++) {
    const len = Math.floor(rand() * 5);
    const values = Array.from({ length: len }, () => VALUES[Math.floor(rand() * 3)]);
    const card = buildCard(values, rand);
    const state = validState([card]);

    // Export: produce the envelope string
    const exported1 = JSON.stringify({ version: '1', data: state });

    // Import: validate
    const importResult = validateImport(exported1);
    assert.equal(importResult.ok, true, `run ${run}: import failed: ${importResult.error}`);

    // Re-export from imported data
    const exported2 = JSON.stringify({ version: '1', data: importResult.data });

    // Compare
    assert.equal(exported1, exported2, `run ${run}: round-trip not identical`);
  }
});

// ─── Property 11: Card creation validation — whitespace rejection ─────────────

test('Property 11: whitespace-only question/answer strings are rejected (500 cases)', () => {
  const rand = prng(0xBADB000);

  // Exercise the actual import validator, not a copied validation algorithm.
  function validate(question, answer) {
    const card=buildCard([],rand);
    card.question=question;card.answer=answer;
    return validateImport(JSON.stringify({version:'1',data:validState([card])})).ok;
  }

  const whitespaceChars = [' ', '\t', '\n', '\r', '\u00a0', '\u2003'];

  for (let run = 0; run < 500; run++) {
    const len = 1 + Math.floor(rand() * 20);
    const wsStr = Array.from({ length: len },
      () => whitespaceChars[Math.floor(rand() * whitespaceChars.length)]).join('');
    const normalStr = 'Normal text';

    // whitespace question, normal answer
    assert.equal(validate(wsStr, normalStr), false,
      `run ${run}: whitespace question should be rejected`);

    // normal question, whitespace answer
    assert.equal(validate(normalStr, wsStr), false,
      `run ${run}: whitespace answer should be rejected`);

    // both whitespace
    assert.equal(validate(wsStr, wsStr), false,
      `run ${run}: both whitespace should be rejected`);
  }
});

// ─── Property 12: Field length enforcement ────────────────────────────────────

test('Property 12: strings longer than 2000 chars are rejected by validator (500 cases)', () => {
  const rand = prng(0xC0C0A);
  for (let run = 0; run < 500; run++) {
    const extraLen = 2001 + Math.floor(rand() * 2000);
    const longStr = 'x'.repeat(extraLen);

    // Validator should reject card with question > 2000 chars
    const state = validState([{
      id: 'card-01',
      question: longStr,
      answer: 'Normal',
      createdAt: TS, dueAt: TS, streak: 0, assessments: [],
    }]);
    const r = validateImport(JSON.stringify({ version: '1', data: state }));
    assert.equal(r.ok, false,
      `run ${run}: question len=${extraLen} should be rejected but was accepted`);

    // And answer > 2000 chars
    const state2 = validState([{
      id: 'card-01',
      question: 'Normal',
      answer: longStr,
      createdAt: TS, dueAt: TS, streak: 0, assessments: [],
    }]);
    const r2 = validateImport(JSON.stringify({ version: '1', data: state2 }));
    assert.equal(r2.ok, false,
      `run ${run}: answer len=${extraLen} should be rejected but was accepted`);
  }
});

// ─── samplePack integration ───────────────────────────────────────────────────

test('createSampleState produces a valid state that passes validateImport', async () => {
  const { createSampleState } = await import('../js/samplePack.js');
  const state = createSampleState(TS);
  const envelope = JSON.stringify({ version: '1', data: state });
  const r = validateImport(envelope);
  assert.equal(r.ok, true, `Sample state failed validation: ${r.error}`);
  assert.equal(r.data.packs[0].cards.length, 10);
  // All cards due immediately
  for (const card of r.data.packs[0].cards) {
    assert.equal(card.dueAt, TS);
    assert.equal(card.streak, 0);
    assert.deepEqual(card.assessments, []);
  }
});
