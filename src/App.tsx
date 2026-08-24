import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addExternalSource,
  addVerifiedClaimSource,
  connectWallet,
  createClaim,
  getClaim,
  getClaimPairs,
  getConfig,
  getPairBySources,
  getSources,
  judgePair,
  waitForStateChange,
} from './genlayer'
import {
  CONTRACT_ADDRESS,
  DEMO_SOURCES,
  EXPLORER_BASE,
  PUBLIC_SAMPLE_CLAIM_ID,
} from './config'
import { reportError } from './errors'
import type {
  Address,
  ClaimRecord,
  DraftSource,
  GateConfig,
  PairSummary,
  SourceRecord,
} from './types'

type Tab = 'overview' | 'sources' | 'review'
type ActionPhase = 'idle' | 'submitted' | 'confirmed' | 'pending' | 'error'

type ActionState = {
  phase: ActionPhase
  label: string
  hash?: string
  message?: string
}

const LAST_CLAIM_KEY = `sourcegate:last-claim:${CONTRACT_ADDRESS.toLowerCase()}`

const shortAddress = (address: string) =>
  address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '—'

const shortText = (text: string, size = 90) =>
  text.length > size ? `${text.slice(0, size)}…` : text

function randomDemoId() {
  const random = new Uint32Array(1)
  crypto.getRandomValues(random)
  return `${Date.now().toString(36).slice(-7)}-${random[0].toString(36).slice(-5)}`
}

function freshDemoClaim() {
  return `Demo ${randomDemoId()}: Harbor Rail cancelled about two dozen weekend services during May.`
}

function safeHttpUrl(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : null
  } catch {
    return null
  }
}

function freshDraftSources(): DraftSource[] {
  return DEMO_SOURCES.map((source) => ({
    ...source,
    reference_url: '',
  }))
}

function SourceGateLogo() {
  return <img className="project-logo" src="/sourcegate-logo.svg" alt="SourceGate" />
}

