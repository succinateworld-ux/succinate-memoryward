# Design Document — Succinate MemoryWard

## Overview

Succinate MemoryWard is a single-page, browser-only spaced-repetition app delivered as static assets. There is no server, no account, no network dependency at runtime. All state lives in `localStorage`. The app is built from hand-authored HTML, CSS, and ES modules with a minimal Node.js build script; zero npm runtime dependencies are required.

The user experience is a Halloween-themed memory palace: study facts become architectural rooms that brighten as recall evidence accumulates. The learner opens a room, attempts recall before the answer is shown, records a self-assessment (`Again`, `Hard`, `Remembered`), and returns to the palace map. A fixed-interval streak-based scheduler determines when each room is next due.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser                                        │
│                                                 │
│  index.html                                     │
│    └── app.js  ──► router.js                    │
│                        └── views/               │
│                              mapView.js         │
│                              listView.js        │
│                              challengeView.js   │
│                              createView.js      │
│                              progressView.js    │
│                              dataView.js        │
│                                                 │
│  Shared modules (no framework, no bundler)      │
│    store.js        ← localStorage              │
│    scheduler.js    ← pure function              │
│    roomState.js    ← pure function              │
│    validator.js    ← pure function              │
│    samplePack.js   ← static data               │
│                                                 │
│  UI utilities                                   │
│    dialog.js   (focus-trapping <dialog>)        │
│    motion.js   (reduced-motion detection)       │
│                                                 │
│  CSS layers                                     │
│    tokens.css → layout.css → components.css     │
│    → animations.css                             │
└─────────────────────────────────────────────────┘
```

**Key architectural decisions:**

| Decision | Rationale |
|---|---|
| Vanilla ES modules, no framework | Zero runtime dependencies; ships directly to browser |
| Hash-based routing (`#map`, `#challenge/:id`, …) | Works on any static host without server config |
| localStorage as sole persistence | No server, no account, works offline permanently |
| Pure functions for Scheduler and RoomState | Deterministic, trivially testable, injectable clock |
| Node `--test` runner, hand-rolled generators | No install step; honest test automation |
| `<dialog>` for modals | Native focus trap; `aria-modal` semantics |

---

## Components and Interfaces

### Module responsibilities

| Module | Exports | Responsibility |
|---|---|---|
| `app.js` | `init()` | Bootstrap: load Store, inject Sample_Pack if empty, increment session, mount router |
| `store.js` | `read()`, `write(state)`, `onError(cb)` | Serialise/deserialise Store; catch `localStorage` errors; expose error-state flag |
| `scheduler.js` | `schedule(card, assessment, nowMs)` | Mutate `card.dueAt` and `card.streak`; never calls `Date.now()` |
| `roomState.js` | `computeRoomState(assessments)` | Return `'dim'`\|`'lit'`\|`'bright'` from trailing streak |
| `validator.js` | `validateImport(raw)` → `{ok, error, data}` | Validate UTF-8 JSON, schema, version, referential integrity, ID format, timestamps |
| `samplePack.js` | `SAMPLE_PACK` | Hardcoded 10-card object; no network access |
| `router.js` | `navigate(hash)`, `onRoute(pattern, fn)` | Hash-change listener; dispatch to view constructors |
| `dialog.js` | `openDialog(el)`, `closeDialog(el)` | Focus trap via `Tab`/`Shift+Tab`; `aria-modal` |
| `motion.js` | `prefersReducedMotion()`, `getMotionEnabled()`, `setMotionEnabled(bool)` | OS pref + user toggle |

### View constructors

Each view is a plain function that accepts a container element and app state, renders HTML into it, and returns a `destroy()` function for cleanup.

```js
// Pattern shared by all views
function mapView(container, state) {
  // render into container
  return { destroy() { /* remove event listeners */ } }
}
```

