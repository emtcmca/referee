/**
 * src/verify/typography.test.mjs — the folds that decide whether the demo survives.
 *
 * 04 §3.1: "Getting this wrong is how the demo dies on camera." Smart quotes, em and en
 * dashes, ligatures, non-breaking spaces, casing and collapsed whitespace are exactly the
 * things that make a LEGITIMATE quote get rejected in front of a judge — the reviewer
 * copies a sentence out of a rendered manuscript, the clipboard hands over a curly
 * apostrophe, and the gate refuses honest evidence.
 *
 * index.test.mjs proves 04 §7.2's rows, but several of those rows vary more than one
 * thing at once (V2 changes quotes AND a dash; V4 changes an NBSP, a ligature AND a
 * newline). This file isolates ONE variable per test, so a regression names its own cause
 * instead of pointing at a row that could have failed four ways.
 *
 * Every codepoint is built numerically with String.fromCodePoint. A literal zero-width
 * space does not survive a copy-paste through a chat window or an editor that strips
 * format characters, and it would fail SILENTLY — the test would still pass while testing
 * nothing (04 §2).
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import {
  verifyQuote, __setSubstrateForTests, __resetSubstrateForTests,
  normalizeText, normalizeWithMap, tokens
} from './index.js';
import { redactionToken } from '../sanitize/index.js';

const cp = (n) => String.fromCodePoint(n);

const NBSP    = cp(0x00A0);  // no-break space
const SHY     = cp(0x00AD);  // soft hyphen
const ZWSP    = cp(0x200B);  // zero-width space
const ZWJ     = cp(0x200D);  // zero-width joiner
const NB_HYPH = cp(0x2011);  // non-breaking hyphen
const EN_DASH = cp(0x2013);
const EM_DASH = cp(0x2014);
const MINUS   = cp(0x2212);  // true minus sign
const LDQUO   = cp(0x201C);
const RDQUO   = cp(0x201D);
const LSQUO   = cp(0x2018);
const RSQUO   = cp(0x2019);
const PRIME   = cp(0x2032);
const FI_LIG  = cp(0xFB01);
const ELLIPS  = cp(0x2026);

// ---------------------------------------------------------------------------------------
// Substrate: a section written the way a typeset manuscript actually arrives — curly
// quotes, a non-breaking hyphen, an em dash, an NBSP, a ligature, an ellipsis character.
// ---------------------------------------------------------------------------------------

const SOURCE =
  `The ablation in Table 2 shows that removing the ${LDQUO}hierarchy prior${RDQUO} costs 4.1 ` +
  `points of macro${NB_HYPH}F1 ${EM_DASH} a drop the authors do not discuss.\n` +
  `${redactionToken(1)}\n` +
  `Coefficients were fit on the held-out split; the confidence${NBSP}interval is wide ` +
  `because the identi${FI_LIG}cation strategy is only validated on 42 items. The authors` +
  `${RSQUO} own appendix says ${ELLIPS} the effect is not robust.`;

const STUB = { id: 'TYPO-01', sections: { results: SOURCE } };

before(() => {
  __setSubstrateForTests((id) => (id === 'TYPO-01' ? STUB : null));
});

const verify = (quote) => verifyQuote('TYPO-01', 'results', quote, { debug: true });

/** Every quote here is legitimate text from the section. Refusing one is the failure. */
function mustVerify(label, quote) {
  const r = verify(quote);
  assert.equal(
    r.ok, true,
    `${label}: a legitimate quote was REFUSED (${r.code}, best score ${r._score}). ` +
    'This is the failure mode that kills the demo on camera.'
  );
  return r;
}

// ---------------------------------------------------------------------------------------
// The four the brief names, each varying exactly one thing
// ---------------------------------------------------------------------------------------

