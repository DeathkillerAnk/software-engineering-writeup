# How to learn Java internals fast (the method matters more than the syllabus)

You asked to reach a high level *in less time*. Time isn't the lever — **feedback per hour** is.
Most people learn internals slowly because they *read* about the JVM (a blog, a talk, a Stack
Overflow answer) and *recognize* the words. Recognition is not knowledge, and worse, half of what's
written about the JVM is stale or wrong. This track has a faster engine, and it's available to you
in a way it isn't for design topics:

> **The JVM is a real machine sitting on your laptop, and it will tell you the truth if you ask it
> the right way.** You never have to argue about how Java behaves. You can *measure* it.

That turns learning internals into something closer to **experimental science** than to reading.

---

## The core loop: Claim → Predict → Measure → Reconcile

```
   ┌───────────────────────────────────────────────────────────────┐
   │  1. CLAIM      state a precise, falsifiable hypothesis           │
   │                "this loop allocates a Long per iteration"        │
   │  2. PREDICT    commit to a number/outcome BEFORE you measure     │
   │                "~16 bytes × N, all dying in young gen"           │
   │  3. MEASURE    interrogate a real JVM with the right tool        │
   │                JFR allocation profile / javap / JOL / JMH        │
   │  4. RECONCILE  explain every gap between prediction and reality  │
   │                "huh — zero allocations: escape analysis killed   │
   │                 it. So when does EA *fail*? Let me break it."     │
   └───────────────────────────────────────────────────────────────┘
```

Step 4 is the one everyone skips and it's where the learning consolidates. **The surprise is the
gift.** When the measurement defies your prediction, you've found the exact edge of your mental
model — chase it until you can predict the next case. Predicting *before* measuring is
non-negotiable: a number you didn't predict teaches you almost nothing, because hindsight makes
everything look obvious.

---

## Your lab equipment (set this up in Week 1, use it forever)

You cannot do the loop above without instruments. Install these once; they appear in nearly every
chapter. None require changing your code.

