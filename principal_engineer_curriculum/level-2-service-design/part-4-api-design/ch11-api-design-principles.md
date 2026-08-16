# Chapter 11 — API Design Principles

## Difficulty
Intermediate → Advanced

## Importance
**Must Know** — APIs are the contracts between systems. Every microservice is defined by its API: it is the boundary between what you own and what others depend on. A well-designed API is stable for years and enables rapid integration. A poorly designed API becomes a source of breaking changes, consumer bugs, and internal architecture lock-in. Principal Engineers set API standards for their organizations, review APIs before they ship, and catch design errors that are expensive to fix once clients depend on them.

## Prerequisites
Chapter 3 — Network Layers, TCP & UDP (HTTP fundamentals)
Chapter 4 — DNS, HTTP & TLS (HTTP/2, status codes, headers)
Chapter 8 — Consistency, Consensus (idempotency, exactly-once)
Chapter 9 — Failure Modes (timeouts, retries, circuit breakers)

## Learning Objectives

By the end of this chapter you will be able to:

1. Explain the principles of REST and apply them correctly — including the specific constraints that make an API truly RESTful vs merely HTTP.
2. Design resource-oriented APIs with correct HTTP verbs, status codes, and URL hierarchies.
3. Implement idempotency — why it is necessary, how idempotency keys work, and how to build an idempotent endpoint.
4. Design for backward compatibility and versioning — never break existing clients.
5. Compare REST, GraphQL, and gRPC: the problem each solves, its trade-offs, and when to use each.
6. Design pagination, filtering, and sorting for collection endpoints.
7. Handle errors correctly — error response schema, error codes, human-readable messages.
8. Explain what makes an API contract — and how to enforce it with schema validation and consumer-driven contract testing.

## Why This Matters

Imagine shipping an API endpoint that returns a JSON field named `totalCost`. Six months later, you discover you need to rename it to `totalAmount` to match your data model. You cannot — 200 external integrations depend on `totalCost`. The field is now permanent. You are paying the cost of that single naming decision for years.

Or: a mobile app calls `DELETE /users/{id}` and the server processes the delete, but the response is lost in a network flicker. The mobile app retries. If `DELETE /users/{id}` is not idempotent, the user is deleted twice — which may throw a 404 on the retry, leaving the client uncertain whether the delete succeeded. This causes a support ticket and a bug investigation.

API design decisions have a uniquely long half-life. A database schema can be migrated. An internal data structure can be refactored. An API that external clients depend on is nearly immutable. Getting it right requires deliberate design.

---

## Mental Model

> **An API is a contract, not an implementation. The contract specifies what inputs are accepted, what outputs are produced, and what guarantees are made about behavior. The implementation can change freely as long as the contract is honored. Good API design means making a contract that is expressive enough for clients to do what they need, stable enough to avoid breaking changes, and constrained enough that you can evolve the implementation. Every API decision is a decision about what you are committing to forever.**

---

## Intuition

Think of an API like a restaurant menu.

**The menu (API contract):** Specifies what you can order (endpoints), what you need to provide (request parameters), what you'll receive (response schema), and what can go wrong ("nut allergy warnings" = error codes). The kitchen (implementation) can change its recipes, suppliers, and cooking methods freely as long as the food you receive matches the menu description.

**Backward compatibility:** If the restaurant removes a dish from the menu, diners who expected it are disappointed — a breaking change. But if they add new dishes, no existing diners are affected — backward compatible.

**Idempotency:** If you accidentally submit the same order twice (network glitch, double-click), a good restaurant recognizes it's the same order and serves you once. A bad restaurant serves you twice and charges you twice.

**Versioning:** If the menu fundamentally changes (restaurant switches from Italian to Japanese), they don't change the current menu — they open a new menu (v2) and keep the old one for loyal customers still expecting Italian food.

---

## Visual Explanation

### REST Resource Hierarchy

```
Resource Hierarchy: Order Management System

Base URL: https://api.example.com/v1

Collections (nouns, plural):
  /orders                              ← all orders
  /orders/{orderId}                    ← specific order
  /orders/{orderId}/items              ← items in a specific order
  /orders/{orderId}/items/{itemId}     ← specific item in a specific order
  /users                               ← all users
  /users/{userId}/orders               ← orders belonging to a specific user

HTTP verb → action matrix:
┌─────────────┬─────────────────────┬──────────────────────────────────────┐
│ HTTP Verb   │ Collection /orders  │ Resource /orders/{id}                │
├─────────────┼─────────────────────┼──────────────────────────────────────┤
│ GET         │ List orders         │ Get a specific order                 │
│ POST        │ Create a new order  │ ✗ (id is server-assigned)           │
│ PUT         │ ✗ (replace all?)   │ Replace the full order resource      │
│ PATCH       │ ✗                  │ Partially update the order           │
│ DELETE      │ ✗ (delete all?)    │ Delete the order                     │
└─────────────┴─────────────────────┴──────────────────────────────────────┘

State transitions (not CRUD):
  POST /orders/{id}/cancel             ← state transition action
  POST /orders/{id}/fulfill            ← state transition action
  POST /payments/{id}/refund           ← state transition action
  (These are verbs, but modeled as POSTs to a sub-resource noun)
```

### HTTP Status Code Decision Tree

```
Request received → Is the request syntactically valid?
  No → 400 Bad Request (malformed JSON, missing required field)
  Yes → Is the client authenticated?
    No → 401 Unauthorized (missing/invalid auth token)
    Yes → Is the client authorized for this resource?
      No → 403 Forbidden (authenticated but lacks permission)
      Yes → Does the resource exist?
        No (GET/PUT/PATCH/DELETE) → 404 Not Found
        Yes (for PUT/PATCH: does the update conflict?) → 409 Conflict
        Yes → Process the request → Did it succeed?
          Yes (created) → 201 Created (with Location header)
          Yes (async)   → 202 Accepted (processing in background)
          Yes (no body) → 204 No Content (DELETE, some PUTs)
          Yes (body)    → 200 OK
          Server error  → 500 Internal Server Error
          Overloaded    → 503 Service Unavailable (with Retry-After)
          Rate limited  → 429 Too Many Requests (with Retry-After)
```

---

## Core Concepts

### 1. REST — The Real Constraints

REST (Representational State Transfer, Fielding, 2000) is often misunderstood as "use HTTP with JSON." It is an architectural style with six specific constraints:

