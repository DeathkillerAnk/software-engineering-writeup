# Visual Guide & Interactive Study Plan

## VISUAL ARCHITECTURE DIAGRAMS

### Complete Kafka Ecosystem

```
                        ┌─────────────────────────────────────┐
                        │     PRODUCER APPLICATIONS           │
                        │ (Web, Mobile, Microservices)       │
                        └────────────┬────────────────────────┘
                                     │ send()
                                     ↓
                    ┌────────────────────────────────────┐
                    │   PRODUCER CLIENT LIBRARY          │
                    │ ├─ Batching & Buffering            │
                    │ ├─ Partition Selection             │
                    │ ├─ Compression (Snappy/LZ4)        │
                    │ ├─ Retry Logic                     │
                    │ └─ Exactly-Once (Transactions)     │
                    └────────────────┬───────────────────┘
                                     │
                                     ↓
                    ┌────────────────────────────────────────────────────┐
                    │           KAFKA BROKER CLUSTER                     │
                    │ ┌──────────────────────────────────────────────┐  │
                    │ │  TOPIC: orders (4 partitions)                │  │
                    │ │                                              │  │
                    │ │  ┌─ Partition 0 ─┐  ┌─ Partition 1 ─┐      │  │
                    │ │  │ (Broker 1)     │  │ (Broker 2)     │      │  │
                    │ │  │ Leader         │  │ Follower       │      │  │
                    │ │  │ ISR: [1,2,3]   │  │ ISR: [1,2,3]   │      │  │
                    │ │  │ [msg0..msg1k]  │  │ [msg0..msg1k]  │      │  │
                    │ │  └────────────────┘  └────────────────┘      │  │
                    │ │                                              │  │
                    │ │  ┌─ Partition 2 ─┐  ┌─ Partition 3 ─┐      │  │
                    │ │  │ (Broker 3)     │  │ (Broker 1)     │      │  │
                    │ │  │ Follower       │  │ Leader         │      │  │
                    │ │  │ ISR: [1,3,2]   │  │ ISR: [1,3,2]   │      │  │
                    │ │  │ [msg0..msg1k]  │  │ [msg0..msg1k]  │      │  │
                    │ │  └────────────────┘  └────────────────┘      │  │
                    │ └──────────────────────────────────────────────┘  │
                    │                                                   │
                    │ ┌──────────────────────────────────────────────┐  │
                    │ │  Controller (Broker 1)                       │  │
                    │ │  ├─ Leadership elections                    │  │
                    │ │  ├─ ISR management                          │  │
                    │ │  └─ Metadata updates                        │  │
                    │ └──────────────────────────────────────────────┘  │
                    └────────┬───────────────────────────┬───────────────┘
                             │ fetch()                   │ write replication
                             ↓                           ↓
                    ┌─────────────────────────┐  ┌──────────────────┐
                    │  CONSUMER CLIENTS       │  │  REPLICATION LOG │
                    │ ┌─────────────────────┐ │  │ ┌────────────┐   │
                    │ │ Consumer Group A    │ │  │ │ Follower 2 │   │
                    │ │ ├─ Consumer 1       │ │  │ └────────────┘   │
                    │ │ │ reads P0          │ │  │ ┌────────────┐   │
                    │ │ ├─ Consumer 2       │ │  │ │ Follower 3 │   │
                    │ │ │ reads P1          │ │  │ └────────────┘   │
                    │ │ └─ Offset: 5000     │ │  └──────────────────┘
                    │ └─────────────────────┘ │
                    │                         │
                    │ ┌─────────────────────┐ │
                    │ │ Consumer Group B    │ │
                    │ │ (reads all partitions)
                    │ │ Offset: 4800        │ │
                    │ └─────────────────────┘ │
                    └─────────────────────────┘
                             ↓
                    ┌──────────────────────────┐
                    │ SINK SYSTEMS             │
                    │ ├─ Database              │
                    │ ├─ Data Lake (S3)        │
                    │ ├─ Cache (Redis)         │
                    │ ├─ Search (Elasticsearch)│
                    │ └─ Analytics             │
                    └──────────────────────────┘
```

### Message Flow Timeline

