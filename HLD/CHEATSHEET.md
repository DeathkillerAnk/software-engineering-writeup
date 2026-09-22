# HLD Master Cheat Sheet

> The entire curriculum distilled to what you must recall under pressure. Skim this in 20 minutes; open a [writeup](README.md) only when a row feels fuzzy. Pair it with each chapter's **⚡ 60-Second TL;DR**.
>
> 🚀 **Fast-Track Revision:** For an interview-focused, single-sitting walkthrough (framework, estimation math, 8 full archetypes, and SDE 3 verbal coaching), see the **[1-Day System Design Crash Guide](../study-material/system-design-interview-guide.md)**.

---

## 1. Numbers to know cold

| Operation | Time | Mnemonic |
|---|---|---|
| L1 cache ref | ~1 ns | 1 |
| Branch mispredict | ~3 ns | |
| L2 cache ref | ~4 ns | |
| Mutex lock/unlock | ~17–25 ns | |
| Main memory ref | ~100 ns | 100× L1 |
| Read 1 MB sequentially from RAM | ~50 µs (20 GB/s) | |
| SSD random read (4 KB, NVMe) | ~16 µs | |
| Read 1 MB from NVMe SSD | ~0.3 ms | |
| Same-datacenter round trip | ~0.5 ms | |
| Read 1 MB from disk (HDD) | ~5–20 ms | |
| Disk seek (HDD) | ~10 ms | |
| Cross-US round trip | ~60–80 ms | speed-of-light floor ~40 ms |
| Cross-Atlantic round trip | ~60–90 ms | |

**Capacity math:** peak QPS ≈ `DAU × actions/user/day / 86,400 × peak-factor(2–10×)`. Storage = `objects × size × replication(3×) × growth-years`. 1 server ≈ 1k–10k QPS. 1 Postgres primary ≈ low-thousands writes/s. Always state assumptions; method > exact number. Use **bytes**, account for **3× replication** and index overhead.

---

## 2. The consistency / correctness core (the principal differentiator)

**Consistency ladder (strong→weak):** Linearizable (single-copy + real-time order) → Sequential (single order, no real-time) → Causal (cause before effect) → Read-your-writes / Monotonic (per-client) → Eventual (converges, no staleness bound).
- *Linearizability = single object, recency.* *Serializability = multi-object txn order.* **Not the same.**

