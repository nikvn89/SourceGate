# SourceGate v2.1 — Runtime Evidence

**Status: FINAL RUNTIME PASS**

This document records the load-bearing v2.1 runtime proof executed through the production Vercel UI with real MetaMask wallets and real StudioNet transactions. Static/Direct Mode evidence is included separately in `snap/00-*` and `snap/01-*`.

## Frozen runtime identity

```text
Contract       0x90F760d90642325777a97Fb9640c5E3fB0d8c2A6
Contract SHA   57cbff81d6ac9de6bb1157c6c3bf6c510c53c93852d1dc29f7f054ba0096f303
Version        2.1
Network        StudioNet (chain id 61999)
```

## Runtime wallets

- Wallet A / Author: `0x6276095FAEA15108740445ff277fdA8c304657F4`
- Wallet B / immutable Reviewer: `0x146e44881d35814bA582D265AF5b97ef2695ec8e`
- Wallet C / Public pair judge: `0x037f58E33c1Ec8fdA272361E0aAC1e31054a1CDE`

## What the runtime proves

- Wrong-role writes can be submitted from the production UI and are refused by contract/state postconditions rather than hidden only by UI policy.
- The first successful semantic judgment seals the entire active + Reviewer-attested basis, preventing adaptive source-set mutation after seeing a verdict.
- Two positive pair verdicts plus one unjudged pair still block reuse.
- The same `freeze_reuse_basis()` call is refused before the complete matrix and succeeds after the complete all-independent matrix, providing causal gate proof.
- Frozen bases reject later mutation.
- Typed reuse preserves explicit upstream lineage, increments upstream `reuse_count`, and still requires downstream Reviewer attestation.
- A natural StudioNet semantic pair produced `DERIVATIVE_SOURCE_CLUSTER`; that set the permanent derivative-history block. Reviewer revocation could not erase it, and Author freeze was refused with an exact derivative-history error.

## Blind/natural input commitment

The runtime semantic texts and metadata were registered on-chain before any pair judgment. That on-chain registration is the pre-judgment commitment for this run: source excerpts/bindings could not be changed after the first successful judgment sealed the basis. The semantic texts were created for this v2.1 runtime and were not copied from Direct Mode fixtures or contract prompt examples.

Important provenance boundary: the reference locators are metadata only. The contract does not fetch URLs or authenticate external truth. The Reviewer address attests the exact immutable binding.

## Exact transaction evidence

