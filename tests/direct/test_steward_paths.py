import json
import pytest
from conftest import (
    IND, DER, CLAIM, SRC1, SRC2, SRC3, SRC4,
    dig, addr_hex, source, initial3, attest, attest_all3,
    judge_independent_matrix3,
)


def test_config_v21_and_distinct_reviewer(claim1, reviewer):
    cfg = claim1.get_config()
    c = claim1.get_claim(1)
    assert cfg['version'] == '2.1'
    assert cfg['reviewer_required'] is True
    assert cfg['complete_active_pair_matrix_required'] is True
    assert cfg['first_judgment_seals_active_basis'] is True
    assert cfg['source_mutation_after_adjudication_blocked'] is True
    assert cfg['freeze_rechecks_sealed_basis_digest'] is True
    assert cfg['unjudged_active_pair_blocks_typed_reuse'] is True
    assert cfg['derivative_active_pair_blocks_typed_reuse'] is True
    assert cfg['historical_derivative_blocks_freeze'] is True
    assert cfg['judged_source_revocation_blocked'] is True
    assert str(c['reviewer']).lower() == addr_hex(reviewer).lower()
    assert c['reuse_ready'] is False


def test_reviewer_equal_owner_and_zero_reviewer_refused(sg, direct_vm, owner):
    with direct_vm.expect_revert():
        sg.create_claim('c-owner', addr_hex(owner), json.dumps(initial3()))
    with direct_vm.expect_revert():
        sg.create_claim(
            'c-zero',
            '0x0000000000000000000000000000000000000000',
            json.dumps(initial3()),
        )


def test_outsider_cannot_add_external_source(claim1, direct_vm, outsider):
    before = claim1.get_claim(1)['source_count']
    with direct_vm.prank(outsider):
        with direct_vm.expect_revert():
            claim1.add_external_source(
                1,
                'Outsider should not be able to append this source.',
                'Outsider origin',
                '',
                dig('outsider-append'),
            )
    assert claim1.get_claim(1)['source_count'] == before


def test_external_sources_start_proposed_and_block_pair_judging(claim1, direct_vm):
    assert claim1.get_source(1, 1)['provenance_state'] == 'PROPOSED'
    with direct_vm.expect_revert():
        claim1.judge_pair(1, 1, 2)
    c = claim1.get_claim(1)
    assert c['pair_count'] == 0
    assert c['semantic_eval_count'] == 0


def test_only_reviewer_can_attest_and_binding_must_match(claim1, direct_vm, reviewer, outsider):
    binding = claim1.get_source(1, 1)['binding_hash']
    with direct_vm.expect_revert():
        claim1.attest_source(1, 1, binding)  # owner
    with direct_vm.prank(outsider):
        with direct_vm.expect_revert():
            claim1.attest_source(1, 1, binding)
    with direct_vm.prank(reviewer):
        with direct_vm.expect_revert():
            claim1.attest_source(1, 1, '0' * 64)
        claim1.attest_source(1, 1, binding)
    assert claim1.get_source(1, 1)['provenance_state'] == 'ATTESTED'


def test_three_attested_sources_with_all_pairs_unjudged_are_not_reusable(claim1, direct_vm, reviewer):
    attest_all3(claim1, direct_vm, reviewer)
    c = claim1.get_claim(1)
    assert c['attested_active_source_count'] == 3
    assert c['active_pair_target'] == 3
    assert c['unjudged_active_pairs'] == 3
    assert c['reuse_ready'] is False
    with direct_vm.expect_revert():
        claim1.freeze_reuse_basis(1)


def test_two_positive_pairs_plus_one_unjudged_still_block_reuse(claim1, direct_vm, reviewer):
    attest_all3(claim1, direct_vm, reviewer)
    direct_vm.mock_llm(r'.*', IND)
    claim1.judge_pair(1, 1, 2)
    claim1.judge_pair(1, 1, 3)
    c = claim1.get_claim(1)
    assert c['independent_active_pairs'] == 2
    assert c['unjudged_active_pairs'] == 1
    assert c['reuse_ready'] is False
    with direct_vm.expect_revert():
        claim1.freeze_reuse_basis(1)


def test_one_derivative_pair_blocks_complete_matrix(claim1, direct_vm, reviewer):
    attest_all3(claim1, direct_vm, reviewer)
    direct_vm.mock_llm(r'.*', IND)
    claim1.judge_pair(1, 1, 2)
    claim1.judge_pair(1, 1, 3)
    direct_vm.clear_mocks(); direct_vm.mock_llm(r'.*', DER)
    claim1.judge_pair(1, 2, 3)
    c = claim1.get_claim(1)
    assert c['unjudged_active_pairs'] == 0
    assert c['derivative_active_pairs'] == 1
    assert c['reuse_ready'] is False
    assert c['derivative_history_blocked'] is True
    with direct_vm.expect_revert():
        claim1.freeze_reuse_basis(1)


