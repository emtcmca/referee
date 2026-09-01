# 99-DELTA — Adversarial Re-audit After the Reconciliation Pass

**Verifier:** independent. Did not author any of 00–07, did not perform the reconciliation, did not
write `06` rev 3 or the mockup.
**Method:** every seam re-checked against the **current literal text**. `## RECONCILED` blocks and
`CUT` banners were read as *claims* and never as evidence; each ruling was confirmed by reading the
underlying line it claims to have changed, or its successor. Arithmetic was re-derived by hand, not
accepted. The mockup was opened and measured.
**Prior state:** NOT VERIFIED · 13 of 15 seams N.

---

## VERDICT: **NOT VERIFIED** · BLOCKING: **yes**

The reconciliation was substantially real. It is **not** over-reported on the four seams the brief
singled out — 4, 6, 7 and 11 are genuinely closed, and I re-derived `02` §3.5's arithmetic from the
seed table rather than trusting it. Eleven of the thirteen failing seams are now Y. That is a large,
honest repair and it should be credited.

It fails anyway, on four counts, and the first is the reconciliation's own work.

1. **It reproduced its headline defect one layer down.** Moving `Finding` from persisted to
   ledger-derived was the right call. Nobody then checked that `02 §1.11`'s replay predicate matches
   `03 §3`'s writer. **`02:190-191` selects ledger rows on `outcome === 'ok'`; `03:677` — the only
   writer — stamps `outcome: "accepted"`.** The predicate matches zero rows and the findings board
   is permanently empty. That is the same fail-closed shape as the `!v.verified` bug this pass was
   convened to repair.
2. **`06` was never reconciled at all.** It is the only file in the set with no `## RECONCILED`
   block, it contains **zero references to `04`**, and it still instructs Codex to build the
   sanitizer and the verifier from scratch to a third interface and a four-step normalization that
   omits the format-character strip `04` says the detection depends on. Seam 3 is fixed in the specs
   and unfixed in the one file that tells the builder what to build.
3. **Seam 13 did not close and is now materially worse.** `06` was rewritten by the planner *after*
   the README was reconciled to it, and the two now disagree on the identity of every Codex slice.
   `C6` names two different jobs in the two files — "the mechanical AC sweep" (README, ~1h) versus
   **"THE SEVEN TOOL HANDLERS"** (`06`, 4.75h, critical path). README additionally states that the
   tool handlers *stay with Eric*, which is the exact reallocation `06` rev 3 exists to make.
4. **New drift the reconciliation introduced or left, on camera.** `05`'s money-shot beat prints
   `CHARACTERS REMOVED 148` where the same file twice says 483; `05`'s beat sheet says "three
   hatched strips" one row after saying "nine fields"; the mockup — now promoted to a source
   document by `06` rev 3 — still renders the deleted refusal code `BLINDED_FIELD`; and `05:1451`
   still tells the builder to *promote* Replay Mode ahead of the Verdict Bar if the tool path
   wobbles, three hundred lines after Replay Mode was rescinded.

And the contract itself — *"no further design decisions"* — is refuted by the files' own words. Two
items are marked **UNRESOLVED, ESCALATED** and left for someone else (`05` §14 note 4; `02`'s note on
`01` AC-4). That is honest, and it is still an open design decision inside a set that claims none.

---

## PART 1 — DELTA ON THE 15 SEAMS

