# Part 4 · Data & Transactions

> Persistence, and the proxy that wraps it. Spring Data, JPA/Hibernate, and `@Transactional` look
> like annotations you sprinkle on — but underneath they are the **same two mechanisms you already
> know**: a dynamic proxy (Part 1) and a managed lifecycle (Part 0). The bugs everyone hits here —
> N+1, `LazyInitializationException`, a transaction that never commits — are all really questions
> about *"is there an open session, and did this call cross the proxy?"*
> [← curriculum index](../README.md)

This is the part where Parts 0 and 1 pay off most directly. Once you see that a `@Transactional`
method is just advice on a proxy, and that the persistence context is just a transaction-scoped
cache, the data layer stops being a source of mysterious behavior and becomes something you can
reason about from the boundary in.

---

## Learning objectives — what "I know this" actually means

By the end of this part you can, **from memory and out loud**:

- Explain the **Spring Data repository abstraction**: a `Repository` interface has no implementation
  you wrote — at startup `RepositoryFactorySupport` creates a **dynamic proxy** that turns method
  calls into queries, derived from the method name (`findByLastNameAndActiveTrue`) or from `@Query`.
- Explain the **persistence context as the first-level cache**: entities you load or persist become
  *managed*, scoped to the `EntityManager`/transaction; the same id returns the same instance;
  **dirty checking** detects changes and **flushes on commit**, so you often never call `save()`.
- Diagnose **lazy loading** failures: lazy associations are proxies, resolved only while the session
  is open — touch one after it closes and you get `LazyInitializationException`; touch one per row in
  a loop and you get the **N+1 problem** — and name the fixes (fetch join, `@EntityGraph`, batch
  size, projections).
- Walk **`@Transactional` end to end**: the AOP proxy → `TransactionInterceptor` →
  `PlatformTransactionManager` (e.g. `JpaTransactionManager`), **propagation** (`REQUIRED` default,
  `REQUIRES_NEW`, `NESTED`, …), isolation, and **rollback rules** — rolls back on unchecked
  (`RuntimeException`/`Error`) by default, **not** on checked exceptions unless told to — and explain
  the **self-invocation trap** *again*.
- Explain the JDBC layer (`JdbcTemplate`/`JdbcClient`), why **HikariCP** (the default pool) sizing
  matters more than people think, and that `@Cacheable` is *also* a proxy — same boundary, same trap.

## Topic checklist

- [ ] **20 · Spring Data & the Repository Abstraction** — `Repository`/`CrudRepository`/
      `JpaRepository`; how `RepositoryFactorySupport` builds a **proxy** at startup (no impl class of
      yours); **query derivation** from method names vs `@Query` (JPQL/native); paging & sorting
      (`Pageable`), projections (interface/DTO), and `Specification`s; where the abstraction *leaks*
      (a derived name that's slower than the SQL you'd write) and when to drop to `JdbcClient`.
- [ ] **21 · JPA/Hibernate Integration & the Persistence Context** — `EntityManager` and the
      **persistence context = first-level cache** (transaction-scoped, identity-guaranteed); the
      entity lifecycle (transient → managed → detached → removed); **dirty checking** & **flush
      timing** (on commit / before a query / explicit) — why a managed entity persists changes
      without `save()`; **lazy vs eager** fetching, the lazy proxy, `LazyInitializationException` and
      the session boundary; the **N+1 problem**, how to *see* it (SQL logging,
      `hibernate.generate_statistics`), and how to kill it (`join fetch`, `@EntityGraph`,
      `@BatchSize`).
- [ ] **22 · Transaction Management Internals** — `@Transactional` as **AOP advice on a proxy** →
      `TransactionInterceptor` → `PlatformTransactionManager`; **propagation** semantics in full
      (`REQUIRED` joins or starts; `REQUIRES_NEW` suspends and starts fresh; `NESTED` uses
      savepoints; `SUPPORTS`/`MANDATORY`/`NEVER`/`NOT_SUPPORTED`); **isolation** levels and what they
      buy; **rollback rules** (unchecked by default; `rollbackFor`/`noRollbackFor` to change it); the
      **self-invocation trap**; why a `private` or `final` method can't be advised; read-only
      transactions; the difference between the proxy default and AspectJ weaving.
