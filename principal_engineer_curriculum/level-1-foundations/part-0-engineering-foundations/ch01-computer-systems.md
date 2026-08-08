# Chapter 1 — Computer Systems

## Difficulty
Intermediate → Advanced (progresses through the chapter)

## Importance
**Must Know** — Everything in this curriculum rests on understanding what a single machine can and cannot do. Distributed systems are hard precisely *because* of the properties of single machines combined across a network.

## Prerequisites
None — this is the foundation.

## Learning Objectives

By the end of this chapter you will be able to:

1. Trace a CPU instruction from fetch to retire, including the role of caches, registers, and the memory hierarchy.
2. Explain what a process and a thread are at the OS level — not just "a thread is a lightweight process."
3. Explain what a system call is, why it is expensive, and when it is unavoidable.
4. Distinguish kernel space from user space and explain why the boundary matters.
5. Explain blocking I/O vs non-blocking I/O and describe the costs of each.
6. Explain how memory is allocated on the stack vs the heap, and what garbage collection fundamentally does.
7. Reason about CPU scheduling and its consequences for latency-sensitive services.
8. Use the latency cost hierarchy to reason quantitatively about performance.

## Why This Matters

You cannot design distributed systems well if you think of a single machine as a black box. Every distributed systems problem — latency, tail latency, GC pauses, thread exhaustion, I/O saturation, cascading failures — has a physical root in how CPUs, memory, and operating systems actually work.

A Principal Engineer who doesn't know what a context switch costs cannot reason about whether to use threads vs event loops. One who doesn't know what a cache miss costs cannot explain why false sharing destroyed their service's throughput. One who doesn't know how system calls work cannot understand why syscall-heavy code is slow even on idle CPUs.

This chapter is your physical model of the machine. Every abstraction in this curriculum lives on top of it.

---

## Mental Model

> **A computer is a CPU that executes instructions sequentially, fetching them from memory. Memory is slow. Caches make it faster. The OS gives you the illusion of infinite, isolated processes running simultaneously. System calls are the boundary between your program and the OS. I/O is the act of waiting for something outside the CPU.**

Keep this in your head at all times. Every optimization in this curriculum is about:
- Reducing the number of times you touch slow memory
- Reducing the amount of time you spend waiting (I/O)
- Reducing the overhead of crossing the user/kernel boundary

---

## Intuition

Imagine a chef (CPU) working in a kitchen (the computer). The chef has:
- A cutting board in front of them (registers — fast, tiny, expensive)
- A counter within arm's reach (L1/L2 cache — fast, small)
- A pantry a few steps away (L3 cache / RAM — slower, larger)
- A warehouse across town (disk — very slow, large)
- A supplier in another country (network — very slow, external)

The chef can only *work* with ingredients on the cutting board. To get something from the pantry, they must stop working, walk over, and come back. The time they spend walking is wasted productive time.

Now add: the kitchen has one cutting board but many chefs (cores). When a chef needs something from the warehouse, they don't block the kitchen — a helper (OS thread scheduler) puts that chef on break and brings in another to keep the cutting boards busy. This is exactly what the OS does with context switching and I/O scheduling.

---

## Visual Explanation

### The CPU and Memory Hierarchy

```
┌──────────────────────────────────────────────────────────┐
│                    CPU CORE                              │
│                                                          │
│  ┌─────────────┐   ┌─────────────┐   ┌───────────────┐  │
│  │  Registers  │   │  L1 Cache   │   │   L2 Cache    │  │
│  │  ~16 × 8B   │◄──│  32–64 KB   │◄──│  256 KB–1 MB  │  │
│  │   ~0.3 ns   │   │   ~1–4 ns   │   │    ~4–15 ns   │  │
│  └─────────────┘   └─────────────┘   └───────────────┘  │
└────────────────────────────┬─────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   L3 Cache      │
                    │   4–64 MB       │
                    │   ~15–50 ns     │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   Main Memory   │
                    │   (DRAM)        │
                    │   GBs           │
                    │   ~50–100 ns    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   SSD / NVMe    │
                    │   TBs           │
                    │   ~10–100 µs    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   HDD / Disk    │
                    │   TBs           │
                    │   ~5–10 ms      │
                    └─────────────────┘
```

### Latency Cost Table (The Numbers Every Engineer Must Know)

| Operation | Approximate Time | Relative to L1 |
|-----------|-----------------|----------------|
| CPU cycle (3 GHz) | ~0.3 ns | 1× |
| L1 cache hit | ~1 ns | 3× |
| Branch mispredict | ~3 ns | 10× |
| L2 cache hit | ~4 ns | 13× |
| L3 cache hit | ~15 ns | 50× |
| Mutex lock/unlock (uncontended) | ~17 ns | 57× |
| Main memory (RAM) access | ~100 ns | 333× |
| Syscall overhead (round-trip) | ~200–500 ns | 1,000× |
| Context switch (thread) | ~1–5 µs | 5,000× |
| SSD random read (4 KB) | ~16 µs | 50,000× |
| Network round-trip (same DC) | ~0.5 ms | 1,600,000× |
| HDD seek + read | ~5–10 ms | 30,000,000× |
| Network round-trip (cross-region) | ~100–150 ms | 500,000,000× |

> **Principal Insight:** These numbers are the physics of software. They don't change because your framework is clever. A service that makes a database call per request has ~0.5 ms baked in as a minimum latency floor — irreducible by any amount of in-process optimization.

---

## Core Concepts

### 1. The CPU — Fetch, Decode, Execute, Retire

A CPU executes a program by repeating a cycle:

1. **Fetch** — read the next instruction from memory (via the instruction cache)
2. **Decode** — interpret what operation it is (add, load, branch, etc.)
3. **Execute** — carry out the operation using the ALU, FPU, or load/store units
4. **Retire** — commit the result to a register or memory, advance the program counter

Modern CPUs do all four stages on different instructions *simultaneously* (pipeline) and execute multiple instructions per clock cycle (superscalar, out-of-order execution). A 3 GHz CPU with an 8-wide superscalar pipeline can theoretically execute ~24 billion instructions/second. **In practice, the bottleneck is almost always memory latency, not raw compute.**

