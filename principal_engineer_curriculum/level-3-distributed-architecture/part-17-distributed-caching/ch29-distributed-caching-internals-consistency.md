# Chapter 29 — Distributed Caching Internals & Consistency: Redis, Memcached, and Cache Invalidation at Scale

> **Difficulty:** Advanced | **Importance:** ★★★★★ | **Estimated Reading Time:** 4.5 hours

---

## Prerequisites

- Chapter 14 (Caching Patterns — cache-aside, write-through, read-through, LRU/LFU)
- Chapter 24 (Consistent Hashing and Virtual Nodes)
- Chapter 7 (Storage Engines — skip lists, hash tables, memory layout)
- Chapter 8 (Consistency, CAP Theorem, linearizability)
- Chapter 27 (Messaging & Kafka — for CDC-driven invalidation)

---

## Learning Objectives

By the end of this chapter, you will be able to:

1. Explain the XFetch probabilistic early expiration algorithm and implement it in production code
2. Design a multi-tier (L1 + L2) caching architecture that survives hot key attacks
3. Describe the cache consistency race condition under concurrent writes and propose three mitigation strategies
4. Implement CDC-driven cache invalidation using Debezium and Kafka
5. Explain Redis internal data structure encodings and the thresholds that trigger encoding promotion
6. Analyze the Memcached slab allocator vs Redis jemalloc and their production failure modes
7. Design a cache sharding strategy using consistent hashing with virtual nodes
8. Identify all four cache failure patterns (stampede, penetration, avalanche, hot key) and their mitigations

---

## Why This Matters

Phil Karlton's famous observation — "There are only two hard things in Computer Science: cache invalidation and naming things" — is funny precisely because it is true. Every senior engineer has been bitten by stale cache data at 2am. Every principal engineer has stared at a database melting down because 50,000 simultaneous requests decided the cache was wrong at the same instant.

Caching is deceptively simple at the surface and catastrophically complex at scale. At 100 requests per second, cache-aside with a five-minute TTL is perfectly adequate. At 500,000 requests per second — the scale of Facebook's social graph, Twitter's timeline fan-out, or Shopify's product catalog during Black Friday — the same naive approach produces:

- **Cache stampedes** that kill your database during recovery
- **Cache avalanches** that cascade into total service outages
- **Cache penetration** attacks that bypass your cache entirely
- **Hot key contention** that serializes 40% of your traffic through a single Redis node
- **Consistency windows** that serve stale prices, wrong inventory counts, or deleted users

This chapter goes significantly deeper than Chapter 14's introduction. We examine the internal data structures Redis uses, how XFetch solves the thundering herd probabilistically without coordination, how CDC-driven invalidation achieves eventual consistency without dual-write races, and why Facebook built TAO — a purpose-built distributed cache — rather than tolerating Redis at social-graph scale.

---

## Mental Model

***A cache is not a reliable store of truth. It is a probabilistic acceleration layer — a bet that recently-computed answers will remain valid long enough to serve future requests. Every caching decision is a trade-off between read performance and consistency, bounded by the physics of memory hierarchies. The art of distributed caching is precisely managing the window of staleness: wide enough to absorb traffic, narrow enough to prevent user-visible inconsistency.***

---

## The Physics That Make Caching Necessary

Before examining strategies and algorithms, we must understand *why* caches exist at a physical level. This is not mere background — it explains every design decision that follows.

### Memory Hierarchy Latencies (2024 Numbers)

```
Storage Layer          Latency        Bandwidth     Capacity
─────────────────────────────────────────────────────────────
L1 Cache (CPU)         0.3 ns         1,000 GB/s    256 KB
L2 Cache (CPU)         1.0 ns         400 GB/s      1 MB
L3 Cache (CPU)         10 ns          200 GB/s      32 MB
DRAM (RAM)             60-100 ns      50 GB/s       512 GB
NVMe SSD               100 µs         7 GB/s        8 TB
Network (same DC)      100-500 µs     25 Gbps       —
HDD                    10 ms          200 MB/s      20 TB
Network (cross-region) 30-150 ms      Variable      —
─────────────────────────────────────────────────────────────
```

A Redis GET/SET hitting DRAM costs ~100 µs. A PostgreSQL query hitting disk costs 10-100 ms. A 100x difference. At 10,000 RPS, that difference means the choice between 10 database servers or 1. At 500,000 RPS, it means the choice between 500 database servers (infeasible) or a caching tier (necessary).

The hierarchy explains cache topology: L1 (CPU cache, managed by hardware), L2 (in-process application memory, 0 network hops), L3 (shared distributed cache like Redis, one network hop), persistent store (database, potentially disk I/O). Every tier exists because the tier below it is too slow or too expensive for the workload above it.

---

## Visual Explanation: Cache Architecture Tiers

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Request Path (Read)                           │
│                                                                     │
│  Client Request                                                     │
│       │                                                             │
│       ▼                                                             │
│  ┌─────────────┐                                                    │
│  │ Application │  L1 Cache: In-process HashMap                     │
│  │  Instance   │  - 0 network hops, <1 µs access                   │
│  │  [L1 Cache] │  - ~10,000 entries, 100 MB max                    │
│  └──────┬──────┘  - Caffeine/Guava (Java), lru-cache (Go)          │
│         │ Miss                                                      │
│         ▼                                                           │
│  ┌─────────────────────────────────────────────────────┐           │
│  │              Redis Cluster (L2 Cache)               │           │
│  │                                                     │           │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │           │
│  │  │ Node 1   │  │ Node 2   │  │ Node 3   │         │           │
│  │  │ Slots    │  │ Slots    │  │ Slots    │         │           │
│  │  │ 0-5460   │  │ 5461-    │  │ 10923-   │         │           │
│  │  │          │  │ 10922    │  │ 16383    │         │           │
│  │  └──────────┘  └──────────┘  └──────────┘         │           │
│  │                                                     │           │
│  │  ~200 µs access, 100 GB capacity per node          │           │
│  └──────────────────────┬──────────────────────────────┘           │
│                         │ Miss                                      │
│                         ▼                                           │
│  ┌─────────────────────────────────────────────────────┐           │
│  │           PostgreSQL / MySQL (Source of Truth)      │           │
│  │                                                     │           │
│  │  Primary ──── Replica ──── Replica                 │           │
│  │                                                     │           │
│  │  ~10-50 ms access (with index), ~100 ms (disk I/O) │           │
│  └─────────────────────────────────────────────────────┘           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

Cache Hit Rates and Impact:
  L1 Hit:  saves ~200 µs (Redis hop) + up to 50 ms (DB) per request
  L2 Hit:  saves up to 50 ms (DB) per request
  Miss:    full 50 ms DB path, write result back to L2 (and L1)
```

---

## Core Concepts

### 1. Cache Topology Patterns (Review + Depth)

Chapter 14 introduced the four patterns. Here we examine their consistency properties and failure modes in depth.

#### Cache-Aside (Lazy Loading)

```
Read:   Check cache → Miss → Read DB → Write cache → Return
Write:  Write DB → Invalidate (or update) cache
```

**Race condition under concurrent writes:**

```
Thread A                          Thread B
─────────────────────────────────────────────
1. Read DB → value = "old"
                                  2. Write DB → value = "new"
                                  3. Invalidate cache key
4. Write cache → value = "old"   ← STALE DATA written AFTER invalidation
```

This is the fundamental cache consistency race. Thread A's cache write happens *after* Thread B's invalidation, leaving a permanently stale entry until TTL expiry. Solutions:
- **Short TTL** (accept bounded staleness)
- **Compare-and-swap on cache write** (only write if cache key still absent)
- **Version-tagged cache writes** (include DB row version, cache rejects older versions)
- **CDC-driven invalidation** (discussed in depth later)

#### Write-Through

```
Write:  Write cache + Write DB (synchronously) → Return
Read:   Check cache → Miss → Read DB → Return (no write-back)
```

**Problem:** Every write hits both cache and DB. Write latency doubles. Cache fills with cold data (infrequently-read keys still written to cache on every update). Cache memory is wasted.

**When appropriate:** Heavy read/write ratio (reads >> writes), strong consistency requirement, predictable access patterns.

#### Write-Behind (Write-Back)

```
Write:  Write cache → Acknowledge → Async batch write to DB
Read:   Check cache → Miss → Read DB → Return
```

**Risk:** Cache crash before async flush = data loss. Only suitable for workloads where occasional loss is acceptable (session state, analytics counters, recommendation scores).

**Production trick:** Use Redis Streams as the write-behind queue. Each write appends to a stream; a background consumer batch-flushes to the database. Stream provides durability even if the application crashes.

#### Read-Through

```
Read:   Check cache → Miss → Cache fetches from DB → Return
Write:  Write DB only (cache will self-populate on next read)
```

**Benefit:** Cache itself manages DB loading logic. Application code simplified.  
**Implementation:** Most caching frameworks (Spring Cache, AWS ElastiCache with DAX) implement this natively.

---

### 2. Cache Stampede: The Thundering Herd Problem

When a high-traffic key expires, every thread waiting for that key simultaneously discovers a cache miss and simultaneously fires a database query. If 10,000 threads are waiting for a cache key that expires every 60 seconds, all 10,000 simultaneously hit the database.

```
Timeline of a Cache Stampede:
─────────────────────────────────────────────────────────────────
t=0:00  Cache key "product:42" cached by first request. TTL = 60s
t=0:01  10,000 concurrent readers, all served from cache (fast)
t=1:00  Key expires. 10,000 readers simultaneously discover MISS
t=1:00  All 10,000 readers fire SELECT * FROM products WHERE id=42
t=1:00  Database CPU: 0% → 100% in 50ms
t=1:01  Database connection pool exhausted. Requests queue up.
t=1:02  Requests timeout. Service returns 503.
t=1:03  Monitoring alert fires. On-call engineer wakes up.
─────────────────────────────────────────────────────────────────
```

**This is not a theoretical scenario.** DoorDash, Reddit, and Slack have all published post-mortems describing exactly this failure.

#### Solution 1: Singleflight (Request Coalescing)

The singleflight pattern deduplicates concurrent identical requests: the first request fires the expensive operation, all subsequent concurrent requests wait for the same result.

```go
// Go implementation using golang.org/x/sync/singleflight
package cache

import (
    "context"
    "encoding/json"
    "time"
    
    "golang.org/x/sync/singleflight"
    "github.com/redis/go-redis/v9"
)

type ProductCache struct {
    redis  *redis.Client
    sfg    singleflight.Group
    db     ProductRepository
}

func (c *ProductCache) GetProduct(ctx context.Context, productID int64) (*Product, error) {
    key := fmt.Sprintf("product:%d", productID)
    
    // Try L1 local cache first (not shown for brevity)
    
    // Try Redis L2 cache
    cached, err := c.redis.Get(ctx, key).Bytes()
    if err == nil {
        var product Product
        if err := json.Unmarshal(cached, &product); err == nil {
            return &product, nil
        }
    }
    
    // Cache miss: use singleflight to deduplicate concurrent DB fetches
    // The key "sf:product:42" ensures all concurrent requests for productID=42
    // share exactly one DB query.
    sfKey := fmt.Sprintf("sf:product:%d", productID)
    
    result, err, shared := c.sfg.Do(sfKey, func() (interface{}, error) {
        // This function executes exactly ONCE per unique sfKey,
        // even if 10,000 goroutines call it concurrently.
        product, err := c.db.GetProduct(ctx, productID)
        if err != nil {
            return nil, err
        }
        
        // Populate cache for future requests
        data, _ := json.Marshal(product)
        c.redis.SetEx(ctx, key, data, 5*time.Minute)
        
        return product, nil
    })
    
    if err != nil {
        return nil, err
    }
    
    // Log whether this request was deduplicated
    if shared {
        metrics.Increment("cache.singleflight.coalesced")
    }
    
    return result.(*Product), nil
}
```

**Limitation of singleflight:** It only coalesces requests *within a single process*. If you have 100 application instances, all 100 still hit the database simultaneously on cache expiry. You need distributed singleflight or a different approach.

#### Solution 2: Distributed Lock + Early Lease

```python
import redis
import time
import json

r = redis.Redis()

def get_product_with_lock(product_id: int) -> dict:
    cache_key = f"product:{product_id}"
    lock_key = f"lock:product:{product_id}"
    
    # Try cache first
    cached = r.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # Try to acquire lock (SET NX EX pattern — atomic)
    # Only ONE process across all instances acquires this lock
    lock_acquired = r.set(lock_key, "1", nx=True, ex=10)  # 10s lock TTL
    
    if lock_acquired:
        try:
            # This instance wins the lock: fetch from DB
            product = db.get_product(product_id)
            r.setex(cache_key, 300, json.dumps(product))  # 5 min TTL
            return product
        finally:
            r.delete(lock_key)
    else:
        # Lost the lock: brief sleep + retry (poll for cache population)
        # Problem: this burns CPU and adds latency
        time.sleep(0.05)  # 50ms
        return get_product_with_lock(product_id)  # Retry
