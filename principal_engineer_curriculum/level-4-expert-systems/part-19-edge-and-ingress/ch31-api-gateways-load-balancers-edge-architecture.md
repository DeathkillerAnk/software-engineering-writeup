# Chapter 31 — API Gateways, Load Balancers, and Edge Architecture at Scale

> **Difficulty:** Advanced | **Importance:** ★★★★★ | **Estimated Reading Time:** 4.5 hours

---

## Prerequisites

- Chapter 3 (TCP/UDP, network layers, connection semantics)
- Chapter 4 (DNS, HTTP/1.1 vs HTTP/2 vs HTTP/3, TLS handshake)
- Chapter 5 (Infrastructure networking — VPCs, BGP, Anycast)
- Chapter 15 (Service Mesh — sidecar proxies, mTLS)
- Chapter 19 (Rate Limiting and Backpressure)

---

## Learning Objectives

By the end of this chapter, you will be able to:

1. Distinguish L4 from L7 load balancing and explain when each is architecturally appropriate
2. Implement the five core load balancing algorithms and calculate their behavior under skewed traffic
3. Design a zero-downtime rolling deployment using connection draining and health check semantics
4. Explain how Anycast routing, BGP, and global load balancers (Cloudflare, AWS Global Accelerator) steer traffic geographically
5. Describe the architectural layering of reverse proxy, API gateway, and service mesh ingress and when each layer is necessary
6. Implement request routing, authentication offloading, and circuit breaking at the API gateway layer
7. Explain TLS termination strategies (edge termination, passthrough, re-encryption) and their security trade-offs
8. Analyze Netflix's Zuul2 adaptive concurrency limiter and implement gradient-based request throttling

---

## Why This Matters

Every request from every user in the world enters your distributed system through the edge. The edge layer — load balancers, API gateways, reverse proxies, CDNs — is the first and most critical tier to get right. Mistakes here cascade everywhere:

- A misconfigured health check causes the load balancer to drain a healthy pool, routing all traffic to 2 surviving nodes instead of 20, causing a cascade failure
- A missing connection draining policy causes 30% of in-flight requests to fail during every deployment because the load balancer removes instances before they finish serving requests
- A naive round-robin algorithm routes equal traffic to a node that's experiencing GC pauses, queuing 10,000 requests behind a stalled node while 19 idle nodes wait
- A single-region load balancer means 200ms latency for Australian users when a Singapore edge would serve them in 20ms
- An unprotected API gateway means a single malformed request brings down a microservice that assumed all inputs were valid

This chapter covers the full edge architecture stack: from the physics of Anycast routing to the mathematics of EWMA-based adaptive load balancing, from the operational mechanics of connection draining to the security architecture of mTLS propagation from the edge into the service mesh. These are the systems that determine whether your application is fast, resilient, and secure — or fragile, slow, and vulnerable.

---

## Mental Model

***The edge is the boundary between the untrusted, uncontrolled internet and your controlled, trusted internal network. Every packet that crosses this boundary should be authenticated, authorized, rate-limited, and routed to the appropriate backend with minimum latency and maximum resilience. The load balancer distributes load; the API gateway enforces policy; the CDN absorbs cacheable requests before they reach your origin. Each layer has a distinct responsibility — conflating them produces a monolithic edge that fails monolithically.***

---

## Intuition: The Airport Analogy

Think of an airport's passenger routing as a load balancing system:

- **Check-in counters (L4 load balancer):** Routes passengers to an open counter based on simple rules (airline, ticket class). Doesn't inspect the passenger's destination — just "open lane → send passenger there."
- **Security checkpoint (API gateway):** Verifies identity, checks for prohibited items, enforces rules. Rejects passengers who fail checks before they reach the gates.
- **Gate assignment (L7 load balancer):** Routes by destination (payload content). Flight to Tokyo → Terminal 3, Gate 22. This requires reading the boarding pass (inspecting the request).
- **Global routing (Anycast):** A traveler arriving at JFK vs LAX vs Heathrow automatically connects to the nearest hub — they don't manually choose which airport entry point to use.

The airline controls the internal terminal layout (service mesh). The airport controls the external routing (load balancer/API gateway). Neither needs to know the other's internal design.

---

## Visual Explanation: Full Edge Architecture Stack

```
                         Internet
                            │
                            ▼
              ┌─────────────────────────────┐
              │   Global Load Balancer /    │
              │   Anycast Edge (Cloudflare, │
              │   AWS Global Accelerator)   │
              │                             │
              │  • BGP Anycast: nearest PoP │
              │  • GeoDNS: regional routing │
              │  • DDoS mitigation at edge  │
              │  • TLS termination (L7)     │
              └──────────────┬──────────────┘
                             │ HTTPS (regionally terminated)
              ┌──────────────▼──────────────┐
              │      Regional Layer 7       │
              │    Load Balancer / Reverse  │
              │    Proxy (Nginx, HAProxy,   │
              │    AWS ALB, GCP GLB)        │
              │                             │
              │  • SSL/TLS termination      │
              │  • HTTP/2 multiplexing      │
              │  • Health checking          │
              │  • Request routing (Host,   │
              │    path, header matching)   │
              │  • Connection pooling       │
              └──────────────┬──────────────┘
                             │ HTTP/HTTPS (internal)
              ┌──────────────▼──────────────┐
              │        API Gateway          │
              │  (Kong, AWS API GW, Apigee, │
              │   custom Envoy/Nginx)       │
              │                             │
              │  • Authentication (JWT/     │
              │    OAuth2 validation)       │
              │  • Authorization (RBAC,     │
              │    OPA policy)              │
              │  • Rate limiting (per-user, │
              │    per-API-key, global)     │
              │  • Request transformation  │
              │  • Circuit breaking         │
              │  • Request/response logging │
              └──────────────┬──────────────┘
                             │ mTLS (internal services)
              ┌──────────────▼──────────────┐
              │      Service Mesh Ingress   │
              │   (Istio IngressGateway,    │
              │    Linkerd, Envoy proxy)    │
              │                             │
              │  • mTLS termination +       │
              │    re-encryption            │
              │  • Traffic shifting (canary)│
              │  • Observability (traces)   │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │       Backend Services      │
              │  (Pods, VMs, containers)    │
              └─────────────────────────────┘

Not every system needs all four layers.
Small teams: Nginx reverse proxy + basic auth = sufficient.
Large platforms: All four layers, each independently scalable.
```

---

## Core Concepts

### 1. L4 vs L7 Load Balancing

The fundamental distinction is which layer of the OSI model the load balancer operates at.

#### L4 Load Balancing (Transport Layer)

L4 load balancers operate on TCP/UDP connections. They see source IP, destination IP, source port, destination port — but not the HTTP headers, URL paths, or request bodies.

```
L4 Load Balancer Operation:
  Client → TCP SYN to VIP (Virtual IP: 10.0.0.1:443)
  L4 LB: {src=client_ip:54321, dst=10.0.0.1:443}
  L4 LB selects backend (e.g., backend1:443) via NAT/DNAT
  Rewrites dst → {src=client_ip:54321, dst=backend1:443}
  TCP connection established directly between client and backend
  
  L4 LB is NOT in the data path after connection establishment:
  → Sub-microsecond per-packet processing
  → Cannot inspect HTTP headers or URL
  → Cannot route /api/products to one pool and /api/orders to another
  → Cannot terminate TLS (passes encrypted bytes through)
  
Examples: HAProxy (TCP mode), AWS NLB, Google Cloud TCP Proxy,
          IPVS (Linux kernel), eBPF-based LB (Cilium)

When to use L4:
  • Non-HTTP protocols (gRPC without HTTP/2 inspection, raw TCP, WebSocket)
  • Maximum throughput (millions of connections/second)
  • When the backend must see the real client IP (with PROXY protocol)
  • Database connection load balancing (PgBouncer frontend)
  • When TLS should be terminated at the backend, not the LB
```

#### L7 Load Balancing (Application Layer)

L7 load balancers terminate the HTTP connection, inspect the request, and make routing decisions based on application-layer content.

```
L7 Load Balancer Operation:
  Client → TLS handshake with LB → HTTP request received
  LB inspects: {method=GET, host=api.example.com, path=/api/products,
                headers={Authorization: Bearer xyz, Accept: application/json}}
  
  Routing decisions available:
  → Path routing: /api/products → products-service pool
                  /api/orders   → orders-service pool
  → Host routing: api.example.com → API pool
                  admin.example.com → admin pool
  → Header routing: X-Version: beta → canary pool
  → Weight routing: 90% → stable pool, 10% → canary pool
  
  L7 LB proxies the request to selected backend:
  Client ←→ L7 LB ←→ Backend
  (two TCP connections: client-to-LB, LB-to-backend)
  
  Cost: Two TLS handshakes, two TCP connections, per-request inspection
  Benefit: Rich routing, SSL offload, HTTP/2 multiplexing, 
           health checks at HTTP level, request logging

Examples: Nginx, HAProxy (HTTP mode), AWS ALB, GCP HTTP(S) LB,
          Envoy Proxy, Traefik, Caddy

When to use L7:
  • HTTP/HTTPS traffic (the vast majority of web APIs)
  • Path-based routing between microservices
  • TLS termination at the load balancer
  • Canary deployments (weight-based routing)
  • HTTP-level health checks (/healthz endpoint)
  • Request/response logging and observability
```

#### L4 vs L7 Performance Comparison

```
Metric               L4 NLB              L7 ALB
─────────────────────────────────────────────────────────────
Throughput           Millions CPS        Tens of thousands RPS/node
Latency added        <1ms                2-5ms (TLS + inspection)
Connections/second   1M+                 100K-500K
Memory per conn      ~100 bytes          ~50 KB (HTTP state)
DDoS protection      TCP flood only      HTTP-layer attacks too
TLS termination      No (passthrough)    Yes
Path-based routing   No                  Yes
Health check depth   TCP connect only    HTTP GET /healthz
CPS = connections per second; RPS = requests per second
```

---

### 2. Load Balancing Algorithms

#### Algorithm 1: Round Robin

Distributes requests sequentially across backends:

```
Backend pool: [A, B, C, D]
Request 1 → A
Request 2 → B
Request 3 → C
Request 4 → D
Request 5 → A (wraps around)
...

Problem: All requests weighted equally regardless of response time.
         Backend D is experiencing a GC pause (500ms latency).
         Every 4th request gets queued for 500ms.
         19 other backends sit idle while D's queue grows.

Suitable for: Stateless backends with uniform request cost and
              similar backend hardware specs.
```

#### Algorithm 2: Weighted Round Robin

Assigns more requests to higher-capacity backends:

```
Backend pool: [A (weight=4), B (weight=3), C (weight=2), D (weight=1)]
Total weight: 10
Distribution: A gets 40%, B gets 30%, C gets 20%, D gets 10%

Pattern: A A A A B B B C C D A A A A B B B C C D ...

Use case: Heterogeneous hardware (some backends have 4x the CPU of others)
Problem: Static weights don't adapt to runtime slowness.
         If A becomes slow, it still gets 40% of traffic.
```

#### Algorithm 3: Least Connections

Routes to the backend with fewest active connections:

```
State: A=142 conn, B=89 conn, C=156 conn, D=91 conn
New request → sent to B (fewest: 89 connections)

Next request: A=142, B=90, C=156, D=91 → sent to B (90 < 91)
Next request: A=142, B=91, C=156, D=91 → tie: B or D (round-robin tie-break)

Better than round-robin for:
  - Mixed workloads (some requests take 1ms, others take 5s)
  - Backends that stall occasionally (GC, database lock wait)

Problem: Connection count is a proxy for load, not a direct measure.
         A backend with 100 fast connections may be less loaded than
         one with 10 slow connections.
```

