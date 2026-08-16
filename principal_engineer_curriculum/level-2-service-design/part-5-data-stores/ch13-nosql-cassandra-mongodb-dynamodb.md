# Chapter 13 — NoSQL Databases: Cassandra, MongoDB, and DynamoDB

## Difficulty
Advanced

## Importance
**Must Know** — "NoSQL" is not a technology trend — it is a set of deliberate trade-offs. Every company that reaches scale eventually confronts workloads that relational databases handle poorly: write-heavy time-series at millions of events per second, document storage with dynamic schemas, key-value lookups at sub-millisecond latency, globally distributed access patterns. A Principal Engineer who defaults to PostgreSQL for every workload is leaving performance and scale on the table. One who reaches for Cassandra without understanding its consistency model is building a subtle correctness time bomb. This chapter teaches the data model, the physics, the trade-offs, and the failure modes of the three most important NoSQL families.

## Prerequisites
Chapter 7 — Storage Engines and Database Internals (LSM-Tree, B-Tree, MVCC)
Chapter 8 — Consistency, Consensus, and CAP (eventual consistency, quorums)
Chapter 12 — SQL Databases at Scale (what we are departing from, and why)

## Learning Objectives

By the end of this chapter you will be able to:

1. Explain the four NoSQL data model families (key-value, document, wide-column, graph) and which problem each is designed for.
2. Describe Cassandra's data model: keyspace, table, partition key, clustering key, and how they map to physical storage.
3. Explain Cassandra's consistency model: how quorums work, what `LOCAL_QUORUM` vs `ONE` means for availability and durability, and why Cassandra does NOT provide linearizability even at `QUORUM`.
4. Describe Cassandra's compaction strategies and when to use each.
5. Explain MongoDB's document model, BSON, indexes, aggregation pipeline, and change streams.
6. Explain DynamoDB's single-table design, partition key / sort key mechanics, GSIs (Global Secondary Indexes), and the DynamoDB Streams + Lambda pattern.
7. Apply the access-pattern-first design methodology for NoSQL schema design.
8. Diagnose and fix the four most common NoSQL anti-patterns: hot partitions, tombstone accumulation, unbounded queries, and document bloat.

## Why This Matters

A team at a social media company stores user activity events in PostgreSQL. At 1 billion daily active users × 50 events per day = 50 billion events/day. A single PostgreSQL instance tops out at ~10-30K inserts/second. At 50 billion/86,400 seconds = 578,000 inserts/second — 20-50× beyond what PostgreSQL can handle. The team migrates to Cassandra: 7 nodes × 100K writes/second = 700K writes/second. Linear horizontal scaling. The problem is solved at the physics level.

But the same team six months later: Cassandra reads are suddenly 10× slower. Diagnosis: a model that deletes old events by row creates millions of tombstones. Cassandra must scan through all tombstones on every read to find live data. Without understanding Cassandra's tombstone mechanics, this failure is impossible to anticipate.

Understanding NoSQL means understanding both when to use it AND the operational failure modes you are accepting when you do.

---

## Mental Model

> **NoSQL databases are not "SQL without the constraints." They are data structures optimized for specific access patterns, made horizontally scalable by trading away the features that make horizontal scaling hard — primarily: cross-row ACID transactions, flexible ad-hoc queries, and strong consistency. The correct mental model is: design your NoSQL schema around your access patterns (the queries you will run), not around your data relationships (the normalized model). Every NoSQL anti-pattern comes from trying to use a NoSQL database like a relational one.**

---

## Intuition

**Relational databases (SQL):** Organize data around the truth — normalize it so every fact is stored once. When you need it, query flexibly: join any tables, filter any columns. The schema is designed around data integrity; the queries are flexible.

**NoSQL databases:** Organize data around the question. Design the schema so the most frequent query returns its answer from a single partition/document/row — no joins, no scans. The queries are predetermined; the schema serves the query.

Think of it as the difference between:
- **SQL:** A library with a central catalog. Any book can be found via any classification — author, title, subject. But you must walk to the catalog, find the reference, then find the shelf. Flexible, but steps involved.
- **NoSQL (Cassandra/DynamoDB):** A personal bookshelf organized exactly for how you read — cookbooks on the kitchen counter, work books at the desk. Zero steps to find the book you always use in that context. But if you need "all books published in 2020," you're searching every shelf.

---

## Visual Explanation

### The NoSQL Data Model Families

```
Key-Value Store (Redis, DynamoDB simple use):
  get("user:789") → "Alice Smith"
  get("session:abc123") → {userId:789, expires:...}
  ┌─────────────────┬──────────────────────────────┐
  │ KEY             │ VALUE (opaque blob)          │
  ├─────────────────┼──────────────────────────────┤
  │ user:789        │ {name:"Alice", age:30}       │
  │ session:abc123  │ {userId:789, expires:...}    │
  └─────────────────┴──────────────────────────────┘
  
Document Store (MongoDB, CouchDB, Firestore):
  Hierarchical JSON/BSON documents
  ┌──────────────────────────────────────────────────┐
  │ _id: ObjectId("507f1f77bcf86cd799439011")        │
  │ name: "Alice Smith"                              │
  │ orders: [                                        │
  │   {orderId: "o1", items: [...], total: 99.99}   │
  │   {orderId: "o2", items: [...], total: 45.00}   │
  │ ]                                                │
  │ address: {city: "SF", zip: "94105"}              │
  └──────────────────────────────────────────────────┘
  
Wide-Column Store (Cassandra, HBase, Bigtable):
  Rows keyed by partition key, columns by clustering key
  ┌──────────────┬─────────────────────────────────────────────┐
  │ partition_key│ clustering_key → value                      │
  ├──────────────┼─────────────────────────────────────────────┤
  │ user:789     │ 2024-01-15T10:30:00 → {event: "page_view"} │
  │              │ 2024-01-15T10:31:00 → {event: "click"}     │
  │              │ 2024-01-15T10:32:00 → {event: "purchase"}  │
  ├──────────────┼─────────────────────────────────────────────┤
  │ user:123     │ 2024-01-15T09:00:00 → {event: "login"}    │
  └──────────────┴─────────────────────────────────────────────┘
  
Graph Store (Neo4j, Amazon Neptune):
  Nodes and edges with properties
  (Alice)-[:FOLLOWS]->(Bob)
  (Alice)-[:PURCHASED]->(Product:MacBook)
  (Bob)-[:REVIEWED]->(Product:MacBook)
```

### Cassandra Ring Architecture

```
6-node Cassandra cluster (RF=3):
  Token ring: 0 ──────────── 2^64-1 (wrapped)
  
  Node A: tokens 0 - 16K
  Node B: tokens 16K - 32K
  Node C: tokens 32K - 48K
  Node D: tokens 48K - 64K
  Node E: tokens 64K - 80K
  Node F: tokens 80K - 96K

  Write: partition_key "user:789" → murmur3 hash → token 27,456
  → Primary: Node B (owns 16K-32K)
  → Replica 1: Node C (next node clockwise)
  → Replica 2: Node D (next after C)
  (RF=3: 3 replicas in clockwise order)

  Read with QUORUM: must hear from ≥ 2 of {B, C, D}
  Read with ONE: hear from any 1 of {B, C, D}

  Node B fails:
    QUORUM write: write to C and D → 2 of 3 = QUORUM → succeeds
    ONE read: read from C or D → succeeds
    ALL read: fails (B is down, can't get all 3 replicas)
```

---

## Core Concepts

### 1. Cassandra — The Write-Optimized Wide-Column Store

#### Data Model

**Keyspace:** The top-level namespace (analogous to a database in SQL). Defines replication strategy:
```cql
CREATE KEYSPACE ecommerce
  WITH replication = {
    'class': 'NetworkTopologyStrategy',
    'us-east': 3,   ← 3 replicas in us-east datacenter
    'eu-west': 3    ← 3 replicas in eu-west datacenter
  }
  AND durable_writes = true;  ← always true for production
```

**Table:** Defined by a PRIMARY KEY consisting of:
- **Partition Key:** Determines which node(s) hold the data. All rows with the same partition key are stored together on disk. Can be composite: `(user_id, date)`.
- **Clustering Key:** Determines the sort order of rows within a partition. Enables range queries within a partition.

