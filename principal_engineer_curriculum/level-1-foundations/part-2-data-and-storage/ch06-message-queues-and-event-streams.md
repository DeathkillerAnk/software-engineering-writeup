# Chapter 6 — Message Queues and Event Streams

## Difficulty
Intermediate → Advanced

## Importance
**Must Know** — Message queues and event streams are the second major communication paradigm in distributed systems (the first being synchronous HTTP/RPC). Asynchronous messaging decouples services in *time* — the producer and consumer don't need to be running simultaneously. Every real production system at scale uses at minimum one messaging system. Understanding the mechanics, guarantees, and failure modes of RabbitMQ, SQS, and Kafka is not optional — it is prerequisite to designing anything that claims to handle "millions of events."

## Prerequisites
Chapter 3 — Network Layers, TCP & UDP
Chapter 4 — DNS, HTTP & TLS
Chapter 5 — Infrastructure Networking

## Learning Objectives

By the end of this chapter you will be able to:

1. Explain what a message queue is and why it exists — the specific failures it prevents in synchronous systems.
2. Differentiate between a message queue (point-to-point, destructive read) and an event stream (append-only, replayable, multiple consumers).
3. Describe how RabbitMQ routes messages using Exchanges and Queues (AMQP model).
4. Explain Kafka's storage model: topics, partitions, segments, offsets — and how they enable high throughput.
5. Explain Kafka's consumer group model and how partitions are assigned.
6. Define exactly-once, at-least-once, and at-most-once semantics — and which systems provide which guarantee.
7. Identify the specific failure modes of each system: message loss, poison pills, consumer lag, partition imbalance.
8. Choose between a message queue and an event stream based on workload characteristics.

## Why This Matters

Synchronous HTTP has a fundamental limitation: the caller is blocked until the callee responds. If the callee is slow, the caller slows down. If the callee is down, the caller fails. Under traffic spikes, the callee is overwhelmed.

Message queues and event streams solve this:

- **Decoupling:** Email notifications don't need to slow down checkout. The checkout service publishes an event; the email service consumes it independently.
- **Backpressure:** A queue acts as a buffer. During spikes, messages accumulate in the queue; consumers process at their own pace.
- **Reliability:** Even if the email service is down for 30 minutes, events accumulate in the queue and are processed when it recovers.
- **Fan-out:** Kafka allows a single `order.created` event to simultaneously update inventory, send an email, generate analytics, and trigger fraud checks — without the order service knowing about any of these consumers.

A Principal Engineer who understands messaging can answer:
- Why is our Kafka consumer lagging by 10 million messages? Is it a consumer bug or a partition imbalance?
- Why are we seeing duplicate payments? We have at-least-once delivery but haven't implemented idempotency.
- Should we use Kafka or SQS for this workload? What is the retention requirement?
- How does a rebalance cause a consumer to stop processing for 30 seconds?

---

## Mental Model

> **A message queue is a post office: the sender drops off a letter and leaves. The post office holds it until the recipient picks it up, then it's gone. An event stream is a river: events flow continuously, multiple people can read from the same point, and you can rewind and re-read. A queue solves "process this work once." A stream solves "many consumers, independently, with replay."**

---

## Intuition

Imagine a restaurant kitchen.

**Without messaging (synchronous):** A waiter takes a customer's order and stands at the kitchen counter, waiting until the food is prepared. The kitchen can only serve as many customers as there are waiters. If the kitchen is slow, customers queue at their tables waiting for a free waiter.

**With a message queue (async work queue):** The waiter takes the order, gives it to the kitchen on a ticket stub, and immediately returns to take more orders. The kitchen processes tickets independently. The kitchen has a bounded ticket rail — its natural backpressure mechanism.

**With an event stream (Kafka):** Imagine the kitchen has a camera recording every order. The fry cook, the dessert station, and the billing system each have their own playback screen. They each watch the same recording at their own pace. If the dessert station falls behind, it can catch up — the recording doesn't delete the frames once watched. And if a new metrics display is added, it can replay from the beginning.

---

## Visual Explanation

### Message Queue vs Event Stream

```
MESSAGE QUEUE (RabbitMQ, SQS, ActiveMQ):
                                           ┌───────────────────┐
                                  ┌───────▶│ Consumer Group A  │
  Producer ──▶ [ Queue ] ─────────┤        └───────────────────┘
  (Message sent)  (FIFO buffer)   │  Each message consumed ONCE, then deleted
                                  └───────▶ Consumer Group A picks it up

  Characteristic: Destructive read. Point-to-point.
  Once consumed: message is gone from the queue.


EVENT STREAM (Kafka, Kinesis, Pulsar):
                            Partition 0 [ E0 | E1 | E2 | E3 | E4 ]
  Producer ──▶ [ Topic ] ─ Partition 1 [ E0 | E1 | E2 | E3 | E4 ]
                            Partition 2 [ E0 | E1 | E2 | E3 | E4 ]

  Consumer Group A (Inventory):  reads from offset 4 ──▶  ▲ offset 4
  Consumer Group B (Email):      reads from offset 2 ──▶  ▲ offset 2
  Consumer Group C (Analytics):  reads from offset 0 ──▶  ▲ offset 0

  Characteristic: Non-destructive read. Each consumer group tracks its
  own offset. Events are retained for a configured duration (e.g., 7 days).
  Multiple independent consumer groups read the same data simultaneously.
```

---

## Core Concepts

### 1. Message Queues — The Mechanics

#### The Core Properties

A message queue accepts messages from producers, stores them durably, and delivers them to exactly one consumer. Once a consumer acknowledges a message, it is deleted.

**Key properties:**
- **Delivery:** At least once (message is redelivered on consumer failure before ACK)
- **Ordering:** FIFO within a queue (usually)
- **Consumption:** Point-to-point (one consumer gets each message)
- **Retention:** Until acknowledged and deleted

#### AMQP and RabbitMQ Architecture

RabbitMQ implements AMQP (Advanced Message Queuing Protocol) and introduces a routing layer between producers and queues.

