import java.math.BigDecimal;

/** The concrete base component — complete, nothing to do here. */
public final class Espresso implements Beverage {
    @Override public BigDecimal cost()        { return new BigDecimal("1.99"); }
    @Override public String     description() { return "Espresso"; }
}
