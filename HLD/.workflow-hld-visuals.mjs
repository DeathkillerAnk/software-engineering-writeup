export const meta = {
  name: 'hld-visuals',
  description: 'Add Mermaid diagrams + Go/Java side-by-side code to all 31 writeups, and build 20 self-contained interactive animations',
  phases: [
    { title: 'Build animations', detail: 'one agent builds each self-contained interactive HTML animation' },
    { title: 'Review animations', detail: 'verify self-contained, correct, bug-free; fix in place' },
    { title: 'Augment writeups', detail: 'add Mermaid diagrams, Go+Java examples, animation links to each writeup' },
    { title: 'Review writeups', detail: 'validate Mermaid, verify Go/Java correctness, links; fix in place' },
  ],
}

const BASE = '/Users/deaths_terminal/Development/software-engineering-writeup/HLD'

// ---- Shared animation design spec (keeps all 20 visually cohesive) ----------
const ANIM_STYLE = [
  'Build ONE self-contained, OFFLINE, single .html file. Absolute hard rules:',
  '- ALL CSS inside a <style> tag, ALL JS inside a <script> tag, in the same file. NO external resources whatsoever: no CDN, no <link> to fonts/css, no <img src=...> to the web, no fetch/XHR/network. It MUST work by double-clicking the file with no internet. The ONLY hyperlinks allowed are the two footer links described below.',
  '- Vanilla JavaScript only. Use inline SVG (preferred for crisp shapes + easy interactivity) or <canvas>. Drive motion with requestAnimationFrame, not long-running busy loops.',
  '',
  'Shared visual language (use these EXACT values so all animations look like one set):',
  '- Dark theme. Page background #0d1117; panels/cards #161b22; border #30363d; primary text #e6edf3; muted text #8b949e.',
  '- Accent/primary #58a6ff (blue); success #3fb950 (green); warning #d29922 (amber); danger #f85149 (red); secondary accent #bc8cff (purple).',
  '- Font: system-ui, -apple-system, Segoe UI, Roboto, sans-serif for text; ui-monospace, SFMono-Regular, Menlo, monospace for code/labels. Border-radius 8px. Comfortable padding. Centered column, max-width ~960px.',
  '- Buttons: dark pill buttons with subtle border, clear hover state, accessible (real <button> elements with text labels).',
  '',
  'Required page structure (in this order):',
  '1. <header>: an <h1> title, and a one-to-two sentence plain-language explainer of what the animation shows.',
  '2. The interactive stage (SVG/canvas).',
  '3. A controls row: at minimum Play/Pause, Step, and Reset buttons, plus any sliders/toggles the concept needs (label every control).',
  '4. A live NARRATION line (e.g. an element with id="narration") that updates in real time to describe the current step in words, e.g. "Node B timed out -> became candidate for term 3, requesting votes." This is the single most important teaching element.',
  '5. A LEGEND explaining colors/shapes.',
  '6. A short "Try this:" hint suggesting an interaction that reveals the key insight.',
  '7. A <footer> with two links: back to the gallery at ./index.html, and to the related writeup (path given per-animation). These two relative links are the ONLY external links permitted.',
  '',
  'Quality bar: smooth, legible, and TECHNICALLY CORRECT. The animation should make the concept click for someone who has never seen it. Prefer clarity over flashiness. Make it responsive enough to look fine from ~700px to ~1100px wide.',
].join('\n')

