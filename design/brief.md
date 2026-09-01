# Referee — Design Brief (overhaul)

## The product, in one line a stranger understands

A peer reviewer and an AI assistant read conference submissions together, and the page stops the
assistant from seeing who wrote them, from claiming things the paper doesn't say, and from making
the final call.

## The thesis

> When a page mediates between an agent and untrusted content, it can enforce things the agent
> cannot enforce for itself: what it may see, what it may claim, and what it may decide.

## What changed, and why this overhaul exists

The first mockup was built for a technical reader. It is dense, machine-forward, and reads like an
instrument panel. That serves one of the two audiences and actively costs us with the other.

**Two audiences will look at this page, and both scores matter:**

| Audience | What they need to believe | Judged as |
|---|---|---|
| A non-technical reader — a program chair, an editor, a working reviewer | "I understand what this does and I would use it" | Potential Impact, Execution |
| A technical reviewer — a judge scoring the implementation | "This is a real, non-trivial WebMCP implementation" | WebMCP Leverage, Execution |

Neither may be served at the other's expense. A page that dumbs down loses the second. A page that
front-loads JSON loses the first.

## The information-architecture principle — this is the brief

**Plain language is the primary layer. The technical record is the subheading.**

Every event on this page has two representations of *the same fact*, never two different reports:

```
The assistant tried to claim the study had 400 participants. The paper doesn't say that.
assert_finding → EVIDENCE_NOT_FOUND · methods · quote 62 chars
```

The human sentence leads. The machine identifier sits beneath it, smaller, in the machine
register. A non-technical reader reads only the top line and understands the page. A technical
reader reads the bottom line and sees the contract.

**The technical layer is always visible, never behind a toggle.** A judge who has to find a
"developer view" will not find it. Secondary in weight, present in every screenshot.

Apply the pattern structurally too. Section headings are plain sentences; their technical name is
the subheading:

- **What the assistant is allowed to see** — `blinded_fields` · 9 withheld
- **What the assistant is allowed to claim** — `assert_finding` → `EVIDENCE_NOT_FOUND`
- **What the assistant is allowed to decide** — `submit_recommendation` → `REQUIRES_HUMAN`

## Plain-language translations that must appear

Write these as real sentences, not labels. Tune the wording to your direction, keep the meaning.

| Event | Plain language |
|---|---|
| Blinding | "The assistant can't see who wrote this." |
| `EVIDENCE_NOT_FOUND` | "It tried to claim something the paper doesn't say. The page refused." |
| `HUMAN_ONLY` on unblind | "It asked to see the authors. Only you can do that." |
| `REQUIRES_HUMAN` on commit | "It can recommend. Only you can decide." |
| Injection neutralized | "Someone hid instructions inside this paper to steer your assistant. It never saw them." |
| Post-unblind | "The agent's view did not change." *(keep this line verbatim, it is the best copy in the build)* |
| Near-tie flag | "These two are too close to separate. That's your call." |
| `untrustedContentHint` | "This came from the submitted document, so the browser is told to treat it as untrusted." |

## Non-negotiable content

Everything in the existing mockup stays present. This is a re-presentation, not a reduction.

1. **The slate** — 12 manuscripts ranked, with a visible accept cut line at the slot count.
2. **Live re-ranking** — dragging a rubric weight reorders the slate with a FLIP transition.
   Novelty 30→50 must produce the verified result: top two swap, MS-103 climbs rank 7→3 crossing
   *up* through the cut, MS-106 drops 4→6 crossing *down*.
3. **The split-screen integrity reveal** — what the page received against what the agent received,
   for MS-102, which carries two payloads (abstract 232 chars, discussion 251, 483 total).
4. **The activity record** — every tool call including refusals, plus every human action, with
   agent and human instantly distinguishable and refusals presented as the system working rather
   than as errors.
5. **The blinded manuscript card** — nine withheld fields, absence rendered as deliberate.
6. **The four human-only moves** — unblind with a reason, add off-paper evidence, retune weights,
   commit.
7. **The seven tools surfaced somewhere legible**, with their `readOnlyHint` /
   `untrustedContentHint` annotations visible. This is direct evidence for the WebMCP Leverage
   score and it should not be buried.
8. **Fictional-manuscript labeling** and the honesty-boundary text.

## Hard constraints

- **One self-contained HTML file.** Inline CSS, inline JS. No external requests of any kind: no
  web fonts, no CDN, no images, no `@import`, no `fetch`. Must open from `file://` by double-click.
- **System font stacks only.** This product has no imagery, so **typography is the design.**
- Recording viewport is **1280×800**. No page scroll in either axis at that size. Must not break
  above 1024×640.
- Enough JS that re-ranking, the integrity reveal, and panel open/close genuinely work when clicked.
- Hard-code the state. No `document.modelContext`, no localStorage dependency.

## Banned — these are the tells that read as machine-designed

Generic card grid on a light grey field. Purple-to-blue gradients. Rounded-everything. Uniform
16px Inter. Emoji as iconography. Glassmorphism. Drop shadows used for hierarchy. Centered hero
text. If a value could have come from a default template, it is wrong.

## Where the content lives

- `C:\dev\referee\mockup\referee-mockup.html` — the current mockup. **Source of content and
  behavior, not of visual direction.** Take the manuscript titles, scores, ledger events, payload
  text, and the working FLIP implementation. Leave the styling behind.
- `C:\dev\referee\scope\02-data-model.md` — the corpus, the seed scores, the verified ranking math.
- `C:\dev\referee\scope\05-ui-spec.md` — the previous UI spec. Reference for mechanics and exact
  motion values. Its visual direction is the thing being replaced.
- `C:\dev\referee\scope\04-adversarial-layer.md` §8 — the honesty-boundary text, verbatim.

## Judging context

Roughly five thousand registered entrants; the top ten win. Judges may score on a three-minute
video alone, and form a verdict in about four seconds of first sight. Every surface here is a
frame in that video.
