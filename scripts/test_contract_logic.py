"""Pure deterministic state-model checks for SourceGate v2.1.

These checks do not emulate GenVM semantic consensus. They pin the deterministic
authorization, judgment-lock, derivative-history, freeze, and bounded-history
invariants around consensus. Real GenVM Direct Mode tests live in tests/direct/.
"""
from dataclasses import dataclass, field
import hashlib

IND = 'INDEPENDENT_CORROBORATION'
DER = 'DERIVATIVE_SOURCE_CLUSTER'
PROPOSED = 'PROPOSED'
ATTESTED = 'ATTESTED'
REVOKED = 'REVOKED'
MIN = 3
MAX_ACTIVE = 8
MAX_RECORDS = 12


def h(s):
    return hashlib.sha256(s.encode()).hexdigest()


@dataclass
class Source:
    text: str
    digest: str
    binding: str
    state: str = PROPOSED
    active: bool = True


@dataclass
class Claim:
    author: str = 'A'
    reviewer: str = 'B'
    text: str = 'claim'
    sources: list = field(default_factory=list)
    pairs: dict = field(default_factory=dict)
    frozen: bool = False
    ready: bool = False
    basis_digest: str = ''
    reuse_count: int = 0
    adjudication_started: bool = False
    derivative_history_blocked: bool = False

    def add(self, text, digest):
        if self.frozen:
            raise ValueError('frozen')
        if self.adjudication_started:
            raise ValueError('adjudication sealed')
        if len(self.sources) >= MAX_RECORDS:
            raise ValueError('record limit')
        if sum(s.active for s in self.sources) >= MAX_ACTIVE:
            raise ValueError('active limit')
        b = h(text + '|' + digest)
        if any(s.binding == b for s in self.sources):
            raise ValueError('duplicate binding')
        self.sources.append(Source(text, digest, b))
        self.sync()
        return len(self.sources)

    def attest(self, actor, idx, expected):
        if self.frozen:
            raise ValueError('frozen')
        if self.adjudication_started:
            raise ValueError('adjudication sealed')
        if actor != self.reviewer:
            raise PermissionError('reviewer')
        s = self.sources[idx - 1]
        if not s.active or s.state != PROPOSED:
            raise ValueError('not proposed')
        if expected != s.binding:
            raise ValueError('binding')
        s.state = ATTESTED
        self.sync()

    def source_locked(self, idx):
        return any(idx in pair for pair in self.pairs)

    def revoke(self, actor, idx):
        if self.frozen:
            raise ValueError('frozen')
        if self.adjudication_started:
            raise ValueError('adjudication sealed')
        if actor != self.reviewer:
            raise PermissionError('reviewer')
        s = self.sources[idx - 1]
        if not s.active or s.state not in (PROPOSED, ATTESTED):
            raise ValueError('not revocable')
        if self.source_locked(idx):
            raise ValueError('judgment locked')
        s.active = False
        s.state = REVOKED
        self.sync()

    def judge(self, a, b, verdict):
        if self.frozen:
            raise ValueError('frozen')
        if a == b:
            raise ValueError('same')
        a, b = sorted((a, b))
        sa = self.sources[a - 1]
        sb = self.sources[b - 1]
        if not (sa.active and sb.active):
            raise ValueError('revoked')
        if sa.state != ATTESTED or sb.state != ATTESTED:
            raise ValueError('unattested')
        key = (a, b)
        if key in self.pairs:
            raise ValueError('already judged')
        if not self.adjudication_started:
            active = [s for s in self.sources if s.active]
            if len(active) < MIN:
                raise ValueError('minimum sources')
            if any(s.state != ATTESTED for s in active):
                raise ValueError('all active must be attested')
            self.adjudication_started = True
        actual = DER if sa.digest == sb.digest else verdict
        self.pairs[key] = actual
        if actual == DER:
            self.derivative_history_blocked = True
        self.sync()

    def metrics(self):
        active = [i + 1 for i, s in enumerate(self.sources) if s.active]
        att = sum(1 for i in active if self.sources[i - 1].state == ATTESTED)
        target = len(active) * (len(active) - 1) // 2
        ind = der = un = 0
        for x in range(len(active)):
            for y in range(x + 1, len(active)):
                v = self.pairs.get(tuple(sorted((active[x], active[y]))))
                if v is None:
                    un += 1
                elif v == IND:
                    ind += 1
                else:
                    der += 1
        return active, att, target, ind, der, un

    def sync(self):
        active, att, target, ind, der, un = self.metrics()
        self.ready = (
            len(active) >= MIN
            and att == len(active)
            and un == 0
            and der == 0
            and ind == target
            and not self.derivative_history_blocked
        )
        if self.frozen:
            self.ready = True

    def freeze(self, actor):
        if actor != self.author:
            raise PermissionError('author')
        if self.frozen:
            raise ValueError('frozen')
        if not self.adjudication_started:
            raise ValueError('adjudication not sealed')
        if self.derivative_history_blocked:
            raise ValueError('derivative history')
        self.sync()
        if not self.ready:
            raise ValueError('not ready')
        active, _, _, _, _, _ = self.metrics()
        canon = '|'.join(
            [self.text, self.reviewer]
            + [self.sources[i - 1].binding for i in active]
            + [f'{a}:{b}:{self.pairs[(a, b)]}' for a in active for b in active if a < b]
        )
        self.basis_digest = h(canon)
        self.frozen = True
        self.ready = True


