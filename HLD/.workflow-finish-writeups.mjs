export const meta = {
  name: 'finish-writeups',
  description: 'Augment the remaining writeups (11-31) with Mermaid diagrams + Go/Java side-by-side code + animation links, with self-review',
  phases: [{ title: 'Augment + self-review writeups' }],
}

const BASE = '/Users/deaths_terminal/Development/software-engineering-writeup/HLD'

const TITLES = {
  'consistent-hashing.html': 'Consistent Hashing',
  'load-balancing.html': 'Load Balancing Algorithms',
  'cache-stampede.html': 'Cache Stampede & Mitigation',
  'lsm-vs-btree.html': 'LSM-Tree vs B-Tree',
  'replication-failover.html': 'Leader-Follower Replication & Failover',
  'sharding-rebalance.html': 'Partitioning & Rebalancing',
  'quorum.html': 'Quorum Reads & Writes (R + W > N)',
  'raft.html': 'Raft: Leader Election & Log Replication',
  'vector-clocks.html': 'Vector Clocks & Causality',
  'token-bucket.html': 'Token Bucket vs Leaky Bucket',
  'rate-limit-windows.html': 'Rate-Limiting Windows',
  'feed-fanout.html': 'Feed Fan-out: Push vs Pull',
  'circuit-breaker.html': 'Circuit Breaker State Machine',
  'backoff-jitter.html': 'Retry Storms: Backoff + Jitter',
  'saga-vs-2pc.html': 'Distributed Transactions: 2PC vs Saga',
  'bloom-filter.html': 'Bloom Filter',
  'quadtree-geo.html': 'Spatial Indexing: Quadtree',
  'mvcc-isolation.html': 'Isolation Anomalies & MVCC',
  'cap-partition.html': 'CAP: Choosing C vs A During a Partition',
  'log-vs-queue.html': 'Log vs Queue (Kafka vs SQS)',
}

