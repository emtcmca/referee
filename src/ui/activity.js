/**
 * src/ui/activity.js — bus subscriber and RENDERER. Turns the tool calls and
 * human actions the ledger has ALREADY recorded into rows, and gives every one
 * of them two registers at once: a plain-language line a non-technical reader
 * can follow, and the machine record underneath it. Same event, two registers,
 * never two separate reports.
 *
 * THE LOAD-BEARING RULE IN THIS FILE
 * ----------------------------------
 * A refusal is a SETTLED OUTCOME, not an error. `outcome: 'refused'` sits
 * beside `outcome: 'accepted'` in one closed enum. There is no error branch
 * for it, no catch that produces it, and no path by which it can be rendered
 * with the error vocabulary. `tool:settled` fires for both, on the same code
 * path, because the handler RETURNS `{ok:false, ...}` rather than throwing.
 * A refusal that never reaches the bus is a refusal the page cannot show.
 *
 * System errors are the opposite case and are handled nowhere near here:
 * 02 sec 5.4 and 05 sec 8.3 close `actor` at agent|human, and a page fault has
 * neither. Nothing in this file can express one.
 *
 * ============================================================================
 * OWNERSHIP AT THIS SEAM: THE LEDGER WRITES AND EMITS. THE FEED RENDERS.
 * ----------------------------------------------------------------------------
 * core/ledger.js appendLedger() is the sole writer, and it EMITS 'tool:settled'
 * (agent rows) and 'human:action' (human rows) AFTER the row is on the log. Both
 * of this module's bus handlers are therefore downstream of a write that has
 * already happened. A handler that wrote in response would re-enter the writer
 * that woke it — settle, append, settle, append, without end. Both handlers had
 * that shape; the human one is the same cycle through a different event name.
 *
 * The cure is ownership, not a re-entrancy flag. A flag would concede that the
 * feed may write and merely suppress the second attempt. It may not write at
 * all. So the feed holds no writer, and there is nothing here to loop with.
 *
 * The write belongs to whoever ORIGINATES the action — the tool wrapper for an
 * agent call, the control the human actually clicked for a human verb. Neither
 * lives in this file, so no legitimate caller of a writer remained here and the
 * injection point is gone. Handing one to createActivityFeed now throws at
 * wiring time rather than looping at the first tool call.
 *
 * import { refereeBus } from '../core/bus.js';
 *   assumed surface: refereeBus.on(name, handler) -> unsubscribe fn
 *                    refereeBus.emit(name, payload)
 *   payloads read here, in the spelling core actually emits (bus.js, 05 sec 7.1):
 *     'tool:invoked'       {name, call_id, manuscript_id, args_digest, at}
 *     'tool:settled'       {name, call_id, outcome, code, manuscript_id, seq, at}
 *     'human:action'       {action, manuscript_id, seq}
 *     'integrity:detected' {manuscript_id, sections_affected, injection_attempts}
 *   The older {tool, ok, ts} spelling is still accepted on read, so a host
 *   replaying an older capture into the feed does not render blank rows.
 *
 * The bus is INJECTED rather than imported at module scope, so this file has
 * zero static imports and can be driven in a test by a hand-built emitter.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Frozen vocabulary                                                          */
/* -------------------------------------------------------------------------- */

/** 05 sec 7.1. If a name changes it changes in the bus contract first. */
export const BUS_EVENTS = Object.freeze({
  WEBMCP_CHANGED: 'webmcp:changed',
  TOOL_INVOKED: 'tool:invoked',
  TOOL_SETTLED: 'tool:settled',
  HUMAN_ACTION: 'human:action',
  STATE_CHANGED: 'state:changed',
  INTEGRITY_DETECTED: 'integrity:detected',
});

/** 02 sec 1.9. Two values. There is no third, and no `system`. */
export const ACTORS = Object.freeze(['agent', 'human']);

/** 02 sec 1.9. Two values. `'ok'` is dead vocabulary on this record. */
export const OUTCOMES = Object.freeze(['accepted', 'refused']);

/** 03 sec 1.3, transcribed at 02 sec 1.9. Imported by core; mirrored here only
 *  so the plain-language table can be proven total against it in a test. */
export const REFUSAL_CODES = Object.freeze([
  'INVALID_ARGUMENT', 'UNKNOWN_MANUSCRIPT', 'SECTION_NOT_FOUND', 'QUOTE_TOO_SHORT',
  'EVIDENCE_NOT_FOUND', 'INVALID_CRITERION', 'OUT_OF_ORDER', 'ALREADY_COMMITTED',
  'REQUIRES_HUMAN', 'HUMAN_ONLY', 'INTERNAL',
]);

