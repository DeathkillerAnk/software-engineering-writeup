export const meta = {
  name: 'hld-curriculum',
  description: 'Generate a principal-level HLD curriculum: 31 deep-dive writeups, each adversarially fact-checked and fixed',
  phases: [
    { title: 'Write deep-dives', detail: 'one writer agent per topic writes its markdown file' },
    { title: 'Fact-check & fix', detail: 'adversarial reviewer verifies accuracy + depth and edits the file' },
  ],
}

const BASE = '/Users/deaths_terminal/Development/software-engineering-writeup/HLD'

// ---- Canonical curriculum ----------------------------------------------------
const TOPICS = [
  // PART 0 — FOUNDATIONS
  {
    id: '01-networking',
    path: '00-foundations/01-networking.md',
    title: 'Networking for System Design',
    objectives: 'Reason about how bytes actually move between machines so you can predict latency, choose protocols, and debug distributed behavior.',
    cover: 'OSI vs TCP/IP layering (only the useful parts); IP, ports, NAT; TCP handshake, flow/congestion control, head-of-line blocking, slow start, Nagle; UDP and when to use it; DNS resolution path, TTL, anycast; TLS 1.3 handshake, cert chains, mTLS, where termination happens; HTTP/1.1 keep-alive vs HTTP/2 multiplexing vs HTTP/3-QUIC; WebSockets, SSE, long-polling, gRPC over HTTP/2; the latency budget of a single request across regions; bandwidth vs latency vs throughput; MTU and fragmentation.',
    pitfalls: 'Confusing latency with bandwidth; claiming HTTP/2 removes ALL head-of-line blocking (it removes app-layer HOL but TCP HOL remains — that is what QUIC fixes); saying TLS 1.3 is 2-RTT (it is 1-RTT, 0-RTT for resumption); thinking DNS is instant (TTL caching); confusing connection-level vs request-level multiplexing.',
  },
  {
    id: '02-compute-and-concurrency',
    path: '00-foundations/02-compute-and-concurrency.md',
    title: 'Compute, Concurrency & the Machine',
    objectives: 'Understand what a server can actually do per second so capacity numbers are grounded, not guessed.',
    cover: 'Processes vs threads vs coroutines; context switching cost; the C10K/C10M problem; blocking vs non-blocking I/O, the event loop, epoll/kqueue, io_uring; thread-per-request vs async models (Node, Go goroutines, virtual threads); CPU-bound vs I/O-bound work and how that drives scaling choices; Amdahl vs Universal Scalability Law (coherency cost); NUMA, cache lines, false sharing at a high level; how a single box uses cores, memory, and the network card; GC pauses and tail latency.',
    pitfalls: 'Conflating concurrency with parallelism; assuming more threads = more throughput (context-switch + lock contention); ignoring that async does not speed up CPU-bound work; forgetting the USL retrograde region (adding nodes can REDUCE throughput); treating GC/tail latency as negligible.',
  },
  {
    id: '03-storage-engines',
    path: '00-foundations/03-storage-engines.md',
    title: 'Storage Engines: How Databases Actually Store Data',
    objectives: 'Open the black box under every database so you can predict read/write amplification and pick the right store.',
    cover: 'Disks vs SSDs (random vs sequential, IOPS, write amplification, wear); the page cache and fsync/durability; write-ahead log (WAL) and why every durable system has one; B-tree / B+tree internals (in-place updates, read-optimized); LSM-tree internals (memtable, SSTables, compaction, bloom filters, write-optimized); read vs write vs space amplification trade-off; column stores vs row stores; when each engine wins (OLTP vs OLAP); how indexes are physically stored.',
    pitfalls: 'Saying LSM is always faster (it is write-optimized but pays read + compaction cost); ignoring write amplification on SSDs; thinking fsync is free; confusing clustered vs secondary index physical layout; claiming B-trees and LSM-trees differ in big-O (both O(log n)) rather than in amplification/workload fit.',
  },
  {
    id: '04-capacity-estimation',
    path: '00-foundations/04-capacity-estimation.md',
    title: 'Back-of-the-Envelope: Capacity & Latency Estimation',
    objectives: 'Turn a vague requirement into QPS, storage, bandwidth, and machine counts in two minutes — the skill that anchors every design discussion.',
    cover: 'Latency numbers every engineer should know (L1/L2/RAM/SSD/disk seek/network round trips, same-DC vs cross-region); powers of two and data-size intuition; reads-per-second and writes-per-second from DAU + behavior assumptions; peak vs average (and the rule-of-thumb multipliers); storage growth over years; bandwidth from object size x QPS; how many servers / DB shards / cache nodes; a worked example end-to-end; sanity-checking your own numbers.',
    pitfalls: 'Using average instead of peak QPS; forgetting replication factor inflates storage 3x; ignoring metadata/index overhead; mixing bits and bytes; unrealistic per-server QPS assumptions; not stating assumptions explicitly (the interviewer/architect cares about the method, not the exact number).',
  },

  // PART 1 — BUILDING BLOCKS
  {
    id: '05-load-balancing',
    path: '01-building-blocks/05-load-balancing.md',
    title: 'Load Balancing & Consistent Hashing',
    objectives: 'Distribute traffic without creating hotspots or losing the ability to rebalance when nodes come and go.',
    cover: 'L4 (transport) vs L7 (application) load balancing; algorithms (round-robin, weighted, least-connections, least-response-time, power-of-two-choices); health checks and outlier ejection; sticky sessions and why they fight statelessness; DNS LB, anycast, and global server load balancing; consistent hashing (the ring, virtual nodes, why it minimizes reshuffling on membership change); rendezvous (HRW) hashing as the simpler alternative; client-side LB and service discovery; LB as a single point of failure and how to avoid it.',
    pitfalls: 'Plain modulo hashing for sharding (reshuffles everything when N changes — the whole reason consistent hashing exists); forgetting virtual nodes (without them the ring is lopsided); claiming consistent hashing balances perfectly (it needs vnodes/HRW); ignoring that L7 LBs terminate TLS and add latency; sticky sessions defeating horizontal scale.',
  },
  {
    id: '06-caching',
    path: '01-building-blocks/06-caching.md',
    title: 'Caching: Strategies, Invalidation & Failure Modes',
    objectives: 'Add caching that actually reduces load without serving stale or inconsistent data — and survive when the cache fails.',
    cover: 'Where caches live (client, CDN, reverse proxy, app, DB buffer pool); cache-aside vs read-through vs write-through vs write-back vs write-around; eviction policies (LRU, LFU, TTL, ARC, W-TinyLFU); cache invalidation strategies and why it is genuinely hard; CDN mechanics and cache keys; Redis vs Memcached; the famous failure modes — thundering herd / cache stampede (and mitigations: request coalescing, locks, jittered TTL, early recompute), cache penetration, hot keys, and the dogpile; consistency between cache and DB; sizing and hit-rate math.',
    pitfalls: 'Write-back losing data on crash without persistence; TTL=0 vs no-TTL confusion; assuming cache improves consistency (it trades freshness for speed); no stampede protection; caching negative results badly (penetration); ignoring that a cache becoming the source of truth is a footgun; treating eviction policy as irrelevant.',
  },
  {
    id: '07-databases-relational',
    path: '01-building-blocks/07-databases-relational.md',
    title: 'Relational Databases: Indexing, Transactions & Isolation',
    objectives: 'Master the default datastore most systems should start with — its indexes, transaction guarantees, and concurrency control.',
    cover: 'ACID precisely (what each letter does and does NOT guarantee); how indexes work (B+tree, composite, covering, partial), the leftmost-prefix rule, when indexes hurt writes; query planning and EXPLAIN at a conceptual level; transaction isolation levels (read-uncommitted, read-committed, repeatable-read, serializable) mapped to the anomalies they prevent (dirty read, non-repeatable read, phantom, write skew, lost update); MVCC and snapshot isolation; pessimistic vs optimistic locking; SERIALIZABLE via 2PL vs SSI; connection pooling; why you normalize and when you denormalize.',
    pitfalls: 'Claiming SERIALIZABLE is the SQL default (it is usually READ COMMITTED in Postgres, REPEATABLE READ in MySQL); conflating snapshot isolation with serializable (snapshot allows write skew); saying MVCC means no locks; thinking an index always speeds things up; confusing the anomalies each isolation level prevents; forgetting phantoms.',
  },
  {
    id: '08-databases-nosql',
    path: '01-building-blocks/08-databases-nosql.md',
    title: 'NoSQL & Choosing a Data Model',
    objectives: 'Pick the right non-relational model for the access pattern instead of cargo-culting "NoSQL scales".',
    cover: 'The four+ families: key-value (Redis, DynamoDB), document (MongoDB), wide-column (Cassandra, Bigtable, HBase), graph (Neo4j), plus time-series and search (Elasticsearch); the core idea: model around access patterns/queries, not entities; single-table design in DynamoDB; eventual consistency and tunable consistency (Cassandra R+W>N); secondary indexes in distributed stores and their cost; when NewSQL/distributed-SQL (Spanner, CockroachDB, Vitess) gives you both; polyglot persistence; honest cost: you trade ad-hoc query flexibility and joins for scale and write throughput.',
    pitfalls: 'Believing NoSQL means no schema (it means schema-on-read / enforced in app); thinking NoSQL is always faster or always scales; ignoring that joins move into application code; misusing a document DB for highly relational data; assuming eventual consistency is acceptable for everything; forgetting Cassandra needs R+W>N for strong reads.',
  },
  {
    id: '09-replication',
    path: '01-building-blocks/09-replication.md',
    title: 'Replication: Copies, Consistency & Failover',
    objectives: 'Keep data available and durable across machine and datacenter failure while understanding the consistency cost.',
    cover: 'Why replicate (HA, read scaling, geo-locality, durability); single-leader (sync vs async vs semi-sync replication, replication lag, read-your-writes, monotonic reads); failover mechanics and split-brain; multi-leader (when, and conflict resolution: LWW, CRDTs, app-defined); leaderless / quorum (Dynamo-style, R+W>N, read repair, hinted handoff, sloppy quorum); the read-after-write and stale-read problems and their fixes; chain replication; how leader election ties to consensus.',
    pitfalls: 'Async replication implying zero data loss on failover (it does not — you lose un-replicated writes); thinking R+W>N guarantees linearizability (it does not, only strong-ish reads with caveats); LWW silently dropping writes (clock skew); ignoring split-brain; assuming replicas are always consistent (lag); confusing replication with backups.',
  },
  {
    id: '10-partitioning-sharding',
    path: '01-building-blocks/10-partitioning-sharding.md',
    title: 'Partitioning & Sharding',
    objectives: 'Split data across machines so the system scales past one box without creating hotspots or losing the ability to query.',
    cover: 'Why partition (data + write volume exceed one node); range partitioning vs hash partitioning vs directory-based; the hot-spot/celebrity problem and mitigations (salting, splitting hot keys); partitioning secondary indexes (local/document-partitioned vs global/term-partitioned) and the query trade-off; rebalancing strategies (fixed number of partitions, dynamic splitting, consistent hashing) and avoiding full reshuffle; routing requests (coordinator, routing tier, gossip); choosing a partition key — the single most consequential decision; cross-shard queries, scatter-gather, and distributed joins.',
    pitfalls: 'Range partitioning on monotonically increasing key (all writes hit one shard — the timestamp-key trap); hash partitioning destroying range-scan ability; using mod-N (reshuffles on resize); picking a low-cardinality or skewed partition key; ignoring cross-shard transactions cost; confusing partitioning with replication (they compose, they are not alternatives).',
  },
  {
    id: '11-messaging-and-streaming',
    path: '01-building-blocks/11-messaging-and-streaming.md',
    title: 'Message Queues & Stream Processing',
    objectives: 'Decouple producers from consumers and process data in motion — with honest delivery guarantees.',
    cover: 'Queues vs logs (RabbitMQ/SQS vs Kafka/Pulsar) and why the difference matters; pub/sub, fan-out, consumer groups, partitions and ordering guarantees (ordering only within a partition); delivery semantics (at-most-once, at-least-once, effectively/exactly-once and how it is really achieved via idempotency + transactions); backpressure, dead-letter queues, retries, poison messages; log compaction and retention; stream processing (windowing, watermarks, event time vs processing time, stateful operators); the outbox pattern and CDC; when to use a queue vs a synchronous call.',
    pitfalls: 'Believing exactly-once delivery is possible end-to-end (it is exactly-once PROCESSING via idempotency/transactions, not magic delivery); assuming global ordering across partitions; ignoring consumer lag and rebalancing storms; no DLQ for poison messages; using a queue where a sync call is simpler; confusing event time with processing time (late/out-of-order data).',
  },

  // PART 2 — DISTRIBUTED SYSTEMS
  {
    id: '12-consistency-and-cap',
    path: '02-distributed-systems/12-consistency-and-cap.md',
    title: 'Consistency Models, CAP & PACELC',
    objectives: 'Speak precisely about consistency vs availability trade-offs — the vocabulary that separates senior from principal.',
    cover: 'The consistency spectrum: linearizability (single-copy illusion) > sequential > causal > read-your-writes/monotonic > eventual; what each actually promises and costs; CAP stated CORRECTLY (during a network partition you must choose between consistency and availability; it says nothing when there is no partition); why "CA" systems are basically a misnomer; PACELC (Else: Latency vs Consistency even without partitions); how this maps to real product decisions; consistency from the client perspective vs the storage perspective.',
    pitfalls: 'The classic CAP misreading "pick 2 of 3 always" (CAP only forces a choice DURING a partition); calling a single-node DB "CA"; conflating consistency-the-C-in-ACID with consistency-the-C-in-CAP (different things); thinking eventual consistency means "eventually correct quickly"; ignoring PACELC latency dimension; treating linearizability and serializability as the same (one is about single-object recency, the other about multi-object transaction order).',
  },
  {
    id: '13-consensus',
    path: '02-distributed-systems/13-consensus.md',
    title: 'Consensus: Paxos, Raft & Leader Election',
    objectives: 'Understand how a cluster agrees on a single value despite failures — the engine inside every coordination service.',
    cover: 'The problem: agreement + validity + termination under crash faults; FLP impossibility (no deterministic consensus in a fully async network with even one failure) and how real systems sidestep it with timeouts/randomization; Paxos (proposer/acceptor/learner, prepare/promise/accept, majority quorums) at an intuition level; Raft (leader election with terms, log replication, commit index, safety via the election restriction) in enough detail to reason about it; quorum intersection math; where consensus lives in practice (ZooKeeper/ZAB, etcd, Consul) and what you build on top (config, locks, leader election, membership); the cost of consensus (latency, write availability needs a majority).',
    pitfalls: 'Thinking consensus solves the two-generals problem (it does not — that is unsolvable; consensus tolerates crashes, not arbitrary message loss forever); confusing consensus with 2PC; believing Raft tolerates Byzantine faults (it does not — needs BFT/PBFT for that); forgetting you need a majority alive (3 nodes tolerate 1 failure, 5 tolerate 2); thinking a leader makes it not-distributed.',
  },
  {
    id: '14-time-clocks-ordering',
    path: '02-distributed-systems/14-time-clocks-ordering.md',
    title: 'Time, Clocks & Ordering Events',
    objectives: 'Reason about "what happened before what" in a system with no global clock — the root of many subtle bugs.',
    cover: 'Why wall-clock time lies in distributed systems (skew, drift, NTP, leap seconds); physical vs logical clocks; the happens-before relation; Lamport timestamps (total order, but not causality detection); vector clocks (detect concurrency/causality, cost O(N)); version vectors; hybrid logical clocks (HLC); Google Spanner TrueTime (commit-wait, bounded uncertainty via GPS/atomic clocks) and what it buys you (external consistency); how ordering underpins consistency, conflict detection, and snapshots.',
    pitfalls: 'Using wall-clock timestamps to order events / resolve conflicts (LWW clock-skew data loss); thinking Lamport timestamps detect causality (they only give a consistent total order, cannot tell concurrent from causal); confusing vector clocks with version vectors; assuming NTP makes clocks "synchronized enough" without bounding error; not knowing TrueTime trades latency (commit-wait) for correctness.',
  },
  {
    id: '15-distributed-transactions',
    path: '02-distributed-systems/15-distributed-transactions.md',
    title: 'Distributed Transactions, Sagas & Idempotency',
    objectives: 'Maintain correctness across multiple services/datastores when a single ACID transaction is no longer possible.',
    cover: 'Why cross-service ACID is hard; two-phase commit (2PC: coordinator, prepare/commit, blocking on coordinator failure) and three-phase commit; why 2PC is avoided at scale; the saga pattern (choreography vs orchestration, compensating transactions, semantic vs syntactic rollback); the transactional outbox + CDC for atomic "update DB and publish event"; idempotency keys and idempotent consumers; exactly-once processing as idempotency + dedup + atomic offset commit; eventual consistency with business invariants; reservation/escrow patterns; when you actually need a distributed transaction vs when you can redesign to avoid it.',
    pitfalls: 'Treating 2PC as non-blocking (coordinator crash blocks participants holding locks); thinking sagas give isolation (they do not — intermediate states are visible, you need semantic locks/compensations); compensations assumed to always succeed; idempotency key without expiry/storage strategy; dual-write problem (update DB then publish — not atomic) solved naively; believing exactly-once is free.',
  },
  {
    id: '16-reliability-and-failure',
    path: '02-distributed-systems/16-reliability-and-failure.md',
    title: 'Reliability: Designing for Failure',
    objectives: 'Assume everything fails and build systems that degrade gracefully instead of collapsing — the heart of senior+ design.',
    cover: 'Failure is the normal case at scale (fault vs failure); failure detection (heartbeats, phi-accrual, the inherent uncertainty); redundancy and N+1/N+2; timeouts (and why no timeout is the worst bug), retries with exponential backoff + jitter, retry storms and retry budgets; idempotency as a precondition for safe retries; circuit breakers, bulkheads, load shedding, backpressure; graceful degradation and fallback; the thundering-herd and metastable-failure / cascading-failure dynamics; chaos engineering; blast radius, cell-based architecture; how to compute availability (nines, serial vs parallel composition) and the dependency-chain math.',
    pitfalls: 'Retries without backoff/jitter causing retry storms (amplifying an outage); no timeout (thread/connection exhaustion); retrying non-idempotent operations; assuming availabilities multiply favorably (a chain of 99.9% deps is much less than 99.9%); ignoring correlated failures and metastable states; circuit breaker without half-open recovery; treating health checks as binary.',
  },

  // PART 3 — ARCHITECTURE & APIs
  {
    id: '17-api-design',
    path: '03-architecture-and-apis/17-api-design.md',
    title: 'API Design: REST, gRPC, GraphQL & Contracts',
    objectives: 'Design interfaces that are evolvable, efficient, and safe under retries and scale.',
    cover: 'REST resource modeling, proper status codes, idempotent verbs; gRPC/protobuf (when binary + streaming + strict contracts win); GraphQL (client-driven queries, the N+1 and over-fetch trade-offs, query cost limiting); API versioning strategies; pagination (offset vs cursor/keyset and why cursor wins at scale); idempotency keys for safe retries on writes; rate limiting from the API contract side; error model design; pagination/filtering/sorting conventions; backward/forward compatibility and contract testing; long-running operations and async APIs; webhooks vs polling.',
    pitfalls: 'Offset pagination on large/changing datasets (slow + items skipped/duplicated); non-idempotent POST without idempotency keys; breaking changes without versioning; GraphQL without query-cost limits (DoS); using GET with side effects; chatty REST where one call should aggregate; ignoring partial failure in batch endpoints.',
  },
  {
    id: '18-architectural-styles',
    path: '03-architecture-and-apis/18-architectural-styles.md',
    title: 'Architectural Styles: Monolith → Microservices → Event-Driven',
    objectives: 'Choose an architecture for the team and problem at hand instead of following hype — a core principal judgment.',
    cover: 'Modular monolith (and why it is the right default for most teams); microservices (benefits: independent deploy/scale/ownership; costs: distributed-systems tax, data consistency, operational overhead); service boundaries via DDD bounded contexts; database-per-service and the data integration problem; API gateway and BFF; service mesh (sidecars, mTLS, traffic policy); event-driven architecture and choreography; CQRS and event sourcing (when the write and read models genuinely diverge, and the real costs: eventual consistency, replay, versioning events); the Strangler Fig migration; Conway\'s Law and team topology.',
    pitfalls: 'Microservices by default (distributed monolith — worst of both); sharing a database across services (hidden coupling); event sourcing everywhere (huge complexity, schema evolution pain); ignoring Conway\'s Law; nano-services; synchronous call chains negating microservice resilience; CQRS without needing it.',
  },
  {
    id: '19-observability',
    path: '03-architecture-and-apis/19-observability.md',
    title: 'Observability: Metrics, Logs, Traces & SLOs',
    objectives: 'Make systems debuggable in production and define what "working" means numerically — what you cannot see you cannot operate.',
    cover: 'The three pillars (metrics, logs, traces) and what each is for; structured logging and sampling; metrics types (counter/gauge/histogram) and why you need percentiles (p50/p95/p99/p999) not averages; distributed tracing (spans, trace context propagation, OpenTelemetry); the RED and USE methods; cardinality cost; SLI/SLO/SLA and error budgets (and how error budgets drive release decisions); alerting on symptoms not causes, alert fatigue, runbooks; the difference between monitoring (known unknowns) and observability (unknown unknowns); tail latency and why averages lie.',
    pitfalls: 'Averaging latency (hides the tail that users feel); alerting on causes/noise instead of user-facing symptoms; unbounded label cardinality blowing up the metrics bill; logs without correlation/trace IDs; SLA vs SLO confusion (SLA is the contract with penalties, SLO is your internal target, stricter); no error budget policy; tracing without context propagation.',
  },
  {
    id: '20-security',
    path: '03-architecture-and-apis/20-security.md',
    title: 'Security in System Design',
    objectives: 'Bake in authentication, authorization, and data protection as design concerns, not bolt-ons.',
    cover: 'AuthN vs AuthZ (distinct); session vs token auth; OAuth2 flows and OIDC; JWT (claims, signing, why you cannot easily revoke them, refresh tokens, the "stop putting sessions in JWTs" debate); RBAC vs ABAC vs ReBAC (Zanzibar); encryption in transit (TLS/mTLS) and at rest, key management (KMS, envelope encryption), secrets management; the principle of least privilege and zero-trust; common web/system attacks and defenses (injection, SSRF, IDOR, replay, CSRF); rate limiting and abuse prevention as security; PII handling, tokenization, and a note on compliance (GDPR/PCI) as design constraints; defense in depth.',
    pitfalls: 'Confusing authentication with authorization; storing long-lived sensitive state in unrevokable JWTs; rolling your own crypto; secrets in code/env committed to git; trusting the network perimeter (no zero-trust); IDOR from using guessable/sequential IDs without authz checks; treating TLS as sufficient for at-rest data.',
  },

  // PART 4 — DESIGN CASE STUDIES
  {
    id: '21-interview-framework',
    path: '04-design-case-studies/21-interview-framework.md',
    title: 'The System Design Framework',
    objectives: 'Have a repeatable method to attack any design problem — in an interview or a real design review — so you never freeze.',
    cover: 'The end-to-end flow: (1) clarify functional + non-functional requirements and scope; (2) capacity estimation; (3) define the API; (4) data model; (5) high-level architecture (draw the boxes); (6) deep-dive the 1-2 hardest components; (7) identify bottlenecks and scale them; (8) discuss trade-offs, failure modes, and what you would do next. How to drive the conversation, ask the right questions, and state assumptions; how to manage time; what interviewers/architects actually evaluate (structured thinking, trade-off articulation, depth on demand); the difference between a junior answer (one design, stated as fact) and a principal answer (options with trade-offs, driven by requirements). A mini worked walkthrough.',
    pitfalls: 'Jumping to a solution before clarifying requirements; over-engineering for scale nobody asked for; ignoring non-functional requirements (consistency, latency, availability targets); designing in a vacuum without stating assumptions; no deep dive (staying shallow everywhere); not addressing failure/bottlenecks; presenting one design as the only answer.',
  },
  {
    id: '22-url-shortener-rate-limiter-id-gen',
    path: '04-design-case-studies/22-url-shortener-rate-limiter-id-gen.md',
    title: 'Case Studies: URL Shortener, Rate Limiter & Distributed ID Generator',
    objectives: 'Master three foundational designs whose patterns (encoding, counting in a window, unique IDs at scale) recur everywhere.',
    cover: 'URL shortener: key generation (hash+truncate vs counter+base62 vs offline keygen), collision handling, read-heavy caching, redirect (301 vs 302) trade-offs, custom aliases, analytics, storage estimation. Rate limiter: algorithms (fixed window, sliding window log, sliding window counter, token bucket, leaky bucket) with their accuracy/memory trade-offs, distributed rate limiting (centralized Redis vs local + sync), where to enforce. Distributed unique ID: requirements (unique, roughly sortable, no coordination), UUIDv4/v7, Twitter Snowflake (timestamp+machine+sequence), database ticket servers, ULID, clock-skew handling.',
    pitfalls: 'URL shortener: using a slow hash and ignoring collisions; 301 caching forever breaking analytics. Rate limiter: fixed-window burst at boundaries (2x allowed); race conditions in distributed counters (need atomic ops/Lua); token vs leaky bucket confusion. ID gen: UUIDv4 as a clustered primary key (random = index fragmentation, write amplification — use v7/ULID/Snowflake); Snowflake clock-rollback duplicate IDs.',
  },
  {
    id: '23-news-feed-and-timeline',
    path: '04-design-case-studies/23-news-feed-and-timeline.md',
    title: 'Case Study: News Feed / Social Timeline',
    objectives: 'Design a read-heavy social system and master the fan-out trade-off that defines feed architecture.',
    cover: 'Requirements (post, follow, generate a ranked feed); fan-out-on-write (push, precompute each follower\'s feed) vs fan-out-on-read (pull, assemble at read time) vs the hybrid; the celebrity/hot-user problem and why pure push breaks for them; feed storage and caching; ranking (chronological vs ML-ranked) at a high level; pagination of an infinite feed (cursor-based); handling edits/deletes; consistency expectations (eventual is fine for feeds); estimation for a large social graph; how Twitter/Instagram/Facebook actually approach this.',
    pitfalls: 'Pure fan-out-on-write for celebrities (millions of writes per post); pure fan-out-on-read for everyone (expensive assembly, fan-out cost on read); offset pagination on a live feed (dupes/skips); ignoring the write amplification of push; not separating the social graph store from the feed store; treating feed consistency as if it needs to be strong.',
  },
  {
    id: '24-chat-and-notifications',
    path: '04-design-case-studies/24-chat-and-notifications.md',
    title: 'Case Studies: Chat / Messaging & Notification System',
    objectives: 'Design real-time, stateful, delivery-guaranteed systems — the hardest interactive systems to get right.',
    cover: 'Chat: connection management at scale (WebSocket gateways, who-is-connected-where registry), 1:1 and group messaging, message ordering and storage, delivery + read receipts, online/presence, offline delivery and push, end-to-end vs transport encryption note, the sequence-number/idempotency for dedup. Notification system: multi-channel (push/APNs/FCM, SMS, email), fan-out, template + preference management, rate limiting and deduplication, retries and DLQ, prioritization, third-party provider failure handling. The role of message queues, the at-least-once + idempotency pattern.',
    pitfalls: 'Stateful WebSocket servers without a presence/routing layer (cannot find the recipient\'s server); assuming message ordering for free across a distributed store; no dedup leading to duplicate notifications on retry; synchronous fan-out to slow third-party providers; ignoring offline users; presence treated as strongly consistent; no backpressure when a channel provider is down.',
  },
  {
    id: '25-search-and-geo',
    path: '04-design-case-studies/25-search-and-geo.md',
    title: 'Case Studies: Typeahead / Search & Proximity (Geo) Service',
    objectives: 'Design search-autocomplete and location-based systems — indexing and spatial-partitioning patterns that power many products.',
    cover: 'Typeahead: trie-based prefix matching, top-K per prefix precomputation, ranking by popularity, caching, debouncing, sharding the trie, handling updates/staleness, the inverted index for full search and a note on Elasticsearch. Proximity/geo (Yelp/Uber-style): the problem with naive lat/long range queries, spatial indexing options (geohash, quadtree, Google S2, H3 hexagons, R-tree/PostGIS), how to find "nearby" efficiently, hot-region partitioning, and how ride-hailing matches drivers to riders in real time (location updates, dispatch).',
    pitfalls: 'Range query on raw lat/long with two B-tree indexes (cannot use both efficiently — need a spatial index); geohash edge/boundary problem (neighbors with different prefixes — must query adjacent cells); recomputing top-K per keystroke instead of precomputing; not sharding a huge trie; treating a uniform grid as fine when density is wildly uneven (hot cells).',
  },
  {
    id: '26-object-store-and-kv-store',
    path: '04-design-case-studies/26-object-store-and-kv-store.md',
    title: 'Case Studies: Distributed Object Store (S3) & Key-Value Store (Dynamo)',
    objectives: 'Design the storage primitives others build on — consolidating replication, partitioning, and consistency into real systems.',
    cover: 'Object store (S3-like): the data plane vs metadata/control plane split, chunking large objects, erasure coding vs replication for durability (11 nines), the metadata service and its scaling, multipart upload, eventual vs strong read-after-write, lifecycle/tiering. Distributed KV store (Dynamo-style): consistent hashing for partitioning, quorum (R/W/N) for tunable consistency, vector clocks/version vectors for conflict detection, gossip for membership, hinted handoff + read repair + anti-entropy (Merkle trees) for durability, and how all the earlier building blocks compose into one coherent design. This is the capstone that ties Part 1-2 together.',
    pitfalls: 'Replication-only durability when erasure coding is far cheaper for cold data; storing object bytes in the metadata DB; thinking S3 was always strongly consistent (read-after-write semantics evolved); Dynamo quorum without understanding R+W>N; ignoring anti-entropy (data drifts); treating Merkle trees as optional for repair; conflating the object store\'s data plane with its control plane.',
  },
  {
    id: '27-payments-and-ledgers',
    path: '04-design-case-studies/27-payments-and-ledgers.md',
    title: 'Case Study: Payment System & Double-Entry Ledger',
    objectives: 'Design systems where correctness and auditability are non-negotiable — the domain that punishes sloppy consistency thinking.',
    cover: 'Why money is special (no lost/double writes, full auditability, regulatory); double-entry bookkeeping as the data model (debits=credits, immutable append-only ledger, balances as derived state); idempotency keys for payment requests (the canonical use case); the dual-write/outbox pattern for "charge card AND record ledger entry"; reconciliation with external processors; handling the inherently-eventual external world (async settlement, webhooks, retries) while keeping internal invariants; exactly-once via idempotency; sagas for multi-step payment flows; consistency choice (you lean strongly consistent here); fraud/limits as a design concern.',
    pitfalls: 'Mutable balance column updated in place (no audit trail, race conditions — use an append-only ledger and derive balance); non-idempotent charge endpoint (double charge on retry); floating-point money (use integer minor units / decimal); assuming the external processor is synchronous/reliable; eventual consistency on a single account balance without guards; no reconciliation; ignoring partial failure between card-charge and ledger-write.',
  },
  {
    id: '28-streaming-and-crawler',
    path: '04-design-case-studies/28-streaming-and-crawler.md',
    title: 'Case Studies: Video Streaming (YouTube/Netflix) & Web Crawler',
    objectives: 'Design massive read-heavy media delivery and a politely-distributed batch crawler — bandwidth, CDN, and crawl-frontier patterns.',
    cover: 'Video: upload + transcoding pipeline (multiple resolutions/codecs, async workers), adaptive bitrate streaming (HLS/DASH, chunking), CDN as the core of delivery and the egress-cost reality, metadata vs blob storage split, recommendations note, thumbnail/preview generation, the read-heavy caching story. Web crawler: the URL frontier (prioritization + politeness/per-domain rate limiting), DNS resolution at scale, dedup (content + URL via bloom filters), the robots.txt contract, distributed coordination of workers, trap/loop avoidance, freshness vs coverage, storage of the crawled corpus, being a good citizen.',
    pitfalls: 'Serving video from origin instead of CDN (bandwidth cost + latency); synchronous transcoding blocking upload; ignoring adaptive bitrate (buffering on poor networks); crawler without politeness (hammering a domain — effectively a DoS); no URL/content dedup (infinite loops, spider traps); not honoring robots.txt; treating crawl as one-shot rather than continuous with freshness scheduling.',
  },

  // PART 5 — PRINCIPAL SKILLS
  {
    id: '29-tradeoffs-and-adrs',
    path: '05-principal-skills/29-tradeoffs-and-adrs.md',
    title: 'Trade-off Reasoning & Architecture Decision Records',
    objectives: 'Develop the meta-skill that actually defines a principal engineer: making and documenting defensible trade-offs.',
    cover: 'Why "it depends" is the start of the answer, not the end — how to make the dependency explicit; the universal trade-off axes (consistency vs availability vs latency, read vs write optimization, cost vs performance, simplicity vs flexibility, time-to-market vs scalability, build vs buy); driving decisions from requirements and constraints rather than fashion; quantifying with capacity numbers and SLOs; reversible (two-way-door) vs irreversible (one-way-door) decisions and how that changes rigor; Architecture Decision Records (context, decision, alternatives considered, consequences) and why writing them is leverage; how to disagree-and-commit and communicate decisions; recognizing and naming your assumptions; the cost of premature optimization vs premature scaling. Reference the engineering:architecture ADR skill in this repo\'s tooling.',
    pitfalls: 'Resume-driven / hype-driven design; treating reversible and irreversible decisions with the same (or wrong) level of rigor; trade-offs stated without the requirement that drives them; no written record (decisions relitigated forever); confusing simple with easy; optimizing before measuring; scaling before product-market fit.',
  },
  {
    id: '30-evolutionary-architecture',
    path: '05-principal-skills/30-evolutionary-architecture.md',
    title: 'Evolutionary Architecture: Migrations, Legacy & Designing for Change',
    objectives: 'Design systems that survive years of change and migrate large systems without downtime — where real principal work happens.',
    cover: 'Why most architecture work is changing a running system, not greenfield; designing for evolvability (loose coupling, clear contracts, fitness functions); zero-downtime migration patterns (expand/contract a.k.a. parallel change, dual writes, backfill, shadow reads, the Strangler Fig); online schema changes and large data backfills safely; feature flags and progressive delivery (canary, blue-green, percentage rollout) and their rollback story; database migration without downtime; decomposing a monolith incrementally; managing technical debt deliberately (reference the engineering:tech-debt skill); deprecation and contract versioning; the org/Conway dimension of architecture change.',
    pitfalls: 'Big-bang rewrites/migrations (high risk, often fail); schema changes that lock tables or break old code (no expand/contract); dual-write without reconciliation (drift); no rollback plan for a migration; flag debt (flags never removed); ignoring data backfill cost/time; treating tech debt as purely negative rather than sometimes-deliberate leverage.',
  },
  {
    id: '31-reading-list-and-papers',
    path: '05-principal-skills/31-reading-list-and-papers.md',
    title: 'The Principal\'s Reading List: Papers, Books & Systems to Study',
    objectives: 'Provide a curated, sequenced path to primary sources so depth keeps compounding after this curriculum.',
    cover: 'The canon, organized by theme and with a one-paragraph "why it matters and what to take away" for each. Books: Designing Data-Intensive Applications (the single most important — map its chapters to these writeups), Database Internals, Understanding Distributed Systems, SRE book + workbook, Release It!, the System Design Interview volumes, Software Architecture: The Hard Parts. Foundational papers: Google trio (GFS, MapReduce, Bigtable), Dynamo, Spanner, the Raft paper (In Search of an Understandable Consensus Algorithm), Paxos Made Simple, the Kafka/log paper + Kreps "The Log", FLP impossibility, Lamport "Time, Clocks", CAP/Brewer + Gilbert-Lynch proof, Calvin, Chubby, ZooKeeper, Borg/Kubernetes. Engineering blogs and where to keep learning. A suggested reading order interleaved with the 12-week roadmap. Be honest about which papers to read deeply vs skim.',
    pitfalls: 'Recommending papers without saying why or in what order; listing without mapping to concepts already learned; ignoring DDIA as the spine; treating all papers as equally essential for an early-career engineer; no guidance on read-deeply vs skim.',
  },
]

