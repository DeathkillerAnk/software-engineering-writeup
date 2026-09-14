# Chapter 20 — Distributed Transactions and Idempotency

## Difficulty
Advanced → Expert

## Importance
**Must Know** — Money cannot be invented or destroyed by software bugs. When a payment service charges a customer, it must happen exactly once — not zero times (customer gets the product for free), not twice (customer is double-charged and furious). The unreliability of networks means that "did this operation succeed?" is genuinely unknowable in the presence of timeouts and network partitions. Idempotency is the engineering solution: design every operation so that calling it multiple times has the same effect as calling it once. This chapter is where distributed systems correctness meets financial-grade reliability. The same principles apply anywhere state must not be duplicated or lost: inventory deductions, API calls to external systems, database writes with async confirmations.

## Prerequisites
Chapter 8 — Consistency, Consensus (linearizability, exactly-once semantics)
Chapter 12 — SQL Databases (ACID transactions, unique constraints, SELECT FOR UPDATE)
Chapter 18 — Saga, CQRS, Event Sourcing (Outbox pattern, at-least-once delivery)
Chapter 6 — Message Queues (Kafka exactly-once semantics)

## Learning Objectives

By the end of this chapter you will be able to:

1. Explain why network unreliability makes "did this operation succeed?" unanswerable and why this necessitates idempotency.
2. Design idempotency keys: structure, storage, expiry, and scope.
3. Implement database-level idempotency using unique constraints and `INSERT ... ON CONFLICT`.
4. Distinguish at-most-once, at-least-once, and exactly-once semantics — and explain the implementation cost of each.
5. Explain the dual-write problem and implement the Outbox pattern as the solution.
6. Design a distributed payment operation that is correct under: network timeout, retry, crash-before-commit, and crash-after-commit.
7. Apply Kafka exactly-once semantics (transactional producers + idempotent consumers).
8. Identify and fix idempotency failures in existing systems.

## Why This Matters

A customer clicks "Pay Now" on a checkout form. The frontend sends an HTTP POST to the payment service. The payment service calls the Stripe API. Stripe charges the card. The Stripe API returns 200. Then: a network hiccup. The payment service never receives the 200. The service times out after 5 seconds. From the payment service's perspective: did the charge happen? Unknown.

The payment service has two options:
1. Assume failure, return error to user. User clicks "Pay Now" again. Stripe is called again. **Double charge.**
2. Assume success, mark order paid. If the charge actually failed: **free order.**

Without idempotency, both outcomes are possible. The correct answer: retry the Stripe call with the same idempotency key. Stripe will recognize it as a duplicate and return the original response — without charging a second time.

This pattern — call with an idempotency key, retry freely, get the same result — is the foundation of financial-grade distributed systems.

---

## Mental Model

