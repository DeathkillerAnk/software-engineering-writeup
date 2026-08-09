# Chapter 5 — Infrastructure Networking

## Difficulty
Intermediate → Advanced

## Importance
**Must Know** — You cannot build a reliable distributed system if you don't understand how traffic gets to your application. Between a client and your code, there are usually 3 to 5 networking appliances (load balancers, reverse proxies, NAT gateways). Each hop adds latency, manages connection pools, imposes timeouts, and can fail. Understanding this infrastructure is the prerequisite to designing systems that survive traffic spikes and datacenter outages.

## Prerequisites
Chapter 3 — Network Layers, TCP & UDP (ports, connections, NAT)
Chapter 4 — DNS, HTTP & TLS (resolution, multiplexing, encryption)

## Learning Objectives

By the end of this chapter you will be able to:

1. Differentiate between Layer 4 (L4) and Layer 7 (L7) load balancing, including their performance characteristics and use cases.
2. Explain the mechanisms of L4 load balancing: SNAT/DNAT mode vs Direct Server Return (DSR).
3. Describe the role of a Reverse Proxy and an API Gateway, and how they differ from a simple load balancer.
4. Explain how Service Discovery works (Client-side vs Server-side) and why it replaced static IPs.
5. Identify the failure domains introduced by NAT gateways and egress proxies (e.g., ephemeral port exhaustion).
6. Trace the complete path of an HTTP request from a user's device through the cloud edge, load balancers, and into a microservice.
7. Choose appropriate load balancing algorithms (Round Robin, Least Connections, EWMA, Consistent Hashing) based on workload characteristics.

## Why This Matters

When a P1 incident occurs and your service metrics show 100% success, but the client metrics show 50% errors, where is the problem? It is in the infrastructure networking layer. 

A Principal Engineer needs to understand this layer to answer:
- Why are we dropping connections even though CPU utilization is at 20%? (LB port exhaustion or SNAT limits)
- Why does autoscaling up cause a temporary spike in error rates? (Slow health checks, cold caches)
- Should we terminate TLS at the edge, at the ingress controller, or at the pod?
- Why did one slow downstream service cause our API Gateway to crash?

Software doesn't run in a vacuum. It runs behind a gauntlet of network appliances that dictate its reliability.

---

## Mental Model

> **Infrastructure networking is a series of intelligent traffic cops. They decouple the identity of a service (its name or virtual IP) from its physical location (the specific server/pod). They inspect, route, throttle, and secure traffic. But every traffic cop is also a bottleneck: they maintain state, require CPU/memory, have timeout configurations, and consume network ports.**

---

## Intuition

Imagine you run a massive call center.

**Static Routing (No LB):** Customers have the direct desk phone numbers of your agents. If an agent goes to lunch or their phone breaks, the customer just hears ringing. To add an agent, you have to mail out new phone directories. 

**Layer 4 Load Balancer (The Switchboard):** Customers call one main 1-800 number. A fast switchboard operator blindly routes the call to the next available desk phone. They don't listen to the conversation; they just connect the wires. It's incredibly fast, but if the customer needs Spanish support, the operator doesn't know — they just connect the line.

**Layer 7 Load Balancer / Reverse Proxy (The Concierge):** Customers call the 1-800 number. The concierge picks up, says "Hello," and asks what the customer wants. Based on the answer ("I need billing support in Spanish"), the concierge puts the customer on hold, calls the specific bilingual billing agent, and links the calls. This takes more time, but routing is perfect.

**Service Discovery (The Roster):** How do the switchboard and concierge know who is currently at their desk? Agents clock in and out on a central roster. The operators constantly check this roster to know who is available.

---

## Visual Explanation

### The Request Journey (Internet to Microservice)

