# Chapter 26 — Distributed Transactions: Two-Phase Commit (2PC), Three-Phase Commit (3PC), and XA

## Difficulty
Expert → Principal

## Importance
**Must Know** — While eventually consistent patterns like Sagas dominate modern loosely-coupled microservices, atomic transactions spanning multiple distinct database partitions, financial ledgers, or heterogeneous storage engines remain an absolute requirement in mission-critical systems. Distributed SQL databases (Google Spanner, CockroachDB, YugabyteDB) and enterprise banking systems rely on distributed atomic commitment protocols to guarantee serializability and linearizability. Two-Phase Commit (2PC) is the canonical protocol that guarantees that a transaction across multiple nodes either commits everywhere or aborts everywhere. However, 2PC is notoriously perilous: it is a **synchronous, blocking protocol**. If the transaction coordinator crashes during the critical commit window, participants hold exclusive database row locks indefinitely, exhausting connection pools and causing platform-wide cascading failure. A Principal Engineer must possess exhaustive knowledge of 2PC failure mechanics, understand why Three-Phase Commit (3PC) fails in partitioned networks, navigate the X/Open XA standard, master how modern distributed SQL engines make 2PC non-blocking by layering it over consensus algorithms (Paxos/Raft), and definitively decide when to use 2PC versus Sagas.

## Prerequisites
- Chapter 07 — Storage Engines and Database Internals (Write-Ahead Logging, ACID transactions)
- Chapter 08 — Consistency, Consensus, and CAP (Linearizability, FLP Impossibility)
- Chapter 12 — SQL Databases at Scale (Two-Phase Locking, isolation levels, serializability)
- Chapter 18 — Saga, CQRS, and Event Sourcing (Compensating transactions vs. ACID transactions)
- Chapter 20 — Distributed Transactions and Idempotency (Dual-write problem, fencing tokens)
- Chapter 23 — Advanced Consensus: Raft, Paxos, and Distributed Coordination (Consensus vs. Atomic Commitment)

## Learning Objectives

By the end of this chapter you will be able to:

1. Differentiate mathematically and operationally between the **Consensus Problem** and the **Atomic Commitment Problem**.
2. Deconstruct the **Two-Phase Commit (2PC)** protocol:
   - Prepare Phase vs. Commit/Abort Phase
   - Write-Ahead Logging (WAL) rules for Coordinator and Participants
   - The **Indefinite Blocking Problem** under coordinator crash failure
3. Analyze **Three-Phase Commit (3PC)** and prove why it eliminates blocking under crash-stop assumptions but causes catastrophic split-brain under network partitions.
4. Implement and manage **X/Open XA** transactions using PostgreSQL and MySQL native syntax (`PREPARE TRANSACTION`, `COMMIT PREPARED`).
5. Design modern **Consensus-Backed 2PC** (the Google Spanner / CockroachDB pattern) to make distributed atomic transactions non-blocking and fault-tolerant.
6. Resolve distributed deadlocks using **Wound-Wait** and **Wait-Die** timestamp ordering algorithms.
7. Formulate a definitive decision framework choosing between 2PC, Consensus-Backed 2PC, and Sagas.

---

## Why This Matters

Imagine a core banking system transferring \$10,000,000 from an account in Bank A (running Oracle Database in New York) to Bank B (running PostgreSQL in London).
- The operation requires two writes:
  1. `UPDATE accounts SET balance = balance - 10000000 WHERE id = 'A'` (Bank A)
  2. `UPDATE accounts SET balance = balance + 10000000 WHERE id = 'B'` (Bank B)
- If Bank A commits its update and the transatlantic fiber cable is severed before Bank B commits, **\$10,000,000 has vanished into thin air**.
- If Bank B commits and Bank A rolls back due to a constraint violation, **\$10,000,000 has been illegally created out of nothing**.

Local database ACID transactions cannot help: each database engine has its own local WAL, its own lock manager, and zero knowledge of the other database.

Now consider the naive deployment of Two-Phase Commit (2PC):
- A financial payment gateway deploys 2PC across 4 database shards to process high-value purchases.
- During Black Friday, with 10,000 concurrent transactions holding row locks, the **Transaction Coordinator server suffers a sudden kernel panic** immediately after issuing `PREPARE` commands.
- The 4 database shards have voted `VOTE_COMMIT`. Because the coordinator is dead, **the database shards cannot unilaterally commit and cannot unilaterally abort**.
- They must remain in the `PREPARED` state, **holding exclusive row locks on thousands of customer records**.
- Incoming customer requests attempt to access those locked rows. Threads block. Connection pools exhaust. Within 45 seconds, all 4 database shards run out of connections and crash.
- Even when database nodes are restarted, **the locks are restored from the WAL in the `PREPARED` state**, immediately re-freezing the database until an operator manually inspects the system logs and executes `ROLLBACK PREPARED`.

Understanding how distributed atomic commitment works, where it breaks, and how to engineer around its blocking nature is essential for building mission-critical transactional platforms.

---

## Mental Model

> **Consensus and Atomic Commitment are polar opposites in distributed systems theory: Consensus (Raft/Paxos) is about *agreement among equals where a majority rules and minorities can be ignored*. Atomic Commitment (2PC) is about *universal veto power: every participant must say YES, and a single failure forces complete rollback*. In 2PC, every participant surrenders its autonomy: once a node votes YES in Phase 1, it enters a hostage state where it cannot unilaterally release its locks until the coordinator delivers the final verdict.**

---

## Intuition

Think of distributed transactions like a real-world multi-party contract signing ceremony:

**The Wedding Ceremony Analogy (Two-Phase Commit):**
- **Participants:** Partner 1 and Partner 2.
- **Coordinator:** The Officiant.
- **Phase 1 (Prepare):** The Officiant asks Partner 1: *"Do you take...?"* Partner 1 says *"I do"* (VOTE_COMMIT). The Officiant asks Partner 2: *"Do you take...?"* Partner 2 says *"I do"* (VOTE_COMMIT).
  - *The Catch:* By saying *"I do"*, each partner promises they will not leave the room or marry someone else (they acquire exclusive locks on their marital status).
- **Phase 2 (Commit):** The Officiant declares: *"By the power vested in me, I now pronounce you married"* (GLOBAL_COMMIT). Both are legally wed.
- **The Coordinator Crash Disaster:**
  What if both partners say *"I do"*, and right before the Officiant speaks the final words, the Officiant **collapses unconscious from a heart attack**?
  - Partner 1 cannot say: *"Well, I guess the wedding is off, I'm going to marry someone else."* (Partner 2 might have heard the Officiant whisper *"married"* before fainting).
  - Partner 2 cannot assume they are married.
  - **Both partners are stuck in limbo.** They cannot leave, they cannot marry anyone else, and they cannot undo their vows. They must stand at the altar indefinitely until the Officiant wakes up or an authorized surrogate arrives to check the Officiant's notes.