> **An idempotent operation is one where f(f(x)) = f(x). Applying it multiple times produces the same result as applying it once. In distributed systems, this property is essential because at-least-once delivery is the only practical guarantee: messages will be delivered, but may be delivered more than once. The engineering challenge is not to eliminate retries (they're necessary for reliability) but to make the operations being retried idempotent. Idempotency is not a database feature you opt into — it is a correctness property you must design explicitly for every operation that has side effects.**

---

## Intuition

Think of idempotency like a light switch vs a doorbell.

**Doorbell (not idempotent):** Pressing it once → one ring. Pressing it three times → three rings. Each press has an additional effect. The effect accumulates.

**Light switch (idempotent):** Flipping it to "on" once → light is on. Flipping it to "on" three more times → light is still on. No additional effect. The state converges to the same result regardless of how many times you apply the same operation.

In distributed systems, you want all state-mutating operations to behave like a light switch: calling them multiple times (due to retries) does not produce multiple effects. Only the first call has an effect; subsequent identical calls are recognized as duplicates and return the same result.

---

## Visual Explanation

### The Network Timeout Problem — Why Idempotency Is Required

```
Scenario: Payment Service calls Stripe to charge $99.99

Attempt 1:
  Client ──POST /charges {amount: 99.99}──▶ Stripe
  Stripe: processes charge, card charged ✅
  Stripe ──200 OK {charge_id: "ch_123"}──▶ [NETWORK FAILURE]
  Client: receives no response. Waits 5 seconds. TIMEOUT.
  
  State:
    Stripe: charge EXISTS (card charged $99.99)
    Client: UNKNOWN (did the charge happen?)

Client's dilemma:
  Option A: Retry the POST without idempotency key
    Stripe receives new POST → creates NEW charge → card charged AGAIN → $199.98 total
    Double charge ❌
    
  Option B: Do not retry, report failure
    Customer: sees "Payment failed"
    Customer: clicks "Pay Now" again → new charge → $199.98 total
    Double charge ❌ (customer-initiated retry)
    
  Option C: Retry with idempotency key
    Original: POST /charges {amount: 99.99} + Idempotency-Key: ik_abc123
    Retry:    POST /charges {amount: 99.99} + Idempotency-Key: ik_abc123 (SAME KEY)
    Stripe: recognizes same key → returns SAME response {charge_id: "ch_123"}
    No second charge. ✅

Idempotency Key flow:
  
  Client generates key: ik_abc123 (UUID, before the call)
         │
         ▼
  POST /charges + Idempotency-Key: ik_abc123
         │
         ▼
  Stripe checks: has ik_abc123 been processed?
    NO  → Process request → Store {ik_abc123 → response} → Return response
    YES → Return stored response (no re-processing)
         │
         ▼
  Response: {charge_id: "ch_123", status: "succeeded"}
  
  Second call with SAME key → same response, no new charge.
  
  Idempotency window: Stripe stores keys for 24 hours.
  After 24 hours: key expires → same key would be treated as new request.
  (But a retry after 24 hours is likely a new business intent, not a network retry)
```

---

## Core Concepts

### 1. The Three Delivery Semantics

```
At-Most-Once (fire and forget):
  Message/request is sent at most one time.
  If it fails: it is NOT retried.
  Effect: 0 or 1 times.
  
  Implementation: send, don't retry, don't acknowledge.
  Use case: UDP packets, analytics events where loss is acceptable.
  Problem: any transient failure → operation not performed.
  
At-Least-Once (retry until acknowledged):
  Message/request is sent and retried until acknowledgment is received.
  Effect: 1 or more times (may be processed multiple times).
  
  Implementation: send + wait for ack + retry on timeout.
  Use case: Kafka default consumer (at-least-once with manual commit).
  Problem: without idempotency → duplicate processing.
  
Exactly-Once (the gold standard):
  Each message/request is processed exactly one time, regardless of retries.
  Effect: always 1 time.
  
  Implementation: at-least-once delivery + idempotent processing.
  Use case: payment processing, inventory deduction, financial ledger.
  Cost: requires coordination state (idempotency key storage) at the receiver.
  
  TRUE exactly-once: implemented at Kafka level using transactional APIs.
  PRACTICAL exactly-once: at-least-once + idempotent handlers (more common, simpler).

The impossible promise:
  "Exactly-once delivery" at the network layer is theoretically impossible
  (Byzantine fault tolerance, network partitions).
  What we actually mean: "exactly-once processing" = at-least-once delivery
  + idempotent receivers that detect and ignore duplicates.
```

### 2. Idempotency Key Design

An idempotency key is a unique identifier provided by the caller that represents a specific business intent. The server uses it to deduplicate duplicate requests.

```
Structure of a good idempotency key:
  - UUID v4 (random, 122 bits of entropy, globally unique)
  - Or: deterministic composite key (for client reconstruction):
    {user_id}:{order_id}:{operation}:{timestamp_day}
    e.g., "u789:ord123:charge:2024-01-20"
    Deterministic: client can reconstruct the key if the original is lost
    But: risk of collision if same key represents different business intents
    → UUID is safer for general use

Generation: client-side (before the request)
  Key MUST be generated before the request is sent.
  If generated server-side: the key is only known AFTER the request arrives.
  But: the timeout happens before the response arrives → key is lost → retry has no key.
  
  Client flow:
    1. Generate UUID: idempotency_key = uuid4()
    2. Store in client-side database: {order_id: "ord123", key: "ik_abc123", status: PENDING}
    3. Send request with key in header: Idempotency-Key: ik_abc123
    4. On success: update client-side record: {status: COMPLETE, charge_id: "ch_123"}
    5. On timeout/failure: retry with SAME key (loaded from client-side DB)
    6. On success of retry: same as step 4

Scope:
  Per-operation: one key per "charge for order X"
  Per-user per-day: one key per user per calendar day (rate limiting use case)
  Per-request: one key per HTTP request (most common)

Expiry:
  Stripe: 24 hours (standard for payment idempotency windows)
  Kafka transactional: indefinite (until consumer group commits)
  Database unique constraint: indefinite (until deleted)
  
  Cleanup: scheduled job deletes processed idempotency keys older than expiry.
  Before cleanup: client retries within the window → recognized as duplicate.
  After cleanup: same key treated as new request (design intent: should not happen
                 for payment operations; clients should not retry after 24 hours).
```

### 3. Database-Level Idempotency

The most robust approach: use the database's uniqueness guarantees to enforce idempotency.

**Pattern 1: Unique constraint on idempotency key**
```sql
-- Payments table: idempotency_key is unique → database prevents duplicate inserts
CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key UUID NOT NULL UNIQUE,  -- enforce uniqueness at DB level
    order_id        TEXT NOT NULL,
    customer_id     TEXT NOT NULL,
    amount_cents    BIGINT NOT NULL,
    currency        CHAR(3) NOT NULL,
    status          TEXT NOT NULL,         -- PENDING, SUCCEEDED, FAILED
    stripe_charge_id TEXT,                 -- populated on success
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON payments (order_id);
CREATE INDEX ON payments (customer_id, created_at DESC);
```

```sql
-- Idempotent payment insert:
-- First call (key does not exist):
INSERT INTO payments (idempotency_key, order_id, customer_id, amount_cents, currency, status)
VALUES ('ik_abc123', 'ord-789', 'cust-456', 9999, 'USD', 'PENDING')
ON CONFLICT (idempotency_key) DO NOTHING
RETURNING id, status, stripe_charge_id;
-- Returns: new row with status=PENDING (first call)

-- Duplicate call (same key):
INSERT INTO payments (idempotency_key, order_id, customer_id, amount_cents, currency, status)
VALUES ('ik_abc123', 'ord-789', 'cust-456', 9999, 'USD', 'PENDING')
ON CONFLICT (idempotency_key) DO NOTHING
RETURNING id, status, stripe_charge_id;
-- Returns: empty (no new row, DO NOTHING) → caller must also SELECT to get existing

-- Better: ON CONFLICT DO UPDATE to return the existing row:
INSERT INTO payments (idempotency_key, order_id, customer_id, amount_cents, currency, status)
VALUES ('ik_abc123', 'ord-789', 'cust-456', 9999, 'USD', 'PENDING')
ON CONFLICT (idempotency_key) DO UPDATE
    SET updated_at = payments.updated_at  -- no-op update, just to get RETURNING
RETURNING id, status, stripe_charge_id;
-- Returns: existing row regardless (first call or retry)
```

**Pattern 2: Idempotency table (separate from domain table)**
```sql
-- Separate idempotency tracking table (decoupled from domain logic):
CREATE TABLE idempotency_records (
    key         TEXT PRIMARY KEY,
    request_hash TEXT NOT NULL,      -- hash of request body (detect parameter mismatch)
    response    JSONB,               -- stored response to return on retry
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stored procedure for idempotent operation:
CREATE OR REPLACE FUNCTION idempotent_charge(
    p_key TEXT,
    p_request JSONB
) RETURNS JSONB AS $$
DECLARE
    v_record idempotency_records%ROWTYPE;
    v_request_hash TEXT;
    v_response JSONB;
BEGIN
    v_request_hash := encode(digest(p_request::TEXT, 'sha256'), 'hex');
    
    -- Try to acquire the idempotency slot:
    INSERT INTO idempotency_records (key, request_hash, expires_at)
    VALUES (p_key, v_request_hash, NOW() + INTERVAL '24 hours')
    ON CONFLICT (key) DO NOTHING;
    
    -- Load existing record:
    SELECT * INTO v_record FROM idempotency_records WHERE key = p_key;
    
    -- Detect parameter mismatch (different request with same key):
    IF v_record.request_hash != v_request_hash THEN
        RAISE EXCEPTION 'Idempotency key reuse with different parameters'
            USING ERRCODE = 'unique_violation';
    END IF;
    
    -- Return cached response if already processed:
    IF v_record.response IS NOT NULL THEN
        RETURN v_record.response;  -- return stored response immediately
    END IF;
    
    -- First call: process the operation (done outside this function)
    -- Caller processes the operation, then calls:
    -- UPDATE idempotency_records SET response = '{...}' WHERE key = p_key;
    
    RETURN NULL;  -- signals "first call, process the operation"
END;
$$ LANGUAGE plpgsql;
```

**Pattern 3: Natural idempotency keys (domain-level)**
```sql
-- Some operations have natural uniqueness built into the domain:

-- Inventory reservation: one reservation per (order_id, product_id)
CREATE TABLE inventory_reservations (
    order_id    TEXT NOT NULL,
    product_id  TEXT NOT NULL,
    quantity    INT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'RESERVED',
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (order_id, product_id)  -- natural composite key
);

-- Reserve inventory (idempotent via natural key):
INSERT INTO inventory_reservations (order_id, product_id, quantity)
VALUES ('ord-789', 'prod-123', 1)
ON CONFLICT (order_id, product_id) DO NOTHING;
-- Duplicate: does nothing. Inventory not double-reserved.

-- Wallet credit (idempotent via transaction_id):
CREATE TABLE wallet_transactions (
    transaction_id TEXT PRIMARY KEY,   -- external idempotency key
    wallet_id      TEXT NOT NULL,
    amount_cents   BIGINT NOT NULL,    -- positive = credit, negative = debit
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO wallet_transactions (transaction_id, wallet_id, amount_cents)
VALUES ('refund_ord789', 'wallet_456', 9999)  -- $99.99 credit
ON CONFLICT (transaction_id) DO NOTHING;
-- Duplicate refund request: rejected by unique constraint. Wallet credited once only.
```

### 4. The Dual-Write Problem — Database and Message Bus

The dual-write problem: how do you atomically update a database AND publish a message/event? (You already saw the Outbox Pattern solution in Chapter 18. Here we go deeper into why it's not optional.)

```
The Problem (concretely):

// Payment service: processes a payment and emits an event
@Transactional
public void processPayment(Payment payment) {
    // Write 1: update database
    paymentRepository.save(payment.withStatus(SUCCEEDED));
    
    // Write 2: publish event
    kafkaTemplate.send("payments.completed", new PaymentCompletedEvent(payment));
    
    // Transaction commits here
}

Failure mode 1: DB write succeeds, Kafka publish fails
    payment.status = SUCCEEDED in DB ✅
    PaymentCompletedEvent: NEVER published ❌
    → Order service never fulfills the order
    → Payment taken but product not delivered
    
Failure mode 2: Kafka publish succeeds, DB commit fails (JVM crash between write 2 and commit)
    PaymentCompletedEvent: published to Kafka ✅
    payment.status: PENDING (rolled back) ❌
    → Order service fulfills order (receives event)
    → Payment record shows PENDING
    → Accounting: payment "missing"
    → Reconciliation nightmare

Failure mode 3: Both succeed, but crash before @Transactional commits
    Result: same as Failure mode 2 (Kafka is not part of the DB transaction)

The Outbox Pattern (correct solution — from Chapter 18, now with full correctness proof):

@Transactional  // ONE transaction
public void processPayment(Payment payment) {
    // Write 1: domain state
    paymentRepository.save(payment.withStatus(SUCCEEDED));
    
    // Write 2: outbox event (SAME TRANSACTION as Write 1)
    outboxRepository.save(OutboxEvent.builder()
        .aggregateId(payment.getId())
        .eventType("PaymentCompleted")
        .payload(serialize(new PaymentCompletedEvent(payment)))
        .build());
    
    // If transaction commits: BOTH payment record AND outbox event are durable.
    // If transaction rolls back: NEITHER is stored. Atomically consistent.
}

// Separate relay publishes from outbox to Kafka (after transaction commits):
@Scheduled(fixedDelay = 100)
public void relay() {
    outboxRepository.findUnpublished()
        .forEach(event -> {
            kafkaTemplate.send(topic(event), event.getPayload());
            outboxRepository.markPublished(event.getId());
        });
}
// If relay crashes between send and markPublished: event re-sent on restart (at-least-once)
// Consumer: must be idempotent (handles duplicate events)
```

**The atomic transaction + event guarantee:**
```
Invariant: the domain state and the outbox event are always consistent.

If payment.status = SUCCEEDED exists in DB:
    → OutboxEvent for PaymentCompleted also exists in outbox table (same transaction)
    → Relay WILL eventually publish it (retry loop)
    → Order service WILL eventually receive it

If payment.status = SUCCEEDED does NOT exist in DB:
    → No OutboxEvent exists (transaction rolled back atomically)
    → No spurious event published

This is the strongest correctness guarantee achievable without distributed 2PC.
The gap: outbox event published → order service processes it.
         Order service is idempotent (handles duplicate PaymentCompleted events).
```

### 5. The Payment Operation — End-to-End Idempotency

A complete payment operation that is correct under every failure mode:

```java
@Service
public class PaymentService {
    
    @Transactional
    public PaymentResult chargeCustomer(ChargeRequest request) {
        String idempotencyKey = request.getIdempotencyKey();
        
        // Step 1: Check for existing record (idempotency check)
        Optional<Payment> existing = paymentRepository.findByIdempotencyKey(idempotencyKey);
        if (existing.isPresent()) {
            Payment payment = existing.get();
            
            // Return cached result for completed operations:
            if (payment.getStatus() == PaymentStatus.SUCCEEDED) {
                log.info("Duplicate payment request, returning existing result. key={}", idempotencyKey);
                return PaymentResult.success(payment);
            }
            if (payment.getStatus() == PaymentStatus.FAILED) {
                log.info("Duplicate payment request for previously failed payment. key={}", idempotencyKey);
                return PaymentResult.failure(payment.getFailureReason());
            }
            // Status = PENDING: payment is in-flight (may be processing on another thread)
            // Return: "payment is processing" — caller should poll
            return PaymentResult.pending(payment.getId());
        }
        
        // Step 2: Create payment record in PENDING state (within transaction)
        Payment payment = paymentRepository.save(Payment.builder()
            .id(UUID.randomUUID())
            .idempotencyKey(idempotencyKey)
            .orderId(request.getOrderId())
            .customerId(request.getCustomerId())
            .amountCents(request.getAmountCents())
            .currency(request.getCurrency())
            .status(PaymentStatus.PENDING)
            .build());
        
        // Step 3: Call Stripe with the SAME idempotency key
        // (Stripe also deduplicates on its side using this key)
        StripeChargeResult stripeResult;
        try {
            stripeResult = stripeClient.charge(StripeChargeRequest.builder()
                .amount(request.getAmountCents())
                .currency(request.getCurrency())
                .customerId(request.getStripeCustomerId())
                .idempotencyKey(idempotencyKey)  // pass-through to Stripe
                .build());
        } catch (StripeTimeoutException e) {
            // Timeout: unknown if charge happened.
            // Leave payment in PENDING state.
            // Caller should retry with same idempotency key.
            // On retry: Stripe will recognize key → return same result.
            log.warn("Stripe timeout for idempotency_key={}. Leaving in PENDING.", idempotencyKey);
            throw new PaymentTimeoutException("Stripe timeout. Retry with same idempotency key.", e);
        } catch (StripeDeclinedException e) {
            // Definitive failure: card declined.
            payment.setStatus(PaymentStatus.FAILED);
            payment.setFailureReason(e.getDeclineCode());
            paymentRepository.save(payment);
            outboxRepository.save(OutboxEvent.of("PaymentFailed", payment));
            return PaymentResult.failure(e.getDeclineCode());
        }
        
        // Step 4: Mark payment as SUCCEEDED and publish event (atomic via transaction)
        payment.setStatus(PaymentStatus.SUCCEEDED);
        payment.setStripeChargeId(stripeResult.getChargeId());
        paymentRepository.save(payment);
        outboxRepository.save(OutboxEvent.of("PaymentCompleted", payment));
        
        return PaymentResult.success(payment);
        
        // Transaction commits: both payment record (SUCCEEDED) and outbox event are durable.
    }
}
```

**State machine for the PENDING payment:**
```
PENDING: payment record exists in DB. Stripe call in-flight or timed out.

Client retry with same key:
  → Service: finds existing PENDING record
  → Retries Stripe call with same idempotency key
  → Stripe: was the original call processed?
    YES → Stripe returns same response → service updates to SUCCEEDED
    NO  → Stripe processes new call → same flow as first attempt

What if payment stays PENDING forever? (Stripe unreachable for hours)
  Background job: checks PENDING payments older than 15 minutes
  → Queries Stripe: "what is the status of charge with idempotency key X?"
  → If Stripe says SUCCEEDED: update DB, publish PaymentCompleted
  → If Stripe says NOT FOUND: charge never processed → retry or fail

This is the reconciliation loop: ensures no payment stays in PENDING indefinitely.
```

### 6. Kafka Exactly-Once Semantics

Kafka provides two mechanisms for exactly-once behavior:

**Idempotent Producer (deduplication on produce side):**
```java
// Enable idempotent producer:
Properties props = new Properties();
props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
// This sets automatically:
//   acks=all (wait for all ISR replicas)
//   max.in.flight.requests.per.connection=5 (limit in-flight to detect ordering issues)
//   retries=MAX_INT (retry indefinitely)

// Producer ID + sequence number per partition:
// Kafka broker: tracks {producer_id, partition} → {max_sequence_number}
// If message arrives with sequence ≤ max: duplicate → ignore
// If message arrives with sequence = max+1: new message → accept
// If message arrives with sequence > max+2: gap → request retransmission

// Guarantee: each message appears exactly once in each partition's log.
// Scope: producer → broker (NOT consumer → processing idempotency)
```

**Transactional Producer (atomic multi-partition writes):**
```java
// Transactional producer: atomically write to multiple partitions
Properties props = new Properties();
props.put(ProducerConfig.TRANSACTIONAL_ID_CONFIG, "payment-service-txn-1");
props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);  // required

KafkaProducer<String, String> producer = new KafkaProducer<>(props);
producer.initTransactions();

try {
    producer.beginTransaction();
    
    // Atomically send to multiple topics:
    producer.send(new ProducerRecord<>("payments.completed", orderId, paymentJson));
    producer.send(new ProducerRecord<>("order.events", orderId, orderUpdateJson));
    producer.send(new ProducerRecord<>("notifications.queue", userId, notificationJson));
    
    // Commit offsets + publish atomically (for read-process-write patterns):
    // This moves the consumer offset AND publishes the result atomically:
    producer.sendOffsetsToTransaction(
        Map.of(new TopicPartition("orders.incoming", 0),
               new OffsetAndMetadata(currentOffset + 1)),
        consumerGroupId
    );
    
    producer.commitTransaction();
    // All messages visible to consumers simultaneously — or none (on abort)
    
} catch (Exception e) {
    producer.abortTransaction();
    // All messages in this transaction are rolled back
    // Consumer: won't see any of the messages
    throw e;
}
```

**Exactly-once read-process-write pattern (Kafka Streams):**
```java
// Kafka Streams: read → process → write, exactly-once
Properties props = new Properties();
props.put(StreamsConfig.PROCESSING_GUARANTEE_CONFIG, StreamsConfig.EXACTLY_ONCE_V2);
// EXACTLY_ONCE_V2: uses EOS (Exactly Once Semantics) with improved performance
// Internally: uses transactional producer + idempotent consumer groups

// Processing pipeline:
StreamsBuilder builder = new StreamsBuilder();
builder.stream("orders.incoming")
    .mapValues(order -> enrichWithPaymentInfo(order))  // stateful enrichment
    .filter((key, order) -> order.isReadyToFulfill())
    .to("orders.ready");

// Guarantee: each input message from "orders.incoming" produces exactly one output
// in "orders.ready" — regardless of crashes, restarts, or rebalances.
// If the process crashes mid-commit: on restart, the offset is rolled back
// → message reprocessed → output transaction re-committed → same output appears once.
```

**Exactly-once at the consumer (application-level idempotency):**
```java
// Most common pattern: at-least-once Kafka + idempotent consumer
@KafkaListener(topics = "payments.completed")
@Transactional  // DB transaction wraps the entire handler
public void handlePaymentCompleted(ConsumerRecord<String, String> record) {
    PaymentCompletedEvent event = deserialize(record.value());
    
    // Idempotency check FIRST:
    String eventId = record.headers().lastHeader("event_id").value().toString();
    
    if (processedEventRepository.existsById(eventId)) {
        log.info("Duplicate event {}, skipping", eventId);
        return;  // idempotent: already processed
    }
    
    // Process (in the same DB transaction):
    orderService.markPaid(event.getOrderId());
    inventoryService.deductStock(event.getOrderId());
    
    // Record as processed (in the same DB transaction):
    processedEventRepository.save(new ProcessedEvent(eventId, Instant.now()));
    
    // Kafka offset committed AFTER DB transaction commits (Spring Kafka):
    // If DB commit fails: offset not committed → Kafka redelivers → idempotency check catches it
    // If DB commit succeeds: offset committed → no redelivery needed
}

// processed_events table:
// CREATE TABLE processed_events (
//     event_id TEXT PRIMARY KEY,
//     processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );
// TTL cleanup: DELETE FROM processed_events WHERE processed_at < NOW() - INTERVAL '7 days';
// (Safe: Kafka retention is 7 days → no events older than 7 days will be redelivered)
```

### 7. Idempotency Across Service Boundaries — HTTP API Design

For REST APIs, idempotency is expressed through HTTP method semantics and the `Idempotency-Key` header:

```
HTTP method idempotency:
  GET:    idempotent (no side effects)
  HEAD:   idempotent
  PUT:    idempotent (replace resource — same PUT = same state)
  DELETE: idempotent (delete already-deleted resource → 404, not error)
  POST:   NOT idempotent by default → requires Idempotency-Key header
  PATCH:  NOT idempotent by default (partial update — depends on operation)

Idempotency-Key header (IETF draft-ietf-httpapi-idempotency-key-header):
  POST /payments HTTP/1.1
  Idempotency-Key: ik_abc123def456
  Content-Type: application/json
  
  {"amount": 9999, "currency": "USD", "orderId": "ord-789"}

Server behavior:
  First request (key not seen):
    Process request → store result under key → return 201 Created
  
  Subsequent requests (same key, same parameters):
    Return stored response → 201 Created (same response body)
    Do NOT reprocess
  
  Subsequent requests (same key, DIFFERENT parameters):
    Return 422 Unprocessable Entity:
    {"error": "idempotency_key_reuse",
     "message": "Idempotency key already used with different parameters"}
    NEVER reprocess with new parameters — this could be a client bug or attack

Response headers:
  Idempotent-Replayed: true   (signals to client: this is a replayed response)
```

**Implementation — Spring Boot idempotency filter:**
```java
@Component
@Order(1)  // apply before other filters
public class IdempotencyFilter implements Filter {
    
    @Autowired private IdempotencyStore store;  // Redis-backed
    
    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        
        HttpServletRequest httpReq = (HttpServletRequest) req;
        HttpServletResponse httpRes = (HttpServletResponse) res;
        
        String key = httpReq.getHeader("Idempotency-Key");
        
        // Only for non-idempotent methods:
        if (key == null || isIdempotentMethod(httpReq.getMethod())) {
            chain.doFilter(req, res);
            return;
        }
        
        // Hash request body to detect parameter changes:
        byte[] body = httpReq.getInputStream().readAllBytes();
        String requestHash = sha256(body);
        
        // Check for existing response:
        IdempotencyRecord record = store.get(key);
        if (record != null) {
            if (!record.getRequestHash().equals(requestHash)) {
                httpRes.setStatus(422);
                httpRes.getWriter().write("""
                    {"error": "idempotency_key_reuse",
                     "message": "Same key used with different parameters"}
                    """);
                return;
            }
            
            // Replay stored response:
            httpRes.setStatus(record.getStatus());
            httpRes.setHeader("Idempotent-Replayed", "true");
            httpRes.setHeader("Content-Type", "application/json");
            httpRes.getWriter().write(record.getResponseBody());
            return;
        }
        
        // First request: capture response:
        CachingResponseWrapper wrappedRes = new CachingResponseWrapper(httpRes);
        store.markInFlight(key, requestHash);  // claim the key (prevent concurrent duplicates)
        
        try {
            chain.doFilter(new ReusableInputStream(body, httpReq), wrappedRes);
            
            // Store response:
            store.save(key, IdempotencyRecord.builder()
                .requestHash(requestHash)
                .status(wrappedRes.getStatus())
                .responseBody(wrappedRes.getCapturedBody())
                .expiresAt(Instant.now().plus(Duration.ofHours(24)))
                .build());
        } catch (Exception e) {
            store.clearInFlight(key);  // allow retry on processing error
            throw e;
        }
    }
}
```

### 8. SELECT FOR UPDATE — Preventing Lost Updates

In concurrent systems, two requests reading the same row and both updating it can cause lost updates. `SELECT FOR UPDATE` is the database mechanism to prevent this.

```sql
-- Scenario: two concurrent wallet debit operations
-- Wallet balance: $100
-- Thread A: debit $60
-- Thread B: debit $70
-- Without SELECT FOR UPDATE:
--   Thread A: SELECT balance FROM wallets WHERE id = 'w123'  → 100
--   Thread B: SELECT balance FROM wallets WHERE id = 'w123'  → 100
--   Thread A: UPDATE wallets SET balance = 100 - 60 WHERE id = 'w123'  → 40 ✅
--   Thread B: UPDATE wallets SET balance = 100 - 70 WHERE id = 'w123'  → 30 ❌
--   Result: balance = 30 (should be -30, which should be rejected as insufficient funds!)
--   Both debits succeeded on a $100 balance = $130 debited from $100. FRAUD.

-- With SELECT FOR UPDATE (correct):
BEGIN;
SELECT balance, version FROM wallets WHERE id = 'w123' FOR UPDATE;
-- Thread A gets lock. Thread B BLOCKS here until Thread A commits or rolls back.

-- Thread A continues:
-- balance = 100. Debit $60. New balance = 40.
UPDATE wallets SET balance = 40, version = version + 1 WHERE id = 'w123';
COMMIT;
-- Lock released. Thread B unblocks.

-- Thread B reads fresh value:
-- balance = 40. Debit $70. New balance = -30.
-- Application: balance < 0 → INSUFFICIENT FUNDS → ROLLBACK.
ROLLBACK;
```

**Optimistic locking (version-based, no database locks):**
```java
// JPA optimistic locking:
@Entity
public class Wallet {
    @Id Long id;
    Long balanceCents;
    
    @Version Long version;  // JPA manages this field
}

@Transactional
public void debit(Long walletId, Long amountCents) {
    Wallet wallet = walletRepository.findById(walletId)
        .orElseThrow(() -> new WalletNotFoundException(walletId));
    
    if (wallet.getBalanceCents() < amountCents) {
        throw new InsufficientFundsException();
    }
    
    wallet.setBalanceCents(wallet.getBalanceCents() - amountCents);
    walletRepository.save(wallet);
    // JPA generates: UPDATE wallets SET balance = ?, version = version+1
    //                WHERE id = ? AND version = ?  ← optimistic lock check
    // If another transaction modified this row first: version mismatch → OptimisticLockException
}

// On OptimisticLockException: retry the operation (reload fresh state, re-apply)
// Suitable for: low contention (most reads succeed without conflict)
// Not suitable for: high contention (many retries → performance degradation)
// SELECT FOR UPDATE: better for high-contention rows (e.g., hot wallet balances)
```

### 9. The Reconciliation Pattern — Detecting and Fixing Inconsistencies

Even with idempotency, distributed systems can develop inconsistencies. Reconciliation is the background process that detects and corrects them.

```java
@Scheduled(cron = "0 */5 * * * *")  // every 5 minutes
public void reconcilePayments() {
    // Find payments stuck in PENDING state > 15 minutes:
    List<Payment> stuckPayments = paymentRepository
        .findByStatusAndCreatedAtBefore(
            PaymentStatus.PENDING,
            Instant.now().minus(Duration.ofMinutes(15))
        );
    
    for (Payment payment : stuckPayments) {
        try {
            // Query Stripe using the idempotency key:
            StripeCharge stripeCharge = stripeClient.retrieveByIdempotencyKey(
                payment.getIdempotencyKey()
            );
            
            if (stripeCharge != null && stripeCharge.getStatus().equals("succeeded")) {
                // Charge succeeded but we never recorded it:
                payment.setStatus(PaymentStatus.SUCCEEDED);
                payment.setStripeChargeId(stripeCharge.getId());
                paymentRepository.save(payment);
                outboxRepository.save(OutboxEvent.of("PaymentCompleted", payment));
                
                log.info("Reconciled payment {} → SUCCEEDED", payment.getId());
                
            } else if (stripeCharge != null && stripeCharge.getStatus().equals("failed")) {
                payment.setStatus(PaymentStatus.FAILED);
                payment.setFailureReason(stripeCharge.getFailureCode());
                paymentRepository.save(payment);
                outboxRepository.save(OutboxEvent.of("PaymentFailed", payment));
                
            } else if (stripeCharge == null) {
                // Charge was never created by Stripe (request never reached Stripe):
                // Safe to retry:
                retryPaymentCharge(payment);
            }
            
        } catch (Exception e) {
            log.error("Failed to reconcile payment {}", payment.getId(), e);
            // Continue with other payments — don't let one failure stop reconciliation
        }
    }
}

// Invariant maintained by reconciliation:
// No payment stays in PENDING state indefinitely.
// PENDING payments are resolved (SUCCEEDED or FAILED) within 20 minutes.
// This is the "eventually consistent" guarantee for payment operations.
```

---

## Step-by-Step Execution

### Diagnosing an Idempotency Failure in Production

```
Symptom: customers report double charges. Finance team sees duplicate entries in Stripe.

Step 1: Query for duplicate charge patterns:
  SELECT idempotency_key, COUNT(*), MIN(created_at), MAX(created_at)
  FROM payments
  GROUP BY idempotency_key
  HAVING COUNT(*) > 1;
  -- If results exist: idempotency key uniqueness constraint is missing or bypassed

Step 2: Check if idempotency key is enforced at DB level:
  SELECT constraint_name, constraint_type
  FROM information_schema.table_constraints
  WHERE table_name = 'payments' AND constraint_type = 'UNIQUE';
  -- Missing UNIQUE constraint on idempotency_key → root cause

Step 3: Check if idempotency check happens BEFORE DB write:
  Review code: is there a findByIdempotencyKey() call before save()?
  If not: two concurrent requests can both pass the check, both proceed to Stripe, both charge.
  
  Race condition:
    Thread A: findByIdempotencyKey("ik_abc") → null (not found)
    Thread B: findByIdempotencyKey("ik_abc") → null (not found)
    Thread A: calls Stripe, charges card, saves payment
    Thread B: calls Stripe, charges card (DIFFERENT call, no key!), saves payment
    → UNIQUE violation if constraint exists → one thread fails
    → No constraint: both charges succeed → double charge

Step 4: Check if idempotency key is passed to Stripe:
  grep -r "stripeClient.charge" src/
  Look for: idempotencyKey parameter passed to Stripe
  If missing: Stripe sees two different requests (no key) → two charges
  
Step 5: Fix:
  1. Add UNIQUE constraint (immediate):
     ALTER TABLE payments ADD CONSTRAINT uk_idempotency_key UNIQUE (idempotency_key);
  
  2. Add DB-level check before Stripe call:
     Payment existing = paymentRepository.findByIdempotencyKey(key);
     if (existing != null) return PaymentResult.from(existing);
  
  3. Pass idempotency key to Stripe:
     StripeChargeRequest.builder().idempotencyKey(key)...
  
  4. Handle duplicate constraint violation (concurrent requests):
     try { paymentRepository.save(payment); }
     catch (DataIntegrityViolationException e) {
         // Another thread beat us to it:
         return PaymentResult.from(paymentRepository.findByIdempotencyKey(key));
     }
  
Step 6: Reconcile existing duplicates:
  For each duplicate pair: determine which charge is canonical.
  Issue Stripe refund for the duplicate charge.
  Compensate affected customers (proactive communication + credit).
  Post-mortem: document the gap and the fix.
```

---

## Deep Dive

### Stripe's Idempotency Implementation

Stripe's idempotency implementation is one of the most well-documented in the industry. Key design decisions:

**Storage:** Idempotency keys stored in a distributed database (likely Vitess/MySQL at their scale). Keys are partitioned by the key value itself for hot-spot prevention.

**24-hour window:** Keys expire after 24 hours. The rationale: a client retry happening 24 hours after the original is almost certainly a new business intent, not a network retry. Additionally, keeping keys indefinitely is prohibitively expensive.

**Request body fingerprint:** Stripe hashes the request body along with the key. If you send the same key with different parameters (e.g., different `amount`), Stripe returns 400 with error code `idempotency_key_reuse_with_different_params`. This protects against accidental key reuse.

**In-flight locking:** While a request is being processed for a given idempotency key, subsequent requests with the same key return 409 Conflict ("key is in use"). This prevents concurrent processing of the same key.

**Exactly-once charge guarantee:** Even if Stripe's backend processes a charge and then crashes before writing the response, the idempotency key is checked before processing. The charge state is stored in a transaction-safe way before the external response is generated.

```
Stripe server-side idempotency flow:
  1. Receive request with Idempotency-Key: ik_abc
  2. Acquire distributed lock on ik_abc
  3. Check: does ik_abc exist in idempotency store?
     YES: return stored response (unlock)
     NO:  proceed to step 4
  4. Process request (create charge in Stripe's DB)
  5. Store result in idempotency store atomically with processing
  6. Release lock
  7. Return response
  
  If crash at step 4: idempotency key not stored → retry processes fresh
  If crash at step 5: depends on whether step 4 and 5 are atomic
  → Stripe uses internal transactions to make steps 4+5 atomic
```

### Exactly-Once in Financial Ledgers

Double-entry bookkeeping (the foundation of accounting since 1494) is inherently idempotent:

```sql
-- Double-entry ledger: every transaction has two entries (debit + credit)
-- The pair shares a transaction_id → natural idempotency

CREATE TABLE ledger_entries (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL,        -- shared by debit and credit entry
    account_id     TEXT NOT NULL,
    entry_type     TEXT NOT NULL CHECK (entry_type IN ('DEBIT', 'CREDIT')),
    amount_cents   BIGINT NOT NULL CHECK (amount_cents > 0),
    currency       CHAR(3) NOT NULL,
    description    TEXT,
    recorded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (transaction_id, account_id, entry_type)  -- prevents duplicate entries
);

-- Record a payment charge ($99.99 from customer wallet to revenue account):
BEGIN;
-- Debit: reduce customer wallet balance
INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount_cents, currency)
VALUES ('txn_abc123', 'wallet_customer_456', 'DEBIT', 9999, 'USD')
ON CONFLICT (transaction_id, account_id, entry_type) DO NOTHING;

-- Credit: increase revenue account
INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount_cents, currency)
VALUES ('txn_abc123', 'account_revenue', 'CREDIT', 9999, 'USD')
ON CONFLICT (transaction_id, account_id, entry_type) DO NOTHING;
COMMIT;

-- Duplicate attempt with same transaction_id:
-- Both INSERTs hit ON CONFLICT → DO NOTHING
-- Ledger unchanged → exactly-once semantics via natural idempotency

-- Verify balance (sum of credits - sum of debits per account):
SELECT account_id,
       SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_cents ELSE -amount_cents END) AS balance_cents
FROM ledger_entries
WHERE account_id IN ('wallet_customer_456', 'account_revenue')
GROUP BY account_id;
-- This query is itself idempotent (no state mutation)
```

---

## Real-World Example

### Uber's Payment System — Idempotency at Scale

Uber processes millions of payments per day. Their payment system is designed around explicit idempotency at every layer.

**Trip payment idempotency:**
- Idempotency key: `{trip_id}:{payment_method_id}:{amount}` (deterministic, not UUID)
- Rationale: if the mobile app loses connectivity mid-charge, it can reconstruct the exact same key from trip context and retry safely
- The deterministic key means: no client-side state needed to store the key (it can be derived from known fields)

**Multi-party split payments (Uber for Business):**
- One trip charge may split across: rider's personal card + company credit
- Each split has its own idempotency key: `{trip_id}:personal` and `{trip_id}:business`
- Both must succeed or both must be rolled back → implemented as a Saga with compensation

**Reconciliation at Uber's scale:**
- "No payment should stay unresolved for > 30 minutes"
- Automated reconciliation job runs every 5 minutes
- Queries Stripe/Braintree for all payments in PENDING state > 10 minutes
- Resolves or escalates to the payments operations team
- SLA: 99.99% of payments resolved within 30 minutes automatically

---

## Failure Scenarios

### Scenario 1: Idempotency Key Not Passed to External API

```
Payment service: calls Braintree (payment processor) without idempotency key.
User clicks "Pay" on checkout page.
POST /payments → payment service → POST to Braintree /transactions {amount: 150.00}
Braintree: charges card. Returns 200. {transaction_id: "bt_xyz789"}

Network issue: payment service connection to internal DB times out.
Payment service: cannot save payment record. Returns 500 to user.

User: sees error. Clicks "Pay" again.
Frontend: sends new POST /payments (new request, no idempotency key on the second request either).
Payment service: calls Braintree again → NEW transaction → card charged AGAIN.

Result: $300 charged for a $150 order. Double charge. Customer calls support.

Root cause:
  1. No idempotency key sent to Braintree
     → Braintree sees two different requests → two charges
  2. No client-side idempotency key stored
     → Frontend retried with no key
  3. No unique constraint on payment record
     → No DB-level protection

Fix:
  1. Generate idempotency key CLIENT-SIDE before clicking Pay
     Store in localStorage: {orderId: "ord-789", idemKey: "ik_abc123", status: "pending"}
  2. Pass key to backend on every attempt (same key on retry)
  3. Backend passes key to Braintree:
     POST /transactions {amount: 150.00, idempotency_key: "ik_abc123"}
  4. On retry: Braintree sees same key → returns original response → one charge
  5. Backend: ON CONFLICT (idempotency_key) → return existing record → no double save

Reconciliation fallback:
  Even with the fix: reconcile Braintree transactions daily against payments DB.
  Any Braintree charge without a matching payment record → investigate.
  Automated: compare Braintree webhook events to payments table.
```

### Scenario 2: Inventory Double-Deduction from Duplicate Saga Events

```
Order Saga: step 2 sends ReserveInventory command to InventoryService.
Kafka: delivers the message.
InventoryService: processes it, deducts stock, publishes InventoryReserved.
InventoryService: crashes before committing the Kafka consumer offset.

On restart: InventoryService consumer resumes from last committed offset.
  → Re-reads the same ReserveInventory message.
  → Processes it again → deducts stock AGAIN.
  
  Stock: MacBook Pro, initial=50. After first deduction: 49. After second: 48.
  But only one order was placed. Inventory count is wrong.
  Under-counted by 1 unit → one lost sale when inventory reaches "0" prematurely.

Root cause:
  Kafka consumer: at-least-once delivery.
  InventoryService handler: NOT idempotent.
  
  Handler code:
    // NOT idempotent:
    inventory.quantity -= reservation.quantity;
    inventoryRepository.save(inventory);
    // Duplicate call: deducts again. No check for prior processing.

Fix:
  Make handler idempotent with natural key check:
    // Check if reservation already exists for this orderId:
    if (reservationRepository.existsByOrderId(event.getOrderId())) {
        log.info("Duplicate ReserveInventory for orderId={}, skipping", event.getOrderId());
        return;
    }
    
    // Atomic: deduct and create reservation in one transaction:
    inventoryRepository.decrementQuantity(productId, quantity);
    reservationRepository.save(new Reservation(event.getOrderId(), productId, quantity));
    
  The reservationRepository.existsByOrderId() check prevents double-deduction.
  
  Or: use INSERT ON CONFLICT DO NOTHING + unique constraint on (order_id, product_id)
  → DB-enforced idempotency, no application-level check needed.
```

---

## Performance Considerations

### Idempotency Key Lookup Performance

```
Every non-idempotent request requires a lookup before processing.
Lookup cost must be < 10% of total request processing time.

Redis-based idempotency store (recommended for high-throughput):
  Lookup: GET ik_abc123 → 0.3-1ms (Redis LAN)
  Write: SET ik_abc123 {response} EX 86400 → 0.3-1ms
  Total overhead: 0.6-2ms
  
  At 10,000 RPS: 10,000 Redis ops/second → well within Redis single-node capacity (100K+ ops/s)

PostgreSQL-based idempotency store:
  Lookup: SELECT by idempotency_key (indexed) → 1-5ms
  Write: INSERT with UNIQUE constraint → 2-10ms
  Total overhead: 3-15ms
  
  At 1,000 RPS: manageable. At 10,000 RPS: may be PostgreSQL bottleneck.
  Use: write-through cache (Redis check first, PostgreSQL as durable fallback)

Idempotency record size:
  Key: 36 bytes (UUID string) or ~50 bytes (composite key)
  Response body: 500 bytes - 5 KB (typical API response)
  Metadata: ~100 bytes
  Total per key: ~1-6 KB
  
  At 1M unique operations/day with 24h retention:
    1M × 6 KB = 6 GB Redis memory for idempotency store
    (reasonable for dedicated Redis instance)
  
  At 100M operations/day:
    100M × 6 KB = 600 GB → too large for single Redis
    → Redis Cluster: shard by key prefix
    → Or: store only key hash + response code (not full response body): < 1 KB/key

Bloom filter pre-check (for very high-cardinality idempotency):
  Bloom filter: probabilistic data structure, O(1) lookup, no false negatives.
  Check Bloom filter first: if key NOT in filter → definitely new request (no DB lookup needed).
  If key MIGHT be in filter → do DB lookup to confirm.
  
  Saves DB lookups for new requests (the common case).
  Bloom filter false positive rate: 1% (configurable).
  Memory: 10M keys × 10 bits/key = 12.5 MB (highly efficient).
```

---

## Trade-offs

| Approach | Atomicity | Complexity | Performance | Failure Handling |
|---------|-----------|------------|-------------|------------------|
| DB UNIQUE constraint | Strong (DB guarantees) | Low | Excellent | ON CONFLICT handling |
| Separate idempotency table | Strong (same DB) | Medium | Good | Table cleanup needed |
| Redis key (TTL-based) | Weak (Redis not ACID) | Low | Excellent | TTL-based expiry |
| Application-level check | Weak (race conditions) | Low | Excellent | Requires SELECT + INSERT |
| Outbox + Relay | Strong (DB transaction) | Medium | Good | Relay must be idempotent |
| Kafka EOS | Strong (Kafka guarantees) | High | Medium | Complex config |

| Locking Strategy | Throughput | Contention Handling | Use Case |
|-----------------|------------|---------------------|----------|
| SELECT FOR UPDATE | Medium | Blocks concurrent | High-value resources (wallets) |
| Optimistic Locking (@Version) | High | Retries on conflict | Low-contention state |
| Distributed Lock (Redis SETNX) | Medium | Lock timeout risk | Cross-service coordination |
| No locking (append-only) | Highest | No contention (by design) | Event sourcing, ledgers |

---

## Production Considerations

1. **Idempotency keys must be generated before the request is sent, not after.** If the key is generated server-side and returned in the response, and the response is lost in a network timeout — the client has no key to retry with. The key must be generated client-side (UUID v4) and stored durably before the request is made.
2. **Pass idempotency keys through to external APIs.** If your payment service receives an idempotency key from your client and calls Stripe, pass the same key to Stripe (or a deterministic derivative). If you don't, you lose Stripe's idempotency guarantee: your service retries → Stripe creates a new charge.
3. **Treat PENDING payment states as a critical monitoring metric.** PENDING payments that don't resolve within 15 minutes indicate either: a bug in the reconciliation loop, an external API outage, or a stuck saga. Alert on: `COUNT(*) WHERE status='PENDING' AND created_at < NOW() - INTERVAL '15 minutes' > 0`.
4. **Test idempotency explicitly — it won't be naturally tested.** Standard unit tests call each operation once. Write explicit tests: call the same operation twice with the same idempotency key → verify that the second call returns the same result and does NOT create a second payment/reservation/entry. This test should be part of your CI pipeline.
5. **The `processed_events` table for Kafka consumers needs TTL cleanup.** Without cleanup, the table grows forever. Schedule: `DELETE FROM processed_events WHERE processed_at < NOW() - INTERVAL '7 days'`. Safe because Kafka's retention period is 7 days — no event older than 7 days will be redelivered, so the deduplication record is no longer needed.
6. **Idempotency key expiry must be longer than the maximum realistic retry window.** If clients retry for up to 1 hour: key expiry must be > 1 hour. Stripe uses 24 hours. Never set key expiry shorter than your SLA for resolving incidents (you may need to retry operations hours later during incident recovery).

---

## Common Beginner Mistakes

1. **Using the same idempotency key for different operations.** Key reuse across different operations (e.g., key for charge also used for refund) corrupts the idempotency store — the second operation gets the first operation's cached response. Keys must be unique per operation instance.
2. **Checking idempotency in application code without a DB constraint.** Application-level check without DB constraint: two concurrent threads both check simultaneously (read), both see "not exists," both proceed to write. DB unique constraint is the only reliable safeguard against this race.
3. **Not handling `ON CONFLICT` in client code.** If you add a UNIQUE constraint on `idempotency_key`, concurrent duplicate inserts will throw a `DataIntegrityViolationException`. Client code must catch this and return the existing record — not propagate the exception as a 500 error.
4. **Conflating message delivery idempotency with operation idempotency.** Kafka idempotent producer prevents duplicate messages in the log. But Kafka consumers still process each message at least once. Consumer-side operation idempotency (processed_events table, ON CONFLICT) is separate and required even with idempotent producers.

---

## Common Senior Engineer Mistakes

1. **Idempotency key scoped to a request, not a business operation.** A client that makes a fresh request (new UUID) for the same business intent (retrying a failed checkout) has no idempotency protection — they generate a new key because they don't persist the original key. The client must store the key durably (database or localStorage) before making the request.
2. **Reconciliation job that only checks the local database.** A reconciliation job that compares local `PENDING` records against local `SUCCEEDED` records catches inconsistencies between tables in the same DB. It does NOT catch the case where Stripe charged the card but the DB record is lost entirely (crash before commit). Reconciliation must query the external API (Stripe) as the source of truth.
3. **`SELECT FOR UPDATE` on hot rows at high concurrency.** A wallet that processes 10,000 transactions per second: `SELECT FOR UPDATE` on the wallet row means all 10,000 transactions serialize (one at a time). Effective throughput: 1 transaction at a time (limited by lock hold time). Solution: account for high-write throughput by using append-only ledger entries (no locking, just INSERT) and deriving balance from aggregation.
4. **Outbox relay that marks events as published before Kafka acknowledges.** If the relay marks `published_at = NOW()` before confirming Kafka receipt, and Kafka is temporarily unavailable, the event is marked published but never delivered. Use `acks=all` on the Kafka producer and only mark the event as published after receiving acknowledgment.

---

## Architecture Smells

- **POST endpoints without idempotency key support** → duplicate requests from mobile network retries cause double processing
- **Payment service that calls external payment API without passing idempotency key** → timeouts cause double charges
- **PENDING payment states not monitored or alerted on** → stuck payments silently accumulate
- **Processed events table with no TTL cleanup** → table grows unbounded → query performance degrades → idempotency check itself becomes slow
- **Idempotency implemented only at application layer (no DB constraint)** → concurrent duplicate requests bypass the application check
- **Idempotency key generated server-side and returned in response** → lost on network timeout → client cannot retry safely
- **Ledger balance stored as a mutable column (not derived from entries)** → balance can desync from entries on crash-between-updates

---

## Principal Engineer Perspective

Idempotency is a correctness guarantee, not a performance optimization. It is the difference between a system that is correct under failure and one that only works when nothing goes wrong. In production, things always go wrong: network timeouts happen, clients retry, services restart mid-operation. A system without idempotency is a system that is correct only in the lab.

**The three questions to ask about any operation with side effects:**

1. **What happens if this operation is called twice with the same intent?** Can the second call distinguish itself from the first? Does it produce a second effect (double charge, double deduction) or return the result of the first (idempotent)?

2. **What happens if the response is lost after the operation succeeds?** Can the caller safely retry? Is there a way for the retry to get the same result without re-executing the operation? If not — you have a correctness gap.

3. **What is the reconciliation strategy if inconsistency occurs despite idempotency?** Idempotency reduces inconsistencies to near-zero but not zero. The reconciliation loop is the last line of defense: it detects any remaining inconsistencies and corrects them automatically. Every distributed payment operation needs a reconciliation loop.

**The Principal Engineer's idempotency axiom:**
*Any operation that has a side effect must be idempotent, or the system will produce incorrect results under normal network conditions.*

"Normal network conditions" includes: TCP retransmissions, load balancer retries, mobile app retries on reconnect, client-side exponential backoff, Kubernetes pod restarts that cut in-flight connections. These are not edge cases — they happen multiple times per hour in production.

---

## Architecture Review Questions

1. For every POST/PUT/PATCH endpoint: is an `Idempotency-Key` header supported? Are duplicate requests with the same key detected and handled correctly?
2. Are idempotency keys generated client-side and stored durably before the request is sent?
3. Is the idempotency key passed through to external APIs (Stripe, Braintree, Twilio)?
4. Is there a DB UNIQUE constraint on the idempotency_key column (not just an application-level check)?
5. For Kafka consumers: is there a `processed_events` table or equivalent deduplication mechanism?
6. Are payment records in PENDING state monitored and alerted on?
7. Is there a reconciliation job that queries external APIs to resolve stuck PENDING records?
8. Is the `processed_events` table cleaned up on a schedule (matching Kafka retention period)?
9. For high-throughput account balances: is `SELECT FOR UPDATE` avoided in favor of append-only ledger entries?
10. Is idempotency tested explicitly — calling the same operation twice and verifying the second call does not produce a second effect?

---

## Visual / Animation Specification

### Animation 1: Network Timeout — The Three Possible Worlds

**Three side-by-side panels: "Charge Happened," "Charge Did Not Happen," "Unknown (Timeout)."**

**Step 1:** Client sends request. Arrow flies from Client to Stripe. Stripe processes (spinner).

**Step 2:** Three outcomes shown side by side:
- Panel 1: Stripe responds 200. Arrow returns to client. Client: ✅ charge confirmed.
- Panel 2: Stripe error 402. Arrow returns to client. Client: ❌ charge failed.
- Panel 3: Stripe charges card. Response arrow starts flying → hits lightning bolt (network failure) → disappears. Client: waits → TIMEOUT. "State: ???"

**Step 3 (without idempotency key):** Client retries Panel 3. New request arrow. Stripe: NEW charge. TWO charge records in Stripe. Red alert: "DOUBLE CHARGE."

**Step 4 (with idempotency key):** Client retries Panel 3 with same key. Stripe: recognizes key → returns same response → ONE charge. Green: "IDEMPOTENT: one charge."

**Caption:** "The only safe retry strategy: same idempotency key. Stripe deduplicates. One charge guaranteed."

### Animation 2: Database UNIQUE Constraint Race Condition

**Two threads: Thread A and Thread B. Shared database table with idempotency_key column.**

**Without constraint:**
- Thread A: SELECT → "not found" → proceeds to INSERT.
- Thread B: SELECT → "not found" (simultaneously) → proceeds to INSERT.
- Both INSERT → both succeed → two rows with same business intent.
- Red alert: "Duplicate record created."

**With UNIQUE constraint:**
- Thread A: INSERT → succeeds → row created.
- Thread B: INSERT → UNIQUE violation → catches exception → reads existing row → returns existing result.
- One row. Green: "DB-enforced idempotency."

**Caption:** "Application-level check has a race condition. DB UNIQUE constraint is atomic. Always use the constraint."

---

## Hands-On Tutorial

### Implementing End-to-End Idempotent Payment

```sql
-- Schema setup
CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT NOT NULL UNIQUE,
    order_id        TEXT NOT NULL,
    customer_id     TEXT NOT NULL,
    amount_cents    BIGINT NOT NULL,
    currency        CHAR(3) NOT NULL,
    status          TEXT NOT NULL DEFAULT 'PENDING',
    stripe_charge_id TEXT,
    failure_reason  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON payments (order_id);
CREATE INDEX ON payments (status, created_at) WHERE status = 'PENDING';
```

```python
# Flask payment API with full idempotency
import uuid
import hashlib
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from sqlalchemy import create_engine, text

app = Flask(__name__)
engine = create_engine("postgresql://user:pass@localhost/payments_db")

@app.route('/payments', methods=['POST'])
def create_payment():
    idempotency_key = request.headers.get('Idempotency-Key')
    if not idempotency_key:
        return jsonify({"error": "Idempotency-Key header is required"}), 400
    
    data = request.get_json()
    
    with engine.begin() as conn:
        # Idempotent insert:
        result = conn.execute(text("""
            INSERT INTO payments (idempotency_key, order_id, customer_id, amount_cents, currency)
            VALUES (:key, :order_id, :customer_id, :amount, :currency)
            ON CONFLICT (idempotency_key) DO UPDATE
                SET updated_at = payments.updated_at
            RETURNING id, status, stripe_charge_id, failure_reason, created_at
        """), {
            "key": idempotency_key,
            "order_id": data["order_id"],
            "customer_id": data["customer_id"],
            "amount": data["amount_cents"],
            "currency": data["currency"]
        })
        row = result.fetchone()
        
        # Existing completed payment (idempotent replay):
        if row.status == 'SUCCEEDED':
            return jsonify({
                "payment_id": str(row.id),
                "status": "succeeded",
                "stripe_charge_id": row.stripe_charge_id
            }), 200, {"Idempotent-Replayed": "true"}
        
        if row.status == 'FAILED':
            return jsonify({
                "payment_id": str(row.id),
                "status": "failed",
                "reason": row.failure_reason
            }), 422, {"Idempotent-Replayed": "true"}
    
    # Process payment (outside the insert transaction to avoid long-held locks):
    try:
        stripe_result = stripe_charge(
            amount=data["amount_cents"],
            currency=data["currency"],
            customer_id=data["stripe_customer_id"],
            idempotency_key=idempotency_key  # pass-through to Stripe
        )
        
        with engine.begin() as conn:
            conn.execute(text("""
                UPDATE payments
                SET status = 'SUCCEEDED', stripe_charge_id = :charge_id, updated_at = NOW()
                WHERE idempotency_key = :key
            """), {"charge_id": stripe_result["id"], "key": idempotency_key})
        
        return jsonify({
            "payment_id": str(row.id),
            "status": "succeeded",
            "stripe_charge_id": stripe_result["id"]
        }), 201
    
    except StripeCardDeclinedException as e:
        with engine.begin() as conn:
            conn.execute(text("""
                UPDATE payments
                SET status = 'FAILED', failure_reason = :reason, updated_at = NOW()
                WHERE idempotency_key = :key
            """), {"reason": e.decline_code, "key": idempotency_key})
        
        return jsonify({"status": "failed", "reason": e.decline_code}), 422
    
    except StripeTimeoutException:
        # Leave PENDING — client should retry with same key
        return jsonify({
            "status": "pending",
            "message": "Payment processing. Retry with same Idempotency-Key."
        }), 202

if __name__ == '__main__':
    app.run()
```

```bash
# Test idempotency:

# First call:
curl -X POST http://localhost:5000/payments \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: ik_$(uuidgen)" \
  -d '{"order_id":"ord-789","customer_id":"cust-456","amount_cents":9999,"currency":"USD","stripe_customer_id":"cus_abc"}'
# Returns: 201 Created, payment_id, stripe_charge_id

# Second call with SAME key:
IK="ik_abc123"
curl -X POST http://localhost:5000/payments \
  -H "Idempotency-Key: $IK" \
  -d '{"order_id":"ord-789","customer_id":"cust-456","amount_cents":9999,"currency":"USD","stripe_customer_id":"cus_abc"}'
# Returns: 200, Idempotent-Replayed: true, same payment_id
# No second Stripe charge.

# Verify only one record in DB:
psql payments_db -c "SELECT id, status, stripe_charge_id FROM payments WHERE idempotency_key = '$IK';"
# Exactly one row.
```

---

## Exercises

**Conceptual:**
1. Explain the three delivery semantics: at-most-once, at-least-once, and exactly-once. Why is exactly-once the hardest to achieve? What is the practical implementation of exactly-once?
2. What is an idempotency key? Why must it be generated client-side before the request is sent (not server-side in the response)?
3. Explain the dual-write problem. Why does the Outbox pattern solve it but publishing Kafka events inside a `@Transactional` method does not?
4. What is the difference between `ON CONFLICT DO NOTHING` and `ON CONFLICT DO UPDATE` in PostgreSQL? When would you use each for idempotency?
5. Why is a `SELECT FOR UPDATE` on a shared account balance a performance problem at high concurrency? What is the alternative pattern?

**Architecture:**
6. Design the complete idempotency strategy for a funds transfer system: transfer money from Account A to Account B. Both accounts are in the same database. Address: idempotency key, atomicity, rollback, and what happens if the server crashes mid-transfer.
7. A mobile app sends payment requests. The app may retry on network failure. Design the client-side and server-side components to guarantee exactly-once payment processing.
8. Your Kafka consumer processes "OrderPaid" events and creates shipment records. The consumer is restarted and re-processes 10,000 events. How do you prevent 10,000 duplicate shipments?

**Quantitative:**
9. An idempotency store uses Redis with a 24-hour TTL. Your service processes 5,000 unique payments per hour. Average response size stored: 2 KB per payment. How much Redis memory is consumed at steady state (after 24 hours of operation)?
10. A payment service calls Stripe. Stripe's API p99 latency is 800ms. On timeout (threshold: 1 second), 2% of requests time out. Each timed-out request is retried once with the same idempotency key. What is the effective throughput increase per 1,000 requests from supporting retry (vs failing immediately on timeout)?

---

## Solutions

### Exercise 9

**Steady-state memory at 24-hour TTL:**
- Keys created per hour: 5,000
- Keys alive at any time: 5,000/hour × 24 hours = 120,000 keys
- Memory per key: 2 KB (response) + ~100 bytes (metadata) ≈ 2.1 KB
- Total: 120,000 × 2.1 KB = **252 MB Redis memory**

This is well within a standard Redis instance (typically 8-64 GB). No concern.

At 10× scale (50,000 payments/hour): 2.52 GB — still manageable on a single Redis node. At 100× scale: 25 GB — would require Redis Cluster or storing only response hash instead of full body.

### Exercise 10

**Throughput analysis:**
- 1,000 requests. 2% timeout = 20 requests timeout.
- Without retry: 20 requests fail → 980 successful payments.
- With retry (same idempotency key): 20 requests retried → Stripe recognizes key → returns stored result.
  - Additional 20 Stripe calls at p99 800ms = ~800ms extra latency for those 20 requests.
  - But: result already exists at Stripe → Stripe can return cached result faster (Stripe idempotency lookup: ~100ms vs full charge processing: ~800ms).
  - Effective: 20 requests succeed on retry → **1,000 successful payments** (vs 980 without retry).
  
**Throughput increase: 20 additional successful payments per 1,000 = 2% improvement.**

More importantly: these are not "recovered" successes — they are payments that WOULD have been double-charged without idempotency key support. The comparison is: 980 successful (without retry) vs 1,000 successful + 0 double charges (with retry + idempotency key).

---

## Interview Questions

### Beginner
- What is idempotency? Give a real-world example of an idempotent operation.
- What happens when a payment API call times out? How do you handle it safely?
- What is the difference between a 429 and a 503 HTTP status code?

### Senior
- Explain how a DB UNIQUE constraint provides idempotency guarantees. Why is an application-level check insufficient?
- Walk through the dual-write problem. Why does the Outbox pattern solve it?
- Design an idempotency key scheme for a mobile payment app where the user might close the app mid-transaction.
- What is `SELECT FOR UPDATE`? When is it appropriate, and when does it cause problems?

### Staff
- Design the complete payment processing flow for a checkout system with idempotency at every layer: client, API gateway, payment service, external payment processor, and Kafka consumer.
- A reconciliation job finds 50 payments stuck in PENDING state. Walk through your investigation and resolution steps.
- Explain Kafka exactly-once semantics. What is the difference between idempotent producer and transactional producer?

### Principal
- Design the idempotency architecture for a global payment platform: 10M transactions/day, 5 regions, 24-hour idempotency window. Address: storage, expiry, cross-region synchronization, and failure modes.
- A team proposes using Redis for idempotency key storage (no database). Evaluate: what correctness properties does this provide? What can go wrong? Under what conditions would you accept this design?
- The double-charge rate for your payment platform is 0.001% (1 in 100,000 payments). Your CEO says this is unacceptable. Walk through the engineering changes required to get this to 0.0001% (1 in 10M), and the trade-offs each change introduces.

---

## Summary

Idempotency is the engineering property that makes distributed systems correct under the inevitable failures of production:

- **The core problem:** Network timeouts make "did this operation succeed?" unknowable. Without idempotency, retries cause double effects (double charges, duplicate inventory deductions). Idempotency makes retries safe by ensuring multiple calls with the same intent produce the same result.
- **Delivery semantics:** At-most-once (fire and forget) → At-least-once (retry until ack) → Exactly-once (at-least-once + idempotent handlers). Exactly-once is implemented, not guaranteed by the network.
- **Idempotency key:** Client-side generated UUID, stored before the request, passed in `Idempotency-Key` header, passed through to external APIs. The key scopes the deduplication to a specific business operation instance.
- **DB-level enforcement:** UNIQUE constraint on `idempotency_key` is the only reliable safeguard against concurrent duplicate requests. Application-level checks have a TOCTOU race condition.
- **Dual-write solution:** Outbox pattern — write domain state AND outbox event in one DB transaction. The relay publishes atomically after commit. Consumer must be idempotent (ON CONFLICT or processed_events table).
- **PENDING state:** Payments left PENDING by timeout are resolved by reconciliation: query the external API, update to SUCCEEDED or FAILED, publish the appropriate event. No payment should stay PENDING indefinitely.
- **Ledger design:** Double-entry bookkeeping with UNIQUE constraint on (transaction_id, account_id, entry_type) → naturally idempotent. Balance derived from entries (sum of credits - sum of debits) → never inconsistent.

---

## What You Should Now Be Able To Explain

- ✅ Why idempotency keys must be generated client-side before the request (not returned in the response)
- ✅ How a DB UNIQUE constraint prevents the concurrent duplicate request race condition that application-level checks cannot
- ✅ The dual-write atomicity gap and why the Outbox pattern closes it
- ✅ The PENDING payment state machine and why a reconciliation loop is required
- ✅ Why SELECT FOR UPDATE on hot rows serializes transactions (and the append-only ledger alternative)
- ✅ How Kafka idempotent producer (broker-level dedup) differs from consumer-side idempotency (processed_events table)

---

## What To Learn Next

**Chapter 21 — Search Systems: Elasticsearch and Full-Text Search at Scale.** You have mastered data correctness across distributed operations. Chapter 21 covers specialized read models built for text search: inverted indexes (how Elasticsearch stores and retrieves documents in milliseconds across billions of records), relevance scoring (TF-IDF and BM25), sharding and replication in Elasticsearch, near-real-time indexing (the segment merge process and why it matters for freshness), and the operational challenges of running Elasticsearch at scale — index lifecycle management, mapping explosion, and the split-brain problem in ES clusters.
