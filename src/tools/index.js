/**
 * src/tools/index.js — the WebMCP registration bootstrap. 03 §6, 00 §D4/§D5.
 *
 * =====================================================================================
 * THE FIVE FACTS FROM 00-api-reality.md THAT SHAPE THIS FILE
 * =====================================================================================
 * 1. `await mc.registerTool(definition, options)` — ASYNC, TWO ARGUMENTS. All seven are
 *    registered inside ONE awaited function against ONE AbortController, in sequence.
 * 2. `execute: async (inputs, context)` returns `JSON.stringify(payload)` — a STRING.
 * 3. Policy refusals are RETURNED, never THROWN.
 * 4. `annotations: {readOnlyHint, untrustedContentHint}` on all seven. If a browser rejects
 *    the key, that tool is retried WITHOUT annotations rather than failing registration.
 * 5. NO `exposedTo`. Referee is single-origin; cross-origin exposure is a security decision
 *    we are not making under deadline.
 *
 * The indicator flips only after the awaited registration resolves (D5): a judge who sees
 * "tools live" must be able to trust it, so a partial registration reports the number that
 * actually registered and never rounds up to seven.
 *
 * =====================================================================================
 * RETURN VALUE — a NUMBER, deliberately
 * =====================================================================================
 * src/main.js (the composition root, another lane's file) does
 * `const count = await tools.registerAll(...)` and prints `${count} agent tools registered`.
 * An object there would render as "[object Object]" in the status band. So registerAll
 * resolves to the count, the full record is available from getLastRegistration(), and the
 * lifecycle is broadcast on the bus, which is where the UI actually listens.
 */
import { defineTool, safeDigest } from './define-tool.js';
import { buildToolSpecs, TOOL_NAMES, ANNOTATION_TABLE } from './specs.js';
import { refereeBus, EVENTS } from '../core/bus.js';
import { getState as coreGetState, loadState as coreLoadState } from '../core/state.js';

export { defineTool, safeDigest };
export { buildToolSpecs, TOOL_NAMES, ANNOTATION_TABLE } from './specs.js';
export { ok, refuse, serialize, CODES, TERMINAL_CODES, summarize } from './envelope.js';
export { validate } from './validate.js';
export { nextAction } from './next-action.js';

// The seven handlers, exported so the WebMCP-absent surface (03 §6.2's "Try the evidence
// gate" form) can call one directly and render the real payload rather than a mock.
export { getReviewStateHandler } from './handlers/get-review-state.js';
export { readManuscriptHandler } from './handlers/read-manuscript.js';
export { assertFindingHandler } from './handlers/assert-finding.js';
export { checkClaimHandler } from './handlers/check-claim.js';
export { requestUnblindHandler } from './handlers/request-unblind.js';
export { flagForEditorHandler } from './handlers/flag-for-editor.js';
export { submitRecommendationHandler } from './handlers/submit-recommendation.js';

/**
 * 00 §D4. `navigator.modelContext` is deprecated as of Chrome 150 in favour of
 * `document.modelContext`. Prefer document; keep the navigator fallback only so an older
 * build still works; render the absent state when neither exists.
 */
export function detectModelContext() {
  const d = globalThis.document?.modelContext ?? null;
  if (d && typeof d.registerTool === 'function') return { present: true, surface: 'document', ctx: d };
  const n = globalThis.navigator?.modelContext ?? null;
  if (n && typeof n.registerTool === 'function') return { present: true, surface: 'navigator', ctx: n };
  return { present: false, surface: null, ctx: null };
}

/**
 * Resolve the live ReviewState accessor. Injected first (tests and the composition root),
 * core's module-level state second, a load third. Wrapped, because the wrapper's D2 catch is
 * what turns a storage fault into INTERNAL and this must not throw at build time instead.
 */
function resolveGetState(options) {
  if (typeof options.getState === 'function') return options.getState;
  if (options.state && Array.isArray(options.state.ledger)) return () => options.state;
  return () => {
    const s = coreGetState();
    if (s && Array.isArray(s.ledger)) return s;
    return coreLoadState();
  };
}

/**
 * Build the seven WebMCP definition objects without registering anything. Exported because
 * the tests drive execute() directly, and because 03 §6.2's absent surface needs the
 * definitions to render the tool list even when no host will ever call them.
 *
 * @param {object} capabilities the frozen capability object (no path to identity)
 * @param {{getState?:Function, state?:object, normalizeText?:Function}} [options]
 */
export function buildToolDefinitions(capabilities, options = {}) {
  if (!capabilities) throw new Error('buildToolDefinitions: capabilities are required');
  const deps = {
    capabilities,
    getState: resolveGetState(options),
    // 04 §3.1's ONE normalizer, injected by the composition root. Absent is survivable and
    // visible (normalized_quote comes back null); a locally-authored second normalizer would
    // be neither. See handlers/assert-finding.js.
    normalizeText: typeof options.normalizeText === 'function' ? options.normalizeText : null
  };
  return buildToolSpecs(capabilities).map((spec) => defineTool(spec, deps));
}

let LAST = { present: false, registered: 0, tools: [], failed: [], surface: null,
              annotationsAccepted: null, already: false };
let REGISTERED_NAMES = [];
let REGISTERED = false;

/** The full record of the last registration attempt. registerAll() resolves to the count. */
export function getLastRegistration() {
  return { ...LAST, tools: [...LAST.tools], failed: [...LAST.failed] };
}

/** TEST ONLY. */
export function __resetRegistrationForTests() {
  REGISTERED = false;
  REGISTERED_NAMES = [];
  LAST = { present: false, registered: 0, tools: [], failed: [], surface: null,
           annotationsAccepted: null, already: false };
}

