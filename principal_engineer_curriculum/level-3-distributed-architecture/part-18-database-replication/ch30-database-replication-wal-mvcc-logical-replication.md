# Chapter 30 — Database Replication Internals: WAL, Logical Replication, and MVCC at Scale

> **Difficulty:** Advanced | **Importance:** ★★★★★ | **Estimated Reading Time:** 4.5 hours

---

## Prerequisites

- Chapter 7 (Storage Engines — B-tree, LSM, heap files, fsync)
- Chapter 8 (Consistency, CAP Theorem, linearizability)
- Chapter 12 (SQL Databases at Scale — indexes, query plans, ACID)
- Chapter 23 (Distributed Consensus — Raft/Paxos, leader election)
- Chapter 29 (Distributed Caching — CDC via Debezium, why WAL exists)

---

## Learning Objectives

By the end of this chapter, you will be able to:

1. Describe the structure of a PostgreSQL WAL record at the byte level and explain why WAL enables durability without synchronous heap writes
2. Explain the difference between physical and logical replication and when each is appropriate
3. Trace the full lifecycle of a row update through PostgreSQL's MVCC: tuple header fields, visibility rules, dead tuple accumulation, and VACUUM reclamation
4. Calculate replication lag from first principles and identify its three root causes
5. Design a high-availability PostgreSQL topology with zero-downtime promotion and bounded data loss
6. Explain how MySQL binlog-based replication differs from PostgreSQL WAL streaming and the implications for CDC
7. Implement a logical replication slot consumer that handles slot invalidation, WAL bloat, and reconnection
8. Describe how CockroachDB and Google Spanner achieve synchronous multi-master replication using consensus groups

---

## Why This Matters

Every distributed system ultimately bottoms out at persistent state. Whether you're caching with Redis (Chapter 29), building event-driven systems (Chapter 27), or designing microservices with CQRS (Chapter 18), the source of truth is a database — and that database must survive hardware failure, deployment outages, and geographic disasters without losing committed data.

Replication is the mechanism that makes databases survivable. But replication is not a simple "copy data from A to B." It is a deeply intricate interplay between durability guarantees (WAL), concurrency control (MVCC), consistency models (synchronous vs asynchronous replication), and operational procedures (failover, promotion, lag management).

The engineers who truly understand replication internals make qualitatively different architectural decisions:
- They know exactly what data loss is possible when a primary fails
- They understand why logical replication enables cross-version, cross-database-engine migration without downtime
- They know why VACUUM exists, what happens when it fails to run, and why table bloat killed production systems at dozens of companies
- They understand why Spanner's TrueTime solves a problem that PostgreSQL streaming replication fundamentally cannot

These are Staff and Principal Engineer concerns — the kind that determine whether your service survives a data center failure or whether you lose 30 seconds of committed transactions at 2 AM.

---

## Mental Model

***The Write-Ahead Log is the single source of truth for a database's committed state. The heap file (where rows actually live) is a performance cache of the WAL — always reconstructable from the log. Replication is the act of shipping WAL records to other nodes and replaying them. MVCC is the mechanism that lets readers access consistent snapshots of heap data without acquiring locks, at the cost of accumulating dead tuples that VACUUM must periodically reclaim. Every correctness guarantee, every performance characteristic, and every operational failure mode in database replication flows from these three mechanisms.***

---

## Intuition: The Append-Only Ledger

Imagine a bank's accounting system. Every transaction — deposit, withdrawal, transfer — is first written to a permanent, append-only ledger (the Write-Ahead Log). Only after the ledger entry is durable (committed to disk) does the bank update its account balance board (the heap file).

If the bank burns down, the account balance board is destroyed. But the auditors can reconstruct every account's balance by replaying the ledger from beginning to end. The ledger is the truth; the balance board is a derived view.

Replication is like distributing copies of the ledger to branch offices. The branch (replica) replays the ledger entries and maintains its own balance board. If headquarters fails, a branch can be promoted to headquarters — it has the same ledger.

MVCC is like the bank keeping multiple versions of the balance board simultaneously: "what the balance was at 10:00 AM" for a report running since 10:00 AM, while simultaneously updating the board for new transactions. Old versions accumulate (dead tuples) until the end-of-day reconciliation team (VACUUM) discards versions that no ongoing transaction can see.

---

## Visual Explanation: PostgreSQL Write Path

```
PostgreSQL Write Path (UPDATE products SET price=200 WHERE id=42)
─────────────────────────────────────────────────────────────────

                    ┌────────────────────────────────────────────┐
                    │         Backend Process (per connection)   │
                    │                                            │
                    │  1. Parse + Plan query                     │
                    │  2. Find existing row (heap lookup)        │
                    │  3. Create new row version in buffer pool  │
                    │  4. Write WAL record to WAL buffer         │
                    │  5. Mark old row as deleted (xmax field)   │
                    └──────────────┬─────────────────────────────┘
                                   │
                    ┌──────────────▼─────────────────────────────┐
                    │            WAL Buffer (shared memory)      │
                    │                                            │
                    │  [WAL record: UPDATE products id=42        │
                    │   old_ctid=(0,1) new_ctid=(0,47)           │
                    │   xid=7291 lsn=0/1A3F9800]                │
                    └──────────────┬─────────────────────────────┘
                                   │ WAL writer flushes at COMMIT
                    ┌──────────────▼─────────────────────────────┐
                    │         WAL Files (pg_wal/)                │
                    │  000000010000000000000001  (16 MB segment) │
                    └──────────────┬─────────────────────────────┘
                                   │                    │
                     Streaming     │              Logical│ decoding
                     replication   │              (pgoutput plugin)
                    ┌──────────────▼───┐      ┌─────────▼────────────┐
                    │   Standby Node   │      │  Logical Replication  │
                    │  (WAL receiver)  │      │  Slot / Debezium      │
                    └──────────────────┘      └───────────────────────┘

Heap File layout (one 8KB page):
  ┌────────────────────────────────────────────────────────────┐
  │ Page Header (24 bytes)                                     │
  │ ItemId array (4 bytes per slot)                           │
  │ Free space (middle)                                        │
  │ Tuple: (xmin=7290, xmax=7291, price=100) ← dead          │
  │ Tuple: (xmin=7291, xmax=0,    price=200) ← live          │
  └────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### 1. The Write-Ahead Log (WAL): Structure and Purpose

WAL is PostgreSQL's durability mechanism. Before any change is reflected in the heap files, a WAL record describing the change must be flushed to disk. This is the "write-ahead" guarantee: the log is always ahead of, or equal to, the heap.

#### Why WAL Enables Durability Without Synchronous Heap Writes

Without WAL, guaranteeing durability requires fsyncing the entire 8KB heap page before acknowledging every commit. At 100µs per fsync on NVMe, that limits throughput to ~10,000 writes/second with zero concurrency benefit.

With WAL:
1. Append a small WAL record (50–200 bytes) to the WAL file — sequential write
2. fsync the WAL file — one fsync amortized across hundreds of concurrent transactions via group commit
3. Acknowledge the commit
4. The heap file is updated lazily by the background writer

At a WAL segment size of 16 MB and 200-byte average record size, a single fsync covers ~80,000 transactions. This is the performance multiplier that makes databases fast.

#### WAL Record Structure

```
WAL Record (binary format):
┌──────────────────────────────────────────────────────────────────┐
│  XLogRecordHeader (24 bytes)                                     │
│    xl_tot_len   (4 bytes) — total record length                  │
│    xl_xid       (4 bytes) — transaction ID                       │
│    xl_prev      (8 bytes) — LSN of previous record (linked list) │
│    xl_crc       (4 bytes) — CRC32 checksum                       │
│    xl_info      (1 byte)  — resource manager flags               │
│    xl_rmid      (1 byte)  — resource manager (Heap, Btree, XLOG) │
│                                                                  │
│  Block Reference (per modified data page):                       │
│    rnode.spcOid   — tablespace OID                               │
│    rnode.dbOid    — database OID                                 │
│    rnode.relOid   — relation OID                                 │
│    block_id       — page number in relation file                 │
│    forknum        — main=0, FSM=1, VM=2                          │
│    bimg_len       — full-page image length (if FPI)              │
│                                                                  │
│  Data Payload (resource-manager-specific):                       │
│  For HEAP UPDATE:                                                │
│    old tuple offset, xmax of old tuple                           │
│    new tuple data (full or HOT-updated columns only)             │
└──────────────────────────────────────────────────────────────────┘

LSN (Log Sequence Number): 8-byte absolute byte offset from WAL origin
  Format: segment/offset (e.g., 0/1A3F9800)
  Monotonically increasing, globally unique within a cluster
```

**Full-page images (FPI):** On the first modification of a heap page after a checkpoint, PostgreSQL writes the entire 8KB page into the WAL record. This protects against torn writes (partial page writes on OS crash). After `full_page_writes = off` — dangerous unless the hardware guarantees atomic sector writes — FPI are omitted, reducing WAL size 30–50% but risking data corruption.

**HOT (Heap-Only Tuple) updates:** If the updated row fits on the same heap page AND no indexed columns changed, PostgreSQL performs a HOT update: no new index entry is written, and the old tuple's `ctid` points to the new tuple on the same page. This dramatically reduces WAL volume and index bloat for in-place updates of non-indexed columns.

#### WAL File Naming and Rotation

```
WAL files: PGDATA/pg_wal/
  000000010000000000000001   (timeline=1, segment=1)
  000000010000000000000002   (timeline=1, segment=2)
  000000020000000000000003   (timeline=2 — after promotion)

