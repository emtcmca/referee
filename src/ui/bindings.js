/**
 * src/ui/bindings.js — the state-to-DOM binding contract.
 *
 * THIS FILE IS THE HANDOFF ARTIFACT TO WHICHEVER DESIGN WINS.
 * Three visual directions are in flight. All three must satisfy the same
 * manifest and none of them may change it. Read `BINDING_POINTS` first: each
 * row names a selector the design must provide, the state it renders, and the
 * bus event that re-renders it. If your markup carries every selector marked
 * `required`, the behavior layer works unchanged.
 *
 * SELECTOR CONTRACT — three rules, enforced by `isLegalSelector` and by a test
 * ----------------------------------------------------------------------------
 *   1. Bind by `[data-*]` attribute, or by one of the stable ids the UI spec
 *      already names (05 sec 9.1: desk-body, ledger-log, slate-list, and the
 *      three dialog ids).
 *   2. NEVER bind by class name. A class is a design decision and all three
 *      directions will spell it differently.
 *   3. NEVER bind by DOM position (`:nth-child`, `>`, `+`, `~`). Position is
 *      layout, and layout is exactly what is being decided separately.
 *
 * A design direction may nest, reorder, wrap, or restyle anything it likes.
 * It may not rename a data attribute or drop a required one.
 *
 * ============================================================================
 * ASSUMED SEAM WITH LANE CORE
 * ----------------------------------------------------------------------------
 * import { refereeBus } from '../core/bus.js';   // INJECTED, not imported
 *   assumed surface: bus.on(name, handler) -> unsubscribe fn
 *   assumed event names, all six (05 sec 7.1):
 *     'webmcp:changed' | 'tool:invoked' | 'tool:settled' | 'human:action'
 *     | 'state:changed' | 'integrity:detected'
 *   assumed 'state:changed' payload: {keys:[...]} — dirty keys, so regions
 *   re-render selectively. Nothing ever re-renders the whole app: a blanket
 *   re-render clobbers ledger scroll position and any in-flight FLIP.
 *   Dirty keys are assumed to be SessionState key names (02 sec 1.11):
 *     version | seedHash | scores | ledger | rubricWeights | unblinded
 *     | committed | findings | humanEvidence | editorFlags | integrityEvents
 *     | ranking
 * import { getState } from '../core/state.js';   // INJECTED as a getter
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Selector legality                                                          */
/* -------------------------------------------------------------------------- */

/** The six ids the UI spec names directly. Nothing else may be bound by id. */
export const STABLE_IDS = Object.freeze([
  'desk-body', 'ledger-log', 'slate-list', 'dlg-unblind', 'dlg-offpaper', 'dlg-commit',
  'unblind-reason',
]);