---

## Visual Explanation

### 1. Two-Phase Commit (2PC) Execution Flow

```
COORDINATOR                          PARTICIPANT 1 (DB 1)             PARTICIPANT 2 (DB 2)
    │                                         │                                │
    │ 1. Write "START_2PC" to WAL             │                                │
    │─── 2. Send "PREPARE" ──────────────────►│                                │
    │─── 2. Send "PREPARE" ───────────────────────────────────────────────────►│
    │                                         │                                │
    │                                         │ [Execute query locally]        │ [Execute query locally]
    │                                         │ [Acquire Row Locks]            │ [Acquire Row Locks]
    │                                         │ [Write UNDO/REDO to WAL]       │ [Write UNDO/REDO to WAL]
    │                                         │ [Write "VOTE_COMMIT" to WAL]   │ [Write "VOTE_COMMIT" to WAL]
    │◄── 3. Reply "VOTE_COMMIT" ──────────────│                                │
    │◄── 3. Reply "VOTE_COMMIT" ───────────────────────────────────────────────│
    │                                         │                                │
    │ 4. All Voted YES:                       │                                │
    │    Write "GLOBAL_COMMIT" to WAL         │                                │
    │─── 5. Send "GLOBAL_COMMIT" ────────────►│                                │
    │─── 5. Send "GLOBAL_COMMIT" ─────────────────────────────────────────────►│
    │                                         │                                │
    │                                         │ [Apply changes permanently]    │ [Apply changes permanently]
    │                                         │ [Release Row Locks]            │ [Release Row Locks]
    │                                         │ [Write "COMMITTED" to WAL]     │ [Write "COMMITTED" to WAL]
    │◄── 6. Send "ACK" ───────────────────────│                                │
    │◄── 6. Send "ACK" ────────────────────────────────────────────────────────│
    │                                         │                                │
    │ 7. Write "END_TRANSACTION" to WAL       │                                │
    ▼                                         ▼                                ▼
[Transaction Complete]                   [Locks Released]                 [Locks Released]
```

### 2. The Fatal Indefinite Blocking State

```
COORDINATOR                          PARTICIPANT 1                    PARTICIPANT 2
    │                                         │                                │
    │─── 1. PREPARE ─────────────────────────►│                                │
    │─── 1. PREPARE ──────────────────────────────────────────────────────────►│
    │                                         │                                │
    │◄── 2. VOTE_COMMIT ──────────────────────│                                │
    │◄── 2. VOTE_COMMIT ───────────────────────────────────────────────────────│
    │                                         │                                │
    │ 3. [COORDINATOR HARDWARE CRASHES!]      │                                │
    X                                         │                                │
                                              │                                │
                                       [STATUS: PREPARED]               [STATUS: PREPARED]
                                       Locks Held: Row 42               Locks Held: Row 99
                                              │                                │
                                              ▼                                ▼
                                       CANNOT COMMIT!                   CANNOT ABORT!
                                  (Did Coordinator abort?)         (Did Coordinator commit?)
                                              │                                │
                                              └───────────────┬────────────────┘
                                                              ▼
                                                   BLOCKED INDEFINITELY!
                                             Connection pools saturate...
                                             System crashes under lock contention.
```

---

## Core Concepts

### 1. Consensus vs. Atomic Commitment

Many engineers confuse Consensus with Atomic Commitment. They solve fundamentally different problems with opposing mathematical constraints:

| Dimension | Distributed Consensus (Raft, Paxos) | Atomic Commitment (2PC, 3PC) |
| :--- | :--- | :--- |
| **Fundamental Question** | *"Which single value or leader should we agree on?"* | *"Can EVERY participant execute this state transition?"* |
| **Quorum Rule** | **Majority ($\lfloor N/2 \rfloor + 1$):** Agreement requires only $>50\%$ of nodes. | **Unanimity ($N$ out of $N$):** Every participant must vote YES. |
| **Fault Tolerance** | Tolerates minority node crashes ($\le \lfloor (N-1)/2 \rfloor$). Remains available. | **Zero crash tolerance in Phase 1.** If 1 participant dies, transaction aborts. |
| **Autonomy** | Nodes can reject or adopt values based on majority terms. | **Loss of autonomy.** A participant in the `PREPARED` state cannot unilaterally act. |
| **Primary Use Case** | Electing leaders, replicating logs, linearizable metadata. | Cross-partition database writes, heterogeneous resource coordination. |

---

### 2. Two-Phase Commit Protocol Specification

#### Phase 1: The Prepare Phase
1. The Transaction Coordinator (TC) writes a `START_2PC` record with a unique `TransactionID` to its local disk Write-Ahead Log (WAL).
2. TC dispatches a `PREPARE` message to all Resource Managers (participants $P_1, P_2, \dots, P_N$).
3. Each participant receives `PREPARE`:
   - It checks whether it can guarantee the transaction can commit: verifies table constraints, checks foreign keys, checks account balance.
   - It acquires **exclusive write locks** (Two-Phase Locking) on all affected rows.
   - It writes all redo logs (new values) and undo logs (old values) to persistent storage via `fsync()`.
   - **If successful:** It writes `VOTE_COMMIT` to its disk WAL and replies `VOTE_COMMIT` to the TC.
     *Critical Contract:* Once a participant votes `VOTE_COMMIT`, it **surrenders the right to abort**. It must guarantee it can commit even if power is cut and restored!
   - **If unsuccessful:** It writes `VOTE_ABORT` to its WAL, releases all locks, and replies `VOTE_ABORT` to the TC.

#### Phase 2: The Commit / Abort Phase
1. **The Decision:**
   - **Case A (Universal Agreement):** If the TC receives `VOTE_COMMIT` from **every single participant**, it writes a `GLOBAL_COMMIT` record to its WAL via `fsync()`.
   - **Case B (Dissent or Timeout):** If any participant votes `VOTE_ABORT`, or if the TC's timeout expires while waiting for votes, the TC writes a `GLOBAL_ABORT` record to its WAL via `fsync()`.
2. **The Broadcast:**
   - The TC broadcasts the decision (`GLOBAL_COMMIT` or `GLOBAL_ABORT`) to all participants.
3. **The Application:**
   - Each participant receives the decision, writes `COMMITTED` or `ABORTED` to its WAL, commits/rollbacks the local transaction, **releases all database locks**, and replies with an `ACK` to the TC.
4. **Cleanup:**
   - Once all `ACK` messages are received, the TC writes an `END_TRANSACTION` record to its WAL. The transaction is closed.

---

### 3. The 2PC Crash Recovery Protocol

What happens when nodes crash and recover? The exact behavior is governed by the Write-Ahead Log on disk.

