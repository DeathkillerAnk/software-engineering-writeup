import java.math.BigDecimal;

/**
 * DRILL · 01-design-principles — the SEAM that makes Checkout obey the Open/Closed Principle.
 *
 * A Discount transforms a running total. Because Checkout depends on THIS interface (an
 * abstraction) instead of a concrete `if (type == ...)` chain, brand-new discount kinds can be
 * added as NEW classes/lambdas without ever modifying Checkout. That is OCP + DIP in one move.
 *
 * It's a @FunctionalInterface so callers can pass a lambda: `s -> s.multiply(new BigDecimal("0.9"))`.
 */
@FunctionalInterface
public interface Discount {
    /** @return the new total after applying this discount to {@code subtotal}. */
    BigDecimal applyTo(BigDecimal subtotal);
}
