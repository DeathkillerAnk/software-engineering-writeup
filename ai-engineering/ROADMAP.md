# The 12-Week GenAI & Agentic AI Intensive

> A sequenced, milestone-driven plan from *first API call* to *FDE-grade delivery*: RAG, agents,
> evals, production hardening, and the consultative skills of a Forward Deployed Engineer.
> [← back to the index](README.md)

## How this plan works

- **12 weeks, 7 parts.** Each week: 1–3 chapters, a hands-on build, and a checkpoint you must pass
  **out loud, from memory**. Recognition ≠ recall.
- **Everything gets an eval.** The track's core habit: build the test set *before* tuning, judge
  every change by the score delta, debug from traces. This is the analog of the Java track's
  "measure it on a real JVM."
- **One project grows all track long.** Week 2 you build a support-ticket assistant as bare API
  calls. It gains structured output (W2), an eval suite (W3), RAG over a docs corpus (W4–5), tools
  and an agent loop (W6–7), MCP (W7), observability and injection defenses (W9–10), and becomes
  your **capstone demo** (W11–12). One artifact, twelve weeks of layers — exactly how real
  deployments evolve.
- **Set up your lab in Week 1.** An Anthropic API key, Python + the `anthropic` SDK (plus
  TypeScript if you prefer), a tokenizer to count tokens, a scratch repo, and a tracing tool
  (start with plain JSONL logging of every request/response; graduate to Langfuse/Braintrust-style
  tracing in Week 9). You'll use all of it every week.

### Companion sources (read in parallel)

| Source | Best for |
|---|---|
| **Anthropic docs & cookbook** (docs.anthropic.com) | The primary source for Parts 0–1 & 4: tool use, structured output, caching, agent patterns. |
| **"Building Effective Agents"** (Anthropic engineering blog) | The workflow-vs-agent taxonomy used in Ch. 19. Read it twice. |
| ***AI Engineering*** (Chip Huyen) | The whole-track companion: evals, RAG, deployment, cost. Closest book to this track. |
| **MCP specification** (modelcontextprotocol.io) | Primary source for Ch. 17. |
| **OWASP LLM Top 10** | The security chapter's skeleton (Ch. 21). |
| **Vendor engineering blogs** (Anthropic, OpenAI, LangChain state-of-agents posts) | Field notes; the field moves too fast for books alone. |

### Suggested daily cadence (intensive, ~2–3 focused hours)

| Block | Time | What |
|---|---|---|
| **Warm-up recall** | 15 min | Answer yesterday's self-check from memory; redraw yesterday's diagram. |
| **New material** | 50–70 min | Read the day's chapter using *predict → read → self-check*. |
| **Build & eval** | 40–60 min | Extend the running project; run the eval suite; read one failing trace end-to-end. |
| **Weekly (pick a day)** | 45 min | Ship the week's artifact *or* explain the week's hardest mechanism out loud. |

> **The single most important habit:** end every session by writing one sentence of the form
> *"I changed X, the score went from A to B, because trace-reading showed Z."* That sentence is
> the learning — and it's also exactly the sentence an FDE says to a customer.

---

## Phase 1 · The Model as a Component (Week 1) → Part 0

You don't need ML theory, but you do need a *correct* mental model — most bad GenAI engineering
comes from treating the model as either magic or a database.

### Week 1 — What you're actually calling
- **Read:** 01 · Tokens, Transformers & Why Context Is Expensive, 02 · Sampling, 03 · Embeddings, 04 · Context Windows, Pricing & Cost
- **Master these questions:**
  - What is a token? Why is `"strawberry"` letter-counting hard for a model, and why does cost/latency scale with tokens, not characters?
  - Walk one generation step: prompt in → next-token distribution → sampling. What do temperature and top-p actually change? Why isn't temperature 0 fully deterministic in practice?
  - What is an embedding? Why does cosine similarity of two sentence vectors approximate "relatedness," and what are its known failure cases (negation, numbers)?
  - Why does attention make long context quadratic-ish in cost, and what does that imply for "just stuff everything in the prompt"?
- **Hands-on:** Set up the lab. Make raw API calls (no framework). Count tokens for five prompts and hand-compute their cost from the pricing page. Sweep temperature 0 → 1 on the same prompt, 10 runs each, and chart output variance. Embed 20 sentences and build a tiny nearest-neighbor search with numpy — no vector DB yet.
- ✅ **Checkpoint:** From memory, explain to a rubber duck what happens between hitting enter and the first streamed token — tokenization, prefill, decode — and estimate the monthly cost of a described workload within 2×.

---

## Phase 2 · API Engineering & Evals (Weeks 2–3) → Parts 1–2

The unglamorous layer every job interview probes and every production incident traces back to.