#### Algorithm 4: Least Response Time (with EWMA)

Netflix's Zuul2 and Envoy both implement this: route to the backend with the lowest exponentially weighted moving average (EWMA) of response latency.

```python
import math
import time
from dataclasses import dataclass, field

@dataclass
class Backend:
    address: str
    ewma_latency_ms: float = 100.0  # Start with reasonable estimate
    active_requests: int = 0
    last_update: float = field(default_factory=time.time)
    
    # EWMA decay constant: higher alpha = more weight on recent observations
    ALPHA = 0.1  # α for exponential smoothing
    
    def update_latency(self, latency_ms: float):
        """Update EWMA after a request completes."""
        now = time.time()
        age = now - self.last_update
        
        # Decay factor: older observations matter less (time-based decay)
        # β = e^(-age / half_life_seconds)
        half_life = 30.0  # 30 second half-life
        beta = math.exp(-age / half_life)
        
        # Exponential moving average with time-based decay
        self.ewma_latency_ms = (
            beta * self.ewma_latency_ms +
            (1 - beta) * latency_ms
        )
        self.last_update = now
    
    def score(self) -> float:
        """
        Combined score: penalize both high latency AND high active request count.
        Lower score = better choice.
        
        This implements the "Peak EWMA" algorithm used by Finagle and Linkerd:
        score = ewma_latency × (active_requests + 1)
        
        The +1 prevents division/multiplication by zero and adds a base penalty
        for having any active requests (prefer idle backends).
        """
        return self.ewma_latency_ms * (self.active_requests + 1)


class EWMALoadBalancer:
    def __init__(self, backends: list[Backend]):
        self.backends = backends
    
    def select_backend(self) -> Backend:
        """Select backend with lowest Peak EWMA score."""
        return min(self.backends, key=lambda b: b.score())
    
    def send_request(self, request) -> any:
        backend = self.select_backend()
        backend.active_requests += 1
        
        start = time.time()
        try:
            response = backend.send(request)
            return response
        finally:
            latency_ms = (time.time() - start) * 1000
            backend.update_latency(latency_ms)
            backend.active_requests -= 1
```

**Why EWMA beats round-robin:**

```
Scenario: 4 backends. Backend D starts experiencing 1000ms latency
          (database lock contention). Other backends: 10ms.

Round Robin (every 4th request to D):
  25% of requests get 1000ms latency
  p99 ≈ 1000ms

EWMA (Peak EWMA):
  D's score: 1000ms × (active+1) → rapidly higher than others
  Load balancer routes <5% of requests to D
  p99 ≈ 15ms (slight elevation from D receiving occasional traffic)

After D recovers:
  D's EWMA decays back toward 10ms within ~30 seconds
  Load balancer automatically resumes normal distribution
  No manual intervention required
```

#### Algorithm 5: Consistent Hashing (Sticky Sessions)

Routes requests from the same client to the same backend (session stickiness without shared session store):

```python
import hashlib
import bisect

class ConsistentHashLB:
    """
    Route requests to backends based on a hash of the client key
    (e.g., session ID, user ID, request hash).
    Same key → same backend (until backend failure).
    Adding/removing backends only reshuffles O(K/N) keys.
    """
    
    def __init__(self, backends: list[str], replicas: int = 150):
        self.ring = {}
        self.sorted_positions = []
        
        for backend in backends:
            for i in range(replicas):
                key = f"{backend}:replica:{i}"
                position = int(hashlib.md5(key.encode()).hexdigest(), 16)
                self.ring[position] = backend
                bisect.insort(self.sorted_positions, position)
    
    def select(self, request_key: str) -> str:
        """Select backend for a given client/session key."""
        if not self.ring:
            raise RuntimeError("No backends available")
        
        # Hash the request key to a position on the ring
        pos = int(hashlib.md5(request_key.encode()).hexdigest(), 16)
        
        # Find first backend position >= request position (clockwise)
        idx = bisect.bisect(self.sorted_positions, pos)
        if idx == len(self.sorted_positions):
            idx = 0  # Wrap around
        
        return self.ring[self.sorted_positions[idx]]

# Usage: session-sticky routing
lb = ConsistentHashLB(["backend1:8080", "backend2:8080", "backend3:8080"])
session_id = "user-session-abc123"
backend = lb.select(session_id)  # Always routes to same backend for same session
```

**When to use consistent hashing:** Stateful backends that cache session data locally (in-memory), connection pooling optimization (same DB connections reused), or when the cost of switching backends is high (cache cold-start).

---

### 3. Health Checking: Active vs Passive

Health checking is how load balancers determine which backends can receive traffic.

#### Active Health Checking

The load balancer periodically sends synthetic requests to each backend:

```yaml
# Nginx upstream health check configuration
upstream products_backend {
    server backend1:8080;
    server backend2:8080;
    server backend3:8080;
    
    # Active health check (Nginx Plus / OSS with nginx_upstream_check_module)
    check interval=3000 rise=2 fall=3 timeout=1000 type=http;
    check_http_send "GET /healthz HTTP/1.0\r\n\r\n";
    check_http_expect_alive http_2xx http_3xx;
}
```

```
Health check state machine:
  HEALTHY → fail_count >= fall (3) → UNHEALTHY
  UNHEALTHY → success_count >= rise (2) → HEALTHY
  
  Interval: 3 seconds between checks
  Timeout: 1 second (check fails if no response within 1s)
  
  Fall=3: Backend must fail 3 consecutive checks before removal
          (prevents flapping on transient failures)
  Rise=2: Backend must pass 2 consecutive checks before readmission
          (prevents premature readmission during unstable recovery)
```

**Health check endpoint design:**

```go
// /healthz endpoint: liveness (is the process alive?)
// /readyz endpoint: readiness (is this instance ready to serve traffic?)

// These are DIFFERENT and both needed:
// Liveness: if fails, Kubernetes restarts the container
// Readiness: if fails, Kubernetes AND load balancer remove from traffic pool
//            without restarting (useful during startup, graceful shutdown, etc.)

func livenessHandler(w http.ResponseWriter, r *http.Request) {
    // Minimal: is the process running and not deadlocked?
    // DO NOT check external dependencies here (DB, Redis)
    // A DB outage should NOT restart all pods — it should just stop sending traffic
    w.WriteHeader(http.StatusOK)
    w.Write([]byte(`{"status":"alive"}`))
}

func readinessHandler(w http.ResponseWriter, r *http.Request) {
    // Check all dependencies needed to serve requests
    ctx, cancel := context.WithTimeout(r.Context(), 500*time.Millisecond)
    defer cancel()
    
    checks := []struct {
        name string
        fn   func(context.Context) error
    }{
        {"database", checkDBConnection},
        {"redis", checkRedisConnection},
        {"config", checkConfigLoaded},
    }
    
    for _, check := range checks {
        if err := check.fn(ctx); err != nil {
            w.WriteHeader(http.StatusServiceUnavailable)
            json.NewEncoder(w).Encode(map[string]string{
                "status": "not_ready",
                "failed": check.name,
                "error":  err.Error(),
            })
            return
        }
    }
    
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
}
```

#### Passive Health Checking (Outlier Detection)

Instead of sending synthetic requests, passive health checking monitors real request outcomes:

```yaml
# Envoy outlier detection configuration
cluster:
  name: products_backend
  outlier_detection:
    consecutive_5xx: 5          # Remove after 5 consecutive 5xx responses
    interval: 10s               # Evaluation interval
    base_ejection_time: 30s     # First ejection: 30 seconds
    max_ejection_percent: 50    # Never eject more than 50% of the pool
    
    # Latency-based ejection:
    success_rate_minimum_hosts: 5      # Need at least 5 hosts for comparison
    success_rate_request_volume: 100   # Need at least 100 requests per host
    success_rate_stdev_factor: 1900    # Eject if success rate > 1.9 stdev below mean
    
    # After ejection, the host undergoes exponential backoff before readmission:
    # 1st ejection: 30s, 2nd ejection: 60s, 3rd: 120s, ... max: 300s
```

**Passive vs active trade-off:**

| Dimension | Active | Passive |
|---|---|---|
| Detection speed | Interval-bounded (3s default) | Immediate (next real request) |
| False positives | Possible (synthetic ≠ real traffic) | Low (based on real traffic) |
| Traffic to backends | Additional (health check load) | Zero overhead |
| Works without traffic | Yes | No (needs real requests to detect) |
| Depth | /healthz only | Full request/response semantics |

**Production pattern:** Use both. Active health checking prevents any traffic to truly dead backends. Passive outlier detection catches subtly unhealthy backends that pass /healthz but fail real requests (partial DB lock, slow CPU, memory pressure causing slow responses).

---

### 4. Connection Draining: Zero-Downtime Deployments

Connection draining (also called "graceful shutdown" or "deregistration delay") is the mechanism that allows in-flight requests to complete before a backend is removed from the load balancer pool.

#### The Problem Without Connection Draining

```
Deployment without connection draining:
  T+0:00  Deployment starts. 20 backends, each handling ~5000 req/s.
  T+0:01  Kubernetes sends SIGTERM to backend1's container.
  T+0:01  Load balancer has 230 in-flight requests to backend1.
  T+0:02  Container exits immediately on SIGTERM.
  T+0:02  230 in-flight requests receive TCP RST (connection reset).
  T+0:02  Clients see: ERR_CONNECTION_RESET / 502 Bad Gateway.
  
  With 10-minute rolling deployment (1 pod at a time):
  10 pod restarts × 230 reset connections = 2,300 errors per deployment
  User-visible error rate spike during every deploy.
```

#### Connection Draining Implementation

```
Connection draining with SIGTERM → Graceful shutdown:

  T+0:00  Kubernetes sends SIGTERM to pod
  T+0:00  Load balancer receives deregistration signal
           (Kubernetes → cloud LB API: "remove backend1 from pool")
          
  T+0:00  Pod: receives SIGTERM → starts graceful shutdown sequence:
    1. Remove itself from service discovery (Consul, Kubernetes Endpoints)
    2. Stop accepting NEW connections (close listen socket or set readiness=false)
    3. Allow existing connections to complete
    4. Wait up to terminationGracePeriodSeconds (default: 30s)
    5. Exit cleanly (or SIGKILL after grace period)
    
  T+0:05  Last in-flight request completes on backend1.
  T+0:05  backend1 exits cleanly.
  T+0:05  Zero in-flight requests disrupted. Zero client errors.
  
  AWS ALB: "deregistration_delay" = 300s (wait up to 300s for in-flight to drain)
  GCP LB: "drain_timeout_sec" = 300s
  Envoy: "drain_time_s" = 600s
```

**Kubernetes preStop hook for graceful shutdown:**

```yaml
# kubernetes/deployment.yaml
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 60  # Must be > preStop sleep + app drain time
      containers:
        - name: api-server
          lifecycle:
            preStop:
              exec:
                command:
                  - /bin/sh
                  - -c
                  # Sleep 5s: allows Kubernetes Endpoints controller to propagate
                  # the pod removal to all load balancers and Envoy sidecars.
                  # Without this sleep, new requests may still be routed to the
                  # pod for ~5s after SIGTERM because of controller propagation delay.
                  - "sleep 5"
          
          # The app must handle SIGTERM gracefully:
          # 1. Stop accepting new connections
          # 2. Finish in-flight requests
          # 3. Exit
          # Time budget: terminationGracePeriodSeconds - preStop duration
          #            = 60s - 5s = 55s for in-flight requests to complete
```

**Go graceful shutdown:**