Name breakdown: [8-char timeline][8-char logid][8-char segid]
Default segment size: 16 MB (set at initdb time)

PostgreSQL recycles old segments after checkpoint.
Segments needed by replication slots are RETAINED until
the slot consumer advances its restart_lsn past them.
This is the WAL bloat risk.
```

---

### 2. MVCC: Multi-Version Concurrency Control

MVCC allows readers to access consistent historical snapshots without acquiring row locks, by maintaining multiple versions of each row. Writers create new versions; readers consult the version visible at their transaction's start time.

#### Tuple Header Fields

```c
// src/include/access/htup_details.h (simplified)
typedef struct HeapTupleHeaderData {
    TransactionId t_xmin;     // XID of the inserting transaction
    TransactionId t_xmax;     // XID of the deleting transaction (0 = alive)
    CommandId     t_cid;      // Command ID within transaction
    ItemPointerData t_ctid;   // (page, offset) of this or newer version
    uint16        t_infomask;  // Hint bits (XMIN_COMMITTED, XMAX_COMMITTED, etc.)
    uint8         t_infomask2;
    uint8         t_hoff;      // Offset to user data
    // Null bitmap + row data follows
} HeapTupleHeaderData;
```

**Hint bits** cache visibility results: once PostgreSQL checks the commit status of `t_xmin` or `t_xmax` in the commit log (CLOG/pg_xact), it sets a hint bit in the tuple header so future lookups skip the CLOG. This is a minor but important performance optimization for hot rows.

#### MVCC Visibility Example

```
Transaction history:
  XID 100: INSERT product(id=42, price=100)  → COMMIT
  XID 200: BEGIN (snapshot: committed up to XID 199)
  XID 300: UPDATE product SET price=200      → COMMIT

Heap after XID 300 commits:
  Slot 1: (t_xmin=100, t_xmax=300, price=100, ctid→slot2)  ← old version
  Slot 2: (t_xmin=300, t_xmax=0,   price=200, ctid→self)   ← new version

XID 200 visibility check:
  Slot 1: t_xmin=100 committed before XID 200 started? YES → created before snapshot
           t_xmax=300 committed before XID 200 started? NO  → not yet deleted at snapshot
           Result: VISIBLE to XID 200 → price = 100

  Slot 2: t_xmin=300 committed before XID 200 started? NO → created after snapshot
           Result: NOT VISIBLE to XID 200

XID 200 sees price=100 even though price=200 is committed.
This is Snapshot Isolation — the "I" in ACID.
```

#### Dead Tuple Accumulation

Every UPDATE creates a new tuple version and marks the old with `t_xmax`. Dead tuples:
1. Consume disk space proportional to the update rate
2. Slow sequential scans (dead tuples are traversed and skipped)
3. Bloat indexes (entries pointing to dead tuples accumulate)
4. Block the `oldest_xmin` horizon from advancing (preventing XID freezing)

```
Table: 1 million rows, 10 updates/row/day = 10 million dead tuples/day
Each dead tuple: 100 bytes
Daily dead tuple storage: 10M × 100 = 1 GB/day

Between autovacuum runs (default: triggered when 20% of rows are dead):
  Threshold: 1M rows × 20% = 200,000 dead rows = 200 MB before vacuum fires
  After vacuum: dead tuples marked reusable (space NOT returned to OS)
```

#### VACUUM: Dead Tuple Reclamation

```sql
VACUUM VERBOSE products;
-- INFO: scanned index "products_pkey" to remove 15,234 row versions
-- INFO: "products": removed 15,234 dead row versions in 18 pages
-- INFO: found 15,234 removable, 84,523 nonremovable row versions
--       in 567 out of 2,849 pages
```

**What VACUUM does:**
- Marks dead tuple slots as reusable (no OS disk space returned)
- Removes index entries pointing to dead tuples
- Updates the Free Space Map (FSM) and Visibility Map (VM)
- Advances `relfrozenxid` (freezes old tuples to prevent wraparound)

**What VACUUM does NOT do:**
- Return disk space to the OS (only `VACUUM FULL` does, with an exclusive table lock)
- Run as a single operation atomically (it releases locks between pages for concurrent access)

**Visibility Map:** 1-bit-per-page bitmap. If bit is set, ALL tuples on that page are visible to all active transactions — no dead tuples, VACUUM can skip it. Used by Index-Only Scans to skip heap fetches.

#### XID Wraparound: The Most Catastrophic PostgreSQL Failure

PostgreSQL XID is a 32-bit integer. XIDs are compared modulo $2^{32}$. After $2^{31} \approx 2.1$ billion transactions past a tuple's `t_xmin`, the database considers that XID to be in the "future" — and the tuple becomes invisible. Every row in affected tables returns 0 results. **Total logical data loss without any hardware failure.**

```sql
-- Critical monitoring: XID age across all databases
SELECT datname, age(datfrozenxid) AS xid_age,
       round(age(datfrozenxid)::numeric / 2100000000 * 100, 1) AS pct_of_limit
FROM pg_database
ORDER BY xid_age DESC;

-- Alert at > 1 billion (48% of limit)
-- CRITICAL at > 1.8 billion (86% of limit)

-- Per-table monitoring:
SELECT schemaname, relname, age(relfrozenxid) AS xid_age
FROM pg_class
WHERE relkind = 'r'
ORDER BY age(relfrozenxid) DESC
LIMIT 20;
```

**Prevention:** VACUUM freezes old tuples by replacing `t_xmin` with `FrozenTransactionId` (XID 2), which is always considered "in the past." Configure per-table aggressive vacuum for high-churn tables:

```sql
ALTER TABLE high_churn_events SET (
    autovacuum_vacuum_scale_factor = 0.01,  -- Vacuum at 1% dead (not 20% default)
    autovacuum_vacuum_threshold = 100,
    autovacuum_freeze_max_age = 500000000   -- Force freeze at 500M (not 200M default)
);
```

---

### 3. Physical (Streaming) Replication

Physical replication ships raw WAL byte streams to standbys, which replay them to maintain byte-identical heap files.

#### Architecture and Processes

```
Primary                              Standby(s)
───────                              ──────────
WAL writer → pg_wal/                 WAL receiver process
                 │                          │
                 └──────────────────────────┘
                      TCP streaming (real-time)

Primary background processes:
  WAL writer    — flushes WAL buffer to pg_wal files
  WAL sender    — streams WAL records to connected standbys
  Checkpointer  — flushes dirty buffers, writes checkpoint record
  Background writer — gradually flushes dirty pages between checkpoints
  Autovacuum    — runs VACUUM/ANALYZE as needed

Standby processes:
  WAL receiver  — receives WAL stream, writes to standby pg_wal/
  Startup       — replays WAL records on standby's heap (recovery mode)
```

#### Synchronous vs Asynchronous Replication

```
Asynchronous (default):
  Client → Primary commits + WAL flushed → ACK to client
  Primary WAL sender ships WAL to standby AFTER ACK (background)
  Risk: Primary crash after ACK but before WAL shipped = DATA LOSS
  RPO: 0 - 30 seconds (bounded by replication lag at failure time)

Synchronous (synchronous_commit = on):
  Client → Primary → WAL flushed AND standby acknowledges receipt → ACK
  Zero data loss for committed transactions
  Risk: Sync standby unavailable → primary blocks ALL writes indefinitely
  Write latency increase: +RTT to standby (same DC: +1ms, cross-DC: +50-150ms)

synchronous_standby_names = 'ANY 1 (standby1, standby2)'
  → Wait for ANY 1 of listed standbys (not ALL — avoids single point of block)

synchronous_commit settings:
  off           → No fsync before ACK (data loss on OS crash, not just DB crash)
  local         → fsync on primary only (default-like behavior)
  on            → fsync + sync standby ack
  remote_write  → Standby received (buffered) but not necessarily fsynced
  remote_apply  → Standby has replayed (highest consistency guarantee, highest lag)
```

#### Three Root Causes of Replication Lag

**Cause 1: Network bandwidth saturation**

```
WAL generation at 100 MB/s on a 1 Gbps (125 MB/s) link:
  Available headroom: 25 MB/s
  Burst to 150 MB/s for 10 seconds: lag grows at 50 MB/s × 10s = 500 MB lag
  Recovery time: 500 MB / 25 MB/s = 20 seconds to drain lag

Mitigation:
  wal_compression = lz4    (reduces WAL bandwidth 30-50%)
  Dedicated replication NIC
  Cross-region: 10 Gbps dedicated circuits
```

**Cause 2: Standby replay bottleneck**

The Startup process replays WAL serially (single-threaded in PostgreSQL ≤15). High-frequency small-transaction workloads saturate replay CPU.

```
Mitigation (PostgreSQL 16+):
  max_parallel_apply_workers_per_subscription = 8
  (Previously limited to logical replication subscriptions)
  
