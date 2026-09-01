# Referee — 01 · Feature Spec and Cut Line

> Slice owner: feature spec + cut line. This file does **not** define the data model,
> tool schemas, UI layout, or schedule — those are owned by sibling scope documents.
> Everything here is at the level of *what it does* and *what counts as done*.
>
> **Thesis (verbatim, never reworded):**
> "When a page mediates between an agent and untrusted content, it can enforce things the
> agent cannot enforce for itself: what it may see, what it may claim, and what it may decide."

---

## 1. Product definition

Referee is a static, backend-free double-blind peer-review room in which a human reviewer and a
browser-resident AI agent work the same queue of twelve fictional manuscripts. The agent reaches
the manuscripts only through seven WebMCP tools the page registers, and the page — not a system
prompt, not the agent's own restraint — is the enforcement boundary: author identity is
structurally absent from every tool return rather than redacted from it, a finding is refused
unless its evidence quote verifies against the manuscript's public source text, and the
recommendation is a control only a human hand can operate. Three seeded manuscripts carry authored
prompt-injection payloads; the page neutralizes them while assembling the tool return and then
shows the human a split-screen of what the page received against what the agent received. Every
tool call and every human action, accepted or refused, lands in an append-only session ledger, so
at the end of a review the reviewer can read back exactly what the agent was allowed to see,
claim, and decide — and what it tried to do and was stopped from doing.

**Primary user — named:** a peer reviewer serving on a program committee or journal editorial
board, working a queue under deadline, who wants AI help reading and scoring manuscripts without
surrendering blinding, evidentiary discipline, or the verdict.

**Secondary audiences, in priority order:**
1. **WebMCP Challenge judges** — they need the architectural claim legible inside three minutes.
2. **Agent and platform engineers** evaluating the page-as-boundary pattern for their own surfaces.
3. **Program chairs and editors** as the governance buyer: the ledger is the audit artifact.
4. **AI safety and trust-and-safety practitioners** reading it as an injection-containment demo.

---

## 2. User-visible feature list

| # | Feature | One-line description |
|---|---|---|
| F1 | **Review queue** | Twelve fictional manuscripts, live-ranked by composite rubric score, each showing title, status, finding count, and blinding state. |
| F2 | **Manuscript reader** | Human-side reading pane showing title, abstract, sections, and figures — the same public corpus the agent's tools draw from. |
| F3 | **Blinded-fields indicator** | A persistent chip on every manuscript naming all nine fields withheld from the agent, sourced from the same `BLINDED_FIELD_NAMES` constant the tool returns carry. |
| F4 | **Findings board** | Accepted findings grouped by rubric criterion, each showing its verified quote with the matched span highlighted in the section it came from. |
| F5 | **Refusal log** | Every refused agent claim with its structured code and reason, sitting beside the accepted findings so the gate's work is visible rather than inferred. |
| F6 | **Integrity split-screen** | Side-by-side view of the raw seeded text the page received against the sanitized text the agent received, with each neutralized injection attempt marked in place. |
| F7 | **Rubric panel** | Four criteria with human-adjustable weights; moving a weight re-scores and re-ranks the queue synchronously. |
| F8 | **Unblind control** | Human-only reveal of a manuscript's identity record, gated behind a typed reason, recorded in the ledger. |
| F9 | **Off-paper evidence entry** | Human-only note capturing knowledge the manuscript does not contain, permanently labeled human-authored and unverified. |
| F10 | **Recommendation commit** | Human-only verdict control — accept / minor revision / major revision / reject — with a required rationale, one commit per manuscript. |
| F11 | **Editor flag list** | Flags the agent raised via `flag_for_editor`, shown as routed concerns that carry no scoring weight and decide nothing. Each row shows its **`concern_type`** — `03` §4.6's six-value enum (`prompt_injection`, `identity_leak_attempt`, `ethics`, `methodology`, `plagiarism_suspicion`, `other`), which is the executed `inputSchema` gate. The field is not named `category` and `suspected_prompt_injection` is not a value. |
| F12 | **Session ledger view** | The append-only record of every tool call and human action, showing actor, outcome, and what was visible at the time. |
| F13 | **About panel** | The thesis, the honesty boundary, and the fictional-corpus notice, reachable from every screen. |
| F14 | **Environment status chip** | Reports whether WebMCP was detected and how many tools registered, so a judge on the wrong browser knows immediately. |
| F15 | **Reset** | One control that discards session state and restores the seeded corpus. |

