# System Design Solutions

> Worked answers for every problem in [PROBLEM-BANK.md](PROBLEM-BANK.md), structured for learning.

This document has two parts:

1. **[Cheat Sheet](#cheat-sheet)** — a one-screen-per-category quick reference. For each problem: the single hardest decision, the partition/shard key, the primary data store, and the delivery/consistency model. Use this to review fast or to self-quiz.
2. **[Detailed Solutions](#detailed-solutions)** — each problem worked through the full interview framework: **Requirements → Estimation → API → Data Model → Architecture → Deep Dive → Trade-offs & Failure Modes**.

Every detailed answer follows the same skeleton so the *method* transfers, not the trivia:

- **Clarify** — functional + non-functional requirements, and the read/write ratio that drives everything.
- **Estimate** — DAU → QPS (with a peak factor), storage/year, bandwidth. Round aggressively; the order of magnitude is the point.
- **API** — the minimal set of endpoints. Shows what the data plane actually does.
- **Data model** — core entities, the access patterns, and the **shard key** (justified).
- **Architecture** — the full read path and write path, drawn in words.
- **Deep dive** — the one component that makes this problem distinct from its neighbors.
- **Trade-offs & failure modes** — the decision you'd defend, and how the system degrades when a dependency dies.

---

## Cheat Sheet

### 1. Starter classics

| Problem | Hardest decision | Shard/partition key | Primary store | Consistency / delivery |
|---|---|---|---|---|
| URL shortener | Key generation without collisions at redirect-latency budget | `short_code` (hash range) | KV (read replicas) + cache | Eventual on analytics; strong on create |
| Pastebin | Where large blobs live vs metadata; TTL expiry | `paste_id` | Object store (blob) + KV (meta) | Eventual; read-after-write on owner |
| Distributed ID generator | Monotonic-ish unique IDs without coordination | per-node (worker id) | none (in-memory) | Unique + roughly time-ordered |
| Rate limiter | Accuracy vs latency of distributed counters | `client_key` | Redis (counters) | Best-effort; allow small overcount |
| URL click analytics | Counting at scale without write hotspots | `short_code` + time bucket | Stream → OLAP/TSDB | Eventual, approximate OK |

### 2. Social and feed systems

| Problem | Hardest decision | Shard/partition key | Primary store | Consistency / delivery |
|---|---|---|---|---|
| Twitter/X timeline | Fan-out-on-write vs read; celebrity problem | tweets by `user_id`; timeline by `reader_id` | KV timeline cache + DB | Eventual; bounded staleness |
| Facebook news feed | Ranking + privacy filter at read time | `user_id` | Graph/edge store + feed cache | Eventual |
| Instagram feed | Media metadata vs blobs; write amplification | `user_id` | Metadata DB + object store + CDN | Eventual |
| Reddit / HN | Hot ranking + comment trees + vote counters | `post_id` (comments), `subreddit` | Relational + cache | Eventual on counts |
| Comment system | Tree storage + deep pagination | `post_id` | Relational (path/closure) | Read-your-writes for author |
| Like/reaction system | Idempotent counters on hot posts | `post_id` | KV counters + dedup set | Eventual; idempotent |
| Follow graph | High-degree nodes; fan-out trigger | `follower_id` and `followee_id` (both directions) | Graph/adjacency store | Eventual |

### 3. Real-time communication

| Problem | Hardest decision | Shard/partition key | Primary store | Consistency / delivery |
|---|---|---|---|---|
| 1:1 chat | Ordering + offline delivery + receipts | `conversation_id` | Append log + per-user inbox | At-least-once, ordered per convo |
| Group chat | Fan-out within room; membership | `room_id` | Append log per room | Ordered per room |
| Notification system | Multi-channel routing, retries, dedupe | `user_id` | Queue + DLQ + preferences DB | At-least-once, idempotent |
| Presence service | Heartbeat scale; staleness is acceptable | `user_id` | In-memory/Redis TTL | Eventual, best-effort |
| Collaborative editor | Conflict resolution (OT vs CRDT) | `doc_id` | Op log + snapshots | Strong convergence |
| Live comments / scores | Massive fan-out + backpressure | `channel_id` | Pub/sub + edge | At-most-once OK, drop on lag |

### 4. Media and content delivery

| Problem | Hardest decision | Shard/partition key | Primary store | Consistency / delivery |
|---|---|---|---|---|
| Image upload | Direct-to-storage upload + async processing | `image_id` / `user_id` | Object store + metadata DB + CDN | Eventual |
| YouTube / video | Transcoding pipeline + ABR delivery | `video_id` | Object store + CDN + metadata DB | Eventual |
| Netflix streaming | CDN placement + adaptive bitrate | `content_id` | CDN (edge) + catalog DB | Eventual; strong on entitlements |
| File sharing | Permissions + share links + versioning | `file_id` | Object store + ACL DB | Strong on ACL, eventual on content |
| Dropbox / file sync | Chunking + dedupe + conflict resolution | `user_id` / chunk hash | Chunk store + metadata DB | Causal; conflict copies |

### 5. Search, discovery, recommendation

| Problem | Hardest decision | Shard/partition key | Primary store | Consistency / delivery |
|---|---|---|---|---|
| Typeahead | Prefix lookup under tight latency | prefix shard | Trie/FST in memory | Eventual; freshness lag OK |
| Search engine | Inverted index build + ranking + freshness | term (index shard) | Inverted index + doc store | Eventual |
| Product search | Facets/filters + relevance | category/index shard | Search engine (ES-like) | Eventual |
| Recommendation feed | Offline features + online ranking + exploration | `user_id` | Feature store + model serving | Eventual |
| Trending topics | Approximate heavy hitters over windows | topic hash | Stream + sketches | Approximate, eventual |

### 6. Geo and location systems

| Problem | Hardest decision | Shard/partition key | Primary store | Consistency / delivery |
|---|---|---|---|---|
| Nearby restaurants | Spatial index choice (geohash/S2/quadtree) | geohash cell | Spatial index + cache | Eventual |
| Uber nearby drivers | High-rate location writes + stale reads | geohash cell / driver_id | In-memory geo index | Eventual, ~seconds stale |
| Delivery tracking | Streaming location fan-out + battery | `trip_id` | Stream + KV last-location | Eventual |
| Maps routing | Graph search + precompute + live traffic | region/tile | Graph + contraction hierarchies | Eventual on traffic |
| Geofencing | Detect entry/exit at scale; false positives | spatial partition | Spatial index + event stream | Eventual |

### 7. Correctness-critical systems

| Problem | Hardest decision | Shard/partition key | Primary store | Consistency / delivery |
|---|---|---|---|---|
| Payment processing | Idempotency + external PSP retries + reconciliation | `payment_id` / `user_id` | Relational (ACID) + outbox | Strong; exactly-once effect |
| Wallet | Double-entry ledger + holds | `account_id` | Relational ledger | Strong (serializable) |
| Stock trading | Deterministic matching + audit + latency | `symbol` | In-memory book + append log | Strong, ordered per symbol |
| Ticket booking | Oversell prevention + hold expiry | `event_id` / seat | Relational + locks/reservations | Strong on inventory |
| Hotel reservation | Availability holds + cancellation | `hotel_id` + date | Relational + inventory cache | Strong on inventory |
| E-commerce checkout | Saga across cart/inventory/payment | `order_id` | Relational + outbox/saga | Strong per step, eventual overall |
| Coupon/promo | Race conditions on limited redemptions | `coupon_id` | Relational + atomic decrement | Strong on counters |

### 8. Storage and infrastructure systems

| Problem | Hardest decision | Shard/partition key | Primary store | Consistency / delivery |
|---|---|---|---|---|
| Key-value store | Consistent hashing + quorum + conflicts | hashed key (ring) | LSM/SSTable nodes | Tunable (quorum) |
| Object store (S3) | Durability via erasure coding; listing | object key prefix | Chunk store + metadata service | Strong on PUT, list eventual |
| Distributed cache | Eviction + hot keys + stampede | hashed key (ring) | In-memory shards | Best-effort, eventual |
| CDN | Invalidation + origin shielding | content URL | Edge caches | Eventual (TTL) |
| API gateway | Auth + rate limit + routing at low latency | route/tenant | Config store + cache | Strong config, eventual metrics |
| Feature flag service | Low-latency reads + fast propagation | flag key | Config store + edge cache | Eventual (seconds) |
| Distributed lock | Leases + fencing tokens; split-brain | lock key | Consensus store (Raft) | Strong (linearizable) |
| Configuration service | Watches + versioning + safe rollout | config path | Consensus store + watch | Strong, versioned |

### 9. Data, logging, analytics

| Problem | Hardest decision | Shard/partition key | Primary store | Consistency / delivery |
|---|---|---|---|---|
| Logging pipeline | Ingest buffering + indexing + retention | service/time | Queue → index (ES) + cold store | At-least-once, sampled |
| Metrics/monitoring | Cardinality control + rollups | metric+labels hash | TSDB | Eventual, downsampled |
| Ad click aggregator | Dedupe + attribution windows + fraud | campaign/time | Stream + OLAP | Exactly-once-ish, eventual |
| Real-time dashboard | Streaming aggregation + backpressure | metric key | Stream + materialized views | Eventual, fresh seconds |
| Data warehouse ingest | Batch vs stream + schema evolution + replay | table/partition | Lakehouse/warehouse | Exactly-once batch |
| Web crawler | Frontier + politeness + dedupe | domain (host) | Frontier queue + doc store | Eventual |

### 10. Platform and scheduling systems

| Problem | Hardest decision | Shard/partition key | Primary store | Consistency / delivery |
|---|---|---|---|---|
| Job scheduler | Leases + retries + idempotent execution | job_id / queue | Queue + state DB | At-least-once, idempotent |
| Cron service | Leader election + missed-run handling | schedule_id | Consensus + state DB | At-least-once |
| Task queue | Visibility timeout + DLQ + ordering | queue/partition | Queue (SQS/Kafka) | At-least-once |
| CI/CD pipeline | Workflow DAG + worker isolation + artifacts | pipeline_id | State DB + object store | At-least-once steps |
| Code hosting | Git object storage + permissions + search | repo_id | Git object store + metadata DB | Strong on refs |
| Multi-tenant SaaS | Tenant isolation + noisy neighbors + quotas | tenant_id | Shared/siloed DB + quotas | Strong per tenant |

---

## Detailed Solutions

> Each section is a self-contained worked answer. Read the problem cold first, design for 35–45 minutes, then compare.


# 1. Starter classics

## 1.1 URL shortener

**Clarify.** Functional: shorten a long URL to a short code; redirect `short → long`; optional custom alias, expiry, click analytics. Non-functional: redirect p99 < 50 ms (it's in the user's click path), extremely read-heavy, ≥ 99.99% availability (a broken redirect breaks every shared link ever printed). Read:write ≈ **100:1**.

**Estimate (worked).**
```
Writes:  100M new URLs/day
         100,000,000 / 86,400 s  ≈ 1,160 writes/s
         peak ×3                 ≈ 3,500 writes/s
Reads:   100:1 ratio → 116k reads/s avg, peak ≈ 350k reads/s
Storage (5-year horizon):
         row ≈ short_code(8) + long_url(~200) + owner(8) + 2×timestamp(16) ≈ 500 bytes
         100M/day × 365 × 5 × 500 B ≈ 1.8 × 10^14 B ≈ 91 TB over 5 yr  (≈18 GB/yr)
Hot set: ~20% of links get ~80% of traffic → cache the hot ~few-GB in RAM easily
Key space: base62 (a–z A–Z 0–9), 7 chars = 62^7 ≈ 3.5 × 10^12 codes → decades of headroom
```
The numbers say: metadata is *tiny*, the system is *read-dominated*, so the design is "fast point-read + aggressive cache," not "clever storage."

**API.**
```http
POST /api/v1/urls
{ "long_url": "https://example.com/a/very/long/path?x=1", "custom_alias": null, "ttl_days": 365 }
→ 201 Created
{ "short_url": "https://sho.rt/9aB3xK2", "short_code": "9aB3xK2", "expires_at": "2027-06-13T00:00:00Z" }

GET /9aB3xK2
→ 302 Found
  Location: https://example.com/a/very/long/path?x=1
  Cache-Control: private, max-age=0          # 302 so each click hits us (analytics)

GET /api/v1/urls/9aB3xK2/stats   → 200 { "clicks": 41200, "last_24h": 980 }   # eventually consistent
```

**Data model.** Single point lookup by `short_code` → a **KV store** (DynamoDB / Cassandra / Redis-backed). Partition key = `short_code` (hashed → even spread, no hot shard).
```
Table: urls
  short_code   STRING   (partition key)   -- "9aB3xK2"
  long_url     STRING                     -- "https://example.com/..."
  owner_id     STRING                     -- "u_123"  (nullable for anon)
  created_at   TIMESTAMP
  expires_at   TIMESTAMP  (nullable)      -- TTL attribute; store auto-evicts on expiry
  custom       BOOL
Example item: {"short_code":"9aB3xK2","long_url":"https://example.com/a/very/long/path?x=1",
               "owner_id":"u_123","created_at":"2026-06-13T...","expires_at":"2027-06-13T...","custom":false}
```
Analytics is a *separate* table/pipeline (see 1.5) so counting never touches the redirect path.

**Architecture.**

```
WRITE (POST /urls):
  app server → next ID from local block [counter] → base62 → "9aB3xK2"
            → conditional PUT to KV (attribute_not_exists) → cache-set → return 201

READ (GET /9aB3xK2):
  client → CDN/LB → app server → Redis GET 9aB3xK2 ──hit──► 302 redirect  (p99 ~5ms)
                                      └──miss──► KV GetItem → Redis SET (ttl 1h) → 302 (~15ms)
                                      (async, fire-and-forget) → click event → Kafka → analytics
```

- *Write path, concrete:* the app server holds a pre-fetched block of IDs (say `4,000,000,000–4,000,000,999`) handed out by a central allocator. It takes the next, say `4,000,000,042`, base62-encodes it → `"9aB3xK2"`, does a **conditional** `PUT ... IF attribute_not_exists(short_code)`, caches it, returns. No collision check needed because the counter is globally unique. Custom alias = same `PUT` but the user-supplied code; the conditional fails with `409 Conflict` if taken.
- *Read path, concrete:* `GET /9aB3xK2` → Redis `GET` → on hit (the ~99% case) issue `302` immediately; on miss read KV, populate Redis with a 1-hour TTL, then `302`. The click event is published to Kafka *after* the response is sent, so analytics never adds latency.
- *301 vs 302:* use **302** (temporary) here so the browser re-requests every time and you keep counting clicks. `301` (permanent) is cached by the browser → fewer hops, lower latency/cost, but you lose per-click analytics. Pick based on whether analytics matters more than a few ms.

**Deep dive — key generation (the concrete mechanics).** Three candidate schemes, with the trade made explicit:

| Scheme | How | Collisions | Guessable? | Dedup identical URLs? |
|---|---|---|---|---|
| Random 7-char | pick random base62, `PUT if not exists`, retry on clash | rare, but must check | hard to guess | no |
| Hash(long_url) | `base62(md5(url))[:7]` | possible → rehash w/ salt | hard | yes (same url→same code) |
| **Counter + base62** | central allocator hands out blocks; encode the int | **none** | sequential (mitigate by encoding a multiplied/scrambled int) | no |

The counter approach is the usual pick: each app server leases a block of 1,000–1,000,000 IDs from a central sequence (a DB `SEQUENCE`, ZooKeeper, or a Snowflake-style service) and burns through them locally. **Zero per-write coordination, zero collision checks, monotonic.** Concrete worry: `4,000,000,042` → `"9aB3xK2"` is sequential, so a scraper could walk the space. Fix by encoding `id × large_prime mod 62^7` (a reversible scramble) or interleaving a few random bits, so codes look random while staying collision-free.

**Trade-offs & failure modes.**
- *Code gen:* counter (collision-free, sequential-unless-scrambled) vs hash (free dedup, needs collision handling).
- *Cache loss:* the hot path is ~99% Redis hits. If Redis dies, KV must absorb the full ~350k reads/s — either size the KV read replicas for that, or accept a **stampede** on cold keys and use **request coalescing** (single-flight: one miss fetches, concurrent misses wait). A viral link is a single hot key → it stays pinned in cache, so it's actually the *easy* case.
- *Abuse:* shorteners are spam magnets → rate-limit creates per IP/user (e.g. 100/hr anon), and check submitted URLs against a phishing/malware blocklist (Google Safe Browsing) before issuing a code.

## 1.2 Pastebin / code sharing

**Clarify.** Functional: store a blob of text/code, return a shareable link; support TTL/expiry, privacy (public/unlisted/private), syntax highlighting (client-side), optional edit. Non-functional: read-heavy but less skewed than a shortener (no single link goes globally viral the way a shortened URL does); pastes can be **large** (up to MBs), unlike a URL, so blob size — not lookup latency — is the dominant design force. Durability matters (people share important snippets), so the content store must be replicated. Read:write ≈ **10:1**.

**Estimate (worked).**
```
Writes:  10M pastes/day
         10,000,000 / 86,400 s   ≈ 116 writes/s
         peak ×3                 ≈ 350 writes/s
Reads:   10:1 ratio → 1,160 reads/s avg, peak ≈ 3,500 reads/s
Blob storage (1-year horizon):
         avg paste 10 KB, p99 ~1 MB
         10M/day × 365 × 10 KB   ≈ 3.65 × 10^13 B ≈ 36 TB/year of blob
Metadata storage (1-year):
         row ≈ paste_id(8) + owner(8) + content_ref(40) + hash(32) + 3×ts(24) + size(8) ≈ 130 B
         10M/day × 365 × 130 B   ≈ 4.7 × 10^11 B ≈ 0.47 TB/year of metadata
Bandwidth: peak 3,500 reads/s × 10 KB avg ≈ 35 MB/s origin egress (CDN absorbs public reads)
```
The numbers say: metadata is small and DB-friendly, but **36 TB/yr of variable-size blob does not belong inline in the metadata store** — split content into an object store and front public reads with a CDN.

**API.**
```http
POST /api/v1/pastes
{ "content": "def f():\n    return 42\n", "ttl_days": 30, "visibility": "unlisted", "syntax": "python" }
→ 201 Created
{ "paste_id": "p_7Qm2Zr", "url": "https://pst.io/p_7Qm2Zr", "expires_at": "2026-07-17T00:00:00Z" }

GET /api/v1/pastes/p_7Qm2Zr
→ 200 OK
{ "paste_id": "p_7Qm2Zr", "content": "def f():\n    return 42\n",
  "visibility": "unlisted", "syntax": "python", "size": 23, "created_at": "2026-06-17T..." }
→ 404 Not Found     # missing, or expired (lazy expiry treats expired as 404)
→ 403 Forbidden     # private paste, caller is not the owner

DELETE /api/v1/pastes/p_7Qm2Zr   → 204 No Content
```

**Data model.** Split metadata from content. Metadata in **PostgreSQL** (or a KV store); the actual text lives in **S3** (object store) referenced by `content_ref`. Partition/shard key = `paste_id` (point lookups only, even spread).
```
Table: pastes                       -- PostgreSQL
  paste_id     STRING   (PK, shard key)   -- "p_7Qm2Zr"
  owner_id     STRING                     -- "u_123" (nullable for anon)
  visibility   ENUM(public,unlisted,private)
  syntax       STRING                     -- "python"
  size         INT                        -- bytes, for quota/validation
  content_ref  STRING                     -- "s3://pastes/ab/cd/abcd...e9f"
  content_hash STRING                     -- sha256, for dedupe
  created_at   TIMESTAMP
  updated_at   TIMESTAMP
  expires_at   TIMESTAMP (nullable)
Example row: {"paste_id":"p_7Qm2Zr","owner_id":"u_123","visibility":"unlisted","syntax":"python",
              "size":23,"content_ref":"s3://pastes/9f/3a/9f3a...c1","content_hash":"9f3a...c1",
              "created_at":"2026-06-17T...","updated_at":"2026-06-17T...","expires_at":"2026-07-17T..."}

Object store (S3): key = sha256(content)  -- content-addressed → automatic dedupe
```
Shard by `paste_id` because every access is a point lookup by id (no range scans), so a hashed id spreads load evenly and avoids hot shards. Content-addressing the S3 key by `content_hash` means identical pastes share one blob.

**Architecture.**

```
WRITE (POST /pastes):
  client → LB → app server → validate size (≤ cap) → sha256(content)
            → S3 PutObject (key = hash; skip if exists → dedupe)
            → INSERT metadata row (content_ref = s3://.../hash) → return 201 + paste_id

READ (GET /pastes/{id}):
  public:   client → CDN ──hit──► blob (origin untouched)
                          └─miss─► app server → PG SELECT (cached) → S3 GetObject → fill CDN → 200
  private:  client → LB → app server → PG SELECT → authz check → S3 GetObject → 200
```

- *Write path, concrete:* a paste with body `"def f():\n    return 42\n"` is validated against the size cap, hashed to `sha256 = 9f3a...c1`, and written to S3 at key `9f3a...c1` (the `PutObject` is skipped if that key already exists — free dedupe). The app server then `INSERT`s a metadata row in PostgreSQL with `content_ref = s3://pastes/9f/3a/9f3a...c1`. The `paste_id` `p_7Qm2Zr` is minted exactly like the shortener's short code (a leased counter block, base62-encoded; long-random for private/unlisted so the id isn't guessable). Returns `201`.
- *Read path, concrete:* `GET /pastes/p_7Qm2Zr` for a **public** paste is served straight from the CDN edge; on a CDN miss the app server reads the (Redis-cached) metadata row, fetches the blob from S3, populates the CDN, and returns `200`. For an **unlisted** paste the id itself is the secret — there's no listing endpoint, but anyone with the link can read it. For a **private** paste the app server enforces an ownership check before the S3 fetch and returns `403` otherwise.
- *Expiry, concrete:* `expires_at` drives a **lazy check at read time** (a paste past its TTL is treated as `404` even before deletion) combined with an **S3 lifecycle rule** that auto-deletes objects after N days, so there's no expensive scanning job. A background sweeper reclaims orphaned metadata rows.

**Deep dive — large-blob storage & TTL.** Storing MB-sized text inline in PostgreSQL bloats the buffer pool: a few large rows evict thousands of small hot rows, wrecking cache hit rate and slowing every query, and TOAST/overflow pages add I/O. Keeping only a ~130-byte metadata row in the DB and pushing the blob to S3 keeps the working set tiny and lets the metadata table stay fully cacheable. Concrete sizing: 36 TB/yr of blob in S3 costs a fraction of the same data on provisioned DB storage, and S3 gives 11-nines durability for free.

| TTL approach | Mechanism | Cost | Correctness | Storage reclaim |
|---|---|---|---|---|
| **Lazy expiry** | check `expires_at` on read, return 404 if past | ~zero | correct on read | none (blob lingers) |
| Background sweeper | periodic scan for `expires_at < now`, delete | scan cost | correct, delayed | yes, but expensive at scale |
| **S3 lifecycle rule** | object store auto-deletes after N days | zero (provider-run) | reclaims storage | yes |

Production answer: lazy expiry for correctness on the read path + S3 lifecycle rules for storage reclaim, avoiding a costly scanner entirely. Dedupe via `content_hash` saves storage whenever the same snippet (e.g. a popular stack-trace or config) is pasted repeatedly.

**Trade-offs & failure modes.**
- *Inline-in-DB vs blob-in-object-store:* inline is one round trip and simpler, but blob-in-S3 is the right call once content size is unbounded — the defended decision is splitting metadata from content, trading a second hop for a cacheable DB and cheap durable storage.
- *Privacy:* "unlisted" relies entirely on an unguessable id, so private/unlisted pastes must use a **long random id**, not a sequential counter, or a scraper walks the space (the same scramble concern as 1.1, but here it's a security boundary).
- *Object store down:* if S3 is briefly unavailable, metadata reads still succeed but the content fetch fails — return a retryable `503` (with `Retry-After`), not a `404`, so clients don't treat a transient outage as a deleted paste.
- *Hot public paste:* a paste that gets shared widely is absorbed entirely by the CDN edge, so the origin and DB are untouched — the CDN is the mitigation, not a problem.

## 1.3 Distributed ID generator

**Clarify.** Functional: generate unique 64-bit IDs across many machines, ideally **roughly time-sortable** (so IDs double as a rough creation order and as good DB primary keys — sequential inserts keep a B-tree dense). Non-functional: very high throughput, low latency (often called inline before every insert), no single point of failure, no per-ID network coordination. This is a pure-write service (every call mints an ID); there's no read path to speak of, so throughput and coordination-freedom drive the design.

**Estimate (worked).**
```
Target:  1M IDs/s aggregate across the fleet
Snowflake per-node ceiling:
         12 sequence bits = 2^12 = 4,096 IDs per millisecond per node
         4,096 IDs/ms × 1,000 ms/s = 4,096,000 ≈ 4M IDs/s per node
Nodes needed: 1M/s ÷ 4M/s/node = 1 node (round up; run ≥3 for HA)
Node ceiling: 10 machine-id bits = 2^10 = 1,024 distinct nodes max
Lifespan:    41 timestamp bits = 2^41 ms ≈ 6.97×10^13 ms ≈ 69.7 years from custom epoch
Coordination: machine-id assigned ONCE at startup → zero per-ID network calls
```
The numbers say: a single Snowflake node already exceeds 1M/s by 4×, so throughput is trivially met locally — the entire problem reduces to **assigning a unique machine id and trusting a monotonic clock**, with no per-ID coordination.

**API.** This is a library or a sidecar RPC, not a public HTTP API; the call is local and must add microseconds, not milliseconds.
```http
POST /id/next            # sidecar variant; usually an in-process library call
→ 200 OK
{ "id": 1834567890123456789 }     # 64-bit int, time-sortable

POST /id/batch
{ "count": 1000 }
→ 200 OK
{ "ids": [1834567890123456789, 1834567890123456790, ...] }   # contiguous block, one round trip
```

**Data model.** Snowflake IDs are **stateless to generate** — there's no per-ID storage. The only persisted state is the machine-id lease, kept in a coordination store.
```
64-bit Snowflake layout:
  [ 1 bit unused | 41 bits timestamp(ms) | 10 bits machine_id | 12 bits sequence ]
   sign=0          ms since custom epoch    0–1023             0–4095 within the ms

Coordination store (etcd / ZooKeeper):  -- only state in the system
  Key:  /id-gen/workers/{machine_id}     (machine_id = partition key)
  Val:  { "host": "id-gen-7", "leased_at": "2026-06-17T...", "lease_ttl_s": 30 }
Example ID 1834567890123456789 decodes →
  ts=1718600000000ms (2026-06-17T...), machine_id=42, sequence=17
```
Use **etcd** for worker-id leasing: the key is `machine_id` itself, so the store enforces uniqueness (a node can't lease an id another node holds). The lease is renewed with a TTL so a dead node's id is reclaimed. No data is sharded because IDs aren't stored — the only "shard key" is the machine id partitioning the 10-bit space across nodes.

**Architecture.**

```
STARTUP (once per node):
  node → etcd compare-and-swap lease /id-gen/workers/{free_id} → machine_id = 42
       → renew lease every 10s (TTL 30s); on loss, stop issuing

GENERATE (per ID, all local, no network):
  now = clock_ms()
  if now == last_ms:   seq++  ; if seq > 4095 → spin-wait until next ms, seq = 0
  if now <  last_ms:   clock went backward → BLOCK until now ≥ last_ms (fail closed)
  if now >  last_ms:   seq = 0
  id = (now - EPOCH)<<22 | machine_id<<12 | seq ; last_ms = now ; return id
```

- *Startup, concrete:* node `id-gen-7` boots, does a compare-and-swap against etcd to claim the first free key under `/id-gen/workers/`, gets `machine_id = 42`, and starts a 10-second lease-renewal loop (TTL 30s). If it ever fails to renew, it **stops issuing** rather than risk two nodes sharing id 42.
- *Generate, concrete:* a call at `ts=1718600000000ms` with the node's `last_ms` equal to that millisecond increments the sequence to `17`; the ID is assembled as `((1718600000000 - EPOCH) << 22) | (42 << 12) | 17 = 1834567890123456789`. Entirely CPU-local — no etcd, no DB, no network — so it's sub-microsecond.
- *Throughput, concrete:* if the 4,096 sequence slots in one millisecond are exhausted, the generator **spin-waits to the next millisecond** and resets the sequence to 0, capping a single node at ~4M IDs/s.

**Deep dive — clock drift & the Snowflake corner cases.** Snowflake's correctness depends on a **monotonic clock per node**. If NTP steps the clock *backward* (e.g. a correction after drift), a node could re-enter a millisecond it already used and mint a duplicate ID.

| ID scheme | Coordination | Sortable? | Size | Index-friendly? | Failure risk |
|---|---|---|---|---|---|
| UUIDv4 (random) | none | **no** | 128-bit | poor (random inserts fragment B-tree) | none, but unsortable |
| DB auto-increment | central DB per ID | yes | 64-bit | excellent | SPOF + bottleneck |
| Ticket/range alloc | central DB per *block* | roughly | 64-bit | good | allocator dependency |
| **Snowflake** | machine-id once | yes (time) | 64-bit | excellent | clock drift / id reuse |

Handle the corner cases concretely: when `now < last_timestamp`, **refuse to generate** (block briefly) until the clock catches up, or read from a monotonic clock source that never goes backward. Exhausting 4,096 sequence values in one ms → spin-wait to the next ms. Machine-id assignment must be globally unique → lease via etcd/ZooKeeper on startup, or derive from a stable host identifier (e.g. a Kubernetes ordinal) if you can guarantee no reuse.

**Trade-offs & failure modes.**
- *Snowflake vs UUID:* Snowflake is sortable, compact (64-bit), and coordination-free after startup; UUIDv4 is truly zero-setup but unsortable and index-hostile. The defended decision is Snowflake — paying a small clock-synchronization dependency to get sortable, index-dense primary keys.
- *Clock badly wrong:* if a node's clock is far ahead, it burns future timestamp space (mostly harmless); if behind, it must **fail closed** (stop issuing) rather than risk duplicates — availability of one node is sacrificed for correctness.
- *etcd unreachable at startup:* a fresh node can't lease a machine id and must not boot into service (else it might collide); already-running nodes keep generating on their existing lease until TTL forces a renewal.
- *Worker-id exhaustion:* more than 1,024 nodes overflows the 10-bit machine-id field → re-partition the bit layout (e.g. steal bits from the sequence field, trading per-node throughput for more nodes).

## 1.4 Rate limiter

**Clarify.** Functional: limit a client (keyed by API key, user, or IP) to N requests per window; return `429 Too Many Requests` with a `Retry-After` header when exceeded; expose remaining quota. Non-functional: must add **minimal latency** (it sits in front of every request, so it's pure overhead), be accurate enough (small overcounting is usually tolerable for soft limits, not for billing/abuse), and work across many distributed gateway nodes that don't share memory. Effectively all-write: every request performs a counter read-modify-write, so the limiter's own throughput equals the gateway's full request rate.

**Estimate (worked).**
```
Gateway traffic: 350k req/s at peak
Limiter ops:     1 counter read+increment PER request
                 → 350,000 atomic ops/s against the counter store
Latency budget:  redirect/API p99 is ~50ms; limiter must add ≪1ms
                 → counter store must be in-memory (Redis ~0.2ms RTT) or node-local
Memory (Redis):  active clients ~10M keys
                 token-bucket state ≈ key(40B) + tokens(8B) + last_refill_ts(8B) ≈ 60 B
                 10M × 60 B ≈ 600 MB → fits comfortably in one Redis node's RAM
Hot key risk:    one abusive client = one Redis key getting thousands of ops/s
```
The numbers say: 350k atomic ops/s with a sub-millisecond budget forces an **in-memory counter store (Redis)**, and the only real scaling worry is a single hot key — not total volume or memory.

**API.** The limiter is middleware, not a user-facing endpoint; its contract is the headers and status it adds to every proxied request.
```http
GET /api/v1/anything                       # any protected request
Headers (on allow) → 200 OK
  X-RateLimit-Limit: 1000
  X-RateLimit-Remaining: 742
  X-RateLimit-Reset: 1718600060

Headers (on deny) → 429 Too Many Requests
  Retry-After: 12                           # seconds until tokens available
  X-RateLimit-Remaining: 0
```

**Data model.** Centralized counters in **Redis**, one key per client, holding token-bucket state. Key/shard = the client identifier (hashed across the Redis cluster → spreads distinct clients evenly).
```
Redis key:  ratelimit:{client_id}            (client_id = shard key)
Value (hash, token bucket):
  tokens          FLOAT     -- current tokens available, e.g. 742.0
  last_refill_ms  INT       -- ms timestamp of last refill, e.g. 1718600048000
TTL on key: window length (auto-evict idle clients, reclaim memory)
Example item: ratelimit:apikey_8842 → { tokens: 742.0, last_refill_ms: 1718600048000 }
  bucket params: capacity b = 1000, refill rate r = 1000 tokens / 60s ≈ 16.7 tok/s
```
Shard by `client_id` so distinct clients land on different Redis nodes and one client's traffic can't hot-spot the whole cluster — though a single very hot client still concentrates on one node (mitigated below).

**Architecture.**

```
PER REQUEST (token bucket, atomic):
  gateway node → Redis EVAL (Lua script, atomic):
      now = redis.time()
      refill = (now - last_refill_ms) * r        -- tokens accrued since last call
      tokens = min(capacity, tokens + refill)
      if tokens >= 1:  tokens -= 1 ; allowed = true
      else:            allowed = false ; retry_after = (1 - tokens) / r
      write {tokens, last_refill_ms = now}
   → allowed ? forward request : 429 + Retry-After

HIGH-SCALE VARIANT (local + global):
  gateway node → local token bucket (slice of global budget) ──has tokens──► forward
                       └── slice empty ──► Redis (refill slice) → periodic reconcile
```

- *Per-request, concrete:* a request from `apikey_8842` triggers a Redis `EVAL` of a Lua script. Say the bucket last refilled 6 seconds ago at 736 tokens: refill = `6 × 16.7 ≈ 100` tokens → `min(1000, 836) = 836`, decrement to `835`, write back, allow. The **entire read-refill-decrement-write is one atomic Lua call**, so two gateway nodes hitting the same key can't race past the limit.
- *Denial, concrete:* if `tokens` is `0.4`, the request is denied with `429` and `Retry-After = (1 - 0.4) / 16.7 ≈ 0.04s` rounded up — telling the client exactly when a token will be available.
- *High-scale variant, concrete:* at 350k req/s a Redis hop per request can dominate latency, so each gateway node leases a **local slice** of the global budget (e.g. 1/N of the tokens) and serves most requests from a node-local bucket, only calling Redis to refill its slice and reconcile periodically — trading exactness (slight global overshoot) for eliminating the per-request network hop.

**Deep dive — distributed accuracy vs latency.** The core tension: a single shared Redis counter is accurate but adds a network hop and creates a hot key; per-node local buckets are fast but can overshoot the global limit by up to `nodes × local_burst`.

| Algorithm | State | Accuracy | Cost | Bursts |
|---|---|---|---|---|
| Fixed window | one counter per (key, window) | allows 2× burst at window edges | cheapest | edge spikes |
| Sliding window log | timestamp per request | exact | memory-heavy | none |
| Sliding window counter | current + previous window, weighted | good approximation | cheap | smoothed |
| **Token bucket** | tokens + last_refill | good; allows controlled burst | cheap (2 fields) | up to `b`, then rate `r` |
| Leaky bucket | queue draining at fixed rate | exact output rate | queue memory | none |

Practical answer: **Redis + atomic Lua token bucket** for correctness-sensitive limits (billing, abuse) where overcounting is dangerous; **per-node local buckets with periodic sync** for high-throughput soft limits where a few percent overshoot is fine. Shard the Redis keyspace by client so one hot client doesn't hot-spot a single node; for a single genuinely hot key, fall back to per-node allocation so the load is spread across gateways instead of one Redis shard.

**Trade-offs & failure modes.**
- *Token bucket vs sliding window:* token bucket allows controlled bursts up to `b` then smooths to `r`; sliding window enforces a strict per-window count. The defended decision is token bucket for its burst flexibility and 2-field cheapness.
- *Accuracy vs latency:* the central trade-off — decide per limit type based on whether overcounting is dangerous (billing/abuse → exact/Redis; soft API limits → local buckets).
- *Redis down — fail open or closed?* failing **open** (allow traffic) preserves availability but removes protection; failing **closed** (deny) protects backends but causes an outage. Usually fail open for general limits, **fail closed for abuse/security limits** where letting traffic through is worse than rejecting it.
- *Hot key:* one abusive client hammering a single Redis key concentrates ops on one shard → mitigate with per-node local buckets for that client, or a small client-side cache of the deny decision so repeated requests from a blocked client don't all hit Redis.

## 1.5 Tiny analytics for URL clicks

**Clarify.** Functional: count clicks per short URL, with breakdowns (time, geo, referrer, device); show totals and time series to owners. Non-functional: **must not slow the redirect** (it's off the critical path), can be eventually consistent and approximate (a count that's a few seconds stale or ~2% off is fine), write-heavy (every click is a write), read-light (owners check stats occasionally). Write:read ≈ **1000:1** — the inverse of the shortener, and the reason the whole pipeline is async.

**Estimate (worked).**
```
Writes:  from the shortener, ~350k clicks/s at peak
         → 350k analytics events/s to ingest (one per click)
         far too much for synchronous per-click DB increments, esp. on hot URLs
Hot key: a viral link = ONE short_code getting thousands of clicks/s
         → a single counter row would serialize all those writes
Raw event storage (kept 30 days):
         event ≈ code(8) + ts(8) + geo(4) + referrer(64) + device(16) ≈ 100 B
         350k/s × 86,400 s/day × 30 × 100 B ≈ 9.07 × 10^16 B ≈ 90 PB raw  → sample or expire fast
Rollup storage (pre-aggregated, kept 1 yr):
         (code, hour_bucket, counters) ≈ 50 B; 100M codes × 24 buckets/day × 365 × 50 B
         ≈ 4.4 × 10^13 B ≈ 44 TB/yr  → tiny vs raw
```
The numbers say: raw events at 350k/s are too large and too hot to store-and-count synchronously, so the design must **decouple ingestion via a log, pre-aggregate in a stream layer, and serve from compact rollups** — exact-per-click counting is neither affordable nor necessary.

**API.**
```http
# internal: the redirect handler emits a click event asynchronously (fire-and-forget after the 302)
POST (internal) → Kafka topic "clicks"
{ "code": "9aB3xK2", "ts": 1718600048123, "geo": "US-CA", "referrer": "twitter.com", "device": "ios" }

# owner-facing stats query
GET /api/v1/urls/9aB3xK2/stats?from=2026-06-10&to=2026-06-17&groupby=day
→ 200 OK
{ "code": "9aB3xK2", "total": 41200, "series": [
    { "bucket": "2026-06-16", "clicks": 980, "unique": 845 },
    { "bucket": "2026-06-17", "clicks": 1203, "unique": 1010 } ] }   # eventually consistent
```

**Data model.** Raw events land in an append-only **log (Kafka)**; aggregates live in a **time-series / OLAP store** (ClickHouse / Cassandra) keyed by `(code, time_bucket)` with pre-rolled counters. Partition key = `code`, clustering/sort key = `time_bucket`.
```
Kafka topic: clicks  (partitioned by code → all events for a hot link land in order on one partition)
  { code, ts, geo, referrer, device, event_id }   -- event_id for dedupe

Table: click_rollups                 -- ClickHouse / Cassandra
  code        STRING    (partition key)   -- "9aB3xK2"
  time_bucket TIMESTAMP (clustering key)  -- hour or day granularity, e.g. "2026-06-17T14:00Z"
  clicks      COUNTER                     -- pre-aggregated count, e.g. 1203
  unique_hll  BLOB                        -- HyperLogLog sketch for approx unique visitors
  by_geo      MAP<STRING,INT>             -- {"US-CA":420,"GB":110,...}
  by_referrer MAP<STRING,INT>
Example row: {"code":"9aB3xK2","time_bucket":"2026-06-17T14:00Z","clicks":1203,
              "unique_hll":<sketch>,"by_geo":{"US-CA":420,...},"by_referrer":{"twitter.com":600,...}}
```
Partition by `code` + cluster by `time_bucket` so a stats query for one link over a date range is a single contiguous partition scan, and writes for different links spread across partitions.

**Architecture.**

```
INGEST (off the redirect critical path):
  redirect handler → 302 to user (returns immediately)
                  └─ async, fire-and-forget → Kafka topic "clicks"   (redirect latency unaffected)

PROCESS:
  stream processor (Flink/Kafka Streams) consumes "clicks"
    → batches events per (code, time_bucket) over a short window (e.g. 5s)
    → one rollup write per batch: clicks += N, update HLL, merge by_geo
    → ClickHouse / Cassandra

SERVE:
  owner → GET /stats → read pre-aggregated rollups (point/range read, fast) → 200
```

- *Ingest, concrete:* a click on `9aB3xK2` makes the redirect handler issue the `302` first, then fire a non-blocking event `{code:"9aB3xK2", ts:..., geo:"US-CA", referrer:"twitter.com"}` to the Kafka `clicks` topic. The redirect has already returned, so analytics adds **zero latency** to the user's click.
- *Process, concrete:* a Flink job consumes the topic, and over a 5-second window batches all events for `(9aB3xK2, 2026-06-17T14:00Z)` — say 6,000 clicks — into **one** rollup write: `clicks += 6000`, feed each visitor id into the partition's HyperLogLog sketch, merge the per-geo map. One DB write absorbs thousands of clicks.
- *Serve, concrete:* an owner's `GET /stats?groupby=day` reads the pre-aggregated `click_rollups` partition for `9aB3xK2` over the date range — a fast contiguous scan of ~7 day-buckets — instead of scanning millions of raw events.
- *Hot keys, concrete:* a viral link concentrates writes on one counter; pre-aggregation in the stream layer (one write per 5s batch instead of per click) plus **sharded counters** (N sub-counters `code#0..code#N` summed at read time) keep even a single hot link from serializing writes.

**Deep dive — counting at scale without hotspots.** Never run `UPDATE counter WHERE code = '9aB3xK2'` synchronously per click — at thousands of clicks/s on a viral link, every write serializes on one row and the redirect path (if it waited) would stall.

| Need | Naive approach | Scalable approach | Cost / error |
|---|---|---|---|
| Total clicks | per-click `UPDATE` on one row | stream-batch into rollups (one write / window) | exact, seconds stale |
| Unique visitors | store + dedupe every visitor id | **HyperLogLog** sketch | ~2% error, ~12 KB/sketch |
| Top-N links | sort all counters | **Count-Min Sketch** / heavy-hitters | small error, tiny memory |

Concretely: (1) the stream processor batches so one DB write covers many clicks; (2) for unique-visitor counts, a HyperLogLog sketch counts millions of uniques in ~12 KB at ~2% error instead of storing every visitor id; (3) for "top URLs," a Count-Min Sketch tracks heavy hitters in fixed memory. Approximation is acceptable for analytics and buys enormous efficiency.

**Trade-offs & failure modes.**
- *Exact vs approximate:* exact counts need dedupe + ordered processing and are expensive; approximate (HLL/sketches) is cheap and eventually consistent. The defended decision is approximate — analytics almost always tolerates ~2% error.
- *Async lag:* stats lag reality by seconds to minutes because of the batch window; that's acceptable for an owner dashboard and is the price of keeping the redirect fast.
- *Queue backs up:* if Kafka or the stream processor falls behind, **redirects are completely unaffected** (they only fire-and-forget) — the backlog is processed later and stats catch up. Graceful degradation by design.
- *Hot key:* a single viral `code` is the worst case for counting → mitigated by stream-layer pre-aggregation and sharded counters summed at read time, so no single row absorbs thousands of writes/s.
- *Duplicate/lost events:* fire-and-forget can drop or double-send; carry an `event_id` and dedupe in the processor when approximate-but-not-wildly-off matters, accepting that a few lost clicks don't change the picture.

# 2. Social and feed systems

## 2.1 Twitter/X timeline

**Clarify.** Functional: post a tweet; follow users; view a **home timeline** of tweets from people you follow (reverse-chron or ranked). Non-functional: eventual consistency is fine (a tweet appearing a few seconds late is acceptable), home-timeline read p99 < 200 ms, ≥ 99.9% availability. The defining challenge is **fan-out**: one write must reach all of an author's followers' timelines. Read:write ≈ **20:1** at the tweet level, but fan-out inverts that into a write-amplified system.

**Estimate (worked).**
```
Users:   500M total, 200M DAU
Reads:   each DAU opens timeline ~20×/day
         200M × 20 = 4B timeline reads/day
         4,000,000,000 / 86,400 ≈ 46k reads/s
         peak ×3                ≈ 140k reads/s
Writes:  200M tweets/day
         200,000,000 / 86,400  ≈ 2,300 tweets/s
         peak ×3               ≈ 7,000 tweets/s
Fan-out: avg 200 followers/author
         200M tweets × 200 = 40B timeline inserts/day
         40,000,000,000 / 86,400 ≈ 460k inserts/s
         peak ×3                 ≈ 1.4M timeline inserts/s
Storage: tweet row ≈ id(8) + author(8) + text(280) + ts(8) ≈ 300 bytes
         200M/day × 365 × 300 B ≈ 22 TB/year of tweet text
Timeline cache: 200M users × 800 cached ids × 8 B ≈ 1.3 TB in Redis
```
The numbers say: tweet storage is small; the cost is the **460k–1.4M timeline inserts/s** from fan-out, which is why celebrities cannot be fanned out and reads must come from a precomputed cache.

**API.**
```http
POST /api/v1/tweets
{ "text": "shipped 2.1", "media_ids": [] }
→ 201 Created
{ "tweet_id": "1740000000000000042", "created_at": "2026-06-17T12:00:00Z" }

GET /api/v1/timeline?cursor=1739999999999999999&limit=50
→ 200 OK
{ "tweets": [ { "tweet_id": "1740000000000000042", "author_id": "u_88", "text": "shipped 2.1", "created_at": "..." } ],
  "next_cursor": "1739999999999990000" }

POST /api/v1/follow
{ "target_user_id": "u_88" }
→ 204 No Content
```

**Data model.** Tweets are an append-only log keyed by a time-sortable id; home timelines are precomputed per-reader id lists in **Redis**; the social graph and tweet bodies live in **Cassandra**.
```
Table: tweets                       (Cassandra)
  tweet_id   BIGINT  (partition key) -- Snowflake, time-sortable: 1740000000000000042
  author_id  BIGINT                  -- 88
  text       TEXT                    -- "shipped 2.1"
  media_ids  LIST<BIGINT>
  created_at TIMESTAMP
Example row: {tweet_id:1740000000000000042, author_id:88, text:"shipped 2.1", created_at:"2026-06-17T12:00:00Z"}

Structure: home_timeline                (Redis sorted set, key = "tl:{reader_id}")
  member = tweet_id, score = tweet_id   -- ZREVRANGEBYSCORE for cursor paging, capped at ~800
Example: ZADD tl:u_42 1740000000000000042 1740000000000000042
```
Partition key = `tweet_id` (hashed → even spread across the ring; no hot author shard). Timeline key = `reader_id` so each user's feed is a single Redis node lookup.

**Architecture.**

```
WRITE (POST /tweets):
  client → app → INSERT tweets[tweet_id] (Cassandra)
              → lookup followers[author] 
              → if author NOT celebrity: enqueue fan-out job → Kafka
                   fan-out workers: for each follower f → ZADD tl:{f} tweet_id (Redis)
              → if author IS celebrity: skip fan-out (read-time merge)

READ (GET /timeline):
  client → app → ZREVRANGEBYSCORE tl:{reader} (Redis)  ← precomputed push list
              → merge recent tweets of followed celebrities (pull, Cassandra)
              → hydrate tweet bodies (Cassandra / cache) → 200
```

Concrete trace: user `u_88` (1,200 followers, normal) tweets `1740000000000000042`. The app writes the row to Cassandra, reads `followers[88]`, and publishes one fan-out message to Kafka. Workers issue 1,200 `ZADD tl:{follower} 1740000000000000042` calls. When follower `u_42` opens their timeline, the app does one `ZREVRANGEBYSCORE tl:u_42` returning ~50 ids, merges in recent tweets from the 3 celebrities `u_42` follows (a small Cassandra range read per celebrity), hydrates bodies, and returns. If `u_88` were a celebrity, the write would skip fan-out entirely and `u_88`'s tweet would only enter `u_42`'s view via the read-time merge.

**Deep dive — fan-out: push vs pull, and the celebrity problem.**

| Approach | Write cost | Read cost | Best for |
|---|---|---|---|
| Fan-out-on-write (push) | O(followers) inserts/tweet | O(1) — read your list | normal users (<~50k followers) |
| Fan-out-on-read (pull) | O(1) — store tweet only | O(followees) scatter-gather | high-follower authors |
| **Hybrid (the answer)** | push for normal, **skip for celebrities** | push list + small celebrity merge | everyone |

A celebrity with 100M followers would generate 100M `ZADD`s per tweet — at peak that single event dwarfs the entire 1.4M/s baseline and arrives in a burst. So accounts above a threshold (say 100k followers) are flagged `pull`. A reader's timeline = `merge(ZREVRANGEBYSCORE tl:{reader}, recent_tweets_of_followed_celebrities)`. The push list is already small and cached; each reader follows only a handful of celebrities, so the merge reads a few short Cassandra partitions. This bounds write amplification (no celebrity fan-out) while keeping the read merge tiny.

**Trade-offs & failure modes.**
- *The decision:* hybrid fan-out, routed per author popularity — push gives fast reads for the common case, pull caps cost for super-nodes.
- *Inactive followers:* don't `ZADD` into timelines of users dormant for months; rebuild their list on demand at next login (pull) to avoid wasting 1.4M/s of writes on feeds nobody reads.
- *Timeline cache loss:* if a Redis shard dies, rebuild lazily — on read, fall back to pulling recent tweets from followees and merging. Degraded latency (~hundreds of ms), not an outage.
- *Fan-out lag:* Kafka backlog during a spike means a tweet lands in some timelines seconds late. Acceptable; eventual consistency is in scope.

## 2.2 Facebook news feed

**Clarify.** Functional: a feed of posts from friends and followed pages, **ML-ranked** (not pure reverse-chron), with **privacy filtering** (never show a post the viewer isn't permitted to see). Non-functional: read-heavy, ranking-driven, eventual consistency OK for content, but privacy must be **correct on every read**. Differs from Twitter: a bidirectional friend graph, heavier per-read ranking CPU, and strict audience rules. Read:write ≈ **50:1**.

**Estimate (worked).**
```
Users:   2B DAU
Reads:   each DAU opens feed ~15×/day
         2B × 15 = 30B feed reads/day
         30,000,000,000 / 86,400 ≈ 347k reads/s
         peak ×3                 ≈ 1.0M reads/s
Writes:  ~1B posts+shares/day
         1,000,000,000 / 86,400 ≈ 11.6k writes/s, peak ≈ 35k/s
Ranking: per read, score ~500 candidates with an ML model
         1.0M reads/s × 500 = 500M scorings/s at peak across the ranking fleet
Storage: post row ≈ 1 KB (text + audience + refs)
         1B/day × 365 × 1 KB ≈ 365 TB/year metadata
```
The numbers say: ranking CPU, not storage, is the cost center (500M scorings/s), and privacy filtering must run per read — so you cache **candidate pools and features**, never the final ordered feed.

**API.**
```http
POST /api/v1/posts
{ "content": "hello", "audience": "friends" }      // friends | public | custom:list_id
→ 201 Created
{ "post_id": "p_9001", "created_at": "2026-06-17T12:00:00Z" }

GET /api/v1/feed?cursor=eyJyYW5rIjowLjcxfQ&limit=25
→ 200 OK
{ "items": [ { "post_id": "p_9001", "author_id": "u_5", "rank_score": 0.84, "content": "hello" } ],
  "next_cursor": "eyJyYW5rIjowLjcxfQ" }
```

**Data model.** Posts and the friend graph in **Cassandra**; ranking features in a **feature store** (Redis-backed online store + offline warehouse); candidate pools cached in **Redis**.
```
Table: posts                          (Cassandra)
  post_id    BIGINT (partition key)
  author_id  BIGINT
  content    TEXT
  audience   TEXT          -- "friends" | "public" | "custom:7741"
  created_at TIMESTAMP
Example row: {post_id:9001, author_id:5, content:"hello", audience:"friends", created_at:"2026-06-17T12:00:00Z"}

Table: edges                          (Cassandra, friend graph)
  user_id    BIGINT (partition key)
  friend_id  BIGINT (clustering key)
  Example: {user_id:42, friend_id:5}
```
Shard `posts` by `post_id` and `edges` by `user_id` so "my friends" is a single-partition range scan. Privacy lives on the post row (`audience`) and is evaluated at read time, never baked into a shared cached feed.

**Architecture.**

```
WRITE (POST /posts):
  client → app → INSERT posts[post_id] (Cassandra) → emit engagement-signal event → Kafka → feature store

READ (GET /feed):
  client → app → 1. candidate gen: recent posts from edges[viewer] + followed pages (hybrid push/pull)
                 2. PRIVACY FILTER: drop posts whose audience excludes viewer  ← authoritative, per read
                 3. RANK: score survivors with ML model (features from feature store) → top N
                 4. return ordered slice → 200
```

Concrete trace: `u_42` opens their feed. Candidate generation gathers ~500 recent posts from `u_42`'s 350 friends and followed pages. The privacy filter reads each post's current `audience`: a friend's `custom:7741` post is dropped because `u_42` isn't in list `7741`; a `public` page post stays. The ~430 survivors are scored online by the ranking model using features (author affinity, predicted comment probability, recency, content type) fetched from the Redis feature store, and the top 25 by `rank_score` are returned. Note the filter runs **after** candidate gen and **before** ranking, reading live audience settings so a just-changed audience is honored.

**Deep dive — ranking + privacy at read time.** Both fight caching, for different reasons. You *can* precompute candidate pools and feature vectors (they're shared across reads of the same author), but the final ordered feed is per-viewer and freshness-sensitive, so it is computed online for each request. Privacy must be **authoritative**: read the post's current `audience` at read time, because audience can change after posting (a user narrows a post from public to friends, or unfriends someone). This is why read-time filtering beats precomputed feeds — invalidating millions of materialized feeds on every audience edit or unfriend is intractable, whereas a read-time filter is always correct by construction. Cost: ~500 score computations per read, mitigated by a cheap candidate pre-filter and feature caching.

**Trade-offs & failure modes.**
- *The decision:* read-time ranking + read-time privacy filtering. Correct and fresh, at the cost of CPU; precomputed feeds would be fast but stale and privacy-risky.
- *Ranking service down:* fall back to **reverse-chronological** order of the privacy-filtered candidates. Degraded relevance, fully functional.
- *Privacy is not eventually consistent:* content can lag, but apply the **strictest current** audience setting — fail closed (hide) if audience is ambiguous or unreadable.
- *Feature store stale:* ranking uses slightly old signals → minor relevance drift, acceptable; never blocks the read.

## 2.3 Instagram feed

**Clarify.** Functional: post photos/videos; follow users; view a ranked feed of media. Non-functional: media blobs are large, so **metadata and bytes are stored and served separately**; CDN delivery is central; read-heavy with fan-out write amplification. The distinguishing concern vs Twitter is **media handling** — the feed service must never touch image bytes. Read:write ≈ **250:1** on media fetches.

**Estimate (worked).**
```
Users:   500M DAU
Reads:   each DAU views ~50 media items/day
         500M × 50 = 25B media fetches/day  (mostly CDN-served)
         25,000,000,000 / 86,400 ≈ 290k fetches/s, peak ≈ 870k/s (CDN absorbs ~95%)
Uploads: 100M/day
         100,000,000 / 86,400 ≈ 1,160 uploads/s, peak ≈ 3,500/s
Storage: avg image 200 KB, store 3 variants (thumb 20KB + feed 150KB + full 1MB) ≈ 1.2 MB
         100M/day × 1.2 MB × 365 ≈ 44 PB/year of media (object store)
         metadata row ≈ 300 B → 100M × 365 × 300 B ≈ 11 TB/year (tiny by comparison)
```
The numbers say: media is **petabytes** (object store + CDN), metadata is tens of terabytes (DB). Keep the high-QPS feed path on the small metadata and push every byte to the CDN edge.

**API.**
```http
POST /api/v1/media:initiate
{ "content_type": "image/jpeg", "size": 204800 }
→ 200 OK
{ "media_id": "m_5501", "upload_url": "https://uploads.s3.../m_5501?X-Amz-Signature=..." }   // pre-signed, direct-to-S3

GET /api/v1/feed?cursor=...&limit=20
→ 200 OK
{ "items": [ { "media_id": "m_5501", "author_id": "u_9",
               "cdn_url": "https://cdn.ig.../m_5501/feed.jpg", "caption": "sunset" } ],
  "next_cursor": "..." }
```

**Data model.** Metadata in **PostgreSQL** (or Cassandra at scale); blobs in **S3-compatible object storage**; delivery via **CDN**.
```
Table: media                          (PostgreSQL)
  media_id   BIGINT  (partition key)
  author_id  BIGINT
  blob_ref   TEXT             -- "s3://media/m_5501/"  (prefix; variants under it)
  caption    TEXT
  dims       TEXT             -- "1080x1080"
  created_at TIMESTAMP
Example row: {media_id:5501, author_id:9, blob_ref:"s3://media/m_5501/",
              caption:"sunset", dims:"1080x1080", created_at:"2026-06-17T12:00:00Z"}
Variants written to object store: m_5501/thumb.jpg (20KB), m_5501/feed.jpg (150KB), m_5501/full.jpg (1MB)
```
Shard `media` by `media_id` (even spread, point lookups). The feed timeline (list of `media_id`s per reader) uses the same hybrid-fan-out Redis structure as 2.1, keyed by `reader_id`.

**Architecture.**

```
UPLOAD:
  client → app: POST media:initiate → app returns pre-signed S3 URL
  client → S3 directly (bytes bypass app servers)
  S3 event → Kafka → transcode pipeline: generate thumb/feed/full variants → write to S3
                   → INSERT media metadata (PostgreSQL)
                   → fan-out media_id to followers' timelines (Redis, hybrid push/pull)

FEED READ:
  client → app → ZREVRANGE tl:{reader} (Redis) → hydrate metadata (PostgreSQL/cache)
              → return {media_id, cdn_url, caption}  ← small JSON, no bytes
  client → CDN: GET cdn_url  ← image bytes served from edge, never through app
```

Concrete trace: `u_9` uploads a 1080×1080 photo. The client calls `media:initiate`, gets a pre-signed URL, and `PUT`s the 200 KB directly to S3 — the app servers never see the bytes. An S3 event triggers the transcode pipeline (via Kafka), which writes `thumb.jpg`/`feed.jpg`/`full.jpg`, inserts the metadata row `m_5501`, and fans `m_5501` into followers' Redis timelines. When `u_42` scrolls, the feed response carries `m_5501` plus its `cdn_url`; the client then fetches `https://cdn.ig.../m_5501/feed.jpg` (150 KB) from the nearest CDN edge. The full-res `full.jpg` is fetched only on tap.

**Deep dive — media metadata vs blobs + CDN.** The architectural move is total separation: the feed service deals only with ~300-byte metadata rows, while image bytes flow client→S3 on the way in and CDN→client on the way out. This decouples the latency-sensitive, 870k/s feed path from the 44 PB/year blob layer. Pre-generating multiple resolutions on ingest (rather than resizing on the fly) means the feed serves a 150 KB `feed.jpg` and the detail view serves the 1 MB `full.jpg`, cutting feed bandwidth ~7×. Transcoding is async and idempotent (keyed by `media_id`) so a retried S3 event re-produces the same variants without duplication.

**Trade-offs & failure modes.**
- *The decision:* pre-generate variants on upload (extra storage + upload-pipeline latency) vs resize-on-read (CPU per request, slower reads) — pre-generation wins for a read-heavy media product.
- *CDN is the bandwidth backbone:* a popular image is cached at the edge, so an origin (S3) blip is masked for existing content; only fresh uploads break until the pipeline recovers.
- *Transcode lag:* a just-posted photo may show a placeholder for a few seconds until variants exist — acceptable eventual consistency on the feed.
- *Direct upload abuse:* pre-signed URLs are scoped to one `media_id`, short-TTL, and size-capped so a leaked URL can't be reused.

## 2.4 Reddit / Hacker News

**Clarify.** Functional: submit posts to communities; threaded comments; upvote/downvote; rank a front page by a **hotness** score that blends score and age; moderation. Non-functional: read-heavy, vote counters contend on hot posts, ranking must be cheap to read, comment trees can be very deep. Read:write ≈ **30:1** on posts, but votes on a hot post are a concentrated write hotspot.

**Estimate (worked).**
```
Users:   50M DAU
Reads:   each DAU loads ~30 pages/day (front pages + threads)
         50M × 30 = 1.5B reads/day
         1,500,000,000 / 86,400 ≈ 17k reads/s, peak ≈ 52k/s
Votes:   ~300M votes/day
         300,000,000 / 86,400 ≈ 3,500 votes/s, peak ≈ 10k/s
         BUT a single viral post can absorb ~5k votes/s on ONE counter ← hot row
Comments: viral post → tens of thousands of nodes in one tree
Storage: post ≈ 1 KB, comment ≈ 500 B
         5M posts/day × 1 KB + 30M comments/day × 500 B ≈ 20 GB/day ≈ 7 TB/year
```
The numbers say: aggregate write rate is modest, but the front-page sort and the **per-post vote hotspot** drive the design — precompute `hot_score` so the front page is an index read, and never `UPDATE count+1` on one row at 5k/s.

**API.**
```http
POST /api/v1/posts          { "sub": "programming", "title": "...", "url": "..." } → 201 { "post_id": "p_77" }
POST /api/v1/comments       { "post_id": "p_77", "parent_id": "c_3", "text": "..." } → 201 { "comment_id": "c_9" }
POST /api/v1/vote           { "target_id": "p_77", "dir": 1 }   → 200 { "score": 4213 }   // idempotent per user
GET  /api/v1/r/programming/hot?cursor=...&limit=25 → 200 { "posts": [...], "next_cursor": "..." }
GET  /api/v1/posts/p_77/comments?parent_id=c_3&cursor=...&sort=top → 200 { "comments": [...] }
```

**Data model.** Posts/comments/votes in **PostgreSQL** (or Cassandra at scale); per-community hot index in **Redis sorted set**.
```
Table: posts                          (PostgreSQL)
  post_id    BIGINT (partition key by sub-hash)
  sub        TEXT
  author_id  BIGINT
  title      TEXT
  score      INT                -- denormalized, eventually consistent
  hot_score  DOUBLE             -- precomputed: log10(score) + created/45000
  created_at TIMESTAMP
Example row: {post_id:77, sub:"programming", author_id:5, title:"...", score:4213,
              hot_score:18234.61, created_at:"2026-06-17T11:00:00Z"}

Table: comments                       (PostgreSQL)
  comment_id BIGINT
  post_id    BIGINT (partition key)   -- whole tree colocated
  parent_id  BIGINT
  path       TEXT  (e.g. "77/3/9")    -- materialized path
  score      INT
Table: votes  PK(user_id, target_id), dir SMALLINT   -- one vote per user, idempotent
Hot index: ZADD hot:{sub} {hot_score} {post_id}      (Redis)
```
Shard posts by `sub` (a community's front page lives together) and comments by `post_id` (a post's entire tree colocated for subtree scans).

**Architecture.**

```
WRITE (vote):
  client → app → UPSERT votes(user,target,dir) (idempotent)
              → enqueue delta → buffer/stream → flush aggregated ±N to posts.score every ~1s
              → recompute hot_score → ZADD hot:{sub}

WRITE (comment):
  client → app → INSERT comments with path = parent.path + "/" + comment_id

READ (front page):
  client → app → ZREVRANGE hot:{sub} 0 24 (Redis) → hydrate posts → 200    ← O(log n) sorted read

READ (thread):
  client → app → range scan comments WHERE path LIKE '77/3/%' ORDER BY score, keyset-paginated
```

Concrete trace: post `p_77` is going viral at ~5k votes/s. Each vote is an idempotent `UPSERT` into `votes(user_id, p_77)` (re-voting flips or removes, never double-counts). The raw increments are **not** applied to `posts.score` per vote; they're buffered and flushed as an aggregated delta (e.g. `+4,800`) once per second, after which `hot_score = log10(4213) + created_at_seconds/45000` is recomputed and `ZADD hot:programming 18234.61 77` updates the index. The `/r/programming/hot` front page is then a single `ZREVRANGE` returning the top 25 ids in `O(log n)`. A 40k-node comment tree on `p_77` is read one subtree at a time: `path LIKE '77/3/%'` returns the replies under `c_3`, keyset-paginated by score.

**Deep dive — hot ranking + comment trees.** Two distinct hard parts.

| Concern | Naive | Chosen | Why |
|---|---|---|---|
| Front-page sort | `ORDER BY computed_hotness` per request | precompute `hot_score`, keep Redis sorted set per sub | front page becomes O(log n) range read, not a full scan |
| Vote counter | `UPDATE score=score+1` per vote | buffer + flush aggregated delta ~1s | avoids single-row contention at 5k/s |
| Comment tree | adjacency list (`parent_id`) + recursive query | **materialized path** (`77/3/9`) | fetch + paginate any subtree with one prefix range scan |

Hotness uses the HN/Reddit-style `hot = log10(max(score,1)) + sign × seconds_since_epoch / 45000`, so a post needs ~10× the votes to outrank one ~12.5 h older. Because time keeps advancing, scores drift; re-rank periodically (or lazily decay on read). The materialized path turns "give me this comment's subtree, paginated by top score" into a single indexed prefix scan — adjacency lists would need a recursive CTE per expand.

**Trade-offs & failure modes.**
- *The decision:* precomputed `hot_score` (fast reads, ranking slightly stale) over compute-on-read (always fresh, expensive at 52k reads/s).
- *Counters eventually consistent:* a score off by a few for a second is fine; the `votes` table is the durable truth and `score` can be recomputed from it.
- *Ranking job lag:* the front page is slightly stale during a spike — acceptable degradation.
- *Moderation/spam:* queue new posts for async spam scoring; shadow-ban or rate-limit abusive accounts so their votes/posts don't move the index.

## 2.5 Comment system

**Clarify.** Functional: post comments on an entity (article, video), threaded and paginated, with moderation and spam control. Non-functional: read-heavy, **read-your-writes for the author** (you must see your own comment immediately), deep pagination must stay cheap, deep nesting must be bounded. Read:write ≈ **100:1**.

**Estimate (worked).**
```
Entities: 1M new articles/day, each averages ~50 comments, hot ones reach 100k
Writes:   50M comments/day
          50,000,000 / 86,400 ≈ 580 writes/s, peak ≈ 1,750/s
Reads:    100:1 → ~58k reads/s avg, peak ≈ 175k/s
Hot page: a 100k-comment thread must paginate, never load all 100k (≈ 50 MB) at once
Storage:  comment row ≈ 500 B
          50M/day × 365 × 500 B ≈ 9 TB/year
```
The numbers say: nothing is huge, but a single thread can hold 100k comments, so **keyset pagination** (not OFFSET) and per-entity colocation are what make reads cheap.

**API.**
```http
POST /api/v1/comments
{ "entity_id": "a_900", "parent_id": "c_3", "text": "great post" }
→ 201 Created
{ "comment_id": "c_42", "created_at": "2026-06-17T12:00:00Z", "status": "visible" }

GET /api/v1/comments?entity_id=a_900&parent_id=&cursor=c_30:1718:842&sort=top&limit=20
→ 200 OK
{ "comments": [ { "comment_id": "c_42", "author_id": "u_7", "text": "great post", "score": 5 } ],
  "next_cursor": "c_42:1718:837" }

POST /api/v1/comments/c_42/report  → 202 Accepted
```

**Data model.** Comments in **PostgreSQL** (or Cassandra at scale), colocated by entity.
```
Table: comments                       (PostgreSQL)
  comment_id BIGINT
  entity_id  BIGINT (partition key)    -- all comments for one article colocated
  parent_id  BIGINT (nullable)
  path       TEXT                       -- materialized path "900/3/42"
  author_id  BIGINT
  text       TEXT
  score      INT
  status     TEXT                       -- visible | pending | removed
  created_at TIMESTAMP
  INDEX (entity_id, parent_id, score DESC, comment_id)   -- supports keyset paging
Example row: {comment_id:42, entity_id:900, parent_id:3, path:"900/3/42",
              author_id:7, text:"great post", score:5, status:"visible", created_at:"..."}
```
Shard by `entity_id` so one article's whole comment set lives on one partition — every thread read is single-shard. Keyset cursor = `(score, comment_id)`; pagination is `WHERE (score, comment_id) < cursor LIMIT n`, constant-cost at any depth.

**Architecture.**

```
WRITE (POST /comments):
  client → app → INSERT comments(status=visible, path=parent.path+"/"+id) (PostgreSQL primary)
              → return 201 immediately
              → async: spam classifier; notify parent author
  (author's next reads routed to PRIMARY for ~few s → read-your-writes)

READ (GET /comments):
  client → app → top-level: WHERE entity_id=? AND parent_id IS NULL ORDER BY score keyset-paged
              → replies loaded lazily per thread on expand: WHERE path LIKE '900/3/%'
              → hot entity's first page cached in Redis
```

Concrete trace: `u_7` posts `c_42` on article `a_900` under `c_3`. The insert sets `path = "900/3/42"` and `status = visible`, then returns `201` immediately. To guarantee read-your-writes, `u_7`'s reads for the next few seconds are routed to the **primary** (or served from a session cache), so even if a read replica lags, `u_7` sees `c_42`. A spam-classification job runs async; if it flags the comment, `status` flips to `removed`. Other readers fetch the top-level page (`parent_id IS NULL`, top-scored, keyset-paged) and expand `c_3`'s subtree on click via `path LIKE '900/3/%'`.

**Deep dive — tree model + deep pagination.**

| Concern | Naive | Chosen | Why |
|---|---|---|---|
| Pagination | `OFFSET n LIMIT 20` | **keyset**: `WHERE (score,comment_id) < cursor LIMIT 20` | OFFSET scans + discards n rows → slower the deeper you go; keyset is constant cost |
| Nesting | render unbounded depth | cap visible depth ~5, "load more replies" on click | unbounded trees blow up payload + render time |
| Subtree fetch | recursive CTE on `parent_id` | materialized `path` prefix scan | one indexed range scan returns a subtree |

On a 100k-comment thread, `OFFSET 90000 LIMIT 20` forces the DB to walk 90,020 rows and throw away 90,000 — page-load time grows linearly with depth. Keyset pagination carries the last-seen `(score, comment_id)` and does a single index range scan, so page 5,000 costs the same as page 1. The materialized path makes "this comment's subtree, paginated" a `path LIKE '900/3/%'` prefix scan; most UIs collapse beyond ~5 levels and load deeper replies on demand.

**Trade-offs & failure modes.**
- *The decision:* optimistic posting (instant, may need later removal) over pre-moderation (safe but adds queue latency before the comment appears).
- *Read-your-writes:* route the author's session to the primary right after a write; other users seeing the comment a moment late is fine.
- *Spam classifier down:* either queue new comments as `pending`, or post optimistically and sweep later — choose per product risk tolerance.
- *Consistency:* content is eventually consistent for other readers; the author seeing their own comment is not negotiable.

## 2.6 Like/reaction system

**Clarify.** Functional: like/react to content; show counts; one reaction per user (idempotent); optional reaction types. Non-functional: **hot keys** (a viral post draws thousands of likes/s onto one counter), idempotency (double-tap and mobile retries must not double-count), eventual consistency on the displayed count is fine. Read:write ≈ **20:1** (every feed render reads counts; likes are frequent but fewer).

**Estimate (worked).**
```
Users:   300M DAU
Likes:   each DAU likes ~10 items/day
         300M × 10 = 3B likes/day
         3,000,000,000 / 86,400 ≈ 35k likes/s, peak ≈ 105k/s
Hot key: a single viral post draws ~10k likes/s onto ONE counter ← hot-row contention
Reads:   count is read on every feed render → ~hundreds of k/s, mostly from cache
Storage: reaction row ≈ user(8)+target(8)+type(1)+ts(8) ≈ 25 B
         3B/day × 365 × 25 B ≈ 27 TB/year
```
The numbers say: total throughput is large but the killer is **10k writes/s on one row**. The fix is to decouple the exact membership row from the aggregate count.

**API.**
```http
POST /api/v1/react      { "target_id": "p_77", "type": "like" }  → 200 { "count": 41213, "my_reaction": "like" }   // idempotent
DELETE /api/v1/react    { "target_id": "p_77" }                  → 200 { "count": 41212, "my_reaction": null }
GET  /api/v1/reactions?target_id=p_77
→ 200 { "counts": { "like": 40000, "love": 1212 }, "my_reaction": "like" }   // count eventually consistent
```

**Data model.** Membership in **Cassandra** (exact); aggregate counts as **sharded counters in Redis**.
```
Table: reactions                      (Cassandra)
  user_id    BIGINT  (partition key)
  target_id  BIGINT  (clustering key) -- PK (user_id, target_id) → one row per user per target
  type       TEXT                     -- "like" | "love"
  ts         TIMESTAMP
Example row: {user_id:7, target_id:77, type:"like", ts:"2026-06-17T12:00:00Z"}

Sharded counter: react_count:{target_id}:{shard}    (Redis, shard ∈ 0..15)
  INCR react_count:77:{rand 0..15}     on like; DECR on unlike
  displayed count = SUM(react_count:77:0 .. :15), cached ~1s
```
Membership PK `(user_id, target_id)` gives idempotency (re-like is a no-op upsert). The **count** of a hot target is the contention point, so it is split across 16 Redis sub-counters rather than one row.

**Architecture.**

```
WRITE (react):
  client → app → UPSERT reactions(user, target, type) (Cassandra)  ← idempotent membership
              → INCR react_count:{target}:{random shard 0..15} (Redis)
              → return 200 with cached count

READ (count + my_reaction):
  client → app → count: SUM 16 shard counters (cached ~1s) (Redis)
              → my_reaction: point read reactions[user][target] (Cassandra / per-user cache)
```

Concrete trace: post `p_77` is taking ~10k likes/s. Each like is an idempotent `UPSERT` into `reactions[(user, 77)]` — a double-tap or a retried mobile request writes the same row, so the user is counted exactly once. The aggregate increment goes to a **random** one of 16 counters, `react_count:77:{0..15}`, spreading 10k/s into ~625/s per Redis key — no single hot row. The displayed count is `SUM` of the 16 shards, computed and cached every ~1 second. "Did I like this?" is a point read of `reactions[(user, 77)]`. Unlike deletes the membership row and `DECR`s a shard.

**Deep dive — idempotent counters on hot posts.** Two requirements pull apart: **correctness of membership** (each user counted once, never double) and **throughput of the aggregate count** (10k/s on one target). Membership is solved exactly by the unique `(user, target)` row — idempotent by primary-key constraint, immune to retries. Aggregate throughput is solved by **decoupling the count from the writes**:

| Approach | Mechanism | Trade |
|---|---|---|
| Single counter | `UPDATE count+1` on one row | exact, but hot-row contention at 10k/s |
| **Sharded counters** | N sub-counters, increment random shard, SUM on read | scales linearly with N shards, eventually consistent |
| Buffer + batch | collect deltas in a stream, flush aggregate ~1s | fewest writes, count lags ~1s |

The count is derived and eventually consistent, which is acceptable for a "like" number; it can always be recomputed exactly from the `reactions` table if the counters drift.

**Trade-offs & failure modes.**
- *The decision:* sharded/buffered counts (scales, eventually consistent) over a single exact synchronous counter (simple but a hot-row bottleneck).
- *Idempotency is non-negotiable:* mobile retries are common; the `(user, target)` PK absorbs them.
- *Counter store lag/loss:* the shown number is slightly stale or can be rebuilt — the `reactions` table is the durable source of truth.
- *Reaction switch:* changing `like`→`love` updates the membership row and adjusts two type counters; still one membership row per user.

## 2.7 Follow graph

**Clarify.** Functional: follow/unfollow; list followers and followees; check "does A follow B"; provide the fan-out hooks for feeds. Non-functional: **high-degree nodes** (celebrities with 10^8 followers), fast membership checks, fast both-direction traversal, eventual consistency OK. This is the social graph beneath every feed in this chapter. Read:write ≈ **1000:1** (traversed constantly, edited rarely).

**Estimate (worked).**
```
Users:   500M, avg 200 follows each
Edges:   500M × 200 = 100B directed edges (stored twice → 200B rows)
Writes:  ~50M follow/unfollow actions/day
         50,000,000 / 86,400 ≈ 580 writes/s, peak ≈ 1,750/s (each = 2 row writes)
Reads:   relationship checks + follower/following list paging, embedded in every feed build
         ~hundreds of k/s
Super-node: a celebrity has 10^8 edges → cannot load all followers into memory,
            and fanning a post to all of them is the celebrity problem (see 2.1)
Storage: edge row ≈ 24 B → 200B rows × 24 B ≈ 4.8 TB (small; the challenge is degree skew, not size)
```
The numbers say: storage is modest, writes are light, but **degree skew** (a single node with 10^8 edges) and the read amplification of feed-building dominate the design.

**API.**
```http
POST   /api/v1/follow   { "target": "u_88" }  → 204 No Content   (idempotent)
DELETE /api/v1/follow   { "target": "u_88" }  → 204 No Content
GET    /api/v1/followers/u_88?cursor=...&limit=100 → 200 { "users": [...], "next_cursor": "..." }
GET    /api/v1/following/u_42?cursor=...&limit=100 → 200 { "users": [...], "next_cursor": "..." }
GET    /api/v1/relationship/u_42/u_88 → 200 { "follows": true, "followed_by": false }
```

**Data model.** Edges stored **twice** for both-direction queries in a partitioned wide-column store (**Cassandra**).
```
Table: following                      (Cassandra)
  user_id     BIGINT (partition key)   -- "who I follow"
  followee_id BIGINT (clustering key)
  created_at  TIMESTAMP
  Example: {user_id:42, followee_id:88, created_at:"2026-06-17T12:00:00Z"}

Table: followers                      (Cassandra)
  user_id     BIGINT (partition key)   -- "who follows me"
  follower_id BIGINT (clustering key)
  created_at  TIMESTAMP
  Example: {user_id:88, follower_id:42, created_at:"2026-06-17T12:00:00Z"}
```
Each table is sharded by its first column, so "who do I follow" (`following[42]`) and "who follows me" (`followers[88]`) are both single-partition range scans, and a relationship check is a point lookup in `following[42]`. Cost: a follow writes two rows that must stay consistent.

**Architecture.**

```
WRITE (follow A→B):
  client → app → INSERT following[A] = B  (Cassandra)
              → INSERT followers[B] = A
              → (idempotent dual-write; reconciliation job repairs drift)
              → trigger feed fan-out: push if B normal, pull-marker if B celebrity (ties to 2.1)

READ:
  followers/following → single-partition range scan + cursor paging
  relationship A→B    → point lookup following[A] contains B?
  super-node          → NEVER materialize celebrity's full follower list; paginate only
```

Concrete trace: `u_42` follows celebrity `u_88`. The app inserts `following[42] = 88` and `followers[88] = 42` (idempotent — re-following overwrites the same clustering key). Because `u_88` has 10^8 followers and is flagged a celebrity, the follow does **not** register `u_42` into any fan-out push list; instead `u_88` stays marked `pull`, so `u_88`'s posts reach `u_42` only via the read-time merge in 2.1. Listing `u_88`'s followers is a paginated range scan over the `followers[88]` partition (100 at a time, cursor-based) — the full 10^8-row list is never loaded. "Does u_42 follow u_88?" is a point lookup in `following[42]`.

**Deep dive — high-degree nodes & storage.** Adjacency lists in a partitioned wide-column store (shard by node id) scale horizontally, and dual-writing both directions makes both traversals O(1)-to-find + range-scan. The problem is the super-node: a celebrity's `followers[88]` partition holds 10^8 rows — far beyond one partition's comfort and a read hotspot. Mitigations: (1) **always paginate** follower reads, never "all at once"; (2) **denormalize both directions** so reverse lookup doesn't require a global secondary index scan; (3) **special-case celebrities in the fan-out layer**, not the storage layer — the graph just stores edges; the feed system decides not to materialize them.

| Approach | Reverse lookup | Write cost | Trade |
|---|---|---|---|
| **Dual-write both tables** | fast (own partition) | 2 rows/follow + consistency burden | reads both ways are cheap |
| Single edge table + secondary index | slower (index scan) | 1 row/follow | less duplication, slower "who follows me" |

A true graph database helps for multi-hop queries (friends-of-friends), but most social products need only 1-hop traversal, which a sharded KV/wide-column store handles more cheaply at this scale.

**Trade-offs & failure modes.**
- *The decision:* dual-write both directions (fast reads both ways) over a single edge table with a secondary index (less duplication but slow reverse lookups) — reads are 1000× writes, so optimize reads.
- *Consistency:* eventual is fine — a follow taking a second to reflect everywhere is acceptable.
- *The hard failure mode is the celebrity hotspot,* handled at the fan-out layer (mark `pull`), not at storage.
- *Dual-write drift:* a crash between the two inserts leaves one table stale; an async reconciliation job scans and repairs. Unfollow must remove **both** rows.

# 3. Real-time communication

## 3.1 1:1 chat

**Clarify.** Functional: two users exchange messages in real time; messages are **ordered within a conversation**; delivery + read receipts; offline users receive messages on reconnect (offline sync); optional typing indicators. Non-functional: send-to-deliver p99 < 200 ms, durable (a message acked to the sender is never lost), at-least-once delivery with client-side dedupe, total order per conversation. The dominant constraint is **concurrent persistent connections** (one long-lived socket per online user), not raw message volume.

**Estimate (worked).**
```
Concurrent connections:
  100M DAU, ~50% online during the day → 50M concurrent WebSocket sockets
Message rate:
  50 msgs/user/day → 100M × 50 = 5B msgs/day
  5,000,000,000 / 86,400 s          ≈ 58,000 msgs/s avg
  peak ×3                            ≈ 175,000 msgs/s
Fan-out: 1:1 → each message = 1 delivery push (no multiplier)
Connection servers:
  ~65k sockets/server (memory: ~50KB/conn → ~3.3 GB RAM for buffers + heap)
  50,000,000 / 65,000               ≈ 770 gateway servers
Persist load:
  175k msgs/s × ~1 write each → ~175k writes/s into the message log
Storage (1 yr):
  row ≈ conv_id(16) + seq(8) + msg_id(16) + sender(8) + text(~256) + ts(8) ≈ 320 B
  5B/day × 365 × 320 B               ≈ 5.8 × 10^14 B ≈ 580 TB/yr
```
The numbers say: **connection count, not message throughput, sizes the fleet** — ~770 stateful gateways holding 50M sockets, while the write path (175k/s) is a routine sharded-log workload.

**API.**
```
WebSocket (client ↔ gateway, persistent):

→ send       { "type":"send", "conv_id":"c_42", "client_msg_id":"a1b2", "text":"yo" }
← ack        { "type":"ack",  "conv_id":"c_42", "client_msg_id":"a1b2", "seq":1041 }
← message    { "type":"message","conv_id":"c_42","seq":1041,"sender":"u_7","text":"yo","ts":"2026-06-17T10:00:01Z" }
← delivered  { "type":"delivered","conv_id":"c_42","seq":1041,"by":"u_9" }
← read       { "type":"read","conv_id":"c_42","up_to_seq":1041,"by":"u_9" }
```
```http
GET /api/v1/conversations/c_42/messages?after_seq=1037&limit=50    # offline sync over HTTP
→ 200 OK
{ "messages":[ {"seq":1038,...}, ... ], "next_cursor":null }
```

**Data model.** Append-only log **per conversation**, ordered by a monotonic per-conversation `seq`. Point-lookup + range-scan by `(conv_id, seq)` → **Cassandra** (or DynamoDB). Partition key = `conv_id`, clustering key = `seq` ASC, so a conversation's messages colocate on one partition in order and a sync is a single range scan.
```
Table: messages              (Cassandra)
  conv_id       TEXT      PARTITION KEY     -- "c_42"
  seq           BIGINT    CLUSTERING KEY    -- 1041   (monotonic per conv)
  msg_id        UUID                        -- server id
  client_msg_id TEXT                        -- "a1b2" (idempotency / dedupe)
  sender_id     TEXT                        -- "u_7"
  text          TEXT
  ts            TIMESTAMP
Example row: ("c_42", 1041, 9f.., "a1b2", "u_7", "yo", 2026-06-17T10:00:01Z)

Table: conv_cursor           (Cassandra / Redis)
  conv_id  TEXT, user_id TEXT   PARTITION KEY (conv_id,user_id)
  last_delivered_seq  BIGINT
  last_read_seq       BIGINT
```
Shard key = `conv_id`: all messages and ordering for a conversation live on one partition, so `seq` assignment and reads never cross shards. Routing registry `user_id → gateway` lives in **Redis** (TTL keyed).

**Architecture.**
```
                       ┌─────────────┐   user_id→gateway
                       │   Redis     │◄──── routing registry
                       │  (routing)  │
                       └──────┬──────┘
 u_7 ──WS── gateway-A ───────▶│         ┌──────────────┐
                              ├────────▶│  Sequencer    │ seq=1041 (per conv_id)
 SEND path:                   │         └──────┬───────┘
   1 client→gw-A              │                ▼
   2 gw-A → sequencer(conv)   │         ┌──────────────┐
   3 persist (seq=1041)       └────────▶│  Cassandra    │ append (c_42,1041,...)
   4 ack→sender               │         │ message log   │
   5 lookup u_9→gw-B          │         └──────────────┘
   6 push message→gw-B───WS──▶ u_9
                              ▼
 OFFLINE: u_9 absent → step 5/6 skipped; on reconnect
   u_9 → gw-C → GET messages?after_seq=last_delivered → range scan → stream gap
```
Trace one message: `u_7` types "yo" with `client_msg_id="a1b2"`. Gateway-A asks the per-`conv_id` sequencer for the next `seq` (1041), appends the row to Cassandra, returns `ack{seq:1041}` to `u_7`. It looks up `u_9` in Redis → connected on gateway-B → forwards `message{seq:1041}` over that socket; gateway-B's push triggers `u_9`'s client to send back `delivered`, which is written to `u_9`'s cursor and pushed to `u_7`. If `u_9` is offline, steps 5–6 are skipped entirely — the row is durably in the log, and `u_9` pulls it via the HTTP `after_seq` scan on next connect. Retries reuse `client_msg_id`, so a duplicate `send` collapses to the same `seq`.

**Deep dive — ordering + offline delivery.** Per-conversation total order comes from a **single-writer sequencer per `conv_id`**: a lightweight service (or a Redis `INCR conv:{id}:seq`) that hands out monotonic `seq` at persist time. Clients sort by `seq`, never wall-clock — two phones with skewed clocks would otherwise interleave wrong. Because `seq` is contiguous, a client detects gaps (`got 1041 but last was 1039 → missing 1040`) and triggers a sync. Offline delivery is **durable log + per-user cursor**: every message is persisted regardless of recipient presence (TTL: keep hot ~30 days in Cassandra, archive older to object store). On reconnect the client sends `last_delivered_seq` and the server range-scans `seq > last_delivered_seq`. At-least-once push + `client_msg_id` dedupe yields effective exactly-once *display*: the recipient ignores any `seq` it already rendered.

**Trade-offs & failure modes.**
- *Transport:* WebSocket (true server push, full-duplex, but stateful servers + reconnect handling + LB sticky concerns) vs HTTP long-polling (works everywhere, simpler, but ~2× overhead and added latency). WebSocket for the live path, HTTP for bulk sync.
- *Gateway failover:* gateways are stateful (they hold sockets) but **hold no durable state** — if gateway-A dies, its 65k clients reconnect to another gateway, re-register in Redis, and resync from their cursor. No message is lost because durability lives in the Cassandra log, not the socket.
- *Lost connection → resync:* a dropped push never loses data; the client re-pulls `after_seq` on reconnect.
- *Backpressure:* a slow/dead recipient's pushes are not queued unboundedly in the gateway — they fall back to the pull path (the log is the buffer). The sequencer per `conv_id` is a tiny shardable bottleneck; human 1:1 message rate is low, so it never hot-spots.

## 3.2 Group chat

**Clarify.** Functional: rooms with many members; a message **fans out to all members**; total order **per room**; membership changes (join/leave); history pagination; per-member read state. Non-functional: same durability/ordering/offline-sync guarantees as 1:1, but the dominant constraint shifts to **fan-out to N members** — a 100k-member room turns one write into up to 100k delivery pushes (the "celebrity room" problem).

**Estimate (worked).**
```
Concurrent connections: same as 1:1 → ~50M sockets, ~770 gateways
Rooms: mix of small (3-50) and large (up to 100k+) members
Write rate (one append per message):
  assume 2B group msgs/day → 2,000,000,000 / 86,400 ≈ 23k writes/s, peak ≈ 70k/s
Fan-out (the cost center):
  avg room 20 members → 23k × 20 = 460k pushes/s avg
  a single 100k-member room at 5 msgs/s = 500k pushes/s from ONE room
  peak aggregate pushes ≈ 1.5M pushes/s
Topic-broadcast saving (large rooms):
  100k members spread across 770 gateways → ~130 members/gateway
  pub/sub: 1 publish → 770 gateway-local deliveries instead of 100k point-pushes
  → ~130× fewer cross-node messages for a mega-room
```
The numbers say: **writes are cheap (one append per message), fan-out is everything** — bound per-message work by publishing once to a per-room topic and letting each gateway deliver to its local subscribers.

**API.**
```
WebSocket: send/message/delivered/read same as 1:1 but keyed by room_id
  → send    { "type":"send","room_id":"r_9","client_msg_id":"x1","text":"ship it" }
  ← message { "type":"message","room_id":"r_9","seq":8802,"sender":"u_7","text":"ship it","ts":"..." }
```
```http
POST /api/v1/rooms/r_9/members   { "user_id":"u_55" }          → 201 Created
GET  /api/v1/rooms/r_9/messages?after_seq=8790&limit=50        → 200 { "messages":[...] }
```

**Data model.** Append-only log **per room**, ordered by per-room `seq`, plus a membership table for fan-out targets and per-member cursors.
```
Table: room_messages         (Cassandra)
  room_id  TEXT    PARTITION KEY    -- "r_9"
  seq      BIGINT  CLUSTERING KEY   -- 8802  (monotonic per room)
  msg_id   UUID, sender_id TEXT, text TEXT, ts TIMESTAMP
  Example: ("r_9", 8802, ab.., "u_7", "ship it", 2026-06-17T...)

Table: room_members          (Cassandra)
  room_id  TEXT  PARTITION KEY, user_id TEXT  CLUSTERING KEY
  joined_at TIMESTAMP, join_seq BIGINT        -- history visible from join_seq
  Example: ("r_9","u_55", 2026-06-17T..., 8802)

Table: room_cursor (room_id,user_id) → last_read_seq   (Redis/Cassandra)
```
Shard key = `room_id`: a room's full ordered history and membership colocate, so `seq` assignment and pagination are single-partition. Fan-out uses a **per-room pub/sub topic** in **Kafka** (or Redis pub/sub for small rooms).

**Architecture.**
```
SEND (small room ≤ ~1k):                 SEND (large room, topic broadcast):
 u_7→gw-A→seq(r_9)=8802→Cassandra         u_7→gw-A→seq=8802→Cassandra
   → for each member: Redis lookup gw       → PUBLISH topic "room.r_9" (once)
   → push to that member's gateway          → gateways subscribed to room.r_9
   (direct point-pushes)                       each deliver to LOCAL members
                                              ┌────────────┐
                                   PUBLISH ──▶│ Kafka/Redis│──▶ gw-A→{u1,u2..}
                                              │ topic r_9  │──▶ gw-B→{u9,u30..}
                                              └────────────┘──▶ gw-C→{...}
 OFFLINE members: pull room_messages WHERE seq > last_read on reconnect
```
Trace: `u_7` sends to room `r_9`. Gateway-A gets `seq=8802` from the per-room sequencer, appends one row to Cassandra. For a small room it reads `room_members`, looks each up in Redis, and point-pushes. For a large room it instead does a single Kafka `PUBLISH room.r_9`; every gateway holding a subscriber to `r_9` consumes that one record and delivers locally to its ~130 connected members — one publish, not 100k point-pushes. Offline members pull `seq > last_read_seq` on reconnect. A member joining at `join_seq=8802` sees history only from there (or full history if room policy allows).

**Deep dive — per-room ordering + fan-out.** A single sequencer per `room_id` produces a total order every member agrees on; the append to `room_messages` is the durability + ordering anchor, and delivery is best-effort layered on top. Fan-out strategy is chosen by room size:

| Room size | Delivery | Per-message work | Latency |
|---|---|---|---|
| ≤ ~1,000 | direct point-push per member via Redis lookup | O(members) cross-node pushes | lowest |
| ~1k–100k+ | publish once to Kafka topic `room.{id}`; gateways fan out locally | O(gateways with a subscriber) ≈ bounded | +5–20 ms hop |
| broadcast / read-only mega-room | clients subscribe/poll a pub/sub topic, no per-member tracking | O(1) publish | pull-driven |

This caps per-message work regardless of room size and naturally handles members scattered across all 770 gateways.

**Trade-offs & failure modes.**
- *Push vs broadcast:* per-member push is instant and cheap for small rooms but O(N) for huge ones; topic broadcast scales to 100k members at the cost of one extra hop — same push-vs-pull trade-off as a news feed.
- *Hot mega-room:* its single sequencer is a write hotspot. Human per-room message rate is bounded (a few msgs/s), so it's fine; a truly firehose room (live event) should switch to the relaxed-ordering live-broadcast model (3.6).
- *Gateway failover:* identical to 1:1 — stateless durability means reconnect + resync from `last_read_seq`.
- *Backpressure:* a slow gateway lagging on a busy room topic falls behind on the Kafka subscription; its members catch up via the pull path rather than blocking the publisher.

## 3.3 Notification system

**Clarify.** Functional: deliver notifications across **channels** (mobile push via APNs/FCM, email, SMS, in-app); honor per-user preferences and quiet hours; dedupe; retry with a dead-letter queue. Non-functional: at-least-once delivery, idempotent (never notify twice for one event), high and **bursty** throughput, and tolerance for unreliable external providers. It is fundamentally a **reliable fan-out + delivery pipeline**; the dominant constraint is absorbing bursts (a breaking-news push = millions of sends in seconds) without dropping.

**Estimate (worked).**
```
Steady state:
  500M notifications/day → 500,000,000 / 86,400 ≈ 5,800/s avg
Burst (the real constraint):
  one broadcast to 50M subscribers fired over 60 s = 50M / 60 ≈ 830,000/s
  → queue must buffer the spike; workers drain at sustainable provider rate
Fan-out expansion:
  1 "notify all" event → 50M per-user jobs (one fan-out worker explodes it)
Worker sizing:
  each worker does ~500 sends/s (provider-bound) → to drain 830k/s need ~1,660 workers
  OR cap drain at provider quota (e.g. APNs ~9k/s/connection) and let queue absorb the rest
Channel split (example): 60% push, 25% in-app, 10% email, 5% SMS
```
The numbers say: **the queue is the shock absorber** — you never size workers for peak burst, you size them for provider throughput and let Kafka/SQS hold the spike (50M jobs × ~200 B ≈ 10 GB, trivially bufferable).

**API.**
```http
POST /api/v1/notify              # internal, from product services
{ "user_id":"u_7", "template":"order_shipped", "data":{"order":"o_88"},
  "channels":["push","email"], "idempotency_key":"evt_551" }
→ 202 Accepted   { "notif_id":"n_9001", "status":"queued" }

GET /api/v1/preferences/u_7      → 200 { "push":true, "email":true, "sms":false,
                                          "quiet_hours":{"tz":"PST","start":"22:00","end":"07:00"} }
PUT /api/v1/preferences/u_7      { "sms":false }   → 200 OK
```

**Data model.**
```
Table: notifications         (Cassandra)
  notif_id  TEXT  PARTITION KEY     -- "n_9001"
  user_id   TEXT, channel TEXT, status TEXT,        -- queued|sent|failed|dlq
  attempts  INT,  idempotency_key TEXT, created_at TIMESTAMP
  Example: ("n_9001","u_7","push","sent",1,"evt_551",2026-06-17T...)

Table: preferences           (Cassandra/RDS)
  user_id  TEXT  PARTITION KEY, channel TEXT  CLUSTERING KEY
  enabled  BOOL, quiet_start TIME, quiet_end TIME, tz TEXT

Table: device_tokens         (Cassandra)
  user_id  TEXT  PARTITION KEY, token TEXT CLUSTERING KEY, platform TEXT, last_seen TIMESTAMP

Dedupe set: Redis  SET notif:dedupe:{idempotency_key}  EX 86400   -- 24h window
```
Shard key = `user_id`: a user's prefs, tokens, and notification history colocate, so the worker resolves everything for one user in single-partition reads. The pipeline backbone is **Kafka** (durable, replayable, ordered per partition).

**Architecture.**
```
product svc ─POST /notify─▶ ┌─────────┐   ┌──────────────┐
                            │ Kafka   │──▶│ fan-out      │ (explodes "all users"
                            │ ingest  │   │ worker       │  into per-user jobs)
                            └─────────┘   └──────┬───────┘
                                                 ▼
                            ┌──────────────────────────────────────┐
                            │ delivery workers (consume per-user job)│
                            │  1 SETNX Redis dedupe key (skip if set)│
                            │  2 load prefs+quiet hours → filter     │
                            │  3 render template                     │
                            │  4 per channel → adapter               │
                            └──────┬─────────┬─────────┬─────────────┘
                            ┌──────▼──┐ ┌────▼───┐ ┌───▼────┐
                            │ APNs/FCM│ │  SES   │ │ Twilio │  each: retry+circuit breaker
                            └────┬────┘ └────────┘ └────────┘
                                 │ permanent failure (bad token, 410)
                                 ▼
                            ┌─────────┐  inspected → prune dead tokens
                            │  DLQ    │
                            └─────────┘
```
Trace: order service posts `notify{user_7, order_shipped, idempotency_key:evt_551}`. It lands in Kafka and a delivery worker consumes it. The worker does `SETNX notif:dedupe:evt_551` — if the key already exists (a retry), it drops the job. It loads `u_7`'s prefs: push + email enabled, currently 23:00 PST which is inside quiet hours → it **defers push, sends email now** (email isn't quiet-gated). It renders the template, calls the SES adapter, which succeeds → status `sent`, attempts=1. Had APNs returned `410 Unregistered`, the adapter would route that token to the **DLQ** and a cleanup job would prune it from `device_tokens`.

**Deep dive — multi-channel, retries, DLQ.** Each provider has distinct failure semantics, so each is wrapped in an adapter with its own **retry policy + circuit breaker**:

| Channel | Provider | Transient failure → retry | Permanent failure → DLQ | Circuit breaker |
|---|---|---|---|---|
| Push | APNs/FCM | 429 / 503: backoff 1s→2s→4s+jitter, 5 tries | 410 (stale token) → prune token | open after 50% errors / 30s |
| Email | SES | 4xx throttle, 5xx → backoff | hard bounce / suppression | open on quota exceeded |
| SMS | Twilio | rate-limit → backoff | invalid number | open on provider 5xx |
| In-app | internal store | DB retry | — | n/a |

Retries use **exponential backoff with jitter** (1s, 2s, 4s, 8s, 16s) so a recovering provider isn't thundered. Idempotency keys make every retry safe. After N attempts a message lands in the DLQ for inspection rather than being lost or retried forever. Preferences and quiet-hours filtering happen **before** dispatch, so a user choice is never violated.

**Trade-offs & failure modes.**
- *Delivery semantics:* at-least-once + idempotency (rare duplicate *attempt*, never a lost notification) vs at-most-once (never duplicate, may drop) — notifications choose at-least-once with a 24h Redis dedupe set.
- *Burst absorption:* the queue decouples burst arrival from provider drain rate; workers scale horizontally up to provider quotas, and the spike sits durably in Kafka.
- *Provider down:* the circuit breaker opens and traffic buffers/retries instead of failing fast and burning quota; permanently undeliverable messages land in the DLQ.
- *Channel isolation:* never let one slow channel block others — each channel dispatches independently, so an SMS outage doesn't delay push.

## 3.4 Presence service

**Clarify.** Functional: report whether a user is online / away / offline; "last seen"; notify friends of transitions. Non-functional: **massive heartbeat write rate**, bounded staleness is fully acceptable (a few seconds stale is fine), eventual correctness, and presence is ephemeral (durability barely matters — it's reconstructible from live connections). The dominant constraint is the write/heartbeat rate, which is why the design leans on TTL expiry instead of explicit offline events.

**Estimate (worked).**
```
Concurrent users: 50M online (same socket fleet as 3.1)
Heartbeat rate:
  heartbeat every 30s → 50,000,000 / 30 ≈ 1,670,000 refreshes/s
  this is the whole problem; durability ≈ 0 (presence is throwaway)
Optimization — gateway-batched TTL refresh:
  gateway batches its 65k sockets' refreshes into pipelined Redis EXPIRE
  770 gateways × (65k/30s) but pipelined → ~hundreds of Redis ops/s/gateway, not 1.67M individual RTTs
Change fan-out:
  only on online↔offline EDGE transitions, debounced
  avg user ~50 friends → a transition = up to 50 pushes, but transitions are rare vs heartbeats
Storage:
  presence(user_id → {status,last_hb,gateway}) ≈ 64 B × 50M = ~3.2 GB in Redis (fits one cluster)
```
The numbers say: **never treat a heartbeat as a durable write** — model "offline" as the *absence* of a refreshed TTL key, so 1.67M heartbeats/s become cheap pipelined `EXPIRE`s with zero coordination.

**API.**
```
WebSocket: liveness is implicit (the open socket IS the heartbeat); optional explicit:
  → ping  { "type":"ping" }            (gateway refreshes TTL)
```
```http
GET /api/v1/presence?user_ids=u_7,u_9,u_55
→ 200 { "u_7":{"status":"online","last_seen":null},
        "u_9":{"status":"offline","last_seen":"2026-06-17T09:58:00Z"},
        "u_55":{"status":"away","last_seen":"2026-06-17T09:55:00Z"} }

# subscribe to friends' transitions over WebSocket:
← presence { "type":"presence","user_id":"u_9","status":"offline","ts":"..." }
```

**Data model.** Single in-memory key per user with a TTL slightly longer than the heartbeat interval — **Redis** with no durable backing store.
```
Redis:
  KEY  presence:{user_id}   ->  HASH { status, gateway, last_hb }   EX 45   (TTL > 30s heartbeat)
  Example:  presence:u_7 -> {status:"online", gateway:"gw-A", last_hb:1718616001}  EX 45

  last_seen:{user_id} -> TIMESTAMP   (written ONCE on transition to offline, not per heartbeat)

  Pub/sub channel: presence.changes  (consumed by gateways to fan transitions to subscribed friends)
```
Shard key = `user_id` (Redis Cluster hash slot): even spread, no hot key, and a user's gateway colocates the refresher with the key. No SQL/Cassandra needed — if Redis loses the data, it self-heals as clients re-heartbeat within seconds.

**Architecture.**
```
 u_7 ──WS── gw-A   while connected, gw-A pipelines every 30s:
                    EXPIRE presence:u_7 45  (batched with all gw-A sockets)
                         │
                         ▼
                   ┌───────────┐   key alive  → online
                   │   Redis   │   key expired → offline (implicit, no write)
                   │ TTL keys  │
                   └─────┬─────┘
   READ: friends list → MGET presence:{f1..fN}  (pipelined multi-get)
                         │
   TRANSITION (edge only, debounced):
     gw-A detects socket close → SET last_seen:u_7; PUBLISH presence.changes {u_7, offline}
                         ▼
                   ┌───────────┐
                   │  pub/sub  │──▶ gateways holding u_7's friends ──WS──▶ push "offline"
                   └───────────┘
```
Trace: `u_7` connects to gateway-A, which sets `presence:u_7 = {online,gw-A} EX 45` and, every 30s, pipelines `EXPIRE presence:u_7 45` alongside its other 65k sockets. A friend opening their list issues `MGET presence:u_7 presence:u_9 ...` — one pipelined read. When `u_7` closes the laptop, gateway-A's socket-close handler writes `last_seen:u_7` (the only durable write) and `PUBLISH presence.changes {u_7, offline}`; gateways holding `u_7`'s friends push the transition. If the socket dies without a clean close, no event fires — the key simply expires after 45s and `u_7` is implicitly offline.

**Deep dive — heartbeat scale + acceptable staleness.** The core trick is **offline = key expiration, not an event you must write**. A durable "user went offline" write per disconnect would be 1.67M writes/s of churn; instead the TTL does the work for free. To kill the heartbeat write cost further, gateways **batch and pipeline** TTL refreshes for all their sockets rather than one round-trip per user. Reads are pipelined multi-gets and aggressively cacheable (a friends-list open is bursty). The accepted cost is bounded staleness: a user who yanks the network shows "online" for up to the 45s TTL — fine for presence. **Fan-out only on edge transitions, debounced** (a 2–5s debounce) so a flapping connection doesn't emit an online/offline storm to 50 friends.

**Trade-offs & failure modes.**
- *Model:* TTL/expiry (cheap, self-healing, up to ~45s stale) vs explicit online/offline events (precise, but every disconnect must be reliably detected and durably written — 1.67M writes/s of waste). Presence chooses staleness.
- *Presence store down:* non-critical — clients fall back to "unknown"/last-known and the chat path keeps working; on Redis recovery, presence rebuilds within one heartbeat interval as clients re-refresh.
- *Flapping connection:* debounce transitions; only broadcast genuine online↔offline edges, never per-heartbeat.
- *Regional routing:* keep presence keys in the user's region near their gateway to cut RTT; cross-region presence reads are eventually consistent.

## 3.5 Collaborative document editor

**Clarify.** Functional: multiple users edit one document concurrently; all replicas **converge to identical state**; live remote cursors/selections; offline edits merge cleanly on reconnect. Non-functional: local edits apply **optimistically** (instant, no server round-trip per keystroke), strong **eventual convergence** (no permanent divergence, ever), conflict resolution that never silently drops a user's work. The dominant constraint is **correctness of concurrent merge**, not raw scale — concurrency per doc is small (tens of editors) but the edit rate is high (every keystroke is an op).

**Estimate (worked).**
```
Concurrency per doc: ~10-50 simultaneous editors (rarely more)
Op rate per active doc:
  active typist ≈ 5 keystrokes/s → 20 editors × 5 = ~100 ops/s/doc (small!)
Fleet scale (many docs, not one big one):
  1M concurrent active docs × 100 ops/s = 100M ops/s aggregate, BUT
  each doc is an independent shard → ~100 ops/s is trivial per shard
Op log growth:
  1M ops on a busy doc × ~40 B/op ≈ 40 MB → replaying on open is too slow
  → snapshot every ~1,000 ops; new client loads snapshot + tail (≤1k ops)
Cursor/presence updates: ~throttled to 10/s per editor, ephemeral (not persisted)
```
The numbers say: **scale is per-document and tiny; the engineering cost is the merge algorithm** (OT vs CRDT) and snapshotting so opening a doc is O(snapshot + recent ops), not O(full history).

**API.**
```
WebSocket (client ↔ doc server):
  → op   { "type":"op","doc_id":"d_3","rev":120,
           "op":{"kind":"insert","pos":42,"char":"x"},"client_id":"c_7" }
  ← ack  { "type":"ack","doc_id":"d_3","rev":121 }              # server-assigned revision
  ← op   { "type":"op","doc_id":"d_3","rev":121,"op":{...},"client_id":"c_9" }  # broadcast
  ← cursor { "type":"cursor","doc_id":"d_3","client_id":"c_9","pos":51 }        # ephemeral
```
```http
GET /api/v1/docs/d_3   → 200 { "snapshot":"...text...", "rev":118, "ops_since":[...] }
```

**Data model.** Per-doc **operation log** + periodic **snapshots**; each op carries the revision it was generated against.
```
Table: doc_ops              (Cassandra)
  doc_id  TEXT   PARTITION KEY    -- "d_3"
  rev     BIGINT CLUSTERING KEY   -- 121  (server-assigned total order)
  client_id TEXT, op BLOB,        -- serialized OT op or CRDT op w/ id metadata
  base_rev BIGINT, ts TIMESTAMP
  Example: ("d_3", 121, "c_7", <insert 'x' @42>, 120, 2026-06-17T...)

Table: doc_snapshots        (object store + index row)
  doc_id  TEXT  PARTITION KEY, rev BIGINT CLUSTERING KEY
  content_ref TEXT   -- S3 key of materialized doc state at this rev
  Example: ("d_3", 1000, "s3://docs/d_3/snap_1000")
```
Shard key = `doc_id`: each document is an **independent consistency domain** with a single logical sequencer assigning `rev`, so no cross-doc coordination. Hot live state cached in **Redis**; op log durable in **Cassandra**; snapshots in **object storage (S3)**.

**Architecture — OT vs CRDT (the core decision).**
```
 c_7 (rev 120) ─op insert@42─▶ ┌────────────────┐
 c_9 (rev 120) ─op insert@42─▶ │  doc server     │  single sequencer per doc_id
                               │  (transform/     │
                               │   merge + order) │──assign rev 121, 122
                               └───────┬─────────┘
                                       ▼
                         ┌──────────────┐     ┌──────────────┐
                         │ Cassandra    │     │ broadcast back│──▶ c_7, c_9 apply
                         │ op log (rev)  │     │ in rev order  │   in agreed order
                         └──────┬───────┘     └──────────────┘
                                ▼ every ~1000 ops
                         materialize snapshot → S3; truncate replay window
```
- **Operational Transformation (OT):** clients send positional ops ("insert 'x' at pos 42 against rev 120"); the central doc server is the **transformation authority** — it transforms each incoming op against ops it has ordered since the client's `base_rev`, assigns the next `rev`, and rebroadcasts in that total order. Clients apply locally first (optimistic), then reconcile. Compact ops; transformation logic is famously subtle (Google Docs / ShareDB).
- **CRDTs:** each character/op carries unique ids and ordering tokens so **any application order converges** without a central transformer; concurrent inserts at the same position are deterministically ordered by id. Enables offline-first and P2P. Heavier per-op metadata, simpler convergence proof (Yjs / Automerge).

**Deep dive — conflict resolution + snapshots.** Concrete conflict: `c_7` and `c_9` both insert at pos 42 from rev 120. **OT:** server orders `c_7` first (rev 121), then transforms `c_9`'s op — its position shifts 42→43 because a char was inserted ahead of it — and assigns rev 122; both clients converge to the same two characters in the same order. **CRDT:** each insert gets a unique id (e.g. `(site_id, lamport_clock)`); the two inserts are ordered by comparing ids deterministically, so every replica independently reaches the same result with no central transform. Both apply **optimistically** locally for responsiveness, then converge.

| | OT | CRDT |
|---|---|---|
| Authority | central server transforms + orders | none required (peer-convergent) |
| Op size | small (position + char) | larger (carries id/ordering metadata) |
| Offline / P2P | hard (needs server to transform) | natural (merges in any order) |
| Convergence proof | tricky, many edge cases | mathematically clean |
| Examples | Google Docs, ShareDB | Yjs, Automerge |

**Snapshots** are mandatory either way: replaying 1M ops on open is too slow, so materialize state every ~1,000 ops to S3 and truncate the replay window; a new client loads the latest snapshot + ops since (≤1k), not full history.

**Trade-offs & failure modes.**
- *Algorithm:* OT (compact, mature, needs a central transform authority, complex edge cases) vs CRDT (offline/P2P-friendly, clean convergence, heavier metadata that grows with edits — needs garbage collection of tombstones).
- *Optimistic apply:* edits show instantly and reconcile with the server's `rev` order; a client that diverged catches up by replaying missed ops from its `base_rev`.
- *Server briefly unreachable:* clients keep editing locally and sync on reconnect — CRDT shines here; OT must buffer and replay against the server's order.
- *Failure to avoid:* **permanent divergence**. Never resolve with last-write-wins on the whole document — that discards concurrent edits. Both models are specifically designed to guarantee convergence at the op level.

## 3.6 Live comments / live scores

**Clarify.** Functional: broadcast a high-velocity stream of updates (live sports scores, live-event comments) to a huge audience in near-real-time; late joiners get a snapshot then the live tail. Non-functional: **massive read fan-out** (millions watching one event), at-most-once is acceptable (dropping a stale intermediate update under load is fine), backpressure handling, frequent mobile reconnects. Read-fan-out dominates; live-path durability is minor (the system of record for final scores lives on a separate path). The dominant constraint is fan-out: `updates × viewers` can reach billions of pushes/s, so you cannot push every update to every viewer.

**Estimate (worked).**
```
Concurrent viewers of one event: 10M
Update rate: 10/s (scores) up to 1,000/s (live comments)
Naive fan-out (impossible):
  1,000 updates/s × 10M viewers = 10,000,000,000 = 10B pushes/s   ← cannot do
Broadcast-tree fan-out:
  edge servers each hold ~100k connections → 10M / 100k = 100 edge servers
  pub/sub publishes 1 update → 100 edge servers → each pushes to its 100k locally
  publisher-side work per update = 100 (fan to edge), not 10M
With coalescing (scores):
  collapse to ~1 update/s (latest score wins) → 100 edge fan + 100k local pushes/edge
  effective push rate stays bounded regardless of raw update velocity
Late-joiner buffer: ring buffer of last ~100 updates per channel (~tens of KB)
```
The numbers say: **a broadcast tree bounds publisher work to O(edge servers), and coalescing bounds delivery to viewers** — for live scores you only care about the *latest* value, so under pressure you drop stale intermediate updates rather than queue them.

**API.**
```
WebSocket or SSE: client subscribes to a channel
  → subscribe { "type":"subscribe","channel":"game_88" }
  ← snapshot  { "type":"snapshot","channel":"game_88","state":{"score":"2-1","min":63},"seq":4012 }
  ← update    { "type":"update","channel":"game_88","seq":4013,"data":{"score":"3-1","min":67} }
```
```http
GET /api/v1/channels/game_88/snapshot   → 200 { "state":{...}, "seq":4012 }   # for late joiners / reconnect
```

**Data model.** A **pub/sub topic per event channel** plus a small in-memory ring buffer of recent updates for late joiners and reconnects; no heavy durable storage on the live path.
```
Pub/sub: topic "channel.game_88"   (Kafka / Redis pub/sub) — published once, edge servers subscribe

Redis (per channel, ephemeral):
  KEY channel:game_88:ring   -> LIST capped at 100 (LPUSH + LTRIM)  recent updates for replay
  KEY channel:game_88:state  -> HASH latest materialized state {score,min,seq}
  Example: ring = [ {seq:4013,score:"3-1"}, {seq:4012,score:"2-1"}, ... ]

Durable system-of-record (separate, NON-real-time path):
  final scores / full comment history → Cassandra/RDS, written async
```
Shard key = `channel_id`: each event is an independent broadcast domain; the topic and ring buffer partition cleanly by channel, so a viral game never contends with others.

**Architecture.**
```
 publisher (scoring feed) ─update─▶ ┌──────────────┐  coalesce (latest-wins)
                                    │ pub/sub topic │
                                    │ channel.g88   │
                                    └──┬───┬───┬────┘   1 publish
                          ┌───────────┘   │   └───────────┐
                    ┌─────▼────┐     ┌─────▼────┐    ┌─────▼────┐
                    │ edge srv │     │ edge srv │ ...│ edge srv │  100 edges
                    │ 100k conn│     │ 100k conn│    │ 100k conn│
                    └────┬─────┘     └──────────┘    └──────────┘
                  WS/SSE │ push to local subscribers (drop stale on slow client)
                   millions of viewers
 LATE JOIN / RECONNECT: client → GET snapshot (Redis state) + ring tail → resume live
```
Trace: the scoring feed posts `score 3-1` to the publisher, which `PUBLISH channel.game_88` exactly once. The 100 edge servers subscribed to that topic each receive the single update and push it over WebSocket/SSE to their ~100k locally connected viewers — one publish becomes a two-level tree, keeping publisher work at O(100) not O(10M). The update is also `LPUSH`ed into the channel's Redis ring (trimmed to 100) and the `state` hash updated. A mobile client whose connection just dropped reconnects, calls `GET /channels/game_88/snapshot` to get current state + ring tail, then resumes the live tail — no per-client server state to recover.

**Deep dive — fan-out + backpressure.** The scale forces a **broadcast tree** plus **tolerance for loss**. Three layers each absorb a different dimension: edge servers absorb the *connection count* (100k each), the pub/sub layer absorbs the *message rate*, and **coalescing** absorbs the *update velocity*. Coalescing is the key insight for scores: you only care about the latest value, so each edge keeps a **bounded per-client buffer (newest-wins)** — if a client or link is slow, intermediate scores are dropped and it receives the latest, not a backlog. Concrete: a 50 ms coalescing window collapses a 1,000 updates/s comment burst into ~20 batched flushes/s per client, keeping memory flat and latency low. Compare delivery modes:

| Mode | Delivery | Scales to 10M? | Correctness |
|---|---|---|---|
| Per-update push, ordered, at-least-once | every update to every viewer reliably | no (10B pushes/s) | exact, ordered |
| **Broadcast tree + coalescing (at-most-once)** | latest-wins, drop stale on pressure | yes (O(edges)) | fresh but lossy intermediates |
| Long-poll / client pull | client polls snapshot endpoint | yes, higher latency | eventually consistent |

**Trade-offs & failure modes.**
- *Delivery semantics:* at-most-once with coalescing (scales to millions, may skip intermediate updates) vs at-least-once ordered (correct but cannot survive this fan-out). For ephemeral live data, lossy-but-fresh beats lossless-but-laggy.
- *Edge server dies:* clients reconnect to another edge and get a fresh snapshot + ring tail — no per-client state to recover, so failover is trivial.
- *Backpressure:* bounded newest-wins buffers per client; slow clients get the latest state, never an unbounded queue.
- *Durability split:* the authoritative record (final scores, full comment history) is persisted on a **separate, non-real-time path** (Cassandra/RDS), so the lossy live path never threatens the source of truth.

# 4. Media and content delivery

## 4.1 Image upload service

**Clarify.** Functional: upload an image; store it durably; serve it via fast global URLs; generate resized variants (thumbnail, display, full); attach metadata (owner, dims, caption). Non-functional: durable storage (11 nines on the object store), **multi-MB bytes must never flow through app servers**, p95 CDN delivery < 50 ms worldwide, async processing acceptable (placeholder until variants exist). Write-moderate, read-heavy; **bandwidth, not QPS, is the binding constraint**. Read:write ≈ **50:1** on origin, but CDN absorbs ~95% of reads so origin sees far less.

**Estimate (worked).**
```
Uploads: 100M/day
         100,000,000 / 86,400 s   ≈ 1,160 uploads/s
         peak ×3                   ≈ 3,500 uploads/s
Ingest storage:
         avg original 2 MB
         100M × 2 MB               = 200 TB/day
         × 365                     ≈ 73 PB/year originals
         variants (thumb 20 KB + display 200 KB) ≈ +11% → ~81 PB/year total
Serve bandwidth:
         50 views/image/day × 100M images-equiv hot set
         hot image ~200 KB display variant served
         CDN serves ~95%: origin egress ≈ (1 - 0.95) × peak
         peak serve ≈ 25k images/s × 200 KB ≈ 5 GB/s origin, ~100 GB/s at edge
Processing:
         1 resize+EXIF-strip job ≈ 150 ms CPU
         3,500 uploads/s × ~0.15 CPU-s ≈ 525 cores at peak (async worker fleet)
```
The numbers say: the system is **bytes-dominated**, so the design is "keep payloads off the app tier (pre-signed direct-to-storage) + serve from CDN," with metadata being a rounding error.

**API.**
```http
POST /api/v1/uploads/init
{ "filename": "beach.jpg", "size": 2097152, "content_type": "image/jpeg" }
→ 201 Created
{ "image_id": "img_7Kd2",
  "upload_url": "https://s3.amazonaws.com/raw-bucket/img_7Kd2?X-Amz-Signature=...&X-Amz-Expires=900",
  "method": "PUT" }

PUT https://s3.amazonaws.com/raw-bucket/img_7Kd2?X-Amz-Signature=...   # client → S3 directly
Content-Type: image/jpeg
<2 MB body>
→ 200 OK   (ETag: "9b2f...")          # app servers never see these bytes

POST /api/v1/uploads/img_7Kd2/complete
→ 202 Accepted
{ "image_id": "img_7Kd2", "status": "processing" }

GET /api/v1/images/img_7Kd2
→ 200 OK
{ "image_id": "img_7Kd2", "status": "ready", "width": 4032, "height": 3024,
  "variants": {
    "thumb":   "https://cdn.example.com/img_7Kd2/thumb.jpg",
    "display": "https://cdn.example.com/img_7Kd2/display.jpg",
    "full":    "https://cdn.example.com/img_7Kd2/full.jpg" } }
# while processing → 200 { "status": "processing", "variants": {} }
```

**Data model.** Tiny metadata separated from large blobs. Metadata in **DynamoDB** (point-read by `image_id`); originals + variants in **S3**; variant URLs front a **CloudFront** CDN.
```
Table: images  (DynamoDB)
  image_id    STRING    (partition key)   -- "img_7Kd2"
  owner_id    STRING                       -- "u_123"
  blob_ref    STRING                       -- "s3://raw-bucket/img_7Kd2"
  status      STRING                       -- "uploading" | "processing" | "ready" | "failed"
  width       NUMBER                        -- 4032
  height      NUMBER                        -- 3024
  variants    MAP<STRING,STRING>            -- {"thumb":"...","display":"...","full":"..."}
  content_hash STRING                       -- "sha256:9b2f..."  (dedupe key, GSI)
  created_at  TIMESTAMP
Example item: {"image_id":"img_7Kd2","owner_id":"u_123",
               "blob_ref":"s3://raw-bucket/img_7Kd2","status":"ready",
               "width":4032,"height":3024,
               "variants":{"thumb":"https://cdn.../thumb.jpg","display":"...","full":"..."},
               "content_hash":"sha256:9b2f...","created_at":"2026-06-17T..."}

S3 layout:  raw-bucket/img_7Kd2                 (original, 2 MB)
            derived-bucket/img_7Kd2/thumb.jpg   (200x200, ~20 KB)
            derived-bucket/img_7Kd2/display.jpg (1080w,  ~200 KB)
            derived-bucket/img_7Kd2/full.jpg    (re-encoded original, EXIF stripped)
```
Partition key = `image_id` (hashed → even spread, no hot partition). A GSI on `content_hash` lets the `complete` step skip re-processing an identical blob already seen. **Metadata-vs-blob split is the whole point:** the metadata row is ~300 bytes and lives in a hot point-read store; the 2 MB bytes live in S3 and are served from CloudFront — the two paths never cross.

**Architecture.**
```
UPLOAD:
  client → POST /uploads/init → app server → DynamoDB PutItem(status=uploading)
                                          → S3 pre-signed PUT URL
  client → PUT 2 MB ──────────────────────► S3 raw-bucket           (app tier untouched)
  client → POST /complete → app server → enqueue {image_id} → SQS
                                       → DynamoDB UpdateItem(status=processing)
         worker (ffmpeg/ImageMagick): S3 GET original
                → resize thumb+display, re-encode full, strip EXIF, virus/moderation scan
                → S3 PUT derived-bucket/img_7Kd2/{thumb,display,full}.jpg
                → DynamoDB UpdateItem(status=ready, variants={...})

SERVE:
  client → GET cdn.example.com/img_7Kd2/display.jpg
         → CloudFront edge ──hit (≈95%)──► bytes (p95 ~30ms)
                            └──miss───────► origin = S3 derived-bucket → fill edge → bytes
```
Trace a 2 MB beach photo: client calls `/uploads/init`, gets `img_7Kd2` plus a 15-minute pre-signed S3 URL, and `PUT`s the bytes straight to `raw-bucket` — none of those 2 MB touch an app server. `/complete` drops `{image_id: img_7Kd2}` onto SQS and flips status to `processing`. A worker pulls the job, `GET`s the original from S3, runs **ImageMagick/libvips** to produce a 200×200 thumbnail (~20 KB) and a 1080w display variant (~200 KB), strips EXIF GPS data, runs a moderation classifier, writes the three variants to `derived-bucket`, and flips status to `ready`. The client's feed then references `cdn.example.com/img_7Kd2/display.jpg`; **CloudFront** serves it from the nearest edge, hitting S3 origin only on a cache miss.

**Deep dive — direct-to-storage upload + async variant pipeline.** Two mechanics carry the design. (1) **Pre-signed URLs + multipart upload:** for files above ~100 MB (or flaky mobile uploads), `init` returns a multipart upload id; the client splits the file into 5–10 MB parts, `PUT`s each with its own pre-signed URL, retries individual failed parts, and the server completes the multipart assembly — resumable over bad networks, and the app tier still never sees a byte. (2) **Async variant generation** keeps upload latency decoupled from processing cost.

| Approach | When variants made | Storage | Read latency | Cost driver |
|---|---|---|---|---|
| Pre-generate on upload | at ingest, async | +11% (all variants stored) | fast (just fetch) | storage |
| On-the-fly resize | at first request | ~0 extra | slow first hit, then cached | CPU per cold request |
| **Hybrid** | thumb+display eager, rare sizes lazy | moderate | fast for common sizes | balanced |

For a read-heavy image service, pre-generating the common variants (thumb + display) wins — you pay storage once and serve millions of fast reads; only exotic crop sizes are generated on demand and cached at the edge.

**Trade-offs & failure modes.**
- *Async vs sync processing:* async = fast upload, brief window where the image shows a placeholder; sync = ready immediately but the upload call blocks on resize. Read-heavy serving favors async.
- *Pre-generate vs on-the-fly:* pre-generate common renditions (storage cost) for fast reads; lazily generate rare ones.
- *Pipeline backlog:* if SQS depth grows, originals are safe in S3 and variants generate late — degraded (placeholder lingers), never lost. Scale the worker fleet on queue depth.
- *Origin/CDN failure:* CloudFront masks S3 origin load for popular images; an S3 regional outage blocks **new** uploads and cold-cache reads but cached images keep serving from edge. Cross-region replication for the originals bucket if RTO matters.

## 4.2 YouTube / video platform

**Clarify.** Functional: upload a video; **transcode** into a rendition ladder (multiple resolutions/bitrates); generate thumbnails; stream with adaptive bitrate (HLS/DASH); track view counts; recommend. Non-functional: exabyte-scale storage, peak egress dominates cost (CDN-served), transcoding is the CPU bottleneck and must be async, global startup latency < ~2 s. Read (watch) ≫ write (upload), but each write is huge and expensive to process. Read:write in **bytes** ≈ thousands:1.

**Estimate (worked).**
```
Upload rate:
         500 hours uploaded/min
         500 × 60 / 60 s          = 500 video-hours/min = ~8.3 video-hours/s
Transcode compute:
         6-rung ladder (240p…1080p…4K), real-time-ish encode per rung on 1 core
         8.3 video-hr/s × 6 rungs ≈ 50 core-hours of encode per wall second
         → ~50 × 3600 ≈ 180,000 cores busy to keep up (chunked across the fleet)
Storage:
         source avg 1 GB/hr; ladder ≈ 1.5× source after all rungs
         500 hr/min × 1.5 GB × 60 × 24 × 365 ≈ 394 PB/year (grows toward EB)
Serve bandwidth:
         1B watch-hours/day; avg 720p ≈ 3 Mbit/s
         1B hr/day / 86,400 ≈ 11,600 concurrent hours × 3 Mbit/s ≈ 35 Tbit/s
         CDN serves ~99% → origin egress is a small fraction
```
The numbers say: **transcoding compute and CDN egress are the two costs that dominate**; storage is large but cheap-per-byte and cold-tiered. Design = chunked parallel transcode + ABR + aggressive edge serving.

**API.**
```http
POST /api/v1/videos/init
{ "title": "My trip", "size": 4294967296, "content_type": "video/mp4" }
→ 201 Created
{ "video_id": "vid_9aB3", "upload_id": "mpu_…",
  "part_urls": ["https://s3…/part1?sig=…", "https://s3…/part2?sig=…", ...] }  # multipart

POST /api/v1/videos/vid_9aB3/complete
{ "parts": [{"part":1,"etag":"…"}, ...] }
→ 202 Accepted   { "video_id": "vid_9aB3", "status": "transcoding" }

GET /api/v1/videos/vid_9aB3
→ 200 OK
{ "video_id": "vid_9aB3", "status": "ready", "duration": 612,
  "manifest_url": "https://cdn.example.com/vid_9aB3/master.m3u8",
  "thumb": "https://cdn.example.com/vid_9aB3/thumb.jpg" }

GET https://cdn.example.com/vid_9aB3/master.m3u8     → 200 (HLS master playlist)
GET https://cdn.example.com/vid_9aB3/720p/seg_042.ts → 200 (4-second segment)

POST /api/v1/videos/vid_9aB3/view   → 202 Accepted   # async, fire-and-forget counter
```

**Data model.** Metadata in **PostgreSQL/Vitess**; segments, renditions, and manifests in **S3**; everything player-facing served from **CloudFront**. View counts via the async-counter pattern (Kafka → rollups).
```
Table: videos  (sharded by video_id)
  video_id     BIGINT    (PK, snowflake, time-sortable)
  owner_id     BIGINT
  title        TEXT
  status       TEXT       -- "uploading"|"transcoding"|"ready"|"failed"
  duration_s   INT
  renditions   JSONB      -- [{"label":"720p","bitrate":2800000,"codec":"h264"}, ...]
  thumb_refs   TEXT[]
  source_ref   TEXT       -- "s3://source-bucket/vid_9aB3"
  created_at   TIMESTAMP
Example: {"video_id":1771...042,"owner_id":1234,"title":"My trip",
          "status":"ready","duration_s":612,
          "renditions":[{"label":"240p","bitrate":400000},{"label":"1080p","bitrate":5000000}],
          "thumb_refs":["s3://…/thumb.jpg"],"source_ref":"s3://source-bucket/vid_9aB3"}

S3 layout:  source-bucket/vid_9aB3                       (original 4 GB)
            media-bucket/vid_9aB3/master.m3u8            (master manifest)
            media-bucket/vid_9aB3/720p/index.m3u8        (per-rendition playlist)
            media-bucket/vid_9aB3/720p/seg_000.ts ...    (4-second segments)
```
Shard key = `video_id` (snowflake → time-sortable PK, even spread). **Metadata-vs-blob split:** the `videos` row is small relational metadata; the petabytes of segments live in S3 and are served from CloudFront, so the metadata store never carries playback traffic.

**Architecture.**
```
UPLOAD → TRANSCODE:
  client → multipart pre-signed PUT ─────► S3 source-bucket   (app tier untouched)
  client → /complete → enqueue → transcode orchestrator
       orchestrator: split source into N chunks (e.g. 10s GOP-aligned segments)
            → fan out: chunk×rendition encode jobs to ffmpeg worker fleet
            → each worker: ffmpeg -i chunk → {240p,360p,480p,720p,1080p,4K}
            → reassemble per-rendition segment sets + write HLS/DASH manifests → S3
            → DynamoDB/PG UpdateItem(status=ready, renditions=[...])

SERVE (ABR):
  player → GET cdn/.../master.m3u8 → list of renditions
         → measures bandwidth → GET cdn/.../720p/seg_000.ts, seg_001.ts ...
         → bandwidth drops mid-stream → switches to 480p/seg_NNN.ts seamlessly
         CloudFront edge serves ~99% of segments; S3 origin on miss
```
Trace a 10-minute 4 GB source: the client uploads it as ~5 MB multipart parts straight to `source-bucket`. `/complete` enqueues a transcode job; the **orchestrator** splits the source into GOP-aligned ~10-second chunks and fans out a matrix of (chunk × rendition) encode tasks to an **ffmpeg** worker fleet — a single failed chunk re-runs in isolation rather than restarting the whole video. Each rendition's segments are reassembled into 4-second `.ts` segments plus an HLS playlist, and a master `.m3u8` lists all rungs. The player fetches `master.m3u8`, starts at 480p, measures throughput, and **switches up to 1080p** segment-by-segment as bandwidth allows — every segment from **CloudFront**.

**Deep dive — chunked transcode pipeline + the rendition ladder.** Splitting the source into independent chunks turns hours of serial encoding into minutes of massively parallel work and gives retriable units. The output is a **rendition ladder** — store the video as many small segments per rung so the player can switch per segment:

| Label | Resolution | Bitrate (H.264) | Use |
|---|---|---|---|
| 240p | 426×240 | ~400 kbit/s | weak mobile |
| 360p | 640×360 | ~750 kbit/s | mobile |
| 480p | 854×480 | ~1.2 Mbit/s | default cellular |
| 720p | 1280×720 | ~2.8 Mbit/s | broadband |
| 1080p | 1920×1080 | ~5 Mbit/s | broadband HD |
| 4K | 3840×2160 | ~16 Mbit/s | premium |

Segments are 2–6 s (4 s typical): short enough to switch renditions responsively, long enough to keep per-request overhead and keyframe cost reasonable. **ABR** = the player picks the highest rung its measured throughput sustains, stepping down instantly when the buffer drains — smooth playback over variable networks with no rebuffer.

**Trade-offs & failure modes.**
- *Pre-transcode all vs on-demand:* pre-transcode common rungs (storage + compute up front, instant playback) and lazily generate rare ones (e.g. 4K for a video nobody watches in 4K). Popular platforms pre-transcode the common ladder and defer the rest.
- *Chunk size:* smaller chunks = more parallelism + finer retries but more orchestration overhead; ~10 s GOP-aligned chunks balance both.
- *Transcoding lag:* video sits in `transcoding` (degraded, available later); originals are safe in S3.
- *CDN/origin:* ABR + CDN make playback resilient to bandwidth swings and origin load; an edge miss falls back to S3 origin. View counts are async (Kafka) so a viral video's counter never blocks playback.

## 4.3 Netflix-style streaming

**Clarify.** Functional: stream a **fixed, curated catalog** of professionally encoded titles with adaptive bitrate; browse catalog; resume playback across devices; enforce entitlement/DRM and regional licensing. Non-functional: highest achievable quality and reliability, global scale, **CDN placement is the core problem** — content is known days in advance, so pre-position it near users. Differs from YouTube: ingestion is offline and curated, so you optimize *delivery*, not *transcoding throughput*. Almost pure read; sustained peak egress is a large fraction of total internet traffic.

**Estimate (worked).**
```
Catalog:
         ~50,000 titles × ~2 hr avg
         each pre-encoded into ~10 renditions + codecs (H.264/HEVC/AV1) + audio tracks
         per title ≈ 2 hr × ~6 GB/hr blended ≈ 12 GB × ~3 codec families ≈ ~150 GB
         catalog master ≈ 50,000 × 150 GB ≈ 7.5 PB of static, cacheable content
Edge replication:
         this 7.5 PB (or the hot ~20% ≈ 1.5 PB) is pushed to thousands of edge
         appliances during off-peak hours
Peak serve bandwidth:
         ~100M concurrent streams at prime time × ~5 Mbit/s avg
         ≈ 500 Tbit/s — served ~99.9% from edge appliances, ~0% from origin at peak
```
The numbers say: a finite predictable catalog turns delivery into a **placement + routing** problem — push bytes to the edge before demand, and origin egress at peak approaches zero.

**API.**
```http
GET /api/v1/catalog?region=US-CA&row=trending   → 200 [{title_id, artwork_url, ...}]
GET /api/v1/titles/t_4471                        → 200 {metadata, seasons, artwork}

GET /api/v1/titles/t_4471/manifest
Authorization: Bearer <session>
→ 200 OK   (after entitlement + region check)
{ "manifest_url": "https://edge-ord1.cdn.example.com/t_4471/master.mpd",
  "license_url": "https://license.example.com/widevine",
  "renditions": [...] }
→ 403 Forbidden   { "error": "not_available_in_region" }

POST /api/v1/playback/heartbeat
{ "title_id": "t_4471", "position_s": 1432, "rendition": "1080p", "buffer_health": 18.2 }
→ 204 No Content
```

**Data model.** Catalog metadata in a DB (regionally replicated); pre-encoded segments stored once at origin and **pushed to edge caches**; per-user playback state separate; entitlements checked at manifest issue (strongly consistent).
```
Table: titles
  title_id      STRING (PK)     -- "t_4471"
  name          TEXT
  seasons       JSONB
  artwork_refs  TEXT[]
  availability  JSONB           -- {"US":{"start":"2026-01-01","end":"2027-01-01"},"JP":{...}}
  manifest_ref  STRING          -- "s3://origin/t_4471/master.mpd"

Table: playback_state  (keyed by user_id, title_id)
  user_id     STRING (PK)
  title_id    STRING (SK)
  position_s  INT               -- resume point, e.g. 1432
  updated_at  TIMESTAMP

Edge appliances (Open Connect-style): hold pre-positioned segment files
  t_4471/1080p/seg_000.m4s ... t_4471/4k/seg_NNN.m4s
```
**Metadata-vs-blob split:** catalog metadata and resume state are tiny rows in a regionally-replicated DB; the multi-PB segments are static files pre-pushed to edge appliances. Shard catalog by `title_id`; playback state by `user_id`.

**Architecture.**
```
PRE-POSITION (offline, off-peak):
  encode pipeline → origin S3 (master copy, all renditions/codecs)
  prediction model (per-region demand) → control plane → push hot titles to
       edge appliances embedded in ISPs (Open Connect) during off-peak hours

PLAYBACK:
  client → auth → GET /titles/{id}/manifest
         → entitlement + region check (STRONG consistency)  ──fail──► 403
         → manifest of edge segment URLs + DRM license_url
  client → license server (Widevine/PlayReady) → decrypt keys
         → ABR stream segments from NEAREST healthy edge appliance
  control plane (steering) → continuously routes client to best edge
         → on edge degradation, re-steers to next-best edge mid-stream
```
Trace a user pressing play on a title `t_4471` in California at 8 PM: the client requests the manifest; the service does a **strongly-consistent entitlement + region check** (is this account active, is the title licensed in US-CA right now?), then returns a manifest pointing at segment URLs on the **nearest Open Connect edge appliance** — which already holds those bytes because the control plane pushed them there at 4 AM based on demand prediction. The client fetches a DRM license, then ABR-streams 4-second `.m4s` segments from that edge with near-zero startup latency and zero origin traffic. If that appliance gets congested, the **steering control plane** re-routes the client to the next-best edge between segments.

**Deep dive — predictive CDN placement (the win).** Because the catalog is finite and demand is predictable, you don't pull-cache reactively — you **pre-position proactively**. Analytics forecast per-region demand (a new season drop, a regional hit) and the control plane replicates those titles to ISP-embedded appliances during off-peak hours when backbone capacity is free. By prime time the bytes are already inside the user's ISP, one hop away.

| Strategy | Storage at edge | Peak origin load | Startup latency | Best for |
|---|---|---|---|---|
| Pull-through cache (reactive) | only what was requested | high cold-start spikes | slow first viewer | unpredictable/long-tail |
| **Predictive pre-position** | hot catalog replicated everywhere | ~zero | near-zero | finite predictable catalog |

For a curated catalog, pre-positioning wins decisively — it trades cheap off-peak storage replication for near-zero peak origin bandwidth and best-in-class startup latency. ABR handles last-mile variability exactly as in YouTube.

**Trade-offs & failure modes.**
- *Pre-position vs on-demand pull:* pre-position (huge replication storage, minimal peak origin load, best latency) vs pull caching (less storage, origin/peak spikes, cold-start lag). Finite catalog → pre-position.
- *Consistency split:* entitlements/region licensing must be **strongly consistent** (never serve content a user lost access to or that's geo-blocked); catalog metadata and artwork can be eventually consistent.
- *Edge failure:* the client is steered to another edge; **resume state lives server-side** (heartbeat) so playback continues seamlessly from `position_s` on any device.
- *New release thundering herd:* a popular drop is pre-pushed before launch so the simultaneous-play spike hits edges, not origin.

## 4.4 File sharing service

**Clarify.** Functional: upload files; share via links or with specific users/groups; set **permissions** (view/edit, public/private); versioning; per-user quota; virus scanning. Non-functional: **permission correctness is strong-consistency-critical** — a revoked user must lose access *immediately*; content delivery can be eventually consistent; durable storage. Think Google Drive / Box. Storage-dominated; an ACL check sits on **every** access and must be both fast and authoritative.

**Estimate (worked).**
```
Users / storage:
         100M users × avg 15 GB used
         100M × 15 GB             = 1.5 EB stored (object store)
Uploads:
         50M file ops/day → 50M / 86,400 ≈ 580/s, peak ×3 ≈ 1,740/s
ACL checks:
         every read/download resolves effective permission
         say 500M file reads/day → ~5,800/s avg, peak ~17k/s
         each must resolve direct ACL + inherited folder ACL + link scope in < ~5 ms
Versioning amplification:
         keep last N versions; content-hash dedupe collapses unchanged bytes
         without dedupe, versioning could 3–5× storage on edited files
```
The numbers say: storage and the **per-access ACL resolution** dominate. The design centers on an authoritative, low-latency permission check with correct revocation, plus dedupe to tame versioning cost.

**API.**
```http
POST /api/v1/files/init
{ "name": "budget.xlsx", "size": 524288, "folder_id": "fold_12" }
→ 201 { "file_id": "f_88", "upload_url": "https://s3…?sig=…" }

PUT https://s3…?sig=…   <bytes>   → 200   (client → S3 directly)

POST /api/v1/files/f_88/complete  → 202 { "file_id": "f_88", "status": "scanning" }

GET /api/v1/files/f_88            # after ACL check
→ 200 { "file_id":"f_88","version":3,"download_url":"https://cdn…/f_88?sig=…" }
→ 403 Forbidden                   # caller not in effective ACL

POST /api/v1/files/f_88/share  { "grantee": "u_777", "role": "editor" }  → 200
DELETE /api/v1/files/f_88/share/u_777                                    → 204  # revoke

POST /api/v1/files/f_88/links  { "scope": "view", "expiry": "2026-07-01", "password": "..." }
→ 201 { "token": "lnk_Qz9", "url": "https://share.example.com/lnk_Qz9" }

GET /api/v1/files/f_88/versions → 200 [{ "version":3,"ts":"...","size":524288 }, ...]
```

**Data model.** Metadata + ACLs in **PostgreSQL**; blobs and every version in **S3** (content-addressed for dedupe); downloads via **CloudFront** with signed URLs.
```
files(file_id PK, owner_id, folder_id, name, current_version INT, size BIGINT, created_at)
versions(file_id, version INT, blob_ref TEXT, content_hash TEXT, ts TIMESTAMP,
         PRIMARY KEY(file_id, version))
acls(file_id, principal STRING, role STRING,  -- principal = user|group|"public"
     PRIMARY KEY(file_id, principal))          -- role = viewer|editor|owner
folders(folder_id PK, parent_id, owner_id)     -- inheritance tree
share_links(token PK, file_id, scope, expiry TIMESTAMP, password_hash)

Example version row: {"file_id":"f_88","version":3,
                      "blob_ref":"s3://content/sha256:ab12…","content_hash":"sha256:ab12…",
                      "ts":"2026-06-17T...","size":524288}
S3 layout: content/<sha256>     -- content-addressed; identical bytes stored once
```
Shard by `file_id`; ACLs colocated with the file row. **Metadata-vs-blob split:** `files`/`versions`/`acls` are small relational rows; the bytes are content-addressed blobs in S3 (`content/<sha256>`), so identical content across versions/users is stored exactly once. Folders form an inheritance tree — effective ACL resolves up the tree.

**Architecture.**
```
UPLOAD:
  client → /init → pre-signed S3 PUT → client PUTs bytes → /complete
        → new versions row → blob_ref = content/<hash> (skip PUT if hash exists)
        → async virus scan → on clean, mark shareable; on hit, quarantine

ACCESS (every read):
  client → GET /files/f_88 → app server resolves EFFECTIVE PERMISSION:
        direct acls(f_88, caller)  ∪  inherited folder ACLs up the tree  ∪  link scope
        → authoritative read of CURRENT ACLs (strong consistency / short-TTL+invalidate)
        → allow → signed CloudFront URL ;  deny → 403
SHARE / REVOKE:
  POST /share → insert acls row + invalidate caller's cached ACL
  DELETE /share → delete acls row + invalidate cache  → next access denied immediately
```
Trace revoking access: user A shares `budget.xlsx` with user B (`acls(f_88, u_777, editor)`), then revokes it. The `DELETE` removes the ACL row **and** invalidates any cached entry for `(f_88, u_777)`. B's very next `GET /files/f_88` re-resolves the effective permission — direct ACL (gone), inherited folder ACL (none), link scope (none) — and returns `403` immediately. Because revocation correctness can't tolerate staleness, the ACL check reads the source of truth (or a cache with explicit invalidation + short TTL backstop), never a long-lived cached "allow."

**Deep dive — authoritative ACL resolution + links + versioning.** The crux is **low-latency, correct effective-permission resolution**. A user's access to a file is the union of: a direct grant, inherited folder grants resolved up the tree, group membership, and any active share-link scope. Resolving this on every access while keeping revocation instant is the hard part.

| ACL strategy | Revocation | Read latency | Risk |
|---|---|---|---|
| Read source ACL every access | instant | +1 DB hop per read | hottest path is a DB read |
| Cache ACL, TTL only | lags up to TTL | fast | **stale "allow" after revoke** |
| **Cache + explicit invalidate on change (+ short TTL backstop)** | instant on revoke | fast | small invalidation plumbing |

The third option is the production answer: cache effective permissions, but on any `share`/`revoke`/folder-move, publish an invalidation so the cached entry is dropped — and keep a short TTL so a missed invalidation self-heals. **Versioning** is a copy-on-write chain: each commit adds a `versions` row pointing at a content-addressed blob; identical bytes (same `sha256`) are stored once, so editing one cell in a spreadsheet doesn't duplicate megabytes. Prune by version count/age.

**Trade-offs & failure modes.**
- *Strong-consistency ACL vs cached ACL:* security forces consistency (or cache-with-invalidate) on the auth path — a stale "allow" is a breach.
- *Versioning + dedupe:* trades metadata complexity for large storage savings; prune to bound growth.
- *Virus scan lag:* hold the file as `scanning` rather than sharing it; never expose unscanned bytes.
- *Object-store hiccup:* download fails with a retryable `503`, but a permission check **never** silently grants wrong access — **fail closed** on auth.

## 4.5 Dropbox / file sync

**Clarify.** Functional: keep a folder in sync across a user's devices; detect local changes; upload only what changed; resolve conflicts when two devices edit while offline; dedupe globally. Non-functional: **bandwidth efficiency** — never re-upload a whole file for a small edit; causal consistency across a user's devices; durable; conflict handling with **no silent data loss**. Defining techniques: **content-defined chunking, content-addressed dedupe, and a per-user change journal**.

**Estimate (worked).**
```
Sync efficiency (the whole point):
         edit 10 KB inside a 100 MB file
         whole-file sync:    re-upload 100 MB
         chunk-level sync:   re-upload ~1–2 chunks ≈ 8 MB worst case,
                             with content-defined chunking ≈ ~4 MB (only touched chunks)
         → ~25× less bandwidth on a typical small edit
Chunk store:
         avg chunk 4 MB (variable, content-defined)
         global content-addressed dedupe: a popular shared file's chunks stored once
Change propagation:
         100M devices long-polling /changes; each poll cheap (cursor compare)
         commit rate ~ uploads; journal append is O(1) per change
```
The numbers say: chunk-level diffing plus global content-addressed dedupe collapse bandwidth and storage; the metadata service is the small but critical coordination point.

**API.**
```http
POST /api/v1/chunks/probe
{ "hashes": ["sha256:aa..", "sha256:bb..", "sha256:cc.."] }
→ 200 { "missing": ["sha256:bb.."] }          # server already has aa, cc

PUT /api/v1/chunks/sha256:bb..   <4 MB chunk>  → 201   # upload only missing chunks
                                                        # PUT of existing hash = no-op

POST /api/v1/files/commit
{ "file_id": "f_31", "base_version": 7,
  "chunk_list": ["sha256:aa..","sha256:bb..","sha256:cc.."], "device": "laptop" }
→ 200 { "file_id": "f_31", "version": 8 }
→ 409 Conflict { "server_version": 8, "conflict_copy": "report (laptop's conflicted copy).docx" }

GET /api/v1/changes?cursor=10432            # long-poll
→ 200 { "cursor": 10440,
        "changes": [{ "file_id":"f_31","version":8,"chunk_list":[...] }] }
```

**Data model.** Files = ordered list of chunk hashes; chunks content-addressed in **S3** (global dedupe); metadata in a sharded store; a per-user **change journal** with a monotonic cursor.
```
file_metadata(file_id, version INT, chunk_list TEXT[], device STRING, ts TIMESTAMP,
              PRIMARY KEY(file_id, version))
chunks(hash STRING PK → blob_ref)            -- content-addressed, e.g. "sha256:bb.." → s3://chunks/bb..
change_journal(user_id, seq BIGINT, file_id, version, op,
               PRIMARY KEY(user_id, seq))     -- seq = monotonic per-user cursor

Example file_metadata: {"file_id":"f_31","version":8,
                        "chunk_list":["sha256:aa..","sha256:bb..","sha256:cc.."],
                        "device":"laptop","ts":"2026-06-17T..."}
S3 layout: chunks/<sha256>                    -- each unique chunk stored once globally
```
Shard `file_metadata` and `change_journal` by `user_id` (a device syncs its own user's journal); the **chunk store keyed by content hash** is globally shared so identical chunks from any user/version/file dedupe to one blob. **Metadata-vs-blob split:** the journal and chunk lists are tiny ordered metadata; the bytes are content-addressed chunks in S3, and a "file" is just an ordered list of hashes pointing into that store.

**Architecture.**
```
DETECT (client):
  watch folder → file changed → content-defined chunking (rolling hash boundaries)
              → hash each chunk → diff against last-synced chunk_list

UPLOAD (only the delta):
  client → /chunks/probe {hashes} → server returns {missing}
        → PUT each missing chunk → S3 chunks/<hash>   (existing hash = no-op)
        → POST /commit {chunk_list, base_version}
             base_version current?  → new version, append to change_journal
             base_version stale?    → 409, server creates "conflicted copy"

PROPAGATE (other devices):
  device long-polls GET /changes?cursor=N
        → sees version 8 → /chunks/probe to find chunks it lacks
        → fetch only missing chunks from S3 → reconstruct file from chunk_list
```
Trace editing the middle of a 100 MB document: the client re-chunks the file with **content-defined chunking** so the edit only shifts the boundaries of the chunks it touched, not every chunk after it; it hashes the chunks, calls `/chunks/probe`, and learns only one chunk (`sha256:bb..`) is new. It `PUT`s that single ~4 MB chunk to S3 and commits the new `chunk_list` with `base_version: 7`. The commit appends `seq` to the user's change journal. The user's other devices, long-polling `/changes`, see version 8, probe for the one chunk they lack, fetch just that chunk, and reconstruct the file — kilobytes-to-megabytes of transfer instead of 100 MB.

**Deep dive — content-defined chunking, dedupe, and conflict resolution.** Three mechanics carry it. (1) **Content-defined chunking (CDC):** instead of fixed 4 MB offsets, a rolling hash (Rabin fingerprint) sets chunk boundaries where the *content* matches a pattern — so inserting bytes in the middle only re-chunks the local region; downstream chunk boundaries (and hashes) stay identical, so they dedupe. Fixed-size chunking would reshuffle every boundary after an insert and force re-upload of the whole tail.

| Chunking | Insert in middle | Dedupe quality |
|---|---|---|
| Fixed-size (e.g. 4 MB offsets) | shifts all downstream boundaries → re-upload tail | poor on edits |
| **Content-defined (rolling hash)** | only touched region re-chunks | excellent across edits/versions/users |

(2) **Content-addressed storage:** a chunk's key *is* its hash, so identical chunks across versions, files, and users are physically stored once and a `PUT` of an existing hash is a cheap no-op. (3) **Conflict resolution via base-version check:** every `commit` carries `base_version`. If two offline devices both committed from version 7, the first wins (becomes 8) and the second gets a `409` — the server materializes a **conflicted copy** ("report (laptop's conflicted copy).docx") rather than overwriting. The change journal's monotonic cursor lets each device sync incrementally and causally on reconnect.

**Trade-offs & failure modes.**
- *Chunk-level vs whole-file sync:* chunk-level dedupe (bandwidth-efficient, complex metadata) beats whole-file (simple, wasteful) the moment files are large and edits are small.
- *Conflict policy:* conflicted-copy (safe, occasionally clutters the folder) vs last-write-wins (clean, **loses data**) — sync must never lose user data, so conflicted copies win.
- *Long-offline device:* catches up by replaying the journal from its last cursor on reconnect — no full re-scan.
- *Idempotency:* the chunk store is durable and idempotent (re-`PUT`ting an existing hash is a no-op), so retries on flaky networks are safe; the metadata service is the single consistency anchor.

# 5. Search, discovery, and recommendation

## 5.1 Typeahead / autocomplete

**Clarify.** Functional: as the user types a prefix, return the top-K (usually 10) most-likely completions, ranked by popularity, optionally personalized. Non-functional: **must feel instant** — p99 < 100 ms including network, and it fires on *every keystroke*, so the multiplier on raw search QPS is large. Freshness can lag (a new trending term appearing minutes late is fine). Read-dominated; the suggestion set is rebuilt slowly offline. Read:write ≈ **1000:1** (queries vs index rebuilds).

**Estimate (worked).**
```
Searches:   10M searches/day → 116 searches/s avg
Keystroke multiplier: each search ≈ 30 chars typed, suggest fires per keystroke
            (debounced ~150ms → effectively ~6–10 calls per search)
            116 × 8                  ≈ 930 suggest QPS avg
            peak ×3                  ≈ 2,800 suggest QPS
Index size: top ~10M distinct prefixes; each node caches K=10 completions
            10M prefixes × 10 × (term ~20 B + score 4 B) ≈ 10M × 240 B ≈ 2.4 GB
            trie/FST node overhead ~2× → ~5 GB  → fits in RAM on one box
Shards:     by first 2 chars → 62^2 ≈ 3,844 buckets; group into ~16 shards
            each shard ~300 MB; replicate hot shards (common letters "th","co")
Memory:     whole index RAM-resident; no disk in the query path
```
The numbers say: the index is *small enough to hold in RAM whole*, and the keystroke multiplier means latency, not storage, is the entire game — so precompute everything offline and never rank at query time.

**API.**
```http
GET /suggest?q=piz&limit=10
→ 200 OK
{ "prefix": "piz",
  "suggestions": [
    {"text": "pizza", "score": 982000},
    {"text": "pizza hut", "score": 410000},
    {"text": "pizza near me", "score": 305000}
  ] }

GET /suggest?q=&limit=10        → 200 { "suggestions": [...zero-prefix popular...] }
GET /suggest?q=xqzptv           → 200 { "suggestions": [] }   # no completions, never 404
```

**Data model.** A **trie (prefix tree)** — or a more compact **FST (finite-state transducer)** — where each node stores the precomputed top-K completions reachable below it. Built offline from query logs ranked by frequency. Served from **Redis / in-memory service** (the FST is loaded into process memory).
```
Trie node (precomputed during build):
  prefix      STRING            -- "piz"
  top_k       LIST<(term, score)>  -- [("pizza",982000),("pizza hut",410000),...]  K=10
  children    MAP<char, node*>
Example node "piz":
  { "prefix":"piz",
    "top_k":[["pizza",982000],["pizza hut",410000],["pizza near me",305000], ...],
    "children":{"z":<node "pizz">} }
```
Shard strategy: **partition by prefix** (first 1–2 chars) so each serving node owns a disjoint slice of the keyspace and a query routes to exactly one shard — no scatter-gather. Hot first-letters (e.g. "s", "th") get extra replicas.

**Architecture.**
```
OFFLINE BUILD (hourly/daily):
  query logs ──► aggregate freq per term ──► sort ──► build trie/FST,
              caching top-K at each node ──► snapshot ──► ship to serving nodes

ONLINE QUERY (GET /suggest?q=piz):
  client (debounce 150ms) → edge cache ──hit──► top-K            (p99 ~5ms)
                                        └─miss─► router → shard("pi")
                                                 → walk trie "p"→"i"→"z"
                                                 → return node.top_k  (p99 ~20ms)
```
*Query traced:* `q=piz` is debounced client-side, hits the edge cache; on miss the router hashes prefix `"pi"` to shard 3, which walks its in-memory FST `p → i → z`, reads the node's precomputed `top_k` list, and returns it. Cost is O(prefix length) = 3 pointer hops plus a list copy — no sorting, no scan. Popular prefixes (`"pi"`, `"th"`) are served entirely from edge cache and never touch the FST. Trending terms enter via the next offline rebuild, or via a small in-memory "hot overlay" merged into `top_k` at query time.

**Deep dive — precomputing top-K per node.** The latency budget forbids ranking at query time, so all ranking is pushed into the offline build. During the build, the trie is processed bottom-up: a leaf carries its own term+frequency; an internal node's `top_k` is the merge of its children's `top_k` lists, truncated to K=10. This means each node already holds the answer — query time is a walk + a constant-size list return. Comparison of structures:

| Structure | Memory | Lookup | Fuzzy/typo support | Update cost |
|---|---|---|---|---|
| Trie + per-node top-K | larger (pointers) | O(prefix len) | none (exact prefix) | rebuild segment |
| **FST (compressed)** | **~10× smaller** | O(prefix len) | none | full rebuild |
| Prefix → top-K hash map | medium | O(1) | none | per-key update |
| Edit-distance index (BK-tree) | large | slow | yes | complex |

FST is the usual production pick (Lucene's suggester uses one): same lookup cost as a trie but shares suffixes so 10M prefixes compress to ~hundreds of MB. Fuzzy matching is a separate, heavier layer added only if needed.

**Trade-offs & failure modes.**
- *Precompute vs query-time rank:* precomputed top-K = instant reads but stale by one rebuild cycle; query-time ranking = fresh but blows the 100 ms budget. Latency wins; accept staleness.
- *Index staleness:* new/trending terms are invisible until the next rebuild; mitigate with an hourly rebuild cadence plus a small hot overlay.
- *Shard down:* a prefix shard down means *that letter range* returns no suggestions — the search box still works, just silently. Replicate hot shards so common letters survive a node loss.
- *Memory pressure:* cap completion length and K, prune terms below a frequency floor; FST compression is the main lever.

## 5.2 Search engine

**Clarify.** Functional: crawl/ingest documents, build an **inverted index**, serve ranked full-text queries with snippets and freshness. Non-functional: low query latency (p99 < 200 ms) over billions of docs, relevance ranking, new content searchable within seconds-to-minutes, eventual consistency. Read-heavy serving fronting a write-heavy indexing pipeline. Read:write at serve time ≈ **heavily read**, but the indexing pipeline ingests continuously.

**Estimate (worked).**
```
Corpus:     10B documents, avg 5 KB text each
Query QPS:  60k queries/s avg, peak ~180k/s
Index size: inverted index ≈ 15–30% of raw text after compression
            10B × 5 KB = 50 TB raw → index ~10 TB
Shards:     one machine holds ~50 GB index hot in RAM/SSD
            10 TB / 50 GB  ≈ 200 document-partitioned shards
            ×3 replicas for QPS + fault tolerance ≈ 600 nodes
Fan-out:    each query scatters to all 200 shards in parallel,
            gathers top-N (say 100) per shard → coordinator merges
Posting list (term "database"): ~50M docs × 5 B delta-encoded ≈ 250 MB
```
The numbers say: the index can't live on one machine, so **document-partition** it (every query hits all shards), and ranking must be staged — cheap retrieval narrows 10B → thousands before any expensive model runs.

**API.**
```http
GET /search?q=distributed+systems&page=0&size=10
→ 200 OK
{ "query": "distributed systems",
  "total_hits": 4120000,
  "took_ms": 84,
  "results": [
    {"doc_id":"d_88231","title":"Distributed Systems","url":"https://...",
     "snippet":"...<em>distributed systems</em> are...","score":18.4}
  ] }

# internal indexing
POST /index  { "doc_id":"d_88231", "url":"...", "title":"...", "body":"..." }  → 202 Accepted
```

**Data model.** **Inverted index**: `term → posting list`. Plus a forward document store for snippets/metadata.
```
Inverted index (per shard):
  term         STRING            -- "database"
  posting_list LIST<posting>     -- sorted by doc_id, delta+varint encoded
  posting = { doc_id, term_freq, positions[] }
Example:  "database" → [ {d_101, tf:3, pos:[2,40,88]}, {d_540, tf:1, pos:[7]}, ... ]

Forward store:  doc_id → { url, title, body, pagerank, freshness_ts, quality }
```
Named tech: **Elasticsearch / OpenSearch** (Lucene segments under the hood), or a custom Lucene-based fleet. Shard strategy: **document-partitioned** (each shard indexes a disjoint subset of docs; queries broadcast to all) — scales writes linearly, fault-isolated (a dead shard = slightly fewer results, not an outage). The alternative, term-partitioned (each shard owns a set of terms), needs less network for multi-term queries but suffers hot-term skew ("the" lands on one node) and painful updates.

**Architecture.**
```
OFFLINE / CONTINUOUS INDEXING:
  docs → tokenize+normalize (lowercase, stem, stopword) → build segment
       → compute signals (pagerank, freshness, quality)
       → new docs land in small in-memory segment (searchable in seconds)
       → background merge into larger on-disk segments (LSM-like)

ONLINE QUERY (scatter-gather, then rank):
  query → parse → broadcast to all 200 shards (parallel)
        each shard: intersect posting lists → BM25 score → return local top-100
        coordinator: merge 200×100 → re-rank top-1000 with learned model
                   → fetch snippets from forward store → return top-10
```
*Query traced:* `q="distributed systems"` parses to two terms, broadcasts to all 200 shards. Each shard intersects the `distributed` and `systems` posting lists (a merge-join on sorted doc_ids), scores survivors with **BM25**, and returns its local top-100 with partial scores. The coordinator merges 200×100 = 20k candidates, takes the global top-1000, runs a **learned-to-rank model** (gradient-boosted trees / a neural ranker over features like BM25, pagerank, freshness, click-through) to order them, fetches snippets for the top-10 from the forward store, and returns. Popular-query results and hot-term posting lists are cached.

**Deep dive — multi-stage ranking + freshness.** Scoring 4M matching docs with an expensive ML model per query is impossible at 180k QPS, so ranking is **staged**: stage 1 retrieval (BM25, posting-list intersection) narrows billions → thousands cheaply; stage 2 re-ranking runs the costly learned model only on the top ~1000. This trades a tiny recall loss for a huge latency/cost win. **Freshness** comes from segmented indexes (Lucene's design): writes go to a small in-memory segment that becomes searchable on the next refresh (~1 s default), and a background process merges small segments into large immutable ones, so indexing never blocks queries. Comparison of partition strategies:

| Strategy | Query fan-out | Write/update | Hot-term skew | Fault isolation |
|---|---|---|---|---|
| **Document-partitioned** | all shards (high) | local, easy | none | excellent (partial results) |
| Term-partitioned | only shards with the terms (low) | rewrite whole posting list | severe ("the","is") | poor (term gone = wrong results) |

Document-partitioning is the standard answer; the extra fan-out is parallelized and cheap relative to its operational simplicity.

**Trade-offs & failure modes.**
- *Document- vs term-partitioned:* document wins on scalability, fault isolation, and update simplicity; term-partitioning only pays off in narrow low-fan-out scenarios.
- *Multi-stage ranking:* small recall loss at stage 1 in exchange for affordable latency — tune candidate count (1000) to balance quality vs cost.
- *Index staleness:* a new doc is searchable seconds-to-minutes after ingest (segment refresh + replication lag); acceptable for web search.
- *Shard down → partial results:* return degraded recall (fewer hits) rather than failing the query; mark results partial. Background merges/rebuilds never block the query path.

## 5.3 Product search

**Clarify.** Functional: search a product catalog with **filters/facets** (price, brand, category, ratings, in-stock), sorting, relevance ranking, and live facet counts. Non-functional: low latency (p99 < 150 ms), facet aggregation must be fast, near-real-time price/stock updates, business-driven ranking (promoted/high-margin items). Read-heavy, combining full-text relevance with structured filtering. Read:write ≈ **50:1** (searches vs catalog updates).

**Estimate (worked).**
```
Catalog:    10M SKUs (far smaller than web search)
Query QPS:  20k searches/s avg, peak ~60k/s
Index size: denormalized doc ~2 KB (title, desc, attrs, price, stock, ratings)
            10M × 2 KB = 20 GB  → fits on a few nodes, fully in RAM
Shards:     by category or product_id → ~10 shards × 3 replicas = 30 nodes
            each shard ~2 GB index
Facets:     per query, aggregate counts over matching set across ~8 attributes
            doc-values (columnar) → single pass over matches, not N queries
Updates:    price/stock changes ~5k/s via CDC → reindex affected docs in <1s
```
The numbers say: the catalog is small enough to keep the **whole denormalized index in RAM**, so the challenge isn't scale — it's doing text match + structured filter + facet counts + sort in *one* query without joins.

**API.**
```http
GET /search?q=running+shoes&filters[brand]=Nike&filters[price]=50-100&sort=price_asc&page=0
→ 200 OK
{ "total": 842,
  "results": [
    {"sku":"S-9981","title":"Nike Pegasus 40","price":94.99,"in_stock":true,"rating":4.6} ],
  "facets": {
    "brand":      [{"Nike":842},{"Adidas":611},{"Asics":233}],
    "price":      [{"0-50":120},{"50-100":540},{"100+":182}],
    "rating":     [{"4+":700},{"3+":140}]
  } }
```

**Data model.** A **denormalized search document per product** — one query-shaped row containing everything needed to match, filter, facet, sort, and render, so no joins at query time.
```
Search doc (Elasticsearch/OpenSearch):
  sku          KEYWORD       -- "S-9981"
  title        TEXT          -- analyzed (inverted index)        → relevance
  description  TEXT          -- analyzed
  brand        KEYWORD       -- doc-value (columnar)             → filter + facet
  category     KEYWORD       -- doc-value
  price        SCALED_FLOAT  -- doc-value                        → filter + sort + facet
  rating       HALF_FLOAT    -- doc-value
  in_stock     BOOLEAN       -- doc-value
  promoted     BOOLEAN, margin FLOAT                             → business ranking
Example: {"sku":"S-9981","title":"Nike Pegasus 40","brand":"Nike","category":"shoes",
          "price":94.99,"rating":4.6,"in_stock":true,"promoted":false,"margin":0.22}
```
Named tech: **Elasticsearch / OpenSearch / Solr**. Text fields use the inverted index; filterable/facetable fields use **doc-values (columnar on-disk arrays)** so aggregations are a single columnar scan over the matching set, not N count queries. Shard strategy: **by product_id (hash)** for even spread, or **by category** if queries are category-scoped. Catalog DB is the source of truth; the index is a derived, eventually-consistent copy.

**Architecture.**
```
INDEXING (CDC pipeline):
  catalog DB (source of truth) ──CDC/events──► transform → denormalize
       → upsert search doc into index   (price/stock change → reindex that SKU, <1s)

QUERY (single multi-clause request):
  request → build query:
       must:   text relevance on title/description  (BM25)
       filter: brand=Nike AND price∈[50,100]        (doc-values, no scoring)
       → match set
       → aggregate facet counts over match set (columnar pass, all attrs at once)
       → rank: relevance × business boosts (in_stock↑, promoted↑, margin↑)
       → sort/paginate → return results + facet_counts
```
*Query traced:* `q="running shoes"` with `brand=Nike, price=50-100` builds one query. The text clause scores `title`/`description` via BM25; the `filter` clauses (non-scoring, cacheable bitsets) narrow to in-bounds Nike products. Over that matching set, a single columnar pass computes facet counts for brand/price/rating simultaneously. A function-score then boosts in-stock and promoted items before sorting by price ascending. All in one round trip, no joins.

**Deep dive — facets + relevance in one pass.** Facet counts answer "of the results, how many in each brand/price bucket?" Naively that's one COUNT query per attribute value; instead, search engines store filterable fields as **doc-values** (a columnar array indexed by internal doc id), so computing all facet counts is a single sequential pass over the matching doc ids — O(matches × attrs), fully cache-friendly. Filter clauses are cached as **bitsets** keyed by `(field, value)`, so a repeated `brand=Nike` reuses a precomputed bitmap. Relevance blends the BM25 text score with business signals via a **function_score** (or a learn-to-rank model): `final = bm25 × stock_boost × promo_boost`. The whole approach hinges on the **denormalized index** — the cost is keeping it synced with the catalog via CDC (eventual consistency).

**Trade-offs & failure modes.**
- *Denormalized index vs query the relational DB directly:* the index gives fast text+facet+sort but is eventually consistent and must be synced; the DB is always consistent but can't do text relevance + facets at scale. Search products pick the index.
- *Index staleness:* stale price/stock is the main risk — keep CDC reindex lag under ~1 s, and **re-check stock at add-to-cart** against the authoritative DB (never let the index gate a purchase).
- *Shard down → partial results:* fall back to category browse or cached popular results for the affected slice rather than erroring.
- *Facet cost on huge result sets:* a query matching millions of docs makes faceting expensive — cap with sampling or pre-aggregated facet caches for broad queries.

## 5.4 Recommendation feed

**Clarify.** Functional: generate a personalized ranked feed of items for each user, balancing predicted relevance with **exploration** (surfacing new things) and incorporating feedback (clicks/likes/skips). Non-functional: low-latency online ranking (p99 < 150 ms), heavy offline model/feature computation, must avoid filter-bubble/feedback-loop collapse, eventual consistency. A **two-plane** system: offline (batch training + feature precompute) and online (candidate-gen → rank). Read-heavy serving; continuous async feedback ingest.

**Estimate (worked).**
```
Users:      50M DAU, each requests a feed ~10×/day → 500M req/day
            500M / 86,400  ≈ 5,800 req/s avg, peak ~17k/s
Items:      5M candidate items in the catalog
Scoring:    can't score 5M items × 5,800 req/s = 29B scores/s online
            → candidate generation narrows 5M → ~500 per request
            then rank 500 with the model → 500 × 5,800 ≈ 2.9M scores/s  (tractable)
Feature store: 50M users × 200 features × 4 B ≈ 40 GB user features
               5M items × 200 features × 4 B  ≈ 4 GB item features  → RAM-resident KV
Embeddings: user/item vectors 128-dim float → ANN index (HNSW) for similar-item gen
Offline:    retrain ranking model + recompute embeddings nightly (or hourly)
```
The numbers say: scoring every item per request is impossible, so the architecture is forced into **candidate generation (5M → ~500) then ranking (~500)**, with heavy work pushed offline and only ~500 cheap online scores per request.

**API.**
```http
GET /recommendations?user_id=u_771&context=home&limit=20
→ 200 OK
{ "user_id":"u_771",
  "items":[
    {"item_id":"i_4410","score":0.91,"source":"collaborative","reason":"because you liked X"},
    {"item_id":"i_2087","score":0.64,"source":"exploration"} ],
  "model_version":"rank_v37" }

POST /feedback  { "user_id":"u_771","item_id":"i_4410","event":"click","ts":"..." }  → 202 Accepted
```

**Data model.** A **feature store** plus multiple candidate sources plus a model-serving layer.
```
Feature store (online KV, e.g. Redis/Feast):
  user:u_771 → { recent_clicks:[...], cluster_id:42, embedding:[128 floats], ... }
  item:i_4410 → { category, popularity_7d, embedding:[128 floats], ctr, ... }

Candidate sources:
  trending      → top-K popular items (per region)            (precomputed)
  collaborative → item-item neighbors via co-occurrence/ALS    (precomputed)
  content-based → ANN nearest items to user's recent embeddings (HNSW index)
  recent-interest → items in categories the user just engaged

Interaction log:  (user_id, item_id, event, ts)  → offline training + near-RT features
```
Named tech: **feature store** (Feast / Redis), **ANN index** (HNSW / FAISS) for embedding similarity, a **model server** (TensorFlow Serving / a GBDT scorer). Per-user state keyed by `user_id`.

**Architecture.**
```
OFFLINE (batch, nightly/hourly):
  interaction logs ──► train ranking model (GBDT / DNN)
                   ──► compute user+item embeddings ──► load ANN index
                   ──► precompute candidate pools (item-item sim, user clusters, trending)
                   ──► write features to feature store

ONLINE (serving, per request):
  request → CANDIDATE GEN: union of sources → ~500 candidates
          → RANK: fetch features (precomputed + few real-time) → model.score(500)
          → RE-RANK: diversity + dedupe + business rules + EXPLORATION inject
          → return top-20
  (async) clicks/skips → log → near-RT feature update + next training cycle
```
*Request traced:* `user_id=u_771` requests the home feed. Candidate generation unions ~200 collaborative-filtering neighbors of recently-liked items, ~150 ANN-nearest items to the user's embedding, ~100 trending, ~50 recent-interest → ~500 deduped candidates. The ranker fetches each candidate's features (mostly precomputed from the feature store, plus a few real-time signals like "viewed in last 5 min"), scores all ~500 with model `rank_v37`, then re-ranking applies diversity (cap items per category), dedupe, business rules, and **injects exploration** items before returning the top-20.

**Deep dive — offline/online split + exploration.** The two-plane split *is* the architecture: heavy model training and embedding computation run offline in batch; online serving does fast candidate-gen + a single batched model scoring over ~500 items using precomputed features. A **feature store** serves the *same* feature definitions to both training and serving to prevent **training-serving skew** (the classic bug where offline-computed features differ subtly from online ones, silently degrading the live model). **Exploration is essential**: pure exploitation creates a feedback loop where the model only ever sees items it already recommends, so it never gathers signal on everything else and the catalog collapses to a few hits. Inject exploration via **ε-greedy** (with ε ≈ 0.1, replace ~10% of slots with less-certain candidates) or a **contextual bandit** (Thompson sampling / UCB) that picks items by an upper-confidence-bound on reward — preferring items the model is *uncertain* about, which yields better long-run learning than fixed-ε. Tune ε down as the model matures.

**Trade-offs & failure modes.**
- *Exploitation vs exploration:* exploitation maximizes predicted relevance now; exploration sacrifices short-term clicks for long-term learning and diversity. Tune the mix (ε or bandit width); too little exploration → filter-bubble collapse, too much → noisy feed.
- *Offline/online split:* trades freshness (the model lags by one training cycle — minutes to a day) for tractable serving cost.
- *Cold start:* a new user/item has no history → fall back to popularity/content-based recs (use item attributes + trending) until enough signal accrues.
- *Model server down:* fall back to trending/popular candidates with no ML ranking — degraded personalization but still a usable feed.

## 5.5 Trending topics

**Clarify.** Functional: surface the currently trending terms/hashtags over a recent window (last hour/day), ranked by **velocity** (rate of rise), not just raw volume, optionally per region. Non-functional: **approximate is fine**, near-real-time (refreshed every few seconds), must absorb huge event streams and millions of distinct terms cheaply, resist spam. A streaming **heavy-hitters** problem. Write-heavy ingest, read-light serving.

**Estimate (worked).**
```
Events:     2M term-occurrence events/s (every post/search emits terms)
Cardinality: ~5M distinct terms per hour
Exact counts: 5M terms × (term ~20 B + counter 8 B) × per-window
              × many regions → 100s of MB–GB per window, churning constantly
Count-Min Sketch: width w = e/ε, depth d = ln(1/δ)
              ε=0.001 (0.1% of total count overcount), δ=0.001
              w = ⌈e/0.001⌉ ≈ 2,719 ;  d = ⌈ln(1000)⌉ ≈ 7
              table = w × d × 4 B = 2,719 × 7 × 4 ≈ 76 KB  per window  (vs GB exact!)
Top-K heap:  K=50 leaders → ~50 × 28 B ≈ 1.4 KB
Windows:     sliding 1h split into 60×1-min buckets → 60 sketches, ~4.5 MB total
```
The numbers say: exact per-term counts over millions of terms × sliding windows cost GB and churn constantly, but you only need the *top* terms — so a **Count-Min Sketch** (76 KB) plus a top-K heap replaces the whole exact map.

**API.**
```http
GET /trending?window=1h&region=US&limit=10
→ 200 OK
{ "window":"1h", "region":"US", "as_of":"2026-06-17T14:30:05Z",
  "trending":[
    {"term":"#WorldCup","score":98.2,"count_est":412000,"velocity":3.4},
    {"term":"heatwave","score":71.5,"count_est":188000,"velocity":2.1} ] }

# internal: stream of term-occurrence events
{ "term":"#WorldCup", "user_id":"u_55", "region":"US", "ts":"..." }
```

**Data model.** Sliding-window frequency, approximated with a **Count-Min Sketch** per time bucket, plus a **top-K min-heap** of heavy hitters, plus a **HyperLogLog** per candidate term for unique-user counts (spam resistance).
```
Per 1-min bucket, per region:
  cms        Count-Min Sketch (d=7 × w=2,719 uint32)   -- term → est frequency
  topk       min-heap of (term, est_count), size 50    -- current leaders
  hll[term]  HyperLogLog (per heavy-hitter term)        -- unique users (~2% error)
Trend score = f(recent_rate, baseline_rate)
            = (count_window / window_len) / (count_baseline / baseline_len)
  → favors RISING terms over always-popular ones
```
Named tech: **Kafka** (ingest, partitioned by term hash) + **Flink / streaming job** (sketch maintenance), results cached in **Redis**. Partition the stream **by term hash** so each term's events land on one worker, making per-term sketch updates local.

**Architecture.**
```
INGEST:
  posts/searches → emit term events → Kafka (partition by hash(term))

AGGREGATE (streaming job, per partition):
  per event → cms.add(term) ; if term qualifies → hll[term].add(user_id)
  per 1-min tick → roll bucket; maintain 60-bucket sliding window
                 → compute trend_score(recent_rate vs baseline) per candidate
                 → update top-K heap ; filter terms with low unique-user count (spam)

SERVE:
  GET /trending → read cached top-K (refreshed every few seconds from Redis)
```
*Event traced:* a post containing `#WorldCup` emits a term event keyed by `hash("#WorldCup")`, routing to a fixed Kafka partition and its streaming worker. The worker does `cms.add("#WorldCup")` (7 hash-and-increment ops) and, since it's a heavy-hitter candidate, `hll.add(user_id)` to track unique users. Every minute the window rolls (oldest 1-min bucket drops out, new one starts), the trend score is recomputed as recent-rate ÷ baseline-rate, the top-K heap is updated, and terms whose unique-user count is suspiciously low relative to volume are filtered as spam. Serving just reads the cached top-K.

**Deep dive — approximate heavy hitters over sliding windows.** Exact counting over millions of terms × multiple sliding windows × regions is memory-prohibitive, and exactness is unnecessary — you only need the *top* terms. **Count-Min Sketch** stores frequency in a fixed `d × w` table: each term hashes to one cell per row via `d` independent hash functions; `add` increments those `d` cells, and the estimate is the **minimum** across them (the min cancels most collision overcount). With ε=0.001, δ=0.001 the table is ~76 KB yet bounds overcount to 0.1% of total volume with 99.9% probability — never *under*counts, which is what matters for finding leaders. A **top-K min-heap** tracks the current leaders so serving is O(1). **Sliding/decaying windows** (60×1-min buckets, or exponential decay) ensure recency — trending is about *now*. To catch *rising* topics rather than perennially-popular ones, the score compares current-window rate against a baseline (velocity, not volume), so a sudden spike outranks a steady giant. **Per-user dedup via HyperLogLog** (counts unique users in ~1.5 KB at ~2% error) prevents one spammer from manufacturing a trend by posting a term thousands of times.

**Trade-offs & failure modes.**
- *Approximate vs exact:* Count-Min + HLL use tiny memory and scale, at the cost of bounded count error; exact counts are precise but memory-prohibitive at this cardinality. Trending tolerates approximation easily.
- *Velocity vs volume scoring:* velocity catches emerging trends but is noisier (a tiny term doubling looks "trending"); raw volume is stable but misses spikes. Blend them and apply a minimum-volume floor.
- *Spam/manipulation:* the real failure mode — weight by unique users (HLL), apply anomaly detection on suspicious spikes, and rate-limit per account before counting.
- *Stream lag → stale trends:* if Kafka/Flink backs up, trending is simply a few seconds-to-minutes stale, which is acceptable; serving keeps returning the last cached top-K.

# 6. Geo and location systems

## 6.1 Nearby restaurants (proximity search)

**Clarify.** Functional: given a location, return places within radius R (or the K nearest), with filters (cuisine, open now) and ranking (distance, rating). Non-functional: read p99 < 100 ms (in the map-pan path), data is **mostly static** (a restaurant's location changes ~never), durability is easy. The hard part is **indexing 2D space** so "near me" isn't a full table scan. Read:write ≈ **1000:1** (every pan/search reads; places are added rarely).

**Estimate (worked).**
```
Places:        20M restaurants worldwide
Query QPS:     50M searches/day → 50,000,000 / 86,400 ≈ 580 QPS avg, peak ×5 ≈ 3,000 QPS
Writes:        ~10k new/edited places/day ≈ 0.1 writes/s  (negligible)
Index memory:  place_id(8) + geohash(8) + lat/lng(16) + score(4) ≈ 40 B/place
               20M × 40 B ≈ 800 MB  → whole geo-index fits in RAM on one node
Cell count:    geohash precision 6 ≈ 1.2 km × 0.6 km cells; land area ~1.5×10^8 km²
               ≈ 2×10^8 cells, but only ~5M cells are non-empty (places cluster in cities)
Candidates/query: dense downtown cell ≈ 200 places; query 1 cell + 8 neighbors ≈ 1,800 candidates
```
The numbers say: data is *tiny and static*, the system is *read-dominated*, so the design is "in-memory spatial index + aggressive cache," not a write-scaling problem.

**API.**
```http
GET /nearby?lat=37.7749&lng=-122.4194&radius_m=1500&cuisine=ramen&open_now=true&limit=20
→ 200 OK
{ "results": [
    { "place_id": "p_8821", "name": "Ramen Yamadaya", "dist_m": 240, "rating": 4.6, "geohash": "9q8yyk" },
    { "place_id": "p_4410", "name": "Orenchi", "dist_m": 910, "rating": 4.4, "geohash": "9q8yym" }
  ], "count": 2 }

GET /nearby?lat=37.77&lng=-122.41        → 400 Bad Request   { "error": "radius_m required" }
GET /nearby?lat=999&lng=-122.41          → 422 Unprocessable  { "error": "lat out of range" }
```

**Data model.** You can't range-scan lat AND lng independently (a B-tree is 1D). Encode 2D into 1D so a single range/prefix scan finds neighbors.
```
Geohash encoding: interleave lat/lng bits, base32. SF point (37.7749, -122.4194):
  precision 5 = "9q8yy"  (≈4.9 km × 4.9 km)
  precision 6 = "9q8yyk" (≈1.2 km × 0.6 km)   ← shared prefix ⇒ spatial proximity
  precision 7 = "9q8yyk8"(≈153 m × 153 m)

Index (in-memory, Redis or process-local map):
  cell:9q8yyk → SET{ p_8821, p_4410, ... }       -- inverted: cell → place_ids
  place:p_8821 → { lat, lng, geohash, cuisine, rating, open_hours }   -- HASH

Example row: {"place_id":"p_8821","lat":37.7763,"lng":-122.4180,
              "geohash":"9q8yyk","cuisine":"ramen","rating":4.6}
```
Named tech: **Redis GEO** (`GEOADD`/`GEOSEARCH`, which stores a 52-bit geohash in a sorted set) for a turnkey index, or an **in-memory quadtree** when you want density-adaptive cells. Shard key = **geohash prefix** so a city's places colocate on one node and a query touches one shard.

**Architecture.**
```
WRITE (rare — add/edit place):
  admin → app → geohash(lat,lng,6)="9q8yyk" → SADD cell:9q8yyk p_8821
                                            → HSET place:p_8821 {...} → invalidate area cache

READ (GET /nearby?lat=37.7749&lng=-122.4194&radius=1500):
  client → CDN/LB → app server
    1. q = geohash(37.7749,-122.4194,6) = "9q8yyk"
    2. cells = q + 8 neighbors = {9q8yyk, 9q8yym, 9q8yyj, 9q8yyh, 9q8yy7, ...}
    3. candidates = SUNION of those 9 cell sets   (≈1,800 place_ids in a dense area)
    4. for each: load place hash → haversine dist → drop > 1500 m → apply filters
    5. rank by (dist, rating) → top-20 → 200 OK
```
Concrete trace: the query point `(37.7749, -122.4194)` hashes to cell `"9q8yyk"`. A restaurant 240 m away sits in `"9q8yyk"` too, but one 50 m across the cell's eastern edge lands in `"9q8yym"` — that's why we always read the **8 neighbor cells**, not just the home cell. Candidates flow through an exact haversine filter (the geohash box is only an approximation) and rank. Popular city-center results cache in Redis with a short TTL since the underlying data is static.

**Deep dive — spatial index choice.** The trick is collapsing 2D proximity into 1D contiguity so a range/prefix scan finds neighbors. Geohash precision must match the query radius: a precision-6 cell (~1.2 km) suits a ~1.5 km radius — coarser and you scan thousands of irrelevant candidates, finer and you must union dozens of cells. The boundary discontinuity (two points 50 m apart can differ at the first prefix character) is fixed by always querying the 8 neighbors.

| Index | Encoding | Boundary handling | Density adaptation | Best for |
|---|---|---|---|---|
| **Geohash** | base32 prefix string ("9q8yyk") | discontinuous — query 8 neighbors | fixed cell size (uneven counts) | any KV/SQL store, simplest |
| **S2** | 64-bit Hilbert-curve cell id | continuous, hierarchical levels 0–30 | choose level per region | proximity-accurate, Google-scale |
| **Quadtree** | recursive 4-way subdivision | parent/child traversal | subdivides dense areas | uneven density (cities vs ocean) |

**Trade-offs & failure modes.**
- *In-memory vs durable:* the 800 MB index lives in RAM (Redis) for speed; the source of truth is a relational/KV store. On node restart, rebuild the index from the source — slow data means this is cheap.
- *Fixed cells vs quadtree:* fixed geohash precision gives uneven candidate counts (200 in downtown SF, 1 in the desert); a quadtree balances this at the cost of complexity.
- *Stale index:* a newly added restaurant is eventually consistent — acceptable for this domain.
- *Dense-area hotspots:* downtown cells dominate query cost; mitigate with finer precision for hot regions plus result caching.

## 6.2 Uber nearby drivers

**Clarify.** Functional: drivers stream location continuously; riders query nearby *available* drivers; match a rider to a driver. Non-functional: **very high write rate** (every driver pings every few seconds), reads need only *recent* positions (seconds-stale is fine), match latency < 1 s. Unlike static restaurants, the data is in constant motion — **writes dominate**. Per-ping durability is irrelevant; only the latest position matters. Write:read ≈ **20:1**.

**Estimate (worked).**
```
Location writes: 1M active drivers, ping every 4 s
                 1,000,000 / 4 ≈ 250,000 location writes/s   (overwrite-latest, not append)
Query QPS:       100k rider searches/min ≈ 1,700 QPS, peak ×5 ≈ 8,500 QPS
Index memory:    driver_id(8) + lat/lng(16) + cell(8) + status(1) + ts(8) ≈ 40 B/driver
                 1M × 40 B ≈ 40 MB live working set  → easily in RAM, sharded by region
Cell counts:     geohash precision 6 (~1.2 km); a busy city ≈ 5,000 active cells
                 downtown cell at rush hour ≈ 300 drivers
Freshness:       a driver silent > 10 s (≈2.5 missed pings) is treated as offline
```
The numbers say: 250k overwrite-writes/s is the whole game — this is a **write-storm + freshness** problem, solved by an in-memory overwrite-latest index, not by durable storage.

**API.**
```http
POST /location                              # driver app, every ~4s
{ "driver_id": "d_55", "lat": 37.7751, "lng": -122.4188, "status": "available" }
→ 204 No Content                            # fire-and-forget; no body, minimal latency

GET /drivers/nearby?lat=37.7749&lng=-122.4194&radius_m=2000&limit=10
→ 200 OK
{ "drivers": [ { "driver_id": "d_55", "dist_m": 180, "eta_s": 90, "updated_age_s": 2 } ] }

POST /match { "rider_id": "r_9", "lat": 37.7749, "lng": -122.4194 }
→ 200 OK   { "driver_id": "d_55", "eta_s": 90 }
→ 503 Service Unavailable   { "error": "no drivers available" }
```

**Data model.** An **in-memory geo-index** holding each driver's *current* cell, overwritten every ping.
```
Redis GEO per region shard:
  GEOADD drivers:sf -122.4188 37.7751 d_55     -- updates d_55's position in place (no append)
  driver:d_55 → { status:"available", updated_at:1718600000, vehicle:"uberx" }  -- HASH, EX 12

Schema (latest-only, overwrite each ping):
  driver_id   STRING  (key)     -- "d_55"
  cell        STRING            -- "9q8yyk"  (derived from lat/lng)
  lat, lng    FLOAT
  status      ENUM(available|on_trip|offline)
  updated_at  TIMESTAMP         -- freshness gate
```
Named tech: **Redis GEO** (sorted-set geohash) per region, or a sharded in-memory quadtree. Shard key = **geohash cell / region** (geographic sharding) so a city's writes and the reads that need them colocate on the same node; cross-region queries are rare.

**Architecture.**
```
LOCATION UPDATE (POST /location, 250k/s):
  driver app → regional gateway (by city) → GEOADD drivers:sf  (overwrite d_55's point)
            → HSET driver:d_55 status,updated_at  EX 12   → 204   (no durable write)
            (optional) sample 1/20 pings → Kafka → trip-history / analytics

NEARBY QUERY (GET /drivers/nearby):
  rider → regional shard for cell "9q8yyk"
    1. GEOSEARCH drivers:sf FROMLONLAT -122.4194 37.7749 BYRADIUS 2000 m  (cell + neighbors implicit)
    2. for each candidate: HGET driver:* → drop status≠available
    3. drop updated_age_s > 10  (stale ⇒ disconnected)
    4. rank by ETA → top-10 → 200 OK
```
Concrete trace: driver `d_55` at `(37.7751, -122.4188)` pings; the gateway routes by the `"9q8yyk"` cell to the `drivers:sf` shard and does an in-place `GEOADD` — the previous position is simply overwritten, so there's no history to garbage-collect. A rider query at `(37.7749, -122.4194)` lands on the same shard, runs `GEOSEARCH` over the home cell plus neighbors, filters out any driver whose `updated_at` is older than 10 s (a disconnected driver self-expires via the 12-second key TTL), and ranks by ETA.

**Deep dive — high-rate writes + stale-location filtering.** 250k writes/s forbids a durable per-ping write (that's a B-tree-killing append rate with zero value, since yesterday's GPS point is worthless). The index is **in-memory, overwrite-latest**: each ping mutates exactly one entry. Freshness replaces durability — a driver silent for > 10 s (about 2.5 missed 4-second pings) is filtered out at query time, and the Redis key's 12 s TTL means disconnects need **no explicit cleanup**. Geographic sharding bounds each node's working set to one region (~40 MB / city) and colocates writes with the reads that consume them, so no cross-node coordination is needed. Reads tolerate seconds of staleness, so the whole path is coordination-free.

**Trade-offs & failure modes.**
- *In-memory overwrite-latest (sustains 250k writes/s, loses history) vs durable per-ping (full trace, can't sustain the rate):* matching needs only "now," so in-memory wins; sample 1/20 pings to Kafka if a history is needed.
- *Stale-location filtering* turns disconnects into a non-event (TTL + `updated_at` gate) — no cleanup job.
- *Dense-area hotspots:* downtown at rush hour concentrates both writes and queries on one cell/shard; split hot regions into finer cells across more nodes.
- *Shard node failure:* drivers re-register on their next ping within ~4 s (self-healing); that region has briefly degraded coverage, not data loss.

## 6.3 Food delivery tracking

**Clarify.** Functional: track a courier's live location during a delivery and stream it to a small set of watchers (customer, merchant, support) in near-real-time; show ETA. Non-functional: **small fan-out per trip** (1 courier → ~3 watchers), mobile **battery efficiency** (don't over-ping), eventual consistency (a few seconds of lag is fine). Combines geo writes + real-time push, scoped to *active* trips only. Write-heavy per active trip.

**Estimate (worked).**
```
Active trips:    200k concurrent deliveries at peak
Location writes: courier pings adaptively, ~1 ping / 5 s while moving
                 200,000 / 5 ≈ 40,000 location writes/s
Fan-out:         ~3 watchers/trip → 40,000 × 3 ≈ 120,000 pushed messages/s   (small, bounded)
Index memory:    trip_id(8) + lat/lng(16) + ts(8) ≈ 32 B/trip
                 200k × 32 B ≈ 6.4 MB live  → trivially in RAM
Battery:         stationary courier dropped to 1 ping / 30 s → ~6× fewer writes when idle
ETA recompute:   every 15 s/trip, not per ping → 200k / 15 ≈ 13k route calcs/s
```
The numbers say: fan-out is *tiny and bounded per trip* (unlike a live-scores broadcast), so a simple **per-trip pub/sub topic** suffices; the real lever is adaptive on-device sampling to save battery.

**API.**
```http
POST /trips/t_77/location                   # courier app, adaptive rate
{ "lat": 37.7751, "lng": -122.4188, "speed_mps": 6.2 }
→ 204 No Content

GET /trips/t_77/stream                       # watcher (SSE / WebSocket upgrade)
→ 200 OK  Content-Type: text/event-stream
  event: location
  data: {"lat":37.7751,"lng":-122.4188,"eta_s":480,"updated_age_s":1}

GET /trips/t_77/location                     # on (re)connect, fetch latest before streaming
→ 200 OK  { "lat":37.7751, "lng":-122.4188, "eta_s":480, "stale": false }
```

**Data model.** Latest-only position per trip plus a fan-out topic.
```
trip_location (latest only, fast KV — Redis):
  trip:t_77:loc → { lat:37.7751, lng:-122.4188, updated_at:1718600000 }  EX 60

Pub/sub: one topic per active trip
  topic "trip.t_77"  → subscribers: [customer_conn, merchant_conn, support_conn]

trip_meta (computed separately):
  trip_id  STRING (key)   -- "t_77"
  route    POLYLINE        -- planned path for ETA
  status   ENUM(assigned|picked_up|delivering|done)
Example: {"trip_id":"t_77","status":"delivering","route":"_p~iF~ps|U..."}
```
Named tech: **Redis** for the latest-location KV and **Redis Pub/Sub** (or NATS) for per-trip topics; WebSocket/SSE gateway holds watcher connections. Shard key = **trip_id** so a trip's writes, topic, and watchers colocate.

**Architecture.**
```
INGEST (POST /trips/t_77/location):
  courier app (adaptive rate) → gateway → SET trip:t_77:loc {...} EX 60
                                        → PUBLISH trip.t_77 {lat,lng}  → 204

FAN-OUT (per-trip topic):
  PUBLISH trip.t_77 ──► customer conn ─┐
                    ──► merchant conn  ├─ pushed over WebSocket/SSE
                    ──► support conn  ─┘
  ETA worker (every 15s): GET loc + route + traffic → recompute eta_s → push

RECONNECT:
  watcher drops → GET /trips/t_77/location (latest) → re-SUBSCRIBE trip.t_77
```
Concrete trace: courier on trip `t_77` is moving at 6.2 m/s, so the app pings every 5 s; if it goes idle (`speed_mps ≈ 0`) it backs off to every 30 s, cutting writes ~6×. Each ping does a `SET trip:t_77:loc ... EX 60` (overwrite-latest) and a `PUBLISH trip.t_77`, which the Redis-backed gateway pushes to the 3 connected watchers. ETA isn't recomputed per ping — a worker recomputes it every 15 s from the latest position, the planned route, and live traffic. A watcher that drops Wi-Fi reconnects, `GET`s the latest position (served instantly from the KV, flagged `stale` if `updated_age_s` is high), then resubscribes.

**Deep dive — streaming fan-out + battery trade-off.** Two levers. (1) **Adaptive sampling on the device:** ping frequency scales with speed and trip phase — a courier waiting at a red light or at the restaurant doesn't need 1 Hz updates, so idle drops to ~1/30 s (≈6× battery saving) while approaching dropoff bumps to ~1/2 s for a smooth final-stretch animation. (2) **Per-trip pub/sub fan-out:** because watcher count is tiny and bounded (~3), a flat topic broadcast is enough — no broadcast tree, no fan-out service like a live-scores system needs. The latest-location KV (with a 60 s TTL) gives reconnecting clients an instant current position before the live stream resumes, and ETA is a *derived* value recomputed on an interval rather than on every ping.

**Trade-offs & failure modes.**
- *Adaptive sampling (battery-friendly, coarser breadcrumb trail) vs fixed high frequency (buttery-smooth, drains battery):* adaptive wins; interpolate client-side between points for smoothness.
- *Per-trip topic fan-out is cheap* precisely because watcher count is small — don't over-engineer a broadcast tree.
- *Courier loses connectivity:* show last-known location with a staleness badge (driven by the KV TTL); updates resume on reconnect.
- *Eventual consistency is fine:* a few seconds of location lag doesn't break the experience; never block the courier ping on watcher delivery.

## 6.4 Maps route service

**Clarify.** Functional: compute the best route between two points (driving/walking), accounting for live traffic; return distance + ETA + turn-by-turn steps. Non-functional: query p99 < 100 ms on a **continent-scale road graph** (~10^8 nodes), incorporate **live traffic**, lean heavily on **precomputation**. Read-heavy; the graph is largely static, traffic is the dynamic overlay. Read:write (graph edits) ≈ **10^6:1**.

**Estimate (worked).**
```
Road graph:     ~1×10^8 nodes (intersections), ~2.5×10^8 edges (segments)
Naive Dijkstra: explores ~half the graph ≈ 5×10^7 settled nodes → 100s of ms — too slow
With CH:        contraction hierarchies settle ~few thousand nodes → < 1 ms graph search
Query QPS:      500M route requests/day → 500,000,000 / 86,400 ≈ 5,800 QPS, peak ×4 ≈ 23k QPS
Graph memory:   node(12 B) + edges(2.5 avg × 16 B) ≈ 50 B/node → 10^8 × 50 ≈ 5 GB
                + CH shortcuts ≈ +30% → ~6.5 GB resident; partition by region tile
Precompute:     full CH build offline ≈ hours; traffic re-customization ≈ minutes (weights only)
```
The numbers say: query latency comes entirely from **offline preprocessing** (CH cuts ~5×10^7 explored nodes to a few thousand); live traffic must update *weights* without rebuilding the *structure*.

**API.**
```http
GET /route?from=37.7749,-122.4194&to=37.3382,-121.8863&mode=drive&depart=2026-06-17T17:00:00Z
→ 200 OK
{ "distance_m": 77400, "eta_s": 3360, "traffic": "heavy",
  "steps": [ { "instruction": "Merge onto US-101 S", "dist_m": 64000, "eta_s": 2700 } ],
  "polyline": "_p~iF~ps|U_ulLn..." }

GET /route?from=37.77,-122.41&to=0,0     → 422 Unprocessable  { "error": "destination unreachable" }
```

**Data model.** The road network as a weighted **graph**; edge weight = travel time.
```
Graph (in-memory, partitioned by region tile):
  node n_4412 → { lat, lng, edges:[ (n_4413, base_s=12), (n_5001, base_s=30) ] }
  CH shortcut → { from:n_4412, to:n_9000, via:[...], rank:842 }   -- precomputed bypass

Live-traffic overlay (time-varying, separate from structure):
  edge:e_771 → { speed_kph_now: 22, free_flow_kph: 65, ts: ... }   -- updatable weights

Tiling: graph split into region tiles + a top-level highway graph for cross-tile stitching
```
Named tech: a **graph store / in-memory adjacency** with **Contraction Hierarchies** (CH) or hub-labeling for acceleration; **Customizable CH (CCH)** so traffic re-weights without a full rebuild; traffic ingested from fleet-GPS into a time-varying edge layer. Shard key = **region tile** (geographic), routing within tiles + a highway-level graph between them.

**Architecture.**
```
PRECOMPUTE (offline, hours):
  static OSM-style graph → contract nodes by rank → add shortcut edges → CH structure
                                                  → CCH separator so weights are customizable

QUERY (GET /route, < 100 ms):
  from=(37.7749,-122.4194) to=(37.3382,-121.8863)
    1. snap both points to nearest graph nodes  (n_4412, n_88010)
    2. bidirectional CH search: settle ~few thousand nodes (not 5×10^7)
    3. unpack shortcuts → full edge path
    4. apply live-traffic overlay: edge base_s → adjusted by speed_kph_now
    5. sum adjusted times → eta_s=3360 → build steps + polyline → 200 OK

TRAFFIC:
  fleet GPS → speed aggregator → edge:e_771 speed update → CCH weight re-customization (mins)
```
Concrete trace: SF `(37.7749, -122.4194)` to San Jose `(37.3382, -121.8863)` snaps to graph nodes, then a **bidirectional CH search** settles only a few thousand high-rank nodes instead of exploring half the continent. The resulting shortcut path is unpacked to real segments; each segment's base travel time (e.g. a US-101 edge at `base_s=12`) is replaced by the live-traffic adjusted time (`speed_kph_now=22` vs `free_flow_kph=65` → that segment is ~3× slower), giving an `eta_s` of 3,360 s. The long route crosses tiles, stitched via the highway-level graph.

**Deep dive — graph search + precomputation + live traffic.** Plain Dijkstra/A* settling ~5×10^7 nodes is far too slow, so the win is **preprocessing**. Contraction Hierarchies rank nodes and add **shortcut edges** that let a bidirectional query provably explore only a few thousand nodes — sub-millisecond routing on a 10^8-node graph. The catch: a plain CH bakes weights into the structure, so a traffic change would force a full rebuild (hours). The fix is **Customizable CH (CCH)** — the *structure* (node ordering, separators) is precomputed once, while *weights* are a thin customizable layer re-applied in minutes when traffic shifts. Cross-region routes use **hierarchical tiling**: route within each tile, stitch via a coarse highway graph.

| Approach | Query time (10^8 nodes) | Handles live traffic | Preprocess cost |
|---|---|---|---|
| Dijkstra / A* | hundreds of ms | trivially (read current weights) | none |
| **Contraction Hierarchies** | < 1 ms | no — weights baked in, full rebuild | hours |
| **Customizable CH (CCH)** | ~1 ms | yes — re-customize weights in minutes | hours once + minutes/update |

**Trade-offs & failure modes.**
- *Precompute vs on-the-fly:* heavy CH preprocessing gives fast queries but is expensive to update for traffic; on-the-fly Dijkstra is always current but too slow at scale. CCH reconciles: structure precomputed, weights updatable.
- *Live traffic makes ETAs eventually consistent* (slightly behind reality) — acceptable.
- *Traffic feed down:* fall back to free-flow / historical speeds — route still computed, ETA accuracy degrades.
- *Caching:* popular origin-destination pairs and common segments cache, absorbing much of the 23k QPS peak.

## 6.5 Geofencing alerts

**Clarify.** Functional: define geofences (circular/polygon regions); detect when a moving entity **enters or exits** a fence; fire an alert. Non-functional: scale to many entities × many fences **without checking every entity against every fence**, minimize **false positives** (GPS jitter must not flap enter/exit), near-real-time. This is a **spatial-join-on-a-stream** problem. Write-heavy (location updates), low fence-edit rate.

**Estimate (worked).**
```
Entities:        500k moving entities, ping every 5 s → 500,000 / 5 ≈ 100,000 location writes/s
Fences:          200k geofences defined
Naive join:      100k updates/s × 200k fences = 2×10^10 checks/s  → infeasible (quadratic)
Cell-indexed:    geohash precision 7 (~150 m); fences/cell ≈ 3 in a dense city
                 each update checks ~3 fences in its cell + 8 neighbors ≈ 27 point-in-polygon tests
                 100k updates/s × 27 ≈ 2.7M tests/s  → tractable
Cell counts:     a fence spanning ~600 m covers ~16 precision-7 cells → stored in all 16
Membership mem:  entity_id(8) + set-of-fence_ids(~3 × 8) ≈ 32 B → 500k × 32 ≈ 16 MB
```
The numbers say: the N×M join (2×10^10/s) is killed by **spatial bucketing** (down to 2.7M tests/s), and accuracy is fixed by **hysteresis/debouncing**, not by more checks.

**API.**
```http
POST /geofences
{ "fence_id": "f_12", "shape": "circle", "center": [37.7749,-122.4194], "radius_m": 300 }
→ 201 Created   { "fence_id": "f_12", "cells": ["9q8yyk8","9q8yyk9","9q8yykd", ...] }

POST /location { "entity_id": "e_5", "lat": 37.7751, "lng": -122.4188 }
→ 202 Accepted   { "events": [ { "type": "enter", "fence_id": "f_12" } ] }

GET /entities/e_5/fences   → 200 { "inside": ["f_12"] }    # current membership set
```

**Data model.** Fences indexed by the cells they cover; per-entity last-known membership to detect transitions.
```
Fence spatial index (a fence is registered in EVERY cell it overlaps):
  cell:9q8yyk8 → SET{ f_12, f_88 }      -- cell → fence_ids
  cell:9q8yyk9 → SET{ f_12 }
  fence:f_12   → { shape:"circle", center:[37.7749,-122.4194], radius_m:300 }

Per-entity membership (turns position into transitions):
  entity:e_5:inside → SET{ }            -- fences e_5 was inside on the PREVIOUS update
  entity:e_5:streak → { f_12: 2 }       -- consecutive readings inside f_12 (for debounce)

Example: entity at (37.7751,-122.4188), cell "9q8yyk8" → candidate f_12 → point-in-circle? yes
```
Named tech: **Redis** sets for the cell index and membership, an **in-memory quadtree** or geohash map for the fence index; a stream processor (Kafka + Flink) runs the join. Shard key = **spatial cell** so an update only touches the node owning its region.

**Architecture.**
```
INDEX FENCES (POST /geofences):
  fence f_12 (circle, 300 m) → decompose into covering cells {9q8yyk8, 9q8yyk9, ...}
                             → SADD cell:9q8yyk8 f_12  (registered in each covered cell)

DETECT (POST /location, streaming spatial join):
  entity e_5 at (37.7751,-122.4188)
    1. cell = geohash(...,7) = "9q8yyk8"  (+ 8 neighbors)
    2. candidates = SUNION cell sets = { f_12, f_88 }     ← only fences NEAR e_5, not all 200k
    3. precise test: point-in-circle/polygon → currently inside = { f_12 }
    4. prev = entity:e_5:inside = { }
    5. enter = inside − prev = { f_12 } ;  exit = prev − inside = { }
    6. debounce: streak[f_12]=2 ≥ K(=2) → fire ENTER f_12 ; update entity:e_5:inside = {f_12}
```
Concrete trace: fence `f_12` (300 m circle at `(37.7749, -122.4194)`) is decomposed into ~16 precision-7 cells and registered in each, e.g. `cell:9q8yyk8 → {f_12}`. When entity `e_5` pings `(37.7751, -122.4188)`, the processor hashes to `"9q8yyk8"`, unions that cell plus 8 neighbors to get candidate fences `{f_12, f_88}` (never all 200k), runs an exact point-in-circle test (inside `f_12`), diffs against `e_5`'s previous membership set (empty) to find a transition, and — once `f_12` has been inside for K=2 consecutive readings (hysteresis) — fires an `enter` event and records `entity:e_5:inside = {f_12}`.

**Deep dive — spatial partitions + false positives.** Two problems. (1) **Scale:** registering each fence in its covering cells turns the 2×10^10/s N×M join into "check only the ~3 fences in my cell plus neighbors" — spatial bucketing that makes detection near-constant per update (~27 point-in-polygon tests). (2) **Accuracy:** GPS noise near a boundary produces spurious enter/exit *flapping*. Fix with **hysteresis** (a buffer margin — treat "inside" only past `radius − jitter` and "outside" only past `radius + jitter`, so a point oscillating around the edge doesn't toggle) plus **debouncing** (require K consecutive readings on the new side before firing), and account for the device's reported GPS accuracy radius. The entity's **previous-membership set** is the piece that converts raw positions into `enter`/`exit` *transitions*.

**Trade-offs & failure modes.**
- *Cell-indexed fences (scales the join; a fence spanning many cells is stored redundantly in each) vs full per-update scan (simple, quadratic, infeasible).*
- *Hysteresis/debouncing trades alert latency for fewer false positives* — K=2 readings adds ~one ping of delay but kills boundary flapping.
- *Sparse updates / fast movers:* an entity can cross a small fence *between* pings and be missed; interpolate the straight-line segment between consecutive points and test it for fast movers.
- *Fence definitions are eventually consistent* (a re-indexed fence propagates in seconds); the detection stream is the real-time path. A stale GPS reading is filtered the same way as in 6.2 (drop pings older than N seconds).

# 7. Correctness-critical systems

> These systems trade availability/latency for **correctness**. Money and inventory cannot be double-spent. The recurring tools: idempotency keys, ACID transactions, ledgers, sagas, the outbox pattern, and reconciliation.

## 7.1 Payment processing

**Clarify.** Functional: charge a customer via an external PSP (Stripe / Adyen / a bank rail), handle success/failure/timeout, never double-charge, support refunds, reconcile with the PSP. Non-functional: **correctness over availability** — a duplicate charge is far worse than a slow or failed one; strong consistency on the payment record; full auditability. Why correctness beats availability/latency: a $100 double-charge is a chargeback, a support ticket, and a trust loss; a 2-second-slower checkout is forgettable. The PSP call is slow (100–800 ms) and *can lie* (time out after succeeding), so idempotency and reconciliation are the heart of the design.

**Estimate (worked).**
```
Volume:  5M payments/day
         5,000,000 / 86,400 s        ≈ 58 payments/s avg
         peak ×3 (flash sale)        ≈ 175 payments/s
Each payment = 1 row write + 1 outbox row + 1 PSP round trip (100–800 ms)
Contention hotspot: NOT throughput — it's the slow external PSP call held
         inside no transaction (never hold a DB txn across a network call).
         Hot row: a single merchant's payout aggregation, not the charge itself.
Storage (7-yr regulatory retention):
         payments row ≈ id(16) + idem_key(36) + amount(8) + status(12)
                      + psp_ref(32) + 2×ts(16) ≈ 150 bytes
         + ledger/outbox/refund rows ≈ ~600 B per payment all-in
         5M/day × 365 × 7 × 600 B   ≈ 7.7 × 10^12 B ≈ 7.7 TB over 7 yr
```
The numbers say: throughput is trivial; the entire difficulty is the unreliable async PSP and the audit trail — design for *retry-safety and reconciliation*, not for QPS.

**API.**
```http
POST /api/v1/payments
Idempotency-Key: idem_8f3a2b1c-checkout-9912        # client-generated, unique per intent
{ "amount": 9900, "currency": "USD", "source": "tok_visa_4242", "order_id": "ord_771" }
→ 201 Created                                         # first time: charge initiated
{ "payment_id": "pay_001", "status": "pending", "psp_ref": null }

POST /api/v1/payments      (same Idempotency-Key, retry after a timeout)
→ 200 OK                                              # replay: returns the original record
{ "payment_id": "pay_001", "status": "succeeded", "psp_ref": "ch_3Pxy..." }

POST /api/v1/payments      (same key, different amount/order — mismatched body)
→ 409 Conflict
{ "error": "idempotency_key_reuse", "message": "key bound to a different request" }

POST /api/v1/refunds
Idempotency-Key: idem_refund-001
{ "payment_id": "pay_001", "amount": 9900 }
→ 201 Created   { "refund_id": "rf_55", "status": "pending" }

POST /webhooks/psp          # PSP → us, authoritative async status (signature-verified)
{ "type": "charge.succeeded", "psp_ref": "ch_3Pxy...", "amount": 9900 }
→ 200 OK
```

**Data model.** Single **ACID relational DB** (PostgreSQL) — the unique constraint on `idempotency_key` is the dedup primitive and you want serializable guarantees on the state machine.
```
Table: payments                       -- PostgreSQL, state machine on `status`
  payment_id      UUID    PK
  idempotency_key TEXT    UNIQUE NOT NULL     -- "idem_8f3a2b1c-checkout-9912"
  request_hash    TEXT                        -- hash(body); detect key reuse w/ different args
  order_id        TEXT
  amount          BIGINT                      -- minor units (cents) — never floats
  currency        CHAR(3)
  status          TEXT  CHECK (status IN ('initiated','pending','succeeded','failed'))
  psp_ref         TEXT                         -- "ch_3Pxy..." (PSP's charge id)
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
  -- statuses:  initiated → pending → succeeded | failed   (terminal: succeeded/failed)
Example row: {payment_id:"pay_001", idempotency_key:"idem_8f3a2b1c-checkout-9912",
              amount:9900, currency:"USD", status:"succeeded", psp_ref:"ch_3Pxy..."}

Table: outbox                          -- transactional outbox, drained by a relay
  id          BIGSERIAL PK
  aggregate   TEXT             -- "payment"
  payload     JSONB            -- {"type":"payment.succeeded","payment_id":"pay_001",...}
  published   BOOLEAN DEFAULT false
  created_at  TIMESTAMPTZ
```
Shard by `payment_id` (hash); a single payment's whole lifecycle — row, refunds, outbox — stays in one partition so its state transitions are single-node ACID. Merchant payout aggregation is a separate downstream rollup, not on the charge path.

**Architecture.**
```
CHARGE (POST /payments, Idempotency-Key: K):
  app ── BEGIN ──────────────────────────────────────────────────┐
      INSERT payments(idem_key=K, status='initiated') ON CONFLICT  │  unique(K)
        → conflict? return stored row (200 replay)  ───────────────┘  = dedup
      COMMIT
  app → UPDATE status='pending'; COMMIT     (release locks BEFORE network call)
  app → PSP.charge(token, amount)  ──── 100–800 ms, may TIME OUT ────►
        ├─ 200 ok      → UPDATE status='succeeded', psp_ref; + outbox row (one txn)
        ├─ 4xx decline → UPDATE status='failed'; + outbox row
        └─ TIMEOUT     → stay 'pending'  (DO NOT assume failure)

RESOLVE pending:                                   RECONCILE (nightly):
  PSP webhook ──► verify sig ──► UPDATE status      pull PSP settlement report
  OR poller ───► PSP.retrieve(psp_ref) ──► UPDATE   diff vs payments table
                                                    flag: charged-not-recorded /
  outbox relay ──► publish to Kafka ──► mark        recorded-not-charged → repair
```
Concrete trace: client sends `POST /payments` with `Idempotency-Key: idem_8f3a2b1c`. The handler runs `INSERT INTO payments (idempotency_key, status, request_hash) VALUES ('idem_8f3a2b1c','initiated', md5(body)) ON CONFLICT (idempotency_key) DO NOTHING RETURNING payment_id`. On the *first* call one row is created (`pay_001`); on a *retry* the conflict fires, we re-read `pay_001`, and if `request_hash` matches we return the stored result (200) — **never a second Stripe charge**. The row flips to `pending`, the transaction commits (so no DB lock is held across the slow network), then we call `stripe.charges.create(idempotency_key='idem_8f3a2b1c')` — passing the same key downstream so Stripe *also* dedupes. On `200` we run one transaction: `UPDATE payments SET status='succeeded', psp_ref='ch_3Pxy' WHERE payment_id='pay_001'` plus `INSERT INTO outbox (...)`. A relay polls `outbox WHERE published=false`, publishes `payment.succeeded` to Kafka, marks it published. If the Stripe call **times out**, the row stays `pending` and is resolved by the webhook (`POST /webhooks/psp`, signature-verified) or by a poller calling `charges.retrieve` — the timeout is *never* interpreted as failure.

**Deep dive — idempotency + retries + reconciliation.** Three layers, each covering the previous one's gap:

| Layer | Mechanism | Covers |
|---|---|---|
| Client→us dedup | `idempotency_key UNIQUE` + `request_hash` | network retry of the same intent → one row, replayed result; reused key with new args → 409 |
| us→PSP dedup | pass the *same* key to `charges.create` | our retry of the PSP call → PSP charges once |
| Truth resolution | webhook + poller, status stays `pending` on timeout | ambiguous timeouts: did the charge land? resolve authoritatively, never guess |
| Drift repair | nightly reconciliation vs PSP settlement file | partial failures, dropped webhooks, manual PSP actions → diff and self-heal |

The cardinal rule: a timeout is *unknown*, not *failed*. Idempotency makes every step retry-safe; reconciliation is the backstop that assumes even idempotency + webhooks can drift and re-establishes truth against the PSP's settlement report.

**Trade-offs & failure modes.**
- Strong consistency + idempotency (correct, more complex, an extra row + unique index) vs optimistic fire-and-forget (faster, risks double-charge — unacceptable for money).
- **Timeout ambiguity (the PSP problem):** never mark `failed` on timeout — stay `pending`, resolve via webhook/poll. Assuming failure → retry → double-charge.
- Never hold a DB transaction across the PSP network call — commit `pending` first, then call out; otherwise locks pile up at 800 ms each.
- PSP down: queue and retry with exponential backoff + jitter; don't drop, don't synchronously block the user forever.
- Webhook lost / out-of-order: poller + reconciliation are the safety net; webhooks are best-effort, the settlement file is truth.
- Refunds must be idempotent too (their own key) and must not exceed the captured amount.

## 7.2 Wallet (ledger)

**Clarify.** Functional: maintain user balances; transfer funds between accounts; place holds (authorizations) that reserve without moving money; never allow negative balances or lost/created money. Non-functional: **strict correctness — money is conserved**, strong consistency, complete immutable audit trail. Why correctness beats availability/latency: a balance that's wrong by a cent is a regulatory and trust catastrophe; a transfer that's 200 ms slower is invisible. The canonical solution is **double-entry accounting on an append-only ledger**.

**Estimate (worked).**
```
Volume:  20M transfers/day
         20,000,000 / 86,400 s       ≈ 232 transfers/s avg
         peak ×3                      ≈ 700 transfers/s
Each transfer = 2 ledger entries (1 debit + 1 credit), balanced, in ONE txn.
Contention hotspot: a popular merchant / float account receiving thousands of
         concurrent CREDITS → one hot row under row lock. Credits to the SAME
         account serialize. (Debits from many distinct user accounts don't contend.)
Storage (append-only, never deleted):
         ledger_entries row ≈ id(16)+txn(16)+acct(16)+amount(8)+dir(1)+ts(8) ≈ 80 B
         2 entries/transfer → 160 B/transfer
         20M/day × 365 × 5 × 160 B   ≈ 5.8 × 10^12 B ≈ 5.8 TB over 5 yr
```
The numbers say: throughput is modest, but the ledger is *append-only and immutable*, so plan for unbounded growth and for hot-account write contention.

**API.**
```http
POST /api/v1/transfers
Idempotency-Key: idem_xfer_7c4
{ "from": "acct_alice", "to": "acct_bob", "amount": 2500, "currency": "USD" }
→ 201 Created   { "txn_id": "txn_88", "status": "posted" }

POST /api/v1/transfers      (insufficient funds)
→ 422 Unprocessable Entity  { "error": "insufficient_funds", "available": 1800 }

POST /api/v1/transfers      (replay of same key)
→ 200 OK   { "txn_id": "txn_88", "status": "posted" }      # not re-applied

POST /api/v1/holds
{ "account": "acct_alice", "amount": 5000 }
→ 201 Created   { "hold_id": "hold_12", "status": "active" }   # reserves available, no move

POST /api/v1/holds/hold_12/capture   { "amount": 5000 } → 201  # hold → real transfer
DELETE /api/v1/holds/hold_12                          → 200    # release reservation

GET /api/v1/accounts/acct_alice/balance → 200 { "balance": 1800, "available": 1800 }
GET /api/v1/accounts/acct_alice/ledger  → 200 { "entries": [ ... ] }   # full audit trail
```

**Data model.** **Double-entry** on an append-only ledger in an **ACID DB** (PostgreSQL, serializable or row-locked). Every transaction writes balanced entries — one debit, one equal credit — so `SUM(amount × direction)` across all accounts is always zero: money is conserved *by construction*.
```
Table: transactions
  txn_id          UUID PK
  idempotency_key TEXT UNIQUE NOT NULL          -- "idem_xfer_7c4"  → dedup retries
  status          TEXT CHECK (status IN ('posted','reversed'))
  created_at      TIMESTAMPTZ

Table: ledger_entries                 -- APPEND-ONLY, immutable (never UPDATE/DELETE)
  entry_id    UUID PK
  txn_id      UUID  REFERENCES transactions
  account_id  TEXT
  amount      BIGINT  CHECK (amount > 0)        -- minor units
  direction   CHAR(1) CHECK (direction IN ('D','C'))   -- Debit / Credit
  ts          TIMESTAMPTZ
  -- invariant per txn:  SUM(amount where C) == SUM(amount where D)
Example (transfer $25 alice→bob, txn_88):
  {entry_id:e1, txn:txn_88, account:"acct_alice", amount:2500, direction:'D'}
  {entry_id:e2, txn:txn_88, account:"acct_bob",   amount:2500, direction:'C'}

Table: balances                       -- materialized cache (optional; reconciled to entries)
  account_id  TEXT PK
  balance     BIGINT
  held        BIGINT                            -- sum of active holds
  -- available = balance - held
```
Shard by `account_id`. But a transfer touches *two* accounts — if they live on different shards you need a cross-shard transaction (see deep dive); many wallets keep a single ledger DB so transfers are single-node ACID.

**Architecture.**
```
TRANSFER $25 alice → bob (idem K):
  BEGIN  (SERIALIZABLE)
    SELECT balance FROM balances WHERE account_id='acct_alice' FOR UPDATE   -- lock source
    if balance - held < 2500 → ROLLBACK → 422 insufficient_funds
    INSERT transactions(idem_key=K) ON CONFLICT DO NOTHING                  -- dedup
       (conflict → ROLLBACK, return existing txn → 200 replay)
    INSERT ledger_entries (alice, 2500, 'D')      -- debit source
    INSERT ledger_entries (bob,   2500, 'C')      -- credit dest   (balanced)
    UPDATE balances SET balance=balance-2500 WHERE account_id='acct_alice'
    UPDATE balances SET balance=balance+2500 WHERE account_id='acct_bob'
  COMMIT                                          -- all-or-nothing

HOLD (auth):  UPDATE balances SET held = held + 5000
              WHERE account_id='acct_alice' AND balance - held >= 5000
              (0 rows → reject; reduces AVAILABLE, no ledger movement yet)
  capture → write the real debit/credit entries + held -= amount
  release → held -= amount  (no ledger movement)

RECONCILE (continuous):  for each account, assert
  balances.balance == SUM(ledger_entries.amount × ±1)   else alarm + repair
```
Concrete trace: Alice transfers $25 to Bob. In one `SERIALIZABLE` transaction we `SELECT ... FOR UPDATE` Alice's balance row, check `balance - held >= 2500`, insert the `transactions` row guarded by `idempotency_key` (a retried request hits the unique constraint, rolls back, and replays the stored `txn_88` — no second debit), then append the two balanced `ledger_entries` (debit Alice 2500 / credit Bob 2500) and update both materialized balances. Commit is atomic, so you can never persist a debit without its credit. The ledger is **never mutated**: a correction is a new compensating transaction (reverse entries), preserving the audit trail. A hold is `UPDATE balances SET held = held + 5000 WHERE balance - held >= 5000` — it shrinks *available* without touching the ledger; capture converts it into real entries, release just decrements `held`.

**Deep dive — double-entry + holds + consistency.**

| Concern | Approach A | Approach B (chosen) |
|---|---|---|
| Recording money | mutable `balance` field | **append-only double-entry** — self-verifying (Σ=0), full audit, corrections are new entries |
| Reading balance | recompute `SUM(entries)` each read (always correct, slow) | **materialized `balances`** (fast) + continuous reconciliation vs entry sums |
| Concurrency | optimistic + retry | **`SELECT FOR UPDATE` / SERIALIZABLE** on involved accounts → no overdraft, no lost update |
| Reserve-while-pending | none | **holds** split *available* from *posted* (card auths, pending charges) |

Double-entry is the foundation: because every movement is a balanced debit + credit, total balance never changes and any drift is *immediately detectable* by reconciliation. Holds separate authorized from available funds. Serializable isolation (or explicit row locks on the two accounts) is what prevents double-spend under concurrency.

**Trade-offs & failure modes.**
- Append-only double-entry (auditable, self-verifying, ~2× the writes) vs mutable balance field (simple, no audit, error-prone — rejected).
- Computed balance (always correct, scan cost) vs materialized balance (fast reads, must reconcile) — use materialized + a reconciliation job asserting `balance == SUM(entries)`.
- **Hot-account contention:** serializable isolation on a popular float/merchant account that takes thousands of concurrent credits serializes them on one row lock → throughput cap. Mitigate by sharding the hot account into N sub-accounts that sum, or batching credits.
- **Cross-shard transfers:** two accounts on different shards force 2PC (blocking, coordinator SPOF) or a saga with reserved→committed states. Many wallets colocate accounts or use a single ledger DB to keep transfers single-node.
- Never `DELETE`/`UPDATE` a ledger row — corrections are compensating entries, or you lose the audit trail.

## 7.3 Stock trading order system

**Clarify.** Functional: accept buy/sell orders; **match them deterministically** by price-time priority; maintain an order book per symbol; produce an immutable audit log; report fills. Non-functional: **deterministic ordering**, very low latency (microseconds on the match path), strict per-symbol consistency, complete auditability (regulatory). Why correctness beats availability/latency *here even though latency is also critical*: a non-deterministic or reordered fill is a fairness/regulatory violation that can't be undone — the design buys both via a single-writer-per-symbol, in-memory matching engine backed by an event log.

**Estimate (worked).**
```
Volume:  per-symbol order rate on liquid names: thousands–tens of thousands/s
         say 50,000 orders/s on the hottest symbol at peak
Latency budget: match path in MICROSECONDS → must be in-memory, single-threaded,
         lock-free per symbol (no DB round trip on the hot path)
Contention hotspot: ALL orders for one symbol funnel to ONE engine (by design —
         single writer = deterministic order). That engine's throughput is the cap.
Order book memory: ~10^5–10^6 resting orders × ~64 B ≈ tens of MB per symbol → fits in RAM
Storage (event log, append-only, regulatory ~7 yr):
         event ≈ seq(8)+order(16)+symbol(8)+side(1)+px(8)+qty(8)+ts(8) ≈ 60 B
         50k/s × 60 B × 86,400 s     ≈ 2.6 × 10^11 B ≈ 260 GB/day (hot symbol)
```
The numbers say: throughput per symbol is bounded by one engine — that's an *accepted* cost of determinism; the event log dominates storage and is the system of record.

**API.**
```http
POST /api/v1/orders
{ "symbol": "AAPL", "side": "buy", "type": "limit", "price": 19250, "qty": 100 }
→ 201 Created
{ "order_id": "ord_44", "seq": 9000123, "status": "accepted" }   # seq = engine order

DELETE /api/v1/orders/ord_44
→ 200 OK    { "order_id": "ord_44", "status": "canceled", "seq": 9000150 }

DELETE /api/v1/orders/ord_44      (already fully filled)
→ 409 Conflict   { "error": "not_cancelable", "status": "filled" }

# market-data feed (push): fills + book deltas, in seq order
event: fill   { "seq": 9000124, "order_id":"ord_44", "px":19250, "qty":100, "trade_id":"t_77" }
```

**Data model.** Per-symbol **in-memory order book** + an append-only **event log** that is the durable system of record (the book is a materialized view, rebuildable by replay).
```
In-memory order book (per symbol, single engine):
  bids: price → [resting orders FIFO]   (sorted high→low)     -- price-time priority
  asks: price → [resting orders FIFO]   (sorted low→high)
  resting order = {order_id, side, price, remaining_qty, arrival_seq}

Event log (append-only, replicated; the SOURCE OF TRUTH):
  seq        BIGINT   -- monotonic per symbol; defines total order
  type       ENUM(new_order, cancel, fill)
  symbol     TEXT
  order_id   TEXT
  side       CHAR(1)
  price      BIGINT   -- minor units
  qty        BIGINT
  ts         TIMESTAMPTZ
Example: {seq:9000123, type:new_order, symbol:"AAPL", order_id:"ord_44",
          side:'B', price:19250, qty:100}
         {seq:9000124, type:fill, order_id:"ord_44", price:19250, qty:100, trade_id:"t_77"}
```
Partition by `symbol` — each symbol is an independent single-writer matching domain; the partition key choice *is* the consistency boundary (per-symbol total order is the only ordering that matters for fairness).

**Architecture.**
```
INGEST → MATCH → DURABILITY (per symbol "AAPL"):
  orders(AAPL) ──► [single matching engine, in-memory, lock-free] ──► fills
        │              ▲                                              │
        │   assign monotonic seq                                     │
        ▼              │                                              ▼
   sequencer ──► append to EVENT LOG (WAL) ──► replicate to standby ──► market-data feed
                       │
                 (book = replay(log))
  CRASH: standby replays replicated log to last seq → exact book reconstructed
```
Concrete trace: a buy limit `AAPL 100 @ $192.50` arrives. The sequencer stamps it `seq=9000123` and **appends it to the event log first** (write-ahead) and replicates to the standby; only then does the single AAPL engine apply it. The engine walks the asks: the best ask is `100 @ $192.50` resting, so price-time priority matches them fully — it emits a `fill` event (`seq=9000124`, `trade_id=t_77`), decrements both orders, and publishes the fill on the market-data feed. Because exactly one thread processes AAPL's ordered event stream, the outcome is **fully deterministic given the input sequence** — no locks, no races. The in-memory book is disposable: on engine crash, a hot standby replays the replicated log from the last checkpoint to `seq=9000124` and reconstructs the *exact* book — no lost or reordered trades. The immutable, ordered log *is* the regulatory audit trail.

**Deep dive — deterministic matching + event log + latency.**

| Approach | Latency | Determinism | Audit / recovery |
|---|---|---|---|
| Distributed / row-locked book | high (lock contention, coordination) | lost (interleaving) | partial |
| **Single-writer + event sourcing** | microseconds (in-memory, lock-free) | total per-symbol order | perfect: log = audit + deterministic replay |

Low latency *and* strict correctness are both achieved by single-writer-per-symbol over an ordered event stream: one engine, no locks, one deterministic outcome. The append-only log provides durability, audit, and crash recovery via deterministic replay — the in-memory book is reproducible from it. Partitioning by symbol scales horizontally (independent symbols on different engines) while preserving the only ordering that matters.

**Trade-offs & failure modes.**
- Single-writer in-memory engine (deterministic, microsecond latency; must replicate the log for HA) vs distributed/locked book (scales writes per symbol but loses determinism and adds latency — rejected).
- Event-sourced log (perfect audit + recovery, replay cost) vs mutable state (faster recovery, no audit — rejected for regulatory reasons).
- **Per-symbol throughput cap:** a hot symbol is bounded by one engine; this is accepted — determinism is worth more than per-symbol scale-out.
- Crash recovery: hot standby replays the replicated log to the last seq; replication lag bounds data loss → use synchronous replication of the WAL for zero loss.
- Clock/seq integrity: the monotonic sequence (not wall-clock) defines order; sequencer must be a single point per symbol with failover.

## 7.4 Ticket booking

**Clarify.** Functional: browse available seats for an event; hold seats during checkout; confirm on payment; **never oversell** a seat; release expired holds. Non-functional: **strong consistency on inventory** (two users can't buy the same seat), holds must expire, heavy read traffic with bursty write contention (everyone rushes a hot on-sale). Why correctness beats availability *on the seat*: selling seat 14A twice means refunds, angry customers, and turning someone away at the door — far worse than a slower checkout. Correctness on the seat transaction; availability/staleness is fine on browsing.

**Estimate (worked).**
```
Browse QPS:  huge, read-heavy — 200,000 reads/s at an on-sale (everyone refreshing)
Write contention: concentrated at on-sale T0 — thundering herd on a small,
         fixed seat set (e.g. 20,000 seats for a stadium show)
         hold attempts/s at T0 ≈ tens of thousands competing for ~20k seats
Inventory size: bounded — thousands of seats per event (fits easily in one shard)
Hold TTL: ~10 min → abandoned holds reclaimed by a sweeper
Storage: tiny — seats(event) × few hundred bytes; the system is contention-bound,
         NOT storage-bound. Design for the write race, not for volume.
```
The numbers say: browsing is a cache problem, the on-sale is a *contention* problem on a tiny authoritative dataset — the whole game is the atomic conditional seat transition.

**API.**
```http
GET /api/v1/events/evt_9/seats         → 200 { "seats": [{"id":"14A","status":"available"}, ...] }

POST /api/v1/holds
Idempotency-Key: idem_hold_3
{ "event_id": "evt_9", "seats": ["14A","14B"], "user_id": "u_5" }
→ 201 Created   { "hold_id": "hold_7", "expires_at": "2026-06-17T20:10:00Z" }

POST /api/v1/holds      (someone else grabbed 14A first)
→ 409 Conflict   { "error": "seat_unavailable", "seats": ["14A"] }

POST /api/v1/bookings
Idempotency-Key: idem_book_3
{ "hold_id": "hold_7", "payment": { "token": "tok_visa" } }
→ 201 Created   { "booking_id": "bk_22", "status": "confirmed" }

POST /api/v1/bookings      (hold already expired)
→ 422 Unprocessable Entity   { "error": "hold_expired" }
```

**Data model.** **ACID DB** (PostgreSQL); the DB is authoritative for the hold/book transition. A browse cache is advisory only.
```
Table: seats                          -- PostgreSQL; status is a state machine
  event_id        TEXT
  seat_id         TEXT
  status          TEXT CHECK (status IN ('available','held','booked'))
  held_by         TEXT                       -- user_id holding it (nullable)
  hold_expires_at TIMESTAMPTZ                 -- nullable; TTL for the hold
  version         BIGINT                      -- optimistic-concurrency token
  PRIMARY KEY (event_id, seat_id)
  -- transitions:  available → held → booked     (held → available on expiry/release)
Example: {event_id:"evt_9", seat_id:"14A", status:"held",
          held_by:"u_5", hold_expires_at:"2026-06-17T20:10:00Z"}

Table: bookings
  booking_id      TEXT PK
  idempotency_key TEXT UNIQUE
  hold_id         TEXT
  status          TEXT CHECK (status IN ('confirmed','failed'))
```
Shard by `event_id` — all of an event's seats colocate, so a multi-seat hold/book is a **single-shard transaction**. The browse cache (Redis / read replica) is eventually consistent.

**Architecture.**
```
HOLD (atomic, conditional):
  BEGIN
    UPDATE seats
       SET status='held', held_by='u_5', hold_expires_at=now()+'10 min'
     WHERE event_id='evt_9' AND seat_id IN ('14A','14B')
       AND status='available'                       -- conditional: only if free
    if rows_updated < requested → ROLLBACK → 409 seat_unavailable
  COMMIT                                             -- DB serializes concurrent holders

BOOK (on payment success):
  BEGIN
    UPDATE seats SET status='booked'
     WHERE seat_id IN (...) AND held_by='u_5'
       AND hold_expires_at > now()                   -- hold still valid & owned
    rows<n → ROLLBACK → 422 hold_expired
  COMMIT

EXPIRY sweeper (every ~30s):                BROWSE:
  UPDATE seats SET status='available',        GET /seats → Redis/replica
    held_by=NULL WHERE status='held'                 (eventually consistent;
    AND hold_expires_at < now()                       authoritative check at hold)
```
Concrete trace: at on-sale, thousands of users `POST /holds` for seat 14A simultaneously. Each runs `UPDATE seats SET status='held', held_by=<user>, hold_expires_at=now()+'10 min' WHERE event_id='evt_9' AND seat_id='14A' AND status='available'`. PostgreSQL serializes these row updates: **exactly one** sees `status='available'` and updates 1 row (wins → 201); all others update 0 rows (lose → 409). Oversell is impossible because the `status='available'` predicate and the write are one atomic operation. The winner has 10 minutes; on payment success we `UPDATE ... SET status='booked' WHERE held_by=<user> AND hold_expires_at > now()`. If they abandon the cart, a sweeper running every 30 s flips expired holds back to `available`. Browsing reads from a Redis cache — showing a just-held seat as available is harmless because the *hold* transaction is the real consistency point.

**Deep dive — oversell prevention via atomic conditional update.**

| Approach | Oversell-safe? | Contention | Notes |
|---|---|---|---|
| read-then-write (check available, then set held) | NO — TOCTOU race | — | classic bug, two winners |
| `SELECT ... FOR UPDATE` then update | yes (pessimistic lock) | lock held → queues | safe, can contend at T0 |
| **conditional UPDATE ... WHERE status='available'** | **yes** | optimistic, retry-on-0-rows | one statement, no explicit lock |
| optimistic `version` token | yes | retry on conflict | good under moderate contention |

The atomic conditional update makes the seat transition indivisible: `available → held` happens only if currently `available`, and the DB serializes concurrent attempts so exactly one wins. **Holds** decouple "reserving while paying" from "owning" — without them you'd either oversell (reserve only at payment, two people pay) or lock inventory forever. **Expiry** (TTL + sweeper) reclaims abandoned holds. Browse reads can be stale; the hold transaction is the consistency point.

**Trade-offs & failure modes.**
- Strong-consistency holds (no oversell, contention at on-sale) vs optimistic/eventual inventory (scales reads, risks oversell — unacceptable).
- Pessimistic `FOR UPDATE` (safe, queues under load) vs conditional update / optimistic version (less locking, retry on conflict) — prefer the conditional update for the hot path.
- Hold TTL trades inventory availability against giving users time to pay; too long locks seats, too short frustrates buyers.
- **Payment-succeeded-but-booking-write-failed:** reconcile — the hold proves intent and idempotency keys make the booking retry-safe; never charge without confirming a seat.
- **Thundering herd at on-sale:** a virtual waiting room / queue smooths the contention spike onto the single-shard hot rows.

## 7.5 Hotel reservation

**Clarify.** Functional: search available rooms by date range; hold and book room-night inventory; cancel; sync availability across channels (direct + OTAs). Non-functional: **no overbooking** of inventory per room-type per date, strong consistency on inventory *counts*, eventual sync across distribution channels. Why correctness beats availability: overbooking means walking a guest at midnight — a costly service failure; a slightly stale search result is fine. Like ticket booking, but inventory is **counts per room-type per date** (not unique seats) and a stay spans a *date range*, so a booking touches many rows that must all succeed.

**Estimate (worked).**
```
Inventory rows = hotels × room-types × dates (a rolling ~500-day window)
         e.g. 100k hotels × 10 room-types × 500 days ≈ 5 × 10^8 rows
Search QPS:  read-heavy, date-range availability — 50,000 searches/s
Booking:     20M room-nights/day / 86,400 ≈ 230/s avg, peak ×3 ≈ 700/s
Contention:  lower than a single hot concert, but a popular hotel on a peak
         date is a hot (room_type, date) row taking concurrent decrements.
Multi-night atomicity: a 3-night stay = 3 conditional row updates, all-or-nothing.
Storage:     inventory rows ≈ 5×10^8 × ~50 B ≈ 25 GB (small; it's a counts table)
```
The numbers say: search is a cache problem; correctness is a *multi-row atomic decrement* problem plus a cross-channel sync problem.

**API.**
```http
GET /api/v1/search?location=NYC&checkin=2026-08-01&checkout=2026-08-04&guests=2
→ 200 { "results": [{ "hotel_id":"h_9", "room_type":"deluxe", "nightly":18000 }] }

POST /api/v1/holds
{ "hotel_id":"h_9", "room_type":"deluxe", "checkin":"2026-08-01", "checkout":"2026-08-04" }
→ 201 Created   { "hold_id":"hold_2", "expires_at":"2026-08-01T..." }

POST /api/v1/reservations
Idempotency-Key: idem_res_5
{ "hold_id":"hold_2", "payment":{ "token":"tok_visa" } }
→ 201 Created   { "res_id":"res_31", "status":"confirmed" }

POST /api/v1/reservations      (one night in the range sold out mid-flight)
→ 409 Conflict   { "error":"no_availability", "date":"2026-08-02" }

DELETE /api/v1/reservations/res_31   → 200 { "status":"canceled" }
```

**Data model.** **ACID DB** (PostgreSQL), one row per room-type per date.
```
Table: inventory                      -- PostgreSQL; counts, not unique units
  hotel_id    TEXT
  room_type   TEXT
  date        DATE
  total       INT                          -- physical rooms of this type
  booked      INT  CHECK (booked <= total) -- DB-enforced no-oversell invariant
  PRIMARY KEY (hotel_id, room_type, date)
  -- available(night) = total - booked ; stay available iff every night has booked < total
Example: {hotel_id:"h_9", room_type:"deluxe", date:"2026-08-02", total:20, booked:19}

Table: reservations
  res_id          TEXT PK
  idempotency_key TEXT UNIQUE
  hotel_id        TEXT
  room_type       TEXT
  checkin         DATE
  checkout        DATE
  status          TEXT CHECK (status IN ('confirmed','canceled'))
```
Shard by `hotel_id` — a hotel's inventory colocates, so a multi-night booking for one hotel is a **single-shard transaction**. Search hits an availability cache / read replica (eventually consistent).

**Architecture.**
```
SEARCH:  GET /search → availability cache/replica
         room-types where EVERY night in [checkin,checkout) has booked < total

BOOK 3 nights (Aug 1–3), atomic all-or-nothing:
  BEGIN
    UPDATE inventory SET booked = booked + 1
     WHERE hotel_id='h_9' AND room_type='deluxe'
       AND date IN ('2026-08-01','2026-08-02','2026-08-03')
       AND booked < total                          -- conditional per night
    if rows_updated < 3 → ROLLBACK → 409 (some night full)
  COMMIT                                            -- all 3 nights or none

CANCEL:  UPDATE inventory SET booked = booked - 1 WHERE ... AND nights  (idempotent via status)

CHANNEL SYNC:                          RECONCILE:
  our DB (authoritative) ──push──►       diff our DB vs channel-sold counts
    OTA-A, OTA-B (eventually consistent)  resolve oversell via buffer / walk policy
```
Concrete trace: a guest books deluxe at hotel h_9 for Aug 1–3. In one transaction we run a single conditional `UPDATE inventory SET booked = booked + 1 WHERE hotel_id='h_9' AND room_type='deluxe' AND date IN ('2026-08-01','2026-08-02','2026-08-03') AND booked < total`. If all three nights have a room free, exactly 3 rows update and we commit; if Aug 2 is at `booked = total`, only 2 rows match, `rows_updated (2) < 3`, and we `ROLLBACK` → 409. The `CHECK (booked <= total)` constraint is a second guardrail. The whole stay commits atomically or not at all — no partial booking. Selling on OTAs is the hard part: each OTA also decrements inventory in *its* system, so we treat our DB as authoritative, push availability deltas to channels fast, and run reconciliation to catch the race where two channels sell the last room — resolved with overbooking buffers and walk policies, not by trying to make independent OTAs strongly consistent.

**Deep dive — multi-night atomicity + channel sync.**

| Concern | Wrong | Right |
|---|---|---|
| Multi-night booking | per-night independent updates (can partially book) | **one conditional UPDATE over all nights, all-or-nothing** |
| Oversell guard | app-level read-then-write | `booked < total` predicate + `CHECK (booked <= total)` |
| Cross-channel | force OTAs into 2PC (bottleneck/SPOF) | **authoritative DB + fast push + reconciliation + buffer** |

The twist vs ticketing is the date range: a stay touches one inventory row per night and *all* must have availability, so the transaction conditionally increments every night atomically and rolls back entirely if any night is full. Counts (not unique seats) mean the guard is `booked < total` per night. Channel sync is the real-world hard part — brief overbooking races across independent OTAs are minimized by fast pushes and resolved by reconciliation + buffers.

**Trade-offs & failure modes.**
- Strong-consistency multi-night transaction (no overbook, all-or-nothing across dates) vs per-night independent updates (can partially book — wrong).
- Authoritative-DB + channel push (eventual cross-channel) vs a single global inventory service (consistent but a bottleneck/SPOF across all channels).
- **Cross-channel oversell** is handled with overbooking buffers + walk policies + reconciliation, not by making independent OTAs strongly consistent.
- Hot `(room_type, date)` row on a peak night contends under concurrent decrements — acceptable at hotel scale; shard or batch if needed.
- Search staleness is acceptable; the booking transaction is the truth.

## 7.6 E-commerce checkout

**Clarify.** Functional: turn a cart into an order — reserve inventory, take payment, create the order, trigger fulfillment — coordinating multiple services that can each fail or time out. Non-functional: each step must be locally consistent, but the **end-to-end flow spans services** (cart, inventory, payment, fulfillment) → a distributed transaction. Why correctness beats availability: charging a customer but failing to reserve stock, or reserving stock and losing the charge, are both unacceptable; a checkout that takes a few seconds to *confirm* asynchronously is fine. Canonical solution: **saga + outbox**.

**Estimate (worked).**
```
Volume:  3M orders/day / 86,400 s     ≈ 35 orders/s avg, peak ×3 ≈ 105/s
Each order = a saga of 4 local txns across 4 services, linked by events.
Difficulty is NOT QPS — it's correctness across a multi-service workflow where
         any step can fail/time out and there's no global ACID transaction.
Contention: per-SKU inventory reservation (hot product on a flash sale) — same
         atomic-conditional-update pattern as ticketing.
Storage:  orders + per-service outbox rows; modest. ~1 KB/order all-in.
```
The numbers say: low throughput, high coordination complexity — design for partial failure and compensation, not scale.

**API.**
```http
POST /api/v1/checkout
Idempotency-Key: idem_co_9
{ "cart_id":"cart_3", "payment":{"token":"tok_visa"}, "address":{...} }
→ 202 Accepted                                  # saga kicked off, progresses async
{ "order_id":"ord_88", "status":"created" }

POST /api/v1/checkout      (replay of same key)
→ 200 OK   { "order_id":"ord_88", "status":"paid" }     # not restarted

GET /api/v1/orders/ord_88
→ 200 { "order_id":"ord_88", "status":"confirmed" }      # created→inventory_reserved→paid→confirmed

POST /api/v1/checkout      (cart already empty / invalid)
→ 422 Unprocessable Entity   { "error":"empty_cart" }
```

**Data model.** Each service owns its data; the order carries the **saga state machine**. **Outbox** tables in each service make event publishing reliable.
```
Table: orders   (order service)       -- PostgreSQL; saga state machine
  order_id        TEXT PK
  idempotency_key TEXT UNIQUE
  user_id         TEXT
  status          TEXT CHECK (status IN
                    ('created','inventory_reserved','paid','confirmed',
                     'compensating','canceled'))
  saga_step       INT                        -- current position, for resume on crash
Example: {order_id:"ord_88", status:"paid", saga_step:2}

Table: outbox   (one per service: order / inventory / payment)
  id        BIGSERIAL PK
  payload   JSONB         -- {"type":"inventory.reserved","order_id":"ord_88"}
  published BOOLEAN DEFAULT false
  created_at TIMESTAMPTZ

Table: inventory (inventory service)  : sku, reserved, available  (atomic conditional update)
Table: payments  (payment service)    : see 7.1 (idempotency_key UNIQUE, status)
```
Shard by `order_id` / `user_id` within each service; the saga ties cross-service local transactions together via events, not via a shared transaction.

**Architecture — saga + outbox.**
```
SAGA (orchestrated):  created → inventory_reserved → paid → confirmed
  step1  Inventory.reserve(sku, qty)   --emit inventory.reserved (outbox)-->
  step2  Payment.charge(idem)          --emit payment.succeeded (outbox)-->
  step3  Order.confirm                 --emit order.confirmed (outbox)-->
  step4  Fulfillment.create            (ship)

COMPENSATION (reverse on failure):
  payment FAILS after step1  → Inventory.release(sku, qty)     ; order → canceled
  fulfillment FAILS after step2 → Payment.refund(idem)          ; Inventory.release
                               → order → canceled

OUTBOX (per step, atomic):
  BEGIN ; UPDATE local state ; INSERT outbox(event) ; COMMIT
  relay: poll outbox WHERE published=false → publish to Kafka → mark published
         (no dual-write: state change + event commit together)
```
Concrete trace: `POST /checkout` (idem `idem_co_9`) creates `ord_88` (`status='created'`) and the orchestrator drives the saga. **Step 1** — inventory service runs one local transaction: `UPDATE inventory SET reserved = reserved + 1 WHERE sku='sku_x' AND available - reserved >= 1` (the atomic conditional update; 0 rows → out of stock → saga aborts), and in the *same* transaction inserts an `inventory.reserved` outbox row. Its relay publishes the event to Kafka. **Step 2** — the payment service charges (idempotent per 7.1) and emits `payment.succeeded`. **Step 3** — order flips to `paid` then `confirmed`. **Step 4** — fulfillment is triggered. If payment *fails* after inventory was reserved, the orchestrator runs the **compensation** `Inventory.release` (`reserved = reserved - 1`) and sets the order `canceled`; if fulfillment fails after payment, it issues a refund (idempotent) and releases inventory. Every step writes its state change + outbox event in one local transaction, so the dual-write problem (state updated but event lost) can't occur, and every step is idempotent so retries after timeouts are safe.

**Deep dive — saga vs 2PC + the outbox.**

| Dimension | 2PC (distributed ACID) | **Saga (chosen)** |
|---|---|---|
| Atomicity | strong, all-or-nothing | eventual; local txn per step + compensations |
| Blocking | holds locks across services until commit | no cross-service locks |
| Coordinator | single point, blocks on failure | orchestrator/choreography, resumable |
| Scale | poor (locks + chatty protocol) | good (local txns, async events) |
| Cost | rollback is automatic | you must *design* compensations |

No 2PC across services (fragile, blocking, coordinator SPOF). The saga decomposes the flow into local ACID transactions linked by events, with compensating actions replacing rollback. The **outbox pattern** guarantees the event that advances (or compensates) the saga is published exactly when the local state changes — atomic with it — so the workflow can't lose a step. The result: **local consistency per step, eventual consistency overall**; at any instant the system is in a known state, moving forward or compensating backward. Idempotency makes the whole thing retry-safe under inevitable timeouts.

**Trade-offs & failure modes.**
- Saga (no distributed locks, scalable, eventually consistent, must design compensations) vs 2PC (strong atomicity, but blocking + coordinator SPOF + poor scale — rejected).
- Orchestration (central controller, clear logic, easier to trace) vs choreography (decoupled events, harder to debug).
- **Compensation gaps:** some actions have no clean undo (e.g. a shipped package, a sent email) — design steps to be compensatable, put irreversible actions *last*, and reconcile.
- **Dual-write avoided** by the outbox: state change + event commit in one transaction, relay publishes at-least-once (consumers dedupe via idempotency).
- Timeout at any step is ambiguous (like the PSP) — keep the step idempotent and resume from `saga_step` on orchestrator crash.

## 7.7 Coupon / promo system

**Clarify.** Functional: define coupons (percentage/fixed, eligibility rules, usage limits — a global cap and a per-user cap, expiry); validate and apply at checkout; prevent abuse. Non-functional: **race conditions on limited redemptions** are the core risk — a "first 1000 users" coupon must not redeem 1001 times — so strong consistency on counters, with fast eligibility checks. Why correctness beats availability *on the limit*: honoring 1001 redemptions of a 1000-cap promo is direct margin loss and a fairness problem; a few ms slower validation is invisible. Correctness on the redeem, low latency on validate.

**Estimate (worked).**
```
Validation QPS: spikes during a promo — everyone applies the code at once.
         say 30,000 validate/s at promo launch
Redeem QPS: a fraction of validates that convert — 3,000 redeem/s at peak
Contention HOTSPOT: ALL redeems of one viral code hit ONE counter row
         (coupons.redeemed_count) → the canonical hot-key write problem.
         Identical in spirit to limited inventory.
Per-user cap: enforced by a UNIQUE (code, user_id) redemption row.
Storage:  coupons (few KB each) + redemptions (1 row per redeem, ~50 B)
         small; the system is contention-bound, not storage-bound.
```
The numbers say: validation is a cached read; the entire difficulty is the *atomic conditional increment* of one hot counter under a redemption stampede.

**API.**
```http
POST /api/v1/coupons/validate
{ "code":"SAVE20", "user_id":"u_5", "cart_total":10000 }
→ 200 OK   { "valid":true, "discount":2000, "advisory":true }   # advisory cached pre-check

POST /api/v1/coupons/redeem
Idempotency-Key: idem_redeem_5
{ "code":"SAVE20", "user_id":"u_5", "order_id":"ord_88" }
→ 201 Created   { "redemption_id":"rd_9", "discount":2000 }

POST /api/v1/coupons/redeem      (global cap of 1000 already hit)
→ 409 Conflict   { "error":"coupon_exhausted" }

POST /api/v1/coupons/redeem      (user already redeemed; per-user cap = 1)
→ 422 Unprocessable Entity   { "error":"per_user_limit_reached" }

POST /api/v1/coupons/redeem      (replay of same idempotency key)
→ 200 OK   { "redemption_id":"rd_9" }                         # not double-counted
```

**Data model.** **ACID DB** (PostgreSQL) — counters need atomic conditional updates; the redemption row's unique constraint enforces per-user cap *and* idempotency.
```
Table: coupons                        -- PostgreSQL
  code            TEXT PK              -- "SAVE20"
  type            TEXT  CHECK (type IN ('percent','fixed'))
  value           INT                  -- 20 (%) or amount
  global_limit    INT                  -- 1000
  per_user_limit  INT                  -- 1
  redeemed_count  INT  DEFAULT 0       -- HOT counter; guarded by conditional update
  expires_at      TIMESTAMPTZ
  rules           JSONB                -- eligibility (min cart, region, ...)
Example: {code:"SAVE20", type:"percent", value:20, global_limit:1000,
          per_user_limit:1, redeemed_count:999, expires_at:"2026-07-01T..."}

Table: redemptions                    -- UNIQUE key = per-user cap + idempotency
  code        TEXT
  user_id     TEXT
  order_id    TEXT
  redeemed_at TIMESTAMPTZ
  PRIMARY KEY (code, user_id)          -- per_user_limit = 1; widen to (code,user,order) if >1
Example: {code:"SAVE20", user_id:"u_5", order_id:"ord_88"}
```
Shard by `code` — a coupon's redemptions colocate (single-shard redeem transaction), but a viral coupon is a single hot counter (see deep dive for sharding the count).

**Architecture.**
```
VALIDATE (fast, advisory):  cached/replica read of coupon
  check expiry, rules, redeemed_count < global_limit (approx) → 200 (advisory)

REDEEM (the consistency point, ACID):
  BEGIN
    UPDATE coupons SET redeemed_count = redeemed_count + 1
     WHERE code='SAVE20' AND redeemed_count < global_limit   -- atomic conditional
    if rows_updated = 0 → ROLLBACK → 409 coupon_exhausted
    INSERT INTO redemptions (code, user_id, order_id) VALUES ('SAVE20','u_5','ord_88')
       -- UNIQUE(code,user_id) violation → 422 per_user_limit  (or replay → 200)
  COMMIT

HOT-COUPON mitigation (sharded counter):
  redeemed_count split into N sub-counters c0..cN summing to global_limit;
  a redeem increments a random shard conditionally; reconcile/sum periodically.
```
Concrete trace: `SAVE20` is capped at 1000 and sits at `redeemed_count = 999`; thousands of users `POST /redeem` at once. Each runs, in one transaction, `UPDATE coupons SET redeemed_count = redeemed_count + 1 WHERE code='SAVE20' AND redeemed_count < global_limit`. PostgreSQL serializes writes to that row: the one request that takes it from 999→1000 updates 1 row (wins, then inserts its `redemptions` row → 201); every subsequent request sees `redeemed_count = 1000`, matches `WHERE redeemed_count < 1000` as false, updates **0 rows**, and gets 409 `coupon_exhausted`. The limit check and the increment are one indivisible statement, so over-redemption is impossible. Per-user cap is enforced by the `INSERT INTO redemptions` hitting the `UNIQUE (code, user_id)` constraint — a second redeem by the same user fails the constraint (→ 422), and a *retry* of the same request also hits it, which makes redemption **idempotent** (the retry is rejected as a duplicate, not counted twice). Validation is served from a cache and is purely advisory; only the redeem transaction is authoritative.

**Deep dive — race conditions on limited redemptions.**

| Approach | Correct under concurrency? | Cost |
|---|---|---|
| read count → check < limit → increment (separate statements) | **NO** — TOCTOU, two requests both pass → 1001 redemptions | — |
| **atomic `UPDATE ... WHERE redeemed_count < global_limit`** | **yes** — DB serializes the check+increment | single hot counter row |
| sharded sub-counters (N shards summing to limit) | yes | relieves hot key; needs reconciliation to sum |
| per-user cap via `UNIQUE (code,user_id)` | yes + idempotent | one extra row + index |

The classic bug is read-then-write: two requests both read 999, both check `< 1000`, both increment → 1001. The fix is the atomic conditional update — the `WHERE redeemed_count < limit` predicate and the increment are one operation the database serializes. The unique redemption row enforces the per-user cap *and* makes redemption idempotent (retry hits the constraint, not a second count). For extreme contention, shard the limited quantity into N sub-counters so concurrent redeems hit different rows, reconciling the sum periodically.

**Trade-offs & failure modes.**
- Atomic conditional increment (correct under concurrency, single hot counter) vs read-then-write (simple, race-prone — wrong).
- Cached advisory validation (fast) + authoritative transactional redeem (correct) is the standard split — never trust the advisory check for the limit.
- **Hot-counter contention:** a viral code serializes all redeems on one row → throughput cap; relieve with sharded sub-counters at the cost of a reconciliation to sum them (and a small over/under-count window).
- Idempotency via the unique `(code, user_id)` (or `(code, user_id, order_id)`) redemption row prevents double-redeem on retry.
- **Abuse** (one person, many accounts) is *not* stopped by coupon limits — needs separate fraud controls (device/payment fingerprinting).

# 8. Storage and infrastructure systems

## 8.1 Key-value store (Dynamo-style)

**Clarify.** Functional: `get(key)` / `put(key, value)` / `delete(key)` at massive scale; horizontally scalable; no SPOF; automatic rebalancing when nodes join/leave. Non-functional: tunable per-request consistency, survive node + AZ failures, p99 < 10 ms. Dominant constraint: **availability + partition tolerance** — the system must keep serving during failures and reconcile divergent replicas afterward (AP with tunable consistency). The canonical distributed-storage problem; the answer assembles consistent hashing, replication, quorums, and conflict resolution.

**Estimate (worked).**
```
Workload: 1M get/s + 200k put/s across the fleet, avg value 1 KB
Per-node ceiling: ~50k ops/s on commodity SSD-backed node
         (1M + 200k) / 50k                ≈ 24 nodes for raw throughput
Replication: N=3 → every put becomes 3 physical writes
         200k put/s × 3                   = 600k physical writes/s
         (1M reads × R=2 coordinator fan-out partial) → size for 2× read amp
         effective node count ≈ 24 × ~2.5 (replication+headroom) ≈ 60–100 nodes
Storage: 10B keys × (key 32 B + value 1 KB + vclock/meta ~80 B) ≈ 11 TB logical
         × N=3 replication                ≈ 33 TB physical
         at ~2 TB usable/node             ≈ 17 nodes just to hold data
Vnodes: 100 physical nodes × 256 vnodes   = 25,600 ring tokens (even spread)
```
The numbers say: replication factor (N=3) triples write load and storage, so node count is driven by **replication overhead**, not raw key count.

**API.**
```
get(key)                  → (value, context)        # context = opaque vector clock
put(key, value, context)  → ok                       # pass back context for causal writes
delete(key, context)      → ok                        # tombstone, not physical delete

# Coordinator semantics (internal):
#   put returns after W replicas ack; get returns after R replicas respond
#   200 OK              — quorum satisfied
#   202 Accepted        — W not met but hinted-handoff stored (sloppy quorum)
#   409/siblings        — get returns multiple concurrent versions to merge
#   503 Unavailable     — fewer than W/R replicas reachable, no hint target
```

**Data model.** Keys distributed via **consistent hashing** on a 2^128 ring (hash = MD5/Murmur of key). Each physical node owns ~256 **virtual nodes** (vnodes) — small evenly-spread arcs — for smooth rebalancing. Each key replicated to the next **N=3** distinct physical nodes clockwise (the *preference list*, skipping vnodes on the same physical host/AZ). Per-node storage is an **LSM tree → SSTables** (write-optimized: writes hit memtable + commit log, flush to immutable SSTables, compact in background). Values are opaque; each carries a **vector clock** `{node_id: counter}` for causality. Named tech: **DynamoDB / Cassandra / Riak**.
```
ring position = hash(key) mod 2^128
preference list for "user:42":
  hash("user:42") = 0x9F3A...  → lands in vnode owned by node B
  N=3 walk clockwise → [B, E, A]   (3 distinct physical nodes, ≥2 AZs)
stored value: { value: <bytes>, vclock: {B:3, E:3, A:2}, tombstone: false }
```

**Architecture.**
```
PUT user:42 (N=3, W=2):
  client → any node (coordinator C) → hash → pref list [B,E,A]
  C dispatches put to B,E,A in parallel
       B ack ─┐
       E ack ─┴─► W=2 reached → C returns 200 to client   (A finishes async)
       A slow/down → coordinator stores HINT on next healthy node (D)
                     D replays to A when A recovers (hinted handoff)

GET user:42 (N=3, R=2):
  client → coordinator C → read from B,E,A; wait for R=2 responses
       B: vclock {B:3,E:3,A:2}   E: vclock {B:3,E:3,A:2}  → agree → return
       if A returns {B:3,E:2,A:1} (stale) → read repair: push newest to A async
       if two concurrent vclocks (neither dominates) → return siblings to client
```
Concrete trace: a put of `user:42` hashes to `0x9F3A...`, preference list `[B,E,A]`. With **N=3, W=2, R=2**, `W+R=4 > N=3` so any read quorum overlaps any write quorum → read-your-writes. The coordinator (etcd/gossip-maintained ring membership) writes to all 3, returns after 2 ack (~3 ms), and A catches up via hinted handoff or read repair. Background **anti-entropy** uses **Merkle trees** per vnode: replicas exchange tree roots, descend only into differing branches, and sync just the divergent keys — bounded repair traffic.

**Deep dive — consistent hashing + quorum + vector-clock conflicts.** Three coupled mechanisms:

| Mechanism | Problem solved | Concrete params |
|---|---|---|
| Consistent hashing + vnodes | scaling, even load, incremental rebalance | 256 vnodes/node; adding a node moves only ~1/N of keys |
| Quorum W+R>N | tunable consistency per request | N=3: W=2,R=2 (balanced); W=3,R=1 (read-fast); W=1,R=3 (write-fast) |
| Vector clocks | detect causal vs concurrent writes | `{B:3,E:3}` dominates `{B:2,E:3}` → keep; neither dominates → sibling |

Vector clocks are the subtle part: on each write the coordinator increments its entry. When a read sees two versions, if one clock is element-wise ≥ the other it *descends* (keep the newer); if neither dominates the writes were **concurrent** → conflict. Resolution is either **LWW** (compare wall-clock timestamps, simplest, can silently drop a write) or **siblings** (return both, client merges — e.g. union a shopping cart). Hinted handoff (a healthy node holds writes for a down peer), read repair (fix stale replicas seen during reads), and Merkle-tree anti-entropy keep replicas converging despite failures.

**Trade-offs & failure modes.**
- *CAP choice:* AP with tunable quorums (always writable via sloppy quorum + hints, eventually consistent) vs CP (linearizable, refuses writes when quorum lost). Dynamo-style picks availability.
- *Conflict policy:* LWW (one column, no client logic, lost-update risk) vs siblings (no data loss, client must merge, version bloat if unmerged).
- *Node loss:* a down node's writes are absorbed by hinted handoff; reads still meet R from surviving replicas. AZ loss survivable because the preference list spans AZs.
- *Partition:* both sides keep serving (sloppy quorum) → divergent vclocks → reconciled by read repair + anti-entropy when the partition heals.
- *Hot key:* a single scorching key overloads its 3 replicas; mitigate with a client/coordinator cache or key-splitting (`user:42#shard0..3`). Consistent hashing prevents a *cold* remap storm but not a single hot key.

## 8.2 Object store like S3

**Clarify.** Functional: `PUT`/`GET`/`DELETE` arbitrarily large objects by `bucket/key`; multipart upload; prefix listing; versioning. Non-functional: **durability above all (11 nines, 99.999999999%)** — the dominant constraint that drives the redundancy scheme; scalable to exabytes; strong read-after-write for new objects; cost-efficient at scale. The hard parts: durability via erasure coding, and listing (key-order vs hash-distribution).

**Estimate (worked).**
```
Scale: 100 trillion objects, 1 EB logical, avg object 10 MB (chunked at 64 MB)
Durability math (why erasure coding):
  3× replication        → 3.0× storage = 3 EB raw
  Reed-Solomon 6+3      → (6+3)/6 = 1.5× storage = 1.5 EB raw  ← half the cost
  RS 10+4               → 14/10 = 1.4× storage, survives 4 fragment losses
Storage saved: (3.0 − 1.5) EB = 1.5 EB  (at ~$15/TB/yr ≈ huge)
Metadata: 100T objects × ~256 B (key, chunk map, version) ≈ 25 PB metadata
          → sharded metadata service, itself replicated/consensus-backed
Scrub cycle: scan all disks every 14 days to catch bit rot before 2nd failure
Throughput: GET amplification — RS read needs k=6 fragments (or reconstruct from parity)
```
The numbers say: at exabyte scale **storage cost dominates**, so erasure coding (1.5×) beats replication (3×) decisively — durability for half the bytes.

**API.**
```http
PUT /my-bucket/photos/cat.jpg              # simple, small object
Content-Length: 4194304
→ 200 OK   ETag: "9b2cf...", x-version-id: "v3"

POST /my-bucket/big.bin?uploads            # multipart init
→ 200  { "uploadId": "abc123" }
PUT  /my-bucket/big.bin?partNumber=1&uploadId=abc123   → 200 ETag "p1..."
POST /my-bucket/big.bin?uploadId=abc123    # complete (lists part ETags)
→ 200 OK   (object now atomically visible — strong read-after-write)

GET  /my-bucket/photos/cat.jpg             → 200 <bytes>   (404 if absent)
GET  /my-bucket?prefix=photos/&marker=photos/cat.jpg&max-keys=1000
→ 200 <key-sorted page + nextMarker>       # listing = range scan, eventually consistent
```

**Data model.** A **metadata service** maps `bucket/key → {version, chunk list, fragment locations}`; data lives separately as fragments on storage nodes. Object split into 64 MB **chunks**; each chunk **Reed-Solomon erasure-coded** into k+m fragments spread across distinct failure domains. Metadata partitioned by `hash(bucket/key)` (load spread); a **separate key-sorted listing index** (LSM/B-tree) supports `?prefix=` range scans. Named tech: **S3 / GCS / Ceph / MinIO**; metadata on a consensus-backed or Dynamo-style store.
```
metadata record (key = my-bucket/photos/cat.jpg):
  version_id:  "v3"
  size:        4194304
  chunks: [ { chunk_id: c0, scheme: RS(6+3),
              fragments: [ {id:f0, node:n12, rack:r3, az:a},  ... 9 total ],
              checksum: sha256 } ]
listing index (sorted):  my-bucket/photos/cat.jpg → v3
                         my-bucket/photos/dog.jpg → v7   ← range scan by prefix
```

**Architecture.**
```
WRITE (PUT, RS 6+3):
  client → metadata svc (reserve key+version)
        → split into 64 MB chunks → erasure-encode each into 6 data + 3 parity
        → scatter 9 fragments across 9 nodes in ≥3 racks/AZs
        → all fragments durable → metadata commits version → 200
        (ack only after durability → strong read-after-write for the new key)

READ (GET):
  client → metadata svc (key→fragment locations) → fetch any 6 of 9 fragments
        → if a fragment missing/corrupt → reconstruct from parity (RS decode)
        → stream to client
  background scrubber → verify checksums → re-encode degraded objects
```
Concrete trace: `PUT cat.jpg` (4 MB, one chunk) RS(6+3) → 9 fragments of ~683 KB each on nodes spanning racks r1–r3 and 3 AZs. The object survives any **3 simultaneous fragment losses** (a whole AZ + a disk) and is reconstructable from any 6. A `GET` reads the 6 fastest fragments; if node n12 is down, the coordinator decodes using a parity fragment instead — slightly higher CPU/latency but no data loss. A nightly **scrubber** re-reads checksums and rebuilds any object below full redundancy before a second failure can compound.

**Deep dive — erasure coding vs replication + listing.**

| Approach | Storage overhead | Durability | Read cost |
|---|---|---|---|
| 3× replication | 3.0× | survives 2 losses | cheap (read 1 copy) |
| RS 6+3 | 1.5× | survives 3 losses | k=6 fragment fetch, reconstruct on loss |
| RS 10+4 | 1.4× | survives 4 losses | k=10 fetch, higher reconstruct CPU |

Erasure coding is the cost-vs-durability win: equal-or-better durability than 3× replication at ~1.4–1.5× storage by storing parity instead of full copies — decisive when storage cost dominates. Fragments spread across independent failure domains (disk → rack → AZ) so correlated failures can't take more than `m` fragments of one object; the **scrubber** repairs degraded objects before they accumulate losses. **Listing** is the unsung hard part: data is hash-partitioned for even load, but listing needs key-order, so a **separate sorted index** is maintained out-of-band — and it's eventually consistent with object writes, which is why list-after-write can briefly lag even when get-after-write is strong.

**Trade-offs & failure modes.**
- *Redundancy:* erasure coding (1.5× storage, +CPU and reconstruct latency on degraded reads) vs replication (3× storage, fast simple reads).
- *Consistency:* strong read-after-write for new objects (metadata acked only after durability) vs eventually-consistent listing (separate async index).
- *Disk/rack/AZ loss:* masked by parity — reconstruct on read, repair in background; safe up to `m` concurrent fragment losses per object.
- *Metadata partition:* the bigger risk than data loss → metadata service is itself replicated/consensus-backed and sharded.
- *Hot object:* one wildly popular key fans out reads to its fragment nodes → front with CDN / cache rather than hammering storage; the data layer is durability-optimized, not fan-out-optimized.

## 8.3 Distributed cache

**Clarify.** Functional: fleet-scale in-memory `get/set/delete` cache fronting a slower datastore. Non-functional: **sub-millisecond reads** (dominant constraint: latency), high hit rate, scale horizontally, node loss invalidates only its share (not a full flush), handle hot keys and stampedes. Think Memcached / Redis at fleet scale.

**Estimate (worked).**
```
Hot data: 4 TB across nodes; reads 5M/s, writes 500k/s; avg value 2 KB
Per-node: 64 GB usable RAM, ~250k ops/s on a single Redis/Memcached instance
         5M reads / 250k                 = 20 nodes for read throughput
         4 TB / 64 GB                    = 64 nodes to hold the data → 64 nodes
Node loss blast radius (consistent hashing, modulo comparison):
         consistent hash: 1 node down → 1/64 ≈ 1.6% of keys miss & refill
         naive modulo:    1 node down → ~100% of keys remap → full cache flush
Stampede math: hot key TTL=60s, 50k req/s on it → at expiry, 50k concurrent
         misses hit origin in one tick unless coalesced → single-flight → 1 fetch
```
The numbers say: consistent hashing turns a node failure from a **catastrophic 100% remap (modulo) into a 1.6% bounded miss** — that bound is the whole point.

**API.**
```
get(key)               → value | MISS          # ~0.2 ms hit
set(key, value, ttl)   → ok
delete(key)            → ok
# Client routes directly to owning node via consistent-hash of key (no proxy hop)
# add/incr/cas for atomic counters; mget for batch
```

**Data model.** Keys distributed by **consistent hashing** (with virtual nodes) across cache nodes; client library hashes the key and routes directly to the owning node — adding/removing a node remaps only its arc (~1/N of keys), avoiding mass misses. Each node is an in-memory hash map with an **eviction policy** (LRU / LFU / TTL). Hot keys optionally **replicated** across several nodes or fronted by a tiny per-process L1. Named tech: **Redis Cluster / Memcached (+ mcrouter) / Twemproxy**.
```
ring: 64 nodes × 160 vnodes = 10,240 tokens
key "session:9aB" → hash → vnode → node 37  (client routes directly)
node 37 entry: { value: <2KB>, expires_at: now+60s, lru_ts: ... }
hot key "homepage:feed" → replicated to nodes {12, 37, 51}, read any
```

**Architecture.**
```
READ (cache-aside):
  app → consistent-hash(key) → node 37 → GET
       hit  → return value                       (~0.2 ms, ~95% of traffic)
       miss → app fetches from origin DB → set(key, v, ttl) → return

NODE 37 DIES:
  client ring drops node 37 → its 1/64 of keys now route to next vnode owner
       → those keys MISS, refill from origin (bounded ~1.6%) → NOT a full flush

HOT KEY STAMPEDE (key expires):
  50k concurrent misses → single-flight: first miss takes a per-key lock,
       fetches origin once, fills cache; the other 49,999 wait on the lock
       then read the freshly-set value → origin sees 1 fetch, not 50k
```
Concrete trace: `session:9aB` hashes onto vnode owned by node 37. A read is a direct client→node 37 `GET` (~0.2 ms). On miss the app reads the origin DB, calls `set(session:9aB, v, ttl=60s)`, and returns (cache-aside). If node 37 dies, only its ~1.6% slice of keys remap to the next ring owner and refill — the other 63 nodes are untouched. For the hot key `homepage:feed`, expiry triggers **single-flight** so exactly one origin fetch happens while 50k concurrent readers wait on a per-key lock.

**Deep dive — eviction + hot keys + stampede single-flight.** Consistent hashing makes the cache **scale and survive node loss gracefully** (bounded remap, computed above as 1.6% vs 100%). Two operational killers remain. (1) **Stampede**: synchronized expiry of a hot key floods the origin — solved by **single-flight** (coalesce all concurrent misses into one origin fetch behind a per-key lock) plus **probabilistic early expiration** (refresh slightly before TTL using `now - delta·log(rand) ≥ expiry`, so TTLs don't all fire on the same tick) and TTL jitter. (2) **Hot keys**: one key's traffic (50k/s) exceeds a single node's capacity — solved by **replicating that key** across N nodes (read any) or a small in-process **L1 cache** in front of the distributed L2. Eviction policy bounds memory and shapes hit rate: LRU for recency-skewed access, LFU for frequency-skewed.

**Trade-offs & failure modes.**
- *Hashing:* consistent hashing (graceful scaling, 1.6% remap on node loss, slight imbalance fixed by vnodes) vs modulo hashing (trivial, but +1 node remaps ~everything → full miss storm).
- *Write policy:* cache-aside (app-managed, flexible, possible staleness) vs write-through (always consistent, adds write latency).
- *Node failure:* its keys miss and refill from origin — protect the origin with single-flight + early refresh or the refill itself becomes a stampede.
- *Staleness:* inherent to caching; tune TTL + explicit `delete` on writes to the tolerance.
- *Hot key:* a single key can hot-spot one node even with consistent hashing → replicate the key or add an L1 tier.

## 8.4 CDN

**Clarify.** Functional: cache and serve content (static assets + media) from edge PoPs near users; pull from origin on miss; invalidate content. Non-functional: **low global latency** (dominant constraint), high cache-hit ratio (origin offload), high availability, efficient invalidation. Core problems: edge caching strategy, origin protection (shielding), and cache invalidation.

**Estimate (worked).**
```
Scale: 300 edge PoPs, 10M req/s global, 95% target hit ratio
Origin load with vs without CDN:
  no CDN:          10M req/s all hit origin → origin must serve 10M/s (infeasible)
  CDN @ 95% hit:   origin sees 5% = 500k req/s
  + origin shield: 300 PoPs each miss the same new object once
                   → without shield: 300 misses storm origin per object
                   → with shield (1 mid-tier per region, ~10 regions):
                     origin sees ≤ 10 fetches per object, not 300
Egress saved: 9.5M req/s × avg 200 KB ≈ 1.9 TB/s served from edge, off origin
Versioned URL cost: 0 invalidation messages (new URL = new cache entry)
```
The numbers say: a 95% hit ratio cuts origin load **20×** (10M→500k), and origin shielding collapses a 300-PoP miss storm into ~10 fetches.

**API.**
```http
GET /assets/app.a1b2c3.js                 # versioned (content-hashed) URL
→ 200 OK
  Cache-Control: public, max-age=31536000, immutable   # 1 yr, never revalidate
  ETag: "a1b2c3"

GET /api/feed                              # semi-dynamic
→ 200  Cache-Control: public, max-age=30   # short TTL
GET /api/feed   (revalidate)  If-None-Match: "x7" → 304 Not Modified

POST /purge  { "urls": ["/assets/logo.png"] }   # explicit purge (origin → all PoPs)
→ 202 Accepted   (best-effort broadcast, eventually consistent across PoPs)
```

**Data model.** Edge caches keyed by content URL, holding object + TTL + validators (`ETag` / `Last-Modified`). **Tiered topology**: client → edge PoP → regional mid-tier (**origin shield**) → origin. Geo-routing (**DNS-based** or **anycast**) sends each user to the nearest healthy PoP. Named tech: **Cloudflare / Akamai / Fastly / CloudFront**.
```
edge cache entry:
  url:          /assets/app.a1b2c3.js
  body:         <bytes>
  expires_at:   now + 31536000
  etag:         "a1b2c3"
topology:  client → PoP(edge, hot/small) → shield(regional, larger) → origin
routing:   anycast IP advertised from all 300 PoPs → BGP routes to nearest
```

**Architecture.**
```
HIT:
  user → (anycast/DNS → nearest PoP) → edge cache HIT → serve (~10 ms)

MISS (with origin shield):
  user → edge PoP (miss) → regional shield
       shield HIT  → fill edge → serve
       shield MISS → origin GET → fill shield → fill edge → serve
  (300 PoPs missing the same new object → all funnel through ~10 shields
   → origin sees ~10 fetches, not 300 = no thundering herd)

INVALIDATION:
  versioned URL → deploy app.NEWHASH.js → old URL untouched, new URL cold-fills
  explicit purge → POST /purge → control plane broadcasts to 300 PoPs (best-effort)
```
Concrete trace: a user in Frankfurt requests `app.a1b2c3.js`; anycast routes to the Frankfurt PoP. On a cold PoP the request goes to the EU regional **shield**; if the shield also misses, one `GET` hits origin, fills shield then edge, and every subsequent EU PoP miss is served by the shield — origin sees ~one fetch per region. The asset uses a **content-hashed versioned URL** with `max-age=1yr, immutable`, so a deploy publishes `app.NEWHASH.js` (a brand-new cache key) and the old URL simply ages out — **zero invalidation messages**.

**Deep dive — invalidation (versioned URL vs purge vs TTL) + origin shielding.**

| Strategy | Propagation | Staleness | Best for |
|---|---|---|---|
| Versioned/hashed URL | instant (new key) | none (old+new coexist) | static assets w/ build step |
| Explicit purge | seconds, best-effort to 300 PoPs | until purge lands | urgent corrections |
| Short TTL | up to TTL | TTL window | semi-dynamic content |

Invalidation is famously hard. The pragmatic hierarchy: prefer **versioned/content-hashed URLs** for static assets (mutate the URL, never invalidate — old and new coexist; cost is build/deploy discipline), use **short TTLs** for semi-dynamic content (e.g. 30 s feeds), and reserve **explicit purge** for urgent corrections (a distributed broadcast to all PoPs, inherently best-effort / eventually consistent). **Origin shielding** collapses N edge misses into ~one origin fetch per region, which is what keeps a viral new object from stampeding the origin across all 300 PoPs simultaneously (the math above: 300 → ~10).

**Trade-offs & failure modes.**
- *Invalidation:* versioned URLs (instant, no purge, needs build discipline) vs purge (any content, slow + best-effort propagation) vs TTL (simple, stale window).
- *Topology:* tiered/shielded (protects origin, +1 hop on miss) vs flat (simpler, origin exposed to per-PoP miss storms).
- *Edge failure:* anycast/DNS reroutes to another PoP → cold cache there → temporary origin load spike until it warms.
- *Routing:* anycast (fast failover via BGP, less precise geo) vs DNS (precise, but TTL-limited failover speed).
- *Staleness:* inherent — tune TTL + invalidation strategy to content volatility; uncacheable/personalized content always reaches origin.

## 8.5 API gateway

**Clarify.** Functional: single entry point routing requests to backend services; TLS termination, auth, rate limiting, request/response transformation, observability. Non-functional: **minimal added latency** (dominant constraint — it's in *every* request path, so each ms multiplies across all traffic), high availability (it's a SPOF for everything), dynamic config (routes/policies change without redeploy). A cross-cutting-concerns layer in front of microservices.

**Estimate (worked).**
```
Sees full ingress: 2M req/s (highest QPS in the system)
Added latency budget: ≤ 1 ms p50 → everything must be local, no per-req network calls
Per-node: ~40k req/s with TLS + JWT verify + routing
         2M / 40k                       = 50 gateway nodes (stateless, behind LB)
Cost of a per-request control-plane call (anti-pattern):
         +5 ms × 2M req/s               = 10,000 node-seconds/s of added latency
         → config MUST be cached locally, not fetched per request
JWT verify: local RSA/ECDSA signature check ~50 µs vs auth-service RPC ~3 ms
```
The numbers say: at 2M req/s **every per-request network call is multiplied 2M times** — config, auth, and rate-limit state must all be local.

**API.**
```http
# The gateway IS the public API surface; control plane configures it:
PUT /control/routes
{ "match": {"host":"api.example.com","path":"/users/**"},
  "upstream": "users-svc", "timeout_ms": 800, "retries": 2,
  "auth": "jwt", "rate_limit": {"key":"tenant","rps":1000} }
→ 200  (pushed to all 50 gateway nodes, cached locally, eventually consistent ~secs)

# Data-plane request handling (per request):
GET api.example.com/users/42   Authorization: Bearer <jwt>
→ TLS term → verify JWT sig locally → check local rate bucket → route users-svc
→ 200 | 401 (bad token) | 429 (rate limited) | 503 (upstream circuit open)
```

**Data model.** Route table (`host/path → upstream`), auth config (JWKS public keys, scopes), rate-limit policies per route/tenant — all held in a **control plane** and **pushed + cached locally** at each gateway node for hot-path lookup. Gateways are **stateless** (scale horizontally behind an LB; rate-limit counters in a shared store or local-with-sync per the limiter design). Named tech: **Envoy / Kong / NGINX / AWS API Gateway**; control plane like Envoy xDS.
```
local cached config (per gateway node):
  routes:  [ {host:"api.example.com", path:"/users/**", upstream:"users-svc",
              timeout_ms:800, retries:2, breaker:{err_pct:50, window:10s}} ]
  jwks:    [ {kid:"k1", alg:"RS256", pubkey:...} ]   # verify locally, no RPC
  limits:  { "tenant:acme": {rps:1000, bucket: token-bucket} }
```

**Architecture.**
```
PER-REQUEST DATA PLANE (hot path, all local):
  client → LB → gateway node:
     TLS terminate
     → authenticate: verify JWT signature with cached JWKS (~50 µs, no RPC)
     → authorize: check scopes
     → rate limit: local/synced token bucket  → 429 if exceeded
     → route: longest-prefix match in cached route table
     → forward to upstream  (timeout 800ms, 2 retries w/ backoff, circuit breaker)
     → emit trace id + golden-signal metrics
     → return response

CONTROL PLANE (cold path):
  admin PUT /control/routes → control plane → push to all 50 nodes
       → nodes hot-swap cached config (eventually consistent, seconds)
```
Concrete trace: `GET /users/42` with a Bearer JWT arrives at gateway node 7. It terminates TLS, **verifies the JWT signature locally** against a cached JWKS public key (`kid=k1`, ~50 µs — no auth-service round trip), decrements the `tenant:acme` token bucket, longest-prefix-matches `/users/**` → `users-svc`, and forwards with an 800 ms timeout, 2 backoff retries, and a circuit breaker that trips at 50% errors over 10 s. A route change is pushed from the control plane and hot-swapped into the local cache within seconds — never fetched per request.

**Deep dive — auth + rate limit + routing at low latency.** The gateway centralizes cross-cutting concerns so services don't each reimplement them, but it sits in the hot path of 2M req/s, so **everything must be local and fast**: (1) **cached config** — routes/policies pushed from the control plane and read from local memory (a per-request control-plane call would add ~5 ms × 2M/s, computed above); (2) **local JWT verification** — validate the signature against cached JWKS public keys (~50 µs) rather than an auth-service RPC (~3 ms) per request; (3) **local/synced rate-limit counters** — a local token bucket (per node, occasionally synced) avoids a shared-store round trip per request, trading slight global-limit imprecision for latency (per the 1.4 limiter trade-off). Config changes are eventually consistent (pushed + cached); request handling is hot-path optimized.

**Trade-offs & failure modes.**
- *Topology:* centralized gateway (uniform policy, single choke point, +1 hop) vs per-service middleware / service-mesh sidecars (no central hop, harder to enforce uniformly).
- *Config:* local cached config (fast, briefly stale) vs per-request control-plane lookup (consistent but +5 ms × all traffic — unacceptable).
- *HA:* must run many stateless instances behind an LB — it's a SPOF for *all* traffic, so no single node can be load-bearing.
- *Bad upstream:* per-upstream timeouts + retries-with-backoff + circuit breakers + bulkheads stop one slow/failing backend from cascading and exhausting gateway threads.
- *Rate-limit accuracy:* local buckets can slightly overshoot the global limit under fan-out; acceptable for latency, or use a shared store when precision matters.

## 8.6 Feature flag service

**Clarify.** Functional: evaluate flags (on/off, percentage rollouts, attribute targeting) at request time; change flags and propagate fast (seconds). Non-functional: **ultra-low-latency reads** (dominant constraint — evaluated on nearly every request), fast write propagation, high availability (flag-service outage must *never* break the app). Read-dominated, write-rare.

**Estimate (worked).**
```
Evaluations: 5M req/s × 8 flags each   = 40M evaluations/s
Flag changes: ~20/day                  ≈ negligible write rate
Two designs compared:
  remote evaluate (RPC per flag):  40M RPC/s + ~3 ms each on the hot path → infeasible
  local in-process evaluate:       40M × ~1 µs (in-memory rule eval) → ~0 added latency
Config payload: 2,000 flags × ~500 B   ≈ 1 MB ruleset → trivially fits in SDK memory
Propagation: streaming push fan-out to 10,000 SDK instances, ~1 update/change
```
The numbers say: 40M evals/s makes a per-flag RPC impossible — the only viable design is **ship the ruleset, evaluate in-process** (1 µs vs 3 ms).

**API.**
```
# SDK bootstrap + streaming:
GET  /flags?env=prod              → 200 { full ruleset, version: 4711 }   # bulk, CDN-cached
SSE  /flags/stream?since=4711     → push { flag changed, new ruleset version }

# In-process (no network) — the hot path:
evaluate("new-checkout", {user_id:"u_42", country:"DE", plan:"pro"})
  → variant "on"     # deterministic, sticky, ~1 µs

# Admin:
PUT  /admin/flags/new-checkout
{ "default": "off", "rules": [{"if":{"plan":"pro"}, "rollout": 25}] }
→ 200  (version bumped → pushed to all SDKs)
```

**Data model.** Flag definitions (`key, type, default, targeting_rules, rollout_percentage`) in a config store, served as a single **versioned ruleset**. The crucial pattern: **SDKs cache the entire ruleset in memory and evaluate in-process** — zero network per evaluation. Percentage rollouts use a **deterministic hash** for sticky bucketing. Changes propagate via streaming (SSE/WebSocket) push or short-interval poll. Named tech: **LaunchDarkly / Unleash / Flagsmith / Statsig**.
```
ruleset (version 4711, ~1 MB, cached in every SDK):
  new-checkout:
    type: variant   default: "off"
    rules: [ {if: {plan:"pro"},    serve:"on"},
             {if: {country:"DE"},  rollout: 25} ]   # 25% of DE users
bucketing:  hash("new-checkout:u_42") mod 100 = 17  →  17 < 25 → "on"  (sticky)
fallback:   if service unreachable → use last-known-good ruleset, else default "off"
```

**Architecture.**
```
EVALUATION (in-process, hot path):
  app request → SDK.evaluate("new-checkout", ctx)
       → walk cached rules in memory
       → percentage rule: bucket = hash("new-checkout:"+user_id) mod 100
       → bucket < rollout% ? variant : next rule / default
       → return variant   (~1 µs, no I/O)

PROPAGATION (cold path):
  admin PUT flag → version 4711→4712
       → service pushes new ruleset over SSE stream to all 10k SDKs (~seconds)
       → SDK atomically swaps in-memory ruleset
  bulk fetch GET /flags is CDN-cached for cold SDK starts

AVAILABILITY:
  service unreachable → SDK keeps serving last-known-good ruleset
       → if never fetched → fall back to compiled-in defaults (fail safe)
```
Concrete trace: an SDK holds ruleset v4711 in memory. `evaluate("new-checkout", {user_id:"u_42", country:"DE", plan:"pro"})` walks the rules locally; the `plan:"pro"` rule matches → returns `"on"` in ~1 µs with no network. For a DE free user, the percentage rule computes `hash("new-checkout:u_42") mod 100 = 17 < 25` → `"on"`, and the **same user always lands in bucket 17** (sticky — no flicker). An admin flipping the rollout to 50% bumps the version to 4712, pushed over SSE to all SDKs within seconds; each SDK atomically swaps its ruleset. If the service is unreachable, the SDK keeps the last-known-good ruleset, and worst case falls back to defaults.

**Deep dive — low-latency reads + fast propagation.** The defining decision is **evaluate locally, propagate config**: shipping the whole ruleset (~1 MB) to each SDK and evaluating in-process removes the network from the hot path entirely. The alternative — a remote `evaluate` RPC per flag per request — would add ~3 ms to every request and make the flag service a hard per-request dependency (40M RPC/s, infeasible). Changes propagate via **streaming push** (SSE/WebSocket) for near-real-time, eventually-consistent updates; a CDN-cached bulk fetch handles cold starts. **Deterministic hashing** (`hash(flag_key:user_id) mod 100`) gives stable, sticky rollouts so a user doesn't flicker between variants across requests or across SDK instances, and ramping the percentage only *adds* users to the treatment bucket.

**Trade-offs & failure modes.**
- *Evaluation:* local in-process (zero read latency, config seconds-stale) vs remote (always current, +3 ms and a hard per-request dependency) — latency + availability win decisively.
- *Propagation:* streaming push (fast, more infra to fan out to 10k SDKs) vs polling (simple, laggier, wasteful).
- *Availability — the critical discipline:* the SDK must **fail safe** to last-known-good or compiled defaults. A flag-service outage degrading to defaults is fine; one that breaks the app is catastrophic.
- *Stale config:* a few seconds of propagation lag is acceptable; sticky bucketing keeps the rollout coherent even mid-propagation.
- *Bad flag rollout:* mitigated by gradual % ramp + instant flip back to the previous version.

## 8.7 Distributed lock service

**Clarify.** Functional: `acquire`/`release` a named lock so only one client holds it at a time across a distributed system; handle holder crashes. Non-functional: **correctness under failure** (dominant constraint — *no two holders ever*, even during partitions, failovers, or GC pauses), linearizable, available while a quorum survives. The subtle, dangerous one — naive locks (single Redis, plain TTL) are unsafe. Think **Chubby / ZooKeeper / etcd**.

**Estimate (worked).**
```
Volume: modest — ~10k lock ops/s — but each is correctness-critical
Consensus group: 5 nodes (etcd/ZK) → tolerates 2 failures, needs 3 for quorum
Write cost: each acquire = 1 Raft commit = 1 round trip to majority (~2–5 ms)
Lease TTL: 10 s; holder renews every ~3 s (3× margin before expiry)
Hazard window: GC pause > lease TTL → holder loses lock but doesn't know it
         → fencing token makes the resource reject the zombie (no two writers)
Quorum failure: minority partition (≤2 of 5) cannot grant ANY lock → CP, safe
```
The numbers say: throughput is low, but **a quorum (3 of 5) is mandatory to grant a lock** — without it the service refuses rather than risk split-brain.

**API.**
```
acquire(lock, ttl=10s)        → { granted: true, token: 1043 }   # monotonic fencing token
renew(lock, token=1043)       → { ok, new_expiry }               # heartbeat before TTL
release(lock, token=1043)     → ok
# Every write to the PROTECTED RESOURCE must carry the token:
write(resource, data, fence_token=1043)
  → accepted only if 1043 ≥ highest token the resource has seen, else REJECTED
```

**Data model.** Locks stored in a **consensus-backed store** (**Raft** in etcd, **Zab** in ZooKeeper) so lock state is **linearizable** and survives node failure. Each grant carries a **lease (TTL)** for auto-expiry on crash and a monotonically increasing **fencing token** for safety against zombies. Named tech: **etcd / ZooKeeper / Chubby / Consul**.
```
lock state (replicated by Raft across 5 nodes, committed by quorum of 3):
  lock "shard-7-leader":
    holder:      "worker-A"
    lease_expiry: now + 10s
    fence_token:  1043          # incremented on every successful acquire
protected resource keeps:  highest_token_seen = 1043
  → a write carrying token 1042 (a revived old holder) is REJECTED
```

**Architecture.**
```
ACQUIRE:
  client → consensus group (5 nodes, Raft):
       leader proposes grant → committed by quorum (3 of 5)
       → returns { granted, lease 10s, fence_token = 1043 }

HOLDER LIFECYCLE:
  worker-A renews every 3s (renew before 10s TTL)
       crash → no renew → lease lapses at 10s → lock auto-frees (no deadlock)
       GC pause 12s → lease expired at 10s → worker-B acquires (token 1044)
            worker-A resumes, still "thinks" it holds lock 1043
            → worker-A writes to resource with token 1043
            → resource has seen 1044 → 1043 < 1044 → REJECTED  (no two writers)

SPLIT-BRAIN PREVENTION:
  service partitions 3|2 → only the 3-node side has quorum → grants locks
       2-node minority → cannot reach quorum → grants NOTHING (CP, refuses)
```
Concrete trace: `worker-A` calls `acquire("shard-7-leader", ttl=10s)`; the Raft leader proposes the grant, a quorum of 3-of-5 commits it, and A gets `{token: 1043}`. A renews every 3 s. Now A suffers a 12 s GC pause: its lease lapses at 10 s, `worker-B` acquires and gets `token: 1044`, then A wakes up still believing it holds the lock and tries `write(resource, ..., fence_token=1043)`. The resource has already accepted token 1044, so it rejects 1043 — **two processes both thought they held the lock, but only one write was accepted**. A 3|2 partition lets only the 3-node majority grant locks; the minority refuses everything.

**Deep dive — leases + fencing tokens + split-brain.** Two failure modes must be handled together. **Holder crash** → solved by **leases**: the lock auto-expires (TTL 10 s), so a dead holder can't deadlock the resource forever. **Holder pause/partition then resume** → leases alone are *insufficient*: a process paused past its lease can resume after a new holder acquired, producing two "holders." This is solved by **fencing tokens** — a monotonically increasing number per grant, enforced by the *downstream resource*, which only accepts a token ≥ the highest it has seen; a revived zombie presents an older (smaller) token and is rejected. This is what makes the lock *actually* safe — a lock service without fencing is unsafe for protecting real resources. **Split-brain** (the lock service itself partitioning) is prevented by **consensus** (Raft/Zab): granting requires a majority quorum, so a minority partition can't independently grant the same lock.

**Trade-offs & failure modes.**
- *Backing store:* consensus-backed (linearizable, safe, **CP** — needs quorum to grant) vs single-node/Redis lock (fast, but unsafe under failover/partition unless rigorously fenced).
- *Leases:* prevent deadlock but introduce the resume-after-expiry hazard → **fencing tokens are mandatory**, not optional.
- *GC pause / clock skew:* the canonical danger — fencing tokens neutralize it because safety is enforced at the resource, not by the holder's belief.
- *Partition:* being CP, the service is unavailable to a minority partition (loses quorum) — correct, since granting without quorum risks two holders.
- *Resource cooperation required:* if the protected resource can't check fencing tokens, true safety is impossible regardless of the lock service.

## 8.8 Configuration service

**Clarify.** Functional: store config; clients **watch** for changes and get notified; versioned values; safe gradual rollout with rollback. Non-functional: **strong consistency on config values** (dominant constraint — all clients must agree on the current value and ordering), low-latency reads, reliable change notification (watches), instant rollback. Related to feature flags but emphasizes consistency, watches, and versioning. Think **etcd / ZooKeeper / Consul**.

**Estimate (worked).**
```
Reads: frequent — services read on startup + on every change notification
Writes: rare but critical (a bad config push is a top outage cause)
Consensus group: 5 nodes (Raft) → quorum of 3, tolerates 2 failures
Write cost: 1 Raft commit ≈ 2–5 ms (committed by majority, then visible)
Watch fan-out: 1 key watched by 5,000 service instances
         → one change → server streams the new revision to all 5,000 watchers
         vs polling: 5,000 instances × poll every 5s = 1,000 reads/s of churn waste
Version history: keep last N revisions per key → instant rollback (revert pointer)
```
The numbers say: writes are rare but each fans out to thousands of watchers — **push (watch) beats polling**, and versioning makes rollback a pointer move.

**API.**
```
get(path)                         → { value, revision: 88 }
put(path, value, if_revision=88)  → { revision: 89 }   # CAS; 409 if revision moved
watch(path, since_revision=88)    → stream of { path, value, revision } in order
list(prefix="/svc/")              → [ {path, value, revision}, ... ]
rollback(path, to_revision=87)    → { revision: 90 }   # writes old value as new rev
```

**Data model.** A **hierarchical key space** (paths) in a **consensus-backed store** (**Raft**) for linearizable, versioned values. Every write bumps a global/key **revision**; full history is retained for rollback. Clients register **watches** on paths/prefixes with a known revision and receive ordered change events (push). Strongly consistent — unlike feature flags, which lean eventual. Named tech: **etcd (MVCC + Raft) / ZooKeeper / Consul**.
```
key space (Raft-replicated, MVCC):
  /svc/payments/db_pool_size  → { value: "50", revision: 88 }
  /svc/payments/timeout_ms    → { value: "800", revision: 84 }
revision history for db_pool_size:
  rev 86: "20"   rev 87: "30"   rev 88: "50"     ← rollback = re-put rev 87's value
watchers on /svc/payments/:  [inst-1@rev88, inst-2@rev88, ... inst-5000@rev88]
```

**Architecture.**
```
WRITE (CAS):
  admin put("/svc/payments/db_pool_size","50", if_revision=88)
       → Raft leader proposes → quorum of 3/5 commits → revision 89
       → 409 if current revision ≠ 88 (someone else wrote → lost-update prevented)

WATCH (push, ordered):
  inst-N watch("/svc/payments/", since=88)
       → on commit of rev 89 → server pushes {path, value, revision:89} to all watchers
       → every watcher transitions 88 → 89 in the SAME order (revision-ordered)

SAFE ROLLOUT / ROLLBACK:
  canary: change config for a subset of paths/instances → observe metrics
       healthy → roll forward
       broken  → rollback(path, to_revision=88) → re-commits old value as rev 90
                 → watchers pushed rev 90 instantly → reverted in seconds
```
Concrete trace: an operator runs `put("/svc/payments/db_pool_size", "50", if_revision=88)`. The Raft leader proposes it, a quorum of 3-of-5 commits, and it becomes **revision 89**; if another write had already moved the revision past 88, the CAS returns `409` (lost-update prevented). All 5,000 payment instances **watching** `/svc/payments/` are pushed `{db_pool_size:"50", revision:89}` in revision order — every instance transitions 88→89 identically. If the new pool size degrades the service, `rollback(path, to_revision=88)` re-commits the old value as revision 90 and watchers are pushed the revert within seconds.

**Deep dive — watches + versioning + rollout.** **Watches** are the defining feature: rather than 5,000 instances polling (computed waste above), the service **pushes** changes in **revision order**, so reconfiguration is near-real-time and consistently ordered across all watchers — everyone transitions through the same sequence of versions, never seeing them out of order or skipping one. The server tracks each watcher's last-acked revision and resumes from there after a disconnect (no missed change). **Versioning** (every change is a new immutable MVCC revision) enables **CAS** (`if_revision`) to prevent lost updates and one-pointer **rollback** to any prior revision. **Safe rollout** uses version + targeting to canary a change, observe, then roll forward or revert instantly — config changes are a top cause of outages, so atomic versioned changes with fast rollback are the core safety mechanism.

**Trade-offs & failure modes.**
- *Consistency:* strong via consensus (correct, ordered, **CP** — unavailable for writes without quorum) vs eventually-consistent config (always available, risk of split views — dangerous for config that must be coherent across a fleet).
- *Notification:* watches (efficient push, server must track per-watcher revision) vs polling (simple, laggy, wasteful at 5,000-instance fan-out).
- *Partition:* a minority partition stops accepting writes; it can still serve last-committed reads — correct, since serving divergent config would be worse.
- *Lost update:* prevented by CAS on revision (`409` on conflict).
- *Bad config push:* mitigated by canary + **instant version rollback** (revert pointer to a known-good revision).

# 9. Data, logging, and analytics systems

> These are **pipeline** systems: ingest a firehose, buffer it, process it, store it for query. The recurring tools: message logs (Kafka) as the buffer/backbone, stream processing, time-windowed aggregation, and the batch-vs-stream + exactly-once questions.

## 9.1 Logging pipeline

**Clarify.** Functional: collect structured/unstructured logs from thousands of services and hosts, make recent logs searchable, retain per policy (e.g. 7 days hot, 30 days warm, 1 year cold for compliance). Non-functional: absorb bursty volume without backpressuring the apps (logging must never block the request path), search recent logs in < 2 s, cost-efficient retention (logs are voluminous and ~99% are never read). Heavily **write-heavy** — writes:reads ≈ 1000:1. **At-least-once** is fine; sampling/dropping high-volume low-value logs under load is acceptable.

**Estimate (worked).**
```
Fleet:    5,000 hosts × ~400 log lines/s         ≈ 2,000,000 lines/s
Bytes:    avg line ~400 B (JSON + fields)        ≈ 800 MB/s ingest
          peak ×2                                 ≈ 1.6 GB/s
Storage/day (raw):  800 MB/s × 86,400 s          ≈ 69 TB/day raw
          Kafka gzip ~6:1                          ≈ 11.5 TB/day on the bus
Hot index (ES, ~7d, +inverted-index ~30% overhead):
          69 TB/day × 7 × 1.3 ≈ 628 TB hot — too costly, so SAMPLE
          sample DEBUG/INFO 10%, keep WARN/ERROR 100% → ~15 TB/day indexed
Cold (object store, gzip/parquet, 1 yr): 11.5 TB/day × 365 ≈ 4.2 PB/yr
Retention tiers: hot 7d (ES) | warm 30d (ES frozen/searchable snapshot) | cold 1yr (S3)
```
Takeaway: indexing is the cost driver, not ingest — sample noisy logs and tier by age so you index only the ~hot 15 TB/day people actually query.

**API.**
```http
# Ingest (agent → collector, batched, gzip)
POST /v1/logs:bulk        Content-Encoding: gzip
{ "service":"checkout", "host":"web-42", "lines":[
   {"ts":"2026-06-17T10:01:02.331Z","level":"ERROR","msg":"payment declined","trace_id":"abc123","fields":{"order":"o_99"}}
]}
→ 202 Accepted   { "ingested": 1, "dropped": 0 }      # async; never blocks the app
→ 429 Too Many Requests  Retry-After: 1               # collector shedding load

# Query (recent/hot, Lucene-style)
GET /v1/logs?service=checkout&level=ERROR&q=trace_id:abc123&from=2026-06-17T10:00Z&to=2026-06-17T11:00Z&limit=100
→ 200 { "hits": 3, "results": [ {...} ], "from_tier": "hot" }
→ 200 { "hits": 0, "results": [], "from_tier": "cold", "note": "async restore, poll job_id=..." }  # cold archive
```

**Data model.** Logs ride a **buffer (Kafka)** → consumers parse/enrich → write to a search index (**Elasticsearch/OpenSearch**) for hot/warm data → age out to **object storage (S3) as gzipped Parquet** for cold/compliance.
```
Kafka topic: logs.raw
  partitions: 256          key = service_name   (colocates a service's logs; even spread across services)
  retention: 24h           (replay window if the indexer falls behind/crashes)
  value: JSON log line

Elasticsearch index (hot/warm), one index per service per day:
  logs-checkout-2026.06.17
  doc: { ts: date, level: keyword, msg: text(analyzed), host: keyword,
         trace_id: keyword, service: keyword, fields: object }
  shards: 5 primary + 1 replica;  ILM: hot 7d → warm(frozen) 30d → delete (archived to S3 first)

Cold (S3): s3://logs/cold/service=checkout/dt=2026-06-17/part-*.parquet.gz   (queried via Athena/Presto)
```
Partition Kafka by `service_name` so a single service's logs land in-order on one partition (debuggable) while load spreads across all services.

**Architecture.**
```
hosts ──agent(Vector/Fluent Bit)──► collector ──► Kafka logs.raw (256 part, 24h)
 (tail+batch+gzip)                    (202/429)        │
                                                       ▼
                                         indexer consumers (parse/enrich/sample)
                                                       │
                              ┌────────────────────────┼──────────────────────┐
                              ▼                         ▼                       ▼
                       ES hot (7d)              ES warm/frozen (30d)     S3 cold parquet (1yr)
                              │                         │                       │
                              └──── GET /v1/logs query (recent) ──┘     Athena (cold restore)
```
Trace one line: an `ERROR` on `web-42` is tailed by the **Vector** agent, batched (5,000 lines / 1 s flush) and gzip-shipped to the collector, which appends to Kafka partition `hash("checkout") % 256`. An indexer consumer reads the batch, keeps it (ERROR = 100% sample), parses `trace_id` into a `keyword` field, and bulk-writes to `logs-checkout-2026.06.17` in ES. An engineer's `GET /v1/logs?q=trace_id:abc123` hits the hot index and returns in ~200 ms. After 7 days ILM moves the index to a frozen searchable-snapshot tier; after 37 days it's deleted from ES (already mirrored to S3 Parquet for the 1-year compliance window).

**Deep dive — buffering + indexing + retention tiers.** The **Kafka buffer** is the linchpin: apps fire-and-forget to a local agent, so an ES outage or a slow indexer just grows the 24h backlog instead of blocking requests or losing data (replay from the last committed offset on recovery). **Indexing** is the expensive part — building an inverted index over `msg` text costs CPU + ~30% storage overhead, so it's confined to hot/warm and noisy levels are sampled.

| Tier | Store | Latency | Cost/TB/mo | Retention | Query |
|---|---|---|---|---|---|
| Hot | ES, NVMe | ms | ~$$$ | 7 d | Lucene, instant |
| Warm | ES frozen / searchable snapshot on S3 | seconds | ~$$ | 30 d | Lucene, slower |
| Cold | S3 Parquet (gzip) | seconds–minutes (restore) | ~$ | 1 yr | Athena/Presto SQL |

**Trade-offs & failure modes.**
- *Sampling:* at-least-once + sampling DEBUG/INFO at 10% (cheap, may drop a line you wanted) vs index-everything (full fidelity, ~40× the hot cost). Keep WARN/ERROR at 100%.
- *Indexer backlog:* if ES can't keep up, Kafka lag grows; bounded by 24h retention — beyond that you lose un-indexed logs, so alert on consumer lag and over-provision the indexer for peaks.
- *Cardinality/volume explosion:* a service logging per-request unique fields blows up the inverted index → cap field cardinality and per-service ingest quotas.
- *Collector overload:* shed with `429 + Retry-After` and sample at the agent rather than letting the collector OOM and drop silently.

## 9.2 Metrics / monitoring system

**Clarify.** Functional: ingest time-series metrics (counters/gauges/histograms with labels), store compactly, run range/aggregation queries (rate, percentiles), evaluate alert rules. Non-functional: very high **write rate**, fast time-range queries, and above all **control cardinality** — each unique `(metric, label-set)` is a separate series, and an unbounded label (user_id) creates billions of series and OOMs the TSDB. Think Prometheus/Datadog/M3. Writes ≫ reads but dashboards and alert rules query continuously. Approximate/brief gaps are acceptable; exactly-once is not needed.

**Estimate (worked).**
```
Series:   10,000 hosts × ~1,000 series/host        ≈ 10,000,000 active series
Scrape:   every 15 s → 10M / 15                      ≈ 670,000 samples/s
On-disk (Gorilla compression: delta-of-delta ts + XOR float):
          raw sample = 16 B (8B ts + 8B float)
          compressed ≈ 1.3 B/sample (measured Prometheus avg)
          670k/s × 1.3 B × 86,400 s                  ≈ 75 GB/day compressed  (vs ~925 GB raw → ~12:1)
Index:    per-series label index ~ a few KB/series   → 10M series ≈ tens of GB RAM (the real limiter)
Cardinality budget: cap at ~10M active series; reject labels that would blow it
Rollups:  raw 15s (15d) → 1m (90d) → 1h (2yr)        # downsample for cheap long retention
```
Takeaway: point volume compresses ~12:1 and is cheap; it's **series cardinality** (index + memory) that kills you, so the budget is in series, not bytes.

**API.**
```http
# Ingest (remote-write, Snappy-compressed protobuf) or pull/scrape
POST /api/v1/write          Content-Encoding: snappy
  series: http_requests_total{service="checkout",method="POST",code="500"}  value=42  ts=...
→ 204 No Content
→ 400 Bad Request  { "error": "series limit exceeded for metric http_requests_total" }

# Query (PromQL)
GET /api/v1/query_range?query=rate(http_requests_total{service="checkout",code=~"5.."}[5m])&start=...&end=...&step=15s
→ 200 { "status":"success","data":{"resultType":"matrix","result":[{"metric":{...},"values":[[ts,"3.2"],...]}]}}
GET /api/v1/query?query=histogram_quantile(0.99, rate(http_latency_bucket[5m]))   → 200 (instant p99)
```

**Data model.** A **TSDB** (Prometheus/Mimir/M3DB/VictoriaMetrics) keyed by `metric{labels}`.
```
Series id   = hash(metric_name + sorted_labels)        # e.g. http_requests_total{service="checkout",code="500"}
Sample      = (timestamp, float64)
Storage:    2h in-memory "head" block → flushed to immutable on-disk blocks
  timestamps: delta-of-delta (scrapes are ~regular → mostly 0 deltas → bit-packed)
  values:     XOR vs previous (slow-changing gauges → mostly zero XOR → ~1 bit)  [Gorilla]
Inverted index: label → posting list of series ids (for query matching), kept in memory
Rollup tables: metric_1m, metric_1h  (avg/min/max/count per window, written by a compactor)
Partition by: series-hash (spreads write load) + time-range (blocks per 2h, enables retention drop)
```

**Architecture.**
```
exporters ──scrape/15s──► ingesters (TSDB head, 2h in-RAM) ──flush──► object store / disk blocks
                               │  (remote-write fan-in)                      │
                               ▼                                              ▼
                          query frontend ◄────── store-gateway (reads blocks) + compactor (rollups)
                               │
                  ┌────────────┴───────────┐
                  ▼                         ▼
            dashboards (PromQL)     rule evaluator (alerts) ──► Alertmanager (dedup/group/route)
```
Trace one sample: a checkout pod exposes `http_requests_total{...code="500"}`; an ingester scrapes it every **15 s**, appends `(ts, 42.0)` to the in-memory head block where delta-of-delta + XOR compress it to ~1.3 B. After 2 h the head flushes to an immutable block on object storage. A dashboard runs `rate(...[5m])` → the query frontend fans out to ingesters (recent 2h) + store-gateway (older blocks). A **compactor** downsamples 15s→1m after 15 d and 1m→1h after 90 d. The rule evaluator runs `rate(...{code=~"5.."}[5m]) > 0.05` every 15 s; on firing it pushes to **Alertmanager**, which groups by `service`, dedups across replicas, and routes to PagerDuty.

**Deep dive — cardinality + rollups + Gorilla compression.** Metrics are regular and slowly-changing, so **Gorilla** encoding (delta-of-delta timestamps, XOR floats) reaches ~1.3 B/sample (~12:1). The make-or-break concern is **cardinality**: every distinct label combination is a separate series with its own posting-list entry held in RAM, so a single bad label like `user_id="..."` turns 1 series into millions and OOMs the ingester. Guard rails: reject high-cardinality labels at write time, enforce a per-metric series cap (`400` on breach), and never label with unbounded values (ids, raw URLs, timestamps). **Rollups** trade resolution for retention cost — nobody queries per-second data from a year ago, so the compactor keeps 15s for 15 d, 1m for 90 d, 1h for 2 yr, making long-range queries both cheap and fast.

**Trade-offs & failure modes.**
- *TSDB vs general DB:* purpose-built TSDB (12:1 compression, fast range scans) vs a relational/KV store (flexible but orders of magnitude less efficient for series).
- *Cardinality explosion:* the dominant failure — one unbounded label OOMs ingesters fleet-wide. Enforce limits and relabel/drop offenders.
- *Resolution vs cost:* high-res forever (detailed, expensive) vs downsampled old data (cheap, lossy) — rollups give both.
- *Alerting HA:* run rule evaluators + Alertmanager redundantly — an alerting system down during an incident is the worst case; dedup handles the duplicate firings from replicas.
- *Late/clock-skewed samples:* out-of-order samples past the head window are dropped — accepted, brief gaps are fine.

## 9.3 Ad click aggregator

**Clarify.** Functional: ingest impression and click events, **deduplicate** retries, **attribute** clicks to impressions within a window, aggregate counts for billing/reporting, filter fraud. Non-functional: high volume, **exactly-once** accuracy because this drives advertiser **billing** (over/undercounting is money), bounded attribution windows, fraud filtering before counting. Stream processing where correctness > freshness. Write-heavy ingest; reports are read-light and pre-aggregated.

**Estimate (worked).**
```
Impressions: ~3,000,000/s peak ;  clicks at ~1% CTR ≈ 30,000/s
Event size:  ~300 B (ids, campaign, ts, fingerprint) → impressions ≈ 900 MB/s
Kafka:       partition by campaign_id; 512 partitions
Dedup state: unique event_id seen-set, bounded to attribution window (24h)
             30k clicks/s + 3M imp/s × 24h is huge → keep dedup keyed + TTL'd in RocksDB state, not RAM
Attribution: click attributes to impression if click.ts - imp.ts ≤ 24h, same (user, ad)
Aggregates:  per (campaign, minute): impressions, clicks, spend → OLAP rows
             ~50k campaigns × 1440 min/day ≈ 72M rows/day in ClickHouse (cheap, columnar)
Watermark:   allow lateness 10 min; finalize window after watermark passes
```
Takeaway: billing means exactly-once + dedup + event-time windows are mandatory — the relaxed "approximate is fine" of trend analytics does **not** apply.

**API.**
```http
# Ingest (edge → Kafka), every event carries a client-generated unique id
POST /v1/events
{ "type":"click","event_id":"evt_7f3a","ad_id":"ad_55","campaign":"cmp_9","user":"u_1","ts":"2026-06-17T10:00:01Z","fingerprint":"..." }
→ 202 Accepted     # idempotent on event_id; safe to retry

# Reporting (pre-aggregated, from OLAP)
GET /v1/reports?campaign=cmp_9&from=2026-06-17&to=2026-06-17&granularity=hour
→ 200 { "rows":[ {"hour":"2026-06-17T10:00Z","impressions":182000,"clicks":1920,"spend":384.00} ] }
```

**Data model.** Events → **Kafka** → **Flink** stream processor (dedup + windowed attribution + aggregation) → **ClickHouse** OLAP for reporting.
```
Kafka topic: ad.events
  partitions: 512    key = campaign_id   (colocates a campaign's events for stateful, per-key processing)

Flink keyed state (RocksDB-backed, checkpointed to S3):
  dedup:        MapState<event_id, ts>      TTL = 24h   (drops at-least-once duplicates)
  imp_window:   for each (user, ad_id) → impression event, retained 24h for attribution
  agg:          ReducingState<(campaign, minute) → {imp, clk, spend}>

ClickHouse table (columnar, partitioned by day, ordered by campaign):
  campaign_clicks(campaign String, minute DateTime, impressions UInt64, clicks UInt64, spend Decimal)
  PARTITION BY toDate(minute)  ORDER BY (campaign, minute)
```

**Architecture.**
```
edge ──POST /v1/events──► Kafka ad.events (512 part, key=campaign)
                              │
                              ▼
                          Flink job (event-time, watermark = max_ts − 10min)
                          ├─ dedup on event_id (RocksDB TTL 24h)
                          ├─ fraud filter (rate/fingerprint anomalies)
                          ├─ attribution join: click ⋈ impression within 24h window
                          └─ window aggregate per (campaign, 1-min tumbling)
                              │  exactly-once: checkpoint(state)+Kafka-tx commit
                              ▼
                          ClickHouse (transactional sink) ──► GET /v1/reports
```
Trace one click: `evt_7f3a` arrives twice (client retry) → Flink keys by `campaign=cmp_9`, checks `dedup` state, drops the second copy. The fraud filter passes it (no fingerprint anomaly). Attribution looks up `(user=u_1, ad=ad_55)` in `imp_window` state, finds an impression 4 min earlier (< 24h) → attributes the click and adds spend. It's folded into the `(cmp_9, 10:00)` 1-minute tumbling window. The **watermark** (max event ts − 10 min) lets clicks delayed by network still land in the right window; once it passes 10:01, the window finalizes and commits to ClickHouse via a **transactional sink** aligned with Flink's checkpoint, so a crash-and-replay re-emits the exact same window without double-billing.

**Deep dive — dedupe + attribution windows + exactly-once.** Because this is billing, three mechanisms turn an unreliable firehose into auditable counts. **Dedup**: every event has a client-generated `event_id`; Flink keeps a TTL'd seen-set in RocksDB and drops duplicates from at-least-once delivery and client retries. **Attribution windows** use **event-time + watermarks**, not arrival time — a click delayed 8 min must still attribute to its impression, so windows wait for the watermark (lateness bound 10 min) before finalizing; events later than that are dropped to a side output and logged. **Exactly-once**: Flink checkpoints all keyed state to S3 and commits the ClickHouse write inside the same checkpoint barrier (two-phase / transactional sink), so replay after failure produces identical aggregates.

| Approach | Accuracy | Latency | Complexity |
|---|---|---|---|
| At-least-once + idempotent/dedup sink | exact if sink dedups | low | medium |
| **Exactly-once (checkpoint + tx sink)** | billing-grade | +window+checkpoint lag | high |
| Processing-time windows | mis-attributes late events | lowest | low |
| Event-time + watermark | correct for late data | waits for stragglers | high |

**Trade-offs & failure modes.**
- *Exactly-once vs at-least-once:* exactly-once is billing-accurate but adds checkpoint + window latency; at-least-once needs an idempotent dedup sink to be safe.
- *Event-time vs processing-time:* event-time + watermark is correct for late clicks but waits for stragglers; processing-time is simple but mis-attributes delayed events.
- *Late events:* clicks past the 10-min lateness bound are dropped/logged — a bounded, accepted inaccuracy.
- *Fraud:* filtering trades some recall for billing integrity.
- *State growth:* 24h dedup + impression state is large → RocksDB on disk + TTL, not RAM; checkpoint to S3 so a crash replays from the last barrier.

## 9.4 Real-time dashboard

**Clarify.** Functional: show live aggregated metrics (active users, sales/min, error rate) updating every few seconds. Non-functional: low end-to-end latency (event → screen in seconds), continuous streaming aggregation, **backpressure** handling when ingest outpaces compute, and **freshness over completeness** (a fresh-but-slightly-incomplete number beats a stale-but-complete one). Read-light (few dashboard viewers) but compute-continuous. Approximate under load is acceptable — this is not billing.

**Estimate (worked).**
```
Ingest:   ~1,000,000 events/s (orders, clicks, errors)
Viewers:  ~500 concurrent dashboards (read-light)
Metrics:  ~50 live aggregates (active_users, sales/min, error_rate, ...)
Windows:  sliding 1-min window, slide 5s  →  emit every 5s
Push:     coalesce → 50 metrics × (1/5s) × 500 viewers ≈ 5,000 msgs/s out (trivial)
State:    HyperLogLog for unique active users (~12 KB/HLL, ~2% error) instead of exact sets
Buffer:   Kafka absorbs spikes; under load, degrade to approximate (HLL) + delayed windows
```
Takeaway: the challenge is keeping ~50 aggregates fresh continuously, not query QPS — push the computed answer, never raw events.

**API.**
```http
# Subscribe to live aggregates (server pushes on each window emit)
GET /v1/dashboard/stream            Upgrade: websocket
← {"metric":"sales_per_min","window":"2026-06-17T10:05Z","value":18240,"approx":false}
← {"metric":"active_users","window":"2026-06-17T10:05Z","value":92000,"approx":true}   # HLL estimate

# Snapshot (fallback / initial load)
GET /v1/metrics/current
→ 200 { "sales_per_min":18240, "error_rate":0.012, "active_users":92000, "as_of":"2026-06-17T10:05:03Z" }
```

**Data model.** Events → **Flink** stream processor maintaining **materialized windowed aggregates** → fast store (**Redis**) → push to dashboards over WebSocket.
```
Kafka topic: events  (partitioned by event type / key)
Flink keyed state:
  windowed aggregates: sliding(size=1min, slide=5s) → count/sum per metric
  active_users:        HyperLogLog sketch per window  (~12KB, ~2% error)  [approximate by design]
Redis (read model):
  HASH dashboard:current  { sales_per_min: 18240, error_rate: 0.012, active_users: 92000 }
  pub/sub channel: dashboard.updates   → WebSocket gateway fans out to viewers
```

**Architecture.**
```
events ──► Kafka (buffer, absorbs spikes) ──► Flink (sliding 1min/slide 5s, HLL for uniques)
                                                  │ emit every 5s (coalesced latest)
                                                  ▼
                                              Redis (current aggregates) ──pub/sub──► WS gateway ──► 500 dashboards
```
Trace one event: an `order_placed` event hits Kafka, Flink folds it into the sliding **1-min window (slide 5s)** for `sales_per_min` and updates the `active_users` HyperLogLog. Every 5 s the window emits the latest value, which overwrites `dashboard:current` in Redis and publishes to the `dashboard.updates` channel; the WebSocket gateway pushes it to all 500 viewers. The push is **coalesced** — viewers get the latest aggregate every 5 s, not every one of the million increments. If ingest spikes to 3M/s, Kafka buffers the backlog and Flink emits slightly delayed / `approx:true` windows rather than collapsing.

**Deep dive — streaming aggregation + backpressure.** A dashboard is a **materialized view over a stream**: Flink incrementally maintains windowed aggregates so the dashboard reads a ready answer (no scan at query time) — the opposite of query-on-read. **Backpressure** is the central operational concern: when ingest outpaces compute, the **Kafka buffer** absorbs the spike and the system degrades gracefully — switch unique counts to HyperLogLog sketches (~2% error, fixed ~12 KB vs unbounded exact sets), widen emit interval, and mark results `approx:true` — rather than OOMing. **Update coalescing** keeps the push rate sane: only the latest value per metric per 5 s reaches viewers. On a processor restart, Flink rebuilds windows by replaying the buffer from the last checkpoint (a brief gap, acceptable here).

**Trade-offs & failure modes.**
- *Materialized vs query-on-read:* pre-aggregated views give instant reads but a fixed metric set; query-on-read is flexible but slow.
- *Fresh-approximate vs complete-stale:* dashboards favor freshness — show a recent number missing a few late events over a laggy exact one.
- *Backpressure:* buffer + coalescing + HLL approximation = graceful degradation under spikes instead of collapse.
- *Exactness:* HLL trades ~2% accuracy for bounded memory on unique counts — fine for a dashboard, not for billing (contrast 9.3, same engine tuned for latency not exactly-once).
- *Restart gap:* processor restart replays from checkpoint → brief blank/stale window.

## 9.5 Data warehouse ingestion

**Clarify.** Functional: ingest data from many sources (operational DBs via CDC, event streams, third-party files) into a warehouse/lakehouse, handle **schema evolution**, support batch and streaming, and enable **replay** + **exactly-once** so analytics aren't corrupted by duplicates or loss. Non-functional: **correctness/completeness over latency** (minutes-to-hours lag is fine), scalable to huge volume, resilient to source/schema changes. This is the ETL/ELT backbone. Throughput-heavy, latency-tolerant, correctness-critical.

**Estimate (worked).**
```
Volume:   ~5 TB/day across sources (CDC + event streams + file drops)
Latency:  batch hourly/daily, OR streaming with ~minutes of lag — both acceptable
Raw zone: immutable, append-only, retained 90d for replay   → 5 TB × 90 ≈ 450 TB (cheap object store)
Modeled:  star-schema/lakehouse tables, columnar (Parquet/Iceberg), partitioned by ingest date
Exactly-once key: dedupe on (source, primary_key, version) OR source offset → idempotent loads
Schema:   registry (Avro/Protobuf) with backward+forward compatibility checks
Compaction: small CDC files → compacted into larger Parquet (avoid small-file problem)
```
Takeaway: latency tolerance is high but correctness is paramount — land raw immutably so you can always reprocess, and key loads idempotently so retries/replays never duplicate rows.

**API.**
```http
# Source connectors (registered config, not per-row)
POST /v1/connectors  { "type":"cdc","source":"orders_db","table":"orders","format":"avro","schema_subject":"orders-value" }
→ 201 { "connector_id":"conn_orders", "status":"running", "offset":"binlog:mysql-bin.001234:5678" }

# Schema registry (compatibility-checked on register)
POST /subjects/orders-value/versions  { "schema": "{...avro...}" }
→ 200 { "id": 42 }                          # accepted: backward-compatible
→ 409 Conflict { "error":"incompatible: removed required field 'total'" }

# Analysts query the warehouse
POST /v1/sql   { "query":"SELECT campaign, SUM(spend) FROM orders WHERE dt='2026-06-17' GROUP BY 1" }
```

**Data model.** **Raw landing zone** (immutable source of truth) → **transformed/modeled** lakehouse tables, governed by a **schema registry**.
```
Kafka / CDC (Debezium) ──► raw landing zone (S3 + Iceberg, append-only)
  s3://lake/raw/source=orders_db/table=orders/dt=2026-06-17/part-*.avro
  each record: { op:"c|u|d", before, after, source_offset:"binlog:...:5678", ts }

Modeled tables (Iceberg/Delta, columnar Parquet):
  fct_orders(order_id PK, customer_id FK, campaign, total, ts, _ingest_version)
  PARTITION BY dt ;  MERGE on (order_id, _ingest_version)  → idempotent upsert

Schema registry: subject "orders-value" v1..vN, compatibility = BACKWARD (consumers survive new fields)
```

**Architecture.**
```
op DBs ──CDC(Debezium)──┐
event streams ──────────┼──► Kafka ──► raw landing zone (Iceberg, immutable, 90d)
file drops ─────────────┘                     │
                                              ▼
                                     transform jobs (Spark/dbt, schema-on-read)
                                     ├─ idempotent MERGE keyed by (pk, version)
                                     └─ compaction of small files
                                              │
                                              ▼
                                     modeled tables ──► SQL (Trino/Snowflake) for analysts
```
Trace one row: an `UPDATE orders SET total=...` fires in MySQL → **Debezium** captures the binlog change with its `source_offset`, validates it against the registry (`BACKWARD` compatible), and appends an Avro record to the immutable raw zone partition `dt=2026-06-17`. A **Spark/dbt** transform reads raw with **schema-on-read**, and applies an idempotent `MERGE INTO fct_orders ... ON (order_id, _ingest_version)` so a re-run or replay updates rather than duplicates. If a transform bug is found next week, you fix the job and **replay** from the immutable raw zone — no source re-extraction needed.

**Deep dive — batch vs stream + schema registry + replay + exactly-once.** Four intertwined concerns. **Batch vs stream**: batch (periodic bulk loads — simple, efficient, stale) for tolerant sources; streaming (CDC/event consumption — fresh, complex) for low-lag needs; commonly a **Kappa-style** hybrid where the immutable log is the single source replayed for both. **Schema evolution** is governed by a **registry** with compatibility rules (`BACKWARD` so a new optional field doesn't break consumers) plus schema-on-read — land permissively, validate on transform. **Replay** is enabled by the **immutable raw zone**: the ability to recompute from source is what makes the warehouse correctable and backfillable. **Exactly-once** comes from idempotent loads keyed by `(pk, version)` or source offset + atomic table commits (Iceberg/Delta snapshots), so replays and retries never duplicate rows.

| | Batch | Streaming (CDC) |
|---|---|---|
| Latency | hours | minutes |
| Complexity | low | high |
| Exactly-once | easy (rerun + MERGE) | needs offset tracking |
| Best for | large periodic loads | fresh operational data |

ELT (load raw, transform in-warehouse — flexible, replayable) is favored by modern lakehouses over ETL (transform-then-load — leaner storage, less replayable).

**Trade-offs & failure modes.**
- *Batch vs streaming:* hybrid/Kappa captures both — fresh path + replayable log.
- *ELT vs ETL:* ELT keeps raw for replay at a storage cost; ETL is leaner but harder to backfill.
- *Schema breakage:* the classic failure — registry + compatibility checks (`409` on incompatible) prevent a producer from breaking downstream jobs.
- *Exactly-once:* on failure, replay from the last committed offset; idempotent `(pk, version)` MERGE makes retries safe.
- *Small-file problem:* high-frequency CDC creates many tiny files → run compaction to keep queries fast.
- *Immutable raw cost:* 90d of raw is storage spend, bought for correctability and backfill.

## 9.6 Web crawler

**Clarify.** Functional: discover and download web pages from seeds, follow links, avoid recrawling dupes, respect site rules (`robots.txt`), feed an indexing pipeline. Non-functional: massive scale (billions of pages), **politeness** (per-host rate limits — don't hammer or get banned), dedup (URL-level and near-duplicate content), freshness (recrawl changing pages). Distributed, bounded by **politeness and dedup more than raw throughput** — concurrency comes from breadth across many hosts.

**Estimate (worked).**
```
Target:   1,000,000,000 pages/month
          1e9 / (30 × 86,400 s)                     ≈ 386 pages/s sustained
Page:     avg ~100 KB HTML → download ≈ 38 MB/s ; storage 1e9 × 100KB ≈ 100 TB/month (compressed ~25 TB)
Politeness: ~1 req/host every 2s → to hit 386 pages/s you need ≈ 800+ hosts in flight concurrently
Frontier: billions of URLs → can't fit in RAM → disk-backed priority queue, sharded by host
Seen-set: 1e9+ URLs → Bloom filter (~1.2 GB at 1% FP for 1e9) front of an exact RocksDB store
Content dedup: 64-bit SimHash per page; near-dup if Hamming distance ≤ 3
```
Takeaway: per-host politeness caps single-site speed, so throughput is *breadth* — thousands of hosts crawled in parallel, frontier organized by host.

**API.**
```http
# Internal control plane
POST /v1/seeds        { "urls":["https://example.com/"], "priority":8 }      → 202 Accepted
GET  /v1/frontier/stats   → 200 { "queued": 4.2e9, "hosts_active": 820, "pages_per_s": 384 }

# Output to indexing pipeline (per fetched page)
PUT  /v1/pages        { "url":"https://example.com/a","fetched_at":"...","status":200,
                        "content_hash":"simhash:9f...","body_ref":"s3://crawl/...","links":[...] }
```

**Data model.** A **URL frontier** (host-partitioned priority queue), a **seen-URL set** (dedup), a content store, and a **content-hash set** for near-dup detection.
```
Frontier (sharded by host, e.g. Kafka topic 'frontier' keyed by host, or RocksDB priority queue):
  entry: { url, host, priority, scheduled_at, depth }
  one logical FIFO per host → enforces single in-flight + crawl delay per host

Seen-URL set:   Bloom filter (1.2 GB, 1% FP) → on possible-hit, confirm in RocksDB(url → last_crawled)
  URL normalized first: lowercase host, strip fragments, sort query params, resolve relative

robots cache:   host → parsed robots.txt + crawl-delay (TTL 24h)
Content store:  S3  body_ref ; metadata in a KV store
Near-dup index: SimHash(64-bit) → page ids ; near-dup if Hamming ≤ 3
Partition by HOST/DOMAIN — the politeness unit.
```

**Architecture.**
```
seeds ──► Frontier (host-sharded priority queue) ◄──── new URLs (normalized+deduped)
              │  scheduler: pick host whose crawl-delay has elapsed                    ▲
              ▼                                                                        │
          fetcher workers ──robots.txt check──► download (1/host/2s) ──► parse links ──┘
              │                                                              │
              ▼                                                              ▼
      content store (S3) + SimHash near-dup check ──────────► indexing pipeline
```
Trace one URL: `https://example.com/a` is dequeued from `example.com`'s frontier shard only after the host's 2 s crawl-delay has elapsed and `robots.txt` (cached) allows it. A fetcher downloads the 100 KB page, stores the body in S3, computes a **64-bit SimHash**; if its Hamming distance to an existing page is ≤ 3 it's a near-dup (mirror/boilerplate) and skipped for indexing. Otherwise it's passed to indexing. Extracted links are **normalized** (lowercase host, strip `#fragment`, sort query params), checked against the **Bloom filter** seen-set (confirmed in RocksDB on a possible-hit), and new URLs are enqueued into their host's frontier shard with a priority. The page is scheduled for recrawl weighted by its observed change frequency.

**Deep dive — frontier + politeness + dedup.** The **frontier** is the brain: a disk-backed, host-sharded priority queue (billions of URLs can't fit in RAM) balancing breadth (coverage) against importance (PageRank-ish priority) and freshness. **Politeness** is the binding constraint and shapes everything: you may hit a host only ~once every 2 s and must honor `robots.txt` + `Crawl-delay`, so throughput comes from running ~800+ hosts concurrently, each as an independent FIFO with one in-flight request — ignoring this gets you banned and is abusive. **Dedup** operates at two levels: URL-level (normalize + a **Bloom filter** front of an exact RocksDB seen-set — Bloom gives O(1) memory-cheap "definitely-new" answers, RocksDB confirms possible-hits) and content-level (**SimHash** shingling, near-dup if Hamming ≤ 3, so mirrored/boilerplate pages don't waste crawl + index budget).

**Trade-offs & failure modes.**
- *Breadth vs priority:* breadth-first coverage vs importance-driven crawling — spend the budget on valuable/fresh pages.
- *Politeness vs throughput:* per-host limits cap single-site speed but are non-negotiable; parallelize across hosts.
- *URL vs content dedup:* Bloom seen-set (cheap, exact-confirmed) for URLs; SimHash (more compute) for near-dupes.
- *Crawler traps:* infinite URL spaces (calendars, faceted search) → depth limits + URL-pattern detection + per-host page caps.
- *Frontier durability:* a crash must not lose crawl state → persist the frontier (Kafka/RocksDB) and shard it to scale; Bloom false-positives (~1%) drop a few new URLs — acceptable, confirmed against RocksDB to bound it.
- *Freshness:* best-effort, eventual — recrawl cadence weighted by change rate.

# 10. Platform and scheduling systems

> These systems **run other people's work reliably**. The recurring tools: leases for exclusive execution, at-least-once delivery + idempotency, visibility timeouts, retries with backoff, DLQs, leader election, and workflow DAGs.

## 10.1 Job scheduler

**Clarify.** Functional: accept a job with a payload, priority, and optional `run_at`; run it now or later; retry transient failures; let owners query status. Non-functional: each job runs **at-least-once** (never lost), **exactly-one-running** at any instant (no two workers on the same job concurrently), priorities respected, worker fleet scales horizontally. Reliability semantics: at-least-once delivery + lease-based mutual exclusion means a job may *execute* more than once (crash after side effect, before marking done) → **jobs must be idempotent** (keyed by `job_id`). The core mechanism: an atomic lease for exclusivity + retries with backoff.

**Estimate (worked).**
```
Throughput:  50M jobs/day enqueued
             50,000,000 / 86,400 s        ≈ 580 jobs/s avg
             peak ×4                       ≈ 2,300 jobs/s
Job runtime: p50 2 s, p99 60 s            → mostly short
Workers:     580 jobs/s × 2 s avg          ≈ 1,160 concurrent jobs in flight (avg)
             peak 2,300 × 2 s              ≈ 4,600 concurrent → ~5,000 worker slots
Queue depth: a 5-min downstream stall at 2,300/s → 690k jobs backlog → store must hold millions
Lease load:  5,000 workers renewing every 10 s → 500 lease-renew writes/s (cheap)
Storage:     row ≈ job_id(16)+payload(~1KB)+status+attempts+2×ts ≈ 1.1 KB
             50M/day × 7-day retention × 1.1 KB ≈ 385 GB working set
```
The numbers say: correctness under crashes (exactly-one-running, eventually-completed) dominates; raw throughput is modest enough for a PostgreSQL-backed queue with `SELECT ... FOR UPDATE SKIP LOCKED`.

**API.**
```http
POST /api/v1/jobs
{ "type":"send_email", "payload":{"to":"a@b.com"}, "priority":5, "run_at":null, "max_attempts":5 }
→ 201 Created
{ "job_id":"job_8f3a", "status":"pending", "priority":5 }

GET /api/v1/jobs/job_8f3a
→ 200 { "job_id":"job_8f3a", "status":"running", "attempts":2, "lease_expires_at":"2026-06-17T10:00:30Z" }

# worker pull (long-poll), returns a leased job
POST /api/v1/jobs/lease   { "worker_id":"w_17", "lease_ttl_s":30, "max":1 }
→ 200 { "job_id":"job_8f3a", "payload":{...}, "attempts":2, "lease_expires_at":"...:00:30Z" }
→ 204 No Content            # nothing eligible

POST /api/v1/jobs/job_8f3a/heartbeat  { "worker_id":"w_17", "lease_ttl_s":30 }  → 200
POST /api/v1/jobs/job_8f3a/complete   { "worker_id":"w_17" }                     → 200
POST /api/v1/jobs/job_8f3a/fail       { "worker_id":"w_17", "retryable":true }   → 202 (re-enqueued)
```

**Data model.** A durable, transactional store — **PostgreSQL** (`SKIP LOCKED` for contention-free pull) for ≤ low-thousands/s, or **Redis sorted sets** / SQS for higher fan-out. Partition by `queue_name` (jobs of one tenant/priority class stay together so a priority index is local); within a partition the eligible-job index is `(priority DESC, run_at ASC)`.
```
Table: jobs
  job_id           UUID       (partition: hash(queue_name))   -- "job_8f3a"
  queue_name       STRING                                     -- "emails"
  type             STRING                                     -- "send_email"
  payload          JSONB
  priority         INT                                        -- higher = sooner
  status           ENUM(pending,running,done,failed,dead)
  attempts         INT                                        -- 0,1,2...
  max_attempts     INT                                        -- 5
  run_at           TIMESTAMP                                  -- earliest eligible time
  lease_owner      STRING NULL                                -- "w_17"
  lease_expires_at TIMESTAMP NULL                             -- now+30s while running
  created_at       TIMESTAMP
Example row: {"job_id":"job_8f3a","queue_name":"emails","status":"running","priority":5,
              "attempts":2,"max_attempts":5,"lease_owner":"w_17","lease_expires_at":"...:00:30Z"}
Index: (status, priority DESC, run_at ASC) WHERE status='pending'  -- the dispatch index
```

**Architecture.**
```
ENQUEUE: client → POST /jobs → INSERT (status=pending, run_at) → 201

DISPATCH (worker pull):
  worker w_17 ──lease──► UPDATE jobs SET status='running', lease_owner='w_17',
                          lease_expires_at = now()+30s, attempts=attempts+1
                          WHERE job_id = (SELECT job_id FROM jobs
                                          WHERE status='pending' AND run_at<=now()
                                          ORDER BY priority DESC, run_at ASC
                                          FOR UPDATE SKIP LOCKED LIMIT 1)
                          RETURNING *            ← atomic claim, only one worker wins

EXECUTE:  run payload; every 10s → heartbeat (extend lease_expires_at = now()+30s)
          success → UPDATE status='done'
          failure → if attempts<max: status='pending', run_at=now()+backoff(attempts)
                    else            : status='dead'  (DLQ)

REAPER (every 5s): UPDATE status='pending' WHERE status='running'
                   AND lease_expires_at < now()    ← crashed worker's job reclaimed
```
Concrete trace: `job_8f3a` (priority 5) is claimed by `w_17` with a **30 s lease TTL**, `attempts` bumped to 2. `w_17` heartbeats every **10 s** (renewing the lease to `now()+30s`) so a 60 s job survives. If `w_17` segfaults at t=20 s, no more heartbeats arrive; at t=30 s the lease lapses; the reaper (running every **5 s**) flips it back to `pending`; `w_42` re-leases it as `attempts=3`. On a transient failure the job is re-enqueued with **exponential backoff + full jitter**: `run_at = now() + random(0, min(base·2^attempts, cap))` with `base=2s, cap=300s`. After **max_attempts=5** it lands in `status='dead'` for inspection.

**Deep dive — leases + retries + idempotent jobs.** The lease is a row-level mutual-exclusion token with a TTL: the atomic `UPDATE ... SKIP LOCKED` guarantees exactly one worker transitions a job to `running`, and the TTL means a crashed worker needs *no explicit failure detection* — the lease simply expires and the reaper reclaims it (delay ≤ TTL + reaper interval ≈ 35 s here). This is precisely why semantics are **at-least-once**: a worker can finish the side effect (charge a card) then die before `complete`, so on reclaim the job re-runs. Idempotency closes the gap — derive an idempotency key from `job_id` (e.g. the downstream payment API dedupes on `Idempotency-Key: job_8f3a`), so re-execution is a no-op.

| Approach | Exclusivity | Crash handling | Cost of "more than once" |
|---|---|---|---|
| Lease + TTL (this) | atomic claim | auto-reclaim on expiry, no detector | re-run → needs idempotency |
| Explicit heartbeat + crash detector | claim + liveness ping | faster reclaim, must detect death | re-run → needs idempotency |
| Distributed lock per job (etcd) | strong, fenced | lock TTL expiry | re-run → needs idempotency |
| "Exactly-once" (txn outbox + dedupe table) | claim + dedupe row in same txn | reclaim + skip-if-seen | approximated, brittle across systems |

**Trade-offs & failure modes.**
- *At-least-once + idempotency* (simple to reason about, requires idempotent jobs) vs *exactly-once* (only achievable within a single transactional boundary; across external side effects it's an illusion).
- *Worker crash → lease expiry → redelivery:* reclaim latency = lease TTL (30 s) + reaper interval (5 s); shrink TTL for faster reclaim but raise the false-reclaim risk for slow-but-alive workers (a 40 s job under a 30 s lease that forgot to heartbeat gets **double-run**).
- *Long jobs* must heartbeat or the lease lapses mid-execution and a second worker starts in parallel — pick lease TTL ≥ 3× heartbeat interval.
- *Backoff without jitter* → thundering herd: 10k jobs failing at once re-fire simultaneously; full jitter spreads them.
- *DLQ (`status='dead'`)* captures poison jobs so they stop consuming worker slots; alarm on DLQ depth.

## 10.2 Cron service (distributed scheduler)

**Clarify.** Functional: register schedules as cron expressions; fire each scheduled occurrence across a cluster **exactly once** (not N times for N nodes); handle missed runs after downtime per a configurable policy. Non-functional: HA (no scheduler SPOF), no duplicate or skipped firings, correct under clock skew and leader handover. Reliability semantics: firing is **at-most-once-intended** (a single firing per occurrence) but, because the only safe failover guard is an atomic claim with idempotent downstream jobs, a rare **duplicate firing during handover** is tolerated and absorbed by the at-least-once job scheduler (10.1). The core: leader election + atomic next-fire claim + missed-run policy.

**Estimate (worked).**
```
Schedules:   200k registered cron schedules
Fire rate:   if avg period = 1 hour → 200,000 / 3,600 s ≈ 56 firings/s avg
             bursty: many "0 * * * *" (top of hour) → 200k×(fraction on the hour)
             say 30k fire at :00 → 30,000 firings in ~1 s spike
Scheduler:   3–5 nodes, leader (or sharded) ownership via etcd
Scan cost:   index on next_fire_at; tick every 1 s → scan WHERE next_fire_at<=now()
             due-set per tick usually <100 rows; the :00 spike = 30k → batch-claim
etcd:        1 leader lease per shard, renewed every 5 s → trivial load
```
The numbers say: throughput is tiny; the entire difficulty is *coordination* — ensuring one and only one node owns each schedule, surviving node failures without double- or missed-fires.

**API.**
```http
POST /api/v1/schedules
{ "cron_expr":"0 3 * * *", "tz":"UTC", "job":{"type":"nightly_report"},
  "missed_policy":"fire_once" }
→ 201 Created
{ "schedule_id":"sch_42", "next_fire_at":"2026-06-18T03:00:00Z" }

GET  /api/v1/schedules/sch_42
→ 200 { "schedule_id":"sch_42","cron_expr":"0 3 * * *","last_fired_at":"2026-06-17T03:00:00Z",
        "next_fire_at":"2026-06-18T03:00:00Z","missed_policy":"fire_once" }

DELETE /api/v1/schedules/sch_42 → 204
# on firing the service calls the job scheduler (10.1):
#   POST /api/v1/jobs { "type":"nightly_report", "idempotency_key":"sch_42@2026-06-18T03:00Z" }
```

**Data model.** Schedule rows in a consistent store (**PostgreSQL**); leadership/ownership in a **consensus store** (**etcd** or **ZooKeeper**) via a leader lease. Partition schedules across shards (hash of `schedule_id`); each shard has one elected owner so scan/fire load spreads.
```
Table: schedules
  schedule_id    UUID      (partition: hash(schedule_id) → shard)   -- "sch_42"
  cron_expr      STRING                                            -- "0 3 * * *"
  tz             STRING                                            -- "UTC"
  job            JSONB                                             -- payload handed to 10.1
  last_fired_at  TIMESTAMP NULL                                    -- "2026-06-17T03:00:00Z"
  next_fire_at   TIMESTAMP                                         -- "2026-06-18T03:00:00Z"
  missed_policy  ENUM(skip, fire_once, fire_all)
Index: (next_fire_at ASC)   -- the due-scan index
Example row: {"schedule_id":"sch_42","cron_expr":"0 3 * * *","last_fired_at":"...T03:00:00Z",
              "next_fire_at":"2026-06-18T03:00:00Z","missed_policy":"fire_once"}

etcd:  /cron/shard/{0..15}/leader  → {node_id, lease_ttl=10s}   (leader election per shard)
```

**Architecture.**
```
LEADER ELECTION (per shard, etcd):
  node A,B,C race to PUT /cron/shard/3/leader with a 10s lease → A wins, renews every 4s
  A loses network → lease expires at 10s → B acquires → B now owns shard 3

FIRING LOOP (owner of shard 3, tick every 1s):
  due = SELECT * FROM schedules WHERE next_fire_at <= now() AND shard=3
  for each sch:
    UPDATE schedules SET last_fired_at = next_fire_at,
                         next_fire_at  = cron_next(cron_expr, next_fire_at)
      WHERE schedule_id=sch.id AND next_fire_at = sch.next_fire_at   ← atomic CAS claim
    if rows_affected == 1:                                            (only the winner fires)
       POST /jobs { ..., idempotency_key: "sch_42@" + sch.next_fire_at }  → job scheduler 10.1
```
Concrete trace: `sch_42` (`0 3 * * *`) has `next_fire_at=2026-06-18T03:00:00Z`. Node A owns shard 3 (etcd leader lease, **10 s TTL**, renewed every **4 s**). At 03:00:00 A's 1-second tick sees it due and issues the CAS `UPDATE ... WHERE next_fire_at = '...T03:00:00Z'`; the row matches → A advances `next_fire_at` to the next day and enqueues a job with **idempotency key `sch_42@2026-06-18T03:00Z`**. If A crashes at 03:00:00.2 *after* the CAS but *before* the enqueue, its lease expires by 03:00:10, B takes over, re-scans, but `next_fire_at` is already 06-19 so it does **not** re-fire — the CAS already advanced it (no duplicate). If A crashed *before* the CAS, B fires it; the idempotency key dedupes if A had partially fired. **Missed runs:** after a 6 h outage spanning three `0 * * * *` firings, `missed_policy` decides — `skip` jumps `next_fire_at` to the next future slot (stale dashboards), `fire_once` enqueues a single catch-up, `fire_all` enqueues all three (used for billing).

**Deep dive — leader election + missed-run policy.** Leader election via **etcd** (a lease key per shard) solves "N nodes, fire once": only the shard owner runs the firing loop, and etcd's Raft quorum guarantees a single owner even under partition — a minority side cannot renew or acquire the lease, so it stops firing (CP: it sacrifices availability of *that shard* during the ≤10 s election rather than risk two leaders). The atomic CAS on `next_fire_at` is the second guard: it makes firing idempotent *at the schedule level* across the brief handover window, so even if the old and new leader both scan the same due row, only one CAS succeeds. The downstream idempotency key (`schedule_id@fire_time`) is the third guard, absorbing the residual "fired but crashed before advancing" case.

| Coordination model | Correctness | Availability | Complexity |
|---|---|---|---|
| etcd leader-per-shard + CAS (this) | exactly-once intended firing, CP | shard pauses ≤10s on failover | medium (consensus dep) |
| Every node scans + CAS, no leader | dedup via CAS, occasional dup work | always available | low, but N× scan load |
| Single static scheduler | simple | SPOF — outage = all crons stop | low |
| DB advisory lock per schedule | serialized firing | lock holder death = TTL wait | medium |

**Trade-offs & failure modes.**
- *Leader-election (CP, correct exactly-once-intended firing)* vs *every-node-fires-with-CAS-dedup* (AP-ish, simpler, relies on idempotency to swallow duplicates).
- *Duplicate firing on handover:* the window between old-leader CAS and crash is covered by the idempotency key; without it you'd double-run the downstream job.
- *Missed runs:* `skip` (clean, may drop important runs) vs `fire_once` (one catch-up) vs `fire_all` (complete, can stampede — 6 h down × 1-min cron = 360 firings at once → throttle the catch-up enqueue).
- *Clock skew across nodes:* fire decisions use `now()` on the owner; keep nodes NTP-synced — a fast clock fires a cron slightly early. Never use wall-clock for the CAS; use the stored `next_fire_at`.
- *Decoupling:* scheduling (this service) only *enqueues*; execution + retries live in 10.1, so a slow job never blocks the firing loop.

## 10.3 Task queue

**Clarify.** Functional: producers `send` tasks, consumers `receive`/`ack`/`nack`, with reliable delivery, retries, dead-lettering, and optional per-key ordering. Non-functional: **at-least-once** delivery, redeliver in-flight work when a consumer crashes, scale consumers horizontally, never retry a poison message forever. Reliability semantics: at-least-once + visibility-timeout redelivery → consumers must be **idempotent**; ordering is guaranteed only *within a partition*, not globally. This is the building block beneath 10.1 — SQS / Kafka / RabbitMQ semantics.

**Estimate (worked).**
```
Throughput:  1B messages/day
             1,000,000,000 / 86,400 s     ≈ 11,600 msg/s avg
             peak ×5                        ≈ 58,000 msg/s
Consumers:   process p50 50 ms → one consumer ≈ 20 msg/s
             58,000 / 20                     ≈ 2,900 consumer threads at peak
Partitions:  target ≤ 10k msg/s/partition → 58,000 / 10,000 ≈ 6 partitions min,
             round up to 16 for headroom + key spread
In-flight:   visibility timeout 30s × 58,000 msg/s ≈ 1.74M messages invisible at once
Backlog:     consumers down 10 min at 11,600/s → 7M message backlog → log must be durable
Storage:     msg ≈ 2 KB; 7-day retention × 1B/day × 2 KB ≈ 14 TB (Kafka) or delete-on-ack (SQS)
```
The numbers say: throughput is real (tens of k/s) → a partitioned log/queue (Kafka/SQS); the hard parts are crash-safe redelivery (visibility timeout), poison handling (DLQ), and the ordering-vs-parallelism trade.

**API.**
```http
POST /queues/orders/messages          # send
{ "body":{"order_id":777}, "ordering_key":"cust_5", "dedup_id":"ord_777_v1" }
→ 200 { "message_id":"m_91" }

POST /queues/orders/receive           # receive (long-poll), leases with visibility timeout
{ "max":10, "visibility_timeout_s":30, "wait_s":20 }
→ 200 { "messages":[ { "message_id":"m_91","receipt":"rcpt_ab","body":{...},
                        "receive_count":1 } ] }

POST /queues/orders/ack    { "receipt":"rcpt_ab" }                     → 200  (delete)
POST /queues/orders/nack   { "receipt":"rcpt_ab", "delay_s":10 }       → 200  (requeue early)
# after receive_count > maxReceiveCount the broker routes the message to orders-dlq automatically
```

**Data model.** A durable partitioned log/queue — **SQS** (managed visibility-timeout queue + redrive DLQ), **Kafka** (partitioned log, offset-based), or **RabbitMQ** (broker + per-message ack). Partition by `ordering_key` (e.g. `cust_5`) so all of one customer's messages land on one partition → per-customer FIFO with cross-customer parallelism.
```
Message (logical):
  message_id        STRING    -- "m_91"
  queue             STRING    -- "orders"
  partition         INT       -- hash(ordering_key) % 16  → 7
  ordering_key      STRING    -- "cust_5"
  body              JSON
  dedup_id          STRING    -- "ord_777_v1"  (producer-side dedup window)
  receive_count     INT       -- 1,2,...  → DLQ when > maxReceiveCount
  visible_after     TIMESTAMP -- now()+30s while leased; <=now() means available
  receipt_handle    STRING    -- "rcpt_ab"  (ties ack to this specific lease)
Example: {"message_id":"m_91","queue":"orders","partition":7,"ordering_key":"cust_5",
          "receive_count":1,"visible_after":"2026-06-17T10:00:30Z","receipt_handle":"rcpt_ab"}

DLQ: orders-dlq  ← messages with receive_count > maxReceiveCount (e.g. 5)
```

**Architecture.**
```
SEND:    producer → broker appends to partition hash("cust_5")%16 = 7 (dedup_id drops dupes in window)

RECEIVE (visibility timeout):
  consumer C1 ──receive──► broker marks m_91 visible_after = now()+30s, receive_count++,
                            returns receipt "rcpt_ab"      ← hidden from other consumers
  C1 processes (idempotent on dedup_id) → ack(rcpt_ab) → broker DELETES m_91
  C1 crashes / slow:  at now()+30s, m_91.visible_after <= now() → REAPPEARS → redelivered to C2

POISON HANDLING:
  m_91 fails 5×: receive_count=6 > maxReceiveCount=5 → broker moves m_91 → orders-dlq
                 (no longer blocks the partition; on-call inspects DLQ)

ORDERING: within partition 7, offsets processed in order; partition 7 has at most one
          active consumer in the group → per-key (cust_5) FIFO; 16 partitions → 16-way parallel
```
Concrete trace: `m_91` (key `cust_5`) lands on partition 7. C1 receives it with a **30 s visibility timeout**, `receive_count=1`, receipt `rcpt_ab`. If C1 finishes in 50 ms it `ack`s and the message is deleted. If C1 hangs, at t=30 s `m_91` becomes visible again and C2 receives it (`receive_count=2`) — at-least-once, hence the consumer dedupes on `dedup_id=ord_777_v1`. After **maxReceiveCount=5** failed receives the broker auto-redrives `m_91` to `orders-dlq`. For ordering, the consumer group assigns partition 7 to exactly one member, so `cust_5`'s messages are processed in append order; other customers on partitions 0–15 run concurrently.

**Deep dive — visibility timeout + DLQ + ordering.** The visibility timeout is crash handling without a failure detector: a received message is merely *hidden* for N seconds; if no `ack` arrives (consumer dead or slow) it automatically reappears — so the broker never has to know whether a consumer is alive. This *is* what makes delivery at-least-once. The receipt handle binds an `ack` to one specific lease, so a stale `ack` from a timed-out consumer (whose message was already redelivered and processed by another) is rejected rather than deleting the wrong message. The DLQ breaks the poison loop: a message that always throws would otherwise redeliver forever and head-of-line-block its partition; after `maxReceiveCount` it's parked. Ordering vs throughput is the irreducible tension below.

| Guarantee | How | Parallelism | Use when |
|---|---|---|---|
| Total global order | single partition | none (1 consumer) | rarely — a strict ledger replay |
| Per-key order (this) | partition by ordering_key, 16 partitions | 16-way | per-customer/per-entity sequencing |
| No ordering | round-robin, any consumer | unbounded | independent tasks (emails, thumbnails) |
| At-least-once | visibility timeout + redelivery | — | default; pair with idempotency |
| At-most-once | ack-on-receive, no redelivery | — | drop-OK telemetry |

**Trade-offs & failure modes.**
- *At-least-once + visibility timeout* (reliable, redelivers on crash, needs idempotent consumers) vs *at-most-once* (no redelivery, may lose work).
- *Visibility timeout tuning:* too short (e.g. 30 s for a 45 s task) → premature redelivery of a *live* consumer → **duplicate work**; too long → slow recovery from a real crash (message stuck invisible for the full timeout). Set it to ~2× p99 processing time and extend via heartbeat for outliers.
- *Worker crash → message reappears → redelivery:* exactly the lease pattern from 10.1, applied at message granularity.
- *Per-partition ordering + parallelism* vs *global ordering + serial processing* — picking 16 partitions caps customer-level concurrency at 16 active consumers.
- *DLQ* prevents poison messages from starving a partition; alarm on DLQ depth and replay after a fix.

## 10.4 CI/CD pipeline

**Clarify.** Functional: on a code change, run a **DAG** of steps (build → test → deploy) on isolated workers, capturing artifacts and logs, with correct dependency ordering and retries. Non-functional: correct topological execution, strong **worker isolation** (one build cannot affect another or steal secrets), artifact + streamed-log management, resumable on orchestrator restart, reasonable latency. Reliability semantics: steps are **at-least-once** (a crashed step re-runs) → steps run in fresh ephemeral environments and should be re-runnable; untrusted code (fork PRs) must be **sandboxed** so it cannot escape or read secrets. The core: DAG orchestration + ephemeral isolation + artifact passing.

**Estimate (worked).**
```
Pipelines:   50k pipeline runs/day
             50,000 / 86,400 s            ≈ 0.58 runs/s avg, peak ×10 (9am push) ≈ 6 runs/s
Steps:       avg 12 steps/run → 6 runs/s × 12 ≈ 70 step-starts/s at peak
Workers:     avg step 3 min; 70 starts/s × 180 s ≈ 12,600 concurrent step-containers (peak)
             → autoscale a container pool (k8s) to ~13k vCPU-slots at peak, ~1.3k steady
Cold start:  fresh container/VM ≈ 2–10 s → dominates short steps → warm pool + image cache
Artifacts:   avg run produces 200 MB → 50k/day × 200 MB ≈ 10 TB/day → object store + TTL
Logs:        50k runs × 12 steps × ~1 MB ≈ 600 GB/day streamed + stored (compressed)
```
The numbers say: it's a workflow-orchestration problem where **cold-start and isolation** dominate per-step cost; aggressive image/dependency caching and a warm ephemeral pool are the levers.

**API.**
```http
POST /api/v1/pipelines/trigger
{ "repo":"acme/web", "commit":"a1b2c3d", "ref":"refs/pull/42/head", "config":".ci.yaml" }
→ 202 Accepted
{ "run_id":"run_5521", "status":"queued" }

GET /api/v1/pipelines/run_5521
→ 200 { "run_id":"run_5521","status":"running",
        "steps":[ {"name":"build","status":"success"},
                  {"name":"test","status":"running","needs":["build"]},
                  {"name":"deploy","status":"pending","needs":["test"]} ] }

GET /api/v1/pipelines/run_5521/steps/test/logs?follow=true   → 200 text/event-stream (live)
GET /api/v1/pipelines/run_5521/artifacts/build-output.tar    → 302 → object-store presigned URL
POST /api/v1/pipelines/run_5521/steps/deploy/retry           → 202
```

**Data model.** Run + step state in **PostgreSQL** (durable, resumable); the DAG from the repo's `.ci.yaml`; artifacts in an **object store** (S3); logs streamed to clients and persisted (S3 + a search index). Worker pool of **ephemeral containers/microVMs** (k8s pods / Firecracker). Partition by `run_id` (all of a run's steps + state colocated).
```
Table: pipeline_runs
  run_id     UUID      (partition: hash(run_id))  -- "run_5521"
  repo       STRING                               -- "acme/web"
  commit     STRING                               -- "a1b2c3d"
  status     ENUM(queued,running,success,failed,canceled)
  dag        JSONB                                -- nodes + edges (needs)
Table: pipeline_steps
  run_id     UUID  (FK, partition key)
  name       STRING                               -- "test"
  needs      STRING[]                             -- ["build"]   (DAG edges)
  status     ENUM(pending,running,success,failed,skipped)
  attempts   INT
  worker_id  STRING NULL                          -- "pod_77"
  artifacts  STRING[]                             -- ["s3://ci/run_5521/build-output.tar"]
Example step: {"run_id":"run_5521","name":"test","needs":["build"],"status":"running",
               "attempts":1,"worker_id":"pod_77","artifacts":[]}
```

**Architecture.**
```
TRIGGER: webhook/push → parse .ci.yaml → INSERT run + steps (DAG) → status=queued

ORCHESTRATOR (event loop, durable state in Postgres):
  ready = steps where status=pending AND all(needs are 'success')
  for each ready step → schedule onto a FRESH ephemeral worker (k8s pod / Firecracker microVM)
     [build] ──artifact──► s3://ci/run_5521/build-output.tar
                                   │ (passed by reference)
                                   ▼
     [test]  pulls artifact, runs in clean container ──► success
                                   │
                                   ▼
     [deploy] runs after test success
  step done → UPDATE status; re-evaluate ready set (topological, max parallelism)
  orchestrator restart → reload run state from Postgres → resume from ready set (idempotent)

ISOLATION: each step = fresh container/microVM, no shared FS, secrets injected per-step
           (scoped, short-lived tokens), torn down after → no contamination, no secret leak
```
Concrete trace: a push to `acme/web@a1b2c3d` creates `run_5521` with DAG `build → test → deploy`. The orchestrator sees `build` is ready (no `needs`), schedules it on a **fresh Firecracker microVM** (cold start ~3 s, mitigated by a warm pool + cached base image). `build` writes `build-output.tar` to `s3://ci/run_5521/` and marks itself `success`. Now `test` is ready; it runs in a **new** clean container, pulls the artifact by reference, runs the suite, streams logs as SSE to the UI while persisting to S3. If `pod_77` (running `test`) is OOM-killed, the step is at-least-once: the orchestrator detects the pod exit, re-runs `test` (`attempts=2`) on a fresh worker — safe because the environment is clean and inputs come from immutable artifacts. After `test` succeeds, `deploy` runs. Orchestrator crash mid-run is harmless: state is in Postgres, so on restart it recomputes the ready set and resumes rather than restarting the whole pipeline. Step retries use a small max (e.g. **2**) since most failures are real, not transient.

**Deep dive — workflow DAG + isolation + artifacts.** The DAG is the execution model: a step becomes runnable only when every `needs` predecessor is `success`, and independent branches (e.g. `lint` and `unit-test`) run concurrently for maximal parallelism. Isolation is non-negotiable: a fork PR runs *untrusted* code, so each step gets a fresh microVM/container with no shared filesystem, secrets injected as short-lived per-step tokens (not ambient env), and the sandbox destroyed afterward — so one build can't read another's source or leak credentials, and re-runs are deterministic. Artifacts flow along DAG edges by reference through the object store (not inline), which also enables caching: a content-hashed dependency layer or build cache skips redundant work on the next run. Durable run/step state in Postgres makes the orchestrator a restartable controller rather than a stateful SPOF.

| Worker model | Cold start | Isolation/security | Contamination risk |
|---|---|---|---|
| Ephemeral microVM (this) | ~2–10 s | strongest (hardware-virt) | none (destroyed after) |
| Ephemeral container | ~1–3 s | namespace/cgroup | low (escape possible) |
| Reused warm worker | ~0 s | weak | high (leaked state/secrets) |
| Warm pool of microVMs | ~0 s + recycle | strong | none (recycled per job) |

**Trade-offs & failure modes.**
- *Ephemeral isolated workers* (clean, secure, reproducible, slow cold-start) vs *reused workers* (fast, risk of contamination and leaked state/secrets) — for untrusted/fork builds isolation wins; warm pools recover the latency.
- *DAG parallelism* (fast, complex scheduling) vs *sequential* (simple, slow).
- *Aggressive caching* (fast builds, cache-invalidation bugs — a stale cached layer ships a wrong build) vs *clean builds* (correct, slow).
- *Worker crash mid-step → step re-runs* (idempotent because the env is fresh and inputs are immutable artifacts); the durable DAG lets the orchestrator resume, not restart.
- *Resource isolation* (CPU/mem cgroup limits per step) prevents one runaway build from starving the 13k-slot pool.

## 10.5 Code hosting service

**Clarify.** Functional: host Git repositories, manage permissions, serve push/pull, pull requests, and code search. Non-functional: **strong consistency on refs** (two pushes to the same branch must serialize — no lost commits), durable repo storage, fast clones/fetches, scalable. Reliability semantics: ref updates are linearizable per ref (CAS), object reads are eventually consistent across replicas (objects are immutable so this is safe), permission checks are strongly consistent (a revoked collaborator loses push access immediately). The distinctive parts: Git content-addressed object store + ref compare-and-swap + permission enforcement. Think GitHub/GitLab.

**Estimate (worked).**
```
Repos:       50M repos; sizes p50 20 MB, p99 2 GB, a few 50 GB+ monorepos
Traffic:     read-heavy — 200M clones+fetches/day, 20M pushes/day
             fetches: 200M / 86,400 ≈ 2,300/s avg, peak ×4 ≈ 9,200/s
             pushes:  20M / 86,400  ≈ 230/s avg, peak ×4 ≈ 920/s
Ref CAS:     per-ref serialization; hot branch (busy monorepo main) maybe 5 pushes/s
             → CAS retries; cold branches never contend
Storage:     50M × 20 MB median ≈ 1 PB raw → dedup via content-addressing + packfiles + 3× repl
Search:      billions of lines → separate inverted index (~10s of TB), eventually consistent
```
The numbers say: the bulk (immutable objects, clones) scales easily on replicas; the entire correctness budget goes to the tiny mutable surface — **refs** — where concurrent pushes must not lose commits.

**API.**
```http
# Git smart-HTTP / SSH (porcelain over the wire)
POST /acme/web.git/git-receive-pack          # git push
  → ref update: refs/heads/main  old=a1b2c3d  new=e4f5g6h
  → 200 OK                                    (CAS old→new succeeded)
  → 409 / "! [rejected] (fetch first)"        (old no longer matches → stale push)

POST /acme/web.git/git-upload-pack           # git fetch/clone → packfile stream → 200

# REST/GraphQL control plane
POST /api/v1/repos/acme/web/pulls  { "head":"feature","base":"main" } → 201 { "pr":42 }
GET  /api/v1/search/code?q=parseToken+repo:acme/web                   → 200 { hits:[...] }
PUT  /api/v1/repos/acme/web/collaborators/bob  { "role":"write" }     → 204
```

**Data model.** Git repos as **content-addressed object stores** (blobs/trees/commits keyed by SHA — immutable, dedup'd) plus mutable **refs** (branch/tag → commit SHA). Objects on a replicated filesystem/blob store; refs in a strongly-consistent store with per-ref CAS. Metadata (repos, users, permissions, PRs) in **PostgreSQL**. Partition repos by `repo_id`; large repos replicated 3×; a separate code-search index.
```
Git objects (content-addressed, immutable):
  sha          STRING (key = SHA-256/SHA-1 of content)   -- "a1b2c3d..."
  type         ENUM(blob,tree,commit,tag)
  content      BYTES (zlib-compressed, packed)
  → stored in packfiles, replicated 3×, reads served from any replica

Refs (mutable, consistency-critical):
  repo_id      UUID    (partition key)
  ref_name     STRING                  -- "refs/heads/main"
  target_sha   STRING                  -- "e4f5g6h..."
  Update = CAS: SET target_sha=new WHERE ref_name=? AND target_sha=old   ← atomic
Example ref: {"repo_id":"r_88","ref_name":"refs/heads/main","target_sha":"e4f5g6h"}

Table: collaborators (Postgres, strongly consistent)
  repo_id, user_id, role ENUM(read,write,admin)   -- checked on every op
```

**Architecture.**
```
PUSH (git-receive-pack on refs/heads/main, old=a1b2c3d):
  1. authz: SELECT role FROM collaborators WHERE repo_id=r_88 AND user_id=bob → 'write' (else 403)
  2. receive packfile → write new objects (e4f5g6h, trees, blobs) to object store (immutable, idempotent)
  3. ref CAS on the repo PRIMARY:
        UPDATE refs SET target_sha='e4f5g6h'
        WHERE repo_id='r_88' AND ref_name='refs/heads/main' AND target_sha='a1b2c3d'
     rows=1 → 200 OK (commit accepted)
     rows=0 → someone else advanced main → 409 "fetch first" (client rebases, retries)
  4. replicate ref update primary → replicas; fan-out hook events (CI 10.4, search index)

FETCH/CLONE (git-upload-pack):  any READ REPLICA → negotiate wants/haves → stream packfile
                                (objects immutable → eventual replication is safe)
```
Concrete trace: Bob pushes `main` from `a1b2c3d` to `e4f5g6h`. Authz reads `collaborators` (strongly consistent — if an admin just revoked Bob, the read reflects it and returns 403). The new objects are written to the object store first; because they're content-addressed, writing them is idempotent and harmless even if the push later fails. Then the **per-ref CAS** runs on the repo's **primary**: `UPDATE refs ... WHERE target_sha='a1b2c3d'`. If Carol's push landed first and advanced `main` to `x9y8z7`, Bob's CAS matches zero rows → `409`, and Git tells him `! [rejected] (fetch first)`; he fetches, rebases onto `x9y8z7`, and retries. Once the CAS succeeds, the ref update replicates to read replicas and fires hooks (trigger CI run 10.4, enqueue a search-index update — eventually consistent). Clones/fetches hit any replica and stream a packfile, never touching the primary.

**Deep dive — Git object store + ref CAS + permissions.** Git's content-addressed object model makes the bulk of storage trivial: every object's key is the hash of its content, so objects are immutable, globally dedup'd, and safely replicated to any number of read replicas with eventual consistency (a clone reading a replica that's milliseconds behind is fine — the objects it needs either exist or the negotiation asks for more). The hard part is the small mutable surface: refs. Concurrent pushes to `main` must serialize or commits vanish, so the update is a **compare-and-swap conditioned on the expected current SHA** — atomic on a single primary per repo. This both serializes pushes and rejects stale ones (the "your branch is behind" rejection is the CAS failing). Permissions gate every operation and must be strongly consistent so a revoked collaborator cannot push using a cached grant.

| Mechanism | Consistency | Scaling | Failure cost |
|---|---|---|---|
| Objects (content-addressed) | eventual across replicas (safe — immutable) | read-scale on N replicas | none — re-fetch |
| Ref CAS (per repo primary) | linearizable per ref | one primary per repo (shard by repo) | push unavailable if primary down |
| Per-ref CAS vs branch lock | CAS = optimistic, no blocking | high concurrency | hot branch → retry loop |
| Branch lock | pessimistic, serial | simpler | blocks all pushers, lock-holder death |
| Permissions (Postgres) | strongly consistent | cached with invalidation | stale cache = security risk |

**Trade-offs & failure modes.**
- *Per-ref CAS* (correct serialization, but **ref contention** on a hot branch like a busy monorepo `main` → repeated 409/rebase retries) vs *branch locking* (simpler, but blocks every pusher and risks a dead lock-holder).
- *Strong consistency on refs + permissions* (required — eventual would risk lost commits and stale access) vs *eventual on objects* (safe and cheap because objects are immutable).
- *Large repos* are the operational pain (a 50 GB monorepo clone) → packfiles, delta compression, shallow/partial clones, and clone caching.
- *Storage node loss* is covered by 3× replication; *ref-write availability* depends on the per-repo primary/consensus — primary failover briefly blocks pushes to that repo while reads continue on replicas.
- *Code search* is decoupled and eventually consistent — a just-pushed commit is searchable seconds later, which is acceptable.

## 10.6 Multi-tenant SaaS platform

**Clarify.** Functional: serve many tenants from shared infrastructure with strict **isolation** (tenant A never sees B's data), per-tenant quotas, and the ability to migrate/scale a tenant. Non-functional: data + performance isolation, **noisy-neighbor** prevention, cost efficiency through sharing, per-tenant customization, and safe schema migrations across all tenants. Reliability/isolation semantics: every request is tenant-scoped end-to-end; the cardinal failure is a **cross-tenant data leak** (a missing `tenant_id` filter) → enforce structurally (row-level security), not by discipline. The cross-cutting trade-off: isolation vs sharing.

**Estimate (worked).**
```
Tenants:     200k tenants, power-law sized
             ~190k "small"   (≤ 1 GB, < 5 req/s each)
             ~9.5k "medium"  (1–50 GB, 5–100 req/s)
             ~500  "large"   (50 GB–5 TB, > 100 req/s)  ← whales
Pool sizing: 190k small × avg 200 MB ≈ 38 TB → pool into ~40 shared DBs (~1 TB each)
Silo sizing: 500 large → dedicated DB/cluster each (cost + isolation justified)
Requests:    aggregate 50k req/s; one large tenant alone can spike 5k req/s → noisy neighbor
Quotas:      per-tenant rate limit (e.g. small=10 req/s, large=negotiated) + storage caps
Migration:   a column add must apply to 40 pooled DBs + 500 silos = 540 migration targets
```
The numbers say: a power-law fleet → **hybrid placement** is the real answer — pool the long tail of small tenants for cost, silo the few whales for isolation and to contain noisy neighbors.

**API.**
```http
# every request carries tenant context (from JWT claim or subdomain), enforced server-side
GET /api/v1/invoices          Host: acme.app.com     Authorization: Bearer <jwt tenant=acme>
→ 200 [ ... ]      # query is rewritten WHERE tenant_id='acme' (row-level security)

# admin / control plane
POST /admin/tenants            { "name":"acme", "plan":"enterprise", "placement":"silo" } → 201
PUT  /admin/tenants/acme/quota { "rps":500, "storage_gb":2000, "max_conns":50 }            → 204
POST /admin/tenants/acme/migrate { "to_shard":"silo-acme-2" }                              → 202
```

**Data model — the isolation spectrum.** Three models, trading isolation vs cost; partition/shard by `tenant_id` throughout.
```
SILO (DB per tenant) — strongest isolation, easy per-tenant backup/migrate/customize, costly:
  silo-acme:  invoices(id, amount, ...)            -- no tenant_id needed; physical isolation

BRIDGE (schema per tenant in shared DB) — middle ground:
  shared-db:  acme.invoices(...)  globex.invoices(...)   -- per-schema, one connection pool

POOL (shared tables + tenant_id column) — cheapest, software-enforced isolation:
  Table: invoices
    id         UUID
    tenant_id  STRING   (partition key)   -- "acme"   ← MUST filter on every query
    amount     NUMERIC
  ENABLE ROW LEVEL SECURITY;  POLICY USING (tenant_id = current_setting('app.tenant_id'))
  Example: {"id":"inv_9","tenant_id":"acme","amount":120.00}

Tech: PostgreSQL (RLS for pool), per-silo DB instances for whales; tenant→placement map in a
      control-plane DB; per-tenant quotas in a rate limiter (Redis).
Hybrid: pool small tenants across ~40 DBs, silo the ~500 large ones.
```

**Architecture.**
```
REQUEST PATH (pool tenant):
  request (Host: acme.app.com, JWT tenant=acme)
    → gateway extracts tenant_id='acme' → per-tenant rate limit (Redis token bucket, 10 rps)
    → app: SET app.tenant_id='acme' for the txn
    → Postgres RLS auto-appends WHERE tenant_id='acme'  ← leak-proof even if a query forgets it
    → response

NOISY-NEIGHBOR CONTROL:
  per-tenant quotas: rps cap, max DB connections, storage cap, CPU share
  large tenant exceeding 100 req/s → throttled at gateway (429) before it touches shared DB
  whale promoted → silo-acme dedicated cluster → its load can't reach pooled tenants

MIGRATION (expand-contract, online, across 540 targets):
  1. EXPAND: add new nullable column / new table (backward-compatible) on all shards
  2. BACKFILL: migrate data in batches (rate-limited, per shard)
  3. SWITCH: app reads/writes new shape (behind a flag), rolled out shard by shard
  4. CONTRACT: drop old column after all tenants on new shape
```
Concrete trace: a request to `acme.app.com` arrives with a JWT whose claim is `tenant=acme`. The gateway extracts `tenant_id='acme'`, applies acme's **per-tenant token bucket** in Redis (plan `enterprise` → 500 rps); if acme floods 5k req/s, excess gets `429` at the gateway, so the shared Postgres never sees the storm. The app opens a transaction and runs `SET app.tenant_id='acme'`; **PostgreSQL row-level security** then rewrites every query with `WHERE tenant_id='acme'` automatically — so even a hand-written query that forgets the filter cannot read globex's rows. Acme is a small/medium tenant living in pooled shard `pool-07`. When acme grows past 50 GB / 100 rps, the control plane runs `POST /admin/tenants/acme/migrate` to promote it to a dedicated **silo cluster** (online copy + cutover), after which acme's load is physically isolated. A schema change (add `invoices.currency`) rolls out **expand-contract**: add the nullable column across all 540 targets, backfill in rate-limited batches, switch reads/writes behind a flag shard-by-shard, then drop the old shape — so no tenant ever sees a broken schema.

**Deep dive — tenant isolation + noisy neighbors + migrations.** Isolation vs sharing is the defining axis. Silo (DB-per-tenant) gives physical isolation, trivial per-tenant backup/restore/customization, and immunity to noisy neighbors — at high per-tenant cost (500 whales × a dedicated cluster). Pool (shared tables + `tenant_id`) maximizes density and cost efficiency but pushes isolation into software; the *only* safe way to enforce it is structurally — **row-level security** so a forgotten `WHERE tenant_id` cannot leak data — never per-query discipline. Noisy neighbors are tamed by per-tenant quotas (rps, connections, storage, CPU share) enforced at the gateway and DB, plus promoting heavy tenants to silos. Migrations are uniquely hard at multi-tenant scale because one change touches every tenant; expand-contract online migrations are mandatory so the system is always backward-compatible mid-rollout.

| Model | Isolation | Cost / density | Migration effort | Noisy-neighbor risk |
|---|---|---|---|---|
| Silo (DB/tenant) | strongest (physical) | low density, high cost | orchestrate across N DBs | none |
| Bridge (schema/tenant) | medium | medium | per-schema, shared engine | shared engine contention |
| Pool (shared + tenant_id + RLS) | software-enforced | highest density, cheapest | one migration covers all | high (mitigate via quotas) |
| Hybrid (pool small, silo whales) | tiered | best overall | mixed | contained (whales siloed) |

**Trade-offs & failure modes.**
- *Silo* (strong isolation, costly, per-tenant ops) vs *pool* (cheap, dense, software-enforced isolation + noisy-neighbor risk) vs *hybrid* (best of both, most operational complexity).
- *Cross-tenant data leak* is the cardinal failure — a single missing `tenant_id` filter exposes another tenant's data; prevent structurally with row-level security, not code review discipline.
- *Noisy neighbors:* one tenant spiking to 5k req/s degrades shared-DB latency for everyone → per-tenant quotas/rate limits (429 at the gateway) + siloing the whales.
- *Migrations risk breaking tenants:* a non-backward-compatible change breaks every tenant at once → expand-contract, staged shard-by-shard rollout, with the ability to halt mid-rollout.
- *A single huge tenant outgrowing shared infra* → promote to a dedicated silo via online migration; *per-tenant backup/restore* is trivial in silo, requires `tenant_id`-scoped export in pool.

---

## How to use this document

1. **Quiz with the cheat sheet.** Cover the columns and reconstruct each row from the problem name. If you can name the hardest decision, shard key, store, and consistency model for a problem, you understand its shape.
2. **Design cold, then compare.** For each problem, spend 35–45 minutes designing from a blank page, then read the detailed solution and write down what you missed.
3. **Track the reusable decision.** The same handful of trade-offs recur across all 50: **push vs pull** (feeds, fan-out), **SQL vs NoSQL**, **strong vs eventual consistency** (CAP/PACELC), **fan-out-on-write vs on-read**, **shard key choice**, **at-least-once + idempotency**, **sync vs async**, **precompute vs compute-on-read**, **isolation vs sharing**. Master these nine and you can derive most of system design.
4. **Map back to theory.** Each problem links (in [PROBLEM-BANK.md](PROBLEM-BANK.md)) to the relevant [HLD curriculum](README.md) chapter — go deep there when a building block feels shaky.
