# Chapter 10 — Observability: Metrics, Logs, and Tracing

## Difficulty
Intermediate → Advanced

## Importance
**Must Know** — You cannot fix what you cannot see. Observability is the discipline of making distributed systems understandable from the outside. Monitoring asks "is the system working?" Observability asks "why is the system broken?" — and answers it with data, not guesswork. Every production incident resolution reduces to: how quickly can you understand what changed, what is failing, and why. The difference between a 5-minute resolution and a 2-hour war room is observability quality.

## Prerequisites
Chapter 9 — Distributed Systems Failure Modes (cascading failures, partial failures)
Chapter 5 — Infrastructure Networking (load balancers, proxies — generate the most signal)
Chapter 6 — Message Queues (consumer lag is an observability metric)

## Learning Objectives

By the end of this chapter you will be able to:

1. Explain the "three pillars of observability" — metrics, logs, and traces — and what each uniquely provides.
2. Describe the RED method (Rate, Errors, Duration) and USE method (Utilization, Saturation, Errors) and apply them to service instrumentation.
3. Explain how Prometheus collects metrics, the difference between counters, gauges, histograms, and summaries, and why histogram bucketing matters.
4. Design a structured logging schema and explain why structured logs are essential for distributed system debugging.
5. Explain distributed tracing: how spans and traces work, how context propagation happens across service boundaries, and what trace sampling strategies exist.
6. Define the Four Golden Signals (latency, traffic, errors, saturation) and explain how to set SLO-based alerts.
7. Explain the difference between SLI, SLO, and SLA — and why alerting on SLO burn rate is superior to alerting on a threshold.
8. Design an observability strategy for a new microservice from first principles.

## Why This Matters

Without observability, a production incident looks like this: "Users are reporting errors. Nobody knows why. Everyone looks at their own service — all green. The incident takes 3 hours to resolve because nobody can see across service boundaries."

With observability, the same incident looks like: "Error rate alert fired at 14:32. Trace shows: 98% of failing requests have a span to `payment-service` taking 4,200ms (normal: 12ms). Payment service logs show: `connection pool timeout`. Payment service metrics show: `db.pool.pending = 45, db.pool.active = 10/10`. DB metrics show: `slow_queries_total` spiked at 14:31. Root cause identified: 14:33. Fixed: 14:35."

Observability is an engineering discipline, not a product. You must design it into your systems deliberately.

---

## Mental Model

> **Metrics tell you something is wrong. Logs tell you what happened. Traces tell you where. You need all three, because each answers a different question. Metrics give you the aggregate view across thousands of requests — ideal for alerting. Logs give you the detail of specific requests — ideal for debugging. Traces connect the dots across services — ideal for understanding causality. The weakness of each is the strength of another.**

---

## Intuition

Imagine you manage a hospital with 50 operating rooms, each with its own team.

**Metrics (the dashboard):** A central board shows: surgical success rate, average operation duration, rooms in use, staff utilization. When something is wrong, the board changes — a number goes red. You know something is wrong, and roughly what kind of thing (too many long surgeries), but not which patient or why.

**Logs (the medical record):** Each room keeps a detailed record of every event: "14:30 — Patient entered. 14:31 — Anesthesia administered. 14:45 — Complication: bleeding." When a specific patient has a bad outcome, you read their record to understand the exact sequence of events.

**Traces (the patient journey):** The patient passed through triage, X-ray, pre-op, surgery, recovery, pharmacy. Each handoff is documented. The trace shows which steps took how long, who was responsible, and where the delay happened — even though the patient touched 7 different departments.

Without any one of these, your ability to understand and improve the system is severely limited.

---

## Visual Explanation

### The Three Pillars and Their Relationships

```
     METRICS                    LOGS                      TRACES
  (Aggregated)             (Individual Events)         (Request Paths)
  ────────────             ────────────────────        ───────────────
  
  http_requests_total      2024-01-15T14:32:01         TraceID: abc123
  {status="500"} 42        INFO payment processed       │
                           traceID=abc123               ├─ [API GW] 2ms
  http_duration_p99        userID=u789                  │
  {service="payment"}      amount=99.99                 ├─ [auth-svc] 5ms
  = 4200ms   ← ALERT!      status=success               │
                                                        ├─ [payment-svc] 4190ms ← !
  db_pool_active = 10      2024-01-15T14:32:01          │   └─ [db-query] 4180ms
  db_pool_max = 10         ERROR db timeout              │
  db_pool_pending = 45     traceID=abc123               └─ [notify-svc] 3ms
  ← tells you WHAT         orderID=o456
                           ← tells you WHAT HAPPENED    ← tells you WHERE

  RELATIONSHIP:
  Metric alert fires → look at traces for that time window → find slow span
  → look at logs for that service during that trace → find the specific error
```

### The Signal Flow in a Production System

```
User Request
    │
    ▼
Service A ─── emits ──▶ Metrics (Prometheus scrape / StatsD push)
    │         └──────▶ Logs (stdout → Fluentd → Elasticsearch)
    │         └──────▶ Spans (OpenTelemetry SDK → Jaeger/Zipkin/Tempo)
    │
    ▼
Service B ─── same ──▶ Metrics / Logs / Spans
    │
    ▼
Database ──── same ──▶ Query metrics / Slow query logs / DB spans

Observability Platform:
  Metrics: Prometheus + Grafana
  Logs: Elasticsearch / Loki + Kibana / Grafana
  Traces: Jaeger / Zipkin / Tempo + Grafana

SLO Dashboard:
  SLI: error_rate = rate(errors[5m]) / rate(requests[5m])
  SLO: error_rate < 0.1% (99.9% success)
  Alert: burn_rate > 14.4 (exhausting 30-day error budget in 2 hours)
```

---

## Core Concepts

### 1. Metrics — The Aggregate View

A metric is a numeric measurement of a system property, sampled over time. Metrics are cheap to store and fast to query because they discard individual request details in favor of statistical summaries.

#### Metric Types (Prometheus model)

**Counter:**
- Monotonically increasing integer (only goes up, resets to 0 on restart)
- Use for: total requests, total errors, total bytes sent, total retries
- Query pattern: use `rate()` or `increase()` over a time window

```promql
# HTTP request rate per second over last 5 minutes
rate(http_requests_total{service="payment"}[5m])

# Error rate as percentage
rate(http_requests_total{status=~"5.."}[5m]) 
  / rate(http_requests_total[5m]) * 100
```

**Gauge:**
- A value that can go up and down
- Use for: current connection count, memory usage, queue depth, temperature, CPU usage

```promql
# DB connection pool utilization
db_pool_active{service="payment"} / db_pool_max{service="payment"}

# Queue depth over time (for consumer lag alerting)
kafka_consumer_lag{group="inventory-service", topic="order.created"}
```

**Histogram:**
- Samples observations and places them into configurable buckets
- Records: count of observations per bucket, sum of all observed values, total count
- Use for: request durations, response sizes — anything where you want percentiles

```promql
# p99 latency of payment service (from histogram)
histogram_quantile(0.99,
  rate(http_request_duration_seconds_bucket{service="payment"}[5m]))

# This requires buckets to be defined in the instrumentation:
http_request_duration_seconds_bucket{le="0.005"} 2423  # ≤5ms
http_request_duration_seconds_bucket{le="0.01"}  2845  # ≤10ms
http_request_duration_seconds_bucket{le="0.025"} 2953  # ≤25ms
http_request_duration_seconds_bucket{le="0.05"}  2998  # ≤50ms
http_request_duration_seconds_bucket{le="0.1"}   3021  # ≤100ms
http_request_duration_seconds_bucket{le="0.5"}   3024  # ≤500ms
http_request_duration_seconds_bucket{le="1.0"}   3025  # ≤1000ms
http_request_duration_seconds_bucket{le="+Inf"}  3025  # all observations
```

