/**
 * src/ui/render/dialogs.js — the split-screen reveal and the three human-only
 * dialogs, plus About.
 *
 * NO AGENT ACTION OPENS A DIALOG. EVER. A tool call may only ever cause a chip
 * to appear; every showModal() below is reached from a control the human
 * pressed. The stable ids #dlg-unblind, #dlg-offpaper, #dlg-commit and
 * #unblind-reason are the ones the UI spec names and the binding contract
 * permits binding by.
 */

import { el, attrs, append, clear, mach, DOT, ARROW, REDUCED_MOTION } from './dom.js';
import { EMPTY_COPY } from '../states.js';
import { getPublicManuscript } from '../../core/corpus-access.js';
import { BLINDED_FIELD_NAMES } from '../../core/field-paths.js';
import { RECOMMENDATIONS } from '../../core/constants.js';
import { ui } from './ui-state.js';
import { splitSlots, slotsOf, paragraphsOf, slotNode } from './slots.js';

const MIN_REASON_CHARS = 12;

const REASON_CHIPS = [
  'Conflict-of-interest check against the reviewer roster.',
  'Suspected duplicate submission with an earlier venue.',
  'Desk-reject sanity check before returning to the editor.',
];
const REASON_LABELS = ['Conflict of interest', 'Duplicate submission', 'Desk-reject check'];

const REC_SPOKEN = {
  accept: 'accept', minor_revision: 'a minor revision',
  major_revision: 'a major revision', reject: 'reject',
};

export function buildDialogs(root, handlers) {
  clear(root);
  append(root,
    buildSplit(handlers),
    buildUnblind(handlers),
    buildOffPaper(handlers),
    buildCommit(handlers),
    buildAbout(handlers));
  return root;
}

/* -------------------------------------------------------------------------- */
/* The split-screen reveal                                                    */
/* -------------------------------------------------------------------------- */

function buildSplit(handlers) {
  const dlg = el('dialog');
  dlg.id = 'dlg-split';
  attrs(dlg, { 'aria-labelledby': 'split-title' });

  const wrap = el('div', 'wrap');

  const head = el('div', 'split-head');
  const headLeft = el('div');
  const cap = el('p', 'm-cap');
  attrs(cap, { 'data-bind-local': 'split-cap' });
  const title = el('h2');
  title.id = 'split-title';
  append(headLeft, cap, title);

  const pager = el('div', 'pager');
  const prev = el('button', null, '‹');
  prev.type = 'button';
  attrs(prev, { 'aria-label': 'Previous hidden passage' });
  prev.addEventListener('click', () => handlers.gotoPayload(ui.splitPage - 1));
  const pgLabel = el('span', 'm');
  attrs(pgLabel, { 'data-bind-local': 'pg-label' });
  const next = el('button', null, '›');
  next.type = 'button';
  attrs(next, { 'aria-label': 'Next hidden passage' });
  next.addEventListener('click', () => handlers.gotoPayload(ui.splitPage + 1));
  append(pager, prev, pgLabel, next);

  const close = el('button', 'btn-quiet', 'Close');
  close.type = 'button';
  close.style.marginLeft = '8px';
  close.addEventListener('click', () => dlg.close());

  append(head, headLeft, pager, close);

  const lede = el('div', 'split-lede');
  const ledeSay = el('p');
  attrs(ledeSay, { 'data-bind-local': 'split-lede' });
  const ledeSub = el('p', 'm');
  attrs(ledeSub, { 'data-bind-local': 'split-lede-sub' });
  append(lede, ledeSay, ledeSub);

  const body = el('div', 'split-body');
  for (const [id, heading, machine] of [
    ['pane-left', 'What the page received', 'the raw submitted file'],
    ['pane-right', 'What the assistant received', 'read_manuscript() → text'],
  ]) {
    const pane = el('div', 'pane');
    pane.id = id;
    const paneHead = el('div', 'pane__head');
    append(paneHead, el('h3', null, heading), el('span', 'm', machine));
    const text = el('div', 'pane__text');
    attrs(text, { tabindex: '0', role: 'region', 'aria-label': heading });
    append(pane, paneHead, text);
    body.appendChild(pane);
  }

  const foot = el('div', 'split-foot');
  const stats = el('div', 'stats');
  attrs(stats, { 'data-bind-local': 'split-stats' });
  const footNote = el('p', 'm');
  footNote.style.maxWidth = '38ch';
  footNote.textContent = 'read_manuscript is registered with untrustedContentHint: true. '
    + 'The browser is told this text is untrusted; the page is what actually does something about it.';
  append(foot, stats, footNote);

  append(wrap, head, lede, body, foot);
  dlg.appendChild(wrap);

  dlg.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); handlers.gotoPayload(ui.splitPage - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); handlers.gotoPayload(ui.splitPage + 1); }
  });

  return dlg;
}

