# System Design Interview Problem Bank

Use this as a checklist. For each prompt, design it cold in 35-45 minutes, then write the key trade-offs you missed.

## 1. Starter classics

| Done | Problem | Main concepts to cover | Related HLD |
|---|---|---|---|
| [ ] | URL shortener | key generation, redirect latency, analytics, cache, abuse prevention | [case study](../HLD/04-design-case-studies/22-url-shortener-rate-limiter-id-gen.md) |
| [ ] | Pastebin / code sharing | TTL, privacy, large text storage, dedupe, CDN | [object store](../HLD/04-design-case-studies/26-object-store-and-kv-store.md) |
| [ ] | Distributed ID generator | Snowflake-style IDs, clock drift, ordering, uniqueness | [case study](../HLD/04-design-case-studies/22-url-shortener-rate-limiter-id-gen.md) |
| [ ] | Rate limiter | token bucket, leaky bucket, fixed/sliding windows, distributed counters | [case study](../HLD/04-design-case-studies/22-url-shortener-rate-limiter-id-gen.md) |
| [ ] | Tiny analytics for URL clicks | async ingestion, aggregation, approximate counts, hot keys | [messaging](../HLD/01-building-blocks/11-messaging-and-streaming.md) |

## 2. Social and feed systems

| Done | Problem | Main concepts to cover | Related HLD |
|---|---|---|---|
| [ ] | Twitter/X timeline | fan-out-on-write vs fan-out-on-read, celebrity problem, ranking | [news feed](../HLD/04-design-case-studies/23-news-feed-and-timeline.md) |
| [ ] | Facebook news feed | graph edges, privacy filtering, ranking, cache invalidation | [news feed](../HLD/04-design-case-studies/23-news-feed-and-timeline.md) |
| [ ] | Instagram feed | media metadata, CDN, feed ranking, write amplification | [news feed](../HLD/04-design-case-studies/23-news-feed-and-timeline.md) |
| [ ] | Reddit / Hacker News | posts, comments, votes, hot ranking, moderation | [databases](../HLD/01-building-blocks/07-databases-relational.md) |
| [ ] | Comment system | tree model, pagination, moderation, spam, consistency | [API design](../HLD/03-architecture-and-apis/17-api-design.md) |
| [ ] | Like/reaction system | counters, idempotency, eventual consistency, hot posts | [caching](../HLD/01-building-blocks/06-caching.md) |
| [ ] | Follow graph | graph storage, fan-out trigger, privacy, high-degree nodes | [partitioning](../HLD/01-building-blocks/10-partitioning-sharding.md) |

## 3. Real-time communication

| Done | Problem | Main concepts to cover | Related HLD |
|---|---|---|---|
| [ ] | 1:1 chat | WebSockets, message ordering, delivery receipts, offline sync | [chat](../HLD/04-design-case-studies/24-chat-and-notifications.md) |
| [ ] | Group chat | fan-out, per-room ordering, membership, history pagination | [chat](../HLD/04-design-case-studies/24-chat-and-notifications.md) |
| [ ] | Notification system | push/email/SMS channels, preferences, retries, DLQ | [chat](../HLD/04-design-case-studies/24-chat-and-notifications.md) |
| [ ] | Presence service | heartbeats, TTL, eventual correctness, regional routing | [reliability](../HLD/02-distributed-systems/16-reliability-and-failure.md) |
| [ ] | Collaborative document editor | operational transform/CRDTs, conflict resolution, snapshots | [consistency](../HLD/02-distributed-systems/12-consistency-and-cap.md) |
| [ ] | Live comments / live scores | pub-sub, fan-out, backpressure, mobile reconnects | [messaging](../HLD/01-building-blocks/11-messaging-and-streaming.md) |

## 4. Media and content delivery

