/**
 * DRILL · 03 — a seam for time. Wall-clock time makes code non-deterministic and untestable;
 * an injected Clock lets a test pin "now" to a fixed value.
 */
public interface Clock {
    long epochMillis();
}
