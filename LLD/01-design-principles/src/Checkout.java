import java.math.BigDecimal;
import java.util.List;

/**
 * DRILL · 01 — make Checkout OBEY the Open/Closed Principle.
 *
 * Compiles as-is, but CheckoutTest starts RED: total() currently ignores the discounts.
 * Your job: depend on the {@link Discount} abstraction so ANY discount (even types this class
 * never heard of) just works — without editing Checkout.
 *
 *   Run:  cd 01-design-principles/src && javac *.java && java CheckoutTest
 */
public final class Checkout {

    private final List<Discount> discounts;

    public Checkout(List<Discount> discounts) {
        // Defensive copy (a lesson from 00): callers can't mutate our list after construction.
        this.discounts = List.copyOf(discounts);
    }

    /**
     * Apply every discount, in order, to the subtotal and return the final total.
     * Each discount transforms the running total (10% off, then $5 off, then a price cap, ...).
     */
    public BigDecimal total(BigDecimal subtotal) {
        // TODO: fold every discount over the running total:
        //   running = subtotal; for each d in discounts: running = d.applyTo(running); return running;
        // Right now we ignore the discounts entirely — that's why most tests are RED.
        return subtotal;
    }
}
