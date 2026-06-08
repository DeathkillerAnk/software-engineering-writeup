# Drill · Open/Closed via Strategy (Discounts)

Make `Checkout` apply pluggable `Discount` strategies so a **brand-new discount kind works without
modifying `Checkout`**. That's the Open/Closed Principle and Dependency Inversion in one move.

## Run it (JDK only)

```bash
cd 01-design-principles/src
javac *.java && java CheckoutTest
```

Start state: **1 passed, 5 failed**.

## The one TODO

| TODO | Makes green | The lesson |
|------|-------------|------------|
| Implement `Checkout.total()` — fold each `Discount` over the running total | the 4 arithmetic tests | depend on the **abstraction** (`Discount`), not on a concrete `if/else` over types |
| (same change) | the 2 "OCP payoff" tests | the cap & loyalty discounts are kinds `Checkout` *never knew about* — yet they work, because the seam is an interface |

## The point
You never edit `Checkout` to add a discount type — you add a new `Discount` (a class **or** a lambda).
Contrast with the [if/else animation](../visualizations/open-closed-principle.html), where every new
type reopens tested code. Closed for modification, open for extension.

> `*.class` files are build output — don't commit them.
