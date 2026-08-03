# Kafka Hands-On Code Examples

**Purpose:** Practical implementations you can run and learn from  
**Language:** Java (applies to Python, Go with minor changes)  
**Time:** 30-60 minutes to run all examples

---

## EXAMPLE 1: Basic Producer (Understanding Async & Callbacks)

```java
import org.apache.kafka.clients.producer.*;
import org.apache.kafka.common.serialization.StringSerializer;
import java.util.Properties;

public class BasicProducer {
    public static void main(String[] args) {
        // Configuration
        Properties props = new Properties();
        props.put("bootstrap.servers", "localhost:9092");
        props.put("key.serializer", StringSerializer.class.getName());
        props.put("value.serializer", StringSerializer.class.getName());
        
        // Key tuning configs
        props.put("acks", "1");                          // Balance latency/safety
        props.put("retries", 3);
        props.put("compression.type", "snappy");         // 50-70% size reduction
        props.put("batch.size", 32768);                  // 32KB batches
        props.put("linger.ms", 10);                      // Wait 10ms to fill batch
        
        KafkaProducer<String, String> producer = new KafkaProducer<>(props);
        
        try {
            for (int i = 0; i < 10; i++) {
                String key = "user-" + (i % 5);                    // 5 users
                String value = "event-" + i + " at " + System.currentTimeMillis();
                
                // Fire-and-forget (don't wait for result)
                // producer.send(new ProducerRecord<>("events", key, value));
                
                // Better: With callback to track success/failure
                ProducerRecord<String, String> record = 
                    new ProducerRecord<>("events", key, value);
                
                producer.send(record, new Callback() {
                    @Override
                    public void onCompletion(RecordMetadata metadata, Exception exception) {
                        if (exception == null) {
                            System.out.println(
                                "✅ Sent: partition=" + metadata.partition() + 
                                ", offset=" + metadata.offset()
                            );
                        } else {
                            System.out.println("❌ Error: " + exception.getMessage());
                            // Implement retry logic here
                        }
                    }
                });
            }
        } finally {
            producer.close();  // Flush pending messages
        }
    }
}

/**
 * KEY LEARNING POINTS:
 * 
 * 1. acks=1: Leader acknowledges (balanced default)
 *    acks=0: Fire & forget (fastest but data loss risk)
 *    acks=all: ISRs acknowledge (safest but slower)
 * 
 * 2. Compression is almost free: 50-70% reduction, tiny CPU cost
 * 
 * 3. Batching: linger.ms + batch.size create batches before sending
 *    Larger batches = better throughput but higher latency
 * 
 * 4. Callbacks: Track which messages succeeded/failed
 *    Implement retry logic for production
 * 
 * 5. Partition Key: "user-X" ensures all user's messages go to same partition
 *    → Ordering guarantee within user
 */
```

---

## EXAMPLE 2: Producer with Exactly-Once & Error Handling

```java
import org.apache.kafka.clients.producer.*;
import org.apache.kafka.common.serialization.StringSerializer;

public class ExactlyOnceProducer {
    public static void main(String[] args) {
        Properties props = new Properties();
        props.put("bootstrap.servers", "localhost:9092");
        props.put("key.serializer", StringSerializer.class.getName());
        props.put("value.serializer", StringSerializer.class.getName());
        
        // Exactly-once configuration
        props.put("acks", "all");                              // Wait for all ISRs
        props.put("retries", Integer.MAX_VALUE);              // Unlimited retries
        props.put("max.in.flight.requests.per.connection", 5); // Allow 5 concurrent
        props.put("enable.idempotence", true);                // Exactly-once producer
        props.put("transactional.id", "payment-producer-1");  // Unique ID for recovery
        
        KafkaProducer<String, String> producer = new KafkaProducer<>(props);
        
        // Initialize transactions (must be called before producing)
        producer.initTransactions();
        
        try {
            producer.beginTransaction();
            
            // All messages in this transaction are atomic
            for (int i = 0; i < 5; i++) {
                ProducerRecord<String, String> record = 
                    new ProducerRecord<>(
                        "payments",
                        "txn-" + i,  // Unique ID for idempotency
                        "amount=100,account=12345"
                    );
                
                try {
                    RecordMetadata metadata = producer.send(record).get();  // Blocking
                    System.out.println("✅ Message " + i + " sent at offset " + 
                        metadata.offset());
                } catch (Exception e) {
                    System.out.println("❌ Retrying message " + i);
                    throw e;  // Trigger abort
                }
            }
            
            // All messages successfully sent - commit transaction
            producer.commitTransaction();
            System.out.println("✅ Transaction committed");
            
        } catch (Exception e) {
            // Something failed - abort entire transaction
            producer.abortTransaction();
            System.out.println("❌ Transaction aborted: " + e.getMessage());
        } finally {
            producer.close();
        }
    }
}

/**
 * KEY LEARNING POINTS:
 * 
 * 1. Idempotent Producer (enable.idempotence=true):
 *    - Producer remembers which messages sent
 *    - Can safely retry without duplicates
 *    - Works within 5 concurrent requests (max.in.flight.requests.per.connection)
 * 
 * 2. Transactional Producer:
 *    - All messages in transaction are atomic
 *    - Either all committed or all aborted
 *    - Consumer sees committed messages only (isolation.level=read_committed)
 * 
 * 3. Retries:
 *    - With idempotence, retries are safe
 *    - Without idempotence, retries can duplicate
 * 
 * 4. Use Case: Financial transactions
 *    - Cannot afford duplicates
 *    - All-or-nothing semantics needed
 * 
 * 5. Latency trade-off:
 *    - acks=all + blocking send() is slower
 *    - But guarantees safety
 *    - Worth it for critical data
 */
```

