/**
 * src/core/ranking.test.mjs — the executed re-rank, reproduced by RUNNING the code.
 *
 * 02 §3.5 records an arithmetic result: at default weights {30,35,15,20} the seed scores
 * produce one table, and at novelty-heavy weights {50,25,10,15} the top two swap, MS-103
 * climbs 7 -> 3 crossing UP through the acceptSlots=4 cut, and MS-106 falls 4 -> 6 crossing
 * DOWN through it. These tests assert every cell of both tables, so a change to the
 * composite formula, the tiebreak, or the flag rules fails here rather than on camera.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveRanking, cutLineCrossings, composite, adjacentGaps } from './ranking.js';
import { SEED_SCORES } from './corpus.stub.js';
import { CRITERIA, MANUSCRIPT_IDS, DEFAULT_WEIGHTS } from './constants.js';

/** Minimal state carrying only what deriveRanking reads. */
function stateWith(weights, ledger = []) {
  const scores = {};
  for (const id of MANUSCRIPT_IDS) {
    scores[id] = {};
    for (const c of CRITERIA) {
      scores[id][c] = { value: SEED_SCORES[id][c], set_by: 'seed', updated_at: 'T' };
    }
  }
  return { scores, ledger, rubricWeights: weights };
}

/** 02 §6.1: payloads sit on MS-102, MS-107 and MS-110. */
const INTEGRITY = [
  { manuscript_id: 'MS-102' }, { manuscript_id: 'MS-102' },
  { manuscript_id: 'MS-107' }, { manuscript_id: 'MS-110' }
];

const SEED_TABLE = [
  ['MS-102', 8.70, ['NEAR_TIE', 'INTEGRITY_EVENTS_PRESENT']],
  ['MS-101', 8.65, ['NEAR_TIE']],
  ['MS-104', 7.25, []],
  ['MS-106', 6.90, ['NEAR_TIE']],
  ['MS-105', 6.85, ['NEAR_TIE']],
  ['MS-108', 6.25, []],
  ['MS-103', 5.90, ['AT_DECISION_BOUNDARY', 'CRITERION_CONFLICT']],
  ['MS-107', 5.60, ['INTEGRITY_EVENTS_PRESENT']],
  ['MS-109', 5.10, []],
  ['MS-110', 4.70, ['INTEGRITY_EVENTS_PRESENT']],
  ['MS-111', 4.20, []],
  ['MS-112', 2.50, []]
];

const RERANK_TABLE = [
  ['MS-101', 8.75, 2], ['MS-102', 8.50, 1], ['MS-103', 7.05, 7], ['MS-104', 6.90, 3],
  ['MS-105', 6.90, 5], ['MS-106', 6.35, 4], ['MS-107', 5.70, 8], ['MS-108', 5.60, 6],
  ['MS-110', 5.35, 10], ['MS-109', 4.50, 9], ['MS-111', 3.55, 11], ['MS-112', 2.35, 12]
];

test('seed ranking reproduces 02 §3.5 exactly, id, composite and blocking flags', () => {
  const table = deriveRanking(stateWith(DEFAULT_WEIGHTS), { integrityEvents: INTEGRITY });
  assert.equal(table.length, 12);
  SEED_TABLE.forEach(([id, comp, flags], i) => {
    assert.equal(table[i].manuscript_id, id, `rank ${i + 1} should be ${id}`);
    assert.equal(table[i].composite, comp, `${id} composite`);
    assert.equal(table[i].rank, i + 1);
    assert.deepEqual(table[i].flags, flags, `${id} blocking flags`);
  });
});

test('seed: exactly two near-tie pairs, and exactly 7 items requiring human judgment', () => {
  const table = deriveRanking(stateWith(DEFAULT_WEIGHTS), { integrityEvents: INTEGRITY });
  const nearTie = table.filter((r) => r.flags.includes('NEAR_TIE')).map((r) => r.manuscript_id);
  assert.deepEqual(nearTie, ['MS-102', 'MS-101', 'MS-106', 'MS-105']);
  assert.equal(table.filter((r) => r.requires_human_judgment).length, 7);
  // Only MS-103 trips CRITERION_CONFLICT at CONFLICT_SPREAD = 6 (spread 7).
  const conflict = table.filter((r) => r.flags.includes('CRITERION_CONFLICT'));
  assert.deepEqual(conflict.map((r) => r.manuscript_id), ['MS-103']);
  // Adjacent gaps from the spec, to the cent.
  assert.deepEqual(adjacentGaps(table),
    [0.05, 1.4, 0.35, 0.05, 0.6, 0.35, 0.3, 0.5, 0.4, 0.5, 1.7]);
});

test('novelty 30 -> 50 reproduces the executed re-rank table', () => {
  const w = { novelty: 50, rigor: 25, clarity: 10, reproducibility: 15, acceptSlots: 4 };
  const table = deriveRanking(stateWith(w), { integrityEvents: INTEGRITY });
  RERANK_TABLE.forEach(([id, comp, was], i) => {
    assert.equal(table[i].manuscript_id, id, `rank ${i + 1} should be ${id} (was ${was})`);
    assert.equal(table[i].composite, comp, `${id} composite after re-weight`);
  });
});