```
Producer
  │
  ▼
Exchange (the router)
  │
  ├──── Binding (routing rules) ────▶ Queue A  ──▶ Consumer Group A
  ├──── Binding ────────────────────▶ Queue B  ──▶ Consumer Group B
  └──── Binding ────────────────────▶ Queue C  ──▶ Consumer Group C
```

**Exchange types:**

| Type | Routing Logic | Use Case |
|------|--------------|----------|
| **Direct** | Routes to queues whose binding key exactly matches the routing key | Specific task routing (e.g., `routing_key="billing"` → billing queue) |
| **Fanout** | Routes to ALL bound queues, ignoring routing key | Broadcast (e.g., send a notification to every service) |
| **Topic** | Routes to queues matching a pattern (`order.*`, `#.error`) | Hierarchical event routing |
| **Headers** | Routes based on message header attributes | Complex filtering without affecting routing key |

**Message lifecycle:**

```
1. Producer sends message to Exchange with routing_key="order.created"
2. Exchange consults bindings: Queue "fulfillment" has binding "order.*"
3. Exchange copies message to matching queues
4. Broker stores message to disk (if persistent) OR keeps in memory (if transient)
5. Consumer fetches message (PUSH: broker pushes to subscribed consumer)
6. Consumer processes message
7. Consumer sends ACK (acknowledgement)
8. Broker deletes message from queue
9. IF consumer dies before ACK: broker requeues the message
   (redelivery → can lead to duplicate processing → need idempotency)
```

**Durability settings:**
- **Exchange durability:** Does the Exchange survive broker restart?
- **Queue durability:** Does the Queue definition survive restart?
- **Message persistence:** Is the message written to disk? (`delivery_mode=2`)

Without message persistence, a broker crash loses all in-memory messages. With persistence, messages survive restarts at the cost of disk I/O latency.

#### Dead Letter Queues (DLQ)

When a message cannot be processed (consumer crashes N times, message TTL expired, queue is full), it is moved to a **Dead Letter Queue**:

```
Queue ──(max retries exceeded)──▶ Dead Letter Exchange ──▶ DLQ
                                                               │
                                                               ▼
                                              Human review / automated alerting
```

DLQs are critical for diagnosing **poison pill messages** — messages that consistently crash consumers. Without a DLQ, a poison pill message would be infinitely requeued, consuming consumer capacity indefinitely and blocking all subsequent messages.

**DLQ monitoring:** Alert on DLQ depth > 0. A DLQ is not supposed to grow during normal operations — every item in it represents a failure that needs investigation.

#### Amazon SQS

SQS (Simple Queue Service) is a managed queue service on AWS. Its key difference from RabbitMQ:

- **Visibility Timeout:** When a consumer reads a message, the message becomes **invisible** (not deleted) for a configurable timeout (default: 30 seconds). If the consumer doesn't delete it within that window, the message reappears and another consumer picks it up.
- **Long Polling:** Instead of polling repeatedly and getting empty responses, consumers can hold a connection open for up to 20 seconds, and the response is only sent when a message is available (saves cost and latency).
- **No ordering guarantee** (standard queue): SQS Standard provides best-effort ordering. For strict FIFO, use SQS FIFO (lower throughput, higher cost).
- **Message deduplication:** SQS FIFO deduplicates messages within a 5-minute window using a deduplication ID.
- **At-Least-Once by design:** If a consumer takes too long and the visibility timeout expires, the message is redelivered. Consumers **must** be idempotent.

---

### 2. Apache Kafka — The Event Stream

Kafka is fundamentally different from a message queue. It is a distributed, persistent, ordered, replayable log.

**Core insight:** Kafka's storage model is a **commit log** — an append-only, immutable sequence of records. This is the same structure used by databases (WAL - Write-Ahead Log), making Kafka essentially a distributed database log.

#### The Storage Model: Topics, Partitions, Segments, Offsets

**Topic:** A logical category of events. An `order.created` topic, a `payment.processed` topic.

**Partition:** A topic is divided into partitions. Each partition is an independent, ordered, immutable log stored as a sequence of files on disk.

```
Topic: "order.created"  (3 partitions, replication factor=3)

Partition 0 (Leader on Broker 1):
  ┌──────────────────────────────────────────────────────────────────┐
  │ Offset: 0    1    2    3    4    5    6    7    8    9    10 ... │
  │ Event:  [E0][E1][E2][E3][E4][E5][E6][E7][E8][E9][E10]...       │
  └──────────────────────────────────────────────────────────────────┘
    Oldest                                                     Newest

Partition 1 (Leader on Broker 2):
  ┌──────────────────────────────────────────────────────────────────┐
  │ Offset: 0    1    2    3    4    5    6    ...                   │
  └──────────────────────────────────────────────────────────────────┘

Partition 2 (Leader on Broker 3):
  ┌──────────────────────────────────────────────────────────────────┐
  │ Offset: 0    1    2    3    4    5    ...                        │
  └──────────────────────────────────────────────────────────────────┘
```

**Offset:** Every event has a monotonically increasing integer offset *within its partition*. Offsets are unique per partition, not globally. Consumer groups track which offset they have consumed up to.

**Segment:** Each partition is physically stored as a series of **segment files** on disk (default: 1 GB per segment). When a segment fills up, a new one is created. Old segments are deleted based on retention policy.

```
Partition 0 on disk:
  /kafka-logs/order.created-0/
    00000000000000000000.log      ← Segment 1: offsets 0-999,999
    00000000000000000000.index    ← Sparse index for fast offset lookup
    00000001000000000000.log      ← Segment 2: offsets 1,000,000-1,999,999
    00000001000000000000.index
    00000002000000000000.log      ← Active segment (being written)
```

**Retention policy:**
- **Time-based:** Keep events for N days (e.g., 7 days). Old segments deleted after retention period.
- **Size-based:** Keep at most N GB per partition. Oldest segments deleted when limit is reached.
- **Log compaction:** For key-value semantics, only the latest value for each key is retained. Old versions of the same key are compacted away. Used for changelogs and CDC (Change Data Capture).

#### Why Kafka is Fast: Sequential I/O + Zero-Copy