// ---- Shared style guide ------------------------------------------------------
const STYLE = [
  'AUDIENCE: an early-career engineer (under 2 years, mostly feature work) on a focused 3-month intensive, building toward principal-level JUDGMENT in high-level design. They are smart but you must not assume distributed-systems background — build intuition from first principles, then go deep. The goal is not vocabulary, it is the ability to reason about trade-offs in a real design discussion.',
  '',
  'Write a comprehensive, technically PRECISE markdown document. Depth target: 1800-3500 words of real substance (no filler). Principal-level means: explain not just WHAT but WHY it exists, HOW it fails, what it COSTS, and WHEN to choose it over alternatives. Use concrete numbers, named real-world systems, and honest trade-offs.',
  '',
  'Use this exact section structure (markdown headings):',
  '# <Title>',
  '> One-line "Where this fits" + a bold **Principal-level takeaway:** — the single piece of judgment the reader should walk away with.',
  '## The Mental Model — first principles: why does this thing exist, what problem does it solve?',
  '## Core Concepts — the deep technical content, broken into clear subsections (use ### ). This is the bulk.',
  '## Trade-offs at a Glance — at least one markdown TABLE comparing the real options with their pros/cons/when-to-use.',
  '## How Real Systems Do It — concrete, named examples with rough numbers (e.g., what Cassandra/Kafka/DynamoDB/Postgres actually do).',
  '## Failure Modes & Common Misconceptions — what breaks in production, and the specific myths beginners believe (call them out explicitly and correct them).',
  '## In a Design Discussion — how to apply this when whiteboarding/designing; contrast a JUNIOR take vs a PRINCIPAL take on this topic.',
  '## Self-Check — 5 to 8 questions (with brief answers in a <details> block or inline) that test real understanding.',
  '## Go Deeper — specific papers, book chapters (esp. map to "Designing Data-Intensive Applications" chapters where relevant), and links.',
  '',
  'FORMAT: use tables for comparisons, fenced code blocks for pseudocode/configs/schemas, and ASCII or mermaid diagrams where a picture genuinely helps. Be rigorous and correct — this content will be adversarially fact-checked. Cross-link to sibling writeups where natural: every writeup lives one folder deep, so link with a relative path of the form ../<folder>/<file.md> (e.g. ../02-distributed-systems/13-consensus.md). The root index is ../README.md and the plan is ../ROADMAP.md.',
].join('\n')

