# SourceGate — Runtime and Release Testing

## Frozen release identity

```text
Project: SourceGate
Intelligent Contract implementation: SourceIndependenceGate
Public contract filename: contracts/SourceGate.py
Frozen SHA256: ead0b54660d1ba82b3ffd6cf02a54da5ce89d898226da1b8b30cb2f60429208f
```

Clean project deployment:

```text
0xb325DDa519E2D5BE1Ca8Fa24A1A1DE849113D48a
```

Runtime evidence deployment:

```text
0x5E7BA4f9D9B306DaDb2a56A3FCCb747960ac4f6b
```

The clean deployment and runtime-evidence deployment are intentionally separate.
Do not reproduce runtime tests on the clean project address.

## Runtime profile

`get_config()` on the runtime deployment returned the frozen R2 profile,
including:

```text
name = SourceIndependenceGate
version = 1.2
required_independent_pairs = 2
required_distinct_independent_sources = 3
public_pair_judging = true
sources_append_only_after_verification = true
urls_enter_consensus_prompt = false
global_admin = false
clock_used = false
```

## Reproducible runtime sequence

### 1. Create Claim #1 with three sources

Claim:

```text
Factory Y stopped production line 3 in June.
```

Sources:

```text
S1  Factory notice: production line 3 was suspended beginning June 2.
S2  Report citing that factory notice: line 3 stopped operating in early June.
S3  Safety-inspection record: line 3 did not receive operational clearance during the June inspection cycle.
```

Baseline post-state:

```text
source_count = 3
pair_count = 0
independent_pairs = 0
derivative_pairs = 0
verified = false
```

### 2. Semantic verdict paths

Judge `S1 + S2`:

```text
DERIVATIVE_SOURCE_CLUSTER
```

Post-state:

```text
pair_count = 1
derivative_pairs = 1
independent_pairs = 0
verified = false
```

Judge `S1 + S3`:

```text
INDEPENDENT_CORROBORATION
```

Post-state includes:

```text
pair_count = 2
independent_pairs = 1
verified = false
```

Judge the same `S1 + S3` pair again. The pair is not semantically rerolled and
aggregate counters do not increase.

Judge `S2 + S3`. The resulting positive coverage reaches the deterministic
threshold:

```text
pair_count = 3
independent_pairs = 2
derivative_pairs = 1
distinct_independent_sources = 3
verified = true
```

### 3. Unverified typed-reuse consequence

Create Claim #2, left unverified:

```text
Warehouse Z changed its overnight access procedure in July.
```

Create Claim #3 as a downstream target. Its baseline was:

```text
source_count = 1
verified = false
```

Call:

```text
add_verified_claim_source(3, 2)
```

Observed execution:

```text
Consensus status: ACCEPTED
Execution result: ERROR
Rollback reason: Source claim must be VERIFIED before reuse
```

Postcondition:

```text
get_claim(3).source_count = 1
```

This is explicit evidence that accepted/finalized consensus is not interpreted
as successful execution.

### 4. Exact-copy unverified bypass

Attempt to add the exact Claim #2 text to Claim #3 through
`add_external_source`.

Observed execution:

```text
Consensus status: ACCEPTED
Execution result: ERROR
Rollback reason: Source text matches an unverified claim; verify it first
```

Postcondition:

```text
get_claim(3).source_count = 1
```

### 5. Verified typed reuse and lineage

Call:

```text
add_verified_claim_source(3, 1)
```

Post-state:

```text
get_claim(3).source_count = 2
```

`get_source(3, 2)` returned a source whose committed excerpt equals Claim #1 text
and whose provenance field is:

```text
from_claim_id = 1
origin_label = Verified claim #1
```

### 6. Prompt-injection containment and permanent pair record

Create Claim #4 with two excerpts, one containing an instruction-like string
asking the model to ignore prior instructions and return non-JSON output.

Call:

```text
judge_pair(4, 1, 2)
```

Observed transaction:

```text
Result = SUCCESS
Structured verdict = INDEPENDENT_CORROBORATION
```

The injected text did not replace the required semantic output shape.

Post-state:

```text
source_count = 2
pair_count = 1
independent_pairs = 1
derivative_pairs = 0
distinct_independent_sources = 2
verified = false
```

Replaying `judge_pair(4, 1, 2)` did not create another pair or increment counters.
Calling the reverse order `judge_pair(4, 2, 1)` resolved to the same permanent
pair record and verdict.

### 7. One-way VERIFIED latch

After Claim #1 had already become `VERIFIED`, append a fourth source and judge a
new derivative pair.

Observed final Claim #1 state:

```text
source_count = 4
pair_count = 4
independent_pairs = 2
derivative_pairs = 2
distinct_independent_sources = 3
verified = true
```

The later derivative evidence does not revert the already reached deterministic
VERIFIED latch.

## Failure-path scope

The frozen source validates the semantic response shape and allowed verdict enum
before pair/cache/counter writes. Provider exceptions and non-convergence do not
become semantic success. The production runtime sequence above did **not** force
an artificial provider outage or malformed provider response, so this document
does not label those cases as runtime-triggered evidence.

## Clean project deployment check

On the clean project address, verify only read state:

```text
get_config() matches version 1.2 profile
claim_count = 0
```

Do not create claims or judge pairs on the clean address solely for testing; its
purpose is to remain the public project baseline.

## Frontend release checks

The final frontend revision is designed around these acceptance conditions:

```text
frontend source is pinned to the clean project address
there is no hard-coded read-only Claim #1 sample
fresh claim creation confirms exact text + author post-state
source writes confirm exact resulting source records
pair judgment confirms get_pair_by_sources(...).judged
UI does not equate submitted/finalized status with execution success
runtime-evidence and frozen-source identifiers are visible in the live config panel
```

Release commands:

```bash
npm ci
npm test
npm run build
```

After Vercel deployment, smoke-test:

```text
https://source-gate.vercel.app/
```

Expected public state before any real user writes:

```text
clean project address = 0xb325DDa519E2D5BE1Ca8Fa24A1A1DE849113D48a
claim_count = 0
no attempt to call get_claim(1)
first real Claim #1 remains writable by its author
runtime evidence link = 0x5E7BA4f9D9B306DaDb2a56A3FCCb747960ac4f6b
frozen SHA = ead0b54660d1ba82b3ffd6cf02a54da5ce89d898226da1b8b30cb2f60429208f
```
