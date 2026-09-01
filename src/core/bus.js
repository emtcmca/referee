/**
 * src/core/bus.js — refereeBus, a zero-dependency synchronous event emitter.
 *
 * WHY THIS FILE IS SELF-DESCRIBING: another lane consumes this bus without reading this
 * code. The event vocabulary below is the contract. It is frozen, so a typo'd event name
 * is a thrown error at emit/on time rather than a listener that silently never fires.
 *
 *   import { refereeBus, EVENTS } from '../core/bus.js';
 *   refereeBus.on(EVENTS.RANKING_CHANGED, ({ ranking }) => render(ranking));
 *
 * =====================================================================================
 * EVENT VOCABULARY — name -> payload shape.
 *
 * THE FIRST SIX ARE FROZEN BY 05 §7.1 AND ARE NOT CORE'S TO RENAME. The UI lane built
 * against those spellings. The rest are core's own finer-grained additions; they are
 * additive and no consumer is required to listen to them.
 * =====================================================================================
 *
 * --- FROZEN BY 05 §7.1 -----------------------------------------------------------
 *
 * 'webmcp:changed'      { phase: 'probing'|'absent'|'registering'|'ready'|'failed',
 *                         registered: string[], error: string|null }
 *                       The WebMCP registration lifecycle. `phase: 'probing'` MUST be
 *                       emitted at first paint, BEFORE the first registerTool resolves, so
 *                       the page can render a probing state instead of a blank one. 'absent'
 *                       is the no-WebMCP-in-this-browser case and is a normal outcome, not
 *                       an error. `registered` lists tool names registered so far.
 *
 * 'tool:invoked'        { name: string, call_id: string, manuscript_id: string|null,
 *                         args_digest: object, at: string }
 *                       A tool call is IN FLIGHT. Emitted before the handler runs. Pairs
 *                       with exactly one 'tool:settled' carrying the same call_id.
 *
 * 'tool:settled'        { name: string, call_id: string, outcome: 'accepted'|'refused',
 *                         code: string|null, manuscript_id: string|null, seq: number|null,
 *                         at: string }
 *                       The call RESOLVED. A REFUSAL SETTLES — it is not an error and not a
 *                       separate event. `code` carries the refusal code when refused, null
 *                       when accepted. `seq` is the ledger row this call produced.
 *                       The pair exists because one event cannot express "in flight" versus
 *                       "resolved", and the agent-activity strip needs both to show a call
 *                       landing in real time.
 *
 * 'human:action'        { action: string, manuscript_id: string|null, seq: number }
 *                       `action` is one of the five bare human verbs (constants.js
 *                       HUMAN_ACTIONS). NOTE 02 §1.9: the BUS EVENT is named 'human:action';
 *                       the LEDGER ROW's `action` field is never prefixed with 'human:'.
 *                       Two different things.
 *
 * 'state:changed'       { state: ReviewState, keys: string[], reason: string }
 *                       A persisted mutation. `keys` names the SessionState keys that
 *                       changed — a subset of the seven persisted keys — so a consumer can
 *                       re-render only what moved. `reason` is a bare verb: 'ledger_append'
 *                       | 'set_weights' | 'set_score' | 'unblind' | 'commit_recommendation'
 *                       | 'reset' | 'beforeunload'.
 *
 * 'integrity:detected'  { manuscript_id: string, sections_affected: string[],
 *                         injection_attempts: number }
 *                       Emitted by the adversarial layer at boot. Payload carries COUNTS
 *                       AND SECTION NAMES ONLY — never IntegrityEvent.raw_excerpt. The raw
 *                       payload text reaches the split-screen through the in-memory
 *                       derivation, not through this bus.
 *
 * --- CORE'S ADDITIONS (finer-grained; optional to listen to) ----------------------
 *
 * 'state:loaded'        { state: ReviewState, notice: string|null, fresh: boolean }
 *                       Emitted once by loadState(). `notice` is one of
 *                       STATE_DISCARDED_CORRUPT | _VERSION | _SEED_CHANGED | _SCHEMA,
 *                       or null on a clean load / first visit. `fresh` is true when the
 *                       state came from seedState() rather than storage.
 *
 * 'state:reset'         { state: ReviewState }
 *                       resetSession() completed; everything downstream must re-derive.
 *
 * 'state:persist_failed'{ error: Error, reason: string }
 *                       localStorage write threw (quota, private mode). The session keeps
 *                       running in memory; the UI should say so rather than pretend it saved.
 *
 * 'ledger:appended'     { entry: LedgerEntry, state: ReviewState }
 *                       ONE event per row, accepted and refused alike. The ledger view
 *                       appends from this; it never polls.
 *
 * 'ranking:changed'     { ranking: RankedItem[], weights: object }
 *                       Re-derived table, whole. Nothing is patched incrementally.
 *
 * 'unblind:granted'     { manuscript_id: string, reason: string, at: string }
 *                       The human revealed identity for one manuscript. THE AGENT'S VIEW
 *                       DOES NOT CHANGE — no tool return reads state.unblinded. Only the
 *                       identity panel listens to this.
 *
 * 'commitment:made'     { commitment: Commitment }
 *                       Human committed the session's one recommendation. Session locks.
 *
 * 'notice'              { level: 'info'|'warn'|'error', code: string, message: string }
 *                       Dismissible banner text.
 * =====================================================================================
 */

