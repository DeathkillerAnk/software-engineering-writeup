# Chapter 21 — Search Systems: Elasticsearch and Full-Text Search at Scale

## Difficulty
Advanced

## Importance
**Must Know** — Search is often the highest-value feature in a product: the bar a user types into determines whether they find what they need and convert. Full-text search has unique characteristics that make traditional relational databases inadequate: fuzzy matching, relevance ranking, faceted filtering, and sub-100ms queries across billions of documents. Elasticsearch (built on Apache Lucene) is the dominant solution. A Principal Engineer must understand not just how to query Elasticsearch, but how it stores data (inverted indexes, segments), how queries are scored (BM25), where it breaks (split-brain, mapping explosion, hot shards), and when to use it versus alternative approaches (PostgreSQL full-text search, pgvector, Meilisearch, Typesense). Getting search wrong means your users can't find products, articles, or people — and they leave.

## Prerequisites
Chapter 7 — Storage Engines (B-Tree vs LSM — Lucene uses a variant of LSM)
Chapter 13 — NoSQL Databases (document model, horizontal scaling)
Chapter 18 — CQRS and Event Sourcing (Elasticsearch as a CQRS read model)
Chapter 16 — Kubernetes (running Elasticsearch on K8s — the StatefulSet story)

## Learning Objectives

By the end of this chapter you will be able to:

1. Explain the inverted index: how Elasticsearch stores and queries text in sub-millisecond time across billions of documents.
2. Describe the Lucene segment model: how documents are written (buffer → segment), merged, and made searchable (near-real-time).
3. Explain BM25 relevance scoring: how TF, IDF, and field length normalization combine to rank documents.
4. Design an Elasticsearch index: mappings, analyzers, sharding strategy, and alias management.
5. Write production-quality Elasticsearch queries: match, bool, filter, nested, aggregations.
6. Explain the split-brain problem in Elasticsearch and how it is prevented (quorum, master election).
7. Diagnose common Elasticsearch failure modes: mapping explosion, hot shards, heap pressure, and unassigned shards.
8. Choose between Elasticsearch, PostgreSQL FTS, pgvector, and specialized search engines for a given use case.

## Why This Matters

An e-commerce platform has 50 million products. A user types "red running shoes size 10." Without search, this is a multi-join SQL query with LIKE clauses — seconds of execution time. With Elasticsearch:
- Tokenize: ["red", "running", "shoes", "size", "10"]
- Inverted index lookup: 0.5ms to find all documents containing each token
- Score and rank: BM25 produces a relevance-ordered list in < 20ms
- Filter: only products in stock, only size 10 — applied as a bit filter (not a scan)
- Result: top 20 products in 25ms total

The inverted index is what makes this possible. Understanding it from first principles — not just how to call the API — is what separates an engineer who configures search from one who can design it, tune it, and fix it when it breaks at 3 AM.

---

## Mental Model

> **An inverted index is the opposite of a database table. A database stores: row → columns (given a row ID, find the values). An inverted index stores: term → document list (given a word, find all documents containing it). This inversion is what makes text search fast: instead of scanning every document for the word "running," you look up "running" in the index and instantly get the list of matching documents — just like looking up a word in a book's index instead of reading every page. Elasticsearch wraps this inverted index in a distributed, replicated, schema-flexible document store with relevance ranking.**

---

## Intuition

Think of a library with 10 million books. You want every book that mentions "distributed systems" AND "consensus."

**Without a search engine (LIKE query):** Open every book, scan every page, find the word. Linear scan: O(N × pageCount). At 10M books: impossibly slow.

**With a search engine (inverted index):** 
- The card catalog (inverted index) has an entry for every word that appears in any book.
- "distributed systems" → [book_123, book_456, book_789, ...]
- "consensus" → [book_456, book_901, book_234, ...]
- Intersection: [book_456] (books containing both)
- Done in milliseconds — regardless of how many books exist.

The card catalog is built offline (at index time). Queries are instant because all the hard work was done upfront.

---

## Visual Explanation

### The Inverted Index — How It's Built

```
Documents (at index time):
  Doc 1: "red running shoes for trail running"
  Doc 2: "blue running shoes waterproof"
  Doc 3: "red basketball shoes"

Step 1: Tokenization (break into terms):
  Doc 1: ["red", "running", "shoes", "for", "trail", "running"]
  Doc 2: ["blue", "running", "shoes", "waterproof"]
  Doc 3: ["red", "basketball", "shoes"]

Step 2: Normalization (lowercase, remove stop words, stemming):
  "for" → removed (stop word)
  "running" → "run" (stemmed)
  "shoes" → "shoe" (stemmed)
  
  Doc 1: ["red", "run", "shoe", "trail", "run"]   → ["red", "run"(×2), "shoe", "trail"]
  Doc 2: ["blue", "run", "shoe", "waterproof"]
  Doc 3: ["red", "basketball", "shoe"]

Step 3: Inverted Index construction:
  ┌──────────────┬─────────────────────────────────────────────┐
  │ Term         │ Postings List (doc_id, term_frequency, pos) │
  ├──────────────┼─────────────────────────────────────────────┤
  │ "red"        │ [(doc1, tf=1, pos=[0]), (doc3, tf=1, pos=[0])]│
  │ "run"        │ [(doc1, tf=2, pos=[1,4]), (doc2, tf=1, pos=[1])]│
  │ "shoe"       │ [(doc1, tf=1, pos=[2]), (doc2, tf=1, pos=[2]), (doc3, tf=1, pos=[2])]│
  │ "trail"      │ [(doc1, tf=1, pos=[3])]                    │
  │ "blue"       │ [(doc2, tf=1, pos=[0])]                    │
  │ "waterproof" │ [(doc2, tf=1, pos=[3])]                    │
  │ "basketball" │ [(doc3, tf=1, pos=[1])]                    │
  └──────────────┴─────────────────────────────────────────────┘

Query: "red running shoes"
  Tokenize + normalize: ["red", "run", "shoe"]
  Lookup each term:
    "red"  → [doc1, doc3]
    "run"  → [doc1, doc2]
    "shoe" → [doc1, doc2, doc3]
  
  Merge (for "should" / OR): [doc1(3 matches), doc2(2 matches), doc3(2 matches)]
  BM25 score: doc1 ranks highest (all 3 terms match, "run" appears twice)
  
  Result: [doc1 (score: 3.4), doc2 (score: 1.8), doc3 (score: 1.6)]
```

### Lucene Segment Architecture

```
Write path (buffered):
  
  New documents ──▶ In-memory write buffer (IndexWriter)
                         │ (every ~1 second: "refresh")
                         ▼
                   New Lucene Segment (immutable, searchable)
                   Segment 1: [doc1, doc2, doc3]
                   Segment 2: [doc4, doc5]        ← newer segment
                   Segment 3: [doc6]               ← newest segment
                         │
                         │ (periodic "merge" in background)
                         ▼
                   Merged Segment: [doc1, doc2, doc3, doc4, doc5, doc6]
  
  Key properties:
    Segments are IMMUTABLE: no in-place updates or deletes.
    Update: mark doc as deleted in old segment + write new version in new segment.
    Delete: mark doc as deleted (not physically removed until segment merge/expunge).
    
    On merge: deleted documents are physically removed → storage reclaimed.
    
  Near-Real-Time (NRT) search:
    Default refresh interval: 1 second (index.refresh_interval: 1s)
    New documents: searchable within 1 second of indexing.
    NOT immediately searchable (0ms) — there is a refresh lag.
    
    For truly immediate search:
      index.refresh_interval: -1 (disable auto refresh)
      POST /my-index/_refresh  (manual refresh after each batch)
      Or: index.refresh_interval: "100ms" (more frequent, more I/O cost)
  
  Segment merge (background):
    Purpose: fewer segments = faster queries (search all segments, merge results)
    Trigger: when number of small segments exceeds threshold
    Cost: CPU and I/O intensive → monitor merge activity under load
    index.merge.policy.max_merged_segment: 5gb (don't merge segments > 5GB)
    index.merge.scheduler.max_thread_count: 1 (limit merge thread count)
```

---

## Core Concepts

### 1. BM25 Relevance Scoring — The Math Behind Rankings

BM25 (Best Match 25) is the scoring algorithm used by Elasticsearch (since ES 5.0, replacing TF-IDF).

