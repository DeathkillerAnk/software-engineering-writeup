# Part 0 · Foundations: The Container & IoC

> Everything in Spring *is* the container. Boot's "magic" is just the container plus opinions — so
> before any auto-config makes sense, you have to be able to see the container: IoC/DI, the
> `ApplicationContext`, and the bean lifecycle.
> [← curriculum index](../README.md)

This is the part it's most tempting to skip and most expensive to skip. You can ship Spring Boot
services for years treating `@Service` and `@Autowired` as incantations — right up until two beans
of the same type make `@Autowired` throw `NoUniqueBeanDefinitionException`, a `@Transactional` call
silently does nothing because you called it from the same class, or `@PostConstruct` runs at a
moment that surprises you. All of those bottom out here, in the container and its fixed lifecycle.

The whole track rests on a single reframing: **there is no Spring magic — there is only the
container, and every later feature is a bean (or a bean-processing hook) you can list, inspect, and
reason about.** Auto-configuration (Part 2) is conditional beans. AOP and `@Transactional`
(Parts 1 and 4) are beans wrapped by proxies created by a `BeanPostProcessor`. The
`DispatcherServlet` (Part 3) is a bean. Get the container into your hands now and the rest of the
curriculum stops being a pile of annotations and becomes one machine doing its job.

---

## Learning objectives — what "I know this" actually means

By the end of this part you can, **from memory and out loud**:

- Explain **IoC and DI** and the concrete problem they solve — decoupling construction from use,
  testability (you can hand a fake into the constructor), and centralized lifecycle management — and
  say why DI is *one kind* of IoC, not a synonym for it.
- Contrast **`BeanFactory` vs `ApplicationContext`** (the latter is a superset: same bean container,
  plus events, message sources, environment, and eager singleton instantiation), and recite the
  `AbstractApplicationContext.refresh()` sequence at a high level — including *where the web server
  starts* (`onRefresh`) and *where non-lazy singletons are created*
  (`finishBeanFactoryInitialization`).
- Explain **component scanning vs `@Bean`**, and that both ultimately produce the same thing — a
  `BeanDefinition` registered in the context — so neither is "more real" than the other.
- Recite the **full bean lifecycle order** — instantiate → populate (DI) → `*Aware` callbacks →
  `postProcessBeforeInitialization` → `@PostConstruct` → `afterPropertiesSet` → custom init-method →
  `postProcessAfterInitialization` → [in use] → `@PreDestroy` → `destroy()` → custom destroy-method
  — and name the **standard scopes** (singleton, prototype, and the web scopes request/session/
  application/websocket).
- Explain the **three injection styles** (constructor, setter, field), resolution by type with
  `@Primary`/`@Qualifier` to break ambiguity, and *exactly* how singleton setter/field circular
  dependencies resolve via the **three-level cache** while constructor cycles cannot — plus that
  **Boot 2.6+ prohibits circular references by default**.

## Topic checklist

- [ ] **01 · What Spring Is: IoC, DI & the Container** — Inversion of Control as "you don't call the
      framework, it calls you"; DI as the specific IoC technique Spring uses; the problem it kills
      (hard-wired `new`, untestable graphs, lifecycle scattered across the code); the container as
      the thing that owns construction, wiring, and teardown; why this is a *design* win before it's
      a framework feature (ties to [`../../LLD/`](../../LLD/) on dependency inversion).
- [ ] **02 · ApplicationContext & BeanFactory** — `BeanFactory` as the minimal lazy bean container;
      `ApplicationContext` as the superset you actually use (events, i18n message sources,
      `Environment`, resource loading, eager singletons); `AbstractApplicationContext.refresh()` as
      the fixed ordered bootstrap — prepare → obtain BeanFactory → `postProcessBeanFactory` → invoke
      `BeanFactoryPostProcessor`s → register `BeanPostProcessor`s → init message source & event
      multicaster → `onRefresh` (**web server boots here**) → register listeners →
      `finishBeanFactoryInitialization` (**instantiate non-lazy singletons**) → `finishRefresh`.
- [ ] **03 · Bean Definitions & Component Scanning** — the `BeanDefinition` as the container's
      recipe for a bean (class, scope, dependencies, init/destroy hooks, lazy flag); stereotype
      annotations (`@Component`/`@Service`/`@Repository`/`@Controller`) as scan targets;
      `@ComponentScan` and how packages are discovered (and the base-package default at
      `@SpringBootApplication`); `@Configuration` + `@Bean` as programmatic definitions; why
      `@Configuration` classes are CGLIB-enhanced so `@Bean`-to-`@Bean` calls return the singleton.
- [ ] **04 · The Bean Lifecycle & Scopes** — the full ordered pipeline (above); the difference
      between `@PostConstruct`/`InitializingBean`/custom init (and why you usually prefer
      `@PostConstruct` or constructor logic); where **AOP proxies are created** (by a
      `BeanPostProcessor`, typically in `postProcessAfterInitialization`); scopes — singleton (one
      per container, **not** the GoF singleton), prototype (new each lookup, *no* destroy callback),
      and the web scopes; why a prototype injected into a singleton needs a provider/lookup to stay
      fresh.
