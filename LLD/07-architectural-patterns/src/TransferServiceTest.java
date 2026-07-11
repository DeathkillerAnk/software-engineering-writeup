import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Zero-dependency runner. cd 07-architectural-patterns/src && javac *.java && java TransferServiceTest
 *
 * The InMemoryAccountRepository below IS an adapter — the test's own implementation of the port.
 * The fact that TransferService works against it, with no DB in sight, is the architecture lesson.
 */
public class TransferServiceTest {
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
    /** PASS only if running r throws exactly `type` (so a TODO's UnsupportedOperationException is a FAIL). */
    static void rejects(String name, Class<? extends Throwable> type, Runnable r) {
        try { r.run(); failed++; System.out.println("  ❌ FAIL  " + name + "   (no exception thrown)"); }
        catch (Throwable t) {
            if (type.isInstance(t)) { passed++; System.out.println("  ✅ PASS  " + name); }
            else { failed++; System.out.println("  ❌ FAIL  " + name + "   (threw " + t.getClass().getSimpleName() + ", expected " + type.getSimpleName() + ")"); }
        }
    }

    /** An ADAPTER for the port — a HashMap pretending to be a database. */
    static final class InMemoryAccountRepository implements AccountRepository {
        private final Map<String, Account> store = new HashMap<>();
        InMemoryAccountRepository(Account... seed) { for (Account a : seed) store.put(a.id(), a); }
        public Optional<Account> findById(String id) { return Optional.ofNullable(store.get(id)); }
        public void save(Account a) { store.put(a.id(), a); }
    }
    static boolean bal(AccountRepository r, String id, String v) {
        return r.findById(id).orElseThrow().balance().compareTo(new BigDecimal(v)) == 0;
    }

    public static void main(String[] args) {
        System.out.println("\n  Ports & Adapters drill — turn every ❌ into ✅\n");

        check("a transfer moves funds between accounts", () -> {
            var repo = new InMemoryAccountRepository(new Account("A", new BigDecimal("100")), new Account("B", new BigDecimal("50")));
            new TransferService(repo).transfer("A", "B", new BigDecimal("30"));
            return bal(repo, "A", "70") && bal(repo, "B", "80");
        });

        rejects("insufficient funds throws IllegalStateException", IllegalStateException.class, () -> {
            var repo = new InMemoryAccountRepository(new Account("A", new BigDecimal("100")), new Account("B", new BigDecimal("50")));
            new TransferService(repo).transfer("A", "B", new BigDecimal("200"));
        });

        check("a FAILED transfer leaves both balances untouched (atomic)", () -> {
            var repo = new InMemoryAccountRepository(new Account("A", new BigDecimal("100")), new Account("B", new BigDecimal("50")));
            try { new TransferService(repo).transfer("A", "B", new BigDecimal("200")); } catch (IllegalStateException ignored) {}
            return bal(repo, "A", "100") && bal(repo, "B", "50");
        });

        rejects("an unknown account throws IllegalArgumentException", IllegalArgumentException.class, () -> {
            var repo = new InMemoryAccountRepository(new Account("A", new BigDecimal("100")));
            new TransferService(repo).transfer("A", "GHOST", new BigDecimal("10"));
        });

        System.out.println("\n  " + passed + " passed, " + failed + " failed.");
        System.out.println(failed == 0
                ? "\n  🎉 All green — and the core never touched a database. Swap the adapter, the core stands. That's Hexagonal.\n"
                : "\n  Implement TransferService.transfer() using ONLY the AccountRepository port.\n");
    }
}