For physical replication prior to PG16:
  Use larger transactions to batch WAL records per fsync
  Reduce index count on standby tables (fewer index updates to replay)
```

**Cause 3: Long-running queries on standby block WAL replay**

A query on the standby holds a snapshot that conflicts with VACUUM-related WAL records from the primary. PostgreSQL must either cancel the standby query or pause WAL replay.

```
max_standby_streaming_delay = 30s  → Cancel conflicting standby queries after 30s
hot_standby_feedback = on          → Standby sends oldest XID to primary;
                                     primary's autovacuum skips rows the standby needs
                                     RISK: causes primary table bloat on high-write loads

Best practice:
  hot_standby_feedback=on for analytics replicas with long queries
  hot_standby_feedback=off for HA standbys (clean failover priority)
  max_standby_streaming_delay=30s on analytics replicas
```

#### Measuring Replication Lag

```sql
-- On primary: lag per connected standby
SELECT client_addr, state, sync_state,
       write_lag, flush_lag, replay_lag,
       pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS lag_bytes,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)) AS lag_pretty
FROM pg_stat_replication;

-- On standby: time-based lag (most useful for SLA monitoring)
SELECT now() - pg_last_xact_replay_timestamp() AS replication_lag_time;
```

#### Patroni: Production PostgreSQL HA

Patroni is the industry-standard HA solution (used by Zalando, GitLab, Timescale, AWS internally).

```yaml
# patroni.yml (simplified)
scope: pg-cluster
name: postgres-01

etcd:
  hosts: etcd1:2379,etcd2:2379,etcd3:2379

bootstrap:
  dcs:
    ttl: 30                               # Leader TTL in DCS
    loop_wait: 10                         # Heartbeat interval
    retry_timeout: 30                     # DCS operation timeout
    maximum_lag_on_failover: 10485760     # 10 MB: max lag on promoted standby
    postgresql:
      use_pg_rewind: true
      parameters:
        wal_level: replica
        synchronous_commit: "on"
        synchronous_standby_names: "ANY 1 (postgres-02,postgres-03)"

postgresql:
  listen: 0.0.0.0:5432
  data_dir: /data/postgres
```

**Patroni failover sequence:**

```
T+0:00  Primary (postgres-01) crashes
T+0:10  Heartbeat missed. Standbys watch etcd.
T+0:30  TTL expires. Leader key removed from etcd.
T+0:31  postgres-02 and postgres-03 race to acquire leader key.
         etcd CAS ensures exactly ONE winner.
T+0:31  postgres-02 wins. Writes leader key (new TTL=30s).
T+0:32  postgres-02 calls pg_promote().
T+0:33  Startup process finishes WAL replay. postgres-02 opens for writes.
T+0:34  postgres-03 detects new leader, reconnects as standby to postgres-02.
T+0:35  HAProxy/PgBouncer detect new primary via Patroni REST API (:8008).
T+0:36  Application write connections routed to postgres-02.

Total failover: ~36 seconds
Data loss: 0 seconds (sync replication) or up to lag at T+0:00 (async)

When postgres-01 returns:
  pg_rewind runs: rewinds WAL to timeline branch point, only copies changed blocks
  postgres-01 rejoins as standby to postgres-02
  pg_rewind time: seconds to minutes (vs hours for full base backup)
```

---

### 4. Logical Replication

Physical replication ships raw WAL bytes. Logical replication decodes WAL into high-level row-change events (INSERT/UPDATE/DELETE with column values), enabling:

- Cross-major-version replication (PG14 primary → PG16 subscriber)
- Cross-engine replication (PostgreSQL → Kafka, Redis, Elasticsearch)
- Per-table replication (subset of tables, not entire cluster)
- Row-filtered replication (WHERE clause on publication in PG15+)

#### How Logical Decoding Works

```
WAL record (raw binary):
  {HEAP_UPDATE, block=5, offset=47, new_tuple_data=...}

pgoutput plugin decodes using system catalog (pg_attribute, pg_class):
  → {relation="public.products", op="UPDATE",
     old={id=42, price=100}, new={id=42, price=200}}

PostgreSQL 10+ native logical replication:
  Primary side: PUBLICATION (what to expose)
  Subscriber side: SUBSCRIPTION (where to apply)
  
  CREATE PUBLICATION products_pub FOR TABLE products, orders;
  -- On subscriber:
  CREATE SUBSCRIPTION products_sub
      CONNECTION 'host=primary ...'
      PUBLICATION products_pub;
```

#### Replication Slot Internals and WAL Bloat

```
Slot state in pg_replication_slots:
  slot_name:             my_slot
  plugin:                pgoutput
  restart_lsn:           0/3A2F0000   ← WAL retained FROM here
  confirmed_flush_lsn:   0/3A2F0000   ← Consumer confirmed receipt THROUGH here

Primary MUST retain ALL WAL from restart_lsn forward.
If consumer stalls or disconnects:
  WAL accumulates in pg_wal/ without bound.
  Disk fills → PostgreSQL halts all writes → TOTAL OUTAGE.

Safeguard (PostgreSQL 13+):
  ALTER SYSTEM SET max_slot_wal_keep_size = '20GB';
  → Slot auto-invalidated if lag exceeds limit
  → Consumer must resync from scratch, but primary stays alive

Monitoring:
SELECT slot_name, active,
       pg_size_pretty(pg_wal_lsn_diff(
           pg_current_wal_lsn(), restart_lsn)) AS wal_retained
FROM pg_replication_slots
ORDER BY pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) DESC;
```

#### Logical Replication Consumer (Go)

```go
// Simplified logical replication consumer using pglogrepl
package replication

import (
    "context"
    "fmt"
    "log"

    "github.com/jackc/pgx/v5/pgconn"
    "github.com/jackc/pglogrepl"
)

type ChangeHandler func(op string, relation string,
    old, new map[string]interface{}) error

type Consumer struct {
    conn      *pgconn.PgConn
    slotName  string
    pubName   string
    handlers  map[string]ChangeHandler
    relations map[uint32]*pglogrepl.RelationMessage
}

func (c *Consumer) Run(ctx context.Context, startLSN pglogrepl.LSN) error {
    err := pglogrepl.StartReplication(ctx, c.conn, c.slotName, startLSN,
        pglogrepl.StartReplicationOptions{
            PluginArgs: []string{
                "proto_version '1'",
                fmt.Sprintf("publication_names '%s'", c.pubName),
            },
        })
    if err != nil {
        return fmt.Errorf("start replication: %w", err)
    }

    currentLSN := startLSN

    for {
        msg, err := c.conn.ReceiveMessage(ctx)
        if err != nil {
            return err
        }

        switch msg := msg.(type) {
        case *pglogrepl.XLogData:
            logicalMsg, err := pglogrepl.Parse(msg.WALData)
            if err != nil {
                log.Printf("parse error: %v", err)
                continue
            }

            switch m := logicalMsg.(type) {
            case *pglogrepl.RelationMessage:
                // Cache schema for column decoding
                c.relations[m.RelationID] = m

            case *pglogrepl.InsertMessage:
                rel := c.relations[m.RelationID]
                newRow := decodeColumns(rel, m.Tuple)
                c.dispatch("INSERT", rel.RelationName, nil, newRow)

            case *pglogrepl.UpdateMessage:
                rel := c.relations[m.RelationID]
                var oldRow map[string]interface{}
                if m.OldTuple != nil {
                    oldRow = decodeColumns(rel, m.OldTuple)
                }
                newRow := decodeColumns(rel, m.NewTuple)
                c.dispatch("UPDATE", rel.RelationName, oldRow, newRow)

            case *pglogrepl.DeleteMessage:
                rel := c.relations[m.RelationID]
                var oldRow map[string]interface{}
                if m.OldTuple != nil {
                    oldRow = decodeColumns(rel, m.OldTuple)
                }
                c.dispatch("DELETE", rel.RelationName, oldRow, nil)

            case *pglogrepl.CommitMessage:
                currentLSN = msg.ServerWALEnd
                // Acknowledge LSN to primary (allows slot to advance)
                pglogrepl.SendStandbyStatusUpdate(ctx, c.conn,
                    pglogrepl.StandbyStatusUpdate{
                        WALWritePosition: currentLSN,
                        WALFlushPosition: currentLSN,
                        WALApplyPosition: currentLSN,
                    })
                // Persist currentLSN durably for restart recovery
                persistLSN(currentLSN)
            }
        }
    }
}

func (c *Consumer) dispatch(op, relation string,
    old, new map[string]interface{}) {
    if h, ok := c.handlers[relation]; ok {
        if err := h(op, relation, old, new); err != nil {
            log.Printf("handler error for %s.%s: %v", relation, op, err)
        }
    }
}

func decodeColumns(rel *pglogrepl.RelationMessage,
    tuple *pglogrepl.TupleData) map[string]interface{} {
    row := make(map[string]interface{})
    for i, col := range rel.Columns {
        if i < len(tuple.Columns) {
            tc := tuple.Columns[i]
            switch tc.DataType {
            case 'n':
                row[col.Name] = nil
            case 't':
                row[col.Name] = string(tc.Data)
            }
        }
    }
    return row
}

