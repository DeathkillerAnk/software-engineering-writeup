# Visualizations · Part 4 — Data & Transactions

Interactive animations for this part. Conventions and the full philosophy live in
[../../VISUALIZATIONS.md](../../VISUALIZATIONS.md): self-contained single-file HTML, vanilla
JS + canvas/SVG, no build/deps/network, Play/Pause/Step/Reset controls, a "what to notice"
caption, dark terminal-friendly theme.

| File | Status | Medium | Shows | What to notice |
|---|---|---|---|---|
| `transaction-proxy.html` | planned | HTML | The `@Transactional` proxy opening a transaction → running the method → **commit** on success / **rollback** on an unchecked exception; then a **self-invocation** call that skips the transaction entirely; then a `REQUIRES_NEW` call suspending the outer transaction and running in its own | The proxy boundary **is** the transaction boundary. Rollback is on unchecked exceptions by default (not checked); a self-invoked `@Transactional` runs with *no* transaction; and propagation decides whether you join, suspend, or nest. |
| `persistence-context.html` | planned | HTML | Entities becoming **managed** in the persistence context (the first-level cache), dirty checking detecting a field change, the flush happening *on commit* (not on the setter), and a lazy-association proxy being touched after the session closed (`LazyInitializationException`) or inside a loop (the **N+1** problem) | The persistence context *is* the L1 cache, scoped to the transaction. Changes flush at commit via dirty checking — you rarely call `save()` for managed entities — and lazy loading is where the surprises (N+1, `LazyInitializationException`) live. |

Mermaid (inline in the chapters) covers the static structure for this part: the transaction
**propagation** modes (`REQUIRED`/`REQUIRES_NEW`/`NESTED`/…) and the Spring Data **repository proxy
chain** (`Repository` interface → `RepositoryFactorySupport` proxy → query derivation/`@Query`).

> Build order suggestion: `transaction-proxy.html` first — it ties Part 1's proxy mechanics directly
> to the most consequential data bug class, and reuses the self-invocation idea from
> [`../../01-extension-and-aop/visualizations/`](../../01-extension-and-aop/visualizations/).
