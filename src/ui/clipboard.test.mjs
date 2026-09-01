import test from 'node:test';
import assert from 'node:assert/strict';

import {
  copyLedger,
  copyText,
  copyViaExecCommand,
  formatDiagnostics,
  formatLedger,
  formatLedgerEntry,
  COPY_FEEDBACK,
  COPY_MODE,
} from './clipboard.js';
import { toRow } from './activity.js';

const ENTRIES = [
  {
    seq: 1,
    ts: '2026-09-01T14:07:50.000Z',
    actor: 'agent',
    action: 'read_manuscript',
    manuscript_id: 'MS-102',
    outcome: 'accepted',
    code: null,
    visible_fields_at_time: ['manuscript.id', 'manuscript.title'],
    note: null,
  },
  {
    seq: 2,
    ts: '2026-09-01T14:07:52.118Z',
    actor: 'agent',
    action: 'assert_finding',
    manuscript_id: 'MS-102',
    outcome: 'refused',
    code: 'EVIDENCE_NOT_FOUND',
    visible_fields_at_time: ['manuscript.id'],
    note: 'rigor / weakness / discussion / no match',
  },
  {
    seq: 3,
    ts: '2026-09-01T14:08:10.000Z',
    actor: 'human',
    action: 'unblind',
    manuscript_id: 'MS-102',
    outcome: 'accepted',
    code: null,
    visible_fields_at_time: ['manuscript.id', 'identity.authors[].name'],
    note: null,
  },
];

/* -- formatting ----------------------------------------------------------- */

test('the export carries refusals, and says so in the header', () => {
  const text = formatLedger(ENTRIES, { toRow, exportedAt: 'T' });
  assert.match(text, /3 events — 2 accepted, 1 refused/);
  assert.match(text, /A refusal is a settled outcome, not an error/);
  assert.match(text, /EVIDENCE_NOT_FOUND/);
});

test('the export carries both registers for every row', () => {
  const text = formatLedger(ENTRIES, { toRow, exportedAt: 'T' });
  assert.match(text, /assert_finding\s+REFUSED EVIDENCE_NOT_FOUND/);
  assert.match(text, /does not appear in the manuscript/);
});

test('rows are emitted in seq order regardless of input order', () => {
  const shuffled = [ENTRIES[2], ENTRIES[0], ENTRIES[1]];
  const text = formatLedger(shuffled, { toRow, exportedAt: 'T' });
  const order = [...text.matchAll(/^#\s*(\d+)/gm)].map((m) => Number(m[1]));
  assert.deepEqual(order, [1, 2, 3]);
});

test('a filtered export announces that it is not the complete ledger', () => {
  const text = formatLedger([ENTRIES[1]], {
    toRow, exportedAt: 'T', filtered: true, filterLabel: 'refused only',
  });
  assert.match(text, /FILTERED VIEW — this is not the complete ledger \(refused only\)/);
});

test('an empty ledger exports the teaching copy, not a blank file', () => {
  const text = formatLedger([], { exportedAt: 'T' });
  assert.match(text, /No activity yet/);
  assert.match(text, /accepted or/);
});

test('the export records the fields the actor could see at the time', () => {
  const line = formatLedgerEntry(ENTRIES[2], { toRow });
  assert.match(line, /visible_fields_at_time \(2\)/);
  assert.match(line, /identity\.authors\[\]\.name/);
});

test('formatting a malformed entry does not throw', () => {
  assert.doesNotThrow(() => formatLedgerEntry({}, { toRow }));
  assert.doesNotThrow(() => formatLedger(null, {}));
  assert.doesNotThrow(() => formatLedger(undefined, {}));
});

/* -- copying ------------------------------------------------------------- */

test('tier 1 is used when the async clipboard is available', async () => {
  let written = null;
  const result = await copyText('hello', {
    navigator: { clipboard: { writeText: async (t) => { written = t; } } },
    document: null,
  });
  assert.deepEqual(result, { ok: true, mode: COPY_MODE.ASYNC_API, manual: false });
  assert.equal(written, 'hello');
});

test('a denied clipboard permission falls through to execCommand', async () => {
  let copied = false;
  const node = { style: {}, setAttribute() {}, select() {}, setSelectionRange() {}, parentNode: null };
  const doc = {
    createElement: () => node,
    execCommand: () => { copied = true; return true; },
    body: { appendChild: (n) => { n.parentNode = { removeChild() {} }; } },
  };
  const result = await copyText('hello', {
    navigator: { clipboard: { writeText: async () => { throw new Error('NotAllowedError'); } } },
    document: doc,
  });
  assert.equal(result.mode, COPY_MODE.EXEC_COMMAND);
  assert.equal(result.ok, true);
  assert.equal(copied, true);
});

test('with no clipboard APIs at all, the text is selected for the user to copy', async () => {
  let selected = false;
  const target = { ownerDocument: { createRange: () => ({ selectNodeContents() {} }) }, focus() {} };
  const result = await copyText('hello', {
    navigator: null,
    document: null,
    window: {
      getSelection: () => ({ removeAllRanges() {}, addRange() { selected = true; } }),
    },
    selectTarget: target,
  });
  assert.equal(result.mode, COPY_MODE.MANUAL_SELECT);
  assert.equal(result.ok, false, 'the user has not pressed the key yet');
  assert.equal(result.manual, true);
  assert.equal(selected, true);
});

test('the manual fallback label tells the truth instead of claiming Copied', () => {
  assert.match(COPY_FEEDBACK[COPY_MODE.MANUAL_SELECT], /press your copy key/);
  assert.equal(COPY_FEEDBACK[COPY_MODE.ASYNC_API], 'Copied');
});

test('with nothing available at all the result is settled, not thrown', async () => {
  const result = await copyText('hello', { navigator: null, document: null, window: null });
  assert.equal(result.mode, COPY_MODE.UNAVAILABLE);
  assert.equal(result.ok, false);
  assert.match(COPY_FEEDBACK[COPY_MODE.UNAVAILABLE], /Select the text and copy it/);
});

test('copyViaExecCommand returns false rather than throwing on a hostile document', () => {
  assert.equal(copyViaExecCommand('x', null), false);
  assert.equal(copyViaExecCommand('x', { createElement: () => { throw new Error('no'); } }), false);
});

test('copyLedger returns the text it tried to copy, so a failure is still recoverable', async () => {
  const result = await copyLedger({
    entries: ENTRIES, toRow, exportedAt: 'T', navigator: null, document: null, window: null,
  });
  assert.equal(result.ok, false);
  assert.ok(result.text.includes('EVIDENCE_NOT_FOUND'));
  assert.equal(result.bytes, result.text.length);
});

/* -- diagnostics ---------------------------------------------------------- */

test('diagnostics carry no manuscript text and no ledger content', () => {
  const text = formatDiagnostics({
    region: 'ledger.log', state: 'error', message: 'render blew up',
    ledgerLength: 3, storageMode: 'memory', seedHash: 'fnv1a32-3b7c19d0', at: 'T',
  });
  assert.match(text, /region {4}ledger\.log/);
  assert.match(text, /ledger {4}3 events/);
  assert.equal(text.includes('EVIDENCE_NOT_FOUND'), false);
  assert.equal(text.includes('MS-102'), false);
});
