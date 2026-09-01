/**
 * src/tools/__fixtures__/harness.js — the test double for the capability object.
 *
 * NOT A TEST FILE. It lives under __fixtures__/ so scripts/run-tests.mjs never descends
 * into it (discovery rule 3) and never tries to run it as a suite.
 *
 * It is hand-built rather than produced by createCapabilities() on purpose: the tool layer
 * must work against the capability SURFACE, not against one particular implementation of it.
 * If a handler ever reached past this object — for a module-scoped import, a global, or the
 * identity store — these tests would fail with a TypeError instead of passing quietly.
 *
 * Note what is NOT on this object, in either the real one or this double: any accessor that
 * could produce author identity. That is what makes the blinding structural.
 */
import { appendLedger, hasRead, deriveFindings, deriveEditorFlags } from '../../core/ledger.js';
import { visibleFieldsFor } from '../../core/visibility.js';
import { BLINDED_FIELD_NAMES } from '../../core/field-paths.js';
import {
  SECTION_IDS, CRITERIA, MANUSCRIPT_IDS, MIN_QUOTE_CHARS, FUZZY_THRESHOLD, DEFAULT_WEIGHTS
} from '../../core/constants.js';

export const ABSTRACT_TEXT =
  'We report a four-generation replication of split-window thermometry across the ' +
  'Zemblan station network, with all raw traces deposited before analysis began.';

export const METHODS_TEXT =
  'No held-out set was used; all hyperparameters were tuned on the reported evaluation ' +
  'split, which we flag as a limitation of this design.';

const FIXTURE_SECTIONS = {
  'MS-101': { abstract: ABSTRACT_TEXT, methods: METHODS_TEXT },
  'MS-102': { abstract: ABSTRACT_TEXT, introduction: 'An introduction section.', methods: METHODS_TEXT }
};

/** A minimal but SHAPE-CORRECT ReviewState: 02 §5.1's seven persisted keys. */
export function makeState(overrides = {}) {
  const scores = {};
  for (const id of MANUSCRIPT_IDS) {
    scores[id] = {};
    for (const c of CRITERIA) {
      scores[id][c] = { value: 7, set_by: 'seed', updated_at: '2026-09-01T00:00:00.000Z' };
    }
  }
  return {
    version: 1,
    seedHash: 'test-seed',
    scores,
    ledger: [],
    rubricWeights: { ...DEFAULT_WEIGHTS },
    unblinded: [],
    committed: null,
    ...overrides
  };
}

/** The one place a "verified" verdict is manufactured, so a test can steer the gate. */
export function verifyOk(method = 'exact') {
  return { ok: true, code: null, method, score: method === 'exact' ? 1 : 0.95,
           normalized_length: 88, char_offset: 12 };
}
export function verifyMiss() {
  return { ok: false, code: 'EVIDENCE_NOT_FOUND', method: null,
           normalized_length: 61, char_offset: null,
           message: 'That quote does not appear in the section you attributed it to.' };
}
export function verifyShort() {
  return { ok: false, code: 'QUOTE_TOO_SHORT', method: null, normalized_length: 22,
           char_offset: null, min_chars: MIN_QUOTE_CHARS,
           message: 'The evidence quote is shorter than the minimum after normalization.' };
}
export function verifyFault() {
  return { ok: false, code: 'INTERNAL', method: null, normalized_length: 0,
           char_offset: null, message: 'The evidence gate is not available.' };
}

/**
 * @param {object} state
 * @param {{verify?:Function, agentText?:Function, sanitize?:Function, overrides?:object}} [opts]
 */
export function makeCaps(state, opts = {}) {
  const caps = {
    // --- corpus, public store only. There is no identity accessor here or anywhere. ------
    getPublicManuscript: (id) => {
      const secs = FIXTURE_SECTIONS[id];
      if (!secs) return null;
      return {
        id,
        title: id === 'MS-101' ? 'A Replication Protocol for Zemblan Split-Window Thermometry'
                               : 'Lattice Sommelier: Learned Vintage Attribution',
        sections: Object.keys(secs).map((sid, i) => ({
          id: sid, label: sid, order: i, text: secs[sid], word_count: secs[sid].split(/\s+/).length
        })),
        word_count: 1180,
        blinded_fields: [...BLINDED_FIELD_NAMES]
      };
    },
    getSectionOrder: (id) => Object.keys(FIXTURE_SECTIONS[id] || {}),
    getSectionText: (id, sid) => (FIXTURE_SECTIONS[id] || {})[sid],

    // --- adversarial layer, reached ONLY through here -----------------------------------
    verifyQuote: opts.verify || (() => verifyOk()),
    getAgentText: opts.agentText || ((id, sid) => (FIXTURE_SECTIONS[id] || {})[sid]),
    sanitizeManuscript: opts.sanitize || ((id) => ({
      id,
      sections: FIXTURE_SECTIONS[id] || {},
      integrity: { injection_attempts: id === 'MS-101' ? 2 : 0,
                   sections_affected: id === 'MS-101' ? ['abstract'] : [],
                   event_ids: id === 'MS-101' ? ['MS-101:abstract:1', 'MS-101:abstract:2'] : [] }
    })),

    // --- ledger and visibility ----------------------------------------------------------
    appendLedger: (entry) => appendLedger(state, entry),
    visibleFieldsFor,
    hasRead: (s, id, section) => hasRead(s, id, section),
    deriveFindings,
    deriveEditorFlags,

    // --- derived state ------------------------------------------------------------------
    deriveRanking: opts.ranking || (() => MANUSCRIPT_IDS.map((id, i) => ({
      manuscript_id: id, title: id, rank: i + 1, composite: 8.7 - i * 0.1,
      per_criterion: {}, spread: 0, flags: [], advisory: [], requires_human_judgment: false
    }))),
    committedFor: (s, id) => (s.committed && s.committed.manuscript_id === id ? s.committed : null),

    // --- frozen vocabulary --------------------------------------------------------------
    SECTION_IDS, CRITERIA, MANUSCRIPT_IDS, BLINDED_FIELD_NAMES,
    MIN_QUOTE_CHARS, FUZZY_THRESHOLD,

    now: () => '2026-09-01T00:00:00.000Z',
    assertNoIdentityKeys: (p) => p,

    ...(opts.overrides || {})
  };
  return caps;
}

/** 04 §3.1's normalizer, standing in for the real one. Injected, never authored in-lane. */
export function fakeNormalize(s) {
  return String(s).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Run one tool by name and parse the JSON string back. Proves D1 on every single call. */
export async function call(defs, name, args) {
  const def = defs.find((d) => d.name === name);
  if (!def) throw new Error(`no tool named ${name}`);
  const raw = await def.execute(args, { signal: new AbortController().signal });
  if (typeof raw !== 'string') throw new Error(`${name} returned ${typeof raw}, not a string`);
  return { raw, payload: JSON.parse(raw) };
}