```
COORDINATOR RECOVERY RULES (On Reboot):
┌────────────────────────────────────────┬────────────────────────────────────────┐
│ Last Log Entry in Coordinator WAL      │ Recovery Action                         │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ No record or only "START_2PC"          │ Broadcast GLOBAL_ABORT to all nodes.   │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ "GLOBAL_COMMIT" (No "END_TRANSACTION") │ Re-broadcast GLOBAL_COMMIT to all.     │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ "GLOBAL_ABORT"  (No "END_TRANSACTION") │ Re-broadcast GLOBAL_ABORT to all.      │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ "END_TRANSACTION"                      │ Clean. Nothing to do.                  │
└────────────────────────────────────────┴────────────────────────────────────────┘

PARTICIPANT RECOVERY RULES (On Reboot):
┌────────────────────────────────────────┬────────────────────────────────────────┐
│ Last Log Entry in Participant WAL      │ Recovery Action                         │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ No record / Unprepared local queries   │ Rollback locally. Release locks.       │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ "VOTE_ABORT"                           │ Rollback locally. Release locks.       │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ "COMMITTED" / "ABORTED"                │ Clean. Local state already finalized.  │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ "VOTE_COMMIT" (The Prepared State)     │ ⚠️ BLOCKED! Must contact Coordinator   │
│                                        │ to discover the global decision.       │
│                                        │ MUST KEEP LOCKS HELD until told!       │
└────────────────────────────────────────┴────────────────────────────────────────┘
```

#### The Fundamental Flaw of 2PC: Why It Is a Blocking Protocol
If a participant recovers and finds its last WAL entry is `VOTE_COMMIT`, but the coordinator is dead or unreachable:
- Can the participant decide to abort? **NO.** The coordinator might have written `GLOBAL_COMMIT` to its disk and sent it to other participants before crashing. Unilateral abort violates Atomicity.
- Can the participant decide to commit? **NO.** Another participant might have voted `VOTE_ABORT`, causing the coordinator to abort. Unilateral commit violates Atomicity.
- **The participant is paralyzed.** It must hold its locks indefinitely until the coordinator recovers. This single characteristic makes naive 2PC unacceptable for high-availability systems with strict SLAs.

---

### 4. Three-Phase Commit (3PC): Skeen's Protocol and Why It Fails

In 1981, Dale Skeen designed **Three-Phase Commit (3PC)** to eliminate the blocking problem of 2PC under node crashes.

#### How 3PC Works:
3PC splits Phase 2 into two sub-phases, creating three sequential barriers:
1. **Phase 1: Can-Commit?** (Coordinator asks: Can you commit? Participants vote YES/NO).
2. **Phase 2: Pre-Commit.** If all vote YES, coordinator sends `PRE_COMMIT`.
   - Participants enter `PreCommit` state: they acknowledge they are ready to commit, but have not applied changes permanently.
3. **Phase 3: Do-Commit.** Once all acknowledge `PRE_COMMIT`, coordinator sends `DO_COMMIT`. Participants commit and release locks.

```
                  ┌────────────────────────────────────────┐
                  │                 START                  │
                  └───────────────────┬────────────────────┘
                                      │ Send CanCommit
                                      ▼
                  ┌────────────────────────────────────────┐
                  │              UNCERTAIN                 │
                  └──────────┬─────────────────┬───────────┘
                             │ All Vote YES    │ Any Vote NO
                             ▼                 ▼
          ┌─────────────────────┐   ┌─────────────────────┐
          │     PRE-COMMIT      │   │       ABORTED       │
          └──────────┬──────────┘   └─────────────────────┘
                     │ All Ack PreCommit
                     ▼
          ┌─────────────────────┐
          │      COMMITTED      │
          └─────────────────────┘
```

#### The Timeout Non-Blocking Property of 3PC:
- If a participant is in `PreCommit` and the coordinator crashes, the participant **can safely time out and commit**. Why? Because entering `PreCommit` guarantees that every participant voted YES in Phase 1! No node could have voted NO.
- If a participant is in `Uncertain` and times out, it **can safely time out and abort**.

#### The Fatal Flaw of 3PC: The Network Partition Failure
Skeen's 3PC proof assumes a **fail-stop model with synchronous networks and ZERO network partitions**.
In the real world, network partitions happen constantly.

```
SCENARIO: Network Partition Splits 3PC Cluster into Partition Left and Partition Right.

[PARTITION LEFT: Coordinator + Node 1]         [PARTITION RIGHT: Node 2 + Node 3]
                   │                                              │
Coordinator receives all CanCommit votes.                         │
Coordinator sends PreCommit to Node 1.                            │
                   │                                              │
                   ▼                                              ▼
[NETWORK PARTITION SEVERS COMMUNICATION BETWEEN LEFT AND RIGHT!]
                   │                                              │
Node 1 enters PRE-COMMIT.                                  Node 2 & 3 never receive PreCommit!
Coordinator sends DoCommit to Node 1.                      Node 2 & 3 time out waiting in Uncertain.
Node 1 COMMITS locally!                                    Node 2 & 3 TIMEOUT AND ABORT!
                   │                                              │
                   ▼                                              ▼
          [DATA COMMITTED]                               [DATA ROLLED BACK]
```

**Result: Catastrophic Split-Brain.**
One side committed; the other side rolled back. Atomicity is destroyed.
Because real-world distributed networks cannot guarantee zero network partitions, **Three-Phase Commit is almost never used in production infrastructure**.

---

### 5. The X/Open XA Standard

The X/Open Distributed Transaction Processing (DTP) model (1991) defines the standardized industry architecture for multi-database 2PC.

```
┌─────────────────────────────────────────────────────────────┐
│                 APPLICATION PROGRAM (AP)                    │
│           Defines transaction boundaries and queries        │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
        1. Start/Commit                 2. SQL Queries
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│  TRANSACTION MANAGER (TM)    │ │   RESOURCE MANAGER (RM)     │
│   (Coordinator, e.g. Atomikos│ │ (Database, e.g. PostgreSQL, │
│    Narayana, Bitronix, JTA)  │ │  MySQL, Oracle, IBM DB2)    │
└──────────────┬───────────────┘ └─────────────┬───────────────┘
               │                               │
               └─────────── 3. XA RPCs ────────┘
                    xa_open, xa_start, xa_end,
                   xa_prepare, xa_commit, xa_rollback
```

#### Native Database XA Execution (PostgreSQL Example)

A developer or transaction manager coordinates two independent PostgreSQL databases:

