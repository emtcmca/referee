/**
 * src/ui/states.js — the empty / loading / error / WebMCP-absent state machine,
 * expressed as DATA rather than markup.
 *
 * Every design direction renders these states differently. None of them may
 * redefine which states exist, what may follow what, or what the page says.
 * This file is the shared answer to all three; the design layer supplies only
 * the treatment.
 *
 * ============================================================================
 * ASSUMED SEAM WITH LANE CORE (src/core/bus.js)
 * ----------------------------------------------------------------------------
 * Imported: nothing. Driven by events, which the host forwards in:
 *   refereeBus.on('webmcp:changed', ({phase, registered, total, failed}) => ...)
 * Assumed event name:  'webmcp:changed'    (05 sec 7.1)
 * Assumed phases:      probing | registering | live | partial | unavailable
 *                                            (05 sec 7.2, five phases)
 * Assumed attribute:   document.documentElement.dataset.webmcp, written by
 *                      src/tools/register.js per 03 sec 6.1, taking exactly
 *                      three values: connecting | active | absent
 *                                            (05 sec 8.4.1)
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* 1. WebMCP — five phases, three attribute values                            */
/* -------------------------------------------------------------------------- */

/** 05 sec 7.2. The pill reads these; the counter counts registration settles. */
export const WEBMCP_PHASES = Object.freeze([
  'probing', 'registering', 'live', 'partial', 'unavailable',
]);

/** 05 sec 8.4.1. Exactly three. Adding a fourth here without a matching CSS
 *  selector, or vice versa, reopens the attribute-with-no-reader defect. */
export const WEBMCP_ATTR_VALUES = Object.freeze(['connecting', 'active', 'absent']);

export const WEBMCP_ATTR_NAME = 'webmcp';
export const WEBMCP_TOOL_TOTAL = 7;

/** A state that flashes past is a state a judge thinks is missing. */
export const MIN_REGISTERING_MS = 500;
/** Skeletons only if boot has genuinely not completed (05 sec 8.2). */
export const SKELETON_DELAY_MS = 400;
/** The "still running" suffix on the pulse label (05 sec 7.3). */
export const PULSE_STILL_RUNNING_MS = 10000;

/**
 * Phase -> attribute. `partial` is deliberately not a fourth attribute value:
 * at least one tool registered means the agent side is real, so it renders
 * `active` and the pill carries the honest "PARTIAL 5/7" count.
 * A partial with zero registered is the same thing as absent.
 */
export function attrForPhase(phase, registered) {
  const n = typeof registered === 'number' ? registered : 0;
  switch (phase) {
    case 'probing':
    case 'registering':
      return 'connecting';
    case 'live':
      return 'active';
    case 'partial':
      return n > 0 ? 'active' : 'absent';
    case 'unavailable':
    default:
      // The default with no phase at all must render absent: at first paint
      // no tool is callable, and claiming otherwise for one frame is a lie
      // that happens on camera.
      return 'absent';
  }
}

/** Feature detection, 05 sec 7.2, verbatim in intent. Never assume presence. */
export function detectModelContext(doc) {
  const d = doc || (typeof document !== 'undefined' ? document : undefined);
  return !!(d && d.modelContext && typeof d.modelContext.registerTool === 'function');
}

/**
 * Legal phase transitions. The pill "never skips ahead" (05 sec 7.2), so
 * `live` is unreachable except from `registering`.
 */
export const WEBMCP_TRANSITIONS = Object.freeze({
  probing: Object.freeze(['registering', 'unavailable']),
  registering: Object.freeze(['registering', 'live', 'partial', 'unavailable']),
  live: Object.freeze(['live']),
  partial: Object.freeze(['partial']),
  unavailable: Object.freeze(['unavailable']),
});

export function canTransition(from, to) {
  const allowed = WEBMCP_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.indexOf(to) !== -1;
}

/**
 * The WebMCP phase machine. Rejects an illegal transition by keeping the
 * current phase and reporting it, rather than by throwing into the page.
 *
 * @param {object}   [options]
 * @param {function} [options.onChange] ({phase, attr, registered, total, failed, changed})
 * @param {function} [options.now]      injectable clock, ms
 */
