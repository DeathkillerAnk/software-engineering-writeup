# 01 — Design Principles

> Principles are *forces*, not rules. Every one of them can be over-applied into a worse design.
> The skill is feeling the tension and knowing how far to push. This section is where "in less
> time" pays off most — master the forces here and patterns (`02`) become obvious consequences.

## Learning objectives
By the end you can:
- Diagnose a class's **coupling** and **cohesion** by reading it, and say which way to push.
- State each SOLID principle *as a force*, give a real violation, and give a case where applying it would be **overkill**.
- Apply the smaller principles (DRY, KISS, YAGNI, Demeter, Tell-Don't-Ask) without turning them into dogma.
- Use the one meta-principle that generates most of the rest: **encapsulate what varies.**

## Topic checklist
- [ ] **Coupling & cohesion** — the two master forces. Afferent/efferent coupling; the cost of a change rippling outward.
- [ ] **Encapsulate what varies** — find the axis of change and put a seam there. (This *is* most of design.)
- [ ] **Program to an interface, not an implementation** — and when a concrete type is genuinely fine.
- [ ] **SOLID**, each as a force *and* its trap:
  - **S**RP — "one reason to change" (the trap: shattering cohesive code into anemic fragments).
  - **O**CP — open to extension, closed to modification (the trap: speculative abstraction for change that never comes).
  - **L**SP — subtypes must honor the supertype's contract (the classic Rectangle/Square; prefer composition).
  - **I**SP — many small interfaces over one fat one (the trap: interface explosion).
  - **D**IP — depend on abstractions; high-level policy shouldn't import low-level detail (gateway to DI).
- [ ] **DRY** — duplication of *knowledge*, not of *text* (two things that look alike but change for different reasons are NOT duplication).
- [ ] **KISS / YAGNI** — the antidote to the above being weaponized; the cost of premature abstraction.
- [ ] **Law of Demeter** — don't reach through objects (`a.getB().getC().doThing()`); Tell-Don't-Ask; Command-Query Separation.

## The principal-level insight
**Every principle is a loan against complexity, and abstraction is not free.** An interface you add
"for flexibility" is a cost paid *now* (indirection, more files, harder to follow) against a benefit
that may *never* arrive. Juniors under-abstract and ship rigid code; mid-levels over-abstract and
ship a maze; **principals abstract exactly at the seams where change has actually shown up, and
leave the rest concrete.** The wisdom is in YAGNI restraining SOLID — knowing that "duplicate it
until it hurts, then unify" usually beats guessing the abstraction early. *A Philosophy of Software
Design* calls the real enemy by its name: **complexity**, measured as how much you must hold in your
head to safely change something.

## Drills (build these)
1. Find a real class (yours or OSS) with low cohesion. State its multiple "reasons to change," split it, and write the one-sentence *why*.
2. Write the Rectangle/Square hierarchy, make it break LSP with a real test, then redesign it without inheritance.
3. Find a place where you'd be *tempted* to add an interface "for flexibility," and write the argument for NOT adding it yet (YAGNI). Practicing restraint is the drill.

## Interview lens
In machine coding, interviewers steer you with "what if the pricing rule changes?" or "what if we
add a new payment method?" — they are testing OCP/DIP intuition. The winning move is to put a seam
(an interface) exactly where they're hinting change will come, and *narrate the trade-off*: "I'll
make this an interface because the prompt suggests payment types will grow; I'm keeping the rest
concrete to stay simple." That sentence is a senior→principal signal.

> Next: the forces here crystallize into named, reusable solutions → [`02`](../02-design-patterns/).
