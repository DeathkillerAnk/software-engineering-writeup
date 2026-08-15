# Chapter 8 — Consistency, Consensus, and the CAP Theorem

## Difficulty
Advanced → Expert

## Importance
**Must Know** — This is the most theoretically dense chapter in the curriculum, and the most misunderstood topic in distributed systems engineering. The CAP theorem is regularly cited and almost universally misapplied. Linearizability is confused with "strong consistency." Eventual consistency is assumed to mean "sometimes wrong." Engineers choose "AP systems" without understanding what they are actually giving up. A Principal Engineer who cannot precisely define these terms cannot make principled architectural decisions, cannot evaluate vendor claims, and cannot reason about failure modes. This chapter fixes that.

## Prerequisites
Chapter 7 — Storage Engines and Database Internals (WAL, replication basics)
Chapter 3 — Network Layers, TCP & UDP (network partitions, timeouts)

## Learning Objectives

By the end of this chapter you will be able to:

1. State the CAP theorem precisely — including what "partition" means and what the theorem actually proves.
2. Explain why the CAP theorem is frequently misapplied and what the PACELC model adds.
3. Define the consistency models on the spectrum from linearizability to eventual consistency — with precise definitions and examples.
4. Explain what "consensus" means in distributed systems and why it is hard.
5. Describe how the Raft consensus algorithm works: leader election, log replication, and safety guarantees.
6. Explain how Paxos differs from Raft conceptually.
7. Connect consensus algorithms to real systems: etcd, ZooKeeper, Kafka, CockroachDB.
8. Explain why you cannot have distributed transactions without consensus.

## Why This Matters

Every architectural decision about distributed data involves a hidden assumption about consistency:

- "We use Cassandra, so it's eventually consistent" — but what does that mean for payment idempotency?
- "We use a primary-secondary PostgreSQL setup" — is it linearizable? What happens if the primary fails and the secondary hasn't replicated the last 3 commits?
- "We use etcd for distributed locks" — what consensus algorithm does it use, and what happens if a network partition splits the etcd cluster?
- "We use Kafka with `acks=all`" — is that the same as consensus? What is the difference between a quorum write and a linearizable write?

These questions cannot be answered by intuition alone. They require a precise vocabulary: linearizability, serializability, quorum, consensus, leader election, split-brain. This chapter builds that vocabulary from first principles.

---

## Mental Model

> **In a single-machine system, correctness is enforced by the CPU's memory ordering and the OS's scheduling. In a distributed system, there is no global clock, no shared memory, and the network can silently drop or delay messages. Consistency models define what "correct" means when you can no longer see all state simultaneously. Consensus algorithms are the mechanism by which distributed nodes agree on a single value despite failures. The CAP theorem proves that when the network partitions — and it will — you must choose between serving requests with potentially stale data (AP) or refusing to serve until you are certain (CP). PACELC adds: even without partitions, you must still trade latency for consistency.**

---

## Intuition

Imagine three bank tellers at different branches of the same bank, each keeping a ledger of your account balance.

**Perfectly consistent (linearizable):** Every time any teller updates your balance, all three tellers instantly see the new balance before the next operation is allowed. If you deposit $100 at Branch A, and then immediately withdraw $100 at Branch B, Branch B will always see your deposit. This requires synchronization on every operation — it is as if all three tellers share one pencil that can only be used by one at a time.

**Eventually consistent:** Tellers can update their own ledgers independently. Changes propagate over time. If you deposit $100 at Branch A, Branch B might not see it for a few minutes. If you try to withdraw at Branch B immediately, it might succeed *and* Branch A's balance is also debited — you've spent the money twice. The ledgers will eventually reconcile, but during the window, they are inconsistent.

**Split-brain (partition without choosing):** A snow storm cuts phone lines between Branch A and Branches B&C. Branch A continues taking deposits. Branches B and C continue taking withdrawals. When the storm clears, both sides discover conflicting operations were applied. There is no single correct answer — the bank must decide which operations to keep and which to reverse. This is what happens without a consensus algorithm.