```
t=0ms:  Producer calls send()
        │
        ├─ Serialize value + key
        ├─ Compute partition = hash(key) % 4
        ├─ Add to batch buffer
        │
t=10ms: Batch fills (32KB default)
        │
        ├─ Compress using Snappy
        ├─ Create ProduceRequest
        ├─ Send to Broker 1 (leader of partition)
        │
t=12ms: Broker 1 receives
        │
        ├─ Append to log
        ├─ Update index files
        ├─ Add to page cache
        ├─ Send to replicas (async by default)
        │
t=13ms: Broker returns ack (acks=1)
        │
        ├─ Producer gets success callback
        ├─ Application continues
        │
t=14ms: Broker 2 fetches from leader
        ├─ Appends to its log
        │
t=15ms: Broker 3 fetches from leader
        └─ Appends to its log

If acks=all: Producer waits until t=15ms before returning
If acks=0: Producer continues at t=12ms (fire & forget)
```

### Consumer Offset Management

```
Topic: orders, Partition 0
┌──────────────────────────────────────────────┐
│ Message Log (append-only)                    │
├──────────────────────────────────────────────┤
│ Offset 0: {order_id: 1, amount: $100}        │
│ Offset 1: {order_id: 2, amount: $200}        │
│ Offset 2: {order_id: 3, amount: $150}        │ ◄── Latest offset
│ Offset 3: {order_id: 4, amount: $300}        │     (not yet written)
│ Offset 4: (empty)                            │
│ ...                                          │
└──────────────────────────────────────────────┘

Consumer Group: billing_service
Current State:
┌────────────────────────────────────────────┐
│ Partition → Offset Mapping                 │
├────────────────────────────────────────────┤
│ Partition 0: Last committed = 1             │
│ Partition 1: Last committed = 500           │
│ Partition 2: Last committed = 350           │
│ Partition 3: Last committed = 899           │
└────────────────────────────────────────────┘
     ▲
     │
     └─ Stored in __consumer_offsets topic


WHEN CONSUMER RESTARTS:
  1. Joins group
  2. Rebalancing: assigns partitions
  3. Seeks to committed offset
  4. Starts polling from offset 2 (not from offset 0)
  5. Processes messages 2, 3, 4, ...
  
  ✅ Messages 0-1 NOT reprocessed
  ✅ But if processing crashes before offset 2 is committed,
     message 2 will be reprocessed on restart
```

### Rebalancing Sequence

```
NORMAL STATE (3 consumers, 6 partitions):
  Consumer A: [P0, P1]
  Consumer B: [P2, P3]
  Consumer C: [P4, P5]
  
All consuming happily...

EVENT: Consumer B dies!

t=0s:   Broker detects via heartbeat timeout
        ├─ Removes from group
        └─ Triggers rebalancing
        
t=1-5s: REBALANCING (stop the world)
        │
        ├─ All consumers pause
        ├─ Run assignment strategy
        │   (Round-robin, Range, Sticky)
        │
        └─ NEW STATE:
           Consumer A: [P0, P1, P2]  ◄─ reassigned P2
           Consumer C: [P3, P4, P5]  ◄─ reassigned P3
           
t=5s:   REBALANCING COMPLETE
        ├─ Consumers resume polling
        ├─ Seeks to last committed offset
        └─ Starts consuming again

IMPACT: 5 seconds of no message processing (can be more)
        At 1M msgs/sec = 5M messages backed up!
        
MITIGATION:
  ├─ Increase session.timeout.ms (less sensitive)
  ├─ Use static.membership.id (skip rebalance on graceful restart)
  ├─ Minimize processing time in critical sections
  └─ Monitor rebalance frequency
```

### Failure Scenarios - ISR Dynamics

