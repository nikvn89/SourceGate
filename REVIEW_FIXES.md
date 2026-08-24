# SourceGate Project v2 — Review Fix Log

This revision applies the actionable frontend findings from the Claude
pre-deploy / pre-publish review without changing the deployed Intelligent
Contract.

## Fixed

### CRITICAL — concurrent create_claim attribution
The frontend no longer assumes that a higher global `claim_count` belongs to
the current user. After submission it scans newly created claim ids and accepts
only an exact match on:

```text
claim.text == submittedText
AND
claim.author == connected wallet
```

### HIGH — ownership-aware source mutations
`add_external_source` and `add_verified_claim_source` are disabled unless the
connected wallet matches `claim.author`.

Public `judge_pair` remains available on non-sample claims because the contract
intentionally permits public pair judging. Non-authors receive an explicit
warning that the verdict is permanent and the pair cannot be judged again.

### HIGH — untrusted reference URL
External links are rendered only when their scheme is `http:` or `https:`.
Invalid/non-web schemes are displayed as text, not clickable links. New external
sources are also rejected client-side when a non-empty URL is not HTTP(S).

### HIGH — deterministic preflight and timeout wording
The frontend now preflights checks available from public state, including:

- source ownership;
- exact duplicate source excerpt in the current claim;
- max source count;
- typed source claim must already be VERIFIED;
- duplicate typed-source representation;
- invalid pair source index.

Timeout copy no longer claims the transaction succeeded. It explicitly says
that the write may still be finalizing or may have been rejected, and instructs
the user to inspect the transaction before retrying.

### MEDIUM — localStorage scoped to contract
Workspace key now includes the deployed contract address.

### MEDIUM — fresh demo after successful create
A successful fresh claim automatically generates the next unique demo template.

### MEDIUM — exact source confirmation
External-source and verified-claim-source writes are confirmed by matching the
actual resulting source record rather than only checking `source_count`.

### MEDIUM — live config
Overview now renders selected `get_config()` values directly from chain state:

- contract version;
- verification threshold;
- whether URLs enter consensus;
- public-pair-judging flag;
- global-admin flag.

### LOW — stronger fresh-demo uniqueness
Demo ids combine time with `crypto.getRandomValues`.

### LOW — repeated pair wording
Already-judged pairs are explicitly described as already judged instead of
making the user think a new verdict was created.

## Intentionally unchanged

- Same-origin `/genlayer-rpc` reads.
- MetaMask writes.
- No browser transaction-receipt polling.
- Optional GenLayer Snap connection.
- Claim #1 remains read-only in normal UI.
- Harbor Rail demo semantic path.
- Contract source.

## MUST-VERIFY before public deployment

Confirm against:

```text
0x09324215eEC452600F72Eb1D63ee6Bb48E92740f
```

Expected:

```text
get_config().version == "1.1"
get_config().required_distinct_independent_sources == 3
```

Local included contract source SHA-256:

```text
337ecb69222e61b7b693621bd7f6d2a84189ed480c6d42b9645fedd3e2273374
```

The exact deployed source hash should be confirmed before Vercel/community
publication.

## Local validation status

A syntax/transpile check was run on the modified TS/TSX files and passed.

A full `npm install` in the ChatGPT container timed out, so this v2 package is
NOT yet marked as locally built/runtime PASS. Run the normal local commands on
the development machine:

```bash
npm install
npm test
npm run build
npm run dev
```


## Final live-deployment fixes

After switching the project to the final contract address `0x09324215eEC452600F72Eb1D63ee6Bb48E92740f`, two
deployment-specific frontend issues were corrected:

1. `src/config.ts` now validates `VITE_CONTRACT_ADDRESS` and falls back to the
   final address when the environment value is blank or malformed.
2. `src/App.tsx` now handles a fresh deployment with `claim_count = 0` without
   calling `get_claim(1)`. The UI shows an empty registry and allows the first
   claim to be created.

The final live dApp subsequently created and verified Claim #1, which is now the
read-only public sample.
