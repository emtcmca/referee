# 02a — Injection sanitizer: the module (slice C2, part 1 of 2)

**Deliverable:** `src/adversarial/sanitizer.js`, transcribed.
**Then read `02b-sanitizer-tests.md`** for the fixtures and the test table you must re-run. This
slice is not done until both parts are.

Read `00-START-HERE.md` first. Read nothing else.

**Transcription, not design.** The implementation has been written and executed. Do not redesign,
rename, or improve. Never adjust the code to make a table row true.

**Dependency:** this imports `normalizeText` from `src/adversarial/normalize.js`, delivered by
`03a-verifier.md`. Do `03a` first. One normalizer, shared with the evidence verifier so a quote and
a payload are judged by the same ruler. **Never fork it.**

---

## 1. Detection model

A **unit is a line (paragraph), not a sentence**; over 600 characters it falls back to sentence
splitting. The unit is also the neutralization granularity: a flagged unit is replaced whole.

That was set by measurement. Under sentence units every fixture failed or half-failed — FX-2 went
undetected because its `SYSTEM NOTE` framing and its verdict directive sit in adjacent sentences, so
F2 and F3 never co-occurred in one unit. The cost, stated plainly: a legitimate sentence sharing a
paragraph with a payload is removed with it. Sub-sentence surgery is worse — it leaves debris that
still reads as manuscript text, where a whole-paragraph hole is unmistakable in the split-screen.

All matching runs on the **normalized** unit except F4, which runs on the **raw** unit because
normalization deletes exactly the characters F4 looks for.

| Family | Looks for |
|---|---|
| `F1_INSTRUCTION_OVERRIDE` | override verb within 40 chars of an instruction noun |
| `F2_AGENT_ADDRESSING` | text addressing an AI system or forging a chat role |
| `F3_VERDICT_COERCION` | output verb within 60 chars of a verdict noun, or a concealment directive |
| `F4_INVISIBLE_CHANNEL` | concealment styling, >=3 zero-width chars, or any bidi override |
| `F5_FAKE_AUTHORITY` | authority noun within 60 chars of an approval verb |

**Guard A, quoted-span:** a match wholly inside a `"..."` span under 200 characters is ignored.
Applies to F1/F2/F3/F5, never F4 — concealment markup inside a quotation is still concealment markup.

**Guard B, citation-frame, F1 only, proximity-scoped:** F1 is suppressed when the frame lexicon
appears in the **80 characters immediately preceding the F1 match**, not anywhere in the unit. The
scoping is load-bearing. Testing the frame unit-wide was the first implementation and it silently
broke FX-1, whose own payload says "report no major weaknesses" — `report` is in the lexicon, so F1
was suppressed by the attacker's own text. A unit-wide guard hands any author a one-word bypass.

**Flag conditions, any one suffices:** `F4` alone; `F1` alone (after both guards); `F2 AND F3`;
`F5 AND F3`. F2, F3 or F5 alone never flags — "do not mention this in your review" written to a human
reviewer is rude, not an injection.

---

## 2. The implementation — transcribe exactly