```go
package main

import (
    "context"
    "log"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"
)

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("/api/products", productsHandler)
    mux.HandleFunc("/readyz", readinessHandler)
    mux.HandleFunc("/healthz", livenessHandler)
    
    server := &http.Server{
        Addr:    ":8080",
        Handler: mux,
    }
    
    // Start server in background goroutine
    go func() {
        log.Println("Server listening on :8080")
        if err := server.ListenAndServe(); err != http.ErrServerClosed {
            log.Fatalf("ListenAndServe: %v", err)
        }
    }()
    
    // Wait for shutdown signal
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
    sig := <-quit
    
    log.Printf("Received signal %v — initiating graceful shutdown", sig)
    
    // Create context with timeout for graceful shutdown
    // Must complete within terminationGracePeriodSeconds - preStop sleep
    ctx, cancel := context.WithTimeout(context.Background(), 50*time.Second)
    defer cancel()
    
    // Shutdown: stop accepting new connections, wait for in-flight to complete
    if err := server.Shutdown(ctx); err != nil {
        log.Printf("Server shutdown error (forced): %v", err)
    }
    
    log.Println("Server shut down cleanly")
}
```

---

### 5. Global Load Balancing and Anycast Routing

For globally distributed applications, routing users to the nearest regional endpoint is critical for latency. A user in Sydney connecting to a US-East origin experiences:

```
Sydney → US-East (AWS us-east-1):
  Physical distance: ~16,000 km
  Speed of light in fiber: ~200,000 km/s (2/3 of c)
  One-way transit: 16,000 / 200,000 = 80ms
  Round-trip: 160ms minimum
  With TCP handshake + TLS: 160ms × 2 = 320ms before first byte
  
Sydney → Sydney/Singapore (nearest PoP):
  Distance: ~650 km to Singapore
  One-way: 650 / 200,000 = 3.25ms
  Round-trip: 6.5ms minimum
  With TCP + TLS: 13ms before first byte
  
Latency improvement: 320ms → 13ms = 24x faster for Sydney users
```

#### Anycast Routing

Anycast is a routing technique where multiple servers worldwide share the same IP address. BGP routing protocol ensures each client connects to the nearest (topologically) instance of that IP.

```
Anycast IP: 104.16.0.0/12 (Cloudflare's range — example)

Cloudflare announces 104.16.0.0/12 from:
  - Frankfurt PoP (AS13335, via DE-CIX peering)
  - London PoP (AS13335, via LINX peering)
  - New York PoP (AS13335, via Equinix-NY peering)
  - Singapore PoP (AS13335, via Equinix-SG peering)
  - Sydney PoP (AS13335, via Equinix-SY peering)
  - ... 300+ cities

Client in Frankfurt:
  DNS: api.example.com → 104.16.0.1 (Cloudflare Anycast IP)
  BGP routing table at Frankfurt ISP: 
    104.16.0.0/12 via AS13335 (Frankfurt PoP) — distance 0 hops
    104.16.0.0/12 via AS13335 (London PoP) — distance 3 hops
  → Traffic routes to Frankfurt PoP automatically

Client in Sydney:
  Same DNS response: api.example.com → 104.16.0.1
  Sydney ISP BGP routing table:
    104.16.0.0/12 via AS13335 (Sydney PoP) — distance 1 hop
    104.16.0.0/12 via AS13335 (Singapore PoP) — distance 4 hops
  → Traffic routes to Sydney PoP automatically

No DNS change needed for geographic routing.
BGP handles it automatically, sub-second rerouting on PoP failure.
```

#### AWS Global Accelerator vs Cloudflare

```
AWS Global Accelerator:
  Two static Anycast IPs (stable, no DNS propagation delay)
  AWS backbone routing (not public internet between PoP and origin)
  PoPs in 30+ countries
  Accelerates TCP/UDP (not just HTTP)
  Good for: Any TCP workload, gaming, IoT, mixed protocols
  
  Architecture:
  Client → Nearest AWS Edge PoP → AWS backbone → Regional origin
  Public internet: client → edge only (typically <50ms)
  AWS backbone: edge → origin (dedicated, low-jitter)

Cloudflare (reverse proxy mode):
  True Anycast across 300+ cities (largest PoP footprint)
  CDN caching at the edge (cacheable responses never hit origin)
  WAF, DDoS mitigation, Bot Management at edge
  HTTP/3 (QUIC) support to clients
  
  Architecture:
  Client → Cloudflare edge (one hop, nearest city)
           → Cache hit: respond from edge (0 origin requests)
           → Cache miss: Cloudflare → origin (Argo Smart Routing optimizes path)

GeoDNS vs Anycast:
  GeoDNS: DNS server returns different A record based on client's resolver IP
    Problem: DNS TTL means stale routing for minutes; resolver IP ≠ client IP (CDN proxies)
  Anycast: Same IP globally, BGP routing selects nearest node
    Better: Sub-second failover, exact routing based on network topology
    Use case: Latency-critical, high-availability global services
```

---

### 6. TLS Termination Strategies

TLS can be terminated at different points in the request path, each with distinct security and performance trade-offs.

```
Strategy 1: Edge Termination (most common)
  Client → [TLS] → Load Balancer/CDN → [HTTP] → Backend
  
  Pros:  Central certificate management, offloads crypto from backends,
         backends see plaintext (easier debugging, logging)
  Cons:  Traffic between LB and backend is unencrypted (trust the internal network)
  
Strategy 2: Passthrough (TLS tunnel)
  Client → [TLS] → Load Balancer (routes by SNI only) → [TLS] → Backend
  
  Pros:  End-to-end encryption, backend sees the real TLS session
  Cons:  L7 LB cannot inspect HTTP content; routes by Server Name Indication (SNI)
         only; backend must manage its own certificates
  Use:   Financial/compliance requirements, mTLS from client to backend

Strategy 3: Re-encryption (Terminate + Re-Encrypt)
  Client → [TLS] → Load Balancer → [TLS] → Backend
  
  Pros:  L7 LB can inspect and route; internal traffic also encrypted
  Cons:  Two TLS sessions, certificate management at LB AND backend
  Use:   Service mesh (Istio terminates client TLS, re-encrypts with mTLS to pods)

Strategy 4: mTLS End-to-End
  Client → [mTLS] → API Gateway → [mTLS] → Service A → [mTLS] → Service B
  
  mTLS: Both sides present certificates (client AND server)
  Provides: Identity verification of clients, not just servers
  Use:   Zero-trust network, microservice-to-microservice auth (Chapter 15)
```

**TLS termination at the API gateway with certificate automation:**

```nginx
# Nginx TLS termination with Let's Encrypt (Certbot)
server {
    listen 443 ssl http2;
    server_name api.example.com;
    
    # Certificate managed by cert-manager or Certbot
    ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;
    
    # Modern TLS configuration (Mozilla Intermediate)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;  # Let client choose (TLS 1.3 does this anyway)
    
    # Session resumption (avoids full handshake on reconnect)
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;  # Disable for perfect forward secrecy
    
    # HSTS: tell browsers to always use HTTPS for this domain
    add_header Strict-Transport-Security "max-age=63072000" always;
    
    # Proxy to backend (HTTP, internal network)
    location /api/ {
        proxy_pass http://backend_pool;
        proxy_http_version 1.1;
        proxy_set_header Connection "";  # Enable keepalive to backend
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

### 7. API Gateway: Policy Enforcement Layer

The API gateway is the policy enforcement point for your entire API surface. It sits between the load balancer and your backend services, handling cross-cutting concerns so backends don't need to.

#### Authentication Offloading

```python
# Kong API Gateway plugin configuration (declarative YAML)
# kong.yml

services:
  - name: products-service
    url: http://products-service:8080
    routes:
      - name: products-route
        paths: ["/api/v1/products"]
        methods: ["GET", "POST", "PUT"]
    
    plugins:
      # JWT validation — performed at gateway, not at service
      - name: jwt
        config:
          key_claim_name: kid             # Key ID claim in JWT header
          claims_to_verify: [exp, nbf]    # Verify expiry and not-before
          uri_param_names: []             # Only Authorization header, no query param
          secret_is_base64: false
      
      # Rate limiting per consumer (authenticated user)
      - name: rate-limiting
        config:
          minute: 1000        # 1000 requests per minute per consumer
          hour: 50000         # 50,000 per hour
          policy: redis       # Distributed counter (not per-node)
          redis_host: redis-cluster
          redis_port: 6379
          fault_tolerant: true  # If Redis unavailable, allow traffic (fail open)
      
      # Request size limiting
      - name: request-size-limiting
        config:
          allowed_payload_size: 10  # MB
          require_content_length: true
      
      # Response caching
      - name: proxy-cache
        config:
          response_code: [200, 301, 404]
          request_method: ["GET", "HEAD"]
          cache_ttl: 300           # 5 minutes
          strategy: memory         # or redis for distributed cache
```

#### JWT Validation at the Gateway Layer

```go
// API Gateway JWT middleware (standalone Envoy/custom gateway)
package middleware

import (
    "context"
    "fmt"
    "net/http"
    "strings"
    "time"
    
    "github.com/golang-jwt/jwt/v5"
)

type Claims struct {
    UserID    string   `json:"sub"`
    Email     string   `json:"email"`
    Roles     []string `json:"roles"`
    TenantID  string   `json:"tenant_id"`
    jwt.RegisteredClaims
}

type JWTMiddleware struct {
    publicKeys map[string]interface{}  // kid → public key (JWKS)
    audience   string
    issuer     string
}

func (m *JWTMiddleware) Authenticate(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Extract token from Authorization header
        authHeader := r.Header.Get("Authorization")
        if authHeader == "" {
            http.Error(w, `{"error":"missing_authorization"}`, http.StatusUnauthorized)
            return
        }
        
        parts := strings.SplitN(authHeader, " ", 2)
        if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
            http.Error(w, `{"error":"invalid_authorization_format"}`, http.StatusUnauthorized)
            return
        }
        tokenString := parts[1]
        
        // Parse and validate JWT
        token, err := jwt.ParseWithClaims(
            tokenString,
            &Claims{},
            func(token *jwt.Token) (interface{}, error) {
                // Verify signing algorithm (NEVER accept 'none' algorithm)
                if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
                    return nil, fmt.Errorf("unexpected signing method: %v",
                        token.Header["alg"])
                }
                
                // Look up public key by key ID (kid) from JWKS
                kid, ok := token.Header["kid"].(string)
                if !ok {
                    return nil, fmt.Errorf("missing key ID in token header")
                }
                
                key, exists := m.publicKeys[kid]
                if !exists {
                    // Refresh JWKS if kid not found (key rotation)
                    m.refreshJWKS()
                    key, exists = m.publicKeys[kid]
                    if !exists {
                        return nil, fmt.Errorf("unknown key ID: %s", kid)
                    }
                }
                return key, nil
            },
        )
        
        if err != nil || !token.Valid {
            http.Error(w, `{"error":"invalid_token"}`, http.StatusUnauthorized)
            return
        }
        
        claims, ok := token.Claims.(*Claims)
        if !ok {
            http.Error(w, `{"error":"invalid_claims"}`, http.StatusUnauthorized)
            return
        }
        
        // Validate audience and issuer
        if claims.Audience[0] != m.audience {
            http.Error(w, `{"error":"invalid_audience"}`, http.StatusUnauthorized)
            return
        }
        
        // Propagate validated identity to downstream services
        // Backend services trust these headers (they come from authenticated gateway)
        r = r.WithContext(context.WithValue(r.Context(), "user_id", claims.UserID))
        r.Header.Set("X-User-ID", claims.UserID)
        r.Header.Set("X-User-Email", claims.Email)
        r.Header.Set("X-Tenant-ID", claims.TenantID)
        r.Header.Set("X-User-Roles", strings.Join(claims.Roles, ","))
        
        // Remove the JWT from the request before forwarding to backend
        // (backends don't need to re-validate; trust the gateway headers)
        r.Header.Del("Authorization")
        
        next.ServeHTTP(w, r)
    })
}
```

#### Circuit Breaking at the Gateway

```go
// Circuit breaker with three states: Closed, Open, Half-Open
package circuitbreaker

