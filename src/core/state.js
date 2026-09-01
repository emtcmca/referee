/**
 * src/core/state.js — the session store. 02 §5.
 *
 * ONE localStorage key, `referee.state.v1`, holding EXACTLY SEVEN literal keys:
 *   version, seedHash, scores, ledger, rubricWeights, unblinded, committed
 *
 * Nothing else is written. findings, humanEvidence, editorFlags, integrityEvents and
 * ranking are all DERIVED (02 §1.11) and deliberately absent from storage. The corpus is
 * never written to localStorage either — it is a static module, and a copy in storage
 * would be a second source of truth that could silently diverge from the shipped text the
 * evidence gate verifies against.
 *
 * VERSIONING STANCE: there are NO migrations. STATE_VERSION is a FENCE, not a ladder. An
 * unrecognized version is discarded. If the shape changes, the KEY changes with it
 * (referee.state.v2) so the old key is simply never read again. For a build with no user
 * data of value and a reset button on screen, migration code is pure risk (02 §5.5).
 * This is stated so that nobody writes one.
 *
 * =====================================================================================
 * CORE OWNS PERSISTENCE OUTRIGHT. DEPENDENCY DIRECTION IS ui -> core, NEVER core -> ui.
 * =====================================================================================
 * Detection, load, save, corrupt-recovery, quota handling and reset all live in THIS file.
 * state.js imports NOTHING from src/ui/, and it must never be refactored to sit on top of
 * a UI-layer storage driver, however convenient that looks.
 *
 * The reason is not taste. src/ui/** is ALLOWED to import src/identity/** — that is the
 * whole point of the layering. If core/state.js imported a module from src/ui/, core would
 * transitively reach identity, and it would do so INVISIBLY, because the blinding guard
 * excludes src/ui/ from its walk. The guard would keep passing while the boundary was
 * broken. That is precisely the failure this architecture exists to prevent, and it is the
 * worst kind, because the check that should catch it reports green.
 *
 * PARTIAL RECOVERY IS NOT ATTEMPTED. Half-restoring a malformed blob is how a demo
 * produces a ranking nobody can explain. Discard, reseed, tell the user in a banner.
 */
import {
  STATE_KEY, STATE_VERSION, MANUSCRIPT_IDS, CRITERIA, SCORE_MIN, SCORE_MAX,
  WEIGHT_MIN, WEIGHT_MAX, ACCEPT_SLOTS_MIN, ACCEPT_SLOTS_MAX,
  DEFAULT_WEIGHTS, RECOMMENDATIONS
} from './constants.js';
import { getSeedScores, computeSeedHash } from './corpus-access.js';
import { bindLedger, appendLedger, deriveAll, ledgerSeqIsDense } from './ledger.js';
import { deriveRanking } from './ranking.js';
import { refereeBus, EVENTS } from './bus.js';

const PERSISTED_KEYS = Object.freeze([
  'version', 'seedHash', 'scores', 'ledger', 'rubricWeights', 'unblinded', 'committed'
]);

const NOTICES = Object.freeze({
  CORRUPT:      'STATE_DISCARDED_CORRUPT',
  VERSION:      'STATE_DISCARDED_VERSION',
  SEED_CHANGED: 'STATE_DISCARDED_SEED_CHANGED',
  SCHEMA:       'STATE_DISCARDED_SCHEMA'
});
export { NOTICES, PERSISTED_KEYS };

/** localStorage is absent in Node and can throw in a private window. Never let it kill boot. */
function storage() {
  try {
    return (typeof localStorage !== 'undefined') ? localStorage : null;
  } catch { return null; }
}

let current = null;
let persistTimer = null;
const pendingKeys = new Set();

// ---------------------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------------------

/** Fresh session from the seed corpus. Deterministic apart from the two timestamps. */
export function seedState(notice = null) {
  const seed = getSeedScores();
  const at = new Date().toISOString();

  const scores = {};
  for (const id of MANUSCRIPT_IDS) {
    scores[id] = {};
    for (const c of CRITERIA) {
      // A missing seed pair is a corruption condition, not a default (02 §1.6). Falling
      // back to 0 here would produce a plausible-looking ranking built on absent data.
      const v = seed?.[id]?.[c];
      if (!Number.isInteger(v)) {
        throw new Error(`seedState: seed score missing or non-integer for ${id}.${c}`);
      }
      scores[id][c] = { value: v, set_by: 'seed', updated_at: at };
    }
  }

  const state = {
    version: STATE_VERSION,
    seedHash: computeSeedHash(),
    scores,
    ledger: [],
    rubricWeights: { ...DEFAULT_WEIGHTS },
    unblinded: [],
    committed: null
  };

  // 02 §5.4: a discard opens the new session's ledger with a session_reset row carrying the
  // reason in `note`. `actor` stays inside the locked two-value enum; the reason never
  // becomes a third actor.
  bindLedger(state, persist);
  appendLedger(state, {
    actor: 'human',
    action: 'session_reset',
    manuscript_id: null,
    args_digest: notice ? { reason: notice } : {},
    outcome: 'accepted',
    code: null,
    note: notice ? `state discarded: ${notice}` : 'session started'
  });

  return state;
}

