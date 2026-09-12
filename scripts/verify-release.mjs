import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
const contractPath = join(ROOT, 'contracts', 'SourceGate.py')
const contract = readFileSync(contractPath)
const contractText = contract.toString('utf8')
const actualSha = sha256(contract)
const sourceShaLine = read('SOURCE_SHA256.txt').trim()
const config = read('src/config.ts')
const pkg = JSON.parse(read('package.json'))
const direct = read('tests/direct/test_steward_paths.py')
const runtimeEvidence = read('RUNTIME_EVIDENCE.md')
const snapDir = join(ROOT, 'snap')
const checksumPath = join(ROOT, 'FINAL_CHECKSUMS.txt')

const failures = []
const requireTrue = (ok, msg) => { if (!ok) failures.push(msg) }

requireTrue(contractText.includes('CONTRACT_VERSION = "2.1"'), 'contract version is not 2.1')
requireTrue(pkg.version === '2.1.0', 'package version is not 2.1.0')
requireTrue(sourceShaLine === `${actualSha}  contracts/SourceGate.py`, 'SOURCE_SHA256.txt mismatch')
requireTrue(config.includes(actualSha), 'src/config.ts frozen SHA mismatch')
requireTrue(config.includes("EXPECTED_CONTRACT_VERSION = '2.1'"), 'frontend expected version mismatch')
requireTrue(config.includes('0x90F760d90642325777a97Fb9640c5E3fB0d8c2A6'), 'frontend is not pinned to the fresh v2.1 StudioNet deployment')
requireTrue(contractText.includes('Judged source is locked and cannot be revoked'), 'judged-source lock missing')
requireTrue(contractText.includes('claim.derivative_history_blocked = True'), 'permanent derivative-history latch missing')
requireTrue(contractText.includes('Claim has a permanent derivative-history block'), 'freeze derivative-history refusal missing')
requireTrue(contractText.includes('Source pair is already judged'), 'pair replay refusal missing')
requireTrue(contractText.includes('Both sources must be reviewer-attested before pair judging'), 'attestation gate missing')
requireTrue(read('src/App.tsx').includes('while (fromIndex <= nextClaim.pair_count)'), 'frontend full pair pagination missing')
requireTrue(read('src/genlayer.ts').includes('TransactionStatus.FINALIZED'), 'frontend finalized receipt inspection missing')
requireTrue(read('src/genlayer.ts').includes('TransactionHashVariant.LATEST_FINAL'), 'frontend reads are not pinned to latest finalized state')
requireTrue(read('src/App.tsx').includes('confirmAfterFinalization'), 'frontend postcondition verification helper missing')
requireTrue(!/disabled=\{!isAuthor|disabled=\{!isReviewer|disabled=\{!account \|\| busy \|\| !eligible/.test(read('src/App.tsx')), 'frontend still blocks critical contract-refusal paths client-side')
requireTrue(read('LOCKED_SPEC.md').includes('Non-bypassable negative consequence'), 'LOCKED_SPEC missing')
requireTrue(read('BLIND_RUNTIME_PROTOCOL.md').includes('Blind Natural Runtime Protocol'), 'blind runtime protocol missing')
requireTrue(read('BUILD_RULES.md').includes('Consequences must be contract-enforced'), 'strict build rules missing')

const testCount = (direct.match(/^def test_/gm) || []).length
requireTrue(testCount >= 25, `expected >=25 Direct Mode tests, found ${testCount}`)

if (existsSync(snapDir) && statSync(snapDir).isDirectory()) {
  const runtimeShots = readdirSync(snapDir).filter((x) => /\.(?:png|jpe?g|webp)$/i.test(x))
  requireTrue(runtimeShots.length >= 10, `expected >=10 fresh v2.1 runtime screenshots, found ${runtimeShots.length}`)
}
requireTrue(runtimeEvidence.includes('Status: FINAL RUNTIME PASS'), 'runtime evidence is not marked FINAL PASS')
requireTrue(runtimeEvidence.includes('DERIVATIVE_SOURCE_CLUSTER'), 'runtime evidence missing derivative semantic proof')
requireTrue(runtimeEvidence.includes('Claim has a permanent derivative-history block'), 'runtime evidence missing exact permanent derivative refusal')

// FINAL_CHECKSUMS.txt is the immutable manifest of files that were actually
// shipped in the FINAL runtime ZIP. Local test/build artifacts created later by
// `python -m venv`, `npm ci`, `npm test`, or `npm run build` are deliberately
// ignored here. This lets `npm run check` verify the original package after a
// normal local install without confusing generated directories with committed
// submission content.
requireTrue(existsSync(checksumPath), 'FINAL_CHECKSUMS.txt missing')
const checksumLines = existsSync(checksumPath)
  ? readFileSync(checksumPath, 'utf8').split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
  : []
const manifestEntries = []
const manifestPaths = new Set()
for (const line of checksumLines) {
  const m = line.match(/^([0-9a-f]{64})\s\s(.+)$/i)
  if (!m) {
    failures.push(`invalid checksum manifest line: ${line}`)
    continue
  }
  const expected = m[1].toLowerCase()
  const rel = m[2].replace(/\\/g, '/')
  requireTrue(!manifestPaths.has(rel), `duplicate checksum entry: ${rel}`)
  manifestPaths.add(rel)
  requireTrue(!/^(?:dist|node_modules|\.venv)(?:\/|$)/.test(rel), `generated directory was shipped in runtime manifest: ${rel}`)
  requireTrue(!/(?:^|\/)__pycache__(?:\/|$)|\.pyc$/i.test(rel), `Python cache artifact was shipped in FINAL manifest: ${rel}`)
  requireTrue(rel !== 'tests/.errors.mjs', 'generated frontend test artifact was shipped in runtime manifest')
  const abs = join(ROOT, ...rel.split('/'))
  if (!existsSync(abs)) {
    failures.push(`manifest file missing: ${rel}`)
    continue
  }
  const actual = sha256(readFileSync(abs))
  requireTrue(actual === expected, `checksum mismatch: ${rel}`)
  manifestEntries.push({ rel, abs })
}
requireTrue(manifestPaths.has('contracts/SourceGate.py'), 'contract missing from checksum manifest')
requireTrue(manifestPaths.has('scripts/verify-release.mjs'), 'verify script missing from checksum manifest')
requireTrue(manifestPaths.has('package-lock.json'), 'package-lock missing from checksum manifest')
requireTrue(!manifestPaths.has('FINAL_CHECKSUMS.txt'), 'FINAL_CHECKSUMS.txt must not hash itself')

const forbidden = [
  '0x5E7BA4f9D9B306DaDb2a56A3FCCb747960ac4f6b',
  '0xb325DDa519E2D5BE1Ca8Fa24A1A1DE849113D48a',
  '0x0F011a04951320e194eB6EF279F3978e59A95350',
  '170d99a167efa304541be55c347d5284fa1fc8eb79252d12384db05a40b56606',
]
const textExt = /\.(md|txt|py|ts|tsx|js|mjs|json|css|html)$/i
for (const { rel, abs } of manifestEntries) {
  if (!textExt.test(rel) || rel === 'scripts/verify-release.mjs') continue
  const text = readFileSync(abs, 'utf8')
  for (const token of forbidden) requireTrue(!text.includes(token), `stale v2/v1 evidence token in ${rel}: ${token}`)
  requireTrue(!/(BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|private[_ -]?key\s*[:=]\s*[0-9a-fx]{32,})/i.test(text), `possible secret in ${rel}`)
}

if (failures.length) {
  console.error('VERIFY RELEASE FAILED')
  for (const f of failures) console.error(`- ${f}`)
  process.exit(1)
}
console.log('VERIFY RELEASE PASS')
console.log(`Contract SHA256: ${actualSha}`)
console.log(`Direct Mode tests defined: ${testCount}`)
console.log(`Runtime manifest files verified: ${manifestEntries.length}`)
console.log('Runtime deployment: 0x90F760d90642325777a97Fb9640c5E3fB0d8c2A6')
console.log('Runtime evidence: FINAL PASS')
