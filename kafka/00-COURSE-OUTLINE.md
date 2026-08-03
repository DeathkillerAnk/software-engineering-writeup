# Kafka Mastery Course Outline
## From Software Engineer to Principal Engineer

**Target Level:** Early-career Software Engineer → Principal Engineer  
**Learning Duration:** 4-6 weeks (intensive) | 8-12 weeks (moderate pace)  
**Focus:** Deep internals, architecture, production patterns, and scalability

---

## MODULE 1: KAFKA FUNDAMENTALS & ARCHITECTURE
**Duration:** 3-4 days | **Goal:** Understand core concepts & system design

### 1.1 What is Kafka? (Beyond the Buzzword)
- Event streaming platform vs. Message queue
- Use cases: Real-time analytics, event sourcing, log aggregation, CDC
- Why Kafka beat traditional message brokers

### 1.2 Core Concepts
- **Topics:** Logical channels for events
- **Partitions:** Parallelism and scalability unit
- **Brokers:** Kafka cluster nodes
- **Producers:** Event senders
- **Consumers:** Event receivers
- **Consumer Groups:** Distributed consumption
- **Offsets:** Event position tracking

### 1.3 Kafka Broker Architecture
- Broker internals: Leadership, replication
- Controller responsibilities
- ZooKeeper coordination (traditional setup)
- KRaft mode (new controller quorum)
- Metadata management

### 1.4 Replication Strategy
- Leader-follower replication
- In-Sync Replicas (ISRs)
- Min-In-Sync-Replicas (min.insync.replicas)
- Consistency guarantees

---

## MODULE 2: PRODUCERS - DEEP DIVE
**Duration:** 4-5 days | **Goal:** Write optimized, reliable producers

### 2.1 Producer Architecture
- Producer internals: Batching, buffering, compression
- Partitioner logic and strategies
- Idempotent producers

### 2.2 Reliability Guarantees
- Acknowledgment levels (acks=0, 1, all)
- Retries and exponential backoff
- Transactional producers
- Exactly-once semantics (EOS)

### 2.3 Performance Optimization
- Batch configuration (batch.size, linger.ms)
- Compression codecs (Snappy, LZ4, Zstd)
- Buffer memory tuning
- Network efficiency
- Throughput vs. latency trade-offs

### 2.4 Error Handling & Patterns
- Retrievable vs. non-retrievable errors
- Dead letter queues (DLQ)
- Circuit breakers
- Monitoring producer metrics

---

## MODULE 3: CONSUMERS - THE COMPLEX PART
**Duration:** 5-6 days | **Goal:** Master consumption patterns & scalability

### 3.1 Consumer Group Mechanics
- Consumer group coordination protocol
- Partition assignment strategies
- Rebalancing triggers and process
- Static membership

### 3.2 Offset Management
- Automatic vs. manual offset commits
- Offset commit strategies
- Offset storage (internal topic vs. external)
- Seeking and resetting offsets

### 3.3 Exactly-Once & At-Least-Once
- Idempotent consumers
- Deduplication strategies
- External state management
- Transactions in consumers

### 3.4 Performance Optimization
- Fetch size tuning (fetch.min.bytes, fetch.max.wait.ms)
- Parallelism within consumer group
- Session timeout configurations
- Max poll records tuning

### 3.5 Advanced Patterns
- Long-running processing (pause/resume)
- Multi-threaded consumption
- Global state stores (with Kafka Streams)

---

## MODULE 4: KAFKA STREAMS & STATEFUL PROCESSING
**Duration:** 4-5 days | **Goal:** Build real-time applications

### 4.1 Topology & Stream DSL
- KStream, KTable, GlobalKTable
- Stateless transformations: map, filter, flatMap
- Repartitioning

### 4.2 Stateful Processing
- State stores (KeyValue, Window, Session)
- Local state store management
- State store changelog topics
- RocksDB internals

### 4.3 Joins & Aggregations
- KStream-KStream joins
- KStream-KTable joins
- KTable-KTable joins
- Window semantics (Tumbling, Hopping, Session, Grace period)

### 4.4 Exactly-Once Processing
- Kafka Streams EOS semantics
- Transactional state updates
- Offset management in Streams

### 4.5 Interactive Queries & Topology Optimization
- Querying state stores
- Multi-instance scaling
- Topology optimization strategies

---

## MODULE 5: KAFKA CONNECT & DATA INTEGRATION
**Duration:** 3-4 days | **Goal:** Master data pipeline patterns

### 5.1 Kafka Connect Framework
- Source vs. Sink connectors
- Connector lifecycle
- Distributed vs. standalone mode
- Connector configuration

### 5.2 Building Custom Connectors
- SourceConnector & SinkConnector APIs
- Task creation and management
- Offset management in connectors
- Error handling strategies

### 5.3 Common Integrations
- JDBC connector deep dive
- S3 sink connector
- Elasticsearch connector
- Custom connector patterns

### 5.4 Schema Evolution & Compatibility
- Schema Registry overview
- Avro, Protobuf, JSON Schema
- Compatibility modes
- Version management

---

## MODULE 6: CLUSTER MANAGEMENT & OPERATIONS
**Duration:** 4-5 days | **Goal:** Operate production Kafka clusters

### 6.1 Cluster Setup & Configuration
- Hardware sizing and JVM tuning
- Broker configuration deep dive
- Network configuration
- Storage considerations (SSD vs. HDD)

### 6.2 Replication & Leadership
- Preferred leader election
- Broker failure scenarios
- Rack-aware replication
- Under-replicated partition handling

