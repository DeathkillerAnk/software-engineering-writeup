# Staff Engineer Interview Crash-Course — Core Java

> The **applied Java breadth** a staff/principal backend interview demands, plus interview framing —
> companion to the *internals* cheatsheet ([CHEATSHEET.md](CHEATSHEET.md), which covers GC, JIT, the
> JMM, class loading, etc.). Dense by design. ⚡ = gotcha interviewers probe. Targets **Java 21**.
> Spring/backend half: [../spring-boot/STAFF-INTERVIEW-CRASHCOURSE.md](../spring-boot/STAFF-INTERVIEW-CRASHCOURSE.md).

## How a staff interview differs (read first)

It's not "do you know X" — it's **judgment, trade-offs, failure modes, scale, and influence**. For
every answer add: *why*, *what it costs*, *when it breaks*, *what you'd do instead*, *how you'd verify*.
Typical loop: (1) coding/DS&A + clean code, (2) Java/JVM deep-dive, (3) Spring/backend design,
(4) **system design** (→ [../HLD/](../HLD/)), (5) behavioral/leadership (influence, mentoring, ambiguity).
The differentiator vs senior: you reason about *systems and teams*, name the trade-off variables, and
default to the *simplest thing that survives the next 5 changes*.

---

# Core Java (applied breadth)

**Functional & Streams** — functional interfaces: `Function`/`BiFunction`, `Predicate`, `Supplier`,
`Consumer`, `UnaryOperator`. Lambdas + method refs (`Type::method`). Stream pipeline =
**lazy intermediate** ops (`map`/`filter`/`flatMap`/`sorted`/`distinct`) + a **terminal** op that
triggers (`collect`/`reduce`/`forEach`/`findFirst`/`count`). Collectors: `groupingBy`,
`partitioningBy`, `toMap` (⚡ throws on duplicate keys — supply a merge fn), `joining`, `counting`,
`mapping`. ⚡ streams are **single-use**; ⚡ avoid **stateful lambdas** & side effects; ⚡ `peek` is for
debugging only. **Parallel streams** use the shared `ForkJoinPool.commonPool` → ⚡ don't use for blocking
I/O or in a request thread; good only for CPU-bound, large, splittable, side-effect-free work.

**Optional** — a **return type** for "maybe absent," not a field/param/collection element. Use
`map`/`flatMap`/`filter`/`orElseGet` (lazy) over `orElse` (eager); `orElseThrow`. ⚡ never `Optional.get()`
without `isPresent`; ⚡ don't wrap collections (return empty collection instead).

