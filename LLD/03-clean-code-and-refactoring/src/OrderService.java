/**
 * DRILL · 03 — make this class TESTABLE by actually USING its injected dependencies.
 *
 * The collaborators are already injected (good!), but placeOrder() ignores them: it reads the
 * wall clock (non-deterministic) and never calls the notifier (unobservable). That's why the
 * tests are RED. Use `clock` and `notifier` instead — and feel how test pain points straight at
 * the design flaw.
 *
 *   Run:  cd 03-clean-code-and-refactoring/src && javac *.java && java OrderServiceTest
 */
public final class OrderService {

    private final Notifier notifier;
    private final Clock clock;

    public OrderService(Notifier notifier, Clock clock) {
        this.notifier = notifier;
        this.clock = clock;
    }

    /** Places an order and returns the confirmation message. */
    public String placeOrder(String item) {
        // TODO 1: use the INJECTED clock, not the wall clock, so the timestamp is deterministic.
        long now = System.currentTimeMillis();   // <-- replace with clock.epochMillis()

        String confirmation = "Order '" + item + "' confirmed at t=" + now;

        // TODO 2: actually send the confirmation through the injected notifier so a test can observe it.
        //         notifier.send(confirmation);

        return confirmation;
    }
}
