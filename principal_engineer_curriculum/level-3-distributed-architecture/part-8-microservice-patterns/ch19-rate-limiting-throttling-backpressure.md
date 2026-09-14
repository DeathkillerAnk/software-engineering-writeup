# Chapter 19 — Rate Limiting, Throttling, and Backpressure

## Difficulty
Advanced

## Importance
**Must Know** — Every service has a finite capacity. Without rate limiting, a single misbehaving client can saturate your service and cause degradation for all other clients. Without backpressure, a fast producer can overwhelm a slow consumer until memory exhausts and the system crashes. Without load shedding, a traffic spike can cause cascading failures across the entire platform. Rate limiting, throttling, and backpressure are the engineering discipline of saying "no" gracefully — accepting less work than arrives so that the work you do accept gets done correctly. A Principal Engineer who cannot design these mechanisms is building a system that will fail unpredictably under load.

## Prerequisites
Chapter 9 — Distributed Systems Failure Modes (cascading failure, overload)
Chapter 14 — Caching: Redis (rate limiter implementation with Redis)
Chapter 6 — Message Queues (backpressure in Kafka consumer groups)
Chapter 16 — Kubernetes (HPA scaling — complements rate limiting)

## Learning Objectives

By the end of this chapter you will be able to:

1. Explain the four rate limiting algorithms — Fixed Window, Sliding Window Log, Sliding Window Counter, Token Bucket, and Leaky Bucket — and their trade-offs.
2. Implement a distributed rate limiter using Redis (Token Bucket with Lua script).
3. Distinguish between rate limiting (client-level), throttling (service-level), and load shedding (system-level).
4. Design rate limiting at the correct architectural layer: API gateway, service mesh, application code.
5. Explain backpressure and implement it in both reactive streams and Kafka consumer patterns.
6. Apply the Adaptive Concurrency Limit algorithm (used by Netflix/AWS) for automatic capacity discovery.
7. Design load shedding strategies: priority queues, request hedging, and graceful degradation.
8. Diagnose and fix the three common failure modes: thundering herd after rate limit reset, distributed rate limit synchronization lag, and priority inversion.

## Why This Matters

In 2020, GitHub experienced a major outage triggered by a single API client that made 14 million API calls in 24 hours, consuming a disproportionate share of API server resources. Without rate limiting per client, this single actor affected every other GitHub user.

In 2021, a streaming platform's Kafka consumer fell behind by 2 hours during a traffic spike. The consumer kept reading messages faster than it could process them. Memory exhausted. The consumer crashed. On restart, it tried to process 2 hours of backlogged messages — immediately crashed again (no backpressure control). The fix: implement backpressure so the consumer processes at its sustainable rate regardless of producer speed.

These are not edge cases. Every production system at scale will face overload. The question is whether the system fails gracefully (rate limiting + load shedding) or catastrophically (everything fails at once).

---

## Mental Model

> **Rate limiting is physics applied to software. Every service has a throughput capacity — a maximum number of requests per second it can process while maintaining acceptable latency. When arrival rate exceeds service capacity, one of three things happens: (1) the queue grows (latency increases), (2) the queue overflows (requests are dropped), or (3) you limit the arrival rate (rate limiting). Option 3 is the only option that gives you control. Rate limiting is not punishing clients — it is protecting the service and all other clients from the consequences of overload. Backpressure is the complementary mechanism: instead of dropping requests, you signal the producer to slow down, propagating the capacity constraint upstream.**

---

## Intuition

Think of rate limiting like a restaurant reservation system:

**Without rate limiting:** The restaurant accepts every walk-in. On a Friday night, 200 people arrive. The restaurant seats 50. The other 150 wait in a growing queue. Service for those seated degrades (kitchen overwhelmed). People wait 3 hours. Many leave angry.

**With rate limiting (fixed window):** The restaurant accepts only 50 customers per hour. When the limit is reached: "Sorry, we're full until 8 PM." Customers at 8 PM: flood in (all 150 who were told to come back at 8 simultaneously). Still overwhelming.

**With rate limiting (token bucket):** Each minute, 5 seats become available. Customers are admitted continuously at a controlled rate. No flood at reset time. Steady flow. Kitchen operates at capacity but not over capacity.

**With backpressure:** The kitchen signals the front-of-house: "We're backed up 15 minutes." The front-of-house stops seating new parties until the kitchen clears the backlog. The constraint propagates upstream — not dropped, delayed at the right point.

---

## Visual Explanation

### Rate Limiting Algorithms — Comparison

```
1. Fixed Window Counter:
   Window: 60 seconds. Limit: 100 requests.
   
   Time:   0────────────────30────────────────60│0────────────────30────
   Reqs:   [50 requests here]    [50 requests here]│[50 requests here]
                                                   │
                       Window resets at t=60 ──────┘
   
   Problem: Burst at window boundary:
   t=59: 100 requests arrive → all accepted (within first window)
   t=61: 100 requests arrive → all accepted (new window, reset)
   t=59 to t=61: 200 requests in 2 seconds → 2× the intended rate
   
   ████ 59 │ 60 │ 61 ████
        100    100    = 200 requests in 2 seconds (burst at boundary!)

2. Sliding Window Log:
   Track timestamp of each request. On new request: count requests in last 60s.
   
   Memory: stores every request timestamp
   At 1,000 RPS: 1,000 timestamps/second × 60 seconds = 60,000 entries per user
   At 1M users: 60 billion entries → not practical for high-cardinality rate limiting
   
   Accurate: no boundary burst problem
   Impractical: memory cost at scale

3. Sliding Window Counter (hybrid):
   Current window counter + previous window counter (weighted by time overlap)
   
   Rate = prev_count × (1 - elapsed/window_size) + curr_count
   
   t=75s (within 60-120 window, elapsed=15s from window start):
     prev_count (window 0-60): 80 requests
     curr_count (window 60-120): 40 requests
     Rate = 80 × (1 - 15/60) + 40 = 80 × 0.75 + 40 = 60 + 40 = 100 ✅ exactly at limit
   
   Memory: only 2 counters per user (current + previous)
   Accuracy: slight approximation (±0-8% error vs exact sliding window)
   Best for: high-cardinality rate limiting (millions of users)

4. Token Bucket:
   Bucket capacity: 100 tokens. Refill rate: 10 tokens/second.
   
   Each request: consume 1 token. If bucket empty: reject.
   
   Bucket level:
   100 ████████████████████████████████████████████████
    80 ██████████████████████████████████
    60 ████████████████████████
    40 ████████████████
    20 ████████
     0           ← reject all requests until tokens refill
                                    ← 10 tokens/second refill
   
   Allows burst: if bucket has 100 tokens, 100 requests can arrive simultaneously
   Controls sustained rate: cannot sustain more than 10 req/s long-term
   
   ✅ Allows natural bursts (to capacity)
   ✅ Smoothly controls sustained rate
   ✅ Simple to implement (Redis incr/expire)

5. Leaky Bucket:
   Requests fill a bucket. A "leak" drains the bucket at a fixed rate.
   If bucket overflows: request rejected.
   
   Effect: output is always exactly the configured rate (strictly smoothed)
   Unlike token bucket: no bursts at all — rate is fixed.
   Use case: outgoing API calls where downstream cannot handle bursts (payment processor)
```

---

## Core Concepts

### 1. Token Bucket Rate Limiter — Redis Implementation

The token bucket is the most common production rate limiting algorithm because it allows natural bursts up to the bucket capacity while enforcing a sustained rate limit.