/** The seven registered tools. */
export const TOOL_NAMES = Object.freeze([
  'read_manuscript', 'assert_finding', 'check_claim', 'get_review_state',
  'flag_for_editor', 'request_unblind', 'submit_recommendation',
]);

/** 02 sec 1.9. Five human verbs, bare, never prefixed. `set_score` is dead. */
export const HUMAN_VERBS = Object.freeze([
  'set_weights', 'unblind', 'add_note', 'commit_recommendation', 'session_reset',
]);

/* -------------------------------------------------------------------------- */
/* The plain-language layer                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Frozen templates. 02 sec 1.9 forbids interpolating manuscript content, quote
 * text, or a near-miss offset into any log string — an attacker probing refusal
 * strings must learn nothing that varies with hidden content. Only enumerated
 * tokens are substituted here: a tool name, a refusal code, an actor, and a
 * manuscript id, all of which are already on the row and all of which are
 * public. No template below reads a value out of args or out of a return.
 */
export const ACTION_PHRASES = Object.freeze({
  read_manuscript: Object.freeze({
    accepted: 'The agent read the manuscript.',
    refused: 'The agent tried to read a manuscript and the page refused.',
  }),
  assert_finding: Object.freeze({
    accepted: 'The agent recorded a finding, and its quote was checked against the manuscript.',
    refused: 'The agent tried to record a finding and the page refused it.',
  }),
  check_claim: Object.freeze({
    accepted: 'The agent checked a claim against the manuscript.',
    refused: 'The agent tried to check a claim and the page refused.',
  }),
  get_review_state: Object.freeze({
    accepted: 'The agent read the current review state.',
    refused: 'The agent tried to read the review state and the page refused.',
  }),
  flag_for_editor: Object.freeze({
    accepted: 'The agent raised a concern for the editor.',
    refused: 'The agent tried to raise a concern for the editor and the page refused.',
  }),
  request_unblind: Object.freeze({
    accepted: 'An unblinding was recorded.',
    refused: 'The agent asked to see who wrote this. The page refused. That decision is yours.',
  }),
  submit_recommendation: Object.freeze({
    accepted: 'A recommendation was recorded.',
    refused: 'The agent tried to commit a recommendation. The page refused. This decision is yours.',
  }),
  set_weights: Object.freeze({
    accepted: 'You changed the rubric weights.',
    refused: 'A rubric change was not applied.',
  }),
  unblind: Object.freeze({
    accepted: 'You unblinded the author identity, and your reason was recorded.',
    refused: 'An unblinding was not applied.',
  }),
  add_note: Object.freeze({
    accepted: 'You added a note. The agent does not receive it.',
    refused: 'A note was not added.',
  }),
  commit_recommendation: Object.freeze({
    accepted: 'You committed the recommendation. This closes the review for this session.',
    refused: 'The recommendation was not committed.',
  }),
  session_reset: Object.freeze({
    accepted: 'The session was reset to its starting state.',
    refused: 'The session was not reset.',
  }),
});

/**
 * Why the page refused, in one plain sentence each. Total over REFUSAL_CODES —
 * a test asserts that, so a new code cannot ship without its sentence.
 */
export const REFUSAL_PHRASES = Object.freeze({
  INVALID_ARGUMENT: 'The request was not shaped the way the tool requires.',
  UNKNOWN_MANUSCRIPT: 'No manuscript with that identifier is in this queue.',
  SECTION_NOT_FOUND: 'That section is not part of this manuscript.',
  QUOTE_TOO_SHORT: 'The supporting quote was too short to verify.',
  EVIDENCE_NOT_FOUND: 'The quote does not appear in the manuscript, so the claim was not recorded.',
  INVALID_CRITERION: 'That is not one of the rubric criteria.',
  OUT_OF_ORDER: 'The manuscript has to be read before that call can be made.',
  ALREADY_COMMITTED: 'The review is already committed and cannot be changed.',
  REQUIRES_HUMAN: 'This decision belongs to the human reviewer.',
  HUMAN_ONLY: 'Only the human reviewer can change what is visible.',
  INTERNAL: 'The tool could not complete the request.',
});

export const ACTOR_LABEL = Object.freeze({ agent: 'AGENT', human: 'YOU' });
export const OUTCOME_LABEL = Object.freeze({ accepted: 'ACCEPTED', refused: 'REFUSED' });

/** Turn `assert_finding` into `assert finding` for speech. */
function spoken(token) {
  return String(token || '').replace(/_/g, ' ').toLowerCase();
}

