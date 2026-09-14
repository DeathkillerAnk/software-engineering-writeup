# Chapter 18 — Microservice Patterns: Saga, CQRS, and Event Sourcing

## Difficulty
Advanced → Expert

## Importance
**Must Know** — In a monolith, a business operation that touches multiple entities is wrapped in a single database transaction: ACID atomicity handles everything. In a microservices architecture, the same operation touches multiple services, each with its own database. You cannot run a two-phase commit (2PC) across service boundaries — the coordinator becomes a single point of failure and the locking causes deadlocks at scale. The Saga pattern solves this with a sequence of local transactions connected by domain events, with compensating transactions for rollback. CQRS solves the read/write scaling asymmetry by separating the write model (normalized, consistent) from the read model (denormalized, optimized). Event Sourcing makes the event log the source of truth — enabling temporal queries, full audit trails, and event-driven downstream consumers. Together, these three patterns define how data flows reliably in distributed systems.

## Prerequisites
Chapter 6 — Message Queues and Event Streams (Kafka — the backbone of these patterns)
Chapter 8 — Consistency, Consensus (eventual consistency — what these patterns accept)
Chapter 12 — SQL Databases at Scale (ACID — what we are departing from)
Chapter 13 — NoSQL Databases (eventual consistency in practice)

## Learning Objectives

By the end of this chapter you will be able to:

1. Explain why distributed transactions (2PC) fail at scale and what properties they sacrifice.
2. Design a Saga using both the Choreography and Orchestration approaches — and choose between them based on the use case.
3. Implement compensating transactions correctly — and explain why compensation is not the same as rollback.
4. Explain CQRS: how commands update the write model, how queries read from the read model, and how the two are kept in sync.
5. Explain Event Sourcing: the event store, event replay, projections, and snapshots.
6. Apply the Outbox pattern to guarantee exactly-once event publication without 2PC.
7. Diagnose idempotency failures in Saga compensations.
8. Understand the operational challenges: event schema evolution, eventual consistency windows, and debugging event-sourced systems.

## Why This Matters

An e-commerce platform receives an order. The operation requires:
1. Reserve inventory (inventory service)
2. Charge the customer (payment service)
3. Create a shipment (shipping service)
4. Send a confirmation email (notification service)

In a monolith: one transaction, one commit. If payment fails after inventory is reserved: rollback undoes the reservation.

In microservices: four separate databases. If payment fails after inventory is reserved, inventory's local transaction has already committed. You cannot rollback across service boundaries.

Without Sagas: the system has orphaned inventory reservations and no way to clean them up. Over time, inventory counts become wrong. Customers see "in stock" for items that are actually unavailable.

With Sagas: a payment failure triggers a compensation message to inventory service: "release the reservation for order-123." The compensation is a new forward action (not a database rollback) that the inventory service processes in its own local transaction.

This chapter is where "microservices" meets "reliable business operations."

---

## Mental Model

> **In a distributed system, you cannot have ACID across service boundaries — you can only have eventual consistency with compensation. A Saga replaces a distributed transaction with a sequence of local transactions, each of which can succeed or fail independently, with explicit compensating actions to undo the effects of completed steps if a later step fails. The key insight: compensation is not rollback — it is a new forward action that produces a semantically equivalent outcome. "Cancel the reservation" is not the same as the database undoing the INSERT; it is a new event that the inventory service processes in its own transaction.**

---

## Intuition

Think of booking an international trip with multiple vendors:

**Old way (2PC / distributed transaction):** Call every vendor (hotel, airline, car rental) and say: "Hold my booking but don't confirm it yet. I'll call you back in 5 minutes to confirm everything at once." If any vendor doesn't respond in time, everyone holds their booking in limbo. The coordinator (you) becomes the bottleneck.

**Saga (Choreography):** Book the flight. Flight confirmation triggers your travel agent to book the hotel. Hotel confirmation triggers car rental. If the car rental fails: the travel agent automatically cancels the hotel. The hotel cancellation triggers automatic refund from the airline. No central coordinator — each vendor knows what to do next.

**Saga (Orchestration):** A travel agency (the orchestrator) manages the entire booking. It calls flight, then hotel, then car rental in sequence. If car rental fails: the agency calls hotel to cancel, then calls airline to cancel. One coordinator owns the state machine.

Neither is a database rollback. Each cancellation is a new business action (email confirmation of cancellation, refund processed, etc.) — the saga's "compensation."

---

## Visual Explanation

### The 2PC Problem at Scale

```
Two-Phase Commit (2PC) — why it fails:

Phase 1 (Prepare):
  Coordinator → Order Service: "Prepare to commit"
  Coordinator → Payment Service: "Prepare to commit"
  Coordinator → Inventory Service: "Prepare to commit"

All three lock their records. Hold locks.
  
  If Inventory Service is slow or unreachable:
    Coordinator waits (no timeout = deadlock, timeout = uncertain state)
    Order and Payment hold locks the entire time
    → Other transactions blocked on those rows

Phase 2 (Commit or Rollback):
  Coordinator → all: "Commit" (or "Rollback")
  
  What if coordinator crashes after Phase 1, before Phase 2?
    All three services hold locks, waiting indefinitely.
    Only recovery: human intervention or coordinator restart.

2PC problems:
  ├── Single coordinator = SPOF
  ├── All participants lock during Phase 1 = reduced throughput
  ├── Coordinator crash = indefinite blocking
  └── Network partition during Phase 2 = inconsistent state

Real-world adoption: 2PC is NOT used in modern microservices architectures.
Used only in: tightly coupled distributed databases (Oracle RAC, PostgreSQL FDW).
```

### Saga Execution — Choreography vs Orchestration

```
Order Saga (Choreography — event-driven, no central coordinator):

  OrderService                InventoryService          PaymentService
      │                             │                         │
      │──create order (local TX)──▶│                         │
      │──publish OrderCreated ────▶─┼─────────────────────────│
      │                             │                         │
      │                    reserve inventory (local TX)       │
      │                    publish InventoryReserved ────────▶│
      │                             │                         │
      │                             │             charge card (local TX)
      │                             │             publish PaymentCompleted
      │◀────────────────────────────┼─────────────────────────│
  finalize order (local TX)        │                         │
  publish OrderCompleted            │                         │
      │                             │                         │

Failure: PaymentFailed (card declined):
  PaymentService: publish PaymentFailed event
  InventoryService: listens → release reservation (local TX) [COMPENSATION]
  OrderService: listens → cancel order (local TX) [COMPENSATION]

Order Saga (Orchestration — central coordinator):

  OrderSagaOrchestrator
      │
      │──1. ReserveInventory(orderId) ──▶ InventoryService
      │◀── InventoryReserved / InsufficientStock ──────────
      │
      │──2. ChargePayment(orderId) ──────▶ PaymentService
      │◀── PaymentCompleted / PaymentFailed ──────────────
      │
      │ If PaymentFailed:
      │──3. ReleaseInventory(orderId) ───▶ InventoryService [COMPENSATION]
      │◀── InventoryReleased ─────────────────────────────
      │
      │──4. CancelOrder(orderId) ────────▶ OrderService [COMPENSATION]
      │◀── OrderCancelled ────────────────────────────────

Orchestrator state machine:
  PENDING → INVENTORY_RESERVED → PAYMENT_COMPLETE → ORDER_COMPLETE
                    │                    │
                    ▼                    ▼
              CANCELLED (failed)    COMPENSATING (rolling back)
                                         │
                                         ▼
                                    CANCELLED
```

---

## Core Concepts

### 1. The Saga Pattern

A Saga is a sequence of local transactions where each step publishes events or sends commands that trigger the next step. If any step fails, the saga executes compensating transactions for all previously completed steps.

**Key properties:**
- Each step is a local transaction — ACID within one service's database
- Between steps: eventual consistency (the saga may be partially complete)
- No distributed locking
- Compensation ≠ rollback (compensation is a new forward action)
- Sagas are durable: if a participant crashes mid-saga, it resumes after recovery

#### Choreography-Based Saga

Services communicate via events. Each service reacts to events and publishes new events. No central coordinator.

