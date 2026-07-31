# 30 · Reading the Specs & the Source

> When blogs disagree and Stack Overflow hedges, the answer is in three primary sources: the **JLS**
> (the language), the **JVMS** (the machine), and the **OpenJDK source** (the implementation). Knowing
> *which* one holds your question — and how to navigate to the one section — is a superpower few
> engineers build.
> [← Part 6 · Principal Skills](README.md) · prev: 29 · Performance Reasoning · next: 31 · The Reading List

> **Predict first (2 min).** Three questions: (a) "what exactly does `volatile` guarantee?",
> (b) "what does the `invokevirtual` instruction do?", (c) "when exactly does `HashMap` treeify a
> bucket?" Which source answers each — JLS, JVMS, or the JDK source? Write your guesses.

---

## The three sources and what each owns

- **JLS (Java Language Specification):** the *language* — syntax, types, semantics, and crucially the
  **Java Memory Model**. Questions about what code *means*.
- **JVMS (JVM Specification):** the *machine* — class-file format, loading/linking/initialization,
  bytecode instructions, verification. Questions about what the VM *does*.
- **OpenJDK source:** the *implementation* — behavior the specs leave open (growth factors,
  thresholds, algorithms). Questions about what *this JDK actually does*.

The prediction's answers: (a) **JLS §17** (happens-before, [ch.16](../03-concurrency-and-jmm/));
(b) **JVMS §6** (instruction set, [ch.02](../00-platform-and-mental-model/)); (c) **the source** —
`TREEIFY_THRESHOLD = 8` is an implementation constant in `HashMap.java`
([ch.21](../04-language-in-depth/)), not spec'd anywhere.

## Navigating by question (the lookup table)

| Your question is about… | Go to |
|---|---|
| happens-before, `volatile`, `final` field semantics | **JLS Ch. 17** |
| generics, erasure, overload resolution | JLS Ch. 4–5, 8, 15 |
| class loading / linking / initialization order | **JVMS Ch. 5** ([ch.03](../00-platform-and-mental-model/)) |
| class-file format, constant pool | JVMS Ch. 4 |
| one bytecode instruction's exact behavior | **JVMS Ch. 6** (alphabetical) |
| *why* a feature exists, its design alternatives | **the JEP** (openjdk.org/jeps) |
| a threshold, a growth factor, an actual algorithm | **the JDK source** |

⚡ Reading a **JEP** is the highest ratio of insight to effort in the ecosystem: motivation, design
choices, *rejected alternatives* — the "why" no reference doc gives you. (JEP 444 virtual threads,
JEP 395 records, JEP 254 compact strings — all met earlier in this track.)

## Reading the JDK source without drowning

The source is on GitHub (`openjdk/jdk`); the classes you'll settle arguments with live in
`src/java.base/share/classes/java/util/` and `.../concurrent/`:

- **Read the class javadoc first** — `HashMap`'s header explains treeification; `AQS`'s is a design
  document; `ThreadPoolExecutor`'s explains every policy knob. These are among the best-written docs
  in software.
- **Then constants, then the one method** you care about (`resize()`, `putVal()`) — never top-to-bottom.
- ⚡ In the IDE, **Cmd/Ctrl-click into the JDK** while debugging: stepping into `HashMap.put` with
  your own data is the fastest way to *own* a data structure's behavior.
- Distinguish **spec'd** (portable, stable) from **implementation detail** (can change per release —
  another reason [VERSION-CHANGES.md](../VERSION-CHANGES.md) exists). Depend on the former; know the
  latter.

## Make it visible

- **Settle one argument from the JLS.** "Does `volatile` make `x++` atomic?" Find the JLS 17 answer
  (no — happens-before ≠ atomicity) and cite chapter and verse.
- **Look up one instruction.** Take `invokevirtual` from your own `javap` output
  ([ch.02](../00-platform-and-mental-model/)) and read its JVMS §6 entry — resolution, dispatch, the
  operand stack effect.
- **Read one JDK class header.** `AbstractQueuedSynchronizer`'s javadoc, end to end — then re-explain
  [ch.18](../03-concurrency-and-jmm/) to yourself with new precision.

## Self-Check (close the doc, answer out loud)

1. JLS vs JVMS vs source — what does each own? Route these: happens-before / class-init order / treeify threshold.
2. Where do you find one bytecode instruction's exact semantics?
3. What do JEPs give you that no reference doc does?
4. What's the right order for reading a JDK class, and why never top-to-bottom?
5. Spec'd behavior vs implementation detail — why must a principal keep them distinct?

> **Go deeper:** bookmark docs.oracle.com/javase/specs (JLS+JVMS per release) and openjdk.org/jeps/0;
> then [31 · The Java Internals Reading List](README.md) — the curated map of everything beyond.