export function createWebMcpMachine(options) {
  const opts = options || {};
  const now = opts.now || (() => Date.now());
  const onChange = typeof opts.onChange === 'function' ? opts.onChange : () => {};

  let phase = 'probing';
  let registered = 0;
  let total = opts.total === undefined ? WEBMCP_TOOL_TOTAL : opts.total;
  let failed = [];
  let registeringEnteredAt = null;

  function snapshot(changed, rejected) {
    return {
      phase,
      attr: attrForPhase(phase, registered),
      registered,
      total,
      failed: failed.slice(),
      changed: !!changed,
      rejected: rejected || null,
      /** How long `registering` still owes the minimum-visible clamp. */
      holdRemainingMs: phase === 'registering' || registeringEnteredAt === null
        ? 0
        : Math.max(0, MIN_REGISTERING_MS - (now() - registeringEnteredAt)),
    };
  }

  return {
    get phase() { return phase; },
    get attr() { return attrForPhase(phase, registered); },
    snapshot: () => snapshot(false, null),

    /** Apply a `webmcp:changed` payload. Never throws on a bad payload. */
    apply(payload) {
      const p = payload || {};
      const next = WEBMCP_PHASES.indexOf(p.phase) === -1 ? phase : p.phase;
      if (typeof p.registered === 'number') registered = p.registered;
      if (typeof p.total === 'number') total = p.total;
      if (Array.isArray(p.failed)) failed = p.failed.slice();

      if (next === phase) {
        const same = snapshot(false, null);
        onChange(same);
        return same;
      }
      if (!canTransition(phase, next)) {
        const rejected = snapshot(false, { from: phase, to: next, reason: 'illegal-transition' });
        onChange(rejected);
        return rejected;
      }
      phase = next;
      if (phase === 'registering' && registeringEnteredAt === null) registeringEnteredAt = now();
      const changed = snapshot(true, null);
      onChange(changed);
      return changed;
    },

    /**
     * The minimum-visible clamp for `registering`. The host awaits this before
     * painting `live`, so instant registration still shows the counter.
     */
    holdBeforeLive() {
      if (registeringEnteredAt === null) return MIN_REGISTERING_MS;
      return Math.max(0, MIN_REGISTERING_MS - (now() - registeringEnteredAt));
    },
  };
}

/* -------------------------------------------------------------------------- */
/* 2. Region-level state — empty / loading / ready / error                    */
/* -------------------------------------------------------------------------- */

/**
 * A region is any independently-rendered panel. 05 sec 8.3: a region that
 * throws mounts its own error plate and the other regions keep working. A
 * judge never sees a blank app.
 */
export const REGION_STATES = Object.freeze(['loading', 'empty', 'ready', 'error']);

export const REGION_TRANSITIONS = Object.freeze({
  loading: Object.freeze(['empty', 'ready', 'error']),
  empty: Object.freeze(['ready', 'error', 'empty']),
  ready: Object.freeze(['empty', 'ready', 'error']),
  // A retry ("Reload panel") goes back through loading. Nothing else leaves error.
  error: Object.freeze(['loading']),
});

export function canRegionTransition(from, to) {
  const allowed = REGION_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.indexOf(to) !== -1;
}

/**
 * Per-region machine. `regions` is a list of region ids; ids are the same ones
 * bindings.js publishes in its manifest.
 */
export function createRegionMachine(regions, options) {
  const opts = options || {};
  const onChange = typeof opts.onChange === 'function' ? opts.onChange : () => {};
  const initial = opts.initial || 'loading';
  const current = new Map();
  for (const id of regions || []) current.set(id, initial);

  return {
    get(id) { return current.get(id) || null; },
    all() { return Object.fromEntries(current); },

    set(id, next, detail) {
      if (!current.has(id)) return { ok: false, reason: 'unknown-region', id };
      if (REGION_STATES.indexOf(next) === -1) return { ok: false, reason: 'unknown-state', id, next };
      const from = current.get(id);
      if (from === next) return { ok: true, id, from, to: next, changed: false };
      if (!canRegionTransition(from, next)) {
        return { ok: false, reason: 'illegal-transition', id, from, to: next };
      }
      current.set(id, next);
      const result = { ok: true, id, from, to: next, changed: true, detail: detail || null };
      onChange(result);
      return result;
    },

    /** Convenience for the try/catch every region render wraps itself in. */
    fail(id, error) {
      return this.set(id, 'error', { message: error && error.message ? error.message : String(error) });
    },
  };
}

