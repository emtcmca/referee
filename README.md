# REFEREE — Build Direction

**Read this file completely before opening any other file in this repository.**

> **When a page mediates between an agent and untrusted content, it can enforce things the agent
> cannot enforce for itself: what it may see, what it may claim, and what it may decide.**

That sentence is the product. Every decision in this build serves it. If a change does not serve
it, the change is wrong even when the code is good.

---

## 1. What we are building

Referee is a double-blind academic peer-review room where a human reviewer and a browser-resident
AI agent review a queue of manuscripts together. The page, not the agent and not a system prompt,
is the boundary between the agent and untrusted content. It enforces three things:

| | The page enforces | How |
|---|---|---|
| **See** | Author identity is structurally absent from every tool return | Two disjoint stores; no tool handler can reach identity. Every return carries the same frozen nine-name `blinded_fields` array |
| **Claim** | A finding is refused unless its evidence quote verifies against the source text | `assert_finding` returns `EVIDENCE_NOT_FOUND` |
| **Decide** | The final recommendation is human-only | `submit_recommendation` returns `REQUIRES_HUMAN`; `request_unblind` returns `HUMAN_ONLY` |

Three of the twelve seeded manuscripts carry authored prompt-injection payloads — four payloads in
total, two of them on the same manuscript so the split-screen shows two marks rather than one. Two
further manuscripts carry near-miss passages that must **not** flag, which is the only way to tell
whether the detector discriminates or just matches vocabulary. The page neutralizes the payloads
before the agent receives any text, then shows the human, split-screen, what the page received
against what the agent received.

**Submission:** the OpenAI WebMCP Challenge on Devpost. Closes **2026-09-03, 1:00pm PT**.

---

## 2. Working model — who does what

| Role | Owns |
|---|---|
| **Eric** | All planning. The majority of the implementation. Every judgment call. The recording and the submission. |
| **Claude Code** | Planning, architecture, and implementation alongside Eric. |
| **Codex** | Review, and implementation of explicitly assigned slices. |

**Codex assignments are named in `scope/06-plan-and-risks.md` and nowhere else.** They are the
work that is well-specified, self-contained, and independently verifiable. As of `06` **revision 3**
there are **eight** slices, C1 through C8:

| | Slice | Hrs |
|---|---|---|
| **C1** | Seeded corpus prose, **host text only** — 12 fictional manuscripts to `02` §6.1's table. The four payload slots and two decoy slots stay **empty placeholders**; `04` §2 already authored that prose and `04` §7.3 measured it | 3.0 |
| **C2** | **Transcribe `04` §3's sanitizer** and re-run its measured test table. `{clean, events, attempts}` / `{id, sections, events, integrity}` — not a third interface | 1.5 |
| **C3** | **Transcribe `04` §4's evidence verifier** and `04` §3.1's **seven-step** normalizer, then re-run `04` §7.2's 14-row table | 1.5 |
| **C4** | README first draft from `01` and `07` | 0.5 |
| **C5** | Devpost description first draft from `07` — all four required points | 1.0 |
| **C6** | **The seven tool handlers**, to `03`'s frozen contracts through `defineTool()`. Critical path | 4.75 |
| **C7** | The review gate — the review pass. Read-only, findings cited to a criterion, no patches. Delivered by Sep 2 09:00 | 1.5 |
| **C8** | Mechanical sweep of AC-4 – AC-39 against the deployed build: pass / fail / not-checkable, each citing the criterion | 1.0 |

This list is a copy of `06`'s, kept here only because this file is read first. **`06` is the
source; if the two ever disagree, `06` is right and this table is stale.**

**C6 is the seven tool handlers.** An earlier revision of this table used `C6` for the mechanical AC
sweep — that slice is `C8` — and omitted `C7` and `C8` entirely. `C6` has exactly one meaning and it
is `06`'s.

Anything touching cross-cutting state or requiring a judgment call stays with Eric: the ledger, the
UI, and every demo-critical surface. **The seven tool handlers are Codex's (C6)** — that reallocation
is `06` rev 3's Change 1, and it is the reason the plan closes.

**Codex: do not implement outside your named assignments without asking first.** Two implementers
in the same files under a deadline is how a working build stops working.

---

## 3. Read the specs in this order

