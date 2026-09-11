"""Pure deterministic state-model checks for SourceGate v2.

These tests do NOT emulate GenVM semantic consensus. They pin the deterministic
authorization/revocation/freeze invariants that surround consensus. Real GenVM
Direct Mode tests live under tests/direct/ and are a separate gate.
"""
from dataclasses import dataclass, field
import hashlib

IND='INDEPENDENT_CORROBORATION'; DER='DERIVATIVE_SOURCE_CLUSTER'
PROPOSED='PROPOSED'; ATTESTED='ATTESTED'; REVOKED='REVOKED'
MIN=3; MAX_ACTIVE=8; MAX_RECORDS=12


def h(s): return hashlib.sha256(s.encode()).hexdigest()

@dataclass
class Source:
    text:str; digest:str; binding:str
    state:str=PROPOSED; active:bool=True

@dataclass
class Claim:
    author:str='A'; reviewer:str='B'; text:str='claim'
    sources:list=field(default_factory=list)
    pairs:dict=field(default_factory=dict)
    frozen:bool=False; ready:bool=False; basis_digest:str=''; reuse_count:int=0

    def add(self, text, digest):
        if self.frozen: raise ValueError('frozen')
        if len(self.sources)>=MAX_RECORDS: raise ValueError('record limit')
        if sum(s.active for s in self.sources)>=MAX_ACTIVE: raise ValueError('active limit')
        b=h(text+'|'+digest)
        if any(s.binding==b for s in self.sources): raise ValueError('duplicate binding')
        self.sources.append(Source(text,digest,b)); self.sync(); return len(self.sources)

    def attest(self, actor, idx, expected):
        if self.frozen: raise ValueError('frozen')
        if actor!=self.reviewer: raise PermissionError('reviewer')
        s=self.sources[idx-1]
        if not s.active or s.state!=PROPOSED: raise ValueError('not proposed')
        if expected!=s.binding: raise ValueError('binding')
        s.state=ATTESTED; self.sync()

    def revoke(self, actor, idx):
        if self.frozen: raise ValueError('frozen')
        if actor!=self.reviewer: raise PermissionError('reviewer')
        s=self.sources[idx-1]
        if not s.active or s.state!=ATTESTED: raise ValueError('not attested')
        s.active=False; s.state=REVOKED; self.sync()

    def judge(self, a,b,verdict):
        if self.frozen: raise ValueError('frozen')
        if a==b: raise ValueError('same')
        a,b=sorted((a,b)); sa=self.sources[a-1]; sb=self.sources[b-1]
        if not(sa.active and sb.active): raise ValueError('revoked')
        if sa.state!=ATTESTED or sb.state!=ATTESTED: raise ValueError('unattested')
        key=(a,b)
        if key in self.pairs: return False
        # same evidence identity is deterministically derivative
        self.pairs[key] = DER if sa.digest==sb.digest else verdict
        self.sync(); return True

    def metrics(self):
        active=[i+1 for i,s in enumerate(self.sources) if s.active]
        att=sum(1 for i in active if self.sources[i-1].state==ATTESTED)
        target=len(active)*(len(active)-1)//2
        ind=der=un=0
        for x in range(len(active)):
            for y in range(x+1,len(active)):
                v=self.pairs.get(tuple(sorted((active[x],active[y]))))
                if v is None: un+=1
                elif v==IND: ind+=1
                else: der+=1
        return active,att,target,ind,der,un

    def sync(self):
        active,att,target,ind,der,un=self.metrics()
        self.ready=(len(active)>=MIN and att==len(active) and un==0 and der==0 and ind==target)
        if self.frozen: self.ready=True

    def freeze(self,actor):
        if actor!=self.author: raise PermissionError('author')
        if self.frozen: raise ValueError('frozen')
        self.sync()
        if not self.ready: raise ValueError('not ready')
        active,att,target,ind,der,un=self.metrics()
        canon='|'.join([self.text,self.reviewer]+[self.sources[i-1].binding for i in active]+[f'{a}:{b}:{self.pairs[(a,b)]}' for a in active for b in active if a<b])
        self.basis_digest=h(canon); self.frozen=True; self.ready=True