func persistLSN(lsn pglogrepl.LSN) {
    // Write to application DB: UPDATE replication_state SET lsn = $1
    // Used on restart to resume from last committed position
}
```

---

### 5. MySQL Binlog vs PostgreSQL WAL

MySQL uses a **binary log (binlog)** separate from InnoDB's redo log. Both must be written at COMMIT, requiring an internal XA-style two-phase commit between the two logs.

```
MySQL Write Path:
  1. Transaction executes (InnoDB redo log — crash recovery)
  2. COMMIT: write binlog + InnoDB redo log (2PC between them)
  3. Flush both to disk
  4. ACK to client

PostgreSQL Write Path:
  1. WAL record written (single log: crash recovery + replication)
  2. COMMIT: flush WAL
  3. ACK to client

MySQL dual-log implications:
  Phantom transactions if 2PC between binlog/InnoDB fails
  binlog_format MUST be ROW for CDC correctness:

  STATEMENT format: replicates SQL text
    UPDATE products SET updated_at = NOW()
    → NOW() differs on primary vs replica → SILENT DIVERGENCE

  ROW format: replicates actual row values
    {id=42, updated_at='2024-01-15 10:30:00.123456'}
    → Correct, deterministic, verbose

  MIXED: heuristic — risky for complex stored procedures
```

**Debezium MySQL configuration:**

```json
{
  "connector.class": "io.debezium.connector.mysql.MySqlConnector",
  "database.server.id": "184054",
  "database.include.list": "product_db",
  "table.include.list": "product_db.products",
  "schema.history.internal.kafka.topic": "schema-changes.product_db",
  "schema.history.internal.kafka.bootstrap.servers": "kafka:9092"
}
```

**Key structural difference:** MySQL uses `(binlog_file, position)` for replication coordinates — fragile across failover. MySQL 5.6+ GTID (Global Transaction ID) solved this: `source_uuid:transaction_id` is portable across topology changes, enabling cleaner failover and replication chain restructuring.

---

### 6. NewSQL: Consensus-Based Multi-Primary Replication

#### CockroachDB

CockroachDB partitions data into "ranges" (default 512 MB). Each range is a 3- or 5-node Raft group. Every write is synchronously replicated to a majority before acknowledgment.

```
Write to CockroachDB:
  1. Client → range's Raft leader node
  2. Leader appends to Raft log, sends AppendEntries to followers
  3. Majority (2/3) acknowledge log append
  4. Leader commits, applies to RocksDB storage
  5. Leader ACKs client

Properties:
  RPO = 0 (synchronous majority replication by definition)
  No single primary — different nodes lead different ranges
  Cross-region Raft: +30-150ms per write (consensus RTT)
  Same-DC Raft: +1-5ms per write

vs PostgreSQL sync replication:
  Both add RTT overhead to writes
  CockroachDB: distributed across all data, no single bottleneck
  PostgreSQL: all writes go through single primary WAL sender
```

#### Google Spanner: TrueTime and External Consistency

PostgreSQL orders transactions with XIDs — a 32-bit counter that only has meaning within one cluster. Across distributed nodes, there's no shared counter and no shared clock, making distributed MVCC require coordination.

Spanner solves this with **TrueTime**: an API backed by GPS receivers and atomic clocks in every Google data center:

```
TrueTime API:
  TT.now()    → interval [t_earliest, t_latest]
                actual_time ∈ [t_earliest, t_latest]
  Uncertainty ε = t_latest - t_earliest ≈ 1–7 ms (typically 4 ms)

Spanner commit protocol:
  1. Acquire Paxos locks on all participant shards
  2. Choose commit timestamp: ts = TT.now().latest
  3. WAIT until TT.after(ts) is true (wait ε ≈ 4ms)
     Guarantee: any future TT.now().earliest > ts
     → Future transactions observe ts as "in the past"
  4. Apply changes, release locks
  5. ACK to client

Why waiting works:
  After waiting ε, any future transaction's TT.now() lower bound > ts
  → All future readers see this write in the correct causal order
  → External Consistency = linearizability across global replicas
  → No centralized coordinator needed
```

**Why PostgreSQL cannot replicate TrueTime:** PostgreSQL uses software clocks (`clock_gettime`) with ~1ms accuracy and no bounded uncertainty guarantee. Two PostgreSQL nodes' clocks can drift by tens of milliseconds. Ordering commits by wall clock without bounded uncertainty produces incorrect causal ordering. TrueTime's GPS/atomic clock infrastructure is the prerequisite.

CockroachDB approximates TrueTime with **Hybrid Logical Clocks (HLC)**: `max(physical_clock, max_observed_timestamp) + logical_counter`. HLC provides causality without GPS, but cannot prove a timestamp is in the absolute past across nodes — CockroachDB uses uncertainty intervals and restarts transactions when clock uncertainty spans a conflict.

---

### 7. pg_rewind: Safely Rejoining a Failed Primary

After promotion, the old primary's WAL diverges from the new primary's timeline. `pg_rewind` identifies the divergence LSN, then copies only the changed heap blocks from the new primary — without a full base backup.

```
Before pg_rewind:
  Old primary (timeline 1):  WAL_BEFORE_CRASH → DIVERGENT_WRITES
  New primary (timeline 2):  WAL_BEFORE_CRASH → POST_PROMOTION_WRITES

pg_rewind steps:
  1. Read pg_control from both nodes to find divergence LSN
  2. Walk through old primary's WAL backward from divergence
     to find all heap blocks modified after the branch point
  3. Copy those blocks from new primary (rsync-like, only changed blocks)
  4. Copy timeline history file
  5. Old primary configured as standby to new primary

Time: seconds to minutes for small divergence
      (vs hours for full base backup on TB-scale databases)

Requirements:
  wal_log_hints = on   (OR data checksums enabled)
  pg_rewind has network access to new primary
```

---

## Step-by-Step Execution: Full UPDATE Traced Through WAL, MVCC, Replication, and VACUUM

```
Query: UPDATE products SET price = 200 WHERE id = 42

Step 1: Client sends query to a PostgreSQL backend process

Step 2: Backend parses + plans → chooses IndexScan on products_pkey

Step 3: Locate row in buffer pool (load 8KB page from disk if not cached)
        Heap page contains: Tuple(t_xmin=100, t_xmax=0, price=100, ctid=(5,3))

Step 4: Obtain row-level lock: set t_xmax=7291 (current XID) on old tuple
        Old tuple now: (t_xmin=100, t_xmax=7291, price=100, ctid=(5,3))

Step 5: Insert new tuple version on same page (or new page if no space):
        New tuple: (t_xmin=7291, t_xmax=0, price=200, ctid=(5,47))
        Update old tuple's ctid → (5,47) to chain versions

Step 6: Write WAL record to WAL buffer:
        {HEAP_UPDATE, page=5, old_off=3, new_off=47,
         old_t_xmax=7291, new_tuple=..., xid=7291, lsn=0/3A4F0200}

Step 7: COMMIT:
        Write COMMIT record: {xid=7291, lsn=0/3A4F0280}
        WAL writer fsyncs WAL segment → DURABILITY POINT
        CLOG updated: XID 7291 = COMMITTED
        ACK to client: "UPDATE 1"

Step 8: WAL sender streams records (0/3A4F0200 → 0/3A4F0280) to standby's WAL receiver

Step 9: Standby Startup process replays WAL records:
        Reads page 5 from standby heap
        Sets old tuple t_xmax=7291 (marking deletion)
        Inserts new tuple (price=200)
        Standby heap now identical to primary heap for this row

Step 10: Checkpoint (background, periodic):
         Background writer flushes buffer pool page 5 to heap file on disk
         This lazy flush decouples write throughput from disk I/O spikes

Step 11: Autovacuum fires (when dead tuple % exceeds threshold):
         Scans page 5
         Finds old tuple (t_xmin=100, t_xmax=7291):
           XID 7291 committed? YES
           Is any active transaction's snapshot older than XID 7291's commit? NO
           → Dead tuple: mark slot as reusable
         Updates FSM and Visibility Map for page 5
         Next INSERT into products can reuse the freed slot
```

---

## Real-World Example: GitLab's PostgreSQL Architecture

GitLab operates one of the largest open-source PostgreSQL deployments (~50 TB data, ~100,000 QPS peak). Their architecture is extensively documented in public engineering blog posts.

### Current Architecture

```
GitLab.com Database Tier:
  Primary: 96-core, 768 GB RAM, NVMe SSDs (AWS r6i.32xlarge)
  Read replicas: 4 (analytics, Geo, HA hot standby, archival)
  HA: Patroni + Consul (3-node Consul cluster for DCS)
  Connection pooling: PgBouncer (transaction mode, 1,000 server connections)
  Load balancing: HAProxy → PgBouncer → PostgreSQL