**Why bucket design matters:**
```
Bad buckets: [0.1, 1.0, 10.0, +Inf]
  Your SLO is p99 < 200ms.
  All requests between 100ms and 1000ms fall in the same bucket.
  histogram_quantile cannot estimate p99 accurately — it assumes
  uniform distribution within a bucket. Result: wildly inaccurate percentiles.

Good buckets: [.005, .01, .025, .05, .1, .2, .5, 1.0, 2.0, 5.0, +Inf]
  Your 200ms SLO lives between two buckets (0.1 and 0.2).
  Prometheus can linearly interpolate → accurate p99 estimate.

Rule: Put buckets at 2× your SLO thresholds, and at your p50 and p95 baseline.
```

**Summary (vs Histogram):**
- Pre-computes quantiles client-side (φ-quantile with φ-approximation)
- Use when: you need accurate quantiles but cannot aggregate across instances
- Do NOT use for percentiles when you have multiple service instances — summaries from different instances cannot be aggregated (you get the average of quantiles, not the quantile of the aggregate). Use histograms for multi-instance services.

#### The RED Method (for Services)

For every service, instrument:
- **R — Rate:** Requests per second (total throughput)
- **E — Errors:** Error count/rate (4xx and 5xx)
- **D — Duration:** Latency distribution (p50, p95, p99)

```
RED metrics for the payment-service:
  payment_requests_total{method, path, status}           ← R + E (counter)
  payment_request_duration_seconds_bucket{method, path}  ← D (histogram)

Derived alerts:
  Rate:    rate(payment_requests_total[5m]) < 10        → traffic drop alert
  Errors:  rate(payment_requests_total{status=~"5.."}[5m]) 
             / rate(payment_requests_total[5m]) > 0.01  → error rate > 1%
  Duration: histogram_quantile(0.99, ...) > 0.5         → p99 > 500ms
```

#### The USE Method (for Resources)

For every resource (CPU, memory, disk, connection pools, thread pools):
- **U — Utilization:** % of time the resource is busy (CPU busy %, pool active/max)
- **S — Saturation:** How much work is waiting (run queue depth, pool pending count)
- **E — Errors:** Resource-level errors (disk I/O errors, OOM kills, dropped packets)

```
USE metrics for the payment-service:
  Utilization: process_cpu_seconds_total, jvm_memory_used_bytes/jvm_memory_max_bytes
               db_pool_active / db_pool_max
  Saturation:  db_pool_pending, jvm_threads_runnable_total
               http_server_requests_queued (if applicable)
  Errors:      jvm_gc_collection_seconds_count{cause="OutOfMemoryError"}
               db_pool_connection_timeout_total
```

**USE and RED together:** RED tells you the service's output from the client's perspective. USE tells you why a service is slow or failing (which internal resource is the bottleneck).

#### The Four Golden Signals (Google SRE Book)

1. **Latency:** How long requests take (distinguish successful vs failed latency separately — a 500ms error is different from a 500ms success)
2. **Traffic:** How much demand is coming in (RPS, events/sec, QPS)
3. **Errors:** Rate of failed requests (explicit 5xx, implicit timeouts, wrong answers)
4. **Saturation:** How "full" is the service (CPU %, queue depth, connection pool usage)

These four signals, for every service in your system, give you the complete picture of system health.

### 2. Prometheus Architecture

Prometheus uses a **pull model** — it scrapes metrics from services via HTTP rather than services pushing to a central server.

```
Architecture:

Service A                  Service B
  /metrics endpoint          /metrics endpoint
  (Prometheus text format)   (same)
       ▲                          ▲
       │ HTTP GET /metrics         │ HTTP GET /metrics
       │ every 15s                 │
  ┌────┴──────────────────────┐
  │     Prometheus Server     │
  │  ┌─────────────────────┐  │
  │  │   Scrape Manager    │  │   ← pulls from all targets
  │  │   (every 15s)       │  │
  │  └────────┬────────────┘  │
  │           ▼               │
  │  ┌─────────────────────┐  │
  │  │   TSDB              │  │   ← Time Series Database
  │  │   (local storage)   │  │   ← chunked, compressed, ~2 bytes/sample
  │  └────────┬────────────┘  │
  │           ▼               │
  │  ┌─────────────────────┐  │
  │  │   PromQL Engine     │  │   ← query language
  │  └─────────────────────┘  │
  └───────────────────────────┘
            │
            ▼
        Grafana (visualization)
        Alertmanager (alerts → PagerDuty/Slack)
```

**Pull vs Push trade-offs:**

| Aspect | Pull (Prometheus) | Push (StatsD, InfluxDB line protocol) |
|--------|------------------|--------------------------------------|
| Service discovery | Prometheus discovers targets | Services must know endpoint |
| Network security | Prometheus needs access to services | Services push outward (firewall-friendly) |
| Failure detection | Missing scrape = service down | Silent failures (service may be down but not pushing) |
| Scaling | Prometheus bottleneck at high cardinality | Push can distribute across multiple collectors |
| Short-lived jobs | Miss the metrics window | Push immediately before dying |

**Prometheus labels and cardinality:**
Labels are key-value pairs that add dimensions to metrics:
```
http_requests_total{method="GET", path="/users", status="200", region="us-east-1"}

Each unique combination of label values = a separate time series.
Cardinality = number of unique time series.

HIGH CARDINALITY ANTI-PATTERN:
  http_requests_total{user_id="u12345"}  ← USER IDs as labels
  1 million users × 4 methods × 200 paths = 800 million time series
  → Prometheus OOM, query timeout, storage exhaustion
  
CORRECT: Aggregate in the service, not in labels:
  http_requests_total{method, path, status}  ← No user_id
  Per-user analysis: use logs or traces (they handle high cardinality)
```

**Alertmanager routing:**
```yaml
# alert.rules.yml
- alert: PaymentServiceHighErrorRate
  expr: |
    rate(http_requests_total{service="payment",status=~"5.."}[5m])
    / rate(http_requests_total{service="payment"}[5m]) > 0.01
  for: 2m          # Alert must be true for 2 minutes before firing
  labels:
    severity: critical
    team: payments
  annotations:
    summary: "Payment service error rate > 1%"
    description: "Current rate: {{ $value | humanizePercentage }}"
    runbook: "https://wiki/runbooks/payment-errors"

# alertmanager.yml
route:
  group_by: [team]
  routes:
    - match:
        team: payments
      receiver: payments-pagerduty
    - match:
        severity: critical
      receiver: sre-pagerduty
```

### 3. Structured Logging

A log is a timestamped, ordered record of events. **Structured logging** means emitting logs as machine-parseable key-value pairs (JSON, logfmt) rather than unstructured strings.

**Unstructured (bad for production):**
```
2024-01-15 14:32:01 ERROR Payment failed for user u789 order o456 amount $99.99 error: connection timeout
```

