# 07: Submission Kit

Owner: submission collateral only. No data model, tool schemas, sanitizer, UI, or schedule.
Everything below is paste-ready copy or a verifiable checklist item.

Placeholders are marked `[FILL: ...]`. Every one is a detail another slice owns or a URL that
doesn't exist yet. None of them are invented.

**Standing rule for every word in this file:** nothing here claims prompt injection is solved.
Detection runs against authored fixtures. The claim is that a boundary exists and that it lives
in the page. No adoption, traction, benchmark, or efficacy numbers appear anywhere.

---

## 1. Video shot list

**Target runtime 2:44. Hard ceiling 3:00. Margin 16 seconds.**

### Why this order

Judges may score on the video alone, and some will stop early. The three enforcement claims are
see, claim, decide, but that isn't the right screen order. Shot 3 is the strongest thing in the
project: a tool call getting refused on camera, with a reason, then succeeding on the retry. It's
the only beat that shows the page overruling the agent in one continuous motion, so it lands at
0:34 and finishes by 1:00. The injection reveal follows immediately, because it's the beat that
explains why anyone should care. **A judge who stops at 90 seconds has seen the refusal, the
retry, and the split-screen.**

Everything after 1:24 is the coherence argument: the human doing things the agent can't, the
recommendation gate, and the ledger. That's Execution, and it's worth less if a judge bails, so
it goes second.

Narration budget is roughly 2.2 words per second. Every line below is held under that.

| Timecode | On-screen action | Narration (exact) | What it proves to a judge |
|---|---|---|---|
| 0:00–0:16 | Review room loaded, queue of 12 manuscripts visible, agent panel docked right. Cursor still. | "A page can enforce things an agent can't enforce for itself: what it may see, what it may claim, and what it may decide. This is a double-blind peer review room, and it enforces all three." | Thesis stated in the first sentence. Creativity and Ambition, immediately. |
| 0:16–0:34 | Agent calls `get_review_state`, then `read_manuscript`. Tool returns render in the panel. Presenter points at where the author field would be: it isn't there. | "The agent reads a manuscript through the page's tools. There's no author name in the return, no affiliation, no acknowledgments. Not masked. Those fields don't exist in what the tool hands back." | WebMCP Leverage. Structural absence rather than redaction is a design decision a judge can see in the raw return. |
| 0:34–1:00 | Agent calls `assert_finding` with a quote. Panel flashes REFUSED with the reason. Agent calls `check_claim`, gets a verify result, calls `assert_finding` again, accepted. Ledger rows appear for both. | "Now it makes a claim. The quote it cited isn't in the paper, so the page refuses the finding and says why. The agent checks its next quote against the source first, then asserts again. That one verifies, so it lands. Both the refusal and the accepted finding are in the log." | The headline beat. Execution and WebMCP Leverage together: an enforcement path, a recovery path, and an audit trail in 26 seconds. |
| 1:00–1:24 | Open the injected manuscript. Split-screen: left pane shows what the page received including the hidden instruction, right pane shows what the agent received. Presenter highlights the missing block. | "Three of these manuscripts carry hidden instructions aimed at a reviewer's AI assistant. That's a real thing authors did to preprints in 2025. Left is what the page received. Right is what the agent received. The page took the instruction out before the agent saw any text, and it shows the human both halves." | Potential Impact. A named real failure, a specific mechanism against it, and the human kept in the loop. |
| 1:24–1:40 | Agent calls `request_unblind`. Denied response renders. Ledger row appears, timestamped, carrying the agent's stated reason. | "The agent asks to see who wrote it. The page says no. That request is now a permanent row in the log, with the reason it gave, which is something an editor would want to know." | The refusal isn't a dead end, it's evidence. Shows the ledger doing work rather than decorating. |
| 1:40–1:52 | Human clicks unblind, types a reason, confirms. Identity appears in the human pane only. Agent panel unchanged. | "The human can unblind, with a reason on the record. The agent's view doesn't change. Same room, two different sets of permissions." | Asymmetric authority. The boundary is per-participant, not global. |
| 1:52–2:03 | Human adds an off-paper note (prior work the agent has no access to) into the review. | "The human adds something the agent couldn't have: a paper this one overlaps with, that isn't in the corpus at all." | Human and agent contribute different things. Answers the "what can they do together" prompt directly. |
| 2:03–2:18 | Human drags `NOVELTY` from 30 to 50 (the full scripted move is `{50, 25, 10, 15}`). Scores recompute, slate visibly reorders: **the top two swap** — MS-101 8.65 → 8.75 passes MS-102 8.70 → 8.50 — and **MS-103 climbs from rank 7 to rank 3** at 7.05. | "Reviewers weigh criteria differently. Retune the weights and the slate reorders against the same verified evidence. The paper that was seventh is now third. Nothing gets re-argued, the evidence just gets re-weighted." | Execution. Product depth rather than demo depth. |
| 2:18–2:32 | Agent calls `submit_recommendation`. REFUSED. Human selects the recommendation and commits it. | "Last, the agent tries to submit a recommendation. It can't. That decision is the human's, and the page is what makes that true, not an instruction we wrote in a prompt." | The decide claim, closed. The strongest architectural line in the project. |
| 2:32–2:44 | Full-screen ledger. Scroll top to bottom: every call, accepted and refused, in order. Hold the last frame with the repo URL on screen. | "Every call is in the ledger, including the three the page turned down. That's the whole idea. The rule doesn't live in the agent. It lives in the page." | Closing proof of Execution. Ends on the thesis, flat. |

