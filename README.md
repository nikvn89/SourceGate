# SourceGate

**Provenance-independence verification on GenLayer.**

SourceGate is a public GenLayer dApp built on the `SourceIndependenceGate`
Intelligent Contract. Users commit immutable source excerpts for a claim,
compare exactly one source pair per validator-consensus call, and accumulate
deterministic verification coverage.

## Live project

- Website: https://source-gate.vercel.app/
- Contract: `0x09324215eEC452600F72Eb1D63ee6Bb48E92740f`
- Explorer: https://explorer-studio.genlayer.com/address/0x09324215eEC452600F72Eb1D63ee6Bb48E92740f

Contract source SHA-256:

```text
337ecb69222e61b7b693621bd7f6d2a84189ed480c6d42b9645fedd3e2273374
```

The repository includes the matching source at:

```text
contracts/SourceIndependenceGate.py
```

## What the contract decides

Each judged source pair receives exactly one semantic verdict:

```text
INDEPENDENT_CORROBORATION
DERIVATIVE_SOURCE_CLUSTER
```

The contract does **not** ask whether the claim is true and does not score source
reputation. It asks whether the two committed excerpts appear to provide
independent corroboration or likely trace back to the same informational origin.

A claim becomes `VERIFIED` only when both deterministic conditions are met:

```text
independent_pairs >= 2
distinct_independent_sources >= 3
```

`VERIFIED` does not mean every source is mutually independent. Unjudged pairs
remain unknown.

## Deterministic teeth

Verification has an on-chain consequence:

- an unverified claim cannot be reused through the typed verified-claim source path;
- exact duplicate excerpts inside one claim are rejected;
- exact copy-paste of an unverified claim text as an external source is rejected;
- re-judging the same pair is a deterministic no-op;
- sources remain append-only;
- verified claims can be reused as typed downstream sources.

## URLs and external content

Reference URLs are human-facing metadata only.

```text
URLs in validator prompt: NO
Web fetching by validators: NO
```

Consensus sees the immutable claim text and two committed source excerpts.

## Public dApp flow

```text
Create claim + source excerpts
→ Pair Review
→ judge one pair per transaction
→ accumulate independent-pair coverage
→ VERIFIED
→ typed downstream reuse unlocked
```

The UI is organized as:

```text
Overview
Sources
Pair Review
```

Claim #1 on the final deployment is the public read-only sample.

## Final live sample

Observed on the final deployed contract:

```text
Claim #1
source_count = 4
pair_count = 3
independent_pairs = 2
distinct_independent_sources = 3
verified = true
```

The live UI shows:

```text
VERIFIED
2/2 independent pairs
3/3 distinct sources
4 immutable excerpts
3 pair records
```

Claim #1 is intentionally read-only in the public frontend so community users
cannot mutate the shared sample through normal UI actions.

## Frontend reliability

The frontend includes the adversarial-review fixes applied before publication:

- same-origin `/genlayer-rpc` proxy for reads;
- MetaMask for writes;
- no browser-side transaction-receipt polling;
- state-transition confirmation instead of receipt confirmation;
- double-submit prevention while a write is pending;
- new claims are resolved by exact `claim.text + claim.author`, not by trusting the global latest id;
- source mutations require the connected wallet to match `claim.author`;
- pair judging remains public because the contract intentionally permits it;
- untrusted reference links are clickable only for `http:` / `https:`;
- source-write confirmation matches the actual resulting source record;
- workspace persistence is namespaced by contract address;
- empty fresh deployments are handled without incorrectly calling `get_claim(1)`;
- an empty/invalid Vercel contract env value safely falls back to the final address.

## Local development

```bash
npm install
npm test
npm run build
npm run dev
```

## Vercel

The included `vercel.json` proxies:

```text
/genlayer-rpc
→ https://studio.genlayer.com/api
```

Optional environment variable:

```text
VITE_CONTRACT_ADDRESS=0x09324215eEC452600F72Eb1D63ee6Bb48E92740f
```

If that environment variable is missing, blank, or not a valid 40-byte hex
address, `src/config.ts` falls back to the final deployment above.

## Honest scope

SourceGate records and adjudicates the relationship between **committed
excerpts**. It does not prove that a committed excerpt came from a real external
document, that the underlying claim is true, or that sophisticated paraphrasing
cannot evade an exact-text deterministic guard.
