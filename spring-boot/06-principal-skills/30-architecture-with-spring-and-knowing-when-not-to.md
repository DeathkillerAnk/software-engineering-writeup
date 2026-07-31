# 30 · Architecture with Spring & Knowing When Not To

> The last skill is judgment: using Spring's seams *on purpose*, defaulting to the modular monolith,
> and — the part juniors never say out loud — recognizing when **less framework** is the better
> engineering call.
> [← Part 6 · Principal Skills](README.md) · prev: 29 · Performance & Tuning · next: 31 · Reading the Source

> **Predict first (2 min).** Your team builds a small library used by 40 services — pure computation,
> no I/O, no config. A teammate reaches for `@Component` + auto-configuration "so it integrates
> nicely." What costs would that add, and what would you do instead? Write your guess.

---

## Using the seams on purpose

This track met every extension seam Spring offers; architecture is choosing them *deliberately*:

- **Constructor injection + interfaces at boundaries** ([ch.01](../00-foundations-the-container/),
  [ch.05](../00-foundations-the-container/)) is a *design* tool before a framework feature: stable,
  testable module boundaries (the [LLD track](../../LLD/)'s dependency-inversion, applied).
- **`BeanPostProcessor`/`@ConfigurationProperties`/custom starters** ([Part 1](../01-extension-and-aop/),
  [ch.12](../02-spring-boot-core/)) — for platform teams: encode org conventions once, ship a
  starter, every service inherits them. This is Spring's highest-leverage architectural use.
- **Events** ([ch.09](../01-extension-and-aop/)) decouple modules *inside* a process — the modular
  monolith's connective tissue.
- ⚡ Cargo-cult test: if you can't say *which problem* the seam solves here, it's decoration.

## The modular monolith default

One deployable, **strictly modularized inside** (packages/modules with enforced boundaries, events
between them) is the usually-right default: one deploy, one transaction boundary
([ch.22](../04-data-and-transactions/)), refactorable boundaries, no network between modules.
Split a module out only when a **force** demands it: independent scaling, independent deploy cadence,
team ownership/conways-law pressure, or a hard isolation requirement — the [HLD track](../../HLD/)'s
territory. **Distribution is a cost you pay for a reason, not an architecture aesthetic.** Spring
serves both shapes: the same module with constructor-injected boundaries extracts to a service far
more easily than a bean-soup ball of mud.

## The honest costs of the framework

Name them, so the choice is a choice:

- **Proxy/reflection tax** ([ch.29](README.md)) and **startup time** ([ch.29](README.md)).
- **Framework lock-in** — `@Transactional`/`@Autowired` woven through *domain* code couples your core
  logic to Spring. Mitigation: keep the domain plain (constructor-injected POJOs), let Spring live at
  the edges (web, persistence, config) — hexagonal-ish layering without the ceremony.
- **The "everything is a bean" reflex** — stateless singletons for things that wanted to be plain
  `new`-ed values ([ch.04](../00-foundations-the-container/)'s scopes exist for a reason); DI for
  data objects; configuration for constants. Beans are for things with *lifecycle or dependencies*.
- **Magic-debugging cost** — every convention a newcomer must reverse-engineer; this whole track
  exists because "no magic" must be *learned*.

## When less framework wins

The prediction's answer: a pure-computation library gains **nothing** from `@Component` — and inherits
a Spring dependency, container startup in every consumer's tests, and version coupling across 40
services. Ship it as a **plain jar with plain constructors**; consumers who use Spring can declare a
`@Bean` in one line. Same judgment applies to:

- **Tiny tools/CLIs** — a `main()` and plain objects beat a 3-second container boot.
- **Latency-critical hot paths** — hand-wired plain objects, no proxies ([ch.29](README.md)).
- **Domain cores** — plain Java, framework at the edges (above).
- ⚡ The test: **Spring earns its keep where lifecycle, wiring, config, and integration complexity
  live.** Where those are absent, the container is pure overhead — and saying so is a principal-level
  contribution, not heresy.

## Make it visible

- **De-Spring a domain class.** Take one `@Service` with no Spring-specific needs; make it a plain
  class constructed in a `@Configuration`. Note: tests no longer need Spring at all.
- **Draw your module graph.** Packages + who-calls-whom in your real app; find one place events
  would cut a cycle, and one boundary that could extract to a service if forces demanded.
- **Audit a starter's cost.** For one convenience starter you use: dependency count
  (`dependency:tree`), auto-configs fired (`/actuator/conditions`), beans added (`/actuator/beans`) —
  then decide *consciously* to keep it.

## Self-Check (close the doc, answer out loud)

1. Which Spring seams are architectural tools for a platform team, and what do they encode?
2. Why is the modular monolith the default, and name three forces that justify splitting.
3. List four honest costs of the framework and one mitigation each.
4. Give three situations where *less framework* wins, and the general test.
5. How does constructor injection serve architecture even if Spring disappeared tomorrow?

> **Go deeper:** the [LLD](../../LLD/) and [HLD](../../HLD/) tracks (this chapter is the bridge);
> "Modular Monolith" writings (Fowler's site); Spring Modulith (the framework's own take on enforced
> modules); then [31 · Reading the Spring Source](README.md).