/* -------------------------------------------------------------------------- */
/* 3. Copy — the plain-language layer, as data                                */
/* -------------------------------------------------------------------------- */

/**
 * 05 sec 8.1: every empty state teaches the thesis, and none of them says
 * "Nothing here yet." These strings are behavior, not decoration — a design
 * direction changes the typography, never the sentence.
 *
 * `lead` is the plain-language line. `sub` is the technical record beneath it
 * where one exists: same state, two registers, never two separate reports.
 */
export const EMPTY_COPY = Object.freeze({
  'desk': Object.freeze({
    lead: 'Select a manuscript from the slate.',
    sub: 'Twelve fictional submissions. The agent can read all of them. '
       + 'It cannot see who wrote any of them.',
    action: Object.freeze({ id: 'desk.openTopRanked', label: 'Open the top-ranked manuscript' }),
  }),
  'ledger': Object.freeze({
    lead: 'No activity yet.',
    sub: 'Every tool call the agent makes — accepted or refused — lands here, '
       + 'with the fields it could see at the time.',
    action: null,
  }),
  'findings': Object.freeze({
    lead: 'No findings yet.',
    sub: 'A finding is only accepted if the agent quotes the manuscript and the '
       + 'quote verifies against the source.',
    action: null,
  }),
  'findings.refusedOnly': Object.freeze({
    lead: 'No findings yet.',
    sub: 'A finding is only accepted if the agent quotes the manuscript and the '
       + 'quote verifies against the source.',
    // The absence is the story. Do not hide the link behind a zero state.
    action: Object.freeze({ id: 'findings.showRefused', label: 'refused — see ledger' }),
  }),
  'integrity.clean': Object.freeze({
    lead: 'Nothing was removed from this manuscript.',
    sub: 'The page and the agent received the same text.',
    action: null,
  }),
});

/**
 * 05 sec 8.3. Refusals are NOT errors and never appear here. System errors are
 * never written to the ledger either — the actor domain is closed at
 * agent|human and a page fault has neither (02 sec 5.4, 05 sec 8.3).
 */
export const ERROR_COPY = Object.freeze({
  STORAGE_UNAVAILABLE: Object.freeze({
    lead: "This browser isn't saving session state.",
    sub: 'Everything still works — your review resets when you close the tab.',
    dismissible: true,
    severity: 'notice',
  }),
  STORAGE_QUOTA_EXCEEDED: Object.freeze({
    lead: "This browser isn't saving session state.",
    sub: 'Storage is full, so the session is being held in memory only. '
       + 'Everything still works — your review resets when you close the tab.',
    dismissible: true,
    severity: 'notice',
  }),
  STATE_DISCARDED_CORRUPT: Object.freeze({
    lead: 'A saved session was unreadable and has been reset to the seed.',
    sub: 'The stored session could not be parsed. Nothing was recovered from it.',
    dismissible: true,
    severity: 'notice',
    details: true,
  }),
  STATE_DISCARDED_VERSION: Object.freeze({
    lead: 'A saved session from an older version was found and reset to the seed.',
    sub: 'Session state carries a version fence and is never migrated.',
    dismissible: true,
    severity: 'notice',
    details: true,
  }),
  STATE_DISCARDED_SEED_CHANGED: Object.freeze({
    lead: 'The manuscripts changed, so the saved session was reset to the seed.',
    sub: 'Saved scores pointed at text that no longer exists.',
    dismissible: true,
    severity: 'notice',
    details: true,
  }),
  STATE_DISCARDED_SCHEMA: Object.freeze({
    lead: 'A saved session did not match the expected shape and was reset to the seed.',
    sub: 'Partial recovery is never attempted — a half-restored session produces '
       + 'a ranking nobody can explain.',
    dismissible: true,
    severity: 'notice',
    details: true,
  }),
  REGION_RENDER_FAILED: Object.freeze({
    lead: 'This panel failed to render.',
    sub: 'The rest of the page is unaffected.',
    dismissible: false,
    severity: 'error',
    actions: Object.freeze([
      Object.freeze({ id: 'region.reload', label: 'Reload panel' }),
      Object.freeze({ id: 'region.copyDiagnostics', label: 'Copy diagnostics' }),
    ]),
  }),
  UNCAUGHT: Object.freeze({
    lead: 'Something went wrong on this page.',
    sub: 'The error was logged to the console. Reset returns the demo to its seed.',
    dismissible: true,
    severity: 'error',
  }),
});