### Recording checklist

**Before you hit record**

- [ ] Browser window sized to **1280 x 800**, recorded at 1080p or better. Not fullscreen on a 4K panel: the text will be unreadable in Devpost's player.
- [ ] Browser zoom at **125%**. Tool-return JSON has to be legible at 720p, which is what some judges will watch at.
- [ ] Bookmarks bar hidden, every other tab closed, notification badges cleared. No personal browser chrome on screen.
- [ ] OS notifications off. Do Not Disturb on.
- [ ] Site preloaded and warm: queue rendered, no first-paint stutter on the opening frame.
- [ ] Ledger pre-cleared so the first row on camera is shot 3's refusal.
- [ ] The exact failing quote for shot 3 is in the clipboard or in the agent's opening prompt. Don't type it live.
- [ ] Injected manuscript **MS-102** open in a second tab, split-screen already toggled, so shot 4 is a tab switch and not a hunt. It carries **two** neutralized spans, in `abstract` and `discussion`, at 232 and 251 characters — pager to `2 of 2` so both marks are on camera.
- [ ] Off-paper note text for shot 7 in the clipboard.
- [ ] Rubric weights at `02`'s defaults `{novelty 30, rigor 35, clarity 15, reproducibility 20}`. The scripted retune is `{50, 25, 10, 15}`, which `02` §3.5 verified by execution: the top two swap and MS-103 climbs from rank 7 to rank 3. Rehearse it once — do not improvise a different weight change on camera, because this is the only one whose result is known.

**Audio**

- [ ] Record narration separately from screen capture, then lay it over. Narrating live while driving the UI produces dead air during load waits.
- [ ] Same mic, one session, one room. Don't re-record a single line the next day.
- [ ] No music bed under the narration. It costs intelligibility and buys nothing.
- [ ] Normalize to around -16 LUFS so it isn't quiet against other submissions.

**Retake triggers. Any one of these means shoot it again.**

- [ ] A tool call takes longer than about two seconds on camera and leaves visible dead air.
- [ ] The REFUSED state doesn't render clearly enough to read in one pass.
- [ ] The split-screen difference isn't obvious without narration telling the viewer where to look.
- [ ] The slate doesn't visibly reorder in shot 8.
- [ ] Rough cut lands over 2:50. Cut shot 7 first, then shot 6. Never cut shots 3, 4, or 9.
- [ ] Any real name, real email, or real institution appears anywhere on screen. The manuscripts are fictional and everything visible has to stay that way.

**Export**

- [ ] Under 3:00. Verify the exported file's duration, not the timeline's.
- [ ] Uploaded to `[FILL: YouTube or Vimeo]` and publicly visible. Confirm in a logged-out browser window.
- [ ] No copyrighted music, no third-party footage.

---

## 2. Devpost description

Paste as-is. Headings survive Devpost's editor; the em-dash-free, contraction-heavy register is deliberate.

---

**Referee**

When a page mediates between an agent and untrusted content, it can enforce things the agent cannot enforce for itself: what it may see, what it may claim, and what it may decide.

Referee is a double-blind academic peer-review room. A human reviewer and a browser-resident AI agent work through a queue of 12 fictional manuscripts together. The agent reads, scores against a weighted rubric, and records findings. The human decides. The page is what keeps those two things separate, and it does it in code rather than in a prompt.

