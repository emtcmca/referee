/**
 * src/tools/tools.test.mjs — the seven handlers through the public surface.
 *
 * Everything here drives execute() the way a host would: an args object in, a JSON STRING
 * out. Nothing reaches into a handler's internals, because the string boundary is the thing
 * the agent actually sees and therefore the thing worth proving.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildToolDefinitions } from './index.js';
import { assertFindingHandler } from './handlers/assert-finding.js';
import { CODES, TERMINAL_CODES } from './envelope.js';
import {
  makeState, makeCaps, call, fakeNormalize, ABSTRACT_TEXT, METHODS_TEXT,
  verifyOk, verifyMiss, verifyShort, verifyFault
} from './__fixtures__/harness.js';

/** A fully wired lane: state, capability double, and the seven definitions built on both. */
function rig(opts = {}) {
  const state = makeState(opts.state);
  const caps = makeCaps(state, opts);
  const defs = buildToolDefinitions(caps, { state, normalizeText: fakeNormalize });
  return { state, caps, defs };
}

/** The normal precursor: an accepted read of MS-101, which satisfies P1 and P2. */
async function readFirst(defs) {
  const { payload } = await call(defs, 'read_manuscript', { manuscript_id: 'MS-101' });
  assert.equal(payload.ok, true);
  return payload;
}

const FINDING = {
  manuscript_id: 'MS-101',
  criterion: 'rigor',
  section: 'methods',
  evidence_quote: METHODS_TEXT,
  claim: 'The tuning protocol undermines the reported generalization.',
  polarity: 'weakness',
  severity: 'major',
  score: 4
};

// =========================================================================================
describe('D1 — every return is a JSON string, success and refusal alike', () => {
// =========================================================================================
  test('a success serializes to a string', async () => {
    const { defs } = rig();
    const def = defs.find((d) => d.name === 'get_review_state');
    const raw = await def.execute({}, { signal: new AbortController().signal });
    assert.equal(typeof raw, 'string');
    assert.equal(JSON.parse(raw).ok, true);
  });

  test('a refusal serializes to a string', async () => {
    const { defs } = rig();
    const def = defs.find((d) => d.name === 'submit_recommendation');
    const raw = await def.execute(
      { manuscript_id: 'MS-101', recommendation: 'reject',
        rationale: 'x'.repeat(40) }, { signal: new AbortController().signal });
    assert.equal(typeof raw, 'string');
    assert.equal(JSON.parse(raw).ok, false);
  });

  test('a JSON STRING of arguments is accepted, as some hosts deliver', async () => {
    const { defs } = rig();
    const def = defs.find((d) => d.name === 'get_review_state');
    const raw = await def.execute(JSON.stringify({ manuscript_id: 'MS-101' }));
    assert.equal(JSON.parse(raw).ok, true);
  });

  test('unparseable string arguments refuse, they do not throw', async () => {
    const { defs } = rig();
    const def = defs.find((d) => d.name === 'get_review_state');
    const raw = await def.execute('{not json');
    assert.equal(JSON.parse(raw).code, CODES.INVALID_ARGUMENT);
  });
});

// =========================================================================================
describe('D2 — policy refusals are RETURNED, never THROWN', () => {
// =========================================================================================
  test('a handler that throws becomes INTERNAL rather than escaping execute()', async () => {
    const { defs } = rig({
      overrides: { deriveFindings: () => { throw new Error('boom'); } }
    });
    const raw = await defs.find((d) => d.name === 'get_review_state').execute({});
    const p = JSON.parse(raw);
    assert.equal(p.ok, false);
    assert.equal(p.code, CODES.INTERNAL);
    assert.equal(p.retry.possible, false);
  });

  test('a state fault becomes INTERNAL, not a raw throw out of execute()', async () => {
    const state = makeState();
    const caps = makeCaps(state);
    const defs = buildToolDefinitions(caps, {
      getState: () => { throw new Error('localStorage is partitioned'); }
    });
    const raw = await defs.find((d) => d.name === 'get_review_state').execute({});
    assert.equal(typeof raw, 'string');
    assert.equal(JSON.parse(raw).code, CODES.INTERNAL);
  });

  test('every one of the seven refuses rather than throws on a nonsense argument', async () => {
    const { defs } = rig();
    for (const def of defs) {
      const raw = await def.execute({ manuscript_id: 12345, bogus: true });
      assert.equal(typeof raw, 'string', `${def.name} did not return a string`);
      assert.equal(JSON.parse(raw).ok, false, `${def.name} accepted junk`);
    }
  });
});