/* -------------------------------------------------------------------------- */
/* 4. The WebMCP-absent surface — the judge without the flag                   */
/* -------------------------------------------------------------------------- */

/**
 * chrome:// URLs cannot be linked or opened by script, so the flag path is a
 * copy button, not a link (05 sec 8.4).
 */
export const WEBMCP_FLAG_URL = 'chrome://flags/#enable-webmcp-testing';
export const COPIED_LABEL_MS = 1600;

/**
 * The app remains fully usable with no agent side: read all twelve, unblind,
 * add off-paper notes, retune the rubric, watch the slate re-rank, open the
 * integrity split-screen, commit a recommendation. Nothing is disabled and
 * nothing is greyed. This is not an error palette — it is a browser without
 * a flag.
 */
export const WEBMCP_COPY = Object.freeze({
  probing: Object.freeze({ pill: 'WEBMCP', count: null, tone: 'neutral', band: null }),
  registering: Object.freeze({ pill: 'REGISTERING', count: 'n/total', tone: 'caution', band: null }),
  live: Object.freeze({ pill: 'WEBMCP LIVE', count: 'n/total', tone: 'accept', band: null }),
  partial: Object.freeze({
    pill: 'WEBMCP PARTIAL',
    count: 'n/total',
    tone: 'refuse',
    band: null,
    disclosure: 'Lists each tool that failed to register and its rejection message. '
              + 'Do not silently degrade to unavailable, and do not claim live.',
  }),
  unavailable: Object.freeze({
    pill: 'WEBMCP UNAVAILABLE',
    count: null,
    tone: 'neutral',
    band: Object.freeze({
      lead: "This browser isn't exposing WebMCP, so the agent side is inactive.",
      sub: "Open in the ChatGPT desktop app's browser, or Chrome 149+ with "
         + 'chrome://flags/#enable-webmcp-testing enabled.',
      // Exactly one control. Replay Mode is cut; do not add a second button.
      action: Object.freeze({
        id: 'webmcp.copyFlagUrl',
        label: 'Copy flag URL',
        value: WEBMCP_FLAG_URL,
        confirmLabel: 'Copied',
        confirmMs: COPIED_LABEL_MS,
      }),
      tone: 'neutral',
    }),
  }),
});

/** What the human still has with no agent present. Rendered in the band's
 *  disclosure, and the honest answer to "what am I missing?". */
export const WEBMCP_ABSENT_STILL_AVAILABLE = Object.freeze([
  'Read all twelve manuscripts',
  'Unblind an author identity, with a recorded reason',
  'Add off-paper evidence the agent never sees',
  'Retune the rubric weights and watch the slate re-rank',
  'Open the integrity split-screen',
  'Commit the recommendation',
]);

export const WEBMCP_ABSENT_MISSING = Object.freeze([
  'The agent cannot call the seven tools, so no agent rows reach the ledger',
  'The refusal beats — a blocked unblind and a blocked recommendation — need an agent to attempt them',
]);

/* -------------------------------------------------------------------------- */
/* 5. Boot                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 05 sec 8.2: the corpus is a static ES module, so first paint should beat a
 * frame and a spinner would be a lie. The page is LOADED long before the tools
 * are LIVE; these are two machines and the UI says both.
 */
export const BOOT_STATES = Object.freeze(['booting', 'ready', 'failed']);

