# Visualizations · Part 0 — Platform & Mental Model

Interactive animations for this part. Conventions and the full philosophy live in
[../../VISUALIZATIONS.md](../../VISUALIZATIONS.md): self-contained single-file HTML, vanilla
JS + canvas/SVG, Play/Pause/Step/Reset controls, a "what to notice" caption, dark theme.

| File | Status | Medium | Shows | What to notice |
|---|---|---|---|---|
| `pipeline.html` | planned | HTML | A method's journey: source → bytecode → interpreter → (hot!) → C1 → C2 → native, with a deopt arrow firing | The *same* method changes how it executes as it runs — Java isn't "compiled" or "interpreted," it's both, over time. |
| `operand-stack.html` | planned | HTML | Stepping `int x = a + b * c;` as bytecode pushing/popping the operand stack | The JVM is a **stack machine**: no registers in the bytecode — operands are pushed, consumed, results pushed back. |
| `classloader-delegation.html` | planned | HTML | A class-load request walking *up* app → platform → bootstrap, then resolving *down* | Parents get first refusal (parent-delegation) — that's precisely what stops user code from spoofing `java.lang.String`. |

Mermaid (inline in the chapters) covers the static structure for this part: the runtime data-areas
map and the classloader hierarchy tree.

> Build order suggestion: `pipeline.html` first — it's the mental model the whole curriculum hangs
> on, and a good template to establish the shared look/controls in `../../VISUALIZATIONS.md`.
