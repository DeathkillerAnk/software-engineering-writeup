# Part 4 · Agents

> [← back to the track index](../README.md) · [ROADMAP Weeks 6–8](../ROADMAP.md#week-6--the-loop-and-the-tools)

This is the center of gravity of the field, and of this track. Everything in Parts 0–3 — tokens,
tool use, evals, retrieval — exists so that this part works: an agent is a model, a set of tools,
and a loop, and every failure mode you'll debug for the rest of your career traces back to one of
those three pieces being wrong. Chapter 07 already showed you the primitive (one tool call, two API
requests). Part 4 wraps that primitive in a `while`, then spends four chapters on the things that
make the wrap either reliable or a liability: tool design, the protocol that lets tools travel
between clients, the context budget that decays over long runs, and the judgment call between
"code the steps" and "let the model decide."

| Chapter | The question it answers |
|---|---|
| [15 · The Agent Loop: Model + Tools + Loop](15-the-agent-loop-model-tools-loop.md) | What is an agent, mechanically, and where do stop conditions live? |
| [16 · Tool Design: The API Design Problem of the Decade](16-tool-design-the-api-design-problem-of-the-decade.md) | What makes a tool spec something a *probabilistic caller* uses correctly? |
| 17 · MCP: The Protocol Layer for Tools & Context | How do you ship tools once and connect them to any client? |
| 18 · Context Engineering: Memory, Compaction & Long-Running Agents | Why do agents degrade well before they hit the context limit, and what buys back the turns? |
| 19 · Orchestration: Workflows vs Agents, Multi-Agent, Human-in-the-Loop | When is a loop the wrong amount of structure — too much, or too little? |

**The habit for this part:** every agent decision is a harness decision, not a model decision.
The model picks a tool and writes arguments; *your code* decides what counts as done, what counts
as an error worth retrying, what a tool is allowed to touch, and when a human has to sign off. When
an agent misbehaves, the first question is never "why did the model do that" — it's "what did the
harness let it do."