Order matters. Later sections assume the earlier ones.

| # | File | What it settles |
|---|---|---|
| 00 | `scope/00-api-reality.md` | The real WebMCP API surface, verified against Chrome's docs. **Authoritative — overrides any API shape assumed elsewhere.** |
| 01 | `scope/01-spec.md` | What it does, 39 acceptance criteria, the cut line |
| 02 | `scope/02-data-model.md` | Entities, the blinding construction, ranking math, the 12-manuscript corpus |
| 03 | `scope/03-tool-contracts.md` | The seven tools: schemas, returns, every refusal payload |
| 04 | `scope/04-adversarial-layer.md` | Threat model, injection fixtures, sanitizer, evidence verifier |
| 05 | `scope/05-ui-spec.md` | Layout, visual system, the four demo-critical surfaces |
| 06 | `scope/06-plan-and-risks.md` | Task plan, hour budget, critical path, checkpoints, risk register |
| 07 | `scope/07-submission-kit.md` | Video shot list, Devpost text, public README, judge testing script |

`design/direction-a.html` is the approved visual reference the interface was built against — a
single self-contained page carrying the palette, type scale, tonal ladder, motion values, and the
`REFUSED BY THE PAGE` stamp, with demo state hardcoded. It is the source of truth for how the
interface should look. `design/brief.md` is the brief it was built to. Two competing directions
and an earlier mockup were cut once this one was chosen; they are not in the tree.

---

## 4. Locked decisions — do not change these

These were resolved deliberately. Re-litigating them costs hours we do not have.

1. **Seven tools, these names:** `get_review_state`, `read_manuscript`, `assert_finding`,
   `check_claim`, `request_unblind`, `flag_for_editor`, `submit_recommendation`.
2. **Blinding is structural, not cosmetic.** Identity is *absent* from tool payloads, never
   masked or redacted in place. Enforced by the import graph, checked by
   `scripts/check-blinding.mjs`.
3. **Every `execute` returns `JSON.stringify(payload)`** — a string, never a bare object.
4. **Policy refusals are RETURNED, never THROWN.** Every handler body is wrapped so a genuine
   runtime exception becomes `{ok:false, code:"INTERNAL"}` rather than a raw throw.
5. **Evidence quotes: 40-character minimum**, after normalization, refused with `QUOTE_TOO_SHORT`.
   This will occasionally refuse a short decisive quote. That is a known, accepted tradeoff,
   documented in the public README, and not a bug to fix. Above the floor, verification normalizes
   both sides and then accepts an exact match or a token-subsequence match at 0.92 — it is not
   exact-match-only, and no surface may say it is.
6. **`untrustedContentHint: true`** on `read_manuscript` and `check_claim`, even though the page
   already sanitized the text. Belt and suspenders, and it is the honest declaration.
7. **No backend, no accounts, no network calls, no LLM calls from the page.** Vanilla ES modules,
   no bundler, no framework, no npm build step. Deterministic math throughout.
8. **The ledger is append-only** and records every tool call including refusals, plus every human
   action, with `actor` and `visible_fields_at_time`.
9. **One localStorage key:** `referee.state.v1`. The corpus is a static module, never in storage.
10. **`exposedTo` is not used.** Single origin. Cross-origin exposure is a security decision we
    are not making under deadline.

**If you believe a locked decision is wrong:** implement it as written, then add a short
`CONTESTED` note at the end of the file you are working in, stating the defect and the one-line
change that would fix it. Do not silently deviate. Do not stop work to argue.

---

## 5. Task 0 is blocking

Nothing else starts until this passes, on the **deployed production URL** and not localhost, in
**both** the ChatGPT desktop in-app browser and Chrome 149+ with
`chrome://flags/#enable-webmcp-testing`:

1. `document.modelContext` is present
2. `await registerTool(...)` resolves without throwing
3. The agent discovers and calls the tool
4. A returned JSON string arrives intact
5. **A returned `{ok:false}` refusal reaches the agent as a usable result, not swallowed as an error**
6. `annotations` are accepted without error

**Check 5 is its own go/no-go, and it is tested first, with a deliberately-failing call.** Our
refusals are the product. If refusals do not reach the agent as results in either environment,
the premise collapses, and it collapses silently, which is why it is checked before anything is
built on top of it.

