# 04-1 — Envelopes, codes, call ordering (slice C6, part 2 of 9)

**Deliverables:** `src/tools/envelope.js`, `src/core/bus.js`, `src/tools/next-action.js`.

Read `00-START-HERE.md` and `04-0-contracts.md` first. Read nothing else.

**Locked, do not re-litigate:** every `execute` returns `JSON.stringify(payload)` — a string, success
and refusal alike. **Policy refusals are RETURNED, never THROWN**; a genuine runtime exception is
caught and converted to `{ok:false, code:"INTERNAL"}`. The page authoring its own refusals is the
entire thesis, so a refusal must arrive as a *result*.

**This slice adds no new top-level directory.** Everything lands under `src/tools/` and `src/core/`.

---

## 1. Envelopes

**Success.** Every accepted call produces an object whose first key is `ok: true`:

```js
{ ok: true, tool: "read_manuscript", ...payload, next_expected_action: NextAction }
```

**Refusal:**

```js
{
  ok: false,
  tool: "assert_finding",
  code: "EVIDENCE_NOT_FOUND",   // always one of the frozen set
  message: "...",               // one sentence, generated from a fixed template per code
  retry: {                      // ALWAYS present. This is what makes a refusal actionable.
    possible: true,             // false for HUMAN_ONLY / REQUIRES_HUMAN / ALREADY_COMMITTED / INTERNAL
    how: "...",                 // imperative: what to change and call again
    with: { ... }               // structured context for building the retry
  },
  next_expected_action: NextAction
}
```

`message` never interpolates manuscript text. Only `check_claim` and `assert_finding` echo the
agent's own normalized quote, and never surrounding source text.

---

## 2. The frozen code set

```js
// src/tools/envelope.js
export const CODES = Object.freeze({
  INVALID_ARGUMENT:    "INVALID_ARGUMENT",
  UNKNOWN_MANUSCRIPT:  "UNKNOWN_MANUSCRIPT",
  SECTION_NOT_FOUND:   "SECTION_NOT_FOUND",
  QUOTE_TOO_SHORT:     "QUOTE_TOO_SHORT",
  EVIDENCE_NOT_FOUND:  "EVIDENCE_NOT_FOUND",
  INVALID_CRITERION:   "INVALID_CRITERION",
  OUT_OF_ORDER:        "OUT_OF_ORDER",
  ALREADY_COMMITTED:   "ALREADY_COMMITTED",
  REQUIRES_HUMAN:      "REQUIRES_HUMAN",
  HUMAN_ONLY:          "HUMAN_ONLY",
  INTERNAL:            "INTERNAL"
});
```

| Code | Meaning | `retry.possible` | Emitted by |
|---|---|---|---|
| `INVALID_ARGUMENT` | argument failed `inputSchema` before any handler ran | `true` | wrapper |
| `UNKNOWN_MANUSCRIPT` | `manuscript_id` not in `MANUSCRIPT_IDS` | `true` | wrapper |
| `SECTION_NOT_FOUND` | `section` not in this manuscript's section order | `true` | wrapper |
| `QUOTE_TOO_SHORT` | normalized `evidence_quote` under 40 chars | `true` | `assert_finding`, `check_claim` |
| `EVIDENCE_NOT_FOUND` | quote does not verify in that section | `true` | `assert_finding` |
| `INVALID_CRITERION` | `criterion` not in `CRITERIA` | `true` | `assert_finding` |
| `OUT_OF_ORDER` | a named precondition is unmet and recoverable in one call | `true` | wrapper |
| `ALREADY_COMMITTED` | the human committed this manuscript; it is frozen | `false` | wrapper |
| `REQUIRES_HUMAN` | the decision itself is human-only | `false` | `submit_recommendation` |
| `HUMAN_ONLY` | unblinding is human-only | `false` | `request_unblind` |
| `INTERNAL` | handler threw; caught by the wrapper, converted, still logged | `false` | wrapper |

**Two codes for one boundary is deliberate and locked.** `REQUIRES_HUMAN` means *the decision*
belongs to the human. `HUMAN_ONLY` means *the visibility change* does. They are distinguishable in
the ledger, which is the point. **They have been written backwards in four places before. Check the
mapping every time you write one.**

Dead spellings, never write them: `UNKNOWN_SECTION`, `UNKNOWN_CRITERION`, `SESSION_COMMITTED`,
`MALFORMED_INPUT`, `EVIDENCE_TOO_SHORT`, `BLINDED_SECTION`.

