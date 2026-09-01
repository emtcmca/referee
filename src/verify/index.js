/**
 * src/verify/index.js — the evidence gate (04 §4, seam 3).
 *
 * `assert_finding` calls `verifyQuote` and refuses on anything but `ok`. This module is
 * the reason a fabricated justification is impossible rather than discouraged: the page
 * does not ask the agent to be honest, it checks.
 *
 * =====================================================================================
 * THE INVARIANT THIS FILE ESTABLISHES (04 §5)
 * =====================================================================================
 *   WHAT THE AGENT MAY CLAIM IS A SUBSET OF WHAT THE AGENT MAY SEE.
 *
 * A quote is verified against the exact text the agent received — the sanitized,
 * agent-visible section — with every redaction token acting as a hard, unmatchable
 * boundary. Three consequences, all deliberate:
 *
 *   1. A legitimate quote in a paragraph next to a redaction still verifies. The
 *      sanitizer removes only the flagged paragraph; every paragraph on either side
 *      survives byte-identically inside its own segment.
 *   2. A neutralized payload is UNQUOTABLE. The string is not in the substrate, so an
 *      agent that was nudged by a payload the detector missed still cannot cite it.
 *   3. A quote SPANNING a redaction is refused, and refused correctly: the agent never
 *      saw those two spans adjacent. It saw a placeholder between them.
 *
 * (3) is the trap worth naming. Excising spans from raw text and matching against the
 * result quietly makes text adjacent-that-was-never-adjacent, so a quote joining the
 * sentence before a payload to the sentence after it would verify. Splitting into
 * segments and refusing cross-segment matches is what prevents that, and it is why the
 * placeholder is a BARRIER rather than a string to be stripped.
 *
 * DO NOT NORMALIZE THE PLACEHOLDER AWAY. `normalizeText` runs on each segment AFTER the
 * split, never before it. The split happens first. It is one line and it carries the
 * whole invariant.
 *
 * =====================================================================================
 * ONE NORMALIZER, IMPORTED — THIS FILE DEFINES NONE (04 §3.1)
 * =====================================================================================
 * `normalizeText`, `normalizeWithMap`, `tokens` and `REDACTION_RE` all come from
 * `src/sanitize/`, which is their single definition. That is not tidiness, it is the
 * correctness of the seam: if the detector matched on one ruler and the verifier judged
 * on another, a quote could verify in a test and refuse in the browser. They are
 * re-exported below so a caller has one import site, NOT redefined.
 *
 * =====================================================================================
 * REFUSALS ARE RESULTS, NOT EXCEPTIONS (04 header, 00 D2)
 * =====================================================================================
 * Nothing here throws across a tool boundary. Chrome documents no error return format,
 * so an exception is not a refusal — it is a lost turn. Every path returns a plain
 * object; the one try/catch converts a genuine runtime fault into
 * `{ ok:false, code:'INTERNAL' }`.
 *
 * =====================================================================================
 * WHAT IS DELIBERATELY NOT RETURNED (04 §6)
 * =====================================================================================
 *   - NO SCORE ON FAILURE. Returning the fuzzy similarity on a miss hands an agent a
 *     hill-climbing gradient toward an accepted fabrication. `opts.debug` exposes it for
 *     the dev harness and a tool handler must NEVER pass it.
 *   - ONE failure code, `EVIDENCE_NOT_FOUND`, with one fixed message, for every mismatch
 *     cause. Distinct codes for "section exists but quote absent" vs "quote is in another
 *     section" would let the agent map hidden structure — the classic differential-error
 *     oracle. `QUOTE_TOO_SHORT` and `SECTION_NOT_FOUND` are safe to distinguish only
 *     because both are derivable from the agent's own arguments plus the section list it
 *     already holds.
 *   - NO NORMALIZED ECHO of the quote. A handler that needs it calls `normalizeText`
 *     itself. That keeps the failure payload free of anything the agent did not supply.
 *
 * `char_offset` IS returned, on both accepting paths, and only there. The asymmetry with
 * `check_claim` (which gets no positional data at all) is deliberate and 04 §6 states it:
 * an offset behind the gate is a citation, because it locates text the agent already
 * supplied and the gate already verified. An offset on an unlimited, free, consequence-
 * free tool is a cursor into the manuscript, and repeated probes make it binary-
 * searchable. Same field, opposite preconditions, opposite answers.
 */