| View | Hash | Renders |
|---|---|---|
| `mapView` | `#map` | Room grid, due indicators, motion toggle, nav to list/create/progress/data |
| `listView` | `#list` | Flat card list ordered by `dueAt`, keyboard-navigable |
| `challengeView` | `#challenge/:cardId` | Question, Reveal button → Answer + 3 assessment buttons |
| `createView` | `#create` | Card creation form with validation, session-scoped disclaimer |
| `progressView` | `#progress` | Sessions, due count, total cards, assessment history table |
| `dataView` | `#data` | Export button, import file input, reset button |

---

## Data Models

### localStorage schema

**Key:** `succinate-memoryward-store`

```js
{
  version: "1",                    // string — must equal "1"
  packs: [
    {
      id: string,                  // URL-safe [a-zA-Z0-9_-], max 128 chars
      name: string,                // max 200 chars
      createdAt: integer,          // ms since Unix epoch, 0 ≤ n ≤ 2^53-1
      cards: [
        {
          id: string,              // URL-safe, max 128 chars
          question: string,        // plain text, max 2000 chars
          answer: string,          // plain text, max 2000 chars
          createdAt: integer,      // ms epoch
          dueAt: integer,          // ms epoch; equals createdAt for new cards
          streak: integer,         // non-negative, max 2^31-1
          assessments: [           // non-decreasing by timestamp
            {
              id: string,          // URL-safe, max 128 chars
              value: 'Again' | 'Hard' | 'Remembered',
              timestamp: integer   // ms epoch
            }
          ]
        }
      ]
    }
  ],
  sessions: integer,               // non-negative, counts qualifying page loads
  sessionStartedAt: integer | null,// set on load; cleared on first assessment commit
  motionEnabled: boolean           // ambient animation toggle; default false
}
```

### Export file schema

```js
{
  version: "1",
  data: { /* Store payload above */ }
}
```

Filename on download: `succinate-memoryward-backup-{YYYY-MM-DD}.json`

### ID generation

IDs are generated as `Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9)`. This produces URL-safe strings well under 128 characters.

### Limits enforced at write time

| Resource | Limit |
|---|---|
| Cards per Pack | 500 |
| Packs | 10 |
| Question / Answer length | 2 000 chars |
| Pack name length | 200 chars |
| Import file size | 2 097 152 bytes (2 MB) |

---

## Scheduler Algorithm

The scheduler is a pure function that mutates `card.dueAt` and `card.streak`. It accepts the current time as `nowMs` and never reads the clock directly.

```js
// scheduler.js
const INTERVALS_MS = [1, 3, 7, 14, 30].map(d => d * 86_400_000)

export function schedule(card, assessment, nowMs) {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new RangeError('nowMs must be a safe non-negative integer')
  }
  if (assessment === 'Again') {
    card.streak = 0
    card.dueAt = nowMs + 600_000          // 10 minutes
  } else if (assessment === 'Hard') {
    card.streak = 0
    card.dueAt = nowMs + 86_400_000       // 1 day
  } else if (assessment === 'Remembered') {
    const idx = Math.min(card.streak, 4)
    card.dueAt = nowMs + INTERVALS_MS[idx]
    card.streak = card.streak + 1
  } else {
    throw new TypeError(`Unknown assessment value: ${assessment}`)
  }
  return card
}
```

**Interval table for `Remembered`:**

| Streak before assessment | Added interval | dueAt offset |
|---|---|---|
| 0 | 1 day | 86 400 000 ms |
| 1 | 3 days | 259 200 000 ms |
| 2 | 7 days | 604 800 000 ms |
| 3 | 14 days | 1 209 600 000 ms |
| ≥ 4 | 30 days (cap) | 2 592 000 000 ms |

---

## Room State Algorithm

```js
// roomState.js
export function computeRoomState(assessments) {
  // assessments: [{value, timestamp}, ...]  sorted non-decreasing by timestamp
  let streak = 0
  for (let i = assessments.length - 1; i >= 0; i--) {
    if (assessments[i].value === 'Remembered') {
      streak++
    } else {
      break
    }
  }
  if (streak === 0) return 'dim'
  if (streak <= 2) return 'lit'
  return 'bright'
}
```

---