Logical replication use cases at GitLab:
  1. GitLab Geo: secondary sites replicate project data for regional reads
  2. Zero-downtime schema migrations (add column with logical replication)
  3. Analytics ETL to Snowflake (via Fivetran logical replication)

GitLab Geo:
  Each Geo secondary is an independent PostgreSQL cluster
  Primary region → logical replication → Geo secondary
  Geo secondaries serve reads for users in that region
  Writes always route to primary region (strong consistency)
  Replication lag target: < 60 seconds for metadata
```

### The 2017 Database Incident

GitLab's most famous incident: a senior DBA accidentally ran `rm -rf` on the production database directory while trying to fix a replication issue. They discovered:

1. **Replication ≠ backup:** All standbys replicated the deletion immediately
2. **Backups hadn't been working:** Their automated backup system had silently failed for months
3. **Only one person on call:** When the incident occurred at ~00:00 UTC, one engineer was available

**Recovery:** One DBA had taken an ad-hoc manual backup 6 hours prior. They restored from that, losing 6 hours of production data.

**What was implemented afterward:**
- Weekly automated restore tests (restore to a test instance, verify data integrity)
- WAL archiving to S3 with pgBackRest (point-in-time recovery capability)
- Multiple backup strategies at different frequencies (pgBackRest full + incremental + WAL streaming)
- Documented restore runbooks with RTO estimates per scenario

**The architectural lesson:** Replication protects against hardware failure. WAL archiving + PITR protects against logical errors. Both are mandatory. Testing restores is as important as taking backups.

```bash
# WAL archiving with pgBackRest (industry standard)
# postgresql.conf:
archive_mode = on
archive_command = 'pgbackrest --stanza=main archive-push %p'

# PITR recovery example:
# Restore base backup, then replay WAL to target time:
pgbackrest --stanza=main --delta restore
# recovery.conf / postgresql.conf:
restore_command = 'pgbackrest --stanza=main archive-get %f "%p"'
recovery_target_time = '2024-01-15 14:30:00 UTC'
recovery_target_action = 'promote'
```

---

## Failure Scenarios

### Scenario 1: Logical Replication Slot WAL Bloat Disk Exhaustion

**Context:** SaaS platform, 2 TB PostgreSQL database using Debezium CDC into Kafka.

**What Happened:**

The Debezium connector went offline for maintenance. An unexpected dependency upgrade extended the maintenance from 4 hours to 36 hours. During those 36 hours:
- Primary generated ~200 GB of WAL at ~5.5 MB/s
- The logical slot retained all 200 GB (consumer must catch up)
- The `/var/lib/postgresql` partition: 500 GB total
- At hour 28: partition hit 100% → PostgreSQL halted all writes
- All write traffic returned errors for 4 hours until space was manually freed

**Root Cause:**
1. No `max_slot_wal_keep_size` configured — unbounded WAL retention
2. No monitoring alert on slot lag bytes (only on slot lag time)
3. Disk usage alert threshold: 95% (too late — disk filled in minutes after 90%)

**Fix:**

```sql
-- Immediate: drop stale slot (Debezium will resync from scratch)
SELECT pg_drop_replication_slot('debezium_slot');

-- Long-term: limit WAL retention per slot
ALTER SYSTEM SET max_slot_wal_keep_size = '20GB';
SELECT pg_reload_conf();

-- Alert at 10 GB (50% of limit):
SELECT slot_name,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS lag
FROM pg_replication_slots
WHERE pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) > 10737418240; -- 10 GB
```

```yaml
# Prometheus alerting rule
- alert: ReplicationSlotWALBloat
  expr: pg_replication_slots_wal_status_lag_bytes > 10737418240
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Slot {{ $labels.slot_name }} retaining >10GB WAL — disk exhaustion risk"
```

---

### Scenario 2: XID Wraparound — Invisible Tables at Sentry (2015)

**Company:** Sentry (publicly disclosed in their engineering blog).

**What Happened:**

Sentry operated a multi-tenant PostgreSQL 9.3 database under extremely high write load. The `events` table received millions of inserts per day. Autovacuum was configured with default settings (`autovacuum_vacuum_scale_factor = 0.2`) and was severely under-resourced (one vacuum worker, slow HDD storage).

PostgreSQL's automatic wraparound protection triggered emergency autovacuum on the events table. However, the sequential scan of a 300 GB table with hundreds of millions of dead tuples took 72+ hours. The transaction counter advanced faster than VACUUM could freeze tuples. When the XID crossed the $2^{31}$ boundary past `relfrozenxid`, all rows in the events table became invisible.

SELECT queries returned 0 rows. INSERT created rows that were immediately invisible. Sentry's core functionality — recording errors — stopped working entirely.

**Recovery:** Multi-day process. Emergency VACUUM FREEZE on affected tables (run with dedicated resources, temporarily reducing write load). Partial restoration from backups for the interval that became invisible.

**Prevention:**

```sql
-- Aggressive per-table autovacuum for high-churn tables
ALTER TABLE events SET (
    autovacuum_vacuum_scale_factor = 0.005,  -- Vacuum when 0.5% rows are dead
    autovacuum_vacuum_threshold = 1000,
    autovacuum_freeze_max_age = 200000000    -- Force freeze at 200M transactions
);

-- Increase autovacuum workers (postgresql.conf):
autovacuum_max_workers = 6  -- (default: 3)
autovacuum_vacuum_cost_delay = 2ms  -- (default: 2ms — already low)
autovacuum_vacuum_cost_limit = 800  -- (default: 200 — increase I/O budget)
```

```sql
-- Monitoring: alert when XID age exceeds 1 billion transactions
SELECT max(age(relfrozenxid)) AS max_table_xid_age
FROM pg_class
WHERE relkind = 'r';
-- Alert threshold: > 1,000,000,000
-- Critical threshold: > 1,800,000,000
```

---

## Performance Considerations

### WAL Write Throughput by Configuration

```
synchronous_commit mode   Throughput (TPS)    Notes
─────────────────────────────────────────────────────────────────
off                       100,000+            No fsync guarantee
local                     10,000–30,000       Group commit on primary
on (same DC standby)      5,000–15,000        +1ms RTT to standby
on (cross-DC standby)     500–2,000           +50ms+ RTT to standby

Hardware baseline (NVMe, no group commit):
  1 fsync / transaction: 50,000 fsyncs/s NVMe → 50,000 TPS max
  With group commit (100 concurrent transactions):
    1 fsync covers 100 transactions → effective 5,000,000 TPS
    (limited by other factors well before this point)
```

### Checkpoint Tuning

```
Problem: Frequent checkpoints → constant I/O → high write amplification
         More FPI (full-page images) → larger WAL → more replication bandwidth

Production tuning:
  checkpoint_timeout = 15min       (default: 5min)
  max_wal_size = 4GB               (default: 1GB)
  checkpoint_completion_target = 0.9

Effect: Fewer, larger checkpoints; writes spread evenly over 13.5 minutes
        Tradeoff: Longer crash recovery time (replay more WAL)
        At 4GB WAL, 500 MB/s replay rate: crash recovery ≈ 8 seconds (acceptable)

Monitoring checkpoint frequency:
SELECT checkpoints_timed, checkpoints_req,
       checkpoint_write_time / 1000 AS write_secs,
       checkpoint_sync_time / 1000 AS sync_secs
FROM pg_stat_bgwriter;
-- checkpoints_req >> checkpoints_timed → increase max_wal_size
```

### Replication Bandwidth Calculation

```
WAL generation rate:
  10,000 TPS × 500 bytes/transaction = 5 MB/s WAL
  With wal_compression=lz4 (40% compression): 3 MB/s replication bandwidth
  
  Bulk COPY 1M rows: 200–500 MB/s burst WAL
  → Standby lag spikes during bulk loads are expected and normal

Cross-region replication timing:
  Same AZ:     RTT 0.1ms,  lag floor: 1–10ms
  Same region: RTT 2ms,    lag floor: 5–50ms
  US→EU:       RTT 100ms,  lag floor: 150–300ms
  
  Synchronous cross-region adds RTT to EVERY commit.
  For 100ms RTT: commit latency 1ms → 101ms (100x regression).
  Synchronous cross-region is only acceptable for financial systems
  where zero data loss justifies the latency cost.