```lua
-- Redis Lua script: Token Bucket Rate Limiter
-- KEYS[1]: rate limit key (e.g., "ratelimit:user:789")
-- ARGV[1]: bucket capacity (max tokens)
-- ARGV[2]: refill rate (tokens per second)
-- ARGV[3]: requested tokens (usually 1)
-- ARGV[4]: current timestamp (milliseconds)
-- Returns: {allowed (1/0), remaining_tokens, retry_after_ms}

local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])   -- tokens per second
local requested = tonumber(ARGV[3])
local now = tonumber(ARGV[4])           -- milliseconds

-- Load current state: {tokens, last_refill_time_ms}
local state = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(state[1]) or capacity  -- start full
local last_refill = tonumber(state[2]) or now

-- Calculate tokens to add since last refill:
local elapsed_ms = now - last_refill
local tokens_to_add = (elapsed_ms / 1000) * refill_rate
tokens = math.min(capacity, tokens + tokens_to_add)

local allowed = 0
local retry_after = 0

if tokens >= requested then
    tokens = tokens - requested
    allowed = 1
else
    -- Calculate when enough tokens will be available:
    local deficit = requested - tokens
    retry_after = math.ceil((deficit / refill_rate) * 1000)  -- milliseconds
end

-- Save updated state with TTL = time to fully refill + buffer
local ttl = math.ceil((capacity / refill_rate) * 1000) + 1000
redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
redis.call('PEXPIRE', key, ttl)

return {allowed, math.floor(tokens), retry_after}
```

```python
# Python client using the Lua script:
import time
import redis

class TokenBucketRateLimiter:
    def __init__(self, redis_client: redis.Redis, 
                 capacity: int, refill_rate: float):
        self.redis = redis_client
        self.capacity = capacity
        self.refill_rate = refill_rate
        self._script = redis_client.register_script(TOKEN_BUCKET_SCRIPT)
    
    def check(self, key: str, requested: int = 1) -> tuple[bool, int, int]:
        """
        Returns: (allowed, remaining_tokens, retry_after_ms)
        """
        now_ms = int(time.time() * 1000)
        result = self._script(
            keys=[f"ratelimit:{key}"],
            args=[self.capacity, self.refill_rate, requested, now_ms]
        )
        return bool(result[0]), int(result[1]), int(result[2])

# Usage in API gateway / middleware:
limiter = TokenBucketRateLimiter(
    redis_client=redis.Redis(),
    capacity=100,          # burst: up to 100 requests at once
    refill_rate=10.0       # sustained: 10 requests/second
)

def rate_limit_middleware(request):
    user_id = get_user_id(request)
    allowed, remaining, retry_after_ms = limiter.check(f"user:{user_id}")
    
    if not allowed:
        return Response(
            status=429,
            headers={
                "X-RateLimit-Limit": "100",
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(int(time.time() + retry_after_ms / 1000)),
                "Retry-After": str(retry_after_ms // 1000),
            },
            body='{"error": "rate_limit_exceeded", "message": "Too many requests"}'
        )
    
    response = handle_request(request)
    response.headers.update({
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": str(remaining),
    })
    return response
```

**Why Lua script?** Redis executes Lua scripts atomically — no interleaving of other commands. This prevents the race condition where two concurrent requests both see the same token count and both "succeed" before either deducts tokens (double-spend).

### 2. Sliding Window Counter — High-Cardinality Rate Limiting

For rate limiting millions of users, the sliding window counter is more memory-efficient:

```python
def sliding_window_check(redis_client, user_id: str, 
                          limit: int, window_seconds: int) -> bool:
    """
    Sliding window counter: approximate rate limiting with O(1) memory per user.
    """
    now = time.time()
    current_window = int(now // window_seconds)  # e.g., 75s → window 1 (60-120s range)
    prev_window = current_window - 1
    
    current_key = f"ratelimit:{user_id}:{current_window}"
    prev_key = f"ratelimit:{user_id}:{prev_window}"
    
    # Use pipeline for atomicity and performance:
    pipe = redis_client.pipeline()
    pipe.incr(current_key)
    pipe.expire(current_key, window_seconds * 2)  # keep 2 windows
    pipe.get(prev_key)
    results = pipe.execute()
    
    current_count = results[0]
    prev_count = int(results[2] or 0)
    
    # Weight previous window by time overlap:
    elapsed = now % window_seconds  # seconds into current window
    prev_weight = 1 - (elapsed / window_seconds)
    
    estimated_count = prev_count * prev_weight + current_count
    
    if estimated_count > limit:
        # Undo the increment (we already incremented before checking):
        redis_client.decr(current_key)
        return False  # rate limited
    
    return True

# Memory per user: 2 Redis keys × ~50 bytes = 100 bytes
# At 10M users: 10M × 100 bytes = 1 GB (manageable)
# vs Sliding Window Log: 10M × 1000 timestamps × 8 bytes = 80 GB (not manageable)
```

### 3. Rate Limiting Taxonomy — Where to Apply

Rate limiting operates at multiple layers, each with different semantics:

```
Layer 1: External (API Gateway / CDN)
  What: limit requests per client IP, API key, or user
  Where: Nginx, Kong, AWS API Gateway, Cloudflare
  Why: protect services from external overload and abuse
  
  Example (Nginx rate limiting):
  limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
  limit_req_zone $http_x_api_key zone=key_limit:10m rate=100r/s;
  
  server {
    location /api/ {
      limit_req zone=api_limit burst=20 nodelay;
      # 10 req/s steady, burst up to 20 without delay, then reject
      limit_req_status 429;
      
      limit_req zone=key_limit burst=200 nodelay;
      # API key clients: 100 req/s steady, burst 200
    }
  }

Layer 2: Service Mesh (Istio / Envoy)
  What: limit service-to-service request rates
  Where: Envoy sidecar configuration
  Why: prevent one internal service from overwhelming another
  
  Envoy local rate limit filter:
    name: envoy.filters.http.local_ratelimit
    typed_config:
      token_bucket:
        max_tokens: 1000
        tokens_per_fill: 100
        fill_interval: 1s  # 100 req/s sustained, burst 1000
      filter_enabled:
        default_value:
          numerator: 100    # 100% of requests subject to rate limit
          denominator: HUNDRED
      filter_enforced:
        default_value:
          numerator: 100
          denominator: HUNDRED
  
  Envoy global rate limit (via gRPC rate limit service):
    route_config:
      virtual_hosts:
        rate_limits:
          - actions:
              - header_value_match:
                  descriptor_value: api_request
                  headers:
                    - name: :path
                      string_match:
                        prefix: /api/
    # Rate limit service: checks global rate (across all pods) via Redis

Layer 3: Application (service code)
  What: limit at business logic level (per-user, per-tenant, per-operation-type)
  Where: middleware in the service itself
  Why: differentiated rate limits by user tier, operation cost
  
  Example (tiered rate limiting):
    Free tier:    100 req/min, burst 10
    Pro tier:     1000 req/min, burst 100
    Enterprise:   10000 req/min, burst 1000
    
    Each tier: different token bucket configuration
    User tier stored in JWT claim → rate limiter reads tier → applies policy

Layer 4: Database / External API
  What: limit outbound calls to external APIs (payment processors, email providers)
  Where: service code, before calling external APIs
  Why: external APIs have their own rate limits; exceeding them causes 429 errors
  
  Example: Stripe API rate limit (100 write ops/second):
    Outbound rate limiter: leaky bucket at 80 ops/second (leave 20% headroom)
    If queue backs up: reject new requests or queue them (don't block callers)
```

### 4. Distributed Rate Limiting — The Synchronization Challenge

In a distributed service (10 pods of payment-service), each pod has a local rate limiter. The question: how do you enforce a global limit across all pods?

