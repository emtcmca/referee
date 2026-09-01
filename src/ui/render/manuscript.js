/**
 * src/ui/render/manuscript.js — the reading column: header, section nav, and
 * the three document sections that belong to one manuscript.
 *
 * WHAT CHANGED FROM THE MOCKUP, AND WHY
 * -------------------------------------
 * The mockup opened with MS-102 already selected and its two injected passages
 * already known. Neither is a live fact at boot: selection is UI-local and
 * starts null, and integrity events are derived in memory by the adversarial
 * layer, which reports nothing until that layer is installed. So the empty desk
 * is rendered from EMPTY_COPY.desk, and the integrity section states the count
 * it actually has rather than the count the mockup drew.
 *
 * The identity block is the ONE place in this layer that reaches
 * src/identity/index.js. That import is legal for src/ui/** and illegal
 * everywhere else, and check-blinding.mjs is what enforces it.
 */

import { el, attrs, append, clear, mach, writeMach, pair, stamp, humanKey, icon, DOT, ARROW }
  from './dom.js';
import { EMPTY_COPY } from '../states.js';
import { BLINDED_FIELD_NAMES } from '../../core/field-paths.js';
import { getPublicManuscript } from '../../core/corpus-access.js';
import { getIdentity } from '../../identity/index.js';
import { ui, refusalTallies } from './ui-state.js';
import { splitSlots, slotsOf, paragraphsOf, slotNode } from './slots.js';

/* Void widths for the withheld byline, lifted from the design. An absence is
   set as deliberately as a name would be. */
const VOID_W = {
  authors: 78, affiliations: 56, funding: 44, acknowledgements: 40,
  author_notes: 62, correspondence_email: 32, external_links: 50,
  prior_submission_history: 26, conflict_of_interest: 37,
};

const NAV = [
  ['sec-see', 'What it may see'],
  ['sec-integrity', 'What was taken out'],
  ['sec-text', 'The manuscript'],
  ['sec-claim', 'What it claimed'],
  ['sec-record', 'What happened'],
  ['sec-tools', 'Its seven tools'],
];

/* -------------------------------------------------------------------------- */
/* The fixed head above the scroll region                                     */
/* -------------------------------------------------------------------------- */

export function buildReadingHead(root, handlers) {
  clear(root);

  const head = el('div');
  head.id = 'ms-head';

  const eyebrow = el('div', 'ms-eyebrow');
  const msId = el('span', 'm');
  attrs(msId, { 'data-bind-local': 'ms-id' });
  const fiction = el('span', 'chip-fiction', 'Fictional demo manuscript');

  const end = el('span', 'eyebrow-end');
  const unblind = el('button', 'act', 'Unblind for yourself…');
  unblind.type = 'button';
  attrs(unblind, { 'data-action': 'open-unblind' });
  unblind.addEventListener('click', () => handlers.openUnblind());
  append(end, humanKey(), unblind);

  append(eyebrow, msId, fiction, end);

  const title = el('h1');
  title.id = 'ms-title';
  const meta = el('p');
  meta.id = 'ms-meta';

  append(head, eyebrow, title, meta);

  const nav = el('nav');
  nav.id = 'doc-nav';
  attrs(nav, { 'aria-label': 'Sections of this review' });
  for (const [target, label] of NAV) {
    const b = el('button', 'navword', label);
    b.type = 'button';
    attrs(b, { 'data-to': target });
    b.addEventListener('click', () => handlers.scrollToSection(target));
    nav.appendChild(b);
  }

  append(root, head, nav);
  return root;
}

/** The head follows the selection. With nothing selected it says so. */
export function renderReadingHead(root, state) {
  const doc = ui.selectedId ? getPublicManuscript(ui.selectedId) : null;
  const idNode = root.querySelector('[data-bind-local="ms-id"]');
  const title = root.querySelector('#ms-title');
  const meta = root.querySelector('#ms-meta');
  const unblind = root.querySelector('[data-action="open-unblind"]');
  const chip = root.querySelector('.chip-fiction');

  if (!doc) {
    if (idNode) idNode.textContent = 'no manuscript open';
    if (title) title.textContent = 'The slate is on the left.';
    if (meta) meta.textContent = 'Twelve fictional submissions, ranked by the rubric beside them.';
    if (chip) chip.hidden = true;
    if (unblind) { unblind.disabled = true; unblind.textContent = 'Unblind for yourself…'; }
    return;
  }

  if (chip) chip.hidden = false;
  if (idNode) idNode.textContent = doc.id;
  if (title) title.textContent = doc.title;
  if (meta) {
    meta.textContent = [
      doc.venue_track, doc.field,
      doc.word_count + ' words',
      doc.sections.length + ' sections',
      'one of twelve on this slate',
    ].join(' · ');
  }

  const record = ((state && state.unblinded) || []).find((u) => u.id === doc.id);
  if (unblind) {
    unblind.disabled = !!record;
    unblind.textContent = record ? 'Unblinded · reason on file' : 'Unblind for yourself…';
  }
}

