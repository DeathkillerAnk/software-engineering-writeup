# Visualizations · Part 0 — Foundations: The Container & IoC

Interactive animations for this part. Conventions and the full philosophy live in
[../../VISUALIZATIONS.md](../../VISUALIZATIONS.md): self-contained single-file HTML, vanilla
JS + canvas/SVG, no build/deps/network, Play/Pause/Step/Reset controls, a "what to notice"
caption, dark terminal-friendly theme.

| File | Status | Medium | Shows | What to notice |
|---|---|---|---|---|
| `bean-lifecycle.html` | planned | HTML | A single bean walking the full ordered path: instantiate → populate properties (DI) → `*Aware` callbacks → `BeanPostProcessor.postProcessBeforeInitialization` → `@PostConstruct` → `InitializingBean.afterPropertiesSet` → custom init-method → `postProcessAfterInitialization` → **[in use]** → `@PreDestroy` → `DisposableBean.destroy` → custom destroy-method | The phases fire in a *precise* fixed order, and `BeanPostProcessor`s **wrap** initialization on both sides — the one that creates the AOP proxy runs in the *after* step, so the object you actually get is the wrapper, not the raw instance. |
| `circular-dependency.html` | planned | HTML | The three-level cache (`singletonObjects` / `earlySingletonObjects` / `singletonFactories`) resolving a setter-injection singleton cycle, then a constructor-injection cycle failing with `BeanCurrentlyInCreationException` | An *early* reference can be exposed (via the `singletonFactories` level) for setter/field injection because the object already exists half-built — but a constructor-injected bean doesn't exist yet when its dependency is needed, so there's nothing to expose and the cycle dies at startup. |
| `di-resolution.html` | planned | HTML | The container resolving an `@Autowired` dependency **by type**, then disambiguating two candidates with `@Primary` / `@Qualifier` | Resolution is *by-type-then-disambiguate*, and unresolved ambiguity (`NoUniqueBeanDefinitionException`) is a **startup** failure, not a runtime one — the container refuses to start rather than guess. |

Mermaid (inline in the chapters) covers the static structure for this part: `BeanFactory` vs
`ApplicationContext` (the superset relationship) and the `AbstractApplicationContext.refresh()`
twelve-step boot sequence.

> Build order suggestion: `bean-lifecycle.html` first — it's the mental model the whole track
> hangs on (every later chapter, AOP and `@Transactional` included, is a footnote to *when*
> a `BeanPostProcessor` runs), and a good template to establish the shared look/controls in
> [../../VISUALIZATIONS.md](../../VISUALIZATIONS.md).