```java
// OrderService: publishes event after creating order
@Service
public class OrderService {
    @Transactional
    public Order createOrder(CreateOrderCommand cmd) {
        // Step 1: Local transaction (create order in PENDING state)
        Order order = orderRepository.save(Order.builder()
            .customerId(cmd.getCustomerId())
            .items(cmd.getItems())
            .total(cmd.getTotal())
            .status(OrderStatus.PENDING)
            .build());
        
        // Publish event to Kafka (in same transaction via Outbox pattern)
        outboxRepository.save(OutboxEvent.builder()
            .aggregateId(order.getId())
            .type("OrderCreated")
            .payload(objectMapper.writeValueAsString(new OrderCreatedEvent(order)))
            .build());
        
        return order;
    }
    
    // Compensating transaction: cancel the order
    @Transactional
    public void cancelOrder(String orderId, String reason) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new OrderNotFoundException(orderId));
        
        // Idempotency: if already cancelled, do nothing
        if (order.getStatus() == OrderStatus.CANCELLED) return;
        
        order.setStatus(OrderStatus.CANCELLED);
        order.setCancellationReason(reason);
        orderRepository.save(order);
        
        outboxRepository.save(OutboxEvent.builder()
            .aggregateId(orderId)
            .type("OrderCancelled")
            .payload(objectMapper.writeValueAsString(new OrderCancelledEvent(orderId, reason)))
            .build());
    }
}

// InventoryService: listens to OrderCreated, reacts
@KafkaListener(topics = "order.events")
public void handleOrderEvent(ConsumerRecord<String, String> record) {
    DomainEvent event = objectMapper.readValue(record.value(), DomainEvent.class);
    
    switch (event.getType()) {
        case "OrderCreated":
            handleOrderCreated((OrderCreatedEvent) event);
            break;
        case "PaymentFailed":
            handlePaymentFailed((PaymentFailedEvent) event);  // compensation trigger
            break;
    }
}

@Transactional
private void handleOrderCreated(OrderCreatedEvent event) {
    // Try to reserve inventory
    boolean reserved = inventoryService.reserve(event.getOrderId(), event.getItems());
    
    if (reserved) {
        outboxRepository.save(OutboxEvent.of("InventoryReserved", event.getOrderId(), ...));
    } else {
        // Publish failure event → triggers compensation in OrderService
        outboxRepository.save(OutboxEvent.of("InventoryInsufficient", event.getOrderId(), ...));
    }
}

@Transactional
private void handlePaymentFailed(PaymentFailedEvent event) {
    // COMPENSATION: release the reservation
    inventoryService.releaseReservation(event.getOrderId());
    outboxRepository.save(OutboxEvent.of("InventoryReleased", event.getOrderId(), ...));
}
```

**Choreography trade-offs:**
```
✅ Loose coupling: services don't know about each other (only about events)
✅ Simple to add new participants: subscribe to existing events
✅ No single point of failure (no coordinator)
❌ Hard to reason about: saga flow is implicit (spread across services)
❌ Hard to monitor: "what's the current state of order saga for order-123?" requires querying all services
❌ Cyclic dependencies possible: Service A reacts to B, B reacts to A → infinite loop risk
❌ Testing is hard: must simulate all event interactions
```

#### Orchestration-Based Saga

A central orchestrator (a state machine) drives the saga. It calls each participant service directly (via command or API) and handles responses.

```java
// OrderSagaOrchestrator: state machine driving the saga
@Component
public class OrderSagaOrchestrator {
    
    // State machine definition:
    // STARTED → reserve inventory → INVENTORY_RESERVED
    //        → charge payment   → PAYMENT_COMPLETE
    //        → send notification → COMPLETE
    //
    // Compensations:
    // PAYMENT_FAILED → release inventory → INVENTORY_RELEASED → cancel order → CANCELLED
    // INVENTORY_INSUFFICIENT → cancel order → CANCELLED
    
    @Transactional
    public void startSaga(String orderId) {
        SagaState state = sagaRepository.save(SagaState.builder()
            .orderId(orderId)
            .status(SagaStatus.STARTED)
            .currentStep("RESERVE_INVENTORY")
            .build());
        
        // Send command to inventory service
        commandBus.send(new ReserveInventoryCommand(orderId, getOrderItems(orderId)));
    }
    
    @Transactional
    public void handleInventoryReserved(InventoryReservedEvent event) {
        SagaState state = sagaRepository.findByOrderId(event.getOrderId());
        state.setStatus(SagaStatus.INVENTORY_RESERVED);
        state.setCurrentStep("CHARGE_PAYMENT");
        sagaRepository.save(state);
        
        commandBus.send(new ChargePaymentCommand(event.getOrderId(), getOrderTotal(event.getOrderId())));
    }
    
    @Transactional
    public void handlePaymentFailed(PaymentFailedEvent event) {
        SagaState state = sagaRepository.findByOrderId(event.getOrderId());
        state.setStatus(SagaStatus.COMPENSATING);
        state.setCurrentStep("RELEASE_INVENTORY");
        sagaRepository.save(state);
        
        // Trigger compensation
        commandBus.send(new ReleaseInventoryCommand(event.getOrderId()));
    }
    
    @Transactional
    public void handleInventoryReleased(InventoryReleasedEvent event) {
        SagaState state = sagaRepository.findByOrderId(event.getOrderId());
        state.setCurrentStep("CANCEL_ORDER");
        sagaRepository.save(state);
        
        commandBus.send(new CancelOrderCommand(event.getOrderId(), "PaymentFailed"));
    }
}
```

**Orchestration trade-offs:**
```
✅ Explicit saga state: query the orchestrator to know where any saga is
✅ Easier to reason about: all logic in one place
✅ Easier to test: test the state machine in isolation
✅ Easier to monitor: one dashboard shows all in-flight sagas
❌ Orchestrator is a single point of coupling (not failure — it can be replicated)
❌ Services now depend on the orchestrator's command model (not just events)
❌ Can become a "smart orchestrator / dumb services" anti-pattern (logic leaks into orchestrator)
```

**When to use each:**
```
Use Choreography when:
  Simple linear flows (A → B → C, no complex branching)
  Team autonomy is critical (teams shouldn't share an orchestrator service)
  Adding new participants frequently (subscribe to existing events)

Use Orchestration when:
  Complex flows with conditional branches and parallel steps
  Need to track saga state centrally for monitoring and debugging
  Long-running sagas (days/weeks) that need resumable state
  Regulatory requirement: full audit trail of saga progression
```

### 2. The Outbox Pattern — Guaranteed Event Publication

The fundamental problem: how do you update your database AND publish an event atomically?

```
The naive approach:
  1. db.save(order)       → commits locally ✅
  2. kafka.publish(event) → fails (Kafka unavailable) ❌
  
  Result: order created, event never published.
  Inventory service never gets "OrderCreated" → never reserves inventory.
  Order stuck in PENDING state forever.

The other naive approach:
  1. kafka.publish(event) → succeeds ✅
  2. db.save(order)       → fails ❌
  
  Result: event published, order not created.
  Inventory service receives "OrderCreated" → tries to reserve → order doesn't exist.
  
Both orderings have atomicity gaps.

The Outbox Pattern (dual-write with one transaction):
  1. In a SINGLE database transaction:
     a. db.save(order)            → order table
     b. db.save(outbox_event)     → outbox table (same DB, same TX)
  2. Transaction commits atomically (both or neither)
  3. A separate process (Outbox Relay) reads the outbox table and publishes to Kafka
     Message relay: polls outbox table, publishes each undelivered event, marks as delivered
     OR: Debezium CDC reads outbox table from WAL → publishes to Kafka (no polling needed)

Outbox table schema:
  CREATE TABLE outbox_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_id  TEXT NOT NULL,           -- e.g., order:123
    aggregate_type TEXT NOT NULL,          -- e.g., Order
    event_type    TEXT NOT NULL,           -- e.g., OrderCreated
    payload       JSONB NOT NULL,
    published_at  TIMESTAMP WITH TIME ZONE,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  CREATE INDEX ON outbox_events (published_at NULLS FIRST);  -- query unpublished events

Outbox Relay (polling):
  SELECT * FROM outbox_events WHERE published_at IS NULL ORDER BY created_at LIMIT 100;
  FOR EACH event:
    kafka.produce(topic, event.payload)  -- at-least-once publish
    UPDATE outbox_events SET published_at = NOW() WHERE id = event.id;
  
  Guarantee: if relay crashes between produce and UPDATE → event is re-published (duplicate).
  Consumers MUST be idempotent (handle duplicate events).

Debezium CDC approach (preferred — no polling):
  Debezium reads PostgreSQL WAL → transforms INSERT on outbox_events → publishes to Kafka.
  Guarantee: event appears in Kafka exactly when it appears in the WAL.
  Advantage: sub-second latency (no polling delay), no relay service to maintain.
```

