# The 12-Week Java Internals Intensive

> A sequenced, milestone-driven plan to go from *writing Java* to *understanding what the JVM does
> with it* — at principal depth, in 3 months. Built for an intensive pace.
> [← back to the index](README.md) · Read [STUDY-METHOD.md](STUDY-METHOD.md) first — it's the engine.

## How this plan works

- **12 weeks, 7 parts.** Roughly 2–3 deep-dive chapters per week, plus one hands-on artifact and a
  steady diet of **experiments on a real JVM** (the heart of [the method](STUDY-METHOD.md)).
- **Each week has a checkpoint you must pass *out loud, from memory*.** Recognition ≠ recall. If you
  fail one, you found a gap — that's the point.
- **Every claim gets measured.** This track's superpower: you can prove what you learn. The
  hands-on items below are mostly "make the JVM show you the thing."
- **Set up your lab in Week 1.** Install `javap` (in the JDK), JOL, JMH, async-profiler, and learn
  `-Xlog:gc*` and `jcmd`. You'll use them every week. (See [STUDY-METHOD § lab equipment](STUDY-METHOD.md#your-lab-equipment-set-this-up-in-week-1-use-it-forever).)

### Companion books & sources (read in parallel)
The single best pairing per phase. Full annotated list lands in Part 6 · the Reading List.

| Source | Best for |
|---|---|
| ***Optimizing Java*** (Evans, Gough, Newland) | The whole-JVM companion: classfiles, JIT, GC, microbenchmarking. The closest book to this track. |
| ***Java Performance, 2nd ed.*** (Scott Oaks) | JIT/GC tuning and JFR in practice (Parts 1, 2, 5). |
| ***Java Concurrency in Practice*** (Goetz et al.) | The concurrency & memory-model bible (Part 3). Still definitive. |
| ***The Well-Grounded Java Developer, 2nd ed.*** (Evans, Clark, Verburg) | Bytecode, class loading, and modern Java features (Parts 0, 4). |
| ***Effective Java, 3rd ed.*** (Bloch) | The language-design wisdom (Part 4). Already core to the LLD track. |
| **JVMS & JLS** (the specs) | The primary source. Learn to find the one paragraph you need (Part 6). |

### Suggested daily cadence (intensive, ~2–3 focused hours)

