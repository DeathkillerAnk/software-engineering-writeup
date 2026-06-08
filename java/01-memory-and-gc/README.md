# Part 1 · Memory & Garbage Collection

> The heart of the internals, and the part you'll reach for most in production. Where do objects
> live, how cheap is it to make one, and how does the JVM reclaim them without you noticing — until
> it does. [← curriculum index](../README.md)

This is the part that turns "Java manages memory for me" into "I know exactly what the GC just did
and why." It's also the **visual centerpiece** of the track — garbage collection is pure motion, so
lean on the animations here harder than anywhere else.

---

## Learning objectives — what "I know this" actually means

By the end of this part you can, **from memory and out loud**:

- Describe an object's real in-memory layout — header (mark word + klass pointer), fields, padding —
  and compute its size with compressed oops on, then confirm with JOL.
- Explain why allocation is *nearly free* (TLAB bump-pointer) and when escape analysis erases an
  allocation entirely.
- State the generational hypothesis and explain why a minor GC is cheap while a full GC is not, in
  terms of *live* objects, not dead ones.
- Place each collector — Serial, Parallel, G1, ZGC, Shenandoah — on the throughput-vs-pause spectrum,
  say what each pays for low pauses, and pick one for a given workload with reasons.
- Read a `-Xlog:gc*` log: find pause durations, promotion, allocation rate, and a full GC.
- Order the reference strengths, say who decides when each clears, and explain why `finalize()` is
  dead and what `Cleaner` does instead.

## Topic checklist

- [ ] **05 · Object Layout in Memory** — the object header (mark word: hash/age/lock bits; klass
      pointer); field reordering and alignment; 8-byte alignment & padding; compressed oops and the
      32 GB heap boundary; array headers; computing sizes with [JOL](https://github.com/openjdk/jol).
- [ ] **06 · Allocation & the Heap** — TLABs (thread-local allocation buffers) and bump-pointer
      allocation; the slow path; escape analysis → scalar replacement → stack allocation of the
      object that's "never born"; allocation rate as the real GC driver.
- [ ] **07 · GC Fundamentals** — GC roots; reachability and liveness; mark-sweep, mark-compact,
      copying; the generational hypothesis (most objects die young); young/old generations; minor vs
      major vs full GC; why a copying collector's cost scales with *live* set, not heap size.
- [ ] **08 · The Modern Collectors** — Serial (small heaps), Parallel (throughput), G1 (region-based,
      pause-target, the default), ZGC & Shenandoah (concurrent, sub-millisecond pauses, colored
      pointers / load barriers); the throughput–latency–footprint trilemma; reading and tuning each.
- [ ] **09 · Reference Types & Cleaners** — strong / soft / weak / phantom; `ReferenceQueue`;
      `WeakHashMap` and soft-reference caches and their pitfalls; why `finalize()` was deprecated for
      removal; `Cleaner` and `try-with-resources` as the real answer.

## The principal-level insight

**Allocation is cheap; reclamation is the cost — so the lever is allocation *rate*, not heap size.**
Most engineers tune the GC by growing the heap or copying flags from a blog. A principal knows the
GC's real workload is the *live* object graph it must trace and move, and that the dominant cost
driver is how fast you're creating garbage. Halving your allocation rate (kill the autoboxing,
reuse the buffer, let escape analysis stack-allocate) does more than any flag, because it directly
reduces how often and how hard the collector must run. "Make less garbage" beats "tune the
collector" almost every time — and it's a *code* change you can measure, not a config guess.

## Drills (build, don't just read)

1. **Size an object by hand, then check.** Predict the byte size of three classes (empty;
   `int`+`long`+`Object` ref; a small array) with compressed oops on. Confirm with JOL's
   `ClassLayout`. Reconcile every padding byte you missed.
2. **Watch allocation be free, then watch it cost.** Allocate a billion tiny short-lived objects in
   a loop under `-Xlog:gc*`. Note the GC frequency and pause. Now make them escape (store in a list)
   and watch promotion and full GCs appear.
3. **Catch escape analysis in the act.** Write a method that builds and discards an object; confirm
   (allocation profiler / `-XX:+PrintEscapeAnalysis`) that zero allocations happen. Then make it
   escape and watch the allocation reappear.
4. **A/B two collectors.** Run the same allocation-heavy workload under G1 and ZGC. Compare max
   pause and throughput from the logs. State which you'd ship and why.
5. **Make references clear.** Build a soft-reference cache and a `WeakHashMap`; force GC under memory
   pressure and observe exactly when entries vanish — and that *you* never control the timing.

## Interview lens

This is the most common "production Java" interview territory above mid-level: *"Your service has
1-second pause spikes — walk me through diagnosing it."* (GC log → which collector → allocation rate
→ promotion → code change or collector swap.) Also: *"What's in an object header?"*, *"Difference
between the four reference types and when you'd use a `WeakReference`,"* *"Why is `finalize()`
discouraged?"*, *"Soft vs weak for a cache?"* The principal signal is reaching for *allocation rate
and the live set* rather than "increase `-Xmx`."

## Visualizations

The richest set in the track — see [`visualizations/`](visualizations/): the object header bits,
TLAB allocation, the young-gen copy cycle, mark-sweep-compact, G1 region selection, and reference
strengths under GC pressure. Catalog and conventions in [VISUALIZATIONS.md](../VISUALIZATIONS.md).
