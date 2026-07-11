# 22 · Strings

> Why `String` immutability is load-bearing, where the **string pool** lives and what `intern()` really
> does, compact strings, and how `+` concatenation actually compiles. The class you use most, from the
> inside.
> [← Part 4 · The Language, In Depth](README.md) · prev: 21 · Collections Internals · next: 23 · Equality

> **Predict first (2 min).** `"hi" == "hi"` — true or false? `new String("hi") == "hi"` — true or
> false? And: does `s += x` in a loop create one `StringBuilder` or a new one each iteration? Write
> your guesses.

---

## Immutability is a feature, not a limitation

`String` is **immutable** (`final class`, `private final byte[] value`). Four things depend on it:

1. **The string pool** can safely share one instance across the whole program — only possible because
   nobody can mutate it.
2. **Cached hash code** — `String.hashCode()` is computed once and stored in a field; safe *because*
   the contents never change (huge win: `String` is the most common `HashMap` key).
3. **Thread safety** — immutable objects are safely shared with no synchronization (the `final`-field
   publication guarantee, [chapter 16](../03-concurrency-and-jmm/)).
4. **Security** — a `String` passed to a file API / class loader / SQL layer can't be changed by
   another thread *after* the security check (TOCTOU defense).

---

## The string pool & interning

**String literals** are **interned** automatically: the compiler puts them in the class file's
constant pool, and at load time each distinct literal becomes **one shared `String` instance** in the
**string pool** (a table in the **heap** since Java 7 — it was in PermGen before). So:

```java
"hi" == "hi"                 // true  — same pooled instance
new String("hi") == "hi"     // false — new String() forces a fresh heap object, not the pooled one
new String("hi").intern() == "hi"  // true — intern() returns the pooled instance
```

That answers the first two predictions. `==` compares **references** (identity); ⚡ **always use
`.equals()`** for string content. `new String("x")` is almost always a mistake — it *guarantees* a
second object.

**`intern()`** returns the canonical pooled instance for a string's value (adding it if absent). Useful
for deduplicating many equal strings read at runtime (parsing, dedup) — but ⚡ a double-edged sword:
interning a flood of distinct strings bloats the pool, and pre-Java-7 it could exhaust PermGen. Modern
GCs also do **automatic string deduplication** (G1 `-XX:+UseStringDeduplication`) — often a better
answer than manual `intern()`.

---

## Compact strings (JEP 254, since Java 9)

Before Java 9, `String` stored `char[]` — always **2 bytes/char** (UTF-16), wasteful for the vast
majority of strings that are pure Latin-1 (ASCII). **Compact strings** changed the backing to
`byte[]` + a **`coder` flag**: Latin-1 strings use **1 byte/char**, only strings with non-Latin-1
chars use 2. Transparent, on by default, and it roughly **halves** heap for typical text-heavy apps —
one of the highest-impact "free" memory wins in modern Java. (Verify with JOL, [chapter 05](../01-memory-and-gc/).)

---

## Concatenation: `+`, `StringBuilder`, and `invokedynamic`

`String` is immutable, so every `+` conceptually makes a new string. The details:

- A **single expression** `a + b + c` is fine — the compiler optimizes it.
- ⚡ `s += x` **inside a loop** is the classic trap: each iteration builds and throws away an
  intermediate string → **O(n²)** copying and garbage. Use an explicit **`StringBuilder`** (mutable,
  amortized O(1) append — it's the mutable cousin of `String`).

The modern surprise: since Java 9, `javac` compiles `+` **not** to a `StringBuilder` chain but to an
**`invokedynamic`** call to **`StringConcatFactory`** ([chapter 02](../00-platform-and-mental-model/)) —
the JVM picks (and can improve) the concat strategy at runtime. So the old advice "always use
StringBuilder instead of +" is dated for straight-line code; the *loop* case still needs an explicit
builder (the compiler can't hoist it across iterations).

**Text blocks** (`"""…"""`, standard in Java 15) are just a source convenience for multi-line
literals — still ordinary interned `String`s.

---

## Make it visible

- **Identity vs equality.** Print `("hi" == "hi")`, `(new String("hi") == "hi")`, and
  `(new String("hi").intern() == "hi")` — see `true/false/true`, then never use `==` on strings again.
- **Compact strings.** JOL `ClassLayout` on a Latin-1 `String` vs one with an emoji — see the `byte[]`
  length differ (1 vs 2 bytes/char) and the `coder` field.
- **The loop trap.** JMH-benchmark `s += i` over 100k iterations vs a `StringBuilder` — watch the
  O(n²) blow-up and the allocation profile (`-prof gc`).

---

## Self-Check (close the doc, answer out loud)

1. Name the four things `String` immutability buys. Which enables the cached `hashCode`?
2. Explain `"hi" == "hi"` vs `new String("hi") == "hi"`. Where does the string pool live now?
3. What does `intern()` do, when is it useful, and what's the risk? What's the modern alternative?
4. What are compact strings, and roughly what do they save?
5. What does `+` compile to on modern Java, and when is `StringBuilder` still required?
6. Why is `s += x` in a loop O(n²)?

> **Go deeper:** JEP 254 (compact strings); read `String.java` and `StringConcatFactory`; then
> [23 · Equality, Identity & Comparison](README.md), which strings exemplify.