---

## 3. Locked product decisions (load-bearing, do not re-litigate)

These are spec-level, not schema-level. The data-model slice implements them.

- **P1. Recommendation values are exactly four:** `accept`, `minor_revision`, `major_revision`,
  `reject`. A rationale string is required. Commit is one-way per manuscript within a session;
  changing it requires reset.
- **P2. A finding carries a rubric criterion and a signed severity.** This is what makes
  re-ranking mean anything. A manuscript's composite score is a deterministic weighted sum over the
  four criteria; criterion scores derive only from accepted findings on that criterion.
- **P3. Ranking is deterministic.** Same findings plus same weights produce the same order every
  time; ties break on a stable manuscript key, never on insertion order or object iteration order.
- **P4. Unblinding is a human-side reveal only.** It changes nothing the agent can see. No tool
  return, before or after an unblind, differs by one byte because of it. This is the strongest form
  of the "what it may see" claim and it is not negotiable for a demo beat.
- **P5. Off-paper evidence never appears in any tool return.** It is human-authored text that could
  carry identity the human just unblinded; the cheapest way to honor the oracle-leakage rule is to
  keep it entirely on the human side. Human-only, ledgered, never served.
- **P6. `flag_for_editor` routes a concern and moves no score.** It is the agent's pressure-relief
  valve, so a blocked claim has somewhere to go other than a fabricated finding.
- **P7. Refusals are informative to the human, opaque to the agent.** The refusal log may show the
  human the full reason; the agent's payload carries only the structured code and a fixed,
  non-differential message.

---

## 4. Acceptance criteria

Falsifiable pass conditions, one block per MUST-HAVE in seam 11. Each is observable by Codex on
the deployed URL. `AC-n` ids are stable — other scope documents may cite them.

### The seven tools

- **AC-1** On page load in Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled,
  enumerating the registered tool names yields exactly seven, matching this set with no additions,
  no omissions, and no renames: `get_review_state`, `read_manuscript`, `assert_finding`,
  `check_claim`, `request_unblind`, `flag_for_editor`, `submit_recommendation`.
- **AC-2** The same seven appear in the ChatGPT desktop in-app browser on the same deployed URL,
  and the environment status chip (F14) reads "WebMCP detected · 7 tools" in both browsers.
- **AC-3** Every one of the seven returns a **JSON string that parses to a structured object**, for
  both a valid and an invalid call, and no tool throws an uncaught exception into the agent.
  Observable: `JSON.parse(await execute(...))` succeeds and yields an object carrying `ok`, for
  every tool, on both a valid and a deliberately-invalid call.

  This criterion used to end "and no tool returns a bare string," which `00` §D1 refutes: every tool
  returns exactly a bare string, by lock — `return JSON.stringify(payload)`, chosen because the
  return type is under-specified and a string survives a boundary an object may not. `00` is
  authoritative, so the criterion was the thing that was wrong. **A falsifiable acceptance criterion
  that the locked design already falsifies is worse than no criterion**: it fails on a correct
  build, and whoever runs it learns to ignore the list.

### Structural blinding

- **AC-4** Calling `read_manuscript` on all twelve manuscripts and searching the concatenated
  returns for any author name, affiliation, funder, acknowledgement string, or identity link
  present in the identity store yields zero matches.
