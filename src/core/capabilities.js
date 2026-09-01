/**
 * src/core/capabilities.js — the frozen capability object handed to every tool handler.
 *
 * =====================================================================================
 * THIS FILE IS WHAT MAKES BLINDING STRUCTURAL RATHER THAN CONVENTIONAL.
 * =====================================================================================
 * A tool handler does not get module scope. It gets THIS OBJECT, and this object has no
 * path to identity. Read the export at the bottom: there is no getIdentity, no
 * getManuscriptIdentity, no `authors` accessor, no options bag that could produce one, and
 * no factory argument that widens it. A handler cannot reach identity through its
 * arguments. To reach it at all a handler would have to author a NEW STATIC IMPORT of
 * src/identity/index.js — which is precisely the shape the blinding guard
 * (scripts/check-blinding.mjs, 02 §2.4) walks the import graph to catch, and precisely the
 * shape a human reviewer can see in a diff.
 *
 * That is three independent layers on one boundary:
 *   1. STRUCTURAL — the capability object has no identity edge, and neither does anything
 *      it exposes. corpus-access.js reads the public store and holds no reference of any
 *      kind to the identity store.
 *   2. BUILD-TIME — the import-graph guard fails the build on any path from src/** (except
 *      src/ui/) to the identity module, and on any a dynamic import expression.
 *   3. RUNTIME — assertNoIdentityKeys() deep-walks every tool return in dev and throws on
 *      an identity KEY. It checks keys, NEVER values against identity strings: comparing a
 *      return against real author names would require the tool layer to read the identity
 *      store, and the verifier would become the leak (02 §2.5). That is the sharpest single
 *      point in the architecture and it is worth saying out loud.
 *
 * HONEST STATEMENT OF THE LIMIT, which the write-up must carry: JavaScript has no
 * module-level access control. A determined handler could reach it with a dynamic import expression. The
 * separation is enforced at the seam by a guard and a runtime check — it is not a language
 * guarantee, and claiming otherwise would be the kind of overclaim this project exists to
 * argue against.
 *
 * =====================================================================================
 * WIRING — WHY TWO SLOTS ARE INJECTED
 * =====================================================================================
 * `verifyQuote` (03 §0.2, owned by 04 §4) and `sanitizeManuscript`/`getAgentText`
 * (03 §0.3, owned by 04 §3.3) belong to the adversarial slice and are not written yet.
 * They are INJECTED at boot rather than statically imported, for the same two reasons
 * corpus-access.js gives: a static import of a missing module makes core unloadable, and a
 * dynamic import fails the blinding guard outright.
 *
 * Both slots FAIL CLOSED. Until 04 installs the real functions:
 *   - verifyQuote returns { ok: false, code: 'INTERNAL' } — every assert_finding REFUSES.
 *   - getAgentText returns undefined — read_manuscript has no text to hand over.
 * An unwired evidence gate must never accept. A gate that fails OPEN would let a fabricated
 * quote through on a wiring mistake, which is the exact failure this product is built to
 * make impossible.
 */
import {
  getPublicManuscript, listManuscripts, listQueueEntries,
  getSection, getSectionText, getSectionOrder
} from './corpus-access.js';
import { visibleFieldsFor, visibleFieldsAtTime } from './visibility.js';
import { appendLedger, hasRead, deriveFindings, deriveEditorFlags } from './ledger.js';
import { deriveRanking } from './ranking.js';
import { committedFor } from './state.js';
import { IDENTITY_FIELD_PATHS, BLINDED_FIELD_NAMES } from './field-paths.js';
import {
  SECTION_IDS, CRITERIA, MANUSCRIPT_IDS, MIN_QUOTE_CHARS, FUZZY_THRESHOLD, FICTION_LABEL
} from './constants.js';

// ---------------------------------------------------------------------------------------
// Injected adversarial slots — fail closed until 04 installs the real implementations.
// ---------------------------------------------------------------------------------------

const FAIL_CLOSED_VERIFY = Object.freeze({
  ok: false,
  code: 'INTERNAL',
  method: null,
  normalized_length: 0,
  char_offset: null,
  message: 'The evidence gate is not available. No quote can be verified.'
  // NOTE the absence of `score`. 04 §6: NO SCORE ON FAILURE — returning the fuzzy
  // similarity on a miss hands an agent a hill-climbing gradient toward an accepted
  // fabrication. A handler cannot echo a similarity in a refusal because it is never
  // given one. The failure shape must not leak one either.
});

let _verifyQuote = () => FAIL_CLOSED_VERIFY;
let _sanitizeManuscript = () => undefined;
let _getAgentText = () => undefined;
let _installed = false;

/**
 * Called once at boot by the composition root with 04's real functions.
 * @param {{verifyQuote?: Function, sanitizeManuscript?: Function, getAgentText?: Function}} impl
 * @returns {boolean} true once all three slots are filled
 */
export function installAdversarialLayer(impl = {}) {
  if (typeof impl.verifyQuote === 'function') _verifyQuote = impl.verifyQuote;
  if (typeof impl.sanitizeManuscript === 'function') _sanitizeManuscript = impl.sanitizeManuscript;
  if (typeof impl.getAgentText === 'function') _getAgentText = impl.getAgentText;
  _installed = _verifyQuote !== undefined && _sanitizeManuscript !== undefined &&
               typeof impl.verifyQuote === 'function' && typeof impl.getAgentText === 'function';
  return _installed;
}

/**
 * The UI shows a hard banner when this is false: the evidence gate is failing closed and
 * every assert_finding will refuse. A demo running unwired must look broken, not clean.
 */
