/**
 * src/core/ledger.js — the append-only log, and every record derived from it.
 *
 * =====================================================================================
 * APPEND-ONLY MEANS APPEND-ONLY
 * =====================================================================================
 * Entries are never edited and never removed. The array is only ever pushed to. There is
 * exactly one writer, appendLedger(), and it is called by defineTool() for EVERY tool call
 * — ACCEPTED AND REFUSED ALIKE — and by the UI for every human action. A refusal is a
 * first-class row: the record of what the agent tried and was denied is the demo.
 *
 * =====================================================================================
 * findings / editorFlags / humanEvidence ARE DERIVED, NEVER PERSISTED (02 §1.11)
 * =====================================================================================
 * Replaying the log is the ONLY way one of these records can come into being, which makes
 * it impossible to represent a finding the ledger does not show. The log therefore cannot
 * be incomplete. The cost is a replay on every load; at demo volumes that is free.
 *
 * THE REPLAY PREDICATE IS `outcome === 'accepted'`.
 * The writer stamps 'accepted'. A reader testing for 'ok' matches ZERO ROWS and silently
 * empties the findings board — that exact bug shipped in a spec revision of this project
 * (02 RECONCILED PASS 2 · D1) and it was invisible because an empty board looks like a
 * board with nothing on it yet. Anything here reading 'ok' is a regression.
 */
import { OUTCOME_ACCEPTED, OUTCOME_REFUSED, REFUSAL_CODES, HUMAN_ACTIONS } from './constants.js';
import { visibleFieldsAtTime } from './visibility.js';
import { hash8 } from './hash.js';
import { refereeBus, EVENTS } from './bus.js';

const OUTCOMES = new Set([OUTCOME_ACCEPTED, OUTCOME_REFUSED]);
const ACTORS = new Set(['agent', 'human']);

/**
 * The active session state and the persist hook, injected by state.js.
 * Injected rather than imported so ledger.js and state.js do not form an import cycle,
 * and so a test can drive the ledger against a hand-built state object.
 */
let boundState = null;
let onAppend = null;

export function bindLedger(state, persistFn = null) {
  boundState = state;
  onAppend = persistFn;
  return state;
}

export function getBoundState() {
  return boundState;
}

/**
 * appendLedger — the single writer.
 *
 * SIGNATURE NOTE (a real seam, declared rather than papered over): 03 §0.4 specifies
 * `appendLedger(entry)` and 02 §1.9 specifies `appendLedger(state, partial)`. Both call
 * forms are accepted. `appendLedger(entry)` — the form the tool wrapper uses — writes to
 * the state bound by bindLedger(). The two-argument form is for the UI and for tests that
 * hold their own state object. Dispatch is on whether the first argument looks like a
 * state (has a `ledger` array), which no LedgerEntryInput does.
 *
 * @param {object} a  LedgerEntryInput, or a ReviewState
 * @param {object} [b] LedgerEntryInput when `a` is a state
 * @returns {object} the stored LedgerEntry, with seq and ts filled in
 */
