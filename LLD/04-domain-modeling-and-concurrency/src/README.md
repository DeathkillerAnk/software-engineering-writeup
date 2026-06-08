# Drill · Order state machine (illegal states unreachable)

`Order` advances through `NEW → PAID → PREPARING → READY → COLLECTED` (and `cancel` from `NEW`/`PAID`).
The skeleton's methods just set the status with no guard, so illegal moves silently succeed. Add the
guards so an invalid transition throws `IllegalStateException`.

## Run it (JDK only)

```bash
cd 04-domain-modeling-and-concurrency/src
javac *.java && java OrderTest
```

Start state: **3 passed, 4 failed** (happy path already works; illegal transitions aren't rejected yet).

## The TODOs (in Order.java)

| TODO | Makes green | The lesson |
|------|-------------|------------|
| Guard `pay`/`prepare`/`ready`/`collect` to their single legal source state | "cannot collect a NEW order", "cannot prepare before paying", "cannot pay twice" | the invariant lives in **one** place, not scattered `if (status==…)` checks |
| Guard `cancel` to `NEW` **or** `PAID` | "cannot cancel after collection" | some transitions have multiple legal sources |

## The point
Once guarded, `collect()` on a `NEW` order is *impossible*. Compare with the
[state-machine animation](../visualizations/order-state-machine.html). 

> Stretch: model `Status` as `sealed` types where each state only exposes its legal transitions —
> then the wrong call won't even **compile**. `*.class` files are build output — don't commit them.
