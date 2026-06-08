# Part 6 · Principal Skills

> The meta-skills that actually define the level. Everything before this was *knowledge*; this is
> *judgment* — how to reason about performance with data instead of folklore, how to answer
> questions no blog covers by going to the source, and what to keep learning.
> [← curriculum index](../README.md)

You can know every fact in Parts 0–5 and still not operate like a principal. The difference is what
you do when you *don't* already know the answer: do you guess, or do you have a method? This part is
that method.

---

## Learning objectives — what "I know this" actually means

By the end of this part you can, **from memory and out loud**:

- Run a performance investigation as a disciplined loop — hypothesis → measure → locate → change →
  re-measure — and name the ways you might fool yourself at each step.
- Settle a "how does Java behave?" dispute by going to the **primary source**: find the relevant
  paragraph in the JLS or JVMS, the relevant JEP, or the relevant JDK source.
- Read OpenJDK source to answer a question the docs don't (and know it's some of the most readable
  code you'll find).
- Track the platform's evolution — what changed between LTS releases and why — so your knowledge
  doesn't quietly go stale.
- Choose what to study next based on where you're trying to go.

## Topic checklist

- [ ] **29 · Performance Reasoning & Data-Driven Trade-offs** — the investigation loop; forming a
      *falsifiable* hypothesis; measuring the right thing (throughput vs latency vs allocation vs
      tail); avoiding self-deception (warmup, observer effect, confirmation bias); writing the
      internals memo — hypothesis, evidence, conclusion, recommendation — that a principal produces.
- [ ] **30 · Reading the Specs & the Source** — how the JLS and JVMS are organized and how to find
      the one section you need (class loading → JVMS Ch. 5; `volatile`/happens-before → JLS Ch. 17;
      an instruction → JVMS Ch. 6); reading JEPs to understand *why* a feature exists; navigating
      OpenJDK on GitHub; reading a JDK class (`HashMap`, `AQS`, `ThreadPoolExecutor`) to settle a
      behavior question.
- [ ] **31 · The Java Internals Reading List** — the curated map of specs, books, talks, blogs, and
      people; sequenced by what to read *during* this track vs *after*; what to read for where you're
      headed (GC engineer? performance? distributed systems on the JVM?).

## The principal-level insight

**A principal is defined not by what they know but by their method when they don't know — and the
two highest-leverage methods are "measure it" and "read the primary source."** Everyone above
mid-level has a pile of facts; what makes someone the person the team trusts on the JVM is that when
a genuinely novel question lands ("why does *this specific thing* pause / allocate / behave
strangely?"), they don't reach for a Stack Overflow answer or a confident guess — they form a
hypothesis, *interrogate a real JVM*, and if the behavior is subtle, *go read the JVMS or the
OpenJDK source* until they can state the answer with a citation. This is learnable, it's faster than
it sounds, and it compounds: every investigation makes the next one quicker. It's also the most
*transferable* skill here — the JVM will change, but "measure, then check the spec" outlives any
version.

## Drills (build, don't just read)

1. **Write the memo.** Take a real performance or behavior question from your work, run the
   investigation loop on it, and write a one-page internals memo: hypothesis, what you measured (with
   the numbers), what you concluded, what you'd change. This is *the* principal artifact — repeat it
   for every production oddity forever.
2. **Settle it with the spec.** Pick three things you "know" about Java (e.g. "static init runs on
   first use," "`volatile` gives ordering," "string `+` uses `StringBuilder`") and find the exact
   JLS/JVMS section or JEP that confirms or *corrects* you. At least one will surprise you.
3. **Read the source for a surprise.** Next time the JDK does something you didn't expect, open the
   class on GitHub and read until you understand it. Write the one-paragraph explanation.
4. **Map the evolution.** For the last few LTS releases (8 → 11 → 17 → 21 → …), list one internals
   change each (e.g. PermGen→metaspace, G1 default, biased-locking removal, virtual threads) and why
   it happened. This is how you keep folklore from creeping back in.

## Interview lens

At the staff/principal bar, interviewers stop testing facts and start testing *judgment and
sourcing*: *"You're not sure whether X is guaranteed — how would you find out?"* (spec/JEP/source,
not "I'd google it"), *"How would you investigate a regression you've never seen?"* (the loop),
*"How do you keep up with the platform?"* The candidate who reaches for primary sources and a
measurement discipline reads as someone who can be *trusted with the unknown* — which is the actual
job at that level.

## Visualizations

Light here by design — this part is method, not mechanism. Planned: a **JVM/Java evolution
timeline** (Mermaid) marking the internals-relevant changes per LTS, and a **diagnosis-routing
flowchart** (symptom → first tool) that consolidates Part 5. See [`visualizations/`](visualizations/)
and the catalog in [VISUALIZATIONS.md](../VISUALIZATIONS.md).