// =========================================================================================
describe('the eleven refusal codes', () => {
// =========================================================================================
  test('INVALID_ARGUMENT — schema violation, with the violations listed', async () => {
    const { defs } = rig();
    const { payload } = await call(defs, 'read_manuscript', { sections: ['methods'] });
    assert.equal(payload.code, CODES.INVALID_ARGUMENT);
    assert.equal(payload.retry.possible, true);
    assert.ok(payload.retry.with.violations.some((v) => v.path === '$.manuscript_id'));
  });

  test('INVALID_ARGUMENT — additionalProperties:false is enforced by the page', async () => {
    const { defs } = rig();
    const { payload } = await call(defs, 'read_manuscript',
      { manuscript_id: 'MS-101', unexpected: 1 });
    assert.equal(payload.code, CODES.INVALID_ARGUMENT);
  });

  test('UNKNOWN_MANUSCRIPT — a valid-looking id that is not in the queue', async () => {
    const { defs } = rig();
    const { payload } = await call(defs, 'read_manuscript', { manuscript_id: 'MS-109' });
    assert.equal(payload.code, CODES.UNKNOWN_MANUSCRIPT);
    assert.ok(payload.retry.with.known_manuscript_ids.includes('MS-101'));
  });

  test('SECTION_NOT_FOUND — a legal section id this manuscript does not carry', async () => {
    const { defs } = rig();
    await readFirst(defs);
    const { payload } = await call(defs, 'check_claim',
      { manuscript_id: 'MS-101', section: 'discussion', evidence_quote: METHODS_TEXT });
    assert.equal(payload.code, CODES.SECTION_NOT_FOUND);
    assert.deepEqual(payload.retry.with.available_sections, ['abstract', 'methods']);
  });

  test('SECTION_NOT_FOUND — sections[] takes the same path as a singular section', async () => {
    const { defs } = rig();
    const { payload } = await call(defs, 'read_manuscript',
      { manuscript_id: 'MS-101', sections: ['abstract', 'discussion'] });
    assert.equal(payload.code, CODES.SECTION_NOT_FOUND);
    assert.deepEqual(payload.retry.with.requested_unknown, ['discussion']);
  });

  test('QUOTE_TOO_SHORT — reports the shortfall so the retry is computable', async () => {
    const { defs } = rig({ verify: verifyShort });
    await readFirst(defs);
    const { payload } = await call(defs, 'assert_finding', FINDING);
    assert.equal(payload.code, CODES.QUOTE_TOO_SHORT);
    assert.equal(payload.retry.with.min_length, 40);
    assert.equal(payload.retry.with.normalized_quote_length, 22);
    assert.equal(payload.retry.with.shortfall, 18);
  });

  test('EVIDENCE_NOT_FOUND — the headline refusal', async () => {
    const { defs } = rig({ verify: verifyMiss });
    await readFirst(defs);
    const { payload } = await call(defs, 'assert_finding', FINDING);
    assert.equal(payload.ok, false);
    assert.equal(payload.code, CODES.EVIDENCE_NOT_FOUND);
    assert.equal(payload.retry.possible, true);
    assert.equal(payload.retry.with.normalized_quote, fakeNormalize(METHODS_TEXT));
    assert.equal(payload.retry.with.normalization_applied.length, 7);
    assert.equal(payload.retry.with.normalization_applied[0], 'strip-format-characters');
  });

  test('INVALID_CRITERION — reachable when a host does not enforce the enum', () => {
    // execute() rejects this at the schema, so the code is exercised where it actually
    // lives: the in-code re-check that exists precisely because a host may not enforce enum.
    const state = makeState();
    const caps = makeCaps(state);
    const r = assertFindingHandler({
      args: { ...FINDING, criterion: 'significance' },
      state, caps, deps: {}, next: () => null
    });
    assert.equal(r.refusal.code, CODES.INVALID_CRITERION);
    assert.equal(r.refusal.retry.with.supplied, 'significance');
    assert.deepEqual(r.refusal.retry.with.valid_criteria,
      ['novelty', 'rigor', 'clarity', 'reproducibility']);
  });

  test('OUT_OF_ORDER — P1, no read of this manuscript in this session', async () => {
    const { defs } = rig();
    const { payload } = await call(defs, 'assert_finding', FINDING);
    assert.equal(payload.code, CODES.OUT_OF_ORDER);
    assert.equal(payload.retry.with.unmet_precondition, 'P1');
    assert.deepEqual(payload.retry.with.required_call,
      { tool: 'read_manuscript', args: { manuscript_id: 'MS-101' } });
  });

  test('OUT_OF_ORDER — P2, the manuscript was read but not this section', async () => {
    const { defs } = rig();
    await call(defs, 'read_manuscript', { manuscript_id: 'MS-101', sections: ['abstract'] });
    const { payload } = await call(defs, 'assert_finding', FINDING);
    assert.equal(payload.code, CODES.OUT_OF_ORDER);
    assert.equal(payload.retry.with.unmet_precondition, 'P2');
    assert.deepEqual(payload.retry.with.required_call.args.sections, ['methods']);
  });

  test('ALREADY_COMMITTED — the manuscript is frozen and the retry is terminal', async () => {
    const { defs } = rig({
      state: { committed: { manuscript_id: 'MS-101', recommendation: 'reject',
                            rationale: 'r', committed_at: 'T', by: 'human', ledger_seq: 3 } }
    });
    await readFirst(defs);
    const { payload } = await call(defs, 'assert_finding', FINDING);
    assert.equal(payload.code, CODES.ALREADY_COMMITTED);
    assert.equal(payload.retry.possible, false);
    assert.equal(payload.retry.with.ledger_seq, 3);
  });

  test('REQUIRES_HUMAN — submit_recommendation, always, and it hands the proposal back', async () => {
    const { defs } = rig();
    const { payload } = await call(defs, 'submit_recommendation', {
      manuscript_id: 'MS-101', recommendation: 'major_revision',
      rationale: 'The tuning protocol undermines the reported generalization claim.'
    });
    assert.equal(payload.code, CODES.REQUIRES_HUMAN);
    assert.equal(payload.retry.possible, false);
    assert.equal(payload.retry.with.proposed_recommendation, 'major_revision');
    assert.equal(payload.retry.with.decision_owner, 'human');
  });

  test('HUMAN_ONLY — request_unblind, always', async () => {
    const { defs } = rig();
    const { payload } = await call(defs, 'request_unblind', {
      manuscript_id: 'MS-101',
      reason: 'The methods section hints at an undisclosed vendor relationship.'
    });
    assert.equal(payload.code, CODES.HUMAN_ONLY);
    assert.equal(payload.retry.possible, false);
    assert.equal(payload.retry.with.identity_reachable_by_tools, false);
  });

  test('INTERNAL — read_manuscript fails CLOSED when the sanitizer is unwired', async () => {
    const { defs } = rig({ agentText: () => undefined });
    const { payload } = await call(defs, 'read_manuscript', { manuscript_id: 'MS-101' });
    assert.equal(payload.code, CODES.INTERNAL);
    assert.equal(payload.retry.possible, false);
  });

  test('the four terminal codes always carry retry.possible:false', async () => {
    const { defs } = rig();
    for (const code of TERMINAL_CODES) assert.ok(typeof code === 'string');
    // request_unblind is the cheapest terminal to reach end-to-end.
    const { payload } = await call(defs, 'request_unblind',
      { manuscript_id: 'MS-101', reason: 'A twenty character reason at minimum here.' });
    assert.equal(payload.retry.possible, false);
    assert.ok(TERMINAL_CODES.includes(payload.code));
  });
});

