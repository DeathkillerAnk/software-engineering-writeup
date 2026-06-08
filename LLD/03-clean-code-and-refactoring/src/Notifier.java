/**
 * DRILL · 03 — a seam for the side effect. In production this could email/SMS/push;
 * in a test you pass a fake that just records what was sent. THAT is why we inject it.
 */
public interface Notifier {
    void send(String message);
}
