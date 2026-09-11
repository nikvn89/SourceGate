import os, json, hashlib, pytest
from pathlib import Path

os.environ.setdefault('GENVM_VERSION', 'v0.2.12')
_default = Path(__file__).resolve().parents[2] / 'contracts' / 'SourceGate.py'
CONTRACT = str(Path(os.environ.get('SOURCEGATE_CONTRACT', _default)).resolve())

IND = '{"verdict":"INDEPENDENT_CORROBORATION"}'
DER = '{"verdict":"DERIVATIVE_SOURCE_CLUSTER"}'

CLAIM = 'Factory Y stopped production line 3 in June.'
SRC1 = 'Factory notice: production line 3 was suspended beginning June 2.'
SRC2 = 'Independent safety inspection: line 3 lacked operational clearance in June.'
SRC3 = 'Equipment telemetry archive: line 3 recorded no production cycles during June.'
SRC4 = 'Trade-journal field report: line 3 remained offline throughout the June reporting period.'


def dig(s):
    return hashlib.sha256(s.encode()).hexdigest()


def addr_hex(a):
    if isinstance(a, (bytes, bytearray)):
        return '0x' + bytes(a).hex()
    return str(a)


def source(excerpt, origin, tag, url=''):
    return {
        'excerpt': excerpt,
        'origin_label': origin,
        'reference_url': url,
        'evidence_digest': dig(tag),
        'from_claim_id': 0,
    }


def initial3():
    return [
        source(SRC1, 'Factory operations notice', 'artifact-1', 'https://example.org/factory-notice'),
        source(SRC2, 'Independent safety inspection', 'artifact-2', 'https://example.org/inspection'),
        source(SRC3, 'Equipment telemetry archive', 'artifact-3', 'https://example.org/telemetry'),
    ]

@pytest.fixture
def sg(direct_deploy):
    return direct_deploy(CONTRACT, sdk_version='v0.2.12')

@pytest.fixture
def owner(direct_owner):
    return direct_owner

@pytest.fixture
def reviewer(direct_bob):
    return direct_bob

@pytest.fixture
def outsider(direct_charlie):
    return direct_charlie

@pytest.fixture
def claim1(sg, reviewer):
    sg.create_claim(CLAIM, addr_hex(reviewer), json.dumps(initial3()))
    return sg


def attest(sg, direct_vm, reviewer, claim_id, *indices):
    for idx in indices:
        binding = sg.get_source(claim_id, idx)['binding_hash']
        with direct_vm.prank(reviewer):
            sg.attest_source(claim_id, idx, binding)


def attest_all3(sg, direct_vm, reviewer, claim_id=1):
    attest(sg, direct_vm, reviewer, claim_id, 1, 2, 3)


def judge_independent_matrix3(sg, direct_vm, claim_id=1):
    direct_vm.mock_llm(r'.*', IND)
    sg.judge_pair(claim_id, 1, 2)
    sg.judge_pair(claim_id, 1, 3)
    sg.judge_pair(claim_id, 2, 3)