// =========================================================================================
describe('refusal precedence (03 §2.2)', () => {
// =========================================================================================
  test('human-only OUTRANKS ordering: submit_recommendation never says OUT_OF_ORDER', async () => {
    const { defs } = rig();                       // nothing read at all
    const { payload } = await call(defs, 'submit_recommendation', {
      manuscript_id: 'MS-101', recommendation: 'accept',
      rationale: 'Thirty or more characters of rationale, as the schema requires.'
    });
    assert.equal(payload.code, CODES.REQUIRES_HUMAN);
  });

  test('human-only OUTRANKS commit state: still REQUIRES_HUMAN on a frozen manuscript', async () => {
    const { defs } = rig({
      state: { committed: { manuscript_id: 'MS-101', recommendation: 'accept',
                            rationale: 'r', committed_at: 'T', by: 'human', ledger_seq: 1 } }
    });
    const { payload } = await call(defs, 'submit_recommendation', {
      manuscript_id: 'MS-101', recommendation: 'accept',
      rationale: 'Thirty or more characters of rationale, as the schema requires.'
    });
    assert.equal(payload.code, CODES.REQUIRES_HUMAN,
      'ALREADY_COMMITTED here would tell the agent something about state it has no need to know');
  });

  test('UNKNOWN_MANUSCRIPT outranks OUT_OF_ORDER', async () => {
    const { defs } = rig();
    const { payload } = await call(defs, 'assert_finding',
      { ...FINDING, manuscript_id: 'MS-112' });
    assert.equal(payload.code, CODES.UNKNOWN_MANUSCRIPT);
  });

  test('SECTION_NOT_FOUND outranks OUT_OF_ORDER', async () => {
    const { defs } = rig();
    const { payload } = await call(defs, 'assert_finding',
      { ...FINDING, section: 'results' });
    assert.equal(payload.code, CODES.SECTION_NOT_FOUND);
  });
});

