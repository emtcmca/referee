/**
 * src/ui/render/ui-state.js — UI-LOCAL state only.
 *
 * Nothing here is persisted and nothing here is a SessionState key. The
 * distinction is load-bearing: bindings.js notes that manuscript SELECTION is
 * UI-local and must not route through a bus event, because a score change would
 * then re-render the scroll region and throw away the reviewer's place in the
 * manuscript.
 *
 * The pulse snapshot and the WebMCP snapshot live here for the same reason —
 * they describe the agent's activity, not the review, and they must never reach
 * the ledger or localStorage.
 */

export const ui = {
  /** Selected manuscript id, or null. Drives desk.body and desk.empty. */
  selectedId: null,

  /** Ledger filter token: all | agent | human | refused. */
  ledgerFilter: 'all',

  /** Which copy of the manuscript text the reviewer is reading: page | agent. */
  receivedAs: 'page',

  /** Latest activity.createPulse snapshot. */
  pulse: { state: 'idle', label: 'AGENT IDLE', tool: null, outcome: null, code: null, stillRunning: false },

  /** Latest states.createWebMcpMachine snapshot. */
  webmcp: { phase: 'unavailable', attr: 'absent', registered: 0, total: 7, failed: [] },

  /** Which ledger seq numbers the log has already appended. Append-only. */
  renderedSeq: new Set(),

  /** Dismissed notice codes, for this tab only. Never persisted. */
  dismissedNotices: new Set(),

  /** Split-screen page, 1-based. */
  splitPage: 1,

  /** Set true once the reviewer has committed; locks the verdict controls. */
  pendingRecommendation: null,
};

export function resetUiState() {
  ui.selectedId = null;
  ui.ledgerFilter = 'all';
  ui.receivedAs = 'page';
  ui.renderedSeq = new Set();
  ui.splitPage = 1;
  ui.pendingRecommendation = null;
}

/**
 * Refusal tallies, DERIVED FROM state.ledger on every read.
 *
 * They used to be counters incremented by a bus listener, and that was wrong in
 * two ways at once. A reload restored a ledger full of refusals and every chip
 * read zero, because the counters only ever saw live events. And the binder
 * re-renders the chips straight off 'tool:settled', so whether a counter had
 * been incremented yet depended on bus subscription order — every chip rendered
 * one refusal behind.
 *
 * Deriving from the ledger fixes both, and it is the same discipline core
 * already applies to findings: the ledger is the record, everything else is a
 * projection of it. appendLedger pushes the row BEFORE it emits, so a renderer
 * reading state.ledger during that emit already sees the row.
 *
 * @param {object} state
 * @param {string|null} [manuscriptId] scope to one manuscript, or null for all
 */
export function refusalTallies(state, manuscriptId) {
  const ledger = (state && Array.isArray(state.ledger)) ? state.ledger : [];
  const out = { total: 0, byTool: {}, byCode: {} };
  for (const entry of ledger) {
    if (entry.actor !== 'agent' || entry.outcome !== 'refused') continue;
    if (manuscriptId && entry.manuscript_id !== manuscriptId) continue;
    out.total += 1;
    out.byTool[entry.action] = (out.byTool[entry.action] || 0) + 1;
    if (entry.code) out.byCode[entry.code] = (out.byCode[entry.code] || 0) + 1;
  }
  return out;
}
