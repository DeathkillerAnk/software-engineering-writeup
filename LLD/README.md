# Low-Level Design (LLD) — A Principal-Track Curriculum

> Companion to the `HLD/` track. HLD answers *"how do the boxes talk?"* — services, data
> stores, queues, consistency. **LLD answers *"what happens inside one box?"*** — the classes,
> interfaces, and objects that make a single component correct, readable, testable, and cheap
> to change. Language for this track: **Java**. Goal: **real-world craft + interview machine-coding.**

---

## The honest framing (read this once, then re-read in 3 months)

Knowing design patterns does not make you a principal engineer. Plenty of people can recite the
Decorator pattern and still write code nobody can maintain. **Principal-level LLD is the ability
to look at a problem and choose the simplest design that will survive the next 5 changes you can't
yet see** — and to justify that choice out loud.

That skill decomposes into four things, in order of how much they matter:

1. **Forces & trade-offs** — *why* a design is good, not *what* it's called. Coupling, cohesion,
   what varies vs. what's stable, the cost of every abstraction. (Sections `00`, `01`)
2. **Vocabulary** — patterns and refactorings as a shared language so you can think and
   communicate fast. But always as *consequences of forces*, never as goals. (Sections `02`, `03`)
3. **Modeling** — turning a fuzzy domain into types that make illegal states unrepresentable,
   safely, even under concurrency. (Section `04`)
4. **Judgment & influence** — knowing when *not* to apply a pattern, evolving a design without a
   rewrite, and leveling up the people who read your code. (Sections `05`, `06`)

Most curricula spend 90% of their time on (2) because it's the most teachable. The leverage —
the "in less time" — is in (1) and (4). This track front-loads the forces and ends on judgment.

---

## The map

| #  | Section | What you walk away able to do |
|----|---------|-------------------------------|
| 00 | [Foundations](00-foundations/) | Use Java's type system, value/reference semantics, immutability, and `equals`/`hashCode` as *design tools*, not trivia. |
| 01 | [Design Principles](01-design-principles/) | Diagnose coupling/cohesion problems and apply SOLID *as forces* — including when each one is a trap. |
| 02 | [Design Patterns](02-design-patterns/) | Recognize the ~8 underlying forces, reach for the right GoF pattern reflexively, and *refuse* the wrong one. |
| 03 | [Clean Code & Refactoring](03-clean-code-and-refactoring/) | Name things well, kill code smells, refactor in safe small steps under test, and design for testability. |
| 04 | [Domain Modeling & Concurrency](04-domain-modeling-and-concurrency/) | Model a domain so bad states can't compile, and keep it correct under threads. |
| 05 | [Machine Coding & Case Studies](05-machine-coding/) | Solve 45–90 min LLD problems (parking lot, rate limiter, …) with a repeatable method and a scoring rubric. |
| 06 | [Principal Skills](06-principal-skills/) | Make and defend trade-offs, review designs, evolve systems, and write LLD docs that align a team. |

See **[STUDY-METHOD.md](STUDY-METHOD.md)** for *how* to learn this fast (it matters more than the order).

---

## Recommended sequence (~12 focused weeks, then lifelong)

This is a deliberate-practice plan, not a reading list. Each week ends with **something you built
and got feedback on**, not pages you highlighted.

| Week(s) | Focus | Deliverable |
|---------|-------|-------------|
| 1       | `00` Foundations | Implement an immutable `Money` value type with correct `equals`/`hashCode`; write its tests. |
| 2       | `01` Principles | Take one smelly class from a real repo, identify the SOLID violation, refactor it. |
| 3–5     | `02` Patterns | For each force, build a tiny example *and* write down a case where the pattern would be overkill. |
| 6–7     | `03` Clean code + refactoring + testing | Refactor a 300-line "god method" into tested, named units in small commits. |
| 8       | `04` Modeling + concurrency | Model a small domain (e.g. a coffee-shop order) with illegal states unrepresentable; make one part thread-safe. |
| 9–11    | `05` Machine coding | One full case study every ~2 days, timeboxed, then compared against a reference. |
| 12+     | `06` Principal skills | Write one LLD design doc; do one design review of someone else's code; repeat forever. |

You will not "finish" this. Sections `00`–`05` get you to *strong senior*. Section `06`, repeated
across many real projects, is the work of becoming principal.

---

## How to use a section

Every section folder has its own `README.md` with:
- **Learning objectives** — what "I know this" actually means.
- **Topic checklist** — the concrete list to cover.
- **The principal-level insight** — the non-obvious thing that separates senior from principal.
- **Drills** — small things to *build*, because reading isn't learning.
- **Interview lens** — how this shows up in machine-coding rounds.

Fill each section in as you go: add `notes.md`, code under `src/`, and an `examples/` folder.
The READMEs are the syllabus; your notes and code are the actual learning.

---

## Resources worth your time (quality over quantity)

- **Books:** *A Philosophy of Software Design* (Ousterhout) — the deepest small book on complexity;
  *Refactoring, 2nd ed.* (Fowler) — the catalog; *Effective Java, 3rd ed.* (Bloch) — Java-specific
  design wisdom; *Clean Code* (Martin) — read critically, not as gospel; *Designing Data-Intensive
  Applications* lives in the HLD track but informs LLD trade-offs.
- **Patterns reference:** *Design Patterns* (GoF) for definitions; refactoring.guru for fast recall.
- **Read real code:** the single most underrated technique. Pick a well-regarded OSS Java library
  (Guava, Caffeine, Spring Core) and read how *they* model things. Imitate, then deviate.