// =========================================================================================
describe('the ledger — every call, accepted AND refused', () => {
// =========================================================================================
  test('an accepted call appends exactly one row', async () => {
    const { state, defs } = rig();
    await call(defs, 'get_review_state', {});
    assert.equal(state.ledger.length, 1);
    assert.equal(state.ledger[0].outcome, 'accepted');
    assert.equal(state.ledger[0].code, null);
    assert.equal(state.ledger[0].actor, 'agent');
    assert.equal(state.ledger[0].action, 'get_review_state');
  });

  test('a REFUSED call appends a row too — that record is the demo', async () => {
    const { state, defs } = rig();
    await call(defs, 'assert_finding', FINDING);
    assert.equal(state.ledger.length, 1);
    assert.equal(state.ledger[0].outcome, 'refused');
    assert.equal(state.ledger[0].code, CODES.OUT_OF_ORDER);
  });

  test('the ledger append is unskippable — it happens on every one of the seven', async () => {
    const { state, defs } = rig();
    for (const def of defs) await def.execute({});
    assert.equal(state.ledger.length, 7);
  });

  test('read_manuscript writes sections_returned, which is what P1/P2 read back', async () => {
    const { state, defs } = rig();
    await call(defs, 'read_manuscript', { manuscript_id: 'MS-101', sections: ['methods'] });
    assert.deepEqual(state.ledger[0].args_digest.sections_returned, ['methods']);
  });

  test('visible_fields_at_time is IDENTICAL on every agent row, before and after an unblind',
    async () => {
      const { state, defs } = rig();
      await call(defs, 'read_manuscript', { manuscript_id: 'MS-101' });
      // The human unblinds. The agent's view must not move by so much as one path.
      state.unblinded.push({ id: 'MS-101', reason: 'suspected COI', at: 'T' });
      await call(defs, 'read_manuscript', { manuscript_id: 'MS-101' });
      await call(defs, 'get_review_state', {});
      const [a, b, queueRow] = state.ledger;
      assert.deepEqual(b.visible_fields_at_time, a.visible_fields_at_time,
        'the agent branch of visibleFieldsFor must not consult state.unblinded');
      for (const row of [a, b, queueRow]) {
        assert.ok(!row.visible_fields_at_time.some((p) => p.startsWith('identity.')),
          'an identity path in an agent row would mean blinding had become masking');
      }
      // With no manuscript in scope the agent could still see the queue, so the queue paths
      // are what it was entitled to read — logging [] would understate the record (03 §0.5).
      assert.ok(queueRow.visible_fields_at_time.length > 0);
    });
});