```

**Problem:** The polling retry adds latency and the recursive retry can stack up. Better alternatives exist.

#### Solution 3: XFetch — Probabilistic Early Expiration

XFetch (from the paper "Optimal Probabilistic Cache Stampede Prevention" by Vattani, Chierichetti, Lowenstein) is the most elegant stampede prevention mechanism. Instead of expiring all at once, keys begin expiring probabilistically *before* their actual TTL, proportional to how expensive they are to recompute.

**The Algorithm:**

Let:
- $T$ = current time
- $\text{expiry}$ = actual cache expiry timestamp  
- $\delta$ = computation time for the cached value (in seconds)
- $\beta$ = tuning constant (default 1.0, higher = more aggressive early expiration)

**XFetch recompute condition:**

$$T - \delta \times \beta \times \ln(\text{random}()) > \text{expiry}$$

Note: $\ln(\text{random}())$ where `random()` ∈ (0, 1] produces values in $(-\infty, 0]$, so $-\ln(\text{random}())$ is always positive. Thus the formula is equivalent to:

$$\text{expiry} - T < \delta \times \beta \times (-\ln(\text{random}()))$$

When remaining TTL is small, the right side (exponentially distributed) is likely to exceed it, triggering early recomputation. When TTL is large, this is nearly impossible, so no unnecessary early fetches occur.

```python
import math
import random
import time
import json
import redis

r = redis.Redis()

def xfetch_get(
    key: str, 
    compute_fn,           # The expensive DB query
    beta: float = 1.0,
    ttl_seconds: int = 300
) -> any:
    """
    XFetch: Get value from cache with probabilistic early expiration.
    
    Stores TWO values in Redis:
      key        → the cached value
      key:meta   → {"delta": <compute_time>, "expiry": <unix_timestamp>}
    """
    
    # Fetch cached value and metadata atomically
    pipe = r.pipeline(transaction=False)
    pipe.get(key)
    pipe.get(f"{key}:meta")
    cached_value, cached_meta = pipe.execute()
    
    if cached_value and cached_meta:
        meta = json.loads(cached_meta)
        delta = meta["delta"]      # How long the original compute took
        expiry = meta["expiry"]    # When the cache entry actually expires
        
        # XFetch recompute condition
        # random() ∈ (0,1], -ln(random()) > 0 always
        now = time.time()
        recompute_threshold = delta * beta * (-math.log(random.random()))
        remaining_ttl = expiry - now
        
        if remaining_ttl > recompute_threshold:
            # Cache is valid and we're not in the early expiration window
            return json.loads(cached_value)
        # else: fall through to recompute (early expiration triggered)
    
    # Cache miss OR early expiration: recompute
    start = time.time()
    value = compute_fn()
    delta = time.time() - start  # Measure actual compute time
    
    expiry = time.time() + ttl_seconds
    
    # Store value and metadata
    pipe = r.pipeline(transaction=True)
    pipe.setex(key, ttl_seconds, json.dumps(value))
    pipe.setex(f"{key}:meta", ttl_seconds + 10, json.dumps({
        "delta": delta,
        "expiry": expiry
    }))
    pipe.execute()
    
    return value

# Usage
def compute_product(product_id):
    return db.get_product(product_id)  # 50ms DB query

product = xfetch_get(
    key=f"product:{product_id}",
    compute_fn=lambda: compute_product(product_id),
    beta=1.0,
    ttl_seconds=300
)
```

**Why XFetch is superior:**
- **No coordination:** No distributed lock, no network round-trip for lock acquisition
- **Self-tuning:** Keys that are expensive to compute (large δ) get earlier probabilistic recomputation
- **Stampede impossible:** At any given instant, at most a few instances will trigger early recomputation; most continue serving the cached value
- **Zero impact on cache hits:** The math ensures the early expiration window is negligible for keys with large remaining TTL

**Mathematical guarantee:** The probability of two instances simultaneously triggering early expiration decreases exponentially as TTL increases. In practice, with β=1.0 and 300s TTL, you'll see at most 1-2 early recomputations, vs 10,000 stampede queries with naive TTL.

---

### 3. Cache Penetration: The Null Key Attack

Cache penetration occurs when requests deliberately (or accidentally) query keys that never exist in the cache AND never exist in the database. Every such request bypasses the cache and hits the database directly.

```
Attack Pattern:
  GET /product/9999999999999  → Cache miss → DB miss → 404
  GET /product/9999999999998  → Cache miss → DB miss → 404
  GET /product/9999999999997  → Cache miss → DB miss → 404
  (100,000 requests/second, all different non-existent IDs)
  
Result: 100,000 full DB queries/second for keys that don't exist
        Database overloaded, legitimate traffic fails
```

#### Solution 1: Negative Caching (Cache Null Results)

```python
NEGATIVE_CACHE_TTL = 60  # Short TTL for null results (1 minute)
POSITIVE_CACHE_TTL = 300  # Longer TTL for real results

def get_product(product_id: int) -> dict | None:
    key = f"product:{product_id}"
    
    cached = r.get(key)
    if cached is not None:
        if cached == b"__NULL__":
            return None  # Cached negative result
        return json.loads(cached)
    
    # Cache miss: query DB
    product = db.get_product(product_id)
    
    if product is None:
        # Cache the null result to prevent repeated DB queries
        r.setex(key, NEGATIVE_CACHE_TTL, "__NULL__")
        return None
    
    r.setex(key, POSITIVE_CACHE_TTL, json.dumps(product))
    return product
```

**Problem with negative caching:** If an attacker generates millions of unique random IDs, they never hit the negative cache (each ID is different). The cache fills with useless null entries.

#### Solution 2: Bloom Filter Guard

A Bloom filter at the cache layer provides O(1) existence checks with zero false negatives. If the Bloom filter says "key does not exist," we can skip the cache AND the database entirely.

```python
from pybloom_live import BloomFilter

class ProductCache:
    def __init__(self):
        self.bloom = BloomFilter(capacity=10_000_000, error_rate=0.001)
        self.redis = redis.Redis()
        self._load_bloom_from_db()
    
    def _load_bloom_from_db(self):
        """Pre-populate Bloom filter with all valid product IDs."""
        # Run at startup; rebuild periodically (e.g., nightly)
        for product_id in db.get_all_product_ids():
            self.bloom.add(str(product_id))
    
    def get_product(self, product_id: int) -> dict | None:
        # Step 1: Bloom filter check (O(1), in-process, ~0 µs)
        if str(product_id) not in self.bloom:
            # Guaranteed NOT in database (zero false negatives)
            metrics.increment("cache.bloom.reject")
            return None  # Skip cache AND database entirely
        
        # Step 2: Check Redis cache
        key = f"product:{product_id}"
        cached = self.redis.get(key)
        if cached:
            return json.loads(cached)
        
        # Step 3: DB query (now guaranteed to find the product, or it was deleted)
        product = db.get_product(product_id)
        if product:
            self.redis.setex(key, 300, json.dumps(product))
            return product
        
        # Product was deleted after Bloom filter was built
        # Add negative cache entry (small set, only recently-deleted products)
        self.redis.setex(key, 60, "__NULL__")
        return None
    
    def add_product(self, product: dict):
        """Called on product creation — add to Bloom filter."""
        self.bloom.add(str(product["id"]))
        # ... save to DB and cache
```

**Bloom filter sizing for 10 million products at 0.1% false positive rate:**
- $m = -n \ln p / (\ln 2)^2 = -10,000,000 \times \ln(0.001) / (0.693)^2 \approx 143 \text{ MB}$
- $k = (m/n) \ln 2 \approx 10$ hash functions
- 143 MB in process — fits comfortably in application memory
- False positive rate: 0.1% — 1 in 1000 non-existent IDs triggers a DB query (acceptable)

**Distributed Bloom filter in Redis (using RedisBloom module):**

```bash
# Create Bloom filter
BF.RESERVE product:bloom 0.001 10000000

# Add valid product IDs
BF.MADD product:bloom 1001 1002 1003 ...

# Check before cache lookup
BF.EXISTS product:bloom 9999999999999
# Returns 0 → skip cache and DB, return 404 immediately
```

---

### 4. Cache Avalanche: Mass TTL Expiry

Cache avalanche occurs when a large number of cache keys expire simultaneously, causing a flood of DB queries that overwhelms the database.

```
Without Jitter:
  t=0:00  10,000 products cached with TTL = 300s (exactly)
  t=5:00  All 10,000 keys expire simultaneously
  t=5:00  10,000 × (read concurrency) = ~50,000 DB queries in 1 second
  t=5:01  Database: 50,000 QPS → overload → cascade failure

With TTL Jitter:
  t=0:00  10,000 products cached with TTL = 300s ± random(0, 60s)
  t=4:00  First keys expire: ~500 DB queries (steady trickle)
  t=4:30  More keys expire: ~1000 DB queries
  t=5:00  More keys expire: ~1000 DB queries
  t=5:30  Last keys expire: ~500 DB queries
  Result: Peak load reduced by 10x, database stable
```

#### TTL Jitter Implementation

```go
package cache

import (
    "context"
    "math/rand"
    "time"
)

const (
    BaseTTL    = 5 * time.Minute
    JitterRange = 60 * time.Second  // ±60s jitter
)

// JitteredTTL returns a TTL with uniform random jitter applied.
// Prevents thundering-herd on mass cache population events.
func JitteredTTL(base time.Duration) time.Duration {
    jitter := time.Duration(rand.Int63n(int64(JitterRange*2))) - JitterRange
    ttl := base + jitter
    if ttl < 30*time.Second {
        ttl = 30 * time.Second  // Minimum TTL floor
    }
    return ttl
}

func (c *ProductCache) Set(ctx context.Context, key string, value interface{}) error {
    data, err := json.Marshal(value)
    if err != nil {
        return err
    }
    return c.redis.SetEx(ctx, key, data, JitteredTTL(BaseTTL)).Err()
}
```

#### Staggered Cache Warming

The other avalanche scenario: cache restart after a full flush (Redis restart, deployment with `FLUSHALL`). The cache is empty, all requests hit the DB simultaneously.

```python
class CacheWarmer:
    """Warm cache from DB before serving traffic."""
    
    def warm_products(self, product_ids: list[int], batch_size: int = 100):
        """
        Warm cache in small batches with rate limiting.
        Prevents overwhelming the DB with all-at-once reads.
        """
        for i in range(0, len(product_ids), batch_size):
            batch = product_ids[i:i + batch_size]
            
            # Fetch batch from DB
            products = db.get_products_batch(batch)
            
            # Write to cache with jitter
            pipe = r.pipeline()
            for product in products:
                key = f"product:{product['id']}"
                ttl = 300 + random.randint(-60, 60)
                pipe.setex(key, ttl, json.dumps(product))
            pipe.execute()
            
            # Rate limit: 100ms between batches = 1000 products/second max
            time.sleep(0.1)
        
        print(f"Cache warmed: {len(product_ids)} products")
```

**Production pattern:** Use readiness probes that only return healthy *after* cache warm completes. Don't route production traffic to a cold cache.

---

### 5. Hot Key Problem: When One Key Becomes a Bottleneck

At scale, certain keys receive disproportionate traffic:
- Celebrity profiles on social networks
- Hero products during a sale (iPhone launch, PS5 restock)
- Real-time scores for the Super Bowl
- Exchange rates during currency volatility

A single Redis node handles ~100,000 operations/second. A single hot key can receive 500,000+ reads/second during peak events, saturating the node and causing latency spikes for all other keys on that shard.

```
Normal Distribution:        Hot Key Distribution:
  K1: 1,000 RPS               K_celebrity: 500,000 RPS
  K2: 800 RPS                 K1: 2,000 RPS
  K3: 1,200 RPS               K2: 1,500 RPS
  ...                         ...
  
Redis Node: 100,000 ops/s   Redis Node: 600,000 ops/s → SATURATED
```

#### Solution 1: Local L1 Cache (Multi-Tier Caching)

```java
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Cache;

public class MultiTierProductCache {
    // L1: In-process Caffeine cache (JVM heap, 0 network hops)
    private final Cache<Long, Product> l1Cache = Caffeine.newBuilder()
        .maximumSize(10_000)           // 10K entries max
        .expireAfterWrite(10, SECONDS) // Short TTL (hot data only)
        .recordStats()
        .build();
    
