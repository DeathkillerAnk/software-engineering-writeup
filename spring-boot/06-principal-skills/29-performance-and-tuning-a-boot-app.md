# 29 · Performance & Tuning a Boot App

> "Make the Boot app faster" is three different problems — **startup**, **latency**, **throughput** —
> with three different toolkits. Conflating them wastes incidents; separating them is the tuning
> skill.
> [← Part 6 · Principal Skills](README.md) · next: 30 · Architecture with Spring

> **Predict first (2 min).** A Boot app takes 12 seconds to start. Where do you *expect* the time
> goes — your code, or the framework? And: a request's p99 is 800ms while p50 is 12ms — is that shape
> more likely the JVM (GC), or a pool ceiling? Write your guesses.

---

## Startup: where the seconds go, and the levers

Boot startup ≈ JVM boot + classpath scanning + **bean instantiation** (step 11 of `refresh()`,
[ch.02](../00-foundations-the-container/)) + auto-config evaluation + server start. The prediction's
first answer: overwhelmingly **framework + your beans' constructors**, not your business logic —
hundreds of beans, each constructed, injected, post-processed ([ch.04–06](../00-foundations-the-container/)).

Levers, cheapest first:

- **Measure first:** `ApplicationStartup` with `BufferingApplicationStartup` → `/actuator/startup`
  gives a step-by-step timeline — *which beans* cost what. Never tune blind.
- **`spring.main.lazy-initialization=true`** — defer bean creation to first use. Big startup win;
  trade: first-request latency + failures move to runtime (fail-fast lost, [ch.02](../00-foundations-the-container/)).
  Often right for dev, selective (`@Lazy`) in prod.
- **Trim the classpath** — every starter drags auto-configs that evaluate (and beans that build) at
  startup ([ch.12](../02-spring-boot-core/)); `/actuator/conditions` shows what fired that you never
  use.
- **CDS / AOT-on-JVM / native image** — the [java startup toolbox](../../java/05-io-interop-deployment/)
  + [ch.28](../05-production/)'s AOT, in escalation order.

> ▶ **Watch it:** [`startup-cost-breakdown.html`](visualizations/startup-cost-breakdown.html) — the
> 12 seconds decomposed: JVM, scanning, auto-config, bean instantiation, server start — and what each
> lever removes.

## Latency: triage the request path

The prediction's second answer: a **spiky tail with a healthy median** points at *queuing* — usually
a **pool ceiling** — more than GC (which also hits tails, but check pools first in a Boot app):

1. **HikariCP pool** ([ch.23](../04-data-and-transactions/)): all connections busy → requests *wait*.
   Micrometer's `hikaricp.connections.pending`/`acquire` timers tell you instantly.
2. **Downstream dependency** — a slow remote call; the trace ([ch.25](../05-production/)) shows the
   long span. Timeouts + budgets, not hope.
3. **Tomcat thread ceiling** ([ch.15](../02-spring-boot-core/)) — blocking work saturating
   `threads.max`; virtual threads ([ch.19](../03-web-mvc-and-reactive/)) relax it.
4. **Serialization** — huge JSON payloads; `http.server.requests` percentiles per route.
5. **The JVM itself** — GC/JIT; hand off to the [java track's tools](../../java/05-io-interop-deployment/)
   (JFR, flame graphs).

⚡ Method: **timers first** (`/actuator/metrics`, traces), profiler second, guessing never
([java ch.29](../../java/06-principal-skills/)'s loop applies verbatim).

## The proxy tax: Spring features aren't free

Every `@Transactional`, `@Cacheable`, `@Async`, `@PreAuthorize` is a **proxy hop** with interceptor
logic ([ch.07](../01-extension-and-aop/)): reflection-adjacent dispatch, thread-local bookkeeping,
sometimes a pool/queue. One is negligible; **stacked on a hot path × thousands of calls/s it shows
up in flame graphs.** Corollaries:

- Don't annotate reflexively — a `@Transactional` on a read-only single-query method costs a
  transaction + connection hold for nothing ([ch.22](../04-data-and-transactions/)).
- Batch work *inside* one proxy crossing rather than calling an annotated method in a loop.
- ⚡ The [self-invocation trap](../01-extension-and-aop/) means the annotation you *think* is adding
  cost (or safety) may not even be active — verify with a breakpoint in the interceptor.

## Throughput: ceilings, in order

Throughput walls in a typical Boot service, checked in order: **DB pool size** (concurrency ceiling,
[ch.23](../04-data-and-transactions/)) → **server threads vs blocking work** (virtual threads help,
[ch.19](../03-web-mvc-and-reactive/)) → **N+1 / chatty persistence** ([ch.21](../04-data-and-transactions/))
→ **CPU/GC** ([java Parts 1–2](../../java/)). Fix the *binding* constraint; the rest is noise until
it becomes binding.

## Make it visible

- **Time your startup.** Wire `BufferingApplicationStartup`, hit `/actuator/startup`, and rank the
  top 10 slowest steps — then apply one lever and re-measure.
- **Find a pool wait.** Load-test past `maximumPoolSize`; watch `hikaricp.connections.pending` climb
  while p50 stays flat and p99 explodes — the queuing signature.
- **See the proxy tax.** Flame-graph a hot annotated method — count the interceptor frames above
  your code.

## Self-Check (close the doc, answer out loud)

1. Why are startup, latency, and throughput three different problems? Name one tool for each.
2. Where does Boot startup time actually go, and what are the four levers in escalation order?
3. What latency shape suggests a pool ceiling, and which metric confirms it in seconds?
4. What is the proxy tax, and what are two ways to reduce it without losing the features?
5. Recite the throughput-ceiling checklist in order.

> **Go deeper:** `/actuator/startup` docs; HikariCP's "About Pool Sizing" wiki; then
> [30 · Architecture with Spring & Knowing When Not To](README.md).
