import java.math.BigDecimal;
import java.util.List;

/**
 * Zero-dependency runner (no JUnit).  cd 01-design-principles/src && javac *.java && java CheckoutTest
 * Goal: make every line GREEN by implementing Checkout.total().
 */
public class CheckoutTest {
    static int passed = 0, failed = 0;
    interface Cond { boolean get() throws Exception; }

    static void check(String name, Cond c) {
        try {
            if (c.get()) { passed++; System.out.println("  ✅ PASS  " + name); }
            else         { failed++; System.out.println("  ❌ FAIL  " + name); }
        } catch (UnsupportedOperationException e) {
            failed++; System.out.println("  ❌ FAIL  " + name + "   (still a TODO)");
        } catch (Throwable t) {
            failed++; System.out.println("  ❌ FAIL  " + name + "   (threw " + t.getClass().getSimpleName() + ")");
        }
    }
    static boolean eq(BigDecimal a, String b) { return a.compareTo(new BigDecimal(b)) == 0; }

    // Concrete strategies (the "known" kinds)
    static Discount percentOff(String pct) { return s -> s.multiply(BigDecimal.ONE.subtract(new BigDecimal(pct).movePointLeft(2))); }
    static Discount flatOff(String amt)    { return s -> s.subtract(new BigDecimal(amt)).max(BigDecimal.ZERO); }

    public static void main(String[] args) {
        System.out.println("\n  OCP drill — turn every ❌ into ✅\n");

        check("no discounts → total equals subtotal",
                () -> eq(new Checkout(List.of()).total(new BigDecimal("100")), "100"));
        check("a 10% discount reduces correctly",
                () -> eq(new Checkout(List.of(percentOff("10"))).total(new BigDecimal("100")), "90"));
        check("a $5 flat discount reduces correctly",
                () -> eq(new Checkout(List.of(flatOff("5"))).total(new BigDecimal("100")), "95"));
        check("multiple discounts COMPOSE in order (10% then $5)",
                () -> eq(new Checkout(List.of(percentOff("10"), flatOff("5"))).total(new BigDecimal("100")), "85"));

        System.out.println("\n  -- the OCP payoff: a brand-NEW discount kind, with ZERO changes to Checkout --");
        // A "price cap" rule that Checkout has never seen — defined right here as a lambda.
        Discount capAt = subtotal -> subtotal.min(new BigDecimal("50"));
        check("an unknown 'price cap' discount works without modifying Checkout",
                () -> eq(new Checkout(List.of(capAt)).total(new BigDecimal("100")), "50"));
        // An anonymous-class strategy, also unknown to Checkout.
        Discount loyalty = new Discount() {
            public BigDecimal applyTo(BigDecimal s) { return s.subtract(new BigDecimal("2")); }
        };
        check("an anonymous-class discount also composes (cap to 50, then -2)",
                () -> eq(new Checkout(List.of(capAt, loyalty)).total(new BigDecimal("100")), "48"));

        System.out.println("\n  " + passed + " passed, " + failed + " failed.");
        System.out.println(failed == 0
                ? "\n  🎉 All green — and you never had to edit Checkout to support new discount kinds. That's OCP.\n"
                : "\n  Implement Checkout.total() to fold the discounts over the running total.\n");
    }
}