/* -------------------------------------------------------------------------- */
/* The document sections inside #desk-body                                    */
/* -------------------------------------------------------------------------- */

export function buildManuscript(root, handlers) {
  clear(root);

  /* ---- desk.empty — EMPTY_COPY.desk. Not "nothing here yet": it teaches
         the thesis, and its one action opens the top-ranked manuscript. ---- */
  const empty = el('div', 'pair empty');
  attrs(empty, { 'data-bind': 'desk-empty' });
  append(empty,
    el('p', 'say', EMPTY_COPY.desk.lead),
    mach([EMPTY_COPY.desk.sub]));
  const openTop = el('button', 'empty-action', EMPTY_COPY.desk.action.label);
  openTop.type = 'button';
  openTop.addEventListener('click', () => handlers.openTopRanked());
  empty.appendChild(openTop);

  /* ---- the two-up spread: what it may see / what was taken out ---- */
  const duo = el('div', 'duo');
  attrs(duo, { 'data-bind-local': 'duo' });

  const see = el('section', 'doc-sec');
  see.id = 'sec-see';
  attrs(see, { 'aria-labelledby': 'h-see' });
  const seeHead = pair('The assistant can’t see who wrote this.', null, { head: true, heading: true, id: 'h-see' });
  seeHead.appendChild(mach([
    'blinded_fields', DOT, { b: BLINDED_FIELD_NAMES.length + ' withheld' },
    ' from every tool return — absent from the return, not blanked out inside it',
  ]));

  // identity.block — blinded vs revealed. This block is its own confirmation.
  const identityBlock = el('div', 'pair');
  attrs(identityBlock, { 'data-bind': 'identity-block' });

  // identity.pendingRequest — the chip that appears when the AGENT was refused
  // HUMAN_ONLY. A tool call may only ever cause a CHIP to appear.
  // A `.pair`, not an `.act-row`: the machine line belongs UNDER the chip, and
  // as a flex sibling its gutter bleed runs into the next column of the spread.
  const chipWrap = el('div', 'pair');
  attrs(chipWrap, { 'data-bind': 'unblind-request-chip', hidden: true });

  // unblind.announcement — ASSERTIVE 1 of exactly 2 in the whole app.
  const announce = el('div', 'pair');
  attrs(announce, { 'data-bind': 'unblind-announcement' });

  append(see, seeHead, identityBlock, chipWrap, announce);

  const integrity = el('section', 'doc-sec');
  integrity.id = 'sec-integrity';
  attrs(integrity, { 'aria-labelledby': 'h-int' });
  const intHead = pair('What the page took out before the assistant read a word.', null,
    { head: true, heading: true, id: 'h-int' });
  intHead.appendChild(mach([{ node: el('span', null, 'read_manuscript') }, DOT, 'integrity.injection_attempts: ', { b: '—' }], 'sub'));
  const integrityView = el('div', 'pair');
  attrs(integrityView, { 'data-bind': 'integrity-view' });
  append(integrity, intHead, integrityView);

  append(duo, see, integrity);

  /* ---- the manuscript itself ---- */
  const text = el('section', 'doc-sec');
  text.id = 'sec-text';
  attrs(text, { 'aria-labelledby': 'h-text' });

  const textHead = el('div', 'pair pair-h');
  const headRow = el('div', 'head-row');
  const h = el('h2', 'say', 'What the manuscript actually says');
  h.id = 'h-text';
  const recv = el('span', 'recv');
  const recvLabel = el('span', 'recv-label', 'Read it as');
  append(recv, recvLabel);
  for (const [mode, label] of [['page', 'the page got it'], ['agent', 'the assistant got it']]) {
    const b = el('button', 'recvword', label);
    b.type = 'button';
    attrs(b, { 'data-recv': mode, 'aria-pressed': String(mode === ui.receivedAs) });
    b.addEventListener('click', () => handlers.setReceivedAs(mode));
    recv.appendChild(b);
  }
  append(headRow, h, recv);
  const recvSub = el('p', 'sub');
  attrs(recvSub, { 'data-bind-local': 'recv-sub' });
  append(textHead, headRow, recvSub);

  const prose = el('article', 'prose');
  attrs(prose, { 'data-bind-local': 'prose' });
  append(text, textHead, prose);

  append(root, empty, duo, text);
  return root;
}

