# Visualizations · Part 3 — Web: MVC, REST & Reactive

Interactive animations for this part. Conventions and the full philosophy live in
[../../VISUALIZATIONS.md](../../VISUALIZATIONS.md): self-contained single-file HTML, vanilla
JS + canvas/SVG, no build/deps/network, Play/Pause/Step/Reset controls, a "what to notice"
caption, dark terminal-friendly theme.

| File | Status | Medium | Shows | What to notice |
|---|---|---|---|---|
| `dispatcherservlet-flow.html` | planned | HTML | One request traversing the `DispatcherServlet` front controller: `HandlerMapping` (find the handler) → `HandlerAdapter` (invoke it) with `HandlerInterceptor`s, `HandlerMethodArgumentResolver`s binding the arguments, the controller method running, an `HttpMessageConverter` serializing the return value (or a `ViewResolver` for a view), then back out | There is **one** front controller and a pipeline of named *strategy* stages behind it. Every web bug — a 404, a body that won't deserialize, validation that didn't fire — maps to exactly one inspectable stage. |
| `reactive-backpressure.html` | planned | HTML | A `Flux` producer and a consumer that signals **demand** (`request(n)`), the stream delivering only what was requested, contrasted with a blocking pull that parks a whole thread waiting on I/O | Reactive is *demand-driven and non-blocking*: the consumer controls the rate (backpressure), and a handful of event-loop threads serve huge concurrency. It is a **concurrency model**, not a free speedup — it only pays off end-to-end and under real load. |

Mermaid (inline in the chapters) covers the static structure for this part: the **servlet stack vs
reactive stack** side by side (`DispatcherServlet`/Tomcat/thread-per-request vs
`DispatcherHandler`/Reactor Netty/event-loop), and the ordering of servlet `Filter` →
`HandlerInterceptor` → controller.

> Build order suggestion: `dispatcherservlet-flow.html` first — it's the most-used path in any Boot
> app and the most-asked-about in interviews; seeing the stages in motion makes "walk me through a
> request" trivial to answer.
