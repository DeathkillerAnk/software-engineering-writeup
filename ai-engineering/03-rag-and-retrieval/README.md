# Part 3 · RAG & Retrieval

> Still the most-deployed GenAI pattern in the enterprise, and the most common first project an FDE
> ships — a customer has a pile of documents and wants a chatbot that answers *from* them, not from
> whatever the model half-remembers about the world.
> [← back to the track index](../README.md) · [ROADMAP Weeks 4–5](../ROADMAP.md#phase-3--rag--retrieval-weeks-4-5--part-3)

Chapter 03 established the primitive: an embedding turns text into a point in space, and cosine
similarity approximates "relatedness." RAG (Retrieval-Augmented Generation) is what you build *on
top of* that primitive to make a chat model answer grounded in documents it never saw during
training — your company's help center, your customer's internal wiki, this week's policy update.
Three chapters take you from "it retrieves something" to "we can measure exactly where it breaks
and why":

| Chapter | The question it answers |
|---|---|
| [12 · The RAG Pipeline: Ingestion, Chunking, Indexing](12-the-rag-pipeline-ingestion-chunking-indexing.md) | How do documents become searchable, and which chunking decisions are expensive to undo later? |
| [13 · Retrieval Quality: Hybrid Search, Reranking & Metadata Filters](13-retrieval-quality-hybrid-search-reranking-metadata-filters.md) | Why does vector search alone miss SKUs and error codes, and what closes the gap? |
| [14 · Evaluating & Debugging RAG](14-evaluating-and-debugging-rag.md) | When the bot answers wrong, was it retrieval, grounding, or a corpus gap — and how do you tell? |

**The habit for this part:** measure retrieval and generation *separately*. A RAG system has two
failure surfaces stacked on top of each other — "did we find the right document" and "did the model
use it correctly" — and conflating them is the single most common reason RAG debugging goes in
circles. Every chapter here reports recall@k and answer accuracy as two different numbers, never one.
