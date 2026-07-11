# 07 — Architectural Patterns

> The zoom-out from LLD. Sections `00`–`06` were about classes and objects; this is about how those
> classes are **organized into a whole application** so the domain stays pure and the edges (UI, DB,
> queues) stay swappable. Same forces as `01` (coupling, cohesion, dependency direction) — applied at
> the scale of a whole deployable.
>
> **Boundary with HLD:** this section is *intra-process* architecture (how one service is structured
> internally). *Inter-process* / distributed patterns — microservices, sagas, API gateways,
> distributed event sourcing — live in the `HLD/` track. The two meet at the seams.

## Learning objectives
By the end you can:
- State **the Dependency Rule** and use it to judge any architecture: dependencies point *inward*,
  toward stable business policy; the domain never imports the database or the framework.
- Draw and compare **Layered, Hexagonal (Ports & Adapters), and Clean/Onion** — and say when each is overkill.
- Separate UI from logic with **MVC / MVP / MVVM** and know which fits which platform.
- Abstract persistence behind a **Repository** (and know when it's a needless layer).
- Recognize **CQRS** and **in-process event-driven** designs, and the cost each one adds.
- Choose the *simplest* architecture that fits — most apps are not microservices, and most aren't even hexagonal.

## Topic checklist
- [ ] **The Dependency Rule** — the one idea behind Hexagonal, Clean, and Onion: source-code dependencies point only inward; cross boundaries via interfaces (DIP from `01`).
- [ ] **Layered / N-tier** — presentation → application → domain → infrastructure. The default; its trap is leaky layers and an anemic domain (`04`).
- [ ] **Hexagonal / Ports & Adapters** — domain core + *ports* (interfaces it owns) + *adapters* (REST, JDBC, Kafka) that implement them. Driving vs. driven side.
- [ ] **Clean / Onion Architecture** — concentric circles (entities → use cases → interface adapters → frameworks); same rule as Hexagonal, different drawing.
- [ ] **MVC / MVP / MVVM** — UI/logic separation; data binding; where the state lives.
- [ ] **Repository (+ Unit of Work)** — collection-like abstraction over storage; the seam that lets the domain ignore the DB.
- [ ] **CQRS** — separate the write model from the read model when their shapes truly diverge (and the cost of doing it when they don't).
- [ ] **Event-Driven (in-process)** — domain events + handlers for decoupling within one app; the boundary where this becomes a *distributed* (HLD) concern.
- [ ] **Plugin / Microkernel** — a stable core + pluggable extensions.
- [ ] **Choosing** — Layered for most CRUD apps; Hexagonal/Clean when the domain is rich and you need to swap edges or test the core in isolation; the rest only when a real force demands them.

## The principal-level insight
**Architecture is the set of decisions that are expensive to reverse — so the goal is to *defer and
contain* them, not to pick the fanciest one up front.** The Dependency Rule is how: keep the business
rules ignorant of the database, the web framework, and the message broker, and those become late,
swappable details instead of load-bearing assumptions. But the same restraint from `06` applies with
*more* force here — a hexagonal, CQRS, event-sourced architecture for a CRUD app is the
`06` over-engineering lesson at maximum blast radius. **The senior question is "which pattern?"; the
principal question is "does this app's domain complexity actually justify *any* of them beyond plain
layering?"** Most don't. Reach for Hexagonal when the core is rich and the edges genuinely vary; reach
for plain layers otherwise.

## Drills
1. **Build the Ports & Adapters drill** in [`src/`](src/): a `TransferService` (domain core) that depends only on an `AccountRepository` *port*. Make the transfer work against an in-memory *adapter* the test provides — proving the core has zero dependency on any concrete database.
2. Take one feature you've written in a layered app and redraw it as Hexagonal: what are the ports? which side is driving (UI/API) vs. driven (DB/queue)? Did anything in the domain have to change? (It shouldn't.)
3. For a small CRUD app you know, write the one-paragraph argument for why it should **stay** plain-layered and **not** go hexagonal. Practicing the "no" is the drill.

## Interview lens
Architectural patterns show up in two ways: (1) "how would you structure this service?" — answer with
the Dependency Rule and *justify the level of ceremony for the domain's complexity*; (2) follow-ups
like "now we need to swap Postgres for DynamoDB" or "add a Kafka consumer" — which a ports-and-adapters
design answers as "implement a new adapter, the core is untouched." Naming the boundary to HLD ("inside
the service I'd go hexagonal; across services that's a separate distributed-systems decision") signals
range.

> See [`notes.md`](notes.md) for the diagrams, 🎬 [the Hexagonal animation](visualizations/hexagonal-architecture.html),
> and the drill in [`src/`](src/). This section bridges to the `HLD/` track.
