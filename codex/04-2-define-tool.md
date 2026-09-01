# 04-2 — `defineTool()`, the wrapper no handler can bypass (slice C6, part 3 of 9)

**Deliverables:** `src/tools/validate.js`, `src/tools/define-tool.js`.

Read `00-START-HERE.md`, `04-0-contracts.md` and `04-1-envelopes-and-ordering.md` first. Nothing else.

One wrapper. It performs argument validation, precondition checks, ledger append on **both** accepted
and refused outcomes, state persistence, bus emission, and the exception-to-`INTERNAL` conversion.
Handlers receive an already-validated context and return a payload or a refusal descriptor.

**No handler calls `appendLedger` itself, and no handler serializes its own return.** That is how "no
handler can forget to log" becomes structural rather than a convention a reviewer has to enforce.

---

## 1. `src/tools/validate.js`

A minimal JSON-Schema subset validator. It must support exactly: `type` (`string`, `integer`,
`number`, `boolean`, `array`, `object`, `null`), `required`, `enum`, `minLength`, `maxLength`,
`minimum`, `maximum`, `minItems`, `maxItems`, `items`, `properties`, `additionalProperties: false`.
That subset covers every schema in this slice. Nothing else is needed and nothing else should be
built.

```js
export function validate(args, schema)
// -> { valid: boolean, errors: Array<{path: string, expected: string, got: string}> }
```

`path` uses dotted and bracketed form (`"sections[0]"`, `"criterion"`). `expected` is a short human
phrase (`"one of SECTION_IDS"`, `"string, minLength 40"`). `got` describes what arrived, **never
echoing more than 240 characters of it.**

Enums are re-checked in handler code as well as in the schema, because host enforcement of
`inputSchema` varies. **The schema is a hint; the page is the enforcement.**

---

## 2. `src/tools/define-tool.js`

