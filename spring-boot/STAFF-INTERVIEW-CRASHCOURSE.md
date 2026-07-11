# Staff Engineer Interview Crash-Course — Spring Boot & Backend

> The **applied Spring/backend breadth** a staff/principal interview demands, plus interview framing —
> companion to the *internals* cheatsheet ([CHEATSHEET.md](CHEATSHEET.md), which covers the container,
> auto-config, proxies, the bean lifecycle, etc.). Dense by design. ⚡ = gotcha interviewers probe.
> Targets **Spring Boot 3.x**. Core-Java half: [../java/STAFF-INTERVIEW-CRASHCOURSE.md](../java/STAFF-INTERVIEW-CRASHCOURSE.md).

## How a staff interview differs (read first)

It's not "do you know X" — it's **judgment, trade-offs, failure modes, scale, and influence**. For
every answer add: *why*, *what it costs*, *when it breaks*, *what you'd do instead*, *how you'd verify*.
Typical loop: (1) coding/DS&A + clean code, (2) Java/JVM deep-dive, (3) Spring/backend design,
(4) **system design** (→ [../HLD/](../HLD/)), (5) behavioral/leadership (influence, mentoring, ambiguity).
The differentiator vs senior: you reason about *systems and teams*, name the trade-off variables, and
default to the *simplest thing that survives the next 5 changes*.

---

# Spring Boot & Backend (applied breadth)

**REST API design** — model resources (nouns), correct **HTTP verbs** (GET safe+idempotent, PUT/DELETE
idempotent, POST not) & **status codes** (200/201/204; 400/401/403/404/409/422; 429; 500/503).
**Idempotency keys** for safe POST retries. **Pagination**: offset (simple, ⚡ drifts/slow deep pages)
vs **cursor/keyset** (stable, scalable). **Versioning** (URI `/v1` vs header). Errors as **`ProblemDetail`**
(RFC 7807). Content negotiation via `Accept`. HATEOAS optional. ⚡ never leak stack traces/SQL to clients.

**Validation & error handling** — `@Valid`/`@Validated` + `jakarta.validation` constraints (`@NotNull`,
`@Size`, groups, custom validators). Centralize with `@RestControllerAdvice` + `@ExceptionHandler` →
consistent `ProblemDetail`. Validate at the edge.

**Spring Data / persistence** — derived queries vs `@Query` (JPQL/native); `Pageable`/`Sort`;
projections (interface/DTO — avoid over-fetching); `Specification`/Criteria for dynamic; `@EntityGraph`
to kill **N+1**. **Locking**: **optimistic** (`@Version`, fail-on-conflict, scales) vs **pessimistic**
(`PESSIMISTIC_WRITE`, DB locks, contention). **Auditing** (`@CreatedDate` etc.). ⚡ open-session-in-view
(default on!) hides N+1 and holds connections — consider disabling. Batch inserts (`hibernate.jdbc.batch_size`).

**Transactions (applied)** — `@Transactional` propagation: **REQUIRED** (default), **REQUIRES_NEW**
(independent — e.g. audit must persist even if caller rolls back), **NESTED** (savepoint). **Isolation**
& anomalies: dirty read / non-repeatable read / phantom / lost update / write skew (RC→RR→SERIALIZABLE).
`readOnly=true` hint. ⚡ self-invocation/`private`/`final` = no advice. ⚡ **no distributed ACID across
services** — use **saga** + **transactional outbox** + idempotency ([../HLD/](../HLD/)).

**Caching** — `@Cacheable`/`@CacheEvict`/`@CachePut` (proxy-based — ⚡ self-invocation trap). Providers:
**Caffeine** (in-process, size/TTL) / **Redis** (distributed). **Cache-aside** pattern; plan
**invalidation** & **stampede** (lock/`refreshAfterWrite`). ⚡ caching stale/unbounded data is a leak/bug.