```
BM25 score for a document D given query Q:
  
  Score(D, Q) = Σ IDF(qi) × (tf(qi, D) × (k1 + 1)) / (tf(qi, D) + k1 × (1 - b + b × |D|/avgdl))
  
  Where:
    qi:     each query term
    tf:     term frequency in document D (how many times the term appears)
    IDF:    inverse document frequency (how rare is this term across all documents)
    k1:     term frequency saturation parameter (default: 1.2)
            Controls: how much additional occurrences of a term increase the score
            k1=0: term frequency irrelevant (binary: present or not)
            k1=∞: linear increase with term frequency (no saturation)
            k1=1.2: moderate saturation (diminishing returns after ~3 occurrences)
    b:      length normalization parameter (default: 0.75)
            Controls: how much document length penalizes the score
            b=0: no length normalization (long docs not penalized)
            b=1: full length normalization (scores normalized by document length)
    |D|:    number of terms in document D (document length)
    avgdl:  average document length in the index

IDF formula:
  IDF(qi) = ln(1 + (N - n(qi) + 0.5) / (n(qi) + 0.5))
  
  Where:
    N:     total number of documents in the index
    n(qi): number of documents containing term qi
  
  Rare terms: high IDF (discriminative, informative)
  Common terms: low IDF (e.g., "the", "and" → near-zero IDF)

Intuition:
  A document scores highly when:
  1. It contains rare query terms (high IDF) — e.g., "Kubernetes" is more specific than "the"
  2. Query terms appear frequently in it (high TF, up to saturation point)
  3. It's short relative to average (length normalization) — a short doc with the term is more relevant than a long doc that mentions it once in passing

k1 tuning example:
  Product descriptions average 100 words.
  Blog posts average 2,000 words.
  For product search: set b=0.5 (less length penalty — short descriptions shouldn't be penalized)
  For content search: keep b=0.75 (standard length normalization)
```

**Custom scoring with function_score:**
```json
{
  "query": {
    "function_score": {
      "query": {
        "match": { "title": "running shoes" }
      },
      "functions": [
        {
          "field_value_factor": {
            "field": "sales_count",
            "factor": 0.1,
            "modifier": "log1p",
            "missing": 0
          }
        },
        {
          "gauss": {
            "price": {
              "origin": "50",
              "scale": "20",
              "decay": 0.5
            }
          }
        },
        {
          "filter": { "term": { "is_sponsored": true } },
          "weight": 2.0
        }
      ],
      "score_mode": "sum",
      "boost_mode": "multiply"
    }
  }
}
```
*Combines: text relevance (BM25) × popularity boost (log of sales_count) × price proximity (Gaussian decay around $50) × sponsored boost (2× multiplier).*

### 2. Index Design — Mappings and Analyzers

**Mappings** define the schema for an Elasticsearch index. Like a database schema, but more flexible — and more dangerous if misdesigned.

```json
PUT /products-v2
{
  "settings": {
    "number_of_shards": 5,
    "number_of_replicas": 1,
    "index.refresh_interval": "1s",
    "analysis": {
      "analyzer": {
        "product_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": [
            "lowercase",
            "asciifolding",         
            "synonym_filter",       
            "english_possessive_stemmer",
            "english_stemmer"
          ]
        },
        "autocomplete_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "edge_ngram_filter"]
        },
        "autocomplete_search_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase"]
        }
      },
      "filter": {
        "synonym_filter": {
          "type": "synonym",
          "synonyms": [
            "shoes, sneakers, trainers",
            "tv, television",
            "laptop, notebook"
          ]
        },
        "edge_ngram_filter": {
          "type": "edge_ngram",
          "min_gram": 2,
          "max_gram": 20
        },
        "english_stemmer": {
          "type": "stemmer",
          "language": "english"
        },
        "english_possessive_stemmer": {
          "type": "stemmer",
          "language": "possessive_english"
        }
      }
    }
  },
  "mappings": {
    "dynamic": "strict",
    "properties": {
      "id": { "type": "keyword" },
      "title": {
        "type": "text",
        "analyzer": "product_analyzer",
        "fields": {
          "keyword": { "type": "keyword" },
          "autocomplete": {
            "type": "text",
            "analyzer": "autocomplete_analyzer",
            "search_analyzer": "autocomplete_search_analyzer"
          }
        }
      },
      "description": {
        "type": "text",
        "analyzer": "product_analyzer",
        "index_options": "offsets"
      },
      "brand": {
        "type": "keyword",
        "fields": {
          "text": { "type": "text", "analyzer": "product_analyzer" }
        }
      },
      "category": { "type": "keyword" },
      "price": { "type": "scaled_float", "scaling_factor": 100 },
      "sales_count": { "type": "integer" },
      "rating": { "type": "float" },
      "is_in_stock": { "type": "boolean" },
      "tags": { "type": "keyword" },
      "attributes": {
        "type": "nested",
        "properties": {
          "name": { "type": "keyword" },
          "value": { "type": "keyword" }
        }
      },
      "created_at": { "type": "date" },
      "suggest": {
        "type": "completion",
        "analyzer": "simple",
        "contexts": [
          {
            "name": "category",
            "type": "category"
          }
        ]
      }
    }
  }
}
```

**Critical mapping decisions:**
```
text vs keyword:
  text:    analyzed (tokenized, normalized) — for full-text search ("match" query)
           Cannot be used for: sorting, aggregations, exact match (use .keyword subfield)
  keyword: not analyzed — for exact match, aggregations, sorting
           Example: brand, category, status, ID
  
  Multi-field pattern: index as both:
    "brand": {
      "type": "keyword",               ← exact match, aggregations
      "fields": {
        "text": { "type": "text" }     ← full-text search
      }
    }
  
  Query brand.keyword for filtering (exact): term { "brand.keyword": "Nike" }
  Query brand.text for search: match { "brand.text": "nike running" }

dynamic: "strict" (REQUIRED for production):
  Dynamic mapping (default): Elasticsearch auto-creates fields for unknown properties.
  Problem: a bug sends a new field "user_data: {nested: {...very large...}}"
           → Elasticsearch creates hundreds of dynamic mappings
           → mapping explosion: cluster state grows → OOM on master node → cluster down
  
  Fix: "dynamic": "strict"
       Unknown fields → rejected (400 Bad Request) rather than auto-mapped.
  
  Or: "dynamic": false (unknown fields stored but not indexed — not searchable)

nested vs object:
  object (default): nested objects are flattened in the index.
    {"attributes": [{"name": "color", "value": "red"}, {"name": "size", "value": "10"}]}
    Stored as: attributes.name: ["color", "size"], attributes.value: ["red", "10"]
    Problem: a query for color=red AND size=10 would ALSO match:
             a product with color=blue AND size=10 (because name contains "size" and value contains "10")
             even if those attributes are not paired correctly.
  
  nested: stored as separate hidden Lucene documents, maintaining the pair relationship.
    Query for color=red AND size=10 → correctly returns ONLY products where
    the "color" attribute has value "red" AND the "size" attribute has value "10" in the SAME attribute.
    Cost: nested queries are more expensive (separate document lookup per nested object).
    Use nested when: you need to query across properties of the same nested object.
```

### 3. Sharding Strategy — Getting It Right Before Launch

Shard count is set at index creation and cannot be changed without reindexing. Getting it wrong costs you a full reindex (expensive for large indices).

