# Chapter Style Spec (internal — how every chapter in this track is written)

Read this + chapter `00-how-llms-work/01-tokens-transformers-and-why-context-is-expensive.md`
as the canonical example before writing any chapter. Match that chapter's voice and structure
exactly.

## Audience & voice
- Reader: early-career engineer (solid Java/Spring backend), no ML background, wants principal-level
  depth fast, no hand-waving. Goal role: GenAI/Agentic AI Engineer → Forward Deployed Engineer.
- Voice: direct, concrete, opinionated where it helps. Professional, active voice. No filler, no
  "Great question", no motivational padding. Explain *why*, always bottoming out in a mechanism.
- The track's spine habit: **eval-first / "never ship what you didn't eval."** Reference measurement
  and pass-rates over vibes wherever relevant.

## Required structure (every chapter)
1. `# NN · Title` H1 matching the ROADMAP.
2. A `>` blockquote subtitle (2–4 lines) saying what the chapter delivers, then a nav line:
   `> [← Part N · Name](README.md) · prev: … · next: …`
3. A `> **Predict first (2 min).**` blockquote with 2–3 concrete guess-questions.
4. Body with `##` sections. Lead with a mental model, then mechanism, then engineering
   consequences. Bottom out every "why" in a mechanism.
5. **At least one Mermaid diagram** (flowchart or sequenceDiagram) for any process/data-flow.
6. **Concrete over abstract**: real JSON payloads, real API request/response shapes, worked
   token/cost/latency math with actual numbers, small tables. Show, don't describe. Use realistic
   examples from the running project (a **support-ticket assistant** for a facilities/ops company).
7. A **hands-on section** titled `## Prove it` or `## Build it` (30–60 min) with numbered, runnable
   steps against the real Anthropic API / real tools. End labs with the reconciliation habit:
   *"I predicted X, the API showed Y, because Z."* THIS IS REQUIRED — every chapter must have hands-on.
8. A `## Self-Check (close the doc, answer out loud)` numbered list of 5–6 questions, the last one
   or two being interview-grade / trade-off questions.

## Technical accuracy rules
- Use current, correct API shapes for the **Anthropic Messages API** (the `anthropic` Python/TS SDK):
  `messages`, `system`, `tools` with `input_schema`, `tool_use`/`tool_result` content blocks,
  `usage` fields, streaming events. Default model family: Claude (Sonnet for most, Haiku for cheap
  steps, Opus for hardest). Don't invent fields — if unsure, keep the example shape minimal and note
  "check the docs for exact field names."
- Pricing math: use illustrative Sonnet-class prices ($3/MTok in, $15/MTok out) and ALWAYS add a
  note to verify against the live pricing page. Keep numbers internally consistent.
- Distinguish provided fact from general knowledge; never present uncertain infra details as fact.
- Prompt injection, security: treat as unsolved; defense = blast-radius limits, not detection.

## Cross-linking
- Link to sibling chapters by relative path and to other tracks (`../../java/`, `../../spring-boot/`,
  `../../HLD/`, `../../LLD/`) where a concept connects. FDE angle and Java/Spring integration are
  selling points — surface them.

## Length
- ~150–320 lines per chapter. Dense and useful over long. Every paragraph earns its tokens.
