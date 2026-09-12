export type Address = `0x${string}`

export type Verdict =
  | 'INDEPENDENT_CORROBORATION'
  | 'DERIVATIVE_SOURCE_CLUSTER'
  | ''

export type ProvenanceState = 'PROPOSED' | 'ATTESTED' | 'REVOKED'
export type SourceKind = 'EXTERNAL' | 'TYPED_CLAIM'

export interface GateConfig {
  name: string
  version: string
  semantic_verdicts: string[]
  reviewer_required: boolean
  reviewer_must_differ_from_author: boolean
  external_source_attestation_required: boolean
  evidence_digest_is_binding_not_external_verification: boolean
  attested_provenance_metadata_enters_consensus_prompt: boolean
  urls_fetched: boolean
  complete_active_pair_matrix_required: boolean
  first_judgment_seals_active_basis: boolean
  source_mutation_after_adjudication_blocked: boolean
  freeze_rechecks_sealed_basis_digest: boolean
  derivative_active_pair_blocks_typed_reuse: boolean
  historical_derivative_blocks_freeze: boolean
  judged_source_revocation_blocked: boolean
  unjudged_active_pair_blocks_typed_reuse: boolean
  typed_reuse_requires_frozen_basis: boolean
  reuse_ready_is_recomputable_before_freeze: boolean
  min_active_sources_for_reuse: number
  max_active_sources_per_claim: number
  max_source_records_per_claim: number
  max_fresh_semantic_evals_per_claim: number
  public_pair_judging: boolean
  global_admin: boolean
  clock_used: boolean
  claim_count: number
  pair_count: number
}

export interface ClaimRecord {
  claim_id: number
  author: string
  reviewer: string
  text: string
  source_count: number
  active_source_count: number
  attested_active_source_count: number
  pair_count: number
  historical_independent_pairs: number
  historical_derivative_pairs: number
  active_pair_target: number
  judged_active_pairs: number
  independent_active_pairs: number
  derivative_active_pairs: number
  unjudged_active_pairs: number
  semantic_eval_count: number
  reuse_ready: boolean
  basis_frozen: boolean
  basis_digest: string
  frozen_active_source_count: number
  frozen_pair_count: number
  reuse_count: number
  adjudication_started: boolean
  adjudication_basis_digest: string
  derivative_history_blocked: boolean
}

export interface ReuseBasis {
  claim_id: number
  reuse_ready: boolean
  basis_frozen: boolean
  basis_digest: string
  adjudication_started: boolean
  adjudication_basis_digest: string
  derivative_history_blocked: boolean
  active_source_count: number
  attested_active_source_count: number
  required_pair_count: number
  judged_active_pairs: number
  independent_active_pairs: number
  derivative_active_pairs: number
  unjudged_active_pairs: number
}

export interface SourceRecord {
  source_index: number
  excerpt: string
  origin_label: string
  reference_url: string
  evidence_digest: string
  binding_hash: string
  from_claim_id: number
  kind: SourceKind
  provenance_state: ProvenanceState
  active: boolean
  attested_by: string
  judgment_locked: boolean
}

export interface PairSummary {
  claim_pair_index: number
  pair_id: number
  source_a: number
  source_b: number
  verdict: Verdict
  semantic_eval_used: boolean
}

export interface PairLookup {
  judged: boolean
  pair_id: number
  verdict: Verdict
  semantic_eval_used: boolean
}

export interface DraftSource {
  excerpt: string
  origin_label: string
  reference_url: string
  evidence_digest: string
}