describe('one variable at a time — each of these must still verify', () => {
  const ASCII = 'removing the "hierarchy prior" costs 4.1 points of macro-F1';

  test('ONLY curly quotes differ', () => {
    const curly = ASCII.replace('"hierarchy prior"', `${LDQUO}hierarchy prior${RDQUO}`);
    assert.notEqual(curly, ASCII, 'the fixture must actually differ');
    assert.equal(
      curly.replace(LDQUO, '"').replace(RDQUO, '"'), ASCII,
      'and differ ONLY in the two quote characters'
    );
    const a = mustVerify('curly quotes', curly);
    const b = mustVerify('straight quotes', ASCII);
    assert.equal(a.char_offset, b.char_offset, 'both land on the same offset');
    assert.equal(a.method, 'exact');
  });

  test('ONLY an em dash differs', () => {
    const withHyphen = 'costs 4.1 points of macro-F1 - a drop the authors do not discuss';
    const withEmDash = withHyphen.replace(' - ', ` ${EM_DASH} `);
    assert.equal(withEmDash.replace(EM_DASH, '-'), withHyphen, 'one character apart');
    const a = mustVerify('ASCII hyphen for the source em dash', withHyphen);
    const b = mustVerify('em dash', withEmDash);
    assert.equal(a.char_offset, b.char_offset);
    assert.equal(a.method, 'exact');
    assert.equal(b.method, 'exact');
  });

  test('ONLY casing differs', () => {
    const lower = ASCII.toLowerCase();
    const upper = ASCII.toUpperCase();
    const mixed = 'ReMoViNg tHe "HiErArChY pRiOr" cOsTs 4.1 pOiNtS oF mAcRo-f1';
    assert.equal(lower.toUpperCase(), upper, 'the fixtures differ only in case');
    const results = [lower, upper, mixed].map((q, i) => mustVerify(`casing ${i}`, q));
    const offsets = new Set(results.map((r) => r.char_offset));
    assert.equal(offsets.size, 1, 'case never moves the offset');
    for (const r of results) assert.equal(r.method, 'exact');
  });

  test('ONLY whitespace collapsing differs', () => {
    const spaced = 'removing   the "hierarchy prior"\n\ncosts\t4.1  points of macro-F1';
    const padded = `   ${ASCII}   `;
    assert.equal(
      spaced.replace(/\s+/g, ' '), ASCII.replace(/\s+/g, ' '),
      'identical once whitespace is collapsed'
    );
    const a = mustVerify('internal runs, newlines and a tab', spaced);
    const b = mustVerify('leading and trailing padding', padded);
    assert.equal(a.method, 'exact');
    assert.equal(b.method, 'exact');
    assert.equal(a.char_offset, b.char_offset);
  });
});

// ---------------------------------------------------------------------------------------
// The rest of the fold set, also isolated
// ---------------------------------------------------------------------------------------

describe('the remaining folds', () => {
  test('a non-breaking space quoted as a plain space', () => {
    const r = mustVerify('NBSP', 'the confidence interval is wide because the identification');
    assert.equal(r.method, 'exact');
  });

  test('an fi ligature quoted as two plain letters', () => {
    const r = mustVerify('ligature', 'because the identification strategy is only validated');
    assert.equal(r.method, 'exact');
    assert.ok(SOURCE.includes(FI_LIG), 'the source really does carry the ligature');
  });

  test('a curly apostrophe quoted as a straight one — the clipboard case', () => {
    const r = mustVerify('apostrophe', "the authors' own appendix says ... the effect is not");
    assert.equal(r.method, 'exact');
  });

  test('an ellipsis character quoted as three periods', () => {
    const r = mustVerify('ellipsis', "the authors' own appendix says ... the effect is not robust");
    assert.equal(r.method, 'exact');
  });

  test('a non-breaking hyphen quoted as en dash, em dash, minus or ASCII hyphen', () => {
    const offsets = new Set();
    for (const [label, d] of [['ascii', '-'], ['en', EN_DASH], ['em', EM_DASH], ['minus', MINUS]]) {
      const r = mustVerify(`dash:${label}`, `removing the "hierarchy prior" costs 4.1 points of macro${d}F1`);
      assert.equal(r.method, 'exact');
      offsets.add(r.char_offset);
    }
    assert.equal(offsets.size, 1, 'every dash form lands on the same offset');
  });

  test('invisible characters pasted into the quote are stripped, not matched', () => {
    const base = 'removing the "hierarchy prior" costs 4.1 points of macro-F1';
    for (const [label, ch] of [['ZWSP', ZWSP], ['ZWJ', ZWJ], ['SHY', SHY]]) {
      const r = mustVerify(`invisible:${label}`, base.replace('hierarchy', `hier${ch}archy`));
      assert.equal(r.method, 'exact', `${label} must not push a clean quote onto the fuzzy path`);
    }
  });

  test('all folds at once still verifies exactly', () => {
    const r = mustVerify(
      'everything',
      `  REMOVING   THE ${LDQUO}HIER${ZWSP}ARCHY PRIOR${RDQUO}\n COSTS 4.1 POINTS OF MACRO${EM_DASH}F1  `
    );
    assert.equal(r.method, 'exact');
    assert.equal(r.score, 1);
  });
});

