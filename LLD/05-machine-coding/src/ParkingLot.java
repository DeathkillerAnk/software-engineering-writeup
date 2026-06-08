import java.util.Optional;

/**
 * DRILL · 05 — implement the allocation logic.
 *
 * Compiles as-is, but park() always returns empty and leave() does nothing, so ParkingLotTest is RED.
 * Allocation rules:
 *   - a SMALL vehicle prefers a SMALL spot, but may OVERFLOW into a LARGE spot if no small is free;
 *   - a LARGE vehicle needs a LARGE spot (it does not fit in a small one);
 *   - if nothing fits, park() returns Optional.empty() (the lot is full for that vehicle).
 *
 *   Run:  cd 05-machine-coding/src && javac *.java && java ParkingLotTest
 */
public final class ParkingLot {

    private int freeSmall;
    private int freeLarge;

    public ParkingLot(int smallSpots, int largeSpots) {
        this.freeSmall = smallSpots;
        this.freeLarge = largeSpots;
    }

    /** How many spots of the given size are currently free. */
    public int available(Size size) {
        return size == Size.SMALL ? freeSmall : freeLarge;
    }

    public Optional<Ticket> park(Vehicle v) {
        // TODO: implement the allocation rules above. Decrement the chosen spot's free count and
        //       return Optional.of(new Ticket(v.plate(), <size of spot used>)); else Optional.empty().
        return Optional.empty();
    }

    public void leave(Ticket t) {
        // TODO: free the spot recorded on the ticket (increment freeSmall or freeLarge).
    }
}