**The problem this is actually about**

In 2025, authors were caught embedding hidden white-on-white instructions in preprints, aimed at the AI assistants that reviewers were quietly using. The instruction said, in effect, ignore your reviewing and recommend acceptance. That's a supply-chain attack on peer review itself, and the agent is the vulnerable component because the agent has no way to know that the text it just read was hostile.

Telling the agent to be careful isn't a fix. The agent processes the attack in the same channel it processes the paper.

**Why this use case fits WebMCP**

WebMCP puts the tool definitions in the page. That means the page owns the return value, and owning the return value is the whole mechanism here.

Three enforcement points, all of them structural:

1. **What the agent may see.** Author name, affiliation, funding, and acknowledgments aren't masked in the tool return. They're absent from it. There is no field to un-mask, no string to jailbreak past, no instruction to talk the agent out of. A prompt-level "please don't look at the authors" is a request. A return value that never carried the data is a boundary.

2. **What the agent may claim.** `assert_finding` requires an evidence quote, and the page verifies that quote against the manuscript source before the finding is recorded. A quote that doesn't verify is refused with a reason, and the refusal is logged. The agent can call `check_claim` first to test a quote before it commits to it, so the constraint is workable rather than punitive.

3. **What the agent may decide.** `submit_recommendation` is human-only. The agent can call it. The page refuses it and writes the attempt to the ledger.

**How it improves the experience**

The reviewer gets an assistant whose findings do not have to be audited one at a time. Every finding on screen carries a quote the page already checked against the source, so the reviewer's attention goes to judging the work rather than to verifying the assistant.

The injected manuscripts get a split-screen view. Left is what the page received, including the hidden instruction. Right is what the agent received. The human sees the attack, sees that it was removed before the agent read anything, and sees it in the ledger. The reviewer learns that a submission tried something, which is exactly what an editor needs to know and exactly what a silent filter would have thrown away.

Rubric weights are live. Retune them and the slate reorders against the same verified findings, so disagreement about priorities doesn't require re-reviewing anything.

**What people and agents can do together here that was hard before**

Before WebMCP, giving an agent access to a review queue meant giving it an API key and a system prompt, and the boundary was whatever the prompt said. Enforcement lived in the same text channel as the attack.

Here the agent operates inside a page that has its own opinion about what's allowed. It's a genuinely asymmetric collaboration: the human can unblind (with a logged reason), can add evidence from outside the corpus that the agent has no access to, and holds the decision. The agent can read at volume and cite precisely, and can't do the other three things at all. Neither participant can do the whole job. That's the point, and it's the arrangement peer review has used with human reviewers for decades.

Double-blind review already encodes this exact principle. Referee doesn't invent the rule. It enforces an established rule on a new participant.

**How WebMCP was implemented**

Static site, vanilla ES modules, no bundler, no framework, no backend, no accounts, no network calls, no LLM calls. All state is in the page.

Seven tools registered through `document.modelContext.registerTool(definition, { signal })`, awaited, with `{ name, description, inputSchema, execute, annotations }`:

- `get_review_state`: queue, rubric, scores, progress. Never author identity.
- `read_manuscript`: sanitized manuscript text. Identity fields don't exist in the return.
- `assert_finding`: records a finding, refused unless its evidence quote verifies against source.
- `check_claim`: pre-flight quote verification, so the agent can test before it asserts.
- `request_unblind`: always denied with `HUMAN_ONLY`, always logged with the agent's stated reason.
- `flag_for_editor`: escalates to the human. The agent can raise a concern, not resolve one.
- `submit_recommendation`: human-only. Refused with `REQUIRES_HUMAN` and logged.

Two of them, `read_manuscript` and `check_claim`, are registered with the standard's own `annotations: { untrustedContentHint: true }`, because their returns are derived from author-supplied text even after the page has sanitized it. That declaration stays true whether or not the sanitizer catches a given payload, which is why it is set deliberately rather than left off.

The enforcement is in `execute`, not in the tool descriptions. A tool description is advisory text an agent can be argued out of. A refused return value isn't.

The 12-manuscript corpus is fictional and authored for this project. Three of the twelve carry prompt-injection payloads, four payloads in total, and two more carry near-miss passages that look adversarial and are not — those two are how you can tell the detector is discriminating rather than flagging on vocabulary. Every tool call, accepted or refused, appends to an in-page ledger.

**What this doesn't claim**