**Security (applied)** — **AuthN vs AuthZ**. Stateful **session** (server memory/sticky, easy revoke) vs
stateless **JWT** (scales, ⚡ hard to revoke → short-lived access + refresh token + rotation/denylist).
**OAuth2/OIDC** (Authorization Code + PKCE for SPAs/mobile; client-credentials for service-to-service).
Passwords: **BCrypt/Argon2** (never plaintext/MD5). **CSRF** (needed for cookie sessions, not for
stateless token APIs). **CORS** config. **Method security** `@PreAuthorize` (AOP). Filter chain =
[CHEATSHEET.md](CHEATSHEET.md). ⚡ validate JWT signature *and* claims (exp/iss/aud).

**Async & scheduling** — `@Async` (+`@EnableAsync`, explicit `Executor`; returns `void`/`Future`/
`CompletableFuture`) — ⚡ self-invocation trap. `@Scheduled` (fixedRate/fixedDelay/cron); ⚡ in multi-
instance deploys use **distributed locks** (ShedLock) or a scheduler service to avoid duplicate runs.

**Messaging & events** — **Kafka** (log, replay, ordering per-partition, high throughput) vs
**RabbitMQ** (queues, routing, per-message). `@KafkaListener`/`@RabbitListener`. ⚡ delivery is
**at-least-once** → make consumers **idempotent**; use **DLQ** for poison messages; **transactional
outbox** to publish atomically with a DB write; ordering only per-partition/queue. (Spring application
events = in-process only — see [CHEATSHEET.md](CHEATSHEET.md).)

**Resilience** — **Resilience4j** (Hystrix is dead): **circuit breaker** (closed→open→half-open),
**retry** (⚡ + exponential backoff + jitter, and only for **idempotent** ops), **rate limiter**,
**bulkhead** (isolate pools), **time limiter/timeout**, **fallback**. ⚡ retries without backoff/idempotency
cause retry storms & double-writes. Set timeouts on *every* remote call.

**Inter-service comms** — **`RestClient`** (Spring 6.1+, sync, fluent — preferred new sync), **`WebClient`**
(reactive/async), `RestTemplate` (legacy/maintenance), declarative **HTTP Interface** (`@HttpExchange`)
or Feign. ⚡ always configure **connect/read timeouts** and a **connection pool**; never call out with
no timeout.

**Microservices / Spring Cloud** — **Config Server** (centralized config), **service discovery**
(Eureka/Consul) + client-side LB (`@LoadBalanced`/Spring Cloud LoadBalancer), **API Gateway** (Spring
Cloud Gateway — routing, auth, rate limiting), **distributed tracing** (Micrometer Tracing → Zipkin/
Tempo, propagate trace IDs). ⚡ a "distributed monolith" (chatty sync calls, shared DB) is the worst
outcome — prefer async/events + autonomy. When NOT to: a modular monolith is usually right first.

**Observability (prod)** — **structured logging** (JSON) + **MDC correlation/trace IDs**; **metrics**
via **Micrometer** → Prometheus (RED: rate/errors/duration); **tracing** (Micrometer Tracing);
**Actuator** health with **liveness/readiness** groups (`/actuator/health/liveness`,`/readiness`).
⚡ averages lie — track **p99/p999**; alert on SLO error budgets.