Record all six outcomes, both browser versions, the date, and a screenshot in
`docs/environment-check.md`. That file doubles as evidence for judges that this runs where they
will test it.

---

## 6. Honesty rules — these bind every word we ship

They apply to code comments, the public README, the Devpost description, and the video narration.

- **Never claim prompt injection is solved.** Detection here runs against fixtures we authored.
  Detection quality is a separate, unsolved problem. The architectural claim is narrower and
  durable: that a boundary exists at all, and that it lives in the page rather than in the
  agent's instructions.
- **No invented metrics, benchmarks, adoption numbers, or endorsements.** None. There are no users
  and no measurements, and saying so plainly is stronger than implying otherwise.
- **Manuscripts are fictional** and are labeled as such in the interface.
- **A tool's success message is not evidence.** Assert the postcondition. After a deploy, query the
  deployed page. After a registration, call the tool. Paste what you saw. If you cannot produce
  the evidence, write UNVERIFIED, not "done."

A judge who catches one false claim discounts everything else in the submission. The honest
version of this project is genuinely strong. It does not need help.

---

## 7. What done looks like

- Live URL, no auth friction, working in both target browsers
- Public repo, Apache-2.0, license detectable in GitHub's About sidebar
- Genuine `document.modelContext.registerTool(...)` usage in the source
- Public YouTube video **under 3:00**, with audio, demonstrating the build and explaining the
  WebMCP implementation
- Devpost description covering all four required points
- Every `[FILL:]` placeholder in `scope/07-submission-kit.md` resolved
- All 39 acceptance criteria in `scope/01-spec.md` observably passing

Judging is four equally weighted criteria: WebMCP Leverage, Execution, Potential Impact,
Creativity & Ambition. **Judges may score on the video and description alone**, so treat every
surface as a frame in that video.

`[FILL: submission count and prize structure, from the Devpost rules page, if either is worth
stating. This file carried "roughly 500 submissions compete and the top 10 win" with no source.]`

---

## RECONCILED 2026-09-01

Single-writer reconciliation pass against `scope/99-verification.md`.

- **R9 · §2's Codex slice list** was four items against `06`'s six plus the review gate. Since this
  file also says the assignments live in `06` "and nowhere else," this file's list was the one that
  was wrong. Replaced with `06`'s, marked as a copy, with `06` named as the source.
- **R11 · unmeasured quantitative claims deleted.** "Roughly 500 submissions compete and the top 10
  win" had no source; it is now a `[FILL:]` against the rules page. The corresponding sweep of `07`
  removed an implied 12× speedup and two "70-year-old" claims.
- Chased through from the seams that moved: the enforcement table names the nine-name
  `blinded_fields` constant and both human-only codes; §1 states four payload instances on three
  manuscripts plus the two decoy manuscripts; locked decision 5 names `QUOTE_TOO_SHORT` and says
  plainly that verification is normalize-then-match with a 0.92 fuzzy fallback, because the earlier
  claim that it was exact-match sat inside `07`'s own honesty section.

The ten locked decisions are unchanged. Nothing in this pass re-litigated one.

---

## RECONCILED PASS 2 - 2026-09-01

Second pass, against `scope/99-verification-delta.md`.

- **D18 · §2's Codex table now matches `06` revision 3 exactly.** It described `06` **revision 2**,
  listed **six** slices plus a "Task 21" review gate, and disagreed with `06` on the identity of
  every one of them. **`C6` named two different jobs in the two files** — "the mechanical AC sweep"
  here, **the seven tool handlers** (4.75h, critical path) in `06`, which `06`'s dependency rows and
  its shed order both confirm. README's C6 was `06`'s C8; `C7` and `C8` were absent entirely; and
  `06`'s actual Task 21 is "Record. Budget 3 takes," owned by Eric, not a Codex slice. Codex reads
  this file first and this file's own rule is *do not implement outside your named assignments*.
- **D19 · the handlers no longer "stay with Eric."** §2 said *"Anything ... stays with Eric: the tool
  handlers, the ledger, the UI"* — a direct contradiction of `06` rev 3's Change 1, which moves the
  seven handlers to Codex and is the reason the three-day plan closes. The handlers are C6.