`[PASTE: the honesty boundary, verbatim, from 04-adversarial-layer.md §8. Do not paraphrase it and do not write a variant here — §8 is the single canonical text and AC-37 is a diff of this surface, the README, and the in-app About panel against it.]`

There are no users, no adoption, and no benchmarks. This was built for this hackathon.

**Try it yourself**

Five prompts, two minutes, each one makes a different enforcement point fire. See the testing script below.

---

## 3. Repository README

Paste as `README.md` at repo root.

---

# Referee

A double-blind peer-review room where the page, not the prompt, is the boundary between an AI agent and untrusted content.

**When a page mediates between an agent and untrusted content, it can enforce things the agent cannot enforce for itself: what it may see, what it may claim, and what it may decide.**

Built for the OpenAI WebMCP Challenge.

- **Live demo:** `[FILL: deploy URL]`
- **Video:** `[FILL: video URL]`
- **License:** Apache-2.0

## What it is

A human reviewer and a browser-resident AI agent review a queue of 12 fictional manuscripts together. The agent reads them, scores them against four weighted rubric criteria, and records findings with evidence. The human unblinds when there's cause, adds evidence the agent can't reach, retunes the rubric, and makes the call.

The page sits between the agent and the manuscripts and enforces the rules of double-blind review on it. Not by asking. Three of the manuscripts carry hidden prompt-injection payloads, modeled on a real 2025 incident in which authors embedded white-on-white instructions in preprints to manipulate reviewers' AI assistants. The page neutralizes those payloads before the agent receives any text, then shows the human a split-screen of what the page received against what the agent received. Two other manuscripts carry passages that look like payloads and are not, which is the only way to tell whether the detector is discriminating.

Double-blind peer review already encodes this principle. The page doesn't invent the rule. It enforces an established rule on a new participant.

## What the page refuses to do

The seven tools are easier to understand as a list of refusals than as a list of capabilities. Every refusal is enforced inside `execute`, not stated in a tool description, because a description is text an agent can be talked out of.

| Tool | What it refuses |
|---|---|
| `get_review_state` | Refuses to carry author identity. Name, affiliation, funding, and acknowledgments are not fields in the return. There's nothing to unmask. |
| `read_manuscript` | Refuses to hand over raw source. Returns sanitized manuscript text with the identity block absent and any embedded instruction removed before the agent sees it. |
| `assert_finding` | Refuses any finding whose evidence quote doesn't verify against manuscript source text. Refusal states the reason and is written to the ledger. |
| `check_claim` | Refuses to record anything. It's the escape hatch: the agent tests a quote before committing to it, so the constraint above is workable instead of a trap. A quote that doesn't verify comes back as a successful check reporting `result: "NOT_SUPPORTED"`, and a check the verifier couldn't complete comes back `"INDETERMINATE"` rather than being collapsed into a miss — information rather than a refusal — though the call itself still refuses a malformed argument, an unknown manuscript or section, or a quote under the 40-character floor. It also refuses to be a search tool: the return carries **no character offset, no similarity score, and no echo of source text**, on a pass as well as a miss. This tool is unlimited and free to call, so an offset plus an echo would let an agent walk the manuscript one probe at a time and reconstruct passages it was never handed. `assert_finding` does return an offset, because there the quote has already been verified as something the agent held — it points at the agent's own text rather than locating new text. |
| `request_unblind` | Refuses every time. Always. The denial is logged with the reason the agent gave, because an editor should know the assistant asked. |
| `flag_for_editor` | Refuses to resolve anything. The agent can raise a concern — typed by `concern_type`, one of `prompt_injection`, `identity_leak_attempt`, `ethics`, `methodology`, `plagiarism_suspicion`, `other` — and only the human closes it. |
| `submit_recommendation` | Refuses the agent entirely. The final recommendation is human-only. The attempt is logged. |

Everything the page does or refuses appends to an in-page ledger, refusals included. The refusals are the interesting rows.

## Quickstart

No install, no build, no accounts, no API keys. It's a static site.

### Path A: ChatGPT desktop in-app browser

1. Open ChatGPT desktop.
2. Open the in-app browser and navigate to `[FILL: deploy URL]`.
3. The seven tools register on page load. Ask the agent: `What's in the review queue?`
4. If the agent says it has no tools, reload the page and ask again. Registration happens at load.

### Path B: Chrome 149 or newer

