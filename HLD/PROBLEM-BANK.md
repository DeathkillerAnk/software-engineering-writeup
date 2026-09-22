# System Design Interview Problem Bank & Coverage Guide

> **Goal:** Master the major system design interview patterns through deliberate practice, not by memorizing one-off answers.
>
> **Quick Links:** [HLD Curriculum Index](README.md) · [12-Week Roadmap](ROADMAP.md) · [Master Cheat Sheet](CHEATSHEET.md) · [Last-Minute Crash Course](CRASHCOURSE.md) · [Worked Solutions](SOLUTIONS.md)

---

## How to Study & Practice

1. **Learn the method first.** Read [The System Design Framework](04-design-case-studies/21-interview-framework.md), then apply the exact same 8-step structure to every problem: requirements, capacity estimation, API, data model & shard key, architecture, component deep dive, bottlenecks, trade-offs & failure modes.
2. **Practice by pattern.** Do not solve ten social apps in a row. Rotate across read-heavy, write-heavy, real-time, streaming, storage, search, geo, correctness-critical, and platform systems.
3. **Attempt cold before reading.** For every prompt, spend 35–45 minutes designing out loud with a timer before checking the [Solutions Guide](SOLUTIONS.md). The cold attempt is where real learning happens.
4. **Track the reusable decision.** After each problem, write down the central trade-off: push vs pull, SQL vs NoSQL, cache invalidation strategy, shard key selection, delivery guarantees, consistency model, or failure blast radius.
5. **Redo hard prompts.** Re-attempt important systems one week later from a blank page to test true recall.

---

## Core Building Blocks to Master

| Area | You should be able to explain | Relevant HLD Chapter |
|---|---|---|
| Networking | DNS, TCP/TLS, HTTP/2 vs HTTP/3, gRPC, WebSockets, CDN, latency budgets | [01 · Networking](00-foundations/01-networking.md) |
| Estimation | DAU to QPS, peak factor, storage/year, bandwidth, server sizing | [04 · Capacity Estimation](00-foundations/04-capacity-estimation.md) |
| Load balancing | L4 vs L7, health checks, consistent hashing, hot keys | [05 · Load Balancing](01-building-blocks/05-load-balancing.md) |
| Caching | Cache-aside, write-through, write-back, TTLs, stampede prevention | [06 · Caching](01-building-blocks/06-caching.md) |
| Relational DBs | B-trees, indexes, isolation levels, transactions, schema design | [07 · Relational Databases](01-building-blocks/07-databases-relational.md) |
| NoSQL & Stores | LSM-trees, document vs wide-column vs KV, polyglot persistence | [08 · NoSQL](01-building-blocks/08-databases-nosql.md) |
| Replication | Leader-follower, multi-leader, leaderless, failover, replication lag | [09 · Replication](01-building-blocks/09-replication.md) |
| Sharding | Partition keys, rebalancing, secondary indexes, hot partitions | [10 · Partitioning & Sharding](01-building-blocks/10-partitioning-sharding.md) |
| Messaging | Queues vs logs, Kafka/SQS, ordering, retries, DLQs, outbox pattern | [11 · Messaging & Streaming](01-building-blocks/11-messaging-and-streaming.md) |
| Consistency | Strong, eventual, read-your-writes, causal, CAP, PACELC | [12 · Consistency & CAP](02-distributed-systems/12-consistency-and-cap.md) |
| Consensus | Paxos, Raft, leader election, split-brain prevention | [13 · Consensus](02-distributed-systems/13-consensus.md) |
| Transactions | 2PC, Sagas, idempotency keys, dual-write mitigation | [15 · Distributed Transactions](02-distributed-systems/15-distributed-transactions.md) |
| Reliability | Timeouts, retries, backoff, jitter, circuit breakers, degradation | [16 · Reliability & Failure](02-distributed-systems/16-reliability-and-failure.md) |
| Observability | SLIs, SLOs, metrics, structured logs, distributed tracing, alerting | [19 · Observability](03-architecture-and-apis/19-observability.md) |
| Security | AuthN/AuthZ, rate limits, abuse prevention, secrets, JWT caveats | [20 · Security](03-architecture-and-apis/20-security.md) |

