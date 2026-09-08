# Chapter 16 — Kubernetes: Orchestration at Scale

## Difficulty
Advanced → Expert

## Importance
**Must Know** — Kubernetes is the operating system of distributed systems. It is where microservices, databases, caches, and service meshes actually run. Understanding Kubernetes at the Principal Engineer level means understanding why it makes the decisions it does: how the scheduler places pods, why the control plane uses an eventually consistent model (not a strongly consistent one), how etcd's linearizability is the foundation of Kubernetes correctness, and what happens to your workloads when nodes fail, the API server restarts, or the scheduler goes down. "It runs on Kubernetes" is table stakes. "I understand what Kubernetes guarantees, what it doesn't, and how to run it reliably at scale" is Principal Engineer territory.

## Prerequisites
Chapter 5 — Infrastructure Networking (CNI, load balancers, DNS)
Chapter 8 — Consistency, Consensus (Raft — etcd uses it)
Chapter 10 — Observability (node/pod metrics, Prometheus integration)
Chapter 15 — Service Mesh (runs on Kubernetes, sidecar injection)

## Learning Objectives

By the end of this chapter you will be able to:

1. Describe the Kubernetes control plane components — API server, etcd, scheduler, controller manager — and explain what each does and what happens when each fails.
2. Explain the reconciliation loop model: how controllers continuously converge actual state to desired state.
3. Describe how the scheduler places pods: resource requests/limits, node affinity, pod affinity/anti-affinity, taints and tolerations.
4. Explain Kubernetes networking: how pods get IPs, how Services route traffic, how DNS works within a cluster, and how Ingress/Gateway API exposes services externally.
5. Design resource requests and limits correctly — why wrong limits cause OOM kills and CPU throttling.
6. Explain horizontal pod autoscaling (HPA), vertical pod autoscaling (VPA), and cluster autoscaling — when each applies.
7. Apply zero-downtime deployment strategies: rolling updates, pod disruption budgets, readiness gates.
8. Design RBAC and security policies for a production Kubernetes cluster.
9. Diagnose common Kubernetes failure modes: CrashLoopBackOff, OOMKilled, ImagePullBackOff, Pending pods, and etcd degradation.

## Why This Matters

A team deploys a new version of their payment service. The rolling update starts. The new pods fail their readiness probe (a configuration error). Kubernetes doesn't know this is a problem — it sees the pods as not-ready and holds back traffic. But the old pods have already been terminated (the deployment progressed too fast). For 90 seconds, the payment service has zero ready pods. No traffic is served. This is a real pattern that causes production outages — preventable with a correct rolling update configuration and pod disruption budgets.

Or: A data science team runs a batch job that requests 0.1 CPU and 128 MB memory but actually uses 8 CPU and 12 GB memory (requests/limits not set correctly). The job gets scheduled on a node with 8 other pods. The node's memory exhausts. The kernel OOM killer fires. It kills pods: some of them are payment-service instances. Payment service outage — caused by an unrelated batch job.

Kubernetes is powerful precisely because it makes so many decisions automatically. Those automatic decisions can hurt you if you don't understand them.

---

## Mental Model

> **Kubernetes is a control loop system. Every component — scheduler, deployments, ReplicaSets, HPA — runs a reconciliation loop: observe actual state, compare to desired state, act to close the gap. This is not event-driven (no "do this when X happens") — it is continuously-convergent. The system never "knows" it's done; it continuously checks and re-applies. Understanding this model explains everything: why failed pods restart (the ReplicaSet controller sees actual < desired), why resource changes propagate gradually (each controller reconciles at its own rate), and why Kubernetes self-heals without human intervention.**

---

## Intuition

Think of Kubernetes as a building's facilities management team with a very specific job description: make reality match the blueprint, continuously.

**The blueprint (desired state):** "There must be 3 payment-service pods running, each with 2 CPU and 4 GB RAM, on nodes labeled `region=us-east`."

**The facilities team (controllers):** Continuously walks the building (the cluster). Checks: "Are there exactly 3 payment-service pods? On the right nodes? With the right resources?" If not — fix it. Pod died? Start a new one. Wrong node? Evict and reschedule. Resource drift? Update the pod spec.

**The blueprint storage (etcd):** The single source of truth for what the desired state is. Every controller reads from etcd. When you run `kubectl apply`, you're updating the blueprint in etcd. The controllers see the change and reconcile.

**The scheduler:** A specialized part of the facilities team that decides which specific room (node) each new resident (pod) moves into, based on available space (CPU/memory), room requirements (affinity), and occupancy rules (taints/tolerations).

---

## Visual Explanation

### Kubernetes Control Plane Architecture

```
                    ┌────────────────────────────────────────────────────┐
                    │               Control Plane                         │
                    │                                                    │
  kubectl apply ──▶ │  ┌──────────────┐   ┌────────────────────────┐   │
                    │  │  API Server  │──▶│         etcd           │   │
  Dashboard ──────▶ │  │  (kube-api)  │◀──│  (distributed KV,     │   │
                    │  └──────┬───────┘   │   Raft consensus,     │   │
                    │         │           │   strongly consistent) │   │
                    │  ┌──────┴───────┐   └────────────────────────┘   │
                    │  │  Scheduler   │  Watch API → make decisions     │
                    │  │(kube-sched.) │  Writes pod.spec.nodeName       │
                    │  └──────────────┘                                 │
                    │  ┌──────────────┐                                 │
                    │  │  Controller  │  Reconciliation loops:           │
                    │  │  Manager     │  ReplicaSet, Deployment,         │
                    │  │  (kube-ctrl) │  StatefulSet, Job, CronJob...    │
                    │  └──────────────┘                                 │
                    └────────────────────────────────────────────────────┘
                                        │ watches + acts on objects
                    ┌───────────────────┼─────────────────────────────┐
                    │    Worker Nodes   │                             │
                    │  ┌────────────┐  │  ┌────────────┐             │
                    │  │  Node 1    │  │  │  Node 2    │   ...       │
                    │  │  kubelet   │◀─┘  │  kubelet   │             │
                    │  │  (watches  │     │  (watches  │             │
                    │  │  API svr)  │     │  API svr)  │             │
                    │  │  kube-proxy│     │  kube-proxy│             │
                    │  │  container │     │  container │             │
                    │  │  runtime   │     │  runtime   │             │
                    │  └────────────┘     └────────────┘             │
                    └─────────────────────────────────────────────────┘

Failure modes:
  etcd down:        API server cannot serve writes. Reads may work from cache.
                    Scheduler and controllers cannot update desired state.
                    Running pods continue (kubelet doesn't need API server for running pods)
  
  API server down:  kubectl commands fail. No new pods scheduled.
                    Running pods continue (same as above — kubelet local state)
  
  Scheduler down:   New pods stay in Pending state (not scheduled to any node)
                    Running pods unaffected
  
  Controller mgr:   No reconciliation. Dead pods not replaced. Deployments stalled.
                    Running pods unaffected
  
  Worker node down: Pods on that node fail. Controller manager sees pod count drops.
                    New pods scheduled on remaining nodes (after node unhealthy timeout ~5 min)
```

### The Reconciliation Loop

```
ReplicaSet Controller reconciliation loop (runs every ~15 seconds):

  DESIRED: spec.replicas = 3, selector: app=payment-service
  ACTUAL:  List pods matching selector: [pod-1, pod-2]  ← only 2 pods!
  DELTA:   desired(3) - actual(2) = 1 pod needed

  Action: Create pod-3 via API server
    → API server writes pod to etcd (status.phase=Pending)
    → Scheduler watches for Pending pods → selects node → updates pod.spec.nodeName
    → kubelet on selected node watches API server → sees pod assigned to it → pulls image → starts container
    → kubelet updates pod status → status.phase=Running, status.conditions[Ready]=True
    → ReplicaSet controller: next reconcile sees 3 Running pods → no action needed

  This loop runs continuously, forever. Even if nothing changed: it checks.
  If the pod is deleted externally: next loop creates a replacement.
  This is why Kubernetes self-heals: the reconciliation loop.
```

