# Visualizations · Part 2 — Execution & Performance

Conventions in [../../VISUALIZATIONS.md](../../VISUALIZATIONS.md): self-contained single-file HTML,
vanilla JS + canvas/SVG, Play/Pause/Step/Reset, a "what to notice" caption, dark theme.

| File | Status | Medium | Shows | What to notice |
|---|---|---|---|---|
| `tiered-compilation.html` | planned | HTML | Invocation counters climbing, thresholds tripping C1 then C2; a deoptimization when a speculative type check fails | The JVM **bets** on what your code will do (speculative optimization) and pays to be wrong (deopt back to the interpreter). |
| `inlining.html` | planned | HTML | A call tree collapsing as the JIT inlines, then optimizing across the merged body | Inlining is "the mother of all optimizations" — it's what *exposes* escape analysis, constant folding, and the rest. |
| `cpu-cache-false-sharing.html` | planned | HTML | Two threads writing two fields on the *same* cache line, ping-ponging line ownership; then padded apart and flying | Correctness is fine; speed is destroyed — by two fields sharing 64 bytes. Layout, not logic, is the bug. |

Mermaid (inline) covers the static structure: the tiered-compilation level diagram (0–4) and the
memory-hierarchy latency pyramid (register → L1 → L2 → L3 → RAM → SSD).

> Build order suggestion: `cpu-cache-false-sharing.html` is the most viscerally surprising — a
> 64-byte change producing a multiple-x speedup. Great for driving "mechanical sympathy" home.
