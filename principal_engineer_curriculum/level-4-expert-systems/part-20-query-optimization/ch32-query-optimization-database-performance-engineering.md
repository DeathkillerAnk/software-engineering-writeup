# Chapter 32 — Query Optimization and Database Performance Engineering

> **Difficulty:** Advanced | **Importance:** ★★★★★ | **Estimated Reading Time:** 4.5 hours

---

## Prerequisites

- Chapter 7 (Storage Engines — B-tree, heap files, buffer pool, fsync)
- Chapter 12 (SQL Databases at Scale — indexes, query plans, ACID)
- Chapter 30 (Database Replication — MVCC, dead tuples, autovacuum)
- Chapter 29 (Distributed Caching — why queries should be cached)

---

## Learning Objectives

By the end of this chapter, you will be able to:

1. Read a PostgreSQL `EXPLAIN ANALYZE` output and identify the dominant cost node, row estimation errors, and plan type mismatches
2. Explain how the cost-based optimizer uses `pg_statistic` data to estimate row counts, and how stale statistics cause catastrophically bad plans
3. Design the correct index type (B-tree, partial, expression, covering, composite) for a given query workload
4. Identify the N+1 query problem in application code and fix it with a single SQL JOIN or batch query
5. Use `pg_stat_statements` to find the top 10 queries consuming 80% of database CPU
6. Explain write amplification from over-indexing and calculate the maintenance overhead per index
7. Implement query plan stabilization using `pg_hint_plan` or materialized statistics for latency-critical queries
8. Design a connection pool configuration that prevents pool exhaustion under load spikes

---

## Why This Matters

The database is the most common performance bottleneck in production systems. A query that takes 30 seconds instead of 30 milliseconds is not a marginal problem — it is a 1000× regression that makes the feature unusable. Yet the root causes are almost always the same handful of mistakes, made repeatedly across companies and codebases:

- A missing index causes a sequential scan of 500 million rows for a query that should use an index and scan 1 row
- Stale table statistics cause the optimizer to choose a hash join over an index nested-loop join, adding 10 seconds to an otherwise instant query
- An ORM generates N+1 queries: 1 query to fetch 100 orders, then 100 separate queries to fetch each order's customer — 101 round-trips instead of 1
- A connection pool sized at 10 connections for a service handling 1000 concurrent requests means 990 requests queue, each waiting up to 30 seconds for a connection

These are not exotic edge cases. They are the bread-and-butter of production database performance work — and fixing them requires understanding the internals: how the query planner works, what statistics it uses, why it makes the choices it does, and how to guide it when it goes wrong.

This chapter gives you the systematic framework used by database engineers at Instagram, Shopify, GitLab, and Twitter to diagnose and fix query performance — not with guesswork, but with precise measurement and mechanistic understanding.

---

## Mental Model

***The query optimizer is a cost-based search engine that explores a space of possible execution plans and selects the cheapest one. Its quality is entirely dependent on the accuracy of its cost estimates, which derive from column statistics. When statistics are accurate, the optimizer finds near-optimal plans automatically. When statistics are stale or absent, the optimizer makes catastrophically wrong decisions — and no amount of hardware can compensate for a full sequential scan where an index lookup was needed. Query performance engineering is the discipline of ensuring the optimizer has accurate information, and intervening precisely when it does not.***

---

## Intuition: The Navigator Analogy