```
Initial State:
  Partition leader on Broker 1
  Replicas: [B1 (leader), B2, B3]
  ISR: [1, 2, 3]

SCENARIO A: B2 Network Partition (can't reach B1)
Timeline:
  t=0s:   Network breaks
  t=10s:  Broker 2 no heartbeat (replica.lag.time.max.ms = 10s)
  ✅ B1 removes B2 from ISR
  ✅ ISR becomes: [1, 3]
  ⚠️  If min.insync.replicas=2, producer can still write
  ✅ After network recovery, B2 rejoins ISR
  
SCENARIO B: B1 Dies (leader failure)
Timeline:
  t=0s:   B1 hardware failure
  t=1s:   B1 no heartbeat
  t=2-5s: B3 elected as new leader
          (based on Zk quorum or KRaft)
  ✅ B2 and B3 (new leader) form new ISR: [3, 2]
  ❌ B1 had messages [0-100] not yet replicated
  ✅ B2 had messages [0-98] (lagging slightly)
  Result: Messages 99-100 are LOST
  
FIX: Use acks=all + min.insync.replicas=2
     → Ensures at least 2 replicas before ack
     → Messages 99-100 would have been forced to replicas
     → Would not be lost
```

---

## CONFIGURATION QUICK REFERENCE

### Producer Configurations

```
RELIABILITY:
  acks=0              Fire & forget (best throughput, data loss risk)
  acks=1              Leader ack (balanced default)
  acks=all            All ISRs ack (safest, slower)
  
  retries=3           Auto-retry on transient errors
  enable.idempotence=true  Exactly-once at least in broker
  
PERFORMANCE:
  batch.size=16KB     Messages batched before sending
  linger.ms=10        Wait up to 10ms to fill batch
  compression.type=snappy  Reduce payload 50-70%
  
  buffer.memory=64MB   Max bytes before blocking
  
ADVANCED:
  max.in.flight.requests.per.connection=5
                      Concurrent requests
  
  connections.max.idle.ms=540000
                      Reuse connections
```

### Consumer Configurations

```
FETCHING:
  fetch.min.bytes=1KB  Minimum data to fetch
  fetch.max.wait.ms=500ms  Max wait for above
  max.poll.records=500 Records per poll call
  
OFFSETS:
  enable.auto.commit=false  Manual commit (safer)
  auto.commit.interval.ms=5000  If auto-commit
  
REBALANCING:
  session.timeout.ms=30s      Dead consumer timeout
  heartbeat.interval.ms=10s   Heartbeat frequency
  max.poll.interval.ms=5min   Time between polls
  
  partition.assignment.strategy=round-robin
                              How to assign partitions
                              (round-robin, range, sticky, cooperative-sticky)
  
ADVANCED:
  isolation.level=read_committed  Skip uncommitted
```

### Broker Configurations

```
REPLICATION:
  replication.factor=3          Number of replicas
  min.insync.replicas=2         Minimum for acks=all
  unclean.leader.election=false Never pick out-of-sync leader
  
  replica.lag.time.max.ms=10s   Follower timeout
  
RETENTION:
  retention.ms=604800000        7 days default
  retention.bytes=1073741824    1GB default
  log.cleanup.policy=delete     Or "compact" for compaction
  
STORAGE:
  log.segment.bytes=1073741824  1GB per segment
  log.flush.interval.messages=10000  fsync frequency
  
PERFORMANCE:
  num.network.threads=8         Network request threads
  num.io.threads=8              I/O threads
  socket.send.buffer.bytes=102400  64KB
```

---

## STUDY PROGRESSION CHECKLIST

### WEEK 1: FOUNDATIONS

**Day 1: Core Concepts**
- [ ] Understand Kafka vs traditional message queues
- [ ] Draw: Topic → Partitions → Brokers diagram
- [ ] Understand partition key and ordering
- [ ] Explain consumer groups
- [ ] **Quiz:** "If I have 3 consumers and 6 partitions, how many partitions per consumer?"

**Day 2: Producer Deep Dive**
- [ ] Understand batching and compression
- [ ] Know the 3 acks levels (0, 1, all)
- [ ] Explain ISR and min.insync.replicas
- [ ] Write code: Simple producer with error handling
- [ ] **Quiz:** "What happens if acks=1 and leader crashes before replication?"

**Day 3: Consumer Deep Dive**
- [ ] Understand offset commits (auto vs manual)
- [ ] Explain rebalancing
- [ ] Know the rebalancing strategies
- [ ] Write code: Consumer with manual commits
- [ ] **Lab:** Create 2 consumers, watch rebalancing happen

