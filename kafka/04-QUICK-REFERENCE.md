# Kafka Quick Reference Cheat Sheet

**Print this page. Refer to it constantly.**

---

## THE 5 CORE CONCEPTS

### 1️⃣ Partition Key → Determines Partition
```
partition = hash(key) % num_partitions
Same key → SAME partition → ORDER GUARANTEED
Different keys → Different partitions → PARALLELISM
```

### 2️⃣ ISR (In-Sync Replicas) → Safety Level
```
ISR = replicas with latest data
acks=all waits for ISR → No data loss (unless ISR dies too)
min.insync.replicas = minimum ISR size (usually 2)
```

### 3️⃣ Offset → Position in Partition
```
Each message has offset
Consumer tracks last committed offset
Reboot → Resume from last committed offset (no duplicates!)
```

### 4️⃣ Consumer Group → Parallel Processing
```
N consumers + N partitions = each consumer gets 1 partition
N consumers + 1 partition = 1 consumer reads, others idle
Rebalancing = group stops, redistributes, resumes (10-30s pause)
```

### 5️⃣ Retention → Replay Capability
```
Default: 7 days or 1GB (whichever first)
Can seek to earlier offset to replay
Compaction: Keep latest value for each key (infinite retention)
```

---

## PRODUCER TUNING (3 Knobs)

### Reliability (acks)
```
acks=0  → Fire & forget (best throughput, data loss risk)
acks=1  → Leader acks (DEFAULT, balanced)
acks=all → All ISRs ack (safest, slower)
```

### Batching (Throughput)
```
batch.size = 16KB (default, messages batched before send)
linger.ms = 10 (wait 10ms to fill batch)
Larger batch = higher throughput, higher latency
```

### Compression (Network I/O)
```
compression.type = snappy (50-70% reduction, tiny CPU cost)
Almost always enable it
```

---

## CONSUMER TUNING (3 Knobs)

### Offset Management
```
enable.auto.commit = false (SAFER: manual control)
Only commit AFTER successful processing
If crash between process & commit: Message reprocessed (OK)
If crash after commit: Message lost (BAD)
```

### Fetching
```
fetch.min.bytes = 1KB (minimum data before returning)
fetch.max.wait.ms = 500ms (wait up to 500ms)
max.poll.records = 500 (records per poll)
```

### Rebalancing
```
session.timeout.ms = 30s (default, increase if slow processing)
heartbeat.interval.ms = 10s (send heartbeat every 10s)
max.poll.interval.ms = 5min (time between polls)
static.membership.id = "consumer-1" (skip rebalance on restart)
```

---

## REPLICATION SETUP

### Basic (Most Common)
```
replication.factor = 3           # 3 replicas
min.insync.replicas = 2          # Must have 2+ in sync before ack
unclean.leader.election = false  # Never pick out-of-sync leader

Result: Tolerate 1 broker failure, no data loss
```

### High Availability
```
replication.factor = 3           # 3 replicas
min.insync.replicas = 3          # All must be in sync (slower!)
unclean.leader.election = false  # Never pick out-of-sync leader

Result: Tolerate 2 broker failures, ultra-safe
```

### Cost-Optimized
```
replication.factor = 2           # 2 replicas only
min.insync.replicas = 2          # Must have both in sync
unclean.leader.election = false  # Never pick out-of-sync leader

Result: Tolerate 1 failure, lower cost
```

---

## FAILURE SCENARIOS (Mental Model)

### Broker Fails
```
Status: Broker 1 (leader) dies
Time: ~10 seconds for detection
Impact: ISR shrinks: [1,2,3] → [2,3]
        New leader elected from ISR
Result: No data loss (if min.insync.replicas respected)
        Consumers resume after leader elected
```

### Network Partition
```
Status: Broker 2 & 3 isolated from Broker 1
Time: ~10 seconds
ISR: [1,2,3] → [1] (only leader can be in sync)
Impact: If acks=all and min.insync.replicas=2:
        Producer BLOCKS (no commit possible)
        Automatic backpressure!
Result: Prevents data loss, but degrades during partition
```

### Disk Full
```
Status: Broker disk 100%
Impact: Can't write new messages
        Old messages must be deleted (based on retention)
        Or expand disk
Prevention: Monitor disk space, alert at 70% full
```

---

## PERFORMANCE TARGETS

### Producer Throughput
```
1 broker, 1 partition:    50K-100K msgs/sec
1 broker, 3 partitions:   100K-300K msgs/sec (3x parallelism)
3 brokers, 3 partitions:  300K-600K msgs/sec (3 brokers × 3 partitions)

To achieve:
  - Enable compression (snappy)
  - Batch size 32KB+
  - acks=1 (not acks=all)
  - Multiple producer threads
```