// ---- The 20 animations -------------------------------------------------------
const ANIMATIONS = [
  { file: 'consistent-hashing.html', title: 'Consistent Hashing', page: '../01-building-blocks/05-load-balancing.md',
    spec: "A hash ring (circle). Show N server nodes placed on the ring, each with several VIRTUAL nodes (toggle vnodes on/off to show how they smooth the distribution). Scatter ~40 keys on the ring; each key is owned by the next node clockwise. Controls: add a node, remove a node, toggle virtual nodes, slider for vnode count. CORRECTNESS: when a node is added or removed, ONLY the keys between the affected segment remap (~1/N of keys) -- highlight exactly those keys that move and display the running '% of keys remapped' so the viewer sees it is small, NOT a full reshuffle. Contrast with naive mod-N (a button that shows mod-N reshuffling almost everything)." },
  { file: 'load-balancing.html', title: 'Load Balancing Algorithms', page: '../01-building-blocks/05-load-balancing.md',
    spec: "Several backend servers shown as bars whose height = current in-flight load. A stream of incoming requests (with randomly varying durations) is dispatched by the selected algorithm. Toggle between Round-Robin, Least-Connections, Random, and Power-of-Two-Choices. CORRECTNESS: Power-of-Two-Choices picks two random servers and routes to the less loaded one, and should visibly produce a much flatter load distribution than Random and close to Least-Connections without global state. Show a max-load and variance readout per algorithm so the viewer can compare." },
  { file: 'cache-stampede.html', title: 'Cache Stampede & Mitigation', page: '../01-building-blocks/06-caching.md',
    spec: "A cache box with a hot key showing a TTL countdown, a slow backing DB, and many concurrent clients. When the TTL expires, without protection ALL clients miss simultaneously and hammer the DB (the thundering herd) -- visualize the spike of DB load. Toggle mitigations: request coalescing / single-flight (only one client recomputes, others wait), and jittered TTL + early recompute. CORRECTNESS: with single-flight, exactly ONE DB fetch happens per expiry regardless of client count. Show a DB-QPS meter that spikes vs stays flat." },
  { file: 'lsm-vs-btree.html', title: 'LSM-Tree vs B-Tree', page: '../00-foundations/03-storage-engines.md',
    spec: "Two modes. LSM mode: writes land in an in-memory memtable; when full it flushes to an immutable SSTable on a level; background compaction merges SSTables into the next level. Visualize write amplification (a byte written once gets rewritten several times by compaction) and that a read may probe multiple levels (mitigated by a bloom filter indicator). B-tree mode: writes update pages in place (read-modify-write), reads follow the tree top-down. CORRECTNESS: depict LSM as write-optimized (sequential appends, deferred merge) and B-tree as read-optimized (in-place, one path). Show a read-amp and write-amp counter for each." },
  { file: 'replication-failover.html', title: 'Leader-Follower Replication & Failover', page: '../01-building-blocks/09-replication.md',
    spec: "One leader, two followers. Client writes go to the leader and replicate to followers. A slider controls replication lag, and a toggle switches sync vs async replication. The viewer can KILL the leader. CORRECTNESS: with ASYNC replication, writes that were acknowledged to the client but not yet replicated are LOST on failover -- highlight those lost writes in red and call it out in the narration. With SYNC, the client wait is longer but no acknowledged write is lost. Show that a new leader is elected from the most up-to-date follower." },
  { file: 'sharding-rebalance.html', title: 'Partitioning & Rebalancing', page: '../01-building-blocks/10-partitioning-sharding.md',
    spec: "A keyspace distributed across shards (use a fixed-number-of-partitions scheme mapped to nodes). Show data items landing in shards. Controls: add a node (partitions move to it -- only some data moves, visualize which), and a toggle to inject a HOT KEY / skewed workload that overloads one shard (a celebrity). CORRECTNESS: contrast hash partitioning (even spread, no range scans) vs range partitioning on a monotonically-increasing key (all new writes pile onto the last shard -- the timestamp hotspot). Show per-shard load bars." },
  { file: 'quorum.html', title: 'Quorum Reads & Writes (R + W > N)', page: '../01-building-blocks/09-replication.md',
    spec: "N replica nodes (slider for N, default 3). Sliders for R (read quorum) and W (write quorum). A write contacts W nodes (highlight them), a read contacts R nodes (highlight them). CORRECTNESS: compute and display whether R + W > N; if so, the read and write quorums are GUARANTEED to intersect (highlight the overlapping node that holds the latest value) so reads see the latest write; if not, show a possible stale read where the read quorum misses the freshly written nodes. Let the viewer perform a write then a read and observe the result. Note read-repair conceptually." },
  { file: 'raft.html', title: 'Raft: Leader Election & Log Replication', page: '../02-distributed-systems/13-consensus.md',
    spec: "5 nodes, each labeled Follower/Candidate/Leader with a current term and a small replicated log. Phase 1 (election): election timeouts fire (randomized), a node becomes Candidate, increments its term, requests votes; CORRECTNESS: it becomes Leader only with a MAJORITY (3 of 5) of votes; a split vote leads to a new term and retry. Phase 2 (replication): client commands append to the leader's log and replicate via AppendEntries; an entry is COMMITTED only once stored on a majority. Let the viewer KILL the leader and watch a new election. Controls: play/pause, step, kill-node, add-client-command. Narration must announce each term change and commit." },
  { file: 'vector-clocks.html', title: 'Vector Clocks & Causality', page: '../02-distributed-systems/14-time-clocks-ordering.md',
    spec: "Three process timelines (P1, P2, P3) running downward. Each can have local events and can send messages to another process (diagonal arrows). Each event updates that process's vector clock. CORRECTNESS: on a local event increment own component; on send, increment then attach the vector; on receive, take element-wise max then increment own. Let the viewer click two events and the tool reports whether they are causally ordered (one happens-before the other) or CONCURRENT (neither dominates) -- the key thing Lamport timestamps cannot tell you. Show each event's vector next to it." },
  { file: 'token-bucket.html', title: 'Token Bucket vs Leaky Bucket', page: '../04-design-case-studies/22-url-shortener-rate-limiter-id-gen.md',
    spec: "Token bucket: a bucket fills with tokens at refill-rate r (slider) up to capacity b (slider); each incoming request consumes one token if available, else is rejected/queued. Visualize a burst of requests draining accumulated tokens (bursts allowed up to b) then being throttled to rate r. Toggle to Leaky bucket: requests enter a queue that drains at a constant rate (smooths bursts, no burst allowance). CORRECTNESS: token bucket permits short bursts up to b; leaky bucket enforces a strictly constant output rate. Show an accept/reject counter and the effective output rate." },
  { file: 'rate-limit-windows.html', title: 'Rate-Limiting Windows', page: '../04-design-case-studies/22-url-shortener-rate-limiter-id-gen.md',
    spec: "A timeline of requests with a limit of K per window. Compare Fixed Window, Sliding Window Log, and Sliding Window Counter. CORRECTNESS: demonstrate the fixed-window BOUNDARY BURST problem -- by clustering requests at the end of one window and the start of the next, up to 2K requests pass in a short span; then show the sliding window correctly rejecting them. Visualize the moving window and which requests are counted vs dropped, with a live count." },
  { file: 'feed-fanout.html', title: 'Feed Fan-out: Push vs Pull', page: '../04-design-case-studies/23-news-feed-and-timeline.md',
    spec: "A small social graph: a few normal users and one CELEBRITY with very many followers. Mode 1 fan-out-on-write (push): when a user posts, the post is copied into every follower's precomputed feed -- visualize write amplification; when the celebrity posts, it explodes into a huge number of writes (highlight the cost). Mode 2 fan-out-on-read (pull): feeds are assembled at read time by querying followees -- cheap writes, expensive reads. Show a hybrid that pushes for normal users and pulls for celebrities. Display write-count and read-cost meters per mode." },
  { file: 'circuit-breaker.html', title: 'Circuit Breaker State Machine', page: '../02-distributed-systems/16-reliability-and-failure.md',
    spec: "A caller, a circuit breaker, and a flaky downstream service (toggle the service healthy/failing). Visualize the three states: CLOSED (requests pass; count failures), OPEN (after a failure threshold, requests fail fast WITHOUT calling downstream, for a cooldown), HALF-OPEN (after cooldown, allow a trial request; success -> CLOSED, failure -> OPEN). CORRECTNESS: in OPEN, downstream is NOT called and the caller gets an immediate error/fallback -- show that the downstream is shielded. Animate the state transitions clearly with the current state highlighted and counters shown." },
  { file: 'backoff-jitter.html', title: 'Retry Storms: Backoff + Jitter', page: '../02-distributed-systems/16-reliability-and-failure.md',
    spec: "Many clients whose requests all fail at the same instant (an outage), then retry. Mode 1 fixed-interval retry: all clients retry in synchronized waves, hammering the recovering service in spikes (the retry storm / thundering herd) -- visualize the synchronized load spikes that keep knocking it over. Mode 2 exponential backoff + full jitter: retries spread out over time, smoothing the load so the service recovers. CORRECTNESS: jitter must visibly DESYNCHRONIZE the retries. Show a load-over-time graph for each mode." },
  { file: 'saga-vs-2pc.html', title: 'Distributed Transactions: 2PC vs Saga', page: '../02-distributed-systems/15-distributed-transactions.md',
    spec: "Mode 2PC: a coordinator and several participants. Phase 1 prepare (participants vote yes/no and LOCK), phase 2 commit/abort. CORRECTNESS: show the blocking failure -- if the coordinator crashes after participants voted yes, participants are stuck holding locks, unable to proceed. Mode Saga: a sequence of local transactions T1..Tn each with a compensating action C1..Cn; if Tk fails, run compensations Ck-1..C1 in reverse. CORRECTNESS: sagas have NO isolation -- show that intermediate states are visible to others before completion/compensation. Let the viewer inject a failure at a chosen step." },
  { file: 'bloom-filter.html', title: 'Bloom Filter', page: '../00-foundations/03-storage-engines.md',
    spec: "A bit array (e.g. 32 bits) and k hash functions (slider for k). Insert items: each sets k bits (highlight them). Query an item: check its k bits -- if any is 0 the answer is DEFINITELY NOT present; if all are 1 the answer is PROBABLY present. CORRECTNESS: demonstrate a FALSE POSITIVE (an item never inserted whose k bits all happen to be set by others) and show that false NEGATIVES are impossible. Show the fill ratio and the rising false-positive probability as more items are added." },
  { file: 'quadtree-geo.html', title: 'Spatial Indexing: Quadtree', page: '../04-design-case-studies/25-search-and-geo.md',
    spec: "A 2D map with scattered points (e.g. drivers/restaurants). A quadtree subdivides space: a cell splits into four quadrants once it holds more than a capacity threshold, so dense areas get fine cells and sparse areas stay coarse (adaptivity is the point -- contrast with a naive uniform grid that is either too coarse in dense areas or wasteful in sparse ones). A 'find nearby' query: draw a radius and highlight the few cells it touches (including neighbors) instead of scanning all points. Controls: add points, run a nearby query, toggle uniform-grid comparison." },
  { file: 'mvcc-isolation.html', title: 'Isolation Anomalies & MVCC', page: '../01-building-blocks/07-databases-relational.md',
    spec: "Two transaction timelines (T1, T2) operating on shared rows. Step through scenarios that demonstrate anomalies: LOST UPDATE (both read x, both write x+1, one update lost) and WRITE SKEW (both read a constraint, both write disjoint rows, jointly violating the invariant). Then switch isolation level: under SNAPSHOT ISOLATION each txn reads from a consistent snapshot (show lost update prevented but WRITE SKEW still possible -- a key subtlety), and under SERIALIZABLE one transaction is aborted to preserve correctness. CORRECTNESS: snapshot isolation must be shown to allow write skew; serializable must abort one txn. Narrate each read/write and which anomaly is/ isn't prevented." },
  { file: 'cap-partition.html', title: 'CAP: Choosing C vs A During a Partition', page: '../02-distributed-systems/12-consistency-and-cap.md',
    spec: "A cluster of replicas serving reads/writes. A button INJECTS A NETWORK PARTITION splitting the cluster into two sides. CORRECTNESS: while healthy, both C and A hold (CAP is silent). During the partition, force the choice: CP mode -- the minority side REJECTS writes (and possibly reads) to stay consistent, so it is unavailable; AP mode -- both sides accept writes and DIVERGE, then reconcile (with a conflict) when the partition heals. The narration must state explicitly that the trade-off exists ONLY during the partition, debunking 'pick 2 of 3'. Then heal the partition and show reconciliation in AP mode." },
  { file: 'log-vs-queue.html', title: 'Log vs Queue (Kafka vs SQS)', page: '../01-building-blocks/11-messaging-and-streaming.md',
    spec: "Left: a traditional QUEUE -- messages are handed to competing consumers and DELETED on ack (each message processed by one consumer; no replay). Right: a partitioned LOG (Kafka-style) -- messages are appended to partitions and RETAINED; each consumer group tracks its own offset and can replay; ordering is guaranteed only WITHIN a partition. CORRECTNESS: show two independent consumer groups reading the same log at different offsets without interfering; show that adding a partition increases parallelism but only per-partition order is preserved. Animate offsets advancing and a consumer 'rewinding' to replay." },
]

