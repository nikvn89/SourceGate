const FALLBACK_CONTRACT_ADDRESS =
  '0x09324215eEC452600F72Eb1D63ee6Bb48E92740f' as const

const envAddress = (import.meta.env.VITE_CONTRACT_ADDRESS ?? '').trim()

export const CONTRACT_ADDRESS =
  /^0x[a-fA-F0-9]{40}$/.test(envAddress)
    ? (envAddress as `0x${string}`)
    : FALLBACK_CONTRACT_ADDRESS

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
