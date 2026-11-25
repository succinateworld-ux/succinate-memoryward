# Implementation Plan: Succinate MemoryWard

## Overview

Build the app in nine phases: scaffold → data layer → tests → UI views → accessibility → release. Each phase builds on the previous. All code is vanilla ES modules; no npm packages are installed at any point. Tests run via `node --test src/test/**/*.test.js`.

---

## Tasks

### Phase 1 — Project Scaffold

- [x] 1. Create `package.json`, folder structure, and static entry point
  - Create `package.json` with `"type": "module"`, empty `dependencies` and `devDependencies`, and scripts `dev`, `build`, `test` as defined in the design.
  - Create the directory tree: `src/js/views/`, `src/js/ui/`, `src/styles/`, `src/test/`, `src/assets/`, `scripts/`, `dist/`.
  - Create `src/index.html` with the full HTML shell: `<head>` with charset, viewport, title "Succinate MemoryWard", and `<link>` tags for all four CSS layers; `<body>` with `<main id="app">` container and `<script type="module" src="js/app.js">`.
  - _Requirements: 10.1, 10.2_

- [ ] 2. Write CSS design tokens and base layers
  - [ ] 2.1 Create `src/styles/tokens.css` with all custom property tokens from the design: colour tokens (`--color-void`, `--color-surface`, `--color-lifted`, `--color-bright`, `--color-ivory`, `--color-ivory-muted`, `--color-mint`, `--color-amber`, `--color-dim-border`, `--color-focus`), typography tokens (`--font-serif`, `--font-sans`, text-size and line-height tokens).
    - _Requirements: 9.1_
  - [ ] 2.2 Create `src/styles/layout.css` with page-level grid, responsive breakpoints (≥ 640 px: 4-column room grid with sidebar; < 640 px: 2-column full-width), and `max-width` / overflow guards that prevent horizontal overflow at 375 px.
    - _Requirements: 3.8, 9.6_
  - [ ] 2.3 Create `src/styles/components.css` with room tile styles for all three `Room_State` levels (`dim`, `lit`, `bright`), due indicator (mint glowing dot + "Due" label), modal dialog base styles, button and form control base styles with minimum 44 × 44 px touch targets, and visible focus ring using `--color-focus` with ≥ 3:1 contrast.
    - _Requirements: 3.2, 3.7, 3.9, 9.4, 9.5_
  - [ ] 2.4 Create `src/styles/animations.css` with all transitions gated inside `@media (prefers-reduced-motion: no-preference)`: page-enter (`opacity` + `translateY`, 200 ms), card-reveal (`rotateY`, 250 ms), room-brightness (`background-color`, `box-shadow`, 400 ms), and optional ambient particle `@keyframes` (opacity ≤ 0.15, `translateY` drift only, disabled by default).
    - _Requirements: 8.1, 8.2, 8.4, 8.5_

- [ ] 3. Write `scripts/build.js`
  - Implement using only `node:fs`, `node:path`, `node:crypto`, `node:url`.
  - Recursively copy `src/` → `dist/` for all `.html`, `.css`, `.js`, `.svg` files.
  - Compute `sha256` hash of all CSS and JS content concatenated; take first 8 hex characters.
  - Rewrite `href="…css"` and `src="…js"` attributes in copied HTML files to append `?v=<hash>`.
  - Exit with code 1 on any `fs` error.
  - _Requirements: 10.1_

- [ ] 4. Write `scripts/serve.js`
  - Implement using only `node:http`, `node:fs`, `node:path`, `node:url`.
  - Bind to `127.0.0.1:3000`; serve files from `src/`; correct MIME types for `.html`, `.css`, `.js`, `.svg`; 404 for missing files; SPA fallback to `src/index.html`; log each request to stdout.
  - _Requirements: 10.1, 10.2_

---

### Phase 2 — Core Data Layer