const TOC = TOPICS.map(t => '  - ' + t.title + '  ->  ' + t.path).join('\n')

function writerPrompt(t) {
  return [
    'You are a principal distributed-systems engineer and an exceptional technical writer, authoring one chapter of a self-study HLD curriculum.',
    '',
    STYLE,
    '',
    '=== YOUR TOPIC ===',
    'Title: ' + t.title,
    'Learning objective: ' + t.objectives,
    'You MUST cover (deeply, not as a list — weave into prose + structure): ' + t.cover,
    '',
    '=== FULL CURRICULUM (for cross-linking; do not duplicate their content) ===',
    TOC,
    '',
    '=== OUTPUT ===',
    'Write the complete markdown document to this exact absolute path using the Write tool: ' + BASE + '/' + t.path,
    'Do not ask questions or wait — produce the full, finished document now. After writing, reply with a one-line confirmation and the approximate word count.',
  ].join('\n')
}

const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    topic: { type: 'string' },
    technicallyAccurate: { type: 'boolean', description: 'true if, after your fixes, the document is technically correct' },
    metStructureAndDepth: { type: 'boolean', description: 'true if it follows the required section structure and hits principal-level depth' },
    issuesFound: { type: 'array', items: { type: 'string' }, description: 'specific technical or structural problems you found' },
    fixesApplied: { type: 'array', items: { type: 'string' }, description: 'edits you actually made to the file' },
    remainingConcerns: { type: 'array', items: { type: 'string' }, description: 'anything still imperfect that a human should glance at' },
    approxWordCount: { type: 'number' },
  },
  required: ['topic', 'technicallyAccurate', 'metStructureAndDepth', 'issuesFound', 'fixesApplied', 'remainingConcerns', 'approxWordCount'],
}

