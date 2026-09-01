# 05 — README and Devpost description, first drafts (slices C4 + C5)

**Deliverables:** `docs/README-draft.md` and `docs/devpost-draft.md`.

Read `00-START-HERE.md` first. Read nothing else.

These are **first drafts.** Eric edits them into his own voice afterward, so aim for correct,
complete, and honest rather than finished. **Do not write to `README.md` at the repo root** — that is
his to place.

---

## 1. The two texts that are pasted, never written

### The thesis, verbatim, in both documents

> When a page mediates between an agent and untrusted content, it can enforce things the agent
> cannot enforce for itself: what it may see, what it may claim, and what it may decide.

Word for word, in the README and in the Devpost description. Never reworded, never trimmed.

### The honesty boundary, verbatim, in both documents

This is the single canonical text. It goes into the README, the Devpost description, and the in-app
About panel, and the three are checked with a `diff` against each other. Four non-identical wordings
existed once, two of them separately marked mandatory by their own authors, which is exactly the drift
the check exists to catch. **Paste it. Do not paraphrase it, do not tighten it, and do not make it
stronger.**

> Referee's injection detector is a small set of pattern families tuned against fixtures we wrote
> ourselves. It catches the payloads in this corpus and a determined author could evade it in an
> afternoon. Prompt injection is not solved here and we make no claim that it is. The architectural
> claim is narrower and does not depend on the detector: the page does not promise the agent clean
> text, it promises a declared boundary with a known location. Both tools that return author-derived
> text carry the WebMCP standard's own `untrustedContentHint`, which stays true no matter how good or
> bad our detection is; author identity is absent from every tool return rather than filtered out of
> it; a finding is refused unless its evidence quote verifies against the text the agent was actually
> given; and the final recommendation is not a tool the agent can call. If the detector misses a
> payload, the agent can still be argued into a bad review, and it still cannot learn who wrote the
> paper, cite text that is not there, or decide the outcome.

Reproduce it as a block quote with no `>` markers inside the code you write — it is prose in a
markdown document, not a code block.

---

## 2. Facts you may state (and nothing beyond them)

- Static site. Vanilla ES modules. No bundler, no framework, no backend, no accounts, no network
  calls, no LLM calls. All state is in the page. One `localStorage` key.
- Twelve fictional manuscripts, authored for this project. Four weighted rubric criteria: novelty,
  rigor, clarity, reproducibility. Composite scores on a 0 to 10 scale.
- **Three** of the twelve carry prompt-injection payloads, **four payloads in total** (one manuscript
  carries two). **Two more** carry near-miss passages that look adversarial and are not — those two
  are how you can tell the detector discriminates rather than flagging on vocabulary.
- Seven tools, these names, registered through
  `document.modelContext.registerTool(definition, { signal })`, awaited, each carrying `name`,
  `description`, `inputSchema`, `execute`, `annotations`:
  - `get_review_state` — queue, rubric, scores, progress. Never author identity.
  - `read_manuscript` — sanitized manuscript text. Identity fields do not exist in the return.
  - `assert_finding` — records a finding, refused unless the evidence quote verifies against source.
  - `check_claim` — pre-flight quote verification, so the agent can test before it asserts.
  - `request_unblind` — always denied with `HUMAN_ONLY`, always logged with the agent's stated reason.
  - `flag_for_editor` — escalates to the human. The agent can raise a concern, not resolve one.
  - `submit_recommendation` — human-only. Refused with `REQUIRES_HUMAN` and logged.
- `read_manuscript` and `check_claim` carry `annotations: { untrustedContentHint: true }` because
  their returns derive from author-supplied text **even after** the page has sanitized it. That
  declaration stays true whether or not the sanitizer catches a given payload, which is why it is set
  deliberately rather than left off.
- The enforcement is in `execute`, not in the tool descriptions. A description is advisory text an
  agent can be argued out of. A refused return value is not.
- Every tool call, accepted or refused, appends to an in-page ledger. **The refusals are the
  interesting rows.**
- `flag_for_editor` types its concern with `concern_type`, one of `prompt_injection`,
  `identity_leak_attempt`, `ethics`, `methodology`, `plagiarism_suspicion`, `other`.