import {
  normalizeText, normalizeWithMap, tokens,
  REDACTION_RE, sanitizeManuscript
} from '../sanitize/index.js';
import { MIN_QUOTE_CHARS, FUZZY_THRESHOLD } from '../core/constants.js';

// One import site for callers. Re-export, never redefine.
export { normalizeText, normalizeWithMap, tokens };
export { MIN_QUOTE_CHARS, FUZZY_THRESHOLD };

// ---------------------------------------------------------------------------------------
// Substrate
// ---------------------------------------------------------------------------------------
//
// The real sanitizer is statically imported, so the gate works the moment this module
// loads — there is no boot step that could be forgotten and no window in which the gate
// is unwired. The seam below exists ONLY so the 04 §7.1 test substrate can be supplied by
// the smoke tests; production never calls it.

let _sanitizeManuscript = sanitizeManuscript;

/** TEST ONLY. Substitute the 04 §7.1 substrate. Never called from a handler or the app. */
export function __setSubstrateForTests(fn) {
  _sanitizeManuscript = typeof fn === 'function' ? fn : sanitizeManuscript;
}

/** TEST ONLY. Restore the real, statically-imported sanitizer. */
export function __resetSubstrateForTests() {
  _sanitizeManuscript = sanitizeManuscript;
}

// ---------------------------------------------------------------------------------------
// Matching primitives
// ---------------------------------------------------------------------------------------

/** Longest common subsequence length over token arrays. Rolling two-row DP. */
function lcsLen(a, b) {
  const n = a.length, m = b.length;
  if (!n || !m) return 0;
  let prev = new Uint16Array(m + 1);
  let cur = new Uint16Array(m + 1);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    const t = prev; prev = cur; cur = t; cur.fill(0);
  }
  return prev[m];
}

/**
 * Best token-subsequence similarity of the quote against any window of the segment, plus
 * the token index the best window started at (for char_offset).
 *
 * sim = 2*LCS / (len(quote) + len(window)) — order-sensitive and length-penalized, so a
 * window that contains the quote's tokens plus a lot of other text does not score well.
 * The anchor prefilter keeps this cheap: only start at a token matching one of the
 * quote's first two tokens, which tolerates one leading edit.
 */
function fuzzyBest(qt, st) {
  const qn = qt.length;
  if (!qn || !st.length) return { score: 0, tokenStart: -1 };
  const widths = [qn - 2, qn - 1, qn, qn + 1, qn + 2].filter((w) => w > 0);
  const anchors = new Set([qt[0], qt[1]].filter(Boolean));
  let best = 0, bestStart = -1;
  for (let i = 0; i < st.length; i++) {
    if (i > 0 && !anchors.has(st[i])) continue;
    for (const w of widths) {
      const win = st.slice(i, i + w);
      if (win.length < Math.max(1, qn - 2)) continue;
      const sim = (2 * lcsLen(qt, win)) / (qn + win.length);
      if (sim > best) { best = sim; bestStart = i; }
      if (best >= FUZZY_THRESHOLD) return { score: best, tokenStart: bestStart };
    }
  }
  return { score: best, tokenStart: bestStart };
}

/**
 * Split the agent-visible section at every redaction token, keeping each segment's base
 * offset in the clean string so a match can be reported back as a character offset the UI
 * can highlight.
 *
 * The pattern is the sanitizer's canonical `REDACTION_RE`, not a local copy — the barrier
 * and the token that creates it must be one definition. A fresh RegExp is built from its
 * source because it is /g and exec() on a shared /g regex carries lastIndex between calls,
 * which would make the second verification of a session silently see different segments
 * than the first.
 */
function segmentsOf(clean) {
  const segs = [];
  const re = new RegExp(REDACTION_RE.source, 'g');
  let last = 0, m;
  while ((m = re.exec(clean)) !== null) {
    segs.push({ raw: clean.slice(last, m.index), base: last });
    last = m.index + m[0].length;
  }
  segs.push({ raw: clean.slice(last), base: last });
  return segs.filter((s) => s.raw.trim().length > 0);
}