---

## Core Concepts

### 1. etcd — The Foundation

etcd is a strongly consistent, distributed key-value store based on the Raft consensus protocol (Chapter 8). Every Kubernetes object (pods, services, deployments, secrets, configmaps) is stored in etcd.

```
etcd guarantees:
  - Linearizability: reads and writes are ordered. A write that succeeds is visible
    to all subsequent reads on any node.
  - Consensus: writes require quorum (≥ (N/2)+1 of N nodes).
    3-node etcd: requires 2 of 3. Tolerates 1 failure.
    5-node etcd: requires 3 of 5. Tolerates 2 failures.

etcd cluster requirements:
  - Dedicated fast SSD (NVMe preferred) — etcd is latency-sensitive
  - Low network latency between etcd nodes (< 10ms RTT within DC)
  - Separate from worker nodes (dedicated "master" nodes)
  - 3 nodes for production (HA), 5 for high-value clusters
  
etcd sizing guidelines:
  Storage: default quota 2 GB (low!). Set: --quota-backend-bytes=8589934592 (8 GB)
  Memory: 8 GB RAM recommended for etcd nodes
  
etcd health commands:
  etcdctl endpoint health --cluster
  etcdctl endpoint status --cluster --write-out=table
  # Shows: endpoint, ID, version, DB size, is leader, raft term, raft index
  
etcd compaction (required for long-running clusters):
  etcd keeps every revision of every key (MVCC — like PostgreSQL).
  Without compaction: etcd DB grows without bound.
  Kubernetes compacts automatically: kube-apiserver flag:
    --etcd-compaction-interval=5m  (compact every 5 minutes)
    --etcd-count-compaction-revision=1000  (keep last 1000 revisions)
  
  Alert: etcd DB size > 6 GB → compact immediately or etcd will hit quota and reject writes
```

**etcd watch mechanism — how controllers work:**
```
All Kubernetes controllers watch the API server (not etcd directly):
  Watch request: GET /api/v1/pods?watch=true&resourceVersion=12345
  
  Server-sent events stream:
    ADDED: {pod-1 created}
    MODIFIED: {pod-1 status changed to Running}
    DELETED: {pod-2 deleted}
  
  The API server maintains watch connections and streams events to all watchers.
  Watchers: ReplicaSet controller, Deployment controller, kubelet, HPA, kube-scheduler...
  
  resourceVersion: etcd MVCC version number. Each write increments it.
  Watch from resourceVersion: re-establishes watch from a specific point (handles disconnection).
```

### 2. The Scheduler — Pod Placement

The scheduler's job: for each new Pending pod, choose a node. The scheduler runs a pipeline of filters and scoring.

**Scheduling pipeline:**

```
1. Filtering (hard constraints — eliminate invalid nodes):
   NodeSelector: pod.spec.nodeSelector must match node labels
   NodeAffinity: more expressive (required/preferred, In/NotIn/Exists...)
   Taints/Tolerations: node taints must be tolerated by the pod
   Resource fit: node.allocatable.cpu >= pod.requests.cpu and memory
   Pod affinity/anti-affinity: co-location or separation constraints
   Volume affinity: pod needs a PVC in zone us-east-1b → only nodes in that zone pass
   
2. Scoring (soft constraints — rank valid nodes):
   Least requested: prefer nodes with more free resources (spread pods)
   Most requested: pack pods tightly (for bin-packing efficiency)
   Node affinity: higher score for preferred node affinities
   Image locality: prefer nodes that already have the container image (faster start)
   Topology spread: balance pods across zones/nodes (even distribution)
   
3. Binding: scheduler writes pod.spec.nodeName to the API server → pod is "scheduled"
```

**NodeAffinity (prefer us-east nodes, require not-spot):**
```yaml
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:  # hard requirement
      nodeSelectorTerms:
        - matchExpressions:
            - key: cloud.google.com/gke-spot
              operator: NotIn
              values: ["true"]     # never schedule on spot instances
    preferredDuringSchedulingIgnoredDuringExecution:  # soft preference
      - weight: 100
        preference:
          matchExpressions:
            - key: topology.kubernetes.io/zone
              operator: In
              values: ["us-east1-b", "us-east1-c"]  # prefer specific zones
```

**Pod Anti-Affinity (spread replicas across zones):**
```yaml
affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchLabels:
            app: payment-service
        topologyKey: topology.kubernetes.io/zone
        # Hard requirement: no two payment-service pods in the same zone
        # If only 2 zones exist and 3 replicas needed: third pod stays Pending!
    
    # Better — soft anti-affinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchLabels:
              app: payment-service
          topologyKey: topology.kubernetes.io/zone
          # Prefer different zones, but allow same zone if no alternative
```

**TopologySpreadConstraint (preferred over podAntiAffinity for even distribution):**
```yaml
topologySpreadConstraints:
  - maxSkew: 1                          # max difference in pod count between zones
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: DoNotSchedule    # or ScheduleAnyway (soft)
    labelSelector:
      matchLabels:
        app: payment-service
# Result: if zone A has 3 pods and zone B has 2, new pod goes to zone B.
# maxSkew: 1 means zones differ by at most 1 pod.
```

**Taints and Tolerations:**
```yaml
# Node taint: "only GPU pods here"
kubectl taint nodes gpu-node-1 nvidia.com/gpu=present:NoSchedule
# NoSchedule: pods without toleration not scheduled here
# PreferNoSchedule: prefer not to schedule (soft)
# NoExecute: evict existing pods without toleration (immediate)

# Pod toleration:
tolerations:
  - key: "nvidia.com/gpu"
    operator: "Equal"
    value: "present"
    effect: "NoSchedule"
    # This pod tolerates the GPU taint → can be scheduled on gpu-node-1
```

### 3. Resource Requests and Limits — The Most Misunderstood Kubernetes Concept

```
requests: what the scheduler uses to place the pod. Guaranteed minimum.
limits: what the runtime enforces. Maximum allowed.

CPU:
  requests.cpu: number of CPU shares guaranteed (scheduling decision)
  limits.cpu: hard cap via Linux cgroups (CPU throttling)
  Unit: 1 = 1 vCPU core, 0.5 = 500m (millicores)
  
  What happens at limits.cpu:
    Container is throttled when it exceeds the limit.
    CPU is throttled, not killed.
    Symptom: container runs but is slow (CPU throttling)
    Diagnose: container_cpu_throttled_seconds_total / container_cpu_usage_seconds_total

Memory:
  requests.memory: minimum guaranteed (scheduling decision)
  limits.memory: hard cap via cgroups (OOM kill)
  Unit: bytes, Mi, Gi
  
  What happens at limits.memory:
    Container is OOM killed by the kernel.
    Pod status: OOMKilled
    Restart policy: usually restarts pod → CrashLoopBackOff if persistent
    Diagnose: kubectl describe pod → "OOMKilled", or container_oom_events_total
```

**The QoS classes:**
```
Guaranteed (best):
  requests.cpu == limits.cpu AND requests.memory == limits.memory
  → This pod is last to be evicted under node pressure
  → Predictable performance (no throttling surprises)
  
Burstable:
  requests < limits (or only requests, no limits)
  → Evicted before Guaranteed pods under node pressure
  → Can burst above requests up to limits
  
BestEffort (worst):
  No requests or limits set
  → First to be evicted under node pressure
  → Can use any available resources
  → NEVER use for production workloads

Production recommendation: 
  Set requests = expected average usage
  Set limits = expected peak usage (2-3× requests for bursty services)
  Use Guaranteed QoS for critical services (payment, auth)
```