// ---- The 31 writeups: which animations to link + what code to add -----------
const WRITEUPS = [
  { path: '00-foundations/01-networking.md', title: 'Networking', anims: [], code: 'An HTTP client with a hard timeout + a single retry (Go: net/http with context.WithTimeout; Java: java.net.http.HttpClient with timeouts). Optionally a tiny TCP echo to show connection setup.' },
  { path: '00-foundations/02-compute-and-concurrency.md', title: 'Compute & Concurrency', anims: [], code: 'A bounded worker pool / semaphore processing a queue of jobs (Go: goroutines + buffered channel as semaphore + WaitGroup; Java: ExecutorService / virtual threads with a Semaphore). Show that unbounded concurrency is the bug.' },
  { path: '00-foundations/03-storage-engines.md', title: 'Storage Engines', anims: ['lsm-vs-btree.html', 'bloom-filter.html'], code: 'A bloom filter (bit set + k hashes) and/or a WAL append-then-apply snippet (Go and Java).' },
  { path: '00-foundations/04-capacity-estimation.md', title: 'Capacity Estimation', anims: [], code: 'Optional and minimal: a tiny function that turns DAU + actions/user/day + peak-factor into peak QPS and yearly storage (Go and Java). Keep it short; this chapter is about method, not code.' },
  { path: '01-building-blocks/05-load-balancing.md', title: 'Load Balancing', anims: ['consistent-hashing.html', 'load-balancing.html'], code: 'A consistent-hash ring with virtual nodes (add/remove node, lookup) AND a power-of-two-choices picker (Go and Java).' },
  { path: '01-building-blocks/06-caching.md', title: 'Caching', anims: ['cache-stampede.html'], code: 'Cache-aside with stampede protection via single-flight (Go: golang.org/x/sync/singleflight OR a hand-rolled mutex+map; Java: a ConcurrentHashMap of CompletableFuture so only one loader runs per key).' },
  { path: '01-building-blocks/07-databases-relational.md', title: 'Relational Databases', anims: ['mvcc-isolation.html'], code: 'Optimistic concurrency control via a version column (compare-and-set UPDATE ... WHERE version = ?) to prevent lost updates (Go: database/sql; Java: JDBC). Mention SELECT ... FOR UPDATE for pessimistic.' },
  { path: '01-building-blocks/08-databases-nosql.md', title: 'NoSQL & Data Models', anims: ['consistent-hashing.html', 'quorum.html'], code: 'A small tunable-consistency read/write helper showing R/W/N and how R+W>N is checked (Go and Java). Keep it illustrative.' },
  { path: '01-building-blocks/09-replication.md', title: 'Replication', anims: ['replication-failover.html', 'quorum.html'], code: 'A quorum write that succeeds only after W acks, and a quorum read that contacts R replicas and returns the value with the highest version (Go: goroutines + channels for parallel replica calls; Java: CompletableFuture.allOf / a CompletionService).' },
  { path: '01-building-blocks/10-partitioning-sharding.md', title: 'Partitioning & Sharding', anims: ['sharding-rebalance.html', 'consistent-hashing.html'], code: 'A partition router: hash partitioning vs range partitioning, mapping a key to a shard; show the monotonic-key hotspot for range (Go and Java).' },
  { path: '01-building-blocks/11-messaging-and-streaming.md', title: 'Messaging & Streaming', anims: ['log-vs-queue.html'], code: 'An idempotent consumer that dedups by message id before applying a side effect (Go and Java), plus a sketch of the transactional outbox insert. ' },
  { path: '02-distributed-systems/12-consistency-and-cap.md', title: 'Consistency, CAP & PACELC', anims: ['cap-partition.html', 'mvcc-isolation.html', 'vector-clocks.html'], code: 'Optional/minimal: a read-your-writes helper that routes a client to the leader (or a session-pinned replica) after a write (Go and Java). This chapter is concept-heavy; keep code light.' },
  { path: '02-distributed-systems/13-consensus.md', title: 'Consensus (Raft/Paxos)', anims: ['raft.html'], code: 'A Raft RequestVote handler + the election-timeout/term-bump logic (the safety check: grant a vote only if candidate log is at least as up to date, one vote per term) (Go and Java). Sketch only the vote path, clearly.' },
  { path: '02-distributed-systems/14-time-clocks-ordering.md', title: 'Time, Clocks & Ordering', anims: ['vector-clocks.html'], code: 'A Lamport clock and a Vector clock with tick/send/receive operations and a happens-before/concurrent comparison (Go and Java). This is an ideal, complete, self-contained example.' },
  { path: '02-distributed-systems/15-distributed-transactions.md', title: 'Distributed Transactions & Sagas', anims: ['saga-vs-2pc.html'], code: 'A saga orchestrator: a list of steps each with an action and a compensation; on failure, run compensations in reverse (Go and Java). Plus an idempotency-key guard.' },
  { path: '02-distributed-systems/16-reliability-and-failure.md', title: 'Reliability', anims: ['circuit-breaker.html', 'backoff-jitter.html'], code: 'Exponential backoff with FULL JITTER for retries, AND a simple circuit breaker (closed/open/half-open) (Go and Java). Both are excellent complete examples.' },
  { path: '03-architecture-and-apis/17-api-design.md', title: 'API Design', anims: ['token-bucket.html'], code: 'An idempotency-key middleware (store first response keyed by Idempotency-Key, replay it on retry) AND cursor/keyset pagination query building (Go and Java).' },
  { path: '03-architecture-and-apis/18-architectural-styles.md', title: 'Architectural Styles', anims: [], code: 'A transactional-outbox event publisher (write business row + event row in one DB tx; a relay publishes) sketch (Go and Java). Optional and concise.' },
  { path: '03-architecture-and-apis/19-observability.md', title: 'Observability & SLOs', anims: [], code: 'A latency histogram / percentile (p99) computation and a RED-metrics HTTP middleware that records rate/errors/duration (Go and Java).' },
  { path: '03-architecture-and-apis/20-security.md', title: 'Security', anims: [], code: 'Constant-time token comparison + HMAC signing/verification, and password hashing with a slow KDF (Go: bcrypt/argon2 via x/crypto; Java: an appropriate KDF). Emphasize never rolling your own crypto.' },
  { path: '04-design-case-studies/21-interview-framework.md', title: 'The Design Framework', anims: [], code: 'No code (this is a method chapter). Use diagrams instead; skip the Go/Java requirement here unless a tiny estimation snippet helps.' },
  { path: '04-design-case-studies/22-url-shortener-rate-limiter-id-gen.md', title: 'URL Shortener / Rate Limiter / ID Gen', anims: ['token-bucket.html', 'rate-limit-windows.html', 'consistent-hashing.html'], code: 'Three rich examples: base62 encode/decode for short codes; a token-bucket rate limiter; and a Snowflake-style 64-bit ID generator (timestamp|machine|sequence) with clock-rollback handling (Go and Java).' },
  { path: '04-design-case-studies/23-news-feed-and-timeline.md', title: 'News Feed', anims: ['feed-fanout.html'], code: 'A fan-out-on-write worker that pushes a new post id into each follower feed, with the hybrid check that skips push for celebrity accounts (Go and Java).' },
  { path: '04-design-case-studies/24-chat-and-notifications.md', title: 'Chat & Notifications', anims: ['backoff-jitter.html'], code: 'A WebSocket connection hub / registry (map of userId -> connection, register/unregister/route a message) (Go: a hub goroutine with channels; Java: a ConcurrentHashMap + per-session send). ' },
  { path: '04-design-case-studies/25-search-and-geo.md', title: 'Search & Geo', anims: ['quadtree-geo.html'], code: 'A geohash encoder (interleave lat/long bits to a base32 string) AND a trie for typeahead prefix lookup returning top-K (Go and Java).' },
  { path: '04-design-case-studies/26-object-store-and-kv-store.md', title: 'Object Store & KV Store', anims: ['consistent-hashing.html', 'quorum.html', 'replication-failover.html', 'vector-clocks.html'], code: 'A Dynamo-style coordinator that hashes the key to a preference list, does W-of-N writes and R-of-N reads, and uses version vectors to detect conflicts (Go and Java). This is the capstone -- compose the building blocks.' },
  { path: '04-design-case-studies/27-payments-and-ledgers.md', title: 'Payments & Ledgers', anims: ['saga-vs-2pc.html', 'mvcc-isolation.html'], code: 'A double-entry ledger posting (debits == credits, append-only) using INTEGER minor units (never floats), guarded by an idempotency key so a retried charge posts once (Go and Java).' },
  { path: '04-design-case-studies/28-streaming-and-crawler.md', title: 'Streaming & Crawler', anims: ['bloom-filter.html'], code: 'A crawler URL-dedup using a bloom filter + a per-domain politeness rate limiter (Go and Java).' },
  { path: '05-principal-skills/29-tradeoffs-and-adrs.md', title: 'Trade-offs & ADRs', anims: [], code: 'No production code needed. Optionally a tiny architecture "fitness function" test (an automated assertion about the architecture, e.g. a dependency rule) (Go and Java). Keep it minimal; favor an ADR template and decision tables/diagrams.' },
  { path: '05-principal-skills/30-evolutionary-architecture.md', title: 'Evolutionary Architecture', anims: [], code: 'The expand/contract (parallel change) pattern shown as code: dual-write behind a flag, then read from new, then drop old -- as a feature-flagged code path (Go and Java).' },
  { path: '05-principal-skills/31-reading-list-and-papers.md', title: 'Reading List', anims: [], code: 'No code (this is a curated reading chapter). Diagrams optional (e.g. a dependency/sequence map of which paper to read after which). Skip the Go/Java requirement.' },
]

