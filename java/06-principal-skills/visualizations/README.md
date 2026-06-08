# Visualizations · Part 6 — Principal Skills

Light here by design — this part is *method*, not *mechanism*, so most of it is prose and decision
frameworks rather than moving parts. Conventions (if/when these are built) in
[../../VISUALIZATIONS.md](../../VISUALIZATIONS.md).

| File | Status | Medium | Shows | What to notice |
|---|---|---|---|---|
| `jvm-evolution-timeline` | planned | Mermaid (inline) | Internals-relevant changes per LTS: 8 → 11 (modules, G1 default) → 17 (sealed, removed biased locking direction) → 21 (virtual threads, generational ZGC) → … | Your knowledge has a shelf life — anchoring every fact to "which version" is how you keep folklore from creeping back. |
| `diagnosis-routing` | planned | Mermaid (inline) | Symptom → first tool: slow → profiler; growing memory → heap dump + dominators; stalls → GC/safepoint logs | The principal meta-skill is **routing the symptom to the right instrument first** — consolidates Part 5. |

These two are best authored as Mermaid directly inside the chapters (a timeline and a flowchart),
rather than as standalone HTML — there's nothing to animate, only structure to show.
