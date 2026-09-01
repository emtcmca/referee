# 00 — START HERE (operating contract for Codex)

Read this file once. Then open exactly one work order and do it. Nothing else.

---

## What Referee is

Referee is a static, backend-free double-blind peer-review room where a human reviewer and a
browser-resident AI agent work the same queue of twelve fictional manuscripts. The agent reaches the
manuscripts only through seven WebMCP tools the page registers with
`document.modelContext.registerTool(...)`. Every tool call, accepted or refused, lands in an
append-only in-page ledger.

**Thesis (verbatim, never reworded):**

> When a page mediates between an agent and untrusted content, it can enforce things the agent
> cannot enforce for itself: what it may see, what it may claim, and what it may decide.

Three enforcement points, all structural: author identity is *absent* from every tool return rather
than masked; a finding is refused unless its evidence quote verifies against the text the agent was
actually given; the final recommendation is a control only a human hand operates.

---

## Working model

| Role | Owns |
|---|---|
| Eric + Claude Code | Planning, the UI, integration, state, ledger, every judgment call |
| **You (Codex)** | **Only the work orders in this directory.** Nothing else. |

**Do not implement outside the work order you were handed.** Two implementers in the same files
under a deadline is how a working build stops working. If a work order seems to require touching a
file it does not name, stop and say so in your report instead of doing it.

---

## Budget guard — this is the rule that shapes everything

Your cost is dominated by reading, not by writing. Every work order in this directory is
**self-contained**: the exact contract, schema, table, or code you need is pasted into it.

- **Do not read `scope/`.** Those files are ~475KB and you do not need one byte of them.
- **Do not explore the repository.** No `ls -R`, no directory walks, no "let me see what's here."
- **Do not read files the work order does not name.**
- **Do not run broad searches** (`grep -r` across the repo, glob sweeps).
- Read only: this file, your one work order, and any file that work order names by path.

If something looks missing, say so in your report. Do not go looking for it.

---

## Write complete files, never patches

Every deliverable is a **whole file, written start to finish**, at the exact path the work order
gives. No diffs, no patches, no "insert this after line N", no `// ... existing code ...`
placeholders, no TODO stubs. If a file is long, write it long.

**Paths you may write** are named in your work order and nowhere else. Do not create directories,
config files, package manifests, test runners, or READMEs that were not asked for.

**Environment facts you need and must not re-derive:** vanilla ES modules, no bundler, no npm, no
TypeScript, no framework, no build step, no network calls, no LLM calls. Browser only. Deterministic
math throughout. Import paths are relative and end in `.js`.

---

## Honesty rules (they bind two of these work orders, and your report always)

- **Never claim prompt injection is solved, prevented, blocked, or stopped.** Detection here runs
  against fixtures we wrote ourselves. The permitted verbs are "neutralizes the seeded payloads",
  "shows where the boundary sits", "makes the enforcement point inspectable."
- **No invented metrics, benchmarks, adoption numbers, endorsements, users, or quotes.** There are
  none. Saying so plainly is stronger than implying otherwise.
- **Manuscripts are fictional** and every surface must say so.
- **A tool's success message is not evidence.** Assert the postcondition. If you cannot produce the
  evidence, write **UNVERIFIED**, not "done."
- Never add a `Co-Authored-By` trailer to any commit.

A judge who catches one false claim discounts everything else. The honest version of this project is
genuinely strong and does not need help.

---

## The work orders

| File | Slice | What it produces |
|---|---|---|
| `01-corpus.md` | C1 | The twelve fictional manuscripts, host prose only |
| `02a-sanitizer.md` | C2 | `src/adversarial/sanitizer.js` |
| `02b-sanitizer-tests.md` | C2 | Its fixtures and its measured test table, re-run |
| `03a-verifier.md` | C3 | `src/adversarial/normalize.js` + `verify.js` |
| `03b-verifier-tests.md` | C3 | Its substrate and its 14-row table, re-run |
| `04-0-contracts.md` | C6 | Cross-slice signatures and persisted state. No code. Read first, keep it |
| `04-1-envelopes-and-ordering.md` | C6 | `envelope.js`, `bus.js`, `next-action.js`, codes, call ordering |
| `04-2-define-tool.md` | C6 | `validate.js`, `define-tool.js` — the wrapper no handler can bypass |
| `04-3-tools-read.md` | C6 | `get_review_state`, `read_manuscript` |
| `04-4-assert-contract.md` | C6 | `assert_finding`: definition, schema, and every refusal payload |
| `04-5-assert-handler.md` | C6 | `assert_finding`: the handler, fully implemented |
| `04-6-tools-check-and-flag.md` | C6 | `check_claim`, `flag_for_editor` — the two the agent can complete |
| `04-7-tools-human-only.md` | C6 | `request_unblind`, `submit_recommendation` — the two that always refuse |
| `04-8-registration.md` | C6 | `register.js`, the awaited bootstrap, the WebMCP-absent surface |
| `05-prose.md` | C4 + C5 | README first draft, Devpost description first draft |

A slice split across several files is one job. It is not done until every part is done, and each
part's Definition of Done says so.

**Ordering constraints, the only two:**

1. `03a-verifier.md` delivers `src/adversarial/normalize.js`, which the sanitizer imports. **Do `03a`
   before `02a`.** Each slice's tests follow its own implementation.
2. The `04` family runs strictly in filename order, `04-0` through `04-8`. Each part builds on what
   the earlier ones landed.

Everything else is independent.

---

## Definition of Done (this file)

Nothing to build here. You are done reading when all four of these are true and you can say so:

- You can state the thesis without looking it up.
- You know which single work order you were assigned and have not opened another.
- You have not opened anything under `scope/`.
- You know that your deliverable is complete files at named paths, and that "I wrote the file" is
  never sufficient — each work order ends with postconditions you must observe and report.
