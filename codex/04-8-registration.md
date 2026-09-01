# 04-8 — Registration bootstrap and the WebMCP-absent surface (slice C6, part 9 of 9)

**Deliverable:** `src/tools/register.js`.

Read `00-START-HERE.md` and `04-0` through `04-7` first. Read nothing else.

The API facts this is written against, verified from Chrome's own documentation. Where anything else
disagrees, these win:

1. `await document.modelContext.registerTool(definition, options)` — **async, two arguments.**
2. `execute: async (inputs, context)` — `context` is `{ signal: AbortSignal }`.
3. Every `execute` returns `JSON.stringify(payload)` — a string, success and refusal alike.
4. Policy refusals are RETURNED, never THROWN.
5. `annotations: { readOnlyHint, untrustedContentHint }` is set deliberately on all seven.
6. **`exposedTo` is not used.** Single origin.

**The correct code is not seven inline `registerTool` calls.** Each tool is a definition object in
`TOOL_SPECS`; all seven register inside one awaited async function against one `AbortController`.

---

## 1. `src/tools/register.js`

```js
// src/tools/register.js
import { defineTool } from "./define-tool.js";
import { getReviewStateHandler }       from "./handlers/get-review-state.js";
import { readManuscriptHandler }       from "./handlers/read-manuscript.js";
import { assertFindingHandler }        from "./handlers/assert-finding.js";
import { checkClaimHandler }           from "./handlers/check-claim.js";
import { requestUnblindHandler }       from "./handlers/request-unblind.js";
import { flagForEditorHandler }        from "./handlers/flag-for-editor.js";
import { submitRecommendationHandler } from "./handlers/submit-recommendation.js";
import { MANUSCRIPT_IDS, SECTION_IDS, CRITERIA } from "../core/constants.js";
import { bus } from "../core/bus.js";

/** The seven definition objects, in this order. Full bodies are in 04c, 04d, 04e and 04g. */
export const TOOL_SPECS = [
  /* 1 */ defineTool({ name: "get_review_state",      /* ...04c */ handler: getReviewStateHandler }),
  /* 2 */ defineTool({ name: "read_manuscript",       /* ...04c */ handler: readManuscriptHandler }),
  /* 3 */ defineTool({ name: "assert_finding",        /* ...04d */ handler: assertFindingHandler }),
  /* 4 */ defineTool({ name: "check_claim",           /* ...04e */ handler: checkClaimHandler }),
  /* 5 */ defineTool({ name: "request_unblind",       /* ...04e */ handler: requestUnblindHandler }),
  /* 6 */ defineTool({ name: "flag_for_editor",       /* ...04e */ handler: flagForEditorHandler }),
  /* 7 */ defineTool({ name: "submit_recommendation", /* ...04e */ handler: submitRecommendationHandler })
];

/**
 * `navigator.modelContext` is deprecated as of Chrome 150 in favor of `document.modelContext`.
 * Prefer document; keep the navigator fallback only so an older build still works.
 */
export function detectModelContext() {
  const d = globalThis.document?.modelContext ?? null;
  if (d && typeof d.registerTool === "function") return { present: true, surface: "document", ctx: d };
  const n = globalThis.navigator?.modelContext ?? null;
  if (n && typeof n.registerTool === "function") return { present: true, surface: "navigator", ctx: n };
  return { present: false, surface: null, ctx: null };
}

/** One controller for the whole set. abort() unregisters all seven cleanly. */
export const registry = new AbortController();

let REGISTERED = false;
let REGISTERED_NAMES = [];

/**
 * Registers all seven. Async and awaited. Idempotent: safe to call twice, registers once.
 * Reset does NOT re-register -- reset mutates state, and re-registering the same names on a
 * host that does not de-duplicate would give the agent seven phantom duplicates.
 */
export async function registerReferee() {
  if (REGISTERED) {
    // Report what actually registered, not TOOL_SPECS.length. This branch used to return 7
    // unconditionally, so a PARTIAL registration reported itself as 7/7 on every subsequent
    // call. A number that is right only on the happy path is worse than no number at all.
    return { present: true, registered: REGISTERED_NAMES.length, tools: [...REGISTERED_NAMES],
             surface: detectModelContext().surface, annotationsAccepted: true, already: true };
  }

  // The window between first paint and feature detection resolving is a DESIGNED state: the
  // page is interactive and no tool is callable yet. Without this emit that state is
  // unreachable -- a renderer would have to infer it from the ABSENCE of an event.
  bus.emit("webmcp:changed", { phase: "probing", registered: 0, total: TOOL_SPECS.length,
                               failed: [], surface: null, annotationsAccepted: null });

  const det = detectModelContext();
  if (!det.present) {
    document.documentElement.dataset.webmcp = "absent";
    bus.emit("webmcp:changed", { phase: "unavailable", registered: 0, total: TOOL_SPECS.length,
                                 failed: [], surface: null, annotationsAccepted: false });
    return { present: false, registered: 0, tools: [], surface: null,
             annotationsAccepted: false, already: false };
  }

  // Register while the indicator still reads "connecting". Nothing flips until this resolves.
  document.documentElement.dataset.webmcp = "connecting";

  const registered = [];
  const failed = [];
  let annotationsAccepted = true;

  bus.emit("webmcp:changed", { phase: "registering", registered: 0,
                               total: TOOL_SPECS.length, failed: [] });

  for (const def of TOOL_SPECS) {
    try {
      await det.ctx.registerTool(def, { signal: registry.signal });   // no exposedTo: single origin
      registered.push(def.name);
    } catch (err) {
      // If a browser rejects the annotations key, DROP ANNOTATIONS for that tool rather than
      // failing registration. Retry once, without them.
      console.warn("[referee] registerTool failed for " + def.name + "; retrying without annotations", err);
      annotationsAccepted = false;
      try {
        const { annotations, ...bare } = def;   // eslint-disable-line no-unused-vars
        await det.ctx.registerTool(bare, { signal: registry.signal });
        registered.push(def.name);
      } catch (err2) {
        // One tool failing must not take the other six down, and must not blank the page.
        console.error("[referee] registerTool failed permanently for " + def.name, err2);
        failed.push({ tool: def.name, message: String((err2 && err2.message) || err2) });
      }
    }
    // The status pill counts up as each promise settles, so emit per tool rather than once at
    // the end. Registration stays SEQUENTIAL: an await loop is what produces a per-tool settle
    // to count. Promise.allSettled is superseded here.
    bus.emit("webmcp:changed", { phase: "registering", registered: registered.length,
                                 total: TOOL_SPECS.length, failed: [...failed] });
  }

  REGISTERED = registered.length > 0;
  REGISTERED_NAMES = [...registered];
  document.documentElement.dataset.webmcp = REGISTERED ? "active" : "absent";
  document.documentElement.dataset.webmcpTools = String(registered.length);

  // Only NOW does the UI claim the tools are live. `live` only at 7/7, `partial` otherwise --
  // never round a partial registration to either extreme.
  bus.emit("webmcp:changed", {
    phase: registered.length === TOOL_SPECS.length ? "live"
         : registered.length > 0 ? "partial" : "unavailable",
    registered: registered.length, total: TOOL_SPECS.length,
    failed: [...failed], tools: [...registered], surface: det.surface, annotationsAccepted
  });

  // Cheap and useful in the demo: reflect host-side tool-list changes.
  if (typeof det.ctx.addEventListener === "function") {
    det.ctx.addEventListener("toolchange", async () => {
      try {
        const live = await det.ctx.getTools();
        bus.emit("webmcp:changed", {
          phase: "live", registered: REGISTERED_NAMES.length, total: TOOL_SPECS.length,
          failed: [], hostToolCount: Array.isArray(live) ? live.length : null
        });
      } catch (err) { console.warn("[referee] getTools() failed on toolchange", err); }
    });
  }

  return { present: true, registered: registered.length, tools: registered,
           surface: det.surface, annotationsAccepted, already: false };
}

// Register after the DOM exists, and never block first paint on it.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => { void registerReferee(); }, { once: true });
} else {
  void registerReferee();
}
```

