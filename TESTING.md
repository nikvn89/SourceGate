# SourceGate — Frontend Testing

The Intelligent Contract runtime is already verified on StudioNet. The frontend
still needs local and Vercel end-to-end testing.

## Local checklist

```bash
npm install
npm test
npm run build
npm run dev
```

Then verify:

```text
1. Claim #1 loads as READ-ONLY SAMPLE.
2. Connect MetaMask on StudioNet 61999.
3. Click Fresh demo, then Create Fresh Claim.
4. The new claim becomes the workspace without F5.
5. Pair Review can submit S1 + S2.
6. The UI confirms from contract state, not receipt polling.
7. Submit S1 + S3.
8. Submit S3 + S4.
9. Verification counters update after each finalized state transition.
10. F5 preserves the last real claim instead of returning to Claim #1.
11. Sources tab can add an external excerpt.
12. Typed reuse of an unverified claim surfaces the contract error.
13. Typed reuse of Claim #1 succeeds on a non-sample workspace.
```

Do not mark these frontend items PASS until actually observed.

## Review-driven checks before Vercel

```text
T0  Open without a wallet.
    Claim #1 must load as READ-ONLY SAMPLE.
    Gate must show finite counters (no NaN).
    Overview on-chain config must show v1.1 and 2 pairs / 3 sources.

T1  Connect wallet and create a fresh claim.
    Confirm the loaded claim text matches the submitted text
    AND claim.author matches the connected wallet.

T2  In a second browser/session, create another claim near the same time.
    The first session must still resolve its own claim by text + author,
    never by the global latest claim id.

T3  Load another user's non-sample claim.
    Add-source controls must be disabled.
    Pair judging may remain enabled, but the UI must warn that the verdict is public and permanent.

T4  Enter a non-http(s) reference URL such as javascript:alert(1).
    The client must reject it before signing.

T5  Add an external source successfully.
    Confirmation must match the exact source excerpt/origin record.

T6  Add Claim #1 as a typed verified source to a claim you authored.
    Confirmation must match from_claim_id=1 and the verified claim text.

T7  F5.
    The current workspace key must be scoped to the deployed contract address.
```

## MUST-VERIFY deployment identity

Before public Vercel testing, confirm directly against the deployed address:

```text
get_config().version == "1.1"
get_config().required_distinct_independent_sources == 3
```

Also confirm the deployed source is the same v1.1 source included in
`contracts/SourceIndependenceGate.py`.

The local source SHA-256 is:

```text
337ecb69222e61b7b693621bd7f6d2a84189ed480c6d42b9645fedd3e2273374
```