### 3. Idempotency in Sagas — The Critical Requirement

Because events may be delivered more than once (Kafka at-least-once), every saga step and compensation must be idempotent.

```java
// Idempotent inventory reservation:
@Transactional
public void handleOrderCreated(OrderCreatedEvent event) {
    String orderId = event.getOrderId();
    
    // Check if already processed (idempotency key):
    if (inventoryReservationRepository.existsByOrderId(orderId)) {
        log.info("InventoryReservation already exists for orderId={}, skipping", orderId);
        return;  // idempotent: do nothing on duplicate
    }
    
    // Reserve inventory:
    boolean success = inventoryService.reserve(orderId, event.getItems());
    
    // Save reservation record (prevents duplicate processing):
    inventoryReservationRepository.save(InventoryReservation.builder()
        .orderId(orderId)
        .status(success ? ReservationStatus.RESERVED : ReservationStatus.FAILED)
        .build());
    
    // Publish result:
    String eventType = success ? "InventoryReserved" : "InventoryInsufficient";
    outboxRepository.save(OutboxEvent.of(eventType, orderId, ...));
}

// Idempotent compensation:
@Transactional
public void handlePaymentFailed(PaymentFailedEvent event) {
    InventoryReservation reservation = inventoryReservationRepository
        .findByOrderId(event.getOrderId())
        .orElse(null);
    
    if (reservation == null || reservation.getStatus() == ReservationStatus.RELEASED) {
        log.info("Reservation already released or not found for orderId={}", event.getOrderId());
        return;  // compensation idempotent: already done
    }
    
    inventoryService.release(event.getOrderId());
    reservation.setStatus(ReservationStatus.RELEASED);
    inventoryReservationRepository.save(reservation);
    
    outboxRepository.save(OutboxEvent.of("InventoryReleased", event.getOrderId(), ...));
}
```

**Idempotency key patterns:**
```
Pattern 1: Natural idempotency key (domain-level)
  orderId → only one reservation per order → re-processing is a no-op

Pattern 2: Event ID deduplication
  Each Kafka message has a unique event_id in its header.
  Service stores event_ids it has processed.
  On receive: check if event_id in processed_events table → skip if exists.
  
  CREATE TABLE processed_events (
    event_id   UUID PRIMARY KEY,
    processed_at TIMESTAMP DEFAULT NOW()
  );
  
  Risk: processed_events table grows forever → periodic cleanup needed
        (safe to delete records older than max Kafka retention + safety margin)

Pattern 3: Database unique constraint
  UNIQUE(order_id) on inventory_reservations table
  Duplicate insert → UNIQUE violation → caught and treated as "already done"
  Simplest approach for create operations
```

### 4. CQRS — Command Query Responsibility Segregation

CQRS separates the write model (commands that change state) from the read model (queries that return data). The two models can have different schemas, different storage systems, and different scaling characteristics.

```
Traditional (no CQRS):
  One database → same tables for reads and writes
  
  Problem: reads and writes have conflicting requirements:
    Writes: normalized schema (3NF), transactional, ACID
    Reads: denormalized for fast queries, potentially stale OK
    
  Symptoms of the conflict:
    - Adding read-optimized indexes slows down writes
    - Denormalizing for a dashboard query breaks normalization
    - Read queries lock tables → blocking write transactions
    - Read scaling requires scaling write replicas (expensive)

CQRS solution:
  Write side (Command side):
    Normalized schema (orders, order_items, products — separate tables)
    Optimized for transactional writes
    Read your own writes: query write DB immediately after write
    
  Read side (Query side):
    Denormalized schema (order_summary: one row per order with all needed data)
    Optimized for specific read patterns (each dashboard gets its own read model)
    Can use different technology: PostgreSQL write DB → Elasticsearch read model
                                  or: MongoDB for flexible document queries
                                  or: Redis for sub-millisecond reads
    Eventual consistency: read model lags behind write model by seconds
```

```java
// Command side: normalized write model
// OrderRepository: standard JPA/Hibernate with normalized tables
@Entity
@Table(name = "orders")
public class Order {
    @Id UUID id;
    String customerId;
    OrderStatus status;
    BigDecimal total;
    LocalDateTime createdAt;
    
    @OneToMany(mappedBy = "order", cascade = ALL)
    List<OrderItem> items;
}

// Command handler: validates, executes, publishes event
@Transactional
public OrderId createOrder(CreateOrderCommand cmd) {
    // Validate
    customer = customerRepository.findById(cmd.getCustomerId())
        .orElseThrow(() -> new CustomerNotFoundException(cmd.getCustomerId()));
    
    // Execute
    Order order = orderRepository.save(new Order(cmd));
    
    // Publish event (Outbox pattern)
    outboxRepository.save(OrderCreatedEvent.from(order));
    
    return order.getId();
}

// Read side: denormalized read model (updated by event consumer)
// Separate table optimized for the "order list" dashboard:
@Entity
@Table(name = "order_summaries")
public class OrderSummary {
    @Id UUID orderId;
    String customerId;
    String customerName;   // denormalized from customer
    String customerEmail;  // denormalized from customer
    OrderStatus status;
    BigDecimal total;
    int itemCount;         // pre-computed
    LocalDateTime createdAt;
    LocalDateTime lastUpdatedAt;
    List<String> productNames;  // denormalized array
}

// Event consumer: updates read model when write model changes
@KafkaListener(topics = "order.events")
@Transactional
public void handleOrderCreated(OrderCreatedEvent event) {
    Customer customer = customerClient.getCustomer(event.getCustomerId());  // fetch once
    
    OrderSummary summary = OrderSummary.builder()
        .orderId(event.getOrderId())
        .customerId(event.getCustomerId())
        .customerName(customer.getName())        // denormalize
        .customerEmail(customer.getEmail())      // denormalize
        .status(OrderStatus.PENDING)
        .total(event.getTotal())
        .itemCount(event.getItems().size())
        .productNames(event.getItems().stream().map(i -> i.getProductName()).toList())
        .createdAt(event.getCreatedAt())
        .lastUpdatedAt(LocalDateTime.now())
        .build();
    
    orderSummaryRepository.save(summary);
}

// Query handler: reads from denormalized read model (fast, no joins)
public List<OrderSummary> getOrdersForCustomer(String customerId, Pageable pageable) {
    // Single table query, no joins, index on customerId
    return orderSummaryRepository.findByCustomerIdOrderByCreatedAtDesc(customerId, pageable);
}

// Different read model for analytics dashboard:
// Revenue by product category per day
@Entity
@Table(name = "revenue_by_category_daily")
public class RevenueByCategoryDaily {
    @Id @EmbeddedId CategoryDateKey key;  // (category, date)
    BigDecimal revenue;
    int orderCount;
    // Updated by event consumer → replaces complex GROUP BY aggregation at query time
}
```

**CQRS with multiple read models:**
```
Write DB: PostgreSQL (normalized, ACID)
          ↓ events (via Outbox + Kafka)
Read model 1: PostgreSQL order_summaries (for the orders list API)
Read model 2: Elasticsearch (for full-text search + faceted filtering)
Read model 3: Redis (for real-time dashboard counts)
Read model 4: BigQuery/Redshift (for analytics — nightly batch projection)

Each read model is optimized for its specific query pattern.
The write model never knows about the read models — it only publishes events.
Adding a new read model: just add a new event consumer. No write model changes.
```

