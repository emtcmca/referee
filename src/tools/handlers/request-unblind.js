/**
 * src/tools/handlers/request-unblind.js — 03 §4.5.
 *
 * There is no success return. The only outcome is HUMAN_ONLY, and that is not error handling —
 * it is the feature. Unblinding is a visibility change that belongs to the human, and even
 * after the human unblinds, NO TOOL RETURN EVER CONTAINS AUTHOR INFORMATION, including this
 * one. The identity fields live in a store the tool layer holds no reference to.
 *
 * ORACLE SAFETY (03 §7 rule 7). The payload is IDENTICAL IN SHAPE AND VALUE whether or not the
 * human has already unblinded that manuscript, whether or not its identity fields are
 * populated, and whichever manuscript is named. `recorded_in_ledger`, `reviewer_notified` and
 * `identity_reachable_by_tools` are constants — they are not computed from anything. The only
 * varying fields are the agent's own `manuscript_id` and `ledger_seq`, a monotonic counter
 * over ALL calls, which therefore carries no per-manuscript signal.
 *
 * This handler does not read state.unblinded, and there is nothing here that could: a
 * differential answer is the exact shape that would convert structural blinding into masking.
 */
import { refuse, CODES } from '../envelope.js';

export function requestUnblindHandler({ args, state, next }) {
  const T = 'request_unblind';

  // The seq of the row the wrapper is about to append. appendLedger computes it the same way
  // (state.ledger.length + 1), so the number the agent is handed is the row the human will see.
  const ledgerSeq = state.ledger.length + 1;

  return { refusal: refuse(T, CODES.HUMAN_ONLY,
    'Unblinding is a human action. This request has been recorded for the reviewer.',
    { possible: false,
      how: 'Continue reviewing the public text. Tell the human reviewer why you raised this; they decide.',
      with: {
        manuscript_id: args.manuscript_id,
        recorded_in_ledger: true,
        ledger_seq: ledgerSeq,
        reviewer_notified: true,
        identity_reachable_by_tools: false,
        note: 'Identity is held in a store the tool layer holds no reference to. Unblinding changes the human view only; no tool return contains identity before or after.'
      } },
    next()) };
}

/** The reason is the point of the row — the human reads it beside the request. */
export function requestUnblindDigest(args) {
  return {
    manuscript_id: args.manuscript_id,
    reason: typeof args.reason === 'string' && args.reason.length > 240
      ? args.reason.slice(0, 240) + '…'
      : args.reason,
    urgency: args.urgency ?? 'routine'
  };
}
