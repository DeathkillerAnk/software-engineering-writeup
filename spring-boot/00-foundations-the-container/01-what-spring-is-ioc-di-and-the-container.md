# 01 · What Spring Is: IoC, DI & the Container

> Before a single annotation makes sense, one reframing has to land: **there is no Spring magic —
> there is only the container.** Every later feature is a bean, or a hook that processes beans, that
> you can list and reason about. This chapter is that foundation.
> [← Part 0 · Foundations: The Container](README.md) · next: 02 · ApplicationContext & BeanFactory

> **Predict first (2 min).** You have an `OrderService` that needs a `PaymentGateway`. Without a
> framework you'd write `this.gateway = new StripeGateway()` in the constructor. Name two concrete
> things that go wrong as the app grows — one about *testing*, one about *change*. Write your guess.

---

## Inversion of Control: "don't call us, we'll call you"

Normal code is in control: *your* code decides what to construct, when, and wires it together with
`new`. **Inversion of Control (IoC)** flips ownership of that flow to a framework: you declare *what*
you need; the framework decides *when to build it and how to connect it*, and calls into your code at
the right moments. This is the "Hollywood principle" — *don't call us, we'll call you*.

IoC is a broad idea (template methods, event callbacks, and DI are all forms of it). Spring's
specific technique is **Dependency Injection**.

## Dependency Injection: hand it what it needs

The prediction's answer — hard-wiring `new StripeGateway()` inside `OrderService` hurts two ways:

- **Testing:** you can't unit-test `OrderService` without hitting real Stripe. The dependency is
  welded in; there's no seam to substitute a fake.
- **Change:** switching gateways, or having two implementations, means editing `OrderService` itself.
  Construction knowledge is scattered across every class that says `new`.

DI removes the `new`: the dependency is **passed in** (injected) rather than constructed internally.

```java
// welded — untestable, rigid
class OrderService {
  private final PaymentGateway gateway = new StripeGateway();   // ← the problem
}

// dependency injected — a seam you control
class OrderService {
  private final PaymentGateway gateway;
  OrderService(PaymentGateway gateway) { this.gateway = gateway; }   // hand it in
}
```

Now `OrderService` depends on the **`PaymentGateway` abstraction**, not a concrete class. A test hands
in a fake; prod hands in Stripe; nothing inside `OrderService` changes. This is the
**Dependency Inversion Principle** ([LLD track](../../LLD/)) made concrete — and note the payoff
exists *before* any framework: DI is a design win first, a Spring feature second.

## The container: what owns construction, wiring, and teardown

Someone still has to create `StripeGateway`, pass it to `OrderService`, and manage their lifetimes.
That someone is the **Spring IoC container** (the `ApplicationContext` — [ch.02](README.md)). You
give it definitions — "here are the components, here's what each needs" — and it:

1. **Constructs** each object (a **bean**) in dependency order.
2. **Injects** dependencies (wires the graph).
3. **Manages the lifecycle** — initialization callbacks, then destruction on shutdown ([ch.04](README.md)).

```mermaid
flowchart LR
  defs["bean definitions (@Component, @Bean)"] --> container["IoC container (ApplicationContext)"]
  container --> construct["1. construct each bean"]
  construct --> inject["2. inject dependencies"]
  inject --> life["3. run lifecycle callbacks"]
  life --> wired["a wired object graph you never called new on"]
```

You stopped writing `new` and wiring code; the container owns it centrally. That's the whole trade:
**hand the framework control of object construction and lifetime, and get decoupling, testability,
and one place that manages the graph.**

## The mental model to carry through the whole track

Everything else in Spring is *this machine doing more of the same*:

- A `@Component`/`@Service` is not special syntax — it's a **`BeanDefinition`** the scanner registered
  ([ch.03](README.md)).
- `@Autowired` is not reflection pixie-dust — it's **resolution against the bean graph**: find a
  definition of the required type, disambiguate it, build its dependencies first ([ch.05](README.md)).
- The lifecycle is not a black box — it's a **fixed, ordered pipeline** with named extension points
  (`BeanPostProcessor`) where the framework *and you* can intervene ([ch.04](README.md), [Part 1](../01-extension-and-aop/)).

⚡ Once you hold *definitions → resolution → pipeline*, the "magic" dissolves: auto-configuration
([Part 2](../02-spring-boot-core/)) is **conditional definitions**; `@Transactional`/AOP
([Part 4](../04-data-and-transactions/)) is **a proxy a post-processor wrapped around your bean**; the
`DispatcherServlet` ([Part 3](../03-web-mvc-and-reactive/)) is **a bean**. Engineers who never
internalize this pattern-match annotations against Stack Overflow forever; those who do can open a
strange context and *predict* what it contains.

## Make it visible

- **Kill the magic in one line.** Inject the `ApplicationContext`, print
  `ctx.getBeanDefinitionCount()` and the sorted `getBeanDefinitionNames()` on startup. The dozens of
  beans you never wrote *are* the framework — all just beans in the same container.
- **Feel the seam.** Unit-test the injected `OrderService` by passing a hand-written fake
  `PaymentGateway` — no Spring, no Stripe, no mocking framework needed. That ease *is* the DI payoff.
- **Same bean, two definitions.** Register a bean via `@Component` and another via `@Bean`; confirm
  both show up as ordinary `BeanDefinition`s — neither is "more real."

## Self-Check (close the doc, answer out loud)

1. Define IoC in one sentence, and say why DI is *a kind* of IoC rather than a synonym.
2. Give the two concrete problems that hard-wiring `new` inside a class causes.
3. What three things does the container own for every bean?
4. Restate `@Component`, `@Autowired`, and the lifecycle in "there is no magic" terms.
5. Why is DI a design win even in a project that never uses Spring?

> **Go deeper:** the Spring reference → "The IoC Container / Introduction"; Martin Fowler's
> "Inversion of Control Containers and the Dependency Injection pattern"; then
> [02 · ApplicationContext & BeanFactory](README.md), where this container gets a concrete type and a
> boot sequence.
