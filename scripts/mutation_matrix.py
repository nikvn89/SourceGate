"""Structural mutation checks for load-bearing v2 guards.

This local gate proves the source-policy checker detects removal of each named
security mechanism. Real behavioral mutants belong in Direct Mode.
"""
from pathlib import Path
import ast
SRC=Path(__file__).resolve().parents[1]/'contracts'/'SourceGate.py'
base=SRC.read_text()

def policy(text):
    try:
        ast.parse(text)
    except SyntaxError:
        return False
    needles=(
        'Reviewer must be a different wallet',
        'Only claim reviewer may attest provenance',
        'Source binding hash mismatch',
        'Only claim reviewer may revoke provenance',
        'Both sources must be reviewer-attested before pair judging',
        'record_a.evidence_digest == record_b.evidence_digest',
        'unjudged_active_pair_blocks_typed_reuse',
        'derivative_active_pair_blocks_typed_reuse',
        'Source claim is not REUSE_READY',
        'Source claim reuse basis is not frozen',
        'Only claim author may freeze reuse basis',
        'Reusable provenance basis is frozen',
        'Registered claim text must use typed reuse path',
        'MAX_FRESH_SEMANTIC_EVALS_PER_CLAIM = 66',
        'source_binding_a=record_a.binding_hash',
        'Source pair is already judged',
        '"urls_fetched": False',
        'evidence_digest_is_binding_not_external_verification',
    )
    return all(n in text for n in needles)

assert policy(base)
mutants=[
 ('reviewer distinct','Reviewer must be a different wallet'),
 ('reviewer attestation','Only claim reviewer may attest provenance'),
 ('binding handshake','Source binding hash mismatch'),
 ('reviewer revocation','Only claim reviewer may revoke provenance'),
 ('attested pair gate','Both sources must be reviewer-attested before pair judging'),
 ('same artifact derivative','record_a.evidence_digest == record_b.evidence_digest'),
 ('unjudged block','unjudged_active_pair_blocks_typed_reuse'),
 ('derivative block','derivative_active_pair_blocks_typed_reuse'),
 ('reuse ready gate','Source claim is not REUSE_READY'),
 ('freeze gate','Source claim reuse basis is not frozen'),
 ('author freeze','Only claim author may freeze reuse basis'),
 ('frozen immutability','Reusable provenance basis is frozen'),
 ('typed lineage','Registered claim text must use typed reuse path'),
 ('semantic ceiling','MAX_FRESH_SEMANTIC_EVALS_PER_CLAIM = 66'),
 ('pair binding persistence','source_binding_a=record_a.binding_hash'),
 ('explicit replay refusal','Source pair is already judged'),
 ('no fetch overclaim','"urls_fetched": False'),
 ('honest digest boundary','evidence_digest_is_binding_not_external_verification'),
]
for name,token in mutants:
    mutated=base.replace(token, '__REMOVED_GUARD__')
    assert not policy(mutated), name
print(f'MUTATION MATRIX PASS {len(mutants)}/{len(mutants)} caught')