def test_all_three_pairs_independent_enable_ready_then_author_freezes(claim1, direct_vm, reviewer):
    attest_all3(claim1, direct_vm, reviewer)
    judge_independent_matrix3(claim1, direct_vm)
    c = claim1.get_claim(1)
    assert c['reuse_ready'] is True
    assert c['basis_frozen'] is False
    assert c['adjudication_started'] is True
    assert len(c['adjudication_basis_digest']) == 64
    assert c['independent_active_pairs'] == 3
    claim1.freeze_reuse_basis(1)
    c = claim1.get_claim(1)
    assert c['reuse_ready'] is True
    assert c['basis_frozen'] is True
    assert len(c['basis_digest']) == 64
    assert c['frozen_active_source_count'] == 3
    assert c['frozen_pair_count'] == 3


def test_outsider_cannot_freeze_ready_basis(claim1, direct_vm, reviewer, outsider):
    attest_all3(claim1, direct_vm, reviewer)
    judge_independent_matrix3(claim1, direct_vm)
    with direct_vm.prank(outsider):
        with direct_vm.expect_revert():
            claim1.freeze_reuse_basis(1)


def test_first_successful_judgment_seals_entire_basis_against_adaptive_mutation(claim1, direct_vm, reviewer):
    attest_all3(claim1, direct_vm, reviewer)
    direct_vm.mock_llm(r'.*', IND)
    claim1.judge_pair(1, 1, 2)
    c = claim1.get_claim(1)
    assert c['adjudication_started'] is True
    assert len(c['adjudication_basis_digest']) == 64

    with direct_vm.expect_revert():
        claim1.add_external_source(
            1, SRC4, 'Trade journal field report', 'https://example.org/trade', dig('artifact-4')
        )
    with direct_vm.prank(reviewer):
        with direct_vm.expect_revert():
            claim1.revoke_source(1, 3)
    assert claim1.get_claim(1)['active_source_count'] == 3


def test_first_judgment_requires_all_active_sources_attested_and_rolls_back_seal(claim1, direct_vm, reviewer):
    attest(claim1, direct_vm, reviewer, 1, 1, 2)
    direct_vm.mock_llm(r'.*', IND)
    with direct_vm.expect_revert():
        claim1.judge_pair(1, 1, 2)
    c = claim1.get_claim(1)
    assert c['adjudication_started'] is False
    assert c['adjudication_basis_digest'] == ''
    assert c['pair_count'] == 0
    assert c['semantic_eval_count'] == 0


def test_derivative_judgment_locks_sources_and_permanently_blocks_freeze(sg, direct_vm, reviewer):
    sources = initial3() + [source(SRC4, 'Trade journal', 'artifact-4', 'https://example.org/trade')]
    sg.create_claim('Claim with four provenance bundles.', addr_hex(reviewer), json.dumps(sources))
    attest(sg, direct_vm, reviewer, 1, 1,2,3,4)

    direct_vm.mock_llm(r'.*', IND)
    for pair in ((1,2),(1,3),(2,3),(1,4),(2,4)):
        sg.judge_pair(1, *pair)
    direct_vm.clear_mocks(); direct_vm.mock_llm(r'.*', DER)
    sg.judge_pair(1, 3, 4)
    c = sg.get_claim(1)
    assert c['reuse_ready'] is False
    assert c['derivative_history_blocked'] is True
    assert sg.get_source(1, 3)['judgment_locked'] is True
    assert sg.get_source(1, 4)['judgment_locked'] is True

    with direct_vm.prank(reviewer):
        with direct_vm.expect_revert():
            sg.revoke_source(1, 4)
    after = sg.get_claim(1)
    assert after['active_source_count'] == 4
    assert after['derivative_active_pairs'] == 1
    assert after['derivative_history_blocked'] is True
    with direct_vm.expect_revert():
        sg.freeze_reuse_basis(1)


def test_reviewer_can_revoke_unjudged_proposed_or_attested_source(sg, direct_vm, reviewer):
    sg.create_claim('Revocation before adjudication remains available.', addr_hex(reviewer), json.dumps(initial3()))
    with direct_vm.prank(reviewer):
        sg.revoke_source(1, 1)
    s1 = sg.get_source(1, 1)
    assert s1['provenance_state'] == 'REVOKED'
    assert s1['active'] is False
    assert s1['judgment_locked'] is False

    binding = sg.get_source(1, 2)['binding_hash']
    with direct_vm.prank(reviewer):
        sg.attest_source(1, 2, binding)
        sg.revoke_source(1, 2)
    s2 = sg.get_source(1, 2)
    assert s2['provenance_state'] == 'REVOKED'
    assert s2['active'] is False
    assert s2['judgment_locked'] is False