| Done | Problem | Main concepts to cover | Related HLD |
|---|---|---|---|
| [ ] | Image upload service | multipart upload, metadata DB, object storage, CDN | [object store](../HLD/04-design-case-studies/26-object-store-and-kv-store.md) |
| [ ] | YouTube / video platform | upload, transcoding, thumbnails, CDN, recommendations | [video streaming](../HLD/04-design-case-studies/28-streaming-and-crawler.md) |
| [ ] | Netflix-style streaming | adaptive bitrate, CDN placement, catalog metadata | [video streaming](../HLD/04-design-case-studies/28-streaming-and-crawler.md) |
| [ ] | File sharing service | permissions, links, versioning, virus scanning, quota | [object store](../HLD/04-design-case-studies/26-object-store-and-kv-store.md) |
| [ ] | Dropbox / file sync | change log, conflict resolution, chunking, dedupe | [replication](../HLD/01-building-blocks/09-replication.md) |

## 5. Search, discovery, and recommendation

| Done | Problem | Main concepts to cover | Related HLD |
|---|---|---|---|
| [ ] | Typeahead / autocomplete | trie/FST, prefix index, ranking, cache | [search](../HLD/04-design-case-studies/25-search-and-geo.md) |
| [ ] | Search engine | crawler, inverted index, ranking, freshness | [crawler](../HLD/04-design-case-studies/28-streaming-and-crawler.md) |
| [ ] | Product search | filters, facets, denormalized index, relevance | [search](../HLD/04-design-case-studies/25-search-and-geo.md) |
| [ ] | Recommendation feed | offline features, online ranking, exploration, feedback loop | [streaming](../HLD/01-building-blocks/11-messaging-and-streaming.md) |
| [ ] | Trending topics | stream aggregation, time windows, approximate heavy hitters | [messaging](../HLD/01-building-blocks/11-messaging-and-streaming.md) |

## 6. Geo and location systems

| Done | Problem | Main concepts to cover | Related HLD |
|---|---|---|---|
| [ ] | Nearby restaurants | geohash/S2/quadtree, filtering, ranking, cache | [geo](../HLD/04-design-case-studies/25-search-and-geo.md) |
| [ ] | Uber nearby drivers | location updates, spatial index, matching, stale locations | [geo](../HLD/04-design-case-studies/25-search-and-geo.md) |
| [ ] | Food delivery tracking | streaming location updates, fan-out, mobile battery trade-offs | [messaging](../HLD/01-building-blocks/11-messaging-and-streaming.md) |
| [ ] | Maps route service | graph search, caching, precomputation, live traffic | [capacity](../HLD/00-foundations/04-capacity-estimation.md) |
| [ ] | Geofencing alerts | spatial partitions, event detection, false positives | [partitioning](../HLD/01-building-blocks/10-partitioning-sharding.md) |

## 7. Correctness-critical systems

| Done | Problem | Main concepts to cover | Related HLD |
|---|---|---|---|
| [ ] | Payment processing | idempotency, retries, external PSPs, reconciliation | [payments](../HLD/04-design-case-studies/27-payments-and-ledgers.md) |
| [ ] | Wallet | ledger, double-entry accounting, holds, consistency | [payments](../HLD/04-design-case-studies/27-payments-and-ledgers.md) |
| [ ] | Stock trading order system | ordering, matching engine, audit log, latency | [transactions](../HLD/02-distributed-systems/15-distributed-transactions.md) |
| [ ] | Ticket booking | inventory locks, expiration, oversell prevention | [transactions](../HLD/02-distributed-systems/15-distributed-transactions.md) |
| [ ] | Hotel reservation | availability, holds, cancellation, eventual inventory sync | [transactions](../HLD/02-distributed-systems/15-distributed-transactions.md) |
| [ ] | E-commerce checkout | carts, inventory, payment, saga, outbox | [transactions](../HLD/02-distributed-systems/15-distributed-transactions.md) |
| [ ] | Coupon/promo system | eligibility, race conditions, limits, abuse prevention | [relational DB](../HLD/01-building-blocks/07-databases-relational.md) |