**Common requests/limits mistakes:**
```
Mistake 1: requests = 0 (or not set)
  Scheduler places pod on any node regardless of available resources
  Node: may be fully utilized → pod starves for CPU → high latency
  Fix: always set requests based on profiled CPU/memory usage

Mistake 2: limits too low (e.g., limits.memory = 128Mi, actual usage = 512Mi)
  Pod repeatedly OOMKilled → CrashLoopBackOff
  Service unavailable intermittently
  Diagnose: kubectl top pod, container_memory_working_set_bytes metric

Mistake 3: limits.cpu set very low on a startup-heavy app (JVM, Spring Boot)
  JVM startup: uses 4× steady-state CPU for class loading and JIT compilation
  CPU throttled during startup → pod takes 120s to start (normally 10s)
  Readiness probe fails → pod restarted → boot loop
  Fix: higher CPU limit, or no CPU limit (memory limit without CPU limit = valid config)

Mistake 4: requests.memory too high (over-reservation)
  Each pod reserves 4 GB but uses 500 MB
  Scheduler sees: 40% of nodes "used" (by reservations)
  But actual usage: 5% → 95% of memory unused
  Effect: pods stay Pending despite physical capacity available
  Fix: rightsize requests using VPA recommendations
```

**Vertical Pod Autoscaler (VPA) for rightsizing:**
```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: payment-service-vpa
spec:
  targetRef:
    apiVersion: "apps/v1"
    kind: Deployment
    name: payment-service
  updatePolicy:
    updateMode: "Off"  # Recommend only, don't auto-apply (safe for production)
    # "Auto": apply recommendations → pod restarts (disruptive)
    # "Initial": apply only at pod creation
    # "Off": only report, never apply (use for visibility first)
  resourcePolicy:
    containerPolicies:
      - containerName: payment-service
        minAllowed:
          cpu: 100m
          memory: 128Mi
        maxAllowed:
          cpu: 4
          memory: 8Gi
```

```bash
# Check VPA recommendations:
kubectl describe vpa payment-service-vpa
# Shows:
#   Lower Bound: cpu=150m, memory=256Mi (minimum safe values)
#   Target: cpu=350m, memory=512Mi (recommended for normal operation)
#   Upper Bound: cpu=1200m, memory=2Gi (allow headroom for spikes)
```

### 4. Kubernetes Networking

**Pod Networking (CNI — Container Network Interface):**
```
Each pod gets a unique IP address from the cluster CIDR (e.g., 10.244.0.0/16).
Pod IPs are routable within the cluster (any pod can reach any other pod by IP).

How it works:
  1. CNI plugin (Flannel, Calico, Cilium, etc.) creates a virtual network.
  2. Each node: a bridge interface (cni0 in Flannel) connects pod network to node network.
  3. Pod-to-pod on same node: via the bridge (no external network hop).
  4. Pod-to-pod cross-node: via node routing (each node routes to pod CIDR of other nodes).
     Flannel: UDP/VXLAN encapsulation (overlay network)
     Calico: BGP routing (underlay — direct routing, no encapsulation, faster)
     Cilium: eBPF XDP (kernel-level, fastest — bypasses iptables entirely)
```

**Service — Stable Virtual IP:**
```
Problem: Pod IPs change (pod is replaced → new IP).
Solution: Service = stable virtual IP (ClusterIP) that load-balances to matching pods.

ClusterIP Service:
  Selector: app=payment-service
  ClusterIP: 10.96.42.100 (stable, doesn't change)
  Port: 80 → targetPort: 8080
  
  How it works (with kube-proxy):
    kube-proxy on each node: watches Services and Endpoints
    When pods change: kube-proxy updates iptables rules
    iptables rules: PREROUTING → if dest=10.96.42.100:80 → DNAT to random pod IP:8080
    
  With Cilium (eBPF):
    No iptables (removed entirely)
    eBPF map: lookup ClusterIP → get pod IP → forward directly
    10-100× fewer kernel operations → lower latency

Service types:
  ClusterIP: internal only (default)
  NodePort: exposed on every node's IP on a specific port (e.g., :31080)
            → external traffic via <node-ip>:31080 → Service → pod
  LoadBalancer: provisions cloud load balancer (AWS NLB, GCP LB)
                → external traffic → cloud LB → NodePort → pod
  ExternalName: DNS CNAME to external service (no proxy)
  Headless (ClusterIP: None): returns pod IPs directly (for StatefulSets, DNS-based discovery)
```

**DNS in Kubernetes (CoreDNS):**
```
Every pod gets /etc/resolv.conf pointing to CoreDNS:
  nameserver: 10.96.0.10  (CoreDNS ClusterIP)
  search: production.svc.cluster.local svc.cluster.local cluster.local

Fully qualified DNS for a Service:
  <service-name>.<namespace>.svc.cluster.local
  payment-service.production.svc.cluster.local

Short names work due to search domains:
  Calling "payment-service" from a pod in "production" namespace:
  → resolves as payment-service.production.svc.cluster.local ✅
  
  Calling "payment-service" from a pod in "orders" namespace:
  → resolves as payment-service.orders.svc.cluster.local → NOT FOUND
  → must use payment-service.production.svc.cluster.local (FQDN)

StatefulSet pod DNS (each pod has a stable DNS name):
  <pod-name>.<service-name>.<namespace>.svc.cluster.local
  db-0.postgres.production.svc.cluster.local
  db-1.postgres.production.svc.cluster.local
  (These are stable even when pods restart — crucial for stateful systems)
```

**Ingress and Gateway API:**
```
Ingress (older, being replaced by Gateway API):
  Exposes HTTP(S) routes outside the cluster.
  Requires an Ingress controller (nginx-ingress, Traefik, HAProxy, AWS ALB Ingress, etc.)
  
  apiVersion: networking.k8s.io/v1
  kind: Ingress
  spec:
    rules:
      - host: api.example.com
        http:
          paths:
            - path: /orders
              pathType: Prefix
              backend:
                service:
                  name: order-service
                  port: 80
            - path: /payments
              pathType: Prefix
              backend:
                service:
                  name: payment-service
                  port: 80
    tls:
      - hosts: [api.example.com]
        secretName: tls-secret

Gateway API (newer standard, more expressive):
  Separate roles: GatewayClass (infrastructure), Gateway (network endpoint),
                  HTTPRoute (application routing)
  Supports: advanced traffic splitting, header matching, cross-namespace routing
  Supported by: Istio, Linkerd, nginx, Cilium, Contour, and more
```

### 5. Rolling Deployments and Zero-Downtime Strategies

**Deployment rolling update:**
```yaml
spec:
  replicas: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1    # At most 1 pod can be unavailable during update
      maxSurge: 1          # At most 1 extra pod above desired count
  # Update sequence with 5 replicas:
  # Start: 5 v1 pods
  # Step 1: Create 1 v2 pod (now 5v1 + 1v2 = 6 total, surge=1)
  #         Wait for v2 pod to be Ready
  # Step 2: Terminate 1 v1 pod (now 4v1 + 1v2 = 5 total)
  # Step 3: Create 1 v2 pod (now 4v1 + 2v2 = 6, then 3v1 + 2v2 = 5)
  # ... repeat until 0v1 + 5v2
```

**minReadySeconds — the critical missing piece:**
```yaml
spec:
  minReadySeconds: 30
  # Pod must be Ready for 30 consecutive seconds before it's considered "available"
  # Without this: pod passes readiness probe once → marked Available → old pod terminated
  #               But: pod might fail again after 1 second (transient startup success)
  # With minReadySeconds: pod must sustain readiness for 30s before old pod is removed
  # → catches pods that are intermittently ready during startup
```