def expect(exc, fn):
    try:
        fn()
    except exc:
        return
    raise AssertionError(f'expected {exc.__name__}')


checks = []

def check(name, fn):
    fn()
    checks.append(name)


def three():
    c = Claim()
    for i in range(3):
        c.add(f's{i+1}', h(f'e{i+1}'))
    return c


def attest_all(c):
    for i in range(1, len(c.sources) + 1):
        if c.sources[i - 1].active and c.sources[i - 1].state == PROPOSED:
            c.attest('B', i, c.sources[i - 1].binding)


def ready_claim():
    c = three()
    attest_all(c)
    for a, b in ((1, 2), (1, 3), (2, 3)):
        c.judge(a, b, IND)
    assert c.ready
    return c


check('reviewer distinct semantic premise', lambda: (_ for _ in ()).throw(AssertionError()) if Claim().author == Claim().reviewer else None)
check('author cannot attest', lambda: expect(PermissionError, lambda: three().attest('A', 1, three().sources[0].binding)))


def t_binding_mismatch():
    c = three()
    expect(ValueError, lambda: c.attest('B', 1, '0' * 64))
check('binding mismatch rejected', t_binding_mismatch)


def t_attest():
    c = three()
    c.attest('B', 1, c.sources[0].binding)
    assert c.sources[0].state == ATTESTED
check('reviewer attests exact binding', t_attest)


def t_revoke_proposed_before_judgment():
    c = three()
    c.revoke('B', 1)
    assert c.sources[0].state == REVOKED and not c.sources[0].active
check('reviewer may revoke proposed source before judgment', t_revoke_proposed_before_judgment)


def t_revoke_attested_before_judgment():
    c = three()
    c.attest('B', 1, c.sources[0].binding)
    c.revoke('B', 1)
    assert c.sources[0].state == REVOKED
check('reviewer may revoke attested source before judgment', t_revoke_attested_before_judgment)


def t_unattested_pair():
    c = three()
    expect(ValueError, lambda: c.judge(1, 2, IND))
check('unattested pair refused', t_unattested_pair)


def t_all_attested_unjudged():
    c = three()
    attest_all(c)
    assert not c.ready and c.metrics()[-1] == 3
check('three attested but unjudged blocks reuse', t_all_attested_unjudged)


def t_two_of_three():
    c = three()
    attest_all(c)
    c.judge(1, 2, IND)
    c.judge(1, 3, IND)
    assert not c.ready and c.metrics()[-1] == 1
check('2 positive + 1 unjudged still blocked', t_two_of_three)


def t_derivative():
    c = three()
    attest_all(c)
    c.judge(1, 2, IND)
    c.judge(1, 3, IND)
    c.judge(2, 3, DER)
    assert not c.ready and c.metrics()[4] == 1 and c.derivative_history_blocked
check('one derivative permanently blocks claim', t_derivative)


def t_judged_source_cannot_be_revoked():
    c = three()
    attest_all(c)
    c.judge(1, 2, DER)
    expect(ValueError, lambda: c.revoke('B', 1))
    expect(ValueError, lambda: c.revoke('B', 2))
    assert c.derivative_history_blocked
check('judged sources are non-revocable', t_judged_source_cannot_be_revoked)


def t_unjudged_source_cannot_be_pruned_after_any_first_judgment():
    c = Claim()
    for i in range(4):
        c.add(f's{i+1}', h(f'e{i+1}'))
    attest_all(c)
    c.judge(1, 2, IND)
    expect(ValueError, lambda: c.revoke('B', 4))
    assert c.sources[3].active and c.adjudication_started
check('first judgment prevents adaptive pruning of unjudged sources', t_unjudged_source_cannot_be_pruned_after_any_first_judgment)


def t_all_ind():
    c = three()
    attest_all(c)
    for p in ((1, 2), (1, 3), (2, 3)):
        c.judge(*p, IND)
    assert c.ready
check('complete 3x pair matrix all independent enables reuse', t_all_ind)


def t_append_before_adjudication_allowed():
    c = three()
    c.add('s4', h('e4'))
    assert len(c.sources) == 4 and not c.adjudication_started
