# LLD Interview Problems & Answers

> The classic machine-coding / LLD-round problems, each worked the way you should present it:
> **clarify → entities → interfaces → patterns (as forces) → core code → follow-ups.**
> Drill rule: attempt each one *cold* on a 45-min timer first, then read the answer.
> Companion: [CHEATSHEET.md](CHEATSHEET.md) for the concepts these answers lean on.

**The big 8 (asked everywhere):** Parking Lot · Elevator · Vending Machine · LRU Cache ·
Splitwise · Movie Ticket Booking · Snake & Ladder / Tic-Tac-Toe · Logger Framework.
Then a rapid-fire section (§9) for the rest: Rate Limiter, Notification Service, Cab Booking,
Library, Online Shopping, Task Scheduler, File System, ATM, Meeting/Conference Room Scheduler,
Hotel Booking, Stock Exchange / Order Matching, Pub/Sub Queue, In-memory KV Store with TTL,
Connection Pool, Deck of Cards, URL Shortener, Text Editor.

---

## 1. Parking Lot ⭐ (the #1 asked problem)

**Clarify:** multiple floors? vehicle types (bike/car/truck)? pricing model (hourly? per type?)?
multiple entry/exit gates (→ concurrency)? Spot finding strategy (nearest? any?)?

**Entities:** `ParkingLot` → `Floor`s → `ParkingSpot`s (typed: `BIKE/COMPACT/LARGE`),
`Vehicle` (type, plate), `Ticket` (id, vehicle, spot, entryTime), `Gate` (entry/exit).

**Forces → patterns:**
- Spot allocation varies (nearest, random, cheapest) → **Strategy** (`SpotAssignmentStrategy`)
- Pricing varies (hourly, flat+hourly, per-type, weekend) → **Strategy** (`PricingStrategy`)
- Right spot type for a vehicle → simple **Factory**/mapping
- One lot coordinating gates → often shown as **Singleton**; better: one instance injected into gates
- Multiple gates assigning spots concurrently → lock per floor or `ConcurrentHashMap` + atomic claim

```java
enum VehicleType { BIKE, CAR, TRUCK }
enum SpotType { BIKE, COMPACT, LARGE;
    boolean fits(VehicleType v) {
        return switch (v) {
            case BIKE -> true;
            case CAR -> this != BIKE;
            case TRUCK -> this == LARGE;
        };
    }
}

class ParkingSpot {
    final String id; final SpotType type;
    private final AtomicReference<Vehicle> occupant = new AtomicReference<>();
    boolean tryPark(Vehicle v) { return type.fits(v.type()) && occupant.compareAndSet(null, v); } // atomic claim — gate-safe
    void free() { occupant.set(null); }
    boolean isFree() { return occupant.get() == null; }
}

interface SpotAssignmentStrategy { Optional<ParkingSpot> findSpot(List<Floor> floors, Vehicle v); }
interface PricingStrategy { Money price(Ticket t, Instant exitTime); }

class ParkingLot {
    private final List<Floor> floors;
    private final SpotAssignmentStrategy assigner;
    private final PricingStrategy pricing;
    private final Map<String, Ticket> activeTickets = new ConcurrentHashMap<>();

    Optional<Ticket> enter(Vehicle v) {
        for (int attempt = 0; attempt < 3; attempt++) {            // strategy may race another gate
            var spot = assigner.findSpot(floors, v);
            if (spot.isEmpty()) return Optional.empty();           // lot full for this type
            if (spot.get().tryPark(v)) {
                var t = new Ticket(UUID.randomUUID().toString(), v, spot.get(), Instant.now());
                activeTickets.put(t.id(), t);
                return Optional.of(t);
            }
        }
        return Optional.empty();
    }

    Money exit(String ticketId, Instant now) {
        Ticket t = activeTickets.remove(ticketId);
        if (t == null) throw new IllegalArgumentException("unknown ticket");
        t.spot().free();
        return pricing.price(t, now);
    }
}
```

**Follow-ups:** *Add EV spots with charging?* New `SpotType` + maybe a `Decorator` on price.
*Display board of free counts per type?* `Observer` on park/free events, or atomic counters per floor.
*Two gates grab the same spot?* That's why `tryPark` is CAS — narrate it before they ask.

---

## 2. Elevator System

**Clarify:** how many elevators/floors? Internal + external requests? Optimization goal
(min wait? min travel?)? Capacity limits?

**Entities:** `Elevator` (id, currentFloor, direction, state, requestSet),
`ElevatorController` (the dispatcher), `Request` (floor, direction), `Button`/`Display` (thin).