- [ ] 5. Implement `src/js/store.js`
  - Export `read()`, `write(state)`, `onError(cb)`.
  - `read()`: call `localStorage.getItem('succinate-memoryward-store')`; on missing key return `null`; on JSON parse failure fire `onError` and return `null`.
  - `write(state)`: serialise with `JSON.stringify`; wrap `setItem` in `try/catch`; on failure fire `onError` and leave previous value intact; expose an `unsavedChanges` boolean flag.
  - Session logic: `write` increments `state.sessions` and clears `state.sessionStartedAt` on the first `Self_Assessment` commit in the current page load; subsequent commits in the same load do not increment again. Use a module-level boolean to track whether the first commit has fired.
  - _Requirements: 6.3, 6.4, 6.6, 12.6, 2.8_

- [ ] 6. Implement `src/js/scheduler.js`
  - Export `schedule(card, assessment, nowMs)` as a pure function exactly matching the design algorithm.
  - `INTERVALS_MS = [1, 3, 7, 14, 30].map(d => d * 86_400_000)`.
  - Guard: throw `RangeError` if `nowMs` is not a safe non-negative integer.
  - `Again`: `card.streak = 0`, `card.dueAt = nowMs + 600_000`.
  - `Hard`: `card.streak = 0`, `card.dueAt = nowMs + 86_400_000`.
  - `Remembered`: `card.dueAt = nowMs + INTERVALS_MS[Math.min(card.streak, 4)]`, then `card.streak++`.
  - Throw `TypeError` for unknown assessment value.
  - Never call `Date.now()` or `new Date()` anywhere in this module.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ] 7. Implement `src/js/roomState.js`
  - Export `computeRoomState(assessments)` as a pure function.
  - Scan `assessments` from the end; count consecutive `'Remembered'` values; stop on first `'Again'` or `'Hard'`.
  - Return `'dim'` for streak 0, `'lit'` for streak 1–2, `'bright'` for streak ≥ 3.
  - _Requirements: 4.8_

- [ ] 8. Implement `src/js/samplePack.js`
  - Export `SAMPLE_PACK` as a hardcoded JS object matching the Store card schema.
  - Exactly 10 cards on a general-knowledge topic (e.g., world geography or science history) with no clinical medicine content.
  - Assign `id`, `question`, `answer`, `createdAt` (a fixed past timestamp), `dueAt = createdAt`, `streak = 0`, `assessments = []` for each card.
  - No network access; this is a static export.
  - _Requirements: 1.1, 1.4_

- [ ] 9. Implement `src/js/validator.js`
  - Export `validateImport(raw)` → `{ok: boolean, error?: string, data?: object}`.
  - Checks in order: (1) string is non-empty; (2) parseable JSON; (3) `version === "1"`; (4) `data` field present and matches Store schema (all required fields, correct types); (5) all IDs match `[a-zA-Z0-9_-]`, max 128 chars; (6) all cross-references valid (assessment card IDs exist); (7) assessment sequences non-decreasing by timestamp; (8) file size guard (caller passes `size` as second argument; reject if > 2 097 152).
  - Return `{ok: false, error: '<descriptive message>'}` on any failure without touching the Store.
  - _Requirements: 7.5, 7.6, 7.11, 12.1, 12.2, 12.3, 12.4_

- [ ] 10. Implement `src/js/app.js` — bootstrap and first-use flow
  - Export `init()`.
  - `init()` calls `store.read()`; if null or empty packs array, writes the Sample_Pack into a fresh Store object (sessions: 0, sessionStartedAt: Date.now(), motionEnabled: false).
  - If Store already has packs, do not overwrite Sample_Pack.
  - Increments `sessionStartedAt` to `Date.now()` on every load; does not touch `sessions` counter here.
  - Mounts the router and navigates to `#map`.
  - _Requirements: 1.2, 1.3, 1.5, 6.4_

- [ ] 11. Implement `src/js/ui/router.js`
  - Export `navigate(hash)` and `onRoute(pattern, fn)`.
  - Listen to `hashchange` and dispatch to the first matching registered pattern on load and on each change.
  - Patterns: `#map`, `#list`, `#challenge/:cardId`, `#create`, `#progress`, `#data`.
  - Each registered handler receives parsed params; view constructors receive the `<main id="app">` container.
  - Call `destroy()` on the previous view before mounting the next.
  - _Requirements: 3.6_

---

### Phase 3 — Unit and Property Tests