function animLinksFor(w) {
  if (!w.anims.length) return '(none for this writeup)'
  return w.anims.map(function (a) {
    var meta = ANIMATIONS.find(function (x) { return x.file === a })
    var title = meta ? meta.title : a
    return '  - ' + title + '  ->  link as: [' + title + ' (interactive)](../animations/' + a + ')'
  }).join('\n')
}

// ---- Prompts -----------------------------------------------------------------
function builderPrompt(a) {
  return [
    'You are an expert front-end engineer and an exceptional CS educator. Build ONE self-contained interactive teaching animation as a single HTML file.',
    '',
    ANIM_STYLE,
    '',
    '=== THIS ANIMATION ===',
    'Title: ' + a.title,
    'What to visualize and the required interactions / correctness constraints:',
    a.spec,
    '',
    'Footer links: gallery = ./index.html ; related writeup = ' + a.page,
    '',
    '=== OUTPUT ===',
    'Write the complete HTML file to this exact absolute path using the Write tool: ' + BASE + '/animations/' + a.file,
    'Then reply with a one-line confirmation. Do not ask questions; produce the finished, working file now. Double-check the JavaScript has no syntax errors and uses only browser-built-in APIs (no imports, no external URLs).',
  ].join('\n')
}

const ANIM_REVIEW_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    file: { type: 'string' },
    selfContained: { type: 'boolean', description: 'true if no external/network resources remain (only allowed links are ./index.html and the ../ writeup .md)' },
    conceptCorrect: { type: 'boolean', description: 'true if the visualization correctly depicts the concept and its correctness constraints' },
    noJsErrors: { type: 'boolean', description: 'true if the JavaScript appears free of syntax errors and obvious runtime bugs after your fixes' },
    issuesFound: { type: 'array', items: { type: 'string' } },
    fixesApplied: { type: 'array', items: { type: 'string' } },
    remainingConcerns: { type: 'array', items: { type: 'string' } },
  },
  required: ['file', 'selfContained', 'conceptCorrect', 'noJsErrors', 'issuesFound', 'fixesApplied', 'remainingConcerns'],
}

