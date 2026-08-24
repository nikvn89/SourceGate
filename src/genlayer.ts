import { createClient } from 'genlayer-js'
import { studionet } from 'genlayer-js/chains'
import { CONTRACT_ADDRESS } from './config'
import { errorCode, normalizeError } from './errors'
import type {
  Address,
  ClaimRecord,
  GateConfig,
  PairLookup,
  PairSummary,
  SourceRecord,
} from './types'

export type ConnectResult = {
  address: Address
  warning?: string
}

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
    default: {
      ...studionet.rpcUrls.default,
      http: [RPC_URL] as [string],
    },
  },
} as typeof studionet

const readClient = createClient({ chain: rpcStudionet })

function normalize<T>(value: unknown): T {
  return value as T
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

export async function waitForStateChange<T>({
  read,
  isDone,
  intervalMs = 4_000,
  timeoutMs = 150_000,
}: WaitForStateChangeOptions<T>): Promise<StateWaitResult<T>> {
  const startedAt = Date.now()
  let lastValue: T | undefined

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const value = await read()
      lastValue = value
      if (isDone(value)) return { status: 'confirmed', value }
    } catch {
      // Reads can transiently fail while StudioNet is finalizing the write.
    }

    const remaining = timeoutMs - (Date.now() - startedAt)
    if (remaining <= 0) break
    await sleep(Math.min(intervalMs, remaining))
  }

  return {
    status: 'pending',
    ...(lastValue === undefined ? {} : { lastValue }),
  }
}

export async function ensureStudioChain(): Promise<void> {
  if (!window.ethereum) throw new Error('MetaMask is not installed.')

  const current = (await window.ethereum.request({
    method: 'eth_chainId',
  })) as string

  if (
    typeof current === 'string' &&
    current.toLowerCase() === STUDIO_CHAIN_ID_HEX
  ) {
    return
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: STUDIO_CHAIN_ID_HEX }],
    })
    return
  } catch (switchError) {
    if (String(errorCode(switchError) ?? '') !== '4902') throw switchError
  }

  await window.ethereum.request({
    method: 'wallet_addEthereumChain',
    params: [STUDIO_CHAIN_PARAMS],
  })

  await window.ethereum.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: STUDIO_CHAIN_ID_HEX }],
  })
}

export async function connectWallet(): Promise<ConnectResult> {
  if (!window.ethereum) throw new Error('MetaMask is not installed.')

  const accounts = (await window.ethereum.request({
    method: 'eth_requestAccounts',
  })) as string[]

  if (!accounts?.[0]) throw new Error('No wallet account returned.')

  const address = accounts[0] as Address
  let warning: string | undefined

  try {
    await ensureStudioChain()
  } catch (chainError) {
    warning = `Connected, but MetaMask is not on GenLayer Studio yet: ${
      normalizeError(chainError).message
    }`
  }

  if (warning === undefined) {
    try {
      const client = createClient({
        chain: rpcStudionet,
        account: address,
        provider: window.ethereum,
      })
      await client.connect('studionet')
    } catch {
      // Optional Snap step only.
    }
  }

  return warning === undefined ? { address } : { address, warning }
}

function writeClient(account: Address) {
  if (!window.ethereum) throw new Error('MetaMask is not installed.')

  return createClient({
    chain: rpcStudionet,
    account,
    provider: window.ethereum,
  })
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
  })
  return normalize<T>(value)
}

export const getConfig = () => read<GateConfig>('get_config', [])

export const getClaim = (claimId: number) =>
  read<ClaimRecord>('get_claim', [claimId])

export const getSources = (claimId: number, fromIndex = 1, count = 8) =>
  read<SourceRecord[]>('get_sources', [claimId, fromIndex, count])

export const getClaimPairs = (claimId: number, fromIndex = 1, count = 50) =>
  read<PairSummary[]>('get_claim_pairs', [claimId, fromIndex, count])

export const getPairBySources = (
  claimId: number,
  sourceA: number,
  sourceB: number,
) =>
  read<PairLookup>('get_pair_by_sources', [claimId, sourceA, sourceB])

export const createClaim = (
  account: Address,
  claimText: string,
  sourcesJson: string,
) =>
  write(account, 'create_claim', [claimText, sourcesJson])

export const addExternalSource = (
  account: Address,
  claimId: number,
  excerpt: string,
  originLabel: string,
  referenceUrl: string,
) =>
  write(account, 'add_external_source', [
    claimId,
    excerpt,
    originLabel,
    referenceUrl,
  ])

export const addVerifiedClaimSource = (
  account: Address,
  claimId: number,
  fromClaimId: number,
) =>
  write(account, 'add_verified_claim_source', [claimId, fromClaimId])

export const judgePair = (
  account: Address,
  claimId: number,
  sourceA: number,
  sourceB: number,
) =>
  write(account, 'judge_pair', [claimId, sourceA, sourceB])