    // L2: Redis distributed cache (shared across instances)
    private final RedisClient l2Cache;
    
    public Product getProduct(long productId) {
        // L1 lookup (0 µs — pure JVM memory)
        Product product = l1Cache.getIfPresent(productId);
        if (product != null) {
            metrics.increment("cache.l1.hit");
            return product;
        }
        
        // L2 lookup (~200 µs — one Redis network hop)
        String key = "product:" + productId;
        byte[] cached = l2Cache.get(key);
        if (cached != null) {
            product = deserialize(cached);
            l1Cache.put(productId, product);  // Promote to L1
            metrics.increment("cache.l2.hit");
            return product;
        }
        
        // DB lookup (~10-50 ms)
        product = db.getProduct(productId);
        if (product != null) {
            l2Cache.setex(key, 300, serialize(product));
            l1Cache.put(productId, product);
            metrics.increment("cache.db.hit");
        }
        return product;
    }
}
```

**Traffic math with L1 cache:**
- Celebrity key: 500,000 RPS
- With L1 cache at 100 application instances: each instance handles 5,000 RPS locally
- Redis sees: 100 instances × (1 cache miss per 10s TTL) = 10 requests/second to Redis
- Redis load for the hot key: 10 RPS (down from 500,000 RPS)

#### Solution 2: Key Salting (Fan-Out Replication)

For even higher-cardinality traffic, replicate the hot key across N "shards":

```python
import hashlib

HOT_KEY_SHARDS = 16  # Replicate across 16 logical keys

def get_hot_key(base_key: str) -> str:
    """
    Fan out reads across N shards to distribute Redis load.
    All shards hold the same value; writes update all shards.
    """
    shard_index = random.randint(0, HOT_KEY_SHARDS - 1)
    return f"{base_key}:shard:{shard_index}"

def get_celebrity_profile(user_id: int) -> dict:
    # Read from random shard → distributed across 16 Redis slots
    shard_key = get_hot_key(f"profile:{user_id}")
    cached = r.get(shard_key)
    if cached:
        return json.loads(cached)
    
    profile = db.get_user(user_id)
    
    # On cache miss: populate ALL shards
    pipe = r.pipeline()
    for i in range(HOT_KEY_SHARDS):
        key = f"profile:{user_id}:shard:{i}"
        pipe.setex(key, 60, json.dumps(profile))
    pipe.execute()
    
    return profile

def update_celebrity_profile(user_id: int, profile: dict):
    # Update DB first
    db.update_user(user_id, profile)
    
    # Invalidate ALL shards
    pipe = r.pipeline()
    for i in range(HOT_KEY_SHARDS):
        key = f"profile:{user_id}:shard:{i}"
        pipe.delete(key)
    pipe.execute()
```

**Result:** 500,000 RPS hot key distributed across 16 shards = ~31,250 RPS per key, well within Redis single-node capacity.

#### Solution 3: Hot Key Detection + Automatic Promotion

```python
class AdaptiveCache:
    """Automatically detects hot keys and promotes them to local cache."""
    
    HOT_KEY_THRESHOLD = 5000  # RPS
    DETECTION_WINDOW = 1       # Second
    
    def __init__(self):
        self.request_counts = defaultdict(int)
        self.local_hot_cache = {}
        self.redis = redis.Redis()
    
    def get(self, key: str) -> any:
        # Track request rate for this key
        self.request_counts[key] += 1
        
        # Check if key is promoted to local hot cache
        if key in self.local_hot_cache:
            entry = self.local_hot_cache[key]
            if entry['expires_at'] > time.time():
                return entry['value']
        
        # Standard Redis lookup
        cached = self.redis.get(key)
        
        # Check if this key should be promoted to local cache
        rps = self.request_counts[key] / self.DETECTION_WINDOW
        if rps > self.HOT_KEY_THRESHOLD:
            self.local_hot_cache[key] = {
                'value': json.loads(cached) if cached else None,
                'expires_at': time.time() + 5  # 5s local TTL
            }
        
        return json.loads(cached) if cached else None
```

---

### 6. Redis Internal Data Structures

Understanding Redis internals is critical for capacity planning and diagnosing memory issues in production.

#### String Encoding Internals

Redis stores strings in three encodings depending on the value:

```
Value                       Encoding           Memory
─────────────────────────────────────────────────────
Integer ≤ 10000             INT (stored inline) 16 bytes
Short string (≤ 44 bytes)   EMBSTR (single alloc) 48 bytes  
Long string (> 44 bytes)    RAW (two allocations) 64+ bytes
```

```bash
redis-cli> SET key1 12345
redis-cli> OBJECT ENCODING key1
"int"

redis-cli> SET key2 "hello"
redis-cli> OBJECT ENCODING key2
"embstr"

redis-cli> SET key3 "this is a longer string that exceeds 44 chars"
redis-cli> OBJECT ENCODING key3
"raw"
```

**Practical implication:** Storing millions of integer-valued keys (counters, IDs) is extremely memory-efficient. Storing long JSON strings as values uses raw encoding and substantially more memory per key.

#### List Encoding: quicklist

Redis Lists use **quicklist** — a doubly-linked list of **listpack** (formerly ziplist) nodes:

```
quicklist:
  [listpack: A B C D E] <→ [listpack: F G H I J] <→ [listpack: K L M]
  
Each listpack: contiguous memory block, entries stored back-to-back
  ┌────┬────┬────┬────────────────────────────────────┐
  │ zlbytes │ zltail │ zllen │ entry1 │ entry2 │ 0xFF │
  └────┴────┴────┴────────────────────────────────────┘
```

**Configuration thresholds:**
```
list-max-listpack-size: 128    # Max entries per listpack node
list-max-ziplist-size: 128     # (legacy config name, same thing)
```

When a list exceeds `list-max-listpack-size` entries per node, a new listpack node is created. Lists with few entries use compact listpack encoding. Large lists use linked quicklist nodes.

#### Hash Encoding: listpack → hashtable

```
Hash encoding promotion:
  ≤ 128 fields AND all field values ≤ 64 bytes → listpack (compact)
  Either threshold exceeded → hashtable (sparse, higher memory)

Configured by:
  hash-max-listpack-entries 128
  hash-max-listpack-value   64
```

**Why this matters:** A hash with 100 fields uses ~2 KB in listpack encoding. The same hash with 129 fields uses ~10 KB in hashtable encoding. The jump is abrupt. If you're storing millions of small hashes (user sessions, metadata objects), staying under the thresholds can save 5x memory.

```bash
redis-cli> HSET myhash field1 val1 field2 val2
redis-cli> OBJECT ENCODING myhash
"listpack"  # compact

# Add 129th field...
redis-cli> OBJECT ENCODING myhash
"hashtable"  # promoted, more memory
```

#### Sorted Set Encoding: listpack → skiplist

```
Sorted Set encoding promotion:
  ≤ 128 members AND all members ≤ 64 bytes → listpack
  Either threshold exceeded → skiplist + hashtable

Configured by:
  zset-max-listpack-entries 128
  zset-max-listpack-value   64
```

**The Redis skip list:** When promoted to skiplist encoding, Redis uses a probabilistic skip list for $O(\log n)$ range queries, combined with a hash table for $O(1)$ score lookups by member name.

```
Skip List Structure (simplified):
Level 3: HEAD ────────────────────────────────── 42 ───── TAIL
Level 2: HEAD ─────── 10 ──────── 25 ─────────── 42 ───── TAIL
Level 1: HEAD ── 4 ── 10 ── 17 ── 25 ── 31 ──── 42 ───── TAIL
Level 0: HEAD ─ 2 ─ 4 ─ 7 ─ 10 ─ 14 ─ 17 ─ 21 ─ 25 ─ 28 ─ 31 ─ 38 ─ 42 ─ TAIL

Each node stores: score, member string, forward pointers per level
Each node randomly assigned 1-32 levels (p=0.25 per additional level)
```

**Why skip lists over balanced trees?**
- Skip lists support lock-free concurrent operations via CAS on forward pointers
- No rotations required (unlike AVL/Red-Black trees)
- Range scans are sequential memory traversal at the lowest level
- Simpler implementation, fewer bugs

Redis Sorted Sets store member → score in a hashtable (O(1) by member) and maintain the skip list for O(log n) by-score range queries. Both structures share the same underlying string objects via pointers (no duplication).

#### Set Encoding: listpack → intset → hashtable

```
Set encoding:
  All members are integers AND ≤ 512 members → intset (sorted integer array)
  Members are strings AND ≤ 128 members → listpack
  Either threshold exceeded → hashtable

set-max-intset-entries  512
set-max-listpack-entries 128
```

**Intset** is a sorted integer array. Membership tests use binary search: $O(\log n)$. This is 10x more memory-efficient than hashtable for integer-only sets.

#### Memory Optimization Configuration

```redis.conf
# Encoding thresholds (tune for your data shapes)
hash-max-listpack-entries 128
hash-max-listpack-value   64
zset-max-listpack-entries 128
zset-max-listpack-value   64
list-max-listpack-size    128
set-max-intset-entries    512

# Memory management
maxmemory 50gb
maxmemory-policy allkeys-lfu   # Evict least-frequently-used keys globally

# Available policies:
# noeviction     → return OOM error (production default for databases)
# allkeys-lru    → evict any key LRU (good for general caching)
# allkeys-lfu    → evict any key LFU (better for skewed distributions)
# volatile-lru   → evict only keys with TTL set, LRU order
# volatile-lfu   → evict only keys with TTL set, LFU order
# volatile-ttl   → evict shortest-TTL keys first
# allkeys-random → random eviction (rarely useful)
```

**LRU vs LFU at scale:**
- **LRU (Least Recently Used):** Evicts the key that hasn't been accessed in the longest time. Problem: a key accessed 1 million times yesterday but not today gets evicted the same as a key accessed once yesterday.
- **LFU (Least Frequently Used):** Evicts the key accessed fewest times. Better for skewed distributions (hot keys stay; cold keys evict). Redis LFU uses a probabilistic counter that decays over time.

**Redis LFU implementation detail:** Redis uses a Morris counter (logarithmic counting) with decay. Each key has an 8-bit frequency counter. Increment probability: `1 / (current_value * lfu_log_factor + 1)`. At lfu_log_factor=10, the counter saturates at ~1 million accesses. After each access, the counter decays by `(current_time - last_decrement_time) / lfu_decay_time`.

---

### 7. Memcached vs Redis: Architectural Deep Dive

Chapter 14 noted the surface-level differences. Here we examine the architectural choices and their production failure modes.

```
Feature                    Redis                  Memcached
──────────────────────────────────────────────────────────────────
Execution model            Single-threaded        Multi-threaded
Data structures            Rich (string, hash,    Strings only
                           list, set, zset,
                           stream, HLL, etc.)
Persistence                RDB + AOF              None
Replication                Built-in (Sentinel,    External (mcrouter)
                           Cluster)
Pub/Sub                    Yes                    No
Lua scripting              Yes                    No
Memory allocator           jemalloc               Slab allocator
Max value size             512 MB                 1 MB
Clustering                 Native Redis Cluster   Consistent hashing
                                                  at client layer
Horizontal scaling         Cluster mode           Client-side sharding
                           (hash slots)
Memory efficiency          Varies by encoding     Predictable (slabs)
CPU utilization            1 core (I/O bound)     N cores (compute)
Typical use case           Cache + data store     Pure cache, high-
                           + pub/sub + queues     concurrency, simple
──────────────────────────────────────────────────────────────────
```

#### Memcached Slab Allocator

Memcached pre-allocates memory in fixed-size "slabs" to avoid heap fragmentation:

```
Slab Classes:
  Class 1: 96 bytes    (for values 0-88 bytes + 8 byte header)
  Class 2: 120 bytes   (for values 89-112 bytes)
  Class 3: 152 bytes
  ...
  Class N: 1 MB        (max value size)

Each class has a fixed number of "pages" (1 MB each), divided into "chunks"

         Slab Page (1 MB)
  ┌─────┬─────┬─────┬─────┬─────┬─────┐
  │ 96B │ 96B │ 96B │ 96B │ ... │ 96B │ ← 10,922 chunks of 96B each
  └─────┴─────┴─────┴─────┴─────┴─────┘
