# Part 0 · How LLMs Actually Work (just enough)

> The mental model the whole track rests on — what a model *is* as a component: a next-token
> function you rent by the token. No ML theory beyond what changes your engineering decisions.
> [← back to the track index](../README.md) · [ROADMAP Week 1](../ROADMAP.md#week-1--what-youre-actually-calling)

Most bad GenAI engineering comes from one of two wrong mental models: *the model is magic* (so
prompt-tweak and pray) or *the model is a database* (so be shocked when it "makes things up").
This part replaces both with the correct one, in four chapters:

| Chapter | The question it answers |
|---|---|
| [01 · Tokens, Transformers & Why Context Is Expensive](01-tokens-transformers-and-why-context-is-expensive.md) | What happens between hitting enter and the first streamed token — and why everything is priced in tokens |
| 02 · Sampling: Temperature, Top-p & Why Outputs Vary | Why the same prompt gives different answers, and what the knobs actually change |
| 03 · Embeddings: Meaning as Vectors | How "relatedness" becomes a number — the primitive under all of RAG |
| 04 · Context Windows, Pricing & the Cost Model | Doing the token math for a real workload, within 2× |

**The habit for this part:** every claim here is checkable against a live API — token counts from
the `usage` field, variance from repeated calls, latency from a stopwatch. Don't believe; call.
