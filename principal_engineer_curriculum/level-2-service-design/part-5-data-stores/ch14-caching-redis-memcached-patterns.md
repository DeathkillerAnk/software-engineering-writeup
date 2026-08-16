# Chapter 14 — Caching: Redis, Memcached, and Cache Design Patterns

## Difficulty
Intermediate → Advanced

## Importance
**Must Know** — Caching is the single most powerful tool for improving performance in a distributed system. The physics are absolute: RAM access is ~100ns; NVMe SSD access is ~100µs; network round trip to a database is ~1ms–50ms. A cache hit serves a response 100–500× faster than a database read. At scale, caches are not an optimization — they are a load-shedding mechanism. Without caching, most high-traffic systems would collapse under database load within minutes. But caching is also the source of some of the most subtle bugs in distributed systems: stale reads, cache stampedes, cache poisoning, inconsistency between cache and database. "Just add Redis" without understanding the failure modes is how you accidentally serve wrong data to millions of users.

## Prerequisites
Chapter 7 — Storage Engines and Database Internals (memory hierarchy, why RAM is fast)
Chapter 8 — Consistency, Consensus (strong vs eventual consistency, applies to cache freshness)
Chapter 12 — SQL Databases at Scale (what caching reduces load on)
Chapter 13 — NoSQL Databases (Redis is also a data structure store and primary database)

## Learning Objectives

By the end of this chapter you will be able to:

1. Explain the physics of caching — why memory access is fundamentally faster than disk or network, and how this translates to throughput multiplication.
2. Describe Redis's data structures (String, Hash, List, Set, Sorted Set, HyperLogLog, Stream) and the use case for each.
3. Implement the four cache design patterns — Cache-Aside, Write-Through, Write-Behind, and Read-Through — and explain the consistency and failure trade-offs of each.
4. Explain cache eviction policies (LRU, LFU, TTL) and choose the right one for a workload.
5. Design cache invalidation strategies — the hardest problem in caching — and understand why different invalidation approaches make different consistency guarantees.
6. Diagnose and prevent the three major cache failure modes: cache stampede, cache avalanche, and cache poisoning.
7. Explain how Redis Cluster achieves horizontal scaling (hash slots, resharding) and what it sacrifices.
8. Compare Redis and Memcached and know when to choose each.
9. Apply cache warming strategies for cold start prevention.

## Why This Matters

Twitter's timeline service, before aggressive caching, would have required reading 100+ tweets from 100+ different users per timeline request — hundreds of database reads per page view. At 300M daily active users: mathematically impossible on any database cluster. The solution: pre-computed timelines cached per user in Redis. Timeline read = one cache lookup, regardless of follower count.

Instagram's photo feed: 1 billion photos, 100M daily users. Without caching, every feed render = dozens of database queries per user per session. With Redis caching of feed data, user counts, and photo metadata: 99% of requests served from cache, database load reduced by 100×.

The flip side: in 2019, a major e-commerce platform's Redis cache went down at 11pm. Suddenly, 100% of traffic hit PostgreSQL directly. Connections exhausted. Database overwhelmed. 90-minute outage. Every request that assumed cache availability cascaded into a database call — the database was sized for 1% of traffic, not 100%.

Both stories are about understanding caching deeply — not just adding it.

---

## Mental Model

> **A cache is a trade: you pay with memory (expensive) and consistency complexity (bugs) to buy latency (fast) and throughput (scale). The fundamental cache contract is: the cache may serve a value that is not the latest value in the source of truth. Everything about cache design is managing this contract — choosing how stale is acceptable, for which data, for how long, and what happens when the cache is cold or wrong. The correct question before adding a cache is never "should we cache?" but rather: "What consistency contract can we accept for this data, and which cache pattern enforces that contract?"**

---

## Intuition

Think of caching like a physical desk vs a filing cabinet.

**Filing cabinet (database):** Every document you ever created, perfectly organized, always up to date. To read a document: walk to the filing cabinet, find the folder, pull the document. Slow. But authoritative.

**Desk (cache):** The 5-10 documents you work with most frequently, right in front of you. Read time: 0 seconds. But: if someone updates the filing cabinet version while you're working with the desk copy, your desk version is now stale. And if you leave the office, someone must re-fetch documents from the cabinet before you can work.

**The cache design patterns answer:**
- When do you update the desk copy? (write-through: update both simultaneously)
- What if the desk copy gets outdated? (TTL: discard and re-fetch after 5 minutes)
- What if 100 people all need the same document and the desk is empty? (stampede prevention: only one person fetches, others wait)
- What if someone forgets to update the desk when the cabinet changes? (cache invalidation: explicitly remove the desk copy so the next reader gets fresh data)

---

## Visual Explanation

### Memory Hierarchy and Cache Physics

```
Memory Hierarchy (why caching works — physics, not opinion):

Register (CPU)        ~0.3 ns   ████ (you are here when executing)
L1 cache              ~1 ns     ████
L2 cache              ~4 ns     ████
L3 cache              ~10 ns    ████
DRAM (RAM)            ~100 ns   ████████
NVMe SSD              ~100 µs   ██████████████████████████████████████████
Network (same DC)     ~500 µs   ████████████████████████████████████████████████████████████████████
SATA SSD              ~500 µs   same
Spinning HDD          ~10 ms    (not pictured — off the chart)
Network (cross-region) ~50 ms   (not pictured — off the chart)

Cache effect on a database read that takes 5ms:
  Without cache: every request = 5ms latency + DB CPU load + DB connection use
  With cache (hit rate 95%):
    95% requests: 100µs (Redis network) = 50× faster
    5% requests: 5ms (cache miss → DB read)
    Average: 0.95 × 0.1ms + 0.05 × 5ms = 0.095 + 0.25 = 0.345ms
    50× improvement in average latency
    DB load: 5% of original → 20× reduction
```

### Cache Design Patterns — Side by Side

```
CACHE-ASIDE (Lazy Loading):

  Read:
    Client → Cache lookup
    HIT:  return value (fast)
    MISS: Client → Database → get value → write to cache → return value
  
  Write:
    Client → Database (write)
    Client → Cache.delete(key) (invalidate, OR: just let TTL expire)

  READ-THROUGH (Cache as proxy):

    Client → Cache lookup
    HIT:  return value
    MISS: Cache → Database → get value → cache stores it → return to client
    (Client never talks to database — cache is the proxy)

  WRITE-THROUGH:

    Client → Cache write
    Cache → Database write (synchronous, before returning to client)
    Client receives confirmation after BOTH writes succeed.
    → Cache always consistent with DB
    → Latency = cache write + DB write

  WRITE-BEHIND (Write-Back):

    Client → Cache write → immediate success returned to client
    Cache → Database write (ASYNC, batched, later)
    → Very fast writes (only cache latency, not DB latency)
    → Risk: if cache fails before async flush, data is lost
```

---

## Core Concepts

### 1. Redis — The Data Structure Server

Redis is not just a cache — it is an in-memory data structure store. Every data type in Redis supports atomic operations, making it suitable for distributed coordination, rate limiting, leaderboards, message streams, and more.

#### String
The most fundamental type. Binary-safe — can store any byte sequence up to 512 MB.

```
Use cases:
  Simple key-value: SET user:789:name "Alice"
  Counters: INCR page:views:home → returns new value atomically
  Rate limiting: INCR rate:user:789 / EXPIRE rate:user:789 60
  Distributed flag: SET feature:dark_mode:enabled 1 EX 3600
  Session storage: SET session:abc123 <serialized_json> EX 1800
  Idempotency key: SET idempotency:payment:<key> <result> NX EX 86400
    (NX: set-if-not-exists, atomic check-and-set)

Commands:
  SET key value [EX seconds] [NX|XX]   -- set with TTL and conditional
  GET key                              -- get value
  GETSET key value                     -- get old value, set new (atomic)
  INCR / INCRBY / DECR / DECRBY       -- atomic integer arithmetic
  SETNX key value                      -- set if not exists (legacy; use SET NX)
  GETDEL key                           -- get and delete atomically
```

#### Hash
A map of field-value pairs stored as a single key. Efficient for storing objects with multiple fields — analogous to a row in a table.

```
Use cases:
  User profile: HSET user:789 name "Alice" email "alice@example.com" tier "premium"
  Shopping cart: HSET cart:user789 product:p123 2 product:p456 1
  Configuration: HSET config:payment timeout 5000 retry_max 3
  Rate limit counters per endpoint: HSET rate:user789 /api/orders 42 /api/products 7

Commands:
  HSET key field value [field value ...]  -- set one or more fields
  HGET key field                          -- get one field
  HMGET key field [field ...]             -- get multiple fields
  HGETALL key                             -- get all fields and values
  HINCRBY key field delta                 -- atomic increment a numeric field
  HDEL key field                          -- delete a field
  HKEYS / HVALS / HLEN key               -- introspection

Performance: O(1) per field get/set. HGETALL is O(N fields).
Memory: significantly more efficient than N separate STRING keys (saves Redis overhead per key).
```

