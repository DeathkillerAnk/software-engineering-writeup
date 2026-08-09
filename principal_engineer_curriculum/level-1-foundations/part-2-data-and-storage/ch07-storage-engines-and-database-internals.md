# Chapter 7 — Storage Engines and Database Internals

## Difficulty
Advanced

## Importance
**Must Know** — Every architectural decision about databases flows from one fact: how that database stores and retrieves data on disk. The difference between PostgreSQL and Cassandra, between MongoDB and RocksDB, between OLTP and OLAP — all of it is determined by the storage engine. A Principal Engineer who doesn't understand B-Trees and LSM-Trees is making database selection decisions without understanding the physics. This chapter is the foundation for Chapters 8 (Consistency and Consensus), 12 (SQL Databases), 13 (NoSQL), and 14 (Caching).

## Prerequisites
Chapter 1 — Computer Systems (disk I/O, page cache, file descriptors)
Chapter 6 — Message Queues (commit log / append-only log — Kafka's storage model is an LSM-Tree variant)

## Learning Objectives

By the end of this chapter you will be able to:

1. Explain why random I/O is the fundamental enemy of database performance and how storage engines work around it.
2. Describe the B-Tree data structure: its invariants, how it handles reads, writes, and the page split operation.
3. Explain the Write-Ahead Log (WAL) and why it is the basis of durability in nearly every production database.
4. Describe the LSM-Tree architecture: MemTable → SSTable → compaction, and why it converts random writes to sequential writes.
5. Compare B-Tree and LSM-Tree access patterns: when each wins and when each loses.
6. Explain how database indexes work: clustered vs non-clustered, composite indexes, covering indexes.
7. Describe MVCC (Multi-Version Concurrency Control) and how it enables non-blocking reads.
8. Explain the buffer pool / page cache and its role in database performance.
9. Choose the right storage engine for a given workload based on its physical characteristics.

## Why This Matters

When someone asks "should we use PostgreSQL or Cassandra?" the answer is not "it depends" without explanation. The answer is:

- PostgreSQL uses a B-Tree storage engine — optimized for random reads, mixed reads/writes, ACID transactions
- Cassandra uses an LSM-Tree engine — optimized for write-heavy workloads, sequential disk access, eventual consistency

If your workload is write-heavy (10:1 write-to-read ratio) with large data volumes and simple access patterns, Cassandra's LSM-Tree amortizes the write cost dramatically. If your workload is read-heavy with complex queries and strong consistency requirements, PostgreSQL's B-Tree provides better read performance and transactional semantics.

That is a physics-based answer. Making it requires understanding the internals.

---

## Mental Model

> **Every database storage engine is solving the same fundamental problem: disk is 1,000× slower than RAM for random I/O but nearly as fast for sequential I/O. B-Trees minimize random reads by organizing data in sorted pages. LSM-Trees minimize random writes by buffering writes in memory and flushing sequentially. Both are correct — they optimize for different workloads. The WAL (Write-Ahead Log) is the universal durability primitive that both use to survive crashes.**

---

## Intuition

Imagine you're managing a giant filing cabinet (your disk) where each drawer is a "page" (4–16 KB).

**Without a storage engine (naive approach):** Every time you add a record, you open a random drawer and stuff it in. Finding any record requires searching every drawer. 10,000 records = 10,000 drawer opens = slow.

**B-Tree approach (PostgreSQL):** The cabinet is organized like an index — the top drawer has a guide ("A-M in left side, N-Z in right side"). Each guide narrows the search. Finding a record takes log(N) drawer opens. But inserting a record in the middle of a sorted cabinet sometimes requires shuffling entire drawers to make room (page splits) — expensive.

**LSM-Tree approach (Cassandra, RocksDB):** You never insert into the middle of the cabinet. You have a desk (MemTable). You write everything to the desk first. When the desk fills up, you dump it into a new drawer at the back of the cabinet in perfectly sorted order (SSTable flush). Periodically you merge and reorganize the drawers (compaction). Writes are always sequential. But reads may need to check multiple drawers if the key is distributed across them.

**Write-Ahead Log (WAL):** Before touching any drawer, you write a note to a special notebook at the front. If the power cuts out, you replay the notebook to recover. The notebook is always written sequentially — fast.

---

## Visual Explanation

### Disk I/O: The Fundamental Constraint

```
Storage Hierarchy (modern server):
┌──────────────────────────────────────────────────────────────────────┐
│ Level     │ Size        │ Latency      │ Throughput (seq) │ IOPS     │
├───────────┼─────────────┼──────────────┼──────────────────┼──────────┤
│ L1 Cache  │ 32-64 KB    │ 0.3 ns       │ —                │ —        │
│ L2 Cache  │ 256 KB-1 MB │ 3 ns         │ —                │ —        │
│ L3 Cache  │ 8-64 MB     │ 10 ns        │ —                │ —        │
│ DRAM      │ 16-512 GB   │ 60-100 ns    │ 50 GB/s          │ —        │
│ NVMe SSD  │ 1-8 TB      │ 20-100 µs    │ 7 GB/s           │ 1M IOPS  │
│ SATA SSD  │ 1-8 TB      │ 100-200 µs   │ 500 MB/s         │ 100K IOPS│
│ HDD       │ 1-20 TB     │ 5-10 ms      │ 150 MB/s         │ 150 IOPS │
└───────────┴─────────────┴──────────────┴──────────────────┴──────────┘

Key insight:
  HDD random read: 5-10 ms (seek time + rotational latency)
  HDD sequential read: 150 MB/s → reading 4KB page sequentially: 0.026 ms
  Random I/O is 200-400× slower than sequential I/O on HDD
  NVMe SSD narrows this gap but sequential is still 5-10× faster than random
```

### B-Tree Structure

```
B-Tree (branching factor B=4, depth 3):

Root Page:
┌────────────────────────────────────────┐
│  [ptr][20][ptr][50][ptr][80][ptr]      │
└──┬─────────┬─────────┬─────────┬──────┘
   │         │         │         │
   ▼         ▼         ▼         ▼
Internal pages (one level):
┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐
│10│15  │  │25│35  │  │55│65  │  │85│90  │
└───────┘  └───────┘  └───────┘  └───────┘
   │           │           │           │
   ▼           ▼           ▼           ▼
Leaf pages (actual data rows):
┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐
│ Rows  │  │ Rows  │  │ Rows  │  │ Rows  │
│ 10,15 │◄─▶│ 25,35 │◄─▶│ 55,65 │◄─▶│ 85,90 │
└───────┘  └───────┘  └───────┘  └───────┘
              (leaf pages linked for range scans)

Properties:
  - All values stored in leaf pages
  - Internal pages contain only keys + pointers
  - Leaf pages linked in sorted order (range scan: follow links, no backtracking)
  - Depth = O(log_B(N)) — with B=200 (real PostgreSQL), 100M rows = depth 3-4
  - Read: O(log_B(N)) page reads
  - Write: Find leaf, update in place (may cause page split)
```

### LSM-Tree Structure

```
LSM-Tree (LevelDB/RocksDB/Cassandra model):

WRITES:
  New write ──▶ WAL (sequential write to disk) ──▶ MemTable (sorted in-memory)

  MemTable fills up (e.g., 64MB):
    Freeze current MemTable → becomes Immutable MemTable
    Start fresh MemTable for new writes
    Background thread flushes Immutable MemTable to disk as SSTable (Level 0)

READS:
  Read key K:
    1. Check MemTable (in-memory, fast)
    2. Check Immutable MemTable (if exists)
    3. Check Level 0 SSTables (newest first, may overlap)
    4. Check Level 1 SSTables (no overlap within level, binary search)
    5. Check Level 2 SSTables
    ...

DISK LAYOUT:
  Level 0 (L0):  [SST1][SST2][SST3][SST4]   (may overlap, up to 4-8 files)
  Level 1 (L1):  [     ][     ][     ] ...   (no overlap, sorted key ranges)
  Level 2 (L2):  [   ][   ][   ][   ] ...   (10× larger than L1)
  Level 3 (L3):  [  ][  ][  ][  ][  ] ...   (10× larger than L2)

COMPACTION (background):
  Merge L0 → L1: Sort and merge L0 files with L1 files → new L1 files (no overlaps)
  Merge L1 → L2: Similarly tiered
  Old versions discarded, tombstones applied (deletes)
```

---

## Core Concepts

### 1. The Page — The Universal Unit of I/O

All database storage engines operate on **pages** (also called blocks). A page is a fixed-size chunk of disk — typically 4 KB, 8 KB, or 16 KB.

**Why pages?**
- Disk I/O is not byte-addressable — minimum read/write unit is a page.
- The OS page cache (virtual memory) manages memory in pages.
- Reading one byte from disk costs the same as reading an entire 4KB page.
- Storage engines exploit this: pack as much useful data into one page as possible.

**PostgreSQL page layout (8KB):**
```
┌──────────────────────────────────────────┐
│ Page Header (24 bytes)                   │
│   LSN (Log Sequence Number), checksum    │
├──────────────────────────────────────────┤
│ Item Pointers (4 bytes each)             │
│   Array of (offset, length) for each row │
├──────────────────────────────────────────┤
│                                          │
│         Free Space (grows from both ends)│
│                                          │
├──────────────────────────────────────────┤
│ Row Data (tuples, packed from the end)   │
│   Row N-1 │ Row N-2 │ ... │ Row 1 │Row 0│
└──────────────────────────────────────────┘
```

The page header contains the LSN — the position in the WAL of the last change applied to this page. This is critical for crash recovery.

### 2. The Write-Ahead Log (WAL)

The WAL is the universal durability primitive. Before any change is applied to a data page, a record describing the change is appended to the WAL (a sequential log file on disk).

**WAL record for an UPDATE:**
```
LSN: 45,678,901
Transaction ID: 12345
Operation: UPDATE
Table: orders
Page: 1043
Offset: 144
Before: {order_id=99, status="pending", amount=50.00}
After:  {order_id=99, status="shipped", amount=50.00}
```

**The durability guarantee:**
```
Write process:
  1. Write WAL record to WAL buffer (memory)
  2. fsync() WAL buffer to disk ← DURABILITY POINT
     (fsync forces OS to flush disk write-back cache to actual storage)
  3. Apply change to data page (in buffer pool, may not be on disk yet)
  4. Return "success" to client

Crash recovery:
  On restart, read WAL from last checkpoint to end:
    - For COMMITTED transactions: redo any changes not yet on disk
    - For UNCOMMITTED transactions: undo (roll back) any partial changes
  Database is consistent at the end of recovery
```

**Why WAL enables performance:** Data pages can be written to disk lazily (in the background by a checkpointer process). Only the WAL must be durable before acknowledging a commit. WAL writes are sequential (always append) — fast. Data page writes are random but can be deferred and batched.

**Group commit:** If many transactions commit at nearly the same time, one `fsync()` can durably commit all of them. This amortizes the expensive `fsync()` cost across multiple transactions — a critical optimization for high-throughput OLTP.

### 3. The B-Tree in Depth

The B-Tree is the dominant data structure for storage engines that handle mixed read/write workloads (PostgreSQL, MySQL InnoDB, SQLite, LMDB).

#### B-Tree Properties

A B-Tree of order B satisfies:
- Every node except the root has between ⌈B/2⌉ and B children
- The root has between 2 and B children (or is a leaf)
- All leaves are at the same depth
- Keys within each node are sorted
- For key K in internal node: all keys in the left subtree < K < all keys in the right subtree

**Real-world numbers (PostgreSQL):**
- Page size: 8 KB
- Key + pointer in index page: ~40 bytes
- Fanout (B): 8,192 / 40 ≈ **200 children per internal page**
- At depth 4: 200⁴ = 1.6 billion index entries fit in 4 I/Os from root to leaf

This is why B-Tree indexes are "shallow" — typical production databases have 3–5 levels regardless of data size.

#### Page Splits — The Expensive Write Path

When a leaf page is full and a new key must be inserted:

```
Before split (leaf page full):
┌─────────────────────────────────────────┐
│ Key: 10, 15, 20, 25, 30, 35 (FULL)     │
└─────────────────────────────────────────┘

Insert key=22:
1. Allocate a new page
2. Move upper half of keys to new page:
   Old page: 10, 15, 20
   New page: 25, 30, 35
3. Insert 22 into old page:
   Old page: 10, 15, 20, 22
4. Promote the median key (25) up to parent
5. Parent must insert the promoted key (may itself split → cascading splits)

After split:
┌──────────────────┐   ┌──────────────────┐
│ Key: 10,15,20,22 │   │ Key: 25,30,35    │
└──────────────────┘   └──────────────────┘
                ↑ Parent now has one more key pointing to both pages
```

**Cost of splits:**
- WAL records for the split (before the physical change)
- 2+ page writes (old page + new page + parent page update)
- Lock escalation (parent page may need to be locked to insert promoted key)

**Write amplification in B-Trees:** For every logical write (one row update), multiple pages may be read and written (the data page + potentially parent pages on splits + WAL). For a heavily fragmented table, write amplification can be 10–30×.

**Defragmentation (VACUUM):** PostgreSQL's VACUUM reclaims space from dead rows (old versions under MVCC), rebuilds index pages to reduce fragmentation, and updates the visibility map. Without regular VACUUM, a heavily written table bloats on disk.

### 4. The LSM-Tree in Depth

The LSM-Tree (Log-Structured Merge-Tree) is the engine behind RocksDB, LevelDB, Cassandra (SSTables), HBase, InfluxDB, and many others.

#### The MemTable

The MemTable is an in-memory, sorted data structure (typically a skip list or red-black tree). All writes go to:
1. The WAL (for durability)
2. The MemTable (for fast in-memory access)

```java
// Conceptually:
write(key, value):
    wal.append(key, value)         // Sequential disk write: fast (< 0.1ms)
    wal.fsync()                    // Durability guarantee
    memtable.put(key, value)       // In-memory sorted insert: O(log N)

// No random disk I/O during writes at all!
```

**MemTable size:** Typically 64 MB – 512 MB. When it fills:
1. The current MemTable is frozen (becomes immutable)
2. A new empty MemTable takes over incoming writes (no write stall)
3. A background thread flushes the immutable MemTable to disk as an **SSTable**

#### The SSTable (Sorted String Table)

An SSTable is an **immutable**, sorted file on disk:

```
SSTable structure:
┌────────────────────────────────────────────────────────────────┐
│ Data Blocks (sorted key-value pairs, grouped into 4KB blocks)  │
│  Block 1: [user:001, "Alice"] [user:002, "Bob"] [user:003,...] │
│  Block 2: [user:004, "Dave"]  [user:005, "Eve"] ...           │
│  ...                                                           │
├────────────────────────────────────────────────────────────────┤
│ Index Block (sparse index: one entry per data block)           │
│  Block 1 starts at: user:001                                   │
│  Block 2 starts at: user:004                                   │
│  ...                                                           │
├────────────────────────────────────────────────────────────────┤
│ Bloom Filter (probabilistic: "is key K in this SSTable?")      │
│  Returns: definitely NOT present / possibly present            │
├────────────────────────────────────────────────────────────────┤
│ Metadata Block (SSTable level, key range, creation time)       │
└────────────────────────────────────────────────────────────────┘
```

**Bloom Filter:** A space-efficient probabilistic data structure.
- "Is `user:999` in this SSTable?" → Bloom filter: "NO" → skip the SSTable entirely (save disk I/O)
- "Is `user:001` in this SSTable?" → Bloom filter: "MAYBE" → read the SSTable to confirm
- False positive rate: tunable (e.g., 1% false positives with ~10 bits per key)

Without Bloom filters, every read would need to check every SSTable — O(N SSTables) disk reads. With Bloom filters, only SSTables that plausibly contain the key are read — dramatically reducing read I/O.

#### Compaction — Converting Random Reads to Sequential Writes

As more SSTables accumulate, reads get slower (must check more SSTables). Compaction merges multiple SSTables into one, discarding old versions:

```
Before compaction (Level 0, multiple overlapping SSTables):
  SST1: user:001="Alice_v1"  user:005="Eve_v1"
  SST2: user:001="Alice_v2"  user:003="Charlie_v1"
  SST3: user:003="Charlie_v2" user:007="Grace_v1"

After compaction (merge sort, keep only latest version):
  SST_merged: user:001="Alice_v2"  user:003="Charlie_v2"
              user:005="Eve_v1"    user:007="Grace_v1"

Tombstones (deletes) are applied during compaction:
  SST4: user:005=TOMBSTONE
  After compaction: user:005 is gone (tombstone + Eve_v1 both discarded)
```

**Compaction strategies:**

| Strategy | How | Best for | Trade-off |
|----------|-----|---------|----------|
| **Size-Tiered (STCS)** | Merge SSTables of similar size | Write-heavy; low write amplification | High space amplification (2× data during compaction); read amplification |
| **Leveled (LCS)** | Maintain strict size limits per level, no overlaps within a level | Read-heavy; low space/read amplification | High write amplification (~10–30×) |
| **FIFO** | Delete oldest SSTables when size limit exceeded | Time-series (data expires naturally) | Data loss (just drops old data) |

**Write amplification in LSM-Trees:** Every byte written once to the MemTable may be rewritten multiple times during compaction as data moves from L0 → L1 → L2 → L3. With leveled compaction, write amplification is 10–30×. This accelerates SSD wear.

**Space amplification:** During compaction, the old SSTables and new merged SSTable coexist temporarily — up to 2× space. Tombstones also consume space until compaction removes them.

### 5. B-Tree vs LSM-Tree: The Physics-Based Comparison

```
┌──────────────────────────┬──────────────────────────────┬──────────────────────────────┐
│ Characteristic           │ B-Tree                       │ LSM-Tree                     │
├──────────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ Write path               │ Read-modify-write on page    │ Append to WAL + MemTable     │
│ Write I/O type           │ Random                       │ Sequential                   │
│ Write amplification      │ 5-15× (page + WAL + splits) │ 10-30× (compaction)          │
│ Read path                │ O(log N) page reads          │ Check MemTable + SSTables    │
│ Read I/O type            │ Random (page lookup)         │ Sequential (SSTable scan)    │
│ Read amplification       │ Low (1 path)                 │ High (must check N levels)   │
│ Space amplification      │ ~2× (free space in pages)   │ 1.1-2× (during compaction)   │
│ Range scan               │ Excellent (linked leaves)    │ Good (sorted within SSTable) │
│ Point lookup             │ Excellent                    │ Good (with Bloom filters)    │
│ Delete semantics         │ In-place (page rewrite)      │ Tombstone (lazy delete)      │
│ Best workload            │ Read-heavy, mixed OLTP       │ Write-heavy, time-series     │
│ Examples                 │ PostgreSQL, MySQL, SQLite     │ Cassandra, RocksDB, HBase    │
└──────────────────────────┴──────────────────────────────┴──────────────────────────────┘
```

**The break-even point:** Research (from the "Dostoevsky" paper from Harvard) shows LSM-Trees outperform B-Trees when the write-to-read ratio exceeds ~4:1. Below that, B-Trees win on read performance.

### 6. Database Indexes

An index is a separate data structure that allows the database to find rows without a full table scan.

#### Clustered vs Non-Clustered (Heap) Index

**Clustered index (InnoDB default, PostgreSQL with CLUSTER):**
The table data rows are physically stored in the index itself (in the leaf pages). There is only one clustered index per table (typically the primary key).

```
Clustered B-Tree (InnoDB primary key):
  Leaf page: [PK=1, row data...] [PK=2, row data...] [PK=3, row data...]
                ↑ The actual row is HERE in the index leaf

Lookup by PK: 1 B-Tree traversal → row data directly. Fast.
Lookup by email (secondary index): 2 traversals:
  1. Secondary index B-Tree: find PK for email
  2. Primary B-Tree: look up row by PK (extra step = "double dip")
```

**Non-clustered index (heap table, PostgreSQL default):**
Table data is stored separately (the heap). Indexes contain key + a pointer (TID/ROWID) to the heap location.

```
Heap file (PostgreSQL):
  Page 1: [Row A at (1,0)] [Row B at (1,1)] [Row C at (1,2)]
  Page 2: [Row D at (2,0)] ...

Index on email:
  Leaf: [alice@example.com → (1,0)] [bob@example.com → (1,2)] ...

Lookup by email:
  1. Index B-Tree: find TID for email → (1,2)
  2. Fetch heap page 1 at offset 2 → Row C (one random I/O)
```

**Index-Only Scan (covering index):** If the index contains all columns the query needs, the heap page doesn't need to be fetched. This eliminates the second I/O:

```sql
-- Covering index: (user_id, email, name) on users table
SELECT email, name FROM users WHERE user_id = 42;
-- Index contains user_id, email, name → no heap fetch needed
-- Index-only scan: 1 B-Tree traversal, 0 heap reads
```

#### Composite Indexes and Selectivity

```sql
-- Composite index: (status, created_at) on orders table
CREATE INDEX idx_orders_status_created ON orders(status, created_at);
```

**Left-prefix rule:** This index can satisfy queries on:
- `WHERE status = 'pending'` ✓ (leftmost column)
- `WHERE status = 'pending' AND created_at > '2024-01-01'` ✓ (full composite)
- `WHERE created_at > '2024-01-01'` ✗ (rightmost column alone — can't use index)

**Column order matters:** Put the most selective column first (fewest distinct values? no — most selective = highest cardinality). Put the column used in equality conditions before range conditions:
```sql
-- Query: WHERE status = 'pending' AND created_at > '2024-01-01'
-- Good: index on (status, created_at) → equality on status narrows B-Tree, range on created_at scans within that subset
-- Bad: index on (created_at, status) → range on created_at can't narrow using status
```

**Index selectivity:** The fraction of rows a predicate eliminates. An index on `gender` (2 values) has low selectivity — the database may prefer a full table scan (scanning 50% of rows is faster than 50% of index lookups + heap fetches). An index on `user_id` (millions of unique values) has high selectivity — always useful for point lookups.

### 7. MVCC — Multi-Version Concurrency Control

MVCC allows readers and writers to operate simultaneously without blocking each other. Instead of locking rows being read, the database maintains multiple versions of each row.

**How PostgreSQL implements MVCC:**

Every row (tuple) has two system columns:
- `xmin`: Transaction ID that created this row version
- `xmax`: Transaction ID that deleted/updated this row version (0 if still current)

```
Timeline:
  T=1: INSERT user (id=1, name="Alice")
       Row: {id=1, name="Alice", xmin=100, xmax=0}

  T=2: UPDATE user SET name="Alicia" WHERE id=1
       Old row: {id=1, name="Alice",  xmin=100, xmax=200}  ← marked dead
       New row: {id=1, name="Alicia", xmin=200, xmax=0  }  ← new version

  T=3: Transaction 300 reads user id=1 (started before T=2 committed)
       Sees: name="Alice" (xmax=200, but TXN 300 started before TXN 200)
       
  T=4: Transaction 400 reads user id=1 (started after T=2 committed)
       Sees: name="Alicia" (latest committed version)
```

**Snapshot isolation:** Each transaction reads from a "snapshot" of the database at the start of the transaction. It sees only rows committed before its snapshot was taken. Writers create new row versions; old versions persist for readers that might need them.

**Benefits:**
- Readers never block writers; writers never block readers
- Long-running analytical queries don't block OLTP writes
- Consistent reads without taking locks

**Cost — table bloat:** Dead row versions accumulate until VACUUM reclaims them. A table with heavy UPDATE/DELETE workload that isn't VACUUMed regularly bloats — both disk space and B-Tree index pages fill with dead pointers.

**MVCC in other databases:**
- **MySQL InnoDB:** Stores old versions in a separate "undo log" (not in-place like PostgreSQL)
- **Cassandra:** No traditional MVCC — uses a last-writer-wins (LWW) with timestamp-based reconciliation
- **FoundationDB:** Uses MVCC with optimistic concurrency control

### 8. The Buffer Pool (Buffer Cache)

The buffer pool is the database's own memory cache for disk pages. It sits between the storage engine and the OS.

```
Database Memory Layout:
┌─────────────────────────────────────────────────────────┐
│ Buffer Pool (configured: e.g., 75% of RAM)              │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐             │
│  │ P1  │ │ P2  │ │ P3  │ │ P4  │ │ P5  │ ... (pages) │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘             │
│  Clean pages: matches on-disk content                   │
│  Dirty pages: modified, not yet written to disk         │
└─────────────────────────────────────────────────────────┘

Read path:
  Request for page P:
    Buffer pool lookup (hash table): HIT → return page (no disk I/O)
    Buffer pool lookup: MISS → read from disk → store in buffer pool → return

Write path:
  Modify page P in buffer pool (now "dirty")
  Write WAL record to WAL buffer + fsync (durability)
  Dirty page flushed to disk by background checkpointer (later, batched)
```

**Buffer pool replacement policies:**
- **LRU (Least Recently Used):** Evict the page accessed longest ago. Simple but suffers from sequential scans (a full table scan evicts all hot pages)
- **Clock (LRU approximation):** Circular buffer with reference bits — faster than pure LRU
- **ARC (Adaptive Replacement Cache):** Balances recency and frequency; used by ZFS, some databases

**Sizing the buffer pool:**
```
PostgreSQL: shared_buffers = 25% of RAM (OS page cache handles the rest)
MySQL InnoDB: innodb_buffer_pool_size = 70-80% of RAM
RocksDB: block_cache_size = whatever RAM is available after other needs

Working set: The pages frequently accessed. If working set fits in buffer pool:
  Hit rate → 99%+, near-memory performance
If working set exceeds buffer pool:
  Hit rate drops, performance collapses (disk I/O for most queries)
```

**Buffer pool hit rate** is the single most important metric for database performance:
```
hit_rate = buffer_pool_hits / (buffer_pool_hits + buffer_pool_misses)

PostgreSQL query:
SELECT * FROM pg_stat_bgwriter;  -- checkpoints, buffers written
SELECT * FROM pg_buffercache;    -- current buffer pool state

Target: hit_rate > 99% for OLTP workloads
Below 95%: add RAM or reduce working set size
Below 90%: severe performance degradation expected
```

### 9. Column-Oriented Storage (OLAP)

Row-oriented storage (B-Tree, LSM-Tree) stores all columns of a row together. This is optimal for OLTP (read/write whole rows). It is terrible for analytics.

**The analytics problem:**
```sql
-- Analytical query: average order amount by region, last 30 days
SELECT region, AVG(amount)
FROM orders
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY region;

-- This query reads only: region, amount, created_at
-- But row-oriented storage forces reading: ALL columns per row
-- In a table with 50 columns: 48 columns read and discarded per row
-- If orders table has 1B rows: massive wasted I/O
```

**Columnar storage (Parquet, Apache Arrow, ClickHouse, Redshift, BigQuery):** Stores each column as a contiguous file on disk:

```
Row store (each row is contiguous):
  [id=1, user_id=42, amount=50.00, region="US",  created_at=2024-01-01, status="shipped", ...]
  [id=2, user_id=99, amount=12.50, region="EU",  created_at=2024-01-02, status="pending", ...]

Column store (each column is contiguous):
  id column:         [1][2][3][4]...(1B values)
  user_id column:    [42][99][7][...]
  amount column:     [50.00][12.50][99.99][...]  ← Query reads only this
  region column:     ["US"]["EU"]["US"]["..."]   ← And this
  created_at column: [2024-01-01][2024-01-02]... ← And this
  status column:     ["shipped"]["pending"]...   ← NOT read (not in query)
```

**Benefits of columnar storage:**
1. **I/O reduction:** Only read columns referenced in query — 3 of 50 columns = 6% of data
2. **Compression:** A column has homogeneous data type (all numbers, all strings of similar format) — compresses 5–20× better than mixed-row data (e.g., run-length encoding for `status` with few distinct values)
3. **Vectorized execution:** CPU can apply SIMD instructions on arrays of homogeneous values (e.g., summing 256 doubles in one AVX instruction) rather than extracting fields from heterogeneous row structs

**Column storage is terrible for OLTP:**
- Inserting one row requires writing to N column files (one per column)
- Updating one row requires rewriting multiple column files
- Optimized for append-heavy analytics, not random-write transactional workloads

---

## Step-by-Step Execution

### A Write in PostgreSQL: From SQL to Disk

```
SQL: UPDATE orders SET status='shipped' WHERE order_id=99;

Step 1: Parse & Plan
  Parser: SQL → parse tree
  Planner: choose index scan on (order_id) → fetch page containing order 99

Step 2: Buffer Pool Read
  Check buffer pool for the page containing order_id=99
  HIT: page already in memory (no disk I/O)
  MISS: read page from disk into buffer pool (1 random I/O: ~100µs)

Step 3: Lock Acquisition
  Acquire row-level lock on the row with order_id=99

Step 4: MVCC — Create New Row Version
  Mark current row: xmax = current_transaction_id (now "dead" to future readers)
  Create new row version in the page: {order_id=99, status='shipped', xmin=current_txn, xmax=0}
  If no free space in page: request new page or use VACUUM'd space

Step 5: WAL Write
  WAL record: {LSN=xyz, txn=current, table=orders, page=1043, old_row=..., new_row=...}
  Append to WAL buffer (memory)

Step 6: COMMIT
  Write COMMIT record to WAL buffer
  fsync() WAL buffer to disk  ← DURABILITY POINT (< 1ms for NVMe)
  Release row lock
  Return "UPDATE 1" to client

Step 7: Background Processes (async)
  Checkpointer: periodically flushes dirty buffer pool pages to disk
  Autovacuum: reclaims dead row versions (old xmax'd rows)

Total time: typically 1-5ms for simple OLTP with NVMe SSD and hot buffer pool
```

---

## Deep Dive

### RocksDB — The Universal Embedded Storage Engine

RocksDB (Facebook's fork of LevelDB) is the storage engine embedded in many modern systems:
- **Kafka** (log segment management uses similar sequential append principles)
- **MyRocks** (MySQL with RocksDB backend for write-heavy workloads)
- **TiKV** (distributed key-value store underlying TiDB)
- **CockroachDB** (early versions used RocksDB; now Pebble, their Go rewrite)
- **Flink state backends**

**RocksDB tuning is a discipline in itself:**
```
// Key configuration knobs:
write_buffer_size = 64 MB           // MemTable size before flush
max_write_buffer_number = 3         // Number of MemTables (current + immutable)
level0_file_num_compaction_trigger = 4  // Trigger L0→L1 compaction
target_file_size_base = 64 MB       // SSTable target size
max_bytes_for_level_base = 256 MB   // L1 max size
block_cache = 512 MB                // LRU block cache (like buffer pool)
bloom_filter_bits_per_key = 10      // ~1% false positive rate
compression = LZ4                   // Per-block compression
```

**Write stall:** If compaction can't keep up with write rate (L0 files accumulate faster than they can be compacted), RocksDB throttles or **stalls** writes — all writes pause until compaction catches up. This manifests as a sudden spike in write latency. Tuning compaction parallelism and I/O budgets prevents stalls.

### WAL Modes and Performance Trade-offs

```
PostgreSQL synchronous_commit settings:
  on (default): fsync WAL on commit. Durable. ~1ms latency.
  remote_write:  WAL written to standby but not fsync'd. Faster. Risk: 1 commit loss on standby crash.
  local:         Only local WAL fsync'd, not standby. Fastest. Risk: 1 commit loss on primary crash.
  off:           No fsync. Fastest. Risk: up to wal_writer_delay (200ms) of commits lost on crash.

MySQL InnoDB:
  innodb_flush_log_at_trx_commit=1:  fsync on commit (default, durable)
  innodb_flush_log_at_trx_commit=2:  Write to OS buffer, OS flushes per second. 1 second data loss on OS crash.
  innodb_flush_log_at_trx_commit=0:  Write to buffer, flush per second. 1 second data loss on any crash.
```

**The performance impact of `fsync`:**
- NVMe SSD: fsync latency ≈ 20–100 µs → supports ~10,000–50,000 commits/second
- SATA SSD: fsync latency ≈ 200 µs → supports ~5,000 commits/second
- HDD: fsync latency ≈ 5–10 ms → supports ~100–200 commits/second

This is why "group commit" is so important: if 1,000 transactions commit within the same fsync window, the fsync cost is shared across all 1,000.

---

## Real-World Example

### Why Cassandra Beat PostgreSQL at 1M Writes/Second

**Context:** A time-series IoT platform receiving 1 million sensor readings per second, each row being a fresh insert.

**PostgreSQL with B-Tree:**
```
1M inserts/second:
  Each insert: find leaf page, write new row, update indexes, write WAL
  Random I/O pattern (rows go to various pages based on primary key hash)
  WAL writes: 1M × ~200 bytes = 200 MB/s WAL throughput (sequential — OK)
  Data page writes: 1M × ~8KB (page-level) = 8 GB/s... impossible on any disk
  (Actually: buffer pool absorbs most; checkpointer flushes in background)
  
Real limit: B-Tree index maintenance under 1M insert/sec causes contention
  at the index root pages (many writers competing for the same upper B-Tree
  pages to propagate page splits). Aurora PostgreSQL with sharding maxes at
  ~200-300K inserts/sec before write amplification becomes critical.
```

**Cassandra with LSM-Tree:**
```
1M inserts/second:
  Each insert: WAL append + MemTable in-memory write
  WAL: 200 MB/s sequential write (fine for NVMe)
  MemTable: in-memory, no disk I/O
  Flush (every ~64MB): sequential write of full SSTable to disk

  Disk I/O for inserts: ONLY the WAL + periodic SSTable flushes
  No random writes during inserts at all!
  
Result: Linear horizontal scaling. Each Cassandra node handles ~100-150K 
writes/sec. 7 nodes = 1M writes/sec. Add nodes to scale.
```

This is the physics-based answer to "why Cassandra for write-heavy workloads."

---

## Failure Scenarios

### Scenario 1: Buffer Pool Eviction Storm

```
OLTP database: 64GB RAM, buffer_pool=48GB, hot working set=45GB (fits comfortably)

Analyst runs: SELECT * FROM events; (table is 500GB, not in buffer pool)
Full table scan reads every page in sequence → evicts hot OLTP pages from buffer pool

OLTP hit rate drops: 99% → 40%
Every OLTP query now hits disk: 100µs (NVMe) instead of 100ns (memory)
OLTP latency: 0.5ms → 50ms (100× degradation)
OLTP error rate (timeouts): 0%  → 30%

Fix:
  1. Separate OLAP and OLTP databases (read replica for analytics)
  2. PostgreSQL ring buffer for sequential scans (pg_prewarm, effective_cache_size hints)
  3. MySQL InnoDB buffer pool LRU "young" zone — sequential scans use "old" zone, don't evict hot pages
  4. Columnar store (Redshift, BigQuery) for analytics — separate system entirely
```

### Scenario 2: LSM-Tree Write Stall Under Compaction Debt

```
RocksDB under sustained heavy write load:
  Writes: 500 MB/sec
  Compaction throughput: 200 MB/sec (can't keep up)
  
L0 file count grows: 4 → 8 → 12 → 20 files (threshold=20)
  At 20 L0 files: RocksDB triggers write stall
  All writes blocked until compaction reduces L0 to < 20 files
  
Application: all writes return error or hang
Duration: could be minutes under severe compaction debt

Fix:
  1. Increase compaction threads: max_background_compactions = 8 (use all CPU)
  2. Set compaction I/O rate limit higher
  3. Throttle write rate to sustainable level (match write rate to compaction capacity)
  4. Use tiered compaction for write-heavy workloads (lower write amplification)
  5. Upgrade to faster NVMe storage (compaction is I/O bound)
```

### Scenario 3: PostgreSQL Table Bloat from Missed VACUUM

```
Table: events (10M rows, 5GB)
Update rate: 500,000 rows/day
Autovacuum: disabled (misconfiguration)

After 30 days:
  Dead rows accumulated: 15M dead tuples (30 days × 500,000)
  Table size: 5GB → 22GB (dead rows still occupy space)
  B-Tree index size: 2GB → 8GB (dead pointers in index pages)
  Sequential scan: 4.4× slower (must skip dead rows in pages)
  Vacuum run (to reclaim space): 45 minutes of I/O-intensive work

Emergency VACUUM FULL:
  Rewrites entire table (100% I/O, takes exclusive lock)
  Application downtime during VACUUM FULL

Fix:
  1. Never disable autovacuum on write-heavy tables
  2. Tune autovacuum: autovacuum_vacuum_cost_delay=2ms (less I/O throttling)
  3. Monitor table bloat: pg_stat_user_tables.n_dead_tup / n_live_tup > 20% → alert
```

---

## Performance Considerations

### Index Design Is the Highest-Leverage Optimization

```sql
-- Query: Find recent pending orders for a user
SELECT * FROM orders
WHERE user_id = 42 AND status = 'pending'
ORDER BY created_at DESC
LIMIT 10;

-- Without index: Full table scan → O(N rows)
-- With index on (user_id): Narrow to user's orders, then filter status
-- With index on (user_id, status): Narrow to user's pending orders (much better)
-- With index on (user_id, status, created_at): Covers ORDER BY, no sort needed
-- With INCLUDE (order_id, amount): Covers SELECT, no heap fetch at all

-- Covering index (best):
CREATE INDEX idx_orders_user_status_date
ON orders(user_id, status, created_at DESC)
INCLUDE (order_id, amount);

-- Index-only scan: 0 heap page reads for this query
-- Estimated speedup: 10-1000× vs full table scan depending on data size
```

### The Cost of Too Many Indexes

```
Table: orders (10M rows)
Indexes: 8 secondary indexes

INSERT one row:
  Write to table: 1 page write
  Update 8 indexes: 8 B-Tree traversals + potential 8 page writes
  Write to WAL: 1 WAL record per index update
  Total: 9× the write amplification of having 0 secondary indexes

At 100,000 inserts/second:
  Without extra indexes: 100K WAL records/sec
  With 8 extra indexes: 900K WAL records/sec (effective throughput limit hit sooner)

Principle: Every index speeds reads and slows writes. Index only columns that
           are actually queried. Drop unused indexes. Measure before adding.
```

---

## Trade-offs

| Decision | Benefit | Cost |
|----------|---------|------|
| B-Tree over LSM-Tree | Better read performance, simpler | Higher write amplification under heavy writes |
| LSM-Tree over B-Tree | Lower write latency, sequential writes | Higher read amplification, compaction overhead |
| Clustered index | Faster PK lookup, no heap fetch | Slow inserts on non-sequential PK (UUID anti-pattern) |
| Non-clustered (heap) | Fast inserts, flexible | Double-fetch for non-index-only reads |
| Large buffer pool | High hit rate, fast reads | Less RAM for other processes |
| Columnar storage | 10–100× faster analytics | Terrible for OLTP writes/updates |
| MVCC | Non-blocking reads | Table bloat (dead rows), VACUUM cost |
| `acks=all` + `fsync` | Durability | Higher write latency |
| `synchronous_commit=off` | Lower write latency | Up to 200ms of data loss on crash |
| More indexes | Faster reads for those queries | Slower writes, more storage, more VACUUM work |

---

## Alternatives

| Workload | Recommended Storage Engine | Rationale |
|----------|---------------------------|----------|
| OLTP (mixed) | PostgreSQL (B-Tree), MySQL InnoDB | Proven, ACID, good read/write balance |
| Write-heavy (IoT, logging) | Cassandra, ScyllaDB, InfluxDB | LSM-Tree, horizontal write scaling |
| Analytics | ClickHouse, BigQuery, Redshift, Parquet | Columnar storage, vectorized execution |
| Key-value (cache) | RocksDB, Redis | RocksDB: persistent LSM; Redis: in-memory |
| Graph | Neo4j, Amazon Neptune | Adjacency list storage optimized for traversal |
| Full-text search | Elasticsearch (Lucene) | Inverted index (a specialized B-Tree variant) |

---

## Production Considerations

1. **Monitor buffer pool hit rate.** Alert if below 99% for OLTP. Buffer pool hit rate is the single most predictive metric of database performance degradation.
2. **Never use random UUIDs as clustered index keys.** UUID primary keys scatter inserts randomly across B-Tree pages — every insert is a random write, causing maximum fragmentation. Use `UUID v7` (time-ordered UUIDs), `ULID`, or auto-increment sequences for clustered index keys.
3. **Size buffer pool from working set, not table size.** If the hot working set (frequently accessed pages) is 40GB, the buffer pool must be > 40GB. Total data size is irrelevant if cold data is rarely touched.
4. **Run VACUUM regularly and monitor bloat.** `n_dead_tup / n_live_tup` in `pg_stat_user_tables` > 20% is a bloat warning. `VACUUM ANALYZE` weekly minimum; autovacuum tuned for high-write tables.
5. **Understand your compaction strategy before choosing an LSM-Tree database.** Leveled compaction (Cassandra LCS) is right for read-heavy workloads. Size-Tiered (STCS) is right for write-heavy. Wrong choice = 10× higher write amplification or 10× worse read performance.
6. **Index every foreign key.** Missing FK indexes cause full table scans on every JOIN to the parent table — a common source of O(N²) query performance in production.

---

## Common Beginner Mistakes

1. **Adding an index on every column "just in case."** Every unused index slows writes (WAL records, page writes) and wastes disk. Use `pg_stat_user_indexes.idx_scan = 0` to find unused indexes.
2. **Using `SELECT *` with large rows.** Forces reading full row from heap even when an index exists, bypassing covering index optimizations.
3. **Treating `fsync=off` as safe in development.** Getting used to `fsync=off` performance and then deploying with `fsync=on` to production — and being surprised by the latency difference.
4. **Forgetting that deletes in LSM-Tree databases are tombstones, not actual deletes.** A Cassandra `DELETE` doesn't free space — it writes a tombstone. The space is only reclaimed during compaction. Over-deleting (e.g., deleting time-series data by key) causes tombstone accumulation, degrading read performance until compaction runs.

---

## Common Senior Engineer Mistakes

1. **Not understanding the clustered index anti-pattern with UUIDs.** Migrating from integer IDs to UUIDs and wondering why PostgreSQL insert performance dropped 10×. UUID v4 scatters B-Tree leaf inserts across all pages → random writes → no sequential write benefit.
2. **Setting `shared_buffers` to 75% of RAM in PostgreSQL.** PostgreSQL also uses the OS page cache (the double-buffer). Setting `shared_buffers=75%` leaves 25% for OS, heap files, and connection overhead. Recommended: 25% for `shared_buffers`, rely on OS page cache for the rest. `effective_cache_size` tells the planner how much total cache exists.
3. **Enabling too many Cassandra secondary indexes.** Cassandra secondary indexes are local (per node) — a query on a non-partition-key indexed column broadcasts to all nodes, collecting local index results. Under high cardinality, this is slower than a full scan.

---

## Architecture Smells

- **UUID primary keys on high-write OLTP tables** — random B-Tree writes, fragmentation, slow inserts
- **No query plan review in code review** — `EXPLAIN ANALYZE` should be required for every query touching tables > 1M rows
- **Autovacuum disabled on production PostgreSQL** — guaranteed table bloat, VACUUM FULL emergency downtime eventually
- **Using PostgreSQL for time-series data at scale (> 100M rows/day)** — B-Tree insertion cost, table partitioning helps but TimescaleDB or InfluxDB is the right tool
- **Running analytics queries on the OLTP primary** — buffer pool eviction storms, OLTP latency degradation

---

## Principal Engineer Perspective

Storage engine selection is the most consequential and hardest-to-reverse architectural decision in a distributed system. Migrating from PostgreSQL to Cassandra (or vice versa) requires rewriting data access layers, changing consistency models, migrating terabytes of data, and retraining engineers. Getting it right from the start requires understanding the physics.

**The two questions that determine storage engine selection:**
1. **What is the read-to-write ratio?** If writes dominate (> 4:1), LSM-Tree engines (Cassandra, RocksDB) win. If reads dominate, B-Tree engines (PostgreSQL, MySQL) win.
2. **What is the access pattern?** Point lookups (by primary key), range scans (by time range), full-text search, graph traversals — each favors a different data structure.

**What Principal Engineers see that seniors miss:**

Seniors think about query performance. Principals think about **write amplification** and its downstream effects:
- High write amplification → accelerated SSD wear → surprise hardware failure at 2 years
- High write amplification → higher I/O budget → more expensive hardware/cloud
- High write amplification → compaction contention → write stalls at peak load

Principals also think about **operational failure modes**: what happens when compaction falls behind? When the buffer pool hit rate drops? When VACUUM can't keep up with writes? These are not edge cases — they are predictable consequences of growth.

**The WAL is the single most important primitive in database engineering.** It enables: crash recovery, replication (PostgreSQL streaming replication ships the WAL), point-in-time recovery, logical replication (decoding the WAL for CDC), and online schema changes (pg_repack, gh-ost). Understanding the WAL opens up everything from backup strategies to zero-downtime migrations.

---

## Architecture Review Questions

1. What is the read-to-write ratio for this table/workload? Does the chosen storage engine optimize for the dominant operation?
2. What is the buffer pool hit rate? When was it last measured? What happens to latency if it drops below 95%?
3. What indexes exist on high-traffic tables? When were they last reviewed for usage (`idx_scan` count)?
4. What is the clustered index key? Is it sequential (int/ULID) or random (UUID v4)?
5. For Cassandra/LSM workloads: what is the compaction strategy and has it been validated for the actual workload?
6. How is VACUUM (or equivalent compaction) monitored? Alert thresholds on dead tuple ratio?
7. What is the `fsync`/`synchronous_commit` setting? What is the maximum data loss exposure on a crash?
8. Are analytics queries isolated from the OLTP primary (read replica, separate OLAP store)?
9. What is the estimated write amplification? For SSDs: is the P/E (program-erase) cycle budget within the SSD's rated lifetime?
10. What is the backup strategy? Is WAL archiving enabled for point-in-time recovery (PITR)?

---

## Visual / Animation Specification

### Animation 1: B-Tree Page Split

**Frame 1:** Show a B-Tree leaf page with 7 entries (nearly full). Highlight: "Leaf Page: [10][15][20][25][30][35][40] — FULL."

**Frame 2:** New key "22" arrives. Red highlight on the full page. "No room — split required!"

**Frame 3:** Animate the split: left page keeps [10][15][20][22], right page gets [25][30][35][40]. A new page box appears.

**Frame 4:** Animate the median key (25) floating upward to the parent. Parent page inserts "25" with pointer to right page.

**Frame 5:** Two balanced leaf pages shown. WAL record appears as a scroll: "SPLIT: page 1043 → pages 1043, 2108." "Data written: 3 page writes + 1 WAL record."

### Animation 2: LSM-Tree Write vs B-Tree Write

**Split screen comparison.**

**Left (B-Tree / PostgreSQL):**
- Key "user:5001" arrives
- Animation: traverse root → internal → leaf page (3 disk reads shown as animated arrows to disk)
- Check if page has space: YES. Write row in-place.
- WAL record appended.
- Show disk: random write marker at a middle location in the disk diagram.

**Right (LSM-Tree / Cassandra):**
- Key "user:5001" arrives
- Animation: arrow goes directly to MemTable (memory, instant)
- WAL record appended at the end of WAL file (sequential write, disk marker at far right)
- MemTable fills up: animate flush → new SSTable appears at the bottom of the disk (sequential write, appended at end)
- Show disk: sequential write markers always at the end of the log.

**Footer:** "B-Tree: Random I/O, lower write amplification for small data. LSM: Sequential I/O, enables 1M+ writes/sec."

---

## Hands-On Tutorial

### Observing PostgreSQL Buffer Pool and Index Usage

```sql
-- 1. Check buffer pool hit rate (should be > 99%)
SELECT
  sum(heap_blks_read) AS heap_read,
  sum(heap_blks_hit) AS heap_hit,
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read))::float AS hit_rate
FROM pg_statio_user_tables;

-- 2. Find unused indexes (candidates for removal)
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,           -- Number of index scans (0 = never used)
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- 3. Check table bloat (dead tuple ratio)
SELECT
  relname AS table_name,
  n_live_tup,
  n_dead_tup,
  ROUND(n_dead_tup::numeric / NULLIF(n_live_tup, 0) * 100, 2) AS dead_ratio,
  last_vacuum,
  last_autovacuum
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;

-- 4. Use EXPLAIN ANALYZE to understand query plans
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM orders
WHERE user_id = 42 AND status = 'pending'
ORDER BY created_at DESC
LIMIT 10;

-- Look for: "Index Only Scan" (good), "Seq Scan" (bad on large tables),
-- "Buffers: hit=N read=M" (high read = buffer pool miss)
```

### Observing RocksDB/Cassandra Compaction Stats

```bash
# Cassandra nodetool compactionstats
nodetool compactionstats
# Shows: active compactions, bytes to compact, estimated time remaining
# Alert: if compaction can't keep up → read/write amplification growing

# Check SSTable count per level (too many L0 files = compaction debt)
nodetool tablestats keyspace.table | grep "SSTable"

# RocksDB: check via admin endpoint or LOG file
grep "Compaction" /path/to/rocksdb/LOG | tail -20
# Look for: "L0 files accumulating" or "write stall"
```

---

## Failure Injection Lab

### Lab: Inducing and Observing Buffer Pool Eviction

1. **Setup:** PostgreSQL with `shared_buffers=256MB`. Create a `users` table (100MB, hot) and an `events` table (10GB, cold).
2. **Baseline:** Run 1,000 user lookups. Measure: `EXPLAIN ANALYZE` shows "Buffers: hit=N, read=0" (100% hit rate).
3. **Inject:** Run `SELECT * FROM events` (full 10GB table scan) from a second connection.
4. **Observe:** While scan is running, run user lookups again. Measure hit rate via `pg_statio_user_tables`. Observe hit rate drops and read latency spikes.
5. **Recover:** Wait for scan to finish. Run `pg_prewarm('users')` to reload users table into buffer pool.
6. **Fix:** Add `SET enable_seqscan=off` or use a separate read replica for analytics. See hit rate stabilize.

---

## Exercises

**Conceptual:**
1. Why is sequential I/O faster than random I/O on both HDDs and SSDs?
2. Explain the B-Tree page split process. Why does it sometimes cascade up the tree?
3. What is the Write-Ahead Log? Why must it be written before the data page?
4. Why does Cassandra use a Bloom filter in its SSTable reader?
5. Explain MVCC: how does a read-only transaction see a consistent snapshot without taking any locks?

**Architecture:**
6. You are building a real-time bidding system processing 500,000 bid events per second. Each bid is a simple key-value insert (bid_id, advertiser_id, amount, timestamp). The data is queried only once (to find the winning bid per auction) and then archived after 1 hour. Choose a storage engine and justify based on its physical characteristics.
7. You have a `notifications` table in PostgreSQL with 1 billion rows. The common query is: `SELECT * FROM notifications WHERE user_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 50`. Design the optimal index. Will it be an index-only scan?

**Quantitative:**
8. A PostgreSQL table has 50 million rows, 8KB per page, and a B-Tree index of depth 4 with fanout 200. How many page reads does a point lookup by primary key require? How many page reads does a full table scan require?
9. An LSM-Tree database uses leveled compaction with `max_bytes_for_level_base=256MB` and `level_multiplier=10`. A write generates 1 byte in L0. Estimate the write amplification (how many times that byte is rewritten) as it compacts through L1, L2, and L3.

---

## Solutions

### Exercise 8
B-Tree point lookup: depth = 4 page reads (root → internal 1 → internal 2 → leaf). Actually in PostgreSQL with heap storage: 4 page reads for the index + 1 heap page read = **5 total I/Os**.

Full table scan: 50M rows × 1 row / ~100 rows per page (8KB page, ~80 bytes per row) = **500,000 page reads**. Point lookup is ~100,000× more efficient than a full scan for this query.

### Exercise 9
Write amplification in leveled compaction:
- L0 → L1: A byte in L0 is merged with all overlapping L1 data. L1 size = 256MB. Each L0 file overlaps ~all of L1. Amplification ≈ `level_multiplier` = **10×**.
- L1 → L2: L2 = 2.56GB (10× L1). Each L1 file compacted into L2: amplification ≈ **10×**.
- L2 → L3: L3 = 25.6GB. Amplification ≈ **10×**.

Total write amplification from L0 to L3: **10 × 10 × 10 = 1,000×** in the worst case. In practice, with partial overlaps, real-world write amplification is typically **10–30×** for leveled compaction — still significantly higher than B-Tree's 5–15×. This is the core trade-off: LSM-Trees convert random writes to sequential writes, but at the cost of rewriting data multiple times during compaction.

---

## Interview Questions

### Beginner
- What is a database index? When would you not use one?
- What is the difference between a primary key and a secondary index?
- What happens if a database crashes in the middle of a write?

### Senior
- Compare B-Tree and LSM-Tree storage engines. When would you choose each?
- What is MVCC? How does it enable concurrent reads and writes?
- What is the WAL? Why is `fsync` important?
- What is a "covering index" and when does it help?

### Staff
- Explain why using UUID v4 as a clustered primary key in PostgreSQL hurts write performance.
- Walk through the LSM-Tree compaction process. What is write amplification and how does it affect SSD longevity?
- A PostgreSQL table has grown from 10GB to 80GB over 6 months without any schema changes. What is the most likely cause and how do you fix it?

### Principal
- Design the storage architecture for a financial transaction ledger system that must support: 500,000 inserts/second, sub-5ms read latency for recent transactions, 7-year retention, and point-in-time recovery to any second within the last 30 days. Justify your storage engine choices.
- A Cassandra cluster's read latency has degraded from 2ms to 150ms over 6 months without traffic growth. Diagnose the most likely causes and describe the remediation for each.
- Explain the physical reason why PostgreSQL performs poorly for time-series insert workloads compared to TimescaleDB, even though both use B-Tree indexes. What specific optimizations does TimescaleDB apply?

---

## Summary

Storage engines are the physics layer of distributed systems:

- **The fundamental constraint:** Random I/O is 200–400× slower than sequential I/O on HDDs; 5–10× slower on NVMe SSDs. All storage engine design is an attempt to convert random access patterns into sequential ones.

- **The WAL** is the universal durability primitive. It enables crash recovery, replication, PITR, and CDC. `fsync` on commit is the durability guarantee — everything else is a performance trade-off.

- **B-Trees** (PostgreSQL, MySQL) organize data in sorted, balanced pages. O(log N) reads, in-place writes with page splits, good for mixed OLTP workloads. Write amplification: 5–15×. Suffer from fragmentation under heavy writes (VACUUM required).

- **LSM-Trees** (Cassandra, RocksDB) buffer writes in memory (MemTable), flush to immutable sorted files (SSTables), and periodically compact. Sequential writes always, no random write I/O. Write amplification: 10–30×. Read amplification mitigated by Bloom filters. Suffer from tombstone accumulation and compaction debt.

- **MVCC** enables non-blocking reads by maintaining multiple row versions. Cost: dead tuple accumulation and VACUUM overhead.

- **Buffer pool hit rate** is the single most predictive performance metric. Working set must fit in buffer pool for OLTP performance.

- **Column-oriented storage** (ClickHouse, Parquet, BigQuery) is the correct choice for analytics: reads only queried columns, compresses homogeneous data 5–20×, vectorized CPU execution. Incompatible with OLTP write patterns.

---

## What You Should Now Be Able To Explain

- ✅ Why random I/O is the fundamental performance enemy and how B-Trees and LSM-Trees each address it
- ✅ How the WAL enables crash recovery and why `fsync` is the durability guarantee
- ✅ Why Cassandra handles 1M writes/sec where PostgreSQL struggles (LSM sequential writes vs B-Tree random writes)
- ✅ Why UUID v4 primary keys hurt PostgreSQL insert performance
- ✅ How MVCC enables non-blocking reads and why it creates table bloat
- ✅ The buffer pool hit rate and why it must stay above 99% for OLTP
- ✅ When to use columnar storage vs row storage

---

## What To Learn Next

**Chapter 8 — Consistency, Consensus, and the CAP Theorem.** You now understand how a *single* database stores data reliably. The next question is: what happens when you have *multiple* copies of that data across multiple machines? How do you keep them in sync? What guarantees can you provide when the network between them fails? This chapter covers the fundamental theoretical constraints of distributed data: the CAP theorem, the PACELC model, linearizability, and the Raft and Paxos consensus algorithms that underpin every distributed database, Kafka, and etcd.