- [ ] 12. Write `src/test/scheduler.test.js`
  - [ ] 12.1 Unit tests: new card `dueAt = createdAt`; `Again` → `dueAt = nowMs + 600_000`, streak 0; `Hard` → `dueAt = nowMs + 86_400_000`, streak 0; `Remembered` streak 0–4 → correct interval and streak increment; `Remembered` streak ≥ 4 capped at 30-day interval; multi-step sequence (Again → Hard → Remembered × 3) full progression; identical `nowMs` inputs produce identical output; out-of-range `nowMs` (negative, non-integer, > 2^53-1) throws `RangeError`.
    - _Requirements: 11.1_
  - [ ]* 12.2 Property test — Property 1: Scheduler dueAt invariant
    - Run 1 000 random assessment sequences with monotonically non-decreasing clock; assert `card.dueAt > card.createdAt` after each call.
    - **Property 1: Scheduler dueAt invariant**
    - **Validates: Requirements 5.9**
  - [ ]* 12.3 Property test — Property 2: Scheduler determinism
    - Run 500 random sequences applied twice with identical `nowMs`; assert identical `dueAt` and `streak`.
    - **Property 2: Scheduler determinism**
    - **Validates: Requirements 5.10**
  - [ ]* 12.4 Property test — Property 3: Scheduler Again interval
    - Run 500 random safe non-negative `nowMs` values; assert `card.dueAt === nowMs + 600_000`.
    - **Property 3: Scheduler Again interval**
    - **Validates: Requirements 5.2**
  - [ ]* 12.5 Property test — Property 4: Scheduler Hard interval
    - Run 500 random safe non-negative `nowMs` values; assert `card.dueAt === nowMs + 86_400_000`.
    - **Property 4: Scheduler Hard interval**
    - **Validates: Requirements 5.3**
  - [ ]* 12.6 Property test — Property 5: Scheduler Remembered intervals
    - Run 500 random `(nowMs, streak)` pairs; assert `card.dueAt === nowMs + INTERVALS_MS[Math.min(streak, 4)]`.
    - **Property 5: Scheduler Remembered intervals**
    - **Validates: Requirements 5.4**

- [ ] 13. Write `src/test/roomState.test.js`
  - [ ] 13.1 Unit tests: empty → `'dim'`; `[Remembered]` → `'lit'`; `[Remembered, Remembered]` → `'lit'`; `[Remembered, Remembered, Remembered]` → `'bright'`; `[Remembered, Remembered, Remembered, Again]` → `'dim'`; `[Again]` → `'dim'`; `[Hard]` → `'dim'`; `[Remembered, Hard, Remembered, Remembered]` → `'lit'`.
    - _Requirements: 11.1_
  - [ ]* 13.2 Property test — Property 6: RoomState trailing streak
    - Run 1 000 random assessment sequences; independently compute trailing Remembered count; assert `computeRoomState` result matches rules.
    - **Property 6: RoomState trailing streak**
    - **Validates: Requirements 4.8**

- [ ] 14. Write `src/test/validator.test.js`
  - [ ] 14.1 Unit tests: valid export file → `{ok: true}`; version `"2"` → `{ok: false}`; version `"0"` → `{ok: false}`; missing `data` field → `{ok: false}`; missing required card fields → `{ok: false}`; bad ID format (spaces, `<`, `>`) → `{ok: false}`; dangling assessment card reference → `{ok: false}`; backwards timestamp in assessment sequence → `{ok: false}`; `size` > 2 097 152 → `{ok: false}`; empty string input → `{ok: false}`; non-JSON string → `{ok: false}`.
    - _Requirements: 11.2_
  - [ ]* 14.2 Property test — Property 10: Import validation robustness
    - Generate 1 000 randomly mutated (structurally broken) payloads; assert all return `{ok: false}`.
    - **Property 10: Import validation robustness**
    - **Validates: Requirements 7.13, 12.1, 12.2, 12.3**