def expect(exc, fn):
    try: fn()
    except exc: return
    raise AssertionError(f'expected {exc.__name__}')

checks=[]
def check(name, fn):
    fn(); checks.append(name)

def three():
    c=Claim()
    for i in range(3): c.add(f's{i+1}', h(f'e{i+1}'))
    return c

check('reviewer distinct semantic premise', lambda: (_ for _ in ()).throw(AssertionError()) if Claim().author==Claim().reviewer else None)
check('author cannot attest', lambda: expect(PermissionError, lambda: three().attest('A',1,three().sources[0].binding)))

def t_binding_mismatch():
    c=three(); expect(ValueError, lambda:c.attest('B',1,'0'*64))
check('binding mismatch rejected', t_binding_mismatch)

def t_attest():
    c=three(); c.attest('B',1,c.sources[0].binding); assert c.sources[0].state==ATTESTED
check('reviewer attests exact binding',t_attest)

def t_unattested_pair():
    c=three(); expect(ValueError, lambda:c.judge(1,2,IND))
check('unattested pair refused',t_unattested_pair)

def t_all_attested_unjudged():
    c=three(); [c.attest('B',i,c.sources[i-1].binding) for i in (1,2,3)]; assert not c.ready; assert c.metrics()[-1]==3
check('three attested but unjudged blocks reuse',t_all_attested_unjudged)

def t_two_of_three():
    c=three(); [c.attest('B',i,c.sources[i-1].binding) for i in (1,2,3)]; c.judge(1,2,IND); c.judge(1,3,IND); assert not c.ready; assert c.metrics()[-1]==1
check('2 positive + 1 unjudged still blocked',t_two_of_three)

def t_derivative():
    c=three(); [c.attest('B',i,c.sources[i-1].binding) for i in (1,2,3)]; c.judge(1,2,IND); c.judge(1,3,IND); c.judge(2,3,DER); assert not c.ready; assert c.metrics()[4]==1
check('one derivative blocks reuse',t_derivative)

def t_all_ind():
    c=three(); [c.attest('B',i,c.sources[i-1].binding) for i in (1,2,3)]; c.judge(1,2,IND); c.judge(1,3,IND); c.judge(2,3,IND); assert c.ready
check('complete 3x pair matrix all independent enables reuse',t_all_ind)

def ready_claim():
    c=three(); [c.attest('B',i,c.sources[i-1].binding) for i in (1,2,3)]; [c.judge(a,b,IND) for a,b in ((1,2),(1,3),(2,3))]; assert c.ready; return c

def t_append_drops():
    c=ready_claim(); c.add('s4',h('e4')); assert not c.ready; assert c.metrics()[-1]==3
check('append after ready drops readiness',t_append_drops)

def t_attest_new_still_unjudged():
    c=ready_claim(); c.add('s4',h('e4')); c.attest('B',4,c.sources[3].binding); assert not c.ready; assert c.metrics()[-1]==3
check('attested new source still needs all new pairs',t_attest_new_still_unjudged)

def t_complete_four():
    c=ready_claim(); c.add('s4',h('e4')); c.attest('B',4,c.sources[3].binding); [c.judge(a,4,IND) for a in (1,2,3)]; assert c.ready; assert c.metrics()[2]==6
check('four-source complete matrix restores readiness',t_complete_four)

def t_revoke_ready():
    c=ready_claim(); c.revoke('B',3); assert not c.ready; assert len(c.metrics()[0])==2
check('reviewer revocation removes source and drops below minimum',t_revoke_ready)

def t_revoke_derivative_source_recover():
    c=Claim();
    for i in range(4): c.add(f's{i+1}',h(f'e{i+1}'))
    [c.attest('B',i,c.sources[i-1].binding) for i in (1,2,3,4)]
    for p in ((1,2),(1,3),(2,3),(1,4),(2,4)): c.judge(*p,IND)
    c.judge(3,4,DER); assert not c.ready
    c.revoke('B',4); assert c.ready