// =========================================================================================
describe('assert_finding — the evidence gate', () => {
// =========================================================================================
  test('a verified quote is accepted and stamped verified_against agent_visible_text', async () => {
    const { defs } = rig();
    await readFirst(defs);
    const { payload } = await call(defs, 'assert_finding', FINDING);
    assert.equal(payload.ok, true);
    assert.equal(payload.accepted, true);
    assert.equal(payload.idempotent, false);
    assert.equal(payload.verification.verified_against, 'agent_visible_text');
    assert.equal(payload.verification.method, 'exact');
    assert.equal(payload.verification.threshold, 0.92);
    assert.equal(payload.verification.char_offset, 12);
    assert.equal(payload.supersedes, null);
    assert.ok(payload.finding_id.startsWith('f_'));
  });

  test('the accepted row carries the finding, so deriveFindings can rebuild it', async () => {
    const { state, caps, defs } = rig();
    await readFirst(defs);
    const { payload } = await call(defs, 'assert_finding', FINDING);
    const findings = caps.deriveFindings(state).filter((f) => f.status === 'active');
    assert.equal(findings.length, 1);
    assert.equal(findings[0].finding_id, payload.finding_id);
    assert.equal(findings[0].criterion, 'rigor');
    assert.equal(findings[0].verification.verified_against, 'agent_visible_text');
  });

  test('no tool writes a score — state.scores is untouched by an accepted finding', async () => {
    const { state, defs } = rig();
    const before = JSON.stringify(state.scores);
    await readFirst(defs);
    await call(defs, 'assert_finding', FINDING);
    assert.equal(JSON.stringify(state.scores), before);
    assert.equal(state.scores['MS-101'].rigor.set_by, 'seed');
  });

  test('IDEMPOTENCY — an identical re-call short-circuits and keeps the same finding_id',
    async () => {
      const { defs } = rig();
      await readFirst(defs);
      const first = await call(defs, 'assert_finding', FINDING);
      const again = await call(defs, 'assert_finding', FINDING);
      assert.equal(again.payload.idempotent, true);
      assert.equal(again.payload.finding_id, first.payload.finding_id);
      assert.equal(again.payload.supersedes, null);
      assert.equal(again.payload.verification.verified_against, 'agent_visible_text');
    });

  test('SUPERSESSION — a different quote for the same criterion supersedes, never overwrites',
    async () => {
      const { state, caps, defs } = rig();
      await readFirst(defs);
      const first = await call(defs, 'assert_finding', FINDING);
      const second = await call(defs, 'assert_finding',
        { ...FINDING, section: 'abstract', evidence_quote: ABSTRACT_TEXT, score: 8,
          polarity: 'strength' });

      assert.equal(second.payload.idempotent, false);
      assert.equal(second.payload.supersedes, first.payload.finding_id);

      const all = caps.deriveFindings(state);
      assert.equal(all.length, 2, 'both rows survive — the log is append-only');
      const active = all.filter((f) => f.status === 'active');
      assert.equal(active.length, 1);
      assert.equal(active[0].finding_id, second.payload.finding_id);
      assert.equal(all.find((f) => f.status === 'superseded').superseded_by,
        second.payload.finding_id);
    });

  test('criteria_missing shrinks as criteria are covered', async () => {
    const { defs } = rig();
    await readFirst(defs);
    const { payload } = await call(defs, 'assert_finding', FINDING);
    assert.deepEqual(payload.criteria_missing, ['novelty', 'clarity', 'reproducibility']);
  });
});