**Structured (parseable, filterable, aggregatable):**
```json
{
  "timestamp": "2024-01-15T14:32:01.234Z",
  "level": "ERROR",
  "service": "payment-service",
  "version": "2.1.4",
  "traceId": "abc123def456",
  "spanId": "789xyz",
  "userId": "u789",
  "orderId": "o456",
  "amount": 99.99,
  "currency": "USD",
  "error": "connection timeout",
  "errorType": "DatabaseConnectionTimeoutException",
  "dbPoolPending": 45,
  "dbPoolActive": 10,
  "durationMs": 5003,
  "host": "payment-pod-abc-xyz",
  "region": "us-east-1"
}
```

**Why structured logs matter:**
```
Query: "How many payment failures in the last hour caused by DB timeouts?"

Unstructured: grep + regex → brittle, slow, breaks on format changes
Structured:   SELECT COUNT(*) WHERE level='ERROR' AND errorType='DatabaseConnectionTimeoutException'
              AND timestamp > now() - interval '1 hour'
              → instant answer in Elasticsearch/Loki

Query: "What was the average duration of failed payments?"
Unstructured: parse 'amount $99.99' from string → error-prone
Structured:   AVG(durationMs) WHERE level='ERROR' → trivial
```

#### Log Levels — Used Correctly

| Level | When to use | Who reads it |
|-------|-------------|--------------|
| **TRACE** | Every method entry/exit, every loop iteration | Developers debugging locally |
| **DEBUG** | Request details, intermediate state | Developers debugging in staging |
| **INFO** | Key business events (request received, payment processed, user logged in) | Ops during normal operation |
| **WARN** | Recoverable problems (retry succeeded after 2 attempts, cache miss, degraded mode) | Ops monitoring |
| **ERROR** | Failed operations that need attention (payment failed, DB query failed) | Alerts, on-call |
| **FATAL/CRITICAL** | Unrecoverable failure (app about to crash) | Immediate paging |

**Common mistake:** Using ERROR for every exception, including ones that are expected business logic (user not found, validation failed). This floods the error log and makes real errors invisible. A 404 for `/users/nonexistent` is INFO, not ERROR.

**Log correlation fields (required for distributed debugging):**
Every log line must include:
- `traceId`: the distributed trace ID (links to trace)
- `spanId`: the current span (links to exact span in trace)
- `service`: which service emitted this
- `version`: which deployment version (critical for correlating log change with deployment)
- `host` or `pod`: which instance (critical for isolating pod-specific issues)

#### Log Aggregation Pipeline

```
Service (stdout JSON logs)
    │
    ▼
Log Collector (Fluentd / Fluent Bit / Vector)
  - Runs as DaemonSet on each Kubernetes node
  - Reads container logs from /var/log/containers/*.log
  - Parses, enriches (adds Kubernetes metadata: pod, namespace, node)
  - Forwards to storage
    │
    ▼
Log Storage
  - Elasticsearch + Kibana (ELK/EFK stack): full-text search, aggregations
  - Grafana Loki + LogQL: label-based index (cheaper, Prometheus-like model)
  - Splunk (enterprise): expensive, powerful, full-text + analytics
    │
    ▼
Developer query:
  Kibana: filter by traceId=abc123 → see all log lines for that request
  Loki/LogQL: {service="payment"} |= "ERROR" | json | durationMs > 1000
```

**Loki's approach — log labels (high-cardinality problem again):**
```
Loki indexes only labels (not log content):
  Labels: {service, environment, namespace, pod}
  Log content: NOT indexed, searched via grep at query time

Good labels: {service="payment", env="prod"}
Bad labels: {traceId="abc123"} ← high cardinality → index explosion

Query: Find logs by traceId?
  Correct: {service="payment", env="prod"} |= "abc123"
  (Filter label by service, then grep within the matching streams for traceId)
```

### 4. Distributed Tracing

A distributed trace represents the complete journey of a single request through all the services it touched. It shows causality and latency at each step.

#### Spans and Traces

**Trace:** A collection of spans representing one user request end-to-end. Identified by a globally unique `traceId` (128-bit random number).

**Span:** One unit of work within a trace. Identified by `spanId`. Has:
- `traceId`: the parent trace
- `spanId`: unique ID for this span
- `parentSpanId`: the span that created this span (null for root span)
- `operationName`: what this span does ("db.query", "http.get /users/{id}")
- `startTime`, `endTime`: wall clock times
- `tags`: key-value metadata (db.type, http.status_code, error=true)
- `logs`: timestamped events within the span (for important events)

```
Trace: abc123 (user request to GET /order/456)

Span: root-1 (API Gateway)              ├── 0ms to 15ms
  Span: auth-1 (Auth Service)           │   ├── 1ms to 6ms
  Span: order-1 (Order Service)         │   └── 7ms to 14ms
    Span: db-1 (DB query: SELECT order) │       ├── 8ms to 12ms
    Span: cache-1 (Redis: GET session)  │       └── 12ms to 13ms
    Span: notif-1 (Notification check)  │           (cancelled - not needed)

Visualization (Gantt chart):
0    2    4    6    8   10   12   14   16ms
├─────── API Gateway ─────────────────┤
     ├─auth-svc──┤
              ├──────── order-svc ────┤
                  ├─── db query ──┤
                              ├─cache┤
```

**The Waterfall View:** The canonical trace visualization. Shows each span as a horizontal bar on a timeline. Immediately reveals: which service is the bottleneck (widest bar), sequential vs parallel calls (stacked vs side-by-side bars), and unexpected fan-out.

#### Context Propagation

For distributed tracing to work, the `traceId` and `spanId` must be propagated across service boundaries — embedded in HTTP headers, Kafka message headers, or gRPC metadata.

**W3C Trace Context (industry standard):**
```
HTTP headers:
  traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
               │  │                                │                 │
               │  └─ traceId (16 bytes, hex)       └─ parentSpanId  └─ flags (sampled=01)
               └─ version

  tracestate: vendor=value  (optional, vendor-specific)
```

**Implementation in a Java/Spring Boot service:**
```java
// Using OpenTelemetry SDK (auto-instrumentation handles context propagation)
// Manual instrumentation for custom spans:

@Service
public class PaymentService {
    private final Tracer tracer = GlobalOpenTelemetry.getTracer("payment-service");
    
    public PaymentResult processPayment(Order order) {
        Span span = tracer.spanBuilder("payment.process")
            .setAttribute("order.id", order.getId())
            .setAttribute("amount", order.getAmount())
            .startSpan();
        
        try (Scope scope = span.makeCurrent()) {
            // traceId is now in context, automatically propagated to:
            // - outgoing HTTP calls (via OTel instrumented HTTP client)
            // - DB queries (via OTel instrumented JDBC)
            // - Kafka messages (via OTel instrumented Kafka producer)
            
            PaymentResult result = chargeCard(order);
            span.setAttribute("payment.status", result.getStatus());
            return result;
        } catch (Exception e) {
            span.recordException(e);
            span.setStatus(StatusCode.ERROR, e.getMessage());
            throw e;
        } finally {
            span.end();
        }
    }
}
```

**Auto-instrumentation:** OpenTelemetry Java Agent (a Java agent JAR) instruments HTTP clients, JDBC, gRPC, Kafka, and other libraries automatically without code changes. Run your service with `-javaagent:opentelemetry-javaagent.jar` and all spans are created and propagated transparently.

#### Trace Sampling

Storing every span for every request is expensive. At 10,000 RPS with 10 spans per request = 100,000 spans/second. At 1KB/span: 100 MB/s of trace data.

**Sampling strategies:**

