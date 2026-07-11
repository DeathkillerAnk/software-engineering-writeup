# Build Progress — java/ & spring-boot/ chapters + animations

> Source of truth for the autonomous build loop. Each iteration: build the next incomplete unit(s),
> tick the box, keep the "Build queue" current. A **unit** = a chapter `.md` and/or an interactive
> HTML animation. Flagship topics first. Both tracks target the same quality bar as the scaffold
> READMEs (predict → reveal/measure → reconcile; honest, version-accurate, principal-level).

## Conventions
- Animations: self-contained single-file HTML (vanilla JS + canvas/SVG, no build/deps/network),
  Play/Pause/Step/Reset + scrub, "what to notice" caption, dark theme. Reuse the harness in
  [`shared-viz/`](shared-viz/) (inline-copied for self-containment).
- Chapters: deep teaching writeups (not the part-README syllabus) ending in a **Self-Check** and a
  **▶ Watch it** link to the animation. Mermaid for structure; HTML for motion.

## Build queue (next up, in order)
1. ✅ Foundation: shared animation harness (`shared-viz/`)
2. ✅ java · `young-gen-copy.html` (GC minor collection) — flagship animation
3. ✅ java · Ch.07 Garbage Collection Fundamentals (prose) + `mark-sweep-compact.html` (verified)
4. ✅ spring · `proxy-interception.html` (self-invocation) + Ch.07 Spring AOP (verified)
5. ✅ java · Ch.05 Object Layout + `object-header.html` (verified)
6. ✅ spring · `bean-lifecycle.html` + Ch.04 Bean Lifecycle (verified)
7. ✅ java · Ch.06 Allocation & the Heap + `tlab-allocation.html` (verified)
8. ✅ spring · Ch.05 DI Internals & Circular Deps + `circular-dependency.html` (verified)
9. ✅ java · Ch.08 The Modern Collectors + `g1-regions.html` (verified)
10. ✅ spring · Ch.06 BeanPostProcessor + `bpp-pipeline.html` (verified)
11. ✅ java · Ch.09 Reference Types & Cleaners + `reference-strength.html` (verified) — **java Part 1 COMPLETE** (ch 05–09 + 6 animations)
12. ✅ spring · Ch.08 Environment & Config + Ch.09 Events → **spring Part 1 COMPLETE** (ch 06–09 + 2 animations)
13. ✅ java · Ch.11 The JIT Compilers + `tiered-compilation.html` (verified)
14. ✅ spring · Ch.11 Auto-Configuration Internals + `autoconfig-conditions.html` (verified)
15. ✅ java · Ch.16 The Java Memory Model + `reordering.html` (verified)
16. ⬜ **USER PRIORITY — java Part 0 (00-platform-and-mental-model), currently empty:**  ← FOCUS HERE
    a. ✅ Ch.01 The Java Platform & Execution Pipeline + `pipeline.html` (verified)
    b. ✅ Ch.02 The Class File & Bytecode + `operand-stack.html` (verified)
    c. ✅ Ch.03 Class Loading, Linking & Initialization + `classloader-delegation.html` (verified)
    d. ✅ Ch.04 JVM Runtime Data Areas (chapter only; Mermaid memory map validated) — **🎉 java Part 0 COMPLETE** (ch01–04 + 3 animations: pipeline/operand-stack/classloader-delegation)
