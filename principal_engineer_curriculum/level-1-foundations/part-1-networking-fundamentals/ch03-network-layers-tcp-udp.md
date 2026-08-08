# Chapter 3 — Network Layers, TCP & UDP

## Difficulty
Intermediate → Advanced

## Importance
**Must Know** — Every distributed systems concept in this curriculum travels over a network. Timeouts, retries, circuit breakers, connection pools, service discovery, load balancing — all are responses to network behaviour. You cannot reason about why distributed systems fail the way they do without understanding what TCP actually guarantees, what it doesn't, and what happens at each layer when a packet travels from one service to another.

## Prerequisites
Chapter 1 — Computer Systems (processes, file descriptors, syscalls, blocking I/O)
Chapter 2 — Concurrency & Parallelism (why we need coordination across machines)

## Learning Objectives

By the end of this chapter you will be able to:

1. Describe the OSI and TCP/IP models and explain what each layer does and why the layering exists.
2. Explain what happens at the IP layer: addressing, routing, fragmentation.
3. Describe the TCP three-way handshake step by step — what happens in the kernel at each step.
4. Explain TCP's reliability mechanisms: sequence numbers, ACKs, retransmission, flow control, congestion control.
5. Explain what happens during TCP connection teardown and why TIME_WAIT exists.
6. Describe common TCP failure modes: RST, half-open connections, connection pool exhaustion.
7. Explain why UDP exists and when it is the right choice.
8. Describe QUIC and why it was built.
9. Use the knowledge of TCP internals to reason about distributed systems failure modes.

## Why This Matters

Every remote procedure call — whether REST, gRPC, or a database query — travels over TCP. When engineers say "the service timed out," they are describing a TCP-level phenomenon. When they say "connection refused," that is a TCP RST packet. When they say "connection pool exhausted," they are describing the cost of TCP connection establishment multiplied by the number of concurrent requests.

A Principal Engineer who understands TCP can answer:
- Why does a service under load start dropping requests even when the downstream is healthy?
- Why does a timeout not guarantee the downstream did not process the request?
- Why does adding more threads sometimes make connection pool exhaustion worse, not better?
- Why does a network partition not look like a clean failure — it looks like a timeout?
- Why does Kafka use long-polling instead of short connections?
- Why does gRPC outperform REST under high concurrency?

These are not trivia questions. They are the questions you need to answer to design and operate reliable distributed systems.

---

## Mental Model

> **The network is an unreliable, shared medium. TCP is a protocol that builds a reliable, ordered, bidirectional byte stream on top of it — using acknowledgements, retransmission, and flow control. UDP offers the raw medium with no guarantees. Every reliability mechanism in TCP has a cost. Understanding those costs explains why distributed systems behave as they do.**

---

## Intuition

Imagine sending a book chapter by chapter through the postal service.

**Without TCP (UDP-like):** You put each chapter in an envelope and send it. The postal service might lose envelope 3. Chapter 4 might arrive before chapter 2. Some envelopes might arrive twice. The recipient gets whatever arrives, in whatever order.

**With TCP:** Before you start, you and the recipient exchange letters confirming you can communicate (the handshake). Every envelope you send has a sequence number. The recipient sends you a confirmation ("I got chapters 1 and 2, send 3 next"). If you don't receive confirmation for chapter 3 within a few minutes, you send it again. The recipient holds chapter 4 in a buffer until chapter 3 arrives, so it can hand you chapters in order. If the postal service is overwhelmed, you slow your sending rate (congestion control). When you're done, you exchange final letters to close the conversation gracefully.

The postal service is the IP layer. The envelope-numbering, confirmation, and retransmission scheme is TCP. The raw postal service without any of that overhead is UDP.

---

## Visual Explanation

### The OSI Model

```
┌─────┬──────────────────┬──────────────────────────────────────────────────┐
│ OSI │ Name             │ What it does                                     │
│  7  │ Application      │ HTTP, DNS, SMTP, gRPC, your protocol             │
│  6  │ Presentation     │ Encoding, encryption (TLS lives here conceptually)│
│  5  │ Session          │ Session management (mostly absorbed by TCP/app)  │
│  4  │ Transport        │ TCP, UDP — end-to-end delivery, ports, reliability│
│  3  │ Network          │ IP — addressing, routing across networks          │
│  2  │ Data Link        │ Ethernet, Wi-Fi — hop-to-hop delivery, MAC addrs │
│  1  │ Physical         │ Cables, radio waves, electrical signals           │
└─────┴──────────────────┴──────────────────────────────────────────────────┘
```

### The TCP/IP Model (what engineers actually use)

```
┌──────────────────┬─────────────────────────────────────────────────────┐
│ TCP/IP Layer     │ OSI Equivalent │ Protocols                          │
├──────────────────┼────────────────┼────────────────────────────────────┤
│ Application      │ 5, 6, 7        │ HTTP, DNS, TLS, gRPC, Kafka proto  │
│ Transport        │ 4              │ TCP, UDP, QUIC                      │
│ Internet         │ 3              │ IP (IPv4, IPv6), ICMP, ARP         │
│ Link             │ 1, 2           │ Ethernet, Wi-Fi, MAC               │
└──────────────────┴────────────────┴────────────────────────────────────┘
```

**Why layering?** Each layer solves a specific, well-defined problem and exposes a clean interface to the layer above. This allows you to replace Ethernet with Wi-Fi without changing TCP. Replace TCP with QUIC without changing HTTP. Replace HTTP with gRPC without changing IP routing. Layering creates modularity.

### The Journey of a Packet: One Service Calling Another

```
Service A (10.0.0.1)                           Service B (10.0.0.2)
─────────────────────                          ─────────────────────

Application: HTTP GET /users/42
      ↓
Transport:   Wrap in TCP segment (src port 54321, dst port 8080)
      ↓
Network:     Wrap in IP packet (src 10.0.0.1, dst 10.0.0.2)
      ↓
Link:        Wrap in Ethernet frame (src MAC, dst MAC)
      ↓
Physical:    Electrical signals on cable / photons in fiber
      ↓
[Switch / Router: reads dst IP, forwards to correct interface]
      ↓
Physical:    Signals arrive at Service B's NIC
      ↓
Link:        Ethernet frame unwrapped, MAC checked
      ↓
Network:     IP packet unwrapped, dst IP = me, pass up
      ↓
Transport:   TCP segment unwrapped, dst port 8080, deliver to listener
      ↓
Application: HTTP request delivered to the web server handler
```

---

## Core Concepts

### 1. The IP Layer

**IP (Internet Protocol)** provides unreliable, best-effort delivery of packets from source to destination — across any number of intermediate routers.

#### IPv4 Addressing

An IPv4 address is a 32-bit number, written as four octets: `192.168.1.100`. Total address space: 2³² = ~4.3 billion addresses.

**Key address ranges:**
- `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` — private (RFC 1918), not routable on the internet
- `127.0.0.0/8` — loopback (localhost)
- `169.254.0.0/16` — link-local (APIPA, used when DHCP fails)
- Everything else — public, globally routable

**CIDR (Classless Inter-Domain Routing):** Notation for subnets. `10.0.0.0/24` means the first 24 bits are the network prefix — addresses `10.0.0.0` through `10.0.0.255` (256 addresses, 254 usable). The `/N` is the **prefix length** (subnet mask).

```
10.0.0.0/24:
  Network:   10.0.0.0
  Broadcast: 10.0.0.255
  Usable:    10.0.0.1 – 10.0.0.254  (254 addresses)
  Subnet mask: 255.255.255.0

10.0.0.0/16:
  Usable: 10.0.0.1 – 10.0.255.254  (65,534 addresses)
```

