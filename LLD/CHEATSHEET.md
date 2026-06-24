# LLD Master Cheat Sheet — Pre-Interview Review

> The whole LLD track distilled to what you must recall under pressure. Skim this in ~30 minutes
> before an interview; open a [section](README.md) only when a row feels fuzzy.
> Pair with **[INTERVIEW-PROBLEMS.md](INTERVIEW-PROBLEMS.md)** — the classic machine-coding
> problems with worked answers. Language: **Java**.

---

## 1. How to run the round (the script that wins before any code is written)

A 45–60 min LLD/machine-coding round is graded on *process* as much as code. Use this script:

1. **Clarify requirements (5 min).** Ask 4–6 questions, write the agreed scope down. Explicitly
   *de-scope*: "I'll skip payments/persistence/auth unless you want them."
2. **List core entities & relationships (5 min).** Nouns → classes, verbs → methods. Say the
   cardinalities out loud ("a `ParkingLot` has many `Floor`s; a `Spot` holds at most one `Vehicle`").
3. **Define interfaces before implementations (5 min).** The API of your system is the design.
   Write method signatures for the 2–3 main flows first.
4. **Call out the variation points → patterns (2 min).** "Pricing will vary → Strategy.
   Spot allocation will vary → Strategy. Ticket state transitions → State/enum."
   Name the force, *then* the pattern — never the reverse.
5. **Code the core flow end-to-end (25 min).** One happy path working beats five classes
   half-written. Stub what doesn't matter (`// omitted: validation`).
6. **State extensions & tests (5 min).** "To add X I'd only touch Y" is the closing argument
   that you designed for change.

**What interviewers actually grade:** working core flow · separation of concerns ·
invariants enforced in constructors (not scattered ifs) · naming · ability to extend without
rewrite · how you respond to a requirement change mid-round (they *will* inject one).

**Anti-patterns that fail rounds:** god class doing everything · getters/setters on everything
(anemic model) · pattern name-dropping with no force behind it · designing for 10 features when
3 were asked · silence (narrate your trade-offs).

---

## 2. Foundations — objects as invariant-protectors

**The one idea:** an object's job is to **protect an invariant**. Correctness should live in
*one constructor*, not at *every call site*. A class of getters/setters is a struct with extra
steps — every caller shares the job of keeping it valid.