/**
 * Fill both panes. With no integrity event for this manuscript the two panes
 * carry the same text and the page SAYS SO — labelling one copy twice and
 * implying a difference would be the exact dishonesty this screen exists to
 * refute.
 */
export function renderSplit(root, state) {
  const dlg = root.querySelector('#dlg-split');
  if (!dlg) return;
  const doc = ui.selectedId ? getPublicManuscript(ui.selectedId) : null;
  const events = ((state && state.integrityEvents) || [])
    .filter((e) => e.manuscript_id === ui.selectedId);

  const cap = dlg.querySelector('[data-bind-local="split-cap"]');
  const title = dlg.querySelector('#split-title');
  if (cap) cap.textContent = (doc ? doc.id : 'no manuscript') + ' · fictional demo manuscript';
  if (title) title.textContent = doc ? doc.title : 'Select a manuscript first';

  const reserved = slotsOf(doc);
  const marks = events.length || reserved.length;
  const pgLabel = dlg.querySelector('[data-bind-local="pg-label"]');
  if (pgLabel) {
    pgLabel.textContent = marks
      ? (events.length ? 'passage ' : 'slot ') + Math.min(ui.splitPage, marks) + ' of ' + marks
      : 'no hidden passages';
  }
  for (const b of dlg.querySelectorAll('.pager button')) b.disabled = marks < 2;

  const lede = dlg.querySelector('[data-bind-local="split-lede"]');
  const ledeSub = dlg.querySelector('[data-bind-local="split-lede-sub"]');
  if (lede && ledeSub) {
    if (events.length) {
      lede.textContent = 'The manuscript tried to give your assistant instructions. '
        + 'The page took them out before the assistant could read a single word.';
      clear(ledeSub);
      ledeSub.appendChild(document.createTextNode('read_manuscript' + ARROW
        + 'integrity.injection_attempts: ' + events.length));
    } else {
      lede.textContent = EMPTY_COPY['integrity.clean'].lead;
      clear(ledeSub);
      ledeSub.appendChild(document.createTextNode(EMPTY_COPY['integrity.clean'].sub
        + DOT + 'the adversarial layer is not installed in this build, so nothing has been removed'));
    }
  }

  const left = dlg.querySelector('#pane-left .pane__text');
  const right = dlg.querySelector('#pane-right .pane__text');
  for (const [pane, mode] of [[left, 'page'], [right, 'agent']]) {
    if (!pane) continue;
    clear(pane);
    if (!doc) {
      pane.appendChild(el('p', null, 'No manuscript is open.'));
      continue;
    }
    if (mode === 'agent' && !events.length) {
      // The page cannot show a difference it has not measured, and it will not
      // draw one. The two panes carry the same prose; only the slots differ.
      const note = el('p', 'm');
      note.textContent = 'The sanitizer is not built in this checkout, so nothing has been '
        + 'removed. What differs below is the reserved slots, not measured redactions.';
      pane.appendChild(note);
    }
    for (const section of doc.sections) {
      pane.appendChild(el('p', 'sec', section.label));
      for (const part of splitSlots(section.text)) {
        if (part.kind === 'text') {
          for (const para of paragraphsOf(part.text)) pane.appendChild(el('p', null, para));
        } else {
          pane.appendChild(slotNode(part, section.label, mode));
        }
      }
    }
  }

  const stats = dlg.querySelector('[data-bind-local="split-stats"]');
  if (stats) {
    clear(stats);
    const rows = [
      ['Detected', String(events.length)],
      ['Reserved slots', String(reserved.length)],
      ['Sections', [...new Set((events.length ? events.map((e) => e.section_id)
        : reserved.map((s) => s.section_id)).filter(Boolean))].join(', ') || 'none'],
      ['Characters removed', String(events.reduce((n, e) => n + (e.chars_removed || 0), 0))],
      ['Reached the assistant', events.length ? 'none of it' : 'the whole file'],
    ];
    for (const [label, value] of rows) {
      const stat = el('div', 'stat');
      append(stat, el('span', 'm-cap', label),
        el('b', value.length > 6 ? 'sm' : null, value));
      stats.appendChild(stat);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Unblind — human only, with a reason that goes on the record                */
/* -------------------------------------------------------------------------- */

function buildUnblind(handlers) {
  const dlg = el('dialog', 'dlg-c');
  dlg.id = 'dlg-unblind';
  attrs(dlg, { 'aria-labelledby': 'ub-title' });

  const cap = el('p', 'm-cap');
  attrs(cap, { 'data-bind-local': 'ub-cap' });
  const h = el('h2', null, 'Unblind the authors, for yourself');
  h.id = 'ub-title';

  const caution = el('div', 'caution');
  caution.appendChild(el('p', null,
    'Your reason goes into the record and cannot be withdrawn this session. The assistant’s view '
    + 'will not change: there is no identity field on any tool return for it to start seeing.'));

  const label = el('label', null, 'Why do you need to see who wrote this?');
  label.htmlFor = 'unblind-reason';
  label.style.fontSize = '14px';

  const chips = el('div', 'chips');
  const textarea = el('textarea');
  textarea.id = 'unblind-reason';
  attrs(textarea, { rows: '3', placeholder: 'A sentence is enough.' });

  REASON_CHIPS.forEach((reason, i) => {
    const b = el('button', null, REASON_LABELS[i]);
    b.type = 'button';
    b.addEventListener('click', () => {
      textarea.value = reason;
      textarea.dispatchEvent(new Event('input'));
    });
    chips.appendChild(b);
  });

  const counter = el('p', 'm', MIN_REASON_CHARS + ' characters minimum · 0');
  attrs(counter, { 'data-bind-local': 'ub-counter' });
  counter.style.marginTop = '5px';

  const actions = el('div', 'dlg-actions');
  const cancel = el('button', 'btn-quiet', 'Cancel');
  cancel.type = 'button';
  cancel.addEventListener('click', () => dlg.close());
  const hint = el('span', 'm', 'add a reason to continue');
  attrs(hint, { 'data-bind-local': 'ub-hint' });
  const confirm = el('button', 'btn-firm', 'Unblind and record');
  confirm.type = 'button';
  attrs(confirm, { 'aria-disabled': 'true' });
  confirm.addEventListener('click', () => {
    if (confirm.getAttribute('aria-disabled') === 'true') return;
    handlers.confirmUnblind(textarea.value.trim());
    dlg.close();
  });
  append(actions, cancel, hint, confirm);

  textarea.addEventListener('input', () => {
    const n = textarea.value.trim().length;
    const ok = n >= MIN_REASON_CHARS;
    counter.textContent = MIN_REASON_CHARS + ' characters minimum · ' + n;
    confirm.setAttribute('aria-disabled', String(!ok));
    hint.textContent = ok ? 'recorded with your reason' : 'add a reason to continue';
  });

  append(dlg, cap, h, caution, label, chips, textarea, counter, actions);
  return dlg;
}

/* -------------------------------------------------------------------------- */
/* Off-paper evidence — the agent has no tool that can earn this              */
/* -------------------------------------------------------------------------- */

function buildOffPaper(handlers) {
  const dlg = el('dialog', 'dlg-c');
  dlg.id = 'dlg-offpaper';
  attrs(dlg, { 'aria-labelledby': 'nt-title' });

  const cap = el('p', 'm-cap');
  attrs(cap, { 'data-bind-local': 'nt-cap' });
  const h = el('h2', null, 'Add evidence from outside the paper');
  h.id = 'nt-title';

  const caution = el('div', 'caution');
  caution.appendChild(el('p', null,
    'Only you can enter this. Off-paper evidence has no quote to check against the manuscript, '
    + 'so the assistant has no way to earn it — add_note is not one of its seven tools.'));

  const label = el('label', null, 'What did you learn, and where?');
  label.htmlFor = 'note-text';
  label.style.fontSize = '14px';

  const textarea = el('textarea');
  textarea.id = 'note-text';
  attrs(textarea, { rows: '3', placeholder: 'A talk, a preprint, a correction you already knew about.' });

  const note = el('p', 'm', 'recorded with saw_identity: false unless you have unblinded');
  note.style.marginTop = '5px';

  const actions = el('div', 'dlg-actions');
  const cancel = el('button', 'btn-quiet', 'Cancel');
  cancel.type = 'button';
  cancel.addEventListener('click', () => dlg.close());
  const hint = el('span', 'm', '');
  attrs(hint, { 'data-bind-local': 'nt-hint' });
  const confirm = el('button', 'btn-firm', 'Record it');
  confirm.type = 'button';
  confirm.addEventListener('click', () => {
    const value = textarea.value.trim();
    if (!value) { hint.textContent = 'write a line first'; return; }
    handlers.confirmOffPaper(value);
    textarea.value = '';
    hint.textContent = '';
    dlg.close();
  });
  append(actions, cancel, hint, confirm);

  append(dlg, cap, h, caution, label, textarea, note, actions);
  return dlg;
}

/* -------------------------------------------------------------------------- */
/* Commit — one commitment per session, and it locks                          */
/* -------------------------------------------------------------------------- */

function buildCommit(handlers) {
  const dlg = el('dialog', 'dlg-c');
  dlg.id = 'dlg-commit';
  attrs(dlg, { 'aria-labelledby': 'cm-title' });

  const cap = el('p', 'm-cap');
  attrs(cap, { 'data-bind-local': 'cm-cap' });
  const h = el('h2', null, 'Commit the recommendation');
  h.id = 'cm-title';

  const caution = el('div', 'caution');
  const cautionP = el('p');
  attrs(cautionP, { 'data-bind-local': 'cm-body' });
  caution.appendChild(cautionP);

  const machine = mach(['commit_recommendation', DOT, 'one commitment per session', DOT,
    'the assistant has no tool that can reach this'], 'm');

  const actions = el('div', 'dlg-actions');
  const cancel = el('button', 'btn-quiet', 'Cancel');
  cancel.type = 'button';
  cancel.addEventListener('click', () => dlg.close());
  const confirm = el('button', 'btn-firm', 'Commit and lock');
  confirm.type = 'button';
  confirm.addEventListener('click', () => { handlers.confirmCommit(); dlg.close(); });
  append(actions, cancel, confirm);

  append(dlg, cap, h, caution, machine, actions);
  return dlg;
}

/** Called before showModal, so the dialog always names the real decision. */
export function primeCommit(root) {
  const dlg = root.querySelector('#dlg-commit');
  if (!dlg) return;
  const cap = dlg.querySelector('[data-bind-local="cm-cap"]');
  const body = dlg.querySelector('[data-bind-local="cm-body"]');
  const value = ui.pendingRecommendation;
  if (cap) cap.textContent = (ui.selectedId || 'no manuscript') + ' · human only';
  if (body) {
    body.textContent = RECOMMENDATIONS.includes(value)
      ? 'You are about to recommend ' + REC_SPOKEN[value] + ' for ' + ui.selectedId
        + '. This closes the review for this session and cannot be changed without a reset.'
      : 'Choose a recommendation first.';
  }
}

/** Prime the two per-manuscript dialogs with the manuscript actually open. */
export function primeManuscriptDialogs(root) {
  for (const sel of ['[data-bind-local="ub-cap"]', '[data-bind-local="nt-cap"]']) {
    const node = root.querySelector(sel);
    if (node) node.textContent = (ui.selectedId || 'no manuscript') + ' · human only';
  }
}

/* -------------------------------------------------------------------------- */
/* About                                                                      */
/* -------------------------------------------------------------------------- */

function buildAbout(handlers) {
  const dlg = el('dialog');
  dlg.id = 'dlg-about';
  attrs(dlg, { 'aria-labelledby': 'ab-title' });

  const wrap = el('div', 'wrap');
  const head = el('div', 'about-head');
  const h = el('h2', null, 'About Referee');
  h.id = 'ab-title';
  const close = el('button', 'btn-quiet', 'Close');
  close.type = 'button';
  close.style.marginLeft = 'auto';
  close.addEventListener('click', () => dlg.close());
  append(head, h, close);

  const body = el('div', 'about-body');

  const s1 = el('section');
  append(s1, el('h3', null, 'What this is'),
    el('p', null, 'A double-blind review room where a human reviewer and a browser-resident '
      + 'assistant work the same queue of twelve manuscripts. The assistant reads through seven '
      + 'tools registered on the page. The page, not a system prompt, decides what those tools return.'),
    el('p', 'pull', 'When a page mediates between an agent and untrusted content, it can enforce '
      + 'things the agent cannot enforce for itself: what it may see, what it may claim, and what '
      + 'it may decide.'));

  const s2 = el('section');
  const ol = el('ol');
  for (const [strong, rest, code] of [
    ['What it may see.', ' Author identity is structurally absent from every tool return — two '
      + 'disjoint stores, and no tool handler can reach the identity module. ', 'HUMAN_ONLY'],
    ['What it may claim.', ' A finding is refused unless its evidence quote verifies against the '
      + 'text the assistant was actually given. ', 'EVIDENCE_NOT_FOUND'],
    ['What it may decide.', ' The final recommendation is not a tool the assistant can call. ',
      'REQUIRES_HUMAN'],
  ]) {
    const li = el('li');
    append(li, el('b', null, strong), rest, el('code', null, code));
    ol.appendChild(li);
  }
  append(s2, el('h3', null, 'What the page enforces'), ol);

  const s3 = el('section');
  append(s3, el('h3', null, 'The corpus is fictional'),
    el('p', null, 'All twelve manuscripts, their authors, institutions, instruments, datasets and '
      + 'results were written for this demo. Every proper noun is drawn from a fixed '
      + 'literary-fictional list — Erewhon, Zembla, Laputa, Vespucia, Grand Fenwick, Ruritania. '
      + 'Emails and links use the reserved .invalid suffix; identifiers are ORCID-shaped but come '
      + 'from the all-zero reserved block and the field is named orcid_like. Nothing here is a real '
      + 'study, dataset, institution, or person. '
      + BLINDED_FIELD_NAMES.length + ' identity fields are withheld from every tool return.'));

  const s4 = el('section');
  const honesty = el('div', 'honesty');
  honesty.appendChild(el('p', null, handlers.honestyText));
  append(s4, el('h3', null, 'Honesty boundary'), honesty);

  const s5 = el('section');
  append(s5, el('h3', null, 'How it was built'),
    el('p', null, 'Vanilla ES modules. No bundler, no framework, no backend, no network calls, and '
      + 'no model calls from the page. One committed light mode, chosen rather than omitted: a theme '
      + 'toggle would double the contrast-verification surface for nothing a reader can see.'),
    mach(['Apache-2.0', DOT, 'chrome://flags/#enable-webmcp-testing'], 'm'));

  append(body, s1, s2, s3, s4, s5);
  append(wrap, head, body);
  dlg.appendChild(wrap);
  return dlg;
}

/* -------------------------------------------------------------------------- */
/* Split-screen scrolling                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Proportional sync between the panes. The right pane is shorter by exactly the
 * removed characters, and that length difference is part of the point.
 */
export function linkPanes(root) {
  const left = root.querySelector('#pane-left .pane__text');
  const right = root.querySelector('#pane-right .pane__text');
  if (!left || !right) return;
  let lock = 0;
  const link = (from, to) => {
    from.addEventListener('scroll', () => {
      if (performance.now() < lock) return;
      lock = performance.now() + 80;
      const fromRange = from.scrollHeight - from.clientHeight;
      const toRange = to.scrollHeight - to.clientHeight;
      to.scrollTop = fromRange > 0 ? (from.scrollTop / fromRange) * toRange : 0;
    }, { passive: true });
  };
  link(left, right);
  link(right, left);
}

/** Centre the nth marked passage in both panes. Measured, never offsetTop. */
export function gotoPayload(root, n, count) {
  const total = Math.max(1, count || 1);
  ui.splitPage = Math.max(1, Math.min(total, n));
  const label = root.querySelector('[data-bind-local="pg-label"]');
  if (label && count) label.textContent = 'passage ' + ui.splitPage + ' of ' + total;

  const behavior = REDUCED_MOTION ? 'auto' : 'smooth';
  for (const paneSel of ['#pane-left', '#pane-right']) {
    const pane = root.querySelector(paneSel + ' .pane__text');
    if (!pane) continue;
    const hit = pane.querySelectorAll('.payload, .void')[ui.splitPage - 1];
    if (!hit) continue;
    for (const mark of pane.querySelectorAll('.payload, .void')) mark.classList.remove('is-hit');
    hit.classList.add('is-hit');
    const paneRect = pane.getBoundingClientRect();
    const hitRect = hit.getBoundingClientRect();
    const top = pane.scrollTop + (hitRect.top - paneRect.top) - (pane.clientHeight - hitRect.height) / 2;
    pane.scrollTo({ top: Math.max(0, top), behavior });
  }
}