```
Problem: Global rate limit = 1000 req/second. 10 pods.
  
  Option A: Local per-pod limit = 100 req/second (1000 / 10 pods)
    Problem 1: if some pods are busier than others, total < 1000 (underutilization)
    Problem 2: if pods scale (12 pods now), global limit becomes 1200 (limit violated)
    Problem 3: on pod restart, the new pod has full capacity → burst

  Option B: Central Redis rate limiter (global)
    All pods check Redis for each request
    Accurate: globally enforced
    Risk: Redis becomes critical path. Redis latency: 0.3-1ms per request.
           At 10,000 RPS per pod × 10 pods: 100,000 Redis calls/second → feasible
    Risk: Redis outage → rate limiter unavailable → fail open (allow all) or fail closed (reject all)?
    
    Design decision: fail open (allow all traffic through if Redis is down)
    Rationale: brief Redis outage → brief unthrottled traffic is acceptable risk
               vs: brief Redis outage → all traffic rejected (service unavailable)
    
  Option C: Gossiped rate limit state (token bucket synchronized across pods)
    Each pod maintains local token bucket
    Pods gossip current token count to each other periodically (every 100ms)
    Tradeoff: 100ms lag → brief over-limit during gossip interval
    Use when: Redis latency is unacceptable (< 1ms SLO)

  Option D: Rate limit at gateway (before reaching pods)
    Single gateway enforces global rate limit
    Pods don't need to rate limit independently
    Best for: external API rate limiting
    Not suitable for: per-user limits at pod level (gateway must have user context)
```

**Approximate rate limiting for very high throughput:**
```python
# At 1M RPS, even 1ms Redis round-trip = 1000 Redis calls/second overhead
# Solution: local approximate rate limiter with Redis sync every N requests

class ApproximateRateLimiter:
    """
    Local rate limiter that syncs with Redis periodically.
    Allows N% overshoot but avoids per-request Redis calls.
    """
    SYNC_EVERY = 100  # sync every 100 requests
    
    def __init__(self, redis_client, key, limit_per_second):
        self.redis = redis_client
        self.key = key
        self.limit = limit_per_second
        self.local_tokens = limit_per_second  # start full
        self.request_count = 0
        self.last_sync = time.time()
    
    def check(self) -> bool:
        self.request_count += 1
        
        # Sync with Redis every SYNC_EVERY requests:
        if self.request_count % self.SYNC_EVERY == 0:
            self._sync_with_redis()
        
        if self.local_tokens > 0:
            self.local_tokens -= 1
            return True
        return False
    
    def _sync_with_redis(self):
        # Subtract consumed tokens from Redis:
        consumed = self.SYNC_EVERY
        remaining = self.redis.decrby(self.key, consumed)
        if remaining < 0:
            # Overdraft: we consumed more than allowed
            self.local_tokens = 0
        else:
            self.local_tokens = min(remaining, self.limit)
        
        # Refill Redis tokens based on elapsed time:
        elapsed = time.time() - self.last_sync
        refill = int(elapsed * self.limit)
        if refill > 0:
            self.redis.incrby(self.key, min(refill, self.limit))
            self.last_sync = time.time()
```

### 5. Throttling — Service-Level Admission Control

While rate limiting is client-centric (limit per user/API key), throttling is service-centric: the service limits its own concurrency based on its current capacity.

```
Concurrency-based throttling:
  Service measures: how many requests are currently in flight?
  If in-flight > max_concurrency: reject new requests (503 Service Unavailable)
  
  Max concurrency = optimal throughput point (Little's Law):
  Throughput = concurrency / latency
  
  At target latency 100ms, target throughput 1000 RPS:
  Max concurrency = 1000 × 0.1 = 100 concurrent requests
  
  If concurrency > 100: service is likely under heavy load
                        Accepting more requests will INCREASE latency (queue buildup)
                        Better to reject → caller retries later → load naturally reduces

Java (Spring Boot / Semaphore-based):
  private final Semaphore concurrencyLimiter = new Semaphore(100);
  
  public ResponseEntity<?> handleRequest(Request request) {
    if (!concurrencyLimiter.tryAcquire(0, TimeUnit.MILLISECONDS)) {
      return ResponseEntity.status(503)
        .header("Retry-After", "1")
        .body(Map.of("error", "Service at capacity. Please retry."));
    }
    try {
      return processRequest(request);
    } finally {
      concurrencyLimiter.release();
    }
  }
```

### 6. Adaptive Concurrency Limit (Netflix/AWS Pattern)

The challenge with static concurrency limits: you must set them correctly before deployment. If the service gets faster (optimization) or slower (dependency degradation), the static limit is wrong.

**Adaptive concurrency limit:** The service measures its own gradient (how latency changes as concurrency increases) and adjusts the limit dynamically.

```
Netflix Concurrency Limiter algorithm (Gradient2):

  goodput = throughput × (1 - error_rate)  # effective throughput
  gradient = rtt_noload / rtt_actual        # how close to congestion
  
  new_limit = current_limit × gradient + sqrt(current_limit)
  # sqrt(current_limit): additive increase component (explore capacity)
  
  If rtt_actual ≈ rtt_noload (no congestion): gradient ≈ 1 → limit increases slowly
  If rtt_actual >> rtt_noload (congested):    gradient < 1 → limit decreases
  
  rtt_noload: measured minimum RTT observed recently (serves as "capacity baseline")
  rtt_actual: current measured RTT (exponential moving average)
  
  Range: min_limit=4 (never go below 4 concurrent) to max_limit=1000

Advantages:
  - Self-calibrating: no configuration needed per deployment
  - Adapts to slow dependencies: if downstream DB gets slow, limit reduces automatically
  - Adapts to service optimization: if new code is faster, limit increases
  
Implementation (resilience4j AdaptiveConcurrencyLimiter):
  RateLimiterConfig config = RateLimiterConfig.custom()
    .limitForPeriod(100)
    .limitRefreshPeriod(Duration.ofSeconds(1))
    .timeoutDuration(Duration.ofMillis(25))
    .build();
  
  // Or with Netflix Concurrency Limiter library:
  Limiter<Void> limiter = Gradient2Limit.newBuilder()
    .minWindowTime(1000)    // min 1 second window
    .sampleWindow(10)       // sample 10 windows for stability
    .build();
```

**AWS Auto-Scaling integrates this principle:**
```
ALB (Application Load Balancer) target group:
  Target: 70% CPU utilization per pod
  
  If request rate increases: CPU goes above 70% → HPA adds pods → CPU drops to 70%
  If request rate decreases: CPU drops below 70% → HPA removes pods (after stabilization window)
  
  This is macro-level adaptive capacity:
  The service capacity adapts to load, not the load adapts to capacity.
  Rate limiting + autoscaling together:
  Rate limiting protects against sudden spikes (before autoscaling kicks in, ~2-5 minutes)
  Autoscaling handles sustained load increases
```

### 7. Backpressure — Propagating Capacity Constraints Upstream

Backpressure is the mechanism by which a downstream slow consumer signals its upstream fast producer to slow down, preventing buffer overflow.

