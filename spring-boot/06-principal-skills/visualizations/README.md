# Visualizations · Part 6 — Principal Skills

Light here by design — this part is *method*, not *mechanism*, so most of it is prose and decision
frameworks rather than moving parts. Conventions live in
[../../VISUALIZATIONS.md](../../VISUALIZATIONS.md): self-contained single-file HTML, vanilla
JS + canvas/SVG, no build/deps/network, Play/Pause/Step/Reset controls, a "what to notice"
caption, dark terminal-friendly theme.

| File | Status | Medium | Shows | What to notice |
|---|---|---|---|---|
| `startup-cost-breakdown.html` | planned | HTML | A Boot app's startup time broken into phases — classpath scan, condition evaluation / auto-config, bean instantiation, embedded server start — as a stacked timeline, with toggles for **lazy initialization** and **AOT/native image** showing each phase shrink or shift to build time | Startup time is not a mystery — it has an explainable breakdown, and AOT *moves work out of startup into the build*. The biggest wins come from doing *less* (fewer auto-configs, lazy beans), not from a flag. |
| `spring-evolution-timeline` | planned | Mermaid (inline) | One internals-relevant change per recent version: Boot 2.0 (CGLIB proxy default), 2.6 (circular refs prohibited by default), 2.7 (`AutoConfiguration.imports` replaces `spring.factories` for auto-config), 3.0 (Jakarta `javax→jakarta`, AOT + native image, Security 6 removes `WebSecurityConfigurerAdapter`), 3.1 (`@ServiceConnection`), 3.2 (virtual threads) | Facts have a **shelf life** — half of Spring folklore is version-stale. Anchoring every claim to "which version" is how you keep it from creeping back in. |
| `diagnosis-routing` | planned | Mermaid (inline) | A symptom → first-instrument flowchart: missing/extra bean → `/actuator/conditions` (condition report); slow startup → startup breakdown / lazy init / AOT; `@Transactional` not working → proxy & self-invocation check; slow request → Actuator + a profiler from the [java track](../../../java/) | The principal meta-skill is **routing the symptom to the right instrument first**, not knowing every answer — this consolidates the make-it-visible toolset from [STUDY-METHOD](../../STUDY-METHOD.md) and Part 5. |

The two Mermaid items are best authored *inline in the chapters* (a timeline and a flowchart) —
there's nothing to animate, only structure to show — so the only standalone HTML to build here is
`startup-cost-breakdown.html`.