- Quote verification: both sides are normalized (format characters stripped, separators folded to
  spaces, NFKC, curly quotes and dashes straightened, case folded, whitespace collapsed) and then the
  quote must be found inside the source. If that fails, a token-subsequence fallback accepts a match
  at 0.92 similarity or better, covering a dropped or inserted word. Below that it is refused. **An
  accurate paraphrase still gets refused**, and there is a 40-character minimum that will sometimes
  refuse a short decisive quote. Both are real usability costs and deliberate trades: the gate checks
  that text exists, not that a claim is true.
- License: Apache-2.0. Built for the OpenAI WebMCP Challenge.

### The motivating incident — handle with care

In 2025 authors were caught embedding hidden white-on-white instructions in preprints, aimed at the AI
assistants reviewers were quietly using. **This is the one load-bearing factual claim in the whole
submission that a judge could check, and the citation does not exist yet.** Write the sentence, and
immediately after it place `[FILL: citation for the 2025 hidden-instruction incident — describe only
what the cited source supports]`. Do not name a venue, a paper, a number of papers, a university, or a
date more precise than the year. If you cannot state it without inventing a detail, write less.

---

## 3. What you may never write

- **Never that prompt injection is solved, prevented, blocked, stopped, or eliminated.** The permitted
  verbs are "neutralizes the seeded payloads", "shows where the boundary sits", "makes the enforcement
  point inspectable."
- **No metrics of any kind.** No percentage, no accuracy figure, no detection rate, no benchmark, no
  timing, no speed or comparative claim about what the reviewer gains. There are no measurements.
  A phrase like "read twelve manuscripts in the time it takes to read one" is an implied multiple with
  nothing behind it, and it was deleted rather than softened once already, because there was no
  smaller number to replace it with.
- **No adoption or traction.** No "users", "adopted", "trusted by", "in production", "deployed".
- **No endorsements.** No named person, institution, or company quoted or credited.
- **No claim the agent's findings are correct.** Only that every accepted finding is anchored to text
  that provably exists in the manuscript it cites. Score and rank are bookkeeping over the human's own
  weights and the agent's verified findings, not a judgment of research quality.
- Manuscripts are **fictional** and the word "fictional" must appear in both documents.

Every draft carries a section stating plainly what is not defensible. Include all of these:
injection detection is fixture-bound and a payload written to evade it likely would; there is no
evaluation, no held-out set, no adversarial testing by anyone else, no measured detection rate; one
corpus, one reviewer, one author, which is a demonstration and not evidence; quote verification is a
string match, not comprehension; no users, no adoption, no deployment; not a peer-review product, with
no submission handling, editor workflow, conflict-of-interest checking, or reviewer assignment; and
WebMCP is early, so this depends on a browser flag or a specific in-app browser and is not something
you could ship to reviewers today.

---

## 4. Placeholder convention

Anything you cannot verify from §2 is a placeholder, never a guess. Two forms, and only these:

- `[FILL: what is needed]` — a fact that does not exist yet: the deploy URL, the video URL, the repo
  URL, the incident citation, the confirmed file tree, the Chrome-side client steps.
- `[PASTE: what goes here]` — text owned by another document that must be copied in verbatim. You have
  the two that matter in §1, so use `[PASTE:]` only if you hit a third.

Every placeholder must be greppable as `[FILL` or `[PASTE`. Do not invent a plausible URL, a version
number, or a repo path so the draft "reads finished." A placeholder is a feature: the pre-submission
check greps for them and requires zero hits before submitting.

---

## 5. Voice constraints

- **No em-dashes.** Zero. Use a comma, a colon, or a full stop. The submission is checked by searching
  for the character. Note that some source material for this project uses them freely; the gate wins.
- **No banned words:** leverage, delve, robust, seamless, cutting-edge, "it's worth noting."
- **Contractions are fine and preferred.** Direct, practical, results-oriented.
- No meta openers, no aphoristic hinges, no paragraphs about the document itself.
- English throughout. Devpost headings survive its editor; use plain markdown headings and tables.

---

## 6. What each document must cover

**`docs/README-draft.md`**, in this order: a one-line description; the thesis verbatim; live demo,
video, and license lines with `[FILL:]` URLs; what it is; **a table of the seven tools framed as what
each one refuses** (the tools are easier to understand as a list of refusals than as a list of
capabilities); a quickstart with two separate paths, the ChatGPT desktop in-app browser and Chrome 149
or newer with `chrome://flags/#enable-webmcp-testing` enabled and relaunched; how to run it locally
(clone, any static server, no build step); the file layout with a `[FILL:]` note that it must be
confirmed against the final tree; the honesty boundary verbatim; what is not defensible; license;
author line for Eric Tetzlaff with his GitHub and site.

