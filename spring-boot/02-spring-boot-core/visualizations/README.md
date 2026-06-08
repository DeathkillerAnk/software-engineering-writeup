# Visualizations · Part 2 — Spring Boot Core

Interactive animations for this part. Conventions and the full philosophy live in
[../../VISUALIZATIONS.md](../../VISUALIZATIONS.md): self-contained single-file HTML, vanilla
JS + canvas/SVG, no build/deps/network, Play/Pause/Step/Reset controls, a "what to notice"
caption, dark terminal-friendly theme.

| File | Status | Medium | Shows | What to notice |
|---|---|---|---|---|
| `autoconfig-conditions.html` | planned | HTML | A list of candidate auto-configuration classes being evaluated against their `@Conditional` gates — `@ConditionalOnClass`, `@ConditionalOnMissingBean`, `@ConditionalOnProperty` — with some matching and contributing beans, some excluded, and `@ConditionalOnMissingBean` **backing off** the moment you define your own bean | Auto-configuration is not magic: it is ordinary conditional `@Configuration`, evaluated in a defined order, and **fully explainable** — this animation is the `ConditionEvaluationReport` (`--debug` / `/actuator/conditions`) made visual. `@ConditionalOnMissingBean` is *why your bean always wins*. |
| `springapplication-run.html` | planned | HTML | The `SpringApplication.run()` sequence step by step: deduce web type → `SpringApplicationRunListeners` (starting) → prepare `Environment` → banner → create `ApplicationContext` → `prepareContext` → **`refreshContext`** → `afterRefresh` → call `ApplicationRunner`/`CommandLineRunner` — with the embedded web server booting *inside* `refresh()` (`onRefresh`) | Where in the sequence the web server actually starts listening — it's during `refresh()`, not after — and that your `CommandLineRunner` only fires once the context is fully up. |

Mermaid (inline in the chapters) covers the static structure for this part: the
`@SpringBootApplication` composition (`@SpringBootConfiguration` + `@EnableAutoConfiguration` +
`@ComponentScan`) and the `starter → auto-configuration → beans` chain.

> Build order suggestion: `autoconfig-conditions.html` first — it demystifies the single biggest
> source of "how did Spring know to do that?", and turns the condition report into something you can
> *watch* rather than squint at.
