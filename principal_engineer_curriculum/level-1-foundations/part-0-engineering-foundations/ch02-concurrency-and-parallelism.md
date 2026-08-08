# Chapter 2 — Concurrency & Parallelism

## Difficulty
Advanced

## Importance
**Must Know** — Concurrency is the root of distributed systems complexity. Every coordination mechanism in this curriculum — consensus, replication, distributed transactions, exactly-once delivery — exists because multiple things happen simultaneously. You cannot reason about these problems without a solid model of what concurrency means on a single machine first.

## Prerequisites
Chapter 1 — Computer Systems (processes, threads, memory hierarchy, context switching)

## Learning Objectives

By the end of this chapter you will be able to:

1. Precisely define concurrency vs parallelism — and explain why the distinction matters.
2. Describe what a race condition is at the memory level, not just conceptually.
3. Explain what a mutex, semaphore, and monitor are, how they work internally, and how each can fail.
4. Explain compare-and-swap (CAS) and why it is the foundation of lock-free programming.
5. Describe the three forms of progress failure: deadlock, livelock, starvation — and how to prevent each.
6. Explain the Java Memory Model (JMM) and why `volatile`, `synchronized`, and `happens-before` exist.
7. Describe thread pools, event loops, and the actor model — and when to use each.
8. Explain why all these problems become **substantially harder** when the components are on different machines — the conceptual bridge to distributed systems.

## Why This Matters

Concurrent programming is hard on one machine because:
- Threads can interleave in any order
- Memory writes by one thread are not instantly visible to others
- Hardware and compilers reorder instructions

Distributed programming is harder still, because:
- Processes can interleave in any order **and** messages can be lost, delayed, or duplicated
- There is no shared memory — only message passing
- There is no global clock
- Any node can fail at any moment

Every concept in this chapter has a distributed analogue. Mutexes become distributed locks. Race conditions become write-write conflicts in replicated databases. Deadlocks become distributed deadlocks. Memory visibility becomes replication consistency. The actor model becomes microservices. 

**This chapter is the conceptual bridge from single-machine to distributed.**

---

## Mental Model

> **Concurrency is about dealing with multiple things at once. Parallelism is about doing multiple things at once. A single-core CPU can be concurrent (via time-slicing) but not parallel. Multiple cores give you both. The hard part is not making things run simultaneously — it is making them share state correctly.**

On a single machine, "shared state correctly" is enforced by hardware (memory ordering) and OS primitives (locks). In a distributed system, there is no hardware enforcing anything across machines — which is why distributed systems are fundamentally harder.

---

## Intuition

Imagine two bank tellers (threads) sharing one cash drawer (shared memory).

**Without coordination:**
```
Teller 1 reads balance: $1,000
Teller 2 reads balance: $1,000
Teller 1 withdraws $500, writes $500
Teller 2 withdraws $500, writes $500
Final balance: $500 (should be $0 — one withdrawal was lost)
```

This is a **race condition**. The fix is a lock on the drawer — only one teller can open it at a time.

**With a lock (mutex):**
```
Teller 1 acquires lock, reads $1,000, withdraws $500, writes $500, releases lock
Teller 2 acquires lock, reads $500, withdraws $500, writes $0, releases lock
Final balance: $0 ✓
```

Now imagine the bank has two drawers (distributed system) and the tellers are in different buildings (different machines). There's no shared lock. They can only communicate by message. The problem is now immensely harder — messages can be lost, delayed, or arrive out of order. That is exactly what distributed consensus, distributed transactions, and Saga patterns exist to solve.

---

## Visual Explanation

### Concurrency vs Parallelism

```
CONCURRENCY (1 CPU core, 2 threads — time-sliced)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Timeline:  ──[T1]──[T2]──[T1]──[T2]──[T1]──[T2]──▶
           Threads interleave but never truly simultaneous

PARALLELISM (2 CPU cores, 2 threads — simultaneous)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Core 0:    ──────────[T1]──────────────────────────▶
Core 1:    ──────────[T2]──────────────────────────▶
           Both run at the exact same instant
```

Both create the need for synchronization. Parallelism makes certain bugs — like race conditions — much more likely and harder to reproduce.

### The Race Condition at the Memory Level

```
Shared variable: counter = 0
Two threads both execute: counter++

What counter++ actually compiles to (3 instructions):
  LOAD  counter → register
  ADD   register, 1
  STORE register → counter

Interleaving that causes the bug:
────────────────────────────────────────────────────────
Thread 1              Thread 2              counter
────────────────────────────────────────────────────────
LOAD counter → 0                            0
                    LOAD counter → 0        0
ADD 0 + 1 = 1                               0
STORE 1 → counter                           1
                    ADD 0 + 1 = 1           1
                    STORE 1 → counter       1  ← WRONG!
────────────────────────────────────────────────────────
Expected: 2. Actual: 1. One increment was lost.
```

This is not a language bug. It is a physical consequence of the fact that increment is not atomic — it requires three distinct operations that another thread can interleave between.

---

## Core Concepts

### 1. Concurrency vs Parallelism

| Property | Concurrency | Parallelism |
|----------|------------|-------------|
| Definition | Multiple tasks are in-progress simultaneously (may alternate) | Multiple tasks execute at the exact same instant |
| Requires | A scheduler (OS time-slicing) | Multiple CPU cores |
| Example | Single-core event loop handling 1,000 connections | Multi-core web server with one thread per core |
| Benefit | Responsiveness, utilization during I/O waits | Speed-up via simultaneous compute |
| Risk | Race conditions, deadlocks | Race conditions, cache coherence overhead |

**The critical insight:** Concurrency is a *design property* — you structure your program to handle multiple things. Parallelism is a *runtime property* — the hardware executes things simultaneously. You can have concurrency without parallelism (single-core, time-sliced). You cannot have meaningful parallelism without concurrency.

---

### 2. Threads — A Refresher with Deeper Detail

From Chapter 1: a thread is a unit of execution sharing memory with siblings.

**What the CPU sees:** a thread is just a set of registers plus a stack pointer. Switching between threads means saving those registers and loading another set.

**What the OS sees:** a thread is a schedulable entity with a kernel stack (for syscall handling) and a user-space stack (for regular code).

**What the program sees:** a path of sequential execution that can interleave with other threads at any instruction boundary.

**Thread creation cost (Linux):**
```
pthread_create overhead ≈ 5–10 µs
→ kernel clone() syscall
→ stack virtual memory allocation (1–8 MB VA reserved)
→ TLS (thread-local storage) initialization
→ scheduler registration
```

For high-frequency thread creation (e.g., thread-per-request at 10K RPS), this overhead (5–10 µs × 10K = 50–100 ms/sec of pure thread-creation work) is unacceptable. **Thread pools solve this by reusing threads.**

---

### 3. Locks — Mutexes

A **mutex** (mutual exclusion lock) ensures only one thread can hold it at a time.

#### How a Mutex Works Internally

