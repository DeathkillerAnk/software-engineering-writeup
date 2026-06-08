# Visualizations · Part 5 — I/O, Interop & Deployment

Conventions in [../../VISUALIZATIONS.md](../../VISUALIZATIONS.md): self-contained single-file HTML,
vanilla JS + canvas/SVG, Play/Pause/Step/Reset, a "what to notice" caption, dark theme.

| File | Status | Medium | Shows | What to notice |
|---|---|---|---|---|
| `nio-selector.html` | planned | HTML | One selector thread multiplexing many channels via readiness events, vs a thread-per-connection model | How **one** thread serves thousands of connections — readiness-driven, not one-thread-per-socket. (And how virtual threads collapse the distinction.) |
| `startup-vs-peak.html` | planned | HTML | Throughput-over-time curves: interpreter start → JIT warmup → C2 peak, vs an AOT/native-image flat-from-zero curve | The **crossover** that decides your deployment: native-image wins early (cold start), the JIT wins at steady state (peak throughput). |

Mermaid (inline) covers the static structure: the diagnosis-routing flowchart (slow → profiler; leak
→ heap dump; stall → GC/safepoint logs) and the buffer/channel/selector relationship.

> Build order suggestion: `startup-vs-peak.html` first — the warmup-vs-peak trade-off is the crux of
> every "which deployment" decision, and the two crossing curves make it instantly legible.