// The 21 writeups (11-31) that still need augmentation.
const WRITEUPS = [
  { path: '01-building-blocks/11-messaging-and-streaming.md', anims: ['log-vs-queue.html'], code: 'An idempotent consumer that dedups by message id before applying a side effect (Go and Java), plus a sketch of the transactional outbox insert.' },
  { path: '02-distributed-systems/12-consistency-and-cap.md', anims: ['cap-partition.html', 'mvcc-isolation.html', 'vector-clocks.html'], code: 'Optional/minimal: a read-your-writes helper that routes a client to the leader (or session-pinned replica) after a write (Go and Java). This chapter is concept-heavy; keep code light.' },
  { path: '02-distributed-systems/13-consensus.md', anims: ['raft.html'], code: 'A Raft RequestVote handler + election-timeout/term-bump logic (grant a vote only if candidate log is at least as up to date; one vote per term) (Go and Java). Sketch the vote path clearly.' },
  { path: '02-distributed-systems/14-time-clocks-ordering.md', anims: ['vector-clocks.html'], code: 'A Lamport clock and a Vector clock with tick/send/receive and a happens-before/concurrent comparison (Go and Java). Ideal complete self-contained example.' },
  { path: '02-distributed-systems/15-distributed-transactions.md', anims: ['saga-vs-2pc.html'], code: 'A saga orchestrator: steps each with action + compensation; on failure run compensations in reverse (Go and Java). Plus an idempotency-key guard.' },
  { path: '02-distributed-systems/16-reliability-and-failure.md', anims: ['circuit-breaker.html', 'backoff-jitter.html'], code: 'Exponential backoff with FULL JITTER, AND a circuit breaker (closed/open/half-open) (Go and Java). Both excellent complete examples.' },
  { path: '03-architecture-and-apis/17-api-design.md', anims: ['token-bucket.html'], code: 'An idempotency-key middleware (store first response keyed by Idempotency-Key, replay on retry) AND cursor/keyset pagination query building (Go and Java).' },
  { path: '03-architecture-and-apis/18-architectural-styles.md', anims: [], code: 'A transactional-outbox event publisher (write business row + event row in one DB tx; relay publishes) sketch (Go and Java). Optional and concise.' },
  { path: '03-architecture-and-apis/19-observability.md', anims: [], code: 'A latency histogram / p99 computation and a RED-metrics HTTP middleware recording rate/errors/duration (Go and Java).' },
  { path: '03-architecture-and-apis/20-security.md', anims: [], code: 'Constant-time token comparison + HMAC sign/verify, and password hashing with a slow KDF (Go: bcrypt/argon2 via x/crypto; Java: an appropriate KDF). Emphasize never rolling your own crypto.' },
  { path: '04-design-case-studies/21-interview-framework.md', anims: [], code: 'No code (method chapter). Use diagrams (e.g. a flowchart of the 8-step framework) instead; skip Go/Java here unless a tiny estimation snippet helps.' },
  { path: '04-design-case-studies/22-url-shortener-rate-limiter-id-gen.md', anims: ['token-bucket.html', 'rate-limit-windows.html', 'consistent-hashing.html'], code: 'Three rich examples: base62 encode/decode; a token-bucket rate limiter; and a Snowflake-style 64-bit ID generator (timestamp|machine|sequence) with clock-rollback handling (Go and Java).' },
  { path: '04-design-case-studies/23-news-feed-and-timeline.md', anims: ['feed-fanout.html'], code: 'A fan-out-on-write worker that pushes a new post id into each follower feed, with the hybrid check that skips push for celebrity accounts (Go and Java).' },
  { path: '04-design-case-studies/24-chat-and-notifications.md', anims: ['backoff-jitter.html'], code: 'A WebSocket connection hub / registry (userId -> connection; register/unregister/route) (Go: a hub goroutine with channels; Java: ConcurrentHashMap + per-session send).' },
  { path: '04-design-case-studies/25-search-and-geo.md', anims: ['quadtree-geo.html'], code: 'A geohash encoder (interleave lat/long bits to base32) AND a trie for typeahead prefix lookup returning top-K (Go and Java).' },
  { path: '04-design-case-studies/26-object-store-and-kv-store.md', anims: ['consistent-hashing.html', 'quorum.html', 'replication-failover.html', 'vector-clocks.html'], code: 'A Dynamo-style coordinator that hashes the key to a preference list, does W-of-N writes and R-of-N reads, and uses version vectors to detect conflicts (Go and Java). Capstone -- compose the building blocks.' },
  { path: '04-design-case-studies/27-payments-and-ledgers.md', anims: ['saga-vs-2pc.html', 'mvcc-isolation.html'], code: 'A double-entry ledger posting (debits == credits, append-only) using INTEGER minor units (never floats), guarded by an idempotency key so a retried charge posts once (Go and Java).' },
  { path: '04-design-case-studies/28-streaming-and-crawler.md', anims: ['bloom-filter.html'], code: 'A crawler URL-dedup using a bloom filter + a per-domain politeness rate limiter (Go and Java).' },
  { path: '05-principal-skills/29-tradeoffs-and-adrs.md', anims: [], code: 'No production code needed. Optionally a tiny architecture fitness-function test (an automated dependency-rule assertion) (Go and Java). Favor an ADR template and decision tables/diagrams.' },
  { path: '05-principal-skills/30-evolutionary-architecture.md', anims: [], code: 'The expand/contract (parallel change) pattern as code: dual-write behind a flag, then read from new, then drop old -- a feature-flagged code path (Go and Java).' },
  { path: '05-principal-skills/31-reading-list-and-papers.md', anims: [], code: 'No code (curated reading chapter). Diagrams optional (e.g. a flowchart of which paper to read after which). Skip the Go/Java requirement.' },
]

