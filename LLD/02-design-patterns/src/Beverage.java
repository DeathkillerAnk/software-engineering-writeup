import java.math.BigDecimal;

/**
 * DRILL · 02-design-patterns — the component interface for the Decorator pattern.
 * Both the base drink (Espresso) and every add-on wrapper (Milk, Whip) implement this,
 * which is exactly what lets a wrapper stand in for the thing it wraps.
 */
public interface Beverage {
    BigDecimal cost();
    String description();
}
