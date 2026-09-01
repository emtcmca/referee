/**
 * src/tools/next-action.js — 03 §2.3.
 *
 * ONE pure function, so all seven tools agree about what should happen next. It rides on
 * EVERY return, accepted and refused alike, which is what turns an ordering constraint into
 * guidance instead of a wall: a refused agent is never left guessing, it is handed the next
 * call with the arguments pre-filled.
 *
 * It is ADVISORY. Nothing enforces it. The two real preconditions (P1, P2) live in
 * define-tool.js and are the only things that can actually stop a call.
 *
 * Takes `caps` rather than importing core directly so the tool layer keeps exactly one
 * surface onto the rest of the app — the capability object, which has no path to identity.
 */

/**
 * @param {object} caps      the capability object (03 §0.5–0.8 accessors)
 * @param {object} state     ReviewState
 * @param {string|null} manuscriptId
 * @returns {{actor:'agent'|'human', tool:string|null, args:object, why:string}}
 */
export function nextAction(caps, state, manuscriptId) {
  const ids = caps.MANUSCRIPT_IDS;
  const uncommitted = () => ids.find((id) => !caps.committedFor(state, id)) || null;

  if (!manuscriptId) {
    const next = uncommitted();
    return next
      ? { actor: 'agent', tool: 'read_manuscript', args: { manuscript_id: next },
          why: 'This is the first manuscript in the queue with no committed recommendation.' }
      : { actor: 'human', tool: null, args: {},
          why: 'Every manuscript in the queue has a committed recommendation.' };
  }

  if (caps.committedFor(state, manuscriptId)) {
    const next = uncommitted();
    return next
      ? { actor: 'agent', tool: 'read_manuscript', args: { manuscript_id: next },
          why: 'This manuscript is committed and frozen. Move to the next one.' }
      : { actor: 'human', tool: null, args: {}, why: 'The queue is complete.' };
  }

  if (!caps.hasRead(state, manuscriptId)) {
    return { actor: 'agent', tool: 'read_manuscript', args: { manuscript_id: manuscriptId },
             why: 'You have not been handed this manuscript yet.' };
  }

  // Every manuscript has all four criteria scored at all times (02 §1.6), so "missing" means
  // "no accepted finding cites it yet" — a fact about the ledger, not about the rubric.
  const covered = new Set(
    caps.deriveFindings(state)
      .filter((f) => f.manuscript_id === manuscriptId && f.status === 'active')
      .map((f) => f.criterion)
  );
  const missing = caps.CRITERIA.filter((c) => !covered.has(c));

  if (missing.length) {
    return { actor: 'agent', tool: 'assert_finding',
             args: { manuscript_id: manuscriptId, criterion: missing[0] },
             why: 'This criterion has no evidence-backed finding yet.' };
  }

  return { actor: 'human', tool: null, args: { manuscript_id: manuscriptId },
           why: 'All four criteria are covered. The recommendation is the human reviewer’s to make.' };
}

/**
 * The one NextAction used when the page could not even load state — there is nothing to
 * reason about, and returning null would strip a field 03 §1.1 says is on EVERY return.
 */
export function fallbackNextAction() {
  return { actor: 'human', tool: null, args: {},
           why: 'The page could not read its own review state. The human reviewer should reload.' };
}