```cql
-- User activity events: query pattern = "all events for user X, in time order"
CREATE TABLE user_events (
    user_id     UUID,
    occurred_at TIMESTAMP,
    event_type  TEXT,
    properties  MAP<TEXT, TEXT>,
    PRIMARY KEY (user_id, occurred_at)
) WITH CLUSTERING ORDER BY (occurred_at DESC);
-- Partition key: user_id → all events for one user on one node
-- Clustering key: occurred_at → events sorted newest-first within the partition
-- Query: SELECT * FROM user_events WHERE user_id=? → full partition (no scatter)
-- Query: SELECT * FROM user_events WHERE user_id=? AND occurred_at > ? → range scan in partition
```

**What you CANNOT do easily in Cassandra:**
```cql
-- This requires a full cluster scan (ALLOW FILTERING or a secondary index):
SELECT * FROM user_events WHERE event_type = 'purchase';
-- Reason: event_type is not the partition key → query must hit every node
-- Fix: create a separate table keyed by event_type:
CREATE TABLE events_by_type (
    event_type  TEXT,
    occurred_at TIMESTAMP,
    user_id     UUID,
    properties  MAP<TEXT, TEXT>,
    PRIMARY KEY (event_type, occurred_at, user_id)
) WITH CLUSTERING ORDER BY (occurred_at DESC);
-- Denormalize: same data, different access pattern table
```

#### Partition Design — The Most Critical Decision

The partition key determines:
1. Which node(s) hold the data (hash of partition key → token → node)
2. The maximum size of one logical read (all rows with the same partition key)
3. Write distribution across nodes (hot vs cold partitions)

```
Good partition key:
  user_id → 10M users → 10M partitions → evenly distributed across nodes
  Each partition: ~17 events/user/day × 365 days = ~6,000 rows
  Partition size: 6,000 rows × ~500 bytes = ~3 MB (well within limits)

Bad partition key:
  event_type → 5 types (purchase, view, click, login, logout)
  → 5 partitions → 5 nodes carry ALL the load
  → Each partition: 10M users × 17 events/day = 170M rows on ONE node
  → Hot partition: catastrophic imbalance

Time-bucketed partition key (for high-volume event streams):
  PRIMARY KEY ((user_id, date), occurred_at)
  → user_id:date as partition → max ~17 rows per partition per day per user
  → Never grows unboundedly
  → Range query across days: multi-partition but bounded and predictable
```

**Partition size limits:**
- Soft limit: 100 MB per partition (performance degrades noticeably)
- Hard limit: Cassandra can handle larger, but compaction, read, and GC overhead grow
- Rule: keep partitions under 10 MB for predictable performance
- Rule: never allow a partition to grow unboundedly (unbounded partition = growing read amplification over time)

#### Cassandra Consistency Model — Precisely

Cassandra uses **quorum-based replication**, NOT consensus (no Raft/Paxos for data operations). This is a critical distinction.

```
Write at QUORUM (RF=3, W=2):
  1. Coordinator receives write
  2. Sends write to all 3 replicas simultaneously
  3. Waits for ACK from 2 of 3
  4. Returns success to client
  → Node 3 may not have the write yet (it will receive it via hinted handoff or read repair)

Read at QUORUM (R=2):
  1. Coordinator contacts 2 replicas
  2. If versions agree: return the value
  3. If versions disagree: return the newer version (by timestamp), repair the older replica
  → Read repair: asynchronous background fix of the replica with stale data

W + R > RF:  2 + 2 > 3 → QUORUM reads see QUORUM writes → "consistent"
```

**Why QUORUM is NOT linearizable:**

```
Scenario: Two concurrent writes to the same row with the same timestamp (clock skew):
  T1: write user:789 {name: "Alice"} at timestamp T=1000
  T2: write user:789 {name: "Alicia"} at timestamp T=1000 (same timestamp, different nodes)

Both writes arrive at different replicas.
  Node A: Alice (T=1000)
  Node B: Alicia (T=1000)
  Node C: Alice (T=1000)

QUORUM read contacts A and B: sees Alice and Alicia at same timestamp.
Last-Writer-Wins (LWW): Cassandra uses wall-clock timestamp. Same timestamp → arbitrary tiebreak.
Result: either "Alice" or "Alicia" returned — indeterminate.

This is NOT linearizable. Cassandra does not guarantee a total order of writes.
It guarantees: the last write (by timestamp) wins. Clock skew → wrong winner.

Mitigation: Use server-side timestamps (USING TIMESTAMP is client-set — dangerous).
            Use Cassandra lightweight transactions (LWT) for linearizable operations:
              INSERT INTO users (user_id, name) VALUES (789, 'Alice')
              IF NOT EXISTS;
              (Paxos-based, ~10× slower, use sparingly)
```

**Cassandra Lightweight Transactions (LWT):**
```cql
-- Compare-and-swap operation (Paxos internally):
UPDATE users
  SET name = 'Alicia'
  WHERE user_id = 789
  IF name = 'Alice';
-- Returns: [applied] = true (if condition was met) or false (condition not met)

-- Use cases: preventing duplicate user registration, idempotent write-once operations
-- Cost: 4 Paxos round trips → ~10× latency vs regular writes
-- Limitation: per-partition only (can't do LWT across partitions)
```

#### Compaction Strategies

From Chapter 7: Cassandra uses LSM-Tree → periodic compaction merges SSTables.

| Strategy | When | How | Best For |
|----------|------|-----|---------|
| **STCS (Size-Tiered)** | Default | Merge SSTables of similar size | Write-heavy, rarely read |
| **LCS (Leveled)** | After insert | Maintain non-overlapping levels | Read-heavy, low space amplification |
| **TWCS (Time-Window)** | Time-series | Compact within time windows, never across windows | Time-series with TTL |
| **FIFO** | Time-series | Drop oldest SSTable when size limit hit | Short-retention hot data |

```cql
-- Time-series events: use TWCS
CREATE TABLE user_events (...)
  WITH compaction = {
    'class': 'TimeWindowCompactionStrategy',
    'compaction_window_unit': 'HOURS',
    'compaction_window_size': 1
  }
  AND default_time_to_live = 2592000;  -- 30-day TTL
-- TWCS: groups writes into hourly windows
-- Once a window's SSTable is complete, never merges it with other windows
-- This is optimal for time-series: old windows are read-only, no rewrites
-- TTL: expired rows become tombstones → compacted away at window boundary
```

#### Tombstones — The Silent Performance Killer

In LSM-Tree storage (Chapter 7), deletes write a **tombstone** — a special marker that hides the old value. The actual data is discarded during compaction.

```
DELETE user_events WHERE user_id=789 AND occurred_at='2024-01-01';
→ Writes a tombstone marker (not an immediate delete)

Cassandra read for user:789:
  1. Check MemTable: any data or tombstones?
  2. Check L0 SSTables: any data or tombstones?
  3. Check L1 SSTables: ...
  4. Merge all results, applying tombstones to hide deleted rows

If 1 million rows were deleted (but compaction hasn't run yet):
  Read for user:789 must scan through 1 million tombstones to find 5 live rows
  → Read performance degrades dramatically
  → Warning in Cassandra logs: "Read X tombstones in query Y — threshold exceeded"

Tombstone accumulation causes:
  - Massive read latency (scanning dead data)
  - GC pressure (loading and discarding tombstone objects)
  - Potential coordinator timeout (reading too slowly → coordinator gives up)

Prevention:
  1. Use TTL (time-to-live) instead of explicit DELETE:
     INSERT INTO user_events (...) VALUES (...) USING TTL 2592000;  -- 30 days
     Cassandra marks row for auto-expiry → tombstones generated at TTL boundary
     TWCS compaction cleans them efficiently at window boundary

  2. Design partitions so old data falls off naturally (time-bucketed partitions)
     Drop the entire old partition table instead of deleting rows

  3. Monitor: nodetool tpstats, Cassandra tombstone warnings in system.log
```

### 2. MongoDB — The Document Store

#### Data Model

MongoDB stores **documents** (JSON/BSON) in **collections**. Documents in a collection can have different fields — no enforced schema by default.