import (
    "errors"
    "sync"
    "time"
)

type State int

const (
    StateClosed   State = iota // Normal operation: requests pass through
    StateOpen                   // Failures exceeded threshold: block all requests
    StateHalfOpen              // Testing recovery: allow one request through
)

var ErrCircuitOpen = errors.New("circuit breaker is open")

type CircuitBreaker struct {
    mu sync.Mutex
    
    state          State
    failureCount   int
    successCount   int
    lastFailureAt  time.Time
    nextHalfOpenAt time.Time
    
    // Configuration
    failureThreshold  int           // Open after N consecutive failures
    successThreshold  int           // Close after N consecutive successes in half-open
    timeout           time.Duration // Time in Open state before trying half-open
    halfOpenTimeout   time.Duration // Max time to wait in half-open state
}

func NewCircuitBreaker(failureThreshold, successThreshold int,
    timeout, halfOpenTimeout time.Duration) *CircuitBreaker {
    return &CircuitBreaker{
        failureThreshold: failureThreshold,
        successThreshold: successThreshold,
        timeout:          timeout,
        halfOpenTimeout:  halfOpenTimeout,
    }
}

func (cb *CircuitBreaker) Execute(fn func() error) error {
    cb.mu.Lock()
    
    switch cb.state {
    case StateOpen:
        if time.Now().Before(cb.nextHalfOpenAt) {
            cb.mu.Unlock()
            return ErrCircuitOpen  // Fast-fail: don't even attempt the request
        }
        // Transition to half-open: allow one probe request
        cb.state = StateHalfOpen
        cb.successCount = 0
        cb.mu.Unlock()
        
    case StateHalfOpen:
        cb.mu.Unlock()
        // Half-open: allow the probe request through
        
    case StateClosed:
        cb.mu.Unlock()
    }
    
    // Execute the request
    err := fn()
    
    cb.mu.Lock()
    defer cb.mu.Unlock()
    
    if err != nil {
        cb.failureCount++
        cb.lastFailureAt = time.Now()
        cb.successCount = 0
        
        if cb.state == StateHalfOpen || cb.failureCount >= cb.failureThreshold {
            // Open the circuit
            cb.state = StateOpen
            cb.nextHalfOpenAt = time.Now().Add(cb.timeout)
        }
        return err
    }
    
    // Success
    cb.failureCount = 0
    if cb.state == StateHalfOpen {
        cb.successCount++
        if cb.successCount >= cb.successThreshold {
            cb.state = StateClosed  // Recovery confirmed: close circuit
        }
    }
    return nil
}
```

---

### 8. Netflix Zuul2: Adaptive Concurrency Limiting

Netflix's Zuul2 API gateway implements gradient-based adaptive concurrency limiting — a more sophisticated alternative to fixed rate limits that automatically adjusts to backend capacity.

#### The Problem with Fixed Rate Limits

```
Fixed rate limit: 1000 RPS per endpoint
  
Normal operation: Backend handles 1000 RPS at 50ms latency
GC pause event: Backend slows to 500ms latency
  → 1000 RPS × 500ms = 500 concurrent requests queued
  → Queue grows faster than it drains
  → Memory exhaustion → OOM kill → cascade failure
  
The fixed rate limit was calibrated for normal conditions.
It doesn't account for reduced backend capacity during slowdowns.
```

#### Gradient-Based Concurrency Limiter

```python
"""
Netflix Adaptive Concurrency Limiter (simplified)
Based on: https://github.com/Netflix/concurrency-limits

Core insight: Use Little's Law to dynamically calculate
the optimal concurrency limit.

Little's Law: L = λ × W
  L = average number of requests in the system
  λ = average arrival rate (RPS)
  W = average time in system (latency)

If latency increases from W to W':
  To keep L stable (not grow queue): λ must decrease proportionally
  New limit = Old limit × (W_min / W')
  
  W_min = minimum observed latency (system at lowest load)
  W'    = current average latency
  ratio = W_min / W' ∈ (0, 1]
  
  ratio = 1.0: Current latency = historical minimum → full capacity
  ratio = 0.5: Current latency = 2× minimum → reduce limit by 50%
  ratio = 0.1: Current latency = 10× minimum → reduce limit by 90%
"""

import math
import threading
import time
from dataclasses import dataclass


@dataclass
class Sample:
    latency_ms: float
    inflight: int
    success: bool
    timestamp: float = field(default_factory=time.time)