```
Shard sizing guidelines:
  Target: 20-50 GB per shard (Elastic's recommendation for search workloads)
  Max: 50 GB per shard (larger shards: slower queries, harder to rebalance)
  Min: 10 GB per shard (too many small shards: overhead dominates)
  
  Calculation:
    Expected index size: 500 GB
    Target shard size: 50 GB
    Number of shards: 500 / 50 = 10 shards
    
  With replicas (1 replica = 2 copies):
    Total storage: 10 shards × 2 copies × 50 GB = 1 TB
    Each node holds: (primary + replica) = full copy
    
  Shard count = primary shards (replica count set separately):
    "number_of_shards": 10      (primary shards — set at creation, immutable)
    "number_of_replicas": 1     (replica count — can change at any time)
  
Over-sharding (common mistake):
  "I'll set 50 shards to be safe." 
  
  At 10 GB of data: 50 shards × 200 MB/shard.
  Problem:
    Each query: coordinating node fans out to ALL 50 shards.
    Each shard returns top-10 results → coordinating node: merge 50 × 10 = 500 results → global top-10.
    Overhead: 50 network round trips vs 5 → query time: 5-10× slower for small data.
    Heap: each shard metadata in memory → excessive heap usage for tiny data.
    
  Hot shard problem:
    Documents routed by: hash(_id) % num_shards
    If one shard receives disproportionate query/write traffic:
      → CPU/I/O bottleneck on that node
      Solution: custom routing, or spread the index across more nodes.

Split and shrink (workaround for immutable shard count):
  Split: increase shard count (existing shards → new shards, multiplicative)
    "number_of_shards" must be a multiple of original (e.g., 5 → 10 → 20)
  Shrink: decrease shard count (must be a divisor of original: 10 → 5 → 1)
  Reindex: copy all documents to a new index with different shard count (most flexible, most expensive)

Index Alias pattern (for zero-downtime reindexing):
  Production alias "products" → points to "products-v1" index
  
  Reindex needed (mapping change, shard count change):
    1. Create "products-v2" with new mapping/shard count
    2. Reindex: POST /_reindex { "source": {"index": "products-v1"}, "dest": {"index": "products-v2"} }
    3. Verify v2 has all documents, passes quality check
    4. Atomic alias swap: DELETE alias products → products-v1; ADD alias products → products-v2
    5. Clients using "products" alias: automatically query v2
    6. Delete products-v1 after 24-hour observation period
  
  Zero downtime: step 4 is atomic in Elasticsearch (single API call).
  During reindex: new writes go to v1. After alias swap: new writes go to v2.
  (For live indices: write to both during reindex using dual-write alias)
```

### 4. Query DSL — Production Patterns

```json
// Comprehensive product search query:
POST /products/_search
{
  "from": 0,
  "size": 20,
  "track_total_hits": true,
  
  "query": {
    "bool": {
      "must": [
        {
          "multi_match": {
            "query": "red running shoes",
            "fields": ["title^3", "description^1", "brand.text^2"],
            "type": "best_fields",
            "operator": "or",
            "minimum_should_match": "75%",
            "fuzziness": "AUTO",
            "prefix_length": 2,
            "tie_breaker": 0.3
          }
        }
      ],
      "filter": [
        { "term": { "is_in_stock": true } },
        { "term": { "category": "footwear" } },
        {
          "range": {
            "price": { "gte": 50, "lte": 200 }
          }
        },
        {
          "nested": {
            "path": "attributes",
            "query": {
              "bool": {
                "must": [
                  { "term": { "attributes.name": "size" } },
                  { "term": { "attributes.value": "10" } }
                ]
              }
            }
          }
        }
      ],
      "should": [
        { "term": { "is_sponsored": { "value": true, "boost": 2.0 } } },
        { "range": { "rating": { "gte": 4.0, "boost": 1.5 } } }
      ]
    }
  },
  
  "aggs": {
    "brand_filter": {
      "terms": {
        "field": "brand",
        "size": 20
      }
    },
    "price_ranges": {
      "range": {
        "field": "price",
        "ranges": [
          { "to": 50 },
          { "from": 50, "to": 100 },
          { "from": 100, "to": 200 },
          { "from": 200 }
        ]
      }
    },
    "avg_rating": {
      "avg": { "field": "rating" }
    },
    "size_options": {
      "nested": { "path": "attributes" },
      "aggs": {
        "size_filter": {
          "filter": { "term": { "attributes.name": "size" } },
          "aggs": {
            "sizes": {
              "terms": { "field": "attributes.value", "size": 20 }
            }
          }
        }
      }
    }
  },
  
  "highlight": {
    "fields": {
      "title": { "number_of_fragments": 0 },
      "description": { "number_of_fragments": 2, "fragment_size": 150 }
    },
    "pre_tags": ["<mark>"],
    "post_tags": ["</mark>"]
  },
  
  "sort": [
    { "_score": { "order": "desc" } },
    { "sales_count": { "order": "desc" } }
  ]
}
```

**Key query clauses explained:**
```
must:     Documents MUST match. Contributes to relevance score.
          Use for: full-text search terms that affect ranking.

filter:   Documents MUST match. Does NOT contribute to score (cached bit filter).
          Use for: facets, ranges, exact matches (is_in_stock, category, price range).
          Filter context is FASTER than must (no scoring computation, cacheable).

should:   Documents SHOULD match. Contributes bonus score if matched.
          Use for: boosting (sponsored products, high-rated products).

must_not: Documents MUST NOT match. Does not score.
          Use for: exclusions (out of stock, blocked content, user's blocked brands).

multi_match types:
  best_fields (default): score = best matching field (good for "one field has all terms")
  cross_fields: treat multiple fields as one (good for person's full name across first_name + last_name)
  most_fields: combine scores across all matching fields (good for exact + stemmed versions)
  phrase: terms must appear in order (good for exact phrase search)

fuzziness: "AUTO"
  0-2 char terms: exact match only
  3-5 char terms: 1 edit distance allowed (e.g., "nke" → "nike")
  5+ char terms: 2 edit distances (e.g., "runing" → "running")
  prefix_length: 2 (first 2 characters must match exactly — performance optimization)
```

### 5. Autocomplete — Edge N-gram vs Completion Suggester

**Edge N-gram (flexible, handles typos with fuzzy):**
```
Index-time: "running" → ["ru", "run", "runn", "runni", "runnin", "running"]
Query: "runn" → matches edge n-gram "runn" → returns documents with "running"

Advantage: works with fuzziness, bool filters
Disadvantage: index size grows (n-gram expansion for every term)

When to use: search box where documents should match (not just suggestions)
```

**Completion Suggester (fast, for suggest-as-you-type):**
```json
PUT /products
{
  "mappings": {
    "properties": {
      "suggest": {
        "type": "completion",
        "contexts": [
          { "name": "category", "type": "category" }
        ]
      }
    }
  }
}

// Index a product with completion suggest data:
{
  "title": "Nike Air Max Running Shoes",
  "suggest": {
    "input": ["Nike Air Max", "Air Max", "Running Shoes", "Nike"],
    "weight": 100,
    "contexts": { "category": ["footwear"] }
  }
}

// Query (prefix: "nike air"):
POST /products/_search
{
  "suggest": {
    "product-suggest": {
      "prefix": "nike air",
      "completion": {
        "field": "suggest",
        "size": 10,
        "contexts": { "category": ["footwear"] },
        "fuzzy": { "fuzziness": 1 }
      }
    }
  }
}
// Returns: ["Nike Air Max Running Shoes", "Nike Air Force 1", ...] in < 5ms
// Uses FST (Finite State Transducer) data structure — extremely fast prefix lookup
```

### 6. Cluster Architecture — Roles and Quorum

```
Node roles (since ES 7.9 — multi-role nodes deprecated in favor of dedicated roles):

Master-eligible node:
  Participates in master election.
  Stores cluster state (all index mappings, shard allocation, node membership).
  Does NOT serve search queries (dedicated masters).
  Recommendation: 3 dedicated master-eligible nodes (odd number for quorum).
  Memory: 4-16 GB heap (cluster state size depends on index/shard count).
  
Data nodes:
  Store shards, serve search queries, execute aggregations.
  CPU/memory intensive.
  Memory: 16-64 GB heap + OS page cache (double the heap for page cache).
  ES heap: set to ≤ 50% of available RAM, ≤ 32 GB (JVM compressed OOPs limit).
  
Coordinating-only nodes (optional):
  Receive client requests, fan out to shards, merge results.
  No local data. Acts as "smart load balancers."
  Use for: very large clusters (> 50 data nodes) where data nodes spend too much
  time coordinating large aggregations.

Ingest nodes:
  Run ingest pipelines before indexing (field transformation, GeoIP lookup, etc.)
  Alternative to Logstash for simple preprocessing.

Master election and split-brain prevention:
  Cluster state quorum: requires majority of master-eligible nodes.
  3 master-eligible nodes: quorum = 2. Can lose 1 node.
  
  discovery.zen.minimum_master_nodes (ES < 7.0):
    Must be set to: (number_of_master_eligible_nodes / 2) + 1
    3 masters: minimum_master_nodes = 2
    If not set (default 1): SPLIT BRAIN RISK.
  
  ES 7.0+: automatic quorum (no manual setting needed).
    cluster.initial_master_nodes: ["node-1", "node-2", "node-3"]
    (Only needed for cluster bootstrap, not ongoing operation)
  
  Split-brain scenario (ES < 7.0 with wrong minimum_master_nodes):
    Cluster: 3 master-eligible nodes. minimum_master_nodes = 1 (wrong!).
    Network partition: node-1 is isolated from node-2 and node-3.
    node-1: "I'm the only master I can see. I am the master."
    node-2 + node-3: "node-1 is gone. We elect node-2 as master."
    Result: TWO master nodes. Two independent clusters.
    Each writes data independently.
    When partition heals: conflict → data loss.
    
  Prevention:
    minimum_master_nodes = 2 (for 3-node cluster).
    node-1 (isolated): cannot form quorum of 2 → steps down.
    node-2 + node-3: form quorum → elect master.
    node-1 rejoins as non-master data node.

Shard allocation and rebalancing:
  Elasticsearch automatically:
    Assigns primary shards to data nodes on index creation.
    Creates replicas on different nodes from the primary.
    Rebalances shards if cluster topology changes (node added/removed).
  
  cluster.routing.allocation.disk.threshold_enabled: true
  cluster.routing.allocation.disk.watermark.low: "85%"   # stop routing to node at 85% full
  cluster.routing.allocation.disk.watermark.high: "90%"  # start relocating shards at 90%
  cluster.routing.allocation.disk.watermark.flood_stage: "95%"  # readonly mode at 95%
```

