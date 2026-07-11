import java.math.BigDecimal;

/**
 * DRILL · 07 — a domain ENTITY (identity = id) that guards its own invariant (no overdraft).
 * Complete — nothing to do here. Notice the rule lives ON the entity (rich model, see 04), not in
 * the service: debit() refuses to go negative, and checks BEFORE it mutates, so a failed transfer
 * leaves the balance untouched.
 */
public final class Account {
    private final String id;
    private BigDecimal balance;

    public Account(String id, BigDecimal balance) {
        this.id = id;
        this.balance = balance;
    }

    public String id()       { return id; }
    public BigDecimal balance() { return balance; }

    public void debit(BigDecimal amount) {
        if (balance.compareTo(amount) < 0)
            throw new IllegalStateException("insufficient funds in " + id);
        balance = balance.subtract(amount);
    }

    public void credit(BigDecimal amount) {
        balance = balance.add(amount);
    }
}