```javascript
// BSON document in the "orders" collection:
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "orderId": "o123",
  "customerId": "c789",
  "status": "pending",
  "items": [
    {
      "productId": "p456",
      "name": "MacBook Pro 14\"",
      "quantity": 1,
      "unitPrice": NumberDecimal("2499.99")
    }
  ],
  "shippingAddress": {
    "street": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94105"
  },
  "total": NumberDecimal("2499.99"),
  "createdAt": ISODate("2024-01-15T14:30:00.000Z"),
  "metadata": {
    "source": "web",
    "promoCode": "SAVE10",
    "tags": ["high-value", "new-customer"]
  }
}
```

**Why documents (vs rows):**
- Related data stored together (order + items in one document = one read, no JOIN)
- Schema flexibility: add a field to some documents without ALTER TABLE
- Natural fit for hierarchical/nested data
- Variable-length arrays embedded in the document

**BSON types that SQL lacks:**
- `Array`: embedded list of values (order items)
- `ObjectId`: 12-byte timestamp + random + counter (sortable, globally unique)
- `Decimal128`: precise decimal arithmetic for financial data
- `Binary`: raw binary data (files, images)

#### Schema Design: Embed vs Reference

The core MongoDB design decision:

**Embed (denormalize):** Store related data in the same document.
```javascript
// Embed order items in the order document:
{
  _id: "o123",
  items: [{productId: "p1", qty: 2}, {productId: "p2", qty: 1}]  // embedded
}
// Pro: one read for order + items
// Con: if items list grows unboundedly, document grows without bound (16MB limit)
//      updating one item = rewrite the entire document
```

**Reference (normalize):** Store related data in a separate collection with a reference ID.
```javascript
// Separate items collection:
// order: {_id: "o123", itemIds: ["i1", "i2", "i3"]}
// items: [{_id: "i1", orderId: "o123", productId: "p1", qty: 2}]
// Pro: items can be queried independently, no document size limit per item
// Con: two reads (or a $lookup / application-level join) to get order + items
```

**Rules for embed vs reference:**
| Embed when | Reference when |
|-----------|---------------|
| Data is accessed together always | Data is accessed independently |
| Array is bounded (< 100 elements) | Array can grow without bound |
| Data is "owned" by the parent | Data is "shared" by multiple parents |
| 1-to-1 or 1-to-few relationship | 1-to-many (large N) or many-to-many |

#### Indexes in MongoDB

```javascript
// Single field index:
db.orders.createIndex({customerId: 1})  // ascending
db.orders.createIndex({createdAt: -1}) // descending

// Compound index (field order matters — same left-prefix rule as SQL):
db.orders.createIndex({customerId: 1, status: 1, createdAt: -1})
// Supports queries on: customerId, customerId+status, customerId+status+createdAt
// Does NOT support: status alone, createdAt alone

// Partial index (index only a subset of documents — saves space):
db.orders.createIndex(
  {customerId: 1, createdAt: -1},
  {partialFilterExpression: {status: "pending"}}
)
// Only indexes "pending" orders → much smaller, faster for the common query

// Text index (full-text search):
db.products.createIndex({name: "text", description: "text"})
db.products.find({$text: {$search: "macbook pro"}})

// TTL index (auto-expire documents):
db.sessions.createIndex({createdAt: 1}, {expireAfterSeconds: 3600})
// MongoDB automatically deletes documents older than 1 hour
// Equivalent to Cassandra's TTL but at the document level

// Explain a query:
db.orders.find({customerId: "c789"}).explain("executionStats")
// Look for: IXSCAN (good) vs COLLSCAN (bad — collection scan)
```

**Covered query (index-only scan):**
```javascript
// Index: {customerId: 1, status: 1, total: 1}
// Query:
db.orders.find(
  {customerId: "c789"},          // uses index
  {_id: 0, status: 1, total: 1} // projects only indexed fields
)
// → Covered query: no document fetch needed, answers from index alone
```

#### Aggregation Pipeline

MongoDB's aggregation pipeline is a sequence of stages that transform documents:

```javascript
// "Total revenue per customer for orders in January 2024"
db.orders.aggregate([
  // Stage 1: Filter
  {$match: {
    status: "fulfilled",
    createdAt: {$gte: ISODate("2024-01-01"), $lt: ISODate("2024-02-01")}
  }},
  // Stage 2: Group and sum
  {$group: {
    _id: "$customerId",
    totalRevenue: {$sum: "$total"},
    orderCount: {$sum: 1}
  }},
  // Stage 3: Sort by revenue
  {$sort: {totalRevenue: -1}},
  // Stage 4: Limit top 10
  {$limit: 10},
  // Stage 5: Lookup customer details (left join)
  {$lookup: {
    from: "customers",
    localField: "_id",
    foreignField: "_id",
    as: "customerDetails"
  }},
  // Stage 6: Project output shape
  {$project: {
    customerId: "$_id",
    customerName: {$arrayElemAt: ["$customerDetails.name", 0]},
    totalRevenue: 1,
    orderCount: 1,
    _id: 0
  }}
])
```

**Atlas Search / $search:** Full-text search via Lucene integration (separate from text indexes):
```javascript
db.products.aggregate([
  {$search: {
    index: "product_search",
    text: {query: "wireless headphones", path: ["name", "description"]},
    fuzzy: {maxEdits: 1}  // fuzzy match
  }},
  {$limit: 20}
])
```

#### MongoDB Transactions

MongoDB 4.0+ supports multi-document ACID transactions:
```javascript
const session = client.startSession();
session.startTransaction({
  readConcern: {level: "snapshot"},
  writeConcern: {w: "majority"}
});

try {
  // Debit account A
  await accounts.updateOne(
    {_id: "accountA"},
    {$inc: {balance: -100}},
    {session}
  );
  // Credit account B
  await accounts.updateOne(
    {_id: "accountB"},
    {$inc: {balance: 100}},
    {session}
  );
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
}
```

**Multi-document transaction caveats:**
- Transactions that span shards (in a sharded cluster) are supported but expensive (2PC internally)
- Maximum transaction size: 16 MB (total documents touched)
- Transaction lifetime limit: 60 seconds by default
- Performance: ~10-20% overhead vs non-transactional writes
- Best practice: embed related data to avoid needing transactions; use transactions for unavoidable cross-document atomicity

#### Change Streams

MongoDB Change Streams allow applications to subscribe to real-time data changes:
```javascript
// Watch for all changes to the orders collection:
const changeStream = db.orders.watch([
  {$match: {"fullDocument.status": "fulfilled"}}
]);

changeStream.on("change", async (change) => {
  console.log("Order fulfilled:", change.fullDocument.orderId);
  await notificationService.send(change.fullDocument.customerId);
});
// Built on MongoDB's oplog (operation log — like PostgreSQL WAL)
// Resumable: stores resume token to restart from a checkpoint
// Horizontal scale: one change stream per shard (in sharded clusters)
```

### 3. DynamoDB — The Fully Managed Key-Value and Document Store

#### DynamoDB Core Concepts

DynamoDB is AWS's managed NoSQL database, designed for:
- Unlimited scale (AWS manages partitioning automatically)
- Single-digit millisecond latency at any scale
- Fully managed (no cluster to operate)
- Pay-per-request pricing (or provisioned capacity)

**Data model:**
- **Table:** Top-level container (like a Cassandra keyspace + table)
- **Item:** A collection of attributes (like a document or row) — max 400 KB
- **Primary Key:** Either:
  - Simple: `Partition Key (PK)` only (single attribute that must be unique)
  - Composite: `Partition Key (PK) + Sort Key (SK)` (PK + SK must be unique together)
- **Attributes:** Schema-less beyond the primary key

```
Table: Orders
PK: customerId     SK: orderId#createdAt (composite sort key)
┌─────────────────┬──────────────────────────┬────────────────────────────────┐
│ PK              │ SK                       │ attributes                     │
├─────────────────┼──────────────────────────┼────────────────────────────────┤
│ customer#c789   │ ORDER#o123#2024-01-15    │ {status:"pending",total:99.99} │
│ customer#c789   │ ORDER#o456#2024-01-20    │ {status:"fulfilled",total:45}  │
│ customer#c789   │ PROFILE#2024-01-01       │ {name:"Alice",email:"..."}     │
│ customer#c123   │ ORDER#o789#2024-01-10    │ {status:"cancelled",total:200} │
└─────────────────┴──────────────────────────┴────────────────────────────────┘
```