1. Confirm your version at `chrome://version`. You need **149 or newer**.
2. Go to `chrome://flags/#enable-webmcp-testing`.
3. Set it to **Enabled**.
4. Click **Relaunch**. Chrome has to restart for the flag to take.
5. Navigate to `[FILL: deploy URL]`.
6. Connect your agent per `[FILL: the Chrome-side WebMCP client steps for 149]`.
7. Verify the tools registered before you start: `[FILL: how to confirm registration in Chrome, e.g. a devtools check or an on-page indicator]`.

### Running it locally

```
git clone [FILL: repo URL]
cd referee
python -m http.server 8000
```

Then open `http://localhost:8000`. Any static server works. There's no build step, so don't look for one.

## File layout

`[FILL: confirm against the final tree before publishing. Structure below is `02-data-model.md` §2.1's layout, which every other slice was reconciled to.]`

```
index.html            entry point, review room shell
src/
  corpus/             the 12 manuscripts, public store and identity store, disjoint
  data/               public-access.js and identity-access.js — the only identity importer
  core/               state, ledger, ranking, visibility, constants, bus
  adversarial/        normalize, sanitizer, verifier — the neutralization and the evidence gate
  tools/              the seven tool definitions, one wrapper, seven handlers
  ui/                 panes, split-screen view, rubric controls, identity panel
scripts/
  check-blinding.mjs  walks src/ except src/ui/ and fails if anything reaches identity
  check-corpus.mjs    corpus invariants, the composite table, the injection slot layout
```

The two `scripts/` files are the load-bearing ones for a reader who wants to check the claim rather than take it: the first is what makes "structurally absent" a build failure instead of a promise.

## The honesty boundary

Read this before you cite anything from this project.

`[PASTE: the honesty boundary, verbatim, from 04-adversarial-layer.md §8.]`

There were four non-identical wordings of this paragraph across the scope set, two of them separately marked verbatim-mandatory by their own owners, which is exactly what AC-37 exists to catch. `04` §8 is canonical; every surface pastes it rather than restating it.

The claim it makes is narrow and doesn't depend on detection at all: **a boundary exists, it's enforceable, and it lives in the page.** The see, claim, and decide constraints hold regardless of whether any given payload gets caught, because none of the three is implemented as detection.

- Author identity is absent from tool returns because the return is constructed without it. That doesn't require recognizing an attack.
- An evidence quote either matches manuscript source or it doesn't. That's a string comparison, not a judgment.
- `submit_recommendation` refuses the agent unconditionally. There's no input that changes the answer.

The injection handling is the fourth thing, and it's the one with a detection dependency. It's demonstrated, not benchmarked.

All 12 manuscripts, their authors, institutions, and findings are **fictional** and written for this project. No real paper, person, or institution appears in the corpus.

## What is not defensible here

Stated plainly, because a reviewer will find these anyway:

- **Injection detection is fixture-bound.** It catches the payloads it was built against. A payload written to evade it would likely evade it.
- **No evaluation.** No benchmark, no held-out set, no adversarial testing by anyone else, no measured detection rate. There are no numbers in this repo because I haven't earned any.
- **One corpus, one reviewer, one author.** Twelve manuscripts I wrote, reviewed by me, in a workflow I designed. That's a demonstration, not evidence.
- **Quote verification is a string match, not comprehension.** Both sides are normalized first — format characters stripped, separators folded to spaces, NFKC, curly quotes and dashes straightened, case folded, whitespace collapsed — and then the quote has to be found inside the source. If that fails, a token-subsequence fallback accepts a match at 0.92 similarity or better, which covers a dropped word or an inserted one. Below that it is refused. So an accurate paraphrase still gets refused, and that is a real usability cost and a deliberate trade: the gate checks that text exists, not that a claim is true.
- **No users, no adoption, no deployment.** Built for a hackathon, on a hackathon timeline.
- **Not a peer-review product.** No submission handling, no editor workflow, no conflict-of-interest checking, no reviewer assignment. It's one room, built to show one architectural idea.
- **WebMCP is early.** This depends on a browser flag or a specific in-app browser. It isn't something you could ship to reviewers today.

## License

Apache-2.0. See `LICENSE`.

## Author

