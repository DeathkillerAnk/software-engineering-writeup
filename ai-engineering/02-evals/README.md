# Part 2 · Evals — the Load-Bearing Skill

> Evals are to an AI engineer what tests are to a backend engineer — except the system under test
> is probabilistic, so a single green run proves nothing. You stop thinking in *pass/fail* and
> start thinking in **pass rates**: 74% vs 71% is a claim that needs evidence, not a vibe. Every
> later part of this track (RAG, agents, security) reports its results as a score on the suite you
> build here.
> [← back to the track index](../README.md) · [ROADMAP Week 3](../ROADMAP.md#week-3--evals-the-load-bearing-skill)

| Chapter | The question it answers |
|---|---|
| [10 · Building an Eval Suite from Scratch](10-building-an-eval-suite-from-scratch.md) | What's the minimum viable eval, how do you write one case, and how do you know a score delta is real and not noise? |
| [11 · LLM-as-Judge, Graders & Knowing When to Distrust Them](11-llm-as-judge-graders-and-knowing-when-to-distrust-them.md) | When must you use a model to grade a model, how do you write a judge you can trust, and what are its known failure modes? |

**The habit for this part:** *never ship what you didn't eval.* Build the test set before you tune
anything. Every "I improved the prompt" claim gets a before/after score on the same suite, with the
same cases, run enough times that the delta survives the model's own run-to-run variance. If you
can't show the number, you don't know if you made it better or just different.
