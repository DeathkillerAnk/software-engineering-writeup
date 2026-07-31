# Part 1 · Engineering the API

> The unglamorous layer every job interview probes and every production incident traces back to.
> Once you accept the model as a rented next-token function (Part 0), the job becomes: write
> specs it can follow, get reliable structure back out, call tools correctly, handle the network
> like the unreliable thing it is, and pay for only what you actually need. None of this is ML —
> it's API engineering with an unusual dependency.
> [← back to the track index](../README.md) · [ROADMAP Week 2](../ROADMAP.md#week-2--the-engineering-surface-of-the-api)

| Chapter | The question it answers |
|---|---|
| [05 · Prompting as Engineering](05-prompting-as-engineering.md) | What belongs in a system prompt vs the user turn, and why "prompt engineering" is spec-writing, not magic phrases |
| [06 · Structured Output & Getting Reliable JSON](06-structured-output-and-getting-reliable-json.md) | Three ways to get JSON out of a model, in order of reliability — and what schema-constraint does and doesn't guarantee |
| 07 · Tool Use | The full round trip: tool schema → `tool_use` → your code executes → `tool_result` → final answer |
| 08 · Streaming, Errors & Retries | Your retry policy for a 429 vs a 529 vs a mid-stream timeout, and why idempotency is suddenly your problem |
| 09 · Caching, Batching & Budgets | How prefix caching works and how it should reorder your prompt layout |

**The habit for this part:** every prompt is a spec and every spec gets an eval (Part 2). "It looked
good in the playground" is not evidence — measure the pass rate, iterate against failures, and keep
the diff that moved the number.
