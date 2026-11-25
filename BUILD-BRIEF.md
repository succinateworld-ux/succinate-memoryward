# Succinate MemoryWard

Prepared November 21, 2026. Status: genuine Kiro requirements, design and task plan have been generated and reviewed; implementation is in progress. No deployed app or completed submission has been verified.

## Product

A private, accessible memory palace for learners: turn a small set of study facts into rooms, practise recall without looking, compare against the source, and revisit weak facts. Rooms brighten as evidence of recall accumulates. The Halloween theme represents forgotten knowledge, not sick or distressed people.

Brand: SuccinateWorld. Target Kiroween category: Costume Contest, whose haunting interface should enhance app function. This is a new project, separate from StudyPass, NurseBridge and NurseQuest.

## Complete first release

1. Enter immediately using a built-in Nursing Foundations study pack with source references; no account, wallet, payment or external API required.
2. Create a pack using explicit question/answer pairs entered by the learner. Preserve the source answer; never claim that deterministic parsing understands arbitrary notes or generates reliable medical content.
3. Explore a keyboard-accessible room map, with a conventional list alternative.
4. Attempt a short recall challenge before revealing the source answer. Learners record Again, Hard or Remembered. Explain that these are self-assessments, not verified mastery.
5. Schedule the next review using a documented deterministic algorithm. Inject the clock in tests. Do not fabricate elapsed time or learning gains.
6. See real session counts, due reviews and self-assessment history, including empty states. Reload restores progress locally.
7. Export and import versioned JSON with validation; reset only after confirmation. State clearly that storage stays in this browser and can be lost if browser data is cleared.

## Design

An editorial midnight-purple world with warm ivory typography, spectral mint and amber accents. Architectural room silhouettes, lantern light and restrained particles should reinforce navigation. Motion responds to actions: enter a room, reveal a card, restore light and return to the map. Use transforms and opacity; respect prefers-reduced-motion. No flashing, mandatory animation waits, sound autoplay or motion on every surface. Readable contrast, visible focus, semantic controls, touch targets and mobile layouts are required.

## Build quality

Keep the initial app deployable as static assets with no secrets. Choose dependencies only after checking available tooling. Test scheduling, import validation, persistence and the full first-use/review/reload flow. Test keyboard operation, reduced motion, narrow screens and production build. Content is for general study practice; do not add clinical advice or real patient information.

## Genuine Kiro workflow

Open this fresh folder in Kiro. Ask Kiro to challenge this brief, generate requirements, design and implementation tasks, then implement the core learning loop. Commit the real root .kiro directory generated/used in that work. Add a relevant quality hook and steering only when actually used. Maintain an honest dated development log with actual feature use, decisions, checks and failures. Do not create fake transcripts or claim work performed by Codex was performed by Kiro.

## Demo acceptance script

Under three minutes of actual working app footage: open without login; complete a sample recall attempt; reveal the source; record assessment; show changed room/progress; create one custom card; reload to demonstrate persistence; briefly show actual Kiro specs and validation evidence. No fabricated metrics, payments or simulated integrations. Explain local-only limits.

## Next dependency

Kiro IDE 1.5.11 has been installed from its official source, authenticated and granted app access; the user completed workspace trust. The actual Spec workflow generated requirements.md, design.md and tasks.md under .kiro/specs/succinate-memoryward. Initial scaffold work was accepted. The Spec task runner repeatedly paused on redundant folder commands, so it was stopped and implementation resumed in Kiro Default coding mode using those reviewed specs. Do not claim Kiro hooks, steering, MCP, Crew, completed tests or finished implementation until actually performed.

Public repository created: https://github.com/succinateworld-ux/succinate-memoryward (MIT license; source publication pending).

Sites project reserved in .openai/hosting.json. Its source helper failed to connect to the hosting Git service. No Sites deployment has succeeded. Reuse the existing project identity if that publishing path becomes available; do not create another Site for this project.
