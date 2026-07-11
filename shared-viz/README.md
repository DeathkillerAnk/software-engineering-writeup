# shared-viz — the animation harness

The canonical **`_shared` scaffold** referenced by both tracks' `VISUALIZATIONS.md`. Every
interactive animation in `java/**/visualizations/` and `spring-boot/**/visualizations/` follows the
look, controls, and structure defined here.

## The self-containment rule (and how sharing still works)

Each animation is a **single self-contained `.html` file** — all CSS and JS inline, no build, no
dependencies, no network. It must run by double-clicking, offline, in five years. That rule means an
animation **cannot link** to a shared stylesheet. So "sharing" works by **template, not by
reference**: [`harness-template.html`](harness-template.html) is the canonical skeleton, and each new
animation starts as a copy of it with the topic-specific model + drawing filled in. When the harness
improves, new animations adopt it; existing ones are independently fine.

## What every animation has

- **Dark, terminal-friendly theme** via CSS variables (the shared palette below).
- A **header**: title + a one-line subtitle.
- A **phase label** that names the current step (e.g. "Eden full → minor GC (stop-the-world)").
- The **stage** (a `<canvas>` or inline SVG) where the motion happens.
- A **legend** mapping colors to meaning.
- A **control bar**: `Reset` · `Step` · `Play/Pause` · a speed control · a phase scrubber.
- A **"What to notice"** caption — the single idea the motion exists to teach.
- A **back-link** to the chapter that explains it.

## The shared palette (CSS variables)

| Variable | Meaning | Default |
|---|---|---|
| `--bg` | background | `#0d1117` |
| `--panel` | panels / regions | `#161b22` |
| `--ink` | primary text | `#e6edf3` |
| `--muted` | secondary text | `#8b949e` |
| `--live` | live / reachable / active-good | `#3fb950` (green) |
| `--garbage` | dead / unreachable / collected | `#6e7681` (gray) |
| `--active` | moving / executing / "happening now" | `#d29922` (amber) |
| `--accent` | highlight / pointers / boundaries | `#58a6ff` (blue) |
| `--danger` | error / blocked / trap | `#f85149` (red) |
| `--frozen` | stop-the-world / safepoint / suspended | `#a371f7` (purple) |

Use the **same color for the same concept across the whole curriculum** — "live" is always green,
"the thing happening now" is always amber — so a learner's color intuition transfers between
animations.

## Interaction contract

- **The learner controls time.** `Step` advances exactly one phase; `Play` auto-advances at the
  chosen speed; the scrubber jumps to any phase. Auto-play is never the *only* mode — stepping one
  phase at a time is where understanding happens.
- **Deterministic.** Same steps → same result every run (no `Math.random()` that changes the lesson;
  seed any randomness so it's reproducible and re-explainable).
- **Honest labels.** Use the real terms (Eden / Survivor / Old, mark word, happens-before, CGLIB
  proxy) so the picture maps onto the prose and the spec.

See [`harness-template.html`](harness-template.html) for the skeleton, and
`java/01-memory-and-gc/visualizations/young-gen-copy.html` for the first complete instance.
