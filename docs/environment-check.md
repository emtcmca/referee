# Environment Check — Task 0

**Status:** **PASS** in the ChatGPT desktop in-app browser, 2026-09-01. Partial in Chrome 152 (registration confirmed; no agent has driven the call rows there).
**Date run:** 2026-09-01
**URL tested:** https://referee-psi.vercel.app/probe — must be the deployed production URL, not
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
| **A** | ChatGPT desktop, in-app browser | ChatGPT desktop app, in-app browser. **RUN 2026-09-01, all six checks green.** `[FILL: app version, from Settings > About]` |
| **B** | Chrome 149+ with `chrome://flags/#enable-webmcp-testing` **enabled** | Chrome **152.0.0.0**, Windows NT 10.0 Win64 x64. Flag enabled, browser relaunched. |
| **C** | Codex chat session, embedded browser view | Version not recorded. **Not an environment judges will use.** Recorded because it answered the go/no-go question first. |

A and B are the places judges will test. Chrome's documentation describes Chrome; the in-app
browser's serialization behavior is not documented, and any divergence between the two is the
highest-severity risk in the build.

**C is not a substitute for either.** It is logged because it is where the go/no-go was first
answered, and because a second independent host handling returns correctly is real evidence about
the architecture even when it is not evidence about the target environments.

---

## Results

Every cell is **PASS**, **FAIL**, **N/A**, or **NOT RUN**, plus what was actually observed. "It
looked right" is not an observation — paste the string the agent received, or write UNVERIFIED.

| # | Check | A · ChatGPT in-app | B · Chrome 152 | C · Codex session | Observed |
|---|---|---|---|---|---|
| **5** | **A returned `{ok:false}` refusal reaches the agent as a usable RESULT, not swallowed as an error** — **GO/NO-GO, run first** | **PASS** | NOT RUN | **PASS** | The agent called `probe_always_refuses` and reported the full payload back, including `code`, `message`, and `retry_hint`. Not surfaced as an error, not truncated. Verbatim below. |
| 1 | `document.modelContext` is present | **PASS** | **PASS** | PASS | B reported `surface: document.modelContext`. The `navigator.modelContext` fallback was **not** needed, which matches its deprecation in Chrome 150. |
| 2 | `await registerTool(...)` resolves without throwing | **PASS** | **PASS** | PASS | All three probe tools registered under one `AbortController`. |
| 3 | The agent discovers and calls the tool | **PASS** | NOT RUN | **PASS** | The agent listed all three tools by name — `probe_echo`, `probe_always_refuses`, `probe_untrusted` — then called two of them. |
| 4 | A returned JSON **string** arrives at the agent intact and readable | **PASS** | NOT RUN | **PASS** | `probe_echo` returned `{"ok":true,"echoed":"hello","marker":"REFEREE_PROBE_OK"}`. No re-wrapping, no truncation. |
| 6 | `annotations` are accepted without error | **PASS** | **PASS** | PASS | `readOnlyHint` and `untrustedContentHint` sent on all three tools. Neither environment rejected the key, so the drop-annotations fallback was not exercised. |

**Status, 2026-09-01.** **Environment A is fully green** — all six checks, including the go/no-go,
observed in the ChatGPT desktop in-app browser. That is the surface the Official Rules name first
and the one a judge reaches without setting a browser flag, so it is the environment that matters
most.

**Environment B is partial.** Registration is confirmed there — `document.modelContext` present,
`registerTool` resolving, annotations accepted — but no agent has driven rows 3, 4 or 5 in that
browser. The residual risk is low rather than absent: two independent hosts have now handled a
returned refusal correctly, and B has already proved the half that is browser-specific. Recorded
as NOT RUN rather than inferred, because inferring it is exactly the move this file exists to
prevent.

**Check 6 fallback rule:** if an environment rejects the `annotations` key, drop annotations *in
that environment* rather than failing registration. Record that it was dropped and where.

---

## Verbatim payloads

Paste rather than paraphrase.

**Deliberately-failing call used for check 5**

```
probe_always_refuses({})
```

`probe_always_refuses` exists for no other purpose. It takes no arguments, does nothing, and
returns a structured refusal. It was called first, before any successful call, so that a failure
here could not be mistaken for a downstream problem.

**What the agent received back (Environment C · Codex session)**

```
{"ok":false,
 "code":"PROBE_REFUSAL",
 "message":"This tool always refuses. If you can read this, refusals survive the boundary.",
 "retry_hint":"No retry is possible. Report that you received a structured refusal."}
```

The agent read the payload and reported its contents. It did not report a tool failure, an error,
or an empty result. This is the single observation the project most depended on: **Referee's
enforcement mechanisms are all returned refusals, so a host that swallowed them would break the
premise silently rather than loudly.**

**And the successful call, for contrast (Environment C)**

```
probe_echo({ message: "hello" })
{"ok":true,"echoed":"hello","marker":"REFEREE_PROBE_OK"}
```

Success and refusal travel the same path and arrive the same way. That symmetry is the point.

**What the agent received back (Environment A · ChatGPT desktop in-app browser)**

```
[FILL: paste from the probe page's Copy report button, or from the agent's reply. The run happened 2026-09-01 and all six rows went green; only the verbatim text is outstanding.]
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

**GO.** A returned `{ok:false}` refusal reaches an agent as a readable, structured result in the
ChatGPT desktop in-app browser, which is the surface judges reach without a flag. The premise
holds.

Scope of that verdict, stated so it is not read as wider than it is:

- **Six of six green in Environment A.** Two of six confirmed in Environment B, plus registration;
  its three call rows are NOT RUN.
- **This tested the probe, not the application.** The probe registers three tools built to
  exercise the boundary. Referee's seven production tools are covered by 323 automated tests and a
  registration check that drives `registerAll` against a stub, but an end-to-end agent run against
  the deployed application is a separate exercise and is recorded elsewhere.
- A PASS here is a statement about these builds on this date, not about future versions.

If any of this later fails: state which check, in which environment, and what the agent actually
received. Do not write "done" anywhere in this file without a pasted payload behind it.

---

## Caveat that travels with any result recorded here

WebMCP is an origin-trial-stage proposal and Chrome's own documentation says the API is subject to
change. A PASS recorded on 2026-09-01 is a statement about that date and those two builds. It
is not a claim about future versions.