// ---------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------

/**
 * Hand-written type check, no schema library (02 §5.4). Returns null when valid, or a
 * short reason string. It asserts the SEVEN KEYS AND NO OTHERS — an extra top-level key is
 * a different build's state and is not adopted.
 */
export function validatePersisted(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return 'not an object';

  const keys = Object.keys(p).sort();
  const want = [...PERSISTED_KEYS].sort();
  if (keys.length !== want.length || keys.some((k, i) => k !== want[i])) {
    return `key set is ${keys.join(',')}, expected ${want.join(',')}`;
  }

  // scores: all 12 manuscripts x all 4 criteria, each value an integer in range.
  if (!p.scores || typeof p.scores !== 'object') return 'scores not an object';
  for (const id of MANUSCRIPT_IDS) {
    const row = p.scores[id];
    if (!row || typeof row !== 'object') return `scores.${id} missing`;
    for (const c of CRITERIA) {
      const cell = row[c];
      if (!cell || typeof cell !== 'object') return `scores.${id}.${c} missing`;
      if (!Number.isInteger(cell.value) || cell.value < SCORE_MIN || cell.value > SCORE_MAX) {
        return `scores.${id}.${c}.value out of range`;
      }
      // set_by is 'seed' | 'human'. NEVER 'agent' — no tool writes a score (02 §1.6).
      if (cell.set_by !== 'seed' && cell.set_by !== 'human') {
        return `scores.${id}.${c}.set_by is ${cell.set_by}; only 'seed' and 'human' write scores`;
      }
    }
  }

  if (!ledgerSeqIsDense(p.ledger)) return 'ledger seq not dense and 1-based';
  for (const e of p.ledger) {
    if (e.actor !== 'agent' && e.actor !== 'human') return `ledger seq ${e.seq}: bad actor`;
    if (e.outcome !== 'accepted' && e.outcome !== 'refused') {
      return `ledger seq ${e.seq}: outcome is ${e.outcome}; 'ok' is dead`;
    }
  }

  // rubricWeights: exactly the 4 criterion ids PLUS acceptSlots, and nothing else.
  const w = p.rubricWeights;
  if (!w || typeof w !== 'object') return 'rubricWeights not an object';
  const wKeys = Object.keys(w).sort();
  const wWant = [...CRITERIA, 'acceptSlots'].sort();
  if (wKeys.length !== wWant.length || wKeys.some((k, i) => k !== wWant[i])) {
    return `rubricWeights keys are ${wKeys.join(',')}, expected ${wWant.join(',')}`;
  }
  for (const c of CRITERIA) {
    if (!Number.isInteger(w[c]) || w[c] < WEIGHT_MIN || w[c] > WEIGHT_MAX) {
      return `rubricWeights.${c} out of range`;
    }
  }
  if (!Number.isInteger(w.acceptSlots) ||
      w.acceptSlots < ACCEPT_SLOTS_MIN || w.acceptSlots > ACCEPT_SLOTS_MAX) {
    return 'rubricWeights.acceptSlots out of range';
  }

  // unblinded: {id, reason, at} RECORDS, not ids (02 §5.1).
  if (!Array.isArray(p.unblinded)) return 'unblinded not an array';
  for (const u of p.unblinded) {
    if (!u || !MANUSCRIPT_IDS.includes(u.id)) return 'unblinded carries an unknown manuscript id';
    if (typeof u.reason !== 'string' || u.reason.trim() === '') {
      return 'unblinded record has no reason';
    }
  }

  // committed: SINGULAR nullable object, one commitment per session (02 CONTESTED 1).
  if (p.committed !== null) {
    const c = p.committed;
    if (!c || typeof c !== 'object') return 'committed not null and not an object';
    if (!MANUSCRIPT_IDS.includes(c.manuscript_id)) return 'committed.manuscript_id unknown';
    if (!RECOMMENDATIONS.includes(c.recommendation)) {
      return `committed.recommendation "${c.recommendation}" is not in the enum ` +
             `(the plural spellings are dead)`;
    }
    if (c.by !== 'human') return 'committed.by must be human — the final call is human-only';
  }

  return null;
}