function reviewPrompt(t) {
  return [
    'You are a ruthless, adversarial technical fact-checker AND editor with deep principal-level distributed-systems expertise. Your job is to catch and FIX errors that would embarrass the reader if they repeated them in a design review.',
    '',
    'Read the file at this absolute path: ' + BASE + '/' + t.path,
    '',
    'Verify, with skepticism:',
    '1) TECHNICAL ACCURACY. Scrutinize every claim. Pay special attention to these known traps for THIS topic: ' + t.pitfalls,
    '   Also enforce general rigor across the whole document: CAP stated as a partition-time choice (not "pick 2 always"); isolation levels mapped to the correct anomalies; consensus/Raft/Paxos details correct; consistency-model definitions precise; latency/throughput numbers realistic and in the right order of magnitude; no hand-wavy claim that is actually false.',
    '2) DEPTH & STRUCTURE. It must follow the required section structure (Mental Model, Core Concepts, Trade-offs table, How Real Systems Do It, Failure Modes & Misconceptions, In a Design Discussion, Self-Check, Go Deeper), hit principal-level depth, and include at least one comparison table. Cross-links should use ../<folder>/<file.md> form.',
    '3) CORRECTNESS OF EXAMPLES, pseudocode, and any diagrams.',
    '',
    'FIX problems directly by editing the file (use Edit/Write). Do not merely report — correct factual errors, sharpen vague claims, fill missing required sections, and tighten. Preserve the author voice and length; improve substance. If it is already excellent, make only the edits that genuinely help.',
    '',
    'Then return the structured report. Be honest: if you found and fixed real errors, list them specifically.',
  ].join('\n')
}