- **AC-5** Every payload from `get_review_state` and `read_manuscript` carries `BLINDED_FIELD_NAMES`
  — `02` §1.9.1's frozen array of **nine** names — byte-identically, on every manuscript, and the F3
  chip renders all nine. Observable: collect the array from all twelve manuscripts across both
  tools; every copy is deep-equal to every other and to the constant, and the chip's rendered list
  matches. Four different arrays existed before this pass (nine, five, three, and a bare "3
  fields"), which would have made the on-screen chip disagree with the payload it claims to mirror.
- **AC-6** `scripts/check-blinding.mjs` exits 0. It walks **every file under `src/` except
  `src/ui/`** — not a named list of directories — and proves that none of them imports, references,
  or transitively reaches `manuscripts.identity.js` or `data/identity-access.js`, that none contains
  a dynamic `import(`, and that exactly one file in the tree imports identity, at
  `src/ui/identity-panel.js`. This is a build-time check, not a runtime one: the claim is
  *structural*, so the proof must be structural.

  **The exclusion is the point.** The guard named `src/tools/` and `src/core/` until this pass, and
  the build also has `src/adversarial/` (the sanitizer and the verifier) and `src/tools/handlers/`.
  It walked a directory set the build does not fully use, so it **passed vacuously** — the strongest
  claim in the submission, proved against files that were not there. A guard defined by exclusion
  cannot be outrun by a directory somebody adds on day two. Full rule: `02` §2.4.
- **AC-7** After a human unblind on manuscript M, a byte-for-byte comparison of `read_manuscript(M)`
  before and after the unblind is identical (P4). Repeat for `get_review_state`.

### The evidence gate

- **AC-8** `assert_finding` with a quote copied verbatim from the named section is accepted, and the
  finding appears on the findings board (F4) with the matched span highlighted in that section.
- **AC-9** `assert_finding` with a fabricated quote is refused with code `EVIDENCE_NOT_FOUND`,
  creates no finding, and moves no score.
- **AC-10** `assert_finding` with a real quote attributed to the *wrong* section is refused with
  `EVIDENCE_NOT_FOUND` — the section binding is enforced, not decorative.
- **AC-11** A quote differing from source only by curly quotes, en/em dashes, non-breaking spaces,
  doubled whitespace, letter case, **or an embedded zero-width character** is **accepted** —
  normalization works. The zero-width case is not optional padding on this list: `04` §3.1 strips
  format characters *before* pattern matching, and `04` §2 says that strip is the only reason FX-1's
  zero-width-split trigger word is caught at all. A normalization list that omits it describes a
  different pipeline.
- **AC-12** A quote shorter than 40 characters post-normalization is refused with
  **`QUOTE_TOO_SHORT`**, a code distinguishable from `EVIDENCE_NOT_FOUND` so the human can tell the
  two apart in F5. That spelling is `03` §1.3's frozen set; `EVIDENCE_TOO_SHORT` was `04`'s and is
  dead.
- **AC-13** A quote with one or two words dropped mid-span, scoring at or above 0.92
  token-subsequence similarity, is accepted via the fuzzy path and marked as a fuzzy match on the
  findings board; a paraphrase scoring below the threshold is refused. The badge reads
  `FUZZY MATCH · 0.96` from `verification.method` and `verification.score` on the accepted return
  (`03` §4.3), beside the `VERIFIED QUOTE` badge rather than replacing it. **No file specified that
  badge** — `05` §7.4 describes the accepted-finding treatment and never distinguishes exact from
  fuzzy — so it is specified here, in the criterion that requires it.
- **AC-14** Refusal payloads for AC-9, AC-10, and AC-12 contain no manuscript text beyond what the
  agent already supplied, no count derived from any blinded field (seam 6), **and no similarity
  score**. `04` §6 rules that a score on a miss is a hill-climbing gradient toward an accepted
  fabrication, and `04` §4's `verifyQuote` therefore does not compute one on failure, so there is
  nothing for a handler to echo. `03`'s refusal example previously carried `best_similarity: 0.71`;
  two owners had written opposite rulings on the same oracle seam, and the implementation settled
  it.

### Injection neutralize plus split-screen

- **AC-15** For each of the three seeded manuscripts, `read_manuscript` returns text in which the
  authored payload's imperative content is neutralized, and `integrity.injection_attempts` is a
  positive integer with `sections_affected` naming the correct sections. Exact expected values, from
  `02` §6.1 and `04` §7.3: **MS-102 → 2, `['abstract','discussion']`**; MS-107 → 1,
  `['related_work']`; MS-110 → 1, `['data_availability']`. Three manuscripts, four payload instances
  — MS-102 carries two because `05` §11.2 needs two marks in one frame.
- **AC-16** For the nine clean manuscripts, `integrity.injection_attempts` is `0` and
  `sections_affected` is empty — the detector is not firing on everything. **Two of those nine carry
  near-miss decoys** (MS-106 / `data_availability`, MS-109 / `related_work`), and they are the ones
  that make this criterion falsifiable: a detector that flags on vocabulary rather than on structure
  fails here and passes AC-15, which is why the decoys sit on manuscripts this criterion calls
  clean.
- **AC-17** No tool return, across all twelve manuscripts and all seven tools, contains the raw
  payload text. Searching every return for the payload's distinctive marker string yields zero
  matches.
- **AC-18** The split-screen (F6) for a seeded manuscript shows the raw payload on the page side and
  the neutralized text on the agent side, with each attempt marked in place.
- **AC-19** Sanitization is observable at return-assembly time, not render time: a tool called with
  no UI mounted still returns cleaned text and a populated `integrity` block.

### The ledger

- **AC-20** Every one of the seven tools, called once each, produces exactly one ledger entry per
  call — including the calls that were refused.
- **AC-21** Each entry carries `actor` (`"agent"` or `"human"`), a timestamp, the outcome, and
  `visible_fields_at_time`.
- **AC-22** Each of the four human-only moves (§5) appends an entry with `actor:"human"` and an
  `action` drawn from `02` §1.9's closed five-verb list: `set_weights | unblind | add_note |
  commit_recommendation | session_reset`. The four moves map to `unblind`, `add_note`,
  `set_weights`, `commit_recommendation`. Three vocabularies existed before this pass; a ledger with
  three names for one move is not an audit artifact. `set_score` was a sixth declared verb with no
  writer — no tool writes a score (`02` §1.6) — and is dead.
- **AC-23** No code path mutates or deletes an existing ledger entry within a session; entry ids are
  strictly increasing. Only reset clears it.
- **AC-24** The ledger view (F12) renders in call order and copies to the clipboard as text — a
  judge must be able to lift the evidence out of the demo.

### Human-only commit

- **AC-25** An agent call to `submit_recommendation` returns `{ok:false, code:"REQUIRES_HUMAN"}`,
  commits nothing, and appends a ledger entry with `actor:"agent"`.
- **AC-26** An agent call to `request_unblind` returns `{ok:false, code:"HUMAN_ONLY"}`, reveals
  nothing, and appends a ledger entry with `actor:"agent"`.
- **AC-27** Clicking the human commit control, with a verdict chosen from the four and a rationale
  supplied, sets `committed` in persisted state, locks the control, and appends `actor:"human"`.
- **AC-28** After commit, `get_review_state` reports that manuscript as committed — the agent learns
  the outcome, it never authors it.

### Live re-ranking

- **AC-29** Moving a rubric weight slider re-orders the queue (F1) within the same frame, with no
  reload and no explicit recompute button.
- **AC-30** Restoring a weight to its prior value restores the exact prior order (P3).
- **AC-31** Setting one criterion's weight to zero removes that criterion's contribution from every
  composite score, verifiable against a hand-computed value for at least one manuscript.
- **AC-32** Weights survive reload: changing weights, refreshing, and reading the queue shows the
  adjusted order restored from `referee.state.v1`.

### Reset

- **AC-33** Reset clears `referee.state.v1`, empties the ledger and findings, restores default
  weights, discards commits and unblinds, and restores all twelve seeded manuscripts.
- **AC-34** After reset, the corpus is byte-identical to first load — proof the corpus lives in the
  static module and was never round-tripped through localStorage (seam 7).
- **AC-35** Reset requires one confirmation step. A judge must not wipe a live demo by misclick.

### Cross-cutting (load-bearing additions)

- **AC-36** Every manuscript is visibly labeled fictional in the reader and in the queue (seam 12).
- **AC-37** The About panel (F13), the README, and the Devpost description all carry the honesty
  boundary **byte-identically**, and all three match `04-adversarial-layer.md` §8, which is the
  single canonical text. Observable: `diff` the three against §8; three empty diffs. And nowhere in
  the app, repo, or submission text does any string claim prompt injection is solved, prevented, or
  blocked in general (seam 10).

  **There were four non-identical wordings**, two of them separately marked verbatim-mandatory by
  their own owners, which is exactly the drift this criterion exists to catch — arriving in the
  criterion's own subject matter. `04` §8 is canonical because it is the fullest and most careful of
  the four; every other file now references it rather than restating it, including §7 below. `01`
  §6 calls this "the one failure that cannot be fixed after judging starts," so the check is a
  `diff`, not a reading.
- **AC-38** With the network panel open, a full review session — load, read all twelve, assert,
  refuse, unblind, commit, reset — issues zero requests beyond the initial static assets.
- **AC-39** Task 0 environment verification is recorded: a dated note in the repo naming both
  browsers, their versions, the deployed URL tested, and the observed tool count (seam 13).

---

## 5. The four human-only moves, as UI affordances

Each is a control with no tool-callable equivalent. Each writes to the ledger with `actor:"human"`.

1. **Unblind with reason.** A control on the manuscript header, disabled until the reviewer types a
   free-text reason of at least a few words. Confirming reveals the identity record on the human
   side only, marks the manuscript permanently unblinded for the session, and appends a ledger
   entry carrying the reason verbatim. The agent's surface does not change (P4). The reviewer's own
   moment of bias is dated and on the record — that is the point of the affordance.
2. **Add off-paper evidence.** A note control on the findings board, always labeled "human-authored
   · not verified against source · not shared with the agent." It sits in the findings column
   visually distinct from verified findings and never enters a tool return (P5).
3. **Retune rubric weights.** Four sliders in the rubric panel, each with a numeric readout. Moving
   one re-scores and re-ranks synchronously (AC-29). Weights persist, and are ledgered once per
   settle rather than once per pixel of drag.
4. **Commit the recommendation.** A four-way verdict control plus required rationale, enabled only
   for the human. Committing locks the control for that manuscript, stamps the state, and appends
   the terminal ledger entry. This is the only control in the product that produces a decision.

---

## 6. The cut line

### MUST — the submission is not a submission without these

Seam 11 in full, plus the additions marked ✚ that are genuinely load-bearing.

- The seven tools, exact names, both browsers (AC-1 – AC-3).
- Structural blinding across two disjoint stores (AC-4 – AC-7).
- The evidence gate with normalization, the 40-character floor, and the fuzzy fallback
  (AC-8 – AC-14).
- Injection neutralization at return-assembly plus the human split-screen (AC-15 – AC-19).
- The append-only session ledger (AC-20 – AC-24).
- Human-only commit and human-only unblind, with ledgered agent attempts (AC-25 – AC-28).
- Live re-ranking on weight change (AC-29 – AC-32).
- Reset (AC-33 – AC-35).
- ✚ **The About panel carrying the honesty boundary** — seam 10 mandates it in-app, and without it
  the submission overclaims, which is the one failure that cannot be fixed after judging starts.
- ✚ **Fictional labeling on every manuscript** (seam 12, AC-36).
- ✚ **Environment status chip** — a judge who opens the URL in the wrong browser must see *why*
  nothing works within two seconds, not conclude the build is broken.
- ✚ **Ledger copy-to-clipboard** — the ledger is the evidence artifact, and unliftable evidence
  persuades nobody. One clipboard call, minutes of work.
- ✚ **Task 0 environment verification, blocking** (seam 13, AC-39).

### SHOULD — build only if every MUST criterion is green by end of Day 1

Ordered by value per hour. Stop the moment Day 2 morning arrives with MUST not green.

- **S1. In-app acceptance panel.** A "run checks" view that executes the machine-checkable subset of
  §4 in the live page and prints pass/fail. Turns the demo video into a proof and gives Codex a
  regression harness for Day 2.
- **S2. Injection payload variety.** The third seeded manuscript gets a structurally different
  attack — instruction hidden in a figure caption rather than body prose — so the split-screen
  shows two shapes rather than one repeated.
- **S3. Refusal-reason detail in F5.** Human-side explanation of which normalization step failed on
  a refused quote. The agent payload stays opaque (P7).
- **S4. Keyboard navigation** through the queue and the findings board.
- **S5. Ledger filter** by actor and by outcome.
- **S6. A trap-manuscript walkthrough** in the README — the exact prompt to give the agent that
  reproduces a refusal, so a judge can replay it without guessing.

### WON'T — named and refused, so Codex does not drift

Two working days. Each of these has been considered and declined. Do not build them, do not stub
them, do not leave TODOs for them.

- **W1. Any backend, database, account, login, or session sync.** Static only.
- **W2. Any network call or LLM call from the page.** Deterministic math, no exceptions (AC-38).
- **W3. Multi-reviewer collaboration, reviewer assignment, or discussion threads.**
- **W4. Real manuscripts, real PDFs, PDF parsing, file upload, or any user-supplied corpus.**
- **W5. A general injection detector, a scoring model for injection likelihood, or any claim of
  detection generality.** Authored fixtures only — this is the honesty boundary as a build rule.
- **W6. Serving off-paper evidence to the agent** (P5). Declined for oracle-leakage safety.
- **W7. Making the agent's visible surface change after unblind** (P4). Declined: it would weaken
  the central claim in exchange for realism nobody asked for.
- **W8. Editing, undo, or redaction of ledger entries.** Append-only means append-only.
- **W9. Editor-side workflow** — decision letters, editor login, or flag triage beyond F11's
  read-only list.
- **W10. Framework, bundler, TypeScript compile step, npm install, or CSS library.** Vanilla ES
  modules; a build step is a deploy risk on a two-day clock.
- **W11. Mobile-responsive layout below tablet width.** Judges use desktop, and the split-screen
  needs the pixels.
- **W12. Theming, dark mode, animation systems, or icon libraries.**
- **W13. Additional tools beyond the seven,** including "helpful" read-only ones. Seven is the spec.
- **W14. Cross-session history, analytics, telemetry, or export formats beyond clipboard text.**
- **W15. i18n, accessibility beyond semantic HTML and sane focus order, or browser support beyond
  the two named targets.**
- **W16. A tour, onboarding flow, or tutorial overlay.** The About panel and the README carry it.

---

## 7. Non-goals and the honesty boundary as a product constraint

**Non-goals.** Referee is not a peer-review management system, not a manuscript-quality classifier,
not a plagiarism or misconduct detector, not a general prompt-injection filter, and not a product
that claims to improve review outcomes. It makes no claim that the agent's findings are correct —
only that every accepted finding is anchored to text that provably exists in the manuscript it
cites. Score and rank are bookkeeping over the human's own weights and the agent's verified
findings; they are not a judgment of research quality, and the UI must never present them as one.

**The honesty boundary lives in one place: `04-adversarial-layer.md` §8.** It is pasted verbatim
into the README, the Devpost description, and the in-app About panel, and it is not restated here —
this paragraph used to carry a fourth wording of it, marked verbatim-mandatory, alongside `04`'s own
verbatim-mandatory version and two more in `07`. Four texts, each authoritative in its own file, is
how AC-37 fails without anyone noticing.

`05` §10.1 had the right instinct already: it reserves the About drawer's section, heading and
styling behind the mount point `{{HONESTY_BOUNDARY}}` and declines to author the words. Every
surface does that now.

As a build constraint this means no copy anywhere in the app, repo, or submission may use
"prevents", "blocks", "stops", or "solves" about prompt injection in general. The permitted verbs
are "neutralizes the seeded payloads", "shows where the boundary sits", and "makes the enforcement
point inspectable." AC-37 is the check.

---

## 8. Definition of done — the whole submission

Done when all nine hold. Any one failing means not done, regardless of how good the code is.

1. **Live URL** on Vercel or Netlify, loading from a cold cache, with all seven tools registering.
2. **Verified in both target environments** on that deployed URL — ChatGPT desktop in-app browser
   and Chrome 149+ with the WebMCP testing flag — with versions and date recorded in the repo
   (AC-39). This was Task 0, and it is also the last gate.
3. **All MUST acceptance criteria in §4 pass**, checked against the deployed URL, not localhost.
4. **Public GitHub repo, Apache-2.0**, LICENSE file present, no secrets, no `node_modules`, no build
   step required to run it.
5. **README** carrying the thesis verbatim, the honesty boundary verbatim, the seven tools with
   one-line descriptions, the two-browser setup steps, and a reproducible walkthrough of one
   refusal and one injection split-screen.
6. **Demo video** under the Devpost limit, showing in order: the seven tools registering; the agent
   reading a manuscript and receiving no identity; a refused fabricated finding; the injection
   split-screen; the human retuning weights and the queue re-ranking; the agent's blocked
   `submit_recommendation`; the human committing; the ledger read back.
7. **Devpost description** with the thesis verbatim, the honesty boundary verbatim, the live URL,
   and the repo link, written to the four judging criteria — WebMCP Leverage, Execution, Potential
   Impact, Creativity & Ambition.
8. **A cold-load reset works** — a judge landing on a demo someone else left mid-session reaches a
   clean state in one click plus one confirm.
9. **No overclaim anywhere.** One final pass across app copy, README, and Devpost text against
   AC-37 before submission.

---

## CONTESTED

Implemented exactly as locked. Recorded here only so the record shows these were seen, not missed.

- **Seam 3, the 40-character minimum.** It will refuse legitimately decisive short evidence — a
  reported statistic, a sample size, a one-clause overclaim. In a real review those are often the
  quotes that matter most. The floor is defensible as anti-gaming (a six-character quote matches
  everywhere), but 40 is high; roughly 24 would keep the anti-gaming property without refusing real
  evidence. Built at 40 as specified. If AC-12 demos awkwardly, this is the first knob to turn, and
  it is a one-constant change.
- **Seam 5, two codes for one concept.** `REQUIRES_HUMAN` and `HUMAN_ONLY` name the same rule from
  two directions. It leaks nothing — seam 6 governs blinded fields, and neither code touches one —
  so the cost is cosmetic. But a judge reading the ledger sees two vocabularies for one boundary,
  which reads as drift rather than design. Built as specified.

  **The predicted failure then happened, which is the strongest argument for keeping the note.**
  `03` independently flagged the same risk, and `05` went on to write both codes backwards in four
  places — including the two refusals `05` §11.3 puts on camera and the one `05` §6.4 calls the
  closing shot. Corrected 2026-09-01 against `03` §1.3. The codes stay as locked; what this note now
  records is that a cosmetic-severity ambiguity cost four defects in one file, and that a note
  predicting a defect is not the same as a check preventing one.

---

## RECONCILED 2026-09-01

Single-writer reconciliation pass against `99-verification.md`. Rulings applied in this file:

- **R8 · AC-3 rewritten.** It required that "no tool returns a bare string" while `00` §D1 locks
  every tool to returning exactly that. `00` wins; the criterion now tests that the returned string
  parses to a structured object. A criterion the locked design falsifies fails on a correct build.
- **R13 · AC-6 aligned to the real file layout.** The guard walks everything under `src/` except
  `src/ui/`, rather than the two directories it named — which did not include `src/adversarial/` or
  `src/tools/handlers/`, so the structural-blinding proof passed vacuously.
- **R14 · AC-37 and §7.** `04` §8 is the single canonical honesty text. §7's fourth wording is
  deleted and replaced by a reference; AC-37 is now a `diff` of three surfaces against it.
- **R10 · the cut line holds.** AC-24 (ledger copy-to-clipboard) is a MUST and has been removed from
  `05` §13's cut list, where it was item 1. W11 stands: `05`'s two sub-tablet layouts are deleted,
  not deferred.

Chased through from the seams that moved: AC-5 now names `02`'s nine-name constant (four different
arrays existed); AC-11 includes the format-character strip the detector depends on; AC-12 names
`QUOTE_TOO_SHORT`; AC-14 also forbids a similarity score on refusal; AC-15/AC-16 carry the exact
per-manuscript expected values, including MS-102's two payload instances and the two decoy
manuscripts; AC-22 binds the human `action` verbs to `02`'s closed list; AC-13 specifies the fuzzy
badge, which no file owned.

**Escalated, not decided: AC-4 mandates what `02` §2.5 forbids.** Both texts are left exactly as
their owners wrote them. The conflict and a one-line recommendation are in the reconciliation
report.