**Disk is not slow — random I/O is slow.** Kafka's design exploits sequential disk I/O:

```
Random disk write (HDD):  ~100-150 IOPS → ~6-10 MB/s throughput
Sequential disk write:    ~200-300 MB/s throughput

Network socket read + copy to user space + copy back to kernel = 4 copies
sendfile() (zero-copy):   kernel reads directly from page cache → NIC = 0 copies in user space
```

When a consumer reads from Kafka:
1. OS reads segment file from disk into **page cache** (kernel memory)
2. `sendfile()` syscall sends data from page cache directly to NIC buffer (zero-copy)
3. NIC sends the data to the consumer

Multiple consumers reading the same data benefit from the page cache — the data is read from disk once and served from memory for all subsequent consumers. **This is how Kafka serves millions of events per second to hundreds of consumers on commodity hardware.**

#### Producer: Batching and Compression

Kafka producers don't send each message individually — they batch:

```java
// Producer configuration (Java):
props.put("batch.size", 16384);          // Batch up to 16KB before sending
props.put("linger.ms", 5);               // Wait up to 5ms to fill batch
props.put("compression.type", "lz4");    // Compress batch before sending
props.put("buffer.memory", 33554432);    // 32MB producer buffer
```

**Batching impact:**
- Without batching: 10,000 messages = 10,000 network round trips
- With batching: 10,000 messages = potentially 1 round trip (one large batch)
- With compression: A batch of 1,000 events may compress 5–10× (text-heavy events)

**Producer acknowledgement modes (`acks` setting):**

| acks setting | Durability guarantee | Latency | Risk |
|-------------|---------------------|---------|------|
| `acks=0` | No guarantee. Fire and forget. | Lowest (no wait) | Message loss if broker crashes |
| `acks=1` | Leader wrote to its log | Low | Message loss if leader crashes before replicas acknowledge |
| `acks=all` (or `-1`) | All in-sync replicas acknowledged | Highest | Most durable; latency depends on slowest ISR |

#### Partitioning and Ordering

**Partitioning strategy:**
- If message has a key: `partition = hash(key) % num_partitions`
- If no key: round-robin across partitions

**Why partitioning is critical for ordering:**
- **Ordering is only guaranteed within a partition**, not across partitions.
- If Order events for `customer_id=123` can land in different partitions, a consumer might process `order.cancelled` before `order.created` (from different partitions with different consumer rates).
- **Fix:** Always use a meaningful partition key for events that require ordering (e.g., `customer_id`, `order_id`).

#### Consumer Groups

A **consumer group** is a set of consumer instances that collectively read all partitions of a topic.

```
Topic: "order.created" (6 partitions)
Consumer Group: "inventory-service"

  Consumer 1: reads Partition 0, Partition 1
  Consumer 2: reads Partition 2, Partition 3
  Consumer 3: reads Partition 4, Partition 5

Rules:
  - Each partition is assigned to exactly ONE consumer within a group
  - A consumer can be assigned multiple partitions
  - Max parallelism = number of partitions (extra consumers are idle)
  - If Consumer 2 dies: Kafka rebalances → Consumer 1 gets P2, Consumer 3 gets P3
```

**Consumer scaling limit:** You cannot parallelize consumption beyond the partition count. If you have 6 partitions and 10 consumers, 4 consumers will be idle. To increase parallelism, increase partition count (irreversible, has implications — see below).

#### Offset Management

Every consumer group tracks its position (committed offset) in each partition independently.

```
Consumer Group "inventory-service":
  Partition 0: committed_offset = 1,500   (processed events 0-1499)
  Partition 1: committed_offset = 1,200
  Partition 2: committed_offset = 1,450

Consumer Group "email-service":
  Partition 0: committed_offset = 1,499   (slightly behind)
  Partition 1: committed_offset = 900     (significantly behind — consumer lag!)
```

**Where offsets are stored:**
- Historically: ZooKeeper
- Modern Kafka (0.10+): `__consumer_offsets` internal topic (replication factor=3, heavily compacted)

**Consumer lag:** `consumer_lag = latest_offset - committed_offset`. A lag of 1 million events on a topic producing 10,000 events/second means the consumer is 100 seconds behind.

**Offset commit strategies:**
- **Auto-commit** (`enable.auto.commit=true`): Offsets committed every 5 seconds automatically. Risk: consumer reads events, processes some, crashes before the 5-second auto-commit — those events are re-delivered after restart. **At-least-once delivery.**
- **Manual commit after processing:** Consumer processes event, explicitly calls `commitSync()`. Crash between processing and commit → re-delivery → at-least-once.
- **Manual commit before processing:** Consumer commits offset, then processes. Crash during processing → message lost. **At-most-once delivery** (dangerous — generally avoided).

**Exactly-once semantics in Kafka:**
Achievable since Kafka 0.11 via:
1. **Idempotent Producer:** `enable.idempotence=true`. The broker assigns a Producer ID and deduplicates retries within a session.
2. **Transactional Producer:** `transactional.id=...`. Atomic write across multiple partitions and to the `__consumer_offsets` topic. Either both the output event and the offset commit succeed, or neither does.
3. **Consumer reading in isolation:** Set `isolation.level=read_committed` on the consumer to only read events from committed transactions (ignore partial transactions that later abort).

---

### 3. Delivery Semantics — Precisely Defined

| Semantic | Definition | When message loss/duplicate occurs |
|----------|-----------|-----------------------------------|
| **At-most-once** | Delivered 0 or 1 time. No retry on failure. | Loss: broker crashes after consumer reads but before persistence |
| **At-least-once** | Delivered ≥ 1 time. Retried on failure. | Duplicate: consumer processes but crashes before ACK; message redelivered |
| **Exactly-once** | Delivered and processed precisely once | Requires distributed transaction or idempotent consumers |

**"Exactly-once" is often a lie.** True end-to-end exactly-once processing requires:
- Exactly-once delivery from producer to broker (idempotent producer)
- Exactly-once delivery from broker to consumer (transactional consumer)
- Idempotent processing logic in the consumer (deduplication in the database)