```sql
-- Step 1: On Database 1 (Node A)
BEGIN;
UPDATE accounts SET balance = balance - 500 WHERE id = 'alice';
PREPARE TRANSACTION 'tx_global_9988_db1';
-- Node A returns successfully! The locks on 'alice' remain held.

-- Step 2: On Database 2 (Node B)
BEGIN;
UPDATE accounts SET balance = balance + 500 WHERE id = 'bob';
PREPARE TRANSACTION 'tx_global_9988_db2';
-- Node B returns successfully! The locks on 'bob' remain held.

-- Step 3: Coordinator decides GLOBAL COMMIT and executes:
-- On Database 1:
COMMIT PREPARED 'tx_global_9988_db1';
-- On Database 2:
COMMIT PREPARED 'tx_global_9988_db2';
```

#### The Production Danger of `PREPARE TRANSACTION`
When PostgreSQL executes `PREPARE TRANSACTION`:
- The transaction state is detached from the client session and written to the `pg_twophase/` directory on disk.
- **The locks persist even if the client disconnects, and even if the database is restarted!**
- If an application coordinator crashes and forgets the transaction ID, the locks will be held **forever**.
- Furthermore, lingering prepared transactions **prevent PostgreSQL vacuum from reclaiming dead tuples**, causing catastrophic table bloat.

To inspect lingering prepared transactions:
```sql
SELECT gid, prepared, owner, database FROM pg_prepared_xacts;

-- Emergency manual intervention:
ROLLBACK PREPARED 'tx_global_9988_db1';
```

---

### 6. Modern Distributed SQL: Consensus-Backed 2PC (Google Spanner & CockroachDB)

How do modern distributed databases (Google Spanner, CockroachDB, YugabyteDB) execute ACID transactions across hundreds of shards without suffering from 2PC indefinite blocking?

**The Master Stroke: Layering 2PC Over Consensus Groups.**

```
               [ DISTRIBUTED TRANSACTION COORDINATOR ]
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                               ▼
       ┌─────────────────────┐         ┌─────────────────────┐
       │     SHARD 1         │         │     SHARD 2         │
       │  (Raft / Paxos)     │         │  (Raft / Paxos)     │
       │                     │         │                     │
       │ ┌─────────────────┐ │         │ ┌─────────────────┐ │
       │ │ Leader Pod A    │ │         │ │ Leader Pod X    │ │
       │ └────────┬────────┘ │         │ └────────┬────────┘ │
       │          │          │         │          │          │
       │     ┌────┴────┐     │         │     ┌────┴────┐     │
       │     ▼         ▼     │         │     ▼         ▼     │
       │ [Fol B]     [Fol C] │         │ [Fol Y]     [Fol Z] │
       └─────────────────────┘         └─────────────────────┘
```

#### The Mechanism:
1. **Participants are Replicated State Machines:**
   Instead of each participant being a single server, each shard is a **replicated Raft or Paxos group** (e.g., 3 or 5 replicas across availability zones).
2. **Replicated Transaction Record:**
   The Coordinator does not store its decision on a single local disk. It writes the transaction state (`PENDING`, `COMMITTED`, `ABORTED`) to a dedicated consensus group.
3. **Solving the Participant Crash:**
   If the leader of Shard 1 crashes after voting `VOTE_COMMIT`, the Raft group on Shard 1 immediately elects a new leader in $< 1\text{ second}$. The new leader reads the replicated Raft log, finds the `PREPARED` entry, and continues the transaction without blocking!
4. **Solving the Coordinator Crash:**
   If the node running the Coordinator role dies, any replacement node can query the replicated Transaction Record consensus group. If the record says `COMMITTED`, the replacement coordinator commands all participants to commit. If the record is missing or `PENDING`, it commands an abort.

**Result: Indefinite blocking is mathematically eliminated.** The transaction only stalls if an entire consensus group loses a quorum of its physical machines.

---

### 7. Distributed Deadlocks: Wound-Wait vs. Wait-Die

When multiple distributed transactions concurrently acquire row locks across different shards, distributed deadlocks are inevitable:
- Transaction 1 holds Lock on Shard A, waiting for Lock on Shard B.
- Transaction 2 holds Lock on Shard B, waiting for Lock on Shard A.

Detecting cycles in a distributed wait-for graph requires expensive background gossiping. Modern distributed SQL engines avoid deadlocks entirely using **Timestamp Ordering Preemption**:

Each transaction is assigned a monotonically increasing physical/logical timestamp $T$ on startup. Older transactions have smaller timestamps (higher priority).

```
TRANSACTION ORDERING:
Older Transaction T_old (Timestamp = 10, Higher Priority)
Younger Transaction T_young (Timestamp = 50, Lower Priority)

ALGORITHM 1: WAIT-DIE (Non-Preemptive)
----------------------------------------------------------------------
- If T_old requests a lock held by T_young:
  T_old is allowed to WAIT. (Old waits for young).
- If T_young requests a lock held by T_old:
  T_young DIES (aborts and restarts with same timestamp).

ALGORITHM 2: WOUND-WAIT (Preemptive - Used by Google Spanner)
----------------------------------------------------------------------
- If T_old requests a lock held by T_young:
  T_old WOUNDS T_young!
  T_young is forced to ABORT immediately and surrender its lock to T_old.
- If T_young requests a lock held by T_old:
  T_young is allowed to WAIT.
```

**Why Spanner prefers Wound-Wait:**
In Wound-Wait, older transactions slice through younger transactions like a hot knife through butter. As a transaction gets older, it is wounded less frequently and is guaranteed to complete without being aborted, preventing starvation.

---

## Step-by-Step Execution

### Production Python Implementation of a 2PC Engine with Persistent WAL

Below is a complete, runnable simulation of a Two-Phase Commit system featuring a **Transaction Coordinator**, **Resource Managers**, **Write-Ahead Logging to disk**, and **crash-recovery simulation**.

