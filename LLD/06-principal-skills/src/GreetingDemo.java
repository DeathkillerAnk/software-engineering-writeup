/**
 * Proves the two greeters are behaviorally identical — so the 6 extra types bought nothing.
 *   Run:  cd 06-principal-skills/src && javac *.java && java GreetingDemo
 */
public class GreetingDemo {
    public static void main(String[] args) {
        var over   = new OverEngineeredGreeter();
        var simple = new SimpleGreeter();
        String[][] cases = { {"en", "Ada"}, {"es", "Ada"}, {"fr", "Ada"} }; // fr falls back to English

        System.out.println("\n  Same input → same output?\n");
        boolean allSame = true;
        for (String[] c : cases) {
            String o = over.greet(c[0], c[1]);
            String s = simple.greet(c[0], c[1]);
            boolean same = o.equals(s);
            allSame &= same;
            System.out.printf("  %-4s  over=\"%s\"   simple=\"%s\"   %s%n", c[0], o, s, same ? "✅" : "❌");
        }

        int overTypes = 7;   // greeter + interface + 2 strategies + factory iface + 2 factories + provider...
        System.out.println("\n  OverEngineeredGreeter: ~7 types.   SimpleGreeter: 1 type, 1 method.");
        System.out.println(allSame
            ? "  → Identical behavior. The extra abstraction was a LOAN with no payoff (YAGNI).\n"
            : "  → Behavior differs — investigate.\n");
        System.out.println("  Reflect (write answers in README.md): what force would ever justify Exhibit A?\n");
    }
}