```

**Slab imbalance failure mode:** If your workload shifts (e.g., suddenly storing large values instead of small), the "wrong" slab classes are full while others are empty. Memcached cannot reclaim memory from overfull classes for underfull classes without `slab_reassign` or restart.

```bash
# Monitor slab utilization
memcached-tool localhost:11211 stats
# Look for: STAT slab_reassign_running, evicted counts per class
```

**Redis jemalloc:** Redis uses jemalloc, a general-purpose allocator with thread-local arenas and size-class binning. More flexible than slab allocation but can develop fragmentation over time. Monitor with:

```bash
redis-cli INFO memory
# mem_fragmentation_ratio: ratio of RSS to used_memory
# > 1.5 indicates significant fragmentation
# < 1.0 indicates memory swapping (catastrophic)

# Force memory defragmentation (Redis 4.0+)
CONFIG SET activedefrag yes
CONFIG SET active-defrag-ignore-bytes 100mb
CONFIG SET active-defrag-threshold-lower 10
```

#### When to Choose Memcached Over Redis

Despite Redis's richer feature set, Memcached remains relevant in specific scenarios:

1. **Multi-threaded CPU utilization:** Redis is single-threaded for command processing. On a 32-core machine, Redis uses one core effectively. Memcached uses all 32 cores. For CPU-bound workloads (complex serialization), Memcached scales linearly with CPU count.

2. **Simple string-only cache with maximum throughput:** Memcached's threading model achieves higher raw throughput for simple GET/SET workloads on multi-core hardware.

3. **Memory predictability:** Slab allocation prevents memory fragmentation. In environments where memory budgeting must be exact (container memory limits), Memcached is more predictable.

4. **Large object caching:** If you're caching serialized objects up to 1 MB and don't need TTL granularity or pub/sub, Memcached's simpler model is adequate.

**Modern reality:** Redis 7.0+ introduced I/O threads that handle network read/write on multiple threads, with command execution remaining single-threaded. This narrows the threading gap significantly. Most new projects choose Redis for its richer feature set.

---

### 8. Distributed Cache Sharding: Consistent Hashing in Practice

Chapter 24 covered consistent hashing theory. Here we apply it specifically to Redis cache sharding.

#### Redis Cluster: Hash Slots

Redis Cluster uses a predefined 16,384 hash slot space. Each key maps to a slot via `CRC16(key) % 16384`. Slots are distributed across nodes.

```
3-node Redis Cluster:
  Node A: Slots 0–5460     (33.3% of slots)
  Node B: Slots 5461–10922 (33.3% of slots)  
  Node C: Slots 10923–16383 (33.3% of slots)

Key "product:42":
  CRC16("product:42") = 7832
  7832 % 16384 = 7832
  7832 falls in Node B's range → Route to Node B
```

**Hash tags for multi-key operations:** Redis Cluster requires all keys in a pipeline or MULTI/EXEC transaction to be on the same slot. Use hash tags to force co-location:

```python
# Without hash tags: keys may land on different nodes
# MGET product:42 user:17 session:abc → Error: CROSSSLOT

# With hash tags: all keys with same {tag} land on same slot
# CRC16 is computed only on the part inside the first {}: {user:17}
product_key = "{user:17}:product:42"   # Slot = CRC16("user:17") % 16384
session_key = "{user:17}:session:abc"  # Same slot

# Now safe for pipeline/transaction
pipe = r.pipeline()
pipe.get(product_key)
pipe.get(session_key)
pipe.execute()
```

**Adding a node to Redis Cluster:** Redis Cluster uses slot migration (not full resharding). Only the slots being moved to the new node experience a brief redirect overhead. Clients automatically follow ASK/MOVED redirections.

```bash
# Add new node and migrate slots
redis-cli --cluster add-node new-node:6379 existing-node:6379
redis-cli --cluster reshard existing-node:6379 \
  --cluster-from all \
  --cluster-to <new-node-id> \
  --cluster-slots 1365  # ~8.3% of 16384 = 4th of the slots
```

#### Client-Side Consistent Hashing (Twemproxy / mcrouter pattern)

For Memcached (which has no native clustering), consistent hashing is implemented client-side or in a proxy:

```python
import hashlib
import bisect

class ConsistentHashRing:
    def __init__(self, nodes: list[str], virtual_nodes: int = 150):
        self.ring = {}
        self.sorted_keys = []
        self.virtual_nodes = virtual_nodes
        
        for node in nodes:
            self.add_node(node)
    
    def add_node(self, node: str):
        for i in range(self.virtual_nodes):
            # Create virtual node key
            vnode_key = f"{node}:vnode:{i}"
            hash_key = self._hash(vnode_key)
            self.ring[hash_key] = node
            bisect.insort(self.sorted_keys, hash_key)
    
    def remove_node(self, node: str):
        for i in range(self.virtual_nodes):
            vnode_key = f"{node}:vnode:{i}"
            hash_key = self._hash(vnode_key)
            del self.ring[hash_key]
            self.sorted_keys.remove(hash_key)
    
    def get_node(self, key: str) -> str:
        if not self.ring:
            raise Exception("No nodes in ring")
        
        hash_key = self._hash(key)
        # Find first node at or after hash_key on the ring
        idx = bisect.bisect(self.sorted_keys, hash_key)
        if idx == len(self.sorted_keys):
            idx = 0  # Wrap around
        return self.ring[self.sorted_keys[idx]]
    
    def _hash(self, key: str) -> int:
        return int(hashlib.md5(key.encode()).hexdigest(), 16)

# Usage
ring = ConsistentHashRing(["cache1:11211", "cache2:11211", "cache3:11211"])

def get_memcached_node(cache_key: str) -> str:
    return ring.get_node(cache_key)
```

---

### 9. Cache Consistency: The Core Problem

The hardest problem in distributed caching is keeping the cache consistent with the database when both are being written concurrently. This section examines the problem formally and presents the three production-grade solutions.

#### The Dual-Write Race Condition

```
Timeline:
  T1: Write Request arrives → BEGIN UPDATE
  T2: Read Request → Cache HIT → returns old value (acceptable, bounded staleness)
  T3: Write commits to DB → product.price = 200 (was 100)
  T4: Write invalidates cache key "product:42"
  T5: Another Read Request → Cache MISS → queries DB → gets price=200 ✓
  T6: Write confirms to client → SUCCESS

But consider this race:
  T1: Write A (price=200) → Write to DB ✓
  T2: Write B (price=150) → Write to DB ✓ (B wins in DB, price=150)
  T3: Write B invalidates cache
  T4: Write A invalidates cache (already empty, no-op)
  T5: Read → Cache MISS → DB → price=150 ✓ (correct)

  vs.
  T1: Write A (price=200) → Write to DB
  T2: Write B (price=150) → Write to DB (B wins in DB, price=150)
  T3: Write B writes cache: price=150
  T4: Write A writes cache: price=200  ← WRONG! A's cache write happens after B's
  T5: Read → Cache HIT → price=200 ← STALE for up to TTL duration
```

This race is the reason "invalidate on write" is safer than "update on write" for cache-aside. If you delete the key rather than updating it, the worst case is a cache miss (correct DB read). If you update the key, you can write stale data.

#### Strategy 1: Invalidate-on-Write (Safe but Incomplete)

```python
def update_product_price(product_id: int, new_price: float):
    # Write to DB
    db.execute("UPDATE products SET price = %s WHERE id = %s", 
               (new_price, product_id))
    
    # DELETE cache key (not update) — avoids stale-write race
    r.delete(f"product:{product_id}")
    
    # Problem: the window between DELETE and next cache population
    # can still have concurrent writers that write stale data.
    # The fundamental race is: DB write → cache delete → cache refill.
    # Another writer can update DB+delete cache between our delete and refill.
```

**Residual risk:** Near-concurrent writes can still lose cache invalidations if both writers race on the same key. Acceptable for most workloads with bounded TTL as safety net.

#### Strategy 2: Versioned Cache Writes

```python
def update_product_price(product_id: int, new_price: float) -> int:
    # DB update returns the row version (RETURNING version or sequence number)
    result = db.execute(
        "UPDATE products SET price = %s, version = version + 1 "
        "WHERE id = %s RETURNING version",
        (new_price, product_id)
    )
    new_version = result.fetchone()[0]
    
    product = {"id": product_id, "price": new_price, "version": new_version}
    cache_key = f"product:{product_id}"
    
    # Lua script: only update cache if new version > stored version
    # Atomic compare-and-update via Lua (runs atomically on Redis)
    lua_script = """
    local current = redis.call('HGET', KEYS[1], 'version')
    if current == false or tonumber(current) < tonumber(ARGV[1]) then
        redis.call('HSET', KEYS[1], 'price', ARGV[2], 'version', ARGV[1])
        redis.call('EXPIRE', KEYS[1], 300)
        return 1  -- updated
    end
    return 0  -- stale, ignored
    """
    
    r.eval(lua_script, 1, cache_key, new_version, new_price)
```

**Result:** Even if Write A's cache update arrives after Write B's, the Lua script rejects it because `new_version(A) < new_version(B)`. The cache always reflects the highest-version DB state.

#### Strategy 3: CDC-Driven Cache Invalidation (Production-Grade)

The dual-write problem is fundamental: any approach that writes to the DB and the cache in two separate operations has a consistency window. The solution is to write to the DB *only*, and derive the cache invalidation from the DB's change log — eliminating the dual-write race entirely.

**Change Data Capture (CDC) with Debezium:**

```
Architecture:

  Application          PostgreSQL            Debezium            Kafka
  ──────────          ─────────────         ─────────           ─────────
  UPDATE price  ──→  WAL (Write-Ahead   →   Debezium      →   Topic:
  WHERE id=42        Log) entry:             reads WAL         pg.public.
                     {op:"u",                                  products
                     before:{price:100},
                     after:{price:200},
                     lsn:12345}

  Cache Invalidation Service
  ──────────────────────────
  Consumes pg.public.products
  Extracts: key_id = message.after.id
  DELETEs: redis.delete(f"product:{key_id}")
```

**Debezium PostgreSQL Connector configuration:**

```json
{
  "name": "postgres-products-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "postgres-primary",
    "database.port": "5432",
    "database.user": "debezium_user",
    "database.password": "secret",
    "database.dbname": "product_db",
    "topic.prefix": "pg",
    "table.include.list": "public.products",
    "plugin.name": "pgoutput",
    "publication.autocreate.mode": "filtered",
    "slot.name": "debezium_products",
    "heartbeat.interval.ms": "5000"
  }
}
```

**Cache invalidation consumer:**

```go
package invalidation

import (
    "context"
    "encoding/json"
    "log"
    
    "github.com/segmentio/kafka-go"
    "github.com/redis/go-redis/v9"
)

type DebeziumEvent struct {
    Op     string          `json:"op"`    // "c"=create, "u"=update, "d"=delete
    Before json.RawMessage `json:"before"`
    After  json.RawMessage `json:"after"`
}

type ProductRecord struct {
    ID int64 `json:"id"`
}

type CacheInvalidationService struct {
    reader *kafka.Reader
    redis  *redis.Client
}

func (s *CacheInvalidationService) Run(ctx context.Context) error {
    for {
        msg, err := s.reader.ReadMessage(ctx)
        if err != nil {
            return err
        }
        
        var event DebeziumEvent
        if err := json.Unmarshal(msg.Value, &event); err != nil {
            log.Printf("Failed to parse Debezium event: %v", err)
            continue
        }
        
        // Extract product ID from the changed record
        var record ProductRecord
        source := event.After
        if event.Op == "d" {
            source = event.Before  // On delete, use "before" state
        }
        
        if err := json.Unmarshal(source, &record); err != nil {
            log.Printf("Failed to parse product record: %v", err)
            continue
        }
        
        // Invalidate cache
        cacheKey := fmt.Sprintf("product:%d", record.ID)
        if err := s.redis.Del(ctx, cacheKey).Err(); err != nil {
            log.Printf("Failed to invalidate cache key %s: %v", cacheKey, err)
            // Don't fail — stale cache will expire via TTL
            continue
        }
        
        log.Printf("Invalidated cache key: %s (op=%s)", cacheKey, event.Op)
    }
}
```

**CDC advantages:**
1. **No dual-write race:** Application writes to DB only. Cache invalidation is derived from DB's WAL, which is the authoritative record.
2. **Works for all writers:** Even DB migrations, admin SQL updates, or batch jobs trigger invalidation automatically.
3. **Exactly-once semantics (with Kafka):** Debezium uses Kafka partition + offset for idempotent delivery. Cache invalidation service uses Kafka consumer groups with committed offsets.
4. **Audit trail:** The Kafka topic is a full audit log of all DB changes.

**CDC limitations:**
1. **Invalidation lag:** WAL → Debezium → Kafka → consumer → Redis delete. Typically 10-500ms. Cache may serve stale data during this window.
2. **Operational complexity:** Requires Debezium, Kafka, and consumer services as additional infrastructure.
3. **PostgreSQL WAL overhead:** Logical decoding requires `wal_level = logical`, which increases WAL volume by ~30%.

---

### 10. Redis Deployment Topologies

#### Standalone + Replica

```
                    ┌───────────────┐
                    │  Primary      │
                    │  (Read/Write) │
                    └──────┬────────┘
                     Async │ replication
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
     ┌──────────┐   ┌──────────┐   ┌──────────┐
     │ Replica 1│   │ Replica 2│   │ Replica 3│
     │ (Read)   │   │ (Read)   │   │ (Read)   │
     └──────────┘   └──────────┘   └──────────┘
