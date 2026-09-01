/**
 * src/ui/render/verdict.js — the pinned recommendation bar.
 *
 * Pinned so the one human-only decision on the page is never off-frame. The
 * enum is SINGULAR — accept | minor_revision | major_revision | reject — and it
 * is imported from constants.js rather than spelled again here, because the
 * plural spellings are dead and a second copy is how they came back.
 *
 * verdict.blockedNotice is ASSERTIVE 2 of exactly 2 in the whole app. The other
 * is unblind.announcement. If a third assertive region appears in the build,
 * one of them is wrong.
 */

import { el, attrs, append, clear, mach, stamp, humanKey, DOT, ARROW, clockOf } from './dom.js';
import { RECOMMENDATIONS } from '../../core/constants.js';
import { ui, refusalTallies } from './ui-state.js';

const WORD = {
  accept: 'Accept',
  minor_revision: 'Minor',
  major_revision: 'Major',
  reject: 'Reject',
};
const SPOKEN = {
  accept: 'accept',
  minor_revision: 'a minor revision',
  major_revision: 'a major revision',
  reject: 'reject',
};
const ARIA = {
  accept: 'Accept',
  minor_revision: 'Minor revision',
  major_revision: 'Major revision',
  reject: 'Reject',
};

export function buildVerdict(root, handlers) {
  clear(root);

  const bar = el('div');
  bar.id = 'verdict';
  attrs(bar, { 'data-bind': 'verdict-bar' });

  const say = el('p', 'say');
  attrs(say, { 'data-bind-local': 'verdict-said' });
  const sub = el('p', 'sub');
  attrs(sub, { 'data-bind-local': 'verdict-sub' });

  // verdict.blockedNotice — assertive, and written ONLY when an agent attempt
  // was refused. An empty assertive region announces nothing, which is correct.
  const blocked = el('p', 'm');
  attrs(blocked, { 'data-bind': 'verdict-blocked' });

  // verdict.blockedChip — persistent, and clicking it filters the record.
  // It sits with the SENTENCE, not with the controls. In the control cluster it
  // is a fifth item in an auto-sized track: the stamp and the count take the
  // width they ask for, the sentence is left in a ~110px gutter four words
  // tall, and the bar triples in height the moment the page refuses anything —
  // which is precisely the moment it most needs to be readable. Beside the
  // sentence it reads as what it is, a fact about this review.
  const chip = el('span');
  attrs(chip, { 'data-bind': 'verdict-blocked-chip', hidden: true });

  // The assertive notice and the chip are the same event said twice — once for
  // a screen reader, once for the eye. They share a line so the refusal costs
  // the pinned bar one row rather than two.
  const alarm = el('div', 'verdict-alarm');
  append(alarm, blocked, chip);

  const row = el('div');
  row.id = 'verdict-row';

  const group = el('div', 'rec-group');
  attrs(group, { role: 'radiogroup', 'aria-label': 'Your recommendation' });
  for (const value of RECOMMENDATIONS) {
    const b = el('button', null, WORD[value]);
    b.type = 'button';
    attrs(b, { role: 'radio', 'aria-checked': 'false', 'aria-label': ARIA[value], 'data-recommendation': value });
    b.addEventListener('click', () => handlers.chooseRecommendation(value));
    group.appendChild(b);
  }

  const commit = el('button', 'commit', 'Commit');
  commit.type = 'button';
  attrs(commit, { 'data-action': 'open-commit' });
  commit.addEventListener('click', () => handlers.openCommit());

  append(row, humanKey(), group, commit);

  /* The bar is laid out FLAT, not as a left block beside a control block. The
     machine line is a full-width band like every other .sub on this page: in a
     column beside the controls it had ~400px, wrapped to three lines, and made
     the pinned bar taller than the spread it is pinned beneath. Flat, it is one
     line, and the grid puts the sentence and the controls on the row above. */
  append(bar, say, row, sub, alarm);
  append(root, bar);
  return root;
}

/** verdict.bar — state.committed is null or one Commitment. */
export function renderVerdict(bar, state, handlers) {
  const say = bar.querySelector('[data-bind-local="verdict-said"]');
  const sub = bar.querySelector('[data-bind-local="verdict-sub"]');
  const commit = bar.querySelector('[data-action="open-commit"]');
  const committed = state ? state.committed : null;

  bar.classList.toggle('is-committed', !!committed);

  for (const b of bar.querySelectorAll('[data-recommendation]')) {
    const value = b.getAttribute('data-recommendation');
    const chosen = committed ? committed.recommendation === value : ui.pendingRecommendation === value;
    b.setAttribute('aria-checked', String(chosen));
    b.disabled = !!committed;
  }
  if (commit) {
    commit.disabled = !!committed || !ui.pendingRecommendation || !ui.selectedId;
    commit.textContent = committed ? 'Committed' : 'Commit';
  }

  if (!say || !sub) return;

  if (committed) {
    clear(say);
    say.appendChild(document.createTextNode(
      'You recommended ' + (SPOKEN[committed.recommendation] || committed.recommendation)
      + '. The assistant never could have.'));
    clear(sub);
    sub.appendChild(document.createTextNode('submit_recommendation' + DOT));
    sub.appendChild(el('b', null, 'recorded by you'));
    sub.appendChild(document.createTextNode(DOT + (committed.manuscript_id || '')
      + DOT + clockOf(committed.at || committed.committed_at)));
    return;
  }

  clear(say);
  say.appendChild(document.createTextNode('It can recommend. Only you can decide.'));
  clear(sub);
  sub.appendChild(document.createTextNode('submit_recommendation' + DOT));
  sub.appendChild(el('b', null, 'REQUIRES_HUMAN'));
  sub.appendChild(document.createTextNode(
    DOT + (ui.selectedId
      ? 'the final call is not a tool the assistant can call'
      : 'select a manuscript to record a recommendation')));
  void handlers;
}

/**
 * verdict.blockedNotice — ASSERTIVE 2 of 2. Written only on a fresh refusal, so
 * it announces the event rather than re-announcing the count on every render.
 */
export function renderVerdictBlocked(node, detail) {
  const isCommitRefusal = detail
    && detail.outcome === 'refused'
    && detail.name === 'submit_recommendation';
  if (!isCommitRefusal) return;
  node.textContent = 'The assistant tried to file the recommendation and the page refused. '
    + 'That decision is yours.';
}

/** verdict.blockedChip — persistent count; the click filters the record. */
export function renderVerdictBlockedChip(node, state, handlers) {
  const n = refusalTallies(state).byCode.REQUIRES_HUMAN || 0;
  clear(node);
  node.hidden = n === 0;
  if (n === 0) return;
  const chip = el('button', 'chip-refusal');
  chip.type = 'button';
  chip.appendChild(stamp('Refused'));
  chip.appendChild(document.createTextNode(n + ' blocked attempt' + (n === 1 ? '' : 's')));
  chip.setAttribute('aria-label', n + ' blocked agent attempts to commit. Show them in the record.');
  chip.addEventListener('click', () => handlers.filterLedger('refused'));
  node.appendChild(chip);
  void ARROW;
}
