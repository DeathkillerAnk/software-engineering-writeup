# Java Internals — Crash-Course Cheatsheet

> Every topic in the [java track](README.md), distilled to the facts that matter. Dense by design —
> for cramming and recall, not first learning. Targets **Java 21+ / HotSpot**. ⚡ = classic gotcha.
> Pair with the chapters + animations for depth.

---

## Part 0 · Platform & Mental Model

**Platform & pipeline** — *Language* (javac, JLS) ≠ *Platform* (JVM, JVMS); they meet at **bytecode**
(why Kotlin/Scala run on the JVM). **Two compilers:** `javac` = source→bytecode, ahead-of-time, once,
~no optimization; **JIT** (C1/C2) = bytecode→native, at runtime, on hot code. JVM **interprets first**
(instant start), profiles, JIT-compiles the hot ~10%, can **deoptimize**. JDK = JRE + tools; JRE = JVM
+ libs (no separate JRE since 11; use `jlink`). "Write once, run anywhere" = every platform ships a
JVM running the same bytecode. ⚡ `javac` does NOT make native code.

**Class file & bytecode** — `.class` = magic `0xCAFEBABE` + version + **constant pool** (the symbol
table; most instructions index into it) + fields + methods + attributes. JVM is a **stack machine**
(operand stack, not registers). Invoke ops: `invokestatic`, `invokespecial` (ctor/private/super),
`invokevirtual` (normal), `invokeinterface`, `invokedynamic` (lambdas, string concat). Read with
`javap -c -p -v`.

**Class loading** — lifecycle: **Load → Link (Verify → Prepare → Resolve) → Initialize**.
*Prepare* = static fields get defaults; *Initialize* = run `<clinit>` (static inits + static field
assignments). Loaders: **Bootstrap → Platform → Application**, with **parent delegation** (ask parent
first → prevents spoofing `java.lang.*`). `<clinit>` runs lazily on first active use (new instance,
static method/non-constant field access, subclass init). ⚡ two loaders → same class name = **different
types** (`a.getClass() != b.getClass()`); basis of app-server isolation.

**Runtime data areas** — **Heap** (shared, GC'd) · per-thread **JVM stack** (frames: locals + operand
stack; `StackOverflowError`) · **PC register** (per thread) · **Metaspace** (class metadata, *native*
memory not heap — replaced PermGen in 8; `OutOfMemoryError: Metaspace`) · **Code cache** (JIT output) ·
native memory. Errors: stack → `StackOverflowError`; heap → `OOM: Java heap space`; metaspace → `OOM: Metaspace`.

---

## Part 1 · Memory & GC

**Object layout** — object = **mark word (8B)** + **klass pointer (4B compressed)** + fields + padding
to 8B. `new Object()` = **16B**. Adding one `boolean` → still 16B (fits in padding). Mark word holds
**identity hashCode** (lazy, stamped on first call), **GC age**, **lock bits** — one word, three jobs.
**Compressed oops**: refs = 4B up to **~32 GB heap**; cross 32 GB (`-Xmx32g+`) and refs become 8B → a
31 GB heap can hold *more* than a 33 GB heap. Arrays add a length word. Tool: **JOL** `ClassLayout`/`GraphLayout`.
⚡ `HashMap<Integer,Integer>` ≫ raw size: every boxed key/value is a 16B object.

**Allocation** — fast path = **bump pointer** in a per-thread **TLAB** (no lock). Slow path = claim a
new TLAB from Eden (the only sync, rare) or allocate huge objects directly. **Escape analysis** →
**scalar replacement**: a non-escaping object isn't allocated at all (C2). ⚡ store/return/collection
makes it escape → allocation returns. **Allocation rate**, not heap size, drives GC frequency.

