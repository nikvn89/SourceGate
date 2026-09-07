# SourceGate

**Auditable source-independence gating on GenLayer.**

SourceGate is a GenLayer dApp built on the `SourceIndependenceGate` Intelligent
Contract. A claim author commits immutable source excerpts, any connected user
may submit one source pair at a time for validator consensus, and the contract
updates verification state using deterministic thresholds and replay guards.

The semantic question is deliberately narrow: whether two committed excerpts
**appear independently grounded** or likely derive from a shared informational
origin. The contract does not decide whether the underlying claim is true and
does not score source reputation.

## Deployment and evidence

### Clean project deployment

The public dApp is pinned to the clean project deployment:

```text
0xb325DDa519E2D5BE1Ca8Fa24A1A1DE849113D48a
```

Explorer:

```text
https://explorer-studio.genlayer.com/address/0xb325DDa519E2D5BE1Ca8Fa24A1A1DE849113D48a
```

This deployment was created from the frozen source and intentionally left with
an empty registry (`claim_count = 0`) before public use.

### Runtime evidence deployment

Load-bearing runtime validation was performed on:

```text
0x5E7BA4f9D9B306DaDb2a56A3FCCb747960ac4f6b
```

Explorer:

```text
https://explorer-studio.genlayer.com/address/0x5E7BA4f9D9B306DaDb2a56A3FCCb747960ac4f6b
```

### Frozen source parity

Public repository contract file:

```text
contracts/SourceGate.py
```

Implementation/class and `get_config().name` remain:

```text
SourceIndependenceGate
```

Frozen contract SHA-256:

```text
ead0b54660d1ba82b3ffd6cf02a54da5ce89d898226da1b8b30cb2f60429208f
```

The clean project deployment and runtime-evidence deployment use this same
frozen contract source.

## What the contract decides

Each newly judged source pair receives exactly one accepted semantic verdict:

```text
INDEPENDENT_CORROBORATION
DERIVATIVE_SOURCE_CLUSTER
```

A claim becomes `VERIFIED` only when both deterministic conditions hold:

```text
independent_pairs >= 2
distinct_independent_sources >= 3
```

`VERIFIED` is a one-way latch. It does not mean every source is mutually
independent; unjudged pairs remain unknown.

## Deterministic consequences and anti-reroll rules

- Exact duplicate excerpts inside one claim are rejected.
- Exact copy-paste of an unverified claim text as an external source is rejected.
- An unverified claim cannot enter another claim through the typed
  `add_verified_claim_source` path.
- A verified claim can be reused through that typed path and the resulting
  source stores its `from_claim_id` lineage.
- Re-judging the same pair is a deterministic no-op.
- Pair order is normalized, so `(A,B)` and `(B,A)` resolve to the same permanent
  pair record.
- Sources are append-only.
- Threshold counters and the `VERIFIED` transition are deterministic contract
  logic, not model decisions.

## Semantic failure boundary

The validator call is limited to one claim and two committed excerpts. Reference
URLs never enter the consensus prompt and validators do not fetch external web
content.

The semantic response must match the expected object shape and one of the two
allowed verdicts. Malformed/out-of-schema responses are rejected before the
pair/cache/counter write path. Provider failure or non-convergence likewise does
not become a semantic success. These failure branches are part of the frozen
source control flow; the public runtime evidence does not claim that an
artificial provider outage or malformed provider response was forced in
production.

## Runtime evidence summary

The runtime-evidence deployment demonstrated:

```text
PASS  fresh get_config profile for version 1.2
PASS  DERIVATIVE_SOURCE_CLUSTER path
PASS  INDEPENDENT_CORROBORATION path
PASS  no premature VERIFIED state
PASS  threshold: 2 independent pairs across 3 distinct sources -> VERIFIED
PASS  exact-pair replay without a new pair/counter write
PASS  reverse-order pair replay without reroll
PASS  prompt-injection-style excerpt contained by structured semantic output
PASS  unverified typed reuse -> execution error/rollback -> no write
PASS  exact-copy unverified bypass -> execution error/rollback -> no write
PASS  verified typed reuse -> success with exact from_claim_id lineage
PASS  VERIFIED remains true after later derivative evidence
```

The runtime also visibly demonstrates why consensus/finalization status must not
be treated as execution success: rejected reuse/bypass calls reached accepted
consensus on an `ERROR`/rollback result, and post-state remained unchanged.

See [`TESTING.md`](./TESTING.md) for the reproducible sequence and observed
postconditions.

## Public dApp flow

```text
Connect wallet
-> Create claim with committed excerpts
-> Load finalized claim state
-> Judge one source pair per transaction
-> Accumulate deterministic coverage
-> VERIFIED
-> Reuse the verified claim through the typed provenance path
```

The frontend does not reserve Claim #1 as a hard-coded sample. On a clean
registry, the first real user's Claim #1 remains a normal writable workspace for
its author. Source additions require the claim author; pair judging remains
public because the contract intentionally permits it.

## Frontend transaction confirmation

The UI does not treat a submitted/finalized transaction label as sufficient
proof of execution success. It confirms actions through exact post-state:

- claim creation resolves the resulting claim by exact `text + author`;
- external-source writes wait for the exact resulting source record;
- verified-claim reuse waits for matching `from_claim_id` plus claim text;
- pair judgments wait for `get_pair_by_sources(...).judged`;
- timeout messaging explicitly distinguishes a sent transaction from a
  confirmed state change.

## URLs and external content

Reference URLs are human-facing metadata only:

```text
URLs in validator prompt: NO
Web fetching by validators: NO
```

The frontend only renders clickable reference links for `http:` and `https:`.

## Local development

```bash
npm ci
npm test
npm run build
npm run dev
```

The submission build is intentionally pinned in `src/config.ts` to the clean
project deployment, avoiding a stale Vercel environment variable silently
redirecting the final UI to a historical contract.

## Live site

```text
https://source-gate.vercel.app/
```

After deploying this repository revision, the top-bar/explorer link and live
configuration panel should display the clean project deployment above, while the
runtime-evidence link points to the separately tested deployment.

## Honest scope

SourceGate records and adjudicates relationships between **committed excerpts**.
It does not authenticate that an excerpt came from a real external document, it
does not prove the truth of the underlying claim, and exact-text guards do not
claim to defeat sophisticated paraphrasing.
