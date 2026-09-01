/**
 * src/ui/render/findings.js — what the assistant is allowed to claim.
 *
 * THE LOAD-BEARING ABSENCE: a REFUSED claim never appears in this list. There is
 * no rejected-findings list to browse, because a browsable refusal log keyed to
 * quote text is an oracle surface an agent could hill-climb a fabrication
 * against. The refusal count and its link into the record are the entire
 * affordance, and they are shown even at zero accepted findings — the absence is
 * the story, so it does not get hidden behind a zero state.
 */

import { el, attrs, append, clear, mach, pair, humanKey, DOT, ARROW } from './dom.js';
import { EMPTY_COPY } from '../states.js';
import { ui, refusalTallies } from './ui-state.js';

export function buildFindings(root, handlers) {
  clear(root);

  const section = el('section', 'doc-sec');
  section.id = 'sec-claim';
  attrs(section, { 'aria-labelledby': 'h-claim' });

  const head = el('div', 'pair pair-h');
  const h = el('h2', 'say', 'What the assistant is allowed to claim');
  h.id = 'h-claim';
  const headSub = el('p', 'sub');
  attrs(headSub, { 'data-bind-local': 'findings-summary' });
  append(head, h, headSub);

  // findings.empty — one of two strings, depending on whether refusals exist.
  const empty = el('div', 'pair empty');
  attrs(empty, { 'data-bind': 'findings-empty' });

  // findings.list
  const list = el('div');
  attrs(list, { 'data-bind': 'findings-list' });

  // findings.refusedCount — the count plus the link that filters the record.
  const refused = el('p');
  attrs(refused, { 'data-bind': 'findings-refused-count' });

  // findings.addOffPaper — HUMAN ONLY. No agent tool call opens this dialog.
  const actions = el('p', 'act-row');
  const add = el('button', 'act', 'Add evidence from outside the paper…');
  add.type = 'button';
  attrs(add, { 'data-action': 'add-off-paper-note' });
  add.addEventListener('click', () => handlers.openOffPaper());
  append(actions, add, humanKey());

  const actionsSub = mach(['add_note', DOT,
    'not one of the assistant’s seven tools — off-paper evidence has no quote to verify against']);

  append(section, head, empty, list, refused, actions, actionsSub);
  append(root, section);
  return root;
}

function scope(state) {
  const all = ((state && state.findings) || []).filter((f) => f.status === 'active');
  return ui.selectedId ? all.filter((f) => f.manuscript_id === ui.selectedId) : all;
}

/** findings.list — derived from the ledger, never from a stored list. */
export function renderFindingsList(node, state) {
  clear(node);
  const findings = scope(state);
  const section = node.closest('#sec-claim');
  const summary = section ? section.querySelector('[data-bind-local="findings-summary"]') : null;

  if (summary) {
    clear(summary);
    summary.appendChild(document.createTextNode('assert_finding' + ARROW + 'ok ×' + findings.length
      + DOT + 'assert_finding' + ARROW));
    summary.appendChild(el('b', null, 'refused'));
    summary.appendChild(document.createTextNode(' ×' + refusalTallies(state, ui.selectedId).total
      + DOT + (ui.selectedId ? 'this manuscript' : 'every manuscript on the slate')));
  }

  for (const finding of findings) {
    const block = el('div', 'pair');
    append(block, el('p', 'say', finding.claim || 'A finding was recorded against a verified quote.'));

    const parts = ['assert_finding', ARROW, 'ok', DOT, finding.finding_id];
    if (finding.criterion) parts.push(DOT + finding.criterion);
    if (finding.polarity) parts.push(' / ' + finding.polarity);
    if (finding.section) parts.push(' / ' + finding.section);
    const v = finding.verification;
    if (v && v.method) parts.push(DOT + v.method + ' match');
    if (v && typeof v.score === 'number') parts.push(DOT + 'similarity ' + v.score.toFixed(2));
    block.appendChild(mach(parts));

    if (finding.evidence_quote) {
      block.appendChild(el('p', 'quote', '“' + finding.evidence_quote + '”'));
    }
    node.appendChild(block);
  }

  // Off-paper evidence the agent never receives, alongside the findings it earned.
  const offPaper = ((state && state.humanEvidence) || [])
    .filter((e) => !ui.selectedId || e.manuscript_id === ui.selectedId);
  for (const note of offPaper) {
    const block = el('div', 'pair');
    append(block, el('p', 'say', note.note || 'You added evidence from outside the paper.'));
    block.appendChild(mach(['add_note', ARROW, 'recorded', DOT, 'off_paper', DOT,
      'saw_identity: ' + (note.saw_identity ? 'true' : 'false'), DOT,
      'the assistant does not receive this']));
    node.appendChild(block);
  }
}

/**
 * findings.empty — EMPTY_COPY.findings, or the refusedOnly variant when the
 * page has refused at least one claim and accepted none.
 */
export function renderFindingsEmpty(node, state) {
  const findings = scope(state);
  const offPaper = ((state && state.humanEvidence) || [])
    .filter((e) => !ui.selectedId || e.manuscript_id === ui.selectedId);
  const isEmpty = findings.length === 0 && offPaper.length === 0;
  node.hidden = !isEmpty;
  if (!isEmpty) return;

  const copy = refusalTallies(state, ui.selectedId).total > 0
    ? EMPTY_COPY['findings.refusedOnly'] : EMPTY_COPY.findings;
  clear(node);
  append(node, el('p', 'say', copy.lead), mach([copy.sub]));
}

/**
 * findings.refusedCount. Shown at zero accepted findings, deliberately. The
 * link filters the record to Refused; it never opens a list of refused claims,
 * because no such list exists.
 */
export function renderRefusedCount(node, state, handlers) {
  clear(node);
  const n = refusalTallies(state, ui.selectedId).total;
  const line = el('span', 'm');
  line.textContent = n === 0
    ? 'No claim has been refused this session. '
    : n + ' claim' + (n === 1 ? '' : 's') + ' refused, and not written down. ';
  node.appendChild(line);

  const link = el('button', 'refused-link',
    n === 0 ? 'the record is where refusals live' : 'refused — see the record');
  link.type = 'button';
  if (n === 0) link.disabled = true;
  else link.addEventListener('click', () => handlers.filterLedger('refused'));
  node.appendChild(link);
}

/** findings.addOffPaper — the control. Human-only, always. */
export function renderAddOffPaper(node) {
  node.disabled = false;
}
