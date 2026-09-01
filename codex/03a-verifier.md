# 03a — Normalizer and evidence verifier: the modules (slice C3, part 1 of 2)

**Deliverables:** `src/adversarial/normalize.js` and `src/adversarial/verify.js`, transcribed.
**Then read `03b-verifier-tests.md`** for the substrate and the 14-row table you must re-run. This
slice is not done until both parts are.

Read `00-START-HERE.md` first. Read nothing else.

**Transcription, not design.** Both modules have been written and executed. Never adjust the code to
make a table true. **Do this work order before `02a-sanitizer.md`** — the sanitizer imports
`normalizeText` from here.

**Normalization is SEVEN steps, in this execution order:** `strip-format-characters`,
`separators-to-space`, `NFKC`, `straighten-quotes`, `straighten-dashes`, `casefold`,
`collapse-whitespace`. **The four-step list "NFKC, whitespace, curly-quote, case folding" is dead
vocabulary.** It omits the format-character strip, which is the only reason a zero-width-split trigger
word is caught by the injection detector at all, and it omits the separator fold. Build to four steps
and the fixtures stop being detected.

`MIN_QUOTE_CHARS` (40) and `FUZZY_THRESHOLD` (0.92) are **imported from `src/core/constants.js`**,
never re-declared, so a threshold change is one edit rather than two.

---

## 1. `src/adversarial/normalize.js`

Shared by the sanitizer and the verifier, so a quote and a payload are judged by the same ruler.
**One definition, no per-caller variants. Never fork it.**

```js
// src/adversarial/normalize.js
// Canonical text normalization for Referee. Used by BOTH the sanitizer's pattern matching and
// the evidence verifier. Never fork this function.

// Format characters that carry no width: strip outright. Soft hyphen must go; zero-width
// joiners are the classic way to split a trigger word past a substring scan; bidi overrides
// can reverse rendered text.
const STRIP = /[\u00AD\u200B\u200C\u200D\u200E\u200F\u2060-\u2064\u202A-\u202E\u2066-\u2069\uFEFF]/g;

// Separators NFKC does NOT fold to a space. Replace with a space, never remove: removing
// U+2028 would weld two words together.
const SPACEY = /[\u2028\u2029\u0009\u000B\u000C]/g;

// NFKC leaves curly quotes and dashes alone, so map them by hand.
const SQUOTE = /[\u2018\u2019\u201A\u201B\u2032\u00B4`]/g;
const DQUOTE = /[\u201C\u201D\u201E\u201F\u2033\u00AB\u00BB]/g;
const DASH   = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]/g;

/** NFKC + typographic folding + case folding + whitespace collapse. '' for any non-string.
 *  NFKC handles ligatures, non-breaking space, en-quad and friends, and the ellipsis char. */
export function normalizeText(input) {
  if (typeof input !== 'string' || input.length === 0) return '';
  let t = input.replace(STRIP, '').replace(SPACEY, ' ');
  t = t.normalize('NFKC');
  t = t.replace(SQUOTE, "'").replace(DQUOTE, '"').replace(DASH, '-');
  t = t.toLowerCase();          // JS has no true casefold; toLowerCase is sufficient
  return t.replace(/\s+/g, ' ').trim();  // for a Latin-script fixture corpus
}

/** Punctuation-insensitive token stream, for fuzzy matching ONLY. Exact matching stays
 *  punctuation-sensitive on purpose; the fuzzy path is where "macro-F1" and "macro F1" and
 *  "macro-F1," are allowed to converge. Input is the output of normalizeText. */
export function tokens(normalized) {
  if (!normalized) return [];
  return normalized.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
}

/** Per-character companion to normalizeText, used ONLY to translate a match position in
 *  normalized text back to a character offset in the source string, because the UI has to
 *  highlight the matched span. NOT a fork: same steps, same order, and the harness asserts
 *  normalizeWithMap(x).norm === normalizeText(x) on every fixture. Matching always uses
 *  normalizeText. Returns {norm, map}; map[i] is the index in `input` that produced norm[i]. */
export function normalizeWithMap(input) {
  if (typeof input !== 'string' || input.length === 0) return { norm: '', map: [] };
  let out = '';
  const map = [];
  let pendingSpace = false;
  for (let i = 0; i < input.length; i++) {
    const kept = input[i].replace(STRIP, '');      // replace() ignores lastIndex
    if (kept === '') continue;                     // zero-width / bidi: dropped
    const c = kept.replace(SPACEY, ' ');
    if (/\s/.test(c)) { if (out.length > 0) pendingSpace = true; continue; }
    const piece = c.normalize('NFKC')
      .replace(SQUOTE, "'").replace(DQUOTE, '"').replace(DASH, '-')
      .toLowerCase();
    if (pendingSpace) { out += ' '; map.push(i); pendingSpace = false; }
    for (const p of piece) { out += p; map.push(i); }
  }
  return { norm: out, map };
}
```

NFKC is applied per character in `normalizeWithMap`, exact for a Latin-script fixture corpus and that
is the stated limit. Where the map cannot be resolved the verifier returns `char_offset: null`.

---

## 2. `src/adversarial/verify.js`

```js
// src/adversarial/verify.js
import { normalizeText, normalizeWithMap, tokens } from './normalize.js';
import { sanitizeManuscript, REDACTION_RE } from './sanitizer.js';
import { MIN_QUOTE_CHARS, FUZZY_THRESHOLD } from '../core/constants.js';
// MIN_QUOTE_CHARS = 40 post-normalization. FUZZY_THRESHOLD = 0.92 token-subsequence.
// Imported, never re-declared here.

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