---

## 3. `src/tools/envelope.js` — the rest of the module

```js
export function ok(tool, payload, nextAction) {
  return { ok: true, tool, ...payload, next_expected_action: nextAction };
}

export function refuse(tool, code, message, retry, nextAction) {
  return {
    ok: false, tool, code, message,
    retry: { possible: false, how: null, with: {}, ...retry },
    next_expected_action: nextAction
  };
}

/** Every execute() return in this codebase goes through this function. No exceptions.
 *  There is no {content:[...]} wrapper, no structuredContent, no host-shape flag. */
export function serialize(payload) { return JSON.stringify(payload); }

/** Sorted field paths the agent could see at the moment of the call, for the ledger row. */
export function visibleFieldsFor(manuscriptId, state) {
  // With no manuscript in scope the agent could still see the queue, so the queue paths are
  // what it was entitled to read -- returning [] would understate the record on every
  // get_review_state row.
  if (manuscriptId === null) return [...QUEUE_FIELD_PATHS];
  const ms = getPublicManuscript(manuscriptId);
  if (!ms) return [...QUEUE_FIELD_PATHS];
  // THE LOAD-BEARING LINE OF THIS MODULE. The agent branch takes no input but the actor. It
  // cannot widen: there is no expression here that consults state, the manuscript, or the
  // unblind list. Unblinding changes the human's view and changes no tool return. If a future
  // edit makes this function read state.unblinded, structural blinding has silently become
  // masking.
  return [...PUBLIC_FIELD_PATHS];
}

export function nowISO() { return new Date().toISOString(); }

let _callSeq = 0;
export function nextCallId() { return ++_callSeq; }

/** One clause per tool, from a FROZEN TEMPLATE TABLE. It must never interpolate manuscript
 *  text -- the ledger view renders it. Build a table keyed by tool name and outcome. */
export function summarize(toolName, result) { /* frozen templates only */ }
```

`PUBLIC_FIELD_PATHS` and `QUEUE_FIELD_PATHS` come from `src/corpus/field-paths.js`, a module that
contains names and no data. `BLINDED_FIELD_NAMES` is the nine-name frozen array shipped identically
on every manuscript in every return:

```js
['authors','affiliations','funding','acknowledgements','author_notes',
 'correspondence_email','external_links','prior_submission_history','conflict_of_interest']
```

---

## 4. `src/core/bus.js`

A twelve-line emitter over `EventTarget`, exported as `bus`. The events are `webmcp:changed`,
`tool:invoked`, `tool:settled`, `human:action`, `state:changed`, `integrity:detected`. One bus. Do
not emit DOM `CustomEvent`s with other names — three differently-named events with zero overlap means
no region of the UI ever re-renders.

---

## 5. Call ordering

**Happy path:** `get_review_state` → `read_manuscript` → optional `check_claim` → `assert_finding`
×1–4 → optional `flag_for_editor` → `get_review_state` → `submit_recommendation` refuses and the
agent asks the human, who clicks Commit in the page.

**`OUT_OF_ORDER` fires if and only if** an unmet precondition exists that is a genuine correctness
requirement and that the agent can satisfy with exactly one named call. There are exactly two:

| | Precondition | Applies to |
|---|---|---|
| **P1** | Read before claim: an accepted `read_manuscript` for this `manuscript_id` exists in the ledger | `assert_finding`, `check_claim`, `flag_for_editor` |
| **P2** | Read the section before quoting it: an accepted `read_manuscript` covering this `section` exists | `assert_finding`, `check_claim` |

A quote that verifies without a prior read came from somewhere else — a prior session, a
hallucination, or an injection. Catching that is a feature. `read_manuscript` with no `sections`
argument returns everything and satisfies P2 for all of them, so a normal agent never trips P2.

**Explicitly NOT preconditions:** findings in criterion order; `check_claim` before `assert_finding`;
all four criteria before recommending; reading in queue order; re-reading a manuscript; calling
`get_review_state` at any point. And `request_unblind` / `submit_recommendation` refuse with their
human-only codes regardless of ordering — **a human-only refusal always outranks an ordering refusal**
so the agent is told the true reason rather than sent on a doomed retry.

**Refusal precedence, evaluated top to bottom in the wrapper:**

