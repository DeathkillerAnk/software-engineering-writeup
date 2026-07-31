# GenAI & Agentic AI Engineering — From API Call to Forward Deployed Engineer

> A self-study curriculum that takes you from *calling an LLM API* to *designing, evaluating, and
> shipping agentic systems into a real customer's stack* — the job of a GenAI engineer and, at the
> far end, a Forward Deployed Engineer (FDE). Built for a focused 3-month intensive, and built to
> be **seen and measured**: every system here gets a diagram, and every claim gets an eval.

This is not a "prompt engineering tips" course, and it is not ML research prep. You will not train
models. The job this track prepares you for is the one companies are actually hiring for: take a
frontier model *as given*, and engineer everything around it — retrieval, tools, agent loops,
evals, guardrails, cost, latency, and the integration into a messy enterprise environment — until
it reliably does economically useful work.

A junior says *"the chatbot gives wrong answers sometimes, let me tweak the prompt."* An FDE says
*"we're seeing 12% hallucination on the answerable set; traces show retrieval returns the right
document in 9 of those 12 cases, so this is a grounding-instruction failure, not a retrieval
failure — here's the eval slice proving it, here's the revised system prompt, and here's the
regression suite that gates the next prompt change."* Everything in this track is built to grow
that second voice — and to back it with an eval score, not a vibe.

---

## Who this is for

You, specifically: an engineer in the **first couple of years** with solid backend fundamentals
(Java/Spring — see [companion tracks](#how-this-connects-to-your-other-tracks)) who wants to move
into GenAI/agentic engineering **fast, without hand-waving**. The track assumes no ML background.
It builds the mental model of what an LLM does (tokens, sampling, context, embeddings) from
scratch — just enough to reason correctly — then spends the bulk of its time where the jobs are:
**the engineering around the model**.

Two role targets, one skill tree:

| Role | What it adds |
|---|---|
| **GenAI / AI Engineer** | Parts 0–5: API engineering, RAG, agents, evals, production hardening. |
| **Forward Deployed Engineer** | All of the above **plus** Part 6: discovery, scoping, demo-driven delivery, and shipping inside a *customer's* environment. FDE = strong AI engineer × consultant instincts. |

---

## The one habit that carries this track: **never ship what you didn't eval**

The Java track's superpower is *"the JVM is a real machine — measure it."* This track has an exact
analog, and it is the single highest-leverage skill in the field:

> **LLM systems are probabilistic. The only substitute for certainty is measurement. An eval suite
> is to an AI engineer what a test suite is to a backend engineer — except you can't even trust a
> green run twice, so you learn to think in pass *rates*, not passes.**

Concretely, the loop you'll run all track long:

1. **Predict, then read.** Before each chapter, guess the answer to its title question (*"why does
   temperature 0 still give different outputs?"*, *"why do agents get worse with more tools?"*).
2. **Build the smallest real version.** Every part has a hands-on artifact — a working system, not
   a notebook of snippets.
3. **Eval it with numbers.** Build a 20–50 case test set *before* tuning. Measure the baseline.
   Every change is judged by the delta: *"chunking change moved answer accuracy 61% → 74% on my
   50-question set"* is the sentence that separates you from prompt-tweakers.
4. **Read the traces.** When a case fails, open the actual request/response trace and find *which
   step* failed (retrieval? grounding? tool choice? argument formatting?). Diagnosis from traces is
   the debugging skill of this discipline.

## Chapters

Chapters are written in the same concrete style as the other tracks — real JSON payloads, worked
token/cost math, actual failure traces — and each hard-to-picture process (attention cost growth,
the agent loop, RAG data flow, prompt-injection paths) gets a Mermaid diagram or interactive
animation. Scaffold first, chapters land part by part (see [ROADMAP](ROADMAP.md) for sequencing).

### Part 0 · How LLMs Actually Work (just enough)
- 01 · Tokens, Transformers & Why Context Is Expensive
- 02 · Sampling: Temperature, Top-p, and Why Outputs Vary
- 03 · Embeddings: Meaning as Vectors
- 04 · Context Windows, Pricing & the Cost Model

### Part 1 · Engineering the API
- 05 · Prompting as Engineering (system prompts, few-shot, structure)
- 06 · Structured Output & Getting Reliable JSON
- 07 · Tool Use: The Primitive Under Everything Agentic
- 08 · Streaming, Errors, Retries & Timeouts
- 09 · Prompt Caching, Batching & the Latency/Cost Budget

### Part 2 · Evals — the Load-Bearing Skill
- 10 · Building an Eval Suite from Scratch
- 11 · LLM-as-Judge, Graders & Knowing When to Distrust Them

### Part 3 · RAG & Retrieval
- 12 · The RAG Pipeline: Ingestion, Chunking, Indexing
- 13 · Retrieval Quality: Hybrid Search, Reranking, Metadata Filters
- 14 · Evaluating & Debugging RAG (where answers actually go wrong)

### Part 4 · Agents
- 15 · The Agent Loop: Model + Tools + Loop
- 16 · Tool Design: The API Design Problem of the Decade
- 17 · MCP: The Protocol Layer for Tools & Context
- 18 · Context Engineering: Memory, Compaction & Long-Running Agents
- 19 · Orchestration: Workflows vs Agents, Multi-Agent, Human-in-the-Loop

### Part 5 · Production
- 20 · Observability: Tracing Every Token
- 21 · Security: Prompt Injection & the Untrusted-Input Problem
- 22 · Cost, Latency & Model Selection at Scale
- 23 · Shipping: Deployment Patterns & the Java/Spring Angle

### Part 6 · The Forward Deployed Engineer
- 24 · Discovery & Scoping: Finding the Workflow Worth Automating
- 25 · The Demo-Driven POC: From First Meeting to Working Pilot
- 26 · POC → Production: Enterprise Integration, Trust & Handoff

---

## How this connects to your other tracks

- **[Java](../java/) / [Spring Boot](../spring-boot/)** — your unfair advantage as an FDE. Most
  enterprise systems you'll integrate agents *into* are Java/Spring shops. Chapter 23 builds the
  bridge (Spring AI, calling agents from services, streaming through a servlet stack).
- **[HLD](../HLD/)** — an agentic system *is* a distributed system: queues, retries, idempotency,
  partial failure. The design instincts transfer directly.
- **[LLD](../LLD/)** — tool design (Ch. 16) is interface design under a brutal constraint: your
  caller is a probabilistic model that reads the docstring.

---

## Start here

1. Read [STUDY-METHOD](ROADMAP.md#how-this-plan-works) *(method section lives in the ROADMAP for
   now)* — the eval-first loop above is the engine.
2. Follow the **[12-week ROADMAP](ROADMAP.md)** — sequenced, milestone-driven, with a hands-on
   artifact and an out-loud checkpoint every week.
