# Referee

## Tagline candidates

**Recommended:** Double-blind peer review, enforced by the page instead of the prompt

This is the strongest candidate because a cold reader gets both the domain and the central idea in one pass.

**Alternative:** Referee: a review room where the page holds the boundary

This is weaker because it does not tell the reader that the review is double-blind or that an agent participates.

**Alternative:** Seven WebMCP tools, one human decision

This is weaker because the contrast is clear but the peer-review setting is not.

- Live project: [FILL: live demo URL]
- Source repository: [FILL: repository URL]

## The problem

In 2025 authors were caught embedding hidden white-on-white instructions in preprints, aimed at the AI assistants reviewers were quietly using. [FILL: citation for the 2025 hidden-instruction incident, describe only what the cited source supports]

That incident exposes a structural problem. If a review assistant receives manuscript text, identity information, policy instructions, and adversarial content through the same text channel, the boundary is whatever the prompt says. Advisory instructions are not an enforcement mechanism.

Referee tests a narrower architecture:

> When a page mediates between an agent and untrusted content, it can enforce things the agent cannot enforce for itself: what it may see, what it may claim, and what it may decide.

Referee is a static, backend-free double-blind peer-review room. A human reviewer and a browser-resident agent work the same queue of twelve fictional manuscripts authored for this project. Three manuscripts carry four seeded prompt-injection payloads, with two payloads in one manuscript. Two more carry near-miss passages that look adversarial but are not. The detector neutralizes the seeded payloads and shows where the boundary sits. It does not establish a general defense against prompt injection.

The review rubric has four weighted criteria: novelty, rigor, clarity, and reproducibility. Composite scores use a 0 to 10 scale. They are bookkeeping over the human's weights and the agent's verified findings, not a judgment that a manuscript's research is correct.

## 1. Why this use case fits WebMCP

WebMCP puts tool definitions in the page, so the page owns the return value. Owning the return value is the mechanism Referee needs. The agent does not receive a review API whose policy depends on a system prompt. It receives seven page-defined operations with structural limits in their `execute` functions.

1. **What the agent may see:** `read_manuscript` returns sanitized author-derived text, but author identity fields do not exist in the return. They are absent, not masked and not filtered after disclosure. The return still carries `untrustedContentHint: true` because sanitization does not make author-supplied text trusted.
2. **What the agent may claim:** `assert_finding` refuses a finding unless its evidence quote verifies against the exact source text the agent received. `check_claim` exposes the same gate as a pre-flight check. Every accepted finding shown to the reviewer is anchored to text that the page found in that manuscript. This does not mean the finding is correct.
3. **What the agent may decide:** `submit_recommendation` is human-only and returns `REQUIRES_HUMAN`. The agent may calculate, cite, and escalate, but it cannot decide the review outcome. `request_unblind` is also always denied, with `HUMAN_ONLY`, and the attempted reason is logged.

The descriptions explain these boundaries, but descriptions are advisory text. The enforcement lives in `execute`, where the page can return a refusal that the agent cannot talk its way around.

## 2. How it improves the experience

The reviewer gets an assistant whose findings do not have to be audited one at a time, because every finding on screen carries a quote the page already checked against the source. The check establishes that the cited text exists. It does not establish that the interpretation is true.

For injected manuscripts, the ledger provides a split-screen view. The left side shows what the page received, and the right side shows what the agent received after the declared boundary. This makes the transformation inspectable without suggesting that arbitrary adversarial text has been handled.

Rubric weights are live. A reviewer can change the relative priority of novelty, rigor, clarity, and reproducibility without re-reviewing the manuscripts. The page recomputes composite scores from the human's weights and the existing verified findings.

Every tool call, accepted or refused, appends to an in-page ledger. The refusals are the interesting rows because they show the boundary operating when the agent asks to cross it.

## 3. What people and agents can do together here that was hard before

Before WebMCP, giving an agent access to a review queue meant an API key and a system prompt. The boundary was whatever the prompt said, in the same text channel as the attack. Referee instead gives the page its own opinion about what is allowed, expressed through tool return values.

