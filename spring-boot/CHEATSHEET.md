# Spring & Spring Boot — Crash-Course Cheatsheet

> Every topic in the [spring-boot track](README.md), distilled to the facts that matter. Dense by
> design — for cramming and recall, not first learning. Targets **Spring Boot 3.x / Spring Framework
> 6.x / Java 17+**. ⚡ = classic gotcha. Pair with the chapters + animations for depth.

---

## Part 0 · The Container & IoC

**IoC / DI** — **IoC** = the framework calls you (owns construction/wiring/lifecycle); **DI** = the
specific technique (inject dependencies instead of `new`). Wins: decoupling, testability, central
lifecycle. The container owns it all; everything else is a bean.

**ApplicationContext vs BeanFactory** — `BeanFactory` = minimal lazy container; **`ApplicationContext`
= superset** (events, i18n, `Environment`, resource loading, **eager singletons**). Bootstrap =
**`AbstractApplicationContext.refresh()`** — fixed ordered sequence: obtain BeanFactory → invoke
**BeanFactoryPostProcessors** → register **BeanPostProcessors** → init events/messages → **`onRefresh()`
(embedded server starts here)** → `finishBeanFactoryInitialization()` (**instantiate non-lazy
singletons**) → finishRefresh.

**Bean definitions** — a **`BeanDefinition`** is metadata (class, scope, deps), not the object.
Sources: `@Component`/`@Service`/`@Repository`/`@Controller` (scanned by `@ComponentScan`) and
`@Bean` in `@Configuration`. ⚡ `@Configuration` classes are **CGLIB-enhanced** so inter-`@Bean` calls
return the singleton (not a new instance).

**Bean lifecycle (12 stages)** — instantiate → populate (DI) → `*Aware` → **BPP before-init** →
`@PostConstruct` → `InitializingBean.afterPropertiesSet` → custom init → **BPP after-init (★ AOP proxy
created)** → in use → `@PreDestroy` → `DisposableBean.destroy` → custom destroy. ⚡ proxy created at
stage 8 → init code runs on the **raw** object. Scopes: **singleton** (one per container — ⚡ NOT the
GoF singleton, NOT thread-safe; keep stateless), **prototype** (new each lookup, ⚡ **no destroy
callback**), web (request/session/application/websocket). ⚡ prototype-in-singleton → inject
`ObjectProvider<T>`/`@Lookup` for a fresh one.

**DI internals & circular deps** — resolve **by type**, disambiguate with `@Primary`/`@Qualifier`/name
(else `NoUniqueBeanDefinitionException` at startup). **Prefer constructor injection** (final fields,
fail-fast, no-Spring testable). **Three-level cache** (`singletonObjects`/`earlySingletonObjects`/
`singletonFactories`) resolves **setter/field** singleton cycles via an early reference; ⚡ **constructor
cycles can't** (`BeanCurrentlyInCreationException` — nothing to expose). ⚡ **Boot 2.6+ prohibits
circular refs by default** — fix the design, not `@Lazy`.

---

## Part 1 · The Extension Model & AOP

**BFPP vs BPP** — the two hooks Spring builds itself from. **`BeanFactoryPostProcessor`** edits bean
**definitions** before instantiation (e.g. `PropertySourcesPlaceholderConfigurer` resolves `${…}`;
**`ConfigurationClassPostProcessor`** parses `@Configuration`). **`BeanPostProcessor`** wraps bean
**instances** around init (before/after) and **may return a different object** → how AOP returns a
proxy; also `@Autowired`, `@PostConstruct`, `*Aware`. ⚡ BPPs instantiate early → don't make a BPP
depend on regular beans (skips advice).

