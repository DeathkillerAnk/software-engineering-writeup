# 🚀 Apache Kafka - Complete Learning Path

**Goal:** Master Kafka from fundamentals to principal engineer level  
**Duration:** 4-6 weeks (intensive) | Time Investment: 120-180 hours  
**Target:** Early-career software engineer → Principal engineer capability

---

## 📚 WHAT YOU'LL FIND HERE

This learning package contains **4 carefully structured materials**:

### 1. **00-COURSE-OUTLINE.md** - Your Roadmap
- 10-module structured curriculum
- Module breakdown with learning goals
- Progression timeline (weeks 1-4)
- Success criteria for each phase
- **Start here to understand the full scope**

### 2. **01-KAFKA-CRASH-COURSE.md** - The Essentials (45-60 min read)
- Conceptual foundation
- Core mental models
- Producer deep dive
- Consumer deep dive  
- Replication & durability
- Performance tuning
- Common pitfalls
- System design patterns
- **Read this FIRST to build intuition**

### 3. **02-VISUAL-GUIDE-AND-STUDY-PLAN.md** - Interactive Learning
- ASCII diagrams (topic architecture, message flow, rebalancing)
- Configuration quick reference
- Week-by-week study checklist
- 7 hands-on lab exercises
- Interview cheat sheet
- Mental models
- Resources by topic
- **Use alongside crash course for deeper understanding**

### 4. **03-CODE-EXAMPLES.md** - Hands-On Practice
- 7 runnable Java examples
- Producer (basic + exactly-once)
- Consumer (basic + rebalancing-aware)
- Kafka Streams (aggregation + joins)
- Lag monitoring
- **Type these, run them, modify them, break them**

---

## 🎯 QUICK START (TODAY)

### Option A: Fast Track (45 minutes)
1. **Read** 01-KAFKA-CRASH-COURSE.md (30 min)
2. **Look at** 02-VISUAL-GUIDE-AND-STUDY-PLAN.md diagrams (10 min)
3. **Skim** 00-COURSE-OUTLINE.md chapters (5 min)

**After:** You'll have solid mental models. Proceed to labs.