### 7. Index Lifecycle Management (ILM) — Time-Series Data

For log data, metrics, and other time-series data, ILM automatically manages the index lifecycle:

```json
PUT _ilm/policy/logs-policy
{
  "policy": {
    "phases": {
      "hot": {
        "min_age": "0ms",
        "actions": {
          "rollover": {
            "max_size": "50gb",
            "max_age": "1d",
            "max_docs": 10000000
          },
          "set_priority": { "priority": 100 }
        }
      },
      "warm": {
        "min_age": "2d",
        "actions": {
          "forcemerge": { "max_num_segments": 1 },
          "shrink": { "number_of_shards": 1 },
          "allocate": {
            "require": { "data": "warm" }
          },
          "set_priority": { "priority": 50 }
        }
      },
      "cold": {
        "min_age": "30d",
        "actions": {
          "allocate": {
            "require": { "data": "cold" }
          },
          "set_priority": { "priority": 10 }
        }
      },
      "delete": {
        "min_age": "90d",
        "actions": {
          "delete": {}
        }
      }
    }
  }
}
```

*Hot → Warm → Cold → Delete pipeline: new data on fast SSD (hot), older data on spinning disk (warm/cold), deleted after 90 days.*

### 8. Keeping Elasticsearch in Sync — Change Data Capture

Elasticsearch is a read model (CQRS Chapter 18). Data lives in the primary database (PostgreSQL, MongoDB). Elasticsearch is kept in sync.

```
Pattern 1: Dual-write (simple, fragile)
  On every DB write: also write to Elasticsearch.
  Problem: Elasticsearch write fails → data out of sync. No retry. Silent failure.
  Problem: crash between DB write and ES write → same.
  Only acceptable for: low-value data, acceptable staleness.

Pattern 2: Event-driven sync (recommended)
  DB write → Outbox event → Kafka → Elasticsearch consumer
  
  Kafka consumer (Elasticsearch indexer):
    Reads ProductUpdatedEvent from Kafka.
    Calls Elasticsearch index/update API.
    Commits Kafka offset AFTER Elasticsearch confirms write.
    
    Idempotency: ES upsert by document ID (index or update is idempotent by ID).
    
  Lag: typically < 1 second (Kafka delivery + ES refresh interval).

Pattern 3: Debezium CDC (production-grade)
  Debezium reads PostgreSQL WAL → publishes change events to Kafka.
  ES consumer: reads from Kafka → indexes to Elasticsearch.
  
  Advantage: no application code changes required. Works with any data change.
  Handles: INSERT, UPDATE, DELETE automatically.
  
  Debezium connector config for ES sync:
    connector.class: io.debezium.connector.postgresql.PostgresConnector
    database.server.name: products_db
    table.include.list: public.products
    → Kafka topic: products_db.public.products
  
  Elasticsearch sink connector (Kafka Connect):
    connector.class: io.confluent.connect.elasticsearch.ElasticsearchSinkConnector
    topics: products_db.public.products
    connection.url: http://elasticsearch:9200
    type.name: _doc
    → Automatically indexes each change event as an ES document

Pattern 4: Logstash / Beats (for log aggregation)
  Filebeat → Logstash → Elasticsearch → Kibana (ELK stack)
  Standard for log aggregation use case.
  Not recommended for transactional data sync (use Debezium).
```

---

## Step-by-Step Execution

### Diagnosing a Slow Elasticsearch Query

```bash
# Step 1: Profile the query (understand where time is spent)
POST /products/_search
{
  "profile": true,
  "query": { "match": { "title": "running shoes" } }
}
# Response includes: time spent in each shard, breakdown by query type
# Look for: high "build_scorer" time (expensive scoring)
#            high "next_doc" time (many documents scanned)

# Step 2: Explain a specific document's score:
GET /products/_explain/doc123
{
  "query": { "match": { "title": "running shoes" } }
}
# Shows: exact BM25 calculation for this document
# Useful for: why is this product ranked 5th instead of 1st?

# Step 3: Check index stats (is the index large/fragmented?):
GET /products/_stats?human=true
# Look for: store.size, docs.count, segments.count
# High segment count → merge is behind → slower queries

# Step 4: Check shard allocation:
GET /_cat/shards/products?v
# Shows: shard ID, state (STARTED/INITIALIZING/UNASSIGNED), node
# UNASSIGNED shards: cluster is degraded (no replica available)

# Step 5: Move computation to filter context (no scoring):
# SLOW (must context — scores every document):
{ "query": { "bool": { "must": [{ "term": { "is_in_stock": true } }] } } }

# FAST (filter context — no scoring, cacheable):
{ "query": { "bool": { "filter": [{ "term": { "is_in_stock": true } }] } } }

# Step 6: Check if aggregations are the bottleneck:
# Aggregations on text fields: SLOW (requires fielddata — loads entire field into heap)
# Solution: use keyword subfield for aggregations:
{ "aggs": { "brands": { "terms": { "field": "brand.keyword" } } } }
# NOT: { "aggs": { "brands": { "terms": { "field": "brand" } } } }  ← brand is text, requires fielddata

# Step 7: Enable slow log for production diagnosis:
PUT /products/_settings
{
  "index.search.slowlog.threshold.query.warn": "1s",
  "index.search.slowlog.threshold.query.info": "500ms",
  "index.search.slowlog.threshold.fetch.warn": "500ms"
}
# Queries > 1s: logged to slow_log → grep for slow queries in production
```

### Diagnosing Unassigned Shards

```bash
# Most critical Elasticsearch alert: UNASSIGNED shards (data at risk)

# Check cluster health:
GET /_cluster/health
# Response: { "status": "red", "unassigned_shards": 5 }
# Red: one or more primary shards unassigned → SOME DATA UNAVAILABLE
# Yellow: replica shards unassigned → data available but not replicated

# Find which shards are unassigned and WHY:
GET /_cluster/allocation/explain
# Response explains: why can't this shard be assigned?
# Common reasons:
#   "no_valid_shard_copy": all copies of this shard are gone → DATA LOSS
#   "max_retries_exceeded": node repeatedly failed to start shard → check disk/memory
#   "node_left": the node holding the shard left the cluster → shards being reassigned
#   "allocation_decider": disk threshold exceeded → free disk space

# Force allocation (when you're sure the shard data is intact):
POST /_cluster/reroute
{
  "commands": [{
    "allocate_stale_primary": {
      "index": "products", "shard": 0, "node": "node-1",
      "accept_data_loss": true
    }
  }]
}
# WARNING: accept_data_loss: true → recent writes to this shard may be lost

# If disk is the problem: clear space, then:
PUT /_cluster/settings
{
  "transient": {
    "cluster.routing.allocation.disk.watermark.flood_stage": "99%"
  }
}
# Temporarily raise flood stage threshold to allow shard reassignment
# RESTORE the original value after fixing disk space!
```

---

## Deep Dive

### How Lucene Stores the Inverted Index on Disk

Lucene stores each segment as a collection of files:

