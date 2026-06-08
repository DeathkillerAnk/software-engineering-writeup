/** Zero-dependency runner. cd 04-domain-modeling-and-concurrency/src && javac *.java && java OrderTest */
public class OrderTest {
    static int passed = 0, failed = 0;
    interface Cond { boolean get() throws Exception; }
    static void check(String name, Cond c) {
        try {
            if (c.get()) { passed++; System.out.println("  ✅ PASS  " + name); }
            else         { failed++; System.out.println("  ❌ FAIL  " + name); }
        } catch (Throwable t) {
            failed++; System.out.println("  ❌ FAIL  " + name + "   (threw " + t.getClass().getSimpleName() + ")");
        }
    }
    /** PASS iff running r throws IllegalStateException (i.e. the illegal transition was rejected). */
    static void rejects(String name, Runnable r) {
        try { r.run(); failed++; System.out.println("  ❌ FAIL  " + name + "   (illegal transition was ALLOWED)"); }
        catch (IllegalStateException e) { passed++; System.out.println("  ✅ PASS  " + name); }
        catch (Throwable t) { failed++; System.out.println("  ❌ FAIL  " + name + "   (threw " + t.getClass().getSimpleName() + ", expected IllegalStateException)"); }
    }

    public static void main(String[] args) {
        System.out.println("\n  State-machine drill — turn every ❌ into ✅\n");

        System.out.println("  -- the happy path stays legal --");
        check("a fresh order starts NEW", () -> new Order().status() == Order.Status.NEW);
        check("pay → prepare → ready → collect ends COLLECTED", () -> {
            var o = new Order(); o.pay(); o.prepare(); o.ready(); o.collect();
            return o.status() == Order.Status.COLLECTED;
        });
        check("cancel from NEW → CANCELLED", () -> {
            var o = new Order(); o.cancel(); return o.status() == Order.Status.CANCELLED;
        });

        System.out.println("\n  -- illegal transitions must be REJECTED --");
        rejects("cannot collect a NEW order",      () -> new Order().collect());
        rejects("cannot prepare before paying",    () -> new Order().prepare());
        rejects("cannot pay twice",                () -> { var o = new Order(); o.pay(); o.pay(); });
        rejects("cannot cancel after collection",  () -> {
            var o = new Order(); o.pay(); o.prepare(); o.ready(); o.collect(); o.cancel();
        });

        System.out.println("\n  " + passed + " passed, " + failed + " failed.");
        System.out.println(failed == 0
                ? "\n  🎉 All green. Illegal states are now unreachable — the rule lives in one place.\n"
                : "\n  Add a guard to each transition so it throws IllegalStateException from the wrong state.\n");
    }
}
