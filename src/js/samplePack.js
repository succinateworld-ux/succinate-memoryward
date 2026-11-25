/**
 * Succinate MemoryWard — Sample Pack
 *
 * 10 original general-knowledge cards, reviewed for clear and unambiguous wording.
 * No clinical medicine content. All cards are due immediately (dueAt = createdAt).
 * assessments = [], streak = 0 for all.
 *
 * createSampleState(nowMs) returns a fresh, valid store state object
 * with the sample pack loaded and all cards due now.
 */

/** ID seed — fixed base for sample cards so they are stable across reloads */
const BASE_TS = 1_700_000_000_000; // 2023-11-14 — fixed past timestamp

function makeId(suffix) {
  return `sample-${suffix}`;
}

const SAMPLE_CARDS = [
  {
    "suffix": "geo-01",
    "question": "Which mountain is the highest above sea level on Earth?",
    "answer": "Mount Everest."
  },
  {
    "suffix": "geo-02",
    "question": "Which river flows through Cairo?",
    "answer": "The Nile."
  },
  {
    "suffix": "geo-03",
    "question": "Which continent contains the largest desert on Earth?",
    "answer": "Antarctica. A desert is defined by low precipitation, not by heat."
  },
  {
    "suffix": "geo-04",
    "question": "Which ocean is the largest by surface area?",
    "answer": "The Pacific Ocean."
  },
  {
    "suffix": "math-01",
    "question": "How many sides does a hexagon have?",
    "answer": "Six sides."
  },
  {
    "suffix": "sci-02",
    "question": "Which element has the chemical symbol Fe?",
    "answer": "Iron."
  },
  {
    "suffix": "math-02",
    "question": "How many centimetres are in one metre?",
    "answer": "100 centimetres."
  },
  {
    "suffix": "sci-04",
    "question": "What is the speed of light in a vacuum, to three significant figures?",
    "answer": "3.00 × 10⁸ metres per second."
  },
  {
    "suffix": "math-03",
    "question": "What does the denominator of a fraction describe?",
    "answer": "The number of equal parts into which a whole is divided."
  },
  {
    "suffix": "math-04",
    "question": "How many degrees are in a right angle?",
    "answer": "90 degrees."
  }
];

/**
 * Returns a fresh, valid store state with the sample pack.
 * All cards are due immediately (dueAt = createdAt = nowMs).
 *
 * @param {number} nowMs - Current UTC time in ms (injected; never read from clock)
 * @returns {object} Full store state object
 */
export function createSampleState(nowMs) {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new RangeError(`nowMs must be a safe non-negative integer, got: ${nowMs}`);
  }

  const cards = SAMPLE_CARDS.map((c, i) => ({
    id:          makeId(c.suffix),
    question:    c.question,
    answer:      c.answer,
    createdAt:   nowMs,
    dueAt:       nowMs,          // due immediately
    streak:      0,
    assessments: [],
  }));

  const pack = {
    id:        'sample-pack',
    name:      'Small facts, strong foundations',
    createdAt: nowMs,
    cards,
  };

  return {
    version:       '1',
    packs:         [pack],
    sessions:      0,
    motionEnabled: false,
  };
}

/** Convenience: the raw card data array, for reference in tests. */
export const SAMPLE_CARD_DATA = SAMPLE_CARDS;
