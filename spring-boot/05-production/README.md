# Part 5 · Production: Security, Observability, Testing, Deployment

> Shipping it for real. The JVM-in-production chapter of this track: securing requests, seeing what
> the app is actually doing, testing it at the right granularity, and packaging it so it starts and
> runs the way the workload needs. This is where Spring stops being a coding exercise and becomes an
> operational one. [← curriculum index](../README.md)

The connective theme: production Spring is about making the framework **observable** and
**testable**, and choosing a **deployment shape** that fits the workload — and the meta-skill is
routing each concern (an auth failure, a missing metric, a flaky test, a slow cold start) to the
right instrument. Several of these instruments — the profiler, the startup-vs-peak trade-off behind
native image — are exactly the [java track's Part 5](../../java/05-io-interop-deployment/) tools,
applied to a Boot app.

---

## Learning objectives — what "I know this" actually means

By the end of this part you can, **from memory and out loud**:

- Explain **Spring Security** as an ordered chain of servlet filters: `DelegatingFilterProxy` →
  `FilterChainProxy` → a `SecurityFilterChain` of filters; where **authentication** happens
  (populating the `SecurityContext`) vs **authorization**; and that **Security 6 removed
  `WebSecurityConfigurerAdapter`** — you now declare a `SecurityFilterChain` `@Bean` (component-based
  config).
- Use **Actuator + Micrometer** as both production telemetry and a debugger: the key endpoints
  (`/health`, `/beans`, `/conditions`, `/mappings`, `/configprops`, `/metrics`), Micrometer as the
  vendor-neutral metrics facade, and **Micrometer Tracing** (Boot 3, replacing Spring Cloud Sleuth)
  for distributed traces.
- Choose the right **test granularity**: `@SpringBootTest` (full context) vs **slices**
  (`@WebMvcTest`, `@DataJpaTest`, `@JsonTest`); explain why **context caching** (keyed on
  configuration) dominates suite speed; and use `@MockBean`, `MockMvc`, Testcontainers, and
  `@ServiceConnection` (Boot 3.1+) appropriately.
- Explain the **executable jar** as a *nested jar-of-jars* (`BOOT-INF/classes/`, `BOOT-INF/lib/*.jar`)
  launched by `JarLauncher` — **not** a flattened uber-jar — and why **layered jars** (`layers.idx`)
  and buildpacks make for efficient container images.
- Explain **Boot 3 AOT + GraalVM native image**: build-time processing that generates
  bean-registration code and `RuntimeHints`, the **closed-world** constraints (reflection, proxies,
  resources must be registered), and the **near-instant-startup-and-low-footprint vs no-JIT-peak**
  trade-off — and which workloads each wins (tie to the [java track](../../java/05-io-interop-deployment/)).

## Topic checklist

- [ ] **24 · Spring Security Internals: the Filter Chain** — `DelegatingFilterProxy` (a servlet
      filter that delegates to a Spring bean) → `FilterChainProxy` → one or more ordered
      `SecurityFilterChain`s, each a list of filters (`SecurityContextHolderFilter`,
      `UsernamePasswordAuthenticationFilter`, `BearerTokenAuthenticationFilter`,
      `AuthorizationFilter`, …); the `SecurityContext`/`Authentication` and `SecurityContextHolder`
      (thread-bound by default); `AuthenticationManager`/`AuthenticationProvider`,
      `UserDetailsService`, password encoding; **method security** (`@PreAuthorize`) as *AOP* (the
      proxy trap again); **component-based config in Security 6** — a `SecurityFilterChain` `@Bean`,
      not the removed `WebSecurityConfigurerAdapter`.
- [ ] **25 · Actuator & Observability (Micrometer, Metrics, Tracing)** — what Actuator exposes,
      enabling/exposing/**securing** endpoints; **Micrometer** as the metrics facade
      (`MeterRegistry`, counters/gauges/timers, dimensional tags) → Prometheus/OTLP/etc.;
      **Micrometer Tracing** (Boot 3) replacing Sleuth; health indicators & readiness/liveness probes;
      and the diagnostic superpower — using `/conditions`, `/beans`, `/mappings` as a *live debugger*
      for "why is this bean / route / property what it is."
- [ ] **26 · Testing Spring Boot (Slices, Context Caching, Testcontainers)** — `@SpringBootTest`
      (full context, optionally a real port) vs **slices** that load a *focused* context
      (`@WebMvcTest` + `MockMvc`, `@DataJpaTest` + a real/in-memory DB, `@JsonTest`,
      `@RestClientTest`); **context caching** — the cache key is the test *configuration*, so every
      unique combination of properties/mocks/profiles spins up (and caches) a separate context, which
      is usually the dominant cost of a slow suite; `@MockBean`/`@SpyBean` (and how they *bust* the
      cache); **Testcontainers** for real dependencies and `@ServiceConnection` (3.1+) wiring them
      automatically.
- [ ] **27 · Packaging, the Executable Jar & Deployment** — the **nested executable jar**: an outer
      jar with `BOOT-INF/classes/` (your code), `BOOT-INF/lib/*.jar` (dependencies kept as *whole
      jars*), and the Boot loader; `JarLauncher` and the custom classloader that reads classes from
      nested jars — explicitly **not** a shaded/uber-jar; **layered jars** (`layers.idx`) and
      Cloud Native Buildpacks (`bootBuildImage`) for cache-friendly OCI images; war vs jar; the
      `PropertiesLauncher`.
- [ ] **28 · Boot 3 AOT & GraalVM Native Image** — the Boot **AOT engine**: at *build time*, it
      processes the bean factory and emits explicit bean-registration code plus **`RuntimeHints`**
      (reflection/proxy/resource/serialization hints); GraalVM **native image** and its **closed-world
      assumption** (everything reachable must be known at build time — dynamic reflection/proxies need
      hints); the trade-off — *near-instant startup, low memory, no warm-up* but *no JIT peak
      throughput, longer builds, and constraints* — and the workloads each fits (serverless/CLI/
      scale-to-zero vs long-running high-throughput services). Ties to the [java track's
      startup-vs-peak chapter](../../java/05-io-interop-deployment/) and Project Leyden.

## The principal-level insight

**Production Spring is a routing problem: every operational concern has a *first instrument*, and the
principal reaches for the instrument instead of guessing.** A 403 nobody understands → trace the
request through the *ordered filter chain* (it's just servlet filters; there's no magic, only order).
"Is this bean even here / why did that route 404 / which property won?" → `/actuator/conditions`,
`/beans`, `/mappings`, `/configprops` — Actuator is a live debugger, not just dashboards. A slow test
suite → it's almost never the tests, it's **context cache misses** from configuration variety, so
standardize test config to share contexts. A slow cold start in a serverless function → that's the
*startup-vs-peak* curve, and the lever is AOT/native image, with eyes open about losing JIT peak.
Juniors learn each of these as a separate trick; a principal sees one discipline — *make the
framework show you what it's doing, then match the deployment shape to the workload* — and the same
judgment that picks a profiler in the [java track](../../java/05-io-interop-deployment/) picks the
Actuator endpoint here.

## Drills (build, don't just read)

1. **Trace the filter chain.** Stand up a `SecurityFilterChain` `@Bean` with form or token auth, set
   `logging.level.org.springframework.security=DEBUG`, and watch a request walk each filter — then
   watch an unauthenticated request short-circuit. Name every filter it passed. (No
   `WebSecurityConfigurerAdapter` — confirm it doesn't exist in Security 6.)
2. **Actuator as a debugger.** Expose `/actuator/conditions`, `/beans`, and `/mappings`. Use
   `/conditions` to explain *why* a specific auto-configured bean exists, `/mappings` to find which
   handler serves a URL, and `/beans` to trace a dependency you didn't wire yourself.
3. **Feel context caching.** Write three slice tests and one `@SpringBootTest`. Add `@MockBean` to one
   and a unique `@TestPropertySource` to another, then turn on context-creation logging and *count*
   how many `ApplicationContext`s get built. Reorganize to share contexts and watch the suite speed up.
4. **Unzip the jar.** Build the executable jar and `unzip -l` it. Find `BOOT-INF/classes/`,
   `BOOT-INF/lib/*.jar`, and `org/springframework/boot/loader/`. Confirm with your own eyes it is a
   jar-of-jars, not a flattened uber-jar.
5. **Go native.** Build the app as a GraalVM native image (`native-image` / `bootBuildImage` with the
   native buildpack). Measure startup time and RSS vs the JVM build. Then break it on purpose with a
   dynamic reflective call and fix it with a `RuntimeHints` registration — that's the closed-world
   tax made concrete.

## Interview lens

Staff/principal and SRE-adjacent interviews probe this as *"it's in production now — what do you
do?"* Probes: *"How does Spring Security process a request?"* (the ordered filter chain — listen for
`FilterChainProxy` and *order*, and that `WebSecurityConfigurerAdapter` is gone), *"`@SpringBootTest`
vs slices, and why is the suite slow?"* (context caching), *"How is a Boot jar structured — and why
isn't it a shaded jar?"*, *"What does native image buy and cost, and when would you use it?"* (the
startup-vs-peak trade-off, with the closed-world constraints named). The signal is **instrument-first
thinking** — you reach for the condition report, the filter log, or the profiler before you theorize.

## Visualizations

See [`visualizations/`](visualizations/): the **Security filter chain** (a request traversing the
ordered filters, auth populating the `SecurityContext`, an unauthenticated request short-circuiting)
and the **executable jar** (the nested `BOOT-INF/classes` + `BOOT-INF/lib` layout and `JarLauncher`).
Full philosophy and catalog in [VISUALIZATIONS.md](../VISUALIZATIONS.md).
