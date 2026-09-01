# 04-7 — `request_unblind` and `submit_recommendation`, the two human-only refusals (slice C6, part 8 of 9)

**Deliverables:** `src/tools/handlers/request-unblind.js`,
`src/tools/handlers/submit-recommendation.js`, and their two entries in `TOOL_SPECS`.

Read `00-START-HERE.md`, `04-0-contracts.md`, `04-1-envelopes-and-ordering.md` and `04-2-define-tool.md`
first. Read nothing else.

**Neither of these tools ever succeeds, and that is the product.** They exist so the boundary is
visible rather than implicit. Both are `humanOnly: true`, which the wrapper checks *before* ordering
and *before* commit state, so a human-only refusal always outranks any other reason.

**The two codes are not interchangeable and have been written backwards four times.**
`HUMAN_ONLY` belongs to `request_unblind`: the *visibility change* is the human's. `REQUIRES_HUMAN`
belongs to `submit_recommendation`: the *decision* is the human's. Check the mapping before you write
either one.

Same handler rules as every other tool: synchronous, return `{payload}` or `{refusal}`, never a
string, never touch the ledger, state, serializer, or bus. **Transcribe both `description` strings
verbatim.**

---

## 1. `request_unblind`

```js
// entry 5 of TOOL_SPECS
defineTool({
  name: "request_unblind",
  description:
    "Ask the human reviewer to unblind a manuscript's author identity. This call will not " +
    "succeed — it cannot. Unblinding is a human action taken in the page, and even after the " +
    "human unblinds, no tool return will ever contain author information, including this one: " +
    "the identity fields live in a store the tool layer holds no reference to. Call this only " +
    "when you have a substantive reason the human should see identity, such as a suspected " +
    "undisclosed conflict of interest your reading of the public text supports, and put that " +
    "reason in `reason`. The call is refused with HUMAN_ONLY and recorded in the review ledger " +
    "where the human will see it alongside your reason. Treat the refusal as the expected " +
    "outcome and continue reviewing the public text.",
  inputSchema: {
    type: "object",
    properties: {
      manuscript_id: { type: "string", enum: [...MANUSCRIPT_IDS] },
      reason: {
        type: "string", minLength: 20, maxLength: 800,
        description: "Why the human should consider unblinding. Substantive, grounded in the public text."
      },
      urgency: { type: "string", enum: ["routine", "conflict_suspected"] }
    },
    required: ["manuscript_id", "reason"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: false },
  humanOnly: true, requiresRead: false, requiresSection: false, blockedByCommit: false,
  handler: requestUnblindHandler
})
```

`readOnlyHint: true` is the honest annotation: the call changes no review state. It appends a ledger
row, which every call does — logging is not a state mutation the agent is authoring.

**There is no success return.** The only outcome is:

```json
{
  "ok": false, "tool": "request_unblind", "code": "HUMAN_ONLY",
  "message": "Unblinding is a human action. This request has been recorded for the reviewer.",
  "retry": {
    "possible": false,
    "how": "Continue reviewing the public text. Tell the human reviewer why you raised this; they decide.",
    "with": {
      "manuscript_id": "MS-105",
      "recorded_in_ledger": true,
      "ledger_seq": 42,
      "reviewer_notified": true,
      "identity_reachable_by_tools": false,
      "note": "Author identity is held in a store the tool layer holds no reference to. Unblinding changes the human view only; no tool return contains identity before or after."
    }
  },
  "next_expected_action": {
    "actor": "human", "tool": null, "args": { "manuscript_id": "MS-105" },
    "why": "The human reviewer decides whether to unblind."
  }
}
```

**Oracle safety.** The payload is identical in shape whether or not the human has already unblinded
that manuscript, whether or not its identity fields are populated, and whichever manuscript is named.
`recorded_in_ledger`, `reviewer_notified` and `identity_reachable_by_tools` are constants.
`ledger_seq` is a monotonic counter over all calls, so it carries no per-manuscript signal.

**Idempotency:** every call is recorded; repeats are neither deduplicated nor refused differently. A
second request is a second row the human can see — deduplicating it would hide agent behavior from the
audit surface that exists to show it.

**The code here is `HUMAN_ONLY`, not `REQUIRES_HUMAN`.** These two have been written backwards four
times. `HUMAN_ONLY` = the *visibility change* belongs to the human.

---

## 2. `submit_recommendation`

