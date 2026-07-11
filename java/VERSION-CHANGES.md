# Java — Version-by-Version Changes (a reference)

> What changed in each Java release — **language, API, and JVM/internals** — because internals facts
> have a shelf life and "which version?" is a principal habit (and an interview question). LTS releases
> (**8 · 11 · 17 · 21 · 25**) get spotlights; interim releases are in the timeline. ⚡ = a change that
> *breaks* or *surprises* on upgrade. Verify anything post-21 against the release notes / [JEPs](https://openjdk.org/jeps/0).

## The release model (know this first)

- **6-month cadence** since Java 9 (Sept 2017). Feature releases ship on time; features that aren't
  ready simply wait.
- **LTS every 2 years**: **8, 11, 17, 21, 25, …** — the versions companies actually run and interviews
  target. Non-LTS releases get 6 months of updates.
- **Preview / incubator / experimental**: big features land *gated* first (enable with
  `--enable-preview`), stabilize over several releases, then become standard. So "records" appeared as
  preview in 14 and standard in 16; "virtual threads" preview in 19, standard in 21. Knowing the
  *status* in a given version is the real skill.

---

## LTS spotlights (the ones interviews care about)

### Java 8 (2014) — the functional watershed
- **Language/API:** lambdas, functional interfaces, **Stream API**, **`Optional`**, default & static
  interface methods, method references, **`java.time`** (JSR-310), `CompletableFuture`, `StringJoiner`.
- **Internals:** ⚡ **PermGen removed → Metaspace** (class metadata moved to native memory; no more
  `PermGen space` OOM, tune `-XX:MaxMetaspaceSize`); interned string pool moved to heap (was Java 7);
  Nashorn JS engine.
- Still widely deployed; the baseline most "legacy" apps sit on.

### Java 11 (2018) — the first modern LTS
- **Language/API:** `var` in lambda params (local `var` itself was Java 10); standardized **HTTP Client**
  (`java.net.http`, async/HTTP-2); `String.strip/isBlank/lines/repeat`; single-file source launch
  (`java Foo.java`).
- **Internals/GC:** **ZGC** & **Epsilon** (no-op) GC arrive *experimental*; **JFR (Flight Recorder)
  open-sourced**; TLS 1.3; **container-awareness** (from 10) matured.
- ⚡ **Removals:** Java EE & CORBA modules **removed** (apps needed external JAXB/JAX-WS/`jakarta`
  deps); no separately-shipped JRE (use `jlink`); Nashorn deprecated; Applets deprecated.

### Java 17 (2021) — modern-language baseline
- **Language:** **sealed classes (standard)**, records & pattern-matching-for-`instanceof` already
  standard (16), **pattern matching for `switch` (preview)**, text blocks (standard, 15).
- **Internals:** strong encapsulation of JDK internals **enforced by default** (⚡ reflection into
  `sun.*`/`jdk.internal.*` now fails without `--add-opens` — a classic upgrade break); new
  `RandomGenerator` API; macOS/AArch64 port; context-specific deserialization filters.
- ⚡ **Removals/deprecations:** experimental AOT & Graal JIT removed from the JDK; RMI Activation
  removed; Applet API deprecated for removal; Security Manager deprecated for removal.

### Java 21 (2023) — the concurrency + pattern-matching LTS
- **Language:** **pattern matching for `switch` (standard)**, **record patterns (standard)**,
  **sequenced collections** (`SequencedCollection/Map`, `getFirst/getLast`), string templates (preview,
  later withdrawn).
- **Concurrency (headline):** **virtual threads (standard, JEP 444)** — Project Loom; structured
  concurrency & scoped values (preview).
- **GC/internals:** **generational ZGC** (major pause/throughput win); continued G1 improvements.
- The recommended target for new work today, and what this whole track baselines on.

### Java 25 (2025) — the newest LTS
- Successor LTS to 21. Headline directions that finalized/advanced around here: **compact object
  headers** (Project **Lilliput** — smaller object header → real heap savings), **structured
  concurrency** and **scoped values** maturing, **module import declarations** & **flexible
  constructor bodies** (statements before `super()/this()`), **stream gatherers** (standard, from 24),
  and early **Project Leyden** work (AOT class-loading/profiling for faster startup).
- ⚡ Exact JEP status varies — confirm against the Java 25 release notes before quoting in an interview.

---

## Full timeline (per release)

| Ver (year) | Language / API | JVM / internals | Notable removals |
|---|---|---|---|
| **8** (2014) | lambdas, Streams, Optional, java.time, default methods | **PermGen→Metaspace** | — |
| 9 (2017) | **JPMS modules**, `List.of`, JShell, Stream `takeWhile` | **G1 = default GC**, compact strings (JEP 254), multi-release JARs | — |
| 10 (2018) | **`var`** (local inference), `List.copyOf` | **container-aware JVM** (cgroups, on by default), parallel full GC for G1, AppCDS | javah |
| **11** (2018) | HTTP Client, `String.strip/isBlank`, `var` in lambdas | **ZGC/Epsilon (exp)**, **JFR open-sourced**, TLS 1.3 | ⚡ Java EE & CORBA modules, JRE, JavaFX (unbundled) |
| 12 (2019) | switch expr (preview), Teeing collector | **Shenandoah (exp)**, G1 abortable mixed GCs | — |
| 13 (2019) | text blocks (preview), switch expr (2nd) | dynamic CDS, ZGC returns memory | — |
| 14 (2020) | **records (preview)**, instanceof patterns (preview), **switch expr (standard)** | **helpful NPEs**, jpackage (incubator), ZGC on macOS/Win | ⚡ **CMS GC removed** |
| 15 (2020) | **text blocks (standard)**, sealed (preview) | **ZGC & Shenandoah = production**, hidden classes | ⚡ **Nashorn removed**, ⚡ **biased locking disabled by default** |
| 16 (2021) | **records (standard)**, **instanceof patterns (standard)**, sealed (2nd) | **strong encapsulation on by default**, Vector & FFM (incubator) | — |
| **17** (2021) | **sealed (standard)**, switch patterns (preview) | strong encapsulation enforced, new RNG API | ⚡ experimental AOT/Graal JIT, RMI Activation |
| 18 (2022) | simple web server, `@snippet` javadoc | **UTF-8 default charset**, FFM (2nd inc.) | ⚡ **`finalize()` deprecated for removal (JEP 421)** |
| 19 (2022) | **virtual threads (preview)**, record patterns (preview) | structured concurrency (incubator), FFM (preview) | — |
| 20 (2023) | scoped values (incubator), previews mature | — | — |
| **21** (2023) | **virtual threads / switch patterns / record patterns (standard)**, **sequenced collections** | **generational ZGC** | ⚡ 32-bit x86 deprecated |
| 22 (2024) | **FFM (standard)**, unnamed variables/patterns, stream gatherers (preview) | G1 region pinning (JNI), multi-file source launch | — |
| 23 (2024) | primitive patterns (preview), module import (preview), markdown javadoc | ZGC generational by default | string templates withdrawn (redesign) |
| 24 (2025) | stream gatherers (standard), flexible constructor bodies (preview) | **compact object headers (experimental, Lilliput)**, AOT class-loading (Leyden), ML-KEM/ML-DSA PQC | ⚡ 32-bit x86 port removed, Security Manager disabled |
| **25** (2025) | module import & flexible constructors (standard), scoped values maturing | compact headers + Leyden AOT advancing, structured concurrency | — |

---

## Cross-cutting threads (how the platform evolved)

- **GC:** Serial/Parallel (early) → **G1 default (9)** → **ZGC/Shenandoah experimental (11/12)** →
  **production (15)** → **generational ZGC (21)** → **default-generational (23)**. The arc: from
  throughput-first, stop-the-world toward **concurrent, sub-millisecond pauses on huge heaps**.
- **Concurrency:** `synchronized`/`j.u.c.` (5) → `CompletableFuture` (8) → ⚡ **biased locking removed**
  (15/18) → **virtual threads (19 preview → 21 standard)** + structured concurrency + scoped values
  (Project **Loom**). Blocking got cheap; thread-per-request came back.
- **Language toward data/immutability:** lambdas/Streams (8) → **`var` (10)** → **records, sealed,
  pattern matching, switch expressions (14–21)** → record/primitive patterns (21–24). Trend:
  make illegal states unrepresentable, less boilerplate.
- **Native & memory:** JNI → **Foreign Function & Memory API** (Panama, incubator 16 → standard 22);
  **compact object headers** (Lilliput, 24+) shrink the [object header](CHEATSHEET.md). Project
  **Valhalla** (value/primitive classes) is the big still-in-flight one.
- **Startup:** interpret+JIT → **AppCDS (10/13)** → GraalVM native image (external) → **Project
  Leyden** (AOT class-loading/profiling, 24+) for faster cold start without giving up the JIT.
- **Modules:** **JPMS (9)** + **strong encapsulation enforced (16/17)** — the upgrade that most often
  breaks reflection-heavy libraries (needs `--add-opens`/`--add-exports`).

---

## Upgrade gotchas (the "we bumped the LTS and it broke" list)

- **8 → 11:** ⚡ Java EE modules gone → add `jakarta.*`/JAXB deps; PermGen flags (`-XX:PermSize`) now
  error; `sun.misc.Unsafe` warnings.
- **11 → 17:** ⚡ **strong encapsulation enforced** — reflection into JDK internals fails without
  `--add-opens`; CMS (`-XX:+UseConcMarkSweepGC`) removed → flag errors; Nashorn gone.
- **17 → 21:** mostly additive; ⚡ audit `synchronized` around blocking calls before adopting virtual
  threads (**pinning**); string templates were previewed then **withdrawn** — don't depend on them.
- **Any:** `finalize()` is deprecated for removal — migrate to `Cleaner`/`try-with-resources`; flags
  and GC options get removed between LTS jumps (read the release notes).

---

## Interview lens & how to check

- Expect *"what changed in Java 8/11/17/21?"* and *"is feature X preview or standard in version Y?"*
  Anchor every internals claim to a version — "biased locking? removed in 18" beats a vague answer.
- **How to verify:** `java --version`; the [JDK release notes](https://www.oracle.com/java/technologies/javase/);
  the [JEP index](https://openjdk.org/jeps/0) (each feature's status + version); `java --list-modules`;
  `java -Xlog:gc*` to see the active collector.

> Companion: [CHEATSHEET.md](CHEATSHEET.md) (internals recall) · [STAFF-INTERVIEW-CRASHCOURSE.md](STAFF-INTERVIEW-CRASHCOURSE.md)
> (applied breadth). Spring Boot's version history: [../spring-boot/VERSION-CHANGES.md](../spring-boot/VERSION-CHANGES.md).
