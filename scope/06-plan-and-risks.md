# 06 — Execution Plan & Risk Register

**Revision 3.** Three changes since rev 2: the seven tool handlers move to Codex; the UI task is
re-priced against a finished, rendered mockup; `runSimulation()` and Replay Mode are cut from both
`03` and `05`. Task 0's six checks (rev 2 §2) and Referee Minimum (§7) stand.

**Clock:** submission closes **2026-09-03 1:00pm PT = 4:00pm ET**. Hard stop **11:00am PT =
2:00pm ET** — a deliberate 2-hour buffer. Times are **ET**.

**Owner values:** `Eric` (judgment, verification, recording, the form — no code) · `Eric+Claude`
(Eric coding in Claude Code) · `Codex` (an assigned, independently verifiable slice).

---

## 0. The arithmetic, honestly

### 0.1 The baseline, and a correction I owe

Rev 2 stated Day 2 as "11.75h of 11.0." **That was an arithmetic slip. Re-added, rev 2's Day-2
tasks sum to 11.25h.** The coordinator's corrected baseline is right and reconciles exactly: rev 2
priced the UI (tasks 15–19) at 4.5h as "an unstyled semantic layout — no design pass," while `05` is
1,443 lines specifying a complete design system, and `99-verification` calls that the single largest
mismatch in the set. Replacing 4.5h with the corrected 10.0h gives **11.25 − 4.5 + 10.0 = 16.75h**.

**Baseline: Day 1 11.25 of 12.0 · Day 2 16.75 of 11.0 · Day 3 5.5 of 6.0 · three-day 33.5 of 29.0
— a 4.5h deficit.**

### 0.2 The three changes

**Change 1 — the seven handlers move to Codex.** `03` is ~115KB of frozen schemas, return shapes,
refusal payloads, and a `defineTool()` wrapper that makes ledger-append and serialization
structurally unskippable. Where the contract is that tight, implementation is closer to
transcription, and a second implementer parallelizes it at low coupling cost. **Off Eric: 4.75h**
(rev 2 tasks 7–12). **This is not free.** Two costs are added back, not netted out silently:
- **+0.75h** — Eric needs a handler integration and Checkpoint B verification slot. A handoff that
  nobody integrates is not a handoff.
- **+0.25h** — the review gate grows, because Eric now reciprocally checks the handlers against `03`
  at triage (§4).

**Change 2 — the UI re-price.** `C:\dev\referee\mockup\referee-mockup.html`, 110,609 bytes,
1,837 lines, one self-contained file with a single `<style>` and a single `<script>`. Built to `05`'s
palette, type scale, spacing and motion tokens, seeded with `02`'s corpus, rendered in Chrome and
driven through every flow. The FLIP re-ranking runs the real weighted-sum math and produces `02`'s
executed result; the rAF-suspension bug is already found and fixed.

The 10.0h figure priced "build a 1,443-line design system from a written spec." **That is no longer
the task.** But the remaining work is not zero, so I derived it line by line rather than accepting a
reduction:

| Port line item | Hrs |
|---|---|
| Split one file into ES modules (JS only — see the constraint below) | 1.00 |
| Replace seeded arrays with the real state module and corpus loader | 1.00 |
| Wire the event bus so handler returns drive the UI, all seven tools | 1.25 |
| Registration pill + environment status chip against real registration | 0.50 |
| Reset and persistence against real `referee.state.v1` | 0.50 |
| Fix `05`'s `REQUIRES_HUMAN` / `HUMAN_ONLY` inversion — four places, two on camera (`99` row 7b) | 0.25 |
| Re-verify every flow at the recording viewport after the port | 0.75 |
| **Total** | **5.25** |

**10.0 → 5.25, a 4.75h reduction.** The estimate holds **only if the port is a mechanical split with
no redesign.** One binding constraint follows from that, and it is the cheapest risk reduction
available: **keep the CSS as one file and do not decompose it.** Split only the JS. The proven
artifact is the rendered page; every stylesheet boundary introduced during the port is a chance to
break something that currently works, for zero benefit at this deadline.

**Change 3 — `runSimulation()` and Replay Mode are cut.** See §0.3.

### 0.3 The cut, and where it is recorded

`03` §6.2 specified a `runSimulation()` driver calling the real handlers. `05` §8.5 specified Replay
Mode, a pre-authored transcript explicitly *not* calling the handlers. Opposite designs for one
surface. Neither appears in `01`'s F1–F15 or its MUST/SHOULD tiers; neither was ever budgeted here.
**Two conflicting designs for an unbudgeted, unrequested feature is a cut, not a decision.**

Recorded 2026-09-01 as CUT banners in both files — `03-tool-contracts.md:2190` and
`05-ui-spec.md:1198` — and the two "Left open" paragraphs (`03:2374`, `05:1631`) now read
**RESOLVED — CUT, not chosen.** I marked the sections rescinded rather than deleting them: those
files belong to other slices, they are 115KB and 108KB, and excising blocks I did not author, under
this deadline, is the riskier operation. The banners say *do not build, do not stub, do not leave a
TODO.*

**This bankd no hours** — neither was budgeted — **so do not count it as slack.** What it removes is
a scope-creep vector worth 2–4h if either had been started, plus a live contradiction between two
frozen specs.

`05` §8.5 called Replay Mode "the video's insurance policy" and the judge-without-the-flag path.
Both jobs survive without it, which is why the cut is safe:
- **Video insurance** → the Checkpoint C backup take (§6), already in the plan since rev 2.
- **Judge without the flag** → the WebMCP-absent status band and registration pill, which are
  MUST-tier in `01`, already budgeted in the port, plus `docs/environment-check.md`.

### 0.4 New totals — it closes, by 4.0h

| | Eric available | Eric committed | Net | Baseline was |
|---|---|---|---|---|
| **Day 1** | 12.0h | **9.25h** | **+2.75h** | 11.25 (+0.75) |
| **Day 2** | 11.0h | **10.25h** | **+0.75h** | 16.75 (**−5.75**) |
| **Day 3** | 6.0h | **5.50h** | **+0.50h** | 5.5 (+0.5) |
| **Three-day** | **29.0h** | **25.00h** | **+4.00h** | 33.5 (**−4.5**) |

An 8.5h swing: −4.75 handlers, −4.75 UI re-price, +0.75 integration slot, +0.25 review triage.

### 0.5 Be skeptical of a result that closes this neatly

It closed by exactly the amount needed, in one pass, on two estimates I did not measure. Four
reasons to hold it loosely:

1. **4.0h across three days is 14% of the window. That is thin insurance, not comfort.** One lost
   half-day still breaks the plan. R9 has not gone away; it has been reduced to survivable.
2. **The UI re-price is the load-bearing assumption and it is unproven.** 5.25h is defensible for a
   mechanical port of a page that already renders. It is indefensible the moment anyone touches the
   design during the port. If the port turns into a redesign the estimate reverts toward 10.0 and the
   plan is underwater again with no warning. This is new risk **R13**.
