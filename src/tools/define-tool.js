/**
 * src/tools/define-tool.js — the wrapper no handler can bypass. 03 §3.
 *
 * =====================================================================================
 * WHAT THIS FILE MAKES STRUCTURALLY IMPOSSIBLE
 * =====================================================================================
 * There is exactly one `return` reachable from execute(): `finish(result)`. Every branch —
 * schema failure, unknown manuscript, missing section, human-only, committed, out-of-order,
 * handler payload, handler refusal, and the D2 catch — routes through it. finish() appends
 * the ledger row, runs the identity belt, and serializes. Therefore:
 *
 *   - a handler CANNOT forget to log     (seam 8: every call, accepted AND refused)
 *   - a handler CANNOT return an object  (D1: the boundary always receives a JSON string)
 *   - a handler CANNOT throw at the agent (D2: a throw becomes ok:false / INTERNAL)
 *
 * That is enforcement by construction rather than by convention, and it is the reason
 * handlers are eight lines of policy each instead of eighty lines of bookkeeping.
 *
 * =====================================================================================
 * THREE PLACES THIS DEPARTS FROM 03 §3's LISTING, AND WHY
 * =====================================================================================
 * 1. NO saveState() CALL. 03 §3's finish() calls saveState(state). core/state.js:298 rules
 *    the opposite and is the built code: "THE ONLY WRITER (02 §5.3). No tool handler calls
 *    persist or touches localStorage." Persistence already happens — appendLedger() invokes
 *    the persist hook state.js bound to it. Calling it again here would be a second writer
 *    on a boundary core deliberately made single-writer.
 * 2. NO bus.emit('tool:settled'). core/ledger.js:133 emits it from inside appendLedger, with
 *    05 §7.1's payload and the call_id we hand it. Emitting again here would double every
 *    row in the agent-activity strip. We emit a settled event ONLY on the path where
 *    appendLedger itself failed, so an in-flight call can never hang in the UI.
 * 3. visibleFieldsFor is core's (src/core/visibility.js), reached through the capability
 *    object, not re-declared here. 03 §0.5 assigns the file to this slice; core already owns
 *    it and a second definition of the one function whose edit would silently convert
 *    structural blinding into masking is exactly the wrong thing to have two of.
 */
import { ok, refuse, serialize, CODES, summarize, nowISO, nextCallId } from './envelope.js';
import { nextAction, fallbackNextAction } from './next-action.js';
import { validate } from './validate.js';
import { emitToolInvoked } from '../core/ledger.js';
import { refereeBus, EVENTS } from '../core/bus.js';

/**
 * Truncates long strings for the ledger's args echo. Tool arguments are agent-authored and
 * already public — there is nothing to redact, only length to bound.
 */
export function safeDigest(args) {
  const out = {};
  for (const [k, val] of Object.entries(args || {})) {
    out[k] = typeof val === 'string' && val.length > 240 ? val.slice(0, 240) + '…' : val;
  }
  return out;
}

/**
 * @param {object} spec
 * @param {string}   spec.name
 * @param {string}   spec.description
 * @param {object}   spec.inputSchema
 * @param {{readOnlyHint:boolean, untrustedContentHint:boolean}} spec.annotations
 * @param {boolean}  spec.humanOnly        short-circuits to the handler's terminal refusal
 * @param {boolean}  spec.requiresRead     enforce P1
 * @param {boolean}  spec.requiresSection  enforce P2
 * @param {boolean}  spec.blockedByCommit  enforce ALREADY_COMMITTED
 * @param {(ctx) => {payload?:object, refusal?:object}} spec.handler
 * @param {(args, result) => object} [spec.digest] args echo for the ledger row
 *
 * @param {object} deps
 * @param {object}   deps.capabilities  the frozen capability object — the ONLY surface onto
 *                                      the rest of the app. It has no path to identity.
 * @param {() => object} deps.getState   returns the live ReviewState
 * @param {(s:string) => string} [deps.normalizeText] 04 §3.1's ONE normalizer, injected by
 *                                      the composition root. See handlers/assert-finding.js.
 * @returns {{name, description, inputSchema, annotations, execute}} a WebMCP tool definition
 */