1. **Client-Server:** Separation of concerns — the UI and data storage evolve independently.
2. **Stateless:** Each request contains all information needed to process it. The server stores no session state between requests. (Authentication via token, not session cookie.)
3. **Cacheable:** Responses must declare whether they are cacheable. This enables CDN caching, browser caching, and gateway caching.
4. **Uniform Interface:** The defining constraint. Four sub-constraints:
   - **Resource identification:** Resources identified by URIs (`/orders/123`)
   - **Resource manipulation through representations:** Clients manipulate resources through their representations (JSON/XML), not direct resource access
   - **Self-descriptive messages:** Each message includes enough information to describe how to process it (Content-Type, Accept headers)
   - **HATEOAS:** Hypermedia As The Engine Of Application State — responses include links to related actions/resources
5. **Layered System:** Client can't tell if it's talking to the server or a proxy/load balancer. Enables CDNs, gateways, and caches transparently.
6. **Code-on-Demand (optional):** Servers can send executable code (JavaScript) to clients.

**What most "REST" APIs violate:**
- **Stateless:** Storing pagination cursor server-side per session → NOT REST
- **HATEOAS:** Not including `links` in responses to enable navigation without out-of-band documentation
- **Cacheable:** Not setting `Cache-Control` headers → caching behavior undefined

A "RESTful API" in practice usually means: HTTP + JSON + resource-oriented URLs + correct use of verbs and status codes. Full REST (including HATEOAS) is rare in microservices — the pragmatic subset is valuable, the HATEOAS part is optional for most systems.

### 2. Resource Design — The Foundation

**Rule 1: Nouns, not verbs (for standard CRUD).**
```
BAD (RPC-style):
  POST /getUser?userId=123
  POST /createOrder
  POST /deleteOrder?orderId=456
  POST /updateOrderStatus

GOOD (Resource-oriented):
  GET    /users/123
  POST   /orders
  DELETE /orders/456
  PATCH  /orders/456  {status: "cancelled"}
```

**Rule 2: Plural nouns for collections.**
```
BAD:  /user/123
GOOD: /users/123
```
Collections are plural because `/users` represents the collection and `/users/123` a member of it. Consistent pluralization makes the hierarchy immediately readable.

**Rule 3: Use sub-resources for relationships, not query parameters.**
```
BAD:  GET /orders?userId=123
GOOD: GET /users/123/orders

(Exception: filtering a collection: GET /orders?status=pending is correct — 
 filtering the /orders collection by status attribute)
```

**Rule 4: Modeling state transitions.**

Not everything is CRUD. "Cancel an order" is not a PUT on the order with `status: cancelled` — that leaks state machine knowledge to the client (they must know valid transitions). Instead:
```
POST /orders/{id}/cancel      ← explicit state transition
POST /orders/{id}/fulfill     ← explicit state transition
POST /payments/{id}/refund    ← explicit state transition
```

The server enforces valid transitions; the client calls an action. If the cancellation is invalid (order already shipped), the server returns 409 Conflict with a clear error body.

**Rule 5: Resource IDs — use opaque identifiers.**
```
BAD:  /orders/2024-01-15-user-789-seq-42  ← encodes business logic in ID
GOOD: /orders/01HQBVZ3KX9Y8FMNP7CGQRST4E  ← ULID (opaque, sortable)

Opaque IDs let you change the underlying storage/sequence without breaking URLs.
Semantic IDs create a contract around internal structure.
```

### 3. HTTP Verbs — The Full Semantics

Each HTTP verb carries specific semantic guarantees beyond just "what operation it does":

| Verb | Safe? | Idempotent? | Meaning |
|------|-------|-------------|---------|
| GET | ✅ Yes | ✅ Yes | Retrieve — no side effects |
| HEAD | ✅ Yes | ✅ Yes | Retrieve headers only |
| OPTIONS | ✅ Yes | ✅ Yes | Discover allowed methods (CORS preflight) |
| POST | ❌ No | ❌ No | Create / trigger action (submitting same form twice = two records) |
| PUT | ❌ No | ✅ Yes | Replace entire resource (submitting same PUT twice = same result) |
| PATCH | ❌ No | ❌ Depends | Partial update (may or may not be idempotent depending on semantics) |
| DELETE | ❌ No | ✅ Yes | Remove resource (DELETE /orders/123 twice = resource gone after first, 404 after second but same final state) |

**Safe:** A safe method does not modify server state. Browsers can call safe methods freely (e.g., prefetch links). Non-safe methods require user intent.

**Idempotent:** Applying the same operation N times produces the same result as applying it once. Critical for retry safety.

```
PUT /orders/123 {status: "cancelled"}
  First call: order cancelled → 200
  Second call (retry): order still cancelled → 200 (same state, idempotent)

PATCH /orders/123 {items: [{action: "append", productId: "p456"}]}
  First call: item added → 200
  Second call (retry): item added AGAIN → 200 (two items, NOT idempotent!)

PATCH /orders/123 {items: [{productId: "p456", quantity: 2}]}
  First call: item set to quantity 2 → 200
  Second call (retry): item still quantity 2 → 200 (idempotent, set semantics)
```

The semantics of PATCH depend entirely on what the patch operation means — "increment by 1" is not idempotent; "set to 5" is.

### 4. Idempotency — The Most Critical API Property

**Why idempotency is required:** Networks are unreliable (Chapter 3). A client cannot know if a request was received and processed when the response is lost. Without idempotency, the client must choose between: not retrying (risk of lost operation) or retrying (risk of duplicate operation). With idempotency, retrying is always safe.

