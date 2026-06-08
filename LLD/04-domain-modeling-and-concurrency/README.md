# 04 — Domain Modeling & Concurrency

> Two skills that separate people who *code* a feature from people who *model* a problem so the
> code almost writes itself — and stays correct when multiple threads touch it. This is where
> `00`–`03` combine into the way you carve reality into objects.

## Part A — Domain Modeling

### Learning objectives
- Translate fuzzy business language into types where **illegal states are unrepresentable**.
- Distinguish **Entities** (identity over time) from **Value Objects** (defined by their attributes).
- Identify **aggregates** and the invariants they protect, and route all changes through their root.
- Use a **Ubiquitous Language** so the code's names match the experts' words.

### Topic checklist
- [ ] Entity vs. Value Object vs. Service (when behavior belongs to none of the nouns).
- [ ] **Make illegal states unrepresentable** — encode rules in the type system, not in `if`s scattered across the code (use enums, sealed types, constructors that validate).
- [ ] Aggregates & aggregate roots; invariants that span multiple objects; transactional consistency boundaries.
- [ ] Anemic Domain Model anti-pattern — data with no behavior; logic leaking into "service" classes.
- [ ] Ubiquitous Language & bounded contexts (the LLD-relevant slice of DDD).
- [ ] Modeling state machines explicitly (sealed classes / enum + transitions) instead of boolean flags.

### The principal-level insight
**Push correctness into the type system and the compiler becomes your QA team.** A junior validates
with runtime `if (order.getStatus() == ...)` checks sprinkled everywhere; a principal designs an
`Order` whose API simply *cannot* be called in an invalid order — `ship()` doesn't exist on an
unpaid order because an unpaid order is a *different type*. The best domain model is one where the
wrong code doesn't compile and the right code reads like the domain expert talking. **Behavior lives
with the data it guards** — that's the cure for the anemic model.

## Part B — Concurrency in object design

### Learning objectives
- Reason about **shared mutable state** as the root of all concurrency bugs and design it away.
- Choose the right tool: immutability, confinement, `synchronized`, `java.util.concurrent`.
- Spot data races, deadlocks, and visibility bugs in a class design *before* they ship.

### Topic checklist
- [ ] The core rule: **no shared mutable state, no concurrency bug.** Immutability is the first-line defense (ties back to `00`).
- [ ] Java Memory Model essentials: visibility, `volatile`, happens-before, why a missing `synchronized` causes "impossible" bugs.
- [ ] `synchronized`, intrinsic locks, `ReentrantLock`, lock ordering to avoid deadlock.
- [ ] `java.util.concurrent`: `ConcurrentHashMap`, `BlockingQueue`, `AtomicInteger`/CAS, `ExecutorService`, `CompletableFuture`.
- [ ] Thread-confinement & the producer/consumer pattern; designing a thread-safe class (document the policy!).
- [ ] When *not* to add concurrency — it's a cost; many "thread-safe" designs are simpler as single-threaded + a queue.

### The principal-level insight
**Thread-safety is a property of a design, not a keyword you sprinkle on later.** Adding
`synchronized` to a class that was never designed for sharing usually produces something both slow
*and* still wrong. Principals decide the concurrency strategy at design time — "this object is
immutable so it's free to share," "this one is confined to one thread," "this one's the single
synchronized choke point" — and **write that policy down**. The cheapest concurrent object is the one
that has no mutable state to protect.

## Drills (build these)
1. Model a coffee-shop `Order` lifecycle (new → paid → preparing → ready → collected) so that calling a method in the wrong state won't compile (sealed types / state objects). No boolean flags allowed.
2. Find an anemic model (a class of only getters/setters with logic in a `*Service`) and move the behavior back onto the entity.
3. Build a bounded in-memory cache, then make it thread-safe two ways (a `synchronized` wrapper vs. `ConcurrentHashMap`), and measure/explain the difference.

## Interview lens
"Is this thread-safe?" and "two users do X at the same time — what happens?" are standard probes in
machine-coding rounds (rate limiters, in-memory stores, booking systems). Stating your concurrency
strategy unprompted ("the store is a `ConcurrentHashMap`; the counter is an `AtomicInteger`; entities
are immutable so they're safe to share") is a strong seniority signal. Good domain modeling early
also makes the rest of the round faster because the objects carry their own rules.

> Next: put `00`–`04` together under the clock → [`05`](../05-machine-coding/).
