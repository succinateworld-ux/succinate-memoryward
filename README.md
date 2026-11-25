# Succinate MemoryWard

A nursing memory palace for private recall practice, by **SuccinateWorld**. This is a new project for Kiroween 2026's Costume Contest category.

**Development status:** the local application is implemented, 102 automated checks pass, and the static production build succeeds. The earlier version is publicly deployed; this nursing redesign is ready for publication and the updated submission demo is being prepared; this repository is not evidence of a completed hackathon submission.

## The idea

Study facts become rooms. Open one, attempt recall, reveal the source answer and record **Again**, **Hard** or **Remembered**. A room's light follows the trailing run of Remembered ratings: zero is unlit, one or two is lit, and three or more is bright. These are self-assessments, not verified mastery.

The core experience is free and requires no account, wallet, payment or external API. Create your own question/answer cards, revisit due rooms, inspect actual review history, and export a backup. There is no cross-device cloud sync or platform-wide user analytics.

## Run, test and build

Use Node.js 24 or later. There are no third-party packages to install.

```sh
node scripts/serve.js
# Open http://127.0.0.1:3078

node --test
node scripts/build.js
node scripts/serve.js --dist
```

Stop any existing preview server before starting another on the same port. Set `MEMORYWARD_PORT` to use a different port. Deploy the contents of `dist/` to a static host. Hash routing requires no server rewrites.

## Data and review schedule

All study data is stored in this browser's localStorage under `succinate-memoryward-store`. Clearing browser data removes it. Export a versioned JSON backup to keep a copy or move devices. Import validates the file and asks before replacing saved data. Failed writes must preserve the previous durable data. A temporary session can be used when storage is unavailable, with an explicit unsaved notice.

- Again: 10 minutes.
- Hard: 1 day.
- Consecutive Remembered ratings: 1, 3, 7, 14, then 30 days, capped at 30.
- Again and Hard reset the Remembered streak.

This is a simple deterministic study schedule, not canonical SM-2 or a scientifically validated mastery score. A study session is counted once per page visit with at least one successfully recorded assessment; a reload by itself does not count.

The 10-card Nursing Foundations starter covers communication, patient teaching and infection prevention, with links to WHO, CDC and AHRQ references checked on 25 November 2026. This supports nursing revision, not patient-specific clinical decisions or verified competency. Follow current local policy and qualified supervision. Never enter patient identifiers. Custom study material is not verified by the app.

## Kiro and development provenance

The actual Kiro IDE Spec workflow generated and revised the root `.kiro/specs/succinate-memoryward/requirements.md`, `design.md` and `tasks.md`. Requirements review clarified session counting, data recovery, the review schedule and self-assessment semantics. The task runner was stopped after redundant folder setup attempts; Kiro Default mode was then used for core implementation.

Codex prepared the product brief, checklist, icon, interface/controller and local build/preview scripts, and performs integration review and verification. Kiro was assigned the scheduler, room-state, import validator, storage layer, sample-state factory and core tests. Completion and test results will be recorded only when observed. No Kiro Crew, MCP, hooks or steering use is claimed at this stage.

Keep `.kiro` in the public repository. Review project artifacts for secrets before publishing; never commit credentials or unrelated session data.

## Accessibility and limits

The interface includes semantic controls, a list alternative to the visual map, visible focus, native confirmation dialogs and reduced-motion support. Cinematic motion is on for new palaces, with a persistent on/off control and an overriding OS reduced-motion preference. Existing saved motion preferences are preserved. Chrome checks covered review/reload, custom cards, backup restore, invalid import, 375px layout and reduced motion. See DEVLOG.md for tested behavior and remaining verification limits; no cross-browser or screen-reader certification is claimed.

The first release is browser-local. It does not promise offline reloading, collaboration, AI-generated questions or verified learning outcomes. Imports are limited to 2 MB, packs to 10 and rooms to 500 per pack.

License: MIT.