**DynamoDB access patterns — the access-pattern-first design:**

Before designing a DynamoDB schema, list all access patterns first:
```
1. Get customer profile by customerId
2. Get all orders for a customer, sorted by date
3. Get a specific order by orderId
4. Get all pending orders (for fulfillment team)
5. Get orders in a date range for a customer
```

Then design one table to serve all of them — the **single-table design** pattern.

#### Single-Table Design

In DynamoDB, you almost always want ONE table (not one per entity type). This is the opposite of relational design.

```
Single table: "Orders" (stores customers, orders, items, all in one table)

Item type   PK                  SK                          Attributes
──────────  ──────────────────  ──────────────────────────  ────────────────────
Customer    CUSTOMER#c789       PROFILE                     name, email, tier
Order       CUSTOMER#c789       ORDER#2024-01-15#o123       status, total, ...
Order item  CUSTOMER#c789       ORDER#o123#ITEM#i001        productId, qty, price
Product     PRODUCT#p456        DETAILS                     name, price, stock
Review      PRODUCT#p456        REVIEW#2024-01-10#r001      rating, text, userId

Access patterns:
  Get customer profile: PK=CUSTOMER#c789, SK=PROFILE → 1 read
  Get all orders for customer: PK=CUSTOMER#c789, SK begins_with ORDER# → range scan
  Get order items: PK=CUSTOMER#c789, SK begins_with ORDER#o123#ITEM → range scan
  Get product: PK=PRODUCT#p456, SK=DETAILS → 1 read

All served with NO table scans — every access is PK lookup or PK+SK range.
```

#### Global Secondary Indexes (GSI)

GSIs allow querying by attributes other than the primary key:

```
Problem: "Get all pending orders" (access pattern 4)
  Cannot do: Scan entire table for status="pending" → expensive, slow

Solution: GSI on status + createdAt:
  GSI Partition Key: status
  GSI Sort Key: createdAt

  GSI storage (maintained automatically by DynamoDB):
  ┌────────────┬──────────────────────────┬──────────────────────────────┐
  │ GSI-PK     │ GSI-SK                   │ projected attributes         │
  ├────────────┼──────────────────────────┼──────────────────────────────┤
  │ pending    │ 2024-01-15T14:30:00Z     │ customerId, orderId, total   │
  │ pending    │ 2024-01-20T09:15:00Z     │ customerId, orderId, total   │
  │ fulfilled  │ 2024-01-10T11:00:00Z     │ customerId, orderId, total   │
  └────────────┴──────────────────────────┴──────────────────────────────┘

Query: GetItems(IndexName="status-createdAt-index", KeyCondition="status=pending AND createdAt > X")
→ Returns pending orders in time order, no scan, O(log N) + result set size
```

**GSI gotchas:**
- GSIs are eventually consistent by default (writes to the base table propagate to GSI asynchronously)
- GSI must be provisioned with write capacity (each base table write = one GSI write)
- "Hot" GSI partition keys (e.g., `status="pending"` if 90% of orders are pending) → same hot partition problem as Cassandra
- Sparse GSI: if an item doesn't have the GSI key attribute, it's not included in the GSI → use for "status" that only exists for specific item types

#### DynamoDB Transactions

```python
import boto3

dynamodb = boto3.client('dynamodb')

# TransactWriteItems: up to 100 items, across up to 25 tables, all-or-nothing
response = dynamodb.transact_write_items(
    TransactItems=[
        {
            'Update': {
                'TableName': 'Orders',
                'Key': {'PK': {'S': 'CUSTOMER#c789'}, 'SK': {'S': 'ORDER#o123'}},
                'UpdateExpression': 'SET #status = :new_status',
                'ConditionExpression': '#status = :old_status',  # optimistic lock
                'ExpressionAttributeNames': {'#status': 'status'},
                'ExpressionAttributeValues': {
                    ':new_status': {'S': 'fulfilled'},
                    ':old_status': {'S': 'pending'}
                }
            }
        },
        {
            'Put': {
                'TableName': 'Orders',
                'Item': {
                    'PK': {'S': 'FULFILLMENT#f001'},
                    'SK': {'S': 'ORDER#o123'},
                    'orderId': {'S': 'o123'},
                    'fulfilledAt': {'S': '2024-01-15T15:00:00Z'}
                },
                'ConditionExpression': 'attribute_not_exists(PK)'  # prevent duplicate
            }
        }
    ]
)
# If either operation fails: both are rolled back
```

**DynamoDB Streams + Lambda (event-driven pattern):**
```
Write to DynamoDB → DynamoDB Stream (ordered log of changes) →
→ Lambda function triggered for each change →
→ Update Elasticsearch index / send notification / update analytics

Example: Order status changes:
  Order updated to "fulfilled" → DynamoDB Stream event →
  Lambda: send "Your order is shipped" email
  Lambda: update inventory count
  Lambda: update analytics table
  All asynchronously, no change to the write path
```

**Capacity modes:**
```
On-demand: pay per request, AWS auto-scales
  Cost: ~$1.25/million reads, $1.25/million writes
  Best for: unpredictable traffic, new applications

Provisioned: reserve Read Capacity Units (RCU) and Write Capacity Units (WCU)
  1 RCU = 1 strongly consistent read of up to 4KB/s (2 eventually consistent reads)
  1 WCU = 1 write of up to 1KB/s
  Cost: ~$0.00013/RCU/hour, ~$0.00065/WCU/hour
  Best for: predictable, high-volume traffic (5-10× cheaper than on-demand)
  
Auto-scaling: adjusts provisioned capacity based on utilization (with lag)
  → Can throttle during sudden spikes before scaling kicks in
  → Use on-demand for spike-prone workloads
```

### 4. Access-Pattern-First Design — The Universal NoSQL Methodology

**Relational design workflow:**
```
1. Identify entities and relationships (ER diagram)
2. Normalize to 3NF
3. Add indexes as queries are discovered
```

**NoSQL design workflow:**
```
1. Identify all access patterns (list every query the application will make)
2. Design the schema to serve those access patterns efficiently
3. Denormalize deliberately (duplicate data if needed to avoid scatter queries)
4. Verify every access pattern is served by a PK lookup or bounded range scan
```

**Example — Social media feed:**
```
Access patterns:
  1. Get user profile
  2. Get user's posts (newest first)
  3. Get a specific post + comments
  4. Get user's followers
  5. Get user's following list
  6. Get feed (posts from followed users, newest first)

Cassandra schema:
  users: PK=user_id
  posts_by_user: PK=user_id, CK=posted_at DESC → serves (2)
  comments_by_post: PK=post_id, CK=commented_at → serves (3)
  followers: PK=user_id, CK=follower_id → serves (4)
  following: PK=user_id, CK=followed_id → serves (5)
  feed: PK=user_id, CK=post_time DESC → serves (6)
    (feed is DENORMALIZED: each post written to each follower's feed table)
    (fan-out on write: when @celebrity with 10M followers posts → 10M writes)
    (fan-out on read alternative: assemble feed at read time → expensive reads)
```

---

## Deep Dive

### Cassandra Anti-Patterns: The Four Horsemen

**1. Hot Partition:**
```
Bad: Partition key = country_code
  All US users (70% of traffic) → same partition on one node
  Node overloaded; others idle.

Fix: Add randomness to partition key
  Partition key = (user_id % 16) → 16 partitions per user
  (Then aggregate at read time across 16 partitions)
  
OR: Composite partition key: (country_code, bucket) where bucket = random 0-99
  → 100 partitions per country → distributed load
```

**2. Unbounded Partition Growth:**
```
Bad: Partition key = user_id for an events table with no TTL
  User signs up in 2019. In 2024: 5 years × 365 days × 50 events = 91,250 rows
  In 2030: 11 years × 50 events/day = 200,750 rows and growing
  Partition: growing without bound → growing read amplification

Fix: Time-bucketed partition key: (user_id, date)
  Max rows per partition: 50 events per day (bounded)
  Query across days: multi-partition but bounded and pageable
```