---

## Weekly Practice Plan

| Week | Focus | Target Output |
|---|---|---|
| 1 | Framework, estimation, APIs, data modeling | 3 starter problems |
| 2 | Caching, load balancing, sharding | 4 read-heavy systems |
| 3 | Messaging, fan-out, real-time delivery | 4 social/real-time systems |
| 4 | Search, geo, media, CDN | 4 specialized systems |
| 5 | Correctness, idempotency, transactions | 4 payments/booking systems |
| 6 | Infrastructure and data platforms | 4 storage/streaming/platform systems |
| 7+ | Mock interviews | 2 timed mocks/week, redo missed prompts |

---

## What "Covered" Means

A problem is covered only when you can do all of this without notes:

- Clarify functional and non-functional requirements.
- Estimate QPS, storage, and bandwidth with justifiable assumptions.
- Define a minimal API and core data model.
- Pick a partition/shard key and defend it.
- Trace the end-to-end read and write paths.
- Deep-dive the 1–2 hardest components.
- Explain consistency, availability, latency, and cost trade-offs.
- Describe failure modes and explain how the system gracefully degrades.

---

## Problem Checklist

*Reference solutions, architectural cheat sheets, and deep dives for all problems are in **[SOLUTIONS.md](SOLUTIONS.md)**.*

### 1. Starter classics

| Done | Problem | Main concepts to cover | Related HLD Chapter |
|---|---|---|---|
| [ ] | URL shortener | key generation, redirect latency, analytics, cache, abuse prevention | [case study](04-design-case-studies/22-url-shortener-rate-limiter-id-gen.md) |
| [ ] | Pastebin / code sharing | TTL, privacy, large text storage, dedupe, CDN | [object store](04-design-case-studies/26-object-store-and-kv-store.md) |
| [ ] | Distributed ID generator | Snowflake-style IDs, clock drift, ordering, uniqueness | [case study](04-design-case-studies/22-url-shortener-rate-limiter-id-gen.md) |
| [ ] | Rate limiter | token bucket, leaky bucket, fixed/sliding windows, distributed counters | [case study](04-design-case-studies/22-url-shortener-rate-limiter-id-gen.md) |
| [ ] | Tiny analytics for URL clicks | async ingestion, aggregation, approximate counts, hot keys | [messaging](01-building-blocks/11-messaging-and-streaming.md) |

### 2. Social and feed systems

| Done | Problem | Main concepts to cover | Related HLD Chapter |
|---|---|---|---|
| [ ] | Twitter/X timeline | fan-out-on-write vs fan-out-on-read, celebrity problem, ranking | [news feed](04-design-case-studies/23-news-feed-and-timeline.md) |
| [ ] | Facebook news feed | graph edges, privacy filtering, ranking, cache invalidation | [news feed](04-design-case-studies/23-news-feed-and-timeline.md) |
| [ ] | Instagram feed | media metadata, CDN, feed ranking, write amplification | [news feed](04-design-case-studies/23-news-feed-and-timeline.md) |
| [ ] | Reddit / Hacker News | posts, comments, votes, hot ranking, moderation | [databases](01-building-blocks/07-databases-relational.md) |
| [ ] | Comment system | tree model, pagination, moderation, spam, consistency | [API design](03-architecture-and-apis/17-api-design.md) |
| [ ] | Like/reaction system | counters, idempotency, eventual consistency, hot posts | [caching](01-building-blocks/06-caching.md) |
| [ ] | Follow graph | graph storage, fan-out trigger, privacy, high-degree nodes | [partitioning](01-building-blocks/10-partitioning-sharding.md) |

### 3. Real-time communication

