# Drill · Money value object

Your first rep of the [Build → Compare → Refactor → Articulate](../../STUDY-METHOD.md) loop.
Goal: make every test **green** by completing the `// TODO`s in [`Money.java`](Money.java).

## Run it (JDK only — no Maven/Gradle/JUnit)

```bash
cd 00-foundations/src
javac Money.java MoneyTest.java && java MoneyTest
```

You'll start at **5 passed, 9 failed**. Each ❌ names the behavior and points at a TODO.

## The order to attack the TODOs

| TODO | Makes green | The lesson |
|------|-------------|------------|
| 1 — validate in constructor | `rejects a null amount/currency` | An invalid object must be impossible to construct. Invariant lives in *one* place. |
| 2 — `plus()` | `plus returns the correct sum`, `does NOT mutate`, `rejects currency mismatch` | "Modify" = return a **new** value. Immutability. |
| 3 — `minus()` | `minus returns the correct difference` | Same shape as plus. |
| 4 + 5 — `equals()` + `hashCode()` | `two equal values are equal`, `share a hashCode`, **`works as a HashMap key`** | The contract. This is the payoff — re-watch [the animation](../visualizations/equals-hashcode.html). |

## When it's all green
1. Compare your `Money` against [`Effective Java` Item 10/11] mentally — did you handle null, type, symmetry?
2. Try the **STRETCH** comment at the bottom of `Money.java` (the `BigDecimal` scale trap).
3. Then ask yourself: *could a `record` have done most of this for free?* (Yes — and that's the lesson: prefer records for value objects once you understand what they generate.)
4. Write your three lines in [`../notes.md` § What I learned](../notes.md#what-i-learned).

> Tip: `*.class` files are build output — don't commit them. Re-run the `javac` line after every edit.
