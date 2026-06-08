# Part 0 · The Platform & Mental Model

> What the JVM *is*, and what happens in the gap between `javac` and a running method. Everything
> later — GC, the JIT, the memory model — is a detail of the machine you build a model of here.
> [← curriculum index](../README.md)

This is the part it's most tempting to skip and most expensive to skip. You can write Java for
years without knowing what's in a `.class` file or how a class is loaded — right up until you hit a
`NoClassDefFoundError` you can't explain, a static initializer that runs at a surprising moment, or
a "why is this slow before it's fast?" question. All of those bottom out here.

---

## Learning objectives — what "I know this" actually means

By the end of this part you can, **from memory and out loud**:

- Trace a single method from `Foo.java` all the way to native instructions, naming what `javac`, the
  class loader, the interpreter, and the JIT each contribute — and *when*.
- Read real bytecode with `javap -c`, explain the operand-stack model, and predict the bytecode a
  small snippet will compile to before you look.
- Recite the class lifecycle — **load → verify → prepare → resolve → initialize** — and explain the
  parent-delegation model and one concrete bug it prevents.
- State exactly when a class's static initializer (`<clinit>`) runs.
- Draw the JVM runtime data areas, say which are per-thread vs shared, and map any value in a
  program to the area it lives in — and name which error each area throws when exhausted.

## Topic checklist

- [ ] **01 · The Java Platform & Execution Pipeline** — JDK vs JRE vs JVM; the compile-once /
      interpret / profile / JIT / deoptimize loop; why "write once, run anywhere" is a *runtime*
      property; what bytecode portability actually guarantees.
- [ ] **02 · The Class File & Bytecode** — the `.class` layout (magic, version, constant pool,
      fields, methods, attributes); the constant pool as the file's symbol table; the operand-stack
      execution model; `invokevirtual`/`invokestatic`/`invokespecial`/`invokeinterface`/`invokedynamic`;
      reading `javap -c -p -v`.
- [ ] **03 · Class Loading, Linking & Initialization** — the five-phase lifecycle; bootstrap →
      platform → application loaders; parent delegation and what it prevents; `<clinit>` trigger
      conditions; custom class loaders and where they're used (app servers, plugins, hot reload).
- [ ] **04 · JVM Runtime Data Areas** — heap (shared), per-thread JVM stacks + frames + PC register,
      metaspace (class metadata, *native* memory, not heap), the code cache, native memory; which
      area throws `StackOverflowError` vs `OutOfMemoryError` (and its several flavors).

## The principal-level insight

**"Java" is two completely different things wearing one name — and almost every confusion comes
from conflating them.** There's the *language* (what `javac` checks and compiles) and the *platform*
(the JVM that loads, verifies, and runs bytecode). The bytecode in between is a stable contract that
both sides target independently. That's why Kotlin, Scala, and Clojure run on the JVM (they emit the
same bytecode), why "write once, run anywhere" is about the *runtime* and not the compiler, and why
the JVM can keep getting faster at running your unchanged `.class` files. Once you see the language
and the platform as separate layers meeting at the bytecode contract, the rest of this curriculum
stops being a pile of facts and becomes the story of *one machine* — the JVM — doing its job.

## Drills (build, don't just read)

1. **Bytecode prediction.** Write five small snippets (a ternary, a `for` loop, a `switch`, a string
   concat, an autoboxed `Integer`). *Predict the bytecode*, then check with `javap -c`. Reconcile
   every surprise — the surprises are the syllabus.
2. **Write a class loader.** Load a class from a `byte[]` you read off disk yourself. Then make two
   loaders load the "same" class and prove they're *different* types (`a.getClass() != b.getClass()`)
   — the foundation of how app servers isolate apps.
3. **Trigger `<clinit>` on purpose.** Construct cases where a static initializer does and does *not*
   run (accessing a constant vs a static method vs a subclass). Confirm with a print in the initializer.
4. **Break each memory region.** Write three tiny programs that throw, respectively, a
   `StackOverflowError`, a heap `OutOfMemoryError: Java heap space`, and a metaspace OOM. Read each
   message — knowing them cold saves hours in production.

## Interview lens

This part shows up in senior/staff interviews as "do you actually understand the platform, or just
the syntax?" Classic probes: *"What happens when you run `java Foo`?"* (delegated loading →
`main` → interpret → JIT), *"What's the difference between the stack and the heap here?"*, *"When
does a static block run?"*, *"Why two `ClassLoader`s can load the same class name as different
types."* The bytecode/operand-stack model also underlies any "how does Java do X under the hood"
follow-up. You're being tested on whether your mental model is layered and correct, not on trivia.

## Visualizations

See [`visualizations/`](visualizations/) for this part's animations (the execution pipeline, the
operand-stack machine, and classloader delegation). Full philosophy and catalog in
[VISUALIZATIONS.md](../VISUALIZATIONS.md).