**Readiness probe design:**
```yaml
readinessProbe:
  httpGet:
    path: /actuator/health/readiness  # Spring Boot readiness endpoint
    port: 8080
  initialDelaySeconds: 20   # wait 20s before first probe (JVM startup)
  periodSeconds: 5           # probe every 5 seconds
  failureThreshold: 3        # 3 consecutive failures = not ready (15 seconds)
  successThreshold: 1        # 1 success = ready
  timeoutSeconds: 3          # probe times out after 3s
  
# What the readiness probe should check:
#   ✅ Can this pod serve traffic? (DB connection, dependencies up, cache warm)
#   ❌ Is the pod alive? (that's livenessProbe's job)
#   ❌ Are all external dependencies healthy? (if payment depends on Stripe,
#       Stripe outage shouldn't make payment pod not-ready — it should still
#       serve requests and return errors gracefully)

livenessProbe:
  httpGet:
    path: /actuator/health/liveness
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10
  failureThreshold: 5    # 5 failures = restart the pod
  # livenessProbe only restarts deadlocked pods — don't make it too sensitive
  # A pod that fails liveness is RESTARTED (not just removed from LB)
  # Overly sensitive liveness = pods restarting under temporary load
```

**Pod Disruption Budget (PDB) — protecting against simultaneous evictions:**
```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: payment-service-pdb
spec:
  minAvailable: 2        # always keep at least 2 pods available
  # OR: maxUnavailable: 1  (allow at most 1 pod unavailable at a time)
  selector:
    matchLabels:
      app: payment-service

# PDB enforces: during voluntary disruptions (node drains, cluster upgrades),
# Kubernetes will not evict a pod if it would violate the PDB.

# Voluntary disruptions:
#   - kubectl drain node (for maintenance)
#   - Cluster autoscaler scale-down
#   - Rolling update (but rollout respects maxUnavailable separately)
#   - Node upgrade

# What PDB does NOT protect against:
#   - Hardware failure (involuntary disruption — pod dies regardless)
#   - Pod crashes (OOM, liveness failure)

# Warning: PDB with minAvailable = replicas will block all node drains!
#           Always minAvailable < replicas (leave room for 1 disruption)
```

**Graceful shutdown — the SIGTERM lifecycle:**
```
When Kubernetes terminates a pod:
  1. Pod removed from Service Endpoints (stops receiving new requests)
  2. SIGTERM sent to container (application must handle this signal)
  3. terminationGracePeriodSeconds: 30 (default — time given to graceful shutdown)
  4. SIGKILL sent after grace period (force kill)

Application behavior on SIGTERM:
  1. Stop accepting new connections (signal handler: set isShuttingDown = true)
  2. Wait for in-flight requests to complete (drain active requests)
  3. Close DB connections, flush caches, stop background workers
  4. Exit cleanly

Common mistake: application ignores SIGTERM → Kubernetes waits 30s → SIGKILL
  → In-flight requests are abruptly cut off → 502 errors for clients
  → Connections reset, transactions potentially incomplete

Spring Boot:
  server.shutdown=graceful        # enables graceful shutdown
  spring.lifecycle.timeout-per-shutdown-phase=20s  # 20s to drain

Node.js:
  process.on('SIGTERM', () => {
    server.close(() => { process.exit(0); }); // close server, allow drain
  });

Kubernetes delay for endpoint removal propagation:
  Step 1 (endpoint removal) → Step 2 (SIGTERM) happen simultaneously.
  But: Service endpoint removal propagates through kube-proxy iptables with a delay.
  During this propagation delay (100-500ms): new requests still arrive at the pod.
  Fix: preStop lifecycle hook with a sleep:
  
  lifecycle:
    preStop:
      exec:
        command: ["/bin/sh", "-c", "sleep 5"]  # wait 5s for endpoint removal to propagate
  # Then SIGTERM fires → graceful drain
  # Total: 5s (preStop) + up to 25s (drain) = 30s grace period
```

### 6. Horizontal Pod Autoscaling (HPA)

HPA scales deployment replicas based on observed metrics:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: payment-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: payment-service
  minReplicas: 3
  maxReplicas: 50
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60  # scale when average CPU > 60% of requests
    - type: Resource
      resource:
        name: memory
        target:
          type: AverageValue
          averageValue: 512Mi    # scale when average memory > 512Mi
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second  # custom metric (from Prometheus Adapter)
        target:
          type: AverageValue
          averageValue: 1000m   # target 1 RPS per pod (1000m = 1)
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300  # wait 5 minutes before scaling down
      policies:
        - type: Percent
          value: 20             # scale down at most 20% of pods per minute
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 30   # scale up quickly (30s)
      policies:
        - type: Percent
          value: 100            # can double pod count per 15 seconds
          periodSeconds: 15
        - type: Pods
          value: 4              # or add at most 4 pods per 15 seconds
          periodSeconds: 15
      selectPolicy: Max         # use whichever policy allows more pods (faster scale-up)
```

**HPA scaling algorithm:**
```
desiredReplicas = ceil(currentReplicas × (currentMetric / desiredMetric))

Example: 5 pods, CPU utilization = 80%, target = 60%
  desiredReplicas = ceil(5 × (80 / 60)) = ceil(6.67) = 7

Example: 5 pods, CPU = 30%, target = 60%
  desiredReplicas = ceil(5 × (30 / 60)) = ceil(2.5) = 3
  (But scale-down stabilization window = 300s → scale-down delayed)

HPA does NOT scale below minReplicas or above maxReplicas.
HPA evaluates every 15 seconds (default: --horizontal-pod-autoscaler-sync-period).
```

**KEDA (Kubernetes Event-Driven Autoscaling):**
For scaling based on external signals that HPA can't handle natively:
```yaml
# Scale payment-service based on Kafka consumer lag:
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: payment-kafka-scaler
spec:
  scaleTargetRef:
    name: payment-service
  minReplicaCount: 2
  maxReplicaCount: 100
  triggers:
    - type: kafka
      metadata:
        bootstrapServers: kafka.production:9092
        consumerGroup: payment-service
        topic: orders.created
        lagThreshold: "100"   # add 1 pod per 100 messages of lag
        offsetResetPolicy: latest
    - type: prometheus
      metadata:
        serverAddress: http://prometheus:9090
        metricName: http_requests_per_second
        threshold: "1000"
        query: sum(rate(http_requests_total{service="payment"}[1m]))
```

### 7. Cluster Autoscaling

The Cluster Autoscaler (CA) adds and removes nodes based on pod scheduling pressure:

```
Scale-up trigger:
  A pod is Pending (cannot be scheduled) because no node has enough resources.
  CA: evaluates if adding a node would allow the pod to be scheduled.
  CA: requests new node from cloud provider (AWS ASG, GKE MIG, Azure VMSS).
  New node: joins cluster within 2-5 minutes.
  Pod: scheduled on new node.

Scale-down trigger:
  A node is underutilized (<50% requested) for 10+ minutes.
  CA: can all pods on this node fit on other nodes?
  Yes: evict pods (respecting PDBs!) → cloud provider terminates node.
  
PDB interaction with CA scale-down:
  CA respects PDB: if evicting pods would violate PDB → node NOT drained.
  Common pattern: PDB too restrictive → CA cannot scale down any nodes.
  
