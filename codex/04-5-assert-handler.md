# 04-5 — `assert_finding`: the handler, fully implemented (slice C6, part 6 of 9)

**Deliverable:** `src/tools/handlers/assert-finding.js`.

Read `00-START-HERE.md`, `04-0-contracts.md`, `04-2-define-tool.md` and `04-4-assert-contract.md`
first. Nothing else.

Thin, because the wrapper already did validation, manuscript and section resolution, the commit
check, and the P1/P2 ordering checks, and will do the ledger append, persistence, and JSON
serialization on the way out.

**What this handler does not do:** it never calls `appendLedger`, never calls `saveState`, never
serializes, never emits on the bus, never touches `state.unblinded`, never writes `state.scores`, and
never imports from the identity store or the integrity derivation. **It does not store the finding
either** — the ledger row the wrapper appends is what the finding *is*.

The defect this replaced was the single most damaging in the whole set: the handler read
`v.verified`, `v.similarity`, `v.threshold` and `v.normalized_quote` from a `verifyQuote` that
returns none of them. `undefined < 40` is `false`, so `QUOTE_TOO_SHORT` could never fire, and
`!undefined` is `true`, so **every single `assert_finding` returned `EVIDENCE_NOT_FOUND`, including
correct quotes.** It branches on `v.ok` and `v.code`, which are what the verifier actually returns.

---

## 3. The handler, fully implemented

```js
// src/tools/handlers/assert-finding.js
import { ok, refuse, CODES } from "../envelope.js";
import { verifyQuote } from "../../adversarial/verify.js";
import { normalizeText } from "../../adversarial/normalize.js";
import { deriveRanking } from "../../core/ranking.js";
import { deriveFindings } from "../../core/ledger.js";
import { CRITERIA, MIN_QUOTE_CHARS, FUZZY_THRESHOLD } from "../../core/constants.js";

export function assertFindingHandler({ args, state, next }) {
  const T = "assert_finding";
  const { manuscript_id, criterion, section, evidence_quote, claim, polarity, severity, score } = args;

  const active = deriveFindings(state).filter(
    (f) => f.manuscript_id === manuscript_id && f.status === "active"
  );
  const missing = () => CRITERIA.filter((c) => !active.some((f) => f.criterion === c));

  // --- criterion (the enum is also in the schema; hosts vary, so re-check in code) ---
  if (!CRITERIA.includes(criterion)) {
    return { refusal: refuse(T, CODES.INVALID_CRITERION,
      "That is not a rubric criterion in this review.",
      { possible: true, how: "Use one of valid_criteria and call again.",
        with: { supplied: criterion, valid_criteria: [...CRITERIA], criteria_missing: missing() } },
      next()) };
  }

  // --- evidence gate ---
  // verifyQuote returns {ok, code, method, score, normalized_length, char_offset,
  // min_chars?, message?}. It returns NO `verified` flag, NO `similarity`, NO `threshold`,
  // and NO `normalized_quote`. Reading fields it does not return is what made every finding
  // refuse, correct ones included.
  const v = verifyQuote(manuscript_id, section, evidence_quote);

  if (!v.ok && v.code === CODES.QUOTE_TOO_SHORT) {
    return { refusal: refuse(T, CODES.QUOTE_TOO_SHORT,
      "The evidence quote is shorter than the minimum after normalization.",
      { possible: true,
        how: "Extend the quote to at least " + MIN_QUOTE_CHARS + " normalized characters and call again.",
        with: { normalized_quote_length: v.normalized_length, min_length: v.min_chars,
                shortfall: v.min_chars - v.normalized_length, manuscript_id, section } },
      next()) };
  }

  if (!v.ok) {
    // Every other verifier failure lands here as ONE code with ONE message. No score, no
    // near-miss window, no nearest source span. The echo is the agent's own quote,
    // normalized by the same shared normalizer, and nothing else.
    return { refusal: refuse(T, CODES.EVIDENCE_NOT_FOUND,
      "That quote does not appear in the section you attributed it to.",
      { possible: true,
        how: "Re-read the section, copy a contiguous passage verbatim from the text this page returned, and call again. Do not paraphrase.",
        with: {
          manuscript_id, section,
          normalized_quote: normalizeText(evidence_quote),
          normalized_quote_length: v.normalized_length,
          match_method_attempted: ["exact", "fuzzy"],
          normalization_applied: [
            "strip-format-characters", "separators-to-space", "NFKC",
            "straighten-quotes", "straighten-dashes", "casefold", "collapse-whitespace"
          ],
          hint: "A quote that does not verify is usually a paraphrase rather than a transcription error."
        } },
      next()) };
  }

  // --- accepted ---
  const normalized = normalizeText(evidence_quote);
  const seq = state.ledger.length + 1;        // the row the wrapper is about to append
  const findingId = "f_" + hash8(manuscript_id + criterion + normalized + seq);
  const prior = active.find((f) => f.criterion === criterion) || null;

  // Identical re-call short circuit: same normalized quote, section, and judgement.
  if (prior &&
      prior.normalized_quote === normalized &&
      prior.section === section &&
      prior.polarity === polarity &&
      prior.severity === severity &&
      prior.score === score) {
    const rank = deriveRanking(state).find((r) => r.manuscript_id === manuscript_id);
    return { payload: ok(T, {
      finding_id: prior.finding_id, accepted: true, idempotent: true,
      verification: {
        method: prior.verification.method,
        score: prior.verification.score,
        threshold: FUZZY_THRESHOLD,
        char_offset: prior.verification.char_offset,
        normalized_quote: prior.normalized_quote,
        verified_against: "agent_visible_text"
      },
      supersedes: null,
      criterion_score: state.scores[manuscript_id][criterion].value,
      composite: rank.composite, rank: rank.rank, criteria_missing: missing()
    }, next()) };
  }

  // No mutation of state.scores. set_by is 'seed' | 'human', never 'agent'. The agent's
  // `score` argument is its PROPOSED criterion score and rides on the ledger row; the human
  // moves the actual score. The return reports what the rubric currently says, so the agent
  // reads the outcome it influenced without authoring it.
  const rank = deriveRanking(state).find((r) => r.manuscript_id === manuscript_id);

  return { payload: ok(T, {
    finding_id: findingId, accepted: true, idempotent: false,
    verification: {
      method: v.method, score: v.score, threshold: FUZZY_THRESHOLD,
      char_offset: v.char_offset, normalized_quote: normalized,
      verified_against: "agent_visible_text"
    },
    supersedes: prior ? prior.finding_id : null,
    criterion_score: state.scores[manuscript_id][criterion].value,
    composite: rank.composite, rank: rank.rank,
    criteria_missing: missing().filter((c) => c !== criterion)
  }, next()) };
}

/** FNV-1a, 32-bit, hex. Deterministic, dependency-free, adequate for opaque local ids. */
function hash8(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
```