function animReviewPrompt(a) {
  return [
    'You are a meticulous front-end reviewer AND a distributed-systems expert. Review one interactive teaching animation and FIX problems in place.',
    '',
    'Read the file at this absolute path: ' + BASE + '/animations/' + a.file,
    'It is supposed to depict: ' + a.title + ' -- ' + a.spec,
    '',
    'Check and FIX (edit the file directly):',
    '1) SELF-CONTAINED: there must be NO external resources -- search the file for http://, https://, //, src=, href= (except the two allowed footer links ./index.html and ' + a.page + '), @import, url( with a web URL, fetch/XMLHttpRequest, CDN script tags, or web fonts. If any exist, inline or remove them so the file works offline by double-click.',
    '2) JAVASCRIPT CORRECTNESS: read the <script> carefully for syntax errors, undeclared variables, off-by-one/animation bugs, and event handlers referencing missing elements. Verify the required controls (Play/Pause, Step, Reset, and concept-specific controls) exist and are wired. Fix what is broken.',
    '3) CONCEPT CORRECTNESS: verify the specific correctness constraints in the spec are actually implemented (e.g. quorum intersection requires R+W>N; Raft needs a majority and term bumps; consistent hashing remaps only ~1/N keys; async-replication failover loses unreplicated acked writes; snapshot isolation still allows write skew; bloom filter has no false negatives). Correct any technical misrepresentation.',
    '4) TEACHING QUALITY: there must be a live narration line, a legend, and a Try-this hint; the UI should be legible against the dark theme. Improve if missing.',
    '',
    'If a tool to validate or render HTML/JS is available, you may use it, but careful manual reading is expected. After fixing, return the structured report listing exactly what you found and changed.',
  ].join('\n')
}

