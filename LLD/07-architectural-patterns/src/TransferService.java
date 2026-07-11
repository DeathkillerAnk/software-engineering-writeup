import java.math.BigDecimal;

/**
 * DRILL · 07 — the DOMAIN CORE (an application use case).
 *
 * It depends ONLY on the AccountRepository *port* — never on a concrete database. That's the
 * Dependency Rule: business logic points inward. The test injects an in-memory adapter; production
 * would inject a JDBC adapter. Neither changes a line of this class.
 *
 * Compiles as-is, but transfer() is a TODO, so TransferServiceTest is RED. Implement the orchestration.
 *
 *   Run:  cd 07-architectural-patterns/src && javac *.java && java TransferServiceTest
 */
public final class TransferService {

    private final AccountRepository accounts;   // the PORT — an interface, not a DB

    public TransferService(AccountRepository accounts) {
        this.accounts = accounts;
    }

    public void transfer(String fromId, String toId, BigDecimal amount) {
        // TODO: orchestrate the use case using ONLY the repository port:
        //   1. load `from` (accounts.findById) — if absent, throw new IllegalArgumentException(...)
        //   2. load `to`   — if absent, throw new IllegalArgumentException(...)
        //   3. from.debit(amount)   // throws IllegalStateException if insufficient — BEFORE mutating
        //   4. to.credit(amount)
        //   5. accounts.save(from); accounts.save(to);
        throw new UnsupportedOperationException("TODO: implement transfer()");
    }
}