/* -------------------------------------------------------------------------- */
/* Row construction                                                           */
/* -------------------------------------------------------------------------- */

export function isRefusal(entryOrPayload) {
  if (!entryOrPayload) return false;
  if (typeof entryOrPayload.outcome === 'string') return entryOrPayload.outcome === 'refused';
  if (typeof entryOrPayload.ok === 'boolean') return entryOrPayload.ok === false;
  return false;
}

/** Refusals are settled outcomes. Nothing on this path is ever an error. */
export function isError() {
  return false;
}

/**
 * Map a `tool:settled` payload onto the fields one row is RENDERED from. The
 * field names are 02 sec 1.9 exactly — the ledger row's own vocabulary, because
 * the feed shows the record the ledger already holds and must not invent a
 * second one. `'ok'`, `detail` and `integrity` are dead here and never produced.
 *
 * This is a read. Nothing downstream of it appends anything. `seq` and `ts` are
 * ECHOED off the settle payload the ledger stamped, and stay null when the
 * payload carries none: the feed never numbers or times a row itself, because
 * only the writer knows which row it is.
 */
export function settledToRowInput(payload, options) {
  const p = payload || {};
  const opts = options || {};
  const actor = ACTORS.indexOf(p.actor) === -1 ? 'agent' : p.actor;
  const refused = isRefusal(p);
  // `name` is core's spelling on the bus; `tool` is the older one. Reading both
  // keeps a replayed capture renderable without core renaming an event field.
  const action = p.name || p.tool || p.action || opts.action || null;
  return {
    seq: typeof p.seq === 'number' ? p.seq : null,
    ts: p.at || p.ts || null,
    actor,
    action,
    manuscript_id: p.manuscript_id === undefined
      ? (p.manuscriptId === undefined ? null : p.manuscriptId)
      : p.manuscript_id,
    args_digest: p.args_digest || p.argsSummary || {},
    outcome: refused ? 'refused' : 'accepted',
    code: refused ? (p.code || 'INTERNAL') : null,
    visible_fields_at_time: Array.isArray(p.visible_fields_at_time)
      ? p.visible_fields_at_time.slice()
      : [],
    note: typeof p.note === 'string' ? p.note : null,
  };
}

/** Map a `human:action` payload the same way, and the same way round: the row it
 *  describes is already on the log, which is why this event exists at all. Human
 *  rows are always accepted — a human action that did not happen is never
 *  written, so it never reaches this event. */
export function humanToRowInput(payload) {
  const p = payload || {};
  return {
    seq: typeof p.seq === 'number' ? p.seq : null,
    ts: p.at || p.ts || null,
    actor: 'human',
    action: p.action || null,
    manuscript_id: p.manuscript_id === undefined
      ? (p.manuscriptId === undefined ? null : p.manuscriptId)
      : p.manuscript_id,
    args_digest: p.args_digest || {},
    outcome: 'accepted',
    code: null,
    visible_fields_at_time: Array.isArray(p.visible_fields_at_time)
      ? p.visible_fields_at_time.slice()
      : [],
    note: typeof p.note === 'string' ? p.note : null,
  };
}

/**
 * The view model for one ledger row. Design-agnostic: it carries strings and
 * booleans, and never a class name, a color, or an element.
 *
 *   plain   — the non-technical line, the heading of the pair
 *   machine — the technical record, the subheading beneath it
 *   sr      — 05 sec 9.4: ONE flat sentence, and the only thing a screen
 *             reader announces. The three visible lines are aria-hidden.
 */
export function toRow(entry) {
  const e = entry || {};
  const actor = ACTORS.indexOf(e.actor) === -1 ? 'agent' : e.actor;
  const outcome = OUTCOMES.indexOf(e.outcome) === -1 ? 'accepted' : e.outcome;
  const refused = outcome === 'refused';
  const action = e.action || 'unknown';

  const phrases = ACTION_PHRASES[action];
  const base = phrases
    ? phrases[outcome]
    : (refused ? 'The page refused this call.' : 'A call was recorded.');
  const because = refused ? (REFUSAL_PHRASES[e.code] || REFUSAL_PHRASES.INTERNAL) : '';
  const plain = refused ? base + ' ' + because : base;

  const machine = {
    seq: e.seq === undefined ? null : e.seq,
    ts: e.ts || null,
    actor,
    action,
    outcome,
    code: refused ? (e.code || 'INTERNAL') : null,
    manuscript_id: e.manuscript_id === undefined ? null : e.manuscript_id,
    visible_fields_at_time: Array.isArray(e.visible_fields_at_time)
      ? e.visible_fields_at_time.slice()
      : [],
    note: e.note === undefined ? null : e.note,
  };

  const srParts = [
    actor === 'agent' ? 'Agent' : 'You',
    spoken(action),
    outcome,
  ];
  if (refused) srParts.push(spoken(machine.code));
  const sr = srParts.join(', ') + '.';

  return {
    seq: machine.seq,
    ts: machine.ts,
    actor,
    actorLabel: ACTOR_LABEL[actor],
    action,
    outcome,
    outcomeLabel: OUTCOME_LABEL[outcome],
    /** A settled outcome. Never route this through an error surface. */
    refused,
    code: machine.code,
    manuscriptId: machine.manuscript_id,
    visibleFields: machine.visible_fields_at_time,
    plain,
    machine,
    sr,
  };
}