**Forces → patterns:**
- Elevator lifecycle (IDLE / MOVING_UP / MOVING_DOWN / DOOR_OPEN) → **State** (or enum machine)
- Which elevator serves a request → **Strategy** (`DispatchStrategy`: nearest-idle, same-direction, LOOK)
- Controller mediating N elevators × M floor panels → **Mediator**
- Button presses as queued objects → **Command** (mention, don't over-build)

**The algorithm to know — LOOK/SCAN:** an elevator keeps moving in its current direction
serving all requests on the way (two sorted sets: floors above, floors below), reverses when
none remain ahead. Don't FIFO requests — that's the naive answer interviewers poke at.

```java
class Elevator {
    private int floor = 0;
    private Direction dir = Direction.IDLE;
    private final NavigableSet<Integer> up = new TreeSet<>(), down = new TreeSet<>(Comparator.reverseOrder());

    void addStop(int target) { (target >= floor ? up : down).add(target); }

    void step() {                                   // called per tick
        if (dir == Direction.IDLE) dir = !up.isEmpty() ? Direction.UP : !down.isEmpty() ? Direction.DOWN : Direction.IDLE;
        if (dir == Direction.UP) {
            if (up.isEmpty()) { dir = Direction.IDLE; return; }   // reverse handled next tick (LOOK)
            floor++;
            if (up.contains(floor)) { up.remove(floor); openDoors(); }
        } else if (dir == Direction.DOWN) { /* mirror image */ }
    }
}

interface DispatchStrategy { Elevator pick(List<Elevator> elevators, int floor, Direction d); }
// e.g. nearest elevator that is idle OR already moving toward `floor` in direction `d`
```

**Follow-ups:** *Express elevators / zoning?* A `DispatchStrategy` filtering serviceable floors.
*Weight limit?* Elevator refuses internal stops, re-dispatches. *Concurrency?* Controller thread
per elevator + thread-safe request queue (`BlockingQueue`).

---

## 3. Vending Machine (the State-pattern showcase)

**Clarify:** denominations & change-making? refunds? multiple of same product? inventory restock?

**Entities:** `VendingMachine`, `Inventory` (slot → product + count), `Product`, the **states**.

**Force → pattern:** machine behavior depends entirely on lifecycle phase
(IDLE → HAS_MONEY → DISPENSING) and every action is legal in some states, illegal in others
→ textbook **State**. Each state implements all actions; illegal ones throw/ignore *in one place*.

```java
interface MachineState {
    void insertCoin(VendingMachine m, Coin c);
    void selectProduct(VendingMachine m, String slot);
    void refund(VendingMachine m);
}

class IdleState implements MachineState {
    public void insertCoin(VendingMachine m, Coin c) { m.addBalance(c); m.setState(new HasMoneyState()); }
    public void selectProduct(VendingMachine m, String slot) { throw new IllegalStateException("insert money first"); }
    public void refund(VendingMachine m) { /* nothing to refund */ }
}

class HasMoneyState implements MachineState {
    public void insertCoin(VendingMachine m, Coin c) { m.addBalance(c); }
    public void selectProduct(VendingMachine m, String slot) {
        Product p = m.inventory().peek(slot);
        if (m.balance() < p.price()) throw new IllegalStateException("insufficient funds");
        m.setState(new DispensingState());
        m.dispense(slot);                            // dispense + make change, then back to Idle
    }
    public void refund(VendingMachine m) { m.returnBalance(); m.setState(new IdleState()); }
}
```

**Change-making:** greedy over descending denominations works for canonical coin sets; track a
`Map<Coin,Integer>` till and fail the sale (refund) if exact change is impossible — mentioning
this edge case scores points.

**Follow-up:** *Card payments?* `PaymentMethod` Strategy alongside the coin path.
*Why not just an enum + switch?* Fine for 3 states; State classes win when per-state behavior
grows — say this trade-off out loud.

---

## 4. LRU Cache ⭐ (must be codable in 15 minutes, bug-free)

**The answer:** `HashMap` (O(1) lookup) + **doubly-linked list** (O(1) recency reorder).
Head = most recent, tail = least; evict at tail when over capacity. Both ops O(1).

```java
class LRUCache<K, V> {
    private final int capacity;
    private final Map<K, Node<K, V>> map = new HashMap<>();
    private final Node<K, V> head = new Node<>(null, null), tail = new Node<>(null, null); // sentinels kill null-checks

    LRUCache(int capacity) { this.capacity = capacity; head.next = tail; tail.prev = head; }

    public synchronized V get(K key) {
        Node<K, V> n = map.get(key);
        if (n == null) return null;
        unlink(n); addFirst(n);                      // touch = move to head
        return n.value;
    }

    public synchronized void put(K key, V value) {
        Node<K, V> n = map.get(key);
        if (n != null) { n.value = value; unlink(n); addFirst(n); return; }
        if (map.size() == capacity) { Node<K, V> lru = tail.prev; unlink(lru); map.remove(lru.key); }
        n = new Node<>(key, value);
        map.put(key, n); addFirst(n);
    }

    private void unlink(Node<K, V> n) { n.prev.next = n.next; n.next.prev = n.prev; }
    private void addFirst(Node<K, V> n) { n.next = head.next; n.prev = head; head.next.prev = n; head.next = n; }

    private static final class Node<K, V> {
        final K key; V value; Node<K, V> prev, next;
        Node(K key, V value) { this.key = key; this.value = value; }
    }
}
```

**Follow-ups (know all three):**
- *Java shortcut?* `LinkedHashMap(capacity, 0.75f, true)` + override `removeEldestEntry` — mention it, then code the real thing.
- *Thread safety?* `synchronized` (shown) is the honest simple answer; segment/stripe locks or a `ConcurrentLinkedDeque`-based approach for contention; real systems use Caffeine.
- *LFU instead?* freq map + per-frequency DLL buckets + minFreq pointer (O(1)); or make eviction an **`EvictionPolicy` Strategy** so LRU/LFU/FIFO are pluggable — the design answer interviewers want.
- *TTL?* store expiry per node, lazily evict on get + periodic sweep.

---

## 5. Splitwise (expense sharing)

**Clarify:** split types (equal/exact/percent)? simplify debts? groups? currencies?

**Entities:** `User`, `Group`, `Expense` (payer, amount, participants, `SplitStrategy`),
`Split` (user, amount), `BalanceSheet` (the net pairwise ledger).

**Forces → patterns:**
- Split rules vary → **Strategy** (`EqualSplit`, `ExactSplit`, `PercentSplit`) — each *validates* its inputs (exact must sum to total; percents to 100)
- Money → **Value Object**, `BigDecimal`/paise — *never double* (say it; they're listening for it)
- Balances = map of `(debtor, creditor) → amount`, or per-user net map

```java
interface SplitStrategy { List<Split> split(Money total, List<User> users, SplitInput input); }

class EqualSplit implements SplitStrategy {
    public List<Split> split(Money total, List<User> users, SplitInput in) {
        long paise = total.inPaise(), n = users.size(), share = paise / n, rem = paise % n;
        List<Split> out = new ArrayList<>();
        for (int i = 0; i < n; i++)                  // distribute the remainder paise — the classic gotcha
            out.add(new Split(users.get(i), Money.ofPaise(share + (i < rem ? 1 : 0))));
        return out;
    }
}

class BalanceSheet {
    private final Map<UserPair, Money> owed = new HashMap<>();   // (debtor → creditor) → amount
    void apply(Expense e) {
        for (Split s : e.splits())
            if (!s.user().equals(e.paidBy()))
                merge(s.user(), e.paidBy(), s.amount());          // merge nets opposite-direction debt
    }
}
```

**The famous follow-up — simplify/settle debts:** compute each user's *net* balance, then
repeatedly match the largest creditor with the largest debtor (two heaps / sorted lists) until
all nets are zero. Greedy gives ≤ n−1 transactions (true minimum is NP-hard — bonus point).

---

## 6. Movie Ticket Booking (BookMyShow)

**Clarify:** seat selection or just count? hold/timeout flow? payments in scope? one city?

**Entities:** `Movie`, `Cinema` → `Screen` → `Seat`, `Show` (movie × screen × time),
`ShowSeat` (seat × show + status — *the* concurrency unit), `Booking`, `Payment`.

**The heart of this problem is the double-booking race.** Everything else is CRUD. The answer:
1. **Hold-then-confirm:** `AVAILABLE → HELD(user, expiry) → BOOKED`; holds expire (~5 min) via lazy check or sweeper.
2. **Atomic hold:** lock per `Show` (coarse, simple) or per-seat CAS (`AtomicReference<SeatStatus>`), or in DB terms `UPDATE ... WHERE status='AVAILABLE'` / `SELECT FOR UPDATE` — **optimistic vs pessimistic locking**, pick one and justify (high contention on hot shows → pessimistic per-show lock is fine).
3. Hold **all seats or none** (sort seat ids before locking to avoid deadlock if per-seat locks).

```java
class Show {
    private final Map<SeatId, ShowSeat> seats;
    private final Object lock = new Object();        // coarse per-show lock: contention is per-show anyway

    Optional<Hold> hold(List<SeatId> wanted, UserId user, Instant now) {
        synchronized (lock) {
            var picked = wanted.stream().map(seats::get).toList();
            if (!picked.stream().allMatch(s -> s.isAvailable(now))) return Optional.empty(); // all-or-nothing
            picked.forEach(s -> s.hold(user, now.plus(Duration.ofMinutes(5))));
            return Optional.of(new Hold(user, wanted, now));
        }
    }
    boolean confirm(Hold h, Instant now) { /* verify still held by user & unexpired → BOOKED */ return true; }
}
```

**Patterns:** seat status lifecycle → **State**/enum machine · pricing (weekend/premium seat) →
**Strategy** · notify on booking → **Observer** · `BookingService` as **Facade** over
search + hold + payment + notify.

**Follow-ups:** *Payment fails?* Hold expires naturally — that's *why* hold-then-confirm exists.
*Search by city/movie?* Read-side index maps, out of the concurrency hot path.

---

## 7. Board Games — Snake & Ladder, Tic-Tac-Toe (and Chess scaling)

These test **clean modeling speed**, not algorithms. Win by being fast and tidy.

**Tic-Tac-Toe entities:** `Board` (grid + `checkWinner`), `Player` (symbol + `MoveStrategy` —
human input vs AI), `Game` (turn loop). Winner check: O(1) per move — row/col/diagonal counters
per player, not a full board scan (say it).

**Snake & Ladder:** key insight — snakes and ladders are the *same thing*: a `Jump(from, to)`.
`Board` holds `Map<Integer, Integer> jumps`; `Dice` is injectable (→ **deterministic tests**, the
detail that scores); `Game` runs a `Deque<Player>` turn queue.

```java
class Game {                                         // the reusable turn-loop skeleton (Template Method-ish)
    private final Board board; private final Dice dice;
    private final Deque<Player> turns;
    private final Map<Player, Integer> position = new HashMap<>();

    Optional<Player> playTurn() {
        Player p = turns.pollFirst();
        int target = position.get(p) + dice.roll();
        if (target <= board.size()) position.put(p, board.resolveJumps(target)); // overshoot = stay
        if (position.get(p) == board.size()) return Optional.of(p);              // winner
        turns.addLast(p);
        return Optional.empty();
    }
}
```

**Scaling to Chess (the follow-up):** `Piece` hierarchy where each piece owns
`canMove(from, to, board)` (polymorphism kills the god-method) · piece creation → **Factory** ·
move history for undo → **Command** + **Memento** · shared piece definitions → **Flyweight**
(name-drop) · human vs engine → `MoveStrategy`.

---

## 8. Logger Framework

**Clarify:** levels? multiple sinks (console/file/remote)? format? async? config at runtime?

**The two forces → two patterns (this problem is famous for them):**
- Level handling → **Chain of Responsibility**: DEBUG→INFO→ERROR handlers, each logs if
  `msg.level >= my.level` and passes along. (Honest aside: real loggers just compare levels —
  CoR is what *this interview question* wants.)
- Multiple destinations → **Strategy/Observer**: `LogAppender` interface (`ConsoleAppender`,
  `FileAppender`), logger fans out to all registered appenders.
- One logger instance per name → **Singleton**/registry (`LoggerFactory.getLogger(name)`).

```java
interface LogAppender { void append(LogMessage m); }

class Logger {
    private final LogLevel threshold;
    private final List<LogAppender> appenders;
    void log(LogLevel level, String msg) {
        if (level.ordinal() < threshold.ordinal()) return;        // cheap filter first
        LogMessage m = new LogMessage(level, msg, Instant.now(), Thread.currentThread().getName());
        appenders.forEach(a -> a.append(m));
    }
    void info(String msg) { log(LogLevel.INFO, msg); }
}

class AsyncAppender implements LogAppender {         // Decorator: wraps any appender with a queue
    private final BlockingQueue<LogMessage> q = new LinkedBlockingQueue<>(10_000); // bounded = backpressure
    private final LogAppender delegate;              // worker thread drains q -> delegate.append
    public void append(LogMessage m) { q.offer(m); } // drop-on-full policy: state it explicitly
}
```

**Follow-ups:** *Logging must not block the app* → async Decorator above; discuss
drop-vs-block when the queue fills. *Formatting?* `LogFormatter` Strategy. *Thread safety?*
appenders must be safe; the queue hand-off conveniently serializes file writes.

---

## 9. The rest of the bank

The first seven below are **rapid-fire** — close derivatives of the big 8, so just the entities,
the load-bearing pattern, and the one snippet that matters. Everything from **ATM** onward is a
**full worked solution** (clarify → entities → patterns → complete core classes → follow-ups),
same depth as problems 1–8.

### Rate Limiter (overlaps HLD — here they want the class design)
`RateLimiter` interface + **Strategy** per algorithm. Code **token bucket**. Per-user limits →
`ConcurrentHashMap<UserId, TokenBucket>` via `computeIfAbsent`. Know sliding-window-log
(precise, memory-heavy) and fixed-window (boundary burst) as alternates.

```java
class TokenBucket {
    private final double ratePerSec, capacity;
    private double tokens; private long lastNanos;
    synchronized boolean tryAcquire() {
        long now = System.nanoTime();
        tokens = Math.min(capacity, tokens + (now - lastNanos) / 1e9 * ratePerSec); // lazy refill
        lastNanos = now;
        if (tokens >= 1) { tokens -= 1; return true; }
        return false;                                  // throttled
    }
}
```

### Notification Service
`Notification` + `Channel` interface (`EmailChannel`, `SmsChannel`, `PushChannel`) →
**Strategy**; event sources → **Observer**; channel+template assembly → **Factory**;
retries → **Decorator** (`RetryingChannel(channel, 3)`); per-user prefs/rate-limit → compose.
The point is composition of small interfaces.

```java
interface Channel { void send(Notification n); }
class RetryingChannel implements Channel {             // Decorator: adds retry, same interface
    private final Channel inner; private final int attempts;
    public void send(Notification n) {
        for (int i = 1; i <= attempts; i++)
            try { inner.send(n); return; } catch (Exception e) { if (i == attempts) throw e; }
    }
}
```

### Cab Booking (Uber-lite)
`Rider`, `Driver` (location, status), `Trip` (state machine: REQUESTED→ACCEPTED→STARTED→ENDED),
`DriverMatchingStrategy` (nearest — naive grid bucketing is fine at LLD scope),
`PricingStrategy` (base+distance, surge as **Decorator**), trip events → **Observer**.
Concurrency: two riders matching the same driver → CAS the driver's status — same shape as the
parking spot.

```java
enum DriverStatus { AVAILABLE, ASSIGNED, OFFLINE }
class Driver {
    private final AtomicReference<DriverStatus> status = new AtomicReference<>(DriverStatus.AVAILABLE);
    boolean tryAssign() { return status.compareAndSet(DriverStatus.AVAILABLE, DriverStatus.ASSIGNED); } // only one rider wins
}
```

### Library Management
`Book` (the title) vs **`BookCopy`** (the physical item) — *the* distinction this question
tests. `Member`, `Loan` (copy, member, due), `Reservation` queue per book → notify on return
(**Observer**), `FinePolicy` → **Strategy**, search by index maps.

```java
class Book { String isbn, title; }                     // the catalog entry (one)
class BookCopy { String barcode; Book book; boolean onLoan; } // physical items (many per Book)
class FinePerDay implements FinePolicy { public Money fine(Loan l, LocalDate now) {
    long late = Math.max(0, DAYS.between(l.dueDate(), now)); return Money.ofPaise(late * 1000); } }
```

### Online Shopping / Food Delivery (order lifecycle)
`Cart` (mutable per-user) → `Order` (**immutable snapshot** of priced items — prices change
later; the snapshot insight is the point) · order state machine · `PaymentMethod` Strategy ·
inventory decrement must be atomic (same hold-or-CAS discussion as ticket booking) ·
restaurant/store notified via Observer.

```java
record OrderLine(String sku, int qty, Money unitPrice) {}   // price frozen at checkout
record Order(String id, List<OrderLine> lines, Instant placedAt) {                 // immutable
    Order { lines = List.copyOf(lines); }              // defensive copy = nobody mutates after placing
    Money total() { return lines.stream().map(l -> l.unitPrice().times(l.qty())).reduce(Money.ZERO, Money::plus); }
}
```

### Task Scheduler
`ScheduledTask` (runAt, period) in a `PriorityQueue` ordered by next-run-time; worker loop:
peek → wait until due (`Condition.awaitUntil`) → run → if periodic, recompute and re-offer.
Tasks as **Command** objects. Mention `ScheduledThreadPoolExecutor` *is* this.

```java
record ScheduledTask(Runnable job, Instant nextRun, Duration period) implements Comparable<ScheduledTask> {
    public int compareTo(ScheduledTask o) { return nextRun.compareTo(o.nextRun); } // min-heap by due time
}
// loop: t = pq.peek(); awaitUntil(t.nextRun); pq.poll().job().run();
//       if (t.period != null) pq.offer(new ScheduledTask(t.job, t.nextRun.plus(t.period), t.period));
```

### In-memory File System
**Composite**: `Entry` (name, parent) ← `File` (content) and `Directory`
(`Map<String, Entry> children`). Path resolution walks segments from root. Permissions →
decorate or field on `Entry`; `find` → **Visitor** or recursion; pure Composite recognition.

```java
sealed interface Entry permits File, Directory { String name(); }
record File(String name, byte[] content) implements Entry {}
final class Directory implements Entry {
    private final String name; private final Map<String, Entry> children = new HashMap<>();
    public String name() { return name; }
    Entry resolve(String path) {                       // walk "/a/b/c" segment by segment
        Entry e = this;
        for (String seg : path.split("/")) if (!seg.isEmpty()) e = ((Directory) e).children.get(seg);
        return e;
    }
}
```

### ATM (full)
**Clarify:** card + PIN auth? withdraw / deposit / balance? denominations & exact-change failure?
single bank or a network? receipt?

**Entities:** `ATM` (holds current state + active card), `ATMState` (IDLE → CARD_INSERTED →
AUTHENTICATED), `Card`, `BankService` (port to the bank), `DispenseHandler` (denomination chain).

**Forces → patterns:** session lifecycle → **State** (illegal action per state fails in one
place); cash dispensing across denominations → **Chain of Responsibility**; the bank behind a
**port (DIP)** so the ATM is testable with a fake.

```java
interface BankService {                              // DIP port — inject a fake in tests
    boolean authenticate(String cardNo, String pin);
    boolean debit(String cardNo, Money amt);
}

interface ATMState {                                 // default = illegal here; states override what's legal
    default void insertCard(ATM atm, Card c) { throw new IllegalStateException(); }
    default void enterPin(ATM atm, String pin)  { throw new IllegalStateException(); }
    default void withdraw(ATM atm, Money amt)   { throw new IllegalStateException(); }
    default void ejectCard(ATM atm)             { throw new IllegalStateException(); }
}
class IdleState implements ATMState {
    public void insertCard(ATM atm, Card c) { atm.setCard(c); atm.setState(new CardInsertedState()); }
}
class CardInsertedState implements ATMState {
    public void enterPin(ATM atm, String pin) {
        if (!atm.bank().authenticate(atm.card().number(), pin)) { atm.reset(); throw new SecurityException("bad PIN"); }
        atm.setState(new AuthenticatedState());
    }
    public void ejectCard(ATM atm) { atm.reset(); }
}
class AuthenticatedState implements ATMState {
    public void withdraw(ATM atm, Money amt) {
        if (!atm.bank().debit(atm.card().number(), amt)) throw new IllegalStateException("insufficient funds");
        atm.dispenser().dispense((int) amt.toRupees());   // hands off to the CoR
        atm.reset();
    }
    public void ejectCard(ATM atm) { atm.reset(); }
}

abstract class DispenseHandler {                     // Chain of Responsibility over denominations
    private final int note; private DispenseHandler next;
    DispenseHandler(int note) { this.note = note; }
    DispenseHandler then(DispenseHandler n) { this.next = n; return n; }   // build: h.then(..).then(..)
    void dispense(int amount) {
        int count = amount / note, rem = amount % note;
        if (count > 0) System.out.println("dispense " + count + " x " + note);
        if (rem > 0) {
            if (next == null) throw new IllegalStateException("cannot make exact amount"); // refund in real life
            next.dispense(rem);
        }
    }
}
class Note2000 extends DispenseHandler { Note2000() { super(2000); } } // + Note500, Note100 ...

class ATM {
    private ATMState state = new IdleState();
    private Card card;
    private final BankService bank; private final DispenseHandler dispenser;
    ATM(BankService bank, DispenseHandler dispenser) { this.bank = bank; this.dispenser = dispenser; }
    void insertCard(Card c) { state.insertCard(this, c); }
    void enterPin(String pin) { state.enterPin(this, pin); }
    void withdraw(Money amt) { state.withdraw(this, amt); }
    void ejectCard() { state.ejectCard(this); }
    // hooks used by the state objects:
    void setState(ATMState s) { this.state = s; }
    void setCard(Card c) { this.card = c; }
    void reset() { this.card = null; this.state = new IdleState(); }
    Card card() { return card; } BankService bank() { return bank; } DispenseHandler dispenser() { return dispenser; }
}
```
**Follow-ups:** out of a denomination → skip that handler or fail-and-refund; daily withdrawal
limit checked in `AuthenticatedState`; one ATM is single-user, but `BankService.debit` must be
atomic on the account (the real concurrency lives in the bank).

### Meeting / Conference Room Scheduler (full)
**Clarify:** multiple rooms? book a specific room or "find any free room"? recurring meetings?
attendee invites/notifications? capacity matching?

**Entities:** `Interval` (value object), `Meeting`, `RoomCalendar` (one per room),
`SchedulerService` (facade across rooms + invite fan-out), `InviteListener`.

**Forces → patterns:** the whole problem is **interval overlap** — book only if nothing overlaps;
keep intervals sorted (`TreeMap` by start) for O(log n) checks. Room choice → **Strategy**
(first-fit / smallest-that-fits). Invites → **Observer**.

```java
record Interval(Instant start, Instant end) {
    Interval { if (!start.isBefore(end)) throw new IllegalArgumentException("empty interval"); }
    boolean overlaps(Interval o) { return start.isBefore(o.end) && o.start.isBefore(end); }  // half-open
}
record Meeting(String id, Interval slot, String organizer, List<String> attendees) {}
interface InviteListener { void invited(Meeting m, String roomId); }

class RoomCalendar {                                 // one per room; sorted by start
    final String roomId; final int capacity;
    private final TreeMap<Instant, Meeting> byStart = new TreeMap<>();
    RoomCalendar(String roomId, int capacity) { this.roomId = roomId; this.capacity = capacity; }
    synchronized boolean tryBook(Meeting m) {
        var lo = byStart.floorEntry(m.slot().start());   // nearest meeting starting at/before m
        var hi = byStart.ceilingEntry(m.slot().start()); // nearest starting at/after m
        if (lo != null && lo.getValue().slot().overlaps(m.slot())) return false;
        if (hi != null && hi.getValue().slot().overlaps(m.slot())) return false;
        byStart.put(m.slot().start(), m); return true;   // atomic check-and-book under the lock
    }
    synchronized void cancel(Instant start) { byStart.remove(start); }
}

class SchedulerService {                             // facade + observer
    private final List<RoomCalendar> rooms;
    private final List<InviteListener> listeners = new CopyOnWriteArrayList<>();
    SchedulerService(List<RoomCalendar> rooms) { this.rooms = rooms; }
    void subscribe(InviteListener l) { listeners.add(l); }

    Optional<String> book(Interval slot, String organizer, List<String> attendees) {
        Meeting m = new Meeting(UUID.randomUUID().toString(), slot, organizer, attendees);
        for (RoomCalendar r : rooms)                   // first-fit; swap loop body for a RoomSelectionStrategy
            if (r.capacity >= attendees.size() && r.tryBook(m)) {
                listeners.forEach(l -> l.invited(m, r.roomId));
                return Optional.of(r.roomId);
            }
        return Optional.empty();                       // no room free in that slot
    }
}
```
**Follow-ups:** suggest free slots (walk gaps between consecutive `byStart` entries); recurring
meetings (expand to instances, or store a rule + check on query); smallest-room-that-fits via a
`RoomSelectionStrategy`.

### Hotel Booking (full)
**Clarify:** room types & inventory per type? date-range stays? overbooking allowed? cancellation/
refund? search by availability or book a known room?

**Entities:** `RoomType`, `Room` (owns its reservations), `DateRange` (value object),
`Reservation`, `PricingStrategy`, `BookingService`.

**Forces → patterns:** same **interval-overlap** core as the scheduler but keyed by
`(room, dateRange)`; per-room atomic reserve; pricing by type/season → **Strategy**; hold-then-
confirm + payment like ticket booking.

```java
record DateRange(LocalDate checkIn, LocalDate checkOut) {
    DateRange { if (!checkIn.isBefore(checkOut)) throw new IllegalArgumentException("empty range"); }
    boolean overlaps(DateRange o) { return checkIn.isBefore(o.checkOut) && o.checkIn.isBefore(checkOut); }
    long nights() { return ChronoUnit.DAYS.between(checkIn, checkOut); }
}
enum RoomType { STANDARD, DELUXE, SUITE }
interface PricingStrategy { Money price(RoomType type, DateRange range); }
record Reservation(String id, Room room, DateRange range, String guest, Money price) {}

class Room {
    final String id; final RoomType type;
    private final List<Reservation> reservations = new ArrayList<>();   // few per room; linear scan is fine
    Room(String id, RoomType type) { this.id = id; this.type = type; }
    synchronized boolean tryReserve(Reservation res) {
        boolean free = reservations.stream().noneMatch(r -> r.range().overlaps(res.range()));
        if (free) reservations.add(res);
        return free;                                   // atomic check-and-reserve under lock
    }
    synchronized void cancel(String reservationId) { reservations.removeIf(r -> r.id().equals(reservationId)); }
}

class BookingService {
    private final List<Room> rooms; private final PricingStrategy pricing;
    BookingService(List<Room> rooms, PricingStrategy pricing) { this.rooms = rooms; this.pricing = pricing; }
    Optional<Reservation> book(RoomType type, DateRange range, String guest) {
        Money price = pricing.price(type, range);
        for (Room room : rooms)
            if (room.type == type) {
                var res = new Reservation(UUID.randomUUID().toString(), room, range, guest, price);
                if (room.tryReserve(res)) return Optional.of(res);
            }
        return Optional.empty();                        // sold out for that type & range
    }
}
```
**Follow-ups:** overbooking (allow N% over inventory, manage walk-the-guest); availability search
across a city (index by date for speed); payment via hold-then-confirm; cancellation frees the
range and may trigger the waitlist (Observer).

### Stock Exchange / Order Matching Engine (full)
**Clarify:** limit vs market orders? partial fills? price-time priority? cancellations? one symbol
or many?

**Entities:** `Order` (side, price, qty, sequence=time), `Trade`, `OrderBook` (per symbol, two
heaps), `MatchingEngine` (routes by symbol).

**Forces → patterns:** the design *is* the data structure — **two priority queues** per symbol:
bids (price desc, then time) and asks (price asc, then time). Match against the opposite book
while prices cross; rest the remainder. **Price-time priority** is the invariant. Real engines are
**single-threaded per symbol** so ordering = correctness (say this — it explains the no-locks).

```java
enum Side { BUY, SELL }
class Order {
    final String id; final Side side; final double price; int qty; final long seq;  // seq encodes arrival time
    Order(String id, Side side, double price, int qty, long seq) {
        this.id = id; this.side = side; this.price = price; this.qty = qty; this.seq = seq;
    }
}
record Trade(String buyOrderId, String sellOrderId, double price, int qty) {}

class OrderBook {                                    // one per symbol; run single-threaded → no locks
    private final PriorityQueue<Order> bids = new PriorityQueue<>(
        Comparator.comparingDouble((Order o) -> o.price).reversed().thenComparingLong(o -> o.seq));
    private final PriorityQueue<Order> asks = new PriorityQueue<>(
        Comparator.comparingDouble((Order o) -> o.price).thenComparingLong(o -> o.seq));

    List<Trade> submit(Order incoming) {
        List<Trade> trades = new ArrayList<>();
        PriorityQueue<Order> opposite = (incoming.side == Side.BUY) ? asks : bids;
        while (incoming.qty > 0 && !opposite.isEmpty() && crosses(incoming, opposite.peek())) {
            Order resting = opposite.peek();
            int fill = Math.min(incoming.qty, resting.qty);
            double execPrice = resting.price;            // the resting order sets the trade price
            trades.add(incoming.side == Side.BUY
                ? new Trade(incoming.id, resting.id, execPrice, fill)
                : new Trade(resting.id, incoming.id, execPrice, fill));
            incoming.qty -= fill; resting.qty -= fill;
            if (resting.qty == 0) opposite.poll();        // fully filled → remove from book
        }
        if (incoming.qty > 0)                             // leftover rests (limit order)
            (incoming.side == Side.BUY ? bids : asks).add(incoming);
        return trades;
    }
    private boolean crosses(Order in, Order resting) {
        return in.side == Side.BUY ? in.price >= resting.price : in.price <= resting.price;
    }
}

class MatchingEngine {                               // route to the right book
    private final Map<String, OrderBook> books = new ConcurrentHashMap<>();
    List<Trade> submit(String symbol, Order o) { return books.computeIfAbsent(symbol, s -> new OrderBook()).submit(o); }
}
```
**Follow-ups:** market orders (cross at any price — skip the `crosses` check); cancel/amend
(`Map<id,Order>` + lazy-delete, since `PriorityQueue` has no random removal); per-symbol thread or
actor for isolation; trade feed → Observer.

### Pub/Sub Message Queue (in-memory, full)
**Clarify:** fan-out (every subscriber gets every message) or competing consumers (each message to
one of N)? delivery semantics (at-most/at-least-once)? persistence/replay? ordering?

**Entities:** `Message` (id + offset), `Subscriber`, `Broker` (topic → subscribers).

**Forces → patterns:** **Observer** fan-out, but with a **per-subscriber bounded `BlockingQueue`**
so a slow consumer can't block the publisher (decoupling) and the bound gives **backpressure** —
*state your full-queue policy* (drop / block / DLQ). At-least-once + dedup by message id if they
push on semantics (ties straight to HLD).

```java
record Message(String id, String topic, byte[] payload, long offset) {}
interface Subscriber { void onMessage(Message m); }

class Broker implements AutoCloseable {
    // fan-out: each subscriber to a topic gets its OWN bounded queue + consumer thread
    private final Map<String, List<BlockingQueue<Message>>> queues = new ConcurrentHashMap<>();
    private final ExecutorService workers = Executors.newCachedThreadPool();
    private final AtomicLong offset = new AtomicLong();
    private volatile boolean running = true;

    void subscribe(String topic, Subscriber sub) {
        BlockingQueue<Message> q = new LinkedBlockingQueue<>(1000);   // bounded = backpressure
        queues.computeIfAbsent(topic, t -> new CopyOnWriteArrayList<>()).add(q);
        workers.submit(() -> {                          // one consumer loop per subscriber
            try { while (running) sub.onMessage(q.take()); }
            catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        });
    }
    void publish(String topic, byte[] payload) {
        Message m = new Message(UUID.randomUUID().toString(), topic, payload, offset.getAndIncrement());
        for (var q : queues.getOrDefault(topic, List.of()))
            if (!q.offer(m)) { /* full → drop (shown) / block with put / route to a DLQ — pick & state it */ }
    }
    public void close() { running = false; workers.shutdownNow(); }
}
```
**Follow-ups:** competing consumers (one shared queue per topic; `poll` distributes); ack +
redelivery for at-least-once; replay from an offset (keep an append-only log per topic);
ordering only guaranteed within a single queue/partition.

### In-memory Key-Value Store with TTL (full)
**Clarify:** per-key TTL? eviction when full (LRU/LFU/none)? thread-safe? persistence? max size?

**Entities:** `Entry` (value + expiry), `EvictionPolicy` (Strategy), `KVStore`.

**Forces → patterns:** **lazy expiry** on read + a background **sweeper** to reclaim memory;
eviction as a pluggable **Strategy** (the LRU answer from problem 4 drops straight in); thread
safety via `ConcurrentHashMap` + a lock around the size-check-then-evict compound op.

```java
record Entry<V>(V value, long expiresAt) {           // expiresAt = Long.MAX_VALUE when no TTL
    boolean expired(long now) { return now >= expiresAt; }
}
interface EvictionPolicy<K> {                        // LRU / LFU / FIFO behind one interface
    void onAccess(K k); void onInsert(K k); void onRemove(K k); K evictCandidate();
}

class KVStore<K, V> {
    private final int capacity;
    private final ConcurrentHashMap<K, Entry<V>> map = new ConcurrentHashMap<>();
    private final EvictionPolicy<K> policy;
    KVStore(int capacity, EvictionPolicy<K> policy) { this.capacity = capacity; this.policy = policy; }

    synchronized void put(K k, V v, Duration ttl) {
        if (!map.containsKey(k) && map.size() >= capacity) {     // make room first
            K victim = policy.evictCandidate();
            if (victim != null) { map.remove(victim); policy.onRemove(victim); }
        }
        long exp = ttl == null ? Long.MAX_VALUE : System.currentTimeMillis() + ttl.toMillis();
        map.put(k, new Entry<>(v, exp));
        policy.onInsert(k);
    }
    synchronized Optional<V> get(K k) {
        Entry<V> e = map.get(k);
        if (e == null) return Optional.empty();
        if (e.expired(System.currentTimeMillis())) { map.remove(k); policy.onRemove(k); return Optional.empty(); }
        policy.onAccess(k);
        return Optional.of(e.value());
    }
    void startSweeper(ScheduledExecutorService ses) {           // proactive expiry
        ses.scheduleAtFixedRate(() -> {
            long now = System.currentTimeMillis();
            map.forEach((k, e) -> { if (e.expired(now)) { synchronized (this) { map.remove(k); policy.onRemove(k); } } });
        }, 1, 1, TimeUnit.MINUTES);
    }
}
```
**Follow-ups:** LRU policy via the HashMap + doubly-linked-list from problem 4; append-only log for
persistence; shard by key hash (N stores) to cut lock contention; per-key vs global default TTL.

### Connection Pool (full)
**Clarify:** fixed or growable? block or fail-fast on exhaustion? validate connections on borrow?
leak detection? min idle?

**Entities:** `Connection` (+ a `ConnectionFactory` port), `ConnectionPool`.

**Forces → patterns:** a **bounded `BlockingQueue` *is* the pool** — borrow = `poll(timeout)`
(blocks then times out), return = `offer`. Validate-on-borrow, track in-use for leak detection,
pre-fill on startup. The factory behind a port keeps it testable.

```java
interface Connection { boolean isValid(); void close(); }
interface ConnectionFactory { Connection create(); }

class ConnectionPool implements AutoCloseable {
    private final BlockingQueue<Connection> idle;
    private final Set<Connection> inUse = ConcurrentHashMap.newKeySet();
    private final ConnectionFactory factory;

    ConnectionPool(int size, ConnectionFactory factory) {
        this.factory = factory;
        this.idle = new ArrayBlockingQueue<>(size);
        for (int i = 0; i < size; i++) idle.offer(factory.create());   // pre-fill to size
    }
    Connection acquire(Duration timeout) throws InterruptedException {
        Connection c = idle.poll(timeout.toMillis(), TimeUnit.MILLISECONDS);
        if (c == null) throw new IllegalStateException("pool exhausted");
        if (!c.isValid()) { c.close(); c = factory.create(); }         // validate-on-borrow, replace if dead
        inUse.add(c);
        return c;
    }
    void release(Connection c) {
        if (inUse.remove(c)) idle.offer(c);            // return to the pool, do NOT close
    }
    public void close() { idle.forEach(Connection::close); inUse.forEach(Connection::close); }
}
```
**Follow-ups:** growable pool (create up to a max on demand, shrink idle); leak detection (record
borrow timestamps, reclaim after a timeout); fair queueing (`new ArrayBlockingQueue<>(n, true)`);
a health-check sweeper that evicts stale idle connections.

### Deck of Cards / Blackjack (full)
**Clarify:** which game (drives scoring)? single deck or a shoe? jokers? expose dealing how?

**Entities:** `Card` (immutable value), `Deck`, `Hand`, plus game-specific scoring.

**Forces → patterns:** `Card` is a **value object** (record); `Deck` shuffles via an **injected
`Random`** (→ deterministic tests — the detail that scores) and hands cards out only via `deal()`
(don't leak the internal list); game scoring → **Strategy**. Ace = 1-or-11 is the Blackjack gotcha.

```java
enum Suit { HEARTS, SPADES, DIAMONDS, CLUBS }
enum Rank {
    TWO(2), THREE(3), FOUR(4), FIVE(5), SIX(6), SEVEN(7), EIGHT(8), NINE(9), TEN(10),
    JACK(10), QUEEN(10), KING(10), ACE(11);          // ace starts at 11, downgraded when busting
    final int value; Rank(int value) { this.value = value; }
}
record Card(Suit suit, Rank rank) {}                 // immutable value object

class Deck {
    private final Deque<Card> cards = new ArrayDeque<>();
    Deck(Random rng) {                               // inject rng → reproducible shuffles in tests
        List<Card> all = new ArrayList<>();
        for (Suit s : Suit.values()) for (Rank r : Rank.values()) all.add(new Card(s, r));
        Collections.shuffle(all, rng);
        cards.addAll(all);
    }
    Card deal() { if (cards.isEmpty()) throw new IllegalStateException("empty deck"); return cards.pop(); }
    int remaining() { return cards.size(); }
}

class Hand {
    private final List<Card> cards = new ArrayList<>();
    void add(Card c) { cards.add(c); }
    int blackjackValue() {                           // count aces as 11, drop to 1 while over 21
        int total = cards.stream().mapToInt(c -> c.rank().value).sum();
        long aces = cards.stream().filter(c -> c.rank() == Rank.ACE).count();
        while (total > 21 && aces-- > 0) total -= 10;
        return total;
    }
    boolean isBust() { return blackjackValue() > 21; }
}
```
**Follow-ups:** shoe of N decks; pluggable `ScoringStrategy` for other games (Poker hand ranking);
dealer/player turn loop reusing the board-game turn skeleton from problem 7.

### URL Shortener (LLD class design — full)
**Clarify:** custom aliases? expiry? analytics? this is the *class design*, not the HLD sharding
question — say where LLD ends.

**Entities:** `ShorteningStrategy` (Strategy), `UrlShortener` (the service + two maps).

**Forces → patterns:** encode strategy is pluggable — **base62 of an auto-increment id** (short,
**collision-free** because the counter is unique) vs **hash+truncate** (needs a collision retry
loop). Two maps: `short→long` (redirect) and `long→short` (idempotent dedup). Custom alias =
atomic check-and-put.

```java
interface ShorteningStrategy { String shorten(long id); }
class Base62Strategy implements ShorteningStrategy {
    private static final String A = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    public String shorten(long id) {
        StringBuilder sb = new StringBuilder();
        do { sb.append(A.charAt((int)(id % 62))); id /= 62; } while (id > 0);
        return sb.reverse().toString();              // counter is unique → no collision check needed
    }
}

class UrlShortener {
    private final Map<String, String> shortToLong = new ConcurrentHashMap<>();
    private final Map<String, String> longToShort = new ConcurrentHashMap<>();   // dedup
    private final AtomicLong counter = new AtomicLong(1_000_000);                 // skip tiny codes
    private final ShorteningStrategy strategy;
    UrlShortener(ShorteningStrategy strategy) { this.strategy = strategy; }

    String shorten(String longUrl) {
        String existing = longToShort.get(longUrl);
        if (existing != null) return existing;       // idempotent: same URL → same code
        String code = strategy.shorten(counter.getAndIncrement());
        shortToLong.put(code, longUrl);
        longToShort.put(longUrl, code);
        return code;
    }
    String shortenCustom(String longUrl, String alias) {
        if (shortToLong.putIfAbsent(alias, longUrl) != null) throw new IllegalStateException("alias taken");
        return alias;                                 // atomic claim
    }
    Optional<String> resolve(String code) { return Optional.ofNullable(shortToLong.get(code)); }
}
```
**Follow-ups:** expiry/TTL on codes (reuse the KV-store entry idea); per-code hit counts
(`AtomicLong`); then the HLD story — counter ranges per node / Snowflake ids, a key-generation
service, and caching hot codes (note clearly where LLD hands off to HLD).

### Text Editor with Undo/Redo (full)
**Clarify:** undo *and* redo? per-keystroke or coalesced edits? large files (data structure)?
copy/paste?

**Entities:** `Document` (the buffer), `Command` (insert/delete), `Editor` (undo/redo stacks).

**Forces → patterns:** every edit is a **Command** with `execute`/`undo`; an undo `Deque` plus a
redo `Deque` give undo/redo; a new action clears redo. `DeleteCommand` must capture what it
removed so it can restore it. (**Memento** snapshots are the alternative for O(1) restore of big
edits.)

```java
class Document {
    private final StringBuilder buf = new StringBuilder();
    void insert(int pos, String s) { buf.insert(pos, s); }
    void delete(int pos, int len) { buf.delete(pos, pos + len); }
    String text() { return buf.toString(); }
}
interface Command { void execute(); void undo(); }

class InsertCommand implements Command {
    private final Document doc; private final int pos; private final String text;
    InsertCommand(Document doc, int pos, String text) { this.doc = doc; this.pos = pos; this.text = text; }
    public void execute() { doc.insert(pos, text); }
    public void undo()    { doc.delete(pos, text.length()); }
}
class DeleteCommand implements Command {
    private final Document doc; private final int pos; private final int len; private String removed;
    DeleteCommand(Document doc, int pos, int len) { this.doc = doc; this.pos = pos; this.len = len; }
    public void execute() { removed = doc.text().substring(pos, pos + len); doc.delete(pos, len); } // capture for undo
    public void undo()    { doc.insert(pos, removed); }
}

class Editor {
    private final Document doc = new Document();
    private final Deque<Command> undo = new ArrayDeque<>(), redo = new ArrayDeque<>();
    void run(Command c) { c.execute(); undo.push(c); redo.clear(); }   // new edit invalidates redo
    void undo() { if (!undo.isEmpty()) { Command c = undo.pop(); c.undo(); redo.push(c); } }
    void redo() { if (!redo.isEmpty()) { Command c = redo.pop(); c.execute(); undo.push(c); } }
    Document document() { return doc; }
}
```
**Follow-ups:** coalesce consecutive keystrokes into one undo unit; **Memento** checkpoints for
cheap restore; gap buffer / piece table / rope for large-file performance (a `StringBuilder` is
fine for an interview).

---

## 10. Cross-problem patterns you can now see

| Recurring mechanic | Where it appeared | The reusable answer |
|---|---|---|
| Atomic claim of a contested resource | Parking spot, cab driver, seat, inventory | CAS/`AtomicReference` or smallest-scope lock; all-or-nothing for multi-resource |
| Hold-then-confirm with expiry | Seats, inventory, cab request | Status + owner + expiry; lazy expiry check beats background sweeper at this scope |
| Pluggable policy | Pricing, splitting, eviction, dispatch, matching, fines | Strategy injected via constructor |
| Lifecycle with legal transitions | Order, trip, ticket, machine, elevator | Enum state machine (small) → State pattern (when per-state behavior grows) |
| Fan-out on events | Booking confirmations, returns, trip updates | Observer; keep handlers fast or hand off to a queue |
| Same-interface wrapping | Async logger, retrying channel, surge pricing | Decorator |
| Money | Splitwise, bookings, pricing | Value Object over `BigDecimal`/minor units; **never double** |
| Deterministic randomness | Dice, id generation, clocks | Inject `Dice`/`Clock`/`Supplier` — and say "so I can test it" |
| Interval overlap | Meeting room, hotel booking, calendar | Sort by start (TreeMap); conflict if `a.start < b.end && b.start < a.end` |
| Priority by key + time | Order matching, task scheduler, elevator stops | `PriorityQueue` with a composed comparator (price/time, runAt) |
| Bounded buffer hand-off | Pub/sub queue, connection pool, async logger | `BlockingQueue` — gives backpressure; borrow=`poll(timeout)`, return=`offer` |
| Reversible operations | Text editor undo, chess moves, command log | Command (`execute`/`undo`) on a `Deque`; + Memento for snapshots |
| ID/code generation | URL shortener, ticket ids | base62 of an atomic counter = short + collision-free (beats hash+retry) |

If you can re-derive this table from memory, you're ready.