| Tool | Answers the question | Used most in |
|---|---|---|
| `javap -c -p -v` | "What bytecode did my source become?" | Parts 0, 4 |
| [JOL](https://github.com/openjdk/jol) (Java Object Layout) | "What does this object *really* look like in memory, and how big is it?" | Parts 1, 4 |
| `-Xlog:gc*` (unified logging) | "What is the garbage collector actually doing, and how long did it pause?" | Part 1 |
| [JMH](https://github.com/openjdk/jmh) | "How fast is this, *honestly*?" | Parts 2, 4 |
| `-XX:+PrintCompilation`, `-XX:+PrintInlining` | "What did the JIT compile, inline, or deoptimize?" | Part 2 |
| [JFR](https://docs.oracle.com/en/java/javase/21/jfapi/) + JDK Mission Control | "Where do time and allocations go in a *running* app?" | Parts 1, 2, 5 |
| [async-profiler](https://github.com/async-profiler/async-profiler) | "Show me the flame graph (CPU, alloc, locks)." | Parts 2, 5 |
| `jcmd`, `jstack`, `jmap` | "What is this live JVM doing right now? Dump its threads/heap." | Parts 3, 5 |
| A JDK with sources + the JLS/JVMS bookmarked | "What does the *spec* say, not the blog?" | Part 6, everywhere |

> Pro move: keep a single scratch project (`src/`) with JMH and JOL on the classpath. Every time a
> chapter makes a claim, paste a 5-line experiment in and watch it. That project becomes your
> personal lab notebook.

---

## Five principles that multiply your rate

1. **Measure, don't believe — including this curriculum.** The fastest way to *deeply* learn that
   "allocation is cheap, GC is the cost" is to allocate a billion short-lived objects and watch the
   GC log, not to read the sentence. Treat every claim here as a hypothesis to confirm.

2. **Active recall beats re-reading.** After a chapter, close everything and *redraw the diagram
   from memory* — the runtime data areas, the object header bits, the GC generations, the AQS state
   machine. The struggle is the encoding. Re-reading feels productive and isn't.

3. **Spaced repetition for the vocabulary layer.** Internals have a dense vocabulary that's
   genuinely flashcard-able: card the *behavior → mechanism* direction, never name → definition.
   - Front: *"a thread reads a field another thread wrote — what guarantees visibility?"* →
     Back: *"a happens-before edge; e.g. `volatile` write/read or lock release/acquire."*
   - Front: *"why is allocating in a tight loop nearly free?"* → Back: *"TLAB bump-pointer."*

4. **Read the JDK source and the spec weekly.** The single most underrated technique for internals.
   When you wonder how `HashMap` treeifies or how `ReentrantLock` parks a thread, *open the source*
   (`HashMap.java`, `AbstractQueuedSynchronizer.java`). You absorb the real model — and the JDK is
   some of the best-commented code you'll read. The JLS/JVMS are dry but definitive; learn to find
   the one paragraph you need.

5. **Teach the surprise.** When a measurement shocks you, write the one-paragraph explanation as if
   for a teammate ("I assumed X; the JVM did Y; the reason is Z"). If you can't write it cleanly,
   you don't own it yet. These paragraphs become your `notes.md` — review gold before any staff/
   principal interview.

---

## What "in depth" actually means (the depth ladder)

For any topic, push up this ladder. Stopping at level 2 — "I've read about the JIT" — is exactly
why most engineers plateau at "uses Java" instead of "understands the JVM."

| Level | You can… | Example: the JIT |
|-------|----------|------------------|
| 1 Recognize | name it | "the JIT compiles hot code" |
| 2 Explain | describe the mechanism | "it counts invocations, then C1 then C2 compiles, with profiling" |
| 3 Measure | *show* it on a real JVM | "here's `-XX:+PrintCompilation`; this method hit C2 at iteration ~10k" |
| 4 Predict | say what *will* happen, and be right | "this megamorphic call site won't inline, so it stays slow — watch" |
| 5 Trade off | reason about it in a real decision | "warmup cost means native-image is better for this CLI; for the long-running server, C2's peak wins — here's the crossover" |

**Principal lives at 4 and 5** — predicting the JVM's behavior and using that to make decisions.
Every drill in this track is designed to drag you past 2 (where reading leaves you) into 3, 4, and 5.

---

## Weekly cadence (≈ 8–10 focused hours, intensive)

- **~50%** doing the loop — experiments, JMH benchmarks, GC-log reading, source diving. Non-negotiable; it's where it sticks.
- **~25%** reading the chapter + one section of a companion book / the spec.
- **~15%** building the part's hands-on artifact (see the [ROADMAP](ROADMAP.md)).
- **~10%** spaced-repetition review of the vocabulary layer + writing one "surprise" note.

End every week by adding to that part's `notes.md`: **one thing I measured that surprised me, one
mental model I corrected, one thing I can now predict.** That file becomes your personal
internals playbook.

---

## Anti-patterns in *learning* internals (avoid these to save months)

- **Cargo-cult tuning.** Copying `-XX:+UseSomeFlag` from a blog without measuring before/after. Most
  JVM flags you'll see recommended are obsolete, harmful, or no-ops on a modern JVM. *Default to no
  flags; change one at a time; measure each.*
- **Benchmarking without JMH.** A `System.nanoTime()` loop will lie to you — dead-code elimination,
  no warmup, and on-stack replacement routinely produce numbers that are wrong by 100×. If you're
  measuring nanoseconds, use JMH or don't quote the number.
- **Trusting stale folklore.** Java internals change every release. Biased locking? Removed. The
  PermGen? Gone (it's metaspace now). `String` always interned? No. Always anchor to "which Java
  version," and prefer the spec/JEP over a 2014 blog post.
- **Reading without measuring.** The trap this whole file exists to break. If you've read three
  chapters and run zero experiments, you're recognizing, not learning. Stop and go interrogate the JVM.
- **Skipping Part 0.** Bytecode, class loading, and the memory map feel like prerequisites you can
  skip. You can't — every later "why" (why this is slow, why this leaks, why this isn't visible)
  bottoms out in them.