// =========================================================================================
describe('check_claim — the dry run, and the tightest oracle surface in the API', () => {
// =========================================================================================
  test('a passing check is SUPPORTED and would pass the gate', async () => {
    const { defs } = rig();
    await readFirst(defs);
    const { payload } = await call(defs, 'check_claim',
      { manuscript_id: 'MS-101', section: 'methods', evidence_quote: METHODS_TEXT });
    assert.equal(payload.ok, true);
    assert.equal(payload.result, 'SUPPORTED');
    assert.equal(payload.would_pass_assert_finding, true);
    assert.equal(payload.method, 'exact');
  });

  test('a failing check SUCCEEDS with NOT_SUPPORTED — that is why a dry run exists', async () => {
    const { defs } = rig({ verify: verifyMiss });
    await readFirst(defs);
    const { payload } = await call(defs, 'check_claim',
      { manuscript_id: 'MS-101', section: 'methods', evidence_quote: METHODS_TEXT });
    assert.equal(payload.ok, true, 'a non-matching quote is not an error');
    assert.equal(payload.result, 'NOT_SUPPORTED');
    assert.equal(payload.would_pass_assert_finding, false);
    assert.equal(payload.method, null);
  });

  test('a verifier fault is INDETERMINATE, never NOT_SUPPORTED', async () => {
    const { defs } = rig({ verify: verifyFault });
    await readFirst(defs);
    const { payload } = await call(defs, 'check_claim',
      { manuscript_id: 'MS-101', section: 'methods', evidence_quote: METHODS_TEXT });
    assert.equal(payload.result, 'INDETERMINATE');
    assert.equal(payload.would_pass_assert_finding, null);
  });

  test('check_claim NEVER emits EVIDENCE_NOT_FOUND', async () => {
    const { defs } = rig({ verify: verifyMiss });
    await readFirst(defs);
    const { payload } = await call(defs, 'check_claim',
      { manuscript_id: 'MS-101', section: 'methods', evidence_quote: METHODS_TEXT });
    assert.notEqual(payload.code, CODES.EVIDENCE_NOT_FOUND);
  });

  test('ORACLE SAFETY — nothing positional on ANY result, including a pass', async () => {
    const forbidden = ['char_offset', 'score', 'threshold', 'normalized_quote', 'match_count'];
    for (const verify of [verifyOk, verifyMiss, verifyFault]) {
      const { defs } = rig({ verify });
      await readFirst(defs);
      const { raw, payload } = await call(defs, 'check_claim',
        { manuscript_id: 'MS-101', section: 'methods', evidence_quote: METHODS_TEXT });
      for (const key of forbidden) {
        assert.equal(payload[key], undefined,
          `check_claim leaked ${key}: an offset on a free, unlogged tool makes the manuscript binary-searchable`);
        assert.ok(!raw.includes(`"${key}"`), `check_claim leaked ${key} somewhere in the payload`);
      }
    }
  });

  test('is idempotent and pure — same inputs, same verdict, one row each time', async () => {
    const { state, defs } = rig();
    await readFirst(defs);
    const a = await call(defs, 'check_claim',
      { manuscript_id: 'MS-101', section: 'methods', evidence_quote: METHODS_TEXT });
    const b = await call(defs, 'check_claim',
      { manuscript_id: 'MS-101', section: 'methods', evidence_quote: METHODS_TEXT });
    assert.equal(a.payload.result, b.payload.result);
    assert.equal(state.ledger.filter((e) => e.action === 'check_claim').length, 2);
  });
});

