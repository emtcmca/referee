/**
 * src/core/visibility.js — what the acting party was ENTITLED TO READ at the moment of a call.
 *
 * =====================================================================================
 * THE LOAD-BEARING LINE OF THE WHOLE PROJECT (03 §0.5, 02 §1.9.1)
 * =====================================================================================
 * Unblinding a manuscript changes the HUMAN's view. It changes NO tool return. There is no
 * code path from state.unblinded into an agent payload, and the agent branch below never
 * reads it.
 *
 * The agent branch takes no input but the actor. It CANNOT widen — not "does not", cannot:
 * there is no expression in it that consults `state`, the manuscript, or the unblind list.
 * A judge scrolling the ledger sees the IDENTICAL array on every agent row in the session,
 * including every row that comes AFTER a human unblind. That is the property you can read
 * straight off the log without trusting a word of this comment.
 *
 * If a future edit makes either function consult state.unblinded on the agent branch,
 * structural blinding has silently become masking. Do not make that edit.
 *
 * This module imports field-paths.js, which contains NAMES AND ZERO DATA. Recording
 * "the human could see identity.authors[].name" does not require knowing any name.
 */
import { PUBLIC_FIELD_PATHS, IDENTITY_FIELD_PATHS, QUEUE_FIELD_PATHS } from './field-paths.js';
import { getPublicManuscript } from './corpus-access.js';

/**
 * 02 §1.9.1 — the general form. Used for every ledger row, agent and human alike.
 * @param {'agent'|'human'} actor
 * @param {string|null} manuscriptId
 * @param {object} state
 * @returns {string[]} field-path NAMES. Never a value.
 */
export function visibleFieldsAtTime(actor, manuscriptId, state) {
  // With no manuscript in scope the actor could still see the queue, so the queue paths are
  // what they were entitled to read. Returning [] would blank the first row of every session.
  if (manuscriptId === null || manuscriptId === undefined) return [...QUEUE_FIELD_PATHS];

  if (actor === 'agent') return [...PUBLIC_FIELD_PATHS];   // constant. always. cannot widen.

  // Human branch. Widens visibly, and only after an explicit unblind. The widening is the
  // point of the record, not a leak. `unblinded` holds {id, reason, at} RECORDS, so this is
  // `.some(u => u.id === id)` and never `.includes(id)` (02 §5.1).
  const unblinded = Array.isArray(state?.unblinded) ? state.unblinded : [];
  return unblinded.some((u) => u.id === manuscriptId)
    ? [...PUBLIC_FIELD_PATHS, ...IDENTITY_FIELD_PATHS]
    : [...PUBLIC_FIELD_PATHS];
}

/**
 * 03 §0.5 — the AGENT-ONLY form, the signature the tool wrapper calls. It takes no actor
 * because there is only one actor it can describe. Note what is absent: `state` is accepted
 * for signature compatibility and is deliberately never read on the returning path.
 *
 * @param {string|null} manuscriptId
 * @param {object} state  accepted, never consulted — see above
 * @returns {string[]}
 */
export function visibleFieldsFor(manuscriptId, state) {   // eslint-disable-line no-unused-vars
  if (manuscriptId === null || manuscriptId === undefined) return [...QUEUE_FIELD_PATHS];
  const ms = getPublicManuscript(manuscriptId);
  if (!ms) return [...QUEUE_FIELD_PATHS];
  return [...PUBLIC_FIELD_PATHS];
}

export { PUBLIC_FIELD_PATHS, IDENTITY_FIELD_PATHS, QUEUE_FIELD_PATHS };
