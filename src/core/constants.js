/**
 * src/core/constants.js — the single source for frozen values.
 *
 * OWNERSHIP: 02 §0 and 03 §0.7 own these values. Every other slice IMPORTS from here
 * and never re-declares. 03 §0.7 records what happened the last time two files each
 * declared their own copy: the id ranges, the criterion names and the section set all
 * disagreed, silently, across the seam.
 */

export const STATE_KEY         = 'referee.state.v1';
export const STATE_VERSION     = 1;

export const SCORE_MIN         = 0;
export const SCORE_MAX         = 10;    // integers only
export const WEIGHT_MIN        = 0;
export const WEIGHT_MAX        = 100;   // integers only, NOT required to sum to 100
export const ACCEPT_SLOTS_MIN  = 1;
export const ACCEPT_SLOTS_MAX  = 11;

export const NEAR_TIE_EPSILON  = 0.15;  // composite points, 0-10 scale
export const DECISION_BOUNDARY = 6.0;   // composite points
export const CONFLICT_SPREAD   = 6;     // raw score points
export const MIN_QUOTE_CHARS   = 40;    // post-normalization (04 owns the algorithm)
export const FUZZY_THRESHOLD   = 0.92;  // token-subsequence similarity (04 owns the algorithm)

export const FICTION_LABEL =
  'FICTIONAL — written for the Referee demo. Not a real study, dataset, institution, or person.';

/**
 * SECTION_IDS is the set of LEGAL ids, not the set every manuscript carries.
 * related_work, limitations and data_availability are per-manuscript (02 §6.1).
 * There is no `title` section id — a title is a manuscript field.
 */
export const SECTION_IDS = Object.freeze([
  'abstract', 'introduction', 'related_work', 'methods',
  'results', 'discussion', 'limitations', 'data_availability'
]);

/** Declaration order is load-bearing: it fixes float summation order in ranking.js §3.1. */
export const CRITERIA = Object.freeze([
  'novelty', 'rigor', 'clarity', 'reproducibility'
]);

export const MANUSCRIPT_IDS = Object.freeze([
  'MS-101', 'MS-102', 'MS-103', 'MS-104', 'MS-105', 'MS-106',
  'MS-107', 'MS-108', 'MS-109', 'MS-110', 'MS-111', 'MS-112'
]);

/** 02 §1.5 default_weight. The reset target only; live weights live in state.rubricWeights. */
export const DEFAULT_WEIGHTS = Object.freeze({
  novelty: 30, rigor: 35, clarity: 15, reproducibility: 20, acceptSlots: 4
});

/** 02 §1.9: five human verbs, bare, never prefixed. 'set_score' is dead (PASS 3 · E5). */
export const HUMAN_ACTIONS = Object.freeze([
  'set_weights', 'unblind', 'add_note', 'commit_recommendation', 'session_reset'
]);

/** 02 §1.11 Commitment.recommendation — SINGULAR spellings (PASS 2 · D5). */
export const RECOMMENDATIONS = Object.freeze([
  'accept', 'minor_revision', 'major_revision', 'reject'
]);

/** 03 §1.3's frozen refusal set, imported by 02 §1.9 rather than re-declared. */
export const REFUSAL_CODES = Object.freeze([
  'INVALID_ARGUMENT', 'UNKNOWN_MANUSCRIPT', 'SECTION_NOT_FOUND', 'QUOTE_TOO_SHORT',
  'EVIDENCE_NOT_FOUND', 'INVALID_CRITERION', 'OUT_OF_ORDER', 'ALREADY_COMMITTED',
  'REQUIRES_HUMAN', 'HUMAN_ONLY', 'INTERNAL'
]);

/** Ledger outcome values. 'ok' is DEAD (02 PASS 2 · D1) — it matched zero rows on replay. */
export const OUTCOME_ACCEPTED = 'accepted';
export const OUTCOME_REFUSED  = 'refused';

export const BLOCKING_FLAGS = Object.freeze([
  'NEAR_TIE', 'AT_DECISION_BOUNDARY', 'CRITERION_CONFLICT',
  'INTEGRITY_EVENTS_PRESENT', 'WEIGHTS_DEGENERATE'
]);
export const ADVISORY_FLAGS = Object.freeze(['NO_VERIFIED_EVIDENCE']);
