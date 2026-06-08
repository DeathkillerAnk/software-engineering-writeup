# The 12-Week Spring & Spring Boot Intensive

> A sequenced, milestone-driven plan to go from *building Spring Boot services* to *understanding
> what the container and Boot actually do* — at principal depth, in 3 months. Built for an intensive
> pace. [← back to the index](README.md) · Read [STUDY-METHOD.md](STUDY-METHOD.md) first — it's the engine.

## How this plan works

- **12 weeks, 7 parts.** Roughly 2–3 deep-dive chapters per week, plus one hands-on artifact and a
  steady diet of **making the container show you what it's doing** (the heart of
  [the method](STUDY-METHOD.md)).
- **Each week has a checkpoint you must pass *out loud, from memory*.** Recognition ≠ recall. If you
  fail one, you found a gap — that's the point.
- **Every claim gets revealed, not believed.** Spring's behavior is invisible by default; the
  hands-on items below are mostly "pull back the curtain" — `--debug`, Actuator, AOP/transaction
  logging, breakpoints in the source.
- **Set up your make-it-visible toolkit in Week 1.** A throwaway Boot app with Actuator on, DEBUG
  logging ready for `org.springframework`, and your IDE configured to step into the Spring source.
  (See [STUDY-METHOD § your instruments](STUDY-METHOD.md).)

### Companion books & sources (read in parallel)
The best pairing per phase. The **reference docs are the primary source** — prefer them to any blog.

