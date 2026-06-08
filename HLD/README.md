# High-Level Design (HLD), From First Principles to Principal

> A self-study curriculum that takes you from *building features* to *reasoning about systems the way a principal engineer does* — in a focused 3-month intensive.

This is not a glossary of buzzwords. The gap between a junior engineer and a principal is **not** knowing more boxes-and-arrows; it is **judgment under trade-offs**. A junior says *"we'll use Kafka."* A principal says *"a log gives us replay and decoupling, but it costs us operational complexity and at-least-once semantics we'd have to make idempotent — given our throughput is only 200 writes/sec and we need exactly-once-ish billing, a simple transactional outbox on Postgres is the better call until we 10x."* Everything here is built to grow that second voice in your head.

---

## Who this is for

You, specifically: an engineer in the **first couple of years**, mostly doing application/feature work, who wants real depth in distributed systems and large-scale design — fast, but without the hand-waving. The curriculum **builds fundamentals up from scratch** (networking, the machine, storage engines) before assuming any distributed-systems background, then climbs all the way to consensus, ledgers, and evolutionary architecture.

If you're a more experienced engineer, skim Part 0 and start at Part 1 or 2.

---

## How to use this (read this part — it's the difference between learning and skimming)

Reading these documents will make you *feel* knowledgeable. That feeling is a trap. Knowledge you can't retrieve under pressure is useless in a design review. Use this loop for every topic:

1. **Predict, then read.** Before reading a writeup, spend 2 minutes guessing the answer to its title (e.g. *"how would I keep two database copies in sync?"*). Reading to *check* a guess sticks far better than reading cold.
2. **Read actively.** Each writeup ends with a **Self-Check** section. Close the doc and answer those questions out loud, in your own words, as if explaining to a colleague. If you can't, you don't know it yet — reread that section only.
3. **Apply it.** Every topic connects to the **case studies** in Part 4. After a building-block topic, ask: *"where would this show up in a real design?"*
4. **Design out loud.** The skill being trained is verbal reasoning, not recognition. At least weekly, take a design prompt, set a 45-minute timer, and **talk through a whole design with no notes** — ideally to a rubber duck, a friend, or a recording you replay.
5. **Build one thing per part.** Reading about an LSM-tree is one tenth of understanding it. The [ROADMAP](ROADMAP.md) suggests a small hands-on artifact for each part (e.g. implement a token-bucket rate limiter, run a 3-node Postgres replica and kill the leader). Touching the real thing converts knowledge into intuition.

> **The 3-pass rule for the case studies (Part 4):** Attempt every case study *cold* first (timer on, no peeking). *Then* read the writeup. *Then*, a week later, redo it from a blank page. The cold attempt is where the learning happens — reading first robs you of it.

### Companion book
This curriculum is designed to interleave with ***Designing Data-Intensive Applications* (DDIA) by Martin Kleppmann** — the single best book for this material. Most writeups end with a *"Go Deeper"* pointer to the relevant DDIA chapter. If you read one book alongside this, read that one. The full curated source list is in [Part 5 → Reading List](05-principal-skills/31-reading-list-and-papers.md).

### Diagrams, animations & code
This is built to be *seen*, not just read:
- **Mermaid diagrams** are embedded throughout the writeups (sequence diagrams for protocols, state machines for things like circuit breakers and Raft, flowcharts for request paths). They render inline on GitHub, VS Code, and Obsidian.
- **20 interactive animations** live in **[the animations gallery →](animations/index.html)** — self-contained HTML you open offline in any browser. Drag a node off a consistent-hashing ring, kill a Raft leader, inject a network partition, watch a cache stampede. Each writeup links to its relevant animations with a **▶ Interactive** callout. *Predict the outcome before you press play* — that gap is the learning.
- **Code examples are shown in Go and Java, side by side** — Go for the concurrency/systems idioms (goroutines, channels, `context`), Java for the typed/OO/enterprise idioms (executors, `CompletableFuture`, virtual threads). Read whichever is closer to your daily work; compare them to see the same idea two ways.

---

## The curriculum

Work top to bottom — each part assumes the previous ones. The [ROADMAP](ROADMAP.md) sequences all of this into 12 weeks.

### Part 0 — Foundations *(what every higher-level idea rests on)*
- [01 · Networking for System Design](00-foundations/01-networking.md) — how bytes actually move; latency budgets; TCP/TLS/HTTP/gRPC/QUIC
- [02 · Compute, Concurrency & the Machine](00-foundations/02-compute-and-concurrency.md) — what one server can really do per second
- [03 · Storage Engines](00-foundations/03-storage-engines.md) — B-trees vs LSM-trees, WALs, read/write amplification
- [04 · Back-of-the-Envelope Estimation](00-foundations/04-capacity-estimation.md) — turn a vague requirement into QPS, storage, and machine counts