#### CPU Registers

Registers are the fastest memory in the computer. They live physically on the CPU die. A typical x86-64 CPU has:
- 16 general-purpose 64-bit registers (RAX, RBX, RCX, RDX, RSP, RBP, RSI, RDI, R8–R15)
- 16 XMM/YMM/ZMM registers for SIMD operations
- A program counter (RIP) pointing to the next instruction
- A flags register recording condition codes (zero, carry, overflow)

**Why this matters for system design:** Registers are free — they have zero memory access cost. The compiler tries to keep hot variables in registers. When a function call occurs, registers must be saved to the stack (caller-save vs callee-save convention), which is why excessive function call depth has a cost.

#### The Cache Hierarchy — Why It Exists

DRAM (main memory) operates at ~100 ns latency. A CPU running at 3 GHz can execute ~300 instructions in that time. Without caches, the CPU would spend almost all its time idle, waiting for memory.

Caches solve this by storing recently (and likely soon-to-be) accessed data closer to the CPU. They work because of two properties of almost all programs:

- **Temporal locality:** if you accessed address X, you will likely access it again soon
- **Spatial locality:** if you accessed address X, you will likely access addresses near X soon (e.g., iterating an array)

**Cache lines:** Memory is not transferred byte-by-byte between RAM and cache. It moves in blocks called **cache lines** (typically 64 bytes on x86). When you read one byte from memory, the entire 64-byte cache line containing it is loaded into the cache. This is great for arrays (spatial locality) and terrible for pointer-chasing linked lists (cache lines pulled in but mostly wasted).

**Cache miss types:**
- **Compulsory miss:** first access to data, never been in cache
- **Capacity miss:** working set larger than cache size
- **Conflict miss:** cache associativity limitations cause eviction despite space available

**False sharing:** If two threads on different CPU cores modify different variables that happen to live in the *same* 64-byte cache line, the hardware cache coherence protocol (MESI) causes them to invalidate each other's cache lines on every write. Result: the same cache ping-pong overhead as true sharing, with none of the logical sharing. This can destroy scalability.

```
Thread 1 (Core 0)           Thread 2 (Core 1)
modifies counter_a          modifies counter_b

[ counter_a | counter_b ]   ← same 64-byte cache line!

Core 0 writes → invalidates Core 1's copy
Core 1 must re-fetch the line before writing
Core 1 writes → invalidates Core 0's copy
...repeats thousands of times per second → cache thrashing
```

Fix: pad variables to separate cache lines, or use `@Contended` in Java.

---

### 2. Processes

A **process** is the OS's unit of resource ownership and isolation. When you run a program, the OS creates a process with:

- **Virtual address space** — a private view of memory, typically 0 to 2⁶⁴ (on 64-bit). The OS maps virtual pages to physical RAM pages using a page table. Two processes can have the same virtual address but different physical backing.
- **File descriptor table** — tracks open files, sockets, pipes
- **Signal handlers**
- **At least one thread** (the initial/main thread)
- **Credentials** (UID, GID, capabilities)

**Process isolation** means a bug in one process cannot corrupt another's memory — the MMU (Memory Management Unit) enforces this via page table boundaries. A segfault kills only the offending process.

**Process creation** (`fork()` on Unix) copies the parent's address space copy-on-write (CoW): the physical memory is shared until either process writes to it, at which point the kernel copies the page. This makes `fork()` faster than full copy but still involves kernel overhead.

**Cost:** Creating a process is expensive (~1 ms on Linux). IPC (inter-process communication) requires deliberate mechanisms: pipes, sockets, shared memory, message queues.

---

### 3. Threads

A **thread** is a unit of execution *within* a process. All threads in a process share:
- Virtual address space (heap, global variables)
- File descriptors
- Code segment

Each thread has its own:
- **Stack** (default 1–8 MB virtual, ~8 KB–64 KB physically resident)
- **Registers** (saved to/from memory on context switch)
- **Thread-local storage (TLS)**
- Kernel scheduling state

**Creating a thread** (`pthread_create`, `new Thread()`, `goroutine`) is cheaper than creating a process, but not free: it requires a kernel call, stack allocation, and scheduler registration.

#### Thread Stacks

Each thread's stack stores:
- Local variables
- Function call return addresses (the call chain)
- Saved register values across function calls

Stack memory is allocated top-down from a fixed virtual address range. Overflow (too many nested calls) causes a **stack overflow** (SIGSEGV on Linux). Default stack size on Linux: 8 MB. With 1,000 threads: 8 GB of *virtual* address space reserved for stacks alone. On a 32-bit system this would be impossible.

**Java virtual threads (Project Loom):** Java's virtual threads use dynamic, growable stacks starting at ~200 bytes, allowing millions per JVM. The JVM runtime schedules them onto a small pool of carrier (OS) threads, parking and unparking as I/O completes.

---

### 4. Context Switching

The CPU can only run one thread per core at a time. The OS scheduler time-slices: it gives each runnable thread a **quantum** (typically 1–10 ms on Linux CFS), then preempts it and schedules another.

**What happens during a context switch:**

```
Thread A is running on Core 0
    ↓
Timer interrupt fires (or syscall blocks)
    ↓
CPU traps to kernel mode
    ↓
Kernel saves Thread A's registers to its PCB (kernel stack)
    ↓
Kernel scheduler runs, picks Thread B
    ↓
Kernel restores Thread B's registers from its PCB
    ↓
CPU returns to user mode, executes Thread B
```

**Cost:** ~1–5 µs on modern hardware. This includes:
- Saving/restoring ~30+ registers
- Flushing the TLB if switching between processes (expensive — hundreds of ns)
- Pipeline flushing
- Loss of cache warmth (cold cache lines for the newly scheduled thread)

**Why context switch cost matters:** If a thread blocks on I/O and gets context-switched, and the I/O completes 50 µs later, it may not be scheduled to run for another 1–10 ms (its next quantum). This is the source of **OS scheduling jitter** — even if your database responds in 100 µs, the thread waiting for it may not be woken up for milliseconds.

