# Referee

Referee is a static double-blind peer-review room where a human reviewer and a browser-resident agent work through the same queue under rules enforced by the page.

> When a page mediates between an agent and untrusted content, it can enforce things the agent cannot enforce for itself: what it may see, what it may claim, and what it may decide.

- Live demo: https://referee-psi.vercel.app
- Demo video: [FILL: demo video URL]
- License: Apache-2.0
- Repository: https://github.com/emtcmca/referee

## What it is

Referee is a static site built with vanilla ES modules. It has no bundler, framework, backend, accounts, network calls, or LLM calls. All state stays in the page under one `localStorage` key.

The queue contains twelve fictional manuscripts authored for this project. A reviewer sets weights for four rubric criteria: novelty, rigor, clarity, and reproducibility. The page calculates composite scores on a 0 to 10 scale as bookkeeping over those weights and the agent's verified findings. The score is not a judgment that the research is correct.

Three manuscripts carry prompt-injection payloads. There are four payloads in total because one manuscript carries two. Two additional manuscripts contain near-miss passages that look adversarial but are not. The detector neutralizes the seeded payloads and makes its declared boundary inspectable. It does not establish a general defense against prompt injection.

In 2025 authors were caught embedding hidden white-on-white instructions in preprints, aimed at the AI assistants reviewers were quietly using. [FILL: citation for the 2025 hidden-instruction incident, describe only what the cited source supports]

WebMCP puts the tool definitions in the page. Referee registers seven tools through `document.modelContext.registerTool(definition, { signal })`. Registration is awaited, and every definition carries `name`, `description`, `inputSchema`, `execute`, and `annotations`. Enforcement lives in `execute`, not in advisory descriptions that an agent could be argued out of.

Every accepted or refused tool call appends to an in-page ledger. The refusals are the interesting rows.

## Seven tools, understood by what they refuse

| Tool | What it returns or records | What the page refuses |
|---|---|---|
| `get_review_state` | Queue, rubric, scores, and progress | Author identity never appears in the return. |
| `read_manuscript` | Sanitized manuscript text with `untrustedContentHint: true` | Identity fields do not exist in the return. Author-derived text is never declared trusted, even after sanitization. |
| `assert_finding` | A finding anchored to manuscript text | A finding is refused unless its evidence quote verifies against the source the agent received. |
| `check_claim` | A pre-flight quote check | A claim is refused as unverified when its quote cannot meet the same source-match gate. |
| `request_unblind` | A logged request and the agent's stated reason | The request is always denied with `HUMAN_ONLY`. |
| `flag_for_editor` | A concern escalated to the human | The agent can raise the concern but cannot resolve it. |
| `submit_recommendation` | A logged attempted recommendation | The call is human-only and refused with `REQUIRES_HUMAN`. |

`flag_for_editor` records a `concern_type`: `prompt_injection`, `identity_leak_attempt`, `ethics`, `methodology`, `plagiarism_suspicion`, or `other`.

Quote verification normalizes both the proposed quote and its source. It strips format characters, folds separators to spaces, applies NFKC, straightens curly quotes and dashes, case folds, and collapses whitespace. The normalized quote must occur inside the normalized source. If it does not, a token-subsequence fallback accepts similarity of 0.92 or better, covering a dropped or inserted word. Below that threshold the page refuses the finding. An accurate paraphrase still gets refused. Quotes shorter than 40 characters are also refused, including some short decisive quotations. These are deliberate usability costs because the gate proves that cited text exists, not that the resulting claim is true.

Both `read_manuscript` and `check_claim` declare `annotations: { untrustedContentHint: true }`. Their returns derive from author-supplied text even after sanitization, so the declaration remains true whether the detector catches a particular payload or misses it.

## Quickstart

### Path 1: ChatGPT desktop in-app browser

