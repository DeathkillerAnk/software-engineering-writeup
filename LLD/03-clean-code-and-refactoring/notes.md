# 03 — Clean Code, Refactoring & Testing · Teaching Notes

> Read with the [syllabus](README.md). Design isn't done once up front — it's *maintained* through
> small, safe steps. And **hard-to-test code is badly-designed code**: the pain you feel writing a
> test is a free design review. 🎬 [The refactoring staircase](visualizations/refactoring-staircase.html)

---

## Code smells → the refactoring that removes each

```mermaid
flowchart LR
    s1["Long Method"] --> r1["Extract Method"]
    s2["Large Class"] --> r2["Extract Class"]
    s3["Feature Envy"] --> r3["Move Method"]
    s4["Switch on type"] --> r4["Replace Conditional<br/>with Polymorphism"]
    s5["Long Parameter List"] --> r5["Introduce Parameter Object"]
    s6["Primitive Obsession"] --> r6["Replace primitive<br/>with a Value Object (00)"]
    style r4 fill:#0c2e22,color:#fff
    style r6 fill:#0c2e22,color:#fff
```

A smell is a *hint*, not a rule. The skill is matching the smell to the cheapest refactoring that
removes it — and stopping there.

---

## The discipline: small steps, green between each

```mermaid
flowchart LR
    g1["✅ green"] --> step["ONE tiny<br/>refactoring"] --> g2["✅ green"] --> step2["next tiny<br/>refactoring"] --> g3["✅ green"]
    style g1 fill:#0c2e22,color:#fff
    style g2 fill:#0c2e22,color:#fff
    style g3 fill:#0c2e22,color:#fff
```

> **Never refactor and add a feature in the same commit.** Refactoring is *behavior-preserving* —
> tests stay green the whole way. If a test goes red, you changed behavior; back up. The
> [animation](visualizations/refactoring-staircase.html) shows a god-method decomposed step-by-step
> with the test bar staying green throughout.

---

## Testing IS design: the pyramid & the feedback

```mermaid
flowchart TD
    e2e["few · E2E (slow, brittle)"] --> intg["some · Integration"] --> unit["many · Unit (fast, focused)"]
    style unit fill:#0c2e22,color:#fff
    style e2e fill:#3b1414,color:#fff
```

Most tests should be fast unit tests. But the deeper point is the **feedback loop**:

```mermaid
flowchart LR
    pain["Test is painful to write"] --> diag{"Why?"}
    diag -->|"need to mock 5 things"| c1["too much coupling"]
    diag -->|"can't control time/IO"| c2["dependencies hard-wired"]
    diag -->|"must spin up a DB"| c3["policy tangled with I/O"]
    c1 --> fix["Refactor: inject the dependency,<br/>split the responsibilities"]
    c2 --> fix
    c3 --> fix
    style fix fill:#0c2e22,color:#fff
```

## Dependency Injection — the practical form of DIP

```mermaid
flowchart TD
    subgraph before["❌ news-up internally → untestable"]
      A["OrderService"] --> N1["new EmailNotifier()"]
      A --> T1["System.currentTimeMillis()"]
    end
    subgraph after["✅ inject via constructor → testable"]
      B["OrderService"] --> I1["«interface» Notifier"]
      B --> I2["«interface» Clock"]
      note["tests pass a FakeNotifier<br/>+ a fixed Clock"]
    end
    style before fill:#3b1414,color:#fff
    style after fill:#0c2e22,color:#fff
```

`new` inside business logic welds you to a concrete dependency you can't replace in a test. Pass
collaborators through the constructor and the same code becomes trivially testable.

---

## The principal-level insight

**Listening to test pain is how principals find design flaws while they're still cheap.** They don't
experience "writing tests" and "designing" as separate activities — a method that needs five mocks is
telling you it has five dependencies. And refactoring isn't a project you get time for "later"; it's
the continuous act that keeps the cost of the *next* change low. Teams that "have no time to refactor"
are paying compound interest on mess forever.

## Interview lens

Machine-coding rounds are judged on clean code under time pressure, not just "does it run." Good names,
small methods, **dependencies injected** (so the grader can see testability), and a couple of real
tests out-score a sprawling correct-but-unreadable solution. Finishing early? Refactor for readability
and add a test — don't pile on features.

---

## Now do the drill

[`src/`](src/) — an `OrderService` that hard-wires the clock and ignores its notifier, so it's
non-deterministic and untestable. Refactor it to *use* its injected `Clock` and `Notifier`. Watch the
tests go green once they can control time and observe the notification. [`src/README.md`](src/README.md).

> Next → [`04` Domain Modeling & Concurrency](../04-domain-modeling-and-concurrency/).

## What I learned
<!-- one force you now get, one mistake, one thing you'd do differently -->
- _force:_
- _mistake:_
- _next time:_
