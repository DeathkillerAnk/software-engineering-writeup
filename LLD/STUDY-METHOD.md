# How to learn LLD fast (the method matters more than the syllabus)

You asked to reach a high level *in less time*. Time isn't the lever — **feedback per hour** is.
Most people learn slowly because they re-read and recognize ("yeah, I know Strategy") instead of
producing and getting corrected. This file is the engine. Use it on every section.

---

## The core loop: Build → Get torn apart → Refactor → Articulate

```
   ┌─────────────────────────────────────────────────────┐
   │  1. BUILD     implement from scratch, no reference    │
   │  2. COMPARE   diff your design against a good one      │
   │  3. REFACTOR  fix the gap in small, tested steps       │
   │  4. ARTICULATE  write/say WHY the better version is    │
   │                 better — name the force                │
   └─────────────────────────────────────────────────────┘
```

Step 4 is the one everyone skips and it's where the learning consolidates. If you can't say *why*
in one sentence ("this decouples the policy from the mechanism so either can change alone"), you
don't own it yet.

---

## Five principles that multiply your rate

1. **Active recall beats re-reading.** After studying a pattern, close everything and rebuild it
   from a blank file. The struggle *is* the encoding. Re-reading feels productive and isn't.

2. **Spaced repetition for the vocabulary layer.** Patterns and refactorings are flashcard-able:
   front = a *force/smell* ("behavior must vary at runtime"), back = the *response* ("Strategy").
   Always card the force→pattern direction, never the name→definition direction — interviews and
   real life give you forces, not names.

3. **Learn forces, not catalogs.** There are ~23 GoF patterns but ~8 forces behind them (see
   `02-design-patterns`). Master the forces and you can *derive* most patterns and invent the ones
   that don't have names. This is the single biggest time-saver in the whole track.

4. **Read code far better than yours, weekly.** Pick one well-designed Java library and read how
   they solved a real problem. You absorb taste osmotically — naming, boundaries, what they chose
   *not* to abstract. Imitation is a legitimate and fast teacher; deviation comes later.

5. **Get real feedback.** A code review from someone better than you is worth ten tutorials.
   No reviewer available? Use these proxies, ranked:
   - Diff your solution against a reference implementation and explain every difference.
   - Come back to your own code after 2 weeks and review it cold — distance reveals smells.
   - Write the design doc *for someone else* and notice where you can't justify a choice.

---

## What "in depth" actually means (the depth ladder)

For any topic, push yourself up this ladder. Stopping at level 2 is why people plateau at "knows
the patterns."

| Level | You can… | Example: Observer pattern |
|-------|----------|---------------------------|
| 1 Recognize | name it when you see it | "that's Observer" |
| 2 Apply | use it when told to | implement a pub/sub when asked |
| 3 Derive | reach for it from the *force* | "state changes need fan-out → Observer" |
| 4 Critique | name its costs and when to avoid it | "Observer hides control flow; memory leaks if you forget to unsubscribe; for 1 listener just call it directly" |
| 5 Trade off | choose it vs. alternatives out loud | "Observer vs. event bus vs. reactive streams here, because…" |

**Principal lives at 4 and 5.** Most material teaches only 1 and 2. Every drill in this track is
designed to drag you to 4 and 5 — that's what the "and write a case where it's overkill" prompts
are for.

---

## Weekly cadence (≈ 6–8 focused hours)

- **~60%** building & refactoring (the loop above). This is non-negotiable; it's where it sticks.
- **~20%** reading great code + the relevant section README/notes.
- **~10%** spaced-repetition review of the vocabulary layer.
- **~10%** writing: one short "why" note per concept you touched this week.

End every week by adding to that section's `notes.md`: **one force you now understand, one mistake
you made, one thing you'd do differently.** That file becomes your personal principal-level
playbook — and it's review gold before interviews.

---

## Anti-patterns in *learning* LLD (avoid these to save months)

- **Pattern-hammering:** forcing patterns into code to "practice them." Real code earns its
  patterns; over-applied patterns are a senior-level smell. Practice *restraint* too.
- **Tutorial loops:** watching/reading without building. Feels like progress, isn't.
- **Skipping the boring foundations** (`00`): `equals`/`hashCode`, immutability, and value semantics
  quietly cause more real bugs than any missing pattern.
- **Memorizing case-study solutions** for interviews. Interviewers probe your reasoning; a
  memorized parking-lot design collapses on the first "now make it support X." Learn the *method*
  (`05`), not the answers.
