# SourceGate v2.0 — Testing Guide

## Exact path

Use three roles when possible:

```text
Wallet A = Author
Wallet B = immutable Reviewer (must differ from Author)
Wallet C = public pair judge / outsider
```

Connect the wallet **before** any write action. The frontend verifies contract postconditions after each write; a submitted or finalized transaction alone is not counted as success.

## 1. Confirm deployment

Open the app and check:

```text
contract = 0x0F011a04951320e194eB6EF279F3978e59A95350
version = 2.0
```

Explorer:

```text
https://explorer-studio.genlayer.com/address/0x0F011a04951320e194eB6EF279F3978e59A95350
```

`get_config()` must expose the v2 rules, including:

```text
reviewer_required = true
complete_active_pair_matrix_required = true
derivative_active_pair_blocks_typed_reuse = true
unjudged_active_pair_blocks_typed_reuse = true
typed_reuse_requires_frozen_basis = true
min_active_sources_for_reuse = 3
max_fresh_semantic_evals_per_claim = 66
urls_fetched = false
```

## 2. Author creates claim

Connect **Wallet A**.

Create a claim with **Wallet B** as reviewer and three external source bundles. Each bundle needs:

```text
excerpt
origin label
reference locator / URL
evidence digest = non-zero SHA-256, 64 hex characters
```

Expected post-state:

```text
source_count = 3
active_source_count = 3
attested_active_source_count = 0
active_pair_target = 3
judged_active_pairs = 0
unjudged_active_pairs = 3
reuse_ready = false
basis_frozen = false
```

Every source starts:

```text
provenance_state = PROPOSED
active = true
```

## 3. Pair judging before attestation must fail

Connect **Wallet C** and try to judge any pair such as S1 ↔ S2 before reviewer attestation.

Expected:

```text
execution rejected
pair_count unchanged
semantic_eval_count unchanged
```

Do not infer this only from transaction finalization; refresh the claim and verify the counters.

## 4. Reviewer attests exact bindings

Connect **Wallet B**.

For S1, S2, and S3, click **Attest Exact Binding**. The UI submits the exact `binding_hash` already returned by the contract.

Expected for each source:

```text
provenance_state = ATTESTED
active = true
attested_by = Wallet B
```

After all three:

```text
attested_active_source_count = 3
unjudged_active_pairs = 3
reuse_ready = false
```

This proves attestation alone is insufficient.

## 5. Unjudged pair blocks reuse

Connect any wallet and judge only two of the three active pairs.

Example:

```text
S1 ↔ S2
S1 ↔ S3
```

If both are independent, expected state still includes:

```text
judged_active_pairs = 2
unjudged_active_pairs = 1
reuse_ready = false
```

Author freeze must remain unavailable/rejected.

## 6A. Independent complete matrix path

For a clean claim whose semantic evidence is genuinely independent, judge the third pair:

```text
S2 ↔ S3
```

Expected only if all three pair verdicts are `INDEPENDENT_CORROBORATION`:

```text
judged_active_pairs = 3
independent_active_pairs = 3
derivative_active_pairs = 0
unjudged_active_pairs = 0
reuse_ready = true
```

Connect **Wallet A** and click **Freeze Reuse Basis**.

Expected post-state:

```text
basis_frozen = true
reuse_ready = true
basis_digest = non-empty
frozen_active_source_count = 3
frozen_pair_count = 3
```

After freeze, add/revoke/judge mutation paths must be rejected.

## 6B. Derivative pair blocks reuse

On a separate claim, use at least one clearly derivative/common-origin pair or reuse the same evidence digest for two distinct source registrations.

When any active pair resolves to `DERIVATIVE_SOURCE_CLUSTER`, expected:

```text
derivative_active_pairs >= 1
reuse_ready = false
```

For identical evidence digests, the derivative verdict is deterministic and should not consume a fresh semantic evaluation for that pair.

Author freeze must remain rejected.

## 7. Reviewer revocation recovery

Before freeze, **Wallet B** may revoke an attested source.

Expected source state:

```text
provenance_state = REVOKED
active = false
```

The active pair target and readiness must recompute from the remaining active basis. Historical pair/source records remain readable.

## 8. Typed reuse requires frozen upstream basis

Create a downstream claim as **Wallet A**.

Attempt to add another claim before its upstream basis is frozen.

Expected:

```text
write rejected
source_count unchanged
```

Then add a claim that is both `REUSE_READY` and frozen.

Expected new source:

```text
kind = TYPED_CLAIM
from_claim_id = upstream claim id
provenance_state = PROPOSED
```

The downstream reviewer must still attest this typed source before it can participate in downstream pair judging.

## 9. Replay protection

Judge one pair once, then retry both:

```text
same order:    S1 ↔ S2
reverse order: S2 ↔ S1
```

Expected for both retries:

```text
write rejected
pair_count unchanged
semantic_eval_count unchanged
```

## 10. Production frontend smoke test

After Vercel deployment:

1. page loads without console/runtime error;
2. deployment card shows v2.0 and the fresh contract address;
3. Explorer link opens the same deployment;
4. load an existing claim and verify source/basis metrics match Explorer/Studio reads;
5. connect MetaMask and verify role label changes correctly for Author, Reviewer, and Public wallet;
6. perform at least one reviewer attestation or public pair judgment and confirm the UI waits for the contract postcondition rather than treating submission/finalization as success.