```
Without backpressure:
  Producer: emits 10,000 events/second
  Consumer: processes 1,000 events/second
  Queue fills at: 9,000 events/second
  After 60 seconds: 540,000 events queued in memory → OOM → crash
  On restart: same problem → crash loop

With backpressure:
  Consumer: signals "I can handle 1,000 events/second"
  Producer: reduces emission to 1,000 events/second
  Queue: remains stable (0 growth)
  System operates sustainably

Kafka backpressure (consumer-controlled):
  Kafka: consumer pulls messages (not pushed by broker)
  Consumer controls its own rate:
    max.poll.records=500    # max records per poll call
    max.poll.interval.ms=300000  # max 5 minutes between polls
  
  If consumer is slow: just poll less frequently → broker accumulates lag
  Consumer lag (uncommitted offset - latest offset): the natural backpressure signal
  
  KafkaConsumer (Java):
  while (running) {
    ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(100));
    
    for (ConsumerRecord<String, String> record : records) {
      processRecord(record);  // if slow: next poll waits → natural backpressure
    }
    
    consumer.commitSync();  // only commit after processing
  }
  
  Consumer is naturally backpressure-aware: it never reads faster than it processes.

Reactive Streams backpressure (Project Reactor / RxJava):
  
  // Publisher produces items only when Subscriber requests them (demand-driven)
  Flux.range(1, 1_000_000)
    .onBackpressureBuffer(1000,   // buffer up to 1000 items
      item -> log.warn("Dropped item: {}", item),  // on overflow: log and drop
      BufferOverflowStrategy.DROP_LATEST)
    .publishOn(Schedulers.boundedElastic())  // process on separate thread pool
    .subscribe(
      item -> {
        processItem(item);  // subscriber controls rate via request(n)
      }
    );
  
  // Manual demand control:
  Flux.range(1, 1_000_000).subscribe(new BaseSubscriber<Integer>() {
    @Override
    protected void hookOnSubscribe(Subscription subscription) {
      request(10);  // request only 10 items initially
    }
    
    @Override
    protected void hookOnNext(Integer value) {
      processItem(value);
      request(10);  // request 10 more after processing
    }
  });
  
  // This is the reactive streams protocol: Subscriber requests N items from Publisher
  // Publisher can only emit N items until next request
  // → Natural backpressure: Producer waits for Subscriber to be ready
```

**TCP backpressure (built-in):**
```
TCP flow control: the foundation of network backpressure

Receive window (rwnd): receiver advertises how much buffer space it has
  → If consumer buffer full: rwnd=0 → sender stops transmitting
  → When buffer drains: rwnd increases → sender resumes

Application-level: if your service reads from a TCP socket slowly:
  TCP buffer fills → receiver sends rwnd=0 → sender blocks on write
  → The backpressure propagates from application → TCP → network → sender application
  
This is why slow consumers naturally slow down producers in TCP-based systems:
  Without explicit backpressure code, TCP itself provides a form of backpressure
  via buffer pressure and flow control.
  
But: TCP buffers are finite (~4MB default). If application doesn't consume fast enough,
     TCP buffer fills, connection blocks, sender blocks — which can cause its own problems.
     Application-level backpressure signals this earlier, more gracefully.
```

### 8. Load Shedding — Accepting Less to Serve More

Load shedding is the decision to deliberately drop or reject some requests when the system is overloaded, rather than allowing all requests to degrade together.

```
The overload collapse problem:
  Service capacity: 1,000 RPS at 100ms p99
  Incoming load: 2,000 RPS
  
  Without load shedding:
    All 2,000 requests enter the service
    Service is 2× overloaded → queue builds
    Queue depth at 1 second: 1,000 requests waiting
    Latency: requests wait 1+ second in queue
    At 5 seconds: 5,000 requests queued → memory pressure → GC → slower processing
    Positive feedback: slower processing → more queue growth → more GC → faster degradation
    Eventual: service crashes (OOM) or all requests timeout (0% served)
  
  With load shedding (accept 1,000, reject 1,000):
    1,000 requests: served at 100ms p99 (nominal performance)
    1,000 requests: immediately rejected (503) → clients retry later or see error
    Service: operates at capacity, stable
    Result: 50% of requests succeed vs 0% in the collapse scenario

Load shedding strategies:

1. Queue depth shedding:
   if len(request_queue) > QUEUE_LIMIT:
     return 503("Service temporarily at capacity")
   else:
     enqueue(request)
   
   Simple. But: queue fills faster than you think during a spike.
   Requests at the front of queue may still wait too long.

2. Latency-based shedding (timeout before processing):
   if estimated_wait_time > MAX_ACCEPTABLE_WAIT:
     return 503("Estimated wait time exceeds threshold")
   
   Better: considers request age, not just queue size
   Implementation: timestamp each request on arrival; shed if (now - arrival) > threshold

3. Priority-based shedding:
   Not all requests are equal. Shed low-priority requests first.
   
   Priority tiers:
     P0 (never shed): health checks, authentication
     P1 (shed last): payment processing, checkout
     P2 (shed under moderate load): search, recommendations
     P3 (shed first): analytics events, non-critical logging
   
   Implementation:
     Priority extracted from request header or endpoint path
     Priority queue: serve P0 first, P1 next, etc.
     Under overload: stop accepting P3 first, then P2 if still overloaded
   
   Spring Boot example:
   @Component
   public class PriorityLoadShedder {
     private final Semaphore p1Semaphore = new Semaphore(80);  // 80 concurrent P1
     private final Semaphore p2Semaphore = new Semaphore(15);  // 15 concurrent P2
     private final Semaphore p3Semaphore = new Semaphore(5);   // 5 concurrent P3
     
     public boolean tryAcquire(RequestPriority priority) {
       return switch (priority) {
         case P1 -> p1Semaphore.tryAcquire();
         case P2 -> p1Semaphore.tryAcquire() && p2Semaphore.tryAcquire();
         case P3 -> p1Semaphore.tryAcquire() && p2Semaphore.tryAcquire()
                    && p3Semaphore.tryAcquire();
       };
     }
   }
   // P3 requests use capacity from all three semaphores → exhausted first under load

4. Probabilistic shedding (LIFO queue trick):
   Under overload: process last-in requests, reject old requests
   Rationale: old requests may already be timed out by the client
   Processing them wastes capacity (result never received by impatient client)
   
   Implementation: bounded LIFO queue (stack) under overload
   Last-in, first-out → newest requests processed → older ones shed after timeout
```

**HTTP 429 vs 503 — which to return?**
```
429 Too Many Requests:
  Use when: client is rate limited (their rate is too high)
  Client action: slow down, wait Retry-After, exponential backoff
  Headers:
    Retry-After: 60           # retry in 60 seconds
    X-RateLimit-Limit: 100
    X-RateLimit-Remaining: 0
    X-RateLimit-Reset: 1705329600

503 Service Unavailable:
  Use when: service is temporarily overloaded (not client's fault)
  Client action: retry with backoff (service will recover)
  Headers:
    Retry-After: 5            # retry in 5 seconds
  
Distinction matters for client behavior:
  429: client reduces its request rate
  503: client retries after delay (at same rate — service will handle it when recovered)
```

### 9. Request Hedging — Latency vs Load Trade-off

Request hedging sends a duplicate request to a second instance if the first doesn't respond within a threshold. This reduces tail latency at the cost of extra load.

```
Problem: p99 latency = 200ms. But p999 = 2 seconds (GC pauses, slow nodes, etc.)
         1 in 1000 requests waits 2 seconds → bad user experience

Hedged requests:
  T=0: Send request to Server A
  T=50ms: Server A hasn't responded (threshold: 50ms)
           Send same request to Server B (hedge)
  T=100ms: Server A responds → use response, cancel request to Server B
           (or Server B responds first)
  
  P999 latency with hedging:
    Probability both A and B are slow (> 50ms): P(A slow) × P(B slow)
    If P(A slow) = 0.001 (p999): P(both slow) = 0.000001 (1 in 1M)
    → p999 drops dramatically

Cost: extra load ~(threshold/avg_latency) × 100%
  With 50ms threshold and 20ms avg latency: ~2.5% extra load (acceptable)
  With 50ms threshold and 200ms avg latency: ~25% extra load (potentially too much)

When NOT to use hedging:
  Non-idempotent operations (POST creating a resource → two creates!)
  Side-effecting operations (charging a payment → two charges!)
  Only hedge: GET requests and idempotent operations

Envoy automatic retry (similar to hedging):
  route_config:
    retry_policy:
      retry_on: "5xx,deadline-exceeded"
      num_retries: 1
      per_try_timeout: 50ms   # hedge after 50ms
      hedge_on_per_try_timeout: true  # concurrent hedge, not serial retry
```

---

## Step-by-Step Execution

### Designing a Rate Limiting Architecture for an API Platform