- [ ] 15. Write `src/test/store.test.js`
  - Use a mock `localStorage` object (plain JS object with `getItem`/`setItem`/`removeItem`) injected via a module-level setter exported from `store.js`.
  - [ ] 15.1 Unit tests: `write(state)` stores under key `'succinate-memoryward-store'`; `read()` after `write(state)` returns deep-equal object; `write` throws → `onError` callback fired, previous value intact; `read` with corrupt JSON → returns null, `onError` fired; session logic: `sessionStartedAt` set on init, first assessment increments `sessions` and clears `sessionStartedAt`, second commit in same load does not increment; `motionEnabled` persists through read/write cycle.
    - _Requirements: 6.3, 6.4, 6.6, 2.8_
  - [ ]* 15.2 Property test — Property 7: Persistence round-trip
    - Run 500 random Store payloads; `JSON.parse(JSON.stringify(p))` deep-equals original; re-serialise produces byte-identical string.
    - **Property 7: Persistence round-trip**
    - **Validates: Requirements 6.7**

- [ ] 16. Write `src/test/persistence.test.js`
  - [ ]* 16.1 Property test — Property 8: Self-assessment history integrity
    - Write 500 random assessment sequences to mock Store; read back; assert length, order, value, timestamp equality.
    - **Property 8: Self-assessment history integrity**
    - **Validates: Requirements 6.8**
  - [ ]* 16.2 Property test — Property 9: Export/import round-trip
    - 200 random Store states; call export serialisation, pass through `validateImport`, write to Store, call export again; assert identical `version` and `data`.
    - **Property 9: Export/import round-trip**
    - **Validates: Requirements 7.12**
  - [ ]* 16.3 Property test — Property 11: Card creation validation
    - 500 whitespace-only strings submitted as Question or Answer; assert pack card count unchanged after each.
    - **Property 11: Card creation validation**
    - **Validates: Requirements 2.3**
  - [ ]* 16.4 Property test — Property 12: Field length enforcement
    - 500 strings of length 2001–4000; assert all rejected with a character-count error.
    - **Property 12: Field length enforcement**
    - **Validates: Requirements 2.4**

- [ ] 17. Checkpoint — run all tests
  - Run `node --test src/test/**/*.test.js` and confirm all unit tests pass. Ask the user if any test fails before continuing to UI phases.

---

### Phase 4 — UI: Room Map and Navigation

- [ ] 18. Implement `src/js/ui/dialog.js`
  - Export `openDialog(el)` and `closeDialog(el)`.
  - On open: set `aria-modal="true"`, call `el.showModal()`, query all focusable descendants, trap Tab / Shift+Tab within them, store previously focused element.
  - On close: call `el.close()`, restore focus to stored element.
  - _Requirements: 9.8_

- [ ] 19. Implement `src/js/ui/motion.js`
  - Export `prefersReducedMotion()` → boolean from `matchMedia('(prefers-reduced-motion: reduce)')`.
  - Export `getMotionEnabled()` / `setMotionEnabled(bool)` → read/write `motionEnabled` on the Store.
  - _Requirements: 8.2, 8.5, 8.6_

- [ ] 20. Implement `src/js/views/mapView.js` — room map grid
  - Render one tile per Card in the active Pack, labelled with the Card's question text (truncated to ~60 chars).
  - Apply `data-state="dim|lit|bright"` on each tile, resolved via `computeRoomState(card.assessments)`.
  - Add due indicator (mint dot + "Due" text) to tiles where `Date.now() >= card.dueAt`.
  - Sort displayed tiles by `dueAt` ascending (due cards first).
  - Navigation links to `#list`, `#create`, `#progress`, `#data`.
  - Motion toggle button: visible label, hidden/disabled when `prefersReducedMotion()` is true; writes `motionEnabled` to Store on toggle.
  - Display persistent localStorage notice per Requirement 6.5.
  - _Requirements: 3.1, 3.2, 3.3, 3.7, 5.7, 6.5_

- [ ] 21. Implement `src/js/views/listView.js` — flat list alternative
  - Render a flat list of all Cards ordered by `dueAt` ascending; each item shows Question text and Room_State label.
  - Each list item is a keyboard-navigable link that navigates to `#challenge/:cardId`.
  - Provide a back link to `#map`.
  - Display empty-state message when no cards exist.
  - _Requirements: 3.3, 3.4, 3.5, 5.7, 6.2_

---

### Phase 5 — UI: Recall Challenge and Self-Assessment