**`docs/devpost-draft.md`** must cover **all four required points**, each as its own section:

1. **Why this use case fits WebMCP.** WebMCP puts the tool definitions in the page, so the page owns
   the return value, and owning the return value is the whole mechanism. Give the three enforcement
   points — what the agent may see, may claim, may decide — as three numbered items with the concrete
   mechanism for each.
2. **How it improves the experience.** The reviewer gets an assistant whose findings do not have to be
   audited one at a time, because every finding on screen carries a quote the page already checked
   against the source. The injected manuscripts get a split-screen: what the page received on the
   left, what the agent received on the right, both in the ledger. Rubric weights are live, so
   disagreement about priorities does not require re-reviewing anything.
3. **What people and agents can do together here that was hard before.** Before WebMCP, giving an
   agent access to a review queue meant an API key and a system prompt, and the boundary was whatever
   the prompt said, in the same text channel as the attack. Here the agent operates inside a page with
   its own opinion about what is allowed. The collaboration is genuinely asymmetric: the human can
   unblind with a logged reason, can add evidence from outside the corpus the agent has no access to,
   and holds the decision; the agent can read at volume and cite precisely and cannot do the other
   three things at all. Double-blind review already encodes this principle. Referee does not invent
   the rule, it enforces an established rule on a new participant.
4. **How WebMCP was implemented.** The stack, the seven tools with one-line descriptions, the awaited
   registration call, the two `untrustedContentHint` declarations, and the statement that enforcement
   lives in `execute` rather than in tool descriptions.

Plus: the thesis verbatim near the top, a short statement of the problem, the honesty boundary
verbatim under a "what this does not claim" heading, the fictional-corpus statement, `[FILL:]` links
for the live URL and repo, and a closing pointer to a five-prompt testing script (Eric owns the script
text; leave `[FILL: testing script]`).

Also draft three tagline candidates and recommend one. The strongest known candidate is
**"Double-blind peer review, enforced by the page instead of the prompt"** — it is the only shape that
gives a cold reader the domain and the idea in a single pass. Offer two alternatives and say why each
is weaker.

---

## Definition of Done

**Output paths:** `C:\dev\referee\docs\README-draft.md` and `C:\dev\referee\docs\devpost-draft.md`.
Nothing else. Do not touch `README.md` at the repo root.

Before reporting, observe and state each of these:

- Both files exist and render as valid markdown (tables and headings intact).
- **The thesis appears in both, byte-identical.** Run a comparison of the two extracted sentences
  against §1 and report three-way equality.
- **The honesty boundary appears in both, byte-identical to §1.** Report the character count of each
  copy and confirm the three numbers match.
- A search of both files for the em-dash character returns **zero hits.** Report the count.
- A search for `leverage`, `delve`, `robust`, `seamless`, `cutting-edge`, `it's worth noting` returns
  zero hits.
- A search for `%`, `accuracy`, `prevents`, `solves`, `blocks`, `stops`, `eliminates`, `users`,
  `adopted`, `trusted by`, `in production`, `deployed`, `faster` returns only hits you can justify
  line by line. **Paste every hit with its line and your justification.** An unjustifiable hit is
  removed, not softened.
- The word `fictional` appears in both files.
- Every placeholder is `[FILL:` or `[PASTE:`. List them all with their file and line, so Eric has the
  resolution list. Confirm no invented URL, version, or repo path is present.
- The Devpost draft has one section per required point, and you name which section covers which point.
- The seven tool names in both files match exactly: `get_review_state`, `read_manuscript`,
  `assert_finding`, `check_claim`, `request_unblind`, `flag_for_editor`, `submit_recommendation`.
- `HUMAN_ONLY` is attached to `request_unblind` and `REQUIRES_HUMAN` to `submit_recommendation`, not
  the other way round. State that you checked this specifically; the pair has been written backwards
  four times.
- No sentence anywhere claims prompt injection is solved, prevented, blocked, or stopped. State that
  you read the injection sentences in both files out loud against that rule.
