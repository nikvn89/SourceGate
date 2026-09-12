# SourceGate v2 runtime snapshots

These screenshots are runtime evidence captured from the production Vercel UI against the frozen StudioNet contract deployment `0x0F011a04951320e194eB6EF279F3978e59A95350`.

They are evidence only; the contract source remains frozen and unchanged.

## Checkpoints

- `01-live-v2-deployment.png` — Live SourceGate v2 UI pinned to fresh StudioNet deployment.
- `02-wallet-author-connected.png` — Author wallet connected on StudioNet 61999; v2.0 public profile loaded.
- `03-claim1-created-proposed.png` — Claim #1 created with three PROPOSED source bundles.
- `04-reviewer-role.png` — Distinct reviewer wallet recognized; reviewer-only attestation actions enabled.
- `05-source1-attested.png` — Reviewer attests exact binding for S1; post-state shows 1/3 attested.
- `06-all-sources-attested-matrix-unjudged.png` — All three sources attested while active matrix remains 0/3 judged.
- `07-one-independent-two-unjudged-blocked.png` — Public judge records first independent pair; two unjudged pairs still block reuse.
- `08-two-independent-one-unjudged-blocked.png` — Two positive pairs plus one unjudged pair: Reuse Gate remains Blocked.
- `09-complete-independent-matrix-reuse-ready.png` — Complete 3/3 independent active matrix reaches REUSE_READY.
- `10-basis-frozen.png` — Author freezes exact reusable provenance basis; basis digest shown.
- `11-claim2-created.png` — Claim #2 created for typed-reuse consequence test.
- `12-typed-source-added-from-claim1.png` — Frozen Claim #1 added to Claim #2 as TYPED_CLAIM with explicit lineage.
- `13-typed-source-reviewer-attested.png` — Typed source remains PROPOSED until distinct reviewer attests exact binding.
- `14-claim2-all-attested.png` — Claim #2 both active sources attested; pair matrix still unjudged.
- `15-derivative-complete-matrix-blocked.png` — Claim #2 complete matrix returns DERIVATIVE_SOURCE_CLUSTER and remains Blocked.
- `16-upstream-reuse-count-one.png` — Claim #1 remains frozen and immutable with reuse_count = 1 after typed reuse.