| Block | Time | What |
|---|---|---|
| **Warm-up recall** | 15 min | Answer yesterday's Self-Check from memory; redraw yesterday's diagram. Highest-ROI 15 minutes you'll spend. |
| **New material** | 50–70 min | Read the day's chapter using *predict → read → self-check*. |
| **Lab** | 40–60 min | Run the [Claim→Predict→Measure→Reconcile loop](STUDY-METHOD.md#the-core-loop-claim--predict--measure--reconcile) on what you just read. Don't believe it — measure it. |
| **Weekly (pick a day)** | 45 min | Build the week's artifact, *or* explain the week's hardest mechanism out loud to a rubber duck. |

> **The single most important habit:** end every experiment by writing the one-sentence
> reconciliation — "I predicted X, the JVM did Y, because Z." That sentence is the learning.

---

## Phase 1 · The Platform & Mental Model (Weeks 1–2) → Part 0

You can't reason about GC, the JIT, or the memory model without knowing what bytecode is, how it's
loaded, and where things live in memory. Resist skipping this — every later "why" bottoms out here.

### Week 1 — From source to running bytecode
- **Read:** 01 · The Java Platform & Execution Pipeline, 02 · The Class File & Bytecode
- **Companion:** *Well-Grounded Java Developer* Ch. on classfiles & bytecode
- **Master these questions:**
  - Trace a method from `.java` to native code: what does `javac` do, what does the interpreter do, what does the JIT do, and *when*?
  - What's in a `.class` file? What is the constant pool and why does almost every instruction point into it?
  - Why is the JVM a *stack* machine? Walk the operand stack through `int x = a + b * c;`.
- **Hands-on:** Write a 10-line class, run `javap -c -p -v` on it, and annotate **every** bytecode instruction. Predict the bytecode *before* you look.
- ✅ **Checkpoint:** From memory, draw the source→bytecode→interpret→JIT→native pipeline and explain why "write once, run anywhere" is a property of the *runtime*, not the compiler.

### Week 2 — Loading, linking, and the memory map
- **Read:** 03 · Class Loading, Linking & Initialization, 04 · JVM Runtime Data Areas
- **Companion:** JVMS Ch. 5 (Loading, Linking, Initializing) — skim, find the lifecycle
- **Master these questions:**
  - List the steps from "class referenced" to "class usable": load → verify → prepare → resolve → initialize. What happens in each?
  - Explain the parent-delegation model and *one* concrete bug it prevents.
  - Exactly when does a class's `<clinit>` (static initializer) run? Name the trigger conditions.
  - Draw the runtime data areas. Which are per-thread, which are shared? Which can throw `StackOverflowError` vs `OutOfMemoryError`?
- **Hands-on:** Write a custom `ClassLoader` that loads a class from a byte array. Then deliberately blow each region: cause a `StackOverflowError`, a heap OOM, and a metaspace OOM — and read the error each one gives.
- ✅ **Checkpoint:** Recite the class-loading lifecycle and the memory map from memory; for a given line of code, say which data area each value lives in.

---

## Phase 2 · Memory & Garbage Collection (Weeks 3–4) → Part 1

The heart of the internals — and the part you'll use most in production. This is also the visual
centerpiece: lean hard on the animations here.

### Week 3 — Objects and allocation
- **Read:** 05 · Object Layout in Memory, 06 · Allocation & the Heap
- **Companion:** *Optimizing Java* (object layout, allocation); Shipilëv's JOL examples
- **Master these questions:**
  - What's in an object header? What is the mark word, what is the klass pointer, and what do compressed oops save you?
  - Why is allocation in a tight loop nearly free? Explain TLABs and bump-pointer allocation.
  - What is escape analysis, and what does scalar replacement do to an object that never escapes?
- **Hands-on:** Use JOL to print the layout of three classes (an empty object, one with mixed-type fields, a boxed `Long[]`). Predict each size first, then reconcile alignment/padding. Then write a method where escape analysis eliminates an allocation and prove it with `-XX:+PrintEscapeAnalysis` / allocation profiling.
- ✅ **Checkpoint:** Compute, from memory, the byte size of a given object (header + fields + padding) with compressed oops on; explain why two threads allocating simultaneously don't contend.

### Week 4 — Garbage collection
- **Read:** 07 · GC Fundamentals, 08 · The Modern Collectors, 09 · Reference Types & Cleaners
- **Companion:** *Java Performance* (GC chapters); for depth, *The GC Handbook* Ch. 2–3
- **Master these questions:**
  - What are the GC roots? How does reachability decide liveness, and why does dead-object count never matter to a copying collector?
  - State the generational hypothesis. Why is a young-gen (minor) GC cheap and a full GC expensive?
  - Map the collectors to their trade-off: Serial / Parallel (throughput) vs G1 (balanced) vs ZGC / Shenandoah (low pause). What does each pay for low pauses?
  - Order the reference strengths and say *who* decides when each clears. Why is `finalize()` dead and what replaces it?
- **Hands-on:** Run an allocation-heavy program under `-Xlog:gc*` with G1, then with ZGC. Read the logs: find pause times, promotion, and a full GC. Then write a soft-reference cache and a weak-keyed map and watch entries clear under memory pressure.
- ✅ **Checkpoint:** Given a "long pauses in production" symptom, narrate your diagnosis path (which log, which metric, which collector knob or code change) — and explain the young-gen copy cycle from memory.

---

## Phase 3 · Execution & Performance (Weeks 5–6) → Part 2

Now you know where memory goes; this is where *time* goes. The skill being built is **measuring
honestly** and **predicting the JIT**.

### Week 5 — The interpreter and the JIT
- **Read:** 10 · The Interpreter & Bytecode Execution, 11 · The JIT Compilers, 12 · JIT Optimizations
- **Companion:** *Java Performance* (the compiler chapter); *Optimizing Java* (JIT)
- **Master these questions:**
  - Why does the JVM interpret first instead of compiling everything up front? What does tiered compilation buy?
  - What is deoptimization, and why would the JVM throw away compiled code it just produced? What is OSR?
  - Why is inlining "the mother of all optimizations"? What stops a call site from inlining (megamorphism, size)?
- **Hands-on:** Run a hot loop with `-XX:+PrintCompilation` and `-XX:+PrintInlining`; watch a method tier up to C2. Then make a call site megamorphic and watch it *stop* inlining — and slow down.
- ✅ **Checkpoint:** Explain, from memory, why the same method can run three different ways over its lifetime, and predict whether a given call site will inline.

### Week 6 — Measuring, and the hardware underneath
- **Read:** 13 · Benchmarking the JVM Correctly, 14 · Mechanical Sympathy
- **Companion:** JMH samples (read all ~38 of them — they *are* the curriculum); *Optimizing Java* (microbenchmarking)
- **Master these questions:**
  - Name three ways a naïve `nanoTime()` microbenchmark lies. How does JMH defend against each (warmup, blackholes, forks)?
  - What is a cache line? What is false sharing, and how does `@Contended` or padding fix it?
  - Why can the *memory layout* of your data matter more than your algorithm's Big-O for small N?
- **Hands-on:** Write the *same* benchmark twice — once naïvely, once in JMH — and explain the gap. Then reproduce a false-sharing slowdown with two threads on adjacent fields and fix it; measure the speedup.
- ✅ **Mid-point checkpoint (big one):** Take a slow piece of code, *profile it* (JFR/async-profiler), state where the time/allocations actually go, propose one change, and predict the improvement before measuring it. If you can do this fluently, the performance foundations have landed.

---

## Phase 4 · Concurrency & the Java Memory Model (Weeks 7–8) → Part 3

The hardest internals, and exactly what separates senior from principal. **Slow down here.** Most
engineers use concurrency by recipe; you're going to reason about it from the memory model.

### Week 7 — Threads and the memory model
- **Read:** 15 · Threads & the OS, 16 · The Java Memory Model
- **Companion:** *Java Concurrency in Practice* Ch. 1–3, 16 (the JMM appendix)
- **Master these questions:**
  - What is a platform thread really (its relationship to an OS thread), and what does one cost?
  - Define happens-before. List the edges that establish it (program order, monitor, `volatile`, `final`, thread start/join).
  - What does `volatile` guarantee — and what does it *not*? What is the special guarantee for `final` fields after construction?
  - Why can a data race produce a result that looks impossible from any interleaving?
- **Hands-on:** Reproduce a visibility bug (a non-`volatile` flag a reader never sees updated), then fix it with `volatile` and explain the happens-before edge that made the write visible.
- ✅ **Checkpoint:** Given two threads and some shared fields, state *exactly* which writes are guaranteed visible to which reads, and justify each with a happens-before edge — no hand-waving about "synchronized is safe."

### Week 8 — Locks, j.u.c., and virtual threads
- **Read:** 17 · Locks & Synchronization Internals, 18 · `java.util.concurrent`, 19 · Virtual Threads & Structured Concurrency
- **Companion:** *JCiP* Ch. 13–15; the AQS paper (Lea); the Loom JEPs (425, 444, 453)
- **Master these questions:**
  - Walk a `synchronized` lock from uncontended (CAS, lightweight) to contended (inflated, heavyweight OS monitor). Where's the cost?
  - How does AQS power `ReentrantLock`, `Semaphore`, and `CountDownLatch` with one mechanism? What is CAS and the ABA problem?
  - What is a virtual thread, what's a carrier thread, and what does "mount/unmount" mean? What is **pinning** and why does it matter?
- **Hands-on:** Read `AbstractQueuedSynchronizer.java` and `ReentrantLock`. Then spin up 100,000 virtual threads doing blocking I/O on a handful of carriers; deliberately cause pinning (a `synchronized` block around the blocking call) and detect it with `-Djdk.tracePinnedThreads=full`.
- ✅ **Checkpoint:** Explain why blocking a virtual thread is nearly free but blocking a platform thread is expensive — and sketch how AQS parks and wakes threads in order, from memory.

---

## Phase 5 · The Language, In Depth (Weeks 9–10) → Part 4

Now the everyday language and library, explained *by* the internals you now own.

### Week 9 — Generics and the collections you use daily
- **Read:** 20 · Generics & Type Erasure, 21 · Collections Internals
- **Companion:** *Effective Java* (generics items); read `ArrayList.java` and `HashMap.java`
- **Master these questions:**
  - What does type erasure actually remove, and what survives (and where)? What are bridge methods, and why can't you have `new T[]`?
  - Walk a `HashMap` put: hashing, bucket index, collision, resize at the load factor, and treeification past 8. Why does a bad `hashCode` degrade it to O(n)?
  - Why is `ArrayList` growth amortized O(1), and what's the hidden cost you don't see?
- **Hands-on:** Use JOL to compare the footprint of `HashMap` vs `ArrayList` holding the same data. Then force a `HashMap` bucket to treeify (many colliding keys) and observe the change.
- ✅ **Checkpoint:** From memory, narrate a `HashMap` put end to end, including resize and treeification, and explain what a broken `equals`/`hashCode` does to it.

### Week 10 — Strings, equality, and modern Java
- **Read:** 22 · Strings, 23 · Equality, Identity & Comparison, 24 · Modern Language Features as Design Tools
- **Companion:** *Effective Java* (equals/hashCode, immutability); the records & sealed-types JEPs
- **Master these questions:**
  - Why is `String` immutability load-bearing (security, the pool, thread-safety, hashing)? What are compact strings (Latin-1 vs UTF-16)?
  - Where does the string pool live, and what's the real footgun with `==` vs `.equals` and `intern()`?
  - How do records, sealed types, and pattern matching let you make illegal states unrepresentable? (Bridge to the [LLD track](../LLD/).)
- **Hands-on:** Prove with `==` that two literals share a pooled instance but `new String("x")` doesn't; measure naïve `+=` concatenation in a loop vs `StringBuilder` with JMH. Model a small domain with a sealed interface + records and switch over it exhaustively.
- ✅ **Checkpoint:** Explain why string immutability is a *design* decision with internals consequences, and refactor a class with an `int` "status code" into a sealed type the compiler checks.

---

## Phase 6 · The JVM in Production (Week 11) → Part 5

### Week 11 — I/O, interop, diagnostics, and deployment
- **Read:** 25 · I/O & NIO, 26 · Native Interop, 27 · Diagnostics & Observability, 28 · Startup, Footprint & Native Image
- **Companion:** *Java Performance* (JFR chapter); the Panama (FFM) JEPs; the GraalVM native-image docs
- **Master these questions:**
  - How does one selector thread serve thousands of connections (readiness vs thread-per-connection)? What's a `DirectByteBuffer` and when is off-heap worth it?
  - When is JFR the right tool vs async-profiler vs a heap dump? What is a safepoint and why does "time to safepoint" matter?
  - What does native-image (AOT) trade away versus the JIT, and for which workloads (CLI/serverless vs long-running server) does each win?
- **Hands-on:** Capture a JFR recording of a running app and find the top allocator and the longest GC pause in JDK Mission Control. Take a heap dump and find the dominator of memory. (Optional) Build a tiny app as a GraalVM native image and compare startup time and peak throughput against the JVM.
- ✅ **Checkpoint:** Given "the service is slow / leaking / slow to start," pick the right diagnostic tool first-try and justify it; explain the startup-vs-peak trade-off with the crossover in mind.

---

## Phase 7 · Principal Skills (Week 12) → Part 6

Now the meta-skills that actually define the level.

### Week 12 — Reasoning, sources, and what's next
- **Read:** 29 · Performance Reasoning & Data-Driven Trade-offs, 30 · Reading the Specs & the Source, 31 · The Reading List
- **Companion:** the JLS & JVMS tables of contents (learn to navigate, not memorize); browse OpenJDK on GitHub
- **Master these questions:**
  - Walk your performance-investigation method: hypothesis → measure → locate → change → re-measure. How do you avoid fooling yourself?
  - When a blog and the spec disagree, how do you settle it? Where in the JVMS do you look for class-loading rules, for `volatile`, for the `invokedynamic` instruction?
  - What's the highest-leverage thing to study *after* this, given where you want to go?
- **Hands-on:** Pick a real performance or behavior question from your day job, investigate it with the loop, and **write it up** as a short internals memo — hypothesis, measurements, conclusion, what you'd do. This is the artifact a principal produces.
- ✅ **Final checkpoint:** Take any non-trivial Java behavior question ("why does this allocate / pause / not see that write / not inline?") and answer it end to end — from bytecode to native, with the GC log or profiler or spec citation to back it. If you can do this unprompted and unhesitating, you've hit the goal.

---

## After Week 12 — staying on the curve

Three months gets you fluency, not finality. JVM depth compounds for years.

1. **Read the primary sources.** The JVMS and JLS, then the canonical papers and Shipilëv's blog — now that you have the scaffolding to understand them ([reading list](06-principal-skills/)).
2. **Follow the platform.** Read the JEPs for each new release; the JVM you're tuning today won't be the one you tune in two years (PermGen→metaspace, biased locking removed, virtual threads added). Anchoring to "which version" is a principal habit.
3. **Investigate every production oddity.** A weird pause, a slow startup, a mysterious leak — each is a free internals lesson with the answer hidden in a tool you now know how to use. Write the memo.
4. **Read the JDK source.** It's some of the best Java written. When you wonder how something works, open it.
5. **Teach it.** Explaining the memory model or GC to a teammate will expose your last gaps faster than any reread.

> Re-take the **Final Checkpoint** every couple of months with a *new* behavior question. The day
> you can trace any Java program's behavior from bytecode to native — with numbers you measured —
> you're reasoning about the platform like a principal.

Now: [Week 1](#week-1--from-source-to-running-bytecode). Set up your lab, and go.
