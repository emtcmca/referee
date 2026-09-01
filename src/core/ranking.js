/**
 * src/core/ranking.js — score to ranking, exactly. 02 §3.
 *
 * PURE AND DETERMINISTIC. No Date, no Math.random, no ledger read in the composite path,
 * nothing cached, nothing incrementally patched. deriveRanking() on the same
 * (scores, weights) always returns the identical array, so a weight slider move is a full
 * re-derivation and the demo cannot drift from the arithmetic that was executed in the spec.
 */
import {
  CRITERIA, MANUSCRIPT_IDS, NEAR_TIE_EPSILON, DECISION_BOUNDARY, CONFLICT_SPREAD
} from './constants.js';
import { getPublicManuscript, listQueueEntries } from './corpus-access.js';

/** 02 §3.1. Fixed rounding so a composite is bit-identical across runs. */
export function round4(x) {
  return Math.round((x + Number.EPSILON) * 10000) / 10000;
}

/**
 * 02 §3.1:  composite(m) = round4( Σ_c (w_c · s_{m,c}) / Σ_c w_c )
 *
 * `c` ranges over CRITERIA in DECLARATION ORDER, which fixes float summation order.
 * Weights are NOT required to sum to 100 — the formula divides by Σw, which deletes an
 * entire class of "weights must total 100" validation bugs.
 *
 * Degenerate case (Σw === 0): composite is 0 for every manuscript. No division by zero,
 * no NaN reaches state. The WEIGHTS_DEGENERATE flag is what makes it visible.
 */
export function composite(perCriterion, weights) {
  let num = 0;
  let den = 0;
  for (const c of CRITERIA) {
    const w = weights?.[c] ?? 0;
    const s = perCriterion?.[c] ?? 0;
    num += w * s;
    den += w;
  }
  if (den === 0) return 0;
  return round4(num / den);
}

function perCriterionOf(state, id) {
  const row = state?.scores?.[id] ?? {};
  const out = {};
  for (const c of CRITERIA) out[c] = row[c]?.value ?? 0;
  return out;
}

/**
 * Flag 6, NO_VERIFIED_EVIDENCE: zero accepted Finding records for this manuscript.
 * Findings are DERIVED BY REPLAYING THE LEDGER and never persisted (02 §1.11), so this
 * counts rows rather than reading a stored list. The predicate is outcome === 'accepted';
 * 'ok' is dead and matched zero rows for a whole spec revision (02 PASS 2 · D1).
 */
function acceptedFindingCount(state, id) {
  const ledger = Array.isArray(state?.ledger) ? state.ledger : [];
  let n = 0;
  for (const e of ledger) {
    if (e.action === 'assert_finding' && e.outcome === 'accepted' && e.manuscript_id === id) n++;
  }
  return n;
}

/**
 * 02 §3.2 / §3.3 / §3.4.
 *
 * @param {object} state  NOT mutated.
 * @param {{integrityEvents?: Array<{manuscript_id: string}>}} [deps]
 *        Integrity events are derived in memory by 04's sanitizer at boot and are NOT
 *        persisted (02 §1.10), so there is no state key to read them from. They are passed
 *        in. Omitted => no manuscript carries INTEGRITY_EVENTS_PRESENT, which is the correct
 *        answer before the adversarial layer has run, not a silent zero.
 * @returns {Array} RankedItem[]
 */
