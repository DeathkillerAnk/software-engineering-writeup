# 20 · Generics & Type Erasure

> Java generics are a **compile-time** fiction: the compiler checks types, then **erases** them, and
> the JVM runs on raw types + casts it inserts. Every generics "surprise" — no `new T[]`, no
> `List<int>`, `List<String>` and `List<Integer>` being the *same* class at runtime — falls out of
> that one fact.
> [← Part 4 · The Language in Depth](README.md) · next: 21 · Collections Internals

> **Predict first (2 min).** `new ArrayList<String>().getClass() == new ArrayList<Integer>().getClass()`
> — true or false? And why can't you write `if (obj instanceof List<String>)` or `new T[10]` inside a
> generic class? Write your guesses.

---

## Erasure: generics exist for the compiler, not the JVM

Generics were added in Java 5 **without changing the VM** or breaking old bytecode. The mechanism is
**type erasure**: the compiler uses the type parameters to *check* your code, then throws them away.

- `List<String>` and `List<Integer>` both erase to raw **`List`** — so the prediction's first answer
  is **true**: `getClass()` is identical, there is *one* `ArrayList` class at runtime.
- A type variable `T` erases to its **leftmost bound** — `<T>` → `Object`, `<T extends Number>` →
  `Number`.
- The compiler inserts **casts** where you read generic values, and sometimes **bridge methods** to
  keep polymorphism working after erasure.

```java
// you write:                          // JVM effectively runs (after erasure):
List<String> xs = new ArrayList<>();   List xs = new ArrayList();
xs.add("a");                           xs.add("a");
String s = xs.get(0);                  String s = (String) xs.get(0);   // compiler-inserted cast
```

So generics give you **compile-time type safety with zero runtime cost** — no per-instantiation
class, no boxing beyond what you'd already have. The price is that the type information *isn't there*
at runtime, which is the source of every limitation below.

## What erasure forbids (and why)

The prediction's second answers, all one root cause — **the type isn't available at runtime**:

- **No `obj instanceof List<String>`** — at runtime it's just `List`; the `<String>` can't be checked.
  (`instanceof List<?>` is fine.)
- **No `new T[10]` / `new T()`** — the JVM doesn't know what `T` is to allocate it. Arrays need a
  real reified component type; generics don't have one. (Workarounds: `(T[]) new Object[10]` with a
  cast, or pass a `Class<T>`/`IntFunction<T[]>` factory.)
- **No generic type in a `catch`**, no `T.class`, no static field of type `T`.
- ⚡ **Arrays vs generics don't mix:** arrays are **covariant and reified** (`Object[] a = new
  String[1]` compiles, then throws `ArrayStoreException` at runtime); generics are **invariant and
  erased** (`List<Object> = new ArrayList<String>()` won't compile). That mismatch is why
  `new List<String>[10]` is illegal.

## Invariance, and the wildcards that restore flexibility

`List<String>` is **not** a `List<Object>` even though `String` is an `Object` — generics are
**invariant**. Wildcards add controlled variance, remembered as **PECS — Producer `extends`,
Consumer `super`**:

| Form | Meaning | Use when |
|---|---|---|
| `List<? extends Number>` | some *unknown subtype* of Number — **read** `Number` out, can't add | source you **produce** from |
| `List<? super Integer>` | some *unknown supertype* of Integer — **add** `Integer`, read only `Object` | sink you **consume** into |
| `List<?>` | unknown type — read as `Object`, can't add (except `null`) | you don't care about the element type |

```java
// PECS in one signature (like Collections.copy):
static <T> void copy(List<? super T> dest, List<? extends T> src) { … }
//                        consumer (super)      producer (extends)
```

## Practical consequences a principal watches for

- ⚡ **Unchecked-cast & heap pollution warnings** are the compiler telling you it *can't* verify
  safety past erasure — e.g. `(List<String>) rawList`. Suppress only when you've proven it safe.
- ⚡ **Overloads that differ only by generic type don't exist** — `foo(List<String>)` and
  `foo(List<Integer>)` erase to the same signature → won't compile.
- **Reifiable generic info is recoverable in one place:** type arguments on a **superclass/field/
  method signature** survive in class metadata (the "super type token" trick — `new TypeReference<List<String>>(){}`
  that Jackson/Spring use), because *that* is stored, unlike a local variable's type.
- **Bridge methods** show up in stack traces / reflection — when you override a generic method, the
  compiler synthesizes a `(Object)` bridge that casts and delegates. Not a bug; it's erasure's glue.

## Make it visible

- **Prove erasure.** `System.out.println(new ArrayList<String>().getClass() == new ArrayList<Integer>().getClass())`
  → `true`. One class, both lists.
- **See the inserted casts & bridges.** `javap -c` a small generic class and read the bytecode:
  the `checkcast` instructions and any synthetic bridge method are erasure made visible.
- **Feel invariance vs covariance.** Watch `List<Object> = new ArrayList<String>()` fail to *compile*,
  while `Object[] a = new String[1]; a[0] = 1;` compiles and throws `ArrayStoreException` at runtime.

## Self-Check (close the doc, answer out loud)

1. What does the compiler do with type parameters, and what does the JVM actually run?
2. Is `ArrayList<String>.class == ArrayList<Integer>.class`? Why?
3. Give three things you can't do because of erasure, and the single reason behind all of them.
4. State PECS and give the `extends`/`super` rule for a producer and a consumer.
5. Where *does* generic type info survive at runtime, and what real library trick relies on it?

> **Go deeper:** the Java Tutorials → "Generics"; Effective Java items on generics (favor generic
> types, PECS, avoid raw types, heap pollution/varargs); `javap -c` on your own generics; then
> [21 · Collections Internals](README.md), where these generic containers get their runtime guts.
