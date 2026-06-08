import java.util.Optional;

/** Zero-dependency runner. cd 05-machine-coding/src && javac *.java && java ParkingLotTest */
public class ParkingLotTest {
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
    static Vehicle car()   { return new Vehicle("CAR-1", Size.SMALL); }
    static Vehicle truck() { return new Vehicle("TRK-1", Size.LARGE); }

    public static void main(String[] args) {
        System.out.println("\n  Parking Lot drill — turn every ❌ into ✅\n");

        System.out.println("  -- capacity --");
        check("a fresh lot reports its free spots", () -> {
            var lot = new ParkingLot(2, 3);
            return lot.available(Size.SMALL) == 2 && lot.available(Size.LARGE) == 3;
        });

        System.out.println("\n  -- basic parking --");
        check("a small car takes a SMALL spot", () -> {
            var lot = new ParkingLot(1, 1);
            Optional<Ticket> t = lot.park(car());
            return t.isPresent() && t.get().spotUsed() == Size.SMALL && lot.available(Size.SMALL) == 0;
        });
        check("a large vehicle takes a LARGE spot", () -> {
            var lot = new ParkingLot(1, 1);
            Optional<Ticket> t = lot.park(truck());
            return t.isPresent() && t.get().spotUsed() == Size.LARGE && lot.available(Size.LARGE) == 0;
        });

        System.out.println("\n  -- the interesting rules --");
        check("a small car OVERFLOWS into a LARGE spot when no small is free", () -> {
            var lot = new ParkingLot(0, 1);
            Optional<Ticket> t = lot.park(car());
            return t.isPresent() && t.get().spotUsed() == Size.LARGE;
        });
        check("a large vehicle does NOT fit a small spot (returns empty)", () -> {
            var lot = new ParkingLot(5, 0);
            return lot.park(truck()).isEmpty();
        });
        check("a full lot returns empty", () -> {
            var lot = new ParkingLot(1, 0);
            lot.park(car());                 // fills the only spot
            return lot.park(car()).isEmpty();
        });

        System.out.println("\n  -- leaving frees the spot --");
        check("leaving frees the exact spot that was used", () -> {
            var lot = new ParkingLot(1, 1);
            Ticket t = lot.park(car()).orElseThrow();
            lot.leave(t);
            return lot.available(Size.SMALL) == 1;
        });
        check("overflow leave frees the LARGE spot", () -> {
            var lot = new ParkingLot(0, 1);
            Ticket t = lot.park(car()).orElseThrow();   // parked in a large spot
            lot.leave(t);
            return lot.available(Size.LARGE) == 1;
        });

        System.out.println("\n  " + passed + " passed, " + failed + " failed.");
        System.out.println(failed == 0
                ? "\n  🎉 All green. Now extend it: a PricingStrategy seam, or per-spot ids. (See the rubric.)\n"
                : "\n  Implement ParkingLot.park() and leave() per the allocation rules.\n");
    }
}
