# The 12-Week HLD Intensive

> A sequenced, milestone-driven plan to go from feature-work engineer to principal-level system-design *judgment* in 3 months. Built for an intensive pace (significant daily time). [← back to the index](README.md)

## How this plan works

- **12 weeks, 6 parts.** Roughly 2–3 deep-dive writeups per week, plus one hands-on artifact and one out-loud mock design.
- **Each week has a checkpoint.** Don't advance until you can pass it *out loud, from memory*. Recognition ≠ recall. If you fail a checkpoint, you found a gap — that's the point.
- **The case studies (Part 4) are the payoff.** Everything in Weeks 1–8 exists to make Weeks 11–12 click. When a case study uses sharding or quorums, you'll already own those ideas.
- **Read DDIA in parallel.** *Designing Data-Intensive Applications* is the companion. The mapping is in each week below.
- **Play the [interactive animations](animations/index.html).** When a writeup shows a **▶ Interactive** callout, open it. For the hard mechanics — consistent hashing, quorums, Raft, CAP partitions, isolation anomalies — *predict the outcome, then drive the animation to check yourself.* Seeing a Raft election or a write-skew play out beats re-reading the paragraph three times.
- **Code in Go and Java.** Examples are given in both. Type out at least one per week by hand in your stronger language — copying builds nothing, retyping builds memory.

### Suggested daily cadence (intensive)
A realistic intensive day, ~2–3 focused hours:

| Block | Time | What |
|---|---|---|
| **Warm-up recall** | 15 min | Answer yesterday's Self-Check questions from memory. Spaced repetition is the highest-ROI 15 minutes you'll spend. |
| **New material** | 60–90 min | Read the day's writeup using *predict → read → self-check* (see [README](README.md#how-to-use-this)). |
| **Application** | 30–45 min | Sketch where today's idea appears in a real system, or work on the week's hands-on artifact. |
| **Weekly (pick a day)** | 45 min | One full **mock design, out loud, no notes**, timed — pick a prompt from the [Problem Bank](PROBLEM-BANK.md) and check against [Worked Solutions](SOLUTIONS.md). |

> **The single most important habit:** the weekly out-loud mock design. Reading builds recognition; *speaking a design under a timer* builds the muscle you're actually here to grow. Record yourself and listen back — you'll hear every place you hand-waved.

---

## Phase 1 · Foundations (Weeks 1–2)

You can't reason about a distributed system if you don't know what one machine and one network link can do. Resist the urge to skip this — vague fundamentals are why most "system design" answers collapse under one good follow-up question.

### Week 1 — The network and the machine
- **Read:** [01 · Networking](00-foundations/01-networking.md), [02 · Compute & Concurrency](00-foundations/02-compute-and-concurrency.md)
- **DDIA:** Ch. 1 (Reliable, Scalable, Maintainable)
- **Master these questions:**
  - Walk through everything that happens, and roughly how long it takes, from "user clicks" to "first byte" — including DNS, TCP, TLS.
  - Why doesn't adding more threads always increase throughput? What's the difference between concurrency and parallelism?
  - When would you choose UDP/QUIC over TCP? What problem does HTTP/2 solve, and what does it *not* solve that HTTP/3 does?
- **Hands-on:** Run `ping`, `traceroute`, and `curl -w` against a service in another region. Write down the real round-trip numbers and compare them to the "latency numbers every engineer should know."
- ✅ **Checkpoint:** From memory, recite the order-of-magnitude latency of: L1 cache, main memory, SSD random read, same-datacenter round trip, cross-continent round trip. Explain why an async event loop serves 10k connections on one thread.

### Week 2 — Storage and estimation
- **Read:** [03 · Storage Engines](00-foundations/03-storage-engines.md), [04 · Capacity Estimation](00-foundations/04-capacity-estimation.md)
- **DDIA:** Ch. 3 (Storage and Retrieval)
- **Master these questions:**
  - Why is an LSM-tree write-optimized and a B-tree read-optimized? Define read/write/space amplification.
  - Why does *every* durable datastore have a write-ahead log?
  - Estimate the storage and peak QPS for a photo-sharing app with 10M DAU. State every assumption.
