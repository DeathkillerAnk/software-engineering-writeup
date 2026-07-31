# 28 · Startup, Footprint & Native Image

> The JVM's grand trade — slow start, huge peak — stops being right when the workload is a CLI, a
> lambda, or a scale-to-zero pod. This chapter is the startup toolbox: CDS, AOT, and GraalVM
> **native image**, and how to choose per workload instead of by fashion.
> [← Part 5 · I/O, Interop & Deployment](README.md) · prev: 27 · Diagnostics & Observability

> **Predict first (2 min).** A JVM service takes ~4s to start and minutes to reach peak throughput; a
> native-image build of the same app starts in ~50ms. So why would anyone *not* ship native image for
> everything — what two things does it give up? Write your guesses.

---

## Why JVM startup is slow (recap of the pipeline)

Startup cost = load & verify thousands of classes ([ch.03](../00-platform-and-mental-model/)) + run
initializers + **interpret** everything cold ([ch.10](../02-execution-and-performance/)) + profile +
JIT-compile the hot paths over minutes ([ch.11](../02-execution-and-performance/)). That's the warmup
curve: instant liveness, delayed *peak*. For a long-running server it's a great trade — you pay
seconds once for hours at maximum speed. For short-lived processes it's pure overhead.

## The toolbox, in escalation order

- **CDS / AppCDS (class-data sharing):** dump the parsed/verified class metadata to an archive once;
  later JVMs **memory-map** it instead of re-parsing — cuts class-loading time meaningfully, shares
  metadata across JVMs, zero programming-model change. (`-XX:SharedArchiveFile`, and modern JDKs
  auto-use a default archive.)
- **AOT-ish warmup helpers:** Project **Leyden** (and CRaC's checkpoint/restore) aim to shift more
  JIT/startup work to build time or restore from a snapshot — same programming model, shorter
  time-to-peak. Direction of travel, workload-dependent maturity.
- **GraalVM native image:** compile the whole app **ahead-of-time to a native executable** — the big
  hammer.

## Native image: the closed world and its two prices

Native image analyzes your app at **build time**, assumes a **closed world** (everything reachable
must be provable then), and emits a static binary: **~10–100ms start, tens-of-MB RSS**, no JVM to
ship. The prediction's answers — what it gives up:

1. **Peak throughput & adaptability.** There is **no JIT** at runtime: no profile-guided
   recompilation, no speculative optimization/deopt ([ch.11–12](../02-execution-and-performance/)).
   Peak is typically *below* a warmed JVM, and it can't adapt to changing workload shape. (PGO builds
   narrow but don't erase this.)
2. **Dynamic Java.** **Reflection, dynamic proxies, `MethodHandle` tricks, runtime class loading and
   bytecode generation** all break the closed-world assumption — they need **build-time
   configuration** (reachability metadata) or they fail at runtime. This is why frameworks needed
   AOT engines ([spring ch.28](../../spring-boot/05-production/)) to make themselves native-friendly.

Also: **build time** is long (minutes of whole-program analysis), and some observability tooling
(agents, full JFR) is reduced.

## Choosing per workload

| Workload | Pick | Why |
|---|---|---|
| CLI tools, serverless/lambda, scale-to-zero | **native image** | cold-start dominates; peak barely matters |
| Long-running high-throughput server | **JVM (+CDS)** | warmup amortized to ~0; JIT peak & adaptability win |
| Startup-sensitive but JIT-dependent | **CDS/AppCDS, Leyden/CRaC** | shorten the curve, keep the model |

⚡ The principal framing: **startup latency vs peak throughput is a spectrum, not a verdict** — place
each service on it deliberately. Don't ship native image for a 24/7 hot-path service "because fast
startup," and don't eat 4s cold starts in a lambda "because JVM."

> ▶ **Watch it:** [`startup-vs-peak.html`](visualizations/startup-vs-peak.html) — JVM vs native-image
> throughput curves over time: native jumps instantly to its (lower) plateau; the JVM climbs through
> interpret → C1 → C2 to a higher peak.

## Make it visible

- **Measure the curve.** Time the *same* endpoint every second after starting a Boot app: watch
  latency fall over the first minutes as C2 kicks in — that's warmup as data ([ch.13](../02-execution-and-performance/)).
- **Try CDS.** Run with `-Xshare:off` vs default (or an AppCDS archive) and time startup — parsed-class
  mapping is real, free speed.
- **Build a native hello.** `native-image` a small app: note the multi-minute build, the ~ms start,
  and then break it — add a `Class.forName(readLine())` and watch the closed world object.

## Self-Check (close the doc, answer out loud)

1. Name the four contributors to JVM startup/warmup cost.
2. What does CDS/AppCDS actually cache, and why is it "free" (no model change)?
3. What is the closed-world assumption, and which Java features fight it?
4. What are native image's two big sacrifices, and its two big wins?
5. Place these on the spectrum: a lambda, a trading gateway, a CLI, a 24/7 REST service.

> **Go deeper:** GraalVM native-image docs (reachability metadata, PGO); JEP 483 / CDS docs;
> Project Leyden & CRaC; then [spring ch.28](../../spring-boot/05-production/) — how Boot's AOT engine
> makes a DI framework survive the closed world. 🎉 This closes **java Part 5**.
