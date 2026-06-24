# Domain 2 — System Design + Architecture (Interview Reference)

Answers to every concept in `system-design.pdf`, written the way you'd say them in an interview. Each section has: **the crisp answer**, a **deeper explanation**, **why it matters**, and a **what-to-say-out-loud** line.

---

## 1. Functional Decomposition

**What it is:** Breaking a large system into independent services, each owning a single business capability (a *bounded context*). You decompose by *domain ownership*, not by technical layer.

**Deeper explanation:** The instinct of a junior engineer is to split by technical layer — a "database team," a "UI team," an "API team." That's the wrong cut, because a single feature change (say, "add gift wrapping") then forces a coordinated change across all three layers and all three teams. Domain-driven decomposition cuts the other way: each service is a *vertical slice* that owns its UI contract, its business logic, and its data for one capability. Now "gift wrapping" is mostly a change inside the Cart/Order service. The litmus test is **"what changes together should live together"** — if two pieces of logic always change in the same pull request, they probably belong in the same service; if they change for completely different business reasons, split them.

A *bounded context* (a Domain-Driven Design term) is the boundary within which a particular model and its language are consistent. The word "order" might mean something subtly different to the Payment team than to the Delivery team — bounded contexts let each service define "order" its own way without forcing one global, bloated definition.

**Good decomposition gives you:**
- **Independent services** — deploy, scale, and fail in isolation. You can ship the Cart service ten times a day without redeploying Payments, and a crash in Notifications never takes down checkout.
- **Clear bounded contexts** — each service owns its data and its rules; no shared database. This is the single most important rule: if two services share a table, they're secretly one service and you've gained nothing but network latency.
- **Scalable modules** — scale the hot service independently. On Black Friday you might run 50 instances of Cart and Inventory but only 3 of Notifications.
- **Ownership domains** — one team owns one service end-to-end ("you build it, you run it"), which removes cross-team handoffs and unclear accountability.

### Worked example: Cart + Order Tracking (e-commerce)

| Service | Responsibilities |
|---|---|
| **User Service** | Authentication, user profile, session management |
| **Product Service** | Product catalog, pricing, availability |
| **Cart Service** | Add/remove item, save for later, cart persistence |
| **Inventory Service** | Stock management, reservation logic, inventory sync |
| **Order Service** | Order creation, order lifecycle, payment coordination |
| **Payment Service** | Payment processing, refunds, transaction validation |
| **Delivery Service** | Shipment tracking, ETA updates, status events |
| **Notification Service** | Email, SMS, push notifications |

**Key principles to mention:**
- **Each service owns its own DB** (database-per-service). Services talk via APIs or events, never by reaching into another service's tables. This is what actually delivers independence — shared databases recreate tight coupling.
- **High cohesion, low coupling** — things that change together live together; things that don't are kept apart behind a stable interface.
- **The Order Service is the orchestrator** for checkout. Notice it can't just call the others synchronously and hope — reserving stock, charging a card, and booking a shipment is a multi-step workflow where any step can fail. That's a distributed transaction, usually implemented as a **saga** (see §2): a sequence of local steps, each with a compensating "undo" (release stock, refund payment) if a later step fails.

> **Say out loud:** "I'd decompose by business capability, with a database per service so they're truly independent. The Order Service orchestrates the checkout saga across Inventory, Payment, and Delivery — and I'd keep that coordination asynchronous and compensatable so a slow or failed Payment provider doesn't block the cart or leave stock reserved forever."

---

## 2. Event-Driven Architecture (Kafka)

**What it is:** Services communicate **asynchronously** by publishing and consuming events instead of calling each other directly. This decouples producers from consumers — the producer doesn't know or care who's listening.

**Deeper explanation:** In a synchronous (request/response) world, the Order Service calls Inventory, waits, then calls Payment, waits, then calls Delivery. Every service must be up *at the same instant*, and the user waits for the slowest one. Worse, adding a new consumer (say, an Analytics service that wants to know about every order) means editing and redeploying the Order Service. In an event-driven world, the Order Service just announces `OrderCreated` to a topic and moves on. Anyone interested subscribes — Inventory, Analytics, Fraud-detection — and the Order Service never changes. This is **temporal decoupling** (services don't need to be up simultaneously; events wait in the log) and **producer/consumer decoupling** (the producer doesn't know its consumers).

The cost is that you trade simplicity for eventual consistency: there's now a window where the order exists but inventory hasn't been decremented yet. You also lose the easy, linear stack trace — debugging an event flow means following events across services, which is why good observability (correlation IDs, tracing) matters more here.

