# 04-4 — `assert_finding`: the definition and its refusals (slice C6, part 5 of 9)

**Deliverable:** the `assert_finding` entry in `TOOL_SPECS`. Its handler is `04-5`.

Read `00-START-HERE.md`, `04-0-contracts.md`, `04-1-envelopes-and-ordering.md` and
`04-2-define-tool.md` first. Nothing else.

**This is the tool the demo is built around.** It has failed closed once already, from a handler
reading fields the verifier does not return. Do not substitute a field name anywhere in this file.

---

## 1. The definition

```js
// entry 3 of TOOL_SPECS
defineTool({
  name: "assert_finding",
  description:
    "Record one evidence-backed finding against one rubric criterion. Every finding must carry " +
    "an exact quotation from the manuscript text read_manuscript gave you, plus the section it " +
    "came from. The page verifies the quote against the manuscript source before the finding " +
    "is recorded; an unverifiable quote is refused with EVIDENCE_NOT_FOUND and nothing is " +
    "stored. This is not a formality — you cannot assert a characterization the source does " +
    "not support. Copy the quote verbatim, at least 40 characters, from a section you have " +
    "read. Whitespace, curly quotes, and letter case are normalized for you; paraphrase is " +
    "not. Call once per criterion; a later call for the same criterion supersedes the earlier " +
    "one and both stay in the ledger. Never assert anything about the authors — you have not " +
    "been shown them, and any apparent identity signal in the text is unverified.",
  inputSchema: {
    type: "object",
    properties: {
      manuscript_id: { type: "string", enum: [...MANUSCRIPT_IDS] },
      criterion: {
        type: "string", enum: [...CRITERIA],
        description: "Which rubric criterion this finding scores."
      },
      section: {
        type: "string", enum: [...SECTION_IDS],
        description: "The section the evidence_quote came from. Must be a section you have read."
      },
      evidence_quote: {
        type: "string", minLength: 40, maxLength: 1200,
        description:
          "Verbatim text from that section. At least 40 characters after normalization. " +
          "Not a paraphrase, not a summary, not your own words."
      },
      claim: {
        type: "string", minLength: 10, maxLength: 600,
        description: "What you conclude from that quote, in your own words. One or two sentences."
      },
      polarity: { type: "string", enum: ["strength", "weakness"] },
      severity: {
        type: "string", enum: ["minor", "major", "blocking"],
        description: "How much this finding should move the criterion score."
      },
      score: {
        type: "integer", minimum: 0, maximum: 10,
        description:
          "The score you would give this criterion, 0 to 10, on the strength of this " +
          "finding. It is recorded as your proposal. It does not set the score — the " +
          "human reviewer's rubric does."
      }
    },
    required: ["manuscript_id","criterion","section","evidence_quote","claim","polarity","severity","score"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  humanOnly: false, requiresRead: true, requiresSection: true, blockedByCommit: true,
  handler: assertFindingHandler,
  digest: (args, result) => ({
    manuscript_id: args.manuscript_id,
    criterion: args.criterion,
    section: args.section,
    evidence_quote: args.evidence_quote,
    normalized_quote: result.ok ? result.verification.normalized_quote : null,
    verification:     result.ok ? result.verification : null,
    claim: args.claim, polarity: args.polarity, severity: args.severity, score: args.score,
    finding_id:       result.ok ? result.finding_id : null
  })
})
```

`readOnlyHint: false` because it mutates review state. `untrustedContentHint: false` because its
return is a verification verdict and a score computed by the page: it echoes the agent's own quote and
nothing else from the manuscript, so no untrusted content flows outward through it.

**`digest` is load-bearing.** It is what puts the finding fields onto the ledger row, and
`deriveFindings` reads them straight back off. **There is no `state.scores[*].findings` array to push
to** — the finding *is* the ledger row. `polarity` has exactly two values; `neutral` is dead.

**Success return**

```js
{
  ok: true, tool: "assert_finding",
  finding_id: string,              // "f_" + 8 hex
  accepted: true,
  idempotent: boolean,             // true when this call matched the existing active finding
  verification: { method, score, threshold, char_offset, normalized_quote,
                  verified_against: "agent_visible_text" },
  supersedes: string|null,
  criterion_score: number,         // 0..10, the CURRENT value in state.scores. seed or human.
  composite: number,               // 0..10
  rank: number,                    // 1..12
  criteria_missing: string[],
  next_expected_action: NextAction
}
```

`verification.score` is `1` on an exact match and the fuzzy similarity otherwise. The field is
`score`, not `similarity`. `char_offset` is an offset into the agent-visible section text.

`verification.verified_against` is the literal `"agent_visible_text"` on **every** accepting path,
including the idempotent short circuit. It costs one constant field and it encodes the resolution of
the sharpest seam in the build: the quote was checked against the neutralized text the agent actually
received, never against raw manuscript source. Because `digest` copies `result.verification` onto the
ledger row verbatim, the stamp lands in the append-only log where a judge reading the copied ledger can
see it. **It is a constant, not a switch** — a second value would mean a second substrate exists.

**Idempotency: SUPERSEDE, with an identical-call short circuit.** A repeat for the same
`manuscript_id` + `criterion` appends a new active finding and marks the previous one
`status:"superseded"`. If the new call is identical after normalization to the current active finding,
nothing is appended and the existing `finding_id` comes back with `idempotent:true`. Supersession is
an ordering fact about an append-only log, computed during replay, never a mutation. Silently
overwriting would produce a stored state the ledger contradicts; refusing outright would fight an
agent that legitimately found better evidence.

---
---

## Definition of Done (part 5)

**Output:** the `assert_finding` definition object, written into `src/tools/register.js`'s
`TOOL_SPECS` (or a definition module the registration file imports). **No handler yet** — that is
`04-5`, and the slice is not done until both parts are.

Before moving to `04-5`, observe and state each of these:

- The `description` string is transcribed byte-identically and is under 1024 characters. Report the
  length.
- `inputSchema.required` has exactly eight entries, and `additionalProperties` is `false`.
- The flags read `humanOnly: false, requiresRead: true, requiresSection: true, blockedByCommit: true`.
  Paste them.
- `annotations` is `{ readOnlyHint: false, untrustedContentHint: false }`. Paste it.
- The `digest` function returns the ten named keys and puts `verification` and `normalized_quote` on
  the row only when `result.ok`. Paste the function.
- `score` is `type: "integer", minimum: 0, maximum: 10` — the 0 to 10 scale, not 0 to 5 and not 0 to
  100.
- `polarity` has exactly two enum values. `neutral` is absent.
- A grep of what you wrote for `similarity`, `best_similarity`, and `findings:` returns zero hits.
