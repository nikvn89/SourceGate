import { createClient } from 'genlayer-js'
import { studionet } from 'genlayer-js/chains'
import { TransactionHashVariant, TransactionStatus } from 'genlayer-js/types'
import { CONTRACT_ADDRESS, EXPLORER_BASE } from './config'
import { errorCode, normalizeError } from './errors'
import type {
  Address,
  ClaimRecord,
  GateConfig,
  PairLookup,
  PairSummary,
  ReuseBasis,
  SourceRecord,
} from './types'

export type ConnectResult = { address: Address; warning?: string }
export type StateWaitResult<T> =
  | { status: 'confirmed'; value: T }
  | { status: 'pending'; lastValue?: T }

export interface WaitForStateChangeOptions<T> {
  read: () => Promise<T>
  isDone: (value: T) => boolean
  intervalMs?: number
  timeoutMs?: number
}

export const STUDIO_CHAIN_ID = 61999
export const STUDIO_CHAIN_ID_HEX = '0xf22f'

const STUDIO_CHAIN_PARAMS = {
  chainId: STUDIO_CHAIN_ID_HEX,
  chainName: 'Genlayer Studio Network',
  rpcUrls: ['https://studio.genlayer.com/api'],
  nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
  blockExplorerUrls: ['https://explorer-studio.genlayer.com'],
}

const RPC_URL = `${window.location.origin}/genlayer-rpc`
const rpcStudionet = {
  ...studionet,
  rpcUrls: {
    ...studionet.rpcUrls,
    default: { ...studionet.rpcUrls.default, http: [RPC_URL] as [string] },
  },
} as typeof studionet

const readClient = createClient({ chain: rpcStudionet })
const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

export async function waitForStateChange<T>({
  read,
  isDone,
  intervalMs = 4_000,
  timeoutMs = 180_000,
}: WaitForStateChangeOptions<T>): Promise<StateWaitResult<T>> {
  const startedAt = Date.now()
  let lastValue: T | undefined
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const value = await read()
      lastValue = value
      if (isDone(value)) return { status: 'confirmed', value }
    } catch {
      // StudioNet reads can lag writes while consensus/finalization completes.
    }
    await sleep(intervalMs)
  }
  return lastValue === undefined
    ? { status: 'pending' }
    : { status: 'pending', lastValue }
}

export async function ensureStudioChain(): Promise<void> {
  if (!window.ethereum) throw new Error('MetaMask is not installed.')
  const current = (await window.ethereum.request({ method: 'eth_chainId' })) as string
  if (current?.toLowerCase() === STUDIO_CHAIN_ID_HEX) return

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: STUDIO_CHAIN_ID_HEX }],
    })
    return
  } catch (switchError) {
    if (String(errorCode(switchError) ?? '') !== '4902') throw switchError
  }

  await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [STUDIO_CHAIN_PARAMS] })
  await window.ethereum.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: STUDIO_CHAIN_ID_HEX }],
  })
}

export async function connectWallet(): Promise<ConnectResult> {
  if (!window.ethereum) throw new Error('MetaMask is not installed.')
  const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[]
  if (!accounts?.[0]) throw new Error('No wallet account returned.')
  const address = accounts[0] as Address
  let warning: string | undefined
  try {
    await ensureStudioChain()
  } catch (chainError) {
    warning = `Connected, but MetaMask is not on GenLayer Studio yet: ${normalizeError(chainError).message}`
  }
  if (!warning) {
    try {
      const client = createClient({ chain: rpcStudionet, account: address, provider: window.ethereum })
      await client.connect('studionet')
    } catch {
      // Snap connection is optional; writes still use the injected provider path.
    }
  }
  return warning ? { address, warning } : { address }
}

function writeClient(account: Address) {
  if (!window.ethereum) throw new Error('MetaMask is not installed.')
  return createClient({ chain: rpcStudionet, account, provider: window.ethereum })
}

async function write(account: Address, functionName: string, args: any[]) {
  await ensureStudioChain()
  const client = writeClient(account)
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    value: 0n,
  })
  return { hash }
}

async function read<T>(functionName: string, args: any[]): Promise<T> {
  const value = await readClient.readContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
  })
  return value as T
}

export const getConfig = () => read<GateConfig>('get_config', [])
export const getClaim = (claimId: number) => read<ClaimRecord>('get_claim', [claimId])
export const getReuseBasis = (claimId: number) => read<ReuseBasis>('get_reuse_basis', [claimId])
export const getSources = (claimId: number, fromIndex = 1, count = 12) =>
  read<SourceRecord[]>('get_sources', [claimId, fromIndex, count])