// ---------------------------------------------------------------------------------------
// Folding must not become a way to fabricate evidence
// ---------------------------------------------------------------------------------------

describe('normalization is lenient about FORM, never about CONTENT', () => {
  test('a changed number does not verify', () => {
    const r = verify('removing the "hierarchy prior" costs 9.7 points of macro-F1');
    assert.equal(r.ok, false, 'a fabricated statistic must not fold its way through');
    assert.equal(r.code, 'EVIDENCE_NOT_FOUND');
  });

  test('a negated claim does not verify', () => {
    const r = verify('a drop the authors do discuss at length in the appendix section');
    assert.equal(r.ok, false);
  });

  test('removing a separator does not weld two words into a match', () => {
    // U+2028 is replaced with a space, never removed — deleting it would weld the words
    // on either side together and let "held-out split" and "the confidence" become one
    // quotable string.
    const welded = normalizeText(`held-out split${cp(0x2028)}the confidence`);
    assert.ok(welded.includes('split the'), 'the separator became a space, not nothing');
    assert.ok(!welded.includes('splitthe'), 'words were not welded');
  });
});

// ---------------------------------------------------------------------------------------
// 04 §7.3 S11 — the offset companion has not drifted from the matcher
// ---------------------------------------------------------------------------------------

describe('04 §7.3 S11 — normalizeWithMap agrees with normalizeText', () => {
  const SAMPLES = [
    SOURCE,
    `${LDQUO}quoted${RDQUO} and ${LSQUO}single${RSQUO} and ${PRIME}prime${PRIME}`,
    `dashes ${EN_DASH}${EM_DASH}${NB_HYPH}${MINUS} and ellipsis ${ELLIPS}`,
    `invisible ${ZWSP}${ZWJ}${SHY}${cp(0xFEFF)} and bidi ${cp(0x202E)}reversed${cp(0x202C)}`,
    `spacey ${NBSP}${cp(0x2028)}${cp(0x2029)}\t collapsed`,
    `ligature identi${FI_LIG}cation`,
    '   leading and trailing   ',
    '', 'a'
  ];

  test('norm output is identical for both', () => {
    for (const s of SAMPLES) {
      assert.equal(
        normalizeWithMap(s).norm, normalizeText(s),
        `S11 drift on ${JSON.stringify(s.slice(0, 40))}`
      );
    }
  });

  test('the map is the right length and points inside the source', () => {
    for (const s of SAMPLES) {
      const { norm, map } = normalizeWithMap(s);
      assert.equal(map.length, norm.length, 'one source index per normalized character');
      for (const i of map) {
        assert.ok(i >= 0 && i < s.length, 'every index lands inside the source string');
      }
    }
  });

  test('the map is monotonic, so an offset can never point backwards', () => {
    for (const s of SAMPLES) {
      const { map } = normalizeWithMap(s);
      for (let i = 1; i < map.length; i++) {
        assert.ok(map[i] >= map[i - 1], 'indices never decrease');
      }
    }
  });

  test('tokens() drops punctuation but never letters or digits', () => {
    const t = tokens(normalizeText('macro-F1, 4.1 points; "quoted" (parens) 42%'));
    assert.deepEqual(t, ['macro', 'f1', '4', '1', 'points', 'quoted', 'parens', '42']);
  });
});

