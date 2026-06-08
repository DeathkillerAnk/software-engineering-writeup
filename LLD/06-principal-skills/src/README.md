# Drill · Judgment (not compiling-to-green)

Section 06 is about taste, so this drill trains *recognizing over-engineering* and *writing down a
decision* — the two highest-leverage principal habits.

## Part 1 — Critique the over-engineering

```bash
cd 06-principal-skills/src
javac *.java && java GreetingDemo
```

This proves `OverEngineeredGreeter` (~7 types: an interface, 2 strategies, a factory interface, 2
factories, a registry/provider) produces the **exact same output** as the 5-line `SimpleGreeter`.

Now answer, in writing:
1. **Count** the abstractions in `OverEngineeredGreeter`. What does each one *buy* for this task?
2. What **force** would ever justify that ceremony? (e.g. dozens of locales loaded as runtime plugins
   by other teams.) Is that force present here? (No.)
3. When you *do* hit that force later, which single abstraction would you add first, and why that one?

> The lesson: **abstraction is a loan against complexity.** Exhibit A pays interest forever for a
> flexibility it never uses. Exhibit B is the principal answer — the simplest thing that solves the
> actual problem; refactor toward a seam when a *second real reason to change* arrives. See the
> [abstraction sweet-spot animation](../visualizations/abstraction-sweet-spot.html).

### Your answers
- _abstractions counted:_
- _force that would justify them:_
- _is that force present here?_
- _first abstraction I'd add when it appears:_

## Part 2 — Write a real design doc
Copy [`design-doc-template.md`](design-doc-template.md) for something you're actually building. Fill in
the **options → forces → cost → decision → revisit-if** spine. Then have someone poke holes in it — the
review is where the judgment compounds.

> `*.class` files are build output — don't commit them.