```
User Device (Client)
      │
      ▼  (Public Internet)
[ CDN / WAF Edge ]       ← Caches static assets, blocks DDoS/SQLi (L7)
      │
      ▼
[ Cloud Provider L4 LB ] ← AWS NLB / GCP TCP LB. Routes by IP/Port. Fast.
      │
      ▼  (Virtual Private Cloud)
[ Ingress Controller ]   ← L7 Reverse Proxy (Nginx, Envoy, ALB). Terminates TLS, reads HTTP path.
      │
      ▼  (Kubernetes Cluster / Internal Network)
[ Service A ]            ← Your application code
      │
      ▼
[ Internal L4/L7 LB ]    ← Or Service Mesh sidecar
      │
      ▼
[ Service B ]            ← Downstream dependency
```

Each `[ ]` is a distinct piece of infrastructure maintaining its own TCP connections, timeouts, and state.

---

## Core Concepts

### 1. Load Balancing Fundamentals

A Load Balancer (LB) distributes incoming network traffic across a group of backend servers (the pool). Its primary goals are availability (don't send traffic to dead servers) and scalability (distribute work evenly).

**Health Checks:**
- **Active:** The LB periodically sends a probe (e.g., `GET /health` every 5 seconds). If N consecutive probes fail, the backend is marked down. If M probes succeed, it is marked up.
- **Passive (Outlier Detection):** The LB observes real traffic. If a backend returns 5xx errors or connection timeouts for real user requests, it is temporarily ejected from the pool.

### 2. Layer 4 (L4) Load Balancing

Operates at the Transport Layer (OSI Layer 4). It makes routing decisions based entirely on the TCP/UDP 5-tuple: `(Source IP, Source Port, Dest IP, Dest Port, Protocol)`.

- **How it works:** It does not terminate the TCP connection (in some modes) or it maintains two separate TCP connections, but it **never looks at the HTTP payload**.
- **Performance:** Extremely high throughput, ultra-low latency, low CPU usage. Can handle millions of connections.
- **Use cases:** Database load balancing, raw TCP/UDP streams, acting as the front-door for L7 load balancers (e.g., AWS Network Load Balancer).
- **Limitations:** Cannot route based on URL path (`/api` vs `/web`), cannot look at cookies for sticky sessions, cannot terminate TLS and make decisions based on the decrypted payload.

### 3. Layer 7 (L7) Load Balancing

Operates at the Application Layer (OSI Layer 7). It understands HTTP, gRPC, Redis, or database protocols.

- **How it works:** It **must** terminate the TCP connection and TLS session from the client. It decrypts the payload, parses the HTTP headers, makes a routing decision, and establishes a *new* TCP/TLS connection to the backend.
- **Capabilities:**
  - Path-based routing (send `/billing` to Billing Service, `/users` to User Service).
  - Header-based routing (send `x-version: v2` to canary pods).
  - Rate limiting, authentication validation, header injection.
- **Performance:** Slower than L4. Parsing HTTP and terminating TLS uses significant CPU.
- **Examples:** Nginx, HAProxy (can do both L4/L7), Envoy, AWS Application Load Balancer (ALB), Traefik.

### 4. Reverse Proxies & API Gateways

- **Reverse Proxy:** A server that sits in front of web servers and forwards client requests to them. All L7 load balancers act as reverse proxies. They provide anonymity for the backend, TLS termination, and caching. (Contrast with a *Forward Proxy*, which sits in front of clients to control outbound internet access, like a corporate proxy).
- **API Gateway:** A reverse proxy with added developer-focused features. It handles "cross-cutting concerns": rate limiting per API key, JWT validation, request/response transformation (e.g., XML to JSON), and billing integration. Examples: Kong, Apigee, AWS API Gateway.

### 5. Load Balancing Algorithms

How does the LB choose which healthy backend gets the next request?

| Algorithm | How it works | Best for | Failure Mode |
|-----------|--------------|----------|--------------|
| **Round Robin** | Sequential (A, B, C, A, B, C) | Homogeneous servers, requests of equal cost | Uneven load if some requests take 10ms and others take 5s |
| **Least Connections** | Sends to the backend with fewest active connections | Long-lived connections (WebSockets, DBs), varied request costs | "Thundering Herd" on a newly restarted, empty server |
| **EWMA (Exponentially Weighted Moving Average)** | Factors in both active connections and recent response latency | Modern microservices (Envoy default) | Can be complex to tune |
| **Consistent Hashing** | Hashes a key (e.g., User ID, IP) to map to a specific server | Caches (Redis/Memcached), Stateful workloads | Hotspots if one user generates 90% of traffic |

### 6. NAT and Egress Gateways

Infrastructure networking isn't just about inbound traffic (Ingress); it's also about outbound traffic (Egress).

When private microservices (e.g., `10.0.1.50`) need to call a public API (e.g., Stripe, Twilio), they cannot route directly to the internet. Traffic goes through a **NAT Gateway** (Network Address Translation).

**SNAT (Source NAT):** The NAT Gateway rewrites the Source IP of the packet from the private IP to the NAT Gateway's public IP, and changes the Source Port.

**The Ephemeral Port Exhaustion Problem:**
A NAT Gateway has 1 public IP. A TCP connection is defined by the 5-tuple. When connecting to `stripe.com:443`, the Dest IP, Dest Port, and Protocol are fixed. Therefore, the NAT Gateway can only support ~65,000 concurrent connections to `stripe.com` across your *entire* cluster, because it only has 65,000 source ports available on its single public IP. If a bad retry loop in one service consumes all ports, *all* services lose internet access.

### 7. Service Discovery

In a cloud environment, servers (pods/EC2 instances) are ephemeral. IPs change constantly. How do services find each other?

**Server-Side Discovery:**
- Client calls a fixed Load Balancer IP/DNS.
- The Load Balancer queries a registry (or Kubernetes API) to know the backend IPs.
- **Pros:** Client is simple (just make an HTTP call).
- **Cons:** Extra network hop. LB becomes a bottleneck.

**Client-Side Discovery:**
- Client queries a Service Registry (e.g., Netflix Eureka, Consul, Zookeeper) to get a list of IPs for `service-b`.
- Client library (e.g., Ribbon, gRPC resolver) picks an IP using its own load balancing logic and connects directly.
- **Pros:** No extra network hop. Client can make smart routing decisions.
- **Cons:** Requires complex client libraries in every language your company uses (Java, Go, Python).

**Service Mesh (The Modern Compromise):**
- A local proxy (sidecar, e.g., Envoy) is deployed alongside every instance of your app.
- Your app makes a simple call to `localhost:8080`.
- The sidecar transparently intercepts it, handles the discovery (via a control plane like Istio), and routes it directly to the destination sidecar.
- **Pros:** No extra hop across the network, no complex logic in the application code.

---

## Deep Dive

### How L4 Load Balancing Actually Works: Proxy vs DSR

When a packet hits an L4 LB, how does it reach the backend?

**1. Proxy Mode (SNAT + DNAT):**
- Client `203.0.113.1` connects to LB `198.51.100.1`.
- LB terminates TCP. Opens a new TCP connection to Backend `10.0.0.5`.
- LB must rewrite both Destination IP (DNAT) and Source IP (SNAT).
- **Problem:** Backend sees the LB's IP as the source. It loses the original Client IP. (Workaround: HAProxy PROXY protocol).
- **Problem:** All response traffic (which is usually much larger than request traffic, e.g., video streaming) must flow back through the LB, bottlenecking the LB's outbound bandwidth.

**2. Direct Server Return (DSR):**
- Client connects to LB Virtual IP (VIP).
- LB changes the Destination MAC address to the backend's MAC address, but leaves the Destination IP as the VIP.
- The backend server is configured to accept traffic for the VIP on a loopback interface.
- **The Magic:** When the backend responds, it bypasses the LB entirely and sends packets directly to the Client.
- **Result:** Massive scalability. The LB only processes tiny incoming requests, while massive outgoing responses flow directly to the internet. Used heavily by Google (Maglev) and GitHub (GLB).

### Connection Pooling Between Proxies

Consider the architecture: `Ingress (Nginx) -> Service A`.
Nginx maintains a connection pool to Service A to avoid the TCP/TLS handshake tax (as learned in Chapter 4).

**The Race Condition (HTTP/1.1 Keep-Alive Drop):**
- Nginx has an idle connection to Service A.
- Service A's keep-alive timeout is configured to 60 seconds. Nginx's timeout is configured to 60 seconds.
- At T=59.9s, Nginx decides to reuse the connection and sends an HTTP request.
- At T=60.0s, the packet is in flight. Service A's timer expires, and it sends a TCP RST (or FIN) to close the connection.
- The request arrives at Service A on a closed socket and is dropped. Nginx returns a `502 Bad Gateway`.
- **The Rule:** The downstream server (Service A) must *always* have a longer idle timeout than the upstream proxy (Nginx). e.g., Nginx=60s, Service A=65s.

---

## Real-World Example

### Tracing a Request through the Cloud Edge

Let's trace a user logging into a modern microservices app: `POST https://api.example.com/login`

1. **DNS & Anycast:** The user resolves `api.example.com`. Route53 uses Anycast to route the user to the nearest AWS Edge location (e.g., London).
2. **CloudFront / WAF (L7 Edge):** The TCP/TLS connection terminates in London. The WAF inspects the payload for SQL injection. It realizes `/login` is an API call, not a cached image. It forwards it over AWS's internal backbone.
3. **AWS Application Load Balancer (ALB, L7):** The request hits the regional ALB. The ALB terminates TLS *again*. It reads the Host header and path, and routes traffic to the Kubernetes Ingress NodePort.
4. **Ingress Controller (e.g., Nginx, L7):** Nginx inside Kubernetes terminates TLS *again*. It looks at the path `/login` and uses its internal knowledge of Kubernetes Endpoints to select a specific pod IP for the `auth-service`.
5. **kube-proxy (L4, via iptables/eBPF):** Transparently ensures the packet reaches the correct physical worker node.
6. **Istio Sidecar (Envoy, L7):** Inside the pod, Envoy intercepts the traffic, records metrics, checks authorization policies, and finally forwards it to the application container via `localhost`.

**The takeaway:** A single API call might undergo 4 distinct TCP connection terminations and creations before hitting your code. If any link in this chain has misconfigured timeouts, buffer sizes, or connection limits, the request fails.

---

## Failure Scenarios

### Scenario 1: The Thundering Herd on Restart

**Setup:** You have 10 instances of `payment-service`. The LB uses "Least Connections" routing.
**Event:** Instance #4 crashes and is restarted by Kubernetes.
**Mechanism:** 
1. Instance #4 comes up clean. It has 0 active connections. The other 9 instances have 500 connections each.
2. The LB sees #4 is healthy and has the "Least Connections".
3. The LB routes 100% of new traffic to Instance #4 to balance the cluster.
4. Instance #4's caches are cold. Its DB connection pool is empty. It is immediately crushed by load, times out, fails its health check, and crashes again.
**Fix:** Use "Slow Start" algorithms in the LB (gradually increase weight for new servers) or use EWMA instead of raw connection counts.

### Scenario 2: The Health Check Storm

**Setup:** You have a cluster of 50 API Gateways routing traffic to 1,000 backend microservice instances.
**Event:** To ensure fast failover, you configure active health checks: `GET /health` every 1 second.
**Mechanism:**
1. Every API Gateway independently checks every backend instance.
2. Load = 50 Gateways * 1,000 instances * 1 check/sec = 50,000 requests per second.
3. The backend instances spend all their CPU answering health checks instead of serving user traffic.
**Fix:** Use passive health checking (outlier detection) and decouple active health checks (e.g., Consul agents check locally, not a full mesh of proxies).

### Scenario 3: L4 SNAT Port Exhaustion

**Setup:** A batch processing job scales up to 500 pods to process a queue. They all make API calls to an external vendor API over the internet via a single NAT Gateway.
**Mechanism:**
1. 500 pods * 150 concurrent requests each = 75,000 concurrent connections to `api.vendor.com:443`.
2. The NAT Gateway only has 65,535 ephemeral ports for its single public IP.
3. Port 65,536 attempts to open a connection. The NAT Gateway drops it silently (or sends RST).
4. The pods experience massive timeouts.
**Fix:** Provision multiple NAT Gateways (or assign multiple public IPs to the NAT gateway) and ensure the application uses HTTP Keep-Alive connection pooling so 75,000 requests multiplex over a few hundred TCP connections.

---

## Performance Considerations

- **Latency Overhead:** A highly optimized L4 LB adds < 0.1ms. An L7 proxy adds 0.5ms - 2ms due to HTTP parsing and TLS termination. A service mesh adds this *twice* (client sidecar + server sidecar).
- **Buffer Bloat in Proxies:** If an LB reads data from a fast client and writes to a slow backend, it buffers the data in memory. Under a slowloris attack or heavy load, proxy memory exhausts.
- **eBPF (Extended Berkeley Packet Filter):** Modern infrastructure networking (like Cilium in Kubernetes) uses eBPF to route packets directly in the Linux kernel, bypassing the heavy TCP/IP stack in user-space proxies, dramatically lowering latency.

---

## Trade-offs

| Decision | Pros | Cons |
|----------|------|------|
| **L4 vs L7 LB** | L4 is cheaper, faster, handles massive scale. | L4 is blind. Cannot route by URL, cannot do sticky sessions. |
| **Active vs Passive Health Checks** | Active detects failures before a user is impacted. | Active creates O(N*M) traffic. Passive requires some users to fail first to detect the outlier. |
| **Edge TLS Termination vs End-to-End TLS** | Edge is vastly simpler to manage; offloads CPU from backends. | End-to-end (Zero Trust) is required for strict compliance (PCI/HIPAA) but requires complex mTLS management. |
| **Server-Side vs Client-Side Discovery** | Server-side keeps clients dumb and language-agnostic. | Client-side removes a network hop and LB bottleneck. |

---

## Alternatives

| Component | Traditional | Modern Cloud Native |
|-----------|-------------|---------------------|
| **Ingress** | Hardware F5 Big-IP | Software Envoy, Nginx Ingress, Traefik |
| **Service Discovery** | Static IPs in config files | Consul, Kubernetes DNS (CoreDNS) |
| **L4 Load Balancing** | Hardware Appliances | IPVS, cloud native L4 LBs (AWS NLB) |
| **Service-to-Service** | Internal hardware LB | Service Mesh (Istio/Linkerd) |

---

## Production Considerations

1. **Timeout Alignment is Critical:** Review timeouts across the entire chain. Client Timeout > Edge LB Timeout > Internal Proxy Timeout > Application Timeout. If the Application times out first, it can gracefully close connections. If the Edge times out first, it cuts the connection blindly while the backend is still doing expensive work.
2. **Always Forward `X-Forwarded-For`:** Because L7 proxies terminate TCP, the backend sees the Proxy's IP, not the User's IP. Ensure your edge proxy injects `X-Forwarded-For` (XFF) and downstream proxies append to it. Security note: only trust XFF values added by *your* trusted edge, otherwise clients can spoof their IP.
3. **Beware Retries at Multiple Layers:** If the client retries 3 times, the API Gateway retries 3 times, and the Service Mesh retries 3 times, a single failed request to a backend turns into 27 requests (a retry storm). Define a strict policy: only retry at one layer (usually the layer closest to the client).
4. **Drain Connections Gracefully:** When scaling down or deploying, you cannot just kill a pod. You must remove it from the LB, wait for the LB to stop sending new traffic, wait for existing connections to finish (Connection Draining / Deregistration Delay), and *then* kill the pod.

---

## Common Beginner Mistakes

1. **Assuming internal networks are instantaneous and reliable.** (The 1st Fallacy of Distributed Computing).
2. **Not configuring HTTP Connection Pools.** Leading to ephemeral port exhaustion on the NAT gateway or proxy.
3. **Using Round Robin for variable-latency workloads.** If rendering a heavy report takes 10s and fetching a user takes 10ms, Round Robin will quickly pile up heavy reports on one unfortunate server.

---

## Common Senior Engineer Mistakes

1. **Misaligned Keep-Alive Timeouts.** Leading to intermittent `502 Bad Gateway` errors during low-traffic periods when connections go idle.
2. **Ignoring TCP backlog and proxy connection limits.** The app can handle 10,000 RPS, but the Nginx ingress is configured with `worker_connections 1024`, causing the LB to become the bottleneck.
3. **Blindly enabling active health checks at high frequencies** in large microservice architectures, inadvertently DDoS-ing their own services.

---

## Architecture Smells

- **Hairpinning (NAT Loopback):** Service A (internal) calls Service B (internal) by resolving B's *public* domain name, routing traffic out through the NAT gateway to the public internet, hitting the external LB, and coming back in. Wastes money (egress costs) and adds massive latency. Fix: Split-horizon DNS or internal service discovery.
- **Megabytes of HTTP Headers:** Passing massive JWTs or session state in headers through 5 layers of L7 proxies. Proxy header parsing is CPU intensive.
- **Using an API Gateway as an ESB (Enterprise Service Bus):** Putting business logic (data transformation, orchestration) inside the API Gateway configuration. Gateways should route and protect, not calculate.

---

## Principal Engineer Perspective

Infrastructure networking represents the boundary between the *desired state* of the architecture and the *physical reality* of the datacenter. 

Principal Engineers treat load balancers not just as traffic routers, but as **blast radius isolators**. A properly configured LB layer prevents a cascading failure in a downstream dependency from taking down the edge. 

Furthermore, Principal Engineers obsess over **observability at the edges**. When a request crosses a network boundary (from LB to service), that is the most critical place to log metrics, generate tracing spans, and measure latency. The delta between the latency reported by the LB and the latency reported by the application represents the truth about network congestion, garbage collection pauses, and kernel queue depths.

---

## Architecture Review Questions

1. Trace the exact path of a request from a user to Service X. How many TCP terminations occur? 
2. Are the keep-alive timeouts strictly increasing as you move closer to the edge? (Backend < Proxy < Edge).
3. If Service X takes 30 seconds to start up and warm its caches, how does the load balancer know not to send traffic to it immediately?
4. When Service X scales down, what is the exact sequence of events that prevents in-flight requests from being dropped?
5. Do we rely on SNAT for outbound traffic? If so, what is our peak connection rate per destination IP, and are we at risk of ephemeral port exhaustion?
6. Are retries configured at the proxy layer? Are they restricted to idempotent HTTP methods (GET, PUT, DELETE) only?
7. If we experience a network partition and 50% of the nodes go offline, will our "Least Connections" load balancer overwhelm the surviving nodes when they return?

---

## Visual / Animation Specification

### Animation 1: Proxy vs DSR (Direct Server Return)

**Frame 1:** Client sends a large request to LB VIP.
**Frame 2:** (Proxy Mode) LB opens connection to Backend. Backend processes. Backend sends 50MB video response *back through the LB*. LB CPU/Bandwidth meter spikes to red.
**Frame 3:** (DSR Mode) Client sends request to LB VIP. LB changes MAC address, forwards to Backend.
**Frame 4:** Backend processes. Backend sends 50MB video response *directly* to the Client (arrow bypasses LB). LB CPU/Bandwidth meter stays green.

### Animation 2: The Keep-Alive Race Condition

**Frame 1:** Nginx (Proxy) and Service (Backend) linked by an idle TCP connection. Clock starts ticking: `0s`.
**Frame 2:** Clock hits `59.9s`. Nginx sends a new HTTP request down the pipe.
**Frame 3:** Packet is in transit. Clock hits `60.0s`.
**Frame 4:** Service's idle timeout triggers. Service sends TCP FIN/RST.
**Frame 5:** Packet arrives at Service. Socket is closed. Packet is rejected. Nginx returns 502 to user.

---

## Hands-On Tutorial

### Simulating L4 and L7 Load Balancing with HAProxy

**Step 1: Start two simple python web servers (backends)**
```bash
# Terminal 1
python3 -m http.server 8001
# Terminal 2
python3 -m http.server 8002
```

**Step 2: Configure HAProxy as an L4 Load Balancer (TCP mode)**
Create `haproxy-l4.cfg`:
```haproxy
global
    log stdout format raw local0

defaults
    log global
    mode tcp
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms

frontend my_l4_frontend
    bind *:8080
    default_backend my_backends

backend my_backends
    balance roundrobin
    server srv1 127.0.0.1:8001 check
    server srv2 127.0.0.1:8002 check
```
Run it: `haproxy -f haproxy-l4.cfg`
Test it: `curl http://localhost:8080`. Notice the logs of the python servers alternate (Round Robin).

**Step 3: Configure HAProxy as an L7 Load Balancer (HTTP mode)**
Change `mode tcp` to `mode http`. Add a header injection:
```haproxy
frontend my_l7_frontend
    bind *:8080
    mode http
    http-request add-header X-Forwarded-For %[src]
    default_backend my_backends
```
Notice that HAProxy now *must* understand HTTP to inject the header.

---

## Failure Injection Lab

### Lab: Ephemeral Port Exhaustion

1. **Setup:** Create a tiny script that opens a TCP connection to an external site (e.g., `google.com:443`) but does *not* close it.
2. **Execute:** Run a loop to spawn 70,000 instances of this script.
3. **Observe:** Around ~65,000 connections, the OS will throw `Cannot assign requested address` (EADDRNOTAVAIL).
4. **Relate:** This is exactly what happens to a NAT Gateway when your microservices leak connections or experience a retry storm to a single third-party API.
5. **Fix:** Modify the script to use connection pooling (reuse the socket) or explicitly close the connection.

---

## Exercises

**Conceptual:**
1. Why is an L7 load balancer significantly more CPU intensive than an L4 load balancer?
2. Explain the "Thundering Herd" problem in the context of a Least Connections load balancing algorithm.
3. Why must the backend's keep-alive timeout be strictly greater than the proxy's keep-alive timeout?
4. What is SNAT, and why is it necessary for a private subnet to access the internet?

**Architecture:**
5. You are designing a video streaming platform. Delivering video chunks requires massive outbound bandwidth. Would you choose a standard Proxy mode L4 LB, an L7 Reverse Proxy, or a DSR L4 LB? Justify your choice.
6. Your microservice cluster needs to consume a 3rd-party API (`api.vendor.com`). The vendor imposes a strict limit of 100 concurrent connections per client IP. Your cluster has 500 pods. How do you architect the egress networking to respect this limit?

**Quantitative:**
7. A NAT Gateway has a single public IP. It tracks TCP connections using the 5-tuple. If all internal traffic is destined for a single third-party webhook endpoint (`https://webhook.thirdparty.com/events`), what is the theoretical maximum number of concurrent connections the NAT Gateway can support?

---

## Solutions

### Exercise 5
**DSR L4 LB.** Video streaming is heavily asymmetric (tiny requests in, massive data out). If you use Proxy mode or L7, the outbound video bandwidth must flow through the Load Balancer, making the LB a massive, expensive bottleneck. With DSR, the backend video servers stream the massive payloads directly back to the clients, bypassing the LB entirely.

### Exercise 6
You cannot let the 500 pods connect directly via a standard NAT Gateway, because 500 pods * 1 connection = 500 connections (exceeding the 100 limit). You must introduce an **Egress Proxy** (like Envoy or Squid) centrally. All 500 pods send their requests to the internal Egress Proxy. The Egress Proxy maintains a strict HTTP/2 connection pool to the vendor with `max_connections=100`. The proxy queues or rejects requests internally if the pool is saturated.

### Exercise 7
The 5-tuple is (Source IP, Source Port, Dest IP, Dest Port, Protocol).
- Dest IP is fixed (webhook.thirdparty.com).
- Dest Port is fixed (443).
- Protocol is fixed (TCP).
- Source IP is fixed (the single NAT Gateway public IP).
The only variable is the **Source Port**, which is a 16-bit integer (0-65535). Reserving well-known ports, there are roughly **~64,000** ephemeral ports available. Therefore, the absolute theoretical maximum is ~64,000 concurrent connections.

---

## Interview Questions

### Beginner
- What is the difference between a load balancer and a reverse proxy?
- What is Round Robin load balancing?
- What is the purpose of a health check?

### Senior
- Explain the difference between L4 and L7 load balancing. When would you use each?
- Why do we inject the `X-Forwarded-For` header, and what security risks are associated with it?
- Describe the ephemeral port exhaustion problem on a NAT Gateway.
- Compare client-side service discovery with server-side load balancing.

### Staff
- Walk me through the race condition that causes intermittent `502 Bad Gateway` errors between an Ingress controller and a backend service due to keep-alive timeouts.
- How does Direct Server Return (DSR) work at the packet level?
- If a service goes down and comes back up with empty caches, how do you prevent the load balancer from crushing it with traffic?

### Principal
- Draw the complete network path from a mobile client to a pod in Kubernetes, detailing every NAT translation, TLS termination, and TCP connection establishment. Where are the single points of failure, and how do you mitigate them?
- We are migrating a legacy monolithic database to a distributed database. The legacy DB sat behind a standard L4 LB. The new distributed DB requires client drivers to be topology-aware. Contrast the failure domains of L4 LB database routing vs Smart Client (topology-aware) routing.

---

## Summary

Infrastructure networking is the tissue that connects distributed systems:

- **L4 Load Balancers:** Fast, blind routers operating on IPs and Ports. Excellent for extreme scale (especially via DSR) but lack application awareness.
- **L7 Reverse Proxies:** Smart, CPU-intensive routers that understand HTTP/gRPC. Essential for path routing, TLS termination, and cross-cutting concerns (API Gateways).
- **Timeouts & Connection Pools:** The source of most infrastructure networking bugs. Timeouts must increase from backend to edge. Proxies must pool connections to avoid TCP/TLS handshake taxes.
- **NAT Gateways:** Necessary for egress, but introduce a rigid bottleneck: the ~64k ephemeral port limit per destination IP.
- **Service Discovery:** Evolved from hardcoded IPs to DNS, to server-side LBs, to client-side smart libraries, and finally to Service Meshes (decoupling discovery from application code).
- **Blast Radius:** The primary goal of these components is not just routing, but isolating failures. A properly configured LB protects the backend from sudden traffic spikes, and protects the client from hitting dead backends.

---

## What You Should Now Be Able To Explain

- ✅ The distinct capabilities and performance profiles of L4 vs L7 load balancing.
- ✅ Why Direct Server Return (DSR) is critical for asymmetric workloads like CDN caching.
- ✅ How NAT gateways work and why a runaway retry loop can exhaust their ports.
- ✅ Why misaligned keep-alive timeouts between a proxy and a backend cause sporadic 502s.
- ✅ The evolution of service discovery from static LBs to Service Mesh sidecars.

---

## What To Learn Next

**Chapter 6 — Message Queues and Event Streams.** You now understand synchronous, point-to-point communication (TCP, HTTP, LBs). The next major paradigm in distributed systems is asynchronous communication. How do we decouple services in time? We introduce brokers. We will explore message queues (RabbitMQ, SQS) vs event streams (Kafka), the physics of disk-based messaging, consumer groups, and exactly-once processing guarantees.