**GC fundamentals** — GC finds the **live** set (reachable from **GC roots**: stack locals, statics,
JNI), not garbage. Algorithms: **mark-sweep** (fragments), **mark-compact** (defrags, moves+fixup),
**copying** (touches only live, wastes half). **Generational hypothesis**: most objects die young →
split heap; **minor GC** copies few survivors out of Eden (cheap, cost ∝ live set), **full GC**
collects everything (expensive). Cross-gen refs tracked via **card table / remembered set** + a
**write barrier** on every reference store. Decode `-Xlog:gc*`: `256M->9M(512M) 3ms` = before→after(total) pause.
⚡ `System.gc()` is a hint (often harmful); leaks = *reachability* bugs (usually a static collection).

**Collectors** — trilemma: **throughput vs latency vs footprint** (can't max all). **Serial** (tiny/1
CPU), **Parallel** (throughput, long pauses), **G1** (default 9+, region-based, pause-target
`MaxGCPauseMillis`, *garbage-first*), **ZGC**/**Shenandoah** (concurrent, sub-ms pauses, colored
pointers/load barriers; **generational ZGC** since 21). Concurrent collectors pay throughput +
footprint (barriers + headroom). Pick: default G1; big heap + strict latency → ZGC; batch → Parallel;
tiny → Serial. ⚡ "make less garbage" beats any flag; don't cargo-cult flags.

**References & cleaners** — **Strong** > **Soft** (cleared only under memory pressure → cache) > **Weak**
(cleared next GC → `WeakHashMap`, metadata) > **Phantom** (`get()` always null; enqueued after collect →
resource cleanup). Register with a **`ReferenceQueue`** for cleanup callbacks. **`finalize()` is dead**
(JEP 421) — use **`try-with-resources`/`AutoCloseable`** (deterministic) or **`Cleaner`** (safety net;
⚡ the cleanup action must NOT reference the object or it never runs).

---

## Part 2 · Execution & Performance

**Interpreter & JIT** — same method runs ≥3 ways: interpreter (T0) → **C1** (T3, fast, profiling) →
**C2** (T4, aggressive, speculative). Hot method compiled **more than once** (tiered). **Speculative
opt**: monomorphic inlining behind a type guard, branch pruning, null/range elision. **Deoptimization**:
guard fails → discard native code, transfer running frame to interpreter, re-profile, recompile
weaker. **OSR** = compile a long loop mid-run (`%` in `PrintCompilation`). ⚡ **code cache** fills
(`-XX:ReservedCodeCacheSize`) → JIT stops → silent slowdown.

**JIT optimizations** — **inlining is the mother of all opts** (exposes the rest); blocked by
megamorphic (3+ types) call sites or method size. Also: escape analysis/scalar replacement, **lock
elision** (thread-local lock removed) + **coarsening**, loop unrolling, range-check elimination,
**intrinsics** (`Math`, `System.arraycopy`, `String` ops → hand-tuned native). Inspect:
`-XX:+PrintInlining`.

**Benchmarking** — ⚡ naïve `nanoTime()` loops lie: no **warmup**, **dead-code elimination**, constant
folding, OSR. Use **JMH**: `@Warmup`/`@Measurement`, **forks** (isolate profiles), **`Blackhole`** to
consume results, `@State`. Measure throughput vs latency vs allocation honestly; `-prof gc` for alloc.

**Mechanical sympathy** — latency ladder: register <1ns, L1 ~1ns, L2 ~4ns, L3 ~10ns, RAM ~100ns, SSD
~16µs. **Cache line = 64B**. **False sharing**: two threads write different fields on the *same line* →
ping-pong → huge slowdown; fix with padding / `@Contended` (`-XX:-RestrictContended`). Data locality
(array-of-structs vs struct-of-arrays) + branch prediction can beat Big-O for small N.

---

## Part 3 · Concurrency & the Java Memory Model

**Threads** — platform thread = thin wrapper over an **OS thread** (~1 MB stack, scheduler-managed,
context-switch cost). "Just add threads" stops scaling (memory + switching).

**JMM / happens-before** — three layers reorder/delay memory ops (compiler, CPU out-of-order + store
buffers, caches); invisible single-threaded, visible across threads. **happens-before** = the entire
contract: A hb B ⟹ A visible to & ordered before B; **no edge = data race = no guarantees**. Edges:
**program order**, **monitor** (unlock→later lock), **volatile** (write→later read), **thread
start/join**, **transitivity**, **final-field freeze**. **`volatile`** = visibility + ordering
(release/acquire fence); ⚡ NOT atomic for compound ops (`volatile n++` still races). ⚡ plain
`while(!stop){}` can loop forever (read hoisted) → make `stop` volatile. **final fields**: safely
published after construction *if `this` didn't escape* → why immutables are thread-safe to share.

**Locks & sync** — `synchronized` uses the object **monitor** (lock bits in the mark word):
uncontended = lightweight (CAS); contended = inflate to **heavyweight** OS monitor (park/unpark). ⚡
**biased locking removed** (JDK 15 deprecated, 18 gone) — don't repeat the folklore. `wait`/`notify`
require holding the monitor; always `wait` in a loop (spurious wakeups). 

**`java.util.concurrent`** — **AQS** (`AbstractQueuedSynchronizer`) = one CLH-queue mechanism behind
`ReentrantLock`, `Semaphore`, `CountDownLatch`, `ReentrantReadWriteLock`. **CAS** (compare-and-swap) =
lock-free atomics (`AtomicInteger`); ⚡ **ABA problem** (use `AtomicStampedReference`). **`LongAdder`**
> `AtomicLong` under contention (striping). `ConcurrentHashMap` = bin-level locking + CAS. **Size
thread pools**: CPU-bound ≈ cores; IO-bound higher. ⚡ avoid unbounded `Executors.newCachedThreadPool`.

**Virtual threads (Loom, 21)** — millions of cheap threads; mounted on a few **carrier** platform
threads, **unmount** on blocking (so blocking is ~free). **Pinning** = a virtual thread can't unmount
(inside `synchronized` or a native frame) → holds the carrier; detect `-Djdk.tracePinnedThreads=full`,
fix by replacing `synchronized` with `ReentrantLock`. Structured concurrency: `StructuredTaskScope`.
⚡ don't pool virtual threads; thread-per-task is the model.

---

## Part 4 · The Language, In Depth

**Generics & erasure** — generics are **erased** at runtime (`List<String>` → `List`); types survive
in **signatures/metadata** (reflectable), not in objects. ⚡ no `new T[]`, no `T.class`, no
`instanceof List<String>`. **Bridge methods** synthesized for covariant overrides. Arrays are
**covariant + reified** (`ArrayStoreException`), generics are **invariant + erased** → use wildcards
(**PECS**: Producer `extends`, Consumer `super`).

**Collections** — `ArrayList` grows **1.5×** via `System.arraycopy` (amortized O(1) add; ⚡ hidden copy
cost — pre-size). `HashMap`: hash spread → bucket; **load factor 0.75** → resize (double) ; bucket
**treeifies to red-black at 8** collisions (& table ≥64), untreeifies at 6 — rescues bad-`hashCode` from
O(n) to O(log n). `ConcurrentHashMap` = per-bin lock + CAS, no locking reads. `TreeMap` = red-black,
O(log n), sorted. ⚡ mutating a key's `hashCode` fields after insertion loses it.

**Strings** — **immutable** (security, sharing, cached hash, thread-safe). **String pool**: literals
interned; `new String("x")` is a separate heap object; `intern()` adds to pool. ⚡ `==` compares
identity — use `.equals`. **Compact strings** (JEP 254): Latin-1 (1 byte/char) vs UTF-16. `+` in a loop
→ use `StringBuilder` (modern `+` compiles to `invokedynamic` `StringConcatFactory`). Text blocks `"""`.

**Equality** — `equals` contract: reflexive/symmetric/transitive/consistent + `x.equals(null)==false`.
**`hashCode` must agree with `equals`** (equal objects → equal hashCodes) or hash collections lose
keys. `Comparable`/`compareTo` should be consistent with `equals` (else `TreeMap`/`TreeSet` misbehave).
`record` auto-generates `equals`/`hashCode`/`toString` from components.

**Modern features as design tools** — **records** (transparent immutable carriers, final fields, safe
publication), **sealed** types (closed hierarchy compiler can exhaustively check), **pattern matching**
for `instanceof`/`switch`, exhaustive `switch`. Combine → **make illegal states unrepresentable**
(bridge to [LLD](../LLD/)).

---

## Part 5 · I/O, Interop & Deployment

**I/O & NIO** — blocking `java.io` (thread-per-connection) vs non-blocking `java.nio` (**channels** +
**buffers** + **selectors**: one thread multiplexes thousands via readiness events). **Direct/off-heap**
`ByteBuffer` bypasses GC (good for I/O, costly to allocate); **memory-mapped** files (`MappedByteBuffer`).
⚡ virtual threads make simple blocking code scale like NIO — often obviating reactive.

**Native interop** — **JNI**: the boundary is slow (no inlining across it), crashes kill the JVM. **FFM
API** (Project Panama, `java.lang.foreign`) — safer, faster, no C glue; the modern replacement.

**Diagnostics** — route by symptom: **slow** → profiler (**async-profiler** flame graph / **JFR** +
JDK Mission Control); **leak** → **heap dump** + dominator tree (MAT); **stalls** → GC logs +
**safepoints** (long *time-to-safepoint* freezes the whole JVM even on a fast collector). Swiss army:
`jcmd`, `jstack` (thread dump), `jmap` (heap). JFR = low-overhead always-on.

**Startup & native image** — JIT warmup costs cold-start latency. **CDS/AppCDS** speeds class loading.
**GraalVM native image** (AOT, closed-world): near-instant start + low memory, **no JIT peak**, longer
build, reflection/proxies need registration. Pick: native for CLI/serverless/scale-to-zero; JVM for
long-running high-throughput. (Project Leyden = future middle ground.)

---

## Part 6 · Principal Skills

**Perf reasoning** — hypothesis → **measure** (warm JVM, JMH/JFR/profiler) → locate → change **one
thing** → re-measure. Distinguish throughput / latency / tail (p99) / allocation. Don't trust a number
you didn't measure — including these.

**Sources** — primary sources beat blogs: **JVMS** (class loading Ch.5, instructions Ch.6), **JLS** (`§17`
= the memory model), **JEPs** (why a feature exists), **OpenJDK source** (read `HashMap`, `AQS`,
`ThreadPoolExecutor`). Anchor every fact to a *version* (internals change: PermGen→metaspace,
biased-locking removal, virtual threads).

**Version timeline (internals)** — 8: PermGen→Metaspace, lambdas/`invokedynamic`. 9: G1 default, modules.
11: LTS, no separate JRE. 15: biased locking deprecated, text blocks. 17: LTS, sealed, removed biased
locking direction. 21: LTS, **virtual threads**, **generational ZGC**, pattern matching for switch.

**Toolbelt** — `javap` (bytecode), **JOL** (layout/size), **JMH** (benchmarks), `-Xlog:gc*` (GC),
`-XX:+PrintCompilation`/`+PrintInlining` (JIT), **JFR**/**async-profiler** (profiles), `jcmd`/`jstack`/`jmap` (live JVM).

> Full version-by-version history: [VERSION-CHANGES.md](VERSION-CHANGES.md). Applied/interview breadth:
> [STAFF-INTERVIEW-CRASHCOURSE.md](STAFF-INTERVIEW-CRASHCOURSE.md).
> Full depth + interactive animations: open each [part](README.md). Spring Boot crash-course:
> [../spring-boot/CHEATSHEET.md](../spring-boot/CHEATSHEET.md).