### Week 2 — The engineering surface of the API
- **Read:** 05 · Prompting as Engineering, 06 · Structured Output, 07 · Tool Use, 08 · Streaming, Errors & Retries, 09 · Caching, Batching & Budgets
- **Master these questions:**
  - What belongs in a system prompt vs the user turn? Show a prompt with role, task, constraints, output format, and few-shot examples — and say what each section buys you.
  - Three ways to get reliable JSON out of a model, in order of reliability. What does schema-constrained output guarantee, and what does it *not* (semantic correctness)?
  - Trace one tool-use round trip: the tool definition JSON schema → `tool_use` block → your code executes → `tool_result` → final answer. Who actually runs the tool?
  - What's your retry policy for a 429 vs a 529 vs a timeout mid-stream? Why is idempotency suddenly your problem again?
  - How does prompt caching work (prefix matching), what does it cost/save, and how should it reorder your prompt layout?
- **Hands-on:** **Start the running project**: a support-ticket assistant that takes a raw customer email and returns schema-validated JSON (`category`, `urgency`, `draft_reply`, `needs_human: bool`). Give it one tool (`lookup_order_status`, stubbed). Add streaming, timeouts, and retry with backoff. Restructure the prompt so the static 2k-token instruction block is cache-hit on every call — prove the cache hit from the usage fields in the response.
- ✅ **Checkpoint:** Whiteboard the full tool-use loop from memory, and state your production defaults: timeout, retry policy, max tokens, and where the cache boundary sits — with a one-line justification each.

### Week 3 — Evals: the load-bearing skill
- **Read:** 10 · Building an Eval Suite from Scratch, 11 · LLM-as-Judge & Graders
- **Master these questions:**
  - Why is "I tried it a few times and it looks good" professionally negligent for LLM systems? What's the minimum viable eval (≈20–50 cases, pass-rate, run-on-every-change)?
  - Name the grader hierarchy: exact match → code-checked assertions → LLM-as-judge. When is each trustworthy? What are the two classic judge biases (position, verbosity/self-preference) and how do you control for them?
  - What's the difference between an eval, a regression suite, and a benchmark? Why do public benchmarks tell you almost nothing about *your* task?
  - How many runs do you need before "74% vs 71%" means anything? (Think in confidence, not points.)
- **Hands-on:** Build a 40-case eval set for the ticket assistant from realistic (synthetic) emails: expected category, urgency, and whether escalation is required. Write a runner that outputs a pass-rate table by slice. Grade `draft_reply` with an LLM judge using a written rubric; hand-grade 20 replies yourself and report judge–human agreement. Now "improve the prompt" and *prove it* with the delta.
- ✅ **Checkpoint:** Explain your eval design out loud: what's code-graded vs judge-graded and why, what the baseline score is, and what score change you'd consider real. This checkpoint gates the rest of the track — every later week reports its score.

---

## Phase 3 · RAG & Retrieval (Weeks 4–5) → Part 3

Still the most-deployed GenAI pattern in the enterprise, and the most common FDE first project.

### Week 4 — The pipeline
- **Read:** 12 · The RAG Pipeline: Ingestion, Chunking, Indexing
- **Master these questions:**
  - Draw the two-phase picture: ingestion (load → chunk → embed → index) vs query (embed → retrieve → stuff → generate). Which decisions are set at ingestion time and expensive to change?
  - Chunking trade-offs: what breaks with 100-token chunks, what breaks with 4000-token chunks? What do overlap, heading-aware splitting, and contextual chunk headers buy?
  - Why RAG at all when context windows are huge? (Cost, latency, freshness, access control — be able to argue each.)
  - Where does the vector DB choice actually matter, and where is `pgvector`-in-your-existing-Postgres the right boring answer?
- **Hands-on:** Build a docs corpus for the ticket assistant (~30 markdown help-center articles — generate them). Ingest with two chunking strategies. Wire retrieval into the assistant so `draft_reply` cites the article it used. Extend the eval set with 20 questions answerable *only* from the corpus, plus 5 that are *not* answerable (the model must say so).
- ✅ **Checkpoint:** From memory, draw the full RAG data flow and name the tunable at every stage — chunk size, embedding model, top-k, prompt template — and which eval slice detects each one being wrong.