**Database & migrations** — **Flyway**/**Liquibase** (versioned, repeatable, forward-only migrations;
run on startup or via CI). **HikariCP** pool sizing (≈ small, bounded by DB cores — ⚡ bigger ≠ faster).
Indexing (leftmost-prefix), read replicas, connection-per-tx. (Storage/replication depth → [../HLD/](../HLD/).)

**Testing strategy** — pyramid: many **unit** (no Spring) → fewer **slice** (`@WebMvcTest`+MockMvc,
`@DataJpaTest`, `@JsonTest`) → fewer **integration** (`@SpringBootTest` + **Testcontainers** for real
DB/broker, `@ServiceConnection` in 3.1+) → few **e2e**. `WebTestClient` for reactive/full-stack.
`@MockBean`/`@SpyBean` (⚡ bust context cache → slow suites — standardize config). **Contract testing**
(Spring Cloud Contract) for service boundaries. ⚡ don't mock what you don't own at the boundary —
use Testcontainers/WireMock.

**Deployment & ops** — **Docker** with Boot **layered jars** (cache deps separately) or buildpacks
(`bootBuildImage`). **Kubernetes**: liveness/readiness/startup **probes** (→ Actuator), **resource
requests/limits** (⚡ set `-XX:MaxRAMPercentage` or rely on container-aware defaults — Java *is*
container-aware since 10+), HPA, **graceful shutdown** (`server.shutdown=graceful`). **12-factor**
config (env vars). Rollouts: blue-green/canary. **Native image** trade-off → [CHEATSHEET.md](CHEATSHEET.md).

**Spring Boot 3 specifics (likely asked)** — Jakarta namespace (`javax`→`jakarta`), Java 17 baseline
(21 for virtual threads), **AOT + GraalVM native**, **observability** (Micrometer Tracing replaces
Sleuth), **`ProblemDetail`**, **`RestClient`** + **HTTP Interfaces**, **virtual threads**
(`spring.threads.virtual.enabled`), **`@ServiceConnection`**.

---

# Staff-level meta (the real differentiator)

- **Trade-offs, not answers.** "It depends — on *these* variables": latency vs throughput vs
  consistency vs cost vs team familiarity. Name them; give a default and when you'd revisit.
- **Failure-first.** Assume every dependency fails: timeouts, retries (+idempotency), circuit breakers,
  bulkheads, graceful degradation, blast-radius containment.
- **Idempotency & exactly-once** — "exactly-once *delivery* is a myth; exactly-once *processing* via
  idempotency + dedup is achievable." (transactional outbox).
- **Evolutionary architecture** — migrate running systems with zero downtime (expand/contract,
  strangler fig, feature flags), no big-bang rewrites; one-way vs two-way doors.
- **Influence (staff = leverage, not output)** — code review that levels people up, **ADRs** for
  decisions, mentoring, choosing battles. Behavioral: ownership, ambiguity, conflict, driving alignment.
- **Restraint** — the senior-most move is often *not* adding a framework, *not* splitting the monolith,
  *not* optimizing before measuring.

---

# Rapid-fire question bank — Spring/Backend (what they're *really* testing)

- *“How does `@Transactional` work; why didn’t it roll back / commit?”* → proxy + self-invocation + unchecked-only rollback.
- *“How does auto-configuration work / debug a missing bean?”* → `@Conditional` + ConditionEvaluationReport (`--debug`/`/actuator/conditions`).
- *“Bean scopes; is a singleton thread-safe?”* → no; keep stateless.
- *“Circular dependency — how does Spring resolve it?”* → three-level cache (setter), constructor fails.
- *“Walk a request through Spring MVC.”* → DispatcherServlet → HandlerMapping → HandlerAdapter → converters.
- *“Design a REST API for X”* → resources, verbs, status, pagination, idempotency, errors, versioning.
- *“N+1 problem — detect & fix.”* → SQL logging/stats; fetch join/EntityGraph/batch.
- *“Secure a service; JWT vs session; how to revoke a JWT?”* → short-lived + refresh + denylist.
- *“Make a remote call resilient.”* → timeout + retry(backoff,idempotent) + circuit breaker + fallback.
- *“At-least-once messaging — avoid double processing?”* → idempotent consumers, dedup, outbox, DLQ.
- *“Why is the test suite slow?”* → context cache misses (config variety).
- *“Optimistic vs pessimistic locking?”* → `@Version` vs DB locks; contention vs conflict-rate.
- *“Speed up Boot startup / cold start?”* → lazy init, fewer auto-configs, AOT/native.
- *“Monolith vs microservices — when, and what’s a distributed monolith?”*
- *“Caching strategy & invalidation / stampede?”*

> Drill any fuzzy answer in the full chapters + animations under [this track](README.md). Internals
> recall: [CHEATSHEET.md](CHEATSHEET.md). Core-Java interview half:
> [../java/STAFF-INTERVIEW-CRASHCOURSE.md](../java/STAFF-INTERVIEW-CRASHCOURSE.md).
> System design: [../HLD/](../HLD/) · OOP/clean design: [../LLD/](../LLD/).