Kafka's transactional API achieves exactly-once *within Kafka* (read-process-write within Kafka). But if the consumer writes to a database and then commits the Kafka offset, there is a window where both can fail. True exactly-once processing requires 2-phase commit with the external system or idempotent writes.

**The practical answer:** At-least-once delivery + idempotent consumers is the correct pattern for 95% of production systems. It's simpler, more performant, and achieves the same result.

---

### 4. Consumer Group Rebalancing

When a consumer joins or leaves a group, Kafka triggers a **rebalance** — reassigning partitions among the remaining consumers.

```
Before rebalance:
  Consumer 1: Partition 0, 1, 2
  Consumer 2: Partition 3, 4, 5

Consumer 2 crashes.

Rebalance triggered:
  All consumers stop processing (STOP THE WORLD)
  Group Coordinator (a Kafka broker) elects a Group Leader
  Group Leader runs the partition assignment algorithm
  New assignment distributed to all consumers
  Consumers resume processing with new assignments

After rebalance:
  Consumer 1: Partition 0, 1, 2, 3, 4, 5

Duration of stop-the-world:
  session.timeout.ms (default 45,000ms = 45 seconds to detect dead consumer)
  + rebalance time (assignment calculation + distribution)
  Total: 30-90 seconds of NO processing during a rebalance!
```

**Rebalance is the primary cause of consumer lag spikes.** After 45 seconds of stopped processing on a high-throughput topic, the consumer group can be millions of events behind.

**Mitigations:**
- **`heartbeat.interval.ms`:** How often the consumer sends a heartbeat (default: 3,000ms). Lower to detect failures faster.
- **`session.timeout.ms`:** How long without heartbeat before consumer declared dead (default: 45,000ms → reduce to 15,000ms in production).
- **`max.poll.interval.ms`:** Maximum time between `poll()` calls before the consumer is considered dead (default: 5 minutes). If processing one batch takes > 5 minutes, the consumer is removed from the group mid-processing.
- **Static group membership (`group.instance.id`):** Consumers with a static ID are given a grace period before rebalance (defined by `session.timeout.ms`). A restart doesn't immediately trigger a rebalance — the returning consumer reclaims its partitions after the session timeout.
- **Cooperative Sticky Rebalancing (default in Kafka 3.x):** Instead of a full stop-the-world, only partitions being reassigned are paused. Other partitions continue processing during the rebalance.

---

### 5. Choosing: Queue vs Stream

| Factor | Message Queue (SQS/RabbitMQ) | Event Stream (Kafka/Kinesis) |
|--------|------------------------------|------------------------------|
| **Consumption model** | Point-to-point (one consumer per message) | Multiple independent consumer groups |
| **Replayability** | No (message deleted after ACK) | Yes (configurable retention, e.g., 7 days) |
| **Ordering** | FIFO within queue | Within partition only |
| **Throughput** | Millions/sec (SQS), ~50k/sec (RabbitMQ) | Millions/sec per partition |
| **Latency** | Milliseconds | 5-15ms typical |
| **Retention** | Until ACK'd | Time/size-based (days to unlimited) |
| **Best for** | Task queues, job distribution | Event sourcing, CDC, analytics, fan-out |
| **Operational complexity** | Low (managed SQS) or Medium (RabbitMQ) | High (Kafka) |

**Use a Message Queue when:**
- You need to distribute work among multiple workers (each item processed once)
- Job/task queues (video encoding, email sending)
- Simple request-response decoupling
- Operational simplicity is a priority

**Use an Event Stream when:**
- Multiple independent systems need to react to the same events
- You need event sourcing or audit logs
- You need to replay events (debugging, feeding a new service)
- Change Data Capture (CDC) from a database
- Real-time analytics (Kafka → Flink/Spark)

---

## Step-by-Step Execution

### Kafka: From Producer to Consumer

```
Step 1: Producer sends message key="customer_123", value={order data}

Step 2: Producer client computes partition:
  partition = murmurhash("customer_123") % 6 = partition 2

Step 3: Producer batches the record with other records for partition 2
  (waits up to linger.ms=5ms or until batch.size=16KB is reached)

Step 4: Producer sends batch via TCP to the Leader Broker for Partition 2 (Broker 2)
  Request: ProduceRequest(topic="orders", partition=2, records=[...])

Step 5: Broker 2 (leader) writes records to the active segment file
  /kafka-logs/orders-2/00001500000000000000.log
  (append-only write → sequential I/O → fast)

Step 6: Broker 2 forwards records to Follower Brokers (Broker 1, Broker 3) for replication

Step 7: Followers acknowledge replication to Leader

Step 8: Leader moves High Watermark (the offset consumers can read up to)
  (If acks=all: waits for all ISR followers to acknowledge before moving HWM)

Step 9: Leader sends ProduceResponse(offset=1,500,000) back to Producer
  Producer records the returned offset for monitoring/debugging

Step 10: Consumer (inventory-service, consumer 1) calls poll()
  Consumer's last committed offset for partition 2: 1,499,995

Step 11: Kafka sends FetchResponse: events from offset 1,499,996 to 1,500,000
  (via sendfile() zero-copy from page cache)

Step 12: Consumer processes events:
  updateInventory(event.orderId, event.items)  ← database call

Step 13: Consumer calls commitSync():
  Sends OffsetCommitRequest to Group Coordinator:
  {partition: 2, committed_offset: 1,500,001}

Step 14: Group Coordinator writes to __consumer_offsets topic
  Confirms commit to consumer

Step 15: On consumer restart, it fetches committed offset 1,500,001 and continues
```

---

## Deep Dive

### Kafka Replication and Leader Election

**Replication Factor:** Each partition has N replicas (e.g., 3). One replica is the leader; the others are followers.

**In-Sync Replicas (ISR):** The set of replicas that are "caught up" with the leader (within `replica.lag.time.max.ms`, default 30 seconds). Only ISR members can become the new leader on failover.