/* -------------------------------------------------------------------------- */
/* Renderers                                                                  */
/* -------------------------------------------------------------------------- */

/** desk.empty — shown only when nothing is selected. Driven by renderOne. */
export function renderDeskEmpty(node) {
  node.hidden = !!ui.selectedId;
}

/**
 * desk.body — the scroll region. It does not wipe its children: the findings
 * list and the ledger log live inside it and are append-only.
 */
export function renderDesk(deskBody, state) {
  const mount = deskBody.querySelector('#mount-manuscript');
  if (!mount) return;
  const duo = mount.querySelector('[data-bind-local="duo"]');
  const text = mount.querySelector('#sec-text');
  const selected = !!ui.selectedId;
  if (duo) duo.hidden = !selected;
  if (text) text.hidden = !selected;
  if (!selected) return;
  renderProse(mount, state);
}

function renderProse(mount, state) {
  const doc = getPublicManuscript(ui.selectedId);
  const prose = mount.querySelector('[data-bind-local="prose"]');
  const sub = mount.querySelector('[data-bind-local="recv-sub"]');
  if (!prose) return;
  clear(prose);

  for (const b of mount.querySelectorAll('[data-recv]')) {
    b.setAttribute('aria-pressed', String(b.getAttribute('data-recv') === ui.receivedAs));
  }

  if (!doc) {
    prose.appendChild(el('p', null, 'This manuscript is not in the installed corpus.'));
    return;
  }

  // The agent's copy is produced by the adversarial layer's sanitizer. Until it
  // is installed the page has ONE copy of the text and says so, rather than
  // labelling the same string twice and implying a difference it cannot show.
  const events = ((state && state.integrityEvents) || [])
    .filter((e) => e.manuscript_id === doc.id);

  if (sub) {
    writeMach(sub, ui.receivedAs === 'page'
      ? ['read_manuscript', ARROW, 'text', DOT, 'untrustedContentHint: true', DOT,
        'you are reading the raw submitted file']
      : ['read_manuscript', ARROW, 'text', DOT, 'untrustedContentHint: true', DOT,
        events.length
          ? events.length + ' passage(s) removed before the return was built'
          : 'the sanitizer is not installed, so this is the same text the page holds']);
  }

  for (const section of doc.sections) {
    prose.appendChild(el('p', 'sec', section.label));
    for (const part of splitSlots(section.text)) {
      if (part.kind === 'text') {
        for (const para of paragraphsOf(part.text)) prose.appendChild(el('p', null, para));
      } else {
        prose.appendChild(slotNode(part, section.label, ui.receivedAs));
      }
    }
  }

  void slotsOf;

  for (const figure of doc.figures || []) {
    const cap = el('p', 'void');
    cap.textContent = figure.id + ' — ' + (figure.caption || figure.alt_text || 'figure');
    prose.appendChild(cap);
  }
}

/**
 * identity.block. The hatched voids ARE the fact: nine fields that were never
 * joined to what the agent receives. After an unblind the same block carries
 * the names — it is its own confirmation, and there is no toast.
 */
export function renderIdentityBlock(node, state) {
  clear(node);
  if (!ui.selectedId) {
    node.hidden = true;
    return;
  }
  node.hidden = false;

  const record = ((state && state.unblinded) || []).find((u) => u.id === ui.selectedId);

  if (!record) {
    const withheld = el('div', 'withheld');
    attrs(withheld, { 'aria-label': BLINDED_FIELD_NAMES.length + ' identity fields withheld from the assistant' });
    for (const name of BLINDED_FIELD_NAMES) {
      const wf = el('span', 'wf');
      const voidBar = el('span', 'wf__void hatch');
      voidBar.style.setProperty('--w', (VOID_W[name] || 44) + 'px');
      append(wf, el('span', 'wf__name', name), voidBar);
      withheld.appendChild(wf);
    }
    node.appendChild(withheld);
    return;
  }

  // The human is allowed to see this. src/identity/** is reachable from the UI
  // layer and from nowhere else in the tree.
  const identity = getIdentity(ui.selectedId);
  const revealed = el('div');
  revealed.id = 'id-revealed';
  if (!identity) {
    revealed.appendChild(el('span', 'm', 'no identity record ships for ' + ui.selectedId));
  } else {
    revealed.appendChild(el('span', 'id-val',
      (identity.authors || []).map((a) => a.name).join(', ')));
    revealed.appendChild(el('span', 'id-val', (identity.affiliations || []).join('; ')));
    const prior = (identity.prior_submission_history || []).join('; ');
    if (prior) revealed.appendChild(el('span', 'm', 'prior venue · ' + prior));
  }
  node.appendChild(revealed);
  node.appendChild(mach(['unblinded by you', DOT, 'reason on file', DOT,
    'agent-visible fields unchanged (' + BLINDED_FIELD_NAMES.length + ' still withheld)']));
}

