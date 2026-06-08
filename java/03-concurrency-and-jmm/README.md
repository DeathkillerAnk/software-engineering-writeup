# Part 3 · Concurrency & the Java Memory Model

> The hardest internals in the track, and exactly what separates senior from principal. Most
> engineers use concurrency by recipe ("add `synchronized` to be safe"). You're going to reason
> about it from the **memory model** — the actual contract. [← curriculum index](../README.md)

**Slow down here.** This is the one part where reading without the experiments will quietly leave
you with a wrong model — and wrong models in concurrency produce bugs that survive every test run
and surface once a quarter in production.

---

## Learning objectives — what "I know this" actually means

By the end of this part you can, **from memory and out loud**:

- Describe what a platform thread *is* (its relationship to an OS thread) and what one costs in
  memory and scheduling.
- Define **happens-before** and list the edges that establish it (program order, monitor
  lock/unlock, `volatile` write/read, `final`-field freeze, thread start/join).
- State precisely what `volatile` guarantees and what it does *not*; explain the `final`-field
  publication guarantee.
- Explain how a data race can produce a result no interleaving seems to allow (reordering), and
  identify which races are benign vs fatal.
- Walk a `synchronized` lock from uncontended (CAS, lightweight) to contended (inflated, heavyweight
  OS monitor), and say where the cost is.
- Explain how AQS powers `ReentrantLock`, `Semaphore`, and `CountDownLatch` with one mechanism, and
  what CAS and the ABA problem are.
- Explain what a virtual thread is, what mount/unmount and a carrier thread are, and what **pinning**
  is and why it's the bug to hunt.

## Topic checklist

- [ ] **15 · Threads & the OS** — platform threads as thin wrappers over OS threads; thread states
      and the scheduler; stack memory per thread; context-switch cost; why "just add threads" stops
      scaling.
- [ ] **16 · The Java Memory Model** — the *why* (compilers and CPUs reorder; caches make writes
      invisible); happens-before as the unifying contract; `volatile` (visibility + ordering, **not**
      atomicity of compound ops); `final`-field semantics; data races; the `synchronized`/`volatile`/
      `j.u.c.` guarantees expressed in happens-before.
- [ ] **17 · Locks & Synchronization Internals** — object monitors; the mark word's lock bits (from
      Part 1); lightweight (CAS) → inflated (heavyweight, OS mutex) locking; `wait`/`notify`/
      `notifyAll` mechanics & the wait set; *(note: biased locking was removed — don't repeat the folklore)*.
- [ ] **18 · `java.util.concurrent`** — `AbstractQueuedSynchronizer` (the CLH queue that powers most
      of j.u.c.); CAS, the atomics (`AtomicInteger`, `LongAdder`), the ABA problem; `ConcurrentHashMap`;
      `ReentrantLock`/`ReadWriteLock`/`StampedLock`; executors, thread pools, and sizing them.
- [ ] **19 · Virtual Threads & Structured Concurrency (Project Loom)** — continuations; carrier
      threads; mount/unmount on blocking; pinning (and its causes: `synchronized`, native frames);
      structured concurrency (`StructuredTaskScope`); when virtual threads change your architecture.

## The principal-level insight

**`synchronized` and `volatile` are not about "locking" — they're about *publishing* memory across
threads, and happens-before is the only thing that exists.** Juniors think in terms of mutual
exclusion ("one thread at a time"). The deeper truth is that without a happens-before edge, one
thread's writes are *not guaranteed to ever be visible* to another — the CPU caches them, the
compiler reorders them, and your reader can see stale or impossible values even with no apparent
race. A principal reasons in edges: "this write happens-before that read *because* of the lock
release/acquire, therefore the value is visible." Get this and concurrency stops being voodoo;
miss it and you'll write code that's correct on your laptop and wrong on a 64-core server. Virtual
threads then change the *cost model* (blocking becomes cheap) without changing this contract — so
the model you build here carries straight into Loom.

## Drills (build, don't just read)

1. **Reproduce a visibility bug.** A reader thread loops on a non-`volatile` `boolean stop` that a
   writer flips. With the JIT warm, the reader may *never* see the change. Make it `volatile`; it
   does. Explain the happens-before edge you just added.
2. **Watch a lock inflate.** Microbenchmark an uncontended `synchronized` block, then hammer it from
   many threads. Observe the cost jump as the lock inflates to a heavyweight OS monitor.
3. **Read AQS.** Open `AbstractQueuedSynchronizer.java` and trace one `acquire`/`release`. Then map
   how `ReentrantLock`, `CountDownLatch`, and `Semaphore` each use it. One mechanism, three tools.
4. **`LongAdder` vs `AtomicLong` under contention.** Benchmark both with many threads incrementing.
   Explain why `LongAdder` wins (striping to avoid the single CAS hot spot).
5. **100k virtual threads, then pin one.** Run 100,000 virtual threads doing blocking I/O on a few
   carriers — watch it work. Then wrap the blocking call in `synchronized` to cause **pinning** and
   detect it with `-Djdk.tracePinnedThreads=full`. Feel the difference.

## Interview lens

This is the deepest well in staff/principal Java interviews. Probes: *"What does `volatile`
guarantee — and not?"*, *"Is `i++` atomic? Why not, and how do you fix it?"*, *"Explain
happens-before,"* *"Double-checked locking — why was it broken before `volatile`, and is it fine
now?"*, *"What's a virtual thread and when would you use one over a thread pool?"*, *"What is
pinning?"* The discriminator is whether you reason from the **memory model** (visibility, ordering,
happens-before) or just pattern-match keywords. The former reads as principal; the latter as
"memorized the concurrency interview answers."

## Visualizations

See [`visualizations/`](visualizations/): memory reordering you can shuffle within the rules (and a
`volatile` edge forbidding the bad result), lock inflation lightweight→heavyweight, the AQS queue
parking and unparking threads, and virtual threads mounting/unmounting/pinning on carriers. These
are the hardest ideas in the track to picture — and the ones that benefit most from motion. Catalog
in [VISUALIZATIONS.md](../VISUALIZATIONS.md).