```
Requirements:
  - 1M API clients
  - Per-client rate limits based on subscription tier
  - Global rate limit: 100K RPS total API capacity
  - Response time: rate limit check must add < 2ms to p99 latency
  - Graceful degradation: if rate limiter fails, allow traffic (fail open)

Step 1: Choose algorithm
  - Per-client: Token Bucket (allows natural bursts, easy to understand)
  - Global: Sliding Window Counter (efficient for overall capacity check)

Step 2: Choose implementation tier
  - API Gateway (Kong/AWS Gateway): handles per-key rate limits in Lua plugins
  - Redis backend: shared state across gateway instances
  - Local approximate rate limiter: avoid Redis for very high frequency checks

Step 3: Tier configuration
  Free:       100 req/min, burst=10  → token bucket: capacity=10, refill=100/60=1.67/s
  Pro:        1000 req/min, burst=50 → capacity=50, refill=16.7/s
  Enterprise: 10000 req/min          → capacity=500, refill=167/s

Step 4: Headers (RFC 6585 + draft-ietf-httpapi-ratelimit-headers)
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 47
  X-RateLimit-Reset: 1705329660  (Unix timestamp when bucket fully refills)
  Retry-After: 30               (only on 429 response)

Step 5: Failure mode design
  Redis unavailable: allow traffic through (fail open)
    Implementation: try/catch around Redis calls → on exception: return allowed=true
    Alert: PagerDuty if rate limiter Redis is down > 30 seconds
    Risk: brief period of unthrottled traffic during Redis outage

Step 6: Monitoring
  Metrics:
    rate_limit_allowed_total{tier="free", endpoint="/api/orders"}: counter
    rate_limit_rejected_total{tier="free", endpoint="/api/orders"}: counter
    rate_limit_redis_latency_seconds: histogram
  
  Alerts:
    rate_limit_rejected_total rate > 100/second for tier=enterprise: alert (legitimate traffic being shed)
    rate_limit_redis_latency_seconds p99 > 10ms: alert (Redis slow)
    rate_limit_redis_errors_total rate > 0: alert (Redis unreachable)

Step 7: Client guidance (documentation)
  Clients should implement exponential backoff on 429:
  base_delay = 1 second
  max_delay = 60 seconds
  delay = min(base_delay × 2^retry_count + jitter(0-1s), max_delay)
```

---

## Deep Dive

### The Thundering Herd Problem at Rate Limit Reset

```
Fixed window rate limit: 1000 requests per minute.
  100 clients each limited to 10 req/min.
  
  At t=0 (window start): all 100 clients have full quota
  → All send 10 requests simultaneously
  → 1000 requests in the first second
  → Service overwhelmed for 1 second before recovering

  At t=60 (window reset): same thing repeats.
  Pattern: massive spike every 60 seconds.

The Thundering Herd Solutions:

1. Token Bucket (natural smoothing):
   Tokens refill continuously (e.g., 10 tokens/minute = 1 token every 6 seconds)
   Clients can only burst to bucket capacity (not unlimited at reset)
   → Natural smoothing: no synchronized reset spike

2. Jittered retry for rate-limited clients:
   All 100 clients receive 429 simultaneously.
   All retry after exactly Retry-After=60 seconds.
   → Same thundering herd at t=60 (retry storm).
   
   Fix: add random jitter to Retry-After:
   Retry-After: 60 + random(0, 30)  # retry between 60 and 90 seconds
   → Clients spread their retries across a 30-second window
   → Load smoothed

3. Window offset per client:
   Hash the client ID to offset their window start:
   window_start = floor((now + hash(client_id) % 60) / 60) × 60
   Each client's window starts at a different second within the minute
   → Resets distributed across 60 seconds (no synchronized burst)

4. Leaky bucket (strictly smooth output):
   Output rate: constant, regardless of input
   → Downstream service sees steady, smooth request rate
   → No bursts at any point
```

### The 503 Retry Storm — When Load Shedding Creates More Load

```
Service at 90% capacity (900 RPS, limit 1000 RPS).
Traffic spike: arrives at 1200 RPS.
Load shedder: rejects 200 RPS with 503.

Clients receive 503 responses:
  Each client: "503 received. Retry." → immediately retries.
  200 clients × 1 retry each = 200 extra requests immediately.
  
  Now: 1200 (original) + 200 (retries) = 1400 RPS.
  Load shedder: rejects 400 RPS.
  400 clients retry: 400 extra requests.
  
  1200 + 400 = 1600 RPS.
  Exponential growth of retries → service overwhelmed by retry storm.

Fix: Rate limit retries + exponential backoff.
  On 503: clients MUST back off before retrying.
  Retry-After header: Retry-After: 5  (retry after 5 seconds minimum)
  Client retry logic:
    if response.status == 503:
      delay = min(base_delay × 2^attempt + jitter, max_delay)
      sleep(delay)
      retry()  # NOT immediately

Service-side: circuit breaker for 503 responses.
  If client receives 5 consecutive 503: open circuit breaker.
  Wait 30 seconds before trying again (half-open state).
  → Client does not retry constantly → retry storm prevented.

Rate limit on 503 retries (at the gateway):
  Track: how many 503 responses per client in last minute.
  If > threshold: apply exponential backoff to subsequent requests from this client.
  "If you're getting 503s, you're sending too fast even for load conditions."
```

---

## Real-World Example

### Stripe's Rate Limiting Architecture

Stripe processes payments for millions of businesses. They implement multi-layer rate limiting:

**Layer 1: Per-account rate limits**
Every Stripe account has a rate limit based on their account tier. The limits are enforced at the API gateway level using a sliding window counter with Redis.

**Layer 2: Endpoint-specific limits**
Some endpoints (e.g., `charges.create`) are more expensive than others (`charges.retrieve`). Stripe uses a "cost" model: each endpoint has a cost unit, and the rate limit is in cost units per second rather than requests per second. Creating a charge costs 10 units; retrieving costs 1 unit.

**Layer 3: Global circuit breaker**
If any service in Stripe's stack shows elevated error rates, a global circuit breaker reduces the rate limit for all accounts automatically (sacrificing some capacity to protect the system).

**Stripe's public rate limit headers:**
```
X-RateLimit-Limit: 100         # requests per second (your limit)
X-RateLimit-Remaining: 47      # remaining in current window
X-RateLimit-Reset: 1705329660  # Unix timestamp of window reset
Retry-After: 30                # only on 429
```

**Stripe SDK backoff behavior:**
The official Stripe SDKs implement automatic retry with exponential backoff for 429 and 503 responses. This is intentional API design: the rate limiter and the client SDK work together.

---

## Failure Scenarios

### Scenario 1: Redis Rate Limiter Failure Causing Service Overload

```
API gateway: uses Redis for per-user rate limiting.
Redis: primary fails. Failover to replica (Sentinel).
Sentinel failover: 15 seconds to elect new primary.

During 15-second failover:
  API gateway: Redis connection timeout (500ms) on every request.
  Gateway behavior (fail-open): "Redis unavailable → allow all traffic."
  
  Traffic: suddenly unlimited. All 100K clients send at their maximum rate.
  Backend services: receive 10× normal traffic (normally rate-limited to 10% of max).
  Database: connection pool exhausted. Latency: 10ms → 5 seconds.
  Services: return 503 (from DB timeout).
  Clients: retry → more load → more 503s.

Recovery:
  Redis restored at T=15s.
  Rate limiting re-engaged. Traffic returns to normal.
  But: database connection pool still recovering.
  Database recovery: 30-60 more seconds.
  
  Total impact: 75 seconds of degraded service (15s Redis down + 60s DB recovery).

Prevention:
  1. Local fallback rate limiter: if Redis is unavailable, use local token bucket
     (less accurate but better than unlimited)
  2. Redis Cluster or Redis Sentinel with faster failover (< 5 seconds target)
  3. Pre-emptive traffic shaping at edge CDN (Cloudflare, Fastly) → limits before reaching Redis
  4. Database connection pool: retry limit + fast-fail (don't hold connection waiting)
```

