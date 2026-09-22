# System Design & HLD — The Last-Minute Crash Course (SDE 3 Bar)

> A complete fast-track reference: the 5-step interview framework, estimation math, core building blocks with options & trade-offs, 8 full archetypes solved step-by-step, cross-cutting patterns, and SDE 3 verbal coaching.
>
> **Quick Links:** [HLD Curriculum Index](README.md) · [Master Cheat Sheet](CHEATSHEET.md) · [Problem Bank](PROBLEM-BANK.md) · [Worked Solutions](SOLUTIONS.md)

---

# Part 1 — The Framework (use this for every question)

Every answer follows the same five steps. The interviewer is grading your *process* more than your final diagram. At SDE 3, you are also graded on *driving*: open with "I'll clarify requirements, do quick estimates, define the API, draw the high-level design, then we can deep-dive wherever you'd like."

## Step 1 — Requirements (≈5 min)

Never start drawing. Start asking.

**Functional requirements** — what does the system do? List candidate features, then explicitly de-scope: "I'll focus on X and Y as core; Z is a stretch goal if we have time." Scope control is a senior signal.

**Non-functional requirements** — the numbers and properties that drive the design:

| Ask about | Why it matters |
|---|---|
| Scale (DAU, requests/day) | Decides whether you need 1 server or 1,000 |
| Read:write ratio | Decides caching strategy and replica count |
| Latency target (e.g. p99 < 100ms) | Decides what must be in memory / at the edge |
| Consistency vs availability priority | Decides DB choice and replication mode |
| Durability ("can we ever lose a message?") | Decides ack/persistence ordering |

**Golden rule:** every non-functional requirement should later justify a design choice — and you should say the connection out loud. "We said 100:1 reads, so I'm adding a cache here."

## Step 2 — Back-of-envelope estimation (≈5 min)

You estimate three things: **QPS, storage, bandwidth.**

### Conversion shortcuts (memorize)

| Fact | Use |
|---|---|
| 1 day ≈ 86,400 s → round to **10⁵ s** | daily volume ÷ 10⁵ = average QPS |
| 1 month ≈ **2.5 × 10⁶ s** | monthly volume ÷ 2.5M = QPS |
| 1M requests/day | ≈ **12 QPS** average |
| Peak QPS | ≈ **2–3× average** (design for peak) |
| Powers | K=10³, M=10⁶, B=10⁹, T=10¹² |
| Unit ladder | every 10³ steps up one unit: KB→MB→GB→TB→PB |

### How to never be off by 100×

Work in **powers of ten, never raw zeros**: write 500M as 5×10⁸ and *add exponents* instead of counting zeros.

> 5×10⁸ users × 10² views/day = 5×10¹⁰ views/day ÷ 10⁵ s = **5×10⁵ = 500K QPS**

Then **convert to a sane unit** before saying it: "2×10⁹ MB" → 2×10⁶ GB → 2×10³ TB → "**2 PB/day**".

### Per-record storage sizing

Estimate a record by summing its fields, then round up generously:

| Field type | Size |
|---|---|
| ID (bigint/UUID) | 8–16 B |
| Timestamp | 8 B |
| Short string (username, URL slug) | 20–100 B |
| Long URL / caption | 200–500 B |
| Text post / message | 100 B – 1 KB |
| Metadata row total (typical) | round to **500 B – 1 KB** |
| Photo | 200 KB – 2 MB |
| Minute of video (per quality) | 5–50 MB |

Storage formula: `records/day × bytes/record × retention days (× replication factor 3 if asked)`.

### Latency anchors (sanity-check your design)

| Operation | Latency |
|---|---|
| Memory (RAM/Redis) read | ~100 µs |
| SSD read | ~1 ms |
| Same-region network hop | ~1 ms |
| Disk seek (HDD) | ~10 ms |
| Cross-continent round trip | ~150 ms |

The metric prefixes for time denote fractions of a second, with each step representing a factor of 1,000 difference in magnitude. 

Millisecond (ms): One thousandth of a second ($10^{-3}$ s). 
Microsecond (µs): One millionth of a second ($10^{-6}$ s). 
Nanosecond (ns): One billionth of a second ($10^{-9}$ s).
There are 1,000 microseconds in one millisecond and 1,000 nanoseconds in one microsecond.  Consequently, there are 1,000,000 nanoseconds in a single millisecond.

Rule of thumb: memory ≪ SSD ≪ cross-region network. This is *why* caching in RAM near the user makes things fast, and why a p99 of 100ms forbids cross-continent synchronous calls.

**The senior move:** never leave a number raw — attach a conclusion. "3 TB over 5 years fits one machine, so we shard for throughput, not capacity." A junior computes; a senior concludes.

## Step 3 — API + high-level design (≈10–15 min)

Define the API *before* drawing — it forces clarity on what the system actually does:

```
POST /api/v1/resource     body: {...}        → {id, ...}
GET  /api/v1/resource/{id}                   → {...}
```

Then draw the universal skeleton and modify it for the problem:

```
Client → CDN (static)
Client → Load balancer → Stateless app servers → Cache (Redis)
                                               → Database (primary + replicas)
                                               → Message queue → Workers
                          Blob storage (S3) for large binary objects
```

Narrate each box's justification as you draw it: "Redis here because we computed 50:1 reads."

## Step 4 — Deep dive (≈15–20 min)

The interviewer picks 1–2 components. The winning pattern is always the same:

1. Present **2–3 options** for the component.
2. State each option's trade-off in one sentence.
3. Pick one and justify it **from the requirements**.

"Comparing options out loud" is itself the skill being tested.

## Step 5 — Bottlenecks & wrap-up (≈5 min)

Volunteer these before being asked:

- **Single points of failure** — replicate the DB, run multiple LBs/AZs.
- **What breaks at 10× scale** — usually: shard the DB, add cache capacity, partition the queue.
- **Abuse** — rate limit write APIs, bot defense.
- **Operations** — monitor cache hit rate, p99 latency, queue lag; alerts on each.

---

# Part 2 — Building Blocks: Options & Trade-offs

These ~10 components are the entire toolbox. For each: when to introduce it, the options, and what each costs. Every interview answer is these blocks recombined.

## 2.1 Caching

**Introduce when:** read-heavy ratio (≥10:1), repeated reads of the same data, latency target under ~10ms.

| Option | How it works | Trade-off |
|---|---|---|
| **Cache-aside** (default) | App checks cache; on miss reads DB and populates cache with TTL | Simple; cache failure loses nothing; first read after expiry is slow |
| **Write-through** | Writes go to cache + DB together | Cache always fresh; every write slower; caches data nobody reads |
| **Write-back** | Write to cache, flush to DB async | Fastest writes; risk of data loss if cache dies |

**Invalidation options:** short TTL (simple, bounded staleness) · delete-on-write (fresher; prefer *delete* over update — concurrent updates can race and cache the loser) · accept staleness (view counts, like counts).

**Delete-on-write race:** Thread A reads old value from DB → B writes new value and deletes cache key → A (late) writes old value into empty cache. **Mitigation: always keep a TTL as backstop** (the lie eventually heals), optionally delayed double-delete.