Cluster Autoscaler configuration (helm values):
  balance-similar-node-groups: true     # balance pods across node groups
  scale-down-utilization-threshold: 0.5 # drain nodes below 50% utilization
  scale-down-delay-after-add: 10m       # don't scale down too quickly after scale-up
  scale-down-unneeded-time: 10m         # node must be unneeded for 10m before drain
  max-node-provision-time: 15m          # fail if node doesn't join within 15 minutes

Node groups by instance type (spot vs on-demand):
  On-demand group: 3-10 nodes (baseline, always available)
  Spot group: 0-50 nodes (cheap, can be reclaimed by cloud provider 2-min notice)
  
  Workloads on spot: batch jobs, non-critical services with preStop handlers
  Workloads on on-demand: databases, stateful services, critical APIs
```

### 8. RBAC and Security

**RBAC model:**
```
RBAC building blocks:
  ServiceAccount: identity for a pod (like a user account for services)
  Role: set of permissions (in a namespace)
  ClusterRole: set of permissions (cluster-wide)
  RoleBinding: bind Role to ServiceAccount/User/Group in a namespace
  ClusterRoleBinding: bind ClusterRole cluster-wide

Principle of least privilege:
  Each pod's ServiceAccount: only the permissions it needs, nothing more.
  
Example: payment-service needs to read Secrets in its namespace only:
  ServiceAccount: payment-service
  Role: read-secrets (verbs: get, list, watch; resources: secrets; namespace: production)
  RoleBinding: payment-service → read-secrets
  
  NOT: binding ClusterRole cluster-admin to a pod ServiceAccount
       (common mistake in tutorials → pods have full cluster control)
```

```yaml
# Minimal RBAC for a typical service:
apiVersion: v1
kind: ServiceAccount
metadata:
  name: payment-service
  namespace: production
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: payment-service-role
  namespace: production
rules:
  - apiGroups: [""]
    resources: ["secrets"]
    resourceNames: ["payment-db-credentials", "stripe-api-key"]  # specific secrets only
    verbs: ["get"]
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: payment-service-binding
  namespace: production
subjects:
  - kind: ServiceAccount
    name: payment-service
    namespace: production
roleRef:
  kind: Role
  name: payment-service-role
  apiGroup: rbac.authorization.k8s.io
```

**Pod Security Standards (replacing PodSecurityPolicy):**
```yaml
# Enforce restricted security for namespace:
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted

# "restricted" level requires:
#   - No privileged containers
#   - No host network/PID/IPC sharing
#   - Non-root user (runAsNonRoot: true)
#   - Read-only root filesystem (readOnlyRootFilesystem: true)
#   - Drop all capabilities, add only needed ones
#   - seccomp profile set (RuntimeDefault or Localhost)
```

```yaml
# Secure pod spec (restricted compliant):
securityContext:
  runAsNonRoot: true
  runAsUser: 10001
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop: ["ALL"]
  seccompProfile:
    type: RuntimeDefault
```

---

## Step-by-Step Execution

### Diagnosing a CrashLoopBackOff

```bash
# Pod in CrashLoopBackOff:
kubectl get pods -n production
# NAME                        READY   STATUS             RESTARTS   AGE
# payment-service-abc-xyz     0/1     CrashLoopBackOff   7          12m

# Step 1: Get events:
kubectl describe pod payment-service-abc-xyz -n production
# Look for: "Liveness probe failed", "OOMKilled", "Error", reason, exit codes

# Step 2: Get current logs:
kubectl logs payment-service-abc-xyz -n production

# Step 3: Get previous container logs (from before the last crash):
kubectl logs payment-service-abc-xyz -n production --previous
# This is the log from the crashed instance → shows the actual error

# Step 4: Exec into a running pod (if there's a brief window):
kubectl exec -it payment-service-abc-xyz -n production -- /bin/sh

# Step 5: Check events across namespace:
kubectl get events -n production --sort-by='.lastTimestamp' | tail -20

# Common CrashLoopBackOff causes and diagnosis:
# Exit code 1:  Application error. Check --previous logs for stack trace.
# Exit code 137 (SIGKILL): OOMKilled. Check describe pod → "OOMKilled".
#              Fix: increase memory limits
# Exit code 143 (SIGTERM): Not handling SIGTERM gracefully.
# Liveness probe failing: App deadlocked or slow to start.
#              Fix: increase initialDelaySeconds, failureThreshold, or fix the bug.
```

### Diagnosing Pending Pods

```bash
kubectl get pods -n production
# NAME                        READY   STATUS    RESTARTS   AGE
# ml-job-abc                  0/1     Pending   0          30m

kubectl describe pod ml-job-abc -n production
# Events section shows WHY:
# "0/8 nodes are available: 8 Insufficient memory."
#   → No node has enough memory → scale up or reduce memory requests
# "0/8 nodes are available: 8 node(s) had taint {dedicated: ml-nodes}"
#   → Pod needs toleration for the taint
# "0/8 nodes are available: 8 pod has unbound immediate PersistentVolumeClaims"
#   → PVC not bound (storage class issue, zone mismatch)
# "Unschedulable: 0/8 nodes are available: 8 node(s) didn't match pod affinity rules"
#   → PodAntiAffinity too strict → relax to Preferred

# Check node resources:
kubectl describe nodes | grep -A 5 "Allocated resources"
# Shows: CPU requests/limits and memory requests/limits per node
# If all nodes at ~95% memory requests: need more nodes or smaller requests
```

---

## Deep Dive

### How kubectl apply Works — Server-Side Apply

```
Traditional (client-side apply):
  kubectl apply -f deployment.yaml
  
  1. kubectl reads the current resource from API server
  2. kubectl merges changes (3-way merge: current, previous applied, new)
  3. kubectl sends PUT/PATCH to API server
  
  Problem: multiple actors (kubectl, Helm, ArgoCD) may conflict → last writer wins
           → fields from other managers get overwritten silently

Server-side apply (default since k8s 1.22):
  kubectl apply --server-side -f deployment.yaml
  
  1. kubectl sends the full manifest to API server
  2. API server does the merge (server-side), tracking field managers
  3. Each field has an owner: "kubectl", "helm", "kyverno", etc.
  4. If two managers try to own the same field → conflict error (not silent overwrite)
  
  This is why ArgoCD and Helm can coexist safely:
  ArgoCD manages: spec.template, spec.replicas
  HPA manages: spec.replicas (HPA is a field manager)
  kubectl apply: cannot accidentally overwrite HPA's replica count
```

### StatefulSets — For Stateful Workloads

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres  # must match headless service name
  replicas: 3
  selector:
    matchLabels:
      app: postgres
  template:
    spec:
      containers:
        - name: postgres
          image: postgres:15
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:          # unique PVC per pod
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: fast-ssd
        resources:
          requests:
            storage: 100Gi

# StatefulSet guarantees:
#   Stable pod names: postgres-0, postgres-1, postgres-2 (not random hashes)
#   Stable DNS: postgres-0.postgres.production.svc.cluster.local
#   Stable storage: postgres-0 always gets the same PVC (data-postgres-0)
#   Ordered startup: postgres-0 starts and is Ready before postgres-1 starts
#   Ordered shutdown: postgres-2 terminates before postgres-1 (reverse order)
#
# These properties enable leader election:
#   postgres-0 is always the primary candidate (known identity)
```

---

## Real-World Example

### Kubernetes at Google — Borg's Legacy

Kubernetes was inspired by Google's internal cluster management system, Borg, which has managed Google's production workloads since 2003.

**Key lessons from Borg that shaped Kubernetes:**

1. **Declarative, not imperative:** "I want 10 replicas of this service" rather than "start pod X on server Y." This enables self-healing — Kubernetes figures out how to achieve the goal.

2. **Resource quotas from day one:** Borg enforced CPU/memory requests and limits from the start. Google learned that without resource isolation, one runaway job affects the entire fleet.