```python
import os
import json
import time
from typing import List, Dict

class Participant:
    def __init__(self, name: str, wal_dir: str):
        self.name = name
        self.wal_path = os.path.join(wal_dir, f"{self.name}.wal")
        self.state = "IDLE" # IDLE, PREPARED, COMMITTED, ABORTED
        self.locked_resources: Dict[str, str] = {}
        self.data: Dict[str, str] = {}

    def _log(self, record: dict):
        with open(self.wal_path, "a") as f:
            f.write(json.dumps(record) + "\n")
            f.flush()
            os.fsync(f.fileno())

    def prepare(self, tx_id: str, key: str, value: str, force_vote_no: bool = False) -> bool:
        if force_vote_no:
            self._log({"tx_id": tx_id, "action": "VOTE_ABORT"})
            self.state = "ABORTED"
            return False

        # Acquire lock and stage write
        self.locked_resources[key] = value
        self.state = "PREPARED"
        self._log({"tx_id": tx_id, "action": "VOTE_COMMIT", "key": key, "val": value})
        return True

    def commit(self, tx_id: str):
        # Apply staged writes
        for k, v in self.locked_resources.items():
            self.data[k] = v
        self.locked_resources.clear()
        self.state = "COMMITTED"
        self._log({"tx_id": tx_id, "action": "GLOBAL_COMMIT"})

    def abort(self, tx_id: str):
        self.locked_resources.clear()
        self.state = "ABORTED"
        self._log({"tx_id": tx_id, "action": "GLOBAL_ABORT"})


class Coordinator:
    def __init__(self, wal_dir: str, participants: List[Participant]):
        self.wal_path = os.path.join(wal_dir, "coordinator.wal")
        self.participants = participants
        self.state = "IDLE"

    def _log(self, record: dict):
        with open(self.wal_path, "a") as f:
            f.write(json.dumps(record) + "\n")
            f.flush()
            os.fsync(f.fileno())

    def execute_transaction(self, tx_id: str, writes: Dict[Participant, tuple[str, str]], 
                            simulate_coordinator_crash: bool = False) -> bool:
        print(f"\n--- Starting 2PC Transaction: {tx_id} ---")
        self._log({"tx_id": tx_id, "action": "START_2PC"})
        self.state = "PREPARING"

        # PHASE 1: PREPARE
        votes = {}
        for p, (key, val) in writes.items():
            vote = p.prepare(tx_id, key, val)
            votes[p.name] = vote
            print(f"Participant {p.name} voted: {'YES' if vote else 'NO'}")

        # Check votes
        all_yes = all(votes.values())

        if simulate_coordinator_crash:
            print("\n🔥 CRITICAL FAILURE: Coordinator crashed before writing decision to disk!")
            # Coordinator dies! Participants are left in PREPARED state!
            for p in self.participants:
                print(f"[{p.name}] Locked in state: {p.state}. Holds locks: {p.locked_resources}")
            return False

        # PHASE 2: COMMIT / ABORT
        if all_yes:
            self._log({"tx_id": tx_id, "action": "GLOBAL_COMMIT"})
            self.state = "COMMITTED"
            print("Coordinator decided: GLOBAL_COMMIT")
            for p in self.participants:
                p.commit(tx_id)
        else:
            self._log({"tx_id": tx_id, "action": "GLOBAL_ABORT"})
            self.state = "ABORTED"
            print("Coordinator decided: GLOBAL_ABORT")
            for p in self.participants:
                p.abort(tx_id)

        self._log({"tx_id": tx_id, "action": "END_TRANSACTION"})
        print(f"--- Transaction {tx_id} Completed: {self.state} ---")
        return all_yes


# --- EXECUTION WALKTHROUGH ---
if __name__ == "__main__":
    import shutil
    WAL_DIR = "/tmp/2pc_wal_demo"
    if os.path.exists(WAL_DIR):
        shutil.rmtree(WAL_DIR)
    os.makedirs(WAL_DIR)

    db_ny = Participant("DB_NewYork", WAL_DIR)
    db_lon = Participant("DB_London", WAL_DIR)
    coord = Coordinator(WAL_DIR, [db_ny, db_lon])

    # Run 1: Successful Atomic Commit
    coord.execute_transaction("tx_1001", {
        db_ny: ("account_alice", "$90,000"),
        db_lon: ("account_bob", "$10,000")
    })
    print("New York DB State:", db_ny.data)
    print("London DB State:", db_lon.data)

    # Run 2: Simulation of Coordinator Crash Leading to Indefinite Lock Blocking
    coord.execute_transaction("tx_1002", {
        db_ny: ("account_alice", "$80,000"),
        db_lon: ("account_bob", "$20,000")
    }, simulate_coordinator_crash=True)
```

---

## Deep Dive

### The Mathematical Latency Penalty of 2PC

Why is 2PC considered an anti-pattern for internet-facing web microservices?

Let:
- $R$: Average network round-trip time between nodes (e.g., $R = 10\text{ms}$ intra-datacenter, or $R = 80\text{ms}$ cross-region).
- $D$: Time required to flush log buffers to NVMe disk via `fsync()` (typically $D \approx 1\text{ms}$ on modern SSDs, or $D \approx 10\text{ms}$ on EBS block storage).
- $N$: Number of participants.

#### Total Transaction Latency ($T_{\text{tx}}$):
For a 2PC transaction:
1. Coordinator writes `START_2PC` to disk: $1 \times D$
2. Coordinator dispatches `PREPARE` to participants: $1 \times R$
3. All $N$ participants execute query and flush WAL in parallel: $1 \times D$
4. Participants return votes: $1 \times R$
5. Coordinator writes `GLOBAL_COMMIT` to disk: $1 \times D$
6. Coordinator sends `GLOBAL_COMMIT` to participants: $1 \times R$
7. Participants flush commit to disk: $1 \times D$
8. Participants return `ACK`: $1 \times R$

$$T_{\text{tx}} = 4R + 4D$$

If cross-region network latency is $R = 50\text{ms}$ and disk flush is $D = 5\text{ms}$:
$$T_{\text{tx}} = (4 \times 50\text{ms}) + (4 \times 5\text{ms}) = 200\text{ms} + 20\text{ms} = \mathbf{220\text{ms}}$$

#### The Throughput Collapse (Little's Law):
Every row involved in this transaction is locked for **at least 220 milliseconds**.
By Little's Law ($L = \lambda W$), if the system attempts to process 1,000 concurrent updates on related rows:
$$\text{Average Lock Queuing Delay} \approx \text{Concurrency} \times \text{Hold Time} = 1000 \times 0.22\text{s} = \mathbf{220 \text{ seconds!}}$$
The entire database grinds to a complete halt due to **lock queue explosion**. This is why 2PC must never be used across high-latency wide-area networks (WANs) for high-frequency write paths.

---

## Real-World Example

### Google Spanner: TrueTime, Paxos, and 2PC

Google Spanner is arguably the most famous implementation of distributed transactions at global scale.
Many engineers wonder: *"If 2PC is so dangerous, why does Spanner use it?"*

Spanner's breakthrough was recognizing that **2PC is only dangerous when coordinators and participants are single points of failure running over unsynchronized clocks**.

```
[Client]
   │
   ▼
[Transaction Coordinator: Leader of Paxos Group 1]
   │
   ├─────── 2PC Prepare ────────► [Participant: Paxos Group 2 Leader]
   │                                   (Replicates vote across 3 continents)
   │
   └─────── 2PC Prepare ────────► [Participant: Paxos Group 3 Leader]
                                       (Replicates vote across 3 continents)
```

**How Spanner Solves the 2PC Traps:**
1. **Paxos Eliminates the Coordinator Crash Block:**
   Every Paxos leader acts as the coordinator. If that physical machine blows up, Paxos elects a new leader in milliseconds. The new leader inspects the replicated Paxos log, sees the commit decision, and completes Phase 2.
