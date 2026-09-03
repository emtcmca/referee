/**
 * scripts/check-corpus.mjs — the corpus-side acceptance rows.
 *
 * AC-15 and AC-16 are both marked manual in scripts/check-acceptance.mjs, and both say
 * the same thing: the check belongs to `scripts/check-corpus.mjs`. That file did not
 * exist, so two rows a script can settle exactly were sitting in a human's checklist.
 * Neither needs a browser, an agent, or a rendered UI. They need the sanitizer run over
 * the shipped corpus and the counts compared to the numbers the README states publicly.
 *
 * What is checked, and why each is a claim a judge could test:
 *
 *   AC-15  The three seeded manuscripts neutralize their payloads, at the exact
 *          section addresses 01 §5 fixes: MS-102 -> 2 [abstract, discussion],
 *          MS-107 -> 1 [related_work], MS-110 -> 1 [data_availability].
 *   AC-16  The other nine report injection_attempts 0 and an empty sections_affected.
 *          The two NEAR-MISS DECOYS (MS-106, MS-109) are the load-bearing half: nine
 *          zeros where two of them were written to look adversarial is the only
 *          evidence that the detector discriminates rather than matching vocabulary.
 *   +      No sanitized section still carries a redaction token's payload alongside it,
 *          and every section that was touched carries the token — a redaction that
 *          removed text without leaving the marked hole would be a silent edit.
 *
 * This script asserts postconditions, not its own exit code: it prints the observed
 * table and fails loudly on any divergence. Run it before quoting any corpus number.
 */

import { installCorpus } from '../src/core/corpus-access.js';
import { MANUSCRIPTS } from '../src/corpus/manuscripts.public.js';
import { sanitizeManuscript, REDACTION_RE } from '../src/sanitize/index.js';

/** 01 §5's fixed addresses. Section order matters: it is the order they appear in the doc. */
const EXPECTED = Object.freeze({
  'MS-102': ['abstract', 'discussion'],
  'MS-107': ['related_work'],
  'MS-110': ['data_availability'],
});

/** 04 §2 names these two as written to look adversarial and required NOT to flag. */
const DECOYS = Object.freeze(['MS-106', 'MS-109']);

const failures = [];
const fail = (m) => { failures.push(m); };

const count = installCorpus({ manuscripts: MANUSCRIPTS });
if (count !== 12) fail(`corpus has ${count} manuscripts, expected 12`);

const rows = [];
for (const doc of MANUSCRIPTS) {
  const r = sanitizeManuscript(doc.id);
  if (!r) { fail(`${doc.id}: sanitizeManuscript returned null`); continue; }

  const attempts = r.integrity.injection_attempts;
  const affected = r.integrity.sections_affected;
  const want = EXPECTED[doc.id] || [];

  // The counts, against 01 §5 rather than against whatever the code happens to do.
  if (attempts !== want.length) {
    fail(`${doc.id}: injection_attempts ${attempts}, expected ${want.length}`);
  }
  if (affected.join(',') !== want.join(',')) {
    fail(`${doc.id}: sections_affected [${affected}], expected [${want}]`);
  }

  // Every touched section must carry the visible hole. A removal with no marker is a
  // silent edit to a manuscript, which is worse than not sanitizing at all.
  for (const sec of affected) {
    const text = r.sections[sec];
    REDACTION_RE.lastIndex = 0;
    if (!REDACTION_RE.test(text)) {
      fail(`${doc.id}.${sec}: reported an attempt but carries no redaction token`);
    }
  }
  // And no untouched section may carry one.
  for (const [sec, text] of Object.entries(r.sections)) {
    if (affected.includes(sec)) continue;
    REDACTION_RE.lastIndex = 0;
    if (REDACTION_RE.test(text)) {
      fail(`${doc.id}.${sec}: carries a redaction token but was not reported as affected`);
    }
  }

  rows.push({
    id: doc.id,
    attempts,
    affected: affected.length ? affected.join(', ') : '—',
    decoy: DECOYS.includes(doc.id) ? 'decoy' : '',
    words: doc.sections.reduce((n, s) => n + s.text.trim().split(/\s+/).length, 0),
  });
}

// The nine-clean claim, stated as its own assertion rather than inferred from the loop.
const clean = rows.filter((r) => r.attempts === 0);
const seeded = rows.filter((r) => r.attempts > 0);
if (clean.length !== 9) fail(`${clean.length} clean manuscripts, expected 9 (AC-16)`);
if (seeded.length !== 3) fail(`${seeded.length} seeded manuscripts, expected 3 (AC-15)`);
const totalPayloads = rows.reduce((n, r) => n + r.attempts, 0);
if (totalPayloads !== 4) fail(`${totalPayloads} payloads total, expected 4 (AC-15)`);
for (const d of DECOYS) {
  const row = rows.find((r) => r.id === d);
  if (!row) fail(`decoy ${d} is not in the corpus`);
  else if (row.attempts !== 0) fail(`decoy ${d} flagged ${row.attempts} attempt(s) — false positive`);
}

const bar = '─'.repeat(64);
console.log(bar);
console.log('  CORPUS CHECK — AC-15, AC-16');
console.log(bar);
console.log('  id       attempts  sections_affected                 words');
for (const r of rows) {
  console.log(
    '  ' + r.id.padEnd(9) + String(r.attempts).padStart(4) + '      ' +
    r.affected.padEnd(32) + String(r.words).padStart(6) + (r.decoy ? '  ' + r.decoy : '')
  );
}
console.log(bar);
console.log(`  manuscripts 12   seeded 3   clean 9   payloads 4   words ${rows.reduce((n, r) => n + r.words, 0)}`);
console.log(`  decoys ${DECOYS.join(', ')} flagged nothing`);
console.log(bar);

if (failures.length) {
  console.log('  FAIL');
  for (const f of failures) console.log('    · ' + f);
  console.log(bar);
  process.exit(1);
}
console.log('  RESULT: PASS — AC-15 and AC-16 both settled by this run');
console.log(bar);