```

**Replication lag:** Redis replication is asynchronous. Replicas may lag behind primary by 0-100ms under normal conditions. Under high write load, lag can grow to seconds. Reads from replicas may return stale data.

**When to use:** Single dataset that fits on one machine. Read replicas for read-heavy workloads. Simple operations team.

#### Redis Sentinel (High Availability)

```
     ┌───────────────────────────────────────────┐
     │              Sentinel Cluster             │
     │  [Sentinel1] [Sentinel2] [Sentinel3]      │
     │         (majority quorum = 2/3)           │
     └─────────────┬────────────┬────────────────┘
                   │ Monitor    │ Failover
                   ▼            ▼
          ┌──────────────┐  ┌──────────┐
          │  Primary     │  │ Replica  │
          │  (current)   │  │          │
          └──────────────┘  └──────────┘
          
Failover: Sentinel detects primary down (SDOWN → ODOWN with quorum)
          Sentinel promotes a replica to primary
          Clients redirected via Sentinel API
          Typical failover time: 10-30 seconds
```

**Failover window:** During the 10-30 second failover, writes are rejected. Applications must implement retry logic with exponential backoff. This is the key operational risk with Sentinel.

#### Redis Cluster (Horizontal Scaling)

```
          ┌─────────────────────────────────────────────┐
          │              Redis Cluster                  │
          │                                             │
          │  ┌─────────────┐  ┌─────────────┐          │
          │  │  Node A     │  │  Node B     │          │
          │  │  Primary    │  │  Primary    │   ...    │
          │  │  Slots 0-   │  │  Slots      │          │
          │  │  5460       │  │  5461-10922 │          │
          │  │  + Replica  │  │  + Replica  │          │
          │  └─────────────┘  └─────────────┘          │
          │                                             │
          │  Data sharded across N primaries             │
          │  Each primary has M replicas                 │
          │  Client-side routing via CLUSTER SLOTS       │
          └─────────────────────────────────────────────┘
```

**Cluster limitations:**
- Multi-key commands require hash tags for co-location
- Lua scripts must only access keys on the same slot
- No cross-slot transactions

**When to use Cluster:** Dataset exceeds single-machine RAM. Write throughput exceeds single-node capacity. Horizontal scaling is required.

---

## Step-by-Step Execution: Cache Stampede Under Load

Let's trace exactly what happens without and with XFetch protection during a product cache expiry.

### Without Protection (Naive TTL)

```
State: Redis key "product:1001" set with TTL=300s
Load: 5000 concurrent requests/second for product:1001

t=0:00:00  TTL = 300s
           5000 req/s: all HIT Redis → 1ms response time, DB: 0 QPS

t=0:05:00  TTL expires
           5000 req/s hit Redis simultaneously → ALL MISS
           5000 req/s fire DB query: SELECT * FROM products WHERE id=1001
           
t=0:05:00.010  DB receives 5000 queries simultaneously
               Connection pool (100 connections) → 4900 requests queue
               DB CPU: 0% → 98% in 10ms
               
t=0:05:00.050  DB query backlog: 5000 queries × 50ms each ÷ 100 concurrent
               = 2.5 second queue drain time
               Application timeout (2s) fires → 503 errors
               
t=0:05:02  Monitoring alert: error rate > 5%
t=0:05:10  On-call engineer wakes up, finds DB at 100% CPU
t=0:05:30  First cache key populated. Load normalizes.
           But now cache miss triggered additional stampedes on
           related keys (product_recommendations:1001, reviews:1001, etc.)
```

### With XFetch Protection

```
State: Redis key "product:1001" set with TTL=300s, delta=0.05 (50ms DB query)
Load: 5000 concurrent requests/second

t=0:04:50  TTL remaining: 10 seconds
           XFetch check per request:
             recompute_threshold = 0.05 × 1.0 × (-ln(random()))
             
           For random() = 0.5:  threshold = 0.05 × 0.693 = 0.035s (35ms)
           For random() = 0.1:  threshold = 0.05 × 2.303 = 0.115s (115ms)
           For random() = 0.01: threshold = 0.05 × 4.605 = 0.230s (230ms)
           
           Remaining TTL = 10s >> all thresholds → NO early recompute
           
t=0:04:57  TTL remaining: 3 seconds
           For random() = 0.01: threshold = 0.230s < 3s → still no recompute
           For random() = 0.0001: threshold = 0.461s < 3s → still no recompute
           
t=0:04:59.5  TTL remaining: 0.5 seconds
             For random() = 0.01: threshold = 0.230s < 0.5s → no recompute
             For random() = 0.0001: threshold = 0.461s ≈ 0.5s → triggers!
             ONE request fires early DB query (probability ≈ 0.1%)
             
t=0:04:59.55  DB query returns (50ms). Cache updated. TTL reset to 300s.

t=0:05:00  Key's original TTL would have expired.
           But key was already refreshed by early recomputation.
           5000 req/s continue hitting cache → NO STAMPEDE
           DB: 1 query total (not 5000)
```

---

## Real-World Example: Facebook TAO

Facebook's social graph is the most demanding caching workload in the world: billions of nodes (users, pages, photos), trillions of edges (friendships, likes, comments), and billions of reads per second across the global deployment.

### Why Redis Was Insufficient

Facebook evaluated Redis (and Memcached) for social graph caching and found critical limitations:

1. **Graph traversal locality:** A timeline fetch for a user with 1,000 friends requires fetching 1,000 edges and 1,000 profile nodes. With generic caching, this requires 2,000 independent cache lookups with no locality optimization.

2. **Write fan-out:** When a celebrity posts, the edge cache for their 50 million followers must all be invalidated. Invalidating 50 million keys in generic Redis requires 50 million individual DEL commands — too slow.

3. **Read-your-writes consistency:** After posting a status update, the posting user must see their own post immediately (even if their friends see it asynchronously). Generic eventual-consistency caches don't provide this.

4. **Geographic distribution:** Facebook serves 3 billion users across 15+ global data centers. Replicating all caching logic and consistency guarantees globally required a purpose-built solution.

### TAO Architecture

```
TAO = The Associations and Objects

Objects:   Users, pages, photos, comments (like DB rows)
Edges:     Friendships, likes, taggings (like DB join tables)

Architecture:
                 ┌─────────────────────────────────────────┐
                 │           Leader Region (US)            │
                 │                                         │
                 │  ┌───────────┐    ┌────────────────┐   │
                 │  │ TAO Leader │←→  │   MySQL        │   │
                 │  │  Tier      │    │  (Source of    │   │
                 │  │            │    │   Truth)       │   │
                 │  └──────┬────┘    └────────────────┘   │
                 │         │ Replication                   │
                 └─────────┼───────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
  ┌───────────┐    ┌───────────┐    ┌───────────┐
  │TAO Follower│   │TAO Follower│   │TAO Follower│
  │  Europe    │   │  Asia     │   │  US West   │
  │            │   │           │   │            │
  │ TAO Cache  │   │ TAO Cache │   │ TAO Cache  │
  │ TAO Cache  │   │ TAO Cache │   │ TAO Cache  │
  └───────────┘    └───────────┘    └───────────┘
  
TAO Cache Tier per region:
  ┌──────────────────────────────────────┐
  │  L1 Caches (many, per server rack)  │  ← Absorbs >99% of reads
  │  L2 Cache  (few, per datacenter)    │  ← Absorbs overflow from L1
  └──────────────────────────────────────┘
```

**TAO's consistency model:**

TAO provides read-your-writes consistency within a region using **refill invalidation**: when a write is accepted, the TAO leader sends invalidation messages to all L1 caches in the region before acknowledging the write. The user's next read hits the freshly-invalidated cache and re-fetches from the leader.

Cross-region reads are eventually consistent (follower regions lag by replication delay). TAO explicitly shows users "you may be seeing an older version of this page" in some regions.

**Key design insight:** TAO is not a generic key-value cache. It understands the graph data model (objects and edges) and provides graph-aware operations (get all edges of type X for object Y, count edges, etc.) that would require multiple round-trips with generic caching.

**Lesson for engineers:** At sufficient scale, domain-specific caches that understand your data model outperform generic caches. The threshold is approximately 1 million QPS with complex read patterns.

---

## Failure Scenarios

### Scenario 1: Cache Avalanche During Black Friday Product Launch

**Date:** November 2022 (composite of multiple real incidents).  
**Company:** E-commerce platform, $500M GMV/year.

**What Happened:**

The team launched a major Black Friday sale at midnight UTC. At 23:59:00, they pre-warmed the cache by loading all 2 million product keys into Redis. All keys were set with TTL = 3600 seconds (1 hour) to match the "sale ends at midnight" business requirement.

At 01:00:00 UTC (exactly 1 hour later), all 2 million keys expired simultaneously. The homepage loaded product carousels from a category service that had 20 workers. All 20 workers simultaneously fired queries for all 2 million products (10 queries each = 20 million DB queries in under 1 second).

The PostgreSQL cluster (3 primary + 6 read replicas) immediately saturated at 100% CPU. Connection pool exhausted in 200ms. 90% of requests returned 500 errors. The outage lasted 18 minutes while engineers manually flushed partial caches and reduced DB query volume.

**Root Cause:**

1. All keys set with identical TTL → synchronized expiry
2. No TTL jitter applied during pre-warming
3. Cache pre-warming script ignored XFetch patterns
4. Application had no circuit breaker: DB failures caused retry storms

**Fix Applied:**

```python
# Before: All keys same TTL
def warm_cache(products):
    for product in products:
        r.setex(f"product:{product.id}", 3600, serialize(product))

# After: TTL jitter + splay across time window
def warm_cache(products):
    for i, product in enumerate(products):
        # Base TTL 3600s + random jitter ±600s (10 minutes)
        ttl = 3600 + random.randint(-600, 600)
        r.setex(f"product:{product.id}", ttl, serialize(product))
        
        # Rate limit warming: 10,000 sets/second
        if i % 10000 == 0:
            time.sleep(1)
```

Additionally added a circuit breaker: if DB error rate exceeded 20% in 10 seconds, serve stale cache data and return 206 (Partial Content) rather than 500.

---

### Scenario 2: Hot Key Saturation During Celebrity Streaming Launch

**Date:** March 2023 (composite of real streaming incidents).  
**Company:** Music streaming platform.

**What Happened:**

A major artist released an album at 12:00 AM EST. Within 90 seconds, the artist's profile key (`artist:profile:12345678`) received 850,000 requests/second across 200 application servers. The artist's profile was stored in Redis Cluster Node 7 (slots 9000–9500).

Node 7 CPU hit 100%. All keys in Node 7's slot range (not just the hot key, but thousands of other artists) began experiencing latency spikes: p99 went from 1ms to 4,000ms. The application timeout of 2 seconds was breached for 40% of requests. The release was partially inaccessible for 7 minutes.

**Root Cause:**

1. No hot key detection system
2. No L1 local cache for artist profiles
3. Single Redis node serving 850,000 RPS for one key (saturated at ~100,000 RPS)
4. Key salting not implemented for celebrity profiles

**Fix Applied:**

Implemented three-layer defense:
```python
class ArtistProfileService:
    
    # Layer 1: Process-local Caffeine cache (JVM), 10s TTL
    local_cache = Caffeine(max_size=1000, ttl=10)
    
    # Layer 2: Redis (shared L2)
    redis_client = RedisClusterClient()
    
    # Layer 3: Key salting for known hot artists
    HOT_ARTISTS = load_hot_artists_from_config()  # Updated daily
    SHARD_COUNT = 32
    
    def get_artist_profile(self, artist_id: int) -> dict:
        # L1: local cache
        profile = self.local_cache.get(artist_id)
        if profile:
            return profile
        
        # Redis key: salted for hot artists
        if artist_id in self.HOT_ARTISTS:
            shard = random.randint(0, self.SHARD_COUNT - 1)
            redis_key = f"artist:{artist_id}:shard:{shard}"
        else:
            redis_key = f"artist:{artist_id}"
        
        cached = self.redis_client.get(redis_key)
        if cached:
            profile = deserialize(cached)
            self.local_cache.put(artist_id, profile)
            return profile
        
        # DB fallback (singleflight-protected)
        profile = self.db_service.get_artist(artist_id)
        self._write_to_cache(artist_id, profile)
        self.local_cache.put(artist_id, profile)
        return profile
    
    def _write_to_cache(self, artist_id: int, profile: dict):
        if artist_id in self.HOT_ARTISTS:
            # Populate all shards
            pipe = self.redis_client.pipeline()
            for i in range(self.SHARD_COUNT):
                key = f"artist:{artist_id}:shard:{i}"
                pipe.setex(key, 60, serialize(profile))
            pipe.execute()
        else:
            self.redis_client.setex(f"artist:{artist_id}", 300, serialize(profile))