### Option B: Structured Approach (2 hours)
1. **Scan** 00-COURSE-OUTLINE.md (understand structure) - 10 min
2. **Read** 01-KAFKA-CRASH-COURSE.md (build intuition) - 45 min
3. **Study** 02-VISUAL-GUIDE-AND-STUDY-PLAN.md diagrams (review + memorize) - 40 min
4. **Preview** 03-CODE-EXAMPLES.md (see what's coming) - 5 min

**After:** Ready for depth. Pick a module from course outline and dive deep.

### Option C: Deep Dive Mode (4 hours)
Do A or B, then:
1. **Work through** Week 1 of study plan (00-COURSE-OUTLINE.md Module 1-3)
2. **Read** corresponding sections in crash course
3. **Study** diagrams for those topics
4. **Run** 1-2 code examples

**After:** Deep foundation + hands-on. Ready for labs and advanced topics.

---

## 📖 RECOMMENDED LEARNING PATH

### WEEK 1: FOUNDATIONS
**Goal:** Mental models solidify

| Day | What | How Long | Where |
|-----|------|----------|-------|
| 1 | Core Concepts + Partition Key | 2h | Crash Course §1-2 |
| 2 | Producer Architecture | 2h | Crash Course §3 + Code Ex #1 |
| 3 | Consumer Offsets + Rebalancing | 2.5h | Crash Course §4 + Code Ex #3-4 |
| 4 | Replication & ISR | 2h | Crash Course §5 + Visual Guide |
| 5 | Lab: Kill brokers, watch failover | 2h | Hands-on |

**Quiz Yourself:** Can you explain ISR and what happens during broker failure? Can you draw rebalancing sequence?

---

### WEEK 2: ADVANCED
**Goal:** Build and optimize systems

| Day | What | How Long | Where |
|-----|------|----------|-------|
| 6 | Kafka Streams & State Stores | 2.5h | Crash Course §8 + Code Ex #5-6 |
| 7 | Exactly-Once Semantics | 2h | Crash Course §3.2 + Code Ex #2 |
| 8 | Joins & Windowing | 2.5h | Course Outline Module 4.3-4.4 |
| 9 | Connect & CDC | 2h | Course Outline Module 5 |
| 10 | Performance Benchmarking | 2h | Study Plan Labs, Course Outline Module 7 |

**Lab:** Build word-count Streams topology. Achieve 50k msgs/sec.

---

### WEEK 3-4: MASTERY
**Goal:** Design & troubleshoot production systems

| Week | Focus | Details |
|------|-------|---------|
| 3 | Internals & Operations | Log files, page cache, replication protocol, cluster ops |
| 4 | System Design | Design 1M events/sec, multi-datacenter, exactly-once payment |

---

## 🔧 HANDS-ON LABS (In Order)

```
Lab 1 (Day 1):  "Hello Kafka" - See messages persist
Lab 2 (Day 3):  "Partition Assignment" - Watch rebalancing
Lab 3 (Day 4):  "Rebalancing Storm" - See latency spikes
Lab 4 (Day 5):  "Failure Recovery" - Broker dies → automatic failover
Lab 5 (Day 6):  "Exactly-Once" - No duplicates with crashes
Lab 6 (Day 8):  "Stream Aggregation" - Count clicks per window
Lab 7 (Day 10): "CDC Integration" - Database changes → Kafka
```

**See 02-VISUAL-GUIDE-AND-STUDY-PLAN.md § HANDS-ON LAB EXERCISES for details**

---

## ✅ LEARNING CHECKPOINTS

### After Day 3 (Week 1)
- [ ] Explain why partition key matters
- [ ] Draw topic → partitions → brokers
- [ ] Explain 3 acks levels + when to use each
- [ ] Explain offset commit trap
- [ ] Draw rebalancing sequence

### After Week 1
- [ ] Explain ISR and failure scenarios
- [ ] Design producer for 1 million msgs/sec
- [ ] Implement consumer with manual commits
- [ ] Run lab: broker failure recovery
- [ ] Monitor consumer lag

### After Week 2
- [ ] Build Kafka Streams topology
- [ ] Implement exactly-once consumer
- [ ] Achieve 50k+ msgs/sec throughput
- [ ] Troubleshoot consumer lag
- [ ] Design CDC pipeline

### After Week 4
- [ ] Design system for 1M events/sec
- [ ] Operate multi-broker cluster
- [ ] Post-mortem complex issues
- [ ] Architect exactly-once payment processing
- [ ] Pass principal engineer interview

---

## 🎓 WHAT MAKES THIS DIFFERENT

### NOT Just Config Reference
❌ "Here are 30 configs, memorize them"  
✅ "Here are 3 key knobs and the trade-offs they represent"

### NOT Just Tutorials
❌ "Follow these 10 steps to deploy"  
✅ "Understand the WHY behind each step"

### NOT Focused on Tool Usage
❌ "Run this command, get this output"  
✅ "Here's what's happening under the hood"

### IS Focused on Mental Models
✅ Kafka = distributed append-only log  
✅ Partition key = order guarantee  
✅ ISR = safety guarantee  
✅ Offset commit = exactly-once  
✅ Rebalancing = temporary stop  

---

## 💡 KEY MENTAL MODELS (MEMORIZE THESE)

1. **Partition = Ordered Queue**
   - All messages with same key go to SAME partition
   - → Order guaranteed within key
   - → Parallelism across different keys

2. **ISR = Safety**
   - In-Sync Replicas = replicas with latest data
   - acks=all waits for ISR to acknowledge
   - → No data loss (if replication-factor >= 2)

3. **Offset = Position**
   - Like a bookmark in a book
   - Consumer tracks which messages already processed
   - → No duplicate processing
   - → Can replay by seeking to earlier offset

4. **Rebalancing = Stop the World**
   - Adding/removing consumers → entire group pauses
   - While group pauses: no messages consumed
   - → Can cause lag spikes
   - Minimize with static.membership.id

5. **Batching + Compression = Free Lunch**
   - Group messages + compress + send once
   - 50-70% size reduction
   - Tiny CPU cost
   - Almost always worth it

---

## 📊 RECOMMENDED TIMELINE

### Intensive (Full-time, 4-6 weeks)
- Weeks 1-2: Modules 1-5 (foundations + producers/consumers)
- Week 3: Modules 6-8 (operations + advanced patterns)  
- Week 4: Module 9-10 (system design + capstone)

### Moderate (Part-time, 8-12 weeks)
- Weeks 1-4: Modules 1-3 (foundations)
- Weeks 5-8: Modules 4-6 (streams + operations)
- Weeks 9-12: Modules 7-10 (internals + design)

### Casual (Self-paced, 12-16 weeks)
- Pick 1-2 topics per week
- Spend 1 hour/day
- Do 1 lab per week

---

## 🚀 CAREER IMPACT

### As Mid-Level Engineer
**Now:** Handle producer/consumer problems  
**After:** Design patterns others use  
**Timeline:** 2-3 weeks to noticeable impact

### As Senior Engineer  
**Now:** Can tune configs  
**After:** Predict bottlenecks, prevent outages  
**Timeline:** 4-6 weeks to thought leader status

### As Principal Engineer
**Now:** Implement Kafka  
**After:** Architect for 10x scale, mentor teams  
**Timeline:** Complete 4-6 week course, then 3-6 months experience

---

## 🎯 SUCCESS METRICS

### Technical
- Can design system handling 1M events/sec
- Can troubleshoot any consumer lag issue
- Understand and explain ISR, offsets, rebalancing
- Can write exactly-once consumer code
- Can architect multi-datacenter replication

### Career
- Lead Kafka infrastructure decisions
- Mentor 2-3 engineers on Kafka topics
- Design 2-3 production systems
- Reduce outage resolution time (understanding = diagnosis)
- Speak confidently in technical interviews

---

## 📖 EXTERNAL RESOURCES

**Must-Read:**
- [Kafka: The Definitive Guide](https://learning.oreilly.com/library/view/kafka-the-definitive/9781491936160/) (O'Reilly)
- [Confluent Documentation](https://docs.confluent.io/) (free online)
- Papers: [Kafka: A Distributed Messaging System for Log Processing](https://kafka.apache.org/documentation/#semantics)

**Hands-On:**
- Confluent Cloud (free tier)
- Local setup with docker-compose
- Kafdrop UI
- Apache JMeter for load testing

**Community:**
- [Apache Kafka GitHub](https://github.com/apache/kafka)
- [Confluent Blog](https://www.confluent.io/blog/)
- Stack Overflow tag: `kafka`

---

## 🛠️ SETTING UP YOUR LAB ENVIRONMENT

### Option 1: Docker (Recommended for Learning)
```bash
# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.0.1
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
  
  kafka:
    image: confluentinc/cp-kafka:7.0.1
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
  
  kafdrop:
    image: obsidiandynamics/kafdrop
    ports:
      - "9000:9000"
    environment:
      KAFKA_BROKERCONNECT: kafka:29092
    depends_on:
      - kafka
EOF

# Start
docker-compose up -d

# Access Kafdrop UI at http://localhost:9000
```

### Option 2: Confluent Cloud (Production-like)
- Free tier available
- Managed cluster
- No ops overhead
- Great for learning

---

## 🤔 COMMON QUESTIONS ANSWERED

**Q: How much time does this take?**  
A: 120-180 hours total. Spread over 4-6 weeks intensive, or 8-12 weeks moderate.

**Q: Do I need to know Java?**  
A: Helps but not required. Concepts apply to Python, Go, etc.

**Q: Can I skip Kafka Streams?**  
A: Not recommended. It's how modern Kafka is used.

**Q: Should I read the source code?**  
A: Absolutely. But after week 2. Start with LogManager, ReplicaManager.

**Q: Will this make me a principal engineer?**  
A: In Kafka topics, yes. Pair with other skills (system design, leadership) for broader impact.

---

## 📍 WHERE TO START RIGHT NOW

### If you have 1 hour:
1. Read 01-KAFKA-CRASH-COURSE.md (sections 1-3)
2. Look at diagrams in 02-VISUAL-GUIDE

### If you have 3 hours:
1. Read full 01-KAFKA-CRASH-COURSE.md
2. Skim 02-VISUAL-GUIDE-AND-STUDY-PLAN.md
3. Pick one code example and understand it

### If you have a weekend:
1. Read 01-KAFKA-CRASH-COURSE.md
2. Study 02-VISUAL-GUIDE-AND-STUDY-PLAN.md
3. Work through Week 1 study plan from same file
4. Run Lab 1-2 from 03-CODE-EXAMPLES.md

### If you have 4 weeks:
Follow the WEEK 1-4 plan above. 120+ hours of learning + labs.

---

## 🎉 WHAT YOU'LL BE ABLE TO DO

After completing this course:

**Week 1:**
- ✅ Explain how Kafka works to a junior engineer
- ✅ Debug why a consumer is lagging
- ✅ Design a producer that won't lose data

**Week 2:**
- ✅ Implement real-time analytics with Kafka Streams
- ✅ Build exactly-once payment processor
- ✅ Achieve 100k+ messages/sec throughput

**Week 4:**
- ✅ Design system for 1M events/day
- ✅ Architect multi-datacenter Kafka
- ✅ Lead Kafka migration project
- ✅ Mentor engineers on Kafka
- ✅ Ace principal engineer interview on Kafka topics

---

## 📝 LICENSE & ATTRIBUTION

This material is created for learning purposes.

---

**🚀 Ready? Start with 01-KAFKA-CRASH-COURSE.md**

*Estimated reading time: 45 minutes*  
*Set a timer, eliminate distractions, and let's go!*

---

## QUICK LINKS

| Material | Purpose | Time | Start When |
|----------|---------|------|-----------|
| **00-COURSE-OUTLINE.md** | Understand full curriculum | 10 min | After crash course |
| **01-KAFKA-CRASH-COURSE.md** | Build mental models | 45 min | RIGHT NOW |
| **02-VISUAL-GUIDE** | Deepen understanding | 60 min | During week 1 |
| **03-CODE-EXAMPLES** | Practice coding | 90 min | During week 1-2 |

---

**Questions? Comments? Fork and improve!**

Good luck on your Kafka journey! 🚀
