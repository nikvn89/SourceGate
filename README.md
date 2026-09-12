# SourceGate v2.1 — FINAL RUNTIME

SourceGate is a GenLayer dApp for building a reviewer-attested provenance basis before a claim can be reused as a typed source downstream.

**Status:** FINAL RUNTIME PASS. Frozen v2.1 source, real GenVM Direct Mode 27/27 PASS, fresh StudioNet deployment, production Vercel runtime, exact transaction evidence, causal freeze proof, typed reuse, and a natural permanent derivative-history block are all recorded. Historical v2.0 deployments/screenshots are not valid proof for this source.

## What v2.1 fixes

v2.1 hardens the exact failure modes a strict reviewer can exploit:

1. **First-judgment basis seal** — the first successful semantic pair judgment atomically seals the entire active + attested source basis. After that, Author/Reviewer cannot append, attest, or revoke sources on that claim.
2. **Judged-source lock** — judged source participation remains explicitly queryable and cannot be erased.
3. **Permanent derivative-history block** — any `DERIVATIVE_SOURCE_CLUSTER` verdict permanently blocks `freeze_reuse_basis()` for that claim id. A losing semantic result cannot be erased after seeing it.
4. **Contract-refusal UX** — the frontend no longer hides critical negative paths behind role/eligibility disabled buttons. It can intentionally submit safe wrong-wallet/premature/frozen calls so the contract itself proves refusal.
5. **Full pair-history pagination** — the frontend loads all historical pair records, including histories beyond the 50-record page limit.
6. **Honest reviewer boundary** — wording now states exactly what is authenticated: control of the designated reviewer address and its attestation of an immutable binding, not real-world identity or truth.
7. **Atomic rollback coverage** — Direct Mode adds explicit rollback tests for partially-built claims and upstream typed-reuse counters.
8. **Causal same-call proof** — test/runtime plans require the same consequence call to fail before its gate and succeed after the exact gate is satisfied.
9. **Blind natural runtime protocol** — production semantic vectors must be created only after source freeze/deployment and must not be copied from fixtures/prompt examples.

## Four responsibilities

1. **Author registration** — an Author commits a claim, a distinct immutable Reviewer address, and immutable source bundles.
2. **Reviewer attestation** — only the designated Reviewer address may attest the exact on-chain `binding_hash`.
3. **Semantic provenance independence** — GenLayer consensus judges one exact active + attested pair as `INDEPENDENT_CORROBORATION` or `DERIVATIVE_SOURCE_CLUSTER`.
4. **Deterministic typed reuse** — reuse is allowed only after the complete active pair matrix is independent, no historical derivative block exists, and the Author freezes the basis.

## v2.1 non-bypassable negative consequence

For a claim id:

```text
DERIVATIVE_SOURCE_CLUSTER
        ↓
first successful judgment
        ↓
adjudication_started = true
active source basis = SEALED
        ↓
DERIVATIVE_SOURCE_CLUSTER
        ↓
derivative_history_blocked = true   (permanent)
        ↓
append / attest / revoke = REFUSED
freeze_reuse_basis = REFUSED
        ↓
To try different evidence: create a NEW claim id
```

The losing claim remains auditable. Reviewer or Author cannot remove the losing source after seeing the verdict and recover `REUSE_READY` on the same claim id.

## Reuse rule

A claim can become `REUSE_READY` only while all of these are true:

- adjudication basis has been sealed by the first successful pair judgment;
- at least 3 active sources;
- every active source is Reviewer-attested;
- every active pair has been judged;
- every active pair is `INDEPENDENT_CORROBORATION`;
- zero derivative active pairs;
- zero unjudged active pairs;
- `derivative_history_blocked = false`.

The Author must then call `freeze_reuse_basis()`. Freeze records a deterministic `basis_digest` and makes the basis immutable.

## Honest provenance boundary

The contract binds:

```text
source kind
from_claim_id
a hash of the excerpt
a hash of the origin label
a hash of the reference locator
evidence digest
```

The contract proves that the **designated Reviewer address** attested that exact immutable binding. It does **not** prove the reviewer's real-world identity, independence, reputation, qualification, or honesty. It does not fetch URLs or prove external truth.

## Frozen runtime identity

```text
Project            SourceGate
Contract class     SourceIndependenceGate
Contract version   2.1
StudioNet address  0x90F760d90642325777a97Fb9640c5E3fB0d8c2A6
```

Frozen SHA-256 is recorded in `SOURCE_SHA256.txt`. The frontend is pinned to the fresh v2.1 StudioNet deployment above.

