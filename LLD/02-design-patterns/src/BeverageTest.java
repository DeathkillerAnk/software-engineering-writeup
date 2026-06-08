import java.math.BigDecimal;

/** Zero-dependency runner. cd 02-design-patterns/src && javac *.java && java BeverageTest */
public class BeverageTest {
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
    static boolean cost(Beverage b, String v) { return b.cost().compareTo(new BigDecimal(v)) == 0; }

    public static void main(String[] args) {
        System.out.println("\n  Decorator drill — turn every ❌ into ✅\n");

        System.out.println("  -- base component --");
        check("Espresso costs 1.99",            () -> cost(new Espresso(), "1.99"));
        check("Espresso describes itself",      () -> new Espresso().description().equals("Espresso"));

        System.out.println("\n  -- one wrapper --");
        check("Milk(Espresso) costs 2.29",      () -> cost(new Milk(new Espresso()), "2.29"));
        check("Milk(Espresso) description",     () -> new Milk(new Espresso()).description().equals("Espresso, Milk"));

        System.out.println("\n  -- wrappers compose at runtime (the payoff) --");
        check("Whip(Milk(Espresso)) costs 2.79",
                () -> cost(new Whip(new Milk(new Espresso())), "2.79"));
        check("Whip(Milk(Espresso)) description",
                () -> new Whip(new Milk(new Espresso())).description().equals("Espresso, Milk, Whip"));
        check("order of wrapping is reflected (Milk(Whip(Espresso)))",
                () -> new Milk(new Whip(new Espresso())).description().equals("Espresso, Whip, Milk"));

        System.out.println("\n  " + passed + " passed, " + failed + " failed.");
        System.out.println(failed == 0
                ? "\n  🎉 All green — N add-ons, N classes, zero subclass explosion. That's Decorator.\n"
                : "\n  Implement Milk and Whip: delegate to inner, then add your bit.\n");
    }
}