**CQRS trade-offs:**
```
✅ Read and write sides scale independently
✅ Read model optimized for each specific query (no join tax)
✅ Write model stays normalized and clean
✅ Multiple read models from the same event stream
❌ Eventual consistency: a write may not be immediately visible in read model
   (typically 100ms-1s lag with Kafka; can be seconds under load)
❌ Complexity: two models to maintain, event consumers to operate
❌ "Read your own writes": if you write and immediately read, you may get stale data
   Mitigation: read from write DB for the immediate response after mutation,
               or use a read-your-own-writes token (chapter in Section 12)
❌ Schema evolution: changing events requires migrating read model projections
```

### 5. Event Sourcing — The Event Log as Source of Truth

In traditional systems, the database stores the current state of an entity (the latest snapshot). In Event Sourcing, the database stores every event that has ever happened to the entity. Current state is derived by replaying events.

```
Traditional (state-based):
  orders table: { id: "o123", status: "shipped", total: 99.99, ... }
  The row shows the current state. The history is gone.
  
Event Sourced:
  order_events table:
  ┌─────────────────┬──────────────────────┬─────────────────────────────────────────┐
  │ sequence_number │ event_type           │ payload                                 │
  ├─────────────────┼──────────────────────┼─────────────────────────────────────────┤
  │ 1               │ OrderCreated         │ {customerId: "c789", items: [...]}      │
  │ 2               │ PaymentCompleted     │ {paymentId: "p456", amount: 99.99}     │
  │ 3               │ ItemShipped          │ {trackingNumber: "1Z999AA10123456784"} │
  │ 4               │ OrderDelivered       │ {deliveredAt: "2024-01-20T14:30:00Z"}  │
  └─────────────────┴──────────────────────┴─────────────────────────────────────────┘
  
  Current state (reconstructed by replaying events):
    start with empty order
    apply OrderCreated → order created, status=PENDING
    apply PaymentCompleted → payment recorded, status=PAID
    apply ItemShipped → tracking set, status=SHIPPED
    apply OrderDelivered → delivered time set, status=DELIVERED
  
  The event log IS the database. Projections (like order_summaries) are derived views.
```

```java
// Aggregate: derives state from events
public class Order {
    private String id;
    private String customerId;
    private OrderStatus status;
    private BigDecimal total;
    private String trackingNumber;
    private List<OrderItem> items = new ArrayList<>();
    
    // Reconstruct from event history:
    public static Order reconstitute(List<DomainEvent> events) {
        Order order = new Order();
        for (DomainEvent event : events) {
            order.apply(event);  // apply each event to build current state
        }
        return order;
    }
    
    // Apply each event type to update state:
    private void apply(DomainEvent event) {
        switch (event) {
            case OrderCreated e -> {
                this.id = e.getOrderId();
                this.customerId = e.getCustomerId();
                this.items = e.getItems();
                this.total = e.getTotal();
                this.status = OrderStatus.PENDING;
            }
            case PaymentCompleted e -> this.status = OrderStatus.PAID;
            case ItemShipped e -> {
                this.trackingNumber = e.getTrackingNumber();
                this.status = OrderStatus.SHIPPED;
            }
            case OrderDelivered e -> this.status = OrderStatus.DELIVERED;
            default -> throw new UnknownEventException(event.getClass());
        }
    }
    
    // Command: validate business rules, then append event
    public void ship(String trackingNumber) {
        if (this.status != OrderStatus.PAID) {
            throw new IllegalStateException("Cannot ship order in status: " + status);
        }
        // Don't update state directly — append event:
        appendEvent(new ItemShipped(this.id, trackingNumber, Instant.now()));
    }
    
    private List<DomainEvent> pendingEvents = new ArrayList<>();
    
    private void appendEvent(DomainEvent event) {
        this.pendingEvents.add(event);
        this.apply(event);  // update in-memory state immediately
    }
}

// Event Store repository:
public class EventStoreOrderRepository {
    
    public Order findById(String orderId) {
        // Load all events for this aggregate:
        List<DomainEvent> events = eventStore.loadEvents(orderId);
        if (events.isEmpty()) throw new OrderNotFoundException(orderId);
        return Order.reconstitute(events);
    }
    
    @Transactional
    public void save(Order order) {
        List<DomainEvent> newEvents = order.getPendingEvents();
        if (newEvents.isEmpty()) return;
        
        // Optimistic concurrency: expected version = events seen when loaded
        eventStore.appendEvents(order.getId(), newEvents, order.getVersion());
        // If another process appended events since we loaded → OptimisticLockException
        
        // Publish new events to Kafka (Outbox pattern):
        newEvents.forEach(event -> outboxRepository.save(OutboxEvent.from(event)));
        
        order.clearPendingEvents();
    }
}
```

**Event Store schema:**
```sql
CREATE TABLE event_store (
    stream_id        TEXT NOT NULL,       -- aggregate ID (e.g., "order:123")
    stream_version   BIGINT NOT NULL,     -- monotonically increasing per stream
    event_type       TEXT NOT NULL,
    event_data       JSONB NOT NULL,
    event_metadata   JSONB,               -- correlation_id, causation_id, user_id, ...
    recorded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (stream_id, stream_version)
);

-- Optimistic concurrency: INSERT fails on duplicate (stream_id, stream_version)
-- If expected_version = 5 and another process already wrote version 5: UNIQUE violation
-- → retryable conflict (reload, re-apply command, re-save)

CREATE INDEX ON event_store (stream_id, stream_version);  -- fast load by stream
CREATE INDEX ON event_store (recorded_at);                 -- for catching up consumers
CREATE INDEX ON event_store (event_type, recorded_at);    -- for projections by event type
```

**Snapshots — performance optimization for large streams:**
```
Problem: an order with 200 events requires replaying 200 events on every load.
At 10,000 orders loaded per second: 2,000,000 event rows scanned/second. Expensive.

Snapshot: periodic serialization of the current aggregate state.
  Every N events (e.g., every 50 events): save a snapshot
  snapshot_store: { stream_id, version, snapshot_data, recorded_at }

Loading with snapshot:
  1. Load latest snapshot (O(1))
  2. Load only events AFTER the snapshot version (few events)
  3. Apply events since snapshot to snapshot state → current state

Without snapshot: 200 events loaded and replayed
With snapshot (every 50): load snapshot (v150) + replay events 151-200 = 50 events
```

**Event Sourcing trade-offs:**
```
✅ Complete audit trail: every state change is recorded and queryable
✅ Temporal queries: "what was the state of order-123 at 2024-01-15 14:00:00?"
   (replay events up to that timestamp)
✅ Event replay: rebuild any projection from scratch by replaying all events
✅ Debugging: production bug? replay events in a test environment to reproduce exactly
✅ Natural fit for CQRS: events are the stream that populates read models
❌ Storage grows forever (append-only) → event compaction / archival needed
❌ Schema evolution: old event formats must remain deserializable forever
   (or: upcaster pattern — transform old events to new schema at read time)
❌ Eventual consistency: projections lag behind the event store
❌ Complex queries on current state: must go through a projection
   (cannot do ad-hoc SQL SELECT on the event store for "all PAID orders in CA")
❌ Learning curve: team must internalize "no direct state update — only events"
```

### 6. Projections — Materializing Read Models from Events

A projection is a consumer that reads events and builds a queryable view (read model).

```java
// Projection: builds the order_summaries read model from events
@Component
public class OrderSummaryProjection {
    
    @EventHandler  // Axon Framework handler, or equivalent Kafka consumer
    @Transactional
    public void on(OrderCreated event) {
        orderSummaryRepository.save(OrderSummary.builder()
            .orderId(event.getOrderId())
            .customerId(event.getCustomerId())
            .status("PENDING")
            .total(event.getTotal())
            .createdAt(event.getOccurredAt())
            .build());
    }
    
    @EventHandler
    @Transactional
    public void on(PaymentCompleted event) {
        orderSummaryRepository.findById(event.getOrderId()).ifPresent(summary -> {
            summary.setStatus("PAID");
            summary.setLastUpdatedAt(event.getOccurredAt());
            orderSummaryRepository.save(summary);
        });
    }
    
    @EventHandler
    @Transactional
    public void on(ItemShipped event) {
        orderSummaryRepository.findById(event.getOrderId()).ifPresent(summary -> {
            summary.setStatus("SHIPPED");
            summary.setTrackingNumber(event.getTrackingNumber());
            orderSummaryRepository.save(summary);
        });
    }
}

// Rebuild projection from scratch (when projection logic changes):
// 1. Truncate order_summaries table
// 2. Replay all events from event_store from beginning
// 3. Projection catches up to current state
// This is a powerful property: any read model can be rebuilt at any time
```