function animLinksFor(w) {
  if (!w.anims.length) return '(none for this writeup -- still add Mermaid diagrams and Go/Java code)'
  return w.anims.map(function (a) {
    return '  - ' + (TITLES[a] || a) + '  ->  link as: [' + (TITLES[a] || a) + ' (interactive)](../animations/' + a + ')'
  }).join('\n')
}

function augmentPrompt(w) {
  return [
    'You are a principal engineer and exceptional technical writer. AUGMENT an existing curriculum chapter with diagrams, code, and animation links. You are ADDING, never rewriting or shortening.',
    '',
    'First, READ the existing file in full: ' + BASE + '/' + w.path,
    '',
    'Then improve it IN PLACE (use Edit for targeted insertions; preserve all existing prose, headings, and the 8-section structure -- word count must only grow):',
    '',
    '1) MERMAID DIAGRAMS. Add 2-5 diagrams where they aid understanding, in fenced mermaid code blocks. Replace clunky ASCII diagrams with Mermaid where clearer. Choose the right type: sequenceDiagram (protocols/flows/handshakes), stateDiagram-v2 (state machines), flowchart TD/LR (architectures, decision trees), erDiagram (data models). SYNTAX RULES to avoid broken diagrams: exactly one valid diagram-type header; in flowcharts wrap any label containing spaces/punctuation/parentheses in double quotes inside the node, e.g. A["Write-ahead log (WAL)"]; in sequenceDiagram use participant and ->> / -->> arrows with text after a colon; avoid unescaped parentheses/semicolons/quotes in bare labels. One idea per diagram.',
    '',
    '2) CODE EXAMPLES IN GO AND JAVA, SIDE BY SIDE. Convert pseudocode to real, idiomatic, CORRECT code, and provide BOTH languages for each example: a fenced go block immediately followed by a fenced java block, under a shared bold mini-heading naming the example. Make examples as self-contained and compilable as reasonable. Idiomatic: Go uses goroutines/channels/errors-as-values/context where natural; Java uses clear types and concurrency utilities (ExecutorService, CompletableFuture, concurrent collections, locks) or virtual threads where natural. What to implement here: ' + w.code,
    '   If this chapter is conceptual/methodological and code would be forced, add little or no code -- prioritize clarity over a quota.',
    '',
    '3) ANIMATION LINKS. Insert a callout near the most relevant concept for each related animation, as its own blockquote line beginning with the play symbol, exactly: > **Interactive:** [<Title> (interactive)](../animations/<file>) -- one short clause on what to try. Related animations for THIS chapter:',
    animLinksFor(w),
    '',
    'FINALLY, SELF-REVIEW your own changes before finishing: re-read the file and confirm (a) all 8 sections remain and nothing was deleted/shortened; (b) every mermaid block is syntactically valid by the rules above (if a mermaid validation/render tool is available -- you can discover deferred tools by searching for the keyword mermaid -- run it on each diagram and fix failures); (c) every code example has BOTH an idiomatic, correct Go and Java version; (d) animation links are present and well-formed. Fix anything wrong.',
    '',
    'Reply with a PLAIN-TEXT one-line summary: new word count, # mermaid diagrams added, # Go+Java pairs added, # animation links added. (Do NOT call any structured-output tool; just write the summary as text.)',
  ].join('\n')
}

log('Augmenting ' + WRITEUPS.length + ' remaining writeups (11-31) with diagrams + Go/Java + links.')

const results = await parallel(WRITEUPS.map(function (w) {
  return function () { return agent(augmentPrompt(w), { label: 'augment:' + w.path, phase: 'Augment + self-review writeups' }) }
}))

const done = results.filter(Boolean).length
log('Augmentation finished: ' + done + '/' + WRITEUPS.length + ' agents returned.')

return { attempted: WRITEUPS.length, returned: done, summaries: results.map(function (r, i) { return { path: WRITEUPS[i].path, ok: !!r, summary: r ? String(r).slice(0, 300) : null } }) }
