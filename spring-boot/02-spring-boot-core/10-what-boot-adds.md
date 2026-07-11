# 10 · What Boot Adds: Opinions, Starters & the Philosophy

> Spring Boot isn't a new framework — it's **opinionated defaults on top of plain Spring**. Knowing
> *what* it adds (and the mental shift it asks for) frames everything in this part.
> [← Part 2 · Spring Boot Core](README.md) · next: 11 · Auto-Configuration Internals

> **Predict first (2 min).** Plain Spring MVC needs a `web.xml` (or config), a `DispatcherServlet`
> bean, a view resolver, a servlet container to deploy into, a `DataSource`, a JSON mapper… What does
> a Boot "hello world" require *you* to configure for the same? Write your guess.

---

## The shift: from "configure everything" to "override the non-default"

Plain Spring is a powerful but *unopinionated* toolkit — it makes you wire the `DispatcherServlet`,
pick and configure a container, declare a `DataSource`, register a JSON converter, choose logging,
and so on. Boot inverts the default: **it assumes a sensible setup and lets you override only what's
different.** The prediction's answer: a Boot web app needs **~nothing** — add
`spring-boot-starter-web`, write a `@RestController`, run `main`. That's the whole philosophy:
*convention over configuration*, with an escape hatch for every convention.

Boot adds five things on top of the Spring container ([Part 0](../00-foundations-the-container/)):

| # | What | Covered in |
|---|---|---|
| 1 | **Starters** — curated dependency bundles (one line pulls a coherent, version-aligned set) | [ch.12](README.md) |
| 2 | **Auto-configuration** — conditional beans that react to your classpath & properties | [ch.11](README.md) |
| 3 | **Embedded servers** — Tomcat/Jetty/Netty *in* your app; run a jar, not a WAR-in-a-container | [ch.15](README.md) |
| 4 | **Externalized configuration** — one precedence model across files/env/args | [ch.14](README.md) |
| 5 | **Production-readiness** — Actuator (health/metrics/info), sensible logging, graceful shutdown | [Part 5](../05-production/) |

Plus `SpringApplication.run()` to bootstrap it all ([ch.13](README.md)) and the executable
"fat jar" ([ch.27](../05-production/)).

---

## The mental model: opinions you can always override

Every Boot default is backed by a `@ConditionalOnMissingBean` ([ch.11](README.md)) — so *define your
own bean and Boot backs off*. This is the crucial framing for the rest of this part: Boot isn't magic
you fight, it's **defaults you accept or replace, and it will tell you which fired** (`--debug` /
`/actuator/conditions`).

- ⚡ **What Boot is NOT:** it doesn't change the Spring programming model — it's the same
  `ApplicationContext`, beans, and `@Transactional`/AOP proxies underneath. "Boot magic" is *always*
  reducible to container mechanics you already know.
- **When *not* to reach for a Boot feature** (the principal note): Boot's convenience can hide cost —
  a starter drags in transitive deps and auto-configs you may not want; for a tiny library or a
  latency-critical path, plain Spring (or no Spring) can be the better call. Convenience is a
  trade-off, spent deliberately ([Part 6](../06-principal-skills/)).

---

## Make it visible

- **The "nothing to configure" proof.** A `@SpringBootApplication` + one `@RestController` + `main`,
  with only `spring-boot-starter-web` on the classpath, serves HTTP on `:8080` — no XML, no container
  install. Count the lines you *didn't* write.
- **See everything it added.** Start with `--debug` and read the **ConditionEvaluationReport** (or
  `/actuator/beans`) — the long list of beans you never declared *is* "what Boot adds."
- **Override one default.** Define your own `ObjectMapper` (or `DataSource`) `@Bean` and watch Boot's
  auto-configured one back off (`@ConditionalOnMissingBean` — [ch.11](README.md)).

---

## Self-Check (close the doc, answer out loud)

1. Is Spring Boot a new framework? What's the one-sentence relationship to plain Spring?
2. Name the five things Boot adds on top of the container.
3. What's the mental shift Boot asks for, and what mechanism makes "override only the non-default" work?
4. What does Boot *not* change, and why does that matter for reasoning about "magic"?
5. Give a concrete case where you'd *not* reach for a Boot convenience.

> **Go deeper:** the Boot reference → "Introducing Spring Boot"; then [11 · Auto-Configuration
> Internals](README.md) and [12 · Starters](README.md), which make items 1–2 concrete.
