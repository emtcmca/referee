# 00 — WebMCP API Reality Check (AUTHORITATIVE)

**Verified 2026-09-01 against Chrome for Developers, "Imperative API | AI on Chrome"
(https://developer.chrome.com/docs/ai/webmcp/imperative-api) plus corroborating coverage of the
Chrome 149 origin trial.**

This section OVERRIDES any API shape assumed elsewhere in this document. Where another section
guesses at the surface, this one wins. Codex: read this before writing a line of tool code.

---

## 1. The real surface

```js
await document.modelContext.registerTool(toolDefinition, options);
```

`registerTool` is **async — await it.** It takes two arguments, not one. The Devpost snippet
(`document.modelContext.registerTool({ name, description, inputSchema, execute })`) is a
simplification; it is correct as far as it goes and satisfies the submission's code requirement,
but the real definition object has more.

### Tool definition

```js
{
  name: string,
  description: string,
  inputSchema: object,               // standard JSON Schema
  execute: async (inputs, context) => result,
  annotations?: {
    readOnlyHint?: boolean,
    untrustedContentHint?: boolean
  }
}
```

### Options

```js
{
  signal?: AbortSignal,     // abort() unregisters the tool
  exposedTo?: string[]      // cross-origin exposure; secure contexts only
}
```

### inputSchema

Standard JSON Schema. Documented keys in use: `type: 'object'`, `properties`, `required`,
`enum`, `oneOf`.

### execute

```js
execute: async (inputs, context) => result
```

- `inputs` — parsed object matching `inputSchema.properties`.
- `context` — `{ signal: AbortSignal }` for cancellation.
- **Return type is flexible and under-specified.** Chrome's own examples return plain strings.

### Also available

- `await document.modelContext.getTools(options)` — `options.fromOrigins` for cross-origin.
- `await document.modelContext.executeTool(tool, inputJson, options)` — `inputJson` is a JSON
  **string**. Returns `null` when the call triggers navigation.
- `document.modelContext.addEventListener("toolchange", handler)`.

---

## 2. Decisions this forces. LOCKED — do not vary.

### D1. `execute` returns a JSON **string**, never a bare object.

`return JSON.stringify(payload);` for every one of the seven tools, success and refusal alike.

Rationale: the return type is under-specified, Chrome's samples return strings, and Referee must
behave identically in the ChatGPT desktop in-app browser, whose serialization behavior is not
documented. A string always survives the boundary. An object may not. This costs nothing and
removes a whole class of environment divergence.

### D2. Refusals are RETURNED, never THROWN.

Chrome documents no error/failure return format; exceptions propagate as exceptions. An agent
that receives a thrown error gets an unstructured failure it cannot act on, which destroys the
entire premise: our refusals are the product, and they must be legible and actionable.

So: every handler returns `JSON.stringify({ ok: false, code, message, ...context })`. Nothing in
the seven handlers ever throws on a policy refusal. Wrap each handler body in try/catch and
convert any genuine runtime exception into `{ ok:false, code:"INTERNAL", message:"..." }` so a
bug can never surface as a raw throw during the demo.

### D3. Use the spec's own safety annotations. This is free WebMCP Leverage — do not skip it.

`annotations.untrustedContentHint` exists in the standard for precisely the situation Referee is
built around. Set it deliberately and say so in the README and the video:

| tool | `readOnlyHint` | `untrustedContentHint` |
|---|---|---|
| `get_review_state` | `true` | `false` |
| `read_manuscript` | `true` | **`true`** |
| `check_claim` | `true` | **`true`** |
| `assert_finding` | `false` | `false` |
| `flag_for_editor` | `false` | `false` |
| `request_unblind` | `true` | `false` |
| `submit_recommendation` | `false` | `false` |

`read_manuscript` and `check_claim` are the two tools whose returns are derived from
author-supplied manuscript text. They carry `untrustedContentHint: true` even though the page has
already sanitized that text. Belt and suspenders, and it is the honest declaration.

This is a strong, specific, checkable point for the submission text: **Referee does not just
register tools, it uses the standard's own trust annotations to declare which of its returns are
derived from untrusted content.** Most submissions will leave `annotations` off entirely.

### D4. Feature detection and unregistration.

```js
const mc = globalThis.document?.modelContext ?? globalThis.navigator?.modelContext ?? null;
```

`navigator.modelContext` is deprecated as of Chrome 150 in favor of `document.modelContext`.
Prefer `document`, fall back to `navigator` only so an older build still works, and render the
WebMCP-absent state when both are missing.

Register every tool through one `AbortController` so the whole set can be torn down and
re-registered cleanly during development:

```js
const registry = new AbortController();
await mc.registerTool(def, { signal: registry.signal });
```

Do **not** use `exposedTo`. Referee is single-origin. Cross-origin exposure is out of scope and
is a security decision we are not making under deadline.

### D5. Registration is awaited, and the page must not race it.

`registerTool` is async. Register all seven in sequence inside one `async function
registerReferee()`, await the whole thing, and only then flip the UI's "tools live" indicator.
A judge who sees the indicator must be able to trust it.

---

## 3. What is still unverified, and how Task 0 settles it

None of the above has been confirmed *in the ChatGPT desktop in-app browser*. Chrome's docs
describe Chrome. The two environments are the two places judges will test, and any divergence
between them is the single highest-severity risk in this build.

**Task 0 must confirm, on the deployed production URL, in BOTH browsers:**

1. `document.modelContext` is present.
2. `await registerTool(...)` resolves without throwing.
3. The agent can discover and call the tool.
4. A returned JSON **string** arrives at the agent intact and readable.
5. A returned `{ok:false}` refusal is surfaced to the agent as a *result*, not swallowed as an
   error.
6. `annotations` are accepted without error (if either browser rejects the key, drop annotations
   in that environment rather than failing registration).

Point 5 is the one that can quietly kill the project. If refusals do not reach the agent as
usable results in one of the two environments, the entire demo premise fails, and it fails
silently. Test it first, with a deliberately-failing call, before any other work.

Record the outcome of all six checks in `docs/environment-check.md` in the repo, with the date,
both browser versions, and a screenshot. That file is also evidence for the judges that the
project actually runs where they will test it.

---

## 4. Status caveat for the README

WebMCP is an origin-trial-stage proposal and Chrome's own documentation says the API is
"subject to change." State that in the README rather than presenting the surface as settled.
