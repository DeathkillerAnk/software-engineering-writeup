# Principal Engineer Curriculum: Distributed Systems & Microservices — Complete Roadmap

> This roadmap covers every concept, part, and requirement specified in the
> [Master Prompt](./# Master Prompt — Principal Engineer: Di.md).
> It is structured to take you from foundational mechanics to Principal Engineer-level
> architecture decision-making across **62 chapters**, **5 levels**, **5 milestone checkpoints**,
> and an estimated **~850 hours** of deep study.

---

## How to Read This Roadmap

| Column | Meaning |
|--------|---------|
| **Ch** | Chapter number (sequential across the entire curriculum) |
| **Title** | Chapter title |
| **Part** | Master Prompt Part number it maps to |
| **Difficulty** | Beginner / Intermediate / Advanced / Principal |
| **Importance** | **Must Know** (core) · **Should Know** (important) · **Deep Dive** (specialist) · **Optional** |
| **Prerequisites** | Chapters that must be completed first |
| **Effort** | Estimated hours including reading, exercises, and labs |
| **Existing Content** | Links to content already built in this workspace |
| **Revisited In** | Later chapters where this concept is deepened |

---

## Core Learning Philosophy Applied Throughout

*   **First Principles:** Every topic answers — What problem? Why does it exist? Mechanism? Runtime behavior? Assumptions? Guarantees? What it does NOT guarantee? Failure modes? Trade-offs? Alternatives? When to use? When NOT to use? How production systems implement it? What a Principal Engineer considers? (Master Prompt §Core Learning Philosophy)
*   **The Central Mental Model:** Continuously trace the path: CPU → OS → Network → Distributed System → Microservice → Reliability → Scalability → Cloud → Production → Architecture → Principal Decision Making.
*   **Pedagogical Rules Applied:** Visual Learning (Part 32), Teaching Style (Part 33), Principal Engineer Perspective (Part 34), Common Mistakes (Part 35), Exercises (Part 36), Cross-Concept Connections (Part 39), Architecture Evolution (Part 40), Architecture Decision Frameworks (Part 41).
*   **Chapter Format:** Every chapter follows the structure defined in §Chapter Format — Difficulty, Importance, Prerequisites, Learning Objectives, Why This Matters, Mental Model, Intuition, Visual Explanation, Core Concepts, Deep Dive, Internal Mechanics, Step-by-Step Execution, Real-World Example, Failure Scenarios, Performance, Trade-offs, Alternatives, Production Considerations, Beginner/Senior Mistakes, Architecture Smells, Principal Perspective, Review Questions, Visual/Animation Spec, Hands-On Tutorial, Failure Injection Lab, Exercises, Solutions, Interview Questions, Summary, What To Learn Next.

---

## LEVEL 1 — FOUNDATIONS

**Goal:** Understand how backend systems work from low-level mechanics to basic distributed-systems theory and data storage.

**Duration:** ~120 hours

---

### Part 0 — Engineering Foundations

#### Chapter 1 — Computer Systems
*Difficulty: Intermediate · Importance: Must Know · Prerequisites: None · Effort: 15h*

*Topics:* CPU architecture and instruction execution, memory hierarchy (registers → L1/L2/L3 → RAM → disk), cache lines and cache coherence, processes and threads, context switching costs, system calls, kernel vs user space, file descriptors, interrupts and I/O, blocking vs non-blocking I/O, buffers, memory allocation (stack vs heap), garbage collection overview, CPU scheduling algorithms.

*Existing Content:* [`java/00-platform-and-mental-model`](../java/00-platform-and-mental-model) (JVM-specific but covers execution pipeline, memory areas), [`HLD/00-foundations/02-compute-and-concurrency.md`](../HLD/00-foundations/02-compute-and-concurrency.md)

*Revisited In:* Ch 2 (concurrency), Ch 35 (queueing theory), Ch 50 (Inside Redis — single-threaded model)

---

#### Chapter 2 — Concurrency & Parallelism
*Difficulty: Advanced · Importance: Must Know · Prerequisites: Ch 1 · Effort: 20h*

*Topics:* Concurrency vs parallelism, threads vs processes, locks, mutexes, semaphores, atomic operations, compare-and-swap (CAS), race conditions, deadlocks, livelocks, starvation, memory visibility and memory ordering, happens-before relationships, thread pools, event loops, async programming models, the actor model. **Why concurrency becomes substantially harder when components are on different machines.**

*Existing Content:* [`java/03-concurrency-and-jmm`](../java/03-concurrency-and-jmm) (Ch 15–19: threads, JMM, locks, j.u.c., virtual threads + 4 animations), [`HLD/00-foundations/02-compute-and-concurrency.md`](../HLD/00-foundations/02-compute-and-concurrency.md)

*Revisited In:* Ch 6 (distributed computing model), Ch 25 (consensus), Ch 37 (distributed scheduling)

---

### Part 1 — Networking Fundamentals

#### Chapter 3 — Network Layers, TCP & UDP
*Difficulty: Intermediate · Importance: Must Know · Prerequisites: Ch 1 · Effort: 12h*

*Topics:* OSI model, TCP/IP model, Ethernet and MAC addresses, IP (IPv4/IPv6), ARP, routing, subnets, CIDR, NAT, ports, sockets. TCP handshake (SYN/SYN-ACK/ACK), connection establishment and termination, sequence numbers, ACKs, retransmission, flow control (receive window), congestion control (slow start, AIMD), sliding windows, connection resets, half-open connections, keep-alive, connection pooling. UDP — why it exists, UDP vs TCP trade-offs, reliability over UDP, QUIC protocol.

*Existing Content:* [`HLD/00-foundations/01-networking.md`](../HLD/00-foundations/01-networking.md)

*Revisited In:* Ch 4 (HTTP/TLS), Ch 5 (infrastructure), Ch 14 (gRPC/HTTP2), Ch 42 (service mesh)

---

#### Chapter 4 — DNS, HTTP & TLS
*Difficulty: Intermediate · Importance: Must Know · Prerequisites: Ch 3 · Effort: 10h*

*Topics:* DNS hierarchy, recursive resolution, authoritative servers, DNS caching and TTL, DNS failures, DNS-based load balancing, service discovery through DNS. HTTP/1.0 → HTTP/1.1 → HTTP/2 → HTTP/3, methods, headers, status codes, keep-alive, multiplexing, head-of-line blocking. TLS — encryption, certificates, certificate authorities, TLS handshake, symmetric vs asymmetric encryption, key exchange, certificate validation, mTLS.

*Existing Content:* [`HLD/00-foundations/01-networking.md`](../HLD/00-foundations/01-networking.md)

*Revisited In:* Ch 14 (gRPC/HTTP2 framing), Ch 41 (distributed security/mTLS)

---

#### Chapter 5 — Infrastructure Networking
*Difficulty: Intermediate · Importance: Must Know · Prerequisites: Ch 3, Ch 4 · Effort: 8h*

*Topics:* Reverse proxies, forward proxies, load balancers (L4 vs L7), load balancing algorithms (round-robin, least connections, consistent hashing), NAT gateways, firewalls, network policies, service discovery mechanisms. **Visualize the complete request journey:** Client → DNS → TCP → TLS → HTTP → Load Balancer → Service → Database.

*Existing Content:* [`HLD/01-building-blocks/05-load-balancing.md`](../HLD/01-building-blocks/05-load-balancing.md)

*Revisited In:* Ch 17 (Kubernetes networking), Ch 42 (service mesh), Ch 55 (Inside a Load Balancer)

---

### Part 2 — Distributed Systems Fundamentals

#### Chapter 6 — The Distributed Computing Model
*Difficulty: Advanced · Importance: Must Know · Prerequisites: Ch 1, Ch 3 · Effort: 15h*

*Topics:* What is a distributed system, why distributed systems are difficult, centralized vs distributed, distributed computing models (synchronous, asynchronous, partial synchrony), network uncertainty, latency, partial failure, the 8 fallacies of distributed computing. Failure models — crash failures, omission failures, Byzantine failures, network partitions, process failures, machine failures, disk failures, dependency failures. Safety vs liveness properties, determinism vs nondeterminism.

*Existing Content:* [`HLD/02-distributed-systems/12-consistency-and-cap.md`](../HLD/02-distributed-systems/12-consistency-and-cap.md) (partial), [`HLD/02-distributed-systems/16-reliability-and-failure.md`](../HLD/02-distributed-systems/16-reliability-and-failure.md) (partial)

*Revisited In:* Ch 7 (limits), Ch 25 (consensus), Ch 32 (reliability patterns), Ch 36 (failure detection)

---

#### Chapter 7 — Fundamental Laws & Limits
*Difficulty: Advanced · Importance: Deep Dive · Prerequisites: Ch 6 · Effort: 12h*

*Topics:* CAP theorem (formal statement, practical implications, misconceptions), PACELC, FLP impossibility theorem (formal intuition and why it matters), Two Generals Problem, Byzantine Generals Problem, consensus limitations, impossibility results. For each: **What problem → Why it exists → Formal intuition → Example → Visualization → Practical implication.**

*Existing Content:* [`HLD/02-distributed-systems/12-consistency-and-cap.md`](../HLD/02-distributed-systems/12-consistency-and-cap.md)

*Revisited In:* Ch 21 (consistency models), Ch 25 (consensus), Ch 40 (multi-region)

---

### Database Foundations (prerequisite for distributed storage)

#### Chapter 8 — Database Fundamentals & Internals
*Difficulty: Intermediate · Importance: Must Know · Prerequisites: Ch 1 · Effort: 15h*

*Topics:* Relational model, SQL vs NoSQL, ACID properties, transaction isolation levels (Read Uncommitted → Serializable), MVCC (multi-version concurrency control), query planning and optimization, buffer pools, lock managers, connection management. NoSQL data models — document, key-value, wide-column, graph. When to use what.

*Existing Content:* [`HLD/01-building-blocks/07-databases-relational.md`](../HLD/01-building-blocks/07-databases-relational.md), [`HLD/01-building-blocks/08-databases-nosql.md`](../HLD/01-building-blocks/08-databases-nosql.md), [`spring-boot/04-data-and-transactions`](../spring-boot/04-data-and-transactions) (JPA/Hibernate internals)

*Revisited In:* Ch 23 (partitioning), Ch 33 (data in microservices), Ch 52 (Inside PostgreSQL)

---

#### Chapter 9 — Storage Engines: B-Trees, LSM Trees & WAL
*Difficulty: Advanced · Importance: Must Know · Prerequisites: Ch 8 · Effort: 10h*

*Topics:* Write-ahead log (WAL), B-trees (structure, splits, performance characteristics), LSM trees (memtable → SSTable → compaction), SSTables, bloom filters (introduction), compaction strategies (size-tiered, leveled), tombstones, garbage collection in storage. Trade-off: B-trees (read-optimized) vs LSM (write-optimized).

*Existing Content:* [`HLD/00-foundations/03-storage-engines.md`](../HLD/00-foundations/03-storage-engines.md), [`HLD/animations/lsm-vs-btree.html`](../HLD/animations/lsm-vs-btree.html)

*Revisited In:* Ch 23 (distributed storage), Ch 50 (Inside Redis), Ch 53 (Inside Cassandra)

---

> ### 🏁 MILESTONE 1 — Foundations Complete
>
> **You can now:** Trace a request from client → DNS → TCP → TLS → HTTP → Load Balancer → Service → Database and explain what happens at each layer. Understand why distributed systems are fundamentally hard. Explain CAP, FLP, and the Two Generals Problem. Understand how databases store and retrieve data internally.
>
> **Total effort so far:** ~120 hours

---

## LEVEL 2 — PRACTITIONER

**Goal:** Build and operate reliable services. Understand microservice design, communication, containers, and observability.

**Duration:** ~150 hours

---

### Part 18 & 19 — Microservices Fundamentals & Service Design

#### Chapter 10 — Microservices Fundamentals
*Difficulty: Intermediate · Importance: Must Know · Prerequisites: Ch 6 · Effort: 10h*

*Topics:* Monoliths, modular monoliths, SOA, microservices — why they emerged, benefits, costs. When microservices make sense, when they are a terrible choice. Distributed monoliths, nano-services (anti-pattern). Independent deployment, independent scaling, organizational boundaries (Conway's Law introduction). **Microservices as a consequence of distributed-system design decisions, not merely splitting code into repositories.**

*Existing Content:* [`HLD/03-architecture-and-apis/18-architectural-styles.md`](../HLD/03-architecture-and-apis/18-architectural-styles.md)

*Revisited In:* Ch 33 (data in microservices), Ch 49 (advanced patterns), Ch 57 (organizational design)

---

#### Chapter 11 — Service Design & Domain Modeling
*Difficulty: Advanced · Importance: Must Know · Prerequisites: Ch 10 · Effort: 15h*

*Topics:* Service boundaries, domain boundaries, bounded contexts, domain-driven design (DDD), aggregates, coupling (types and measurement), cohesion, API boundaries, data ownership, database boundaries, database-per-service vs shared databases, stateless vs stateful services, service decomposition strategies, identifying boundaries, avoiding distributed monoliths. **Realistic exercises where a monolith is gradually decomposed.**

*Existing Content:* [`LLD/04-domain-modeling-and-concurrency`](../LLD/04-domain-modeling-and-concurrency), [`LLD/01-design-principles`](../LLD/01-design-principles)

*Revisited In:* Ch 33 (data ownership), Ch 49 (strangler fig), Ch 57 (organizational boundaries)

---

### Part 20 — Microservice Communication

#### Chapter 12 — API Design, Contracts & Governance
*Difficulty: Intermediate · Importance: Must Know · Prerequisites: Ch 10, Ch 11 · Effort: 12h*

*Topics:* API-first design, API as a contract, backward/forward compatibility, API versioning strategies (URL, header, content negotiation), schema evolution, breaking vs non-breaking changes, contract testing (consumer-driven contracts), API governance at scale, OpenAPI/Swagger, API documentation. For every communication method: **Latency → Failure modes → Ordering → Retry → Backpressure → Consistency → Scaling → Operational complexity.**

*Existing Content:* [`HLD/03-architecture-and-apis/17-api-design.md`](../HLD/03-architecture-and-apis/17-api-design.md)

*Revisited In:* Ch 14 (gRPC contracts), Ch 33 (data contracts), Ch 49 (API gateway pattern)

---

#### Chapter 13 — REST & HTTP APIs
*Difficulty: Intermediate · Importance: Must Know · Prerequisites: Ch 4, Ch 12 · Effort: 8h*

*Topics:* REST constraints, resource modeling, HTTP methods semantics, status code discipline, content negotiation, HATEOAS (theory vs practice), pagination (cursor vs offset), filtering/sorting, idempotency in HTTP (safe vs idempotent methods), request validation, error responses (RFC 7807 Problem Detail), rate limiting headers.

*Existing Content:* [`spring-boot/03-web-mvc-and-reactive/17-building-rest-apis-negotiation-errors-and-validation.md`](../spring-boot/03-web-mvc-and-reactive/17-building-rest-apis-negotiation-errors-and-validation.md), [`HLD/03-architecture-and-apis/17-api-design.md`](../HLD/03-architecture-and-apis/17-api-design.md)

*Revisited In:* Ch 32 (reliability — retries on non-idempotent calls), Ch 49 (BFF pattern)

---

#### Chapter 14 — gRPC & Protocol Buffers
*Difficulty: Intermediate · Importance: Should Know · Prerequisites: Ch 4, Ch 12 · Effort: 10h*

*Topics:* Protocol Buffers encoding (varints, wire types, field tags), schema definition language, code generation, HTTP/2 framing (streams, frames, HPACK header compression), gRPC communication patterns (unary, server streaming, client streaming, bidirectional), deadlines and cancellation propagation, gRPC load balancing (client-side vs proxy), gRPC vs REST trade-offs, reflection, health checking protocol, gRPC-Web.

*Existing Content:* None — NEW chapter

*Revisited In:* Ch 42 (service mesh gRPC routing), Ch 51 (Inside Kafka — binary protocol)

---

#### Chapter 15 — Async Communication: GraphQL, WebSockets & SSE
*Difficulty: Intermediate · Importance: Should Know · Prerequisites: Ch 4, Ch 12 · Effort: 8h*

*Topics:* GraphQL — schema, resolvers, N+1 problem, DataLoader batching, subscriptions, overfetching/underfetching trade-offs, when NOT to use GraphQL. WebSockets — connection lifecycle, heartbeats, reconnection, scaling stateful WebSocket connections, socket.io patterns. Server-Sent Events (SSE) — HTTP streaming, event-stream format, reconnection with Last-Event-ID. Comparison matrix: REST vs gRPC vs GraphQL vs WebSocket vs SSE.

*Existing Content:* None — NEW chapter

*Revisited In:* Ch 29 (event-driven architecture), Ch 49 (BFF + API Gateway)

---

### Part 24 — Cloud, Containers & Kubernetes

#### Chapter 16 — Containers & Container Internals
*Difficulty: Intermediate · Importance: Must Know · Prerequisites: Ch 1 · Effort: 10h*

*Topics:* Processes vs containers (containers are NOT lightweight VMs), Linux namespaces (PID, network, mount, UTS, IPC, user), cgroups (resource limits, CPU shares, memory limits, OOM killer), union filesystems and image layers, container networking (veth pairs, bridges, iptables), container storage (volumes, bind mounts, tmpfs), container runtimes (containerd, runc), image build optimization (layer caching, multi-stage builds).

*Existing Content:* None — NEW chapter

*Revisited In:* Ch 17 (Kubernetes pods), Ch 43 (deployment), Ch 55 (Inside Kubernetes)

---

#### Chapter 17 — Kubernetes Architecture & Internals
*Difficulty: Intermediate · Importance: Must Know · Prerequisites: Ch 16 · Effort: 15h*

*Topics:* Control plane — API server, scheduler, controller manager, etcd. Data plane — nodes, kubelet, kube-proxy. Core objects — Pods, Deployments, ReplicaSets, StatefulSets, DaemonSets, Jobs/CronJobs. Services (ClusterIP, NodePort, LoadBalancer), Ingress, service discovery (CoreDNS), ConfigMaps, Secrets, resource requests and limits, HPA/VPA autoscaling, scheduling (node affinity, taints/tolerations), rolling deployments, readiness/liveness probes. **Do not treat Kubernetes as magic.** Explain what happens internally when "I deploy a new service."

*Existing Content:* None — NEW chapter

*Revisited In:* Ch 37 (distributed scheduling), Ch 43 (deployment), Ch 55 (Inside Kubernetes)

---

### Part 17 — Distributed Observability

#### Chapter 18 — Production Observability
*Difficulty: Intermediate · Importance: Must Know · Prerequisites: Ch 10 · Effort: 12h*

*Topics:* The three pillars — structured logging, metrics, traces. Metrics frameworks — RED (Rate, Errors, Duration), USE (Utilization, Saturation, Errors), golden signals (latency, traffic, errors, saturation). SLIs, SLOs, SLAs, error budgets. Alerting philosophy — symptom-based vs cause-based, alert fatigue. Service dependency graphs, critical-path analysis. Continuous profiling. eBPF for observability.

*Existing Content:* [`HLD/03-architecture-and-apis/19-observability.md`](../HLD/03-architecture-and-apis/19-observability.md), [`spring-boot/05-production/25-actuator-and-observability.md`](../spring-boot/05-production/25-actuator-and-observability.md)

*Revisited In:* Ch 19 (tracing internals), Ch 45 (chaos eng — observability during failure)

---

#### Chapter 19 — Distributed Tracing Internals
*Difficulty: Advanced · Importance: Should Know · Prerequisites: Ch 18 · Effort: 8h*

*Topics:* Context propagation (W3C Trace Context, B3), correlation IDs, trace IDs, span IDs, parent-child relationships. OpenTelemetry architecture — SDK, exporters, collectors, OTLP protocol. Trace sampling strategies — head-based, tail-based, rate-limited, priority-based. High-cardinality metrics and exemplars (linking metrics to traces). Trace storage backends (Jaeger, Tempo, Zipkin). **Show one user request traveling through 10+ services and demonstrate how to debug it.**

*Existing Content:* None — NEW chapter (extends HLD observability)

*Revisited In:* Ch 45 (chaos eng — tracing during failure injection)

---

> ### 🏁 MILESTONE 2 — Practitioner Complete
>
> **You can now:** Design, deploy, and observe a multi-service application. Understand service boundaries, API design trade-offs (REST vs gRPC vs GraphQL), container internals, Kubernetes orchestration, and production observability. Can debug a distributed request across services using tracing.
>
> **Total effort so far:** ~270 hours

---

## LEVEL 3 — SENIOR ENGINEER

**Goal:** Design reliable distributed systems, mastering time, consistency, replication, partitioning, transactions, messaging, caching, and performance theory.

**Duration:** ~200 hours

---

### Part 3 — Time, Clocks, Ordering & Causality

#### Chapter 20 — Time in Distributed Systems
*Difficulty: Advanced · Importance: Must Know · Prerequisites: Ch 6, Ch 7 · Effort: 15h*

*Topics:* Physical clocks, clock drift, clock skew, clock synchronization, NTP (architecture, accuracy limits), monotonic clocks, wall clocks vs monotonic clocks, clock uncertainty intervals. Logical clocks — Lamport clocks, vector clocks, hybrid logical clocks (HLC). Happened-before relationship, causality, total ordering, partial ordering, causal ordering, event ordering, logical timestamps. **Connect to:** databases, Kafka-like systems, event processing, distributed caches, conflict resolution, event sourcing, replication. **Create visual simulations of events on multiple machines with clocks that disagree.**

*Existing Content:* [`HLD/02-distributed-systems/14-time-clocks-ordering.md`](../HLD/02-distributed-systems/14-time-clocks-ordering.md)

*Revisited In:* Ch 22 (replication — ordering conflicts), Ch 29 (messaging ordering), Ch 30 (stream processing — event-time), Ch 39 (CRDTs)

---

### Part 4 — Consistency Models

#### Chapter 21 — The Consistency Spectrum
*Difficulty: Advanced · Importance: Must Know · Prerequisites: Ch 20 · Effort: 15h*

*Topics:* Strong consistency, eventual consistency, linearizability (definition, cost, implementation), sequential consistency, causal consistency, session consistency, read-your-writes, monotonic reads, monotonic writes, read-after-write consistency, serializability, snapshot isolation. For each: **Definition → Guarantee → Example → Counterexample → Implementation → Cost → Use cases.** Show why distributed systems often trade consistency for latency and availability.

*Existing Content:* [`HLD/02-distributed-systems/12-consistency-and-cap.md`](../HLD/02-distributed-systems/12-consistency-and-cap.md)

*Revisited In:* Ch 26 (distributed transactions), Ch 31 (cache consistency), Ch 33 (data in microservices), Ch 39 (CRDTs), Ch 40 (multi-region consistency)

---

### Part 5 — Replication

#### Chapter 22 — Replication
*Difficulty: Advanced · Importance: Must Know · Prerequisites: Ch 21 · Effort: 15h*

*Topics:* Why replication exists (availability, durability, latency). Primary/replica (leader/follower), multi-leader, leaderless replication. Synchronous vs asynchronous vs semi-synchronous replication. Replication lag and its consequences. Failover (planned vs unplanned, split-brain risk). Read replicas. Quorum reads and writes, majority, read/write consistency. Conflict resolution strategies (last-writer-wins, merge functions, application-level). Anti-entropy, read repair, hinted handoff, Merkle trees. **"What happens when two replicas disagree?"** — then show how real systems resolve it.

*Existing Content:* [`HLD/01-building-blocks/09-replication.md`](../HLD/01-building-blocks/09-replication.md)

*Revisited In:* Ch 25 (consensus — replication vs consensus), Ch 31 (cache replication), Ch 39 (CRDTs), Ch 40 (cross-region replication), Ch 52 (PostgreSQL replication), Ch 53 (Cassandra)

---

### Part 6 — Partitioning & Distributed Storage

#### Chapter 23 — Partitioning & Distributed Storage
*Difficulty: Advanced · Importance: Deep Dive · Prerequisites: Ch 9, Ch 22 · Effort: 15h*

*Topics:* Data partitioning — hash partitioning, range partitioning. Consistent hashing, virtual nodes. Rebalancing strategies. Hot partitions, hot keys (detection and mitigation). Quorum-based storage. Internal architecture of distributed storage: Dynamo-style systems, Cassandra, distributed KV stores, distributed SQL databases.

*Existing Content:* [`HLD/01-building-blocks/10-partitioning-sharding.md`](../HLD/01-building-blocks/10-partitioning-sharding.md), [`HLD/animations/consistent-hashing.html`](../HLD/animations/consistent-hashing.html)

*Revisited In:* Ch 31 (cache partitioning), Ch 34 (scalability — sharding), Ch 48 (search indexing), Ch 50–53 (system internals)

---

#### Chapter 24 — Probabilistic Data Structures
*Difficulty: Advanced · Importance: Should Know · Prerequisites: Ch 23 · Effort: 8h*

*Topics:* Bloom filters (structure, false positive rate, sizing, use cases: Cassandra/LevelDB SSTable lookups, network deduplication), counting Bloom filters. HyperLogLog (cardinality estimation — Redis PFCOUNT, analytics). Count-Min Sketch (frequency estimation — rate limiting, heavy hitters). Skip lists (Redis sorted sets). Cuckoo filters. Trade-offs: space vs accuracy vs false positive rate.

*Existing Content:* [`HLD/animations/bloom-filter.html`](../HLD/animations/bloom-filter.html) (animation only, no chapter)

*Revisited In:* Ch 50 (Inside Redis — HyperLogLog, skip lists), Ch 53 (Inside Cassandra — Bloom filters)

---

### Part 7 — Consensus & Distributed Coordination

#### Chapter 25 — Consensus & Distributed Coordination
*Difficulty: Principal · Importance: Must Know · Prerequisites: Ch 20, Ch 22 · Effort: 20h*

*Topics:* What consensus means, why it is difficult. Leader election, quorum, majority. **Raft** — leader election, log replication, safety, membership changes (step-by-step with animated simulation). **Paxos** — basic Paxos, Multi-Paxos. Byzantine consensus (overview). ZAB (ZooKeeper Atomic Broadcast). Distributed coordination — ZooKeeper-style coordination, etcd. Leases, fencing tokens, distributed locks, split brain. Consensus vs replication, consensus vs leader election. **Animated simulation:** Leader fails → followers detect timeout → election begins → votes exchanged → new leader → log replication resumes. Explain every state transition.

*Existing Content:* [`HLD/02-distributed-systems/13-consensus.md`](../HLD/02-distributed-systems/13-consensus.md), [`HLD/animations/raft.html`](../HLD/animations/raft.html)

*Revisited In:* Ch 36 (failure detection — consensus failure modes), Ch 37 (distributed scheduling — leader-based), Ch 54 (Inside ZooKeeper/etcd)

---

### Part 8 — Distributed Transactions

#### Chapter 26 — Distributed Transactions: 2PC, 3PC & XA
*Difficulty: Principal · Importance: Must Know · Prerequisites: Ch 25 · Effort: 12h*

*Topics:* Local transactions recap, ACID in distributed context. Two-phase commit (2PC) — prepare, commit, coordinator failure, participant failure, blocking protocol. Three-phase commit (3PC) — pre-commit phase, why it still doesn't solve all problems. XA transactions — interface, resource managers, limitations. Coordinator failure and the blocking problem. Atomicity vs consistency across services. Isolation across services (or lack thereof). **"What does a transaction mean when there is no single database?"**

*Existing Content:* [`HLD/02-distributed-systems/15-distributed-transactions.md`](../HLD/02-distributed-systems/15-distributed-transactions.md), [`HLD/animations/saga-vs-2pc.html`](../HLD/animations/saga-vs-2pc.html)

*Revisited In:* Ch 27 (Sagas), Ch 28 (Outbox/CDC), Ch 33 (data in microservices)

---

#### Chapter 27 — Saga Patterns & Compensation
*Difficulty: Advanced · Importance: Must Know · Prerequisites: Ch 26 · Effort: 10h*

*Topics:* Saga pattern — choreography (event-based) vs orchestration (central coordinator). Compensation actions — designing reversible steps, what to do when compensation fails. Saga execution coordinator. Isolation challenges in Sagas — semantic locks, commutative updates, pessimistic vs optimistic approaches. When to use Sagas vs 2PC. Failure scenario walkthrough: *Payment succeeds → Order service crashes → Event not processed → What now?* Show multiple solutions and trade-offs.

*Existing Content:* [`HLD/02-distributed-systems/15-distributed-transactions.md`](../HLD/02-distributed-systems/15-distributed-transactions.md) (partial), [`HLD/animations/saga-vs-2pc.html`](../HLD/animations/saga-vs-2pc.html)

*Revisited In:* Ch 28 (outbox ensures reliable saga events), Ch 46 (workflow engines — saga orchestration)

---

#### Chapter 28 — Transactional Outbox, Inbox & CDC
*Difficulty: Advanced · Importance: Must Know · Prerequisites: Ch 27 · Effort: 10h*

*Topics:* The dual-write problem. Transactional outbox pattern — write to outbox table in same DB transaction, separate publisher reads outbox. Inbox pattern — idempotent message consumption. Change Data Capture (CDC) — log-based CDC (Debezium architecture), polling-based CDC. Outbox + CDC pipeline (outbox table → Debezium → Kafka → consumer). Idempotency — idempotency keys, natural vs synthetic, deduplication windows. Exactly-once processing — what it really means, scope and assumptions. Duplicate detection strategies.

*Existing Content:* None — NEW chapter (deepens HLD distributed transactions content)

*Revisited In:* Ch 29 (messaging — delivery guarantees), Ch 33 (data in microservices), Ch 46 (workflow engines)

---

### Part 9 — Messaging & Event-Driven Systems

#### Chapter 29 — Messaging & Event-Driven Systems
*Difficulty: Advanced · Importance: Must Know · Prerequisites: Ch 10 · Effort: 15h*

*Topics:* Message queues vs pub/sub, event-driven architecture. Brokers — Kafka-style (log-based) vs RabbitMQ-style (queue-based), architectural trade-offs. Delivery guarantees — at-most-once, at-least-once, exactly-once (scope and caveats). Ordering — partition ordering, total ordering limitations. Consumer groups, offset management, consumer rebalancing (cooperative vs eager). Backpressure and flow control. Poison messages, dead-letter queues, retry queues, delayed delivery. Event replay, event retention, event versioning, schema evolution (schema registry). Idempotent consumers, duplicate detection. **Explain what actually happens inside a broker.**

*Existing Content:* [`HLD/01-building-blocks/11-messaging-and-streaming.md`](../HLD/01-building-blocks/11-messaging-and-streaming.md), [`kafka/`](../kafka) (complete 10-module deep dive + code examples)

*Revisited In:* Ch 30 (stream processing), Ch 33 (data in microservices — event sourcing), Ch 51 (Inside Kafka)

---

#### Chapter 30 — Stream Processing
*Difficulty: Advanced · Importance: Should Know · Prerequisites: Ch 29 · Effort: 12h*

*Topics:* Stream processing vs batch processing. Stateless vs stateful processing. Windowing — tumbling, hopping, sliding, session windows. Watermarks — tracking event-time progress, handling late-arriving events. Event-time vs processing-time semantics. Exactly-once in stream processing — barriers, idempotent sinks, transactional producers. State management — local state stores, changelog topics, fault tolerance via state snapshots. Stream-table duality. Kafka Streams, Apache Flink architecture overview. Backpressure in streaming systems.

*Existing Content:* None — NEW chapter (extends Kafka and messaging content)

*Revisited In:* Ch 47 (data pipelines), Ch 51 (Inside Kafka — Kafka Streams)

---

### Part 10 — Distributed Caching

#### Chapter 31 — Distributed Caching
*Difficulty: Intermediate · Importance: Must Know · Prerequisites: Ch 22, Ch 23 · Effort: 10h*

*Topics:* Why caching exists, cache-aside (lazy loading), read-through, write-through, write-behind (write-back). TTL, cache invalidation strategies. Cache stampede (thundering herd on cache miss), cache penetration (querying non-existent keys), cache avalanche (mass TTL expiry). Hot keys in caches. Distributed cache architecture — consistent hashing for cache distribution, cache replication. Local cache vs distributed cache vs multi-tier caching. Negative caching. Cache consistency — how stale is acceptable? **"Why is cache invalidation one of the hardest problems in distributed systems?"**

*Existing Content:* [`HLD/01-building-blocks/06-caching.md`](../HLD/01-building-blocks/06-caching.md), [`HLD/animations/cache-stampede.html`](../HLD/animations/cache-stampede.html)

*Revisited In:* Ch 34 (scalability — caching tier), Ch 50 (Inside Redis)

---

### Part 21 — Microservice Reliability

#### Chapter 32 — Microservice Reliability Patterns
*Difficulty: Advanced · Importance: Must Know · Prerequisites: Ch 6, Ch 10, Ch 29 · Effort: 15h*

*Topics:* Timeouts (connect vs read vs write, timeout budgets), retries (retry eligibility, idempotency requirement), exponential backoff with jitter, circuit breakers (closed → open → half-open, implementation), bulkheads (thread pool isolation, connection pool isolation), rate limiting, load shedding, backpressure. Health checks (liveness vs readiness), heartbeats, graceful degradation, failover, cascading failures (amplification effects), retry storms, thundering herd, partial failures, poison messages. For every mechanism: **How it protects the system AND how it makes the system worse when implemented incorrectly.**

*Existing Content:* [`HLD/02-distributed-systems/16-reliability-and-failure.md`](../HLD/02-distributed-systems/16-reliability-and-failure.md)

*Revisited In:* Ch 36 (failure detection), Ch 38 (rate limiting — global), Ch 42 (service mesh — infra-level reliability), Ch 45 (chaos eng)

---

### Part 22 — Data in Microservices

#### Chapter 33 — Data in Microservices
*Difficulty: Advanced · Importance: Must Know · Prerequisites: Ch 11, Ch 22, Ch 23, Ch 27 · Effort: 12h*

*Topics:* Database-per-service (why, implementation, consequences), data ownership principles. SQL vs NoSQL selection in microservices context. Cross-service queries — API composition, CQRS, materialized views. Event sourcing — event store, projections, rebuilding read models, snapshots, upcasting, event versioning. CQRS — command and query separation, eventual consistency between write and read models, when CQRS is overkill. Data mesh principles (domain ownership, data as a product). **Connect all back to distributed-systems theory.**

*Existing Content:* None — NEW chapter (aggregates content from HLD and LLD)

*Revisited In:* Ch 46 (workflow engines — saga data), Ch 49 (patterns — event sourcing/CQRS depth), Ch 56 (case studies)

---

### Part 23 — Scalability

#### Chapter 34 — Scalability Patterns
*Difficulty: Advanced · Importance: Must Know · Prerequisites: Ch 22, Ch 23, Ch 31 · Effort: 12h*

*Topics:* Vertical scaling (limits), horizontal scaling, stateless scaling, stateful scaling challenges. Load balancing strategies. Consistent hashing for scaling. Partitioning and sharding for scale. Caching tiers. CDN (edge caching, origin shielding). Read/write scaling (read replicas, CQRS). Queue-based scaling (decoupling producers from consumers). Autoscaling (metrics, policies, cooldowns, flapping). Hot partitions and hot keys. Capacity planning. Tail latency at scale. **Use realistic traffic numbers and capacity calculations.**

*Existing Content:* [`HLD/00-foundations/04-capacity-estimation.md`](../HLD/00-foundations/04-capacity-estimation.md)

*Revisited In:* Ch 35 (queueing theory), Ch 40 (multi-region scaling), Ch 56 (case studies — scaling from 1K to 10M+ RPS)

---

### Part 14 — Performance & Queueing Theory

#### Chapter 35 — Performance & Queueing Theory
*Difficulty: Advanced · Importance: Should Know · Prerequisites: Ch 34 · Effort: 12h*

*Topics:* Latency, throughput, concurrency, utilization, saturation. Queueing — Little's Law (L = λW), basic queueing theory (M/M/1, M/M/c), queueing delay under load. Latency decomposition (where does the time go?). Tail latency — p50, p95, p99, p999 — why p99 matters more than average. Coordinated omission (Gil Tene). Capacity planning with queueing models. Load testing, stress testing, soak testing, benchmarking. Profiling — CPU bottlenecks, memory bottlenecks, network bottlenecks, disk I/O. GC pauses as latency spikes. Connection pools, thread pools, event loops — sizing and saturation. **Numerical examples:** *"If a service receives 10,000 req/sec and average latency is 50ms, how much concurrency is required?"* (Answer: L = 10000 × 0.05 = 500 concurrent requests by Little's Law.)

*Existing Content:* None — NEW chapter

*Revisited In:* Ch 56 (case studies — capacity calculations), Ch 58 (cost engineering — cost per request)

---

> ### 🏁 MILESTONE 3 — Senior Engineer Complete
>
> **You can now:** Design a distributed system with correct consistency guarantees, handle distributed transactions (2PC/Saga/Outbox), reason about replication trade-offs, calculate capacity using queueing theory, implement reliability patterns, and design data ownership for microservices. Can answer Staff-level system design interviews.
>
> **Total effort so far:** ~470 hours

---

## LEVEL 4 — STAFF ENGINEER

**Goal:** Design systems across teams and organizational boundaries. Master failure detection, multi-region, security, chaos engineering, and advanced patterns.

**Duration:** ~180 hours

---

### Part 11 — Failure Detection & Recovery

#### Chapter 36 — Failure Detection & Recovery
*Difficulty: Advanced · Importance: Must Know · Prerequisites: Ch 6, Ch 25 · Effort: 12h*

*Topics:* Failure detectors — perfect vs imperfect, completeness vs accuracy. Heartbeats, timeouts, suspicion levels. Phi accrual failure detector. Gossip protocols (SWIM, infection-style), membership protocols. Failure domains (rack, zone, region). Node failures, process failures, network failures, disk failures, database failures, dependency failures, partial failures, cascading failures. Failover and failback. Recovery strategies. Disaster recovery principles. **Explain how systems distinguish "the server is dead" from "the server is alive but the network is broken."**

*Existing Content:* [`HLD/02-distributed-systems/16-reliability-and-failure.md`](../HLD/02-distributed-systems/16-reliability-and-failure.md) (partial)

*Revisited In:* Ch 40 (multi-region — regional failure), Ch 45 (chaos engineering)

---

### Part 12 — Distributed Scheduling

#### Chapter 37 — Distributed Scheduling
*Difficulty: Advanced · Importance: Should Know · Prerequisites: Ch 25, Ch 36 · Effort: 10h*

*Topics:* Distributed job scheduling, leader-based scheduling, work stealing, task queues, distributed cron (single-execution guarantees), exactly-once jobs, duplicate execution prevention, job leases, fencing tokens, task retries, dead tasks, scheduling under node failure, distributed locks for scheduling. **Connect to:** Kubernetes scheduling, job queues (Celery, Sidekiq architecture), workflow engines, large-scale schedulers (Borg, Omega, Kubernetes scheduler).

*Existing Content:* None — NEW chapter

*Revisited In:* Ch 46 (workflow engines — scheduled workflows), Ch 55 (Inside Kubernetes — scheduler)

---

### Part 13 — Distributed Rate Limiting & Load Management

#### Chapter 38 — Rate Limiting & Load Management
*Difficulty: Advanced · Importance: Must Know · Prerequisites: Ch 32 · Effort: 10h*

*Topics:* Token bucket, leaky bucket, fixed window, sliding window log, sliding window counter. Distributed counters (Redis-based, approximate). Local vs global rate limiting. Hierarchical rate limiting. Fairness. Admission control. Load shedding (priority-based). Backpressure propagation. Overload protection. Priority queues. Concurrency limits (adaptive — Netflix concurrency-limits). **Explain how overload can cause cascading failure** — and how each mechanism prevents or accidentally amplifies it.

*Existing Content:* [`HLD/animations/token-bucket.html`](../HLD/animations/token-bucket.html) (animation only)

*Revisited In:* Ch 45 (chaos eng — overload injection), Ch 56 (case study — global rate limiter)

---

### CRDTs & Multi-Region (Parts 5 extended + Part 15)

#### Chapter 39 — CRDTs & Conflict-Free Replication
*Difficulty: Principal · Importance: Deep Dive · Prerequisites: Ch 22, Ch 21 · Effort: 12h*

*Topics:* The problem of concurrent writes in multi-leader/leaderless systems. Conflict-free Replicated Data Types (CRDTs) — convergent (CvRDTs/state-based) vs commutative (CmRDTs/operation-based). Specific CRDTs: G-Counter, PN-Counter, G-Set, 2P-Set, OR-Set, LWW-Register, MV-Register, LWW-Element-Set. Merkle-CRDT. Real-world CRDT usage — Riak, Redis CRDB, collaborative editing (Yjs, Automerge). Trade-offs: metadata overhead, garbage collection of tombstones, semantic limitations. When CRDTs are sufficient vs when you need consensus.

*Existing Content:* None — NEW chapter

*Revisited In:* Ch 40 (multi-region active/active), Ch 53 (Inside Cassandra — LWW)

---

#### Chapter 40 — Multi-Region Distributed Systems
*Difficulty: Principal · Importance: Must Know · Prerequisites: Ch 22, Ch 25, Ch 39 · Effort: 15h*

*Topics:* Single region, multi-AZ, multi-region architecture. Active/passive vs active/active. Cross-region replication — synchronous (unacceptable latency) vs asynchronous (consistency trade-off). Cross-region latency (speed of light is the law). Global load balancing (GeoDNS, anycast). DNS failover, regional failover strategies. Data sovereignty and compliance (GDPR, data residency). Cross-region consistency models. Conflict resolution at regional boundaries. RPO (Recovery Point Objective) and RTO (Recovery Time Objective). Disaster recovery — backup/restore, pilot light, warm standby, multi-site active/active. Regional disasters, global outages. **Architecture exercise: "Your primary region completely disappears. Design the recovery strategy."**

*Existing Content:* None — NEW chapter

*Revisited In:* Ch 56 (case study — multi-region SaaS), Ch 61 (master project — multi-region evolution)

---

### Part 16 — Distributed System Security

#### Chapter 41 — Distributed System Security
*Difficulty: Advanced · Importance: Must Know · Prerequisites: Ch 4, Ch 10 · Effort: 12h*

*Topics:* Service identity, authentication, authorization. OAuth 2.0, OIDC, JWT (structure, validation, pitfalls — don't put sensitive data in JWTs). mTLS, certificate authorities, certificate rotation. Key management, secret management (HashiCorp Vault, K8s Secrets limitations). Identity propagation across services, authentication delegation, authorization propagation. Zero trust architecture — never trust, always verify. Replay attacks, request signing, key rotation. Network policies, security boundaries. **Show what happens if one service is compromised** — blast radius, lateral movement, defense in depth.

*Existing Content:* [`HLD/03-architecture-and-apis/20-security.md`](../HLD/03-architecture-and-apis/20-security.md), [`spring-boot/05-production/24-spring-security-internals-the-filter-chain.md`](../spring-boot/05-production/24-spring-security-internals-the-filter-chain.md)

*Revisited In:* Ch 42 (service mesh — mTLS offloading), Ch 56 (case studies — security design)

---

### Part 25 — Service Mesh & Network Infrastructure

#### Chapter 42 — Service Mesh & Network Infrastructure
*Difficulty: Advanced · Importance: Should Know · Prerequisites: Ch 5, Ch 17, Ch 41 · Effort: 10h*

*Topics:* Service mesh — what problem it solves, sidecar proxy architecture. Proxies (Envoy architecture overview). Control plane vs data plane. Traffic management — routing, traffic splitting, canary, mirroring. mTLS offloading. Retry and circuit-breaking at infrastructure level. Observability injection (automatic tracing). Load balancing (client-side, proxy). Service discovery integration. **Trade-off: application-level networking vs infrastructure-level networking** — when a service mesh helps, when it adds unjustified complexity.

*Existing Content:* None — NEW chapter

*Revisited In:* Ch 55 (Inside Kubernetes/LB — mesh integration)

---

### Part 26 — Deployment & Production Engineering

#### Chapter 43 — Deployment & Production Engineering
*Difficulty: Intermediate · Importance: Must Know · Prerequisites: Ch 17, Ch 18 · Effort: 12h*

*Topics:* CI/CD pipelines (build, test, deploy stages). Infrastructure as Code (IaC — Terraform, Pulumi concepts). Deployment strategies — rolling deployment, blue/green deployment, canary deployment (progressive rollout, metric-based promotion). Feature flags (kill switches, gradual rollout, experimentation). Database migrations (backward-compatible, expand/contract pattern). Backward compatibility (API, data, schema). Zero-downtime deployment. Rollbacks — automated vs manual, data rollback challenges. Disaster recovery procedures. Backup strategy. Capacity planning. Incident management (incident response lifecycle). Postmortems (blameless, action items, follow-up).

*Existing Content:* None — NEW chapter

*Revisited In:* Ch 45 (chaos eng — GameDays), Ch 61 (master project — CI/CD)

---

### Testing & Chaos Engineering

#### Chapter 44 — Testing Distributed Systems
*Difficulty: Advanced · Importance: Should Know · Prerequisites: Ch 32, Ch 36 · Effort: 12h*

*Topics:* Why testing distributed systems is fundamentally harder than testing single-node systems. Testing pyramid for microservices (unit → integration → contract → E2E). Contract testing — consumer-driven contracts (Pact), provider verification. Integration testing with Testcontainers. Deterministic simulation testing (FoundationDB approach — simulating network, disk, clock). Property-based testing for distributed invariants. Fault injection in tests (network delays, partitions, process crashes). Testing eventual consistency — verification windows, convergence assertions. Load testing and performance testing (k6, Gatling). Testing idempotency and exactly-once guarantees.

*Existing Content:* None — NEW chapter

*Revisited In:* Ch 45 (chaos engineering — production testing)

---

#### Chapter 45 — Chaos Engineering Methodology
*Difficulty: Advanced · Importance: Should Know · Prerequisites: Ch 36, Ch 44 · Effort: 10h*

*Topics:* Chaos engineering as a discipline (not just "break things"). Steady-state hypothesis. Blast radius control. Experiment design — what to observe, what to inject, expected vs actual behavior. Tools — Chaos Monkey, Litmus, Toxiproxy, tc (traffic control). GameDay planning and execution. **10 structured experiments** (from Master Prompt Part 31): kill a service under traffic, introduce 500ms latency, drop 5% of packets, database unavailability, network partition, kill consensus leader, duplicate messages, out-of-order events, cache stampede, overload a downstream. For each: **Expected → Actual → Why → Detection → Recovery → Architecture improvement.**

*Existing Content:* None — NEW chapter (implements Part 31)

*Revisited In:* Ch 61 (master project — failure injection labs)

---

### Advanced Patterns & Specialized Systems

#### Chapter 46 — Workflow Orchestration Engines
*Difficulty: Advanced · Importance: Should Know · Prerequisites: Ch 27, Ch 29 · Effort: 10h*

*Topics:* Why workflow engines exist — long-running business processes, stateful coordination. Temporal/Cadence architecture — workflow workers, activity workers, task queues, event history. Deterministic replay — what it means, why it matters, forbidden operations in workflow code. Activities vs workflows. Compensation and Saga implementation via workflow engines. Retry policies, timeouts, heartbeats. Durable timers and sleep. Versioning workflows in production. When to use a workflow engine vs Sagas vs event choreography.

*Existing Content:* None — NEW chapter

*Revisited In:* Ch 49 (advanced patterns — orchestration), Ch 56 (case studies — workflow-based designs)

---

#### Chapter 47 — Data Pipelines & Batch Processing
*Difficulty: Advanced · Importance: Should Know · Prerequisites: Ch 29, Ch 30 · Effort: 10h*

*Topics:* Batch processing vs stream processing (Lambda vs Kappa architecture). ETL (Extract, Transform, Load) patterns. Data warehouse vs data lake vs lakehouse. Batch job orchestration (Airflow, DAG-based scheduling). Exactly-once in batch processing — idempotent writes, checkpoint/restart. Data quality — schema validation, data lineage, dead-letter handling. Schema registries (Confluent Schema Registry, Avro/Protobuf evolution). Change Data Capture as a pipeline source. Materialized views as pipeline outputs.

*Existing Content:* None — NEW chapter

*Revisited In:* Ch 56 (case studies — data-intensive systems)

---

#### Chapter 48 — Distributed Search & Indexing
*Difficulty: Advanced · Importance: Deep Dive · Prerequisites: Ch 23, Ch 9 · Effort: 10h*

*Topics:* Full-text search fundamentals — inverted index, tokenization, analyzers. Elasticsearch/OpenSearch architecture — nodes, shards, replicas, segments, segment merging. Near-real-time search — refresh interval, flush, commit. Relevance scoring (BM25, TF-IDF). Distributed query execution — scatter-gather, deep pagination problems. Index lifecycle management. Search scaling — horizontal (more shards) vs vertical. Geo-spatial indexing — R-trees, geohashes. When to use search vs database queries.

*Existing Content:* None — NEW chapter

*Revisited In:* Ch 56 (case study — search system design)

---

### Part 27 — Advanced Architecture Patterns

#### Chapter 49 — Advanced Architecture Patterns
*Difficulty: Principal · Importance: Must Know · Prerequisites: Ch 10, Ch 27, Ch 29, Ch 32 · Effort: 15h*

*Topics:* API Gateway (routing, rate limiting, authentication offloading, request aggregation), Backend-for-Frontend (BFF), service mesh recap. Event-driven architecture (event notification, event-carried state transfer, event sourcing). CQRS (when it helps, when it's overkill). Strangler Fig pattern (incremental migration). Sidecar, Ambassador, Anti-corruption layer. Bulkhead (process-level, thread-level). Circuit breaker (integration with service mesh). Retry with jitter. Transactional messaging. Workflow orchestration. For every pattern: **Problem → Context → Solution → Architecture → Internal Flow → Trade-offs → Failure Modes → When to Use → When NOT to Use.**

*Existing Content:* [`HLD/03-architecture-and-apis/18-architectural-styles.md`](../HLD/03-architecture-and-apis/18-architectural-styles.md), [`LLD/07-architectural-patterns`](../LLD/07-architectural-patterns)

*Revisited In:* Ch 56 (case studies apply patterns), Ch 60 (decision making — pattern selection), Ch 61 (master project)

---

> ### 🏁 MILESTONE 4 — Staff Engineer Complete
>
> **You can now:** Design systems across teams and organizational boundaries. Understand multi-region architecture (active/active with CRDTs), chaos engineering, distributed security (zero trust), service mesh trade-offs, workflow orchestration, and advanced patterns. Can lead architecture reviews and make pattern-selection decisions with clear trade-off reasoning.
>
> **Total effort so far:** ~650 hours

---

## LEVEL 5 — PRINCIPAL ENGINEER

**Goal:** Make architecture decisions that remain correct as the organization, traffic, system complexity, and business requirements evolve.

**Duration:** ~200 hours

---

### Part 28 — Real Distributed System Internals

For each system: **Problem → Architecture → Data Structures → Algorithms → Networking → Storage → Concurrency → Replication → Consistency → Failure Handling → Recovery → Scaling → Trade-offs (what did the designers intentionally sacrifice?).**

#### Chapter 50 — Inside Redis
*Difficulty: Principal · Importance: Deep Dive · Prerequisites: Ch 31, Ch 23 · Effort: 10h*

*Topics:* Single-threaded event loop (why it works), data structures (SDS, ziplist, listpack, skiplist, dict, intset, streams), persistence (RDB snapshots, AOF, hybrid), replication (PSYNC, partial resync, replication backlog), Redis Sentinel (monitoring, failover, split-brain), Redis Cluster (hash slots, resharding, ASK/MOVED redirections, gossip protocol), HyperLogLog and Bloom filter modules, pub/sub internals, Lua scripting atomicity.

*Existing Content:* None — NEW chapter

---

#### Chapter 51 — Inside Kafka
*Difficulty: Principal · Importance: Deep Dive · Prerequisites: Ch 29 · Effort: 10h*

*Topics:* Log-structured storage (segments, indices, mmap), zero-copy (sendfile), producer batching and compression, ISR (in-sync replicas), high watermark, leader epoch, controller (KRaft vs ZooKeeper), consumer group coordinator, rebalance protocol (eager vs cooperative sticky), exactly-once semantics (idempotent producer + transactional API), tiered storage.

*Existing Content:* [`kafka/`](../kafka) (complete deep dive — crash course, visual guide, code examples, config reference)

---

#### Chapter 52 — Inside PostgreSQL Replication
*Difficulty: Principal · Importance: Deep Dive · Prerequisites: Ch 22, Ch 8 · Effort: 10h*

*Topics:* MVCC implementation (tuple versioning, xmin/xmax, visibility map), WAL internals (LSN, WAL segments, full-page writes), streaming replication (walsender/walreceiver, synchronous_commit levels), logical replication (publication/subscription, decoding plugins), connection pooling (PgBouncer transaction vs session mode), VACUUM and bloat, query planner (cost-based optimization, EXPLAIN ANALYZE reading), buffer pool and shared_buffers, checkpoint mechanics.

*Existing Content:* None — NEW chapter

---

#### Chapter 53 — Inside Cassandra & Dynamo-Style Systems
*Difficulty: Principal · Importance: Deep Dive · Prerequisites: Ch 22, Ch 23, Ch 25 · Effort: 12h*

*Topics:* Dynamo design principles (consistent hashing, virtual nodes, quorum, sloppy quorum, hinted handoff, anti-entropy with Merkle trees, read repair). Cassandra architecture — gossip protocol (Phi accrual failure detector), partitioner, SSTable storage (memtable → SSTable → compaction), tombstones and gc_grace_seconds, lightweight transactions (Paxos-based CAS), materialized views, secondary indexes (limitations). Tuning consistency levels. Operational challenges — compaction backlog, large partitions, tombstone storms.

*Existing Content:* None — NEW chapter

---

#### Chapter 54 — Inside ZooKeeper & etcd
*Difficulty: Principal · Importance: Deep Dive · Prerequisites: Ch 25 · Effort: 8h*

*Topics:* ZooKeeper — ZAB protocol, znodes (ephemeral, sequential), watches, sessions, leader election recipe, distributed lock recipe, group membership recipe. Why ZooKeeper is being replaced by etcd/KRaft in modern systems. etcd — Raft implementation, key-value store (boltdb/bbolt), watch mechanism (streaming), lease mechanism, linearizable reads (ReadIndex), compaction and defragmentation. Comparison and migration patterns.

*Existing Content:* Completed — [`level-5-principal-engineer/part-42-inside-zookeeper-and-etcd/ch54-inside-zookeeper-and-etcd.md`](./level-5-principal-engineer/part-42-inside-zookeeper-and-etcd/ch54-inside-zookeeper-and-etcd.md)

---

#### Chapter 55 — Inside Kubernetes & a Load Balancer
*Difficulty: Principal · Importance: Deep Dive · Prerequisites: Ch 17, Ch 5 · Effort: 10h*

*Topics:* **Kubernetes internals:** API server (admission controllers, webhook chain), scheduler (filtering → scoring → binding), controller manager (reconciliation loop, informers, work queues), etcd usage (watch-based convergence), kubelet (pod lifecycle, CRI, CNI, CSI), kube-proxy (iptables vs IPVS mode), CoreDNS, service mesh integration points. **Load balancer internals:** L4 (connection-level — ECMP, DSR, maglev consistent hashing) vs L7 (request-level — host/path routing, header inspection, connection pooling, health checking, circuit breaking). Software LBs (HAProxy, Envoy, Nginx architecture). Cloud LB implementation patterns (NLB, ALB).

*Existing Content:* Completed — [`level-5-principal-engineer/part-43-inside-kubernetes-and-load-balancers/ch55-inside-kubernetes-and-load-balancers.md`](./level-5-principal-engineer/part-43-inside-kubernetes-and-load-balancers/ch55-inside-kubernetes-and-load-balancers.md)

---

### Part 29 — Real-World System Design

#### Chapter 56 — Real-World System Design Case Studies
*Difficulty: Principal · Importance: Must Know · Prerequisites: All prior · Effort: 40h*

For each system: Requirements (functional + non-functional), traffic estimation, storage estimation, service boundaries, API design, data model, communication model, consistency requirements, failure scenarios, scalability, reliability, security, observability, deployment, disaster recovery, cost, trade-offs, evolution over time. **Show how architecture changes at 1K → 10K → 100K → 1M → 10M+ requests/sec.**

**Case studies (16 total):**

1. URL Shortener *(introductory)*
2. Rate Limiting System *(global distributed)*
3. Notification Platform
4. E-commerce Platform
5. Payment System / Banking Ledger *(correctness-critical)*
6. Food Delivery Platform
7. Ride-Sharing Platform
8. Chat/Messaging Platform *(real-time)*
9. Social Media Feed
10. Video Streaming Platform
11. Distributed Job Scheduler
12. Large-Scale Order Processing Platform
13. Distributed File Storage
14. Distributed Workflow Engine
15. Multi-region SaaS Platform
16. Search Engine

*Existing Content:* Completed — [`level-5-principal-engineer/part-44-real-world-system-design-case-studies/ch56-real-world-system-design-case-studies.md`](./level-5-principal-engineer/part-44-real-world-system-design-case-studies/ch56-real-world-system-design-case-studies.md) ([`HLD/04-design-case-studies`](../HLD/04-design-case-studies), [`system-design/SOLUTIONS.md`](../system-design/SOLUTIONS.md))

---

### Organizational & Economic Dimensions

#### Chapter 57 — Organizational Design & Conway's Law
*Difficulty: Principal · Importance: Must Know · Prerequisites: Ch 49 · Effort: 8h*

*Topics:* Conway's Law — "organizations produce designs which mirror their communication structures." Inverse Conway maneuver — structuring teams to get the architecture you want. Team Topologies — stream-aligned teams, enabling teams, complicated subsystem teams, platform teams. Interaction modes — collaboration, X-as-a-Service, facilitating. Team cognitive load and service boundaries. How organizational structure constrains architecture decisions. Conway's Law in microservices — why one team owning multiple services creates a distributed monolith. Amazon's two-pizza teams and API mandate. Platform engineering as an organizational pattern.

*Existing Content:* Completed — [`level-5-principal-engineer/part-45-organizational-and-economic-dimensions/ch57-organizational-design-and-conways-law.md`](./level-5-principal-engineer/part-45-organizational-and-economic-dimensions/ch57-organizational-design-and-conways-law.md)

*Revisited In:* Ch 59 (platform engineering), Ch 60 (decision making — organizational constraints)

---

#### Chapter 58 — Cost Engineering & FinOps
*Difficulty: Principal · Importance: Must Know · Prerequisites: Ch 34, Ch 40 · Effort: 8h*

*Topics:* Cloud cost models — compute (on-demand vs reserved vs spot vs savings plans), storage (tiers, retrieval costs), network (egress, cross-AZ, cross-region), managed services (per-request pricing). Cost per request, cost per user, unit economics. Right-sizing (CPU/memory utilization targets). Cost of multi-region (you're paying for everything twice+). Cost of consistency (consensus = more round trips = more latency = more compute). Spot/preemptible instances for stateless workloads. Cost visibility — tagging, cost allocation, showback/chargeback. Making cost a first-class architecture constraint. Cost vs reliability vs latency trade-off triangle.

*Existing Content:* Completed — [`level-5-principal-engineer/part-45-organizational-and-economic-dimensions/ch58-cost-engineering-and-finops.md`](./level-5-principal-engineer/part-45-organizational-and-economic-dimensions/ch58-cost-engineering-and-finops.md)

*Revisited In:* Ch 60 (decision making — cost analysis), Ch 62 (capstone — cost reasoning)

---

#### Chapter 59 — Platform Engineering & Developer Experience
*Difficulty: Principal · Importance: Should Know · Prerequisites: Ch 43, Ch 57 · Effort: 8h*

*Topics:* Internal developer platforms (IDPs) — what they provide, what they abstract. Golden paths — opinionated defaults that teams can follow. Self-service infrastructure — service provisioning, database provisioning, secrets management, CI/CD pipeline templates. Developer portals (Backstage architecture). Platform as a product — treating internal teams as customers. Standardization vs autonomy trade-off. API standardization, observability standardization, deployment standardization. Build vs buy vs configure. When platform engineering creates value vs when it creates bureaucracy.

*Existing Content:* Completed — [`level-5-principal-engineer/part-45-organizational-and-economic-dimensions/ch59-platform-engineering-and-developer-experience.md`](./level-5-principal-engineer/part-45-organizational-and-economic-dimensions/ch59-platform-engineering-and-developer-experience.md)

*Revisited In:* Ch 60 (decision making — platform strategy)

---

### Part 40 & 41 — Architecture Evolution & Decision Making

#### Chapter 60 — Architecture Decision Making
*Difficulty: Principal · Importance: Must Know · Prerequisites: All prior · Effort: 10h*

*Topics:* Architecture Decision Records (ADRs) — format, when to write, lightweight ADRs. Decision framework: **Problem → Requirements → Constraints → Options → Trade-offs → Decision → Consequences → Monitoring → Revisit Conditions.** Technology evaluation methodology. Real-world architecture evolution — show how systems evolve through stages: Single Server → Monolith → Modular Monolith → Horizontally Scaled → Extracted Services → Microservices → Event-Driven → Multi-Region → Global Platform. At every stage: **Why changed, what problem appeared, what solution introduced, what new problems created, what trade-offs made.** Do not teach architecture patterns as isolated recipes — teach them as **responses to evolving constraints.**

*Existing Content:* Completed — [`level-5-principal-engineer/part-46-architecture-evolution-and-decision-making/ch60-architecture-decision-making.md`](./level-5-principal-engineer/part-46-architecture-evolution-and-decision-making/ch60-architecture-decision-making.md) (Synthesizing and expanding `HLD/05-principal-skills/29-tradeoffs-and-adrs.md` and `HLD/05-principal-skills/30-evolutionary-architecture.md`)

---

### Part 30 & 31 — Hands-On Master Project & Failure Labs

#### Chapter 61 — Hands-On Master Project
*Difficulty: Principal · Importance: Must Know · Prerequisites: All prior · Effort: 40h*

Build one production-style **e-commerce platform** throughout, progressively evolving:

```text
Monolith → Modular Monolith → Service Decomposition → Microservices
→ Database-per-Service → Message Broker → Event-Driven Architecture
→ Distributed Transactions → Production Reliability → Observability
→ Kubernetes → Multi-Region Architecture
```

**Implement:** API gateway, authentication/authorization, REST + gRPC, service discovery, database-per-service, Kafka, Saga, outbox, idempotency, retry, circuit breaker, rate limiting, caching, distributed tracing, metrics, logging, Docker, Kubernetes, CI/CD, disaster recovery.

**Failure injection labs (10 experiments from Part 31):** Kill a service under traffic, introduce 500ms latency, drop 5% of packets, database unavailability, network partition, kill consensus leader, duplicate messages, out-of-order events, cache stampede, overload downstream. For each: **Expected → Actual → Why → Detection → Recovery → Architecture improvement.**

Use production-quality code. Explain every important implementation decision.

*Existing Content:* Completed — [`level-5-principal-engineer/part-47-hands-on-master-project-and-failure-labs/ch61-hands-on-master-project.md`](./level-5-principal-engineer/part-47-hands-on-master-project-and-failure-labs/ch61-hands-on-master-project.md)

---

### Part 42 — Final Capstone

#### Chapter 62 — Final Capstone: Principal Engineer Reference Architecture
*Difficulty: Principal · Importance: Must Know · Prerequisites: All prior · Effort: 20h*

Design a **production-grade distributed platform from scratch**. The capstone must require reasoning about: requirements, scale, service boundaries, APIs, data ownership, storage, consistency, replication, partitioning, messaging, distributed transactions, consensus, reliability, failure handling, security, observability, deployment, Kubernetes, multi-region architecture, disaster recovery, cost, capacity planning, organizational boundaries, long-term evolution.

Provide a **Principal Engineer reference architecture**. For each major decision: **Decision → Alternatives → Trade-offs → Why this choice → Failure modes → Future evolution.**

*Existing Content:* Completed — [`level-5-principal-engineer/part-48-final-capstone/ch62-final-capstone-principal-engineer-reference-architecture.md`](./level-5-principal-engineer/part-48-final-capstone/ch62-final-capstone-principal-engineer-reference-architecture.md)

---

> ### 🏁 MILESTONE 5 — Principal Engineer
>
> **You can now:** Look at any large distributed system and reason across the entire stack — from CPU to architecture strategy. Explain why the system behaves as it does, what happens when components fail, where the bottlenecks are, what guarantees it provides, what trade-offs were made, how to debug it, how to scale it, how to redesign it. Make architecture decisions that remain sound as the system, traffic, team, organization, and business evolve.
>
> **Total effort: ~850 hours**

---

## Concepts Revisited at Increasing Depth

| Concept | First Introduced | Revisited In | Deepened In |
|---------|-----------------|-------------|-------------|
| **Replication** | Ch 22 | Ch 31 (caching), Ch 33 (µsvc data) | Ch 39 (CRDTs), Ch 40 (multi-region), Ch 50–53 (internals) |
| **Consistency** | Ch 21 | Ch 26–27 (transactions), Ch 31 (cache) | Ch 39 (CRDTs), Ch 40 (multi-region), Ch 52 (PostgreSQL MVCC) |
| **Consensus** | Ch 25 | Ch 36 (failure detection), Ch 37 (scheduling) | Ch 54 (ZK/etcd internals), Ch 53 (Cassandra LWT) |
| **Failure Handling** | Ch 6 (intro) | Ch 32 (reliability patterns) | Ch 36 (detection), Ch 40 (multi-region), Ch 45 (chaos eng) |
| **Partitioning** | Ch 23 | Ch 34 (scalability), Ch 38 (rate limiting) | Ch 48 (search), Ch 50–53 (internals) |
| **Ordering & Causality** | Ch 20 | Ch 29 (messaging), Ch 30 (streams) | Ch 39 (CRDTs), Ch 56 (case studies) |
| **Idempotency** | Ch 28 (outbox/CDC) | Ch 29 (messaging), Ch 32 (reliability) | Ch 37 (scheduling), Ch 44 (testing), Ch 61 (project) |
| **Trade-offs** | Every chapter | Ch 49 (patterns), Ch 58 (cost) | Ch 60 (decision making), Ch 62 (capstone) |
| **Conway's Law** | Ch 10 (introduction) | Ch 11 (boundaries), Ch 49 (patterns) | Ch 57 (organizational design), Ch 60 (decisions) |
| **Performance** | Ch 35 (theory) | Ch 34 (scalability) | Ch 56 (case studies — capacity math), Ch 58 (cost/perf) |

---

## Prerequisite Dependency Graph (Simplified)

```text
Ch 1 (Computer Systems)
├─→ Ch 2 (Concurrency)
├─→ Ch 3 (Networking) → Ch 4 (DNS/HTTP/TLS) → Ch 5 (Infra Networking)
├─→ Ch 8 (Database Fundamentals) → Ch 9 (Storage Engines)
└─→ Ch 6 (Distributed Computing) → Ch 7 (Laws & Limits)
        │
        ├─→ Ch 10 (Microservices) → Ch 11 (Service Design) → Ch 12 (API Design)
        │      │                            │                       │
        │      │                            │               ┌───────┴───────┐
        │      │                            │               Ch 13 (REST)   Ch 14 (gRPC)  Ch 15 (Async)
        │      │                            │
        │      ├─→ Ch 16 (Containers) → Ch 17 (Kubernetes)
        │      └─→ Ch 18 (Observability) → Ch 19 (Tracing)
        │
        ├─→ Ch 20 (Time/Clocks) → Ch 21 (Consistency) → Ch 22 (Replication) ──┐
        │                                                      │                │
        │                                          Ch 23 (Partitioning)   Ch 25 (Consensus)
        │                                               │                      │
        │                                          Ch 24 (Probabilistic)  Ch 26 (Distributed Txns)
        │                                                                      │
        │                                                                 Ch 27 (Sagas)
        │                                                                      │
        │                                                                 Ch 28 (Outbox/CDC)
        │
        ├─→ Ch 29 (Messaging) → Ch 30 (Stream Processing)
        ├─→ Ch 31 (Caching)
        ├─→ Ch 32 (Reliability) → Ch 36 (Failure Detection) → Ch 37 (Scheduling)
        │                              │                            │
        │                         Ch 38 (Rate Limiting)        Ch 45 (Chaos Eng)
        │
        ├─→ Ch 33 (Data in µsvc)
        ├─→ Ch 34 (Scalability) → Ch 35 (Queueing Theory)
        ├─→ Ch 39 (CRDTs) → Ch 40 (Multi-Region)
        ├─→ Ch 41 (Security) → Ch 42 (Service Mesh)
        ├─→ Ch 43 (Deployment) → Ch 44 (Testing) → Ch 45 (Chaos Eng)
        ├─→ Ch 46 (Workflow Engines)
        ├─→ Ch 47 (Data Pipelines)
        ├─→ Ch 48 (Search & Indexing)
        └─→ Ch 49 (Advanced Patterns)
                │
                ├─→ Ch 50–55 (Inside X)
                ├─→ Ch 56 (Case Studies)
                ├─→ Ch 57 (Organizational Design) → Ch 59 (Platform Eng)
                ├─→ Ch 58 (Cost Engineering)
                ├─→ Ch 60 (Decision Making)
                ├─→ Ch 61 (Master Project)
                └─→ Ch 62 (Capstone)
```

---

## Master Prompt Part Coverage Map

| Master Prompt Part | Roadmap Chapter(s) | Status |
|---|---|---|
| Part 0 — Engineering Foundations | Ch 1, Ch 2 | ✅ Covered |
| Part 1 — Networking | Ch 3, Ch 4, Ch 5 | ✅ Covered |
| Part 2 — Distributed Systems Fundamentals | Ch 6, Ch 7 | ✅ Covered |
| Part 3 — Time, Clocks, Ordering | Ch 20 | ✅ Covered |
| Part 4 — Consistency Models | Ch 21 | ✅ Covered |
| Part 5 — Replication | Ch 22 | ✅ Covered |
| Part 6 — Partitioning & Storage | Ch 23, Ch 24 | ✅ Covered |
| Part 7 — Consensus | Ch 25 | ✅ Covered |
| Part 8 — Distributed Transactions | Ch 26, Ch 27, Ch 28 | ✅ Covered (expanded) |
| Part 9 — Messaging & Events | Ch 29, Ch 30 | ✅ Covered (expanded) |
| Part 10 — Distributed Caching | Ch 31 | ✅ Covered |
| Part 11 — Failure Detection | Ch 36 | ✅ Covered |
| Part 12 — Distributed Scheduling | Ch 37 | ✅ Covered (was merged) |
| Part 13 — Rate Limiting & Load Mgmt | Ch 38 | ✅ Covered (was merged) |
| Part 14 — Performance & Queueing Theory | Ch 35 | ✅ Covered (was merged) |
| Part 15 — Multi-Region | Ch 40 | ✅ Covered |
| Part 16 — Security | Ch 41 | ✅ Covered |
| Part 17 — Observability | Ch 18, Ch 19 | ✅ Covered (expanded) |
| Part 18 — Microservices Fundamentals | Ch 10 | ✅ Covered |
| Part 19 — Service Design & Domain Modeling | Ch 11 | ✅ Covered |
| Part 20 — Communication | Ch 12, Ch 13, Ch 14, Ch 15 | ✅ Covered (expanded) |
| Part 21 — Microservice Reliability | Ch 32 | ✅ Covered |
| Part 22 — Data in Microservices | Ch 33 | ✅ Covered (was missing) |
| Part 23 — Scalability | Ch 34 | ✅ Covered |
| Part 24 — Containers & Kubernetes | Ch 16, Ch 17 | ✅ Covered (expanded) |
| Part 25 — Service Mesh | Ch 42 | ✅ Covered |
| Part 26 — Deployment & Production Eng | Ch 43 | ✅ Covered |
| Part 27 — Advanced Patterns | Ch 49 | ✅ Covered |
| Part 28 — System Internals | Ch 50, Ch 51, Ch 52, Ch 53, Ch 54, Ch 55 | ✅ Covered (expanded to 6) |
| Part 29 — System Design Case Studies | Ch 56 | ✅ Covered |
| Part 30 — Master Project | Ch 61 | ✅ Covered |
| Part 31 — Failure Injection Labs | Ch 45, Ch 61 | ✅ Covered |
| Part 32–36 — Pedagogy (Visual, Style, etc.) | Applied as chapter-format rules | ✅ Applied |
| Part 37 — Progressive Levels | Level 1–5 structure | ✅ Applied |
| Part 38 — Learning Efficiency | Importance tags, prerequisites | ✅ Applied |
| Part 39 — Cross-Concept Connections | Revisitation table | ✅ Applied |
| Part 40 — Architecture Evolution | Ch 60 | ✅ Covered |
| Part 41 — Decision Making | Ch 60 | ✅ Covered |
| Part 42 — Capstone | Ch 62 | ✅ Covered |

**New topics added beyond Master Prompt:**

| Topic | Chapter | Rationale |
|---|---|---|
| Database Internals | Ch 8, Ch 9 | Can't reason about distributed data without understanding single-node DB |
| gRPC & Protocol Buffers | Ch 14 | Critical communication protocol deserving depth |
| GraphQL, WebSockets, SSE | Ch 15 | Complete communication comparison |
| Distributed Tracing Internals | Ch 19 | Implementation depth beyond concepts |
| Probabilistic Data Structures | Ch 24 | Essential for storage/caching/rate limiting internals |
| CRDTs | Ch 39 | Critical for multi-region active/active |
| Stream Processing | Ch 30 | Windows/watermarks distinct from messaging |
| Workflow Orchestration | Ch 46 | Major pattern deserving standalone treatment |
| Data Pipelines & Batch | Ch 47 | Completes the data processing spectrum |
| Distributed Search | Ch 48 | Critical real-world system type |
| Testing Distributed Systems | Ch 44 | Essential discipline not in Master Prompt |
| Organizational Design | Ch 57 | Conway's Law as architecture constraint |
| Cost Engineering | Ch 58 | Cost as a first-class trade-off |
| Platform Engineering | Ch 59 | Completes the principal perspective |

---

## Summary

| Metric | Previous Roadmap | Refined Roadmap |
|--------|-----------------|-----------------|
| Total chapters | 35 | **62** |
| Estimated total effort | Not specified | **~850 hours** |
| Prerequisite chains | None | **Full DAG** |
| Cross-references to existing content | None | **Every chapter linked** |
| Milestone checkpoints | None | **5 milestones** |
| Revisitation tracking | None | **10 concept threads** |
| "Inside X" deep dives | 1 chapter (11 systems) | **6 dedicated chapters** |
| System design case studies | 1 chapter | **1 chapter (16 case studies) + HLD/system-design refs** |
| New topic areas beyond original | 0 | **14 new areas** |
| Master Prompt Part coverage | ~80% | **100%** |
