# Part 6 · Principal Skills

> The meta-skills that actually define the level. Everything in Parts 0–5 was *knowledge of the
> framework*; this is *judgment about it* — reasoning about performance with data, knowing when **not**
> to reach for Spring at all, and answering questions no blog covers by going to the source.
> [← curriculum index](../README.md)

You can know every annotation in Parts 0–5 and still not operate like a principal. The difference is
what you do when you *don't* already know the answer, and whether you can tell when the framework is
the wrong tool. This part is that judgment.

---

## Learning objectives — what "I know this" actually means

By the end of this part you can, **from memory and out loud**:

- Run a **Boot performance investigation** treating startup time, request latency, and throughput as
  *distinct* problems: break startup into phases (classpath scan → condition evaluation → bean
  instantiation → server start) and cut it (lazy init, fewer auto-configs, AOT); find the real
  latency bottleneck (the connection pool? the proxy chain? GC? a downstream call?) with Actuator +
  Micrometer + a profiler from the [java track](../../java/05-io-interop-deployment/) — never folklore.
- Reason about **architecture *with* Spring**: use its seams (events, post-processors, proxies)
  deliberately; recognize where DI clarifies coupling and where it *hides* it; weigh modular-monolith
  vs microservice pressures; and — the principal move — **know when not to use a Spring feature, or
  Spring at all** (a tiny CLI, a latency-critical hot path, a place where the framework's lock-in or
  startup cost outweighs the wiring it saves). Ties to [LLD](../../LLD/) and [HLD](../../HLD/).
- **Settle a "how does Spring behave?" dispute from primary sources**: navigate the (genuinely
  readable) Spring source and the reference docs, find the exact mechanism, and track how Boot has
  changed across versions so your knowledge doesn't quietly go stale.

## Topic checklist

- [ ] **29 · Performance & Tuning a Boot App** — startup vs latency vs throughput as separate
      problems with separate tools; the **startup breakdown** and the highest-leverage cuts (lazy
      initialization, trimming auto-config, AOT/native); **request latency** triage — is it the
      HikariCP pool (a concurrency ceiling), the proxy/interceptor chain, serialization, the JVM
      (GC/JIT — hand off to the [java track](../../java/02-execution-and-performance/)), or a
      downstream dependency?; measuring with Actuator/Micrometer timers and a profiler instead of
      guessing; the cost of over-using Spring features (every `@Transactional`/`@Cacheable`/`@Async`
      is a proxy hop).
- [ ] **30 · Architecture with Spring & Knowing When Not To** — using Spring's extension seams on
      purpose vs cargo-culting them; constructor injection and stable boundaries as a *design* tool
      (bridge to [LLD](../../LLD/)); the **modular monolith** as the usually-right default and the
      forces that justify splitting (bridge to [HLD](../../HLD/)); the honest costs — framework
      lock-in, the proxy/reflection tax, startup time, the "everything is a bean" reflex — and the
      cases where *less framework* (plain objects, a thin library, no Spring) is the better call.
- [ ] **31 · Reading the Spring Source & the Reading List** — how the Spring codebase is organized and
      how to read it to answer a behavior question (start at `refresh()`, `doDispatch()`,
      `AutoConfigurationImportSelector`, `TransactionInterceptor`); using the **reference docs** and
      **JavaDoc** as the primary source over blogs; following Boot release notes & migration guides so
      facts don't go stale; and the curated map of books, talks, and people worth your time, sequenced
      by where you're headed.

## The principal-level insight

**A principal is defined not by knowing every annotation but by their *method when they don't know* —
make Spring show you, then read the source — and by the judgment to use *less* framework when that's
the better call.** Everyone above mid-level has a pile of Spring facts. What makes someone the person
the team trusts is two things. First, when a genuinely novel question lands ("why does *this specific*
bean get created / this request stall / this property win?"), they don't guess or paste a Stack
Overflow answer — they **reveal it** (the condition report, an Actuator endpoint, a breakpoint in
`refresh()` or `doDispatch()`), and if it's subtle, they **read the Spring source**, which is
unusually navigable. Second — and this is what most "Spring experts" never reach — they know the
framework is not free, and that the senior-most decision is often *not* to add another
`@Annotation`, *not* to split the monolith, *not* to reach for Spring on a path where a plain object
is clearer and faster. The framework is a tool with a cost; a principal spends it deliberately. Both
habits — *reveal-then-source* and *spend-the-framework-deliberately* — outlive any version of Boot.

## Drills (build, don't just read)

1. **Profile and cut startup.** Measure your app's startup time, then break it down (the
   `startup-cost-breakdown` view; `ApplicationStartup`/`BufferingApplicationStartup` + the
   `/actuator/startup` endpoint). Cut it with lazy initialization and by removing unused
   auto-configurations, and report the before/after. Then try AOT/native and compare again.
2. **Write the internals memo.** Take a real performance or behavior question from your work, run the
   reveal-then-reconcile loop on it, and write a one-page memo: hypothesis → what you revealed
   (the report/endpoint/breakpoint) → conclusion → recommendation. This is *the* principal artifact —
   repeat it for every production oddity forever.
3. **Settle three "facts" against the source.** Pick three things you "know" about Spring (e.g.
   "`@Transactional` rolls back on any exception," "proxies are JDK dynamic by default," "auto-config
   is in `spring.factories`") and find the exact reference-doc section or source method that confirms
   or **corrects** you. At least one will be wrong — that's the point.
4. **Argue *against* Spring.** Take a small component you'd reflexively build with Spring and design it
   with plain objects (no container). Write down what you lost and what you gained. Then decide,
   honestly, which version you'd ship — and articulate the forces (testability, startup, team
   familiarity, lock-in) that decide it.
5. **Map the evolution.** For the last few Boot versions (2.0 → 2.6 → 2.7 → 3.0 → 3.2), list one
   internals-relevant change each and *why* it happened (CGLIB default; circular refs prohibited;
   `AutoConfiguration.imports`; Jakarta + AOT/native + Security 6; virtual threads). This is how you
   keep folklore from creeping back in.

## Interview lens

At the staff/principal bar, interviewers stop testing facts and start testing **judgment and
sourcing**. Probes: *"How would you speed up this app's startup?"* (breakdown → lazy/auto-config/AOT,
with numbers), *"When would you *not* use Spring Boot?"* (a real answer with forces, not "always use
it"), *"You're not sure whether X is guaranteed — how do you find out?"* (reference docs / source /
make-it-visible, not "I'd google it"), *"How do you keep up with the framework?"* The candidate who
reaches for primary sources, a measurement discipline, and the confidence to use *less* framework
reads as someone who can be **trusted with the unknown** — which is the actual job at that level.

## Visualizations

Light here by design — this part is method, not mechanism. See [`visualizations/`](visualizations/):
a **startup-cost-breakdown** animation (where startup time goes and how AOT/native shifts it), plus
two inline-Mermaid aids — a **Spring evolution timeline** (one internals change per version, so facts
stay version-anchored) and a **diagnosis-routing** flowchart (symptom → first instrument). Full
philosophy and catalog in [VISUALIZATIONS.md](../VISUALIZATIONS.md).
