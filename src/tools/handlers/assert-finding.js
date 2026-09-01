/**
 * src/tools/handlers/assert-finding.js — 03 §4.3 and §5. THE EVIDENCE GATE.
 *
 * This is the tool the demo is built around, and the refusal is the product: an agent cannot
 * assert a characterization the source does not support. What makes that true is not this
 * file — it is verifyQuote, reached through the capability object, which fails CLOSED until
 * the adversarial layer is installed. An unwired gate refuses everything. A gate that failed
 * open would let a fabricated quote through on a wiring mistake, which is the one outcome
 * this product exists to make impossible.
 *
 * =====================================================================================
 * NOTHING IS STORED HERE, AND THAT IS THE DESIGN
 * =====================================================================================
 * The handler never calls appendLedger, never writes state.scores, never pushes to a
 * findings array — there is no findings array. A finding COMES INTO BEING as the ledger row
 * the wrapper appends on the way out (02 §1.7, §1.11), and `assertFindingDigest` below is
 * what puts the finding's fields on that row. deriveFindings() reads them straight back off.
 * A finding the ledger does not show is therefore not representable.
 *
 * NO TOOL WRITES A SCORE (02 §1.6). The agent's `score` argument is its PROPOSED criterion
 * score; it rides on the ledger row and the human moves the actual number. The return reports
 * what the rubric currently says, so the agent can read the outcome it influenced without
 * authoring it — the same boundary submit_recommendation enforces, one level down.
 *
 * =====================================================================================
 * WHY normalizeText IS INJECTED RATHER THAN IMPORTED
 * =====================================================================================
 * 03 §0.2 says the handler calls 04 §3.1's normalizer directly, because there must be exactly
 * ONE normalizer and asking the gate to hand back a copy creates a second place it can differ.
 * This lane may not import src/sanitize/**, and the capability set is closed and cannot be
 * widened by an argument. So the composition root injects the real function through
 * `deps.normalizeText`. When it is absent we do NOT author a second normalizer — we report
 * `normalized_quote: null` and fall back to raw-string identity for the idempotency check.
 * A degraded echo is honest; a divergent second normalizer would silently break the gate.
 */
import { ok, refuse, CODES, findingId } from '../envelope.js';

/** 04 §3.1's seven steps, in EXECUTION ORDER. A list that misdescribes the pipeline teaches */
/** an agent the wrong retry, so the leading format-character strip is named first: 04 §2 */
/** says it is the only reason a zero-width-split `I<ZWSP>gnore` is caught at all. */
const NORMALIZATION_APPLIED = Object.freeze([
  'strip-format-characters', 'separators-to-space', 'NFKC',
  'straighten-quotes', 'straighten-dashes', 'casefold', 'collapse-whitespace'
]);

function currentScore(state, manuscriptId, criterion) {
  const slot = state.scores && state.scores[manuscriptId] && state.scores[manuscriptId][criterion];
  return slot && typeof slot.value === 'number' ? slot.value : null;
}

function rankRow(caps, state, manuscriptId) {
  try {
    const table = caps.deriveRanking(state) || [];
    return table.find((r) => r.manuscript_id === manuscriptId) || null;
  } catch (err) {
    console.warn('[referee] deriveRanking failed inside assert_finding', err);
    return null;
  }
}

