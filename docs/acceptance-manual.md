# Manual acceptance record

`node scripts/check-acceptance.mjs` settles 20 rows and prints MANUAL for 26. This file is where
the 26 get walked, and it exists so a row is either marked with what was observed or visibly still
open. A blank row is an open row. "It looked right" is not an observation.

**Automated state, 2026-09-03:** 46 rows · 20 PASS · 0 FAIL · 0 BLOCKED · 26 MANUAL.
Unit suite 323/323. Blinding guard PASS, selftest 12/12. Corpus check PASS.

---

## Settled by script, 2026-09-03

Two rows were marked manual only because the script they name did not exist. It does now:
`scripts/check-corpus.mjs` (`npm run corpus`). Neither needs a browser, an agent, or a rendered UI.

| Row | Verdict | Observed |
|---|---|---|
| **AC-15** | **PASS** | Seeded manuscripts neutralize at the addresses `01` §5 fixes. `MS-102` 2 attempts `[abstract, discussion]`; `MS-107` 1 `[related_work]`; `MS-110` 1 `[data_availability]`. Four payloads on three manuscripts, matching the README. Every affected section carries a redaction token; no unaffected section carries one. |
| **AC-16** | **PASS** | The other nine report `injection_attempts: 0` and an empty `sections_affected`, **including both near-miss decoys, `MS-106` and `MS-109`.** Nine zeros where two were written to look adversarial is the evidence that the detector discriminates rather than matching vocabulary. |

The expectations in that script were written from `01` §5 and `04` §2, not read back out of the
sanitizer. A checker that derives its expectations from the code under test measures nothing.

## Settled by hand, 2026-09-03

| Row | Verdict | Observed |
|---|---|---|
| **AC-37** (residual) | **PASS** | Four-way diff of the honesty boundary: `scope/04-adversarial-layer.md` §8, the About panel constant `HONESTY` in `src/ui/render/tools.js`, `README.md`, and `docs/devpost-draft.md`. Raw lengths 1035 / 1033 / 1035 / 1035. The two-character delta is the markdown backticks around `untrustedContentHint`, which the plain-text UI string does not carry; the UI string also uses typographic apostrophes where the markdown uses straight ones. With backticks stripped and quotes folded, **all four are 1033 characters and identical**. No surface claims injection is solved, prevented, or blocked in general — the automated half of AC-37 covers that and passes. |

---

## Open — requires a live browser and an agent

Run against **https://referee-psi.vercel.app**, not a local server. Local static servers do not
reproduce either target environment's agent boundary. Record what the agent actually returned.

The five prompts on the page's right-hand rail drive most of these in order. Working through the
rail once, in the ChatGPT desktop in-app browser, should settle the majority in a single pass.

| Row | What to observe | Verdict | Observed |
|---|---|---|---|
| AC-1 (residual) | Registration inside a real Chrome 149+ modelContext with the flag on, and the count the browser itself reports | | |
| AC-2 | The same seven in the ChatGPT in-app browser; the chip reads `WEBMCP LIVE 7/7` in both | | |
| AC-3 | Every tool returns a JSON string parsing to an object carrying `ok`, on valid and invalid calls; nothing throws into the agent | | |
| AC-4 | `read_manuscript` over all twelve returns zero matches for any identity value. **See `01` §4: this row's value comparison is the one `02` §2.5 forbids in code. Do it by eye, do not write a verifier for it.** | | |
| AC-5 (residual) | Every payload and the rendered chip carry the same frozen nine-name `blinded_fields` array | | |
| AC-7 | `read_manuscript(M)` and `get_review_state` byte-identical before and after a human unblind | | |
| AC-8 | A verbatim quote is accepted and appears on the findings board with the span highlighted | | |
| AC-9 | A fabricated quote is refused `EVIDENCE_NOT_FOUND`, creates no finding, moves no score | | |
| AC-10 | A real quote attributed to the wrong section is refused `EVIDENCE_NOT_FOUND` | | |
| AC-11 | Curly quotes, dashes, NBSP, doubled whitespace, case, and a zero-width character all normalize to an accepted quote | | |
| AC-12 (residual) | The handler actually refuses with `QUOTE_TOO_SHORT` | | |
| AC-13 (residual) | The fuzzy accept/refuse behaviour at 0.92 and the badge | | |
| AC-14 | Refusal payloads carry no manuscript text, no count derived from a blinded field, no similarity score | | |
| AC-17 | No tool return across twelve manuscripts and seven tools contains the raw payload text | | |
| AC-18 | The split-screen shows raw payload against neutralized text, each attempt marked in place | | |
| AC-19 | A tool called with no UI mounted still returns cleaned text and a populated integrity block | | |
| AC-20 | Each of the seven tools, called once, produces exactly one ledger entry per call, refusals included | | |
| AC-21 | Each entry carries `actor`, timestamp, `outcome`, `visible_fields_at_time` | | |
| AC-22 (residual) | The four human moves write the four live verbs at runtime | | |
| AC-23 (residual) | Monotonic ids and reset semantics at runtime | | |
| AC-24 | The ledger view renders in call order and copies to the clipboard as text | | |
| AC-25 (residual) | `request_unblind` handler behaviour and its ledger row | | |
| AC-26 (residual) | `flag_for_editor` handler behaviour and its ledger row | | |
| AC-27 | The human commit control with a verdict and rationale sets `committed`, locks the control, appends `actor:"human"` | | |
| AC-28 | After commit, `get_review_state` reports that manuscript as committed | | |
| AC-29 | Moving a rubric weight slider re-orders the queue within the same frame, no reload, no button | | |
| AC-30 | Restoring a weight to its prior value restores the exact prior order | | |
| AC-31 | Setting one criterion weight to zero removes its contribution, against a hand-computed value | | |
| AC-32 | Weights survive reload from `referee.state.v1` | | |
| AC-33 | Reset clears `referee.state.v1`, empties ledger and findings, restores defaults and all twelve | | |
| AC-34 | After reset the corpus is byte-identical to first load | | |
| AC-35 | Reset requires one confirmation step | | |
| AC-36 (residual) | The reader and queue actually render the fictional label | | |
| AC-38 (residual) | Zero network requests with the network panel open through a full session | | |
| AC-39 (residual) | The Task 0 observation recorded in `docs/environment-check.md` is true | | |
| ENUM-RECOMMENDATION (residual) | `submit_recommendation`'s `inputSchema` uses the enum as the executed gate | | |

**If a row fails, write the failure here rather than deleting the row.** A submission that names a
failing row is more credible than one whose checklist is uniformly green, and this project's whole
argument is that the boundary is inspectable.
