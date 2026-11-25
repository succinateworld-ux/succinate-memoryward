> Amendment, 25 November 2026: Codex updated the original Kiro-generated spec following the user’s explicit nursing-brand and cinematic-motion direction.

# Requirements Document

## Introduction

Succinate MemoryWard is a private, browser-only spaced-repetition learning app published under the SuccinateWorld brand. Learners convert study facts into "rooms" in an animated memory palace, practise recall before the answer is revealed, record self-assessments, and return to rooms on a deterministic schedule that surfaces weak items first. Rooms brighten visually as recall evidence accumulates. The Halloween aesthetic represents forgotten knowledge reclaimed — it has no clinical connotation. The app deploys as static assets (HTML, CSS, JS) with no server, no account, no payment, and no external API. All data lives in the user's browser `localStorage`.

This document covers the full first release as defined in the BUILD-BRIEF: sample pack, card creation, room map, recall-before-reveal challenge, deterministic scheduling, progress metrics with persistence, and versioned JSON export/import. It also covers accessibility, motion, design, and test/correctness requirements.

---

## Glossary

- **App**: The Succinate MemoryWard single-page application served as static assets.
- **Pack**: A named collection of Cards created or imported by the learner.
- **Card**: A single study item consisting of a Question field and an Answer field.
- **Room**: The visual and navigational representation of one Card in the memory palace map. Each Room maps one-to-one to a Card.
- **Room_Map**: The interactive visual grid of Rooms displayed as the main navigation surface.
- **Room_List**: A keyboard-navigable flat list of Rooms that serves as an always-available alternative to the Room_Map.
- **Sample_Pack**: The built-in Nursing Foundations Pack shipped with the App. It contains exactly 10 source-referenced Cards for nursing revision.
- **Recall_Challenge**: A screen that displays the Question of a Card and requires the learner to attempt recall before the Answer is shown.
- **Self_Assessment**: The learner's post-reveal rating of their own recall quality, chosen from three values: `Again`, `Hard`, or `Remembered`. Self-assessments are explicitly labelled as learner self-reports, not verified mastery.
- **Scheduler**: The deterministic algorithm implementing the documented fixed-interval progression defined in Requirement 5 that calculates the next review date for a Card given its Self_Assessment history.
- **Review_Interval**: The duration in seconds until a Card is next due, as calculated by the Scheduler. Stored as `dueAt`, a UTC millisecond timestamp on the Card.
- **Room_State**: One of three visual brightness levels assigned to a Room, computed from the trailing run of consecutive Remembered assessments at the end of the Card's Self_Assessment history: `dim` = trailing streak length is 0 (no assessments, or the most recent assessment is Again or Hard); `lit` = trailing streak length is 1 or 2; `bright` = trailing streak length is 3 or more. Any Again or Hard assessment resets the trailing streak to 0.
- **Session**: A single page-load interval during which at least one Self_Assessment is committed. A Session is counted exactly once per qualifying page load; reloading the page alone does NOT increment the Session count.
- **Store**: The App's localStorage persistence layer. All Pack, Card, Self_Assessment, and scheduling data is held in the Store.
- **Export_File**: A JSON file produced by the App containing a versioned snapshot of the Store.
- **Import_File**: A JSON file supplied by the learner to replace or merge with the Store.
- **Clock**: An injectable dependency that provides the current date. All Scheduler calculations use the Clock; real wall-clock time is never read directly in Scheduler logic.
- **Scheduler_Test**: An automated test suite for the Scheduler that injects a controlled Clock.
- **Reduced_Motion_Mode**: The operating-system or browser preference `prefers-reduced-motion: reduce`.
- **Focus_Ring**: A visible outline rendered around the interactive element that currently holds keyboard focus.
- **Touch_Target**: The interactive hit area of a UI control.

---

## Requirements

### Requirement 1: Sample Pack — Immediate Entry Without Setup

**User Story:** As a first-time learner, I want to open the App and immediately begin practising with a ready-made study pack, so that I can experience the full learning flow without any configuration.

#### Acceptance Criteria