```

Result: 850,000 RPS distributed across 32 shards = 26,562 RPS per key, with the vast majority absorbed by the L1 local cache (only ~200 RPS reaching Redis per application instance).

---

## Performance Considerations

### Redis Throughput Benchmarks (2024 Hardware)

```
Operation         Throughput        p50          p99
─────────────────────────────────────────────────────────────
GET (no pipeline)  100,000 ops/s    200 µs       1 ms
SET (no pipeline)  100,000 ops/s    200 µs       1 ms
GET (pipeline=10)  800,000 ops/s    25 µs        100 µs
GET (pipeline=100) 2,000,000 ops/s  10 µs        50 µs
HGETALL (10 fields) 80,000 ops/s   250 µs       2 ms
ZRANGEBYSCORE      50,000 ops/s    400 µs       5 ms
LPUSH/RPUSH        100,000 ops/s   200 µs       1 ms
─────────────────────────────────────────────────────────────
Hardware: 16-core, 64GB RAM, 25Gbps NIC, Redis 7.2
Pipeline reduces per-command overhead by amortizing RTT.
```

### Memory Overhead Per Data Type

```
Data Type    Size of Data    Redis Memory    Overhead Factor
──────────────────────────────────────────────────────────────
String "abc" 3 bytes         72 bytes        24x
String (100B) 100 bytes      176 bytes       1.76x
Hash (10 fields, listpack) 200 bytes  280 bytes   1.4x
Hash (200 fields, hashtable) 4KB      8KB        2x
Sorted Set (100 members, skiplist) 2KB  6KB      3x
Sorted Set (100 members, listpack) 2KB  2.5KB    1.25x
──────────────────────────────────────────────────────────────
```

**Key insight:** Small hashes in listpack encoding are extremely memory-efficient. Large sorted sets in skiplist encoding have 3x overhead. Keeping data structures below encoding promotion thresholds can halve memory requirements.

### Pipeline vs Single-Command Throughput

```
Without Pipeline (sequential):
  Client → [GET k1 → wait → GET k2 → wait → ... → GET k100]
  100 commands × 200µs RTT = 20ms total
  Throughput: 100 keys / 20ms = 5,000 keys/second

With Pipeline (batch):
  Client → [GET k1, GET k2, ..., GET k100] → single TCP write
  Redis processes all 100 commands
  Client reads 100 responses in single TCP read
  Throughput: 100 keys / 0.2ms = 500,000 keys/second

Rule: Pipeline any group of independent Redis commands. 
      Batch sizes of 50-500 commands are optimal.
      Beyond 10,000 commands/pipeline, memory overhead outweighs gains.
```

---

## Trade-offs

### Cache Strategy Comparison

| Strategy | Read Latency | Write Latency | Consistency | Failure Mode |
|---|---|---|---|---|
| Cache-Aside | Fast (hit) / Slow (miss) | DB only, fast | Eventual | Stale data until TTL |
| Read-Through | Fast (hit) / Medium (auto-fetch) | DB only, fast | Eventual | Dependent on cache availability |
| Write-Through | Fast | Doubled (cache + DB sync) | Strong | Writes fail if cache down |
| Write-Behind | Fast | Fast (async) | Eventual + data loss risk | Cache crash = data loss |

### Invalidation Strategy Comparison

| Strategy | Consistency | Complexity | Works for all writers | Latency |
|---|---|---|---|---|
| TTL-only | Weak (bounded staleness) | Low | Yes | 0ms overhead |
| Invalidate-on-write | Good (dual-write window) | Low | App writes only | ~1ms |
| Versioned writes | Better (CAS prevents overwrites) | Medium | App writes only | ~2ms |
| CDC-driven | Best (derived from WAL) | High | All writers | 10-500ms |
| Write-through | Strong (synchronous) | Low | App writes only | 2x write latency |

### Redis vs Memcached Deployment Decision

| Factor | Choose Redis | Choose Memcached |
|---|---|---|
| Data structures needed | Yes (sorted sets, hashes) | No — strings only |
| Persistence required | Yes | No |
| Pub/Sub or queues | Yes | No |
| Multi-core CPU bottleneck | Unlikely (<1M RPS) | Yes (>1M RPS, simple ops) |
| Memory predictability | Flexible | Strict (slabs) |
| Replication/HA | Built-in | External (mcrouter) |
| Lua scripting needed | Yes | No |

---

## Production Considerations

1. **Always set maxmemory and eviction policy.** Without `maxmemory`, Redis will consume all available RAM and trigger OOM kills. Set `maxmemory` to 80% of available RAM, leaving headroom for replication buffers and temporary AOF rewrites.

2. **Monitor fragmentation ratio.** `mem_fragmentation_ratio > 1.5` indicates significant memory fragmentation. Enable `activedefrag` and consider a rolling restart if fragmentation persists after defragmentation.

3. **Use pipelining for batch operations.** Any code path that issues 5+ Redis commands in sequence should use pipelines. A common antipattern: `for id in ids: redis.get(f"product:{id}")` — replace with `redis.mget([f"product:{id}" for id in ids])`.

4. **Never use KEYS or SMEMBERS on large sets in production.** `KEYS *` blocks Redis's single thread for the entire key scan duration. At 100M keys, this can block for 10+ seconds. Use `SCAN` with cursor iteration instead.

5. **Configure Redis persistence based on durability requirements.** Pure cache: disable AOF and RDB (data loss on restart is acceptable). Cache-database hybrid: enable RDB snapshots hourly + AOF with `appendfsync everysec`. Avoid `appendfsync always` — it reduces throughput by 10x.

6. **Set connection pool size carefully.** Too few connections → request queuing. Too many connections → Redis memory exhaustion (each connection consumes 10-40 KB). Rule: `pool_size = (max_rps × avg_latency_ms) / 1000`. At 100K RPS with 1ms latency: `100K × 0.001 = 100` connections per Redis node.

7. **Monitor slow log regularly.** `CONFIG SET slowlog-log-slower-than 10000` (10ms). `SLOWLOG GET 10` shows the 10 slowest recent commands. A full LRANGE, SMEMBERS, or KEYS on large data structures will appear here.

8. **Test failover scenarios quarterly.** Sentinel failover, Cluster node failure, and network partition behavior should be tested in staging under realistic load. Untested failover = unknown failover.

9. **Use Redis Cluster for datasets > 25 GB or write throughput > 50K RPS.** Single-node Redis is simpler but hard to scale without downtime. Cluster mode allows live horizontal scaling.

10. **Implement circuit breakers around all cache interactions.** If Redis is unavailable, fallback to direct DB access with reduced throughput (degraded mode). Never let cache failure cause total service failure.

---

## Common Beginner Mistakes

1. **Using Redis as a database without persistence.** Storing critical business data (user accounts, order history) in Redis with no persistence and no backups. Redis restart = total data loss. Redis is a *cache* with optional persistence, not a primary database.

2. **Not setting TTLs.** Caching data with `SET key value` (no `EX` parameter) causes keys to live forever, consuming memory until Redis evicts them under memory pressure. Always set TTLs appropriate to the data's staleness tolerance.

3. **Caching large objects without compression.** Storing 100 KB JSON blobs in Redis directly. At 1 million keys, this consumes 100 GB RAM unnecessarily. Compress with gzip or LZ4 before storing: 100 KB → 10 KB = 10x capacity improvement. Decompress on read (CPU cost: ~1ms, negligible vs. network RTT).

4. **Using MULTI/EXEC as transactions for cache-database consistency.** Redis MULTI/EXEC provides atomicity within Redis, but not across Redis + database. A failure between `UPDATE products` and `redis.delete(key)` leaves them inconsistent. This is not solvable with Redis transactions alone — use CDC or compensating logic.

---

## Common Senior Engineer Mistakes

1. **Implementing invalidate-on-write without addressing the dual-write race.** Adding cache invalidation after DB writes but not handling the race where another writer's invalidation happens between your DB write and your cache delete. Fixing this requires versioned writes or CDC.

2. **Not accounting for cache stampede in performance models.** Calculating system capacity assuming cache always hits. During restart, deploy, or TTL mass-expiry, the cache miss rate approaches 100% momentarily. The DB must be sized for this peak, not steady-state cache-hit throughput.

3. **Treating L1 local cache as a performance optimization instead of a reliability mechanism.** Adding L1 cache "for speed" but not recognizing it protects Redis from hot key saturation. Without L1 limits (max size, TTL), the L1 cache can grow unboundedly and cause application OOM. Define explicit bounds.

4. **Ignoring replication lag in read-from-replica patterns.** Routing reads to Redis replicas for load distribution, then not accounting for replication lag. After a write, reads from replicas may see stale data for 10-500ms. For use cases where read-your-writes consistency matters (e.g., user updates their own profile), always read from primary.

---

## Architecture Smells

- **Cache hit rate < 80%:** Either the cache is not being populated correctly, TTLs are too short, or the data access pattern is not suitable for caching. Investigate before adding more cache capacity.
- **No TTL on any cache keys:** Time-to-live is the last-resort consistency guarantee. Keys without TTLs grow unboundedly and serve stale data indefinitely.
- **Cache warming the entire database on startup:** Warming all data from DB before serving traffic blocks deployments for minutes-to-hours and doesn't focus cache resources on hot data. Use lazy loading (populate on first request) or targeted warming of top-N most-accessed items.
- **Storing business logic state in cache:** Using Redis as the source of truth for distributed locks, leader election, or workflow state without compensating for cache eviction. If Redis evicts the lock key due to memory pressure, two processes simultaneously hold the lock.
- **Homogeneous TTL across all data types:** Product descriptions (change weekly) should not have the same TTL as inventory counts (change per-second). TTL must match the data's change frequency and staleness tolerance.

---

## Principal Engineer Perspective

The principal engineer's cache decisions are architectural, not implementation-level. Here are the questions at that level:

**When does the cache become a liability?**  
Caches add operational complexity (invalidation, stampede protection, deployment coordination), serve stale data (bounded by TTL or invalidation latency), and require separate SLOs and error budget tracking. The breakeven point is approximately 20x read-to-write ratio. Below that, the complexity of maintaining cache consistency may exceed the performance benefit.

**How do you design for cache failure as a primary failure mode?**  
Many systems are designed assuming cache availability. The correct posture: the database must be able to serve production traffic at 10-20% of normal throughput without the cache (circuit breaker open). This means the database must be provisioned for cache-absent load, not just cache-hit load. Most engineering teams discover this only during their first major cache failure.

**What is your invalidation strategy audit?**  
For every cached entity, answer: (1) What changes this data? (2) How quickly does the cache need to reflect changes? (3) What is the blast radius of a stale read? (4) Who owns the invalidation logic? A surprising number of production systems have no documented answers to these questions for significant portions of their cached data.

**When should you build a purpose-built cache instead of using Redis/Memcached?**  
When your access patterns have strong domain semantics that generic key-value caches cannot express efficiently: graph traversal (Facebook TAO), inverted indexes (search caches), columnar access (analytics result caches), or hierarchical aggregations (reporting caches). The cost of a purpose-built cache is high (engineering time, operational overhead). The payoff is 10-100x better resource efficiency and correctness guarantees that generic caches cannot provide.

**Cache consistency is a distributed systems problem, not a cache problem.**  
Every cache consistency strategy is ultimately a trade-off between consistency, latency, and complexity. TTL accepts bounded staleness for simplicity. CDC achieves near-real-time consistency at infrastructure cost. Synchronous write-through achieves strong consistency at write latency cost. There is no free lunch. The principal engineer chooses the strategy by examining the business requirement for staleness tolerance, not by defaulting to "what Redis supports."

---

## Architecture Review Questions

1. You are designing a product catalog cache for an e-commerce platform. The catalog has 5 million products, with ~10,000 product updates per day (primarily pricing) and 2 million product reads per second. Product prices must be accurate within 30 seconds of an update. What invalidation strategy would you choose, and why? What TTL would you set?

2. A caching layer using Redis Cluster is experiencing p99 latency spikes of 500ms every 60 minutes, consistently. What is the most likely cause? How would you diagnose and fix it?

3. Your team wants to add a local in-process L1 cache to reduce Redis load. What are the three most important parameters to configure, and what are the consequences of misconfiguring each?

4. Describe the dual-write race condition in cache-aside pattern with concurrent writers. Under what conditions does it cause incorrect cache state, and for how long? What are two strategies to mitigate it?

5. Your Redis Cluster node is experiencing hot key contention on key `trending:products` which receives 1 million reads per second. The key holds a 2 KB JSON array updated every 30 seconds. Design a multi-layer solution that eliminates Redis saturation without sacrificing consistency beyond 30 seconds.

6. CDC-driven cache invalidation is proposed for a microservices architecture. Service A writes to PostgreSQL, and Service B's Redis cache needs to be invalidated on every A write. What are three operational risks of this approach, and how would you mitigate each?

7. You are asked to choose between Redis Cluster (3 primaries, 3 replicas) and a single Redis instance with replicas for a 10 GB dataset with 50K writes/second and 500K reads/second. What factors drive the decision? Which would you choose?

8. A team is storing user session data in Redis with `noeviction` policy and no TTLs on session keys. Sessions accumulate indefinitely. Redis runs out of memory. What are three immediate mitigations, and what is the long-term architectural fix?

9. Explain why XFetch is probabilistically guaranteed to prevent stampedes while naive TTL guarantees stampedes at scale. What is the mathematical relationship between the XFetch β parameter and stampede prevention probability?

10. Your system serves data at 99.9% cache hit rate normally. After a deployment that doubles the number of cache keys (new feature), the hit rate drops to 60%. Describe the cascading effects on the database, application response times, and downstream services. How would you prevent this during future deployments?

---

## Visual/Animation Specification

### Animation 1: XFetch Probabilistic Early Expiration

An interactive timeline visualization showing:
- X-axis: Time remaining until key expiry (from 300s on left to 0 on right)
- Y-axis: Probability that XFetch triggers early recomputation
- A curve showing exponentially increasing probability as TTL approaches 0
- Interactive slider for β (0.1 to 5.0): higher β = more aggressive early expiration = curve shifts left
- Interactive slider for δ (0.01s to 1.0s): higher δ (slower compute) = wider early expiration window
- Animation: 1000 simulated requests shown as dots, colored green (cache hit), yellow (XFetch early recompute), red (expired miss)
- Counter showing: "DB queries without XFetch: 1000, DB queries with XFetch: 3"

### Animation 2: Cache Stampede vs. Protected Recovery

Split-screen simulation:
- Left: Naive TTL cache. Show 5000 concurrent requests as particle stream. At expiry, all particles simultaneously hit the database node (turns red), database overloads, particles queue up, timeouts appear.
- Right: XFetch-protected cache. Same 5000 particles. As expiry approaches, 1-2 particles probabilistically trigger early recompute (small green flash). Key is refreshed. All 5000 particles continue flowing smoothly. Database shows zero spike.
- Timeline slider to scrub through the event
- Metrics panel: Request latency p50/p99, DB QPS, Error rate — updating in real-time during animation

---

## Hands-On Tutorial: Production-Ready Multi-Tier Cache

### Prerequisites

```bash
# Install dependencies
pip install redis==5.0.1 pybloom-live==4.0.0 \
    prometheus-client==0.19.0