**Exceptions** — `Throwable` → `Error` (don't catch) + `Exception` → `RuntimeException` (unchecked).
**Checked** = recoverable, caller must handle; **unchecked** = programming errors. **try-with-resources**
(`AutoCloseable`) for cleanup + suppressed exceptions. ⚡ never swallow (`catch{}`); wrap with context;
prefer unchecked for most app code; custom exceptions carry domain meaning; don't use exceptions for
control flow (cost: `fillInStackTrace`).

**Generics applied** — bounded `<T extends Comparable<T>>`; **PECS** (Producer `extends`, Consumer
`super`); type tokens `Class<T>`. ⚡ erasure → no `new T[]`, no reified generic types at runtime.

**Equality & immutability** — `equals` contract (reflexive/symmetric/transitive/consistent) **+ matching
`hashCode`**; `Comparable` consistent with equals. **Immutability** = `final` class + `final` fields +
**defensive copies** of mutable in/out → thread-safe, cacheable, safe map keys. `record` = transparent
immutable carrier. ⚡ defensively copy `Date`/arrays/collections in getters & constructors.

**Date/Time (`java.time`)** — `Instant` (UTC timestamp) · `LocalDate`/`LocalDateTime` (no zone) ·
`ZonedDateTime`/`OffsetDateTime` (zoned) · `Duration` (time) / `Period` (dates). Immutable & thread-safe.
⚡ legacy `Date`/`Calendar` are mutable & broken — don't use. Store/transmit in **UTC** (`Instant`).

**Collections — choosing** — `ArrayList` (random access) vs `LinkedList` (rarely worth it) ;
`HashMap`/`LinkedHashMap` (insertion/access order)/`TreeMap` (sorted) ; `HashSet`/`TreeSet` ;
`ArrayDeque` (stack/queue, beats `Stack`/`LinkedList`) ; `PriorityQueue` (heap). **Concurrent**:
`ConcurrentHashMap`, `CopyOnWriteArrayList` (read-heavy), `BlockingQueue`. ⚡ **fail-fast** iterators
throw `ConcurrentModificationException` on structural change (even single-threaded — use `Iterator.remove`
or `removeIf`); concurrent collections are **fail-safe**.

**Concurrency utilities (applied)** — see [CHEATSHEET.md](CHEATSHEET.md) for the JMM/locks *why*; here's *what to use*:
- **`ExecutorService`** / `ThreadPoolExecutor(core, max, keepAlive, queue, rejectionPolicy)`. Queue choice
  matters: bounded (backpressure) vs unbounded (⚡ OOM risk). Rejection: `AbortPolicy` (default, throws),
  `CallerRunsPolicy` (backpressure), `Discard`/`DiscardOldest`. ⚡ avoid `Executors.newCachedThreadPool`
  (unbounded threads) & `newFixedThreadPool` with unbounded queue in prod — size deliberately.
- **`CompletableFuture`** — async composition: `supplyAsync`, `thenApply` (sync transform) /
  `thenCompose` (flatMap async) / `thenCombine` (zip two) / `allOf`/`anyOf`; `exceptionally`/`handle`
  for errors. ⚡ pass an explicit executor (default = commonPool); ⚡ `get()` blocks.
- **Coordination**: `CountDownLatch` (one-shot wait-for-N), `CyclicBarrier` (reusable rendezvous),
  `Semaphore` (permits), `Phaser`. **`ThreadLocal`** for per-thread context — ⚡ **leaks** in thread
  pools (always `remove()` in a `finally`); for virtual threads prefer `ScopedValue`.
- **Atomics vs synchronized vs Lock**: atomics (lock-free single var), `synchronized` (simple mutual
  exclusion), `ReentrantLock` (tryLock/timeout/fairness/interruptible), `ReadWriteLock`/`StampedLock`.
- **Hazards**: deadlock (fix: lock ordering, `tryLock` w/ timeout), livelock, starvation. Producer-
  consumer via `BlockingQueue`. ⚡ prefer **immutability + confinement + concurrent collections** over locks.
- **Virtual threads (21)**: thread-per-request again; don't pool; watch **pinning** (`synchronized`).

**I/O & serialization** — `java.nio.file` (`Path`/`Files`), buffered streams, `try-with-resources`.
⚡ **Java `Serializable` is a security & coupling hazard** (RCE gadget chains, brittle `serialVersionUID`)
— prefer JSON (Jackson) / protobuf / Avro for persistence & wire; `transient` excludes fields.

**JVM in interviews** (depth → [CHEATSHEET.md](CHEATSHEET.md)) — size heap (`-Xms`=`-Xmx`), pick a
collector (G1 default; ZGC for low pause), read an **OOM** (`heap space` = leak/undersized;
`Metaspace` = classloader leak; `unable to create native thread` = too many threads), take a **thread
dump** (`jstack`) to find deadlocks/contention, a **heap dump** (`jmap`+MAT) to find leaks (dominator
tree; usual culprit = a static/`ThreadLocal`/cache collection). "App slow over time" → GC log,
code-cache, leaks.

**Design patterns** (quick recall; depth → [../LLD/](../LLD/)) — Strategy, Factory, Builder, Adapter,
Decorator, Observer, Template Method, Proxy, Singleton (⚡ avoid mutable global state). Spring *is*
patterns: Factory (container), Proxy (AOP), Template (`JdbcTemplate`), Strategy (`HandlerMapping`).

---

# Staff-level meta (the real differentiator)

- **Trade-offs, not answers.** "It depends — on *these* variables": latency vs throughput vs
  consistency vs cost vs team familiarity. Name them; give a default and when you'd revisit.
- **Failure-first.** Assume every dependency fails: timeouts, retries (+idempotency), circuit breakers,
  bulkheads, graceful degradation, blast-radius containment.
- **Idempotency & exactly-once** — "exactly-once *delivery* is a myth; exactly-once *processing* via
  idempotency + dedup is achievable."
- **Evolutionary architecture** — migrate running systems with zero downtime (expand/contract,
  strangler fig, feature flags); one-way vs two-way doors.
- **Influence (staff = leverage, not output)** — code review that levels people up, **ADRs** for
  decisions, mentoring, choosing battles, making the team faster. Behavioral: ownership, ambiguity,
  conflict, driving alignment.
- **Restraint** — the senior-most move is often *not* adding a framework/abstraction, *not* optimizing
  before measuring.

---

# Rapid-fire question bank — Java/JVM (what they're *really* testing)

- *“`HashMap` internals / what happens on collision & resize?”* → buckets, load factor 0.75, treeify@8 → O(log n); bad `hashCode`.
- *“`==` vs `equals`, equals/hashCode contract?”* → identity vs value; agree or hash collections break.
- *“`volatile` vs `synchronized`; is `i++` atomic?”* → visibility/ordering vs mutual exclusion; no, RMW race → `AtomicInteger`/lock.
- *“How does GC work / why a pause?”* → reachability, generational copying, minor vs full; allocation rate is the lever.
- *“`final` vs finally vs finalize”* / *“why is finalize dead?”* → Cleaner/try-with-resources.
- *“fail-fast vs fail-safe iterator?”* / *“ConcurrentModificationException?”*
- *“Checked vs unchecked; when each?”*
- *“Stream vs parallel stream; when not parallel?”* → commonPool, blocking, small N.
- *“Diagnose a memory leak / a deadlock in prod.”* → heap dump+dominators / thread dump+lock graph.
- *“String pool / immutability / `==` on strings.”*
- *“Comparator vs Comparable; sort stability.”*
- *“Virtual threads vs reactive — when each?”*
- *“ExecutorService sizing & rejection policies?”* → CPU vs IO bound; bounded queue + CallerRuns for backpressure.
- *“CompletableFuture composition & error handling?”* → thenCompose/thenCombine/allOf; exceptionally/handle; explicit executor.

> Drill any fuzzy answer in the full chapters + animations under [this track](README.md). Internals
> recall: [CHEATSHEET.md](CHEATSHEET.md). Spring/backend interview half:
> [../spring-boot/STAFF-INTERVIEW-CRASHCOURSE.md](../spring-boot/STAFF-INTERVIEW-CRASHCOURSE.md).
> System design: [../HLD/](../HLD/) · OOP/clean design: [../LLD/](../LLD/).