## Visual Design System

### Colour tokens (`tokens.css`)

```css
:root {
  --color-void:         #1a0a2e;   /* page background */
  --color-surface:      #2d1b4e;   /* dim room tile */
  --color-lifted:       #3d2a60;   /* lit room, card surface */
  --color-bright:       #5b3d8a;   /* bright room */
  --color-ivory:        #f5f0e8;   /* primary text */
  --color-ivory-muted:  #c8c0b0;   /* secondary text */
  --color-mint:         #4dffd2;   /* due indicators, CTAs, focus ring */
  --color-amber:        #ffb347;   /* progress, warm accents */
  --color-dim-border:   #3a2060;
  --color-focus:        #4dffd2;
}
```

### Typography

| Token | Value | Use |
|---|---|---|
| `--font-serif` | `'Georgia', 'Times New Roman', serif` | Headings |
| `--font-sans` | `system-ui, sans-serif` | Body, labels |
| `--text-label` | `0.875rem` | Labels, metadata |
| `--text-body` | `1rem` | Body copy |
| `--text-sub` | `1.25rem` | Subheadings |
| `--text-heading` | `1.75rem` | Section headings |
| `--text-hero` | `2.5rem` | App title |
| `--leading-body` | `1.6` | Body line-height |
| `--leading-heading` | `1.2` | Heading line-height |

### Room tile states

| State | Background | Border | Lantern | Glow |
|---|---|---|---|---|
| `dim` | `--color-surface` + fog radial-gradient | `--color-dim-border` | hidden | none |
| `lit` | `--color-lifted` | mint 1px | 40% opacity | mint `box-shadow` |
| `bright` | `--color-bright` | amber 2px | 100% opacity | amber `box-shadow` + optional particles |

Tile minimum size: 120×140 px desktop, 80×100 px mobile. Architectural arched-doorway silhouette rendered as inline SVG or CSS `clip-path`.

Due indicator: mint glowing dot + "Due" label text in tile corner (not colour-only per AC 3.7).

### Layout grid

| Viewport | Room grid | Panels |
|---|---|---|
| ≥ 640 px | 4 columns | Sidebar progress panel |
| < 640 px | 2 columns | Full-width stacked |

No horizontal overflow at 375 px.

### Motion (`animations.css`)

All transitions are gated on `@media (prefers-reduced-motion: no-preference)`. When reduced-motion is active, all transitions resolve to `0s` or `none`.

| Interaction | Animation |
|---|---|
| Page enter | `opacity: 0 → 1`, `translateY(8px) → 0`, 200 ms `ease-out` |
| Card reveal | `rotateY(90deg) → rotateY(0)`, 250 ms |
| Room brightness | `background-color 400ms, box-shadow 400ms` |
| Ambient particles (opt-in) | 3–5 `@keyframes` elements, `opacity ≤ 0.15`, `translateY` drift only |

Ambient particles: disabled by default; controlled by `motionEnabled` flag; suppressed when `prefers-reduced-motion: reduce`.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Scheduler dueAt invariant

*For any* valid Card (with any `createdAt` value) and any sequence of `Again`, `Hard`, or `Remembered` assessments applied with any monotonically non-decreasing clock sequence, the Scheduler SHALL produce a `dueAt` value strictly greater than `card.createdAt`.

**Validates: Requirements 5.9**

---

### Property 2: Scheduler determinism

*For any* Card state and any sequence of assessments with an identical injected clock value, applying the schedule function twice SHALL produce identical `dueAt` and `streak` values regardless of surrounding state or execution order.

**Validates: Requirements 5.10**

---

### Property 3: Scheduler Again interval

*For any* safe non-negative integer `nowMs` and any Card state, calling `schedule(card, 'Again', nowMs)` SHALL set `card.dueAt` to exactly `nowMs + 600_000`.

**Validates: Requirements 5.2**

---

### Property 4: Scheduler Hard interval

*For any* safe non-negative integer `nowMs` and any Card state, calling `schedule(card, 'Hard', nowMs)` SHALL set `card.dueAt` to exactly `nowMs + 86_400_000`.

