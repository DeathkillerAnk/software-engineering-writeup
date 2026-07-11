# Drill · Ports & Adapters (Hexagonal)

Implement a `TransferService` (the **domain core**) that depends only on an `AccountRepository`
**port** — never on a concrete database. The test injects an in-memory **adapter**, proving the core
is storage-agnostic. This is the Dependency Rule made concrete.

## Run it (JDK only)

```bash
cd 07-architectural-patterns/src
javac *.java && java TransferServiceTest
```

Start state: **0 passed, 4 failed**.

## The one TODO (in TransferService.java)

| TODO | Makes green | The lesson |
|------|-------------|------------|
| Orchestrate `transfer()` via the port: load both accounts, `debit`/`credit`, `save` both | all 4 tests | the use case talks to an **interface** (`findById`/`save`), not SQL — so any adapter works |

The invariant (no overdraft) already lives on the `Account` entity (rich model, see `04`), and it
checks *before* mutating — that's why the "failed transfer is atomic" test passes once you wire it up.

## The point
- `TransferService` has **zero** dependency on a database. The test's `InMemoryAccountRepository` is a
  HashMap pretending to be storage — a real adapter.
- In production you'd inject a `JdbcAccountRepository`. **Not one line of `TransferService` changes.**
- Swap the edges, the core stands. See the [Hexagonal animation](../visualizations/hexagonal-architecture.html).

> Stretch: write a second adapter (e.g. a `LoggingAccountRepository` that wraps another repo and logs
> every save — that's also the Decorator from `02`). `*.class` files are build output — don't commit them.