## Direct Mode proof gate

Requires Python 3.12+ and the pinned test dependency:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
pytest tests/direct/ -q
```

The v2.1 suite defines 27 load-bearing Direct Mode tests, including:

- unjudged matrix blocks reuse;
- derivative matrix blocks reuse;
- judged source cannot be revoked;
- derivative-history claim cannot freeze;
- exact/reverse replay cannot reroll;
- malformed semantic output writes nothing;
- typed reuse requires frozen upstream basis;
- frozen basis mutation refuses;
- `create_claim()` partial-state rollback;
- upstream `reuse_count` rollback;
- same `freeze_reuse_basis()` call refused-before / succeeds-after;
- same typed-reuse call refused-before / succeeds-after.

## Local deterministic gates

```bash
python scripts/check_contract_ast.py
python scripts/test_contract_logic.py
python scripts/fence_probe.py
python scripts/mutation_matrix.py
npm run verify
```

Current local targets:

```text
AST/POLICY        32/32
CORE LOGIC        29/29
PROMPT FENCE      0/22 bypasses
MUTATION MATRIX   28/28 caught
```

`npm run verify` also checks source SHA/config parity, v2.1 version pin, stale v1/v2 evidence, critical refusal-path UI behavior, Direct Mode test presence, fresh runtime snapshot presence, runtime evidence status, final manifest integrity, and obvious secret leakage.

## Frontend transaction rule

The UI never treats `SUBMITTED`, `ACCEPTED`, or `FINALIZED` as proof of execution success. Each write polls an exact contract postcondition.

For critical safe negative paths, the UI may warn that refusal is expected but still sends the transaction so the contract—not the frontend—proves the rule. Examples include wrong-wallet writes, judge-before-attestation, freeze-before-ready, revoke-after-judgment, and mutation-after-freeze.

## Natural semantic runtime requirement

Direct Mode mocks are used only to pin deterministic consequences. Production semantic proof must use actual StudioNet consensus with a blind runtime set created **after** the source is frozen and deployed. See `BLIND_RUNTIME_PROTOCOL.md`.


## Final runtime evidence

See [`RUNTIME_EVIDENCE.md`](RUNTIME_EVIDENCE.md) for the exact Vercel + MetaMask + StudioNet transaction table and [`snap/`](snap/) for fresh v2.1 screenshots.

Final load-bearing runtime outcomes:

```text
Real GenVM Direct Mode                         27/27 PASS
Wrong-role attestation                         REFUSED
Judge before Reviewer attestation              REFUSED / no state write
First semantic judgment seals active basis     PASS
Reviewer revoke after seal                      REFUSED / no state write
Author append after seal                        REFUSED / no state write
2 positive + 1 unjudged                         BLOCKED
Complete all-independent matrix                 REUSE_READY
Same freeze call before / after gate            REFUSED → SUCCESS
Frozen basis mutation                           REFUSED
Typed reuse lineage + upstream reuse_count      PASS
Downstream typed-source Reviewer attestation    PASS
Natural DERIVATIVE_SOURCE_CLUSTER               PASS
Permanent derivative-history freeze block       PASS
```

The runtime uses actual StudioNet semantic consensus. Direct Mode mocks pin deterministic consequence rules; they are not presented as production semantic proof.

## Repository layout

```text
contracts/SourceGate.py       frozen v2.1 contract
src/                          React/Vite client
scripts/                      deterministic + release integrity gates
tests/direct/                 real GenVM Direct Mode suite
LOCKED_SPEC.md                load-bearing behavioral invariants
BUILD_RULES.md                strict reviewer build rules
BLIND_RUNTIME_PROTOCOL.md     unseen/natural runtime protocol
TESTING.md                    exact predeploy + runtime path
snap/                         fresh v2.1 runtime screenshots only
```

## Source parity rule

Any contract byte change requires:

```text
new SHA
→ rerun all local checks
→ real GenVM Direct Mode PASS
→ freeze source
→ fresh StudioNet deployment
→ fresh negative + positive runtime transaction evidence
→ blind natural semantic runtime
→ patch frontend address
→ build + Vercel
→ production smoke test
→ final checksums
```

### Windows Direct Mode note

`tests/direct/conftest.py` includes a Windows-only compatibility shim for `genlayer-test 0.29.2` Direct Mode. It defers deletion of the temporary stdin message file until VM teardown, avoiding Windows `WinError 32`. The shim is test-only; contract bytes and StudioNet behavior are unchanged.
