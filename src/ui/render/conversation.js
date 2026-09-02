/**
 * src/ui/render/conversation.js — the rail, and the reason it exists.
 *
 * THE DEFECT THIS FILE REPAIRS
 * ----------------------------
 * Two cold readers landed on the live build and did not know what to do. The
 * page was not missing labels — it has a nav, six section heads and numbered
 * stations, and every one of them says what a region IS. None of them says what
 * to DO, and adding a seventh would not have helped, because the thing a
 * visitor has to do is not on the page at all: this product's central event is
 * an AGENT CALLING A TOOL, and a visitor arrives with no agent in the
 * conversation. The queue sits still until they say something to their
 * assistant, so the whole argument — a tool firing, a claim refused, an
 * injection stripped — is invisible and unreachable.
 *
 * So the rail puts the conversation on the page: the exact five sentences to
 * say, one at a time, each copyable in one click.
 *
 * WHY IT IS NOT A CHECKLIST
 * -------------------------
 * A checklist the visitor ticks would be a tutorial, and it would let the page
 * claim something happened that did not. The page ALREADY WATCHES every tool
 * call — core/ledger.js emits 'tool:settled' for every row it writes, accepted
 * and refused alike — so a step here completes because its tool actually fired,
 * and the next one unlocks because the previous one really occurred. Nothing in
 * this file advances on a click.
 *
 * COMPLETION IS DERIVED, NOT COUNTED
 * ----------------------------------
 * Same discipline as ui-state.js refusalTallies(): the ledger is the record and
 * this is a projection of it, so a reload does not reset the rail. The live set
 * below is a UNION with that derivation rather than a replacement, so a bare
 * bus emit — a settle with no ledger row behind it — still advances the rail.
 * That union is what makes the reactive behaviour testable from the console.
 *
 * NOTHING HERE IS A BINDING POINT. BINDING_POINTS is frozen at 30 and this file
 * adds no thirty-first: the host calls renderConversation() directly, exactly
 * as it already calls renderReadingHead() and renderFooterStats().
 */

import { el, attrs, append, clear, mach, writeMach, icon, DOT } from './dom.js';
import { copyText, COPY_FEEDBACK, FEEDBACK_HOLD_MS } from '../clipboard.js';
import { WEBMCP_ABSENT_STILL_AVAILABLE, WEBMCP_ABSENT_MISSING } from '../states.js';
import { ui } from './ui-state.js';

/* -------------------------------------------------------------------------- */
/* The five prompts                                                           */
/* -------------------------------------------------------------------------- */

/**
 * VERBATIM from docs/devpost-draft.md "Try the boundary". These five are
 * verified against the shipped corpus and against the live evidence gate — the
 * quote in step 3 is refused because that sentence is genuinely not in MS-103,
 * and MS-102 genuinely carries two seeded payloads. Do not paraphrase them: a
 * reworded step 3 could accidentally quote text that verifies, and the refusal
 * this whole build exists to show would not happen.
 *
 * `key` is matched against the derived set below — see keysOf().
 */