// ---------------------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------------------

/**
 * 02 §5.4's ladder, first hit wins:
 *   1 key absent            -> seed, silent (first visit)
 *   2 JSON.parse throws     -> discard, notice CORRUPT
 *   3 version mismatch      -> discard, notice VERSION
 *   4 seedHash mismatch     -> discard, notice SEED_CHANGED
 *   5 validatePersisted     -> discard, notice SCHEMA
 *   6 otherwise             -> adopt
 *
 * THE WHOLE LADDER SITS INSIDE THE TRY BLOCK, deliberately. A throw from JSON.parse is
 * only the expected failure; a getter that throws, a frozen prototype, a storage read that
 * faults mid-ladder must all land on the same recovery path. A try that wraps only the
 * parse leaves every later step able to take the page down with an uncaught error, and a
 * blank page is a worse failure than a reseeded session.
 *
 * `state.notice` is UI-only and is NOT persisted.
 */
export function loadState() {
  let notice = null;
  let state = null;

  try {
    const store = storage();
    const raw = store ? store.getItem(STATE_KEY) : null;

    if (raw === null || raw === undefined) {
      state = seedState();                                    // 1 — silent first visit
    } else {
      const parsed = JSON.parse(raw);                         // 2 — may throw
      if (parsed?.version !== STATE_VERSION) {
        notice = NOTICES.VERSION;                             // 3
      } else if (parsed.seedHash !== computeSeedHash()) {
        // 4 — the corpus moved under the saved scores. Keeping them would mean scores
        // pointing at text that no longer exists and a ledger referencing character
        // offsets into a different string.
        notice = NOTICES.SEED_CHANGED;
      } else {
        const reason = validatePersisted(parsed);             // 5
        if (reason) notice = NOTICES.SCHEMA;
      }

      if (notice) {
        state = seedState(notice);
      } else {
        state = adopt(parsed);                                // 6
        bindLedger(state, persist);
      }
    }
  } catch {
    // Any fault anywhere in the ladder lands here. Discard and reseed; never leave the
    // page without a state object.
    notice = notice ?? NOTICES.CORRUPT;
    try {
      state = seedState(notice);
    } catch {
      // seedState itself failed (a corrupt seed table). There is no honest fallback that
      // still produces a ranking, so fail loudly rather than render numbers nobody can
      // explain.
      throw new Error('loadState: state is unrecoverable and the seed corpus is also invalid');
    }
  }

  state.notice = notice;                                      // UI-only, never persisted
  current = state;
  rebuildDerived(state);
  if (notice) persist(state, 'reset');
  refereeBus.emit(EVENTS.STATE_LOADED, { state, notice, fresh: state.ledger.length <= 1 });
  return state;
}

/** Takes only the seven keys off the parsed blob. An eighth key cannot survive this. */
function adopt(parsed) {
  const state = {};
  for (const k of PERSISTED_KEYS) state[k] = parsed[k];
  return state;
}

// ---------------------------------------------------------------------------------------
// Persist
// ---------------------------------------------------------------------------------------

/** Exactly the seven keys. Derived state is not serializable here even by accident. */
export function serializeState(state) {
  const out = {};
  for (const k of PERSISTED_KEYS) out[k] = state[k];
  return JSON.stringify(out);
}

/**
 * THE ONLY WRITER (02 §5.3). No tool handler calls persist or touches localStorage; a
 * handler returns a result and hands a partial row to appendLedger, and the state layer
 * persists. One writer, one place to audit.
 *
 * Debounced 250 ms with a beforeunload flush, so a burst of tool calls is one write.
 */
export function persist(state = current, reason = 'unspecified', keys = keysForReason(reason)) {
  if (!state) return;
  // Coalesce the keys of every write in the debounce window, so a burst of mixed
  // mutations settles into ONE state:changed naming everything that actually moved.
  for (const k of keys) pendingKeys.add(k);
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => flush(state, reason), 250);
  if (persistTimer && typeof persistTimer.unref === 'function') persistTimer.unref();
}

/**
 * Which of the seven persisted keys a given mutation reason touches (02 §5.3's table).
 * A reason that names no specific mutation — a bare flush, a beforeunload — returns [] so
 * it contributes nothing to the union rather than over-reporting all seven as changed.
 */