---

## EXAMPLE 3: Basic Consumer (Understanding Offsets)

```java
import org.apache.kafka.clients.consumer.*;
import org.apache.kafka.common.serialization.StringDeserializer;
import java.util.*;

public class BasicConsumer {
    public static void main(String[] args) {
        Properties props = new Properties();
        props.put("bootstrap.servers", "localhost:9092");
        props.put("group.id", "analytics-group");           // Consumer group
        props.put("key.deserializer", StringDeserializer.class.getName());
        props.put("value.deserializer", StringDeserializer.class.getName());
        
        // Offset management
        props.put("enable.auto.commit", false);             // Manual commits
        props.put("auto.offset.reset", "earliest");         // Start from beginning
        
        // Rebalancing
        props.put("session.timeout.ms", 30000);             // 30 second timeout
        props.put("heartbeat.interval.ms", 10000);          // Heartbeat every 10s
        props.put("max.poll.interval.ms", 300000);          // 5 min between polls
        
        // Fetching
        props.put("fetch.min.bytes", 1024);                 // 1KB minimum
        props.put("fetch.max.wait.ms", 500);                // Wait 500ms
        props.put("max.poll.records", 500);                 // 500 records per poll
        
        KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props);
        consumer.subscribe(Arrays.asList("events"));        // Subscribe to topic
        
        int processedCount = 0;
        
        try {
            while (true) {
                // Poll for records (timeout: 1 second)
                ConsumerRecords<String, String> records = consumer.poll(
                    Duration.ofMillis(1000)
                );
                
                if (records.isEmpty()) {
                    System.out.println("⏳ No records, waiting...");
                    continue;
                }
                
                System.out.println("📨 Received " + records.count() + " records");
                
                for (ConsumerRecord<String, String> record : records) {
                    try {
                        // Process the record
                        System.out.println(
                            String.format(
                                "  📝 Key: %s, Partition: %d, Offset: %d, Value: %s",
                                record.key(),
                                record.partition(),
                                record.offset(),
                                record.value()
                            )
                        );
                        
                        processedCount++;
                        
                        // Simulate processing work
                        Thread.sleep(10);
                        
                        // IMPORTANT: Only commit if processing succeeded
                        // Commit offset for THIS record
                        consumer.commitSync(Collections.singletonMap(
                            record.topicPartition(),
                            new OffsetAndMetadata(record.offset() + 1)
                        ));
                        
                    } catch (Exception e) {
                        System.out.println("❌ Processing failed: " + e.getMessage());
                        // Don't commit - message will be reprocessed
                        break;  // Exit inner loop to rebalance and retry
                    }
                }
            }
            
        } catch (Exception e) {
            System.out.println("Fatal error: " + e.getMessage());
        } finally {
            System.out.println(
                String.format(
                    "✅ Processed %d messages before shutdown",
                    processedCount
                )
            );
            consumer.close();
        }
    }
}

/**
 * KEY LEARNING POINTS:
 * 
 * 1. OFFSET TRACKING (Critical!):
 *    - auto.offset.reset=earliest: Start from beginning if no commit
 *    - Enable.auto.commit=false: Manual control (safer)
 *    - commitSync(): Blocking, ensures persisted before returning
 * 
 * 2. THE OFFSET COMMIT PROBLEM:
 *    Process fails between processing & commit
 *    → Message will be reprocessed (acceptable)
 *    
 *    But if you commit BEFORE processing:
 *    Process fails after commit
 *    → Message is lost forever (BAD!)
 * 
 * 3. REBALANCING CONFIGS:
 *    - session.timeout.ms: How long before consumer marked dead
 *    - heartbeat.interval.ms: How often to heartbeat
 *    - max.poll.interval.ms: How long between polls before rebalancing
 *    
 *    If processing takes > max.poll.interval.ms
 *    → Unnecessary rebalancing!
 *    → Increase if you need long processing time
 * 
 * 4. CONSUMER GROUPS:
 *    - All consumers with same group.id share partitions
 *    - Add consumer → rebalance → distribute work
 *    - Remove consumer → rebalance → redistribute
 * 
 * 5. POLLING:
 *    - poll() returns batch of records
 *    - Process all records
 *    - Then commit
 *    - max.poll.records limits batch size
 */
```

