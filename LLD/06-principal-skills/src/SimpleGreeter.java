/**
 * DRILL · 06 — EXHIBIT B: the same behavior, no ceremony.
 *
 * One method, one switch. When a real force appears (say, 40 languages from translation files),
 * THEN you refactor toward a Map or a strategy — earning the abstraction instead of guessing it.
 * Until then, this is the principal-level answer: the simplest thing that solves the actual problem.
 */
public final class SimpleGreeter {
    public String greet(String lang, String name) {
        return switch (lang) {
            case "es" -> "Hola, " + name + "!";
            default   -> "Hello, " + name + "!";
        };
    }
}
