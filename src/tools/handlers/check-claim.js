/**
 * src/tools/handlers/check-claim.js — 03 §4.4. The highest-risk tool in the build (04 §6).
 *
 * It is unlimited, free, and records no consequence, which is exactly why its return is the
 * thinnest in the API. `ok: true` means THE CHECK RAN, not that the quote verified.
 *
 * NOTHING POSITIONAL, ON ANY RESULT, INCLUDING A PASS. No char_offset, no score, no
 * threshold, no normalized_quote, no match count, no source text. Every field returned is the
 * enum, a value the agent supplied, or a length the agent could have computed from its own
 * argument. An offset plus an echo on a free, unlogged-consequence tool makes the manuscript
 * BINARY-SEARCHABLE one probe at a time — including text adjacent to a span the sanitizer
 * removed, which is precisely the payload 04 §3.3 took out.
 *
 * assert_finding keeps char_offset and this does not. Same field, opposite answer, because
 * the precondition differs: there the offset rides behind a quote the gate already verified;
 * here there is no verified possession to gate on, because not being a gate is the point.
 */
import { ok, refuse, CODES } from '../envelope.js';

/**
 * 04 §6's mapping off verifyQuote, and nothing else reaches `result`. Three rows.
 *
 *   ok:true (exact|fuzzy)          -> SUPPORTED      would_pass: true
 *   ok:false EVIDENCE_NOT_FOUND    -> NOT_SUPPORTED  would_pass: false
 *   ok:false INTERNAL              -> INDETERMINATE  would_pass: null
 *
 * INDETERMINATE is why a verifier INTERNAL does not become a refusal envelope here: a dry run
 * whose verifier faulted is a COMPLETED CALL reporting that it does not know. A boolean would
 * force the handler to report "could not complete" as "the source does not support this",
 * which is false and pushes the agent toward asserting a finding it should have left alone.
 */
export function checkClaimHandler({ args, state, caps, next }) {
  const T = 'check_claim';
  const { manuscript_id, section, evidence_quote } = args;

  const v = caps.verifyQuote(manuscript_id, section, evidence_quote);

  // QUOTE_TOO_SHORT is a refusal here, not a verdict: the agent's quote never reached the
  // comparison, so reporting NOT_SUPPORTED would be a claim about the source that was not made.
  if (!v.ok && v.code === CODES.QUOTE_TOO_SHORT) {
    const min = typeof v.min_chars === 'number' ? v.min_chars : caps.MIN_QUOTE_CHARS;
    const len = typeof v.normalized_length === 'number' ? v.normalized_length : 0;
    return { refusal: refuse(T, CODES.QUOTE_TOO_SHORT,
      'The evidence quote is shorter than the minimum after normalization.',
      { possible: true,
        how: `Extend the quote to at least ${min} normalized characters and check again.`,
        with: { normalized_quote_length: len, min_length: min, shortfall: min - len,
                manuscript_id, section } },
      next()) };
  }

  let result, method, wouldPass;
  if (v.ok) {
    result = 'SUPPORTED';
    method = v.method ?? null;
    wouldPass = true;
  } else if (v.code === CODES.INTERNAL) {
    result = 'INDETERMINATE';
    method = null;
    wouldPass = null;
  } else {
    result = 'NOT_SUPPORTED';
    method = null;
    wouldPass = false;
  }

  return { payload: ok(T, {
    manuscript_id,                 // the agent's own argument, echoed
    section,                       // the agent's own argument, echoed (04 §6)
    result,
    method,
    normalized_quote_length: typeof v.normalized_length === 'number' ? v.normalized_length : null,
    would_pass_assert_finding: wouldPass
  }, next()) };
}

/**
 * The ledger row records what was checked and how it came out, so the split-screen shows the
 * agent's probing behaviour. The digest holds the agent's own argument text — which is the
 * same thing safeDigest would have written — plus the verdict. It carries no offset and no
 * score, so the LOG is not an oracle either.
 */
export function checkClaimDigest(args, result) {
  return {
    manuscript_id: args.manuscript_id,
    section: args.section,
    evidence_quote: typeof args.evidence_quote === 'string' && args.evidence_quote.length > 240
      ? args.evidence_quote.slice(0, 240) + '…'
      : args.evidence_quote,
    claim: args.claim ?? null,
    result: result && result.ok ? result.result : null,
    refused_with: result && result.ok ? null : result.code
  };
}