- [ ] 22. Implement `src/js/views/challengeView.js`
  - Look up Card by `cardId` from Store; if not found, navigate back to `#map`.
  - Phase 1 (pre-reveal): display Question only and a "Reveal Answer" button; Answer is not in the DOM.
  - Phase 2 (post-reveal): display Answer and three buttons labelled exactly `Again`, `Hard`, `Remembered`; display self-assessment disclaimer per Requirement 4.5.
  - On Self_Assessment button activation: (a) create assessment record `{id, value, timestamp: Date.now()}`; (b) validate timestamp ≥ last assessment timestamp; (c) call `schedule(card, value, Date.now())`; (d) call `computeRoomState(card.assessments)` and update `card.streak`-consistent state; (e) append record to `card.assessments`; (f) call `store.write(state)`; (g) navigate to `#map`.
  - Cards not yet due are presented normally per Requirement 4.7 — no warning or block.
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7_

- [ ] 23. Wire page-transition and reveal animations
  - Apply `page-enter` class on each view mount so CSS handles `opacity` + `translateY` transition.
  - Apply `card-reveal` class when switching challengeView from phase 1 to phase 2 (`rotateY` flip, 250 ms).
  - After Self_Assessment, trigger room-brightness transition on the updated tile in `#map` by updating `data-state` attribute (CSS handles `background-color` and `box-shadow` transitions, 400 ms).
  - All transitions are already gated in `animations.css` by `prefers-reduced-motion`; no additional JS guard needed.
  - _Requirements: 8.1, 8.2_

---

### Phase 6 — UI: Card Creation

- [ ] 24. Implement `src/js/views/createView.js`
  - Render a form with Question (textarea) and Answer (textarea), live character count displays (max 2 000 each), a Submit button, and a back link to `#map`.
  - On submit: (a) trim both fields; (b) if either is empty, display inline error identifying the empty field — do not write to Store; (c) if either exceeds 2 000 chars, display character-count error — do not write to Store; (d) if Pack is at 500 cards, display limit error — do not write to Store; (e) if Store has 10 packs and no active pack exists, display pack limit error; (f) otherwise generate IDs, construct Card with `dueAt = createdAt = Date.now()`, `streak = 0`, `assessments = []`, append to active pack, call `store.write()`, navigate to `#map`.
  - Display one-per-session disclaimer per Requirement 2.5 (use `sessionStorage` to track whether shown this page load).
  - Display current card count and 500-card limit in the UI.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

---

### Phase 7 — UI: Progress and Data

- [ ] 25. Implement `src/js/views/progressView.js`
  - Display: total Cards in active Pack, number of Cards due now (`Date.now() >= card.dueAt`), total Sessions completed, Self_Assessment history table (Card question, last assessment value, last assessment date in local timezone).
  - Empty-state messages for all zero metrics.
  - When no cards are due, show next due date in user's local timezone per Requirement 5.8.
  - Provide a back link to `#map`.
  - _Requirements: 6.1, 6.2, 5.7, 5.8_

- [ ] 26. Implement `src/js/views/dataView.js` — export, import, and reset
  - Export: on button activation, serialise Store into `{version: "1", data: storePayload}`, create a Blob, trigger download as `succinate-memoryward-backup-{YYYY-MM-DD}.json`.
  - Import: `<input type="file" accept=".json">`; on file selection check `file.size ≤ 2 097 152`; read with `FileReader`; pass raw string and size to `validateImport`; on failure display descriptive error; on success show confirmation dialog summarising Pack count and Card count; on user confirmation write to Store and navigate to `#map`.
  - Reset: button opens confirmation modal; on confirmation call `localStorage.removeItem('succinate-memoryward-store')` and reload to `#map` (which triggers Sample_Pack injection).
  - Display persistent import/export notice per Requirement 7.10.
  - Use `dialog.js` for all modal dialogs.
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 12.4_

- [ ] 27. Checkpoint — run all tests and verify first-use flow
  - Run `node --test src/test/**/*.test.js`; all tests must pass.
  - Manually verify first-use flow in the browser: open app → Sample_Pack present → enter Room → reveal → assess → verify Room_State update → reload → verify data restored.
  - Ask the user if any step fails before continuing.
  - _Requirements: 11.3_

---

### Phase 8 — Accessibility and Polish