/** Best token-subsequence similarity of the quote against any window of the segment, plus the
 *  token index the best window started at (for char_offset).
 *  sim = 2*LCS / (len(quote) + len(window)) -- order-sensitive, length-penalized. */
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

/** Split the agent-visible section at every redaction token, keeping each segment's base offset
 *  so a match can be reported as a character offset. A FRESH RegExp is built because
 *  REDACTION_RE is /g and exec() on a shared /g regex carries lastIndex between calls. */
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

/** The evidence gate. Always returns, never throws; the handler builds its envelope from this.
 *  opts.debug exposes the fuzzy score and is DEV HARNESS ONLY -- never pass it from a handler. */
export function verifyQuote(manuscriptId, sectionId, quote, opts = {}) {
  try {
    const doc = sanitizeManuscript(manuscriptId);
    if (!doc) return { ok: false, code: 'UNKNOWN_MANUSCRIPT', method: null, char_offset: null };
    if (typeof doc.sections[sectionId] !== 'string') {
      return { ok: false, code: 'SECTION_NOT_FOUND', method: null, char_offset: null };
    }

    const q = normalizeText(quote);
    if (q.length < MIN_QUOTE_CHARS) {
      // Derivable entirely from the agent's own argument, so a specific message leaks nothing.
      return {
        ok: false, code: 'QUOTE_TOO_SHORT', method: null, char_offset: null,
        min_chars: MIN_QUOTE_CHARS, normalized_length: q.length,
        message: `evidence_quote must be at least ${MIN_QUOTE_CHARS} characters after normalization; quote a longer span verbatim.`
      };
    }

    // THE SUBSTRATE: the agent-visible text, split at redaction tokens. A quote must match
    // wholly inside ONE segment.
    const clean = doc.sections[sectionId];
    const segments = segmentsOf(clean);

    for (const seg of segments) {
      const n = normalizeText(seg.raw);
      const at = n.indexOf(q);
      if (at !== -1) {
        return { ok: true, code: null, method: 'exact', score: 1,
                 normalized_length: q.length, char_offset: offsetIn(seg, at) };
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
      return { ok: true, code: null, method: 'fuzzy',
               score: Math.round(best * 1000) / 1000,
               normalized_length: q.length, char_offset: offset };
    }

    // One code, one message, NO SCORE. A score on a miss is a hill-climbing gradient toward an
    // accepted fabrication, so the gate does not compute one for a handler to leak.
    const out = {
      ok: false, code: 'EVIDENCE_NOT_FOUND', method: null, char_offset: null,
      normalized_length: q.length,
      message: 'evidence_quote did not verify against the text of that section. Quote the manuscript verbatim.'
    };
    if (opts.debug) out._score = Math.round(best * 1000) / 1000;
    return out;
  } catch (e) {
    return { ok: false, code: 'INTERNAL', method: null, char_offset: null, message: 'verifier fault' };
  }
}
```

**This return shape is canonical.** `verifyQuote` returns `ok`, `code`, `method`, `score`,
`char_offset`, `normalized_length`, `min_chars`, `message`, and **never** `verified`, `similarity`,
`threshold`, `section_exists`, `normalized_quote_length`, or `normalized_quote`. Those are dead field
names. A caller written against them evaluated `!undefined` on every call and refused every finding,
correct ones included — the tool the whole demo is built around, failing closed.

`code` is always in the frozen set `UNKNOWN_MANUSCRIPT`, `SECTION_NOT_FOUND`, `QUOTE_TOO_SHORT`,
`EVIDENCE_NOT_FOUND`, `INTERNAL`. `EVIDENCE_TOO_SHORT` and `UNKNOWN_SECTION` are dead spellings.

`char_offset` is an offset into the **agent-visible (sanitized) section string**, returned on both
accepting paths and `null` whenever it cannot be recovered exactly, never a guess. The normalized
quote is not returned; a caller that needs it calls `normalizeText` itself, which keeps a failure
payload free of anything the agent did not already supply.

---

## Definition of Done (part 1)

**Output paths:** `C:\dev\referee\src\adversarial\normalize.js` and
`C:\dev\referee\src\adversarial\verify.js`. Nothing else.

Before moving to `03b`, observe and state each of these:

- Both modules parse; exports `normalizeText`, `tokens`, `normalizeWithMap`, `verifyQuote` all
  resolve. Report the list you enumerated.
- `Object.keys()` on a real accepting return and on a real `EVIDENCE_NOT_FOUND` return, pasted in,
  showing no `verified`, `similarity`, `threshold`, or `normalized_quote` key.
- A grep of both files for `verified`, `similarity`, `threshold`, `section_exists`,
  `normalized_quote` returns zero hits.
- `MIN_QUOTE_CHARS` and `FUZZY_THRESHOLD` appear only in `verify.js`'s import line and are declared
  nowhere. Paste that line verbatim.
- Report the normalization step order you can read off the function body, confirming the
  format-character strip runs first.
- `normalizeWithMap(x).norm === normalizeText(x)` on five strings covering, between them, a
  zero-width space, a soft hyphen, a curly quote, an em dash, an NBSP, and a ligature. Report them.
- You have not claimed the slice done. `03b` carries the measurements.