| Claim | Action | Caller | Result | Transaction | Observed post-state / reason |
|---|---|---|---|---|---|
| Claim #1 | Author wrong-wallet attests S1 | `0x627609…4657F4` | **REFUSED** | [Explorer](https://explorer-studio.genlayer.com/tx/0x3d27058e448f11de3fdfd6dd06f2bbb91626ed57da247a279f53ab553094649a) | Exact contract reason surfaced: `Only claim reviewer may attest provenance`; S1 stayed PROPOSED; 0/3 attested. |
| Claim #1 | Freeze before provenance/pair gate | `0x627609…4657F4` | **REFUSED / no postcondition** | [Explorer](https://explorer-studio.genlayer.com/tx/0x038879948cb69475b666eac862589c4d903c3c8bb6ef59b61f3f8e9cff015476) | Finalized transaction did not produce freeze postcondition; basis_frozen stayed false and state stayed 0/3 attested, 0/3 judged. |
| Claim #1 | Reviewer attests S1 | `0x146e44…95ec8e` | **SUCCESS** | [Explorer](https://explorer-studio.genlayer.com/tx/0xc155c6cf3f43307e67a6dd5e00225c1a47fe69a45910abc77b4cde0b0216895f) | S1 PROPOSED → ATTESTED; 1/3 attested. |
| Claim #1 | Public judge attempts S1↔S2 before S2 attestation | `0x037f58…4a1CDE` | **REFUSED / no postcondition** | [Explorer](https://explorer-studio.genlayer.com/tx/0x2272d422b16e64957a474bd71ddf3d2ca1a03edeb13f4370401dc82d271e9fa5) | No pair record, semantic_eval_count stayed 0, adjudication basis stayed OPEN. |
| Claim #1 | Reviewer attests S2 | `0x146e44…95ec8e` | **SUCCESS** | [Explorer](https://explorer-studio.genlayer.com/tx/0x8cc33572697378d775d2b216d33ec7dcff84eeb77f1824dc3265a04a1305ca5a) | S2 PROPOSED → ATTESTED; 2/3 attested. |
| Claim #1 | Reviewer attests S3 | `0x146e44…95ec8e` | **SUCCESS** | [Explorer](https://explorer-studio.genlayer.com/tx/0xd5ce354b85608cb9b27d254d17a8625b1fc92a1bae6610517205fdb50d90bbd1) | S3 PROPOSED → ATTESTED; 3/3 attested. |
| Claim #1 | Natural semantic judge S1↔S2 | `0x037f58…4a1CDE` | **SUCCESS** | [Explorer](https://explorer-studio.genlayer.com/tx/0x572c9c01c8500f02a329c67eeec72c73e56afcd732f36b5dda0de9f843c24c1d) | `INDEPENDENT_CORROBORATION`; 1/3 judged; first successful judgment atomically sealed adjudication basis. |
| Claim #1 | Reviewer attempts revoke after basis seal | `0x146e44…95ec8e` | **REFUSED / no postcondition** | [Explorer](https://explorer-studio.genlayer.com/tx/0x3a1b01a8c156abd5ad9428adf09074e95a5110a834e1b52ce32fa882d1c5845d) | Revocation postcondition did not occur; 3 active sources remained; basis stayed SEALED. |
| Claim #1 | Author attempts add source after basis seal | `0x627609…4657F4` | **REFUSED / no postcondition** | [Explorer](https://explorer-studio.genlayer.com/tx/0x63ff3a7af4312e29f0e560058a8003de0cd7462a809b7e87ddeddf355f3ae3c3) | External-source postcondition did not occur; source_count stayed 3. |
| Claim #1 | Natural semantic judge S1↔S3 | `0x037f58…4a1CDE` | **SUCCESS** | [Explorer](https://explorer-studio.genlayer.com/tx/0x8a16c4fd6209f8d67d138de4afdbb926415be89621cb1c1f018ec1e1aca9e863) | `INDEPENDENT_CORROBORATION`; 2/3 judged; one unjudged pair still blocked reuse. |
| Claim #1 | Same freeze call at 2/3 judged | `0x627609…4657F4` | **REFUSED** | [Explorer](https://explorer-studio.genlayer.com/tx/0x581b54ef692e28482636cfe59bc7cd1e3ecd201f5266dcf62b3a22b519f24171) | Exact contract reason: `Claim is not REUSE_READY`; basis_frozen remained false. |
| Claim #1 | Natural semantic judge S2↔S3 | `0x037f58…4a1CDE` | **SUCCESS** | [Explorer](https://explorer-studio.genlayer.com/tx/0x7c3f882a07a7c79436833296b5b3c878ea579cbe7e5c942a99b3510fe529b219) | `INDEPENDENT_CORROBORATION`; 3/3 judged; all independent; REUSE_READY. |
| Claim #1 | Same freeze call after full gate | `0x627609…4657F4` | **SUCCESS** | [Explorer](https://explorer-studio.genlayer.com/tx/0x5e8c72a6d545920b86c57d77ef19a6476ba22dd13b6d01c125a867469a7e85d0) | Claim became FROZEN; deterministic basis_digest recorded. |
| Claim #1 | Author attempts mutation after freeze | `0x627609…4657F4` | **REFUSED** | [Explorer](https://explorer-studio.genlayer.com/tx/0x1054df971ec16118d3fd62b8fdde5c506feabe547223b0cf581a5e40b6e91b68) | Exact contract reason: `Reusable provenance basis is frozen`; source_count remained 3. |
| Claim #2 | Create downstream claim | `0x627609…4657F4` | **SUCCESS** | [Explorer](https://explorer-studio.genlayer.com/tx/0x153a5dff53f1e0430823506b4880434605fbcc6ae6ef584274e02a5089161b8b) | Claim #2 created with one EXTERNAL PROPOSED source. |
| Claim #2 | Add frozen Claim #1 as typed source | `0x627609…4657F4` | **SUCCESS** | [Explorer](https://explorer-studio.genlayer.com/tx/0x1b10f180efabd28462cf64cd088e7b1ad5ba58b7e1404be02fa457e2b76d0b55) | TYPED_CLAIM source preserved `from_claim_id = 1`, used Claim #1 basis digest, stayed PROPOSED; upstream reuse_count became 1. |
| Claim #2 | Reviewer attests typed source S2 | `0x146e44…95ec8e` | **SUCCESS** | [Explorer](https://explorer-studio.genlayer.com/tx/0x11b9dda61f9d54e43b4b11b409f84ded227e4f2bf0b1676207bb90c524647923) | Downstream typed source required fresh Reviewer attestation; upstream freeze did not auto-attest it. |
| Claim #2 | Author adds third external source before adjudication | `0x627609…4657F4` | **SUCCESS** | [Explorer](https://explorer-studio.genlayer.com/tx/0x26ee900b479d7c01327b8aaef92b9adbd6b2d4b269dbcad5a7ce803cb926390d) | Claim #2 reached 3 active sources while adjudication basis was still OPEN. |
| Claim #2 | Reviewer attests S1 | `0x146e44…95ec8e` | **SUCCESS** | [Explorer](https://explorer-studio.genlayer.com/tx/0x109e5700e5d1247eda4c303959473aa563eb25dbce11302bfa320cde1aec8fd6) | 2/3 attested. |
| Claim #2 | Reviewer attests S3 | `0x146e44…95ec8e` | **SUCCESS** | [Explorer](https://explorer-studio.genlayer.com/tx/0xee05d273f90839468a4e0d35062338dbc414bd3dc7b7dcc543b2389dc6f6085e) | 3/3 attested; 0/3 pairs judged; semantic_eval_count 0. |
| Claim #2 | Natural semantic judge S2↔S3 | `0x037f58…4a1CDE` | **SUCCESS** | [Explorer](https://explorer-studio.genlayer.com/tx/0x269cc863d8a89695fcb274eddbc2510135a1b313b8fcf59f5bef55a0aec04a6a) | Actual StudioNet consensus returned `DERIVATIVE_SOURCE_CLUSTER`; derivative_history_blocked became true and basis sealed. |
| Claim #2 | Reviewer attempts revoke after derivative verdict | `0x146e44…95ec8e` | **REFUSED / no postcondition** | [Explorer](https://explorer-studio.genlayer.com/tx/0xfb10bdee54b37ad7796404874a33734e79baa80f699f18d10eb9661ab63e43ea) | Source remained active + attested + judgment-locked; derivative verdict remained recorded; history block stayed true. |
| Claim #2 | Author attempts freeze after derivative verdict | `0x627609…4657F4` | **REFUSED** | [Explorer](https://explorer-studio.genlayer.com/tx/0xac01b2ac51579b5a9f68f9cc5b7a15d90f438eb8a8bb4d80785481197a1871fc) | Exact contract reason: `Claim has a permanent derivative-history block`; basis_frozen stayed false. |

