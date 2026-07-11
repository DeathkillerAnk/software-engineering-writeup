# 12 · Starters & Dependency Management

> A "starter" is not code — it's a **curated POM of transitive dependencies**, version-aligned by the
> Boot **BOM**. Understanding that (and how to write your own) demystifies "why did adding one line
> pull in 40 jars, and how are they all compatible?"
> [← Part 2 · Spring Boot Core](README.md) · prev: 11 · Auto-Configuration · next: 13 · SpringApplication Startup

> **Predict first (2 min).** You add `spring-boot-starter-data-jpa` and never specify a Hibernate or
> HikariCP version — yet the build resolves consistent versions of ~30 libraries. Where do those
> version numbers come from? Write your guess.

---

## A starter is a dependency bundle (usually zero code)

`spring-boot-starter-web` has essentially **no classes** — its job is a **POM that declares the set of
dependencies** a coherent feature needs (Spring MVC, Jackson, validation, embedded Tomcat), so you add
**one** line instead of hand-picking and version-matching a dozen. Starters compose: `-data-jpa`
pulls Spring Data JPA + Hibernate + a connection pool + the transaction bits.

Naming convention: **`spring-boot-starter-*`** for official ones; third parties use
`*-spring-boot-starter` (suffix) to keep the `spring-boot-starter-` prefix reserved for the Boot team.

## Dependency management: the BOM aligns versions

The prediction's answer: **the BOM.** `spring-boot-starter-parent` (or importing
`spring-boot-dependencies` as a BOM) provides a **`<dependencyManagement>`** section pinning
*consistent, tested-together* versions for hundreds of common libraries. So you declare
dependencies **without versions** and Boot supplies numbers that are known to work together — no more
"dependency hell" reconciling Jackson vs Hibernate vs Spring versions by hand.

- **Override a managed version** when you must: set the property (e.g. `<hibernate.version>` /
  Gradle `ext`) rather than pinning the dependency directly — keeps the rest of the BOM coherent.
- ⚡ **Gradle:** the Spring Boot Gradle plugin applies the same management via
  `io.spring.dependency-management` (or the platform BOM) — same idea, different syntax.
- ⚡ Adding a starter is **not free**: it drags transitive deps *and* the auto-configurations
  ([ch.11](README.md)) they trigger. `mvn dependency:tree` / `gradle dependencies` shows what came
  along; exclude what you don't want.

## Writing your own starter (the real understanding check)

A custom starter is exactly the framework's own recipe ([ch.11](README.md)):

1. An **`autoconfigure` module** with your `@AutoConfiguration` classes, guarded by `@Conditional`,
   listed in **`META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`**
   (⚡ the 2.7+ location — not `spring.factories`).
2. A **`starter` module** (the thin POM) that depends on the autoconfigure module + the libraries it needs.
3. Provide `@ConfigurationProperties` for tunables ([ch.14](README.md)), and `@ConditionalOnMissingBean`
   so consumers can override your beans.

That's how every integration (a database, a client library, an internal platform lib) plugs into Boot
with "add the starter, it just works."

## Make it visible

- **See the tree.** `mvn dependency:tree` (or `gradle dependencies`) on a project with
  `starter-data-jpa` — dozens of jars, all version-managed, from one declared line.
- **Find the version source.** Look at `spring-boot-dependencies` (the BOM) for a library you didn't
  version — its `<properties>` and `<dependencyManagement>` are where the numbers come from.
- **Trim it.** Exclude a transitive dep you don't need and confirm the app still starts (and its
  auto-config backs off).

## Self-Check (close the doc, answer out loud)

1. What is a starter — code or configuration? What does adding one line actually do?
2. Where do the (unspecified) dependency versions come from, and what problem does that solve?
3. How do you override a Boot-managed version without breaking the rest?
4. What are the two modules of a custom starter, and where does the auto-config list live now?
5. Why is adding a starter "not free," and how do you inspect/trim what it brought in?

> **Go deeper:** the Boot reference → "Build Systems / Starters" and "Creating Your Own Starter";
> inspect `spring-boot-dependencies`; then [13 · The SpringApplication Startup Sequence](README.md).
