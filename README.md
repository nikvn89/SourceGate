# SourceGate v2.0

SourceGate is a GenLayer dApp for building an authenticated provenance basis before a claim can be reused as a typed source downstream.

The v2 contract separates four responsibilities:

1. **Author registration** — an author commits a claim, a distinct immutable reviewer, and immutable source bundles.
2. **Reviewer provenance attestation** — only the reviewer may attest the exact on-chain `binding_hash` after checking provenance off-chain.
3. **Semantic independence adjudication** — GenLayer consensus judges one exact active + attested source pair as `INDEPENDENT_CORROBORATION` or `DERIVATIVE_SOURCE_CLUSTER`.
4. **Deterministic typed-reuse authorization** — reuse is allowed only after the complete active pair matrix is independent and the author freezes the basis.

## Production contract identity

```text
Project                 SourceGate
Contract class          SourceIndependenceGate
Contract version        2.0
StudioNet deployment    0x0F011a04951320e194eB6EF279F3978e59A95350
Frozen source SHA-256   170d99a167efa304541be55c347d5284fa1fc8eb79252d12384db05a40b56606
```

Explorer:

```text
https://explorer-studio.genlayer.com/address/0x0F011a04951320e194eB6EF279F3978e59A95350
```

The frontend is pinned to this v2 deployment in `src/config.ts`.

## Reuse rule

A claim is `REUSE_READY` only while all of these are true:

- at least 3 active sources;
- every active source is reviewer-attested;
- every pair in the active source set has been judged;
- every active pair is `INDEPENDENT_CORROBORATION`;
- zero derivative active pairs;
- zero unjudged active pairs.

`REUSE_READY` is recomputed before freeze. Adding a source or revoking an attested source changes the active basis and can make readiness false again.

The author must then call `freeze_reuse_basis()` before another claim can use the typed reuse path. Freeze locks the reusable basis and records its deterministic `basis_digest`.

## Honest provenance boundary

The contract binds source metadata and a non-zero 32-byte evidence digest. It does **not** fetch URLs, prove that an external artifact exists, establish external truth, or decide source reputation.

The distinct reviewer is the authenticated off-chain provenance-verification boundary. Reviewer attestation signs the exact immutable `binding_hash` stored for that source.

## Deterministic protections

- reviewer must differ from author;
- only reviewer may attest or revoke provenance;
- only active + attested sources may enter pair judging;
- exact and reversed pair replay share one normalized pair and replay reverts;
- same evidence digest is deterministically derivative without spending a semantic evaluation;
- one derivative pair blocks typed reuse;
- one unjudged active pair blocks typed reuse;
- fresh semantic evaluations are capped at 66 per claim;
- malformed/non-convergent semantic output cannot create a pair record;
- typed reuse preserves explicit `from_claim_id` lineage;
- typed reuse requires the upstream claim to be both `REUSE_READY` and frozen;
- frozen basis rejects append, revoke, and pair mutation.

## Frontend behavior

The React/Vite UI mirrors the v2 contract roles and postconditions:

- claim creation requires a distinct reviewer address and evidence digests;
- source cards expose `binding_hash`, evidence digest, provenance state, and typed lineage;
- reviewer-only attestation submits the exact stored binding hash;
- reviewer-only revocation removes a source from the active basis while preserving history;
- pair matrix shows every active source combination and whether it is unjudged, independent, or derivative;
- freeze is enabled only for the author when the contract reports `reuse_ready = true`;
- every write is followed by a contract read and required postcondition check; transaction submission/finalization alone is not treated as execution success.

## Direct Mode proof

Real GenVM Direct Mode was executed against the frozen v2 source with:

```text
Python          3.12.14
genlayer-test   0.29.2
GenVM SDK       v0.2.12
Result          20 passed
```

The Direct Mode suite is in `tests/direct/` and covers derivative, unjudged, full independent matrix, attestation, revocation, replay, malformed semantic output, typed reuse, and frozen-basis mutation paths.

`tests/direct/conftest.py` pins `sdk_version='v0.2.12'` because `genlayer-test 0.29.2` otherwise follows the latest GenVM release while its legacy Direct Mode loader expects the older `genvm-universal.tar.xz` asset name.

## Local frontend

```bash
npm install
npm run test
npm run build
npm run dev
```

Open the local Vite URL, connect MetaMask, and switch to GenLayer StudioNet when prompted.

## Contract tests

Requires Python 3.12+:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
pytest tests/direct/ -q
```

Expected:

```text
20 passed
```

## Repository layout

```text
contracts/SourceGate.py       frozen SourceIndependenceGate v2 source
src/                          SourceGate web client
public/                       project assets
scripts/                      deterministic contract audit scripts
tests/direct/                 GenVM Direct Mode runtime suite
tests/errors.test.mjs         frontend error-normalization tests
requirements.txt              Direct Mode Python dependency pin
TESTING.md                    exact reviewer-facing test path
vercel.json                   StudioNet RPC rewrite for production
```

## Source parity rule

Do not modify `contracts/SourceGate.py` without computing a new SHA-256 and rerunning the complete Direct Mode and StudioNet runtime proof. UI/docs changes must remain behaviorally consistent with the frozen v2 contract.