2. **TrueTime Eliminates Read Locks:**
   In traditional 2PC, read transactions must acquire shared read locks (S-Locks), blocking writers.
   Spanner equips its datacenters with **GPS receivers and atomic rubidium clocks** (`TrueTime API`), bounding clock uncertainty to $\epsilon < 7\text{ms}$.
   Because time is globally ordered, **read transactions execute at a historical snapshot timestamp with zero locks and zero 2PC involvement**! Only multi-shard writes incur the 2PC cost.

---

## Failure Scenarios

### Scenario 1: The Orphaned Prepared Transaction Memory Leak

```
Incident: Production PostgreSQL Primary Exhausts Connections and Rejects All Traffic.
Root Cause: An application using Spring Boot / Atomikos JTA crashed mid-2PC.
```

**The Breakdown:**
1. A microservice executes an XA transaction across PostgreSQL and an active MQ broker.
2. The service issues `PREPARE TRANSACTION 'tx_order_8812'` to PostgreSQL.
3. The Kubernetes pod running the microservice suffers an ungraceful OOM kill before it can issue `COMMIT PREPARED`.
4. The database connection terminates. **PostgreSQL detaches the prepared transaction and holds all row locks in the kernel.**
5. Three days pass. The application pod restarted and began processing new orders.
6. **The Cascade:**
   - Because `tx_order_8812` is still technically active in the `pg_prepared_xacts` system catalog, PostgreSQL's **Autovacuum daemon cannot advance the transaction horizon (OldestXID)**.
   - Autovacuum stops cleaning dead tuples on the `orders` table.
   - Table bloat surges from 200 MB to **45 GB**.
   - Queries begin scanning gigabytes of dead rows. Database CPU hits 100%.
   - Connection pool reaches `max_connections = 500`. All services fail with `FATAL: remaining connection slots are reserved`.

**The Diagnostic & Fix:**
```sql
-- Step 1: Detect lingering prepared transactions
SELECT gid, prepared, owner, age(transaction) 
FROM pg_prepared_xacts 
WHERE prepared < NOW() - INTERVAL '1 hour';

-- Step 2: Manually abort the orphaned transaction
ROLLBACK PREPARED 'tx_order_8812';

-- Step 3: Architectural Prevention
-- Add an automated monitoring probe that alerts if any transaction in 
-- pg_prepared_xacts is older than 5 minutes!
```

---

### Scenario 2: Network Partition Split-Brain in a 3PC Implementation

```
Incident: Distributed Inventory Cluster Records Negative Stock (-500 items).
Root Cause: Deploying Three-Phase Commit across AWS Availability Zones.
```

**The Breakdown:**
1. An engineering team implements 3PC across 3 AWS data centers to avoid 2PC blocking.
2. A network partition isolates AZ-1 from AZ-2 and AZ-3.
3. Coordinator in AZ-1 receives votes, sends `PRE_COMMIT` to local Node 1, but packets to AZ-2 and AZ-3 drop.
4. Coordinator and Node 1 enter `PreCommit` state. Coordinator issues `DO_COMMIT`. Node 1 commits the purchase of 500 gaming consoles.
5. In AZ-2 and AZ-3, participants are in the `Uncertain` state. Their timeout timers expire. According to Skeen's 3PC rules, **nodes in the Uncertain state must abort on timeout**.
6. AZ-2 and AZ-3 roll back the reservation and release inventory back into the pool.
7. Another customer in AZ-2 immediately buys those same 500 consoles.
8. **Result: 1,000 consoles sold when only 500 existed.** Severe financial and legal liability.

**The Fix:**
- Remove 3PC immediately.
- Transition to **Sagas with semantic locking** or **Consensus-Backed 2PC (CockroachDB/Spanner)** that mathematically prevents split-brain under network partitions.

---

## Performance Considerations

### Two-Phase Locking (2PL) vs. Serializable Snapshot Isolation (SSI)

In distributed transactions, concurrency control dictates performance:

| Concurrency Model | Read Behavior | Write Behavior | Deadlock Risk | Distributed Overhead |
| :--- | :--- | :--- | :--- | :--- |
| **Two-Phase Locking (2PL)** | Acquires Shared Locks (S-Locks). Blocks writers. | Acquires Exclusive Locks (X-Locks). Blocks readers and writers. | **High.** Requires Wound-Wait or deadlock detection. | Extreme under read-heavy workloads. |
| **Serializable Snapshot Isolation (SSI)** | Lock-free reads from MVCC historical snapshot. | Writes buffer in memory, validate read-write conflict graph on commit. | **Zero.** Never deadlocks. | If contention is high, commit abort rate surges ($>20\%$). |

---

## Trade-offs

| Transaction Pattern | Consistency | Availability | Latency | Complexity | When to Choose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Local DB ACID** | Strong (Strict Serializability) | High (Single node/replica) | Sub-millisecond | Lowest | Monolithic database, single shard. Always prefer when possible. |
| **Classic 2PC (XA)** | Strong | **Poor (Blocks on failure)** | High ($4R + 4D$) | Medium | Legacy enterprise integration, heterogenous DBs (Oracle + DB2). |
| **3PC** | Broken (Split-brain under partition) | High | High ($6R + 6D$) | High | **Never use in real-world asynchronous networks.** |
| **Consensus 2PC (Spanner)**| Strong (External Consistency) | **High (Raft/Paxos auto-recovery)** | Medium-High | Very High | Distributed SQL, multi-region financial ledgers. |
| **Sagas (Orchestrated)**| Eventual (BASE) | **Maximum** | Low (Asynchronous) | Medium-High | Microservices, high-volume e-commerce checkout. |

---

## Production Considerations

1. **Keep 2PC Transactions Microscopic:** Never execute external HTTP API calls, file uploads, or complex business logic inside a 2PC transaction. The transaction hold time must be measured in **single-digit milliseconds**.
2. **Enforce Transaction Timeouts:** Every participant must configure a strict statement timeout:
   `SET statement_timeout = '2000ms';`
   Never allow a distributed query to wait indefinitely for a lock.
3. **Monitor `pg_prepared_xacts` Continuously:** Any prepared transaction older than 60 seconds is a production incident. Page on-call if count $> 0$ for $> 2\text{ minutes}$.
4. **Prefer Sagas for User-Facing Paths:** If your transaction involves microservices owned by different engineering teams, reject 2PC. Sagas decouple release lifecycles and eliminate shared database lock contention.

---

## Common Beginner Mistakes

1. **Assuming Microservices Should Share an XA Transaction:** Attempting to run a distributed XA transaction across Order Service, Payment Service, and Inventory Service. If the payment gateway takes 3 seconds, all database rows in Order and Inventory are locked for 3 seconds. Use a Saga.
2. **Forgetting that `PREPARE` Writes to Persistent Disk:** Thinking that `PREPARE` is just an in-memory check. A participant must `fsync` all undo/redo records to disk before replying YES. 2PC write throughput is strictly bounded by disk I/O latency.
3. **Not Configuring Orphan Sweepers:** Deploying an XA coordinator without a background reconciliation cron that inspects databases for orphaned transactions after coordinator restarts.