#### IPv6

128-bit addresses, written as eight groups of 4 hex digits: `2001:0db8:85a3::8a2e:0370:7334`. Total space: 2¹²⁸ — enough for every grain of sand on Earth to have trillions of addresses.

**Why IPv6 matters for distributed systems:** IPv4 exhaustion drove NAT (Network Address Translation), which breaks peer-to-peer connectivity and complicates service discovery. IPv6 gives every device a globally unique address, simplifying networking at the cost of transition complexity.

#### IP Routing

A **router** receives a packet and decides which interface to forward it out of, based on its **routing table**:

```
Destination     Gateway          Interface
10.0.1.0/24     10.0.0.1         eth0     (local subnet: direct delivery)
10.0.2.0/24     10.0.0.254       eth0     (next hop: forward to router)
0.0.0.0/0       203.0.113.1      eth1     (default route: send to ISP)
```

**Longest prefix match:** the router picks the most specific matching route. `10.0.1.50` matches `10.0.1.0/24` (more specific) rather than `0.0.0.0/0` (default).

**TTL (Time To Live):** Each IP packet carries a TTL field (starts at 64 or 128). Each router decrements it by 1. When TTL hits 0, the router drops the packet and sends an ICMP "Time Exceeded" back. This prevents infinite routing loops. `traceroute` exploits TTL to map network paths.

#### ARP — Address Resolution Protocol

IP routing gives you the destination IP. But to actually send the frame on Ethernet, you need the **MAC address** of the next hop.

```
ARP request (broadcast): "Who has IP 10.0.0.2? Tell 10.0.0.1"
ARP reply   (unicast):   "10.0.0.2 is at MAC aa:bb:cc:dd:ee:ff"
```

ARP results are cached (ARP cache, typically 20 minutes). Cache poisoning (malicious or accidental stale entries) can cause traffic to be sent to the wrong host — an ARP spoofing attack.

#### NAT — Network Address Translation

NAT allows many private-IP devices to share a single public IP. The NAT device (router) maintains a translation table:

```
Internal              External (NAT maps to)
10.0.0.1:54321  ───▶  203.0.113.1:10001   ─▶ Server 5.5.5.5:80
10.0.0.2:54322  ───▶  203.0.113.1:10002   ─▶ Server 5.5.5.5:80
```

Responses from `5.5.5.5:80` to `203.0.113.1:10001` are rewritten to `10.0.0.1:54321` and forwarded.

**NAT's impact on distributed systems:**
- Breaks IP-level peer-to-peer (no inbound connections to private IPs without port forwarding)
- Load balancers and Kubernetes cluster IPs often work via NAT
- NAT entries have timeouts — idle connections can have their NAT mapping removed, causing silent drops (the source of many mysterious "connection dropped after 30 minutes" bugs in long-lived TCP connections)

#### Ports

A **port** is a 16-bit number (0–65535) that identifies a specific process or service on a host.

- **0–1023:** Well-known ports (HTTP=80, HTTPS=443, SSH=22, DNS=53). Require root on Unix.
- **1024–49151:** Registered ports (Kafka=9092, Redis=6379, PostgreSQL=5432).
- **49152–65535:** Ephemeral (dynamic) ports — assigned by the OS to client-side sockets.

A **socket** is identified by the 5-tuple: `(protocol, src_IP, src_port, dst_IP, dst_port)`. This is what makes it possible for many clients to simultaneously connect to the same server port — each connection has a different source IP or source port, giving a unique 5-tuple.

**Ephemeral port exhaustion:** A server under high load making many outbound connections (e.g., a proxy) can exhaust the ~28K ephemeral ports to a given destination IP. Fix: increase `ip_local_port_range`, use connection pooling to reuse sockets, distribute across multiple destination IPs.

---

### 2. TCP — The Reliable Stream

TCP (Transmission Control Protocol) provides:
- **Reliable delivery:** every byte eventually arrives or an error is reported
- **Ordered delivery:** bytes arrive in the order sent
- **Bidirectional:** both sides can send simultaneously
- **Flow-controlled:** sender doesn't overwhelm receiver
- **Congestion-controlled:** sender doesn't overwhelm the network

**TCP does NOT provide:**
- Message boundaries (it is a byte stream — you must add your own framing)
- Real-time delivery guarantees (there are retransmissions)
- Multicast (one-to-many)

#### The TCP Segment

A TCP segment consists of a header (20–60 bytes) + payload:

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
├─────────────────────────┬─────────────────────────────────────────┤
│      Source Port        │         Destination Port                │
├─────────────────────────┴─────────────────────────────────────────┤
│                    Sequence Number                                │
├───────────────────────────────────────────────────────────────────┤
│                 Acknowledgement Number                            │
├─────────┬───────┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬───────────────────────────┤
│Data Off │Reserve│C│E│U│A│P│R│S│F│   Window Size                 │
│         │       │W│C│R│C│S│S│Y│I│                               │
│         │       │R│E│G│K│H│T│N│N│                               │
├─────────────────┴─┴─┴─┴─┴─┴─┴─┴─┴───────────────────────────────┤
│             Checksum           │         Urgent Pointer           │
└───────────────────────────────────────────────────────────────────┘

