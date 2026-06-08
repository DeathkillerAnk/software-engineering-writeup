import java.math.BigDecimal;

/**
 * DRILL · A decorator. It IS-A Beverage and HAS-A Beverage (the one it wraps).
 * Implement the two methods by delegating inward and adding milk's contribution.
 *
 *   Run: cd 02-design-patterns/src && javac *.java && java BeverageTest
 */
public final class Milk implements Beverage {

    private static final BigDecimal ADD_ON = new BigDecimal("0.30");
    private final Beverage inner;   // the beverage this wrapper decorates

    public Milk(Beverage inner) { this.inner = inner; }

    @Override public BigDecimal cost() {
        // TODO: return the wrapped beverage's cost PLUS ADD_ON (delegate to inner.cost()).
        throw new UnsupportedOperationException("TODO: Milk.cost()");
    }

    @Override public String description() {
        // TODO: return the wrapped beverage's description with ", Milk" appended.
        throw new UnsupportedOperationException("TODO: Milk.description()");
    }
}