**Day 4: Replication & Durability**
- [ ] Understand ISR and what it means
- [ ] Explain failure scenarios
- [ ] Understand log compaction
- [ ] Draw: Replication timeline with failures
- [ ] **Lab:** Kill a broker, watch recovery

**Day 5: Troubleshooting**
- [ ] Identify consumer lag
- [ ] Debug slow processing
- [ ] Diagnose rebalancing storms
- [ ] **Lab:** Intentionally break a consumer, fix it

### WEEK 2: ADVANCED

**Day 6: Streams & State**
- [ ] Understand KStream, KTable, GlobalKTable
- [ ] Implement stateless transformation (map, filter)
- [ ] Implement stateful aggregation
- [ ] Understand state stores and RocksDB
- [ ] **Lab:** Build word count topology

**Day 7: Joins & Windowing**
- [ ] Implement KStream-KStream join
- [ ] Implement KStream-KTable join
- [ ] Understand window types (Tumbling, Hopping, Session)
- [ ] Understand grace period and late-arriving data
- [ ] **Lab:** Build top-N per minute

**Day 8: Exactly-Once Processing**
- [ ] Understand EOS guarantees in Kafka
- [ ] Implement transactional producer
- [ ] Understand deduplication and idempotency
- [ ] Design exactly-once consumer
- [ ] **Lab:** Build payment processor with EOS

**Day 9: Connect & Schema Evolution**
- [ ] Set up Kafka Connect
- [ ] Understand source vs sink connectors
- [ ] Use Schema Registry with Avro
- [ ] Understand schema compatibility
- [ ] **Lab:** CDC from database to Kafka

**Day 10: Performance Tuning**
- [ ] Load test producer (throughput benchmarks)
- [ ] Load test consumer (find bottleneck)
- [ ] Tune broker configs
- [ ] Monitor with metrics
- [ ] **Lab:** Achieve 100k msgs/sec

### WEEK 3-4: MASTERY

**Week 3:** Internals & Operations
- [ ] Understand log file structure
- [ ] Explain page cache and zero-copy
- [ ] Design multi-datacenter replication
- [ ] Troubleshoot disk I/O issues
- [ ] Operate production cluster (monitoring, scaling)

**Week 4:** System Design
- [ ] Design high-throughput analytics system
- [ ] Design low-latency transaction system
- [ ] Design event sourcing architecture
- [ ] Design exactly-once payment processing
- [ ] Interview prep: System design questions

---

## HANDS-ON LAB EXERCISES

### Lab 1: "Hello Kafka" (Day 1-2)
```bash
# Start Kafka
docker-compose up -d

# Create topic
kafka-topics --create --topic hello --partitions 3 --replication-factor 3

# Produce
echo "message1" | kafka-console-producer --topic hello --broker-list localhost:9092

# Consume
kafka-console-consumer --topic hello --from-beginning --broker-list localhost:9092
```

**What to observe:**
- Message appears in consumer
- Offset increments
- Messages persist even after producer stops
- Consumer can start from `--from-beginning`

### Lab 2: "Partition Assignment" (Day 2-3)
Create 3 consumers in same group, observe:
- Partitions distributed evenly
- Each consumer gets 1 partition (if 3 partitions)
- Add 4th consumer → rebalancing → 3 have 1 partition, 1 has 0
- Kill a consumer → rebalancing → redistribute

### Lab 3: "Rebalancing Storm" (Day 3-4)
- Set `session.timeout.ms = 3000` (too aggressive)
- Produce 1000 messages
- Add consumer while consuming → rebalancing every 5s
- Observe lag spike

### Lab 4: "Failure Recovery" (Day 4)
- 3 brokers, replication-factor=3
- Start consuming with lag tracking
- Kill leader broker
- Observe: Failover happens, lag increases temporarily
- Restart broker → catches up

### Lab 5: "Exactly-Once" (Day 5)
- Implement producer that can fail between send and commit
- Implement consumer with manual commit
- Inject failures → verify no duplicates

### Lab 6: "Stream Aggregation" (Day 6)
- Input: Click events with user_id, timestamp
- Output: Count clicks per user per 1-minute window
- Process 10k events/sec
- Query state store

