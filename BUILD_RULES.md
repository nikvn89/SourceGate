# GenLayer Build Rules — Strict Reviewer Profile

These rules are mandatory for SourceGate v2.1 and future GenLayer builds unless a newer explicit rule supersedes them.

## 1. Runtime proof outranks static proof

- Compile/static/reviewer PASS is not runtime proof.
- Load-bearing semantic paths must run on real GenVM before deployment evidence is claimed.
- `SUBMITTED`, `ACCEPTED`, `FINALIZED`, and semantic/execution success are different states.
- Every frontend write must verify an exact postcondition; transaction status alone is never success evidence.

## 2. Consequences must be contract-enforced and hard to bypass

- Semantic output must have a deterministic on-chain consequence.
- Prefer terminal/atomic consequences over a dashboard boolean or advisory flag.
- When a consequence can leave the contract (payment, release, permission, typed reuse), check the semantic gate and apply the consequence in the same atomic transaction whenever possible.
- Audit every cancel, revoke, refund, timeout, withdraw, close, abandon, reset, reroll, and alternate path.
- A losing semantic result must not be erasable after the caller learns the verdict.
- When source-set composition itself affects the consequence, seal/commit the adjudication basis before or atomically with the first semantic judgment so participants cannot cherry-pick, append, or prune after seeing partial results.
- If a source/object has already participated in semantic adjudication, later cleanup must not remove that adjudication from consequence logic.

## 3. Prove causality with the same action before and after the gate

For each load-bearing consequence, record a pair such as:

```text
same_call() before semantic/precondition gate -> refused, state unchanged
same_call() after the exact gate is satisfied -> succeeds, exact post-state reached
```

This is stronger evidence than separate happy-path screenshots.

## 4. UI must not substitute for contract authorization

- For safe negative-path testing, the UI should allow a user to submit calls that the contract is expected to refuse.
- The UI may warn `expected contract refusal`, but should not hide all invalid calls behind disabled buttons when those refusals are important security evidence.
- Wrong-wallet, premature, replay, and frozen-state attempts should be provable on-chain.

## 5. Transaction evidence must be exact

For every critical runtime transaction record:

- full transaction hash / Explorer link;
- caller wallet and role;
- method + key arguments;
- expected contract outcome;
- observed execution outcome;
- exact post-state / counter / digest.

For native transfers additionally prove every outbound transfer, exact amount, balance delta, terminal state, and rollback path. Never infer transfer success from `FINALIZED` alone.

## 6. Natural semantic testing is separate from deterministic mocks

- Direct Mode may mock semantic verdicts to test deterministic consequences.
- Production semantic proof must use actual GenLayer consensus.
- At least one blind runtime set must be created after the source is frozen and must not be copied from contract examples, README examples, Direct Mode fixtures, or prompt wording.
- Blind inputs must avoid verdict labels or obvious trigger phrases designed to force a pass.
- Include naturally independent, naturally derivative/common-origin, and ambiguous cases where applicable.
- Do not hardcode business-specific templates in the contract to make known transactions pass.

## 7. Semantic scope stays narrow and fail-closed

- The validator answers one bounded semantic question only.
- Deterministic code chooses state transitions, authorization, settlement, and consequences.
- Invalid/malformed/non-convergent semantic output writes no consequential state.
- Ambiguity must fail closed in the safer direction.

## 8. Anti-reroll and immutable baseline

- Exact/reversed semantic object replay cannot buy another model roll.
- Historical accepted/rejected verdicts remain auditable.
- Compare against immutable original/bound data, not only mutable intermediate state.
- New evidence after a terminal negative result should require a new object/claim when allowing retries would erase the original consequence.

## 9. Honest authentication and oracle boundaries

- A wallet signature proves control of that address, not real-world identity, independence, reputation, qualification, or truth.
- Evidence digests bind bytes/metadata; they do not prove external content exists unless the contract actually authenticates/fetches it.
- README/UI must state these boundaries precisely and avoid overclaiming.

## 10. Locked spec, mutation checks, source parity, and release gate

- Keep a `LOCKED_SPEC.md` of load-bearing invariants.
- Each load-bearing guard should have behavioral tests and, where practical, a mutation guard.
- Freeze exact contract bytes only after Direct Mode PASS and record SHA-256.
- Deployed source, repo source, config, docs, and evidence must have exact source parity.
- A release verification command must check SHA/version/config parity, stale deployment references, test presence, snapshots/evidence state, secrets, and generated junk.

## 11. Evidence belongs to the exact version

- Never reuse screenshots, tx hashes, or runtime addresses from a previous contract version as proof for a modified contract.
- PREDEPLOY packages must mark runtime evidence as pending.
- After any contract byte changes: new SHA -> Direct Mode -> fresh deployment -> fresh runtime evidence -> frontend update -> final package.
