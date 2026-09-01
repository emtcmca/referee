/**
 * src/ui/render/ledger.js — the record. Every event, in order, in two registers.
 *
 * APPEND-ONLY, LITERALLY. renderLedger never rebuilds the list; it walks
 * state.ledger and appends the rows it has not appended before, keyed by seq.
 * A blanket re-render would destroy the reviewer's scroll position in a log
 * that is the whole point of the page.
 *
 * ACCESSIBILITY SHAPE (05 §9.4): the two visible lines are aria-hidden and the
 * row carries ONE flat sentence for a screen reader — row.sr, produced by
 * activity.toRow. A log that reads out a plain sentence AND a machine record
 * for every event is unusable at speed.
 *
 * A REFUSAL IS NOT AN ERROR. It gets the stamp and the accent margin bar; it
 * never gets error vocabulary, an alert role, or the notice band.
 */

import { el, attrs, append, clear, mach, srOnly, icon, clockOf, DOT, ARROW } from './dom.js';
import { toRow } from '../activity.js';
import { EMPTY_COPY } from '../states.js';
import { ui } from './ui-state.js';

const FILTERS = [
  ['all', 'All'],
  ['agent', 'Assistant'],
  ['human', 'You'],
  ['refused', 'Refused'],
];

export function buildLedger(root, handlers) {
  clear(root);

  const section = el('section', 'doc-sec');
  section.id = 'sec-record';
  attrs(section, { 'aria-labelledby': 'h-record' });

  const head = el('div', 'pair pair-h');
  const h = el('h2', 'say', 'Everything that happened, in order');
  h.id = 'h-record';
  const headSub = el('p', 'sub');
  attrs(headSub, { 'data-bind-local': 'ledger-summary' });
  append(head, h, headSub);

  const filters = el('div', 'filters');
  attrs(filters, { role: 'group', 'aria-label': 'Filter the record' });
  for (const [token, label] of FILTERS) {
    const b = el('button', 'filt' + (token === 'refused' ? ' is-ref' : ''));
    b.type = 'button';
    b.value = token;
    // ledger.filter — the manifest reads the control's VALUE as the token.
    attrs(b, { 'data-action': 'filter-ledger', 'aria-pressed': String(token === ui.ledgerFilter) });
    b.appendChild(document.createTextNode(label));
    b.appendChild(el('span', 'count', ''));
    b.addEventListener('click', () => handlers.filterLedger(token));
    filters.appendChild(b);
  }

  // ledger.copy — AC-24. Must report the manual-select fallback honestly rather
  // than showing "Copied" over a copy that did not happen.
  const copy = el('button', null, 'Copy the record');
  copy.type = 'button';
  attrs(copy, { 'data-action': 'copy-ledger' });
  copy.addEventListener('click', () => handlers.copyLedger(copy));
  filters.appendChild(copy);

  const copyNote = el('p', 'm copy-note');
  attrs(copyNote, { 'data-bind-local': 'copy-note', role: 'status', 'aria-live': 'polite' });
  filters.appendChild(copyNote);

  // ledger.empty — EMPTY_COPY.ledger. Teaches the thesis; never "nothing yet".
  const empty = el('div', 'pair empty');
  attrs(empty, { 'data-bind': 'ledger-empty' });
  append(empty, el('p', 'say', EMPTY_COPY.ledger.lead), mach([EMPTY_COPY.ledger.sub]));

  // ledger.log — role/aria-live/aria-relevant/tabindex are applied by the
  // binder's aria contract, so they cannot be lost when a design is swapped.
  const log = el('div');
  log.id = 'ledger-log';
  attrs(log, { 'aria-label': 'Event record' });

  append(section, head, filters, empty, log);
  append(root, section);
  return root;
}

function glyphFor(actor) {
  const wrap = el('span', 'ev__g');
  wrap.appendChild(icon(actor === 'human' ? 'i-sq' : 'i-dia', '0 0 10 10'));
  return wrap;
}