```

---

## Trade-offs

### Physical vs Logical Replication

| Dimension | Physical (Streaming) | Logical |
|---|---|---|
| Granularity | Entire cluster | Per-table, per-row filters (PG15+) |
| Version compatibility | Same major version only | Cross-major-version, cross-engine |
| DDL replication | Automatic | Not supported — must apply manually |
| Initial sync | pg_basebackup (hours for TB) | Per-table COPY snapshot (parallel) |
| WAL overhead | Low (`replica` level) | Higher (`logical` level, +~10%) |
| WAL bloat risk | Low (slot advances quickly) | HIGH (stalled consumer = unbounded WAL) |
| Use case | HA, read scaling | Migration, CDC, partial replication |

### PostgreSQL vs CockroachDB vs Spanner

| Dimension | PostgreSQL + Patroni | CockroachDB | Google Spanner |
|---|---|---|---|
| Consistency | Strong (single primary) | Strong (Raft majority) | External consistency (TrueTime) |
| Multi-primary writes | No | Yes (per-range leaders) | Yes (per-shard leaders) |
| Horizontal write scaling | No (single primary) | Yes | Yes |
| Sync cross-region write latency | +RTT (50–150ms) | +RTT (Raft consensus) | +ε wait (4–7ms) + RTT |
| RPO on primary failure | Seconds (async) / Zero (sync) | Zero by design | Zero by design |
| Operational complexity | Medium (Patroni/etcd) | Medium | Very low (managed) |
| Cost | Open source | Open source / enterprise | High (proprietary managed) |
| PostgreSQL wire compatibility | Full | High | Partial |

---

## Production Considerations

1. **WAL archiving to object storage is not optional.** `archive_command` shipping to S3/GCS is the only protection against logical errors (accidental DELETE, DROP TABLE, schema corruption). Configure it from day one. Test restore quarterly.

2. **Monitor XID age as a top-tier health metric.** Alert at 1 billion transactions, treat it as a P1 incident. If autovacuum is failing to keep pace, `VACUUM FREEZE` during a maintenance window. The alternative is a multi-day outage.

3. **Set `max_slot_wal_keep_size` on all logical replication slots.** There is no safe default of "unlimited." Set a value your disk can tolerate (e.g., `20GB`) and alert when lag reaches 50% of that value.

4. **Use PgBouncer in transaction pooling mode.** PostgreSQL backends cost 10–40 MB RSS each. Without pooling, 1,000 application connections = 1,000 backends = 40 GB RAM wasted. PgBouncer multiplexes thousands of application connections onto tens of backend processes.

5. **Tune autovacuum per-table for high-churn workloads.** The global default (`autovacuum_vacuum_scale_factor = 0.2`) means autovacuum runs when 20% of rows are dead. For a 100M-row table, that's 20M dead tuples before VACUUM fires. High-write tables need `scale_factor = 0.01` or lower.

6. **Configure `wal_log_hints = on` before you need `pg_rewind`.** Changing it requires a restart. Without it (or data checksums), `pg_rewind` will refuse to run, forcing a full base backup after failover.

7. **Never route analytics queries to HA standbys.** Long-running analytics queries holding old snapshots conflict with WAL replay (requiring standby query cancellation or replay pause). Use a dedicated async standby for analytics with `hot_standby_feedback=on` and `max_standby_streaming_delay=300s`.

8. **Measure replication lag in wall-clock time, not bytes.** `pg_last_xact_replay_timestamp()` gives the transaction replay time directly usable in SLAs. Byte lag alone doesn't reflect the time dimension of staleness.

9. **Logical replication DDL requires careful sequencing.** Adding a column: add to subscriber FIRST, then add to primary with DEFAULT. Dropping a column: drop from primary FIRST, then from subscriber. Out-of-order DDL breaks replication silently or with cryptic errors.

10. **Plan for and rehearse the post-failover procedure.** Patroni handles promotion automatically, but someone must: verify application connectivity, check for split-brain (old primary must not be accepting writes), run `pg_rewind` on the old primary, verify WAL archiving is now targeting the new primary, and update monitoring/alerting dashboards. Document and rehearse this quarterly.

---

## Common Beginner Mistakes

1. **Treating replication as a backup.** Standbys replicate all writes — including `DROP TABLE`, `DELETE FROM orders`, and `UPDATE products SET price = 0 WHERE 1=1`. Replication provides HA; WAL archiving provides PITR; only both together provide true disaster recovery.

2. **Not monitoring replication lag.** Routing reads to standbys without monitoring lag means users occasionally see stale data. The engineering team has no visibility into how stale the data is. Monitor `now() - pg_last_xact_replay_timestamp()` and alert at 30 seconds for operational standbys, 5 minutes for analytics standbys.

3. **Setting `synchronous_commit = on` with a cross-region standby.** Adding 100ms+ to every write commit for a US→EU configuration without understanding the performance impact. Test synchronous replication latency with realistic write workloads before enabling in production.

4. **Creating logical replication slots without active consumers.** Every slot retains WAL from `restart_lsn` indefinitely. A slot created "for future use" and left without a consumer for 2 weeks retains 2 weeks of WAL — potentially hundreds of GB. Never create a slot without an immediately active consumer.

---

## Common Senior Engineer Mistakes

1. **Enabling `hot_standby_feedback = on` globally without measuring primary bloat.** This prevents standby query cancellations but allows the standby's old snapshot to delay VACUUM on the primary. On a primary with high update rates, this can cause significant table bloat over days or weeks. Measure `n_dead_tup` before and after enabling; disable it if bloat accelerates.

2. **Over-relying on autofailover without testing recovery procedures.** Patroni handles the promotion automatically. But `pg_rewind`, application reconnection, WAF/HAProxy reconfiguration, and DCS health must all be verified. Teams that have never practiced a failover during a real incident under pressure make expensive mistakes.

3. **Ignoring checkpoint write amplification in production sizing.** Benchmarking on an empty development database shows optimistic write throughput (no checkpoint I/O competing with writes). Production databases with 500 GB tables have continuous checkpoint I/O that reduces write throughput 20–40% compared to benchmark results.

4. **Not accounting for WAL volume growth during schema migrations.** `ALTER TABLE ... ADD COLUMN DEFAULT ...` on a 50B-row table rewrites every row in PostgreSQL < 11 (writing the entire table as WAL). This can generate terabytes of WAL, overwhelming standby replay capacity. Always test large schema migrations for WAL generation volume before running in production.

---

## Architecture Smells

- **No WAL archiving configured:** The cluster has physical standbys but no PITR capability. Any logical error (incorrect DELETE, schema accident) requires restoring from the most recent manual backup — potentially hours or days old.
- **Single synchronous standby with no `ANY N (...)` syntax:** `synchronous_standby_names = 'standby1'` means primary blocks ALL writes if standby1 goes down. Use `ANY 1 (standby1, standby2)` to maintain synchronous guarantees without single-standby blocking.
- **Standby for both HA and analytics on same node:** Analytics queries with `hot_standby_feedback=on` cause primary bloat. HA standbys need clean WAL replay without long-running query interference. These must be separate standbys with different configurations.
- **Logical replication slots with no lag monitoring:** Any unmonitored slot is a potential disk exhaustion bomb. Every slot must have a lag alert with a threshold lower than `max_slot_wal_keep_size`.
- **`autovacuum_vacuum_scale_factor` not tuned per table:** The global default (0.2 = 20% dead rows) is appropriate for cold tables with few writes. For high-churn tables (events, audit logs, queues), this allows hundreds of millions of dead tuples to accumulate before VACUUM fires, causing multi-hour VACUUM runs that compete with production I/O.

---

## Principal Engineer Perspective

**The RPO/RTO decision is a business decision disguised as a technical one.**  
Synchronous replication achieves RPO=0 at the cost of write latency and availability when the sync standby is down. Asynchronous replication achieves sub-second RPO with no latency impact and full availability. Most OLTP systems can tolerate 1–5 seconds of data loss at 2 AM — the cost savings (lower write latency, simpler topology) justify it. Financial ledger operations where every transaction must be durably replicated are the exception. The principal engineer asks the business: "What is the cost of losing 5 seconds of committed transactions?" and sizes the topology accordingly.

**MVCC cost scales with write volume, not data size — and this changes architecture.**  
A 10 GB table with 100 million updates/day accumulates 100 million dead tuples daily. VACUUM must process them. At some write volume, VACUUM becomes the dominant I/O consumer, competing with production write traffic and causing periodic latency spikes. The solution is architectural: time-based table partitioning with `DROP PARTITION` instead of `DELETE` (dropping a partition discards dead tuples instantly, no VACUUM needed). This is not an optimization — it is the only viable strategy for event/log/audit tables at scale.

**Logical replication is the most powerful zero-downtime migration tool available.**  
Major version upgrades, schema redesigns, engine migrations (PostgreSQL → CockroachDB) — all of these can be performed with near-zero downtime using logical replication. The pattern: (1) set up logical replication from old to new, (2) let it fully catch up, (3) cut traffic over during the brief replication lag window. The skill is in orchestrating the DDL sequence, monitoring lag, and timing the cutover. This is a capability that takes engineers months to develop and is worth investing in before you need it urgently.

**Replication topology is determined by failure domains, not data center count.**  
A standby in the same server rack fails on rack-level power loss. Same building: building-level power. Same AZ: AZ-level failure (rare but real — AWS us-east-1a has had AZ-level failures). Same region: regional failure. Different regions: geopolitical/catastrophic failure. Size the topology to the failure scenario you are SLA-bound to survive. Most SLAs require single-server survivability; few require AZ-level; almost none require regional-level. Build to your actual requirements, not to theoretical maximums.

---

## Architecture Review Questions

1. A PostgreSQL primary generates 50 MB/s of WAL. One synchronous standby is in the same DC, one async standby is in a different region. Describe the full replication topology, the RPO for each failure scenario (primary crash, same-DC standby failure, cross-region standby failure), and the write latency impact.

2. Explain what happens to MVCC visibility if XID wraparound occurs and VACUUM has not frozen old tuples. What monitoring prevents this? What is the emergency procedure if XID age exceeds 1.8 billion transactions on a 50 TB table?

3. A team proposes using logical replication to migrate from PostgreSQL 14 to 16 with a maintenance window of no more than 5 minutes of read-only traffic. What is the step-by-step migration procedure? What are the three most likely failure points?

4. Compare the consistency guarantees of PostgreSQL synchronous streaming replication, CockroachDB Raft-based replication, and Google Spanner TrueTime-based replication. Under what network failure scenario does each system potentially violate its consistency guarantees?

5. A logical replication consumer goes offline for 48 hours. The primary generates 500 MB/s of WAL. `max_slot_wal_keep_size = 100GB`. What happens? How does the consumer recover? What data (if any) is lost?

6. Describe the Patroni failover sequence in detail. What role does the etcd quorum play? What is the minimum etcd cluster size for correctness, and why? What happens to in-flight writes during the failover window?

7. A high-churn events table with 50 billion rows receives 200 million updates/day. Autovacuum cannot keep pace — dead tuple count grows faster than VACUUM cleans it. What architectural changes would you make? How does time-based partitioning solve this differently from tuning autovacuum?

8. A DBA proposes `synchronous_commit = off` on a payments database to increase throughput from 8,000 to 40,000 TPS. What scenarios does this risk? What monitoring would detect data loss after an OS crash? Under what conditions would you approve this change?

9. Explain what `pg_rewind` does and when it is used. What configuration must be in place before you need it? How long does it take compared to `pg_basebackup` for a 2 TB database with 30 seconds of divergence?

10. A global application has users in US, EU, and APAC. They require read-your-writes consistency within each region and eventual consistency across regions. Design the PostgreSQL topology (or alternative database selection), replication strategy, and application-layer consistency enforcement.

---

## Visual/Animation Specification

### Animation 1: MVCC Tuple Version Lifecycle

Interactive heap page visualization:
- Shows a single heap page with 8 tuple slots
- Slider at top: "Current Transaction XID" (draggable from 100 to 10,000)
- Each tuple slot shows: `t_xmin`, `t_xmax`, `price` value, and a color:
  - Green = visible to current XID
  - Red = created after current XID (not visible)
  - Gray = deleted before current XID (not visible)
  - Yellow = currently being checked
- "Run UPDATE" button: animates old tuple getting t_xmax set, new tuple inserted
- "Run VACUUM" button: animates gray/dead tuples being cleared, slots marked free
- Dead tuple count and page utilization percentage displayed in real-time

### Animation 2: WAL Streaming and Failover

Split-screen with three nodes (Primary, Standby-1 Sync, Standby-2 Async):
- WAL records visualized as colored blocks flowing from Primary's WAL buffer
- To Standby-1: block flows and Primary waits for ack before returning to client (synchronous)
- To Standby-2: block flows independently, lag meter shows growing delay
- "Kill Primary" button: Primary disappears
  - Patroni election: etcd quorum animation with CAS acquire on leader key
  - Standby-1 wins: pg_promote() animation, timeline 1→2 label appears
  - Standby-2 reconnects to Standby-1 (new primary)
- RPO counter: shows "X transactions not replicated" for async standby at failure time
- Clock shows RTO: total seconds from failure to new primary accepting writes

---

## Hands-On Tutorial: Streaming Replication + Failover

### Prerequisites

```bash
# Use Docker for a self-contained lab
docker network create pg-demo

