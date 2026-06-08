import java.util.HashMap;
import java.util.Map;

/**
 * DRILL · 06 — EXHIBIT A: over-engineering.
 *
 * The task: "say hello in English or Spanish." That's it.
 * This solution uses an interface, two strategies, a factory interface, two factories, AND a
 * registry/provider — ~7 types — to do what one switch expression does (see SimpleGreeter).
 *
 * Your job is NOT to fix this. It's to READ it, count the abstractions, and answer in README.md:
 * what FORCE (if any) would ever justify this much ceremony? (Hint: dozens of languages, loaded as
 * runtime plugins by untrusted teams — almost never the case here.) Run GreetingDemo to see that it
 * produces the exact same output as the 5-line version, having bought nothing.
 */
public final class OverEngineeredGreeter {

    interface GreetingStrategy { String greet(String name); }
    interface GreetingStrategyFactory { GreetingStrategy create(); }

    static final class EnglishGreetingStrategy implements GreetingStrategy {
        public String greet(String name) { return "Hello, " + name + "!"; }
    }
    static final class SpanishGreetingStrategy implements GreetingStrategy {
        public String greet(String name) { return "Hola, " + name + "!"; }
    }
    static final class EnglishGreetingStrategyFactory implements GreetingStrategyFactory {
        public GreetingStrategy create() { return new EnglishGreetingStrategy(); }
    }
    static final class SpanishGreetingStrategyFactory implements GreetingStrategyFactory {
        public GreetingStrategy create() { return new SpanishGreetingStrategy(); }
    }
    static final class GreetingStrategyFactoryProvider {
        private final Map<String, GreetingStrategyFactory> registry = new HashMap<>();
        GreetingStrategyFactoryProvider() {
            registry.put("en", new EnglishGreetingStrategyFactory());
            registry.put("es", new SpanishGreetingStrategyFactory());
        }
        GreetingStrategyFactory getFactory(String lang) {
            return registry.getOrDefault(lang, new EnglishGreetingStrategyFactory());
        }
    }

    private final GreetingStrategyFactoryProvider provider = new GreetingStrategyFactoryProvider();

    public String greet(String lang, String name) {
        GreetingStrategyFactory factory = provider.getFactory(lang);
        GreetingStrategy strategy = factory.create();
        return strategy.greet(name);
    }
}
