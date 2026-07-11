# 21 · Collections Internals

> `ArrayList`, `HashMap`, `ConcurrentHashMap`, `TreeMap` — the data structures you use a hundred times
> a day, from the inside: growth, hashing, resize, treeification, and the concurrency mechanics. The
> single most-asked Java interview topic.
> [← Part 4 · The Language, In Depth](README.md) · prev: 20 · Generics & Erasure · next: 22 · Strings

> **Predict first (2 min).** In a `HashMap`, what happens when many keys land in the *same* bucket —
> and what does the JVM do once that bucket gets *too* long? And: adding one element to an `ArrayList`
> is "O(1)" — so where does the hidden cost go? Write your guesses.

---

## `ArrayList` — a growable array

Backed by an `Object[]`. Add appends; when full, it **grows ~1.5×** (`newCap = oldCap + (oldCap >> 1)`)
via `Arrays.copyOf` (a `System.arraycopy`). So:

- `get(i)` / `set(i)` = **O(1)**; `add` (append) = **amortized O(1)**; `add`/`remove` in the middle =
  **O(n)** (shifts elements); `contains` = O(n).
- ⚡ The hidden cost is the **array copies** on growth — that's the answer to the prediction. Adding N
  elements to a default list triggers ~log₁.₅(N) reallocations copying everything each time.
  **Pre-size** with `new ArrayList<>(expectedSize)` to avoid them.
- ⚡ `LinkedList` is almost never worth it (pointer-chasing kills cache locality — [Part 2](../02-execution-and-performance/)); prefer `ArrayList`/`ArrayDeque`.

---

## `HashMap` — the one they always ask about

An array of **buckets** (`Node[] table`). For a key:

1. **Hash spreading:** `hash = h ^ (h >>> 16)` — XORs the high bits down so they influence the index
   (cheap defense against poor `hashCode`s that vary only in high bits).
2. **Bucket index:** `(table.length - 1) & hash` — works because the table length is always a **power
   of two** (so `& (n-1)` is a fast modulo).
3. **Collision → chain:** multiple keys in one bucket form a **linked list** of nodes. `get` walks it,
   comparing with `equals` (after a `hashCode` match). ⚡ this is why **`equals`/`hashCode` must
   agree** ([chapter 23](README.md)) — the bucket is found by hash, the entry confirmed by equals.
4. **Load factor 0.75:** when `size > capacity × 0.75`, the table **resizes (doubles)** and **every
   entry is rehashed** into the bigger table — O(n), but amortized O(1) per put.
5. **Treeification:** if a *single bucket*'s chain reaches **8** nodes **and** the table is ≥ **64**
   (`MIN_TREEIFY_CAPACITY`; otherwise it just resizes first), that bucket converts from a linked list
   to a **red-black tree** — lookups in it go **O(n) → O(log n)**. It untreeifies back to a list at 6.

> ▶ **Watch it:** [`hashmap-resize.html`](visualizations/hashmap-resize.html) — entries rehashing into
> a doubled table, then a hot bucket treeifying past 8 collisions.

So the prediction: many keys in one bucket form a **chain** (O(n) within it); once a chain hits 8 (on
a ≥64 table) it **treeifies** to O(log n). This treeification (added in Java 8) is what hardened
`HashMap` against hash-collision DoS — before it, a bucket was a pure linked list, so a bad/adversarial
`hashCode` degraded lookups to O(n).

**Complexity:** `get`/`put` average **O(1)**, worst case **O(log n)** (treeified) — *if* your
`hashCode` is decent; a constant `hashCode` makes everything collide (still O(log n) treeified, but
you've lost the point). Iteration order is **unspecified** and changes on resize.

### Variants
- **`LinkedHashMap`** — `HashMap` + a doubly-linked list threading the entries → predictable
  **insertion order** (or **access order** for an **LRU cache**: `accessOrder=true` +
  `removeEldestEntry`).
- **`TreeMap`** — a **red-black tree**, **sorted** by natural order/`Comparator`, all ops **O(log n)**.
  ⚡ uses `compareTo`/`Comparator`, **not** `equals`/`hashCode` — an inconsistency with `equals`
  silently breaks `Map` semantics.
- **`HashSet`/`LinkedHashSet`/`TreeSet`** are these maps with a dummy value.

---

## `ConcurrentHashMap` — concurrency done right

Not `Collections.synchronizedMap` (one big lock). Instead:

- **Reads are lock-free** (volatile reads of the table).
- **Writes lock only the one bucket** (`synchronized` on the bin's head node) + **CAS** to place the
  first node — so different buckets update in parallel. (Pre-Java 8 it used coarser "segment" locks.)
- **Resize is concurrent** (threads cooperate to transfer bins). `size()` is an estimate via striped
  counter cells (like `LongAdder`, [Part 3](../03-concurrency-and-jmm/)).
- ⚡ **No `null` keys or values** (ambiguous with "absent" under concurrency). Iterators are
  **weakly consistent** (no `ConcurrentModificationException`; reflect some-but-maybe-not-all concurrent updates).

---

## The footprint tax (why this is also a memory topic)

⚡ A `HashMap<Integer,Integer>` costs *far* more than `2 × N × 4` bytes: each entry is a `Node` object
(header + hash + key ref + value ref + next ref), and each `Integer` key/value is itself a **16-byte
boxed object** ([Part 1 · Object Layout](../01-memory-and-gc/)). For large primitive maps, that
overhead (and the GC pressure from boxing) is the argument for **primitive collections** (Eclipse
Collections, fastutil, Koloboke) or plain arrays. Measure with JOL's `GraphLayout.toFootprint`.

---

## Make it visible

- **Watch a resize.** Insert past `capacity × 0.75` and observe the table double (debugger, or reason
  from the load factor). Pre-size and confirm no resize happens.
- **Force treeification.** Insert many keys whose `hashCode` all collide (return a constant) into a
  `HashMap` on a ≥64-entry table; inspect a bucket and see it become a `TreeNode` tree.
- **Footprint.** `GraphLayout.parseInstance(map).toFootprint()` on a `HashMap<Integer,Integer>` vs an
  `int[]` of the same data — the difference is headers + boxing.

---

## Self-Check (close the doc, answer out loud)

1. How does `ArrayList` grow, and where's the hidden cost? How do you avoid it?
2. Walk a `HashMap` `put`: hash spread → index → collision → resize → treeify. What are the exact
   thresholds (load factor, treeify count, min table size)?
3. Why must `equals` and `hashCode` agree for `HashMap` to work? What did treeification (Java 8) fix?
4. `HashMap` vs `LinkedHashMap` vs `TreeMap` — internal structure, ordering, and which contract each uses.
5. How does `ConcurrentHashMap` allow concurrent writes without a global lock? Why no null keys/values?
6. Why does a `HashMap<Integer,Integer>` use so much more memory than the raw numbers, and what's the fix?

> **Go deeper:** read `HashMap.java` (`putVal`, `resize`, `treeifyBin`) and `ConcurrentHashMap.java` in
> the JDK — genuinely readable; then [22 · Strings](README.md) and [23 · Equality](README.md), which
> `HashMap` depends on.