# Primary
docker run -d --name pg-primary \
  --network pg-demo \
  -e POSTGRES_PASSWORD=secret \
  -p 5432:5432 \
  postgres:16

# Standby (will be configured via pg_basebackup)
docker run -d --name pg-standby \
  --network pg-demo \
  -e POSTGRES_PASSWORD=secret \
  -p 5433:5432 \
  --entrypoint /bin/bash \
  postgres:16 -c "sleep infinity"
```

### Configure Primary

```bash
docker exec -it pg-primary psql -U postgres << 'SQL'
-- Create replication user
CREATE USER replicator REPLICATION LOGIN ENCRYPTED PASSWORD 'replsecret';

-- Create test table
CREATE TABLE replication_demo (
    id SERIAL PRIMARY KEY,
    value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO replication_demo (value)
SELECT 'initial_row_' || i FROM generate_series(1, 100) i;
SQL

# Enable WAL streaming in pg_hba.conf
docker exec -it pg-primary bash -c \
  "echo 'host replication replicator pg-standby/32 trust' >> /var/lib/postgresql/data/pg_hba.conf"

# Configure WAL settings
docker exec -it pg-primary bash -c "cat >> /var/lib/postgresql/data/postgresql.conf << 'EOF'
wal_level = replica
max_wal_senders = 3
wal_keep_size = 64MB
hot_standby = on
wal_log_hints = on
EOF"

docker exec -it pg-primary psql -U postgres -c "SELECT pg_reload_conf();"
```

### Set Up Standby via pg_basebackup

```bash
# Take base backup from primary → standby data directory
docker exec -it pg-standby bash -c "
  rm -rf /var/lib/postgresql/data
  PGPASSWORD=replsecret pg_basebackup \
    -h pg-primary \
    -U replicator \
    -D /var/lib/postgresql/data \
    -P \
    --wal-method=stream \
    -R
  # -R creates standby.signal + primary_conninfo automatically
  chown -R postgres:postgres /var/lib/postgresql/data
"

# Start PostgreSQL on standby
docker exec -it pg-standby su postgres -c "pg_ctl start -D /var/lib/postgresql/data"
```

### Verify Replication

```bash
# Check replication status on primary
docker exec -it pg-primary psql -U postgres -c "
SELECT client_addr, state, sync_state,
       pg_size_pretty(pg_wal_lsn_diff(sent_lsn, replay_lsn)) AS lag
FROM pg_stat_replication;"

# Verify data on standby
docker exec -it pg-standby psql -U postgres -c "
SELECT COUNT(*) FROM replication_demo;
-- Should be 100

SELECT pg_is_in_recovery();  -- Should be 't' (still a standby)

SELECT now() - pg_last_xact_replay_timestamp() AS lag;"

# Write to primary, observe on standby
docker exec -it pg-primary psql -U postgres -c "
INSERT INTO replication_demo (value) VALUES ('new_row_after_setup');"

docker exec -it pg-standby psql -U postgres -c "
SELECT * FROM replication_demo ORDER BY id DESC LIMIT 3;"
# Should show the new row
```

### Simulate Failover

```bash
# Stop primary (simulate crash)
docker stop pg-primary

# Promote standby to primary
docker exec -it pg-standby psql -U postgres -c "SELECT pg_promote();"

# Verify promotion
docker exec -it pg-standby psql -U postgres -c "
SELECT pg_is_in_recovery();   -- Should be 'f' (now a primary)
SELECT timeline_id FROM pg_control_checkpoint();  -- Should be 2"

# Write to new primary
docker exec -it pg-standby psql -U postgres -c "
INSERT INTO replication_demo (value) VALUES ('written_on_new_primary');
SELECT COUNT(*) FROM replication_demo;"
```

### Monitor Key Metrics

```sql
-- Connect to active primary and run:

-- 1. Replication connections and lag
SELECT pid, client_addr, state, sync_state,
       write_lag, flush_lag, replay_lag
FROM pg_stat_replication;

-- 2. Dead tuple accumulation (run repeatedly to watch growth)
SELECT relname, n_dead_tup, n_live_tup,
       round(n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0) * 100, 2) AS dead_pct,
       last_autovacuum
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 5;

-- 3. XID wraparound risk
SELECT datname, age(datfrozenxid) AS xid_age
FROM pg_database
ORDER BY age(datfrozenxid) DESC;

-- 4. Checkpoint statistics
SELECT checkpoints_timed, checkpoints_req,
       round(checkpoint_write_time / 1000.0, 2) AS write_time_s,
       round(checkpoint_sync_time / 1000.0, 2) AS sync_time_s
FROM pg_stat_bgwriter;

-- 5. WAL generation rate
SELECT pg_current_wal_lsn(),
       pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0') / 1024 / 1024 AS total_wal_mb;