**AOP / proxies** — cross-cutting concerns as **advice on a proxy**. **JDK dynamic proxy** (interface-
based) vs **CGLIB** (subclass). ⚡ **Boot defaults to CGLIB** since 2.0 (`proxyTargetClass=true`) — NOT
JDK proxies (stale folklore). CGLIB can't proxy `final` classes/methods. **⚡ self-invocation trap:**
`this.method()` bypasses the proxy → `@Transactional`/`@Async`/`@Cacheable` silently do nothing. Fix:
move the method to another bean. `@Transactional` etc. = advice via an auto-proxy BPP (stage 8).

**Environment & config** — `Environment` = profiles + ordered **`PropertySource`s**; first source with
the key wins. **Precedence (high→low):** command-line args > `SPRING_APPLICATION_JSON` > system props >
**env vars** > `application-{profile}.yml` > `application.yml` > `@PropertySource` > defaults. **`@Value`**
(one key) vs **`@ConfigurationProperties`** (typed prefix, nested, validated, **relaxed binding**) —
prefer the latter; records = immutable config (constructor binding). **Relaxed binding**:
`my.app.page-size` ⇄ `MY_APP_PAGESIZE` env var. See `/actuator/env`, `/actuator/configprops`.

**Events** — `ApplicationEventPublisher.publishEvent(obj)` + `@EventListener`; event can be any object
(since 4.2). ⚡ **synchronous by default**: runs on the publisher's thread, **in its transaction**, and a
throwing listener **fails the publisher**. **`@Async`** (+`@EnableAsync`) → separate thread, own tx,
isolated exceptions. **`@TransactionalEventListener(AFTER_COMMIT)`** → runs only after commit (prevents
"emailed, then rolled back"). ⚡ in-process & non-durable — cross-service needs a real broker.

---

## Part 2 · Spring Boot Core

**What Boot adds** — opinionated defaults on plain Spring: **starters**, **auto-configuration**,
**embedded server**, externalized config, Actuator. Mental shift: configure only the non-default.

**Auto-configuration** — `@SpringBootApplication` = `@SpringBootConfiguration` + `@ComponentScan` +
**`@EnableAutoConfiguration`**. The latter imports **`AutoConfigurationImportSelector`**, which reads
**`META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`** (⚡ since Boot
2.7 — NOT legacy `spring.factories`). Each candidate is `@Configuration` gated by **`@Conditional`**:
`@ConditionalOnClass`, `@ConditionalOnMissingBean` (⚡ the override mechanism — your bean wins),
`@ConditionalOnProperty`, `@ConditionalOnBean`, `@ConditionalOnWebApplication`. Auto-config runs
**after** your config so `@ConditionalOnMissingBean` sees your beans. Debug: **`--debug`** →
**ConditionEvaluationReport** (positive/negative matches) or `/actuator/conditions`. Disable:
`spring.autoconfigure.exclude`.

**Starters** — a curated **POM of transitive deps** (usually no code); the **BOM**
(`spring-boot-dependencies`) manages versions. Write your own: an `@AutoConfiguration` class listed in
your starter's `AutoConfiguration.imports`, guarded by conditions.

**SpringApplication.run()** — deduce web type (SERVLET/REACTIVE/NONE from classpath) → listeners
`starting` → prepare `Environment` (`EnvironmentPrepared`) → banner → create context → `prepareContext`
(ApplicationContextInitializers, load sources) → **`refreshContext` (server boots inside `refresh`/
`onRefresh`)** → `afterRefresh` → `ApplicationStarted` → **`ApplicationRunner`/`CommandLineRunner`** →
`ApplicationReady`. Events: Starting→EnvPrepared→ContextPrepared→ContextLoaded→Started→Ready (→Failed).
⚡ embedded server starts *inside* refresh; runners fire only when fully up.

**Externalized config** — precedence above; profiles via `spring.profiles.active` + `application-{p}.yml`;
relaxed binding; type conversion (`Duration` "30s", `DataSize` "10MB"); config import.

**Embedded servers** — **Tomcat** default (Jetty/Undertow swappable; Netty for reactive). Created during
`refresh()` by a `WebServerFactory`. "No external container" = the server is a bean in your app.

---