check('revoking derivative source can recover clean 3-source basis',t_revoke_derivative_source_recover)

def t_replay():
    c=ready_claim(); before=len(c.pairs); assert c.judge(2,1,DER) is False; assert len(c.pairs)==before; assert c.ready
check('reverse pair replay cannot reroll',t_replay)

def t_same_digest():
    c=Claim(); d=h('same'); c.add('a',d); c.add('b',d); c.add('c',h('c')); [c.attest('B',i,c.sources[i-1].binding) for i in (1,2,3)]; c.judge(1,2,IND); assert c.pairs[(1,2)]==DER
check('same artifact digest is deterministic derivative',t_same_digest)

def t_freeze_not_ready():
    c=three(); expect(ValueError,lambda:c.freeze('A'))
check('cannot freeze incomplete basis',t_freeze_not_ready)

def t_outsider_freeze():
    c=ready_claim(); expect(PermissionError,lambda:c.freeze('X'))
check('only author freezes reusable basis',t_outsider_freeze)

def t_freeze():
    c=ready_claim(); c.freeze('A'); assert c.frozen and c.ready and len(c.basis_digest)==64
check('freeze commits complete basis digest',t_freeze)

def t_frozen_add():
    c=ready_claim(); c.freeze('A'); expect(ValueError,lambda:c.add('s4',h('e4')))
check('frozen basis rejects append',t_frozen_add)

def t_frozen_revoke():
    c=ready_claim(); c.freeze('A'); expect(ValueError,lambda:c.revoke('B',1))
check('frozen basis rejects reviewer revocation',t_frozen_revoke)

def t_frozen_judge():
    c=ready_claim(); c.freeze('A'); expect(ValueError,lambda:c.judge(1,2,IND))
check('frozen basis rejects semantic mutation',t_frozen_judge)

def t_record_limit():
    c=Claim();
    for i in range(MAX_ACTIVE): c.add(str(i),h(str(i)))
    expect(ValueError,lambda:c.add('overflow',h('x')))
check('active source cap enforced',t_record_limit)

def t_revocation_frees_active_slot():
    c=Claim();
    for i in range(MAX_ACTIVE): c.add(str(i),h(str(i)))
    c.attest('B',1,c.sources[0].binding); c.revoke('B',1); c.add('replacement',h('r')); assert len(c.sources)==9
check('revocation frees active slot without deleting history',t_revocation_frees_active_slot)

def t_record_history_cap():
    c=Claim()
    # Build 12 total records by repeatedly revoking an attested active source.
    for i in range(MAX_RECORDS):
        if sum(s.active for s in c.sources)>=MAX_ACTIVE:
            idx=next(j+1 for j,s in enumerate(c.sources) if s.active and s.state==PROPOSED)
            c.attest('B',idx,c.sources[idx-1].binding); c.revoke('B',idx)
        c.add(f'r{i}',h(f'r{i}'))
    # Free one active slot if necessary, then total-record limit must still win.
    idx=next(j+1 for j,s in enumerate(c.sources) if s.active and s.state==PROPOSED)
    c.attest('B',idx,c.sources[idx-1].binding); c.revoke('B',idx)
    expect(ValueError,lambda:c.add('thirteenth',h('13')))
check('append-only source history has bounded record cap',t_record_history_cap)

def t_basis_digest_order_stable():
    c1=three(); c2=three()
    for c in (c1,c2): [c.attest('B',i,c.sources[i-1].binding) for i in (1,2,3)]
    for p in ((1,2),(1,3),(2,3)): c1.judge(*p,IND)
    for p in ((2,3),(1,3),(1,2)): c2.judge(*p,IND)
    c1.freeze('A'); c2.freeze('A'); assert c1.basis_digest==c2.basis_digest
check('basis digest canonical across pair judgment order',t_basis_digest_order_stable)

print(f'CORE LOGIC PASS {len(checks)}/{len(checks)}')