- [ ] **05 · Dependency Injection Internals & Circular Dependencies** — resolution by type then by
      name; `@Primary` and `@Qualifier` to disambiguate; `Optional`/`ObjectProvider`/collections as
      injection targets; the three injection styles and why **constructor injection is the default
      you should reach for** (final fields, fully-initialized objects, fail-fast, trivially
      testable); the **three-level singleton cache** (`singletonObjects`,
      `earlySingletonObjects`, `singletonFactories`) that lets setter/field singleton cycles resolve
      by exposing an early reference, and why a **constructor cycle cannot** (the object doesn't
      exist yet to expose) → `BeanCurrentlyInCreationException`; Boot 2.6+
      `spring.main.allow-circular-references=false` by default.

## The principal-level insight

**Spring has no magic — there is only the container, and every Boot feature is a bean (or a
bean-processing hook) you can see and reason about.** A `@Component` is not special syntax; it is a
`BeanDefinition` the scanner registered. `@Autowired` is not wiring done by reflection-pixie-dust;
it is *resolution against the bean graph* — find a definition of the required type, disambiguate it,
instantiate its dependencies first. The lifecycle is not a black box; it is a **fixed ordered
pipeline** that runs the same way for every bean, with well-named extension points
(`BeanPostProcessor`) at which the framework — and you — can intervene. Once you see those three
things — definitions, resolution, the pipeline — auto-configuration becomes "conditional
definitions," `@Transactional` becomes "a proxy a post-processor wrapped around my bean," and the
`DispatcherServlet` becomes "a bean the web auto-config registered." The entire rest of this
curriculum is just *the container doing more of the same*. Engineers who never internalize this
spend their careers pattern-matching annotations against Stack Overflow; engineers who do can open
a strange context and *predict* what it contains.

## Drills (build, don't just read)

Spring's superpower — the analog of the [`../../java/`](../../java/) track's *"measure it on a real
JVM"* — is that you can **make the invisible visible**. You never have to *believe* a claim about the
container; you can print it. Do these in a throwaway Boot app, not in your head.

1. **List the container.** On startup, inject the `ApplicationContext` and
   `System.out.println(ctx.getBeanDefinitionCount())`, then dump
   `ctx.getBeanDefinitionNames()` sorted. Marvel at how many beans you never wrote — those are
   auto-configuration. Hit the Actuator `/beans` endpoint for the same data with dependencies. This
   single drill kills the "magic" framing for good.
2. **Watch the lifecycle ordering.** Make one bean that implements `BeanNameAware`,
   `ApplicationContextAware`, `InitializingBean`, `DisposableBean`, *and* has a `@PostConstruct`, a
   `@PreDestroy`, and `@Bean(initMethod=..., destroyMethod=...)`. Log a line in every callback. Run
   it, read the order, and reconcile it against the pipeline in chapter 04 until there are no
   surprises. The order is the syllabus.
3. **Build a cycle on purpose — twice.** Wire `A → B → A` with **setter/field** injection and watch
   it resolve (after flipping `spring.main.allow-circular-references=true`). Then rewrite it with
   **constructor** injection and watch it fail with `BeanCurrentlyInCreationException`. Explain *out
   loud* why the three-level cache rescues the first and structurally cannot rescue the second.
4. **Break an ambiguous `@Autowired`.** Define two beans of the same interface, inject one by type,
   and trigger `NoUniqueBeanDefinitionException`. Fix it three ways — `@Primary`, `@Qualifier`, and
   matching the field name to the bean name — and articulate when each is the right call.
5. **Convert field injection to constructor injection** in something you already wrote, and write
   down the three concrete benefits you got (immutability/`final`, no-Spring unit-testability,
   fail-fast on a missing dependency). If you can't, you don't yet know why it's the default.

## Interview lens

This part is the bedrock of every senior/staff Spring interview — it separates people who *use*
Spring from people who *understand* it. Classic probes: *"What is IoC/DI and what problem does it
solve?"* (decoupling, testability, lifecycle ownership — and DI is one technique of IoC),
*"`BeanFactory` vs `ApplicationContext`?"* (superset: events, i18n, environment, eager singletons),
*"Recite the bean lifecycle"* (the ordered pipeline — interviewers listen for *where the proxy and
`@PostConstruct` land*), *"How does Spring handle circular dependencies, and why does constructor
injection prevent them?"* (three-level cache vs the chicken-and-egg of a constructor), and the
sleeper: *"Singleton scope isn't thread-safe by default — why?"* (one shared instance across all
threads; Spring guarantees *one instance*, not *no shared mutable state* — keep singletons
stateless or guard the state yourself). You're being tested on whether your model is **mechanical
and ordered**, not on whether you can name annotations.

## Visualizations

See [`visualizations/`](visualizations/) for this part's animations — the **bean lifecycle**
pipeline (each callback firing in order), the **circular-dependency** three-level cache (an early
reference exposed mid-construction, and why constructor cycles deadlock), and **DI resolution**
(by-type → disambiguate with `@Primary`/`@Qualifier` → recurse into dependencies). Full philosophy
and catalog in [VISUALIZATIONS.md](../VISUALIZATIONS.md).
