# Visualizations · Part 4 — The Language, In Depth

Conventions in [../../VISUALIZATIONS.md](../../VISUALIZATIONS.md): self-contained single-file HTML,
vanilla JS + canvas/SVG, Play/Pause/Step/Reset, a "what to notice" caption, dark theme.

| File | Status | Medium | Shows | What to notice |
|---|---|---|---|---|
| `hashmap-resize.html` | planned | HTML | Entries rehashing into a doubled table; a hot bucket treeifying past 8 collisions | Resize is O(n) but amortized; **treeification** rescues the degenerate (bad-`hashCode`) case from O(n) to O(log n). |
| `arraylist-growth.html` | planned | HTML | Capacity growth (1.5×) and the array copies, vs a pre-sized list | The cost you don't see is the **copies** — pre-sizing avoids them; growth is amortized O(1), not free per add. |
| `string-pool.html` | planned | HTML | Literals interning into the pool vs `new String` on the heap; `==` vs `.equals` | Where object **identity** comes from — and the interning footgun that makes `==` "sometimes work," which is worse than never. |

Mermaid (inline) covers the static structure: the collections-interface map (what implements what),
and a generics-erasure "what survives / what's erased" diagram.

> Build order suggestion: `hashmap-resize.html` first — `HashMap` is the most-used data structure in
> Java and the most-asked-about in interviews; watching it rehash and treeify is high-leverage.
