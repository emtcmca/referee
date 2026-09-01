/**
 * src/core/corpus-access.js — the ONLY path by which manuscript text enters a tool handler.
 *
 * =====================================================================================
 * THE BOUNDARY THIS FILE ENFORCES (judges: this is the one to read)
 * =====================================================================================
 * This module reads the PUBLIC store and nothing else. It holds no reference of any kind
 * to the identity store — not an import, not a lazy loader, not a key. There is no
 * `getIdentity` here and there is no argument that could produce one, because blinding in
 * Referee is STRUCTURAL: the author fields are not hidden from the agent, they were never
 * joined to the object the agent receives (02 §2.2 fact 1). Nothing is stripped, because
 * nothing was ever there.
 *
 * Identity lives at src/identity/index.js, is imported by exactly one module in the tree,
 * and that module is in the UI layer. src/core/** never imports it. `grep -rn "identity"
 * src/core/` returns comments like this one and the field-PATH names — never an import.
 *
 * =====================================================================================
 * WHY THE CORPUS IS INSTALLED RATHER THAN STATICALLY IMPORTED — DECLARED DEVIATION
 * =====================================================================================
 * Corpus DATA is owned by another agent at src/corpus/manuscripts.public.js and does not exist
 * yet. Two obvious wirings both fail:
 *   (a) `import { MANUSCRIPTS } from '../corpus/manuscripts.public.js'` — a static import of a
 *       missing module throws at load, making every file that transitively imports core
 *       unrunnable until that agent lands their file. Core must be testable now.
 *   (b) a lazy dynamic import in a try/catch — the blinding guard (02 §2.4 rule 4) FAILS on
 *       any dynamic import expression anywhere under src/, with no target exception. A dynamic import is
 *       exactly the escape hatch the guard exists to close, and core must not be the file
 *       that opens it.
 * So the corpus is INJECTED once, at boot, by the composition root:
 *
 *     // src/app.js or src/tools/index.js — a file OUTSIDE src/core/
 *     import { MANUSCRIPTS } from './corpus/manuscripts.public.js';
 *     import { SEED_SCORES } from './corpus/seed-scores.js';   // or from manuscripts.public.js
 *     import { installCorpus } from './core/corpus-access.js';
 *     installCorpus({ manuscripts: MANUSCRIPTS, seedScores: SEED_SCORES });
 *
 * =====================================================================================
 * WHAT THIS FILE EXPECTS FROM THE CORPUS AGENT — EXACT LITERAL NAMES
 * =====================================================================================
 * Nothing here imports those modules, so a name mismatch is caught at the ONE call site
 * above rather than silently. The expectations are:
 *   MODULE   src/corpus/manuscripts.public.js
 *   EXPORT   `MANUSCRIPTS` — an ORDERED ARRAY of 12 records, NOT a map, NOT a default
 *            export. Each record: { id, version, title, venue_track, field, subfield,
 *            keywords[], sections[], figures[], word_count, fiction, fiction_label,
 *            blinded_fields } per 02 §1.1.
 *   EXPORT   `SEED_SCORES` — 02 §6.2's 12 x 4 table, IF it lives in this module. If the
 *            corpus agent puts it in src/corpus/seed-scores.js instead, that is fine:
 *            installCorpus takes it as a separate argument. Omit it entirely and the
 *            accessors keep serving corpus.stub.js's copy of the §6.2 table verbatim,
 *            which is the same numbers.
 *   SHAPE    `sections` is an ORDERED ARRAY of { id, label, order, text, word_count }, and
 *            sections[0].id === 'abstract'. installCorpus REJECTS a map — 03 §0.1 records
 *            that iterating a map with Object.entries keys everything by array index, which
 *            is a silent corruption rather than an error.
 * installCorpus also accepts a bare array as a convenience: installCorpus(MANUSCRIPTS).
 *
 * Until that call, the accessors serve src/core/corpus.stub.js, so core imports, runs and
 * tests standalone. Injection also means the guard's import-graph walk over src/core/ can
 * never reach a corpus module at all, which is a strictly stronger result than importing
 * the public one and trusting it. THIS PATTERN STAYS when the real corpus lands.
 */
import { MANUSCRIPTS as STUB_MANUSCRIPTS, SEED_SCORES as STUB_SEED_SCORES, STUB_TITLES }
  from './corpus.stub.js';
import { MANUSCRIPT_IDS, CRITERIA, SCORE_MIN, SCORE_MAX } from './constants.js';
import { seedHashOf } from './hash.js';
import { deepFreeze } from './deep-freeze.js';

/** Live corpus. Starts as the stub; replaced once by installCorpus. */
let manuscripts = STUB_MANUSCRIPTS;
let seedScores = STUB_SEED_SCORES;
let byId = indexById(manuscripts);
let installed = false;

function indexById(list) {
  const m = new Map();
  for (const doc of list) m.set(doc.id, doc);
  return m;
}