- [ ] **23 · JDBC, Connection Pooling & the Caching Abstraction** — `JdbcTemplate` and the modern
      `JdbcClient`; `DataSource` and **HikariCP** as the Boot default — pool size as a *concurrency
      ceiling* (and why bigger is often worse), `maximumPoolSize`/`connectionTimeout`/leak detection,
      and how a transaction *holds* a connection for its whole duration; Spring's cache abstraction
      (`@Cacheable`/`@CacheEvict`) — also **proxy-based**, so the self-invocation trap applies here
      too, plus cache provider selection and TTL/eviction.

## The principal-level insight

**The persistence context and the transaction are the same boundary — and that boundary is enforced
by a proxy — so almost every data-layer bug is really a boundary question.** "Why didn't my change
persist?" → the entity wasn't managed, or the transaction didn't commit. "Why
`LazyInitializationException`?" → you touched a lazy proxy *outside* the session that the transaction
defines. "Why N+1?" → each lazy access inside the loop opened its own query against that same open
session. "Why did `@Transactional` do nothing?" → the call never crossed the proxy (self-invocation),
so the transaction was never started. A principal doesn't memorize these as unrelated gotchas; they
hold one model — *a proxy opens a transaction, the transaction scopes a persistence context, and only
calls that cross the proxy and run inside that scope behave transactionally* — and **derive** every
symptom from it. That model also tells you the fixes are structural (move the boundary, widen the
session, fetch eagerly where you'll need it), not incantations.

## Drills (build, don't just read)

Make the invisible visible — the data layer is unusually easy to interrogate, because every effect
shows up as SQL. Set `logging.level.org.hibernate.SQL=DEBUG` (and bind parameters) before all of these.

1. **Catch and kill an N+1.** Load a parent with a lazy `@OneToMany` and loop over the children in a
   list view. Watch the SQL log emit 1 + N queries. Turn on `hibernate.generate_statistics` to count
   them. Then fix it with a `join fetch` / `@EntityGraph` and watch it collapse to one query. You'll
   never not-see N+1 again.
2. **Reproduce `LazyInitializationException`.** Return a managed entity with a lazy association from a
   `@Transactional` service, then access the association in the controller (after the transaction
   closed). Watch it throw. Explain the session boundary out loud; fix it the *right* way (a DTO/
   projection or a fetch), not with `OPEN_SESSION_IN_VIEW`.
3. **Watch dirty checking.** In a `@Transactional` method, load an entity, mutate a field, and **do
   not call `save()`**. Confirm from the SQL log that an `UPDATE` fires at commit. Then do the same
   mutation on a *detached* entity and confirm nothing happens.
4. **Break a transaction with self-invocation.** Put `@Transactional` on a method and call it from
   another method of the *same* bean. Turn on `logging.level.org.springframework.transaction=TRACE`
   and watch **no** transaction get created. Fix it by moving the call across a bean boundary.
5. **Exhaust the pool.** Set HikariCP `maximumPoolSize=2`, fire 10 concurrent requests that each hold
   a transaction briefly, and watch requests queue on `connectionTimeout`. Reason about why a *bigger*
   pool than your DB can serve makes things worse, not better.

## Interview lens

This is dense senior/staff territory because it's where production incidents actually happen.
Classic probes: *"How does `@Transactional` work under the hood?"* (proxy → interceptor →
`PlatformTransactionManager`; listen for *self-invocation* and *unchecked-only rollback*),
*"What is the persistence context / first-level cache?"*, *"You have an N+1 — diagnose and fix it,"*
*"`REQUIRES_NEW` vs `NESTED`?"* (new physical transaction vs savepoint), *"Why didn't my transaction
roll back?"* (checked exception, or self-invocation, or no transaction at all), and the sleeper
*"How big should your connection pool be?"* (a concurrency ceiling bounded by the DB, not "as big as
possible"). The signal is reasoning from the **proxy + session boundary**, not reciting annotation
names. Proxies tie back to [Part 1](../01-extension-and-aop/); the thread-safety of shared data
access ties to the [java track's Java Memory Model](../../java/03-concurrency-and-jmm/).

## Visualizations

See [`visualizations/`](visualizations/): the **transaction proxy** (begin → method → commit/rollback,
a self-invocation skipping it, `REQUIRES_NEW` nesting) and the **persistence context** (entities
becoming managed, dirty checking, flush-on-commit, a lazy-load proxy hit causing N+1). Full
philosophy and catalog in [VISUALIZATIONS.md](../VISUALIZATIONS.md).
