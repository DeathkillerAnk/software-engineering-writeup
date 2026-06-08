# Visualizations · Part 1 — The Extension Model & AOP

Interactive animations for this part. Conventions and the full philosophy live in
[../../VISUALIZATIONS.md](../../VISUALIZATIONS.md): self-contained single-file HTML, vanilla
JS + canvas/SVG, no build/deps/network, Play/Pause/Step/Reset controls, a "what to notice"
caption, dark terminal-friendly theme.

| File | Status | Medium | Shows | What to notice |
|---|---|---|---|---|
| `proxy-interception.html` | planned | HTML | A method call routed through a CGLIB/JDK proxy to the target — advice (e.g. `@Transactional`) running *before* and *after* the real method — and then a **self-invocation** where the bean calls its own advised method directly (`this.method()`) and the call goes target→target, **bypassing the proxy** | Only calls that *cross the proxy boundary* are advised. The self-invocation never leaves `this`, so the interceptor never runs and `@Transactional`/`@Async`/`@Cacheable` silently do nothing — the single most expensive AOP bug to not see. |
| `bpp-pipeline.html` | planned | HTML | Every bean instance flowing through the ordered `BeanPostProcessor` chain on its way out of the factory, with the auto-proxy `BeanPostProcessor` swapping the raw instance for a proxy in the *after-initialization* step | Features like `@Transactional` are not in your class — they are added *here*, as a post-processing step. The reference you get injected is the **wrapper**, not the object you wrote. |

Mermaid (inline in the chapters) covers the static structure for this part: where
`BeanFactoryPostProcessor` (operates on bean *definitions*, before instantiation) and
`BeanPostProcessor` (operates on bean *instances*, around initialization) sit on the
`AbstractApplicationContext.refresh()` timeline.

> Build order suggestion: `proxy-interception.html` first — the self-invocation trap is the single
> most valuable thing in this part to make visceral, and it pays off again in Part 4 (transactions)
> and the caching abstraction.