```
Segment files for segment_N:
  .fdx / .fdt:  Stored fields (the original document source, for _source retrieval)
  .tim / .tip:  Term dictionary (the inverted index — terms → postings)
  .doc:         Postings list (doc IDs, term frequencies)
  .pos:         Position information (where terms appear in documents)
  .pay:         Payloads (additional per-position data)
  .dvd / .dvm:  Doc values (columnar storage for sorting/aggregations — separate from inverted index)
  .fnm:         Field metadata
  .si:          Segment info

Two data structures co-exist:
  Inverted index (row-oriented for text search):
    term → [doc_id, doc_id, doc_id, ...] (postings list)
    Optimized for: "find all documents containing 'running'"
    
  Doc values (column-oriented for aggregations):
    field → [value_for_doc1, value_for_doc2, value_for_doc3, ...]
    Optimized for: "sort results by price" or "aggregate by brand"
    NOT used for text fields (too large) → fielddata (heap-loaded) for text aggregations
    → Never aggregate on text fields (use keyword subfields with doc_values)

Compression:
  Postings lists: encoded with FOR (Frame of Reference) or PFOR-DELTA compression
  At 1M doc IDs, delta-encoded + bit-packed: compressed 10-50× vs raw
  This is why inverted indexes fit in memory: the data is highly compressed
```

### The Heap Size Problem — Why ES Needs Memory Tuning

```
Elasticsearch JVM heap:
  Minimum: 2 GB (small dev clusters)
  Maximum: 32 GB (critical threshold — see below)
  Recommended: heap = 50% of RAM (leaves rest for OS page cache)
  
  CRITICAL: Never set heap > 32 GB:
    JVM uses "compressed ordinary object pointers" (CompressedOops) for heap < 32 GB.
    CompressedOops: references use 4 bytes instead of 8 bytes.
    Heap > 32 GB: CompressedOops disabled → object overhead doubles.
    Effective usable heap: 32 GB heap at 64-bit vs 31 GB heap at 32-bit CompressedOops
    → Setting heap to 33 GB LOSES effective capacity vs 31 GB.
    
  Rule: set heap to min(31 GB, 50% of RAM).
  
Heap consumers in ES:
  1. Segment metadata: each open segment consumes heap
     Many small segments (pre-merge): excessive heap usage
     Monitor: GET /_cat/segments?v → look at count
     Alert: segments per shard > 50 → force merge: POST /index/_forcemerge?max_num_segments=1
  
  2. Field data (text aggregations): loads entire field into heap
     One "terms" aggregation on a text field with 1M unique values: 100MB+ heap
     Prevention: always use keyword fields for aggregations
     Alert: indices.fielddata.memory_size_in_bytes > 20% of heap → evict or rebuild queries
  
  3. Query cache: cached filter results (bit vectors)
     Automatic, bounded by: indices.queries.cache.size: "10%" of heap
  
  4. Shard request cache: aggregation results for read-only shards
     Automatic: first time query runs on each shard → cached → fast on repeat
```

### Vector Search — Elasticsearch as a Vector Database

Since ES 8.0, Elasticsearch supports dense vector fields for semantic search:

```json
PUT /products-semantic
{
  "mappings": {
    "properties": {
      "title": { "type": "text" },
      "embedding": {
        "type": "dense_vector",
        "dims": 1536,                          
        "index": true,
        "similarity": "cosine",
        "index_options": {
          "type": "hnsw",
          "m": 16,
          "ef_construction": 100
        }
      }
    }
  }
}
```

```json
// kNN (k-Nearest Neighbor) search: find documents semantically similar to query
POST /products-semantic/_search
{
  "knn": {
    "field": "embedding",
    "query_vector": [0.1, 0.2, ..., 0.9],  // 1536-dim embedding of "comfortable running shoes"
    "k": 10,
    "num_candidates": 100
  },
  "query": {
    "bool": {
      "filter": [
        { "term": { "category": "footwear" } },
        { "term": { "is_in_stock": true } }
      ]
    }
  }
}
```

**Hybrid search (BM25 + vector):**
```json
POST /products/_search
{
  "query": {
    "bool": {
      "should": [
        {
          "match": {
            "title": {
              "query": "running shoes",
              "boost": 0.5
            }
          }
        }
      ]
    }
  },
  "knn": {
    "field": "embedding",
    "query_vector": [...],
    "k": 20,
    "num_candidates": 100,
    "boost": 0.5
  }
}
// Reciprocal Rank Fusion (RRF) for hybrid: combines BM25 rank + kNN rank:
// score(d) = 1/(k + rank_bm25(d)) + 1/(k + rank_knn(d))
// Blends lexical and semantic relevance without needing to tune weights
```

---

## Real-World Example

### Wikipedia Search — Elasticsearch at Scale

Wikipedia serves 500M+ monthly visitors. Their search infrastructure (CirrusSearch) uses Elasticsearch with some unique design decisions:

**Fuzzy search for typos (critical for global user base):**
Wikipedia uses a custom fuzzy matching approach that handles: transliterations (Arabic → Latin), multi-language synonyms, and common misspellings. The search index contains 300+ language-specific configurations.

**Template parameter:** Wikipedia articles contain templates (structured markup). The search index stores both the rendered text (for full-text search) and the template data (for structured querying). A search for "city population > 1M" can filter by structured template data.

**Deduplication across namespaces:** Wikipedia has multiple namespaces (Main, Talk, User, Template). Search results are deduplicated to prefer Main namespace articles, with other namespaces available via advanced search.

**Performance:** Wikipedia's ES cluster processes 10,000+ searches/second at peak (during breaking news events). They use: 6 primary shards per language index, 2 replicas (3 total copies), coordinating nodes to handle query fanout.

**Lessons from Wikipedia:**
1. Use `track_total_hits: false` (or a number like 10000) in production — counting exact hits across billions of documents is expensive. Return "10,000+" instead of the exact count.
2. Scroll API was deprecated in ES 7.x for deep pagination. Use `search_after` with a sort key for cursor-based pagination.
3. Warming queries on new replica shards before traffic is sent reduces p99 spikes on shard rollover.

---

## Failure Scenarios

### Scenario 1: Mapping Explosion Kills the Cluster

```
Scenario: Multi-tenant SaaS platform. Each tenant can add custom attributes to records.
Developer decision: store custom attributes as dynamic fields in Elasticsearch.
  
  Tenant A: { "attribute_color": "red", "attribute_size": "L" }
  Tenant B: { "attribute_material": "cotton", "attribute_fit": "slim" }
  Tenant C: { "attribute_wash": "cold", "attribute_ironing": "low" }
  ...
  
  After 1000 tenants with 10 attributes each: 10,000 dynamic field mappings.
  Each mapping: metadata in cluster state (stored on master nodes, synchronized to all nodes).
  
  At 50,000 mappings: cluster state = 200 MB.
  Each state update (new document with new field): synchronize 200 MB to all nodes.
  Master node: spends 60% of time synchronizing cluster state → other operations queue.
  
  At 100,000 mappings: master node OOM → master election → new master OOM → cluster down.

Root cause:
  "dynamic": true (default) → auto-creates mappings for every new field.
  No governance over tenant-created attributes.

Fix:
  1. Set "dynamic": "strict" on the index → reject documents with unknown fields.
  2. Use a flat "attributes" field:
     { "attributes": [{"key": "color", "value": "red"}, {"key": "size", "value": "L"}] }
     Nested type: fixed schema, unlimited values.
  3. Or: store custom attributes as a JSON string (not indexed, not searchable,
         but returned in _source) + index only the common attributes.
  
Recovery (after mapping explosion):
  1. Stop all writes to the index.
  2. Create a new index with "dynamic": "strict" and correct mapping.
  3. Reindex: POST /_reindex (copies documents, not mappings).
  4. Swap alias.
  5. Reduce cluster state by deleting the old index.
  
  At 100,000 mappings, reindex may take hours → plan for maintenance window.
```

### Scenario 2: Hot Shard — One Shard Handles All Traffic

