import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

/**
 * Zero-dependency test runner for the Money drill. No JUnit, no build tool.
 *
 *   cd 00-foundations/src && javac Money.java MoneyTest.java && java MoneyTest
 *
 * Goal: make every line GREEN. Each ❌ points at a TODO in Money.java.
 */
public class MoneyTest {

    static int passed = 0, failed = 0;

    /** A check whose evaluation may itself throw (e.g. calling a not-yet-done method). */
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

    static void expectThrows(String name, Runnable r) {
        try { r.run(); failed++; System.out.println("  ❌ FAIL  " + name + "   (expected an exception, none thrown)"); }
        catch (UnsupportedOperationException e) { failed++; System.out.println("  ❌ FAIL  " + name + "   (still a TODO)"); }
        catch (Throwable t) { passed++; System.out.println("  ✅ PASS  " + name); }
    }

    static Money money(String amount, String ccy) { return new Money(new BigDecimal(amount), ccy); }

    public static void main(String[] args) {
        System.out.println("\n  Money drill — turn every ❌ into ✅\n");

        System.out.println("  -- construction & immutability --");
        check("constructs and exposes its amount/currency",
                () -> money("5", "USD").amount().compareTo(new BigDecimal("5")) == 0
                   && money("5", "USD").currency().equals("USD"));
        expectThrows("rejects a null amount",   () -> new Money(null, "USD"));
        expectThrows("rejects a null currency", () -> new Money(new BigDecimal("5"), null));

        System.out.println("\n  -- arithmetic returns NEW values (no mutation) --");
        check("plus returns the correct sum",
                () -> money("5", "USD").plus(money("3", "USD")).amount().compareTo(new BigDecimal("8")) == 0);
        check("plus does NOT mutate the original",
                () -> { Money a = money("5", "USD"); a.plus(money("3", "USD"));
                        return a.amount().compareTo(new BigDecimal("5")) == 0; });
        check("minus returns the correct difference",
                () -> money("5", "USD").minus(money("3", "USD")).amount().compareTo(new BigDecimal("2")) == 0);
        expectThrows("plus rejects a currency mismatch (USD + EUR)",
                () -> money("5", "USD").plus(money("5", "EUR")));

        System.out.println("\n  -- value equality (equals) --");
        check("two equal values are equal",        () ->  money("5", "USD").equals(money("5", "USD")));
        check("different amount -> not equal",      () -> !money("5", "USD").equals(money("6", "USD")));
        check("different currency -> not equal",    () -> !money("5", "USD").equals(money("5", "EUR")));
        check("a value is not equal to null",       () -> !money("5", "USD").equals(null));
        check("a value is not equal to a String",   () -> !money("5", "USD").equals("5 USD"));

        System.out.println("\n  -- the payoff: equals + hashCode together --");
        check("equal values share a hashCode (the contract)",
                () -> money("5", "USD").hashCode() == money("5", "USD").hashCode());
        check("works as a HashMap key (lookup with a DIFFERENT but equal instance)",
                () -> { Map<Money, String> m = new HashMap<>();
                        m.put(money("5", "USD"), "five");
                        return "five".equals(m.get(money("5", "USD"))); });

        System.out.println("\n  " + passed + " passed, " + failed + " failed.");
        System.out.println(failed == 0
                ? "\n  🎉 All green. Now go write your 3 lines in notes.md § 'What I learned'.\n"
                : "\n  Keep going — open Money.java and knock out the next TODO.\n");
    }
}