| # | Seam | Prior | Now | Evidence | If still N, what remains |
|---|---|---|---|---|---|
| 1 | Tool names — exactly seven | Y | **Y** | Swept all nine files by count: all seven names present with no renames and no eighth tool. `grep -ohE '\b[a-z_]+\(inputs'` returns only `execute(inputs` and `parse(inputs`. No regression. | — |
| 2 | Blinding structural, not masked | N | **N** | (a) FIXED: `04:888` now reads `state.unblinded`; `state.ui.unblinded` survives only in correction prose (`04:892`, `04:1090`). (b) UNFIXED and self-declared so: `05:822-823` still derives strip width from "the longest withheld value on the human side" `Math.min(160, 6 + len*5.6)`, `05:859-860` repeats it at `Math.min(96, 6+len*3.2)`, and `05:1508` labels §14 note 4 **"UNRESOLVED, ESCALATED"**, `05:1626` **"Escalated, not decided."** | `ui/slate.js` still needs identity string lengths; `02 §2.4` step 6 permits exactly one importer, `src/ui/identity-panel.js`. Two escape hatches named, neither adopted, and `02` — the owner — never picked it up. **New:** `04:881-883`'s I1 grep permits *all* of `src/ui/` and names `src/data/manuscripts_identity.js` where `02:421` says `src/corpus/manuscripts.identity.js`; `05:243` routes the identity block through `ui/identity.js`, a third name the guard's step 6 fails on. |
| 3 | Evidence constants + normalization steps | N | **N** | FIXED in the specs: `03:1907-1909` and `03:1377-1378` now list all seven steps in `04 §3.1`'s execution order including `strip-format-characters`; `01` AC-11 and `07:283` match; `03`'s local `const MIN_LEN` is gone (`03:1839` imports from `core/constants.js`). | **`06 C3:153` still reads "NFKC, whitespace, curly-quote, case folding"** — four steps, missing the format strip and the separator fold, and `grep -i "strip\|zero-width\|format char" 06` returns nothing. This is the build instruction. Constants went 3 sites → 2: `04:650-651` still redeclares `MIN_QUOTE_CHARS = 40` / `FUZZY_THRESHOLD = 0.92` in `src/adversarial/verify.js`, and `06 R4`'s mitigation ("lower the fuzzy floor to 0.88") would have to be applied in two files. |
| 4 | Which text a quote verifies against / `verifyQuote` contract | N | **Y** | Verified line by line, not by banner. `03:1876` calls `verifyQuote(manuscript_id, section, evidence_quote)` and branches on `v.ok` / `v.code` only; the handler reads `v.normalized_length` (1884, 1905), `v.min_chars` (1885-86), `v.method` (1961), `v.score` (1962), `v.char_offset` (1964) — **every one of which `04:731-797` returns.** `v.verified`, `v.similarity`, `v.threshold`, `v.normalized_quote` are gone. `char_offset` is returned on both accepting paths (`04:760`, `04:783`) via the new `normalizeWithMap` (`04:312`, `04:713-717`), with S11 asserting `normalizeWithMap(x).norm === normalizeText(x)`. `best_similarity: 0.71` is gone from the refusal payload (`03:1393-1396`). | — (two low-severity residues below) |
| 5 | Injection containment | N | **N** | Both named defects FIXED: exactly one redaction literal tree-wide (`04:410-411`; `03:1105/1108` now emit it; `[NEUTRALIZED: …]` survives only in `03:1128`'s correction note). Writer of integrity events now agrees three ways — derived in memory, not persisted, no handler reads or writes (`02:342-346`, `03:151-156`, `04:598-605`). | **`IntegrityEvent`'s record shape diverges from its declared owner.** `02 §1.10:348-360` says it owns the shape and specifies `{id:'IE-003', manuscript_id, section_id, detected_at, pattern_id, raw_excerpt, neutralized_excerpt, char_start, char_end, surfaced_to_agent}`. `04:531-542` emits `{id:'MS-102:abstract:1', manuscript_id, section_id, span_index, families, technique, raw_excerpt, raw_offset, replacement_token, detector_version, detected_at}`. **Four field names in common.** `05:1518-1520` — the split-screen, the money shot — positions both panes off `raw_offset` and `replacement_token`, which exist only in `04`. And `02:361` says `surfaced_to_agent` is asserted by §2.5's runtime guard; `04` never emits it, so the assertion has no subject. Also: key spelling `state.integrityEvents` (`02:387`, `04:600`) vs `integrity_events` (`03:154`, `04:842`, `04:885`, `05:537`); module path `src/core/sanitize.js` (`02:345`) vs `src/adversarial/sanitizer.js` (`04:12`, backed by `01:132`, `07:248`); "built once at boot" (`02:345`) vs lazily memoized on first call (`04:558-559`). |
| 6 | Injection fixture slots | N | **Y** | All six placements verified in both files. `02:824` MS-102 `abstract [INJ]` + `discussion [INJ]`; `02:829` MS-107 `related_work [INJ]`; `02:830` MS-110 `data_availability [INJ]`; `02:828` MS-106 `data_availability [DECOY]`; `02:831` MS-109 `related_work [DECOY]`. `04:1002-1008` S1–S6 match slot for slot, with S5/S6 at `attempts === 0`. `data_availability` is now legal in **both** section sets — `02:92-93` and `03:259-260`, eight ids, identical. MS-102's two payloads are counted as two everywhere: `04` S7 (`attempts === 2`, `['abstract','discussion']`), `01:177-178`, `02:836-838`, `02:968`, `05:1396-1399`, `07:59`. `04:1016-1018` states four instances / three manuscripts and `01` AC-15 counts three. | — (but see the `148` defect in Part 2 — the *derived* on-camera total was not chased) |
| 7 | Refusal codes — frozen set | N | **Y** | `EVIDENCE_TOO_SHORT` → `QUOTE_TOO_SHORT` and `UNKNOWN_SECTION` → `SECTION_NOT_FOUND` in `04`'s implementation (`04:744`, `04:736`, `04:811-813`). `02:275` declares `UNKNOWN_SECTION`, `UNKNOWN_CRITERION`, `SESSION_COMMITTED`, `MALFORMED_INPUT` **dead** and imports `03 §1.3`'s set. `BLINDED_FIELD` is **deleted, not renamed** — it appears in `05` only at `:413-414` and `:1600`, both of which are the deletion notice; zero live uses. `PROBE_REFUSAL` remains scoped to the probe page (`06:143`), which is correct. | — (but the deleted code survives in the mockup — Part 2) |
| 7b | `REQUIRES_HUMAN` vs `HUMAN_ONLY` | N | **Y** | Un-inverted at all four `05` sites: `:403-404` summary copy, `:936` unblind flow, `:1017` commit flow, `:1411-1412` beat sheet. Matches `01:212-214`, `03:429-430`, `04:905/907`, `07:143/145`, README:23. | — |
| 8 | `execute` returns `JSON.stringify`; refusals returned | N | **Y** | `loadState()` moved inside the `try`: `03:655` `let state = null;` then `03:707-708` `try { state = loadState();`, with `03:659-662` naming R10 as the reason and `03:818` confirming the catch now covers it. `01:101-107` rewrote AC-3 to "a JSON string that parses to a structured object," and explicitly retracts "no tool returns a bare string" against `00 §D1`. | — |
| 9 | `annotations` — 00 D3 vs all seven | Y | **Y** | Re-checked all fourteen booleans. `00:98-106` vs `03:918` (T/F), `:1049` (T/T), `:1236` (F/F), `:1491` (T/T), `:1585` (T/F), `:1678` (F/F), `:1773` (F/F). Identical. `04:82` states the same 2-true / 5-false `untrustedContentHint` split. `05:1334` and `05:1524` read it back from the registry. No regression. **Improved:** `07 §2:147` now carries the annotations story that was previously omitted. | — |
| 10 | localStorage — one key, seven keys, shapes | N | **N — and the regression is the worst defect in the set** | The *persisted-vs-derived* question is genuinely settled (evidence below), but **the reconciliation moved `Finding` from persisted to ledger-derived without reconciling the ledger row it now derives from.** Three confirmed splits: (i) **`02:190-191` replays the ledger for `action === 'assert_finding' && outcome === 'ok'`, and `03:677` — the only writer — writes `outcome: result.ok ? "accepted" : "refused"`**, reading it back as `e.outcome === "accepted"` at `03:354`. `02`'s predicate matches **zero rows**; the findings board is permanently empty. Same fail-closed shape as the `!v.verified` bug this pass repaired, in the feature that replaced it. (ii) `LedgerEntry` has two shapes: `02:246-258` declares `detail` and `integrity`, which `03:672-681` never writes; `03:174-186` writes `args_digest` and `note`, which `02` never declares. (iii) `Finding` shares **no** field names: `02:193-212` `{id:'F-000007', section_id, criterion_id, match:{method, **similarity**, char_start, char_end}, actor}` vs `03 §5`'s `{finding_id:"f_"+8hex, section, criterion, verification:{method, **score**, char_offset}, severity, score, status}` — and `similarity` is the exact name `03:1313` declares dead. `05:1503` reads `f.status === 'active'`, a field `02`'s record does not have. `02 §1.7` and `§1.9` were never chased when seam 4 renamed the verification fields. | Pick one `outcome` domain, one `LedgerEntry` shape and one `Finding` shape, and re-check `02 §1.11`'s replay against `03 §3`'s writer. Nothing downstream of the ledger works until this is one thing. |
| 10a | *(the part that did land)* | — | **Y** | Seven keys agree in name and shape across 02/03/05. `scores` is `{crit:{value,set_by,updated_at}}` in both (`02:377`, `03:303-307`, and `03:1943` reads `.value`). `unblinded` is `{id,reason,at}` records and **every reader was updated** — `02:290-292` `.some(u => u.id === …)`, `04:888-892` (retracting `state.ui.unblinded`), `05:924`; `03:209-211` asserts `visibleFieldsFor` never reads it. `committed` stays singular in all three. `acceptSlots` has a home at `rubricWeights.acceptSlots` and `validatePersisted` admits it (`02:690`, `02:765-768`, `05:1494-1497`). `findings`/`editorFlags`/`humanEvidence` are ledger-derived everywhere; `03:330-335` explicitly retracts persistence and `03:1847` says "There is no `state.scores[*].findings` array to push to." | — (one field-name bug in Part 2) |
| 11 | Ranking math, the re-rank event | N | **Y** | **I re-derived all 24 composites by hand from `02:861-872`'s seed table.** At `{30,35,15,20}`: 8.65 / 8.70 / 5.90 / 7.25 / 6.85 / 6.90 / 5.60 / 6.25 / 5.10 / 4.70 / 4.20 / 2.50 — matches `02:605-616` to the cent. Adjacent gaps reproduce as `0.05, 1.40, 0.35, 0.05, 0.60, 0.35, 0.30, 0.50, 0.40, 0.50, 1.70`; exactly two near-tie pairs; blocking-flagged count is 7. At `{50,25,10,15}`: 8.75 / 8.50 / 7.05 / 6.90 / 6.90 / 6.35 / 5.70 / 5.60 / 4.50 / 5.35 / 3.55 / 2.35 — matches `02:628-639`, top two swap, MS-103 7→3, MS-104/105 tied at 6.90 and separated by the id tiebreak. Cut at `acceptSlots:4` — MS-106 4→6 crosses **down**, MS-103 7→3 crosses **up**: two crossings, opposite directions, as `02:647-650` claims. `05:1410` and `07:44` now film **that** event with those exact numbers. `05:1378-1388` retracts the self-contradictory "3.0 gap" / "within 2.0" pair and adopts the 0.05 cut gap; `05:1389-1395` retracts ranks 2/6/9 and adopts `02`'s 1/8/10, which the seed table confirms (MS-102 r1, MS-107 r8, MS-110 r10). Score scale is 0–10 everywhere (`03:944` explicitly "NOT a 0..5 or 0..100 scale"; `05:694`, `05:1376`). | — (but `05:1409`'s derived total is stale — Part 2) |
| 12 | Corpus size and identity | N (identity) | **Y** | Single namespace `MS-101..MS-112` (`03:270-273` now imports rather than re-declares). Single criterion set `novelty, rigor, clarity, reproducibility` (`02:379`, `03:266-268`); `03`'s `INVALID_CRITERION` example was flipped to `"significance"` with the reason stated (`03:1449-1452`). `IMPACT` survives only as `05:667` "**`IMPACT` is not a criterion**". Eight section ids, identical in `02:91-93` and `03:262-265`; `title` deleted (`03:279-281`). | — (but `06 §7` still deletes criteria 4→2 and corpus 12→4 — Part 2) |
| 13 | Ownership — README §2 vs `06 §1` | N | **N — worse than before** | README:45-56 lists six slices "as of `06` revision 2" plus a "Task 21" review gate. `06` is **revision 3** with **eight** Codex slices. **`C6` names two different jobs:** README:55 "The mechanical AC sweep against the deployed build" vs `06:154` "**THE SEVEN TOOL HANDLERS** … 4.75h … **[CP]**", which `06:158` (Task 8 deps `C6,7`) and `06:324` ("Never C6") both confirm is `06`'s real meaning. README's C6 is `06`'s C8. `C7` and `C8` are absent from README entirely. `06`'s actual Task 21 (`06:184`) is "Record. Budget 3 takes," owned by Eric. | Worse: **README:62 says "Anything touching cross-cutting state or requiring a judgment call stays with Eric: the tool handlers, the ledger, the UI"** — a direct contradiction of `06` rev 3's Change 1, in the file that also says "Codex: do not implement outside your named assignments without asking first." README:50 also has C1 leaving the payload slots "as placeholders" (correct per `02:807-808`) while `06:151` has C1 authoring them. README's `## RECONCILED` block claims the table was "Replaced with `06`'s" — it was not. |
| 14 | Cut line — MUST/SHOULD/WON'T | N | see Part 1a | (a) FIXED: `01:443-444` and `05:1613` restore AC-24 (ledger copy-to-clipboard); `06:400` keeps "the append-only ledger with copy-to-clipboard" in the non-negotiable list. (c) FIXED: `05:297-303` deletes both sub-tablet tiers outright — "removed rather than deferred" — and `05:1476` confirms; `01` W11 stands. | (d) remains: `06:405-406` still deletes corpus 12→4 and criteria 4→2 in the contingency, which voids `01` AC-15/AC-16 and the four-criteria MUST, and nothing in `01`, `06` or README states which criteria are voided if §7 fires. See Part 1a for (b). |
| 15 | AC-1..AC-39 | N | see Part 1a | Several individually repaired; the set is not clean. | See Part 1a. |

### 1a. Seam 14 / seam 15 detail

**Seam 14 (b) — the ledger degradation** is resolved by construction: `06` rev 3 no longer has a
"Task 17 = ledger" row at all (Task 17 is now the Devpost edit), and `06:400` keeps
"the append-only ledger with copy-to-clipboard" in the §7 non-negotiable list. `05 §13`'s never-cut
items therefore have nothing degrading them. **Y.**

**Seam 14 (d) — still N.** `06:405-406` deletes "corpus 12 → 4 … rubric criteria 4 → 2" under
Referee Minimum. `01`'s four-criterion rubric is a MUST and AC-15/AC-16 count three injected
manuscripts. `06` is the only file in the set with **no `## RECONCILED` block**, and nothing in
`01`, `06` or README names which acceptance criteria are voided if §7 fires, while README:180 still
promises "All 39 acceptance criteria … observably passing."

**Seam 4 — two low-severity residues** (they do not reopen the seam; note them):

- `03:1892-1913`'s `!v.ok` branch collapses `UNKNOWN_MANUSCRIPT`, `SECTION_NOT_FOUND` **and
  `INTERNAL`** into `EVIDENCE_NOT_FOUND` with the message *"That quote does not appear in the
  section you attributed it to."* A verifier fault is therefore reported to the agent as a false
  substantive claim about the manuscript, and `03 §1.3`'s `INTERNAL` never reaches the agent from
  this path. On those three `04` return paths there is no `normalized_length`, so
  `normalized_quote_length` serializes as `undefined`.
- **New code defect in the newly-added offset path.** `04:773-779` recovers the fuzzy `char_offset`
  as `n.indexOf(first)` where `first = tokens(n)[bestTok]` — the **first** occurrence of that token
  anywhere in the normalized segment, not the occurrence at `bestTok`. `fuzzyBest`'s anchor
  prefilter (`04:679-682`) starts windows only at tokens matching `qt[0]`/`qt[1]`, so a repeated
  anchor token is the likely case, not the exotic one. The exact path underlines the right span; the
  fuzzy path can underline the wrong one. `01` AC-8 and `05 §7.4`'s underline are both on camera,
  and `04 §7.2` has no fuzzy row whose first token repeats, so the suite would not catch it.

**Seam 15 — the ACs the prior audit named, re-checked one by one:**

| AC | Prior | Now | Evidence |
|---|---|---|---|
| AC-3 | ❌ self-refuting | ✅ | `01:101-107` rewritten to "a JSON string that parses to a structured object," retracting "no tool returns a bare string" against `00 §D1` by name. |
| AC-4 | ❌ orphaned | ❌ **ESCALATED, NOT DECIDED** | `01:116-117` still requires searching returns "for any author name … present in the identity store"; `02 §2.5` still forbids it; `02:1063` records it as *"Escalated rather than decided … Both texts left as their owners wrote them."* Nobody checks AC-4. |
| AC-5 | ❌ four arrays | ⚠️ **fixed in the constant, broken in the beat sheet** | `01:118-122` now mandates the nine-name `BLINDED_FIELD_NAMES` and "the chip renders all nine"; `05:813` and `05:852-861` comply. But `05:876` and `05:1407` still say **three** (Part 2.1), so the file that renders it contradicts the criterion in two places. |
| AC-6 | ❌ vacuous | ✅ | `02:485-517` walks **everything under `src/` except `src/ui/`**, by exclusion and deliberately; `01:124-129` and `07:252` restate it identically. `src/adversarial/` and `src/tools/handlers/` are now covered. |
| AC-8 | ❌ no offset | ✅ (with a bug) | `char_offset` now exists on both accepting paths. See the fuzzy first-occurrence defect below. |
| AC-11 | ⚠️ | ✅ in the specs, ❌ in `06 C3` | See seam 3. |
| AC-12 | ❌ | ✅ | `01:153-156` names `QUOTE_TOO_SHORT` as the frozen spelling and declares `EVIDENCE_TOO_SHORT` dead; `04:744` complies. |
| AC-13 | ⚠️ orphaned UI | ❌ **still orphaned, and now worse** | `01:157-161` now specifies the badge in detail — *"reads `FUZZY MATCH · 0.96` from `verification.method` and `verification.score`"* — but **`grep -i "fuzzy" 05-ui-spec.md` returns zero hits.** The UI spec has never heard of it, the port table has no line for it, and the mockup has no such badge. The orphan moved from "no file specifies it" to "`01` specifies a rendering its owner file does not contain." |
| AC-14 | ⚠️ contested | ✅ | `01:167-168` and `03:1393-1396` both adopt `04 §6`'s "No score on failure"; `best_similarity: 0.71` is gone. |
| AC-15 | ❌ | ✅ | `01:177-182` names MS-102→2 `['abstract','discussion']`, MS-107→1, MS-110→1, three manuscripts, four instances — matching `02 §6.1` and `04 §7.3` exactly. |
| AC-2 | not spot-checked | ❌ **new** | `01:100` requires the chip to read the literal **"WebMCP detected · 7 tools"**. That string exists in no other file. `05:1064-1067` has `WEBMCP LIVE 7/7` / `REGISTERING 3/7` / `WEBMCP UNAVAILABLE`; `03:2179` has `AGENT CONNECTED — 7 tools registered`. A literal-string criterion nobody implements. |
| AC-21 | ⚠️ divergent | ⚠️ **half fixed** | `visible_fields_at_time` converged: `02:290` and `03:199-201` both return `QUEUE_FIELD_PATHS` when `manuscriptId === null`. **But the entry it rides on has two shapes** — see seam 10 (ii). `02` declares `detail` and `integrity`; `03`'s writer produces neither. `05 §2.3` renders the summary line from that row. |
| AC-27 | not spot-checked | ❌ **new** | The four recommendation values split singular/plural. `01:66` and `03:1762`'s `inputSchema` `enum` say `accept, minor_revision, major_revision, reject`; `02:395`'s `Commitment` comment and `05:1011`'s human commit path say `minor_revisions, major_revisions`. The agent is validated against one set and the human writes the other, on the beat `05 §6.4` calls the closing shot. |
| AC-22 | ❌ three vocabularies | ⚠️ **one residue** | `01:200-204` and `05:930-933` both adopt `02 §1.9`'s closed six verbs, and `05` retracts `retune_rubric`, `integrity_inspected` and `request_unblind.approved` by name. **But `03:176` still documents `action` as `"tool name, or \"human:<verb>\""`** — the prefixed form, against `02:250-252`/`02:776`/`02:792`'s bare `'session_reset'`. A prefix mismatch on the field a ledger filter keys on. |
| AC-24 | ❌ MUST cut | ✅ in the spec, ❌ in the artifact | `01:443-444`, `05:1613` and `06:400` restore it. The mockup's `#btn-copy` has zero JS references (Part 3.2). |
| AC-25 / AC-26 | ❌ inverted | ✅ | See seam 7b. |
| AC-37 | ❌ four texts | ✅ | `04 §8` is named the single canonical text by `01:243-250`, `01:362`, `04:1024`, `04:1093` and `05:1335`; `07 §2:157` replaced its fourth wording with a `[PASTE: … verbatim, from 04 §8]` instruction. |

**Seam 10 — one live field-name bug.** `03:785` builds the `ALREADY_COMMITTED` refusal with
`committed_at: rec.at`. `rec` is a `Commitment`; `02:395-397` and `03:315` both give its timestamp
field as `committed_at`. `at` belongs to the `unblinded` record. Every `ALREADY_COMMITTED` refusal
ships `committed_at: undefined`. One-token fix.

---

## PART 2 — NEW DRIFT INTRODUCED BY THE RECONCILIATION

### 2.1 On-camera numbers the reconciliation did not chase

**`CHARACTERS REMOVED 148`.** `04 §7.3` S7 measures MS-102's two removals at **232 and 251 = 483**.
`05:602` and `05:608-609` were corrected to 483 and state the arithmetic explicitly. **`05:568` —
inside the ASCII wireframe of the removal stub — and `05:1409` — the beat-sheet instruction for
"the money shot," the beat `05` says runs 30 seconds and must not be shortened — both still print
`148`.** The fix landed in one of three places in the same file. A judge can add 232 + 251 on screen.

**"three hatched strips" versus nine.** `05:813` rules the count is nine and it is `02`'s;
`05:852-861` rebuilds §5.2 as nine rows in two columns; `05:1406` beat 1 says "nine fields, two
columns"; `05:1411` beat 6 says "The nine strips resolve into values." **`05:876` (§5.3, the
post-unblind state), `05:1400` (§11.2's composition rule, "the three blind strips have visibly
different widths") and `05:1407` (beat 2, "Blinding," 0:12–0:30) all still say three.** The beat
sheet contradicts itself between adjacent rows, on camera, in the beat whose entire job is showing
the blinding.

### 2.2 The mockup was promoted to a source document without being re-checked

`06` rev 3 makes `C:\dev\referee\mockup\referee-mockup.html` load-bearing — the whole 4.75h re-price
rests on it. The mockup was outside the reconciliation's file set and nobody swept it.

`referee-mockup.html:1242` renders, as visible UI copy in the thesis list:

> `<li><b>See.</b> Author identity is structurally absent from every tool return. … <code>BLINDED_FIELD</code></li>`

`BLINDED_FIELD` is the refusal code `05` R4 deleted and `03 §7.3` forbids the family of (*"There is
no `BLINDED_SECTION` code and there must never be one"*). It is a refusal code that names a blinded
field — precisely the oracle the blinding seam exists to close — and it sits in the artifact the plan
says will be ported mechanically. **`06`'s port table budgets 0.25h to fix the
`REQUIRES_HUMAN`/`HUMAN_ONLY` inversion, which `05` R5 already fixed and which the mockup already
gets right at `:1244`, and 0h for the one dead code that is actually in the artifact.**

To the mockup's credit, everything else checks out against the reconciled canon: ids
`MS-101..MS-112`, criteria `novelty/rigor/clarity/reproducibility`, `acceptSlots = 4`, `9 fields` on
the blind strip, `251 characters removed` on the second stub.

### 2.3 `runSimulation` / Replay Mode — the CUT banners did not close the dependencies

The brief's premise is right: both were banner-marked rather than excised, and **live text outside
the banners still depends on them.**

- **`05:1185` and `05:1190` sit ABOVE the banner, inside §8.4's live spec of the WebMCP-absent
  band.** `:1185` specifies the band's button copy as `[ Copy flag URL ] [ Watch the agent side ▸ ]`;
  `:1190` reads *"**`Watch the agent side ▸` starts Replay Mode (§8.5).** This is the difference
  between a judge seeing a static page and a judge seeing the product."* The banner at `:1198-1205`
  then rules that "the WebMCP-absent surface keeps **only** the status band and the registration
  pill." The band's own specification still ships a button wired to a rescinded feature.
- **`03:2181` and `03:2186`** likewise sit above `03`'s banner and are §6.2's live answer: the
  agent-transcript pane is *"replaced by a **Simulated agent session** panel … via a
  `runSimulation()` driver."* `03:2224` still routes "No agent present at all → §6.2" and `03:2297`
  still tells the builder to build "`register.js` + the absent-surface path (§6.2)." Build-order
  step 6 points at a section whose body is dead vocabulary.
- **`05:1205`'s own cleanup pointer is now dangling.** It says *"`06` §1 table row 7 ('Replay Mode +
  the WebMCP-absent band') is void as to Replay Mode."* The planner then rewrote `06`; its Task 7 is
  now "UI PORT PHASE 1." The reference resolves to nothing.
- **`05:1451` — build-order row 7 is an active instruction to build it.** *"Replay Mode + the
  WebMCP-absent band | **Promote ahead of 6 if the live tool path is still unstable by the middle of
  day two.** It is both the judge-without-the-flag path and the insurance policy for the video."*
  Never voided. This is the row `05:1205` tried to void, and `05:1205` cites `06` instead of `05`.
- **`03:2198-2204` — the OPEN CONFLICT block survives, immediately after the banner that resolves
  it.** *"**OPEN CONFLICT — not resolved in this pass, and it needs a decision before Task 15.** …
  Both are specified as owned, both are substantial … **Pick one and budget it.**"* Two adjacent
  paragraphs, one saying resolved-and-cut, the next saying unresolved-and-budget-it.
- **`05:379`** still carries a ledger-rail style row for `replay (see §8.5)`.

Nothing in `01`, `02`, `04`, `07` or the README depends on either. That part is clean.

### 2.3a The `Finding` / `LedgerEntry` regression — new, and created by the seam-10 fix

This is the most damaging item in the current set and it did not exist before the pass. `03 §0.8`
used to persist `findings: Finding[]`; the reconciliation correctly made findings ledger-derived per
`02 §1.11`. **It did not then check that `02`'s replay predicate matches `03`'s writer.**

- `02:190-191` — *"Rebuilt on load by replaying `SessionState.ledger` for entries with
  `action === 'assert_finding' && outcome === 'ok'`."*
- `03:672-681` — the wrapper, the only code path that appends a row:
  `outcome: result.ok ? "accepted" : "refused"`.
- `03:354` — `03`'s own reader: `e.outcome === "accepted"`.
- `02:254` — `outcome: 'ok', // 'ok' | 'refused'`.

**`02`'s predicate matches zero rows.** A build assembled from these documents accepts findings,
appends them, renders nothing on the findings board, and shows an empty Findings list beside a
ledger full of accepted rows — on camera, in `05 §11.3` beat 3, which holds three seconds on the
*absence* of a refused finding. The demo would read as though the evidence gate refuses everything.
It is the identical failure mode the pass was convened to fix, relocated one layer down.

The same non-chase left `02 §1.7`'s `Finding` carrying pre-reconciliation vocabulary: `similarity`
(the name `03:1313` declares dead in favour of `04`'s `score`), `char_start`/`char_end` (against
`char_offset`), `criterion_id`/`section_id` (against `criterion`/`section`), and no `status` field
for `05:1503`'s `f.status === 'active'` filter to read.

### 2.4 `05` §5.2 and §14.4 against `02` §2.4's import guard

Internally consistent, jointly unresolved. §5.2's narrower formula `Math.min(96, 6 + len * 3.2)` is a
coherent re-derivation of §5.1's `Math.min(160, 6 + len * 5.6)`; the nine-row two-column layout, the
~150px height, and the 1440×900 framing argument all hang together, and §14 note 9's "never a
shortened list" ruling is right.

**Both formulas take `len` from real identity strings, and neither is legal.** `02 §2.4` step 6 fails
the build unless `src/ui/identity-panel.js` is the *only* importer of `identity-access.js`, and
`05:241` renders the compact strip from `ui/slate.js`. `05:1507-1515` states this as **"UNRESOLVED,
ESCALATED,"** names two cheap fixes and adopts neither; `05:1626-1629` repeats it.

Three aggravations the escalation does not carry:

- **§5.1 and §5.2 state the formula flatly, as the design, with no caveat and no pointer to §14 note
  4.** A builder reading §5 implements the guard-breaking version and never sees the flag.
- **`02` never received the escalation.** It contains no mention of strip widths or a length-only
  accessor. The flag was written into the consumer and never landed with the owner it names.
- The mockup already chose an answer nobody ratified: it hardcodes `nameLen` onto each `MS` record.

### 2.5 The `unblinded` change to `{id, reason, at}` — every reader was updated

Clean. `02:290-292` (`.some(u => u.id === manuscriptId)`), `02:380`, `02:691`, `02:704-707`, `02:767`
(`validatePersisted`), `03:311`, `04:888-892` (retracting `state.ui.unblinded` by name), `05:924`.
`03:209-211` asserts `visibleFieldsFor` never reads it at all. No string-array reader survives
anywhere. **This is the model of how the other changes should have been chased.**

### 2.6 Terms changed in the owner, not chased into the consumer

The failure mode that produced the original thirteen is still present, at lower amplitude:

| Owner / current term | Consumer still carrying the old or divergent term |
|---|---|
| `04 §3.1`'s seven-step normalizer | **`06 C3:153`** — still the four-step list. This is the build instruction. |
| `02:13,25-26` `src/core/constants.js` as single source | `04:650-651` redeclares `MIN_QUOTE_CHARS` / `FUZZY_THRESHOLD`. `06 R4`'s "lower the fuzzy floor to 0.88" would need two edits. |
| `02:421` `src/corpus/manuscripts.identity.js`; sole importer `src/ui/identity-panel.js` | `04:881-883` names `src/data/manuscripts_identity.js` and its grep permits **all** of `src/ui/`; `05:243` routes identity through `ui/identity.js`. Three names, and `02 §2.4` step 6 fails on two of them. |
| `02:387` `state.integrityEvents` | `03:154`, `04:842`, `04:885`, `05:537` still write `integrity_events`. `03:154`'s invariant *"there is no `state.integrity_events` key"* is now true only on a spelling. |
| `04:12` `src/adversarial/sanitizer.js` (backed by `01:132`, `07:248`) | `02:345,432` `src/core/sanitize.js`. Here `02` is the drifted site. |
| `02 §1.10`'s `IntegrityEvent` shape (declared owner) | `04:531-542` emits a different record; `05:1518-1520` builds the split-screen on `04`'s names. |
| `05` R4 deleting `BLINDED_FIELD` | `referee-mockup.html:1242`. |
| `05` R5 un-inverting the two human codes | `06:57` and `06:164` still budget and task the fix. |
| `06` rev 3's Codex slice ids | `README.md:44-56`. |

### 2.7 Still undefined after the pass

- **`buildAgentPayload`** — still on the frozen `toolCtx` at `02:464`, handed to every handler,
  defined in no file. `recomputeScores`, `deriveFindings` and `getFindings` were all resolved
  (`03:221`, `03:339`, `05:1503`); this one was not.
- **`placeCutLine(listEl)`** — still called at `05:731`, still undefined. Minor: the mockup has
  `cutLineHTML()` plus inline re-placement at `:1418-1425`, so the port supplies it in practice.

### 2.8 Dangling text from the honesty sweep

Checked and clean. `07 §2:157` now replaces the fourth honesty-boundary wording with an explicit
`[PASTE: … verbatim, from 04-adversarial-layer.md §8]`, and `01:243-250`, `01:362`, `04:1024`,
`04:1093` and `05:1335` all name `04 §8` as the single canonical text — a genuine repair of AC-37.
`07 §2` also gained the `annotations` paragraph it previously omitted. I found no broken table row,
no orphaned list marker, and no now-unsupported transition left behind by a deletion.

---

## PART 3 — THE SCHEDULE

### 3.1 Re-added, every row

`06` rev 3's arithmetic is **correct**. I re-added all five tables by hand.

| Table | Rows | My sum | `06` states | |
|---|---|---|---|---|
| Day 1 Eric | 0.5, 0.5, 1.0, 1.0, 1.0, 0.75, 2.0, 0.75, 1.0, 0.75 | **9.25** | 9.25 of 12.0 | ✅ |
| Day 1 Codex | C1 3.0, C2 1.5, C3 1.5, C6 4.75, C4 0.5, C5 1.0 | **12.25** | 12.25 | ✅ |
| Day 2 Eric | 3.25, 0.5, 1.0, 1.0, 1.0, 1.5, 0.75, 0.25, 1.0 | **10.25** | 10.25 of 11.0 | ✅ |
| Day 2 Codex | C7 1.5, C8 1.0 | **2.5** | 2.5 | ✅ |
| Day 3 Eric | 1.0, 1.5, 1.25, 0.5, 0.5, 0.75 | **5.50** | 5.5 of 6.0 | ✅ |
| Three-day | 9.25 + 10.25 + 5.50 | **25.00** of 29.0, net **+4.00** | 25.00, +4.00 | ✅ |

The §0.2 port table also sums: 1.00 + 1.00 + 1.25 + 0.50 + 0.50 + 0.25 + 0.75 = **5.25**, distributed
correctly as Task 7 (2.0) + Task 11 (3.25). The rev-2 slip is genuinely repaired and rev 3
introduces no new one. **The addition is not the problem. The pricing is.**

One dead row inside it: the 0.25h line "Fix `05`'s `REQUIRES_HUMAN`/`HUMAN_ONLY` inversion" pays for
work `05` R5 already did and the mockup already gets right.

### 3.2 The central premise — is 5.25h defensible?

**Fantasy.** Not optimistic. The premise is factually wrong about what the artifact is.

The mockup is real work and much of it is excellent: 1,837 lines — 648 CSS, 625 HTML, 553 JS —
vanilla, no dependencies, 45 design tokens, 12 `@keyframes`, a 15-icon sprite, and a **genuinely
correct FLIP implementation** (`:1402-1505`) with a 14ms stagger, a reduced-motion branch, cut-line
crossing, and an 80ms `setTimeout` guard against rAF suspension in a backgrounded tab. The
split-screen's connector placement and bidirectional scroll-sync lock (`:1669-1709`) are real and
well-reasoned. The weighted-sum math reproduces `02` §3.5. Keep all of it.

**But it is a rendered visual reference with exactly one data-driven region, not an application.**
`#slate-list` is the only region rendered from data (`listEl.innerHTML = html`, `:1376`). Everything
else is typed markup:

- **No manuscript renderer exists at all.** `wireCards` (`:1380-1391`) sets `selectedId` and toggles
  `.is-selected` — **it never touches the Desk.** Clicking any of the other eleven cards changes
  nothing on the right. The Desk shows 65 lines of hand-typed MS-102 prose.
- **The ledger is 85 hand-written `.ev` fragments** with no row component; the counts (`14 events`,
  `Agent 9`, `You 5`, `Refused 3`) are literal strings.
- The Findings panel is three typed `<div>`s. `02 §1.11` derives findings by replaying the ledger.
- The verified-quote underline is `<span class="q-verified">` typed inline; §7.4 requires it drawn
  from `verifyQuote`'s `char_offset`.
- The split-screen anchors (`mk1/mk2/st1/st2`) are typed onto hand-placed elements; the real build
  derives them from `raw_offset` and `clean.indexOf(replacement_token)`.
- `'251 characters removed by the page'` (`:1172`, `:1639`) and `'Unblinded · 14:42 · reason on
  file'` (`:1776`) are string literals.

**Five declared ids have zero JS references** — each greps to exactly one hit, the declaration:
`#btn-copy`, `#btn-reset`, `#webmcp-pill`, `#status-calls`, `#ledger-count`. The masthead Reset and
the ledger **Copy-as-JSON** button are inert — and Copy-as-JSON is `01` AC-24, a MUST, which
`05 §13` lists as never-cuttable and which this same reconciliation restored to the MUST tier.

**Absent entirely, each verified by a grep returning 0:** `ResizeObserver`, `localStorage`,
`sr-only`, `assertive`, `inert`, `role="tablist"`, `<main>`, and every one of the five empty-state
strings. No `try`/`catch` anywhere, so §8.3's per-region error plates have no foundation. The
registration pill is one static `<span>` with no JS — none of its five phases exist. The Agent Pulse
decays once, on boot, from a single `setTimeout`.

The line-item table prices a swap that has nothing to swap into. Bottom-up, at the planner's own
narrowed scope: **11.0h**, roughly 2.1×. At full `05` conformance — including the 1024–1179
responsive tier, the off-paper-evidence affordance, a real commit flow, the five empty states, the
error plates and §9's a11y floor (which `05 §14` note 7 calls a shipping blocker): **~18.5h.**

The honest framing: the original 10.0h priced "build a 1,443-line design system from a written
spec," which is the *CSS and layout* half — exactly the half the mockup delivers. **The mockup
genuinely retires perhaps 4–5h of that 10, and the 10 was already low against this spec.** The
re-price got the direction right and the magnitude wrong, then landed on a number that closes the
plan by precisely the margin required. `06` §0.5 item 2 flags that pattern about itself. It is
correct and understated.

### 3.3 The line item most likely to blow

**"Replace seeded arrays with the real state module and corpus loader — 1.00h."**

Chosen not because it is hardest but because the overrun is a **certainty rather than a risk**, and
everything downstream is gated on it. Swapping the `MS` array for the real corpus yields a slate that
re-ranks correctly beside a Desk permanently showing MS-102 and a ledger permanently showing fourteen
events timestamped 14:21. Three renderers — manuscript, findings, ledger — must be *authored*, and
the ledger row is the component `05 §2.3` specifies in the most detail and `05 §13` forbids
degrading. **Realistically 3.0h, plausibly 4.0h.**

Runner-up, and the technical landmine, hidden inside the 1.25h bus line: **§7.4's accepted-finding
underline.** Character-offset → DOM-range splitting across rendered prose, with a marginal `◇` and
bidirectional click-to-scroll, is the hardest single piece of the UI slice; `05 §14` note 5 records
that the offset "was never computed before this pass"; and per Part 1a the fuzzy path's offset is
currently computed wrong.

### 3.4 "Keep the CSS as one file, split only the JS"

**Correct for the CSS, and it hides work on the JS.**

For the CSS the constraint is the cheapest risk reduction in the plan and I would not relax it: 323
rule blocks, 173 class selectors, 45 tokens, 359 `var()` references, 12 named `@keyframes` referenced
from a dozen places, and three custom properties that work only because of where they are declared.
Cascade order is the thing a mechanical split breaks silently, with no compiler to catch it.

For the JS, "split only the JS" presents it as separable. It is one IIFE whose 26 functions share
~20 closure variables and address 97 ids by literal string, with real cross-region reaches: `:1799`
**synthesises a click on another region's button** (`$('.chip-f.is-refuse').click()`) to cross-filter
the ledger; `renderRecv()` rewrites manuscript-prose DOM from view-bar code; `markCrossing()` reaches
out of a card into `$('.cut-line', listEl)`; `wireCards()` calls `openUnblind()` defined 370 lines
away. Replacing those reaches with bus events **is** the event-bus work already priced separately at
1.25h. The two line items overlap and neither price accounts for the other.

**And the constraint collides with a MUST.** The 1024–1179 tier does not exist in the CSS (`@media`
count: 4, all at 1439px or `prefers-reduced-motion`). Building it means adding CSS to the file `06`
R6 declares a scope-creep tripwire — "any commit touching CSS" — while `05 §1.4` says nothing is
removed at any supported width and `05 §13` withdrew the option of cutting a tier. The plan requires
the tier and marks the only file it can live in as untouchable. Unresolved.

**The plan's own R13 fallback is the better primary plan.** "Stop porting and ship the mockup as a
single file with state wired in" — wire real state into the existing DOM, add the ledger renderer,
the registration pill, the empty and error states, and an a11y sweep — is roughly **6–7h** and never
risks the FLIP, the scroll-sync lock, or the cascade. Module hygiene is the only thing the extra
hours buy, and no judge inspects it.

### 3.5 Codex at 12.25h on Day 1 — survivable?

**No, not as specified — and the exposure is worse than §0.5 says,** because the risk is not that
Codex is slow. It is that **three of Codex's five Day-1 slices are specified against a document `06`
has never read.**

`06` contains **zero references to `04`**. Yet:

- **C2 (1.5h)** tells Codex to build a sanitizer returning `{neutralized, findings}`. `04 §3.3`
  already wrote and executed one returning `{clean, events, attempts}` / `{sections, events,
  integrity}`, keyed to `REDACTION_RE` and the exact literal
  `[[REDACTED:NON_MANUSCRIPT_DIRECTIVE#n]]` that `04 §5` makes the hard match barrier the whole
  containment invariant rests on. A third interface re-opens seam 5 at build time.
- **C3 (1.5h)** tells Codex to build normalization as "NFKC, whitespace, curly-quote, case folding"
  — **the four-step list seam 3 was fixed to remove** — missing the format-character strip that
  `04:117-119` says is the only reason FX-1's zero-width payload is caught. Codex builds to `06`;
  `06` is wrong; FX-1 stops being detected; `04 §7.3` S1 and the whole S-table go red.
- **C1 (3.0h)** tells Codex to author 12 manuscripts "3 with authored injection payloads, 2 near-miss
  decoys." `04 §2` already authored those payloads and `04 §7.3` **measured** their removal lengths
  at 232, 251 and 263 characters — numbers now frozen as on-camera values in `05:602`, `05:608`,
  `05:1397`, `05:1617` and `07:59`. **If Codex authors different prose, those numbers become false in
  three files.** README:50 says C1 should leave the slots "as placeholders," which `02:807-808`
  confirms is correct (*"**04 authors the text for both, this file only reserves the locations**"*);
  `06:151` says otherwise, and `06` is the file README defers to.

The README fixed C2 and C3 to "**Transcribe** `04` §3's sanitizer and re-run its measured test table"
and "**Transcribe** `04` §4's evidence verifier and re-run its 14-row table." That is the right
instruction. `06` — the file both README and the working model designate as the source of truth —
never received it.

**If Codex delivers late or partially.** The shed order at `06:324` is "C5 → C4 → C1 manuscripts
7–12. **Never C6, and never C2/C3.**" That ordering is sound. The structural problem is the gate
chain: C6 (4.75h, the seven handlers) depends on Task 5 **and** on C2/C3; Task 8 (Checkpoint B)
depends on C6; and Checkpoint B trigger 1 fires §7 Referee Minimum that night if the handlers are not
integrated and green. So a C2/C3 slip cascades through C6 and Task 8 into a contingency that itself
deletes corpus 12→4 and criteria 4→2, breaking `01`'s MUST and AC-15/AC-16 — the seam-14 defect that
was never closed. **Eric's +2.75h of Day-1 slack cannot absorb any of it**, as `06:116` correctly
says.

And the more likely failure is not lateness. It is Codex delivering **on time and to spec** — a
`{neutralized, findings}` sanitizer with four-step normalization and freshly-authored payload prose —
at which point seams 3, 5, 6 and 11 all re-open on Day 1 evening, inside Checkpoint B, with 0.75h of
Day-2 margin behind them.

---

## VERDICT

**NOT VERIFIED · BLOCKING: yes.**

**Seams still N:** 2, 3, 5, **10**, 13, 14, 15.
**Seams repaired:** 4, 6, 7, 7b, 8, 11, 12. **No regression on 1 or 9.**
**Seam 10 regressed under the fix:** its persisted-vs-derived question closed; the derivation it
introduced does not match the writer.

The reconciliation was real and largely honest. It should be credited: the four seams the brief
singled out as most consequential are genuinely closed, verified against the underlying text rather
than the banners. It fails on `06`, on the README, and on a handful of on-camera numbers it changed
in one place and not another.

### Observable evidence

- `02` §3.5's ranking arithmetic re-derived by hand — all 24 composites, both weight settings, both
  near-tie pairs, the id tiebreak, the blocking count of 7, and both cut-line crossings. It holds.
- `03 §5`'s handler reads only fields `04 §4` returns; `char_offset` exists on both accepting paths.
- All six seam-6 fixture placements agree between `02 §6.1` and `04 §7.3`; `data_availability` is
  legal in both section sets; MS-102 carries two payloads in all six places it is counted.
- `BLINDED_FIELD`, `EVIDENCE_TOO_SHORT`, `UNKNOWN_SECTION`, `UNKNOWN_CRITERION`, `SESSION_COMMITTED`
  and `MALFORMED_INPUT` are dead in the spec set; `BLINDED_FIELD` is alive in the mockup.
- `06` rev 3's five hour tables re-add exactly to their stated totals.
- `02:190-191`'s replay predicate (`outcome === 'ok'`) against `03:677`'s writer
  (`outcome: result.ok ? "accepted" : "refused"`) and `03:354`'s reader (`=== "accepted"`).
- Markdown integrity across all nine files: 59 tables / 664 rows, zero pipe-count mismatches; no
  numbered-list or heading-number gaps; **two unterminated ` ```js ` fences in `03` (`:1248`,
  `:1290`) that render the following prose and headings as code.**
- The honesty sweep's own repairs: the exact-match claim (`07:283`), the 12× speedup line (deleted,
  not softened), `check_claim` "refuses nothing" (`07:200`), the two-vs-three refusals (`07:437`),
  and `04:19`'s row count — I recounted `04 §7.2` at V1–V14 and the header now says 14 rows / 15
  assertions. All five are genuinely fixed.
- The mockup's absences, each a grep count of 0: `ResizeObserver`, `localStorage`, `sr-only`,
  `assertive`, `inert`, `role="tablist"`, `<main>`, all five empty-state strings. Five ids declared
  and never referenced.

### Assessment (judgment, not demonstration)

- That 5.25h is fantasy rather than optimism rests on my reading of *how much* of the mockup is
  static. The composition facts are observable; the hour figures are my estimate.
- That Codex-on-spec is a likelier failure than Codex-late is inference from the gate chain.
- The severity ordering below weights on-camera visibility, which is a judgment about the demo.

### The three highest-severity remaining defects

**1 — `02`'s findings replay matches zero ledger rows. The findings board is permanently empty. HIGH.**
`C:\dev\referee\scope\02-data-model.md:190-191` against
`C:\dev\referee\scope\03-tool-contracts.md:672-681` and `:354`. `02` replays on
`outcome === 'ok'`; the wrapper stamps `outcome: "accepted"`. Compounding, in the same records:
`LedgerEntry` declares `detail` and `integrity` that nothing writes and omits `args_digest` and
`note` that everything writes (`02:246-258` vs `03:174-186`); `Finding` shares **no** field names
between `02:193-212` and `03 §5`, and still carries `similarity` and `char_start`/`char_end`, the
names seam 4 killed. **This is a regression created by the seam-10 fix and it is the same
fail-closed shape as the defect the pass existed to repair.** **Fix:** declare one `outcome`
domain (`03`'s writer is the executed one, so `"accepted"` wins), rewrite `02 §1.7`'s `Finding` to
`03 §5`'s emitted fields plus the derived `status`, and reconcile `LedgerEntry` to `03 §3`'s
writer. **5-minute:** change `02:191` to `outcome === 'accepted'` — that alone un-empties the board.
**1-hour:** the full three-record reconcile, plus a re-read of every `05` consumer of a ledger row.

**2 — `06` was never reconciled, and it is the file that tells the builder what to build. HIGH.**
`C:\dev\referee\scope\06-plan-and-risks.md` — zero references to `04`; `C2:152` specifies a third
sanitizer interface; `C3:153` specifies the four-step normalization seam 3 was fixed to remove;
`C1:151` has Codex authoring payload prose whose measured byproducts are already frozen on camera;
`§7:405-406` still deletes corpus 12→4 and criteria 4→2. **Fix:** add a `## RECONCILED` block;
rewrite C1/C2/C3 to README:50-52's "transcribe `04`, re-run its measured table" wording; state which
ACs §7 voids. **5-minute:** change C3's step list to the seven steps and C1 to "slots as
placeholders." **1-hour:** the full reconcile of `06` against `04`, plus the §7/AC ruling.

**2b — Seam 13: README and `06` disagree on every Codex slice, including who owns the handlers. HIGH.**
`C:\dev\referee\README.md:44-62` against
`C:\dev\referee\scope\06-plan-and-risks.md:151-156,173-174`. `C6` means "the mechanical AC sweep" in
one file and "**THE SEVEN TOOL HANDLERS**, 4.75h, critical path" in the other; C7 and C8 are absent
from README; README:62 says the handlers stay with Eric. Codex reads README first, and README's own
rule is "do not implement outside your named assignments." **Fix:** replace README:45-56 with `06`'s
eight slices verbatim, delete the "Task 21" row, change "revision 2" to "revision 3", and delete
"the tool handlers" from README:62's Eric-owns list. **5-minute:** yes — this is genuinely a
five-minute edit and it is the cheapest HIGH in the set. **1-hour:** not needed.

**3 — The UI port is priced at 5.25h against an artifact with one data-driven region. HIGH.**
`C:\dev\referee\scope\06-plan-and-risks.md:50-59` against
`C:\dev\referee\mockup\referee-mockup.html`. Line 2 ("replace seeded arrays") has nothing to swap
into: no manuscript renderer exists, the ledger is 85 typed fragments, the findings panel is three
typed `<div>`s, and AC-24's Copy-as-JSON button is inert. Bottom-up is 11.0h at the planner's own
scope. **Fix:** re-price to 11.0h and take R13's fallback — ship the mockup as one file with real
state wired in, ~6–7h — as the *primary* plan rather than the contingency. **5-minute:** add the
three missing renderers as explicit line items so the overrun is visible before Day 1 ends.
**1-hour:** re-derive the Day-1/Day-2 tables against 11.0h and decide the fallback now, while it is
a choice rather than a rescue.

**Runners-up, in order:**

| Defect | Where | 5-min | 1-hour |
|---|---|---|---|
| `05:1451` build-order row 7 still says **promote** Replay Mode ahead of the Verdict Bar | `05` | strike the row | — |
| `03:2198-2204`'s "OPEN CONFLICT … pick one and budget it" survives directly under the banner resolving it | `03` | delete the block | — |
| On-camera `CHARACTERS REMOVED 148` — the money shot | `05:568`, `05:1409` | 148 → 483 (and 232 in the stub art) | — |
| "three hatched strips" residue — beat 2 contradicts beat 1 | `05:876`, `05:1400`, `05:1407` | three → nine | — |
| `IntegrityEvent` shape split, on which the split-screen depends | `02 §1.10` vs `04 §3.3` | — | rewrite `02 §1.10` to `04`'s emitted record |
| AC-27: `minor_revision` vs `minor_revisions` — agent enum vs human commit path | `01:66`, `03:1762` vs `02:395`, `05:1011` | pick one spelling | — |
| Fuzzy `char_offset` takes the **first** occurrence of the anchor token, not the matched one | `04:773-779` | — | 30 min, plus a test row whose first token repeats |
| AC-2's chip string `"WebMCP detected · 7 tools"` exists in no other file | `01:100` | align to `05:1064-1067` | — |
| AC-13's fuzzy badge is specified in `01` and absent from `05` — `grep -i fuzzy 05` returns 0 | `01:157-163` | — | add it to `05 §7.4` and to the port table |
| `03:176`'s `"human:<verb>"` prefix against `02`'s bare closed verbs | `03:176` | drop the prefix | — |
| `05:399` says "the four refusal codes" over five bullets | `05:399` | four → five | — |
| `03:785` `rec.at` should be `rec.committed_at` | `03:785` | one token | — |
| Unterminated `js` code fences swallow the prose after them | `03:1248`, `03:1290` | close the fences | — |
| `06:83` "This bankd no hours" | `06:83` | typo | — |

And one that is **not a defect to fix but a decision someone has to make**: the blind-strip width
against `02 §2.4` step 6. It is escalated in `05` and unheard-of in `02`, and until it is answered
the build cannot pass its own blinding guard.

### Confirm-these

- **`04 §7.2` and `§7.3` are reported as re-executed after the fixtures moved.** I verified the
  tables are internally consistent and that S7's 232 + 251 reconciles with `05`'s 483. I could not
  verify the run happened. If it did not, seam 6 is presentational only.
- **Contrast figures** (`05 §0.1`, §9.3) remain deferred to a build-time pass; `05 §14` note 7 calls
  any AA claim in the README a shipping blocker until then.
- **`07`'s remaining `[FILL:]` placeholders**, including the 2025 white-on-white preprint citation,
  which the narration at `07:44` asserts as fact. Confirm the citation before it ships, or scope the
  sentence.
- **`06`'s C1 deliverable** — whether Codex has already been briefed from README ("transcribe `04`")
  or from `06` ("author fresh"). The answer decides whether seam 6 survives contact.
- **The video runtime.** Four numbers are live: `06:150` Task 10 "~350 spoken words ≈ 2:20";
  `07 §1` 2:44; `07:76` "rough cut lands over 2:50"; `05 §11.3` 3:00 flat. `05:1418-1422` defers to
  `07` on timing but keeps its own now-void timecodes unmarked and still orders "30 seconds; do not
  shorten it" for a beat `07` gives 24s. Worse, **`06:172` Task 19 and `06:356` Checkpoint C both
  gate on "under 2:30"** — a cut hitting `07`'s designed 2:44 fails `06`'s own rehearsal gate.
  Someone has to pick one runtime. `05:1418-1419` also still says "`06` Task 14 has Eric writing a
  third script"; `06` rev 3's Task 14 is the demo-determinism pass, and the third script is now
  Task 10.
- **AC-1, AC-2, AC-7, AC-9, AC-10, AC-16 – AC-20, AC-23, AC-27 – AC-36, AC-38, AC-39** were not
  individually re-read this pass. The fourteen the prior audit had named as defective were, and are
  tabled in Part 1a. If the remainder matter, sweep them against the deployed build — which is what
  `06`'s C8 exists to do, and C8 is the slice README has mislabelled as C6.