**Idempotency keys (Stripe's model):**
```
Client generates a unique key for each logical operation:
  POST /payments
  Headers: Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
  Body: {amount: 99.99, currency: "USD", customerId: "c789"}

Server behavior:
  1. Receive request with Idempotency-Key
  2. Check idempotency store (Redis, DB): has this key been processed?
     NO: Process payment, store {key: result, timestamp} in idempotency store
         Return: 201 Created, {paymentId: "p123", status: "succeeded"}
     YES (already processed): Return the SAME response from the store
         Return: 201 Created, {paymentId: "p123", status: "succeeded"}
         (Exactly the same response, no second charge)
     IN-FLIGHT (being processed now): Return 409 Conflict or wait/retry

Implementation:
  key TTL: 24 hours (after which a new payment with same key is valid)
  Storage: Redis SETNX (set-if-not-exists, atomic)
  
Redis implementation:
  SET payment:{idempotency_key} {serialized_response} NX EX 86400
  NX: only set if not exists (atomic check-and-set)
  EX: 24-hour TTL
```

**What to store in the idempotency record:**
```json
{
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000",
  "requestHash": "sha256-of-request-body",
  "responseStatus": 201,
  "responseBody": {"paymentId": "p123", "status": "succeeded"},
  "createdAt": "2024-01-15T14:32:00Z",
  "expiresAt": "2024-01-16T14:32:00Z"
}
```

**Validating request consistency:** If the client sends the same idempotency key with a *different* request body (different amount), it's a client bug. Return 422 Unprocessable Entity with a clear error.

**CRITICAL: Idempotency key isolation by client.** Different clients must not share idempotency keys — key must be namespaced by `clientId` or `apiKey`:
```
Redis key: payment:{apiKey}:{idempotency_key}
Not:       payment:{idempotency_key}  (collision between different clients)
```

### 5. Request and Response Design

#### Request Design

**Use the request body for complex input (POST/PUT/PATCH):**
```json
POST /orders
Content-Type: application/json

{
  "customerId": "c789",
  "items": [
    {"productId": "p123", "quantity": 2, "unitPrice": 29.99},
    {"productId": "p456", "quantity": 1, "unitPrice": 49.99}
  ],
  "shippingAddress": {
    "street": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94105",
    "country": "US"
  },
  "paymentMethodId": "pm789"
}
```

**Use query parameters for filtering, sorting, pagination:**
```
GET /orders?status=pending&customerId=c789&sortBy=createdAt&order=desc&page=2&limit=25
```

**Avoid boolean query parameters — use enums:**
```
BAD:  GET /orders?includeItems=true
GOOD: GET /orders?expand=items
      (expandable: GET /orders?expand=items,payments,customer)
```

**Required vs Optional fields:** Document clearly. Use JSON Schema or OpenAPI specification:
```yaml
# OpenAPI 3.0
components:
  schemas:
    CreateOrderRequest:
      type: object
      required:
        - customerId
        - items
        - paymentMethodId
      properties:
        customerId:
          type: string
          description: "ID of the customer placing the order"
          example: "c789"
        items:
          type: array
          minItems: 1
          items:
            $ref: '#/components/schemas/OrderItem'
        couponCode:
          type: string
          description: "Optional promotional coupon code"
```

#### Response Design

**Consistent envelope (for collections):**
```json
GET /orders?status=pending&page=2&limit=25

{
  "data": [
    {"orderId": "o123", "status": "pending", "total": 79.98, "createdAt": "2024-01-15T14:30:00Z"},
    {"orderId": "o124", "status": "pending", "total": 149.99, "createdAt": "2024-01-15T14:31:00Z"}
  ],
  "pagination": {
    "page": 2,
    "limit": 25,
    "total": 147,
    "totalPages": 6,
    "hasNext": true,
    "hasPrev": true,
    "nextCursor": "eyJpZCI6Im8xMjQiLCJjcmVhdGVkQXQiOiIyMDI0LTAxLTE1VDE0OjMxOjAwWiJ9"
  },
  "links": {
    "self": "/orders?status=pending&page=2&limit=25",
    "next": "/orders?status=pending&cursor=eyJpZCI6Im8xMjQi...&limit=25",
    "prev": "/orders?status=pending&page=1&limit=25",
    "first": "/orders?status=pending&page=1&limit=25",
    "last": "/orders?status=pending&page=6&limit=25"
  }
}
```

**Single resource response (no envelope needed):**
```json
GET /orders/o123

{
  "orderId": "o123",
  "status": "pending",
  "customerId": "c789",
  "items": [...],
  "total": 79.98,
  "createdAt": "2024-01-15T14:30:00Z",
  "updatedAt": "2024-01-15T14:30:00Z"
}
```

**Include timestamps and version:**
```json
{
  "orderId": "o123",
  "createdAt": "2024-01-15T14:30:00.000Z",  ← ISO 8601 UTC with milliseconds
  "updatedAt": "2024-01-15T14:32:01.234Z",
  "version": 3                               ← optimistic locking version
}
```

### 6. Error Responses — The Contract for Failure

Error responses are as important as success responses. Clients must be able to handle errors programmatically.

**Error response schema (RFC 7807 — Problem Details for HTTP APIs):**
```json
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/problem+json

{
  "type": "https://api.example.com/errors/validation-failed",
  "title": "Validation Failed",
  "status": 422,
  "detail": "The request body contains invalid fields.",
  "instance": "/orders",
  "traceId": "abc123def456",
  "errors": [
    {
      "field": "items[0].quantity",
      "code": "QUANTITY_OUT_OF_RANGE",
      "message": "Quantity must be between 1 and 999",
      "rejectedValue": 0
    },
    {
      "field": "shippingAddress.zip",
      "code": "INVALID_ZIP_FORMAT",
      "message": "ZIP code must be 5 digits",
      "rejectedValue": "9410"
    }
  ]
}
```

**Error design principles:**
1. **Machine-readable error codes** (`QUANTITY_OUT_OF_RANGE`) — clients can handle specific errors programmatically
2. **Human-readable messages** — support engineers can understand without code
3. **Field-level errors** — indicate exactly which field is invalid (not just "validation failed")
4. **traceId** — every error response includes the trace ID so engineers can find the log context
5. **Stable error codes** — once published, `QUANTITY_OUT_OF_RANGE` is a permanent contract
6. **No stack traces in responses** — security risk (reveals implementation details)

**Common status code mistakes:**
```
BAD:
  200 OK {success: false, error: "Not found"}  ← abusing 200 for errors
  200 OK {error: "Unauthorized"}               ← should be 401
  500 Internal Server Error (for all errors)   ← masks client errors (4xx)

GOOD:
  404 Not Found {type: ".../resource-not-found", ...}
  401 Unauthorized {type: ".../authentication-required", ...}
  400 Bad Request {type: ".../invalid-request", ...}
```

### 7. Pagination — Offset vs Cursor

**Offset pagination:**
```
GET /orders?page=5&limit=25

SQL: SELECT * FROM orders ORDER BY created_at DESC LIMIT 25 OFFSET 100

Problems:
  - OFFSET 1000000 scans and discards 1,000,000 rows → slow at scale
  - If items are inserted/deleted between pages, items are skipped or duplicated
    (Page 3 may have different items by the time you request it vs when page 2 was fetched)
  - "Total count" query (COUNT(*)) is expensive on large tables

Use when: Small datasets, user-facing UIs that need "jump to page N" functionality.
```

**Cursor pagination (keyset pagination):**
```
GET /orders?limit=25&cursor=eyJpZCI6Im8xMjQiLCJjcmVhdGVkQXQiOiIyMDI0LTAxLTE1VDE0OjMxOjAwWiJ9

Cursor is base64-encoded position marker: {id: "o124", createdAt: "2024-01-15T14:31:00Z"}

SQL: SELECT * FROM orders 
     WHERE (created_at, id) < ('2024-01-15T14:31:00Z', 'o124')
     ORDER BY created_at DESC, id DESC
     LIMIT 25

Benefits:
  - O(log N) via index — no offset scan
  - Stable: insertions/deletions don't affect pagination
  - Consistent: cursor encodes position, not page number

Problems:
  - Cannot jump to arbitrary page ("show me page 5")
  - Cursor becomes invalid if sort order changes
  - Slightly more complex client implementation

Use when: Large datasets, infinite scroll, APIs, feed-style pagination.

Cursor encoding: base64(JSON({createdAt, id})) → opaque to clients, server controls format
```

**Filtering and Sorting:**
```
Simple filters:
  GET /orders?status=pending&customerId=c789

Multi-value filters:
  GET /orders?status=pending,fulfilled  (comma-separated)
  GET /orders?status[]=pending&status[]=fulfilled  (array notation)

Range filters:
  GET /orders?createdAfter=2024-01-01T00:00:00Z&createdBefore=2024-01-31T23:59:59Z
  GET /orders?total[gte]=100&total[lte]=500  (comparison operators)

Sorting:
  GET /orders?sortBy=createdAt:desc,total:asc
  (multi-field sort with direction per field)

Full-text search (separate endpoint or parameter):
  GET /orders/search?q=laptop&status=pending
```

### 8. Versioning — Never Break Clients

**When a breaking change is inevitable:**
```
Breaking changes (require new version):
  - Removing a field from the response
  - Renaming a field (totalCost → totalAmount)
  - Changing a field's type (string → integer)
  - Changing the meaning of a field
  - Removing an endpoint
  - Adding a required field to a request
  - Changing URL structure
  - Changing status codes for existing situations

Non-breaking changes (no new version needed):
  - Adding a new optional field to the response (clients ignore unknown fields)
  - Adding a new endpoint
  - Adding optional query parameters
  - Adding new enum values (careful — clients that switch on enum may break)
  - Making a required field optional
```

**Versioning strategies:**

**URL versioning (most common, most visible):**
```
https://api.example.com/v1/orders
https://api.example.com/v2/orders

Pros:  Simple, explicit, easy to route at gateway
Cons:  URL is not supposed to change (REST violation)
       Requires maintaining multiple code versions
```

**Header versioning:**
```
GET /orders
Accept: application/vnd.example.v2+json
(or: API-Version: 2)

Pros:  Cleaner URLs, more REST-compliant
Cons:  Harder to test (need to set headers everywhere), less visible in browsers/logs
```

**Query parameter versioning:**
```
GET /orders?version=2

Pros:  Easy to test in browser
Cons:  Query parameter is for filtering, not versioning semantics — mixed concerns
```

**When to version:**
```
V1: Original API (ship)
    → Add non-breaking features freely (no new version needed)
    → Accumulate breaking change backlog
    
V2: Ship when breaking changes are required
    → Support V1 for 12-18 months (sunset notice)
    → Provide migration guide V1 → V2
    → Track V1 usage via metrics (deprecation-header, usage counters)
    → Deprecation header in V1 responses:
       Deprecation: Sat, 31 Dec 2024 23:59:59 GMT
       Sunset: Sat, 31 Dec 2024 23:59:59 GMT
       Link: <https://api.example.com/v2/orders>; rel="successor-version"
```

**Practical versioning advice:** Version as late as possible and as rarely as possible. Add version only when a breaking change is truly unavoidable. Use internal feature flags to test new behavior before committing it to the API contract.

### 9. REST vs GraphQL vs gRPC

These are not competing technologies — they solve different problems.

#### REST

**Best for:**
- Public APIs consumed by unknown clients
- Simple CRUD resources with standard access patterns
- Clients that need HTTP caching (REST responses are cacheable; GraphQL is not)
- Widely understood by all HTTP clients

**Limitations:**
- Over-fetching: GET /users/123 returns 50 fields, client needs 3
- Under-fetching: Need user + orders + payments → 3 separate requests
- No native real-time support

#### GraphQL

**Best for:**
- Complex frontends with varied data needs (different pages need different subsets of data)
- Reducing round trips (fetch user + orders + payments in one query)
- Teams where the frontend moves faster than the backend schema

**How it works:**
```graphql
# Client specifies exactly what it needs:
query GetOrderSummary($userId: ID!) {
  user(id: $userId) {
    name
    email
    orders(last: 5, status: PENDING) {
      orderId
      total
      createdAt
      items {
        productName
        quantity
      }
    }
  }
}

# Response contains exactly what was requested — no extra fields, no missing fields
# One HTTP request, structured exactly for this UI component
```

**GraphQL trade-offs:**

| Aspect | GraphQL |
|--------|---------|
| Over-fetching | ✅ Eliminated (client specifies fields) |
| Under-fetching | ✅ Eliminated (join across types in one query) |
| Caching | ❌ Hard (HTTP caching breaks — all queries are POST /graphql) |
| Rate limiting | ❌ Hard (a single query can be arbitrarily complex — query cost analysis needed) |
| API discovery | ✅ Schema is self-documenting (introspection) |
| Error handling | ⚠️ Complex (partial success: 200 OK with `errors` array) |
| N+1 problem | ⚠️ Requires DataLoader (batch + cache DB calls per request) |

**GraphQL N+1 problem:**
```graphql
query {
  orders {        # 1 query: SELECT * FROM orders LIMIT 25
    customer {    # 25 queries: SELECT * FROM users WHERE id=? (one per order!)
      name
    }
  }
}
# Total: 26 DB queries for 25 orders → N+1
# Fix: DataLoader batches: SELECT * FROM users WHERE id IN (u1, u2, ..., u25) → 1 query
```

#### gRPC

**Best for:**
- Internal service-to-service communication (microservices backend)
- High-throughput, low-latency communication
- Streaming (bidirectional real-time data)
- Strongly typed contracts enforced at compile time

**How it works:**
```protobuf
// orders.proto
syntax = "proto3";

service OrderService {
  rpc GetOrder (GetOrderRequest) returns (Order);
  rpc ListOrders (ListOrdersRequest) returns (stream Order);  // server streaming
  rpc CreateOrder (CreateOrderRequest) returns (CreateOrderResponse);
}

message Order {
  string order_id = 1;
  string customer_id = 2;
  repeated OrderItem items = 3;
  double total = 4;
  google.protobuf.Timestamp created_at = 5;
  OrderStatus status = 6;
}

enum OrderStatus {
  ORDER_STATUS_UNSPECIFIED = 0;
  ORDER_STATUS_PENDING = 1;
  ORDER_STATUS_FULFILLED = 2;
  ORDER_STATUS_CANCELLED = 3;
}
```

**gRPC trade-offs:**

| Aspect | gRPC |
|--------|------|
| Protocol | HTTP/2 + Protocol Buffers (binary, ~5× smaller than JSON) |
| Performance | ✅ ~10× faster than REST/JSON for same operation |
| Type safety | ✅ Schema enforced at compile time (break builds, not runtime) |
| Browser support | ❌ Requires gRPC-Web proxy (browsers can't speak raw HTTP/2) |
| Human-readability | ❌ Binary protocol (need grpcurl or reflection for debugging) |
| Streaming | ✅ Native bidirectional streaming |
| Code generation | ✅ Generated clients in 12+ languages from .proto |

**When to use each:**
```
External API (web/mobile clients):  REST or GraphQL
  - REST: simple resources, standard CRUD
  - GraphQL: complex frontend data needs, mobile app with varied screens

Internal service-to-service:  gRPC
  - High throughput
  - Strongly typed internal contracts
  - Streaming use cases

Real-time push to browser:  WebSocket or SSE (Server-Sent Events)
  - gRPC-Web for browser → gRPC gateway

Mixed architecture:
  Edge: API Gateway translates REST/GraphQL → gRPC internally
  (Client speaks REST; services speak gRPC; gateway translates)
```

### 10. API Contract Testing

The API contract is only as good as the tests that enforce it. **Consumer-driven contract testing (CDC)** verifies that:
1. The provider (the API) honors the contracts that its consumers expect.
2. The consumer (the client) uses the API as documented.

**Pact (the CDC testing framework):**
```
Consumer (frontend):
  Defines a "pact" — the API calls it makes and what responses it expects:
  
  // Consumer test (JavaScript):
  const interaction = {
    request: { method: 'GET', path: '/orders/o123' },
    response: {
      status: 200,
      body: {
        orderId: like('o123'),       // matches any string
        status: term({ matcher: 'pending|fulfilled|cancelled', generate: 'pending' }),
        total: like(79.98)           // matches any number
      }
    }
  };
  
Provider (backend):
  Runs the pact against the real API:
  // Provider test (Java):
  @PactVerification(value = "order-consumer", pactLocation = "pacts/")
  @Test
  public void verifyOrderGetPact() {
    // Pact runner sends the consumer's request to the real API
    // and verifies the response matches the pact
  }
```

**Contract testing vs Integration testing:**
- Integration testing: "Does A talking to B work end-to-end?" (both must be running)
- Contract testing: "Does A's expectation match what B provides?" (can run independently)
- Contract testing catches breaking changes before deployment — the provider build fails if it would break a consumer.

---

## Step-by-Step Execution

### Designing a New API Endpoint — The Checklist

```
Requirement: "Users should be able to see their past orders with filtering and pagination."

Step 1: Identify the resource:
  Resource: orders (collection)
  Ownership: /users/{userId}/orders or /orders?userId={userId}
  Decision: /users/{userId}/orders (user is the primary context; ownership is explicit)

Step 2: Choose verb and status codes:
  GET /users/{userId}/orders → 200 OK
  If user doesn't exist: 404 Not Found
  If requester isn't the user (or admin): 403 Forbidden

Step 3: Design query parameters:
  status:       ?status=pending,fulfilled
  date range:   ?createdAfter=2024-01-01T00:00:00Z&createdBefore=2024-01-31T23:59:59Z
  sort:         ?sortBy=createdAt:desc (default)
  pagination:   ?limit=25&cursor=<opaque-cursor>

Step 4: Design response:
  {
    "data": [{orderId, status, total, itemCount, createdAt}],  ← summary fields only
    "pagination": {limit, hasNext, nextCursor},
    "links": {self, next}
  }
  Note: don't include full order items (N items × M orders = large payload)
  Use ?expand=items if needed.

Step 5: Design errors:
  400: invalid status value (not in enum)
  400: invalid date format
  404: user not found
  403: not authorized to view this user's orders

Step 6: Define idempotency:
  GET: naturally idempotent. No idempotency key needed.

Step 7: Document with OpenAPI:
  Add to orders.yaml: paths, schemas, parameters, responses, examples

Step 8: Add to contract tests:
  Consumer pact: test the fields the frontend uses
  Provider pact verification: add to CI pipeline
```

---

## Deep Dive

### OpenAPI Specification — The Industry Standard

OpenAPI (formerly Swagger) is the machine-readable API contract standard. It enables:
- Auto-generated documentation (Swagger UI, Redoc)
- Auto-generated client SDKs (OpenAPI Generator)
- API gateway configuration (AWS API Gateway, Kong)
- Contract testing (Dredd, Schemathesis)
- Mock server generation (Prism)

```yaml
openapi: 3.0.3
info:
  title: Order Management API
  version: 1.0.0
  description: API for managing customer orders

paths:
  /users/{userId}/orders:
    get:
      operationId: listUserOrders
      summary: List orders for a user
      parameters:
        - name: userId
          in: path
          required: true
          schema: {type: string}
        - name: status
          in: query
          schema:
            type: array
            items:
              type: string
              enum: [pending, fulfilled, cancelled]
          style: form
          explode: false
        - name: limit
          in: query
          schema: {type: integer, minimum: 1, maximum: 100, default: 25}
        - name: cursor
          in: query
          schema: {type: string, description: "Opaque pagination cursor"}
      responses:
        '200':
          description: List of orders
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/OrderListResponse'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
```

**API-first development:** Write the OpenAPI spec BEFORE writing the implementation. This forces design thinking early, enables parallel frontend/backend development, and creates a living contract that both sides can validate against.

### Rate Limiting Design

Every public API must have rate limiting — clients must not be able to overwhelm the service.

**Rate limiting algorithms:**

**Fixed window:**
```
Window: 1 minute
Limit: 100 requests per window
Client at :00 → :59: 100 requests consumed
Client at :01: window resets → 100 more requests

Problem: burst at window boundary
  Client sends 100 requests at :59
  Window resets at :00
  Client sends 100 more requests at :01
  = 200 requests in 2 seconds (burst at boundary)
```

**Sliding window log:**
```
Track timestamp of every request in a log.
Count requests in the last 60 seconds (rolling).
More accurate, but higher memory (stores each request timestamp).
```

**Token bucket (recommended):**
```
Bucket capacity: 100 tokens
Refill rate: 100 tokens/minute (1.67 tokens/second)
Each request consumes 1 token.
If bucket empty: request rejected with 429.
Allows bursts up to bucket capacity (100), then smoothed to refill rate.
```

**Rate limit response:**
```
HTTP/1.1 429 Too Many Requests
Content-Type: application/problem+json
Retry-After: 37           ← seconds until next request allowed
X-RateLimit-Limit: 100    ← requests per window
X-RateLimit-Remaining: 0  ← remaining in current window
X-RateLimit-Reset: 1705329421  ← Unix timestamp when window resets

{
  "type": "https://api.example.com/errors/rate-limit-exceeded",
  "title": "Rate Limit Exceeded",
  "status": 429,
  "detail": "You have exceeded 100 requests per minute. Retry after 37 seconds."
}
```

---

## Real-World Example

### Stripe's API Design Principles

Stripe's API is widely considered the gold standard for API design. Key principles they follow:

**1. Idempotency keys on all mutating operations:**
```
POST /v1/charges
Idempotency-Key: {UUID generated by client per logical operation}
```

**2. Consistent resource structure:**
```json
{
  "id": "ch_1NqPUF2eZvKYlo2CIPhLnF3k",
  "object": "charge",                ← object type in every response
  "amount": 2000,
  "currency": "usd",
  "created": 1695196800,             ← Unix timestamp (Stripe chose int over ISO 8601)
  "livemode": false,
  "metadata": {}                     ← extensible, client-controlled key-value pairs
}
```

**3. Expandable nested objects:**
```
GET /v1/charges/ch_123
→ {customer: "cus_123"}  (just the ID by default)

GET /v1/charges/ch_123?expand[]=customer
→ {customer: {id: "cus_123", name: "Alice", email: "alice@example.com"}}
(expand pattern: request the detail you need, avoid over-fetching by default)
```

**4. Explicit API versioning via header, not URL:**
```
Stripe-Version: 2023-10-16
```
Stripe stores the API version you used at account creation and pins your integration to that version. Breaking changes only affect newly opted-in versions. Your 2018 integration keeps working with the 2018 API semantics forever.

---

## Failure Scenarios

### Scenario 1: Missing Idempotency Key Causes Double Charge

```
Payment flow: Mobile app → API → Payment Service → Stripe

User taps "Pay $99.99" button.
Mobile app: POST /payments {amount: 99.99, methodId: "pm789"}
Network: request arrives at server, processes payment, charges card.
Network: response (201 Created, paymentId: "p123") lost in transit.
Mobile app: timeout → user sees "Payment failed. Try again?"
User: taps "Try again."
Mobile app: retries POST /payments {amount: 99.99, methodId: "pm789"}
Server: no idempotency key → creates new payment → charges card again.

Result: User charged $199.98 for one purchase.
Support tickets, chargebacks, lost customer trust.

Fix:
  Mobile app generates idempotency key at the start of the checkout flow:
    key = UUID() stored in local session for this order
  All retries use the SAME key:
    POST /payments
    Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
  Server: second request with same key → returns cached success response.
  User: payment shows succeeded. One charge. Correct.
```

### Scenario 2: Breaking Change Without Versioning

```
API v1: GET /users/{id} returns:
  {"userId": "u123", "fullName": "Alice Smith", "emailAddress": "alice@example.com"}

Backend refactor: rename fields to match internal model:
  {"id": "u123", "name": "Alice Smith", "email": "alice@example.com"}

Deploy: same endpoint, same version.
Result: all clients that read "userId", "fullName", "emailAddress" silently break.
  - Mobile app crashes (NullPointerException on userId.length())
  - Third-party integration fails (webhook payload schema changed)
  - Internal dashboard shows blank user names

Root cause: treated the API as an internal implementation detail, not a contract.
Fix: cannot fix quickly — must roll back the rename, keep both field names in
     transition, or version the API and migrate clients over weeks/months.

Lesson: Never deploy a breaking change to a published API without a version bump.
        "But we control all the clients" — famous last words. Teams forget integrations.
```

---

## Trade-offs

| Decision | Benefit | Cost |
|----------|---------|------|
| URL versioning | Simple, explicit, easy to route | Cluttered URLs, REST purists object |
| Header versioning | Cleaner URLs | Harder to test and observe |
| Cursor pagination | Stable, fast at scale | Cannot jump to page N |
| Offset pagination | Jump to any page | Slow at high offset, unstable |
| Idempotency keys | Safe retry, exactly-once semantics | Storage cost, TTL management |
| REST | Universal support, HTTP caching | Over/under-fetching |
| GraphQL | Precise fetching, one trip | No HTTP caching, complex rate limiting |
| gRPC | High performance, type safety | No browser native support, binary |
| Strict validation | Catch errors early | May reject valid future inputs |
| Loose validation | Forward compatible | May accept bad data silently |

---

## Production Considerations

1. **Publish an OpenAPI spec for every API.** Machine-readable contracts enable auto-generated docs, client SDKs, and contract tests. Without a spec, the API is defined by its implementation — subject to accidental change.
2. **Make all mutating endpoints idempotent with explicit idempotency keys.** This applies to payments, order creation, inventory updates — any operation where duplicate execution causes harm.
3. **Implement rate limiting on every public endpoint.** Without it, a misbehaving client (or attacker) can take down your service for all other clients.
4. **Version your API before you need to.** Starting at `/v1` from day one costs nothing. Not having a version and needing to add one is a disruptive migration.
5. **Track API deprecation metrics.** When you deprecate an endpoint/version, measure who is still calling it. `api_calls_by_version{version="v1"}` in Prometheus. Sunset only when usage reaches near-zero.
6. **Return `Retry-After` on all 429 and 503 responses.** Clients without `Retry-After` will retry immediately (worsening the overload). With it, they back off correctly.

---

## Common Beginner Mistakes

1. **Using GET for state-changing operations** (`GET /deleteOrder?id=123`). GET requests are cached, logged, and bookmarked. A state-changing GET causes unintended mutations.
2. **Returning 200 OK for errors** with an error message in the body. HTTP status codes are machine-readable. Clients check status before parsing body. 200 with an error body means clients don't know it failed.
3. **Using verbs in URLs** (`POST /createOrder`, `GET /getUser`). The HTTP verb carries the action; the URL names the resource. `POST /orders` is more consistent, cacheable, and expressive.
4. **Not including the traceId in error responses.** When a user reports "I got an error," you need to find the corresponding log. Without traceId in the error body, you're grepping by approximate timestamp and hoping.

---

## Common Senior Engineer Mistakes

1. **Not considering the idempotency story for every mutating endpoint.** "Our clients don't retry" — they do, under network failures. Design for retry from the start.
2. **Exposing internal data model structure in the API.** When the database table is renamed or restructured, the API must change too. Design the API resource model independently of the database schema. The API is a stable abstraction; the DB is an implementation detail.
3. **GraphQL without query cost analysis.** A single GraphQL query can fetch arbitrary amounts of data (`orders { items { product { reviews { author { orders {...} } } } } }`). Without query depth limits and cost analysis, a single malformed query can OOM the server.
4. **Implementing pagination with `OFFSET` for large datasets.** Offset scanning 1 million rows to return rows 1,000,001-1,000,025 is a full sequential scan. At scale, this takes minutes and locks database resources. Cursor pagination avoids this entirely.

---

## Architecture Smells

- **All internal services using REST/JSON** — gRPC is 10× more efficient for internal communication; REST is for external clients
- **No OpenAPI spec** — the contract exists only in the implementation; accidental breaking changes are inevitable
- **API returning database primary keys as strings like "42" or "user_42"** — leaks storage details, fragile if DB changes
- **Mutation endpoints with no idempotency** — guarantee of double-execution under network failure
- **GraphQL without DataLoader** — N+1 queries guaranteed for any nested collection query
- **No rate limiting on public endpoints** — one misbehaving client takes down all clients

---

## Principal Engineer Perspective

APIs are the most visible manifestation of your system's architecture. Good API design is the result of thinking deeply about:

1. **Who are the clients, and what do they actually need?** (Not what you want to expose — what they need to accomplish their goals.)
2. **What can change, and what must stay stable?** (The resource model should be stable for years; the implementation can change daily.)
3. **What failure modes exist, and how does the API communicate them?** (Errors are a contract too.)

**Setting API standards across an organization:**

At the Principal Engineer level, you don't design individual APIs — you design the standards that govern how all APIs in the organization are designed. This includes:
- API style guide (REST conventions, naming standards, error schema)
- OpenAPI template with required headers (security, versioning, correlation IDs)
- Linting rules (spectral rules that validate API specs in CI)
- Contract testing requirements (Pact must pass before merge)
- Deprecation policy (minimum 12 months notice, Sunset header required)

**The hardest API design question:** "Should we expose this?" Often the right answer to a client request for a new API field or endpoint is "not yet" — until you understand the access pattern well enough to design it correctly. Adding a field is easy. Removing one is a breaking change. When in doubt, start conservative (fewer fields, more opaque IDs) and expand based on real client needs.

---

## Architecture Review Questions

1. Does every endpoint have an OpenAPI spec? Is it validated in CI?
2. Are all mutating endpoints idempotent? Do they accept idempotency keys?
3. What is the pagination strategy for collection endpoints? Is cursor pagination used for large collections?
4. Is there a versioning strategy? Are all endpoints versioned from day one?
5. Do error responses include machine-readable error codes, field-level detail, and traceId?
6. Is there rate limiting on public endpoints? Does it return `Retry-After`?
7. Are internal service-to-service APIs using gRPC or REST? (If REST: why not gRPC?)
8. For GraphQL APIs: is there query depth limiting and cost analysis? Is DataLoader used?
9. Are breaking changes tracked? Is there a deprecation process with Sunset headers and usage metrics?
10. Are consumer-driven contract tests (Pact) enforced in CI for all API integrations?

---

## Visual / Animation Specification

### Animation 1: Idempotency Key Flow

**Four participants: Client, Network (unreliable), API Server, Idempotency Store (Redis)**

**Attempt 1 (normal):**
Client generates key `key=abc`. Sends POST /payments with key header.
Server: checks Redis → key not found → processes payment → charges card.
Server: stores result in Redis (`key=abc → {status: 201, paymentId: p123}`).
Network: response packet shown as lightning bolt — drops in transit (X animation).
Client: timeout. Shows "Payment failed?" dialog.

**Attempt 2 (retry):**
Client sends same POST /payments with same `key=abc`.
Server: checks Redis → key FOUND → shows cache hit animation (green glow).
Server: returns cached response ({paymentId: p123, status: succeeded}) without processing payment again.
Client: shows "Payment succeeded!" with paymentId.

**Overlay:** "One charge. Two requests. Correct behavior."

### Animation 2: REST vs gRPC Performance

**Side-by-side comparison, same operation: GetUser(id=123)**

**REST (left side):**
Request animation: JSON text bytes scrolling past — "userId": "123", Content-Type: application/json, Accept: application/json, Authorization: Bearer... (many bytes shown)
Wire size label: "~850 bytes (headers + JSON body)"
Latency arrow: 12ms shown

**gRPC (right side):**
Request animation: compact binary bytes (compact block, no text).
Wire size label: "~120 bytes (HTTP/2 + Protocol Buffers binary)"
Latency arrow: 1.8ms shown

**Footer:** "gRPC: 7× smaller payload, ~6× lower latency. Use internally. Use REST for external clients."

---

## Hands-On Tutorial

### Designing and Documenting an API with OpenAPI

```bash
# Install Spectral (OpenAPI linter) and Prism (mock server)
npm install -g @stoplight/spectral-cli @stoplight/prism-cli

# openapi.yaml (start here before writing any code)
cat > openapi.yaml << 'EOF'
openapi: 3.0.3
info:
  title: Orders API
  version: 1.0.0

paths:
  /v1/orders:
    post:
      operationId: createOrder
      summary: Create a new order
      parameters:
        - name: Idempotency-Key
          in: header
          required: true
          schema: {type: string, format: uuid}
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateOrderRequest'
      responses:
        '201':
          description: Order created
          headers:
            Location:
              schema: {type: string}
              description: URL of the created order
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'
        '400':
          $ref: '#/components/responses/BadRequest'
        '409':
          $ref: '#/components/responses/Conflict'

components:
  schemas:
    CreateOrderRequest:
      type: object
      required: [customerId, items]
      properties:
        customerId: {type: string}
        items:
          type: array
          minItems: 1
          items:
            $ref: '#/components/schemas/OrderItem'
    Order:
      type: object
      properties:
        orderId: {type: string}
        status: {type: string, enum: [pending, fulfilled, cancelled]}
        total: {type: number}
        createdAt: {type: string, format: date-time}
  responses:
    BadRequest:
      description: Invalid request
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/ProblemDetail'
EOF

# Lint the spec
spectral lint openapi.yaml

# Start a mock server from the spec (before backend is built)
prism mock openapi.yaml
# → Mock server at http://localhost:4010
# → curl http://localhost:4010/v1/orders -X POST -H 'Content-Type: application/json' \
#          -H 'Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000' \
#          -d '{"customerId":"c123","items":[{"productId":"p1","quantity":1}]}'
```

```bash
# Validate response contract in CI (schemathesis)
pip install schemathesis
schemathesis run openapi.yaml --url http://localhost:8080
# Generates and sends test requests, validates responses against schema
# Catches: missing required fields, wrong types, undocumented status codes
```

---

## Failure Injection Lab

### Lab: Break and Fix a REST API Contract

1. **Setup:** Start an order API with a documented OpenAPI spec.
2. **Break:** Rename a response field: change `totalAmount` to `total` in the implementation but NOT in the OpenAPI spec.
3. **Detect:** Run `schemathesis run openapi.yaml` → observe it fails: "Response field 'totalAmount' expected, received 'total'."
4. **Fix (wrong way):** Update the OpenAPI spec to match the new field name. Now the spec says `total`. Run Pact consumer tests → all consumers that expected `totalAmount` fail.
5. **Fix (right way):**
   - Keep `totalAmount` in the response (backward compatible)
   - Add `total` as an alias (return both for transition)
   - Deprecate `totalAmount` in the spec with `deprecated: true`
   - After 90 days, once consumers migrate, remove `totalAmount`
6. **Lesson:** Changing an API field name is a 90+ day process. Design the name right the first time.

---

## Exercises

**Conceptual:**
1. What is the difference between REST's "uniform interface" constraint and simply "using HTTP"? Name two REST constraints that most so-called REST APIs violate.
2. A `PATCH /orders/{id}` endpoint applies an increment: `{quantity_increment: 1}`. Is this operation idempotent? What about `{quantity: 5}` (set operation)? Explain the difference.
3. What problem does cursor pagination solve that offset pagination cannot?
4. Explain the idempotency key pattern. What must happen on the server when the same key is received twice for a payment endpoint?
5. A company's internal services communicate via REST/JSON. A consultant recommends switching to gRPC. What are the three primary reasons to switch, and what is the primary reason NOT to switch for browser-facing APIs?

**Architecture:**
6. Design the REST API for a food delivery service. Define at least 5 resource types and their endpoints. Include a state machine for an order (placed → confirmed → preparing → out_for_delivery → delivered).
7. You have a GraphQL API that exposes `users { orders { items { product { category { ... } } } } }`. Users run arbitrarily deep queries. Write a query cost analysis policy: what limits would you impose?
8. The mobile app team wants to add a "reason" field to the `POST /orders/{id}/cancel` endpoint. How do you add this without a breaking change?

**Quantitative:**
9. Your API has a rate limit of 1,000 requests/minute. A client has 50 workers, each making 30 requests/second = 1,500 RPS. How many requests per minute will be rate-limited? What headers should the client use to back off correctly?
10. An idempotency key store uses Redis with 24-hour TTL. Your API processes 10,000 unique payments per hour. How many idempotency keys are stored in Redis at peak? At 1KB per key, what is the memory cost?

---

## Solutions

### Exercise 9
Client rate: 1,500 RPS × 60s = 90,000 requests/minute.
Limit: 1,000 requests/minute.
Rate-limited: 90,000 - 1,000 = **89,000 requests/minute** (98.9% rejected!).
Client must read `X-RateLimit-Remaining` and `Retry-After` headers.
Correct behavior: distribute 1,000 allowed requests evenly across 60 seconds = 16.7 RPS, not 1,500 RPS.

### Exercise 10
Keys stored = keys created in last 24 hours = 10,000/hour × 24 hours = **240,000 keys**.
Memory = 240,000 × 1 KB = **240 MB** (easily fits in Redis; typical Redis instance has 4-32 GB).
At peak load, this is negligible. Redis can hold millions of such keys in a few GB.

---

## Interview Questions

### Beginner
- What does REST stand for and what are its key principles?
- What is the difference between PUT and PATCH?
- What HTTP status codes would you return for: a resource not found, an unauthorized request, a successful creation?

### Senior
- Explain idempotency. Why does it matter for POST endpoints? How would you implement it?
- What is the difference between offset pagination and cursor pagination? When do you use each?
- Compare REST, GraphQL, and gRPC. When would you choose each?
- What makes a change to an API a "breaking change"?

### Staff
- Design the API for a ride-sharing service (Uber-like). Define the core resources, their endpoints, and state transitions for a ride.
- How would you implement rate limiting in an API gateway? What algorithm would you use and why?
- Walk through the consumer-driven contract testing workflow. How does it prevent breaking changes?
- What is the N+1 problem in GraphQL? How does DataLoader solve it?

### Principal
- Set API standards for an organization with 50 microservices. What conventions, tooling, and processes would you mandate? How would you enforce them?
- A client integration team reports that your API v1 is returning different data than documented in three fields. Diagnose how this could happen, and design a process to prevent it going forward.
- Design the API versioning strategy for a platform that must support external clients for 5+ years, internal microservices that change frequently, and a mobile app that cannot be forced to update.

---

## Summary

API design is the discipline of making contracts that are expressive, stable, and evolvable:

- **REST** is a set of architectural constraints (stateless, cacheable, uniform interface), not just HTTP + JSON. The practical subset: resource-oriented URLs, correct HTTP verbs, correct status codes, consistent error schema.
- **HTTP verbs carry semantics:** GET (safe + idempotent), PUT/DELETE (idempotent), POST (neither). Misuse breaks caching, retry safety, and client expectations.
- **Idempotency keys** are required for all mutating operations that must not execute twice. Implement with Redis SETNX + TTL, keyed by `clientId:idempotencyKey`.
- **Pagination:** Cursor-based for large datasets (stable, O(log N)); offset for small datasets or "jump to page" UX.
- **Versioning:** Start at v1 immediately. Break only when unavoidable. Sunset with 12+ months notice. Track usage with metrics.
- **Error responses:** RFC 7807 format, machine-readable codes, field-level detail, traceId. Never return 200 for errors.
- **REST vs GraphQL vs gRPC:** REST for public APIs, gRPC for internal service-to-service, GraphQL for complex frontend data needs. Often combined: REST/GraphQL edge + gRPC internal.
- **OpenAPI + contract testing** = the enforcement mechanism for API contracts. Lint in CI, run Pact against every provider before merge.

---

## What You Should Now Be Able To Explain

- ✅ The six REST constraints and which ones are commonly violated
- ✅ HTTP verb semantics — safe, idempotent, and their implications for retries
- ✅ How idempotency keys work end-to-end (client generates, server stores, returns cached result)
- ✅ Why cursor pagination is mandatory for large dataset APIs
- ✅ When to use REST vs GraphQL vs gRPC — with physics-based reasoning
- ✅ What constitutes a breaking change and how to version around it
- ✅ How consumer-driven contract tests catch breaking changes before deployment

---

## What To Learn Next

**Chapter 12 — SQL Databases at Scale.** You now know how to design the interfaces of services. Chapter 12 goes deep into the most common data persistence layer: relational databases. How do they handle transactions? What isolation levels exist and what anomalies do they prevent? How do you scale PostgreSQL from one instance to millions of users? What are the migration strategies for zero-downtime schema changes? This is where the storage engine theory from Chapter 7 meets the production realities of running SQL databases at scale.