### Part 1 — Building Blocks *(the components you assemble into systems)*
- [05 · Load Balancing & Consistent Hashing](01-building-blocks/05-load-balancing.md)
- [06 · Caching: Strategies, Invalidation & Failure Modes](01-building-blocks/06-caching.md)
- [07 · Relational Databases: Indexing, Transactions & Isolation](01-building-blocks/07-databases-relational.md)
- [08 · NoSQL & Choosing a Data Model](01-building-blocks/08-databases-nosql.md)
- [09 · Replication](01-building-blocks/09-replication.md)
- [10 · Partitioning & Sharding](01-building-blocks/10-partitioning-sharding.md)
- [11 · Message Queues & Stream Processing](01-building-blocks/11-messaging-and-streaming.md)

### Part 2 — Distributed Systems *(the theory that separates senior from principal)*
- [12 · Consistency Models, CAP & PACELC](02-distributed-systems/12-consistency-and-cap.md)
- [13 · Consensus: Paxos, Raft & Leader Election](02-distributed-systems/13-consensus.md)
- [14 · Time, Clocks & Ordering Events](02-distributed-systems/14-time-clocks-ordering.md)
- [15 · Distributed Transactions, Sagas & Idempotency](02-distributed-systems/15-distributed-transactions.md)
- [16 · Reliability: Designing for Failure](02-distributed-systems/16-reliability-and-failure.md)

### Part 3 — Architecture & APIs *(how you structure and expose systems)*
- [17 · API Design: REST, gRPC, GraphQL & Contracts](03-architecture-and-apis/17-api-design.md)
- [18 · Architectural Styles: Monolith → Microservices → Event-Driven](03-architecture-and-apis/18-architectural-styles.md)
- [19 · Observability: Metrics, Logs, Traces & SLOs](03-architecture-and-apis/19-observability.md)
- [20 · Security in System Design](03-architecture-and-apis/20-security.md)

### Part 4 — Design Case Studies *(where everything above gets used)*
- [21 · The System Design Framework](04-design-case-studies/21-interview-framework.md) — the repeatable method; **read this before the others**
- [22 · URL Shortener, Rate Limiter & Distributed ID Generator](04-design-case-studies/22-url-shortener-rate-limiter-id-gen.md)
- [23 · News Feed / Social Timeline](04-design-case-studies/23-news-feed-and-timeline.md)
- [24 · Chat / Messaging & Notification System](04-design-case-studies/24-chat-and-notifications.md)
- [25 · Typeahead / Search & Proximity (Geo) Service](04-design-case-studies/25-search-and-geo.md)
- [26 · Distributed Object Store (S3) & Key-Value Store (Dynamo)](04-design-case-studies/26-object-store-and-kv-store.md) — the capstone that ties Parts 1–2 together
- [27 · Payment System & Double-Entry Ledger](04-design-case-studies/27-payments-and-ledgers.md)
- [28 · Video Streaming & Web Crawler](04-design-case-studies/28-streaming-and-crawler.md)

### Part 5 — Principal Skills *(the meta-skills that actually define the level)*
- [29 · Trade-off Reasoning & Architecture Decision Records](05-principal-skills/29-tradeoffs-and-adrs.md)
- [30 · Evolutionary Architecture: Migrations, Legacy & Designing for Change](05-principal-skills/30-evolutionary-architecture.md)
- [31 · The Principal's Reading List: Papers, Books & Systems](05-principal-skills/31-reading-list-and-papers.md)

---

## What "principal-level" actually means here

As you study, measure yourself against these markers. They matter more than any single fact:

| Junior thinking | Senior thinking | Principal thinking |
|---|---|---|
| "We'll use X." | "We'll use X because it's good at Y." | "Here are 3 options; given *these specific* requirements and constraints, X wins, and here's exactly what we trade away and when I'd revisit." |
| Designs the happy path. | Handles known errors. | **Assumes everything fails**; designs the degradation and blast radius first. |
| Optimizes early. | Measures, then optimizes. | Knows whether the decision is a [one-way or two-way door](05-principal-skills/29-tradeoffs-and-adrs.md) and spends rigor accordingly. |
| Greenfield only. | Can extend a system. | Can **migrate a running system with zero downtime** and no big-bang rewrite. |
| "It's consistent." | "It's eventually consistent." | States the *exact* consistency model and what the client observes during a partition. |

If you finish this curriculum able to *talk* like the right-hand column — with the numbers and failure modes to back it up — you'll be operating well above your years.

---

## A note on honesty

Every writeup here was generated and then **adversarially fact-checked by a second pass** specifically hunting for the classic system-design errors (the "CAP means pick 2" myth, isolation-level confusion, "exactly-once delivery," and friends). It's still study material, not scripture — when something surprises you, go to the primary source in [the reading list](05-principal-skills/31-reading-list-and-papers.md) and verify. *Verifying claims against primary sources is itself a principal habit.*

Now open the [**ROADMAP**](ROADMAP.md) and start Week 1.