export const BOOT_TRANSITIONS = Object.freeze({
  booting: Object.freeze(['ready', 'failed']),
  ready: Object.freeze(['ready']),
  failed: Object.freeze(['booting']),
});

/**
 * Skeletons are delayed and only render if boot has genuinely not completed.
 * Returns a canceller.
 */
export function scheduleSkeleton(onShow, options) {
  const opts = options || {};
  const delay = opts.delayMs === undefined ? SKELETON_DELAY_MS : opts.delayMs;
  const setTimer = opts.setTimer || ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer || ((h) => clearTimeout(h));
  let fired = false;
  const handle = setTimer(() => { fired = true; onShow(); }, delay);
  return function cancel() {
    clearTimer(handle);
    return { fired };
  };
}

/** One frozen export so a consumer can enumerate every state this app has. */
export const STATE_SETS = Object.freeze({
  webmcpPhases: WEBMCP_PHASES,
  webmcpAttrValues: WEBMCP_ATTR_VALUES,
  regionStates: REGION_STATES,
  bootStates: BOOT_STATES,
});

/* -------------------------------------------------------------------------- */
/* 6. Notices — the one storage-adjacent concern that is genuinely UI-owned    */
/* -------------------------------------------------------------------------- */

/**
 * `src/core/state.js` owns localStorage outright: detection, the load ladder,
 * quota, reset. It hands the UI a notice CODE and nothing else. Two things are
 * left over that core cannot own, and neither is persistence:
 *
 *   1. Resolving a code to reader-facing copy (ERROR_COPY, above).
 *   2. Remembering that the reviewer dismissed the band.
 *
 * Dismissal is deliberately NOT persisted. `referee.state.v1` is locked to
 * seven keys (02 sec 5.1) and `state.notice` is explicitly UI-only and not
 * persisted (02 sec 5.4). A dismissal that outlived the tab would also be a
 * dismissal of a warning the next session may still need.
 */

/**
 * Resolve a notice code to copy. An unrecognized code — a new one core adds
 * later — still renders a band rather than a blank one. The UI must never go
 * silent about something that happened just because its vocabulary is behind.
 */
export function copyForNotice(code) {
  if (code && ERROR_COPY[code]) return ERROR_COPY[code];
  return Object.freeze(Object.assign({}, ERROR_COPY.UNCAUGHT, {
    lead: 'The session reported a condition this page does not have wording for.',
    sub: 'Code: ' + String(code || 'unknown') + '. The console has the detail.',
    unrecognized: true,
  }));
}

/**
 * The notice band's queue. Dedupes on code, so a condition core reports twice
 * does not stack two bands, and a dismissed code stays dismissed for the tab.
 */
export function createNoticeQueue(options) {
  const opts = options || {};
  const onChange = typeof opts.onChange === 'function' ? opts.onChange : () => {};
  const entries = new Map();
  const dismissed = new Set();

  function visible() {
    return Array.from(entries.values()).filter((e) => !dismissed.has(e.code));
  }

  return {
    add(code, detail) {
      if (!code) return { ok: false, reason: 'no-code' };
      if (entries.has(code)) return { ok: true, code, changed: false };
      const copy = copyForNotice(code);
      entries.set(code, { code, copy, detail: detail === undefined ? null : detail });
      if (!dismissed.has(code)) onChange(visible());
      return { ok: true, code, changed: true, dismissible: copy.dismissible === true };
    },

    dismiss(code) {
      const entry = entries.get(code);
      if (!entry) return { ok: false, reason: 'unknown-notice', code };
      // A non-dismissible notice stays. The region error plate is the case:
      // hiding it would leave a panel silently broken.
      if (entry.copy.dismissible !== true) return { ok: false, reason: 'not-dismissible', code };
      if (dismissed.has(code)) return { ok: true, code, changed: false };
      dismissed.add(code);
      onChange(visible());
      return { ok: true, code, changed: true };
    },

    has: (code) => entries.has(code),
    isDismissed: (code) => dismissed.has(code),
    visible,
    all: () => Array.from(entries.values()),
  };
}