**Head-based sampling (decision at request start):**
```
Probabilistic: sample 1% of all requests
  Pro: simple, predictable storage
  Con: you miss rare errors (a 0.01% error rate is sampled at 0.0001%)
  
Rate-limiting: sample N traces per second per service
  Pro: prevents trace backend overload
  Con: during a spike, you under-sample normal traffic, over-sample spikes
  
Random (per-trace): sample if rand() < 0.01
  Standard approach. Combined with:
  Flag propagation: if trace is sampled (traceparent flags bit=1),
  ALL downstream spans are kept. Consistent: the full trace is kept or dropped.
```

**Tail-based sampling (decision after request completes):**
```
Advantages: can make sampling decision based on outcome
  - Always sample traces with errors (status=ERROR)
  - Always sample traces with latency > p99 threshold
  - Sample only 1% of fast, successful traces

Implementation: all spans collected at an OTel Collector, buffered for ~30s
  After 30s, the collector decides: keep or drop based on the trace's outcome
  If error or slow: keep all spans
  If fast and successful: drop 99%

Real-world result: 99% storage reduction while keeping 100% of interesting traces
```

**Exemplars (metrics ↔ traces bridge):**
Prometheus histograms support **exemplars** — a specific sample observation attached to a histogram bucket, including its traceId:
```
# Prometheus exposition format with exemplar:
http_request_duration_seconds_bucket{le="0.5"} 1234 # {traceID="abc123"} 0.487 1609459200.000

This means: one of the requests in the ≤0.5s bucket had traceID=abc123.
In Grafana: click on a histogram data point → jump directly to the trace.
```
This is the connection between metrics (aggregate signal: p99 is high) and traces (specific example: here is one request that contributed to that p99).

### 5. OpenTelemetry — The Standard

OpenTelemetry (OTel) is the CNCF standard for observability instrumentation. It provides:
- **API:** Language-specific interfaces for creating spans, recording metrics
- **SDK:** Implementation of the API, with sampling, export logic
- **Collector:** A standalone process for receiving, processing, and exporting telemetry

```
Application
  │ OTel SDK
  ▼
OTel Collector (agent sidecar or daemonset)
  │ receives: OTLP (OTel Protocol) traces, metrics, logs
  │ processes: sampling, batching, enrichment, filtering
  │ exports to multiple backends:
  ├──▶ Jaeger (traces)
  ├──▶ Prometheus (metrics, via scrape endpoint)
  ├──▶ Loki (logs)
  └──▶ Datadog / New Relic / Honeycomb (commercial)
```

**OTel Collector pipeline:**
```yaml
receivers:
  otlp:
    protocols:
      grpc: {endpoint: "0.0.0.0:4317"}
      http: {endpoint: "0.0.0.0:4318"}

processors:
  batch:
    timeout: 5s
    send_batch_size: 1024
  tail_sampling:
    decision_wait: 30s
    policies:
      - name: errors-policy
        type: status_code
        status_code: {status_codes: [ERROR]}
      - name: slow-policy
        type: latency
        latency: {threshold_ms: 500}
      - name: probabilistic-policy
        type: probabilistic
        probabilistic: {sampling_percentage: 1}

exporters:
  jaeger:
    endpoint: "jaeger:14250"
  prometheus:
    endpoint: "0.0.0.0:8889"
  loki:
    endpoint: "http://loki:3100/loki/api/v1/push"
```

### 6. SLIs, SLOs, and SLAs

**SLI (Service Level Indicator):** A quantitative measurement of service behavior. The metric.
```
SLI examples:
  - Availability: (successful_requests / total_requests) × 100%
  - Latency: p99 request duration < 200ms
  - Throughput: events processed per second
  - Error rate: errors / total × 100%
  - Freshness: age of the most recently processed record
```

**SLO (Service Level Objective):** The target value for an SLI. The commitment to your users.
```
SLO examples:
  - 99.9% of requests succeed (availability SLO)
  - 99% of requests complete in < 200ms (latency SLO)
  - Consumer lag < 10,000 events 99.9% of the time
```

**SLA (Service Level Agreement):** A legal/business contract specifying SLOs and consequences for violation (e.g., service credits). SLAs are the external commitment; SLOs are the internal target (usually stricter to leave buffer).

```
Typical relationship:
  SLA: 99.5% uptime (legal commitment to customers)
  SLO: 99.9% uptime (internal target — 4× stricter, buffer for unexpected issues)
  SLI: measured uptime = 99.97% (what you actually achieved)
```

**Error budget:**
```
SLO: 99.9% availability (99.9% = 43.8 minutes downtime allowed per month)
Error budget = 100% - 99.9% = 0.1% of requests can fail per month

At 1,000 RPS × 30 days × 86,400 s/day = 2,592,000,000 total requests
Error budget = 0.1% × 2,592,000,000 = 2,592,000 allowed failures per month
             = ~864,000 failures per day
             = 60,000 failures per hour (at normal load)

Burn rate: how fast you're consuming the error budget
  Normal: 1× (consuming budget at SLO pace — exactly on target)
  2× burn: consuming in 15 days (will exhaust budget before month ends)
  14.4× burn: consuming in 2 hours (critical — page immediately)
```

#### SLO-Based Alerting (Multi-Window, Multi-Burn-Rate)

Traditional threshold alerting is brittle:
```
PROBLEM with threshold alerting:
  Alert: error_rate > 1% for 5 minutes
  
  Scenario A: 2% error rate for 5 minutes → alert fires → correct (budget burning)
  Scenario B: 0.5% error rate for 24 hours → no alert → WRONG (budget exhausted overnight)
  Scenario C: 99% error rate for 30 seconds → no alert for 5 minutes → too slow
```

**Burn rate alerting (Google SRE approach):**
```
Alert when burn rate is high enough that the SLO will be violated:

Fast alert (page now — critical):
  Burn rate > 14.4× over 1 hour window
  (At 14.4× burn, you exhaust the monthly budget in 2 hours)
  
Slow alert (ticket — investigate):
  Burn rate > 1× over 6-hour window (exhausting budget faster than planned)

PromQL for payment service availability SLO (99.9%):
  
  # Error rate (1 - availability SLI)
  error_rate = rate(http_requests_total{service="payment",status=~"5.."}[5m])
              / rate(http_requests_total{service="payment"}[5m])
  
  # Burn rate = error_rate / (1 - SLO) = error_rate / 0.001
  burn_rate = error_rate / 0.001
  
  # Fast burn alert (page):
  burn_rate_1h > 14.4
  
  # Slow burn alert (ticket):
  burn_rate_6h > 1.0
  
Multi-window (both windows must fire to reduce false positives):
  Alert if:
    (burn_rate_1h > 14.4 AND burn_rate_5m > 14.4)  → page
    OR (burn_rate_6h > 6.0 AND burn_rate_30m > 6.0) → ticket
```

**Why multi-window?** A single-minute spike in errors might trip a 1-hour burn rate window early (false alarm). Requiring both a short window AND a long window to simultaneously exceed thresholds filters out transient spikes while still catching sustained burns.

### 7. The Observability Stack in Practice

#### Kubernetes Native Stack

