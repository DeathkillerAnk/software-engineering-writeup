# 31 · The Java Internals Reading List

> The curated map: what to read alongside this track, what to read after, and what to read for where
> you're headed. Sequenced, opinionated, and short enough to actually follow.
> [← Part 6 · Principal Skills](README.md) · prev: 30 · Reading the Specs & the Source

---

## Read *during* this track (companions)

- **Effective Java** (Bloch) — the language-usage counterpart to these internals; the equality,
  generics, and concurrency items pair directly with [Part 4](../04-language-in-depth/) and
  [Part 3](../03-concurrency-and-jmm/).
- **Java Concurrency in Practice** (Goetz et al.) — still *the* JMM/`java.util.concurrent` book;
  read after [ch.16–18](../03-concurrency-and-jmm/). Pre-dates virtual threads — pair with the Loom
  JEPs (444, 453).
- **The class javadocs** ([ch.30](README.md)): `HashMap`, `AQS`, `ThreadPoolExecutor`,
  `CompletableFuture` — free, canonical, excellent.
- **JEPs for everything modern** ([VERSION-CHANGES.md](../VERSION-CHANGES.md) indexes them by
  release).

## Read *after* (deepening)

- **The Java Virtual Machine Specification** — skim Ch. 4–6 for real after
  [Part 0](../00-platform-and-mental-model/); it reads surprisingly well once you have the mental model.
- **Aleksey Shipilëv's blog + JMH samples** — "JVM Anatomy Quarks" are bite-sized internals gold;
  the JMH samples are the benchmarking curriculum ([ch.13](../02-execution-and-performance/)).
- **"What Every Programmer Should Know About Memory"** (Drepper) — the hardware substrate under
  [ch.14](../02-execution-and-performance/).
- **The GC Handbook** (Jones et al.) — if [Part 1](../01-memory-and-gc/) hooked you; the academic
  backbone of every collector.
- **async-profiler README & wiki** — deceptively deep; the observability sequel to
  [ch.27](../05-io-interop-deployment/).

## People worth following

- **Aleksey Shipilëv** (JVM anatomy, benchmarking) · **Brian Goetz** (language architecture — his
  talks explain *why* Java evolves as it does) · **Ron Pressler** (Loom) · **Martin Thompson**
  (mechanical sympathy) · **Erik Österlund / Per Lidén** (ZGC) · **Nitsan Wakart** (safepoints,
  profiling honesty) · **Gil Tene** (latency, "How NOT to Measure Latency" — mandatory).

## By destination

- **Performance engineering:** Shipilëv's quarks → Gil Tene's latency talks → Brendan Gregg
  (*Systems Performance*, flame graphs) → JITWatch.
- **GC / runtime engineering:** GC Handbook → HotSpot source (`src/hotspot/share/gc/`) → JVMLS talks.
- **Distributed systems on the JVM:** *Designing Data-Intensive Applications* (Kleppmann) — pairs
  with the [HLD track](../../HLD/) — plus Kafka/Netty internals (both showcase
  [ch.25](../05-io-interop-deployment/)'s NIO + mmap ideas in production form).
- **Frameworks:** the [spring-boot track](../../spring-boot/) here, then Spring's own source — the
  container ([spring Part 0](../../spring-boot/00-foundations-the-container/)) is a masterclass in
  reflection, proxies, and classloading applied.

## The habit that outlasts the list

One paper/talk/quark **per week**, tied to something you touched at work that week — retention comes
from the collision of reading and practice, not volume. And when a question arises: **primary sources
first** ([ch.30](README.md)) — the blog post is someone's summary of the JLS section you can read
yourself.

> 🎉 **This closes the java track** — Parts 0–6, all chapters. The internals are now yours to keep
> sharp: re-run the [drills](../STUDY-METHOD.md), re-take the [self-checks], and measure things.