def test_owner_and_outsider_cannot_revoke(claim1, direct_vm, reviewer, outsider):
    attest(claim1, direct_vm, reviewer, 1, 1)
    with direct_vm.expect_revert():
        claim1.revoke_source(1, 1)
    with direct_vm.prank(outsider):
        with direct_vm.expect_revert():
            claim1.revoke_source(1, 1)


def test_exact_and_reverse_pair_replay_never_rerolls(claim1, direct_vm, reviewer):
    attest_all3(claim1, direct_vm, reviewer)
    direct_vm.mock_llm(r'.*', IND)
    claim1.judge_pair(1, 1, 2)
    before = claim1.get_claim(1)
    with direct_vm.expect_revert():
        claim1.judge_pair(1, 1, 2)
    with direct_vm.expect_revert():
        claim1.judge_pair(1, 2, 1)
    after = claim1.get_claim(1)
    assert after['pair_count'] == before['pair_count'] == 1
    assert after['semantic_eval_count'] == before['semantic_eval_count'] == 1


def test_same_evidence_digest_is_deterministic_derivative_without_model_call(sg, direct_vm, reviewer):
    same = dig('same-artifact')
    sources = [
        {'excerpt':'Excerpt A','origin_label':'Origin A','reference_url':'','evidence_digest':same,'from_claim_id':0},
        {'excerpt':'Excerpt B','origin_label':'Origin B','reference_url':'','evidence_digest':same,'from_claim_id':0},
        source('Excerpt C','Origin C','other-artifact'),
    ]
    sg.create_claim('Same artifact identity must not count twice.', addr_hex(reviewer), json.dumps(sources))
    attest_all3(sg, direct_vm, reviewer)
    sg.judge_pair(1,1,2)
    p = sg.get_pair_by_sources(1,1,2)
    c = sg.get_claim(1)
    assert p['verdict'] == 'DERIVATIVE_SOURCE_CLUSTER'
    assert p['semantic_eval_used'] is False
    assert c['semantic_eval_count'] == 0


def test_malformed_semantic_output_writes_no_pair_or_eval_count(claim1, direct_vm, reviewer):
    attest_all3(claim1, direct_vm, reviewer)
    direct_vm.mock_llm(r'.*', '{"verdict":"NOT_ALLOWED"}')
    with direct_vm.expect_revert():
        claim1.judge_pair(1,1,2)
    c = claim1.get_claim(1)
    assert c['pair_count'] == 0
    assert c['semantic_eval_count'] == 0
    assert c['adjudication_started'] is False
    assert c['adjudication_basis_digest'] == ''


def test_external_exact_registered_claim_text_must_use_typed_path(sg, direct_vm, reviewer):
    sg.create_claim('Upstream registered claim.', addr_hex(reviewer), json.dumps(initial3()))
    sg.create_claim('Downstream claim.', addr_hex(reviewer), json.dumps([
        source('Independent starter source','Starter','starter')
    ]))
    with direct_vm.expect_revert():
        sg.add_external_source(2, 'Upstream registered claim.', 'Anonymous copy', '', dig('copy'))


def test_typed_reuse_refused_until_source_claim_basis_is_frozen(sg, direct_vm, reviewer):
    sg.create_claim('Upstream reusable claim.', addr_hex(reviewer), json.dumps(initial3()))
    attest_all3(sg, direct_vm, reviewer)
    judge_independent_matrix3(sg, direct_vm)
    assert sg.get_claim(1)['reuse_ready'] is True
    assert sg.get_claim(1)['basis_frozen'] is False

    sg.create_claim('Downstream target claim.', addr_hex(reviewer), json.dumps([
        source('Starter source for downstream','Starter','starter')
    ]))
    with direct_vm.expect_revert():
        sg.add_reuse_claim_source(2,1)


def test_typed_reuse_after_freeze_preserves_lineage_and_requires_target_reviewer_attestation(sg, direct_vm, reviewer):
    sg.create_claim('Upstream reusable claim.', addr_hex(reviewer), json.dumps(initial3()))
    attest_all3(sg, direct_vm, reviewer)
    judge_independent_matrix3(sg, direct_vm)
    sg.freeze_reuse_basis(1)
    basis = sg.get_claim(1)['basis_digest']

    sg.create_claim('Downstream target claim.', addr_hex(reviewer), json.dumps([
        source('Starter source for downstream','Starter','starter')
    ]))
    sg.add_reuse_claim_source(2,1)
    typed = sg.get_source(2,2)
    assert typed['kind'] == 'TYPED_CLAIM'
    assert typed['from_claim_id'] == 1
    assert typed['evidence_digest'] == basis
    assert typed['provenance_state'] == 'PROPOSED'
    assert sg.get_claim(1)['reuse_count'] == 1

    with direct_vm.prank(reviewer):
        sg.attest_source(2,2,typed['binding_hash'])
    assert sg.get_source(2,2)['provenance_state'] == 'ATTESTED'