```
Metrics:
  kube-state-metrics: Kubernetes object states (pod restarts, deployment rollouts)
  node-exporter: Node-level metrics (CPU, memory, disk, network)
  cAdvisor: Container-level metrics (built into kubelet)
  Service metrics: Application-level (exposed on :8080/metrics)
  
  Collected by: Prometheus (or Thanos for long-term, multi-cluster)
  Visualized by: Grafana

Logs:
  Container logs: stdout/stderr → kubelet → /var/log/containers/
  Collected by: Fluent Bit (DaemonSet) → Loki or Elasticsearch
  Visualized by: Grafana / Kibana

Traces:
  OTel SDK in each service → OTel Collector (Deployment or Sidecar)
  → Jaeger (or Tempo for Grafana integration)
  Visualized by: Jaeger UI / Grafana Tempo

Dashboards:
  USE dashboard per node (CPU, memory, disk saturation)
  RED dashboard per service (requests, errors, duration)
  Business metrics dashboard (orders/sec, payments/sec, user signups)
  SLO dashboard (error budget remaining, burn rate)
```

#### Correlation in Practice: From Alert to Root Cause

```
T=14:32: Alert fires: "PaymentService burn rate > 14.4×"

Step 1: Check metrics dashboard
  → p99 latency: 4,200ms (normal: 12ms)
  → Error rate: 8% (normal: 0.01%)
  → DB pool pending: 45 (normal: 0)
  → DB pool active: 10/10 (saturated)
  Hypothesis: DB is the bottleneck.

Step 2: Check traces for 14:30-14:32
  Filter: service=payment, duration > 1000ms, status=ERROR
  → Find trace ID: abc123 (typical slow failing trace)
  → Waterfall: payment span 4,190ms, DB query span 4,180ms
  Hypothesis confirmed: DB query is the slow step.

Step 3: Check DB query in trace
  → Span tags: db.statement = "SELECT * FROM orders WHERE user_id=? AND status='pending' ORDER BY created_at"
  → No index on (user_id, status, created_at)
  → EXPLAIN ANALYZE: Seq Scan, 2M rows scanned

Step 4: Check logs correlated with the trace
  → {traceId: "abc123"} in Loki
  → Log: "WARN: Slow query detected: 4183ms, query=SELECT * FROM orders..."
  Root cause confirmed: missing index causing full table scan.

Step 5: Remediation
  CREATE INDEX CONCURRENTLY idx_orders_user_status ON orders(user_id, status, created_at DESC);
  Monitor: DB query duration drops from 4,200ms to 8ms. Latency normalizes. Alert resolves.

Total diagnosis time: 3 minutes. (Would have been 3 hours without observability.)
```

---

## Deep Dive

### Histograms and Percentile Accuracy

The `histogram_quantile()` function in Prometheus uses **linear interpolation within a bucket**. The accuracy of the interpolation depends on bucket placement relative to the actual distribution.

```
Example: 95% of requests take 50-100ms. Buckets: [0.01, 0.05, 0.1, 0.5, 1.0]

histogram_quantile(0.99, ...) with bucket [0.1, 0.5]:
  All requests 50-100ms fall in the 0.05-0.1 bucket.
  The 0.1-0.5 bucket: only requests 100-500ms.
  p99 estimated at: 0.1 + (0.99 - 0.95) / (1.0 - 0.95) × (0.5 - 0.1)
                  = 0.1 + 0.004/0.05 × 0.4
                  = 0.1 + 0.032 = 0.132 ← reasonable estimate
  
  But if p99 is actually 95ms, and the bucket boundary is at 100ms,
  Prometheus cannot express "95ms" — it only knows "in the 50-100ms bucket."
  
  Add bucket le="0.075" and le="0.09" to get finer granularity around your SLO.

Practical rule: Add bucket boundaries at multiples of your SLO thresholds.
  SLO: p99 < 200ms → add buckets at [0.1, 0.15, 0.2, 0.3, 0.5]
```

### The Observability vs. Monitoring Distinction

**Monitoring:** You know what questions you want to ask (known unknowns). You set thresholds. You get alerted when they breach.

**Observability:** You can answer questions you didn't know to ask before the system was built (unknown unknowns). You can slice data arbitrarily to discover why an unexpected behavior is happening.

```
Monitoring catches: "Error rate is > 1%" (known failure mode)

Observability enables: "Why are errors 3× higher on pods in us-east-1b?"
  → slice by host/availability-zone tag → isolate the pod
  "Why does user u789 experience errors but u123 doesn't?"
  → filter traces by user_id → find user-specific data issue
  "Why is p99 for mobile clients 3× worse than desktop?"
  → filter by user-agent → find mobile-specific code path

None of these questions could be pre-defined as monitoring thresholds.
They require the ability to explore data ad-hoc — that is observability.
```

### Distributed Tracing Performance Impact

OpenTelemetry instrumentation adds overhead:
```
CPU overhead (auto-instrumentation):
  ~1-3% additional CPU per service (measured in Google's benchmarks)
  Span creation + context propagation + batch export

Memory overhead:
  In-memory span buffer: typically 2-10MB
  Span objects: ~1-5KB per span (in-flight)

Network overhead:
  At 1% sampling, 100 RPS, 10 spans/request:
  Export rate: 100 × 0.01 × 10 = 10 spans/second
  At 1KB/span: 10KB/s (negligible)
  
  At 100% sampling, 10,000 RPS:
  Export rate: 100,000 spans/second → 100MB/s (significant, use 1% sampling)

Latency overhead:
  Span creation: ~0.5µs
  Context propagation: ~0.1µs
  Batch export (async): 0µs (happens in background thread)
  Total: < 1µs per span (negligible for most services)
```

---

## Real-World Example

### How Honeycomb Changed Observability

Honeycomb (and later DataDog, Lightstep, Grafana Cloud) popularized **high-cardinality observability** — the ability to filter, group, and query trace data by any attribute, not just pre-defined labels.

```
Traditional monitoring: "p99 latency is high"
  → Can't say which users, which pods, which DB queries

Honeycomb with structured events:
  Every request emits one event with all context:
  {
    "traceId": "abc123",
    "userId": "u789",
    "planType": "enterprise",
    "region": "us-east-1b",
    "podName": "payment-pod-xyz",
    "dbQueryDuration": 4200,
    "cacheHit": false,
    "featureFlag.newCheckout": true
  }

Query: "GROUP BY planType, region, featureFlag.newCheckout → HEATMAP of dbQueryDuration"
Result: "Enterprise users in us-east-1b with new checkout feature = 4,200ms. Others = 12ms."
  → New checkout feature has a slow DB query for enterprise users in one AZ.
  → Narrow fix: one feature flag, one region, one query to optimize.

This is impossible with traditional metrics (labels can't include userId or featureFlag).
This is observability: arbitrary exploration of any dimension.
```

---

## Failure Scenarios

### Scenario 1: Observability Blind Spot Causes 4-Hour Incident

```
Service A calls Service B (via HTTP).
Service A's error rate: 0% (monitoring: all green)
Service B's error rate: 0% (monitoring: all green)
Users: reporting "orders not processing"

What's happening:
  Service A sends requests to B. B processes them but returns success=false in the JSON body.
  Service A logs the response, doesn't check success field, continues.
  HTTP status: 200 OK.
  No ERROR logged anywhere.
  No metric increment anywhere.

Invisible failure: Business logic error masked by HTTP success.

How to catch with proper observability:
  1. Instrument B to track: business_operations_total{result="success|failure"}
  2. Emit a structured log when success=false (WARN level with context)
  3. Assert in A: if response.success == false → log ERROR, increment metric

This is a "silent" or "dark" failure. The system appears healthy but
delivers wrong behavior. Only observable if you instrument the BUSINESS OUTCOME,
not just the HTTP layer.
```

### Scenario 2: Alert Fatigue Causing Missed P1

