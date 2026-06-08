# Visualizations · Part 1 — Memory & Garbage Collection

The richest set in the track — GC is pure motion, so this is where animations earn their keep most.
Conventions in [../../VISUALIZATIONS.md](../../VISUALIZATIONS.md): self-contained single-file HTML,
vanilla JS + canvas/SVG, Play/Pause/Step/Reset, a "what to notice" caption, dark theme. Shared
palette: live/reachable, garbage, moving/active, frozen/safepoint.

| File | Status | Medium | Shows | What to notice |
|---|---|---|---|---|
| `object-header.html` | planned | HTML | The bits of an object header (mark word + klass pointer) toggling: unlocked, hash-stamped, GC-age, locked | Identity `hashCode`, GC age, and lock state all live *in those header bits* — that's why an object is bigger than its fields. |
| `tlab-allocation.html` | planned | HTML | Threads bump-pointer-allocating in their own TLABs, then refilling from the heap | Allocation is a **pointer add**, not a `malloc` — and per-thread TLABs mean no contention between allocators. |
| `young-gen-copy.html` | planned | HTML | A generational copying collection: Eden fills, survivors copy S0↔S1, aging objects promote to Old | Only **live** objects are touched; dead ones cost literally nothing — that's why minor GC is cheap. |
| `mark-sweep-compact.html` | planned | HTML | The three phases on one heap, steppable; fragmentation before, compaction after | Why "stop-the-world" exists, and what compaction buys (contiguous free space → fast bump allocation again). |
| `g1-regions.html` | planned | HTML | The heap as a grid of regions; G1 picks the highest-garbage regions to collect first | G1 collects **regions, not generations**, choosing the most profitable ones to hit a pause-time target. |
| `reference-strength.html` | planned | HTML | Strong/soft/weak/phantom holders; what survives a GC under memory pressure; the `ReferenceQueue` filling | The **GC**, not you, decides when soft/weak references clear — timing is not under your control. |

Mermaid (inline) covers the static structure: the GC collector family tree and the
generational-heap layout (Eden / S0 / S1 / Old / Metaspace).

> Build order suggestion: `young-gen-copy.html` and `mark-sweep-compact.html` are the marquee pair —
> they make "GC" concrete in a way no paragraph can. Build them first.
