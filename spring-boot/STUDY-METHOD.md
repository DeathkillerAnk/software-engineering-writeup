# How to learn Spring internals fast (the method matters more than the syllabus)

You asked to reach a high level *in less time*. Time isn't the lever — **feedback per hour** is.
Most people learn Spring slowly because they *read* about it (a blog, a Baeldung article, a Stack
Overflow answer) and *recognize* the annotations. Recognition is not knowledge, and worse, an
enormous fraction of what's written about Spring is stale (pre-Boot-3, pre-Security-6) or wrong.
This track has a faster engine, and it's available to you in a way it isn't for design topics:

> **Spring is mostly convention and configuration, and it will *show you exactly what it did* if you
> ask it the right way.** You never have to guess what Boot auto-configured, which bean won, why
> your `@Transactional` did nothing, or which filters wrapped a request. You can *make it visible.*

That turns learning Spring from a fog of "magic" into something closer to **reading a machine's own
log of its decisions** — because that's literally what the tooling gives you.

---

## The core loop: Predict → Reveal → Reconcile → Articulate

```
   ┌───────────────────────────────────────────────────────────────┐
   │  1. PREDICT    commit to what the container/Boot DID, in detail  │
   │                "DataSourceAutoConfiguration ran, gave me Hikari,  │
   │                 and my @Bean DataSource overrode it"             │
   │  2. REVEAL     make the invisible visible with the right switch   │
   │                --debug / /conditions / /beans / DEBUG logging /   │
   │                a breakpoint in refresh() or TransactionInterceptor│
   │  3. RECONCILE  explain every gap between prediction and reality   │
   │                "huh — Hikari was NOT replaced: @ConditionalOnMiss-│
   │                 ingBean fired AFTER my bean, so why did it stay?" │
   │  4. ARTICULATE write the one-paragraph mechanism for a teammate   │
   │                "the condition matched on bean *type*; my bean was │
   │                 a sub-type, so OnMissingBean still backed off"    │
   └───────────────────────────────────────────────────────────────┘
```

Steps 3 and 4 are the ones everyone skips and they're where the learning consolidates. **The
surprise is the gift.** When the `/conditions` report or the proxy log defies your prediction,
you've found the exact edge of your mental model — chase it until you can predict the next case.
Predicting *before* you reveal is non-negotiable: a `/conditions` dump you didn't predict teaches
you almost nothing, because hindsight makes every auto-configuration decision look obvious.

