/**
 * src/sanitize/normalize.js — canonical text normalization for Referee (04 §3.1).
 *
 * =====================================================================================
 * ONE DEFINITION, SHARED BY THE SANITIZER AND THE VERIFIER. NEVER FORK THIS FUNCTION.
 * =====================================================================================
 * The sanitizer decides what text is a payload; the verifier decides whether a quote is
 * really in the text the agent received. If those two ran different normalizers, a payload
 * could be neutralized under one ruler and quotable under the other — the seam in 04 §5
 * holds only because a quote and a payload are judged by the SAME ruler.
 *
 * It lives in src/sanitize/ because this lane owns the file. The verify lane imports it
 * from here (re-exported by ./index.js) rather than declaring a second copy.
 *
 * ORDERING IS LOAD-BEARING: strip invisibles -> NFKC -> fold typography -> lowercase ->
 * collapse whitespace. Pattern matching runs on the OUTPUT, which is why "I<ZWSP>gnore"
 * in fixture FX-1 cannot hide from F1. (F4 is the one family that must run on RAW text,
 * because normalization deletes exactly the characters F4 looks for — see ./index.js.)
 */

// Format characters that carry no width: strip outright. Soft hyphen must go
// (co<SHY>operate -> cooperate); zero-width joiners are the classic way to split
// a trigger word past a substring scan; bidi overrides can reverse rendered text.
const STRIP = /[\u00AD\u200B\u200C\u200D\u200E\u200F\u2060-\u2064\u202A-\u202E\u2066-\u2069\uFEFF]/g;

// Separators NFKC does NOT fold to a space. Replace with a space, never remove:
// removing U+2028 would weld two words together.
const SPACEY = /[\u2028\u2029\u0009\u000B\u000C]/g;

// NFKC leaves curly quotes and dashes alone, so map them by hand. Every class below is
// written with \uXXXX escapes on purpose: a literal zero-width or curly character does not
// survive a copy-paste through a chat window or an editor that strips format characters,
// and it would fail SILENTLY (04 section 2).
const SQUOTE = /[\u2018\u2019\u201A\u201B\u2032\u00B4`]/g;
const DQUOTE = /[\u201C\u201D\u201E\u201F\u2033\u00AB\u00BB]/g;
const DASH   = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]/g;

/**
 * NFKC + typographic folding + case folding + whitespace collapse.
 * NFKC is what handles ligatures (identi<fi> -> identifi), non-breaking space,
 * en-quad and friends, and the ellipsis character.
 * @param {*} input
 * @returns {string} normalized text; '' for any non-string
 */
export function normalizeText(input) {
  if (typeof input !== 'string' || input.length === 0) return '';
  let t = input.replace(STRIP, '').replace(SPACEY, ' ');
  t = t.normalize('NFKC');
  t = t.replace(SQUOTE, "'").replace(DQUOTE, '"').replace(DASH, '-');
  t = t.toLowerCase();          // JS has no true casefold; toLowerCase is sufficient
  return t.replace(/\s+/g, ' ').trim();  // for a Latin-script fixture corpus
}

/**
 * Punctuation-insensitive token stream, for fuzzy matching only.
 * Exact matching stays punctuation-sensitive on purpose; the fuzzy path is
 * where "macro-F1" and "macro F1" and "macro-F1," are allowed to converge.
 * @param {string} normalized output of normalizeText
 * @returns {string[]}
 */
export function tokens(normalized) {
  if (!normalized) return [];
  return normalized.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
}

/**
 * Per-character companion to normalizeText, used ONLY to translate a match
 * position in normalized text back to a character offset in the source string
 * (01 AC-8 and 05 §7.4 need to highlight the matched span). It is not a fork:
 * it applies the same five steps in the same order and is asserted equal to
 * normalizeText on every fixture in §7. Matching always uses normalizeText.
 *
 * @param {*} input
 * @returns {{norm:string, map:number[]}} map[i] = index in `input` of the
 *          character that produced norm[i]
 */
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