// ---- Orchestration -----------------------------------------------------------
log('Generating ' + TOPICS.length + ' principal-level HLD writeups, each fact-checked and fixed.')

const reports = await pipeline(
  TOPICS,
  (t) => agent(writerPrompt(t), { label: 'write:' + t.id, phase: 'Write deep-dives' }),
  (writeResult, t) => agent(reviewPrompt(t), { label: 'verify:' + t.id, phase: 'Fact-check & fix', schema: REVIEW_SCHEMA }),
)

const clean = reports.filter(Boolean)
const inaccurate = clean.filter(r => !r.technicallyAccurate)
const shallow = clean.filter(r => !r.metStructureAndDepth)
const totalFixes = clean.reduce((n, r) => n + (r.fixesApplied ? r.fixesApplied.length : 0), 0)

log('Done. ' + clean.length + '/' + TOPICS.length + ' writeups verified. ' + totalFixes + ' fixes applied. ' + inaccurate.length + ' still flagged inaccurate, ' + shallow.length + ' flagged thin.')

return {
  generated: clean.length,
  totalTopics: TOPICS.length,
  totalFixesApplied: totalFixes,
  flaggedInaccurate: inaccurate.map(r => ({ topic: r.topic, concerns: r.remainingConcerns })),
  flaggedThin: shallow.map(r => r.topic),
  reports: clean.map(r => ({ topic: r.topic, accurate: r.technicallyAccurate, depthOk: r.metStructureAndDepth, fixes: r.fixesApplied, concerns: r.remainingConcerns, words: r.approxWordCount })),
}