#### List
Doubly-linked list, ordered by insertion order. O(1) push/pop from both ends; O(N) for index access.

```
Use cases:
  Message queue: LPUSH queue:emails <job_json> / BRPOP queue:emails 0 (blocking pop)
  Activity log: LPUSH user:789:activity <event> / LTRIM user:789:activity 0 99 (keep last 100)
  Recent items: LPUSH recent:searches "macbook" / LRANGE recent:searches 0 9

Commands:
  LPUSH / RPUSH key value [value ...]    -- push to left/right
  LPOP / RPOP key [count]               -- pop from left/right
  BRPOP key [key ...] timeout            -- blocking pop (wait up to timeout seconds)
  LRANGE key start stop                  -- get elements in range (0-indexed, -1=last)
  LTRIM key start stop                   -- keep only elements in range
  LLEN key                               -- list length

List as queue: LPUSH (producer) + BRPOP (consumer) = reliable FIFO queue.
Warning: Redis List is not a reliable queue — items lost if consumer crashes after BRPOP but before processing. Use LMOVE + acknowledgment pattern for reliability.
```

#### Set
Unordered collection of unique strings. O(1) add/remove/check. Supports set operations.

```
Use cases:
  Unique visitors: SADD unique:visitors:2024-01-15 user:789 (user:789 added only once)
  Tags: SADD post:p123:tags "distributed-systems" "databases"
  Mutual friends: SINTER user:alice:following user:bob:following → common followees
  "Users who liked post X": SADD likes:post:p123 user:789

Commands:
  SADD key member [member ...]     -- add members (duplicates ignored)
  SREM key member [member ...]     -- remove members
  SISMEMBER key member             -- check membership (O(1))
  SMEMBERS key                     -- get all members (O(N))
  SCARD key                        -- set cardinality (count)
  SINTER key [key ...]             -- intersection
  SUNION key [key ...]             -- union
  SDIFF key [key ...]              -- difference
```

#### Sorted Set (ZSet)
Like Set, but every member has a **score** (float). Members are ordered by score, with O(log N) add/remove/rank operations.

```
Use cases:
  Leaderboard: ZADD leaderboard 9500 "user:789" → ZREVRANK leaderboard "user:789"
  Priority queue: ZADD jobs:priority 10 high_priority_job / 1 low_priority_job
  Rate limiter (sliding window): ZADD rate:user:789 <timestamp> <request_id>
                                 ZREMRANGEBYSCORE rate:user:789 0 <60_seconds_ago>
                                 ZCARD rate:user:789 → request count in last minute
  Feed chronological sort: ZADD feed:user:789 <unix_timestamp> <post_id>
                            ZREVRANGE feed:user:789 0 24 → latest 25 post IDs

Commands:
  ZADD key [NX|XX] [GT|LT] score member [score member ...]
  ZRANGE key min max [REV] [BYSCORE|BYLEX] [LIMIT offset count]
  ZREVRANK key member                   -- rank (highest score = rank 0)
  ZSCORE key member                     -- get score of member
  ZINCRBY key delta member              -- atomic score increment
  ZRANGEBYSCORE key min max [LIMIT offset count]
  ZREMRANGEBYSCORE key min max          -- remove members by score range
  ZCARD key                             -- count of members
```

#### HyperLogLog (HLL)
A probabilistic data structure for approximate cardinality counting. Uses only 12 KB of memory regardless of the number of unique items counted, with ~0.81% standard error.

```
Use cases:
  Unique visitor count (don't care about exact number, approximate is fine):
    PFADD unique:pageviews:2024-01-15 user:789
    PFADD unique:pageviews:2024-01-15 user:123
    PFCOUNT unique:pageviews:2024-01-15 → approximately N unique visitors

  Compare: tracking 100M unique users with a Set = 100M × 20 bytes = 2GB RAM
           tracking 100M unique users with HLL  = 12KB RAM
           
  Error: PFCOUNT may be off by ~0.81% → for a 1M count: ±8,100 error
  Acceptable for analytics; NOT acceptable for billing or access control.
```

#### Stream
Append-only log of messages with consumer groups — Redis's answer to Kafka for simpler use cases.

```
Use cases:
  Event sourcing: XADD events * userId 789 event "purchase" orderId "o123"
  Message queue with consumer groups (at-least-once delivery):
    Producer: XADD stream:orders * orderId o123 total 99.99
    Consumer: XREADGROUP GROUP fulfillment consumer1 COUNT 10 STREAMS stream:orders >
    Ack: XACK stream:orders fulfillment <message-id>
    (Unacked messages can be reclaimed if consumer dies)

Commands:
  XADD key [MAXLEN count] * field value [field value ...]  -- append message
  XREAD COUNT n STREAMS key last-id                        -- read N new messages
  XREADGROUP GROUP group consumer COUNT n STREAMS key >    -- consumer group read
  XACK key group message-id [message-id ...]               -- acknowledge processing
  XPENDING key group                                       -- see unacknowledged messages
  XLEN key                                                 -- number of messages
```

### 2. Redis Persistence — When Cache Becomes Database

Redis offers persistence options for when data must survive restarts:

```
No persistence (pure cache):
  - Data lost on restart → cold cache → cache stampede risk
  - Fastest: no I/O overhead
  - Use when: cache of DB data, easily reloaded from source of truth

RDB (point-in-time snapshots):
  SAVE 900 1      # snapshot if 1 write in 900 seconds
  SAVE 300 10     # snapshot if 10 writes in 300 seconds
  SAVE 60 10000   # snapshot if 10K writes in 60 seconds
  
  Pros: compact file, fast restart (load snapshot), low I/O overhead
  Cons: data loss between snapshots (up to 5-15 minutes)
  Use when: acceptable to lose a few minutes of writes (caches, session stores)

AOF (Append-Only File — like WAL):
  appendonly yes
  appendfsync everysec   # fsync every second (up to 1 second data loss)
  # appendfsync always   # fsync every write (no data loss, 2× slower)
  # appendfsync no       # OS decides when to fsync (fastest, most data loss risk)
  
  Pros: near-zero data loss (everysec: max 1 second), can replay to exact state
  Cons: larger file, slower restart (replay all commands), needs periodic rewrite
  Use when: Redis is primary data store (not just cache)

RDB + AOF (recommended for primary Redis):
  Best of both: fast restart from RDB, catch-up via AOF since last RDB snapshot
  Use when: Redis is a primary data store with durability requirements
```

### 3. Cache Design Patterns — The Full Engineering Picture

#### Cache-Aside (Lazy Loading) — The Most Common

```python
def get_user(user_id: str) -> User:
    cache_key = f"user:{user_id}"
    
    # 1. Check cache
    cached = redis.get(cache_key)
    if cached:
        return User.from_json(cached)    # cache HIT: fast path
    
    # 2. Cache MISS: load from DB
    user = db.query("SELECT * FROM users WHERE id = ?", user_id)
    if not user:
        # Cache negative result too (prevent DB hammering for non-existent keys):
        redis.setex(cache_key, 60, "__NOT_FOUND__")  # 60-second TTL for negative
        raise UserNotFound(user_id)
    
    # 3. Populate cache
    redis.setex(cache_key, 3600, user.to_json())  # 1-hour TTL
    return user

def update_user(user_id: str, data: dict) -> User:
    # 1. Write to DB (source of truth first)
    updated = db.execute("UPDATE users SET ... WHERE id = ?", user_id, data)
    
    # 2. Invalidate cache (not update — write-through would do that)
    redis.delete(f"user:{user_id}")
    
    return updated
```

**Trade-offs of Cache-Aside:**
- ✅ Cache only populated for data that is actually requested (no wasted memory)
- ✅ Cache failure degrades gracefully (requests go to DB — slow but correct)
- ✅ Simple to implement
- ⚠️ Cache miss causes a "read-your-writes" problem — immediately after a write, the next read misses cache, reads stale DB data (if replication lag), or reads the old cache value if TTL hasn't expired
- ⚠️ Three round trips on cache miss (check cache → miss → read DB → write cache) adds latency on first access
- ⚠️ Race condition: two threads both miss cache → both read DB → both write cache (harmless but wasteful)

#### Write-Through — Always Consistent, Always Warm

