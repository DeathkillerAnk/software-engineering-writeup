# Chapter 12 — SQL Databases at Scale

## Difficulty
Advanced → Expert

## Importance
**Must Know** — Relational databases are in every production system. Even companies that use Cassandra, DynamoDB, or Redis for specific workloads almost always have PostgreSQL or MySQL somewhere for transactional data. More importantly: the failure modes of SQL databases at scale are among the most common and most severe in distributed systems. Wrong isolation level → data corruption. Missing index → p99 latency spike. Schema migration with table lock → 2-minute outage. Long-running transaction → lock cascade. A Principal Engineer who cannot diagnose these is perpetually reactive.

## Prerequisites
Chapter 7 — Storage Engines and Database Internals (B-Tree, WAL, MVCC, buffer pool)
Chapter 8 — Consistency, Consensus (isolation levels connect to consistency models)
Chapter 11 — API Design (idempotency connects to transaction design)

## Learning Objectives

By the end of this chapter you will be able to:

1. Define the four ACID properties precisely and explain what each guarantees — and what it does NOT guarantee.
2. Explain the four transaction isolation levels (Read Uncommitted, Read Committed, Repeatable Read, Serializable) and the specific anomalies each prevents.
3. Name and describe six read/write anomalies: dirty read, non-repeatable read, phantom read, lost update, read skew, write skew.
4. Explain how PostgreSQL implements Serializable Snapshot Isolation (SSI) and why it is superior to lock-based serialization.
5. Design a zero-downtime schema migration strategy using techniques: expand-contract, online index builds, and shadow tables.
6. Explain the scaling strategies for SQL databases: connection pooling, read replicas, partitioning (horizontal sharding), and vertical scaling — with their specific limits and trade-offs.
7. Describe how to safely run long-running migrations without causing lock-based outages.
8. Apply the N+1 query problem detection and resolution at the SQL level.

## Why This Matters

In 2012, the Knight Capital Group lost $440 million in 45 minutes due to a software deployment error that affected their trading system. While not a pure database incident, the pattern is familiar: a system that works correctly for years, fails catastrophically under a specific combination of state and load.

Database incidents are less dramatic but equally costly:
- A missing index on a foreign key causes a full table scan on every JOIN — 50ms query becomes 30 seconds as the table grows past 10 million rows.
- A migration that runs `ALTER TABLE` without `CONCURRENTLY` acquires a table lock — entire application stalls for the 8 minutes the migration runs.
- A transaction that reads a balance and then updates it without proper isolation allows two concurrent transactions to both see a zero balance, resulting in double-spending.
- A connection pool misconfiguration causes `max_connections` to be reached during a traffic spike — all new connections fail with "too many connections."

These are not theoretical. They happen monthly in production systems. This chapter makes them preventable.

---

## Mental Model