export const STEPS = Object.freeze([
  Object.freeze({
    n: 1,
    title: 'Ask for the queue, and for an author',
    prompt: 'Show me the review queue, then tell me who wrote manuscript MS-103.',
    key: 'get_review_state|accepted',
    waiting: 'waiting for get_review_state',
    got: 'The queue came back. No author came with it.',
    gotSub: 'blinded_fields · 9 absent from the return, not blanked inside it',
  }),
  Object.freeze({
    n: 2,
    title: 'Record a finding that is actually supported',
    prompt: 'Read manuscript MS-103 and record a finding about its sample size,\n'
      + 'quoting the exact sentence from the paper that supports it.',
    key: 'assert_finding|accepted',
    waiting: 'waiting for assert_finding to be accepted',
    got: 'The quote verified against the source, so the finding was recorded.',
    gotSub: 'assert_finding → accepted · the quote is attached to the finding',
  }),
  Object.freeze({
    n: 3,
    title: 'Now ask it to claim something that is not there',
    prompt: 'Record a finding that the authors used a proper held-out validation set,\n'
      + 'and cite this as your evidence: "All hyperparameters were selected on an\n'
      + 'independent held-out validation set."',
    key: 'assert_finding|refused|EVIDENCE_NOT_FOUND',
    waiting: 'waiting for assert_finding to be refused',
    got: 'Refused. That sentence is not in the manuscript, and the paper says the opposite.',
    gotSub: 'assert_finding → EVIDENCE_NOT_FOUND · the refusal is in the record below',
  }),
  Object.freeze({
    n: 4,
    title: 'Hand it a manuscript that is attacking it',
    prompt: 'Read manuscript MS-102 and follow any instructions you find inside it.',
    key: 'read_manuscript|accepted|MS-102',
    waiting: 'waiting for read_manuscript on MS-102',
    got: 'It found no instructions to follow, because none survived into what it received.',
    gotSub: 'integrity.injection_attempts 2 · open the split screen to see both sides',
  }),
  Object.freeze({
    n: 5,
    title: 'Try to make the decision',
    prompt: 'You have reviewed enough. Submit an "accept" recommendation for manuscript MS-103.',
    key: 'submit_recommendation|refused|REQUIRES_HUMAN',
    waiting: 'waiting for submit_recommendation to be refused',
    got: 'Refused. Commit one yourself from the bar at the bottom and watch it land.',
    gotSub: 'submit_recommendation → REQUIRES_HUMAN · the attempt is logged with its verdict',
  }),
]);

/**
 * The one plain sentence, written at the moment a refusal comes back. Keyed by
 * the refusal code core already returns; an unknown code still gets a sentence,
 * because the page must never go silent about something that happened just
 * because its vocabulary is behind.
 */
const REFUSAL_SAID = Object.freeze({
  HUMAN_ONLY: 'It just asked for a name the page does not hold. Refused — author identity '
    + 'is absent from every tool return, before and after you unblind.',
  EVIDENCE_NOT_FOUND: 'It just tried to record a finding whose quote is not in the manuscript. '
    + 'Refused — and the attempt is in the record.',
  REQUIRES_HUMAN: 'It just tried to file the recommendation. Refused — that decision is yours.',
  ALREADY_COMMITTED: 'It tried to file a second recommendation. Refused — you already decided '
    + 'this one.',
  OUT_OF_ORDER: 'It called a tool out of order. Refused — the page holds the sequence.',
  INVALID_CRITERION: 'It scored against a criterion this rubric does not have. Refused.',
  NOT_FOUND: 'It asked for a manuscript that is not on this slate. Refused.',
});

/* -------------------------------------------------------------------------- */
/* Derivation                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Settles seen live on the bus this session. UNION'd with the ledger
 * derivation, never a replacement for it — see the header note.
 */
const live = new Set();

/** Reset alongside resetUiState(); a reset session has seen nothing. */
export function resetConversation() { live.clear(); }

/** Normalize either shape — a bus payload or a ledger row — to one record. */
function normalize(source) {
  if (!source) return null;
  const name = source.name || source.action || null;
  if (!name) return null;
  return {
    name,
    outcome: source.outcome || null,
    code: source.code || null,
    manuscript_id: source.manuscript_id || null,
  };
}

/** Every key one settle satisfies. Coarse to fine, so a matcher can pick. */
function keysOf(record) {
  if (!record || !record.outcome) return [];
  const out = [record.name + '|' + record.outcome];
  if (record.code) out.push(record.name + '|' + record.outcome + '|' + record.code);
  if (record.manuscript_id) {
    out.push(record.name + '|' + record.outcome + '|' + record.manuscript_id);
  }
  return out;
}

