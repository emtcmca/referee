# Environment Check — Task 0

**Status:** `[FILL: NOT RUN / PASS / FAIL]`
**Date run:** `[FILL: YYYY-MM-DD]`
**URL tested:** `[FILL: deployed production URL]` — must be the deployed production URL, not
`localhost`. Local static servers do not reproduce either target environment's agent boundary.

This file is the Task 0 evidence record. It is also evidence for judges that Referee actually runs
where they will test it. Nothing downstream of Task 0 starts until the table below is filled in
from an observed run in **both** environments.

---

## Why check 5 is the go/no-go

**Check 5 — a returned `{ok:false}` refusal reaches the agent as a usable result — is tested
first, with a deliberately-failing call, before anything else.**

Every enforcement in Referee is a returned refusal. Blinding is enforced by `request_unblind`
returning `HUMAN_ONLY`. Evidence discipline is enforced by `assert_finding` returning
`EVIDENCE_NOT_FOUND`. The human-only decision is enforced by `submit_recommendation` returning
`REQUIRES_HUMAN`. There is no other mechanism. The refusals *are* the product.

So if a refusal does not survive the boundary — if the host swallows it as an error, flattens it
to an unstructured failure, or drops the payload — the agent never receives the thing the page is
there to say. The demo would still appear to work: tools register, calls go out, the page looks
correct. The premise would have failed **silently**, and it would fail in front of a judge rather
than here. That is why it is checked first and why it is its own go/no-go rather than one row of
six.

If check 5 fails in one environment and passes in the other, that is a partial result, not a pass.
Record which environment failed and what the agent actually received.

---

## Environments under test

| | Environment | Version |
|---|---|---|
| **A** | ChatGPT desktop, in-app browser | `[FILL: ChatGPT desktop app version + in-app browser engine/version]` |
| **B** | Chrome 149+ with `chrome://flags/#enable-webmcp-testing` **enabled** | `[FILL: full chrome://version string]` |

Both are places judges will test. Chrome's documentation describes Chrome; the in-app browser's
serialization behavior is not documented, and any divergence between the two is the highest-severity
risk in the build. Record both or the check is not done.

---

## Results

Fill every cell with **PASS**, **FAIL**, or **N/A**, plus what was actually observed. "It looked
right" is not an observation — paste the string the agent received, or say UNVERIFIED.

| # | Check | A · ChatGPT in-app | B · Chrome 149+ | Observed |
|---|---|---|---|---|
| **5** | **A returned `{ok:false}` refusal reaches the agent as a usable RESULT, not swallowed as an error** — **GO/NO-GO, run first** | `[FILL]` | `[FILL]` | `[FILL: paste exactly what the agent received]` |
| 1 | `document.modelContext` is present | `[FILL]` | `[FILL]` | `[FILL: typeof document.modelContext; and whether the navigator.modelContext fallback was needed]` |
| 2 | `await registerTool(...)` resolves without throwing | `[FILL]` | `[FILL]` | `[FILL]` |
| 3 | The agent discovers and calls the tool | `[FILL]` | `[FILL]` | `[FILL: tool name called, and how it was discovered]` |
| 4 | A returned JSON **string** arrives at the agent intact and readable | `[FILL]` | `[FILL]` | `[FILL: paste the received string; note any re-wrapping or truncation]` |
| 6 | `annotations` are accepted without error | `[FILL]` | `[FILL]` | `[FILL: which annotation keys were sent, and whether either environment rejected them]` |

**Check 6 fallback rule:** if an environment rejects the `annotations` key, drop annotations *in
that environment* rather than failing registration. Record that it was dropped and where.

---

## Verbatim payloads

Paste rather than paraphrase.

**Deliberately-failing call used for check 5**

```
[FILL: the exact tool name and arguments used to force a refusal]
```

**What the agent received back (Environment A)**

```
[FILL: verbatim]
```

**What the agent received back (Environment B)**

```
[FILL: verbatim]
```

---

## Screenshots

Required. A table of PASS values with no image is a claim, not evidence.

| Environment | Screenshot | Shows |
|---|---|---|
| A · ChatGPT in-app | `[FILL: docs/img/task0-chatgpt-<date>.png]` | `[FILL: the refusal as the agent rendered it]` |
| B · Chrome 149+ | `[FILL: docs/img/task0-chrome-<date>.png]` | `[FILL: the refusal as the agent rendered it]` |

---

## Verdict

`[FILL: GO or NO-GO, and the one-line reason.]`

If NO-GO: state which of the six checks failed, in which environment, and what the agent received
instead. Do not write "done" anywhere in this file without a pasted payload behind it.

---

## Caveat that travels with any result recorded here

WebMCP is an origin-trial-stage proposal and Chrome's own documentation says the API is subject to
change. A PASS recorded on `[FILL: date]` is a statement about that date and those two builds. It
is not a claim about future versions.