/* -------------------------------------------------------------------------- */
/* The Agent Pulse — 05 sec 7.3                                               */
/* -------------------------------------------------------------------------- */

export const PULSE_STATES = Object.freeze(['idle', 'invoked', 'settled', 'decay']);
/** Refusal is held LONGER than success, deliberately. */
export const PULSE_HOLD_OK_MS = 700;
export const PULSE_HOLD_REFUSED_MS = 900;
export const PULSE_DECAY_MS = 300;
export const PULSE_STILL_RUNNING_MS = 10000;

/**
 * The sweep never fakes completion. There is no timeout that pretends a call
 * finished; after 10s the label simply gains a "still running" suffix.
 */
export function createPulse(options) {
  const opts = options || {};
  const onChange = typeof opts.onChange === 'function' ? opts.onChange : () => {};
  const setTimer = opts.setTimer || ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer || ((h) => clearTimeout(h));

  let state = 'idle';
  let label = 'AGENT IDLE';
  let tool = null;
  let outcome = null;
  let code = null;
  let stillRunning = false;
  let holdTimer = null;
  let runningTimer = null;

  function clearTimers() {
    if (holdTimer !== null) { clearTimer(holdTimer); holdTimer = null; }
    if (runningTimer !== null) { clearTimer(runningTimer); runningTimer = null; }
  }

  function emit() {
    onChange({ state, label, tool, outcome, code, stillRunning });
  }

  return {
    snapshot: () => ({ state, label, tool, outcome, code, stillRunning }),

    invoked(payload) {
      const p = payload || {};
      clearTimers();
      state = 'invoked';
      tool = p.tool || null;
      outcome = null;
      code = null;
      stillRunning = false;
      label = tool ? tool : 'AGENT WORKING';
      runningTimer = setTimer(() => {
        stillRunning = true;
        emit();
      }, PULSE_STILL_RUNNING_MS);
      emit();
    },

    settled(payload) {
      const p = payload || {};
      clearTimers();
      const refused = isRefusal(p);
      state = 'settled';
      tool = p.tool || tool;
      outcome = refused ? 'refused' : 'accepted';
      code = refused ? (p.code || 'INTERNAL') : null;
      stillRunning = false;
      label = refused ? (tool || 'call') + ' ' + code : (tool || 'call') + ' ok';
      emit();
      holdTimer = setTimer(() => {
        state = 'decay';
        emit();
        holdTimer = setTimer(() => {
          state = 'idle';
          label = 'AGENT IDLE';
          tool = null;
          outcome = null;
          code = null;
          emit();
        }, PULSE_DECAY_MS);
      }, refused ? PULSE_HOLD_REFUSED_MS : PULSE_HOLD_OK_MS);
    },

    reset() {
      clearTimers();
      state = 'idle';
      label = 'AGENT IDLE';
      tool = null; outcome = null; code = null; stillRunning = false;
      emit();
    },

    dispose: clearTimers,
  };
}

/* -------------------------------------------------------------------------- */
/* The feed                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Subscribes to the bus and produces view rows. IT DOES NOT WRITE.
 *
 * NOT WIRED IN THIS BUILD, DELIBERATELY. `ui/render/index.js` renders rows,
 * refusal tallies and findings out of `state.ledger` directly, and takes only
 * `createPulse` from this module. This factory is kept because its guard below
 * is the executable record of the ownership ruling, and its tests are what
 * prove that ruling still holds. Read it before wiring anything to the bus.
 *
 * The ledger writes and emits; the feed renders. Every event this subscribes to
 * is emitted BY the writer, after the row exists, so a write from any handler
 * below would re-enter the writer that woke it and never stop. See the ownership
 * block at the top of this file.
 *
 * @param {object}   options
 * @param {object}   options.bus            refereeBus (injected, see header)
 * @param {function} [options.onRow]        (row) -> void, row from toRow()
 * @param {function} [options.onPulse]      pulse snapshot
 * @param {function} [options.onIntegrity]  integrity:detected passthrough
 * @param {function} [options.onRefusalCounts] ({byTool, total}) — drives the
 *                   "N refused — see ledger" affordance without ever creating
 *                   a finding for a refused claim.
 *
 * There is deliberately no `appendLedger` and no `getState` option. Passing a
 * writer throws, immediately and by name, rather than deferring the failure to
 * the first tool call of a live demo.
 */
