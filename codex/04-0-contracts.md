# 04-0 — Cross-slice contracts and persisted state (slice C6, part 1 of 9)

**Deliverable:** no source file. This is the reference every other C6 part codes against. Read it
once, keep it, and do not go looking for these definitions anywhere else.

C6 is the seven tool handlers. It is split across eight work orders because the frozen contract does
not fit in one. **Do them in order: 04, 04a, 04b, 04c, 04d, 04e, 04g, 04f.**

Read `00-START-HERE.md` first. Read nothing else.

**Locked, do not re-litigate:** every `execute` returns `JSON.stringify(payload)` — a string, success
and refusal alike. **Policy refusals are RETURNED, never THROWN**; a genuine runtime exception is
caught and converted to `{ok:false, code:"INTERNAL"}`. The page authoring its own refusals is the
entire thesis, so a refusal must arrive as a *result*.

**This slice adds no new top-level directory.** Everything lands under `src/tools/` and `src/core/`.

---

## 1. Cross-slice contracts — assume these exist, never redefine them

Other slices own these. Stub them to build against if they are not on disk yet, and say so in your
report. Do not change a signature.

```js
// src/data/public-access.js -- owned by the corpus slice.
// Reads ONLY the public store. Holds no reference of any kind to the identity store. This is the
// only path by which manuscript text enters a tool handler.
getPublicManuscript(id) -> PublicManuscript | null
// PublicManuscript = { id, title, sections: Section[], word_count, blinded_fields: string[] }
// Section = { id, label, order, text, word_count }.  sections is an ORDERED ARRAY, not a map --
// iterating it with Object.entries keys everything by array index, a silent corruption.
// .text is RAW public text, NOT sanitized.
getSectionOrder(id) -> string[]     // === doc.sections.map(s => s.id). Derived, cannot drift.

// src/adversarial/verify.js -- owned by the verifier slice.
verifyQuote(manuscriptId, sectionId, quote, opts) -> {
  ok: boolean,
  code: null | "UNKNOWN_MANUSCRIPT" | "SECTION_NOT_FOUND" | "QUOTE_TOO_SHORT"
        | "EVIDENCE_NOT_FOUND" | "INTERNAL",
  method: "exact" | "fuzzy" | null,
  score: number,                 // 1 on exact, the similarity on fuzzy. ABSENT ON FAILURE.
  normalized_length: number,     // post-normalization char count of the AGENT'S OWN quote
  char_offset: number | null,    // offset into the AGENT-VISIBLE (sanitized) section string
  min_chars: number,             // on QUOTE_TOO_SHORT only
  message: string                // on failure only, fixed per code
}
// It NEVER returns `verified`, `similarity`, `threshold`, `section_exists`, `normalized_quote`,
// or `normalized_quote_length`. Reading those fields is what made every finding refuse.
// NO SCORE ON FAILURE: a score on a miss is a hill-climbing gradient toward an accepted
// fabrication, so the gate does not compute one for a handler to echo.
// opts.debug is DEV HARNESS ONLY. Never pass it from a handler.
// Synchronous. Never throws; a runtime fault returns code "INTERNAL".

// src/adversarial/sanitizer.js -- owned by the sanitizer slice.
sanitizeManuscript(id) -> {
  id: string,
  sections: { [sectionId]: string },   // NEUTRALIZED text, keyed by Section.id
  events: IntegrityEvent[],            // HUMAN SIDE ONLY. A handler may not read this.
  integrity: { injection_attempts: number, sections_affected: string[] }
}
getAgentText(manuscriptId, sectionId) -> string | undefined
// `sanitizeForAgent(id, section) -> {text, injection_attempts, event_ids}` is DEAD VOCABULARY.
// No file implements it. Do not call it and do not write it.
// A handler may forward integrity.injection_attempts and integrity.sections_affected. It may
// not read `events`. The raw payload lives on IntegrityEvent.raw_excerpt and never leaves the
// page. Integrity events are derived in memory and not persisted, so there is no state key for
// a handler to reach -- a stronger guarantee than "handlers must not import it."
// Runs when the tool return is BUILT, not at render time. Memoized, deterministic, never throws.

// src/core/ledger.js -- owned by the ledger slice.
appendLedger(entry) -> LedgerEntry
// entry = { actor: "agent"|"human", action: string, manuscript_id: string|null,
//           args_digest: object, outcome: "accepted"|"refused", code: string|null,
//           visible_fields_at_time: string[], note: string|null }
// returns entry + { seq: number, ts: string }   // ts is ISO-8601
// `action` is a BARE tool name or a bare human verb. NEVER prefixed: "human:<verb>" is dead.
// Append-only. Never updates, never deletes.
hasRead(state, manuscriptId, section /* optional */) -> boolean
deriveFindings(state) -> Finding[]   // replays accepted assert_finding rows in seq order
```

`deriveFindings` selects ledger rows with `action === 'assert_finding'` and
**`outcome === 'accepted'`**. `outcome === 'ok'` is dead on a ledger row and matches nothing.

---

## 2. Persisted state — the parts handlers touch

```js
// ReviewState -- exactly seven persisted keys, one localStorage key `referee.state.v1`
{
  version: 1,
  seedHash: string,
  scores: { [manuscriptId]: { [criterion]: { value, set_by, updated_at } } },  // value 0..10 int
  ledger: LedgerEntry[],                                                       // set_by never 'agent'
  rubricWeights: { novelty, rigor, clarity, reproducibility, acceptSlots },    // ints 0..100
  unblinded: Array<{ id, reason, at }>,
  committed: null | { manuscript_id, recommendation, rationale, committed_at, by:"human", ledger_seq }
}
```

`committed` is a **single nullable object**: one commitment per session, and it locks the session
until reset. It is not a map. Always read it through the helper:

```js
export function committedFor(state, id) {
  return state.committed && state.committed.manuscript_id === id ? state.committed : null;
}
```

**Findings, editor flags and human evidence are DERIVED from the ledger, never persisted.** There is
no `state.scores[*].findings` array to push to. The append-only log is the only way a finding comes
into being, so it cannot be incomplete. **No tool writes a score.** `assert_finding`'s `score`
argument is the agent's *proposed* criterion score: it rides on the ledger row and never enters
`state.scores`.

---


---

## Definition of Done (part 1)

No file is written by this part. You are done when all of these are true and you say so:

- You can name the four cross-slice functions and state, without re-reading, that
  `sanitizeForAgent` is dead vocabulary and that `verifyQuote` returns no `verified`, `similarity`,
  `threshold`, or `normalized_quote` field.
- You can state that `committed` is a single nullable object, not a map, and is read through
  `committedFor(state, id)`.
- You can state that findings are derived from the ledger and that there is no
  `state.scores[*].findings` array.
- You have checked which of `src/data/public-access.js`, `src/adversarial/verify.js`,
  `src/adversarial/sanitizer.js`, `src/core/ledger.js`, `src/core/state.js`,
  `src/core/ranking.js`, `src/core/constants.js` and `src/corpus/field-paths.js` exist on disk, and
  you report the list, naming which ones you will have to stub.
- You have written no code yet. `04-1` starts that.