## 8. Storage and infrastructure systems

| Done | Problem | Main concepts to cover | Related HLD |
|---|---|---|---|
| [ ] | Key-value store | consistent hashing, replication, quorum, conflict resolution | [KV store](../HLD/04-design-case-studies/26-object-store-and-kv-store.md) |
| [ ] | Object store like S3 | chunking, metadata, durability, erasure coding, listing | [object store](../HLD/04-design-case-studies/26-object-store-and-kv-store.md) |
| [ ] | Distributed cache | eviction, replication, consistent hashing, stampede | [caching](../HLD/01-building-blocks/06-caching.md) |
| [ ] | CDN | edge caching, invalidation, origin shielding, geo routing | [video streaming](../HLD/04-design-case-studies/28-streaming-and-crawler.md) |
| [ ] | API gateway | routing, auth, rate limits, observability, retries | [API design](../HLD/03-architecture-and-apis/17-api-design.md) |
| [ ] | Feature flag service | low-latency reads, targeting rules, config propagation | [consistency](../HLD/02-distributed-systems/12-consistency-and-cap.md) |
| [ ] | Distributed lock service | leases, fencing tokens, failure modes, consensus | [consensus](../HLD/02-distributed-systems/13-consensus.md) |
| [ ] | Configuration service | watches, versioning, rollout, consistency | [consensus](../HLD/02-distributed-systems/13-consensus.md) |

## 9. Data, logging, and analytics systems

| Done | Problem | Main concepts to cover | Related HLD |
|---|---|---|---|
| [ ] | Logging pipeline | ingestion, buffering, indexing, retention, sampling | [messaging](../HLD/01-building-blocks/11-messaging-and-streaming.md) |
| [ ] | Metrics/monitoring system | time-series storage, rollups, cardinality, alerting | [observability](../HLD/03-architecture-and-apis/19-observability.md) |
| [ ] | Ad click aggregator | stream processing, dedupe, attribution windows, fraud | [messaging](../HLD/01-building-blocks/11-messaging-and-streaming.md) |
| [ ] | Real-time dashboard | streaming aggregation, freshness, backpressure | [messaging](../HLD/01-building-blocks/11-messaging-and-streaming.md) |
| [ ] | Data warehouse ingestion | batch vs stream, schema evolution, replay, exactly-once processing | [messaging](../HLD/01-building-blocks/11-messaging-and-streaming.md) |
| [ ] | Web crawler | frontier, politeness, dedupe, indexing pipeline | [crawler](../HLD/04-design-case-studies/28-streaming-and-crawler.md) |

## 10. Platform and scheduling systems

| Done | Problem | Main concepts to cover | Related HLD |
|---|---|---|---|
| [ ] | Job scheduler | leases, retries, priority queues, idempotent jobs | [reliability](../HLD/02-distributed-systems/16-reliability-and-failure.md) |
| [ ] | Cron service | distributed scheduling, leader election, missed runs | [consensus](../HLD/02-distributed-systems/13-consensus.md) |
| [ ] | Task queue | visibility timeout, retries, DLQ, ordering | [messaging](../HLD/01-building-blocks/11-messaging-and-streaming.md) |
| [ ] | CI/CD pipeline | workflow graph, workers, artifacts, logs, isolation | [architecture](../HLD/03-architecture-and-apis/18-architectural-styles.md) |
| [ ] | Code hosting service | repos, permissions, Git storage, pull requests, search | [storage engines](../HLD/00-foundations/03-storage-engines.md) |
| [ ] | Multi-tenant SaaS platform | tenant isolation, noisy neighbors, quotas, migrations | [evolutionary architecture](../HLD/05-principal-skills/30-evolutionary-architecture.md) |

## Practice rotation

Do one prompt from each group before repeating a group. This prevents memorizing a narrow set of social-feed answers and builds coverage across the patterns interviewers actually test.