**Why use it:** resilience (a down consumer doesn't break the producer — events buffer in the log until it recovers), scalability (add consumers freely without touching producers), and a natural **audit log** of everything that ever happened (the event log *is* the history).

### Kafka core concepts

| Concept | What it is |
|---|---|
| **Producer** | Publishes events. e.g. Order Service emits `OrderCreated`. |
| **Consumer** | Reads events. e.g. Inventory Service updates stock. |
| **Topic** | A named, logical event channel. e.g. `order-events`, `payment-events`. |
| **Partition** | A topic is split into partitions for **parallelism and scale**. Each partition is an ordered, append-only log. |
| **Consumer Group** | A set of consumers that share the work — Kafka assigns each partition to exactly one consumer in the group, giving you **load balancing**. |

**Deeper explanation of the mental model:** Picture a topic as a giant notebook (an append-only log) that's been torn into several physical notebooks — those are partitions. Writes only ever append to the end; nothing is updated in place. Each partition keeps strict insertion order, and every event in it has a sequential offset. Consumers track "I've read up to offset N," which is how Kafka can let a crashed consumer resume exactly where it left off, and how multiple independent consumer groups can read the same topic at their own pace (Kafka doesn't delete an event when one consumer reads it — it's retained for a configured time/size, so it's a *log*, not a traditional queue).

The number of partitions is your **parallelism dial**: within one consumer group, a partition is handled by exactly one consumer, so 6 partitions means at most 6 consumers working in parallel for that group. Add a 7th consumer and it sits idle. This is why partition count is a capacity-planning decision, not an afterthought.

### Important Kafka interview topics

**At-least-once vs Exactly-once delivery**
- **At-least-once** (default, safer): every event is delivered, but if a consumer processes an event and then crashes *before* committing its offset, it'll reprocess that event on restart — creating a **duplicate**. You accept this and defend against it with idempotency.
- **Exactly-once** (EOS): no duplicates, no loss. Kafka achieves this with **idempotent producers** (each message tagged so the broker dedupes retries) plus **transactions** (the read→process→write(other topics)→commit-offset is one atomic unit). More complex and slightly slower, so reserve it for cases where a duplicate is genuinely harmful (charging a card twice).
- *(There's also at-most-once: commit the offset first, then process — if you crash mid-process the event is lost forever. Rarely what you want.)*

The deeper point: "exactly-once" is really "effectively-once." The network can always deliver a message twice; the question is whether the *end effect* happens once. EOS handles it inside Kafka; idempotent consumers handle it in your application logic. Most teams choose the latter because it's simpler and works even when an external system (a third-party payment API) is involved that Kafka transactions can't reach.

**Idempotent consumers**
"Idempotent" just means **doing the same operation twice has the same effect as doing it once.** Real-world analogy: pressing the "floor 3" button in an elevator twice doesn't send you to floor 6 — the second press is a no-op. A light switch set to "on" is idempotent; a light switch that *toggles* is not.

Why it matters here: at-least-once delivery means your consumer **will** occasionally see the same event twice (a consumer processes `PaymentRequested`, then crashes before telling Kafka "done," so on restart it gets the same event again). If your handler naively "charge the customer $50," the customer gets charged **$100**. That's a non-idempotent operation, and it's a real bug.

The fix: give every event a **unique ID**, and before acting, check "have I already processed this ID?"
- Keep a `processed_events` table (or a Redis set) of IDs you've handled. First thing the handler does: `if id in processed: skip`. Last thing: record the ID.
- Or design the operation itself to be naturally idempotent — e.g. `UPDATE orders SET status='PAID' WHERE id=123` produces the same result no matter how many times it runs (unlike "add a payment row," which duplicates). A database **upsert** (`INSERT ... ON CONFLICT DO NOTHING`) does the dedup for you.

This is *the* mechanism that makes cheap at-least-once delivery safe, so it's the answer interviewers are really fishing for when they ask "what if the same message is delivered twice?"

**Dead Letter Queue (DLQ)**
When an event fails repeatedly — malformed data, or a downstream that's broken in a way retries won't fix — you can't let it block the partition forever (remember: order is preserved per partition, so a stuck event holds up everything behind it). After N failed attempts you route it to a separate DLQ topic, log/alert on it, and keep processing the rest. Later, a human or an automated job inspects and replays it. The DLQ is your safety valve against a single **poison message** halting a whole partition.

**Ordering guarantees**
Kafka guarantees order **only within a single partition**, never across a topic. So if you need all events for one order to be processed in sequence (`Created` → `Paid` → `Shipped`), you must make them land in the same partition by using a **partition key** — set the key to `orderId` and Kafka hashes it to a fixed partition. Events for *different* orders can still spread across partitions and run in parallel. The trade-off: a hot key (one celebrity order/user) sends disproportionate traffic to one partition, which can become a bottleneck.

**Retry mechanisms**
- **Retry topics** — instead of blocking on a failed event, publish it to `order-events.retry` and reprocess it after a delay (a common pattern is tiered retry topics: 5s, 30s, 5m).
- **Backoff strategy** — wait progressively longer between attempts (**exponential backoff**, ideally with jitter) so you don't hammer an already-struggling downstream and make the outage worse.
- **Poison-message handling** — cap retries; once exhausted, send to the DLQ rather than retrying forever.

### Event flow example (checkout saga)
1. User places order
2. Order Service publishes `OrderCreated`
3. Inventory Service reserves stock
4. Payment Service processes payment
5. Delivery Service initiates shipment
6. Notification Service sends the update

Each step listens for the previous step's event and emits its own (`StockReserved`, `PaymentCompleted`, …).

**Why this needs a saga (and what a saga actually is).** In a single database you'd wrap all this in one transaction — reserve stock, charge card, book shipment — and if any step fails, the database rolls *everything* back automatically. But here each step lives in a different service with its *own* database, so there's no shared transaction to roll back. You can't hold a lock across Inventory, Payment, and Delivery for the seconds it takes to charge a card — that would be catastrophically slow and fragile.

A **saga** solves this: it's a sequence of *local* transactions (each service commits its own step independently), and instead of an automatic rollback, every step has a manually-defined **compensating action** — an explicit "undo" — that runs if a later step fails.

Concrete walk-through of a failure: stock is reserved ✅, then **payment is declined** ❌. There's no magic rollback of the stock reservation — so Payment emits a `PaymentFailed` event, and Inventory listens for it and runs its compensating action: **release the reserved stock**. If payment had succeeded but shipping failed, you'd compensate by *refunding* the payment and releasing the stock. So a compensating action isn't a database rollback — it's a real business operation that semantically reverses an earlier one (release, refund, cancel). That's the saga pattern: no global lock, just a chain of local commits each paired with a compensation that can unwind it.

### Saga vs 2-Phase Commit (2PC)

These are the two ways to make a transaction span multiple services/databases. They sit at opposite ends of a trade-off, and interviewers love asking you to compare them.

**2-Phase Commit (2PC)** — the "everyone agrees, then everyone commits together" approach. A central **coordinator** drives two phases:
1. **Prepare phase:** the coordinator asks every participant "can you commit this? lock your rows and promise me you're ready." Each participant does the work, **locks the affected data**, and replies *yes* or *no*.
2. **Commit phase:** if *all* said yes, the coordinator tells everyone "commit." If *anyone* said no (or didn't answer), it tells everyone "abort" and they roll back.

The result is a true **atomic, strongly-consistent** transaction across services — either all commit or none do, and no one ever sees a half-finished state. The catch is what it costs:
- **Locks are held across the whole protocol.** Inventory's rows stay locked while we wait for Payment to charge a card — possibly seconds. That kills throughput and invites deadlocks.
- **The coordinator is a single point of failure.** If it crashes *after* phase 1 but *before* sending the commit/abort, every participant is stuck holding locks, blocked, waiting for a coordinator that may never return. This is the famous "blocking" problem.
- It needs all participants up *simultaneously* and is a poor fit for high-scale, loosely-coupled microservices (and most NoSQL stores don't even support it).

**Saga** — the "commit each step locally, undo with compensation if something fails" approach (the pattern walked through above). No global lock, no central agreement before committing; each service commits its own piece immediately and the chain unwinds via compensating actions on failure.
- **Strength:** no long-held cross-service locks, no blocking coordinator → it scales and stays available, which is why it's the default for microservices.
- **Cost:** you only get **eventual consistency** with a *temporary visible inconsistency* — between "stock reserved" and "payment refunded," the system is briefly in an inconsistent-looking state. And you must hand-write every compensating action (there's no automatic rollback), which is real design effort and can get tricky (what if the compensation itself fails? → retries + DLQ).

**Side by side:**

| | 2-Phase Commit (2PC) | Saga |
|---|---|---|
| Consistency | **Strong** — atomic, never a half-state visible | **Eventual** — brief inconsistency is visible |
| Locking | Holds locks across all services until commit | No cross-service locks; each step commits locally |
| Coordinator | Central coordinator; **single point of failure / blocking** | No blocking coordinator (orchestrated or choreographed) |
| Rollback | Automatic, by the protocol | Manual **compensating actions** you write yourself |
| Scales to microservices? | Poorly (tight coupling, low throughput) | Yes — the default choice |
| Use when | Few participants, correctness is paramount, low latency between them (e.g. within one bank's systems) | Long-running, high-scale, loosely-coupled services (e.g. e-commerce checkout) |

**Two flavors of saga to name** (in case they probe): **choreography** — no central brain, each service just listens for events and reacts (simple, but the flow is scattered and hard to follow at scale); **orchestration** — a dedicated orchestrator service explicitly tells each step what to do and handles compensation (clearer control and easier to debug, but the orchestrator is one more component to build).

> **Say out loud:** "2PC gives you real atomic consistency but holds locks and blocks on a coordinator that's a single point of failure — fine within one tightly-coupled system, but it doesn't scale across microservices. So for checkout I'd use a saga: each service commits locally and we undo with compensating actions, accepting brief eventual inconsistency in exchange for availability and scale. I'd lean toward orchestration so the workflow and its rollbacks live in one place I can reason about."

> **Say out loud:** "I'd use `orderId` as the partition key so all events for an order stay ordered, while different orders still parallelize. Consumers are idempotent — keyed on event ID — so at-least-once delivery is safe without paying the cost of full exactly-once. Failed messages retry with exponential backoff and land in a DLQ after N attempts, so one poison message can't block the partition. The whole checkout is a saga with compensating actions for rollback."

---

## 3. Database Design

### SQL vs NoSQL

**SQL (PostgreSQL, MySQL)** — choose when:
- You need **strong consistency** and **ACID transactions** (money, orders, inventory).
- Data is **relational** with clear schema and joins.

**NoSQL (Cassandra, MongoDB, DynamoDB)** — choose when:
- You need **massive horizontal scale / throughput**.
- The schema is **flexible** or evolving.
- Access patterns are known and key-based (low-latency lookups at scale).

**Deeper explanation:** The real distinction isn't "SQL is old, NoSQL is new" — it's about what guarantees and access patterns you're optimizing for. SQL databases give you **ACID** (Atomicity, Consistency, Isolation, Durability) and a flexible query language: you can ask questions you didn't anticipate at design time, and joins let you avoid duplicating data. The price is that joins and strong consistency are hard to scale horizontally — they assume the data is reachable on one node.

NoSQL databases drop or relax some of those guarantees to win scale. The catch most candidates miss: in NoSQL you **design the schema around your queries, not your data**. With Cassandra you decide up front "I will look up orders by user ID," and you model a table physically partitioned by user ID to make exactly that query fast — but a query you didn't plan for (e.g. "all orders in the last hour across all users") may be slow or impossible without a second table. SQL is query-flexible; NoSQL is query-specialized.

Quick guide to the NoSQL families:
- **Cassandra / DynamoDB** — wide-column / key-value. Write-heavy, linearly scalable, tunable consistency, no joins. Great for time-series, event logs, user-keyed lookups at huge scale.
- **MongoDB** — document store (nested JSON). Flexible, evolving schemas; good for catalogs, content, anything naturally hierarchical.

> Real systems mix both — this is **polyglot persistence**: orders & payments in Postgres (need ACID), product catalog in Mongo (flexible schema), session/cart in Redis or DynamoDB (need speed/scale). Saying this signals maturity: there's no single "best" database.

### CAP Theorem
In a distributed system you can guarantee only **two of three** during a network partition:
- **C**onsistency — every read sees the latest write.
- **A**vailability — every request gets a (non-error) response.
- **P**artition tolerance — the system keeps working despite dropped messages between nodes.

**First, what "partition" even means** — this word confuses everyone, and it's *not* the same "partition" as in database sharding. A **network partition** is when your servers are all alive and running, but the network between them breaks, so they can't talk to each other. Imagine you have two database replicas, one in New York and one in London, that normally sync. The undersea cable hiccups and they can't reach each other for 30 seconds. Both are up and serving users — but they're now two islands that can't coordinate. *That* is a partition.

Here's the dilemma it forces. A user in London writes "my balance = $100." Then a user in New York reads the balance. New York hasn't heard from London (the cable is down). It has two choices:
- **Answer anyway** with the old value ($0) — that's **Available** but **not Consistent** (it gave a stale answer).
- **Refuse to answer** until it can reach London and be sure — that's **Consistent** but **not Available** (it returned an error / hung).

There is no third option. You cannot be both consistent and available *during a partition* — that's the actual content of the CAP theorem.

**Deeper explanation:** So the common phrasing "pick two of three" is misleading. In any real distributed system spanning multiple machines, network partitions are a fact of life — cables fail, switches drop packets. So **P is not optional**; you must tolerate partitions. That reduces CAP to the single real decision the example above showed: *when a partition happens, do you sacrifice Consistency or Availability?*

- **CP** (consistency over availability): when nodes can't talk to each other, refuse to serve requests that might return stale or conflicting data. The system becomes partly unavailable but never lies. Examples: traditional RDBMS clusters, HBase, ZooKeeper, etcd.
- **AP** (availability over consistency): keep answering every request even if some nodes are out of sync; reconcile the differences later (**eventual consistency**). Examples: Cassandra, DynamoDB.

A useful refinement is **PACELC**: *if Partitioned, choose A or C; Else (normal operation), choose between Latency and Consistency.* It captures that even with no partition, you're constantly trading latency for consistency (e.g. waiting for replicas to acknowledge a write).

> **Say out loud:** "Partition tolerance isn't optional, so the real question is C-vs-A during a partition. For payments I'd pick CP — I'd rather reject a write than corrupt a balance. For a product catalog or news feed I'd pick AP — stale by a few seconds is fine, downtime isn't."

### Database scaling
- **Vertical scaling (scale up)** — bigger machine: more CPU, RAM, faster disks. Dead simple, no app changes, and you keep all your joins and transactions on one node. But there's a hard physical ceiling, it gets expensive fast at the top end, and that one box is a single point of failure.
- **Horizontal scaling (scale out)** — more machines working together. Near-unlimited headroom and built-in redundancy, but now you must deal with distributing data, keeping it consistent across nodes, and routing queries — which is exactly where sharding, replication, and CAP trade-offs enter. Rule of thumb: scale up until it hurts (it's simpler), then scale out.

### Sharding
Partitioning data **horizontally** across nodes so each node holds a subset of the rows (e.g. node A holds users 1–1M, node B holds 1M–2M). This is how you scale writes and storage beyond one machine. Strategies:
- **Hash-based (e.g. by User ID)** — hash the key to pick a shard. Gives **even distribution** and no hot spots, but **range queries become hard** (consecutive IDs scatter across all shards).
- **Range-based (e.g. by Region / date)** — keep contiguous ranges together. Makes **range queries efficient**, but risks **hot shards** — if you shard by date, today's shard takes 100% of the writes; if by region, a popular region overloads its node.

**Deeper explanation & pitfalls:**
- **Hot key / celebrity problem** — even with hashing, one extremely popular key (a celebrity's profile, a viral product) can overwhelm its shard. Mitigations: replicate that key, or add a secondary cache layer in front of it.
- **Resharding pain & consistent hashing** — this deserves a real walk-through because the "ring" explanation is usually too abstract.

  **The problem with naive hashing.** Say you have 4 shards and you route each key with `shard = hash(key) % 4`. Now you add a 5th shard, so the formula becomes `% 5`. Watch what happens to a key whose hash is 100: it *was* on shard `100 % 4 = 0`, now it's on shard `100 % 5 = 0` — okay that one's fine, but take hash 101: `101 % 4 = 1` → `101 % 5 = 1`... the point is that for the *vast majority* of keys the answer changes, because you changed the divisor. In practice adding one node remaps **~80%+ of all keys**, meaning almost all your data has to physically move between machines at once — a migration storm that can take down the system. The same disaster happens when a node *dies*.

  **The fix — consistent hashing.** Instead of `% N`, imagine a clock face — a circle numbered 0 up to a huge number, wrapping back to 0 (a "hash ring"). You place things on this circle:
  1. **Hash each *server*** to a point on the circle (e.g. Server A lands at 12 o'clock, B at 4 o'clock, C at 8 o'clock).
  2. **Hash each *key*** to a point on the same circle.
  3. To find which server owns a key, start at the key's position and **walk clockwise until you hit the first server** — that server owns it.

  Now add a new server D at, say, 2 o'clock. Which keys move? **Only the keys sitting between 12 o'clock (A) and 2 o'clock (D)** — they used to walk clockwise past D's spot to reach B at 4 o'clock, but now they stop at D. *Every other key on the ring is completely unaffected.* So adding a node only moves roughly `1/N` of the keys (from a single neighbor), not 80% of them. Removing a node is the mirror image: only that node's keys shift to the next server clockwise.

  **One refinement to mention:** with few servers the ring gets lopsided (one server might own a huge arc and get overloaded). The fix is **virtual nodes** — place each physical server at *many* points around the ring (Server A at 50 random spots, not 1), which evens out the distribution. This is exactly how Cassandra, DynamoDB, and distributed caches spread their data.
- **Cross-shard queries & joins** become scatter-gather operations (query every shard, merge results) — slow and complex. This is why analytics often live in a separate data warehouse rather than running across operational shards.

> **Say out loud:** "I'd shard orders by `userId` hash for even spread. The trade-off is cross-user analytics needs scatter-gather or a separate OLAP store, and I'd use consistent hashing so adding a node only moves a fraction of the keys instead of triggering a full remap."

### Normalization (asked alongside DB design)
- **Normalize** (organize data so each fact lives in exactly one place, up to 3rd Normal Form) to remove redundancy and keep writes consistent — if a user changes their address, you update one row, not fifty. Ideal for transactional systems where correctness matters most.
- **Denormalize** (deliberately duplicate data, e.g. store the product name inside the order row) to avoid expensive joins and speed up reads. Ideal for read-heavy and NoSQL systems.

The trade-off in one line: **normalization optimizes writes and correctness; denormalization optimizes reads and speed.** You denormalize when reads vastly outnumber writes and join cost is hurting you — accepting that you now have to keep duplicated copies in sync.

---

## 4. Scalability & Performance

### Load Balancer
Distributes incoming traffic across multiple backend servers. This is the foundation of horizontal scaling and high availability: clients hit one stable address, and the balancer spreads requests across a pool, runs **health checks** to route around dead instances, and lets you add/remove capacity transparently. Examples: **NGINX**, **AWS ALB**.

**Deeper explanation:**
- **L4 (transport layer)** balancers route by IP/port without inspecting the request — fast and protocol-agnostic, but "dumb." **L7 (application layer)** balancers read the HTTP request and can route by URL path, host, or header (`/api/*` → API pool, `/images/*` → static pool), do SSL termination, and rewrite requests — more capable, slightly more overhead.
- **Algorithms:** *round-robin* (simple rotation), *least-connections* (send to the least-busy node — better when request durations vary), *IP-hash* (same client always hits the same server, for **session stickiness**). Stickiness is a crutch though — the cleaner design is **stateless servers** that keep session state in a shared store (Redis), so any server can handle any request and you can scale freely.

### Caching
Store frequently accessed data in fast memory (RAM) so you serve it without hitting the slower database every time. This cuts latency dramatically and offloads the database, often the scarcest resource in the system.
- **Use cases:** product catalog (read often, changes rarely), session data, any hot/frequently-read data, expensive computed results.
- **Technologies:** **Redis** (rich data structures, optional persistence, pub/sub) vs **Memcached** (simpler, pure in-memory key-value, slightly faster for the basic case).

**Cache strategies:**

| Strategy | How it works | Trade-off |
|---|---|---|
| **Cache-Aside** (lazy loading) | App checks cache first; on a **miss**, it reads the DB, then writes the result into the cache. | Most common. Only requested data is cached (memory-efficient), but the first request per key is slow, and data can go stale → use TTLs. |
| **Write-Through** | Every write goes to cache **and** DB synchronously, together. | Cache is always fresh, reads never miss for written data — but writes are slower, and you cache data that may never be read. |
| **Write-Back** (write-behind) | Write to cache immediately, flush to the DB **asynchronously** later (in batches). | Very fast writes, absorbs write spikes — but **risk of data loss** if the cache dies before flushing. Use only when some loss is tolerable. |

**Cache-aside traced request-by-request** (since it's the one you'll use most):
1. Request for product #42 arrives. App asks Redis: "got product 42?" → **miss** (not there).
2. App reads product 42 from Postgres (slow, ~20ms), gets the data.
3. App writes product 42 into Redis with a 5-minute TTL, then returns it to the user.
4. *Next* request for product 42 (within 5 min): App asks Redis → **hit** (~1ms), returns immediately. Postgres never touched.
5. After 5 minutes the entry expires; the next request misses and the cycle repeats with fresh data.

The name "cache-aside" means the cache sits *beside* the app and the app manages it manually — the cache doesn't know about the database. Contrast with write-through, where the cache and DB are wired together.

**Deeper explanation & gotchas:**
- **TTL & eviction** — TTL (time-to-live) is an expiry stamp: "this entry self-destructs in 5 minutes" so you don't serve stale data forever. **Eviction** is different — it's what happens when the cache runs *out of memory*: it must throw something out to make room, and the usual policy is **LRU (least-recently-used)** — evict whatever hasn't been touched in the longest time, on the bet that cold data won't be missed. Tuning TTLs and the eviction policy is most of day-to-day cache operations.
- **Cache invalidation** — keeping the cache in sync with the DB on updates is famously one of the "two hard problems in computer science." Stale data is the classic caching bug.
- **Thundering herd (cache stampede)** — when a popular key expires, thousands of requests miss simultaneously and all stampede the DB at once. Fixes: request coalescing (only one fetch repopulates while others wait), slightly randomized (jittered) TTLs so keys don't all expire together, or proactive refresh.
- **Hit ratio** is your headline metric — the fraction of requests served from cache. A low hit ratio means the cache isn't earning its keep.

### CDN (Content Delivery Network)
A geographically distributed network of edge servers that cache content close to users.
- **Used for:** images, static assets (JS/CSS bundles), video — and increasingly cached API/HTML responses.
- **Why:** **global low latency** (a user in Tokyo is served from a Tokyo edge, not your origin in Virginia — physics, the speed of light, dominates latency over distance) and **massive origin offload** (the CDN absorbs the bulk of traffic, so your servers handle far fewer requests). It also helps absorb traffic spikes and some DDoS load at the edge.

> **Say out loud:** "I'd put cache-aside Redis in front of the catalog with a TTL, serve static assets and images from a CDN so users hit a nearby edge, and front the app tier with an L7 load balancer doing health checks — with stateless servers keeping session in Redis so I can scale horizontally. My headline metric is cache hit ratio, and I'd guard against thundering herd with request coalescing or jittered TTLs."

---

## 5. Reliability & Resilience

How systems **survive failures gracefully** instead of letting one failure cascade into a full outage. The governing assumption: in a distributed system, *something is always failing* — a slow dependency, a dropped packet, a dead node — so resilience is about containing that failure, not preventing it.

### Circuit Breaker
Stops a service from repeatedly calling a downstream that's already failing, so failures don't **cascade** back up the chain. Three states:
- **Closed** — normal operation; calls flow through and failures are counted.
- **Open** — once failures cross a threshold, the breaker "trips": calls **fail fast immediately** (return an error or fallback) without even attempting the dead service.
- **Half-Open** — after a cooldown timer, the breaker lets a few trial calls through. If they succeed, it closes (recovered); if they fail, it re-opens and waits again.

**Deeper explanation:** The failure it prevents is **cascading failure via resource exhaustion**. Imagine Payment is hung and every call takes 30 seconds to time out. The Order service keeps calling it, and each call ties up a thread waiting. Within seconds, every thread in the Order service is blocked waiting on Payment — now Order is down too, and whatever calls Order goes down next. The breaker short-circuits this: after Payment looks dead, Order stops calling it and instantly returns a fallback ("payment temporarily unavailable, try later"), freeing its threads to keep serving everything else. Tools: **Resilience4j** (modern, lightweight), **Hystrix** (Netflix's original, now in maintenance).

### Bulkhead Pattern
Isolate resources so a failure in one area can't sink the whole system — named after the watertight compartments in a ship's hull: puncture one, and only that compartment floods. In software, you give each downstream dependency its **own dedicated resource pool** (e.g. a separate thread pool or connection pool per dependency). If Payment hangs and exhausts its pool, that's *all* it can exhaust — calls to Catalog or Inventory use different pools and keep working. Bulkheads and circuit breakers are complementary: bulkheads contain the blast radius, breakers stop the bleeding.

### Rate Limiting
Caps how many requests a client (or the whole system) can make in a time window, to protect against overload, abuse, and runaway costs. The two classic algorithms are named after literal buckets, so let's actually picture the buckets — that's the whole trick to remembering them.

#### Token bucket — the bucket holds *permission slips*

Picture a bucket that holds **tokens** (think of them as ride tickets). A machine drops a new token into the bucket at a steady rate — say **1 token per second** — up to a maximum capacity, say **10 tokens**.

- Every incoming **request must grab one token** to be allowed through.
- If a token is available, the request takes it and proceeds **instantly**.
- If the bucket is empty, the request is **rejected** (HTTP 429) or made to wait.

The clever part is the *reserve*. If your service is quiet for 10 seconds, the bucket fills up to its max of 10 tokens. Then if 10 requests suddenly arrive in the same instant, all 10 find a token waiting and **all 10 go through at once** — a burst. After that the bucket is empty, so further requests are throttled back down to the 1/sec refill rate.

> **Token bucket = "you may go immediately if you've saved up permission." It allows bursts, then settles to a steady average.** This is why APIs (Stripe, GitHub, AWS) use it — real users are bursty (you click 5 things quickly, then pause), and token bucket accommodates that naturally.

#### Leaky bucket — the bucket holds *the requests themselves*, and it has a hole in the bottom

Now picture a completely different bucket. This one has a small **hole in the bottom** that leaks at a fixed rate — say **1 request per second**, no faster, ever.

- Incoming requests are **water poured into the top**. You can pour as fast or as bursty as you like.
- The water drains out the hole at the **constant 1/sec rate** — that's the rate your downstream actually gets served at.
- If you pour in faster than it drains, the water level rises (requests queue up inside the bucket).
- If the bucket **fills to the brim, it overflows** — extra requests spill out and are dropped.

So if 10 requests arrive in the same instant, the leaky bucket does **not** let all 10 through. It accepts them into the bucket (if there's room) and releases them one per second — request 1 at t=0, request 2 at t=1s, request 3 at t=2s, and so on. The output is a perfectly smooth, steady drip **no matter how chaotic the input was**.

> **Leaky bucket = "I will serve at a constant rate, period. Bursts get queued and smoothed out (or dropped if the queue overflows)." It does NOT allow bursts through — that's the entire point.** Use it when the thing downstream genuinely cannot handle spikes and needs a steady, predictable load (e.g. feeding a legacy system, or shaping network traffic).

#### Side by side — the one difference that matters

| | Token bucket | Leaky bucket |
|---|---|---|
| What's *in* the bucket | Tokens (permissions) | The requests themselves (a queue) |
| Can a burst pass through? | **Yes** — up to the saved-up tokens | **No** — output is always the steady leak rate |
| Output shape | Bursty, capped to an average | Perfectly smooth/constant |
| Best for | User-facing APIs (users are bursty) | Protecting a downstream that hates spikes |

The sentence to remember: **token bucket lets you spend saved-up bursts; leaky bucket forces every request to wait its turn in a steady drip.**

*(Two simpler cousins also worth naming: **fixed window** — just a counter reset every minute, e.g. "100/min"; easy, but it allows a 2× spike right at the window boundary (100 requests at 0:59 + 100 at 1:00 = 200 in two seconds). **Sliding window** fixes that boundary spike by counting over a rolling window instead of a fixed one, at the cost of tracking more timestamps.)*

### Graceful Degradation
When something fails, the system **stays partially functional** by shedding non-essential features rather than going fully down. The classic example: if the **recommendation** engine is down, still render the product page — just hide the "recommended for you" carousel or show a generic "popular items" list instead. The user gets a slightly worse experience instead of an error page.

**Deeper explanation:** This is about ranking features by criticality and protecting the critical path. For an e-commerce site, *checkout must work* even if everything optional (reviews, recommendations, "customers also bought") is broken. You design fallbacks deliberately: a default response, cached/stale data, or a quietly omitted feature. It pairs naturally with circuit breakers — when a breaker trips, its fallback *is* the graceful degradation.

> **Say out loud:** "I'd wrap every downstream call in a circuit breaker with a sensible fallback, isolate dependencies with bulkheads so a slow Payment service can only exhaust its own thread pool, rate-limit at the gateway with token bucket to allow legitimate bursts while capping abuse, and degrade gracefully — checkout has to work even when recommendations are down."

---

## One-line cheat sheet

| Topic | The 10-second answer |
|---|---|
| Functional decomposition | Split by business capability; DB-per-service; orchestrate the checkout as a saga with compensations. |
| Kafka | Topics→partitions for parallelism; order only per partition (use a key); idempotent consumers + DLQ make at-least-once safe. |
| SQL vs NoSQL | SQL for ACID/relational/flexible queries; NoSQL for scale + query-specialized schemas; polyglot in practice. |
| CAP | P is given; real choice is C-vs-A during a partition (payments=CP, feed=AP); PACELC adds latency-vs-consistency normally. |
| Scaling & sharding | Scale up till it hurts, then out; hash for even spread, range for range queries; consistent hashing to avoid full remaps. |
| Caching | Cache-aside + TTL is the default; watch invalidation & thundering herd; track hit ratio; CDN for static + edge latency. |
| Resilience | Circuit breaker (fail fast) + bulkhead (contain) + rate limit (token bucket bursts) + graceful degradation (protect the critical path). |

---
*Generated from `system-design.pdf`. Tip: for each topic, always volunteer the **trade-off** — interviewers grade you on recognizing that every architectural choice costs something, not on naming the "right" answer.*