**3. Tombstone Accumulation:**
```
Pattern: Application deletes old events:
  DELETE FROM user_events WHERE user_id=789 AND occurred_at < '2023-01-01';
  This deletes millions of rows → millions of tombstones
  Subsequent reads must scan through all tombstones → dramatic slowdown

Fix: Use TTL on writes instead of explicit DELETE:
  INSERT INTO user_events (...) USING TTL 31536000;  -- 1 year TTL
  Cassandra generates tombstones only at expiry → TWCS cleans efficiently
  
OR: Time-bucket partitions → DROP the old partition table
  ALTER TABLE user_events DROP PARTITION ...  -- Cassandra doesn't support this directly
  → Model with separate tables per time bucket:
    user_events_2023 → DROP TABLE user_events_2023 after data no longer needed
    (No tombstones at all — just drop the table)
```

**4. Allowing ALLOW FILTERING:**
```cql
-- This is almost always wrong in production:
SELECT * FROM user_events WHERE event_type='purchase' ALLOW FILTERING;
-- ALLOW FILTERING = full cluster scan → O(total data), slow, expensive

-- Every query must be served by the partition key → redesign the table
CREATE TABLE events_by_type (
    event_type  TEXT,
    occurred_at TIMESTAMP,
    user_id     UUID,
    PRIMARY KEY (event_type, occurred_at)
);
-- Now: SELECT * FROM events_by_type WHERE event_type='purchase' AND occurred_at > ?
-- → Single partition scan → fast
```

### DynamoDB Anti-Patterns

**1. One Table per Entity Type (relational mindset):**
```
BAD: users table, orders table, items table (three DynamoDB tables)
  → "Get customer + all orders + all items for today's fulfillment run"
  → Three separate queries + application-level join
  → N+1 problem at the DynamoDB layer
  
GOOD: Single table with entity prefixes (PK=CUSTOMER#id, SK=ORDER#id, etc.)
  → Query with PK=CUSTOMER#id, SK begins_with ORDER# → all orders in one request
```

**2. Scans:**
```python
# BAD: full table scan
response = dynamodb.scan(TableName='Orders', FilterExpression=Attr('status').eq('pending'))
# DynamoDB reads every item in the table, filters client-side
# At 100M items: reads all 100M, returns N matching → expensive, slow, throttled

# GOOD: GSI query
response = dynamodb.query(
    TableName='Orders',
    IndexName='status-createdAt-index',
    KeyConditionExpression='#status = :s',
    ExpressionAttributeNames={'#status': 'status'},
    ExpressionAttributeValues={':s': {'S': 'pending'}}
)
# Only reads items in the GSI with status=pending → fast, cheap
```

**3. Using numeric sequence IDs instead of composite keys:**
```
BAD: orderId = auto-increment integer
  DynamoDB partitions by hash(PK). Sequential integers → all writes to same partition
  (hash(1), hash(2), hash(3)... may cluster together)
  → Hot partition until enough IDs distributed

GOOD: orderId = ULID or UUID (random-ish)
  → Evenly distributed across partitions
  → No hot partition risk
```

### MongoDB Anti-Patterns

**1. Document Bloat:**
```javascript
// BAD: embed unbounded array
{
  _id: "user:789",
  posts: [/* 100,000 posts over 10 years */]
  // Document size approaches 16MB limit → writes fail
}

// GOOD: reference with separate collection
{
  _id: "user:789",
  name: "Alice",
  postCount: 15423  // denormalized count
}
// posts collection: {authorId: "user:789", createdAt: ..., content: ...}
// Query: db.posts.find({authorId: "user:789"}).sort({createdAt: -1}).limit(25)
```

**2. Collection Scan Without Index:**
```javascript
// BAD: query without index on large collection
db.orders.find({status: "pending"})
// → COLLSCAN: reads every document in the collection
// → At 10M orders: reads 10M documents to return 1M pending

// Detect in explain:
db.orders.find({status: "pending"}).explain("executionStats")
// → stage: "COLLSCAN", totalDocsExamined: 10000000

// Fix:
db.orders.createIndex({status: 1, createdAt: -1})
// → stage: "IXSCAN", totalDocsExamined: 1000000 (only pending docs)
```

---

## Real-World Example

### Apache Cassandra at Netflix

Netflix uses Cassandra at massive scale for:
- **Viewing history:** 140M subscribers × watch events → write-heavy, eventually consistent is OK
- **User preferences:** per-user settings, key-value lookup by userId
- **Service discovery:** each microservice registers in Cassandra, others discover via lookup

**Netflix's Cassandra configuration for viewing history:**
```cql
CREATE TABLE viewing_history (
    user_id   UUID,
    viewed_at TIMESTAMP,
    content_id UUID,
    progress  INT,   -- seconds watched
    PRIMARY KEY (user_id, viewed_at)
) WITH CLUSTERING ORDER BY (viewed_at DESC)
  AND compaction = {'class': 'TimeWindowCompactionStrategy',
                    'compaction_window_unit': 'DAYS',
                    'compaction_window_size': '7'}
  AND default_time_to_live = 7776000;  -- 90 days

-- Query: "Show Alice her last 20 watched titles"
SELECT content_id, viewed_at, progress
FROM viewing_history
WHERE user_id = alice_uuid
LIMIT 20;
-- Returns in milliseconds from a single partition
```

**Netflix lessons:**
- Consistency level `LOCAL_ONE` for viewing history reads — slightly stale history is acceptable
- `LOCAL_QUORUM` for billing/subscription writes — must be consistent
- Separate clusters per region — no cross-region replication lag in hot path
- Never use `ALLOW FILTERING` — all queries designed around partition key

---

## Failure Scenarios

### Scenario 1: Cassandra Hot Partition Causing Cluster Imbalance

```
E-commerce platform. Partition key = product_category.
Categories: electronics, clothing, books, home, sports.

Black Friday:
  70% of all writes: category = "electronics" (everyone buying phones/laptops)
  
Cassandra node for "electronics" partition:
  Write rate: 200,000 writes/second → one node
  Other nodes: 10,000 writes/second → four nodes
  
Electronics node: CPU 100%, disk I/O saturated, GC pauses every 5 seconds
During GC pauses: read timeouts, write timeouts
Coordinator: timeouts → hinted handoff backlog grows → memory pressure
Node begins dropping writes: "Write timeout: timed out waiting for response"

Other nodes: completely idle. System has capacity but can't use it.

Root cause: Low-cardinality partition key (5 categories for 5M products/day)

Fix applied after incident:
  Partition key: (product_category, shard_id) where shard_id = hash(product_id) % 100
  → 5 × 100 = 500 partitions → evenly distributed
  → Each node handles a proportional share of "electronics" traffic
  
Prevention: Cassandra nodetool cfstats — monitor per-partition read/write rates.
  Alert if any partition gets 10× average per-node throughput.
```

### Scenario 2: MongoDB Unbounded Array Document Bloat

```
Social platform stores all comments in the post document:
  {postId: "p123", comments: [{...}, {...}, ...]}

A viral post accumulates 100,000 comments over 2 years.
Document size: 100,000 × 500 bytes = 50MB → EXCEEDS MongoDB 16MB limit.
  → writes to the post fail: "Document size exceeds 16MB limit"
  → post becomes read-only effectively (can't add comments)

Investigation: no document size monitoring, no alert until user reports "can't comment"

Emergency fix: migrate comments to a separate collection.
  1. Extract comments from the document into a new "comments" collection.
  2. Update application to query comments separately.
  3. Remove comments array from posts documents.
  
This migration was unplanned and took 3 days under live traffic.

Prevention:
  1. Design: never embed unbounded arrays. Use reference + separate collection.
  2. Monitor: db.collection.stats() → avgObjSize, maxSize. Alert if approaching 12MB.
  3. Operational check: query for large documents regularly.
```

---

## Performance Considerations

### Cassandra Read Performance — The Consistency Level vs Latency Trade-off