### Consumer Throughput
```
Depends on processing time:
  - Fast processing (< 1ms): 100K+ msgs/sec per consumer
  - Medium processing (10ms): 10K msgs/sec per consumer
  - Slow processing (100ms+): 1K msgs/sec per consumer

To scale:
  - Add more consumer instances
  - Each processes different partitions in parallel
```

### Cluster Sizing
```
For 1M events/day (11.5 msgs/sec):
  - 1 small broker is fine
  
For 1M events/sec:
  - 3 brokers (replication), 10-100 partitions
  - Each broker: 8 CPU, 16GB RAM, SSD storage
  - Depends on retention period
  
Rough formula:
  Total storage = (msgs/sec × msg_size × retention_seconds)
  Partitions = max(producers, consumers)
  Brokers >= replication_factor (usually 3)
```

---

## CONSUMER LAG INTERPRETATION

```
lag = end_offset - committed_offset

lag < 1000 msgs:       🟢 GREEN - Consumer keeping up
lag 1000-10000:        🟡 YELLOW - Watch, may fall behind
lag > 10000:           🔴 RED - Consumer falling behind
lag growing > 1k/sec:  🔴 CRITICAL - Add consumers NOW

Diagnosis:
  - Static lag: Processing is slow → optimize or add consumers
  - Growing lag: Producer faster than consumption → add consumers
  - Spiky lag: Rebalancing or GC → tune timeouts/heap
```

---

## COMMON DEBUGGING

### Problem: Consumer Lag Spike
```
Diagnosis:
  1. Check if rebalancing happened (check logs)
  2. Check if processing slow (add timing)
  3. Check if broker issue (CPU/disk/network)
  
Fix:
  - If rebalancing: Increase session.timeout.ms
  - If processing slow: Add consumers or optimize code
  - If broker: Scale resources
```

### Problem: Producer Getting Timeout
```
Diagnosis:
  1. Check broker connectivity (kafka-broker-api-versions)
  2. Check broker disk space
  3. Check acks setting (acks=all is slower)
  4. Check batch settings (too large = slow flush)
  
Fix:
  - Reduce acks to 1
  - Reduce batch size
  - Check broker resource usage
  - Add network connections (num.network.threads)
```

### Problem: No New Messages Appearing
```
Diagnosis:
  1. Is producer running? (check logs)
  2. Is topic correct? (kafka-topics list)
  3. Is partition key assigned? (check partition count)
  4. Is consumer reading from start? (auto.offset.reset)
  
Fix:
  - Verify producer is actually sending
  - Verify correct topic name (case sensitive)
  - Check partition key logic
  - Consumer: auto.offset.reset = earliest
```

### Problem: Rebalancing Every Minute
```
Diagnosis:
  1. Session timeout too low (default 30s might be OK)
  2. Consumer processing too slow (exceeds max.poll.interval.ms)
  3. Network instability
  4. JVM GC pauses > session.timeout.ms
  
Fix:
  1. Increase max.poll.interval.ms (if processing slow)
  2. Increase session.timeout.ms
  3. Tune JVM heap (-Xmx, -Xms equal, G1GC)
  4. Reduce batch size (process faster)
```

---

## EXACTLY-ONCE CHECKLIST

For true exactly-once processing:

### Producer Side
```
✅ enable.idempotence = true
✅ acks = all
✅ retries = Integer.MAX_VALUE
✅ Use transactional.id for recovery
✅ Use producer.beginTransaction() / commitTransaction()
```

### Consumer Side
```
✅ enable.auto.commit = false (manual commit)
✅ isolation.level = read_committed (skip uncommitted)
✅ Commit offset AFTER successful processing
✅ Idempotent processing (upsert, not insert)
```

### End-to-End
```
✅ Idempotent sink (database upsert by ID, not insert)
✅ OR external deduplication window
✅ OR save result + commit offset atomically
```

---

## MONITORING METRICS

### Producer Metrics
```
records-sent-rate          # Messages sent per second
record-send-total          # Total messages sent
record-error-rate          # Errors per second
batch-size-avg             # Average batch size
compression-rate-avg       # Compression ratio
record-queue-time-avg      # Time in queue (latency)
record-latency-avg         # End-to-end latency
```

### Consumer Metrics
```
records-consumed-rate      # Messages consumed per second
records-lag-max             # Max lag across partitions
records-lag-avg            # Avg lag
fetch-latency-avg          # Time to fetch records
commit-latency-avg         # Time to commit offsets
assigned-partitions        # Partitions assigned
```

