# Drill · Testability via Dependency Injection

`OrderService` already *receives* a `Clock` and a `Notifier`, but `placeOrder()` ignores them — it
reads the wall clock and never notifies. So it's non-deterministic and its effect is unobservable.
Make it **use** the injected seams and watch the tests become writable and green.

## Run it (JDK only)

```bash
cd 03-clean-code-and-refactoring/src
javac *.java && java OrderServiceTest
```

Start state: **0 passed, 3 failed**.

## The TODOs (in OrderService.java)

| TODO | Makes green | The lesson |
|------|-------------|------------|
| 1 — replace `System.currentTimeMillis()` with `clock.epochMillis()` | "uses the injected clock" | wall-clock time = non-deterministic = untestable. Inject time. |
| 2 — call `notifier.send(confirmation)` | "sends the confirmation", "notifies on every order" | a side effect you can't observe can't be tested. Inject the collaborator. |

## The point
The `FakeNotifier` and `FixedClock` in the test are only possible **because the dependencies come in
through the constructor**. If `OrderService` did `new EmailNotifier()` inside itself, no test could
replace it. **Test pain = a coupling smell.** See the [refactoring staircase](../visualizations/refactoring-staircase.html).

> `*.class` files are build output — don't commit them.