```
6-node cluster, RF=3, cross-AZ (2 nodes per AZ):

Consistency Level ONE (any 1 of 3 replicas):
  Latency: p50=0.5ms, p99=2ms
  Availability: survives 2 replica failures
  Consistency: stale reads possible (up to seconds of lag)

Consistency Level LOCAL_QUORUM (2 of 3 in same DC):
  Latency: p50=1ms, p99=4ms
  Availability: survives 1 replica failure per DC
  Consistency: near-consistent within DC

Consistency Level ALL (3 of 3 replicas):
  Latency: p50=2ms, p99=15ms (must wait for slowest replica)
  Availability: ANY replica failure → read fails
  Consistency: fully consistent within DC

Practical guide:
  User-facing reads (profile, feed): LOCAL_ONE or LOCAL_QUORUM
  Financial writes (billing, payments): LOCAL_QUORUM minimum
  Cross-DC consistency needed (DR guarantees): QUORUM (cross-DC)
```

### DynamoDB Cost Optimization

```
On-demand vs Provisioned capacity:
  100M reads/day: 100M × $0.25 per million = $25/day on-demand
  vs: 100M/86,400 = 1,157 RCU × 24h = 27,778 RCU-hours
      27,778 × $0.00013/RCU-hour = $3.61/day provisioned (7× cheaper!)

DynamoDB Accelerator (DAX): in-memory caching layer
  Cache hit: microsecond reads (vs 1-10ms DynamoDB)
  Cost: DAX cluster from ~$0.20/hour
  Use when: read-heavy workload with repeated hot key reads (e.g., product catalog)

Attribute projection in GSI: only project needed attributes
  Full projection: copies entire item to GSI (expensive if large items)
  Keys-only projection: only PK + SK + GSI keys (minimal cost)
  Include projection: specify only needed attributes
  
  Cost of over-projection: each GSI write costs 1 WCU per 1KB of projected data
  Item size: 5KB → full projection GSI = 5 WCU per write
  Keys-only GSI = 1 WCU per write → 5× cheaper
```

---

## Trade-offs

| Characteristic | Cassandra | MongoDB | DynamoDB |
|---------------|-----------|---------|----------|
| Data model | Wide-column | Document | Key-value + Document |
| Write throughput | ★★★★★ (LSM-Tree) | ★★★★ (B-Tree) | ★★★★★ (managed) |
| Read throughput | ★★★ (multi-SSTable) | ★★★★ (B-Tree, indexes) | ★★★★★ (managed, DAX) |
| Consistency | Tunable (ONE-ALL) | Tunable (readConcern) | Eventual / Strong |
| Transactions | LWT (limited) | Multi-doc (replica set) | TransactWriteItems |
| Query flexibility | Low (must match PK) | High (aggregation, $lookup) | Low (PK + GSI) |
| Operational complexity | High (cluster tuning) | Medium (Atlas managed) | Low (fully managed) |
| Schema flexibility | Low (schema required) | High (schemaless) | High (schemaless beyond PK) |
| Max item size | Partition-bounded | 16 MB document | 400 KB item |
| Cost model | Fixed (EC2 nodes) | Fixed or Atlas | Pay-per-request / provisioned |
| Best workload | Write-heavy time-series | Document-centric, flexible queries | AWS-native, unpredictable traffic |

---

## Production Considerations

1. **Design for your access patterns, not your data model.** Before writing a single Cassandra table or DynamoDB schema, write down every query the application will make. Every query must be served by a partition key lookup or bounded sort key range. No exceptions in production.
2. **Set TTLs instead of issuing deletes in Cassandra.** Every explicit DELETE creates a tombstone. Tombstones accumulate until compaction cleans them. For time-series data, use TTL on writes and TWCS compaction — zero tombstone accumulation.
3. **Monitor partition sizes in Cassandra.** Use `nodetool cfstats` and Cassandra metrics to alert when any partition exceeds 10 MB. An unbounded growing partition is a time bomb.
4. **Never run a DynamoDB Scan in production.** A Scan reads the entire table. At scale, it is expensive and slow. Every access pattern must be served by a Query (PK + optional SK condition) or a GSI Query. If you find yourself using Scan, redesign the schema.
5. **Index every field you filter on in MongoDB.** MongoDB will happily run a COLLSCAN (collection scan) on an unindexed field. Use `explain("executionStats")` in code review for every new MongoDB query. COLLSCAN on a multi-million document collection = production incident.
6. **Test compaction behavior under write load.** Cassandra compaction is a background process. Under heavy write load, compaction may fall behind, causing read amplification (more SSTables to check). Tune compaction throughput (`compaction_throughput_mb_per_sec`) to keep up with write rate.

---

## Common Beginner Mistakes

1. **Choosing partition key with low cardinality.** `status` (3 values), `region` (5 values), `product_type` (10 values) — all make terrible Cassandra partition keys. The partition key must have high cardinality (millions of distinct values) to distribute data evenly.
2. **Embedding unbounded arrays in MongoDB documents.** "User has posts," "Post has comments," "Group has members" — all have the potential to grow without bound. Reference with a separate collection for any 1-to-many relationship where N can grow large.
3. **Using MongoDB as a key-value store with no indexes.** Calling `db.users.findOne({email: "alice@example.com"})` with no index on `email` does a full collection scan every time. Every field used in a filter must be indexed.
4. **Not setting TTL in Cassandra for time-series data.** Without TTL, old data accumulates forever. Cassandra does not have a built-in "drop rows older than 30 days" mechanism beyond TTL or explicit deletes (which create tombstones).

---

## Common Senior Engineer Mistakes

1. **Using Cassandra ALLOW FILTERING because "it works in testing."** At 10,000 rows in staging, ALLOW FILTERING returns in 5ms. At 10 million rows in production, it takes 30 seconds. The performance is O(table size), not O(result size). It will always fail in production eventually.
2. **Not accounting for DynamoDB's eventually consistent GSI.** A write to the base table propagates to the GSI asynchronously. A read from the GSI immediately after a write may not see the new item. If your access pattern requires reading your own writes via a GSI, you either need to read from the base table (by PK) or accept the eventual consistency window.
3. **Multi-document MongoDB transactions as the default.** Transactions in MongoDB work but add latency and reduce throughput. The correct approach is to design your schema so most operations only touch one document (embed related data). Use transactions only when cross-document atomicity is truly unavoidable.
4. **Cassandra secondary indexes as a substitute for proper modeling.** Cassandra's secondary indexes are local to each node. A query on a secondary index broadcasts to all nodes and collects results — O(nodes × local_result). This works at small scale but degrades with data size and cluster size. Always model with explicit query tables instead.

---

## Architecture Smells

- **Cassandra cluster with `ALLOW FILTERING` in production queries** → full cluster scan → time bomb
- **MongoDB collection with no indexes** → COLLSCAN on every query → will fail at scale
- **DynamoDB with one table per entity type** → N+1 queries, scatter-gather reads, impossible to serve access patterns efficiently
- **Cassandra with no TTL on time-series data + explicit DELETE rows** → tombstone accumulation → read degradation
- **NoSQL database chosen "because SQL is slow"** without identifying the actual bottleneck → the problem was missing indexes, not the wrong database
- **Cassandra partition key = user_id on a 100M user table with 100TB of data** — every user partition potentially gigabytes → unbounded growth, massive GC, compaction issues

---

## Principal Engineer Perspective

The question is never "SQL or NoSQL?" The question is: **"What access patterns does this workload require, and which data model and storage engine makes those access patterns efficient at the required scale?"**

**A Principal Engineer's NoSQL decision framework:**

1. **Identify the write rate.** If it's > 10,000 writes/second sustained, you need either a highly tuned SQL setup (sharded, connection-pooled, write-optimized) or a purpose-built write-optimized NoSQL (Cassandra, DynamoDB). Below 10,000 writes/second, PostgreSQL handles it easily.

2. **Identify the query patterns.** If queries require arbitrary filtering, complex aggregations, JOINs across many relationships — SQL is superior. If every query is "fetch entity by ID" or "fetch time-series for user X" — NoSQL models it more efficiently.

3. **Identify consistency requirements.** Financial data, inventory counts, user balances — need ACID or at least linearizability for write operations. Cassandra (without LWT) and DynamoDB's eventual consistency require careful application-level design to avoid anomalies. Activity feeds, view counts, analytics — eventual consistency is fine.

4. **Identify the team's operational capability.** A self-managed Cassandra cluster requires significant operational expertise: tuning compaction, managing node replacements, capacity planning, tombstone monitoring. DynamoDB is fully managed but has vendor lock-in and query model constraints. MongoDB Atlas is managed with more query flexibility. If the team lacks NoSQL operational experience, managed services reduce risk.

