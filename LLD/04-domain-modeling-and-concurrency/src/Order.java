/**
 * DRILL · 04 — make illegal states UNREACHABLE.
 *
 * Compiles as-is, but the transition methods don't guard their state, so illegal moves (collect a
 * NEW order, pay twice) silently succeed and OrderTest is RED. Add guards so an invalid transition
 * throws IllegalStateException — putting the rule in ONE place instead of scattered if-checks.
 *
 *   Run:  cd 04-domain-modeling-and-concurrency/src && javac *.java && java OrderTest
 *
 * Legal transitions:
 *   NEW --pay--> PAID --prepare--> PREPARING --ready--> READY --collect--> COLLECTED
 *   NEW/PAID --cancel--> CANCELLED
 */
public final class Order {

    public enum Status { NEW, PAID, PREPARING, READY, COLLECTED, CANCELLED }

    private Status status = Status.NEW;

    public Status status() { return status; }

    public void pay() {
        // TODO: only legal from NEW — otherwise throw new IllegalStateException(...)
        status = Status.PAID;
    }

    public void prepare() {
        // TODO: only legal from PAID
        status = Status.PREPARING;
    }

    public void ready() {
        // TODO: only legal from PREPARING
        status = Status.READY;
    }

    public void collect() {
        // TODO: only legal from READY
        status = Status.COLLECTED;
    }

    public void cancel() {
        // TODO: only legal from NEW or PAID
        status = Status.CANCELLED;
    }

    // Hint for the guards:
    //   private void require(Status expected) {
    //       if (status != expected) throw new IllegalStateException("cannot do that from " + status);
    //   }
    // (cancel() allows two source states, so guard it slightly differently.)
}