/** One event, as the design's two-line block plus its single spoken sentence. */
function eventNode(entry) {
  const row = toRow(entry);
  const node = el('div', 'ev' + (row.refused ? ' is-refused' : ''));
  attrs(node, {
    'data-actor': row.actor,
    'data-outcome': row.refused ? 'refused' : 'ok',
    'data-seq': row.seq,
  });

  node.appendChild(glyphFor(row.actor));

  // ONE sentence for a screen reader; the visible pair is hidden from it.
  node.appendChild(srOnly(row.sr));

  const say = el('p', 'say');
  attrs(say, { 'aria-hidden': 'true' });
  if (row.refused) say.appendChild(el('span', 'stamp', 'Refused by the page'));
  say.appendChild(document.createTextNode(row.plain));
  node.appendChild(say);

  const parts = [row.action, ARROW];
  if (row.refused) parts.push({ b: row.code });
  else parts.push('ok');
  if (row.manuscriptId) parts.push(DOT + row.manuscriptId);
  if (row.visibleFields.length) parts.push(DOT + 'visible: ' + row.visibleFields.length + ' field paths');
  if (row.ts) parts.push(DOT + clockOf(row.ts));
  const sub = mach(parts);
  attrs(sub, { 'aria-hidden': 'true' });
  node.appendChild(sub);

  return node;
}

function matchesFilter(node, token) {
  if (token === 'all') return true;
  if (token === 'refused') return node.getAttribute('data-outcome') === 'refused';
  return node.getAttribute('data-actor') === token;
}

/** ledger.log — appends only. */
export function renderLedgerLog(log, state) {
  const entries = (state && Array.isArray(state.ledger)) ? state.ledger : [];
  for (const entry of entries) {
    if (ui.renderedSeq.has(entry.seq)) continue;
    ui.renderedSeq.add(entry.seq);
    const node = eventNode(entry);
    node.hidden = !matchesFilter(node, ui.ledgerFilter);
    log.appendChild(node);
  }
  // A fresh log after a reset: drop rows whose seq no longer exists.
  const live = new Set(entries.map((e) => e.seq));
  for (const node of Array.from(log.children)) {
    const seq = Number(node.getAttribute('data-seq'));
    if (!live.has(seq)) {
      ui.renderedSeq.delete(seq);
      node.remove();
    }
  }
  updateSummary(log, state);
}

function updateSummary(log, state) {
  const section = log.closest('#sec-record');
  if (!section) return;
  const entries = (state && Array.isArray(state.ledger)) ? state.ledger : [];
  const refused = entries.filter((e) => e.outcome === 'refused').length;
  const agent = entries.filter((e) => e.actor === 'agent').length;

  const summary = section.querySelector('[data-bind-local="ledger-summary"]');
  if (summary) {
    clear(summary);
    summary.appendChild(document.createTextNode('session.ledger[]' + DOT + entries.length
      + ' entries' + DOT + agent + ' by the assistant, ' + (entries.length - agent) + ' by you' + DOT));
    summary.appendChild(el('b', null, refused + ' refused'));
  }

  const counts = {
    all: entries.length, agent, human: entries.length - agent, refused,
  };
  for (const b of section.querySelectorAll('[data-action="filter-ledger"]')) {
    const span = b.querySelector('.count');
    if (span) span.textContent = ' ' + (counts[b.value] ?? 0);
    b.setAttribute('aria-pressed', String(b.value === ui.ledgerFilter));
  }
}

/** ledger.empty — visible only while the log is genuinely empty. */
export function renderLedgerEmpty(node, state) {
  const entries = (state && Array.isArray(state.ledger)) ? state.ledger : [];
  node.hidden = entries.length > 0;
}

/** ledger.filter — re-applies the current token to rows already in the log. */
export function renderLedgerFilter(node, state) {
  const section = node.closest('#sec-record');
  if (!section) return;
  const log = section.querySelector('#ledger-log');
  if (log) {
    for (const row of log.children) row.hidden = !matchesFilter(row, ui.ledgerFilter);
  }
  updateSummary(log || section, state);
}

/** ledger.copy — the control. Its label swap is owned by the host. */
export function renderLedgerCopy(node) {
  if (!node.textContent.trim()) node.textContent = 'Copy the record';
}
