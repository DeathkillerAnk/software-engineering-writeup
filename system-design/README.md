# System Design Interview Coverage Roadmap

> Goal: cover the major system design interview patterns, not memorize one-off answers.

System design interviews repeat the same building blocks under different product names. A strong answer comes from deriving the design from requirements, scale, data access patterns, bottlenecks, and trade-offs.

Use the existing [HLD curriculum](../HLD/README.md) for deep theory and this folder as your interview problem tracker.

## How to study

1. **Learn the method first.** Read [The System Design Framework](../HLD/04-design-case-studies/21-interview-framework.md), then use the same structure for every problem: requirements, estimation, API, data model, architecture, deep dives, bottlenecks, trade-offs.
2. **Practice by pattern.** Do not solve ten social apps in a row. Rotate across read-heavy, write-heavy, real-time, streaming, storage, search, geo, correctness-critical, and ML/data systems.
3. **Attempt cold before reading.** For every prompt, spend 35-45 minutes designing out loud before checking notes.
4. **Track the reusable decision.** After each problem, write down the main trade-off: push vs pull, SQL vs NoSQL, cache invalidation, shard key, delivery guarantee, consistency model, or failure mode.
5. **Redo hard prompts.** Re-attempt important systems one week later from a blank page.

## Core building blocks to master

| Area | You should be able to explain |
|---|---|
| Networking | DNS, TCP/TLS, HTTP, gRPC, WebSockets, CDN, latency budgets |
| Estimation | DAU to QPS, peak factor, storage/year, bandwidth, machine count |
| Load balancing | L4 vs L7, health checks, consistent hashing, hot keys |
| Caching | Cache-aside, write-through, write-back, TTLs, stampede prevention |
| Databases | SQL vs NoSQL, indexes, isolation, transactions, schema design |
| Replication | Leader-follower, multi-leader, leaderless, failover, lag |
| Sharding | Partition keys, rebalancing, secondary indexes, hot partitions |
| Messaging | Queues vs logs, Kafka/SQS/RabbitMQ, ordering, retries, DLQs |
| Consistency | Strong, eventual, read-your-writes, causal, CAP, PACELC |
| Reliability | Timeouts, retries, backoff, jitter, circuit breakers, idempotency |
| Observability | SLIs, SLOs, metrics, logs, traces, alerting |
| Security | AuthN/AuthZ, rate limits, abuse prevention, secrets, data privacy |

## Interview problem categories

| Category | Representative prompts |
|---|---|
| Starter classics | URL shortener, pastebin, distributed ID generator, rate limiter |
| Social/read-heavy | news feed, Twitter/X timeline, Instagram, comments, likes |
| Real-time | chat, notifications, presence, collaborative editor, live comments |
| Media | image upload, video streaming, YouTube, CDN, transcoding pipeline |
| Search/discovery | typeahead, search engine, autocomplete, recommendation feed |
| Geo/location | nearby drivers, maps search, delivery tracking, geofencing |
| Storage/infrastructure | object store, key-value store, file sync, distributed cache |
| Data/streaming | metrics pipeline, logging system, ad click aggregation, analytics |
| Correctness-critical | payments, wallet, ledger, booking, inventory, ticketing |
| Platform systems | API gateway, job scheduler, feature flags, configuration service |

The full checklist is in [PROBLEM-BANK.md](PROBLEM-BANK.md).

## Weekly practice plan

| Week | Focus | Output |
|---|---|---|
| 1 | Framework, estimation, APIs, data modeling | 3 starter problems |
| 2 | Caching, load balancing, sharding | 4 read-heavy systems |
| 3 | Messaging, fan-out, real-time delivery | 4 social/real-time systems |
| 4 | Search, geo, media, CDN | 4 specialized systems |
| 5 | Correctness, idempotency, transactions | 4 payments/booking systems |
| 6 | Infrastructure and data platforms | 4 storage/streaming/platform systems |
| 7+ | Mock interviews | 2 timed mocks/week, redo missed prompts |

## What "covered" means

A problem is covered only when you can do all of this without notes:

- Clarify functional and non-functional requirements.
- Estimate QPS, storage, and bandwidth.
- Define a minimal API and core data model.
- Pick a shard key and justify it.
- Draw a complete read/write path.
- Deep-dive the hardest component.
- Explain consistency, availability, latency, and cost trade-offs.
- Describe failure modes and how the system degrades.

