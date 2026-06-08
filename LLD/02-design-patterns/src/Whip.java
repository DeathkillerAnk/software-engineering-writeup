import java.math.BigDecimal;

/** DRILL · Another decorator — same shape as Milk, different add-on. */
public final class Whip implements Beverage {

    private static final BigDecimal ADD_ON = new BigDecimal("0.50");
    private final Beverage inner;

    public Whip(Beverage inner) { this.inner = inner; }

    @Override public BigDecimal cost() {
        // TODO: inner.cost() + ADD_ON
        throw new UnsupportedOperationException("TODO: Whip.cost()");
    }

    @Override public String description() {
        // TODO: inner.description() + ", Whip"
        throw new UnsupportedOperationException("TODO: Whip.description()");
    }
}