**Validates: Requirements 5.3**

---

### Property 5: Scheduler Remembered intervals

*For any* safe non-negative integer `nowMs` and any streak value `s ≥ 0`, calling `schedule(card, 'Remembered', nowMs)` with pre-assessment `card.streak = s` SHALL set `card.dueAt` to `nowMs + INTERVALS_MS[min(s, 4)]` where `INTERVALS_MS = [86400000, 259200000, 604800000, 1209600000, 2592000000]`.

**Validates: Requirements 5.4**

---

### Property 6: RoomState trailing streak

*For any* sequence of assessments, `computeRoomState` SHALL return `'dim'` when the trailing consecutive Remembered count is 0, `'lit'` when the count is 1 or 2, and `'bright'` when the count is ≥ 3. Any `Again` or `Hard` assessment resets the trailing count to 0.

**Validates: Requirements 4.8**

---

### Property 7: Persistence round-trip

*For any* valid Store payload produced by the App, `JSON.parse(JSON.stringify(payload))` SHALL deep-equal the original payload (all fields, types, ordering preserved), and re-serialising SHALL produce a byte-identical JSON string.

**Validates: Requirements 6.7**

---

### Property 8: Self-assessment history integrity

*For any* sequence of Self_Assessment records written to the Store, reading the Store back SHALL return a sequence equal to the original in length, order, value, and timestamp.

**Validates: Requirements 6.8**

---

### Property 9: Export/import round-trip

*For any* Store state, exporting to an Export_File, importing that file, and exporting again SHALL produce a JSON object with identical `version` and `data` fields.

**Validates: Requirements 7.12**

---

### Property 10: Import validation robustness

*For any* JSON file with a structurally invalid `data` payload (wrong field types, missing required fields, bad ID format, dangling references, backwards timestamps, or oversized fields), `validator.validateImport` SHALL return `{ok: false, error: <string>}` and SHALL NOT write to the Store.

**Validates: Requirements 7.13, 12.1, 12.2, 12.3**

---

### Property 11: Card creation validation

*For any* string composed entirely of whitespace characters submitted as a Question or Answer, the card-creation logic SHALL reject the submission and leave the Pack's card count unchanged.

**Validates: Requirements 2.3**

---

### Property 12: Field length enforcement

*For any* Question or Answer string with length > 2 000 characters, the card-creation logic SHALL reject the input with a character-count error and SHALL NOT add a Card to the Store.

**Validates: Requirements 2.4**

---

## Error Handling

| Error condition | Detection | Recovery |
|---|---|---|
| `localStorage.setItem` throws (quota, security) | `try/catch` in `store.write()` | Display persistent "unsaved changes" indicator; leave Store intact |
| `localStorage.getItem` returns malformed JSON | `try/catch` around `JSON.parse` in `store.read()` | Treat as empty Store; display "storage unreadable" notice |
| Import file > 2 MB | Check `file.size` before `FileReader` | Display "Import file exceeds the 2 MB limit" error; no Store write |
| Import JSON parse failure | `try/catch` in `validator.validateImport` | Display descriptive parse error; no Store write |
| Import schema validation failure | Validator returns `{ok: false, error}` | Display error string; no Store write |
| Import version mismatch | Validator checks `file.version !== "1"` | Display "unrecognised version" error; no Store write |
| Import referential integrity failure | Validator checks all cross-references | Display error; no Store write |
| Store write failure during import confirmation | `try/catch` in `store.write()` | Display error; retain previous Store |
| Scheduler receives out-of-range `nowMs` | `Number.isSafeInteger` guard | Throw `RangeError`; caller displays error |
| Backwards assessment timestamp | Validator / scheduler check | Reject sequence; display error |

All error states are surfaced to the user with descriptive messages. No error is silently swallowed.

---

## Testing Strategy

### Automated tests — `node --test src/test/**/*.test.js`