**CAP — stated correctly:** during a **network partition** you must choose **C or A**; when healthy, CAP is silent (you get both). "Pick 2 of 3 always" is **wrong**. "CA system" is a category error (partitions aren't optional). **PACELC:** Else (no partition) you still trade **Latency vs Consistency**.

**Isolation levels → anomalies prevented:**

| Level | Stops | Still allows |
|---|---|---|
| Read Uncommitted | — | dirty reads |
| Read Committed *(PG default)* | dirty read | non-repeatable, phantom, lost update, write skew |
| Repeatable Read / Snapshot *(MySQL default)* | + non-repeatable read | **write skew**, phantoms (classic) |
| Serializable | everything | (cost: aborts / locks) |

> ⚠️ **Snapshot Isolation allows write skew** — the #1 isolation gotcha. MVCC ≠ no locks. Serializable ≠ the SQL default.

**Quorum:** with N replicas, **R + W > N ⇒ read & write sets intersect ⇒ strong-ish reads.** 3 nodes tolerate 1 failure, 5 tolerate 2. Majority = ⌊N/2⌋+1.

**Delivery semantics:** at-most-once (may lose) / at-least-once (may dup) / **"exactly-once" is a myth for delivery** — achieved as **at-least-once + idempotency/dedup** = exactly-once *processing*. Ordering only **within a partition**.

**Time:** wall clocks lie (skew/drift) — never resolve conflicts by timestamp (LWW loses writes). Lamport = total order, can't detect concurrency. **Vector clocks** = detect causal vs concurrent. Spanner TrueTime = bounded uncertainty + commit-wait → external consistency.

**Consensus (Raft):** elect leader (terms, randomized timeouts, majority vote) → replicate log → commit when on a **majority**. Needs majority alive. Tolerates crashes, **not** Byzantine. FLP: no async deterministic consensus → sidestep with timeouts/randomization. Consensus ≠ 2PC; consensus ≠ two-generals.

---

## 3. Building blocks — when to use what

| Block | Default / rule of thumb | Watch out for |
|---|---|---|
| **Load balancing** | L7 for HTTP routing; **consistent hashing + vnodes** for sharded state; **power-of-2-choices** ≈ least-conn w/o global state | mod-N reshuffles everything; sticky sessions kill scale |
| **Caching** | cache-aside is the default | stampede → **single-flight + jitter**; invalidation is hard; write-back loses data |
| **Relational DB** | the right **default**; ACID, joins, flexible queries | index hurts writes; leftmost-prefix; SERIALIZABLE not default |
| **NoSQL** | pick when access pattern is known + scale > flexibility | model per-query; joins move to app; tune R/W/N |
| **Replication** | single-leader default; async = read scale + risk | async failover **loses acked writes**; split-brain; replicas lag |
| **Partitioning** | hash for even spread; range for scans | **range on timestamp = hotspot**; pick high-cardinality key; cross-shard joins costly |
| **Messaging** | queue = compete+delete; **log (Kafka)** = retain+replay+groups | order per-partition only; need DLQ; consumer lag |

**Storage engines:** **B-tree** = read-optimized, in-place (OLTP, Postgres/Innodb, *DynamoDB*). **LSM-tree** = write-optimized, append+compact (Cassandra/RocksDB) — pays read + compaction (write) amplification; **Bloom filter** skips absent keys (no false negatives). Column store = OLAP scans.

---

## 4. Architecture & APIs

- **Monolith (modular) is the right default.** Microservices buy independent deploy/scale/ownership at a **distributed-systems tax**. Avoid the **distributed monolith** (shared DB, sync call chains). **Conway's Law** is real.
- **DB-per-service**; integrate via events. **Outbox + CDC** solves the dual-write problem. **CQRS/event-sourcing** only when read/write models genuinely diverge (costs: eventual consistency, event versioning, replay).
- **APIs:** REST (resources), **gRPC** (internal, binary, streaming), GraphQL (client-shaped, needs cost limits). **Cursor/keyset pagination > offset** at scale. Non-idempotent writes need **idempotency keys**. Version from day one.
- **Observability:** metrics + logs + traces. **Percentiles (p99/p999), never averages.** SLI (measure) → SLO (target, internal, stricter) → SLA (contract, penalties). **Error budget** gates releases. Alert on **symptoms**, not causes. Watch **cardinality**.
- **Security:** AuthN ≠ AuthZ. Don't put unrevokable sessions in JWTs. Never roll your own crypto. Least privilege / zero-trust. Guard against IDOR (authz on every object), SSRF, injection. Secrets in a vault, never git. PII: encrypt at rest + tokenize.

---

## 5. Reliability — assume everything fails

- **Timeouts on everything** (no timeout = thread/conn exhaustion). **Retries need backoff + jitter** (else retry storm). **Retries require idempotency.**
- **Circuit breaker** (closed→open→half-open) shields a failing downstream. **Bulkheads, load shedding, backpressure.** Graceful degradation > collapse.
- **Availability composes badly:** a chain of five 99.9% deps ≈ 99.5%. Redundancy in **parallel** raises it. Beware **correlated failures & metastable states** (the outage that sustains itself).
- **Distributed txns:** avoid 2PC (coordinator crash blocks holders). **Sagas** = local txns + compensations, **no isolation** (intermediate state visible). For money: append-only **double-entry ledger**, **integer minor units** (never floats), **idempotency key** per charge.

---

## 6. The design framework (use every time)

1. **Clarify** functional + non-functional reqs, scope, scale. 2. **Estimate** (QPS/storage/bandwidth). 3. **API**. 4. **Data model**. 5. **High-level** boxes. 6. **Deep-dive** the 1–2 hardest parts. 7. **Bottlenecks** → scale them. 8. **Trade-offs / failure modes / what next.**
> Junior: one design stated as fact. **Principal: options driven by the requirements, with explicit trade-offs and failure handling.**

---

## 7. Case-study patterns (the reusable moves)

| Problem | Key pattern |
|---|---|
| URL shortener | counter+base62 / hash; read-heavy cache; 301 vs 302 |
| Rate limiter | **token bucket** (allows burst) vs sliding window (fixes fixed-window 2× boundary burst); Redis + atomic/Lua |
| Unique IDs | **Snowflake** (time|machine|seq); UUIDv7/ULID; *not* UUIDv4 as clustered PK |
| News feed | **fan-out-on-write** (push) vs **on-read** (pull); **hybrid** — pull for celebrities |
| Chat | WS gateways + presence/routing registry; at-least-once + dedup; offline push |
| Search/typeahead | trie + precomputed top-K; inverted index |
| Geo / nearby | **spatial index** (geohash / quadtree / S2 / H3) — not raw lat/long range |
| Object store (S3) | data plane vs metadata plane; **erasure coding** for cold durability |
| KV store (Dynamo) | consistent hashing + quorum (R/W/N) + version vectors + read-repair + Merkle anti-entropy |
| Payments | double-entry ledger + idempotency + reconciliation; saga for multi-step |
| Video | CDN-centric; async transcode; **adaptive bitrate** (HLS/DASH) |
| Crawler | URL frontier + **politeness** (per-domain) + bloom dedup + robots.txt |

---

## 8. Principal meta-skills

- **"It depends" → make the dependency explicit.** Drive every decision from a **requirement/constraint**, not hype (no resume-driven design).
- **One-way vs two-way doors:** spend rigor on irreversible decisions; move fast on reversible ones.
- **Write ADRs** (context, decision, alternatives, consequences) — decisions get relitigated forever without them.
- **Most work is changing a running system:** **expand/contract (parallel change)**, dual-write+backfill, **Strangler Fig**, canary/blue-green with a **rollback plan**. Big-bang rewrites fail.
- **Read the primary sources:** DDIA (the spine), then Dynamo / Raft / GFS-MapReduce-Bigtable / Spanner papers.

---
*Fuzzy on any line? Jump to the chapter via the [README](README.md). Then test yourself with the chapter's Self-Check — recall beats re-reading.*