```
Product search index: 5 shards. Search traffic: 10,000 RPS.
Routing: default (hash(document_id) % 5).
Expected: 2,000 RPS per shard (balanced).

Actual: 
  Shard 0: 4,000 RPS → node-1 CPU: 90%
  Shard 1: 1,000 RPS → node-2 CPU: 20%
  Shard 2: 2,000 RPS → node-3 CPU: 40%
  Shard 3: 2,000 RPS → node-4 CPU: 40%
  Shard 4: 1,000 RPS → node-5 CPU: 20%

Query analysis: 40% of all queries filter on category="Electronics".
All Electronics products: share the same shard (bad luck with hash distribution).
Queries filtered to "Electronics" must search shard 0 (where all Electronics docs live).

Diagnosis:
  GET /_cat/nodes?v&s=cpu:desc  → node-1 at 90% CPU, others < 40%
  GET /_cat/shards/products?v   → shard 0 on node-1
  Query pattern analysis: 40% queries filter category=Electronics → shard 0

Fix options:
  1. Custom routing by category (spread Electronics across all shards):
     POST /products/_doc/prod123?routing=electronics
     → All Electronics documents deliberately spread across routing hash("electronics")
     → But: routing="electronics" → all Electronics queries still go to one shard
     → Doesn't fix the query hot shard, only the data distribution hot shard.
  
  2. Replicate hot shard more:
     For the hot category: create a separate index "products-electronics" with 10 shards.
     Route Electronics category queries to this index.
     Other categories: main products index (5 shards).
  
  3. Add more nodes + force rebalance:
     If data hot shard: adding more shards (split operation) distributes documents.
     cluster.routing.rebalance.enable: "all"  → Elasticsearch rebalances automatically.
  
  4. Cache popular queries:
     "category=Electronics, price < $1000, sort by rating" → very popular query.
     Cache result in Redis for 30 seconds.
     Serves 90% of repetitive queries from cache → reduces ES load for that shard.
```

---

## Performance Considerations

### Query Optimization — Specific Numbers

```
At 10,000 RPS search load:

Filter vs query context:
  Query context (scoring):    ~15ms average query time
  Filter context (no scoring): ~3ms average query time (5× faster)
  Reason: filter results are cached as bit vectors (roaring bitmap) per shard.
          First query: ~10ms. Subsequent identical filter: ~0.5ms (cache hit).
  
  Rule: use filter context for everything that doesn't affect ranking.
        move all term/range/bool filters for is_in_stock, category, price_range to filter context.

Aggregations on keyword vs text:
  "terms" agg on keyword field: ~2ms (doc values, columnar, no heap load)
  "terms" agg on text field (fielddata): ~200ms + loads field into heap
  → 100× slower + OOM risk for text field aggregations

Search after vs scroll vs from/size:
  from/size: default. Works for small offsets (from < 10000).
  from=50000: ES must retrieve 50000 docs × all shards → sort globally → return page 50000.
  At from=50000 with 5 shards: 250,000 docs sorted → take 20 → 250K wasted effort.
  
  search_after: cursor-based. Always fast regardless of depth.
    GET /products/_search { "search_after": [last_score, last_id], "sort": [...] }
    ES: starts from the cursor position → no deep page overhead.
    Use for: infinite scroll, API pagination with cursor tokens.
  
  scroll: deprecated. Created a "scroll context" that consumes heap on every shard.
    At 1000 concurrent scroll sessions × 5 shards: 5000 open scroll contexts → OOM.

Shard count vs query time:
  Query fanout: query goes to ALL shards → results merged.
  5 shards: 5 network round trips → merge 5×10 results = 50 intermediate results.
  50 shards: 50 network round trips → merge 50×10 results = 500 intermediate results.
  50 shard overhead: ~3ms extra vs 5 shards for identical data.
  
  Over-sharding compounds with high concurrency:
    100 concurrent queries × 50 shards = 5000 shard-level queries simultaneously.
    100 concurrent queries × 5 shards = 500 shard-level queries simultaneously.
    10× more internal load from over-sharding.
```

---

## Trade-offs

| Approach | Strengths | Weaknesses | Best For |
|----------|-----------|------------|----------|
| Elasticsearch | Full-text, aggregations, fuzzy, vector | Operational complexity, cost, eventual sync | Complex search, analytics, logs |
| PostgreSQL FTS | ACID, same DB as data, no sync lag | Slower at scale, limited features (no fuzzy by default) | Simple search on small datasets |
| pgvector | Semantic/vector search, in PostgreSQL | No full-text features, limited scale vs ES | Semantic search in Postgres-centric stack |
| Meilisearch | Easy setup, typo-tolerant, fast | Limited aggregations, smaller scale | SaaS product search, < 100M docs |
| Typesense | Fast, multi-tenant, simple API | Younger ecosystem | Small-medium product catalogs |
| Solr | Mature, Lucene-based | Complex, less active than ES | Legacy systems, large Solr expertise |

| ES Deployment | Cost | Ops Complexity | Best For |
|---------------|------|----------------|----------|
| Self-managed (Kubernetes) | Low infra cost | High | Full control, cost-sensitive |
| Elastic Cloud (ESS) | High | Low | Teams without ES ops expertise |
| Amazon OpenSearch | Medium | Medium | AWS-centric, managed |
| Elastic APM + SIEM | Bundled | Low | Full observability stack |

---

## Production Considerations

1. **Set `"dynamic": "strict"` on all production indices.** Dynamic mapping is a mapping explosion waiting to happen. Reject unexpected fields at indexing time — this surfaces bugs in producers immediately rather than silently growing cluster state until the master OOM crashes the cluster.
2. **Set heap to ≤ 31 GB (never exceed 32 GB) and leave 50% of RAM for OS page cache.** The OS page cache is what makes Elasticsearch fast — Lucene reads segments via `mmap` and the OS keeps frequently accessed files in memory. Reducing page cache by giving too much RAM to the JVM heap makes segment reads go to disk.
3. **Alias every index.** Never point client applications directly at `products-v1`. Use the alias `products`. This is the only way to do zero-downtime reindexing when you need to change mappings or shard count.
4. **Monitor shard count per node, not just total shards.** The practical rule: 20-25 shards per GB of heap. A node with 30 GB heap should not host more than ~600-750 shards. Exceeding this causes excessive shard metadata overhead and slower recovery times.
5. **Use `filter` context for all non-scoring conditions.** Every condition in `filter` context is cached as a roaring bitmap after the first execution — identical filter conditions become O(1) lookups. The same condition in `must` (query) context is never cached. This single change can reduce query latency by 50-80% for faceted search workloads.
6. **Never run aggregations on `text` fields.** Use keyword subfields or dedicated `keyword` mappings for any field you aggregate on. Text field aggregations require loading fielddata into heap — one large aggregation can OOM the data node.

---

## Common Beginner Mistakes

1. **Indexing everything as `text` fields.** Fields like `status`, `category`, `user_id`, `product_id` should be `keyword` (no analysis). Indexing them as `text` wastes space (inverted index entries for each character n-gram), slows aggregations (requires fielddata), and prevents exact-match queries from using the more efficient `term` filter.
2. **Not setting `number_of_replicas: 0` during initial bulk indexing.** During bulk load of 100M documents: with 1 replica, every write happens twice (primary + replica). Setting replicas to 0 during load → 2× faster indexing. Restore replicas after: `PUT /products/_settings {"number_of_replicas": 1}`. ES then creates replicas in the background.
3. **Using `scroll` API for deep pagination in new systems.** Scroll was deprecated in ES 7.10. `search_after` with a stable sort is the correct approach. Scroll holds open contexts on every shard — at scale, this causes OOM.
4. **Not testing with production-size datasets.** A 10,000-document test index behaves nothing like a 100M-document production index. Query times, aggregation memory, shard allocation behavior, and merge performance all change dramatically with scale.

---

## Common Senior Engineer Mistakes

1. **One shard per service / one index per tenant.** Multi-tenant systems sometimes create per-tenant indices (tenant_a_products, tenant_b_products, ...). With 10,000 tenants: 10,000 indices × 5 shards = 50,000 shards → cluster management overhead kills performance. Use a single index with a `tenant_id` field + filter on tenant_id in every query.
2. **Setting `refresh_interval: 1s` (or leaving default) for bulk indexing jobs.** Each refresh creates a new segment. Bulk indexing at 50,000 docs/second × 1 refresh/second = many small segments per second → merge struggles to keep up → segment count grows → heap pressure → OOM. During bulk indexing: set `refresh_interval: -1` (disable) or `30s`. Refresh manually after the load.
3. **Over-relying on `_source` for large fields.** `_source` stores the original JSON. If it contains large binary fields or lengthy content, every hit returns the full source. Use `_source_includes` / `_source_excludes` to return only needed fields. Better: store large content in S3, index only searchable metadata in ES, return a reference.
4. **Not planning for index rollover before launch.** A product catalog index at launch: 5 shards, 1 GB. At 3 years of growth: 500 GB, 5 shards → 100 GB per shard → queries slow (large shard = slow merge, slow recovery). Planned rollover: use ILM with rollover, or annual reindex to a new index with updated shard count.

---

