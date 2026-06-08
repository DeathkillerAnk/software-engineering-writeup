# 02 — Design Patterns · Teaching Notes

> Read with the [syllabus](README.md). **Don't memorize 23 patterns — learn the ~8 forces that
> generate them.** A pattern is a named response to a recurring force; know the force and you can
> derive the pattern. 🎬 [Decorator: compose behavior at runtime](visualizations/decorator.html)

---

## The 8 forces (this is the whole section in one table)

```mermaid
flowchart TD
    F["A force pushing<br/>on your design"]
    F --> C1["Creation is complex / must vary"] --> P1["Factory · Builder · Prototype"]
    F --> C2["Behavior must vary at runtime"] --> P2["Strategy · State · Template Method"]
    F --> C3["One change must fan out"] --> P3["Observer · Mediator"]
    F --> C4["Incompatible interfaces must cooperate"] --> P4["Adapter · Facade · Bridge"]
    F --> C5["Add responsibility w/o subclass explosion"] --> P5["Decorator · Proxy"]
    F --> C6["Treat one & many uniformly"] --> P6["Composite · Iterator"]
    F --> C7["Decouple a request from its handling"] --> P7["Command · Chain of Responsibility"]
    style F fill:#1f2937,color:#fff
    style P2 fill:#0c2e22,color:#fff
    style P5 fill:#0c2e22,color:#fff
```

Master the **workhorses** (Strategy, Observer, Decorator, Factory, Command) at depth-level 5
(*choose vs alternatives, out loud*); know the rest at level 3 (*derive from the force*).

---

## Strategy — behavior varies at runtime

```mermaid
classDiagram
    class Context { -Strategy s; +run() }
    class Strategy { <<interface>> +execute() }
    class FastSort { +execute() }
    class SafeSort { +execute() }
    Context o--> Strategy
    Strategy <|.. FastSort
    Strategy <|.. SafeSort
```

> In modern Java a **lambda IS a Strategy**: `Comparator<T>` is a one-method interface, so
> `list.sort((a,b) -> ...)` is the Strategy pattern with no boilerplate class.

## Observer — one change fans out to many

```mermaid
classDiagram
    class Subject { +subscribe(o) +notifyAll() }
    class Observer { <<interface>> +update(event) }
    class EmailObserver { +update(event) }
    class AuditObserver { +update(event) }
    Subject o--> "many" Observer
    Observer <|.. EmailObserver
    Observer <|.. AuditObserver
```

> Cost to name out loud: Observer hides control flow and leaks memory if you forget to unsubscribe.
> For a single listener, just call it directly.

## Decorator — add responsibility without subclass explosion  🎬 [animation](visualizations/decorator.html)

```mermaid
classDiagram
    class Beverage { <<interface>> +cost() +description() }
    class Espresso { +cost() +description() }
    class Milk { -Beverage inner; +cost() +description() }
    class Whip { -Beverage inner; +cost() +description() }
    Beverage <|.. Espresso
    Beverage <|.. Milk
    Beverage <|.. Whip
    Milk o--> Beverage : wraps
    Whip o--> Beverage : wraps
```

Each decorator **wraps** a `Beverage` and delegates inward, adding its bit. `new Whip(new Milk(new
Espresso()))` composes at runtime — no `EspressoWithMilkAndWhip` class, no combinatorial explosion.

## Factory Method & Command (the other two workhorses)

```mermaid
flowchart LR
    subgraph Factory
      caller1["caller"] --> f["createShape(type)"] --> obj["a Shape"]
    end
    subgraph Command
      caller2["invoker"] --> cmd["«interface» Command.execute()"] --> rec["Receiver"]
    end
```

> A **method reference is a Command**; an **`enum` is the cleanest Singleton**. Modern Java already
> hands you several classic patterns for free — recognizing that is itself senior judgment.

---

## The principal-level insight

**Patterns are a vocabulary for communication, not a goal for code.** A junior bends code to fit a
pattern; a principal lets the pattern *emerge* because the force was real — and reaches for a plain
method or `if` when the force isn't. Always be able to answer **"why not just a plain method/lambda
here?"** An over-applied pattern (a `FactoryFactory` for two cases) is a *senior-level smell*, not a flex.

## Interview lens

"Now add a new type of X without touching existing code" = Strategy/Factory/OCP. The trap is reaching
for a heavy pattern when a lambda or `if` would do — that reads as inexperience. Name the pattern out
loud (shared vocabulary speeds the round) **and** name why the simpler option wasn't enough.

---

## Now do the drill

[`src/`](src/) — implement the `Milk` and `Whip` decorators so `cost()`/`description()` compose by
wrapping. Run instructions in [`src/README.md`](src/README.md), then re-open the
[Decorator animation](visualizations/decorator.html).

> Next → [`03` Clean Code & Refactoring](../03-clean-code-and-refactoring/).

## What I learned
<!-- one force you now get, one mistake, one thing you'd do differently -->
- _force:_
- _mistake:_
- _next time:_