```
struct mutex {
    atomic_int state;  // 0 = unlocked, 1 = locked, 2 = locked+waiters
    wait_queue waiters;
};

lock():
  CAS(state, 0 → 1)   // fast path: uncontended
  if CAS fails:
    spin briefly (hope holder releases quickly)
    if still locked:
      futex(WAIT)      // suspend thread in kernel — expensive

unlock():
  CAS(state, 1 → 0)   // fast path: no waiters
  if waiters:
    futex(WAKE)        // wake one waiter — kernel call
```

**Key insight:** The fast path (uncontended lock) is handled entirely in user space with a single CAS instruction — roughly 10–30 ns. Only on contention does the thread descend into the kernel via `futex()` — adding ~1–5 µs. This is why highly contended locks are expensive: every thread must call into the kernel to sleep and be woken.

#### Java's `synchronized` / `ReentrantLock`

Java's `synchronized` block goes through several states (from Chapter 1 reference: java/03):
1. **Biased locking** (removed in JDK 15+): assumes single-threaded use
2. **Thin/lightweight lock:** CAS on object header mark word — fast, uncontended
3. **Inflated/heavyweight:** ObjectMonitor backed by OS futex — slow, contended

`ReentrantLock` gives you:
- Trylock with timeout (`tryLock(timeout)`)
- Interruptible lock acquisition
- Fairness option (FIFO queue — prevents starvation but reduces throughput)
- Condition variables (`Condition` interface) for fine-grained wait/notify

#### Lock Granularity

**Coarse-grained locking:** one lock protects everything. Simple, but limits parallelism.

```java
// Coarse: lock the whole map
synchronized(this) {
    map.get(key);
    map.put(key, value);
}
```

**Fine-grained locking:** multiple locks protect different portions. Higher parallelism, higher complexity, higher risk of deadlock.

```java
// Fine: ConcurrentHashMap uses per-bucket locking (16 segments historically, per-node now)
// Multiple threads can read/write different buckets simultaneously
```

**Lock striping:** `ConcurrentHashMap`'s approach — divide the data structure into N segments, each with its own lock. Parallelism scales with N up to N threads. Used in database buffer pools, message broker partition tables.

---

### 4. Semaphores

A **semaphore** is a generalization of a mutex: a counter that blocks when it reaches zero.

```
Counting semaphore with initial value N:
  acquire():  decrement counter; if < 0, block thread
  release():  increment counter; if waiters exist, wake one

Binary semaphore (N=1): equivalent to a mutex
Counting semaphore (N>1): allows N concurrent holders
```

**Use cases:**
- **Connection pooling:** semaphore initialized to pool size — threads block when pool is exhausted
- **Rate limiting (local):** allow at most N requests simultaneously
- **Producer-consumer:** a full/empty pair of semaphores coordinates buffer access

```
Producer-consumer with semaphores:
  empty = Semaphore(N)    // N empty slots available
  full  = Semaphore(0)    // 0 full slots initially

  producer:               consumer:
    empty.acquire()         full.acquire()
    put item in buffer      take item from buffer
    full.release()          empty.release()
```

**Semaphore vs Mutex:** A mutex has *ownership* — only the thread that locked it can unlock it. A semaphore has no ownership — any thread can `release()`. This makes semaphores useful for signaling between threads (producer signals consumer) and mutexes for protecting critical sections.

---

### 5. Atomic Operations & Compare-and-Swap (CAS)

**Atomic operations** are operations guaranteed to complete without interruption — no thread can observe a partial state.

Modern CPUs provide hardware-atomic operations:
- `LOCK ADD` — atomic increment (x86)
- `CMPXCHG` — compare-and-exchange (the basis of CAS)
- `XCHG` — atomic swap

**Compare-and-Swap (CAS):**
```
CAS(address, expected, new_value):
  atomically:
    if *address == expected:
      *address = new_value
      return SUCCESS
    else:
      return FAILURE (current value returned)
```

CAS is the foundation of all lock-free data structures and non-blocking synchronization.

**CAS-based counter (lock-free increment):**
```java
AtomicInteger counter = new AtomicInteger(0);

// increment: no lock, no syscall
int expected, updated;
do {
    expected = counter.get();
    updated  = expected + 1;
} while (!counter.compareAndSet(expected, updated));
// Retry if another thread changed counter between get() and CAS
```

**Cost:** A successful CAS on an uncontended value costs ~10–20 ns (a cache line write + memory barrier). Under high contention, the retry loop spins — CPU cycles wasted. For high-contention counters, use `LongAdder` (Java) which stripes across multiple cells, reducing contention.

#### The ABA Problem

CAS checks if the value equals `expected`. But what if the value was changed from A→B→A by another thread between our `get()` and `CAS()`? Our CAS succeeds (value is still A) but the intermediate B change is invisible.

```
Thread 1 reads counter = A, prepares CAS(A → C)
Thread 2: changes A → B → A
Thread 1: CAS(A → C) succeeds — but the A is "different" logically

In a stack (pointer): if A is a freed node and a new node was
allocated at the same address, CAS incorrectly relinks the freed node.
```

**Fix:** Stamp the pointer. `AtomicStampedReference` in Java pairs the value with a version counter. CAS must match both value and stamp. The ABA problem appears in distributed systems too: an entity at the same logical address after being destroyed and recreated requires fencing tokens (distributed equivalent of stamps).

---

### 6. Memory Visibility & Ordering

This is the hardest and most important concept in single-machine concurrency — and the direct precursor to distributed consistency.

#### Why Memory Visibility is a Problem

Modern CPUs do not write to RAM immediately. They:
1. Write to a **store buffer** (CPU-local, not yet visible to other cores)
2. Flush the store buffer to L1 cache asynchronously
3. Cache coherence protocol (MESI) propagates writes to other cores' caches — eventually

Between write and propagation: **another core can read a stale value.**

```
Thread 1 (Core 0)        Thread 2 (Core 1)
─────────────────        ─────────────────
flag = true              while (!flag) spin;
                         // sees flag = false still???
```

Without memory ordering guarantees, Thread 2 may never see `flag = true` — or see it much later than expected — because the write sits in Core 0's store buffer.

#### Hardware Memory Models

Different CPU architectures provide different guarantees:

| Architecture | Memory Model | Notes |
|-------------|-------------|-------|
| x86/x86-64 | TSO (Total Store Order) | Stores buffered; loads not reordered past loads; relatively strong |
| ARM/PowerPC | Weak | Stores and loads freely reordered; explicit barriers required |
| RISC-V | Weak (default) | Explicit fence instructions required |

x86 is "strong" but not sequentially consistent — stores can still be delayed from other cores' perspective. ARM is much weaker — virtually any reordering is allowed without explicit fences.

**Memory barriers / fences:** CPU instructions that prevent reordering across the barrier point. Types:
- `MFENCE` (x86): full fence — no load or store crosses it
- `SFENCE` (x86): store fence — no store crosses it
- `LFENCE` (x86): load fence — no load crosses it
- `dmb` / `dsb` / `isb` (ARM)

#### The Java Memory Model (JMM)