export function appendLedger(a, b) {
  const twoArg = b !== undefined || (a && Array.isArray(a.ledger));
  const state = twoArg ? a : boundState;
  const input = twoArg ? b : a;

  if (!state || !Array.isArray(state.ledger)) {
    throw new Error('appendLedger: no bound state. Call bindLedger(state) at boot.');
  }
  if (!input || typeof input !== 'object') {
    throw new TypeError('appendLedger: entry must be an object');
  }
  if (!ACTORS.has(input.actor)) {
    throw new TypeError(`appendLedger: actor must be 'agent' or 'human', got ${input.actor}`);
  }
  if (typeof input.action !== 'string' || input.action.length === 0) {
    throw new TypeError('appendLedger: action must be a non-empty string');
  }
  // 02 §1.9: the action is BARE. 'human:<verb>' is dead — the ledger filter keys on this
  // literal. (The BUS event is named 'human:action', which is a different thing entirely.)
  if (input.action.includes(':')) {
    throw new TypeError(
      `appendLedger: action "${input.action}" is prefixed. Ledger actions are bare verbs; ` +
      `the colon form is a bus event name, not a ledger action.`
    );
  }
  if (input.actor === 'human' && !HUMAN_ACTIONS.includes(input.action)) {
    throw new TypeError(
      `appendLedger: "${input.action}" is not one of the five human verbs ` +
      `(${HUMAN_ACTIONS.join(', ')}). 'set_score' is dead — no tool or human verb writes a score.`
    );
  }
  if (!OUTCOMES.has(input.outcome)) {
    throw new TypeError(
      `appendLedger: outcome must be 'accepted' or 'refused', got ${input.outcome}. ` +
      `'ok' is dead (02 PASS 2 · D1) — it matched zero rows on replay.`
    );
  }
  if (input.outcome === OUTCOME_REFUSED && !REFUSAL_CODES.includes(input.code)) {
    throw new TypeError(`appendLedger: refused rows need a frozen refusal code, got ${input.code}`);
  }
  if (input.outcome === OUTCOME_ACCEPTED && input.code != null) {
    throw new TypeError('appendLedger: accepted rows carry code: null');
  }

  const manuscript_id = input.manuscript_id ?? null;

  const entry = Object.freeze({
    seq: state.ledger.length + 1,          // monotonic, dense, 1-based
    ts: new Date().toISOString(),
    actor: input.actor,
    action: input.action,
    manuscript_id,
    args_digest: input.args_digest ?? {},
    outcome: input.outcome,
    code: input.outcome === OUTCOME_REFUSED ? input.code : null,
    // Computed HERE, at append time, from the actor and the state as they are right now.
    // A caller may pass it explicitly (the tool wrapper does), but it is never trusted to
    // be wider than what visibility.js would have returned.
    visible_fields_at_time: Array.isArray(input.visible_fields_at_time)
      ? input.visible_fields_at_time
      : visibleFieldsAtTime(input.actor, manuscript_id, state),
    note: input.note ?? null
  });

  state.ledger.push(entry);

  refereeBus.emit(EVENTS.LEDGER_APPENDED, { entry, state });

  if (entry.actor === 'agent') {
    // 05 §7.1's settle half. A REFUSAL SETTLES — it is an outcome, not an error, and it
    // does not get its own event. The invoke half is emitted by the tool wrapper BEFORE
    // the handler runs (see emitToolInvoked), because by the time a row reaches the ledger
    // the call is already over and "in flight" can no longer be expressed.
    refereeBus.emit(EVENTS.TOOL_SETTLED, {
      name: entry.action,
      call_id: input.call_id ?? `seq-${entry.seq}`,
      outcome: entry.outcome,
      code: entry.code,
      manuscript_id: entry.manuscript_id,
      seq: entry.seq,
      at: entry.ts
    });
  } else {
    refereeBus.emit(EVENTS.HUMAN_ACTION, {
      action: entry.action, manuscript_id: entry.manuscript_id, seq: entry.seq
    });
  }

  if (typeof onAppend === 'function') onAppend(state, 'ledger_append', ['ledger']);
  return entry;
}

/**
 * 05 §7.1's invoke half. The tool wrapper calls this BEFORE running a handler, then passes
 * the same `call_id` on the entry it hands to appendLedger, so the pair matches up.
 *
 * @param {{name: string, call_id: string, manuscript_id?: string|null, args_digest?: object}} c
 * @returns {string} the call_id, so a caller can generate one here if it has none
 */