### Week 5 — Retrieval quality & RAG debugging
- **Read:** 13 · Hybrid Search, Reranking & Filters, 14 · Evaluating & Debugging RAG
- **Master these questions:**
  - Why does pure vector search miss exact identifiers (SKUs, error codes) and what does BM25 hybrid + reciprocal-rank-fusion fix?
  - What does a reranker do, and why does retrieve-50-rerank-to-5 beat retrieve-5 directly?
  - Separate the failure modes: retrieval failure (right doc never retrieved) vs grounding failure (doc retrieved, answer ignores it) vs corpus gap (answer isn't in the docs). Which metric catches each — retrieval recall@k vs answer faithfulness?
  - Given "the bot hallucinates policies," narrate your diagnosis path through the traces.
- **Hands-on:** Measure retrieval recall@5 separately from end-to-end answer accuracy on your eval set. Add BM25 hybrid and a reranker; report all three configurations as a table. Find one real grounding failure in your traces and fix it with prompt instructions alone — proving it wasn't a retrieval problem.
- ✅ **Checkpoint:** Given a made-up RAG complaint, say which metric you'd check first, which stage you suspect, and what the fix menu looks like at each stage — retrieval recall before prompt tweaks, always.

---

## Phase 4 · Agents (Weeks 6–8) → Part 4

The center of gravity of the field — and of this track.

### Week 6 — The loop and the tools
- **Read:** 15 · The Agent Loop, 16 · Tool Design
- **Master these questions:**
  - Define an agent in one sentence (a model calling tools in a loop until a stop condition) and draw the loop: model → tool call → execute → append result → model … Why is *the harness* (your code) most of the engineering?
  - Contrast workflow (you code the steps, model fills slots) vs agent (model decides the steps). What signals push a use case from one to the other?
  - Tool design rules: why do few, well-described, high-level tools beat many thin API wrappers? What makes a good tool description, a good error return (the model reads it!), and a good "no results" response?
  - Where do you put the stop conditions: max turns, budget, human approval? What fails if you forget each?
- **Hands-on:** Turn the ticket assistant into a real agent, hand-rolled loop, no framework: tools = `search_help_center` (your RAG retriever, now a tool the model *chooses* to call), `lookup_order_status`, `escalate_to_human`. Log every turn. Then deliberately break it: give it two overlapping tools with vague descriptions and watch tool-choice accuracy fall in the eval — then fix the descriptions and measure the recovery.
- ✅ **Checkpoint:** Whiteboard the agent loop from memory, including where errors, retries, and stop conditions live, and state three tool-design rules with a war story (yours, from this week) for each.

### Week 7 — MCP & context engineering
- **Read:** 17 · MCP, 18 · Context Engineering: Memory & Compaction
- **Master these questions:**
  - What problem does MCP solve (N×M integrations → N+M)? Name the primitives — tools, resources, prompts — and what the client vs server each owns.
  - Why do agents degrade on long tasks even inside the context limit? What are the mitigation tiers: compaction/summarization, external memory (files/scratchpads), sub-agents with clean contexts?
  - What goes in the system prompt vs retrieved-on-demand vs a tool the agent can call? (Context is a budget — defend every token.)
  - When is a framework (LangGraph, Agent SDK, Spring AI) worth it vs the hand-rolled loop you already own?
- **Hands-on:** Wrap your three tools in an MCP server; connect it to Claude Code or another MCP client and drive your agent from a client you didn't write. Then give the agent a 30-turn task that overflows usefully — implement compaction (summarize turns 1–20 into a paragraph) and show task success survives it.
- ✅ **Checkpoint:** Explain MCP's architecture from memory to a skeptical backend engineer, including an honest answer to "why not just REST?"

### Week 8 — Orchestration, multi-agent & guardrails
- **Read:** 19 · Workflows vs Agents, Multi-Agent, Human-in-the-Loop
- **Master these questions:**
  - Recite the workflow patterns — chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer — and give a use case where each is the *right* amount of structure.
  - When does multi-agent genuinely beat single-agent (context isolation, parallel read-heavy research) and when is it costume jewelry (sequential task, shared mutable state)?
  - Design human-in-the-loop for a refund-issuing agent: what's auto-approved, what queues for review, and how does the interface make review *fast*?
  - What's your answer to "can we just let it run autonomously?" — reversibility × blast-radius as the approval criterion.
- **Hands-on:** Add a routing front to the assistant (billing / technical / refunds), and an evaluator-optimizer pass on `draft_reply` (a critic model checks tone + policy compliance before send). Gate `escalate_to_human` and refunds behind a real approval queue (a JSONL file + tiny CLI is fine). Report the eval score of routed vs unrouted.
- ✅ **Checkpoint:** Given three described use cases, pick single-model / workflow / agent / multi-agent for each and defend the choice in two sentences — including one where the right answer is "no LLM at all."

---

## Phase 5 · Production (Weeks 9–10) → Part 5

What separates a demo from a deployment — and a hobbyist from a hire.

### Week 9 — Observability, cost & latency
- **Read:** 20 · Tracing Every Token, 22 · Cost, Latency & Model Selection
- **Master these questions:**
  - What belongs in a trace for one agentic request? (Every model call with full prompt/response, every tool call with args/results, tokens, latency, cost — per *step*.)
  - Where does latency actually go — time-to-first-token vs generation vs tool execution vs retrieval — and which levers move each (streaming, caching, smaller model, parallel tools)?
  - Model selection as an engineering decision: which steps of your pipeline can drop to Haiku-class, and what's the eval evidence required to do it safely?
  - What do you put on the ops dashboard for an LLM feature: cost/req, p95 TTFT, eval pass-rate on canaries, tool-error rate, escalation rate?
- **Hands-on:** Add real tracing (Langfuse/Braintrust or equivalent) to the agent. Produce a cost-and-latency breakdown per pipeline stage for 50 eval runs. Downgrade the routing step to a small model and show (with the eval) that accuracy holds while cost drops — or that it doesn't, and revert.
- ✅ **Checkpoint:** From a single (provided) trace of a slow, wrong answer, narrate the diagnosis out loud: where the time went, where the tokens went, and which stage produced the wrongness.

### Week 10 — Security & shipping
- **Read:** 21 · Prompt Injection & Untrusted Input, 23 · Deployment Patterns & the Java/Spring Angle
- **Master these questions:**
  - Define prompt injection and why it is *not* solved: the model can't reliably distinguish instructions from data. Walk an indirect-injection attack through your ticket agent (attacker email → tool output → exfiltration attempt).
  - The defense stack: least-privilege tools, output filtering, human approval on irreversible actions, injection-aware evals. Which is load-bearing? (Blast-radius limits, not detection.)
  - What does the "lethal trifecta" (private data + untrusted input + external communication) mean for which tools an agent may hold simultaneously?
  - How would you expose your agent inside a Spring shop — sync REST vs SSE streaming vs queue-backed async — and where do Spring AI's abstractions help vs hide too much?
- **Hands-on:** Red-team your own agent: write 10 injection attempts (in ticket bodies and in poisoned help-center articles) and measure the success rate. Add defenses; re-measure — this is your first *security eval*. Then wrap the agent in a Spring Boot service with SSE streaming and the approval queue as a real endpoint.
- ✅ **Checkpoint:** Explain to a hypothetical CISO, from memory, why your agent can be trusted with customer emails: the tool permissions, the approval gates, the injection eval results, and what it can *never* do even if fully compromised.

---

## Phase 6 · The Forward Deployed Engineer (Weeks 11–12) → Part 6

The skill that turns everything above into a career: shipping it *for someone else*, in *their*
environment, against *their* definition of success.

### Week 11 — Discovery, scoping & the demo
- **Read:** 24 · Discovery & Scoping, 25 · The Demo-Driven POC
- **Master these questions:**
  - How do you find the workflow worth automating? (High volume × text-heavy × rule-describable × tolerable error cost — and the customer's own top-3 pain list, not your tech preferences.)
  - What makes a POC scope good: narrow enough to demo in 2 weeks, real enough that success is undeniable, connected to a metric the buyer already tracks. Write one as a one-pager: current workflow → proposed → success metric → data needed → out of scope.
  - Why do FDEs demo with the *customer's* data, and what do you do in the meeting when the agent fails live? (You read the trace out loud — turning failure into a credibility win.)
  - What questions do you ask in the first discovery call? Draft the actual list.
- **Hands-on:** Pick a real domain you can access (your company's ops, a friend's business, a public dataset). Run discovery on yourself: write the one-pager, define the success metric, and build the eval set from *their* examples **before** building anything. Start the capstone build.
- ✅ **Checkpoint:** Pitch the POC out loud in 5 minutes as if to a VP: problem, cost of the problem, what the pilot does, how success is measured, what you need from them. No slides — a working demo and a number.

### Week 12 — Capstone: POC → production story
- **Read:** 26 · POC → Production, Enterprise Integration & Handoff
- **Master these questions:**
  - What changes between pilot and production: SSO/access control, data residency, eval-gated prompt changes, monitoring, a human fallback path, and *who owns it after you leave*?
  - How do you hand off: runbook, eval suite as the contract, dashboard, and the "when to page a human" rules.
  - What's your honest answer to "what will this cost at 100× volume?" — do the token math live.
- **Hands-on:** Finish the capstone: working agent on real(ish) domain data, eval suite with reported scores, tracing dashboard, injection results, approval flow, and a 10-minute recorded demo + one-page architecture doc. This is your **portfolio artifact** — it's what you show in interviews.
- ✅ **Checkpoint (final):** Deliver the full demo out loud: the workflow, the live agent, a failure trace and its diagnosis, the eval scorecard, the security story, and the production plan. If you can do this cold, you can do it in an FDE interview — because this *is* the FDE interview.

---

## After the track

- **Interview prep:** re-run every weekly checkpoint cold; the failures are your study list.
- **Stay current deliberately:** the field turns over quarterly. Follow the Anthropic/OpenAI engineering blogs and MCP spec changes; re-eval your capstone against each new model release — the score deltas teach you what actually improved.
- **Portfolio:** the capstone + the running project's git history (12 weeks of measured improvements) is stronger evidence than any certificate.
