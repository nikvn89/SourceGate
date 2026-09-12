# SourceGate v2.1 — Strict Testing Guide

## Phase A — PREDEPLOY gates

Do not deploy until all of these pass against the exact candidate source:

```bash
python scripts/check_contract_ast.py
python scripts/test_contract_logic.py
python scripts/fence_probe.py
python scripts/mutation_matrix.py
npm run verify
pytest tests/direct/ -q
```

`pytest tests/direct/ -q` is the real GenVM Direct Mode gate. Static checks are not a substitute.

After all 27 Direct Mode tests pass, compute and freeze the exact `contracts/SourceGate.py` SHA-256. Any later contract byte change invalidates the result.

## Phase B — fresh deployment

Runtime contract: `0x90F760d90642325777a97Fb9640c5E3fB0d8c2A6`

Deploy the exact frozen v2.1 source to a **new StudioNet address**. Do not reuse any v2.0 address or v2.0 screenshots as v2.1 evidence.

Immediately verify `get_config()`:

```text
version = 2.1
reviewer_required = true
complete_active_pair_matrix_required = true
first_judgment_seals_active_basis = true
source_mutation_after_adjudication_blocked = true
freeze_rechecks_sealed_basis_digest = true
derivative_active_pair_blocks_typed_reuse = true
historical_derivative_blocks_freeze = true
judged_source_revocation_blocked = true
unjudged_active_pair_blocks_typed_reuse = true
typed_reuse_requires_frozen_basis = true
min_active_sources_for_reuse = 3
max_fresh_semantic_evals_per_claim = 66
urls_fetched = false
```

## Phase C — wallets

Use three distinct runtime roles:

```text
Wallet A = Author
Wallet B = immutable Reviewer address
Wallet C = Public/outsider pair judge
```

Connect wallet before each write. Record full wallet address in the runtime evidence table.

## Phase D — critical on-chain refusal transactions

The point of this phase is to prove the **contract**, not the UI, refuses invalid actions. The v2.1 UI intentionally allows these safe attempts.

For every row record full Explorer tx hash, caller, method, expected result, observed execution result, and exact post-state.

### D1. Wrong-wallet add source

Load an unfrozen claim with Wallet C and submit `add_external_source()` using valid source arguments.

Expected:

```text
contract refusal: only Author may add sources
source_count unchanged
```

### D2. Wrong-wallet attestation

With Wallet A or C, submit `attest_source()` for an exact stored binding.

Expected:

```text
contract refusal: only immutable Reviewer may attest
provenance_state unchanged
```

### D3. Judge before attestation

With Wallet C, submit `judge_pair()` while either source is still `PROPOSED`.

Expected:

```text
contract refusal
pair_count unchanged
semantic_eval_count unchanged
```

### D4. Freeze before gate

With Wallet A, call `freeze_reuse_basis()` before the complete all-independent matrix exists.

Expected:

```text
contract refusal
basis_frozen = false
basis_digest empty
```

Keep this exact claim for the causal success half later.

## Phase E — positive complete matrix path

1. Wallet B attests all three exact source bindings.
2. Wallet C submits the first pair judgment. This successful transaction must also seal the full active source basis:

```text
adjudication_started = true
adjudication_basis_digest = 64 hex
```

3. Immediately attempt `add_external_source()` and `revoke_source()` on an unjudged third source. Both must be refused because adaptive source-set mutation after the first verdict is forbidden.

4. Judge one more pair so only one remains unjudged.
5. Confirm:

```text
2/3 judged
1 unjudged
reuse_ready = false
```

4. Judge the third pair using actual StudioNet consensus.
5. Only if all three are `INDEPENDENT_CORROBORATION`, verify:

```text
3/3 judged
3 independent
0 derivative
0 unjudged
derivative_history_blocked = false
reuse_ready = true
```

8. With the same Wallet A, call the **same** `freeze_reuse_basis()` method used in D4.

Expected:

```text
same call now succeeds
basis_frozen = true
basis_digest = 64 hex
frozen_active_source_count = 3
frozen_pair_count = 3
```

This refused-before / succeeds-after pair is the causal proof that the semantic gate controls the consequence.

## Phase F — non-bypassable derivative path

Use a separate fresh claim and actual StudioNet semantic consensus. Prefer the blind natural common-origin case from `BLIND_RUNTIME_PROTOCOL.md`; do not use same evidence digest for this semantic proof.

When any pair returns `DERIVATIVE_SOURCE_CLUSTER`, verify:

```text
derivative_history_blocked = true
reuse_ready = false
adjudication_started = true
adjudication basis remains sealed
both judged sources expose judgment_locked = true
```

Then, **after seeing the losing verdict**, attempt with Wallet B:

```text
revoke_source(losing_source)
add_external_source(new_source_after_verdict)
```

Expected:

```text
contract refusal: adjudication basis is sealed / judged source is locked
source remains active
new source is not appended
pair remains historical and active
```

Then attempt with Wallet A:

```text
freeze_reuse_basis()
```

Expected:

```text
contract refusal: permanent derivative-history block
basis_frozen = false
```

This is the key v2.1 non-bypassability proof.

## Phase G — replay/reroll proof

For a judged pair, submit both:

```text
same order    S1 ↔ S2
reverse order S2 ↔ S1
```

Expected for each:

```text
contract refusal
pair_count unchanged
semantic_eval_count unchanged
original verdict unchanged
```

## Phase H — typed reuse causal proof

Create an upstream claim that reaches all-independent `REUSE_READY` but is not yet frozen. Create a downstream claim.

Call:

```text
add_reuse_claim_source(downstream, upstream)
```

before upstream freeze.

Expected:

```text
refused
source_count unchanged
upstream reuse_count unchanged
```

Freeze upstream and repeat the **same typed-reuse call**.

Expected:

```text
succeeds
new source kind = TYPED_CLAIM
from_claim_id = exact upstream id
evidence_digest = upstream basis_digest
provenance_state = PROPOSED
upstream reuse_count += 1
```

Wallet B must then attest this downstream typed source before it can be judged.

## Phase I — immutable freeze refusal matrix

After freeze, submit these transactions rather than relying only on disabled UI:

```text
add_external_source()
add_reuse_claim_source()
revoke_source()
judge_pair()
```

Expected: each is refused and all frozen basis post-state remains unchanged.

## Phase J — blind natural semantic run

Follow `BLIND_RUNTIME_PROTOCOL.md` exactly. Runtime semantic texts must be generated after v2.1 source freeze/deployment and must not be copied from Direct Mode fixtures, README examples, old SourceGate snapshots, or prompt examples.

Required evidence:

```text
blind vector file SHA-256 committed before first judgment
actual source texts + provenance metadata after completion
full pair verdicts from actual StudioNet consensus
full transaction hashes
exact post-state after every consequence
```

## Phase K — frontend/Vercel

Only after contract runtime proof passes:

1. confirm `src/config.ts` is pinned to `0x90F760d90642325777a97Fb9640c5E3fB0d8c2A6`;
2. keep exact frozen source SHA;
3. run `npm run check`;
4. deploy Vercel;
5. load existing claims and verify full pair history;
6. verify Author/Reviewer/Public role labels;
7. submit at least one expected-refusal call and one successful call from production UI;
8. verify exact postconditions;
9. capture fresh v2.1 screenshots in `snap/`;
10. regenerate final checksums.