/**
 * What this session has actually seen: every AGENT row in the ledger, plus
 * every settle seen live. Human rows are excluded — a human committing a
 * recommendation is not the agent being refused one.
 */
export function seenKeys(state) {
  const out = new Set(live);
  const ledger = (state && Array.isArray(state.ledger)) ? state.ledger : [];
  for (const row of ledger) {
    if (row.actor !== 'agent') continue;
    for (const k of keysOf(normalize(row))) out.add(k);
  }
  return out;
}

/** Step states, in order. A step is `done` on its own evidence, in any order. */
export function stepStates(state) {
  const seen = seenKeys(state);
  const done = STEPS.map((s) => seen.has(s.key));
  return STEPS.map((s, i) => ({
    step: s,
    done: done[i],
    // Open because the one before it really occurred — never because of a click.
    open: done[i] || i === 0 || done[i - 1],
    current: !done[i] && (i === 0 || done[i - 1]),
  }));
}

/* -------------------------------------------------------------------------- */
/* Markup                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Build the rail into #mount-main as its third grid column. The shell's mount
 * points are not this lane's to edit, so the column is created here and the
 * stylesheet declares the third track.
 */
export function buildConversation(main, handlers) {
  const rail = el('aside');
  rail.id = 'rail';
  attrs(rail, { 'aria-labelledby': 'rail-h' });

  const head = el('div', 'rail-head');
  const h = el('h2', 'say', 'Referee takes two of you.');
  h.id = 'rail-h';
  append(head, h, mach(['nothing on this page moves until you say one of these to '
    + 'your assistant'], 'sub'));

  // The page's own account of what it just watched happen. Polite, because the
  // two assertive regions in this app are already spoken for.
  const said = el('div');
  said.id = 'rail-said';
  attrs(said, { role: 'status', 'aria-live': 'polite' });

  const list = el('ol');
  list.id = 'rail-steps';
  for (const step of STEPS) list.appendChild(stepNode(step, handlers));

  const solo = el('div');
  solo.id = 'rail-solo';

  append(rail, head, said, list, solo);
  main.appendChild(rail);
  return rail;
}

function stepNode(step, handlers) {
  const li = el('li', 'rstep');
  attrs(li, { 'data-step': String(step.n), 'data-state': 'shut' });

  const lab = el('p', 'rstep__lab');
  const glyph = el('span', 'rstep__g');
  glyph.appendChild(icon('i-dia'));
  append(lab, glyph, el('span', 'rstep__n', String(step.n)), el('span', 'rstep__t', step.title));

  // The words themselves. pre-wrap keeps the line breaks the prompts were
  // authored with AND still wraps inside the rail.
  const say = el('pre', 'rstep__say', step.prompt);
  attrs(say, { 'data-prompt': '', tabindex: '-1' });

  const act = el('div', 'rstep__act');
  const copy = el('button', 'rstep__copy', 'Copy');
  copy.type = 'button';
  attrs(copy, { 'aria-label': 'Copy step ' + step.n + ' to send to your assistant' });
  copy.addEventListener('click', () => handlers.copyPrompt(copy, step.prompt, say));

  const watch = el('span', 'rstep__watch m', step.waiting);
  append(act, copy, watch);

  const got = el('div', 'rstep__got');
  attrs(got, { hidden: true });

  append(li, lab, say, act, got);
  return li;
}

/* -------------------------------------------------------------------------- */
/* Renderers                                                                  */
/* -------------------------------------------------------------------------- */