# Start Redis (Docker)
docker run -d --name redis-demo \
  -p 6379:6379 \
  redis:7.2-alpine \
  redis-server --maxmemory 256mb --maxmemory-policy allkeys-lfu

# Verify
redis-cli PING
# PONG
```

### Complete Implementation

```python
"""
Production-ready multi-tier cache implementation demonstrating:
- L1 in-process cache (with bounded size + TTL)
- L2 Redis cache (with jitter + compression)
- XFetch stampede prevention
- Bloom filter penetration guard
- Prometheus metrics
"""

import json
import math
import random
import time
import gzip
import threading
from collections import OrderedDict
from typing import Optional, Callable

import redis
from prometheus_client import Counter, Histogram, Gauge

# ─────────────────────────────────────────────────────────────────────────────
# Metrics
# ─────────────────────────────────────────────────────────────────────────────
cache_hits = Counter("cache_hits_total", "Cache hits", ["tier"])
cache_misses = Counter("cache_misses_total", "Cache misses", ["tier"])
cache_latency = Histogram("cache_operation_seconds", "Cache operation latency", ["op"])
bloom_rejects = Counter("bloom_filter_rejects_total", "Bloom filter rejects")

# ─────────────────────────────────────────────────────────────────────────────
# L1 In-Process LRU Cache
# ─────────────────────────────────────────────────────────────────────────────
class L1Cache:
    """
    Thread-safe in-process LRU cache with TTL.
    Bounded by max_size to prevent OOM.
    """
    
    def __init__(self, max_size: int = 10_000, default_ttl: int = 10):
        self.max_size = max_size
        self.default_ttl = default_ttl
        self._cache: OrderedDict = OrderedDict()  # key → (value, expiry)
        self._lock = threading.Lock()
    
    def get(self, key: str) -> Optional[any]:
        with self._lock:
            if key not in self._cache:
                return None
            value, expiry = self._cache[key]
            if time.time() > expiry:
                del self._cache[key]
                return None
            # Move to end (most recently used)
            self._cache.move_to_end(key)
            return value
    
    def set(self, key: str, value: any, ttl: Optional[int] = None):
        ttl = ttl or self.default_ttl
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
            self._cache[key] = (value, time.time() + ttl)
            # Evict oldest if over capacity
            while len(self._cache) > self.max_size:
                self._cache.popitem(last=False)
    
    def delete(self, key: str):
        with self._lock:
            self._cache.pop(key, None)
    
    def size(self) -> int:
        with self._lock:
            return len(self._cache)