### Scenario 2: Backpressure Failure — Kafka Consumer Lag Spiral

```
Order processing consumer: processes 10,000 orders/hour.
Flash sale event: order rate spikes to 100,000 orders/hour.

Without backpressure control:
  Kafka lag begins growing: 90,000 orders/hour lag rate.
  After 1 hour: 90,000 orders backlogged in Kafka.
  
  Consumer: max.poll.records=500, processing 10 records/second.
  To process 90,000 backlogged orders: 9,000 seconds = 2.5 hours.
  
  Consumer behavior: polls Kafka, gets 500 records, processes all 500 before next poll.
  Each batch: 500 records × external API call × 100ms = 50 seconds per batch.
  But: max.poll.interval.ms=300000 (5 minutes default).
  
  If processing a batch takes > 5 minutes (500 × 10s): Kafka considers consumer dead.
  Kafka: triggers rebalance → consumer kicked out of group.
  Consumer rejoins → reprocesses the same batch → same problem.
  Infinite rebalance loop.

Fix:
  1. Reduce max.poll.records to match processing capacity:
     Processing: 10 records/second.
     Poll interval: 10 seconds (max.poll.interval.ms=10000).
     max.poll.records = 10 × 10 = 100 (process 100 records, takes ~10 seconds).
     Consumer stays within max.poll.interval.ms → no rebalance.
  
  2. Separate I/O from processing (async processing):
     Poll records (fast) → add to local queue → async worker processes.
     Commit offsets only after processing completes (not after poll).
     
  3. Scale consumers horizontally:
     Flash sale: add 9 more consumer instances (10× throughput).
     Each consumer handles 1 of 10 Kafka partitions.
     Requires: order topic has ≥ 10 partitions (pre-provisioned).
  
  4. Alert on consumer lag:
     consumer_group_lag > 10000 → alert → spin up additional consumers (KEDA)
```

---

## Performance Considerations

### Rate Limiter Overhead Budget

```
At 10,000 RPS per pod:
  Rate limiter check: must complete in < 0.1ms (1% of 10ms avg request time)
  
  Local (in-process) rate limiter: < 0.01ms (nanoseconds — just a mutex + counter)
  Redis rate limiter (LAN): 0.3-1ms (network round trip)
  Redis rate limiter (cross-AZ): 1-5ms (cross-datacenter network)
  
  At 10,000 RPS: Redis adds 3,000-10,000ms of overhead per second of processing
  = 3-10 CPU cores consumed just for rate limiting Redis calls.
  
  Optimization: batch Redis calls
  Instead of: check rate limit for every request (10,000 Redis calls/second)
  Use: approximate local limiter that syncs every 100 requests
       → 100 Redis calls/second (100× reduction in overhead)
  
  Accuracy tradeoff: ±10% overshoot between sync intervals
  For most use cases: acceptable (rate limits are approximate by nature)

Lua script performance:
  Redis processes Lua scripts as a single atomic command.
  Lua script execution: ~0.1ms for simple scripts
  vs: multiple MULTI/EXEC commands: ~0.5ms (more round trips, locking)
  → Always use Lua for atomic rate limiting operations
```

---

## Trade-offs

| Algorithm | Memory | Accuracy | Burst Handling | Implementation |
|-----------|--------|----------|----------------|----------------|
| Fixed Window | O(1) | Poor (boundary burst) | Poor | Trivial |
| Sliding Window Log | O(requests) | Exact | Good | Complex |
| Sliding Window Counter | O(1) | Good (~±8%) | Good | Simple |
| Token Bucket | O(1) | Good | Excellent (allows burst to capacity) | Medium |
| Leaky Bucket | O(queue) | Exact (smoothed) | None (strictly smooth) | Medium |

| Layer | Coverage | Granularity | Latency Cost |
|-------|----------|-------------|--------------|
| CDN / Edge | Global (all traffic) | IP-level | Lowest (before reaching infra) |
| API Gateway | All API traffic | API key / user | Low |
| Service Mesh | Service-to-service | Per service | Low |
| Application | Full business context | Per operation, per tier | Medium |

---

## Production Considerations

1. **Always implement fail-open for rate limiters.** If Redis is unavailable and you fail-closed (reject all requests), your rate limiter has become a service outage. Fail-open (allow traffic) with an alert is the correct default. The brief period of unthrottled traffic during a Redis outage is a controlled risk; total service unavailability is not.
2. **Add jitter to `Retry-After` headers.** A fixed `Retry-After: 60` causes all rate-limited clients to retry simultaneously at T+60, recreating the overload. Add random jitter: `Retry-After: 60 + random(0, 30)`.
3. **Rate limit error responses (429/503) themselves.** Clients that receive 429 and immediately retry (without backoff) generate more load. Apply a secondary rate limit: if a client has received 10 consecutive 429s in 1 minute, apply a longer backoff window.
4. **Monitor rejected request rates by endpoint and tier.** If enterprise tier clients are being rate limited frequently, your limits may be too low for their legitimate usage. Rate limits should be tuned based on observed behavior, not guesswork.
5. **Separate rate limit Redis from other Redis instances.** Rate limiting requires low latency (< 1ms). Sharing Redis with caching (which may have large values and memory pressure) risks eviction of rate limit keys or latency spikes from memory operations.
6. **Implement priority-based load shedding.** Under overload, shed analytics events and non-critical reads before checkout and payment operations. Explicitly define your priority tiers per endpoint and test that the shedding logic is correct.

---

## Common Beginner Mistakes

1. **Fixed window rate limiting without accounting for boundary bursts.** A limit of 100 requests per minute implemented as a fixed window allows 200 requests in 2 seconds at the window boundary. Use token bucket or sliding window counter for production rate limiting.
2. **Rate limiting only at the service level (not at the gateway).** Rate limiting at the service means the request has already consumed server resources (connection, thread, parsing) before being rejected. Rate limit at the API gateway to shed load before it reaches services.
3. **Not returning `Retry-After` headers on 429 responses.** Without `Retry-After`, clients don't know when to retry — they may retry immediately (amplifying load) or give up entirely. `Retry-After` is required by RFC 6585 for 429 responses.
4. **Setting concurrency limits without accounting for service startup.** A new pod has an empty connection pool and cold JVM. Its first N requests are slower than steady state. If the concurrency limiter is set for steady-state performance, it may reject too aggressively during warmup. Use `initialDelaySeconds` on the limiter, or ramp up the limit over 60 seconds.

---

## Common Senior Engineer Mistakes

1. **Global rate limit divided equally across pods (not accounting for pod scaling).** "Global limit 10,000 RPS / 10 pods = 1,000 RPS per pod." When autoscaling adds 5 more pods, the global limit is now effectively 15,000 RPS (15 × 1,000). The rate limit moves with the pod count — not what was intended. Solution: use a central Redis-based global rate limiter, not per-pod limits.
2. **Load shedding at the wrong layer (too deep).** If you shed requests after they've been decoded, authenticated, and routed to a handler — you've already done most of the work. Shed as early as possible (at the socket accept level or in the first middleware layer) to minimize wasted work.
3. **Backpressure that propagates too aggressively.** If every slow response from Service B causes Service A to immediately reject new requests (backpressure), a brief B slowdown causes an A outage. Backpressure should have a buffer/lag window: "if B has been slow for > 30 seconds AND my queue is growing" before propagating.
4. **Not testing backpressure under realistic load patterns.** Backpressure behavior is emergent — it's hard to reason about in isolation. Always test: "what happens to my service when the downstream dependency runs at 10% speed?" without this test, backpressure failure modes are discovered in production.

---

## Architecture Smells

