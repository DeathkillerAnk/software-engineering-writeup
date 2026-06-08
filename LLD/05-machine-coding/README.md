# 05 — Machine Coding & Case Studies

> Where `00`–`04` meet a 45–90 minute clock. The goal is **not** to memorize solutions — interviewers
> defeat memorization instantly with "now add X." The goal is a **repeatable method** that produces a
> clean, extensible, working design under time pressure, every time.

## Learning objectives
- Run a problem from prompt → working, tested, extensible code in a fixed time box.
- Drive the design with **requirements → entities → APIs → extensibility seams**, in that order.
- Defend every class and every abstraction out loud.
- Score your own solutions against a rubric so you improve between reps.

## The repeatable method (memorize this, not the answers)
1. **Clarify & scope (≈5 min)** — list functional requirements; *explicitly* cut what's out of scope. State assumptions. Ask "what's the expected scale / is this concurrent?"
2. **Identify entities & value objects (≈5 min)** — the nouns. Decide identity vs. value (`00`, `04`).
3. **Define the core APIs (≈5 min)** — the verbs, as interfaces. This is your skeleton; get sign-off before coding.
4. **Find the axis of change (≈2 min)** — where will requirements grow? Put a seam there (Strategy/Factory). Leave the rest concrete (`01`, `02`).
5. **Implement core happy path (bulk of time)** — clean names, small methods, DI, in-memory stores. Working > complete.
6. **Make it correct** — edge cases, validation pushed into the model, concurrency strategy if relevant.
7. **Test & narrate** — at least a couple of unit tests; talk through trade-offs as you go.
8. **Extend on demand** — when they say "now add Y," your seam should make it a small change. That's the whole point.

> Code working features over scaffolding everything. A running 70% beats an elegant 0%.

## Curriculum of case studies (build one per ~2 days; compare to a reference after)
Ordered roughly easy → hard. For each, do it cold, *then* diff against a good solution and write the gap.

- [ ] **Parking Lot** — the canonical one. Entities, strategy for pricing/spot-allocation, extensibility.
- [ ] **Vending Machine** — explicit State pattern (`04`); great for state-machine modeling.
- [ ] **Elevator / Lift system** — scheduling strategy, multiple cars, request queue.
- [ ] **LRU / LFU Cache** — data-structure design + thread-safety; very common.
- [ ] **Rate Limiter** — token bucket / sliding window; concurrency front and center.
- [ ] **Logging library** — Decorator/Chain for sinks & levels; Singleton-vs-DI discussion.
- [ ] **Splitwise / expense sharing** — non-trivial domain model; settlement algorithm.
- [ ] **Tic-Tac-Toe → Chess** — board modeling, rules as strategies, move validation.
- [ ] **BookMyShow / movie booking** — seat locking under concurrency (`04`); the hard part is the race.
- [ ] **Notification service** — Observer + Strategy (email/SMS/push) + retry/Chain.
- [ ] **Snake & Ladder / dice games** — quick rep for entities + game loop.
- [ ] **Stack Overflow / Twitter (LLD scope)** — bigger entity graph; bridges toward HLD.

## The scoring rubric (grade every rep 1–5)
| Dimension | What a 5 looks like |
|-----------|---------------------|
| Requirements & scope | Clarified, assumptions stated, scope explicitly cut |
| Object model | Right entities/VOs, invariants enforced, no anemic model |
| Extensibility | Seam exactly where change was hinted; "add X" is a small diff |
| Clean code | Good names, small methods, DI, no god class |
| Correctness | Happy path + key edge cases; concurrency addressed if relevant |
| Tests | A few meaningful unit tests, not just a `main` |
| Communication | Narrated trade-offs; defended each abstraction |

Track these scores in `notes.md` over time — the trend is your real progress signal.

## The principal-level insight
**Under time pressure, restraint scores higher than cleverness.** The candidates who fail are
usually the ones who *over-build* — five patterns and three layers for a problem that needed two
clean classes and one interface. A principal-level performance is *boringly clear*: the obvious
entities, one well-placed seam where the interviewer hinted growth, clean names, and a running
program — with the trade-offs spoken aloud. The interviewer is hiring the person they'd trust to
make these calls unsupervised; legibility of *reasoning* beats volume of *code*.

> Next: the meta-skills that turn strong LLD into principal-level impact → [`06`](../06-principal-skills/).
