# Software Engineering Writeup

> A structured, interview-ready software engineering curriculum covering high-level design, low-level design, Java internals, Spring Boot internals, and system design practice.

This repository is a curated study workspace for building depth beyond surface-level syntax and memorized interview answers. It focuses on first-principles reasoning, trade-offs, implementation judgment, and repeatable practice.

## What is inside

| Track | Focus | Best for |
|---|---|---|
| [HLD](HLD/) | Distributed systems, architecture, scalability, reliability, case studies, and 60+ interview problems with solutions | System design depth, interview preparation, and principal-level trade-off reasoning |
| [LLD](LLD/) | Object design, SOLID, design patterns, refactoring, machine coding | Low-level design interviews and maintainable Java design |
| [Java](java/) | JVM internals, GC, JIT, concurrency, language semantics | Understanding Java from bytecode to production behavior |
| [Spring Boot](spring-boot/) | IoC container, bean lifecycle, AOP, auto-configuration, web, data, production | Debugging and designing Spring apps from first principles |
| [AI Engineering](ai-engineering/) | GenAI/agentic engineering: API, RAG, agents, evals, MCP, production, FDE skills | Becoming a GenAI/Agentic AI Engineer or Forward Deployed Engineer |
| [Problem Solving](problem-solving/) | DSA master list, patterns, and Java cheatsheets | Systematic approach to algorithmic interviews |
| [Principal Engineer Curriculum](principal_engineer_curriculum/) | Roadmap and expectations for staff/principal level | Career progression beyond senior engineer |
| [Shared Visualizations](shared-viz/) | Animation harness and visualization templates | Creating self-contained interactive architecture diagrams |
| [Study Material](study-material/) | Reference PDFs and supporting notes | Extra reading and practice resources |
| [Kafka](kafka/) | Reference PDFs and supporting notes | Extra reading and practice resources |

## Recommended learning paths

### For system design interviews

1. Start with the [HLD roadmap](HLD/ROADMAP.md) and [interview framework](HLD/04-design-case-studies/21-interview-framework.md).
2. Use the [problem bank](HLD/PROBLEM-BANK.md) and [worked solutions](HLD/SOLUTIONS.md) for timed practice.
3. Deep-dive HLD building blocks and case studies when a prompt exposes a weak area.

### For low-level design and machine coding

1. Start with [LLD](LLD/README.md).
2. Build the examples in each section instead of only reading them.
3. Use [LLD interview problems](LLD/INTERVIEW-PROBLEMS.md) for timed practice.
4. Revisit [Java internals](java/README.md) when runtime behavior matters.

### For backend depth with Java and Spring

1. Study [Java](java/README.md) for JVM fundamentals.
2. Move to [Spring Boot](spring-boot/README.md) to understand the framework runtime.
3. Connect both tracks while debugging real applications, profiling performance, or reasoning about concurrency.

## Repository structure

```text
.
|-- HLD/              # High-level design curriculum, distributed systems notes, and problem bank
|-- ai-engineering/   # GenAI & agentic AI engineering / FDE curriculum
|-- LLD/              # Low-level design curriculum, Java examples, and machine-coding drills
|-- java/             # Java and JVM internals curriculum
|-- spring-boot/      # Spring and Spring Boot internals curriculum
|-- problem-solving/  # DSA master list, patterns, and Java cheatsheets
|-- principal_engineer_curriculum/ # Roadmap and expectations for staff/principal level
|-- shared-viz/       # Animation harness and visualization templates
|-- kafka/            # Reference PDFs and supporting notes
`-- study-material/   # Supporting reference material
```

## How to use this repo

Do not read passively. For each topic:

1. Predict the answer before opening the writeup.
2. Read actively and answer the self-check questions without notes.
3. Build or run a small example.
4. Explain the trade-offs out loud.
5. Revisit the same topic later from a blank page.

The goal is not to memorize answers. The goal is to develop the judgment to derive good designs under real constraints.

## Core principles

- **First principles over buzzwords** - understand why a tool or pattern works before naming it.
- **Trade-offs over templates** - every design choice has a cost, failure mode, and revisit condition.
- **Practice over reading** - durable skill comes from building, testing, explaining, and repeating.
- **Evidence over folklore** - measure performance, inspect runtime behavior, and verify claims against primary sources.

## Quick links

- [HLD roadmap](HLD/ROADMAP.md)
- [HLD cheat sheet](HLD/CHEATSHEET.md)
- [HLD crash course](HLD/CRASHCOURSE.md)
- [HLD problem bank](HLD/PROBLEM-BANK.md)
- [HLD solutions](HLD/SOLUTIONS.md)
- [LLD study method](LLD/STUDY-METHOD.md)
- [LLD cheat sheet](LLD/CHEATSHEET.md)
- [Java roadmap](java/ROADMAP.md)
- [Java visualizations](java/VISUALIZATIONS.md)
- [Spring Boot roadmap](spring-boot/ROADMAP.md)
- [Spring Boot study method](spring-boot/STUDY-METHOD.md)
- [AI engineering roadmap](ai-engineering/ROADMAP.md)
- [Problem solving study plan](problem-solving/STUDY-PLAN.md)
- [Principal engineer roadmap](principal_engineer_curriculum/roadmap.md)