- **Hands-on:** Do three back-of-the-envelope estimates (a chat app, a video site, a URL shortener) on paper in under 5 minutes each.
- ✅ **Checkpoint:** Given any "design X for N million users" prompt, produce peak QPS, storage/year, and bandwidth in under 5 minutes, narrating your assumptions. This skill anchors every later week.

---

## Phase 2 · Building Blocks (Weeks 3–6)

The Lego bricks of system design. By the end of Week 6 you should be able to draw a scalable read-and-write path for almost anything.

### Week 3 — Spreading load and serving it fast
- **Read:** [05 · Load Balancing & Consistent Hashing](01-building-blocks/05-load-balancing.md), [06 · Caching](01-building-blocks/06-caching.md)
- **DDIA:** revisit Ch. 1's scalability section
- **Master these questions:**
  - Why does plain `hash(key) % N` fall apart when you add a node, and how does consistent hashing fix it? Why do you need virtual nodes?
  - Compare cache-aside vs write-through vs write-back. What is a cache stampede and how do you prevent it?
  - L4 vs L7 load balancing — what can an L7 LB do that an L4 can't?
- **Hands-on:** Implement consistent hashing (with virtual nodes) in ~100 lines and show that adding a node only remaps ~1/N of keys.
- ✅ **Checkpoint:** Explain why a naive cache + a popular key causes a "thundering herd," and give three independent mitigations.

### Week 4 — The database, deeply
- **Read:** [07 · Relational Databases](01-building-blocks/07-databases-relational.md), [08 · NoSQL & Data Models](01-building-blocks/08-databases-nosql.md)
- **DDIA:** Ch. 2 (Data Models), Ch. 7 (Transactions)
- **Master these questions:**
  - Map each isolation level to the anomalies it prevents (dirty read, non-repeatable read, phantom, write skew). Why is "snapshot isolation" *not* serializable?
  - When does an index *hurt* you? Explain the leftmost-prefix rule.
  - You have a highly relational dataset. Why might a document store be the *wrong* choice — and when is it right anyway?
- **Hands-on:** In Postgres, open two transactions and reproduce a lost update and a write skew. Then re-run under `SERIALIZABLE` and watch one abort.
- ✅ **Checkpoint:** Defend "start with a relational database" as a default, then describe the *specific* access pattern that would make you reach for Cassandra or DynamoDB instead.

### Week 5 — Making data survive and scale
- **Read:** [09 · Replication](01-building-blocks/09-replication.md), [10 · Partitioning & Sharding](01-building-blocks/10-partitioning-sharding.md)
- **DDIA:** Ch. 5 (Replication), Ch. 6 (Partitioning)
- **Master these questions:**
  - Single-leader vs multi-leader vs leaderless — who resolves write conflicts in each, and how?
  - Why does async replication mean you can lose acknowledged-ish writes on failover? What is split-brain?
  - Why does range-partitioning on a timestamp create a hotspot, and what do you do instead? How do you partition a secondary index?
- **Hands-on:** Stand up a primary + replica (Postgres or Redis), induce replication lag, then kill the primary and observe failover. Note exactly what data is at risk.
- ✅ **Checkpoint:** Pick a partition key for a ride-hailing trips table and justify it against the hot-spot, range-scan, and cross-shard-query trade-offs.

### Week 6 — Decoupling with messages + first synthesis
- **Read:** [11 · Message Queues & Stream Processing](01-building-blocks/11-messaging-and-streaming.md)
- **DDIA:** Ch. 11 (Stream Processing)
- **Master these questions:**
  - How is a log (Kafka) different from a queue (SQS/RabbitMQ), and when does that difference matter?
  - "Exactly-once" — what's actually guaranteed, and how is it really achieved? Why is ordering only per-partition?
  - When should two services talk via a queue instead of a synchronous call?
- **Hands-on / synthesis:** Combine Weeks 3–6 into one diagram: design the write-and-read path for a simple "post + view feed" service using a LB, cache, primary-replica DB, a shard key, and an async worker via a queue.
- ✅ **Mid-point checkpoint (big one):** Whiteboard, out loud and timed (30 min), a scalable backend for a simple social app — LB → stateless app tier → cache → sharded+replicated DB → async queue for fan-out. If you can do this fluently, the foundations have landed.

