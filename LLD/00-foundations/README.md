# 00 — Foundations

> The unglamorous layer that quietly causes more production bugs than any missing design pattern.
> These are not Java trivia — they are *design tools*. Skipping this section is the most common
> reason senior engineers write subtly broken objects.

## Learning objectives
By the end you can:
- Decide *value semantics vs. reference semantics* for a type and implement it correctly.
- Write `equals`/`hashCode`/`compareTo` that obey their contracts, and explain what breaks when they don't.
- Default to immutability and justify when mutability is worth its cost.
- Choose **composition over inheritance** and explain the failure mode of getting it wrong.
- Read a class and instantly see its *encapsulation boundary* — what it protects and from whom.

## Topic checklist
- [ ] Objects vs. values: identity vs. equality; when two things are "the same."
- [ ] `equals`/`hashCode` contract; the consequences in `HashMap`/`HashSet`; symmetry/transitivity traps with inheritance.
- [ ] `Comparable` vs. `Comparator`; consistency of `compareTo` with `equals`.
- [ ] Immutability: `final`, defensive copies, unmodifiable collections, `record` (Java 16+) as value types.
- [ ] Encapsulation: access modifiers as *contracts*; never leak mutable internals (the "return the internal list" bug).
- [ ] Composition over inheritance; the fragile base class problem; `is-a` vs. `has-a` vs. `behaves-like`.
- [ ] Interfaces vs. abstract classes; default methods; programming to an interface.
- [ ] Generics & variance (`? extends` / `? super`, PECS) as a way to make APIs both flexible and safe.
- [ ] `null` as a design failure; `Optional` for *return types*; the Null Object pattern preview.
- [ ] Exceptions as part of an API contract: checked vs. unchecked, failing fast, not swallowing.

## The principal-level insight
**An object's whole job is to protect an invariant.** A class that exposes setters for every field
isn't an object — it's a struct with extra steps, and every caller now shares responsibility for
keeping it valid. Senior engineers ask "what fields does this have?"; principal engineers ask
**"what must always be true about this thing, and how do I make it impossible to violate?"**
Immutability and tight encapsulation are how you answer that — they move correctness from *every
call site* to *one constructor*.

## Drills (build these)
1. Implement an immutable `Money(amount, currency)` value type: correct `equals`/`hashCode`,
   `plus`/`minus` that reject mixed currencies, no way to construct an invalid instance. Write the tests.
2. Take a mutable `class ShoppingCart` that exposes `getItems()` returning its internal `List`.
   Find the bug a caller can cause; fix it two ways (defensive copy vs. unmodifiable view) and note the trade-off.
3. Build a small type two ways — once with inheritance, once with composition — and write down which change becomes painful in each.

## Interview lens
Machine-coding interviewers notice immediately when your entities have anemic getters/setters and
no invariants. Modeling a clean immutable value type and a well-encapsulated entity early in the
round signals seniority faster than any pattern. Expect "what happens if two of these are equal?"
and "is this thread-safe?" — both trace back here.

> Next: once your objects are sound, learn the forces that govern relationships *between* them → [`01`](../01-design-principles/).
