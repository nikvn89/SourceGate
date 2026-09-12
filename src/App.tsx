import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addExternalSource,
  addReuseClaimSource,
  attestSource,
  connectWallet,
  createClaim,
  freezeReuseBasis,
  getClaim,
  getClaimPairs,
  getConfig,
  getPairBySources,
  getReuseBasis,
  getSources,
  judgePair,
  revokeSource,
  waitForStateChange,
  waitFinalized,
  executionErrorDetail,
  txExplorerUrl,
} from './genlayer'
import {
  CONTRACT_ADDRESS,
  EXPLORER_BASE,
  EXPECTED_CONTRACT_VERSION,
  FROZEN_SOURCE_SHA256,
  RUNTIME_EVIDENCE_ADDRESS,
} from './config'
import { reportError } from './errors'
import type {
  Address,
  ClaimRecord,
  DraftSource,
  GateConfig,
  PairSummary,
  ReuseBasis,
  SourceRecord,
} from './types'

type Tab = 'overview' | 'provenance' | 'matrix'
type ActionPhase = 'idle' | 'submitted' | 'confirmed' | 'error'
type ActionState = { phase: ActionPhase; label: string; hash?: string; message?: string }

const LAST_CLAIM_KEY = `sourcegate:v2.1:last-claim:${CONTRACT_ADDRESS.toLowerCase()}`
const ZERO64 = '0'.repeat(64)