#### Voluntary vs Involuntary Context Switches

- **Voluntary (blocking):** thread calls `read()`, `sleep()`, `mutex_lock()` — explicitly yields the CPU
- **Involuntary (preemption):** scheduler forcibly removes a thread when its quantum expires

High involuntary context switches indicate CPU oversubscription (too many threads competing for too few cores).

---

### 5. System Calls

A **system call** (syscall) is the mechanism by which a user-space program requests a service from the OS kernel.

**Why the boundary exists:** The kernel has privileged access to hardware — it can write to disk, send network packets, allocate physical memory. User-space programs must ask the kernel to do these things. The CPU enforces this via **privilege rings** (Ring 0 = kernel, Ring 3 = user space).

**How a syscall works (x86-64):**

```
User program calls read(fd, buf, count)
    ↓
Loads syscall number into RAX (read = 0 on Linux x86-64)
Loads arguments into RDI, RSI, RDX
    ↓
Executes SYSCALL instruction
    ↓
CPU switches to Ring 0 (kernel mode)
CPU saves user-space registers to kernel stack
CPU switches to kernel's address space via CR3 register
    ↓
Kernel dispatches to sys_read()
sys_read() does the work (or blocks waiting for data)
    ↓
Kernel puts return value in RAX
    ↓
SYSRET instruction
CPU switches back to Ring 3 (user mode)
Restores user-space registers
    ↓
Continues execution
```

**Cost:** ~200–500 ns round-trip. This is because:
- CPU must flush speculative execution (Spectre/Meltdown mitigations made this worse — kernel page-table isolation adds TLB flushes)
- Register save/restore
- Address space switch (if full kernel page-table isolation is active)

**Implication:** Avoid hot loops with syscalls inside. `read()` in a tight loop on a socket is much more expensive than a batched `read()` with a large buffer. This is why `sendfile()` (zero-copy) and `io_uring` exist — they reduce the number of syscalls per I/O operation.

**Common syscalls engineers encounter:**
| Syscall | Purpose |
|---------|---------|
| `read` / `write` | File/socket I/O |
| `send` / `recv` | Socket I/O |
| `mmap` | Map file/memory into address space |
| `brk` / `mmap` | Heap expansion (via malloc) |
| `futex` | Fast user-space mutex (kernel only involved on contention) |
| `epoll_wait` | Wait for events on multiple fds (non-blocking I/O) |
| `clone` | Create thread or process |
| `execve` | Execute a new program |

---

### 6. Kernel vs User Space

```
┌─────────────────────────────────────────────┐
│                USER SPACE                   │
│                                             │
│  ┌─────────────┐  ┌──────────┐  ┌────────┐  │
│  │ Your App    │  │ libc     │  │ JVM    │  │
│  │             │  │ (glibc)  │  │        │  │
│  └──────┬──────┘  └────┬─────┘  └───┬────┘  │
│         │              │             │       │
│  ═══════╪══════════════╪═════════════╪══════ │
│         │    System Call Interface   │       │
│  ═══════╪══════════════╪═════════════╪══════ │
│         ▼              ▼             ▼       │
│                                             │
│               KERNEL SPACE                  │
│                                             │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │ VFS      │ │ TCP/IP   │ │ Memory Mgr  │  │
│  │ (files)  │ │ Stack    │ │ (paging)    │  │
│  └──────────┘ └──────────┘ └─────────────┘  │
│  ┌──────────────────────────────────────┐    │
│  │            Device Drivers            │    │
│  └──────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
│                  Hardware                   │
│  CPU  |  RAM  |  NIC  |  Disk  |  PCI      │
└─────────────────────────────────────────────┘
```

**User space:** Where your application runs. Limited privileges. Cannot directly access hardware. Must ask the kernel via syscalls.

**Kernel space:** Where the OS kernel runs. Full hardware access. Handles memory management, process scheduling, file systems, networking, device drivers. Code running in kernel space has no memory protection — a bug can crash the entire system.

**Why this matters for engineering:**
- **Syscall cost** — every time your code crosses the boundary, you pay ~200–500 ns. In hot paths, this adds up.
- **Zero-copy I/O** — `sendfile()` avoids the user-space bounce: data moves directly from the file buffer cache to the socket buffer without ever being copied to user space.
- **eBPF** — allows running restricted user-provided code *in kernel space* for observability and networking, eliminating the kernel/user space crossing for high-frequency probes.

---

### 7. File Descriptors

A **file descriptor** (fd) is an integer that represents an open resource in the OS — a file, socket, pipe, timer, or event queue.

```
Process fd table:
fd 0 → stdin  (keyboard)
fd 1 → stdout (terminal)
fd 2 → stderr (terminal)
fd 3 → network socket (client connection)
fd 4 → open file on disk
fd 5 → epoll instance
...
```

**File descriptor limits:** Each process has a maximum number of open fds (default: 1,024 soft limit on Linux; up to 1 million+ configurable). A server that opens a connection per client and forgets to close it will hit this limit and crash with "Too many open files."

**Everything is a file:** Unix treats devices, sockets, pipes, and even the `/proc` filesystem as files accessible via read/write. This uniformity lets `epoll` wait on any file descriptor.

---

### 8. Interrupts

An **interrupt** is a signal from hardware (or software) to the CPU: "stop what you're doing and handle this."

**Hardware interrupts:**
- Network card: "a packet arrived" → kernel receives and queues it
- Disk controller: "the read you requested is complete" → kernel wakes the waiting thread
- Timer: "your quantum expired" → scheduler runs

**Software interrupts (exceptions):**
- Division by zero → CPU raises exception, kernel sends SIGFPE
- Segmentation fault (null pointer dereference) → kernel sends SIGSEGV
- System call → CPU raises software interrupt (INT 0x80 on older x86, SYSCALL on x86-64)