**Projection catchup and live streaming:**
```
Two modes:
  1. Catchup mode: read events from event_store sequentially from position 0
     (or from last checkpoint if partially caught up)
  2. Live mode: switch to consuming new events as they arrive (Kafka consumer)

Checkpoint tracking:
  projection_checkpoints table:
    projection_name TEXT PRIMARY KEY,
    last_event_id   BIGINT  -- last processed event sequence number
  
  On each processed event: UPDATE projection_checkpoints SET last_event_id = ?
  On restart: resume from last_event_id (no full replay needed)
  
  This is the "at-least-once" projection guarantee: events may be replayed on crash.
  Each event handler MUST be idempotent.
```

### 7. Event Schema Evolution

Events are stored forever. Code changes. The challenge: old events with old schemas must still deserialize correctly years later.

```
Problem: Event v1:
  { "type": "OrderCreated", "customerId": "c789", "amount": 99.99 }

Business change: split "amount" into "subtotal" and "tax":
  Event v2:
  { "type": "OrderCreated", "customerId": "c789", "subtotal": 90.90, "tax": 9.09 }

The event store has millions of v1 events and new v2 events.
A projection must handle both.

Solutions:

1. Upcaster pattern (transform old events to new schema at read time):
   @Upcaster(type="OrderCreated", fromVersion=1, toVersion=2)
   public JsonNode upcast(JsonNode v1Event) {
     double amount = v1Event.get("amount").asDouble();
     double tax = amount * 0.1;
     double subtotal = amount - tax;
     return objectNode()
       .put("customerId", v1Event.get("customerId").asText())
       .put("subtotal", subtotal)
       .put("tax", tax);
   }
   // V1 events are automatically transformed to V2 before passing to handlers
   // Handlers only see V2 events

2. Optional fields with defaults (backward-compatible evolution):
   Event v2: add subtotal and tax as optional fields with defaults
   { "type": "OrderCreated", "customerId": "c789", 
     "amount": 99.99,        // kept for backward compat
     "subtotal": 90.90,      // new, optional
     "tax": 9.09 }           // new, optional
   
   V1 events: subtotal and tax are null → handler uses amount as subtotal with 0 tax
   V2 events: handler uses subtotal and tax directly

3. Event versioning in type name:
   "OrderCreatedV1", "OrderCreatedV2"
   Handlers: register separate handlers for each version
   Simple but verbose — separate handler code for each version

4. Schema Registry (Confluent Schema Registry for Avro):
   Events stored as Avro bytes with schema ID in Kafka header
   Schema Registry: stores all schema versions
   Avro evolution rules: adding optional fields is backward-compatible
   Consumer: reads schema version → uses registered schema for deserialization
   Avro automatically handles default values for new fields
```

---

## Step-by-Step Execution

### Designing the Order Saga from Requirements

```
Business requirement:
  Placing an order involves:
  1. Create the order (OrderService)
  2. Reserve inventory (InventoryService)
  3. Charge the customer (PaymentService)
  4. Create a shipment record (ShippingService)
  5. Send confirmation email (NotificationService)
  
  Failure scenarios:
  - Inventory insufficient: cancel order, no charge
  - Payment declined: release inventory reservation, cancel order
  - Shipping unavailable: refund payment, release inventory, cancel order

Design decisions:
  
  Q: Choreography or Orchestration?
  A: Orchestration — because:
     - 5 participants with conditional failure paths (complex)
     - Need to track saga state for operations/debugging
     - Multiple compensating paths → hard to follow in choreography
  
  Q: What events/commands does each step use?
  A:
    Step 1: OrderSaga.createOrder → OrderService (CreateOrder command)
            → OrderCreated event
    Step 2: OrderSaga → InventoryService (ReserveInventory command)
            → InventoryReserved OR InventoryInsufficient event
    Step 3: OrderSaga → PaymentService (ChargePayment command)
            → PaymentCompleted OR PaymentFailed event
    Step 4: OrderSaga → ShippingService (CreateShipment command)
            → ShipmentCreated OR ShippingUnavailable event
    Step 5: OrderSaga → NotificationService (SendConfirmation command) [fire-and-forget]
  
  Q: What are the compensations?
  A:
    If InventoryInsufficient:     CancelOrder(orderId)
    If PaymentFailed:             ReleaseInventory(orderId) → CancelOrder(orderId)
    If ShippingUnavailable:       RefundPayment(orderId) → ReleaseInventory(orderId) → CancelOrder(orderId)
  
  Q: How do we handle saga state?
  A: Database table:
    order_saga_states:
      order_id TEXT PRIMARY KEY
      status TEXT (PENDING, INVENTORY_RESERVED, PAYMENT_COMPLETE, COMPLETE, COMPENSATING, CANCELLED)
      current_step TEXT
      failure_reason TEXT
      created_at TIMESTAMPTZ
      updated_at TIMESTAMPTZ
  
  Q: What is the idempotency key for each step?
  A: orderId is the natural idempotency key for all steps.
     Each service checks: "have I already processed orderId X?" → skip if yes.
  
  Q: What timeout handling is needed?
  A: If InventoryService doesn't respond in 30 seconds:
     OrderSaga: assume failure → compensate (as if InventoryInsufficient)
     This prevents sagas from hanging indefinitely.
     Implementation: scheduled job that checks for sagas in PENDING state > 30s → trigger compensation.
```

---

## Deep Dive

### Distributed Saga Failures — The "Lost Message" Problem

```
Scenario: Saga step 3 (ChargePayment) sends a command to PaymentService.
  PaymentService processes the command (charges the card successfully).
  PaymentService publishes PaymentCompleted event.
  Event is LOST (Kafka broker temporarily unavailable before the event is flushed).
  
  OrderSaga: waiting for PaymentCompleted... (timeout 30 seconds)
  Timeout: saga assumes payment failed → triggers compensation.
  
  OrderSaga compensation:
    Sends RefundPayment command to PaymentService.
    PaymentService: "there is a charge for this order" → issues refund.
  
  But: the original charge succeeded! The customer is now refunded for an order
  that WAS successfully charged. The customer gets the product AND a refund.
  
This is why:
  1. PaymentCompleted event publication must use the Outbox pattern (durably stored)
  2. Saga timeout must be generous enough for transient Kafka unavailability
  3. PaymentService must track: "have I already issued a refund for orderId X?" (idempotency)
  
Better design:
  PaymentService uses the Outbox pattern → event stored in DB (same TX as charge)
  Even if Kafka is down: event relay will publish the event when Kafka recovers
  OrderSaga receives PaymentCompleted → proceeds
  Timeout: set to 5 minutes (long enough for Kafka recovery) with alerting

The "lost message" scenario is why outbox + at-least-once + idempotency is the
correct architecture. There is no "exactly-once" without this combination.
```

### Eventual Consistency Windows — The UX Challenge

```
CQRS read model lag scenario:
  User creates an order (hits the command side).
  Command returns: "Order created. ID: order-123."
  User immediately hits "My Orders" page (hits the read side / order_summaries).
  
  Order_summaries has not been updated yet (event is in Kafka, not yet consumed).
  User sees: old list, no order-123.
  User thinks: "Did my order go through?"
  User clicks "Create Order" again → duplicate order!
  
Solutions:
  
  Option 1: Read-after-write from the command side
    After creating the order: display order details from the write DB (not the read model).
    Only use the read model for list queries (where slight staleness is acceptable).
    
  Option 2: Client-side optimistic update
    Frontend: immediately add the new order to the list (locally).
    If the read model catches up: the local item is replaced with the real one.
    If creation failed: undo the local update (show error).
    
  Option 3: Consistency token / "causality token"
    After write: return a token representing the event position (e.g., Kafka offset 12345)
    Read request includes token: "I need data reflecting at least offset 12345"
    Read model service: if it has processed offset 12345, serve the request.
    If not: wait up to 2 seconds for the projection to catch up, then serve.
    (Used by Uber's Cadence, LinkedIn's Espresso)
    
  Option 4: Accept the inconsistency with UX messaging
    "Your order has been submitted and will appear in your history shortly."
    Many systems do this. Honest and simple. Often underrated.
```