| Done | Problem | Main concepts to cover | Related HLD Chapter |
|---|---|---|---|
| [ ] | 1:1 chat | WebSockets, message ordering, delivery receipts, offline sync | [chat](04-design-case-studies/24-chat-and-notifications.md) |
| [ ] | Group chat | fan-out, per-room ordering, membership, history pagination | [chat](04-design-case-studies/24-chat-and-notifications.md) |
| [ ] | Notification system | push/email/SMS channels, preferences, retries, DLQ | [chat](04-design-case-studies/24-chat-and-notifications.md) |
| [ ] | Presence service | heartbeats, TTL, eventual correctness, regional routing | [reliability](02-distributed-systems/16-reliability-and-failure.md) |
| [ ] | Collaborative document editor | operational transform/CRDTs, conflict resolution, snapshots | [consistency](02-distributed-systems/12-consistency-and-cap.md) |
| [ ] | Live comments / live scores | pub-sub, fan-out, backpressure, mobile reconnects | [messaging](01-building-blocks/11-messaging-and-streaming.md) |

### 4. Media and content delivery

| Done | Problem | Main concepts to cover | Related HLD Chapter |
|---|---|---|---|
| [ ] | Image upload service | multipart upload, metadata DB, object storage, CDN | [object store](04-design-case-studies/26-object-store-and-kv-store.md) |
| [ ] | YouTube / video platform | upload, transcoding, thumbnails, CDN, recommendations | [video streaming](04-design-case-studies/28-streaming-and-crawler.md) |
| [ ] | Netflix-style streaming | adaptive bitrate, CDN placement, catalog metadata | [video streaming](04-design-case-studies/28-streaming-and-crawler.md) |
| [ ] | File sharing service | permissions, links, versioning, virus scanning, quota | [object store](04-design-case-studies/26-object-store-and-kv-store.md) |
| [ ] | Dropbox / file sync | change log, conflict resolution, chunking, dedupe | [replication](01-building-blocks/09-replication.md) |

### 5. Search, discovery, and recommendation

| Done | Problem | Main concepts to cover | Related HLD Chapter |
|---|---|---|---|
| [ ] | Typeahead / autocomplete | trie/FST, prefix index, ranking, cache | [search](04-design-case-studies/25-search-and-geo.md) |
| [ ] | Search engine | crawler, inverted index, ranking, freshness | [crawler](04-design-case-studies/28-streaming-and-crawler.md) |
| [ ] | Product search | filters, facets, denormalized index, relevance | [search](04-design-case-studies/25-search-and-geo.md) |
| [ ] | Recommendation feed | offline features, online ranking, exploration, feedback loop | [streaming](01-building-blocks/11-messaging-and-streaming.md) |
| [ ] | Trending topics | stream aggregation, time windows, approximate heavy hitters | [messaging](01-building-blocks/11-messaging-and-streaming.md) |

### 6. Geo and location systems

| Done | Problem | Main concepts to cover | Related HLD Chapter |
|---|---|---|---|
| [ ] | Nearby restaurants | geohash/S2/quadtree, filtering, ranking, cache | [geo](04-design-case-studies/25-search-and-geo.md) |
| [ ] | Uber nearby drivers | location updates, spatial index, matching, stale locations | [geo](04-design-case-studies/25-search-and-geo.md) |
| [ ] | Food delivery tracking | streaming location updates, fan-out, mobile battery trade-offs | [messaging](01-building-blocks/11-messaging-and-streaming.md) |
| [ ] | Maps route service | graph search, caching, precomputation, live traffic | [capacity](00-foundations/04-capacity-estimation.md) |
| [ ] | Geofencing alerts | spatial partitions, event detection, false positives | [partitioning](01-building-blocks/10-partitioning-sharding.md) |

### 7. Correctness-critical systems

| Done | Problem | Main concepts to cover | Related HLD Chapter |
|---|---|---|---|
| [ ] | Payment processing | idempotency, retries, external PSPs, reconciliation | [payments](04-design-case-studies/27-payments-and-ledgers.md) |
| [ ] | Wallet | ledger, double-entry accounting, holds, consistency | [payments](04-design-case-studies/27-payments-and-ledgers.md) |
| [ ] | Stock trading order system | ordering, matching engine, audit log, latency | [transactions](02-distributed-systems/15-distributed-transactions.md) |
| [ ] | Ticket booking | inventory locks, expiration, oversell prevention | [transactions](02-distributed-systems/15-distributed-transactions.md) |
| [ ] | Hotel reservation | availability, holds, cancellation, eventual inventory sync | [transactions](02-distributed-systems/15-distributed-transactions.md) |
| [ ] | E-commerce checkout | carts, inventory, payment, saga, outbox | [transactions](02-distributed-systems/15-distributed-transactions.md) |
| [ ] | Coupon/promo system | eligibility, race conditions, limits, abuse prevention | [relational DB](01-building-blocks/07-databases-relational.md) |

