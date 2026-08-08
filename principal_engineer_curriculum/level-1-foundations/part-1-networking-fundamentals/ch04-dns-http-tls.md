# Chapter 4 — DNS, HTTP & TLS

## Difficulty
Intermediate → Advanced

## Importance
**Must Know** — DNS, HTTP, and TLS are the three application-layer protocols that every distributed service speaks before a single byte of your business logic is executed. DNS is how services find each other. HTTP is how they communicate. TLS is how they communicate securely. Misunderstanding any of these causes production failures that look mysterious until you trace them to their root.

## Prerequisites
Chapter 3 — Network Layers, TCP & UDP (sockets, TCP handshake, connection lifecycle)

## Learning Objectives

By the end of this chapter you will be able to:

1. Describe the DNS resolution process end-to-end: recursive resolver → root → TLD → authoritative, with caching at each layer.
2. Explain DNS TTL, caching, negative caching, and the failure modes each introduces.
3. Describe DNS-based load balancing and service discovery — and their limitations.
4. Explain the evolution HTTP/1.0 → HTTP/1.1 → HTTP/2 → HTTP/3 and the specific problem each version solved.
5. Explain HTTP/2 multiplexing, header compression, and server push — and their trade-offs.
6. Describe what happens during a TLS 1.3 handshake step by step.
7. Explain mTLS (mutual TLS) — what it provides and how it differs from one-way TLS.
8. Connect all three protocols to distributed systems failure modes: stale DNS, connection reuse under TLS, certificate expiry, HTTP/2 HOL blocking.

## Why This Matters

Every time Service A calls Service B:

```
Service A ──DNS lookup──▶ IP of B ──TCP handshake──▶ ──TLS handshake──▶ ──HTTP request──▶ Service B
```

Three protocols, each with its own latency cost, failure modes, and caching behaviour. A Principal Engineer who understands all three can:

- Explain why a deployment causes 30 seconds of stale traffic even after new pods are healthy (DNS TTL)
- Explain why inter-service latency jumped after enabling TLS (extra RTTs for handshake)
- Explain why some requests are slower than others after migrating to HTTP/2 (HOL blocking on packet loss)
- Design zero-downtime certificate rotation
- Know exactly when mTLS is necessary vs overkill

---

## Mental Model

> **DNS maps names to addresses. HTTP structures request-response conversations. TLS secures them. Each has a cost (DNS resolution time, HTTP overhead, TLS handshake RTTs), a caching mechanism (DNS TTL, HTTP cache headers, TLS session resumption), and failure modes (stale DNS, protocol version mismatch, certificate expiry). Knowing the cost and failure mode of each layer lets you design services that are fast, reliable, and secure.**

---

## Intuition