```js
// src/tools/define-tool.js
import { ok, refuse, serialize, CODES, visibleFieldsFor, committedFor,
         summarize, nowISO, nextCallId } from "./envelope.js";
import { nextAction } from "./next-action.js";
import { validate } from "./validate.js";
import { loadState, saveState } from "../core/state.js";
import { getPublicManuscript, getSectionOrder } from "../data/public-access.js";
import { appendLedger, hasRead } from "../core/ledger.js";
import { bus } from "../core/bus.js";
import { MANUSCRIPT_IDS } from "../core/constants.js";

/**
 * Produces a WebMCP tool definition object. Registration is performed elsewhere, which awaits
 * it and passes the shared AbortSignal -- this function does NOT register.
 *
 * spec = { name, description, inputSchema, annotations,
 *          humanOnly, requiresRead, requiresSection, blockedByCommit,
 *          handler: (ctx) => ({payload?, refusal?}),
 *          digest?: (args, result) => object }
 */
export function defineTool(spec) {
  return {
    name: spec.name,
    description: spec.description,
    inputSchema: spec.inputSchema,
    annotations: spec.annotations,

    /** @returns {Promise<string>} ALWAYS a JSON string. Never throws. */
    async execute(inputs, context) {
      // loadState() is INSIDE the try. It reads localStorage, and localStorage throws: over
      // quota, blocked by settings, partitioned in an in-app browser. Outside the try, that
      // throw escapes execute() as a raw exception -- precisely the failure this wrapper
      // exists to make impossible, in the one function that was supposed to make it
      // impossible by construction.
      let state = null;
      let args = {};
      let msId = null;
      const callId = nextCallId();

      // Single exit point. Nothing returns from execute() except through finish().
      const finish = (result) => {
        try {
          const row = appendLedger({
            actor: "agent",
            action: spec.name,
            manuscript_id: msId,
            args_digest: spec.digest ? spec.digest(args, result) : safeDigest(args),
            outcome: result.ok ? "accepted" : "refused",
            code: result.ok ? null : result.code,
            visible_fields_at_time: visibleFieldsFor(msId, state),
            note: null
          });
          saveState(state);
          bus.emit("tool:settled", {
            callId, tool: spec.name, actor: "agent",
            ok: result.ok,
            code: result.ok ? null : result.code,
            summary: summarize(spec.name, result),      // one clause, from a frozen template
            envelopeSummary: result,                    // the returned object, for the disclosure
            visible_fields_at_time: row.visible_fields_at_time,
            ts: row.ts
          });
          bus.emit("state:changed", { keys: ["ledger", "scores"] });
        } catch (logErr) {
          // Logging must never convert a good result into a failure. Surface it and still
          // return the agent's result.
          console.error("[referee] ledger/persist failed", logErr);
        }
        return serialize(result);            // always a JSON string
      };

      const na = () => (state ? nextAction(state, msId) : null);

      try {
        state = loadState();

        // The UI needs a signal at handler ENTRY, not only at return. Without it the page
        // looks dead while the agent works.
        bus.emit("tool:invoked", { callId, tool: spec.name, actor: "agent",
                                   argsSummary: safeDigest(inputs || {}), ts: nowISO() });

        // 1. argument normalization. Some hosts may hand execute a JSON string.
        if (typeof inputs === "string") {
          try { args = JSON.parse(inputs); }
          catch {
            return finish(refuse(spec.name, CODES.INVALID_ARGUMENT,
              "Arguments could not be parsed as JSON.",
              { possible: true, how: "Send arguments as an object matching this tool's inputSchema.",
                with: { schema_required: spec.inputSchema.required || [] } },
              na()));
          }
        } else {
          args = inputs || {};
        }
        msId = typeof args.manuscript_id === "string" ? args.manuscript_id : null;

        // context.signal is accepted and intentionally unused: every handler body is
        // synchronous and completes in microseconds over an in-memory corpus, so there is no
        // await point at which an abort could be honored. Documented, not ignored.
        void context;

        // 2. schema
        const v = validate(args, spec.inputSchema);
        if (!v.valid) {
          return finish(refuse(spec.name, CODES.INVALID_ARGUMENT,
            "One or more arguments did not match this tool's input schema.",
            { possible: true,
              how: "Correct the listed fields and call again.",
              with: { violations: v.errors, schema_required: spec.inputSchema.required || [] } },
            na()));
        }

        // 3. manuscript exists
        let ms = null;
        if (msId !== null) {
          ms = getPublicManuscript(msId);
          if (!ms) {
            return finish(refuse(spec.name, CODES.UNKNOWN_MANUSCRIPT,
              "No manuscript with that id is in the review queue.",
              { possible: true,
                how: "Call get_review_state to list the queue, then use an id from it.",
                with: { known_manuscript_ids: [...MANUSCRIPT_IDS] } },
              na()));
          }
        }

        // 4. section exists -- IDENTICAL path for a blinded-domain name and a nonsense name.
        // Asking for `authors`, `funding`, or `asdf` produces the same payload. There is no
        // BLINDED_SECTION code and there must never be one.
        if (ms && typeof args.section === "string" && !getSectionOrder(msId).includes(args.section)) {
          return finish(refuse(spec.name, CODES.SECTION_NOT_FOUND,
            "This manuscript has no section with that id.",
            { possible: true,
              how: "Choose a section id from available_sections and call again.",
              with: { manuscript_id: msId, available_sections: getSectionOrder(msId) } },
            na()));
        }

        // 5. human-only outranks ordering and commit state
        if (spec.humanOnly) {
          const r = spec.handler({ args, state, ms, next: na });
          return finish(r.refusal || r.payload);
        }

        // 6. committed
        if (spec.blockedByCommit && msId && committedFor(state, msId)) {
          const rec = committedFor(state, msId);
          return finish(refuse(spec.name, CODES.ALREADY_COMMITTED,
            "The human reviewer has committed a recommendation for this manuscript; it is frozen.",
            { possible: false,
              how: "Move to a manuscript that has no committed recommendation.",
              with: { manuscript_id: msId, committed_at: rec.committed_at,
                      committed_by: "human", ledger_seq: rec.ledger_seq } },
            na()));
        }

        // 7. ordering -- P1 then P2
        if (spec.requiresRead && msId && !hasRead(state, msId)) {
          return finish(refuse(spec.name, CODES.OUT_OF_ORDER,
            "You have not read this manuscript in this session.",
            { possible: true,
              how: "Call read_manuscript for this manuscript, then repeat this call unchanged.",
              with: { required_call: { tool: "read_manuscript", args: { manuscript_id: msId } },
                      unmet_precondition: "P1" } },
            na()));
        }
        if (spec.requiresSection && msId && typeof args.section === "string"
            && !hasRead(state, msId, args.section)) {
          return finish(refuse(spec.name, CODES.OUT_OF_ORDER,
            "You have not read the section this quote is attributed to.",
            { possible: true,
              how: "Call read_manuscript for this section, then repeat this call unchanged.",
              with: { required_call: { tool: "read_manuscript",
                                       args: { manuscript_id: msId, sections: [args.section] } },
                      unmet_precondition: "P2" } },
            na()));
        }

        // 8. handler
        const r = spec.handler({ args, state, ms, next: na });
        return finish(r.refusal || r.payload);

      } catch (err) {
        // A genuine runtime exception becomes a structured refusal. Never a raw throw.
        console.error("[referee] handler threw in " + spec.name, err);
        return finish(refuse(spec.name, CODES.INTERNAL,
          "The page could not complete this call.",
          { possible: false, how: "Report this to the human reviewer and continue with another call.",
            with: { tool: spec.name } },
          na()));
      }
    }
  };
}

/** Truncates long strings. Args are agent-authored and already public -- nothing to redact. */
function safeDigest(args) {
  const out = {};
  for (const [k, val] of Object.entries(args)) {
    out[k] = typeof val === "string" && val.length > 240 ? val.slice(0, 240) + "…" : val;
  }
  return out;
}
```

