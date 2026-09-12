# SourceGate v2.1 — Locked Behavioral Specification

The following properties are load-bearing. Any weakening requires explicit review, a new source SHA, full Direct Mode rerun, fresh deployment, and fresh runtime evidence.

## Identity and attestation

1. Claim Author and immutable Reviewer addresses must differ.
2. Reviewer address cannot be zero.
3. External and typed sources start `PROPOSED` and cannot enter semantic pair judging until reviewer-attested.
4. Attestation must submit the exact stored immutable `binding_hash`.
5. The contract proves address-level attestation only; it does not prove reviewer real-world identity, independence, reputation, qualification, or external truth.

## Source history, basis sealing, and revocation

6. Source records are append-only; revocation never deletes history.
7. Before adjudication starts, Reviewer may revoke an active `PROPOSED` or `ATTESTED` source.
8. The first successful pair judgment requires at least 3 active sources and every active source already Reviewer-attested.
9. That first successful judgment atomically sets `adjudication_started = true`.
10. The same transaction records an immutable `adjudication_basis_digest` for the entire active source set.
11. After `adjudication_started = true`, external-source append, typed-source addition, attestation, and revocation must all revert.
12. Therefore the source basis cannot be adaptively expanded, pruned, or cherry-picked after any semantic result is learned.
13. Once a source participates in one pair judgment, `judgment_locked = true` remains queryable and its pair history can never be removed.
14. Author and outsider cannot revoke reviewer-controlled provenance.

## Semantic adjudication

15. Only active + reviewer-attested sources may be judged.
16. Pair order is normalized; `(A,B)` and `(B,A)` are one semantic object.
17. Exact or reversed replay must revert and cannot increment semantic evaluation count.
18. Same evidence digest is deterministically `DERIVATIVE_SOURCE_CLUSTER` without a fresh semantic call.
19. Malformed/non-convergent semantic output creates no pair record and no semantic-eval increment.
20. If the first judgment transaction fails/reverts, the adjudication seal must roll back atomically as well.
21. Fresh semantic evaluations are bounded.

## Non-bypassable negative consequence

22. Any `DERIVATIVE_SOURCE_CLUSTER` verdict sets `derivative_history_blocked = true` permanently for that claim id.
23. `derivative_history_blocked` can never be cleared by role action, later verdicts, or any source-set mutation path.
24. A derivative-history-blocked claim can never `freeze_reuse_basis()`.
25. To try a materially different basis after a derivative verdict, the Author must create a new claim id; the losing claim remains auditable.

## Complete matrix and freeze

26. `REUSE_READY` requires an already sealed adjudication basis.
27. `REUSE_READY` requires at least 3 active sources.
28. Every active source must be reviewer-attested.
29. Every active pair must be judged.
30. Every active pair must be `INDEPENDENT_CORROBORATION`.
31. Any unjudged active pair blocks reuse.
32. Any derivative active pair blocks reuse.
33. Any historical derivative flag blocks reuse/freeze even if a future code path were to alter active metrics.
34. Only Author can freeze.
35. Freeze records a deterministic final basis digest and makes the basis immutable.
36. After freeze, add source, typed-source addition, attestation, revoke, and judge paths all revert.

## Typed reuse

37. Upstream typed reuse requires `REUSE_READY` and `basis_frozen = true`.
38. Typed source stores exact `from_claim_id` lineage and upstream final basis digest.
39. Typed source starts `PROPOSED` in the downstream claim and requires downstream Reviewer attestation.
40. Registered claim text cannot bypass typed lineage by entering as an anonymous external source.
41. Reuse count increments only on successful typed source creation.

## Transaction atomicity and frontend evidence

42. Any reverted `create_claim()` must roll back claim counter, claim-text index, sources, adjudication state, and any upstream `reuse_count` increment caused earlier in that same transaction.
43. Frontend success requires an exact finalized-state postcondition; critical safe negative-path calls must be allowed to reach the contract; production evidence must record full tx hashes, unchanged failure post-state, complete pair history, and at least one blind/natural semantic run not copied from fixtures or prompt examples.