```
Company: 2,000 alerts configured across 50 services.
Alert triggers per day: ~200 alerts.
Oncall response rate: 40% (alert fatigue → many ignored).
One Tuesday: a real P1 (payment system down) fires.
Alert: buried in 200 other alerts. Seen 45 minutes later.
Cost: $500,000 in lost transactions.

Root causes:
  1. Alerts on implementation details (e.g., pod restarts) instead of user impact
  2. No severity classification → all 200 alerts look equally important
  3. No error budget awareness → alerting on rate, not budget burn
  4. No runbooks → oncall doesn't know what to do → ignores alerts

Fix:
  1. Delete alerts that don't require human action
  2. Route severity-critical (P1: SLO burn > 14.4×) to PagerDuty (wakes oncall)
  3. Route severity-warning (P3: slow burn) to Slack (review next business day)
  4. Add runbook links to every alert
  5. Review fired alerts weekly: if an alert hasn't led to action in 3 months → delete
```

---

## Performance Considerations

### Prometheus Storage

```
Storage estimate: 2 bytes per sample (compressed with Prometheus TSDB chunks)
  1,000 time series × 1 sample/15s × 86,400s/day = 5,760,000 samples/day
  = 5,760,000 × 2 bytes = ~11 MB/day (incredibly cheap)

At 100,000 time series:
  = 1.1 GB/day → 33 GB/month (still manageable on a single node)
  
At 10,000,000 time series (high cardinality):
  = 110 GB/day → 3.3 TB/month → need Thanos, Cortex, or VictoriaMetrics

Retention: default 15 days. For long-term retention:
  Thanos: stores blocks in S3 (cheap cold storage)
  Cortex: multi-tenant Prometheus with long-term storage
  VictoriaMetrics: efficient single-node up to ~100M time series
```

### Log Ingestion Cost at Scale

```
Volume estimation:
  100 pods × 1,000 log lines/sec × 500 bytes/line = 50 MB/s = 4.3 TB/day

Elasticsearch storage (with 1 replica): 4.3 TB × 2 = 8.6 TB/day

This is why Grafana Loki exists:
  Loki does NOT index log content, only labels
  Storage: raw logs compressed with gzip = ~0.5-1 TB/day (5-10× cheaper)
  Trade-off: queries are slower (grep over raw files, not index lookup)
  Suitable for: logs where you know which service emitted them (filter by label first)
```

---

## Trade-offs

| Decision | Benefit | Cost |
|----------|---------|------|
| Prometheus pull model | Easy failure detection (missing scrape = down) | Prometheus must reach all targets (firewall rules) |
| High sampling rate (100%) | Complete trace data | Enormous storage cost, trace backend overload |
| Low sampling rate (0.1%) | Low cost | Miss rare errors and slow requests |
| Tail-based sampling | Keep all interesting traces | 30-second buffering delay, complex collector setup |
| Structured logging | Machine-parseable, filterable | More verbose, slight CPU overhead for marshaling |
| High-cardinality metrics (labels) | Slice data any way | Prometheus OOM, query timeouts |
| Histogram over Summary | Aggregatable across instances | Must pre-define buckets at instrumentation time |
| SLO-based alerting | Fewer false positives, budget awareness | More complex PromQL, requires SLO definition |

---

## Alternatives

| Need | Open Source | Commercial |
|------|-------------|-----------|
| Metrics collection | Prometheus, Victoria Metrics | Datadog, New Relic, Dynatrace |
| Metrics long-term | Thanos, Cortex | Grafana Cloud, Datadog |
| Log aggregation | ELK/EFK, Grafana Loki | Splunk, Datadog Logs, Papertrail |
| Distributed tracing | Jaeger, Zipkin, Grafana Tempo | Honeycomb, Datadog APM, Lightstep |
| Full observability | Grafana Stack (Prometheus+Loki+Tempo) | Datadog, Honeycomb, New Relic |
| Alerting | Alertmanager | PagerDuty (alert routing), OpsGenie |

---

## Production Considerations

1. **Instrument business outcomes, not just technical metrics.** HTTP 200 status means nothing if the response contains `success: false`. Track: orders_processed_total, payments_succeeded_total, inventory_updated_total — the actual business operations, not the HTTP layer.
2. **Correlate metrics, logs, and traces via common IDs.** Every log line must carry `traceId`. Every metric exemplar should point to a traceId. Every trace span should carry the correlation IDs (orderId, userId). Without correlation, debugging requires manually guessing which log belongs to which trace.
3. **Set log levels correctly in production.** DEBUG and TRACE logs should be off in production (they generate enormous volume and consume CPU for marshaling). INFO should record business events. ERROR should fire alerts. Use dynamic log level adjustment (Spring Boot Actuator, log4j2 JMX) to enable DEBUG temporarily during incidents.
4. **Alert on user impact, not implementation details.** "Pod restarted" is noise. "Error budget burning at 14×" is signal. "DB connection pool exhausted" is useful context but not an alert by itself — is it causing user-facing errors? That's the real signal.
5. **Run regular Game Days (chaos experiments) and verify your observability catches them.** Kill a pod. Inject 500ms latency on a critical DB. Verify: the right alert fires in < 5 minutes. The trace shows the slow span. The log shows the error. If the observability doesn't catch a known failure mode, it won't catch an unknown one either.

---

## Common Beginner Mistakes

1. **Using high-cardinality values as Prometheus labels** (userId, requestId, sessionId). Each unique combination = a separate time series. 1 million users = 1 million time series per metric = Prometheus OOM. Use traces for high-cardinality queries; use pre-aggregated counts in metrics.
2. **Logging sensitive data** (passwords, PII, full credit card numbers, JWT tokens). Structured logs make it easy to accidentally log entire request/response bodies containing sensitive data. Always redact: `user.password = [REDACTED]`. Compliance (PCI, GDPR) requires this.
3. **Setting alert thresholds at 0%** error rate. "Any error = alert" causes constant alert fatigue. Every system has some background error rate. Set thresholds based on SLO burn rate, not zero-tolerance.

---

## Common Senior Engineer Mistakes

1. **Using Prometheus Summary instead of Histogram for service latency.** Summaries cannot be aggregated across instances. If you have 10 pods each computing their own p99, you cannot combine them into a fleet-wide p99. Use histograms. The only valid use of Summary is when you have a single instance and need very accurate quantiles.
2. **Neglecting the observability of the observability pipeline itself.** If Prometheus is down, you can't see that it's down. If the log collector is dropping logs, you don't know. Monitor: Prometheus scrape failures, Fluentd/Fluent Bit drop rate, Jaeger ingestion rate, OTel Collector queue depth.
3. **Sampling without considering rare-event bias.** 1% sampling means 1 in 100 errors is recorded. At 100 RPS, you see 1 error trace per 100 errors. For debugging a 0.1% error rate: at 100 RPS = 6 errors/minute, sampled to 0.06 traces/minute. You might wait 17 minutes for a trace of the failing request. Use tail-based sampling to always capture errors.
4. **Alert-only observability** (no dashboards, no log exploration, no tracing). Alerts tell you something is wrong. They don't tell you why. An alert without the ability to drill into traces and logs means every incident requires log-grepping by hand.

---

## Architecture Smells