const DATA_ATTR_SELECTOR = /^\[data-[a-z0-9-]+(=("|')[^"']*\2)?\]$/;
const ID_SELECTOR = /^#[a-z][a-z0-9-]*$/;

/**
 * True only for a selector that satisfies the contract above.
 * Rejects class selectors, positional combinators, and tag selectors.
 */
export function isLegalSelector(selector) {
  if (typeof selector !== 'string' || selector.length === 0) return false;
  if (DATA_ATTR_SELECTOR.test(selector)) return true;
  if (ID_SELECTOR.test(selector)) {
    return STABLE_IDS.indexOf(selector.slice(1)) !== -1;
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/* The manifest                                                               */
/* -------------------------------------------------------------------------- */

/**
 * kind:
 *   'region'  — an independently rendered panel; owns its own error plate
 *   'node'    — a single element whose content or attributes are written
 *   'list'    — a container the renderer fills with rows
 *   'live'    — an aria-live announcement channel, content written to announce
 *   'root'    — the document element, written as an attribute
 *   'control' — an element whose behavior (not content) this layer wires
 *
 * required: false means the design may omit it and the behavior degrades
 * cleanly rather than throwing.
 */
export const BINDING_POINTS = Object.freeze([
  /* ---- boot / environment ------------------------------------------------ */
  Object.freeze({
    id: 'webmcp.root',
    selector: ':root',
    kind: 'root',
    required: true,
    renders: 'documentElement.dataset.webmcp — connecting | active | absent',
    events: ['webmcp:changed'],
    notes: 'Default with no attribute set must render as absent. A page that '
         + 'defaults to the live pane claims an agent it does not have, for one '
         + 'frame, on camera.',
  }),
  Object.freeze({
    id: 'webmcp.pill',
    selector: '[data-bind="webmcp-pill"]',
    kind: 'node',
    required: true,
    renders: 'phase + registered/total (05 sec 7.2, five phases)',
    events: ['webmcp:changed'],
    notes: 'The pill never skips ahead. `registering` is held a minimum 500ms.',
  }),
  Object.freeze({
    id: 'webmcp.band',
    selector: '[data-bind="webmcp-band"]',
    kind: 'region',
    required: true,
    renders: 'the WebMCP-absent band: one line of copy and one copy button',
    events: ['webmcp:changed'],
    notes: 'Authored VISIBLE in the base state. `[data-webmcp="active"]` hides '
         + 'it. Exactly one control — Replay Mode is cut, do not add a second.',
  }),
  Object.freeze({
    id: 'webmcp.copyFlag',
    selector: '[data-action="copy-flag-url"]',
    kind: 'control',
    required: true,
    renders: 'label swap to Copied for 1600ms',
    events: [],
    notes: 'chrome:// URLs cannot be linked or opened by script. Copy, never navigate.',
  }),
  Object.freeze({
    id: 'webmcp.failures',
    selector: '[data-bind="webmcp-failures"]',
    kind: 'list',
    required: false,
    renders: 'per-tool registration failures on the partial phase',
    events: ['webmcp:changed'],
    notes: 'Do not silently degrade partial to unavailable, and do not claim live.',
  }),

  /* ---- agent activity ---------------------------------------------------- */
  Object.freeze({
    id: 'agent.pulse',
    selector: '[data-bind="agent-pulse"]',
    kind: 'node',
    required: true,
    renders: 'pulse snapshot: state, label, tool, outcome, code, stillRunning',
    events: ['tool:invoked', 'tool:settled', 'webmcp:changed'],
    notes: 'The sweep never fakes completion. Refusal is held 900ms, success 700ms.',
  }),
  Object.freeze({
    id: 'ledger.log',
    selector: '#ledger-log',
    kind: 'list',
    required: true,
    renders: 'state.ledger, append-only, in seq order',
    events: ['tool:settled', 'human:action', 'state:changed'],
    stateKeys: ['ledger'],
    aria: { role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions', tabindex: '0' },
    notes: 'Appends only; never re-render the whole list, it destroys scroll '
         + 'position. Each row carries ONE screen-reader sentence (row.sr) and '
         + 'the visible lines are aria-hidden.',
  }),
  Object.freeze({
    id: 'ledger.empty',
    selector: '[data-bind="ledger-empty"]',
    kind: 'node',
    required: true,
    renders: 'EMPTY_COPY.ledger',
    events: ['state:changed'],
    stateKeys: ['ledger'],
  }),
  Object.freeze({
    id: 'ledger.copy',
    selector: '[data-action="copy-ledger"]',
    kind: 'control',
    required: true,
    renders: 'AC-24 text export; label swaps per COPY_FEEDBACK',
    events: [],
    notes: 'Must report the manual-select fallback honestly rather than showing Copied.',
  }),
  Object.freeze({
    id: 'ledger.filter',
    selector: '[data-action="filter-ledger"]',
    kind: 'control',
    required: false,
    renders: 'value is a filter token: all | agent | human | refused',
    events: [],
    notes: 'A filtered EXPORT must announce that it is filtered.',
  }),

  /* ---- findings ---------------------------------------------------------- */
  Object.freeze({
    id: 'findings.list',
    selector: '[data-bind="findings-list"]',
    kind: 'list',
    required: true,
    renders: 'state.findings (derived from the ledger)',
    events: ['tool:settled', 'human:action', 'state:changed'],
    stateKeys: ['findings', 'humanEvidence', 'ledger'],
    notes: 'A REFUSED claim never appears here. Its absence IS the enforcement.',
  }),
  Object.freeze({
    id: 'findings.refusedCount',
    selector: '[data-bind="findings-refused-count"]',
    kind: 'node',
    required: true,
    renders: 'refusal count + the link that filters the ledger to Refused',
    events: ['tool:settled'],
    notes: 'Shown even at zero accepted findings — do not hide it behind a zero state.',
  }),
  Object.freeze({
    id: 'findings.empty',
    selector: '[data-bind="findings-empty"]',
    kind: 'node',
    required: true,
    renders: 'EMPTY_COPY.findings or EMPTY_COPY["findings.refusedOnly"]',
    events: ['state:changed'],
    stateKeys: ['findings'],
  }),
  Object.freeze({
    id: 'findings.addOffPaper',
    selector: '[data-action="add-off-paper-note"]',
    kind: 'control',
    required: true,
    renders: 'opens #dlg-offpaper',
    events: [],
    notes: 'Human-only. No agent tool call may open this dialog.',
  }),

  /* ---- slate and rubric -------------------------------------------------- */
  Object.freeze({
    id: 'slate.list',
    selector: '#slate-list',
    kind: 'list',
    required: true,
    renders: 'state.ranking',
    events: ['state:changed'],
    stateKeys: ['ranking', 'scores', 'rubricWeights'],
    aria: { 'aria-busy': 'false' },
    notes: 'aria-busy true during a FLIP run, cleared on the last transitionend.',
  }),
  Object.freeze({
    id: 'slate.card',
    selector: '[data-manuscript-id]',
    kind: 'control',
    required: true,
    renders: 'one manuscript; the attribute value is the id',
    events: [],
    notes: 'One tab stop each, plus roving arrow keys and Home/End '
         + '(attachRovingFocus). Twelve cards must not cost twelve tab presses.',
  }),
  Object.freeze({
    id: 'slate.status',
    selector: '[data-bind="slate-status"]',
    kind: 'live',
    required: true,
    renders: 'the CONSEQUENCE of a reorder, not the cause',
    events: ['state:changed'],
    stateKeys: ['ranking'],
    aria: { role: 'status', 'aria-live': 'polite' },
    notes: 'Debounced 500ms after the last input. Never announced per drag frame.',
  }),
  Object.freeze({
    id: 'rubric.weight',
    selector: '[data-criterion]',
    kind: 'control',
    required: true,
    renders: 'state.rubricWeights[criterion]',
    events: ['state:changed'],
    stateKeys: ['rubricWeights'],
    notes: 'Native range input. Do not reimplement its keyboard behavior. '
         + 'aria-valuetext must be set on every change, or a screen reader '
         + 'announces a bare number with no unit. One ledger row per settle.',
  }),
  Object.freeze({
    id: 'rubric.acceptSlots',
    selector: '[data-bind="accept-slots"]',
    kind: 'control',
    required: true,
    renders: 'state.rubricWeights.acceptSlots (integer 1..11)',
    events: ['state:changed'],
    stateKeys: ['rubricWeights'],
  }),

  /* ---- desk -------------------------------------------------------------- */
  Object.freeze({
    id: 'desk.body',
    selector: '#desk-body',
    kind: 'region',
    required: true,
    renders: 'the selected manuscript',
    events: ['state:changed', 'tool:settled'],
    stateKeys: ['unblinded', 'committed', 'scores'],
    aria: { tabindex: '0' },
    notes: 'A keyboard-only user must be able to scroll this without a pointer. '
         + 'Selection is UI-local state, not a SessionState key — the selection '
         + 'handler calls renderOne directly rather than routing through a bus '
         + 'event, so a score change never re-renders the scroll region.',
  }),
  Object.freeze({
    id: 'desk.empty',
    selector: '[data-bind="desk-empty"]',
    kind: 'node',
    required: true,
    renders: 'EMPTY_COPY.desk when no manuscript is selected',
    events: [],
    notes: 'Driven by selection, which is UI-local. Rendered via renderOne.',
  }),
  Object.freeze({
    id: 'identity.block',
    selector: '[data-bind="identity-block"]',
    kind: 'node',
    required: true,
    renders: 'blinded vs revealed identity for the selected manuscript',
    events: ['human:action', 'state:changed'],
    stateKeys: ['unblinded'],
    notes: 'This block is its own confirmation. No toast.',
  }),
  Object.freeze({
    id: 'identity.pendingRequest',
    selector: '[data-bind="unblind-request-chip"]',
    kind: 'node',
    required: true,
    renders: 'the chip that appears when the AGENT was refused HUMAN_ONLY',
    events: ['tool:settled'],
    notes: 'A tool call may only ever cause a CHIP to appear. No agent action '
         + 'opens a dialog. Ever.',
  }),
  Object.freeze({
    id: 'unblind.announcement',
    selector: '[data-bind="unblind-announcement"]',
    kind: 'live',
    required: true,
    renders: 'the unblind confirmation',
    events: ['human:action'],
    aria: { 'aria-live': 'assertive' },
    notes: 'ASSERTIVE 1 of exactly 2 in the whole app.',
  }),

  /* ---- verdict ----------------------------------------------------------- */
  Object.freeze({
    id: 'verdict.bar',
    selector: '[data-bind="verdict-bar"]',
    kind: 'region',
    required: true,
    renders: 'state.committed (null | Commitment)',
    events: ['state:changed', 'tool:settled'],
    stateKeys: ['committed'],
    notes: 'recommendation enum is SINGULAR: accept | minor_revision | '
         + 'major_revision | reject.',
  }),
  Object.freeze({
    id: 'verdict.blockedNotice',
    selector: '[data-bind="verdict-blocked"]',
    kind: 'live',
    required: true,
    renders: 'the line shown when the agent tried to commit and was refused',
    events: ['tool:settled'],
    aria: { 'aria-live': 'assertive' },
    notes: 'ASSERTIVE 2 of exactly 2. If a third assertive region appears in '
         + 'the build, one of them is wrong.',
  }),
  Object.freeze({
    id: 'verdict.blockedChip',
    selector: '[data-bind="verdict-blocked-chip"]',
    kind: 'node',
    required: true,
    renders: 'persistent "N blocked attempts" chip; click filters the ledger',
    events: ['tool:settled'],
  }),

  /* ---- integrity --------------------------------------------------------- */
  Object.freeze({
    id: 'integrity.view',
    selector: '[data-bind="integrity-view"]',
    kind: 'region',
    required: false,
    renders: 'state.integrityEvents for the selected manuscript',
    events: ['integrity:detected', 'state:changed'],
    stateKeys: ['integrityEvents'],
  }),

  /* ---- global chrome ----------------------------------------------------- */
  Object.freeze({
    id: 'notice.band',
    selector: '[data-bind="notice-band"]',
    kind: 'region',
    required: true,
    renders: 'states.copyForNotice(code) — the code comes from core/state.js',
    events: [],
    notes: 'System errors go here and to the console. They are NEVER written to '
         + 'the ledger: the actor domain is closed at agent|human and a page '
         + 'fault has neither.',
  }),
  Object.freeze({
    id: 'app.reset',
    selector: '[data-action="reset-session"]',
    kind: 'control',
    required: true,
    renders: 'resets to the seed in one click',
    events: [],
  }),
]);

/** id -> entry, for O(1) lookup and for the audit report. */
export const BINDING_INDEX = Object.freeze(
  BINDING_POINTS.reduce((acc, entry) => { acc[entry.id] = entry; return acc; }, {}),
);

/** Every bus event any binding point listens to. Proven against the bus
 *  vocabulary by a test, so a renamed event fails here rather than in the demo. */
export const SUBSCRIBED_EVENTS = Object.freeze(
  Array.from(new Set(BINDING_POINTS.flatMap((b) => b.events || []))).sort(),
);

/** Human-readable manifest, for the design handoff. Plain text, no markup. */
export function describeManifest() {
  const lines = [
    'REFEREE — UI BINDING MANIFEST',
    'Satisfy every row marked REQUIRED and the behavior layer works unchanged.',
    'Bind by data-* attribute or a stable id. Never by class name or DOM position.',
    '',
  ];
  for (const b of BINDING_POINTS) {
    lines.push((b.required ? 'REQUIRED  ' : 'optional  ') + b.id);
    lines.push('  selector  ' + b.selector);
    lines.push('  kind      ' + b.kind);
    lines.push('  renders   ' + b.renders);
    lines.push('  events    ' + ((b.events || []).join(', ') || 'none'));
    if (b.stateKeys) lines.push('  stateKeys ' + b.stateKeys.join(', '));
    if (b.aria) lines.push('  aria      ' + JSON.stringify(b.aria));
    if (b.notes) lines.push('  notes     ' + b.notes);
    lines.push('');
  }
  return lines.join('\n');
}

/* -------------------------------------------------------------------------- */
/* DOM helpers                                                                */
/* -------------------------------------------------------------------------- */

function resolve(root, selector) {
  if (!root) return null;
  if (selector === ':root') {
    const doc = root.ownerDocument || root;
    return doc.documentElement || null;
  }
  if (typeof root.querySelector !== 'function') return null;
  return root.querySelector(selector);
}

function resolveAll(root, selector) {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  return Array.from(root.querySelectorAll(selector));
}

/**
 * Apply the aria contract programmatically so it cannot be lost when a design
 * is swapped. Never overwrites an attribute the design already set.
 */
export function ensureAria(el, attrs) {
  if (!el || !attrs || typeof el.setAttribute !== 'function') return;
  for (const [name, value] of Object.entries(attrs)) {
    if (typeof el.hasAttribute === 'function' && el.hasAttribute(name)) continue;
    el.setAttribute(name, value);
  }
}

/**
 * Roving arrow-key navigation over a list (05 sec 9.1: slate cards get up/down
 * and Home/End so twelve cards do not cost twelve tab presses). Returns a
 * detach function.
 */
export function attachRovingFocus(container, itemSelector, options) {
  const opts = options || {};
  if (!container || typeof container.addEventListener !== 'function') return () => {};
  const keys = opts.orientation === 'horizontal'
    ? { prev: 'ArrowLeft', next: 'ArrowRight' }
    : { prev: 'ArrowUp', next: 'ArrowDown' };

  function onKeyDown(event) {
    const items = resolveAll(container, itemSelector);
    if (!items.length) return;
    const active = (container.ownerDocument || {}).activeElement;
    const index = items.indexOf(active);
    let target = -1;
    if (event.key === keys.next) target = index < 0 ? 0 : Math.min(index + 1, items.length - 1);
    else if (event.key === keys.prev) target = index < 0 ? 0 : Math.max(index - 1, 0);
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = items.length - 1;
    else return;
    event.preventDefault();
    const el = items[target];
    if (el && typeof el.focus === 'function') el.focus();
    if (typeof opts.onMove === 'function') opts.onMove(el, target);
  }

  container.addEventListener('keydown', onKeyDown);
  return () => container.removeEventListener('keydown', onKeyDown);
}

/* -------------------------------------------------------------------------- */
/* The binder                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The design layer registers one render function per binding id. The binder
 * owns resolution, aria, event routing, dirty-key filtering, and per-region
 * error containment. A renderer receives `(element, context)` and returns
 * nothing; if it throws, only its own region goes to the error state.
 *
 * @param {object}   options
 * @param {Element}  options.root
 * @param {object}   [options.bus]        refereeBus (injected)
 * @param {function} [options.getState]
 * @param {function} [options.onRegionError] (id, error) -> void
 */
export function createBinder(options) {
  const opts = options || {};
  const root = opts.root;
  const bus = opts.bus;
  const getState = typeof opts.getState === 'function' ? opts.getState : () => null;
  const onRegionError = typeof opts.onRegionError === 'function' ? opts.onRegionError : () => {};

  const renderers = new Map();
  const elements = new Map();
  const unsubscribers = [];
  let mounted = false;

  function elementFor(id) {
    if (elements.has(id)) return elements.get(id);
    const entry = BINDING_INDEX[id];
    if (!entry) return null;
    const el = resolve(root, entry.selector);
    elements.set(id, el);
    return el;
  }

  function renderOne(id, detail) {
    const entry = BINDING_INDEX[id];
    if (!entry) return { ok: false, reason: 'unknown-binding', id };
    const renderer = renderers.get(id);
    if (!renderer) return { ok: false, reason: 'no-renderer', id };
    const el = elementFor(id);
    if (!el) {
      return { ok: false, reason: entry.required ? 'missing-required-element' : 'absent', id };
    }
    try {
      renderer(el, { state: getState(), detail: detail || null, binding: entry });
      return { ok: true, id };
    } catch (err) {
      // 05 sec 8.3: the error plate is scoped to this region only. The other
      // regions keep working. A judge must never see a blank app.
      if (typeof console !== 'undefined' && console.error) console.error(err);
      onRegionError(id, err);
      return { ok: false, reason: 'render-threw', id, error: err };
    }
  }

  function renderMany(ids, detail) {
    return ids.map((id) => renderOne(id, detail));
  }

  function idsForEvent(eventName, payload) {
    const dirty = payload && Array.isArray(payload.keys) ? payload.keys : null;
    return BINDING_POINTS.filter((b) => {
      if ((b.events || []).indexOf(eventName) === -1) return false;
      // state:changed carries dirty keys so regions re-render selectively.
      // A listener that declares no stateKeys is a manifest defect, and the
      // safe reading of it is "renders nothing" — a blanket re-render would
      // clobber ledger scroll position and any in-flight FLIP.
      if (eventName === 'state:changed' && dirty) {
        if (!b.stateKeys) return false;
        return b.stateKeys.some((k) => dirty.indexOf(k) !== -1);
      }
      return true;
    }).map((b) => b.id);
  }

  return {
    /** @param {string} id @param {function} renderFn */
    register(id, renderFn) {
      if (!BINDING_INDEX[id]) return { ok: false, reason: 'unknown-binding', id };
      if (typeof renderFn !== 'function') return { ok: false, reason: 'not-a-function', id };
      renderers.set(id, renderFn);
      return { ok: true, id };
    },

    /** Resolve every selector against the live DOM and report the gaps. This
     *  is the check the design lane runs to prove its markup satisfies the
     *  contract. */
    audit(against) {
      const scope = against || root;
      const present = [];
      const missingRequired = [];
      const missingOptional = [];
      const illegalSelectors = [];
      for (const b of BINDING_POINTS) {
        if (!isLegalSelector(b.selector) && b.selector !== ':root') {
          illegalSelectors.push(b.id);
        }
        const el = resolve(scope, b.selector);
        if (el) present.push(b.id);
        else if (b.required) missingRequired.push(b.id);
        else missingOptional.push(b.id);
      }
      return {
        ok: missingRequired.length === 0 && illegalSelectors.length === 0,
        present,
        missingRequired,
        missingOptional,
        illegalSelectors,
        total: BINDING_POINTS.length,
      };
    },

    /** Apply the aria contract, then subscribe. Idempotent. */
    mount() {
      if (mounted) return { ok: true, alreadyMounted: true };
      mounted = true;
      for (const b of BINDING_POINTS) {
        const el = elementFor(b.id);
        if (el && b.aria) ensureAria(el, b.aria);
      }
      if (bus && typeof bus.on === 'function') {
        for (const eventName of SUBSCRIBED_EVENTS) {
          unsubscribers.push(bus.on(eventName, (payload) => {
            renderMany(idsForEvent(eventName, payload), payload);
          }));
        }
      }
      return { ok: true, subscribed: unsubscribers.length, audit: this.audit() };
    },

    unmount() {
      while (unsubscribers.length) {
        const off = unsubscribers.pop();
        if (typeof off === 'function') off();
      }
      elements.clear();
      mounted = false;
    },

    /** Drop cached element lookups — call after the design swaps markup. */
    invalidate() { elements.clear(); },

    renderOne,
    renderAll(detail) {
      return renderMany(BINDING_POINTS.map((b) => b.id), detail);
    },
    elementFor,
    get manifest() { return BINDING_POINTS; },
  };
}