---

## EXAMPLE 4: Consumer with Manual Rebalancing

```java
import org.apache.kafka.clients.consumer.*;
import org.apache.kafka.common.serialization.StringDeserializer;
import java.util.*;

public class RebalancingAwareConsumer {
    public static void main(String[] args) {
        Properties props = new Properties();
        props.put("bootstrap.servers", "localhost:9092");
        props.put("group.id", "orders-group");
        props.put("key.deserializer", StringDeserializer.class.getName());
        props.put("value.deserializer", StringDeserializer.class.getName());
        props.put("enable.auto.commit", false);
        
        KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props);
        
        // Custom rebalance listener
        consumer.subscribe(
            Arrays.asList("orders"),
            new ConsumerRebalanceListener() {
                @Override
                public void onPartitionsRevoked(Collection<TopicPartition> partitions) {
                    // Called BEFORE rebalancing
                    System.out.println("📤 Partitions revoked: " + partitions);
                    
                    // IMPORTANT: Save state before losing partitions
                    // e.g., flush to external store, commit current progress
                    // Don't do long operations here - others are waiting
                }
                
                @Override
                public void onPartitionsAssigned(Collection<TopicPartition> partitions) {
                    // Called AFTER rebalancing
                    System.out.println("📥 Partitions assigned: " + partitions);
                    
                    // Seek to specific offset if needed
                    for (TopicPartition tp : partitions) {
                        System.out.println(
                            "  Partition " + tp.partition() + 
                            " assigned. Position: " + consumer.position(tp)
                        );
                    }
                }
            }
        );
        
        try {
            int rebalanceCount = 0;
            while (true) {
                ConsumerRecords<String, String> records = consumer.poll(
                    Duration.ofMillis(1000)
                );
                
                if (records.isEmpty()) continue;
                
                System.out.println("Processing batch...");
                
                // Group by partition for efficient processing
                for (TopicPartition tp : records.partitions()) {
                    List<ConsumerRecord<String, String>> partitionRecords = 
                        records.records(tp);
                    
                    System.out.println(
                        "  Partition " + tp.partition() + ": " + 
                        partitionRecords.size() + " records"
                    );
                    
                    for (ConsumerRecord<String, String> record : partitionRecords) {
                        System.out.println("    " + record.key() + " => " + 
                            record.value());
                    }
                }
                
                // Commit after processing all partitions
                consumer.commitSync();
            }
            
        } catch (WakeupException e) {
            System.out.println("Consumer waking up for shutdown");
        } finally {
            consumer.commitSync();
            consumer.close();
        }
    }
}

/**
 * KEY LEARNING POINTS:
 * 
 * 1. REBALANCING LISTENER:
 *    - onPartitionsRevoked: Prepare for losing partitions
 *    - onPartitionsAssigned: Prepare for gaining partitions
 * 
 * 2. WHAT TO DO IN CALLBACKS:
 *    - Save state to external store
 *    - Flush pending operations
 *    - Seek to specific offsets if needed
 *    - DON'T do long operations (others are waiting)
 * 
 * 3. REBALANCING IMPACT:
 *    - Entire consumer group stops
 *    - Rebalance happens (10-30 seconds typically)
 *    - Everyone resumes
 *    - At 1M msgs/sec = 10-30M messages backed up
 * 
 * 4. MINIMIZE REBALANCES:
 *    - Use static.membership.id (skip rebalance on restart)
 *    - Increase session.timeout.ms (less sensitive to hiccups)
 *    - Don't add/remove consumers during load
 */
```

---

## EXAMPLE 5: Kafka Streams - Simple Aggregation