- **Services with no `/metrics` endpoint** → can't measure their RED/USE signals → blind spots
- **All logs at INFO or DEBUG in production** → noise flood → real errors invisible
- **Traces without context propagation** (missing `traceparent` header) → traces break at service boundaries → orphan spans → unusable
- **Dashboards with only infra metrics (CPU, memory) but no business metrics** → you know the machine is healthy but not that the business is healthy
- **Alerts with no runbook link** → oncall sees alert, doesn't know what to do → slow response
- **Prometheus with unlimited label cardinality** → will OOM under load (user_ids, request_ids as labels)

---

## Principal Engineer Perspective

Observability is a forcing function for good architecture. A system that is hard to observe is usually hard to understand, hard to debug, and hard to operate. The act of designing observability — what metrics matter, what log events are meaningful, what should trigger an alert — forces clarity about what the system is supposed to do and what "healthy" means.

**What Principal Engineers ask when reviewing observability:**

1. **If this service has a bug that causes 5% of orders to fail silently (HTTP 200, wrong answer), how long until we know?** If the answer is "weeks" (because users report it), the observability is insufficient. It should be "minutes" (because business metrics alert on `orders_failed_total`).

2. **If a cascading failure starts at this service, will we see it in time to intervene?** The SLO burn rate alert should fire within 2–5 minutes of a significant degradation. If it takes 30 minutes, the cascade has already spread.

3. **Can a new engineer debug a production incident in this service without help?** The logs must have enough context (traceId, relevant business IDs, error detail). The traces must connect across services. The runbooks must explain what to do when each alert fires.

4. **What is the cost of the observability infrastructure vs the value?** At 50 TB/day of logs at $0.03/GB on S3 = $1,500/day. Is that justified? Set retention policies. Sample traces. Use Loki instead of Elasticsearch. Observability has real cost.

**The observability maturity model:**
```
Level 0: No instrumentation. Debugging = SSH to pod, grep logs.
Level 1: Basic metrics (CPU, memory, error rate). No tracing.
Level 2: RED + USE metrics, structured logs, basic alerting.
Level 3: Distributed tracing, SLO-based alerting, error budget dashboards.
Level 4: Business metrics, exemplars, tail-based sampling, Game Days to validate.
Level 5: High-cardinality event-based observability (Honeycomb model).
         Arbitrary slice/dice of any attribute. Unknown unknowns discoverable.
```

Most production systems are at Level 2. Level 3 is the target for any serious microservices architecture. Level 4 is where Principal Engineers operate.

---

## Architecture Review Questions

1. Can you answer the following in under 5 minutes: "Which specific users experienced errors in the last hour, and what did they have in common?"
2. Does every service expose RED metrics (request rate, error rate, duration histogram)?
3. Does every service expose USE metrics (CPU/memory utilization, connection pool saturation)?
4. Are logs structured (JSON)? Do they include traceId and spanId?
5. Is distributed tracing configured with context propagation across all service boundaries (HTTP, Kafka, gRPC)?
6. Are SLOs defined for every user-facing service? Are burn rate alerts configured?
7. What is the trace sampling rate? Does it ensure error traces are always sampled?
8. Can you go from a metric alert to the specific trace and then to the specific log lines within 60 seconds?
9. Are business outcome metrics tracked (orders processed, payments succeeded) — not just technical metrics?
10. When was the last Game Day where you validated that observability correctly diagnosed a simulated failure?

---

## Visual / Animation Specification

### Animation 1: Metrics → Traces → Logs Drill-Down

**Frame 1:** Grafana dashboard. Line chart: p99 latency for payment-service. Normal (~12ms). Then at T=14:32, spike: 4,200ms. Red threshold line crossed. Alert fires (bell icon flashes).

**Frame 2:** Click on the spike → query traces for that time window. List of traces appears. One trace highlighted in red (has ERROR spans). Click it.

**Frame 3:** Waterfall trace view expands: API GW (2ms) → payment-svc (4,190ms) → DB span (4,180ms, red). DB span label: "SELECT orders WHERE user_id=?". Duration: 4,180ms.

**Frame 4:** Click DB span → right panel shows span tags: `db.statement`, `db.rows_examined: 2,400,000`, `db.index_used: false`. "SEQ SCAN" highlighted.

**Frame 5:** Click "View logs for this trace." Log lines filter to traceId=abc123. One WARN log: "Slow query: 4183ms, no index on user_id column."

**Caption:** "Alert to root cause: 3 minutes. Metrics → Traces → Logs → Fix."

### Animation 2: Error Budget Burn Rate

**Circular gauge (like a fuel tank) labeled "Error Budget — January."**

**Days 1-20:** Budget slowly depletes: 100% → 85%. Calm, green gauge.

**Day 21, 14:32:** Spike. Gauge drops rapidly: 85% → 60% in 5 minutes. Burn rate indicator: "14.4×!" Red flashing. PagerDuty notification pops up.

**Day 21, 14:37:** Incident resolved. Gauge stabilizes at 60%. Burn rate drops to 1×.

**Day 21-31:** Gauge slowly depletes: 60% → 55%. Month ends.

**Caption:** "30 days. 45% budget remaining. Next month: more room to experiment. SLO maintained."

---

## Hands-On Tutorial

### Setting Up a Basic Observability Stack

```bash
# Docker compose: Prometheus + Grafana + sample service

# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'payment-service'
    static_configs:
      - targets: ['payment-service:8080']
    metrics_path: '/actuator/prometheus'  # Spring Boot
```

```java
// Spring Boot: expose RED metrics automatically
// pom.xml:
<dependency>
  <groupId>io.micrometer</groupId>
  <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>

// Micrometer auto-instruments:
// http_server_requests_seconds_count{method, uri, status} (rate → R and E)
// http_server_requests_seconds_sum and _bucket (histogram → D)

// Custom business metric:
@Service
public class PaymentService {
    private final Counter paymentsProcessed;
    private final Counter paymentsFailed;
    
    public PaymentService(MeterRegistry registry) {
        this.paymentsProcessed = Counter.builder("payments.processed.total")
            .description("Total payments successfully processed")
            .register(registry);
        this.paymentsFailed = Counter.builder("payments.failed.total")
            .tag("reason", "db_timeout")
            .description("Total payment failures")
            .register(registry);
    }
}
```

```yaml
# Grafana dashboard JSON snippet for RED dashboard:
# Rate panel:
expr: rate(http_server_requests_seconds_count{job="payment-service"}[5m])

# Error rate panel:
expr: |
  rate(http_server_requests_seconds_count{job="payment-service",status=~"5.."}[5m])
  / rate(http_server_requests_seconds_count{job="payment-service"}[5m])

# p99 Duration panel:
expr: |
  histogram_quantile(0.99,
    rate(http_server_requests_seconds_bucket{job="payment-service"}[5m]))
```

```bash
# OpenTelemetry auto-instrumentation for Java:
java -javaagent:opentelemetry-javaagent.jar \
  -Dotel.service.name=payment-service \
  -Dotel.exporter.otlp.endpoint=http://otel-collector:4317 \
  -Dotel.traces.sampler=parentbased_traceidratio \
  -Dotel.traces.sampler.arg=0.01 \
  -jar payment-service.jar

# This auto-instruments:
# - Spring MVC (HTTP spans)
# - JDBC (DB query spans)  
# - Kafka producer/consumer (message spans)
# - gRPC calls (RPC spans)
# All with context propagation via W3C traceparent headers
```

---

## Failure Injection Lab

### Lab: Validate Observability Catches a Real Failure

