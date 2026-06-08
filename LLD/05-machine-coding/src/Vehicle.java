/** A vehicle is a value: identified by its data. (record = free equals/hashCode/toString — see 00.) */
public record Vehicle(String plate, Size size) { }