## Part 3 · Web: MVC, REST & Reactive

**Spring MVC** — one front controller **`DispatcherServlet`** → **`HandlerMapping`** (find handler) →
**`HandlerAdapter`** (invoke) with **`HandlerInterceptor`s**, **argument resolvers**
(`@RequestBody`→`HttpMessageConverter`), the controller, **return-value handlers** → `HttpMessageConverter`
(`@ResponseBody`) or **`ViewResolver`**. Blocking, thread-per-request. ⚡ every 404/deserialize/validation
issue maps to one named stage.

**REST** — `@RestController` (= `@Controller`+`@ResponseBody`), content negotiation (`Accept`), Bean
Validation (`jakarta.validation` — ⚡ `jakarta` not `javax` in Boot 3), centralized errors via
`@ControllerAdvice`/`@ExceptionHandler` + **`ProblemDetail`** (RFC 7807).

**WebFlux & reactive** — **Project Reactor** `Mono` (0/1) / `Flux` (0..N), non-blocking on **Reactor
Netty**, front controller `DispatcherHandler`. **Backpressure** = consumer signals demand. ⚡ reactive
is a **concurrency model**, not a speed dial — only wins end-to-end non-blocking + high concurrency.

**Stacks & virtual threads** — servlet `Filter` (container) vs `HandlerInterceptor` (Spring) vs reactive
`WebFilter`. **Boot 3.2+: `spring.threads.virtual.enabled=true`** → simple blocking MVC scales like
reactive (often obviating it). Ties to [java track Loom](../java/03-concurrency-and-jmm/).

---

## Part 4 · Data & Transactions

**Spring Data** — a `Repository` interface becomes a **dynamic proxy** (`RepositoryFactorySupport`) — no
impl you write. Queries from **method-name derivation** (`findByLastNameAndActiveTrue`) or `@Query`;
`Pageable`, projections, `Specification`. ⚡ derived names can be slower than hand SQL (`JdbcClient`).

**JPA / persistence context** — the **persistence context = first-level cache**, transaction-scoped;
same id → same instance. **Dirty checking** flushes changes **on commit** (you rarely call `save()` for
managed entities). ⚡ **lazy** associations are proxies → `LazyInitializationException` outside the
session; **N+1 problem** (1 + N queries) → fix with `join fetch`/`@EntityGraph`/`@BatchSize`; see it via
SQL logging + `hibernate.generate_statistics`.

**Transactions** — `@Transactional` = AOP proxy → **`TransactionInterceptor`** → **`PlatformTransactionManager`**.
**Propagation**: `REQUIRED` (default, join/start), `REQUIRES_NEW` (suspend + new physical tx), `NESTED`
(savepoint), `SUPPORTS`/`MANDATORY`/`NEVER`/`NOT_SUPPORTED`. **Rollback**: on **unchecked** (`RuntimeException`/
`Error`) by default, **not checked** (use `rollbackFor`). ⚡ **self-invocation** + `private`/`final` methods
= no advice. The proxy boundary IS the tx boundary; the tx scopes the persistence context.

**JDBC, pooling, cache** — `JdbcTemplate`/`JdbcClient`; **HikariCP** = default pool. ⚡ pool size is a
**concurrency ceiling** bounded by the DB — bigger is often *worse*; a tx holds a connection for its
whole duration. `@Cacheable`/`@CacheEvict` = also **proxy-based** (same self-invocation trap).

---

## Part 5 · Production: Security, Observability, Testing, Deployment

**Spring Security** — an **ordered chain of servlet filters**: `DelegatingFilterProxy` →
`FilterChainProxy` → a **`SecurityFilterChain`** (auth filters populate the **`SecurityContext`**, then
an authorization filter). ⚡ **`WebSecurityConfigurerAdapter` removed in Security 6** — declare a
`SecurityFilterChain` `@Bean` (component-based). Method security (`@PreAuthorize`) = AOP (proxy trap).
Every 403 = "which filter, in what order."