- [ ] 28. Audit and fix keyboard navigation across all views
  - Verify every Room tile and Room_List item is reachable by Tab or arrow keys and activatable by Enter/Space.
  - Verify "Reveal Answer" button and all three Self_Assessment buttons are keyboard-activatable.
  - Verify every interactive element has a visible Focus_Ring (`:focus-visible` with `--color-focus` outline) with ≥ 3:1 contrast.
  - Verify no interactive behaviour is placed on non-interactive elements (`<div>`, `<span>`).
  - _Requirements: 3.5, 3.9, 4.6, 9.2, 9.4, 9.7_

- [ ] 29. Audit accessible names and ARIA
  - Ensure every interactive element has an accessible name: either visible label text, `aria-label`, or `aria-labelledby`.
  - Ensure semantic HTML is used throughout: headings, `<button>`, `<ul>`/`<li>`, `<form>`, `<main>`, `<nav>`, `<section>`.
  - Verify confirmation and error `<dialog>` elements have `aria-modal="true"`, trap focus on open, and return focus on close (via `dialog.js`).
  - _Requirements: 9.2, 9.3, 9.8_

- [ ] 30. Touch targets and responsive layout audit
  - Verify all Touch_Targets measure ≥ 44 × 44 CSS pixels.
  - Verify at 375 px viewport width: no horizontal overflow, single-column layout, all tiles legible.
  - Verify at ≥ 640 px: 4-column room grid with sidebar.
  - _Requirements: 3.8, 9.5, 9.6_

- [ ] 31. Reduced-motion and ambient animation audit
  - Verify that when `prefers-reduced-motion: reduce` is active all CSS transitions resolve to `0s` or `none` and no particles animate.
  - Verify motion toggle is hidden/disabled when `prefers-reduced-motion` is active.
  - Verify ambient particles: disabled by default; enabled by toggle only when `prefersReducedMotion()` is false; suppressed entirely when OS reduced-motion is active.
  - _Requirements: 8.2, 8.3, 8.5, 8.6_

- [ ]* 32. Optional: implement ambient particle animation on Room_Map
  - Add 3–5 CSS `@keyframes` particle elements to `mapView.js` (opacity ≤ 0.15, `translateY` drift only).
  - Render particles only when `motionEnabled === true` AND `prefersReducedMotion() === false`.
  - Controlled by the motion toggle already wired in task 20.
  - _Requirements: 8.5_

- [ ] 33. WCAG 2.1 AA colour contrast check
  - For each text/background combination in `tokens.css`, verify contrast ratio meets WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text and UI components).
  - Fix any failing token values directly in `tokens.css`.
  - _Requirements: 9.1_

---

### Phase 9 — Build, QA, and Release

- [ ] 34. Add end-to-end integration test in `src/test/`
  - Write a Node.js test using `node:test` and a mock DOM/Store that covers the full first-use flow: load app → Sample_Pack present in Store → open challenge for card 1 → reveal answer → record `Remembered` → verify Store updated (`dueAt > createdAt`, `assessments.length === 1`) → simulate reload → verify Store restored → verify Room_State equals `'lit'`.
  - _Requirements: 11.3_

- [ ] 35. Add viewport overflow and reduced-motion tests
  - [ ] 35.1 Write a test (using jsdom or CSS property checks in Node) that verifies no element in the Room_Map view has `scrollWidth > clientWidth` at a simulated 375 px container width.
    - _Requirements: 11.4_
  - [ ]* 35.2 Write a test that verifies all animated elements in `animations.css` are wrapped in `@media (prefers-reduced-motion: no-preference)` by parsing the CSS file text and asserting every `transition` and `animation` property definition appears only within that media query block.
    - _Requirements: 11.5_

- [ ] 36. Verify production build
  - Run `node scripts/build.js`; assert exit code 0 and that `dist/` contains `index.html`, all CSS files, all JS files.
  - Serve `dist/` and confirm the app loads without network requests (check DevTools Network tab: no external requests).
  - _Requirements: 10.1, 11.7_