## Architecture Smells

- **No alias on production indices** → reindexing requires downtime or complex coordination
- **`"dynamic": true` (default) in production** → mapping explosion risk
- **Shard count set to a "safe large number" (50 shards for 1 GB of data)** → over-sharding, slower queries, excessive heap
- **Aggregations on `text` fields** → fielddata OOM risk
- **`from`/`size` deep pagination (from > 10,000)** → quadratic CPU cost at depth
- **Elasticsearch as the primary data store (not a read model)** → data loss on cluster failure (no ACID), no 2PC with business transactions
- **2 master-eligible nodes (not 3)** → no quorum majority possible during one-node failure → cluster cannot elect master

---

## Principal Engineer Perspective

Elasticsearch is powerful and operationally expensive. The Principal Engineer's job is to use it where it provides unique value and avoid it where simpler tools suffice.

**When Elasticsearch is worth the complexity:**
- Full-text search with relevance ranking across millions to billions of documents
- Faceted search with aggregations (facet counts update in real time)
- Log aggregation and analytics (Kibana/ELK stack)
- Near-real-time semantic/vector search with hybrid ranking

**When it is NOT worth the complexity:**
- Simple LIKE-based search on a small dataset: PostgreSQL FTS (`tsvector`, GIN index) handles millions of documents with sub-100ms queries
- Exact-match lookups: a database index is always faster
- < 1M documents, single-field search: Meilisearch or Typesense are simpler, cheaper, and require no JVM tuning

**The Principal Engineer's Elasticsearch questions:**

1. **Is Elasticsearch the source of truth?** It must not be. Elasticsearch can lose data in split-brain scenarios, doesn't support distributed transactions, and has no ACID guarantees. The source of truth is the primary database. ES is a read model — it can always be rebuilt from the primary store.

2. **What is the sync lag SLA?** At 1-second `refresh_interval` + Kafka consumer lag (~100ms): new documents are searchable within 1-2 seconds. Is this acceptable for the use case? For a product catalog: yes. For stock availability: probably not (use the database directly for inventory checks).

3. **Who manages the Elasticsearch cluster?** A 3-node Elasticsearch cluster is not "set it and forget it." It requires: JVM heap monitoring, shard rebalancing, ILM policy management, security patching, snapshot scheduling, and capacity planning. A team without dedicated Elasticsearch expertise should use a managed service (Elastic Cloud, OpenSearch Service).

4. **What is the disaster recovery plan?** Elasticsearch snapshots: scheduled to S3/GCS every hour. On cluster failure: restore from snapshot + replay 1 hour of Kafka events to rebuild. If Kafka retention is 7 days: worst case restore = 7-day replay (expensive). Snapshot + incremental Kafka replay is the correct DR strategy.

---

## Architecture Review Questions

1. Is `"dynamic": "strict"` set on all production indices? If not, what prevents mapping explosion?
2. Are all production indices accessed via an alias (not directly)?
3. Is Elasticsearch used as a read model (data also in primary database), or as a primary data store?
4. Is the heap set to ≤ 31 GB with 50% of RAM reserved for OS page cache?
5. Are aggregations only on `keyword` fields (not `text` fields with fielddata)?
6. Are filter conditions (is_in_stock, category, price range) in `filter` context (not `must` context)?
7. Is ILM configured for time-series indices (logs, events)?
8. Are there 3 (odd number) dedicated master-eligible nodes?
9. What is the current shard count per GB of data? (Target: 1 shard per 30 GB)
10. Is there a snapshot schedule with tested restore procedures?

---

## Visual / Animation Specification

### Animation 1: Inverted Index — How a Query Works

**Left side: Inverted Index (term → document list). Right side: Documents. Bottom: Query.**

**Query typed:** "red running shoes"

**Step 1:** Query tokenized: ["red", "run", "shoe"] (stemmed). Three glowing search beams.

**Step 2:** Each beam hits the inverted index:
- "red" → [doc1, doc3] highlighted in gold
- "run" → [doc1, doc2] highlighted in blue  
- "shoe" → [doc1, doc2, doc3] highlighted in green

**Step 3:** Intersection/merge animation: doc1 appears in all three → brightest highlight (all terms matched). doc2 in two (run, shoe). doc3 in two (red, shoe).

**Step 4:** Scores computed. doc1 rises to top. doc2 and doc3 below.

**Caption:** "Three lookups. Zero full scans. Results ranked by relevance. Total time: ~2ms."

### Animation 2: Segment Lifecycle — Write → Refresh → Merge

**Timeline with three states: Write Buffer, Segments, Merged Segment.**

**T=0:** Document written → enters Write Buffer (orange, blinking).

**T=1s:** Refresh fires. Write buffer → Segment 1 (small green square). "Searchable."

**T=1s-30s:** More documents. Buffer fills, refreshes. Segments 2, 3, 4, 5 accumulate (5 small green squares).

**T=30s:** Background merge: 5 small segments → 1 medium segment. "Deleted documents physically removed."

**Caption at top:** "New documents: not immediately searchable (refresh interval). Segments: immutable, merged in background."

---

## Hands-On Tutorial

### Build a Product Search API with Elasticsearch

```python
from elasticsearch import Elasticsearch, helpers
import json

es = Elasticsearch("http://localhost:9200")

# 1. Create index with production-grade mapping:
def create_products_index():
    es.indices.create(
        index="products-v1",
        body={
            "settings": {
                "number_of_shards": 3,
                "number_of_replicas": 1,
                "analysis": {
                    "analyzer": {
                        "product_analyzer": {
                            "type": "custom",
                            "tokenizer": "standard",
                            "filter": ["lowercase", "asciifolding", "english_stemmer"]
                        }
                    },
                    "filter": {
                        "english_stemmer": {"type": "stemmer", "language": "english"}
                    }
                }
            },
            "mappings": {
                "dynamic": "strict",
                "properties": {
                    "id": {"type": "keyword"},
                    "title": {
                        "type": "text",
                        "analyzer": "product_analyzer",
                        "fields": {"keyword": {"type": "keyword"}}
                    },
                    "description": {"type": "text", "analyzer": "product_analyzer"},
                    "brand": {"type": "keyword"},
                    "category": {"type": "keyword"},
                    "price": {"type": "float"},
                    "is_in_stock": {"type": "boolean"},
                    "rating": {"type": "float"},
                    "tags": {"type": "keyword"},
                    "created_at": {"type": "date"}
                }
            }
        }
    )
    
    # Create alias:
    es.indices.put_alias(index="products-v1", name="products")

# 2. Bulk index documents:
def bulk_index_products(products):
    actions = [
        {
            "_index": "products",
            "_id": p["id"],
            "_source": p
        }
        for p in products
    ]
    success, errors = helpers.bulk(es, actions, refresh=True)
    return success, errors

# 3. Search:
def search_products(query_text, category=None, min_price=None, max_price=None,
                    in_stock_only=True, page=0, size=20):
    
    must_clauses = []
    filter_clauses = []
    
    if query_text:
        must_clauses.append({
            "multi_match": {
                "query": query_text,
                "fields": ["title^3", "description^1", "brand^2"],
                "fuzziness": "AUTO",
                "prefix_length": 2
            }
        })
    
    if in_stock_only:
        filter_clauses.append({"term": {"is_in_stock": True}})
    
    if category:
        filter_clauses.append({"term": {"category": category}})
    
    if min_price or max_price:
        price_range = {}
        if min_price: price_range["gte"] = min_price
        if max_price: price_range["lte"] = max_price
        filter_clauses.append({"range": {"price": price_range}})
    
    response = es.search(
        index="products",
        body={
            "from": page * size,
            "size": size,
            "track_total_hits": 10000,
            "query": {
                "bool": {
                    "must": must_clauses or [{"match_all": {}}],
                    "filter": filter_clauses
                }
            },
            "aggs": {
                "categories": {"terms": {"field": "category", "size": 20}},
                "price_stats": {"stats": {"field": "price"}},
                "brands": {"terms": {"field": "brand", "size": 20}}
            },
            "sort": [
                {"_score": {"order": "desc"}},
                {"rating": {"order": "desc"}}
            ],
            "highlight": {
                "fields": {
                    "title": {"number_of_fragments": 0},
                    "description": {"number_of_fragments": 2, "fragment_size": 100}
                }
            }
        }
    )
    
    return {
        "total": response["hits"]["total"]["value"],
        "products": [
            {
                "id": hit["_id"],
                "score": hit["_score"],
                "highlight": hit.get("highlight", {}),
                **hit["_source"]
            }
            for hit in response["hits"]["hits"]
        ],
        "aggregations": response["aggregations"]
    }

# Test:
create_products_index()
results = search_products("red running shoes", category="footwear", max_price=200)
print(json.dumps(results, indent=2))
```

