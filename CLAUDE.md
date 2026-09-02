# CLAUDE.md â€” referee

Project-level instructions for Claude Code. Add your own canon above the managed
block below; everything inside the block is rewritten automatically each session.

<!-- VAULT:SESSION-STATE start -- autonomously maintained by /qsave, do not hand-edit -->
## Session State (auto-maintained)

**Updated:** 2026-09-01 · **Branch:** main · **Digest:** `claude-vault/sessions/referee/_master.md`

Submission to the OpenAI WebMCP Challenge, closing **2026-09-03 1:00pm PT**. Built, deployed and
validated end to end: live at referee-psi.vercel.app, public repo with Apache-2.0 detected by
GitHub. 323 tests passing, blinding guard PASS with its selftest 12/12, acceptance 20 PASS / 0 FAIL
/ 26 MANUAL. Task 0 is GO — refusals reach an agent as readable structured results in the ChatGPT
desktop in-app browser, and an agent has driven all seven production tools against the live site.

**Open threads**
- Agent-prompt console with event-driven progression (in flight). Two readers landed on the live
  page and did not know what to do; the fix is putting the conversation on the page, not more labels.
- Source the 2025 hidden-instruction citation — the opening sentence of both drafts.
- Record the video: 2:38, opens mid-tool-call, no title card.
- Walk the 26 manual acceptance rows, AC-37 (three-way honesty-text diff) first.
- Remaining `[FILL:]`: video URL, ChatGPT app version, Task 0 verbatim payload, screenshots.

**Watch out for**
- **The write/read literal mismatch is this project's signature failure — six instances so far.**
  Two modules agree on meaning and disagree on spelling or shape. Nothing throws, both suites pass,
  and it surfaces at runtime as silence. Every one came from a name repeated in a second place
  rather than read from its owner. Before trusting any cross-module wiring, grep the literal
  against its actual writer.
- **`src/main.js` is imported by no test.** The composition root is where every cross-layer bug in
  this project has lived, and 323 tests once passed with the deployed page visibly broken. Order is
  load-bearing there: the adversarial layer must install before the WebMCP check and before
  `loadState()`.
- **When a check comes back red, the measurement is as likely to be wrong as the artifact.**
<!-- VAULT:SESSION-STATE end -->