---

## Phase 3 · Distributed Systems Theory (Weeks 7–8)

This is the part most engineers never learn properly — and it's exactly what makes principal-level reasoning possible. Slow down here.

### Week 7 — Consistency and agreement
- **Read:** [12 · Consistency, CAP & PACELC](02-distributed-systems/12-consistency-and-cap.md), [13 · Consensus](02-distributed-systems/13-consensus.md)
- **DDIA:** Ch. 9 (Consistency and Consensus)
- **Master these questions:**
  - State CAP *correctly*. (Hint: it's only a forced choice **during a partition**.) What does PACELC add?
  - Define linearizability vs causal vs eventual consistency in one sentence each, from the client's point of view.
  - In Raft: how is a leader elected, how is a write committed, and why do you need a *majority* alive? Why can't 2 of 4 nodes commit?
- **Hands-on:** Read the Raft visualization (thesecretlivesofdata.com) and explain a leader election + a log replication step to a friend or rubber duck.
- ✅ **Checkpoint:** Correct someone who says *"CAP means pick two of three."* Explain what actually happens to a single-leader database during a network partition.

### Week 8 — Time, transactions, and failure
- **Read:** [14 · Time, Clocks & Ordering](02-distributed-systems/14-time-clocks-ordering.md), [15 · Distributed Transactions & Sagas](02-distributed-systems/15-distributed-transactions.md), [16 · Reliability & Designing for Failure](02-distributed-systems/16-reliability-and-failure.md)
- **DDIA:** Ch. 8 (Distributed Systems Trouble), finish Ch. 9
- **Master these questions:**
  - Why is using wall-clock timestamps to resolve write conflicts dangerous? What do Lamport vs vector clocks each tell you?
  - Why is 2PC avoided at scale, and how does a saga maintain correctness without distributed ACID? Why do sagas *not* give isolation?
  - What turns a retry into a retry storm, and how do backoff + jitter + idempotency + circuit breakers prevent a cascading failure?
- **Hands-on:** Compute the availability of a request that depends on 5 services each at 99.9%. Be surprised. Then redesign to improve it.
- ✅ **Checkpoint:** Explain why "exactly-once delivery" is a myth but "exactly-once processing" is achievable. Sketch the transactional outbox pattern from memory.

---

## Phase 4 · Architecture, APIs & Operability (Weeks 9–10)

### Week 9 — Structure and contracts
- **Read:** [17 · API Design](03-architecture-and-apis/17-api-design.md), [18 · Architectural Styles](03-architecture-and-apis/18-architectural-styles.md)
- **DDIA:** Ch. 4 (Encoding and Evolution)
- **Master these questions:**
  - When is a modular monolith the *right* answer over microservices? What is a "distributed monolith" and why is it the worst outcome?
  - Why is cursor/keyset pagination better than offset at scale? Why do non-idempotent writes need idempotency keys?
  - REST vs gRPC vs GraphQL — match each to a scenario where it's clearly the right tool.
- **Hands-on:** Take an existing REST endpoint you've built and redesign it for idempotent retries, cursor pagination, and forward/backward-compatible versioning.
- ✅ **Checkpoint:** Argue both sides of "should we split this monolith into microservices?" using Conway's Law and the distributed-systems tax.

### Week 10 — Operating it + the design method
- **Read:** [19 · Observability & SLOs](03-architecture-and-apis/19-observability.md), [20 · Security](03-architecture-and-apis/20-security.md), [21 · The System Design Framework](04-design-case-studies/21-interview-framework.md)
- **DDIA:** Ch. 1's maintainability section; SRE book Ch. 4 (SLOs)
- **Master these questions:**
  - Why do averages lie about latency? What do p99/p999 capture that p50 hides?
  - SLI vs SLO vs SLA — and how does an error budget drive release decisions?
  - AuthN vs AuthZ; why are unrevokable JWTs-as-sessions controversial; what is an IDOR?
- **Hands-on:** Internalize the 8-step design framework from writeup 21. Write it on an index card. You'll run it five times over the next two weeks.
- ✅ **Checkpoint:** Recite the full design framework (requirements → estimation → API → data model → high-level → deep-dive → bottlenecks → trade-offs) without looking.

---

## Phase 5 · Case Studies + Principal Skills (Weeks 11–12)

Now you *use* everything. **For each case study: attempt it cold (timer, no notes) BEFORE reading the writeup.** The cold struggle is the learning; reading first steals it.

### Week 11 — Case-study blitz I
- **Process for each:** 45-min cold attempt → read the writeup → note what you missed → one-paragraph "what I'd do differently."
- **Do these four:**
  - [22 · URL Shortener, Rate Limiter & Distributed ID](04-design-case-studies/22-url-shortener-rate-limiter-id-gen.md) — encoding, windowed counting, unique IDs
  - [23 · News Feed / Timeline](04-design-case-studies/23-news-feed-and-timeline.md) — the fan-out-on-write vs on-read trade-off + the celebrity problem
  - [24 · Chat & Notifications](04-design-case-studies/24-chat-and-notifications.md) — stateful connections, presence, delivery guarantees
  - [25 · Search & Geo](04-design-case-studies/25-search-and-geo.md) — tries, inverted indexes, spatial indexing (geohash/quadtree/S2)
- ✅ **Checkpoint:** Explain the feed fan-out hybrid and *why* pure push breaks for celebrities, without notes.

### Week 12 — Case-study blitz II + the meta-skills
- **Do these case studies (cold-first, same process):**
  - [26 · Object Store (S3) & KV Store (Dynamo)](04-design-case-studies/26-object-store-and-kv-store.md) — **the capstone**; it composes consistent hashing, quorums, replication, and conflict resolution into one design
  - [27 · Payment System & Ledger](04-design-case-studies/27-payments-and-ledgers.md) — correctness-critical design; idempotency and double-entry
  - [28 · Video Streaming & Web Crawler](04-design-case-studies/28-streaming-and-crawler.md) — CDN-centric delivery and polite distributed crawling
- **Read (the level-defining meta-skills):**
  - [29 · Trade-off Reasoning & ADRs](05-principal-skills/29-tradeoffs-and-adrs.md)
  - [30 · Evolutionary Architecture & Migrations](05-principal-skills/30-evolutionary-architecture.md)
  - [31 · The Reading List](05-principal-skills/31-reading-list-and-papers.md) — your map for what to study *after* this
- **Hands-on:** Write a real **ADR** for a decision in your day job (use the `engineering:architecture` skill if you have it). This is the artifact a principal produces.
- ✅ **Final checkpoint:** Design the Dynamo-style KV store end-to-end, out loud, in 45 minutes — and at each step name the building block (from Parts 1–2) you're applying and the trade-off you're making. If you can do this, you've hit the goal.

---

## After Week 12 — staying on the curve

Three months gets you fluency, not finality. Principal-level depth compounds for years. To keep climbing:

1. **Read the primary sources.** Work through the [reading list](05-principal-skills/31-reading-list-and-papers.md) — start with the Dynamo, Raft, and Google (GFS/MapReduce/Bigtable) papers, now that you have the scaffolding to understand them.
2. **Re-run the case studies monthly**, cold. Work through all 60+ prompts in the [Problem Bank](PROBLEM-BANK.md) and compare your designs with the [Worked Solutions](SOLUTIONS.md) (e.g. rate-limited API gateway, distributed scheduler, ad-click aggregator, stock trading exchange).
3. **Write ADRs at work.** Every non-trivial decision. This is the single highest-leverage habit for visible principal-level impact.
4. **Read your own systems' incidents.** Postmortems are distributed-systems theory with the names left in. Map each one back to a topic here.
5. **Teach it.** Explaining sharding or consensus to a teammate will expose the last gaps faster than any reread.

> Re-take the **Final Checkpoint** every couple of months with a *new* system. The day you can narrate any large-scale design with its trade-offs, numbers, and failure modes — unprompted and unhesitating — you're reasoning like a principal.

Now: [Week 1](#week-1--the-network-and-the-machine). Go.