**The most important insight:** NoSQL is not a database that replaces SQL — it is a different shape of data structure that makes some access patterns fast and others impossible. When you choose Cassandra for user events, you are committing to: always querying by user_id (partition key), accepting eventual consistency, and managing tombstones and compaction. These are not afterthoughts — they are the core trade-offs. Make them deliberately.

---

## Architecture Review Questions

1. What are the specific access patterns this NoSQL schema serves? Is every access pattern served by a PK lookup or bounded sort key range?
2. What is the partition key? Does it have high cardinality (millions of distinct values) to avoid hot partitions?
3. Is there any risk of unbounded partition growth? What is the maximum partition size in 5 years?
4. For Cassandra: is TTL set on time-series data? Are explicit DELETEs avoided?
5. For MongoDB: does every query field have an index? Has EXPLAIN been run on every query in the codebase?
6. For DynamoDB: are there any Scan operations? Are GSIs designed around actual access patterns?
7. What is the consistency level for read and write operations? Is it sufficient for the data's correctness requirements?
8. What happens when a Cassandra node fails? Does the system degrade gracefully at the configured consistency level?
9. Is ALLOW FILTERING used anywhere in Cassandra queries? If so, what is the remediation plan?
10. Is there a monitoring strategy for partition size, tombstone count (Cassandra), document size (MongoDB), and hot key detection (DynamoDB)?

---

## Visual / Animation Specification

### Animation 1: Cassandra Consistent Hashing and RF=3

**Circle (ring) with 6 labeled nodes equally spaced: A, B, C, D, E, F.**

**Step 1:** Arrow "Write: user:789" → hash function → pointer lands between B and C on the ring.
"Token: 27,456 → Primary: Node B"

**Step 2:** Three arrows fan out from Node B clockwise: B (primary), C (replica 1), D (replica 2). All three colored orange (write in flight).

**Step 3:** B and C turn green (ACK received). D stays orange (still writing). "QUORUM met (2 of 3)." Client receives success.

**Step 4:** Node B fails (greyed out, X icon). "Node B is down."

**Step 5:** "Read: user:789 at QUORUM." Coordinator contacts C and D (both have the data). Green check. "Read succeeds — 2 of 3 replicas available."

**Caption:** "RF=3: data on 3 nodes. QUORUM: 2 of 3. One failure: system continues."

### Animation 2: Single-Table DynamoDB Design

**Two panels: "SQL mindset (3 tables)" vs "DynamoDB single-table"**

**Left panel — SQL mindset:**
Three separate boxes: Customers table, Orders table, Items table.
"Get customer + orders + items" → 3 arrows → 3 database calls → "3 round trips."

**Right panel — Single table:**
One DynamoDB table shown. Items visible: CUSTOMER#c789/PROFILE, CUSTOMER#c789/ORDER#o123, CUSTOMER#c789/ORDER#o123/ITEM#i001.
"Query: PK=CUSTOMER#c789" → single arrow → all related items returned.
"1 round trip."

**Then:** Access pattern 4 ("all pending orders") demonstrated: GSI query animation — GSI table highlighted, filtered by status=pending → fast result without scanning base table.

**Caption:** "One table, all entity types, all access patterns. The DynamoDB single-table pattern."

---

## Hands-On Tutorial

### Cassandra Schema Design Exercise

```bash
# Start Cassandra (Docker):
docker run -d --name cassandra -p 9042:9042 cassandra:4.1

# Connect:
docker exec -it cassandra cqlsh

# Create keyspace:
CREATE KEYSPACE ecommerce
  WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};
USE ecommerce;

# Design 1: Order events (access: all events for user, in time order)
CREATE TABLE order_events_by_user (
    user_id    UUID,
    event_time TIMESTAMP,
    order_id   UUID,
    event_type TEXT,
    metadata   MAP<TEXT, TEXT>,
    PRIMARY KEY (user_id, event_time)
) WITH CLUSTERING ORDER BY (event_time DESC)
  AND default_time_to_live = 7776000;  -- 90 days

# Insert sample data:
INSERT INTO order_events_by_user (user_id, event_time, order_id, event_type)
VALUES (uuid(), toTimestamp(now()), uuid(), 'ORDER_PLACED')
USING TTL 86400;

# Test access pattern: all events for user (fast)
SELECT * FROM order_events_by_user
WHERE user_id = <user_id>
LIMIT 20;

# Test what DOESN'T work:
SELECT * FROM order_events_by_user
WHERE event_type = 'ORDER_PLACED'
ALLOW FILTERING;
-- This works but is a full scan — never in production

# Correct: create a separate table for this access pattern
CREATE TABLE order_events_by_type (
    event_type TEXT,
    event_time TIMESTAMP,
    user_id    UUID,
    order_id   UUID,
    PRIMARY KEY (event_type, event_time)
) WITH CLUSTERING ORDER BY (event_time DESC)
  AND default_time_to_live = 7776000;

# Monitor tombstones:
SELECT * FROM system.compaction_history;
nodetool cfstats ecommerce.order_events_by_user
# Look for: memtable_switch_count, sstable_count, tombstone_scanned
```

### DynamoDB Single-Table Design

```python
import boto3
from datetime import datetime

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')

# Create table:
table = dynamodb.create_table(
    TableName='EcommerceTable',
    KeySchema=[
        {'AttributeName': 'PK', 'KeyType': 'HASH'},
        {'AttributeName': 'SK', 'KeyType': 'RANGE'}
    ],
    AttributeDefinitions=[
        {'AttributeName': 'PK', 'AttributeType': 'S'},
        {'AttributeName': 'SK', 'AttributeType': 'S'},
        {'AttributeName': 'GSI1PK', 'AttributeType': 'S'},  # for GSI
        {'AttributeName': 'GSI1SK', 'AttributeType': 'S'}
    ],
    GlobalSecondaryIndexes=[{
        'IndexName': 'GSI1',
        'KeySchema': [
            {'AttributeName': 'GSI1PK', 'KeyType': 'HASH'},
            {'AttributeName': 'GSI1SK', 'KeyType': 'RANGE'}
        ],
        'Projection': {'ProjectionType': 'ALL'}
    }],
    BillingMode='PAY_PER_REQUEST'
)

# Write a customer:
table.put_item(Item={
    'PK': 'CUSTOMER#c789',
    'SK': 'PROFILE',
    'name': 'Alice Smith',
    'email': 'alice@example.com',
    'tier': 'premium'
})

# Write an order (with GSI attributes for "get orders by status"):
table.put_item(Item={
    'PK': 'CUSTOMER#c789',
    'SK': f'ORDER#2024-01-15#o123',
    'orderId': 'o123',
    'status': 'pending',
    'total': '99.99',
    # GSI: allow querying all pending orders
    'GSI1PK': 'STATUS#pending',
    'GSI1SK': '2024-01-15T14:30:00Z#o123'
})

# Access pattern 1: Get customer profile
response = table.get_item(Key={'PK': 'CUSTOMER#c789', 'SK': 'PROFILE'})

# Access pattern 2: Get all orders for customer
from boto3.dynamodb.conditions import Key
response = table.query(
    KeyConditionExpression=Key('PK').eq('CUSTOMER#c789') & Key('SK').begins_with('ORDER#')
)

# Access pattern 3: Get all pending orders (via GSI)
response = table.query(
    IndexName='GSI1',
    KeyConditionExpression=Key('GSI1PK').eq('STATUS#pending')
)
```

---

## Failure Injection Lab

### Lab: Tombstone Accumulation and Recovery

```bash
# Cassandra: simulate tombstone accumulation
# Step 1: Create a table and insert 10,000 rows
for i in {1..10000}; do
  cqlsh -e "INSERT INTO ecommerce.order_events_by_user (user_id, event_time, event_type)
            VALUES (a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11, toTimestamp(now()), 'view');"
done

# Step 2: Delete all rows (creates tombstones):
cqlsh -e "DELETE FROM ecommerce.order_events_by_user
          WHERE user_id = a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11;"

# Step 3: Read and observe tombstone scanning (slow):
time cqlsh -e "SELECT * FROM ecommerce.order_events_by_user
               WHERE user_id = a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11;"
# Should be slow — reading through 10K tombstones

# Check tombstone count in logs:
docker logs cassandra | grep "tombstone"

# Step 4: Force compaction to clean tombstones:
docker exec -it cassandra nodetool compact ecommerce order_events_by_user

# Step 5: Re-read (now fast — tombstones compacted away):
time cqlsh -e "SELECT * FROM ecommerce.order_events_by_user
               WHERE user_id = a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11;"

# Lesson: design to avoid deletes in the first place (use TTL).
```