- **No rate limiting on public endpoints** → one misbehaving client can exhaust the service for everyone
- **Fixed window rate limiting** → boundary burst allows 2× the intended rate
- **Rate limiter that fails closed** → rate limiter outage = service outage
- **No `Retry-After` on 429** → clients retry immediately → retry storm
- **Queue that grows without bound** → OOM under sustained overload (no backpressure)
- **Load shedding after request processing** → wasted resources; shed at the earliest possible point
- **Rate limit Redis shared with application cache** → cache pressure evicts rate limit keys → rate limiting silently disabled

---

## Principal Engineer Perspective

Rate limiting is an API contract and a capacity management tool simultaneously. When you set a rate limit, you are making a promise to clients: "If you stay within this limit, we will serve you. If you exceed it, we will signal this clearly so you can adapt." The design of rate limiting is therefore a product decision as much as a technical one.

**The Principal Engineer's rate limiting questions:**

1. **What is the natural burst pattern of your clients?** Mobile apps: burst on startup (load feed, profile, notifications simultaneously). Payment processors: steady trickle. Analytics events: high volume, bursty. The rate limit algorithm must match the client's natural behavior — a token bucket for bursty clients, leaky bucket for smooth outbound calls.

2. **What is the cost model?** Not all requests are equal. A "search all orders" request is 100× more expensive than "get order by ID." Rate limit by cost (points), not just by count. Stripe, GitHub, and Shopify all use cost-based rate limiting.

3. **Where is the bottleneck?** Rate limiting at the API gateway is cheap but coarse. Rate limiting in the service is expensive but precise. The correct answer: rate limit at the gateway for external traffic, rate limit at the service for cross-service traffic, and use adaptive concurrency limits to handle dynamic capacity.

4. **What happens to legitimate enterprise clients during a Redis outage?** If you fail-open during Redis unavailability, enterprise clients who are near their limit may suddenly see unlimited capacity. If you fail-closed, they see 429s even though your service has capacity. Neither is ideal — the right answer depends on your SLA and trust model.

5. **How do clients know they're rate limited before it happens?** Proactive communication: if a client is approaching 80% of their rate limit, include `X-RateLimit-Remaining` in every response. Well-designed clients can back off before hitting the limit — reducing rejected requests and improving their experience.

---

## Architecture Review Questions

1. Is rate limiting applied at the API gateway level for all public endpoints?
2. What algorithm is used? Does it correctly handle burst traffic (token bucket) or is it fixed window (boundary burst risk)?
3. What happens when the rate limiting backend (Redis) is unavailable — fail-open or fail-closed? Is this the intended behavior?
4. Do 429 responses include `Retry-After` and `X-RateLimit-*` headers?
5. Is there a per-tier rate limit for different subscription levels?
6. Is backpressure implemented in all Kafka consumers? Is `max.poll.records` tuned to sustainable processing capacity?
7. Is there load shedding for overload scenarios? Is it priority-based (critical operations shed last)?
8. Is there monitoring for: rate limit rejection rate, consumer lag, queue depth, concurrency utilization?
9. Are retry behaviors tested — specifically, does a 503 during overload trigger a retry storm?
10. Is adaptive concurrency limiting used, or are concurrency limits manually configured (and therefore potentially stale)?

---

## Visual / Animation Specification

### Animation 1: Token Bucket — Burst and Drain

**Visual: a bucket with a water level indicator, a faucet (refill) at the top, and a drain (requests) at the bottom.**

**T=0:** Bucket is full (100 tokens). No traffic. Faucet drips slowly (10 tokens/second).

**Burst event:** 80 tokens drain rapidly (80 requests arrive). Bucket: 20 tokens. Requests served: green arrows fly out.

**High traffic:** Requests arrive faster than refill. Bucket drains to 0. "EMPTY" indicator flashes red. Next 5 requests: bounce off bucket (rejected). "429 Too Many Requests" label appears.

**Recovery:** No new requests for 10 seconds. Faucet fills bucket: 0 → 100 tokens. Traffic resumes: all served.

**Caption:** "Allows burst up to capacity. Controls sustained rate via refill speed. Excess rejected with 429."

### Animation 2: Backpressure Propagation

**Three boxes: Producer → Queue → Consumer.**

**Phase 1 (balanced):** Producer emits 10 items/second. Consumer processes 10 items/second. Queue: stable at 0 items.

**Phase 2 (consumer slows):** Consumer slows to 5 items/second (dependency slow). Queue fills: 5 items → 50 items → 500 items. Queue turns yellow (warning), then red (overflow).

**Without backpressure:** Queue overflows. Items drop (X marks). Consumer crashes (OOM indicator).

**With backpressure:** Queue fills to threshold (50). Signal sent upstream: "Consumer at capacity, slow down." Arrow flows backwards: Consumer → Queue → Producer. Producer reduces: 10 → 5 items/second. Queue: stabilizes at 50. System sustainable.

**Caption:** "Backpressure: capacity constraint propagates upstream. Queue stabilizes. No overflow. No crash."

---

## Hands-On Tutorial

### Token Bucket Rate Limiter with Redis

```python
# Complete implementation: token bucket rate limiter + middleware

import redis
import time
import functools
from flask import Flask, request, jsonify, g

app = Flask(__name__)
r = redis.Redis(host='localhost', port=6379, decode_responses=True)

TOKEN_BUCKET_SCRIPT = """
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local requested = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

local state = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(state[1]) or capacity
local last_refill = tonumber(state[2]) or now

local elapsed_ms = now - last_refill
local tokens_to_add = (elapsed_ms / 1000) * refill_rate
tokens = math.min(capacity, tokens + tokens_to_add)

local allowed = 0
local retry_after = 0

if tokens >= requested then
    tokens = tokens - requested
    allowed = 1
else
    local deficit = requested - tokens
    retry_after = math.ceil((deficit / refill_rate) * 1000)
end

local ttl = math.ceil((capacity / refill_rate) * 1000) + 1000
redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
redis.call('PEXPIRE', key, ttl)
return {allowed, math.floor(tokens), retry_after}
"""

rate_limiter_script = r.register_script(TOKEN_BUCKET_SCRIPT)

TIER_CONFIG = {
    "free": {"capacity": 10, "refill_rate": 1.67},      # 100/min
    "pro": {"capacity": 50, "refill_rate": 16.7},         # 1000/min
    "enterprise": {"capacity": 500, "refill_rate": 167},  # 10000/min
}

def rate_limit(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        api_key = request.headers.get('X-API-Key', 'anonymous')
        tier = get_tier_for_key(api_key)  # lookup tier from DB/cache
        config = TIER_CONFIG.get(tier, TIER_CONFIG["free"])
        
        try:
            now_ms = int(time.time() * 1000)
            result = rate_limiter_script(
                keys=[f"ratelimit:{api_key}"],
                args=[config["capacity"], config["refill_rate"], 1, now_ms]
            )
            allowed, remaining, retry_after_ms = result
        except redis.RedisError:
            # Fail open: Redis unavailable → allow traffic
            allowed, remaining = 1, -1  # -1 signals "unknown" to client
        
        if not allowed:
            response = jsonify({
                "error": "rate_limit_exceeded",
                "message": "Too many requests. See Retry-After header."
            })
            response.status_code = 429
            response.headers['Retry-After'] = str(retry_after_ms // 1000 + 1)
            response.headers['X-RateLimit-Limit'] = str(config["capacity"])
            response.headers['X-RateLimit-Remaining'] = "0"
            return response
        
        g.rate_limit_remaining = remaining
        g.rate_limit_limit = config["capacity"]
        response = f(*args, **kwargs)
        response.headers['X-RateLimit-Limit'] = str(config["capacity"])
        response.headers['X-RateLimit-Remaining'] = str(remaining)
        return response
    return decorated

@app.route('/api/orders', methods=['GET'])
@rate_limit
def get_orders():
    return jsonify({"orders": []})

if __name__ == '__main__':
    app.run()
```