Key flags:
  SYN: synchronize (open connection, exchange initial sequence numbers)
  ACK: acknowledgement number is valid
  FIN: sender has finished sending data (graceful close)
  RST: reset — abort connection immediately
  PSH: push data to application immediately (don't buffer)
```

#### Sequence Numbers and ACKs

Every byte in a TCP stream is numbered. The **sequence number** in a segment's header is the byte number of the first byte in its payload. The **acknowledgement number** is "I have received all bytes up to this number, I'm ready for the next."

```
Client sends: SEQ=100, data="Hello" (5 bytes)
  → bytes 100, 101, 102, 103, 104 are "Hello"

Server replies: ACK=105
  → "I received bytes up to 104. Send me byte 105 next."

Client sends: SEQ=105, data=" World" (6 bytes)
  → bytes 105, 106, 107, 108, 109, 110

Server replies: ACK=111
```

**Initial Sequence Number (ISN):** TCP sequence numbers don't start at 0. The ISN is a random 32-bit number chosen at connection start. This prevents old duplicate segments from a previous connection being confused with the current connection.

---

### 3. The TCP Three-Way Handshake

Before any data is exchanged, TCP requires a **three-way handshake** to establish the connection:

```
Client                                       Server
  │                                            │
  │─────── SYN (SEQ=x) ───────────────────────▶│  Client picks random ISN x
  │        [SYN_SENT]                          │  Server: [SYN_RECEIVED]
  │                                            │
  │◀────── SYN-ACK (SEQ=y, ACK=x+1) ──────────│  Server picks random ISN y
  │                                            │  Acknowledges client's SYN (ACK=x+1)
  │                                            │
  │─────── ACK (ACK=y+1) ─────────────────────▶│  Client acknowledges server's SYN
  │        [ESTABLISHED]                       │  [ESTABLISHED]
  │                                            │
  │═══════ Data can now flow ══════════════════│
```

**Step 1 — SYN:** Client picks a random ISN `x` and sends a segment with SYN flag set and SEQ=x. Client enters `SYN_SENT` state.

**Step 2 — SYN-ACK:** Server receives SYN, picks its own ISN `y`, sends SYN-ACK with SEQ=y, ACK=x+1 (acknowledging the client's SYN). Server enters `SYN_RECEIVED` state. The server's kernel allocates a **half-open connection** (placed on the **SYN backlog queue**).

**Step 3 — ACK:** Client receives SYN-ACK, sends ACK=y+1. Both sides enter `ESTABLISHED`. The kernel moves the connection from the SYN queue to the **accept queue**. The listening application's `accept()` syscall picks it up.

**Why three steps and not two?** You need both sides to confirm each other's ISNs. With only two steps (SYN + SYN-ACK), the client knows the server received its SYN, but the server doesn't know the client received its SYN-ACK (and thus doesn't know the client-to-server direction is reliable). The third ACK confirms the server's SYN was received.

**Cost of the handshake:**
```
Time = 1 RTT (one round trip)
In the same datacenter: ~0.5 ms RTT → 0.5 ms per new connection
Cross-region (US ↔ Europe): ~80 ms RTT → 80 ms per new connection
```

This is why **connection pooling** is essential: amortize the 1 RTT handshake across many requests.

#### What Happens in the Kernel

```
Server kernel during connection establishment:

SYN arrives:
  → kernel creates partial connection entry
  → adds to SYN backlog (size: net.ipv4.tcp_max_syn_backlog)
  → sends SYN-ACK
  → starts SYN-ACK retransmission timer

ACK arrives:
  → kernel finds the partial entry
  → promotes to full socket, adds to accept queue (size: backlog param to listen())
  → wakes any thread blocked in accept()

Application calls accept():
  → removes connection from accept queue
  → returns new file descriptor for the established socket
```

**SYN flood attack:** Attacker sends many SYNs with spoofed source IPs. Server allocates half-open connections until SYN backlog fills. Legitimate SYNs are dropped — denial of service. Mitigation: **SYN cookies** — instead of storing state, the server encodes connection info in the ISN cryptographically. The ACK returns the cookie; only then does the server allocate state.

---

### 4. TCP Reliability: Retransmission

TCP guarantees delivery by requiring acknowledgements for every byte. If an ACK isn't received within the **RTO (Retransmission Timeout)**, TCP retransmits the segment.

#### RTO Calculation

TCP measures **RTT (Round Trip Time)** for each ACK received and uses an exponentially weighted moving average:

```
SRTT (smoothed RTT) = (1 - α) × SRTT + α × RTT_sample   (α = 1/8)
RTTVAR (RTT variance) = (1 - β) × RTTVAR + β × |SRTT - RTT_sample|   (β = 1/4)
RTO = SRTT + 4 × RTTVAR   (min 1 second)
```

On retransmission, RTO **doubles** (exponential backoff) up to a maximum (~60–120 seconds). After enough retransmissions (default: `tcp_retries2 = 15`), TCP gives up and delivers an error to the application.

**Why exponential backoff?** If the network is congested, retransmitting immediately would make it worse. Backoff gives the network time to recover.

#### Fast Retransmit

Waiting for RTO (1+ seconds) is slow. **Fast retransmit** uses duplicate ACKs as a signal:

```
Sender sends: 1, 2, 3, 4, 5
Segment 2 is lost
Receiver gets 1 → ACK=2
Receiver gets 3 → ACK=2 (duplicate: still waiting for 2)
Receiver gets 4 → ACK=2 (duplicate)
Receiver gets 5 → ACK=2 (duplicate)

3 duplicate ACKs → sender retransmits segment 2 immediately (without waiting for RTO)
```

Three duplicate ACKs trigger fast retransmit. This is much faster than waiting for RTO.

#### Selective ACK (SACK)

With basic ACKs, a gap in reception forces retransmission of everything from the gap onward (go-back-N). SACK allows the receiver to say "I have 1, 3, 4, 5 but not 2" — the sender retransmits only the missing segment. SACK is negotiated during the handshake and is on by default on modern OSes.

---

### 5. Flow Control — Receive Window

The **receive window** (rwnd) prevents a fast sender from overwhelming a slow receiver.

Every TCP ACK includes the receiver's current receive window size — how many bytes the sender may have in-flight (sent but not yet ACKed) at any time.

```
Receiver's kernel:
  receive buffer = 1 MB (net.core.rmem_max)
  currently buffered = 200 KB (not yet read by application)
  available = 800 KB

  ACK includes: rwnd = 800 KB
  → sender may have at most 800 KB in-flight

Application reads 400 KB from buffer:
  available = 1,200 KB (but capped at 1 MB)
  ACK includes: rwnd = 1 MB (window opens)
```

**Zero window:** If the receiver's buffer fills (application too slow), rwnd=0. The sender stops sending. It sends periodic **window probes** to check if the window has reopened. This is a natural backpressure mechanism — if your service can't process data fast enough, TCP throttles the sender.

**Receive buffer sizing:** Too small → sender is artificially throttled even with bandwidth available. Too large → OOM under many connections. Linux auto-tunes receive buffers (`net.ipv4.tcp_moderate_rcvbuf`).

---

### 6. Congestion Control

Flow control prevents receiver overflow. **Congestion control** prevents network overflow — preventing the sender from pumping more data into the network than it can handle.

TCP maintains a **congestion window** (cwnd) — a separate limit on how many bytes can be in-flight, based on inferred network capacity.

```
Effective window = min(rwnd, cwnd)
```

#### Slow Start

Connection begins with cwnd = 1 MSS (Maximum Segment Size, typically 1,460 bytes with IPv4 Ethernet). For every ACK received, cwnd increases by 1 MSS:

```
RTT 1: cwnd=1, send 1 segment, receive 1 ACK
RTT 2: cwnd=2, send 2 segments, receive 2 ACKs
RTT 3: cwnd=4 (doubles)
RTT 4: cwnd=8
...
```

Cwnd grows **exponentially** until it reaches `ssthresh` (slow start threshold — initially large, effectively disabled).

**This is called "slow start" but it's actually exponential growth.** The name refers to starting slow (cwnd=1) rather than immediately using full bandwidth.

#### Congestion Avoidance

Once cwnd reaches ssthresh, the growth becomes **additive** (linear):
- For every ACK: cwnd += MSS²/cwnd (approximately 1 MSS per RTT)

This phase explores bandwidth more cautiously.

#### Congestion Events

**Packet loss (3 duplicate ACKs — mild congestion):**
```
TCP Reno:     ssthresh = cwnd/2, cwnd = ssthresh (halve and continue)
TCP CUBIC:    ssthresh = cwnd × 0.7, cwnd = ssthresh, then cubic growth
```

**Timeout (severe congestion):**
```
ssthresh = cwnd/2
cwnd = 1 MSS (restart slow start from 1)
```

The result: TCP throughput over time looks like a sawtooth wave — growing, then backing off on loss, growing again.

```
cwnd
  │            ╱\         ╱\
  │          ╱   \      ╱   \
  │        ╱     drop ╱     drop
  │      ╱           ╱
  │    ╱           ╱
  │  ╱           ╱
  └─────────────────────────── time
     (slow start)→(congestion avoidance)→(loss detected, cwnd reset)
```

**Modern congestion control (BBR — Bottleneck Bandwidth and RTT):** Rather than reacting to loss (loss-based), BBR actively measures bandwidth and RTT to find the optimal sending rate. Used by Google and others. Achieves higher throughput on high-bandwidth-delay-product links (long-distance, satellite).

**Why this matters for distributed systems:** TCP congestion control means that if your network experiences packet loss, ALL TCP connections through that path back off simultaneously. This can cause a correlated latency spike across many services at once — a common production mystery ("all our services slowed down at the same time").

---

### 7. TCP Connection Teardown

A TCP connection is terminated with a **four-way handshake**:

```
Active Close (Client)                        Passive Close (Server)
      │                                            │
      │─────── FIN (SEQ=u) ───────────────────────▶│
      │        [FIN_WAIT_1]                         │  [CLOSE_WAIT]
      │                                            │
      │◀────── ACK (ACK=u+1) ──────────────────────│
      │        [FIN_WAIT_2]                         │  (Server can still send data)
      │                                            │
      │◀────── FIN (SEQ=v) ────────────────────────│
      │                                            │  [LAST_ACK]
      │                                            │
      │─────── ACK (ACK=v+1) ─────────────────────▶│
      │        [TIME_WAIT]                          │  [CLOSED]
      │
      │ (waits 2×MSL = 60–240 seconds)
      │        [CLOSED]
```

**Why TIME_WAIT?**

TIME_WAIT lasts 2×MSL (Maximum Segment Lifetime, typically 30–120 seconds, so TIME_WAIT = 60–240 seconds). Two reasons:

1. **The final ACK may be lost.** If the server's FIN is not ACKed, it will retransmit. The client in TIME_WAIT will resend its ACK. If the client closed immediately, it couldn't respond, and the server would never fully close.

2. **Old duplicate segments.** Stale segments from this connection could be delayed in the network. TIME_WAIT ensures they expire (TTL-limited) before a new connection with the same 5-tuple is allowed. Without TIME_WAIT, a new connection could receive old data from a previous connection.

**TIME_WAIT in production:** A server that handles many short-lived connections (HTTP/1.0 without keep-alive) will accumulate thousands of sockets in TIME_WAIT. These consume OS resources (kernel memory per socket, port numbers). Solutions:
- `SO_REUSEADDR`: allows binding to a port even if it has TIME_WAIT sockets (safe — different 5-tuples)
- `tcp_tw_reuse`: reuse TIME_WAIT sockets for new connections (client-side, with timestamp check)
- HTTP keep-alive / connection pooling: reduce connection churn

---

### 8. TCP Failure Modes Engineers Encounter

#### RST (Reset)

A **RST segment** abruptly terminates a TCP connection — no graceful FIN exchange. The receiving end immediately closes the socket; in-flight data is discarded.

**When RSTs are sent:**
- Application calls `close()` with data still in the receive buffer (`SO_LINGER` with linger=0)
- Firewall or load balancer decides the connection is stale and kills it
- Server process dies and the OS sends RST for all its connections
- Packet arrives for a port that has no listener: OS sends RST
- NAT mapping expired: new packet arrives, NAT has no mapping → RST

**From the application:** RST appears as a `Connection reset by peer` IOException or `ECONNRESET` error. The connection is gone. The application must handle this — reconnect, retry the request if safe, or report the error.

#### Half-Open Connections

A **half-open connection** exists when one side has crashed without sending FIN or RST, and the other side doesn't know.

```
Client ─── ESTABLISHED ─── Server
             (server crashes — no FIN sent)

Client:  thinks connection is ESTABLISHED
Server:  doesn't exist anymore (restarted, no memory of connection)

Client sends data → Server replies with RST
  → connection finally detected as broken

How long until client tries to send? → Could be hours (keep-alive disabled)
```

**TCP keep-alive** sends periodic probes to detect half-open connections:
- `SO_KEEPALIVE` + `tcp_keepalive_time` (default: 2 hours!) + `tcp_keepalive_intvl` (75s) + `tcp_keepalive_probes` (9 probes)
- After 9 × 75 seconds of no response: connection declared dead

**2 hours is too long for most services.** Application-level heartbeats (PING/PONG) or configuring keep-alive at 30–60 seconds is standard for long-lived connections (WebSockets, database connections, gRPC streams).

#### Connection Pool Exhaustion

A connection pool maintains N pre-established TCP connections. When all N are in use, new requests must wait (or fail).

```
DB connection pool: 10 connections
10 requests active, each holding a connection

Request 11 arrives:
  → waits for a connection to become available
  → if wait > timeout → "connection pool exhausted" error

Under sustained overload:
  → all 10 connections busy
  → queue of waiting requests grows
  → latency explodes
  → eventually OOM or cascading failure
```

**Root causes of exhaustion:**
- Slow downstream (DB query takes 5s instead of 5ms → each connection held 1,000× longer)
- Connection leak (borrowed but never returned)
- Pool size too small for traffic level

**Diagnosis:** Metrics: `db.pool.active`, `db.pool.pending`, `db.pool.wait_time`. Thread dumps: threads blocked in pool acquire. Logs: "Timeout waiting for connection from pool."

#### Sliding Window and Buffer Bloat

Modern networks with large TCP buffers and optimistic bandwidth can be fooled into buffering enormous amounts of data in intermediate network equipment ("buffer bloat"). This causes latency to spike when links are saturated — data is queued in buffers rather than being dropped. From the application's perspective: latency grows linearly with load rather than requests being rejected at the capacity limit.

**Impact:** A service that appears to handle load fine (low error rate) can have p99 latency explode to seconds when approaching saturation — the data is buffered in network queues rather than rejected with RST.

---

### 9. Sockets — The Programming Interface

A **socket** is the OS abstraction for network I/O. Creating a TCP connection:

```c
// Server side:
server_fd = socket(AF_INET, SOCK_STREAM, 0);   // create TCP socket
bind(server_fd, &addr, sizeof(addr));           // bind to port 8080
listen(server_fd, backlog);                     // start listening, backlog = accept queue size
client_fd = accept(server_fd, &client_addr, &len); // block until connection arrives
read(client_fd, buf, sizeof(buf));              // read data from client
write(client_fd, response, response_len);       // send response
close(client_fd);                               // close connection

// Client side:
client_fd = socket(AF_INET, SOCK_STREAM, 0);
connect(client_fd, &server_addr, sizeof(server_addr)); // TCP 3-way handshake
write(client_fd, request, request_len);
read(client_fd, buf, sizeof(buf));
close(client_fd);
```

**Important socket options:**
- `SO_REUSEADDR`: allow binding to port even if TIME_WAIT sockets exist
- `SO_KEEPALIVE`: enable TCP keep-alive
- `TCP_NODELAY`: disable Nagle's algorithm (send segments immediately, not batched)
- `SO_SNDBUF` / `SO_RCVBUF`: override default send/receive buffer sizes
- `SO_LINGER`: control what `close()` does with unsent data

**Nagle's Algorithm:** To reduce network overhead from small packets, Nagle's algorithm holds small data segments until either the segment fills to MSS size or an ACK is received. This is terrible for request-response protocols (adds latency waiting to batch). Always disable with `TCP_NODELAY` for low-latency services. Redis, PostgreSQL, and most HTTP servers do this.

---

### 10. UDP — The Unreliable Datagram

**UDP (User Datagram Protocol)** provides unreliable, unordered, connectionless datagram delivery. No handshake. No acknowledgements. No retransmission. No flow control. No congestion control.

```
Application calls sendto() → UDP header added → IP packet sent
Packet may: arrive, be lost, be duplicated, arrive out of order
Receiver calls recvfrom() → gets whatever arrived, or blocks
```

**Why UDP exists:**

| Reason | Example |
|--------|---------|
| Lower latency (no handshake) | DNS queries (one packet round trip, not 1.5 RTT) |
| Multicast/broadcast | Service discovery (mDNS, SSDP) |
| Tolerance of loss (not of delay) | Real-time audio/video (old frame is useless; retransmit would arrive too late) |
| Application-level reliability | Games (client-side prediction + server reconciliation is better than TCP's delay) |
| Building custom protocols | QUIC (builds reliability over UDP, without TCP's limitations) |

**UDP header (8 bytes):**
```
┌───────────────────────┬───────────────────────┐
│    Source Port        │   Destination Port    │
├───────────────────────┼───────────────────────┤
│      Length           │       Checksum        │
└───────────────────────┴───────────────────────┘
```

**Why DNS uses UDP:** A DNS query is typically a single small packet. The answer is also a single small packet. UDP avoids the 1 RTT handshake overhead. If the response doesn't arrive, DNS retries (application-level retry over UDP). For large responses (DNSSEC), DNS falls back to TCP.

**Why streaming video uses UDP (or RTP over UDP):** A lost video frame is better replaced by interpolation from adjacent frames than by waiting for a TCP retransmit that arrives 100ms later (too late to display in sync). The application handles loss gracefully.

---

### 11. QUIC — The Modern Transport Protocol

**QUIC** is a transport protocol built by Google, standardized as RFC 9000 (HTTP/3 uses QUIC). It runs over UDP but implements TCP-like reliability with significant improvements.

**Why TCP has limitations that QUIC addresses:**

| TCP limitation | QUIC solution |
|----------------|---------------|
| 1 RTT handshake + 1 RTT TLS = 2 RTT before data | Combined transport + TLS handshake = 1 RTT (0-RTT resumption possible) |
| Head-of-line blocking: one lost packet blocks all streams | Multiplexed streams — a loss in stream 1 doesn't block stream 2 |
| Connection identified by 5-tuple | Connection ID in header — survives IP/port changes (mobile roaming) |
| Cannot update TCP in OS kernel (deployment ossification) | Runs in user space (updateable like any application) |

**QUIC connection setup:**
```
Client                                  Server
  │─── QUIC Initial (ClientHello) ──────▶│
  │◀── QUIC Initial (ServerHello) ───────│
  │◀── QUIC Handshake (TLS certs) ───────│  ← 1 RTT: connection + TLS together
  │─── QUIC Handshake (Finished) ────────▶│
  │═══════ Data streams open ════════════│

0-RTT resumption (subsequent connections):
  │─── 0-RTT data + ClientHello ─────────▶│  ← data before handshake complete!
```

**Stream multiplexing:**
```
One QUIC connection carries multiple logical streams:
  Stream 1: HTTP request A  ─┐
  Stream 2: HTTP request B  ─┼─ all multiplexed over one UDP connection
  Stream 3: HTTP request C  ─┘

Loss of a UDP packet affects only the stream(s) whose data was in that packet.
Other streams continue without blocking.
```

Compare to HTTP/2 over TCP: HTTP/2 multiplexes streams over one TCP connection, but a lost TCP segment blocks ALL streams (TCP head-of-line blocking at the transport layer).

**Where QUIC is deployed:** HTTP/3 (most major websites including Google and Cloudflare), QUIC-based video streaming, internal service communication (gRPC over QUIC is being developed).

**QUIC in distributed systems:** For services with many short-lived requests over long-distance connections (CDN, cross-region), QUIC's 0-RTT and no HOL blocking provide meaningful latency improvements. For local datacenter traffic (sub-ms RTT), the benefits are smaller.

---

### 12. Sliding Windows in Detail

The **sliding window** is the mechanism that allows TCP to have multiple unacknowledged segments in flight simultaneously — achieving high throughput on high-latency links.

```
Without sliding window (stop-and-wait):
  Send 1 segment → wait for ACK → send 1 segment → wait → ...
  Utilization = segment_time / (segment_time + RTT) ≈ tiny on high-latency links

With sliding window (N segments in flight):
  Send N segments → as each ACK comes in, slide window and send more
  Utilization = min(1, window_size / (bandwidth × RTT))
```

**Bandwidth-delay product:** The amount of data that can be "in flight" on a link at any time.

```
Example:
  Bandwidth = 1 Gbps = 125 MB/s
  RTT = 100 ms (intercontinental)

  BDP = 125 MB/s × 0.1 s = 12.5 MB

  → To fully utilize this link, the TCP window must be ≥ 12.5 MB
  → Default Linux socket buffer = 128 KB ← 100× too small!
  → Need to tune: net.core.rmem_max, net.ipv4.tcp_rmem
```

**Window scaling:** TCP's 16-bit window field allows a max of 64 KB. The **Window Scale option** (negotiated in handshake) allows scaling by powers of 2 up to 2¹⁴, enabling windows up to 1 GB.

---

## Step-by-Step Execution

### Complete Trace: One HTTP Request Over a New TCP Connection

```
Frame 1: Your Go/Java/Python code calls http.Get("http://10.0.0.2:8080/api/users")

Frame 2: HTTP library resolves host — no DNS needed (IP literal)
  Creates socket: socket(AF_INET, SOCK_STREAM, 0) → fd=7

Frame 3: connect(fd, {10.0.0.2, port 8080})
  Kernel picks ephemeral source port: 54321
  Sends SYN packet: src=10.0.0.1:54321, dst=10.0.0.2:8080, SEQ=123456, SYN=1
  Socket enters SYN_SENT state
  connect() blocks (kernel)

Frame 4: SYN-ACK arrives from server
  src=10.0.0.2:8080, dst=10.0.0.1:54321, SEQ=789012, ACK=123457, SYN=1, ACK=1
  Kernel sends ACK: SEQ=123457, ACK=789013
  Socket enters ESTABLISHED state
  connect() returns 0 (success)

Frame 5: HTTP library constructs request bytes:
  "GET /api/users HTTP/1.1\r\nHost: 10.0.0.2:8080\r\n\r\n"
  Calls write(fd, request, len)
  Kernel places bytes in send buffer
  TCP sends segment(s) (may be one segment if small enough)

Frame 6: Server receives request data
  TCP delivers bytes to server's socket receive buffer
  Server application reads from socket
  Application processes request (queries database, etc.)
  Application writes HTTP response to socket

Frame 7: Response segments arrive at client
  TCP ACKs each received segment
  Kernel assembles byte stream in receive buffer

Frame 8: Client read() returns response bytes
  HTTP library parses status line, headers, body

Frame 9: Client calls close(fd)
  Kernel sends FIN
  Server receives FIN, sends ACK, processes remaining data if any, sends FIN
  Client receives FIN, sends ACK, enters TIME_WAIT (60-240s)

Total time for new connection: 1 RTT (handshake) + 1 RTT (request-response)
If connection is reused (keep-alive): 1 RTT only for the request-response
```

---

## Deep Dive

### TCP in the Kernel (Linux)

When a TCP segment arrives:

```
NIC → DMA packet to ring buffer → Hardware interrupt → Softirq handler
  → __netif_receive_skb() → IP layer
  → TCP protocol handler (tcp_v4_rcv())
  → Find socket by 5-tuple lookup (hash table)
  → tcp_rcv_established():
      → Validate sequence numbers
      → Update receive window
      → Place data in socket receive buffer (sk_buff)
      → Send ACK (immediate or delayed by 40ms — delayed ACK)
      → If data available: wake up any thread blocked in read()
```

**Delayed ACKs:** Linux waits up to 40ms to send an ACK, hoping to piggyback it on outgoing data (if the application is about to respond). This can add 40ms latency to request-response protocols. Fix: set `TCP_QUICKACK` socket option for latency-sensitive connections.

### The Accept Queue and the Listen Backlog

```
Server calls listen(fd, backlog=128):
  Kernel maintains two queues:
    1. SYN queue (incomplete connections): SYN received, SYN-ACK sent, awaiting final ACK
       Size: net.ipv4.tcp_max_syn_backlog (default 1,024)
    2. Accept queue (complete connections): handshake done, awaiting accept()
       Size: min(backlog, net.core.somaxconn) (default 128)

If accept queue is full when a connection completes:
  → The connection is dropped (or SYN-ACK not sent → client retries)
  → Client sees: connection timeout (no RST — just silence)
```

**A common production bug:** A service starts slowly. Connections queue up in the accept queue. Queue fills (128 connections). New connection attempts are dropped. Clients see timeouts — but the service looks healthy (CPU at 5%, no errors in logs). Diagnosis: `ss -lnt` shows `Recv-Q` (accept queue fill) > 0 near the backlog limit. Fix: increase `net.core.somaxconn` and the `backlog` parameter.

---

## Real-World Example

### Why Connection Pooling is Non-Negotiable for Database Clients

Scenario: a Java service makes a database call per request. Database is on the same datacenter, RTT = 0.3ms.

**Without connection pooling (new connection per request):**
```
Cost breakdown per request:
  TCP handshake: 1 RTT = 0.3ms
  TLS handshake (if TLS to DB): 1–2 RTT = 0.3–0.6ms
  PostgreSQL auth handshake: 1–2 RTT = 0.3–0.6ms
  Actual query: 1 RTT = 0.3ms
  TCP teardown: 1 RTT = 0.3ms
  Total overhead: ~1.5–2.1ms BEFORE any query work

At 10,000 RPS:
  Connection setup/teardown cost: 10,000 × 2ms = 20 seconds of connection work per second
  With a 4-core server: impossible (20 seconds of work on 4 cores)

Also: TIME_WAIT accumulation
  At 10,000 RPS × 240s TIME_WAIT = 2.4M sockets in TIME_WAIT state
  Each socket: ~4KB kernel memory → 9.6 GB just for TIME_WAIT sockets!
```

**With connection pooling (10 persistent connections):**
```
Connections established once at startup (10 × 2ms = 20ms, one-time cost)
Each request reuses an existing connection: only the query RTT (0.3ms)
10,000 RPS × 0.3ms = 3 seconds of query work per second (achievable)
Zero TIME_WAIT accumulation
```

**This is why every production database client library uses connection pooling.** The numbers make it non-optional.

---

## Failure Scenarios

### Scenario 1: Network Partition Looks Like a Timeout, Not an Error

```
Service A ─────────────── ESTABLISHED ─────────────── Service B
                   (network partition occurs)

Service A tries to send data:
  → data sits in send buffer
  → TCP retransmits (RTO = 1s initially)
  → retries: 1s, 2s, 4s, 8s, 16s, 32s...
  → after tcp_retries2 (15 retries, ~13-30 minutes): connection declared dead
  → Application receives ETIMEDOUT

Service B:
  → receives nothing
  → thinks connection is ESTABLISHED (half-open)
  → will eventually detect via keep-alive (default: 2 hours!) or application heartbeat
```

**The danger:** Without application-level timeouts, Service A waits 13–30 minutes before discovering the partition. During that time, its thread (or goroutine) is blocked. Under load, all threads exhaust. **Network partitions are not clean failures** — they look like extreme latency until the OS gives up.

**Fix:** Set application-level read/write timeouts far shorter than TCP's defaults. A typical microservice should have: connect timeout 1–3s, read timeout 5–30s, write timeout 5–30s.

### Scenario 2: Accept Queue Overflow Under Traffic Spike

```
Service normally handles 1,000 RPS, accept queue backlog = 128

Traffic spike: 5,000 RPS in 1 second
Service's accept() loop can't keep up (processing existing requests)
Accept queue fills: 128 pending connections

Connections #129 onwards:
  → three-way handshake completes in kernel
  → kernel tries to move to accept queue: FULL → DROP
  → client sent ACK, thinks connection established
  → client sends HTTP request → server ignores it (no socket)
  → client waits → read timeout → retry
  → retry hits same overloaded server → cascade
```

**Symptom:** Clients see timeouts that aren't correlated with any server-side error. `ss -lnt` shows `Recv-Q` capped at backlog value.

---

## Performance Considerations

### TCP Tuning Parameters That Matter in Production

```bash
# Increase accept queue max
net.core.somaxconn = 65535

# Increase SYN backlog
net.ipv4.tcp_max_syn_backlog = 65535

# Enable SYN cookies (DDoS protection)
net.ipv4.tcp_syncookies = 1

# Reuse TIME_WAIT sockets (client-side)
net.ipv4.tcp_tw_reuse = 1

# Reduce FIN-WAIT-2 timeout
net.ipv4.tcp_fin_timeout = 15

# Increase socket buffer sizes for high-bandwidth links
net.core.rmem_max = 134217728    # 128 MB
net.core.wmem_max = 134217728
net.ipv4.tcp_rmem = 4096 87380 134217728
net.ipv4.tcp_wmem = 4096 65536  134217728

# Enable TCP BBR congestion control
net.ipv4.tcp_congestion_control = bbr
```

### Throughput vs Latency on TCP

- **Nagle's Algorithm:** batches small writes for throughput → adds up to 40ms latency per small message. Disable with `TCP_NODELAY`.
- **Delayed ACKs:** waits 40ms to batch ACKs → adds latency to request-response. Use `TCP_QUICKACK`.
- **Large receive/send buffers:** allow more in-flight data → higher throughput → but more memory per connection at scale.

---

## Trade-offs

| Mechanism | Benefit | Cost |
|-----------|---------|------|
| TCP reliability | Every byte arrives or error detected | Retransmission adds latency; congestion control reduces throughput |
| Three-way handshake | Security (ISN exchange, no spoofing) | 1 RTT overhead per new connection |
| TIME_WAIT | Correctness (no stale segment confusion) | Port exhaustion under high churn |
| Congestion control | Network stability | Reduced throughput, sawtooth pattern |
| Flow control (rwnd) | Protects slow receivers | Can throttle fast senders |
| Connection pooling | Eliminates per-request handshake cost | State management, max connection limits |
| UDP | Zero overhead | No reliability, ordering, or flow control |
| QUIC | 0-RTT, no HOL blocking | UDP traversal complexity, CPU cost of encryption |

---

## Alternatives

| Need | Option | Trade-off |
|------|--------|-----------|
| Low latency small messages | UDP | No reliability |
| High-frequency bidirectional | WebSockets (TCP) | Long-lived connection state |
| Multiplexed streams over one connection | HTTP/2 (TCP) or HTTP/3 (QUIC) | HOL blocking on TCP |
| Zero-copy kernel bypass | DPDK (bypasses TCP/kernel entirely) | Extreme complexity, not general-purpose |
| Custom reliability | QUIC or SCTP | Implementation complexity |

---

## Production Considerations

1. **Always set application-level timeouts.** TCP's defaults (minutes to hours) are too long for distributed services. Set connect timeout (1–3s), read timeout (5–30s), and write timeout.
2. **Use connection pooling for all DB and service-to-service calls.** A new TCP + TLS connection costs 2–4 RTTs. At datacenter RTTs of 0.3ms, that's 1–2ms of overhead per request — unacceptable at scale.
3. **Monitor `ss -s` and `netstat -s` in production.** Look for: segments retransmitted (congestion), failed connection attempts, ESTABLISHED count growing unbounded (connection leaks).
4. **Disable Nagle's algorithm (`TCP_NODELAY`) for RPC services.** Nagle batches small writes — adds latency to request-response protocols. Almost every serious RPC library does this by default; verify yours does too.
5. **Tune `net.core.somaxconn` on servers.** Default 128 is dangerously low for any service handling traffic spikes. Set to 65535.
6. **`TIME_WAIT` is normal — don't fight it.** It is a correctness mechanism. On the server side, `SO_REUSEADDR` handles it. On the client side, `tcp_tw_reuse` is safe. Never set `tcp_tw_recycle` (removed in Linux 4.12 — it broke NAT'd clients).

---

## Common Beginner Mistakes

1. **Assuming `write()` and `read()` correspond 1:1 on TCP.** TCP is a byte stream. One `write(100_bytes)` may be received as two `read(50_bytes)` calls. Always frame your protocol (length prefix, delimiter).
2. **Not setting timeouts on sockets.** Forgetting to set a read timeout means a dead server can cause your client thread to block forever.
3. **Opening a new TCP connection per request.** Correct but catastrophically slow at scale. Always pool connections.
4. **Ignoring `ECONNRESET` as "just noise."** A RST means the connection was abruptly terminated — the server crashed, a firewall killed the connection, or a NAT mapping expired. It requires reconnection and careful retry logic (was the request processed before the reset?).
5. **Confusing a TCP timeout with a request timeout.** TCP's retransmission timeout is when the OS gives up sending. An application-level timeout is when your code gives up waiting. Set both; the application timeout should always be shorter.

---

## Common Senior Engineer Mistakes

1. **Setting the connection pool size equal to the thread pool size.** This seems logical but wastes connections — not every thread uses a DB connection at the same time. Start with 10–20 connections and scale based on metrics.
2. **Forgetting keep-alive configuration for long-lived connections.** WebSocket connections, gRPC streams, and database connections behind NAT get silently dropped after 30–60 minutes without keep-alive or heartbeats.
3. **Not accounting for `TIME_WAIT` when planning for high connection churn.** 10K RPS × 60s TIME_WAIT = 600K sockets in TIME_WAIT. At 4KB each: 2.4 GB kernel memory just for closed connections.
4. **Treating network errors as always transient.** A `ECONNREFUSED` (RST on connect) means nothing is listening on that port. Retrying blindly is useless. A `ETIMEDOUT` on connect may indicate the host is down — exponential backoff is needed.

---

## Architecture Smells

- Services using HTTP/1.0 (no keep-alive) for inter-service calls → connection churn, TIME_WAIT accumulation
- Connection pool sized to 1 (effectively no pooling) → serialized requests, poor concurrency
- No read timeout configured → a slow downstream causes thread starvation
- Connect timeout > 10 seconds → service unavailability takes too long to detect
- High `TCPRetransSegs` in `netstat -s` → network packet loss, congestion

---

## Principal Engineer Perspective

A Principal Engineer sees TCP as a **lease on a network path** that has a cost (handshake), a capacity limit (window), a reliability guarantee (retransmission), and failure modes (timeout, RST, HOL blocking).

**What junior engineers miss:** They think "I make an HTTP call, I get a response." They don't know a new connection costs 1–2 RTTs, that the network might drop 1% of packets causing retransmissions, or that a 30-second TCP timeout is holding threads when a 5-second application timeout would release them faster.

**What senior engineers miss:** They know TCP details but don't connect them to system design. They don't think about how TCP congestion control's sawtooth throughput affects streaming workloads, or how NAT timeout + no keep-alive causes silent connection drops at 30 minutes.

**Principal insights:**

1. **Connection establishment cost is a fixed tax per connection.** The architecture must minimize connection churn (keep-alive, pooling, long-lived streams) or pay the RTT tax per request.

2. **Network partitions appear as extreme latency, not clean errors.** Design your timeout budgets with this in mind. A service that cannot tell "downstream is slow" from "downstream is partitioned" will make wrong decisions (keep retrying, not circuit-break).

3. **TCP congestion control is collective.** A congested network causes *all* TCP connections to back off simultaneously. This creates correlated latency spikes across services that look like a service-level incident but are a network incident. Distributed systems must be designed to survive correlated slowdowns, not just independent failures.

4. **Head-of-line blocking limits HTTP/2 in lossy networks.** Over low-loss datacenter networks, HTTP/2 multiplexing is excellent. Over lossy links (cross-region, internet-facing), a single packet loss stalls all streams. QUIC (HTTP/3) solves this. Know your network characteristics before choosing a protocol.

---

## Architecture Review Questions

1. How many new TCP connections does this service open per second? What is the cumulative overhead of those handshakes?
2. What is the connection pool size for each downstream dependency? How was that size determined?
3. What happens to requests when the connection pool is exhausted? Are they queued? For how long?
4. What are the configured timeouts for each external dependency? Connect timeout? Read timeout? Write timeout?
5. Does this service have any long-lived connections (WebSocket, gRPC streams, DB connections)? Are keep-alive or heartbeats configured?
6. What is the `net.core.somaxconn` setting on this service's hosts? Is it appropriate for the expected connection rate?
7. If the network between Service A and Service B is partitioned, how long until Service A detects it and reports an error?
8. Does this service use `TCP_NODELAY`? If not, what is the maximum latency impact of Nagle's algorithm on its p99?
9. What happens to in-flight requests if a downstream service crashes (RST is sent)? Are they retried? Is retry safe (idempotent)?
10. Under a 10× traffic spike, which TCP-level resource exhausts first: ephemeral ports, accept queue, connection pool?

---

## Visual / Animation Specification

### Animation 1: TCP Three-Way Handshake

**Frame 1:** Client (left) and Server (right). Server shows `listen()` call. Accept queue shown empty.

**Frame 2:** Client sends SYN packet (animated arrow). Label: SYN, SEQ=x. Client state: `SYN_SENT`.

**Frame 3:** Server receives SYN, adds to SYN queue. Sends SYN-ACK (animated arrow back). Label: SYN-ACK, SEQ=y, ACK=x+1. Server state: `SYN_RECEIVED`.

**Frame 4:** Client receives SYN-ACK. Sends ACK (arrow). Label: ACK, ACK=y+1. Client state: `ESTABLISHED`.

**Frame 5:** Server receives ACK. Moves connection from SYN queue to Accept queue. Server state: `ESTABLISHED`. `accept()` returns.

**Frame 6:** Show data flowing bidirectionally. Sequence numbers incrementing with each segment.

### Animation 2: TCP Retransmission

**Frame 1:** Sender sends segments 1, 2, 3, 4, 5. All en route.

**Frame 2:** Segment 2 is dropped (animated X). Segments 1, 3, 4, 5 arrive at receiver.

**Frame 3:** Receiver sends ACK=2 (got 1). Then ACK=2 again (got 3 out of order). Then ACK=2 (got 4). Then ACK=2 (got 5). Four arrows showing duplicate ACKs.

**Frame 4:** "3 duplicate ACKs → Fast Retransmit!" Sender retransmits segment 2 immediately.

**Frame 5:** Segment 2 arrives. Receiver delivers 2, 3, 4, 5 in order. Sends ACK=6.

---

## Hands-On Tutorial

### Observing TCP State with `ss`

```bash
# Show all TCP connections with state
ss -tno

# Show listening sockets and queue depths
ss -lnt
# Recv-Q = current accept queue fill
# Send-Q = backlog limit

# Watch connections accumulate under load
watch -n 0.5 'ss -s'

# See TIME_WAIT count
ss -tno state time-wait | wc -l

# See TCP retransmission statistics
netstat -s | grep -i retran
```

### Simulating TCP Network Issues with `tc`

```bash
# Add 100ms latency to outgoing traffic (simulate cross-region)
sudo tc qdisc add dev eth0 root netem delay 100ms

# Add 1% packet loss
sudo tc qdisc add dev eth0 root netem loss 1%

# Add latency + loss + jitter
sudo tc qdisc add dev eth0 root netem delay 50ms 10ms loss 0.5%

# Remove the rule
sudo tc qdisc del dev eth0 root
```

**Exercise:** Add 1% packet loss between two services. Measure p99 latency before and after. Observe TCP retransmission counts in `netstat -s`. See how congestion control affects throughput.

### Observing Connection Pool Behaviour

```java
// HikariCP (common Java DB connection pool) metrics
HikariPoolMXBean pool = dataSource.getHikariPoolMXBean();
System.out.println("Active connections: "    + pool.getActiveConnections());
System.out.println("Idle connections: "      + pool.getIdleConnections());
System.out.println("Total connections: "     + pool.getTotalConnections());
System.out.println("Threads awaiting conn: " + pool.getThreadsAwaitingConnection());
```

**Exercise:** Set pool size to 2. Send 20 concurrent requests each taking 100ms. Observe `ThreadsAwaitingConnection` spike. Measure latency histogram. Then set pool to 20 and repeat.

---

## Failure Injection Lab

### Lab: Network Partition Between Services

1. Run two services (A calls B). Confirm baseline latency: 5ms.
2. Add iptables rule to drop all packets from A to B:
   ```bash
   sudo iptables -A OUTPUT -d <service_B_IP> -j DROP
   ```
3. Send request from A to B.
4. **Observe:** A blocks. No immediate error. Watch TCP retransmit in `netstat -s`.
5. **Measure:** how long until A's application-level read timeout fires? How long until TCP gives up (if no application timeout set)?
6. **Remove rule:** `sudo iptables -D OUTPUT -d <service_B_IP> -j DROP`
7. **Verify** A recovers and reconnects.
8. **Fix:** ensure A has a 5-second read timeout. Re-inject partition. Measure detection time: exactly 5 seconds now.

---

## Exercises

**Conceptual:**
1. Why does TCP use a three-way handshake instead of a two-way handshake?
2. What is the purpose of TIME_WAIT? Why does it last 2×MSL?
3. Explain why a network partition looks like a timeout rather than an immediate error from the application's perspective.
4. What is the bandwidth-delay product? Calculate it for a 10 Gbps link with 50ms RTT.
5. Why does Nagle's algorithm hurt latency for request-response protocols?

**Architecture:**
6. A service makes 1,000 RPS to a downstream API. The downstream API is on the same datacenter (RTT 0.3ms). The service uses no connection pooling (new connection per request). Estimate the overhead of connection setup/teardown per second in milliseconds of CPU work.
7. Your gRPC service handles 50,000 concurrent streams over 100 TCP connections (HTTP/2 multiplexing). The network between your service and clients has 0.5% packet loss. What problem will you observe? Would HTTP/3 (QUIC) help?
8. Design the timeout strategy for a service that calls three upstream services sequentially, each with p99 latency of 50ms. The overall SLO is p99 < 200ms. How do you set timeouts for each call?

**Quantitative:**
9. A TCP connection has cwnd=10 MSS (14,600 bytes). RTT is 20ms. Bandwidth available is 1 Gbps. What is the effective throughput on this connection?
10. A server has `net.core.somaxconn = 128` and receives 500 connections/second during a spike. Each connection takes 10ms to process. How quickly does the accept queue fill up?

---

## Solutions

### Exercise 4
BDP = bandwidth × RTT = 10 Gbps × 0.05s = 10 × 10⁹ bits/s × 0.05s = 500 × 10⁶ bits = **62.5 MB**. To fully utilize a 10 Gbps link at 50ms RTT, the TCP window must be at least 62.5 MB. Default Linux socket buffers (~128KB) would achieve only 128KB / 62.5MB ≈ **0.2% link utilization** without tuning.

### Exercise 9
Effective throughput = cwnd / RTT = 14,600 bytes / 0.020s = **730 KB/s ≈ 5.8 Mbps**. The 1 Gbps bandwidth is irrelevant — the bottleneck is the window size divided by RTT. To achieve 1 Gbps, cwnd would need to be 1 Gbps × 0.020s / 8 = **2.5 MB**.

### Exercise 10
During the spike, connections arrive at 500/s, each taking 10ms. Connections completing handshake per second = 500. Rate of `accept()` calls the application can handle = 1/10ms = 100/s. Queue accumulates at 500 - 100 = **400 connections/second**. At backlog=128: queue fills in 128/400 = **0.32 seconds**. After that, new connections are dropped.

---

## Interview Questions

### Beginner
- What is the difference between TCP and UDP?
- What is a port? What is a socket?
- What is the purpose of the TCP three-way handshake?

### Senior
- Explain TCP congestion control: slow start, congestion avoidance, and what happens on packet loss.
- What is TIME_WAIT and why does it exist? What problems does it cause in production?
- A service has `ECONNRESET` errors in production. What are the possible causes?
- What is connection pooling and why is it necessary for database clients?

### Staff
- Explain how a network partition manifests at the TCP layer vs the application layer.
- What is the bandwidth-delay product? Why does it matter for high-throughput services?
- Compare HTTP/2 over TCP vs HTTP/3 over QUIC for a service with high packet loss. When would you choose QUIC?
- Design the timeout strategy for a microservice that calls five downstream dependencies with varying latency profiles.

### Principal
- Your service has p99 latency of 2ms locally but 200ms cross-region. What TCP-level factors contribute to this difference? How would you architect the service to reduce cross-region latency?
- A production incident shows all services slowed down simultaneously for 30 seconds. Monitoring shows no service errors, only latency increases. What TCP-level phenomenon could cause this? How do you investigate?
- You are designing a protocol for 10M concurrent IoT device connections to a single endpoint. Evaluate TCP vs QUIC vs a custom UDP protocol. What TCP-level constraints would prevent TCP from scaling?
- Explain how TCP's congestion control contributes to correlated latency spikes across microservices during network congestion. How would you design a distributed system to be resilient to these correlated events?

---

## Summary

The network is the physical medium through which all distributed coordination flows:

- **IP** routes packets between hosts — unreliably, best-effort, across any topology
- **TCP** builds a reliable, ordered, bidirectional byte stream over IP via: three-way handshake (1 RTT, ISN exchange), sequence numbers + ACKs, retransmission (RTO + fast retransmit), flow control (receive window), and congestion control (slow start + AIMD)
- **Connection cost:** 1 RTT handshake — non-negotiable, must be amortized via connection pooling
- **TIME_WAIT:** a correctness guarantee that causes operational problems at high connection churn rates
- **Common failures:** RST (abrupt termination), half-open (crash without FIN), accept queue overflow (spike traffic), pool exhaustion (slow downstream)
- **Network partitions look like timeouts** — TCP retries for 13–30 minutes by default, not seconds
- **UDP** offers raw datagram delivery — used when loss is tolerable (DNS, video) or when custom reliability is needed (QUIC)
- **QUIC** combines transport + TLS handshake (1 RTT), eliminates head-of-line blocking, survives IP changes

---

## What You Should Now Be Able To Explain

- ✅ What happens in the kernel during a TCP three-way handshake
- ✅ Why connection pooling eliminates ~2ms overhead per request in a datacenter
- ✅ Why a network partition doesn't immediately look like an error
- ✅ What sequence numbers and ACKs achieve and how retransmission works
- ✅ Why TIME_WAIT exists and what operational problems it causes
- ✅ When to use UDP over TCP and what you give up
- ✅ What QUIC improves over TCP and why it's built on UDP

---

## What To Learn Next

**Chapter 4 — DNS, HTTP & TLS.** You now understand the transport layer (TCP/UDP). The next layer up is the application protocols your services actually speak. DNS tells your service where to find other services. HTTP defines the request-response structure. TLS encrypts everything between them. Together, these are the complete picture of what happens before your service handler even sees the first byte of a request — a journey your code takes thousands of times per second.
