# Development record

## November 21–22, 2026 — new project and implementation

Codex prepared the SuccinateWorld product brief and submission checklist. Kiro IDE 1.5.11 was installed from the official source and authenticated. The real Kiro Spec workflow generated requirements, design and task documents under `.kiro/specs/succinate-memoryward/`. Review corrected inflated session-count semantics, ambiguous room lighting, misleading SM-2 terminology, storage recovery and import bounds.

The Spec task runner repeatedly paused on redundant folder commands. It was stopped; Kiro Default coding mode then wrote the scheduler, room-state computation, validator, store, sample-state factory and five core test files. Codex wrote the interface/controller, icon, CSS, build/preview scripts, review transaction and integration regressions.

Integration review found real failures: non-string IDs passed regex coercion, arbitrary due dates were accepted, unsafe timestamps were not rejected, and some generated test fixtures were invalid. Codex hardened the modules, fixed the fixtures and replaced a copied validation test with calls to the actual validator. Ten targeted integrity tests passed after initially exposing nine failures.

Observed Chrome UI checks: recall before reveal; real Remembered rating lights one room and reduces due count from ten to nine; reload retains one review and one session; custom pack/card creation; backup download containing two packs, eleven rooms and one session; invalid-version import rejection; valid backup confirmation and restore. These figures are test data, not user adoption metrics.

Production build was inspected at 375px wide in Chrome responsive mode. System reduced-motion emulation overrides enabled ambient motion and disables the toggle. Text contrast calculations checked primary, muted, button and error combinations. Native dialog keyboard testing exposed focus escaping to browser controls; explicit Tab wrapping was added afterward. Final focus-wrap recheck remains pending.

No Safari, Firefox or screen-reader certification is claimed. No Kiro Crew, MCP, hooks or steering use is claimed. The public demo must show the actual working application; promotional graphics alone do not satisfy it.

## November 25, 2026 — publication resumed

Re-ran `node --test --test-reporter=dot`: all 99 tests passed. Re-ran `node scripts/build.js`: static production build succeeded. The public GitHub branch still held only its initial license commit; the interrupted browser upload had not been committed. Publication resumed through the newly available GitHub connector.

Sites project identity remains in `.openai/hosting.json`; its source connection previously failed. Hosting and hackathon submission are not complete until a deployment and final submission receipt are verified.
