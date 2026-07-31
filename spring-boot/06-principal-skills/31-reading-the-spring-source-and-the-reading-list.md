# 31 · Reading the Spring Source & the Reading List

> The map for after: how the Spring codebase is organized, the four entry points that answer 90% of
> behavior questions, which sources to trust in which order, and the curated reading list.
> [← Part 6 · Principal Skills](README.md) · prev: 30 · Architecture with Spring

---

## Reading the source: four entry points

Spring's code is famously readable once you know where to stand. Four methods answer most "what does
it *actually* do?" questions — all met in this track:

| Question about… | Start at | Track chapter |
|---|---|---|
| container startup, bean creation order | `AbstractApplicationContext.refresh()` | [ch.02](../00-foundations-the-container/) |
| request handling, handler resolution | `DispatcherServlet.doDispatch()` | [ch.16](../03-web-mvc-and-reactive/) |
| why an auto-config applied/didn't | `AutoConfigurationImportSelector` (+ your `/actuator/conditions`) | [ch.11](../02-spring-boot-core/) |
| transaction begin/commit/rollback | `TransactionInterceptor.invoke()` → `TransactionAspectSupport` | [ch.22](../04-data-and-transactions/) |

Method: **breakpoint first, read second.** Set a breakpoint in the entry point, run one request/boot,
and walk the real stack with your real beans — an hour of this beats a week of blog posts. (Same
javadoc-first discipline as [java ch.30](../../java/06-principal-skills/): Spring's class-level
javadoc — `AbstractApplicationContext`, `DispatcherServlet` — is written as design documentation.)

## Source hierarchy: what to trust, in order

1. **Reference docs** (docs.spring.io — Framework, Boot, Data, Security) — current, versioned,
   canonical semantics.
2. **JavaDoc** — per-class contracts; often the only place edge-case behavior is stated.
3. **The source itself** — for the "exactly when/what order" questions the docs round off.
4. **Boot release notes & migration guides** (GitHub wiki) — *how facts go stale*; this track's
   version-anchored claims ([VERSION-CHANGES.md](../VERSION-CHANGES.md)) came from here. Skim every
   minor release; read every major migration guide.
5. Blogs/Stack Overflow — *last*, as leads to verify against 1–4, not as truth. Half the confident
   Spring answers online describe a version two majors ago.

## The reading list

**During/right after this track**

- **Spring reference: "Core Technologies"** (the IoC chapter) — re-read after
  [Part 0](../00-foundations-the-container/); it reads completely differently once you have the model.
- **Boot reference: "Core Features"** + the **executable-jar** and **actuator** chapters — the
  primary source behind [Parts 2 & 5](../02-spring-boot-core/).
- **Spring Security reference: "Architecture"** — the filter-chain chapter ([ch.24](../05-production/))
  from the authors.
- **Vlad Mihalcea — *High-Performance Java Persistence*** (+ his blog) — the JPA/Hibernate depth
  behind [Part 4](../04-data-and-transactions/); the single best follow-on investment.

**Deepening**

- **Spring Modulith docs** — enforced module boundaries ([ch.30](README.md)) as a supported practice.
- **HikariCP wiki ("About Pool Sizing")** — short, canonical, changes how you size pools forever.
- **Reactor reference + "Which operator do I need?"** — if WebFlux ([ch.18](../03-web-mvc-and-reactive/))
  is in your future.
- **Talks:** Juergen Hoeller (Framework directions), Phil Webb / Andy Wilkinson (Boot internals,
  executable jar, AOT), Josh Long (breadth, demos), Oliver Drotbohm (Modulith, Data), Rossen
  Stoyanchev (WebFlux/RSocket).

**By destination**

- **Platform/infra engineer:** custom starters + `BeanPostProcessor` mastery
  ([Part 1](../01-extension-and-aop/), [ch.12](../02-spring-boot-core/)) → Boot's own autoconfigure
  module source — the best starter-writing tutorial is reading theirs.
- **Data-heavy services:** Mihalcea's book → Spring Data source (`RepositoryFactorySupport`,
  [ch.20](../04-data-and-transactions/)).
- **Distributed systems:** the [HLD track](../../HLD/) + *Designing Data-Intensive Applications* —
  Spring Cloud makes sense only on top of those fundamentals.

## The habit

Same as the [java closer](../../java/06-principal-skills/): **one primary source per week**, tied to
something you shipped. When Boot releases a minor, skim the notes and update your mental
`VERSION-CHANGES`. And when a teammate asks "why does Spring do X?" — breakpoint `refresh()` or
`doDispatch()` together. Teaching the no-magic model is how it sticks.

> 🎉 **This closes the spring-boot track** — Parts 0–6, all chapters — and with the
> [java track](../../java/) complete, the whole two-track internals curriculum. The container is not
> magic; the JVM is not magic; and now you can prove both, with tools, from memory.