// =========================================================================================
describe('oracle-leakage rules (03 §7)', () => {
// =========================================================================================
  test('rule 3 — a blinded-domain section name and a nonsense one take the SAME path',
    async () => {
      const { defs } = rig();
      const a = await call(defs, 'read_manuscript',
        { manuscript_id: 'MS-101', sections: ['data_availability'] });
      const b = await call(defs, 'read_manuscript',
        { manuscript_id: 'MS-101', sections: ['related_work'] });
      assert.equal(a.payload.code, CODES.SECTION_NOT_FOUND);
      assert.equal(b.payload.code, CODES.SECTION_NOT_FOUND);
      assert.equal(a.payload.message, b.payload.message);
      assert.deepEqual(a.payload.retry.with.available_sections,
                       b.payload.retry.with.available_sections);
    });

  test('rule 4 — EVIDENCE_NOT_FOUND returns no score and no offset', async () => {
    const { defs } = rig({ verify: verifyMiss });
    await readFirst(defs);
    const { raw, payload } = await call(defs, 'assert_finding', FINDING);
    assert.equal(payload.retry.with.score, undefined);
    assert.equal(payload.retry.with.best_similarity, undefined);
    assert.equal(payload.retry.with.char_offset, undefined);
    assert.ok(!raw.includes('best_similarity'));
    assert.ok(!raw.includes('char_offset'));
  });

  test('rule 2 — blinded_fields is identical on every manuscript', async () => {
    const { defs } = rig();
    const q = await call(defs, 'get_review_state', {});
    const rows = q.payload.queue;
    assert.ok(rows.length >= 2);
    assert.deepEqual(rows[0].blinded_fields, rows[1].blinded_fields);
    const r = await call(defs, 'read_manuscript', { manuscript_id: 'MS-101' });
    assert.deepEqual(r.payload.blinded_fields, rows[0].blinded_fields);
  });

  test('rule 7 — request_unblind is constant across manuscripts and across unblind state',
    async () => {
      const { state, defs } = rig();
      const reason = 'A substantive twenty-plus character reason grounded in the public text.';
      const a = await call(defs, 'request_unblind', { manuscript_id: 'MS-101', reason });
      state.unblinded.push({ id: 'MS-101', reason: 'granted', at: 'T' });
      const b = await call(defs, 'request_unblind', { manuscript_id: 'MS-101', reason });
      const c = await call(defs, 'request_unblind', { manuscript_id: 'MS-102', reason });

      const strip = (p) => { const { ledger_seq, manuscript_id, ...rest } = p.retry.with; return rest; };
      assert.deepEqual(strip(a.payload), strip(b.payload),
        'the payload must not change once the human has unblinded');
      assert.deepEqual(strip(a.payload), strip(c.payload),
        'the payload must not vary by manuscript');
      assert.equal(a.payload.message, c.payload.message);
    });

  test('no tool return carries an identity key', async () => {
    const identityish = ['authors', 'affiliations', 'funding', 'acknowledgements',
                         'correspondence_email', 'author_notes', 'conflict_of_interest'];
    const { defs } = rig();
    await readFirst(defs);
    const results = [
      await call(defs, 'get_review_state', { manuscript_id: 'MS-101' }),
      await call(defs, 'read_manuscript', { manuscript_id: 'MS-101' }),
      await call(defs, 'assert_finding', FINDING)
    ];
    for (const { payload } of results) {
      const keys = new Set();
      (function walk(n) {
        if (!n || typeof n !== 'object') return;
        for (const k of Object.keys(n)) { keys.add(k); walk(n[k]); }
      })(payload);
      for (const bad of identityish) {
        assert.ok(!keys.has(bad), `${bad} appeared as a KEY in a tool return`);
      }
    }
  });
});