3. **Heterogeneous workloads on shared infrastructure:** Long-running services (low CPU, consistent) and batch jobs (bursty CPU) share the same machines. Scheduling intelligence ensures they don't fight for resources.

4. **The scheduler is a constraint satisfaction problem:** Borg's scheduler runs Omega-style simulation — thousands of feasibility checks per second. Kubernetes's scheduler is a simplified version of the same model.

**Borg statistic:** At Google's scale, 10,000+ machines per cluster, millions of jobs per day. Borg achieves 80%+ cluster utilization (industry average: 10-30% on bare metal without orchestration).

---

## Failure Scenarios

### Scenario 1: Rolling Update Outage from Missing PDB

```
Deployment: payment-service, 5 replicas.
No PodDisruptionBudget configured.
Kubernetes cluster upgrade: cluster operator drains nodes one by one.

kubectl drain node-1 --ignore-daemonsets --delete-emptydir-data
  → evicts all pods from node-1
  
payment-service pods on node-1: 3 pods (cluster scheduler placed too many on one node!)
  → pods evicted simultaneously
  → 5 replicas - 3 evicted = 2 remaining (on other nodes)
  → New pods must be scheduled → takes 30 seconds
  → For 30 seconds: only 2 pods serving traffic (40% capacity)
  → Traffic spikes → 2 pods overwhelmed → latency climbs → some requests timeout

If drain was faster or more pods per node:
  All 5 pods evicted → zero pods → complete service outage.

Fix:
  1. PodDisruptionBudget: minAvailable=3 (cluster drain respects PDB)
     → Cannot evict pods if it would leave < 3 available
     → Node drain blocks until new pods are scheduled elsewhere
  
  2. TopologySpreadConstraints: spread pods across nodes (max 2 per node)
     → Drain of one node: at most 2 pods evicted → 3 remaining → service maintained
  
  3. PodAntiAffinity: prefer different nodes (soft)
     → Scheduler naturally spreads pods across nodes
```

### Scenario 2: etcd Disk Full — Complete Cluster Halt

```
Production cluster. etcd default quota: 2 GB. Not monitored.
After 6 months of heavy usage: etcd DB grows to 2.0 GB.

etcd hit quota:
  All WRITE operations to API server fail: "etcdserver: mvcc: database space exceeded"
  kubectl get pods → works (reads from API server cache)
  kubectl apply → fails: "etcdserver: mvcc: database space exceeded"
  New pods cannot be created. Deployments stall. HPA cannot scale.
  
  The cluster appears to work: running pods are fine.
  But: any new deployment, config change, or scaling operation → fails.
  
  Oncall: "All writes failing, cluster appears healthy otherwise."
  
Emergency fix:
  1. Compact etcd:
     ETCDCTL_API=3 etcdctl --endpoints=... compact $(etcdctl --endpoints=... endpoint status --write-out="json" | jq '.[0].Status.header.revision')
  
  2. Defragment to reclaim space:
     ETCDCTL_API=3 etcdctl --endpoints=... defrag
  
  3. Raise quota (prevent recurrence):
     --quota-backend-bytes=8589934592  (8 GB)
  
  4. Add monitoring:
     etcd_mvcc_db_total_size_in_bytes > 6Gi → alert

Prevention:
  Set quota to 8 GB from the start.
  Alert at 75% usage (6 GB) → compact.
  Automatic compaction: --auto-compaction-mode=periodic --auto-compaction-retention=1h
```

---

## Performance Considerations

### Kubernetes API Server Scalability

```
API server handles:
  - kubectl commands from developers (interactive)
  - Controller reads/watches (continuous background traffic)
  - kubelet status updates from every node (every 10-30s per node)
  
At 1,000 nodes:
  kubelet → API server: 1,000 nodes × 1 request/10s = 100 req/s just from kubelets
  Controller watches: 20+ controllers, each maintaining persistent watch streams
  
API server limits (per instance):
  --max-requests-inflight: 400 (max concurrent non-mutating requests)
  --max-mutating-requests-inflight: 200 (max concurrent mutating requests)
  
At 5,000+ nodes:
  Multiple API server instances (stateless, can be scaled horizontally)
  Load balancer in front of API servers
  etcd: scaled to 5 nodes (more write throughput)

Watch connection optimization:
  --watch-cache-sizes: in-memory cache for watch events (reduces etcd reads)
  APIServer watch cache serves most watch requests without hitting etcd
  Default: 100 objects per resource type in watch cache
  At high pod counts: increase: --watch-cache-sizes=pods#1000
```

---

## Trade-offs

| Decision | Benefit | Cost |
|----------|---------|------|
| Resource requests = limits (Guaranteed QoS) | Predictable, never evicted | No burstability, wastes headroom |
| Low requests, high limits (Burstable) | Can burst when needed | Evicted first under pressure |
| No resource limits | Max flexibility | Risk of OOM killing other pods |
| maxUnavailable=50% rolling update | Faster deployments | 50% capacity loss during update |
| maxUnavailable=0 rolling update | Zero capacity loss | Requires surge, slower |
| PDB minAvailable=replicas-1 | Maximum protection | Node drains very slow |
| Node affinity (required) | Hard placement guarantee | Pods Pending if no matching node |
| Spot nodes | 70-90% cost savings | Pods evicted with 2-min notice |
| Cluster Autoscaler aggressive | Scales up fast | More cloud cost |
| StatefulSet vs Deployment | Stable identity, ordered ops | Harder to scale, slower updates |

---

## Production Considerations

1. **Always set both requests and limits.** Pods without requests are scheduled arbitrarily and may starve. Pods without memory limits are evicted unpredictably (or killed by OOM at any time). Use LimitRange to enforce defaults per namespace.
2. **Define a PodDisruptionBudget for every production Deployment.** Without a PDB, a node drain can terminate multiple replicas simultaneously. `minAvailable: replicas-1` is the safe default.
3. **Add `minReadySeconds` to all Deployments.** A pod that passes readiness once but then fails repeatedly will cause rolling update oscillation. `minReadySeconds: 30` catches intermittent-readiness pods.
4. **Use `preStop: sleep 5`** for all services behind a load balancer. This delays SIGTERM just long enough for endpoint removal to propagate through kube-proxy, preventing connections being sent to a terminating pod.
5. **Monitor etcd database size and latency.** Set alert at 75% of quota. Enable automatic compaction. etcd disk I/O latency > 10ms causes API server slowness across the entire cluster.
6. **TopologySpreadConstraints over PodAntiAffinity for most use cases.** `maxSkew: 1` across zones guarantees even distribution without the "stuck Pending" risk of required anti-affinity.

---

## Common Beginner Mistakes

1. **Setting `resource.requests.memory` too low relative to actual usage.** The scheduler places the pod, but the container immediately gets OOMKilled because it needs 2 GB but requested 256 MB. Use VPA in "Off" mode to discover actual usage before setting requests.
2. **Using `requiredDuringScheduling` anti-affinity with replicas > number of nodes/zones.** If you have 2 zones and require pods in different zones: 3 replicas → third pod is permanently Pending. Use `preferredDuringScheduling`.
3. **Not handling SIGTERM in the application.** Default behavior in many frameworks: catch SIGTERM, immediately exit. Any in-flight requests are dropped. Always implement graceful shutdown.
4. **Pointing livenessProbe and readinessProbe to the same endpoint with the same thresholds.** Liveness should be very conservative (only restart truly deadlocked pods). Readiness should be accurate (reflect actual ability to serve). Different paths, different thresholds.

---

## Common Senior Engineer Mistakes