---

## Common Senior Engineer Mistakes

1. **Thinking 3PC Solves 2PC's Problems in Cloud Environments:** Proposing Three-Phase Commit to eliminate blocking in Kubernetes or AWS. As mathematically proven, 3PC trades blocking for split-brain under network partitions—the absolute worst outcome for transactional data.
2. **Ignoring Autovacuum Starvation in PostgreSQL XA:** Allowing prepared transactions to linger for days, completely blinding the database's garbage collection mechanism and causing database-wide disk bloat.
3. **Failing to Order Lock Acquisition (Deadlock Trap):** Allowing Transaction 1 to lock Account A then Account B, while Transaction 2 locks Account B then Account A. Always enforce a global lexicographical locking order (e.g., `sort([id_A, id_B])`) across all services.

---

## Architecture Smells

- **Distributed Locks Surrounding a 2PC Transaction:** Wrapping an XA transaction inside an etcd or Redis distributed lock. This adds double latency and introduces multiple failure modes.
- **Cross-Service Database Foreign Keys:** Microservice A has a foreign key referencing a table in Microservice B's database, forcing distributed transactions on every insert.
- **High Abort Rates Under Optimistic Concurrency:** A distributed database where $> 15\%$ of transactions fail with serialization conflicts, indicating hot keys are being updated concurrently without batching or pipelining.

---

## Principal Engineer Perspective

A Principal Engineer understands that the best distributed transaction is the one you never had to execute.

**The Principal Architect's Strategic Rules:**
1. **Domain-Driven Boundary Defense:** If two entities must be updated with strict ACID serializability, they belong in the **same database shard and the same bounded context**. If they belong to different domains, question whether strict consistency is genuinely required by the business or just laziness in product design.
2. **Embrace Business Compensation Over Technical Atomicity:** In the physical world, banks do not use 2PC for money transfers between different institutions. They use asynchronous messaging (SWIFT, ACH, Fedwire) with **reconciliation and compensating adjustments**. If global banking scales on eventual consistency and compensation, your e-commerce checkout can too.
3. **Consensus-Backed 2PC as the Sole Production Choice:** If strict multi-partition ACID is non-negotiable (e.g., in a globally distributed SQL ledger), mandate CockroachDB, TiDB, or Spanner where 2PC is backed by Raft/Paxos. Never write your own custom 2PC coordinator.

---

## Architecture Review Questions

1. Exactly what business invariant requires strict ACID atomicity across these distinct databases rather than eventual consistency via a Saga?
2. What is the maximum duration a participant can hold exclusive row locks during Phase 1?
3. If the Transaction Coordinator crashes after issuing `PREPARE`, what automated mechanism detects and resolves the orphaned locks on participants?
4. What is the measured p99 network latency and disk fsync overhead across all participants in the 2PC path?
5. How does the architecture prevent distributed deadlocks? Is a global lock acquisition order or a Wound-Wait algorithm enforced?
6. Are participant databases configured with strict statement and transaction timeouts to prevent connection pool exhaustion?
7. In the event of a network partition between the coordinator and participants, does the system block (2PC) or fail gracefully?
8. Has the team verified that PostgreSQL/MySQL system catalogs (`pg_prepared_xacts`) are actively monitored by Prometheus alerts?

---

## Visual / Animation Specification

### Animation 1: Two-Phase Commit with Coordinator Failure in Limbo

```
Timeline of Events:
T=0ms: Coordinator dispatches PREPARE to Bank A and Bank B.
T=15ms: Bank A executes query, acquires row lock on "Alice", writes to WAL. Votes YES.
T=20ms: Bank B executes query, acquires row lock on "Bob", writes to WAL. Votes YES.
T=35ms: Coordinator receives both YES votes. Writes GLOBAL_COMMIT to its WAL.

T=36ms: 🔥 POWER OUTAGE! Coordinator crashes instantly!
Packets containing GLOBAL_COMMIT are NEVER sent.

T=50ms to T=10,000ms:
Bank A: State = PREPARED. Row "Alice" locked!
Bank B: State = PREPARED. Row "Bob" locked!
Incoming queries to "Alice" and "Bob" hit lock barriers.
Database connection pool graph: [████████████████████] 100% (500/500 connections).
System status: BLOCKED.

T=30,000ms: Coordinator reboots.
Coordinator reads its WAL on disk: Finds "GLOBAL_COMMIT" without "END_TRANSACTION".
Coordinator re-sends GLOBAL_COMMIT to Bank A and Bank B.
Bank A and Bank B commit and RELEASE LOCKS!
System recovers.
```

### Animation 2: Consensus-Backed 2PC (Non-Blocking)

```
[Coordinator Paxos Group]
Leader Pod 1 crashes! ──► Paxos elects Leader Pod 2 in 400ms!
Leader Pod 2 reads replicated transaction log: "Status = PENDING".
Leader Pod 2 immediately resumes Phase 2!

[Participant Shard 1 (Raft Group)]
Leader Pod A crashes! ──► Raft elects Leader Pod B in 300ms!
Leader Pod B inspects replicated Raft log: "VOTE_COMMIT entry present".
Leader Pod B maintains lock state and awaits Coordinator instructions.

Result: Zero human intervention. Zero connection pool exhaustion. Sub-second self-healing.
```

---

## Exercises

### Conceptual
1. Explain the fundamental theoretical difference between Distributed Consensus (e.g., Raft) and Distributed Atomic Commitment (e.g., 2PC).
2. Why is Two-Phase Commit classified as a "blocking" protocol? Describe the exact state a participant must be in to become blocked.
3. How does Skeen's Three-Phase Commit (3PC) eliminate the blocking problem of 2PC, and why does it fail under network partitions?
4. In PostgreSQL, what happens to row locks held by a transaction when `PREPARE TRANSACTION` is executed and the client connection disconnects?
5. Explain the Wound-Wait distributed deadlock prevention algorithm. How does it guarantee that transactions cannot starve?

### Architecture
6. You are designing a global financial trading platform. A trade updates an investor's cash balance in a PostgreSQL database in New York and their stock holdings in an Oracle database in London. Evaluate whether you should use XA 2PC, a Saga with compensation, or Consensus-Backed 2PC. Detail the failure modes of your chosen approach.
7. Design a background reconciliation and recovery worker for a system using PostgreSQL `PREPARE TRANSACTION`. Detail how it discovers orphaned transactions, verifies whether the coordinator committed, and cleans up `pg_prepared_xacts` safely.
8. Explain how Google Spanner combines Two-Phase Commit with Paxos consensus groups to eliminate the single point of failure in distributed transactions.