# ─────────────────────────────────────────────────────────────────────────────
# Simple Bloom Filter (in-process)
# ─────────────────────────────────────────────────────────────────────────────
class SimpleBloomFilter:
    """
    Simple Bloom filter for cache penetration prevention.
    In production, use RedisBloom module or pybloom_live.
    """
    
    def __init__(self, capacity: int = 1_000_000, error_rate: float = 0.001):
        self.capacity = capacity
        self.error_rate = error_rate
        # Calculate bit array size and hash count
        self.num_bits = int(-capacity * math.log(error_rate) / (math.log(2) ** 2))
        self.num_hashes = int((self.num_bits / capacity) * math.log(2))
        self.bit_array = bytearray(self.num_bits // 8 + 1)
        self._lock = threading.Lock()
    
    def _get_bit_positions(self, item: str) -> list[int]:
        import hashlib
        positions = []
        for i in range(self.num_hashes):
            digest = hashlib.md5(f"{item}:{i}".encode()).hexdigest()
            position = int(digest, 16) % self.num_bits
            positions.append(position)
        return positions
    
    def add(self, item: str):
        with self._lock:
            for pos in self._get_bit_positions(item):
                byte_index, bit_index = pos // 8, pos % 8
                self.bit_array[byte_index] |= (1 << bit_index)
    
    def might_contain(self, item: str) -> bool:
        """Returns False if DEFINITELY not in set. True if PROBABLY in set."""
        for pos in self._get_bit_positions(item):
            byte_index, bit_index = pos // 8, pos % 8
            if not (self.bit_array[byte_index] & (1 << bit_index)):
                return False
        return True


# ─────────────────────────────────────────────────────────────────────────────
# Multi-Tier Cache with XFetch
# ─────────────────────────────────────────────────────────────────────────────
class MultiTierCache:
    """
    Production-ready multi-tier cache implementing:
    - L1 in-process cache (0 µs access)
    - L2 Redis cache with compression (~200 µs access)
    - XFetch probabilistic stampede prevention
    - Bloom filter penetration guard
    - TTL jitter for avalanche prevention
    """
    
    def __init__(
        self,
        redis_client: redis.Redis,
        l1_max_size: int = 10_000,
        l1_ttl: int = 10,
        l2_base_ttl: int = 300,
        l2_jitter: int = 60,
        xfetch_beta: float = 1.0,
        bloom_capacity: int = 1_000_000,
        compress_threshold_bytes: int = 1024  # Compress values > 1KB
    ):
        self.redis = redis_client
        self.l1 = L1Cache(max_size=l1_max_size, default_ttl=l1_ttl)
        self.l2_base_ttl = l2_base_ttl
        self.l2_jitter = l2_jitter
        self.xfetch_beta = xfetch_beta
        self.bloom = SimpleBloomFilter(capacity=bloom_capacity)
        self.compress_threshold = compress_threshold_bytes
    
    def _jittered_ttl(self) -> int:
        return self.l2_base_ttl + random.randint(-self.l2_jitter, self.l2_jitter)
    
    def _compress(self, data: bytes) -> bytes:
        if len(data) > self.compress_threshold:
            compressed = gzip.compress(data, compresslevel=6)
            if len(compressed) < len(data):
                return b"\x1f\x8b" + compressed  # Magic header: gzip
        return data
    
    def _decompress(self, data: bytes) -> bytes:
        if data[:2] == b"\x1f\x8b":
            return gzip.decompress(data[2:])
        return data
    
    def _xfetch_should_recompute(
        self, expiry: float, delta: float
    ) -> bool:
        """XFetch probabilistic early expiration check."""
        remaining = expiry - time.time()
        if remaining <= 0:
            return True  # Already expired
        threshold = delta * self.xfetch_beta * (-math.log(random.random()))
        return remaining < threshold
    
    def get(self, key: str, entity_type: str = "default") -> Optional[any]:
        # Step 1: Bloom filter — reject non-existent keys immediately
        bloom_key = f"{entity_type}:{key}"
        if not self.bloom.might_contain(bloom_key):
            bloom_rejects.inc()
            return None
        
        # Step 2: L1 cache (in-process)
        with cache_latency.labels(op="l1_get").time():
            l1_value = self.l1.get(key)
        if l1_value is not None:
            cache_hits.labels(tier="l1").inc()
            return l1_value
        cache_misses.labels(tier="l1").inc()
        
        # Step 3: L2 Redis cache with XFetch
        with cache_latency.labels(op="l2_get").time():
            pipe = self.redis.pipeline(transaction=False)
            pipe.get(key)
            pipe.get(f"{key}:xmeta")
            l2_value, xmeta_raw = pipe.execute()
        
        if l2_value is not None:
            # Check XFetch early expiration
            if xmeta_raw:
                xmeta = json.loads(xmeta_raw)
                if not self._xfetch_should_recompute(
                    expiry=xmeta["expiry"],
                    delta=xmeta["delta"]
                ):
                    # Cache is valid, no early recomputation needed
                    value = json.loads(self._decompress(l2_value))
                    self.l1.set(key, value)
                    cache_hits.labels(tier="l2").inc()
                    return value
            else:
                # No XFetch metadata: serve as-is (for backward compat)
                value = json.loads(self._decompress(l2_value))
                self.l1.set(key, value)
                cache_hits.labels(tier="l2").inc()
                return value
        
        cache_misses.labels(tier="l2").inc()
        return None  # Full cache miss — caller must fetch from DB and call set()
    
    def set(
        self,
        key: str,
        value: any,
        entity_type: str = "default",
        compute_time: float = 0.0  # Time taken to compute this value (for XFetch)
    ):
        """Store value in both L1 and L2 cache."""
        ttl = self._jittered_ttl()
        expiry = time.time() + ttl
        
        # L1 set
        self.l1.set(key, value, ttl=min(10, ttl))
        
        # L2 Redis set with compression and XFetch metadata
        serialized = json.dumps(value).encode()
        compressed = self._compress(serialized)
        
        xmeta = json.dumps({
            "delta": compute_time,
            "expiry": expiry
        })
        
        pipe = self.redis.pipeline(transaction=True)
        pipe.setex(key, ttl, compressed)
        pipe.setex(f"{key}:xmeta", ttl + 30, xmeta)  # meta outlives value slightly
        pipe.execute()
        
        # Register in Bloom filter
        self.bloom.add(f"{entity_type}:{key}")
    
    def delete(self, key: str):
        """Invalidate key from all tiers."""
        self.l1.delete(key)
        pipe = self.redis.pipeline(transaction=False)
        pipe.delete(key)
        pipe.delete(f"{key}:xmeta")
        pipe.execute()
    
    def get_or_compute(
        self,
        key: str,
        compute_fn: Callable,
        entity_type: str = "default"
    ) -> any:
        """
        Cache-aside with XFetch: get from cache or compute from source.
        Handles full cache miss by calling compute_fn() and caching result.
        Does NOT deduplicate concurrent misses (use singleflight for that).
        """
        cached = self.get(key, entity_type)
        if cached is not None:
            return cached
        
        # Cache miss: compute value and measure time (for XFetch δ)
        start = time.time()
        value = compute_fn()
        compute_time = time.time() - start
        
        if value is not None:
            self.set(key, value, entity_type=entity_type, compute_time=compute_time)
        
        return value


# ─────────────────────────────────────────────────────────────────────────────
# Demo / Integration Test
# ─────────────────────────────────────────────────────────────────────────────
def simulate_cache_workload():
    r = redis.Redis(host="localhost", port=6379, db=0)
    
    cache = MultiTierCache(
        redis_client=r,
        l1_max_size=1000,
        l1_ttl=5,
        l2_base_ttl=30,
        l2_jitter=10,
        xfetch_beta=1.0,
        bloom_capacity=100_000
    )
    
    # Pre-populate Bloom filter with "valid" product IDs
    valid_ids = list(range(1, 10_001))  # Products 1-10000 exist
    for pid in valid_ids:
        cache.bloom.add(f"product:{pid}")
    
    # Simulate mixed read workload
    stats = {"l1_hits": 0, "l2_hits": 0, "db_hits": 0, "bloom_rejects": 0}
    
    def fake_db_fetch(product_id: int) -> dict:
        time.sleep(0.050)  # Simulate 50ms DB query
        return {
            "id": product_id,
            "name": f"Product {product_id}",
            "price": round(random.uniform(9.99, 999.99), 2)
        }
    
    print("Running 500 simulated requests...")
    
    for i in range(500):
        # 80% valid products, 20% non-existent (penetration attempt)
        if random.random() < 0.8:
            product_id = random.choice(valid_ids[:100])  # Hot 100 products
        else:
            product_id = random.randint(1_000_000, 9_999_999)  # Non-existent
        
        key = str(product_id)
        entity_type = "product"
        
        # Check Bloom filter manually to count stats
        if not cache.bloom.might_contain(f"{entity_type}:{key}"):
            stats["bloom_rejects"] += 1
            continue
        
        result = cache.get_or_compute(
            key=key,
            compute_fn=lambda: fake_db_fetch(product_id),
            entity_type=entity_type
        )
    
    print(f"\nCache Statistics:")
    print(f"  Bloom filter rejects: {stats['bloom_rejects']}")
    print(f"  L1 size: {cache.l1.size()} entries")
    print(f"  Redis keys: {r.dbsize()}")

if __name__ == "__main__":
    simulate_cache_workload()
```

### Running the Tutorial

```bash
# Start Redis
docker run -d --name redis-demo -p 6379:6379 redis:7.2-alpine \
  redis-server --maxmemory 128mb --maxmemory-policy allkeys-lfu

# Run the cache simulation
python cache_demo.py

# Monitor Redis during the run
redis-cli monitor | head -50    # Watch real-time commands
redis-cli info memory           # Check memory usage
redis-cli info stats            # Check hit rate

# Check Redis keyspace hits/misses
redis-cli info stats | grep keyspace
# keyspace_hits: X
# keyspace_misses: Y
# Hit rate = X / (X + Y)

# Check slow log for any slow commands
redis-cli slowlog get 10

# Check memory encoding of a key
redis-cli object encoding product:42

# Monitor fragmentation
redis-cli info memory | grep mem_fragmentation_ratio
```

---

## Exercises

### Conceptual Exercises

1. **Stampede analysis:** A cache serves 100,000 RPS. The cached key has a 60-second TTL and costs 200ms to recompute from the database. Without XFetch, how many simultaneous DB queries will the cache stampede generate at expiry? With XFetch (β=1.0), approximately how many?

2. **Avalanche probability:** A service caches 1 million keys, all set with TTL=3600s at the same time during a batch pre-warming operation. If the service processes 200,000 requests/second and each cache miss triggers one DB query, what DB query rate will occur at TTL expiry? How much jitter (±X seconds) would reduce the peak DB query rate to below 1,000 QPS?

3. **Bloom filter trade-offs:** A Bloom filter is sized for 10 million products with a 0.1% false positive rate. The product catalog grows by 20% to 12 million products without the filter being rebuilt. What happens to the false positive rate? What is the operational impact?

4. **Encoding threshold impact:** A service stores 5 million Redis hashes, each with 130 fields of 32-byte values. The `hash-max-listpack-entries` threshold is 128. What happens to memory consumption if the threshold is raised to 150? What are the trade-offs of this configuration change?

5. **Multi-tier cache consistency:** A system uses L1 (10s TTL) + L2 Redis (300s TTL) + CDC invalidation (500ms lag). A product price is updated in the database. What is the maximum duration that a request may see the stale price? In which scenario is the maximum duration reached?

### Architecture Exercises

1. **Design a distributed rate limit counter** using Redis that supports 1 million unique user IDs with a 60-second sliding window. The counter must be accurate within 5% and must not fail when a single Redis node fails. Sketch the data structure, the Redis commands, and the failover strategy.

2. **Cache-aside with CDC:** Design a caching system for a financial services platform where product prices change 1,000 times/second and reads happen 500,000 times/second. The price must be accurate within 100ms. Which invalidation strategy would you use? Draw the architecture, identify the SLA risks, and describe the monitoring you would put in place.

3. **Multi-region cache:** A global e-commerce platform has data centers in US, EU, and APAC. Each region has its own Redis cluster. When a product is updated in the US (primary write region), how would you propagate the cache invalidation to EU and APAC caches within 500ms? What consistency model does this provide?

### Quantitative Exercises

1. **Memory sizing:** A Redis cluster stores 50 million user sessions. Each session is a JSON object with 20 fields of average 20 bytes each (total ~400 bytes). Sessions are stored as Redis hashes.
   - If `hash-max-listpack-entries = 128` and all hashes have 20 fields, which encoding will Redis use?
   - What is the approximate total memory usage for 50 million sessions?
   - If the encoding changes to hashtable (threshold = 15), how does memory change?

2. **Throughput calculation:** A Redis single node serves 50,000 reads/second at p99 = 1ms. You add an L1 in-process cache with a 10% hit rate. What is the new Redis throughput requirement? If you increase the L1 hit rate to 70%, what is the Redis throughput requirement? At what L1 hit rate does Redis throughput drop below 10,000 reads/second?

### Solutions to Quantitative Exercises

**Exercise 1 — Memory Sizing:**
- With 20 fields < 128 threshold: **listpack** encoding
- Memory per session: ~400 bytes data + ~50 bytes listpack overhead + ~64 bytes Redis object overhead ≈ **514 bytes per session**
- Total: 50,000,000 × 514 bytes ≈ **25.7 GB**
- With hashtable encoding (threshold = 15, 20 fields > 15):
  Each field becomes a separate hashtable entry: ~64 bytes per entry × 20 fields = 1,280 bytes + overhead ≈ **1,500 bytes per session**
  Total: 50,000,000 × 1,500 bytes ≈ **75 GB** (≈3x more memory)

**Exercise 2 — Throughput Calculation:**
- Baseline: 50,000 reads/second to Redis (no L1 cache)
- With 10% L1 hit rate: 50,000 × (1 - 0.10) = **45,000 reads/second to Redis**
- With 70% L1 hit rate: 50,000 × (1 - 0.70) = **15,000 reads/second to Redis**
- For Redis throughput < 10,000: 50,000 × (1 - x) < 10,000 → x > 0.80 → **L1 hit rate must exceed 80%**

---

## Interview Questions

### Beginner Level

1. What is the difference between cache-aside and read-through caching patterns?
2. Why do we set TTLs on cache keys? What happens if we don't?
3. What is a cache miss? What are the performance implications?
4. What is the difference between Redis LRU and LFU eviction policies?
5. How does Redis Cluster distribute keys across nodes?

### Senior Level

1. Explain the cache stampede problem. What are two approaches to prevent it?
2. What is cache penetration? How does a Bloom filter prevent it?
3. Describe the dual-write race condition in cache-aside pattern. Under what conditions does it produce incorrect cache state?
4. How does pipeline mode improve Redis throughput? What operations benefit most?
5. Compare Redis Sentinel and Redis Cluster. When would you choose each?

### Staff Level

1. Design a multi-tier caching architecture for a social feed that handles 1M reads/second globally. Include consistency model, invalidation strategy, and failure modes.
2. Explain the XFetch algorithm mathematically. How does the δ parameter relate to stampede protection strength?
3. A service has 99% cache hit rate normally. A deployment doubles the number of cache keys (new feature). Describe the cascading failure that occurs and the architectural safeguards that would prevent it.
4. How does CDC-driven cache invalidation eliminate the dual-write race condition? What are its operational limitations?

### Principal Level

1. When would you design a purpose-built cache instead of using Redis? What domain characteristics justify the engineering investment?
2. Compare Facebook TAO's consistency model to a naive Redis cache-aside implementation. What specific guarantees does TAO provide that Redis cannot? What trade-offs does TAO make?
3. A global caching system must provide read-your-writes consistency within each region and eventual consistency across regions. Design the architecture, identify the minimum infrastructure required, and characterize the consistency window.
4. An engineering team proposes using Redis as the source of truth for a distributed locking system. Under what conditions does this fail? Design a locking system that is correct under network partition, node failure, and process pause scenarios.

---

## Summary

Distributed caching is a multidimensional engineering problem that spans data structures, distributed systems theory, consistency models, and operational reliability.

The four fundamental failure modes — **stampede** (thundering herd), **penetration** (non-existent key bypass), **avalanche** (synchronized TTL expiry), and **hot key** (single-key saturation) — each require specific mitigation strategies: XFetch probabilistic early expiration, Bloom filter guards, TTL jitter, and multi-tier L1+L2 architecture respectively.

Cache consistency is fundamentally a distributed systems challenge. Simple TTL accepts bounded staleness. Invalidate-on-write improves consistency but leaves a dual-write race window. CDC-driven invalidation eliminates the race by deriving cache state from the database's write-ahead log, at the cost of infrastructure complexity.

Redis's internal data structures — listpack, quicklist, skip list, intset — have encoding thresholds that dramatically affect memory consumption. Understanding these thresholds and tuning `maxmemory-policy` for your access pattern (allkeys-lfu for skewed distributions) is the difference between efficient cache operation and surprise OOM events.

At sufficient scale, purpose-built caches (Facebook TAO, custom graph caches, columnar result caches) outperform generic key-value stores for domain-specific access patterns. The threshold is typically 1M+ RPS with strong domain structure.

---

## What You Should Now Be Able To Explain

- **The XFetch algorithm:** Why $T - \delta \times \beta \times \ln(\text{random}()) > \text{expiry}$ prevents stampedes probabilistically, and how to tune β and δ for your workload
- **CDC-driven cache invalidation:** How Debezium reads PostgreSQL's WAL and publishes invalidation events to Kafka, eliminating the dual-write race condition at the cost of invalidation lag
- **Redis encoding internals:** The listpack→hashtable and listpack→skiplist promotion thresholds, and why staying under those thresholds can reduce Redis memory by 3-5x
- **Multi-tier caching economics:** Why L1 in-process cache at 10s TTL reduces Redis RPS requirements by 70-90% for hot-key scenarios, and why it must have strict size bounds to prevent application OOM
- **Cache consistency spectrum:** TTL (weakest, simplest) → invalidate-on-write (better, dual-write risk) → versioned writes (good, requires DB versioning) → CDC (best, highest complexity)
- **Operational failure modes:** Cache avalanche from synchronized TTL, hot key saturation from celebrity data, stampede from naive expiry, penetration from non-existent key attacks — and the specific mitigation for each

---

## What To Learn Next

**Chapter 30 — Database Replication Internals: WAL, Logical Replication, and MVCC at Scale**

Having mastered the caching tier — how data is accelerated from the storage tier to the read path — Chapter 30 examines how databases themselves maintain consistency across multiple copies. We will dissect PostgreSQL's Write-Ahead Log (WAL) at the byte level: how WAL records are structured, how streaming replication transmits them to standbys, how logical replication decodes row-level changes for cross-system replication (the same mechanism Debezium uses for CDC). We will explore Multi-Version Concurrency Control (MVCC), how PostgreSQL maintains multiple row versions to support concurrent readers without blocking writers, the visibility rules that determine which version a transaction sees, and how `VACUUM` reclaims dead tuple storage. We will examine replication lag causes and measurement, promotion procedures, and the replication topologies that support high availability, read scaling, and zero-downtime migrations at companies like GitLab, Shopify, and Instagram.
