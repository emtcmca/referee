/**
 * src/core/ledger.test.mjs — append-only round trip through storage, including a REFUSAL.
 *
 * The property under test is the one that has already broken once on this project: a row is
 * written with outcome 'accepted' and read back with the same literal, so replaying the log
 * produces a non-empty findings list. A reader testing 'ok' matches zero rows and the
 * findings board goes silently, permanently empty.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendLedger, deriveFindings, deriveEditorFlags, deriveHumanEvidence, hasRead,
  ledgerSeqIsDense
} from './ledger.js';
import {
  loadState, flush, serializeState, validatePersisted, rebuildDerived, resetSession
} from './state.js';
import { STATE_KEY } from './constants.js';
import { PUBLIC_FIELD_PATHS, IDENTITY_FIELD_PATHS } from './field-paths.js';

/**
 * Static imports only. The blinding guard fails on any dynamic import expression under src/, test files
 * included, so the storage shim cannot be installed by deferring the import. It does not
 * need to be: state.js reads `typeof localStorage` at CALL time inside storage(), never at
 * module load, so assigning it in the module body — before any test callback runs — is enough.
 */
class MemoryStorage {
  #m = new Map();
  getItem(k) { return this.#m.has(k) ? this.#m.get(k) : null; }
  setItem(k, v) { this.#m.set(k, String(v)); }
  removeItem(k) { this.#m.delete(k); }
  clear() { this.#m.clear(); }
}
globalThis.localStorage = new MemoryStorage();

function freshSession() {
  localStorage.clear();
  return loadState();
}

/** The args_digest 03 §4.3's digest override puts on an accepted assert_finding row. */
function findingDigest(over = {}) {
  return {
    criterion: 'rigor',
    section: 'methods',
    evidence_quote: 'Borehole control points were withheld entirely from tuning',
    normalized_quote: 'borehole control points were withheld entirely from tuning',
    verification: { method: 'exact', score: 1, char_offset: 412,
                    verified_against: 'agent_visible_text' },
    claim: 'The validation design is clean: control points were held out end to end.',
    polarity: 'strength',
    severity: 'major',
    score: 9,
    asserted_at: '2026-09-01T14:07:52.118Z',
    ...over
  };
}

test('round trip: append accepted + refused rows, reload from storage, replay non-empty', () => {
  const state = freshSession();

  appendLedger({
    actor: 'agent', action: 'read_manuscript', manuscript_id: 'MS-101',
    args_digest: { manuscript_id: 'MS-101', sections_requested: ['methods'],
                   sections_returned: ['methods'] },
    outcome: 'accepted', code: null, note: 'read 1 section'
  });

  appendLedger({
    actor: 'agent', action: 'assert_finding', manuscript_id: 'MS-101',
    args_digest: findingDigest(),
    outcome: 'accepted', code: null, note: 'rigor / strength / methods / exact match'
  });

  // THE REFUSAL. It is a first-class row and it must survive the round trip.
  const refusal = appendLedger({
    actor: 'agent', action: 'assert_finding', manuscript_id: 'MS-101',
    args_digest: { criterion: 'clarity', section: 'methods' },
    outcome: 'refused', code: 'EVIDENCE_NOT_FOUND',
    note: 'clarity / methods / quote not found in the agent-visible text'
  });
  assert.equal(refusal.outcome, 'refused');
  assert.equal(refusal.code, 'EVIDENCE_NOT_FOUND');

  appendLedger({
    actor: 'human', action: 'add_note', manuscript_id: 'MS-101',
    args_digest: { section_id: 'methods', note: 'Agree with the hold-out point.' },
    outcome: 'accepted', code: null, note: null
  });

  // Force the debounced write, then reload from the SAME storage.
  flush(state, 'test');
  const raw = localStorage.getItem(STATE_KEY);
  assert.ok(raw, 'state must be on disk after flush');

  const reloaded = loadState();
  assert.equal(reloaded.notice, null, 'a clean round trip must not raise a discard notice');
  assert.equal(reloaded.ledger.length, 5, 'session_reset + 4 rows');
  assert.ok(ledgerSeqIsDense(reloaded.ledger));

  // Replay AFTER the reload. This is the assertion that would have caught the 'ok' bug.
  const findings = deriveFindings(reloaded);
  assert.equal(findings.length, 1, 'derived findings must be NON-EMPTY after reload');
  assert.equal(findings[0].manuscript_id, 'MS-101');
  assert.equal(findings[0].criterion, 'rigor');
  assert.equal(findings[0].status, 'active');
  assert.equal(findings[0].verification.verified_against, 'agent_visible_text');
  assert.ok(findings[0].finding_id.startsWith('f_'));

  // The refusal is on the record and is NOT a finding.
  const refusals = reloaded.ledger.filter((e) => e.outcome === 'refused');
  assert.equal(refusals.length, 1);
  assert.ok(!findings.some((f) => f.criterion === 'clarity'));

  const evidence = deriveHumanEvidence(reloaded);
  assert.equal(evidence.length, 1);
  assert.ok(evidence[0].id.startsWith('he_'));
  assert.equal(evidence[0].saw_identity, false, 'no unblind happened, so this stays false');

  assert.equal(hasRead(reloaded, 'MS-101'), true);
  assert.equal(hasRead(reloaded, 'MS-101', 'methods'), true);
  assert.equal(hasRead(reloaded, 'MS-101', 'results'), false);
  assert.equal(hasRead(reloaded, 'MS-102'), false);
});

test('the replay predicate is accepted, not ok — an ok row is not a finding', () => {
  const state = freshSession();
  // Written past the validator on purpose, to prove the READER is the thing under test.
  state.ledger.push({
    seq: state.ledger.length + 1, ts: 'T', actor: 'agent', action: 'assert_finding',
    manuscript_id: 'MS-101', args_digest: findingDigest(), outcome: 'ok', code: null,
    visible_fields_at_time: [], note: null
  });
  assert.equal(deriveFindings(state).length, 0,
    "a row stamped 'ok' must not replay as a finding; the writer stamps 'accepted'");
});

test('appendLedger refuses to write an ok outcome at all', () => {
  const state = freshSession();
  assert.throws(() => appendLedger({
    actor: 'agent', action: 'assert_finding', manuscript_id: 'MS-101',
    args_digest: {}, outcome: 'ok', code: null
  }), /outcome must be 'accepted' or 'refused'/);
});

test('supersession is an ordering fact: later accepted row wins per (manuscript, criterion)', () => {
  const state = freshSession();
  appendLedger({ actor: 'agent', action: 'assert_finding', manuscript_id: 'MS-101',
    args_digest: findingDigest({ score: 5 }), outcome: 'accepted', code: null });
  appendLedger({ actor: 'agent', action: 'assert_finding', manuscript_id: 'MS-101',
    args_digest: findingDigest({ score: 9 }), outcome: 'accepted', code: null });

  const findings = deriveFindings(state);
  assert.equal(findings.length, 2, 'both rows survive — nothing is ever edited or removed');
  assert.equal(findings[0].status, 'superseded');
  assert.equal(findings[1].status, 'active');
  assert.equal(findings[0].superseded_by, findings[1].finding_id);
  assert.equal(findings.filter((f) => f.status === 'active').length, 1);
});

test('a different criterion does not supersede — supersession is keyed on the pair', () => {
  const state = freshSession();
  appendLedger({ actor: 'agent', action: 'assert_finding', manuscript_id: 'MS-101',
    args_digest: findingDigest({ criterion: 'rigor' }), outcome: 'accepted', code: null });
  appendLedger({ actor: 'agent', action: 'assert_finding', manuscript_id: 'MS-101',
    args_digest: findingDigest({ criterion: 'clarity' }), outcome: 'accepted', code: null });
  assert.equal(deriveFindings(state).filter((f) => f.status === 'active').length, 2);
});

test('every agent row carries the IDENTICAL visible-fields array, before and after unblind', () => {
  const state = freshSession();
  appendLedger({ actor: 'agent', action: 'read_manuscript', manuscript_id: 'MS-101',
    args_digest: {}, outcome: 'accepted', code: null });

  // The human unblinds. The agent's view must not move.
  state.unblinded.push({ id: 'MS-101', reason: 'conflict check', at: 'T' });
  appendLedger({ actor: 'human', action: 'unblind', manuscript_id: 'MS-101',
    args_digest: { reason: 'conflict check' }, outcome: 'accepted', code: null });
  appendLedger({ actor: 'agent', action: 'read_manuscript', manuscript_id: 'MS-101',
    args_digest: {}, outcome: 'accepted', code: null });

  const agentRows = state.ledger.filter((e) => e.actor === 'agent');
  assert.equal(agentRows.length, 2);
  assert.deepEqual(agentRows[0].visible_fields_at_time, agentRows[1].visible_fields_at_time,
    'the agent row after an unblind must be byte-identical to the one before it');
  assert.deepEqual(agentRows[1].visible_fields_at_time, PUBLIC_FIELD_PATHS);
  for (const p of agentRows[1].visible_fields_at_time) {
    assert.ok(!p.startsWith('identity.'), `agent row leaked an identity path: ${p}`);
  }

  // The HUMAN row after the unblind widens, visibly. That widening is the record's point.
  const humanUnblindRow = state.ledger.find((e) => e.action === 'unblind');
  assert.deepEqual(humanUnblindRow.visible_fields_at_time,
    [...PUBLIC_FIELD_PATHS, ...IDENTITY_FIELD_PATHS]);
});

test('a human note written after an unblind records saw_identity true, and stays true', () => {
  const state = freshSession();
  state.unblinded.push({ id: 'MS-101', reason: 'suspected dual submission', at: 'T' });
  appendLedger({ actor: 'human', action: 'add_note', manuscript_id: 'MS-101',
    args_digest: { section_id: null, note: 'Same group as the 2023 desk reject.' },
    outcome: 'accepted', code: null });
  const [he] = deriveHumanEvidence(state);
  assert.equal(he.saw_identity, true);
});

test('ledger actions are BARE — a prefixed action is refused', () => {
  const state = freshSession();
  assert.throws(() => appendLedger({
    actor: 'human', action: 'human:unblind', manuscript_id: 'MS-101',
    args_digest: {}, outcome: 'accepted', code: null
  }), /is prefixed/);
});

test('set_score is dead — no human verb writes a score', () => {
  const state = freshSession();
  assert.throws(() => appendLedger({
    actor: 'human', action: 'set_score', manuscript_id: 'MS-101',
    args_digest: {}, outcome: 'accepted', code: null
  }), /not one of the five human verbs/);
});

test('a refused row without a frozen refusal code is rejected', () => {
  const state = freshSession();
  assert.throws(() => appendLedger({
    actor: 'agent', action: 'assert_finding', manuscript_id: 'MS-101',
    args_digest: {}, outcome: 'refused', code: 'MALFORMED_INPUT'   // dead spelling
  }), /frozen refusal code/);
});

test('editor flags replay with the flag_ id grammar and 03 §4.6 concern_type', () => {
  const state = freshSession();
  appendLedger({ actor: 'agent', action: 'flag_for_editor', manuscript_id: 'MS-102',
    args_digest: { concern_type: 'prompt_injection', note: 'Instruction-shaped span in abstract.' },
    outcome: 'accepted', code: null });
  const [flag] = deriveEditorFlags(state);
  assert.ok(flag.id.startsWith('flag_'));
  assert.equal(flag.concern_type, 'prompt_injection');
  assert.equal(flag.actor, 'agent');
});

test('seq is monotonic and dense across accepted and refused rows alike', () => {
  const state = freshSession();
  for (let i = 0; i < 6; i++) {
    appendLedger({
      actor: 'agent', action: 'get_review_state', manuscript_id: null, args_digest: {},
      outcome: i % 2 ? 'refused' : 'accepted', code: i % 2 ? 'OUT_OF_ORDER' : null
    });
  }
  assert.ok(ledgerSeqIsDense(state.ledger));
  assert.deepEqual(state.ledger.map((e) => e.seq), [1, 2, 3, 4, 5, 6, 7]);
});

test('stored ledger entries are frozen — the log cannot be edited in place', () => {
  const state = freshSession();
  const entry = appendLedger({ actor: 'agent', action: 'get_review_state', manuscript_id: null,
    args_digest: {}, outcome: 'accepted', code: null });
  assert.ok(Object.isFrozen(entry));
  assert.throws(() => { 'use strict'; entry.outcome = 'refused'; });
});

test('serializeState writes exactly the seven persisted keys', () => {
  const state = freshSession();
  rebuildDerived(state);
  assert.ok(state.findings, 'derived state exists in memory');
  const parsed = JSON.parse(serializeState(state));
  assert.deepEqual(Object.keys(parsed).sort(),
    ['committed', 'ledger', 'rubricWeights', 'scores', 'seedHash', 'unblinded', 'version']);
  assert.equal(validatePersisted(parsed), null);
});

test('reset restores the seed exactly and clears the log to one session_reset row', () => {
  const state = freshSession();
  appendLedger({ actor: 'agent', action: 'assert_finding', manuscript_id: 'MS-101',
    args_digest: findingDigest(), outcome: 'accepted', code: null });
  const fresh = resetSession();
  assert.equal(fresh.ledger.length, 1);
  assert.equal(fresh.ledger[0].action, 'session_reset');
  assert.equal(fresh.committed, null);
  assert.deepEqual(fresh.unblinded, []);
  assert.equal(fresh.seedHash, state.seedHash, 'reset must not move the seed hash');
  assert.equal(deriveFindings(fresh).length, 0);
});