export function keysForReason(reason) {
  switch (reason) {
    case 'ledger_append':          return ['ledger'];
    case 'set_weights':            return ['rubricWeights', 'ledger'];
    case 'set_score':              return ['scores', 'ledger'];
    case 'unblind':                return ['unblinded', 'ledger'];
    case 'commit_recommendation':  return ['committed', 'ledger'];
    case 'reset':                  return [...PERSISTED_KEYS];
    default:                       return [];
  }
}

/** Sorted into PERSISTED_KEYS order, so the payload is deterministic across call paths. */
function orderKeys(set) {
  return PERSISTED_KEYS.filter((k) => set.has(k));
}

export function flush(state = current, reason = 'flush', keys = null) {
  if (!state) return;
  clearTimeout(persistTimer);
  persistTimer = null;
  // Union what the debounce window buffered with what THIS reason touches. A caller may
  // flush directly without having gone through persist(), and a buffered key from an
  // earlier mutation is still genuinely unwritten, so both belong in the payload.
  const union = new Set([...pendingKeys, ...keysForReason(reason)]);
  const changed = keys ?? (union.size ? orderKeys(union) : [...PERSISTED_KEYS]);
  pendingKeys.clear();

  const store = storage();
  if (!store) {
    // Node, or a browser with storage disabled. The session still runs in memory, and the
    // change still happened, so consumers must still hear about it.
    refereeBus.emit(EVENTS.STATE_CHANGED, { state, keys: changed, reason });
    return;
  }
  try {
    store.setItem(STATE_KEY, serializeState(state));
    refereeBus.emit(EVENTS.STATE_CHANGED, { state, keys: changed, reason });
  } catch (error) {
    // Quota or private mode. Keep running in memory and SAY SO — a silent failure here
    // means the user believes a review was saved that was not.
    refereeBus.emit(EVENTS.STATE_PERSIST_FAILED, { error, reason });
  }
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('beforeunload', () => flush(current, 'beforeunload'));
}

// ---------------------------------------------------------------------------------------
// Derived rebuild, accessors, reset
// ---------------------------------------------------------------------------------------

/**
 * 02 §1.11. Rebuilt on every load and after every mutation. Nothing here is persisted and
 * nothing is incrementally patched.
 * @param {object} state
 * @param {{integrityEvents?: Array}} [deps] passed through to ranking (02 §1.10: integrity
 *        events are derived in memory by 04's sanitizer and have no state key).
 */
export function rebuildDerived(state = current, deps = {}) {
  if (!state) return null;
  const { findings, editorFlags, humanEvidence } = deriveAll(state);
  state.findings = findings;
  state.editorFlags = editorFlags;
  state.humanEvidence = humanEvidence;
  state.integrityEvents = deps.integrityEvents ?? state.integrityEvents ?? [];
  state.ranking = deriveRanking(state, { integrityEvents: state.integrityEvents });
  refereeBus.emit(EVENTS.RANKING_CHANGED, {
    ranking: state.ranking, weights: state.rubricWeights
  });
  return state;
}

export function getState() {
  return current;
}

/** 03 §0.8. `committed` is SINGULAR — one commitment per session, locking it until reset. */
export function committedFor(state, id) {
  return state.committed && state.committed.manuscript_id === id ? state.committed : null;
}

/**
 * 02 §5.6. Restores the seed exactly — same scores, same ranking, same flags, same seedHash.
 * A judge who breaks the demo must be able to hand it back in one click. No page reload is
 * required, and a reload is equivalent.
 *
 * @param {{resetAdversarialCaches?: () => void}} [deps] 04's memo caches, so integrity
 *        events re-derive. Injected: core does not import the adversarial layer.
 */
export function resetSession(deps = {}) {
  const store = storage();
  try { store?.removeItem(STATE_KEY); } catch { /* storage unavailable; memory reset still valid */ }
  if (typeof deps.resetAdversarialCaches === 'function') deps.resetAdversarialCaches();

  const state = seedState();
  state.notice = null;
  current = state;
  rebuildDerived(state, { integrityEvents: [] });
  flush(state, 'reset', [...PERSISTED_KEYS]);
  refereeBus.emit(EVENTS.STATE_RESET, { state });
  return state;
}

/** TEST ONLY. Drops the module-level reference without touching storage. */
export function __setStateForTests(state) {
  current = state;
  bindLedger(state, persist);
  return state;
}