| Source | Best for |
|---|---|
| **Spring Boot & Spring Framework [reference docs](https://docs.spring.io/spring-boot/)** | The primary source. Version-accurate, exhaustive; learn to find the one section you need. |
| ***Spring Boot: Up & Running*** (Mark Heckler) | A modern, Boot-first on-ramp (Parts 0–2). |
| ***Spring in Action, 6th ed.*** (Craig Walls) | Broad, practical coverage across web/data/security (Parts 3–5). |
| ***Pro Spring 6*** (Cosmina, Harrop, Schaefer, Ho) | The deepest book on the *container and internals* (Parts 0–1, 4). |
| **The Spring source on [GitHub](https://github.com/spring-projects)** | The ultimate primary source — unusually readable. Used in every phase, formally in Part 6. |
| ***Spring Microservices in Action*** (Carnell, Sánchez) — optional | The bridge to the [HLD track](../HLD/) once you run Boot apps in a distributed system. |

### Suggested daily cadence (intensive, ~2–3 focused hours)

| Block | Time | What |
|---|---|---|
| **Warm-up recall** | 15 min | Answer yesterday's Self-Check from memory; redraw yesterday's diagram (the `refresh()` sequence, the bean lifecycle, the request flow). |
| **New material** | 50–70 min | Read the day's chapter using *predict → read → self-check*. |
| **Reveal** | 40–60 min | Run the [Predict → Make Visible → Reconcile loop](STUDY-METHOD.md) on what you just read — `--debug`, Actuator, logging, a breakpoint. Don't believe it; make the container confirm it. |
| **Weekly (pick a day)** | 45 min | Build the week's artifact, *or* explain the week's hardest mechanism out loud to a rubber duck. |

> **The single most important habit:** end every reveal by writing the one-sentence reconciliation —
> "I predicted X, the container did Y, because Z." That sentence is the learning.

---

## Phase 1 · The Container & IoC (Weeks 1–2) → [Part 0](00-foundations-the-container/)

Boot's magic is just the container plus opinions. You cannot reason about auto-config, proxies, or
transactions until the container is in your hands. Resist skipping this — every later "why" bottoms
out here.

### Week 1 — IoC, the context, and bean definitions
- **Read:** 01 · What Spring Is: IoC, DI & the Container; 02 · ApplicationContext & BeanFactory; 03 · Bean Definitions & Component Scanning
- **Companion:** *Pro Spring 6* (the container chapters); reference docs → "Core / IoC Container"
- **Master these questions:**
  - What problem do IoC and DI solve, and why is DI *one kind* of IoC, not a synonym?
  - `BeanFactory` vs `ApplicationContext` — what does the context add? Sketch the `refresh()` sequence.
  - Component scanning vs `@Bean` — why do both produce the *same thing* (a `BeanDefinition`)?
- **Hands-on:** Inject the `ApplicationContext`, print `getBeanDefinitionCount()` and the sorted bean names, then hit `/actuator/beans`. Marvel at how many beans you never wrote — that's auto-configuration, made visible.
- ✅ **Checkpoint:** From memory, explain IoC/DI and the problem they solve, and recite the high-level `refresh()` sequence — including where the web server starts and where non-lazy singletons are created.

### Week 2 — The lifecycle, DI internals, and the first extension point
- **Read:** 04 · The Bean Lifecycle & Scopes; 05 · Dependency Injection Internals & Circular Dependencies; 06 · BeanPostProcessor & BeanFactoryPostProcessor
- **Companion:** *Pro Spring 6* (bean lifecycle, post-processors); reference docs → "Bean lifecycle"
- **Master these questions:**
  - Recite the full bean lifecycle order. *Where* does the AOP proxy get created, and where does `@PostConstruct` run relative to `afterPropertiesSet`?
  - How does the three-level singleton cache resolve a setter-injection cycle, and why can't it resolve a *constructor* cycle?
  - `BeanFactoryPostProcessor` (definitions) vs `BeanPostProcessor` (instances) — when does each run in `refresh()`?
- **Hands-on:** Build one bean implementing every lifecycle hook and log each callback; read the order and reconcile it. Then create a setter cycle (resolves) and a constructor cycle (`BeanCurrentlyInCreationException`) and explain both.
- ✅ **Checkpoint:** Recite the lifecycle from memory and explain, mechanically, why constructor injection prevents circular dependencies and why Boot 2.6+ prohibits them by default.

---

## Phase 2 · The Extension Model & AOP (Week 3) → [Part 1](01-extension-and-aop/)

Spring is built out of its own hooks. Once proxies and post-processors are concrete, `@Transactional`,
`@Async`, and even auto-config stop being magic.

### Week 3 — Proxies, configuration, and events
- **Read:** 07 · Spring AOP: Proxies (JDK Dynamic vs CGLIB); 08 · The Environment, Properties & Configuration Binding; 09 · Events & the Application Event Model
- **Companion:** *Pro Spring 6* (AOP); reference docs → "AOP" and "Externalized Configuration"
- **Master these questions:**
  - JDK dynamic vs CGLIB proxies — what's the difference, which does Boot default to, and what can CGLIB *not* proxy?
  - Explain the **self-invocation trap**: why does calling your own `@Transactional`/`@Async` method from the same class do nothing?
  - `@Value` vs `@ConfigurationProperties`; how does relaxed binding map `MY_PROP` ↔ `my.prop`?
- **Hands-on:** Log proxy class names to see CGLIB vs JDK. Reproduce the self-invocation bug with `@Async`/`@Transactional` and fix it. Write a custom `BeanPostProcessor` and watch every bean pass through it.
- ✅ **Checkpoint:** Explain how `@Transactional` works under the hood end to end, and predict whether a given call will actually be advised (does it cross the proxy boundary?).

---

## Phase 3 · Spring Boot Core (Weeks 4–5) → [Part 2](02-spring-boot-core/)

The heart of "Spring Boot internals" — auto-configuration demystified.

### Week 4 — Auto-configuration and starters
- **Read:** 10 · What Boot Adds; 11 · Auto-Configuration Internals; 12 · Starters & Dependency Management
- **Companion:** *Spring Boot: Up & Running* (auto-config, starters); reference docs → "Auto-configuration"
- **Master these questions:**
  - What does `@SpringBootApplication` expand to? Trace `@EnableAutoConfiguration` → `AutoConfigurationImportSelector` → `AutoConfiguration.imports` (and why *not* `spring.factories`).
  - How does the `@Conditional` family gate auto-config, and how does `@ConditionalOnMissingBean` let *your* bean win?
  - What *is* a starter — and what's actually in one?
- **Hands-on:** Run with `--debug` and read the `ConditionEvaluationReport` to explain why one specific bean exists. Then define your own bean and confirm the auto-configured one **backed off**.
- ✅ **Checkpoint:** Given "why is / isn't this bean here?", narrate your diagnosis via the condition report rather than guessing.

### Week 5 — Startup, config, and the embedded server
- **Read:** 13 · The SpringApplication Startup Sequence; 14 · Externalized Configuration & Relaxed Binding; 15 · Embedded Servers
- **Companion:** *Spring Boot: Up & Running* (configuration); reference docs → "SpringApplication", "Embedded Web Servers"
- **Master these questions:**
  - Walk `SpringApplication.run()` step by step. *Where* does the embedded server actually start listening?
  - State the property-source precedence order. Which wins: an env var, a command-line arg, or `application.yml`?
  - How is the embedded Tomcat created, and what does "no external container" change?
- **Hands-on:** Trace `run()` with breakpoints (`prepareContext`, `refreshContext`). Override one property four different ways and observe which wins. Swap Tomcat for Undertow.
- ✅ **Checkpoint:** Recite the `run()` sequence and the config precedence order from memory; write your own minimal starter with an `AutoConfiguration` class guarded by a `@Conditional`.

---

## Phase 4 · Web: MVC, REST & Reactive (Weeks 6–7) → [Part 3](03-web-mvc-and-reactive/)

How a request actually becomes a response — two ways.

### Week 6 — Spring MVC and REST
- **Read:** 16 · Spring MVC Internals: the DispatcherServlet; 17 · Building REST APIs: Negotiation, Errors & Validation
- **Companion:** *Spring in Action* (web, REST); reference docs → "Web MVC"
- **Master these questions:**
  - Walk a request through the `DispatcherServlet`: `HandlerMapping` → `HandlerAdapter` → argument resolvers → handler → message converters → response. Name each stage.
  - How does `@RequestBody` deserialize, and how does content negotiation pick a converter?
  - How do you centralize error handling (`@ControllerAdvice`/`ProblemDetail`) and trigger Bean Validation?
- **Hands-on:** Breakpoint in `DispatcherServlet.doDispatch()` and walk the stages live. Inspect `/actuator/mappings`. Write a `@ControllerAdvice` and a custom `HttpMessageConverter`.
- ✅ **Mid-point checkpoint (big one):** Whiteboard, out loud and timed, a request's full journey from the servlet container through the `DispatcherServlet`, a `@Transactional` service, Spring Data, and back — naming every boundary (filter, dispatcher stage, proxy, transaction, persistence context). If you can do this fluently, Parts 0–3 have landed.

### Week 7 — Reactive and the thread models
- **Read:** 18 · WebFlux & Reactive (Reactor, Backpressure, When to Use); 19 · Filters, Interceptors, the Servlet/Reactive Stacks & Virtual Threads in Boot
- **Companion:** *Spring in Action* (reactive); reference docs → "Web on Reactive Stack"; the [java track's Loom chapter](../java/03-concurrency-and-jmm/)
- **Master these questions:**
  - `Mono`/`Flux` and non-blocking I/O — what is backpressure, and *when* is reactive actually worth the complexity (and when is it not)?
  - Servlet `Filter` vs `HandlerInterceptor` vs reactive `WebFilter` — what runs where?
  - Do **virtual threads** (Boot 3.2+) make WebFlux unnecessary for many apps? Why or why not?
- **Hands-on:** Build the same endpoint in MVC and WebFlux; compare the code and the thread model. Turn on `spring.threads.virtual.enabled=true` and reason about how blocking MVC now scales.
- ✅ **Checkpoint:** Explain MVC vs WebFlux as a *concurrency model* choice (not a speed dial), and explain how virtual threads change the trade-off.

---

## Phase 5 · Data & Transactions (Weeks 8–9) → [Part 4](04-data-and-transactions/)

Where production incidents actually happen — and where Parts 0–1 pay off.

### Week 8 — Spring Data and the persistence context
- **Read:** 20 · Spring Data & the Repository Abstraction; 21 · JPA/Hibernate Integration & the Persistence Context
- **Companion:** *Pro Spring 6* / *Spring in Action* (data); reference docs → "Data Access"; Hibernate user guide
- **Master these questions:**
  - How does a `Repository` interface become a working bean with no implementation you wrote?
  - What is the persistence context, and why is it called the first-level cache? When does it flush?
  - What is the N+1 problem, how do you *see* it, and how do you fix it?
- **Hands-on:** Turn on SQL logging; reproduce an N+1, count the queries with Hibernate statistics, then kill it with a fetch join / `@EntityGraph`. Reproduce `LazyInitializationException` and explain the session boundary.
- ✅ **Checkpoint:** From memory, explain managed entities, dirty checking, and flush timing; diagnose an N+1 and propose the fix.

### Week 9 — Transactions and the data plumbing
- **Read:** 22 · Transaction Management Internals; 23 · JDBC, Connection Pooling & the Caching Abstraction
- **Companion:** reference docs → "Transaction Management"; the HikariCP docs
- **Master these questions:**
  - Trace `@Transactional`: proxy → `TransactionInterceptor` → `PlatformTransactionManager`. When does it roll back (checked vs unchecked)?
  - `REQUIRED` vs `REQUIRES_NEW` vs `NESTED` — what physically happens in each?
  - Why is connection-pool size a *concurrency ceiling*, and why can a bigger pool be worse?
- **Hands-on:** Reproduce a self-invocation `@Transactional` that silently doesn't roll back (transaction TRACE logging). Set HikariCP `maximumPoolSize=2` and watch requests queue under load.
- ✅ **Checkpoint:** Explain why a transaction didn't roll back (the three usual causes), and reason about a sane pool size for a given DB.

---

## Phase 6 · Production (Weeks 10–11) → [Part 5](05-production/)

Securing it, seeing it, testing it, shipping it.

### Week 10 — Security and observability
- **Read:** 24 · Spring Security Internals: the Filter Chain; 25 · Actuator & Observability (Micrometer, Metrics, Tracing)
- **Companion:** reference docs → "Spring Security" and "Spring Boot Actuator"
- **Master these questions:**
  - How does Spring Security process a request? (the ordered filter chain — and why `WebSecurityConfigurerAdapter` is gone in Security 6).
  - AuthN vs AuthZ — where does each happen, and what holds the `SecurityContext`?
  - How do you use `/actuator/conditions`, `/beans`, `/mappings` as a live debugger?
- **Hands-on:** Build a `SecurityFilterChain` `@Bean`, turn on security DEBUG logging, and trace a request through each filter (and watch an unauthenticated one short-circuit). Expose Actuator and use `/conditions` to explain a bean's existence.
- ✅ **Checkpoint:** Narrate a request through the Security filter chain from memory; pick the right Actuator endpoint first-try for a given "why is this so?" question.

### Week 11 — Testing and deployment
- **Read:** 26 · Testing Spring Boot (Slices, Context Caching, Testcontainers); 27 · Packaging, the Executable Jar & Deployment; 28 · Boot 3 AOT & GraalVM Native Image
- **Companion:** reference docs → "Testing", "Executable Jars", "GraalVM Native Images"; the [java track's startup chapter](../java/05-io-interop-deployment/)
- **Master these questions:**
  - `@SpringBootTest` vs slices — and why is the suite slow? (context caching, keyed on configuration.)
  - How is a Boot jar structured, and why is it *not* a shaded uber-jar?
  - What does AOT/native image buy and cost, and which workloads fit it?
- **Hands-on:** Count how many `ApplicationContext`s your test suite builds and reorganize to share them. `unzip -l` the executable jar to see the nested layout. Build a native image, compare startup/RSS to the JVM, and fix one closed-world reflection failure with a `RuntimeHints` registration.
- ✅ **Checkpoint:** Explain context caching and how to keep a suite fast; explain the executable-jar layout and the startup-vs-peak trade-off behind native image.

---

## Phase 7 · Principal Skills (Week 12) → [Part 6](06-principal-skills/)

The meta-skills that define the level.

### Week 12 — Reasoning, restraint, and sources
- **Read:** 29 · Performance & Tuning a Boot App; 30 · Architecture with Spring & Knowing When Not To; 31 · Reading the Spring Source & the Reading List
- **Companion:** the reference docs & release notes; the Spring source on GitHub
- **Master these questions:**
  - How would you speed up this app's startup? (the phase breakdown → lazy/auto-config/AOT, with numbers.)
  - When would you *not* use a Spring feature, or Spring at all? Argue it with forces.
  - You're unsure whether some behavior is guaranteed — how do you find out? Where in the source/docs do you look?
- **Hands-on:** Profile and cut your app's startup time, reporting before/after. Then write a **one-page internals memo** on a real behavior question from your work (hypothesis → what you revealed → conclusion → recommendation). This is the artifact a principal produces.
- ✅ **Final checkpoint:** Take any non-trivial Spring behavior question ("why did this bean appear / this transaction not commit / this request 403 / this app start slowly?") and answer it end to end — from the annotation to the proxy to the `refresh()` sequence — with the condition report, Actuator endpoint, log, or source citation to back it. If you can do this unprompted and unhesitating, you've hit the goal.

---

## After Week 12 — staying on the curve

Three months gets you fluency, not finality. Spring depth compounds for years.

1. **Read the primary sources.** The reference docs end to end for the modules you use, then the
   Spring source — now that you have the scaffolding to understand it ([reading list](06-principal-skills/)).
2. **Follow the platform.** Read the Boot release notes & migration guides for each version; the Boot
   you tune today won't be the one you tune in two years (`spring.factories` → `AutoConfiguration.imports`,
   biased-locking-era folklore, virtual threads, AOT/native). Anchoring to "which version" is a
   principal habit.
3. **Investigate every production oddity.** A weird startup, a mysterious 403, an N+1, a transaction
   that didn't commit — each is a free internals lesson with the answer hidden in a report, an
   endpoint, or the source. Write the memo.
4. **Read the Spring source.** It's some of the best-organized Java you'll read. When you wonder how
   something works, open `refresh()`, `doDispatch()`, or `TransactionInterceptor`.
5. **Teach it.** Explaining auto-configuration or the filter chain to a teammate will expose your last
   gaps faster than any reread.

> Re-take the **Final Checkpoint** every couple of months with a *new* behavior question. The day you
> can trace any Spring app's behavior from annotation to proxy to `refresh()` — with the report or the
> source to back it — you're reasoning about the framework like a principal.

Now: [Week 1](#week-1--ioc-the-context-and-bean-definitions). Set up your make-it-visible toolkit, and go.
