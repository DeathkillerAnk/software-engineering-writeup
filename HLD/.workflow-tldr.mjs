export const meta = {
  name: 'hld-tldr',
  description: 'Add a tight 60-second TL;DR block to the top of all 31 writeups for fast skimming',
  phases: [{ title: 'Add TL;DRs' }],
}

const BASE = '/Users/deaths_terminal/Development/software-engineering-writeup/HLD'

const PATHS = [
  '00-foundations/01-networking.md',
  '00-foundations/02-compute-and-concurrency.md',
  '00-foundations/03-storage-engines.md',
  '00-foundations/04-capacity-estimation.md',
  '01-building-blocks/05-load-balancing.md',
  '01-building-blocks/06-caching.md',
  '01-building-blocks/07-databases-relational.md',
  '01-building-blocks/08-databases-nosql.md',
  '01-building-blocks/09-replication.md',
  '01-building-blocks/10-partitioning-sharding.md',
  '01-building-blocks/11-messaging-and-streaming.md',
  '02-distributed-systems/12-consistency-and-cap.md',
  '02-distributed-systems/13-consensus.md',
  '02-distributed-systems/14-time-clocks-ordering.md',
  '02-distributed-systems/15-distributed-transactions.md',
  '02-distributed-systems/16-reliability-and-failure.md',
  '03-architecture-and-apis/17-api-design.md',
  '03-architecture-and-apis/18-architectural-styles.md',
  '03-architecture-and-apis/19-observability.md',
  '03-architecture-and-apis/20-security.md',
  '04-design-case-studies/21-interview-framework.md',
  '04-design-case-studies/22-url-shortener-rate-limiter-id-gen.md',
  '04-design-case-studies/23-news-feed-and-timeline.md',
  '04-design-case-studies/24-chat-and-notifications.md',
  '04-design-case-studies/25-search-and-geo.md',
  '04-design-case-studies/26-object-store-and-kv-store.md',
  '04-design-case-studies/27-payments-and-ledgers.md',
  '04-design-case-studies/28-streaming-and-crawler.md',
  '05-principal-skills/29-tradeoffs-and-adrs.md',
  '05-principal-skills/30-evolutionary-architecture.md',
  '05-principal-skills/31-reading-list-and-papers.md',
]

function prompt(p) {
  return [
    'You are a principal engineer who is excellent at distillation. Add a fast-skim summary to the TOP of an existing curriculum chapter. Do NOT change anything else in the file.',
    '',
    'Read the file: ' + BASE + '/' + p,
    '',
    'Then write a section titled exactly:  ## ⚡ 60-Second TL;DR',
    'Content rules (this is for a reader who wants the gist in under a minute, then drills down only where fuzzy):',
    '- 5 to 7 bullet points, each ONE line, dense and concrete. No fluff, no hedging, no full sentences where a phrase works.',
    '- Capture: what this is / why it exists (1 bullet), the 2-4 core concepts or options with their one-line trade-off, the #1 failure mode or misconception to avoid, and any must-know NUMBER or rule-of-thumb (e.g. R+W>N, p99 not average, ~1/N keys remap).',
    '- Use inline bold for key terms so the eye can scan.',
    '- End with a line:  **Remember one thing:** <the single most important piece of judgment from this chapter, one sentence>.',
    '- Keep the whole block under ~140 words. Tighter is better.',
    '',
    'INSERT this block immediately BEFORE the line "## The Mental Model" (use Edit). Leave a blank line after it. Do not duplicate the existing one-line "Principal-level takeaway" blockquote -- the TL;DR complements it.',
    '',
    'Reply with one short line: confirmation + the TL;DR word count.',
  ].join('\n')
}

log('Adding 60-second TL;DRs to ' + PATHS.length + ' writeups.')
const results = await parallel(PATHS.map(function (p) {
  return function () { return agent(prompt(p), { label: 'tldr:' + p, phase: 'Add TL;DRs' }) }
}))
log('Done: ' + results.filter(Boolean).length + '/' + PATHS.length + ' TL;DRs added.')
return { attempted: PATHS.length, done: results.filter(Boolean).length }