**Why interrupts matter:** Every piece of I/O your program does results in at least one interrupt when it completes. The interrupt handler runs in kernel context, wakes the waiting thread, and queues it for scheduling. Until scheduled, the thread sits in the run queue — adding latency beyond the physical I/O time.

---

### 9. I/O — Blocking vs Non-Blocking

This is one of the most consequential distinctions in systems programming.

#### Blocking I/O

```
Thread calls read(socket_fd, buf, 4096)
    ↓
Kernel: no data available yet
    ↓
Thread is moved to WAITING state
    ↓
CPU runs another thread
    ↓
... (time passes, network packet arrives) ...
    ↓
Kernel interrupt: data arrived
    ↓
Kernel copies data to buf
    ↓
Thread moved back to RUNNABLE
    ↓
Scheduler eventually gives thread the CPU
    ↓
read() returns with data
```

**Characteristics:**
- Simple to program — linear code
- Each blocking call requires one thread (or goroutine) per concurrent operation
- Thread pools limit concurrency to thread count × available memory for stacks

#### Non-Blocking I/O + Event Loops (select/poll/epoll)

```
Thread calls epoll_wait(epoll_fd, events, max_events, timeout)
    ↓
Kernel: watches N file descriptors for readability/writability
    ↓
Thread sleeps until any fd is ready
    ↓
epoll_wait returns list of ready fds
    ↓
Thread processes each ready fd (reads data, writes response)
    ↓
Calls epoll_wait again
```

**Characteristics:**
- One thread handles many connections (the event loop / reactor pattern)
- No per-connection thread overhead
- **Fatal flaw:** any blocking call *inside* the event loop blocks all connections it manages

```
Event loop thread:
  fd 3 is readable → read() returns immediately (data in kernel buffer)
  fd 4 is readable → read() starts a DB query... BLOCKS for 50ms
  ← all other 999 connections are frozen for 50ms
```

This is why Node.js and Netty forbid blocking in the event loop, and why Kotlin coroutines, Java virtual threads, and Go goroutines are valuable: they give you blocking-style code with non-blocking I/O scheduling underneath.

#### I/O Models Comparison

| Model | Concurrency Unit | Blocking Call Behaviour | Use Case |
|-------|-----------------|------------------------|----------|
| Thread-per-request | OS thread (1–8 MB stack) | Blocks the thread only | Traditional web servers, JDBC |
| Event loop (NIO) | Single thread + callbacks | Freezes all connections | Node.js, Netty, Redis |
| Coroutines/Virtual Threads | User-space unit (~KB stack) | Parks only this coroutine | Go, Kotlin, Java 21+, async/await |

---

### 10. Memory Allocation

#### Stack Allocation

Local variables are allocated on the **stack** — just a decrement of the stack pointer register (RSP). Deallocation is free — when a function returns, the stack pointer moves back. Stack allocation is essentially free.

**Stack memory is:**
- Thread-local (each thread has its own stack)
- Fixed-size (default 8 MB on Linux, 512 KB on some systems)
- Automatically freed when the function returns
- Limited to data whose lifetime doesn't outlive the function

#### Heap Allocation

Dynamic memory (`malloc` in C, `new` in Java, object literals in Python) is allocated on the **heap** — a region of memory managed by the allocator.

```
Your code calls:
  malloc(size)  → asks the allocator for 'size' bytes
    ↓
Allocator manages a free list of blocks
    ↓
If sufficient free memory: returns a pointer, O(1)–O(log n)
    ↓
If heap is exhausted: calls brk() or mmap() to expand from OS
    ↓ (syscall! expensive)
```

**Heap allocation is not free:**
- Malloc must maintain free lists, potentially acquiring locks in multi-threaded programs
- Pointer-chasing through heap objects is cache-unfriendly (random memory access)
- Heap fragmentation grows over time

**jemalloc / tcmalloc:** Modern allocators use thread-local caches of size-class bins to make common-case allocation lock-free. This is what makes Java/Go/C++ allocation fast in practice.

---

### 11. Garbage Collection

