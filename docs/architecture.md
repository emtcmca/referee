# Architecture

Referee is a double-blind peer-review room shared by a human reviewer and a browser AI agent. The
agent reaches the manuscripts through WebMCP tools registered by the page with
`document.modelContext.registerTool`. The page sits between the agent and author-supplied text, and
that position is the whole design: **a page that mediates can enforce things an agent cannot enforce
for itself — what it may see, what it may claim, and what it may decide.**

All manuscripts are fictional and labeled as such in the interface.

## The three enforcements

**See — author identity is structurally absent.** Blinding is not masking. Identity lives in a store
no tool handler imports; the handlers can only reach the blinded store, so there is no code path from
a tool return to an author name, affiliation, or funder. Every return carries the same frozen
nine-name `blinded_fields` array, so the agent is told what is withheld rather than left to infer it.
`request_unblind` exists, and it returns `HUMAN_ONLY`.

**Claim — a finding is refused unless its evidence verifies.** `assert_finding` takes a quote and
checks it against the manuscript source. Both sides are normalized, then matched exactly or by token
subsequence at a 0.92 threshold. Quotes shorter than 40 characters after normalization are refused
with `QUOTE_TOO_SHORT`; that floor will occasionally refuse a short decisive quote, which is a known
tradeoff, not a bug. A quote that does not verify returns `EVIDENCE_NOT_FOUND` and no finding is
recorded.

**Decide — the recommendation is human-only.** `submit_recommendation` returns `REQUIRES_HUMAN`. The
agent can assemble the entire case and cannot cast the vote.

## Why the page and not a prompt

A system prompt is an instruction to a model. It can be argued with, out-competed by injected text,
or lost in a long context, and its failures are invisible. These three constraints are properties of
the code path instead. Refusals are *returned*, never thrown, so the agent receives a structured,
actionable result rather than an opaque error. Handler bodies are wrapped, so a genuine bug surfaces
as `{ok:false, code:"INTERNAL"}`. `read_manuscript` and `check_claim` carry the standard's own
`untrustedContentHint: true` — an honest declaration that those returns derive from author-supplied
text, kept even though the page sanitizes that text first.

**On injection: this does not solve prompt injection, and nothing here should be read as claiming
it.** The seeded payloads and the near-miss passages that must not flag are fixtures we authored,
so they measure this build against our own examples and nothing else. Detection quality is a
separate, unsolved problem. The durable claim is narrower: a boundary exists, and it lives in the
page.

## Verify it yourself

- **See** — run `node scripts/check-blinding.mjs`. It is a static import-graph check: it fails if any
  module reachable from a tool handler can reach the identity store. Then call `read_manuscript` and
  read the return; then call `request_unblind`.
- **Claim** — call `assert_finding` with a quote you altered by one word. Read `EVIDENCE_NOT_FOUND`.
- **Decide** — call `submit_recommendation`. Read `REQUIRES_HUMAN`.
- **Injection handling** — open an affected manuscript and read the split-screen panel, which shows
  what the page received against what the agent received.

## Layout

```
index.html              application shell; mount points only
src/                    vanilla ES modules — tools, stores, sanitizer, verifier, UI
scripts/
  check-blinding.mjs    runnable proof of the blinding claim
docs/
  architecture.md       this file
  environment-check.md  Task 0 evidence: WebMCP in both target browsers
LICENSE                 Apache-2.0
```

No bundler, no framework, no npm install, no backend, no accounts, no network calls, no
dependencies. State is one `localStorage` key, `referee.state.v1`; the corpus is a static module.
The ledger is append-only and records every tool call, refusals included, with `actor` and
`visible_fields_at_time`.

WebMCP is an origin-trial-stage proposal and its API is subject to change.