```js
// entry 7 of TOOL_SPECS
defineTool({
  name: "submit_recommendation",
  description:
    "Do not call this expecting it to work. The final recommendation on a manuscript is the " +
    "human reviewer's decision and cannot be made through the tool layer — this call always " +
    "returns REQUIRES_HUMAN, and the attempt is recorded in the review ledger. It exists so " +
    "the boundary is visible rather than implicit. What to do instead: when get_review_state " +
    "reports next_expected_action.actor as \"human\", stop calling tools and write the human a " +
    "short summary — your recommendation, the criterion scores, and the evidence-backed " +
    "findings behind each. The human enters the decision in the page. If you call this anyway, " +
    "put your intended recommendation in the arguments; the refusal hands it back to the human " +
    "as a proposal for them to accept, change, or ignore.",
  inputSchema: {
    type: "object",
    properties: {
      manuscript_id: { type: "string", enum: [...MANUSCRIPT_IDS] },
      recommendation: {
        type: "string",
        enum: ["accept", "minor_revision", "major_revision", "reject"]
      },
      rationale: {
        type: "string", minLength: 30, maxLength: 2000,
        description: "Your reasoning, grounded in findings you already asserted."
      },
      confidence: { type: "string", enum: ["low", "medium", "high"] }
    },
    required: ["manuscript_id", "recommendation", "rationale"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  humanOnly: true, requiresRead: false, requiresSection: false, blockedByCommit: false,
  handler: submitRecommendationHandler
})
```

The enum values are **singular**: `minor_revision`, `major_revision`. `minor_revisions` and
`major_revisions` are dead spellings. `readOnlyHint: false` is deliberate even though the call never
succeeds — the annotation describes what the tool is *for*, a state-changing decision, and declaring
it read-only would understate the boundary. The refusal, not the annotation, is what stops it.

**There is no success return.** The only outcome is:

```json
{
  "ok": false, "tool": "submit_recommendation", "code": "REQUIRES_HUMAN",
  "message": "The final recommendation is the human reviewer's decision and cannot be submitted by an agent.",
  "retry": {
    "possible": false,
    "how": "Stop here. Summarize your recommendation and the evidence for the human reviewer, who enters the decision in the page.",
    "with": {
      "manuscript_id": "MS-102",
      "proposal_recorded": true,
      "ledger_seq": 57,
      "proposed_recommendation": "major_revision",
      "criteria_covered": ["novelty","rigor","clarity","reproducibility"],
      "criteria_missing": [],
      "composite": 8.70,
      "rank": 1,
      "findings_supporting": ["f_3b91ce04","f_18d0aa7c","f_5510e2b9","f_ab74c130"],
      "decision_owner": "human"
    }
  },
  "next_expected_action": {
    "actor": "human", "tool": null, "args": { "manuscript_id": "MS-102" },
    "why": "All four criteria are covered. The recommendation is the human reviewer's to make."
  }
}
```

**`ALREADY_COMMITTED` is unreachable here, by design.** Human-only is checked before commit state, so a
call against an already-committed manuscript still returns `REQUIRES_HUMAN`. That is correct: the
reason the agent cannot do this never changes, and a differential answer would tell the agent
something about state it has no need to know.

**Idempotency:** every attempt is a distinct ledger row and a distinct proposal. Repeated attempts are
visible in the split-screen, which is the intended demonstration.

**The code here is `REQUIRES_HUMAN`, not `HUMAN_ONLY`.** `REQUIRES_HUMAN` = the *decision* belongs to
the human.

---

---

## Definition of Done (part 7)

**Output paths:** `request-unblind.js` and `submit-recommendation.js` under
`C:\dev
eferee\src	ools\handlers\`. Nothing else.

Before moving to `04-8`, observe and state each of these:

- Both handlers are synchronous, return `{refusal}`, and return no string. Neither has a success path.
- A grep of both for `appendLedger`, `saveState`, `serialize`, `bus.emit`, `state.unblinded`, and
  `identity` returns zero hits except the `identity_reachable_by_tools` constant. Paste it.
- `request_unblind` returns `code:"HUMAN_ONLY"` and `submit_recommendation` returns
  `code:"REQUIRES_HUMAN"`. **Paste both codes side by side and state that you confirmed they are not
  swapped.**
- Both refusals carry `retry.possible: false`.
- `request_unblind` called on a manuscript the human has already unblinded returns a payload
  identical, apart from `ledger_seq`, to the same call before the unblind. Paste both and diff them.
- `request_unblind` called on three different manuscripts returns three payloads differing only in
  `manuscript_id` and `ledger_seq`. Paste them.
- `submit_recommendation` on an already-committed manuscript still returns `REQUIRES_HUMAN`, never
  `ALREADY_COMMITTED`.
- `submit_recommendation` with `recommendation: "minor_revisions"` fails schema validation; with
  `"minor_revision"` it passes and still refuses with `REQUIRES_HUMAN`. The enum is singular.
- Both `description` strings are under 1024 characters. Report both lengths.
- Repeated identical calls to either tool are neither deduplicated nor refused differently. Confirm
  by calling each twice.