**Actuator & observability** — `/health`, `/beans`, `/conditions`, `/mappings`, `/configprops`,
`/metrics` (secure them!). **Micrometer** = vendor-neutral metrics facade; **Micrometer Tracing** (Boot
3, replaced Spring Cloud Sleuth). Use `/conditions`/`/beans`/`/mappings` as a **live debugger**.

**Testing** — `@SpringBootTest` = full context; **slices**: `@WebMvcTest` (+`MockMvc`), `@DataJpaTest`,
`@JsonTest`, `@RestClientTest`. ⚡ **context caching** keyed on configuration → config variety (unique
`@MockBean`/`@TestPropertySource`/profiles) builds many contexts = slow suites; standardize to share.
`@MockBean`/`@SpyBean` (bust the cache). **Testcontainers** + **`@ServiceConnection`** (3.1+) for real deps.

**Packaging** — the executable jar is a **nested jar-of-jars**: `BOOT-INF/classes/` + `BOOT-INF/lib/*.jar`
+ Boot's `loader`, launched by **`JarLauncher`** — ⚡ **NOT a flattened/shaded uber-jar**. **Layered jars**
(`layers.idx`) + buildpacks (`bootBuildImage`) for cache-friendly Docker images.

**AOT & native image** — Boot 3 **AOT** processes the bean factory at build time → bean-registration code
+ **`RuntimeHints`** (reflection/proxy/resource hints). **GraalVM native image** = closed-world: near-
instant startup + low memory, **no JIT peak**, longer build, dynamic reflection/proxies need hints. Pick
native for CLI/serverless; JVM for long-running. Ties to [java track startup](../java/05-io-interop-deployment/).

---

## Part 6 · Principal Skills

**Performance** — separate problems: **startup** (classpath scan → auto-config → bean creation → server
start; cut with lazy init / fewer auto-configs / AOT — `/actuator/startup`) vs **request latency** (pool?
proxy chain? GC? downstream? — Actuator/Micrometer + profiler) vs throughput. Every `@Transactional`/
`@Cacheable`/`@Async` is a proxy hop.

**Architecture & restraint** — use DI/events/proxies deliberately; **modular monolith** as the default;
⚡ the senior move is often **not** adding another annotation / not splitting / not using Spring on a hot
path. Weigh lock-in, proxy/reflection tax, startup cost. Bridges to [LLD](../LLD/) & [HLD](../HLD/).

**Sources** — reference docs > blogs; read the (readable) Spring source: `AbstractApplicationContext.refresh()`,
`DispatcherServlet.doDispatch()`, `TransactionInterceptor`, `AutoConfigurationImportSelector`,
`DefaultSingletonBeanRegistry`. Anchor facts to a version.

**Version timeline** — 2.0: CGLIB proxy default. 2.6: circular refs prohibited by default. 2.7:
`AutoConfiguration.imports` replaces `spring.factories`. **3.0**: Java 17 baseline, `javax`→`jakarta`,
AOT + native image, Security 6 (no `WebSecurityConfigurerAdapter`), Micrometer Tracing. 3.1:
`@ServiceConnection`. 3.2: **virtual threads** (`spring.threads.virtual.enabled`).

**Make-it-visible toolbelt** — `--debug`/ConditionEvaluationReport, Actuator (`/beans` `/conditions`
`/mappings` `/configprops` `/startup`), `logging.level.org.springframework.{aop,transaction,security}=TRACE`,
breakpoints in `refresh()`/`doDispatch()`/`TransactionInterceptor`, read the source.

> Full version-by-version history: [VERSION-CHANGES.md](VERSION-CHANGES.md). Applied/interview breadth:
> [STAFF-INTERVIEW-CRASHCOURSE.md](STAFF-INTERVIEW-CRASHCOURSE.md).
> Full depth + interactive animations: open each [part](README.md). Java internals crash-course:
> [../java/CHEATSHEET.md](../java/CHEATSHEET.md).