---

## Real-World Example

### Netflix's Event-Sourced Billing System

Netflix's billing system processes 200M+ subscriptions. They use a combination of Event Sourcing and CQRS:

**Event Sourcing for billing events:**
- Every billing action (subscription created, payment attempted, payment succeeded, payment failed, refund issued, subscription cancelled) is stored as an immutable event.
- Current subscriber state: derived from replaying events.
- Temporal queries: "what was the subscription status of user X on date Y?" — replay events up to that date.

**Practical benefits at Netflix scale:**
1. **Debugging billing issues:** when a customer calls about a wrong charge, replay their exact event sequence to see exactly what happened.
2. **Regulatory compliance:** immutable audit trail for billing — required by financial regulations.
3. **Backfilling analytics:** when a new analytics metric is needed, replay all historical events to compute it from day one.

**The projection architecture:**
- Primary event store: Cassandra (append-only writes, partitioned by userId)
- Projections: separate Cassandra tables per read model
- Near-real-time projection lag: < 1 second (Kafka consumer groups)

**Lessons from Netflix:**
- Event schema versioning is the hardest long-term problem. They use Avro with a schema registry.
- Snapshotting is critical: at 7 years of billing history, replaying from scratch takes minutes without snapshots.
- Projections must be independently rebuildable — and they test this regularly.

---

## Failure Scenarios

### Scenario 1: Compensation Out of Order (Phantom Compensation)

```
Order Saga in Orchestration mode.
Step 2 (InventoryService): saga sends ReserveInventory command.
InventoryService: slow response (GC pause, 5 seconds).

Saga timeout (30 seconds): No response → saga assumes InventoryInsufficient.
Saga: sends compensation ReleaseInventory command to InventoryService.

InventoryService: GC pause ends. Processes the original ReserveInventory command.
  Inventory RESERVED. Publishes InventoryReserved event.

InventoryService: then receives ReleaseInventory compensation command.
  Releases the reservation that was just made.

OrderSaga: receives InventoryReserved (delayed).
  BUT saga is already in CANCELLED state.
  Saga ignores InventoryReserved (idempotency: saga state = CANCELLED, cannot proceed).

Result: inventory was reserved and then immediately released. 
  Net effect: correct (no leaked reservation).
  
BUT: what if InventoryReserved arrived BEFORE the ReleaseInventory compensation?
  Saga (now CANCELLED) receives InventoryReserved → ignores (correct).
  Saga sends ReleaseInventory → InventoryService releases.
  
What if ReleaseInventory arrived BEFORE the InventoryReserved?
  InventoryService: "there is no reservation for orderId X" → no-op (idempotent).
  Then InventoryReserved processed: reservation created.
  ReleaseInventory already processed: reservation not released!
  
  LEAKED RESERVATION. Inventory count is wrong.

Fix: InventoryService tracks reservation status machine:
  States: NONE → RESERVED → RELEASED
  ReserveInventory: only succeeds if status = NONE
  ReleaseInventory: only succeeds if status = RESERVED
  
  If ReleaseInventory arrives before ReserveInventory:
    Status = NONE. Release is a no-op (nothing to release).
    ReserveInventory arrives later:
      Status = NONE → would create reservation.
      But check: has a cancellation been requested for this orderId?
      YES → reject the reservation (the saga is cancelled).
      
  This is the "semantic lock" pattern: saga sets a flag before compensating
  that prevents forward steps from proceeding after a compensation is initiated.
```

### Scenario 2: Read Model Stale During High Event Volume

```
Black Friday. Orders arriving at 50,000 RPS.
Event consumer (projection updater): can process 40,000 events/second.

Within 1 hour:
  Orders created: 50,000/s × 3600s = 180,000,000 new events
  Events processed by projection: 40,000/s × 3600s = 144,000,000
  
  LAG: 36,000,000 events behind (= 900 seconds = 15 minutes behind)
  
  order_summaries table: 15 minutes stale.
  Customers: see outdated order status. "Order placed 15 min ago, still showing Pending."
  Customer service: flooded with "where is my order" calls.
  
Root cause: projection consumer is the bottleneck.
  
Fix options:
  1. Scale projection consumers horizontally:
     Kafka topic: 50 partitions → 50 consumer instances → 50× throughput
     Each consumer handles its partition independently
     Requirement: order events for the same orderId must go to the same partition
     (use orderId as Kafka partition key → same orderId always on same partition)
  
  2. Batch projection updates:
     Consumer: collect 1000 events → batch INSERT/UPDATE into order_summaries
     Postgres: COPY or batch upsert → 100× more efficient than individual UPDATEs
  
  3. Separate projection for high-frequency fields:
     order_status_only table: only status, orderId (tiny row, fast update)
     order_summaries: full denormalized view (less frequent updates)
     "Order status" queries: use order_status_only (always fresh)
     "Order list": use order_summaries (acceptable lag)
```

---

## Performance Considerations

### Event Store Read Performance

```
Event store: append-only, never updated.
Read performance: determined by index design.

Loading an aggregate (order-123, 50 events):
  SELECT * FROM event_store WHERE stream_id = 'order:123' ORDER BY stream_version;
  Index: (stream_id, stream_version) → index scan, O(log N + 50 rows) → fast

Loading all events of a type (for projection rebuild):
  SELECT * FROM event_store WHERE event_type = 'OrderCreated' ORDER BY recorded_at;
  Index: (event_type, recorded_at) → good for per-type projection rebuild

Full projection rebuild (all events):
  SELECT * FROM event_store ORDER BY recorded_at;
  → Sequential scan: fast (no random I/O) but takes time for large stores
  → At 1 billion events × 1 KB each = 1 TB → full rebuild takes hours
  → Mitigation: snapshots reduce rebuild to "events since last snapshot" (much smaller)
  → Mitigation: store event_store in Kafka (log-compacted topics) → consumer groups can rebuild in parallel

Cassandra as event store (Netflix approach):
  Partition key: (stream_id, partition_bucket) → spreads large streams across partitions
  Clustering key: (stream_version) → ordered within partition
  
  stream_version ÷ 1000 = partition_bucket (bucket every 1000 events)
  → Each partition: max 1000 events × ~1 KB = ~1 MB (well within Cassandra partition limits)
  → Supports billions of events across millions of aggregates with consistent performance
```

---

## Trade-offs

| Pattern | Consistency | Complexity | Scalability | Auditability |
|---------|------------|------------|-------------|--------------|
| 2PC | Strong (ACID) | Medium (framework handles it) | Poor (locking, SPOF) | Medium |
| Saga (Choreography) | Eventual | High (implicit flow) | Excellent | Low (flow is distributed) |
| Saga (Orchestration) | Eventual | Medium (explicit state machine) | Excellent | High (orchestrator owns state) |
| CQRS | Eventual (read model) | High (two models) | Excellent (scales independently) | Medium |
| Event Sourcing | Eventual | Very High (mindset shift) | Good (append-only) | Excellent (complete history) |

---

## Production Considerations

1. **All Saga steps must be idempotent.** At-least-once delivery from Kafka means every handler will receive duplicate messages during retries, consumer restarts, and rebalances. If a step is not idempotent, it will produce duplicate charges, duplicate reservations, or duplicate emails.
2. **Use the Outbox pattern for event publication.** Never publish Kafka events outside of the same database transaction that updates your state. Without the Outbox, you have an atomicity gap that causes permanently lost events and stuck sagas.
3. **Implement saga timeouts.** A saga that is waiting for a message that was lost will wait forever without a timeout. Every saga step must have a timeout after which the saga assumes failure and triggers compensation.
4. **Design compensations for semantic correctness, not just reversal.** A compensation must produce a semantically correct state, not just undo the database change. "Refund payment" is not just deleting the payment record — it involves contacting the payment processor, recording the refund, and triggering downstream notifications.
5. **Monitor projection lag continuously.** A growing projection lag (> 5 seconds) indicates the consumer cannot keep up with the event rate. Alert and scale before the lag becomes user-visible (> 30 seconds).
6. **Plan for event schema evolution from day one.** Add schema versioning to every event from the start (`schemaVersion: 1` field). Implement upcasters for any event schema change. Never make breaking changes (remove or rename required fields) to existing events.

