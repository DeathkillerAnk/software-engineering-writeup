# Spring Boot & Spring Framework — Version-by-Version Changes (a reference)

> What changed across Spring Boot (and the Spring Framework + Java baselines underneath it) — because
> half of "Spring folklore" is version-stale, and "which Boot version?" is a real interview question.
> ⚡ = a change that *breaks* or *surprises* on upgrade. Verify anything post-3.2 against the
> [Boot release notes](https://github.com/spring-projects/spring-boot/wiki) / migration guides.

## The alignment you must know

Spring Boot rides on a specific **Spring Framework** line and a **Java baseline**:

| Boot | Framework | Java baseline | Namespace | Era |
|---|---|---|---|---|
| 1.x | 4.x | Java 6–7 | `javax.*` | 2014–2017 |
| **2.x** | **5.x** | **Java 8** (17 max) | `javax.*` | 2018–2023 |
| **3.x** | **6.x** | **Java 17+** (21 for VT) | **`jakarta.*`** | 2022– |

⚡ The two hard walls: **Boot 3 requires Java 17** and **moves `javax.*` → `jakarta.*`**. Support:
each Boot minor gets ~12 months OSS support; 2.7 was the last 2.x and is the migration launch pad to 3.

---

## Spring Boot 1.x (2014–2017) — the foundation
- Introduced the whole model: **auto-configuration**, **starters**, **embedded servers** (Tomcat by
  default), **Actuator**, `@SpringBootApplication`, `application.properties`. Framework 4.x, `javax.*`.
- 1.5 was the last; long-EOL. You won't build on it, but interviewers may ask "what did Boot add over
  plain Spring?" — this is the answer.

---

## Spring Boot 2.x (Framework 5, Java 8) — reactive + observability groundwork

### 2.0 (2018) — the big one
- **Reactive stack: WebFlux + Project Reactor** (non-blocking, Netty).
- ⚡ **CGLIB became the default proxy** (`proxyTargetClass=true`) — the origin of "Boot proxies are
  CGLIB, not JDK dynamic proxies" ([CHEATSHEET](CHEATSHEET.md)).
- ⚡ **HikariCP** became the default connection pool (was Tomcat JDBC).
- **Actuator rewrite**: technology-agnostic endpoints + **Micrometer** metrics facade.
- Relaxed-binding 2.0 for `@ConfigurationProperties`; Kotlin support; Gradle plugin rewrite; Java 8 baseline.

### 2.1–2.5 (2018–2021) — production hardening
- **2.1**: bean-overriding disabled by default; parameterized health.
- **2.2**: **lazy initialization** (`spring.main.lazy-initialization`), **JUnit 5 by default**, RSocket,
  `@ConfigurationProperties` scanning.
- **2.3**: ⚡ **layered jars** + **Cloud Native Buildpacks** (`bootBuildImage`); **liveness/readiness
  probes** (`/actuator/health/liveness|readiness`); **graceful shutdown** (`server.shutdown=graceful`).
- **2.4**: ⚡ **config file processing overhaul** — `spring.config.import`, new profile-group semantics,
  document ordering in YAML changed (a real upgrade surprise); volume-based config for k8s.
- **2.5**: SQL init (`schema.sql`/`data.sql`) reworked; env-var prefix support.

### 2.6 (2021) & 2.7 (2022) — the runway to 3.0
- **2.6**: ⚡ **circular references prohibited by default** (`spring.main.allow-circular-references=false`);
  `@ConditionalOnBean` ordering tightened; Actuator endpoint sanitization.
- **2.7**: ⚡ **auto-config moved from `META-INF/spring.factories` → `META-INF/spring/…AutoConfiguration.imports`**
  + the **`@AutoConfiguration`** annotation ([CHEATSHEET](CHEATSHEET.md)); last 2.x; the recommended
  step-stone before jumping to 3.0.

---

## Spring Boot 3.x (Framework 6, Java 17+) — Jakarta, native, observability

### 3.0 (Nov 2022) — the migration wall
- ⚡ **Java 17 baseline** (won't run on 8/11).
- ⚡ **`javax.*` → `jakarta.*`** (Jakarta EE 9+): servlet, persistence, validation, annotations — the
  single biggest 2→3 migration cost (imports across the whole codebase + third-party libs must be
  Jakarta-ready).
- **AOT + GraalVM native image** first-class (build-time bean registration + `RuntimeHints`).
- **Observability**: new **Micrometer Observation API** + **Micrometer Tracing** — ⚡ **replaced Spring
  Cloud Sleuth** (Sleuth is dead on 3.x).
- **`ProblemDetail`** (RFC 7807) for errors; **HTTP Interface clients** (`@HttpExchange`).
- ⚡ **Spring Security 6**: `WebSecurityConfigurerAdapter` **removed** → component-based
  `SecurityFilterChain` `@Bean` ([CHEATSHEET](CHEATSHEET.md)); `antMatchers`→`requestMatchers`.

### 3.1 (May 2023)
- **`@ServiceConnection`** — Testcontainers wire themselves into config automatically (big test DX win).
- **Docker Compose support** (`spring-boot-docker-compose`) for local dev.
- **SSL bundles** (centralized SSL config); dependency management updates.

### 3.2 (Nov 2023, Framework 6.1)
- ⚡ **Virtual threads** — `spring.threads.virtual.enabled=true` (needs **Java 21**); MVC/Tomcat and
  `@Async`/scheduling run on virtual threads.
- **`RestClient`** — the new **synchronous**, fluent HTTP client (WebClient's ergonomics without the
  reactive stack); **`JdbcClient`** (fluent JDBC).
- **CRaC** (Coordinated Restore at Checkpoint) support for fast startup.

### 3.3 (2024) & 3.4 (2024) & 3.5 (2025)
- **3.3**: **CDS** (class-data-sharing) support for faster startup; SSL/observability refinements;
  security-scoped Actuator.
- **3.4**: ⚡ **structured (JSON) logging built-in** (`logging.structured.format`); `RestTemplate`/
  `RestClient` config alignment; Micrometer/`@ServiceConnection` improvements; bean-container tweaks.
- **3.5 (2025)**: latest line near this writing — incremental (config/observability/security, Java 24
  support). ⚡ Confirm specifics against the 3.5 release notes.

---

## Cross-cutting threads (how Boot evolved)

- **Proxying:** JDK-dynamic-preferred (1.x/plain Spring) → ⚡ **CGLIB default (2.0)**. Doesn't change
  the self-invocation trap.
- **Config files:** simple properties (1.x) → ⚡ **processing overhaul (2.4)** (`spring.config.import`,
  profile groups) → SSL bundles (3.1) → structured logging (3.4).
- **Auto-config wiring:** `spring.factories` → ⚡ **`AutoConfiguration.imports` + `@AutoConfiguration`
  (2.7)**.
- **Observability:** Actuator+Micrometer metrics (2.0) → Sleuth tracing (2.x) → ⚡ **Observation API +
  Micrometer Tracing, Sleuth removed (3.0)**.
- **Deployment/startup:** layered jars + buildpacks + probes + graceful shutdown (2.3) → **native
  image/AOT (3.0)** → **CRaC (3.2)** → **CDS (3.3)**.
- **Concurrency:** blocking MVC / reactive WebFlux (2.0) → ⚡ **virtual threads (3.2 + Java 21)** —
  often removing the reason to go reactive.
- **Security:** `WebSecurityConfigurerAdapter` (≤2.x) → ⚡ **removed; component `SecurityFilterChain`
  (3.0 / Security 6)**.

---

## The 2.7 → 3.0 migration checklist (the one they ask about)

1. **Get to Java 17+** and **Boot 2.7** first (do the easy upgrades on 2.7).
2. ⚡ **`javax.*` → `jakarta.*`** across imports; ensure every third-party lib has a Jakarta-compatible version.
3. ⚡ **Security config**: replace `WebSecurityConfigurerAdapter` with a `SecurityFilterChain` `@Bean`;
   `antMatchers`→`requestMatchers`.
4. **Tracing**: migrate **Sleuth → Micrometer Tracing**.
5. **Custom auto-config**: move `spring.factories` entries to `AutoConfiguration.imports`; annotate `@AutoConfiguration`.
6. Adopt `ProblemDetail` for errors; consider `RestClient` (3.2) over `RestTemplate`; enable virtual
   threads (3.2 + Java 21) where blocking.
7. Run the **`spring-boot-properties-migrator`** to catch renamed/removed properties.

---

## Interview lens & how to check

- Expect *"Boot 2 vs 3 — what changed / how would you migrate?"*, *"where did `spring.factories` go?"*,
  *"how do you configure security in Spring Security 6?"*, *"since when are virtual threads / native
  image supported?"* Anchor to a version.
- **How to verify:** the Boot **release notes & migration guide** per version; `spring-boot:properties-migrator`;
  `/actuator/info` (build version); the `spring-boot-dependencies` BOM for the managed Framework/lib versions.

> Companion: [CHEATSHEET.md](CHEATSHEET.md) (internals recall) · [STAFF-INTERVIEW-CRASHCOURSE.md](STAFF-INTERVIEW-CRASHCOURSE.md)
> (applied breadth). Java's version history: [../java/VERSION-CHANGES.md](../java/VERSION-CHANGES.md).