### Broker Metrics
```
kafka.server:type=BrokerTopicMetrics
  MessagesInPerSec         # Messages in (from producers)
  BytesInPerSec           # Bytes in
  BytesOutPerSec          # Bytes out
  FailedProduceRequestsPerSec
  FailedFetchRequestsPerSec
  
kafka.server:type=ReplicaManager  
  UnderReplicatedPartitions  # Partitions not fully replicated (BAD)
```

---

## CONFIGURATION COOKBOOK

### High Throughput (E-commerce orders)
```
# Producer
acks=1, batch.size=64KB, linger.ms=10, compression=snappy
buffer.memory=128MB

# Consumer  
fetch.min.bytes=10KB, max.poll.records=1000, 
max.poll.interval.ms=5min

# Broker
replication.factor=3, min.insync.replicas=2,
num.network.threads=16, num.io.threads=16
```

### Low Latency (Real-time alerts)
```
# Producer
acks=1, batch.size=4KB, linger.ms=0, compression=none
buffer.memory=32MB

# Consumer
fetch.min.bytes=1KB, fetch.max.wait.ms=100,
max.poll.records=100

# Broker
replication.factor=2, min.insync.replicas=1
```

### Exactly-Once Safety (Payments)
```
# Producer
acks=all, enable.idempotence=true, transactional.id=...,
batch.size=16KB, retries=MAX

# Consumer
enable.auto.commit=false, isolation.level=read_committed,
max.poll.interval.ms=5min

# Broker
replication.factor=3, min.insync.replicas=2,
unclean.leader.election=false
```

---

## ONE-LINER COMMANDS

```bash
# Create topic
kafka-topics.sh --create --topic my-topic --partitions 3 --replication-factor 3

# List topics
kafka-topics.sh --list

# Describe topic
kafka-topics.sh --describe --topic my-topic

# Produce
kafka-console-producer.sh --topic my-topic --broker-list localhost:9092

# Consume from start
kafka-console-consumer.sh --topic my-topic --from-beginning --bootstrap-server localhost:9092

# Consume from end
kafka-console-consumer.sh --topic my-topic --bootstrap-server localhost:9092

# Consumer group status
kafka-consumer-groups.sh --group my-group --describe --bootstrap-server localhost:9092

# Reset offsets to earliest
kafka-consumer-groups.sh --group my-group --reset-offsets --to-earliest --topic my-topic --execute --bootstrap-server localhost:9092

# Check broker config
kafka-configs.sh --describe --entity-type brokers --entity-name 0 --bootstrap-server localhost:9092
```

---

## PRINCIPAL ENGINEER INTERVIEW QUESTION ANSWERS

### Q: "Design a system processing 1M events/sec"
```
Partitions: 50-100 (based on producers/consumers)
Replication: 3 (tolerate 1 failure)
Min ISR: 2 (no data loss)
Producers: acks=1, batch.size=32KB, snappy
Consumers: fetch.min.bytes=10KB, 50-100 instances (1 partition each)
Monitoring: Consumer lag, broker CPU/disk
Scaling: Add consumers if lag grows
```

### Q: "How do you guarantee exactly-once?"
```
Producer: idempotence=true, acks=all, transactions
Consumer: Manual commit after processing
Processing: Idempotent (upsert by ID)
Sink: Atomic save + offset commit (or idempotent sink)
Test: Inject failures, verify no duplicates
```

### Q: "What happens during a broker failure?"
```
Detection: ~10 seconds
ISR: Shrinks (failed broker removed)
Leader: Elected from remaining ISR
Rebalancing: Consumer group rebalances
Recovery: Broker comes back, catches up, rejoins ISR
Data loss: Only if below min.insync.replicas during failure
```

### Q: "Rebalancing is slow. Fix it."
```
1. Diagnosis: Check rebalancing frequency (logs)
2. If frequent: Increase session.timeout.ms
3. If on startup: Use static.membership.id
4. If during running: Optimize processing (don't exceed max.poll.interval.ms)
5. If large group: Increase num.network.threads
```

---

## THE MENTAL MODEL CHEAT SHEET

```
THINK OF KAFKA AS:

        ┌─────────────────────────────────┐
        │ Distributed Append-Only Log     │
        │ (like write-once memory)        │
        └─────────────────────────────────┘

NOT AS:

        ┌─────────────────────────────────┐
        │ Traditional Message Queue       │
        │ (messages deleted after read)   │
        └─────────────────────────────────┘

KEY IMPLICATION:
  - Multiple readers can read independently
  - Readers can replay history
  - Perfect for event sourcing
  - Perfect for multi-consumer scenarios
```

---

**Print this sheet. Pin to desk. Reference constantly.** 📌