test('the top two swap on the weight change', () => {
  const before = deriveRanking(stateWith(DEFAULT_WEIGHTS), { integrityEvents: INTEGRITY });
  const after = deriveRanking(
    stateWith({ novelty: 50, rigor: 25, clarity: 10, reproducibility: 15, acceptSlots: 4 }),
    { integrityEvents: INTEGRITY });
  assert.equal(before[0].manuscript_id, 'MS-102');
  assert.equal(before[1].manuscript_id, 'MS-101');
  assert.equal(after[0].manuscript_id, 'MS-101');
  assert.equal(after[1].manuscript_id, 'MS-102');
});

test('two cut-line crossings, in opposite directions, from one gesture', () => {
  const before = deriveRanking(stateWith(DEFAULT_WEIGHTS), { integrityEvents: INTEGRITY });
  const after = deriveRanking(
    stateWith({ novelty: 50, rigor: 25, clarity: 10, reproducibility: 15, acceptSlots: 4 }),
    { integrityEvents: INTEGRITY });
  const crossings = cutLineCrossings(before, after, 4);
  assert.deepEqual(crossings.up, ['MS-103'], 'MS-103 crosses UP through the cut, 7 -> 3');
  assert.deepEqual(crossings.down, ['MS-106'], 'MS-106 crosses DOWN through the cut, 4 -> 6');
});

test('MS-104 / MS-105 tie at 6.90 is broken by id ascending, not by input order', () => {
  const w = { novelty: 50, rigor: 25, clarity: 10, reproducibility: 15, acceptSlots: 4 };
  const table = deriveRanking(stateWith(w), { integrityEvents: INTEGRITY });
  const a = table.find((r) => r.manuscript_id === 'MS-104');
  const b = table.find((r) => r.manuscript_id === 'MS-105');
  assert.equal(a.composite, b.composite);
  assert.ok(a.rank < b.rank, 'MS-104 must rank above MS-105 on the id tiebreak');
});

test('deriveRanking is pure: it does not mutate the state it is handed', () => {
  const state = stateWith(DEFAULT_WEIGHTS);
  const snapshot = JSON.stringify(state);
  deriveRanking(state, { integrityEvents: INTEGRITY });
  deriveRanking(state, { integrityEvents: INTEGRITY });
  assert.equal(JSON.stringify(state), snapshot);
});

test('degenerate weights: composite 0, WEIGHTS_DEGENERATE on all, no NaN', () => {
  const w = { novelty: 0, rigor: 0, clarity: 0, reproducibility: 0, acceptSlots: 4 };
  const table = deriveRanking(stateWith(w));
  assert.equal(table.length, 12);
  for (const r of table) {
    assert.equal(r.composite, 0);
    assert.ok(!Number.isNaN(r.composite));
    assert.ok(r.flags.includes('WEIGHTS_DEGENERATE'));
    assert.equal(r.requires_human_judgment, true);
  }
});

test('weights need not sum to 100 — doubling every weight changes nothing', () => {
  const a = deriveRanking(stateWith(DEFAULT_WEIGHTS));
  const b = deriveRanking(stateWith(
    { novelty: 60, rigor: 70, clarity: 30, reproducibility: 40, acceptSlots: 4 }));
  assert.deepEqual(a.map((r) => [r.manuscript_id, r.composite]),
                   b.map((r) => [r.manuscript_id, r.composite]));
});

test('composite() alone reproduces the two spec-stated values', () => {
  assert.equal(composite(SEED_SCORES['MS-101'], DEFAULT_WEIGHTS), 8.65);
  assert.equal(composite(SEED_SCORES['MS-102'], DEFAULT_WEIGHTS), 8.7);
});

test('NO_VERIFIED_EVIDENCE is advisory and clears on an accepted assert_finding row', () => {
  const bare = deriveRanking(stateWith(DEFAULT_WEIGHTS));
  assert.ok(bare.every((r) => r.advisory.includes('NO_VERIFIED_EVIDENCE')));
  const withFinding = deriveRanking(stateWith(DEFAULT_WEIGHTS, [{
    seq: 1, actor: 'agent', action: 'assert_finding', manuscript_id: 'MS-101',
    outcome: 'accepted', code: null, args_digest: { criterion: 'rigor' }
  }]));
  const ms101 = withFinding.find((r) => r.manuscript_id === 'MS-101');
  assert.ok(!ms101.advisory.includes('NO_VERIFIED_EVIDENCE'));
  // Advisory never gates the commit control.
  assert.ok(!ms101.flags.includes('NO_VERIFIED_EVIDENCE'));
});

test('a REFUSED assert_finding row does not clear NO_VERIFIED_EVIDENCE', () => {
  // The replay predicate is outcome === 'accepted'. A refusal is on the record but is
  // not evidence, and must never count as any.
  const table = deriveRanking(stateWith(DEFAULT_WEIGHTS, [{
    seq: 1, actor: 'agent', action: 'assert_finding', manuscript_id: 'MS-101',
    outcome: 'refused', code: 'EVIDENCE_NOT_FOUND', args_digest: {}
  }]));
  const ms101 = table.find((r) => r.manuscript_id === 'MS-101');
  assert.ok(ms101.advisory.includes('NO_VERIFIED_EVIDENCE'));
});