export function adversarialLayerInstalled() {
  return _installed;
}

/** TEST ONLY. Returns the slots to their fail-closed defaults. */
export function __resetAdversarialSlotsForTests() {
  _verifyQuote = () => FAIL_CLOSED_VERIFY;
  _sanitizeManuscript = () => undefined;
  _getAgentText = () => undefined;
  _installed = false;
}

// ---------------------------------------------------------------------------------------
// Runtime belt — 02 §2.5
// ---------------------------------------------------------------------------------------

/** Identity KEY names, taken from the path list. Names only; no values are involved. */
const IDENTITY_KEYS = Object.freeze(new Set(
  IDENTITY_FIELD_PATHS.map((p) => p.replace(/^identity\./, '').replace(/\[\]\..*$/, ''))
    .concat(IDENTITY_FIELD_PATHS.map((p) => p.split('.').pop().replace(/\[\]$/, '')))
));

function inDevMode() {
  try {
    if (typeof location === 'undefined') return true;   // Node / tests: always check
    return location.hostname === 'localhost' ||
           location.hostname === '127.0.0.1' ||
           /(?:\?|&)debug=1(?:&|$)/.test(location.search);
  } catch { return true; }
}

/**
 * Deep-walks a tool return and throws on an identity KEY, or on an IntegrityEvent raw
 * excerpt appearing in the serialization.
 *
 * @param {object} payload
 * @param {string[]} [rawExcerpts] IntegrityEvent.raw_excerpt strings, passed in by the
 *        caller. Core does not hold them — they are derived in memory by 04 and never
 *        persisted, which is a stronger guarantee than "handlers must not import them".
 */
export function assertNoIdentityKeys(payload, rawExcerpts = []) {
  if (!inDevMode()) return payload;

  const seen = new Set();
  (function walk(node, path) {
    if (node === null || typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);
    for (const key of Object.keys(node)) {
      if (IDENTITY_KEYS.has(key)) {
        throw new Error(
          `assertNoIdentityKeys: identity key "${key}" reached a tool return at ${path}.${key}`
        );
      }
      walk(node[key], `${path}.${key}`);
    }
  })(payload, '$');

  if (rawExcerpts.length > 0) {
    const json = JSON.stringify(payload);
    for (const excerpt of rawExcerpts) {
      if (excerpt && excerpt.length > 0 && json.includes(excerpt)) {
        throw new Error(
          'assertNoIdentityKeys: an IntegrityEvent raw excerpt reached a tool return. ' +
          'The agent must receive neutralized text and aggregate counts, never the payload.'
        );
      }
    }
  }
  return payload;
}

// ---------------------------------------------------------------------------------------
// The capability object
// ---------------------------------------------------------------------------------------

/** Injected clock, so a handler cannot reach for a nondeterministic global directly. */
const now = () => new Date().toISOString();

/**
 * Build the frozen capability object.
 *
 * `overrides` exists for tests ONLY and is deliberately narrow: it can replace a function
 * with another function of the same name, and it CANNOT ADD A KEY. A test that tries to
 * inject a getIdentity throws here, which keeps the test surface from becoming the hole in
 * the boundary.
 */
export function createCapabilities(overrides = {}) {
  const base = {
    // --- corpus, public store only -------------------------------------------------
    getPublicManuscript,        // 03 §0.1
    listManuscripts,
    listQueueEntries,
    getSection,
    getSectionText,             // RAW public text; the agent gets the sanitized copy
    getSectionOrder,            // derived projection of the section array's own order

    // --- adversarial layer, injected and fail-closed --------------------------------
    verifyQuote: (manuscriptId, sectionId, quote, opts) =>
      _verifyQuote(manuscriptId, sectionId, quote, opts),   // 03 §0.2 / 04 §4
    sanitizeManuscript: (manuscriptId) => _sanitizeManuscript(manuscriptId),  // 03 §0.3
    getAgentText: (manuscriptId, sectionId) => _getAgentText(manuscriptId, sectionId),

    // --- ledger and visibility ------------------------------------------------------
    appendLedger,               // 03 §0.4 — every call, accepted AND refused
    visibleFieldsFor,           // 03 §0.5 — agent branch, cannot widen
    visibleFieldsAtTime,        // 02 §1.9.1 — general form, for human rows
    hasRead,                    // 03 §0.8 — derived, so ordering cannot be faked
    deriveFindings,
    deriveEditorFlags,

    // --- derived state --------------------------------------------------------------
    deriveRanking,              // 03 §0.6 — pure; NO TOOL WRITES A SCORE
    committedFor,               // 03 §0.8 — committed is singular

    // --- frozen vocabulary ----------------------------------------------------------
    SECTION_IDS,
    CRITERIA,
    MANUSCRIPT_IDS,
    BLINDED_FIELD_NAMES,        // a string transform of NAMES; reads no data
    MIN_QUOTE_CHARS,
    FUZZY_THRESHOLD,
    FICTION_LABEL,

    // --- utilities ------------------------------------------------------------------
    now,
    assertNoIdentityKeys
  };

  for (const key of Object.keys(overrides)) {
    if (!Object.prototype.hasOwnProperty.call(base, key)) {
      throw new Error(
        `createCapabilities: "${key}" is not a capability. The capability set is closed — ` +
        `it cannot be widened by an argument, in a test or anywhere else.`
      );
    }
    base[key] = overrides[key];
  }

  // Frozen so a handler cannot bolt an accessor onto the object it was handed and pass it
  // along to the next one.
  return Object.freeze(base);
}

/** The one object the tool layer imports. */
export const CAPABILITIES = createCapabilities();

export default CAPABILITIES;