17. ✅ spring · Ch.13 SpringApplication Startup + `springapplication-run.html` (verified)
18. ⬜ … continue remaining parts/chapters per the tables below. Candidates: spring Part 2 (ch10/12/14/15), spring Part 0 `di-resolution.html` + ch01–03, java Ch.10 (interpreter), then flagships for Part 3 (dispatcherservlet-flow), Part 4 (transaction-proxy), Part 5 (security-filter-chain), java Part 2/3 remaining.
- Interlude (user request, 2026-07-02): create dedicated **version-changes** references (partial coverage existed only as brief timelines in the cheatsheets) → `java/VERSION-CHANGES.md` + `spring-boot/VERSION-CHANGES.md` (cross-linked from both cheatsheets).
- Iter 20: `spring-boot/03-web-mvc-and-reactive/16-spring-mvc-internals-the-dispatcherservlet.md` (full chapter) + `dispatcherservlet-flow.html` (verified: 6-stage request pipeline Client→Dispatcher→HandlerMapping→HandlerAdapter→Controller→MsgConverter, payload → JSON, response return). spring Part 3 started.
- Iter 21: **user briefly redirected to java-only, then back to both.** `java/04-language-in-depth/21-collections-internals.md` (full chapter) + `hashmap-resize.html` (verified: table doubling + rehash, then a bucket treeifies list→red-black tree; clean coords). java Part 4 started.
- Iter 22: `spring-boot/04-data-and-transactions/22-transaction-management-internals.md` (full chapter) + `transaction-proxy.html` (verified: begin→commit, rollback rules, self-invocation trap = no new tx, REQUIRES_NEW suspend+new-tx; rode out a brief classifier outage mid-screenshot). spring Part 4 started. Prompt now "java & spring boot" (both tracks) again.
- Iter 23: `java/03-concurrency-and-jmm/19-virtual-threads-and-structured-concurrency.md` (full chapter: mount/unmount, carriers, pinning + JDK-24 note, structured concurrency, VT-vs-reactive) + `virtual-threads.html` (verified: 6 VTs on 2 carriers, I/O unmount/remount, pinned vt-4 holding carrier-1 hostage). Next (spring's turn): Ch.24 Security filter chain + `security-filter-chain.html`.
- Iter 24: `spring-boot/05-production/24-spring-security-internals-the-filter-chain.md` (full chapter: DelegatingFilterProxy→FilterChainProxy→ordered filters, AuthenticationManager/UserDetailsService/BCrypt, 401-vs-403, Security-6 SecurityFilterChain @Bean, CSRF-when, @PreAuthorize AOP trap) + `security-filter-chain.html` (verified: happy path 200, bad-token 401 short-circuit, role-denied 403). spring Part 5 started. Next (java's turn): Ch.22 Strings + `string-pool.html`.
- Iter 25: `java/04-language-in-depth/22-strings.md` (full chapter: immutability's 4 payoffs, pool + intern, compact strings, `+`→invokedynamic/StringConcatFactory, loop-concat O(n²) trap) + `string-pool.html` (verified: a/b→pooled, c=new String→distinct heap obj, a==c false, intern()→pooled). java Part 4 now has ch21,22 + hashmap-resize/string-pool. Next (spring's turn): Ch.21 JPA/Persistence Context + `persistence-context.html`.
- Iter 26: `spring-boot/04-data-and-transactions/21-jpa-hibernate-and-the-persistence-context.md` (full chapter: L1 cache/identity, entity lifecycle, dirty checking w/o save(), LazyInitializationException + OSIV warning, N+1 detect/fix, flush timing; classifier-outage retry on write) + `persistence-context.html` (verified: managed→dirty→flush UPDATE at commit, detached lazy ⛔, N+1 SQL log; fixed one garbled label coord). spring Part 4 now has ch21,22 + both animations. Next (java's turn): Ch.17 Locks & Synchronization Internals + `lock-inflation.html`.
- Iter 27: `java/03-concurrency-and-jmm/17-locks-and-synchronization-internals.md` (full chapter: mark-word lock states, lightweight CAS path, inflation→ObjectMonitor/park-unpark, wait/notify + spurious wakeups, biased-locking-removed, synchronized-vs-ReentrantLock + VT pinning tie) + `lock-inflation.html` (verified: T1 CAS→lightweight, T2 contend→INFLATE, ObjectMonitor w/ entry queue, ns-vs-µs cost meter). java Part 3 now has ch16,17,19 + reordering/lock-inflation/virtual-threads. Next (spring's turn): Ch.10 What Boot Adds (chapter-only) or Ch.20 Spring Data + repo-proxy; pick Ch.20.
- Iter 28 (double, both chapter-only): `spring-boot/04-data-and-transactions/20-spring-data-and-the-repository-abstraction.md` (repo proxy via RepositoryFactorySupport, fail-fast derivation, 3 query styles, leaks checklist, custom fragments; Mermaid = validated pattern) + `23-jdbc-connection-pooling-and-the-caching-abstraction.md` (JdbcTemplate/JdbcClient, HikariCP pool-as-ceiling + cores×2 + tx-holds-connection outage, @Cacheable proxy + self-invocation, Caffeine-vs-Redis, stampede). 🎉 **spring Part 4 (Data & Transactions) COMPLETE** — ch20–23 + transaction-proxy/persistence-context animations. Next (java's turn): Ch.18 java.util.concurrent + `aqs-queue.html`.
- Iter 29: `java/03-concurrency-and-jmm/18-java-util-concurrent.md` (full chapter: CAS + retry loop + ABA, AtomicLong-vs-LongAdder striping, AQS state+FIFO with subclass table, fair-vs-barging, CHM recall, ThreadPoolExecutor sizing/queue/rejection traps) + `aqs-queue.html` (verified: T1 CAS fast path, T2/T3 enqueue+park, release→unpark(head)→T2 wins, subclass meanings). **java Part 3 chapters now 16–19 done; only Ch.15 Threads & the OS remains** (all 4 Part-3 animations ✅). Next (spring's turn): Ch.10 What Boot Adds + Ch.12 Starters (both chapter-only) — would leave spring Part 2 needing only ch14/15.
- Iter 32 (chapter-only): `spring-boot/02-spring-boot-core/14-externalized-configuration.md` (full chapter: one ordered Environment/PropertySources, precedence table CLI>env>system-props>profile-file>base, relaxed binding + env-var mapping MY_APP_TIMEOUT→my-app.timeout, @Value vs @ConfigurationProperties incl. Duration/DataSize + @Validated, profiles/@Profile/groups/multi-doc YAML, origin tracking + /actuator/env & /configprops + secrets masking). Mermaid validator was down (503) — trusted the simple flowchart. **spring Part 2 now needs only ch.15 Embedded Servers** to complete (ch10–14 done + autoconfig-conditions/springapplication-run animations). Next (java's turn): Ch.12 JIT optimizations + `inlining.html`, or Ch.10 interpreter (chapter-only); pick java Ch.10 to keep momentum, or Ch.12+inlining for a flagship — pick Ch.12 + `inlining.html`.
- Iter 31: `java/02-execution-and-performance/14-mechanical-sympathy.md` (full chapter: memory-hierarchy latency table, 64-byte cache lines + false sharing, `@Contended`/padding fix tied to LongAdder/Disruptor, row-vs-column & AoS/SoA locality, pointer-chasing, branch prediction, "last layer not first") + `cpu-cache-false-sharing.html` (verified: two threads on one shared line ping-ponging ownership w/ invalidation stalls + throughput meter, then padded onto separate lines flying at ~5×). java Part 2 now has ch11,14 + tiered-compilation/cpu-cache-false-sharing (ch10/12/13 + inlining.html remain). Next (spring's turn): Ch.14 Externalized Configuration + Ch.15 Embedded Servers (would complete spring Part 2), or spring Part 0 ch01–03 + `di-resolution.html`; pick spring Ch.14.
- Iter 30 (3 chapter-only): `java/03-concurrency-and-jmm/15-threads-and-the-os.md` (platform thread = OS thread, ~1MB stack/low-thousands ceiling, RUNNABLE ambiguity, daemon/interrupt, stop() dead) → 🎉 **java Part 3 (Concurrency & the JMM) COMPLETE** (ch15–19 + reordering/lock-inflation/aqs-queue/virtual-threads). Plus `spring-boot/02-spring-boot-core/10-what-boot-adds.md` + `12-starters-and-dependency-management.md` → **spring Part 2 now needs only ch14/15** (auto-config animations already done). Next (java's turn): Ch.14 Mechanical Sympathy + `cpu-cache-false-sharing.html`.

---

## java/ track

### Animations
| File | Part | Status |
|---|---|---|
| `young-gen-copy.html` | 01 | ✅ |
| `mark-sweep-compact.html` | 01 | ✅ |
| `object-header.html` | 01 | ✅ |
| `tlab-allocation.html` | 01 | ✅ |
| `g1-regions.html` | 01 | ✅ |
| `reference-strength.html` | 01 | ✅ |
| `pipeline.html` | 00 | ✅ |
| `operand-stack.html` | 00 | ✅ |
| `classloader-delegation.html` | 00 | ✅ |
| `tiered-compilation.html` | 02 | ✅ |
| `inlining.html` | 02 | ⬜ |
| `cpu-cache-false-sharing.html` | 02 | ✅ |
| `reordering.html` | 03 | ✅ |
| `lock-inflation.html` | 03 | ✅ |
| `aqs-queue.html` | 03 | ✅ |
| `virtual-threads.html` | 03 | ✅ |
| `hashmap-resize.html` | 04 | ✅ |
| `arraylist-growth.html` | 04 | ⬜ |
| `string-pool.html` | 04 | ✅ |
| `nio-selector.html` | 05 | ⬜ |
| `startup-vs-peak.html` | 05 | ⬜ |

### Chapters (01–31)
✅ 01 ✅ 02 ✅ 03 ✅ 04 ✅ 05 ✅ 06 ✅ 07 ✅ 08 ✅ 09 ⬜ 10 ✅ 11 ⬜ 12 ⬜ 13 ✅ 14 ✅ 15
✅ 16 ✅ 17 ✅ 18 ✅ 19 ⬜ 20 ✅ 21 ✅ 22 ⬜ 23 ⬜ 24 ⬜ 25 ⬜ 26 ⬜ 27 ⬜ 28 ⬜ 29 ⬜ 30 ⬜ 31

---

## spring-boot/ track

### Animations
| File | Part | Status |
|---|---|---|
| `proxy-interception.html` | 01 | ✅ |
| `bean-lifecycle.html` | 00 | ✅ |
| `circular-dependency.html` | 00 | ✅ |
| `di-resolution.html` | 00 | ⬜ |
| `bpp-pipeline.html` | 01 | ✅ |
| `autoconfig-conditions.html` | 02 | ✅ |
| `springapplication-run.html` | 02 | ✅ |
| `dispatcherservlet-flow.html` | 03 | ✅ |
| `reactive-backpressure.html` | 03 | ⬜ |
| `transaction-proxy.html` | 04 | ✅ |
| `persistence-context.html` | 04 | ✅ |
| `security-filter-chain.html` | 05 | ✅ |
| `executable-jar.html` | 05 | ⬜ |
| `startup-cost-breakdown.html` | 06 | ⬜ |

### Chapters (01–31)
⬜ 01 ⬜ 02 ⬜ 03 ✅ 04 ✅ 05 ✅ 06 ✅ 07 ✅ 08 ✅ 09 ✅ 10 ✅ 11 ✅ 12 ✅ 13 ✅ 14 ⬜ 15
✅ 16 ⬜ 17 ⬜ 18 ⬜ 19 ✅ 20 ✅ 21 ✅ 22 ✅ 23 ✅ 24 ⬜ 25 ⬜ 26 ⬜ 27 ⬜ 28 ⬜ 29 ⬜ 30 ⬜ 31

---

## Log
- Iter 1: shared-viz harness + `java/01-memory-and-gc/visualizations/young-gen-copy.html` (flagship GC minor-collection animation).
- Iter 2: `java/01-memory-and-gc/07-garbage-collection-fundamentals.md` (full chapter) + `mark-sweep-compact.html` (browser-verified: fragmentation→compaction, no errors).
- Iter 3: `spring-boot/01-extension-and-aop/07-spring-aop-proxies.md` (full chapter) + `proxy-interception.html` (browser-verified: proxy advice path + self-invocation trap, no errors). Static server now serves repo root (java/.claude/launch.json) so both tracks are previewable.
- Iter 4: `java/01-memory-and-gc/05-object-layout-in-memory.md` (full chapter) + `object-header.html` (verified; fixed a bit-field text-rendering bug found via screenshot — labels now render above each segment).
- Iter 5: `spring-boot/00-foundations-the-container/04-bean-lifecycle-and-scopes.md` (full chapter) + `bean-lifecycle.html` (verified; nudged a label overlap; worked around a preview viewport-collapse glitch via preview_resize). Status: 6 chapters + 6 animations done across both tracks.
- Iter 6: `java/01-memory-and-gc/06-allocation-and-the-heap.md` (full chapter) + `tlab-allocation.html` (verified: 3-thread bump allocation, refill slow path, escape analysis). Part 1 (java Memory & GC) now has 4 of 5 chapters (05,06,07; 08/09 remain) and 3 animations.
- Iter 7: `spring-boot/00-foundations-the-container/05-di-internals-and-circular-dependencies.md` (full chapter) + `circular-dependency.html` (verified: three-level cache resolves setter cycle; constructor cycle fails). spring Part 0 now has chapters 04,05 + 2 animations. Total: 8 chapters + 8 animations.
- Iter 8: `java/01-memory-and-gc/08-the-modern-collectors.md` (full chapter) + `g1-regions.html` (verified: region grid, per-region garbage marking, garbage-first selection of ≥65% regions). java Part 1 (Memory & GC) now has chapters 05–08 + 4 animations. Total: 9 chapters + 9 animations.
- Iter 9: `spring-boot/01-extension-and-aop/06-beanpostprocessor-and-beanfactorypostprocessor.md` (full chapter) + `bpp-pipeline.html` (verified; fixed a duplicate-label bug and a label collision; rode out a brief classifier outage by retrying the write). spring Part 1 now has chapters 06,07 + 2 animations. Total: 10 chapters + 10 animations.
- Iter 10: `java/01-memory-and-gc/09-reference-types-and-cleaners.md` (full chapter) + `reference-strength.html` (verified: normal vs memory-pressure GC, ReferenceQueue). 🎉 **java Part 1 (Memory & GC) COMPLETE**: chapters 05–09 + 6 animations. Total: 11 chapters + 11 animations.
- Iter 11: `spring-boot/01-extension-and-aop/08-environment-properties-and-configuration-binding.md` + `09-events-and-the-application-event-model.md` (both full chapters; no animations specced for these). 🎉 **spring Part 1 (Extension & AOP) COMPLETE**: chapters 06–09 + 2 animations. Total: 13 chapters + 11 animations.
- Iter 12: `java/02-execution-and-performance/11-the-jit-compilers.md` (full chapter) + `tiered-compilation.html` (verified: counter climbs through C1/C2 thresholds, speculation, deopt on guard failure, recompile). java Part 2 started. Total: 14 chapters + 12 animations.
- Iter 13: `spring-boot/02-spring-boot-core/11-auto-configuration-internals.md` (full chapter) + `autoconfig-conditions.html` (verified: @Conditional evaluation, applied/excluded with reasons, @ConditionalOnMissingBean backoff on override). spring Part 2 started. Total: 15 chapters + 13 animations.
- Iter 14: `java/03-concurrency-and-jmm/16-the-java-memory-model.md` (full chapter — the hardest topic) + `reordering.html` (verified; fixed a stray-coordinate bug + made the HB note phase-aware: flag-publication reorder bug, then volatile happens-before fix). java Part 3 started. Total: 16 chapters + 14 animations.
- Iter 15: **USER REPRIORITIZED to java Part 0 (was empty).** `java/00-platform-and-mental-model/01-the-java-platform-and-execution-pipeline.md` (full chapter) + `pipeline.html` (verified; fixed right-edge clip + removed overlapping edge labels: source→javac→bytecode→interpreter→JIT→native + deopt). java Part 0 started. Total: 17 chapters + 15 animations.
- Interlude (user request): wrote `java/CHEATSHEET.md` and `spring-boot/CHEATSHEET.md` — dense crash-course cheatsheets covering ALL topics in both tracks (every part/chapter distilled to key facts/numbers/gotchas/commands, version-anchored).
- Final (user request): staff-level interview breadth the internals sheets don't cover. Initially one root file, then **split per-folder per user** → `java/STAFF-INTERVIEW-CRASHCOURSE.md` (applied core Java: Streams/Optional/exceptions/concurrency-utils/CompletableFuture/collections-choice/date-time + JVM-in-interviews + Java/JVM Q&A) and `spring-boot/STAFF-INTERVIEW-CRASHCOURSE.md` (REST design/validation/Spring Data/tx/caching/security-flows/async/messaging/resilience/inter-service/Spring Cloud/observability/migrations/testing/deployment + Spring Q&A). Each self-contained (shared "how staff interviews differ" + staff-meta) and cross-linked to its `CHEATSHEET.md`, the other track, HLD, LLD. Root combined file removed. **Per-track doc set = `CHEATSHEET.md` + `STAFF-INTERVIEW-CRASHCOURSE.md` in each folder.**
- **🛑 BUILD LOOP STOPPED per user.** No ScheduleWakeup rescheduled; no Monitor armed. To resume later: re-run `/loop` (continue java Part 0 Ch.02–04, then the remaining parts/chapters per the queue & tables above).

## Status snapshot at loop stop
Built & browser-verified: **17 chapters + 15 animations** across both tracks. **Complete parts:** java Part 1 (Memory & GC, ch05–09 + 6 anims), spring Part 1 (Extension & AOP, ch06–09 + 2 anims). **Started:** java Part 0 (ch01 + pipeline), Part 2 (ch11 JIT + tiered-compilation), Part 3 (ch16 JMM + reordering); spring Part 0 (ch04–05 + bean-lifecycle/circular-dependency/di-resolution[di-resolution.html still ⬜]), Part 2 (ch11 auto-config + autoconfig-conditions). Plus scaffolding (READMEs/ROADMAP/STUDY-METHOD/VISUALIZATIONS), shared-viz harness, and 4 review docs (`CHEATSHEET.md` + `STAFF-INTERVIEW-CRASHCOURSE.md` in each of `java/` and `spring-boot/`). Remaining chapters/animations tracked in the tables above.

- **▶ LOOP RESUMED (user: `/loop continue building the chapter now`).** Iter 16: `java/00-platform-and-mental-model/02-the-class-file-and-bytecode.md` (full chapter) + `operand-stack.html` (verified: `a+b*c` stepped through the operand stack + locals array, stack-machine model). java Part 0 now has Ch.01–02 + 2 animations; next = Ch.03 class loading + `classloader-delegation.html`, then Ch.04. (Authoritative build state = the checkboxes/tables above, not running totals.)
- Iter 17: `java/00-platform-and-mental-model/03-class-loading-linking-and-initialization.md` (full chapter) + `classloader-delegation.html` (verified; fixed a behind-boxes rotated label + a stray-coordinate: 5-phase parent-delegation incl. spoof-blocked `java.lang.String`). java Part 0 = Ch.01–03 + 3 animations; only Ch.04 (Runtime Data Areas, chapter-only) remains to finish the part.
- Iter 18: `java/00-platform-and-mental-model/04-jvm-runtime-data-areas.md` (full chapter; per-thread vs shared memory map, OOM taxonomy, off-heap/NMT; Mermaid validated). 🎉 **java Part 0 (Platform & Mental Model) COMPLETE** — chapters 01–04 + 3 animations. **3 full parts done now** (java Part 0, java Part 1, spring Part 1). Next (deferred pre-Part-0-detour): spring Ch.13 + `springapplication-run.html`.
- Iter 19: `spring-boot/02-spring-boot-core/13-the-springapplication-startup-sequence.md` (full chapter) + `springapplication-run.html` (verified: 7-step run() sequence, server flips to LISTENING inside refresh() at step 5, events accumulate, runners last). spring Part 2 now has ch10?/11/13 (+ autoconfig-conditions, springapplication-run animations). Rode out a brief classifier outage mid-screenshot (retried).
