# 29 · Performance Reasoning & Data-Driven Trade-offs

> Everything before this taught you *mechanisms*. This chapter is the discipline that turns them into
> engineering: the investigation loop, falsifiable hypotheses, honest measurement, and the memo that
> makes your conclusion reusable by others.
> [← Part 6 · Principal Skills](README.md) · next: 30 · Reading the Specs & the Source

> **Predict first (2 min).** A teammate says "the service is slow because of GC." What's wrong with
> that sentence *as an engineering claim* — what two things does it need before anyone should act on
> it? Write your guess.

---

## The investigation loop

Performance work that converges follows one loop; work that thrashes skips a step:

1. **Symptom, quantified.** Not "slow" — *"p99 latency rose from 40ms to 900ms at 12:10, throughput
   unchanged."* Percentiles, not means ([ch.13](../02-execution-and-performance/)).
2. **Falsifiable hypothesis.** The prediction's answer: "slow because of GC" needs (a) a **measurable
   prediction** and (b) a **way to be wrong**. Better: *"If GC is the cause, GC logs will show pauses
   ≥800ms coinciding with the p99 spikes."* Now it's checkable — and dismissible.
3. **Measure the one thing.** Pick the tool from the symptom map ([ch.27](../05-io-interop-deployment/)):
   GC logs, JFR, flame graph, thread dumps. One hypothesis, one measurement.
4. **Confirm or kill — then either fix or loop.** A killed hypothesis is progress: name the next one.

⚡ Distinguish the four axes before measuring — **throughput** (ops/s), **latency** (per-op time,
esp. tail), **allocation rate** (GC pressure feeder), **footprint** (RSS). A change often trades one
for another (bigger heap: fewer GCs, longer pauses); "faster" is meaningless until you name the axis.

## Avoiding self-deception

The instruments lie to the unwary — this track met every one of these:

- **Warmup:** measuring before C2 compiles measures the interpreter ([ch.10–13](../02-execution-and-performance/)).
- **Observer effect:** heavy profilers/logging change the behavior being observed (JFR/async-profiler
  exist precisely because of this).
- **Confirmation bias:** if you expect GC, you'll find *a* GC event and stop. Fix: write the
  hypothesis **before** looking, and actively seek *disconfirming* evidence.
- **Non-production conditions:** cold caches, empty DBs, single-user load. And **run-to-run
  variance** — one run is an anecdote; compare distributions ([ch.13](../02-execution-and-performance/)'s
  error bars).
- **Fixing the 2%:** optimizing off the flame graph's widest frame, not your aesthetic irritation
  (Amdahl).

## The internals memo

A principal's output isn't just the fix — it's a **memo others can check and reuse**:

```
SYMPTOM     p99 900ms (was 40ms) since 12:10 deploy; throughput flat.
HYPOTHESIS  New cache layer allocates per-request → young-GC frequency up → tail pauses.
EVIDENCE    JFR: allocation rate 4x (120→480 MB/s), young GCs 8/s (was 2/s);
            pause distribution shifted; flame graph: 61% alloc in CacheKey.toString().
CONCLUSION  Confirmed. Not "GC is slow" — WE feed it 4x garbage.
FIX         Reuse key buffer / precompute key. Verified: alloc 130 MB/s, p99 45ms.
TRADE-OFF   Slightly more complex key code; documented in CacheKey javadoc.
```

Hypothesis → evidence → conclusion → recommendation, with numbers. This artifact is what separates
"I made it faster" from engineering: it's **auditable**, teaches the team the method, and survives
your context-switch.

## Trade-offs are the job

At principal level the question is rarely "how do I make X fast" but **"what are we buying and what
does it cost?"** — GC choice (throughput vs pause, [ch.08](../01-memory-and-gc/)), JVM vs native
image (peak vs startup, [ch.28](../05-io-interop-deployment/)), virtual threads vs reactive
(simplicity vs ceiling, [ch.19](../03-concurrency-and-jmm/)), caching (speed vs staleness vs memory).
The pattern: **name both sides, quantify the one that matters for this workload, decide, write it
down.** An undocumented trade-off becomes next year's "why is this like this?"

## Make it visible

- **Run the loop on a real slowdown.** Take any perf complaint at work; force yourself to write the
  falsifiable hypothesis *before* opening a tool. Notice how it changes what you measure.
- **Kill your favorite.** Pick a hypothesis you believe; try to *disprove* it first. Practicing
  disconfirmation is the highest-leverage debugging habit.
- **Write one memo.** Next incident, produce the five-line memo above. Compare how the team responds
  vs a Slack message saying "fixed it."

## Self-Check (close the doc, answer out loud)

1. Recite the four steps of the investigation loop, and what makes a hypothesis *falsifiable*.
2. Name the four performance axes and one trade that improves one at another's cost.
3. Give four self-deception traps and the countermeasure for each.
4. What are the five sections of the internals memo, and why is it worth more than the fix alone?
5. Why is "name both sides, quantify, decide, document" the actual principal skill?

> **Go deeper:** re-read [ch.13](../02-execution-and-performance/) (measurement) and
> [ch.27](../05-io-interop-deployment/) (tools) — this chapter is their method layer; then
> [30 · Reading the Specs & the Source](README.md), for when the evidence points *inside* the JDK.