### 8. Storage and infrastructure systems

| Done | Problem | Main concepts to cover | Related HLD Chapter |
|---|---|---|---|
| [ ] | Key-value store | consistent hashing, replication, quorum, conflict resolution | [KV store](04-design-case-studies/26-object-store-and-kv-store.md) |
| [ ] | Object store like S3 | chunking, metadata, durability, erasure coding, listing | [object store](04-design-case-studies/26-object-store-and-kv-store.md) |
| [ ] | Distributed cache | eviction, replication, consistent hashing, stampede | [caching](01-building-blocks/06-caching.md) |
| [ ] | CDN | edge caching, invalidation, origin shielding, geo routing | [video streaming](04-design-case-studies/28-streaming-and-crawler.md) |
| [ ] | API gateway | routing, auth, rate limits, observability, retries | [API design](03-architecture-and-apis/17-api-design.md) |
| [ ] | Feature flag service | low-latency reads, targeting rules, config propagation | [consistency](02-distributed-systems/12-consistency-and-cap.md) |
| [ ] | Distributed lock service | leases, fencing tokens, failure modes, consensus | [consensus](02-distributed-systems/13-consensus.md) |
| [ ] | Configuration service | watches, versioning, rollout, consistency | [consensus](02-distributed-systems/13-consensus.md) |

### 9. Data, logging, and analytics systems

| Done | Problem | Main concepts to cover | Related HLD Chapter |
|---|---|---|---|
| [ ] | Logging pipeline | ingestion, buffering, indexing, retention, sampling | [messaging](01-building-blocks/11-messaging-and-streaming.md) |
| [ ] | Metrics/monitoring system | time-series storage, rollups, cardinality, alerting | [observability](03-architecture-and-apis/19-observability.md) |
| [ ] | Ad click aggregator | stream processing, dedupe, attribution windows, fraud | [messaging](01-building-blocks/11-messaging-and-streaming.md) |
| [ ] | Real-time dashboard | streaming aggregation, freshness, backpressure | [messaging](01-building-blocks/11-messaging-and-streaming.md) |
| [ ] | Data warehouse ingestion | batch vs stream, schema evolution, replay, exactly-once processing | [messaging](01-building-blocks/11-messaging-and-streaming.md) |
| [ ] | Web crawler | frontier, politeness, dedupe, indexing pipeline | [crawler](04-design-case-studies/28-streaming-and-crawler.md) |

### 10. Platform and scheduling systems

| Done | Problem | Main concepts to cover | Related HLD Chapter |
|---|---|---|---|
| [ ] | Job scheduler | leases, retries, priority queues, idempotent jobs | [reliability](02-distributed-systems/16-reliability-and-failure.md) |
| [ ] | Cron service | distributed scheduling, leader election, missed runs | [consensus](02-distributed-systems/13-consensus.md) |
| [ ] | Task queue | visibility timeout, retries, DLQ, ordering | [messaging](01-building-blocks/11-messaging-and-streaming.md) |
| [ ] | CI/CD pipeline | workflow graph, workers, artifacts, logs, isolation | [architecture](03-architecture-and-apis/18-architectural-styles.md) |
| [ ] | Code hosting service | repos, permissions, Git storage, pull requests, search | [storage engines](00-foundations/03-storage-engines.md) |
| [ ] | Multi-tenant SaaS platform | tenant isolation, noisy neighbors, quotas, migrations | [evolutionary architecture](05-principal-skills/30-evolutionary-architecture.md) |

---

## Practice Rotation Strategy

Do one prompt from each group before repeating a group. This prevents over-indexing on social feed designs and builds robust, multi-domain judgment across the exact patterns interviewers test.
