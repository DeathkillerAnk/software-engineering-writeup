# Part 2 · Execution & Performance

> Part 1 told you where memory goes; this part tells you where *time* goes. How your bytecode
> actually runs, how the JIT turns the hot 10% into fast native code, how to measure honestly, and
> how to write code the hardware likes. [← curriculum index](../README.md)

The two skills this part builds are rarer and more valuable than any single fact: **measuring
performance without fooling yourself**, and **predicting what the JIT will do** to your code.

---

## Learning objectives — what "I know this" actually means

By the end of this part you can, **from memory and out loud**:

- Explain why the JVM interprets first and compiles later, what tiered compilation buys, and why the
  same method can run three different ways over its lifetime.
- Describe deoptimization and on-stack replacement (OSR), and why the JVM would discard code it just
  produced.
- Explain why inlining is "the mother of all optimizations" and predict whether a given call site
  will inline (size, monomorphic vs megamorphic).
- Name the optimizations the JIT performs for you — inlining, escape analysis, lock
  elision/coarsening, loop unrolling, intrinsics — and recognize when each applies.
- Name three ways a naïve microbenchmark lies and structure a JMH benchmark that defeats each.
- Explain a cache line, false sharing, and data locality, and reason about when memory layout beats
  algorithmic complexity for small N.

## Topic checklist

- [ ] **10 · The Interpreter & Bytecode Execution** — the operand-stack machine in motion; template
      vs switch interpretation; why an interpreter exists at all (instant startup, fallback target
      for deopt); profiling counters gathered while interpreting.
- [ ] **11 · The JIT Compilers** — C1 (fast, lightly optimized) vs C2 (slow, aggressive); tiered
      compilation levels 0–4; profile-guided & *speculative* optimization; deoptimization when a
      speculation fails; OSR for long-running loops; the code cache.
- [ ] **12 · JIT Optimizations** — inlining (and what blocks it); escape analysis & scalar
      replacement (again — it's a JIT optimization); lock elision & coarsening; loop unrolling &
      range-check elimination; intrinsics (`Math`, `System.arraycopy`, etc.); branch profiling.
- [ ] **13 · Benchmarking the JVM Correctly** — why `nanoTime()` loops lie (no warmup, dead-code
      elimination, constant folding, OSR); [JMH](https://github.com/openjdk/jmh): warmup, forks,
      `Blackhole`, `@State`, measuring throughput vs latency honestly.
- [ ] **14 · Mechanical Sympathy** — the memory hierarchy & latency numbers; cache lines (64 B);
      false sharing and `@Contended`/padding; data locality (array-of-structs vs struct-of-arrays);
      branch prediction; why Big-O can lose to constants for small, cache-resident data.

## The principal-level insight

**You are not optimizing your source code — you are optimizing the native code the JIT produces from
it, running on a CPU with caches.** This reframes everything. "Clever" source that defeats inlining
or escape analysis is *slower* than naïve source the JIT can transform. A micro-optimization that
looks good in a `nanoTime()` loop may be pure measurement artifact (the compiler deleted your
dead code). The principal move is to (1) always measure on a *warmed-up* JVM with JMH, (2) read what
the JIT actually did (`-XX:+PrintInlining`, the assembly via `-XX:+PrintAssembly`), and (3) think one
layer down — to cache lines and branch prediction — when the algorithm is already right. Performance
is an *empirical* discipline here; intuition about "fast code" is wrong often enough that you must
measure, and measure correctly.

## Drills (build, don't just read)

1. **Watch a method tier up.** Run a hot loop with `-XX:+PrintCompilation`; identify when it goes
   C1→C2. Then trigger a deoptimization (e.g. a type that suddenly varies) and find it in the log.
2. **Kill inlining and feel it.** Benchmark a monomorphic call site, then make it megamorphic (3+
   implementing types in the loop) and re-measure. Confirm with `-XX:+PrintInlining` that it stopped
   inlining, and quantify the slowdown.
3. **The same benchmark, honest and dishonest.** Write a `nanoTime()` microbenchmark and a JMH one
   for the *same* operation. Explain every part of the gap (warmup, DCE via `Blackhole`, forks).
   This drill alone will change how you read every performance claim forever.
4. **Reproduce false sharing.** Two threads incrementing two adjacent `volatile long` fields; measure
   throughput. Pad them onto separate cache lines (`@Contended` with `-XX:-RestrictContended` or
   manual padding); re-measure the speedup. 64 bytes, multiple-x difference.

## Interview lens

Staff/principal interviews probe this as *"how would you make this faster, and how would you know it
worked?"* The wrong answer guesses; the right answer profiles first, names where the time/allocations
go, changes one thing, and re-measures. Specific probes: *"Why is Java slow on startup but fast
later?"* (interpret → JIT warmup), *"What's deoptimization?"*, *"Why might this microbenchmark be
lying?"* (the single best senior-vs-principal discriminator), *"What's false sharing?"* Reaching for
JMH and a profiler unprompted is the signal.

## Visualizations

See [`visualizations/`](visualizations/): tiered compilation with counters and a deopt, inlining
collapsing a call tree, and the false-sharing cache-line ping-pong. Catalog and conventions in
[VISUALIZATIONS.md](../VISUALIZATIONS.md).
