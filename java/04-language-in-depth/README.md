# Part 4 · The Language, In Depth

> The everyday language and standard library — generics, collections, strings, equality, modern
> features — explained *by* the internals you now own. The payoff: the things you use a hundred
> times a day stop being magic. [← curriculum index](../README.md)

By now you understand objects in memory (Part 1) and the memory model (Part 3). That's exactly what
makes `HashMap`, `String`, and `equals`/`hashCode` finally make sense from the inside rather than by
rote.

---

## Learning objectives — what "I know this" actually means

By the end of this part you can, **from memory and out loud**:

- Explain what type erasure removes and what survives (and where), why you can't write `new T[]`,
  and what bridge methods are for.
- Walk a `HashMap` put end to end: hash spreading, bucket index, collision, resize at the load
  factor, treeification past the threshold — and what a bad `hashCode` does to it.
- Explain `ArrayList` amortized-O(1) growth and the copy cost you don't see.
- Explain why `String` immutability is load-bearing (security, pooling, thread-safety, cached hash),
  what the string pool is, what compact strings are, and the `==`/`intern()` footgun.
- State the `equals`/`hashCode`/`Comparable` contracts and exactly which collections break when you
  violate them.
- Use records, sealed types, and pattern matching to make illegal states unrepresentable (the bridge
  back to the LLD track).

## Topic checklist

- [ ] **20 · Generics & Type Erasure** — erasure (compile-time types, raw runtime); where generic
      info *does* survive (signatures, reflection); bridge methods; why arrays are covariant +
      reified but generics are invariant + erased, and the bugs that fall out; wildcards & PECS;
      `Class<T>` tokens.
- [ ] **21 · Collections Internals** — `ArrayList` growth (1.5×) & `System.arraycopy`; `HashMap`
      (hash spreading, buckets, load factor 0.75, resize, treeification at 8 / untreeify at 6);
      `LinkedHashMap`; `TreeMap` (red-black); `ConcurrentHashMap` (bin-level locking + CAS); choosing
      the right one by access pattern and footprint (measure with JOL).
- [ ] **22 · Strings** — immutability and the four things it buys; the string constant pool &
      `intern()`; compact strings (Latin-1 vs UTF-16, JEP 254); cached `hashCode`; `StringBuilder`
      vs `+` (and what `+` compiles to — `invokedynamic`/`StringConcatFactory` on modern Java);
      text blocks.
- [ ] **23 · Equality, Identity & Comparison** — reference vs value equality; the `equals` contract
      (reflexive/symmetric/transitive/consistent) and the `hashCode` contract that pairs with it; the
      `equals`/`hashCode`/`Comparable` consistency rules; how `HashMap`/`HashSet`/`TreeMap` depend on
      each; `record` auto-generated equality.
- [ ] **24 · Modern Language Features as Design Tools** — records (transparent immutable carriers);
      sealed types (closed hierarchies the compiler checks); pattern matching for `switch` &
      `instanceof`; exhaustiveness; using these to make illegal states *unrepresentable* — the
      internals-meets-LLD chapter.

## The principal-level insight

**Most of the standard library's "rules" are not arbitrary — they're forced by the internals, and
once you see the mechanism the rules become obvious and unforgettable.** Why must `equals` and
`hashCode` change together? Because `HashMap` finds your key by `hashCode` *first*, then confirms
with `equals` — break the pairing and your key vanishes into a bucket it can never be found in. Why
is `String` immutable? Because the pool shares instances across the whole program, the hash is
cached, and untrusted code holds references — mutability would break all three. Why can't you create
a generic array? Because erasure means the array couldn't enforce its own component type at runtime.
A principal doesn't memorize these as "gotchas"; they *derive* them from the layout and the memory
model — which means they can also predict the behavior of a case no one warned them about.

## Drills (build, don't just read)

1. **Break a `HashMap` key.** Put an object into a `HashMap`, then mutate a field its `hashCode`
   depends on. Try to get it back. Watch it be lost. Now make the key immutable. This teaches the
   `equals`/`hashCode`/mutability link in one shot.
2. **Force treeification.** Insert many keys that collide into one bucket; observe the bucket convert
   to a red-black tree past the threshold (debugger or careful reasoning). Explain why this rescues
   the worst case from O(n) to O(log n).
3. **Erasure in action.** Write code that compiles fine but fails at runtime because of erasure (e.g.
   an unchecked cast, or `instanceof` on a parameterized type). Then find where generic info *did*
   survive via reflection on a method signature.
4. **String identity.** With `==`, show two literals are the *same* pooled instance, `new String`
   isn't, and `.intern()` makes it so. Then JMH-measure `+=` in a loop vs `StringBuilder`.
5. **Make illegal states uncompilable.** Take a class that uses an `int` or `String` "type/status"
   field with `if/else` everywhere; refactor to a sealed interface + records + an exhaustive
   `switch`. Note that the compiler now catches a missing case.

## Interview lens

This is the bread-and-butter of senior Java interviews, and the *internals* answers are what lift
you above "I've used `HashMap`": *"What happens in a `HashMap` collision / resize?"*, *"Why must
`equals` and `hashCode` agree?"*, *"Is `String` thread-safe and why?"*, *"What's type erasure and
what can't you do because of it?"*, *"`==` vs `.equals` for strings?"* Machine-coding rounds also
reward modeling a domain with records + sealed types. The signal is explaining the *mechanism*
("because the bucket is chosen by hash"), not just the rule.

## Visualizations

See [`visualizations/`](visualizations/): a `HashMap` rehashing into a doubled table and a hot bucket
treeifying, `ArrayList` growth & copies, and the string pool vs heap with `==`/`.equals`. Catalog in
[VISUALIZATIONS.md](../VISUALIZATIONS.md).