1. **Using HPA with `averageUtilization` CPU without knowing what "requests" are set to.** HPA measures CPU utilization as a percentage of `requests.cpu`. If requests is set to 100m but the pod normally uses 500m: HPA thinks utilization is 500%, scales wildly. Set requests to actual average CPU usage.
2. **Using `kubectl apply` for production changes without GitOps.** Ad-hoc kubectl applies to production are unaudited, unrepeatable, and create state drift between environments. Use ArgoCD or Flux for GitOps — all changes via Git, automatically applied.
3. **Cluster Autoscaler with nodes that have non-evictable pods (DaemonSets or pods without PDB).** CA cannot drain a node if it contains pods that cannot be evicted. CA shows those nodes as "undrainable" → cluster never scales down → unexpectedly high cloud bill.
4. **etcd nodes sharing disk with other workloads.** etcd is extremely sensitive to disk latency (fsync). If etcd shares a disk with container image pulls, log writes, or other I/O: etcd latency spikes → API server latency spikes → controllers slow down → cascade. etcd must have a dedicated disk (NVMe preferred).

---

## Architecture Smells

- **Pods with no resource requests or limits** → eviction lottery and scheduling chaos
- **No PodDisruptionBudgets** → node drains kill multiple replicas simultaneously → outage
- **Single-node etcd** → etcd failure = complete cluster failure
- **All pods in a single namespace** → no RBAC isolation, all pods share the same blast radius
- **`cluster-admin` ClusterRole bound to a pod ServiceAccount** → compromised pod owns the entire cluster
- **Ingress with no rate limiting or WAF** → exposed to DDoS and scraping attacks
- **No topology spread for stateless services** → all replicas on the same node → single node failure = service outage
- **HPA minReplicas=1** → scale-to-zero problem: at minReplicas=1, cold starts affect all traffic

---

## Principal Engineer Perspective

Kubernetes is not just an infrastructure tool — it is an organizational contract. When a team runs on Kubernetes, they are agreeing to:
- Express their compute needs declaratively (resource requests/limits)
- Design their services to be stateless and re-schedulable
- Handle SIGTERM gracefully (their pods may be evicted at any time)
- Define their availability requirements (PDB, replicas, affinity)
- Accept eventual consistency in state management (reconciliation loops take time)

**The Principal Engineer's Kubernetes questions:**

1. **What happens when this node goes down?** If the answer is "we lose the service," the workload is not properly distributed (missing anti-affinity, insufficient replicas, PDB not configured).

2. **What happens when the cluster is upgraded?** Every Kubernetes cluster upgrade requires node drains. If workloads don't have PDBs and proper graceful shutdown, every cluster upgrade is a production risk.

3. **How long does it take to go from 0 to full capacity after a cold start?** Cluster scale-up + pod scheduling + image pull + startup probe + readiness probe = total cold-start time. For traffic spikes, this must be < the time the spike lasts.

4. **Can a single team's misbehaving workload take down another team's service?** Without namespace-level resource quotas, a batch job with no resource limits can starve the payment service. ResourceQuota per namespace is essential for multi-team clusters.

5. **Who has access to the production cluster and what can they do?** `kubectl exec` into a production pod is as powerful as SSH into a production server. RBAC must restrict who can exec, port-forward, read secrets, or apply changes to production namespaces.

**Multi-tenancy in Kubernetes (hard problem):**
True multi-tenancy (untrusted teams on the same cluster) is very difficult in Kubernetes:
- Linux kernel vulnerabilities can break container isolation
- Shared control plane (API server, etcd) — a noisy namespace can impact API server
- Recommended: separate clusters per team for high-security workloads; namespace isolation + ResourceQuota + NetworkPolicy + PodSecurity for trusted teams

---

## Architecture Review Questions

1. What happens to the service when one cluster node fails? Does it survive automatically?
2. Are PodDisruptionBudgets defined for all production services?
3. Are resource requests and limits set for every container? Are they accurate (based on profiled usage)?
4. Are TopologySpreadConstraints or pod anti-affinity configured to distribute pods across zones?
5. Does every service handle SIGTERM gracefully? Is `preStop: sleep` configured?
6. What is the etcd database size? Is compaction enabled? Is there an alert at 75% quota?
7. Are namespace-level ResourceQuotas defined to prevent noisy neighbor problems?
8. Is RBAC applied with least privilege? Do any pods have cluster-admin ClusterRole?
9. What is the cluster upgrade process? Is it tested in staging before production?
10. Is cluster autoscaling configured? Are spot nodes used for non-critical workloads?

---

## Visual / Animation Specification

### Animation 1: Reconciliation Loop — Self-Healing

**Four panels: Desired State (etcd), ReplicaSet Controller, Actual State (nodes), Actions.**

**Step 1 (normal):** Desired = 3 pods. Actual = [pod-1✅, pod-2✅, pod-3✅]. Controller: "3 == 3, no action."

**Step 2 (failure):** Node crash. pod-3 disappears. Actual = [pod-1✅, pod-2✅]. Controller: "2 < 3, need to create 1 pod."

**Step 3 (action):** Controller sends "Create pod" to API server → Scheduler picks node → kubelet starts pod.

**Step 4 (recovered):** Actual = [pod-1✅, pod-2✅, pod-4✅ (new)]. Controller: "3 == 3, no action."

**Total time shown on timeline: ~45 seconds from crash to recovery.**

**Caption:** "Kubernetes: observe → compare → act. Continuously. No human intervention."

### Animation 2: Rolling Update with and without PDB

**Left side (without PDB):** 5 pods shown as green circles. Node drain starts: 3 pods on the drained node blink red simultaneously and disappear. 2 green circles remain. Red warning: "60% capacity gone. Latency spike."

**Right side (with PDB: minAvailable=3):** Same drain starts. 1 pod blinks red (drain blocks). "PDB: 4/5 available, minimum 3 required. Safe to evict 1." That pod disappears. Immediately: new pod appears green on another node. Now 5 pods again. Next pod evicted. Process continues: always ≥ 4 pods available.

**Caption:** "Without PDB: 3 pods evicted simultaneously. With PDB: 1 at a time, always ≥ 3 available."

---

## Hands-On Tutorial

### Resource Management and HPA Setup

```yaml
# 1. Set ResourceQuota for namespace (limit total resource consumption):
apiVersion: v1
kind: ResourceQuota
metadata:
  name: production-quota
  namespace: production
spec:
  hard:
    requests.cpu: "50"       # total CPU requests across all pods
    requests.memory: 100Gi  # total memory requests
    limits.cpu: "100"
    limits.memory: 200Gi
    pods: "200"              # max 200 pods in namespace
    persistentvolumeclaims: "20"
---
# 2. Set LimitRange (default requests/limits for pods without explicit values):
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: production
spec:
  limits:
    - type: Container
      default:
        cpu: 500m
        memory: 512Mi
      defaultRequest:
        cpu: 100m
        memory: 128Mi
      max:
        cpu: "4"
        memory: 8Gi
      min:
        cpu: 50m
        memory: 64Mi
```

```bash
# Deploy a service with HPA:
kubectl apply -f deployment.yaml
kubectl apply -f hpa.yaml

# Generate load and watch HPA scale:
kubectl run load-generator --image=busybox -it --rm -- \
  /bin/sh -c "while true; do wget -q -O- http://payment-service/health; done"

# Watch HPA in action:
kubectl get hpa payment-service-hpa -w
# NAME                    REFERENCE                    TARGETS    MINPODS  MAXPODS  REPLICAS
# payment-service-hpa     Deployment/payment-service   87%/60%    3        50       3
# payment-service-hpa     Deployment/payment-service   87%/60%    3        50       5
# payment-service-hpa     Deployment/payment-service   62%/60%    3        50       5
# payment-service-hpa     Deployment/payment-service   55%/60%    3        50       5 (stable)

# Check top resources:
kubectl top pods -n production
kubectl top nodes

# Check VPA recommendations (if deployed):
kubectl describe vpa payment-service-vpa -n production
```