Languages with managed memory (Java, Go, Python, C#) use a **garbage collector** to automatically find and free unreachable objects on the heap.

**Why GC exists:** Manual memory management is error-prone (use-after-free, double-free, memory leaks). GC eliminates these classes of bugs at the cost of:
- CPU overhead (scanning/collecting)
- Pause time (stop-the-world events)
- Memory overhead (headroom needed for GC to operate efficiently)

**GC phases:**

1. **Mark:** trace object graph from roots (stack variables, global references), mark all reachable objects
2. **Sweep (or compact):** free unmarked objects; optionally compact survivors to reduce fragmentation

**Stop-the-world (STW) pauses:** During certain GC phases, all application threads must pause. Even modern collectors (G1, ZGC, Shenandoah) have some STW pauses:
- ZGC/Shenandoah target < 1 ms STW
- G1 targets < 200 ms (configurable)
- Old CMS/parallel collectors: 100s of ms in worst case

**GC pauses cause tail latency spikes.** This is why p99/p999 latency is reported separately from mean — a GC pause of 50 ms shows as a p999 spike that the mean hides.

**GC tuning knobs (Java as example):**
- Heap size (`-Xms`, `-Xmx`) — larger heap → fewer GC cycles, longer pauses if compaction needed
- GC algorithm (`-XX:+UseZGC`, `-XX:+UseG1GC`)
- New gen ratio — more new gen space → fewer full GCs for short-lived objects
- GC thread count

**For distributed systems:** GC pauses cause JVM-based service nodes to become temporarily unresponsive, triggering timeouts in callers, triggering retries, increasing load, potentially worsening GC — a feedback loop. This is one reason latency-sensitive systems use:
- Off-heap memory (ByteBuffers, Chronicle Map, RocksDB in Java)
- GC-free (or GC-friendly) data structures
- Go or Rust (explicit, simpler, or no GC)

---

### 12. CPU Scheduling

The OS scheduler decides which thread runs on which CPU core at any given moment.

**Linux CFS (Completely Fair Scheduler):**
- Tracks virtual runtime (vruntime) per thread — time already given to each thread
- Always runs the thread with lowest vruntime next
- "Fair" in time: each thread gets equal CPU time in proportion to its priority (nice value)

**Scheduling latency:** After a thread becomes runnable (e.g., I/O completes), it doesn't run immediately. It enters the run queue and waits until the scheduler picks it. Default CFS scheduling period: ~6–24 ms (scales with thread count). This is the source of **wakeup latency** — even instant I/O has ~ms scheduling delay before the thread processes results.

**NUMA (Non-Uniform Memory Access):** On multi-socket servers, memory banks are attached to specific CPU sockets. Accessing memory on the "remote" socket is 2–3× slower than local. The scheduler tries to keep threads on the same NUMA node as their memory. Cross-NUMA-node access silently destroys throughput.

**CPU affinity:** You can pin threads to specific cores (`taskset`, `pthread_setaffinity_np`). Used in latency-sensitive systems (trading platforms, game servers) to avoid scheduler jitter and cache eviction from core sharing.

---

## Step-by-Step Execution

### What happens when your web server reads a request from a socket?

```
Frame 1: Client TCP segment arrives at NIC (network card)
    ↓
Frame 2: NIC writes packet to memory via DMA (direct memory access)
    ↓
Frame 3: NIC raises hardware interrupt
    ↓
Frame 4: CPU interrupts current thread, runs interrupt handler (kernel)
    ↓
Frame 5: Kernel's NIC driver reads packet from ring buffer
    ↓
Frame 6: Kernel TCP stack processes packet: validates checksum, updates
          TCP state machine, copies payload to socket receive buffer
    ↓
Frame 7: Kernel marks the socket fd as readable
    ↓
Frame 8a (blocking I/O):  Kernel wakes the thread blocked on read()
          → thread enters RUNNABLE, waits for CPU quantum
Frame 8b (epoll):         epoll_wait() returns with this fd in ready list
                          → event loop calls read() immediately
    ↓
Frame 9: Thread calls read(fd, buf, n) → syscall
    ↓
Frame 10: CPU switches to kernel mode (ring 0)
    ↓
Frame 11: Kernel copies data from socket buffer to user-space buf
    ↓
Frame 12: Syscall returns, CPU switches to user mode (ring 3)
    ↓
Frame 13: Your code processes the request data
```

**Hidden costs in this path:**
- DMA + interrupt: ~1–5 µs kernel-side
- TCP stack processing: ~1–10 µs
- Schedule wakeup latency: 0 µs (non-blocking) to ~5 ms (heavily loaded scheduler)
- Two mode switches (user → kernel → user): ~400–1,000 ns
- Data copy from socket buffer to user buf: proportional to payload size

---

## Deep Dive

### Virtual Memory and the Page Table

Every process sees a **virtual address space** — a uniform memory map from address 0 to 2⁶⁴-1. The OS and hardware cooperate to translate virtual addresses to physical addresses on every memory access.

```
Virtual Address (48-bit on x86-64):
┌──────────┬──────────┬──────────┬──────────┬────────────┐
│  PML4    │  PDPT    │   PD     │   PT     │  Offset    │
│ 9 bits   │  9 bits  │  9 bits  │  9 bits  │  12 bits   │
└──────────┴──────────┴──────────┴──────────┴────────────┘
     ↓            ↓          ↓          ↓           ↓
  Page Map    Page Dir   Page Dir   Page      Byte within
  Level 4     Ptr Table  Table      Table     4 KB page
```

**TLB (Translation Lookaside Buffer):** A CPU-side cache of recent virtual→physical translations. A TLB miss means walking the 4-level page table (~4 memory accesses). TLB flushes are expensive — happens on context switches between processes.

**Page faults:** When you access a virtual address with no physical backing yet, the CPU raises a page fault. The OS handler allocates a physical page, updates the page table, and returns. This is how heap memory (CoW, mmap) is lazily allocated — you pay the cost only on first access.

**Huge pages (2 MB / 1 GB):** Using larger pages reduces TLB pressure (fewer entries needed to cover the same virtual address range). Databases (PostgreSQL, Redis) and JVMs use huge pages to reduce TLB thrash for their large memory footprints.

### What a malloc() Actually Does

```
Thread calls malloc(200)
    ↓
jemalloc checks thread-local cache for 256-byte size class
    ↓
Cache hit → return pointer from cache (no lock, ~20 ns)
    ↓ (cache miss path:)
    ↓
Lock a bin (per-size-class lock)
    ↓
Allocate from an arena run (slab of pages for this size class)
    ↓
If arena is empty: call mmap() to get more pages from OS (~1 µs)
    ↓
Return pointer
```

`free()` on a size-class block returns it to the thread-local cache if not full, otherwise back to the arena.

**This is why:** Object allocation in Java/Go/C++ is fast for common patterns, but `System.gc()` on the JVM or fragmented heaps with many large, varied-size objects can cause slow allocation paths.

---

## Real-World Example

### Diagnosing a Latency Spike in a Java Service

A Java microservice suddenly shows p99 latency spikes from 5 ms to 200 ms every ~30 seconds. Here is how the computer-systems knowledge maps to the diagnosis:

```
Symptom: Regular 200ms p99 spikes

Hypothesis 1: GC pause
    → Check: GC logs (-XX:+PrintGCDetails -XX:+PrintGCDateStamps)
    → Evidence: Full GC every 30s, 180ms STW
    → Fix: Increase heap, switch to G1 or ZGC

Hypothesis 2: OS scheduling jitter
    → Check: CPU utilization, vmstat, runqueue length
    → Evidence: vmstat shows run queue = 40 on 8-core machine
    → Fix: Reduce thread count, use async I/O, or add capacity

Hypothesis 3: False sharing
    → Check: perf stat (cache-misses counter)
    → Evidence: 30% cache miss rate, code uses shared counter array
    → Fix: @Contended annotation (Java), manual padding

Hypothesis 4: Network interrupt affinity
    → Check: /proc/interrupts, CPU per-core utilization
    → Evidence: All NIC interrupts on Core 0, Core 0 at 100%
    → Fix: irqbalance, or explicit IRQ affinity spreading
```

---

## Failure Scenarios

### Scenario 1: Thread Starvation Under Load

**Setup:** A web server uses a fixed thread pool of 100 threads. An upstream dependency becomes slow (database starts taking 5s per query).

**What happens:**
```
Request arrives → assigned to a thread
Thread calls DB → blocks for 5 seconds
100 requests arrive × 5s each = 500 thread-seconds of work
Thread pool is full within 500/100 = 5 seconds
New requests: "no thread available" → rejected or queued
Queue fills up → requests time out
```

**Root cause:** Thread-per-request model has linear scaling with thread count. Under sustained I/O latency increase, all threads exhaust simultaneously. This is called **thread exhaustion** or **thread pool starvation**.

**Fix options:**
- Reduce thread pool size (counterintuitive — forces faster failure/shedding)
- Set aggressive timeouts on DB calls
- Use async/virtual threads (don't block OS threads on I/O)
- Circuit-break the DB dependency

### Scenario 2: GC Pause Causing Downstream Timeouts

**Setup:** Service A calls Service B with a 200ms timeout. Service B's JVM GC runs a 150ms stop-the-world pause.

**What happens:**
```
Service A sends request to B
Service B receives request, starts processing
GC triggers → all threads paused for 150ms
(From A's perspective, B is unresponsive)
Request completes in 170ms total
Service A sees 170ms > 200ms timeout? → timeout
A retries → B's GC load increases → more frequent GC
```

**Principal insight:** GC pauses are **invisible to the GC'd service** but visible to callers as latency spikes. Set your timeout budgets with GC pause times in mind, or use a low-pause GC (ZGC targets < 1ms).

---

## Performance Considerations

### Key Numbers for Capacity Reasoning

**CPU-bound work:**
- A single core at 3 GHz with ~10 instructions per request operation: ~300M operations/sec
- In practice, cache misses, branches, and syscalls reduce this to ~10–50M operations/sec for typical workloads

**Memory-bound work:**
- Bandwidth to L3 cache: ~200 GB/s
- Bandwidth to DRAM: ~50 GB/s
- If each request touches 10 KB of distinct memory: 50 GB/s ÷ 10 KB = 5 million requests/sec max throughput on DRAM bandwidth alone

**Concurrency sizing (Little's Law preview):**
> If a service handles 10,000 req/s and each request takes 50ms:
> Concurrency needed = 10,000 × 0.050 = **500 concurrent requests**
> (We'll formalize this in Ch 35 — Performance & Queueing Theory)

---

## Trade-offs

| Concern | Trade-off |
|---------|----------|
| More threads | Higher concurrency but higher memory use, scheduling overhead, cache pressure |
| Larger heap | Fewer GC cycles but longer pauses when GC runs |
| Blocking I/O | Simpler code but linear thread growth with connections |
| Non-blocking I/O | Better scalability but no blocking allowed in event loop |
| Huge pages | Reduced TLB pressure but increased memory fragmentation |
| CPU affinity | Reduced scheduling jitter but reduced load balancing flexibility |

---

## Alternatives

| Approach | When to use |
|----------|-------------|
| Event loops (epoll + callbacks) | Very high connection counts, simple I/O logic, can avoid blocking |
| Coroutines / virtual threads | High concurrency with blocking-style code, rich business logic |
| Thread-per-request | Low concurrency, latency-sensitive, simple workload |
| io_uring | Linux 5.1+, very high I/O throughput (db-per-service I/O, storage engines) |
| DPDK / kernel bypass | Extreme packet rates (> 10M pps), not general-purpose |

---

## Production Considerations

1. **Monitor GC pauses, not just average latency.** In any JVM service, `p999` latency is almost always driven by GC STW pauses.
2. **Set file descriptor limits explicitly.** Default 1024 will bite you in production. Use `ulimit -n 1000000` or set in `/etc/security/limits.conf`.
3. **NUMA awareness.** On multi-socket servers, pin your JVM/process to a NUMA node and ensure your memory is allocated locally. Use `numactl`.
4. **Thread pool sizing.** For CPU-bound: `num_threads ≈ num_cores`. For I/O-bound: `num_threads ≈ num_cores × (1 + wait_time / compute_time)`. But in practice: use virtual threads or async I/O and eliminate thread pool sizing as a concern.
5. **Watch `vmstat -w 1` in production.** The `r` column (run queue length) > number of cores means CPU oversubscription — scheduling latency is adding to every request's latency.

---

## Common Beginner Mistakes

1. **"Add more threads to increase throughput."** More threads than CPU cores adds context switch overhead and cache pressure — you can make throughput *worse*.
2. **"Our service uses 10% CPU, it has plenty of headroom."** CPU utilization is not the only bottleneck. Check: memory bandwidth, disk I/O, network, lock contention, GC pauses.
3. **"malloc is free."** Frequent small allocations create GC pressure, heap fragmentation, and poor cache locality. Prefer pre-allocation and object pooling for hot paths.
4. **"Non-blocking I/O is always faster."** Non-blocking is better for scalability under high concurrency. For a single-threaded, low-concurrency program, blocking I/O is simpler and often fast enough.
5. **"GC only pauses during GC."** Modern concurrent GCs still have brief STW phases (root scanning). Even ZGC has ~1ms STW pauses that appear at p999.

---

## Common Senior Engineer Mistakes

1. **Tuning GC before profiling.** Always measure first. GC may not be the bottleneck.
2. **Using a fixed thread pool for I/O-bound work.** Thread pool + blocking DB calls = starvation under load. Use async or virtual threads.
3. **Ignoring NUMA on multi-socket hardware.** This can cause 2–3× throughput loss silently.
4. **Copying byte arrays unnecessarily.** Every `byte[]` copy in Java is a heap allocation + GC pressure + potential cache miss. Use `ByteBuffer`, direct buffers, or off-heap memory for hot I/O paths.
5. **Setting timeout > GC max pause time.** Downstream callers time out during your GC pause. Either reduce GC pause time or ensure timeout budgets account for it.

---

## Architecture Smells

- Service has p99 latency 10–100× higher than p50 → likely GC pauses or scheduling jitter
- CPU utilization flat but throughput doesn't scale with cores → shared locks or NUMA issue
- Thread count grows linearly with connection count → thread-per-request model, will not scale
- Heap size `< 2 × live data set` → GC will thrash constantly

---

## Principal Engineer Perspective

Junior engineers think about computers as "the machine that runs my code." Senior engineers think about latency numbers — they know a DB call costs ~1ms. Principal Engineers think in terms of the **physical constraints** that limit what is possible.

A Principal Engineer sees a system design and immediately asks:
- "What is the memory working set? Will it fit in L3 cache? DRAM? What's the cache miss rate?"
- "This service makes 5 synchronous calls. Each 50ms. Little's Law says it needs 250 concurrent threads at 1,000 RPS. Will the thread pool size?"
- "They're using Go's goroutines but calling a CGo library that blocks the OS thread. Their concurrency model just became thread-per-request."
- "This JVM service has a 32 GB heap. How large are its GC pauses? What's p999 latency?"

**What junior engineers get wrong:** They think OS scheduling, cache behavior, and GC are implementation details that don't affect architecture. They are wrong. These are the constraints that determine whether your architecture works at scale.

**What senior engineers commonly miss:** They know the numbers individually but don't connect them. They know GC pauses exist but don't account for them in timeout budgets. They know context switches cost but still use thread pools with 1,000 threads for I/O workloads.

**What trade-offs matter:**
- Every millisecond of GC pause time must be reflected in your timeout budget (with margin)
- Thread-per-request and blocking I/O are fine at low concurrency — switching to async before you need to is premature optimization
- Non-blocking I/O buys you density (connections per thread), not latency

---

## Architecture Review Questions

1. If this service's thread pool is full, what happens to incoming requests? Are they queued? For how long? What happens when the queue fills?
2. What is the GC algorithm in use? What is the expected p999 GC pause? Does our timeout to callers account for it?
3. Is this service CPU-bound or I/O-bound? How was this measured (not assumed)?
4. How many file descriptors does this service use at peak? Have we raised the OS limit?
5. On multi-socket hardware, is this service NUMA-aware? Where is its memory allocated?
6. What is the ratio of blocking I/O waits to compute time? Does the thread pool size reflect it?
7. Does any hot path in this service do heap allocation at high rate? What is the GC overhead?
8. What is the consequence of a 50ms GC pause for downstream callers of this service?
9. Are there any syscalls in the hot path that could be batched or eliminated?
10. What happens to this service's latency when the CPU is at 80% utilization? 90%? 100%?

---

## Visual / Animation Specification

### Animation 1: Cache Hit vs Cache Miss

**Frame 1:** CPU core, L1 cache (empty), L2 cache (empty), RAM labeled with addresses. Show a loop iterating array elements sequentially.

**Frame 2:** First access → L1 miss → L2 miss → RAM fetch (highlight slow path). Cache line loaded (64 bytes shown as 8 elements).

**Frame 3:** Next 7 accesses → L1 hits (fast green path). Throughput counter: "7 hits = 7 ns."

**Frame 4:** Jump to random address → cache miss again. Show the cold miss penalty.

**Frame 5 (False Sharing):** Two cores, each accessing different element of same cache line. Core 0 writes → cache line bounces. Throughput meter plummets.

### Animation 2: Context Switch

**Frame 1:** Thread A running on Core 0. Show register state (RAX = 42, RSP → stack frame). Thread B: WAITING.

**Frame 2:** Timer interrupt fires. Arrow from timer → CPU (interrupt line).

**Frame 3:** Kernel saves Thread A's registers to PCB. Stack shown being saved.

**Frame 4:** Scheduler runs, selects Thread B.

**Frame 5:** Kernel restores Thread B's registers. Thread B resumes.

**Frame 6:** Timeline showing total cost: 1–5 µs.

---

## Hands-On Tutorial

### Exercise: Observing Cache Effects in Java

```java
public class CacheEffectDemo {

    static final int SIZE = 1024 * 1024; // 1M elements
    static final int[] arr = new int[SIZE];

    public static void main(String[] args) {
        // Warm up JIT
        sequentialSum();
        randomSum();

        long t1 = System.nanoTime();
        long s1 = sequentialSum();
        long t2 = System.nanoTime();
        long s2 = randomSum();
        long t3 = System.nanoTime();

        System.out.printf("Sequential sum: %d ns (result %d)%n", t2 - t1, s1);
        System.out.printf("Random access:  %d ns (result %d)%n", t3 - t2, s2);
        // Sequential will be 5-20x faster due to cache prefetching
    }

    static long sequentialSum() {
        long sum = 0;
        for (int x : arr) sum += x;
        return sum;
    }

    static long randomSum() {
        long sum = 0;
        java.util.Random rng = new java.util.Random(42);
        for (int i = 0; i < SIZE; i++) sum += arr[rng.nextInt(SIZE)];
        return sum;
    }
}
```

**Expected result:** Sequential is 5–20× faster because the hardware prefetcher loads ahead. Random access pattern defeats the prefetcher — every access is a cache miss.

### Exercise: Observing Context Switch Cost

Use `perf stat -e context-switches,cpu-clock,cache-misses java MyService` while load-testing. Correlate context-switch rate with p99 latency.

### Exercise: Observing GC Pauses

```bash
java -XX:+UseZGC \
     -Xms2g -Xmx2g \
     -Xlog:gc*:file=gc.log:time,uptime,level,tags \
     -jar myservice.jar
```

Then: `grep "Pause" gc.log | awk '{print $NF}' | sort -n | tail -20`

---

## Failure Injection Lab

### Lab: Thread Pool Exhaustion

1. Deploy a simple HTTP service with a thread pool of 10 threads, each making a blocking call to a "slow dependency" (simulated with `Thread.sleep(5000)`).
2. Send 15 concurrent requests with `wrk` or `hey`.
3. **Expected:** first 10 requests hang for 5s. Requests 11–15 either wait in queue or get rejected.
4. **Observe:** active threads, queue depth, response times.
5. **Fix:** switch to virtual threads (`Executors.newVirtualThreadPerTaskExecutor()`), rerun, observe threads 11–15 also complete in 5s without rejection.
6. **Learning:** Thread pools are not the right model for I/O-bound workloads.

---

## Exercises

**Conceptual:**

1. A CPU core runs at 3 GHz. A memory access takes 100 ns. How many CPU cycles are wasted per cache miss?
2. Why does allocating 1,000 small objects per request cause worse GC behavior than allocating one 1,000-object-equivalent data structure?
3. Explain why a linked list is cache-unfriendly compared to an array, even if they contain the same data.
4. Two threads share a `long[] counters` array where thread 0 updates `counters[0]` and thread 1 updates `counters[1]`. Why might this be slow? How do you fix it?

**Architecture:**

5. A service has p50 latency of 5ms and p999 latency of 500ms. List three computer-systems-level causes and how you would diagnose each.
6. You are designing a new service that needs to handle 50,000 concurrent WebSocket connections. Compare thread-per-connection vs event-loop architectures for this workload. What is the memory cost of each?
7. A Java service is GC'ing every 30 seconds with 200ms stop-the-world pauses. Callers have a 500ms timeout. Is there a problem? What if callers have a 150ms timeout?

**Quantitative:**

8. A service makes one database call per request. The DB takes 10ms. The service also does 5ms of computation. What is the maximum RPS if using a 100-thread pool? (Hint: use Little's Law.)
9. An array has 1 million `int` elements (4 bytes each). How many L1 cache lines (64 bytes each) are needed to store the entire array? If iterating sequentially, how many L1 cache misses do you expect?

---

## Solutions

### Exercise 1
100 ns × 3 GHz = 100 × 10⁻⁹ s × 3 × 10⁹ cycles/s = **300 cycles wasted per cache miss.**

### Exercise 4
`counters[0]` and `counters[1]` are 8 bytes apart, both within a 64-byte cache line. When thread 0 writes to `counters[0]`, it invalidates the cache line on the other core, causing thread 1 to re-fetch it before writing `counters[1]`. Fix: pad the array — use `@Contended` in Java, or use a separate `long[]` per thread, or use `LongAdder`.

### Exercise 8
Total time per request = 10ms DB + 5ms compute = 15ms.
By Little's Law: L = λW → λ = L/W = 100 threads / 0.015s = **6,667 RPS max** (for 100 threads).

### Exercise 9
1M × 4 bytes = 4 MB. Cache lines = 4 MB / 64 bytes = **65,536 cache lines**. Sequential iteration: after the first access to each cache line (1 miss per 16 ints), subsequent 15 accesses are L1 hits. Total misses ≈ 1M / 16 = **~62,500 cache misses**.

---

## Interview Questions

### Beginner
- What is the difference between a process and a thread?
- What is a context switch? When does it happen?
- What is a system call? Give three examples.

### Senior
- Explain false sharing. How would you detect it and fix it?
- A service has high CPU utilization but low throughput. List possible causes.
- What is a GC pause and how does it affect service-to-service calls?
- Compare blocking I/O and non-blocking I/O. When would you choose each?

### Staff
- Your JVM service shows p999 latency of 500ms but p99 of 10ms. How do you diagnose this? What are the top 3 hypotheses?
- Explain why increasing thread count can decrease throughput.
- How does NUMA affect a database running on a multi-socket server?

### Principal
- A distributed system has a p999 latency SLO of 50ms. Every service in the call chain is a JVM service using G1 GC with max pause time configured to 200ms. Is this SLO achievable? Why or why not? What would you change?
- An engineer proposes solving connection handling scalability by increasing the OS thread limit to 100,000 threads. Critique this approach. What are the failure modes?
- You are designing a high-frequency event processing service that must process 10 million events/second with < 1ms p99 latency. What are the computer-systems constraints that govern this design?

---

## Summary

A computer's performance is governed by **physical constraints** that no amount of software cleverness can eliminate:

- **Memory hierarchy:** registers → L1 → L2 → L3 → RAM → SSD → disk, each 3–1000× slower than the previous
- **Cache lines:** 64 bytes of memory move together; sequential access is fast, random is slow, false sharing is invisible
- **Processes** provide isolation; **threads** provide concurrency within a process at the cost of shared state hazards
- **Context switches** cost 1–5 µs and cause cache eviction; they happen both voluntarily (I/O) and involuntarily (preemption)
- **System calls** cost 200–500 ns each; batch where possible, use zero-copy mechanisms
- **Blocking I/O** is simple but scales linearly with threads; **non-blocking I/O** scales connections but forbids blocking in the event loop
- **GC pauses** cause latency spikes at p99/p999 that are invisible to average latency; account for them in timeout budgets
- **CPU scheduling jitter** adds unpredictable latency even when I/O is instant

---

## What You Should Now Be Able To Explain

- ✅ Why a database call takes at minimum ~0.5ms even on localhost
- ✅ Why 1,000 threads is usually worse than 100 threads for I/O-bound workloads
- ✅ Why a linked list iteration is slower than an array iteration of the same data
- ✅ Why two threads on different cores accessing neighboring array elements can be slower than a single thread
- ✅ Why GC pauses appear as p999 spikes but not in p50
- ✅ Why a syscall-heavy hot path is slow even when the CPU is "idle"
- ✅ What happens physically when your code calls `read()` on a socket

---

## What To Learn Next

**Chapter 2 — Concurrency & Parallelism** builds directly on this foundation. You now know what a thread is at the OS level — next you'll understand what goes wrong when multiple threads access shared state: race conditions, deadlocks, the Java Memory Model, and why concurrent programming is hard even on a single machine. That understanding is the prerequisite for understanding why distributed computing is *substantially harder* — the same concurrency problems, but now the shared state is across a network with no shared memory, no locks, and unreliable message delivery.
