# Part 5 · Production

> [← back to the track index](../README.md) · [ROADMAP Weeks 9–10](../ROADMAP.md#phase-5--production-weeks-910--part-5)

A demo is a script that worked once, on your laptop, on the happy path, while you were watching.
A deployment is the same system running unattended at 2 a.m. against inputs nobody wrote a test
for, and someone else's pager going off when it misbehaves. Everything in Parts 0–4 made the agent
*work*; Part 5 is what makes it **survivable** — the difference between a hobbyist who can get a
model to call a tool and a hire who can be handed an incident and a monthly bill and answer for
both. Four questions, four chapters: can you see what happened (observability), can you contain
what an attacker or a poisoned document tries to do (security), can you defend the unit economics
at scale (cost/latency), and can you actually put the thing where users can reach it (shipping).

| Chapter | The question it answers |
|---|---|
| [20 · Observability: Tracing Every Token](20-observability-tracing-every-token.md) | What belongs in a trace for one agentic request, and how do you turn 50 traces into a dashboard you'd trust on-call? |
| [21 · Security: Prompt Injection & the Untrusted-Input Problem](21-security-prompt-injection-and-the-untrusted-input-problem.md) | Why can't the model just "not fall for it," and what actually contains the damage when it does? |
| [22 · Cost, Latency & Model Selection at Scale](22-cost-latency-and-model-selection-at-scale.md) | Where do the seconds and the dollars actually go, and which lever fixes which? |
| [23 · Shipping: Deployment Patterns & the Java/Spring Angle](23-shipping-deployment-patterns-and-the-java-spring-angle.md) | How does an agent actually get exposed to the world, and where's your Java/Spring background an unfair advantage? |

**The habit for this part:** *if you can't see it, you can't trust it, and if you can't contain it,
you can't ship it.* A trace is not a nice-to-have you add after an incident — it's the artifact
that turns "the agent did something weird" into a two-minute diagnosis. A tool your agent doesn't
strictly need is not a convenience — it's an attack surface you're carrying for free. Carry both
habits from Part 2 (never ship what you didn't eval) into this part: your security posture and your
cost model are both claims, and both need a number behind them.