```
1. INTERNAL            (thrown, caught, converted)
2. INVALID_ARGUMENT    (schema)
3. UNKNOWN_MANUSCRIPT
4. SECTION_NOT_FOUND
5. HUMAN_ONLY / REQUIRES_HUMAN     <-- before ordering and before committed
6. ALREADY_COMMITTED
7. OUT_OF_ORDER        (P1, then P2)
8. handler-specific    (QUOTE_TOO_SHORT, INVALID_CRITERION, EVIDENCE_NOT_FOUND)
```

---

## 6. `src/tools/next-action.js`

Every return, accepted or refused, carries `next_expected_action`. It is advisory, not enforced, and
it turns an ordering constraint into guidance instead of a wall.

```js
// NextAction = { actor: "agent"|"human", tool: string|null, args: object, why: string }
export function nextAction(state, manuscriptId) {
  if (!manuscriptId) {
    const next = MANUSCRIPT_IDS.find((id) => !committedFor(state, id));
    return next
      ? { actor: "agent", tool: "read_manuscript", args: { manuscript_id: next },
          why: "This is the first manuscript in the queue with no committed recommendation." }
      : { actor: "human", tool: null, args: {},
          why: "Every manuscript in the queue has a committed recommendation." };
  }
  if (committedFor(state, manuscriptId)) {
    const next = MANUSCRIPT_IDS.find((id) => !committedFor(state, id));
    return next
      ? { actor: "agent", tool: "read_manuscript", args: { manuscript_id: next },
          why: "This manuscript is committed and frozen. Move to the next one." }
      : { actor: "human", tool: null, args: {}, why: "The queue is complete." };
  }
  if (!hasRead(state, manuscriptId)) {
    return { actor: "agent", tool: "read_manuscript", args: { manuscript_id: manuscriptId },
             why: "You have not been handed this manuscript yet." };
  }
  // Every manuscript has all four criteria scored at all times, so "missing" means "no accepted
  // finding cites it yet", which is a fact about the ledger.
  const covered = new Set(
    deriveFindings(state)
      .filter((f) => f.manuscript_id === manuscriptId && f.status === "active")
      .map((f) => f.criterion)
  );
  const missing = CRITERIA.filter((c) => !covered.has(c));
  if (missing.length) {
    return { actor: "agent", tool: "assert_finding",
             args: { manuscript_id: manuscriptId, criterion: missing[0] },
             why: "This criterion has no evidence-backed finding yet." };
  }
  return { actor: "human", tool: null, args: { manuscript_id: manuscriptId },
           why: "All four criteria are covered. The recommendation is the human reviewer's to make." };
}
```

Constants it imports from `src/core/constants.js`:

```js
SECTION_IDS   = ["abstract","introduction","related_work","methods","results","discussion","limitations","data_availability"]
CRITERIA      = ["novelty","rigor","clarity","reproducibility"]
MANUSCRIPT_IDS= ["MS-101","MS-102","MS-103","MS-104","MS-105","MS-106","MS-107","MS-108","MS-109","MS-110","MS-111","MS-112"]
```

`SECTION_IDS` is the set of **legal** ids, not the set every manuscript carries. `related_work`,
`limitations` and `data_availability` are per-manuscript. There is no `title` section id.

---

## Definition of Done (part 2)

**Output paths:** `C:\dev\referee\src\tools\envelope.js`, `C:\dev\referee\src\core\bus.js`,
`C:\dev\referee\src\tools\next-action.js`. Nothing else.

Before moving to `04-2`, observe and state each of these:

- All three modules parse; exports resolve: `CODES`, `ok`, `refuse`, `serialize`,
  `visibleFieldsFor`, `committedFor`, `summarize`, `nowISO`, `nextCallId`, `bus`, `nextAction`.
- `Object.keys(CODES)` printed and compared against §2 — eleven codes, exact spellings. Paste it.
- A grep of `envelope.js` for `state.unblinded` returns **zero hits**. State this explicitly; it is
  the single line whose change silently converts structural blinding into masking.
- `serialize({ok:false})` returns a `string`, confirmed with `typeof`. Paste the result.
- `refuse(...)` with no `retry` argument still produces a `retry` object with `possible:false`,
  `how:null`, `with:{}` — paste one.
- `nextAction` exercised on four states (no manuscript, unread manuscript, partially covered, fully
  covered) with the four returned objects pasted in.
- Any cross-slice module you had to stub is named, with what you stubbed.
