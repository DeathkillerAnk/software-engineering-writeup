# LLD Design Doc — <Component/Feature name>

> Keep it short. A design doc that nobody reads is worthless; one page that aligns a team is gold.
> The point is the **decision and its trade-offs**, not exhaustive detail. (Pairs with the ADR
> tooling in the `engineering:architecture` skill for bigger decisions.)

**Author:** ___  **Date:** ___  **Status:** Draft / Reviewed / Decided  **Reviewers:** ___

## 1. Problem
What are we solving, in 2–3 sentences? Who feels the pain today?

## 2. Context & constraints
- Existing code/systems this touches:
- Non-negotiables (deadline, scale, tech we must use, backward-compat):
- Explicitly **out of scope**:

## 3. Options considered
| Option | How it works (1 line) | Pros | Cons / cost |
|--------|-----------------------|------|-------------|
| A — ___ | | | |
| B — ___ | | | |
| C — do nothing / status quo | | | |

> List 2–3 *real* options. "Do nothing" is always a valid baseline to compare against.

## 4. Decision
We chose **___** because **___**.
The single biggest trade-off we're accepting: **___**.

## 5. Consequences
- What gets easier: ___
- What gets harder / what we're betting against: ___
- New seams/interfaces introduced (and *why here*): ___

## 6. Risks & rollback
- Top risk: ___ → mitigation: ___
- How we'd back this out if it's wrong: ___

## 7. Revisit-if
This decision should be reconsidered if: ___ (e.g. "we add a 3rd payment provider", "QPS > 10k").

---
*Checklist before sharing:* Can a teammate act on this without asking me questions? Did I name the
cost of being wrong? Did I justify every new abstraction, or did I add one "just in case"?
