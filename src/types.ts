export type Address = `0x${string}`

export type Verdict =
  | 'INDEPENDENT_CORROBORATION'
  | 'DERIVATIVE_SOURCE_CLUSTER'
  | ''

export interface GateConfig {
  name: string
  version: string
  semantic_verdicts: string[]
  required_independent_pairs: number
  required_distinct_independent_sources: number
  max_sources_per_claim: number
  max_source_excerpt_length: number
  urls_enter_consensus_prompt: boolean
  public_pair_judging: boolean
  sources_append_only_after_verification: boolean
  global_admin: boolean
  clock_used: boolean
  claim_count: number
  pair_count: number
}

export interface ClaimRecord {
  claim_id: number
  author: string
  text: string
  required_pairs: number
  required_distinct_sources: number
  independent_pairs: number
  distinct_independent_sources: number
  derivative_pairs: number
  source_count: number
  pair_count: number
  verified: boolean
}

export interface SourceRecord {
  claim_id: number
  source_index: number
  excerpt: string
  origin_label: string
  reference_url: string
  from_claim_id: number
}

export interface PairSummary {
  claim_pair_index: number
  pair_id: number
  source_a: number
  source_b: number
  verdict: Verdict
  used_cache: boolean
}

export interface PairLookup {
  judged: boolean
  pair_id: number
  verdict: Verdict
  used_cache: boolean
}

export interface DraftSource {
  excerpt: string
  origin_label: string
  reference_url: string
}