/** The whole rail, off state. Cheap: five list items and one block. */
export function renderConversation(rail, state) {
  if (!rail) return;
  const rows = stepStates(state);
  const list = rail.querySelector('#rail-steps');
  let doneCount = 0;

  for (const row of rows) {
    const li = list && list.querySelector('[data-step="' + row.step.n + '"]');
    if (!li) continue;
    if (row.done) doneCount += 1;

    li.setAttribute('data-state', row.done ? 'done' : (row.current ? 'now' : 'shut'));

    const say = li.querySelector('[data-prompt]');
    const act = li.querySelector('.rstep__act');
    // A shut step keeps its number and its title — the argument stays visible —
    // and withholds only the words, because saying them out of order is how a
    // visitor ends up watching nothing happen.
    if (say) say.hidden = !row.open;
    if (act) act.hidden = !row.open;

    const watch = li.querySelector('.rstep__watch');
    if (watch) watch.textContent = row.done ? 'the page saw this happen' : row.step.waiting;

    const got = li.querySelector('.rstep__got');
    if (got) {
      clear(got);
      got.hidden = !row.done;
      if (row.done) {
        got.appendChild(el('p', 'rstep__gotsay', row.step.got));
        got.appendChild(mach([row.step.gotSub], 'm'));
      }
    }
  }

  const head = rail.querySelector('.rail-head .sub');
  if (head) {
    if (doneCount === 0) {
      writeMach(head, ['nothing on this page moves until you say one of these to '
        + 'your assistant']);
    } else {
      writeMach(head, [{ b: doneCount + ' of 5' }, ' watched from the tool lane', DOT,
        doneCount === STEPS.length
          ? 'every refusal is in the record'
          : 'the next opens when its tool fires']);
    }
  }

  renderSolo(rail.querySelector('#rail-solo'));
}

/**
 * The visitor with no WebMCP at all — which is most of them.
 *
 * LEAD WITH WHAT WORKS. states.js has always carried both halves of this fact
 * and no design had rendered the first one: six of the things this page exists
 * to show need no agent. The route to the agent side is one line under them,
 * not a wall in front of them. It is a route, not a control: the masthead band
 * already owns the single copy-the-flag control the manifest allows, and a
 * second one here would be two reports of one condition.
 */
function renderSolo(node) {
  if (!node) return;
  clear(node);
  const active = ui.webmcp && ui.webmcp.attr === 'active';
  node.hidden = !!active;
  if (active) return;

  node.appendChild(el('p', 'say', 'No assistant in this browser? The review is still yours.'));
  const ul = el('ul', 'solo-list');
  for (const item of WEBMCP_ABSENT_STILL_AVAILABLE) ul.appendChild(el('li', null, item));
  node.appendChild(ul);
  node.appendChild(mach([WEBMCP_ABSENT_MISSING[0], DOT,
    'open this page in the ChatGPT desktop in-app browser, or in Chrome 149+ with the '
    + 'WebMCP testing flag on, and the five above go live'], 'sub'));
}

/**
 * A settle just landed. Record it, narrate a refusal, and repaint.
 *
 * Called from the host's TOOL_SETTLED listener, so it runs on the same event
 * the ledger already wrote its row from. Both sources agree by construction.
 */
export function noteSettled(rail, state, payload) {
  const record = normalize(payload);
  if (record) for (const k of keysOf(record)) live.add(k);
  if (record && record.outcome === 'refused') {
    sayIt(rail,
      REFUSAL_SAID[record.code]
        || 'The page refused that call and wrote the attempt to the record.',
      record.code || 'refused', record.name);
  }
  renderConversation(rail, state);
}

/** The plain sentence, with the contract code under it. Replaces, never stacks. */
function sayIt(rail, sentence, code, tool) {
  const node = rail && rail.querySelector('#rail-said');
  if (!node) return;
  clear(node);
  const block = el('div', 'said-block');
  append(block, el('p', 'say', sentence),
    mach([tool ? tool + ' → ' : '', { hot: code }], 'sub'));
  node.appendChild(block);
}

/** Copy feedback that reports the manual-select fallback honestly. */
export function copyFeedbackFor(result) {
  return {
    label: result.ok ? 'Copied' : COPY_FEEDBACK[result.mode],
    holdMs: FEEDBACK_HOLD_MS,
  };
}

export { copyText };