export function defineTool(spec, deps) {
  const caps = deps.capabilities;
  const getState = deps.getState;

  return {
    name: spec.name,
    description: spec.description,
    inputSchema: spec.inputSchema,
    annotations: spec.annotations,

    /**
     * @param {object|string} inputs   parsed args; a JSON string is handled defensively
     * @param {{signal: AbortSignal}} [context]
     * @returns {Promise<string>} ALWAYS a JSON string (D1). NEVER throws (D2).
     */
    async execute(inputs, context) {
      // loadState/getState is INSIDE the try. It can read localStorage, and localStorage
      // throws — over quota, blocked by settings, partitioned in an in-app browser (06 R10).
      // Outside the try, that throw escapes execute() raw, which is precisely the failure D2
      // exists to prevent, in the one function written to prevent it.
      let state = null;
      let args = {};
      let msId = null;
      const callId = nextCallId();

      // NextAction must never be the thing that throws on the way out of a refusal.
      const safeNext = (s, id) => {
        try { return s ? nextAction(caps, s, id) : fallbackNextAction(); }
        catch { return fallbackNextAction(); }
      };
      const na = () => safeNext(state, msId);

      // ---------------------------------------------------------------------------------
      // THE SINGLE EXIT. Nothing returns from execute() except through here.
      // ---------------------------------------------------------------------------------
      const finish = (resultIn) => {
        let result = resultIn;

        // Runtime belt (02 §2.5): a payload carrying an identity KEY never reaches the wire.
        // It checks keys, never values against identity strings — comparing a return against
        // real author names would require the tool layer to read the identity store, and the
        // verifier would become the leak.
        try {
          if (typeof caps.assertNoIdentityKeys === 'function') caps.assertNoIdentityKeys(result);
        } catch (leak) {
          console.error('[referee] identity belt tripped in ' + spec.name, leak);
          result = refuse(spec.name, CODES.INTERNAL,
            'The page could not complete this call.',
            { possible: false,
              how: 'Report this to the human reviewer and continue with another call.',
              with: { tool: spec.name } },
            safeNext(state, msId));
        }

        try {
          caps.appendLedger({
            actor: 'agent',
            action: spec.name,
            manuscript_id: msId,
            args_digest: spec.digest ? spec.digest(args, result) : safeDigest(args),
            outcome: result.ok ? 'accepted' : 'refused',
            code: result.ok ? null : result.code,
            visible_fields_at_time: caps.visibleFieldsFor(msId, state),
            note: null,
            // Pairs this row's 'tool:settled' with the 'tool:invoked' emitted at entry.
            call_id: callId
          });
          // Persistence and the 'tool:settled' emit both happen INSIDE appendLedger.
          // See the header note — core is the single writer of each.

          // next_expected_action is recomputed AFTER the row lands, and this is not a detail.
          // hasRead() and deriveFindings() are derivations over the ledger, so a NextAction
          // computed inside the handler is computed against a ledger that does not yet contain
          // this call. read_manuscript would then tell the agent "you have not been handed this
          // manuscript yet" in the very payload handing it over, and assert_finding would keep
          // steering back to the criterion it had just covered. The wrapper owns the recompute
          // for the same reason it owns the append: the handler cannot see the row it caused.
          result.next_expected_action = safeNext(state, msId);
        } catch (logErr) {
          // Logging must never convert a good result into a failure. That would be D2's
          // failure mode arriving through the back door.
          console.error('[referee] ledger append failed in ' + spec.name, logErr);
          // The settle half would have been emitted by appendLedger. It was not, so emit it
          // here or the agent-activity strip shows this call in flight forever.
          try {
            refereeBus.emit(EVENTS.TOOL_SETTLED, {
              name: spec.name, call_id: callId,
              outcome: result.ok ? 'accepted' : 'refused',
              code: result.ok ? null : result.code,
              manuscript_id: msId, seq: null, at: nowISO()
            });
          } catch { /* the bus is not allowed to take the result down either */ }
        }

        // Advisory, additive, and never load-bearing: a one-clause summary from the frozen
        // table in envelope.js, so a ledger row can never carry interpolated manuscript text.
        try {
          refereeBus.emit(EVENTS.NOTICE, {
            level: result.ok ? 'info' : 'warn',
            code: result.ok ? 'TOOL_ACCEPTED' : result.code,
            message: summarize(spec.name, result)
          });
        } catch { /* ignore */ }

        return serialize(result);          // D1: a JSON string, always
      };

      try {
        state = getState();
        if (!state || !Array.isArray(state.ledger)) {
          throw new Error('no review state available');
        }

        // 05 §7.1: the Agent Pulse needs a signal at handler ENTRY, not only at return.
        // Without it the sweep has no trigger and the page looks dead while the agent works.
        emitToolInvoked({
          name: spec.name,
          call_id: callId,
          manuscript_id: typeof (inputs || {}).manuscript_id === 'string'
            ? inputs.manuscript_id : null,
          args_digest: safeDigest(typeof inputs === 'object' && inputs ? inputs : {})
        });

        // --- 1. argument normalization. Some hosts hand execute() a JSON string. ---------
        if (typeof inputs === 'string') {
          try {
            args = JSON.parse(inputs);
          } catch {
            return finish(refuse(spec.name, CODES.INVALID_ARGUMENT,
              'Arguments could not be parsed as JSON.',
              { possible: true,
                how: 'Send arguments as an object matching this tool’s inputSchema.',
                with: { schema_required: spec.inputSchema.required || [] } },
              na()));
          }
        } else {
          args = inputs || {};
        }
        if (args === null || typeof args !== 'object' || Array.isArray(args)) args = {};
        msId = typeof args.manuscript_id === 'string' ? args.manuscript_id : null;

        // context.signal is accepted and intentionally unused: every handler body is
        // synchronous and completes in microseconds over an in-memory corpus, so there is no
        // await point at which an abort could be honored. Documented, not ignored (03 §6.3).
        void context;

        // --- 2. schema ------------------------------------------------------------------
        const v = validate(args, spec.inputSchema);
        if (!v.valid) {
          return finish(refuse(spec.name, CODES.INVALID_ARGUMENT,
            'One or more arguments did not match this tool’s input schema.',
            { possible: true,
              how: 'Correct the listed fields and call again.',
              with: { violations: v.errors, schema_required: spec.inputSchema.required || [] } },
            na()));
        }

        // --- 3. manuscript exists -------------------------------------------------------
        let ms = null;
        if (msId !== null) {
          ms = caps.getPublicManuscript(msId);
          if (!ms) {
            return finish(refuse(spec.name, CODES.UNKNOWN_MANUSCRIPT,
              'No manuscript with that id is in the review queue.',
              { possible: true,
                how: 'Call get_review_state to list the queue, then use an id from it.',
                with: { known_manuscript_ids: [...caps.MANUSCRIPT_IDS] } },
              na()));
          }
        }

        // --- 4. section exists ----------------------------------------------------------
        // 03 §7 rule 3: a request for `authors`, `funding`, or `asdf` takes THIS path, with
        // the same payload and the same available_sections list. There is no BLINDED_SECTION
        // code and there must never be one — a differential answer is an oracle.
        if (ms && typeof args.section === 'string') {
          const order = caps.getSectionOrder(msId) || [];
          if (!order.includes(args.section)) {
            return finish(refuse(spec.name, CODES.SECTION_NOT_FOUND,
              'This manuscript has no section with that id.',
              { possible: true,
                how: 'Choose a section id from available_sections and call again.',
                with: { manuscript_id: msId, available_sections: [...order] } },
              na()));
          }
        }

        // --- 5. human-only OUTRANKS ordering and commit state ---------------------------
        // 03 §2.2: a human-only refusal always beats an ordering refusal, so the agent is
        // told the true reason rather than sent on a doomed retry.
        if (spec.humanOnly) {
          const r = spec.handler({ args, state, ms, caps, deps, next: na, callId });
          return finish(r.refusal || r.payload);
        }

        // --- 6. committed ---------------------------------------------------------------
        if (spec.blockedByCommit && msId && caps.committedFor(state, msId)) {
          const rec = caps.committedFor(state, msId);
          return finish(refuse(spec.name, CODES.ALREADY_COMMITTED,
            'The human reviewer has committed a recommendation for this manuscript; it is frozen.',
            { possible: false,
              how: 'Move to a manuscript that has no committed recommendation.',
              with: { manuscript_id: msId,
                      committed_at: rec.committed_at ?? rec.at ?? null,
                      committed_by: 'human',
                      ledger_seq: rec.ledger_seq ?? null } },
            na()));
        }

        // --- 7. ordering — P1 then P2 ---------------------------------------------------
        // The agent cannot hold evidence from a manuscript the page never handed it. A quote
        // that verifies without a prior read came from somewhere else — a prior session, a
        // hallucination, or an injection. Catching that is a feature.
        if (spec.requiresRead && msId && !caps.hasRead(state, msId)) {
          return finish(refuse(spec.name, CODES.OUT_OF_ORDER,
            'You have not read this manuscript in this session.',
            { possible: true,
              how: 'Call read_manuscript for this manuscript, then repeat this call unchanged.',
              with: { required_call: { tool: 'read_manuscript', args: { manuscript_id: msId } },
                      unmet_precondition: 'P1' } },
            na()));
        }
        if (spec.requiresSection && msId && typeof args.section === 'string'
            && !caps.hasRead(state, msId, args.section)) {
          return finish(refuse(spec.name, CODES.OUT_OF_ORDER,
            'You have not read the section this quote is attributed to.',
            { possible: true,
              how: 'Call read_manuscript for this section, then repeat this call unchanged.',
              with: { required_call: { tool: 'read_manuscript',
                                       args: { manuscript_id: msId, sections: [args.section] } },
                      unmet_precondition: 'P2' } },
            na()));
        }

        // --- 8. handler -----------------------------------------------------------------
        const r = spec.handler({ args, state, ms, caps, deps, next: na, callId });
        return finish(r.refusal || r.payload);

      } catch (err) {
        // D2: a genuine runtime exception becomes a structured refusal. Never a raw throw.
        // This also covers a getState() fault, which is why that call is inside the try.
        console.error('[referee] handler threw in ' + spec.name, err);
        return finish(refuse(spec.name, CODES.INTERNAL,
          'The page could not complete this call.',
          { possible: false,
            how: 'Report this to the human reviewer and continue with another call.',
            with: { tool: spec.name } },
          safeNext(state, msId)));
      }
    }
  };
}

export { ok, refuse, CODES };