**Thundering herd / cache stampede:** hot key expires → 50K concurrent misses hammer the DB → DB dies. **Fixes:** single-flight lock (one request recomputes), serve-stale-while-revalidate, jittered TTLs so keys don't expire together.

**Why caching 20% of data absorbs 80%+ of reads:** real traffic follows a **Zipf (power-law) distribution** — a small fraction of content gets nearly all views. Check the workload is actually skewed before proposing a cache; uniform access (e.g., backups) makes caches useless.

**Key sentence:** "Caching trades correctness for speed; my job is to bound the incorrectness — X can be 5 minutes stale, Y cannot."

## 2.2 Database scaling (strict escalation order)

Proposing sharding before replicas is a yellow flag. Escalate in order:

**Level 1 — Read replicas.** Primary takes writes, replicas serve reads. Handles most read-heavy systems alone.
- Cost: **replication lag** → user writes then immediately reads a replica and misses their own write.
- Fix: **read-your-own-writes** — route a user's reads to the primary briefly after they write. Mentioning replication lag unprompted is high-value.

**Level 2 — Sharding.** Split data across machines by a **shard key** when write volume or dataset outgrows one primary.

| Concern | Rule |
|---|---|
| Choosing the key | **Shard key = dominant query pattern.** Restate the dominant query out loud, then derive the key. Messages read per-conversation → shard by conversation_id. Photos read per-user → shard by user_id. |
| Hot partitions | One key absorbs all traffic (celebrity's shard). Fixes: split hot entities (key + random suffix), cache hot data so the shard never sees reads. |
| What you lose (say unprompted) | No cross-shard joins, no cross-shard transactions; queries without the shard key must scatter-gather (expensive, worse with every shard). |
| Resharding | `hash(key) % N` reshuffles nearly everything when N changes. **Consistent hashing** moves only ~1/N of keys: "keys and servers map onto a ring; each key belongs to the next server clockwise, so adding a server only steals from its neighbor." |

**Queries that fight the partitioning** (e.g., "global trending" on user-sharded data): don't scatter-gather — **maintain a separate, query-shaped copy of the data**, derived asynchronously via a queue/stream, eventually consistent. (CQRS in spirit.)

**Level 3 — SQL vs NoSQL.** Lead with access patterns, never with technology:

| Need | Pick | Why |
|---|---|---|
| Transactions, joins, strong consistency (payments, bookings, inventory) | Postgres/MySQL | ACID; shard later if needed |
| Massive write throughput, key-based access, append-heavy (chat, feeds, sensors) | Cassandra/DynamoDB | Sharded by default; trades joins and default-strong-consistency away |
| Ephemeral, in-memory speed | Redis | Sub-ms; not durable by default |
| Full-text search | Elasticsearch | Inverted index |

**Key sentence pattern:** "Postgres for orders because I need transactional inventory decrements; Cassandra for the feed because it's append-heavy, partition-friendly, and tolerates eventual consistency."

## 2.3 Message queues & async processing

A queue buys three *distinct* things:

1. **Decoupling** — producer and consumers scale/fail independently; adding a consumer doesn't touch the producer.
2. **Buffering / load-leveling** — absorbs spikes (100K/s burst, drained at 5K/s). Trade-off: user gets "queued instantly," not "processed instantly."
3. **Retry & reliability** — unacked messages are redelivered after consumer crashes.

**Delivery semantics (know cold):**

| Semantics | Mechanism | Failure mode |
|---|---|---|
| At-most-once | Ack *before* processing | Crash after ack → message **silently lost** (usually worse than a duplicate) |
| At-least-once | Ack *after* processing | Crash before ack → **duplicate** processing |
| Exactly-once | Practically impossible across a network | Achieve **effectively-once** = at-least-once + idempotent consumer |

**Idempotent consumer:** every message carries a unique ID; consumer checks "already processed?" (Redis SETNX, unique-constraint insert, or upsert) before acting. Repeated failures → **dead-letter queue** for inspection instead of poisoning the stream.

**Key sentence:** "At-least-once delivery with idempotent consumers — losing messages silently is worse than handling duplicates, and duplicates are cheap to suppress with a dedup key."

**Kafka vs SQS-style, one sentence each:** Kafka is a *log* — persistent, ordered **per partition**, many consumer groups can replay independently (fan-out, streams). SQS-style is a *task queue* — one worker per message, deleted when done (background jobs). If order matters per entity, partition the topic by that entity's ID.

**Sync vs async decision rule:** user must see the result to continue (login, payment, page load) → synchronous. User only needs acknowledgment it will happen (email, thumbnail, feed fan-out, analytics) → queue it. Every box moved behind a queue makes the synchronous path faster and more resilient.

## 2.4 Load balancing

- **L4 (transport)** — routes by IP/port; fast, protocol-blind. **L7 (application)** — routes by URL/header/cookie; enables path-based routing, sticky sessions, TLS termination.
- Algorithms: round robin, least-connections, **consistent hashing** (when the same key should hit the same server — caches, websocket affinity).
- App servers must be **stateless** (session state in Redis/JWT) so any server can take any request — this is what makes horizontal scaling work.

## 2.5 Rate limiting

**Default algorithm: token bucket** — bucket refills at N tokens/sec up to a max; each request spends one; empty → HTTP 429. Allows short bursts while enforcing an average rate.

- vs **fixed window**: rigid, and has the edge bug — 100 requests at 11:59:59 + 100 at 12:00:01 = 200 in 2 seconds, both "within limit." Sliding window log/counter fixes it at more cost.
- **Distributed**: counters live in Redis so all API servers share the same bucket.
- **Placement**: API gateway / LB layer, before app servers.

## 2.6 Real-time delivery

| Option | How | Trade-off |
|---|---|---|
| Short polling | Client asks every N sec | Simple; wasteful; N-sec latency |
| Long polling | Server holds request until data | Near-real-time; connection churn |
| **WebSockets** | One persistent bidirectional connection | The answer for chat/live; **stateful** |
| SSE | Server→client stream over HTTP | One-way push; simpler than WS |

WebSockets break statelessness → dedicate a fleet of **connection gateway servers** that only hold sockets, plus a **registry** (Redis: user_id → gateway) so any service can find a user's socket. Offline user → push notification + store message for sync-on-reconnect.

## 2.7 Blob storage + CDN

- **Universal media pattern: blob store for bytes, DB for metadata.** No database stores petabytes of images/video; S3-style storage holds the object, the DB row holds {id, owner, blob URL, timestamps}.
- **Uploads go client → blob storage directly via pre-signed URLs** — never proxy large files through app servers (at 10K uploads/sec × 2MB you'd need 20 GB/s through your fleet).
- **CDN** for anything static and popular — media is the ultimate Zipfian workload. Mention cache TTLs and invalidation (versioned URLs).

## 2.8 Unique ID generation

| Option | Trade-off |
|---|---|
| DB auto-increment | Simple; single point of bottleneck/failure; guessable |
| UUID v4 | No coordination; 128-bit, random → terrible index locality, not sortable |
| **Snowflake-style** (timestamp + machine id + sequence) | 64-bit, time-sortable, no coordination; needs clock sanity |
| Pre-allocated ranges / key pool | Service hands ranges (A: 1–1M, B: 1M–2M); each server increments locally |

Time-sortable IDs double as ordering keys (chat messages, feed items).

## 2.9 Consistency vocabulary

- **CAP in one line:** during a network partition you choose availability (serve possibly-stale data) or consistency (refuse/wait). Normal operation isn't the trade.
- The high-value pattern is the **split**: "Availability and eventual consistency for X (display, feeds, counts); strong consistency for Y (payments, inventory, the user's own writes)."
- **Strict consistency for the actor, eventual for the audience:** the uploader must see their own post instantly (read-your-writes); followers seeing it 3 seconds late is invisible.

## 2.10 Concurrency control (write contention)

The bug: **check-then-update as two steps (TOCTOU)** — two requests both read "available," both write.

| Option | Mechanism | When |
|---|---|---|
| **Atomic conditional update** (default for flash-sale-like) | `UPDATE ... SET status='reserved' WHERE id=42 AND status='available'`; check rows-affected (1 = won, 0 = lost) | Conflicts are the norm; want one clean round trip |
| Pessimistic locking | `SELECT ... FOR UPDATE`, then decide, in a transaction | High contention, short critical section; risk of lock pile-ups |
| Optimistic locking | Read `version`; `UPDATE ... WHERE version=7`; rows-affected 0 → retry | Conflicts rare |

**Hot row:** every write contends on one row (single inventory counter) → DB serializes purchases on one lock; throughput collapses to a few hundred/sec. **Reliefs:** sharded counters (10 rows × 1,000 each; retry another shard on zero) · Redis atomic DECR as a fast admission filter (~100K ops/s; DB stays source of truth) · serialize through a single Kafka partition (bounded but orderly).

---

# Part 3 — The Eight Archetypes, Answered Exactly As You Would In The Interview

Each archetype below is a model answer that walks all five framework steps. "Say:" lines are phrasings you can use almost verbatim. Every major component gets its options and trade-offs, then a pick justified from the requirements.

## 3.1 URL Shortener (TinyURL)

### Step 1 — Requirements (5 min)
**Say:** "Let me confirm the functional scope. Core: given a long URL return a short one, and redirect short → long. Do we need custom aliases, link expiry, click analytics?" Then de-scope: "I'll treat shorten + redirect as core and analytics as a stretch goal."
**Non-functional — propose if not given:** 100M new URLs/month; read:write 100:1 (redirects dominate); high availability over strong consistency (a stale mapping is impossible anyway — mappings are immutable); redirect latency < 100ms; links live ~5 years.

### Step 2 — Estimates
- Writes: 10⁸ / 2.5×10⁶ s ≈ **40/s** (trivial).
- Reads: ×100 ≈ **4K QPS avg, ~10K peak** → "read-heavy: this design is about the read path."
- Storage: ~500 B/record (code 7B, URL ~300B, timestamps, user) × 100M × 12 × 5y = 6×10⁹ × 500B = **3 TB**.
- **Conclusion (say it):** "3 TB fits one machine — if we shard, it's for throughput and availability, not capacity."

### Step 3 — API + high-level design
```
POST /api/v1/urls   {long_url, custom_alias?, expiry?} → 201 {short_url}
GET  /{short_code}                                     → 301/302 Location: long_url
```
**301 vs 302 — name the trade-off before they ask:** 301 (permanent) lets browsers cache → less load, but repeat clicks never reach you → no analytics. 302 → every click hits you → full analytics, more load. Pick from requirements: "We de-scoped analytics, so 301 to shed load — switchable later."
**Components:** Client → LB → stateless API servers → Redis → DB; a Key Generation Service on the write path.

### Step 4 — Deep dives

**Deep dive A — short-code generation (the expected one):**

| Option | How | Trade-off |
|---|---|---|
| Hash the URL (MD5/SHA, first 7 base62 chars) | Deterministic | Collisions must be detected & re-salted; same URL → same code (feature or bug per requirements) |
| Global auto-increment + base62 | No collisions | Single counter = bottleneck + SPOF; sequential codes are guessable/enumerable |
| **Key Generation Service with ranges** ✅ | KGS hands servers ID ranges (A: 1–1M, B: 1M–2M); each increments locally, encodes base62 | No per-request coordination, no collisions; KGS is rarely-hit; pre-fetch a spare range so KGS downtime doesn't block writes |

Capacity math: base62⁷ ≈ **3.5 × 10¹²** codes ≫ 6×10⁹ records. Randomize within ranges if guessability matters.

**Deep dive B — storage choice:**

| Option | Trade-off |
|---|---|
| RDBMS (Postgres) | Fine at 3 TB / 40 writes/s; familiar; needs index on short_code |
| **Key-value store (DynamoDB/Cassandra)** ✅ | The access pattern IS key→value; trivially partitioned by short_code; no relations needed |

**Say:** "The workload is a pure key-value lookup, so a KV store partitioned by short_code is the natural fit — though honestly Postgres also survives this scale; I'd choose KV for operational headroom."

**Deep dive C — caching the redirect path:** cache-aside in Redis (`code → long_url`), TTL + LRU. Zipfian traffic → small cache, high hit rate. Mappings are immutable → **no invalidation problem** (say this; it's why this design is "easy mode").

### Step 5 — Bottlenecks & wrap-up
SPOFs: replicate DB, ≥2 LBs/AZs, KGS pre-fetched ranges. Abuse: rate limit POST per user/IP; malicious URL check (safe-browsing) on write. 10×: partition KV by short_code (hash → consistent hashing for resharding). Monitor: cache hit rate, redirect p99, KGS range consumption.

### Likely questions (with answers)
- *Expiry?* Lazy-delete on read (if expired → 404 + delete) + low-priority background sweep.
- *Custom alias collision?* Unique-constraint insert; surface 409 to user.
- *Analytics later?* Click events → Kafka → stream aggregation (don't put counters on the redirect path).
- *Why not UUID?* 128-bit, not 7 chars, not sortable, terrible URL.

## 3.2 News Feed (Twitter / Instagram)

### Step 1 — Requirements
**Say:** "Core features: publish a post (text + media), follow users, and a home feed of recent posts from people I follow, reverse-chronological. I'll de-scope ranking, ads, and stories. Is reverse-chron acceptable?"
**Non-functional:** 500M DAU; feed load < 200ms p99; **the author must see their own post immediately** (read-your-writes), followers may see it seconds later (eventual); media-heavy; follower counts range 10 → 600M (ask for this — it drives the whole design).

### Step 2 — Estimates
- Reads: 5×10⁸ × 10² views/day = 5×10¹⁰ ÷ 10⁵ = **500K QPS** (peak ~1.5M).
- Writes: 5×10⁸ × 2 posts = 10⁹/day = **10K QPS** → **50:1 read-heavy → precompute + cache aggressively.**
- Media: 10⁹ × 2 MB = **2 PB/day → blob store + CDN; DB holds metadata only; client uploads via pre-signed URLs (20 GB/s would melt app servers).**

### Step 3 — API + high-level design
```
POST /api/v1/posts                {media_id, caption}        → {post_id}
GET  /api/v1/feed?cursor=&limit=50                           → {posts[], next_cursor}
POST /api/v1/follow/{user_id}
```
**Components:** Client → CDN (media) · Client → LB → Feed/Post services (stateless) → Redis (feed lists + post cache) → Post DB (sharded) + Social-graph DB → Kafka → fan-out workers. Blob storage for media.

### Step 4 — Deep dives

**Deep dive A — feed generation (THE deep dive):**

| Option | How | Dies because |
|---|---|---|
| Pull (fan-out-on-read) | At read: query recent posts of ~800 followees, merge, sort | Most expensive query (multi-shard scatter-gather) at highest frequency, redone every refresh |
| Push (fan-out-on-write) | On post: insert post ID into every follower's precomputed list | Celebrity: 600M followers → 600M writes per post; hours of amplification, mostly for dormant users |
| **Hybrid** ✅ | Push for normal users; **no fan-out above ~10K followers** — readers pull celebrity posts at read time and merge | Celebrity pull is cheap because their posts are massively cached (Zipf); plus skip fan-out to dormant users (30-day inactive), rebuild on demand |

**Say:** "This is the classic celebrity problem — I'd run the hybrid: fan-out-on-write below a follower threshold, pull-and-merge above it."

**Deep dive B — feed storage:**

| Option | Trade-off |
|---|---|
| **Redis list of post IDs per user** ✅ | O(1) reads; capped via LTRIM (~800 IDs — bounds memory, nobody scrolls past); volatile → rebuildable from pull path on cache loss |
| DB table (user_id, post_id, ts) | Durable but adds a write-heavy table; slower reads |

**Store IDs, not content** — hydrate from post cache at read. Edits/deletes touch one copy; missing IDs are skipped at hydration (free delete handling). "Normalize the data, denormalize only the ordering."

**Deep dive C — write path end-to-end:** post → Post DB (sharded by user_id: profile pages are single-shard) → ack to author (their own feed/profile reads include own posts → read-your-writes) → OrderCreated-style event to Kafka → fan-out workers insert ID into follower lists. Worker crash → at-least-once redelivery; inserts are set-like/idempotent.

**Deep dive D — pagination:** cursor = timestamp/post-ID of last item, not OFFSET (offsets shift as new posts arrive; cursors are stable and index-friendly).

### Step 5 — Bottlenecks
Hot post cache keys (viral) → replicate hot keys / local cache; fan-out queue lag during posting spikes → partition by author, autoscale workers, monitor lag; social-graph reads (who follows X) are huge during fan-out → cache follower lists; full Redis loss → degrade to pull path (graceful degradation — name it).

### Likely questions
- *Unfollow?* Lazy: filter at hydration; or async removal job.
- *Where does ranking fit?* Fetch a larger candidate set (say 200 IDs) → scoring service → top 50. Precompute candidates, rank at read.
- *Why is Twitter's threshold ~10K?* Balance: fan-out cost per post vs read-time merge cost across all followers — tunable, A/B'd.
- *Post edit propagation?* Only the post record changes; every feed hydrates the fresh copy.

## 3.3 Chat System (WhatsApp)

### Step 1 — Requirements
**Say:** "Core: 1-on-1 chat; I'll extend to groups if time allows. Guarantees: per-conversation ordering, sent/delivered receipts, and durability — messages survive a recipient being offline for a week. Sub-second delivery when online. De-scoping: voice/video calls, E2E encryption (can discuss as an extension)."
**Non-functional:** 500M DAU; ~10⁹ messages/day; consistency: a ✓ must never lie (durability before ack).

### Step 2 — Estimates
- Messages: 10⁹/day ÷ 10⁵ = **10K writes/s avg, ~30K peak**.
- Storage: ~1 KB/message with metadata × 10⁹/day = **1 TB/day, ~365 TB/yr → sharded wide-column store territory.**
- Connections: ~10% concurrently online = 50M sockets ÷ ~500K per gateway = **~100 gateway servers.** **Conclusion:** "Connections, not message QPS, size this system."

### Step 3 — API + high-level design
Over the socket: `send(conv_id, client_msg_id, text)` · `ack(msg_id)` · `receipt(msg_id, delivered|read)`; HTTP for history sync: `GET /conversations/{id}/messages?after_id=`.
**Components:** Client ⇄ WebSocket **gateways** (dumb: hold sockets only) → **Chat service** (stateless logic) → **Message store** (sharded) + **Connection registry** (Redis user→gateway) → Push notification service (offline path).

### Step 4 — Deep dives

**Deep dive A — real-time channel:**

| Option | Trade-off |
|---|---|
| Short polling | N-sec latency, wasteful at 500M users |
| Long polling | Near-real-time; heavy connection churn |
| **WebSockets** ✅ | Bidirectional, persistent — but stateful → dedicated gateway fleet + registry so any service can find a user's socket |

**Deep dive B — message journey (narrate it):** Alice's socket → gateway → chat service → assign per-conversation monotonic ID → **persist first** → ack Alice → **✓ = durably stored** (crash before persist → no ✓ → client retries with client_msg_id as dedup key) → registry lookup for Bob → Bob's gateway → Bob's screen → Bob's **device** sends delivery receipt → **✓✓ fires only on device ack, never on socket push** (sockets can be zombies).

**Deep dive C — message store:**

| Option | Trade-off |
|---|---|
| **Cassandra-style, partition = conversation_id, cluster by message ID** ✅ | Shard key = dominant query ("load this conversation" = one partition); append-heavy friendly; linear scale |
| Sharded MySQL by conversation_id | Workable; more ops effort at this write volume |

**Ordering:** per-conversation monotonic IDs (counter on the conversation's own shard, or Snowflake if rare same-ms ties are acceptable); clients sort by ID; ID doubles as the dedup key. **Cross-conversation ordering: not required — say you're not paying for it.**

**Deep dive D — offline path:** registry miss → message already durable (persist-first made this free) → push via APNs/FCM → on reconnect client sends "I have up to ID 4512" → server returns the rest (**sync-on-reconnect**). "Delivery is push-when-connected, pull-on-reconnect; the store is the source of truth, not the socket."

**Deep dive E — groups (≤ ~1K members):** store once under group_id (= conversation_id); **delivery** fans out via registry to online members. Mega-channels (5M subscribers) = celebrity problem → flip to pull/cached reads. Name the rhyme.

### Step 5 — Bottlenecks
Gateway dies → clients reconnect via LB elsewhere; registry heals on reconnect (entries carry TTL/heartbeat). Registry is hot → Redis cluster, partition by user_id. Hot conversations (huge groups) → hot partition: cap group size or split delivery workers. Monitor: socket count/gateway, delivery p99, push-notification failure rate, store write latency.

### Likely questions
- *Presence/typing indicators?* Ephemeral fire-and-forget through gateways; never persisted; presence = TTL'd registry entries refreshed by heartbeats.
- *Read receipts?* Another receipt type, same path as delivered.
- *Multi-device?* Registry holds a set of sockets per user; each device tracks its own sync cursor.
- *E2E encryption?* Server stores ciphertext; IDs/receipts/ordering unchanged; key exchange (Signal protocol) out of scope.

## 3.4 Flash Sale / Ticketmaster

### Step 1 — Requirements
**Say:** "Functional: browse events and the seat map, reserve seats, pay, confirm. The hard requirement: **never sell the same seat twice — strong consistency on inventory.** Seat-map *display* can be seconds stale. Scale: 10K tickets, 500K concurrent buyers at 10:00:00 — a stampede, not steady traffic. De-scope: pricing, recommendations."

### Step 2 — Estimates
- Browse: 500K users polling the seat map → **~100K+ read QPS for a few minutes** → must come from cache.
- Meaningful writes: only ~10K tickets → **~10K successful purchases total; everything above that is guaranteed-loser traffic to shed before the DB.** ← the estimate that designs the system; say it.

### Step 3 — API + high-level design
```
GET  /events/{id}/seats                  → seat map (cached, may be seconds stale)
POST /events/{id}/reservations {seat_id} → {reservation_id, expires_at} | 409
POST /reservations/{id}/confirm {payment_token} → {order_id}
```
**Components:** Client → **waiting room** → LB (+ rate limiter) → API servers → Redis (seat-map cache, admission counters) → **Inventory DB (Postgres — transactional truth)** → Payment service (circuit-broken) → Kafka → notification/analytics.
**Say the consistency split:** "Display = eventually consistent and cached; purchase = strongly consistent atomic write. Same system, two consistency choices, each justified."

### Step 4 — Deep dives

**Deep dive A — the race (two users, last seat, same millisecond).** Check-then-update in two steps is the bug (**TOCTOU**). Options:

| Option | Mechanism | Trade-off |
|---|---|---|
| **Atomic conditional update** ✅ | `UPDATE seats SET status='reserved', user_id=:u, expires_at=now()+'10 min' WHERE seat_id=42 AND (status='available' OR (status='reserved' AND expires_at<now()))` → rows-affected 1 = won, 0 = taken | One round trip; DB row lock serializes; expiry-aware WHERE reclaims expired holds lazily — no sweeper races |
| Pessimistic `SELECT FOR UPDATE` | Lock row, then decide, in a txn | Fine for short critical sections; lock pile-ups if anything stalls |
| Optimistic (version column) | `UPDATE … WHERE version=7`; 0 rows → retry | Best when conflicts are rare — flash sales are the opposite |
| Redis hold (SETNX + TTL) | Fast claim in memory | Redis & DB can disagree during failures → DB conditional update stays the final arbiter |

**Say:** "Conflicts are the norm here, so I want one atomic round trip that wins or loses cleanly — conditional update."

**Deep dive B — reservation lifecycle:** Buy ≠ sell. reserve (TTL 10 min) → pay (idempotency key on the payment call) → success: reserved→sold; failure/timeout: seat returns via the expiry-aware WHERE (or a background sweep — name both, pick lazy reclaim).

**Deep dive C — the front door:** **Virtual waiting room** — at 10:00 users receive a queue position/token; admit into the purchase flow at ~1K/s; tell position 30K+ the honest odds. (Queue-as-load-leveler promoted to a product feature.) Plus per-user/IP rate limiting (bots) and the cached seat map (poll it, never the DB).

**Deep dive D — general-admission variant (one counter): the hot row.** Every purchase decrements the same row → DB serializes on one lock → few hundred TPS exactly when you need more. Reliefs:

| Relief | Trade-off |
|---|---|
| **Sharded counters** (10 × 1,000) | 10× less contention; a shard can hit 0 while others have stock → retry another shard before "sold out" |
| **Redis DECR admission filter** | ~100K ops/s, no convoy; not durable → DB remains ledger; reconcile (≥0 = claim, proceed to DB; <0 = INCR back, sold out) |
| Single Kafka partition serialization | Perfectly orderly, back-pressured; throughput bounded by one consumer |

### Step 5 — Bottlenecks
Payment provider slowness → **circuit breaker + timeout + bounded retries with idempotency keys** (Part 7.3); DB primary is the write SPOF → HA failover replica; oversell invariant monitored (`sold ≤ capacity` alert); waiting-room service itself must be stateless/horizontal.

### Likely questions
- *Payment times out — sold?* No: reservation expires; idempotency key prevents double charge on retry; reconcile job for "paid but unconfirmed."
- *User refreshes mid-purchase?* Reservation keyed to user → idempotent re-entry.
- *Why not queue everything and skip locks?* You do queue — but the atomic write stays as the last line of defense (defense in depth).
- *Bots?* Rate limits, device fingerprinting, CAPTCHA at waiting-room entry, per-account purchase caps.

## 3.5 Video Platform (YouTube / Netflix)

### Step 1 — Requirements
**Say:** "Core: upload a video; watch with minimal buffering on variable networks; search and recommendations I'll de-scope. One clarification that changes everything: is upload-to-available allowed to take minutes? (Yes → the whole processing side goes async.)"
**Non-functional:** extreme read skew (a tiny fraction of videos = nearly all watch traffic); smooth playback on 3G through fiber; durability of uploaded masters; watch start < 1–2 s.

### Step 2 — Estimates (pattern)
- Watch: e.g. 100M DAU × 5 videos = 5×10⁸ views/day ≈ **5K QPS of manifest fetches** — but each view then streams ~hundreds of segment fetches → **segment traffic is CDN's problem by design.**
- Upload: ~500K videos/day ≈ 6/s — trivial QPS, huge bytes: 500K × ~500 MB raw = **250 TB/day raw, ~2–3× more after renditions → PB-scale/week.**
- **Conclusion:** "Bytes dominate, not QPS: the design is blob storage + CDN + an async pipeline; the database is a thin metadata layer."

### Step 3 — API + high-level design
```
POST /api/v1/videos/init {title,...}  → {video_id, presigned_upload_url}
POST /api/v1/videos/{id}/complete     → 202 {status:"processing"}
GET  /api/v1/videos/{id}              → {metadata, status, manifest_url}
GET  CDN: /manifests/{id}.m3u8 and /segments/{id}/{quality}/{n}.ts
```
**Components:** Client → pre-signed URL → **blob storage (raw)** → "upload complete" event → Kafka → **transcoding workers** → blob storage (segments + manifests) → **CDN** → player. Metadata DB: {video_id, owner, status, manifest_url}.

### Step 4 — Deep dives

**Deep dive A — upload path:**

| Option | Trade-off |
|---|---|
| Proxy through app servers | Servers shovel GBs; melts the fleet (we computed this class of problem at 20 GB/s for Instagram) |
| **Pre-signed URL direct to blob storage** ✅ | App servers only mint URLs; storage service handles bytes; resumable/multipart for big files |

**Deep dive B — transcoding pipeline (the new idea):** workers convert the raw file into multiple resolutions (1080/720/480/240) **and chop each into ~4-second segments**.

| Property | Why it matters in the answer |
|---|---|
| Async behind a queue | "Processing" status is acceptable per requirements; absorbs upload bursts |
| Embarrassingly parallel | Different renditions — even different segments — transcode concurrently on separate workers → latency shrinks with fleet size |
| Failure handling | At-least-once redelivery + idempotent writes (re-transcoding a segment overwrites the same object — naturally idempotent) |
| DAG orchestration | split → per-segment transcode → thumbnails/audio → assemble manifest → mark ready |

**Deep dive C — streaming:**

| Option | Trade-off |
|---|---|
| Progressive download (one MP4) | Simple; one quality; seek/buffer poorly on bad networks |
| **Adaptive bitrate (HLS/DASH)** ✅ | Player fetches segment-by-segment, switching quality per measured bandwidth — degrade to 480p instead of buffering; needs the segment pipeline above |

Manifest lists every segment at every quality. "Watching" = manifest → segments **from CDN** (ultimate Zipf workload). Private videos → signed, expiring CDN URLs.

### Step 5 — Bottlenecks
View-count writes are a hot row → aggregate via stream processing, eventually consistent (never increment per view on the watch path). New-viral-video cache miss storm at CDN edge → origin shield + request coalescing (the thundering-herd fix at CDN layer — name the rhyme). Transcoding backlog during upload spikes → monitor queue lag, autoscale workers, priority lane for popular creators.

### Likely questions
- *Resume watching?* Client reports position periodically; stored per (user, video).
- *Why 4-second segments?* Trade-off: shorter = faster quality switching, more requests/overhead; longer = fewer requests, slower adaptation.
- *Live streaming difference?* Same segment idea with a rolling manifest; latency budget shrinks; no full-file pre-processing.
- *Storage cost control?* Cold renditions to cheaper tiers; lazy-transcode rare qualities on first request.

## 3.6 Proximity Service (Uber / "find nearby X")

### Step 1 — Requirements
**Say:** "Core: drivers stream location; a rider requests a ride; we match to a nearby driver; both track the trip. De-scope: pricing/surge, routing/ETA precision (assume a routing service exists). Key property to confirm: driver locations are worthless in ~30 seconds — so freshness beats durability for location data."
**Non-functional:** match latency ~seconds; location ingest is the write firehose; trip/billing records ARE durable (separate concerns — say it).

### Step 2 — Estimates
- Location ingest: 1M active drivers ÷ 4 s = **250K writes/s** → "no durable DB sustains this comfortably and nothing requires it to — this lives in memory."
- Matching: even 1M rides/hour ≈ 280 requests/s — trivial; **the design problem is the ingest + the geo-query, not match QPS.**
- Memory: 1M drivers × ~100 B = 100 MB — tiny; Redis easily.

### Step 3 — API + high-level design
```
(driver, over socket/UDP-ish) PUT location {lat, lng}        every ~4s
POST /api/v1/rides {pickup_lat, lng}     → {ride_id, driver, eta}
GET  /api/v1/rides/{id}                  → live status
```
**Components:** Drivers → gateways → **location service** → **Redis geo-index** (cell → set of driver IDs). Riders → match service → geo-query → ranking → **offer with TTL hold** → trip service → durable trip DB (async) → location stream also feeds trip tracking.

### Step 4 — Deep dives

**Deep dive A — the geo-query.** Naive `WHERE lat BETWEEN … AND lng BETWEEN …` can't use one B-tree across two dimensions.

| Option | Trade-off |
|---|---|
| **Geohash** ✅ | (lat,lng) → string `tdr1w3`; each char refines the cell (6 chars ≈ 1km); nearby points share prefixes → prefix/range query on any index. Edge case to volunteer: neighbors across a cell boundary differ in prefix → query the cell **+ its 8 neighbors** |
| Quadtree | Adaptive cell sizes (dense cities get small cells); in-memory tree to maintain |
| S2 / H3 | Production-grade cell systems (Google/Uber); name-drop, same idea |
| PostGIS R-tree | Fine at modest scale; the 250K writes/s rules a relational store out here |

**Deep dive B — where locations live:**

| Option | Trade-off |
|---|---|
| **Redis: geohash cell → set of drivers (+ TTL per entry)** ✅ | Absorbs 250K writes/s; data expires from relevance in 30 s anyway; crash-loss is fine — **rebuilds itself within seconds from the ongoing stream** (say this — it's the insight) |
| Durable DB | Pays durability cost for data that's stale in 30 s; can't keep up |

Durable storage only for trips/billing — written async off the same stream (sampled/batched for the trail).

**Deep dive C — matching:** rider → compute geohash → fetch drivers in cell + 8 neighbors → rank by ETA (straight-line first; routing service refines) → **offer to ONE driver with a TTL'd hold** so two riders can't get the same driver — "the Ticketmaster reservation wearing a mustache." Decline/timeout → next candidate; all transitions idempotent (offer IDs).

### Step 5 — Bottlenecks
**Hot cells** (airport at 5 pm) — it's the hot-partition disease: locally increase cell resolution (smaller cells), cache cell reads, spread members across sub-keys. Cell-size trade-off: small = precision but more neighbor queries; pick by density or go multi-resolution. Monitor: ingest lag, match latency, offer-acceptance rate, empty-cell ("no drivers") rate.

### Likely questions
- *Driver app offline mid-trip?* Trip state machine is durable; location gaps tolerated; reconcile on reconnect.
- *Surge pricing input?* Supply/demand per cell — the geo-index gives you both counts for free.
- *Why not push all driver locations to riders?* Riders only need nearby few; server-side filter via the index; push deltas for the matched driver only.
- *Privacy?* Coarsen historical traces; TTL raw locations aggressively.

## 3.7 Web Crawler

### Step 1 — Requirements
**Say:** "Goal: crawl on the order of 1B pages within a month, store content for indexing, keep re-crawling for freshness. Hard constraints: **politeness** — never overwhelm a domain, honor robots.txt — and **dedup** so we don't re-fetch what we have. De-scope: the search index itself, JS rendering (extension)."

### Step 2 — Estimates
- 10⁹ pages / (30 × 10⁵ s) ≈ **~400 pages/s sustained; design fetchers for a few thousand/s** for headroom + retries.
- Content: 10⁹ × ~100 KB avg = **100 TB** (+ copies/versions) → blob storage.
- URL universe seen: maybe 10–30B URLs → "have I seen this URL?" is a **billions-scale membership query** — that estimate forces the bloom filter. Say the conclusion.

### Step 3 — API + high-level design (it's a loop)
**URL frontier** (the queue of URLs to visit) → **fetcher workers** (DNS, download) → content → blob store; → **parsers** extract links → normalize → dedup → back into the frontier. Metadata + link graph → DB. Scheduler re-enqueues by freshness policy.

### Step 4 — Deep dives

**Deep dive A — the frontier (politeness lives here).** A naive global queue fires 10K concurrent requests at one unlucky domain — an accidental DDoS.

| Option | Trade-off |
|---|---|
| Single global FIFO | Simple; no politeness, no priority |
| **Per-domain sub-queues + per-domain rate (1 conn, delay between hits) + priority tiers** ✅ | Politeness is structural; news sites hourly, static pages monthly; honor robots.txt (cached per domain) |

Distribution: **partition the frontier by hash(domain)** → all of a domain's URLs land on one worker → politeness becomes a local concern, no cross-worker locks. (Shard key = the constraint, not just the query — nice senior aside.)

**Deep dive B — dedup at billions scale:**

| Option | Trade-off |
|---|---|
| Exact set in a DB | Billions of lookups/inserts; big, hot |
| **Bloom filter (in memory) → on "maybe seen", confirm in the store** ✅ | Tiny memory; "definitely new" is exact; false positive = occasionally skipping an unseen URL — acceptable for a crawler. THE canonical bloom-filter use case |

Also dedup **content** (hash of page body) — mirrors and duplicates waste storage and skew the index.

**Deep dive C — fetch/parse hygiene:** URL normalization (case, trailing slash, tracking params); **trap defenses** — infinite calendars, session-ID URLs → per-domain depth and page-count budgets; DNS resolution at this rate needs its own cache; timeouts + bounded retries → failed URLs to a retry tier → DLQ-equivalent (dead URL list).

### Step 5 — Bottlenecks
Frontier storage grows unbounded → it's disk-backed (the frontier is a database problem, not an in-memory queue — name it); few giant domains dominate → their sub-queues throttle naturally while others proceed; freshness vs coverage is an explicit budget split (e.g. 70% recrawl / 30% discovery). Monitor: pages/s, frontier depth, per-domain error rates, robots violations (should be zero).

### Likely questions
- *JS-heavy pages?* Small headless-browser fleet, 10–100× cost → route only pages that need it (detected by heuristics).
- *How do you know a page changed?* Conditional GET (ETag/Last-Modified), content hash compare; adapt recrawl frequency to observed change rate.
- *Duplicate sites (mirrors)?* Content-hash dedup + canonical URL tags.
- *Respecting crawl-delay?* robots.txt's crawl-delay feeds the per-domain rate directly.

## 3.8 Notification System

### Step 1 — Requirements
**Say:** "Core: internal services emit events (order shipped, new message); we deliver via push, email, SMS per user preference. Guarantees: at-least-once with dedup — **a user must never get the same notification twice, and OTPs must never be lost or late.** De-scope: marketing campaign tooling."
**Non-functional:** bursty (a celebrity posts → millions of pushes); per-channel provider limits; user-level caps (nobody gets 50 pings/min).

### Step 2 — Estimates
- e.g. 10⁹ notifications/day ≈ 10K/s average, **bursts 10–100×** → "the queue exists to flatten exactly this."
- Fan-out events (1 post → 1M followers) → the *notification* fan-out mirrors the feed fan-out — same hybrid logic for mega-audiences.

### Step 3 — API + high-level design
```
POST /internal/v1/notify {event_id, user_ids|audience, template_id, data, priority}  → 202
```
**Components:** Producer services → Kafka (`notification-events`, priority-tiered topics) → **notification service**: resolve preferences + device tokens, render template, dedup → **per-channel queues + workers** (APNs/FCM push, email, SMS) → providers. Preferences service, template service, delivery-status store.

### Step 4 — Deep dives

**Deep dive A — per-channel isolation (bulkhead, name it):** separate queue + worker pool + rate limit per channel — a slow email provider must not delay OTPs over push/SMS. **Priority lanes:** OTP/security on a high-priority queue that jumps everything.

**Deep dive B — effectively-once:** dedup key = `(event_id, user_id, channel)` checked via SETNX/unique insert before send; at-least-once everywhere underneath; provider call itself is the unavoidable at-least-once edge (a crash between "sent" and "recorded" can duplicate — acknowledge it; provider-side collapse keys, e.g. FCM, mitigate).

**Deep dive C — provider failure:** timeouts + retries with backoff+jitter → **circuit breaker** per provider → failover provider where possible (SMS/email) → DLQ + alert. Token hygiene: prune invalid device tokens from provider feedback.

**Deep dive D — user-level controls:** per-user rate limit (token bucket keyed by user) + digesting ("12 new likes" instead of 12 pushes) + quiet hours from the preferences service.

### Step 5 — Bottlenecks
This system is "nothing new — the queues block arranged in a fan" (say it: recognizing that IS the answer). Hot spots: preference/token lookups at fan-out scale → cache them; status writes are write-heavy → async batch.

### Likely questions
- *Scheduled digests?* Delay queues / scheduled jobs aggregating per user.
- *Exactly one per event?* Effectively-once via the dedup key — walk the mechanism.
- *Ordering across channels?* Not required — decline the non-problem.
- *Read/unread sync across devices?* Notification-status store; clients sync a cursor (rhymes with chat's sync-on-reconnect).
# Part 4 — Cross-Cutting Patterns (the rhymes)

System design is ~12 ideas wearing different hats. Spotting and *naming* a rhyme in the room is one of the strongest senior signals.

| Pattern | Appearances |
|---|---|
| Push vs pull vs hybrid | News feed fan-out · group chat vs mega-channels · notification delivery |
| Hot key/partition/row | Celebrity shard · viral cache key · GA ticket counter · airport cell in Uber |
| Reservation with TTL | Ticketmaster seat hold · Uber driver hold · distributed locks generally |
| At-least-once + idempotent consumer | Every queue consumer in every design |
| Blob for bytes, DB for metadata | Instagram · YouTube · crawler page store |
| Precompute what you can't query | Feed lists · trending via stream aggregation · search indexes |
| Partition by the dominant query | conversation_id for chat · user_id for photos · domain for crawler frontier |
| Actor-strict, audience-eventual consistency | Posting · messaging receipts · view counts |
| Queue as load-leveler | Flash-sale waiting room · transcoding pipeline · notification bursts |
| Zipf distribution justifies caching | Feed posts · videos · short URLs · celebrity content |

# Part 5 — SDE 3 Signals & Phrase Bank

What separates SDE 3 from SDE 2 in this interview: **driving, justifying, and volunteering failure modes.**

**Drive:** "I'll clarify requirements, estimate scale, define the API, draw the high-level design, then deep-dive wherever you'd like."

**Scope:** "I'll focus on X and Y as core and treat Z as a stretch goal."

**Estimates → conclusion:** "That's 3 TB over five years — fits one machine, so we shard for throughput, not capacity."

**Justify every box:** "Redis here because we're at 50:1 read-to-write and the feed query is expensive."

**Options pattern:** "Three options: A (trade-off), B (trade-off), C (trade-off). Given our requirement for X, I'd pick B."

**Consistency split:** "Eventual consistency is fine for the seat map; the purchase itself needs a strongly consistent atomic write."

**Failure modes, unprompted:** "If this consumer dies mid-message we'll reprocess, so writes must be idempotent." · "This counter is a hot row at peak; I'd shard it."

**Replication lag:** "After a write I'd route that user's reads to the primary briefly — read-your-own-writes."

**Naming the rhyme:** "This is the celebrity fan-out problem in disguise, so the same push/pull hybrid applies."

**Declining non-problems:** "Cross-conversation ordering isn't required, so I won't pay for it."

**Operational close:** "I'd monitor cache hit rate, p99 latency, and queue lag, and alert on each."

# Part 6 — Quick-Reference Crib (last 10 minutes before the interview)

- 1 day ≈ 10⁵ s · 1 month ≈ 2.5×10⁶ s · 1M/day ≈ 12 QPS · peak = 2–3× avg
- Powers: K 10³ · M 10⁶ · B 10⁹ — write a×10ⁿ, add exponents, convert units (MB→GB→TB→PB per 10³)
- Latency: RAM 100µs · SSD 1ms · region hop 1ms · cross-continent RTT 150ms
- base62⁷ ≈ 3.5T codes · 6-char geohash ≈ 1km cell · WebSocket fleet: ~10⁵–10⁶ conns/server
- Escalation order: cache → replicas → shard → NoSQL-if-access-pattern-fits
- Queue defaults: at-least-once + idempotent consumer + DLQ
- Media default: pre-signed URL → blob store → CDN; DB = metadata only
- Contention default: atomic conditional update; watch for the hot row
- Always say: the trade-off, the failure mode, the conclusion from the number.

Good luck. Sleep > one more archetype.

---

# Part 7 — Additions: Decomposition, Kafka Internals, Resilience

(Gaps identified from the uploaded prep PDF, answered at interview depth.)

## 7.1 Functional decomposition (microservices & bounded contexts)

**Interview expectation:** break a complex system into independent services with clear ownership.

**The decomposition rules (how to derive boundaries, not memorize them):**
1. **One service = one bounded context** — a noun the business talks about (Cart, Order, Payment, Inventory), owning its data and its rules.
2. **A service owns its database.** No other service reads its tables directly — only its API or its events. (This is the line interviewers listen for.)
3. **Split where change-rates and scaling needs differ** — Product catalog (read-heavy, cacheable) vs Payment (transactional, audited) shouldn't deploy or scale together.
4. **Don't over-split.** "I'd start with these 6–8 services and split further only when a boundary proves itself" beats 20 nano-services — knowing when *not* to decompose is the senior signal.

**Canonical e-commerce decomposition** (memorize as a template):

| Service | Owns |
|---|---|
| User | Auth, profile, sessions |
| Product | Catalog, pricing, availability display |
| Cart | Add/remove, save-for-later, cart persistence |
| Inventory | Stock truth, reservation logic |
| Order | Order creation + lifecycle, payment coordination |
| Payment | Processing, refunds, transaction validation |
| Delivery | Shipment tracking, ETA, status events |
| Notification | Email/SMS/push (the fan from §3.8) |

**Sync vs async between services:** synchronous call (REST/gRPC) only when the caller needs the answer to proceed (Order → Payment authorization). Everything else is an event (OrderCreated → Inventory, Delivery, Notification react independently). Each sync call you add couples uptime: if A calls B calls C, your availability is the product of all three.

**The question hiding inside "Order Service coordinates payment" — distributed transactions.** You cannot wrap Order DB + Payment provider + Inventory DB in one ACID transaction. Two named answers:

- **Saga pattern:** the flow is a sequence of local transactions, each publishing an event that triggers the next; failures trigger **compensating actions** (payment failed → release inventory reservation → mark order failed). Choreography (services react to events) vs orchestration (an order-state-machine drives it) — for an interview, orchestrated saga in the Order service is the easier story to tell.
- **Outbox pattern** — answers "what if I write the order to my DB but crash before publishing OrderCreated?" Write the order row AND the event into an `outbox` table **in the same local transaction**; a relay process publishes outbox rows to Kafka and marks them sent. Now DB-write and event-publish can't disagree. (Pairs with at-least-once + idempotent consumers, as always.)

Notice Inventory's "reservation logic" is the Ticketmaster TTL-hold again (§3.4) — name the rhyme.

## 7.2 Kafka internals (the depth interviewers probe)

Vocabulary mapped to what it buys you:

| Concept | One-line interview answer |
|---|---|
| **Topic** | Logical event channel (order-events, payment-events) |
| **Partition** | Unit of parallelism AND of ordering — order is guaranteed only within a partition, so choose the partition key = the entity whose order matters (order_id, conversation_id) |
| **Producer** | Publishes; with `acks=all` waits for replicas → durability vs latency knob |
| **Consumer group** | Each partition is consumed by exactly one consumer in a group → load balancing; different groups each get the full stream → fan-out. Max useful consumers in a group = partition count |
| **Offset** | Consumer's bookmark; committing the offset *after* processing = at-least-once |
| **Rebalance** | Consumer joins/dies → partitions reassigned; processing pauses briefly — why consumers must be idempotent and fast to restart |

**Exactly-once in Kafka, honestly:** Kafka offers idempotent producers + transactions, which give exactly-once **within Kafka-to-Kafka pipelines**. The moment a consumer touches an external system (DB, payment API), you're back to effectively-once = at-least-once + idempotent writes. Saying this precisely is a strong signal; claiming "Kafka gives exactly-once everywhere" is a red flag.

**Retry architecture (the pattern the PDF names):** don't block a partition retrying one bad message in place. Failed message → **retry topic** (e.g. `orders-retry-5m`) consumed after a delay, with **exponential backoff + jitter** across retry tiers → after N attempts, → **DLQ** with alerting. A message that fails deterministically every time is a **poison message** — without the DLQ exit it would block its partition forever.

## 7.3 Reliability & resilience patterns

How systems survive their dependencies failing — the section that makes you sound like you've run production (you have; attach your war stories here).

**Circuit breaker.** Problem: Payment provider hangs; every order thread blocks 30s waiting; your thread pool exhausts; now *your* service is down too — a cascading failure. The breaker wraps the dependency and tracks failures:
- **Closed** (normal) → failures exceed threshold → **Open**: calls fail *fast immediately*, no waiting, dependency gets room to recover → after a cooldown, **Half-open**: let a few probe requests through → success closes it, failure reopens.
- Tools to name: Resilience4j (Hystrix is the legacy name). Sentence: "Failing fast is a feature — a 50ms error beats a 30s timeout, and it protects my thread pool."

**Always pair with timeouts + bounded retries:** every remote call gets a timeout; retries use exponential backoff **with jitter** (synchronized retries from thousands of clients are a self-inflicted thundering herd — same disease as the cache stampede); retry only idempotent operations.

**Bulkhead.** Isolate resource pools so one failing dependency can't sink the ship (named after ship compartments): separate thread pools/connection pools per downstream — if Delivery's API hangs, it exhausts only the delivery pool; checkout still works.

**Graceful degradation.** Decide *in advance* which features are load-shed first: recommendations service down → show bestsellers (static fallback); reviews down → render the product page without reviews; never let a nice-to-have block a must-have. Interview phrasing: "Core checkout path is protected; everything else degrades to cached or static fallbacks."

**Rate limiting — leaky bucket vs token bucket** (PDF names both): token bucket allows bursts up to capacity while enforcing an average (§2.5, the usual pick for user-facing APIs); **leaky bucket** drains at a perfectly constant rate — choose it when the *downstream* needs smooth, steady flow (e.g., feeding a fragile legacy system), at the cost of queueing/rejecting bursts.

**Vertical vs horizontal scaling, one line:** vertical (bigger machine) is the first, simplest step but has a ceiling and a single point of failure; horizontal (more machines) is unbounded but demands statelessness, load balancing, and partitioning — i.e., everything in this guide.

**Likely follow-ups for this part:** Where would you place circuit breakers in the e-commerce design (every cross-service sync call — especially Order → Payment)? How do you pick breaker thresholds (error rate + latency percentile over a window, tuned from real traffic)? What's the difference between retry storm and thundering herd (same shape: synchronized load spikes; jitter fixes both)? How does the saga handle a compensation that itself fails (retry with backoff → DLQ → manual ops queue — and design compensations to be idempotent)?