check('append before adjudication is allowed', t_append_before_adjudication_allowed)


def t_append_after_first_judgment_refused():
    c = three()
    attest_all(c)
    c.judge(1, 2, IND)
    expect(ValueError, lambda: c.add('s4', h('e4')))
check('first judgment seals basis against append', t_append_after_first_judgment_refused)


def t_complete_four():
    c = Claim()
    for i in range(4): c.add(f's{i+1}', h(f'e{i+1}'))
    attest_all(c)
    for p in ((1,2),(1,3),(1,4),(2,3),(2,4),(3,4)):
        c.judge(*p, IND)
    assert c.ready and c.metrics()[2] == 6
check('four-source sealed complete matrix enables readiness', t_complete_four)


def t_replay():
    c = ready_claim()
    before = dict(c.pairs)
    expect(ValueError, lambda: c.judge(2, 1, DER))
    assert c.pairs == before and c.ready
check('reverse pair replay cannot reroll', t_replay)


def t_same_digest():
    c = Claim()
    d = h('same')
    c.add('a', d)
    c.add('b', d)
    c.add('c', h('c'))
    attest_all(c)
    c.judge(1, 2, IND)
    assert c.pairs[(1, 2)] == DER and c.derivative_history_blocked
check('same artifact digest is deterministic derivative', t_same_digest)


def t_freeze_not_ready():
    c = three()
    expect(ValueError, lambda: c.freeze('A'))
check('cannot freeze incomplete basis', t_freeze_not_ready)


def t_outsider_freeze():
    c = ready_claim()
    expect(PermissionError, lambda: c.freeze('X'))
check('only author freezes reusable basis', t_outsider_freeze)


def t_derivative_never_freezes():
    c = three()
    attest_all(c)
    c.judge(1, 2, DER)
    expect(ValueError, lambda: c.freeze('A'))
check('derivative-history claim cannot freeze', t_derivative_never_freezes)


def t_freeze():
    c = ready_claim()
    c.freeze('A')
    assert c.frozen and c.ready and len(c.basis_digest) == 64
check('freeze commits complete basis digest', t_freeze)


def t_frozen_add():
    c = ready_claim()
    c.freeze('A')
    expect(ValueError, lambda: c.add('s4', h('e4')))
check('frozen basis rejects append', t_frozen_add)


def t_frozen_revoke():
    c = ready_claim()
    c.freeze('A')
    expect(ValueError, lambda: c.revoke('B', 1))
check('frozen basis rejects reviewer revocation', t_frozen_revoke)


def t_frozen_judge():
    c = ready_claim()
    c.freeze('A')
    expect(ValueError, lambda: c.judge(1, 2, IND))
check('frozen basis rejects semantic mutation', t_frozen_judge)


def t_active_limit():
    c = Claim()
    for i in range(MAX_ACTIVE):
        c.add(str(i), h(str(i)))
    expect(ValueError, lambda: c.add('overflow', h('x')))
check('active source cap enforced', t_active_limit)


def t_revocation_frees_active_slot_before_judgment():
    c = Claim()
    for i in range(MAX_ACTIVE):
        c.add(str(i), h(str(i)))
    c.revoke('B', 1)
    c.add('replacement', h('r'))
    assert len(c.sources) == 9
check('pre-judgment revocation frees active slot without deleting history', t_revocation_frees_active_slot_before_judgment)


def t_record_history_cap():
    c = Claim()
    for i in range(MAX_RECORDS):
        if sum(s.active for s in c.sources) >= MAX_ACTIVE:
            idx = next(j + 1 for j, s in enumerate(c.sources) if s.active and not c.source_locked(j + 1))
            c.revoke('B', idx)
        c.add(f'r{i}', h(f'r{i}'))
    if sum(s.active for s in c.sources) >= MAX_ACTIVE:
        idx = next(j + 1 for j, s in enumerate(c.sources) if s.active and not c.source_locked(j + 1))
        c.revoke('B', idx)
    expect(ValueError, lambda: c.add('thirteenth', h('13')))
check('append-only source history has bounded record cap', t_record_history_cap)


def t_basis_digest_order_stable():
    c1 = three()
    c2 = three()
    for c in (c1, c2):
        attest_all(c)
    for p in ((1, 2), (1, 3), (2, 3)):
        c1.judge(*p, IND)
    for p in ((2, 3), (1, 3), (1, 2)):
        c2.judge(*p, IND)
    c1.freeze('A')
    c2.freeze('A')
    assert c1.basis_digest == c2.basis_digest
check('basis digest canonical across pair judgment order', t_basis_digest_order_stable)

print(f'CORE LOGIC PASS {len(checks)}/{len(checks)}')
