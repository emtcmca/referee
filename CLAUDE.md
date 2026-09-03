# CLAUDE.md â€” referee

Project-level instructions for Claude Code. Add your own canon above the managed
block below; everything inside the block is rewritten automatically each session.

<!-- VAULT:SESSION-STATE start -- autonomously maintained by /qsave, do not hand-edit -->
## Session State (auto-maintained)

**Updated:** 2026-09-02 · **Branch:** main · **Digest:** `claude-vault/sessions/referee/_master.md`

Submission to the OpenAI WebMCP Challenge, closing **2026-09-03 1:00pm PT**. **All build work is
done; what remains is human.** Live at referee-psi.vercel.app, public repo with Apache-2.0 detected
by GitHub. 323 tests, blinding guard PASS with selftest 12/12, acceptance 20 PASS / 0 FAIL / 26
MANUAL, 30/30 bindings. Task 0 is GO and an agent has driven all seven production tools against the
live site. A prompt rail now hands a visitor the five verified prompts and advances by observing
`tool:settled` rather than by a button.

**Open threads**
- Judge whether the live landing answers "what do I do." The one thing still worth hours if not.
- Source the 2025 hidden-instruction citation — the opening sentence of both drafts.
- Record the video: 2:38, opens mid-tool-call, no title card.
- Walk the 26 manual acceptance rows, AC-37 (three-way honesty-text diff) first.
- Remaining `[FILL:]`: video URL, ChatGPT app version, Task 0 verbatim payload, screenshots.

**Watch out for**
- **The write/read literal mismatch is this project's signature failure — six instances.** Two
  modules agree on meaning and disagree on spelling or shape. Nothing throws, both suites pass, and
  it surfaces at runtime as silence. Every one came from a name repeated in a second place rather
  than read from its owner. Grep any cross-module literal against its actual writer before trusting
  it.
- **`src/main.js` is imported by no test.** The composition root is where every cross-layer bug
  here has lived, and 323 tests once passed with the deployed page visibly broken. Order is
  load-bearing: the adversarial layer installs before the WebMCP check and before `loadState()`.
- **A smooth scroll does not advance in a non-rendered document.** That silently broke the section
  nav for agent-driven and occluded tabs, hiding the seven-tool panel from a judge.
- **When a check comes back red, the measurement is as likely to be wrong as the artifact.**
<!-- VAULT:SESSION-STATE end -->