Java specifies the JMM to provide a language-level abstraction over different CPU architectures. The JMM defines when writes by one thread become **visible** to another.

**The central concept: happens-before (HB)**

> If action A happens-before action B, then B is guaranteed to see A's effects (writes).

Happens-before relationships in Java:
1. **Program order:** within a single thread, action A before action B in source code → A HB B
2. **Monitor (synchronized):** unlock HB all subsequent locks of the same monitor
3. **volatile:** write to a volatile field HB all subsequent reads of that field
4. **Thread start:** `Thread.start()` HB first action in the new thread
5. **Thread join:** last action in thread T HB return from `T.join()`
6. **Transitivity:** if A HB B and B HB C, then A HB C

**Without happens-before, the JVM can:**
- Reorder instructions (compiler optimization)
- Cache values in CPU registers (reading stale data)
- Reorder CPU operations (hardware optimization)

#### `volatile`

Marking a field `volatile` gives two guarantees:
1. **Visibility:** a write to a volatile field is immediately visible to all threads (no store buffer delay)
2. **Ordering:** writes before a volatile write are not reordered after it; reads after a volatile read are not reordered before it

What `volatile` does NOT give: atomicity on compound operations. `volatile long counter; counter++;` is NOT atomic — it's still LOAD-ADD-STORE with races.

```java
// Safe: single assignment visible across threads
volatile boolean shutdown = false;

// Thread A:
shutdown = true;   // visible to Thread B immediately

// Thread B:
while (!shutdown) { doWork(); }   // will eventually see true
```

**Implementation:** The JVM emits memory fence instructions around volatile reads/writes (MFENCE or equivalent). On x86, writes are fenced with SFENCE, reads with LFENCE.

#### `synchronized`

`synchronized` provides both **mutual exclusion** (at most one thread in the block) and **visibility** (the monitor unlock establishes happens-before with the next lock, flushing caches).

```java
class Counter {
    private int value = 0;
    
    public synchronized void increment() {
        value++;    // safe: only one thread at a time, value flushed on unlock
    }
    
    public synchronized int get() {
        return value;  // safe: sees latest value written by any previous increment
    }
}
```

**`synchronized` vs `volatile` vs `Atomic*`:**

| Tool | Mutual Exclusion | Visibility | Compound Ops | Cost |
|------|-----------------|-----------|--------------|------|
| `volatile` | No | Yes | No | Low (~fence) |
| `synchronized` | Yes | Yes | Yes | Medium (CAS + possibly futex) |
| `AtomicInteger` | No | Yes | Limited (CAS loop) | Low–Medium |
| `ReentrantLock` | Yes | Yes | Yes | Medium (more features) |

---

### 7. Race Conditions

A **race condition** occurs when a program's correctness depends on the relative order of concurrent operations, and the order is not controlled.

**Check-then-act race:**
```java
// Non-atomic check + act — classic TOCTOU (time-of-check to time-of-use)
if (!map.containsKey(key)) {       // Thread 1 checks: not present
    // Thread 2 inserts key here!
    map.put(key, computeValue());  // Thread 1 inserts a second time
}
```

Fix: use `map.putIfAbsent()` (atomic) or `synchronized` block.

**Read-modify-write race:** Already shown with `counter++`. The pattern: read, compute new value, write — only safe if atomic.

**Initialization race:**
```java
// Double-checked locking — broken without volatile
Singleton instance;
if (instance == null) {           // Thread 2 sees non-null but incompletely initialized!
    synchronized(this) {
        if (instance == null) {
            instance = new Singleton();  // 3 steps: allocate, init fields, assign pointer
            // compiler may reorder: allocate, assign pointer, init fields
        }
    }
}
```

Fix: `volatile Singleton instance;` — the volatile write ensures fields are initialized before the pointer is published.

**Data races vs race conditions:** A **data race** is a race condition specifically on memory access (concurrent read and write without synchronization). In Java, a data race means the JMM provides no guarantees — the program has undefined behavior for that memory location.

---

### 8. Deadlock

A **deadlock** occurs when two or more threads are each waiting for a resource held by the other — and none can proceed.

**Classic: two threads, two locks**
```
Thread 1:                    Thread 2:
lock(A)                      lock(B)
  ...                          ...
  lock(B)  ← waiting           lock(A)  ← waiting
```
Thread 1 holds A, waits for B. Thread 2 holds B, waits for A. Neither can proceed — deadlock.

**Coffman's four necessary conditions for deadlock:**
1. **Mutual exclusion:** resources are not shareable (a lock can only be held by one thread)
2. **Hold and wait:** a thread holds at least one resource while waiting for another
3. **No preemption:** resources cannot be forcibly taken from a thread
4. **Circular wait:** there exists a circular chain of threads each waiting for the next

**Prevention strategies (eliminate at least one condition):**

| Strategy | Eliminates Condition | Technique |
|---------|---------------------|-----------|
| Lock ordering | Circular wait | Always acquire locks in global order (A before B, never B before A) |
| Lock timeout | No preemption | `tryLock(timeout)` — give up and retry |
| Lock-free design | Mutual exclusion | CAS-based data structures |
| Resource allocation graph | Circular wait | Detect cycle before acquiring (impractical at scale) |

**Deadlock detection:** Thread dumps (`jstack` in Java, `SIGQUIT` on JVM) show threads in BLOCKED/WAITING state with their lock holders — a blocked cycle is a deadlock.

**Distributed deadlock:** When services wait on each other in a cycle, deadlock can occur across processes (each service holds a resource and waits on another). No single thread dump reveals it. Detection requires distributed dependency graphs — this is why aggressive **timeouts** are the practical solution in distributed systems.

---

### 9. Livelock

A **livelock** occurs when threads are active (not blocked) but make no progress — they keep responding to each other without completing their work.

```
Thread 1: I'll wait for Thread 2 to go first.
Thread 2: I'll wait for Thread 1 to go first.
Thread 1: Thread 2 is waiting, so I'll yield again.
Thread 2: Thread 1 is waiting, so I'll yield again.
... (forever)
```

Real example: two processes detecting a conflict and backing off simultaneously, then retrying simultaneously, then backing off simultaneously.

**Fix:** Randomized exponential backoff — each party waits a random amount before retrying, breaking the symmetry.