export function createActivityFeed(options) {
  const opts = options || {};
  const bus = opts.bus;

  // THE SEAM, GUARDED AT WIRING TIME RATHER THAN AT DISPATCH TIME.
  // This is not a re-entrancy check — it does not ask whether we are already
  // inside a settle, and it does not suppress a second call. It refuses the
  // capability outright, before a single event has flowed, because the feed has
  // no business owning a writer: appendLedger() is what emits 'tool:settled' and
  // 'human:action' in the first place. Give the writer to the layer that
  // originates the action; give this feed onRow.
  if (opts.appendLedger !== undefined) {
    throw new TypeError(
      'createActivityFeed: the feed renders, it does not write. ' +
      'core/ledger.js appendLedger() is the sole writer and it EMITS the events ' +
      'this feed subscribes to, so a feed holding a writer re-enters it on every ' +
      'settle. Pass the writer to the layer that originates the action (the tool ' +
      'wrapper for an agent call, the control the human clicked for a human verb) ' +
      'and pass this feed onRow.'
    );
  }

  const onRow = typeof opts.onRow === 'function' ? opts.onRow : () => {};
  const onIntegrity = typeof opts.onIntegrity === 'function' ? opts.onIntegrity : () => {};
  const onRefusalCounts = typeof opts.onRefusalCounts === 'function' ? opts.onRefusalCounts : () => {};

  const pulse = createPulse({
    onChange: opts.onPulse,
    setTimer: opts.setTimer,
    clearTimer: opts.clearTimer,
  });

  const refusalsByTool = new Map();
  let refusalTotal = 0;
  const unsubscribers = [];

  /** Render one row. The whole of what this feed does with an event. */
  function render(input) {
    const row = toRow(input);
    onRow(row);
    return row;
  }

  function countRefusal(row) {
    if (!row.refused) return;
    refusalTotal += 1;
    refusalsByTool.set(row.action, (refusalsByTool.get(row.action) || 0) + 1);
    onRefusalCounts({ total: refusalTotal, byTool: Object.fromEntries(refusalsByTool) });
  }

  function handleSettled(payload) {
    const input = settledToRowInput(payload);
    // Normalised for the pulse too, so an accepted/refused outcome string reads
    // the same as the older {ok} spelling.
    pulse.settled({ tool: input.action, outcome: input.outcome, code: input.code });
    const row = render(input);
    countRefusal(row);
    return row;
  }

  function handleHuman(payload) {
    return render(humanToRowInput(payload));
  }

  return {
    pulse,

    /** Exposed so a host can drive the feed without a bus (tests, replay of
     *  a live session into a second surface). Both are renderers: handing them
     *  an event that never reached the ledger shows a row the log does not have,
     *  which is the caller's mistake to avoid, not this feed's to write around. */
    handleSettled,
    handleHuman,
    handleInvoked: (payload) => pulse.invoked({
      tool: (payload && (payload.name || payload.tool)) || null,
    }),

    refusalCounts: () => ({ total: refusalTotal, byTool: Object.fromEntries(refusalsByTool) }),

    start() {
      if (!bus || typeof bus.on !== 'function') {
        return { ok: false, reason: 'bus-absent' };
      }
      unsubscribers.push(bus.on(BUS_EVENTS.TOOL_INVOKED, (p) => pulse.invoked({
        tool: (p && (p.name || p.tool)) || null,
      })));
      unsubscribers.push(bus.on(BUS_EVENTS.TOOL_SETTLED, handleSettled));
      unsubscribers.push(bus.on(BUS_EVENTS.HUMAN_ACTION, handleHuman));
      unsubscribers.push(bus.on(BUS_EVENTS.INTEGRITY_DETECTED, onIntegrity));
      return { ok: true, subscribed: 4 };
    },

    stop() {
      while (unsubscribers.length) {
        const off = unsubscribers.pop();
        if (typeof off === 'function') off();
      }
      pulse.dispose();
    },
  };
}