---

## Exercises

**Conceptual:**
1. Explain why Cassandra does NOT provide linearizability even at `QUORUM` consistency level. What property is missing?
2. What is a hot partition in Cassandra? Give two examples of bad partition key choices that cause hot partitions.
3. Why are MongoDB secondary indexes not automatically created for foreign-like relationships? What must you do manually?
4. Explain DynamoDB's single-table design pattern. Why is it recommended over having one table per entity type?
5. What is a Cassandra tombstone? How does tombstone accumulation cause read performance degradation?

**Architecture:**
6. Design a Cassandra schema for an IoT sensor platform that receives 1 million temperature readings per minute from 10,000 sensors. Access patterns: (a) get last 100 readings for a specific sensor, (b) get all readings from sensor X in the last hour. Show partition key, clustering key, and TTL choice.
7. Design a DynamoDB single-table schema for a task management system (projects, tasks, users, assignments). List 5 access patterns and show how each is served.
8. A MongoDB application has a `posts` collection with 50 million documents. The query `db.posts.find({authorId: x, status: "published"}).sort({createdAt: -1})` is taking 30 seconds. Diagnose and fix.

**Quantitative:**
9. Cassandra cluster: RF=3, 9 nodes, 3 AZs (3 nodes per AZ). An item's replicas are in AZ1, AZ2, and AZ3. AZ2 goes completely offline. Which consistency levels can still serve writes? Which can serve reads? Show your work.
10. DynamoDB table in on-demand mode. Your application makes 500K reads/day (average 2KB each) and 100K writes/day (average 1KB each). Estimate the monthly cost. At what daily read volume does switching to provisioned capacity (at $0.00013/RCU-hour) become cheaper?

---

## Solutions

### Exercise 9
RF=3, replicas in AZ1, AZ2, AZ3. AZ2 offline → 2 of 3 replicas available (AZ1 and AZ3).

**Writes:**
- `ONE`: needs 1 replica → AZ1 or AZ3 available → ✅ succeeds
- `LOCAL_QUORUM` (for AZ1 or AZ3): local quorum = ⌈3/2⌉ = 2 replicas in DC. But with cross-AZ RF=3 (one per AZ), LOCAL_QUORUM within a DC-wide cluster = 2 of 3. AZ2 down = 2 available → ✅ succeeds (2 ≥ 2)
- `QUORUM`: needs ⌈3/2⌉ = 2 of 3 globally. AZ1 + AZ3 = 2 → ✅ succeeds
- `ALL`: needs all 3 replicas. AZ2 down → ❌ fails

**Reads** (same logic — quorum math is identical):
- `ONE`: ✅ succeeds (read from AZ1 or AZ3)
- `LOCAL_QUORUM`: ✅ succeeds
- `QUORUM`: ✅ succeeds (2 of 3 available)
- `ALL`: ❌ fails

**Summary:** At QUORUM and below, system survives one full AZ failure. This is the design intent of RF=3 with nodes spread across 3 AZs.

### Exercise 10
Reads: 500K × average 2KB = 1M KB → 1M / 4KB per RCU = **250K RCUs/day**
Writes: 100K × average 1KB → 100K WCUs/day

On-demand monthly cost:
  Reads: 250K × 30 = 7.5M RCUs → 7.5 × $0.25 = **$1.875/month**
  Writes: 100K × 30 = 3M WCUs → 3 × $1.25 = **$3.75/month**
  Total on-demand: **~$5.63/month**

Provisioned capacity:
  Peak reads: 250K/86,400 = ~3 RCU/s → provision 5 RCU (with headroom)
  5 RCU × 24h × 30 days = 3,600 RCU-hours × $0.00013 = **$0.47/month**
  Writes: 100K/86,400 = ~1.2 WCU/s → provision 2 WCU
  2 WCU × 720h × $0.00065 = **$0.94/month**
  Total provisioned: **~$1.41/month** — already 4× cheaper even at this low volume!
  
Provisioned is almost always cheaper for predictable workloads. The break-even for on-demand vs provisioned is when traffic is so unpredictable that you'd over-provision significantly. For steady workloads, provisioned with auto-scaling wins.

---

## Interview Questions

### Beginner
- What is the difference between a SQL database and a NoSQL database?
- What is a partition key in Cassandra/DynamoDB? Why does it matter?
- What is a MongoDB document? How is it different from a SQL row?

### Senior
- Design a Cassandra table for a user activity feed. What partition key and clustering key would you choose? Why?
- What is a tombstone in Cassandra? How does it affect read performance?
- Explain DynamoDB's single-table design. What problem does it solve?
- What is the DynamoDB GSI? How does it differ from a Cassandra secondary index?

### Staff
- A Cassandra cluster has one overloaded node and five idle nodes. What is the most likely root cause and how do you fix it?
- Design the complete schema (all tables) for a real-time analytics platform tracking user events for 100M users, with TTL-based retention of 90 days, using Cassandra.
- Compare Cassandra LWT and DynamoDB conditional writes for implementing optimistic concurrency. What are the trade-offs?

### Principal
- A team wants to migrate their PostgreSQL orders database (1B rows, 10TB) to Cassandra. Walk through the evaluation — what questions must you answer before deciding if the migration is justified?
- Design the data layer for a global ride-sharing app (driver location, ride matching, pricing, receipts) across Cassandra, DynamoDB, MongoDB, and Redis. Justify each choice.
- Your Cassandra cluster's read latency has p99 = 450ms (up from 8ms six months ago). Traffic is the same. Walk through your diagnosis: what do you check, in what order, and what is the most likely root cause at each step?

---

## Summary

NoSQL databases are purpose-built data structures optimized for specific access patterns at horizontal scale, in exchange for reduced query flexibility, weaker consistency, and no cross-entity ACID:

- **Wide-column (Cassandra):** Write-optimized LSM-Tree, eventual consistency by default, query by partition key only, unlimited horizontal scale. Best for time-series, activity feeds, write-heavy workloads. Design: access-pattern-first, high-cardinality partition key, TTL instead of DELETE, TWCS for time-series compaction.

- **Document (MongoDB):** Flexible document model, rich aggregation pipeline, B-Tree indexes, ACID transactions (with overhead). Best for document-centric data, flexible schemas, moderate write rates. Design: embed bounded relations, reference unbounded ones, index every filter field.

- **Key-value/Document (DynamoDB):** Fully managed, unlimited scale, single-digit millisecond latency. Best for AWS-native systems, unpredictable scale. Design: single-table, composite PK+SK, GSIs for alternate access patterns, never Scan.

- **The universal NoSQL methodology:** List all access patterns first. Design the schema to serve them. Denormalize deliberately. Verify every access is a PK lookup or bounded range. Monitor partition sizes, tombstones, document sizes.

---

## What You Should Now Be Able To Explain

- ✅ Why Cassandra's QUORUM is not linearizable — LWT is, but at 10× the cost
- ✅ How to choose partition key, clustering key, and TTL for a Cassandra time-series schema
- ✅ The tombstone accumulation failure mode and how TTL + TWCS prevents it
- ✅ MongoDB's embed vs reference decision with the specific rules for each case
- ✅ DynamoDB single-table design — why all entity types share one table
- ✅ How to evaluate whether to use NoSQL vs SQL based on access patterns and scale

---

## What To Learn Next

**Chapter 14 — Caching: Redis, Memcached, and Cache Design Patterns.** You now know how to store data persistently in relational and NoSQL databases. Chapter 14 covers the layer in front of them: caching. Why caches exist (latency, throughput amplification), how Redis works (in-memory data structure store with persistence options), the cache design patterns (cache-aside, write-through, write-behind), and the failure modes: cache stampede, cache poisoning, cache inconsistency. The chapter where "just add Redis" becomes a principled engineering decision.