3. **The constraint moved to Codex.** Codex now carries 12.25h on Day 1 (§1), gated on Eric's Task 5
   and Task 6 landing first. Eric's Day-1 slack is real but it cannot be spent on Codex's queue.
   New risk **R14**.
4. **The handler handoff assumes `03` is genuinely transcription-grade.** It is 115KB and frozen,
   which is the best evidence available — but every underspecified corner returns to Eric as an
   unbudgeted interruption, and `99` already found one live contract inconsistency (row 7b).

### 0.6 What stays dead

**S1–S6 remain cut.** The 4.0h is insurance against R13 and R9, **not budget.** Spending it on the
in-app acceptance panel would consume the entire margin for a SHOULD-tier item.

One decision rule, so this is not re-litigated ad hoc: **if Checkpoint C is met by Sep 2 16:00 ET
with 2.0h+ still banked, S1 may be restored** — it is the highest-value dead item, giving the video
a proof and the review a regression harness. Any other S item stays dead regardless.

---

## 1. Task plan

**[CP]** = critical path.

### Day 1 — Monday Sep 1 (Eric window 09:00–21:00 ET, 12.0h)

| # | Task | Owner | Hrs | Deps | CP |
|---|------|-------|-----|------|----|
| 1 | Public repo. `LICENSE` (verbatim Apache-2.0, filename `LICENSE`, no extension — what GitHub's detector reads), `README` stub, `.gitignore`, skeleton. Push `main`. | Eric | 0.5 | — | **[CP]** |
| 2 | Link to Vercel/Netlify. Production deploy of the skeleton at a stable public URL, no deployment protection. | Eric | 0.5 | 1 | **[CP]** |
| 3 | **Probe page** `/probe/` per `00-api-reality.md`: feature-detect `document.modelContext` with the `navigator` fallback, register through one `AbortController`, `await` it, set `annotations`. Two tools — `ping`, and **`always_refuses`** returning `JSON.stringify({ok:false,code:"PROBE_REFUSAL",…})` and never throwing. All six check results printed to visible DOM. | Eric+Claude | 1.0 | 1 | **[CP]** |
| 4 | **TASK 0 VERIFICATION** — six checks, both browsers, production URL. §2. Write `docs/environment-check.md`. | Eric | 1.0 | 2,3 | **[CP]** |
| 5 | **State module, ledger, and the `defineTool()` substrate.** Single `referee.state.v1` key; load/save/migrate-or-reset; append-only `appendLedger`; `reset()` with AC-35's confirmation. **This is the dependency every Codex handler compiles against — it ships first and it does not change afterward.** | Eric+Claude | 1.0 | 4 | **[CP]** |
| 6 | Corpus data layer: 12 records across disjoint public/identity stores, 4 weighted criteria, loader. Schema and loader only. **Freezing this unblocks C1.** | Eric+Claude | 0.75 | 4 | **[CP]** |
| 7 | **UI PORT PHASE 1** — split the mockup's JS into ES modules (CSS stays one file, §0.2); replace seeded arrays with the real state module and corpus loader. | Eric+Claude | 2.0 | 5,6 | **[CP]** |
| 8 | **Handler integration + Checkpoint B verification.** Wire C6's seven handlers into the page, confirm all seven register through one awaited call, run the Checkpoint B evidence list (§6). | Eric | 0.75 | C6,7 | **[CP]** |
| 9 | Recording rig: screen recorder + mic level test, one throwaway 60-second take, confirm audio is on the file. | Eric | 1.0 | — | |
| 10 | Video script, ~350 spoken words ≈ 2:20, against the demo beats. Eric writes this one — it is the voice track. | Eric | 0.75 | — | |
| **C1** | **Seeded corpus prose — HOST TEXT ONLY.** 12 fictional manuscripts (~250–400 words each) to `02` §6.1's table, identity records confined to the identity store, every manuscript visibly labeled fictional (AC-36). **The four payload slots and two decoy slots are left as empty placeholders. Do not author payload prose.** `04` §2 already authored FX-1/FX-2/FX-3 and the two decoys, and `04` §7.3 *measured* their removal lengths at 232, 251 and 263 characters — figures now frozen on camera in `05` §3.5, §3.6, §11.2 and `07` §1. Fresh prose makes those numbers false in three files. `02`:807-808 is explicit: *04 authors the text for both, this file only reserves the locations.* | Codex | 3.0 | 6 | |
| **C2** | **TRANSCRIBE `04` §3's sanitizer, then re-run its measured test table.** This is a transcription slice, not a design slice — `04` §3.3 is already written and executed. The signatures are `sanitizeSection(...) -> {clean, events, attempts}` and `sanitizeManuscript(id) -> {id, sections, events, integrity:{injection_attempts, sections_affected}}` (`04`:552-582). **`{neutralized, findings}` is a third interface and is dead vocabulary — do not build it.** The redaction literal is `04` §3.3's `redactionToken(n)` producing `[[REDACTED:NON_MANUSCRIPT_DIRECTIVE#n]]` and nothing else: `04` §5 makes that exact token the hard match barrier the whole sanitize↔verify invariant rests on, and `REDACTION_RE` is keyed to it. Deliverable is `04` §7.3's S1–S7 table re-run and matching, including the measured removals **232 / 251 / 263** and S7's `[232, 251]` two-span composition. Both decoys (S5/S6) must come back `attempts === 0`. | Codex | 1.5 | — | |
| **C3** | **TRANSCRIBE `04` §4's evidence verifier and `04` §3.1's normalizer, then re-run `04` §7.2's 14-row table.** Transcription, not design. **Normalization is SEVEN steps in this execution order** — `strip-format-characters`, `separators-to-space`, `NFKC`, `straighten-quotes`, `straighten-dashes`, `casefold`, `collapse-whitespace` (`04` §3.1; echoed verbatim by `03`:1381-1382 and `03`:1912, and by `01` AC-11 and `07` §2). **The four-step list "NFKC, whitespace, curly-quote, case folding" is dead vocabulary** — it omits the format-character strip, which `04`:117-119 says is the only reason FX-1's zero-width payload is detected at all, and the separator fold. Build to four steps and FX-1 stops being caught and `04` §7.3's whole S-table goes red. `verifyQuote` returns `04` §4's fields (`ok`, `code`, `method`, `score`, `char_offset`, `normalized_length`, `min_chars`) — never `verified`, `similarity`, `threshold` or `normalized_quote`. `MIN_QUOTE_CHARS` and `FUZZY_THRESHOLD` are **imported from `src/core/constants.js`**, never re-declared. Deliverable is `04` §7.2 re-run: 14 rows, 15 assertions, matching `score` and `char_offset` columns, plus the 40-char floor and the 0.92 boundary from both sides. | Codex | 1.5 | — | |
| **C6** | **THE SEVEN TOOL HANDLERS**, to `03`'s frozen contracts through `defineTool()`. Returns are `JSON.stringify(...)` always (D1); refusals are **returned, never thrown**, with every body in try/catch converting a genuine exception to `{ok:false,code:"INTERNAL"}` (D2); `annotations` per D3's table. | Codex | 4.75 | 5,C2,C3 | **[CP]** |
| **C4** | README first draft from `01` and `07`. | Codex | 0.5 | — | |
| **C5** | Devpost description first draft from `07` — all four required points. | Codex | 1.0 | — | |

**Day 1 — Eric 9.25 of 12.0 (slack +2.75). Codex 12.25h, and Codex is the constraint (R14).**

### Day 2 — Tuesday Sep 2 (Eric window 09:00–20:00 ET, 11.0h)

| # | Task | Owner | Hrs | Deps | CP |
|---|------|-------|-----|------|----|
| 11 | **UI PORT PHASE 2** — event-bus wiring so handler returns drive the UI across all seven tools; registration pill + environment status chip against real registration; reset and persistence against real state; fix `05`'s `REQUIRES_HUMAN`/`HUMAN_ONLY` inversion in all four places (`99` row 7b, two of them on camera); re-verify every flow at the recording viewport. | Eric+Claude | 3.25 | 7,8 | **[CP]** |
| 12 | Integrate C1's corpus prose, replace placeholders, redeploy. | Eric+Claude | 0.5 | C1,11 | **[CP]** |
| 13 | **REVIEW GATE — triage.** §4. Codex's findings on the UI port, plus Eric's reciprocal check of the handlers against `03`. | Eric | 1.0 | C7 | **[CP]** |
| 14 | **Demo determinism pass.** `docs/DEMO-SCRIPT.md`: the literal prompts in order, each with the tool it should trigger and the expected visible result. Then tighten `description` strings until each prompt reliably selects one tool. Prompt-engineering, not documentation. | Eric+Claude | 1.0 | 12 | **[CP]** |
| 15 | Full dry run end to end in **both** browsers. Numbered bug list. Fix nothing during the run. | Eric | 1.0 | 14 | **[CP]** |
| 16 | Bug-fix pass — review-gate blockers first, then most-visible-on-camera. | Eric+Claude | 1.5 | 13,15 | **[CP]** |
| 17 | Edit C5's Devpost draft into Eric's voice → `docs/devpost-description.md`. | Eric | 0.75 | C5 | |
| 18 | Edit C4's README; one-line pointer to `DEMO-SCRIPT.md`. No screenshots. | Eric | 0.25 | C4,12 | |
| 19 | Timed rehearsal on the real app. Over 2:30 → cut beats now. **Then shoot the backup take and upload it unlisted.** | Eric | 1.0 | 16 | **[CP]** |
| **C7** | **Review gate — the review pass.** §4. Delivered by Sep 2 09:00. | Codex | 1.5 | 8 | **[CP]** |
| **C8** | Mechanical sweep of AC-4 – AC-39 against the deployed build: pass / fail / not-checkable, each citing the criterion. Feeds Task 16. **Partial substitute for dead S1.** | Codex | 1.0 | 12 | |

**Day 2 — Eric 10.25 of 11.0 (slack +0.75). Codex 2.5h.**

### Day 3 — Wednesday Sep 3 (08:00–14:00 ET / 05:00–11:00 PT, 6.0h) — **PROTECTED**

| # | Task | Owner | Hrs | Deps | CP |
|---|------|-------|-----|------|----|
| 20 | Reserve: fix only what breaks the recorded demo path. **Feature freeze 09:30 ET.** | Eric+Claude | 1.0 | 19 | |
| 21 | Record. Budget 3 takes. Under 3:00 with audio is pass/fail — time every take. | Eric | 1.5 | 20 | **[CP]** |
| 22 | Trim, export, upload to YouTube **Public**. Watch the uploaded copy through: audio present, under 3:00, opens signed-out. | Eric | 1.25 | 21 | **[CP]** |
| 23 | Final deploy + smoke test from a clean/incognito profile, both browsers. | Eric | 0.5 | 20 | **[CP]** |
| 24 | Repo final: About sidebar reads **Apache-2.0**, repo Public, description and live URL set, `registerTool` greppable on `main`, `docs/environment-check.md` committed. | Eric | 0.5 | 20 | **[CP]** |
| 25 | Devpost form (§6 sequence), then open the public submission page as a stranger and click every link. | Eric | 0.75 | 22,23,24 | **[CP]** |

**Day 3 — Eric 5.5 of 6.0 (slack +0.5). Codex 0h — Codex is done after C7 and C8.**

---

## 2. TASK 0 — six checks, and check 5 is its own go/no-go

Per `00-api-reality.md` §3. All six run **on the deployed production URL**, in **both** the ChatGPT
desktop in-app browser and Chrome 149+ with the testing flag.

| # | Check | Failure means |
|---|---|---|
| 1 | `document.modelContext` present (or the deprecated `navigator.modelContext`) | No WebMCP there |
| 2 | `await registerTool(...)` resolves without throwing | Registration surface differs |
| 3 | The agent discovers and calls the tool | Discovery differs |
| 4 | A returned JSON **string** arrives intact and readable | D1 is wrong there |
| **5** | **A returned `{ok:false}` refusal reaches the agent as a usable RESULT, not swallowed as an error** | **The premise collapses** |
| 6 | `annotations` accepted without error | Drop annotations there; do not fail registration |

### Check 5 runs FIRST, and is decided on its own

Referee's refusals **are the product.** Every headline moment — the fabricated quote rejected, the
recommendation handed back, the unblind denied — is a `{ok:false}` return that has to land in front
of the agent as something it can read and act on. If the runtime swallows it, there is no demo. And
it fails **silently**: the page looks right, the ledger fills, and only the agent's side is empty.

Task 3 registers **`always_refuses`** for exactly this. Task 4 calls it deliberately in both
browsers **before completing checks 1–4**, and the agent must be able to quote the `code` and the
`message` back.

- **Passes in both:** proceed on plan.
- **Passes in one:** that browser is primary, immediately, no further investigation. Record there,
  disclose the other in README, About panel and Devpost. **Cap reconciliation at 1.0h.**
- **Fails in both:** stop. Do not start Task 5. This needs Eric's judgment, not a workaround. The
  likely reshape is refusals becoming page-visible and human-narrated rather than agent-visible —
  a different submission, decided deliberately, not improvised at 22:00.

`docs/environment-check.md` records all six per browser, both version strings, the date, and a
screenshot (AC-39). It doubles as judge-facing evidence that the project runs where they will test
it — which matters more now that Replay Mode is cut and it is the judge-without-the-flag artifact.

---

## 3. Critical path

**1 → 2/3 → 4 → 5/6 → [C6 handlers ∥ 7 port-1] → 8 → 11 → 12 → 13 → 14 → 15 → 16 → 19 → 21 → 22 → 25**

Named plainly: **repo and deploy exist → Task 0 proves WebMCP fires and refusals survive → the
ledger substrate and corpus schema land → handlers and the UI port proceed in parallel → they
integrate → the port finishes → the review gate clears it → the demo runs deterministically → it
records → it uploads → it submits.**

**The path now runs through the UI port and the recording.** That is the substantive change from
rev 2, where it ran through Eric implementing everything. Handlers came off the path's Eric-only
stretch — they are now a parallel Codex branch that rejoins at Task 8. What is left on Eric and
cannot be delegated is the port (Tasks 7, 11), the demo tuning (14), the dry run (15), and the whole
of Day 3. **Every one of those is a single-writer surface or a physical act.**

Two branches join the path and each can break it: **C6 late** delays Task 8 and therefore Checkpoint
B; **C1 late** delays Task 12. Their due times are in §5.

**Off the path:** Task 9 (rig — insurance on a CP task, keep), Task 10 (script — needed by Day 3
only), Tasks 17/18 (prose edits, `18` is [CUT-OK]), C8 (sweep — cut costs the dead-S1 substitute).

---

## 4. The review gate — re-cut, and now reciprocal

Handlers moved to Codex, so the gate inverts: **Codex reviews Eric's UI port; Eric reviews Codex's
handlers.** Neither implementer reviews their own work, which is the point.

**C7 — Codex reviews, 1.5h, overnight Sep 1 → delivered Sep 2 09:00.** Against written artifacts:
- **`05`** — the port against the spec the mockup was built from: token fidelity, the FLIP
  choreography, the split-screen connector gutter, live regions, empty and error states.
- **`01` AC-1 – AC-39** — every finding cites its criterion. A finding without a citation is not a
  finding.
- **Specifically: did the port break something the mockup had working?** Codex has the rendered
  original to diff against, which is the cheapest possible check on R13.

**Task 13 — Eric triages, 1.0h, Sep 2 morning.** Two jobs:
- Sort C7's findings: fix now (→ Task 16), fix if slack survives, or won't-fix with the reason in
  the commit message. **No fourth option.**
- **Reciprocal check of C6's handlers against `03`** — return shapes, refusal payloads, the
  `annotations` table from D3, and above all **D2: no handler throws on a policy refusal.** Eric
  does not re-read 115KB; he spot-checks the seven refusal paths and the `defineTool()` wrapper,
  because those are what the video shows and what R0 threatens.

Capped at 1.0h. If the list is long, blockers only; the rest are won't-fix by default.

This gate is the deliberate substitute for dead S1 — a human reading code against a contract instead
of a page running its own checks. Strictly weaker. C8 recovers part of the difference.

---

## 5. Parallelization map

The split is now **one writer on shared state and every demo surface, a second implementer on
frozen-contract code, pure functions, prose, and review.**

### Codex owns

| Slice | Why it hands off safely |
|---|---|
| **C6 the seven handlers** | `03` is frozen and ~115KB; `defineTool()` makes ledger-append and serialization structurally unskippable, so the wrapper enforces what a contract otherwise only asks for. Closer to transcription than to design. |
| **C1 corpus prose** | Pure data against a schema Eric freezes first. Touches no runtime code. Largest word-count deliverable in the build. |
| **C2 sanitizer, C3 verifier** | Pure functions with test tables. No state, no DOM, no registry. |
| **C4 / C5 prose drafts** | Eric edits rather than authors — roughly half the time. |
| **C7 review, C8 AC sweep** | Read-only by construction. Codex reports; it does not patch. |

### Eric owns, and it must serialize

- **The state module, the ledger, and `defineTool()`** (Task 5) — single writer, full stop. This is
  the substrate C6 compiles against.
- **The entire UI port** (Tasks 7, 11) — one DOM, one render path, one CSS file that is deliberately
  not decomposed (§0.2).
- **Every demo-critical surface** — split-screen, commit panel, status chip, registration pill.
  These are what the video shows; they need one person's judgment about what reads on camera.
- **The dry run and the recording** — Codex cannot drive the ChatGPT in-app browser.

### The interleave, with the two hard gates

| Eric is doing… | Codex is doing… | Gate |
|---|---|---|
| Day 1 AM: Tasks 1–4 | C2, C3 (need nothing) | — |
| Day 1 PM: Tasks 5, 6 | C1 starts once 6 is frozen | **Task 6 schema frozen before C1 writes records** |
| Day 1 PM/eve: Task 7 port-1 | **C6 handlers** once Task 5 ships | **Task 5 substrate + C2/C3 before C6 starts** |
| Day 1 eve: Tasks 8, 9, 10 | C1 continues; C4, C5 | **C6 delivered before Task 8** |
| Day 1 night → Sep 2 09:00 | **C7 review** against a static deploy | **Eric does not commit while the review runs** |
| Day 2 AM: Tasks 11, 12, 13 | C8 once Task 12 deploys | — |
| Day 2 PM: Tasks 14–19 | on call to re-review fixed blockers | Codex does not patch |

**Due times, because Eric's slack cannot be spent on Codex's queue:** C2 and C3 by **Sep 1 15:00
ET**; C6 by **Sep 1 19:00 ET** (Task 8 needs it); C1's first six manuscripts by **Sep 1 20:00 ET**,
all twelve by **Sep 2 09:00**; C7 by **Sep 2 09:00**.

**Codex carries 12.25h on Day 1 against Eric's 9.25h.** The constraint moved. If Codex must shed
load, shed in this order: C5 → C4 → C1 manuscripts 7–12. **Never C6, and never C2/C3** — those three
are on or immediately beneath the critical path.

### Eric's interruption-tolerant work
Tasks 9 and 10 (rig, script) are the chunkable blocks; nothing depends on them until Day 3.

---

## 6. Checkpoints and the protected end-game

### CHECKPOINT A — "WebMCP is real here, and refusals survive" · Sep 1, ~12:00 ET · Task 4
All six checks, both browsers, **check 5 first and decided alone.** Fallbacks in §2.
`docs/environment-check.md` committed.

### CHECKPOINT B — "seven tools live, port phase 1 landed" · Sep 1, 21:00 ET · Tasks 5–8
Evidence list, not a feeling:
- All seven registered on the production URL through one awaited registration.
- `read_manuscript` provably cannot return identity — inspect the object, the fields are *absent*.
- `assert_finding` accepts one true quote and **returns** a refusal on one fabricated quote.
- `submit_recommendation` refuses.
- The ledger has rows for all of it.
- The ported page renders from the real state module, not from seeded arrays.

**The §7 trigger, stated precisely — invoke Referee Minimum that night if ANY holds:**
1. C6's handlers are not integrated and returning green at Task 8; **or**
2. UI port phase 1 has not landed — the page still renders from seeded data; **or**
3. Eric's Day 1 closed with **under 2.0h banked** (below the 2.75h plan, i.e. the day ran over); **or**
4. Check 5 passed in only one browser **and** reconciliation consumed more than its 1.0h cap.

Trigger 3 is the one that gets rationalized away. Do not. Day 2's whole margin is 0.75h.

### CHECKPOINT C — "video-shootable" · Sep 2, 18:00 ET · Tasks 15, 16, 19
Eric runs `DEMO-SCRIPT.md` end to end on production — no devtools, no reload, no unexplained
refusal, under 2:30 — **twice in a row.** Two clean runs. One is luck. Review-gate blockers closed
or explicitly won't-fixed.
- Fails once → fix, re-run. Fails twice for the same reason → delete that beat and re-run.
- Still failing at 20:00 → §7 tonight, not Wednesday.
- **Shoot and upload the unlisted backup take regardless of outcome.** With Replay Mode cut, this
  take is now the *only* video insurance in the plan.
- Met by 16:00 with 2.0h+ banked → S1 may be restored (§0.6). Otherwise it stays dead.

### The protected end-game — INVIOLABLE
**From Sep 3, 09:30 ET (06:30 PT) the project is in submission mode.** No feature commits, no quick
improvements, no re-recording to catch a nicer UI. The only permitted change repairs a break in the
recorded demo path, followed by a re-run of Task 23.

**Form sequence.** Steps 2–8 wait on Tasks 22, 23, 24 all green.
1. **Open the submission and save an empty draft at the start of the block.** It costs nothing and
   proves the form loads and accepts this account. Finding an account problem at 12:45pm PT is the
   avoidable disaster.
2. Paste the **live URL.** Open it from the draft's own link to catch a typo.
3. Paste the **repo URL.** Signed-out window: it loads, About sidebar reads Apache-2.0.
4. Paste the **YouTube URL.** Public, plays signed-out, audio present.
5. Paste the **description.** Re-read in the form preview — markdown that did not survive, truncation.
6. "How to test": ChatGPT desktop in-app browser or Chrome 149+ with the WebMCP testing flag, no
   login, pointer to `docs/environment-check.md`. A judge who cannot reproduce the environment
   scores only what they can see.
7. Images if the form takes them — split-screen panel, a refused `assert_finding`. Skip if tight.
8. **Submit,** then open the public page as a stranger and click every link.

**Latest submit: 11:00am PT / 2:00pm ET.** At 11:00 with one imperfect asset, submit anyway. An
imperfect submission scores; an unsubmitted one does not.

---

## 7. Contingency — Referee Minimum

**Status change from rev 2: this is a contingency again, not the expected path.** Rev 2 ran a
three-day deficit, so §7 was the likely outcome. Rev 3 runs a 4.0h surplus, so the full build is the
plan — but the margin is 14% and §0.5 says why that is thin rather than comfortable.

**Triggers:** any of Checkpoint B's four (§6); or fewer than 3 of Tasks 11–14 done at Sep 2 12:00
ET; or Eric losing more than half a day. Five-minute decision, one-way door.

### 7.1 The ruling this section was rewritten under

Rev 3's §7 deleted **corpus 12 → 4**, **rubric criteria 4 → 2**, and **the multi-manuscript queue
→ a `<select>`**. All three are now **FORBIDDEN CUTS**, ruled 2026-09-01:

> The fallback may not cut anything that breaks `01`'s MUST list, and may not cut anything that
> invalidates `02` §3.5's executed ranking arithmetic. The corpus size and the criterion count are
> both inputs to that arithmetic, and it is the only numerically verified thing in the whole set.

Checked against the two files rather than asserted:

| Deleted in rev 3 | What it breaks | Verdict |
|---|---|---|
| corpus 12 → 4 | `01` **AC-33** (MUST, Reset) says reset "restores **all twelve** seeded manuscripts"; **AC-16** counts **nine** clean manuscripts and needs two of them to carry decoys; **AC-15** needs three seeded across a twelve-manuscript field; `01` **F1** is "**Twelve** fictional manuscripts". `02` §3.5's 24 composites, both near-tie pairs, the blocking count of 7 and the `acceptSlots:4` cut line are all computed over twelve rows. | **FORBIDDEN** |
| rubric criteria 4 → 2 | `01` **F7** is "**Four** criteria with human-adjustable weights"; **AC-31** verifies a zeroed criterion against a hand-computed composite; the MUST line reads "Live re-ranking on weight change (AC-29 – AC-32)". `02` §3.5's arithmetic is executed at `{30,35,15,20}` and `{50,25,10,15}` — **four** weights — and the scripted retune `07` §1 films is a four-weight move. | **FORBIDDEN** |
| multi-manuscript queue → a `<select>` | `01` **F1** is a queue "live-ranked by composite rubric score"; **AC-29** requires that moving a slider "**re-orders the queue**" within the same frame and **AC-30** that restoring the weight restores the exact prior order. A `<select>` is a navigation control, not a ranked list; there is nothing for the re-rank to be observed in. This one was not named in the ruling — it was found by deriving the MUST list against it. | **FORBIDDEN** |

**And cutting the corpus at trigger time saves nothing, which is the finding that decides §7.** The
corpus is static prose assigned to **Codex as C1, delivered on Day 1** and integrated by Task 12.
Both §7 triggers evaluate *after* C1 lands — Checkpoint B is Sep 1 21:00, the Tasks 11–14 gate is
Sep 2 12:00. By then the prose exists and its size costs nothing on the critical path. Rev 3 priced
the cut at 0.25h (Task 12 dropping 0.5 → 0.25); against that it charges re-pointing `02` §6.1's seed
table, `01` AC-15/16/33, `05` §3.5, §3.6 and §11.2's on-camera 232 / 251 / 263, and `07` §1's rank
numbers. **The cut is net negative in hours before it is ruled out on MUSTs.**

### 7.2 What §7 may still cut, priced

| Cut | Owner / day | Saves | Breaks a MUST? |
|---|---|---|---|
| Task 18's README edit — ship C4's draft as delivered | Eric, Day 2 | **0.25h** | No. No AC names README prose. AC-37's honesty boundary is a **paste** of `04` §8, not an edit. |
| Task 17's Devpost edit — ship C5's draft after a 0.25h read-through instead of a 0.75h voice pass | Eric, Day 2 | **0.50h** | No. The four required points are C5's brief. The cost is voice, not correctness. |
| Reduced video, three beats — Task 19 rehearsal 1.0 → 0.75, Task 21 record 1.5 → 1.0, Task 22 trim/export 1.25 → 1.0 | Eric, Day 3 | **1.00h** | No. The video is not an acceptance criterion. The re-rank beat leaves the *video*; AC-29–AC-32 stay observable in the build. |
| Task 15's full dry run drops to **one** browser — the recording browser gets the end-to-end run, the second browser gets only Task 0's six checks re-run | Eric, Day 2 | **0.50h** | No, but it is the riskiest line here. AC-1–AC-3's both-browsers requirement is discharged by Task 4, Task 8 and Task 23, not by this dry run. It buys hours by giving up a rehearsal, and a second-browser break would then surface at Task 23 on Day 3. |
| The decoy beat leaves the video; **the decoy stays in the corpus** | Eric, Day 3 | inside the 1.00h above | No — AC-16 is about `integrity.injection_attempts === 0` on the nine clean manuscripts, not about the video. |
| C7 narrows to the four demo-path handlers | Codex, Day 2 | 0.5h **Codex** | No, and **it relieves nothing.** Codex carries 2.5h on Day 2 against 12.25h on Day 1; Codex is not the Day-2 constraint. Keep it or cut it, it does not move the deadline. |

**Total MUST-safe relief: 2.25h — 1.25h on Day 2 and 1.00h on Day 3.** Rev 3's §7 never stated a
total at all, so this is the first time the section has been priced.

**Not on the delete list, and why each is off it:** rev 2 deleted "all CSS." No longer available —
the CSS is the proven artifact and deleting it *costs* hours rather than saving them. The SHOULD
list (S1–S6) is already dead per §0.6, so it holds no recoverable hours. Task 20's 1.0h Day-3
reserve is insurance being spent, not a cut. Under Referee Minimum the port still happens in full;
what changes is polish and rehearsal, not scope.

### 7.3 Plainly: below the MUST line there is no fallback

**2.25h covers exactly one of the three trigger conditions.**

| Trigger | Shortfall it implies | Covered by 2.25h? |
|---|---|---|
| Checkpoint B trigger 3 — Day 1 closed under 2.0h banked | ≈ 0.75–1.0h | **Yes.** 1.25h of Day-2 relief plus the 0.75h Day-2 margin absorbs it with room. |
| Checkpoint B triggers 1 / 2 — C6's handlers not integrated, or port phase 1 not landed | up to **4.75h** (the handlers) | **No.** The seven tools are `01`'s first MUST (AC-1–AC-3). Nothing in §7.2 substitutes for writing them. |
| Eric loses more than half a day (R9) | **4–6h** | **No.** |

**So, stated plainly: for the failures §7 actually exists to absorb — a lost half-day, or a failed
handler handoff — no valid fallback exists below the MUST line.** Referee Minimum can buy 2.25h of
polish. It cannot buy four. Any §7 that appears to close a four-hour hole is closing it by deleting
a MUST, which is the move this rewrite exists to stop.

**What the MUST list would have to give up for a real fallback to exist.** Priced, so the trade is
visible rather than implied:

- **Live re-ranking (AC-29–AC-32, F1, F7).** The only MUST whose removal frees a material block:
  most of §0.2's 1.25h bus-wiring line plus the rubric panel and the FLIP reorder — call it
  **1.5–2.0h**. It also voids `02` §3.5 in full, the only executed arithmetic in the set, and `07`
  §1 calls this beat the one that reads as product depth rather than demo depth. Giving it up
  trades the strongest MUST for less than half the hole.
- **The injection split-screen (AC-15–AC-19, F6).** Frees C2's integration and the split-screen
  port, **≈ 1.0h**. It is the money shot; `05` holds 30 seconds on it.
- **The ledger (AC-20–AC-24).** Frees the ledger view and the clipboard call, **≈ 0.75h**. It is
  the evidence artifact a judge lifts the proof out of.
- **Corpus at 4 (AC-16, AC-33).** **Negative** — see §7.1.

Removing all three of the first bullets buys **≈ 3.25–3.75h** and leaves a submission that no
longer demonstrates its own thesis. **That is not a fallback; it is a different, worse project.**

**Therefore the lever is the trigger, not the cut list.** §7 is worth invoking only where 2.25h of
polish relief is decisive, which is Checkpoint B trigger 3 and nothing else. For triggers 1, 2 and
R9 the honest responses are already in the plan and none of them is §7: Task 20's 1.0h Day-3
reserve, §6's rule that a beat failing twice for the same reason is deleted and the run continues,
the Checkpoint C backup take shot regardless of outcome, and §6's standing instruction to submit at
11:00 PT with one imperfect asset. **An imperfect submission scores; an unsubmitted one does not** —
and that sentence, not a shorter corpus, is the real contingency.

### 7.4 KEPT, non-negotiable

All seven tools through genuine `registerTool`; structural blinding on `read_manuscript`; the
evidence gate with a visible *returned* refusal; injection neutralization with the split-screen,
across **all four payload instances on their three manuscripts** (AC-15) with **nine clean
manuscripts including both decoys** (AC-16); the append-only ledger with copy-to-clipboard;
human-only commit (a single `<button>` suffices); reset with its confirmation, **restoring all
twelve manuscripts** (AC-33); live re-ranking on weight change over **four** criteria and **twelve**
manuscripts; **the About panel's honesty boundary and the environment status chip** — without the
first the submission overclaims, without the second a judge in the wrong browser concludes the build
is broken.

**Reduced video, three beats, ~2:00:**
1. The agent reads a manuscript; the returned object has no author field. The page — not a prompt —
   made identity unavailable.
2. The agent asserts a finding with a fabricated quote; the page refuses and the agent *reads the
   refusal*; it lands in the ledger. Then the true quote; accepted.
3. The agent hits the payload manuscript; split-screen shows what it received against what was in
   the file. It proposes a recommendation; the page refuses and hands the decision to the human,
   who clicks.

Checkpoint C moves to Sep 2, 20:00 ET. Day 3 is unchanged and still protected.

---

## 8. Risk register

**Top-risk correction:** it is no longer "Eric is the implementation bottleneck" in general. Handlers,
corpus, pure functions and prose have moved off him. **What is left on Eric, and cannot move, is the
UI port and the recording — R13 and R7/R9's recording clause.** Everything else has a second pair of
hands.

| # | Risk | Likelihood | Impact | Early signal | Mitigation | Pre-decided fallback |
|---|---|---|---|---|---|---|
| **R13** | **The port breaks a page that currently works.** A 110KB self-contained file has coupling that only surfaces when it is split. **This is now the top risk: the 5.25h estimate and therefore the whole 4.0h surplus rest on it.** | **High** | **High** | Any flow that worked in the mockup misbehaves after phase 1; or the port starts touching styling | **Mechanical split, no redesign. CSS stays one file** (§0.2) — the single cheapest reduction available. Keep the original mockup in-tree, untouched, as the diff target. C7 explicitly reviews for regressions against it | Revert to the mockup file and re-port only the module that broke. If two phase-1 flows break, **stop porting and ship the mockup as a single file with state wired in** — ugly module hygiene, working page, and no judge will ever know |
| **R0** | **A returned `{ok:false}` refusal is swallowed rather than delivered** — check 5 | Medium | **Existential** | Task 4's `always_refuses`: the agent cannot quote the `code` or `message`. **Nothing else looks wrong** — page renders, ledger fills, only the agent's side is empty | Check 5 runs **first**, with a tool registered for that purpose. D2 forbids throwing on policy refusals, so the failure mode is delivery, not shape. Eric spot-checks all seven refusal paths at Task 13 | One browser → that browser is primary, disclosed everywhere. Both → **stop and decide with Eric.** Likely reshape: refusals become page-visible and human-narrated |
| **R14** | **Codex is now the Day 1 constraint** (12.25h, gated on Tasks 5 and 6) and Eric's slack cannot be spent on that queue | **High** | High | C2/C3 not delivered by Sep 1 15:00, or C6 not by 19:00 | Due times are explicit (§5). Shed order is pre-decided: C5 → C4 → C1 manuscripts 7–12. **Never C6, never C2/C3** | C6 late → Eric takes the two demo-path handlers himself out of Day 1 slack (2.75h covers it) and Codex finishes the rest overnight. C1 late → ship 6 manuscripts |
| R3 | **The agent calls tools in a nonsensical order during recording** | **High** | High | First rehearsal wanders, re-reads, skips the gate | Task 14 is budgeted work: tune `description` strings until each prompt selects one tool. Prompts name the intent, not the tool. `get_review_state` stays cheap so a confused first move is harmless | Narrow to three beats. If it still wanders, narrate over it — an agent corrected, with the page holding the line anyway, is *on* thesis |
| R6 | **Scope creep on the UI** — now specifically *redesign during the port* | **High** | High | Any commit touching CSS, or a "while I'm in here" improvement to the mockup | The mockup is finished and proven; treat it as read-only design. Port hours are capped at 2.0 + 3.25 | Hard cap. At Sep 2 16:00 ET whatever the port has is what ships |
| R9 | **Eric is pulled away** — now scoped to the port and the recording, not to implementation generally | Medium-High | **Critical** | Any Eric task slipping its day | Reduced but not removed: everything delegable is delegated. Tasks 9 and 10 absorb interruptions. 4.0h of margin exists but is only 14% | Half-day lost: invoke §7 — but §7.3 now prices it at **2.25h of MUST-safe relief**, which does not cover a half-day, so the honest response is §7 **plus** Task 20's reserve and §6's delete-the-failing-beat rule. Full day: **corpus at 4 is a FORBIDDEN CUT** (§7.1) and would cost more than it saves; there is no cut below the MUST line that recovers a full day. **Sep 3 morning lost: no submission** — which is why the Checkpoint C backup take is now the only video insurance and gets shot even when things go well |
| R7 | **Video over 3:00** (pass/fail) | Medium-High | **Critical** | Task 19 times over 2:30 | Script written for ~2:20 (Task 10), rehearsed with a timer a day early. Cut order: decoy → ledger tour → re-ranking → extras | Cut to §7's three beats. Export at 3:05 → cut the intro sentence and re-export. Never upload over 3:00 hoping nobody checks |
| R1 | **The two browsers behave differently** | Medium-High | High | Task 4's six checks diverge | Task 0 first, on production, before architecture is committed. D1's JSON-string returns remove a class of divergence | One primary within 1.0h, recorded there, disclosed in README, About panel and Devpost. Do not chase parity |
| R2 | **`document.modelContext` absent or differently shaped** | Medium | Critical | Task 3's readout | The readout prints what is there rather than asserting what should be. D4 falls back to `navigator.modelContext`. One thin adapter, so a shape change touches one file | Render the WebMCP-absent state with the status band explaining why. The page still works as a human-only review room. Escalate before building further |
| R15 | **`03` has an underspecified corner and the questions come back to Eric** unbudgeted | Medium | Medium | Codex asks a contract question during C6. `99` row 7b already found one live inconsistency | `03` is frozen and 115KB, which is the best available evidence it is transcription-grade. Task 13's reciprocal check is where remaining gaps surface | Eric answers from `01`'s acceptance criteria and records the ruling in the commit message. If a corner needs a real design call, it is a won't-fix and the handler ships to the contract as written |
| R4 | **Evidence verification over-rejects on camera** | Medium | High | A rehearsal refusal Eric judges wrong | Two known-good quotes hardcoded in `DEMO-SCRIPT.md`, verified in rehearsal. C3's tests cover the 0.92 boundary from both sides | Lower the fuzzy floor to 0.88 **before** recording, never during. If it refuses on camera, keep rolling: "it refused me, and it was right to, because I paraphrased" is stronger than a clean pass |
| R5 | **The injection detector misfires on the near-miss decoys** | Medium | Medium | Decoys light up in Task 15 — or in C2's own test table, which is earlier and cheaper | C1 and C2 are authored by the same implementer against each other. **Both decoys are negative cases in C2's tests** | Cut the decoy beat from the video; leave the decoys in the corpus. **Do not loosen the sanitizer to make a decoy pass** — that trades a real defense for a demo beat |
| R8 | **Late deploy failure** Sep 3 morning | Low-Medium | **Critical** | Task 23 fails, or the site 404s from incognito | Last known-good SHA recorded in `docs/environment-check.md` at Checkpoint C. The 09:30 freeze means the deploy is already old by then | Roll back to the Checkpoint-C SHA. **Do not debug forward inside the protected block.** Host down → push the same static files to GitHub Pages and change the URL on the form |
| R10 | **localStorage unavailable or partitioned** in the in-app browser | Medium | Medium | State does not survive a reload during Task 4 or 15 | Detect on load; fall back to in-memory behind the same interface | Run the demo in memory. Reset-per-reload is fine for a demo |
| R11 | **Judges score on video and description alone** | High | High | None — assume it | Video and description are first-class with budgeted hours (10, 17, 21, 22). C5 drafts the description on Day 1 so it does not depend on the build finishing. `docs/environment-check.md` is judge-facing for the same reason | If the live demo is weak, the description carries the submission |
| R12 | **License not detected** in GitHub's About sidebar (pass/fail) | Low | **Critical** | Task 24 — the sidebar is blank | `LICENSE` at root, verbatim Apache-2.0, header unmodified. Checked at Task 1, re-checked at Task 24 | Recreate through GitHub's own "Add license" template UI, guaranteed detectable, then re-check |

---

## 9. Decision points that need Eric, not Codex

| When | Decision | Cost of deferring |
|---|---|---|
| Sep 1, ~11:00 ET | **Check 5 alone** — do refusals reach the agent | Everything downstream assumes they do |
| Sep 1, ~12:00 ET | Checkpoint A — which browser is primary, if they diverge | Every hour after is built against an unknown target |
| Sep 1, ~15:00 ET | **Is the port mechanical, or has it become a redesign** (R13) | The 4.0h surplus evaporates silently |
| Sep 1, 19:00 ET | C6 delivered? If not, Eric takes the two demo-path handlers from Day 1 slack | Checkpoint B slips, and B gates the review gate, which gates C |
| Sep 1, 21:00 ET | **Checkpoint B — all four §7 triggers, trigger 3 included** | Trigger 3 is the one that gets rationalized away. Day 2's whole margin is 0.75h |
| Sep 2, 09:00 ET | Review-gate triage: blocker / if-time / won't-fix, capped 1.0h | An untriaged list is not a gate |
| **Sep 2, 12:00 ET** | **§7: invoke or not.** One-way door, five minutes | Deciding Sep 3 morning is too late |
| Sep 2, 16:00 ET | If C met early with 2.0h+ banked: restore S1, or bank the margin | Ad-hoc scope creep at the worst moment |
| Sep 2, 18:00 ET | Checkpoint C — **shoot the backup take regardless.** It is now the only video insurance | Replay Mode is cut; nothing else covers this |
| Sep 3, 09:30 ET | Feature freeze | Every post-freeze commit reopens R8 |
| Sep 3, 11:00 PT | Submit as-is, imperfections included | Not submitting scores zero |

---

## RECONCILED PASS 2 - 2026-09-01

First reconciliation this file has received. It was the only file in the set with no
`## RECONCILED` block and **zero references to `04`**, while being the file that tells the builder
what to build.

- **D15 · C2 now transcribes `04` §3's sanitizer.** It specified a pure function returning
  `{neutralized, findings}`. `04` §3.3 already wrote and executed one returning
  `{clean, events, attempts}` / `{id, sections, events, integrity}`, keyed to `REDACTION_RE` and the
  exact literal `[[REDACTED:NON_MANUSCRIPT_DIRECTIVE#n]]` that `04` §5 makes the hard match barrier
  the containment invariant rests on. A third interface would have re-opened seam 5 at build time,
  on Day 1 evening, inside Checkpoint B. The deliverable is `04` §7.3's S1-S7 table re-run.
- **D16 · C3 now transcribes `04` §4's verifier and `04` §3.1's SEVEN-step normalizer.** It said
  "NFKC, whitespace, curly-quote, case folding" — four steps, the list seam 3 was fixed to remove.
  The missing `strip-format-characters` is, per `04`:117-119, the only reason FX-1's zero-width
  payload is detected; build to four steps and FX-1 stops being caught and `04` §7.3's whole S-table
  goes red. The constants are imported from `src/core/constants.js`, never re-declared, so R4's
  "lower the fuzzy floor to 0.88" is one edit and not two.
- **D17 · C1 leaves the payload and decoy slots as placeholders.** It told Codex to author 3 payloads
  and 2 decoys. `04` §2 already authored them and `04` §7.3 **measured** their removal lengths at
  232, 251 and 263 — figures now frozen on camera in `05` §3.5, §3.6, §11.2 and `07` §1. Fresh prose
  would make those numbers false in three files. `02`:807-808 already said `04` owns that text.

---

## RECONCILED PASS 3 - 2026-09-01

- **E6 · §7 Referee Minimum re-derived.** The coordinator ruled that the fallback may cut nothing
  that breaks `01`'s MUST list and nothing that invalidates `02` §3.5's executed ranking arithmetic.
  **corpus 12 → 4**, **rubric criteria 4 → 2** and **queue → `<select>`** are now named FORBIDDEN
  CUTS with the criterion each breaks cited (§7.1); the third was found by derivation, not handed
  down. The remaining cuts are re-derived and **priced for the first time at 2.25h**, and §7.3 states
  plainly that **no valid fallback exists below the MUST line** for the two triggers §7 actually
  exists to absorb, together with what the MUST list would have to give up for one to exist. The old
  §7 stated no total at all, so it appeared to close a hole it had never measured.
  **Consequence for the README:** its "all 39 acceptance criteria observably passing" promise is now
  consistent with §7 in both branches — §7 no longer voids any acceptance criterion, so there is no
  list of voided ACs to publish. R9's full-day row was corrected to match.

**Not fixed here, and still open.** The §0.2 port price (5.25h) is left as written;
`99-verification-delta.md` §3.2 argues it bottom-up at 11.0h. That is an estimate dispute, not a
contract inconsistency, and R13 already carries it.

---

# BUILD STATUS — 2026-09-01, appended at initial commit

The plan above is preserved as written. This block records what was actually built against it.
Where the two disagree, this block is current.

## Complete and verified

| | Gate |
|---|---|
| Test suite | 13 files · 323 tests · 323 pass · 0 fail |
| Blinding guard | PASS — no guarded module reaches identity |
| Guard selftest | 12/12 fixtures behaved as required |
| Acceptance | 20 automated PASS · 0 FAIL · 0 BLOCKED · 26 MANUAL |
| Sanitizer vs. real corpus | 4 instances · 3 manuscripts affected · 9 clean · both decoys unflagged |
| Tool registration | `registerAll` resolves to 7, seven names, no eighth, D3 annotations asserted |

**Lanes delivered:** core (state, ledger, ranking, bus, capabilities, corpus access, identity),
UI behavior (bindings, activity, clipboard, states), UI presentation (`theme.css` + 13 render
modules ported from `design/direction-a.html`), scripts (blinding guard, selftest, runner,
acceptance), scaffold (license, package, host configs, docs), corpus (12 manuscripts, 13,056
words, 4 payloads + 2 decoys spliced), sanitizer, evidence verifier, and the seven tool handlers.

**Composition root** (`src/main.js`) wires the adversarial layer, builds capabilities without any
path to identity, and injects `normalizeText` into `registerAll`.

## Deviations from the plan, and why

- **The UI was not ported to modules from a written spec.** A finished visual reference
  (`design/direction-a.html`) was built first and the interface was ported from it. The plan
  priced this task at 10.0h as a from-spec build and later at 5.25h as a mechanical port; an
  audit found the latter optimistic because the reference was a visual artifact with one
  data-driven region. Actual work landed between the two.
- **The corpus moved off Codex.** Its first pass produced minified source at roughly 8% of the
  target word count and passed its own validators doing it, because those validators measured
  shape rather than substance. Rewritten in-session at 13,056 words.
- **The sanitizer, verifier, and tool handlers also moved off Codex**, on the grounds that the
  tool layer is the code a judge opens to score WebMCP Leverage.
- **`runSimulation` and Replay Mode were cut.** Two sections specified opposite designs for a
  surface that appeared in neither the feature list nor the budget.
- **§7 "Referee Minimum" was never invoked.** An audit established it could not close without
  breaking the MUST list, so it was reclassified as a contingency that does not exist below that
  line rather than as a plan.

## Remaining — none of it code

1. Deploy, then Task 0 in both target browsers, recorded in `docs/environment-check.md`.
2. Fill the `[FILL:]` placeholders in `scope/07-submission-kit.md`.
3. Rework the video opening: organizer guidance is to show the project working in the first
   10–15 seconds and skip intros; the current shot list opens on a static room and does not
   reach the refusal beat until 0:34.
4. Walk the 26 manual acceptance rows, AC-37 first — the three-way honesty-text diff, which the
   checker deliberately refuses to automate.