### Quantitative
9. A 2PC transaction spans 3 database participants located in different availability zones.
   - Network RTT between coordinator and participants is $12\text{ms}$.
   - Disk `fsync()` write time on SSD is $2\text{ms}$.
   - Calculate the total minimum latency of the transaction.
   - If an account row is updated by 50 concurrent transactions per second using 2PC, calculate the average queuing time per transaction.
10. A PostgreSQL database has `max_connections = 200`. A microservice executes 2PC across 4 shards. A network partition isolates the coordinator after participants execute `PREPARE`. If the application generates 15 new transactions per second touching the locked rows, how many seconds until all database connections are exhausted?

---

## Solutions

### Exercise 9 (Quantitative Solution)
**1. Minimum 2PC Transaction Latency ($T_{\text{tx}}$):**
$$T_{\text{tx}} = 4R + 4D$$
Given $R = 12\text{ms}$ and $D = 2\text{ms}$:
- Network time = $4 \times 12\text{ms} = 48\text{ms}$
- Disk fsync time = $4 \times 2\text{ms} = 8\text{ms}$
$$T_{\text{tx}} = 48\text{ms} + 8\text{ms} = \mathbf{56\text{ms}}.$$

**2. Lock Queuing Delay Calculation:**
- Lock hold duration $W = 56\text{ms} = 0.056\text{s}$.
- Transaction arrival rate $\lambda = 50 \text{ tx/s}$.
- Utilization of the locked row $\rho = \lambda \times W = 50 \times 0.056 = 2.8$.
Since $\rho > 1.0$, the arrival rate exceeds the capacity of the locked row!
Under $M/M/1$ queueing theory, the queue is **unstable and grows infinitely**.
Every second, $50 - (1 / 0.056) = 50 - 17.85 = 32.15 \text{ transactions}$ accumulate in the wait queue.
Within 10 seconds, the wait time exceeds **30 seconds**, exhausting upstream HTTP timeouts.

---

### Exercise 10 (Quantitative Solution)
**Connection Pool Exhaustion Timeline:**
- Total connections available: 200.
- Incoming blocked transactions rate: $15 \text{ requests/sec}$.
- Each incoming query attempts to read or write the locked rows and blocks, holding its client connection open.

$$\text{Time to Exhaustion} = \frac{\text{Total Connections}}{\text{Arrival Rate}} = \frac{200}{15} \approx \mathbf{13.33 \text{ seconds}}.$$
In just **13.3 seconds**, all 200 database connections are completely saturated, taking down the entire database instance for all other unrelated services.

---

## Interview Questions

### Beginner
- What does Two-Phase Commit (2PC) do, and what problem does it solve?
- What are the two phases of 2PC, and what happens in each phase?
- What is the difference between a local database transaction and a distributed transaction?

### Senior
- Why is 2PC considered a blocking protocol? What happens if the coordinator crashes after all participants vote YES?
- Explain the X/Open XA standard. How does PostgreSQL implement XA using `PREPARE TRANSACTION`?
- Compare 2PC with Sagas. When is a Saga preferred over 2PC, and what consistency guarantee does a Saga sacrifice?

### Staff
- Walk me through Skeen's Three-Phase Commit (3PC). How does it avoid blocking under node failure, and why does it fail under network partitions?
- How do modern distributed SQL databases like CockroachDB and Google Spanner implement 2PC without suffering from the coordinator single-point-of-failure?
- Explain the Wound-Wait deadlock prevention algorithm. Why does it produce lower abort rates than Wait-Die under high contention?

### Principal
- You are the Chief Architect of a global fintech firm handling multi-currency cross-border payments. The business demands strict serializable ACID consistency across 5 independent banking entities with distinct relational databases. Evaluate the feasibility of 2PC, detail the systemic risks (lock hold times, network partitions, MTTR), and present an alternative architecture based on Outbox patterns, Sagas with semantic locks, and automated ledger reconciliation.
- Design an automated disaster recovery system for a mission-critical distributed database cluster that suffers a network partition during an XA 2PC commit. How do you resolve orphaned prepared transactions across PostgreSQL shards without human intervention while mathematically guaranteeing zero split-brain?

---

## Summary

- **Atomic Commitment vs. Consensus:** Consensus requires majority agreement ($\lfloor N/2 \rfloor + 1$); atomic commitment requires universal unanimity ($N$ out of $N$). A single failure aborts a 2PC transaction.
- **2PC Protocol Mechanics:** Phase 1 (Prepare, lock acquisition, persistent WAL logging, voting) $\to$ Phase 2 (Global Decision broadcast, local commit/rollback, lock release, ACK).
- **The Indefinite Blocking Hazard:** Once a participant votes `VOTE_COMMIT`, it enters the `PREPARED` state. If the coordinator crashes before delivering the decision, the participant must hold exclusive database locks indefinitely until the coordinator recovers.
- **3PC Partition Failure:** 3PC introduces a `PreCommit` phase to allow non-blocking timeouts under crash-stop assumptions, but causes catastrophic split-brain under real-world network partitions.
- **X/Open XA in Relational Databases:** Implemented via `PREPARE TRANSACTION` and `COMMIT PREPARED`. Lingering prepared transactions prevent vacuum tuple reclamation and exhaust connection pools.
- **Consensus-Backed 2PC:** Google Spanner and CockroachDB eliminate 2PC blocking by replacing single nodes with Paxos/Raft consensus groups and writing transaction records to replicated state machines.
- **Deadlock Management:** Distributed transactions avoid deadlock cycles using timestamp ordering algorithms: Wound-Wait (preemptive, favored by Spanner) and Wait-Die (non-preemptive).

---

## What You Should Now Be Able To Explain

- ✅ The mathematical difference between Consensus and Atomic Commitment
- ✅ The exact sequence of disk `fsync()` writes required by the 2PC WAL protocol
- ✅ Why participants in the `PREPARED` state cannot unilaterally abort or commit on coordinator timeout
- ✅ Why Three-Phase Commit produces split-brain in partitioned cloud networks
- ✅ How to detect and clear orphaned prepared transactions in PostgreSQL using `pg_prepared_xacts`
- ✅ How Spanner and CockroachDB combine 2PC with Paxos/Raft to achieve non-blocking distributed transactions

---

## What To Learn Next

**Chapter 27 — Messaging & Event-Driven Systems: Inside the Broker.** Having deconstructed synchronous distributed transactions, Chapter 27 dives into the heart of asynchronous distributed architecture: messaging systems. We will explore message queue internals (log-based brokers like Apache Kafka vs. index/queue-based brokers like RabbitMQ and Apache Pulsar), zero-copy disk I/O (`sendfile`), OS page cache dominance, partition offset management, consumer group rebalancing algorithms (Eager vs. Cooperative Sticky), message ordering guarantees, and poison-pill / dead-letter queue architectures.