No external test libraries. The Node built-in `node:test` and `node:assert` modules are used throughout. Property-based tests are hand-rolled: simple generator loops running ≥ 1 000 iterations over randomised inputs.

#### `scheduler.test.js`

**Unit tests (example-based):**
- New card `dueAt` equals `createdAt` (zero assessments, due immediately)
- `Again` → `dueAt = nowMs + 600_000`; streak reset to 0
- `Hard` → `dueAt = nowMs + 86_400_000`; streak reset to 0
- `Remembered` with streak 0–4 → correct interval from table; streak incremented
- `Remembered` with streak ≥ 4 → capped at 30-day interval
- Multi-step sequence: Again → Hard → Remembered × 3 → verify full progression
- Injected clock: two calls with same `nowMs` produce identical `dueAt`
- Out-of-range `nowMs` (negative, non-integer, > 2^53-1) → throws `RangeError`

**Property tests (generated sequences):**
- *Feature: succinate-memoryward, Property 1: Scheduler dueAt invariant* — 1 000 random sequences; assert `dueAt > card.createdAt`
- *Feature: succinate-memoryward, Property 2: Scheduler determinism* — 500 random sequences applied twice with identical clock; assert identical results
- *Feature: succinate-memoryward, Property 3: Scheduler Again interval* — 500 random `nowMs` values; assert exact offset
- *Feature: succinate-memoryward, Property 4: Scheduler Hard interval* — 500 random `nowMs` values; assert exact offset
- *Feature: succinate-memoryward, Property 5: Scheduler Remembered intervals* — 500 random `(nowMs, streak)` pairs; assert correct interval from table

#### `roomState.test.js`

**Unit tests:**
- Empty assessments → `'dim'`
- `[Remembered]` → `'lit'`
- `[Remembered, Remembered]` → `'lit'`
- `[Remembered, Remembered, Remembered]` → `'bright'`
- `[Remembered, Remembered, Remembered, Again]` → `'dim'` (streak reset)
- `[Again]` → `'dim'`
- `[Hard]` → `'dim'`
- Mixed: `[Remembered, Hard, Remembered, Remembered]` → `'lit'`

**Property tests:**
- *Feature: succinate-memoryward, Property 6: RoomState trailing streak* — 1 000 random sequences; independently compute trailing Remembered count; assert state matches rules

#### `validator.test.js`

**Unit tests:**
- Valid export file → `{ok: true}`
- Version `"2"` or `"0"` → `{ok: false, error: …}`
- Missing `data` field → `{ok: false}`
- Missing required card fields → `{ok: false}`
- Bad ID format (spaces, `<`, `>`) → `{ok: false}`
- Dangling card reference in assessment → `{ok: false}`
- Backwards timestamp in assessment sequence → `{ok: false}`
- File > 2 MB → `{ok: false}`
- Empty string input → `{ok: false}`
- Non-JSON string → `{ok: false}`

**Property tests:**
- *Feature: succinate-memoryward, Property 10: Import validation robustness* — 1 000 randomly mutated (structurally broken) payloads; assert all return `{ok: false}`

#### `store.test.js`

**Unit tests (mock `localStorage` via substituted object):**
- `write(state)` → `JSON.stringify` stored under correct key
- `read()` after `write(state)` returns deep-equal object
- `write` throws → `onError` callback fired; previous Store intact
- `read` with corrupt JSON → returns `null`; `onError` callback fired
- Session logic: `sessionStartedAt` set on init; first assessment commit increments `sessions` and clears `sessionStartedAt`; second commit on same load does not increment again
- `motionEnabled` persists through read/write cycle

**Property tests:**
- *Feature: succinate-memoryward, Property 7: Persistence round-trip* — 500 random Store payloads; `JSON.parse(JSON.stringify(p))` deep-equals original; re-stringify produces same bytes

#### `persistence.test.js`