**`getTools()` is also the self-check.** After `registerReferee()` resolves, calling
`await document.modelContext.getTools()` and confirming the seven names is the cheapest possible proof
that registration actually took, rather than trusting a resolved promise.

---

## 2. What renders when WebMCP is absent

A judge who opens the deployed URL in a plain browser with no flag must still see a coherent, complete
human product. Nothing hidden, nothing disabled, no error state. The page keys off
`document.documentElement.dataset.webmcp`, which takes three values: `connecting`, `active`, `absent`.

Your job in this work order is only to set that attribute and emit `webmcp:changed`. The UI belongs to
another owner. What you must **not** build:

> **`runSimulation()` is RESCINDED. Do not build it.** A simulated agent session and a "replay mode"
> were two incompatible designs for the WebMCP-absent surface, neither of them requested and neither
> budgeted. **Everything describing a simulation driver is dead vocabulary.** The absent surface keeps
> the status band and the registration pill and nothing else.

---

## 3. Environment contingencies — already handled above, listed so nothing is re-invented

| Difference | Contingency |
|---|---|
| `execute` return type under-specified | always `JSON.stringify(payload)`. No `{content:[...]}` wrapper, no `structuredContent`, no host flag. A string survives every boundary |
| No documented error return format | policy refusals returned as `{ok:false}`; a genuine throw becomes `code:"INTERNAL"` |
| `registerTool` is async | `await` inside `registerReferee()`; the indicator flips only after it resolves |
| `document.modelContext` vs deprecated `navigator.modelContext` | `detectModelContext()` prefers document, falls back to navigator, else renders the absent state |
| A browser rejects `annotations` | retry that tool once with annotations stripped; record `annotationsAccepted:false`. **Drop annotations, never fail registration** |
| One tool fails to register | logged, loop continues. If zero register, the page renders the absent surface — the product degrades, it never breaks |
| Args delivered as a JSON string | parsed inside the wrapper's existing try, falling through to `INVALID_ARGUMENT` |
| `context.signal` | accepted and documented as intentionally unused: handler bodies are synchronous over an in-memory corpus, so there is no await point at which an abort could be honored |
| Host enforces `enum` or does not | every enum is re-checked in code. The schema is a hint; the page is the enforcement |
| Description truncation | every description under 1024 chars, load-bearing constraint in the first two sentences |