Imagine a navigator planning a road trip. They have a map (the query plan), estimated travel times (cost estimates), and real traffic data (table statistics). If the traffic data is accurate, the navigator finds the optimal route. If the traffic data is wrong (it says the highway is empty, but it's actually gridlocked), the navigator chooses a route that takes 4 hours instead of 40 minutes.

The query optimizer is this navigator. The "traffic data" is `pg_statistic` — the histogram of value distributions for each column. When you run `ANALYZE`, you update the traffic data. When statistics are stale (the table grew from 1 million to 100 million rows but `ANALYZE` wasn't run), the navigator routes down a gridlocked highway (sequential scan on 100 million rows) when a clear side road (index on 1 million matching rows) exists.

Your job as a performance engineer is to:
1. Verify the traffic data is current (statistics are fresh)
2. Verify the map includes all the roads (indexes exist for the query)
3. Read the route the navigator chose (EXPLAIN ANALYZE)
4. Intervene when the navigator makes a provably wrong choice

---

## Visual Explanation: Query Execution Plan Tree

```
Query: SELECT o.id, c.name, p.title
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       JOIN products p ON p.id = o.product_id
       WHERE o.created_at > '2024-01-01'
         AND o.status = 'completed';

EXPLAIN ANALYZE output (annotated):

Gather  (cost=1234.5..98234.1 rows=12450 width=64)
│       (actual time=45.2..3421.8 rows=12847 loops=1)
│
│  ← "Gather" = merge results from parallel workers
│  ← cost=1234.5: startup cost (before first row)
│  ← cost=..98234.1: total cost (all rows)
│  ← rows=12450: ESTIMATED rows (optimizer's guess)
│  ← actual rows=12847: ACTUAL rows returned
│  ← loops=1: this node ran 1 time
│  ← Row estimate error: 12847/12450 = 1.03x (excellent — <2x is good)
│
├── Hash Join  (cost=..75234.1 rows=12450 width=64)
│             (actual time=44.9..3185.2 rows=12847 loops=1)
│   Hash Cond: (o.customer_id = c.id)
│
│   ← Hash Join: build hash table from smaller relation,
│     probe with larger. Good when: no index on join key,
│     both sides large. Bad when: one side very small (use NL)
│
├── Seq Scan on customers  (cost=0..4521.0 rows=98234 width=20)
│                          (actual time=0.1..89.3 rows=98234 loops=1)
│   ← Full table scan: 98,234 rows scanned to build hash table
│   ← This is the BUILD SIDE of the hash join (read once)
│   ← Acceptable if customers fits in work_mem
│
└── Hash Join  (cost=..65234.1 rows=12450 width=44)
              (actual time=44.8..2876.4 rows=12847 loops=1)
    Hash Cond: (o.product_id = p.id)
    │
    ├── Seq Scan on products  (cost=0..3521.0 rows=75432 width=20)
    │                         (actual time=0.1..71.2 rows=75432 loops=1)
    │   ← Build hash table for products
    │
    └── Index Scan using idx_orders_created_status  ← GOOD: using index!
              on orders  (cost=0.43..34521.8 rows=12450 width=24)
              (actual time=0.3..1823.4 rows=12847 loops=1)
        Index Cond: (created_at > '2024-01-01')
        Filter: (status = 'completed')        ← Applied AFTER index scan
        Rows Removed by Filter: 3421         ← 3421 rows scanned, not in result

Planning Time: 1.8 ms     ← Time to generate this plan
Execution Time: 3423.2 ms ← Total wall-clock time

Key metrics to check:
  1. rows estimate vs actual: large divergence = stale statistics
  2. "Seq Scan" on large tables = missing index
  3. "Filter" rows removed = index not selective enough (need different index)
  4. Execution time dominance: which node takes the most time?
     Here: Hash Joins dominate. Worth examining work_mem for spill to disk.
```

---

## Core Concepts

### 1. The Cost-Based Optimizer: How It Makes Decisions

PostgreSQL's planner is a cost-based optimizer (CBO). It generates candidate plans and assigns each a cost using a cost model calibrated to disk page reads, CPU cycles, and network transfers. It selects the plan with the lowest estimated total cost.

#### Cost Model Parameters

```sql
-- View current cost model settings
SHOW seq_page_cost;        -- Cost to read a sequential disk page (default: 1.0)
SHOW random_page_cost;     -- Cost to read a random disk page (default: 4.0)
SHOW cpu_tuple_cost;       -- Cost to process one tuple (default: 0.01)
SHOW cpu_index_tuple_cost; -- Cost of index tuple (default: 0.005)
SHOW cpu_operator_cost;    -- Cost of operator evaluation (default: 0.0025)

-- Tuning for SSD storage (random reads much cheaper on SSD):
ALTER SYSTEM SET random_page_cost = 1.1;  -- SSD: random ≈ sequential
ALTER SYSTEM SET seq_page_cost = 1.0;
SELECT pg_reload_conf();

-- Why this matters:
-- Default random_page_cost=4.0 biases optimizer AGAINST index scans.
-- On HDD, this is correct (random seek is 40x slower than sequential).
-- On NVMe SSD, random reads are ~1.05x sequential.
-- With random_page_cost=4.0 on NVMe, optimizer AVOIDS index scans unnecessarily.
-- Result: sequential scans of 10M rows instead of index scan of 100 rows.
-- ALWAYS SET random_page_cost=1.1 ON SSD STORAGE.
```

#### Row Count Estimation and Statistics

The optimizer's row count estimates come from `pg_statistic`, updated by `ANALYZE`:

```sql
-- View what statistics exist for a table
SELECT attname, 
       n_distinct,        -- Estimated distinct values (-1 = all unique)
       correlation,       -- Physical order correlation (1.0 = perfect, 0 = random)
       null_frac,         -- Fraction of NULLs
       avg_width          -- Average column width in bytes
FROM pg_stats
WHERE tablename = 'orders';

-- n_distinct = -0.003 means: "fraction of rows that are distinct"
-- E.g., -0.003 × 10,000,000 rows = 30,000 distinct values (status column)

-- More detailed: histogram of value distribution
SELECT histogram_bounds  -- Array of boundary values dividing data into equal-size buckets
FROM pg_stats
WHERE tablename = 'orders' AND attname = 'created_at';

-- most_common_vals and most_common_freqs: top-N most frequent values
SELECT most_common_vals::text, most_common_freqs
FROM pg_stats  
WHERE tablename = 'orders' AND attname = 'status';
-- most_common_vals: {completed,pending,cancelled,refunded}
-- most_common_freqs: {0.42, 0.38, 0.15, 0.05}
-- status='completed': estimated 42% of rows → good estimate
```

#### Stale Statistics: The Root of Most Plan Disasters

```
Scenario:
  T=0:00  orders table has 1,000,000 rows. ANALYZE run. Statistics accurate.
           status='completed': 420,000 rows (42%)
           
  T=2:00  Batch import: 50,000,000 new orders (all 'completed') added.
           Table now: 51,000,000 rows.
           
  T=2:01  Application queries: SELECT ... WHERE status='completed' AND ...
           Optimizer checks statistics:
             status='completed': estimated 420,000 rows (from old stats!)
             Actual rows: 50,420,000
           
           Plan chosen: Hash Join (good for 420K rows on one side)
           Actual execution: Hash Join with 50M rows → OOM → disk spill → 3 min

  T=2:01  ANALYZE orders; (fixes it)
           New estimate: 50,420,000 rows for status='completed'
           Optimizer now chooses: parallel sequential scan or partition scan
           Execution: 8 seconds (still slow, but not OOM)

Statistics update triggers:
  Autovacuum: runs ANALYZE when >10% of rows change (autovacuum_analyze_scale_factor=0.1)
  For 51M-row table: threshold = 5.1M changed rows → autovacuum hasn't fired yet
  
  Manual: ANALYZE orders;  (instant for statistics; no table lock)
  Or: ALTER TABLE orders SET (autovacuum_analyze_scale_factor = 0.01);
```

#### Increasing Statistics Target

The default `statistics_target = 100` collects 100 histogram buckets per column. For highly skewed columns (user_id with some power users having millions of orders), 100 buckets is insufficient:

```sql
-- Increase statistics target for skewed columns
ALTER TABLE orders ALTER COLUMN user_id SET STATISTICS 500;
-- Now collects 500 histogram buckets → better estimates for user_id range queries

-- Re-run analyze to collect new statistics
ANALYZE orders;

-- Global increase for all new columns:
ALTER SYSTEM SET default_statistics_target = 200;
SELECT pg_reload_conf();
ANALYZE;  -- Update all tables
```

---

### 2. Index Design: Right Type for the Right Query

Indexes are the most impactful single lever for query performance — and the most commonly misused. Creating the wrong index wastes write throughput and disk space. Missing the right index causes full table scans.

#### B-Tree Index: Default, Range Queries, Sort

```sql
-- B-Tree: default, supports =, <, <=, >, >=, BETWEEN, LIKE 'prefix%'
CREATE INDEX idx_orders_created_at ON orders (created_at);

-- Query benefits:
SELECT * FROM orders WHERE created_at > '2024-01-01';          -- ✓ index range scan
SELECT * FROM orders WHERE created_at BETWEEN '2024-01' AND '2024-02'; -- ✓ range
SELECT * FROM orders ORDER BY created_at DESC LIMIT 100;       -- ✓ index scan backward
SELECT * FROM orders WHERE created_at LIKE '2024%';            -- ✗ LIKE non-prefix fails

-- B-Tree structure:
-- Root → Internal nodes (sorted keys) → Leaf nodes (key, page pointer)
-- Each leaf: doubly-linked list (supports range scans efficiently)
-- Height ≈ log_b(n) where b=fill_factor-based branching
-- For 100M rows: height ≈ 4-5 levels = 4-5 page reads per lookup
```

#### Composite Index: Column Order Matters

```sql
-- Query: WHERE status = 'completed' AND created_at > '2024-01-01'
-- Two possible indexes:

-- Index A: (status, created_at)
CREATE INDEX idx_orders_status_created ON orders (status, created_at);

-- Index B: (created_at, status)
CREATE INDEX idx_orders_created_status ON orders (created_at, status);

-- Difference:
-- Index A: First narrows by status (42% of rows), then scans created_at range
--          → Scans ~21M rows if 42% are 'completed' → moderate
--          Equally useful for: WHERE status = 'X' (no date filter)

-- Index B: First narrows by created_at range, then checks status
--          → If created_at > '2024-01-01' matches 5% of rows → scans 2.5M rows
--          → Then filters status='completed' in those 2.5M → better!
--          But NOT useful for: WHERE status = 'X' (must scan entire index)

-- Rule: Put the most SELECTIVE column first IF it's always in the query.
--       Put EQUALITY filters before RANGE filters.
--       created_at is range (>), status is equality (=).
--       Optimal: (status, created_at) — equality first, then range.

-- EXPLAIN ANALYZE to verify:
EXPLAIN ANALYZE SELECT id, customer_id, total
FROM orders
WHERE status = 'completed' AND created_at > '2024-01-01';

-- With (status, created_at):
-- Index Scan using idx_orders_status_created on orders
-- Index Cond: ((status = 'completed') AND (created_at > '2024-01-01'))
-- Rows Removed by Filter: 0  ← Both conditions in index, no filter needed!
```

#### Partial Index: Index Only the Rows You Query

```sql
-- Problem: You only ever query orders WHERE status = 'pending'.
--          'pending' = 5% of rows. Standard index includes 100% of rows.
--          Wasted space, wasted maintenance overhead.

-- Solution: Partial index includes only rows matching the WHERE clause
CREATE INDEX idx_orders_pending_created 
ON orders (created_at)
WHERE status = 'pending';

-- Size: 5% of full index = 95% smaller
-- Maintenance: only updated when status='pending' rows change
-- Write amplification: massively reduced

-- Query that uses the partial index:
SELECT * FROM orders WHERE status = 'pending' AND created_at > NOW() - INTERVAL '1 day';
-- Optimizer: sees idx_orders_pending_created.
-- Index Cond: (created_at > ...) WHERE status='pending'  ← uses partial index
-- The partial index's WHERE clause must MATCH the query's WHERE clause exactly.

-- CRITICAL: partial index is ONLY used when query includes the same filter.
-- This query WON'T use the partial index:
SELECT * FROM orders WHERE created_at > NOW() - INTERVAL '1 day';
-- (no status='pending' filter → can't use partial index — could include non-pending rows)
```

#### Expression Index: Index on a Function Result

```sql
-- Problem: Application stores emails as mixed case. 
--          Queries filter on LOWER(email) for case-insensitive lookup.
SELECT * FROM users WHERE LOWER(email) = LOWER($1);

-- Standard index on email is USELESS for this query.
-- Each row's email must be lowered at query time → sequential scan.

-- Solution: Expression index stores the LOWER(email) result
CREATE INDEX idx_users_email_lower ON users (LOWER(email));

-- Now the optimizer can use the index:
-- Index Cond: (lower(email) = lower($1))  ← matched!

-- Other useful expression indexes:
CREATE INDEX idx_products_name_search ON products (to_tsvector('english', name));
-- Enables fast full-text search on the product name

CREATE INDEX idx_orders_year ON orders (EXTRACT(YEAR FROM created_at));
-- Enables fast year-based grouping: WHERE EXTRACT(YEAR FROM created_at) = 2024

CREATE INDEX idx_users_email_domain ON users ((SPLIT_PART(email, '@', 2)));
-- Enables fast domain filtering: WHERE SPLIT_PART(email, '@', 2) = 'gmail.com'
```

#### Covering Index: Eliminate Heap Access

```sql
-- Problem: Query needs columns both in WHERE and SELECT.
-- Index on WHERE column alone → Index scan + heap fetch for each row.
-- Heap fetch = random I/O → expensive for large result sets.

-- Query: frequently run, latency-critical
SELECT id, status, total
FROM orders
WHERE customer_id = $1 AND created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC
LIMIT 50;

-- Standard index on (customer_id, created_at):
-- Index Scan → finds matching rows → FETCHES HEAP PAGE for each row to get total
-- 50 rows × random heap fetch ≈ 50 × 8ms = 400ms (on HDD)

-- Covering index: INCLUDE extra columns that the query needs
CREATE INDEX idx_orders_customer_covering
ON orders (customer_id, created_at DESC)
INCLUDE (id, status, total);  -- Extra columns stored in leaf nodes

-- Now: Index Only Scan → reads id, status, total from index leaf → NO heap fetch
-- Verify in EXPLAIN: "Index Only Scan" (not "Index Scan")
-- Heap Fetches: 0  ← ideal

-- INCLUDE vs adding to key: INCLUDE columns not part of sort key
-- They're stored in leaf pages but NOT used for ordering/searching
-- This avoids index bloat from including wide columns in the key
```

#### Index Bloat and Maintenance Overhead

Every index must be updated on every INSERT, UPDATE (if indexed columns change), or DELETE. The cost is **write amplification**:

```
Table with 10 indexes:
  INSERT 1 row: 1 heap write + 10 index entry inserts = 11 writes
  UPDATE 1 row (indexed columns): 2 heap writes (old/new tuple) + 10 × 2 index updates = 22 writes
  DELETE 1 row: 1 heap mark + 10 index entry deletes = 11 writes
  
  Actual WAL generated per INSERT: proportional to number of indexes
  
  Benchmark at 10,000 INSERT/s:
    0 indexes:  100K writes/s WAL, ~12ms p99
    5 indexes:  200K writes/s WAL, ~25ms p99  (2x write overhead)
    10 indexes: 350K writes/s WAL, ~45ms p99  (3.5x write overhead)
    20 indexes: 600K writes/s WAL, ~90ms p99  (7.5x write overhead) ← common ORM anti-pattern

Finding unused indexes:
SELECT indexrelname, idx_scan, idx_tup_read, idx_tup_fetch,
       pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0  -- Zero scans since last statistics reset
ORDER BY pg_relation_size(indexrelid) DESC;

-- Drop unused indexes (verify they've been zero-scan for > 1 week of production traffic):
DROP INDEX CONCURRENTLY idx_orders_unused_column;
-- CONCURRENTLY: builds index without locking the table (for drops: releases lock-free)
```

---

### 3. Reading EXPLAIN ANALYZE: A Systematic Approach

```sql
-- Always use EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) for full information
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT o.id, c.name, SUM(oi.price * oi.quantity) as total
FROM orders o
JOIN customers c ON c.id = o.customer_id
JOIN order_items oi ON oi.order_id = o.id
WHERE o.created_at BETWEEN '2024-01-01' AND '2024-12-31'
  AND c.country = 'US'
GROUP BY o.id, c.name
ORDER BY total DESC
LIMIT 100;
```

#### Systematic Reading Checklist

```
Step 1: Find the most expensive node
  Sort nodes by "actual time": find where the most execution time is spent.
  In a tree, the parent's time INCLUDES child time.
  To find self-time: parent_time - sum(child_times).

Step 2: Check row estimation accuracy
  Compare "rows=X" (estimated) vs "actual rows=Y".
  Acceptable: within 2-3x for small tables, within 10x for large tables.
  Problem: 1000x difference → stale statistics → run ANALYZE.
  CRITICAL: If rows estimated = 1 but actual = 1,000,000 → 
    optimizer chose nested loop (good for 1 row) → catastrophic for 1M rows.

Step 3: Look for sequential scans on large tables
  "Seq Scan on orders" + rows=100,000,000 = likely missing index.
  Exception: if the query returns >10-20% of rows, seq scan is correct.
  
Step 4: Check for disk spills
  "Batches: N (Memory Usage: Xkb)" in Hash Join/Aggregate nodes.
  Batches > 1 = spilled to disk (work_mem too small).
  Solution: SET work_mem = '256MB'; (or increase globally in postgresql.conf)
  
Step 5: Check loop counts
  "loops=N" means this node ran N times.
  Nested Loop inner: loops = outer_rows. If outer=100K, inner loops=100K.
  Each inner loop = one index lookup. 100K × 1ms = 100 seconds.
  Fix: verify inner table has an index on the join key.
  
Step 6: Look at buffers
  "Buffers: shared hit=X read=Y"
  hit = pages served from buffer pool (fast, ~0.1µs)
  read = pages fetched from disk (slow, ~100µs each)
  Many reads on a hot table = insufficient shared_buffers.
  
Step 7: Planning time vs execution time
  Planning time > 50ms = complex query with many join alternatives.
  Solution: pg_hint_plan to lock the plan, or partitioning.
```

#### Real EXPLAIN ANALYZE Diagnosis

```sql
-- Problem query: 45 seconds, complaints from users
EXPLAIN (ANALYZE, BUFFERS)
SELECT u.id, u.email, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.created_at > '2023-01-01'
GROUP BY u.id, u.email;

-- Actual output (problem identified):
-- Hash Left Join  (cost=... rows=50000 ...)
--                 (actual time=42156.3..42156.3 rows=1234567 loops=1)
--   Buckets: 65536  Batches: 128  Memory Usage: 8192kB  ← DISK SPILL!
--   Buffers: shared hit=2341 read=89234                 ← 89K disk reads
--   ->  Seq Scan on users  (cost=... rows=1234567 ...)
--       Filter: (created_at > '2023-01-01')
--       Rows Removed by Filter: 23456789               ← Scanning 24M rows!
--       Buffers: shared hit=234 read=45678             ← reading from disk

-- Problems identified:
-- 1. Seq Scan on users with 24M rows removed by filter
--    → Need index on users.created_at
-- 2. Hash join spilling to disk (128 batches)
--    → work_mem too small, or result set genuinely huge
-- 3. 89K disk reads from shared buffers miss
--    → Consider pg_prewarm or adjust shared_buffers

-- Fix 1: Add missing index
CREATE INDEX CONCURRENTLY idx_users_created_at ON users (created_at);

-- Fix 2: Increase work_mem for this session
SET work_mem = '512MB';

-- Rerun and compare:
EXPLAIN (ANALYZE, BUFFERS)
SELECT u.id, u.email, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.created_at > '2023-01-01'
GROUP BY u.id, u.email;

-- New output:
-- Hash Left Join  (cost=... rows=1200000 ...)
--                 (actual time=1823.4..2341.2 rows=1234567 loops=1)
--   Buckets: 2097152  Batches: 1  Memory Usage: 401MB  ← No disk spill!
--   ->  Index Scan using idx_users_created_at on users
--       (actual time=0.3..234.5 rows=1234567 loops=1)  ← Index scan!
-- Execution Time: 2341.5 ms  ← 45s → 2.3s = 20x improvement
```

---

### 4. The N+1 Query Problem

The N+1 query problem is the single most common application-level database performance bug. It occurs when an application fetches N parent records, then issues N separate queries to fetch child records for each parent — when a single JOIN could have returned all data in one round-trip.

#### How It Happens

```python
# Python/SQLAlchemy ORM — N+1 example
# Fetching orders with their customers

# Query 1: Fetch all recent orders
orders = db.query(Order).filter(
    Order.created_at > datetime.now() - timedelta(days=7)
).all()
# SQL: SELECT * FROM orders WHERE created_at > '...'
# Returns: 500 orders

# Displaying order details — ORM lazy-loads customer on access
for order in orders:
    print(f"Order {order.id} by {order.customer.name}")
    #                             ^^^^^^^^^^^
    # Query 2..501: SELECT * FROM customers WHERE id = ?
    # This fires for EVERY order that accesses .customer!

# Total queries: 1 (orders) + 500 (customers) = 501 queries
# Network round-trips: 501 × 1ms = 501ms minimum latency
# Database load: 501 queries × 5ms each = 2.5 seconds server time
```

#### Detection

```python
# Enable query logging to detect N+1
import logging
logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)

# Or use a query counter middleware:
from sqlalchemy import event

query_count = 0

@event.listens_for(db.engine, "before_cursor_execute")
def count_queries(conn, cursor, statement, parameters, context, executemany):
    global query_count
    query_count += 1

# After endpoint execution: if query_count > 10, investigate N+1
```

**Using `pg_stat_statements` to detect N+1 patterns:**

```sql
-- Find queries executed thousands of times with simple WHERE clause
-- (suggests N+1: same query run N times with different ID)
SELECT query, calls, total_exec_time, mean_exec_time,
       round(total_exec_time::numeric / calls, 2) AS avg_ms,
       rows
FROM pg_stat_statements
WHERE query LIKE '%customers%'
ORDER BY calls DESC
LIMIT 10;

-- Result: 
-- query: SELECT * FROM customers WHERE id = $1
-- calls: 4,523,891   ← fired 4.5M times today!
-- avg_ms: 0.8ms      ← each is fast, but 4.5M × 0.8ms = 3600 seconds total!
```

#### Fixes

**Fix 1: Eager loading (JOIN in ORM)**

```python
# SQLAlchemy: eager load with joinedload
orders = db.query(Order).options(
    joinedload(Order.customer)  # ← adds JOIN to the query
).filter(
    Order.created_at > datetime.now() - timedelta(days=7)
).all()

# SQL generated:
# SELECT orders.*, customers.*
# FROM orders
# JOIN customers ON customers.id = orders.customer_id
# WHERE orders.created_at > '...'
# 
# Result: 1 query instead of 501. 501ms → 3ms.
```

**Fix 2: Batch loading (IN clause)**

```python
# Fetch orders first
orders = db.query(Order).filter(...).all()
order_ids = [o.id for o in orders]

# Batch-fetch all related customers in ONE query
customer_ids = [o.customer_id for o in orders]
customers = db.query(Customer).filter(
    Customer.id.in_(customer_ids)
).all()
customer_map = {c.id: c for c in customers}

# Combine in Python (O(n) dict lookup)
for order in orders:
    customer = customer_map[order.customer_id]
    print(f"Order {order.id} by {customer.name}")

# 2 queries instead of 501. Same result.
# Useful when JOIN would cause row multiplication (one-to-many)
```

**Fix 3: Raw SQL with proper JOIN**

```sql
-- Single query returns everything needed
SELECT o.id, o.created_at, o.total,
       c.id AS customer_id, c.name AS customer_name, c.email
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.created_at > NOW() - INTERVAL '7 days'
ORDER BY o.created_at DESC;
```

**Fix 4: Django select_related / prefetch_related**

```python
# Django ORM equivalents:

# select_related: adds JOIN (for ForeignKey/OneToOne)
orders = Order.objects.select_related('customer').filter(
    created_at__gt=timezone.now() - timedelta(days=7)
)

# prefetch_related: separate query with IN (...) (for ManyToMany / reverse FK)
orders = Order.objects.prefetch_related('items__product').filter(
    created_at__gt=timezone.now() - timedelta(days=7)
)
# Generates:
# Query 1: SELECT * FROM orders WHERE created_at > '...'
# Query 2: SELECT * FROM order_items WHERE order_id IN (1,2,3,...500)
# Query 3: SELECT * FROM products WHERE id IN (101,102,...200)
# Total: 3 queries vs 1001 (orders + items + products)
```

---

### 5. `pg_stat_statements`: Finding the Worst Offenders

`pg_stat_statements` is the most valuable PostgreSQL extension for performance engineering. It records execution statistics for every unique query, aggregated across all executions.

```sql
-- Enable the extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- postgresql.conf:
-- shared_preload_libraries = 'pg_stat_statements'
-- pg_stat_statements.max = 10000       (track up to 10K unique queries)
-- pg_stat_statements.track = all       (track top-level + nested statements)

-- ─────────────────────────────────────────────────────────────────────────
-- Query 1: Top queries by TOTAL time (find the 80% contributors)
-- ─────────────────────────────────────────────────────────────────────────
SELECT 
    round(total_exec_time::numeric / 1000, 2) AS total_seconds,
    calls,
    round(mean_exec_time::numeric, 2) AS avg_ms,
    round(stddev_exec_time::numeric, 2) AS stddev_ms,
    rows,
    round(100 * total_exec_time / 
          SUM(total_exec_time) OVER (), 2) AS pct_of_total,
    LEFT(query, 100) AS query_preview
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;

-- ─────────────────────────────────────────────────────────────────────────
-- Query 2: Most CALLED queries (find N+1 patterns)
-- ─────────────────────────────────────────────────────────────────────────
SELECT 
    calls,
    round(mean_exec_time::numeric, 2) AS avg_ms,
    round(total_exec_time::numeric / 1000, 2) AS total_seconds,
    LEFT(query, 100) AS query_preview
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 20;

-- ─────────────────────────────────────────────────────────────────────────
-- Query 3: Queries with HIGH VARIANCE (unreliable queries — plan instability)
-- ─────────────────────────────────────────────────────────────────────────
SELECT
    calls,
    round(mean_exec_time::numeric, 2) AS avg_ms,
    round(stddev_exec_time::numeric, 2) AS stddev_ms,
    round(max_exec_time::numeric, 2) AS max_ms,
    round(min_exec_time::numeric, 2) AS min_ms,
    LEFT(query, 100) AS query_preview
FROM pg_stat_statements
WHERE calls > 100
  AND stddev_exec_time > mean_exec_time  -- stddev > mean = high variance
ORDER BY stddev_exec_time DESC
LIMIT 20;
-- High stddev with same query text = plan instability (generic plan vs custom plan)
-- Or: parameter-sensitive performance (some values hit hot pages, others cold)

-- ─────────────────────────────────────────────────────────────────────────
-- Query 4: Queries with high I/O (identify buffer misses)
-- ─────────────────────────────────────────────────────────────────────────
SELECT 
    calls,
    round(mean_exec_time::numeric, 2) AS avg_ms,
    shared_blks_hit,
    shared_blks_read,  -- Disk reads: expensive
    round(100.0 * shared_blks_hit / 
          NULLIF(shared_blks_hit + shared_blks_read, 0), 2) AS buffer_hit_rate,
    LEFT(query, 100) AS query_preview
FROM pg_stat_statements
WHERE shared_blks_read > 1000
ORDER BY shared_blks_read DESC
LIMIT 10;
-- buffer_hit_rate < 95% on a hot table = shared_buffers too small or cold cache

-- Reset statistics for a fresh measurement window:
SELECT pg_stat_statements_reset();
```

---

### 6. Connection Pool Engineering

The database connection pool is the bridge between application threads and database backend processes. Misconfiguring it is one of the most common causes of database-related outages.

#### Why Connection Pools Exist

```
Without connection pool:
  Each HTTP request → new PostgreSQL connection
  New connection overhead:
    - TCP handshake: 1ms
    - PostgreSQL authentication: 5ms
    - Session setup (GUC initialization): 2ms
    Total: ~8ms per request just to connect
    
  At 10,000 RPS: 10,000 connections/second × 8ms = 80 seconds of connection work
  PostgreSQL process per connection: ~10MB RSS
  10,000 connections = 100GB RAM (not feasible)
  PostgreSQL max_connections: typically 100-1000

With connection pool (PgBouncer):
  Application → PgBouncer → 50 PostgreSQL backends
  PgBouncer reuses connections: application gets connection from pool in <1ms
  PostgreSQL: 50 backends × 10MB = 500MB RSS (feasible)
  10,000 application "connections" multiplexed onto 50 real connections
```

#### PgBouncer Pooling Modes

```ini
# pgbouncer.ini

[pgbouncer]
listen_port = 6432
listen_addr = *
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

# CRITICAL SETTING: pool_mode
# session:     Connection held for entire client session (no multiplexing)
#              Safe for all SQL including SET, PREPARE, advisory locks
#              Throughput: limited to num_connections

# transaction: Connection returned to pool after each transaction
#              Most efficient: 1000 clients use 20 connections
#              BREAKS: prepared statements, SET, advisory locks, LISTEN/NOTIFY
#              This is the recommended mode for stateless application servers

# statement:   Connection returned after each statement
#              BREAKS: transactions, cursors, anything requiring state
#              Almost never appropriate

pool_mode = transaction

# Connection limits:
default_pool_size = 25          # Connections to PostgreSQL per (user, db) pair
max_client_conn = 10000         # Max client connections PgBouncer accepts
reserve_pool_size = 5           # Extra connections for emergencies
reserve_pool_timeout = 5        # Seconds to wait before using reserve pool

# Timeouts:
server_idle_timeout = 600       # Close idle PostgreSQL connections after 10 min
client_idle_timeout = 0         # Don't close idle client connections (0=disabled)
query_timeout = 0               # No per-query timeout (set in application)
query_wait_timeout = 120        # Wait up to 120s for a free connection

[databases]
mydb = host=postgres-primary port=5432 dbname=mydb
```

#### Optimal Pool Size Formula

```
Little's Law for connection pools:
  Connections needed = TPS × avg_query_latency_seconds
  
  At 1,000 TPS with avg query latency 20ms:
  Connections = 1,000 × 0.020 = 20 connections
  
  Add 25% headroom for latency spikes:
  Pool size = 20 × 1.25 = 25 connections
  
  PostgreSQL rule of thumb: pool_size = num_cores × 2
  16-core PostgreSQL server: pool_size = 32
  
  Reality: the constraint is PostgreSQL backend CPU, not connection count.
  At 32 connections, 16 cores are each serving ~2 queries simultaneously.
  Adding more connections DOES NOT help if CPU is the bottleneck —
  it adds context switching overhead.
  
  Anti-pattern: Setting pool_size = 200 "just to be safe."
  Result: 200 backends all competing for 16 cores = context switch overhead,
          cache thrashing, worse throughput than 32 backends.
```

#### Application-Side Pool Configuration (Java HikariCP)

```java
// HikariCP: highest-performance Java connection pool
HikariConfig config = new HikariConfig();
config.setJdbcUrl("jdbc:postgresql://pgbouncer:6432/mydb");
config.setUsername("app_user");
config.setPassword("secret");

// Pool sizing (PgBouncer already manages DB-side connections)
// Application pool: enough for concurrent in-flight DB calls
config.setMaximumPoolSize(20);         // Max connections to PgBouncer per JVM
config.setMinimumIdle(5);              // Keep at least 5 warm connections
config.setConnectionTimeout(3000);    // 3s: fail fast if pool exhausted
config.setIdleTimeout(600000);        // 10min: close idle connections
config.setMaxLifetime(1800000);       // 30min: recycle connections (avoid leaks)

// Validation
config.setKeepaliveTime(60000);       // 1min ping to keep PgBouncer connection alive
config.setConnectionTestQuery("SELECT 1");

// Performance settings for PostgreSQL
config.addDataSourceProperty("prepareThreshold", "5");     // Prepare after 5 executions
config.addDataSourceProperty("preparedStatementCacheQueries", "256");
config.addDataSourceProperty("preparedStatementCacheSizeMiB", "5");
config.addDataSourceProperty("defaultRowFetchSize", "100"); // Cursor fetch size

HikariDataSource dataSource = new HikariDataSource(config);
```

#### Diagnosing Connection Pool Exhaustion

```sql
-- Check current PostgreSQL connections
SELECT count(*) AS total,
       state,
       wait_event_type,
       wait_event,
       client_addr
FROM pg_stat_activity
WHERE datname = 'mydb'
GROUP BY state, wait_event_type, wait_event, client_addr
ORDER BY total DESC;

-- Active state breakdown:
-- state='active': running a query RIGHT NOW
-- state='idle': connected but idle (potential pool leak)
-- state='idle in transaction': in an open transaction doing nothing
--   ← DANGER: idle in transaction holds locks, blocks autovacuum

-- Find idle-in-transaction connections (should be 0 or near 0)
SELECT pid, usename, client_addr, state, 
       now() - state_change AS idle_duration,
       left(query, 100) AS last_query
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND state_change < now() - INTERVAL '30 seconds'
ORDER BY idle_duration DESC;

-- Kill runaway idle-in-transaction connections:
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND state_change < now() - INTERVAL '5 minutes';
  
-- Set statement_timeout and idle_in_transaction_session_timeout
-- in postgresql.conf to automatically kill these:
ALTER SYSTEM SET idle_in_transaction_session_timeout = '5min';
ALTER SYSTEM SET statement_timeout = '30s';  -- Kill runaway queries
SELECT pg_reload_conf();
```

---

### 7. Partition Pruning and Table Partitioning for Performance

At large table sizes (>100M rows), even a well-indexed table can be slow for range queries. Partitioning divides the table into smaller physical pieces. The optimizer can skip entire partitions that cannot contain matching rows — "partition pruning."

```sql
-- Range partitioning on created_at (monthly partitions)
CREATE TABLE orders (
    id BIGSERIAL,
    customer_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL,
    status TEXT,
    total NUMERIC(12,2)
) PARTITION BY RANGE (created_at);

-- Create partitions for each month
CREATE TABLE orders_2024_01 
    PARTITION OF orders 
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE orders_2024_02
    PARTITION OF orders
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Add more months...

-- Indexes on each partition (or parent — PostgreSQL auto-propagates)
CREATE INDEX ON orders (customer_id, created_at DESC);
-- Creates index on each partition automatically

-- Query with partition pruning:
EXPLAIN SELECT * FROM orders 
WHERE created_at BETWEEN '2024-01-01' AND '2024-01-31';

-- Output shows:
-- Append
--   ->  Seq Scan on orders_2024_01  ← Only January partition scanned!
--       Filter: (created_at >= '2024-01-01' AND created_at <= '2024-01-31')
-- Partitions scanned: 1 out of 24  ← 23 partitions skipped!

-- Benefits:
-- 1. Partition pruning: query touches only relevant months
-- 2. VACUUM runs per-partition (much faster than full-table VACUUM)
-- 3. DROP PARTITION: instant deletion of old data (no DELETE + VACUUM)
--    DROP TABLE orders_2023_01; -- Instant, no dead tuple accumulation
-- 4. Index size per partition smaller (higher cache hit rate)

-- Maintenance: Create new partitions in advance (cron job):
-- Monthly: CREATE TABLE orders_2025_01 PARTITION OF orders 
--           FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

---

### 8. Query Plan Stabilization

High-traffic queries sometimes exhibit plan instability: the optimizer switches between a fast plan and a slow plan depending on parameter values, statistics state, or planning decisions. This causes intermittent latency spikes.

#### Generic Plans vs Custom Plans

```sql
-- PostgreSQL prepares statements in two modes:
-- Custom plan: planned with specific parameter values (better for skewed data)
-- Generic plan: planned without values (reusable, but may be suboptimal)

-- PREPARE creates a prepared statement
PREPARE get_user_orders (bigint) AS
SELECT o.id, o.total FROM orders o WHERE o.user_id = $1;

-- PostgreSQL uses CUSTOM plan for first 5 executions (plan_cache_mode=auto)
EXECUTE get_user_orders(123);  -- Custom plan for user 123 (may have 5 orders)

-- After 5 executions: switches to GENERIC plan if cost estimate is reasonable
-- PROBLEM: user 456 is a power user with 50,000 orders
-- Generic plan (optimized for "average" user) may use a less efficient strategy
-- Custom plan for user 456 would use a different join strategy

-- Force custom plans for parameter-sensitive queries:
SET plan_cache_mode = force_custom_plan;
-- Or per-query:
-- Use EXECUTE instead of prepared statement reuse
```

#### pg_hint_plan: Overriding the Optimizer

```sql
-- pg_hint_plan: extension that allows query-level plan hints
-- Use ONLY as last resort when optimizer consistently makes wrong choices

-- Without hint (optimizer chooses sequential scan erroneously):
EXPLAIN SELECT * FROM orders WHERE user_id = $1 AND status = 'completed';
-- Seq Scan on orders (cost=0..8900000.00)  ← wrong!

-- With hint: force index scan
/*+ IndexScan(orders idx_orders_user_status) */
SELECT * FROM orders WHERE user_id = $1 AND status = 'completed';
-- Index Scan using idx_orders_user_status on orders ← forced!

-- Available hints:
/*+ SeqScan(orders) */                      -- Force sequential scan
/*+ IndexScan(orders idx_name) */           -- Force specific index
/*+ IndexOnlyScan(orders idx_name) */       -- Force index-only scan
/*+ NestLoop(orders customers) */           -- Force nested loop join
/*+ HashJoin(orders customers) */           -- Force hash join
/*+ MergeJoin(orders customers) */          -- Force merge join
/*+ Leading(customers orders) */            -- Force join order
/*+ Parallel(orders 4) */                   -- Force 4 parallel workers
/*+ NoParallel(orders) */                   -- Disable parallelism

-- Example: forcing join order for a complex query
/*+ 
  Leading(o c p)
  HashJoin(o c)
  NestLoop(o c p)
  IndexScan(p idx_products_id)
*/
SELECT o.id, c.name, p.title
FROM orders o
JOIN customers c ON c.id = o.customer_id
JOIN products p ON p.id = o.product_id
WHERE o.created_at > '2024-01-01';
```

#### Extended Statistics for Correlated Columns

```sql
-- Problem: Two columns are correlated (status='completed' always pairs with
-- payment_status='paid'), but the optimizer treats them as independent.
-- Estimated rows: 5% (status filter) × 5% (payment_status filter) = 0.25%
-- Actual rows: 5% (they're always together) = 5%
-- 20x underestimate → wrong plan chosen

-- Solution: Extended statistics capture column correlations
CREATE STATISTICS orders_status_payment_corr (dependencies)
ON status, payment_status
FROM orders;

ANALYZE orders;  -- Collect the extended statistics

-- Now optimizer knows: given status='completed', payment_status='paid' is nearly certain
-- Row estimate improves dramatically
-- Use cases: correlated columns in WHERE clause, GROUP BY with related columns

-- MCV (Most Common Values) extended statistics for multi-column combos:
CREATE STATISTICS orders_user_status_mcv (mcv)
ON user_id, status
FROM orders;
-- Tracks most common (user_id, status) value combinations
-- Crucial for queries filtering on both user_id AND status simultaneously
```

---

## Step-by-Step Execution: Diagnosing a Slow Query in Production

```
Incident: Application response time p99 = 8 seconds (normally 200ms).
Symptom: Endpoint GET /api/users/{id}/recommendations is slow.

Step 1: Identify the slow query via pg_stat_statements
  SELECT query, calls, mean_exec_time, max_exec_time
  FROM pg_stat_statements
  WHERE mean_exec_time > 5000  -- >5 seconds average
  ORDER BY mean_exec_time DESC;
  
  Result:
  query: SELECT r.*, p.title FROM recommendations r
         JOIN products p ON p.id = r.product_id
         WHERE r.user_id = $1 AND r.score > 0.5
         ORDER BY r.score DESC LIMIT 20
  calls: 24,567
  mean_exec_time: 7234ms (7.2 seconds)
  max_exec_time: 45000ms (45 seconds!)

Step 2: EXPLAIN ANALYZE with the actual slow parameter value
  EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
  SELECT r.*, p.title FROM recommendations r
  JOIN products p ON p.id = r.product_id
  WHERE r.user_id = 98765 AND r.score > 0.5  -- Known slow user
  ORDER BY r.score DESC LIMIT 20;
  
  Output:
  Gather Merge (actual time=34521.3..34522.1 rows=20 loops=1)
    ->  Sort (actual time=34491.2..34491.2 rows=20 loops=3)
          Sort Key: r.score DESC
          Sort Method: quicksort  Memory: 25kB
          ->  Hash Join (actual time=34471.1..34481.3 rows=20 loops=3)
                Hash Cond: p.id = r.product_id
                ->  Seq Scan on products (actual ... rows=524288 loops=3)
                    Buffers: shared read=234567    ← 234K disk reads!
                ->  Hash (actual ... rows=12345 loops=3)
                      ->  Seq Scan on recommendations
                            (actual time=0.1..892.3 rows=12345 loops=3)
                            Filter: (user_id=98765 AND score > 0.5)
                            Rows Removed by Filter: 14,678,234  ← massive scan!
                            Buffers: shared read=89234           ← 89K disk reads!
  
  Planning Time: 2.3ms
  Execution Time: 34524.5ms  (34 seconds!)

Step 3: Identify the root causes
  a. "Rows Removed by Filter: 14,678,234" on recommendations
     → Missing index on (user_id, score)! Scanning entire table.
  b. "Seq Scan on products" with 234K disk reads
     → products table not in buffer pool (cold cache), or
     → No index on products.id being used (hash join from seq scan is wrong)
  c. Parallel workers (loops=3) didn't help because bottleneck is I/O

Step 4: Fix the issues
  -- Missing index on recommendations
  CREATE INDEX CONCURRENTLY idx_recommendations_user_score 
  ON recommendations (user_id, score DESC);
  
  -- Verify products.id has a primary key index (it should)
  \d products
  -- "id" bigint PRIMARY KEY  ← index exists
  -- The hash join's seq scan on products was because it was the BUILD SIDE
  -- With the recommendations index, NestLoop will be used instead
  -- → Index scan on products by id for each of 20 recommendations
  -- → 20 index lookups vs 524K row scan

Step 5: Re-run after index creation
  EXPLAIN (ANALYZE, BUFFERS)
  SELECT r.*, p.title FROM recommendations r
  JOIN products p ON p.id = r.product_id
  WHERE r.user_id = 98765 AND r.score > 0.5
  ORDER BY r.score DESC LIMIT 20;
  
  New output:
  Limit (actual time=1.2..1.4 rows=20 loops=1)
    ->  Nested Loop (actual time=1.1..1.3 rows=20 loops=1)
          ->  Index Scan Backward using idx_recommendations_user_score
                on recommendations
                (actual time=0.3..0.5 rows=20 loops=1)
                Index Cond: (user_id=98765 AND score > 0.5)
                Rows Removed by Filter: 0   ← No waste!
          ->  Index Scan using products_pkey on products
                (actual time=0.04..0.04 rows=1 loops=20)
                Index Cond: (id = r.product_id)
  
  Execution Time: 1.4ms  ← 34 seconds → 1.4ms = 24,000x improvement!

Step 6: Monitor via pg_stat_statements after fix
  SELECT mean_exec_time FROM pg_stat_statements 
  WHERE query LIKE '%recommendations%';
  -- mean_exec_time: 1.8ms  ← sustained improvement
```

---

## Real-World Examples

### Instagram: Scaling PostgreSQL to 30 Billion Rows

Instagram's media table reached 30 billion rows by 2013. Their approach to query performance at this scale illustrates several key principles.

**The sharding problem:** A single B-tree index on 30 billion rows requires 4-6 levels of B-tree traversal, each potentially a disk read. At 30 billion rows × 100 bytes/entry = 3TB just for one index. The index doesn't fit in memory; every lookup generates cache misses.

**Instagram's solution — logical sharding by user_id:**
```sql
-- Shard allocation: user_id 0-4999 → shard 0, 5000-9999 → shard 1, etc.
-- Each shard: ~500M rows (manageable in RAM with shared_buffers=64GB)

-- Each shard has an independent index that DOES fit in memory:
-- shard 0: idx_media_user_id: 500M entries × 100B = 50GB (fits in 64GB RAM)
-- Index hit rate: ~95% (hot pages stay in buffer pool)
-- Query for user's media: single-shard index scan, 0 disk reads

-- Application-level routing:
def get_shard(user_id: int) -> int:
    return user_id % NUM_SHARDS

def get_user_media(user_id: int) -> list:
    shard = get_shard(user_id)
    db = get_db_connection(shard)
    return db.query("SELECT * FROM media WHERE user_id = %s ORDER BY taken_at DESC LIMIT 30",
                    [user_id])
```

**What Instagram measured:**
- Before sharding: p99 for media query = 4.2 seconds (index too large for RAM → disk seeks)
- After sharding: p99 = 8ms (entire index in RAM → no disk seeks)
- Index size per shard: 50GB (fits in 64GB RAM), not 3TB (cannot fit in any reasonable RAM)

### Shopify: Multi-Tenant Query Isolation

Shopify's multi-tenant architecture stores all merchant data in shared tables with a `shop_id` column. Every query has `WHERE shop_id = ?` — this is the primary tenant isolation mechanism.

**Index design for multi-tenant workloads:**

```sql
-- Anti-pattern: index without shop_id
CREATE INDEX idx_products_title ON products (title);
-- Query: WHERE shop_id = 12345 AND title LIKE 'Widget%'
-- Uses idx_products_title: scans ALL shops' products matching 'Widget%'
-- Then filters by shop_id: wastes work scanning other shops' data

-- Correct: composite index with shop_id first (most selective for a single shop)
CREATE INDEX idx_products_shop_title ON products (shop_id, title);
-- Query: WHERE shop_id = 12345 AND title LIKE 'Widget%'
-- Uses idx_products_shop_title: directly to shop 12345's products
-- 1000x fewer rows scanned for a shop with 10,000 products vs 10M total

-- Shopify's rule: ALL indexes on multi-tenant tables MUST have shop_id as first column.
-- Enforced via code review and database migration linters.
```

**Connection pooling at Shopify scale:**
Shopify uses PgBouncer with `pool_mode=transaction`. During peak (Black Friday), they scale PgBouncer horizontally (multiple instances behind a load balancer) while keeping PostgreSQL backend count fixed at `num_cores × 2`.

### GitLab: 500GB Tables and Partial Index Strategy

GitLab's `ci_builds` table exceeds 500 GB and receives heavy writes (every CI/CD pipeline run creates builds). Full-table indexes are prohibitively large.

```sql
-- ci_builds has a status column with enum values:
-- pending, running, success, failed, cancelled, skipped
-- 95% of rows have status IN ('success', 'failed', 'cancelled') -- terminal states
-- 5% of rows have status IN ('pending', 'running') -- active states

-- Monitoring queries only care about ACTIVE builds
-- A full index includes 100% of rows → 95% of index entries are never queried by monitoring

-- GitLab's solution: partial index covering only active builds
CREATE INDEX idx_ci_builds_project_active
ON ci_builds (project_id, created_at DESC)
WHERE status IN ('pending', 'running');

-- Index size: 5% of full index = 95% smaller (25GB → 1.25GB: fits in buffer pool!)
-- Query for active builds per project: instant (entire index in RAM)
-- Write amplification: only when inserting/updating active builds (5% of writes)

-- Terminal state queries (historical analytics) use a separate, slower path
-- or are routed to a read replica with a full index
```

---

## Failure Scenarios

### Scenario 1: Stale Statistics → Catastrophically Wrong Plan → Production Outage

**Date:** Q3 2023 (composite of documented incidents).  
**Company:** E-commerce platform, 400M product records.

**What Happened:**

The team ran a one-time data migration that imported 380 million new product records (doubling the table size from 400M to 780M rows) in 3 hours. Autovacuum/ANALYZE had not yet processed the table (threshold: 10% change = 78M rows; migration added 380M, but autovacuum was still backlogged).

The product search query that had been running in 20ms for months suddenly started taking 45 seconds. The query planner still believed the table had 400M rows. A `WHERE category_id = 42 AND price < 100` filter that previously returned 50,000 rows now returned 4.8 million rows — but the planner estimated 50,000.

The planner chose a Nested Loop join (optimal for 50K rows) over a Hash Join (optimal for 4.8M rows). The Nested Loop executed 4.8 million index lookups instead of one hash table scan — 1000× more work than necessary.

**Root Cause:**
1. Autovacuum `analyze_scale_factor = 0.1` (10%) threshold not appropriate for tables that receive large batch imports
2. No post-migration `ANALYZE` in the migration script
3. No monitoring for row estimate divergence in `pg_stat_statements`

**Fix Applied:**

```sql
-- Immediate: manually run ANALYZE
ANALYZE products;
-- 400ms for statistics collection → query immediately returns to 20ms

-- Long-term:
-- 1. Add ANALYZE to every migration script:
-- BEGIN; ... migration DDL/DML ... ANALYZE products; COMMIT;

-- 2. Tune autovacuum for large tables:
ALTER TABLE products SET (
    autovacuum_analyze_scale_factor = 0.01,  -- Trigger at 1% change
    autovacuum_analyze_threshold = 10000     -- Or 10K rows changed
);

-- 3. Monitor for estimate divergence:
-- Alert when: actual_rows / estimated_rows > 5 for frequently called queries
SELECT query, calls,
       rows / calls AS avg_actual_rows,
       -- pg_stat_statements doesn't expose estimated rows directly,
       -- but you can compare with pg_class.reltuples for table scans
       LEFT(query, 80)
FROM pg_stat_statements
WHERE calls > 100
ORDER BY rows / calls DESC;
```

---

### Scenario 2: Connection Pool Exhaustion Under Load Spike

**Date:** November 2023 (Black Friday).  
**Company:** Retail platform, normally 500 RPS.

**What Happened:**

On Black Friday, traffic spiked from 500 RPS to 8,000 RPS. The application had a connection pool of 20 connections (sufficient for 500 RPS × 20ms avg query = 10 connections needed). At 8,000 RPS × 20ms = 160 connections needed — but only 20 available.

Symptoms: All API requests started taking 30 seconds (the `connectionTimeout` setting). The application's health check also called the database, couldn't get a connection in 30 seconds, and started returning 500. Kubernetes restarted pods. Each restarting pod reconnected and competed for the 20 connections. Load balancer health checks failed. Traffic was redirected to fewer pods — which had fewer connections available — making the problem worse.

**Root Cause:**
1. Pool size calibrated for average load, not peak
2. Connection pool wait (30s) longer than health check timeout (10s)
3. Health check using database connection (should be in-process only)
4. No circuit breaker between web tier and database

**Fix Applied:**

```yaml
# HikariCP: scale pool size for peak traffic
# Previous: maximumPoolSize=20
# New:      maximumPoolSize=50 (allows for 2,500 RPS sustained)

# More importantly: fail fast, don't queue
config.setConnectionTimeout(3000);  # 3s: fail fast with 503 vs 30s queue

# Use PgBouncer to absorb traffic spikes:
# App pools (50 per pod × 10 pods = 500 app connections)
# PgBouncer multiplexes → 50 PostgreSQL backends
# PgBouncer absorbs connection burst: 500 clients wait in PgBouncer queue
# PostgreSQL sees steady 50 connections

# Health check must NOT use database:
# /healthz: return 200 always (process alive)
# /readyz: check database with 500ms timeout (not 30s!)
```

---

## Performance Considerations

### Index Selectivity and Scan Type Decision

```
PostgreSQL rule: Use index scan if < ~5-15% of rows match.
                 Use sequential scan if > ~5-15% of rows match.
                 
Why? Sequential scan: reads pages sequentially (hardware prefetch works)
     Random index scan: each row requires a random page read

Math for index vs seq scan decision:
  Table: 10M rows, 8KB pages, 100 rows/page = 100,000 pages
  Sequential scan: 100,000 × seq_page_cost (1.0) = 100,000 cost units
  
  Index scan for 1% selectivity: 100,000 rows × random_page_cost (4.0) = 400,000
  → Optimizer chooses SEQUENTIAL SCAN even though only 1% matches!
  
  With SSD (random_page_cost=1.1):
  Index scan for 1%: 100,000 rows × 1.1 = 110,000 < 100,000? NO.
  But for 0.1% selectivity: 10,000 × 1.1 = 11,000 < 100,000 → index scan wins

Always set random_page_cost = 1.1 on SSD storage.
The planner will correctly choose index scans for much smaller selectivity thresholds.
```

### Query Latency Budget

```
Latency contributors for a typical API call:
  Network (client → LB → API → DB): 2ms round-trip (same DC)
  Application code (parsing, auth, logic): 3ms
  Connection pool acquisition: <1ms (PgBouncer transaction mode)
  Query planning: 0.1-2ms (simple queries), 5-50ms (complex queries with many joins)
  Query execution: ??? (the variable)
  Response serialization: 1ms
  
  Target: API p99 = 200ms
  Budget for query execution: 200ms - 7ms overhead = 193ms
  
  Query profiling thresholds:
  > 1000ms: CRITICAL — investigate immediately
  100-1000ms: HIGH — index or stats problem
  10-100ms: MEDIUM — examine query plan
  1-10ms: LOW — acceptable for most OLTP workloads
  <1ms: OPTIMAL — index-only scan or fully cached
```

---

## Trade-offs

### Index Strategy Decision Matrix

| Scenario | Recommended Index | Why |
|---|---|---|
| Equality filter on one column | B-tree (single column) | Standard, fast O(log n) lookup |
| Range query + ORDER BY + LIMIT | B-tree composite (range col last or INCLUDE) | Avoid sort step |
| Low-cardinality filter (status) | Partial index per value | 10-100x smaller than full index |
| Case-insensitive text search | Expression index on LOWER(col) | Standard B-tree can't serve LOWER() queries |
| Full-text search | GIN index on tsvector | B-tree cannot serve full-text queries |
| Geometric/spatial queries | GiST or BRIN | B-tree inapplicable to spatial data |
| Time-series (append-only) | BRIN index | Massive size reduction vs B-tree for correlated sequential data |
| Already covered by query filters | INCLUDE columns | Eliminates heap fetch = Index Only Scan |

### Connection Pooling Comparison

| Pooler | Mode | Overhead | Breaks | Best For |
|---|---|---|---|---|
| No pooler | — | High (new conn per req) | Nothing | Dev only |
| PgBouncer session | Session | Low | Nothing | Long-running connections, PREPARE |
| PgBouncer transaction | Transaction | Minimal | SET, PREPARE, advisory locks | Stateless web APIs |
| PgBouncer statement | Statement | Minimal | Transactions, cursors | Single-statement use (rare) |
| HikariCP | Session (JVM) | Minimal | Nothing | Java apps; combine with PgBouncer |
| pgpool-II | Session/Transaction | Medium | Some modes | HA + pooling combined |

---

## Production Considerations

1. **Run `ANALYZE` after every significant bulk load.** Autovacuum's threshold (10% of table changed by default) is too coarse for tables that receive large batch imports. Add explicit `ANALYZE table_name;` to the end of every migration script that touches >1% of any table's rows.

2. **Set `random_page_cost = 1.1` on all SSD storage.** The default value of 4.0 was calibrated for spinning hard drives from 2005. On NVMe storage, random reads are ~1.05× sequential. With the default, the optimizer systematically avoids index scans even when they are clearly correct. This single configuration change is the highest-ROI performance tuning action for modern hardware.

3. **Monitor `pg_stat_statements` daily, not only during incidents.** The top 10 queries by total execution time account for 80%+ of database load in almost every system (power law distribution). Reviewing these weekly prevents slow accumulation of performance debt.

4. **Size connection pools based on Little's Law, not "number of threads."** Pool size = max_RPS × avg_latency_seconds. Not "one connection per thread" — that leads to over-pooling and PostgreSQL context switch overhead. For PostgreSQL, `num_cores × 2` is a reliable upper bound.

5. **Use `CREATE INDEX CONCURRENTLY` for all production index creation.** Regular `CREATE INDEX` takes an exclusive lock that blocks all writes. `CONCURRENTLY` does the build while allowing concurrent writes (takes ~3× longer but never blocks). Every production index creation must be `CONCURRENTLY`.

6. **Implement `statement_timeout` and `idle_in_transaction_session_timeout`.** Without these, a runaway query or stuck transaction holds locks indefinitely. Set `statement_timeout = '30s'` for OLTP workloads, `idle_in_transaction_session_timeout = '5min'`. These prevent "connection pile-up" incidents where one slow query cascades.

7. **Use covering indexes (`INCLUDE`) for the top 5 most-called queries.** An Index Only Scan (no heap access) is typically 5-10× faster than an Index Scan (requires heap access) for narrow result sets. Check `pg_stat_statements` for high-call, low-latency queries that could be served by covering indexes.

8. **Partition tables that exceed 100M rows and receive range queries.** Partition pruning can reduce the rows scanned from 1B to 10M for a monthly query — 100× reduction. The partition boundary must match the query's filter column exactly. Without partitioning, VACUUM on a 1B-row table is a multi-hour operation that competes with production workloads.

9. **Review query plans after every schema change.** Adding a column, changing a type, or removing an index can change the optimizer's plan for every query touching that table. After schema migrations, run `EXPLAIN ANALYZE` on the 10 most critical queries and compare to the pre-migration baseline.

10. **Never `SELECT *` in application code.** Selecting all columns prevents the optimizer from using Index Only Scans (which only work when all needed columns are in the index). SELECT * also fetches large column values (TEXT, JSONB, BYTEA) that are stored out-of-line via TOAST — each causing an additional TOAST page read. Always select exactly the columns needed.

---

## Common Beginner Mistakes

1. **Adding an index on every column "just to be safe."** Each index adds write amplification to every INSERT/UPDATE/DELETE. A table with 20 indexes has 20× the write overhead of a table with 1 index. Index only columns that are actually queried. Drop unused indexes (those with `idx_scan = 0` in `pg_stat_user_indexes`).

2. **Using `LIKE '%keyword%'` (leading wildcard) and expecting an index to help.** A leading-wildcard LIKE (`%word%`) cannot use a B-tree index. PostgreSQL must sequential-scan the table. Use full-text search with a GIN index and `@@` operator for keyword search. Or `pg_trgm` (trigram GIN index) which does support `LIKE '%word%'`.

3. **Not understanding ORM lazy loading.** Most ORMs use lazy loading by default: related objects are fetched one by one when accessed. Developers testing with 10 records don't notice. In production with 1,000 records, they generate 1,001 queries. Always review ORM query logs for production-representative data volumes.

4. **Running `EXPLAIN` without `ANALYZE`.** `EXPLAIN` alone shows the plan the optimizer WOULD choose, based on statistics — it does not execute the query. `EXPLAIN ANALYZE` actually executes the query and shows real row counts and actual timing. Without `ANALYZE`, you cannot see the discrepancy between estimated and actual rows — the most important diagnostic information.

---

## Common Senior Engineer Mistakes

1. **Trusting query plan stability without plan pinning.** Optimizer plans can change when: statistics are updated, PostgreSQL is upgraded, `pg_statistics` vacuum runs, or parameter values change (generic vs custom plan). A query that was fast for 6 months can suddenly become slow after a routine autovacuum. For latency-critical queries, use `pg_hint_plan` or parameterized stored procedures to pin the plan.

2. **Setting `work_mem` globally without understanding the multiplication factor.** `work_mem` is allocated PER SORT/HASH operation PER QUERY PER CONNECTION. With 100 connections each running a 3-sort query: 100 × 3 × work_mem consumed. Setting `work_mem = 1GB` globally on a server with 32 GB RAM and 100 connections = potentially 300 GB needed. Set `work_mem` globally low (8-16MB) and override per-session for heavy analytical queries using `SET LOCAL work_mem = '256MB'`.

3. **Indexing foreign keys but forgetting join direction matters.** A foreign key from `orders.customer_id → customers.id` needs an index on `orders.customer_id` (for queries starting from orders). The primary key on `customers.id` is already indexed. But the reverse query — "find all customers who have no orders" — needs a different plan using a LEFT JOIN with null check. Missing the index on the FK side causes full table scans on the referencing table.

4. **Using `TRUNCATE` instead of `DELETE + VACUUM` for archiving old data, without understanding partition alternatives.** `TRUNCATE` requires an `ACCESS EXCLUSIVE` lock (blocks all reads and writes during the operation). `DELETE` + `VACUUM` avoids exclusive locks but creates dead tuples. The correct approach for large-scale archiving is: use time-based partitioning, then `DROP TABLE partition_name` (instant, no locks, no dead tuples) or `DETACH PARTITION` followed by `DROP`.

---

## Architecture Smells

- **`SELECT *` in all ORM model definitions:** Fetches all columns including large BLOB/TEXT fields that are almost never needed. Prevents Index Only Scans. Add `defer` annotations or explicit field lists to ORM models for columns that are rarely needed.
- **One global database for all microservices:** All services compete for the same connection pool, same lock domain, same autovacuum budget. A slow query in one service impacts all others. Separate services into separate databases or schemas.
- **Disabling autovacuum on write-heavy tables:** A common "optimization" that avoids autovacuum I/O at the cost of unbounded table bloat, XID wraparound risk, and eventual complete system failure. Tune autovacuum parameters (cost delay, worker count) instead of disabling it.
- **Long-running analytics queries on the primary:** OLAP queries holding old snapshots block autovacuum on the primary and cause table bloat. Analytics queries belong on a read replica with `hot_standby_feedback=on` and generous `max_standby_streaming_delay`.
- **ORM-generated schema with no DBA review:** ORMs add an index for every foreign key and often add additional indexes for every unique constraint. For a table with 10 FKs and 5 unique constraints, the ORM may generate 15+ indexes. On a write-heavy table, this is a performance disaster. Review ORM-generated indexes before deploying schema changes.

---

## Principal Engineer Perspective

**Query optimization is a feedback loop, not a one-time task.**  
Statistics go stale, data distributions shift, usage patterns change, and the optimizer's choices drift. A query that was optimally planned 6 months ago may be suboptimally planned today because the ratio of users with 1 order vs 50,000 orders has shifted. Build automated monitoring: `pg_stat_statements` scraping, query latency alerting, and weekly plan reviews for the top 20 queries. This is ongoing work, not a project.

**The optimizer is almost always right — when given accurate information.**  
Before reaching for `pg_hint_plan`, exhaust all data-quality solutions: run ANALYZE, increase statistics_target, add extended statistics for correlated columns, tune `random_page_cost` for your hardware. Hints couple your query to a specific plan permanently — any future change in data distribution or PostgreSQL version may make the hinted plan catastrophically wrong. Hints are last-resort, with documented justification and a scheduled review date.

**Index design is the highest-leverage database decision.**  
A missing index on a 500M-row table causes a query to take 60 seconds instead of 2ms — a 30,000× difference. No amount of query rewriting, caching, or application optimization compensates. Conversely, an over-indexed table with 20 indexes has 10-20× write amplification — limiting write throughput and causing deployment problems when tables need to be rebuilt. The right answer requires understanding the query workload: which queries run how often, what selectivity, what result size. Index design cannot be automated by an ORM; it requires human judgment with production traffic data.

**N+1 queries are the most common performance problem, and the most preventable.**  
Every ORM supports eager loading. Every application framework has query logging. There is no technical excuse for shipping N+1 queries to production. The cause is always the same: developers testing with small datasets, where 101 queries run in 50ms and feel instant. The fix is always the same: SQL query logging in development, with a query count assertion in integration tests (assert that rendering an order list fires ≤ 3 queries). This one practice eliminates 80% of production N+1 incidents before they reach production.

---

## Architecture Review Questions

1. A PostgreSQL table with 200 million rows has `random_page_cost = 4.0`. A query filtering on a column with 0.5% selectivity executes a sequential scan instead of an index scan. Why does this happen, and what configuration change would fix it without changing any application code?

2. The optimizer estimates 500 rows for a WHERE clause that actually returns 2 million rows. The resulting Nested Loop join takes 4 minutes instead of the expected 2 seconds. What is the root cause? How do you diagnose it? What is the precise fix?

3. An application uses an ORM with default settings and fetches 1,000 blog posts with their authors. How many database queries are fired? Write the ORM code change and the equivalent SQL that would fix this to a single query.

4. Design the index strategy for a multi-tenant SaaS table `events(id, tenant_id, user_id, event_type, created_at, properties JSONB)` that receives 5 million inserts per day and must support three query patterns: (a) all events for a tenant in a time range, (b) all events of a specific type for a tenant, (c) all events for a specific user in a tenant. What indexes do you create? What are the write amplification costs?

5. Explain the difference between `EXPLAIN` and `EXPLAIN ANALYZE`. Why does `EXPLAIN` alone give misleading results for performance diagnosis? What is the key piece of information `EXPLAIN ANALYZE` provides that `EXPLAIN` cannot?

6. A senior engineer proposes increasing `work_mem` from 16MB to 512MB globally because one analytics query is spilling to disk. Why might this cause an OOM kill under high concurrency, and what is the correct approach?

7. Describe the Index Only Scan optimization. What must be true for PostgreSQL to use it? What is the role of the Visibility Map in enabling Index Only Scans? How do dead tuples affect the frequency with which Index Only Scans degrade to regular Index Scans?

8. A table receives 10,000 INSERTs/second. It has 15 indexes. Engineers notice write throughput has been declining for 6 months. Diagnose the problem and propose both immediate and long-term remediation.

9. How does PgBouncer in transaction mode differ from session mode? What SQL features are broken in transaction mode, and why? Design the connection pooling architecture for an application that uses both PREPARE statements (broken by transaction mode) and needs multiplexing (provided by transaction mode).

10. An Instagram-scale social graph has 30 billion media rows, all indexed by `user_id`. A single index on `user_id` is 3TB and cannot fit in RAM. Index lookups require disk seeks → p99 = 4 seconds. Without changing the application's query structure, what architectural change achieves p99 < 10ms?

---

## Visual/Animation Specification

### Animation 1: Query Plan Tree Explorer

Interactive EXPLAIN ANALYZE visualizer:
- Input box: paste raw EXPLAIN ANALYZE text output
- Output: rendered as a collapsible tree with color-coded nodes
  - Red: nodes with actual/estimated row ratio > 10× (statistics problem)
  - Orange: Seq Scans on large tables (potential missing index)
  - Yellow: Hash Join with Batches > 1 (disk spill — work_mem too small)
  - Blue: Index Scans (good)
  - Green: Index Only Scans (optimal)
- Click any node: shows tooltip with explanation of what this node does and when it's a problem
- "Time breakdown" panel: pie chart of time spent in each node (self-time calculated automatically)
- "Suggestions" panel: auto-generated fixes based on the identified anti-patterns

### Animation 2: N+1 Query Visualization

Side-by-side animated comparison:
- Left: N+1 pattern — show query timeline
  - 1 wide bar: "SELECT orders" (1 query)
  - 100 narrow bars: "SELECT customers WHERE id=?" (100 queries)
  - Timeline grows long; each small bar adds visible latency
  - Counter: "Total queries: 101, Total time: 505ms"
- Right: Fixed with JOIN — single wide bar
  - "SELECT orders JOIN customers" (1 query)
  - Counter: "Total queries: 1, Total time: 5ms"
- Control: slider for N (1 to 10,000) — watch the N+1 side's timeline grow linearly
  while the JOIN side stays flat
- Toggle ORM code between eager/lazy loading — SQL log updates in real-time

---

## Hands-On Tutorial: Query Performance Investigation

### Setup: Create a Test Database

```bash
# Start PostgreSQL
docker run -d --name pg-perf \
  -e POSTGRES_PASSWORD=secret \
  -p 5432:5432 \
  postgres:16

docker exec -it pg-perf psql -U postgres -c "CREATE DATABASE perf_demo;"
docker exec -it pg-perf psql -U postgres -d perf_demo
```

```sql
-- Create test schema with performance problems built in
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Users table
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    country VARCHAR(2) DEFAULT 'US',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT
);

-- Orders table (no indexes yet — we'll add them strategically)
CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    status TEXT DEFAULT 'pending',
    total NUMERIC(12,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order items
CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    product_name TEXT,
    quantity INT,
    price NUMERIC(10,2)
);

-- Generate realistic test data (1M users, 5M orders, 15M items)
INSERT INTO users (email, country, name)
SELECT 
    'user' || i || '@example.com',
    CASE WHEN random() < 0.6 THEN 'US'
         WHEN random() < 0.8 THEN 'EU'
         ELSE 'APAC' END,
    'User ' || i
FROM generate_series(1, 1000000) i;

INSERT INTO orders (user_id, status, total, created_at)
SELECT 
    (random() * 999999 + 1)::bigint,
    CASE WHEN random() < 0.4 THEN 'completed'
         WHEN random() < 0.7 THEN 'pending'
         WHEN random() < 0.9 THEN 'shipped'
         ELSE 'cancelled' END,
    (random() * 500 + 10)::numeric(12,2),
    NOW() - (random() * 365)::int * INTERVAL '1 day'
FROM generate_series(1, 5000000);

INSERT INTO order_items (order_id, product_name, quantity, price)
SELECT 
    (random() * 4999999 + 1)::bigint,
    'Product ' || (random() * 1000)::int,
    (random() * 5 + 1)::int,
    (random() * 200 + 5)::numeric(10,2)
FROM generate_series(1, 15000000);

-- Update statistics
ANALYZE;
```

### Exercise 1: Find and Fix the Slow Query

```sql
-- Slow query: user dashboard (find all orders for a user with their items)
\timing on

-- Run this query and measure time:
SELECT o.id, o.status, o.total, o.created_at,
       COUNT(oi.id) as item_count
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE o.user_id = 42
GROUP BY o.id, o.status, o.total, o.created_at
ORDER BY o.created_at DESC;

-- Record the time. Then examine the plan:
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.id, o.status, o.total, o.created_at,
       COUNT(oi.id) as item_count
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE o.user_id = 42
GROUP BY o.id, o.status, o.total, o.created_at
ORDER BY o.created_at DESC;

-- Identify: Is there a Seq Scan? How many rows removed by filter?

-- Fix: Add appropriate index
CREATE INDEX CONCURRENTLY idx_orders_user_id ON orders (user_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_order_items_order_id ON order_items (order_id);

-- Rerun and compare
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.id, o.status, o.total, o.created_at,
       COUNT(oi.id) as item_count
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE o.user_id = 42
GROUP BY o.id, o.status, o.total, o.created_at
ORDER BY o.created_at DESC;
```

### Exercise 2: Find Top Queries with pg_stat_statements

```sql
-- Enable tracking (requires pg_stat_statements in postgresql.conf)
-- For this demo, reset and then run several queries:
SELECT pg_stat_statements_reset();

-- Simulate application workload:
DO $$
DECLARE i int;
BEGIN
  FOR i IN 1..100 LOOP
    PERFORM * FROM orders WHERE user_id = (random() * 999999)::int LIMIT 10;
    PERFORM * FROM users WHERE email = 'user' || (random() * 999999)::int || '@example.com';
    PERFORM COUNT(*) FROM orders WHERE status = 'pending' AND created_at > NOW() - INTERVAL '30 days';
  END LOOP;
END $$;

-- Find top queries by total time:
SELECT 
    calls,
    round(total_exec_time::numeric, 0) AS total_ms,
    round(mean_exec_time::numeric, 2) AS avg_ms,
    rows,
    LEFT(query, 100) AS query_preview
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
ORDER BY total_exec_time DESC
LIMIT 10;
```

### Exercise 3: Covering Index for Index-Only Scan

```sql
-- Query: Dashboard summary (called 10K times/day)
EXPLAIN (ANALYZE, BUFFERS)
SELECT user_id, status, COUNT(*), SUM(total)
FROM orders
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY user_id, status;

-- Note: Index Scan vs Index Only Scan
-- "Heap Fetches: N" — how many times it had to go to the heap

-- Create covering index:
CREATE INDEX CONCURRENTLY idx_orders_covering_summary
ON orders (created_at)
INCLUDE (user_id, status, total);

-- Rerun: should show "Index Only Scan" and "Heap Fetches: 0"
EXPLAIN (ANALYZE, BUFFERS)
SELECT user_id, status, COUNT(*), SUM(total)
FROM orders
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY user_id, status;
```

### Exercise 4: Partial Index Efficiency

```sql
-- Count index sizes
SELECT indexname, 
       pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE tablename = 'orders'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Most queries only care about 'pending' orders:
-- Create partial index (much smaller!)
CREATE INDEX CONCURRENTLY idx_orders_pending_created
ON orders (created_at DESC)
WHERE status = 'pending';

-- Compare sizes:
SELECT indexname,
       pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE tablename = 'orders'
ORDER BY pg_relation_size(indexrelid) DESC;
-- idx_orders_pending_created should be ~30-40% of full index size
-- (pending is ~30% of rows)

-- Verify it's used:
EXPLAIN (ANALYZE)
SELECT * FROM orders 
WHERE status = 'pending' AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC LIMIT 50;
-- Should show: Index Scan using idx_orders_pending_created
```

---

## Exercises

### Conceptual Exercises

1. **Cost model:** A table has 10 million rows. Sequential scan cost = 100,000 units (seq_page_cost=1.0). An index scan for a 2% selectivity query uses random I/O: 200,000 rows × random_page_cost. What is the index scan cost with (a) random_page_cost=4.0 (HDD default)? (b) random_page_cost=1.1 (SSD correct setting)? Which plan does the optimizer choose in each case?

2. **N+1 identification:** A Django view renders a table of 50 blog posts, each showing the post title, author name, and number of comments. The ORM models are: Post (ForeignKey to User as author), Comment (ForeignKey to Post). Without any select_related/prefetch_related, how many database queries does this view generate? Write the optimized Django ORM call.

3. **Index column order:** A query is: `WHERE tenant_id = 42 AND event_type = 'purchase' AND created_at > '2024-01-01'`. You can create ONE composite index. What is the optimal column order and why? How does column order affect the number of index entries scanned?

4. **Stale statistics impact:** A table has 1 million rows. Statistics show 10,000 distinct `user_id` values. A batch import adds 9 million rows all from ONE new user_id (user 999999 has 9M rows). Statistics are not updated. A query `WHERE user_id = 999999` is planned. What row count does the optimizer estimate? What is the actual row count? What plan does the optimizer choose vs what plan is optimal?

5. **work_mem calculation:** A server has 128 GB RAM. PostgreSQL has `max_connections = 200`. A complex query uses 3 sort/hash operations. If `work_mem = 64MB`, what is the maximum memory PostgreSQL might use for sort/hash operations alone? Is this safe?

### Architecture Exercises

1. **Index strategy for time-series:** A `metrics` table stores sensor readings: `(sensor_id, timestamp, value)`. It receives 1 million inserts per minute and is queried with: (a) last 24h readings for a specific sensor, (b) all sensors' last reading (1 reading per sensor), (c) aggregate over all sensors in a time range. Design indexes for all three patterns. What is the write amplification cost?

2. **Sharding decision:** An e-commerce platform has a `product_reviews` table with 10 billion rows, growing at 50 million/day. Queries are always `WHERE product_id = ?` (with various sort/filter combinations). A full B-tree index on product_id is 800GB and doesn't fit in RAM. Design a solution that achieves p99 < 50ms for these queries without hardware upgrades.

3. **Connection pool design:** A microservice handles 5,000 RPS with average query latency of 15ms. It runs 10 pods (Kubernetes). PostgreSQL is a single 32-core server with `max_connections = 500`. Design the complete connection pooling architecture: number of PgBouncer instances, pool sizes per service, HikariCP settings per pod, and the failover strategy.

### Quantitative Exercises

1. **Index write amplification:** A table receives 50,000 INSERTs/second. It currently has 8 indexes. Each index add takes 0.02ms per row. Queries are currently 95% reads, 5% writes. (a) How much total write work is done per second? (b) If the team removes 5 unused indexes, what is the new write work? (c) At what point does index maintenance become the write throughput bottleneck?

2. **Query time budget:** An API endpoint has a p99 SLA of 500ms. The breakdown: network 5ms, application logic 20ms, serialization 5ms. Currently the DB query takes p99=600ms (causing SLA breach). After adding a covering index, the query takes p50=2ms and p99=25ms. Now what is the API endpoint p99?

### Solutions to Quantitative Exercises

**Exercise 1 — Index write amplification:**
- (a) Total write work: 50,000 INS/s × (1 heap write + 8 index inserts) = 50,000 × 9 = 450,000 write operations/second. Time per insert: 0.02ms × 8 = 0.16ms in index maintenance + heap write time.
- (b) After removing 5 indexes (3 remain): 50,000 × (1 + 3) = 200,000 write operations/second. **55% reduction in write work.**
- (c) Bottleneck occurs when index maintenance time equals available write time: at 50,000 INSERT/s, each insert must complete in 1/50,000 = 20µs = 0.020ms. With 8 indexes at 0.02ms each = 0.16ms per insert total. The inserts cannot sustain 50,000/s with 8 indexes; effective throughput = 1/(0.160ms) = **6,250 inserts/second maximum** — 8× slower than without indexes.

**Exercise 2 — Query time budget:**
- Before fix: API p99 = 5ms (network) + 20ms (logic) + 600ms (DB) + 5ms (serial) = 630ms > 500ms SLA ✗
- After fix: API p99 = 5ms + 20ms + 25ms (DB p99) + 5ms = **55ms** — well within 500ms SLA ✓
- The covering index reduced DB contribution from 600ms to 25ms = **24× improvement, SLA now met**

---

## Interview Questions

### Beginner Level

1. What is an index and why does it speed up queries?
2. What is the difference between a sequential scan and an index scan? When does PostgreSQL prefer each?
3. What is the N+1 query problem and how do you fix it?
4. What does `EXPLAIN ANALYZE` tell you that `EXPLAIN` alone does not?
5. What is a connection pool and why is it necessary?

### Senior Level

1. Explain how PostgreSQL's cost-based optimizer uses `pg_statistic` data. What happens when statistics are stale?
2. Design indexes for a query: `WHERE user_id = ? AND status IN ('active', 'pending') AND created_at > ?`. Consider selectivity and write amplification trade-offs.
3. How do you identify which queries are consuming the most database resources in production? Walk through the `pg_stat_statements` queries you would run.
4. A query uses a sequential scan despite an index existing on the filtered column. Name three possible reasons and how you would diagnose each.
5. What is a covering index? Under what conditions does PostgreSQL use an Index Only Scan vs a regular Index Scan?

### Staff Level

1. Walk through diagnosing a query that suddenly became 100× slower after a large batch data import. What is the root cause, what tool do you use to confirm it, and what is the fix?
2. Explain write amplification from over-indexing. A table has 15 indexes and receives 10K writes/second. How do you determine which indexes to drop? What is the process?
3. Design the connection pooling architecture (PgBouncer + HikariCP) for a Java service at 3,000 RPS with 15ms avg query latency, running 20 pods, with a 16-core PostgreSQL server. Justify every size.
4. Explain the difference between a partial index and a covering index. Give a concrete use case for each where the other type would be insufficient.

### Principal Level

1. Instagram has a 30-billion-row media table. A B-tree index on `user_id` is 3TB and doesn't fit in RAM. The p99 for user media lookups is 4 seconds. Without changing the application's query structure, design an architecture that achieves p99 < 10ms. Justify each component.
2. A multi-tenant SaaS has 10,000 tenants in shared tables. One power tenant has 500M rows (vs 10K for typical tenants). How does this affect query planning (statistics skew)? What index strategy prevents other tenants' queries from being impacted? How do you prevent one tenant's queries from consuming all database resources?
3. Explain the trade-off between using `pg_hint_plan` to stabilize a query plan vs fixing the root cause (statistics, index design). Under what circumstances is each appropriate? What are the maintenance risks of each approach at a 5-year time horizon?
4. Design a comprehensive database performance monitoring system: what metrics to collect (from `pg_stat_statements`, `pg_stat_user_indexes`, `pg_stat_bgwriter`, `pg_locks`), what alert thresholds, and what automated remediation actions (if any) you would implement.

---

## Summary

Query optimization is the discipline of ensuring the PostgreSQL cost-based optimizer has accurate information (fresh statistics, correct cost model for your hardware) and the right physical structures (appropriate indexes) to generate optimal execution plans.

The optimizer is a cost-based search engine: it estimates rows using `pg_statistic` histograms, assigns costs using a hardware-calibrated model, and selects the cheapest plan. When statistics are stale, estimates diverge from reality by orders of magnitude, causing catastrophically wrong plan choices. `ANALYZE` is the fix. `random_page_cost = 1.1` is mandatory on SSD storage — the default value systematically avoids index scans that would be correct on modern hardware.

Index design is the highest-leverage database optimization. A missing index causes a 30,000× performance difference (2ms vs 60s on a 500M-row table). Over-indexing causes 10-20× write amplification, limiting write throughput. The correct index strategy requires knowing the query workload: partial indexes for low-cardinality filters, expression indexes for function-wrapped columns, covering indexes for Index-Only Scan eligibility, and composite indexes with equality columns before range columns.

The N+1 query problem — an ORM fetching N parent records then N individual child queries — is the most common application-level performance bug. It is entirely preventable with eager loading (JOIN), batch loading (IN clause), or explicit SQL. Detection requires SQL query logging with production-representative data volumes and `pg_stat_statements` monitoring for queries with very high call counts.

Connection pool sizing follows Little's Law: `pool_size = max_RPS × avg_latency_seconds`. Over-pooling (too many connections) causes PostgreSQL context switch overhead and cache thrashing. Under-pooling causes connection exhaustion and queuing. PgBouncer in transaction mode is the correct architecture for stateless web APIs, multiplexing thousands of application connections onto tens of PostgreSQL backends.

---

## What You Should Now Be Able To Explain

- **EXPLAIN ANALYZE interpretation:** How to identify the dominant cost node, read row estimate vs actual divergence, recognize sequential scans that need indexes, detect disk spills from Batches > 1, and calculate self-time per node from parent vs child times
- **Statistics and plan stability:** Why the optimizer's quality is entirely dependent on `pg_statistic` accuracy, how to detect stale statistics via row estimate divergence, and why `random_page_cost = 1.1` is the most impactful single tuning change on SSD storage
- **Index type selection:** When to use B-tree vs partial vs expression vs covering indexes, the mandatory column ordering rule (equality before range in composite indexes), and the write amplification cost of each additional index
- **N+1 query detection and fix:** How to identify N+1 via `pg_stat_statements` (high call count, simple WHERE clause), how ORM lazy loading causes it, and the three fix patterns (JOIN, batch IN, explicit SQL)
- **Connection pool mathematics:** Little's Law application to pool sizing, why over-pooling degrades PostgreSQL performance, PgBouncer transaction mode multiplexing, and the difference between pool exhaustion (connection timeout) and database saturation (slow query)
- **pg_stat_statements analysis:** The four key query views (top by total time, top by calls, high variance, high I/O) and how each identifies a different class of performance problem

---

## What To Learn Next

**Chapter 33 — Security Engineering: Authentication, Authorization, and Zero-Trust at Scale**

Having completed the performance engineering tier (edge architecture, query optimization, caching, replication), Chapter 33 addresses the security foundation that every system requires: how identity is established, how access decisions are made, and how trust is distributed across a microservices architecture. We will examine authentication mechanisms — OAuth2 and OIDC flows (Authorization Code + PKCE, Client Credentials, Device Flow), JWT structure and validation vulnerabilities (algorithm confusion, key confusion, aud/iss bypass), and session management at scale. We will design role-based access control (RBAC) and attribute-based access control (ABAC) systems, implement Open Policy Agent (OPA) for distributed policy enforcement, and analyze the zero-trust network model (BeyondCorp). We will cover secrets management (HashiCorp Vault, AWS Secrets Manager, rotation strategies), supply chain security (SLSA, SBOM, container image signing with Sigstore), and the security incident response lifecycle. Real-world examples from Okta's 2023 breach and the Log4Shell vulnerability illustrate how security architecture decisions translate to resilience against real-world attacks.
