# 06 — Principal Skills

> Everything before this gets you to *strong senior* — code that's correct, clean, and extensible.
> This section is the difference between that and **principal**, and it is the part you cannot
> finish in 12 weeks. It's developed across many real projects, mostly through *judgment* and
> *influence* — the multiplier skills. Treat this README as a lifelong checklist, not a course.

## What actually separates principal from senior
A senior makes good designs. **A principal makes good designs *cheaply, repeatably, and through
other people* — and is trusted to do it where the requirements are ambiguous and the stakes are
high.** The code is table stakes; the differentiators are below.

## The skill checklist (revisit on every real project)
- [ ] **Trade-off articulation** — for any decision, state the options, the forces, the cost of each, and *why this one*. "It depends" is only senior if you then say *on what*. This is the #1 visible principal trait.
- [ ] **Designing for the change you can't see** — building seams that make likely future changes cheap, *without* over-engineering for changes that won't come. Living in the YAGNI ↔ OCP tension (`01`) with good instincts.
- [ ] **Evolving a design without a rewrite** — strangler-fig refactors, backward-compatible API change, migrating a live system in small safe steps. Principals rarely get a greenfield; they improve the running thing.
- [ ] **API & contract design** — designing the *boundary* of a component so it's hard to misuse, easy to evolve, and clearly documented (preconditions, errors, threading). The hardest interfaces to change are public ones — get them right.
- [ ] **Reading & navigating large unfamiliar codebases fast** — the real day-job skill. Find the seams, build a mental model, change safely without understanding everything.
- [ ] **Design reviews** — both giving and receiving. Asking the question that surfaces the hidden assumption. Reviewing *designs* (docs/diagrams) before code exists, when changes are free.
- [ ] **Writing LLD design docs** — a short doc: problem, constraints, options considered, decision, trade-offs, risks. (Use the HLD track's ADR/design-doc tooling — this is the same muscle at smaller scope.)
- [ ] **Knowing when to stop** — recognizing "good enough," shipping, and not gold-plating. Taste includes restraint.
- [ ] **Multiplying others** — mentoring, setting patterns the team adopts, writing the doc that prevents ten future mistakes, leaving code better-named than you found it. Impact measured through the team, not the commit.
- [ ] **Connecting LLD to HLD and to the business** — knowing when a class-level decision has system-level consequences (and vice-versa), and what the business actually needs vs. what's technically elegant.

## The principal-level insight
**Your job stops being "write the best code" and becomes "make the best decision *legible and
durable* for everyone who comes after."** A brilliant design only you understand is a liability; a
slightly-less-clever design the whole team can safely evolve is worth more. The compounding skill is
**taste** — the fast, mostly-correct intuition for "this is too much abstraction / this seam is in
the wrong place / this will hurt in six months" — and taste is *only* built by the build → feedback →
articulate loop (see STUDY-METHOD) run hundreds of times on real, consequential code. There is no
shortcut around the reps; there is only making each rep count more by always articulating the *why*.

## Drills / habits (ongoing, not one-and-done)
1. **Write one LLD design doc** for something you're building: options considered, decision, trade-offs, risks. Have someone poke holes in it.
2. **Review someone else's design** (PR or doc) and practice asking the one question that exposes a hidden assumption — not nitpicks.
3. **Do a "cold read"**: open an unfamiliar OSS module and, in 30 minutes, write down its core abstractions and where you'd add a feature. Check yourself against the docs.
4. **Keep a decisions journal** — every non-trivial design call you make, plus the outcome months later. Reviewing your *own* past calls against reality is the fastest way to build calibrated judgment.
5. **Teach one concept** from sections `00`–`05` to someone more junior. Teaching exposes the gaps in your own depth-level (STUDY-METHOD ladder).

## Interview lens
Senior+/staff/principal interviews are won on *reasoning*, not code volume. When asked to design
something, the candidates who stand out narrate trade-offs, ask what'll change, name what they're
*not* doing and why, and connect the class-level call to system and business impact. Every habit on
this page is directly what those rounds probe — and, not coincidentally, what makes you good at the
actual job.

> This is the end of the linear track and the start of the real work. Loop back through `00`–`05`
> on real projects, and let this section accrete notes for the rest of your career.