// ---------------------------------------------------------------------------------------
// The imported normalizer really does cover the codepoints it claims to
// ---------------------------------------------------------------------------------------

describe('the fold set is complete — a silently stripped class would be caught here', () => {
  test('every quote character folds to a straight quote', () => {
    // U+00B4 and U+2033 are DELIBERATELY absent from these lists. See the next test:
    // both are listed in the shared fold classes but are unreachable, because 04 §3.1
    // runs NFKC BEFORE the typographic folding and NFKC decomposes them first.
    for (const n of [0x2018, 0x2019, 0x201A, 0x201B, 0x2032, 0x0060]) {
      assert.equal(normalizeText(`a${cp(n)}b`), "a'b", `U+${n.toString(16)} did not fold`);
    }
    for (const n of [0x201C, 0x201D, 0x201E, 0x201F, 0x00AB, 0x00BB]) {
      assert.equal(normalizeText(`a${cp(n)}b`), 'a"b', `U+${n.toString(16)} did not fold`);
    }
  });

  test('KNOWN DEVIATION — two fold entries are unreachable behind NFKC', () => {
    // FINDING, reported rather than tuned. src/sanitize/normalize.js lists U+00B4 in
    // SQUOTE and U+2033 in DQUOTE, but normalizeText applies NFKC before either class
    // runs, and NFKC decomposes both, so neither entry can ever match:
    //
    //   U+00B4 ACUTE ACCENT  --NFKC-->  U+0020 U+0301  (space + combining acute)
    //   U+2033 DOUBLE PRIME  --NFKC-->  U+2032 U+2032  (two primes, then caught by SQUOTE)
    //
    // Behaviour is deterministic and no 04 §7.2 row depends on either, so it is PINNED
    // here as-is rather than corrected: normalize.js belongs to the sanitize lane, and a
    // second opinion about the fold order is exactly the divergence 04 §3.1 forbids.
    // It can only bite when the SOURCE and the QUOTE spell the same mark differently,
    // because both sides run through the same normalizer.
    assert.equal(
      normalizeText(`a${cp(0x00B4)}b`), `a ${cp(0x0301)}b`,
      'U+00B4 decomposes to space + combining acute, and injects a space besides'
    );
    assert.equal(
      normalizeText(`a${cp(0x2033)}b`), "a''b",
      'U+2033 becomes two apostrophes, not one double quote'
    );
  });

  test('every dash character folds to an ASCII hyphen', () => {
    for (const n of [0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015, 0x2212, 0xFE58, 0xFE63, 0xFF0D]) {
      assert.equal(normalizeText(`a${cp(n)}b`), 'a-b', `U+${n.toString(16)} did not fold`);
    }
  });

  test('every zero-width and bidi character is stripped', () => {
    const cps = [0x00AD, 0x200B, 0x200C, 0x200D, 0x200E, 0x200F, 0xFEFF,
      0x2060, 0x2061, 0x2062, 0x2063, 0x2064,
      0x202A, 0x202B, 0x202C, 0x202D, 0x202E,
      0x2066, 0x2067, 0x2068, 0x2069];
    for (const n of cps) {
      assert.equal(normalizeText(`ab${cp(n)}cd`), 'abcd', `U+${n.toString(16)} survived`);
    }
  });

  test('every separator becomes a space rather than vanishing', () => {
    for (const n of [0x2028, 0x2029, 0x0009, 0x000B, 0x000C]) {
      assert.equal(normalizeText(`ab${cp(n)}cd`), 'ab cd', `U+${n.toString(16)} welded`);
    }
  });

  test('restore the real substrate', () => {
    __resetSubstrateForTests();
  });
});
