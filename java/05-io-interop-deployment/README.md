# Part 5 · I/O, Interop & Deployment

> The JVM where it actually lives — serving connections, talking to native code, being profiled in
> production, and being deployed. The internals you've learned now meet the operating system and the
> ops reality. [← curriculum index](../README.md)

This is where principal-level Java becomes *operational*: not just "how does the JVM work" but "how
do I see what it's doing in prod, and how do I ship it so it starts fast enough and runs fast
enough." The diagnostics chapter here is the one you'll reach for in your first real incident.

---

## Learning objectives — what "I know this" actually means

By the end of this part you can, **from memory and out loud**:

- Explain how one selector thread serves thousands of connections (readiness-based multiplexing) vs
  thread-per-connection, and where virtual threads (Part 3) change that calculus.
- Describe channels, buffers, and selectors; explain `DirectByteBuffer`/off-heap memory and when
  it's worth the cost; explain memory-mapped files.
- Say when JNI is justified and what it costs at the boundary, and what the Foreign Function & Memory
  API (Panama) changes.
- Pick the right diagnostic tool first-try: JFR vs async-profiler vs a heap dump vs a thread dump —
  for slowness, leaks, and stalls — and explain what a safepoint and "time to safepoint" are.
- Explain the startup-vs-peak-throughput trade-off and when AOT/native-image beats the JIT (and when
  it doesn't).

## Topic checklist

- [ ] **25 · I/O & NIO** — blocking (`java.io`) vs non-blocking (`java.nio`); channels, buffers
      (direct vs heap), selectors; the readiness model and the reactor pattern; memory-mapped files
      (`MappedByteBuffer`); off-heap memory and why it bypasses GC; how virtual threads make simple
      blocking code scale like NIO.
- [ ] **26 · Native Interop** — JNI: the boundary, the costs (no inlining across it, GC interaction,
      crashes take down the JVM); the modern Foreign Function & Memory API (Project Panama,
      `java.lang.foreign`) and why it's safer and faster than JNI.
- [ ] **27 · Diagnostics & Observability** — [JFR](https://docs.oracle.com/en/java/javase/21/jfapi/)
      (low-overhead always-on profiling) + JDK Mission Control; [async-profiler](https://github.com/async-profiler/async-profiler)
      & flame graphs (CPU, alloc, lock); heap dumps + leak hunting (dominator tree); thread dumps
      (`jstack`); safepoints and time-to-safepoint; `jcmd` as the swiss-army knife.
- [ ] **28 · Startup, Footprint & Native Image** — class-data sharing (CDS/AppCDS); the JIT warmup
      curve; AOT compilation; GraalVM **native image** (closed-world, instant start, low footprint,
      no JIT peak, reflection caveats); choosing per workload (CLI/serverless/lambda vs long-running
      server); Project Leyden's direction.

## The principal-level insight

**The right tool finds the bug in minutes; the wrong tool wastes the whole incident — so the
meta-skill is *diagnosis routing*, not any single tool.** A slow service, a leaking service, and a
stalling service each have a *different* first move: slowness → a profiler (async-profiler flame
graph / JFR) to see where CPU and allocations go; a leak → a heap dump and the dominator tree to see
what's retaining memory; intermittent stalls → GC logs and safepoint logs (a long time-to-safepoint
will freeze you even with a fast collector). Juniors reach for whatever tool they know; a principal
*classifies the symptom first* and picks the instrument that answers that exact question. The same
judgment governs deployment: there is no universally "fast JVM" — a native image starts in
milliseconds but never reaches C2's peak, so it wins for a CLI or a scale-to-zero function and loses
for a long-running server. Knowing the crossover, and measuring where *your* workload sits on it, is
the decision.

## Drills (build, don't just read)

1. **Profile a real slowdown.** Take a CPU-bound method, capture an async-profiler flame graph, and
   read where the time goes. Then a JFR recording of the same run in JDK Mission Control — compare
   what each shows you.
2. **Find a leak.** Write a program that leaks (e.g. an ever-growing static map), let it approach
   OOM, take a heap dump, and find the dominator retaining the memory.
3. **Catch a long safepoint.** Enable safepoint logging; trigger a long time-to-safepoint (e.g. a
   huge counted loop the JIT can't safepoint inside) and observe the whole JVM stall.
4. **NIO vs threads vs virtual threads.** Sketch (or build) a tiny echo server three ways:
   thread-per-connection, an NIO selector loop, and virtual-thread-per-connection. Compare the code
   complexity and reason about scaling.
5. **Native image A/B.** Build a small app on the JVM and as a GraalVM native image. Measure startup
   time and steady-state throughput for both. State which deployment each wins.

## Interview lens

Principal/staff and SRE-adjacent interviews probe this as *"prod is on fire — what do you do?"*:
*"The service is slow — how do you find out why?"* (profiler first, name the hypothesis), *"It's
using more and more memory — leak or just heap growth, and how do you tell?"* (heap dump,
dominators), *"Pauses even though we're on ZGC — what else could it be?"* (safepoints,
time-to-safepoint), *"Why is your serverless function's cold start slow, and how would you fix it?"*
(JIT warmup → CDS/native image, with the trade-off named). Tool-routing judgment is the signal.

## Visualizations

See [`visualizations/`](visualizations/): a selector multiplexing many channels vs thread-per-
connection, and throughput-over-time curves for JIT-warmup vs native-image-flat-from-zero showing the
crossover. Catalog in [VISUALIZATIONS.md](../VISUALIZATIONS.md).