```python
def update_user(user_id: str, data: dict) -> User:
    # Write to cache and DB atomically (or near-atomically):
    updated = db.execute("UPDATE users SET ... WHERE id = ?", user_id, data)
    redis.setex(f"user:{user_id}", 3600, updated.to_json())
    return updated
    # Cache always has the latest value → no stale reads after writes
```

**Trade-offs of Write-Through:**
- ✅ Cache always consistent with DB for data that has been written
- ✅ No cache miss on first read after a write (cache is pre-warmed)
- ⚠️ Write latency = DB write + cache write (both in the critical path)
- ⚠️ Dual-write failure risk: DB write succeeds, cache write fails → inconsistent
  - Mitigation: write DB first, then cache. On cache failure: log and delete key
    (next read will miss and reload from DB — temporarily consistent)
- ⚠️ Caches data that may never be read (writes to cache populate it even if nobody reads it)

**Atomic dual-write with Lua (prevents partial updates):**
```lua
-- Redis Lua script: SET cache + publish invalidation event (atomic)
local user_json = ARGV[1]
local ttl = ARGV[2]
redis.call('SET', KEYS[1], user_json, 'EX', ttl)
redis.call('PUBLISH', 'cache:invalidated', KEYS[1])
return 1
```

#### Write-Behind (Write-Back) — Maximum Write Throughput

```python
def update_user(user_id: str, data: dict) -> User:
    cache_key = f"user:{user_id}"
    # 1. Write to cache only (fast path — returns immediately)
    updated_user = merge_user_data(get_cached_user(user_id), data)
    redis.setex(cache_key, 3600, updated_user.to_json())
    
    # 2. Enqueue async DB write
    write_queue.push({"table": "users", "id": user_id, "data": data, "time": now()})
    
    return updated_user

# Background worker (separate process):
def flush_write_queue():
    while True:
        batch = write_queue.pop_batch(max_size=100)
        if batch:
            db.batch_execute("UPDATE users SET ... WHERE id = ?", batch)
        time.sleep(0.01)  # flush every 10ms
```

**Trade-offs of Write-Behind:**
- ✅ Write latency = cache write only (~0.1ms vs 5ms for DB write) → 50× faster writes
- ✅ DB write batching → reduces DB write amplification
- ❌ Data loss risk: if Redis crashes before async flush, writes in cache-only state are lost
- ❌ Read-after-write to a different node may miss the DB-unflushed data
- ❌ Ordering complexity: if multiple writes to same key, must flush in order
- **Use only when:** high write throughput is critical AND data loss of seconds is acceptable (analytics counts, leaderboard scores, view counts — not financial transactions)

#### Read-Through — Cache as Transparent Proxy

```python
# The cache itself handles misses — the application only talks to the cache:

class ReadThroughCache:
    def get(self, key: str) -> Optional[bytes]:
        value = redis.get(key)
        if value is not None:
            return value
        # Cache itself fetches from DB on miss:
        value = self._load_from_db(key)
        if value:
            redis.setex(key, 3600, value)
        return value
    
    def _load_from_db(self, key: str) -> Optional[bytes]:
        # Parse key to determine table/query:
        entity_type, entity_id = key.split(":", 1)
        if entity_type == "user":
            return db.query("SELECT ... FROM users WHERE id=?", entity_id)
        # ... other entity types

# Application code only calls cache.get(key):
user = cache.get(f"user:{user_id}")
```

**Trade-offs of Read-Through:**
- ✅ Application code is simpler — only one interface (the cache)
- ✅ Cache is the single point of access — easier to add instrumentation
- ⚠️ Cache failure → application failure (no fallback to DB without extra code)
- ⚠️ Cache must understand how to load every entity type (coupling)
- ✅ Works well with managed cache systems (Amazon ElastiCache with DAX, Ehcache)

### 4. Cache Eviction Policies

When Redis memory fills up, it must evict keys. The eviction policy determines which keys are removed.

```
Redis maxmemory-policy options:

noeviction (default):
  Write commands fail when memory full.
  Returns error: "OOM command not allowed when used memory > 'maxmemory'."
  Use when: Redis is primary data store, cannot lose data.

allkeys-lru:
  Evict the least recently used key across ALL keys.
  Best for: general cache where you want "most recently accessed" data to stay.

volatile-lru:
  Evict the least recently used key ONLY from keys with a TTL set.
  Keys without TTL (permanent) are never evicted.
  Best for: mix of cached data (with TTL) and permanent data (session state, config).

allkeys-lfu:
  Evict the least frequently used key across ALL keys.
  LFU tracks access frequency (not just recency).
  Better than LRU for: workloads with hot keys accessed very frequently (product catalog).
  Example: "iPhone 15" page cached and accessed 10,000× today — LFU keeps it;
           "obscure product" cached and accessed once — LFU evicts it.

volatile-ttl:
  Evict keys with the shortest remaining TTL first.
  Best for: deliberately managed TTLs where older data should expire first.

allkeys-random:
  Evict random keys. Rarely optimal. Use only if access is truly uniform.
```

**LRU vs LFU — the key insight:**

```
LRU problem (scan resistance):
  Workload: 1,000 hot product pages accessed 1,000× each today.
  Cache full: all 1,000 hot products cached.
  
  Nightly batch job runs: scans ALL 5,000,000 products sequentially.
  LRU: batch job evicts ALL hot products (they weren't "recently used" during scan).
  Next morning: cache is cold. 100% cache misses. Database hammered.
  
LFU solution:
  LFU tracks frequency. Hot products: accessed 1,000× → high frequency.
  Batch job items: accessed 1× → low frequency → LFU evicts them instead.
  Hot products remain cached. Morning traffic: hot products still in cache.
  Cache hit rate recovers immediately.

Use allkeys-lfu for production caches with a mix of hot and cold access patterns.
```

### 5. Cache TTL Strategy

TTL (Time-To-Live) is the expiry time of a cache entry. Choosing TTL correctly is a balance between:
- Short TTL: fresh data, more DB reads, lower cache hit rate
- Long TTL: stale data risk, fewer DB reads, higher cache hit rate

**TTL design by data volatility:**
```
Data category              Acceptable staleness  TTL choice
─────────────────────────────────────────────────────────
User session               Never stale           No TTL (invalidate explicitly on logout)
User balance, inventory    < 1 second            1-5 seconds (or no cache — read from DB)
User profile               < 1 minute            60 seconds with explicit invalidation on update
Product details            < 5 minutes           300 seconds
Product catalog (listing)  < 15 minutes          900 seconds
Homepage content           < 1 hour              3600 seconds
Static config              < 24 hours            86400 seconds
Analytics aggregates       < 1 day               86400 seconds or lazy compute
```

**TTL jitter — preventing synchronized expiry:**
```python
# BAD: all cache entries expire at the same time → coordinated cache miss → stampede
for product in products:
    redis.setex(f"product:{product.id}", 300, product.to_json())  # all expire in 300s

# GOOD: add random jitter to TTL → stagger expiry → smoothed-out load
import random
for product in products:
    ttl = 300 + random.randint(-30, 30)  # 270-330 seconds (±10% jitter)
    redis.setex(f"product:{product.id}", ttl, product.to_json())
```

### 6. Cache Invalidation — "The Hardest Problem in Computer Science"

Phil Karlton's quote: "There are only two hard things in computer science: cache invalidation and naming things." Cache invalidation is hard because:
- The cache and database are separate systems that must be kept in sync
- Updates happen concurrently with reads
- Network failures can leave them partially synchronized
- The order of operations matters

**Strategies:**

**TTL-based expiry (simplest, least precise):**
```
Cache entry expires after N seconds → stale for up to N seconds → reader gets DB value.
Pros: no invalidation code needed; works even if update path doesn't touch cache.
Cons: stale for up to TTL duration; no way to force freshness on update.
Use when: data freshness requirement is coarser than TTL (e.g., product prices
          update infrequently, 5-minute staleness is acceptable).
```

**Explicit invalidation (on write):**
```python
def update_product(product_id, new_price):
    db.execute("UPDATE products SET price=? WHERE id=?", new_price, product_id)
    redis.delete(f"product:{product_id}")  # invalidate cache
    # Next read will miss cache and reload fresh data from DB
```

**Problem: race between invalidation and re-population:**
```
Timeline:
T1: Reader A: cache miss → starts DB query
T2: Writer: UPDATE DB, redis.delete(product:p123)
T3: Reader A: DB query returns OLD value (query started before T2's UPDATE)
T4: Reader A: redis.setex(product:p123, 3600, OLD_VALUE)  ← stale value cached!
T5: New readers: get stale value for 3600 seconds!

Fix: use write-through (update cache AFTER DB update, not before); 
     OR version-based cache keys (product:p123:version:42) — see below.
```