**Property tests:**
- *Feature: succinate-memoryward, Property 8: Self-assessment history integrity* — 500 random assessment sequences written to Store; read back; assert length, order, value, timestamp equality
- *Feature: succinate-memoryward, Property 9: Export/import round-trip* — 200 random Store states; export → import → export; assert identical `version` and `data`
- *Feature: succinate-memoryward, Property 11: Card creation validation* — 500 whitespace-only strings; assert none added to pack
- *Feature: succinate-memoryward, Property 12: Field length enforcement* — 500 strings of length 2001–4000; assert all rejected

### Manual browser QA checklist (not automated)

These steps require a running browser and are labelled as manual verification:

- [ ] Full first-use flow: Chrome, Firefox, Safari — open → Sample_Pack present → enter Room → reveal → assess → check Room_State → reload → verify restored
- [ ] Keyboard-only navigation through all views (Tab, arrow keys, Enter, Space)
- [ ] Reduced-motion mode: OS-level toggle active → no transitions animate
- [ ] Ambient motion toggle: off by default; enabling shows particles; OS reduced-motion suppresses even when toggle is on
- [ ] 375 px viewport (Chrome DevTools): no horizontal overflow, all tiles legible
- [ ] Production build: `node scripts/build.js` exits 0; `dist/` served by `node scripts/serve.js` works in all three browsers
- [ ] Import/export flow: export → clear storage → import → verify data restored
- [ ] 500-card limit: attempt 501st card → error displayed, count unchanged
- [ ] `localStorage` quota: mock quota error → "unsaved changes" indicator appears
- [ ] Screen reader: VoiceOver / NVDA — interactive elements have accessible names; dialogs announce correctly

---

## Build and Toolchain

### `package.json`

```json
{
  "name": "succinate-memoryward",
  "type": "module",
  "scripts": {
    "dev":   "node scripts/serve.js",
    "build": "node scripts/build.js",
    "test":  "node --test src/test/**/*.test.js"
  },
  "dependencies": {},
  "devDependencies": {}
}
```

No `npm install` required.

### `scripts/build.js`

Using only `node:fs`, `node:path`, `node:crypto`, `node:url`:

1. Recursively copy `src/` → `dist/` (all `.html`, `.css`, `.js`, `.svg` files)
2. Compute `sha256` of all CSS and JS files concatenated; take first 8 hex chars as `hash`
3. In every copied `.html` file, rewrite `href="…css"` → `href="…css?v=<hash>"` and `src="…js"` → `src="…js?v=<hash>"`
4. Exit with code 1 on any `fs` error

### `scripts/serve.js`

Using only `node:http`, `node:fs`, `node:path`, `node:url`:

- Binds to `127.0.0.1:3000`
- Serves files from `src/` (dev server; serves source directly for fast iteration)
- MIME types: `.html` → `text/html`, `.css` → `text/css`, `.js` → `text/javascript`, `.svg` → `image/svg+xml`
- Returns 404 for missing files; falls back to `src/index.html` for any path not matching a file (SPA fallback)
- Logs each request to stdout

### Source structure

```
succinate-memoryward/
├── src/
│   ├── index.html
│   ├── styles/
│   │   ├── tokens.css
│   │   ├── layout.css
│   │   ├── components.css
│   │   └── animations.css
│   ├── js/
│   │   ├── app.js
│   │   ├── store.js
│   │   ├── scheduler.js
│   │   ├── validator.js
│   │   ├── roomState.js
│   │   ├── samplePack.js
│   │   ├── views/
│   │   │   ├── mapView.js
│   │   │   ├── listView.js
│   │   │   ├── challengeView.js
│   │   │   ├── createView.js
│   │   │   ├── progressView.js
│   │   │   └── dataView.js
│   │   └── ui/
│   │       ├── dialog.js
│   │       ├── router.js
│   │       └── motion.js
│   └── assets/
│       └── (SVG room silhouettes, lantern icons)
├── src/test/
│   ├── scheduler.test.js
│   ├── roomState.test.js
│   ├── validator.test.js
│   ├── store.test.js
│   └── persistence.test.js
├── scripts/
│   ├── build.js
│   └── serve.js
├── dist/
├── package.json
├── LICENSE
├── README.md
└── DEVLOG.md
```