---

## Common Beginner Mistakes

1. **Not making compensations idempotent.** "We only call compensation once, so it doesn't need to be idempotent." Wrong — the compensation message may be delivered multiple times (Kafka at-least-once). A compensation that issues a double refund on the second delivery is a financial liability.
2. **Using direct HTTP calls between saga participants instead of message queues.** Direct HTTP calls in a saga create tight coupling and synchronous dependencies. If InventoryService is down, the saga blocks. Use async messaging (Kafka) so each step can proceed independently, with retry built in.
3. **Building Event Sourcing before you have domain clarity.** Event Sourcing requires knowing the right events for your domain upfront. If your domain model changes (event types are renamed, split, or merged), the event store must be migrated. Start with traditional state storage and migrate to Event Sourcing when the domain is stable.
4. **CQRS without accepting eventual consistency.** The whole point of a separate read model is that it can be slightly stale. If you find yourself trying to make the read model strongly consistent with the write model (synchronous event handling in the same transaction), you've removed the benefit of CQRS while keeping all the complexity.

---

## Common Senior Engineer Mistakes

1. **Saga orchestration logic in a shared library used by multiple services.** The orchestrator should be a standalone service with its own database for saga state. A shared library means saga state is in the caller's process — not durable across restarts, not observable, not independently scalable.
2. **Event Sourcing entire systems including technical/infrastructure events.** Event Sourcing is valuable for business domain aggregates (Order, Account, Subscription). Applying it to infrastructure concepts (LogEntry, MetricDataPoint, AuditLog) creates unnecessary complexity. These are naturally append-only and don't need aggregate reconstruction.
3. **CQRS read models updated synchronously in the command handler.** Some teams "optimize" by updating both the write DB and the read model in the same transaction. This recreates the N+1 table problem, negates read model flexibility, and creates blast radius between read and write failures.
4. **Not tracking projection checkpoint durably.** Tracking the Kafka offset only in memory → on consumer restart, projection replays from the beginning (or worse, from the committed offset which may be behind). Store the checkpoint in a durable store (PostgreSQL, Redis) and commit it after each batch of events is processed.

---

## Architecture Smells

- **Saga steps that make direct DB calls across service boundaries** → services are coupled at the data layer, not just the API layer
- **Events that contain mutable state, not facts** → "CurrentOrderStatus: PAID" is not an event; "PaymentCompleted" is an event
- **Read model queries hitting the write database** → negates CQRS separation; read load affects write performance
- **Saga without timeout handling** → sagas waiting forever for lost messages
- **Event store with UPDATE or DELETE operations** → events are immutable; any mutation destroys the audit trail
- **Saga compensation that issues refunds before confirming the original charge exists** → phantom refunds (negative balance exploits)
- **CQRS read model that is too close to the write model** → if the read model is just a copy of the write tables, CQRS adds complexity with no benefit

---

## Principal Engineer Perspective

The Saga pattern, CQRS, and Event Sourcing are not defaults — they are solutions to specific problems. Applying them prematurely adds significant complexity. The Principal Engineer's first question is always: do I actually have the problem these patterns solve?

**When you need Sagas:**
- Business operations span multiple services with their own databases.
- You need consistency (compensation) across those service boundaries.
- The alternative (distributed 2PC) is correctly rejected.
- If all the data is in one service/database: use ACID transactions. No Saga needed.

**When you need CQRS:**
- Read and write patterns are genuinely different in scale or shape.
- A single shared schema creates conflicts (read-optimized indexes hurt writes, or vice versa).
- You need multiple specialized read models (list view, dashboard, analytics, full-text search).
- If reads and writes have similar patterns and scale: a single model with good indexes is simpler.

**When you need Event Sourcing:**
- You need a complete, immutable audit trail (financial, regulatory, medical).
- You need temporal queries ("what was the state at time T?").
- Your domain evolves frequently and you need to replay events with new projection logic.
- If you don't need any of these: traditional state storage is simpler and well-understood.

**The maturity path:**
```
Stage 1: Monolith with ACID transactions (correct starting point)
Stage 2: Services with separate databases, synchronous APIs (simple, synchronous coupling)
Stage 3: Services with async messaging (Kafka), eventual consistency accepted
Stage 4: Saga pattern for cross-service business operations
Stage 5: CQRS for read/write separation and specialized read models
Stage 6: Event Sourcing for audit trail and temporal queries
```

Most teams should stop at Stage 4. Stage 5 and 6 add significant complexity that is only justified by specific requirements. Many companies have moved to Stage 5/6 prematurely, creating enormous operational burden for marginal benefit.

---

## Architecture Review Questions

1. For every business operation that spans multiple services: is there a documented Saga with explicit compensation steps for each failure mode?
2. Is the Outbox pattern used for all event publication? Are there any places where events are published outside of a database transaction?
3. Are all Saga steps and compensations idempotent? Is this tested?
4. Is Saga state stored durably (database), or in process memory?
5. What is the maximum saga timeout? What happens to sagas that exceed it?
6. For CQRS systems: what is the current projection lag? Is there an alert when it exceeds 30 seconds?
7. For Event Sourced systems: how long does it take to rebuild all projections from scratch? Is there a plan for when this must be done?
8. How are event schema changes managed? Is there a schema registry? Are upcasters in place for all breaking changes?
9. Are read-your-own-writes cases handled? (User writes data, immediately reads it, expects to see the write.)
10. Is Event Sourcing limited to domains where it provides specific value (audit, temporal queries), or applied broadly?

---

## Visual / Animation Specification

### Animation 1: Saga — Choreography Failure Path

**Five service boxes: OrderService, InventoryService, PaymentService, ShippingService, NotificationService.**

**Happy path (first 5 seconds):**
Arrows flowing left to right: OrderCreated → InventoryReserved → PaymentCompleted → ShipmentCreated → EmailSent. Each service box lights up green as its event is received.

**Failure path (second 5 seconds):**
Reset to start. OrderCreated flows. InventoryReserved flows. Then: PaymentService lights up RED. "PaymentFailed event published."

**Compensation wave (reverse direction):**
PaymentFailed → InventoryService receives it → ReleaseReservation local transaction → InventoryReleased event → OrderService receives it → CancelOrder local transaction → OrderCancelled.

Arrows now flow RIGHT TO LEFT (compensation direction). Each box lights yellow (compensating), then grey (compensated).

**Caption:** "Failure at step 3: compensation wave rolls back steps 2 and 1. No distributed lock. No coordinator."

### Animation 2: Event Sourcing — State Reconstruction

**Left side: Event Log (append-only table). Right side: "Current State" panel.**

**Empty state:** Right side shows empty Order object.

Events play one by one (500ms intervals), each lighting up and being "applied" to the right panel:
1. OrderCreated → right side: {status: PENDING, total: $99.99, items: [MacBook]}
2. PaymentCompleted → right side: {status: PAID, paymentId: p456}
3. ItemShipped → right side: {status: SHIPPED, trackingNumber: 1Z999...}
4. OrderDelivered → right side: {status: DELIVERED, deliveredAt: 2024-01-20}

**Caption at the end:** "4 events → complete state. Add a new event → new state. No UPDATE statements. Full history preserved."

---

## Hands-On Tutorial

### Implementing the Outbox Pattern

```sql
-- PostgreSQL: Outbox table
CREATE TABLE outbox_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id  TEXT NOT NULL,
  event_type    TEXT NOT NULL,
  payload       JSONB NOT NULL,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON outbox_events (published_at NULLS FIRST, created_at);
```