- [ ] 37. Write `LICENSE`, `README.md`, and `DEVLOG.md`
  - `LICENSE`: MIT licence text with correct copyright year and holder.
  - `README.md`: project name and description; build command (`node scripts/build.js`); run command (`node scripts/serve.js`); test command (`node --test src/test/**/*.test.js`); dependency list (none); localStorage disclosure; "No clinical advice" notice.
  - `DEVLOG.md`: initial dated entry recording architectural decisions, tech choices (vanilla ES modules, no npm, Node built-in test runner), and first milestone.
  - _Requirements: 10.4, 10.5, 10.6_

- [ ] 38. Final manual browser QA checklist
  - This is a manual verification checklist, not an automated test. Work through each item in a live browser.
  - Full first-use flow: Chrome, Firefox, Safari — open → Sample_Pack present → enter Room → reveal → assess → check Room_State → reload → verify restored.
  - Keyboard-only navigation: Tab / arrow keys / Enter / Space through all views.
  - Reduced-motion: OS toggle active → no transitions, motion toggle hidden.
  - Ambient motion toggle (if task 32 implemented): off by default, enables particles, OS reduced-motion suppresses.
  - 375 px viewport (Chrome DevTools): no horizontal overflow, all tiles legible.
  - Production build: `node scripts/build.js` exits 0; `dist/` served by `node scripts/serve.js` works in all three browsers.
  - Import/export flow: export → clear storage → import → verify data restored.
  - 500-card limit: attempt 501st card → error displayed, count unchanged.
  - `localStorage` quota error: mock quota error → "unsaved changes" indicator appears.
  - Screen reader (VoiceOver/NVDA): interactive elements have accessible names; dialogs announce correctly.
  - _Requirements: 10.3, 11.3_

- [ ] 39. Review and commit `.kiro` directory
  - Verify `.kiro/specs/succinate-memoryward/` contains only `requirements.md`, `design.md`, `tasks.md`, and `.config.kiro`.
  - Remove or redact any file containing secrets, credentials, API keys, or session tokens.
  - Confirm steering and hook files are present only if actually used during development.
  - Add `.gitignore` entries for `node_modules/` (defensive), `dist/`, and any OS artefacts (`.DS_Store`, `Thumbs.db`).
  - _Requirements: 10.7_

- [ ] 40. Final checkpoint — all tests pass
  - Run `node --test src/test/**/*.test.js`; all unit and property tests pass.
  - Ask the user if any failure remains before marking the feature complete.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP (ambient particles, some property tests).
- All tasks use vanilla ES modules; zero `npm install` steps occur at any point.
- Tests use `node:test` and `node:assert` only; property tests are hand-rolled generator loops (≥ 500–1 000 iterations).
- Manual browser QA steps in task 38 require a live browser and are explicitly not automated tests.
- The scheduler is a fixed-interval streak-based progression (1/3/7/14/30 days); no Ease_Factor or SM-2 terminology is used anywhere.
- Each task references its requirements ACs for traceability.
- Checkpoints (tasks 17, 27, 40) are blocking gates; do not advance past them with failing tests.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4", "3", "4"] },
    { "id": 2, "tasks": ["5", "6", "7", "8", "9"] },
    { "id": 3, "tasks": ["10", "11"] },
    { "id": 4, "tasks": ["12.1", "13.1", "14.1", "15.1"] },
    { "id": 5, "tasks": ["12.2", "12.3", "12.4", "12.5", "12.6", "13.2", "14.2", "15.2", "16.1", "16.2", "16.3", "16.4"] },
    { "id": 6, "tasks": ["17"] },
    { "id": 7, "tasks": ["18", "19"] },
    { "id": 8, "tasks": ["20", "21"] },
    { "id": 9, "tasks": ["22"] },
    { "id": 10, "tasks": ["23"] },
    { "id": 11, "tasks": ["24"] },
    { "id": 12, "tasks": ["25", "26"] },
    { "id": 13, "tasks": ["27"] },
    { "id": 14, "tasks": ["28", "29", "30", "31"] },
    { "id": 15, "tasks": ["32", "33"] },
    { "id": 16, "tasks": ["34"] },
    { "id": 17, "tasks": ["35.1", "35.2"] },
    { "id": 18, "tasks": ["36", "37"] },
    { "id": 19, "tasks": ["38", "39"] },
    { "id": 20, "tasks": ["40"] }
  ]
}
```