### Lab 7: "CDC Integration" (Day 8)
- Postgres with Debezium CDC
- Changes automatically flow to Kafka
- Multiple consumers subscribe to changes
- Modify database → see updates in Kafka

---

## MENTAL MODELS TO MASTER

### Model 1: Partition = Ordered Queue

```
Think: Each partition is its own queue with order guaranteed
Use: "If I care about order, put all related messages in same partition via key"
```

### Model 2: Replication = Redundancy

```
Think: Data copied to multiple brokers for safety
Use: "If I need 99.99% uptime, use replication-factor=3"
```

### Model 3: Offset = Position Marker

```
Think: Like a bookmark, tells consumer where it is
Use: "To replay data, seek to earlier offset"
```

### Model 4: Consumer Group = Shared Reading

```
Think: Multiple readers sharing one stream, each progressing independently
Use: "Add consumers to parallelize, remove to deprioritize"
```

### Model 5: Batching + Compression = Free Lunch

```
Think: Group messages, compress, send once
Use: "Always enable compression, tune batch.size for your throughput"
```

---

## INTERVIEW CHEAT SHEET

### Question: "How would you design a system processing 1M events/sec?"

**Answer Structure:**
1. **Estimate partition count:**
   - Producers: ~10
   - Consumers: ~20-50
   - Partitions = max(10, 50) = 50-100
   
2. **Replication strategy:**
   - RF=3 (survive 2 failures)
   - Min ISR=2
   
3. **Producer config:**
   - acks=1 (balance latency/safety)
   - batch.size=32KB
   - compression=snappy
   
4. **Consumer config:**
   - max.poll.records=1000
   - fetch.min.bytes=10KB
   - 20-50 consumer instances (for parallelism)
   
5. **Monitoring:**
   - Track consumer lag
   - Alert if lag > 100k
   - Monitor broker CPU/disk

### Question: "What if you need exactly-once processing?"

**Answer Structure:**
1. Producer: `enable.idempotence=true, acks=all`
2. Consumer: Manual offset commit after successful processing
3. Processing: Idempotent (upsert by ID, not insert)
4. Design: Save result + commit offset in atomic transaction

### Question: "Rebalancing is killing our throughput. Fix it."

**Answer Structure:**
1. Diagnose: How often rebalancing? (monitor logs)
2. If too frequent: Increase `session.timeout.ms`
3. If on startup: Use `static.membership.id`
4. If slow processing: Optimize consumer logic
5. If max.poll.interval exceeded: Increase value or reduce batch size

---

## RESOURCES ORGANIZED BY TOPIC

### Replication & Durability
- **Read:** Kafka docs on "Replication"
- **Watch:** Confluent video "Understanding Replication"
- **Lab:** Kill brokers, observe failover

### Exactly-Once Semantics
- **Read:** "Exactly-Once Delivery and Transactional Messaging" paper
- **Code:** Study KafkaProducer initTransactions() code
- **Lab:** Build payment processor

### Performance Optimization
- **Read:** Confluent blog on performance tuning
- **Benchmark:** Use ApacheJMeter or custom load test
- **Lab:** Achieve 100k+ msgs/sec on laptop

### Monitoring & Operations
- **Setup:** Prometheus + Grafana for Kafka metrics
- **Learn:** Key metrics (lag, throughput, latency)
- **Lab:** Dashboard showing consumer lag trends

---

## SUCCESS INDICATORS

By end of Week 1, you should:
- [ ] Explain partition assignment strategy
- [ ] Design producer error handling
- [ ] Troubleshoot offset commit issues
- [ ] Draw replication flow with failures

By end of Week 2, you should:
- [ ] Build Kafka Streams topology
- [ ] Implement exactly-once consumer
- [ ] Achieve 50k+ msgs/sec in benchmark
- [ ] Set up monitoring

By end of Week 4, you should:
- [ ] Design system for 1M events/sec
- [ ] Operate production cluster
- [ ] Troubleshoot complex issues
- [ ] Mentor junior engineers
- [ ] Pass principal engineer interview

---

**Print this page and check off items as you progress!**