---

## Exercises

**Conceptual:**
1. Explain the Kubernetes reconciliation loop. What is "desired state" vs "actual state"? Give an example of how a ReplicaSet controller uses this model.
2. What is the difference between resource `requests` and `limits` for CPU and memory? What happens when a container exceeds each?
3. Explain the three Kubernetes QoS classes (Guaranteed, Burstable, BestEffort). How is each class determined, and in what order are pods evicted under node pressure?
4. What is a PodDisruptionBudget? What specific operations does it control? What does it NOT protect against?
5. What happens to a pod when it receives SIGTERM? What happens if the application does not handle SIGTERM?

**Architecture:**
6. Design the complete rollout configuration for a payment service with 10 replicas, which must maintain at least 8 replicas available during deployments and cluster upgrades, spread evenly across 3 availability zones.
7. Your cluster has 100 pods using approximately 50% of available CPU. Suddenly 50 new pods are scheduled (a traffic spike) and 30 stay Pending. What are the three most likely causes, and how would you diagnose each?
8. Design a multi-tenant Kubernetes cluster for 5 engineering teams, each with their own namespace. Each team should have isolated resources, scoped RBAC, and be prevented from consuming more than their fair share of cluster resources.

**Quantitative:**
9. A Deployment has 5 replicas, `maxUnavailable: 1`, `maxSurge: 1`. How many total pods exist at each step of a rolling update? Draw the full sequence.
10. An HPA is configured with `averageUtilization: 70` for CPU. Currently: 8 pods, CPU utilization = 90%. Calculate the target replica count. Then the load drops and utilization = 25%. Calculate the new target, accounting for the fact that HPA won't scale below `minReplicas: 5`.

---

## Solutions

### Exercise 9 (Rolling Update Sequence)

Initial: 5 v1 pods. maxUnavailable=1, maxSurge=1.
- **Start:** 5 v1. Target: 5 v2. `maxUnavailable=1` → minimum available = 4. `maxSurge=1` → max total = 6.
- **Step 1:** Create 1 v2 pod. Total: 5v1 + 1v2 = **6 pods** (surge). Wait for v2 to be Ready.
- **Step 2:** Terminate 1 v1. Total: 4v1 + 1v2 = **5 pods**.
- **Step 3:** Create 1 v2. Total: 4v1 + 2v2 = **6 pods**. Wait for v2 ready. Terminate 1 v1.
- **Step 4:** 3v1 + 2v2 = **5 pods**. Create 1 v2. 3v1 + 3v2 = **6 pods**. Terminate 1 v1.
- **Step 5:** 2v1 + 3v2 = **5 pods**. Create 1 v2. 2v1 + 4v2 = **6 pods**. Terminate 1 v1.
- **Step 6:** 1v1 + 4v2 = **5 pods**. Create 1 v2. 1v1 + 5v2 = **6 pods**. Terminate 1 v1.
- **Done:** 0v1 + 5v2 = **5 pods**.

Pattern: alternates between 5 and 6 total pods. Never below 4 available (maxUnavailable=1).

### Exercise 10

**Scale up:**
`desiredReplicas = ceil(8 × (90/70)) = ceil(8 × 1.286) = ceil(10.28) = **11 replicas**`

**Scale down:**
`desiredReplicas = ceil(8 × (25/70)) = ceil(8 × 0.357) = ceil(2.857) = **3 replicas**`
But minReplicas=5, so actual target = **5 replicas** (HPA respects minReplicas floor).
Additionally: scale-down stabilization window (default 300s) delays the reduction.

---

## Interview Questions

### Beginner
- What is Kubernetes? What problem does it solve compared to running containers directly?
- What is a Pod? What is a Deployment? What is a Service?
- What is the difference between a liveness probe and a readiness probe?

### Senior
- Explain the Kubernetes scheduler: how does it decide which node a pod goes to?
- What is the difference between `requests` and `limits`? What happens when a pod exceeds its memory limit?
- What is a PodDisruptionBudget and when would you use it?
- Walk through what happens when you run `kubectl apply -f deployment.yaml`.

### Staff
- Design the resource management strategy for a cluster running 100 microservices across 10 teams. How do you prevent one team's workload from starving another's?
- Explain how the Kubernetes reconciliation loop enables self-healing. What are the limits of this approach?
- A deployment is stuck in a rolling update with pods in CrashLoopBackOff. Walk through your diagnosis and the commands you run.
- How does Kubernetes HPA work? What are the pitfalls of misconfigured CPU requests when using HPA?

### Principal
- Design the Kubernetes cluster architecture for a global platform: 500 services, 5 regions, 10,000 pods. Address: control plane HA, etcd sizing, multi-region traffic, cluster upgrade strategy.
- A cluster upgrade is planned during a weekend. Walk through the complete procedure to ensure zero production impact: PDB audit, node drain sequence, rollback plan, monitoring.
- Kubernetes uses eventual consistency for its control loops. Describe three specific scenarios where this eventual consistency causes issues, and how each is mitigated.

---

## Summary

Kubernetes is a reconciliation-based orchestration system that continuously converges actual state to declared desired state:

- **etcd:** Linearizable distributed KV store (Raft). Every Kubernetes object stored here. etcd failure = no new writes, running pods unaffected but cluster management halted. Must be monitored for disk space, latency, and leader health.
- **Control plane:** API server (HTTP gateway + validation), scheduler (pod→node placement via filter+score), controller manager (reconciliation loops per resource type). Each component is stateless and horizontally scalable (except etcd).
- **Scheduling:** Filter (hard constraints: resources, affinity, taints) → Score (soft preferences: locality, spread) → Bind (write nodeName). TopologySpreadConstraints for zone distribution.
- **Resources:** `requests` for scheduling guarantees; `limits` for enforcement. CPU over-limit → throttling. Memory over-limit → OOMKill. QoS: Guaranteed (evicted last) > Burstable > BestEffort (evicted first).
- **Rolling updates:** `maxUnavailable` + `maxSurge` + `minReadySeconds` + PDB = zero-downtime deployments. SIGTERM handling + `preStop: sleep` = clean connection drain.
- **HPA:** scales replicas based on CPU/memory/custom metrics. `averageUtilization` measured against `requests`. Stabilization window prevents flapping.
- **Security:** RBAC (least privilege ServiceAccounts), PodSecurity restricted, NetworkPolicy (deny by default).
- **Common failures:** CrashLoopBackOff (check `--previous` logs), OOMKilled (increase limits), Pending (check describe for scheduling reason), etcd disk full (compact + raise quota).

---

## What You Should Now Be Able To Explain

- ✅ Why a running pod is unaffected by API server downtime — kubelet runs locally from last known state
- ✅ The full scheduling pipeline: filter → score → bind
- ✅ Why CPU and memory behave differently at limits: throttle vs kill
- ✅ The rolling update sequence math: pods created and terminated in a specific order
- ✅ Why a PodDisruptionBudget doesn't protect against hardware failures
- ✅ The complete graceful shutdown sequence: endpoint removal propagation → preStop → SIGTERM → drain → SIGKILL

---

## What To Learn Next

**Chapter 17 — CI/CD and Deployment Pipelines.** Kubernetes is how services run in production. Chapter 17 covers how they get there: continuous integration (building, testing, scanning container images), continuous delivery (pushing to staging), and continuous deployment (automated rollout to production using GitOps with ArgoCD, blue-green deployments, feature flags, and rollback strategies). The chapter where "we push to production manually" becomes "production deploys automatically, safely, and verifiably, 50 times a day."