1. THE App SHALL ship with a Sample_Pack containing exactly 10 Cards on nursing foundations, with credible source references and no patient-specific decision support.
2. WHEN the App is opened for the first time (Store is empty), THE App SHALL load the Sample_Pack into the Store automatically.
3. WHEN the Sample_Pack is loaded, THE App SHALL navigate the learner directly to the Room_Map without requiring login, payment, account creation, or any network request.
4. THE Sample_Pack SHALL be embedded in the App's static build artefacts and require no external API call to retrieve.
5. WHEN the Store already contains at least one Pack on subsequent loads, THE App SHALL NOT overwrite or re-inject the Sample_Pack.

---

### Requirement 2: Custom Card Creation

**User Story:** As a learner, I want to create my own study cards by entering explicit question-and-answer pairs, so that I can build a personalised study pack for any topic I choose.

#### Acceptance Criteria

1. WHEN the learner opens the card-creation interface, THE App SHALL present a form containing a Question field and an Answer field, both accepting free-text input.
2. WHEN the learner submits a valid card-creation form (both fields non-empty after trimming whitespace), THE App SHALL add a new Card to the active Pack and persist the updated Pack to the Store.
3. IF the learner submits the card-creation form with an empty Question field or an empty Answer field (after trimming whitespace), THEN THE App SHALL display an inline validation error identifying the empty field and SHALL NOT add a Card to the Store.
4. THE App SHALL accept Question and Answer fields of up to 2 000 characters each; it SHALL reject input exceeding 2 000 characters with a character-count error.
5. THE App SHALL display a brief, unobtrusive notice in the card-creation interface stating that the App does not interpret or verify any information entered. This notice SHALL appear once per session and SHALL NOT be repeated on every card creation or review screen.
6. WHEN a Card is successfully created, THE App SHALL assign that Card a new Room in the Room_Map in `dim` Room_State.
7. THE App SHALL allow the learner to create up to 500 Cards per Pack and up to 10 Packs. These limits are displayed in the UI. IF the learner attempts to exceed a limit, THE App SHALL display a clear error and SHALL NOT persist the new item.
8. IF a localStorage write fails for any reason (quota exceeded, security error, unavailable storage), THE App SHALL display a persistent "unsaved changes" status indicator and a descriptive error message, and SHALL preserve the previously persisted data without corruption.

---

### Requirement 3: Room Map and List Navigation

**User Story:** As a learner, I want to navigate my memory palace through both a visual room map and a plain list, so that I can choose the interaction style that works for me regardless of ability or device.

#### Acceptance Criteria

1. THE App SHALL render a Room_Map displaying one tile per Card in the active Pack.
2. THE Room_Map SHALL reflect each Room's current Room_State visually: `dim` rooms are rendered in a low-brightness style, `lit` rooms in a medium-brightness style, and `bright` rooms in a full-brightness style, using the midnight-purple, spectral-mint, and amber palette.
3. THE App SHALL provide a Room_List as a persistent navigation alternative, reachable from the Room_Map view by activating a clearly labelled toggle control.
4. WHEN a learner activates the Room_List toggle, THE App SHALL display a flat list in which each item shows the Card's Question text and Room_State.
5. THE Room_Map and Room_List SHALL each be fully operable using only a keyboard: every Room tile and list item SHALL be reachable by Tab or arrow-key navigation, and SHALL be activatable by pressing Enter or Space.
6. WHEN a Room tile or Room_List item is activated, THE App SHALL navigate to the Recall_Challenge for that Card.
7. THE Room_Map SHALL indicate which Rooms have Cards due for review today by applying a distinct visual indicator (e.g., a glowing border) that does not rely on colour alone.
8. WHERE the learner's viewport width is less than 640 px, THE App SHALL render the Room_Map in a single-column or two-column grid so that all Room tiles remain legible and their Touch_Targets meet the minimum size requirement.
9. THE App SHALL provide a visible Focus_Ring on every interactive element in the Room_Map and Room_List.

---

### Requirement 4: Recall-Before-Reveal Challenge and Self-Assessment

**User Story:** As a learner, I want to attempt to recall the answer before seeing it, then record how well I remembered, so that I can build genuine retrieval practice and track my honest self-assessment.

#### Acceptance Criteria