**Consensus (Raft):** Before any deposit is confirmed, at least 2 of the 3 tellers must write it in their ledger. If the snow storm cuts Branch A off from B and C, then Branch A can no longer confirm any deposits (it can't get 2 of 3 votes). Branches B and C form a majority and continue operating. When Branch A reconnects, it replays the log from Branches B and C. No split-brain. Availability is reduced (A lost) but correctness is preserved.

---

## Visual Explanation

### The Consistency Spectrum

```
Strongest                                                        Weakest
◄──────────────────────────────────────────────────────────────────────▶

Linearizability   Serializability   Causal Consistency   Eventual Consistency
      │                  │                  │                    │
      │         "Transactions          "Causally           "Converge
  "Single copy    execute as if        related ops           eventually,
   semantics"     sequential,          respect             no ordering
   Real-time      but not             happens-before         guarantee"
   ordering       real-time"          relationship"
      │                  │                  │                    │
   etcd, ZK        PostgreSQL           DynamoDB             Cassandra
   CockroachDB      MySQL              (certain configs)    (default)
   (strict mode)                       Cosmos DB
```

### CAP Theorem Venn Diagram — The Real Version

```
               ┌─────────────────────────────────┐
               │  CAP Triangle                   │
               │                                 │
               │         Consistency             │
               │              /\                 │
               │             /  \                │
               │            /    \               │
               │           / CP   \              │
               │          / (HBase,\             │
               │         /  ZooKeep \            │
               │        /   Consul)  \           │
               │       /──────────────\          │
               │      /      CA        \         │
               │     /   (Single node   \        │
               │    /    PostgreSQL,      \       │
               │   /    no distribution)  \      │
               │  /──────────────────────  \     │
               │ /  AP (Cassandra, CouchDB, \    │
               │/    DynamoDB, DNS)          \   │
               └─────────────────────────────────┘
              Availability ─────────────── Partition Tolerance

CRITICAL NOTE: CA (Consistent + Available, no partition tolerance) only
applies to single-node or fully synchronous distributed systems.
In any real network, partitions WILL occur → CA is not a viable option.
Real choice: CP (refuse requests during partitions) vs AP (serve stale data).
```

---

## Core Concepts

### 1. The CAP Theorem — Precisely

**Theorem (Brewer, 2000; Gilbert & Lynch formal proof, 2002):**

A distributed data store cannot simultaneously guarantee all three of:
- **C — Consistency:** Every read receives the most recent write or an error. (Note: CAP uses "consistency" to mean linearizability, not the C in ACID.)
- **A — Availability:** Every request receives a non-error response (but the response may not be the most recent data).
- **P — Partition Tolerance:** The system continues operating even when an arbitrary number of messages are dropped or delayed by the network.

**The key insight:** In any real distributed system, network partitions are not optional. Networks fail. You cannot choose "no P." The real choice is:

> **When a partition occurs, do you sacrifice Consistency (AP) or Availability (CP)?**

**What "partition" means precisely:** A network partition is an event where messages between some nodes are lost or arbitrarily delayed for an unbounded period. It is NOT the same as a node crash. A node crash is detectable (eventually). A partition is not — from the perspective of either side, it could be the other side that crashed.

**What CAP does NOT say:**
- ✗ It does not say you choose once and forever. A system can be CP under partitions and CA during normal operation.
- ✗ It does not provide guidance on *how much* to sacrifice. Eventual consistency with 1ms convergence and eventual consistency with 24-hour convergence are both "AP" — but wildly different in practice.
- ✗ It does not apply to single-machine systems. CAP is about distributed systems with network communication between nodes.

### 2. Why CAP Is Misapplied

The most common misapplication: treating CAP as a binary choice that must be made at system design time, applied uniformly to all operations.

**Reality:** Most distributed systems are *tunable*:
- Cassandra: `ONE` consistency level (AP) vs `QUORUM` (CP) vs `ALL` (CP, maximum durability) — chosen per operation
- DynamoDB: Strongly consistent reads (CP) vs eventually consistent reads (AP) — chosen per read
- MongoDB: Write concern `w:1` (AP) vs `w:majority` (CP) — chosen per write

**The better question is not "is this system CP or AP?"** It is: **"For this specific operation, under this specific failure scenario, what is the system's behavior?"**

### 3. PACELC — A More Useful Model

The PACELC model (Abadi, 2012) extends CAP:

> **If there is a Partition (P): choose Availability (A) vs Consistency (C). Else (E): when the system is running normally, choose Latency (L) vs Consistency (C).**

```
System              PA/EL?  PA/EC?  PC/EL?  PC/EC?
────────────────────────────────────────────────────
DynamoDB             PA/EL   (eventual consistency, low latency normal ops)
Cassandra            PA/EL   (tunable, but defaults to AP/low latency)
CockroachDB          PC/EC   (linearizable, accepts latency cost)
PostgreSQL (single)  n/a/EL  (single node, no partition; low latency)
Spanner (Google)     PC/EC   (external consistency = linearizability globally)
etcd                 PC/EC   (Raft consensus, refuses writes during quorum loss)
```

**Why PACELC matters:** Even when there's no partition, consistency costs latency. To provide linearizable reads, you may need to contact a quorum of nodes (adding an extra network round trip). To provide serializable transactions, you need locks or validation (adding coordination overhead). Systems that claim "we are CP" during partitions often pay an EC (higher latency) cost during normal operation.

### 4. Consistency Models — From Strong to Weak

These are not fuzzy marketing terms. They have precise mathematical definitions.

#### Linearizability (Strict Consistency, External Consistency)

**Definition:** All operations appear to execute atomically, in some order that respects real-time ordering. If operation A completes before operation B begins, A appears before B in the global order.

```
Timeline:
  T=0ms: Client 1: write(x, 1) starts
  T=5ms: Client 1: write(x, 1) completes (ACK received)
  T=6ms: Client 2: read(x) starts

  Linearizability guarantees: Client 2 MUST read x=1.
  The write completed before the read began → real-time ordering preserved.

Non-linearizable (violates):
  Client 2 reads x=0 (old value) → NOT linearizable
  
Even more subtle:
  T=0ms: Client 1: write(x, 1) starts
  T=3ms: Client 2: read(x) starts   ← OVERLAPPING with write
  T=5ms: Client 1: write completes
  T=7ms: Client 2: read returns x=0

  This is linearizable! The read started before write completed (concurrent).
  The system can choose any order for concurrent operations.
  But: if read(x) returns x=1 for a concurrent operation,
  all subsequent operations must see x=1 (no "going back").
```

**Systems providing linearizability:** etcd (Raft), ZooKeeper (ZAB protocol), Google Spanner, CockroachDB (strict serializable), single-node databases.

**The cost:** Every read may require contacting a quorum of nodes to verify it has the latest value. Under network partition, writes (and potentially reads) are rejected. This is CP in CAP terms.

#### Sequential Consistency

Weaker than linearizability. All operations appear in the same order to all observers — but that order doesn't have to respect real-time.

```
Client 1: write(x, 1) then write(y, 2)
Client 2: write(x, 3) then write(y, 4)

Sequential consistency allows ALL observers to see:
  Order A: x=1, x=3, y=2, y=4  (both clients' internal orders preserved)
  Order B: x=3, x=1, y=4, y=2  (different interleaving, but consistent)

It does NOT require that if write(x,1) completed before write(x,3) started,
then x=1 appears before x=3. That's linearizability.
```

#### Serializability (ACID Transactions)

The "C" in ACID. Applies to *transactions*, not individual operations.

**Definition:** The effect of executing transactions concurrently is equivalent to executing them in some sequential order. The sequential order doesn't have to respect real-time.

```
T1: BEGIN; read(accounts where user=42); UPDATE balance WHERE user=42; COMMIT;
T2: BEGIN; read(accounts where user=42); UPDATE balance WHERE user=42; COMMIT;

Serializability: T1 and T2 execute as if they ran one after the other.
No partial interleaving of operations from T1 and T2.

Allows: T1 fully before T2, OR T2 fully before T1.
Does NOT allow: T1 reads, T2 reads (seeing T1's partial state), T1 writes, T2 writes (conflict).
```

**Serializability ≠ Linearizability:**
- Serializability applies to multi-operation transactions; linearizability applies to single operations.
- A serializable system might allow a transaction to read stale data if the stale read is "consistent" within a valid serial order.
- **Strict serializability = Serializability + Linearizability.** PostgreSQL's SERIALIZABLE isolation achieves this (via SSI — Serializable Snapshot Isolation).

#### Causal Consistency

Preserves the "happens-before" relationship (from Chapter 2: Lamport clocks). If event A causally precedes event B (A caused B, e.g., A wrote a value that B read), then all processes observe A before B.

Events that are causally independent may be observed in any order.

```
Client 1: post("Alice published a blog post")  → event A
Client 2: reads event A, then post("Comment on Alice's post")  → event B
           (B causally depends on A)

Causal consistency guarantees:
  All clients see A before B (because B depends on A)

Client 3: post("Bob uploaded a photo")  → event C (independent of A and B)
  A client might see: A, C, B (allowed — C is causally independent)
  Or: C, A, B (allowed)
  But NOT: B, A (not allowed — B depends on A)
```

**Systems:** DynamoDB (with vector clocks/version vectors), MongoDB (causal consistency sessions), COPS (academic), Cosmos DB (session consistency).

#### Read-Your-Own-Writes (Monotonic Read, Session Consistency)

Practical consistency model for user-facing applications. A user always sees the effects of their own writes, even from a replica that may lag.

```
User posts a tweet (write goes to primary):
  Without RYOW: User refreshes, hits a lagging replica → tweet not visible → confusing
  With RYOW: System ensures user reads from primary (or a replica at or ahead of their write LSN)

Implementation:
  After write, return the WAL position (LSN) to the client.
  On subsequent reads, client includes LSN in request header.
  System routes to a replica that has caught up to that LSN.
```

#### Eventual Consistency

The weakest model with a useful guarantee.

**Definition:** If no new updates are made, all replicas will eventually converge to the same value.

**What it does NOT guarantee:**
- When they will converge (could be milliseconds, could be hours)
- What value they will converge to (Last-Writer-Wins? application merge logic?)
- Any ordering of operations observed by different clients
- That a reader will see their own writes

```
Cassandra with consistency level ONE:
  Write to node A: x=1
  Immediately read from node B: x=0 (hasn't received update yet)
  Read again from node B 500ms later: x=1 (eventually consistent)

  No guarantee that x=1 will be seen before x=0.
  No guarantee when "eventually" is.
  
  But: the system will NOT run forever with x=1 on A and x=0 on B.
  Eventually (via anti-entropy, read-repair, hinted handoff): they converge.
```

**Conflict resolution in eventual consistency:**
When two nodes independently update the same value, there's a conflict. Resolution strategies:
- **Last-Writer-Wins (LWW):** Higher timestamp wins. Simple but can lose data (the "lower-timestamp" write is silently discarded).
- **Multi-value (siblings):** Store all conflicting versions; return them all to the client. Client (or application) resolves the conflict. Amazon's Dynamo does this.
- **CRDTs (Conflict-free Replicated Data Types):** Data structures designed to merge automatically without conflicts (e.g., counters, sets with add-only semantics).
- **Vector clocks:** Track causality to detect conflicts precisely; merge or escalate to the application.

### 5. The Consensus Problem

**Definition:** N nodes, each starting with a value. They must agree on one value such that:
1. **Agreement:** All non-faulty nodes decide on the same value.
2. **Validity:** The decided value must have been proposed by some node.
3. **Termination:** All non-faulty nodes eventually decide.

**FLP Impossibility Theorem (Fischer, Lynch, Paterson, 1985):**
> In a fully asynchronous system (no bounds on message delay), it is impossible to achieve distributed consensus even if only one node can fail.

**Why this matters and why we aren't stuck:** Real systems are not "fully asynchronous." They use timeouts — a practical bound on how long to wait for a message. By assuming "messages eventually arrive" rather than "messages may take forever," we break the FLP impossibility. Raft and Paxos work in *partially synchronous* systems (timeouts exist) — which is the real world.

**What requires consensus in distributed systems:**
- Leader election (who is the primary database node?)
- Distributed locks (who owns the lock right now?)
- Atomic commit of distributed transactions
- Configuration management (what is the current cluster membership?)
- Sequence number generation (what is the next global ID?)

### 6. Raft — Consensus by Understanding

Raft was designed to be understandable. It is the consensus algorithm used by etcd, CockroachDB, TiKV, and newer Kafka versions (KRaft).

Raft decomposes consensus into three sub-problems:
1. **Leader Election:** Select exactly one leader at a time.
2. **Log Replication:** Leader accepts client requests, replicates them to followers.
3. **Safety:** Ensure that if a log entry is committed, it will be present in all future leaders' logs.

#### Raft Term and Leader Election

**Terms:** Raft divides time into terms, each identified by a monotonically increasing integer. Each term begins with an election.

```
Timeline of terms:
  Term 1: Leader = Node A (elected, serves requests)
  Term 2: Node A crashes → election → Leader = Node B
  Term 3: Network partition → inconclusive election → no leader elected
  Term 4: Partition heals → election → Leader = Node C
```

**Election process:**

```
Initial state: All nodes are FOLLOWERS.
                                          
Follower timeouts (election_timeout, randomized 150-300ms):
  If no heartbeat from leader received within timeout:
  → Convert to CANDIDATE
  → Increment current_term
  → Vote for self
  → Send RequestVote RPCs to all other nodes:
      RequestVote {
        term: 4,
        candidateId: "Node B",
        lastLogIndex: 100,
        lastLogTerm: 3
      }

Follower receives RequestVote:
  Grant vote IF:
    1. candidate's term >= my current term
    2. I haven't voted for anyone else this term
    3. candidate's log is AT LEAST as up-to-date as mine
       (prevents election of a node missing committed entries)

CANDIDATE wins if it receives votes from a majority (⌊N/2⌋ + 1 of N nodes):
  3-node cluster: needs 2 votes (majority)
  5-node cluster: needs 3 votes
  
CANDIDATE → LEADER:
  Immediately sends heartbeat AppendEntries RPCs to all followers
  (empty AppendEntries = heartbeat, resets election timeout)

If no majority achieved (split vote):
  Wait for election_timeout (randomized!) → try again in new term
  Randomization prevents repeated split votes
```

**Why randomized timeouts?** If all nodes have the same election timeout, they all become candidates simultaneously → all vote for themselves → nobody wins. With randomized timeouts (150-300ms), one node becomes a candidate slightly before others and wins the election before the others time out.

**Log up-to-date check:** A candidate's log must be at least as up-to-date as the voter's log. "More up-to-date" = higher last log term, or equal term and at least as long. This ensures only nodes with all committed entries can be elected — **the safety guarantee.**

#### Raft Log Replication

```
Client sends write request to leader:
  "SET x = 42"

Leader:
  1. Appends entry to its local log:
     Log index 101: {term: 4, command: "SET x = 42"}
     (Entry is UNCOMMITTED — not yet durable)

  2. Sends AppendEntries RPC to all followers concurrently:
     AppendEntries {
       term: 4,
       leaderId: "Node B",
       prevLogIndex: 100,
       prevLogTerm: 4,    ← follower uses this to verify log consistency
       entries: [{term:4, cmd:"SET x=42"}],
       leaderCommit: 100  ← highest committed index leader knows of
     }

  3. Waits for majority to acknowledge (writes to their logs):
     Node A: acknowledged ✓
     Node B: (self) ✓
     Node C: no response (partitioned)
     → 2 of 3 = majority → COMMIT

  4. Leader commits the entry (advances commitIndex to 101)
     Leader applies "SET x=42" to state machine
     Leader returns success to client

  5. Next AppendEntries (heartbeat or new entry) tells followers
     that index 101 is now committed → followers apply it too

The entry is COMMITTED once a majority of nodes have it in their log.
A committed entry will NEVER be overwritten, even if the leader changes.
```

**Log consistency invariant (Raft's Log Matching Property):**
If two log entries have the same index and term, they contain the same command. The `prevLogIndex` and `prevLogTerm` in AppendEntries enforce this: a follower rejects the entry if its log doesn't match the leader's expectation at `prevLogIndex`. This cascading check ensures all committed entries are consistent across nodes.

#### Raft Safety Guarantee

**A committed entry is never lost.** This follows from:
1. A leader only commits an entry when a majority has written it to their logs.
2. A new leader is only elected if it has won a majority of votes.
3. A follower only votes for a candidate with at least as up-to-date a log.
4. Therefore: any majority that could elect a new leader MUST include at least one node that has every committed entry.

This is the quorum intersection property: any two majorities of N nodes share at least one node. That shared node has all committed entries → the new leader will have all committed entries.

```
5-node cluster example:
  Nodes: A, B, C, D, E
  Entry X committed by majority: A, B, C (3 of 5)
  New leader elected by majority: C, D, E (3 of 5)
  Intersection: C (has entry X)
  → New leader will have entry X (C's log is as up-to-date as any voter's)
```

#### Raft vs Paxos

**Paxos** (Lamport, 1989) was the first practical consensus algorithm. It is provably correct but famously difficult to understand and implement correctly. Multi-Paxos (for log replication) requires many optimizations to be practical.

| Aspect | Raft | Paxos |
|--------|------|-------|
| Leader election | Explicit leader per term | Implicit (any node can propose) |
| Log replication | Leader-only writes | Any node can initiate with prepare/promise/accept phases |
| Understandability | Designed for clarity | Notoriously difficult to understand |
| Real implementations | etcd, CockroachDB, TiKV | Chubby (Google), Apache ZooKeeper (ZAB, Paxos variant) |
| Safety proof | Explicit in the paper | Implicit, proven separately |
| Performance | Similar | Similar, but more complex to optimize |

**Multi-Paxos phases (simplified):**
```
Phase 1 (Prepare):
  Proposer sends Prepare(n) to acceptors (n = proposal number)
  Acceptors promise not to accept proposals numbered < n
  Acceptors return any value they previously accepted

Phase 2 (Accept):
  If proposer receives majority promises:
    Proposer sends Accept(n, v) to acceptors
    (v = value from highest-numbered previous accepted proposal, or proposer's own value)
  Acceptors accept if no promise for higher n was made

Phase 3 (Learn):
  If majority accepts: value v is chosen
  Proposer sends Learn to all learners

Multi-Paxos: Phase 1 done once per leader; Phase 2 runs for each log entry.
This is similar to Raft's leader election (Phase 1) + log replication (Phase 2).
```

### 7. Quorums — The Mathematics of Distributed Agreement

A **quorum** is a subset of nodes sufficient to make decisions. For a cluster of N nodes:

```
Majority quorum: Q = ⌊N/2⌋ + 1

N=3: Q=2  (tolerates 1 failure)
N=5: Q=3  (tolerates 2 failures)
N=7: Q=4  (tolerates 3 failures)

Formula: tolerance = ⌊(N-1)/2⌋

Why majority? Two majorities always intersect (share at least one node).
This is the intersection property that makes consensus possible.
```

**Write quorum + Read quorum = Consistency:**

```
In a 5-node cluster:
  Write quorum (W) = 3: Write succeeds when 3 nodes confirm
  Read quorum (R) = 3: Read contacts 3 nodes and takes latest value

  W + R = 6 > N = 5 → W and R always overlap by at least 1 node
  That overlapping node has the latest write → reads always see latest write

  This is Cassandra's QUORUM consistency level.

If W=1, R=5: Fastest writes, slow reads
If W=5, R=1: Slow writes (must wait for all), fastest reads
If W=3, R=3: Balanced (QUORUM)
If W=1, R=1: Fast but not consistent (eventual consistency: ONE)

Condition for strong consistency: W + R > N
```

**Dynamo-style quorums (sloppy quorum):** Cassandra and DynamoDB don't use strict quorums. If a primary node is down, they use "sloppy quorum" — they write to the next available node and use "hinted handoff" to deliver the write when the primary recovers. This is AP behavior: availability at the cost of consistency.

### 8. Distributed Transactions and Two-Phase Commit

When a transaction spans multiple nodes (e.g., debit account on Node A, credit account on Node B), you need **atomicity** across nodes.

#### Two-Phase Commit (2PC)

The classic protocol for distributed transactions:

```
Coordinator (e.g., application server or distributed DB coordinator)
  │
  ├── Participant A (Bank account debit)
  └── Participant B (Bank account credit)

Phase 1 — Prepare:
  Coordinator → A: PREPARE (can you commit the debit?)
  Coordinator → B: PREPARE (can you commit the credit?)
  
  A: acquire locks, write WAL record for the debit, respond YES (prepared)
  B: acquire locks, write WAL record for the credit, respond YES (prepared)
  
Phase 2 — Commit:
  (Both said YES)
  Coordinator → A: COMMIT
  Coordinator → B: COMMIT
  
  A: write COMMIT to WAL, release locks
  B: write COMMIT to WAL, release locks
  Coordinator: write COMMIT to its own log

If either says NO (or doesn't respond) in Phase 1:
  Coordinator → A: ABORT
  Coordinator → B: ABORT
```

**2PC Failure Modes:**

| Failure | When | Effect |
|---------|------|--------|
| Participant crashes after PREPARE | Phase 2 | On recovery, participant checks coordinator — it has a lock held indefinitely until coordinator responds |
| Coordinator crashes after PREPARE but before COMMIT | Between phases | All participants are stuck holding locks, waiting for coordinator. **Blocking protocol.** |
| Network partition between coordinator and participant | Phase 2 | Participant can't receive COMMIT → lock held forever → other transactions blocked |

**2PC is a blocking protocol:** If the coordinator crashes after Phase 1, participants must wait until the coordinator recovers — they cannot decide independently (they might decide differently and violate atomicity). This is why 2PC is rarely used without some form of coordinator HA (leader election using Raft to elect a new coordinator).

#### Three-Phase Commit (3PC)

Adds a `pre-commit` phase to avoid the blocking issue. Rarely used in practice because it doesn't solve the problem under network partitions, just under node failures.

#### Saga Pattern (Alternative to 2PC)

Break a distributed transaction into a sequence of local transactions with compensating transactions for rollback:

```
Order Saga:
  Step 1: Reserve inventory  (local TX on inventory-service)
  Step 2: Process payment    (local TX on payment-service)
  Step 3: Schedule delivery  (local TX on delivery-service)

If Step 2 fails:
  Compensate Step 1: Release inventory reservation (local TX)
  Return failure to user

Sagas are eventually consistent, not ACID-consistent.
They tolerate partial failures gracefully (no blocking).
Business logic must handle compensation (semantic undo, not physical undo).
```

---

## Step-by-Step Execution

### Raft Leader Failover — What Actually Happens

```
Cluster: Node A (leader), Node B (follower), Node C (follower)
Log state: A, B, C all have entries 1-100 committed.
Entry 101: A wrote it locally, sent to B and C, but only B acknowledged before crash.

Node A crashes at T=0.

T=0 to T=150ms: B and C are followers waiting for heartbeat from A.
T=150ms: Node C's election timeout fires first (randomized):
  C: converts to CANDIDATE, term=2, sends RequestVote to A and B.

B receives RequestVote from C:
  B's log: has entry 101 (from A before crash) [lastLogIndex=101, lastLogTerm=1]
  C's RequestVote: [lastLogIndex=101, lastLogTerm=1]
  C's log is as up-to-date as B's → B grants vote.

A is down: no response.
C gets 2 votes (self + B) = majority of 3 → C becomes LEADER for term=2.

BUT WAIT: Does C have entry 101?
  C did not acknowledge 101 before A crashed.
  Entry 101 is in B's log but NOT in C's log.
  Entry 101 was NOT committed (only 1 of 3 nodes = no majority).
  
C as new leader:
  C sends AppendEntries to B: prevLogIndex=100, prevLogTerm=1
  B's log has 101 after index 100 — this doesn't match C's expectation.
  B's entry 101 is OVERWRITTEN to match the new leader C's log.
  Entry 101 is lost (it was never committed → safe to lose).

Client that sent the request for entry 101:
  Received no acknowledgement (A crashed before committing).
  Client must retry → new leader C will commit a new entry.

This is correct Raft behavior:
  Committed entries (1-100): never lost.
  Uncommitted entries (101): may be lost on leader failure.
```

---

## Deep Dive

### ZooKeeper and ZAB (Zookeeper Atomic Broadcast)

ZooKeeper uses ZAB (not Raft or Paxos, though similar). It is the coordination service for Hadoop, Kafka (pre-KRaft), HBase, and many others.

**ZooKeeper data model:**
- A hierarchical namespace of **znodes** (like a filesystem)
- Persistent znodes (survive restart) and ephemeral znodes (deleted when creator session dies)
- Sequential znodes (auto-increment suffix — used for distributed locks and leader election)

```
ZooKeeper namespace:
  /kafka/
    /brokers/
      /ids/
        /1  (ephemeral — broker 1 is alive)
        /2  (ephemeral — broker 2 is alive)
    /controller (ephemeral — current Kafka controller broker)
  /election/
    /candidate_0000001 (sequential ephemeral — first candidate)
    /candidate_0000002 (sequential ephemeral — second candidate)
```

**Distributed leader election using ZooKeeper:**
```
All candidates create sequential ephemeral znodes under /election/
  Candidate A creates /election/candidate_0000001
  Candidate B creates /election/candidate_0000002
  Candidate C creates /election/candidate_0000003

Each candidate reads all children of /election/ and watches the predecessor:
  A: has smallest number → A is the leader
  B: watches /candidate_0000001 (A's znode)
  C: watches /candidate_0000002 (B's znode)

If A (leader) crashes:
  A's ephemeral znode /candidate_0000001 is automatically deleted
  B receives watch notification → B now has the smallest number → B is leader
  C watches B's znode now
```

**Ephemeral znodes = automatic failure detection.** When a node's session times out (ZooKeeper heartbeat missed), all its ephemeral znodes are deleted, triggering watchers. This is the primitive for service discovery and distributed locks.

### etcd and Raft in Production

etcd (the backing store of Kubernetes) uses Raft. It stores:
- Kubernetes object definitions (pods, services, deployments)
- Secrets and ConfigMaps
- Lease objects (distributed locks for Kubernetes controllers)

**etcd quorum loss:**
```
etcd cluster: 3 nodes (A, B, C)
2 nodes fail simultaneously → no quorum (need 2 of 3)

etcd behavior:
  ALL reads and writes FAIL with "etcdserver: leader changed" or "etcdserver: no leader"
  Kubernetes API server: cannot read/write cluster state
  Kubelet: cannot register new pods; cannot update pod status
  Workloads already running: CONTINUE (pods don't stop just because etcd is down)
  But: new deployments, config changes, secret updates → all fail

Recovery:
  1. Restore at least 1 failed node → quorum restored → etcd resumes
  2. Or: restore from etcd snapshot (PITR)

This is CP behavior: refuses service rather than returning potentially stale data.
```

---

## Real-World Example

### How Cassandra Handles a Node Failure (AP Trade-off)

**Setup:** 6-node Cassandra cluster, replication factor=3, consistency level=QUORUM.

```
Ring: Nodes A, B, C, D, E, F arranged in a consistent hash ring.
Token range for key "user:123": primary=B, replicas=C, D.

Normal operation (QUORUM write):
  Write user:123 → B, C, D must acknowledge.
  Coordinator picks B, C, D. Waits for 2 of 3 (QUORUM).
  Latency: ~2-5ms.

Node C fails:
  QUORUM write to B, C, D:
    B: ✓ acknowledged
    C: ✗ timeout (150ms) — C is down
    D: ✓ acknowledged
    2 of 3 = QUORUM met → write SUCCEEDS
  Cassandra CONTINUES serving writes. (AP behavior)

  But C is now missing the write.
  When C recovers:
    Read repair: next read to C will detect the missing write → repair it
    Anti-entropy (Merkle tree comparison): periodic background sync
    Hinted handoff: if C was only temporarily down, coordinator may have held a "hint" and delivers when C reconnects.

Node C and D fail simultaneously:
  QUORUM write: only B acknowledges → 1 of 3 < QUORUM
  Write FAILS with "Not enough replicas available"
  
  If consistency level=ONE: write succeeds (only 1 needed) → data at risk
  If consistency level=ALL: write always fails if any replica is down
```

---

## Failure Scenarios

### Scenario 1: Split-Brain in a 2-Node Database Primary-Secondary Setup

```
PostgreSQL streaming replication: Primary (A), Secondary (B).
No automatic failover (manual only).

Network partition at T=0:
  A and B can no longer communicate.
  
A: still receives writes from application clients.
   A doesn't know if B is down or if A is partitioned.
   A continues accepting writes: X=1, Y=2, Z=3 (WAL positions 101, 102, 103)

B: still receives reads (read replicas).
   B promotes itself to primary (if automated failover is configured, e.g., Patroni).
   B accepts new writes: X=5 (WAL position 101 on B — same index, different content!)
   
Partition heals at T=10 minutes:
  A's WAL: ...98, 99, 100, 101(X=1), 102(Y=2), 103(Z=3)
  B's WAL: ...98, 99, 100, 101(X=5)
  
  CONFLICT: WAL position 101 has different content on A and B.
  There is no automatic resolution — one side's data is LOST.
  
This is SPLIT-BRAIN. The system appeared to be AP (both sides served requests)
but the data is now inconsistent in an unrecoverable way without human intervention.

Fix: Use a 3-node cluster (Patroni + etcd for consensus on leader identity).
Patroni queries etcd (Raft-based) to determine who should be primary.
If A can't communicate with etcd (or loses quorum), A FENCES itself
(voluntarily stops accepting writes). B (which can talk to etcd) becomes primary.
No split-brain possible: etcd's Raft consensus is the single source of truth.
```

### Scenario 2: Network Partition in a Raft Cluster

```
5-node Raft cluster: Leader=A, Followers=B, C, D, E.
Partition splits cluster: {A, B} vs {C, D, E}.

{A, B} side:
  A tries to commit writes. Sends AppendEntries to B, C, D, E.
  Only B responds. 2 of 5 < majority (3). Writes CANNOT be committed.
  A keeps receiving client requests but cannot commit → returns errors.
  (CP behavior: refuses to serve rather than potentially diverge)

{C, D, E} side:
  C's election timeout fires. C becomes CANDIDATE for term=2.
  C wins election from D and E (2 votes + self = 3 = majority of 5).
  C becomes new leader.
  C can now commit writes (majority of C, D, E).

{A, B} side (still thinks A is leader, term=1):
  A sends AppendEntries with term=1.
  C, D, E reject with "term 2 > your term 1" → A and B learn of higher term.
  A and B revert to FOLLOWER status.

Partition heals:
  A and B learn of C's leadership (term=2).
  A and B replay C's log → any uncommitted entries on A are discarded.
  Cluster reconverges. No split-brain. Data that couldn't commit on A is lost
  (but it was never acknowledged to clients → correct).
```

---

## Performance Considerations

### Consistency Level vs Latency in Cassandra

```
Cassandra cluster: 5 nodes, RF=3, cross-datacenter (DC1 and DC2)
Each DC has local RTT of 0.5ms, cross-DC RTT of 50ms

Consistency level performance:
  ONE:        Write to 1 node, 0.5ms latency, AP (data loss if node crashes)
  QUORUM:     Write to 2 of 3 replicas, 0.5ms latency (both in same DC), CP(ish)
  LOCAL_QUORUM: Quorum within local DC only, 0.5ms latency, balance
  ALL:        Write to all 3 replicas (may be cross-DC), 50ms+ latency, strictest
  EACH_QUORUM: Quorum in each DC, 50ms latency, highest cross-DC consistency

Best practice:
  Writes: LOCAL_QUORUM (fast, survives 1 node failure in local DC)
  Reads:  LOCAL_QUORUM (consistent within DC)
  Critical data: QUORUM (cross-DC, 50ms penalty, survives DC failure)
```

### Raft Write Latency

```
5-node Raft cluster across 3 availability zones:
  AZ1 (us-east-1a): Leader + 1 follower
  AZ2 (us-east-1b): 2 followers
  AZ3 (us-east-1c): 1 follower

Write latency = Time for leader to receive ACK from majority (3 of 5 nodes):
  AZ1 → AZ1 follower: 0.3ms RTT (same AZ)
  AZ1 → AZ2 followers: 1-2ms RTT (cross-AZ)
  
  Leader needs 3 ACKs: self + AZ1 follower + fastest AZ2 follower
  Latency = max(0ms, 0.3ms, 1ms) = 1ms (dominated by first AZ2 ACK)
  
etcd write latency benchmark (NVMe SSD, co-located AZs):
  p50: 2ms, p99: 8ms, p99.9: 20ms

This is the overhead of linearizability.
Compare: Redis single-node write: 0.1ms (no consensus, no replication guarantee)
The 20× latency difference is the cost of the linearizable guarantee.
```

---

## Trade-offs

| Consistency Model | Guarantee | Cost | When to Use |
|-------------------|-----------|------|------------|
| Linearizability | Single-copy semantics, real-time ordering | Quorum reads/writes, high latency | Distributed locks, leader election, financial balances |
| Serializability | Transactions appear sequential | Locking/SSI overhead | ACID databases, complex multi-row transactions |
| Causal consistency | Causally related ops ordered | Vector clock overhead | Social feeds, collaborative editing |
| Read-your-writes | User sees own writes | Session tracking, primary routing | User profile updates, shopping cart |
| Eventual consistency | Convergence eventually | No coordination, maximum availability | DNS, CDN caching, analytics counters |
| 2PC distributed TX | Atomic multi-node commit | Blocking, coordinator SPOF | Cross-service financial transactions |
| Saga | Eventual atomicity with compensation | Complex rollback logic | Long-running business processes |

---

## Alternatives

| Need | Traditional | Modern |
|------|-------------|--------|
| Distributed coordination | ZooKeeper (ZAB) | etcd (Raft), Consul |
| Distributed transactions | 2PC | Saga, CockroachDB/Spanner (Raft + 2PC combined) |
| Consistent key-value | ZooKeeper znodes | etcd, Consul K/V |
| Globally consistent DB | — | Google Spanner (TrueTime + Paxos), CockroachDB |

---

## Production Considerations

1. **Never build distributed locks on top of AP systems.** A distributed lock built on Cassandra (AP) can be held by two clients simultaneously during a partition. Use etcd or ZooKeeper (CP) for anything requiring mutual exclusion.
2. **Understand your database's default consistency level.** Cassandra's default is `ONE` (AP). PostgreSQL with async replication is not linearizable. MySQL with `gtid_mode=ON` and semi-sync replication approaches CP. Know what you have.
3. **Prefer CP for financial data.** A $100 balance that can be read as $0 during a partition and debited is worse than a 500ms service interruption. CP databases (CockroachDB, Spanner, etcd) are appropriate for account balances.
4. **For leader election, always use a CP system.** If two nodes both believe they are the primary database, both accept writes → split-brain. Always use Raft (etcd/Consul) to enforce single-leader invariant.
5. **Size etcd clusters at odd numbers.** N=3 tolerates 1 failure. N=5 tolerates 2. N=7 tolerates 3. Even-numbered clusters offer no additional fault tolerance (N=4 still needs a majority of 3 — same as N=3).

---

## Common Beginner Mistakes

1. **Treating "eventually consistent" as "sometimes wrong."** EC systems are not random. They converge. The question is: can your application tolerate the convergence window? DNS TTL-based consistency is "eventual" — it works fine for most use cases.
2. **Thinking CAP means "choose two properties at design time."** CAP is about what happens *during a partition*. Most of the time there's no partition and you get both C and A.
3. **Using `QUORUM` in Cassandra and assuming it's linearizable.** QUORUM satisfies W + R > N for consistency, but it is NOT linearizable because of how Cassandra's sloppy quorum and last-writer-wins work. Concurrent writes to the same key with the same timestamp can still produce anomalies.

---

## Common Senior Engineer Mistakes

1. **Assuming Raft gives you strong consistency without understanding `ReadIndex`.** A Raft leader can serve stale reads if it's been partitioned from the rest of the cluster and doesn't know it's been replaced. True linearizable reads require `ReadIndex` (leader confirms it still leads before serving the read) or routing reads through the log.
2. **Using 2PC without coordinator HA.** A single coordinator node in 2PC is a SPOF. If it crashes after Phase 1, all participants block. Always pair 2PC with Raft-based coordinator election.
3. **Conflating serializability with linearizability.** PostgreSQL's SERIALIZABLE isolation is serializable but NOT linearizable — a transaction can read stale data if it was started before a recent commit. PostgreSQL with synchronous replication is needed for linearizability across primary and replicas.

---

## Architecture Smells

- **Distributed lock implemented in Redis without `WAIT`** → Redis single-node or async replica → lock not durable; clock skew invalidates expiry
- **5-node etcd cluster across 5 AZs** → if 3 AZs go down simultaneously, etcd loses quorum (needs 3 of 5). Better: 3 nodes across 3 AZs (tolerates 1 failure, simpler)
- **Application treats Cassandra as consistent without explicitly setting QUORUM** → surprise eventual consistency in production
- **No fencing token on distributed lock** → a slow client holding a lock doesn't know its lease expired; both old and new lock holder execute critical section simultaneously

---

## Principal Engineer Perspective

Most engineers understand CAP at the level of "pick two." Principal Engineers understand it at the level of failure scenarios.

**The questions Principal Engineers ask:**

1. **What happens to in-flight writes during a leader failover?** (Raft: uncommitted writes may be lost → clients must retry → operations must be idempotent)

2. **What is the maximum staleness window?** (Eventual consistency: from milliseconds with hinted handoff to hours with anti-entropy. Know the number, not just the model.)

3. **Can two clients simultaneously believe they hold the same lock?** (If yes: your critical section is not actually protected. Use Raft-based locks with fencing tokens.)

4. **What is the failure mode of your consensus cluster losing quorum?** (etcd cluster with 3 nodes: if 2 die, Kubernetes API server stops accepting writes. This is intentional — the alternative is split-brain. Is this acceptable? Plan your node count and topology accordingly.)

**The mental model upgrade from "CAP" to "Failure Scenarios":**
- "We use Cassandra (AP)" → "During a network partition that isolates DC2, writes accepted by DC2 will not be visible to DC1 for up to X seconds. Payment writes must use QUORUM. Inventory reads can use LOCAL_QUORUM. Analytics reads can use ONE."
- "We use etcd (CP)" → "If we lose 2 of 3 etcd nodes, all Kubernetes control plane operations fail. We must have etcd backups, restore procedures, and health alerts. The workloads already running will not stop."

**Consensus is the foundation of coordination.** Every distributed system that needs a single source of truth — who is the leader, what is the configuration, who holds the lock — needs consensus underneath. If you cannot name the consensus algorithm powering your coordination service, you cannot reason about its failure modes.

---

## Architecture Review Questions

1. For each database in the system: what consistency level is configured? What is the behavior during a network partition?
2. Does the system use distributed locks? If yes, what system provides them (Redis? etcd? ZooKeeper?) and is it CP?
3. Is there any possibility of split-brain in the primary database setup? How is leader election enforced?
4. What is the maximum data loss (RPO) if the primary database crashes right now? Is that acceptable?
5. Does any service rely on Cassandra or DynamoDB for operations that require strong consistency (e.g., payment deduplication, distributed locking)? If so, is the consistency level set appropriately (QUORUM or better)?
6. What is the etcd cluster size? Can it survive the failure of a full availability zone?
7. Are distributed transactions used? If so, are they 2PC or Saga? Is the coordinator highly available?
8. Is there a linearizability requirement for any operation? If so, is the storage system capable of providing it?
9. What happens to the service if the consensus cluster (etcd/ZooKeeper) loses quorum?
10. Are all distributed lock holders using fencing tokens to prevent stale lease holders from executing critical sections?

---

## Visual / Animation Specification

### Animation 1: Raft Leader Election

**Frame 1:** 5 nodes (A–E), all FOLLOWERS. All have individual election timeout countdown bars (randomized lengths).

**Frame 2:** Node C's bar empties first. C becomes CANDIDATE (highlighted). Term counter increments to 2. C sends RequestVote arrows to A, B, D, E.

**Frame 3:** B and D respond YES (green checkmarks). A and E respond NO (they have more up-to-date logs — show log length indicator). C has 3 votes (self + B + D) = majority → C becomes LEADER.

**Frame 4:** C sends AppendEntries heartbeats to A, B, D, E (green pulses). All nodes show "FOLLOWER" status. Election timers reset.

**Frame 5:** Counter shows: "Term 2, Leader: Node C." New write request arrives → C logs it → majority acks → committed.

### Animation 2: CAP Theorem — The Partition Choice

**Frame 1:** 3 nodes (A, B, C). A is the primary. Network is healthy. Client writes x=1 to A → replicates to B and C (arrows). All nodes show x=1.

**Frame 2:** Lightning bolt animation: network partition cuts {A} from {B, C}. Red X across the network links.

**Frame 3 (CP Choice):** Client sends write x=2 to A. A cannot replicate (no quorum). A REFUSES: returns error "503 No quorum." Client sees an error. Data is safe (still x=1 on all nodes). Side label: "CP: Consistent but unavailable during partition."

**Frame 4 (AP Choice):** Same partition. Client sends write x=2 to A. A accepts: "200 OK" (returns success). B and C still show x=1. Another client reads from B: sees x=1. A has x=2. Side label: "AP: Available but inconsistent during partition."

**Frame 5:** Partition heals. CP: A replicates x=2 to B and C. Consistent state. AP: Conflict! A has x=2, B and C have x=1. LWW resolution: x=2 wins (or conflict flagged). Potential data loss shown.

---

## Hands-On Tutorial

### Observing Raft in etcd

```bash
# 3-node etcd cluster (local for testing with etcd-play or Docker)
# Write a key
etcdctl put /config/feature-flag "enabled"

# Read with linearizable guarantee (default in etcd)
etcdctl get /config/feature-flag

# Read with potentially stale data (serializable - faster, no quorum contact)
etcdctl get /config/feature-flag --consistency=s

# Watch for changes (streaming)
etcdctl watch /config/feature-flag

# Check cluster health
etcdctl endpoint health --cluster

# Check leader
etcdctl endpoint status --cluster --write-out=table

# Simulate leader failure: kill the leader node
# → Watch election happen (etcdctl endpoint status shows new leader)
# → Writes fail briefly during election (<500ms with default timeouts)
# → New leader elected → writes resume

# Check etcd raft metrics
curl http://localhost:2381/metrics | grep etcd_server
```

### Testing Cassandra Consistency Levels

```bash
# Connect to Cassandra
cqlsh localhost

# Create keyspace with replication factor 3
CREATE KEYSPACE test_consistency
  WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 3};

USE test_consistency;
CREATE TABLE accounts (user_id UUID PRIMARY KEY, balance DECIMAL);

# Write with QUORUM (consistent, tolerates 1 node failure)
CONSISTENCY QUORUM;
INSERT INTO accounts (user_id, balance) VALUES (uuid(), 1000.00);

# Write with ONE (fastest, least durable)
CONSISTENCY ONE;
INSERT INTO accounts (user_id, balance) VALUES (uuid(), 500.00);

# Kill one Cassandra node, then try QUORUM vs ONE reads:
# QUORUM: succeeds if 2 of 3 nodes available
# ALL: fails if any node is down
# ONE: succeeds as long as 1 node is available
```

---

## Failure Injection Lab

### Lab: Raft Split-Brain Prevention

1. **Setup:** 3-node etcd cluster. Verify leader: `etcdctl endpoint status --cluster`.
2. **Acquire a lock:** Use `etcdctl lock my-lock` in a terminal (simulates a distributed lock holder).
3. **Simulate partition:** Block network to the leader node using iptables:
   ```bash
   sudo iptables -A INPUT -s <leader_ip> -j DROP
   sudo iptables -A OUTPUT -d <leader_ip> -j DROP
   ```
4. **Observe:** The 2 remaining nodes elect a new leader (watch election with `etcdctl endpoint status --cluster` polled every second).
5. **Old leader:** Try to write to the old leader: `etcdctl put test-key value`. Observe: the isolated node refuses writes after losing quorum (it steps down after not hearing from peers).
6. **Verify:** No split-brain — only the new majority leader accepts writes. The lock holder on the old leader's session expires (etcd TTL) and the lock is released.
7. **Heal:** Remove iptables rules. Old node rejoins, replays log from new leader.

---

## Exercises

**Conceptual:**
1. State the CAP theorem precisely. What does "partition tolerance" actually mean?
2. Why does the FLP impossibility theorem not prevent Raft and Paxos from working in practice?
3. Explain the difference between linearizability and serializability. Can a system be serializable but not linearizable?
4. In a 5-node Raft cluster, a leader commits an entry once 3 nodes have written it to their logs. The leader then crashes before notifying the other 2 nodes. Will the committed entry survive the leader change? Why?
5. What is a "fencing token" and why is it necessary even when using a Raft-based distributed lock?

**Architecture:**
6. You need to implement a global counter that increments with every user signup. The counter must never return the same value twice, even under concurrent signups. Casual consistency is NOT sufficient. Design the architecture. What consistency guarantee is required?
7. A fintech startup uses Cassandra with consistency level `LOCAL_QUORUM` for its payment processing. During a datacenter network partition, the isolated datacenter continues processing payments. What is the risk? How should the consistency level be changed for payment operations?

**Quantitative:**
8. A 7-node Raft cluster processes 10,000 writes/second. Each write requires a majority quorum. The cluster is split into a {4-node} partition and a {3-node} partition. What is the write throughput of each partition? How long does the 3-node partition operate?
9. A Cassandra cluster has N=9 nodes and RF=3. With consistency level QUORUM (W=2, R=2), verify that reads always see the latest write (W + R > RF). Now a network partition isolates 4 nodes. Can QUORUM writes succeed? Can QUORUM reads succeed?

---

## Solutions

### Exercise 4
Yes, the committed entry survives. The entry was committed because 3 of 5 nodes wrote it to their logs. To elect a new leader, a candidate needs a majority (3 of 5 votes). Any majority of 3 must include at least 1 of the 3 nodes that have the committed entry (quorum intersection). That node's log is "at least as up-to-date" as any voter's → it will win the election (or the candidate already has the entry). The new leader will have the committed entry. **Committed entries in Raft are never lost** — this is Raft's fundamental safety guarantee.

### Exercise 8
**{4-node partition}:** Has a majority of 7 (needs 4). 4 ≥ 4 → this partition can elect a leader and process writes. Write throughput: continues at 10,000/sec.

**{3-node partition}:** Needs 4 of 7 for a majority. 3 < 4 → cannot elect a leader → refuses all writes (CP behavior). Write throughput: **0 writes/sec**. This partition enters a read-only or error mode until the partition heals.

### Exercise 9
**W + R > RF:** 2 + 2 = 4 > 3 ✓ → QUORUM is consistent under normal operation.

**Under partition isolating 4 nodes:** 9 - 4 = 5 nodes available. RF=3 replicas. With QUORUM (W=2), can we write? Need to write to 2 of the 3 replicas for a given key. If both replicas are in the available 5-node partition → write succeeds. If 2 of 3 replicas are in the isolated partition → write fails. For most keys: 2 replicas in available partition → writes succeed. **QUORUM reads:** same logic — reads contact 2 of 3 replicas → succeed if 2 are in available partition. Cassandra's QUORUM is not the same as Raft — it is per-key, and whether it succeeds depends on which nodes hold which replicas.

---

## Interview Questions

### Beginner
- What is the CAP theorem?
- What is the difference between consistency and availability in the context of distributed systems?
- What happens if a Raft leader crashes?

### Senior
- Explain Raft leader election. How does it guarantee only one leader at a time?
- What is the difference between linearizability and eventual consistency? Give a real-world example of each.
- What is 2-phase commit and what is its blocking failure mode?
- How does Cassandra achieve consistency with QUORUM vs ONE?

### Staff
- Walk through what happens during a network partition in a 3-node Raft cluster. Which side can serve writes? Why?
- Explain the quorum intersection property and why it is central to consensus safety.
- What is the PACELC model and why is it more useful than CAP alone?
- Compare Saga and 2PC for distributed transactions. When would you choose each?

### Principal
- Design the consistency architecture for a global payment system that processes 1M transactions/second across 3 datacenters. What consistency guarantee does each operation require? What is the latency cost of that guarantee cross-datacenter?
- A customer reports that they were charged twice for one purchase. Your payment service uses Kafka (at-least-once) → consumer writes to DynamoDB (consistency level: ONE). Walk through every place in the pipeline where a duplicate could have been introduced and how you would prevent each.
- Your company wants to use distributed locks to prevent concurrent processing of the same order. The team proposes implementing this in Redis with a 30-second TTL. What are the failure modes? How would you redesign it using etcd with fencing tokens?

---

## Summary

Distributed systems cannot have global shared memory, a global clock, or instantaneous message delivery. These constraints create fundamental trade-offs that no engineering effort can eliminate:

- **CAP Theorem:** Under network partition, choose between Consistency (CP: refuse requests) or Availability (AP: serve potentially stale data). CA is not a viable distributed option.
- **PACELC:** Even without partitions, consistency costs latency. There is no free linearizability.
- **Consistency spectrum:** Linearizability → Serializability → Causal Consistency → Read-Your-Writes → Eventual Consistency. Each is progressively weaker, cheaper, and more available.
- **Consensus:** The mechanism by which distributed nodes agree on a single value. FLP proves it's impossible in fully async systems; Raft and Paxos solve it in practical partially-synchronous systems.
- **Raft:** Leader election via majority vote with log-recency check (safety) + randomized timeouts (liveness). Log replication via majority quorum. Committed entries are never lost, even across leader changes.
- **Quorums:** W + R > N guarantees consistency. Majority quorum (⌊N/2⌋ + 1) is the minimum for consensus. Quorum intersection ensures committed writes survive leader changes.
- **2PC:** Achieves distributed atomic commit but is blocking. Requires consensus on the coordinator for HA.
- **Saga:** Eventual atomicity via compensating transactions. Not ACID but tolerant of failures and scalable.

---

## What You Should Now Be Able To Explain

- ✅ Why the real CAP choice is CP vs AP (not "pick two from three")
- ✅ The precise definition of linearizability and how it differs from serializability
- ✅ Raft leader election, log replication, and why committed entries are never lost
- ✅ How quorum intersection guarantees Raft's safety
- ✅ Why distributed locks must use CP systems (etcd, not Redis) and why fencing tokens are still needed
- ✅ Why eventual consistency is not "sometimes wrong" — it's "converges, window is the risk"
- ✅ When to use 2PC vs Saga for distributed transactions

---

## What To Learn Next

**Chapter 9 — Distributed Systems Failure Modes.** You now have the theoretical foundation — CAP, consistency models, consensus. The next chapter applies this theory to real failure modes: partial failures, cascading failures, timeout misconfiguration, thundering herds, and how to build systems that degrade gracefully rather than fail catastrophically. This is where theory meets the 3 AM production incident.