The collaboration is deliberately asymmetric. The human can unblind with a logged reason, add evidence from outside the corpus that the agent cannot access, and make the final decision. The agent can read at volume, cite precisely, check a quote before asserting it, and flag a concern for the editor. It cannot learn author identity from a tool, add an unverified finding, unblind the manuscript, or submit the recommendation.

Double-blind review already encodes this principle. Referee does not invent the rule. It enforces an established rule on a new participant.

## 4. How WebMCP was implemented

Referee is a static site using vanilla ES modules. It has no bundler, framework, backend, accounts, network calls, or LLM calls. All state lives in the page under one `localStorage` key.

The page registers seven tools with an awaited call to `document.modelContext.registerTool(definition, { signal })`. Every definition carries `name`, `description`, `inputSchema`, `execute`, and `annotations`.

| Tool | Role |
|---|---|
| `get_review_state` | Returns the queue, rubric, scores, and progress without author identity. |
| `read_manuscript` | Returns sanitized manuscript text without identity fields and declares `untrustedContentHint: true`. |
| `assert_finding` | Records a finding only when its evidence quote verifies against source. |
| `check_claim` | Runs the quote gate before the agent attempts to record a finding and declares `untrustedContentHint: true`. |
| `request_unblind` | Always denies the agent with `HUMAN_ONLY` and logs its stated reason. |
| `flag_for_editor` | Escalates a typed concern to the human without resolving it. |
| `submit_recommendation` | Refuses the agent with `REQUIRES_HUMAN` because the decision belongs to the reviewer. |

`flag_for_editor` uses a `concern_type` of `prompt_injection`, `identity_leak_attempt`, `ethics`, `methodology`, `plagiarism_suspicion`, or `other`.

Both `read_manuscript` and `check_claim` set `annotations: { untrustedContentHint: true }` because their returns derive from author-supplied text even after sanitization. The declaration remains true whether the fixture-bound detector catches a payload or misses it.

Quote verification normalizes the proposed quote and source in the same way. It strips format characters, folds separators to spaces, applies NFKC, straightens curly quotes and dashes, case folds, and collapses whitespace. The normalized quote must be present inside the normalized source. A token-subsequence fallback accepts similarity of 0.92 or better to cover a dropped or inserted word. Below that threshold the call is refused. An accurate paraphrase is still refused, and the 40-character minimum can refuse a short decisive quote. Those are deliberate usability costs. The gate establishes that text exists, not that a claim about it is true.

The enforcement lives in `execute`, not in the tool descriptions. A description can advise an agent. Only the executed return value applies the page's rule.

## What this does not claim

> Referee's injection detector is a small set of pattern families tuned against fixtures we wrote ourselves. It catches the payloads in this corpus and a determined author could evade it in an afternoon. Prompt injection is not solved here and we make no claim that it is. The architectural claim is narrower and does not depend on the detector: the page does not promise the agent clean text, it promises a declared boundary with a known location. Both tools that return author-derived text carry the WebMCP standard's own `untrustedContentHint`, which stays true no matter how good or bad our detection is; author identity is absent from every tool return rather than filtered out of it; a finding is refused unless its evidence quote verifies against the text the agent was actually given; and the final recommendation is not a tool the agent can call. If the detector misses a payload, the agent can still be argued into a bad review, and it still cannot learn who wrote the paper, cite text that is not there, or decide the outcome.

- Injection detection is fixture-bound. A payload written to evade it likely would.
- There is no evaluation, held-out set, adversarial testing by anyone else, or measured detection rate.
- This is one corpus, one reviewer, and one author. It is a demonstration, not evidence.
- Quote verification is string matching, not comprehension.
- There are no users, adoption, or deployment.
- Referee is not a peer-review product. It has no submission handling, editor workflow, conflict-of-interest checking, or reviewer assignment.
- WebMCP is early. The demonstration depends on a browser flag or a specific in-app browser, so it is not something that could ship to reviewers today.

## Try the boundary

The project includes a five-prompt testing path that exercises ordinary review, seeded adversarial text, quote refusal, unblinding refusal, and the human-only decision boundary.

[FILL: testing script]

Referee is licensed under Apache-2.0 and was built for the OpenAI WebMCP Challenge.