function GenLayerBadge() {
  return (
    <div className="genlayer-badge">
      <img src="/genlayer-logo.png" alt="GenLayer" />
      <div>
        <strong>Built on GenLayer</strong>
        <span>AI consensus for provenance independence</span>
      </div>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('overview')
  const [account, setAccount] = useState<Address | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [claimId, setClaimId] = useState(PUBLIC_SAMPLE_CLAIM_ID)
  const [claimInput, setClaimInput] = useState(String(PUBLIC_SAMPLE_CLAIM_ID))
  const [claim, setClaim] = useState<ClaimRecord | null>(null)
  const [config, setConfig] = useState<GateConfig | null>(null)
  const [sources, setSources] = useState<SourceRecord[]>([])
  const [pairs, setPairs] = useState<PairSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [isSample, setIsSample] = useState(true)
  const [error, setError] = useState('')
  const [action, setAction] = useState<ActionState>({
    phase: 'idle',
    label: 'Ready',
  })

  const [draftClaim, setDraftClaim] = useState(freshDemoClaim)
  const [draftSources, setDraftSources] = useState<DraftSource[]>(freshDraftSources)

  const [newExcerpt, setNewExcerpt] = useState('')
  const [newOrigin, setNewOrigin] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [fromClaimId, setFromClaimId] = useState('')

  const [sourceA, setSourceA] = useState('1')
  const [sourceB, setSourceB] = useState('2')

  const writesDisabled = isSample || !account
  const isOwner =
    !!account &&
    !!claim &&
    claim.author.toLowerCase() === account.toLowerCase()
  const busy = action.phase === 'submitted'

  const loadClaim = useCallback(async (
    id: number,
    mode: 'sample' | 'workspace' = 'workspace',
  ) => {
    setLoading(true)
    setError('')

    try {
      const [nextClaim, nextSources, nextPairs] = await Promise.all([
        getClaim(id),
        getSources(id, 1, config?.max_sources_per_claim ?? 8),
        getClaimPairs(id, 1, 50),
      ])

      setClaimId(id)
      setClaimInput(String(id))
      setClaim(nextClaim)
      setSources(nextSources)
      setPairs([...nextPairs].reverse())
      setIsSample(mode === 'sample')

      if (mode === 'workspace') {
        window.localStorage.setItem(LAST_CLAIM_KEY, String(id))
      }

      if (nextSources.length >= 2) {
        setSourceA('1')
        setSourceB('2')
      }
    } catch (raw) {
      setError(reportError('load claim', raw))
    } finally {
      setLoading(false)
    }
  }, [config?.max_sources_per_claim])

  const refresh = useCallback(async () => {
    if (!claim) return
    await loadClaim(claimId, isSample ? 'sample' : 'workspace')
  }, [claim, claimId, isSample, loadClaim])

  useEffect(() => {
    void getConfig()
      .then(setConfig)
      .catch((raw) => setError(reportError('load contract config', raw)))
  }, [])

  useEffect(() => {
    if (!config) return

    const saved = Number(window.localStorage.getItem(LAST_CLAIM_KEY) ?? '0')
    const hasSavedWorkspace =
      Number.isInteger(saved) &&
      saved > 0 &&
      saved <= config.claim_count

    if (hasSavedWorkspace) {
      void loadClaim(saved, 'workspace')
      return
    }

    if (
      PUBLIC_SAMPLE_CLAIM_ID > 0 &&
      PUBLIC_SAMPLE_CLAIM_ID <= config.claim_count
    ) {
      void loadClaim(PUBLIC_SAMPLE_CLAIM_ID, 'sample')
      return
    }

    // Fresh deployment: no claim exists yet. Do not call get_claim(1),
    // because the contract correctly rejects a non-existent id.
    setClaim(null)
    setSources([])
    setPairs([])
    setIsSample(false)
    setClaimId(0)
    setClaimInput('')
    setError('')
    setLoading(false)
  }, [config, loadClaim])

  useEffect(() => {
    if (!window.ethereum) return

    const onAccounts = (accounts: string[]) => {
      const next = accounts?.[0]
      setAccount(next ? (next as Address) : null)
    }
    const onChain = () => window.location.reload()

    window.ethereum.on?.('accountsChanged', onAccounts)
    window.ethereum.on?.('chainChanged', onChain)

    return () => {
      window.ethereum.removeListener?.('accountsChanged', onAccounts)
      window.ethereum.removeListener?.('chainChanged', onChain)
    }
  }, [])

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

  const setSubmitted = (label: string, hash: string) => {
    setAction({ phase: 'submitted', label, hash })
  }

  const setConfirmed = (label: string, hash?: string) => {
    setAction({ phase: 'confirmed', label, hash })
  }

  const setPending = (label: string, hash: string) => {
    setAction({
      phase: 'pending',
      label,
      hash,
      message:
        'Transaction was sent, but the state change could not be confirmed before timeout. It may still be finalizing, or the contract may have rejected it. Open View tx before submitting again.',
    })
  }

  const failAction = (context: string, raw: unknown) => {
    const message = reportError(context, raw)
    setError(message)
    setAction({ phase: 'error', label: 'Action failed', message })
  }

  const onFreshTemplate = () => {
    setDraftClaim(freshDemoClaim())
    setDraftSources(freshDraftSources())
  }

  const onCreateClaim = async () => {
    if (!account) return setError('Connect MetaMask first.')
    const submittedText = draftClaim.trim()
    if (!submittedText) return setError('Claim text is required.')

    const usableSources = draftSources.filter((source) => source.excerpt.trim())
    if (usableSources.length < 2) return setError('Add at least two source excerpts.')
    if (usableSources.length > (config?.max_sources_per_claim ?? 8)) {
      return setError(`A claim can contain at most ${config?.max_sources_per_claim ?? 8} sources.`)
    }

    const normalizedExcerpts = usableSources.map((source) => source.excerpt.trim())
    if (new Set(normalizedExcerpts).size !== normalizedExcerpts.length) {
      return setError('Duplicate source excerpt in the claim draft.')
    }

    setError('')

    try {
      const before = await getConfig()
      const payload = usableSources.map((source) => ({
        excerpt: source.excerpt.trim(),
        origin_label: source.origin_label.trim() || 'Source',
        reference_url: source.reference_url.trim(),
        from_claim_id: 0,
      }))

      const { hash } = await createClaim(
        account,
        submittedText,
        JSON.stringify(payload),
      )

      setSubmitted('Claim submitted — locating your claim id…', hash)

      let nextScanId = before.claim_count + 1

      const result = await waitForStateChange<number>({
        read: async () => {
          const cfg = await getConfig()
          setConfig(cfg)

          if (nextScanId > cfg.claim_count) return 0

          const upper = Math.min(cfg.claim_count, nextScanId + 24)
          for (let id = nextScanId; id <= upper; id += 1) {
            try {
              const candidate = await getClaim(id)
              if (
                candidate.text === submittedText &&
                candidate.author.toLowerCase() === account.toLowerCase()
              ) {
                return id
              }
            } catch {
              // A newly counted id can be temporarily unreadable while finalizing.
            }
          }

          nextScanId = upper + 1
          return 0
        },
        isDone: (id) => id > 0,
        timeoutMs: 150_000,
      })

      if (result.status === 'confirmed' && result.value > 0) {
        const newClaimId = result.value
        await loadClaim(newClaimId, 'workspace')
        setConfirmed(`Claim #${newClaimId} created ✓`, hash)
        onFreshTemplate()
        setTab('review')
      } else {
        setPending('Claim sent — could not confirm your claim id yet', hash)
      }
    } catch (raw) {
      failAction('create claim', raw)
    }
  }

  const onLoadClaim = async () => {
    const id = Number(claimInput)
    if (!Number.isInteger(id) || id <= 0) return setError('Enter a valid claim id.')
    await loadClaim(id, id === PUBLIC_SAMPLE_CLAIM_ID ? 'sample' : 'workspace')
  }

  const onAddExternal = async () => {
    if (!account) return setError('Connect MetaMask first.')
    if (writesDisabled) {
      return setError('The public sample is read-only. Create or load another claim.')
    }
    if (!claim) return
    if (!isOwner) return setError('Only the claim author may add sources.')

    const excerpt = newExcerpt.trim()
    const origin = (newOrigin || 'External source').trim()
    const referenceUrl = newUrl.trim()

    if (!excerpt) return setError('Source excerpt is required.')
    if (sources.some((source) => source.excerpt === excerpt)) {
      return setError('This exact source excerpt is already registered in the claim.')
    }
    if (claim.source_count >= (config?.max_sources_per_claim ?? 8)) {
      return setError(`This claim has reached the ${config?.max_sources_per_claim ?? 8}-source limit.`)
    }
    if (referenceUrl && !safeHttpUrl(referenceUrl)) {
      return setError('Reference URL must use http:// or https://.')
    }

    setError('')
    try {
      const { hash } = await addExternalSource(
        account,
        claim.claim_id,
        excerpt,
        origin,
        referenceUrl,
      )

      setSubmitted('Source submitted — confirming the exact excerpt…', hash)

      const result = await waitForStateChange({
        read: () => getSources(
          claim.claim_id,
          1,
          config?.max_sources_per_claim ?? 8,
        ),
        isDone: (value) =>
          value.some(
            (source) =>
              source.excerpt === excerpt &&
              source.origin_label === origin &&
              source.from_claim_id === 0,
          ),
      })

      if (result.status === 'confirmed') {
        setNewExcerpt('')
        setNewOrigin('')
        setNewUrl('')
        await refresh()
        setConfirmed('External source registered ✓', hash)
      } else {
        setPending('Source sent — exact registry entry not confirmed yet', hash)
      }
    } catch (raw) {
      failAction('add external source', raw)
    }
  }

  const onAddVerifiedClaim = async () => {
    if (!account) return setError('Connect MetaMask first.')
    if (writesDisabled) {
      return setError('The public sample is read-only. Create or load another claim.')
    }
    if (!claim) return
    if (!isOwner) return setError('Only the claim author may add sources.')

    const fromId = Number(fromClaimId)
    if (!Number.isInteger(fromId) || fromId <= 0) {
      return setError('Enter a valid verified claim id.')
    }
    if (fromId === claim.claim_id) return setError('A claim cannot source itself.')
    if (claim.source_count >= (config?.max_sources_per_claim ?? 8)) {
      return setError(`This claim has reached the ${config?.max_sources_per_claim ?? 8}-source limit.`)
    }

    setError('')
    try {
      const sourceClaim = await getClaim(fromId)
      if (!sourceClaim.verified) {
        return setError(`Claim #${fromId} is not VERIFIED and cannot be reused yet.`)
      }
      if (
        sources.some(
          (source) =>
            source.from_claim_id === fromId ||
            source.excerpt === sourceClaim.text,
        )
      ) {
        return setError(`Claim #${fromId} is already represented in this source set.`)
      }

      const { hash } = await addVerifiedClaimSource(
        account,
        claim.claim_id,
        fromId,
      )

      setSubmitted('Verified-claim source submitted — confirming exact source…', hash)

      const result = await waitForStateChange({
        read: () => getSources(
          claim.claim_id,
          1,
          config?.max_sources_per_claim ?? 8,
        ),
        isDone: (value) =>
          value.some(
            (source) =>
              source.from_claim_id === fromId &&
              source.excerpt === sourceClaim.text,
          ),
      })

      if (result.status === 'confirmed') {
        setFromClaimId('')
        await refresh()
        setConfirmed(`Verified claim #${fromId} linked as a source ✓`, hash)
      } else {
        setPending('Verified source sent — exact registry entry not confirmed yet', hash)
      }
    } catch (raw) {
      failAction('add verified claim source', raw)
    }
  }

  const onJudgePair = async () => {
    if (!account) return setError('Connect MetaMask first.')
    if (writesDisabled) {
      return setError('The public sample is read-only. Create or load another claim.')
    }
    if (!claim) return

    const a = Number(sourceA)
    const b = Number(sourceB)

    if (!Number.isInteger(a) || !Number.isInteger(b) || a <= 0 || b <= 0) {
      return setError('Choose two valid source indexes.')
    }
    if (a === b) return setError('Choose two different sources.')
    if (a > sources.length || b > sources.length) return setError('Invalid source index.')

    setError('')

    try {
      const existing = await getPairBySources(claim.claim_id, a, b)
      if (existing.judged) {
        setConfirmed(`This pair was already judged: ${existing.verdict}`)
        await refresh()
        return
      }

      const { hash } = await judgePair(account, claim.claim_id, a, b)
      setSubmitted(`Pair S${a} + S${b} submitted to validator consensus…`, hash)

      const result = await waitForStateChange({
        read: () => getPairBySources(claim.claim_id, a, b),
        isDone: (value) => value.judged,
        timeoutMs: 180_000,
      })

      if (result.status === 'confirmed') {
        await refresh()
        setConfirmed(`Pair verdict: ${result.value.verdict} ✓`, hash)
      } else {
        setPending('Pair submitted — consensus/state still pending', hash)
      }
    } catch (raw) {
      failAction('judge pair', raw)
    }
  }

  const verificationPct = useMemo(() => {
    if (!claim) return 0
    const pairPart = Math.min(
      1,
      claim.independent_pairs / Math.max(1, claim.required_pairs),
    )
    const sourcePart = Math.min(
      1,
      claim.distinct_independent_sources /
        Math.max(1, claim.required_distinct_sources),
    )
    return Math.round(((pairPart + sourcePart) / 2) * 100)
  }, [claim])

  const sourceByIndex = useMemo(() => {
    const map = new Map<number, SourceRecord>()
    for (const source of sources) map.set(source.source_index, source)
    return map
  }, [sources])

  return (
    <div className="portal-shell">
      <aside className="portal-sidebar">
        <div className="portal-brand">
          <SourceGateLogo />
          <div className="portal-brand-copy">
            <strong>SourceGate</strong>
            <span>Provenance independence</span>
          </div>
        </div>

        <div className="sidebar-section">
          <span className="sidebar-kicker">Workspace</span>
          <nav className="portal-nav">
            <button
              className={tab === 'overview' ? 'portal-nav-item active' : 'portal-nav-item'}
              onClick={() => setTab('overview')}
            >
              <span className="nav-icon">⌂</span>
              <span className="nav-label"><strong>Overview</strong><small>Claim & live config</small></span>
            </button>
            <button
              className={tab === 'sources' ? 'portal-nav-item active' : 'portal-nav-item'}
              onClick={() => setTab('sources')}
            >
              <span className="nav-icon">≡</span>
              <span className="nav-label"><strong>Sources</strong><small>Immutable registry</small></span>
              <b className="nav-count">{claim?.source_count ?? 0}</b>
            </button>
            <button
              className={tab === 'review' ? 'portal-nav-item active' : 'portal-nav-item'}
              onClick={() => setTab('review')}
            >
              <span className="nav-icon">◇</span>
              <span className="nav-label"><strong>Pair Review</strong><small>Consensus verdicts</small></span>
              <b className="nav-count">{claim?.pair_count ?? 0}</b>
            </button>
          </nav>
        </div>

        <div className="sidebar-section network-section">
          <span className="sidebar-kicker">Network</span>
          <div className="network-row"><span className="network-dot" /> <strong>StudioNet</strong><small>61999</small></div>
          <a
            className="sidebar-link"
            href={`${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
          >
            <span>Contract</span><strong>{shortAddress(CONTRACT_ADDRESS)} ↗</strong>
          </a>
        </div>

        <div className="sidebar-claim-card">
          <div className="sidebar-claim-top">
            <span>{!claim ? 'EMPTY REGISTRY' : isSample ? 'SAMPLE CLAIM' : account && !isOwner ? 'PUBLIC CLAIM' : 'WORKSPACE'}</span>
            <b className={claim?.verified ? 'status-pill verified' : 'status-pill building'}>
              {claim?.verified ? 'VERIFIED' : 'BUILDING'}
            </b>
          </div>
          <strong>{claim ? `Claim #${claim.claim_id}` : config ? 'No claims yet' : 'Loading…'}</strong>
          <p>{claim ? shortText(claim.text, 82) : config ? 'Connect a wallet and create the first claim.' : 'Reading contract state…'}</p>
          <div className="claim-progress"><div style={{ width: `${verificationPct}%` }} /></div>
          <small>
            {claim
              ? `${claim.independent_pairs}/${claim.required_pairs} pairs · ${claim.distinct_independent_sources}/${claim.required_distinct_sources} sources`
              : '—'}
          </small>
        </div>

        <div className="sidebar-footer">
          <img src="/genlayer-logo.png" alt="GenLayer" />
          <div><strong>Built on GenLayer</strong><span>AI consensus + deterministic state</span></div>
        </div>
      </aside>

      <section className="portal-page">
        <header className="portal-topbar">
          <div className="topbar-title">
            <span>SourceGate / {tab === 'overview' ? 'Overview' : tab === 'sources' ? 'Sources' : 'Pair Review'}</span>
            <strong>{tab === 'overview' ? 'Overview' : tab === 'sources' ? 'Source Registry' : 'Pair Review'}</strong>
          </div>

          <div className="topbar-actions">
            <span className="top-chip"><i /> StudioNet 61999</span>
            <a
              className="top-chip top-link"
              href={`${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
            >
              {shortAddress(CONTRACT_ADDRESS)} ↗
            </a>
            <button className="connect-button" onClick={onConnect} disabled={connecting}>
              {connecting ? 'Connecting…' : account ? shortAddress(account) : 'Connect MetaMask'}
            </button>
          </div>
        </header>

        <main className="portal-content">
          {tab === 'overview' ? (
            <section className="portal-hero">
              <div className="hero-copy-v4">
                <span className="hero-chip">PROVENANCE INDEPENDENCE</span>
                <h1>Don’t count echoes as corroboration.</h1>
                <p>
                  Commit immutable excerpts, compare one source pair at a time with
                  GenLayer consensus, and unlock verified-claim reuse only after the
                  deterministic threshold is reached.
                </p>
                <div className="hero-facts">
                  <span><b>2</b> independent pairs</span>
                  <span><b>3</b> distinct sources</span>
                  <span><b>0</b> URL fetches</span>
                </div>
              </div>

              <div className="hero-claim-card">
                <div className="hero-claim-top">
                  <span>{!claim ? 'EMPTY REGISTRY' : isSample ? 'READ-ONLY SAMPLE' : account && !isOwner ? 'PUBLIC CLAIM' : 'CURRENT CLAIM'}</span>
                  <b className={claim?.verified ? 'status-pill verified' : 'status-pill building'}>
                    {claim?.verified ? 'VERIFIED' : 'BUILDING'}
                  </b>
                </div>
                <strong>{claim ? `Claim #${claim.claim_id}` : config ? 'No public sample yet' : 'Loading…'}</strong>
                <p>{claim ? shortText(claim.text, 115) : config ? 'This deployment has no claims yet. Create the first workspace below.' : 'Reading contract state…'}</p>
                <div className="claim-progress light"><div style={{ width: `${verificationPct}%` }} /></div>
                <div className="hero-claim-metrics">
                  <span><b>{claim?.independent_pairs ?? 0}/{claim?.required_pairs ?? 2}</b> pairs</span>
                  <span><b>{claim?.distinct_independent_sources ?? 0}/{claim?.required_distinct_sources ?? 3}</b> sources</span>
                </div>
              </div>
            </section>
          ) : (
            <section className="claim-strip-v4">
              <div>
                <span className="section-eyebrow">{!claim ? 'EMPTY REGISTRY' : isSample ? 'READ-ONLY SAMPLE' : account && !isOwner ? 'PUBLIC CLAIM' : 'CURRENT CLAIM'}</span>
                <strong>{claim ? `Claim #${claim.claim_id}` : config ? 'No claim loaded' : 'Loading…'}</strong>
                <p>{claim ? shortText(claim.text, 150) : config ? 'Create a claim or load an existing id.' : 'Reading contract state…'}</p>
              </div>
              <div className="claim-strip-right">
                <b className={claim?.verified ? 'status-pill verified' : 'status-pill building'}>
                  {claim?.verified ? 'VERIFIED' : 'BUILDING'}
                </b>
                <span>{claim ? `${claim.independent_pairs}/${claim.required_pairs} pairs · ${claim.distinct_independent_sources}/${claim.required_distinct_sources} sources` : '—'}</span>
              </div>
            </section>
          )}

          {action.phase !== 'idle' && (
            <div className={`activity-banner ${action.phase}`}>
              <span className="activity-dot" />
              <strong>{action.label}</strong>
              {action.message && <span>{action.message}</span>}
              {action.hash && (
                <a href={`${EXPLORER_BASE}/transactions/${action.hash}`} target="_blank" rel="noreferrer">View tx ↗</a>
              )}
            </div>
          )}

          {error && (
            <div className="error-banner-v4">
              <span>!</span><div>{error}</div><button onClick={() => setError('')}>×</button>
            </div>
          )}

          {tab === 'overview' && (
            <div className="page-stack">
              <section className="metric-row-v4">
                <article className="metric-v4"><span>CLAIM</span><strong>#{claim?.claim_id ?? '—'}</strong><small>{isSample ? 'Public sample' : isOwner ? 'Your workspace' : 'Public claim'}</small></article>
                <article className="metric-v4"><span>SOURCES</span><strong>{claim?.source_count ?? '—'}</strong><small>Immutable excerpts</small></article>
                <article className="metric-v4"><span>INDEPENDENT</span><strong>{claim?.independent_pairs ?? '—'}</strong><small>Need {claim?.required_pairs ?? 2} positive pairs</small></article>
                <article className="metric-v4"><span>DERIVATIVE</span><strong>{claim?.derivative_pairs ?? '—'}</strong><small>Shared-origin pairs</small></article>
              </section>

              <section className="overview-workspace-grid">
                <article className="surface-card create-card-v4">
                  <div className="surface-head">
                    <div><span className="section-eyebrow">CREATE</span><h2>Fresh claim workspace</h2></div>
                    <button className="soft-button" onClick={onFreshTemplate}>New demo</button>
                  </div>
                  <p className="surface-note">Preset sources are designed to give one likely derivative pair and two independent candidates.</p>

                  <label>CLAIM TEXT</label>
                  <textarea value={draftClaim} onChange={(e) => setDraftClaim(e.target.value)} rows={2} />

                  <div className="draft-grid-v4">
                    {draftSources.map((source, index) => (
                      <div className="draft-mini-card" key={index}>
                        <div className="draft-mini-head"><span>S{index + 1}</span><strong>{index === 1 ? 'Likely derivative' : index > 1 ? 'Independent candidate' : 'Origin source'}</strong></div>
                        <textarea
                          value={source.excerpt}
                          onChange={(e) => {
                            const next = [...draftSources]
                            next[index] = { ...next[index], excerpt: e.target.value }
                            setDraftSources(next)
                          }}
                          rows={3}
                        />
                        <input
                          value={source.origin_label}
                          onChange={(e) => {
                            const next = [...draftSources]
                            next[index] = { ...next[index], origin_label: e.target.value }
                            setDraftSources(next)
                          }}
                          placeholder="Origin label"
                        />
                      </div>
                    ))}
                  </div>

                  <button className="primary-action" onClick={onCreateClaim} disabled={!account || busy}>
                    {account ? 'Create Fresh Claim' : 'Connect wallet to create'}
                  </button>
                </article>

                <div className="overview-side-stack">
                  <article className="surface-card">
                    <div className="surface-head"><div><span className="section-eyebrow">OPEN</span><h2>Existing claim</h2></div></div>
                    <p className="surface-note">{config && config.claim_count === 0
                    ? 'No claims exist on this deployment yet. Create the first workspace.'
                    : 'Claim #1 is the default public sample and remains read-only in this interface.'}</p>
                    <label>CLAIM ID</label>
                    <div className="inline-control">
                      <input value={claimInput} onChange={(e) => setClaimInput(e.target.value)} inputMode="numeric" />
                      <button className="secondary-action" onClick={onLoadClaim} disabled={loading}>{loading ? 'Loading…' : 'Load'}</button>
                    </div>
                    <div className="claim-summary-v4">
                      <span className={claim?.verified ? 'summary-seal verified' : 'summary-seal'}>{claim?.verified ? '✓' : '…'}</span>
                      <div><strong>{claim?.verified ? 'Verified claim' : 'Verification in progress'}</strong><p>{claim?.text ?? 'No claim loaded.'}</p></div>
                    </div>
                    {isSample && claim && <div className="info-callout">Public sample loaded. Create a fresh claim to enable writes.</div>}
                  </article>

                  <article className="surface-card config-card-v4">
                    <div className="surface-head"><div><span className="section-eyebrow">ONCHAIN</span><h2>Live configuration</h2></div><span className="version-badge">{config ? `v${config.version}` : '…'}</span></div>
                    <div className="config-list-v4">
                      <div><span>Verification</span><strong>{config ? `${config.required_independent_pairs} pairs / ${config.required_distinct_independent_sources} sources` : '—'}</strong></div>
                      <div><span>URLs in prompt</span><strong>{config ? (config.urls_enter_consensus_prompt ? 'YES' : 'NO') : '—'}</strong></div>
                      <div><span>Pair judging</span><strong>{config ? (config.public_pair_judging ? 'PUBLIC' : 'RESTRICTED') : '—'}</strong></div>
                      <div><span>Global admin</span><strong>{config ? (config.global_admin ? 'YES' : 'NO') : '—'}</strong></div>
                    </div>
                  </article>
                </div>
              </section>

              <section className="flow-row-v4">
                <article><span>01</span><strong>Commit</strong><p>Claim + immutable excerpts</p></article>
                <article><span>02</span><strong>Compare</strong><p>One pair per consensus call</p></article>
                <article><span>03</span><strong>Accumulate</strong><p>2 positive pairs across 3 sources</p></article>
                <article><span>04</span><strong>Reuse</strong><p>Verified claims unlock typed reuse</p></article>
              </section>
            </div>
          )}

          {tab === 'sources' && (
            <div className="page-stack">
              <div className="page-section-title"><div><span className="section-eyebrow">SOURCE REGISTRY</span><h2>Immutable excerpts</h2><p>URLs are human-reference metadata only and never enter validator consensus.</p></div><span className="large-count">{sources.length} sources</span></div>

              <section className="sources-layout-v4">
                <article className="surface-card source-registry-card">
                  <div className="source-grid-v4">
                    {sources.map((source) => (
                      <article className="source-tile-v4" key={source.source_index}>
                        <div className="source-tile-top">
                          <span>S{source.source_index}</span>
                          {source.from_claim_id > 0 && <b>Verified Claim #{source.from_claim_id}</b>}
                        </div>
                        <p>{source.excerpt}</p>
                        <footer>
                          <span>{source.origin_label}</span>
                          {source.reference_url && (() => {
                            const href = safeHttpUrl(source.reference_url)
                            return href ? (
                              <a href={href} target="_blank" rel="noreferrer noopener">reference ↗</a>
                            ) : (
                              <span className="muted-url">invalid link</span>
                            )
                          })()}
                        </footer>
                      </article>
                    ))}
                  </div>
                </article>

                <div className="sources-actions-v4">
                  {!isSample && account && !isOwner && claim && (
                    <div className="warning-callout">This claim belongs to {shortAddress(claim.author)}. Only its author can add sources.</div>
                  )}

                  <article className="surface-card">
                    <div className="surface-head"><div><span className="section-eyebrow">ADD</span><h2>External excerpt</h2></div></div>
                    <p className="surface-note">Validators see the committed excerpt, never the reference URL.</p>
                    <label>EXCERPT</label>
                    <textarea value={newExcerpt} onChange={(e) => setNewExcerpt(e.target.value)} rows={4} />
                    <label>ORIGIN LABEL</label>
                    <input value={newOrigin} onChange={(e) => setNewOrigin(e.target.value)} />
                    <label>REFERENCE URL · OPTIONAL</label>
                    <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://…" />
                    <button className="primary-action" onClick={onAddExternal} disabled={writesDisabled || !isOwner || busy || !newExcerpt.trim()}>Add External Source</button>
                  </article>

                  <article className="surface-card">
                    <div className="surface-head"><div><span className="section-eyebrow">REUSE</span><h2>Verified claim source</h2></div></div>
                    <p className="surface-note">An unverified claim cannot be reused through this typed path.</p>
                    <label>FROM CLAIM ID</label>
                    <input value={fromClaimId} onChange={(e) => setFromClaimId(e.target.value)} inputMode="numeric" />
                    <button className="secondary-action full-width" onClick={onAddVerifiedClaim} disabled={writesDisabled || !isOwner || busy || !fromClaimId.trim()}>Add Verified Claim as Source</button>
                  </article>
                </div>
              </section>
            </div>
          )}

          {tab === 'review' && (
            <div className="page-stack">
              <div className="page-section-title"><div><span className="section-eyebrow">CONSENSUS</span><h2>Judge source independence</h2><p>One source pair per transaction. The model judges provenance relation, not truth or source reputation.</p></div><span className="large-count">{pairs.length} judged</span></div>

              <section className="review-layout-v4">
                <article className="surface-card judge-panel-v4">
                  {!isSample && account && !isOwner && claim && (
                    <div className="warning-callout">Public claim owned by {shortAddress(claim.author)}. Pair judging is intentionally public; the verdict is permanent and this pair cannot be judged again.</div>
                  )}

                  <div className="pair-selects-v4">
                    <div><label>SOURCE A</label><select value={sourceA} onChange={(e) => setSourceA(e.target.value)}>{sources.map((source) => <option key={source.source_index} value={source.source_index}>S{source.source_index} · {source.origin_label}</option>)}</select></div>
                    <div><label>SOURCE B</label><select value={sourceB} onChange={(e) => setSourceB(e.target.value)}>{sources.map((source) => <option key={source.source_index} value={source.source_index}>S{source.source_index} · {source.origin_label}</option>)}</select></div>
                  </div>

                  <div className="pair-preview-v4">
                    <div><span>S{sourceA}</span><p>{sourceByIndex.get(Number(sourceA))?.excerpt ?? 'Choose a source.'}</p></div>
                    <div className="pair-vs">VS</div>
                    <div><span>S{sourceB}</span><p>{sourceByIndex.get(Number(sourceB))?.excerpt ?? 'Choose a source.'}</p></div>
                  </div>

                  <button className="primary-action" onClick={onJudgePair} disabled={writesDisabled || busy || sources.length < 2}>{isSample ? 'Public sample is read-only' : 'Judge Pair with Consensus'}</button>
                  {!isSample && sources.length >= 4 && pairs.length === 0 && (
                    <div className="demo-path-v4"><strong>Suggested demo</strong><span>S1 + S2 → likely derivative</span><span>S1 + S3 → independent candidate</span><span>S3 + S4 → independent candidate</span></div>
                  )}
                </article>

                <article className="surface-card gate-card-v4">
                  <div className="gate-hero-v4">
                    <span className={claim?.verified ? 'gate-orb verified' : 'gate-orb'}>{claim?.verified ? '✓' : `${verificationPct}%`}</span>
                    <div><span className="section-eyebrow">VERIFICATION GATE</span><h2>{claim?.verified ? 'Verified' : 'Building coverage'}</h2><p>{claim?.verified ? 'Downstream typed reuse is unlocked.' : 'Need both threshold conditions.'}</p></div>
                  </div>
                  <div className="gate-list-v4">
                    <div><span>Independent pairs</span><strong>{claim?.independent_pairs ?? 0} / {claim?.required_pairs ?? 2}</strong></div>
                    <div><span>Distinct sources</span><strong>{claim?.distinct_independent_sources ?? 0} / {claim?.required_distinct_sources ?? 3}</strong></div>
                    <div><span>Derivative pairs</span><strong>{claim?.derivative_pairs ?? 0}</strong></div>
                  </div>
                  <div className="info-callout">VERIFIED does not mean every source is mutually independent. Unjudged pairs remain unknown.</div>
                </article>
              </section>

              <article className="surface-card audit-v4">
                <div className="surface-head"><div><span className="section-eyebrow">AUDIT TRAIL</span><h2>Pair verdict history</h2></div><span className="version-badge">{pairs.length} records</span></div>
                {pairs.length === 0 ? (
                  <div className="empty-state-v4">No pairs judged for this claim yet.</div>
                ) : (
                  <div className="audit-table-v4">
                    <div className="audit-head"><span>PAIR</span><span>SOURCES</span><span>VERDICT</span><span>MODE</span></div>
                    {pairs.map((pair) => (
                      <div className="audit-row" key={pair.pair_id}>
                        <span>#{pair.pair_id}</span>
                        <div><strong>S{pair.source_a} ↔ S{pair.source_b}</strong><small>{shortText(sourceByIndex.get(pair.source_a)?.origin_label ?? `Source ${pair.source_a}`, 32)} · {shortText(sourceByIndex.get(pair.source_b)?.origin_label ?? `Source ${pair.source_b}`, 32)}</small></div>
                        <span className={pair.verdict === 'INDEPENDENT_CORROBORATION' ? 'verdict-pill independent' : 'verdict-pill derivative'}>{pair.verdict === 'INDEPENDENT_CORROBORATION' ? 'INDEPENDENT' : 'DERIVATIVE'}</span>
                        <span className="mode-pill">{pair.used_cache ? 'CACHE' : 'CONSENSUS'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            </div>
          )}
        </main>
      </section>
    </div>
  )
}