```js
// src/adversarial/sanitizer.js
import { normalizeText } from './normalize.js';
import { getPublicManuscript } from '../data/public-access.js';

export const DETECTOR_VERSION = 'referee-sanitizer/1.0.0';
export const redactionToken = (n) => `[[REDACTED:NON_MANUSCRIPT_DIRECTIVE#${n}]]`;
export const REDACTION_RE = /\[\[REDACTED:NON_MANUSCRIPT_DIRECTIVE#\d+\]\]/g;

const F1 = /\b(ignore|disregard|forget|override|bypass|skip)\b[\s\S]{0,40}?\b(previous|prior|above|earlier|preceding|all|any)\b[\s\S]{0,40}?\b(instruction|instructions|prompt|prompts|rule|rules|directive|directives|guidance|guidelines?)\b/;
const F2 = /(\bsystem\s*(note|message|prompt|instruction)\b|\bas an? (ai|assistant|language model)\b|\byou are (an?|now|acting)\b|\b(ai|automated)( review)? (assistant|assistants|agent|reviewer)\b|\b(large )?language model\b|\bllm\b|\bassistant\s*:|\[system\]|<\|im_start\|>|#{2,}\s*system\b)/;
const F3 = /(\b(recommend|recommendation|output|respond|repl(y|ies)|state|write|return|give|record|assign|score|rate|award)(s|es|ed|ing)?\b[\s\S]{0,60}?\b(accept|acceptance|strong accept|reject|rejection|highest (score|rating)|top (score|rating)|no (major )?(weakness|weaknesses|flaws|concerns)|full marks|maximum score)\b|\bdo not (mention|disclose|reveal|report|flag)\b|\bwithout (mentioning|disclosing|revealing)\b)/;
const F5 = /\b(editor|program chair|area chair|meta-?reviewer|review (system|platform|committee)|automated (checker|verification|pre-?check)|conference (system|committee))\b[\s\S]{0,60}?\b(pre-?approved|approved|verified|cleared|instructs?|requires?|has determined|mandates?|waives?)\b/;

const F4_CSS  = /(color\s*:\s*(#f{3}|#f{6}|white|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))|font-size\s*:\s*0(\.\d+)?(px|pt|em)?\b|display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(\.0+)?\b|aria-hidden\s*=\s*["']true["'])/i;
const F4_ZW   = /[\u200B-\u200D\u2060\uFEFF]/g;
const F4_BIDI = /[\u202A-\u202E\u2066-\u2069]/;

const CITATION_FRAME = /\b(prior work|previous work|related work|the literature|reports?|reported|describes?|described|documented|such as|for example|e\.g\.|for instance|we (study|examine|analy[sz]e|evaluate|consider|investigate)|attacks? (that|which)|adversarial (prompt|suffix|input|text|example)|threat model|injection (attack|payload|string|example)|figure \d+|table \d+|section \d+|appendix|\[\d+\])\b/;

/** Guard A: blank out quoted spans under 200 chars so patterns inside them cannot match. */
function maskShortQuotes(s) {
  return s.replace(/"([^"]{0,200})"/g, (m) => ' '.repeat(m.length));
}

/**
 * Split raw section text into units, carrying raw offsets so neutralization can splice on the
 * original string. THE UNIT IS THE LINE (paragraph), not the sentence. A line longer than
 * maxLine falls back to sentence granularity, so a section authored as one unbroken line
 * cannot be wholly redacted over one bad sentence.
 * No lookbehind anywhere: the in-app browser's engine version is not guaranteed.
 */
export function splitUnits(text, maxLine = 600) {
  const units = [];
  const pushUnit = (from, to) => {
    // Keep a trailing newline OUT of the unit so redaction preserves paragraph breaks.
    const end = (to > from && text[to - 1] === '\n') ? to - 1 : to;
    const seg = text.slice(from, end);
    if (!seg.trim()) return;
    if (seg.length <= maxLine) { units.push({ start: from, end, text: seg }); return; }
    let s2 = from;
    for (let j = from; j < end; j++) {
      const c = text[j];
      if ((c === '.' || c === '!' || c === '?') && (j + 1 >= end || /\s/.test(text[j + 1]))) {
        const e2 = j + 1;
        if (text.slice(s2, e2).trim()) units.push({ start: s2, end: e2, text: text.slice(s2, e2) });
        s2 = e2;
      }
    }
    if (s2 < end && text.slice(s2, end).trim()) units.push({ start: s2, end, text: text.slice(s2, end) });
  };
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') { pushUnit(start, i + 1); start = i + 1; }
  }
  if (start < text.length) pushUnit(start, text.length);
  return units;
}

function techniqueOf(fams) {
  const has = (f) => fams.includes(f);
  if (has('F4_INVISIBLE_CHANNEL') && has('F1_INSTRUCTION_OVERRIDE')) return 'hidden_text_instruction_override';
  if (has('F4_INVISIBLE_CHANNEL')) return 'hidden_text_channel';
  if (has('F5_FAKE_AUTHORITY')) return 'forged_review_artifact';
  if (has('F2_AGENT_ADDRESSING')) return 'system_note_roleplay';
  if (has('F1_INSTRUCTION_OVERRIDE')) return 'instruction_override';
  return 'heuristic_match';
}

/** @returns {{flagged:boolean, families:string[]}} */
export function detectUnit(rawUnit) {
  const families = [];
  const zwCount = (rawUnit.match(F4_ZW) || []).length;
  if (F4_CSS.test(rawUnit) || zwCount >= 3 || F4_BIDI.test(rawUnit)) families.push('F4_INVISIBLE_CHANNEL');

  // Normalize BEFORE pattern matching: this is what defeats zero-width word splitting and
  // smart-quote obfuscation. F4 above already ran on the raw text.
  const guarded = maskShortQuotes(normalizeText(rawUnit));

  // Guard B is PROXIMITY-SCOPED: the frame must sit in the 80 characters immediately before
  // the trigger, because that is what framing means.
  const m1 = F1.exec(guarded);
  if (m1) {
    const pre = guarded.slice(Math.max(0, m1.index - 80), m1.index);
    if (!CITATION_FRAME.test(pre)) families.push('F1_INSTRUCTION_OVERRIDE');
  }
  if (F2.test(guarded)) families.push('F2_AGENT_ADDRESSING');
  if (F3.test(guarded)) families.push('F3_VERDICT_COERCION');
  if (F5.test(guarded)) families.push('F5_FAKE_AUTHORITY');

  const has = (f) => families.includes(f);
  const flagged = has('F4_INVISIBLE_CHANNEL')
    || has('F1_INSTRUCTION_OVERRIDE')
    || (has('F2_AGENT_ADDRESSING') && has('F3_VERDICT_COERCION'))
    || (has('F5_FAKE_AUTHORITY') && has('F3_VERDICT_COERCION'));
  return { flagged, families };
}

/**
 * Neutralize one section. Pure: does not touch state, does not mutate the corpus.
 * @returns {{clean:string, events:Object[], attempts:number}}
 */
export function sanitizeSection(manuscriptId, sectionId, rawText) {
  const events = [];
  let clean = '';
  let cursor = 0;
  let span = 0;
  for (const u of splitUnits(rawText)) {
    const v = detectUnit(u.text);
    if (!v.flagged) continue;
    span += 1;
    clean += rawText.slice(cursor, u.start) + redactionToken(span);
    cursor = u.end;
    events.push({
      id: `${manuscriptId}:${sectionId}:${span}`,
      manuscript_id: manuscriptId,
      section_id: sectionId,
      span_index: span,
      families: v.families,
      technique: techniqueOf(v.families),
      raw_excerpt: u.text,            // HUMAN SPLIT-SCREEN ONLY. Never in a tool return.
      raw_offset: [u.start, u.end],
      replacement_token: redactionToken(span),
      detector_version: DETECTOR_VERSION,
      detected_at: new Date().toISOString()
    });
  }
  clean += rawText.slice(cursor);
  return { clean, events, attempts: events.length };
}

const _memo = new Map();   // deterministic input -> safe to cache

/**
 * Sanitize a whole manuscript. Memoized so read_manuscript and verifyQuote always see
 * byte-identical agent text within a session.
 * @returns {{id:string, sections:Object<string,string>, events:Object[],
 *            integrity:{injection_attempts:number, sections_affected:string[]}}}
 */
export function sanitizeManuscript(manuscriptId) {
  if (_memo.has(manuscriptId)) return _memo.get(manuscriptId);
  const doc = getPublicManuscript(manuscriptId);
  if (!doc) return null;
  const sections = {};
  const events = [];
  const affected = [];
  // Manuscript.sections is an ORDERED ARRAY, not a map. Object.entries over it would key the
  // output by array index -- a silent corruption, not an error.
  for (const sec of doc.sections) {
    const r = sanitizeSection(manuscriptId, sec.id, sec.text);
    sections[sec.id] = r.clean;
    if (r.attempts > 0) { affected.push(sec.id); events.push(...r.events); }
  }
  const out = {
    id: manuscriptId,
    sections,
    events,
    integrity: { injection_attempts: events.length, sections_affected: affected }
  };
  _memo.set(manuscriptId, out);
  return out;
}

/** The agent-visible text for one section. This is the substrate quotes verify against. */
export function getAgentText(manuscriptId, sectionId) {
  const m = sanitizeManuscript(manuscriptId);
  return m ? m.sections[sectionId] : undefined;
}

/** Called by the reset control. Caches are derived data only; nothing is lost. */
export function resetAdversarialCaches() { _memo.clear(); }
```

**Signatures are frozen.** `sanitizeSection(...) -> {clean, events, attempts}` and
`sanitizeManuscript(id) -> {id, sections, events, integrity:{injection_attempts, sections_affected}}`.
`{neutralized, findings}` and `sanitizeForAgent(id, section) -> {text, injection_attempts, event_ids}`
are **dead vocabulary — do not build either.**

The redaction literal is `redactionToken(n)` and nothing else. That exact token is the hard match
barrier the sanitize-verify invariant rests on, and `REDACTION_RE` is keyed to it. Do not invent a
friendlier placeholder.

Integrity events are **derived, never persisted**. The sanitizer writes no state, calls no ledger,
and `raw_excerpt` never leaves the page.

---

## Definition of Done (part 1)

**Output path:** `C:\dev\referee\src\adversarial\sanitizer.js`. Nothing else.

Before moving to `02b`, observe and state each of these:

- The module parses and every export resolves: `DETECTOR_VERSION`, `redactionToken`, `REDACTION_RE`,
  `splitUnits`, `detectUnit`, `sanitizeSection`, `sanitizeManuscript`, `getAgentText`,
  `resetAdversarialCaches`. Report the list you enumerated.
- A grep of the file for `neutralized` and `sanitizeForAgent` returns zero hits.
- `[[REDACTED:NON_MANUSCRIPT_DIRECTIVE#` appears exactly twice (token builder, regex) and no other
  placeholder string exists.
- The five family regexes, both guards, and the four flag conditions are byte-identical to §2.
  Report a diff result, not an impression.
- `Object.keys()` on a real `sanitizeSection` return is exactly `clean`, `events`, `attempts` —
  pasted in.
- You have not claimed the slice done. `02b` carries the measurements.