**Version-based cache keys:**
```python
# Each entity has a version counter. Cache key includes version number.
def get_product(product_id):
    version = redis.get(f"product:{product_id}:version") or "1"
    cache_key = f"product:{product_id}:v{version}"
    
    cached = redis.get(cache_key)
    if cached:
        return Product.from_json(cached)
    
    product = db.query("SELECT * FROM products WHERE id=?", product_id)
    redis.setex(cache_key, 86400, product.to_json())
    return product

def update_product(product_id, new_price):
    db.execute("UPDATE products SET price=? WHERE id=?", new_price, product_id)
    # Atomically increment version:
    new_version = redis.incr(f"product:{product_id}:version")
    # Old cache key (e.g., :v1) is now orphaned — will expire naturally
    # Next read will use new key (:v2) and populate fresh data
```

**Event-driven invalidation (via CDC):**
```
Pattern: Database Change Data Capture (CDC) → publish changes → cache subscribers invalidate.

PostgreSQL → Debezium (reads WAL) → Kafka topic → Cache invalidator service
  → redis.delete(f"product:{product_id}") for every product update in Kafka

Advantages:
  - Invalidation is guaranteed even if the application forgot to call redis.delete()
  - Works across multiple cache instances (multi-region)
  - Source of truth is the DB WAL — can't miss an update

Disadvantages:
  - Additional infrastructure (Debezium, Kafka, consumer service)
  - Propagation delay (WAL → Kafka → consumer → Redis): typically 100ms-1s
  - During that window: cache has stale data

Use when: multiple services write to the DB, and all must trigger cache invalidation.
          Application-level invalidation is error-prone (someone always forgets).
```

### 7. Cache Failure Modes

#### Cache Stampede (Thundering Herd on Cache Miss)

```
Scenario: Product listing page. 10,000 concurrent users.
  Cache key: "product:listing:page:1" with 5-minute TTL.
  At T=0: TTL expires. Key is empty.
  
  All 10,000 concurrent requests:
    1. Check cache → MISS
    2. Query DB to regenerate listing
  
  Result: 10,000 simultaneous DB queries for the same data.
  DB: overwhelmed. Query time: 30 seconds (under load).
  All 10,000 requests waiting 30 seconds. 99% timeout. Cascading failure.

Prevention 1: Mutex/Singleflight lock
  First request on miss: acquires a Redis lock (SETNX lock:product:listing:page:1)
  Other requests: wait for lock to release (or return stale data if available)
  First request: generates value, caches it, releases lock
  Others: re-check cache (now populated), return value
  
  Implementation:
    lock_key = "lock:product:listing:page:1"
    lock_acquired = redis.set(lock_key, "1", NX=True, EX=10)  # 10s lock TTL
    if lock_acquired:
        value = db.query(...)  # only ONE request runs this
        redis.setex(cache_key, 300, value)
        redis.delete(lock_key)
    else:
        # Wait for lock to release, then re-check cache:
        time.sleep(0.05)  # 50ms backoff
        return get_from_cache_or_db(cache_key)

Prevention 2: Probabilistic early expiration (XFetch algorithm)
  Before TTL expires, occasionally re-compute the value:
  
  expiry_time = redis.pttl(cache_key) / 1000.0  # remaining TTL in seconds
  delta = time_to_compute_value  # measured at last recompute (e.g., 0.2 seconds)
  
  # XFetch: recompute if:
  if current_time - delta * beta * log(random()) > expiry_time:
      recompute_and_cache()  # this request races ahead to refresh before expiry
  
  Effect: at 5% of TTL remaining, ~10% of requests proactively recompute.
  Expiry never truly hits zero — cache is refreshed before expiry, not after.
  No lock needed. Trade-off: slightly more DB reads at the end of TTL window.

Prevention 3: Stale-While-Revalidate
  Serve the stale cached value while asynchronously refreshing in the background:
  
  cache_entry = redis.get(cache_key)
  if cache_entry.is_stale():  # TTL < 30 seconds remaining
      async_task(refresh_cache, cache_key)  # background refresh
      return cache_entry.value              # return stale (but fast)
  elif cache_entry is None:
      # True cold miss: must synchronously load
      value = db.query(...)
      cache(cache_key, value)
      return value
  
  Effect: Users never wait for cache refresh. Data may be up to (TTL + refresh_time) stale.
  Trade-off: must track TTL separately from Redis TTL (soft TTL vs hard TTL).
```

#### Cache Avalanche

A cache stampede affects one key. A cache avalanche affects many keys simultaneously.

```
Scenario: Black Friday preparation. Team pre-warms 100,000 product pages.
  All cache entries: SETEX product:* 3600 <value>
  (All set at the same time → all expire at the same time)
  
  After 3600 seconds: ALL 100,000 keys expire simultaneously.
  Next 10 seconds: every product page request is a cache miss.
  100,000+ simultaneous DB queries. Database overwhelmed. Full outage.

Prevention:
  1. TTL jitter: expire products over a window, not all at once:
     ttl = 3600 + random.randint(0, 600)  # ±10 minutes variance
  
  2. Staggered warm-up: don't pre-warm all keys simultaneously:
     warm keys at rate: 1,000 keys/second → 100 seconds to warm 100K keys
  
  3. Tiered TTL: most-read keys: longer TTL; rarely-read keys: shorter TTL
     (hot products stay in cache longer → less frequent mass expiry events)
  
  4. Persistent Redis: with RDB snapshots, cache survives restarts
     → no cold-cache on Redis restart (a common avalanche cause)
```

#### Cache Poisoning

Malicious or buggy data cached, served to all users.

```
Scenario 1: XSS via cached page
  Attacker submits comment with <script>steal_cookies()</script>
  Application caches the page with the malicious comment
  1,000 users load the cached page → all receive the XSS payload

Scenario 2: Bug causes wrong data to be cached
  Product price computation bug: computes negative price for a specific SKU
  Negative price cached for 1 hour → 1,000 users see and purchase at negative price

Prevention:
  1. Validate data BEFORE caching: don't cache unless the value passes validation
  2. Sanitize user-generated content before embedding in cached pages
  3. Short TTL for data derived from user input
  4. Cache keys must be validated (no user-controlled cache key injection):
     BAD:  cache_key = f"page:{request.args.get('id')}"  # user controls key
     GOOD: cache_key = f"page:{int(product_id)}"  # validated and typed
  5. Cache versioning: if poisoned data is cached, increment version → old key orphaned
```

### 8. Redis Cluster — Horizontal Scaling

A single Redis instance is limited by memory of one machine (~100-200 GB in practice). Redis Cluster shards data across multiple nodes.

```
Redis Cluster architecture:
  16,384 hash slots total
  Each key mapped to: slot = CRC16(key) % 16384
  
  6-node cluster (3 primaries, 3 replicas):
    Primary A (slots 0-5460):    → Replica A'
    Primary B (slots 5461-10922): → Replica B'
    Primary C (slots 10923-16383): → Replica C'

  key "user:789" → CRC16 → slot 2,156 → Primary A handles it
  key "product:p123" → CRC16 → slot 8,734 → Primary B handles it

  Client library: redis-py-cluster, Jedis Cluster → handles routing transparently

Hash tags for multi-key operations:
  Redis Cluster requirement: multi-key operations (MGET, pipeline, MULTI/EXEC)
  must touch keys on the SAME slot (same node).
  
  Force same slot with hash tags: {user:789}:profile and {user:789}:orders
  → Both use "user:789" for hash → same slot → can MGET together
  
  Without hash tag: user:789:profile and user:789:orders may be on different nodes
  → Cannot MGET in one call → must use two separate GET calls
```

**Resharding (adding nodes):**
```
Add node D (new primary for slots 10000-12000, moved from C):
  1. CLUSTER MEET D → introduce D to cluster
  2. CLUSTER SETSLOT 10000 IMPORTING D → D ready to receive slot 10000
  3. CLUSTER SETSLOT 10000 MIGRATING C → C starts migrating slot 10000
  4. redis-cli --cluster reshard → moves keys from C to D for slots 10000-12000
  5. During migration: reads/writes to migrating slots are redirected (MOVED/ASK errors)
     Client libraries handle ASK redirects transparently
  
  No downtime: resharding is online, clients continue operating during migration.
  Duration: depends on key count → 1M keys takes ~1-2 minutes per slot.
```

