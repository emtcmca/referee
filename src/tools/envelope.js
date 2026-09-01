/**
 * src/tools/envelope.js — the shapes every tool return takes, and nothing else.
 *
 * 03 §1. Two constructors, one serializer, one frozen code set, and a summary table that
 * cannot interpolate manuscript text. Every value a tool hands the agent is built here.
 *
 * =====================================================================================
 * THE TWO RULES THIS FILE EXISTS TO MAKE STRUCTURAL
 * =====================================================================================
 * D1 — every execute() return is a JSON STRING. serialize() is the only writer of that
 *      string, and define-tool.js calls it on the single exit path.
 * D2 — a policy refusal is a RETURNED VALUE carrying ok:false, never a thrown exception.
 *      refuse() builds a value. Nothing in this file throws on a refusal path.
 *
 * `retry.possible` is not left to a caller's memory: 03 §1.3's table says HUMAN_ONLY,
 * REQUIRES_HUMAN, ALREADY_COMMITTED and INTERNAL are terminal, and refuse() forces it.
 * A handler that passes `possible: true` on a terminal code is corrected here rather than
 * shipping an agent on a doomed retry loop.
 */
import { hash8 } from '../core/hash.js';

/** 03 §1.3. The frozen set. core/constants.js REFUSAL_CODES holds the same eleven names. */
export const CODES = Object.freeze({
  INVALID_ARGUMENT:    'INVALID_ARGUMENT',
  UNKNOWN_MANUSCRIPT:  'UNKNOWN_MANUSCRIPT',
  SECTION_NOT_FOUND:   'SECTION_NOT_FOUND',
  QUOTE_TOO_SHORT:     'QUOTE_TOO_SHORT',
  EVIDENCE_NOT_FOUND:  'EVIDENCE_NOT_FOUND',
  INVALID_CRITERION:   'INVALID_CRITERION',
  OUT_OF_ORDER:        'OUT_OF_ORDER',
  ALREADY_COMMITTED:   'ALREADY_COMMITTED',
  REQUIRES_HUMAN:      'REQUIRES_HUMAN',
  HUMAN_ONLY:          'HUMAN_ONLY',
  INTERNAL:            'INTERNAL'
});

/**
 * 03 §1.3's `retry.possible` column, as data. These four are terminal: the reason the call
 * failed is not a thing the agent can change.
 */
export const TERMINAL_CODES = Object.freeze([
  CODES.HUMAN_ONLY, CODES.REQUIRES_HUMAN, CODES.ALREADY_COMMITTED, CODES.INTERNAL
]);
const TERMINAL = new Set(TERMINAL_CODES);

/** The two tools whose only outcome is a refusal. Named so the UI can say so honestly. */
export const HUMAN_ONLY_ACTIONS = Object.freeze(['submit_recommendation', 'request_unblind']);

/** 03 §1.1. */
export function ok(tool, payload, nextAction) {
  return { ok: true, tool, ...payload, next_expected_action: nextAction ?? null };
}

/**
 * 03 §1.2. `retry` is ALWAYS present — that is what makes a refusal actionable rather than
 * a dead end. Defaults fill anything the caller omitted.
 */
export function refuse(tool, code, message, retry, nextAction) {
  const merged = { possible: false, how: null, with: {}, ...(retry || {}) };
  if (TERMINAL.has(code)) merged.possible = false;
  return {
    ok: false,
    tool,
    code,
    message,
    retry: merged,
    next_expected_action: nextAction ?? null
  };
}

/** 03 §1.5 / 00 D1. Every execute() return in this codebase goes through this function. */
export function serialize(payload) {
  return JSON.stringify(payload);
}

/**
 * 03 §3. Ledger summaries come from a FROZEN TABLE, never from a template that could
 * interpolate manuscript text (02 §1.9). The refused branch names the code and nothing
 * else, so a summary can never carry a quote, a span, or a title.
 */
const ACCEPTED_SUMMARY = Object.freeze({
  get_review_state:      'Read the review queue and progress.',
  read_manuscript:       'Received the manuscript’s public sections.',
  assert_finding:        'Recorded an evidence-backed finding.',
  check_claim:           'Ran a dry-run evidence check.',
  flag_for_editor:       'Raised a concern for the editor.',
  request_unblind:       'Requested unblinding.',
  submit_recommendation: 'Proposed a recommendation.'
});

export function summarize(tool, result) {
  if (result && result.ok) return ACCEPTED_SUMMARY[tool] || `${tool} accepted.`;
  return `${tool} refused: ${result && result.code ? result.code : 'UNKNOWN'}.`;
}

/** ISO-8601, one place, so a handler never reaches for a global clock. */
export function nowISO() {
  return new Date().toISOString();
}

/**
 * Monotonic per-session call id, assigned at handler ENTRY so `tool:invoked` and
 * `tool:settled` pair up (05 §7.1).
 */
let CALL_SEQ = 0;
export function nextCallId() {
  CALL_SEQ += 1;
  return `call-${CALL_SEQ}`;
}

/** TEST ONLY. */
export function __resetCallIdsForTests() {
  CALL_SEQ = 0;
}

/** Deterministic, dependency-free opaque local ids. core/hash.js owns the algorithm. */
export function findingId(parts) {
  return 'f_' + hash8(parts);
}
export function flagId(parts) {
  return 'flag_' + hash8(parts);
}