1. WHEN a learner enters a Room, THE App SHALL display only the Card's Question and a "Reveal Answer" control; it SHALL NOT display the Answer until the learner explicitly activates the reveal control.
2. WHEN the learner activates "Reveal Answer", THE App SHALL display the Card's Answer and present three Self_Assessment buttons labelled exactly `Again`, `Hard`, and `Remembered`.
3. WHEN the learner activates a Self_Assessment button, THE App SHALL record the Self_Assessment value together with the UTC timestamp provided by the Clock, persist the record to the Store, update the Card's scheduling state via the Scheduler, and update the Room_State by re-evaluating the Card's full consecutive Remembered history from stored Self_Assessment records.
4. WHEN the learner activates a Self_Assessment button, THE App SHALL navigate back to the Room_Map and visually reflect the updated Room_State for that Room.
5. THE App SHALL display a prominent notice on the Self_Assessment UI stating: "These ratings are your own self-assessments and do not represent verified learning or mastery."
6. THE "Reveal Answer" control and all three Self_Assessment buttons SHALL be reachable and activatable by keyboard alone, and each SHALL have a visible Focus_Ring.
7. WHEN a learner enters a Room for a Card that is not yet due (the Card's `dueAt` timestamp has not elapsed), THE App SHALL present the same Recall_Challenge flow and SHALL NOT block access or display a warning that prevents review.
8. Room_State SHALL be computed from the Card's stored Self_Assessment sequence using the trailing consecutive Remembered streak: streak = 0 → `dim`; streak = 1 or 2 → `lit`; streak ≥ 3 → `bright`. Recording an `Again` or `Hard` assessment resets the streak to 0, which MAY transition the Room from `bright` or `lit` to `dim`.

---

### Requirement 5: Deterministic Scheduling

**User Story:** As a learner, I want the App to surface cards I find difficult more frequently and reduce frequency for well-remembered cards, so that I spend study time efficiently.

#### Acceptance Criteria

1. New Cards (zero Self_Assessments recorded) SHALL be due immediately (due date = time of Card creation).
2. WHEN a Self_Assessment of `Again` is recorded, THE Scheduler SHALL set the next due timestamp to the current UTC time plus 10 minutes (600 000 milliseconds).
3. WHEN a Self_Assessment of `Hard` is recorded, THE Scheduler SHALL set the next due timestamp to the current UTC time plus 1 day (86 400 000 milliseconds).
4. WHEN a Self_Assessment of `Remembered` is recorded, THE Scheduler SHALL set the next due timestamp to the current UTC time plus the interval determined by the Card's trailing consecutive Remembered streak length before this assessment: streak 0 → 1 day (86 400 000 ms); streak 1 → 3 days; streak 2 → 7 days; streak 3 → 14 days; streak ≥ 4 → 30 days (cap). The streak used is the count of consecutive Remembered assessments at the tail of the existing history BEFORE the new assessment is appended.
5. All due-date comparisons SHALL use UTC timestamps (milliseconds since Unix epoch) consistently. The Scheduler and the App UI SHALL compare `card.dueAt` against the current UTC timestamp from the injected Clock using `>=` (a card is due when `now >= card.dueAt`).
6. THE Scheduler SHALL accept the current timestamp exclusively from the injected Clock dependency and SHALL NOT call `Date.now()`, `new Date()`, or any wall-clock or system-time API directly.
7. THE App SHALL sort the Room_List and prioritise review sessions to present Cards with the earliest `dueAt` timestamp first.
8. WHEN no Cards are due for review, THE App SHALL display an empty-state message indicating that no reviews are due and showing the next due date in the user's local timezone.
9. FOR ALL valid sequences of Self_Assessment inputs applied to a Card, THE Scheduler SHALL produce a `dueAt` value strictly greater than the `createdAt` timestamp of the Card. *(Scheduling invariant — property-based test target)*
10. FOR ALL Cards, THE Scheduler SHALL produce identical `dueAt` output when given identical input sequences and identical Clock values, regardless of execution order or surrounding state. *(Determinism property — property-based test target)*

---

### Requirement 6: Progress Metrics, Persistence, and Reload Restoration

**User Story:** As a learner, I want to see accurate session and history data and have my progress automatically saved, so that I can track improvement honestly and resume where I left off after closing the browser.

#### Acceptance Criteria

1. THE App SHALL display a progress dashboard showing: total Cards in the active Pack, number of Cards due for review today, total Sessions completed (where a Session is counted only when at least one Self_Assessment is committed in that page load), and a Self_Assessment history table listing each Card's last Self_Assessment value and date.
2. WHEN any of these metrics are zero (e.g., no reviews completed yet), THE App SHALL display a meaningful empty-state message for that metric rather than a blank or missing UI element.
3. THE App SHALL persist the entire Pack, all Cards, all Self_Assessment records, and all Scheduler state to the Store after every Self_Assessment and after every card creation.
4. WHEN the App is reloaded (page refresh or re-navigation to the URL), THE App SHALL restore all Pack, Card, Self_Assessment, and scheduling data from the Store without requiring any user action.
5. THE App SHALL display a persistent, clearly visible notice stating: "Your data is stored only in this browser. It will be lost if you clear browser data or use a different browser or device."
6. WHEN the Store contains data from a previous Session, THE App SHALL restore Room_States correctly from the stored Self_Assessment history rather than resetting all Rooms to `dim`.
7. FOR ALL valid Store payloads written by the App, deserialising the payload and re-serialising it SHALL produce a byte-identical JSON string. *(Persistence round-trip property — property-based test target)*
8. FOR ALL sequences of Self_Assessment records stored and retrieved from the Store, the retrieved sequence SHALL equal the original sequence in length, order, value, and timestamp. *(Self-assessment history integrity — property-based test target)*

---

### Requirement 7: Versioned JSON Export and Import

**User Story:** As a learner, I want to export my study data to a JSON file and import it back, so that I can back up my progress and transfer it between browsers or devices.

#### Acceptance Criteria

1. THE App SHALL provide an Export control that serialises the entire Store — all Packs, Cards, Self_Assessment records, and Scheduler state — into a single Export_File.
2. THE Export_File SHALL be a valid UTF-8 JSON object containing a `version` field set to the string `"1"` and a `data` field containing the serialised Store payload.
3. WHEN the learner activates the Export control, THE App SHALL trigger a browser file download of the Export_File named `succinate-memoryward-backup-{ISO8601-date}.json`.
4. THE App SHALL provide an Import control that accepts a JSON file from the learner.
5. WHEN an Import_File is supplied, THE App SHALL validate that the file is valid UTF-8, is parseable JSON, contains a `version` field equal to `"1"`, and contains a `data` field matching the expected Store schema before writing any data to the Store.
6. IF an Import_File fails validation for any reason, THEN THE App SHALL display a descriptive error message identifying the validation failure and SHALL NOT modify the Store.
7. WHEN a valid Import_File passes validation, THE App SHALL display a confirmation dialog summarising the import content (number of Packs and Cards) and require explicit learner confirmation before overwriting the Store.
8. WHEN the learner confirms a valid import, THE App SHALL replace the Store with the imported data and reload the Room_Map to reflect the imported Pack.
9. THE App SHALL provide a Reset control that clears all Store data; activation SHALL require explicit confirmation via a modal dialog before the Store is cleared.
10. THE App SHALL display a persistent notice on the Import/Export screen stating: "Exporting saves a copy of your data to a file on your device. The App cannot recover data lost due to browser storage being cleared."
11. IF the imported `version` field is any value other than `"1"`, THEN THE App SHALL reject the Import_File with an error message stating that the version is unrecognised and SHALL NOT modify the Store.
12. FOR ALL Export_Files produced by the App, importing the file and then exporting again SHALL produce a JSON object with identical `version` and `data` content. *(Export/import round-trip property — property-based test target)*
13. FOR ALL JSON files with structurally invalid `data` payloads (wrong field types, missing required fields), THE Validator SHALL return a descriptive error and SHALL NOT write to the Store. *(Import validation robustness — property-based test target)*

---

### Requirement 8: Motion, Animation, and Reduced-Motion Accessibility

**User Story:** As a learner, I want interface motion to reinforce navigation without causing discomfort, so that the app is usable and pleasant regardless of my sensitivity to animation.

#### Acceptance Criteria

1. THE App SHALL animate the following transitions using CSS transforms and opacity only: entering a Room (map tile → challenge screen), revealing an Answer (card flip or fade), restoring Room_State brightness after a Self_Assessment, and returning to the Room_Map.
2. WHEN Reduced_Motion_Mode is active, THE App SHALL remove all non-essential transitions and animations, replacing them with immediate visual state changes without motion.
3. THE App SHALL NOT autoplay any sound, video, or animation on any screen at any time.
4. THE App SHALL NOT produce any flashing or strobing effect at any frequency.
5. THE App MAY display optional gentle ambient animation (e.g., slow particle drift or lantern flicker at low opacity) on the Room_Map. This animation SHALL be disabled by default and SHALL be controllable by a clearly labelled motion toggle visible on the Room_Map. When the motion toggle is off, no ambient animation SHALL run. When Reduced_Motion_Mode is active, all ambient animation SHALL be suppressed regardless of the toggle state, and the toggle SHALL be hidden or disabled.
6. WHEN Reduced_Motion_Mode is active, THE App SHALL remain fully functional with no degraded features; only the motion is removed, not the content or controls.

---

### Requirement 9: Accessibility and Responsive Design

**User Story:** As a learner using a keyboard, screen reader, touch device, or narrow screen, I want all features to remain usable, so that disability or device type does not prevent me from studying.

#### Acceptance Criteria

1. THE App SHALL meet WCAG 2.1 Level AA colour-contrast requirements for all text and meaningful UI elements against their backgrounds, using the midnight-purple, warm-ivory, spectral-mint, and amber palette.
2. THE App SHALL use semantic HTML elements (headings, buttons, lists, form controls, landmark regions) correctly throughout, with no interactive behaviour implemented on non-interactive elements (e.g., `div` used as a button).
3. EVERY interactive element in the App SHALL have an accessible name exposed to assistive technology, either through visible label text, `aria-label`, or `aria-labelledby`.
4. THE App SHALL ensure a visible Focus_Ring on every interactive element when focused by keyboard navigation, with a minimum contrast ratio of 3:1 between the Focus_Ring colour and the adjacent background.
5. EVERY Touch_Target in the App SHALL measure at least 44 × 44 CSS pixels.
6. WHERE the learner's viewport width is less than 640 px, THE App SHALL reflow to a single-column layout with no horizontal overflow on any screen.
7. THE App SHALL be fully operable with a keyboard alone; no feature SHALL require a pointer device (mouse, touch, stylus) to access.
8. WHEN a modal dialog (confirmation or import error) is displayed, THE App SHALL trap keyboard focus within the dialog until it is dismissed, and SHALL return focus to the triggering element on dismissal.

---

### Requirement 10: Static Deployment and Open-Source Compliance

**User Story:** As a hackathon judge and future user, I want the app to be fully accessible from a public URL without login and to have its full source available under an open-source licence, so that I can evaluate and reuse it freely.

#### Acceptance Criteria

1. THE App SHALL be buildable to a directory of static assets (HTML, CSS, JS, and fonts or images as applicable) using a single documented build command with no server-side build secrets required.
2. THE App SHALL be deployable to any static hosting provider (e.g., GitHub Pages, Netlify, Vercel) without server-side configuration; all routing SHALL be client-side.
3. THE App SHALL function correctly in the latest stable releases of Chrome, Firefox, and Safari at time of submission, with no browser-specific features that cause functional failures in the other two browsers.
4. THE App's source repository SHALL contain an `LICENSE` file at the root containing the MIT Licence text with the correct copyright year and holder.
5. THE App's source repository SHALL contain a `README.md` at the root with: project name and description, build and run instructions, dependency list with version pins, local-storage disclosure, and a "No clinical advice" notice.
6. THE App's source repository SHALL contain a `DEVLOG.md` at the root with dated entries recording actual development decisions, feature completion, test results, and failures or corrections.
7. THE App's repository SHALL commit the `.kiro` directory (specs, hooks, steering) containing only files directly relevant to the project. Before committing, any file containing secrets, credentials, API keys, or session tokens SHALL be removed or redacted. Steering and hook files SHALL be committed only if they were actually used during development.

---

### Requirement 11: Quality, Testing, and No False Claims

**User Story:** As a developer and judge, I want the codebase to have automated tests covering scheduling correctness, import validation, persistence, and the full first-use and reload flows, so that the product's correctness claims are verifiable.

#### Acceptance Criteria

1. THE Codebase SHALL include a Scheduler_Test suite that covers: all three Self_Assessment values, multi-step sequences, `dueAt` values relative to injected Clock timestamps, the 10-minute Again interval (600 000 milliseconds), the 1-day Hard interval (86 400 000 milliseconds), the capped Remembered progression (1/3/7/14/30 days), and determinism (identical inputs with an injected Clock produce identical `dueAt` output).
2. THE Codebase SHALL include tests for the Import Validator covering: a valid Import_File, a file with an unrecognised `version`, a file with an invalid `data` schema, a non-JSON file, and an empty file.
3. THE Codebase SHALL include an end-to-end or integration test covering the full first-use flow: load app → verify Sample_Pack present → enter Room → reveal Answer → record Self_Assessment → verify Store updated → reload → verify data restored.
4. THE Codebase SHALL include a test verifying that the App renders without horizontal overflow on a viewport of 375 px width.
5. THE Codebase SHALL include a test verifying that all animated elements apply `prefers-reduced-motion` media query correctly (transitions are removed or set to `0s` duration when Reduced_Motion_Mode is active).
6. THE App SHALL contain no hardcoded claims about learning efficacy, clinical outcomes, or verified mastery. Scheduling descriptions SHALL be labelled as a self-assessment aid. The app targets general study topics; clinical-advice disclaimers are not required beyond the card-creation notice defined in AC 2.5.
7. THE App SHALL contain no telemetry, analytics, tracking scripts, or external resource loads of any kind; all assets SHALL be bundled locally.
8. THE Codebase SHALL include property-based tests for: Scheduler `dueAt` invariant (AC 5.9), Scheduler determinism (AC 5.10), persistence round-trip (AC 6.7), Self_Assessment history integrity (AC 6.8), export/import round-trip (AC 7.12), and import validation robustness (AC 7.13).

---

### Requirement 12: Data Integrity and Safe Bounds

**User Story:** As a learner, I want the app to enforce safe limits and handle storage or import failures without losing my existing data, so that errors leave me in a known good state.

#### Acceptance Criteria

1. All Card IDs, Pack IDs, and Self_Assessment record IDs SHALL be valid non-empty strings containing only URL-safe characters (alphanumeric, hyphen, underscore), with a maximum length of 128 characters.
2. All cross-references in the Store (e.g., a Self_Assessment record referencing a Card ID, a Room referencing a Card ID) SHALL be validated on import to ensure referential integrity; dangling references SHALL cause import rejection.
3. Self_Assessment records in the Store SHALL be stored in non-decreasing chronological order by UTC timestamp (equal consecutive timestamps are permitted; a timestamp strictly less than the previous record's timestamp SHALL be rejected). The Scheduler SHALL reject any Self_Assessment sequence containing a backwards (strictly decreasing) timestamp.
4. Import files SHALL be rejected if they exceed 2 MB in size. THE App SHALL display an error stating "Import file exceeds the 2 MB limit" and SHALL NOT modify the Store.
5. All text rendered from stored Card content (Question, Answer, Pack name) SHALL be rendered as plain text (escaped HTML entities); no HTML or script injection SHALL be possible through Card content.
6. IF any Store read or write operation fails, THE App SHALL display a persistent "unsaved changes" indicator and SHALL NOT silently swallow storage errors.
7. On import, if validation passes but the Store write fails, THE App SHALL retain the previous Store contents intact and display an error.
8. All UTC timestamps stored in the Store SHALL be represented as integers (milliseconds since Unix epoch, 64-bit safe integer range: 0 to 2^53 − 1). Session counts and streak lengths SHALL be represented as non-negative integers with a safe upper bound of 2^31 − 1. The Scheduler SHALL reject any input timestamp outside the safe integer range.