// =========================================================================================
describe('read_manuscript, flag_for_editor and get_review_state', () => {
// =========================================================================================
  test('read_manuscript returns sanitized sections in the document’s own order', async () => {
    const { defs } = rig();
    const { payload } = await call(defs, 'read_manuscript',
      { manuscript_id: 'MS-101', sections: ['methods', 'abstract'] });
    assert.deepEqual(payload.sections.map((s) => s.section), ['abstract', 'methods']);
    assert.equal(payload.sections[0].char_count, payload.sections[0].text.length);
  });

  test('read_manuscript discloses the integrity counts it is allowed to', async () => {
    const { defs } = rig();
    const { payload } = await call(defs, 'read_manuscript', { manuscript_id: 'MS-101' });
    assert.equal(payload.integrity.injection_attempts, 2);
    assert.deepEqual(payload.integrity.sections_affected, ['abstract']);
    assert.deepEqual(payload.integrity.event_ids, ['MS-101:abstract:1', 'MS-101:abstract:2']);
  });

  test('read_manuscript is repeatable and byte-identical', async () => {
    const { defs } = rig();
    const a = await call(defs, 'read_manuscript', { manuscript_id: 'MS-101' });
    const b = await call(defs, 'read_manuscript', { manuscript_id: 'MS-101' });
    assert.equal(a.payload.sections[0].text, b.payload.sections[0].text);
    assert.deepEqual(a.payload.integrity.event_ids, b.payload.integrity.event_ids);
  });

  test('flag_for_editor SUCCEEDS, and needs only P1', async () => {
    const { defs } = rig();
    await readFirst(defs);
    const { payload } = await call(defs, 'flag_for_editor', {
      manuscript_id: 'MS-101', concern_type: 'prompt_injection',
      summary: 'The abstract contains a span addressed to an automated reviewer.'
    });
    assert.equal(payload.ok, true);
    assert.ok(payload.flag_id.startsWith('flag_'));
    assert.equal(payload.affects_score, false);
    assert.equal(payload.affects_recommendation, false);
    assert.equal(payload.flags_on_manuscript, 1);
  });

  test('flag_for_editor is never deduplicated — two identical flags are two rows', async () => {
    const { defs } = rig();
    await readFirst(defs);
    const args = { manuscript_id: 'MS-101', concern_type: 'ethics',
                   summary: 'A concern long enough to satisfy the twenty character minimum.' };
    const a = await call(defs, 'flag_for_editor', args);
    const b = await call(defs, 'flag_for_editor', args);
    assert.equal(a.payload.flags_on_manuscript, 1);
    assert.equal(b.payload.flags_on_manuscript, 2);
    assert.notEqual(a.payload.flag_id, b.payload.flag_id);
  });

  test('flag_for_editor still refuses P1 — a flag needs the manuscript read', async () => {
    const { defs } = rig();
    const { payload } = await call(defs, 'flag_for_editor', {
      manuscript_id: 'MS-101', concern_type: 'other',
      summary: 'A concern long enough to satisfy the twenty character minimum.'
    });
    assert.equal(payload.code, CODES.OUT_OF_ORDER);
    assert.equal(payload.retry.with.unmet_precondition, 'P1');
  });

  test('get_review_state has no preconditions and never refuses for ordering', async () => {
    const { defs } = rig();
    const { payload } = await call(defs, 'get_review_state', {});
    assert.equal(payload.ok, true);
    assert.equal(payload.queue.length, 2);
    assert.equal(payload.queue[0].read, false);
    assert.deepEqual(payload.queue[0].criteria_missing,
      ['novelty', 'rigor', 'clarity', 'reproducibility']);
    assert.deepEqual(payload.human_only_actions,
      ['submit_recommendation', 'request_unblind']);
    assert.equal(payload.rubric.accept_slots, 4);
  });

  test('get_review_state survives a broken ranking table — it is the recovery path', async () => {
    const { defs } = rig({ ranking: () => { throw new Error('scores corrupt'); } });
    const { payload } = await call(defs, 'get_review_state', {});
    assert.equal(payload.ok, true);
    assert.equal(payload.queue[0].composite, null);
    assert.deepEqual(payload.ranking, []);
  });

  test('the optional manuscript_id widens the view, it never narrows the queue', async () => {
    const { defs } = rig();
    await readFirst(defs);
    const { payload } = await call(defs, 'get_review_state', { manuscript_id: 'MS-101' });
    assert.equal(payload.queue.length, 2);
    assert.equal(payload.focus.manuscript_id, 'MS-101');
    assert.equal(payload.queue[0].read, true);
  });
});

// =========================================================================================
describe('next_expected_action rides on EVERY return', () => {
// =========================================================================================
  test('present on a success and on a refusal', async () => {
    const { defs } = rig();
    const okRes = await call(defs, 'get_review_state', {});
    const noRes = await call(defs, 'assert_finding', FINDING);
    assert.ok(okRes.payload.next_expected_action);
    assert.ok(noRes.payload.next_expected_action);
    assert.equal(noRes.payload.next_expected_action.tool, 'read_manuscript');
  });

  test('it steers to the next uncovered criterion once the manuscript is read', async () => {
    const { defs } = rig();
    const { payload } = await call(defs, 'read_manuscript', { manuscript_id: 'MS-101' });
    assert.equal(payload.next_expected_action.tool, 'assert_finding');
    assert.equal(payload.next_expected_action.args.criterion, 'novelty');
  });

  test('it hands the session to the human once every criterion is covered', async () => {
    const { defs } = rig();
    await readFirst(defs);
    let last;
    for (const criterion of ['novelty', 'rigor', 'clarity', 'reproducibility']) {
      last = await call(defs, 'assert_finding', { ...FINDING, criterion });
    }
    assert.equal(last.payload.next_expected_action.actor, 'human');
    assert.equal(last.payload.next_expected_action.tool, null);
  });
});