```java
import org.apache.kafka.streams.*;
import org.apache.kafka.streams.kstream.*;
import org.apache.kafka.common.serialization.Serdes;
import java.util.Properties;

public class ClickCountTopology {
    public static void main(String[] args) {
        Properties props = new Properties();
        props.put(StreamsConfig.APPLICATION_ID_CONFIG, "click-counter-app");
        props.put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        props.put(StreamsConfig.DEFAULT_KEY_SERDE_CLASS_CONFIG, Serdes.String().getClass());
        props.put(StreamsConfig.DEFAULT_VALUE_SERDE_CLASS_CONFIG, Serdes.String().getClass());
        
        // Build topology
        StreamsBuilder builder = new StreamsBuilder();
        
        // Read from input topic
        KStream<String, String> clicks = builder.stream("clicks");
        
        // Extract user from value (assuming format: "user:123,page:home")
        clicks
            .map((key, value) -> {
                String[] parts = value.split(",");
                String user = parts[0].split(":")[1];
                return new KeyValue<>(user, "1");
            })
            // Repartition by user (ensures all user's events go to same partition)
            .groupByKey()
            // 1-minute tumbling window
            .windowedBy(TimeWindows.of(Duration.ofMinutes(1)))
            // Count clicks per user per window
            .count(Materialized.as("click-counts"))
            // Write to output topic
            .toStream()
            .map((windowedKey, count) -> {
                String user = windowedKey.key();
                long windowStart = windowedKey.window().startTime().toEpochMilli();
                return new KeyValue<>(
                    user,
                    String.format(
                        "user:%s, window:%d, count:%d",
                        user, windowStart, count
                    )
                );
            })
            .to("click-counts-output");
        
        // Query state store interactively
        Topology topology = builder.build();
        KafkaStreams streams = new KafkaStreams(topology, props);
        
        // Graceful shutdown
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("Shutting down streams...");
            streams.close();
        }));
        
        try {
            streams.start();
            System.out.println("Click counter running... (Ctrl-C to stop)");
            
            // Keep running
            Thread.currentThread().join();
        } catch (InterruptedException e) {
            System.exit(0);
        }
    }
}

/**
 * KEY LEARNING POINTS:
 * 
 * 1. TOPOLOGY BUILDING:
 *    - stream(): Read from topic
 *    - map(): Transform messages
 *    - groupByKey(): Repartition by key
 *    - windowedBy(): Create windows
 *    - count(): Aggregate
 *    - to(): Write to output topic
 * 
 * 2. WINDOWS:
 *    - Tumbling: Non-overlapping (1 minute = [0-60), [60-120), etc)
 *    - Hopping: Overlapping (1 minute every 30s = [0-60), [30-90), etc)
 *    - Session: Event-driven (close on gap > threshold)
 * 
 * 3. STATE STORES:
 *    - Materialized.as("name"): Create queryable state store
 *    - Stores aggregation results in RocksDB
 *    - Can query while topology running
 * 
 * 4. PARALLELISM:
 *    - Partition count = parallelism
 *    - 4 partitions = can run 4 parallel topology instances
 *    - Each instance gets 1 partition
 * 
 * 5. EXACTLY-ONCE:
 *    - Set processing.guarantee=exactly_once_v2
 *    - State stores transactional
 *    - Offset commits atomic with state updates
 */
```

---

## EXAMPLE 6: Kafka Streams - KStream-KTable Join

```java
import org.apache.kafka.streams.*;
import org.apache.kafka.streams.kstream.*;
import org.apache.kafka.common.serialization.Serdes;

public class OrderEnrichmentTopology {
    public static void main(String[] args) {
        Properties props = new Properties();
        props.put(StreamsConfig.APPLICATION_ID_CONFIG, "order-enrichment");
        props.put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        
        StreamsBuilder builder = new StreamsBuilder();
        
        // Stream: Order events (one per order)
        KStream<String, String> orders = builder.stream("orders");
        // Format: key=order_id, value="user:123,amount:100"
        
        // Table: User profiles (gets updated)
        KTable<String, String> users = builder.table("users");
        // Format: key=user_id, value="name:John,country:USA"
        
        // Join: For each order, lookup user profile
        orders
            .map((orderId, orderValue) -> {
                String[] parts = orderValue.split(",");
                String userId = parts[0].split(":")[1];
                return new KeyValue<>(userId, orderValue);
            })
            // KStream-KTable join
            .join(
                users,
                (orderValue, userProfile) -> {
                    // Both order and user profile available
                    return String.format(
                        "%s (user=%s)",
                        orderValue,
                        userProfile
                    );
                }
            )
            .to("enriched-orders");
        
        KafkaStreams streams = new KafkaStreams(builder.build(), props);
        streams.start();
    }
}

/**
 * KEY LEARNING POINTS:
 * 
 * 1. KSTREAM vs KTABLE:
 *    - KStream: Individual events (immutable)
 *    - KTable: State/updates (like database table)
 *    - GlobalKTable: Replicate to all instances
 * 
 * 2. JOIN TYPES:
 *    - Inner Join: Both must exist
 *    - Left Join: KStream record + optional KTable
 *    - Outer Join: Both optional
 * 
 * 3. CAVEATS:
 *    - Must join on SAME key
 *    - KTable lookup time-window: grace period
 *    - If user updated after order sent, OLD profile used
 * 
 * 4. USE CASES:
 *    - Enrich events with reference data
 *    - Orders + Products
 *    - Transactions + Accounts
 *    - Clicks + User profiles
 */
```

