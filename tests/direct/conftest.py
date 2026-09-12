import os, json, hashlib, pytest
from pathlib import Path

os.environ.setdefault('GENVM_VERSION', 'v0.2.12')


def _install_windows_gltest_stdio_fix():
    """Work around genlayer-test 0.29.2 Direct Mode stdin cleanup on Windows.

    gltest replaces fd 0 with a temporary file and immediately unlinks that
    file. POSIX permits unlinking an open file, but Windows raises WinError 32.
    Keep the temp path until VM teardown restores stdin, then remove it.

    This patch touches only the local Direct Mode test harness. It never changes
    the contract source or runtime behavior on GenLayer.
    """
    if os.name != 'nt':
        return

    import time
    import tempfile
    from gltest.direct import loader as gl_loader
    from gltest.direct.vm import VMContext

    if getattr(VMContext, '_sourcegate_win32_stdio_patch', False):
        return

    original_cleanup = VMContext._cleanup_after_deactivate

    def windows_safe_inject_message_to_fd0(vm):
        # genlayer-test 0.29.2 does not export import_calldata/import_address
        # from gltest.direct.loader. setup_sdk_paths() has already placed the
        # pinned GenVM SDK on sys.path before this hook runs, so use the exact
        # SDK imports used by the upstream 0.29.2 loader itself.
        try:
            from genlayer.py import calldata
            from genlayer.py.types import Address
        except ImportError:
            return

        sender_addr = vm.sender
        if isinstance(sender_addr, bytes):
            sender_addr = Address(sender_addr)

        contract_addr = vm._contract_address
        if isinstance(contract_addr, bytes):
            contract_addr = Address(contract_addr)

        origin_addr = vm.origin
        if isinstance(origin_addr, bytes):
            origin_addr = Address(origin_addr)

        message_data = {
            'contract_address': contract_addr,
            'sender_address': sender_addr,
            'origin_address': origin_addr,
            'stack': [],
            'value': vm._value,
            'datetime': vm._datetime,
            'is_init': False,
            'chain_id': vm._chain_id,
            'entry_kind': 0,
            'entry_data': b'',
            'entry_stage_data': None,
        }
        encoded = calldata.encode(message_data)

        fd, path = tempfile.mkstemp(prefix='sourcegate-gltest-', suffix='.bin')
        try:
            os.write(fd, encoded)
            os.lseek(fd, 0, os.SEEK_SET)
            vm._original_stdin_fd = os.dup(0)
            os.dup2(fd, 0)
            vm._sourcegate_stdin_temp_path = path
        finally:
            os.close(fd)
            # Do NOT unlink here on Windows: fd 0 still holds this file open.

    def windows_safe_cleanup(self):
        path = getattr(self, '_sourcegate_stdin_temp_path', None)
        try:
            original_cleanup(self)  # restores fd 0 first
        finally:
            if path:
                for _ in range(20):
                    try:
                        os.unlink(path)
                        break
                    except FileNotFoundError:
                        break
                    except PermissionError:
                        time.sleep(0.05)
                self._sourcegate_stdin_temp_path = None

    gl_loader._inject_message_to_fd0 = windows_safe_inject_message_to_fd0
    VMContext._cleanup_after_deactivate = windows_safe_cleanup
    VMContext._sourcegate_win32_stdio_patch = True


_install_windows_gltest_stdio_fix()


def _install_transactional_expect_revert_fix():
    """Make Direct Mode expected-revert checks model transaction atomicity.

    genlayer-test 0.29.2's ``expect_revert`` only catches the exception; it
    does not restore writes performed earlier in the same Python call. A real
    GenLayer transaction is atomic, so a reverted transaction must expose the
    exact pre-call state. Wrap ``expect_revert`` with VM snapshot/revert so the
    Direct Mode harness tests the production rollback invariant instead of
    leaking partial in-memory writes.

    This is test-harness-only and does not alter the contract source.
    """
    from contextlib import contextmanager
    from gltest.direct.vm import VMContext

    if getattr(VMContext, '_sourcegate_atomic_revert_patch', False):
        return

    original_expect_revert = VMContext.expect_revert

    @contextmanager
    def transactional_expect_revert(self, message=None):
        snapshot_id = self.snapshot()
        try:
            with original_expect_revert(self, message):
                yield
        finally:
            # Production semantics: any rejected/reverted write transaction
            # exposes no partial storage/balance/mock/message side effects.
            self.revert(snapshot_id)

    VMContext.expect_revert = transactional_expect_revert
    VMContext._sourcegate_atomic_revert_patch = True


_install_transactional_expect_revert_fix()
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