---

## 3. Why the wrapper owns the ledger and the serialization

`finish()` is the single return path in `execute`. There is no `return` inside `execute` that does not
pass through it, **including the catch block.** Append-on-every-call and always-a-JSON-string are
therefore satisfied by construction. A handler author physically cannot produce a return that skips a
ledger row or leaves the boundary as a bare object.

`finish()` is also where the state write can fail without taking the result down. If `appendLedger` or
`saveState` throws — partitioned storage again — the inner catch logs it and still returns the agent's
result. A logging failure must not convert a good answer into an error.

`callId` is a monotonic per-session counter assigned at entry so `tool:invoked` and `tool:settled`
pair up. `summarize` reads from a frozen template table, so a ledger summary can never interpolate
manuscript text.

---

## Definition of Done (part 3)

**Output paths:** `C:\dev\referee\src\tools\validate.js`, `C:\dev\referee\src\tools\define-tool.js`.
Nothing else.

Before moving to `04-3`, observe and state each of these:

- Both modules parse and export `validate` and `defineTool`.
- **Every `return` inside `execute` passes through `finish()`.** Report the count of `return`
  statements in `execute` and confirm each one is `return finish(...)`. This is the structural claim;
  prove it by counting, not by asserting.
- A trivial test tool built with `defineTool` and driven directly (no browser):
  - a valid call returns a **string** that `JSON.parse`s to an object carrying `ok: true`;
  - a schema-violating call returns a string parsing to `ok:false, code:"INVALID_ARGUMENT"` with a
    populated `retry.with.violations`;
  - a handler that **throws** returns a string parsing to `ok:false, code:"INTERNAL"` and **does not
    propagate the exception**. Paste all three parsed objects.
- With `appendLedger` stubbed to throw, a valid call still returns the agent's `ok:true` result.
  Paste it.
- `loadState` stubbed to throw returns `ok:false, code:"INTERNAL"`, not an uncaught exception.
- Precedence: a call that is simultaneously human-only, uncommitted-blocked, and out of order returns
  the **human-only** code. Paste the result.
- `validate` supports exactly the listed keywords and no others. List what you implemented.
- No handler file exists yet that calls `appendLedger`, `saveState`, or `serialize`. Confirm by grep
  once `04-3` through `04-7` land; state here that the wrapper is the only caller so far.