export function emitToolInvoked({ name, call_id, manuscript_id = null, args_digest = {} }) {
  const id = call_id ?? `call-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  refereeBus.emit(EVENTS.TOOL_INVOKED, {
    name, call_id: id, manuscript_id, args_digest, at: new Date().toISOString()
  });
  return id;
}

// ---------------------------------------------------------------------------------------
// Derivations. Pure over state.ledger. Nothing below reads storage or mutates state.
// ---------------------------------------------------------------------------------------

const accepted = (e, action) => e.action === action && e.outcome === OUTCOME_ACCEPTED;

/**
 * 02 §1.7 / 03 §0.8. Rows with action 'assert_finding' and outcome 'accepted', in seq order.
 * The finding fields live on the row's args_digest, which 03 §4.3's digest override puts
 * there for exactly this purpose.
 *
 * SUPERSESSION is an ordering fact about an append-only log, not a mutation of a stored
 * record: for one (manuscript_id, criterion) the highest-seq accepted row is 'active' and
 * every earlier one is 'superseded'. Nothing is ever edited.
 *
 * A REFUSED ASSERTION NEVER BECOMES A FINDING. Refusals exist only as ledger rows. There
 * is no rejected-findings list to browse, because a browsable refusal log keyed to quote
 * text is an oracle surface — an agent could hill-climb a fabrication against it.
 */
export function deriveFindings(state) {
  const rows = (state?.ledger ?? []).filter((e) => accepted(e, 'assert_finding'));

  const findings = rows.map((e) => {
    const d = e.args_digest ?? {};
    return {
      finding_id: d.finding_id ?? 'f_' + hash8(
        `${e.manuscript_id}|${d.criterion}|${d.section}|${d.normalized_quote ?? ''}|${e.seq}`),
      ledger_seq: e.seq,
      manuscript_id: e.manuscript_id,
      criterion: d.criterion ?? null,
      section: d.section ?? null,
      evidence_quote: d.evidence_quote ?? null,
      normalized_quote: d.normalized_quote ?? null,
      verification: d.verification ?? null,
      claim: d.claim ?? null,
      polarity: d.polarity ?? null,
      severity: d.severity ?? null,
      score: d.score ?? null,
      status: 'active',
      superseded_by: null,
      asserted_at: d.asserted_at ?? e.ts
    };
  });

  // Second pass: last accepted row per (manuscript_id, criterion) wins.
  const latest = new Map();
  for (const f of findings) latest.set(`${f.manuscript_id}|${f.criterion}`, f);
  for (const f of findings) {
    const winner = latest.get(`${f.manuscript_id}|${f.criterion}`);
    if (winner !== f) {
      f.status = 'superseded';
      f.superseded_by = winner.finding_id;
    }
  }
  return findings;
}

/** 02 §1.11 EditorFlag — derived from accepted 'flag_for_editor' rows. */
export function deriveEditorFlags(state) {
  return (state?.ledger ?? [])
    .filter((e) => accepted(e, 'flag_for_editor'))
    .map((e) => {
      const d = e.args_digest ?? {};
      return {
        id: d.flag_id ?? 'flag_' + hash8(`${e.manuscript_id}|${d.concern_type}|${e.seq}`),
        ledger_seq: e.seq,
        manuscript_id: e.manuscript_id,
        actor: e.actor,
        concern_type: d.concern_type ?? 'other',
        note: d.note ?? e.note ?? null,
        created_at: e.ts
      };
    });
}

/**
 * 02 §1.8 HumanEvidence — derived from accepted human 'add_note' rows.
 *
 * `saw_identity` is the honest counterpart to the agent's blinding, and it is read off the
 * row's OWN visible_fields_at_time rather than recomputed against today's unblind list.
 * A note written before an unblind must keep reading false forever; recomputing it later
 * would rewrite history to match the present, which is the one thing an append-only log
 * exists to prevent.
 */
export function deriveHumanEvidence(state) {
  return (state?.ledger ?? [])
    .filter((e) => e.actor === 'human' && accepted(e, 'add_note'))
    .map((e) => {
      const d = e.args_digest ?? {};
      return {
        id: d.evidence_id ?? 'he_' + hash8(`${e.manuscript_id}|${e.seq}`),
        ledger_seq: e.seq,
        manuscript_id: e.manuscript_id,
        section_id: d.section_id ?? null,
        note: d.note ?? e.note ?? null,
        saw_identity: (e.visible_fields_at_time ?? []).some((p) => p.startsWith('identity.')),
        created_at: e.ts
      };
    });
}

/**
 * 03 §0.8 — verbatim. Was this manuscript (optionally, this section) actually read by the
 * agent? Derived, so the call-ordering gate cannot be satisfied by anything but a real,
 * accepted read that is on the record.
 */
export function hasRead(state, manuscriptId, section /* optional */) {
  return state.ledger.some((e) =>
    e.actor === 'agent' &&
    e.action === 'read_manuscript' &&
    e.outcome === 'accepted' &&
    e.manuscript_id === manuscriptId &&
    (section == null || (e.args_digest.sections_returned || []).includes(section))
  );
}

/** All derivations in one pass, for state.js's rebuild step (02 §1.11). */
export function deriveAll(state) {
  return {
    findings: deriveFindings(state),
    editorFlags: deriveEditorFlags(state),
    humanEvidence: deriveHumanEvidence(state)
  };
}

/** Read-only view. Callers get a copy so no consumer can push a row that skipped validation. */
export function readLedger(state) {
  return [...(state?.ledger ?? [])];
}

/** Ledger rows are dense and 1-based (02 §5.4 rule 5). Used by validatePersisted. */
export function ledgerSeqIsDense(ledger) {
  if (!Array.isArray(ledger)) return false;
  return ledger.every((e, i) => e && e.seq === i + 1);
}