export function deriveRanking(state, deps = {}) {
  const weights = state?.rubricWeights ?? {};
  const weightSum = CRITERIA.reduce((n, c) => n + (weights[c] ?? 0), 0);
  const degenerate = weightSum === 0;

  const integrityByMs = new Set(
    (deps.integrityEvents ?? []).map((e) => e.manuscript_id)
  );

  // Every id in the frozen enum gets a row, whether or not the installed corpus carries
  // prose for it. A queue that silently shortens is worse than one with a placeholder title.
  const titles = new Map(listQueueEntries().map((q) => [q.id, q.title]));

  const items = MANUSCRIPT_IDS.map((id) => {
    const per = perCriterionOf(state, id);
    const values = CRITERIA.map((c) => per[c]);
    return {
      manuscript_id: id,
      title: getPublicManuscript(id)?.title ?? titles.get(id) ?? id,
      rank: 0,
      composite: composite(per, weights),
      per_criterion: per,
      spread: Math.max(...values) - Math.min(...values),
      flags: [],
      advisory: [],
      requires_human_judgment: false
    };
  });

  // 02 §3.2: composite descending, then manuscript id ascending. The id tiebreak makes the
  // order independent of input array order AND of engine sort stability.
  items.sort((a, b) =>
    (b.composite - a.composite) ||
    (a.manuscript_id < b.manuscript_id ? -1 : a.manuscript_id > b.manuscript_id ? 1 : 0));

  items.forEach((it, i) => { it.rank = i + 1; });

  // 02 §3.4 — flags evaluated AFTER sorting, appended in this fixed order.
  items.forEach((it, i) => {
    const prev = items[i - 1];
    const next = items[i + 1];

    // 1 NEAR_TIE — within epsilon of either adjacent rank.
    const nearPrev = prev && Math.abs(it.composite - prev.composite) <= NEAR_TIE_EPSILON;
    const nearNext = next && Math.abs(it.composite - next.composite) <= NEAR_TIE_EPSILON;
    if (nearPrev || nearNext) it.flags.push('NEAR_TIE');

    // 2 AT_DECISION_BOUNDARY
    if (Math.abs(it.composite - DECISION_BOUNDARY) <= NEAR_TIE_EPSILON) {
      it.flags.push('AT_DECISION_BOUNDARY');
    }

    // 3 CRITERION_CONFLICT — the rubric disagrees with itself about this paper.
    if (it.spread >= CONFLICT_SPREAD) it.flags.push('CRITERION_CONFLICT');

    // 4 INTEGRITY_EVENTS_PRESENT
    if (integrityByMs.has(it.manuscript_id)) it.flags.push('INTEGRITY_EVENTS_PRESENT');

    // 5 WEIGHTS_DEGENERATE — Σw === 0, so every composite is 0 and the ordering is meaningless.
    if (degenerate) it.flags.push('WEIGHTS_DEGENERATE');

    // 6 NO_VERIFIED_EVIDENCE — ADVISORY, deliberately. At session start it is true of all
    // twelve, and a badge that lights on everything measures nothing.
    if (acceptedFindingCount(state, it.manuscript_id) === 0) {
      it.advisory.push('NO_VERIFIED_EVIDENCE');
    }

    // Blocking flags only. This is the flag that gates the commit control.
    it.requires_human_judgment = it.flags.length > 0;
  });

  return items;
}

/**
 * The cut line at rubricWeights.acceptSlots. Returns the crossings between two ranking
 * tables — which is the thing the weight-change demo is actually about, and the reason it
 * is computed here rather than described in the UI from memory.
 *
 * @returns {{up: string[], down: string[]}} ids that crossed the cut, in each direction
 */
export function cutLineCrossings(before, after, acceptSlots) {
  const rankOf = (table) => new Map(table.map((r) => [r.manuscript_id, r.rank]));
  const b = rankOf(before);
  const a = rankOf(after);
  const up = [];
  const down = [];
  for (const [id, wasRank] of b) {
    const nowRank = a.get(id);
    if (nowRank === undefined) continue;
    const wasIn = wasRank <= acceptSlots;
    const nowIn = nowRank <= acceptSlots;
    if (!wasIn && nowIn) up.push(id);
    if (wasIn && !nowIn) down.push(id);
  }
  return { up, down };
}

/** Convenience for the UI: adjacent composite gaps, top to bottom. */
export function adjacentGaps(table) {
  return table.slice(1).map((it, i) => round4(table[i].composite - it.composite));
}