const shortAddress = (value: string) => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '—'
const shortHash = (value: string) => value ? `${value.slice(0, 10)}…${value.slice(-8)}` : '—'
const pairKey = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`
const cleanHex64 = (value: string) => value.trim().toLowerCase().replace(/^0x/, '')
const validDigest = (value: string) => /^[0-9a-f]{64}$/.test(cleanHex64(value)) && cleanHex64(value) !== ZERO64
const validAddress = (value: string) => /^0x[0-9a-fA-F]{40}$/.test(value.trim())

function safeHttpUrl(raw: string): string | null {
  if (!raw.trim()) return null
  try {
    const url = new URL(raw.trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function draftSources(): DraftSource[] {
  return Array.from({ length: 3 }, () => ({ excerpt: '', origin_label: '', reference_url: '', evidence_digest: '' }))
}

async function confirmAfterFinalization<T>(
  hash: string,
  read: () => Promise<T>,
  isDone: (value: T) => boolean,
  fallback: string,
  timeoutMs = 60_000,
): Promise<T> {
  const receipt = await waitFinalized(hash as `0x${string}`)
  const result = await waitForStateChange({ read, isDone, timeoutMs })
  if (result.status === 'confirmed') return result.value
  throw new Error(executionErrorDetail(receipt, fallback))
}

function SourceGateLogo() {
  return <img className="project-logo" src="/sourcegate-logo.svg" alt="SourceGate" />
}

function statusClass(source: SourceRecord) {
  if (source.provenance_state === 'ATTESTED') return 'status-pill verified'
  if (source.provenance_state === 'REVOKED') return 'status-pill revoked'
  return 'status-pill building'
}

export default function App() {
  const [tab, setTab] = useState<Tab>('overview')
  const [account, setAccount] = useState<Address | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [config, setConfig] = useState<GateConfig | null>(null)
  const [claim, setClaim] = useState<ClaimRecord | null>(null)
  const [basis, setBasis] = useState<ReuseBasis | null>(null)
  const [sources, setSources] = useState<SourceRecord[]>([])
  const [pairs, setPairs] = useState<PairSummary[]>([])
  const [claimInput, setClaimInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [action, setAction] = useState<ActionState>({ phase: 'idle', label: 'Ready' })

  const [draftClaim, setDraftClaim] = useState('')
  const [draftReviewer, setDraftReviewer] = useState('')
  const [drafts, setDrafts] = useState<DraftSource[]>(draftSources)

  const [newExcerpt, setNewExcerpt] = useState('')
  const [newOrigin, setNewOrigin] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newDigest, setNewDigest] = useState('')
  const [fromClaimId, setFromClaimId] = useState('')

  const busy = action.phase === 'submitted'
  const isAuthor = !!account && !!claim && account.toLowerCase() === claim.author.toLowerCase()
  const isReviewer = !!account && !!claim && account.toLowerCase() === claim.reviewer.toLowerCase()
  const role = isAuthor ? 'AUTHOR' : isReviewer ? 'REVIEWER' : account ? 'PUBLIC' : 'DISCONNECTED'

  const refreshClaim = useCallback(async (id: number) => {
    setLoading(true)
    setError('')
    try {
      const maxSources = config?.max_source_records_per_claim ?? 12
      const nextClaim = await getClaim(id)
      const [nextBasis, nextSources] = await Promise.all([
        getReuseBasis(id),
        getSources(id, 1, maxSources),
      ])

      const nextPairs: PairSummary[] = []
      let fromIndex = 1
      while (fromIndex <= nextClaim.pair_count) {
        const remaining = nextClaim.pair_count - fromIndex + 1
        const page = await getClaimPairs(id, fromIndex, Math.min(50, remaining))
        if (page.length === 0) throw new Error('Pair-history pagination ended before pair_count.')
        nextPairs.push(...page)
        fromIndex += page.length
      }
      if (nextPairs.length !== nextClaim.pair_count) {
        throw new Error(`Pair-history mismatch: expected ${nextClaim.pair_count}, loaded ${nextPairs.length}.`)
      }

      setClaim(nextClaim)
      setBasis(nextBasis)
      setSources(nextSources)
      setPairs([...nextPairs].reverse())
      setClaimInput(String(id))
      window.localStorage.setItem(LAST_CLAIM_KEY, String(id))
    } catch (raw) {
      setError(reportError('load claim', raw))
    } finally {
      setLoading(false)
    }
  }, [config?.max_source_records_per_claim])

  const refreshConfig = useCallback(async () => {
    const next = await getConfig()
    if (next.version !== EXPECTED_CONTRACT_VERSION) {
      throw new Error(`Contract version mismatch: expected ${EXPECTED_CONTRACT_VERSION}, got ${next.version}`)
    }
    setConfig(next)
    return next
  }, [])

  useEffect(() => {
    void refreshConfig().catch((raw) => setError(reportError('load contract config', raw)))
  }, [refreshConfig])

  useEffect(() => {
    if (!config) return
    const saved = Number(window.localStorage.getItem(LAST_CLAIM_KEY) ?? '0')
    if (Number.isInteger(saved) && saved > 0 && saved <= config.claim_count) void refreshClaim(saved)
  }, [config, refreshClaim])

  useEffect(() => {
    if (!window.ethereum) return
    const onAccounts = (accounts: string[]) => setAccount(accounts?.[0] ? accounts[0] as Address : null)
    const onChain = () => window.location.reload()
    window.ethereum.on?.('accountsChanged', onAccounts)
    window.ethereum.on?.('chainChanged', onChain)
    return () => {
      window.ethereum.removeListener?.('accountsChanged', onAccounts)
      window.ethereum.removeListener?.('chainChanged', onChain)
    }
  }, [])

  const pairMap = useMemo(() => new Map(pairs.map((pair) => [pairKey(pair.source_a, pair.source_b), pair])), [pairs])
  const activePairs = useMemo(() => {
    const active = sources.filter((source) => source.active)
    const result: Array<{ a: SourceRecord; b: SourceRecord; pair?: PairSummary }> = []
    for (let i = 0; i < active.length; i += 1) {
      for (let j = i + 1; j < active.length; j += 1) {
        result.push({ a: active[i], b: active[j], pair: pairMap.get(pairKey(active[i].source_index, active[j].source_index)) })
      }
    }
    return result
  }, [sources, pairMap])

  const onConnect = async () => {
    setConnecting(true)
    setError('')
    try {
      const result = await connectWallet()
      setAccount(result.address)
      if (result.warning) setError(result.warning)
    } catch (raw) {
      setError(reportError('connect wallet', raw))
    } finally {
      setConnecting(false)
    }
  }

  const submitted = (label: string, hash: string) => setAction({ phase: 'submitted', label, hash })
  const confirmed = (label: string, hash?: string) => setAction({ phase: 'confirmed', label, hash })
  const fail = (context: string, raw: unknown) => {
    const message = reportError(context, raw)
    setError(message)
    setAction({ phase: 'error', label: 'Action failed', message })
  }

  const onLoadClaim = async () => {
    const id = Number(claimInput)
    if (!Number.isInteger(id) || id <= 0) return setError('Enter a valid claim id.')
    setAction({ phase: 'idle', label: 'Ready' })
    await refreshClaim(id)
  }

  const onCreateClaim = async () => {
    if (!account) return setError('Connect MetaMask first.')
    const text = draftClaim.trim()
    const reviewer = draftReviewer.trim()
    if (!text) return setError('Claim text is required.')
    if (!validAddress(reviewer)) return setError('Reviewer must be a valid 0x address.')
    if (reviewer.toLowerCase() === account.toLowerCase()) return setError('Reviewer must be a different wallet.')

    const usable = drafts.filter((item) => item.excerpt.trim())
    if (usable.length === 0) return setError('Add at least one source bundle.')
    if (usable.some((item) => !validDigest(item.evidence_digest))) {
      return setError('Every external source needs a non-zero 32-byte SHA-256 evidence digest.')
    }

    setError('')
    try {
      const before = await refreshConfig()
      const payload = usable.map((item) => ({
        excerpt: item.excerpt.trim(),
        origin_label: item.origin_label.trim() || 'Source',
        reference_url: item.reference_url.trim(),
        evidence_digest: cleanHex64(item.evidence_digest),
        from_claim_id: 0,
      }))
      const { hash } = await createClaim(account, text, reviewer, JSON.stringify(payload))
      submitted('Claim submitted — verifying on-chain state…', hash)

      const createdId = await confirmAfterFinalization<number>(
        hash,
        async () => {
          const cfg = await refreshConfig()
          for (let id = before.claim_count + 1; id <= cfg.claim_count; id += 1) {
            try {
              const candidate = await getClaim(id)
              if (
                candidate.text === text &&
                candidate.author.toLowerCase() === account.toLowerCase() &&
                candidate.reviewer.toLowerCase() === reviewer.toLowerCase()
              ) return id
            } catch { /* finalized read may still be indexing */ }
          }
          return 0
        },
        (id) => id > 0,
        'Claim creation postcondition was not observed after finalization.',
      )

      await refreshClaim(createdId)
      confirmed(`Claim #${createdId} created ✓`, hash)
      setDraftClaim('')
      setDraftReviewer('')
      setDrafts(draftSources())
      setTab('provenance')
    } catch (raw) { fail('create claim', raw) }
  }

  const onAddExternal = async () => {
    if (!account || !claim) return setError('Connect MetaMask and load a claim first.')
    if (!newExcerpt.trim()) return setError('Excerpt is required.')
    if (!validDigest(newDigest)) return setError('Evidence digest must be a non-zero 32-byte SHA-256 hex value.')
    try {
      const before = claim.source_count
      const { hash } = await addExternalSource(account, claim.claim_id, newExcerpt.trim(), newOrigin.trim() || 'Source', newUrl.trim(), cleanHex64(newDigest))
      submitted('External source submitted — verifying source count…', hash)
      await confirmAfterFinalization<ClaimRecord>(
        hash,
        () => getClaim(claim.claim_id),
        (value) => value.source_count === before + 1,
        'External-source postcondition was not observed after finalization.',
      )
      await refreshClaim(claim.claim_id)
      confirmed('External source added ✓', hash)
      setNewExcerpt(''); setNewOrigin(''); setNewUrl(''); setNewDigest('')
    } catch (raw) { fail('add external source', raw) }
  }

  const onAddReuse = async () => {
    if (!account || !claim) return setError('Connect MetaMask and load a claim first.')
    const fromId = Number(fromClaimId)
    if (!Number.isInteger(fromId) || fromId <= 0) return setError('Enter a valid reusable claim id.')
    try {
      const before = claim.source_count
      const { hash } = await addReuseClaimSource(account, claim.claim_id, fromId)
      submitted('Typed reuse source submitted — verifying lineage…', hash)
      await confirmAfterFinalization<SourceRecord[]>(
        hash,
        () => getSources(claim.claim_id, 1, config?.max_source_records_per_claim ?? 12),
        (value) => value.length === before + 1 && value.some((source) => source.from_claim_id === fromId),
        'Typed-reuse lineage postcondition was not observed after finalization.',
      )
      await refreshClaim(claim.claim_id)
      confirmed(`Frozen claim #${fromId} added as typed source ✓`, hash)
      setFromClaimId('')
    } catch (raw) { fail('add typed reuse source', raw) }
  }

  const onAttest = async (source: SourceRecord) => {
    if (!account || !claim) return setError('Connect MetaMask and load a claim first.')
    try {
      const { hash } = await attestSource(account, claim.claim_id, source.source_index, source.binding_hash)
      submitted(`Attesting source S${source.source_index}…`, hash)
      await confirmAfterFinalization<SourceRecord[]>(
        hash,
        () => getSources(claim.claim_id, 1, config?.max_source_records_per_claim ?? 12),
        (value) => value.some((item) => item.source_index === source.source_index && item.provenance_state === 'ATTESTED' && item.active),
        'Attestation postcondition was not observed after finalization.',
      )
      await refreshClaim(claim.claim_id)
      confirmed(`Source S${source.source_index} attested ✓`, hash)
    } catch (raw) { fail('attest source', raw) }
  }

  const onRevoke = async (source: SourceRecord) => {
    if (!account || !claim) return setError('Connect MetaMask and load a claim first.')
    try {
      const { hash } = await revokeSource(account, claim.claim_id, source.source_index)
      submitted(`Revoking source S${source.source_index}…`, hash)
      await confirmAfterFinalization<SourceRecord[]>(
        hash,
        () => getSources(claim.claim_id, 1, config?.max_source_records_per_claim ?? 12),
        (value) => value.some((item) => item.source_index === source.source_index && item.provenance_state === 'REVOKED' && !item.active),
        'Revocation postcondition was not observed after finalization.',
      )
      await refreshClaim(claim.claim_id)
      confirmed(`Source S${source.source_index} revoked ✓`, hash)
    } catch (raw) { fail('revoke source', raw) }
  }

  const onJudge = async (a: number, b: number) => {
    if (!account || !claim) return setError('Connect MetaMask first.')
    try {
      const { hash } = await judgePair(account, claim.claim_id, a, b)
      submitted(`Judging S${a} ↔ S${b} — waiting for semantic result…`, hash)
      const pairResult = await confirmAfterFinalization(
        hash,
        () => getPairBySources(claim.claim_id, a, b),
        (value) => value.judged,
        'Pair verdict postcondition was not observed after finalization.',
        90_000,
      )
      await refreshClaim(claim.claim_id)
      confirmed(`Pair S${a} ↔ S${b}: ${pairResult.verdict} ✓`, hash)
    } catch (raw) { fail('judge pair', raw) }
  }

  const onFreeze = async () => {
    if (!account || !claim) return setError('Connect MetaMask and load a claim first.')
    try {
      const { hash } = await freezeReuseBasis(account, claim.claim_id)
      submitted('Freezing complete provenance basis…', hash)
      await confirmAfterFinalization<ClaimRecord>(
        hash,
        () => getClaim(claim.claim_id),
        (value) => value.basis_frozen && value.reuse_ready && !!value.basis_digest,
        'Freeze postcondition was not observed after finalization.',
      )
      await refreshClaim(claim.claim_id)
      confirmed('Reusable provenance basis frozen ✓', hash)
    } catch (raw) { fail('freeze reuse basis', raw) }
  }

  const completenessPct = claim && claim.active_pair_target > 0
    ? Math.min(100, Math.round((claim.judged_active_pairs / claim.active_pair_target) * 100))
    : 0

  return (
    <div className="portal-shell">
      <aside className="portal-sidebar">
        <div className="portal-brand"><SourceGateLogo /><div className="portal-brand-copy"><strong>SourceGate</strong><span>Reviewer-attested provenance · v2.1</span></div></div>
        <div className="sidebar-section">
          <span className="sidebar-kicker">Workspace</span>
          <nav className="portal-nav">
            <button className={`portal-nav-item ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}><span className="nav-icon">⌂</span><span className="nav-label"><strong>Overview</strong><small>Claim + readiness</small></span></button>
            <button className={`portal-nav-item ${tab === 'provenance' ? 'active' : ''}`} onClick={() => setTab('provenance')}><span className="nav-icon">◆</span><span className="nav-label"><strong>Provenance</strong><small>Attest + revoke</small></span><span className="nav-count">{sources.length}</span></button>
            <button className={`portal-nav-item ${tab === 'matrix' ? 'active' : ''}`} onClick={() => setTab('matrix')}><span className="nav-icon">⌗</span><span className="nav-label"><strong>Pair matrix</strong><small>Complete all active pairs</small></span><span className="nav-count">{claim?.unjudged_active_pairs ?? 0}</span></button>
          </nav>
        </div>
        <div className="sidebar-section network-section"><span className="sidebar-kicker">Network</span><div className="network-row"><i className="network-dot" />StudioNet <small>61999</small></div><a className="sidebar-link" href={`${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer"><span>Explorer</span><strong>{shortAddress(CONTRACT_ADDRESS)} ↗</strong></a></div>
        {claim && <div className="sidebar-claim-card"><div className="sidebar-claim-top"><span>CLAIM #{claim.claim_id}</span><span className={claim.basis_frozen ? 'status-pill verified' : claim.reuse_ready ? 'status-pill ready' : 'status-pill building'}>{claim.basis_frozen ? 'FROZEN' : claim.reuse_ready ? 'READY' : 'OPEN'}</span></div><strong>{claim.active_source_count} active sources</strong><p>{claim.text}</p><div className="claim-progress"><div style={{ width: `${completenessPct}%` }} /></div><small>{claim.judged_active_pairs}/{claim.active_pair_target} active pairs judged</small></div>}
        <div className="sidebar-footer"><img src="/genlayer-logo.png" alt="GenLayer" /><div><strong>GenLayer</strong><span>Semantic consensus + deterministic gates</span></div></div>
      </aside>

      <section className="portal-page">
        <header className="portal-topbar">
          <div className="topbar-title"><span>SourceIndependenceGate · StudioNet</span><strong>{claim ? `Claim #${claim.claim_id}` : 'Reviewer-attested provenance gate'}</strong></div>
          <div className="topbar-actions"><span className="top-chip"><i />v{config?.version ?? EXPECTED_CONTRACT_VERSION} · {role}</span><button className="connect-button" onClick={onConnect} disabled={connecting}>{account ? shortAddress(account) : connecting ? 'Connecting…' : 'Connect Wallet'}</button></div>
        </header>

        <main className="portal-content">
          <section className="portal-hero">
            <div className="hero-copy-v4"><span className="hero-chip">REVIEWER-ATTESTED PROVENANCE · COMPLETE MATRIX</span><h1>Reuse only after the whole basis clears.</h1><p>SourceGate v2 separates author registration, reviewer provenance attestation, semantic pair independence, and deterministic typed-reuse authorization. One unjudged or derivative active pair blocks reuse.</p><div className="hero-facts"><span><b>3+</b> active sources</span><span><b>100%</b> active pairs judged</span><span><b>0</b> derivative active pairs</span><span><b>1</b> explicit freeze</span></div></div>
            <div className="hero-claim-card"><div className="hero-claim-top"><span>{claim ? `CLAIM #${claim.claim_id}` : 'NO CLAIM LOADED'}</span><span className={claim?.basis_frozen ? 'status-pill verified' : claim?.reuse_ready ? 'status-pill ready' : 'status-pill building'}>{claim?.basis_frozen ? 'FROZEN' : claim?.reuse_ready ? 'REUSE_READY' : 'NOT READY'}</span></div><strong>{claim ? `${claim.attested_active_source_count}/${claim.active_source_count} attested` : 'Load or create a claim'}</strong><p>{claim?.text ?? 'The frontend never treats transaction finalization alone as proof. Every write waits for the required contract postcondition.'}</p><div className="hero-claim-metrics"><span>Pairs <b>{claim?.judged_active_pairs ?? 0}/{claim?.active_pair_target ?? 0}</b></span><span>Semantic evals <b>{claim?.semantic_eval_count ?? 0}</b></span><span>Reuse <b>{claim?.reuse_count ?? 0}</b></span></div></div>
          </section>

          <div className="claim-strip-v4"><div><span className="section-eyebrow">OPEN CLAIM</span><strong>{claim ? `#${claim.claim_id}` : '—'}</strong><p>{claim ? shortHash(claim.basis_digest || 'unfrozen') : 'Load an existing claim id.'}</p></div><div className="claim-strip-right"><input value={claimInput} onChange={(e) => setClaimInput(e.target.value)} placeholder="Claim ID" inputMode="numeric" /><button className="soft-button" onClick={onLoadClaim} disabled={loading}>Load</button><button className="soft-button" onClick={() => claim && refreshClaim(claim.claim_id)} disabled={!claim || loading}>Refresh</button></div></div>

          {action.phase !== 'idle' && <div className={`activity-banner ${action.phase}`}><span className="activity-dot" /><strong>{action.label}</strong>{action.message && <span>{action.message}</span>}{action.hash && <a href={txExplorerUrl(action.hash)} target="_blank" rel="noreferrer" title={action.hash}>{shortHash(action.hash)} ↗</a>}</div>}
          {error && <div className="error-banner-v4"><span>!</span><strong>{error}</strong><button onClick={() => setError('')}>×</button></div>}

          {tab === 'overview' && <div className="page-stack">
            <section className="metric-row-v4">
              <article className="metric-v4"><span>ACTIVE SOURCES</span><strong>{claim?.active_source_count ?? 0}</strong><small>minimum {config?.min_active_sources_for_reuse ?? 3} for reuse</small></article>
              <article className="metric-v4"><span>ATTESTED ACTIVE</span><strong>{claim?.attested_active_source_count ?? 0}</strong><small>reviewer-bound provenance</small></article>
              <article className="metric-v4"><span>UNJUDGED ACTIVE PAIRS</span><strong>{claim?.unjudged_active_pairs ?? 0}</strong><small>must reach zero</small></article>
              <article className="metric-v4"><span>DERIVATIVE ACTIVE PAIRS</span><strong>{claim?.derivative_active_pairs ?? 0}</strong><small>any one blocks typed reuse</small></article>
            </section>

            <section className="overview-workspace-grid">
              <article className="surface-card">
                <div className="surface-head"><div><span className="section-eyebrow">CREATE</span><h2>New claim + immutable reviewer</h2></div><span className="version-badge">v2.1</span></div>
                <p className="surface-note">Author registers source metadata/digests. The distinct reviewer later attests the exact binding hash after off-chain provenance verification.</p>
                <label>CLAIM TEXT</label><textarea rows={3} value={draftClaim} onChange={(e) => setDraftClaim(e.target.value)} placeholder="State the claim being corroborated." />
                <label>REVIEWER WALLET · MUST DIFFER FROM AUTHOR</label><input value={draftReviewer} onChange={(e) => setDraftReviewer(e.target.value)} placeholder="0x…" />
                <div className="draft-grid-v4">{drafts.map((source, index) => <div className="draft-mini-card" key={index}><div className="draft-mini-head"><span>S{index + 1}</span><strong>EXTERNAL SOURCE BUNDLE</strong></div><textarea rows={3} value={source.excerpt} onChange={(e) => setDrafts((all) => all.map((item, i) => i === index ? { ...item, excerpt: e.target.value } : item))} placeholder="Source excerpt" /><input value={source.origin_label} onChange={(e) => setDrafts((all) => all.map((item, i) => i === index ? { ...item, origin_label: e.target.value } : item))} placeholder="Origin label" /><input value={source.reference_url} onChange={(e) => setDrafts((all) => all.map((item, i) => i === index ? { ...item, reference_url: e.target.value } : item))} placeholder="Reference locator / URL" /><input value={source.evidence_digest} onChange={(e) => setDrafts((all) => all.map((item, i) => i === index ? { ...item, evidence_digest: e.target.value } : item))} placeholder="SHA-256 evidence digest (64 hex)" /></div>)}</div>
                <button className="primary-action" onClick={onCreateClaim} disabled={!account || busy}>Create Claim</button>
              </article>

              <div className="overview-side-stack">
                <article className="surface-card"><div className="surface-head"><div><span className="section-eyebrow">REUSE GATE</span><h2>{claim?.basis_frozen ? 'Frozen & reusable' : claim?.reuse_ready ? 'Ready to freeze' : 'Basis incomplete'}</h2></div></div><div className="config-list-v4"><div><span>All active sources attested</span><strong>{claim && claim.active_source_count === claim.attested_active_source_count ? 'YES' : 'NO'}</strong></div><div><span>Minimum active sources</span><strong>{claim && claim.active_source_count >= (config?.min_active_sources_for_reuse ?? 3) ? 'PASS' : 'BLOCK'}</strong></div><div><span>Adjudication basis sealed</span><strong>{claim?.adjudication_started ? 'YES' : 'NO'}</strong></div><div><span>All active pairs judged</span><strong>{claim?.unjudged_active_pairs === 0 && (claim?.active_pair_target ?? 0) > 0 ? 'PASS' : 'BLOCK'}</strong></div><div><span>No derivative active pair</span><strong>{claim?.derivative_active_pairs === 0 ? 'PASS' : 'BLOCK'}</strong></div><div><span>No derivative history</span><strong>{claim?.derivative_history_blocked ? 'BLOCK' : 'PASS'}</strong></div><div><span>Basis frozen</span><strong>{claim?.basis_frozen ? 'YES' : 'NO'}</strong></div></div>{claim && !claim.basis_frozen && <button className="primary-action" onClick={onFreeze} disabled={!account || busy}>{isAuthor && claim.reuse_ready && !claim.derivative_history_blocked ? 'Freeze Reuse Basis' : 'Attempt Freeze · Expected Refusal'}</button>}<div className="info-callout">Evidence digests bind registered metadata; the contract does not fetch URLs or prove external truth. The contract proves only that the designated reviewer address attested the exact binding; it does not prove real-world reviewer identity or external truth.</div></article>
                <article className="surface-card"><div className="surface-head"><div><span className="section-eyebrow">DEPLOYMENT</span><h2>Frozen source parity</h2></div></div><div className="config-list-v4"><div><span>Contract</span><strong>{shortAddress(CONTRACT_ADDRESS)}</strong></div><div><span>Version</span><strong>{config?.version ?? EXPECTED_CONTRACT_VERSION}</strong></div><div><span>Runtime evidence</span><strong>{shortAddress(RUNTIME_EVIDENCE_ADDRESS)}</strong></div><div><span>SHA-256</span><strong title={FROZEN_SOURCE_SHA256}>{shortHash(FROZEN_SOURCE_SHA256)}</strong></div></div></article>
              </div>
            </section>

            <section className="flow-row-v4"><article><span>01</span><strong>Register</strong><p>Author commits source bundle + evidence digest.</p></article><article><span>02</span><strong>Attest</strong><p>Distinct reviewer address attests the exact immutable binding.</p></article><article><span>03</span><strong>Judge all pairs</strong><p>Complete matrix; one derivative blocks reuse.</p></article><article><span>04</span><strong>Freeze</strong><p>Author locks a complete REUSE_READY basis.</p></article></section>
          </div>}

          {tab === 'provenance' && <div className="page-stack">
            <div className="page-section-title"><div><span className="section-eyebrow">PROVENANCE REGISTRY</span><h2>Attest exact source bindings</h2><p>The contract enforces reviewer-only attestation. The UI permits wrong-wallet attempts so refusal can be proven on-chain.</p></div><span className="large-count">{claim ? `${claim.attested_active_source_count}/${claim.active_source_count} attested` : 'No claim'}</span></div>
            <section className="sources-layout-v4">
              <article className="surface-card source-registry-card"><div className="source-grid-v4">{sources.length === 0 ? <div className="empty-state-v4">Load a claim to inspect its provenance basis.</div> : sources.map((source) => <article className={`source-tile-v4 ${!source.active ? 'revoked-source' : ''}`} key={source.source_index}><div className="source-tile-top"><span>S{source.source_index}</span><div className="tile-badges"><b>{source.kind}</b><span className={statusClass(source)}>{source.provenance_state}</span>{claim?.adjudication_started && source.active && <span className="status-pill ready">BASIS-SEALED</span>}{source.judgment_locked && <span className="status-pill ready">JUDGMENT-LOCKED</span>}</div></div><p>{source.excerpt}</p><div className="binding-grid"><span>Binding <strong title={source.binding_hash}>{shortHash(source.binding_hash)}</strong></span><span>Evidence <strong title={source.evidence_digest}>{shortHash(source.evidence_digest)}</strong></span></div><footer><span>{source.origin_label}</span>{source.from_claim_id > 0 && <span>Claim #{source.from_claim_id}</span>}{source.reference_url && (() => { const href = safeHttpUrl(source.reference_url); return href ? <a href={href} target="_blank" rel="noreferrer noopener">reference ↗</a> : <span>locator stored</span> })()}</footer>{source.provenance_state === 'PROPOSED' && source.active && <button className="secondary-action full-width" onClick={() => onAttest(source)} disabled={!account || busy} title={isReviewer ? 'Reviewer attestation' : 'Expected on-chain refusal unless this wallet is the immutable reviewer'}>{isReviewer ? 'Attest Exact Binding' : 'Attempt Attestation · Expected Refusal'}</button>}{source.provenance_state === 'ATTESTED' && source.active && <button className="danger-action full-width" onClick={() => onRevoke(source)} disabled={!account || busy} title={source.judgment_locked ? 'Expected on-chain refusal: judged source is locked' : isReviewer ? 'Reviewer revocation before judgment' : 'Expected on-chain refusal unless this wallet is the immutable reviewer'}>{claim?.adjudication_started ? 'Attempt Revoke · Basis Sealed' : source.judgment_locked ? 'Attempt Revoke · Judgment-Locked' : isReviewer ? 'Revoke From Active Basis' : 'Attempt Revoke · Expected Refusal'}</button>}</article>)}</div></article>

              <div className="sources-actions-v4">
                <article className="surface-card"><div className="surface-head"><div><span className="section-eyebrow">AUTHOR</span><h2>Add external source</h2></div></div><label>EXCERPT</label><textarea rows={4} value={newExcerpt} onChange={(e) => setNewExcerpt(e.target.value)} /><label>ORIGIN LABEL</label><input value={newOrigin} onChange={(e) => setNewOrigin(e.target.value)} /><label>REFERENCE LOCATOR</label><input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://… or immutable locator" /><label>SHA-256 EVIDENCE DIGEST</label><input value={newDigest} onChange={(e) => setNewDigest(e.target.value)} placeholder="64 hex" /><p className="surface-note">Contract-enforced: only the Author may add sources. Wrong-wallet or frozen-basis attempts are intentionally sent and expected to be refused on-chain.</p><button className="primary-action" onClick={onAddExternal} disabled={!account || busy}>{isAuthor && !claim?.basis_frozen && !claim?.adjudication_started ? 'Add External Source' : 'Attempt Add Source · Expected Refusal'}</button></article>
                <article className="surface-card"><div className="surface-head"><div><span className="section-eyebrow">TYPED REUSE</span><h2>Add frozen claim source</h2></div></div><p className="surface-note">The source claim must already be REUSE_READY and frozen. The contract preserves explicit from_claim_id lineage. Wrong-wallet, pre-freeze, or frozen-target attempts may be sent to prove contract refusal.</p><label>FROM CLAIM ID</label><input value={fromClaimId} onChange={(e) => setFromClaimId(e.target.value)} inputMode="numeric" /><button className="secondary-action full-width" onClick={onAddReuse} disabled={!account || busy}>{isAuthor && !claim?.basis_frozen && !claim?.adjudication_started ? 'Add Reuse Claim Source' : 'Attempt Typed Reuse · Expected Refusal'}</button></article>
              </div>
            </section>
          </div>}

          {tab === 'matrix' && <div className="page-stack">
            <div className="page-section-title"><div><span className="section-eyebrow">COMPLETE ACTIVE PAIR MATRIX</span><h2>Every active pair must resolve</h2><p>Pair judging is public. The UI allows pre-attestation attempts so the contract itself can prove refusal; only active + reviewer-attested pairs can succeed.</p></div><span className="large-count">{claim?.judged_active_pairs ?? 0}/{claim?.active_pair_target ?? 0} judged</span></div>
            <section className="review-layout-v4">
              <article className="surface-card judge-panel-v4"><div className="matrix-list">{activePairs.length === 0 ? <div className="empty-state-v4">No active pair matrix yet.</div> : activePairs.map(({ a, b, pair }) => { const eligible = a.provenance_state === 'ATTESTED' && b.provenance_state === 'ATTESTED' && a.active && b.active && !claim?.basis_frozen; return <div className="matrix-row" key={pairKey(a.source_index, b.source_index)}><div><strong>S{a.source_index} ↔ S{b.source_index}</strong><small>{a.origin_label} · {b.origin_label}</small></div>{pair ? <span className={pair.verdict === 'INDEPENDENT_CORROBORATION' ? 'verdict-pill independent' : 'verdict-pill derivative'}>{pair.verdict === 'INDEPENDENT_CORROBORATION' ? 'INDEPENDENT' : 'DERIVATIVE'}</span> : <span className="verdict-pill unjudged">UNJUDGED</span>}<span className="mode-pill">{pair ? (pair.semantic_eval_used ? 'SEMANTIC' : 'DETERMINISTIC') : eligible ? 'ELIGIBLE' : 'BLOCKED'}</span>{!pair && <button className="soft-button" onClick={() => onJudge(a.source_index, b.source_index)} disabled={!account || busy}>{eligible ? 'Judge' : 'Attempt Judge · Expected Refusal'}</button>}</div> })}</div></article>
              <article className="surface-card gate-card-v4"><div className="gate-hero-v4"><span className={claim?.basis_frozen || claim?.reuse_ready ? 'gate-orb verified' : 'gate-orb'}>{claim?.basis_frozen ? '✓' : `${completenessPct}%`}</span><div><span className="section-eyebrow">REUSE GATE</span><h2>{claim?.basis_frozen ? 'Basis frozen' : claim?.reuse_ready ? 'REUSE_READY' : 'Blocked'}</h2><p>{claim?.basis_frozen ? 'Exact reusable basis is immutable.' : claim?.reuse_ready ? 'Author can freeze now.' : 'Complete reviewer attestation and pair matrix first.'}</p></div></div><div className="gate-list-v4"><div><span>Adjudication basis</span><strong>{basis?.adjudication_started ? 'SEALED' : 'OPEN'}</strong></div><div><span>Required active pairs</span><strong>{basis?.required_pair_count ?? 0}</strong></div><div><span>Judged active pairs</span><strong>{basis?.judged_active_pairs ?? 0}</strong></div><div><span>Independent active pairs</span><strong>{basis?.independent_active_pairs ?? 0}</strong></div><div><span>Derivative active pairs</span><strong>{basis?.derivative_active_pairs ?? 0}</strong></div><div><span>Derivative history block</span><strong>{basis?.derivative_history_blocked ? 'YES' : 'NO'}</strong></div><div><span>Unjudged active pairs</span><strong>{basis?.unjudged_active_pairs ?? 0}</strong></div></div>{claim && !claim.basis_frozen && <button className="primary-action" onClick={onFreeze} disabled={!account || busy}>{isAuthor && claim.reuse_ready && !claim.derivative_history_blocked ? 'Freeze Reuse Basis' : 'Attempt Freeze · Expected Refusal'}</button>} {claim?.basis_frozen && <div className="info-callout">Basis digest: <strong title={claim.basis_digest}>{shortHash(claim.basis_digest)}</strong></div>}</article>
            </section>

            <article className="surface-card audit-v4"><div className="surface-head"><div><span className="section-eyebrow">AUDIT TRAIL</span><h2>Historical pair verdicts</h2></div><span className="version-badge">{pairs.length} records</span></div>{pairs.length === 0 ? <div className="empty-state-v4">No judged pairs yet.</div> : <div className="audit-table-v4"><div className="audit-head"><span>PAIR</span><span>SOURCES</span><span>VERDICT</span><span>MODE</span></div>{pairs.map((pair) => <div className="audit-row" key={pair.pair_id}><span>#{pair.pair_id}</span><div><strong>S{pair.source_a} ↔ S{pair.source_b}</strong><small>claim #{claim?.claim_id}</small></div><span className={pair.verdict === 'INDEPENDENT_CORROBORATION' ? 'verdict-pill independent' : 'verdict-pill derivative'}>{pair.verdict === 'INDEPENDENT_CORROBORATION' ? 'INDEPENDENT' : 'DERIVATIVE'}</span><span className="mode-pill">{pair.semantic_eval_used ? 'SEMANTIC' : 'DETERMINISTIC'}</span></div>)}</div>}</article>
          </div>}
        </main>
      </section>
    </div>
  )
}