---

## EXAMPLE 7: Consumer Lag Monitoring

```java
import org.apache.kafka.clients.admin.*;
import org.apache.kafka.clients.consumer.*;
import org.apache.kafka.common.TopicPartition;
import java.util.*;
import java.util.concurrent.ExecutionException;

public class LagMonitor {
    public static void main(String[] args) throws ExecutionException, InterruptedException {
        Properties props = new Properties();
        props.put(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        
        AdminClient admin = AdminClient.create(props);
        
        // Get all topics
        Set<String> topics = admin.listTopics().names().get();
        
        System.out.println("=== CONSUMER LAG REPORT ===\n");
        
        for (String topic : topics) {
            // Get topic info
            Map<String, TopicDescription> descriptions = admin
                .describeTopics(Collections.singleton(topic))
                .allTopicNames()
                .get();
            
            TopicDescription desc = descriptions.get(topic);
            
            for (TopicPartitionInfo partition : desc.partitions()) {
                TopicPartition tp = new TopicPartition(topic, partition.partition());
                
                // Get offset ranges
                try (KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props)) {
                    consumer.assign(Collections.singleton(tp));
                    
                    // End offset (latest)
                    consumer.seekToEnd(Collections.singleton(tp));
                    long endOffset = consumer.position(tp);
                    
                    // Committed offset (last read)
                    OffsetAndMetadata committed = consumer.committed(tp);
                    long committedOffset = (committed == null) ? 0 : committed.offset();
                    
                    // Lag
                    long lag = endOffset - committedOffset;
                    
                    String status = (lag > 10000) ? "🔴 HIGH" : 
                                   (lag > 1000) ? "🟡 MEDIUM" : "🟢 LOW";
                    
                    System.out.println(String.format(
                        "%s [%d] %s - End: %d, Committed: %d, Lag: %d",
                        topic, partition.partition(), status,
                        endOffset, committedOffset, lag
                    ));
                }
            }
        }
        
        admin.close();
    }
}

/**
 * KEY LEARNING POINTS:
 * 
 * 1. CONSUMER LAG:
 *    lag = end_offset - committed_offset
 *    - High lag = consumer falling behind
 *    - Growing lag = producer faster than consumer
 * 
 * 2. DIAGNOSING:
 *    - Lag > partition size = messages lost (reached retention)
 *    - Rapidly growing lag = add consumers
 *    - Steady but high lag = tune fetch settings
 * 
 * 3. MONITORING:
 *    - Track lag trends
 *    - Alert if lag > threshold
 *    - Alert if lag growing rate > 1000/sec
 */
```

---

## RUNNING THESE EXAMPLES

### Setup
```bash
# Start Kafka (Docker)
docker-compose up -d

# Create topics
kafka-topics.sh --create --topic events --partitions 3 --replication-factor 3
kafka-topics.sh --create --topic orders --partitions 3 --replication-factor 3
kafka-topics.sh --create --topic users --partitions 3 --replication-factor 3
```

### Run Examples
```bash
# Terminal 1: Producer
javac BasicProducer.java
java BasicProducer

# Terminal 2: Consumer
javac BasicConsumer.java
java BasicConsumer

# Terminal 3: Monitor lag
javac LagMonitor.java
java LagMonitor
```

---

## WHAT TO OBSERVE

### Example 1: Basic Producer
- Each message gets offset
- Partition number matches key hash
- Same key → Same partition

### Example 3: Consumer
- Processes messages in order (per partition)
- Offset increments
- Restarting consumer: Resumes from committed offset
- No duplicate processing

### Rebalancing
- Start 2 consumers: Partitions split
- Add 3rd consumer: Rebalancing happens (pause)
- Stop consumer: Remaining consumers get more partitions
- Observe lag spike during rebalancing

### Exactly-Once
- Run producer twice: Same messages idempotent (no duplicates)
- Run consumer: Exactly one offset commit per message
- No duplicate processing even with crashes

---

**Next:** Pick an example, run it, modify it, break it, fix it. This is how you truly learn Kafka!