**DNS** is a phonebook. When you call `user-service`, you look up its address. The phonebook has a local cache (your system's resolver cache). The phonebook itself is distributed across many servers, cached at multiple levels, and updated with delays (TTL). If `user-service` moves to a new IP, it takes up to TTL seconds for all callers to learn the new address.

**HTTP** is a conversation format. It defines how you ask ("GET /users/42 HTTP/1.1") and how the other party responds ("HTTP/1.1 200 OK"). Over the years, the conversation format was optimised: from one-at-a-time (HTTP/1.0) to pipelining (HTTP/1.1) to multiplexing (HTTP/2) to multiplexing without transport-layer blocking (HTTP/3).

**TLS** is the sealed envelope. Before the conversation begins, you and the remote party agree on a secret key so no one else can read your messages. Establishing the seal (handshake) takes one or two round trips. Once established, it is reused (session resumption) to avoid paying that cost on every connection.

---

## Visual Explanation

### DNS Resolution Path

```
Application asks: "What is the IP of user-service.internal?"
    ↓
OS stub resolver checks /etc/hosts  →  not found
    ↓
OS stub resolver checks local resolver cache  →  not found (first time)
    ↓
Recursive resolver (10.0.0.1, your DNS server):
    ↓
  → Checks its own cache  →  not found
  → Queries root nameserver: "Who handles .internal?"
  → Root: "Ask the .internal TLD nameserver at 192.168.0.1"
  → Queries .internal TLD: "Who handles user-service.internal?"
  → TLD: "Ask the authoritative NS at 192.168.0.10"
  → Queries authoritative NS: "What is user-service.internal?"
  → Authoritative NS: "10.0.1.50, TTL=30s"
    ↓
Recursive resolver caches result (30s)
    ↓
Returns 10.0.1.50 to stub resolver
    ↓
OS caches result (up to TTL)
    ↓
Application receives 10.0.1.50
    ↓
Opens TCP connection to 10.0.1.50:8080
```

### HTTP Version Timeline

```
HTTP/1.0  (1996)
  ↓  Problem: one request per connection (connection closed after each response)
  ↓
HTTP/1.1  (1997)
  ↓  Solved: persistent connections, pipelining
  ↓  Problem: head-of-line blocking (responses must be ordered), headers not compressed
  ↓
HTTP/2    (2015)
  ↓  Solved: multiplexing (multiple requests over one connection), HPACK header compression
  ↓  Problem: TCP head-of-line blocking (one lost packet stalls all streams)
  ↓
HTTP/3    (2022)
     Solved: runs over QUIC (UDP) — no TCP HOL blocking, 0-RTT resumption
```

---

## Core Concepts

### 1. DNS — The Domain Name System

The DNS is a globally distributed, hierarchical, eventually consistent database that maps domain names to resource records (most commonly: names to IP addresses).

#### The Hierarchy

```
.                     (root — 13 root server clusters, operated by ICANN/various)
├── com.
│   ├── google.com.
│   └── github.com.
├── io.
│   └── kubernetes.io.
├── internal.         (private TLD, used in Kubernetes: .cluster.local)
└── ...
```

Every DNS name is read right-to-left up the hierarchy. `api.user-service.prod.internal.` → root → `.internal` → `.prod` → `.user-service` → `api`.

#### Resource Record Types

| Type | Purpose | Example |
|------|---------|---------|
| A | IPv4 address | `user-service.internal. 30 IN A 10.0.1.50` |
| AAAA | IPv6 address | `user-service.internal. 30 IN AAAA 2001:db8::1` |
| CNAME | Alias (canonical name) | `api.internal. 60 IN CNAME user-service.internal.` |
| MX | Mail exchanger | `example.com. 3600 IN MX 10 mail.example.com.` |
| SRV | Service location (host + port) | `_http._tcp.user-service. 30 IN SRV 0 0 8080 host.internal.` |
| TXT | Arbitrary text | Used for domain verification, SPF, DKIM |
| NS | Nameserver delegation | `internal. IN NS ns1.internal.` |
| SOA | Start of authority | Zone metadata: serial, refresh, retry, expire, minimum TTL |
| PTR | Reverse DNS (IP → name) | `50.1.0.10.in-addr.arpa. IN PTR user-service.internal.` |

#### TTL — Time To Live

Every DNS record has a **TTL** (in seconds). Caches at every level (OS resolver, recursive resolver, load balancer) must discard the record after TTL seconds and re-query.

**TTL trade-offs:**

| Low TTL (5–30s) | High TTL (300–3600s) |
|----------------|---------------------|
| Fast failover (new IP takes effect in seconds) | Slow failover |
| High DNS query volume (every 5–30s per client) | Low DNS query volume |
| Higher DNS infrastructure load | Lower DNS load |
| Better for dynamic environments (Kubernetes, auto-scaling) | Better for stable, long-lived infrastructure |

**Kubernetes DNS TTL:** CoreDNS (Kubernetes' default DNS) returns very short TTLs (5–30 seconds) for service A records. This allows rapid service discovery updates when pods are added or removed.

#### DNS Caching Layers

```
Request for "user-service.internal":

1. Application JVM / Go runtime DNS cache:
   Java: InetAddress.getByName() caches forever by default!
   Go:   caches for 30s by default (net.DefaultResolver)
   
2. OS resolver cache (nscd, systemd-resolved):
   Respects TTL (usually)
   
3. Kubernetes CoreDNS cache:
   Default: 30s positive, 5s negative
   
4. Upstream recursive resolver (your cloud DNS):
   Respects TTL from authoritative NS
```

**Java's DNS caching is a classic trap:** By default in many JVM versions, a successful DNS lookup is cached forever (`networkaddress.cache.ttl = -1`). A pod restart changing the IP of a service never propagates to a running JVM. Fix: set `networkaddress.cache.ttl=30` in `java.security` or use a DNS-aware HTTP client that re-resolves periodically.

#### Negative Caching (NXDOMAIN)

When a DNS name doesn't exist, the resolver returns `NXDOMAIN` — and **caches that negative result** for the negative TTL (from the SOA record's minimum field, often 30–60 seconds).

**Production implication:** If Service A starts before its DNS record is created, it caches NXDOMAIN. Even after the DNS record is added, Service A won't see it for up to the negative TTL. Symptom: service appears broken for 30–60 seconds after deployment even though DNS is correct.

#### DNS-Based Load Balancing

Multiple A records for the same name:
```
user-service.internal.  30  IN  A  10.0.1.50
user-service.internal.  30  IN  A  10.0.1.51
user-service.internal.  30  IN  A  10.0.1.52
```

The resolver returns all three IPs (possibly in different order each time — round-robin DNS). The client picks one (usually the first).

**Limitations of DNS load balancing:**
- No health checking — DNS returns all IPs regardless of whether instances are healthy
- Poor distribution — clients that cache the first IP will always use it until TTL expires
- No sticky sessions — a client may get a different IP on each new connection
- No weighted routing based on real-time load

This is why real load balancers (L4/L7) exist. DNS LB is only used as a coarse-grained geographic routing mechanism (GeoDNS) or as a first-hop redirect to regional load balancers.

#### DNS in Kubernetes

Kubernetes uses DNS for service discovery. Every Service object gets a DNS entry:

```
my-service.my-namespace.svc.cluster.local → ClusterIP of the Service
```

Pods are configured with `resolv.conf` pointing to `kube-dns` (CoreDNS). DNS resolution allows services to find each other by name without hard-coded IPs.

**Search domains:** Kubernetes configures search domains so `my-service` resolves to `my-service.my-namespace.svc.cluster.local` without the full name. Each suffix is tried in order — generating multiple DNS queries per lookup. Under high load, this DNS query amplification can overwhelm CoreDNS.

**ndots setting:** By default, Kubernetes sets `ndots:5` — names with fewer than 5 dots trigger search domain expansion. `api.user-service` has 1 dot → tries `api.user-service.my-namespace.svc.cluster.local` → `api.user-service.svc.cluster.local` → `api.user-service.cluster.local` → `api.user-service` (external). Generates 4 DNS queries for one lookup. Fix: use FQDN (`my-service.my-namespace.svc.cluster.local.` with trailing dot) or set `ndots:2`.

---

### 2. HTTP — HyperText Transfer Protocol

HTTP is an application-layer protocol that defines the structure of requests and responses between clients and servers.

#### HTTP/1.0 (1996)

- One TCP connection per request-response pair
- Connection closed after each response (no reuse)
- No persistent connections → 1 RTT handshake cost per request (catastrophic at scale)
- No host header (can't serve multiple domains from one IP)

```
Client:
  TCP connect → 3-way handshake (1 RTT)
  GET /index.html HTTP/1.0
  Connection: close

Server:
  HTTP/1.0 200 OK
  Content-Length: 1234
  [body]
  → closes connection

Cost per request: 1 RTT (handshake) + 1 RTT (request-response) = 2 RTTs minimum
```

#### HTTP/1.1 (1997) — The Workhorse

HTTP/1.1 made three critical improvements:

**1. Persistent connections (keep-alive):**
```
GET /index.html HTTP/1.1
Host: example.com
Connection: keep-alive   ← default in HTTP/1.1

HTTP/1.1 200 OK
...
← connection stays open

GET /style.css HTTP/1.1
Host: example.com
← reuses same TCP connection — no new handshake!
```

**2. Pipelining:** Send multiple requests without waiting for each response. Responses must be received in the same order as requests (head-of-line blocking — see below). Pipelining was specified but rarely implemented correctly; most clients don't enable it.

**3. Host header:** Allows one IP to serve multiple virtual hosts (HTTP virtual hosting). Essential for shared hosting, CDNs, and Kubernetes ingress controllers.

**HTTP/1.1 connection management:**

```
Connection: keep-alive          → server keeps connection open (default)
Connection: close               → server closes after this response
Keep-Alive: timeout=5, max=100  → keep alive for 5s or 100 requests
```

**Head-of-line blocking in HTTP/1.1:** If a client sends 3 pipelined requests (A, B, C), the server must respond A then B then C, in order. If A is slow, B and C wait — even if B and C are ready. In practice: browsers open 6 parallel TCP connections per domain to work around this, wasting 6× the connection overhead.

**HTTP/1.1 header overhead:** Headers are sent as uncompressed ASCII text on every request. A typical request has 500–1,000 bytes of headers (User-Agent, Cookie, Accept, Authorization...). On a mobile connection, this matters.

#### HTTP/2 (2015)

HTTP/2 is a binary protocol that runs over a single TCP connection and multiplexes many logical request-response streams.

**Key improvements:**

**1. Binary framing:** HTTP/2 breaks communication into binary **frames** — the smallest unit. Every frame has a type (HEADERS, DATA, SETTINGS, PING, GOAWAY...) and is part of a stream.

```
HTTP/2 Frame:
┌────────────────────────────────────────┐
│          Length (24 bits)              │
├────────────┬───────────────────────────┤
│ Type (8b)  │     Flags (8 bits)        │
├────────────┴───────────────────────────┤
│    Stream Identifier (31 bits)         │
├────────────────────────────────────────┤
│         Frame Payload                  │
└────────────────────────────────────────┘
```

**2. Multiplexing:** Multiple request-response pairs (streams) share one TCP connection simultaneously. Stream IDs are odd for client-initiated (1, 3, 5...) and even for server-initiated (2, 4...).

```
TCP Connection (one connection handles all):
  Stream 1: GET /api/users
  Stream 3: GET /api/orders
  Stream 5: GET /api/products
  Stream 7: POST /api/events
  (all in flight simultaneously, interleaved on the wire)
```

No waiting for A before sending B. A slow response on Stream 1 does not delay Stream 3.

**3. HPACK Header Compression:** Headers are compressed using:
- **Static table:** 61 commonly used headers pre-defined (e.g., `:method: GET`, `:status: 200`, `content-type: application/json`)
- **Dynamic table:** headers seen in this connection added to a shared table, referenced by index
- **Huffman encoding:** remaining literal values compressed

Result: repeated headers (Authorization, Cookie) are sent once and referenced by index on subsequent requests — reducing header overhead from 500+ bytes to ~10–50 bytes.

**4. Server Push:** Server can proactively send resources the client hasn't requested yet. Example: `GET /index.html` → server pushes `/style.css` and `/app.js` in the same response before the browser asks for them.

In practice, Server Push has been mostly deprecated — cache digests for knowing what the client already has were never standardised. HTTP/3 dropped it from the spec.

**5. Stream prioritization:** Clients can set weights and dependencies between streams (e.g., load CSS before images). In practice, browsers implement this; generic API clients typically don't.

**HTTP/2 head-of-line blocking (TCP-level):** HTTP/2 eliminates HTTP-level HOL blocking (one slow request doesn't delay others at the application layer). But TCP HOL blocking remains: if a TCP segment is lost, all HTTP/2 streams on that connection are stalled until the segment is retransmitted. On a 1% packet loss link, this can negate HTTP/2's advantages vs multiple HTTP/1.1 connections.

**Connection reuse in HTTP/2:** One long-lived connection replaces many. This concentrates TLS handshake cost (paid once) but creates a single point of failure. A connection error (RST, timeout) drops all in-flight streams simultaneously. Applications must handle this — most HTTP/2 clients retry streams transparently.

#### HTTP Request Structure

```
METHOD /path?query HTTP/version\r\n
Header-Name: Header-Value\r\n
...
\r\n
[body]
```

**Methods and their semantics:**

| Method | Safe | Idempotent | Has Body | Use |
|--------|------|-----------|---------|-----|
| GET | Yes | Yes | No | Retrieve resource |
| HEAD | Yes | Yes | No | Retrieve headers only |
| OPTIONS | Yes | Yes | No | Describe communication options |
| PUT | No | Yes | Yes | Replace resource entirely |
| DELETE | No | Yes | No | Delete resource |
| POST | No | No | Yes | Create or trigger action |
| PATCH | No | No | Yes | Partial update |

**Safe:** does not modify state (idempotent reads). **Idempotent:** calling N times has the same effect as calling once. GET, PUT, DELETE are idempotent. POST is neither safe nor idempotent — a retry creates a duplicate.

**Idempotency matters for retries.** Retrying a GET or PUT on failure is safe. Retrying a POST risks double-processing (double payment, duplicate order). Solutions: idempotency keys (Chapter 28).

#### HTTP Status Codes

| Range | Meaning | Examples |
|-------|---------|---------|
| 1xx | Informational | 100 Continue, 101 Switching Protocols |
| 2xx | Success | 200 OK, 201 Created, 202 Accepted, 204 No Content |
| 3xx | Redirect | 301 Moved Permanently, 302 Found, 304 Not Modified |
| 4xx | Client error | 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 429 Too Many Requests |
| 5xx | Server error | 500 Internal Server Error, 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout |

**Critical distinctions for retry logic:**
- `500 Internal Server Error` — server bug, retry may or may not help
- `502 Bad Gateway` — load balancer can't reach upstream, retry on a different instance
- `503 Service Unavailable` — deliberate rejection (overload, maintenance), respect `Retry-After` header
- `504 Gateway Timeout` — upstream didn't respond in time; **the request may have been processed** — dangerous to retry blindly

#### HTTP Caching

HTTP defines caching through headers:

```
Response headers:
  Cache-Control: max-age=3600, public     → cache for 1 hour, shared caches ok
  Cache-Control: private, no-store        → browser only, never cache
  Cache-Control: no-cache                 → must revalidate before using cached copy
  ETag: "33a64df5"                        → opaque version identifier
  Last-Modified: Wed, 21 Oct 2020 07:28:00 GMT

Conditional request headers (validation):
  If-None-Match: "33a64df5"              → return 304 if ETag hasn't changed
  If-Modified-Since: Wed, 21 Oct 2020... → return 304 if not modified since
```

**`304 Not Modified`:** Server confirms cached copy is still valid. Body is empty — saves bandwidth. The cached copy is used.

#### HTTP Rate Limiting Headers (RFC 6585 / draft-ietf-httpapi-ratelimit-headers)

```
HTTP/1.1 429 Too Many Requests
Retry-After: 30                          → wait 30 seconds before retrying
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1628097600            → epoch time when limit resets
```

Well-behaved clients must respect `Retry-After` — hammering a 429-returning server is a denial-of-service attack on yourself.

---

### 3. TLS — Transport Layer Security

TLS (formerly SSL) provides three security properties for a connection:
1. **Confidentiality:** data is encrypted — eavesdroppers cannot read it
2. **Integrity:** data cannot be modified in transit without detection (MAC / AEAD tags)
3. **Authentication:** the server (and optionally the client) is verified to be who it claims to be

TLS runs on top of TCP (before HTTP). The TLS handshake establishes shared cryptographic keys. Once established, all HTTP bytes are encrypted before being passed to TCP.

#### Symmetric vs Asymmetric Encryption

**Asymmetric (public-key) cryptography:**
- Two keys: public key (share freely) and private key (never share)
- Anything encrypted with the public key can only be decrypted with the private key
- Anything signed with the private key can be verified with the public key
- Algorithms: RSA (2048–4096 bit), ECDSA (256-bit elliptic curve), Ed25519
- Cost: slow (thousands of CPU cycles per operation)

**Symmetric cryptography:**
- One shared secret key, used for both encryption and decryption
- Algorithms: AES-128-GCM, AES-256-GCM, ChaCha20-Poly1305
- Cost: fast (hardware AES-NI instruction, ~1 ns per block)

**TLS uses both:** Asymmetric crypto during the handshake to authenticate and exchange a shared secret. Symmetric crypto for the data stream (much faster). This is called a **hybrid cryptosystem**.

#### Certificates and Certificate Authorities

A **certificate** is a document that binds a public key to an identity (domain name), signed by a trusted third party called a **Certificate Authority (CA)**.

```
Certificate (X.509):
  Subject: CN=user-service.internal
  Subject Alternative Names: user-service.internal, user-service
  Public Key: ECDSA P-256 key
  Valid From: 2024-01-01
  Valid Until: 2024-12-31
  Signature: <signed by CA's private key>
  Issuer: CN=Internal CA, O=My Company
```

**Chain of trust:**
```
Root CA (self-signed, in OS trust store)
  → Intermediate CA (signed by Root CA)
    → Server Certificate (signed by Intermediate CA)
```

The OS and browsers maintain a **trust store** — a list of trusted root CAs. When you visit a site, your browser verifies:
1. The certificate's Subject Alternative Name matches the hostname you're connecting to
2. The certificate is currently valid (not before, not after)
3. The certificate chain leads to a trusted root CA
4. The certificate has not been revoked (CRL / OCSP)

**Certificate pinning:** An application explicitly lists which certificates or public keys it trusts, ignoring the OS trust store. Prevents MITM attacks via compromised CAs. Used by mobile apps for APIs they control. Operational risk: if the certificate changes (rotation), pinned clients break.

#### TLS 1.3 Handshake (Modern)

TLS 1.3 (RFC 8446, 2018) reduced the handshake from 2 RTTs (TLS 1.2) to **1 RTT**:

```
Client                                         Server
  │                                               │
  │─── ClientHello ──────────────────────────────▶│
  │    (TLS version, cipher suites,               │
  │     key_share: ephemeral ECDH public key,     │
  │     supported_groups, session_ticket)         │
  │                                               │
  │◀── ServerHello ───────────────────────────────│
  │    (chosen cipher suite,                      │
  │     key_share: server's ECDH public key)      │
  │                                               │
  │    [Both sides derive shared secret via ECDH] │
  │    [All further messages are ENCRYPTED]       │
  │                                               │
  │◀── EncryptedExtensions ───────────────────────│
  │◀── Certificate (server cert chain) ───────────│
  │◀── CertificateVerify (signature) ─────────────│
  │◀── Finished (HMAC of handshake) ──────────────│
  │                                               │
  │─── Finished (HMAC of handshake) ─────────────▶│
  │                                               │
  │═══ Encrypted application data (HTTP) ═════════│

Total cost: 1 RTT (before data can flow)
(vs TLS 1.2: 2 RTTs)
```

**Key exchange — ECDH (Elliptic Curve Diffie-Hellman):**
- Client generates ephemeral ECDH key pair, sends public key in ClientHello
- Server generates ephemeral ECDH key pair, sends public key in ServerHello
- Both sides compute the same shared secret from their private key + the other's public key
- A passive eavesdropper who recorded the handshake cannot compute the shared secret (even if they later steal the server's long-term private key — **forward secrecy**)

**Forward secrecy:** Because TLS 1.3 always uses ephemeral keys (generated per-connection, discarded afterward), compromising the server's certificate private key after the fact does not allow decryption of past traffic. TLS 1.2 with RSA key exchange did not have this property.

#### TLS 1.3 0-RTT (Session Resumption)

For a client reconnecting to a server it has previously connected to:

```
Client                                         Server
  │─── ClientHello + 0-RTT data (HTTP request) ──▶│
  │    (session_ticket from previous connection)   │
  │                                               │
  │◀── ServerHello + EncryptedExtensions ─────────│
  │◀── Certificate + Finished ────────────────────│
  │                                               │
  │═══ Encrypted data ════════════════════════════│
```

The client sends the first HTTP request **before the handshake completes**, using a pre-shared key from the previous session. Reduces latency from 1 RTT to **0 RTT** (data is in the first packet).

**0-RTT caveats:**
- **Replay attacks:** 0-RTT data can be replayed by an attacker (the server has no way to detect it at the TLS layer). Only use 0-RTT for idempotent requests (GET, HEAD). Never for POST/PUT with side effects.
- **No forward secrecy** for 0-RTT data (it's encrypted with a session ticket key, which could be compromised)

#### mTLS — Mutual TLS

In standard TLS, only the **server** presents a certificate (client verifies server identity). In **mTLS (mutual TLS)**, both parties present certificates.

```
Standard TLS:
  Client verifies: "Is this really user-service?"  ✓
  Server doesn't verify client identity

mTLS:
  Client verifies: "Is this really user-service?"  ✓
  Server verifies: "Is this really order-service?" ✓
```

**mTLS handshake addition:**
```
... (after CertificateVerify from server) ...
Server: CertificateRequest  ← "send me your certificate"
Client: Certificate (client cert chain)
Client: CertificateVerify (signature proving possession of private key)
Client: Finished
Server: Finished
```

**Why mTLS matters for microservices:**
- Service-to-service calls are authenticated at the transport layer — no spoofed callers
- Replaces or supplements API keys, JWTs for internal service identity
- Implemented by service meshes (Istio, Linkerd) automatically — applications don't manage it

**mTLS operational complexity:**
- Every service needs a certificate issued by a shared CA
- Certificates expire and must be rotated (typically every 24 hours in service meshes — short-lived prevents long-window of compromise)
- Certificate rotation must be zero-downtime
- CRL/OCSP for revocation is hard at high rotation rates — short TTL is the practical solution

#### TLS in Production

**Certificate expiry is a top-10 production failure cause.** A service with an expired certificate causes all its callers to fail with `certificate verify failed`. Unless automated rotation is in place (Let's Encrypt + cert-manager in Kubernetes, AWS ACM, etc.), this happens at the worst possible time — when the certificate expires.

**TLS termination points:**
- **Edge (load balancer / ingress):** TLS from client → LB is terminated; LB → services is plaintext. Simpler certificate management. Services don't see client certificates.
- **End-to-end (mTLS to services):** LB passes through TLS or re-encrypts. Each service manages its own certificate. Full zero-trust.

**TLS handshake cost:**
```
TLS 1.3: 1 RTT (at datacenter RTT of 0.3ms: 0.3ms per new connection)
TLS 1.3 0-RTT: 0 RTT additional (0 ms)
TLS 1.2: 2 RTTs (0.6ms at datacenter RTT)
```

This is why TLS session resumption (0-RTT or session tickets) combined with persistent connections (HTTP keep-alive, HTTP/2 over one connection) is essential. Pay the handshake cost once per connection, not per request.

**Certificate and key storage:**
- Never store private keys in application code or version control
- Use Kubernetes Secrets (base64, not encrypted at rest by default — use KMS envelope encryption)
- Use HashiCorp Vault PKI Secrets Engine for automated cert issuance
- Use `cert-manager` in Kubernetes for automated Let's Encrypt or internal CA issuance/rotation

---

### 4. Putting It Together: One Service Calling Another with DNS + TCP + TLS + HTTP

```
service-a calls service-b:

Step 1: DNS resolution (30–200 µs if cached, 1–50ms if not cached)
  getaddrinfo("service-b.internal")
  → OS checks resolver cache: TTL=28s remaining → returns 10.0.1.50

Step 2: TCP connection (0.3ms RTT → 0.3ms for handshake)
  connect(10.0.1.50:443)
  → SYN, SYN-ACK, ACK (1 RTT)

Step 3: TLS 1.3 handshake (1 RTT = 0.3ms if connection is new)
  ClientHello + key_share
  ← ServerHello + Certificate + Finished
  → Finished
  (if 0-RTT session resumption: 0 additional RTT)

Step 4: HTTP/2 request (1 RTT = 0.3ms)
  → HEADERS frame (GET /users/42)
  ← HEADERS frame (200 OK)
  ← DATA frame (response body)

Total time for new connection: 0.3 + 0.3 + 0.3 = 0.9ms overhead (3 RTTs)
Total time for existing connection (HTTP/2 keep-alive): 0.3ms (1 RTT, query only)

Without connection reuse: 3× the overhead
With connection pool (10 connections): overhead paid once for 10 connections
At 10,000 RPS reusing 10 connections: overhead paid 10 times total (negligible)
```

---

## Deep Dive

### HTTP/2 Frame-Level Multiplexing

When Service A sends 3 simultaneous HTTP/2 requests to Service B:

```
Frames on the wire (interleaved):
  [HEADERS stream=1: GET /users/42]
  [HEADERS stream=3: GET /orders/99]
  [HEADERS stream=5: GET /products/7]
  ← [HEADERS stream=1: 200 OK]
  ← [DATA   stream=1: {user data}]       ← stream 1 completes first
  ← [HEADERS stream=5: 200 OK]
  ← [DATA   stream=5: {product data}]    ← stream 5 completes second
  ← [HEADERS stream=3: 200 OK]
  ← [DATA   stream=3: {order data}]      ← stream 3 took longest, no delay for 1, 5
```

Compare to HTTP/1.1 with one connection: would have to send requests sequentially, total time = sum of all response times. HTTP/2 parallel: total time = max of all response times.

### HPACK Compression — Incremental Savings

```
First request headers (~800 bytes uncompressed):
  :method: GET                → static table index 2 (1 byte)
  :scheme: https              → static table index 7 (1 byte)
  :path: /api/users/42        → literal, Huffman-encoded (~20 bytes)
  :authority: service-b.internal → literal, added to dynamic table
  authorization: Bearer eyJ... → literal (but added to dynamic table)
  content-type: application/json → static table index 31 (1 byte)
  Total compressed: ~150 bytes (vs 800 bytes)

Second request (same headers, different path):
  :method: GET                → 1 byte (static table)
  :scheme: https              → 1 byte
  :path: /api/orders/99       → ~18 bytes
  :authority: ...             → 1 byte (dynamic table reference)
  authorization: Bearer eyJ... → 1 byte (dynamic table reference — same token!)
  content-type: ...           → 1 byte
  Total compressed: ~25 bytes (vs 800 bytes — 97% reduction for repeated headers)
```

**Why this matters:** On a mobile connection (5 Mbps), 800 bytes of headers per request at 1,000 RPS = 800 KB/s of header overhead alone. With HPACK: ~25 bytes × 1,000 = 25 KB/s.

### TLS Certificate Verification in Detail

When your service receives a certificate chain, the TLS library verifies:

```
1. Each certificate in the chain is valid:
   - notBefore ≤ now ≤ notAfter (expiry check)
   - Signature is valid (cryptographic verification against issuer's public key)
   - Key usage extensions match how it's being used

2. The chain terminates at a trusted root CA:
   - Walk up: leaf cert → intermediate CA → root CA
   - Root CA must be in the trust store

3. The Subject Alternative Name (SAN) matches the hostname:
   - DNS: service-b.internal must match SAN "service-b.internal"
   - Wildcards: *.internal matches service-b.internal but not a.b.internal

4. Revocation check (optional, often skipped for performance):
   - CRL (Certificate Revocation List): download a list and check
   - OCSP (Online Certificate Status Protocol): real-time query to CA
   - OCSP Stapling: server includes fresh OCSP response in handshake

Failure at any step: TLS handshake fails with an error
Common errors:
  - certificate verify failed: chain doesn't lead to trusted root
  - certificate has expired: notAfter < now
  - hostname mismatch: SAN doesn't match server hostname
  - self-signed certificate in chain: intermediate CA not in trust store
```

---

## Real-World Example

### The Deployment Caused 30 Seconds of Errors (DNS TTL Issue)

**Setup:**
- `user-service` ClusterIP = `10.0.0.50` (old pod)
- Deploy new version → old pod terminated → new pod has ClusterIP still `10.0.0.50` (Kubernetes Service IP is stable)

This specific example is fine. But consider:

- `user-service` is accessed via external DNS (`user-service.prod.company.com`) pointing to an old load balancer IP
- Migration to new LB IP: TTL=300 seconds

```
During migration:
  T=0: Update DNS record to new IP. TTL=300s.
  T=0..300s:
    Clients with cached old IP: still send to old LB → 200 OK (old LB still running)
    Clients with new IP: send to new LB → 200 OK (new LB running)
  T=300s: All clients' DNS caches expire, re-resolve → new IP
  T=300..600s: Old LB can be shut down safely (all caches now point to new LB)

But Java clients with networkaddress.cache.ttl=-1:
  → Never expire → continue using old LB IP forever!
  → Old LB is shut down → Java clients get ECONNREFUSED
  → Fix: restart Java services (or set ttl=30)
```

**This is why:** DNS TTL is not just a performance optimisation. It is a correctness mechanism that controls how quickly clients discover infrastructure changes. Always set appropriate TTLs and verify your client resolvers respect them.

---

## Failure Scenarios

### Scenario 1: Certificate Expiry at 3 AM

```
2024-12-31 23:59: TLS certificate for api.company.com expires
2025-01-01 00:00:
  - All HTTPS clients connecting to api.company.com: certificate verify failed
  - TLS handshake fails
  - HTTP client gets connection error (not even a status code)
  - From the application: "Error making request: x509: certificate has expired"

Impact: 100% of requests to this endpoint fail
Detection: Monitoring shows 100% error rate on HTTP requests to api.company.com
Mitigation: Renew certificate (15–60 minutes depending on process)
Cost: Typically tens of thousands of dollars per minute of downtime

Prevention:
  - cert-manager (Kubernetes) renews 30 days before expiry automatically
  - AWS ACM manages certificates automatically
  - Alert when certificate expires in < 30 days
  - Alert when certificate expires in < 7 days
  - Never manually manage certificates in production
```

### Scenario 2: HTTP/2 Connection Exhaustion Under Multiplexing

**Setup:** A service makes calls to an external API that limits HTTP/2 connections per client to 10.

```
Under load:
  1,000 requests/second → all use the same 10 HTTP/2 connections
  Each connection handles 100 streams concurrently
  
One connection fails (RST from server, keep-alive timeout):
  → 100 in-flight streams on that connection get errors simultaneously
  → Client reconnects (1 RTT handshake + 1 RTT TLS = 0.6ms)
  → Those 100 requests must be retried
  → If retries are not idempotent-safe: 100 duplicate operations

At scale: connection failure is not one error, it is N simultaneous errors
  where N = max_concurrent_streams (typically 100–1000)
```

**Fix:** Limit `max_concurrent_streams` per connection, implement graceful GOAWAY handling (HTTP/2 GOAWAY frame announces connection shutdown before closing), handle stream-level errors separately from connection-level errors.

---

## Performance Considerations

### DNS Query Latency Budget

```
DNS query latency distribution (from application's perspective):

Cached (OS/JVM): ~0 µs (memory lookup)
Cached (local resolver, e.g., systemd-resolved): ~0.1–1 ms
Uncached (same datacenter DNS): ~0.5–5 ms
Uncached (cross-datacenter): ~5–50 ms

At 1,000 RPS with DNS on every request (no caching):
  Best case (same datacenter): 5ms × 1,000 = 5 seconds of DNS work/second
  → adds 5ms to every request's latency (can't parallelize easily)

With caching (TTL=30s, 1,000 unique names):
  DNS queries: 1,000/30 = 33 queries/second (negligible)
  → cached lookups: ~0 µs
```

**Lesson:** DNS caching is critical for throughput. But DNS caching creates stale-record windows proportional to TTL. Balance accordingly.

### TLS Handshake Overhead at Scale

```
Scenario: 10,000 new connections/second (connection churn, no pooling)
TLS 1.3 handshake: 1 RTT = 0.3ms
CPU cost of TLS handshake per connection: ~0.5–2ms CPU time
  (ECDH key generation, signature verification, AES key schedule)

CPU cost: 10,000 × 1ms = 10 CPU-seconds per second
→ requires 10 CPU cores just for TLS handshakes!

With HTTP/2 persistent connections (1 connection per client, 100 streams each):
  100,000 requests via 1,000 connections (10,000 RPS / 100 streams)
  TLS handshakes: 1,000 (paid once per connection)
  CPU cost: 1,000 × 1ms = 1ms/second total (negligible)
```

**Lesson:** TLS is fast when connections are reused. TLS with connection churn can consume multiple CPU cores at scale.

---

## Trade-offs

| Feature | Benefit | Cost |
|---------|---------|------|
| Low DNS TTL | Fast failover, rapid service discovery | High DNS query rate, DNS server load |
| High DNS TTL | Low query rate, good cache hit ratio | Slow failover, stale entries on changes |
| HTTP/1.1 keep-alive | Amortizes TCP+TLS cost | Connection state management, server resources |
| HTTP/2 multiplexing | One connection per peer, header compression | TCP HOL blocking on packet loss, complex error handling |
| HTTP/3 (QUIC) | No HOL blocking, 0-RTT | UDP traversal complexity, higher CPU (user-space stack) |
| TLS 1.3 | 1-RTT handshake, forward secrecy, mandatory AEAD | Incompatible with TLS 1.2 clients |
| mTLS | Service-to-service authentication | Certificate management complexity for every service |
| 0-RTT TLS | Zero additional latency for resumption | Replay attack risk; only safe for idempotent operations |
| HPACK dynamic table | 97%+ header compression on repeated headers | Shared state between streams — must be handled carefully |

---

## Alternatives

| Need | Alternative | Trade-off |
|------|-------------|-----------|
| DNS-based service discovery | Consul, etcd service registry | More flexible, supports health checks; more infrastructure |
| HTTP/JSON APIs | gRPC (HTTP/2 + Protobuf) | Binary protocol, lower overhead, better for polyglot; less human-readable |
| TLS certificates from CA | Self-signed certificates | Easy to generate; requires distributing custom trust store to all clients |
| Manual certificate management | cert-manager, AWS ACM, Let's Encrypt | Automates issuance/renewal; requires integration |
| mTLS for service auth | API keys in headers, JWT tokens | Simpler to implement; doesn't authenticate at transport layer |

---

## Production Considerations

1. **Automate certificate rotation before expiry.** Use `cert-manager` (Kubernetes), AWS ACM, or Let's Encrypt. Alert at 30 days and 7 days before expiry. Certificate expiry at midnight causing a major incident is a solved problem — just don't manage certs manually.

2. **Fix Java's infinite DNS caching.** Set `networkaddress.cache.ttl=30` in `$JAVA_HOME/jre/lib/security/java.security` or via `-Dsun.net.inetaddr.ttl=30` JVM argument. Spring Boot services behind load balancers can go stale for hours without this.

3. **Never use `Connection: close` in inter-service calls.** It destroys connection reuse, adding 1 RTT TCP + 1 RTT TLS per request. Use HTTP/2 or HTTP/1.1 with keep-alive.

4. **Validate TLS in integration tests.** Many test environments disable TLS verification (`InsecureSkipVerify: true`). This means certificate expiry bugs are only discovered in production. Use real certificates in staging.

5. **Monitor DNS resolution latency.** Add `dns.lookup.duration` to your service metrics. Sudden increases indicate DNS server issues, cache miss rate spikes, or misconfigured search domains.

6. **Set `ndots: 2` in Kubernetes pods** (or use FQDNs with trailing dot) to reduce DNS query amplification from search domain expansion.

7. **For HTTP/2 to external services:** configure `max_concurrent_streams` conservatively and handle `GOAWAY` frames — the server's way of saying "stop sending, I'm shutting down." Ignoring GOAWAY causes RST errors.

---

## Common Beginner Mistakes

1. **Disabling TLS certificate verification in production.** `InsecureSkipVerify: true`, `verify=False`, `-k` in curl. Disables all server authentication — any server can impersonate any other. This has caused real breaches.
2. **Not following `Retry-After` on 429 responses.** Hammering a rate-limited API without backing off causes permanent rate limiting and IP bans.
3. **Using HTTP/1.0 for inter-service calls.** No persistent connections — every request pays TCP + TLS cost. Use HTTP/1.1+ with keep-alive or HTTP/2.
4. **Creating a new HTTP client per request.** HTTP clients maintain connection pools. Creating a new client per request means no connection reuse — same as HTTP/1.0. Always reuse the client.
5. **Ignoring CNAME chains.** Multiple CNAMEs in sequence each require a separate DNS query. A chain of 3 CNAMEs can triple DNS resolution time.

---

## Common Senior Engineer Mistakes

1. **Setting TTL=0 (or very low) on all DNS records.** Eliminates caching — every request causes a DNS query. At 1,000 RPS this is manageable. At 100,000 RPS you are DDOSing your DNS server.
2. **Not accounting for 0-RTT replay attacks.** Enabling 0-RTT on POST endpoints. State-changing operations replayed by an attacker can cause duplicate processing.
3. **Using TLS 1.2 with RSA key exchange (no forward secrecy).** If the server's private key is ever compromised, all past traffic can be decrypted. Use TLS 1.3 (always forward-secret) or enforce ECDHE suites in TLS 1.2.
4. **Overloading one HTTP/2 connection.** Setting max_concurrent_streams too high (e.g., 10,000) means one connection failure drops thousands of in-flight requests simultaneously. A connection failure at HTTP/1.1 drops only one request.
5. **Certificate hostname mismatch after renaming services.** New certificate issued for `new-service-name.internal` but old cert had `old-name.internal`. Callers that haven't updated the hostname get `hostname mismatch` errors.

---

## Architecture Smells

- Service makes DNS lookup on every request (no caching, TTL=0) → DNS becomes a bottleneck at scale
- Inter-service calls use HTTP/1.0 or `Connection: close` → connection churn, high TLS overhead
- Certificate expiry monitored manually → will eventually expire in production
- mTLS implemented by hand in application code → brittle, hard to rotate; use a service mesh
- HTTP clients created per-request (Spring `new RestTemplate()` in handler) → no connection pooling, poor performance under load

---

## Principal Engineer Perspective

Junior engineers think of DNS, HTTP, and TLS as "the stuff before my code runs." Senior engineers know the costs and configure timeouts and connection pools. Principal Engineers design systems with these protocols as explicit constraints.

**What Principal Engineers think about:**

1. **DNS is a distributed, eventually consistent system.** It has propagation delays (TTL), caching inconsistency (different resolvers at different points in propagation), and negative caching (NXDOMAIN persistence). When you design a zero-downtime migration or a blue/green deployment, the DNS propagation window is a hard constraint. You cannot make it zero without sacrificing caching.

2. **HTTP/2 changes the failure model.** One connection failure in HTTP/1.1 affects one request. One connection failure in HTTP/2 affects N concurrent streams. Your client must handle this differently — not as "one error" but as "N errors that are causally related and should be retried together on a new connection."

3. **TLS is a reliability dependency.** The CA that issued your certificate, the OCSP responder for revocation checks, the DNS records for ACME challenges — all are failure domains that can cause your service to fail to establish TLS connections. Plan for these failures: cache OCSP responses (stapling), use short-lived certificates with high rotation frequency, don't rely on OCSP at high connection rates.

4. **mTLS is the correct solution for zero-trust service authentication.** But its operational complexity (certificate issuance, rotation, revocation) means it should be implemented at the infrastructure layer (service mesh), not the application layer. Asking every application team to implement mTLS correctly is a recipe for partial adoption and security gaps.

---

## Architecture Review Questions

1. What DNS TTL is configured for each external service endpoint? How does this affect failover time during a deployment?
2. Are HTTP clients reused (connection pool) or created per-request? How many concurrent connections does the pool maintain?
3. What TLS version is required for inter-service calls? Is forward secrecy enforced?
4. How are certificates issued and rotated? What is the rotation period? What happens if rotation fails?
5. Is there a monitoring alert for certificate expiry? At what lead time?
6. For services using HTTP/2: what is `max_concurrent_streams` configured to? How does the service handle `GOAWAY` frames?
7. What is the DNS cache TTL at the JVM/application layer (not just the OS resolver)? Is it configured correctly?
8. For external-facing services: what HTTP version do clients use? Is HTTP/2 ALPN negotiated? Does the server fall back to HTTP/1.1 gracefully?
9. Does any service use `InsecureSkipVerify` or equivalent TLS verification bypass — even in staging?
10. What is the recovery procedure if a certificate expires unexpectedly? What is the RTO (Recovery Time Objective)?

---

## Visual / Animation Specification

### Animation 1: DNS Resolution Walk

**Frame 1:** Browser/application asks: "Where is `user-service.internal`?" Arrow to OS resolver.

**Frame 2:** OS resolver checks local cache → MISS. Arrow to recursive resolver (10.0.0.1).

**Frame 3:** Recursive resolver checks cache → MISS. Queries Root NS. Arrow to Root server (globe icon). Root: "Try `.internal` TLD nameserver at 192.168.0.1."

**Frame 4:** Recursive resolver queries .internal TLD NS. TLD: "Try authoritative NS at 192.168.0.10."

**Frame 5:** Recursive resolver queries authoritative NS. Returns: "10.0.1.50, TTL=30s." Animated "TTL=30s" countdown starts.

**Frame 6:** Recursive resolver caches result. Returns IP to OS resolver. OS resolver caches. Application receives IP.

**Frame 7:** Second lookup within 30s → OS cache HIT (instant). Clock shows "15s remaining."

**Frame 8:** 30s later → cache MISS → walk restarts.

### Animation 2: HTTP/2 Multiplexing vs HTTP/1.1

**Split screen.** Left: HTTP/1.1 (one connection). Right: HTTP/2 (one connection, multiple streams).

**HTTP/1.1 left panel:**
- Request A sent. Loading spinner.
- Response A received (2s).
- Request B sent. Loading spinner. (Sequential)
- Total time: 2 + 1 + 1.5 = 4.5s

**HTTP/2 right panel:**
- Stream 1 (A), Stream 3 (B), Stream 5 (C) all sent simultaneously.
- Frames interleaved on wire (animated).
- Stream 5 (C, 1s) completes first — shown immediately.
- Stream 3 (B, 1.5s) completes.
- Stream 1 (A, 2s) completes.
- Total time: 2s (max of all)

---

## Hands-On Tutorial

### Observing DNS Resolution

```bash
# Trace full DNS resolution path
dig +trace user-service.internal

# Check TTL of a record
dig user-service.internal | grep -A2 "ANSWER SECTION"

# Check what the resolver caches
systemd-resolve --status

# Flush resolver cache
sudo systemd-resolve --flush-caches

# Observe DNS queries in real-time
sudo tcpdump -i any port 53 -n
```

### Inspecting TLS Handshake

```bash
# Full TLS handshake details
openssl s_client -connect service-b.internal:443 \
  -tls1_3 \
  -status \       # request OCSP staple
  -debug 2>&1 | head -100

# Check certificate expiry
echo | openssl s_client -connect service-b.internal:443 2>/dev/null \
  | openssl x509 -noout -dates

# Verify certificate chain
openssl verify -CAfile /etc/ssl/certs/ca-bundle.crt \
  -untrusted intermediate.pem leaf.pem
```

### Testing HTTP/2

```bash
# Check if server supports HTTP/2
curl -I --http2 https://service-b.internal/health

# Force HTTP/1.1 comparison
curl -I --http1.1 https://service-b.internal/health

# See HTTP/2 frames (requires nghttp2)
nghttp -v https://service-b.internal/api/users/1
```

---

## Failure Injection Lab

### Lab: Simulate DNS Propagation Delay

1. Two services (A calls B). B is registered as `service-b.internal` pointing to `10.0.1.50`.
2. Service A resolves `service-b.internal` and caches it (TTL=30s).
3. Change DNS record to `10.0.1.51` (new pod IP).
4. **Immediately:** Service A still sends to `10.0.1.50` (old pod). New pod on `10.0.1.51` receives no traffic.
5. **After 30s:** Service A's cache expires. Re-resolves. Now sends to `10.0.1.51`.
6. **For Java services with infinite DNS caching:** Service A never re-resolves. Old pod must stay running until A is restarted.
7. **Fix:** Set `networkaddress.cache.ttl=30`. Re-run experiment. Verify A discovers new IP within 30s.

---

## Exercises

**Conceptual:**
1. Why does DNS use a hierarchical, distributed architecture rather than one central database?
2. What is the difference between negative caching (NXDOMAIN) and positive caching? What failure does each cause in production?
3. HTTP/2 eliminates HTTP-level head-of-line blocking but not TCP-level HOL blocking. Explain the difference.
4. Why does TLS 1.3 provide forward secrecy but RSA key exchange in TLS 1.2 does not?
5. What is the replay attack risk of TLS 0-RTT? For which HTTP methods is 0-RTT safe?

**Architecture:**
6. Your service handles 100,000 RPS. It calls an external API using HTTP/1.1 with a new connection per request. The external API is 50ms away (RTT). Calculate the connection overhead per second in RTTs. What is the minimum connection pool size needed to sustain this throughput?
7. Design a zero-downtime certificate rotation process for a service with 100 clients that have certificate pinning enabled.
8. You need to migrate `api.company.com` from IP `1.2.3.4` to `5.6.7.8` with zero downtime. The current DNS TTL is 3600 seconds. What steps do you take and why?

**Quantitative:**
9. A DNS TTL of 60 seconds, 1,000 unique service names, and 500 application instances each performing DNS lookups independently. How many DNS queries per second does this generate?
10. An HTTP/2 service has `max_concurrent_streams=100` per connection and maintains 10 connections to its downstream. What is the maximum in-flight request count? If one connection is closed, how many in-flight requests are simultaneously affected?

---

## Solutions

### Exercise 6
At 100,000 RPS, need 100,000 connections/second (one per request). TCP + TLS = 2 RTTs = 100ms per connection. Thread time per connection: 100ms. To handle 100,000 connections/second each taking 100ms: Little's Law: L = λW = 100,000 × 0.1 = **10,000 concurrent connections** (threads). With pooling: need enough connections that each handles multiple requests. At 50ms round trip per request and 100,000 RPS: L = 100,000 × 0.05 = **5,000 concurrent in-flight requests** minimum. Pool of **5,000+ connections** needed (without pooling the overhead is unachievable).

### Exercise 9
DNS queries per second = (instances × unique_names) / TTL = (500 × 1,000) / 60 = **8,333 queries/second**. This is a meaningful load on a DNS server. Use DNS caching at the application level (reduce effective lookup rate by 10–100×) and ensure DNS infrastructure is sized appropriately.

### Exercise 10
Maximum in-flight = 10 connections × 100 streams = **1,000 concurrent requests**. If one connection is closed with an RST or GOAWAY: **100 in-flight requests** are simultaneously affected. All 100 receive an error at the same moment — they must all retry, potentially causing a thundering herd on the remaining 9 connections.

---

## Interview Questions

### Beginner
- What does DNS do? What is a DNS TTL?
- What is the difference between HTTP/1.1 and HTTP/2?
- What does TLS protect against?

### Senior
- Explain the DNS resolution process from a browser typing a URL to an IP address being returned.
- What is HTTP/2 head-of-line blocking? Is it the same as HTTP/1.1 head-of-line blocking?
- Explain the TLS 1.3 handshake. What is forward secrecy and why does it matter?
- What is mTLS? When would you use it over standard TLS?

### Staff
- Design the DNS strategy for a microservices deployment where services need to discover each other with < 5 second propagation delay for IP changes.
- Explain three distinct failure modes that DNS caching can cause in a distributed system.
- A service migrated from HTTP/1.1 to HTTP/2 and p999 latency got worse under 1% packet loss. Explain why and what you would do.

### Principal
- Design a certificate management system for 500 microservices with 24-hour certificate rotation, zero-downtime, and automatic revocation. What are the operational failure modes?
- Your DNS TTL is currently 300s. A new deployment strategy requires DNS-based blue/green switching. What TTL changes are needed, what are the implications for DNS infrastructure load, and what is the minimum switching time?
- Walk through every protocol interaction (DNS, TCP, TLS, HTTP) when one microservice calls another for the first time in a new Kubernetes pod — including what happens in the kernel at each step. At which points can the call fail, and what does each failure look like from the application's perspective?

---

## Summary

DNS, HTTP, and TLS form the application-layer foundation of inter-service communication:

- **DNS** maps names to IPs via a hierarchical, eventually consistent, cached system. TTL controls cache freshness and failover speed. Negative caching (NXDOMAIN) can cause startup failures. DNS-based load balancing is coarse-grained and health-unaware.

- **HTTP** evolved to solve the cost of new connections: HTTP/1.1 added keep-alive; HTTP/2 added multiplexing and header compression; HTTP/3 eliminated TCP HOL blocking via QUIC. Methods carry semantic meaning (idempotency) critical for retry safety.

- **TLS** provides confidentiality, integrity, and authentication via a hybrid cryptosystem — asymmetric for handshake, symmetric for data. TLS 1.3 reduced handshake to 1 RTT and mandates forward secrecy. mTLS extends this to mutual authentication. Certificate expiry is the leading cause of TLS-related production failures.

- **Together:** A cold call (new DNS + new TCP + new TLS + HTTP) costs ~3–4 RTTs. A warm call (cached DNS + existing connection + existing TLS session) costs ~1 RTT. Connection pooling and session resumption make the difference between 0.3ms and 1ms per inter-service call — at 100,000 RPS this is the difference between 30 CPU-seconds/second and 100 CPU-seconds/second.

---

## What You Should Now Be Able To Explain

- ✅ The full DNS resolution path and why caching at every layer matters
- ✅ Why Java applications can use stale DNS entries forever (and how to fix it)
- ✅ What HTTP/2 multiplexing gives you vs HTTP/1.1, and what the remaining limitation is
- ✅ What happens during a TLS 1.3 handshake and why forward secrecy matters
- ✅ Why certificate expiry is a top production failure cause and how to prevent it
- ✅ What mTLS adds over TLS and when a service mesh is the right implementation
- ✅ The total latency cost of a cold vs warm inter-service call

---

## What To Learn Next

**Chapter 5 — Infrastructure Networking.** You now understand the protocols. The next step is the infrastructure that routes those protocols at scale: load balancers (L4 vs L7), reverse proxies, NAT gateways, and service discovery mechanisms. You will trace the complete path of a request from a client through the cloud edge, through load balancers, into a service — and understand the trade-offs at each hop. This is the direct prerequisite for understanding Kubernetes service networking (Chapter 17) and service mesh internals (Chapter 42).