1. **Setup:** Deploy payment-service with Prometheus, Grafana, Jaeger, and structured logging.
2. **Baseline:** Record normal RED metrics (p99 ≈ 12ms, error rate ≈ 0%).
3. **Inject:** Add `SLEEP 5` to the DB query used by payment-service (simulate slow DB):
   ```sql
   -- In PostgreSQL: use pg_sleep in a function the service calls
   CREATE OR REPLACE FUNCTION get_user_orders(uid uuid)
   RETURNS TABLE(...) AS $$
   BEGIN
     PERFORM pg_sleep(5);  -- inject 5-second delay
     RETURN QUERY SELECT * FROM orders WHERE user_id = uid;
   END;
   $$ LANGUAGE plpgsql;
   ```
4. **Observe metrics:** p99 latency: 12ms → 5,000ms. Error rate: 0% → 40% (timeout at 3s).
5. **Observe alert:** SLO burn rate alert fires within 2 minutes.
6. **Find trace:** In Jaeger, filter for duration > 1s, status = ERROR. Find the DB span: 5,000ms, tagged with the slow query.
7. **Find logs:** In Loki/Kibana, filter by traceId from the slow trace. Find the WARN/ERROR log with durationMs=5000.
8. **Remove injection:** `DROP FUNCTION get_user_orders`. Verify system recovers. Metrics normalize. Alert resolves.
9. **Assessment:** Did the alert fire within 5 minutes? Did the trace show the slow span? Did the log have enough context? If not: fix the gap.

---

## Exercises

**Conceptual:**
1. Explain the difference between a Counter, Gauge, and Histogram in Prometheus. When would you use each?
2. Why can't Prometheus Summaries be aggregated across multiple instances? What should you use instead?
3. What is the difference between observability and monitoring? Give an example of a failure that monitoring catches and one that only observability enables you to diagnose.
4. What is tail-based sampling? What are its advantages over head-based sampling?
5. Explain the error budget concept. A service has an SLO of 99.9%. It has 1,000 RPS. How many errors per day is it allowed to have?

**Architecture:**
6. You are designing a new microservice. List the specific metrics, log fields, and trace attributes you would instrument. Justify each choice.
7. Your team has 2,000 Prometheus alerts configured. Oncall engineers acknowledge them without reading them (alert fatigue). Design a process to reduce alerts to fewer than 20 meaningful ones.
8. A customer reports that their orders take 10 seconds to process "sometimes." How would you use metrics, logs, and traces to isolate this intermittent issue?

**Quantitative:**
9. A service has an SLO of 99.95% availability, 1,000 RPS, running for 30 days. It experiences a 5-minute outage (100% error rate). What percentage of the monthly error budget was consumed by this one incident?
10. Your Prometheus has 50 metrics × 10 services × 500 unique label combinations = 250,000 time series. At 2 bytes/sample, 1 sample/15 seconds, what is the daily storage consumption? Monthly?

---

## Solutions

### Exercise 5
Monthly error budget = 1 - SLO = 0.001 = 0.1% of requests.
Total monthly requests = 1,000 RPS × 86,400 s/day × 30 days = 2,592,000,000.
Allowed failures = 0.001 × 2,592,000,000 = **2,592,000 failures per month** = **86,400 per day**.

### Exercise 9
Outage: 5 minutes at 100% error rate, 1,000 RPS.
Errors during outage = 1,000 × 300 seconds = **300,000 errors**.
Monthly budget (99.95% SLO) = 0.0005 × 2,592,000,000 = **1,296,000 allowed errors**.
Budget consumed = 300,000 / 1,296,000 = **23.1%** of monthly budget in 5 minutes.
Remaining budget: 76.9% (still well within SLO for the month, but a notable event).

### Exercise 10
Samples per day = 250,000 time series × (86,400s / 15s per sample) = 250,000 × 5,760 = 1,440,000,000 samples/day.
Storage = 1,440,000,000 × 2 bytes = **2.88 GB/day**.
Monthly = 2.88 × 30 = **86.4 GB/month** (easily fits on a single Prometheus node with a 512GB SSD).

---

## Interview Questions

### Beginner
- What are the three pillars of observability?
- What is the difference between a metric and a log?
- What is a distributed trace? What problem does it solve?

### Senior
- Explain the RED method. What metrics does it require for each service?
- What is the difference between a Prometheus Histogram and Summary? When should you use each?
- What is an SLO and an error budget? How does burn rate alerting work?
- What is context propagation in distributed tracing? How does a trace cross service boundaries?

### Staff
- How would you diagnose a production incident where a service's error rate is 0% but users are reporting failed operations?
- Design the observability strategy for a new microservices platform: which metrics, log fields, trace attributes, and alerts would you standardize?
- Explain the difference between monitoring and observability. Give an example of a production failure that monitoring would miss but proper observability would catch.
- What is tail-based sampling? How do you ensure that all error traces are captured while keeping overall trace volume at 1%?

### Principal
- You have joined a company where on-call engineers are burned out from 200 daily alerts. Design a complete alert rationalization strategy — what alerts to keep, what to delete, how to classify severity, and how to set SLO-based burn rate alerts.
- A service exhibits a 0.1% error rate only for enterprise customers in eu-west-1 on Tuesdays between 2-4 AM. Walk through exactly how you would use metrics, logs, and traces to isolate this issue — including what specific queries you would run.
- Design an observability stack for a 500-service microservices platform with 50,000 RPS, 30-day trace retention requirements, and a $50,000/month budget. Compare open-source vs commercial options.

---

## Summary

Observability is the engineering discipline that makes distributed systems understandable and debuggable:

- **Metrics (Prometheus):** Aggregated numeric measurements — cheap, queryable, alertable. Use Counter (rates), Gauge (current values), Histogram (latency distributions). Instrument with RED (Rate/Errors/Duration for services) and USE (Utilization/Saturation/Errors for resources). Avoid high-cardinality labels.

- **Logs (EFK/Loki):** Per-event records — structured JSON with consistent fields including traceId, spanId, service, version. Log levels used correctly (ERROR ≠ every exception). Correlated with traces via traceId.

- **Distributed Tracing (Jaeger/Tempo + OTel):** The journey of one request across all services. Spans carry parentSpanId for causality. Context propagated via W3C traceparent headers. Head-based sampling for cost efficiency, tail-based sampling to always capture errors.

- **Exemplars:** The bridge from metrics to traces — a histogram bucket annotated with a traceId from a specific sample.

- **SLIs/SLOs/Error Budgets:** Quantify service health. Burn rate alerting (multi-window, multi-burn-rate) replaces threshold alerting — fewer false positives, faster detection of sustained burns.

- **The drill-down flow:** Metric alert fires → trace shows which span is slow → log shows what happened → root cause identified. This is the loop that makes incident response minutes rather than hours.

---

## What You Should Now Be Able To Explain

- ✅ What each pillar of observability uniquely provides and why you need all three
- ✅ Why high-cardinality values (user IDs) must not be Prometheus labels
- ✅ Why Histograms must be used (not Summaries) for multi-instance latency percentiles
- ✅ How distributed trace context propagates across service boundaries
- ✅ What an error budget is and why burn rate alerting is superior to threshold alerting
- ✅ How to drill from a metric alert to a trace to a log line in under 5 minutes

---

## What To Learn Next

**Level 1 Checkpoint: Foundations Complete.** You have now completed the 10-chapter foundations of the curriculum. Before proceeding to Level 2 (Service Design & APIs), revisit your weakest chapters and complete any incomplete exercises. Then proceed to **Chapter 11 — API Design Principles**, which begins the study of how distributed systems expose their interfaces to the world.