class GradientConcurrencyLimiter:
    """
    Gradient-based adaptive concurrency limiter.
    
    Automatically adjusts the concurrency limit based on:
    1. Gradient: ratio of minimum observed RTT to current RTT
    2. Queue size: proactively shed load before queues grow
    """
    
    def __init__(
        self,
        initial_limit: int = 100,
        min_limit: int = 1,
        max_limit: int = 1000,
        smoothing: float = 0.2,        # EWMA smoothing for limit changes
        rtt_tolerance: float = 1.5,    # Allow 50% RTT increase before shedding
    ):
        self._limit = initial_limit
        self._min_limit = min_limit
        self._max_limit = max_limit
        self._smoothing = smoothing
        self._rtt_tolerance = rtt_tolerance
        
        self._inflight = 0
        self._min_rtt_ms = float('inf')
        self._current_rtt_ms = 0.0
        
        self._lock = threading.Lock()
        self._window_samples: list[Sample] = []
        self._window_start = time.time()
        self._window_duration = 1.0  # 1 second measurement window
    
    def acquire(self) -> bool:
        """
        Try to acquire a slot. Returns True if allowed, False if rejected.
        Call release() after the request completes.
        """
        with self._lock:
            if self._inflight >= self._limit:
                return False  # Reject: at or over limit
            self._inflight += 1
            return True
    
    def release(self, latency_ms: float, success: bool):
        """Call after request completes."""
        with self._lock:
            self._inflight -= 1
            
            sample = Sample(
                latency_ms=latency_ms,
                inflight=self._inflight,
                success=success,
            )
            self._window_samples.append(sample)
            
            # Update min RTT (ignore failed requests)
            if success and latency_ms < self._min_rtt_ms:
                self._min_rtt_ms = latency_ms
            
            # Recalculate limit at end of measurement window
            now = time.time()
            if now - self._window_start >= self._window_duration:
                self._update_limit()
                self._window_samples = []
                self._window_start = now
    
    def _update_limit(self):
        """Recalculate concurrency limit based on gradient."""
        if not self._window_samples:
            return
        
        # Average RTT for this window
        successful = [s for s in self._window_samples if s.success]
        if not successful:
            # All requests failed: aggressively reduce limit
            new_limit = max(self._min_limit, self._limit // 2)
            self._limit = int(self._limit * (1 - self._smoothing) +
                             new_limit * self._smoothing)
            return
        
        avg_rtt = sum(s.latency_ms for s in successful) / len(successful)
        self._current_rtt_ms = avg_rtt
        
        # Gradient: ratio of minimum (no-load) RTT to current RTT
        # Higher gradient → closer to no-load → can increase limit
        # Lower gradient → current latency degraded → reduce limit
        gradient = self._min_rtt_ms / (avg_rtt * self._rtt_tolerance)
        gradient = max(0.5, min(1.5, gradient))  # Clamp to prevent instability
        
        # New limit: current limit × gradient
        # + small additive term to allow probing higher limits
        new_limit = self._limit * gradient + math.sqrt(self._limit)
        
        # EWMA smoothing: don't change limit abruptly
        smoothed_limit = (
            self._limit * (1 - self._smoothing) +
            new_limit * self._smoothing
        )
        
        self._limit = int(max(self._min_limit,
                          min(self._max_limit, smoothed_limit)))
    
    @property
    def limit(self) -> int:
        return self._limit
    
    @property
    def inflight(self) -> int:
        return self._inflight


# Usage in API gateway handler
limiter = GradientConcurrencyLimiter(initial_limit=100)

def handle_request(request):
    if not limiter.acquire():
        # Shed load: return 429 immediately without calling backend
        return Response(429, {"error": "too_many_requests", 
                              "retry_after": "1"})
    
    start = time.time()
    try:
        response = call_backend(request)
        return response
    except Exception as e:
        limiter.release(
            latency_ms=(time.time() - start) * 1000,
            success=False
        )
        raise
    finally:
        limiter.release(
            latency_ms=(time.time() - start) * 1000,
            success=True
        )
```

**Why gradient-based limits outperform fixed limits:**

```
Scenario: Backend normally handles 1000 RPS at 20ms latency.
  Minimum RTT (no load): 15ms
  Normal RTT: 20ms
  Gradient: 15/20 = 0.75 (slightly below 1 → slight limit reduction)
  Limit: 100 × 0.75 + sqrt(100) = 85 (healthy — allows probing)

Database slowdown: Backend latency spikes to 200ms.
  Gradient: 15/200 = 0.075 (severely degraded)
  New limit: 100 × 0.075 + sqrt(100) = 17.5 → limit ≈ 18
  
  System automatically sheds 82% of traffic, returning 429
  Queue: 18 concurrent × 200ms = 3.6 seconds of work in flight (manageable)
  
  With fixed 1000 RPS limit:
  1000 RPS × 200ms = 200 concurrent → 200,000ms of queued work
  Queue grows unboundedly → OOM → cascade failure
  
Database recovers: Latency returns to 20ms.
  Gradient recovers toward 1.0
  Limit gradually increases back to ~100 over 5-10 seconds
  Traffic automatically recovers without manual intervention
```

---

### 9. Request Routing Patterns

#### Path-Based Routing

```nginx
# Nginx: path-based routing to different service pools
upstream products_pool {
    least_conn;
    server products1:8080;
    server products2:8080;
    server products3:8080;
    keepalive 32;  # Persistent connections to backends
}

upstream orders_pool {
    least_conn;
    server orders1:8080;
    server orders2:8080;
    keepalive 32;
}

upstream users_pool {
    server users1:8080;
    server users2:8080;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    
    # Route by path prefix
    location /api/v1/products {
        proxy_pass http://products_pool;
    }
    
    location /api/v1/orders {
        proxy_pass http://orders_pool;
    }
    
    location /api/v1/users {
        proxy_pass http://users_pool;
    }
    
    # Default: 404
    location / {
        return 404 '{"error":"not_found"}';
    }
}
```

#### Canary Deployment via Weighted Routing

```nginx
# Nginx: canary deployment (5% to new version, 95% to stable)
upstream stable_pool {
    server stable1:8080 weight=95;
    server stable2:8080 weight=95;
}

upstream canary_pool {
    server canary1:8080 weight=5;
}

# Split traffic using split_clients module (Nginx)
split_clients "${remote_addr}${request_uri}${http_user_agent}" $backend_pool {
    5%     canary_pool;
    *      stable_pool;
}

# Or use Envoy's weighted cluster routing (more flexible):
# routes:
#   - match:
#       prefix: "/api/"
#     route:
#       weighted_clusters:
#         clusters:
#           - name: stable_cluster
#             weight: 95
#           - name: canary_cluster
#             weight: 5
```

#### Header-Based Routing (Feature Flags)

```python
# Envoy filter chain: route by header value
# config/envoy.yaml (simplified route configuration)
route_config:
  virtual_hosts:
    - name: api
      domains: ["api.example.com"]
      routes:
        # Internal users (with X-Internal-User: true) → canary
        - match:
            prefix: "/api/"
            headers:
              - name: "X-Internal-User"
                exact_match: "true"
          route:
            cluster: canary_cluster
        
        # Beta users (with X-Beta-User: true) → canary
        - match:
            prefix: "/api/"
            headers:
              - name: "X-Beta-User"
                exact_match: "true"
          route:
            cluster: canary_cluster
        
        # Everyone else → stable
        - match:
            prefix: "/api/"
          route:
            cluster: stable_cluster
```

---

### 10. Reverse Proxy vs API Gateway vs Service Mesh Ingress

These three components are often confused. Each has a distinct responsibility:

```
Reverse Proxy (Nginx, HAProxy):
  Responsibility: Traffic distribution + TLS termination
  Location: Between internet and application tier
  Features: Load balancing, SSL/TLS, compression, static file serving,
            basic access control, connection pooling
  Does NOT do: JWT validation, API key management, request transformation,
               distributed rate limiting, service discovery
  Cost: Very low overhead (~100µs per request)
  When: Simple setups, static sites, a single backend application

API Gateway (Kong, AWS API GW, Apigee, custom):
  Responsibility: Policy enforcement for APIs
  Location: Between reverse proxy and backend services
  Features: Authentication (JWT, API keys, OAuth2), authorization (RBAC),
            rate limiting (per user/key/IP), request/response transformation,
            versioning, developer portal, analytics
  Does NOT do: Service-to-service traffic (only north-south: client → service)
  Cost: Medium overhead (~1-5ms per request for JWT validation, Redis rate limit)
  When: Public APIs with developer access, multi-tenant SaaS, API monetization

Service Mesh Ingress (Istio IngressGateway, Linkerd Gateway):
  Responsibility: Controlled entry into the service mesh
  Location: Between API gateway and mesh interior
  Features: mTLS termination from external, traffic policies for mesh-internal traffic,
            canary deployments within the mesh, distributed tracing injection
  Does NOT do: Business-level auth (that's the API gateway's job)
  Cost: Low overhead (Envoy-based, ~500µs per request)
  When: Kubernetes clusters with Istio/Linkerd, complex east-west traffic policies

Correct layering:
  Internet → [CDN/Anycast] → [L7 LB] → [API Gateway] → [Service Mesh Ingress] → [Services]
  
  Not every system needs every layer:
  Small: [Nginx LB + auth middleware in app] ← totally valid for <$1M ARR
  Medium: [ALB] → [Kong] → [Services] ← common pattern for growing platforms
  Large: [Global LB] → [Envoy Proxy] → [Kong] → [Istio Ingress] → [Services]
```

---

## Step-by-Step Execution: Request Lifecycle Through the Full Edge Stack

Let's trace `GET /api/v1/products/42` from a client in Sydney to a backend in US-East-1 with a full edge stack:

```
Step 1: DNS Resolution (client in Sydney)
  Client: DNS resolve api.example.com
  Response: 104.16.0.1 (Cloudflare Anycast IP)
  BGP routing: Sydney ISP routes to Cloudflare Sydney PoP (5ms RTT)

Step 2: TLS Handshake at Cloudflare Sydney PoP
  Client → SYN → Cloudflare Sydney PoP (5ms RTT)
  TLS 1.3 handshake: 1 RTT = 5ms
  Total to first byte of request: 10ms (2 RTTs: TCP + TLS)
  Compare to US-East direct: 160ms × 2 RTTs = 320ms

Step 3: HTTP/2 Request at Cloudflare Edge
  Request arrives: GET /api/v1/products/42
  Cache check: miss (dynamic data)
  WAF rules: No SQL injection, XSS, OWASP top 10 patterns → PASS
  DDoS check: Client IP not in blocklist → PASS
  Forward to origin (US-East-1) via Cloudflare's backbone network

Step 4: Request arrives at AWS ALB (Regional L7 LB)
  ALB terminates TLS (re-encrypted by Cloudflare)
  Health check: All 3 API gateway instances → HEALTHY
  Routing: Host: api.example.com → API Gateway target group
  Algorithm: Least outstanding requests
  Selected: api-gateway-instance-2 (fewest in-flight requests)

Step 5: API Gateway (Kong) processes request
  a. JWT validation (5ms):
     Extract Bearer token from Authorization header
     Verify signature against JWKS endpoint (cached)
     Validate exp, aud, iss claims
     Decode: {user_id: "u123", roles: ["user"], tenant: "acme"}
  
  b. Rate limiting check (2ms):
     Redis INCR: rate:user:u123:products:minute → 47 (< 1000 limit)
     Redis INCR: rate:tenant:acme:products:minute → 1247 (< 10000 limit)
     Both pass
  
  c. Request transformation (0.1ms):
     Add: X-User-ID: u123
     Add: X-Tenant-ID: acme
     Add: X-Request-ID: req-7a9f2c (unique trace ID)
     Remove: Authorization header
  
  d. Route selection:
     Path: /api/v1/products/42
     Version: v1 → products-v1 service
     Circuit breaker: CLOSED (healthy)

Step 6: Service Mesh Ingress (Istio IngressGateway)
  mTLS termination: Verify Kong's certificate (identity: api-gateway)
  Re-encrypt with mTLS for products-service sidecar
  Traffic routing: 95% → stable pod pool, 5% → canary pool
  Selected: products-service-stable-7d6f8b-pod3

Step 7: Products Service backend (Pod)
  Receives request (mTLS decrypted by Envoy sidecar)
  Headers: X-User-ID, X-Tenant-ID, X-Request-ID available
  Application code: SELECT * FROM products WHERE id=42 AND tenant=acme
  Cache check: Redis L2 HIT → return cached product (0.2ms)

Step 8: Response path (reverse of request):
  Pod → Envoy sidecar (mTLS) → Istio Ingress → Kong (logs response)
  → ALB → Cloudflare backbone → Cloudflare Sydney PoP → Client

Total latency breakdown:
  Cloudflare edge (Sydney) ↔ Client: 10ms (TLS + network)
  Cloudflare → AWS ALB: 30ms (backbone, Sydney → US-East-1)
  ALB → Kong → Istio → Pod: 8ms (internal routing + JWT + rate limit)
  Products service (cache hit): 1ms
  Response return: 40ms (same path back)
  
  Total: ~89ms observed from Sydney client
  vs. 320ms+ without edge PoP (direct to US-East-1)
```

---

## Real-World Example: Cloudflare's Railgun and Origin Connect Architecture

Cloudflare's architecture is one of the most studied edge systems. Their approach to origin connectivity illustrates several key principles.

### The Dynamic Content Problem

CDNs excel at caching static content (images, CSS, JS). Dynamic content (API responses, personalized pages) cannot be cached — it must be fetched from the origin on every request. For dynamic content, the edge provides:

1. **TCP connection reuse:** Instead of new TCP+TLS to origin per user request, maintain persistent connection pools from each PoP to the origin. A Frankfurt PoP with 10,000 concurrent users might reuse just 100 persistent connections to the origin.

2. **Argo Smart Routing:** Cloudflare probes multiple backbone paths between its PoP and the origin and routes via the fastest one — bypassing public internet congestion. Typical improvement: 30% latency reduction for dynamic content.

3. **Railgun (deprecated, now Cloudflare Tunnel):** A persistent encrypted tunnel between the origin and Cloudflare, eliminating repeated TLS handshakes and TCP slow-start for every origin request.

```
Without Cloudflare:
  Client → [public internet] → Origin (full RTT + TLS every time)

With Cloudflare:
  Client → Cloudflare PoP [5ms] → Cloudflare backbone → Origin PoP
  Cloudflare PoP → Origin: persistent mTLS tunnel (no per-request handshake)
  
  Client sees: 5ms to PoP (edge termination)
  PoP → Origin: 40ms (backbone, reused connection)
  Total: ~45ms vs ~320ms without edge
```

### Cloudflare Workers: Compute at the Edge

Cloudflare Workers runs JavaScript/WebAssembly at the edge, 300+ locations globally, with cold start < 5ms:

```javascript
// Cloudflare Worker: edge-side API gateway logic
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Geo-based routing: send APAC users to Singapore origin
  const cf = request.cf
  if (['AU', 'NZ', 'JP', 'KR', 'SG', 'IN'].includes(cf.country)) {
    url.hostname = 'api-apac.example.com'
  } else if (['DE', 'FR', 'GB', 'NL'].includes(cf.country)) {
    url.hostname = 'api-eu.example.com'
  } else {
    url.hostname = 'api-us.example.com'
  }
  
  // Edge-side rate limiting (using Durable Objects for distributed state)
  const clientIP = request.headers.get('CF-Connecting-IP')
  const rateLimitId = env.RATE_LIMITER.idFromName(clientIP)
  const rateLimiter = env.RATE_LIMITER.get(rateLimitId)
  
  const rateLimitResponse = await rateLimiter.fetch(request)
  if (rateLimitResponse.status === 429) {
    return new Response(JSON.stringify({error: 'rate_limit_exceeded'}), {
      status: 429,
      headers: {'Content-Type': 'application/json', 'Retry-After': '1'}
    })
  }
  
  // Forward to selected origin
  const response = await fetch(new Request(url.toString(), request))
  
  // Add edge-side headers
  const modifiedResponse = new Response(response.body, response)
  modifiedResponse.headers.set('X-Served-By', 'cloudflare-edge')
  modifiedResponse.headers.set('X-Origin-Region', url.hostname)
  
  return modifiedResponse
}
```

---

## Failure Scenarios

### Scenario 1: Health Check Flapping Cascade Failure

**Date:** October 2022 (composite of documented incidents).  
**Company:** E-commerce platform, 200 million users.

**What Happened:**

The platform's product service was under elevated load during a sale. One of 20 backend pods was experiencing intermittent GC pauses (300-600ms pause, every 2-3 minutes). During GC pauses, the pod's /healthz endpoint responded slowly (500ms) — exceeding the ALB's health check timeout of 200ms.

The ALB configured with `healthy_threshold=2, unhealthy_threshold=2, interval=5s`:
- At T+0: Pod GC pause begins. /healthz times out. Health check FAIL (1st).
- At T+5: GC pause ends. /healthz responds 10ms. Health check PASS. Resets fail counter.
- At T+7: Next GC pause. /healthz timeout. FAIL (1st again).
- Pattern: Pod constantly oscillates between HEALTHY and UNHEALTHY.

Because the pod was constantly flapping, the ALB was continuously draining and re-adding connections to this pod. During each drain cycle, ~500 in-flight requests were dropped. This happened every 2-3 minutes.

Meanwhile, each drain event caused the remaining 19 pods to receive a surge of the flapping pod's traffic. Those pods began experiencing elevated latency. Their health checks started failing. 3 more pods began flapping. The cascade reduced effective pool size from 20 to 8 pods, overloading those 8, causing further health check failures.

**Root Cause:**

1. Health check timeout (200ms) was too tight — GC pause longer than timeout
2. `unhealthy_threshold=2` too low — transient GC pause treated as failure
3. No GC tuning (JVM heap sized too small, frequent GC cycles)
4. No circuit breaker preventing cascade on pool reduction

**Fix Applied:**

```
Immediate:
  - ALB: increase health check timeout to 2000ms (2s)
  - ALB: increase unhealthy_threshold to 3 (3 consecutive failures required)
  - ALB: increase interval to 10s (reduces flapping sensitivity)
  - JVM: -Xmx8G → -Xmx24G (reduce GC frequency by 3x)
  
