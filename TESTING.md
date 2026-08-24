# SourceGate — Final Testing

## Final deployment

```text
Contract: 0x09324215eEC452600F72Eb1D63ee6Bb48E92740f
Website:  https://source-gate.vercel.app/
```

## Final live dApp run

The final deployment initially had an empty registry. The live frontend was
verified to handle this state correctly:

```text
EMPTY REGISTRY
No public sample yet
claim_count = 0
```

The frontend did not call a non-existent Claim #1 and did not surface the prior
`-32000` RPC error.

A first claim was then created from the live dApp using the four-source Harbor
Rail demo.

Observed final state:

```text
claim_id = 1
source_count = 4
pair_count = 3
independent_pairs = 2
distinct_independent_sources = 3
verified = true
```

Observed verification gate:

```text
2/2 independent pairs
3/3 distinct sources
VERIFIED
```

Observed public-sample behavior:

```text
READ-ONLY SAMPLE · Claim #1
Sources = 4
Pair Review = 3
VERIFIED
```

On the Sources screen, normal write controls for the shared sample are disabled.
Claim #1 is therefore preserved as the final public demo state.

## Demo pair path

The intended three-call demo path is:

```text
S1 + S2 → derivative candidate
S1 + S3 → independent candidate
S3 + S4 → independent candidate
```

The final aggregate state confirms:

```text
2 independent pair verdicts
1 derivative pair verdict
3 distinct sources participating in positive pair verdicts
3 total pair records
```

The exact pair-to-verdict mapping should be taken from the live Pair Review audit
trail when documenting screenshots; this file does not claim more than the
observed final state above.

## Frontend checks already verified during V5 testing

Before the final contract-address switch, the same V5 frontend logic was tested
end-to-end and observed to:

```text
PASS  create a fresh workspace and resolve the correct claim
PASS  update pair history after consensus finalization
PASS  reach VERIFIED at 2 pairs / 3 distinct sources
PASS  preserve the active workspace across F5
PASS  recover ownership after reconnecting the author wallet
PASS  keep the public sample read-only
PASS  reject an exact duplicate source excerpt before opening MetaMask
```

These checks exercise frontend logic that is unchanged in the final live build.

## Final-address fixes verified

```text
PASS  contract address displays as 0x0932...740f
PASS  blank/invalid Vercel env no longer produces an empty address
PASS  empty deployment no longer calls get_claim(1)
PASS  live config loads from the final contract
PASS  first live claim becomes Claim #1
PASS  Claim #1 becomes the final read-only sample
```

## Runtime configuration visible in the dApp

```text
version = 1.1
verification threshold = 2 pairs / 3 sources
URLs in prompt = NO
pair judging = PUBLIC
global admin = NO
```

## Remaining optional checks

These are not required for the core submission flow, but can be repeated if
desired:

```text
- typed reuse of VERIFIED Claim #1 into a separate authored claim
- typed reuse rejection for an unverified claim
- non-http(s) reference URL rejection
- two-browser concurrent create_claim attribution test
```

Avoid modifying Claim #1 simply to add more test evidence; it is now the clean
public sample.