### 6.3 Scaling & Partition Management
- Adding brokers to cluster
- Partition reassignment algorithms
- Rolling deployments
- Topic creation strategies

### 6.4 Monitoring & Observability
- Key metrics (lag, throughput, latency)
- Kafka metrics (JMX)
- External monitoring (Prometheus, DataDog)
- Alerting strategies
- Log analysis

### 6.5 Troubleshooting Common Issues
- High latency diagnosis
- Consumer lag troubleshooting
- Broker failure recovery
- Disk space management
- Memory pressure handling

---

## MODULE 7: INTERNALS & PERFORMANCE TUNING
**Duration:** 4-5 days | **Goal:** Understand the engine under the hood

### 7.1 Log Storage Architecture
- Log segment files
- Index files (offset, timestamp)
- Compaction strategy
- Retention policies
- Tiered storage (Kafka 3.0+)

### 7.2 Network Protocol & Serialization
- Kafka protocol version evolution
- Request/response format
- Zero-copy optimization
- Message batching format
- Compression impact

### 7.3 Memory & Cache Management
- Page cache utilization
- Memory-mapped files
- Buffer management
- Garbage collection tuning

### 7.4 I/O Optimization
- Disk I/O patterns
- Read/write amplification
- fsync() behavior
- Performance vs. durability trade-offs

### 7.5 CPU & Network Optimization
- CPU hotspots
- Network bandwidth optimization
- Partition count impact
- Throughput maximization

---

## MODULE 8: ADVANCED PATTERNS & REAL-WORLD SCENARIOS
**Duration:** 3-4 days | **Goal:** Solve complex architectural problems

### 8.1 Event Sourcing with Kafka
- Event log as source of truth
- Snapshot strategies
- Temporal queries
- Event versioning

### 8.2 Change Data Capture (CDC)
- Database to Kafka CDC
- Debezium architecture
- Consistency guarantees
- Schema evolution in CDC

### 8.3 Multi-Datacenter Replication
- MirrorMaker architecture
- Consistency in geo-distributed systems
- Conflict resolution
- Failover strategies

### 8.4 Complex Aggregations & Analytics
- Session windows
- Out-of-order event handling
- Windowing strategies
- Late-arriving data

### 8.5 Security & Compliance
- Authentication (SASL/SCRAM, mTLS)
- Authorization (ACLs)
- Encryption (in-transit, at-rest)
- Audit logging
- Data retention & GDPR compliance

---

## MODULE 9: SYSTEM DESIGN & ARCHITECTURE
**Duration:** 3-4 days | **Goal:** Design production systems

### 9.1 Designing High-Throughput Systems
- Throughput requirements calculation
- Partition strategy
- Replication factor decisions
- Broker sizing

### 9.2 Low-Latency System Design
- End-to-end latency optimization
- Compression vs. latency trade-offs
- Network topology optimization
- Application-level optimization

### 9.3 Exactly-Once Processing Architecture
- End-to-end exactly-once design
- Idempotency strategies
- Deduplication window sizing
- External state management

### 9.4 Fault Tolerance & Disaster Recovery
- Failure scenarios
- Recovery strategies
- Backup and restoration
- Multi-region setup

### 9.5 Cost Optimization
- Cluster sizing strategies
- Retention policies
- Tiered storage utilization
- Compression ROI analysis

---

## MODULE 10: CASE STUDIES & CAPSTONE PROJECT
**Duration:** 5-7 days | **Goal:** Apply everything in real scenarios

### 10.1 Case Studies
- LinkedIn's Use Case
- Netflix's Real-time Analytics Pipeline
- Uber's Tracking System
- Airbnb's Event Streaming
- Lessons and takeaways

### 10.2 Capstone Project
- **Design a multi-million event/day system**
  - Real-time fraud detection
  - User activity analytics
  - Distributed tracing
  - Cost considerations
  - Deployment strategy

### 10.3 Interview Preparation
- System design questions
- Deep-dive questions on internals
- Trade-off discussions
- Scaling strategies

---

## LEARNING RESOURCES & TOOLS

### Essential Tools
- Kafka CLI tools
- Confluent Cloud or Self-Hosted
- Kafka UI / Kafdrop
- Apache JMeter (for load testing)
- Prometheus + Grafana

### Recommended Reading
- Kafka: The Definitive Guide (O'Reilly)
- Papers: Replication, Exactly-Once Semantics
- Confluent Blog & Documentation
- Source code exploration (GitHub)

### Labs & Hands-On
- 10+ production-like scenarios
- Performance benchmarking exercises
- Troubleshooting challenges
- Architecture design exercises

---

## SUCCESS CRITERIA

By the end of this course, you will:

✅ Understand Kafka architecture from disk I/O to network protocol  
✅ Design producers and consumers for any use case  
✅ Implement exactly-once processing reliably  
✅ Operate and troubleshoot production Kafka clusters  
✅ Architect systems handling millions of events/day  
✅ Make data-driven decisions on partition strategy, replication, and compression  
✅ Mentor junior engineers on Kafka best practices  
✅ Lead Kafka migration and infrastructure projects  
✅ Pass principal engineer interviews on Kafka topics  

---

## Difficulty Progression
- **Weeks 1-2:** Foundations (Modules 1-3) - Build mental models
- **Weeks 3-4:** Advanced (Modules 4-5) - Apply concepts
- **Weeks 5-6:** Mastery (Modules 6-10) - Design and optimize

**Estimated Time:** 80-120 hours of focused learning + 40-60 hours of hands-on labs