## Causal freeze proof

The strongest positive-path consequence proof uses the same Author and the same method:

- Before the complete matrix: [`0x581b…4171`](https://explorer-studio.genlayer.com/tx/0x581b54ef692e28482636cfe59bc7cd1e3ecd201f5266dcf62b3a22b519f24171) → `Claim is not REUSE_READY` → `basis_frozen = false`.
- After 3/3 independent pairs: [`0x5e8c…85d0`](https://explorer-studio.genlayer.com/tx/0x5e8c72a6d545920b86c57d77ef19a6476ba22dd13b6d01c125a867469a7e85d0) → success → Claim #1 `FROZEN` with deterministic basis digest.

## Non-bypassable negative consequence proof

- Natural semantic tx [`0x269c…4a6a`](https://explorer-studio.genlayer.com/tx/0x269cc863d8a89695fcb274eddbc2510135a1b313b8fcf59f5bef55a0aec04a6a) returned `DERIVATIVE_SOURCE_CLUSTER`.
- Reviewer revoke attempt [`0xfb10…43ea`](https://explorer-studio.genlayer.com/tx/0xfb10bdee54b37ad7796404874a33734e79baa80f699f18d10eb9661ab63e43ea) did not remove the source or verdict.
- Author freeze attempt [`0xac01…71fc`](https://explorer-studio.genlayer.com/tx/0xac01b2ac51579b5a9f68f9cc5b7a15d90f438eb8a8bb4d80785481197a1871fc) was refused with `Claim has a permanent derivative-history block`.

No further pair judgments are required on Claim #2 to prove this invariant: one derivative verdict is sufficient to make the same Claim ID permanently ineligible for freeze.

## Screenshot index

- [`snap/00-direct-mode-27-pass.webp`](snap/00-direct-mode-27-pass.webp)
- [`snap/01-release-verify-sha-pass.webp`](snap/01-release-verify-sha-pass.webp)
- [`snap/02-fresh-v21-deployment-config.webp`](snap/02-fresh-v21-deployment-config.webp)
- [`snap/03-author-attestation-refused.webp`](snap/03-author-attestation-refused.webp)
- [`snap/04-first-semantic-judgment-seals-basis.webp`](snap/04-first-semantic-judgment-seals-basis.webp)
- [`snap/05-two-positive-one-unjudged-blocked.webp`](snap/05-two-positive-one-unjudged-blocked.webp)
- [`snap/06-freeze-after-gate-success.webp`](snap/06-freeze-after-gate-success.webp)
- [`snap/07-upstream-reuse-count-one.webp`](snap/07-upstream-reuse-count-one.webp)
- [`snap/08-natural-derivative-history-block.webp`](snap/08-natural-derivative-history-block.webp)
- [`snap/09-reviewer-cannot-revoke-derivative-source.webp`](snap/09-reviewer-cannot-revoke-derivative-source.webp)
- [`snap/10-derivative-history-freeze-refused.webp`](snap/10-derivative-history-freeze-refused.webp)