**Redis Cluster limitations:**
```
- Maximum 16,384 nodes (one per slot) — in practice: 100-300 nodes
- No cross-slot transactions (MULTI/EXEC with different slots → CROSSSLOT error)
- Pub/Sub is cluster-wide (publish on any node → all nodes receive)
- Lua scripts: all keys must be on same slot
- SCAN iterates one node at a time → use SCAN on each node for cluster-wide scan
```

### 9. Redis vs Memcached

| Feature | Redis | Memcached |
|---------|-------|-----------|
| Data types | String, Hash, List, Set, ZSet, Stream, HLL | String only |
| Persistence | RDB + AOF | None (pure memory) |
| Replication | Primary-replica, Redis Cluster | None built-in |
| Transactions | MULTI/EXEC (optimistic) | None |
| Pub/Sub | Built-in | None |
| Lua scripting | Built-in (atomicity) | None |
| Memory efficiency | Good | Slightly better (less overhead per key) |
| Multithreading | IO multithreaded (6.0+) | Fully multithreaded |
| Community | Large, active | Older, declining |
| AWS managed | ElastiCache for Redis | ElastiCache for Memcached |

**When to choose Memcached:**
- Pure key-string cache with no advanced features needed
- Extremely high throughput per node (Memcached's multithreaded design wins)
- Large cache clusters where simplicity > features
- Teams that have existing Memcached expertise

**When to choose Redis (almost always):**
- Need data types beyond strings (leaderboards, rate limiting, queues)
- Need persistence (session store, primary data store)
- Need replication and automatic failover (Redis Sentinel or Cluster)
- Need Pub/Sub or Streams
- Need Lua scripting for atomic operations

### 10. Cache Warming Strategies

A cold cache (after Redis restart, new deployment, first launch) causes the same effect as a cache avalanche — all requests miss until the cache is warm.

```
Strategy 1: Lazy warming (no pre-warming)
  Let cache warm naturally via user traffic.
  First N users: slower (cache miss → DB read)
  After N minutes: cache is warm for hot data
  Problem: peak traffic after deployment hits cold cache → database spike

Strategy 2: Eager warming (pre-warm before traffic hits)
  Before deploying or restarting:
    warm_cache_script.py:
      top_products = db.query("SELECT * FROM products ORDER BY view_count DESC LIMIT 10000")
      for product in top_products:
          redis.setex(f"product:{product.id}", 3600, product.to_json())
          time.sleep(0.001)  # 1K writes/second (don't overwhelm Redis)
  
  After script: Redis is warm. Deploy → traffic hits warm cache immediately.

Strategy 3: Cache warming via traffic replay
  Before production deployment: replay recent production traffic against the new cache.
  Tools: GoReplay (replay HTTP traffic), shadow traffic mirroring.

Strategy 4: Standby cache cluster
  Keep a standby Redis cluster that receives all writes (via replication or Pub/Sub).
  During failover: promote standby → no cold cache → instant warmth.
```

---

## Step-by-Step Execution

### Designing a Cache Layer for a Product API

```
Requirement: Product detail page. 100K product catalog. p99 latency must be < 50ms.
Current: PostgreSQL query, p99 = 45ms (at current load). At 10× load: p99 = 450ms.

Step 1: Identify what to cache.
  Cache: product detail by product_id (80% of reads are product lookups)
  Don't cache: inventory count (changes every second, strong consistency required)
              user's cart (user-specific, invalidated frequently)

Step 2: Choose cache pattern.
  Cache-Aside + explicit invalidation on product updates.
  Reason: products update rarely (< 10/day), reads are frequent (millions/day).
  Write-through adds latency to product updates (uncommon) to benefit reads (common).

Step 3: Choose TTL.
  Product data changes: max once per hour in normal operation.
  Acceptable staleness: 5 minutes (display may lag behind actual price for 5 min).
  TTL: 300 seconds + jitter(±30s)

Step 4: Choose eviction policy.
  allkeys-lfu: hot products (iPhone, etc.) stay; niche products evicted.
  Memory limit: 2 GB Redis instance → at ~5 KB per cached product: ~400K products
  (4× more than catalog size → entire catalog fits in cache if needed).

Step 5: Implement stampede prevention.
  Use Redis SETNX lock on cache miss + 50ms stale-while-revalidate.
  Lock TTL: 5 seconds (max time to query DB and populate cache).

Step 6: Implement invalidation.
  On product update: redis.delete(f"product:{product_id}")
  Add CDC (Debezium) as backup: WAL change → Kafka → invalidation consumer.
  (Belt-and-suspenders: both application-level AND CDC-driven invalidation.)

Step 7: Monitor.
  Prometheus metrics (via redis_exporter):
    redis_keyspace_hits_total / (hits + misses) → hit rate (target: > 95%)
    redis_evicted_keys_total → eviction rate (alert if > 0 on warm cache)
    redis_memory_used_bytes → memory pressure
    redis_commands_duration_seconds → command latency
  
  Alert: cache hit rate < 90% for > 5 minutes → investigate
  Alert: eviction rate > 0 → memory limit too small, or cache is full of cold keys
```

---

## Deep Dive

### Redis MULTI/EXEC — Optimistic Transactions

Redis transactions (MULTI/EXEC) are NOT the same as SQL transactions:

```python
# MULTI/EXEC: queue commands, execute atomically (no interleaving)
pipe = redis.pipeline()
pipe.multi()
pipe.incr("account:A")
pipe.decr("account:B")
results = pipe.execute()
# Commands execute atomically — no other command runs between INCR and DECR
# BUT: if "account:A" doesn't exist, INCR creates it at 1 — no conditional logic

# WATCH: optimistic concurrency (compare-and-swap)
with redis.pipeline() as pipe:
    while True:
        try:
            pipe.watch("account:balance")      # watch the key
            balance = int(pipe.get("account:balance"))
            
            if balance < 100:
                raise InsufficientFunds()
            
            pipe.multi()
            pipe.decrby("account:balance", 100)
            pipe.execute()                     # fails if balance was modified since WATCH
            break
        except redis.WatchError:
            continue  # retry if another client modified balance between WATCH and EXECUTE
```

**WATCH semantics:** If any WATCHed key is modified between `WATCH` and `EXECUTE`, the entire transaction is aborted (returns None). This is Optimistic Concurrency Control at the Redis level.

### Redis Lua Scripts — True Atomicity

For complex atomic operations that MULTI/EXEC can't express (conditional logic):

```lua
-- Lua script: atomic check-and-set (rate limiter)
-- KEYS[1]: rate limit key (e.g., "rate:user:789:minute")
-- ARGV[1]: limit (e.g., "100")
-- ARGV[2]: window (e.g., "60")
-- Returns: 1 if allowed, 0 if rate limited

local current = redis.call('INCR', KEYS[1])
if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[2])
end
if current > tonumber(ARGV[1]) then
    return 0  -- rate limited
end
return 1  -- allowed
```

```python
# Register script for efficiency (script SHA cached server-side):
rate_limit_script = redis.register_script("""
    local current = redis.call('INCR', KEYS[1])
    if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
    if current > tonumber(ARGV[1]) then return 0 end
    return 1
""")

def check_rate_limit(user_id: str, limit: int = 100, window: int = 60) -> bool:
    key = f"rate:{user_id}:{int(time.time() // window)}"
    result = rate_limit_script(keys=[key], args=[limit, window])
    return result == 1
```

Lua scripts execute atomically in Redis — no other command can interleave. The entire script is a single atomic operation from the perspective of all other clients.

---

## Real-World Example

### Facebook's Memcache at Scale (McRouter)

Facebook's original caching paper ("Scaling Memcache at Facebook," 2013) describes caching at a scale almost no other system reaches.

**Architecture:**
- Hundreds of Memcache servers per region
- McRouter: a proxy that routes cache requests to the right server, handles replication, and provides thundering herd protection
- Multiple regions: cache replication lag across regions = source of consistency challenges

**Key insights from the paper:**

**1. Lease mechanism (thundering herd prevention):**
```
On cache miss: Memcache issues a "lease token" to the requesting client.
Only the lease holder can SET the key.
Other clients that miss the same key: wait or get a stale value (if available).

This is Facebook's solution to both:
  - Cache stampede: only one client queries DB per miss
  - Stale sets: a client with a stale DB value can't overwrite a newer value
               (its lease is invalidated when the key is updated by another client)
```

**2. Gutter pool:**
```
When a Memcache server fails, all its traffic becomes cache misses → DB hammered.
Gutter pool: a small set of standby servers (1% of total capacity).
On miss: check gutter pool → if still miss, go to DB → cache result in gutter pool.
Gutter pool absorbs the miss burst; DB is not overwhelmed during server failure.
```

---

## Failure Scenarios

### Scenario 1: Redis OOM — Cache Evicting Critical Data

```
Redis maxmemory: 8 GB. allkeys-lru eviction.
Cache stores:
  - User sessions: 2M sessions × 500 bytes = 1 GB
  - Product catalog: 100K products × 5 KB = 500 MB
  - Rate limit counters: 500K users × 100 bytes = 50 MB
  - Real-time analytics: accumulating event counts, 500K keys × 2 KB = 1 GB
  - Large query result caches: 10K queries × 200 KB = 2 GB

Total: 4.55 GB — under the 8 GB limit.

Black Friday traffic spike: analytics keys grow 10×:
  Analytics: 5M events × 2 KB = 10 GB → total 15 GB → exceeds maxmemory.
  
LRU eviction begins:
  Analytics keys: accessed continuously (recent) → not evicted
  Session keys: accessed continuously (each user's session) → not evicted
  Product catalog: mostly read (hot keys stay), cold products evicted
  Rate limit counters: frequently accessed → not evicted
  
  Evicted: cold product catalog entries → cache miss on product pages → DB reads spike
  Product DB: overwhelmed → latency climbs → timeouts → incident.

Root cause:
  1. No separation between session storage and ephemeral analytics storage.
  2. Analytics should have been a separate Redis instance (or not cached in Redis at all).
  3. No memory pressure alerting.

Fix:
  1. Separate Redis clusters: session store (persistent), product cache, analytics.
  2. Analytics: use Redis Streams with MAXLEN (cap the stream size).
  3. Alert: redis_memory_used_bytes > 85% of maxmemory → investigate.
  4. Use OBJECT ENCODING and SCAN to audit memory distribution.
```

### Scenario 2: Cache Stampede Taking Down the Database

```
Tuesday 2:00 AM: Redis restarts due to OS upgrade (scheduled maintenance).
Redis: cold start. 0 keys in cache.

2:01 AM: Normal overnight traffic (~5,000 RPS) hits the system.
  100% cache miss rate (cache is cold).
  5,000 concurrent DB queries/second.
  PostgreSQL max_connections: 200.
  Connection pool: 200 connections × 25ms average query = 8,000 queries/second capacity.
  Actual: 5,000 RPS × 3 DB queries per request = 15,000 queries/second needed.
  DB: connection pool exhausted. New requests: "connection timeout" after 3 seconds.
  
2:02 AM: Connection timeouts → service returns 500 errors.
2:03 AM: Alert fires: error rate > 1%.
2:05 AM: On-call engineer wakes up.
2:15 AM: Cache is warm enough (10 minutes of traffic has populated hot keys).
  Hit rate: 70%. DB load: manageable. Service recovers.
2:30 AM: Cache fully warm (95% hit rate). Incident resolved.

Total impact: 30 minutes of degraded service at 2 AM (low-traffic period).
At peak hours: same restart would cause 2-4 hours of total outage.

Prevention:
  1. Redis persistence (RDB): restart from snapshot → cache is not cold.
     RDB restores last snapshot (e.g., from 15 minutes before restart).
     After restart: 80% of hot keys already in cache.
  
  2. Cache warming script: before directing traffic to new Redis, warm top 10K product pages.
  
  3. Circuit breaker on DB connection pool: if pool utilization > 80%, start returning
     cached (potentially stale) responses or 503 with Retry-After.
  
  4. Maintenance window: schedule Redis restarts at lowest-traffic time with
     pre-warming in place.
```

---

## Performance Considerations

### Redis Throughput — Single Instance Limits

```
Redis (single-threaded command processing, I/O-multithreaded since 6.0):
  GET/SET:          ~100,000-500,000 operations/second per instance
  Pipelined GET/SET: ~1,000,000 operations/second (reduced network round trips)
  Complex operations (ZADD, ZRANGEBYSCORE): ~50,000-200,000/second
  Pub/Sub:          ~1,000,000 messages/second (simple forwarding)

Pipelining (batching multiple commands):
  Without pipeline: each command = 1 RTT (0.5ms × 100 commands = 50ms)
  With pipeline:    100 commands = 1 RTT (0.5ms total for 100 commands)
  
  Python example:
    pipe = redis.pipeline(transaction=False)  # no MULTI/EXEC overhead
    for key in keys:
        pipe.get(key)
    results = pipe.execute()  # 1 network round trip for all GETs
    # vs: 100 separate redis.get(key) calls = 100 RTTs

Connection pooling (Redis client):
  Don't create a new connection per request (expensive: TCP handshake + Redis AUTH).
  Use connection pool: redis.ConnectionPool(max_connections=50).
  Typical: 10-50 connections to Redis per app instance (Redis handles each in microseconds).
```

### Memory Optimization

```
Redis memory per key (overhead):
  Each key: ~50-100 bytes overhead (key string + metadata + dict entry)
  
  1 million keys × 100 bytes overhead = 100 MB just for key metadata!
  
Optimization 1: Use hashes for many small objects instead of separate keys
  BAD:  SET user:789:name "Alice"     (1 key, ~120 bytes total for 5-byte value)
        SET user:789:email "a@b.com"   (1 key, ~130 bytes)
        SET user:789:age "30"          (1 key, ~110 bytes)
  GOOD: HSET user:789 name Alice email a@b.com age 30  (1 key, ~180 bytes for all fields)
  
  For hash entries < 128 fields and values < 64 bytes:
  Redis uses ziplist encoding internally → ~10 bytes per field-value pair (very efficient)
  
Optimization 2: Use integer IDs instead of string keys where possible
  "user:789" vs 789 (pure integer) → integer stored as ~8 bytes; string "user:789" = 8 bytes + overhead

Optimization 3: OBJECT ENCODING key → check current encoding
  Redis auto-selects encoding (ziplist, listpack, hashtable, skiplist, etc.) based on size.
  listpack/ziplist: compact, CPU-efficient for small structures.
  When size exceeds thresholds, converts to more memory-intensive encoding.
  Tuning: hash-max-listpack-entries 128, hash-max-listpack-value 64 in redis.conf.
```

---

## Trade-offs

| Pattern | Consistency | Write Latency | Read Latency on Miss | Failure Mode |
|---------|-------------|---------------|---------------------|--------------|
| Cache-Aside | Eventual (TTL) | Low (no cache write) | High (3 hops) | Graceful (falls back to DB) |
| Write-Through | Strong | High (both writes) | Low (pre-warmed) | Dual-write failure risk |
| Write-Behind | Weak (async) | Lowest | Low | Data loss on cache failure |
| Read-Through | Eventual | Low | Medium (cache populates) | Cache failure = service failure |

| Invalidation | Freshness | Complexity | Failure Risk |
|-------------|-----------|------------|--------------|
| TTL only | Eventually fresh | Lowest | Stale for TTL duration |
| Explicit delete | Near-instant | Low | Race condition risk |
| Event-driven (CDC) | Near-instant | High | Infrastructure dependency |
| Version-based keys | Instant | Medium | Key sprawl |

---

## Production Considerations

1. **Set `maxmemory` and an eviction policy explicitly.** Never let Redis run with `maxmemory 0` (unlimited) in production — OOM kill will crash Redis silently. Set `maxmemory` to 80% of available RAM, `maxmemory-policy allkeys-lfu` for general caches.
2. **Always use a TTL.** Every cache key must have an expiry. Keys without TTL live forever, accumulate over deployments, and fill memory with stale data. The only exception: intentional permanent data in Redis-as-database.
3. **Deploy Redis Sentinel or Redis Cluster for HA.** A single Redis instance is a single point of failure. Redis Sentinel: monitors a primary-replica setup, auto-promotes replica on primary failure (typically < 30 seconds). Redis Cluster: sharding + HA in one.
4. **Monitor hit rate continuously.** `redis_keyspace_hits / (hits + misses)`. Target: > 90% for a warmed cache. A drop below 80% means cache is undersized, TTL is too short, or there's a systematic miss pattern.
5. **Separate Redis instances by purpose.** Session store, product cache, rate limiting, Pub/Sub, and analytics should run on separate Redis instances. Mixed workloads compete for memory and eviction policy conflicts cause subtle bugs (session keys evicted by LRU during a product catalog warm-up).
6. **Use `SCAN` instead of `KEYS` in production.** `KEYS *` blocks the single-threaded Redis event loop for the entire duration — at 10M keys, this can block for 2-3 seconds, causing timeouts for all other clients. `SCAN` iterates incrementally: `SCAN 0 COUNT 100` returns 100 keys at a time and never blocks.

---

## Common Beginner Mistakes

1. **Using Redis without a TTL and then wondering where the memory went.** Six months of deployments, each caching new keys, none expiring. Redis at 95% memory. Eviction begins randomly removing live session data. Users logged out. Set TTLs.
2. **`KEYS *` in production** — blocks Redis event loop. Causes all clients to timeout during the scan. Use `SCAN` with a cursor.
3. **Not handling cache stampede on high-traffic endpoints.** First deploy works fine (cache warm). Cache TTL expires at peak traffic → DB hammered → incident. Add singleflight/mutex or stale-while-revalidate from day one on high-read endpoints.
4. **Caching user-specific data with a shared key.** `SET product:p123:price 99.99` is correct. `SET user_dashboard_data <all_users_mixed>` is a data exposure bug. Cache keys must be scoped to the correct entity.

---

## Common Senior Engineer Mistakes

1. **Write-through cache without handling dual-write failure.** "DB write succeeded, cache write failed" → cache has stale data permanently (until TTL). The correct pattern: write DB → on cache write failure, DELETE the cache key (not update it) → next read will miss and reload fresh data. Stale-for-one-request is safer than stale-forever.
2. **Using Redis MULTI/EXEC (transactions) thinking it provides atomicity like SQL.** Redis MULTI/EXEC queues commands and executes them without interleaving — it does NOT provide conditional execution. `EXEC` always runs all queued commands regardless of intermediate results. For conditional logic: use Lua scripts.
3. **Not separating cache warming from cache invalidation.** Warming fills the cache on cold start. Invalidation removes stale entries. Conflating them leads to systems that can warm up but can't invalidate, or invalidate entries that were never stale.
4. **Assuming Redis Cluster provides unlimited horizontal scale.** Redis Cluster helps with memory scaling (more nodes = more RAM). But a single-key hot spot (one product page with 100K RPS) is still bottlenecked by the single primary node owning that slot. For extreme single-key throughput: replicated reads (`READONLY` from replicas), key sharding (product:p123:shard:{0-99}), or client-side in-process caching.

---

## Architecture Smells

- **No `maxmemory` configuration** → Redis grows until OOM → process killed → cold cache → avalanche
- **`KEYS *` in production code** → Redis freeze under load → cascading timeout
- **No TTL on any cache key** → memory fills with stale data → random eviction of live data
- **Single Redis instance with no replica** → Redis restart = cold cache = stampede
- **Cache bypass on every write** (never invalidating) → stale cache grows without bound
- **Caching at the wrong layer**: caching inside a microservice AND at the API gateway → double memory cost, inconsistent invalidation, confused freshness semantics

---

## Principal Engineer Perspective

Caching is a systems design tool, not an optimization trick. When you add a cache, you are introducing:
1. **A new failure mode:** cache unavailability (stampede, avalanche, OOM)
2. **A consistency contract:** data may be stale by up to TTL (or more, with bugs)
3. **A new data store:** Redis must be operated, monitored, backed up, sized
4. **A security surface:** cache poisoning, cache key injection

These costs are usually worth paying — but they must be paid deliberately, not accidentally.

**The Principal Engineer's cache design questions:**

1. **What is the acceptable staleness for this data?** For inventory counts in a checkout: 0 seconds (don't cache). For product descriptions: 5 minutes. For homepage hero image: 24 hours. The answer drives TTL, invalidation strategy, and even whether to cache at all.

2. **What happens when the cache is empty (cold)?** Design the fallback path first. If the fallback (DB load) cannot handle 100% of traffic, the cache is a required load-shedding mechanism — not an optimization. Treat it like critical infrastructure. HA, monitoring, and capacity planning accordingly.

3. **What happens when the cache has wrong data?** Define the blast radius. If product prices are wrong for 5 minutes: customer service handles returns. If account balances are wrong: financial liability. The blast radius determines how aggressively to invest in cache correctness.

4. **Who is responsible for invalidating this data?** Document it. In a microservices architecture, service A writes user data, service B caches it. When A updates, who invalidates B's cache? Application-level invalidation (A calls B's cache invalidation API) is fragile. CDC-driven invalidation (WAL → Kafka → B's cache consumer) is more reliable but requires infrastructure.

5. **Is caching hiding a database problem?** Sometimes teams add caching when what they actually need is an index. A query that takes 2 seconds without an index takes 2ms with one — no cache needed. Before caching, profile: is this slow because of missing index, expensive JOIN, or genuinely high load? Cache is the right tool for high load; indexes are the right tool for slow queries.

---

## Architecture Review Questions

1. What is the cache hit rate for each major read path? Is it > 90%?
2. Is `maxmemory` set? Is the eviction policy appropriate for the workload?
3. Does every cache key have a TTL? Are TTLs jittered to prevent coordinated expiry?
4. What happens when Redis is unavailable? Does the service degrade gracefully (fallback to DB) or fail completely?
5. Is there stampede prevention on the highest-traffic cache keys?
6. How is cache invalidation handled for each write path? Is it explicit, TTL-only, or CDC-driven?
7. Is Redis deployed with replication (Sentinel) or clustering (Cluster) for HA?
8. Are different workloads (sessions, product cache, rate limiting) on separate Redis instances?
9. Are `KEYS *` and blocking `SCAN` operations absent from production code?
10. What is the warm-up strategy after a Redis restart or a new deployment?

---

## Visual / Animation Specification

### Animation 1: Cache Stampede and Singleflight Prevention

**Setup:** One Redis (empty, key expired), one Database, 100 client requests shown as arrows.

**Without prevention:**
All 100 arrows hit Redis simultaneously → all bounce back (MISS, red). All 100 arrows then hit Database → Database label turns red, "OVERLOADED." 97 arrows timeout (red X). 3 arrows return late.

**With singleflight:**
All 100 arrows hit Redis → all bounce (MISS). One arrow (highlighted green) acquires lock on Redis ("LOCK acquired"). 99 arrows wait at Redis (shown as a queue).
Lock-holder arrow hits Database → returns value (green). Writes to Redis cache (green flash). Releases lock.
99 waiting arrows re-check Redis → all HIT → all return immediately.
Database: 1 request total.

**Caption:** "100 requests, 1 DB query. Singleflight = 100× DB load reduction on cache miss."

### Animation 2: Cache Eviction Policies — LRU vs LFU

**Cache with 5 slots. Access pattern shown as a timeline.**

**LRU column:**
Fill cache with A, B, C, D, E (all accessed once).
New item: F. LRU evicts: E (least recently used).
Then: batch job accesses X, Y, Z, W, V (5 new items, each once).
After batch: A, B, C, D all evicted (not recently accessed, despite being "hot" before the batch).
Next request for A: MISS. Request for B: MISS. Hot items gone.

**LFU column:**
Same fill: A (100 accesses), B (80), C (60), D (40), E (20).
Batch job accesses X, Y, Z, W, V (1 access each).
LFU: evicts X, Y, Z, W, V (frequency=1) before evicting E (frequency=20).
After batch: A, B, C, D, E all still cached.
Next request for A: HIT. B: HIT.

**Caption:** "LRU: batch jobs destroy the hot cache. LFU: hot data survives batch scans."

---

## Hands-On Tutorial

### Redis Data Structures Exploration

```bash
# Start Redis (Docker):
docker run -d --name redis -p 6379:6379 redis:7-alpine
docker exec -it redis redis-cli

# 1. String operations:
SET user:789:name "Alice" EX 3600
GET user:789:name
INCR page:views:home
INCRBY page:views:home 5
TTL user:789:name

# 2. Hash — user profile:
HSET user:789 name "Alice" email "alice@example.com" tier "premium" loginCount 0
HGET user:789 name
HGETALL user:789
HINCRBY user:789 loginCount 1
OBJECT ENCODING user:789   # → listpack (compact, <128 fields, <64 bytes each)

# 3. Sorted Set — leaderboard:
ZADD leaderboard 9500 "user:789"
ZADD leaderboard 8200 "user:123"
ZADD leaderboard 9750 "user:456"
ZREVRANGE leaderboard 0 9 WITHSCORES  # top 10
ZREVRANK leaderboard "user:789"        # rank of user:789 (0-indexed from top)
ZINCRBY leaderboard 500 "user:789"    # add 500 points

# 4. Rate limiting with Lua:
EVAL "
  local current = redis.call('INCR', KEYS[1])
  if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
  if current > tonumber(ARGV[1]) then return 0 end
  return 1
" 1 "rate:user:789" 5 60
# → 1 (allowed). Run 5 times → returns 0 (rate limited)

# 5. Monitor eviction:
CONFIG SET maxmemory 1mb
CONFIG SET maxmemory-policy allkeys-lfu
# Insert data until eviction kicks in:
for i in $(seq 1 10000); do redis-cli SET "key:$i" "value:$i" EX 300; done
INFO memory | grep used_memory_human
INFO stats | grep evicted_keys
```

### Cache-Aside Implementation (Python)

```python
import redis
import json
import time
import random
from functools import wraps

r = redis.Redis(host='localhost', port=6379, decode_responses=True)

class CacheAside:
    def __init__(self, redis_client, default_ttl=300):
        self.redis = redis_client
        self.default_ttl = default_ttl
    
    def get_or_load(self, key: str, loader, ttl: int = None, jitter: int = 30):
        """Get from cache or load from source, with stampede prevention."""
        ttl = ttl or self.default_ttl
        
        # 1. Check cache
        cached = self.redis.get(key)
        if cached == "__MISS__":
            return None  # cached negative
        if cached:
            return json.loads(cached)
        
        # 2. Stampede prevention: acquire lock
        lock_key = f"lock:{key}"
        lock_acquired = self.redis.set(lock_key, "1", nx=True, ex=10)
        
        if not lock_acquired:
            # Another request is loading. Wait and retry.
            time.sleep(0.05)
            return self.get_or_load(key, loader, ttl, jitter)
        
        try:
            # 3. Load from source
            value = loader()
            
            # 4. Cache result (with jitter)
            actual_ttl = ttl + random.randint(-jitter, jitter)
            if value is None:
                self.redis.setex(key, 60, "__MISS__")  # cache negative for 60s
            else:
                self.redis.setex(key, actual_ttl, json.dumps(value))
            
            return value
        finally:
            self.redis.delete(lock_key)
    
    def invalidate(self, key: str):
        self.redis.delete(key)

# Usage:
cache = CacheAside(r)

def get_product(product_id: str):
    return cache.get_or_load(
        key=f"product:{product_id}",
        loader=lambda: db.query("SELECT * FROM products WHERE id=?", product_id),
        ttl=300
    )

def update_product(product_id: str, price: float):
    db.execute("UPDATE products SET price=? WHERE id=?", price, product_id)
    cache.invalidate(f"product:{product_id}")
```

---

## Exercises

**Conceptual:**
1. Explain the physics of why a Redis cache hit is 50× faster than a PostgreSQL query. What physical resources are involved in each?
2. Compare Cache-Aside and Write-Through. For an e-commerce product pricing service (reads: 1M/day, updates: 5/day), which pattern is better? Justify your answer.
3. What is a cache stampede? Describe three techniques to prevent it.
4. What is a cache avalanche? How does it differ from a stampede? How is it prevented?
5. Explain the race condition in cache invalidation (the "stale set" problem). How does version-based cache keys prevent it?

**Architecture:**
6. Design a cache strategy for a social media "trending topics" feature. The list changes every 5 minutes. 100M users request it. Define: what to cache, TTL, invalidation strategy, stampede prevention.
7. A team is caching user sessions in Redis with no TTL. Six months later, Redis is at 95% memory and evicting live sessions randomly. Design the correct session caching strategy.
8. Design a multi-level cache: L1 = in-process (application heap), L2 = Redis, L3 = database. Define the TTL for each level, the population strategy, and the invalidation propagation.

**Quantitative:**
9. Redis cache: 95% hit rate, 1M RPS. Cache miss: DB query = 10ms. Cache hit: Redis = 0.5ms. Calculate: average latency, total DB queries per second, and how average latency changes if hit rate drops to 80%.
10. Redis instance: 8 GB maxmemory. Average cache entry: 2 KB (key + value + overhead). How many entries can it hold? If your product catalog has 500K products and average page cache is 8 KB, will the catalog fit? What eviction policy preserves the hottest 10% of products?

---

## Solutions

### Exercise 9

**At 95% hit rate:**
- Cache hits: 1M × 0.95 = 950K RPS → 0.5ms each
- Cache misses: 1M × 0.05 = 50K RPS → 10ms each
- Average latency = 0.95 × 0.5ms + 0.05 × 10ms = 0.475 + 0.5 = **0.975ms**
- DB queries per second: **50,000 RPS**

**At 80% hit rate:**
- Cache hits: 800K RPS → 0.5ms
- Cache misses: 200K RPS → 10ms
- Average latency = 0.80 × 0.5ms + 0.20 × 10ms = 0.4 + 2.0 = **2.4ms** (2.5× worse)
- DB queries per second: **200,000 RPS** (4× increase!)

Insight: a 15-point drop in hit rate (95%→80%) causes a 4× increase in DB load and 2.5× increase in average latency. Cache hit rate is the single most important metric to protect.

### Exercise 10

**Entries that fit:**
8 GB = 8,192 MB = 8,388,608 KB. At 2 KB per entry: **4,194,304 entries** (~4.2M).

**Product catalog (8 KB each):**
500K × 8 KB = 4,096 MB = 4 GB. Fits in 8 GB (uses 50% of capacity). ✅

**Eviction policy:** `allkeys-lfu`. The hottest 10% (50K products) are accessed orders of magnitude more frequently than the cold 90%. LFU will retain them even during cold bulk operations. LRU would evict them during any sequential scan.

---

## Interview Questions

### Beginner
- What is a cache? Why do we use caches in distributed systems?
- What is a cache miss? What happens when a cache miss occurs in the cache-aside pattern?
- What does TTL mean in caching? Why is it important?

### Senior
- Explain the cache-aside pattern. What are its trade-offs vs write-through?
- What is a cache stampede? How would you prevent it?
- Compare Redis and Memcached. When would you choose each?
- What eviction policies does Redis support? When would you use LFU over LRU?

### Staff
- Design the caching strategy for a product recommendation API that serves 5M RPS, where recommendations are personalized per user and change hourly.
- Explain cache invalidation strategies. What is the "stale set" race condition and how do you prevent it?
- Walk through how you would design a rate limiter using Redis Sorted Sets. What are the consistency guarantees?

### Principal
- A service's p99 latency is 800ms. You add Redis caching. Hit rate is 95%, miss latency is 800ms. What is the new p99? Now the cache is down — what happens? How do you design for cache unavailability?
- Design the complete caching architecture for a global e-commerce platform: 500M users, 10M products, 1B RPS at peak, multi-region. Define: which data to cache, at what layer, with what consistency guarantees, and how to handle cache failures in each region.
- A team added Redis caching 6 months ago. Since then, the database has received steadily increasing load (currently at 90% capacity) despite the cache having a 95% hit rate. What are the three most likely explanations, and how would you diagnose each?

---

## Summary

Caching is the fundamental trade between consistency and performance:

- **Redis data structures:** String (KV, counters), Hash (objects), List (queues), Set (membership), ZSet (ranked sets, rate limiting), HLL (approximate counting), Stream (event log). Each is a different atomic primitive for distributed coordination.
- **Cache patterns:** Cache-Aside (lazy, graceful degradation), Write-Through (consistent, dual-write risk), Write-Behind (fastest writes, data loss risk), Read-Through (simple API, tight coupling).
- **Eviction:** LRU for recency-biased workloads; LFU for frequency-biased workloads (more scan-resistant). Always set `maxmemory` and an explicit policy.
- **TTL:** Every key needs one. Jitter to prevent synchronized expiry (avalanche prevention).
- **Invalidation:** TTL-only (simple, eventual freshness), explicit delete (fast, race condition risk), CDC-driven (reliable, complex infrastructure), version-based keys (clean, key sprawl).
- **Failure modes:** Stampede (mutex/singleflight, XFetch, stale-while-revalidate), Avalanche (TTL jitter, staggered warm-up), Poisoning (validate before caching, version-based keys).
- **Redis Cluster:** 16,384 hash slots, consistent hashing, automatic resharding. Limitations: no cross-slot transactions, hot-key still a single-node bottleneck.

---

## What You Should Now Be Able To Explain

- ✅ Why the physics of memory access make caching a 50-500× improvement
- ✅ When to choose Cache-Aside vs Write-Through and what each sacrifices
- ✅ How cache stampede works and three concrete prevention techniques
- ✅ Why LFU is superior to LRU for production caches with mixed hot/cold patterns
- ✅ The stale-set race condition in cache invalidation and how to prevent it
- ✅ How Redis Cluster distributes data across nodes and the multi-key operation limitation

---

## What To Learn Next

**Chapter 15 — Service Mesh and Microservice Communication.** You now understand how individual services store and retrieve data efficiently. Chapter 15 covers how microservices talk to each other: the service mesh (Istio, Linkerd), sidecar proxy pattern, mutual TLS (mTLS) for service-to-service authentication, circuit breaking and retry policies at the mesh level, and distributed rate limiting. This is where the failure modes of Chapter 9 meet the practical infrastructure that prevents them in production Kubernetes environments.