---
---

## Definition of Done (part 6)

**Output path:** `C:\deveferee\src	ools\handlersssert-finding.js`. Nothing else.

Before moving to `04-6`, observe and state each of these:

- The handler is synchronous and returns `{payload}` or `{refusal}`, never a string.
- A grep of the file for `appendLedger`, `saveState`, `serialize`, `bus.emit`, `state.unblinded`,
  `identity`, `v.verified`, `v.similarity`, `v.threshold`, `v.normalized_quote`, and
  `best_similarity` returns **zero hits**. Paste the grep output.
- Driven with a quote copied verbatim from a section: `ok:true`, `verification.method === "exact"`,
  `verification.score === 1`, `verification.verified_against === "agent_visible_text"`. Paste the
  `verification` object.
- Driven with a fabricated quote: `ok:false, code:"EVIDENCE_NOT_FOUND"`, and the returned object
  contains **no numeric similarity anywhere.** Paste it whole and state that you scanned it.
- Driven with a real quote attributed to the **wrong section**: `EVIDENCE_NOT_FOUND`. The section
  binding is enforced, not decorative.
- Driven with a 30-character quote: `QUOTE_TOO_SHORT`, distinguishable from `EVIDENCE_NOT_FOUND`,
  with `shortfall` correct.
- Driven with `criterion: "significance"`: `INVALID_CRITERION` with `valid_criteria` listing the four.
- `normalization_applied` in the refusal has **exactly seven entries in the stated order.** Paste it.
- Idempotency: the same accepted call twice returns `idempotent:true` on the second with the same
  `finding_id`. A different quote for the same criterion returns `supersedes` set to the prior id.
- `state.scores` is unchanged after every one of the above. Report a before/after comparison.
- If the corpus or ranking modules are not on disk, name what you stubbed rather than reporting a
  check you could not run.