export function assertFindingHandler({ args, state, caps, deps, next }) {
  const T = 'assert_finding';
  const { manuscript_id, criterion, section, evidence_quote,
          polarity, severity, score } = args;

  const active = caps.deriveFindings(state).filter(
    (f) => f.manuscript_id === manuscript_id && f.status === 'active'
  );
  const missing = () => caps.CRITERIA.filter((c) => !active.some((f) => f.criterion === c));

  // --- criterion --------------------------------------------------------------------------
  // The enum is in the schema too. Hosts vary in whether they enforce one (03 §6.3), so the
  // page re-checks in code: the schema is a hint, the page is the enforcement.
  if (!caps.CRITERIA.includes(criterion)) {
    return { refusal: refuse(T, CODES.INVALID_CRITERION,
      'That is not a rubric criterion in this review.',
      { possible: true,
        how: 'Use one of valid_criteria and call again.',
        with: { supplied: criterion, valid_criteria: [...caps.CRITERIA],
                criteria_missing: missing() } },
      next()) };
  }

  // --- the gate ---------------------------------------------------------------------------
  // 04 §4 owns verifyQuote and this reads its ACTUAL return shape:
  // {ok, code, method, score, normalized_length, char_offset, min_chars?, message?}.
  // It returns no `verified` flag, no `similarity`, no `threshold`, no `normalized_quote`.
  // Reading fields it does not return is the defect that made EVERY finding refuse (03 R1).
  // The debug option is never passed from a handler (04 §6).
  const v = caps.verifyQuote(manuscript_id, section, evidence_quote);

  if (!v.ok && v.code === CODES.QUOTE_TOO_SHORT) {
    const min = typeof v.min_chars === 'number' ? v.min_chars : caps.MIN_QUOTE_CHARS;
    const len = typeof v.normalized_length === 'number' ? v.normalized_length : 0;
    return { refusal: refuse(T, CODES.QUOTE_TOO_SHORT,
      'The evidence quote is shorter than the minimum after normalization.',
      { possible: true,
        how: `Extend the quote to at least ${min} normalized characters and call again.`,
        with: { normalized_quote_length: len, min_length: min, shortfall: min - len,
                manuscript_id, section } },
      next()) };
  }

  if (!v.ok) {
    // Every other verifier failure lands here as ONE code with ONE message. No score, no
    // near-miss window, no nearest source span, no character offset. 04 §6: a similarity on a
    // miss is a hill-climbing gradient toward an accepted fabrication — so the gate does not
    // compute one for this handler to leak. The echo is the agent's OWN quote and nothing
    // else, which is the whole of what 03 §7 rule 4 permits.
    return { refusal: refuse(T, CODES.EVIDENCE_NOT_FOUND,
      'That quote does not appear in the section you attributed it to.',
      { possible: true,
        how: 'Re-read the section, copy a contiguous passage verbatim from the text this page returned, and call again. Do not paraphrase.',
        with: {
          manuscript_id,
          section,
          normalized_quote: normalizedOf(deps, evidence_quote),
          normalized_quote_length: typeof v.normalized_length === 'number'
            ? v.normalized_length : null,
          match_method_attempted: ['exact', 'fuzzy'],
          normalization_applied: [...NORMALIZATION_APPLIED],
          hint: 'A quote that does not verify is usually a paraphrase rather than a transcription error.'
        } },
      next()) };
  }

  // --- accepted ---------------------------------------------------------------------------
  const normalized = normalizedOf(deps, evidence_quote);
  const seq = state.ledger.length + 1;          // the row the wrapper is about to append
  const prior = active.find((f) => f.criterion === criterion) || null;
  const rank = rankRow(caps, state, manuscript_id);

  // Identical re-call short circuit. A retrying agent must not inflate the finding list with
  // duplicates; a genuinely better quote must still be able to supersede. Both are true here.
  const sameQuote = prior
    ? (normalized !== null
        ? prior.normalized_quote === normalized
        : prior.evidence_quote === evidence_quote)
    : false;

  if (prior && sameQuote && prior.section === section && prior.polarity === polarity &&
      prior.severity === severity && prior.score === score) {
    const pv = prior.verification || {};
    return { payload: ok(T, {
      finding_id: prior.finding_id,
      accepted: true,
      idempotent: true,
      verification: {
        method: pv.method ?? v.method,
        score: pv.score ?? v.score,
        threshold: caps.FUZZY_THRESHOLD,
        char_offset: pv.char_offset ?? v.char_offset ?? null,
        normalized_quote: prior.normalized_quote ?? normalized,
        // 04 §5's resolution of the sanitize<->verify seam, stamped rather than assumed, and
        // CONSTANT on every accepting path including this one. A second value would mean a
        // second substrate exists, and 04 §5 exists to guarantee it does not.
        verified_against: 'agent_visible_text'
      },
      supersedes: null,
      criterion_score: currentScore(state, manuscript_id, criterion),
      composite: rank ? rank.composite : null,
      rank: rank ? rank.rank : null,
      criteria_missing: missing()
    }, next()) };
  }

  return { payload: ok(T, {
    finding_id: findingId(`${manuscript_id}|${criterion}|${normalized ?? evidence_quote}|${seq}`),
    accepted: true,
    idempotent: false,
    verification: {
      method: v.method,
      score: v.score,
      threshold: caps.FUZZY_THRESHOLD,
      // Kept HERE and deliberately absent from check_claim: this offset sits behind a quote
      // the agent already possessed and the gate already verified, so it discloses nothing
      // new, and 01 AC-8 / 05 §7.4 draw the source underline from it.
      char_offset: typeof v.char_offset === 'number' ? v.char_offset : null,
      normalized_quote: normalized,
      verified_against: 'agent_visible_text'
    },
    supersedes: prior ? prior.finding_id : null,
    criterion_score: currentScore(state, manuscript_id, criterion),
    composite: rank ? rank.composite : null,
    rank: rank ? rank.rank : null,
    criteria_missing: missing().filter((c) => c !== criterion)
  }, next()) };
}

/** One normalizer or none. Never a locally-authored second one. */
function normalizedOf(deps, quote) {
  return typeof deps.normalizeText === 'function' ? deps.normalizeText(quote) : null;
}

/**
 * 03 §4.3. LOAD-BEARING, the same way read_manuscript's is. This is what puts the finding
 * onto the append-only log, and deriveFindings() reads exactly these keys back off.
 * `verification` is copied verbatim, so the `verified_against: "agent_visible_text"` stamp
 * lands in the ledger where 05 §12's view and a judge reading the copied text can both see it.
 */
export function assertFindingDigest(args, result) {
  const okRes = result && result.ok;
  return {
    manuscript_id: args.manuscript_id,
    criterion: args.criterion,
    section: args.section,
    evidence_quote: args.evidence_quote,
    normalized_quote: okRes ? result.verification.normalized_quote : null,
    verification: okRes ? result.verification : null,
    claim: args.claim,
    polarity: args.polarity,
    severity: args.severity,
    score: args.score,
    finding_id: okRes ? result.finding_id : null
  };
}
