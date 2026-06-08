# 02 — Design Patterns

> **Do not memorize 23 patterns. Learn the ~8 forces that generate them.** A pattern is just a
> named, battle-tested response to a recurring force. If you know the force, you can derive the
> pattern — and invent the unnamed ones. This is the biggest single time-saver in the track.

## Learning objectives
By the end you can:
- Map a *force* to the right pattern reflexively (force→pattern, the only direction that matters).
- Implement the high-value patterns idiomatically in Java.
- State each pattern's **cost** and name a situation where it's the wrong choice.
- Recognize over-engineering — a misapplied pattern is a senior-level smell, not a flex.

## The 8 forces (learn these cold; the patterns hang off them)
| Force (what's pushing on your design) | Patterns it generates |
|---------------------------------------|------------------------|
| Object creation is complex / must vary | Factory Method, Abstract Factory, Builder, Prototype, (Singleton — usually a smell) |
| Behavior must vary at runtime | **Strategy**, State, Template Method |
| One change must fan out to many objects | **Observer**, Mediator |
| Two incompatible interfaces must cooperate | **Adapter**, Facade, Bridge |
| Add responsibility without subclass explosion | **Decorator**, Proxy |
| Treat one and many uniformly | **Composite**, Iterator |
| Decouple a request from its handling | **Command**, Chain of Responsibility |
| Centralize / encapsulate complex collaboration | Mediator, Facade, Visitor |

> The **bold** ones are the workhorses — Strategy, Observer, Adapter, Decorator, Factory, Command,
> Composite, Iterator. Know these at depth-level 5 (see STUDY-METHOD); know the rest at level 3.

## Topic checklist
- [ ] **Creational** — Factory Method, Abstract Factory, Builder (great in Java for many params), Prototype, Singleton (*and why it's usually a global-state anti-pattern — prefer DI*).
- [ ] **Structural** — Adapter, Decorator, Facade, Proxy, Composite, Bridge, Flyweight.
- [ ] **Behavioral** — Strategy, Observer, Command, State, Template Method, Chain of Responsibility, Iterator, Mediator, Visitor, Memento.
- [ ] **Concurrency patterns** — Producer/Consumer, Thread Pool, Future/Promise, immutable-object sharing (links to `04`).
- [ ] **Java idioms** — `enum` singletons & strategies, functional interfaces + lambdas *as* Strategy/Command, `Optional` as Null Object, sealed classes for State.
- [ ] **Anti-patterns** — God Object, Singleton-as-global-state, Anemic Domain Model, Poltergeist, premature abstraction.

## The principal-level insight
**Patterns are a vocabulary for communication, not a goal for code.** The mark of a junior using
patterns is code bent to fit a pattern; the mark of a principal is code where the pattern *emerged*
because the force was real — and where simpler code was chosen when the force wasn't. Modern Java
also dissolves several classic patterns: a lambda *is* a Strategy, a method reference *is* a Command,
`enum` *is* the cleanest Singleton. Knowing when the language already gives you the pattern for free
is itself senior judgment. **Always be able to answer "why not just a plain method/if-statement here?"**

## Drills (build these)
For each of the 8 forces:
1. Build the smallest possible Java example that genuinely *needs* the pattern.
2. Then write **one paragraph describing a situation where reaching for it would be overkill**, and what you'd do instead. (This is the level-4 critique drill — don't skip it.)
3. Replace one OOP pattern with its functional-Java equivalent (e.g. Strategy → `Function`/lambda) and compare.

## Interview lens
Interviewers love "now add a new type of X without touching existing code" — that's Strategy/Factory/
OCP. The trap they set: applying a heavy pattern when an `if` or a lambda would do, which reads as
inexperience. Narrate the trade-off ("a Strategy here because rules will grow; if it were just two
fixed cases I'd inline it"). Naming patterns out loud also speeds the interview — it's shared vocabulary.

> Next: patterns make code *changeable*; this section makes it *readable and safe to change* → [`03`](../03-clean-code-and-refactoring/).