```

---

## Exercises

### Conceptual Exercises

1. **WAL durability:** `synchronous_commit = local` is configured. The OS crashes (not hardware failure — all disk contents survive). What is the maximum data loss? If `synchronous_commit = off`, what changes? Why?

2. **MVCC snapshot:** Transaction A (XID 1000) reads a row. Concurrently, transaction B (XID 1001) updates the same row. B commits before A finishes. What does A see on its next read of that row? What tuple header field values explain this?

3. **XID wraparound math:** A database has been running for 5 years at 500 transactions/second continuously. How many XIDs have been consumed? Is there wraparound risk? What is the XID age?

4. **Dead tuple accumulation:** A table has 10 million rows with `autovacuum_vacuum_scale_factor = 0.2`. Updates occur at 100,000/second uniformly across all rows. How long until autovacuum fires? How many dead tuples accumulate in that time? What is the disk space consumed by dead tuples?

5. **Logical replication DDL order:** You need to rename column `product_name` to `name` on a table with an active logical replication subscription. Logical replication does not replicate DDL. What is the correct sequence of steps on primary and subscriber to perform this rename without breaking replication?

### Architecture Exercises

1. **HA topology design:** Design a PostgreSQL HA topology for a fintech company with requirements: RPO = 0 for single-server failure, RPO ≤ 5 seconds for AZ failure, RTO ≤ 60 seconds for either scenario, read capacity = 5x write capacity. Specify: node count, instance type considerations, replication modes, DCS choice, and connection routing.

2. **Migration planning:** A team must upgrade PostgreSQL from version 13 to 16 with a maintenance window of at most 10 minutes total downtime. The database is 8 TB. Design the migration strategy using logical replication. Detail the exact sequence of steps and identify the point of no return.

3. **VACUUM strategy:** An audit log table grows at 500 million rows/day and receives 50 million UPDATEs/day. The table is partitioned by day. Describe the optimal autovacuum strategy, the partition lifecycle (when to create, when to drop), and how you would avoid ever running VACUUM on this table while keeping dead tuple counts bounded.

### Quantitative Exercises

1. **Replication bandwidth:** A PostgreSQL database handles 12,000 TPS. Average WAL per transaction: 1.5 KB. `wal_compression = lz4` achieves 45% compression. Calculate: (a) raw WAL generation rate, (b) compressed replication bandwidth per standby, (c) disk space for `wal_keep_size = 30min`, (d) time to drain a 5 GB lag at normal WAL generation rate.

2. **Checkpoint math:** `checkpoint_timeout = 10min`, `checkpoint_completion_target = 0.9`, `max_wal_size = 2GB`, WAL rate = 30 MB/s. What triggers each checkpoint (timeout or WAL size)? How long does each active checkpoint take? What is crash recovery time?

### Solutions to Quantitative Exercises

**Exercise 1:**
- (a) Raw WAL: 12,000 × 1.5 KB = **18 MB/s**
- (b) Compressed: 18 × (1 - 0.45) = **9.9 MB/s** per standby
- (c) `wal_keep_size` for 30 min: 18 MB/s × 1800s = **32.4 GB** (uncompressed WAL files on disk)
- (d) Drain 5 GB lag: WAL is generated at 18 MB/s, standby replays at ~18 MB/s (same rate in steady state). To drain 5 GB lag, standby must replay WAL faster than it arrives. If replay capacity = 36 MB/s (2x generation): drain rate = 36 - 18 = 18 MB/s excess. Time = 5 GB / 18 MB/s ≈ **278 seconds (4.6 minutes)**.

**Exercise 2:**
- WAL accumulation rate: 30 MB/s. Time to reach `max_wal_size = 2 GB`: 2048 MB / 30 MB/s ≈ 68 seconds.
- `checkpoint_timeout = 10min = 600s`. Since 68s << 600s: **WAL size triggers checkpoints** (roughly every 68 seconds).
- Checkpoint duration: `completion_target = 0.9 × 68s ≈ 61 seconds` of spread writes.
- WAL to replay on crash = WAL generated since last checkpoint ≤ 2 GB. At replay rate ≈ 60 MB/s (disk sequential read): **2 GB / 60 MB/s ≈ 34 seconds** crash recovery.

---

## Interview Questions

### Beginner Level

1. What is the Write-Ahead Log and why does it exist?
2. What is MVCC and why can readers and writers operate concurrently without blocking?
3. What is replication lag and how do you measure it on a PostgreSQL standby?
4. What does VACUUM do, and why is it necessary if rows are already deleted?
5. What is the difference between a logical and physical replication slot?

### Senior Level

1. Explain PostgreSQL's tuple header fields `t_xmin` and `t_xmax`. Given a tuple with `t_xmin=500, t_xmax=700`, is it visible to a transaction that started when XID 600 was the latest committed transaction?
2. What is the XID wraparound problem? What is the consequence if VACUUM cannot keep pace? How do you monitor for it?
3. When would you choose logical replication over physical replication? What operational procedures does logical replication require that physical replication does not?
4. Explain the WAL bloat risk of logical replication slots. What configuration prevents disk exhaustion? What are the trade-offs?
5. What does Patroni do during a primary failure, step by step?

### Staff Level

1. Trace a PostgreSQL UPDATE from client acknowledgment through WAL, heap, physical replication, and eventual VACUUM. Include the exact tuple header changes at each stage.
2. Design a PostgreSQL HA topology that achieves RPO=0 for same-DC failure and RPO=30s for cross-DC failure. Explain the configuration trade-offs.
3. A team must perform a zero-downtime migration from PostgreSQL 14 to 16. The database is 10 TB. Describe the step-by-step procedure using logical replication, including how to handle the DDL sequencing and traffic cutover.
4. Explain `hot_standby_feedback`. Under what circumstances does enabling it cause harm on the primary? How do you decide whether to enable it?

### Principal Level

1. Compare the consistency guarantees of PostgreSQL sync streaming replication, CockroachDB Raft replication, and Google Spanner TrueTime replication. For what failure scenario does each system's guarantee break down?
2. Explain TrueTime and the Spanner commit wait mechanism. Why can't PostgreSQL achieve external consistency without equivalent infrastructure? What does CockroachDB use instead, and how does it differ?
3. An audit log table at 50 billion rows receives 500 million UPDATEs/day. Autovacuum cannot keep pace with dead tuple accumulation; VACUUM runs compete with production I/O and cause periodic latency spikes. Design an architectural solution that eliminates this problem without requiring VACUUM to run on the main table.
4. A CQRS system uses PostgreSQL logical replication to populate read replicas. Read replicas lag by up to 1 second. Users are experiencing read-your-writes violations: they update their profile and immediately see the old data. Design the application-layer strategy to prevent this without adding synchronous cross-service dependencies.

---

## Summary

Database replication is built on three interlocking mechanisms: the Write-Ahead Log as the durable, append-only source of truth; MVCC as the concurrency model that lets readers access consistent historical snapshots without blocking writers; and the replication protocol that ships WAL to standbys for replay.

Physical replication streams raw WAL bytes — fast, transparent, version-specific. Logical replication decodes WAL into row-change events — flexible (cross-version, cross-engine, per-table), with WAL bloat risk from stalled consumers.

MVCC's dead tuple accumulation is the hidden cost of high-write PostgreSQL. VACUUM is not optional maintenance — it is the mechanism preventing table bloat, enabling XID freezing (preventing the XID wraparound catastrophe), and keeping the Visibility Map current. Tuning autovacuum per-table and monitoring XID age are Staff Engineer-level operational responsibilities.

PostgreSQL's single-primary model delivers strong consistency within a region at low write latency. CockroachDB and Spanner trade write latency for synchronous multi-primary replication enabling geographic write distribution — at 30–150ms committed write latency for cross-region operations. TrueTime's GPS/atomic clock infrastructure is what enables Spanner's external consistency without a central coordinator — an architectural capability PostgreSQL cannot replicate in software alone.

---

## What You Should Now Be Able To Explain

- **WAL durability:** Why appending a small sequential WAL record and fsyncing it is orders of magnitude faster than fsyncing an 8KB heap page, and why the heap file is a performance cache reconstructable from WAL
- **MVCC visibility rules:** Given `t_xmin`, `t_xmax`, and a transaction's snapshot, determine visibility — and why this allows unlimited read concurrency without locks at the cost of dead tuple accumulation
- **XID wraparound:** Why 32-bit XIDs cause a hard limit at 2.1 billion transactions, what happens when it's breached (invisible tables), and why VACUUM freezing is the prevention mechanism
- **Physical vs logical replication trade-offs:** Version compatibility, DDL handling, WAL bloat risk, and the specific scenarios where each is the correct choice
- **Patroni failover mechanics:** The role of etcd/Consul quorum, the ~30-second TTL-based detection window, pg_promote(), timeline increment, and pg_rewind for rejoining
- **TrueTime and external consistency:** How GPS-backed clock uncertainty bounds enable Spanner to achieve linearizability across global replicas by waiting ε milliseconds after commit timestamp selection

---

## What To Learn Next

**Chapter 31 — API Gateways, Load Balancers, and Edge Architecture at Scale**

Having mastered data persistence (storage engines, replication, caching), Chapter 31 moves to the edge of your distributed system: how traffic arrives, how it is routed, and how it is protected. We will examine L4 vs L7 load balancing, health checking semantics (active vs passive probes), connection draining, and the architectural distinction between a reverse proxy (Nginx, HAProxy), an API gateway (Kong, AWS API Gateway), and a service mesh ingress (Istio Ingress Gateway). We will study request routing algorithms — round robin, least connections, consistent hashing, and EWMA (exponentially weighted moving average of response latency for adaptive load balancing). We will analyze how global load balancers (AWS Global Accelerator, Cloudflare, Anycast routing) steer traffic across geographic regions, how TLS termination at the edge affects certificate management and mTLS propagation into the service mesh, and how rate limiting, WAF rules, and DDoS mitigation integrate at the API gateway layer — with production examples from Cloudflare's Railgun architecture and Netflix's Zuul2 adaptive concurrency limiter.