```java
// Service: atomically saves order + outbox event
@Transactional
public Order createOrder(CreateOrderCommand cmd) {
    Order order = orderRepository.save(Order.from(cmd));
    
    outboxRepository.save(OutboxEvent.builder()
        .aggregateId(order.getId().toString())
        .eventType("OrderCreated")
        .payload(objectMapper.writeValueAsString(OrderCreatedEvent.from(order)))
        .build());
    
    return order;
}

// Outbox relay: polls and publishes (runs every 500ms)
@Scheduled(fixedDelay = 500)
@Transactional
public void publishPendingEvents() {
    List<OutboxEvent> pending = outboxRepository
        .findByPublishedAtIsNullOrderByCreatedAtAsc(PageRequest.of(0, 100));
    
    pending.forEach(event -> {
        kafkaTemplate.send(topicFor(event.getEventType()), 
            event.getAggregateId(), event.getPayload());
        event.setPublishedAt(Instant.now());
        outboxRepository.save(event);
    });
}
```

```bash
# Debezium CDC alternative (no polling — reads PostgreSQL WAL):
docker run -d --name debezium \
  -e GROUP_ID=1 \
  -e BOOTSTRAP_SERVERS=kafka:9092 \
  -e CONFIG_STORAGE_TOPIC=connect-configs \
  -e OFFSET_STORAGE_TOPIC=connect-offsets \
  debezium/connect:2.5

# Configure PostgreSQL connector:
curl -X POST http://debezium:8083/connectors -H "Content-Type: application/json" -d '{
  "name": "outbox-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "postgres",
    "database.dbname": "orders",
    "table.include.list": "public.outbox_events",
    "transforms": "outbox",
    "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
    "transforms.outbox.table.field.event.key": "aggregate_id",
    "transforms.outbox.route.topic.replacement": "order.${routedByValue}",
    "transforms.outbox.table.field.event.type": "event_type"
  }
}'
# Debezium reads outbox_events inserts from WAL → publishes to Kafka automatically
```

---

## Exercises

**Conceptual:**
1. Explain why 2PC (Two-Phase Commit) fails at scale. What specific properties does it sacrifice?
2. What is the difference between a compensation and a rollback? Why does the distinction matter in practice?
3. What is the Outbox pattern? What problem does it solve? Why not just publish Kafka events directly after saving to the database?
4. Explain CQRS. What specific query/write conflict does it resolve? What consistency property must you accept?
5. What is Event Sourcing? What is a projection? What is a snapshot and why is it needed?

**Architecture:**
6. Design the complete Saga (with compensation) for a hotel booking system: reserve room, charge credit card, send confirmation email. Use orchestration. Define: state machine, commands, events, and compensations for each failure.
7. A team is experiencing read/write contention on their orders database: analytics queries lock tables during checkout. Propose a CQRS architecture. Define what the write model contains, what read models are needed, and how they are kept in sync.
8. A fintech startup needs to store complete transaction history for regulatory compliance (7-year retention), support temporal queries ("what was account X's balance on date Y?"), and rebuild dashboards from historical data. Which pattern(s) should they use and why?

**Quantitative:**
9. An event store receives 10,000 events/second. Events average 1 KB. How much storage does the event store consume per day? Per year? At what point would you need to implement event archival?
10. A Saga has 5 steps. Each step has a 1% probability of failure (independent). What is the probability that a saga completes without any compensation? What is the probability that at least one compensation is triggered?

---

## Solutions

### Exercise 9

**Storage per day:**
10,000 events/s × 1 KB × 86,400 s/day = **864 GB/day**

**Storage per year:**
864 GB × 365 = **315 TB/year**

**Archival threshold:**
Most teams consider archival when active event store exceeds:
- Performance threshold: ~10 TB (full replay time > 10 hours without snapshots)
- Cost threshold: NVMe SSD at ~$0.10/GB-month → 315 TB/year × $0.10 = $31,500/month storage alone

Practical archival strategy: move events older than 1 year to cold storage (S3 Glacier: ~$0.004/GB-month = $1,260/month for 315 TB). Keep hot event store at < 1 year (315 TB × $0.10 = $31,500/month hot). Implement snapshots to reduce hot store reads.

### Exercise 10

**P(saga completes without compensation):**
Each step succeeds with P = 0.99.
5 independent steps: P(all succeed) = 0.99⁵ = **0.951** (95.1%)

**P(at least one compensation triggered):**
P(at least one failure) = 1 - P(all succeed) = 1 - 0.951 = **0.049** (4.9%)

At 10,000 orders/hour: 10,000 × 4.9% = **490 sagas/hour trigger at least one compensation.**
This is significant operational volume — compensation paths must be well-tested, monitored, and alert on elevated rates.

---

## Interview Questions

### Beginner
- What is a distributed transaction? Why is it a problem in microservices?
- What is a Saga pattern? How does it handle failures?
- What is the difference between a command and an event in CQRS?

### Senior
- Explain the difference between Choreography and Orchestration Sagas. When would you use each?
- What is the Outbox pattern? How does it guarantee that events are published if Kafka is temporarily unavailable?
- What is Event Sourcing? What is a projection? How do you handle schema changes for events?
- Explain the read-your-own-writes problem in CQRS. How would you solve it?

### Staff
- Design the Saga for a ride-sharing platform: match driver, charge rider, pay driver, send receipt. Include state machine, commands, events, and compensations.
- A CQRS system's projection is lagging 10 minutes behind the event stream. Walk through your diagnosis and the options to resolve it.
- How do you handle event schema evolution in an Event Sourced system with 3 years of historical events?

### Principal
- A team proposes using Event Sourcing for all 20 microservices in their platform. Evaluate the proposal: where is it appropriate, where is it not, and what criteria determine the distinction?
- Your order processing Saga has a bug in the payment compensation: it's sometimes issuing double refunds. Walk through how you would diagnose this, reproduce it, and fix it without losing data consistency.
- Design the data architecture for a global banking platform: 100M accounts, 50B transactions over 10 years, regulatory requirement for 10-year transaction history with temporal queries, real-time fraud detection, and end-of-day balance reporting. Which patterns would you use and why?

---

## Summary

These three patterns solve the fundamental problem of data management in distributed systems: how to maintain business consistency when ACID transactions cannot span service boundaries.

- **Saga:** Replaces distributed transactions with a sequence of local transactions connected by domain events, with explicit compensating transactions for rollback. Choreography (event-driven, implicit flow) vs Orchestration (centralized state machine, explicit flow). Key requirement: all steps must be idempotent; compensations must be semantically correct forward actions.
- **Outbox Pattern:** Guarantees atomic event publication by writing events to an outbox table in the same database transaction as state changes. A relay (polling or Debezium CDC) publishes from outbox to Kafka. Foundation for Saga reliability.
- **CQRS:** Separates write model (normalized, ACID, command-side) from read model (denormalized, optimized per query, query-side). Read model updated via event consumers. Consequence: eventual consistency window between write and read.
- **Event Sourcing:** Events are the source of truth; state is derived by replaying events. Provides complete audit trail, temporal queries, and rebuildable projections. Cost: append-only storage growth, schema evolution complexity, mindset shift from "update state" to "append events."
- **Idempotency is non-negotiable.** At-least-once event delivery means every handler will process duplicates. Without idempotency: duplicate charges, duplicate reservations, duplicate emails, phantom refunds.

---

## What You Should Now Be Able To Explain

- ✅ Why 2PC fails and why Sagas are the correct alternative (not a compromise)
- ✅ The exact flow of an Orchestration Saga including compensation state machine
- ✅ How the Outbox pattern closes the atomicity gap between DB write and Kafka publish
- ✅ Why compensation is a forward action (not a rollback) and what that means for idempotency
- ✅ The CQRS consistency contract: write model is consistent; read model is eventually consistent
- ✅ How Event Sourcing enables temporal queries (replay events up to timestamp T)
- ✅ Why projection lag under high event volume requires consumer parallelization + Kafka partitioning

---

## What To Learn Next

**Chapter 19 — Rate Limiting, Throttling, and Backpressure.** You now understand how services reliably process business operations across boundaries. Chapter 19 covers what happens when services are overwhelmed: rate limiting (client-level and service-level), throttling policies (token bucket, leaky bucket, sliding window), backpressure propagation (how downstream slowness signals upstream producers to slow down), and load shedding (the decision to drop requests gracefully rather than fail catastrophically). The chapter where "my service fell over under load" becomes "my service degrades predictably and recovers automatically."