function augmentPrompt(w) {
  return [
    'You are a principal engineer and exceptional technical writer. AUGMENT an existing curriculum chapter with diagrams, code, and animation links. You are ADDING, never rewriting or shortening.',
    '',
    'First, READ the existing file in full: ' + BASE + '/' + w.path,
    '',
    'Then improve it IN PLACE (use Edit for targeted insertions; preserve all existing prose, headings, and the 8-section structure -- the word count must not drop, only grow):',
    '',
    '1) MERMAID DIAGRAMS. Add 2-5 diagrams where they genuinely aid understanding, in fenced mermaid code blocks. Where an existing ASCII diagram would be clearer as Mermaid, replace it with Mermaid (keep ASCII only if Mermaid cannot express it). Choose the right type: sequenceDiagram (protocols/request flows/handshakes), stateDiagram-v2 (state machines), flowchart TD/LR (architectures, decision trees), erDiagram (data models). MERMAID SYNTAX RULES to avoid broken diagrams: pick exactly one valid diagram type header; in flowcharts wrap any label containing spaces/punctuation/parentheses in double quotes inside the node, e.g. A["Write-ahead log (WAL)"]; in sequenceDiagram use participant and ->> / -->> arrows and put complex text after a colon; avoid characters that break the parser (unescaped parentheses/semicolons/quotes in bare labels). Keep diagrams focused (one idea each).',
    '',
    '2) CODE EXAMPLES IN GO AND JAVA, SIDE BY SIDE. Convert pseudocode to real, idiomatic, CORRECT code, and provide BOTH languages for each example: a fenced go block immediately followed by a fenced java block, under a shared bold mini-heading naming the example. Make examples as self-contained and compilable as is reasonable (the reader should be able to lift them out). Idiomatic means: Go uses goroutines/channels/errors-as-values/context where natural; Java uses clear types, the concurrency utilities (ExecutorService, CompletableFuture, Concurrent collections, locks) or virtual threads where natural. What to implement here: ' + w.code,
    '   If this chapter is conceptual/methodological and code would be forced, it is acceptable to add little or no code -- prioritize correctness and clarity over hitting a quota.',
    '',
    '3) ANIMATION LINKS. Insert a callout near the most relevant concept for each related animation, as its own blockquote line beginning with the play symbol, exactly like: > **Interactive:** [<Title> (interactive)](../animations/<file>) -- one short clause on what to try. The related animations for THIS chapter:',
    animLinksFor(w),
    '',
    'Validate every Mermaid block. If a Mermaid validate/render tool is available (you can discover deferred tools by searching for the keyword mermaid), use it on each diagram and fix any that fail; otherwise verify syntax carefully by the rules above.',
    '',
    'When done, reply with: the new approximate word count, how many Mermaid diagrams you added, how many Go+Java example pairs you added, and how many animation links you inserted.',
  ].join('\n')
}