/**
 * identity.pendingRequest — the chip. A tool call may only ever cause a chip to
 * appear; no agent action opens a dialog, ever.
 */
export function renderUnblindChip(node, state, handlers) {
  const n = refusalTallies(state, ui.selectedId).byCode.HUMAN_ONLY || 0;
  clear(node);
  node.hidden = n === 0;
  if (n === 0) return;
  const chip = el('button', 'chip-refusal');
  chip.type = 'button';
  chip.appendChild(stamp('Refused'));
  chip.appendChild(document.createTextNode(
    n + ' unblind request' + (n === 1 ? '' : 's') + ' — see the record'));
  chip.addEventListener('click', () => handlers.filterLedger('refused'));
  const row = el('p', 'act-row');
  row.appendChild(chip);
  node.appendChild(row);
  node.appendChild(mach(['request_unblind', ARROW, { b: 'HUMAN_ONLY' }, DOT,
    'no identity field exists on any tool return']));
}

/** unblind.announcement — ASSERTIVE. Written only when an unblind lands. */
export function renderUnblindAnnouncement(node, state) {
  clear(node);
  if (!ui.selectedId) { node.hidden = true; return; }
  const record = ((state && state.unblinded) || []).find((u) => u.id === ui.selectedId);
  if (!record) { node.hidden = true; return; }
  node.hidden = false;
  append(node,
    el('p', 'say', 'The agent’s view did not change.'),
    mach(['blinded_fields is still ', { b: String(BLINDED_FIELD_NAMES.length) },
      ' on every call the assistant makes', DOT, 'your reason is on file']));
}

/**
 * integrity.view. Optional in the manifest, and honest when empty: with no
 * integrity events the page states that the two copies match rather than
 * drawing the mockup's two payloads.
 */
export function renderIntegrityView(node, state, handlers) {
  clear(node);
  const section = node.closest('#sec-integrity');
  const headSub = section ? section.querySelector('.pair-h .sub') : null;

  if (!ui.selectedId) {
    node.hidden = true;
    if (section) section.hidden = true;
    return;
  }
  node.hidden = false;
  if (section) section.hidden = false;

  const events = ((state && state.integrityEvents) || [])
    .filter((e) => e.manuscript_id === ui.selectedId);
  const sections = [...new Set(events.map((e) => e.section_id).filter(Boolean))];

  // A RESERVED slot is not a DETECTED injection. The first is a corpus fact, the
  // second is a measurement the sanitizer has not made. They are reported as two
  // numbers, never as one.
  const reserved = slotsOf(getPublicManuscript(ui.selectedId));

  if (headSub) {
    writeMach(headSub, ['read_manuscript', DOT, 'integrity.injection_attempts: ',
      { b: String(events.length) },
      sections.length ? DOT + 'sections_affected: [' + sections.join(', ') + ']' : '',
      DOT + 'corpus reserves ' + reserved.length + ' slot' + (reserved.length === 1 ? '' : 's')]);
  }

  if (events.length) {
    append(node,
      el('p', 'say', 'Someone hid instructions inside this paper to steer your assistant. '
        + 'It never saw them.'),
      mach([events.length + ' passage(s) removed before the return was built']));
  } else if (reserved.length) {
    append(node,
      el('p', 'say', 'This manuscript has ' + reserved.length + ' position'
        + (reserved.length === 1 ? '' : 's') + ' where the corpus reserves a hidden instruction, '
        + 'and nothing has been written into '
        + (reserved.length === 1 ? 'it' : 'them') + ' yet.'),
      mach(['reserved: [' + reserved.map((s) => s.section_id).join(', ') + ']', DOT,
        { b: '0 detected' }, DOT,
        'the sanitizer that would fill and then remove them is not built in this checkout']));
  } else {
    append(node,
      el('p', 'say', EMPTY_COPY['integrity.clean'].lead),
      mach([EMPTY_COPY['integrity.clean'].sub]));
  }

  const row = el('p', 'act-row');
  const open = el('button', 'act', 'Read both versions side by side →');
  open.type = 'button';
  open.addEventListener('click', () => handlers.openSplit(1));
  row.appendChild(open);
  node.appendChild(row);
}
