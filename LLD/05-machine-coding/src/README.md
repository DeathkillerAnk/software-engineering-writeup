# Drill · Parking Lot (machine-coding starter kit)

The canonical LLD interview problem, scoped to be solvable in one sitting. The entities, value
objects, and API are already modeled (steps 1–3 of the method) — you implement the allocation logic.

## Run it (JDK only)

```bash
cd 05-machine-coding/src
javac *.java && java ParkingLotTest
```

Start state: **3 passed, 5 failed** (two "returns empty" checks pass trivially while `park` is a stub — they'll still pass for the right reason once you implement it).

## The TODOs (in ParkingLot.java)

| TODO | Makes green | The rule |
|------|-------------|----------|
| `park()` — pick a fitting spot, decrement, return a `Ticket` | basic + overflow + full tests | small car: SMALL then overflow to LARGE; large vehicle: LARGE only; else empty |
| `leave()` — free the spot recorded on the ticket | the two "leaving frees" tests | the `Ticket` remembers which size spot was used |

## After it's green — practice like an interview
1. Open the [timed coach](../visualizations/machine-coding-coach.html), pick a NEW problem (Rate Limiter, Vending Machine), and run the 8-step method against the clock.
2. Extend this one on demand (the real interview move): add a `PricingStrategy` seam, or per-spot ids, or a 3rd size — notice how the model absorbs the change.
3. Score yourself on the rubric in [`../notes.md`](../notes.md) and log the trend.

> `*.class` files are build output — don't commit them.