const WRITEUP_REVIEW_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    path: { type: 'string' },
    structurePreserved: { type: 'boolean', description: 'true if all 8 sections remain and no original substance was removed/shortened' },
    mermaidValid: { type: 'boolean', description: 'true if every mermaid block is syntactically valid after your fixes' },
    goAndJavaCorrect: { type: 'boolean', description: 'true if every code example has both a Go and a Java version and both are idiomatic and correct' },
    animLinksOk: { type: 'boolean', description: 'true if the expected animation links are present and well-formed' },
    diagramCount: { type: 'number' },
    codePairCount: { type: 'number' },
    issuesFound: { type: 'array', items: { type: 'string' } },
    fixesApplied: { type: 'array', items: { type: 'string' } },
    remainingConcerns: { type: 'array', items: { type: 'string' } },
  },
  required: ['path', 'structurePreserved', 'mermaidValid', 'goAndJavaCorrect', 'animLinksOk', 'diagramCount', 'codePairCount', 'issuesFound', 'fixesApplied', 'remainingConcerns'],
}

function writeupReviewPrompt(w) {
  return [
    'You are a ruthless technical reviewer with deep distributed-systems, Go, and Java expertise. Review an augmented curriculum chapter and FIX problems in place.',
    '',
    'Read the file at this absolute path: ' + BASE + '/' + w.path,
    '',
    'Verify and FIX (edit the file directly):',
    '1) STRUCTURE PRESERVED: all eight sections still present (Mental Model, Core Concepts, Trade-offs table, How Real Systems Do It, Failure Modes & Misconceptions, In a Design Discussion, Self-Check, Go Deeper) and NO original explanation was deleted or shortened during augmentation. If substance was lost, restore the intent.',
    '2) MERMAID VALIDITY: every fenced mermaid block must parse. Check each for a valid diagram-type header, valid arrows for that type, and properly quoted labels (any label with spaces/parentheses/punctuation in a flowchart node must be in double quotes). If a Mermaid validation/render tool is available (search deferred tools for the keyword mermaid), run it on each block and fix failures; otherwise verify by the rules. Fix broken diagrams.',
    '3) GO + JAVA: every code example must have BOTH a Go and a Java version, and both must be idiomatic and CORRECT (no obvious compile errors, right APIs, right concurrency primitives, integer money not floats, etc.). If a language counterpart is missing, ADD it. If code is wrong or non-idiomatic, fix it. (It is fine for a purely conceptual chapter to have little/no code.)',
    '4) ANIMATION LINKS: the expected links for this chapter should be present and point to ../animations/<file>. Expected:',
    animLinksFor(w),
    '   Add or fix as needed.',
    '5) TECHNICAL ACCURACY of any newly added prose.',
    '',
    'Return the structured report listing exactly what you found and changed.',
  ].join('\n')
}

