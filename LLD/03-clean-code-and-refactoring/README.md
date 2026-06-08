# 03 — Clean Code, Refactoring & Testing for Design

> Design isn't a thing you do once up front — it's something you *maintain* through continuous,
> small, safe improvements. This section is the daily craft: naming, killing smells, refactoring
> under a test net, and designing code that's testable in the first place. Tests and design are the
> same conversation: **hard-to-test code is badly-designed code.**

## Learning objectives
By the end you can:
- Name things so the code reads like prose and comments become mostly unnecessary.
- Recognize the common **code smells** on sight and name the refactoring that removes each.
- Refactor a large messy method into clean, tested units in **small, behavior-preserving steps**.
- Write tests that pin behavior and that *pressure your design toward decoupling* (DI, seams).

## Topic checklist
- [ ] **Naming** — intention-revealing names; the cost of a bad name compounds across every reader.
- [ ] **Functions** — small, one level of abstraction, few arguments, no boolean flags, command/query separation.
- [ ] **Comments** — why, not what; delete comments that just restate code; the best comment is a better name.
- [ ] **Code smells** (Fowler's list): Long Method, Large Class, Long Parameter List, Feature Envy, Data Clumps, Primitive Obsession, Shotgun Surgery, Divergent Change, Switch Statements, Message Chains.
- [ ] **Refactoring catalog** — Extract Method/Class, Inline, Rename, Move, Replace Conditional with Polymorphism, Introduce Parameter Object, Replace Temp with Query, Encapsulate Field/Collection.
- [ ] **Refactoring discipline** — small steps, green tests between each; never refactor + add features in the same commit.
- [ ] **Testing for design** — unit vs. integration; the test pyramid; AAA (Arrange-Act-Assert); FIRST principles.
- [ ] **Test doubles** — dummy/stub/spy/mock/fake; mock *roles, not objects*; don't over-mock (a sign of high coupling).
- [ ] **Dependency Injection** — constructor injection as the default; DI as the practical form of DIP; why `new` inside business logic hurts testability.
- [ ] **TDD** — red/green/refactor as a *design* tool (tests-first surfaces awkward APIs before you commit to them).

## The principal-level insight
**The pain you feel writing a test is a design review the code is giving you for free.** Need to
mock five things to test one method? That method has five dependencies — too much coupling. Can't
test a branch without spinning up a database? Your policy and your I/O are tangled; pull them apart.
Principals don't experience testing and design as separate activities — **listening to test pain is
how they find design flaws early, while they're cheap to fix.** Likewise, refactoring isn't a
"cleanup project you get time for later"; it's the continuous act that keeps the cost of the *next*
change low. The teams that "don't have time to refactor" are the ones paying compound interest on
mess forever.

## Drills (build these)
1. Take a 200–400 line "god method" (real code, or generate one). Get it under characterization tests *first*, then Extract Method/Class in small green steps. Commit after each step so you can see the staircase.
2. Find a class that's painful to unit-test. Diagnose *why* (hidden `new`, static call, mixed I/O), then refactor with constructor injection until it's trivially testable.
3. Pick three smells from the list, find a real instance of each, and apply the matching refactoring.

## Interview lens
Machine-coding rounds are *judged on clean code under time pressure*, not just on "does it run."
Good names, small methods, dependencies injected (so the grader sees testability), and a couple of
real tests will out-score a sprawling correct-but-unreadable solution. If you finish early, the
highest-value move is almost always to *refactor for readability and add a test* — not to add a feature.

> Next: clean code in the small; now model the *domain* in the large — and keep it correct under threads → [`04`](../04-domain-modeling-and-concurrency/).