**Distributed analogue:** Two-phase locking with retry where all transactions retry simultaneously after a conflict — causing a permanent retry storm. Fix: randomized backoff + timeouts (in databases: deadlock detection, in distributed systems: leader election with randomized timeout like Raft's election timeout).

---

### 10. Starvation

**Starvation** occurs when a thread (or process) is perpetually denied a resource it needs to proceed, because other threads keep getting priority.

```
Fair scheduler:     A gets turn, B gets turn, C gets turn, A, B, C...
Unfair scenario:    A gets turn, A gets turn, A gets turn... B and C starve
```

**Causes:**
- Lock implementations that don't guarantee FIFO order — a thread might be repeatedly passed over
- Priority inversion: a low-priority thread holds a lock needed by a high-priority thread. The high-priority thread waits. Medium-priority threads run (they don't need the lock). Low-priority thread never gets CPU to release the lock.
- Work queues where new work always beats old work

**Fix:** Fair locks (`new ReentrantLock(true)` in Java — FIFO waiting queue), priority inheritance (OS-level: boost low-priority lock holder to high priority temporarily).

**Priority inversion incident:** NASA Mars Pathfinder (1997) experienced system resets caused by priority inversion: a high-priority task was starved while waiting for a mutex held by a low-priority task that couldn't run because medium-priority tasks preempted it. Fixed with priority inheritance in VxWorks.

---

### 11. Thread Pools

Creating a thread per task is expensive (5–10 µs per creation). A **thread pool** pre-creates N threads and reuses them for tasks submitted to a queue.

```
┌─────────────────────────────────────────────────────┐
│                  Thread Pool                        │
│                                                     │
│   Task Queue              Worker Threads            │
│   ┌────────┐              ┌──────┐ ┌──────┐         │
│   │ task1  │──────────────│ T1   │ │ T2   │         │
│   │ task2  │              │      │ │      │         │
│   │ task3  │──────────────│  (idle)    │         │
│   │ ...    │              └──────┘ └──────┘         │
│   └────────┘              ┌──────┐ ┌──────┐         │
│                           │ T3   │ │ T4   │         │
│                           └──────┘ └──────┘         │
└─────────────────────────────────────────────────────┘
```

**`ThreadPoolExecutor` configuration (Java):**

```java
new ThreadPoolExecutor(
    corePoolSize,        // min threads always kept alive
    maximumPoolSize,     // max threads under load
    keepAliveTime,       // idle time before extra threads die
    timeUnit,
    workQueue,           // bounded or unbounded
    rejectionHandler     // what to do when queue is full + max threads reached
);
```

**Rejection policies:**
- `AbortPolicy`: throw `RejectedExecutionException` (default)
- `CallerRunsPolicy`: run the task in the calling thread (natural backpressure)
- `DiscardPolicy`: silently drop
- `DiscardOldestPolicy`: discard oldest task in queue

**Work queue choices:**
- `LinkedBlockingQueue` (unbounded): never rejects, but OOM under sustained overload
- `ArrayBlockingQueue(N)` (bounded): enables rejection policies, provides backpressure
- `SynchronousQueue`: no queuing — a thread must be available immediately

**Sizing:**
- **CPU-bound:** `poolSize ≈ numCPUCores` (one thread per core, minimize context switches)
- **I/O-bound:** `poolSize ≈ numCPUCores × (1 + waitTime/computeTime)`
  - Example: 8 cores, requests spend 90% time waiting on DB → pool ≈ 8 × 10 = 80 threads
- **With virtual threads (Java 21+):** `Executors.newVirtualThreadPerTaskExecutor()` — forget pool sizing, one virtual thread per task

---

### 12. Event Loops

An **event loop** is a single thread that repeatedly polls for events and dispatches them to handlers.

```
while (running) {
    events = selector.select();    // block until any fd is ready
    for (event in events) {
        handler = handlerMap[event.fd];
        handler.handle(event);     // must not block!
    }
}
```

**Single-threaded event loop (Node.js, Redis):**
- One thread processes all requests
- I/O is non-blocking — `read()` returns immediately (or registers interest)
- Between I/O calls, the CPU processes ready events
- The event loop can handle tens of thousands of connections on one thread
- **Fatal constraint:** any blocking call (synchronous DB query, `Thread.sleep`, CPU-heavy loop) blocks ALL connections

**Multi-threaded event loop (Netty, Nginx):**
- One event loop thread per CPU core (`numCores` loops)
- Connections are pinned to a loop (no cross-loop sharing needed)
- Each loop operates independently — no locks between loops
- CPU-intensive work is offloaded to a separate thread pool

```
Netty architecture:
Boss Group (1 thread) → accepts connections
Worker Group (N threads) → each an event loop handling its connections

Connection A ──pinned──▶ Worker Loop 1
Connection B ──pinned──▶ Worker Loop 2
Connection C ──pinned──▶ Worker Loop 1
```

**Reactor pattern:** The canonical pattern underlying event loops — components register interest in events; when events fire, the reactor dispatches to the registered handler.

---

### 13. Async Programming & Promises/Futures

Async programming lets you express non-blocking I/O as sequential-looking code without threads for each operation.

**Callback hell (old-style async):**
```javascript
readFile(path, function(err, data) {
    parseJSON(data, function(err, obj) {
        saveToDB(obj, function(err, result) {
            sendResponse(result, function(err) {
                // pyramid of doom
            });
        });
    });
});
```

**Promises / CompletableFuture (Java):**
```java
CompletableFuture
    .supplyAsync(() -> readFile(path))
    .thenApply(data -> parseJSON(data))
    .thenCompose(obj -> saveToDB(obj))   // flatMap for async
    .thenAccept(result -> sendResponse(result))
    .exceptionally(err -> handleError(err));
```

**async/await (Kotlin coroutines, JavaScript, Python asyncio):**
```kotlin
suspend fun processRequest(): Response {
    val data   = readFile(path)         // suspends (not blocks) if not ready
    val obj    = parseJSON(data)
    val result = saveToDB(obj)          // suspends while DB query runs
    return sendResponse(result)
}
```

The `suspend` keyword marks a function that can be suspended — the coroutine runtime parks it (freeing the carrier thread) when it's waiting, and resumes it when the result is ready. The code looks sequential but is non-blocking underneath.

**Key difference between coroutines and threads:**
- OS thread blocked on I/O: the kernel thread is descheduled, a kernel object is held, ~1 MB of stack is pinned
- Coroutine blocked on I/O: only a ~KB heap object (the continuation) is held, the carrier thread is free to run other coroutines

---

### 14. The Actor Model

The **actor model** structures concurrent programs as a collection of **actors**, where:
- Each actor has a **mailbox** (a queue of messages)
- Each actor processes one message at a time (no concurrent access to its own state)
- Actors communicate **only by sending messages** (no shared state)
- An actor can: send messages to other actors, create new actors, change its own state

```
Actor A ──message──▶ Mailbox of B ──▶ Actor B processes sequentially
Actor C ──message──▶ Mailbox of B         (no locks needed for B's state)
```

**Why no locks:** Because each actor processes one message at a time, its internal state is never accessed concurrently. Synchronization is replaced by message sequencing.

**Frameworks:** Akka (Scala/Java), Erlang/OTP, Microsoft Orleans, Pekko.

**Akka actor example:**
```scala
class Counter extends Actor {
    var count = 0
    def receive = {
        case Increment => count += 1
        case Get       => sender() ! count
    }
}
// No synchronized needed — single-threaded per actor
```

**Scaling:** actors are cheap (thousands per JVM). The runtime (Akka) schedules actor executions onto a thread pool. Actors naturally support supervision hierarchies for fault tolerance.

**The connection to microservices:** Each microservice is, conceptually, an actor:
- It processes requests from its mailbox (HTTP/Kafka queue)
- It has private state (its own database)
- It communicates only by messages (HTTP, events)
- No shared memory between services

The actor model's problems in the large — message ordering, exactly-once delivery, actor failure — are exactly the problems of distributed systems. The solutions (supervision hierarchies, dead-letter queues, idempotency) are the same.

---

### 15. Why It Gets Harder on Different Machines

This section is the conceptual bridge.

On a single machine, when two threads need to coordinate:
- They share memory → you can use locks, atomic variables, shared queues
- A lock acquisition takes ~10–500 ns
- A thread can observe another's memory (with proper synchronization)
- The OS can enforce ordering via memory barriers

**Across machines:**
- **No shared memory.** Every coordination must be done by sending messages over the network.
- **Messages can be lost.** The network is unreliable. A message you sent may never arrive.
- **Messages can be delayed.** A message you sent may arrive 5 seconds later, after the system state has changed.
- **Messages can be duplicated.** Networks can retransmit. You may process the same message twice.
- **No global clock.** Machines have independent clocks that drift. You cannot tell whose event happened first.
- **Processes fail independently.** A machine may crash mid-operation, leaving state partially modified.

| Single-machine | Distributed |
|----------------|-------------|
| Mutex | Distributed lock (with fencing tokens) |
| Atomic CAS | Distributed CAS (via consensus — e.g., etcd transactions) |
| Race condition | Write-write conflict in replicated data |
| Deadlock | Distributed deadlock (timeouts are the only practical solution) |
| Memory visibility | Replication consistency |
| Happens-before (JMM) | Causality tracking (Lamport clocks, vector clocks) |
| Thread pool exhaustion | Service overload / backpressure |
| Actor model | Microservices |
| Supervisor tree | Service dependency graph + health checks + circuit breakers |

**The hardest difference:** On a single machine, you can always distinguish "the lock holder crashed" from "the lock holder is slow" by checking its memory. On a network, you cannot. You can only wait and eventually timeout — but you don't know whether the remote process crashed or is just slow. This uncertainty is the root of the **Two Generals Problem** and drives the design of consensus algorithms like Raft and Paxos.

---

## Step-by-Step Execution

### What happens when two threads both try to `synchronized(this) { counter++; }` simultaneously?

```
Thread 1 (Core 0):                     Thread 2 (Core 1):

monitorenter (this)                    monitorenter (this)
  ↓                                      ↓
CAS on object header mark word         CAS on object header mark word
  → Thread 1 wins (CAS succeeds)         → Thread 2 fails (CAS returns locked state)
  → mark word stores Thread 1's id       → spin briefly (adaptive spinning)
  ↓                                      ↓
Executes counter++:                    Spinning...
  LOAD counter → register
  ADD register + 1                     Spin budget exhausted:
  STORE register → counter               → inflate lock to heavyweight ObjectMonitor
  ↓                                      → futex(WAIT) — enter kernel, thread parked
  ↓
monitorexit (this)
  → CAS: mark word → unlocked
  → check for waiters: Thread 2!
  → futex(WAKE) — enter kernel, wake Thread 2
  ↓
Thread 2 wakes:
  → enters kernel-mode monitor wait list
  → acquires lock
  → executes counter++
  → releases lock
```

**Hidden cost:** If this critical section is hot (many threads, high frequency), the futex enter/exit (kernel transitions) happen constantly — each ~1–5 µs. A mutex that looks "instant" in single-threaded benchmarks can become the dominant cost under contention.

---

## Deep Dive

### The Java Memory Model: A Formal Look

The JMM is defined in terms of **actions** (read, write, lock, unlock, thread start, thread join) and a **happens-before** (HB) partial order over those actions.

**Sequential consistency** would require all threads to see all writes in a single global order. But providing sequential consistency is expensive — it requires memory barriers on every read and write. The JMM provides a **weaker** model: you only get ordering guarantees when you use explicit synchronization primitives.

**Data race free (DRF) programs:** If your program has no data races (all accesses to shared variables are properly synchronized), the JMM guarantees sequentially consistent behavior. The JMM is defined to reward correct programs and allow maximum optimization of incorrect ones.

**The `final` field guarantee:** A `final` field written in a constructor is guaranteed to be visible to any thread that sees the object reference — even without synchronization. This is why immutable objects are safe to share without locks: once constructed, their final fields never change, and their initial values are visible to all threads.

```java
// Safe — no synchronization needed for reading 'value'
class ImmutablePoint {
    final int x, y;
    ImmutablePoint(int x, int y) { this.x = x; this.y = y; }
}
```

**Publication and safe initialization:**
```java
// UNSAFE: non-volatile, non-final, no synchronized
Singleton instance;
Singleton getInstance() {
    if (instance == null) instance = new Singleton(); // race
    return instance;
}

// SAFE option 1: synchronized
synchronized Singleton getInstance() {
    if (instance == null) instance = new Singleton();
    return instance;
}

// SAFE option 2: volatile + double-checked locking
volatile Singleton instance;
Singleton getInstance() {
    if (instance == null) {
        synchronized(this) {
            if (instance == null) instance = new Singleton();
        }
    }
    return instance;
}

// SAFE option 3: initialization-on-demand holder (best for singletons)
static class Holder {
    static final Singleton INSTANCE = new Singleton();
}
Singleton getInstance() { return Holder.INSTANCE; }
// Class initialization is thread-safe by JVM spec
```

### False Sharing in Detail (practical impact)

```java
// Bad: counter[0] and counter[1] are in the same cache line
long[] counters = new long[2];
// Thread 0 writes counters[0], Thread 1 writes counters[1]
// Cache line bounces between cores — throughput collapses

// Good option 1: manual padding
// 8 longs × 8 bytes = 64 bytes = one cache line per counter
long[] paddedCounters = new long[2 * 8]; // use [0] and [8]

// Good option 2: @Contended (Java 8+, requires -XX:-RestrictContended)
@jdk.internal.vm.annotation.Contended
class Counter { volatile long value; }

// Good option 3: LongAdder (uses striped cell array internally)
LongAdder counter = new LongAdder();
counter.increment(); // low contention, no false sharing
```

**Benchmark (approximate, 2 threads, 100M increments):**
| Approach | Time |
|----------|------|
| Unpadded `long[]` (false sharing) | ~2,800 ms |
| Padded `long[]` | ~350 ms |
| `LongAdder` | ~280 ms |
| `AtomicLong` (true sharing) | ~1,600 ms |

---

## Real-World Example

### The Thundering Herd on Cache Expiry

A distributed cache holds a heavily-read key (`product_catalog`). TTL expires.

**Without coordination:**
```
1,000 concurrent requests all get a cache miss simultaneously
All 1,000 fire a DB query for the same data
DB receives 1,000 identical queries → overloaded
Each query takes 500ms instead of 5ms → timeout storm
Cache is repopulated 1,000 times with the same data (wasted work)
```

**Root cause:** Classic race condition across threads (or servers): check-then-act without coordination on who gets to rebuild.

**Fixes (single-machine first, distributed later):**
1. **Mutex-per-key (single-machine):** first thread to miss acquires a per-key lock, others wait for the result
2. **Probabilistic early expiration:** before TTL expires, with probability ∝ 1/time_remaining, one thread regenerates early — spreads the load
3. **Staggered TTL:** add random jitter to TTL so all keys don't expire simultaneously
4. **Distributed lock (multi-machine):** Redis `SET key NX EX 10` — only the winner regenerates, others serve stale data for up to 10s

**The distributed equivalent** of the mutex-per-key (option 1) is a distributed lock — but distributed locks have their own failure modes (Chapter 25: Consensus).

---

## Failure Scenarios

### Scenario 1: Deadlock in a Connection Pool

```
Service has two DB connection pools: pool_read (10 conns) and pool_write (10 conns)

Request handler:
  conn_w = pool_write.acquire()   // acquires write connection
  conn_r = pool_read.acquire()    // acquires read connection
  // ... use both, then release

Under load:
  10 threads each acquire conn_w (pool_write exhausted)
  All 10 try to acquire conn_r (pool_read not yet exhausted — but suppose 10 other threads did the same in opposite order)
```

Real scenario: one code path acquires write then read; another path acquires read then write → circular wait → deadlock.

**Diagnosis:** `jstack` shows all threads in `BLOCKED` state waiting for pool connections.

**Fix:** always acquire in consistent order (read pool before write pool), or use a single connection that can do both.

### Scenario 2: Memory Visibility Bug in Production

```java
class WorkerThread extends Thread {
    boolean stopped = false; // NOT volatile

    void run() {
        while (!stopped) {    // JIT may hoist this into a register
            doWork();         // seen as: if (stopped) { while(true) doWork(); }
        }
    }

    void stop() {
        stopped = true;       // Thread B writes, but Thread A's CPU caches old value
    }
}
```

**In production:** worker thread never terminates after `stop()` is called. Server cannot shut down gracefully. Pods in Kubernetes fail to terminate within grace period → SIGKILL → in-flight requests lost.

**Fix:** `volatile boolean stopped = false;` — ensures Thread A sees Thread B's write.

**This is the exact analogue of a distributed consistency bug:** one node writes a value (stop signal) and another node never observes it — because there is no mechanism propagating the write (no `volatile` in distributed: no replication, no publish-subscribe notification).

---

## Performance Considerations

### Amdahl's Law

> If a fraction **p** of your program is parallelizable, the maximum speedup from N cores is: **S = 1 / (1 - p + p/N)**

```
Example: 95% parallelizable (p = 0.95)
  2 cores:  S = 1/(0.05 + 0.475) = 1.90× (90% efficient)
  16 cores: S = 1/(0.05 + 0.059) = 9.1× (57% efficient)
  64 cores: S = 1/(0.05 + 0.015) = 15.4× (24% efficient)
  ∞ cores:  S = 1/0.05 = 20× (maximum possible speedup!)
```

The **serial fraction** is the ultimate bottleneck. If 5% of your code is serial, you can never get more than 20× speedup no matter how many cores you add. Locks and coordination are serial — they are where Amdahl's serial fraction lives.

**Universal Scalability Law (USL):** Extends Amdahl by adding a coherency penalty (N² term) for cache synchronization overhead between cores. Explains why throughput peaks at some core count and then *decreases* as cores are added.

### Lock Contention vs No Contention

```
Uncontended mutex lock: ~10–30 ns (single CAS)
Contended mutex (1 waiter): ~1–5 µs (kernel futex)
Contended mutex (many waiters): ~5–50 µs (wake + rescheduling)

Rule of thumb: if >10% of mutex acquisitions are contended, redesign
```

---

## Trade-offs

| Approach | Pros | Cons |
|----------|------|------|
| Coarse-grained locking | Simple, less deadlock risk | Poor parallelism |
| Fine-grained locking | High parallelism | Complex, deadlock risk |
| Lock-free (CAS) | No blocking, high throughput | Complex, ABA problem, spin waste under high contention |
| Immutability + copy-on-write | No locks at all | Memory overhead, copy cost |
| Actor model | No shared state, natural isolation | Overhead of message passing, mailbox management |
| Thread-per-request | Simple code | Thread count limits concurrency |
| Event loop | High connection density | No blocking allowed in handlers |
| Coroutines/virtual threads | Best of both worlds | Runtime complexity, pinning edge cases |

---

## Alternatives

For different concurrency goals:

| Goal | Recommendation |
|------|---------------|
| Simple shared state, low concurrency | `synchronized` or `ReentrantLock` |
| High-throughput counters | `LongAdder` (striped) |
| Single-writer, multiple-readers | `ReadWriteLock` or `StampedLock` |
| Lock-free queue | `ConcurrentLinkedQueue` |
| Thread-safe map | `ConcurrentHashMap` |
| Task execution | `ExecutorService` / virtual threads |
| High I/O concurrency | Virtual threads (Java 21+) or coroutines |
| Actor-based isolation | Akka, Pekko |

---

## Production Considerations

1. **Thread dumps are your first tool.** `kill -3 <pid>` (JVM) or `jstack <pid>` shows all threads, their state, and what lock they're waiting for. A set of threads all BLOCKED on the same lock indicates contention.
2. **Monitor `vmstat -w 1`.** `r` (run queue) > cores = oversubscription. `b` (blocked in I/O) > 0 = I/O bottleneck.
3. **`jstat -gcutil <pid> 1s` for GC in production.** Watch `FGC` (full GC count) and `FGCT` (full GC time).
4. **Correlated with lock contention:** `perf stat -e lock:* java ...` shows lock acquisition counts.
5. **Set thread pool queue sizes.** Unbounded queues (the default `LinkedBlockingQueue`) mask overload — the queue grows without bound, latency explodes, OOM eventually. Use bounded queues with `CallerRunsPolicy` for natural backpressure.
6. **Name your threads.** `new ThreadFactory() { public Thread newThread(Runnable r) { Thread t = new Thread(r); t.setName("db-pool-" + counter.getAndIncrement()); return t; } }` — named threads appear in thread dumps and metrics.

---

## Common Beginner Mistakes

1. **Not marking shared flags `volatile`.** The JIT may hoist reads into registers, making the flag permanently invisible.
2. **Using `synchronized` on different objects for the same data.** `synchronized(this)` in method A and `synchronized(otherObj)` in method B — no mutual exclusion.
3. **Using `HashMap` in a multithreaded context.** `HashMap` is not thread-safe — concurrent modification can cause infinite loops in Java 7 (rehashing race) and incorrect results always. Use `ConcurrentHashMap`.
4. **Catching `InterruptedException` and swallowing it.** Always either re-throw or re-interrupt the thread: `Thread.currentThread().interrupt()`.
5. **Thread pool with unbounded queue.** Under sustained overload, the queue grows to heap exhaustion and OOM kills the service — no backpressure.

---

## Common Senior Engineer Mistakes

1. **Over-synchronizing: making everything `synchronized`.** Single global lock destroys parallelism. Profile contention before adding locks; remove locks where possible.
2. **Under-synchronizing: assuming an operation is atomic.** `i++`, `map.put()`, `list.add()` are not atomic. Always check whether the class is documented thread-safe.
3. **Using `volatile` for compound operations.** `volatile long counter; counter++;` has a race condition. Use `AtomicLong` or `synchronized`.
4. **Thread pools without timeouts.** A thread pool with tasks that can hang forever (no timeout on DB call) will eventually exhaust — every thread blocked waiting for a DB that will never respond.
5. **Virtual threads + `synchronized` + blocking.** Java virtual threads become pinned to their carrier OS thread when inside a `synchronized` block. With many virtual threads doing blocking I/O inside `synchronized`, you recreate the thread exhaustion problem. Use `ReentrantLock` instead.

---

## Architecture Smells

- A service's throughput is not proportional to core count → serial bottleneck (likely a lock)
- Thread dumps show many threads BLOCKED on the same lock → lock contention, redesign needed
- Service latency spikes during business hours only → concurrency under load (possibly lock contention or thread starvation)
- Thread count in metrics grows over time without bound → thread leak (threads not returned to pool, or task queue growing)
- p999 spikes correlate with GC full collection events → tune GC or reduce allocation rate

---

## Principal Engineer Perspective

Junior engineers see concurrency primitives as tools to prevent "crashes." Senior engineers use them to prevent incorrect results. Principal Engineers reason about concurrency as a **system design constraint** that shapes architecture.

**What junior engineers get wrong:** They add `synchronized` everywhere to be safe, then wonder why throughput doesn't scale. Or they remove synchronization to improve throughput, then wonder why results are occasionally wrong.

**What senior engineers commonly miss:** Memory visibility bugs. They test on a single machine (x86's strong memory model hides many JMM bugs) and don't realize code is broken on ARM (weak memory model). Bugs manifest in production on ARM-based cloud instances or Apple Silicon.

**What Principal Engineers think about:**
- **Contention is the serializing force.** Every lock is a point where parallelism converges to a serial bottleneck. Design data structures and service boundaries to minimize shared state, not to manage it safely.
- **The actor model's lesson:** if you eliminate shared state, you eliminate the need for most synchronization. Microservice architecture does this at the service level. Event sourcing does this at the data level.
- **Distributed systems inherit all of this.** Every race condition, visibility problem, and deadlock you've seen on a single machine reappears at larger scale across services. The distributed solutions (consensus, CRDTs, sagas) are all solving the same underlying problems — with worse failure modes and no hardware to help.
- **The cost of coordination grows faster than the benefit of parallelism** (USL). The art is knowing when more coordination overhead costs more than the parallelism gained.

---

## Architecture Review Questions

1. What shared state exists in this service? For each: what synchronization mechanism protects it? Is that mechanism appropriate for the access pattern?
2. Under peak load, how many threads will be active? How many will be blocked waiting for I/O? Is the thread pool sized to accommodate both?
3. Are there any lock acquisition orderings that could cause deadlock? Is there a global lock ordering policy?
4. Do any tight loops in hot paths make syscalls? Could those be batched?
5. What happens to in-flight requests when this service is deployed? Are there any long-held locks that would block graceful shutdown?
6. Is there any shared mutable state between the event loop threads? If so, how is it synchronized?
7. If a downstream service slows to 10× normal latency, what happens to this service's thread pool? How long until it exhausts?
8. Are there any `volatile` variables whose correctness depends on the x86 memory model? Would this service behave correctly on ARM?
9. What is the contention level on the most-acquired lock? Has it been measured?
10. If this service uses virtual threads, does any hot path hold a `synchronized` lock while doing I/O?

---

## Visual / Animation Specification

### Animation 1: Race Condition

**Frame 1:** Show `counter = 0`. Two threads, side by side. Each about to execute `counter++`.

**Frame 2:** Thread 1: LOAD counter (reads 0). Arrow shows value 0 copied to Thread 1's register.

**Frame 3:** Thread 1: ADD → register = 1. Thread 2: LOAD counter — also reads 0 from memory (Thread 1 hasn't stored yet). Arrow shows 0 to Thread 2's register.

**Frame 4:** Thread 1: STORE 1 → counter. Counter shows 1.

**Frame 5:** Thread 2: ADD → register = 1 (its own copy). STORE 1 → counter. Counter shows 1 — but both threads incremented. Should be 2.

**Frame 6:** Show correct interleaving (Thread 1 completes all 3 steps before Thread 2 starts). Counter reaches 2.

### Animation 2: Deadlock

**Frame 1:** Thread 1 holds Lock A. Thread 2 holds Lock B. Both shown as locked padlocks.

**Frame 2:** Thread 1 requests Lock B. Arrow points from Thread 1 → Lock B (held by Thread 2). Thread 1 shown as "WAITING."

**Frame 3:** Thread 2 requests Lock A. Arrow from Thread 2 → Lock A (held by Thread 1). Thread 2 shown as "WAITING."

**Frame 4:** Circular arrows highlight the wait cycle. Time passes. Neither thread moves. "DEADLOCK" label appears.

**Frame 5:** Resolution — Lock Ordering. Both threads acquire Lock A before Lock B. Thread 1 acquires A then B successfully. Thread 2 waits for A while Thread 1 holds it. Deadlock is impossible.

---

## Hands-On Tutorial

### Observing the Race Condition

```java
public class RaceDemo {
    static int counter = 0; // NOT volatile, NOT atomic

    public static void main(String[] args) throws InterruptedException {
        int NUM_THREADS = 10;
        int INCREMENTS  = 100_000;

        Thread[] threads = new Thread[NUM_THREADS];
        for (int i = 0; i < NUM_THREADS; i++) {
            threads[i] = new Thread(() -> {
                for (int j = 0; j < INCREMENTS; j++) {
                    counter++;           // ← not atomic
                }
            });
        }
        for (Thread t : threads) t.start();
        for (Thread t : threads) t.join();

        System.out.println("Expected: " + (NUM_THREADS * INCREMENTS));
        System.out.println("Actual:   " + counter);
        // Actual is almost always less than expected — lost increments
    }
}
```

**Try fixing it three ways:**
1. `synchronized(RaceDemo.class) { counter++; }` — correct but slow
2. `AtomicInteger counter = new AtomicInteger(); counter.incrementAndGet();` — correct and faster
3. `LongAdder counter = new LongAdder(); counter.increment();` — correct and fastest under high contention

**Benchmark all three at 10 threads × 1M increments.** Observe the throughput difference.

### Reproducing a Deadlock

```java
Object lockA = new Object();
Object lockB = new Object();

Thread t1 = new Thread(() -> {
    synchronized(lockA) {
        System.out.println("T1 holds A, waiting for B");
        try { Thread.sleep(100); } catch (InterruptedException e) {}
        synchronized(lockB) { System.out.println("T1 done"); }
    }
});

Thread t2 = new Thread(() -> {
    synchronized(lockB) {
        System.out.println("T2 holds B, waiting for A");
        synchronized(lockA) { System.out.println("T2 done"); }
    }
});

t1.start(); t2.start();
// Program hangs — take a thread dump to observe the deadlock
// jstack <pid> | grep -A 10 "BLOCKED"
```

---

## Failure Injection Lab

### Lab: Observe Lock Contention Under Load

1. Deploy a service with a global `synchronized` counter incremented per request.
2. Load test with 1, 4, 8, 16, 32 concurrent clients.
3. **Expected:** throughput increases with clients up to ~2×, then plateaus or decreases (Amdahl's serial fraction from the global lock).
4. Capture thread dumps during peak load — see threads piled up in BLOCKED state.
5. **Fix:** replace with `LongAdder`. Re-test. Observe near-linear throughput scaling with client count.
6. **Learning:** a single contended lock is a throughput ceiling that no amount of hardware can overcome.

---

## Exercises

**Conceptual:**

1. What is the difference between a race condition and a data race? Can you have one without the other?
2. Why does `volatile` not make `counter++` thread-safe?
3. Explain why the double-checked locking pattern is broken without `volatile` on the instance field.
4. Thread A writes `x = 1` then `flag = true` (flag is volatile). Thread B reads `flag` then reads `x`. Is Thread B guaranteed to see `x = 1`? Why?
5. How does the actor model eliminate the need for most synchronization? What does it sacrifice?

**Debugging:**

6. A service under load starts timing out. Thread dumps show 200 threads all BLOCKED on the same lock in `UserSession.invalidate()`. What is the likely root cause? How do you fix it?
7. A Java service on ARM (AWS Graviton) shows occasional wrong results that don't appear on x86. What class of bug is likely? What should you look for?

**Architecture:**

8. You are designing a rate limiter for a single-machine service. It must allow at most 1,000 requests/sec. Compare: (a) `synchronized` on a counter, (b) `AtomicLong` with CAS, (c) token bucket with `LongAdder`. Which would you choose for 10K RPS with 100 threads?
9. You are designing a distributed notification service. Multiple threads process events from a Kafka topic and must not send duplicate notifications. What single-machine concurrency mechanism maps to this, and why is the distributed version harder?

**Quantitative:**

10. A service has a single global lock held for 1 ms per request. At 1,000 RPS, what is the maximum throughput this service can achieve? (Hint: at 100% lock saturation, throughput = 1/lock_hold_time.)

---

## Solutions

### Exercise 4
Yes — Thread B is guaranteed to see `x = 1`. The volatile write to `flag` establishes a happens-before with the volatile read of `flag`. By the transitivity of HB, the write to `x = 1` (which HB the volatile write, by program order) also HB Thread B's read of `x`. This is exactly why the publication pattern (set data, then set volatile flag) works correctly.

### Exercise 10
The lock is held for 1 ms per request. This means the lock can be acquired at most 1/0.001 = **1,000 times/sec** — no matter how many threads are trying. Maximum throughput = **1,000 RPS**, regardless of adding more threads. (This is Amdahl's Law: the serial section — the locked region — is the throughput ceiling.)

---

## Interview Questions

### Beginner
- What is a race condition? Give an example.
- What is a deadlock? What conditions are necessary?
- What is the difference between a mutex and a semaphore?

### Senior
- Explain the Java Memory Model and what `volatile` provides.
- What is compare-and-swap? How is it used to build a lock-free counter?
- A thread pool of 100 threads is all BLOCKED. What are the possible causes? How do you diagnose?
- What is false sharing and how do you fix it?

### Staff
- Explain Amdahl's Law and its implications for multi-threaded service throughput.
- How does the JVM's double-checked locking pattern work with `volatile`? Why was it broken before Java 5?
- Your service uses `ConcurrentHashMap` everywhere. Under what conditions is this still not thread-safe?
- Explain priority inversion. How does priority inheritance fix it?

### Principal
- Design a thread-safe, high-throughput counter for a metrics system processing 10M events/sec. Walk through your design choices.
- Your distributed system has a correctness bug that only appears under concurrent writes from multiple services. Draw the analogy to single-machine concurrency and explain which distributed primitive (consensus, CRDT, distributed lock) maps to which single-machine mechanism.
- Explain how the actor model's properties (single-threaded per actor, message passing only) map to microservices. What distributed systems problems arise that don't exist in a single-actor-system?
- A service uses virtual threads (Java 21) for handling HTTP requests. Each request handler acquires a `synchronized` lock to access a shared resource. Under load with 10,000 concurrent requests, what failure mode can occur? How do you fix it?

---

## Summary

Concurrency is the art of managing multiple things that happen simultaneously:

- **Concurrency** (interleaved) vs **parallelism** (simultaneous) — both require synchronization
- **Race conditions** occur when correctness depends on operation ordering without enforcing that order — root cause is non-atomic operations on shared state
- **Mutexes** provide mutual exclusion; their cost scales from ~10 ns (uncontended CAS) to ~5 µs (contended futex)
- **CAS** is the hardware primitive underlying all lock-free algorithms; its failure mode is the ABA problem
- **Memory visibility** is a real problem: writes don't instantly propagate; the JMM's happens-before relation is the formal guarantee
- **`volatile`** provides visibility + ordering but not atomicity; `synchronized` provides all three
- **Deadlock** requires four conditions — eliminating any one prevents it; timeouts are the practical solution
- **Thread pools** amortize thread creation cost; size them for the work type (CPU-bound vs I/O-bound)
- **Event loops** achieve high connection density with one thread; the price is no blocking allowed
- **The actor model** eliminates shared state by making communication explicit; this is the conceptual foundation of microservices

**The bridge:** Every single-machine concurrency problem reappears in distributed systems — amplified by the absence of shared memory, unreliable networks, and independent failures. The rest of this curriculum is solving these problems at scale.

---

## What You Should Now Be Able To Explain

- ✅ Why `counter++` is not thread-safe and what makes an operation atomic
- ✅ The three-step mechanism of a mutex and why uncontended is fast, contended is expensive
- ✅ What `volatile` guarantees in Java and what it doesn't
- ✅ Why deadlocks happen and three strategies to prevent them
- ✅ Why a global lock limits throughput regardless of hardware (Amdahl's Law)
- ✅ When to use: mutex vs semaphore vs atomic vs thread pool vs event loop vs actor model
- ✅ Why all of this becomes harder when components are on different machines

---

## What To Learn Next

**Chapter 3 — Network Layers, TCP & UDP.** You now understand what happens inside one machine when multiple things run simultaneously. The next question is: what happens when those machines need to communicate? Networking is the physical medium through which all distributed coordination flows. Understanding TCP — its three-way handshake, flow control, retransmission, and connection lifecycle — is the prerequisite for understanding why service-to-service calls fail in the ways they do, and why network partitions are the hardest class of failure in distributed systems.