def test_frozen_basis_rejects_append_revoke_and_pair_writes(claim1, direct_vm, reviewer):
    attest_all3(claim1, direct_vm, reviewer)
    judge_independent_matrix3(claim1, direct_vm)
    claim1.freeze_reuse_basis(1)
    with direct_vm.expect_revert():
        claim1.add_external_source(1,'new','origin','',dig('new'))
    with direct_vm.prank(reviewer):
        with direct_vm.expect_revert():
            claim1.revoke_source(1,1)
    with direct_vm.expect_revert():
        claim1.judge_pair(1,1,2)


def test_create_claim_atomic_rollback_on_invalid_second_source(sg, direct_vm, reviewer):
    payload = [
        source('Valid first source', 'Origin A', 'rollback-a'),
        {
            'excerpt': 'Invalid second source',
            'origin_label': 'Origin B',
            'reference_url': '',
            'evidence_digest': 'not-a-digest',
            'from_claim_id': 0,
        },
    ]
    with direct_vm.expect_revert():
        sg.create_claim('Atomic rollback claim.', addr_hex(reviewer), json.dumps(payload))
    assert sg.get_config()['claim_count'] == 0

    # Exact same claim text must still be creatable, proving claim_text_index rolled back.
    sg.create_claim(
        'Atomic rollback claim.',
        addr_hex(reviewer),
        json.dumps([source('Replacement valid source', 'Origin C', 'rollback-c')]),
    )
    assert sg.get_config()['claim_count'] == 1


def test_typed_reuse_count_rolls_back_if_later_create_source_fails(sg, direct_vm, reviewer):
    sg.create_claim('Rollback upstream reusable claim.', addr_hex(reviewer), json.dumps(initial3()))
    attest_all3(sg, direct_vm, reviewer)
    judge_independent_matrix3(sg, direct_vm)
    sg.freeze_reuse_basis(1)
    assert sg.get_claim(1)['reuse_count'] == 0

    payload = [
        {
            'excerpt': '',
            'origin_label': '',
            'reference_url': '',
            'evidence_digest': '',
            'from_claim_id': 1,
        },
        {
            'excerpt': 'Later invalid external source',
            'origin_label': 'Broken',
            'reference_url': '',
            'evidence_digest': 'bad',
            'from_claim_id': 0,
        },
    ]
    with direct_vm.expect_revert():
        sg.create_claim('Downstream atomic rollback.', addr_hex(reviewer), json.dumps(payload))
    assert sg.get_config()['claim_count'] == 1
    assert sg.get_claim(1)['reuse_count'] == 0


def test_same_freeze_call_refused_before_gate_then_succeeds_after_gate(claim1, direct_vm, reviewer):
    attest_all3(claim1, direct_vm, reviewer)
    with direct_vm.expect_revert():
        claim1.freeze_reuse_basis(1)
    before = claim1.get_claim(1)
    assert before['basis_frozen'] is False
    assert before['reuse_ready'] is False

    judge_independent_matrix3(claim1, direct_vm)
    claim1.freeze_reuse_basis(1)
    after = claim1.get_claim(1)
    assert after['basis_frozen'] is True
    assert after['reuse_ready'] is True


def test_same_typed_reuse_call_refused_before_upstream_freeze_then_succeeds_after(sg, direct_vm, reviewer):
    sg.create_claim('Causal upstream claim.', addr_hex(reviewer), json.dumps(initial3()))
    attest_all3(sg, direct_vm, reviewer)
    judge_independent_matrix3(sg, direct_vm)
    sg.create_claim(
        'Causal downstream claim.',
        addr_hex(reviewer),
        json.dumps([source('Downstream starter', 'Starter', 'causal-starter')]),
    )
    with direct_vm.expect_revert():
        sg.add_reuse_claim_source(2, 1)
    assert sg.get_claim(2)['source_count'] == 1

    sg.freeze_reuse_basis(1)
    sg.add_reuse_claim_source(2, 1)
    typed = sg.get_source(2, 2)
    assert typed['kind'] == 'TYPED_CLAIM'
    assert typed['from_claim_id'] == 1
    assert sg.get_claim(1)['reuse_count'] == 1


def test_bool_ids_and_invalid_pagination_refused(claim1, direct_vm):
    for bad in (True, False, 0, -1):
        with direct_vm.expect_revert():
            claim1.get_claim(bad)
    with direct_vm.expect_revert():
        claim1.get_sources(1,0,10)
    with direct_vm.expect_revert():
        claim1.get_sources(1,1,0)
    with direct_vm.expect_revert():
        claim1.get_claim_pairs(1,0,10)