export const EVENTS = Object.freeze({
  // --- the six frozen by 05 §7.1. Do not rename; the UI lane is built against them. ---
  WEBMCP_CHANGED:       'webmcp:changed',
  TOOL_INVOKED:         'tool:invoked',
  TOOL_SETTLED:         'tool:settled',
  HUMAN_ACTION:         'human:action',
  STATE_CHANGED:        'state:changed',
  INTEGRITY_DETECTED:   'integrity:detected',

  // --- core's additions ---
  STATE_LOADED:         'state:loaded',
  STATE_RESET:          'state:reset',
  STATE_PERSIST_FAILED: 'state:persist_failed',
  LEDGER_APPENDED:      'ledger:appended',
  RANKING_CHANGED:      'ranking:changed',
  UNBLIND_GRANTED:      'unblind:granted',
  COMMITMENT_MADE:      'commitment:made',
  NOTICE:               'notice'
});

/** The six 05 §7.1 names, so a consumer can assert the seam rather than trust a comment. */
export const FROZEN_EVENT_NAMES = Object.freeze([
  'webmcp:changed', 'tool:invoked', 'tool:settled',
  'human:action', 'state:changed', 'integrity:detected'
]);

const EVENT_NAMES = Object.freeze(new Set(Object.values(EVENTS)));

function assertKnown(name) {
  if (!EVENT_NAMES.has(name)) {
    throw new Error(
      `refereeBus: unknown event "${name}". Known events: ${[...EVENT_NAMES].join(', ')}`
    );
  }
}

class RefereeBus {
  #listeners = new Map();

  /** @returns {() => void} unsubscribe */
  on(name, fn) {
    assertKnown(name);
    if (typeof fn !== 'function') throw new TypeError('refereeBus.on: handler must be a function');
    if (!this.#listeners.has(name)) this.#listeners.set(name, new Set());
    this.#listeners.get(name).add(fn);
    return () => this.off(name, fn);
  }

  once(name, fn) {
    const off = this.on(name, (payload) => { off(); fn(payload); });
    return off;
  }

  off(name, fn) {
    assertKnown(name);
    this.#listeners.get(name)?.delete(fn);
  }

  /**
   * Synchronous fan-out over a snapshot of the listener set, so a handler that subscribes
   * or unsubscribes during dispatch cannot mutate the iteration. A throwing listener is
   * isolated: it must not stop the ledger view from getting a row the log already holds.
   */
  emit(name, payload) {
    assertKnown(name);
    const set = this.#listeners.get(name);
    if (!set || set.size === 0) return;
    for (const fn of [...set]) {
      try { fn(payload); }
      catch (err) { console.error(`refereeBus: listener for "${name}" threw`, err); }
    }
  }

  /** Test/reset helper. Never called by app code. */
  removeAll(name) {
    if (name === undefined) this.#listeners.clear();
    else { assertKnown(name); this.#listeners.delete(name); }
  }

  listenerCount(name) {
    assertKnown(name);
    return this.#listeners.get(name)?.size ?? 0;
  }
}

export const refereeBus = new RefereeBus();
export default refereeBus;