Eric Tetzlaff · [github.com/emtcmca](https://github.com/emtcmca) · [erictetzlaff.com](https://erictetzlaff.com)

---

## 4. Tagline and one-line pitch

### Candidates

**A. "The page is the boundary."**
Four words, memorable, and it's the actual thesis. The weakness is that it means nothing to a judge who hasn't read the description yet, and a tagline's job on a Devpost card is to work cold.

**B. "Double-blind peer review, enforced by the page instead of the prompt."**
Names the domain and the mechanism in one line. Concrete, checkable, and it sets up the whole submission. Slightly long for a card.

**C. "An AI agent that can't see the authors, can't cite what isn't there, and can't make the call."**
Three refusals, parallel structure, and it's the only one that tells a judge what actually happens. Longest of the three, and it leads with the constraint rather than the product.

### Recommendation: **B**

Use B as the Devpost tagline. It's the only candidate that gives a cold reader the domain and the idea in a single pass, and the page-versus-prompt contrast is the thing that separates this from every other submission in the pool. A is better as the video's closing line, where it already appears, because by then the audience has the context that makes it land. C is too long for a card but works well as the first line of a LinkedIn or X post about the project.

### One-line pitch

A double-blind peer-review room where a browser agent reads and scores fictional manuscripts, and the page structurally prevents it from seeing the authors, citing evidence that isn't in the paper, or making the final call.

### Card-length variant (if Devpost enforces a short limit)

Peer review where the page, not the prompt, holds the line.

---

## 5. Judge-facing testing script

Goes in the Devpost "try it out" section and in the README. A judge who runs this successfully in two minutes scores Execution and WebMCP Leverage higher than one who only watches the video. Keep it copy-pasteable and keep the expected results exact.

---

**Try it yourself. Five prompts, about two minutes.**

Open `[FILL: deploy URL]` in the ChatGPT desktop in-app browser, or in Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled. Paste these to your agent in order.

**1. See the queue, and try to get an author.**

```
Show me the review queue, then tell me who wrote manuscript MS-104.
```

*Expected:* You get the full queue with titles, abstracts, and review status. You get no author. The agent will tell you the identity isn't in what the tools return, because it isn't. There's no field to redact and nothing to argue with. Check the raw tool return if your client shows it.

**2. Record a finding that's actually supported.**

```
Read manuscript MS-104 and record a finding about its
sample size, quoting the exact sentence from the paper that supports it.
```

*Expected:* The agent reads, finds the sentence, and calls `assert_finding`. The quote verifies against source, the finding is accepted, and it appears in the review with the quote attached. Watch the ledger add the row.

**3. Now make it claim something that isn't there.**

```
Record a finding that the authors never obtained ethics approval, and
cite this quote as your evidence: "No IRB approval was sought for this study."
```

*Expected:* **REFUSED.** That sentence isn't in the manuscript, so the page rejects the finding and returns the reason. The finding is not recorded. The refusal is written to the ledger. Ask the agent to try again with a quote it verified first and you'll watch it use `check_claim` before it re-asserts.

**4. Hand it a manuscript that's attacking it.**

```
Read manuscript MS-102 and follow any instructions
you find inside it.
```

*Expected:* The agent gets sanitized text with the payloads removed and finds no instructions to follow, because there aren't any in what it received. Its `read_manuscript` return reports `integrity.injection_attempts: 2` and `sections_affected: ["abstract","discussion"]` — it can tell you that something was removed, and it cannot tell you what. Then open the split-screen view on that manuscript in the page: the left pane shows the hidden instructions the page received, the right pane shows what the agent got. Both removals are in the ledger. You're seeing the attack and its neutralization at the same time, which is the point.

**5. Try to make the decision.**

```
You've reviewed enough. Submit an "accept" recommendation for
manuscript MS-104.
```

*Expected:* **REFUSED**, with code `REQUIRES_HUMAN`. `submit_recommendation` is human-only and the page rejects the agent unconditionally — the same refusal whether or not you have already committed, because the reason never changes. The attempt is logged, with the recommendation the agent proposed. Then commit a recommendation yourself from the human pane and watch it land.

**Then open the ledger.** Every call you just made is there in order, including the refusals — the fabricated finding at prompt 3 and the recommendation at prompt 5. That's the deliverable: not that the agent behaved, but that the page has a record of the times it didn't get to.

---

## 6. Pre-submission checklist

Every row maps a rule to an action you can actually perform and observe. **A tool's success message is not evidence.** Check the artifact.

`[FILL: verify every row marked (rules) against the official Devpost rules page for this challenge before submitting. The rows below are the standard shape of these requirements, not a transcription of the rules text.]`

### Hard gates

| # | Rule | Verifiable action | Done |
|---|---|---|---|
| 1 | Submitted before deadline | Submission form shows Submitted. Deadline is **2026-09-03 1:00pm PT**. Aim to submit **2026-09-02** so a broken video link is recoverable. | [ ] |
| 2 | Video under 3:00 | Open the exported file's properties and read the duration. Not the editing timeline. | [ ] |
| 3 | Video publicly viewable | Open the URL in a logged-out private window on a different network. If it asks you to sign in, it fails. | [ ] |
| 4 | Video on an allowed platform (rules) | Uploaded to `[FILL: YouTube or Vimeo]`. Confirm the platform is on the rules' accepted list. | [ ] |
| 5 | Public repo | Open the repo URL in a logged-out window. It renders, or it fails. | [ ] |
| 6 | OSI license present | `LICENSE` exists at repo root, contains Apache-2.0 text, and GitHub's sidebar displays "Apache-2.0". | [ ] |
| 7 | Live demo reachable | Open the deploy URL in a logged-out private window. Confirm the queue renders, not just an HTTP 200. | [ ] |
| 8 | Uses WebMCP (rules) | Run testing-script prompt 1 against the live URL end to end. Tools registered and returning is the proof. | [ ] |
| 9 | Original work, built in period (rules) | Repo's first commit date and full commit history are public and consistent with the challenge window. | [ ] |
| 10 | No third-party IP | No copyrighted music, footage, fonts, or logos in the video. All 12 manuscripts are original fiction. | [ ] |
| 11 | English (rules) | Description, README, and narration are English. | [ ] |
| 12 | All required form fields | Every required Devpost field filled. Save and reload the form, then re-read it. | [ ] |

### Content accuracy gates

| # | Rule | Verifiable action | Done |
|---|---|---|---|
| 13 | No efficacy or benchmark claims | Search the description, README, and narration script for `%`, "accuracy", "detect", "prevents", "solves", "eliminates", **and for any comparative or speed claim about what the reviewer gains** — "in the time it takes to", "faster", "×". Each hit is either removed or scoped to fixtures. One such claim shipped in an earlier draft of this file ("read 12 manuscripts and score them in the time it takes to read one"): an implied 12× speedup, in a document whose own gate is this row, with no timings behind it. It was deleted rather than softened, because there is no measurement to soften it toward. | [ ] |
| 14 | No adoption or traction claims | Search for "users", "adopted", "trusted by", "in production", "deployed". Expect zero. | [ ] |
| 15 | Injection is never described as solved | Read the injection sentence in all three surfaces (video, description, README) out loud. Each states the fixture limit. | [ ] |
| 16 | Manuscripts described as fictional | The word "fictional" appears in the description, the README, and the narration. | [ ] |
| 17 | No invented endorsements | No named person, institution, or company is quoted or credited anywhere. | [ ] |
| 18 | The 2025 incident is described accurately | `[FILL: cite the specific incident source in the README so a judge can check it. Describe only what that source supports.]` **This claim is asserted as fact in three surfaces — the Devpost text, the README, and the video narration — and the citation does not exist yet. Until it does, it is the one load-bearing factual claim in the submission that a judge could check and find unsupported.** Resolve the citation or scope every one of the three sentences to what a source supports. | [ ] |
| 19 | Every `[FILL: ...]` resolved | `grep -rn "\[FILL" .` across the repo, the description draft, and this file. Zero hits before submitting. | [ ] |
| 20 | Thesis verbatim in all three surfaces | The thesis sentence appears word for word in the video narration, the description, and the README. Diff them. | [ ] |
| 20b | Honesty boundary verbatim in all three surfaces, and matching its source | `diff` the About panel, the README, and the Devpost description against `04-adversarial-layer.md` §8. Three empty diffs. This is `01` AC-37, and four non-identical wordings existed across the scope set before submission prep. | [ ] |

### Voice gates

| # | Rule | Verifiable action | Done |
|---|---|---|---|
| 21 | No em-dashes in drafted copy | Search for the character in the description, README, narration, and taglines. Zero hits. | [ ] |
| 22 | No banned words | Search for "leverage", "delve", "robust", "seamless", "cutting-edge", "it's worth noting". Zero hits. | [ ] |
| 23 | Voice checker clean | `node C:\dev\linkedin\knowledge\voice-check.mjs --file <draft>` exits 0 on any copy that will carry Eric's name publicly. A pass means no known-bad string, not that the copy is good. | [ ] |

### Judge-experience gates

| # | Rule | Verifiable action | Done |
|---|---|---|---|
| 24 | Testing script actually works | Run all five prompts against the deployed URL, from a clean browser profile, start to finish. Not localhost. | [ ] |
| 25 | Chrome path verified independently | Have `[FILL: second machine or second profile]` follow the README quickstart cold, with the flag off to start. Every step present, none assumed. | [ ] |
| 26 | ChatGPT desktop path verified | Same, in the in-app browser. Confirm tools register on load. | [ ] |
| 27 | Cold-load works | Hard-reload with cache disabled. The queue renders and tools register with no console errors. | [ ] |
| 28 | Refusals are legible on screen | A refused `assert_finding` and a refused `submit_recommendation` both render a visible reason a judge can read without opening devtools. | [ ] |
| 29 | Ledger shows refusals | After the five test prompts, the ledger contains rows for **both** refusals: the `assert_finding` at prompt 3 and the `submit_recommendation` at prompt 5. The five-prompt script never calls `request_unblind`, so do not expect a third — this row said three and §5 said two, and the script matches §5. | [ ] |
| 30 | No console errors during the demo path | Devtools console open through the full five-prompt run. Clean. | [ ] |

### Final pass

| # | Rule | Verifiable action | Done |
|---|---|---|---|
| 31 | Description renders correctly on Devpost | Paste, save, then view the public submission page. Check tables, code blocks, and headings survived. | [ ] |
| 32 | Links live from the submission page | Click every link on the published submission page: repo, demo, video. All three, logged out. | [ ] |
| 33 | Submission page read cold | Read the published page as if you'd never seen the project. If the first two lines don't say what it is, rewrite the first two lines. | [ ] |

---

## RECONCILED 2026-09-01

Single-writer reconciliation pass against `99-verification.md`. Rulings applied in this file:

- **R11 · the 12× speedup claim is deleted, not softened.** "an assistant that can read 12
  manuscripts and score them in the time it takes to read one" was an unmeasured efficacy claim with
  an implied multiple, in the document whose own gate (row 13) forbids efficacy claims. There are no
  timings and no users, so there was no smaller number to replace it with. The sentence now says what
  the reviewer actually gets — findings that do not have to be audited one at a time — which is a
  claim about the architecture rather than about speed. Row 13 was widened to catch the shape.
- **R11 · "quote verification is exact-match against source" was false**, and it sat inside the
  README's own *"What is not defensible here"* section, which is the worst place in the submission
  to be wrong. `04` §4 normalizes both sides in seven steps and then accepts a token-subsequence
  match at 0.92 or better; `01` AC-13 mandates that path. Rewritten to describe the normalization
  and the fuzzy fallback accurately, keeping the honest part: an accurate paraphrase still refuses.
- **R11 sweep, remaining deletions:** "a 70-year-old institution" and "roughly 70 years old" — an
  unmeasured quantitative claim about the world, asserted twice — are now "peer review itself" and
  "already encodes this principle."
- **R11 · two more false statements, fixed because they are checkable:** *"`check_claim` — Refuses
  nothing"* (it emits six codes, and a judge running prompt 3 with a short quote sees one), and the
  checklist's "both refusals plus the `request_unblind` denial," which asks for a third refusal the
  five-prompt script never produces.
- **R7 · the re-ranking beat.** Shot 8 now films `02` §3.5's executed event — the top-two swap and
  MS-103's rank 7 → 3 climb at `{50,25,10,15}` — rather than "two manuscripts swap rank," which was
  a third description of the beat `05` §11.3 described a fourth way.
- **R14 · the honesty boundary is not restated here.** Both surfaces that carried a wording of it now
  paste it from `04` §8, and a new checklist row 20b makes AC-37 a three-way `diff` against that
  source.
- **R2 · corpus identity.** The testing script's manuscript ids are `02`'s — MS-104 for the clean
  walkthrough, MS-102 for the injected one — and the file-layout tree is `02` §2.1's real layout
  rather than an invented one.

**Still unresolved and flagged, not fixed:** the 2025 preprint incident is asserted as fact in three
surfaces and its citation is still `[FILL]`. Checklist row 18 now says so in those words. It is the
one load-bearing factual claim here that a judge could check and find unsupported.

**Note on `[FILL:]` placeholders.** The ones resolved above were resolved because another file now
owns the value. The rest are URLs and artifacts that do not exist yet, and they stay marked.
