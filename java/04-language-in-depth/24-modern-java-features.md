# 24 · Modern Java Features (17 → 21+)

> The language you learned in Java 8 is not the language you ship in Java 21. Records, sealed types,
> pattern matching, switch expressions, and text blocks aren't sugar — together they turn verbose,
> error-prone boilerplate into **data-oriented** code the compiler can check exhaustively.
> [← Part 4 · The Language in Depth](README.md) · prev: 23 · Equality

> **Predict first (2 min).** A `record Point(int x, int y)` — how many of `equals`, `hashCode`,
> `toString`, the constructor, and the accessors do you write by hand? And with a `sealed` interface,
> why can a `switch` over its implementations skip the `default` branch? Write your guesses.

---

## Records: data carriers without the boilerplate

A **`record`** (Java 16) is a transparent carrier for an immutable group of values. The prediction's
first answer: **you write none of them.** From the header, the compiler generates the private final
fields, the canonical constructor, accessors (`x()`, `y()`), and contract-correct `equals`/`hashCode`/
`toString` ([ch.23](README.md)).

```java
record Point(int x, int y) {
  Point {                                  // compact constructor — validate/normalize
    if (x < 0 || y < 0) throw new IllegalArgumentException();
  }
}
Point p = new Point(1, 2);
p.x();  p.equals(new Point(1,2)); // true — value equality for free
```

- **Immutable & final** — great map keys ([ch.23](README.md)), safe to share across threads
  ([Part 3](../03-concurrency-and-jmm/)), ideal DTOs.
- ⚡ Not for everything: records are for *data*, not for entities with identity/mutability (a JPA
  `@Entity` is a poor record) or for hiding representation.

## Sealed types + pattern matching = checked, exhaustive dispatch

**Sealed** interfaces/classes (Java 17) restrict *who* can implement them:

```java
sealed interface Shape permits Circle, Rectangle {}
record Circle(double r) implements Shape {}
record Rectangle(double w, double h) implements Shape {}
```

Combined with **pattern matching for `switch`** (Java 21) and **record deconstruction**, you get
dispatch the compiler checks for **exhaustiveness**:

```java
double area = switch (shape) {
  case Circle(double r)        -> Math.PI * r * r;   // deconstructs the record
  case Rectangle(double w, double h) -> w * h;
};   // NO default needed
```

The prediction's second answer: because `Shape` is **sealed**, the compiler *knows the complete set*
of subtypes — if you've covered them all, `default` is unnecessary, and if you add a `Triangle` to
the `permits` list, **every non-exhaustive switch fails to compile** until you handle it. That
compile-time completeness is the whole point — the "data-oriented programming" style: model the data
as sealed records, branch with exhaustive switches, let the compiler enforce coverage.

- ⚡ **`instanceof` pattern** (Java 16) kills the cast: `if (o instanceof String s) { use(s); }` — `s`
  is in scope, typed, only where the test passed (flow scoping).
- ⚡ **Guarded patterns:** `case Integer i when i > 0 ->` adds a condition to a pattern.

## The quality-of-life set

- **Switch expressions** (Java 14): `->` arms, **return a value**, no fall-through, must be
  exhaustive — replaces the fall-through-bug-prone statement switch.
- **Text blocks** (Java 15): `"""…"""` multi-line strings — JSON/SQL/HTML without `\n` and `+` noise.
- **`var`** (Java 10): local type inference — cuts left-side repetition; the type is still static, just
  inferred. Use where the RHS makes the type obvious.
- **Helpful NPEs** (Java 14): the message names *which* variable was null — `Cannot invoke "…" because
  "order.customer" is null`.
- **Sequenced collections** (Java 21): `getFirst()`/`getLast()`/`reversed()` across `List`/`Deque`/
  `LinkedHashSet` — a uniform ordered API.

## The runtime headliners

- ⚡ **Virtual threads** (Java 21, [ch.19](../03-concurrency-and-jmm/)) — cheap threads that unmount on
  blocking I/O, so plain blocking code scales to millions of concurrent tasks. The single biggest
  server-side change in a decade; Boot 3.2+ turns it on with one property ([spring ch.15](../../spring-boot/02-spring-boot-core/)).
- **Pattern matching** continues to expand; **structured concurrency** and the **Foreign Function &
  Memory API** are finalizing — the modern JDK moves fast, which is exactly why
  [`VERSION-CHANGES.md`](../VERSION-CHANGES.md) exists.

> ▶ **Watch it:** [`arraylist-growth.html`](visualizations/arraylist-growth.html) — not a syntax
> feature but the everyday collection whose **amortized O(1) add** and 1.5× resize back the "modern
> data-oriented" style; see the backing array grow and copy.

## Make it visible

- **Count the lines you didn't write.** `javap` a `record Point(int x,int y)` — see the generated
  ctor, accessors, `equals`/`hashCode`/`toString` you never typed.
- **Break exhaustiveness on purpose.** Add a third `permits` type to a sealed interface and watch
  every `switch` over it stop compiling until handled — the compiler enforcing completeness.
- **Feel the readability delta.** Rewrite a nested `if-instanceof-cast` chain as a pattern-matching
  `switch` with deconstruction; count the characters and the eliminated cast bugs.

## Self-Check (close the doc, answer out loud)

1. What does a `record` generate for you, and when is a record the *wrong* choice?
2. Why can an exhaustive `switch` over a sealed type's implementations omit `default`?
3. Show how the `instanceof` pattern removes a cast, and what "flow scoping" means for the binding.
4. Name four quality-of-life features (14–21) and the boilerplate/bug each removes.
5. Why are virtual threads the headline runtime change, and what makes them cheap?

> **Go deeper:** JEPs for records (395), sealed classes (409), pattern matching for switch (441),
> virtual threads (444); "Data-Oriented Programming in Java" (Brian Goetz); the track's
> [VERSION-CHANGES.md](../VERSION-CHANGES.md). 🎉 This closes **Part 4 · The Language in Depth**.