export const getClaimPairs = (claimId: number, fromIndex = 1, count = 50) =>
  read<PairSummary[]>('get_claim_pairs', [claimId, fromIndex, count])
export const getPairBySources = (claimId: number, sourceA: number, sourceB: number) =>
  read<PairLookup>('get_pair_by_sources', [claimId, sourceA, sourceB])

export const createClaim = (account: Address, claimText: string, reviewer: string, sourcesJson: string) =>
  write(account, 'create_claim', [claimText, reviewer, sourcesJson])

export const addExternalSource = (
  account: Address,
  claimId: number,
  excerpt: string,
  originLabel: string,
  referenceUrl: string,
  evidenceDigest: string,
) => write(account, 'add_external_source', [claimId, excerpt, originLabel, referenceUrl, evidenceDigest])

export const addReuseClaimSource = (account: Address, claimId: number, fromClaimId: number) =>
  write(account, 'add_reuse_claim_source', [claimId, fromClaimId])

export const attestSource = (account: Address, claimId: number, sourceIndex: number, bindingHash: string) =>
  write(account, 'attest_source', [claimId, sourceIndex, bindingHash])

export const revokeSource = (account: Address, claimId: number, sourceIndex: number) =>
  write(account, 'revoke_source', [claimId, sourceIndex])

export const judgePair = (account: Address, claimId: number, sourceA: number, sourceB: number) =>
  write(account, 'judge_pair', [claimId, sourceA, sourceB])

export const freezeReuseBasis = (account: Address, claimId: number) =>
  write(account, 'freeze_reuse_basis', [claimId])

/* --------------------------------------------------- execution inspection */

const CONTRACT_ERRORS = [
  'Reviewer must be a different wallet',
  'Reviewer cannot be zero address',
  'Duplicate claim text',
  'At least one source is required',
  'Too many initial sources',
  'Only claim author may add sources',
  'Source claim is not REUSE_READY',
  'Source claim reuse basis is not frozen',
  'Source claim basis digest is unavailable',
  'Only claim reviewer may attest provenance',
  'Source binding hash mismatch',
  'Only claim reviewer may revoke provenance',
  'Judged source is locked and cannot be revoked',
  'Both sources must be reviewer-attested before pair judging',
  'Source pair is already judged',
  'Semantic evaluation ceiling reached',
  'Invalid consensus result',
  'Invalid consensus verdict',
  'Only claim author may freeze reuse basis',
  'Reusable provenance basis is already frozen',
  'Claim has a permanent derivative-history block',
  'Claim is not REUSE_READY',
  'Reusable provenance basis is frozen',
  'Registered claim text must use typed reuse path',
  'Duplicate source binding for this claim',
  'Source record limit reached',
  'Active source limit reached',
  'Source is already revoked',
  'Source cannot be revoked',
  'Source is not awaiting attestation',
  'Revoked source cannot be attested',
  'Pair contains a revoked source',
  'Source pair must contain two distinct sources',
  'Invalid source index',
  'Invalid claim id',
  'Invalid source claim id',
  'Claim cannot source itself',
  'Evidence digest cannot be zero',
  'Evidence digest must be 32-byte hex',
]

function collectStrings(value: unknown, out: string[], depth = 0): string[] {
  if (depth > 8 || out.length > 4000) return out
  if (typeof value === 'string') {
    out.push(value)
  } else if (Array.isArray(value)) {
    if (value.length && value.every((item) => typeof item === 'number')) {
      try { out.push(new TextDecoder().decode(Uint8Array.from(value as number[]))) } catch { /* not bytes */ }
    }
    value.forEach((item) => collectStrings(item, out, depth + 1))
  } else if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((item) => collectStrings(item, out, depth + 1))
  }
  return out
}

export function executionErrorDetail(receipt: unknown, fallback = '') {
  const haystack = collectStrings(receipt, [])
  for (const text of haystack) {
    for (const known of CONTRACT_ERRORS) {
      if (text.includes(known)) return known
    }
  }
  return fallback
}

export async function waitFinalized(txHash: `0x${string}`) {
  const receipt = await (readClient as any).waitForTransactionReceipt({
    hash: txHash,
    status: TransactionStatus.FINALIZED,
    interval: 5_000,
    retries: 240,
    fullTransaction: true,
  })
  let merged: any = receipt
  try {
    merged = { ...receipt, _transaction: await (readClient as any).getTransaction({ hash: txHash }) }
  } catch {
    /* receipt alone is sufficient for postcondition + contract-error inspection */
  }
  console.log('[SourceGate] finalized', txHash, merged)
  return merged
}

export function txExplorerUrl(hash: string) {
  return `${EXPLORER_BASE}/tx/${hash}`
}

