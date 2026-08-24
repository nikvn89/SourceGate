# SourceGate

**Public GenLayer dApp for SourceIndependenceGate.**

SourceGate lets users commit immutable source excerpts for a claim, ask GenLayer
validators whether one source pair is genuinely independent or derivative, and
watch the deterministic verification threshold update on-chain.

## Deployed Intelligent Contract

```text
0xb5c2abA865EdfB9F25B44eaedf09BE02D32Fa49D
```

Explorer:

https://explorer-studio.genlayer.com/address/0xb5c2abA865EdfB9F25B44eaedf09BE02D32Fa49D

Contract source SHA-256:

```text
337ecb69222e61b7b693621bd7f6d2a84189ed480c6d42b9645fedd3e2273374
```

The included file `contracts/SourceIndependenceGate.py` is the exact v1.1 source
used for this project build.

## Product flow

```text
Create a fresh claim
→ register immutable source excerpts
→ judge one source pair at a time
→ accumulate independent-pair coverage
→ VERIFIED after 2 positive pairs across 3 distinct sources
→ verified claim can be reused as a typed source downstream
```

## UI

V4 uses a GenLayer-Portal-inspired application shell: light fixed sidebar, compact top bar, a short dark SourceGate hero, wide dashboard cards, and denser two-column workspaces. All V2 transaction and multi-user safety fixes are preserved.


### 01 · Overview
- Claim #1 auto-loads as a read-only public sample.
- Fresh demo claims include a unique run id to avoid shared-state collisions.
- Current verification counters are visible immediately.

### 02 · Sources
- Immutable source registry.
- Add external excerpts.
- Add a VERIFIED claim as a typed source.
- URLs are reference metadata only.

### 03 · Pair Review
- Judge exactly one pair per consensus transaction.
- Show `INDEPENDENT` / `DERIVATIVE`.
- Show pair audit history and verification-gate progress.

## StudioNet handling

- same-origin `/genlayer-rpc` proxy for contract reads;
- MetaMask for writes;
- no browser transaction-receipt polling;
- state-transition confirmation;
- double-submit prevention while a write is pending;
- optional GenLayer Snap;
- `chainChanged` reload;
- last real claim workspace persists in localStorage;
- Claim #1 remains read-only in the frontend.

## Frontend hardening after adversarial review

Project v2 applies the mandatory frontend fixes from the pre-publish review:

- new claim ids are located by exact `claim.text + claim.author`, not by trusting the global `claim_count`;
- local workspace storage is namespaced by deployed contract address;
- source-add actions require the connected wallet to match `claim.author`;
- public pair judging stays available by contract design, with an explicit permanence warning for non-authors;
- untrusted `reference_url` values are rendered only when they parse as `http:` or `https:`;
- deterministic source guards are preflighted where the public read API makes that possible;
- source-write confirmation matches the exact resulting source record, not merely a counter increase;
- timeout copy no longer claims that the transaction succeeded;
- a fresh demo template is generated after successful claim creation;
- live `get_config()` values are rendered in Overview.

## Run locally

```bash
npm install
npm test
npm run build
npm run dev
```

## Vercel

The included `vercel.json` rewrites:

```text
/genlayer-rpc
→ https://studio.genlayer.com/api
```

Optional environment variable:

```text
VITE_CONTRACT_ADDRESS=0xb5c2abA865EdfB9F25B44eaedf09BE02D32Fa49D
```

## Contract runtime already verified

Claim #1:

```text
S1 + S2 -> DERIVATIVE_SOURCE_CLUSTER
S1 + S3 -> INDEPENDENT_CORROBORATION
S3 + S4 -> INDEPENDENT_CORROBORATION

independent_pairs = 2
distinct_independent_sources = 3
verified = true
```

Adversarial guards already observed on StudioNet:

```text
duplicate exact excerpt -> rollback
exact copy of unverified claim as external source -> rollback
rejudging same pair -> deterministic no-op
unverified typed claim reuse -> rollback
verified typed claim reuse -> success
```

## Honest scope

`VERIFIED` does not prove that every source is mutually independent, that a
committed excerpt corresponds to a real external document, or that the
underlying claim is true. It means the deterministic verification threshold was
reached from committed pair verdicts.
