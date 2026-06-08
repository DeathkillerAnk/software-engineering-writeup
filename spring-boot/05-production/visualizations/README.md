# Visualizations · Part 5 — Production: Security, Observability, Testing, Deployment

Interactive animations for this part. Conventions and the full philosophy live in
[../../VISUALIZATIONS.md](../../VISUALIZATIONS.md): self-contained single-file HTML, vanilla
JS + canvas/SVG, no build/deps/network, Play/Pause/Step/Reset controls, a "what to notice"
caption, dark terminal-friendly theme.

| File | Status | Medium | Shows | What to notice |
|---|---|---|---|---|
| `security-filter-chain.html` | planned | HTML | A request traversing the ordered Spring Security filter chain (`DelegatingFilterProxy` → `FilterChainProxy` → each `SecurityFilterChain` filter in turn), an authentication filter populating the `SecurityContext`, an authorization filter checking access, and an unauthenticated/forbidden request **short-circuiting** mid-chain with a 401/403 before it ever reaches your controller | Spring Security is "just" an **ordered chain of servlet filters** — there is no magic. Every security question ("why is this 403? why isn't my filter running?") is really "*which* filter, in *what* order." |
| `executable-jar.html` | planned | HTML | The nested executable-jar layout — the outer jar containing `BOOT-INF/classes/` (your code), `BOOT-INF/lib/*.jar` (dependencies as *whole jars*), and `org/springframework/boot/loader/…` — with `JarLauncher` setting up a classloader that reads classes *out of the nested jars* at startup | A Boot jar is a **jar-of-jars**, launched by Boot's `JarLauncher` — **not** a flattened/shaded uber-jar that explodes every dependency's classes into one namespace. That's what makes layered jars (`layers.idx`) and Docker layer caching possible. |

Mermaid (inline in the chapters) covers the static structure for this part: **test slices vs the
full `@SpringBootTest` context** (and the context-cache key), and **AOT build-time vs runtime** (what
moves from startup into the build for native image).

> Build order suggestion: `security-filter-chain.html` first — security is where Spring's "magic"
> most often blocks people, and seeing it reduce to an ordered filter list is the fastest cure.
