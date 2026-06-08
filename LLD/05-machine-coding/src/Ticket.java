/** Proof of parking. Records WHICH size of spot was actually used, so leave() can free the right one. */
public record Ticket(String plate, Size spotUsed) { }