```bash
# Test rate limiting:
# Install dependencies:
pip install flask redis

# Start Redis:
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Run the service:
python app.py &

# Test normal requests:
for i in $(seq 1 5); do
  curl -s -o /dev/null -w "Status: %{http_code}, Remaining: %{header.x-ratelimit-remaining}\n" \
    -H "X-API-Key: user123" \
    http://localhost:5000/api/orders
done

# Exhaust the rate limit:
for i in $(seq 1 20); do
  curl -s -o /dev/null -w "Status: %{http_code}\n" \
    -H "X-API-Key: user123" \
    http://localhost:5000/api/orders
done
# → Should see 429 after the bucket is exhausted

# Monitor Redis:
redis-cli monitor | grep ratelimit  # watch rate limit key updates
```

---

## Exercises

**Conceptual:**
1. Explain the boundary burst problem with fixed window rate limiting. Give a specific example with numbers showing how a 100 req/minute limit can allow 200 requests in 2 seconds.
2. What is the difference between rate limiting and throttling? Give one use case where you would apply each.
3. Explain the token bucket algorithm. What does the bucket capacity control? What does the refill rate control? How do they interact?
4. What is backpressure? How does TCP implement backpressure natively? Why is application-level backpressure needed in addition to TCP backpressure?
5. What is load shedding? Why is it preferable to letting all requests degrade simultaneously under overload?

**Architecture:**
6. Design a rate limiting system for a public API with 3 tiers (free: 100/min, pro: 1000/min, enterprise: 10000/min) and 1M total users. Address: algorithm choice, storage choice, failure mode, and headers.
7. A Kafka consumer is processing orders at 1,000/second. During Black Friday, the producer sends 10,000 orders/second. After 1 hour, the consumer crashes (OOM). Design the fix using backpressure principles.
8. A service is experiencing cascading failure: under overload, it becomes so slow that clients retry, which adds more load. Design a load shedding strategy that prevents this collapse.

**Quantitative:**
9. Token bucket: capacity=100, refill_rate=10/second. A client sends 150 requests in the first 5 seconds at a rate of 30/second. How many requests are allowed? How many are rejected? After the 150 requests, how long until the client can make another request?
10. Sliding window counter: window=60s, limit=100. At T=75s, the previous window (0-60s) had 80 requests, and the current window (60-120s) has 40 requests so far. How many additional requests can the client make? Show the calculation.

---

## Solutions

### Exercise 9

**Token bucket: capacity=100, refill_rate=10/s**

**Initial state:** bucket = 100 tokens (full).

**Requests at 30/s for 5 seconds = 150 requests:**
- T=0: 100 tokens available. 30 requests arrive. 30 consumed. Bucket: 70 tokens.
- Refill during first second: 10 tokens. Net: 70 tokens available.
- T=1: 30 requests. 30 consumed. Bucket: 40 + 10 refill = 50 tokens.
- T=2: 30 requests. 30 consumed. Bucket: 50 + 10 - 30 = 30 tokens.
- T=3: 30 requests. 30 consumed. Bucket: 30 + 10 - 30 = 10 tokens.
- T=4: 30 requests. Only 10 + 10 = 20 tokens available. **20 accepted, 10 rejected**.

**Total over 5 seconds:**
- Allowed: 30 + 30 + 30 + 30 + 20 = **140 requests**
- Rejected: **10 requests** (at T=4)

**Wait time after T=4:** bucket is at 0. Need 1 token to proceed. Refill rate = 10/s. Wait = **0.1 seconds (100ms)**.

### Exercise 10

**Sliding window counter:**
- Elapsed in current window: T=75s in window 60-120 → elapsed = 75-60 = 15s
- Time overlap weight of previous window: `(1 - 15/60) = 0.75`
- Estimated count: `80 × 0.75 + 40 = 60 + 40 = 100`
- Limit: 100. Estimated = 100. **No additional requests allowed** (at exact limit).
- After 1 more second (T=76): `80 × (1 - 16/60) + 40 = 80 × 0.733 + 40 = 58.67 + 40 = 98.67 → 1 request allowed`.

---

## Interview Questions

### Beginner
- What is rate limiting? Why is it needed?
- What is the difference between a 429 and a 503 response?
- What is backpressure? Give a real-world analogy.

### Senior
- Explain the token bucket algorithm. How does it differ from a fixed window counter?
- What is the boundary burst problem? How do you solve it?
- How would you implement a distributed rate limiter across 10 pods of a service?
- What is load shedding? When should you shed load instead of queueing it?

### Staff
- Design a rate limiting system for a payment API with 1M clients, 3 tiers, and a 99.99% availability requirement for the rate limiter itself.
- A service is experiencing a 503 retry storm: clients receive 503 and immediately retry, causing more 503s. Walk through the diagnosis and the fix.
- Explain adaptive concurrency limiting. How does it differ from static concurrency limits? What metric does it track?

### Principal
- Design the complete overload management strategy for a global API platform: rate limiting, throttling, load shedding, and backpressure. Include: failure modes for each layer, monitoring strategy, and client-side guidance.
- Your API platform serves 10M clients. During a Redis outage (rate limiter backend), what happens? What are your options, and what does each option sacrifice? Which would you implement and why?
- A Principal Engineer argues that rate limiting is unnecessary because the system should scale to handle any load. Write the counter-argument, including specific failure modes that scaling alone cannot prevent.

---

## Summary

Rate limiting, throttling, and backpressure are the engineering discipline of controlled degradation:

- **Algorithms:** Fixed Window (simple, boundary burst problem) → Sliding Window Counter (accurate, O(1) memory) → Token Bucket (burst-friendly, smoothed rate) → Leaky Bucket (strictly smooth output). Token Bucket is the default for API rate limiting; Leaky Bucket for outbound calls to external APIs.
- **Layers:** CDN/Edge (IP-level, cheapest) → API Gateway (API key/user-level) → Service Mesh (service-to-service) → Application (business context, tiered). Layer choice = tradeoff between latency cost and granularity.
- **Distributed rate limiting:** Central Redis (accurate, Redis dependency) vs Local approximate (efficient, ±10% accuracy) vs Gateway-only (simple, coarse). Fail-open on Redis unavailability.
- **Backpressure:** Consumer controls its own rate. TCP provides primitive backpressure (rwnd). Application-level: reactive streams demand, Kafka pull model, bounded queues.
- **Load shedding:** Drop P3 (analytics) before P1 (payments). LIFO queue under overload (newest requests most likely to have live clients). Always return `Retry-After`.
- **Thundering herd:** Jitter on `Retry-After`, token bucket instead of fixed window, distributed window start times.
- **Adaptive concurrency (Gradient2):** Self-tuning limit based on RTT gradient — no static configuration, adapts to dependency health.

---

## What You Should Now Be Able To Explain

- ✅ Why token bucket is superior to fixed window for API rate limiting (no boundary burst, burst-friendly)
- ✅ The Lua script approach for atomic Redis rate limiting (no race condition)
- ✅ Why distributed rate limiting divides by pod count is wrong (pod count is dynamic)
- ✅ How Kafka consumers implement natural backpressure (pull-based, max.poll.records)
- ✅ Why load shedding produces better outcomes than queueing under overload (collapse avoidance)
- ✅ The 503 retry storm mechanism and its prevention (Retry-After + exponential backoff)

---

## What To Learn Next

**Chapter 20 — Distributed Transactions and Idempotency.** You have learned the individual building blocks — Sagas for cross-service consistency (Chapter 18) and rate limiting to protect services (Chapter 19). Chapter 20 goes deeper into the correctness guarantees required for financial-grade distributed operations: exactly-once semantics vs at-least-once, idempotency keys at the database level, the dual-write problem and its solutions, and how payment systems guarantee that a charge happens exactly once even when the network is unreliable.
