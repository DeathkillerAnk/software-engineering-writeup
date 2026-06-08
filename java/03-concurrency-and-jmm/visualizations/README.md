# Visualizations · Part 3 — Concurrency & the Java Memory Model

The hardest ideas in the track to picture, and the ones that benefit most from motion. Conventions
in [../../VISUALIZATIONS.md](../../VISUALIZATIONS.md): self-contained single-file HTML, vanilla
JS + canvas/SVG, Play/Pause/Step/Reset, a "what to notice" caption, dark theme.

| File | Status | Medium | Shows | What to notice |
|---|---|---|---|---|
| `reordering.html` | planned | HTML | Two threads' instructions on a timeline you can shuffle within the rules; a data race producing an "impossible" result, then a `volatile` edge forbidding it | **Happens-before** is the *only* thing standing between you and that impossible-looking result. No edge → no guarantee. |
| `lock-inflation.html` | planned | HTML | A monitor going lightweight (CAS) → contended → heavyweight (OS park/unpark) | Uncontended locks are nearly free; **contention** is what costs — inflation to an OS monitor is the price. |
| `aqs-queue.html` | planned | HTML | Threads acquiring/failing/parking in the AQS CLH queue, then being unparked in order | One class — `AbstractQueuedSynchronizer` — powers `ReentrantLock`, `Semaphore`, `CountDownLatch`, and more. |
| `virtual-threads.html` | planned | HTML | Many virtual threads mounting/unmounting on a few carrier threads, parking on I/O without blocking a carrier — and one *pinning* a carrier | Blocking a virtual thread is free (it unmounts); **pinning** (e.g. inside `synchronized`) holds the carrier hostage — that's the bug to hunt. |

Mermaid (inline) covers the static structure: the thread state machine (NEW→RUNNABLE→…→TERMINATED)
and the happens-before edge catalog.

> Build order suggestion: `reordering.html` first — visibility/reordering is the single most
> misunderstood thing in Java, and seeing instructions slide past each other is the fastest cure.