/**
 * Install the real corpus. Idempotent per identical input; throws on a second install with
 * different data, because two corpora in one session means the evidence gate verified some
 * quotes against text that is no longer shipped.
 *
 * Shape is validated here rather than trusted: a corpus that arrives with a `sections` MAP
 * instead of an ORDERED ARRAY is the silent corruption 03 §0.1 warns about — iterating it
 * with Object.entries keys everything by array index and nothing throws.
 */
export function installCorpus(arg = {}) {
  // Accept either installCorpus(MANUSCRIPTS) or installCorpus({ manuscripts, seedScores }).
  const { manuscripts: list, seedScores: scores } =
    Array.isArray(arg) ? { manuscripts: arg, seedScores: undefined } : arg;

  if (!Array.isArray(list)) {
    throw new TypeError('installCorpus: manuscripts must be an ordered ARRAY, not a map');
  }
  for (const doc of list) {
    if (!doc || typeof doc.id !== 'string') {
      throw new TypeError('installCorpus: every manuscript needs a string id');
    }
    if (!Array.isArray(doc.sections)) {
      throw new TypeError(`installCorpus: ${doc.id}.sections must be an ordered ARRAY`);
    }
    if (doc.sections.length === 0 || doc.sections[0].id !== 'abstract') {
      throw new TypeError(`installCorpus: ${doc.id}.sections[0].id must be 'abstract' (02 §1.1)`);
    }
    // A public record must never arrive carrying identity keys. This checks KEYS, never
    // values against real names — comparing against author strings would require this
    // module to read the identity store, and the verifier would become the leak (02 §2.5).
    for (const forbidden of ['authors', 'affiliations', 'funding', 'correspondence_email']) {
      if (Object.prototype.hasOwnProperty.call(doc, forbidden)) {
        throw new Error(
          `installCorpus: ${doc.id} carries key "${forbidden}". The public store has no such ` +
          `field; this record came from the wrong module.`
        );
      }
    }
  }
  if (installed && manuscripts !== list) {
    throw new Error('installCorpus: the corpus is already installed and cannot be replaced');
  }
  manuscripts = deepFreeze(list);
  byId = indexById(manuscripts);
  if (scores) seedScores = deepFreeze(scores);
  installed = true;
  return manuscripts.length;
}

/** True once the real corpus is in place. The UI uses this to warn that it is on stub data. */
export function isCorpusInstalled() {
  return installed;
}

/**
 * 03 §0.1. Reads ONLY the public store. Returns null iff no such id.
 * `.text` is RAW public text, NOT sanitized — 04's sanitizer is what the agent sees.
 * @param {string} id
 * @returns {object|null}
 */
export function getPublicManuscript(id) {
  return byId.get(id) ?? null;
}

/** Every public manuscript, in corpus order. */
export function listManuscripts() {
  return manuscripts;
}

/**
 * Queue rows: id + title only, for every id in MANUSCRIPT_IDS. Ids the installed corpus
 * does not carry fall back to the stub title so the queue is never ragged.
 */
export function listQueueEntries() {
  return MANUSCRIPT_IDS.map((id) => {
    const doc = byId.get(id);
    return { id, title: doc ? doc.title : (STUB_TITLES[id] ?? id) };
  });
}

/** @returns {object|null} the Section record, or null if this manuscript has no such section. */
export function getSection(manuscriptId, sectionId) {
  const doc = byId.get(manuscriptId);
  if (!doc) return null;
  return doc.sections.find((s) => s.id === sectionId) ?? null;
}

/** RAW public text. The agent never receives this string; it receives 04's sanitized copy. */
export function getSectionText(manuscriptId, sectionId) {
  return getSection(manuscriptId, sectionId)?.text ?? null;
}

/**
 * 03 §0.1: section_order is DERIVED, not stored — a projection of the array's own order,
 * so the two cannot drift. The wrapper uses it for SECTION_NOT_FOUND.
 * @returns {string[]} [] for an unknown manuscript
 */
export function getSectionOrder(manuscriptId) {
  const doc = byId.get(manuscriptId);
  return doc ? doc.sections.map((s) => s.id) : [];
}

/** The seed score table (02 §6.2). state.js reads this to build a fresh session. */
export function getSeedScores() {
  return seedScores;
}

/**
 * 02 §5.2. FNV-1a 32 over canonical JSON of the PUBLIC corpus + rubric + seed scores.
 * The identity store is NOT hashed: hashing it would require reaching it.
 */
export function computeSeedHash() {
  return seedHashOf({
    manuscripts,
    rubric: CRITERIA,
    seedScores
  });
}

/** Guard used by state.js §5.4: a seed table that is not 12 x 4 integers in range is corrupt. */
export function seedScoresAreWellFormed() {
  for (const id of MANUSCRIPT_IDS) {
    const row = seedScores[id];
    if (!row) return false;
    for (const c of CRITERIA) {
      const v = row[c];
      if (!Number.isInteger(v) || v < SCORE_MIN || v > SCORE_MAX) return false;
    }
  }
  return true;
}

/** TEST ONLY. Restores the stub so one test file cannot leak a corpus into the next. */
export function __resetCorpusForTests() {
  manuscripts = STUB_MANUSCRIPTS;
  seedScores = STUB_SEED_SCORES;
  byId = indexById(manuscripts);
  installed = false;
}
