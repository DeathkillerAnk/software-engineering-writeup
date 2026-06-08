/**
 * Zero-dependency runner. cd 03-clean-code-and-refactoring/src && javac *.java && java OrderServiceTest
 *
 * Notice: these tests are only WRITABLE because OrderService takes its collaborators by constructor.
 * The fakes below are the whole point of dependency injection.
 */
public class OrderServiceTest {
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

    /** A fake notifier that just records what it was asked to send. */
    static final class FakeNotifier implements Notifier {
        String last = null; int count = 0;
        public void send(String message) { last = message; count++; }
    }
    /** A clock pinned to a fixed instant — deterministic. */
    static final class FixedClock implements Clock {
        public long epochMillis() { return 1000L; }
    }

    public static void main(String[] args) {
        System.out.println("\n  Testability drill — turn every ❌ into ✅\n");

        check("uses the INJECTED clock (deterministic timestamp t=1000)", () -> {
            var svc = new OrderService(new FakeNotifier(), new FixedClock());
            return svc.placeOrder("Latte").equals("Order 'Latte' confirmed at t=1000");
        });

        check("SENDS the confirmation through the injected notifier", () -> {
            var fake = new FakeNotifier();
            var svc = new OrderService(fake, new FixedClock());
            svc.placeOrder("Latte");
            return "Order 'Latte' confirmed at t=1000".equals(fake.last);
        });

        check("notifies on every order (count increments)", () -> {
            var fake = new FakeNotifier();
            var svc = new OrderService(fake, new FixedClock());
            svc.placeOrder("Latte");
            svc.placeOrder("Mocha");
            return fake.count == 2 && "Order 'Mocha' confirmed at t=1000".equals(fake.last);
        });

        System.out.println("\n  " + passed + " passed, " + failed + " failed.");
        System.out.println(failed == 0
                ? "\n  🎉 All green. The class became testable the moment it USED its injected seams.\n"
                : "\n  Do TODO 1 (use clock) and TODO 2 (use notifier) in OrderService.\n");
    }
}