> **A SQL database gives you ACID transactions: Atomicity (all or nothing), Consistency (invariants preserved), Isolation (concurrent transactions don't interfere), Durability (committed data survives crashes). The trick is that "Isolation" is a spectrum — not a binary. Full isolation (Serializable) prevents all anomalies but costs performance. Weaker isolation (Read Committed) allows certain anomalies in exchange for higher throughput. Most production databases run at Read Committed — which means you must design your application to handle the anomalies it permits. The Principal Engineer's job is to know exactly which anomalies your isolation level allows and design the application logic to be correct despite them.**

---

## Intuition

Think of concurrent database transactions as multiple accountants working on the same company's books simultaneously.

**No isolation (chaos):** Each accountant works with their own private copy of the ledger, makes changes, and pastes them over the master ledger whenever they finish. If two accountants both look at the same account and make changes, the second one's paste overwrites the first. Money appears or disappears.

**Read Committed (the most common reality):** Each accountant only reads final, committed entries — they can't see another's pencil scratches. But if accountant A reads an account twice during their session, accountant B might have committed a change in between. A's two reads return different values.

**Repeatable Read (stronger):** Once A reads an account, the value is "frozen" for A's entire session — no matter what B commits. But A might count the number of accounts matching "balance > $1000" twice, and new accounts might have been added in between (phantoms).

**Serializable (strongest):** The system guarantees the result is exactly as if all accountants worked sequentially, one at a time. No anomalies, but they must sometimes wait for each other.

---

## Visual Explanation

### Isolation Levels and Anomalies Matrix

```
                          ┌──────────────────────────────────────────────────────┐
                          │                    ANOMALY                           │
  Isolation Level         │ Dirty  Non-Rep  Phantom  Lost   Read   Write         │
                          │ Read   Read     Read     Update Skew   Skew          │
  ──────────────────────┼─────────────────────────────────────────────────────┤
  Read Uncommitted      │  ✓      ✓        ✓        ✓      ✓      ✓            │
  Read Committed        │  ✗      ✓        ✓        ✓      ✓      ✓            │
  Repeatable Read       │  ✗      ✗        ✓*       ✗      ✗      ✓            │
  Serializable          │  ✗      ✗        ✗        ✗      ✗      ✗            │
  ──────────────────────┴─────────────────────────────────────────────────────┘

  ✓ = CAN OCCUR  ✗ = PREVENTED  * = varies by implementation

  PostgreSQL default: READ COMMITTED
  PostgreSQL with SERIALIZABLE: SSI (Serializable Snapshot Isolation)
  MySQL InnoDB default: REPEATABLE READ (with gap locks for phantoms)
```

### Transaction Timeline Visualization

```
Read Committed anomaly — Non-Repeatable Read:

T1: BEGIN                                   T2: BEGIN
T1: SELECT balance FROM accounts WHERE id=1 → 100
                                            T2: UPDATE accounts SET balance=200 WHERE id=1
                                            T2: COMMIT
T1: SELECT balance FROM accounts WHERE id=1 → 200 (DIFFERENT VALUE!)
T1: Decision based on first read (100) is now wrong
T1: COMMIT

This is a NON-REPEATABLE READ: T1 reads the same row twice, gets different values.
Prevented by: Repeatable Read and above.

Write Skew anomaly (allowed even at Repeatable Read):

Constraint: At least one doctor must be on-call at all times.
T1 reads: doctors_on_call = {Alice, Bob} → count=2 → Alice can go off-call
T2 reads: doctors_on_call = {Alice, Bob} → count=2 → Bob can go off-call

T1: UPDATE schedules SET on_call=false WHERE doctor='Alice'; COMMIT
T2: UPDATE schedules SET on_call=false WHERE doctor='Bob';  COMMIT

Result: No doctors on call. Constraint violated.
Neither T1 nor T2 wrote to data the other READ — so no conflict detected.
Prevented by: Serializable only.
```

---

## Core Concepts

### 1. ACID — Precisely Defined

**Atomicity:** A transaction's operations are all-or-nothing. Either every operation in the transaction succeeds and is committed, or none of them take effect (they are rolled back). There is no partial state visible.

```
Bank transfer: debit $100 from account A, credit $100 to account B.

Without atomicity:
  Debit A succeeds. System crashes. Credit B never happens.
  $100 vanishes from the system.

With atomicity (WAL + rollback):
  Debit A: WAL record written.
  System crashes before credit B.
  On recovery: WAL shows uncommitted transaction → rollback.
  Account A: $100 restored. Account B: unchanged.
  No money lost.
```

**Consistency:** A transaction brings the database from one valid state to another valid state, preserving all declared invariants (foreign keys, check constraints, unique constraints, application-level invariants enforced in code).

```
Invariant: account balance must be >= 0.

Transaction: debit $200 from account with $100 balance.
  Database check constraint: balance >= 0
  Update: balance = 100 - 200 = -100 → CONSTRAINT VIOLATION
  Transaction: ROLLED BACK. Account balance unchanged.

Note: Consistency requires both the DB enforcing constraints AND
      the application encoding business rules correctly.
      The DB can't enforce "there must always be one on-call doctor"
      without an explicit constraint or trigger — that's application-level consistency.
```

**Isolation:** Concurrent transactions behave as if they were executed sequentially. One transaction's intermediate state is not visible to others. (The specific degree of isolation depends on the isolation level — see Section 2.)

**Durability:** Once a transaction is committed, the changes persist even in the event of a system crash. Implemented via the WAL (Chapter 7): committed data is in the WAL and on disk before the commit acknowledgment returns to the client.

```
Durability caveat:
  PostgreSQL: synchronous_commit=on → WAL fsync before ACK → durable
  PostgreSQL: synchronous_commit=off → ACK before fsync → up to 200ms data loss on crash
  MySQL: innodb_flush_log_at_trx_commit=2 → 1 second data loss possible

Durability is not free — fsync on every commit costs latency.
Configuring it away (for performance) sacrifices durability.
```

### 2. Transaction Anomalies — The Complete Set

Understanding exactly which anomalies can occur at each isolation level is the foundation for correct concurrent programming.

#### Dirty Read
Reading uncommitted data from another transaction.
```
T1: UPDATE accounts SET balance=0 WHERE id=1  (not committed)
T2: SELECT balance FROM accounts WHERE id=1 → 0  (T2 reads T1's uncommitted write)
T1: ROLLBACK  (T1 undoes the write → balance is no longer 0)
T2: made a decision based on data that never existed

Prevented by: Read Committed (and above).
PostgreSQL: never allows dirty reads (even at Read Uncommitted, PostgreSQL
            uses Read Committed behavior).
```

#### Non-Repeatable Read
Reading the same row twice in one transaction and getting different values because another transaction committed a change in between.
```
T1: SELECT balance FROM accounts WHERE id=1 → 100
(T2 commits: UPDATE accounts SET balance=200 WHERE id=1)
T1: SELECT balance FROM accounts WHERE id=1 → 200 ← DIFFERENT

Prevented by: Repeatable Read (and above).
How: MVCC snapshot — T1 reads from a snapshot taken at T1's start.
     Even after T2 commits, T1's snapshot still shows balance=100.
```

#### Phantom Read
A query that returns a different set of rows when executed twice, because another transaction inserted or deleted rows matching the WHERE clause.
```
T1: SELECT COUNT(*) FROM orders WHERE status='pending' → 5
(T2 commits: INSERT INTO orders (status) VALUES ('pending'))
T1: SELECT COUNT(*) FROM orders WHERE status='pending' → 6 ← DIFFERENT ROWS

Prevented by: Serializable (and in MySQL InnoDB's REPEATABLE READ via gap locks).
PostgreSQL REPEATABLE READ: Does NOT prevent phantom reads for INSERT (only SSI does).
MySQL REPEATABLE READ: Prevents phantoms via next-key locking (gap locks).
```

#### Lost Update
Two transactions both read a value, compute a new value based on it, and write back — one overwrites the other's update.
```
T1: SELECT balance FROM accounts WHERE id=1 → 100
T2: SELECT balance FROM accounts WHERE id=1 → 100
T1: UPDATE accounts SET balance=100+50=150 WHERE id=1 → COMMIT
T2: UPDATE accounts SET balance=100+30=130 WHERE id=1 → COMMIT

Expected: balance = 180 (100 + 50 + 30)
Actual:   balance = 130 (T1's update is LOST)

Prevention:
  1. SELECT FOR UPDATE (pessimistic lock):
     T1: SELECT balance FROM accounts WHERE id=1 FOR UPDATE  (T2 blocks until T1 commits)
     T1: UPDATE SET balance=150; COMMIT
     T2: SELECT balance FROM accounts WHERE id=1 FOR UPDATE  → now reads 150
     T2: UPDATE SET balance=150+30=180; COMMIT  → CORRECT

  2. Optimistic concurrency (CAS — Compare And Swap):
     T1: SELECT balance, version FROM accounts WHERE id=1 → (100, 5)
     T2: SELECT balance, version FROM accounts WHERE id=1 → (100, 5)
     T1: UPDATE accounts SET balance=150, version=6 WHERE id=1 AND version=5 → 1 row updated (success)
     T2: UPDATE accounts SET balance=130, version=6 WHERE id=1 AND version=5 → 0 rows updated (conflict!)
     T2: Retry from the beginning (read new balance=150, update to 180)

  3. Atomic operations:
     UPDATE accounts SET balance = balance + 50 WHERE id=1  ← read-modify-write in DB atomically
     No application-level read needed. Lost update impossible.
```

#### Read Skew (Snapshot Inconsistency)
Reading related data across multiple queries such that the combination is inconsistent — even though each query was individually correct.
```
Invariant: balance_checking + balance_savings = total_assets (for reporting)

T1: SELECT balance FROM checking WHERE user=1  → 500  (snapshot at T1 start)
(T2: transfers $200 from checking to savings, commits)
T1: SELECT balance FROM savings WHERE user=1   → 700  (snapshot now ALSO at T1 start... wait)

Actually at Read Committed:
T1: SELECT balance FROM checking WHERE user=1  → 500  (before T2 committed)
T2: COMMITS (checking=300, savings=700)
T1: SELECT balance FROM savings WHERE user=1   → 700  (after T2 committed)
T1: total = 500 + 700 = 1200 → WRONG (should be 1000)
T1 sees a mix of states from before and after T2.

Prevented by: Repeatable Read (snapshot at transaction start, consistent view).
```

#### Write Skew
The most subtle anomaly. Two transactions each read overlapping data, determine they can each proceed based on what they saw, then write to different rows — but the combined result violates an invariant.
```
Constraint: at_least_one_doctor_on_call = true

T1: SELECT COUNT(*) FROM shifts WHERE on_call=true → 2 (Alice, Bob)
T2: SELECT COUNT(*) FROM shifts WHERE on_call=true → 2 (Alice, Bob)
T1: UPDATE shifts SET on_call=false WHERE doctor='Alice' → COMMIT
T2: UPDATE shifts SET on_call=false WHERE doctor='Bob'  → COMMIT

Result: 0 doctors on call. Constraint VIOLATED.

T1 and T2 wrote to DIFFERENT ROWS (Alice and Bob).
Neither transaction saw a conflict in what the other wrote.
The constraint was checked at READ time (count=2), not at WRITE time (count=0).

Prevented by: Serializable ONLY.
SSI detection: PostgreSQL detects the anti-dependency (T1's write would change
               T2's read result; T2's write changes T1's read result → cycle → abort one).

Workaround at Repeatable Read: SELECT FOR UPDATE on the rows being checked
  T1: SELECT COUNT(*) FROM shifts WHERE on_call=true FOR UPDATE
  → This locks ALL on-call rows. T2 blocks until T1 commits. No write skew.
  (Correct but reduces concurrency.)
```

### 3. Serializable Snapshot Isolation (SSI)

PostgreSQL's SERIALIZABLE isolation is implemented via SSI, not traditional lock-based two-phase locking (2PL). This is a significant technical achievement.

**Traditional 2PL (lock-based serializable):**
- Every read acquires a shared lock; every write acquires an exclusive lock.
- Locks held until transaction commits.
- Prevents all anomalies but causes massive lock contention.
- Long readers block writers; long writers block all readers.
- Used by: Oracle (option), older MySQL configurations.

**Serializable Snapshot Isolation (SSI, Cahill et al., 2008):**
- Transactions read from a consistent snapshot (like MVCC Repeatable Read) — NO READ LOCKS.
- SSI tracks "anti-dependencies" — when T1 reads data that T2 later writes (rw-dependency).
- If SSI detects a dangerous cycle in the rw-dependency graph → aborts one transaction.
- Writers do not block readers; readers do not block writers.

```
SSI detecting the doctor write skew:

T1 reads shifts WHERE on_call=true (result: {Alice, Bob})
T2 reads shifts WHERE on_call=true (result: {Alice, Bob})
T1 writes to Alice's row
T2 writes to Bob's row

SSI tracking:
  T2 wrote to data that T1 would have read differently after T2's write
  → T1 rw-depends on T2
  T1 wrote to data that T2 would have read differently after T1's write  
  → T2 rw-depends on T1
  Cycle: T1 → T2 → T1 → ABORT one (the later committer)

Result: T2 gets "ERROR: could not serialize access due to concurrent update"
T2 retries: now reads count=1 (only Bob) → proceeds correctly → count=0 not reached
```

**SSI performance:** 10-20% overhead over MVCC Repeatable Read, vs 2× or more for lock-based 2PL. A huge improvement while providing full serializable guarantees.

**When to use SERIALIZABLE:**
```sql
-- Any transaction involving:
-- 1. Read → decision → write based on read (classic write skew pattern)
-- 2. "Select then insert/update" patterns where the constraint spans rows
-- 3. Financial operations where correctness is more important than throughput

BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
SELECT COUNT(*) FROM shifts WHERE on_call = true;
-- ... if count > 1, proceed with setting self off-call
UPDATE shifts SET on_call = false WHERE doctor = 'current_user';
COMMIT;
-- If another concurrent SERIALIZABLE TX modified the same data: SERIALIZATION FAILURE
-- Application must catch and retry:
-- catch (SerializationFailureException): retry the whole transaction
```

### 4. Locking — Explicit and Implicit

Even with MVCC, locks are sometimes necessary.

**Row-level locks:**
```sql
-- Pessimistic locking: lock the row before reading + modifying
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;
-- Holds exclusive lock until COMMIT/ROLLBACK
-- Other transactions that try FOR UPDATE on row 1: BLOCK until first releases

-- For reporting (shared lock, allows other reads but not writes):
SELECT * FROM accounts WHERE id = 1 FOR SHARE;

-- Skip locked rows (don't block, skip):
SELECT * FROM task_queue WHERE status='pending' FOR UPDATE SKIP LOCKED LIMIT 1;
-- Used for job queue: each worker picks a different task atomically
```

**Advisory locks (application-level mutex via PostgreSQL):**
```sql
-- Acquire a named lock (for distributed critical sections):
SELECT pg_try_advisory_lock(1234567890);  -- returns true if lock acquired
-- ... critical section ...
SELECT pg_advisory_unlock(1234567890);

-- Use case: prevent concurrent execution of a maintenance job
-- Key must be a 64-bit integer: use hash of the lock name
SELECT pg_try_advisory_lock(hashtext('inventory_reconciliation_job'));
```

**Lock levels in PostgreSQL (from weakest to strongest):**
```
ACCESS SHARE         → acquired by SELECT. Conflicts with: ACCESS EXCLUSIVE only.
ROW SHARE            → acquired by SELECT FOR SHARE. Conflicts with: EXCLUSIVE, ACCESS EXCLUSIVE.
ROW EXCLUSIVE        → acquired by UPDATE/INSERT/DELETE. Conflicts with: SHARE and above.
SHARE UPDATE EXCLUSIVE → acquired by VACUUM, CREATE INDEX CONCURRENTLY. Conflicts with: SHARE and above.
SHARE                → acquired by CREATE INDEX (non-concurrent). Conflicts with: ROW EXCLUSIVE and above.
SHARE ROW EXCLUSIVE  → acquired by manual locking.
EXCLUSIVE            → Conflicts with: ROW SHARE and above (allows only ACCESS SHARE).
ACCESS EXCLUSIVE     → acquired by ALTER TABLE. Conflicts with: EVERYTHING.
                       This is the dangerous one: blocks all queries.
```

**The danger of `ACCESS EXCLUSIVE`:** Every DDL operation (ALTER TABLE, DROP TABLE, TRUNCATE) acquires ACCESS EXCLUSIVE. This blocks ALL concurrent queries — reads and writes. A migration that runs `ALTER TABLE orders ADD COLUMN notes TEXT` on a table with ongoing traffic will cause a lock queue that cascades: all queries to `orders` queue behind the DDL lock. If the DDL takes 60 seconds, all queries queue for 60 seconds — then all release simultaneously → thundering herd.

### 5. Zero-Downtime Schema Migrations

Schema migrations are the most common source of planned outages. Done correctly, they are invisible to users.

#### The Expand-Contract Pattern (Blue-Green Migration)

Never change a column in one step. Use three phases:

```
Scenario: Rename column `user_name` to `full_name` in the users table.

PHASE 1 — EXPAND (Backward Compatible Addition):
  Step 1: Add new column (non-blocking):
    ALTER TABLE users ADD COLUMN full_name TEXT;
    -- ADD COLUMN is fast (no table rewrite, just catalog update)
    -- No data yet, column is NULL for existing rows

  Step 2: Backfill new column (online, no lock):
    UPDATE users SET full_name = user_name WHERE full_name IS NULL;
    -- Too dangerous in one UPDATE (table lock for full table duration)
    -- DO THIS INSTEAD (batch update):
    DO $$
    DECLARE
      batch_size INT := 1000;
      last_id BIGINT := 0;
    BEGIN
      LOOP
        UPDATE users SET full_name = user_name
        WHERE id IN (
          SELECT id FROM users
          WHERE full_name IS NULL AND id > last_id
          ORDER BY id LIMIT batch_size
        )
        RETURNING id INTO last_id;
        EXIT WHEN NOT FOUND;
        PERFORM pg_sleep(0.01);  -- 10ms pause between batches (throttle)
      END LOOP;
    END $$;
    -- Backfill 1000 rows at a time, with pauses → no long-held locks

  Step 3: Deploy application code that writes BOTH columns:
    INSERT INTO users (user_name, full_name, ...) VALUES (?, ?, ...)
    -- App writes to both; reads from new column with fallback to old

PHASE 2 — MIGRATE (Read new column):
  Step 4: Deploy application code that reads from new column:
    SELECT full_name FROM users  -- primary read from new column
    -- Both columns kept in sync by app writes

  Step 5: Add NOT NULL constraint (if needed) — carefully:
    ALTER TABLE users ADD CONSTRAINT users_full_name_not_null
      CHECK (full_name IS NOT NULL) NOT VALID;
    -- NOT VALID: doesn't scan existing rows (fast, no lock)
    ALTER TABLE users VALIDATE CONSTRAINT users_full_name_not_null;
    -- VALIDATE: scans rows but only needs SHARE UPDATE EXCLUSIVE lock
    -- (allows concurrent reads and writes — not blocking)

PHASE 3 — CONTRACT (Remove old column):
  Step 6: Deploy application code that no longer writes old column
  Step 7: DROP old column:
    ALTER TABLE users DROP COLUMN user_name;
    -- This is fast (no table rewrite) but takes ACCESS EXCLUSIVE briefly
    -- Do this in a low-traffic window to minimize impact
```

#### Online Index Creation (`CONCURRENTLY`)

```sql
-- DANGEROUS (takes ShareLock — blocks writes):
CREATE INDEX idx_orders_user_id ON orders(user_id);
-- For a 100M row table: takes 10+ minutes, blocks all writes

-- SAFE (online, non-blocking):
CREATE INDEX CONCURRENTLY idx_orders_user_id ON orders(user_id);
-- Takes SHARE UPDATE EXCLUSIVE — allows concurrent reads AND writes
-- Runs multiple passes over the table to catch new writes during build
-- Duration: same 10+ minutes but doesn't block anything
-- Caveat: cannot be run inside a transaction block
-- Caveat: if it fails midway, leaves an INVALID index → must DROP and retry
```

```sql
-- Check for invalid indexes (after failed CONCURRENTLY build):
SELECT indexname, pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_indexes
JOIN pg_class ON indexrelid = pg_class.oid
WHERE pg_class.relname = 'orders' AND NOT pg_index.indisvalid;

-- If found: DROP INDEX CONCURRENTLY idx_orders_user_id;
--           Then: CREATE INDEX CONCURRENTLY again
```

#### gh-ost and pt-online-schema-change

For truly zero-downtime migrations on large tables (MySQL), tools like `gh-ost` use a shadow table approach:

```
gh-ost approach:
  1. Create shadow table: CREATE TABLE orders_new LIKE orders;
  2. Apply DDL change to shadow table: ALTER TABLE orders_new ADD COLUMN notes TEXT;
  3. Async copy: INSERT INTO orders_new SELECT * FROM orders (batched, throttled)
  4. Stream changes: capture binlog → apply to orders_new (keeps shadow in sync)
  5. Cutover: RENAME TABLE orders TO orders_old, orders_new TO orders;
     (atomic rename — very fast, minimal lock window ~1 second)
  6. Drop old table: DROP TABLE orders_old;

Result: Live table is always available; migration happens on shadow; cutover is atomic.
PostgreSQL equivalent: pg_repack (handles table rewrite for VACUUM FULL without locking)
```

#### Migration Tooling Best Practices

```
Flyway / Liquibase:
  - Version-controlled migration scripts
  - Applied in sequence (V1__create_users.sql, V2__add_index.sql)
  - Tracks which migrations have run in flyway_schema_history table
  - NEVER edit applied migrations (they're immutable history)
  
Rules for production-safe migrations:
  1. Every migration must be backward compatible — the old app must still work
     after the migration runs (for zero-downtime deployments)
  2. Never DROP column or table in the same deploy that removes the code
     (deploy without the code first, drop in a follow-up migration)
  3. Always use CONCURRENTLY for index creation
  4. Always use NOT VALID for new constraints, then VALIDATE separately
  5. Batch large data migrations with sleep/throttling
  6. Test migration duration on prod-size data in staging before running prod
```

### 6. Connection Pooling

Every connection to PostgreSQL consumes memory (~5-10 MB per connection) and a backend process. At 200 connections, PostgreSQL uses 1-2 GB just for connection overhead.

**PgBouncer — the standard PostgreSQL connection pooler:**

```
Application connections → PgBouncer → PostgreSQL connections

PgBouncer modes:
  Session mode: one PostgreSQL connection per client session (barely helps)
  Transaction mode: one PostgreSQL connection per transaction (RECOMMENDED)
    → 1,000 application connections × avg. 1% active at once = 10 PostgreSQL connections
    → 10 connections × 10 MB = 100 MB (vs 1,000 connections × 10 MB = 10 GB)
  Statement mode: one connection per SQL statement (very restricted — no transactions)

Configuration:
  max_client_conn = 10000   (total app connections PgBouncer accepts)
  default_pool_size = 25    (PostgreSQL connections per database/user pair)
  max_db_connections = 100  (total PostgreSQL connections)
  pool_mode = transaction
  server_idle_timeout = 600 (close idle PostgreSQL connections after 10 min)

Caveats of transaction mode:
  - SET LOCAL, SET SESSION, LISTEN/NOTIFY, prepared statements (named) require session mode
  - Advisory locks (connection-scoped) require session mode
  - Spring Boot default behavior: disable statement caching for PgBouncer compat.
  - Workaround: use SET LOCAL inside transaction, not outside
```

**HikariCP — the standard Java connection pool:**
```java
HikariConfig config = new HikariConfig();
config.setJdbcUrl("jdbc:postgresql://localhost:5432/mydb");
config.setMaximumPoolSize(10);         // Never more than 10 DB connections per JVM
config.setMinimumIdle(5);              // Maintain 5 idle connections
config.setConnectionTimeout(3000);    // 3s to get a connection from pool (not DB connect)
config.setIdleTimeout(600000);        // 10min idle before closing
config.setMaxLifetime(1800000);       // 30min max connection lifetime (prevents stale)
config.setKeepaliveTime(60000);       // Send keepalive every 60s (detect network drops)

// Key insight: pool size should be small!
// Benchmark: Postgres performs best with pool_size = (CPU_cores * 2) + effective_spindle_count
// For an 8-core machine with 1 NVMe: pool_size = 8 * 2 + 1 = 17
// More connections → more context switching → SLOWER
```

**Pool sizing formula (from HikariCP docs):**
```
pool_size = (core_count × 2) + effective_spindle_count
  core_count: CPU cores available to PostgreSQL (not the app server)
  effective_spindle_count: 1 for SSD/NVMe, 0 for pure in-memory

Example: 4-core PostgreSQL server, NVMe SSD:
  pool_size = (4 × 2) + 1 = 9 connections per app instance
  
At 10 app instances: 10 × 9 = 90 PostgreSQL connections (manageable)

Common mistake: setting pool_size=100 per instance × 10 instances = 1,000 PostgreSQL connections
→ PostgreSQL max_connections=200 exceeded → "too many connections" errors on startup
```

### 7. Read Replicas — Scaling Reads

PostgreSQL streaming replication: the primary ships WAL segments to standbys, which replay them.

```
Topology:
  Primary (writes + reads)
    ├── Standby 1 (reads + HA failover candidate)
    ├── Standby 2 (reads)
    └── Standby 3 (analytics — can lag hours, off critical path)

Replication lag:
  Synchronous: standby must confirm WAL write before primary commits
    → Zero data loss, but adds latency (primary waits for standby ACK)
    → Availability risk: if standby is down, primary cannot commit
    
  Asynchronous: primary commits without waiting for standby
    → Low primary latency, but standby lags (usually 0-100ms, can be more under load)
    → Data loss risk: if primary crashes, uncommitted WAL not yet on standby is lost
    → Common: asynchronous replication + HA failover (accept small RPO)

Routing:
  Write → Primary
  Read (user profile, product catalog) → any standby (stale OK)
  Read (user's own data, just written) → primary or replica at same LSN
```

**Replication lag monitoring:**
```sql
-- On primary: check how far behind each standby is
SELECT client_addr,
       state,
       sent_lsn - write_lsn AS write_lag_bytes,
       sent_lsn - flush_lsn AS flush_lag_bytes,
       sent_lsn - replay_lsn AS replay_lag_bytes,
       (now() - reply_time) AS reply_delay
FROM pg_stat_replication;

-- Alert: replay_lag_bytes > 10MB (replica more than 10MB behind)
-- Alert: reply_delay > 30s (replica hasn't reported in 30 seconds)
```

**Read-your-own-writes with replicas:**
```
Problem: User writes profile update → routed to primary.
         User reads profile → routed to standby (may lag 100ms).
         User sees stale profile immediately after their own update. Confusing.

Solution 1: Route reads to primary for 1 second after any write (session state)
Solution 2: Return WAL LSN in write response, route reads to replica where replay_lsn >= LSN
Solution 3: Read from primary for user's own data always (replica for catalog/feed data)
```

### 8. Partitioning (Sharding)

When a single PostgreSQL instance cannot handle the data volume or write rate, partition the data across multiple instances.

#### Table Partitioning (Vertical Scale First)

PostgreSQL native table partitioning — partition one table into child tables on the same instance:

```sql
-- Range partitioning by date:
CREATE TABLE orders (
    id BIGINT,
    user_id BIGINT,
    created_at TIMESTAMPTZ,
    status TEXT,
    total NUMERIC
) PARTITION BY RANGE (created_at);

CREATE TABLE orders_2024_01 PARTITION OF orders
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE orders_2024_02 PARTITION OF orders
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
-- ... and so on

-- Benefits:
-- Query pruning: WHERE created_at > '2024-01-01' → only scans relevant partitions
-- Dropping old data: DROP TABLE orders_2023_01 (instant, no VACUUM needed)
-- Index per partition: smaller indexes, faster maintenance
-- Parallel query across partitions

-- Hash partitioning (distribute writes evenly):
CREATE TABLE orders PARTITION BY HASH (user_id);
CREATE TABLE orders_0 PARTITION OF orders FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE orders_1 PARTITION OF orders FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE orders_2 PARTITION OF orders FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE orders_3 PARTITION OF orders FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```

#### Horizontal Sharding (Multiple PostgreSQL Instances)

When one instance is genuinely insufficient, shard across multiple databases:

```
Sharding by user_id:
  Shard 0: users where user_id % 4 == 0  → PostgreSQL instance A
  Shard 1: users where user_id % 4 == 1  → PostgreSQL instance B
  Shard 2: users where user_id % 4 == 2  → PostgreSQL instance C
  Shard 3: users where user_id % 4 == 3  → PostgreSQL instance D

Routing (application-level):
  shard = user_id % num_shards
  db_connection = shard_connections[shard]
  db_connection.execute(query)

Problems introduced by sharding:
  1. Cross-shard queries: "show all pending orders" → must query all shards + merge
  2. Cross-shard transactions: debit user on shard 0, credit user on shard 1
     → no ACID without distributed 2PC (see Chapter 8)
  3. Shard rebalancing: adding a 5th shard requires moving data → complex
  4. Schema migrations: must run on all shards in sequence
  5. Global sequences: auto-increment IDs are per-shard → ULIDs or UUID instead

Sharding keys must be chosen wisely:
  BAD: shard by order_status → "pending" shard gets all writes (hot shard)
  GOOD: shard by user_id → writes spread evenly (assuming even user distribution)
  
  Hot shard: one shard receives disproportionate traffic
  → Usually means shard key has low cardinality or hot users
  → Fix: consistent hashing (not modulo) + virtual nodes
```

**Citus — PostgreSQL horizontal scaling:**
Citus is a PostgreSQL extension that provides transparent sharding across multiple PostgreSQL nodes. Queries are routed automatically; cross-shard queries are distributed and merged.

```sql
-- Citus: distribute a table across nodes
SELECT create_distributed_table('orders', 'user_id');
-- Citus: all queries to orders are automatically routed to the right shard
-- Cross-shard queries: Citus distributes and aggregates
```

### 9. Common SQL Performance Anti-Patterns

#### N+1 Queries
```
Code:
  users = db.query("SELECT * FROM users LIMIT 100")
  for user in users:
      orders = db.query("SELECT * FROM orders WHERE user_id = ?", user.id)

SQL executed: 1 (for users) + 100 (one per user) = 101 queries
At 1ms/query: 101ms. At 10ms/query (production): 1,010ms.

Fix: JOIN or subquery:
  SELECT u.*, o.*
  FROM users u
  LEFT JOIN orders o ON o.user_id = u.id
  WHERE u.id IN (SELECT id FROM users LIMIT 100)
  → 1 query, same result, 10ms

Or: batch fetch:
  users = db.query("SELECT * FROM users LIMIT 100")
  user_ids = [u.id for u in users]
  orders_by_user = db.query("SELECT * FROM orders WHERE user_id = ANY(?)", user_ids)
    .group_by(lambda o: o.user_id)
  → 2 queries total regardless of N
```

#### Missing Index on Foreign Key
```sql
-- Every table with a foreign key should have an index on the FK column:
CREATE TABLE orders (
    id BIGINT PRIMARY KEY,
    user_id BIGINT REFERENCES users(id)  -- FK declared...
);
-- BUT: PostgreSQL does NOT automatically create an index on user_id!
-- Every JOIN from orders to users ON orders.user_id = users.id:
--   → SeqScan on orders (no index on user_id)
--   → For 1M orders: 1M rows scanned per lookup

-- Fix:
CREATE INDEX CONCURRENTLY idx_orders_user_id ON orders(user_id);

-- Detect missing FK indexes:
SELECT tc.table_name, kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
LEFT JOIN pg_indexes pi
  ON pi.tablename = tc.table_name AND pi.indexdef LIKE '%' || kcu.column_name || '%'
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND pi.indexname IS NULL;
```

#### Implicit Type Conversion Killing Indexes
```sql
-- Schema: user_id is BIGINT
-- Query: WHERE user_id = '12345'  (string literal)

-- PostgreSQL must cast '12345'::TEXT to BIGINT for every row comparison
-- Result: no index can be used → SeqScan

-- EXPLAIN shows: Filter: ((user_id)::text = '12345'::text) -- implicit cast
-- Fix: use the correct type in the query: WHERE user_id = 12345 (no quotes)

-- In ORM: ensure parameter type matches column type
-- Java: preparedStatement.setLong(1, userId)  not  setString(1, userId.toString())
```

#### SELECT * in OLTP Queries
```sql
-- BAD: fetches all 50 columns even though only 3 are used
SELECT * FROM orders WHERE user_id = 123;

-- GOOD: covering index possible, fetches only needed columns
SELECT order_id, status, total FROM orders WHERE user_id = 123;
-- With index (user_id, order_id, status, total): index-only scan, no heap fetch

-- GOOD: projecting at the DB level reduces network transfer + serialization cost
```

---

## Step-by-Step Execution

### Diagnosing a Slow Query in Production

```
Symptom: p99 latency for GET /orders?userId=789 spikes to 8,000ms.

Step 1: Find slow queries
  SELECT pid, now() - pg_stat_activity.query_start AS duration, query
  FROM pg_stat_activity
  WHERE (now() - pg_stat_activity.query_start) > interval '2 seconds'
  AND state != 'idle';
  
  → Query found: SELECT * FROM orders WHERE user_id=789 ORDER BY created_at DESC LIMIT 25
  → Duration: 7,891ms (running)

Step 2: EXPLAIN ANALYZE
  EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
  SELECT * FROM orders WHERE user_id=789 ORDER BY created_at DESC LIMIT 25;
  
  → Seq Scan on orders  (cost=0.00..245832.00 rows=1 width=892)
      Filter: (user_id = 789)
      Rows Removed by Filter: 4,999,983
      Buffers: shared hit=1234 read=97654
  → Total rows: 5,000,000. Filter scanned all 5M rows to find 17 rows.
  
  Diagnosis: FULL TABLE SCAN. No index on user_id.

Step 3: Check existing indexes
  SELECT indexname, indexdef FROM pg_indexes WHERE tablename='orders';
  → Only: idx_orders_pkey (on id). No index on user_id. Confirmed.

Step 4: Create index (online, no downtime)
  CREATE INDEX CONCURRENTLY idx_orders_user_id_created
  ON orders(user_id, created_at DESC);
  
  -- Takes 4 minutes on 5M rows, no blocking.

Step 5: Re-run EXPLAIN ANALYZE
  → Index Scan using idx_orders_user_id_created (cost=0.56..89.23 rows=25 width=892)
      Index Cond: (user_id = 789)
      Buffers: shared hit=4
  → Total: 4 buffer reads (vs 97,654 reads before). 
  → Query time: 0.8ms (vs 7,891ms). 9,864× improvement.
```

---

## Deep Dive

### PostgreSQL MVCC and VACUUM Internals

From Chapter 7: every row has `xmin` (transaction that created it) and `xmax` (transaction that deleted/updated it). Under MVCC, old row versions accumulate as "dead tuples."

**VACUUM's job:** Mark dead tuples as reusable, update the free space map, update visibility map (used for index-only scans), advance `xmin_horizon` so the transaction ID space doesn't wrap around.

**Transaction ID Wraparound — the most dangerous PostgreSQL failure mode:**
```
PostgreSQL uses 32-bit transaction IDs (TXIDs).
Max TXID: 2^32 = 4,294,967,296 (~4 billion)

PostgreSQL reserves IDs 0-2 (frozen) and uses modular arithmetic for age.
A row is "in the future" if its TXID is more than 2^31 (~2B) transactions ahead.

When TXID approaches the max:
  PostgreSQL starts warning: "WARNING: database must be vacuumed within N transactions"
  
  If VACUUM is not run and TXID wraps around:
  ALL existing rows appear to be "in the future" → invisible to queries
  Database enters a "transaction ID exhausted" state
  ONLY recovery: run VACUUM FREEZE in emergency single-user mode
  = FULL DOWNTIME for potentially hours on large databases

This has happened in production (Sentry, 2015: ~12 hours downtime).

Prevention:
  autovacuum: never disable it. Monitor:
  SELECT datname, age(datfrozenxid), current_setting('autovacuum_freeze_max_age')
  FROM pg_database
  ORDER BY age(datfrozenxid) DESC;
  
  Alert: if age > 1.5 billion → run manual VACUUM FREEZE ANALYZE immediately
  Alert: if age > 2 billion → emergency (database will go down soon)
```

### PostgreSQL Configuration for OLTP (Quick Reference)

```sql
-- postgresql.conf: tuning for OLTP on a 64GB RAM, NVMe SSD server

shared_buffers = 16GB              -- 25% of RAM (for buffer pool)
effective_cache_size = 48GB        -- hint to planner (shared_buffers + OS page cache)
work_mem = 64MB                    -- memory per sort/hash operation (× connections)
maintenance_work_mem = 2GB         -- memory for VACUUM, CREATE INDEX

wal_buffers = 64MB                 -- WAL buffer (auto-sized to shared_buffers/32)
checkpoint_completion_target = 0.9 -- spread checkpoints over 90% of checkpoint interval
max_wal_size = 4GB                 -- max WAL before forcing a checkpoint

max_connections = 200              -- hard limit (use PgBouncer in front)
effective_io_concurrency = 200     -- for NVMe SSDs (parallel I/O requests)
random_page_cost = 1.1             -- NVMe SSD (vs 4.0 default for HDD)
                                   -- lower value: planner prefers index scans

autovacuum = on                    -- NEVER turn off
autovacuum_vacuum_scale_factor = 0.05  -- VACUUM when 5% of table is dead (not 20%)
autovacuum_analyze_scale_factor = 0.02 -- ANALYZE when 2% of table changed

log_min_duration_statement = 200ms -- log slow queries (>200ms)
log_lock_waits = on                -- log lock wait events
track_io_timing = on               -- I/O timing for EXPLAIN ANALYZE
```

---

## Real-World Example

### The Sentry TXID Wraparound Incident (2015)

Sentry (error tracking service) experienced a production outage caused by PostgreSQL transaction ID wraparound.

**Timeline:**
- Autovacuum was configured but running too slowly for their write rate.
- TXID age grew steadily over months.
- At ~2 billion TXID age, PostgreSQL began refusing new transactions: "database is not accepting commands to avoid wraparound data loss."
- Sentry went down. The database was serving read-only traffic from a replica.
- Recovery: VACUUM FREEZE on all tables — took ~12 hours.

**Root cause monitoring failure:** No alert was configured for `age(datfrozenxid)`. The warning logs were present but not surfaced to oncall.

**Prevention:**
```sql
-- Alert query (run in monitoring, alert if result > 1.5 billion):
SELECT datname,
       age(datfrozenxid) AS txid_age,
       2000000000 - age(datfrozenxid) AS transactions_until_shutdown
FROM pg_database
WHERE datname NOT IN ('template0', 'template1')
ORDER BY age(datfrozenxid) DESC;
```

---

## Failure Scenarios

### Scenario 1: Long Transaction Causes Lock Queue Cascade

```
11:00 AM: DBA runs a data quality check:
  BEGIN;
  SELECT COUNT(*) FROM orders WHERE status='pending';
  -- Analyst gets distracted. Transaction left open. Idle.

11:15 AM: Scheduled migration runs:
  ALTER TABLE orders ADD COLUMN notes TEXT DEFAULT '';
  -- Requests ACCESS EXCLUSIVE lock on orders table.
  -- But: DBA's transaction holds ACCESS SHARE lock.
  -- Migration BLOCKS waiting for DBA's lock to release.

11:15 AM onward: Every new query to the orders table:
  "SELECT * FROM orders WHERE..." → blocks (queued behind the ALTER TABLE lock request)
  Even reads block (ACCESS EXCLUSIVE conflicts with ACCESS SHARE).
  500+ connections queue up waiting.

11:20 AM: DBA's terminal is closed (session ends → transaction rolled back).
  Migration proceeds: ALTER TABLE → acquires lock → runs → releases.
  500+ queued queries all release simultaneously → thundering herd.
  Database load spikes to 100× normal. Secondary cascading failure.

Root cause: Idle transaction held lock for 15 minutes.

Prevention:
  1. idle_in_transaction_session_timeout = '5 min' in postgresql.conf
     (automatically terminates sessions idle in transaction > 5 minutes)
  2. lock_timeout = '5s' on migration scripts
     (fail fast if can't acquire lock in 5s, rather than blocking indefinitely)
  3. Monitor: SELECT * FROM pg_stat_activity WHERE state='idle in transaction'
     → alert if any session idle in transaction > 2 minutes
```

### Scenario 2: Write Skew Causing Double Discount

```
Constraint: a user can use at most one promotional coupon per order.

Code (READ COMMITTED, no explicit locking):
  def apply_coupon(user_id, order_id, coupon_code):
      # Check if user already has a coupon on this order
      existing = db.query("SELECT id FROM order_coupons WHERE order_id=?", order_id)
      if existing:
          raise ValueError("Coupon already applied")
      # Apply the coupon
      db.execute("INSERT INTO order_coupons (order_id, coupon_code) VALUES (?,?)",
                 order_id, coupon_code)

Two concurrent requests (race condition):
  T1: SELECT → no coupons → INSERT coupon "SAVE10"
  T2: SELECT → no coupons (reads before T1 commits) → INSERT coupon "SAVE20"
  Both commit successfully.
  order_coupons: {order_id=123, coupon="SAVE10"}, {order_id=123, coupon="SAVE20"}
  User gets both discounts. Business loss.

Fix 1: Unique constraint (let DB enforce invariant):
  ALTER TABLE order_coupons ADD CONSTRAINT one_coupon_per_order UNIQUE (order_id);
  → T2's INSERT → unique violation → application handles gracefully.
  
Fix 2: SELECT FOR UPDATE (pessimistic lock):
  existing = db.query(
    "SELECT id FROM orders WHERE id=? FOR UPDATE", order_id)
  -- Locks the order row. T2 blocks on the FOR UPDATE until T1 commits.
  -- T2 then reads and finds the coupon already applied.
  
Fix 3: SERIALIZABLE isolation:
  BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
  -- SSI detects the write skew → aborts one transaction → application retries.
```

---

## Performance Considerations

### Query Planning — Why `ANALYZE` Matters

```
PostgreSQL query planner uses statistics to choose execution plans.
Statistics are updated by ANALYZE (run as part of AUTOVACUUM).

Table: orders (5M rows)
  Before ANALYZE:
    Planner estimates: 1,000 rows matching user_id=789
    Chooses: Seq Scan (estimates it's cheaper than index for "1,000 rows out of 5M")
    
  After ANALYZE:
    Actual: user 789 has 17 orders (0.0003% of table)
    Planner estimates: 17 rows
    Chooses: Index Scan (correct choice for 17 rows)

Statistics:
  pg_statistic: per-column statistics (distinct values, most common values, histogram)
  pg_stats: human-readable view of pg_statistic

Forcing ANALYZE after bulk import:
  ANALYZE orders;  -- update statistics for the table

Checking statistics quality:
  SELECT attname, n_distinct, correlation, most_common_vals
  FROM pg_stats
  WHERE tablename='orders' AND attname='user_id';
  
  correlation: 1.0 = perfectly sorted (index scan very cheap)
               0.0 = random order (index scan more expensive per row)
```

### The Cost of Transactions Per Second

```
PostgreSQL OLTP throughput limits (per core, NVMe SSD):
  Simple SELECT (from buffer pool): 100,000+ TPS
  Simple INSERT with WAL fsync: 10,000-30,000 TPS (fsync is the bottleneck)
  Complex SELECT with index joins: 5,000-20,000 TPS (CPU bound)
  
With group commit (many concurrent sessions):
  Individual txn latency: 1-5ms (fsync)
  Throughput: 10,000+ TPS (fsync amortized across concurrent commits)
  
Memory: work_mem × max_connections × sort operations per query
  work_mem=64MB × 200 connections × 2 sort operations = 25.6GB
  → Can exceed physical RAM if many concurrent complex queries
  Solution: smaller work_mem for OLTP (4-16MB); larger work_mem for analytics sessions
```

---

## Trade-offs

| Decision | Benefit | Cost |
|----------|---------|------|
| READ COMMITTED (default) | Higher throughput, fewer retries | Non-repeatable reads, write skew possible |
| SERIALIZABLE | No anomalies | Serialization failures require retries, ~10-20% overhead |
| Pessimistic locking (FOR UPDATE) | No retries needed | Reduces concurrency, risk of deadlocks |
| Optimistic locking (version check) | High concurrency | Retry logic required on conflict |
| Large connection pool | More concurrent operations | PostgreSQL process overhead, context switching |
| PgBouncer transaction pooling | 10× fewer PostgreSQL connections | Advisory locks, prepared statements, LISTEN/NOTIFY incompatible |
| Synchronous replication | Zero data loss | Standby failure stalls commits |
| Asynchronous replication | Better write throughput | Up to seconds of data loss on failover |
| Horizontal sharding | Unlimited scale | Cross-shard queries, no cross-shard ACID |
| Table partitioning | Pruning, fast DROP | Cross-partition queries less efficient |

---

## Production Considerations

1. **Always run with `idle_in_transaction_session_timeout`.** Set to 5 minutes. An idle open transaction will block migrations and cause lock cascade failures. This setting automatically terminates them.
2. **Use `lock_timeout` on all migrations.** `SET lock_timeout = '5s'` before any DDL. If the lock can't be acquired in 5 seconds (another transaction is holding it), fail fast. Do not let migrations queue indefinitely while blocking all other queries.
3. **Monitor TXID age.** Alert at 1.5 billion. Run `VACUUM FREEZE ANALYZE` on large tables before age reaches 2 billion. Never disable autovacuum.
4. **Size connection pools conservatively.** Total connections = pool_size_per_app × num_app_instances must be ≤ `max_connections` - 10 (reserve for admin connections). Use PgBouncer to stay well under `max_connections`.
5. **Test migrations on production-size data.** A migration that takes 2 seconds on 100K rows takes 20 minutes on 10M rows. Always test in a staging environment restored from production data.
6. **Create indexes CONCURRENTLY.** Never `CREATE INDEX` without `CONCURRENTLY` on a live table. The same applies to `DROP INDEX CONCURRENTLY`.

---

## Common Beginner Mistakes

1. **Using `SELECT *` everywhere.** Returns all columns regardless of need. Prevents index-only scans, increases network transfer, serialization cost, and memory usage.
2. **Not indexing foreign keys.** PostgreSQL does not auto-create FK indexes. Every FK column that is used in JOINs or WHERE clauses needs an explicit index.
3. **Running `ALTER TABLE` without understanding lock implications.** `ALTER TABLE ADD COLUMN` is fast (catalog update). `ALTER TABLE ADD COLUMN DEFAULT 'x'` in older PostgreSQL rewrites the entire table (ACCESS EXCLUSIVE for hours). Know which DDL operations require table rewrites.
4. **Putting business logic in long transactions.** Calling external services, doing complex computation, or sleeping inside a `BEGIN...COMMIT` block holds locks and connection resources for the entire duration.

---

## Common Senior Engineer Mistakes

1. **Defaulting to SERIALIZABLE for all transactions "to be safe."** SERIALIZABLE requires retry logic in the application (serialization failure exceptions must be caught and retried). Without retry logic, SERIALIZABLE just means "random transaction failures." Implement retry logic or use targeted FOR UPDATE instead.
2. **Not accounting for `work_mem` × connections in memory planning.** `work_mem=64MB` seems reasonable. With 200 connections doing complex queries with 3 sort operations: 64MB × 200 × 3 = 38.4 GB — more than total RAM. PostgreSQL may start swapping. Set `work_mem` smaller for OLTP (8-16 MB).
3. **Using modulo-based sharding without planning for rebalancing.** `user_id % 4 = shard` works until you need 5 shards — then you must move 80% of data. Consistent hashing (virtual nodes) reduces rebalancing to ~1/N of data.

---

## Architecture Smells

- **No connection pooler (PgBouncer) in front of PostgreSQL** → application connects directly → `max_connections` exhausted under traffic spike
- **Migration scripts without `CONCURRENTLY`** → every deploy that adds an index causes a write outage
- **`EXPLAIN ANALYZE` never run on queries in code review** → O(N) queries deployed without discovery
- **Long-running transactions with external calls inside** → holding locks while waiting for network → lock cascade risk
- **Autovacuum disabled or heavily throttled on write-heavy tables** → TXID wraparound risk, table bloat, dead index pages
- **No alert on replication lag** → standby silently falls days behind → stale reads nobody notices

---

## Principal Engineer Perspective

SQL databases are not plug-and-play infrastructure. They are a complex system that rewards deep understanding and punishes ignorance. Most "database performance problems" are not database problems — they are application problems: wrong isolation level, wrong query, wrong index, wrong transaction scope.

**The Principal Engineer's mental model for SQL at scale:**

1. **Isolation level as a first-class design decision.** Before writing any transaction, ask: what anomalies can occur here? Do I need non-repeatable-read protection (Repeatable Read)? Can write skew occur (need Serializable)? Is a lost update possible (need FOR UPDATE or atomic update)?

2. **Lock scope and duration are the primary scaling constraint.** Long transactions are the enemy. Short transactions, minimal lock scope, `SKIP LOCKED` for queue patterns — these are the tools of a database-aware engineer.

3. **Schema migrations as a deployment risk.** Every migration is a potential production incident. Every migration must be reviewed for: lock implications, duration on production-size data, rollback path, application compatibility during and after the migration.

4. **The database is not infinitely scalable.** Know the scaling ceiling of your PostgreSQL configuration. At 100K TPS on a single node, you're at the limit. Plan for read replicas (10× reads) and eventually sharding (10× writes). But exhaust vertical scaling (more RAM, faster NVMe) before horizontal sharding — sharding is enormously complex.

**Reading `EXPLAIN ANALYZE` output is a core skill** for any engineer who writes SQL that runs in production. If you cannot read a query plan, you cannot know whether your query will work for 1M rows or fall apart at 10M. Require `EXPLAIN ANALYZE` output (on staging data) for any new query touching tables > 100K rows, in code review.

---

## Architecture Review Questions

1. What is the isolation level for each critical transaction in the system? Is it intentional?
2. Are there any write skew risks? (Read a condition, make a decision, write to a different row based on the condition.) If so, are they protected by SERIALIZABLE or FOR UPDATE?
3. What is the total PostgreSQL connection count under peak load? Does it fit within `max_connections`?
4. Is PgBouncer (or equivalent) deployed in front of PostgreSQL?
5. Is `idle_in_transaction_session_timeout` configured?
6. What is the procedure for schema migrations? Are they tested on production-size data?
7. Are all new indexes created with `CONCURRENTLY`?
8. What is the TXID age? When was the last full VACUUM FREEZE?
9. Are all foreign key columns indexed?
10. What is the replication lag? Is there an alert when it exceeds a threshold?

---

## Visual / Animation Specification

### Animation 1: Write Skew — The Doctor On-Call Problem

**Three panels: Database State, Transaction 1 (Alice), Transaction 2 (Bob).**

**T=0:** Database shows on-call roster: `Alice: ON, Bob: ON`. Both TX read roster simultaneously.

**T=1:** Alice's TX: "Count = 2. I can go off-call." Bob's TX: "Count = 2. I can go off-call."

**T=2:** Alice's TX writes: `Alice: OFF`. Commits (green checkmark).

**T=3:** Bob's TX writes: `Bob: OFF`. Commits (green checkmark).

**T=4:** Database shows: `Alice: OFF, Bob: OFF`. Red alert: "NO DOCTORS ON CALL!"

**Panel 2 (Fixed with SERIALIZABLE):**
Same scenario. T=3: Bob's TX gets: "ERROR: serialization failure — concurrent modification detected." Red X.
Bob's TX retries. Reads: `Alice: OFF, Bob: ON`. Count = 1. "Cannot go off-call (only 1 remaining)." Bob stays on-call.
Database: `Alice: OFF, Bob: ON`. Green checkmark. Invariant maintained.

### Animation 2: Zero-Downtime Migration — Expand-Contract

**Timeline view with three phases shown as colored bands.**

**Phase 1 (Green — Expand):**
`ALTER TABLE users ADD COLUMN full_name TEXT` — instant (0.01s, no lock).
Batched UPDATE animates: rows 1-1000 updated, pause, 1001-2000, pause... (no lock held).
App code deploys: writes BOTH user_name AND full_name.

**Phase 2 (Yellow — Migrate):**
App reads from full_name primarily. Both columns populated.
Verify: `SELECT COUNT(*) FROM users WHERE full_name IS NULL → 0`.

**Phase 3 (Red — Contract):**
App code no longer writes user_name.
`ALTER TABLE users DROP COLUMN user_name` — brief ACCESS EXCLUSIVE lock (< 100ms).
Columns: only full_name remains.

**Caption:** "90-day rename with zero downtime. vs 2-minute outage with direct rename."

---

## Hands-On Tutorial

### Query Analysis and Index Optimization

```sql
-- 1. Enable timing and analysis
\timing on

-- 2. Create a test table with data
CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    status TEXT NOT NULL,
    total NUMERIC(10,2),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert 5M rows
INSERT INTO orders (user_id, status, total, created_at)
SELECT
    (random() * 100000)::BIGINT,
    (ARRAY['pending','fulfilled','cancelled'])[ceil(random()*3)],
    (random() * 500)::NUMERIC(10,2),
    now() - (random() * 365)::INT * interval '1 day'
FROM generate_series(1, 5000000);

ANALYZE orders;

-- 3. Baseline: query without index
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE user_id = 42345 ORDER BY created_at DESC LIMIT 25;
-- Observe: Seq Scan, millions of rows filtered, slow

-- 4. Create covering index
CREATE INDEX CONCURRENTLY idx_orders_user_status_date
ON orders(user_id, created_at DESC)
INCLUDE (status, total);

-- 5. Re-run with index
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, status, total, created_at
FROM orders WHERE user_id = 42345 ORDER BY created_at DESC LIMIT 25;
-- Observe: Index Only Scan (covers all needed columns), 4 buffer reads, fast

-- 6. Test isolation levels
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT COUNT(*) FROM orders WHERE status = 'pending';
-- In another session: INSERT INTO orders (user_id, status, total) VALUES (1,'pending',10);
-- COMMIT in other session.
SELECT COUNT(*) FROM orders WHERE status = 'pending';
-- PostgreSQL RR: same count (snapshot isolation prevents phantom in current TX)
COMMIT;
```

---

## Failure Injection Lab

### Lab: Inducing and Recovering from a Lock Cascade

```sql
-- Terminal 1: Simulate long idle transaction (the "DBA distraction")
BEGIN;
SELECT COUNT(*) FROM orders;
-- Leave this open (do not COMMIT or ROLLBACK)

-- Terminal 2: Try to run a migration
SET lock_timeout = '3s';
ALTER TABLE orders ADD COLUMN priority INT DEFAULT 0;
-- → Should timeout after 3 seconds: "ERROR: canceling statement due to lock timeout"
-- WITHOUT lock_timeout: this would block indefinitely

-- Terminal 3: Observe the lock queue
SELECT pid, wait_event_type, wait_event, query_start, state, query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;
-- → See Terminal 1's idle transaction holding lock
-- → See Terminal 2's ALTER TABLE waiting

-- Kill the idle transaction (Terminal 1):
SELECT pg_terminate_backend(<pid_of_terminal_1>);
-- → Terminal 2's ALTER TABLE now proceeds (or already timed out)

-- Verify idle_in_transaction_session_timeout would have caught this:
ALTER SYSTEM SET idle_in_transaction_session_timeout = '30s';
SELECT pg_reload_conf();
-- Now, repeat: Terminal 1's transaction will auto-terminate after 30 seconds
```

---

## Exercises

**Conceptual:**
1. Explain the ACID guarantee for Atomicity. What mechanism in PostgreSQL implements it?
2. Describe the write skew anomaly. At which isolation level is it prevented? Why is it NOT prevented at Repeatable Read?
3. What is PostgreSQL's SSI (Serializable Snapshot Isolation)? How does it differ from lock-based serializability?
4. Why does `CREATE INDEX` without `CONCURRENTLY` cause an outage on a live table? What lock does it take?
5. What is the danger of transaction ID wraparound? How do you monitor for it?

**Architecture:**
6. Design a zero-downtime migration to add a NOT NULL column `region TEXT NOT NULL DEFAULT 'us-east-1'` to a 500M-row orders table in PostgreSQL. List every step with its lock implications.
7. A system has 50 microservices, each with their own connection pool of 20 connections, all pointing to one PostgreSQL instance with `max_connections=200`. Traffic doubles. Diagnose the problem and propose a solution.
8. Design the sharding strategy for an e-commerce orders database that needs to scale to 1 billion orders. Which shard key would you choose? What are the cross-shard query implications?

**Quantitative:**
9. A PostgreSQL table has 10M rows, 200 bytes per row. No index on `status` column. A query `SELECT * FROM orders WHERE status='pending'` returns 1% of rows. Calculate the number of 8KB pages read for a full table scan. How many pages would an index scan read (assuming 1 index lookup + heap fetch per result row)?
10. Your system commits 5,000 transactions/second. How many transactions per day? How many days until TXID age reaches 2 billion (the danger threshold)? What autovacuum setting prevents this?

---

## Solutions

### Exercise 9
Table size = 10M rows × 200 bytes = 2 GB.
Pages = 2 GB / 8 KB = **256,000 pages** read in a full table scan.

Index scan: 1% of 10M = 100,000 matching rows.
Each row = 1 index lookup + 1 heap page read (if not covering index).
Heap pages: 100,000 rows, ~40 rows per page → 100,000 / 40 = **2,500 unique heap pages** read.
Index B-tree: depth ~4 for 10M rows → 4 index pages per lookup → but in practice the upper pages are cached → ~1-2 pages per lookup after warmup.
Total: ~2,500 heap reads + ~100,000 index reads (one per row, but mostly cached upper levels) ≈ **2,500–5,000 actual I/Os**.
Full scan: **256,000 pages** vs Index scan: **~2,500-5,000 pages** → 50-100× improvement.

### Exercise 10
Transactions per day = 5,000 TPS × 86,400 s = **432,000,000 transactions/day**.
Days to 2 billion TXID = 2,000,000,000 / 432,000,000 = **~4.6 days** (!).

At 5,000 TPS: autovacuum MUST freeze rows very frequently.
`autovacuum_freeze_max_age` default = 200,000,000 (200M). At 5,000 TPS, reached in 40,000 seconds = **11 hours**.
autovacuum will trigger full-table VACUUM FREEZE for each table roughly every 11 hours.
For a 500GB table: VACUUM FREEZE takes 2-4 hours → must run fast enough.
Solution: Reduce `autovacuum_freeze_max_age` to 50,000,000, increase autovacuum workers and cost limits to keep up with write rate. Also: partition by time — older partitions freeze once and never need vacuuming again.

---

## Interview Questions

### Beginner
- What does ACID stand for? Give a real-world example of why Atomicity matters.
- What is a database transaction? Why do we need them?
- What is an index? What does it cost (in terms of writes)?

### Senior
- Explain the four isolation levels and the anomalies each prevents.
- What is a lost update? How do you prevent it using (a) pessimistic locking and (b) optimistic concurrency?
- What is write skew? Give an example. What isolation level prevents it?
- How would you run a migration to add an index on a 100M-row live production table without downtime?

### Staff
- Walk through the expand-contract pattern for renaming a column in PostgreSQL. Why can't you rename it directly?
- Explain PostgreSQL's SSI. How does it detect write skew without taking read locks?
- Design a connection pooling strategy for 100 microservices instances, each with a 10-connection pool, connecting to a 3-node PostgreSQL cluster with `max_connections=500` per node.
- What is TXID wraparound and how do you prevent it?

### Principal
- A payment service is experiencing intermittent duplicate charges. The service uses READ COMMITTED isolation. Identify all possible causes (race conditions, retry behavior, distributed system issues) and propose fixes for each.
- Design the database scaling strategy for a fintech platform growing from 100K to 100M users, with ACID requirements for all financial transactions. What scaling steps would you apply in sequence, and at what thresholds?
- Your team wants to shard the orders database. Walk through the complete migration plan: how to introduce sharding without downtime, which operations break under sharding, and how you would handle them.

---

## Summary

SQL databases at scale require mastery of three interconnected disciplines: correctness under concurrency (isolation), performance under load (indexes, queries, connections), and change management under constraints (migrations).

- **ACID:** Atomicity (WAL + rollback), Consistency (constraints + application logic), Isolation (MVCC + isolation levels), Durability (WAL + fsync).
- **Anomalies:** Dirty read (prevented at Read Committed), Non-repeatable read (Repeatable Read), Phantom (Serializable), Lost update (FOR UPDATE or atomic update), Write skew (Serializable only).
- **SSI:** PostgreSQL's SERIALIZABLE uses snapshot + rw-dependency tracking instead of locks — writers don't block readers, 10-20% overhead vs 2PL's 2×.
- **Migrations:** Expand-Contract pattern for zero-downtime changes. `CREATE INDEX CONCURRENTLY`. `NOT VALID` + `VALIDATE CONSTRAINT`. Batch backfills with throttling. `lock_timeout` on all DDL.
- **Connection pooling:** PgBouncer (transaction mode) reduces 1,000+ app connections to 10-25 PostgreSQL connections. HikariCP pool size = (CPU × 2) + spindles.
- **Scaling path:** Vertical → Connection pooling → Read replicas → Table partitioning → Horizontal sharding (last resort).
- **TXID wraparound:** The silent PostgreSQL time bomb. Never disable autovacuum. Monitor `age(datfrozenxid)`. Alert at 1.5 billion.

---

## What You Should Now Be Able To Explain

- ✅ The six read/write anomalies and which isolation level prevents each
- ✅ Why write skew is not prevented at Repeatable Read — and why SSI catches it
- ✅ How to rename a column on a live 500M-row table without any downtime
- ✅ Why PostgreSQL performs best with a small connection pool (CPU × 2 formula)
- ✅ The TXID wraparound danger and how to monitor for it
- ✅ When to choose pessimistic vs optimistic vs serializable concurrency control

---

## What To Learn Next

**Chapter 13 — NoSQL Databases: Cassandra, MongoDB, and DynamoDB.** You now have deep expertise in SQL databases. Chapter 13 covers the NoSQL landscape: not as "SQL is bad" but as "different data models solve different problems." Cassandra's wide-column model for time-series writes, MongoDB's document model for flexible schemas, DynamoDB's single-table design. When to abandon relational schemas — and the specific consistency, operational, and query trade-offs you accept when you do.
