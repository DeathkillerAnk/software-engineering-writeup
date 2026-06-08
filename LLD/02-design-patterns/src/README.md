# Drill · Decorator (coffee add-ons)

Implement two decorators so cost and description **compose by wrapping** — no combinatorial subclass
explosion.

## Run it (JDK only)

```bash
cd 02-design-patterns/src
javac *.java && java BeverageTest
```

Start state: **2 passed, 5 failed** (Espresso is done; Milk/Whip are TODOs).

## The TODOs

| TODO | Makes green | The lesson |
|------|-------------|------------|
| `Milk.cost()` / `Milk.description()` — delegate to `inner`, add `0.30` / `", Milk"` | the Milk tests | a decorator IS-A `Beverage` and HAS-A `Beverage` |
| `Whip.cost()` / `Whip.description()` — same shape, `0.50` / `", Whip"` | the Whip + composition tests | wrappers nest: `new Whip(new Milk(new Espresso()))` |

## The point
`new Whip(new Milk(new Espresso()))` builds behavior at **runtime**. There is no
`EspressoWithMilkAndWhip` class — N add-ons need N classes, not 2ᴺ. See the
[animation](../visualizations/decorator.html).

> Stretch: could a `BeverageDecorator` abstract base remove the duplication between Milk and Whip?
> `*.class` files are build output — don't commit them.