```bash
# Start Elasticsearch locally:
docker run -d --name elasticsearch \
  -e "discovery.type=single-node" \
  -e "ES_JAVA_OPTS=-Xms1g -Xmx1g" \
  -p 9200:9200 \
  elasticsearch:8.12.0

# Install Python client:
pip install elasticsearch

# Run the search API:
python search_api.py

# Check cluster health:
curl http://localhost:9200/_cluster/health?pretty

# View index mappings:
curl http://localhost:9200/products/_mapping?pretty

# Check shard allocation:
curl 'http://localhost:9200/_cat/shards/products?v'
```

---

## Exercises

**Conceptual:**
1. Explain the inverted index. How is it built at index time? How is it queried? Why is it faster than a full table scan?
2. What is BM25? Explain the role of TF, IDF, k1, and b parameters in the scoring formula.
3. What is the difference between `text` and `keyword` field types? When should you use each?
4. What is the Lucene segment model? Why are segments immutable? What is the role of segment merging?
5. Explain the split-brain problem in Elasticsearch. How is it prevented in ES 7+? What was the problem with `minimum_master_nodes` in earlier versions?

**Architecture:**
6. Design the Elasticsearch index for a job listings platform: 10M job postings, searchable by title/description/skills, filterable by location/company/salary range/job type, with auto-complete on job title and company name.
7. A product catalog is stored in PostgreSQL. Design the architecture to keep Elasticsearch in sync, including: the sync mechanism, handling for updates and deletes, and the approach for handling sync failures.
8. Your e-commerce platform has 10,000 merchants (tenants). Each merchant has product listings. Design the multi-tenancy strategy: per-tenant index vs shared index with `merchant_id` field. Compare the trade-offs.

**Quantitative:**
9. An Elasticsearch cluster has 3 data nodes, each with 64 GB RAM. You set heap to 32 GB on each. How much RAM is left for OS page cache? Is this configuration correct? What should the heap actually be set to?
10. An index has 500 GB of data and uses 10 shards. Queries take 50ms on average. You scale to 20 shards (via split operation). Query time is now 80ms. Explain why query time increased despite having more shards, and what went wrong.

---

## Solutions

### Exercise 9

**Configuration analysis:**
- RAM per node: 64 GB
- Heap set to: 32 GB
- OS page cache remaining: 64 - 32 = 32 GB

**Is 32 GB heap correct?** No — the JVM CompressedOops boundary is at 32 GB. Setting heap exactly to 32 GB may or may not enable CompressedOops (depends on JVM implementation). The safe maximum is **31 GB** (or more conservatively, 30 GB).

**Correct configuration:** heap = min(31 GB, 50% of RAM) = min(31, 32) = **31 GB heap, 33 GB OS page cache**.

The extra 1 GB of page cache (33 GB vs 32 GB) is more valuable than the 1 GB of JVM heap at these memory sizes. JVM heap beyond 32 GB provides no benefit (CompressedOops disabled) and may actually reduce effective memory usage.

### Exercise 10

**Why 20 shards is slower than 10 shards for this data:**
- With 10 shards: each query fans out to 10 shards → merges 10 × 10 = 100 candidate documents → returns top 10.
- With 20 shards: each query fans out to 20 shards → merges 20 × 10 = 200 candidate documents → returns top 10.
- 20 more network round trips, 2× merge overhead.
- Data size per shard: 500 GB / 20 = 25 GB/shard vs 50 GB/shard previously.
- The data-per-shard reduction doesn't help if the bottleneck was NOT shard scan time (it was fanout overhead).

**What went wrong:** over-sharding. At 500 GB with 10 shards (50 GB/shard), the shards were within recommended sizing. Splitting to 20 shards at 25 GB/shard is within limits but doubles fanout overhead without proportional benefit.

**Fix:** Stay at 10 shards. If queries are slow at 50ms, investigate: are aggregations in query context (move to filter)? Is there fielddata usage? Profile the query to find the actual bottleneck before adding shards.

---

## Interview Questions

### Beginner
- What is an inverted index? How is it different from a database index (B-tree)?
- What is the difference between Elasticsearch and a regular relational database?
- What does "near-real-time search" mean in Elasticsearch? Why is there a delay?

### Senior
- Explain BM25. What are k1 and b parameters? When would you tune them?
- What is the difference between `must` and `filter` context in an Elasticsearch `bool` query? Why does it matter for performance?
- What is mapping explosion? How do you prevent it?
- Explain the split-brain problem. How does ES 7+ prevent it?

### Staff
- Design the indexing strategy for a multi-language product catalog with 100M products in 50 countries. Address: per-country indices vs single index, language-specific analyzers, and cross-country search.
- Your Elasticsearch cluster has red status and 10 unassigned shards. Walk through your diagnosis and remediation steps.
- Explain how you would implement faceted search (e.g., Amazon's left navigation panel) using Elasticsearch aggregations. What performance considerations apply?

### Principal
- A team wants to use Elasticsearch as the primary data store (no SQL database). Evaluate this proposal: what guarantees does ES provide, what does it lack, and under what circumstances (if any) is this acceptable?
- Design the search infrastructure for a global social network: 5B user profiles, full-text search on bio/interests, semantic search ("find people interested in distributed systems"), and real-time indexing of profile updates. Address: index design, sync strategy, relevance tuning, and DR.
- Your search SLA is p99 < 100ms. During peak load (10,000 RPS), p99 climbs to 2 seconds. Walk through your complete diagnosis and optimization strategy.

---

## Summary

Elasticsearch is a distributed search engine built on Apache Lucene, optimized for full-text search with relevance ranking:

- **Inverted index:** term → [doc_id, tf, position]. Built at index time. Queried in O(1) per term. The fundamental data structure that makes text search fast.
- **Lucene segments:** immutable files. Writes go to a buffer → refresh creates a segment (searchable after ~1s). Segments are periodically merged (compaction). Deletes/updates are soft-deleted until merge.
- **BM25 scoring:** combines IDF (rare terms score higher) + TF (more occurrences score higher, with saturation via k1) + length normalization (shorter documents score higher, controlled by b). Tunable per use case.
- **Mappings:** `text` (analyzed, for full-text) vs `keyword` (exact match, aggregations). Always set `"dynamic": "strict"`. Multi-fields for both search and aggregation on the same data.
- **Shard strategy:** 20-50 GB per shard. Shards set at creation (immutable). Over-sharding increases fanout overhead. Use aliases for zero-downtime reindexing.
- **Cluster:** 3 master-eligible nodes (odd, for quorum). Data nodes: heap ≤ 31 GB, 50% RAM for page cache. Filter context is cached; use it for all non-scoring conditions.
- **Common failures:** mapping explosion (`dynamic: true`), hot shards (imbalanced routing), OOM from fielddata (text aggregations), unassigned shards (disk full, node failure).
- **ES is a read model:** not a primary data store. Kept in sync via CDC (Debezium), Kafka, or Outbox pattern. Can be rebuilt from the primary store at any time.

---

## What You Should Now Be Able To Explain

- ✅ How an inverted index is built from documents and why it enables sub-millisecond term lookup regardless of collection size
- ✅ Why Lucene segments are immutable and how this enables concurrent writes and reads without locking
- ✅ The BM25 parameters k1 (TF saturation) and b (length normalization) and how to tune them for product vs content search
- ✅ Why `"dynamic": "strict"` is required in production and what happens without it (mapping explosion timeline)
- ✅ Why 3 master-eligible nodes (not 2) prevents split-brain via quorum majority
- ✅ Why heap > 32 GB reduces effective memory via CompressedOops deactivation

---

## What To Learn Next

**Chapter 22 — Reliability Engineering: SLOs, Error Budgets, and Chaos Engineering.** You've built services that can be deployed, scaled, and searched. Chapter 22 covers how you measure and manage reliability as an engineering discipline: Service Level Indicators (what to measure), Service Level Objectives (what to commit to), Error Budgets (how much unreliability you can spend on features vs incidents), and Chaos Engineering (how to discover reliability gaps before users do — the Netflix Chaos Monkey model, fault injection, game days).
