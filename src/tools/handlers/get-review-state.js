/**
 * src/tools/handlers/get-review-state.js — 03 §4.1.
 *
 * The recovery path. It has no preconditions and it must never be the thing that is broken,
 * so every derivation it runs is wrapped: a fault in the ranking table degrades `composite`
 * and `rank` to null rather than taking the agent's one way back to solid ground with it.
 *
 * It returns NO manuscript text and NO author information. `blinded_fields` comes from
 * BLINDED_FIELD_NAMES — a pure string transform of the identity PATH names (02 §2.2 fact 4),
 * identical on all twelve rows. Computing "which fields did we remove" by diffing against the
 * identity record would itself be a read of identity, which is the trap this avoids.
 */
import { ok, HUMAN_ONLY_ACTIONS } from '../envelope.js';

/** deriveRanking is pure but reads state.scores; a malformed slot must not break recovery. */
function safeRanking(caps, state) {
  try {
    const table = caps.deriveRanking(state);
    return Array.isArray(table) ? table : [];
  } catch (err) {
    console.warn('[referee] deriveRanking failed inside get_review_state', err);
    return [];
  }
}

/**
 * Neutralized-injection count for one manuscript. Permitted by 03 §7 rule 5
 * (`injection_attempts` is explicitly on the allow-list) and it is a count over public text,
 * never a function of a blinded field. Returns 0 when the adversarial layer is unwired.
 */
function integrityCount(caps, id) {
  try {
    const san = caps.sanitizeManuscript(id);
    const n = san && san.integrity ? san.integrity.injection_attempts : 0;
    return typeof n === 'number' ? n : 0;
  } catch {
    return 0;
  }
}

export function getReviewStateHandler({ args, state, caps, next }) {
  const T = 'get_review_state';
  const focusId = typeof args.manuscript_id === 'string' ? args.manuscript_id : null;

  const ranking = safeRanking(caps, state);
  const rankOf = new Map(ranking.map((r) => [r.manuscript_id, r]));

  const findings = caps.deriveFindings(state);
  const editorFlags = caps.deriveEditorFlags(state);

  const rowFor = (id) => {
    const ms = caps.getPublicManuscript(id);
    if (!ms) return null;
    const active = findings.filter((f) => f.manuscript_id === id && f.status === 'active');
    const covered = caps.CRITERIA.filter((c) => active.some((f) => f.criterion === c));
    const r = rankOf.get(id) || null;
    return {
      manuscript_id: id,
      title: ms.title,
      word_count: ms.word_count,
      // Static class list. A manuscript with no funding note and one with an undisclosed
      // grant return the SAME array (03 §7 rule 2).
      blinded_fields: [...caps.BLINDED_FIELD_NAMES],
      read: caps.hasRead(state, id),
      findings_count: active.length,
      criteria_covered: covered,
      criteria_missing: caps.CRITERIA.filter((c) => !covered.includes(c)),
      composite: r ? r.composite : null,
      rank: r ? r.rank : null,
      committed: Boolean(caps.committedFor(state, id)),
      integrity_flags: integrityCount(caps, id)
    };
  };

  const queue = caps.MANUSCRIPT_IDS.map(rowFor).filter(Boolean);

  const w = state.rubricWeights || {};
  const payload = {
    queue,
    rubric: {
      criteria: [...caps.CRITERIA],
      weights: caps.CRITERIA.reduce((acc, c) => { acc[c] = w[c] ?? null; return acc; }, {}),
      accept_slots: w.acceptSlots ?? null
    },
    // 02 §3.2's order: composite descending, then id ascending. Never insertion order.
    ranking: ranking.map((r) => r.manuscript_id),
    ledger_length: state.ledger.length,
    human_only_actions: [...HUMAN_ONLY_ACTIONS]
  };

  // The optional argument buys a FULLER view of one manuscript, never a narrower queue.
  // Hiding the other eleven rows would make the recovery tool answer a different question
  // depending on how it was called, which is the opposite of a recovery path.
  if (focusId) {
    const active = findings.filter((f) => f.manuscript_id === focusId && f.status === 'active');
    payload.focus = {
      manuscript_id: focusId,
      findings: active.map((f) => ({
        finding_id: f.finding_id,
        criterion: f.criterion,
        section: f.section,
        polarity: f.polarity,
        severity: f.severity,
        proposed_score: f.score,
        ledger_seq: f.ledger_seq
      })),
      superseded_findings: findings.filter(
        (f) => f.manuscript_id === focusId && f.status === 'superseded'
      ).length,
      editor_flags: editorFlags.filter((f) => f.manuscript_id === focusId).length,
      committed: Boolean(caps.committedFor(state, focusId))
    };
  }

  return { payload: ok(T, payload, next()) };
}
