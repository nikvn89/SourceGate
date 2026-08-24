export const CONTRACT_ADDRESS =
  (import.meta.env.VITE_CONTRACT_ADDRESS as `0x${string}` | undefined) ??
  '0xb5c2abA865EdfB9F25B44eaedf09BE02D32Fa49D'

export const EXPLORER_BASE = 'https://explorer-studio.genlayer.com'

export const PUBLIC_SAMPLE_CLAIM_ID = 1

export const DEMO_SOURCES = [
  {
    excerpt:
      "Harbor Rail's service notice says 24 weekend services were cancelled during May because of scheduled track work.",
    origin_label: 'Harbor Rail service notice',
  },
  {
    excerpt:
      'According to the operator notice, Harbor Rail cancelled two dozen weekend services in May while maintenance was underway.',
    origin_label: 'Local transport report',
  },
  {
    excerpt:
      'The regional transport authority monthly report records 23 cancelled Harbor Rail weekend services in May after infrastructure restrictions.',
    origin_label: 'Regional transport authority report',
  },
  {
    excerpt:
      'Harbor Rail quarterly accounts record passenger compensation and disruption costs associated with roughly two dozen May weekend cancellations.',
    origin_label: 'Quarterly financial report',
  },
]