function emitPhase(phase, extra) {
  // bus.js documents `registered` as the string[] of names registered so far, and the phase
  // vocabulary as probing | absent | registering | ready | failed. That is the built contract
  // the UI lane subscribes to, so it wins over 03 §6.1's numeric/`live`/`partial` shape; the
  // extra fields below are additive and no consumer is required to read them.
  try {
    refereeBus.emit(EVENTS.WEBMCP_CHANGED, {
      phase, registered: [...REGISTERED_NAMES], error: null, ...extra
    });
  } catch (err) {
    console.warn('[referee] webmcp:changed emit failed', err);
  }
}

/**
 * Register all seven tools on the given model context.
 *
 * @param {{registerTool:Function, getTools?:Function, addEventListener?:Function}} mc
 * @param {object} capabilities
 * @param {{signal?:AbortSignal, getState?:Function, state?:object,
 *          normalizeText?:Function}} [options]
 * @returns {Promise<number>} how many tools actually registered
 */
export async function registerAll(mc, capabilities, options = {}) {
  if (REGISTERED) {
    // Report what ACTUALLY registered, not TOOL_NAMES.length. This branch used to return 7
    // unconditionally in 03's draft, so a partial registration reported itself as 7/7 on
    // every subsequent call — and D5 says a judge who sees the indicator must be able to
    // trust it. A number that is right only on the happy path is worse than no number at all.
    LAST = { ...LAST, already: true };
    return REGISTERED_NAMES.length;
  }

  const total = TOOL_NAMES.length;

  // The window between first paint and feature detection resolving is a DESIGNED state: the
  // page is interactive and no tool is callable yet. Emitting it means a renderer never has
  // to infer that state from the ABSENCE of an event, which is not a state it can be driven
  // into or tested for.
  emitPhase('probing', { total, failed: [], surface: null, annotationsAccepted: null });

  const surface = mc ? (globalThis.document?.modelContext === mc ? 'document'
                        : globalThis.navigator?.modelContext === mc ? 'navigator' : 'injected')
                     : null;

  if (!mc || typeof mc.registerTool !== 'function') {
    setDataset('absent', 0);
    LAST = { present: false, registered: 0, tools: [], failed: [], surface: null,
             annotationsAccepted: false, already: false };
    emitPhase('absent', { total, failed: [], surface: null, annotationsAccepted: false });
    return 0;
  }

  const defs = buildToolDefinitions(capabilities, options);

  // One controller for the whole set: abort() unregisters all seven cleanly, which is what
  // makes a development re-register safe. The composition root may pass its own.
  const signal = options.signal ?? new AbortController().signal;

  setDataset('connecting', 0);
  emitPhase('registering', { total, failed: [], surface, annotationsAccepted: null });

  const registered = [];
  const failed = [];
  let annotationsAccepted = true;

  for (const def of defs) {
    try {
      await mc.registerTool(def, { signal });          // no exposedTo: single origin
      registered.push(def.name);
    } catch (err) {
      // 00 §D3 contingency: if a browser rejects the annotations key, DROP ANNOTATIONS for
      // that tool rather than failing registration. Retry once, without them.
      console.warn(`[referee] registerTool failed for ${def.name}; retrying without annotations`, err);
      annotationsAccepted = false;
      try {
        const { annotations, ...bare } = def;           // eslint-disable-line no-unused-vars
        await mc.registerTool(bare, { signal });
        registered.push(def.name);
      } catch (err2) {
        // One tool failing must not take the other six down and must not blank the page.
        console.error(`[referee] registerTool failed permanently for ${def.name}`, err2);
        failed.push({ tool: def.name, message: String((err2 && err2.message) || err2) });
      }
    }
    REGISTERED_NAMES = [...registered];
    emitPhase('registering', { total, failed: [...failed], surface, annotationsAccepted });
  }

  REGISTERED = registered.length > 0;
  REGISTERED_NAMES = [...registered];
  setDataset(REGISTERED ? 'active' : 'absent', registered.length);

  LAST = { present: true, registered: registered.length, tools: [...registered],
           failed: [...failed], surface, annotationsAccepted, already: false };

  // Only NOW does the page claim the tools are live (D5). `ready` is emitted only at 7/7;
  // anything short of that is `failed` carrying the list, never rounded to either extreme.
  emitPhase(registered.length === total ? 'ready' : 'failed',
            { total, failed: [...failed], surface, annotationsAccepted,
              error: failed.length ? `${failed.length} of ${total} tools failed to register` : null });

  // Cheap and useful: reflect host-side tool-list changes. `toolchange` is the host's own
  // event (00 §1) and is re-broadcast on refereeBus rather than given a second DOM name.
  if (typeof mc.addEventListener === 'function') {
    mc.addEventListener('toolchange', async () => {
      try {
        const live = typeof mc.getTools === 'function' ? await mc.getTools() : null;
        emitPhase('ready', { total, failed: [], surface, annotationsAccepted,
                             hostToolCount: Array.isArray(live) ? live.length : null });
      } catch (err) {
        console.warn('[referee] getTools() failed on toolchange', err);
      }
    });
  }

  return registered.length;
}

/** The absent/connecting/active dataset the human surface keys off (03 §6.2). */
function setDataset(value, count) {
  try {
    const root = globalThis.document?.documentElement;
    if (!root || !root.dataset) return;
    root.dataset.webmcp = value;
    root.dataset.webmcpTools = String(count);
  } catch { /* no DOM in Node; the bus event carries the same information */ }
}

export default registerAll;
