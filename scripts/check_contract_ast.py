from pathlib import Path
import ast, sys

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'contracts' / 'SourceGate.py'
text = SRC.read_text(encoding='utf-8')
ast.parse(text)

required = {
    'v2 version': 'CONTRACT_VERSION = "2.0"',
    'distinct reviewer gate': 'Reviewer must be a different wallet',
    'reviewer attestation write': 'def attest_source(',
    'reviewer revocation write': 'def revoke_source(',
    'complete active matrix': 'complete_active_pair_matrix_required',
    'unjudged blocks reuse': 'unjudged_active_pair_blocks_typed_reuse',
    'derivative blocks reuse': 'derivative_active_pair_blocks_typed_reuse',
    'dynamic readiness': 'def _basis_metrics(',
    'freeze before typed reuse': 'Source claim reuse basis is not frozen',
    'author-only freeze': 'Only claim author may freeze reuse basis',
    'typed lineage guard': 'Registered claim text must use typed reuse path',
    'pair binds exact source hashes': 'source_binding_a=record_a.binding_hash',
    'replay explicitly reverts': 'Source pair is already judged',
    'same artifact deterministic derivative': 'record_a.evidence_digest == record_b.evidence_digest',
    'attested pair gate': 'Both sources must be reviewer-attested before pair judging',
    'bounded semantic evaluations': 'MAX_FRESH_SEMANTIC_EVALS_PER_CLAIM = 66',
    'no external fetch claim': '"urls_fetched": False',
    'honest evidence boundary': 'evidence_digest_is_binding_not_external_verification',
    'public pair judging': '"public_pair_judging": True',
    'no admin': '"global_admin": False',
    'no clock': '"clock_used": False',
}
for name, needle in required.items():
    if needle not in text:
        raise AssertionError(f'{name}: missing {needle!r}')

for forbidden in (
    'verified = True',
    'verification is a one-way latch',
    'wallet_getSnaps',
    'wallet_requestSnaps',
):
    if forbidden in text:
        raise AssertionError(f'forbidden legacy pattern: {forbidden}')

print(f'AST/POLICY PASS {len(required)}/{len(required)}')