// ---- Orchestration: two independent pipelines, run concurrently --------------
log('Track A: building ' + ANIMATIONS.length + ' interactive animations. Track B: augmenting ' + WRITEUPS.length + ' writeups with Mermaid + Go/Java + links.')

const animationsPromise = pipeline(
  ANIMATIONS,
  function (a) { return agent(builderPrompt(a), { label: 'build:' + a.file, phase: 'Build animations' }) },
  function (built, a) { return agent(animReviewPrompt(a), { label: 'review:' + a.file, phase: 'Review animations', schema: ANIM_REVIEW_SCHEMA }) },
)

const writeupsPromise = pipeline(
  WRITEUPS,
  function (w) { return agent(augmentPrompt(w), { label: 'augment:' + w.path, phase: 'Augment writeups' }) },
  function (aug, w) { return agent(writeupReviewPrompt(w), { label: 'review:' + w.path, phase: 'Review writeups', schema: WRITEUP_REVIEW_SCHEMA }) },
)

const animReports = (await animationsPromise).filter(Boolean)
const writeupReports = (await writeupsPromise).filter(Boolean)

const animBad = animReports.filter(function (r) { return !r.selfContained || !r.conceptCorrect || !r.noJsErrors })
const wuBad = writeupReports.filter(function (r) { return !r.structurePreserved || !r.mermaidValid || !r.goAndJavaCorrect || !r.animLinksOk })

log('Animations: ' + animReports.length + '/' + ANIMATIONS.length + ' done, ' + animBad.length + ' still flagged. Writeups: ' + writeupReports.length + '/' + WRITEUPS.length + ' done, ' + wuBad.length + ' still flagged.')

return {
  animations: { total: ANIMATIONS.length, reviewed: animReports.length, flagged: animBad.map(function (r) { return { file: r.file, selfContained: r.selfContained, conceptCorrect: r.conceptCorrect, noJsErrors: r.noJsErrors, concerns: r.remainingConcerns } }) },
  writeups: { total: WRITEUPS.length, reviewed: writeupReports.length, flagged: wuBad.map(function (r) { return { path: r.path, structurePreserved: r.structurePreserved, mermaidValid: r.mermaidValid, goAndJavaCorrect: r.goAndJavaCorrect, animLinksOk: r.animLinksOk, concerns: r.remainingConcerns } }) },
  animDetail: animReports.map(function (r) { return { file: r.file, fixes: (r.fixesApplied || []).length, concerns: r.remainingConcerns } }),
  writeupDetail: writeupReports.map(function (r) { return { path: r.path, diagrams: r.diagramCount, codePairs: r.codePairCount, fixes: (r.fixesApplied || []).length, concerns: r.remainingConcerns } }),
}
