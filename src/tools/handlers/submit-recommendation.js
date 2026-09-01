/**
 * src/tools/handlers/submit-recommendation.js — 03 §4.7.
 *
 * There is no success return, ever. The final recommendation is the human reviewer's decision
 * and cannot be made through the tool layer. The tool exists so that the boundary is VISIBLE
 * rather than implicit: a page with no such tool would look like a page that simply forgot to
 * build one, and a judge could not tell the difference between a refusal and an omission.
 *
 * The refusal is not a wall — it hands the agent's proposal back to the human as a proposal,
 * with the evidence behind it, which is exactly the handoff the product argues for.
 *
 * ALREADY_COMMITTED is UNREACHABLE here by design (03 §4.7). Per §2.2 precedence, human-only
 * is checked before commit state, so a call against an already-committed manuscript still
 * returns REQUIRES_HUMAN. That is correct: the reason the agent cannot do this never changes,
 * and a differential answer would tell the agent something about state it has no need to know.
 *
 * REQUIRES_HUMAN, not HUMAN_ONLY (seam 5, and 03's assignment is canonical). REQUIRES_HUMAN
 * means THE DECISION belongs to the human; HUMAN_ONLY means THE VISIBILITY CHANGE does. Both
 * are terminal. They are distinguishable in the ledger, which is the point — the split-screen
 * shows a judge two different kinds of boundary being hit.
 */
import { refuse, CODES } from '../envelope.js';

export function submitRecommendationHandler({ args, state, caps, next }) {
  const T = 'submit_recommendation';
  const { manuscript_id, recommendation } = args;

  const active = caps.deriveFindings(state).filter(
    (f) => f.manuscript_id === manuscript_id && f.status === 'active'
  );
  const covered = caps.CRITERIA.filter((c) => active.some((f) => f.criterion === c));

  let rank = null;
  try {
    rank = (caps.deriveRanking(state) || []).find((r) => r.manuscript_id === manuscript_id) || null;
  } catch (err) {
    console.warn('[referee] deriveRanking failed inside submit_recommendation', err);
  }

  return { refusal: refuse(T, CODES.REQUIRES_HUMAN,
    'The final recommendation is the human reviewer’s decision and cannot be submitted by an agent.',
    { possible: false,
      how: 'Stop here. Summarize your recommendation and the evidence for the human reviewer, who enters the decision in the page.',
      with: {
        manuscript_id,
        proposal_recorded: true,
        ledger_seq: state.ledger.length + 1,
        proposed_recommendation: recommendation,
        criteria_covered: covered,
        criteria_missing: caps.CRITERIA.filter((c) => !covered.includes(c)),
        composite: rank ? rank.composite : null,
        rank: rank ? rank.rank : null,
        findings_supporting: active.map((f) => f.finding_id),
        decision_owner: 'human'
      } },
    next()) };
}

/** Every attempt is a distinct row and a distinct proposal. Repeats are the demonstration. */
export function submitRecommendationDigest(args) {
  return {
    manuscript_id: args.manuscript_id,
    recommendation: args.recommendation,
    rationale: typeof args.rationale === 'string' && args.rationale.length > 240
      ? args.rationale.slice(0, 240) + '…'
      : args.rationale,
    confidence: args.confidence ?? null
  };
}