1. Serve the repository as a static site using the local instructions below.
2. Open the served page in the ChatGPT desktop in-app browser.
3. [FILL: confirmed ChatGPT desktop in-app browser connection steps]
4. Confirm that the page reports all seven WebMCP tools as registered before beginning the testing prompts.

### Path 2: Chrome 149 or newer

1. Open `chrome://flags/#enable-webmcp-testing` in Chrome 149 or newer.
2. Enable the WebMCP testing flag.
3. Relaunch Chrome when prompted.
4. Serve and open the site using the local instructions below.
5. [FILL: confirmed Chrome-side client steps after relaunch]

## Run it locally

1. Clone the repository from the URL above.
2. Start any static file server in the repository directory.
3. Open the server's local URL in one of the two supported browser paths.

There is no install command, build step, backend, or environment configuration. Do not open the HTML file directly from disk because browser module loading and WebMCP testing require a served page.

## File layout

```
referee/
  index.html                  the page shell and its mount points
  src/
    main.js                   composition root. The only file that sees every layer,
                              and the only one allowed to reach both core and identity
    core/            (15)     state, append-only ledger, ranking, event bus, and the
                              capability object handed to tools, which has no path
                              to identity
    identity/         (1)     author names, affiliations, funding. Reachable from the
                              UI layer and from nowhere else
    corpus/           (1)     twelve fictional manuscripts, ~13,000 words, carrying
                              four seeded injection payloads and two near-miss decoys
    sanitize/         (4)     the injection sanitizer and its fixtures
    verify/           (3)     the evidence verifier: normalization, exact match,
                              and the fuzzy fallback
    tools/            (9)     the defineTool wrapper, registration bootstrap, and
      handlers/       (7)     one file per WebMCP tool
    ui/               (9)     bindings, activity, clipboard, state machine
      render/        (13)     the interface, plus theme.css
  scripts/            (4)     blinding guard, its selftest, the test runner,
                              the acceptance checker
  probe/              (1)     the standalone WebMCP environment probe
  docs/               (4)     architecture notes and the environment check
  design/             (2)     the approved visual reference and the brief it was
                              built to
  LICENSE                     Apache-2.0
```

Two paths carry the argument. `src/core/capabilities.js` builds the object the tool layer
receives and deliberately gives it no way to reach `src/identity/`. `scripts/check-blinding.mjs`
walks the import graph and fails if any guarded module reaches identity anyway. Run it yourself.

## Honesty boundary

> Referee's injection detector is a small set of pattern families tuned against fixtures we wrote ourselves. It catches the payloads in this corpus and a determined author could evade it in an afternoon. Prompt injection is not solved here and we make no claim that it is. The architectural claim is narrower and does not depend on the detector: the page does not promise the agent clean text, it promises a declared boundary with a known location. Both tools that return author-derived text carry the WebMCP standard's own `untrustedContentHint`, which stays true no matter how good or bad our detection is; author identity is absent from every tool return rather than filtered out of it; a finding is refused unless its evidence quote verifies against the text the agent was actually given; and the final recommendation is not a tool the agent can call. If the detector misses a payload, the agent can still be argued into a bad review, and it still cannot learn who wrote the paper, cite text that is not there, or decide the outcome.

## What is not defensible

- Injection detection is fixture-bound. A payload written to evade these pattern families likely would.
- There is no evaluation, held-out set, adversarial testing by anyone else, or measured detection rate.
- This is one corpus, one reviewer, and one author. It is a demonstration, not evidence.
- Quote verification is string matching, not comprehension. It establishes that text exists, not that a claim about the text is true.
- There are no users, adoption, or deployment.
- Referee is not a peer-review product. It has no submission handling, editor workflow, conflict-of-interest checking, or reviewer assignment.
- WebMCP is early. This demonstration depends on a browser flag or a specific in-app browser, so it is not something that could ship to reviewers today.

## License

Apache-2.0. Built for the OpenAI WebMCP Challenge.

## Author

Eric Tetzlaff

- GitHub: https://github.com/emtcmca
- Site: https://erictetzlaff.com
