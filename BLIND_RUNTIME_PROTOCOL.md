# SourceGate v2.1 — Blind Natural Runtime Protocol

This protocol intentionally does **not** contain the final semantic test texts. The runtime vectors must be created only after the v2.1 source SHA is frozen and the fresh StudioNet deployment exists.

## Purpose

Prove that semantic outcomes are not passing because production inputs were copied from Direct Mode fixtures, README examples, or obvious trigger wording.

## Rules for generating runtime vectors

1. Choose a domain not used by `tests/direct/`, contract comments, README examples, or previous SourceGate runtime evidence.
2. Do not include the literal verdict labels `INDEPENDENT_CORROBORATION` or `DERIVATIVE_SOURCE_CLUSTER` in claim/source text.
3. Do not use equal evidence digests for the natural derivative case; that deterministic shortcut has a separate test.
4. Use normal prose and realistic provenance metadata.
5. Commit all source bundles on-chain before any pair is judged. Do not edit inputs after seeing verdicts.
6. Record a SHA-256 commitment of the complete blind vector file before the first pair judgment; keep it in runtime evidence.

## Required natural cases

### Case A — naturally independent provenance

Use three sources whose informational origins are materially distinct. Run actual GenLayer consensus for all three pairs. Do not require a predetermined success; record actual verdicts. `REUSE_READY` is allowed only if the full matrix is actually independent.

### Case B — naturally common-origin / derivative

Use at least two differently worded sources that actually rely on one upstream artifact, but give them different evidence digests. The semantic model must decide the relationship; do not use the same-digest deterministic shortcut.

If any pair is derivative:

```text
derivative_history_blocked = true
judged sources = judgment-locked
reviewer revoke attempt = refused
freeze_reuse_basis = refused
```

### Case C — ambiguity / insufficient provenance

Use plausible but insufficient provenance metadata. Because ambiguity is fail-closed, record the actual consensus result and verify that a non-independent outcome cannot be converted into reuse by role actions.

## Causal transaction pairs to record

Use the same method before and after its gate:

```text
freeze_reuse_basis() before complete independent matrix -> refused
freeze_reuse_basis() after complete independent matrix -> succeeds

add_reuse_claim_source(upstream) before upstream freeze -> refused
add_reuse_claim_source(upstream) after upstream freeze -> succeeds
```

Also record:

```text
wrong-wallet add source -> refused
wrong-wallet attest -> refused
judge before attestation -> refused
revoke judged source -> refused
append/revoke/judge after freeze -> refused
same/reverse pair replay -> refused
```

For every transaction capture full Explorer hash, caller, method, expected outcome, observed outcome, and exact post-state.