```
Partition 0: Leader = Broker 1, ISR = {Broker 1, Broker 2, Broker 3}

Broker 1 crashes:
  ZooKeeper (or KRaft) detects: Broker 1 offline
  Controller (Broker 2) elects new leader from ISR:
    New leader = Broker 2, ISR = {Broker 2, Broker 3}
  Producers and consumers update their metadata and connect to Broker 2
  Time for failover: typically 30–60 seconds (ZooKeeper) or < 10 seconds (KRaft)
```

**Unclean leader election:** If all ISR members fail and `unclean.leader.election.enable=true`, Kafka can elect an out-of-sync replica as leader. This recovers availability but can cause **data loss** (the new leader hasn't replicated the latest events). Default is `false` — prefer consistency over availability. This is Kafka's CAP trade-off (Chapter 8).

**`min.insync.replicas`:** The minimum number of replicas that must acknowledge a write when `acks=all`. If fewer replicas are in-sync, the produce request fails with `NotEnoughReplicasException`. This prevents data loss: if only 1 replica is in-sync and you write with `acks=all`, that data is at risk as soon as that broker fails.

```
Safe configuration for production:
  replication.factor = 3
  min.insync.replicas = 2
  acks = all

Meaning: A write succeeds only when at least 2 of 3 replicas have written it.
Data survives the loss of 1 broker. If 2 brokers fail simultaneously, producers block.
```

### Kafka Internal Topic: `__consumer_offsets`

This topic stores all consumer group offsets. It has 50 partitions (by default) and replication factor 3. It is heavily log-compacted so only the latest offset for each `(group, topic, partition)` triple is retained.

**The compaction process:**
```
__consumer_offsets key: "inventory-service / order.created / partition_2"
Values over time:
  offset 1000 → offset 1500 → offset 2000 → offset 3000

After compaction:
  Only the latest entry: offset 3000 is retained.
  (All older entries are garbage collected)
```

This is the general Kafka compaction model, applicable to any compacted topic — great for maintaining the latest state of entities (e.g., a user profile topic compacted by user_id).

---

## Real-World Example

### Building an Order Processing Pipeline

An e-commerce platform receives `order.created` events on a Kafka topic with 12 partitions.

**Producers:** 3 instances of `checkout-service`, producing order events.

**Consumer Groups:**
```
Consumer Group: "inventory-service" (12 consumers, one per partition)
  → Updates inventory counts in real-time

Consumer Group: "email-service" (4 consumers)
  → Each consumer handles 3 partitions
  → Sends order confirmation emails

Consumer Group: "analytics-service" (2 consumers)
  → Each consumer handles 6 partitions
  → Writes to a data warehouse (slower, but doesn't block others)

Consumer Group: "fraud-detection" (12 consumers)
  → Checks orders in real-time, publishes to "fraud.alerts" topic
```

All 4 consumer groups read the same events independently. A slowdown in `analytics-service` (which writes to a slow data warehouse) does not impact `email-service` or `inventory-service`. This is the power of independent consumer groups.

**Partition key:** `order_id`. This guarantees all events for a given order (created, updated, cancelled, refunded) land in the same partition, maintaining ordering.

**Retention:** 7 days. New services can be onboarded by replaying from the beginning of the retention window.

---

## Failure Scenarios

### Scenario 1: Poison Pill Message

```
Consumer Group "payment-service" processes payment events.
Event at offset 4,500 contains malformed data: amount=null.

Consumer 1 reads offset 4,500:
  → PaymentService.process(event) throws NullPointerException
  → Consumer does NOT commit offset
  → Consumer restarts

Consumer 1 reads offset 4,500 again:
  → NullPointerException
  → Restart again...

Result: Consumer stuck at offset 4,500. Consumer Lag grows unboundedly.
No subsequent events (4,501, 4,502...) are processed — entire partition is blocked.

Fix:
  1. DLQ Pattern: After N retries (e.g., 3), publish to a "payment.events.dlq" topic
     and commit offset 4,501. Processing continues.
  2. Alert on DLQ depth > 0.
  3. Fix the producer to validate data before publishing.
  4. Make consumers more defensive (log and skip malformed events after N retries).
```

### Scenario 2: Consumer Lag Accumulation

```
System normal:
  order.created: 50,000 events/second
  inventory-service consumer: 52,000 events/second (slight headroom)
  Consumer lag: ~100 events (healthy)

10:00 AM: Downstream database for inventory has a slow query issue
  inventory-service consumer: processes at 10,000 events/second (DB is bottleneck)
  Lag accumulates: 40,000 new events/sec - 10,000 processed/sec = 30,000 lag/sec

10:30 AM: DB issue resolved
  inventory-service processes at 52,000 events/second
  But lag has grown: 30 minutes × 30,000/sec = 54 million events behind
  Time to recover: 54M events / (52K - 50K headroom) = 27,000 seconds ≈ 7.5 hours

The consumer is perpetually 7.5 hours behind, even after the root cause is fixed.
Fix: scale consumer group (add consumers, add partitions) to increase throughput.
Or: set a temporary pause on producers to allow consumers to catch up.
Alert: Consumer lag > N threshold for > T minutes → PagerDuty.
```

### Scenario 3: Hot Partition

```
Partition key: customer_id

Top customer (enterprise client) places 50,000 orders/day.
All 50,000 orders → same partition (hash("enterprise-client-id") % 12 = partition 3)

Partition 3 receives 10× more events than other partitions.
Consumer assigned to partition 3 is overwhelmed.
Consumers assigned to partitions 1, 2, 4-12 are idle (their partitions are slow).

Result: Uneven load. One consumer can't keep up. Rebalancing doesn't help
(partitions can't be split to different consumers within a group).

Fix:
  1. Choose a better partition key that distributes more evenly (e.g., order_id instead of customer_id).
  2. Accept the hot partition and scale the consumer handling it (add more partitions, re-assign).
  3. Use a synthetic key: hash(customer_id + suffix) to spread hot customers across partitions.
```

---

## Performance Considerations

### Kafka Throughput Benchmarks (Commodity Hardware)

```
Setup: 6 brokers, SSDs, 10 Gbps network, replication_factor=3

Producer throughput (acks=all, lz4 compression):
  Single partition:    ~300 MB/s
  6 partitions:        ~1.5 GB/s (scales linearly with partition count)

Consumer throughput (single consumer group):
  Zero-copy sendfile(): ~700 MB/s per broker (limited by network)
  
Sequential disk write speed: ~500 MB/s (SSD sequential)
  → Kafka's write path is I/O bound at ~500 MB/s per broker

Latency (producer to consumer round trip):
  p50: 5ms
  p99: 15ms
  p99.9: 50ms (includes disk flush, replication, consumer poll interval)
```

### Tuning for Throughput vs Latency

```
High Throughput (batch analytics, ETL):
  batch.size = 131072         (128KB batches)
  linger.ms = 50              (wait up to 50ms to fill batch)
  compression.type = lz4      (fast compression, significant size reduction)
  fetch.min.bytes = 65536     (consumer waits for 64KB before returning)

Low Latency (real-time alerting, financial):
  batch.size = 1              (send immediately, no batching)
  linger.ms = 0               (no waiting)
  compression.type = none     (no compression overhead)
  fetch.min.bytes = 1         (return as soon as any data available)
```

---

## Trade-offs

| Decision | Benefit | Cost |
|----------|---------|------|
| More partitions | Higher parallelism, more consumers | More files on disk, slower leader election, metadata overhead |
| Higher replication factor | More durability, fault tolerance | More network I/O, higher producer latency (acks=all) |
| Log compaction | Efficient state storage, smaller logs | CPU/I/O overhead for compaction process, complex tombstone semantics |
| Exactly-once semantics | No duplicates | 30-50% throughput reduction vs at-least-once |
| Short retention (1 day) | Less disk space | New consumers can't replay history |
| Long retention (forever) | Full event history | Massive disk costs |
| Large partition count | High parallelism | Each broker must open file handles for each partition; too many partitions ≈ too many open files |

---

## Alternatives

| Need | Alternative | When to prefer |
|------|-------------|----------------|
| Kafka (complex ops) | AWS Kinesis Data Streams | Managed, auto-scaling, native AWS integration; lower throughput ceiling |
| Kafka (complex ops) | AWS MSK | Fully managed Kafka — same API, AWS-operated |
| Kafka (complex ops) | Confluent Cloud | Fully managed Kafka by Kafka creators |
| RabbitMQ | AWS SQS | Simpler, managed, no ops; sufficient for most task queue use cases |
| Both | Apache Pulsar | Queuing + streaming hybrid; more complex but flexible |
| Both | NATS JetStream | Ultra-low latency, simpler ops; smaller ecosystem |

---

## Production Considerations

1. **Always configure a Dead Letter Queue** for all message queues and Kafka consumer groups. Every failure without a DLQ becomes either an infinite retry loop or silent message loss.
2. **Monitor consumer lag as a primary SLI.** Consumer lag > N events for > T seconds → alert. Consumer lag growing unboundedly → P1 incident.
3. **Choose partition keys carefully — they are permanent.** You cannot change the partition key of existing data. A bad key (e.g., using `timestamp` as key, which gives no locality) or a hot key (enterprise customer) will plague you forever. Model this before creating the topic.
4. **Never increase partition count thoughtlessly.** You cannot decrease partition count. Each new partition redistributes data; consumer groups must rebalance. Plan partition count based on peak expected throughput × 2–3× headroom.
5. **Implement idempotent consumers.** All at-least-once systems will eventually deliver duplicates (network retries, rebalances, broker failovers). Every consumer that writes to a database must handle duplicates gracefully (idempotency key, upsert semantics).
6. **Tune `session.timeout.ms` and `max.poll.interval.ms` carefully.** Too aggressive → false rebalances. Too loose → slow failure detection. Typical production: `session.timeout.ms=15000`, `max.poll.interval.ms=300000` (5 min for long-processing batches).

---

## Common Beginner Mistakes

1. **Using Kafka when SQS is sufficient.** Kafka's operational complexity (ZooKeeper/KRaft, broker management, partition planning, replication) is enormous. If you just need a job queue, SQS handles millions of messages/day with zero ops burden.
2. **Not implementing idempotent consumers.** "We use Kafka with at-least-once, so duplicates shouldn't happen." They will. Network retries, broker failovers, and rebalances all cause redelivery.
3. **Using timestamp as a Kafka partition key.** All events at the same millisecond go to the same partition. You get no distribution benefit and ordering is not guaranteed across partitions anyway.
4. **Setting retention too low.** A 1-hour retention window means you can never replay events for debugging, never onboard a new consumer with historical data, and have zero buffer if consumers fall behind for more than an hour.

---

## Common Senior Engineer Mistakes

1. **Over-partitioning topics.** "More partitions = more parallelism = better." True, but each partition has metadata overhead, file handles, and replication cost. Kafka docs recommend no more than 4,000 partitions per broker and 200,000 total. 10,000 partitions on a 3-broker cluster → Kafka becomes unstable.
2. **Ignoring `max.poll.interval.ms`** for heavy-processing consumers. A consumer batch that takes 6 minutes to process triggers a rebalance (default max.poll.interval.ms = 5 min). The consumer is removed from the group mid-processing, causing a storm of redeliveries and potentially duplicate processing.
3. **Assuming Kafka's exactly-once guarantees extend to external systems.** Kafka's transactional API guarantees exactly-once *within Kafka topics*. Writing to PostgreSQL after a Kafka read, and then committing the Kafka offset, has a failure window. The database write and offset commit are not in the same transaction.
4. **Using Kafka for request-response patterns.** Producing a "request" event to Kafka and waiting for a correlated "response" event is painful: long polling, correlation IDs, timeout management. Use HTTP or gRPC for synchronous request-response.

---

## Architecture Smells

- **Queue depth growing unboundedly** → consumers can't keep up; not enough consumers or a poison pill is blocking
- **No DLQ configured on any queue** → silent message loss or infinite retry loops guaranteed
- **All events in a single topic with one partition** → no parallelism; one slow consumer blocks everything
- **Consumer group with more consumers than partitions** → idle consumers, wasted resources
- **Producer `acks=0`** (fire-and-forget) on a financial or inventory topic → data loss acceptable?
- **Synchronous HTTP call inside a Kafka consumer** → if the HTTP call blocks, `max.poll.interval.ms` will expire, triggering a rebalance

---

## Principal Engineer Perspective

A Principal Engineer thinks about messaging systems in terms of three properties that are in fundamental tension:

1. **Throughput** (events per second)
2. **Durability** (what happens when a broker fails)
3. **Latency** (end-to-end time from producer to consumer)

Every configuration knob in Kafka is a trade-off along these three axes:
- `acks=all` + `min.insync.replicas=2` → maximizes Durability, costs Latency
- `batch.size=1`, `linger.ms=0` → minimizes Latency, costs Throughput
- `compression.type=lz4`, high `batch.size` → maximizes Throughput, slightly costs Latency

**The right architecture question isn't "should we use Kafka?"** It's "what are the delivery guarantees the business requires, what is the acceptable lag, and what is our team's operational capacity?" Kafka is a powerful but operationally demanding system. A team that doesn't have Kafka expertise will spend more time managing the cluster than building features.

**At-least-once + idempotent consumers is the correct pattern for 95% of real production systems.** Exactly-once sounds appealing but adds 30–50% throughput overhead and significant code complexity. Idempotency in the consumer is usually simpler to implement and reason about. The payment industry handles this with idempotency keys (Chapter 28) — not Kafka transactions.

**Consumer lag is the health metric of your async processing pipeline.** It is the equivalent of `p99 latency` for synchronous systems. An alert on consumer lag > N is as important as an alert on HTTP error rate > N%. Both tell you the system is failing to serve its SLA.

---

## Architecture Review Questions

1. For each topic: what is the partition count and how was it determined? Is the partition key well-distributed?
2. What is the consumer lag alert threshold for each consumer group? Who is paged if it exceeds that?
3. Are all consumer groups idempotent? How is idempotency enforced at the processing layer?
4. Is there a DLQ for each queue and each Kafka consumer group (via a retry topic pattern)?
5. What is the configured `session.timeout.ms` and `max.poll.interval.ms`? Are they tuned for the actual processing time of each consumer?
6. What is the message retention period? Is it sufficient for a consumer group recovering from a multi-hour outage?
7. What `acks` setting is used for each producer? Is it appropriate for the data criticality?
8. Are any synchronous blocking calls made inside Kafka consumer `poll()` loops?
9. If Kafka is unavailable for 30 minutes, what happens to the producers? Do they buffer locally or fail fast?
10. Is `unclean.leader.election.enable` set to `false` on all financial or inventory topics?

---

## Visual / Animation Specification

### Animation 1: Message Queue Lifecycle

**Frame 1:** Producer publishes 5 messages to Queue (shown as 5 envelopes entering a mailbox).

**Frame 2:** Consumer A picks up message 1 (envelope leaves mailbox). Status: "Processing."

**Frame 3:** Consumer A crashes mid-processing (red X). Message reappears in queue (envelope reappears in mailbox after visibility timeout).

**Frame 4:** Consumer B picks up the same message. Status: "Processing." Consumer B sends ACK. Message deleted (mailbox empty for that slot).

**Frame 5:** Messages 2–5 distributed among Consumers B and C. Mailbox empties as each is ACK'd.

### Animation 2: Kafka Consumer Group Rebalance

**Frame 1:** 6 partitions (P0–P5), 3 consumers (C1, C2, C3). Animated arrows show: C1→P0,P1 | C2→P2,P3 | C3→P4,P5. Offset counters incrementing rapidly.

**Frame 2:** C2 crashes (red X). All consumer offset counters **FREEZE** (stop-the-world rebalance begins). Timer appears: "Rebalancing... 15s"

**Frame 3:** Timer completes. New assignment: C1→P0,P1,P2,P3 | C3→P4,P5. All offset counters resume incrementing (C1's counters now faster since it's processing 4 partitions).

**Frame 4:** Lag counter shows spike during rebalance period (accumulated lag).

---

## Hands-On Tutorial

### SQS: Send and Receive Messages (AWS CLI)

```bash
# Create a standard SQS queue
aws sqs create-queue \
  --queue-name my-order-queue \
  --attributes VisibilityTimeout=30,MessageRetentionPeriod=86400

# Send a message
aws sqs send-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/123456789/my-order-queue \
  --message-body '{"orderId": "ord_123", "amount": 99.99}' \
  --message-attributes 'eventType={"DataType":"String","StringValue":"order.created"}'

# Receive a message (long polling for up to 20 seconds)
aws sqs receive-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/123456789/my-order-queue \
  --wait-time-seconds 20 \
  --max-number-of-messages 10

# Delete a message after processing (using ReceiptHandle from above response)
aws sqs delete-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/123456789/my-order-queue \
  --receipt-handle "AQEBxJ..."
```

### Kafka: Produce and Consume with kafka-console tools

```bash
# Create a topic (6 partitions, replication factor 3)
kafka-topics.sh --bootstrap-server localhost:9092 \
  --create --topic order.created \
  --partitions 6 --replication-factor 3

# Produce messages with keys (key:value format)
echo "customer_123:{'orderId':'ord_1','amount':50}" | \
  kafka-console-producer.sh --bootstrap-server localhost:9092 \
  --topic order.created \
  --property parse.key=true \
  --property key.separator=:

# Consume from beginning (all partitions)
kafka-console-consumer.sh --bootstrap-server localhost:9092 \
  --topic order.created \
  --from-beginning \
  --group my-test-group \
  --property print.key=true \
  --property print.offset=true

# Check consumer group lag
kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --describe --group inventory-service

# Output shows:
# GROUP        TOPIC         PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG
# inventory    order.created 0          1500000         1501000         1000
# inventory    order.created 1          1499800         1501000         1200
```

---

## Failure Injection Lab

### Lab: Simulating Poison Pill Message Recovery

1. **Setup:** Kafka topic with 1 partition. Consumer that crashes on messages where `amount=null`.
2. **Produce:** 10 valid messages, then 1 poison pill (`amount=null`), then 10 more valid messages.
3. **Observe:** Consumer processes 10 messages, hits poison pill, crashes, restarts, hits it again (infinite loop). The 10 subsequent valid messages are never processed.
4. **Implement DLQ pattern:** After 3 retries, publish the poison pill to `order.created.dlq` and commit the offset.
5. **Verify:** Consumer now processes all 20 valid messages. DLQ topic has exactly 1 message (the poison pill) for human review.
6. **Alert:** Set up a consumer group for `order.created.dlq` that triggers an alert if depth > 0.

---

## Exercises

**Conceptual:**
1. What is the fundamental difference between a message queue and an event stream?
2. Why does at-least-once delivery always require idempotent consumers?
3. A topic has 6 partitions and a consumer group has 10 consumers. How many consumers are idle?
4. Explain why consumer lag can continue growing for hours even after a root cause is resolved.
5. What is a Kafka partition key, and why does choosing it correctly matter?

**Architecture:**
6. You are building an e-commerce checkout system. When an order is placed, you need to: (a) send a confirmation email, (b) update inventory, (c) trigger fraud detection, and (d) write to a data warehouse. How do you architect this with Kafka? How many consumer groups? How many topics?
7. Your payment service processes events from a Kafka topic. The payment processing step calls an external bank API that takes 500ms on average. With `max.poll.interval.ms=5000ms` and a batch size of 100 events, what is the risk? How do you fix it?

**Quantitative:**
8. A Kafka topic has 12 partitions, retaining 7 days of data. Producer throughput is 100MB/sec. Replication factor is 3. Estimate the total disk capacity required across all brokers for this topic.
9. A consumer group processes 10,000 events/sec. A rebalance stops processing for 20 seconds (session.timeout.ms). How much consumer lag accumulates during the rebalance?

---

## Solutions

### Exercise 8
Production rate: 100 MB/s. Per day: 100 MB/s × 86,400 s = 8.64 TB/day. For 7 days: 60.48 TB of raw data. With replication factor 3: 60.48 TB × 3 = **181 TB** total disk required across all brokers. Per broker (assuming 3 brokers, each holding all replicas for 1/3 of partitions): every broker holds all data (as a leader for some partitions and follower for others). Each broker needs ≈ 181 TB / 3 brokers ≈ **60 TB** per broker. This is why Kafka clusters require large, cheap HDDs — SSDs would be cost-prohibitive at this scale.

### Exercise 9
Lag accumulated = processing_rate × rebalance_duration = 10,000 events/sec × 20 seconds = **200,000 events of lag** accumulated during a single rebalance. If the consumer can only process at 11,000 events/sec with 10,000 events/sec incoming (1,000 events/sec headroom), it takes 200,000 / 1,000 = **200 seconds** to recover from the rebalance lag. Frequent rebalances (e.g., every 5 minutes due to rolling deployments) would mean the consumer group never fully catches up.

---

## Interview Questions

### Beginner
- What is the difference between a message queue and a database?
- What happens if a Kafka consumer crashes before committing its offset?
- What is a Dead Letter Queue?

### Senior
- Explain Kafka's partition model. Why is ordering only guaranteed within a partition?
- What is consumer lag and how do you monitor it?
- Compare at-least-once, at-most-once, and exactly-once delivery semantics.
- When would you choose RabbitMQ/SQS over Kafka?

### Staff
- Explain Kafka's ISR (In-Sync Replicas) and how it relates to durability and availability.
- Walk through the sequence of events during a Kafka consumer group rebalance. What is the impact on throughput?
- Design a system to handle a poison pill message in a Kafka consumer without blocking the entire partition.

### Principal
- A financial payments team wants to use Kafka with exactly-once semantics. Walk through the full implementation: idempotent producers, transactional consumers, and the limitations that still require idempotency in the external database write. What would you recommend?
- We have a Kafka topic producing 1 TB/day with a consumer group that is 50 million events behind. The business needs the consumer group to catch up within 4 hours. Walk through your diagnosis and remediation plan.
- Design the messaging architecture for a real-time fraud detection system that must process 500,000 payment events per second with p99 latency of < 100ms end-to-end (producer to fraud decision). What Kafka configuration choices dominate the latency budget?

---

## Summary

Message queues and event streams are the backbone of decoupled, resilient distributed architectures:

- **Message Queues (RabbitMQ, SQS):** Point-to-point, destructive reads, FIFO ordering, task distribution. Work units are processed once. Simple operational model (especially SQS). DLQs handle poison pills. At-least-once delivery requires idempotent consumers.

- **Event Streams (Kafka):** Append-only, replayable logs. Multiple independent consumer groups. Ordering within partition. High throughput via sequential I/O + zero-copy. Replication ensures durability. Consumer lag is the key health metric. Rebalancing is the primary throughput disruption event.

- **Delivery Semantics:** At-most-once (data loss risk), At-least-once (duplicate risk — the correct default for most systems), Exactly-once (performance cost — rarely worth it if consumers can be made idempotent).

- **The Core Design Principle:** Choose your partition key carefully (it's permanent), configure your DLQ (always), implement idempotent consumers (mandatory for at-least-once), and monitor consumer lag (it's your async SLI).

---

## What You Should Now Be Able To Explain

- ✅ Why message queues exist and what synchronous failures they prevent
- ✅ How Kafka's sequential I/O and zero-copy sendfile achieve millions of events/sec on commodity hardware
- ✅ Why ordering is only guaranteed within a Kafka partition and why partition keys matter
- ✅ How consumer groups work, how partitions are assigned, and what happens during a rebalance
- ✅ Why at-least-once + idempotent consumers is the correct pattern for 95% of production systems
- ✅ How to diagnose and remediate consumer lag accumulation

---

## What To Learn Next

**Chapter 7 — Storage Engines and Database Internals.** You now understand asynchronous communication. The next foundational layer is persistence: how data is actually stored and retrieved. The difference between a B-Tree and an LSM-Tree is the difference between the access patterns of PostgreSQL and Cassandra. Understanding storage engine internals is the prerequisite to making informed database selection decisions — the most consequential architectural choice in any distributed system.