| Concept | The rule | Interview one-liner |
|---|---|---|
| **Identity vs equality** | `==` asks "same object?"; `equals()` asks "same value?" | Mixing them is the root of subtle `HashMap` bugs. |
| **Entity vs Value Object** | Entity = identity outlives its data (User #42); Value = *is* its data (Money, DateRange) | Entities: equality by id, mutable. Values: equality by fields, **immutable**. |
| **`equals`/`hashCode` contract** | Equal objects ⇒ equal hashCodes; consistent; never mutate a field used in `hashCode` while the object is a map key | Violating it makes objects *disappear* from `HashMap`s — the bucket is computed from the stale hash. |
| **Immutability** | `final` fields, no setters, defensive-copy mutable inputs/outputs, class `final` (or use `record`) | Free thread-safety, safe sharing, safe as map keys. Default to immutable; mutate only with a reason. |
| **Interface vs abstract class** | Interface = a *capability contract* (can implement many); abstract class = a *partial implementation* sharing state/skeleton (single inheritance slot) | "Interface for *what*, abstract class for *how much is shared*." Don't burn the single superclass slot for a contract. |
| **Composition > inheritance** | Inheritance couples you to a parent's *implementation* (fragile base class); composition couples only to an *interface* | Inherit only for true is-a + LSP-safe substitution. Otherwise wrap/delegate. |
| **`record`** | Concise immutable value type: `record Money(BigDecimal amount, Currency ccy) {}` — auto `equals`/`hashCode`/`toString`; validate in compact constructor | Use for every Value Object in the interview — fast and signals fluency. |

```java
// Value Object in one slide: immutable, validated once, equality by value
public record Money(BigDecimal amount, Currency currency) {
    public Money {                                  // compact constructor = the invariant gate
        if (amount.scale() > 2) throw new IllegalArgumentException("sub-cent money");
    }
    public Money plus(Money other) {
        if (!currency.equals(other.currency)) throw new IllegalArgumentException("currency mismatch");
        return new Money(amount.add(other.amount), currency);  // returns NEW value
    }
}
```

---

## 3. Coupling, cohesion & SOLID — as forces, not commandments

**Coupling** = how much a change *here* forces a change *there*. **Cohesion** = how much the
things inside one module belong together. All principles are tactics for **low coupling, high
cohesion at the points that will actually change**.

| Principle | One-liner | The smell it fixes | The trap (when it's wrong) |
|---|---|---|---|
| **S**RP | One *reason to change* (one stakeholder/axis of change) per class | God class; shotgun surgery | Over-splitting into 20 anemic classes for a CRUD form |
| **O**CP | Add behavior by adding code (new subclass/strategy), not editing tested code | `switch` on type repeated in N places | Building plugin points for variation that never comes (YAGNI) |
| **L**SP | Subtype must honor the base type's *contract* — no stronger preconditions, no weaker postconditions, no surprise exceptions | `Square extends Rectangle`; `UnsupportedOperationException` in an override | Forcing unnatural hierarchies just to reuse code — use composition |
| **I**SP | Many small client-specific interfaces > one fat one | Implementers stubbing methods they don't need | Interface-per-method dust |
| **D**IP | High-level policy depends on *abstractions*; details are injected | `new PostgresRepo()` inside business logic; untestable code | An interface with exactly one implementation forever = ceremony |

**Supporting cast (drop these in conversation):**
- **Law of Demeter** — talk to friends, not strangers: `a.getB().getC().doIt()` couples you to the whole chain. *Tell, don't ask*: push behavior to where the data lives.
- **DRY** — don't duplicate *knowledge* (a business rule), but duplicated *code* that will evolve differently is fine. "A little duplication is cheaper than the wrong abstraction."
- **YAGNI / KISS** — the simplest design that survives the next ~5 changes. Speculative generality is itself a smell.
- **Dependency Injection** — constructor injection by default; it makes dependencies explicit and tests trivial (pass a fake). No framework needed in an interview — `new Service(new FakeRepo())`.

---

## 4. Design patterns — the ~20 that matter, indexed by force

> Patterns are *consequences of forces*. In the interview say: "pricing varies independently of
> the rest → I'll inject a `PricingStrategy`" — not "I'll use Strategy here."

### Creational — "construction is complex or must vary"

| Pattern | Force | Canonical interview use | Trap |
|---|---|---|---|
| **Factory Method / Simple Factory** | Caller shouldn't know which concrete class to build | `VehicleFactory.create(type)` in Parking Lot; piece creation in Chess | A factory returning one type forever is noise |
| **Abstract Factory** | Need a *family* of related objects that vary together | UI themes; cross-DB driver kits | Rare in LLD rounds — mention, don't build |
| **Builder** | Many optional constructor params; want immutable result + readable construction | `Pizza`, `HttpRequest`, test-data builders | Don't build one for a 2-field class; `record` often suffices |
| **Singleton** | Exactly one instance, global access (loggers, config, the `ParkingLot` itself) | `enum Singleton { INSTANCE }` or holder idiom | Global mutable state, hidden coupling, hard to test — prefer *injecting one instance*; say this out loud |
| **Prototype** | Cloning is cheaper than building | Game object spawning | Rare; deep-vs-shallow copy gotcha |

```java
// Thread-safe lazy singleton — the two answers worth memorizing
enum Config { INSTANCE; }                          // simplest, serialization-safe
class Service {                                    // holder idiom: lazy + no locks
    private Service() {}
    private static class Holder { static final Service I = new Service(); }
    public static Service getInstance() { return Holder.I; }
}
// 3rd option: double-checked locking — requires the field to be `volatile`. Know WHY:
// without volatile, another thread can see a non-null but PARTIALLY CONSTRUCTED object.
```

```java
// Factory Method / Simple Factory — caller names a type, not a class
interface Vehicle { int size(); }
class Car implements Vehicle { public int size() { return 2; } }
class Truck implements Vehicle { public int size() { return 4; } }
class VehicleFactory {
    static Vehicle create(VehicleType t) {
        return switch (t) { case CAR -> new Car(); case TRUCK -> new Truck(); default -> new Bike(); };
    }
}

// Builder — many optional params, immutable result, readable construction
class Pizza {
    private final String size; private final List<String> toppings;
    private Pizza(Builder b) { this.size = b.size; this.toppings = List.copyOf(b.toppings); }
    static class Builder {
        private String size = "M"; private final List<String> toppings = new ArrayList<>();
        Builder size(String s) { this.size = s; return this; }      // fluent: return this
        Builder add(String t) { toppings.add(t); return this; }
        Pizza build() { return new Pizza(this); }                   // validate invariants here
    }
}
Pizza p = new Pizza.Builder().size("L").add("olives").add("feta").build();

// Abstract Factory — a FAMILY that varies together (don't build in a round; recognize it)
interface GUIFactory { Button button(); Checkbox checkbox(); }     // MacFactory / WinFactory implement both
// Prototype — clone instead of rebuild; deep-copy mutable internals
class Enemy implements Cloneable { List<String> loadout = new ArrayList<>();
    public Enemy copy() { Enemy e = new Enemy(); e.loadout = new ArrayList<>(loadout); return e; } } // deep, not shallow
```

### Structural — "fit shapes together / add behavior without subclassing"

| Pattern | Force | Canonical interview use | Trap |
|---|---|---|---|
| **Adapter** | Existing class, wrong interface | Wrapping a 3rd-party payment SDK behind your `PaymentGateway` port | — |
| **Decorator** | Stack optional behaviors at runtime, any combination | Coffee + toppings; `InputStream`s; pizza toppings; logger with timestamp/filter wrappers | Subclass explosion is the smell that calls for it |
| **Facade** | One simple entry point over a messy subsystem | `BookingService.book(...)` hiding inventory+payment+notification | Don't let the facade become the god class |
| **Composite** | Tree where leaves and groups share one interface | File system; nested UI; org charts | — |
| **Proxy** | Stand-in that controls access (lazy, cache, auth, remote) | Cached/locked wrapper over a repository | vs Decorator: proxy controls *access*, decorator adds *behavior* |
| **Flyweight** | Millions of objects sharing intrinsic state | Chess piece types, glyphs | Niche — name it for memory questions |
| **Bridge** | Two dimensions varying independently (abstraction × implementation) | `Shape × Renderer`; `Notification × Channel` | Often over-engineering; two strategies usually suffice |

```java
// Adapter — existing class, wrong interface. Wrap it to fit YOUR port.
interface PaymentGateway { boolean charge(Money m); }              // what your code wants
class StripeSdk { boolean makePayment(long cents) { /* 3rd-party */ return true; } }
class StripeAdapter implements PaymentGateway {
    private final StripeSdk sdk;
    public boolean charge(Money m) { return sdk.makePayment(m.inPaise()); } // translate the call
}

// Decorator — same interface, stack behavior at runtime in any combo
interface Coffee { Money cost(); }
class Espresso implements Coffee { public Money cost() { return Money.ofPaise(15000); } }
abstract class CoffeeDecorator implements Coffee {                 // wraps another Coffee
    protected final Coffee inner; CoffeeDecorator(Coffee c) { this.inner = c; }
}
class Milk extends CoffeeDecorator { Milk(Coffee c){super(c);} public Money cost(){ return inner.cost().plus(Money.ofPaise(2000)); } }
Coffee order = new Milk(new Milk(new Espresso()));                 // double milk, composed not subclassed

// Facade — one friendly entry point hiding a messy subsystem
class BookingService {
    private final InventoryService inv; private final PaymentService pay; private final Notifier notif;
    Booking book(Request r) { inv.reserve(r); pay.charge(r); notif.send(r); return new Booking(r); } // hides the dance
}

// Composite — leaf and group share ONE interface; recursion just works
interface Entry { int size(); }
class File implements Entry { int bytes; public int size() { return bytes; } }
class Directory implements Entry {
    private final List<Entry> children = new ArrayList<>();
    public int size() { return children.stream().mapToInt(Entry::size).sum(); } // recurse uniformly
}

// Proxy — same interface, CONTROLS access (lazy / cache / auth / lock)
class CachingRepoProxy implements Repository {
    private final Repository real; private final Map<Id, Row> cache = new ConcurrentHashMap<>();
    public Row find(Id id) { return cache.computeIfAbsent(id, real::find); } // adds access control, not behavior
}

// Flyweight — share immutable intrinsic state across millions of instances
class GlyphFactory {
    private final Map<Character, Glyph> pool = new HashMap<>();
    Glyph of(char c) { return pool.computeIfAbsent(c, Glyph::new); }  // one Glyph('a') shared everywhere
}

// Bridge — abstraction (Shape) and implementation (Renderer) vary independently
interface Renderer { void drawCircle(double r); }                  // the implementation axis
abstract class Shape { protected final Renderer r; Shape(Renderer r){this.r=r;} abstract void draw(); }
class Circle extends Shape { double rad; Circle(Renderer r){super(r);} void draw(){ r.drawCircle(rad); } }
```

### Behavioral — "vary an algorithm / a reaction / a sequence"

| Pattern | Force | Canonical interview use | Trap |
|---|---|---|---|
| **Strategy** | Swap an algorithm at runtime; kill `switch` repetition | Pricing, spot-allocation, payment method, split rules (Splitwise), eviction policy | The #1 interview pattern. With one method, a lambda IS a strategy |
| **Observer** | One event, many independent reactions; publisher mustn't know subscribers | Notifications on booking/order events; stock price ticker | Unbounded synchronous observer chains; leaks (forgot to unsubscribe) |
| **State** | Behavior changes by lifecycle state; kill nested ifs on a status field | Vending machine, elevator, order lifecycle, ATM | For 3 states with trivial transitions, an enum + switch is *simpler* — say so |
| **Command** | Reify a request: queue it, log it, undo it | Undo/redo (editor), elevator button presses, task scheduler | Don't reify calls that never need queuing/undo |
| **Template Method** | Fixed skeleton, varying steps | `abstract Game.play()` → `initialize/makeMove/winner`; report generation | Inheritance-based; Strategy (composition) is usually more flexible |
| **Chain of Responsibility** | Pass a request along handlers until one handles it | Logger levels, ATM cash dispensing (2000→500→100 notes), middleware, approval workflows | Nobody-handled-it fall-through; debugging opacity |
| **Iterator** | Sequential access without exposing internals | Built into Java (`Iterable`) — just implement it | — |
| **Mediator** | N×N object chatter → route through a hub | Elevator dispatcher; chat room | Mediator becomes a god object |
| **Memento** | Snapshot state for restore without breaking encapsulation | Undo (with Command), game save | Memory cost of snapshots |
| **Visitor** | Many operations over a stable object structure | AST operations; shape exporters | Painful when the structure changes often; double-dispatch confusion |

```java
// Strategy — inject a swappable algorithm; with one method, a lambda IS the strategy
interface PricingStrategy { Money price(Ticket t, Instant exit); }
class WeekendPricing implements PricingStrategy { public Money price(Ticket t, Instant e){ /*...*/ return Money.ZERO; } }
class ParkingLot { private final PricingStrategy pricing; /* ctor-injected; swap without editing ParkingLot */ }
PricingStrategy flat = (t, e) -> Money.ofPaise(5000);             // lambda strategy

// Observer — publisher fans out to subscribers it doesn't know
interface BookingListener { void onBooked(Booking b); }
class BookingService {
    private final List<BookingListener> listeners = new CopyOnWriteArrayList<>();
    void subscribe(BookingListener l) { listeners.add(l); }
    void confirm(Booking b) { /*...*/ listeners.forEach(l -> l.onBooked(b)); } // keep handlers fast
}

// State — the object transitions itself; each state owns its legal actions (see Vending Machine)
interface MachineState { void insertCoin(VendingMachine m, Coin c); void select(VendingMachine m, String slot); }
// IdleState.select -> throws; HasMoneyState.select -> dispenses + setState(new IdleState()). Illegal moves fail in ONE place.

// Command — reify a request so you can queue / log / undo it
interface Command { void execute(); void undo(); }
class AddTextCommand implements Command {
    private final Document doc; private final String text;
    public void execute() { doc.append(text); }
    public void undo() { doc.deleteLast(text.length()); }         // Deque<Command> history = undo/redo
}

// Template Method — fixed skeleton, subclass fills the varying steps
abstract class Game {
    final void play() { init(); while (!over()) move(); announce(); } // skeleton is final
    abstract void init(); abstract boolean over(); abstract void move(); abstract void announce();
}

// Chain of Responsibility — pass along handlers until one acts (ATM notes, log levels)
abstract class Dispenser {
    protected Dispenser next; private final int note;
    Dispenser(int note){ this.note = note; }
    void dispense(int amount) {
        int n = amount / note;
        if (n > 0) emit(note, n);
        int rem = amount % note;
        if (rem > 0 && next != null) next.dispense(rem);           // hand the remainder down the chain
    }
}

// Iterator — sequential access without exposing internals (just implement Iterable)
class Playlist implements Iterable<Song> {
    private final List<Song> songs = new ArrayList<>();
    public Iterator<Song> iterator() { return songs.iterator(); } // now usable in for-each
}

// Mediator — N×N chatter routed through one hub (elevator dispatcher, chat room)
interface Mediator { void route(Message m, Colleague from); }
abstract class Colleague { protected final Mediator hub; Colleague(Mediator h){this.hub=h;} void send(Message m){ hub.route(m, this); } }

// Memento — snapshot/restore without breaking encapsulation (pairs with Command for undo)
class Editor {
    private String content = "";
    record Snapshot(String content) {}                            // opaque to outsiders
    Snapshot save() { return new Snapshot(content); }
    void restore(Snapshot s) { this.content = s.content(); }
}

// Visitor — add operations over a stable structure via double dispatch
interface ShapeVisitor { void visit(Circle c); void visit(Square s); }
interface Shape { void accept(ShapeVisitor v); }                  // Circle.accept(v) calls v.visit(this)
// new operation = new visitor, zero edits to shapes. Cost: adding a shape touches every visitor.
```

### Pattern → problem reflex map (drill this)

| When the problem says… | Reach for |
|---|---|
| "support multiple pricing / payment / splitting / eviction rules" | **Strategy** |
| "notify users when X happens" | **Observer** |
| "the machine/order/ticket goes through states" | **State** (or enum state machine) |
| "build complex object with optional parts" | **Builder** |
| "undo / redo / schedule / queue operations" | **Command** (+ Memento for undo) |
| "different log levels / approval levels / note denominations" | **Chain of Responsibility** |
| "add toppings / wrappers / optional features in any combo" | **Decorator** |
| "single instance coordinating everything" | **Singleton** (then say why DI is better) |
| "create the right object for a type/enum" | **Factory** |
| "same game skeleton, different rules" | **Template Method** or **Strategy** |

---

## 5. Clean code & refactoring — the smell → fix table

**Naming:** name the *intent*, not the mechanics (`overdraftLimit`, not `maxNegBal`). A comment
explaining *what* code does is a failed name; comments are for *why*.

| Smell | Fix (refactoring) |
|---|---|
| Long method / deep nesting | Extract Method; guard clauses + early return |
| God class | Extract Class along reasons-to-change (SRP) |
| Long parameter list | Introduce Parameter Object (often a hidden Value Object) |
| Duplicated `switch` on type | Replace Conditional with Polymorphism (Strategy/State) |
| Primitive obsession (`String userId`, `double money`) | Wrap in Value Objects — `Money`, `UserId` (type system catches swapped args) |
| Feature envy (method using another class's data heavily) | Move Method to where the data lives (tell-don't-ask) |
| Data clumps (same 3 params travel together) | Extract a class for them |
| Message chains `a.getB().getC()` | Hide Delegate (Law of Demeter) |
| Flag arguments `process(order, true)` | Split into two named methods |
| Null returns | `Optional<T>` for "may be absent" returns; Null Object pattern; never `Optional` fields/params |
| Speculative generality | Delete it (YAGNI) |

**Refactoring discipline:** small reversible steps, tests green between every step, never mix a
refactor with a behavior change in one commit. **Testability is a design property** — if it's
hard to test, the design is coupled: inject dependencies, separate pure logic from I/O
(functional core, imperative shell).

---

## 6. Concurrency for LLD — the 9 things they actually ask

1. **The two failure modes:** *race condition* (lost update on shared mutable state — check-then-act, read-modify-write) and *deadlock* (cyclic lock wait). Deadlock fix: acquire locks in a **global fixed order**, or use timeouts/tryLock.
2. **First answer is always: share less.** Immutable objects need no locks. Confine state to one thread. *Then* reach for synchronization.
3. **`synchronized` / `ReentrantLock`** — mutual exclusion on shared state. Lock the *smallest* critical section. `ReentrantLock` adds tryLock, fairness, multiple `Condition`s.
4. **`volatile`** = visibility only (writes seen by other threads), **no atomicity** — `count++` on a volatile is still a race. Use for flags and the DCL singleton field.
5. **Atomics** (`AtomicInteger`, `compareAndSet`) — lock-free counters and CAS loops; the optimistic primitive.
6. **`ConcurrentHashMap`** — the default concurrent collection. Its compound ops are the gold answer: `map.computeIfAbsent(key, k -> new Entry())` is atomic; `if (!map.containsKey(k)) map.put(...)` is a race.
7. **Producer–consumer** = `BlockingQueue` (`ArrayBlockingQueue` for bounded). Bounded queues give **backpressure**. Wait/notify is the manual version — always `while (condition) wait();` (spurious wakeups), never `if`.
8. **Thread pools** (`ExecutorService`) — never raw `new Thread()` per task. Know: fixed pool for CPU-bound (~#cores), larger/virtual threads for IO-bound.
9. **Optimistic vs pessimistic locking** — optimistic (version field, CAS, retry on conflict) for low contention; pessimistic (lock up front) for high contention or expensive retries. *This is the seat-booking / inventory question:* lock the seat row or version-check at confirm time.

```java
// The interview-ready thread-safe cache skeleton
class Cache<K, V> {
    private final ConcurrentHashMap<K, V> map = new ConcurrentHashMap<>();
    V get(K key, Function<K, V> loader) {
        return map.computeIfAbsent(key, loader);   // atomic check-then-act, no double-load per key
    }
}
```

---

## 7. Domain modeling — make illegal states unrepresentable

- **Types over validation:** a `Money` can't be NaN dollars; an `EmailAddress` can't be malformed — because the constructor refuses. Validate once at the boundary, then trust the type everywhere.
- **Enums + state machines:** model lifecycles (`Order: CREATED→PAID→SHIPPED→DELIVERED`) as an explicit transition table; an illegal transition throws *in one place*. Java enums can carry behavior per constant.
- **Sealed interfaces** (`sealed interface Shape permits Circle, Square`) + pattern-matching `switch` = exhaustive handling; the compiler flags a missed case when you add a variant.
- **Aggregate (DDD-lite):** a cluster of objects with one root that enforces all invariants; outside code touches only the root (`Order` owns its `OrderLine`s; you can't mutate a line directly).
- **Null strategy:** absent-by-design → `Optional` return; "should never happen" → throw; "field that's optional" → nullable + named accessor, never `Optional` field.

```java
// State machine in one enum — the pattern behind Vending Machine / Order / Elevator answers
enum OrderState {
    CREATED, PAID, SHIPPED, DELIVERED, CANCELLED;
    private static final Map<OrderState, Set<OrderState>> LEGAL = Map.of(
        CREATED, Set.of(PAID, CANCELLED),
        PAID, Set.of(SHIPPED, CANCELLED),
        SHIPPED, Set.of(DELIVERED));
    OrderState transitionTo(OrderState next) {
        if (!LEGAL.getOrDefault(this, Set.of()).contains(next))
            throw new IllegalStateException(this + " -> " + next);
        return next;
    }
}
```

---

## 8. Rapid-fire Q&A (the conceptual questions before the coding starts)

- **Abstract class vs interface?** Interface = contract of capability, multiple allowed, can have `default` methods but no state. Abstract class = shared state + partial implementation, burns the single inheritance slot. Prefer interface; add an abstract skeleton class only when there's real shared code.
- **Why composition over inheritance?** Inheritance couples to the parent's implementation (fragile base class), is fixed at compile time, single slot. Composition couples to an interface, swappable at runtime, mockable. Inherit only true is-a with LSP intact.
- **How does `HashMap` work / why override both `equals` and `hashCode`?** `hashCode` picks the bucket, `equals` finds the entry within it. Override one without the other and equal objects land in different buckets — lookups fail. Mutating a key's hash fields after insert loses the entry.
- **Why immutability?** One-time validation, free thread-safety, safe sharing/caching, safe map keys, reasoning locality. Cost: allocation churn (usually irrelevant).
- **Singleton — why is it considered harmful?** Global mutable state, hidden dependency (not in any signature), test pollution between tests, concurrency hazards. Better: create one instance at composition root, *inject* it.
- **Strategy vs State?** Same shape (delegate to an interface). Strategy: *client* picks the algorithm, strategies don't know each other. State: the *object* transitions itself between states; states know the transition graph.
- **Decorator vs Proxy vs Adapter?** Adapter *changes* the interface; Decorator *adds behavior*, same interface, stackable; Proxy *controls access* (lazy/cache/auth), same interface.
- **Factory Method vs Abstract Factory?** Factory Method: one product, subclass/branch decides which concrete. Abstract Factory: a *family* of related products created together.
- **`final`, `finally`, `finalize`?** Keyword (no reassign/override/extend) / try-block cleanup (prefer try-with-resources) / deprecated GC hook — never use.
- **Checked vs unchecked exceptions?** Checked = recoverable, caller must decide (mostly out of favor — they leak through signatures); unchecked = programming errors and most modern APIs. Throw early with context; catch only where you can act.
- **What is an anemic domain model?** Data bags + a "service" with all the logic = procedural code in OO clothes. Push behavior into the entities that own the data (tell-don't-ask).

---

## 9. The 30-second pre-interview mantra

> Clarify and **de-scope** first. Nouns → entities, verbs → interface methods. Name the
> **variation points** and inject a Strategy at each. Invariants live in **constructors**.
> Values are **immutable records**; lifecycles are **enum state machines**. One **working
> end-to-end flow** beats five half-classes. When asked to extend: "I add a class, I don't
> edit one." Narrate trade-offs; mention what you'd do with more time.

Next: drill the worked problems in **[INTERVIEW-PROBLEMS.md](INTERVIEW-PROBLEMS.md)**.