Long-term:
  - Migrate from CMS GC to G1GC (shorter, more predictable pauses)
  - Add passive outlier detection in Envoy (remove pods based on real traffic, not synthetic pings)
  - Add circuit breaker: if pool size drops below 50%, stop draining any more pods
  - Separate liveness (/healthz) from readiness (/readyz):
    /healthz: pass unless process is deadlocked (very permissive)
    /readyz: fail during GC pause if desired (remove from LB, don't kill pod)
```

---

### Scenario 2: Missing Connection Drain Causing Deployment Error Spike

**Date:** Ongoing at many companies until they learn this lesson.  
**Company:** Mid-size SaaS company.

**What Happened:**

Every deployment caused a 2-minute window where ~10% of requests returned 502. Users noticed. Engineers thought it was a "deployment bug" in their application.

Root cause: Kubernetes terminated pods immediately on `SIGTERM`. The pod exited within 100ms. The ALB had a 5-second health check interval. During those 5 seconds, the ALB continued routing to the terminated pod's IP. Those requests received TCP RST → 502 errors.

10% error rate during 2-minute deployments × 8 deployments/day = 16 minutes of degraded service daily.

**Fix:**

```yaml
# kubernetes/deployment.yaml
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 60
      containers:
        - name: api-server
          lifecycle:
            preStop:
              exec:
                command: ["sleep", "15"]
          # 15s sleep > ALB health check deregistration propagation (~10-15s)
          # App has 45s (60 - 15) to finish in-flight requests
```

```go
// app/main.go: graceful shutdown
signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
<-quit

ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
defer cancel()
server.Shutdown(ctx)  // Stops accepting new connections, drains in-flight
```

Result: Zero 502 errors during subsequent deployments.

---

## Performance Considerations

### Load Balancer Throughput Benchmarks (2024)

```
Component                  Throughput              Latency Added
──────────────────────────────────────────────────────────────────────
AWS NLB (L4)               millions of flows/s     <1ms
AWS ALB (L7)               1M RPS (across nodes)   1-3ms per request
HAProxy (L7, 32 cores)     2M RPS                  <1ms
Nginx (L7, 32 cores)       500K RPS                1-2ms
Kong (API GW, per node)    50K RPS                 3-10ms (with JWT)
Istio Envoy sidecar        50K RPS                 <1ms (per hop)
Cloudflare Workers         100K RPS per PoP        <5ms cold start
──────────────────────────────────────────────────────────────────────
All numbers: typical production workloads, not micro-benchmarks.
ALB/NLB scale horizontally — single numbers are per-instance.
```

### Connection Pool Sizing

```
Without keepalive (new connection per request):
  100 RPS × 50ms backend latency × 3 TCP+TLS RTT = 15,000 ms of connection overhead
  Effective RPS: limited by connection setup rate, not backend throughput
  
With keepalive (persistent connections):
  100 connections handle 100 RPS × (1000ms / 50ms) = 2000 RPS
  Connection setup overhead: 0 (reused connections)
  
Nginx keepalive configuration:
  upstream backend_pool {
      server backend1:8080;
      keepalive 64;       # Max idle persistent connections per worker
      keepalive_requests 10000;  # Max requests per connection before close
      keepalive_timeout 60s;     # Close idle connections after 60s
  }
  
Rule: keepalive connections = max_RPS × avg_response_time_seconds
      At 1000 RPS, 50ms avg: 1000 × 0.05 = 50 connections needed
      Set keepalive = 64 (nearest power of 2 above 50)
```

### HTTP/2 Multiplexing Benefits

```
HTTP/1.1 without pipelining:
  Request 1 → wait for response → Request 2 → wait → Request 3 ...
  6 connections per browser, sequential within each

HTTP/1.1 with keepalive:
  6 parallel requests, but each connection is head-of-line blocked
  
HTTP/2:
  Single connection, multiple streams (requests/responses) interleaved
  No head-of-line blocking at HTTP layer (still exists at TCP layer)
  Server push: backend can proactively send CSS/JS before browser asks
  Header compression (HPACK): reduces header size by 60-80%
  
HTTP/3 (QUIC):
  No TCP head-of-line blocking (independent QUIC streams)
  Faster connection establishment: 0-RTT for previously seen hosts
  Connection migration: works across network changes (WiFi → 4G)
  
  For mobile users: HTTP/3 reduces p99 latency by 10-30% in lossy networks
```

---

## Trade-offs

### Load Balancing Algorithm Selection

| Algorithm | Best For | Worst For | State Required |
|---|---|---|---|
| Round Robin | Uniform workloads, stateless | Mixed request costs, variable backend speed | None |
| Weighted RR | Heterogeneous hardware | Dynamic capacity changes | Static config |
| Least Connections | Long-lived connections, variable durations | Short requests (connection count unstable) | Per-backend counter |
| EWMA / Peak EWMA | Mixed workloads, GC-prone backends | Simple setups (complexity overhead) | Per-backend EWMA |
| Consistent Hash | Session affinity, cache locality | Uneven key distribution (hot keys) | Hash ring |

### API Gateway Product Comparison

| Product | Throughput | Latency | Deployment | Key Strength |
|---|---|---|---|---|
| Kong (OSS) | 50K+ RPS | 3-10ms | Self-hosted | Plugin ecosystem, Kubernetes native |
| AWS API Gateway | Unlimited (managed) | 5-20ms | Managed | AWS integration, zero ops |
| Apigee | 50K+ RPS | 5-15ms | Managed/hybrid | Enterprise, analytics |
| Envoy (custom) | 100K+ RPS | <1ms | Self-hosted | Maximum performance, highest complexity |
| Nginx + Lua | 200K+ RPS | 1-3ms | Self-hosted | Performance, simplicity for small teams |
| Traefik | 50K+ RPS | 2-5ms | Self-hosted | Kubernetes-native, auto-discovery |

---

## Production Considerations

1. **Separate liveness and readiness probes.** Liveness failing restarts the pod (expensive). Readiness failing removes it from the load balancer (cheap and fast). A pod with a slow database connection should fail readiness (stop receiving traffic) without being restarted. Configure both probes with different endpoints and different semantics.

2. **Always configure connection draining.** Every load balancer that terminates connections before backends finish draining causes errors during deployments. Set ALB deregistration delay to 30-60 seconds. Configure `preStop` sleep hooks in Kubernetes to match propagation latency (typically 5-15 seconds).

3. **Set health check timeouts higher than p99 latency.** If your backend's p99 is 500ms and your health check timeout is 200ms, your health check will fail during normal elevated latency, causing flapping. Set timeout to 3× p99 latency. Use `unhealthy_threshold=3` to require 3 consecutive failures before removal.

4. **Enable HTTP/2 end-to-end.** HTTP/2 between client and load balancer is widely done. HTTP/2 between load balancer and backend (gRPC or h2c) is frequently missed — many teams downgrade to HTTP/1.1 internally, losing multiplexing and header compression. Verify your nginx/envoy configuration explicitly enables HTTP/2 upstream.

5. **Implement circuit breakers at the gateway, not just in application code.** If a backend service goes down, the API gateway's circuit breaker should open immediately and return 503 without forwarding requests. Without a gateway-level circuit breaker, thousands of requests queue up against the unavailable backend, consuming gateway connection pool slots and cascading to other services.

6. **Rate limit at multiple scopes.** Per-IP rate limiting stops DDoS but not authenticated abuse. Per-user rate limiting stops individual abusers but not credential stuffing. Per-tenant rate limiting prevents one tenant from starving others. Per-endpoint rate limiting protects expensive endpoints. Implement all four with independent counters.

7. **Use Anycast or global load balancers for latency-critical services.** For services that must be fast globally (login, checkout, real-time APIs), the ~300ms round-trip penalty of routing all traffic to a single region is a significant UX degradation. Cloudflare, AWS Global Accelerator, or multi-region active-active reduces this to <50ms globally.

8. **Monitor the load balancer's error log, not just application logs.** 502/503 errors generated by the load balancer (connection refused, timeout to backend) appear in the LB access log, not in the application log. Set up separate alerts for LB-level error rates in addition to application-level error rates.

9. **Test your rate limiter under distributed attack patterns.** Rate limiters with per-node counters (not distributed Redis/DynamoDB) fail against distributed attacks: 100 attackers each sending 1 request to 100 different application instances bypass per-node limits but exceed global limits. Always use distributed rate limit storage for public APIs.

10. **WAF rules require tuning, not just activation.** Enabling AWS WAF's managed rule group or ModSecurity with default rules frequently produces false positives (blocking legitimate requests) on API endpoints with complex JSON bodies, base64-encoded data, or unusual headers. Run in "count" mode for 2 weeks before "block" mode. Tune rule exceptions for known-good patterns.

---

## Common Beginner Mistakes

1. **Using sticky sessions (cookie-based affinity) instead of externalizing state.** Routing all requests from a user to the same backend because session state is stored in process memory. This makes horizontal scaling impossible and causes all sessions to drop when a pod restarts. Externalize session state to Redis; make backends truly stateless.

2. **Setting health check interval equal to health check timeout.** If the interval is 5s and timeout is 5s, the load balancer has zero time between checks. Any brief slowness cascades into continuous check failures. Timeout should be at most 50% of interval. Typical: interval=10s, timeout=3s.

3. **Not setting maximum connection pool size on the API gateway.** An API gateway without a connection pool limit will open unlimited connections to a backend under high load. A backend with a 100-connection limit will see 10,000 connection attempts and crash. Always set `proxy_max_connections` or equivalent — a limit below the backend's maximum.

4. **Treating the load balancer's IP as stable.** AWS ALB IP addresses change without notice (load balancers scale horizontally). Services that directly connect to ALB IP addresses (instead of DNS names) break when IPs rotate. Always use the ALB DNS name, never its IP addresses.

---

## Common Senior Engineer Mistakes

1. **Implementing JWT validation in every microservice instead of at the gateway.** Each service writes its own JWT validation code (often with subtle bugs), makes its own JWKS endpoint calls (adds latency), and fails differently on invalid tokens. Centralize validation at the API gateway; propagate identity headers that services trust.

2. **Not accounting for health check load at scale.** 100 backends × 10 health checks/second = 1000 synthetic requests/second to backend /healthz endpoints. At scale, health check traffic becomes non-trivial. Design /healthz to be extremely cheap (no DB calls) and don't count it in backend request rate metrics.

3. **Configuring synchronous health checks but asynchronous backend pool updates.** Some architectures check health synchronously per request (adds latency) rather than asynchronously (background). Asynchronous health checks are correct: the pool is always updated in the background; individual requests don't wait for health checks. If you're adding health check latency per request, you've implemented this incorrectly.

4. **Not testing connection draining in staging before production.** Connection draining behavior depends on: load balancer vendor, drain timeout configuration, application SIGTERM handler, Kubernetes preStop hook timing, and in-flight request duration. These interact in non-obvious ways. Simulate a pod termination under load in staging and observe the error rate before deploying to production.

---

## Architecture Smells

- **API gateway doing business logic:** If your API gateway contains conditional routing based on user-specific data (beyond simple headers), it's become a service. Business logic belongs in services, not infrastructure.
- **No rate limiting on public endpoints:** Every public API endpoint without rate limiting is an open invitation to accidental or deliberate overload. Even endpoints that seem harmless (GET /healthz) can be called millions of times/second in a DDoS.
- **Single-region load balancer for a global service:** If your users are global but all traffic routes to one region's LB, users in distant regions experience 100-300ms of unnecessary latency before their request even reaches your application. This is the most common and most impactful latency source to fix.
- **Health check endpoint calling external dependencies:** A /healthz endpoint that makes a database query, Redis call, and external API call to determine health introduces latency, adds load to those dependencies, and fails the health check when any dependency is slow — causing unnecessary pod removals during dependency slowdowns.
- **Keepalive disabled between load balancer and backends:** This is the most common performance mistake in Nginx configurations. Every request creates a new TCP+TLS connection to the backend, adding 10-50ms of connection setup overhead. Always configure `keepalive N` in upstream blocks.

---

## Principal Engineer Perspective

**The edge is not "just infrastructure" — it is the first and most visible layer of your product.**  
A 200ms latency reduction at the edge is visible to every user on every request. A 502 error from a misconfigured health check during a deployment is user-facing. The edge layer deserves the same architectural attention as your database design or service decomposition.

**Rate limiting strategy reflects your product's threat model.**  
The question "what should my rate limits be?" cannot be answered without answering "what threats am I protecting against, and who are my users?" An API that serves only enterprise customers via API keys needs different rate limiting than a consumer API serving anonymous users. Rate limits that are too tight break legitimate use cases; too loose, they offer no protection. The right answer is instrumented limits that you tune based on observed traffic patterns.

**The canonical "correct" edge architecture is a function of team size and traffic volume.**  
A three-person startup running on Heroku with no load balancer is not "doing it wrong" — they are making the correct decision for their scale. A 500-engineer company running all traffic through a single Nginx instance is doing it wrong because they've outgrown the model. The principal engineer recognizes the current scale, the next 2x growth trajectory, and the architectural changes needed before that growth happens — not after.

**Adaptive concurrency limiting (gradient-based) is strictly superior to fixed rate limits for protecting backends.**  
Fixed rate limits are calibrated for normal operating conditions. They over-allow during backend degradation (causing cascade failures) and under-allow during spare capacity (wasting resources). Gradient-based limits automatically track backend health and adjust. Netflix, Uber, Google, and Amazon all use adaptive concurrency limiting internally. The complexity cost of implementing it is worth it for any service with variable backend performance characteristics (which is all of them at scale).

**Global edge is not a luxury — it is the baseline for global products.**  
If your product serves users in multiple continents and you have a single regional origin without any edge presence, you are delivering a product that is structurally slower for 70%+ of your users compared to what's technically achievable. CDN, Anycast, or multi-region active-active is not a scaling optimization for "later" — it's the minimum viable architecture for a global product. The cost is lower than most teams assume (Cloudflare Free/Pro, AWS Global Accelerator starts at $0.01/GB), while the latency benefit is immediate and universal.

---

## Architecture Review Questions

1. A backend service's p99 latency under normal load is 300ms. The load balancer's health check timeout is currently 500ms and the interval is 5s. During a partial GC pause, latency spikes to 800ms for 2 minutes. Describe exactly what happens to the load balancer's view of the backend pool. What configuration changes prevent the health check from falsely detecting the backend as unhealthy?

2. Explain the difference between L4 and L7 load balancing. For a gRPC microservices architecture, which is appropriate for client-facing traffic? Which for service-to-service traffic within the cluster? Why?

3. An API gateway validates JWT tokens on every request by calling the identity provider's JWKS endpoint. Under high load (100K RPS), what problems does this create? How would you redesign the JWT validation to be both secure and performant?

4. Describe the mathematical relationship between backend latency, concurrency limit, and queue depth using Little's Law. How does the gradient-based concurrency limiter use this relationship to prevent cascade failures?

5. A service experiences a 10% error rate during every rolling deployment. Without changing the application code, what three infrastructure changes would eliminate or reduce these errors?

6. Compare Anycast and GeoDNS for global traffic routing. What are the failure modes of GeoDNS during a regional failure? Why does Anycast have faster failover?

7. A team is designing an API gateway for a multi-tenant SaaS platform. List five rate limiting scopes they should implement and explain why each scope is necessary independently of the others.

8. Explain TLS re-encryption (edge termination + re-encryption to backend). What security guarantee does it provide that edge-only termination does not? What operational complexity does it add?

9. A public API endpoint receives 500,000 RPS during a product launch, far exceeding the 50,000 RPS capacity of the API gateway. Only 50,000 of those requests are from legitimate users; the rest are bot traffic. How would you design the edge layer to protect the legitimate users while rejecting the bots?

10. Compare Kong (self-hosted API gateway) vs AWS API Gateway (managed). For a startup processing $10M ARR with a 5-engineer team, which would you recommend? For a 200-engineer company with strict data residency requirements? Justify both recommendations with specific trade-offs.

---

## Visual/Animation Specification

### Animation 1: Load Balancing Algorithm Comparison

Interactive side-by-side visualization of 4 backends:
- Left panel: Algorithm selector (Round Robin, Least Connections, EWMA, Consistent Hash)
- Center: 4 backend nodes shown as boxes with real-time metrics: active connections, EWMA latency, health status
- Request stream: animated dots flowing from left, each dot showing routing decision
- Backend D: click "Introduce GC Pause" → D's latency indicator jumps to 1000ms
- Watch: Round Robin still sends 25% of dots to D (colored red = slow)
         Least Connections: fewer dots to D as connections accumulate
         EWMA: dots rapidly avoid D (gradient drops), redistribute to A/B/C (colored green)
- "Recover D" button: D's latency returns to normal, watch EWMA gradually restore traffic
- Quantitative panel: p99 latency and error rate for each algorithm in real-time

### Animation 2: Connection Draining vs Abrupt Shutdown

Timeline visualization showing a rolling deployment:
- Top timeline: without connection draining
  - Each pod termination shown as red explosion; in-flight requests shown as red X marks
  - Error rate counter spikes 10-30% during each termination
- Bottom timeline: with connection draining (preStop sleep + graceful shutdown)
  - Pod termination: green check; LB stops routing; existing requests complete normally
  - Error rate counter: flatline at 0% during deployment
- Side-by-side request flow during termination:
  Without drain: requests arriving at terminated pod → TCP RST → 502
  With drain: requests arriving → redirected to healthy pods by LB → 200 OK
- Clock showing total deployment time for 10-pod rolling update

---

## Hands-On Tutorial: Full Edge Stack with Docker Compose

### Step 1: Infrastructure Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  # L7 Load Balancer (Nginx)
  nginx-lb:
    image: nginx:1.25
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/certs:/etc/nginx/certs:ro
    depends_on:
      - api-v1-1
      - api-v1-2
      - api-v2-canary

  # Stable backends (v1)
  api-v1-1:
    image: nginx:1.25
    volumes:
      - ./backends/v1.conf:/etc/nginx/conf.d/default.conf:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/healthz"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 5s

  api-v1-2:
    image: nginx:1.25
    volumes:
      - ./backends/v1.conf:/etc/nginx/conf.d/default.conf:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/healthz"]
      interval: 10s
      timeout: 3s
      retries: 3

  # Canary backend (v2 - 10% traffic)
  api-v2-canary:
    image: nginx:1.25
    volumes:
      - ./backends/v2.conf:/etc/nginx/conf.d/default.conf:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/healthz"]
      interval: 10s
      timeout: 3s
      retries: 3

  # Redis for distributed rate limiting
  redis:
    image: redis:7.2-alpine
    ports:
      - "6379:6379"
```

### Step 2: Nginx Configuration

```nginx
# nginx/nginx.conf
worker_processes auto;
worker_rlimit_nofile 65536;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    # Upstream pools with health checking and weighted canary
    upstream stable_pool {
        least_conn;
        server api-v1-1:80 weight=1;
        server api-v1-2:80 weight=1;
        keepalive 64;
        keepalive_requests 10000;
        keepalive_timeout 60s;
    }

    upstream canary_pool {
        server api-v2-canary:80;
        keepalive 16;
    }

    # Lua-based weighted routing (90% stable, 10% canary)
    # Using split_clients for deterministic routing
    split_clients "${remote_addr}" $backend {
        10% canary_pool;
        *   stable_pool;
    }

    # Rate limiting zone (10MB shared memory, 100 req/s per IP)
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;

    server {
        listen 80;
        server_name _;

        # Rate limiting: burst of 20 requests without delay, then 429
        limit_req zone=api_limit burst=20 nodelay;
        limit_req_status 429;

        # Health check endpoint (not rate-limited)
        location /healthz {
            access_log off;
            return 200 '{"status":"healthy"}';
            add_header Content-Type application/json;
        }

        # API routing with canary split
        location /api/ {
            proxy_pass http://$backend;
            proxy_http_version 1.1;
            proxy_set_header Connection "";  # Keepalive to backend

            # Forward real client IP
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header Host $host;

            # Timeouts
            proxy_connect_timeout 5s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;

            # Add which backend served the request (for debugging canary)
            add_header X-Upstream $upstream_addr;
            add_header X-Cache-Status "MISS";
        }
    }
}
```

### Step 3: Backend Configurations

```nginx
# backends/v1.conf (stable)
server {
    listen 80;
    
    location /healthz {
        return 200 '{"status":"healthy","version":"v1"}';
        add_header Content-Type application/json;
    }
    
    location /api/ {
        add_header X-Version "v1";
        return 200 '{"version":"v1","data":{"id":42,"name":"Widget","price":19.99}}';
        add_header Content-Type application/json;
    }
}
```

```nginx
# backends/v2.conf (canary)
server {
    listen 80;
    
    location /healthz {
        return 200 '{"status":"healthy","version":"v2"}';
        add_header Content-Type application/json;
    }
    
    location /api/ {
        add_header X-Version "v2";
        return 200 '{"version":"v2","data":{"id":42,"name":"Widget Pro","price":24.99,"new_field":"available"}}';
        add_header Content-Type application/json;
    }
}
```

### Step 4: Load Testing and Canary Verification

```bash
# Start the stack
docker-compose up -d

# Wait for health checks
sleep 15

# Test routing
curl http://localhost/api/products  # Should get v1 or v2 response

# Verify canary split with 100 requests
for i in $(seq 1 100); do
    curl -s http://localhost/api/products | grep -o '"version":"v[0-9]*"'
done | sort | uniq -c
# Expected: ~90 "version":"v1", ~10 "version":"v2"

# Test rate limiting
ab -n 200 -c 50 http://localhost/api/products 2>&1 | grep "Non-2xx"
# Should show ~100+ non-2xx (429) responses after burst exhausted

# Test health check failover: stop one backend
docker-compose stop api-v1-1
sleep 15  # Wait for health check to detect failure (3 checks × 10s = 30s)

# All traffic should now route to api-v1-2 and api-v2-canary
for i in $(seq 1 10); do
    curl -s -o /dev/null -w "%{http_code}" http://localhost/api/products
    echo ""
done
# All should be 200 (no 502 after failover completes)

# Restart the stopped backend
docker-compose start api-v1-1
sleep 30  # Wait for health check recovery (rise=2, interval=10s → 20s)

# Verify traffic resumes to both v1 backends
for i in $(seq 1 20); do
    curl -s http://localhost/api/products -w " from: %{remote_ip}\n" | head -1
done
```

### Step 5: Distributed Rate Limiting with Redis

```python
#!/usr/bin/env python3
"""
Sliding window rate limiter using Redis.
Implements distributed rate limiting across multiple gateway instances.
"""

import redis
import time
import hashlib

r = redis.Redis(host='localhost', port=6379, db=0)

def check_rate_limit(
    identifier: str,     # user_id, api_key, or IP
    endpoint: str,
    limit: int = 100,    # Max requests
    window: int = 60,    # Window in seconds
) -> tuple[bool, dict]:
    """
    Sliding window rate limiter using Redis sorted sets.
    Returns: (allowed: bool, metadata: dict)
    """
    now = time.time()
    window_start = now - window
    
    # Redis key: rate:{identifier}:{endpoint}
    key = f"rate:{hashlib.md5(identifier.encode()).hexdigest()[:8]}:{endpoint}"
    
    pipe = r.pipeline()
    
    # Remove requests older than the window
    pipe.zremrangebyscore(key, 0, window_start)
    
    # Count requests in current window
    pipe.zcard(key)
    
    # Add current request (score = timestamp, member = unique ID)
    pipe.zadd(key, {f"{now}:{id(object())}": now})
    
    # Set expiry (auto-cleanup)
    pipe.expire(key, window + 1)
    
    _, count, _, _ = pipe.execute()
    
    # count is BEFORE this request; check if it would exceed limit
    allowed = count < limit
    remaining = max(0, limit - count - 1)
    reset_at = int(now) + window
    
    metadata = {
        "limit": limit,
        "remaining": remaining if allowed else 0,
        "reset_at": reset_at,
        "window_seconds": window,
    }
    
    if not allowed:
        # Don't add to sorted set if rejected (undo the zadd)
        r.zrem(key, f"{now}:{id(object())}")
    
    return allowed, metadata


# Test the rate limiter
def demo_rate_limiter():
    print("Testing distributed rate limiter (limit: 5 req/10s)")
    
    for i in range(8):
        allowed, meta = check_rate_limit(
            identifier="user-123",
            endpoint="products",
            limit=5,
            window=10,
        )
        status = "✓ ALLOWED" if allowed else "✗ BLOCKED (429)"
        print(f"Request {i+1}: {status} | remaining={meta['remaining']}")
        time.sleep(0.5)

demo_rate_limiter()
```

---

## Exercises

### Conceptual Exercises

1. **Algorithm analysis:** A load balancer uses round-robin across 4 backends. Backend D suddenly experiences a full GC pause of 2 seconds. During those 2 seconds, 1000 requests arrive at the LB. How many requests are routed to D? How many get delayed by 2+ seconds? How would least-connections behave differently?

2. **Health check design:** An API service has 3 external dependencies: PostgreSQL, Redis, and an external payment API. Your /readyz endpoint checks all three. The payment API has 99.5% uptime (4+ hours downtime/month). What happens to your service availability if health check failure on the payment API removes pods from the load balancer pool? How should you redesign the health check?

3. **Connection draining timing:** Your terminationGracePeriodSeconds is 30s. Your preStop sleep is 5s. Your application's p99 request latency is 8s. What is the maximum time your application has to drain in-flight requests? Is this sufficient? What happens to requests that started just before SIGTERM and take 8s to complete?

4. **Anycast failure modes:** A Cloudflare PoP in a region loses BGP connectivity. BGP routing withdraws the announcement from that region. How long does it take for traffic to reroute? What happens to in-flight TCP connections? What happens to clients that have DNS cache for the Anycast IP?

5. **Rate limiting granularity:** A user has 10 devices (phone, laptop, tablet, etc.) all making API requests simultaneously. Your rate limit is 100 RPS per IP. Explain why this rate limit is both too loose (doesn't protect) and too tight (hurts legitimate users). What rate limit design would handle this correctly?

### Architecture Exercises

1. **Global edge design:** Design the edge architecture for a real-time collaborative document editing platform (like Google Docs). Users are global (US, EU, APAC). The application has: WebSocket connections for real-time collaboration, REST API for document management, and static assets (JS, CSS). Design the full edge stack for each traffic type.

2. **Canary deployment system:** Design a canary deployment system for an API gateway that: (a) routes 5% of traffic to the canary, (b) automatically promotes canary to 100% if p99 latency < 200ms and error rate < 0.1% for 15 minutes, (c) automatically rolls back if error rate exceeds 1%. What monitoring, routing, and automation components are needed?

3. **Multi-tenant rate limiting:** A SaaS platform has 10,000 tenants. Tenant A has a $1K/month plan (100 RPS), Tenant B has a $50K/month enterprise plan (10,000 RPS). Design the rate limiting architecture: data model, Redis structure, enforcement point, and what happens when Redis is temporarily unavailable.

### Quantitative Exercises

1. **Latency improvement calculation:** A service is currently deployed in US-East-1 only. Traffic distribution: 40% US, 30% EU, 20% APAC, 10% other. RTTs to US-East: US=50ms, EU=120ms, APAC=200ms, other=150ms. If you deploy edge PoPs in EU (Frankfurt) and APAC (Singapore) that reduce RTT to 20ms for regional users, what is the weighted average latency improvement?

2. **Little's Law application:** A backend service handles 5,000 RPS at 20ms average latency. A database slowdown causes latency to increase to 400ms. Using Little's Law ($L = \lambda W$), calculate: (a) normal concurrent requests in flight, (b) concurrent requests during DB slowdown if RPS stays constant, (c) what RPS must be reduced to in order to maintain the same queue depth during the slowdown?

### Solutions to Quantitative Exercises

**Exercise 1 — Latency improvement:**
- Current weighted average RTT: (0.40×50) + (0.30×120) + (0.20×200) + (0.10×150)
  = 20 + 36 + 40 + 15 = **111ms**
- With edge PoPs — EU users: 120ms → 20ms; APAC users: 200ms → 20ms:
  New weighted: (0.40×50) + (0.30×20) + (0.20×20) + (0.10×150)
  = 20 + 6 + 4 + 15 = **45ms**
- Improvement: 111ms → 45ms = **59% latency reduction** (2.5× faster average)

**Exercise 2 — Little's Law:**
- (a) Normal: $L = \lambda W = 5000 \times 0.020 = \mathbf{100}$ concurrent requests
- (b) DB slowdown, RPS constant: $L = 5000 \times 0.400 = \mathbf{2000}$ concurrent requests
  (20× more in flight — queues explode, memory pressure, cascade failure risk)
- (c) Target same $L = 100$ during slowdown:
  $\lambda = L / W = 100 / 0.400 = \mathbf{250 \text{ RPS}}$
  Must shed **95% of traffic** (return 429) to keep queue stable at 400ms latency

---

## Interview Questions

### Beginner Level

1. What is the difference between L4 and L7 load balancing?
2. What does a health check do, and why is it important?
3. What is connection draining and why does it matter during deployments?
4. What is TLS termination at the load balancer? What are its benefits?
5. What is the purpose of an API gateway vs a load balancer?

### Senior Level

1. Explain three load balancing algorithms and when you'd use each. What are the failure modes of round-robin under variable backend latency?
2. What is connection draining and how do you implement zero-downtime deployments in Kubernetes? What is the role of the preStop hook?
3. Explain Anycast routing. How does BGP enable geographic traffic routing to the nearest PoP? What happens when a PoP fails?
4. Design a rate limiting system that works across 100 API gateway instances without a centralized coordinator. What are the trade-offs?
5. Compare edge TLS termination with TLS re-encryption (passthrough re-encrypt). When would you require re-encryption?

### Staff Level

1. A backend service experiences 2-minute GC pauses every 30 minutes. The load balancer's health checks remove the backend during pauses and readmit it afterward. Describe the full cascade effect on the backend pool and design three mitigations.
2. Design an API gateway authentication architecture for a multi-tenant SaaS with 10,000 tenants, JWT-based auth, and 100K RPS peak traffic. How do you validate JWTs without making a call to the identity provider on every request?
3. Implement gradient-based adaptive concurrency limiting. Explain Little's Law and how it relates to the gradient calculation. How does this prevent cascade failures that fixed rate limits cannot?
4. Compare Kong (self-hosted) vs AWS API Gateway (managed) across 5 dimensions. For what traffic volume and team size does each become the better choice?

### Principal Level

1. Design the complete edge architecture for a global fintech platform: real-time payments (WebSocket), REST API for account management, and a high-security admin API. Include: global routing, TLS strategy, authentication architecture, rate limiting, DDoS mitigation, and monitoring. Justify every architectural decision.
2. A competitor analysis shows your product has 200ms p50 latency for users in Asia-Pacific, while competitors average 30ms. What are the architectural causes? Design a remediation plan that achieves <50ms p50 without redesigning backend services.
3. Explain the architectural trade-offs between a service-mesh-native ingress (Istio IngressGateway) and a standalone API gateway (Kong). Under what circumstances does the service mesh ingress make the API gateway redundant? When are both necessary?
4. Design a canary deployment system that automatically evaluates and promotes/rolls back based on statistical significance testing of error rate differences. What sample sizes are needed, what statistical test is appropriate, and how do you prevent premature promotion?

---

## Summary

The edge is where internet traffic enters your system — and every architectural decision here has global, immediate consequences for every user. The edge stack is not a single component but a layered architecture: global routing (Anycast/GeoDNS), regional L7 load balancing (Nginx/ALB), API gateway (Kong/Envoy), and service mesh ingress (Istio), each with a distinct and non-overlapping responsibility.

Load balancing algorithm selection matters more at scale: round-robin is correct for uniform workloads, EWMA-based Peak EWMA is correct for variable latency environments, and consistent hashing is correct for cache locality. Health checking must distinguish liveness from readiness, use timeouts calibrated to real p99 latency, and require multiple consecutive failures before pool removal to prevent flapping.

Connection draining and graceful shutdown are the mechanism for zero-error-rate deployments. Without them, every rolling deployment causes 502 errors for a percentage of in-flight requests. The combination of preStop hooks, terminationGracePeriodSeconds, and `server.Shutdown(ctx)` achieves zero-error deployments.

Gradient-based adaptive concurrency limiting — Netflix Zuul2's approach — uses Little's Law to automatically calculate the safe concurrency limit based on measured backend latency. When backend latency doubles, the limiter halves the concurrency limit, preventing queue explosion. Fixed rate limits cannot achieve this because they don't adapt to backend health.

Global edge (Anycast, CDN, multi-region active-active) is not a scaling optimization — it is the minimum viable architecture for a truly global product. The 200ms+ latency difference between routing from Sydney to US-East vs Sydney to a local PoP is the difference between a product that feels fast and one that feels sluggish for 60% of the world's internet users.

---

## What You Should Now Be Able To Explain

- **L4 vs L7:** Why L4 is faster but blind to HTTP content, why L7 enables path/header/weight routing at the cost of two TCP sessions, and which protocol types require each
- **EWMA load balancing:** Why $\text{score} = \text{ewma\_latency} \times (\text{active\_requests} + 1)$ automatically routes around degraded backends, and how the EWMA decay constant controls adaptation speed
- **Connection draining mechanics:** The exact sequence of events (Kubernetes SIGTERM → preStop hook → LB deregistration → application drain → clean exit) and why skipping any step causes deployment errors
- **Anycast routing:** How BGP route announcements from multiple PoPs with the same IP cause "nearest PoP" routing, how fast failover occurs on PoP failure, and why it's fundamentally different from GeoDNS
- **Gradient concurrency limiting:** How Little's Law ($L = \lambda W$) explains why queue depth explodes when latency increases at constant throughput, and why the gradient $= W_{min} / W_{current}$ computes the safe load reduction factor
- **Edge architecture layering:** Why the load balancer, API gateway, and service mesh ingress are distinct components with non-overlapping responsibilities, and the minimum viable configuration for teams at different scales

---

## What To Learn Next

**Chapter 32 — Query Optimization and Database Performance Engineering**

Having covered how traffic reaches your services (edge architecture), Chapter 32 dives into what happens when those requests reach the database: how the query planner generates execution plans, why `EXPLAIN ANALYZE` output reveals the difference between a 1ms query and a 30-second query, and how to systematically identify and fix the 10 most common performance anti-patterns at scale. We will examine PostgreSQL's cost-based optimizer: how it estimates row counts (using statistics in pg_statistic), why stale statistics cause catastrophically wrong plans (sequential scan instead of index scan), and how to force plan stability for critical queries. We will cover index strategies — when B-tree is wrong and partial indexes, expression indexes, or covering indexes are right — and the write amplification cost of over-indexing. We will analyze N+1 queries (the single most common application performance bug), connection pool exhaustion patterns, and how to read `pg_stat_statements` to identify the top 10 queries consuming 80% of database CPU. Real examples from Instagram (30 billion rows), Shopify (multi-tenant sharding), and GitLab (500GB tables) illustrate production-grade optimization at scale.
