import java.math.BigDecimal;
// import java.util.Objects;   // <-- you'll want this for hashCode (TODO 5)

/**
 * DRILL · 00-foundations — Value Object.
 *
 * Money is a VALUE OBJECT: it has no identity, it simply *is* its data.
 *   - Immutable (you can't change a $5; you make a new value).
 *   - Equality is by VALUE (any $5 USD equals any other $5 USD).
 *   - It must work correctly as a HashMap key (see the equals/hashCode animation).
 *
 * This file COMPILES as-is, but MoneyTest will show several RED failures.
 * Complete the TODOs one at a time and watch them go GREEN.
 *
 *   Run:  cd 00-foundations/src && javac Money.java MoneyTest.java && java MoneyTest
 */
public final class Money {

    // 'final' fields = immutability. Once set in the constructor, they never change.
    private final BigDecimal amount;
    private final String currency;     // 3-letter code, e.g. "USD"

    public Money(BigDecimal amount, String currency) {
        // TODO 1: An invalid Money should be IMPOSSIBLE to construct.
        //         Reject a null amount and a null currency (throw, e.g., NullPointerException
        //         or IllegalArgumentException). Right now the test "rejects null ..." is RED.
        this.amount = amount;
        this.currency = currency;
    }

    public BigDecimal amount()  { return amount; }
    public String     currency(){ return currency; }

    /** Returns a NEW Money equal to (this + other). Must NOT mutate `this`. */
    public Money plus(Money other) {
        // TODO 2: reject null `other` and a currency mismatch (can't add USD + EUR),
        //         then return a NEW Money(this.amount + other.amount, currency).
        throw new UnsupportedOperationException("TODO 2: implement plus()");
    }

    /** Returns a NEW Money equal to (this - other). */
    public Money minus(Money other) {
        // TODO 3: like plus(), but subtract.
        throw new UnsupportedOperationException("TODO 3: implement minus()");
    }

    // TODO 4: override equals() — two Money are equal IFF same currency AND same amount.
    //         Remember the contract: handle null, handle a non-Money argument.
    //
    // TODO 5: override hashCode() — it MUST be consistent with equals()
    //         (equal objects -> equal hashCode). Objects.hash(amount, currency) is the easy way.
    //
    //   Until TODO 4 & 5 are done, Money uses Object's identity equals/hashCode, so two
    //   "equal" $5 values are treated as DIFFERENT — and the HashMap test fails in exactly
    //   the way the equals-hashCode animation demonstrates.

    @Override public String toString() { return amount + " " + currency; }

    // --- STRETCH (optional, after green) -------------------------------------
    // BigDecimal("5.0").equals(BigDecimal("5.00")) is FALSE (scale matters!), though
    // compareTo says they're equal. How would you make Money($5.0) equal Money($5.00)?
    // Hint: normalize the scale (or compareTo) — and keep equals/hashCode consistent.
}