This is the Spring analog of the [java track's](../java/STUDY-METHOD.md) "measure it" loop. There,
the primary source is the running JVM. Here, the primary source is **the running context, the
condition report, and the Spring source itself** — all of which are sitting on your laptop.

---

## Your instruments (set this up in Week 1, use it forever)

You cannot do the loop above without making Spring's decisions visible. Wire these up once; they
appear in nearly every chapter. None require restructuring your application.

| Instrument | Answers the question | Used most in |
|---|---|---|
| `--debug` (or `debug=true`) → the **ConditionEvaluationReport** | "Which auto-configurations matched, and *why* did the others back off?" — prints `Positive matches` / `Negative matches` / `Exclusions` | Parts 2, 4, 5 |
| Actuator **`/beans`** | "What beans exist, of what type, who depends on whom, and from which configuration?" | Parts 0, 1, 2 |
| Actuator **`/conditions`** | "The ConditionEvaluationReport as a live JSON endpoint" — same data as `--debug`, queryable | Part 2 |
| Actuator **`/mappings`** | "Which handler, filter, and servlet is actually wired to this URL?" | Part 3 |
| Actuator **`/configprops`** | "What are the *effective* `@ConfigurationProperties` values after relaxed binding?" | Parts 2, 5 |
| Actuator **`/health`**, `/metrics`, `/httpexchanges` | "Is the app live/ready, and where is time and traffic going?" (Micrometer) | Part 5 |
| `logging.level.org.springframework=DEBUG` (and `=TRACE` surgically) | "Narrate the framework's own decisions" — bean creation order, request dispatch, security filters | everywhere |
| `logging.level.org.springframework.transaction=TRACE` + `org.springframework.aop=TRACE` | "Show me every proxy created and every tx begin/commit/rollback" — the cure for *"why did nothing roll back?"* | Parts 1, 4 |
| Breakpoints in `AbstractApplicationContext.refresh()`, `DispatcherServlet.doDispatch()`, `TransactionInterceptor.invoke()` | "Step through the three load-bearing methods of the whole framework" | Parts 0, 3, 4 |
| The **Spring source on GitHub** (`spring-projects/spring-framework`, `spring-boot`) + your IDE's *Go to definition* | "What does the framework *actually* do, not what the blog claims?" | Part 6, everywhere |
| `spring-boot-starter-test`: **MockMvc**, `@SpringBootTest`, slices, **Testcontainers** | "Run a controlled experiment on real behavior in seconds" | everywhere |

> Pro move: keep one throwaway Boot project with `spring-boot-starter-web`, `-actuator`,
> `-data-jpa`, and `-security` on the classpath, `management.endpoints.web.exposure.include=*`, and
> `debug=true`. Every time a chapter makes a claim, add a `@Bean`, hit an endpoint, or set a
> breakpoint and *watch what the container actually did*. That project becomes your lab notebook.

---

## Five principles that multiply your rate

1. **Reveal, don't believe — including this curriculum.** The fastest way to *deeply* learn that
   "your `@Bean` overrides the default because of `@ConditionalOnMissingBean`" is to define that
   bean, hit `/conditions`, and watch the auto-config back off — not to read the sentence. Treat
   every claim here as a hypothesis to confirm with `--debug`, an Actuator endpoint, or a
   breakpoint. Spring's "magic" is just code you haven't read yet; the whole point of this track is
   that you *can* read it.

2. **Active recall beats re-reading.** After a chapter, close everything and *redraw the diagram
   from memory*: the ordered phases of `AbstractApplicationContext.refresh()`, the bean lifecycle
   (instantiate → populate → `*Aware` → `postProcessBeforeInitialization` → `@PostConstruct` →
   `afterPropertiesSet` → init-method → `postProcessAfterInitialization` → … → `@PreDestroy`), the
   `DispatcherServlet` request flow (HandlerMapping → HandlerAdapter → converters → return-value
   handlers), the Security filter chain. The struggle of reconstruction is the encoding. Re-reading
   feels productive and isn't.

3. **Spaced repetition for the vocabulary layer — in the *behavior → mechanism* direction.** Spring
   has a dense vocabulary that's genuinely flashcard-able, but card the *symptom*, never the
   name → definition:
   - Front: *"`@Transactional` on a method I call from another method of the same bean silently does
     nothing — why?"* → Back: *"self-invocation bypasses the proxy; the call never leaves `this`, so
     `TransactionInterceptor` never runs."*
   - Front: *"my `@Bean` didn't replace Boot's default — what gated the default?"* → Back:
     *"`@ConditionalOnMissingBean`; it backs off only when a bean of the matched type already
     exists."*
   - Front: *"`LazyInitializationException` outside the controller — why?"* → Back: *"the persistence
     context (and its lazy proxies) closed with the transaction; the session is gone."*

4. **Read the Spring source weekly.** The single most underrated technique for Spring internals, and
   the one that fastest dissolves the "magic." When you wonder how a `@RestController` method's
   arguments get resolved, or how auto-config is discovered, *open the source*:
   `AutoConfigurationImportSelector`, `DispatcherServlet`, `AbstractAutowireCapableBeanFactory`,
   `TransactionInterceptor`, `FilterChainProxy`. Spring is famously well-structured, heavily
   `@since`-tagged, and Javadoc-rich — it's some of the best framework code you'll read, and your IDE
   will walk you through it in minutes.

5. **Teach the surprise.** When `/conditions` or a proxy log shocks you, write the one-paragraph
   explanation as if for a teammate (*"I assumed Boot used my DataSource; it didn't; the reason is the
   ordering of `@ConditionalOnMissingBean` against the bean *type*"*). If you can't write it cleanly,
   you don't own it yet. These paragraphs become your `notes.md` — review gold before any staff/
   principal interview, where "explain what `@SpringBootApplication` actually does" is a standard
   opener.

---

## What "in depth" actually means (the depth ladder)

For any topic, push up this ladder. Stopping at level 2 — "I've read about auto-configuration" — is
exactly why most engineers plateau at "uses Spring Boot" instead of "understands Spring Boot."

| Level | You can… | Example: auto-configuration |
|-------|----------|-----------------------------|
| 1 Recognize | name it | "Boot auto-configures things for you" |
| 2 Explain | describe the mechanism | "`@EnableAutoConfiguration` imports `AutoConfigurationImportSelector`, which reads `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` and gates each entry with `@Conditional`" |
| 3 Reveal | *show* it on a running context | "here's `--debug`; `DataSourceAutoConfiguration` is a Positive match, `MongoAutoConfiguration` a Negative match because `@ConditionalOnClass` failed — I can see it in `/conditions`" |
| 4 Predict | say what *will* happen, and be right | "if I declare my own `DataSource` `@Bean`, `@ConditionalOnMissingBean` will back off and mine wins — and the report will move it to Negative matches; watch" |
| 5 Trade off | reason about it in a real decision | "I'll *exclude* `SecurityAutoConfiguration` rather than fight its defaults here, because owning the `SecurityFilterChain` bean is clearer than overriding piecemeal — and on a CLI I'd drop the web starter entirely so none of this runs" |

**Principal lives at 4 and 5** — predicting what the container did and using that to make decisions
about how to configure, override, or *not use* a feature. Every drill in this track is designed to
drag you past 2 (where reading leaves you) into 3, 4, and 5.

---

## Weekly cadence (≈ 8–10 focused hours, intensive)

- **~50%** doing the loop — predicting then revealing with `--debug`/Actuator/DEBUG logging,
  setting breakpoints in `refresh()`/`doDispatch()`/`TransactionInterceptor`, running MockMvc and
  slice tests. Non-negotiable; it's where it sticks.
- **~25%** reading the chapter + the matching section of the [Spring reference docs](https://docs.spring.io/spring-framework/reference/)
  and the Spring source it points at.
- **~15%** building the part's hands-on artifact (see the [ROADMAP](ROADMAP.md)) — e.g. write a
  `BeanPostProcessor`, author your own tiny auto-configuration with `@Conditional`, reproduce the
  self-invocation trap and fix it.
- **~10%** spaced-repetition review of the vocabulary layer (behavior → mechanism) + writing one
  "surprise" note.

End every week by adding to that part's `notes.md`: **one thing I revealed that surprised me, one
mental model I corrected, one thing I can now predict.** That file becomes your personal Spring
playbook.

---

## Anti-patterns in *learning* Spring (avoid these to save months)

- **Cargo-cult annotations.** Sprinkling `@Transactional`, `@Async`, `@Cacheable`, `@Component`
  until it works, without knowing they're proxy-based and therefore subject to the self-invocation
  trap, CGLIB's `final` limitation, and bean-vs-call-site semantics. *Default to understanding why an
  annotation has the effect it does — it's almost always "a proxy or a `BeanPostProcessor` did it."*
- **Copying `application.properties` / config you don't understand.** A property you pasted from a
  blog may be a no-op, may be overridden by a profile, or may flip a condition you didn't intend.
  Hit `/configprops` and `/conditions` and confirm the *effective* value and what it gated — don't
  assume the file is the truth.
- **Treating Spring as magic instead of revealing it.** The trap this whole file exists to break.
  "It just works" and "it mysteriously doesn't" are the same failure: you didn't look. There is a
  `/conditions` report, a `/beans` graph, and readable source for *every* decision Boot made. If
  you've read three chapters and run zero `--debug` boots, you're recognizing, not learning.
- **Not reading the source.** Spring's behavior is not folklore to be memorized; it's code to be
  read. Engineers who treat the framework as a sealed box stall at "Explain"; the ones who open
  `DispatcherServlet` and `AbstractAutowireCapableBeanFactory` reach "Predict." The source is the
  spec here.
- **Following version-confused blog posts.** Spring's surface changes fast and the internet hasn't
  caught up. Anchor everything to **Boot 3.x / Framework 6.x / Java 17+**: auto-config lives in
  `AutoConfiguration.imports` (not legacy `spring.factories`); the namespace is `jakarta.*` (not
  `javax.*`); `WebSecurityConfigurerAdapter` is **gone** (configure a `SecurityFilterChain` `@Bean`);
  circular references are **prohibited by default** (since Boot 2.6); tracing is **Micrometer
  Tracing** (not Spring Cloud Sleuth). When a post predates these, it's not a shortcut — it's a
  trap. Prefer the reference docs and the dated source.
- **Over-using Spring features you don't need.** Reaching for WebFlux without a non-blocking
  end-to-end stack (reactive is *not* a free speedup — see [18 · WebFlux](03-web-mvc-and-reactive/),
  and on Boot 3.2+ virtual threads often give you the concurrency win on the simpler servlet stack);
  adding a custom `BeanPostProcessor` where a `@Bean` would do; an event bus where a method call
  would do. Principal judgment is as much about *what to leave off* as what to wire in — the theme of
  [30 · Architecture with Spring & Knowing When Not To](06-principal-skills/), and a recurring note
  in the sibling [LLD track](../LLD/) on when an abstraction earns its keep.