---

## 4. The six environment checks

These run on the **deployed production URL, not localhost**, in **both** the ChatGPT desktop in-app
browser and Chrome 149+ with `chrome://flags/#enable-webmcp-testing`. Record all six outcomes, both
browser versions, the URL, and a screenshot in `docs/environment-check.md`.

1. `document.modelContext` is present.
2. `await registerTool(...)` resolves without throwing, and `await getTools()` lists all seven.
3. The agent can discover and call a tool.
4. A returned JSON **string** arrives at the agent intact and readable.
5. **A returned `{ok:false}` refusal reaches the agent as a *result*, not swallowed as an error.**
6. `annotations` are accepted without error.

**Check 5 is run FIRST, with a deliberately-failing call** — an `assert_finding` carrying a paraphrase,
which must come back as a readable `EVIDENCE_NOT_FOUND`. It is the one check that can quietly kill the
project: our refusals are the product, and if they do not reach the agent as usable results, the
premise fails silently.

If you cannot reach the deployed URL or either browser, **report the checks as UNVERIFIED and say
which ones.** Do not report a check you did not run.

---

## Definition of Done (part 8)

**Output path:** `C:\dev\referee\src\tools\register.js`. Nothing else. `docs/environment-check.md` is
Eric's to produce; do not write it.

Before reporting, observe and state each of these:

- `register.js` parses and exports `TOOL_SPECS`, `detectModelContext`, `registry`,
  `registerReferee`.
- `TOOL_SPECS.length === 7` and `TOOL_SPECS.map(t => t.name)` printed, matching exactly:
  `get_review_state`, `read_manuscript`, `assert_finding`, `check_claim`, `request_unblind`,
  `flag_for_editor`, `submit_recommendation` — no additions, no omissions, no renames. Paste the array.
- Every spec carries an `annotations` object with both `readOnlyHint` and `untrustedContentHint`
  present as booleans. Paste the seven pairs. Confirm `read_manuscript` and `check_claim` are the two
  with `untrustedContentHint: true`, and that no other tool is.
- With a fake `document.modelContext` whose `registerTool` resolves, `registerReferee()` returns
  `registered: 7` and the final `webmcp:changed` carries `phase: "live"`. Paste the returned object.
- With a fake that rejects the first tool once and accepts the bare retry, `annotationsAccepted` is
  `false` and `registered` is still 7.
- With a fake that rejects one tool permanently, `registered` is 6, `phase` is `"partial"`, and a
  **second** call to `registerReferee()` reports `registered: 6`, not 7. This is the regression that
  made a partial registration report itself as complete.
- With no `modelContext` at all, `dataset.webmcp` is `"absent"` and nothing throws.
- A grep of `register.js` for `runSimulation`, `exposedTo`, `structuredContent`, and
  `Promise.allSettled` returns zero hits.
- The six environment checks are each reported as run-with-result or **UNVERIFIED**, naming the
  browser and URL where you could not run them.