/** Normalized index -> offset into the clean section string. null when unrecoverable. */
function offsetIn(seg, normIndex) {
  const nm = normalizeWithMap(seg.raw);
  if (normIndex < 0 || normIndex >= nm.map.length) return null;
  return seg.base + nm.map[normIndex];
}

// ---------------------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------------------

/**
 * The evidence gate.
 *
 * @param {string} manuscriptId
 * @param {string} sectionId
 * @param {string} quote            evidence_quote as the agent supplied it
 * @param {{debug?:boolean}} [opts] debug exposes the fuzzy score; DEV HARNESS ONLY, never
 *                                  set true from a tool handler (04 §6).
 * @returns {{ok:boolean, code:(string|null), method:('exact'|'fuzzy'|null), score?:number,
 *            normalized_length?:number, char_offset:(number|null), min_chars?:number,
 *            message?:string}}
 *          Always returns. Never throws. The handler builds its envelope from this.
 */
export function verifyQuote(manuscriptId, sectionId, quote, opts = {}) {
  try {
    const doc = _sanitizeManuscript(manuscriptId);
    if (!doc) return { ok: false, code: 'UNKNOWN_MANUSCRIPT', method: null, char_offset: null };
    if (typeof doc.sections?.[sectionId] !== 'string') {
      return { ok: false, code: 'SECTION_NOT_FOUND', method: null, char_offset: null };
    }

    const q = normalizeText(quote);
    if (q.length < MIN_QUOTE_CHARS) {
      // Derivable entirely from the agent's own argument, so a specific message here
      // leaks nothing (04 §6). Tell it how to fix the call — CONTESTED §1 notes the floor
      // over-rejects genuinely short evidence, and this message is what converts most of
      // those over-rejections into a retry rather than a dead end.
      return {
        ok: false, code: 'QUOTE_TOO_SHORT', method: null, char_offset: null,
        min_chars: MIN_QUOTE_CHARS, normalized_length: q.length,
        message: `evidence_quote must be at least ${MIN_QUOTE_CHARS} characters after normalization; quote a longer span verbatim.`
      };
    }

    // THE SUBSTRATE: the agent-visible text, split at redaction tokens.
    // A quote must match wholly inside ONE segment (04 §5). Segments are never
    // concatenated for matching.
    const clean = doc.sections[sectionId];
    const segments = segmentsOf(clean);

    for (const seg of segments) {
      const n = normalizeText(seg.raw);
      const at = n.indexOf(q);
      if (at !== -1) {
        return {
          ok: true, code: null, method: 'exact', score: 1,
          normalized_length: q.length, char_offset: offsetIn(seg, at)
        };
      }
    }

    const qt = tokens(q);
    let best = 0, bestSeg = null, bestTok = -1;
    for (const seg of segments) {
      const r = fuzzyBest(qt, tokens(normalizeText(seg.raw)));
      if (r.score > best) { best = r.score; bestSeg = seg; bestTok = r.tokenStart; }
      if (best >= FUZZY_THRESHOLD) break;
    }
    if (best >= FUZZY_THRESHOLD) {
      let offset = null;
      if (bestSeg && bestTok >= 0) {
        const n = normalizeText(bestSeg.raw);
        const first = tokens(n)[bestTok];
        if (first) {
          const at = n.indexOf(first);
          if (at !== -1) offset = offsetIn(bestSeg, at);
        }
      }
      return {
        ok: true, code: null, method: 'fuzzy',
        score: Math.round(best * 1000) / 1000,
        normalized_length: q.length, char_offset: offset
      };
    }

    // One code, one message, no score. 04 §6: no gradient toward a fabricated quote.
    const out = {
      ok: false, code: 'EVIDENCE_NOT_FOUND', method: null, char_offset: null,
      normalized_length: q.length,
      message: 'evidence_quote did not verify against the text of that section. Quote the manuscript verbatim.'
    };
    if (opts.debug) out._score = Math.round(best * 1000) / 1000;
    return out;
  } catch {
    return { ok: false, code: 'INTERNAL', method: null, char_offset: null, message: 'verifier fault' };
  }
}

export default verifyQuote;
