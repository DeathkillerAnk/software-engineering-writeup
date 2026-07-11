# 23 · JDBC, Connection Pooling & the Caching Abstraction

> The plumbing under everything: `JdbcTemplate`/`JdbcClient` when JPA is too much, **HikariCP** and
> why the pool is a *concurrency ceiling* (bigger ≠ faster), and `@Cacheable` — which is a proxy,
> with the trap you already know.
> [← Part 4 · Data & Transactions](README.md) · prev: 22 · Transaction Internals

> **Predict first (2 min).** Your service handles 200 concurrent requests, each holding a DB
> transaction ~50 ms. Is a HikariCP pool of 200 connections faster or slower than a pool of 20? And:
> a `@Cacheable` method calls itself via `this.` — does the cache work? Write your guesses.

---

## JDBC without JPA: `JdbcTemplate` and `JdbcClient`

Not every access needs an entity graph. For reports, bulk ops, and hot reads, plain SQL wins:

- **`JdbcTemplate`** — the classic: SQL + `RowMapper`, resource handling done for you, exceptions
  translated into Spring's `DataAccessException` hierarchy.
- **`JdbcClient`** (Boot 3.2+, [VERSION-CHANGES](../VERSION-CHANGES.md)) — the modern fluent API:
  `jdbcClient.sql("select * from orders where status = :s").param("s", st).query(Order.class).list()`.
  Same engine, nicer ergonomics; prefer it for new code.

Both participate in Spring transactions ([chapter 22](README.md)) — they grab the connection the
transaction manager bound to the thread. No persistence context, no dirty checking, no lazy proxies:
**what you write is what runs** — the escape hatch when [chapter 21](README.md)'s machinery costs
more than it gives.

---

## HikariCP — the pool is a concurrency ceiling

Opening a real DB connection costs a TCP+auth handshake (~ms) — so Boot pools them: **HikariCP**,
default since Boot 2.0, default **`maximumPoolSize=10`**.

The mental model that answers the first prediction: the DB can only *actually execute* about as many
queries in parallel as it has **cores** (plus some I/O overlap). A pool of 200 doesn't add
throughput — it adds **200 sessions contending inside the DB** (context switches, lock contention,
memory), making every query *slower*. The classic sizing rule (HikariCP's own guidance):

> **pool ≈ DB cores × 2** — small, fixed, and let requests queue *in the app* (fair, cheap) instead of
> *inside the database* (expensive). A pool of ~20 usually beats 200 under load. **Bigger ≠ faster.**

The pool works with [chapter 22](README.md)'s transactions: `@Transactional` **checks out one
connection for the whole transaction** — so tx duration = connection hold time. ⚡ The classic
self-inflicted outage: a slow remote call *inside* a transaction holds a connection for seconds; a
burst of requests drains the pool; everything else times out on `connectionTimeout` (default 30 s)
with `SpringBoot… Connection is not available`. **Keep transactions short; never call remote services
inside one.** Knobs that matter: `maximum-pool-size`, `connection-timeout`, `max-lifetime` (below the
DB/LB idle kill), `leak-detection-threshold` (logs checkouts held too long — turn it on in staging).
Watch it live: Boot auto-exposes `hikaricp.connections.*` metrics via Actuator/Micrometer.

---

## The caching abstraction — a proxy again

`@EnableCaching` + `@Cacheable("orders")` wraps the bean in — you guessed it — an **AOP proxy**
([chapter 07](../01-extension-and-aop/07-spring-aop-proxies.md)): before the method runs, the
interceptor checks the cache (key from args via `KeyGenerator`/SpEL `key = "#id"`); hit → return
cached, **method never executes**; miss → execute, store, return.

- **`@CachePut`** — always execute, refresh the entry; **`@CacheEvict`** — remove (e.g. on update);
  `unless`/`condition` for selective caching.
- **Providers:** default is a simple in-memory `ConcurrentHashMap` (⚡ no TTL, no size bound — fine for
  tests, a leak in prod). Real choices: **Caffeine** (in-process, size/TTL/`refreshAfterWrite`) or
  **Redis** (shared across instances, survives restarts, adds a network hop). ⚡ In-process caches are
  **per-instance** — three pods = three inconsistent caches; use Redis (or accept staleness) when
  coherence matters.
- So the second prediction: **no** — a self-invoked `@Cacheable` bypasses the proxy, the interceptor
  never runs, and the method executes every time. Same fix as ever: move it across a bean boundary.
- ⚡ Design reminders: cache **immutable snapshots** (a cached managed entity is a foot-gun —
  [chapter 21](README.md)); plan **invalidation** (`@CacheEvict` on writes, or TTL as the backstop);
  and guard hot keys against **stampede** (Caffeine's `refreshAfterWrite`, or a lock).

---

## Make it visible

- **Pool exhaustion, on purpose.** `maximum-pool-size=2`, add a 5 s `Thread.sleep` *inside* a
  `@Transactional` method, fire 10 concurrent requests → watch `connectionTimeout` errors and
  `hikaricp.connections.pending` spike. Move the sleep outside the transaction → healthy.
- **Cache hit vs miss.** Log inside a `@Cacheable` method; call twice → one log line. Call via
  `this.` → a log line *every* time (the proxy bypass, live).
- **A/B the pool size.** Load-test the same endpoint with pool 10 vs 100 against a small DB — watch
  p99 get *worse* with 100.

---

## Self-Check (close the doc, answer out loud)

1. When do you drop from JPA to `JdbcClient`, and what three JPA behaviors disappear when you do?
2. Why is a connection pool a concurrency ceiling? Give the sizing heuristic and what happens with 200.
3. How do transactions interact with the pool, and what's the classic pool-exhaustion bug?
4. Walk a `@Cacheable` hit and a miss through the proxy. Why does self-invocation break it?
5. Caffeine vs Redis — when each, and what's the multi-instance coherence problem?
6. Name the three cache-design reminders (mutability, invalidation, stampede).

> **Go deeper:** HikariCP's "About Pool Sizing" wiki (the classic); the Spring cache abstraction
> reference; Micrometer's Hikari metrics. **This completes Part 4** — repositories ([20](README.md)),
> the persistence context ([21](README.md)), transactions ([22](README.md)), and the plumbing.
