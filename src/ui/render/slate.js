/**
 * src/ui/render/slate.js — the rubric well and the ranked slate.
 *
 * The design's slate was driven by a hardcoded twelve-row array and its own
 * composite(). Both are gone. The order, the numbers, the cut line and the
 * near-tie sentence now come from core/ranking.js via state.ranking, which is
 * re-derived whole on every weight change — so the slate cannot drift from the
 * arithmetic the spec executed.
 *
 * What is lifted unchanged from the design: the row is not a card, the FLIP is
 * 260ms on cubic-bezier(.22,.61,.36,1) with a 14ms stagger capped at five rows,
 * the crossing wash holds to 60% and releases, and the score tweens while the
 * row slides.
 */

import { el, attrs, append, clear, REDUCED_MOTION } from './dom.js';
import { CRITERIA, DEFAULT_WEIGHTS, NEAR_TIE_EPSILON,
  ACCEPT_SLOTS_MIN, ACCEPT_SLOTS_MAX } from '../../core/constants.js';

const LABEL = {
  novelty: 'Novelty', rigor: 'Rigor', clarity: 'Clarity', reproducibility: 'Repro',
};
const SPOKEN = {
  novelty: 'Novelty', rigor: 'Rigor', clarity: 'Clarity', reproducibility: 'Reproducibility',
};

/* -------------------------------------------------------------------------- */
/* Markup                                                                     */
/* -------------------------------------------------------------------------- */

export function buildSlate(root, handlers) {
  clear(root);

  const rubric = el('div');
  rubric.id = 'rubric';

  const head = el('div', 'rubric-head');
  head.appendChild(el('h2', null, 'What counts, and how much'));

  const sub = el('div', 'rubric-sub');
  const key = el('span', 'human-key');
  key.appendChild(iconKey());
  key.appendChild(document.createTextNode('Human only'));
  append(sub, key, el('span', 'm', 'retune_rubric · weights need not total 100'));

  append(rubric, head, sub);

  for (const criterion of CRITERIA) {
    const row = el('div', 'crit');
    const id = 'w-' + criterion;

    const label = el('label', null, LABEL[criterion]);
    label.htmlFor = id;

    // rubric.weight — a NATIVE range input. Its keyboard behaviour is not
    // reimplemented; aria-valuetext is written on every change so a screen
    // reader announces a unit rather than a bare number.
    const input = el('input');
    input.id = id;
    attrs(input, {
      type: 'range', min: '0', max: '100', step: '5', 'data-criterion': criterion,
    });

    const out = el('output');
    out.id = 'v-' + criterion;
    attrs(out, { for: id });

    input.addEventListener('input', () => handlers.onWeightInput(criterion, Number(input.value)));
    input.addEventListener('change', () => handlers.onWeightSettle(criterion, Number(input.value)));

    append(row, label, input, out);
    rubric.appendChild(row);
  }

  const foot = el('div', 'rubric-foot');
  const minus = el('button', 'step', '−');
  minus.type = 'button';
  attrs(minus, { 'aria-label': 'One fewer accept slot' });
  minus.addEventListener('click', () => handlers.onAcceptSlots(-1));

  // rubric.acceptSlots — the value element. The two steppers are its controls;
  // both carry an aria-label because a bare minus sign announces as nothing.
  const count = el('span');
  attrs(count, { 'data-bind': 'accept-slots' });

  const plus = el('button', 'step', '+');
  plus.type = 'button';
  attrs(plus, { 'aria-label': 'One more accept slot' });
  plus.addEventListener('click', () => handlers.onAcceptSlots(+1));

  const defaults = el('button', 'reset-link', 'Venue defaults');
  defaults.type = 'button';
  defaults.addEventListener('click', () => handlers.onVenueDefaults());

  append(foot, el('span', 'm-cap', 'Accept top'), minus, count, plus, defaults);
  rubric.appendChild(foot);

  // slate.status — the CONSEQUENCE of a reorder, announced politely and
  // debounced, never once per drag frame.
  const status = el('p', 'sr-only');
  attrs(status, { 'data-bind': 'slate-status' });

  const scroll = el('div');
  scroll.id = 'slate-scroll';
  const list = el('ul');
  list.id = 'slate-list';
  scroll.appendChild(list);

  append(root, rubric, status, scroll);
  attrs(root, { role: 'navigation', 'aria-label': 'Ranked slate' });
  return root;
}

function iconKey() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(ns, 'use');
  use.setAttribute('href', '#i-key');
  svg.appendChild(use);
  return svg;
}

/* -------------------------------------------------------------------------- */
/* Rubric renderers                                                           */
/* -------------------------------------------------------------------------- */

/**
 * rubric.weight. The manifest selector `[data-criterion]` resolves ONE element,
 * but all four sliders render from the same state key, so this syncs the whole
 * well from whichever slider the binder handed over.
 */
export function renderRubricWeights(anyInput, state) {
  const well = anyInput.closest('#rubric') || anyInput.ownerDocument;
  const weights = (state && state.rubricWeights) || DEFAULT_WEIGHTS;
  for (const criterion of CRITERIA) {
    const input = well.querySelector('[data-criterion="' + criterion + '"]');
    if (!input) continue;
    const value = Number(weights[criterion] ?? 0);
    if (document.activeElement !== input) input.value = String(value);
    input.style.setProperty('--fill', value + '%');
    input.setAttribute('aria-valuetext', SPOKEN[criterion] + ', weight ' + value + ' of 100');
    const out = well.querySelector('#v-' + criterion);
    if (out) {
      out.textContent = String(value);
      out.classList.toggle('is-hot', value !== DEFAULT_WEIGHTS[criterion]);
    }
  }
}

/** rubric.acceptSlots — integer 1..11, clamped by the constants, never by here. */
export function renderAcceptSlots(node, state) {
  const raw = state && state.rubricWeights ? state.rubricWeights.acceptSlots : DEFAULT_WEIGHTS.acceptSlots;
  const n = Math.min(ACCEPT_SLOTS_MAX, Math.max(ACCEPT_SLOTS_MIN, Number(raw) || DEFAULT_WEIGHTS.acceptSlots));
  node.textContent = String(n);
  node.setAttribute('aria-label', 'Accept the top ' + n + ' of twelve');
}

/* -------------------------------------------------------------------------- */
/* The slate                                                                  */
/* -------------------------------------------------------------------------- */

function marksFor(item, state) {
  const out = [];
  const integrity = (state && state.integrityEvents) || [];
  const hits = integrity.filter((e) => e.manuscript_id === item.manuscript_id).length;
  if (hits > 0) out.push({ text: hits + ' hidden ' + (hits === 1 ? 'passage' : 'passages'), accent: true });

  const findings = ((state && state.findings) || [])
    .filter((f) => f.manuscript_id === item.manuscript_id && f.status === 'active').length;
  if (findings > 0) out.push({ text: findings + ' finding' + (findings === 1 ? '' : 's'), accent: false });

  const unblind = ((state && state.unblinded) || []).find((u) => u.id === item.manuscript_id);
  if (unblind) out.push({ text: 'you unblinded this', accent: false });
  return out;
}

function rowNode(item, rank, acceptSlots, state, selectedId, handlers) {
  const li = el('li');
  const above = rank <= acceptSlots;

  // slate.card — the attribute value IS the id. One tab stop each; roving arrow
  // keys and Home/End are attached by the host via attachRovingFocus.
  const button = el('button', 'row' + (above ? '' : ' is-below')
    + (item.manuscript_id === selectedId ? ' is-sel' : ''));
  button.type = 'button';
  attrs(button, {
    'data-manuscript-id': item.manuscript_id,
    'aria-current': item.manuscript_id === selectedId ? 'true' : null,
  });

  append(button,
    el('span', 'row__rank', String(rank).padStart(2, '0')),
    el('span', 'row__title', item.title));

  const score = el('span', 'row__score', item.composite.toFixed(2));
  attrs(score, { 'data-score': '' });
  button.appendChild(score);

  const marks = marksFor(item, state);
  if (marks.length) {
    const wrap = el('span', 'row__marks');
    for (const m of marks) wrap.appendChild(el('span', 'mark' + (m.accent ? ' is-accent' : ''), m.text));
    button.appendChild(wrap);
  }

  button.setAttribute('aria-label', 'Rank ' + rank + ', '
    + (above ? 'above the accept cut' : 'below the accept cut') + '. ' + item.title
    + '. Composite ' + item.composite.toFixed(2) + '.');

  button.addEventListener('click', () => handlers.onSelect(item.manuscript_id));
  li.appendChild(button);
  return li;
}

function cutNode() {
  const li = el('li', 'cut');
  attrs(li, { role: 'separator' });
  const inner = el('div', 'cut-inner');
  append(inner, el('span', 'cut-label', 'Accept cut'), el('span', 'cut-rule'));
  const tie = el('div', 'cut-tie');
  attrs(tie, { 'data-cut-tie': '' });
  append(li, inner, tie);
  return li;
}

/**
 * The near-tie sentence, stated ONCE, at the cut, where it is a decision rather
 * than a curiosity. NEAR_TIE_EPSILON comes from constants.js — the design's
 * local copy of 0.15 is not re-declared here.
 */
function paintTie(list, table, acceptSlots) {
  const tie = list.querySelector('[data-cut-tie]');
  if (!tie) return;
  clear(tie);
  const a = table[acceptSlots - 1];
  const b = table[acceptSlots];
  if (!a || !b) return;
  const delta = Math.abs(a.composite - b.composite);
  if (delta > NEAR_TIE_EPSILON) return;
  tie.appendChild(el('p', null, 'These two are too close to separate. That’s your call.'));
  tie.appendChild(el('p', 'm', 'NEAR_TIE · ' + a.manuscript_id + ' ' + a.composite.toFixed(2)
    + ' / ' + b.manuscript_id + ' ' + b.composite.toFixed(2)
    + ' · Δ ' + delta.toFixed(2) + ' ≤ ' + NEAR_TIE_EPSILON));
}

/**
 * slate.list. First call paints; every later call RECONCILES the existing rows
 * so the FLIP has something to measure. aria-busy goes true for the run and is
 * cleared when it settles.
 *
 * @returns {{deltas:number, up:string[], down:string[]}} what actually moved
 */
export function renderSlate(list, state, selectedId, handlers) {
  const table = (state && Array.isArray(state.ranking)) ? state.ranking : [];
  const acceptSlots = Math.min(ACCEPT_SLOTS_MAX, Math.max(ACCEPT_SLOTS_MIN,
    Number(state && state.rubricWeights && state.rubricWeights.acceptSlots) || DEFAULT_WEIGHTS.acceptSlots));

  const existing = Array.from(list.querySelectorAll('[data-manuscript-id]'));
  if (existing.length !== table.length) {
    clear(list);
    table.forEach((item, i) => {
      if (i === acceptSlots) list.appendChild(cutNode());
      list.appendChild(rowNode(item, i + 1, acceptSlots, state, selectedId, handlers));
    });
    paintTie(list, table, acceptSlots);
    return { deltas: 0, up: [], down: [] };
  }

  /* ---- FIRST: measure where every row is now ---- */
  const before = new Map();
  for (const node of existing) {
    const id = node.getAttribute('data-manuscript-id');
    before.set(id, {
      top: node.getBoundingClientRect().top,
      above: !node.classList.contains('is-below'),
      rank: parseInt(node.querySelector('.row__rank').textContent, 10),
      score: parseFloat(node.querySelector('[data-score]').textContent),
    });
  }

  /* ---- LAST: reorder the DOM, then re-seat the cut at the slot count ---- */
  const cut = list.querySelector('.cut');
  for (const item of table) {
    const node = list.querySelector('[data-manuscript-id="' + item.manuscript_id + '"]');
    if (node) list.appendChild(node.parentNode);
  }
  const items = Array.from(list.children).filter((li) => !li.classList.contains('cut'));
  if (cut) list.insertBefore(cut, items[acceptSlots] || null);

  /* ---- rewrite rank, ground, marks and the tie sentence BEFORE measuring
         again: the tie sentence changes height, so it has to settle first ---- */
  const up = [];
  const down = [];
  let deltas = 0;

  table.forEach((item, i) => {
    const rank = i + 1;
    const node = list.querySelector('[data-manuscript-id="' + item.manuscript_id + '"]');
    if (!node) return;
    const prev = before.get(item.manuscript_id);
    const above = rank <= acceptSlots;

    node.querySelector('.row__rank').textContent = String(rank).padStart(2, '0');
    node.classList.toggle('is-below', !above);
    node.classList.toggle('is-sel', item.manuscript_id === selectedId);
    if (item.manuscript_id === selectedId) node.setAttribute('aria-current', 'true');
    else node.removeAttribute('aria-current');
    node.setAttribute('aria-label', 'Rank ' + rank + ', '
      + (above ? 'above the accept cut' : 'below the accept cut') + '. ' + item.title
      + '. Composite ' + item.composite.toFixed(2) + '.');

    const oldMarks = node.querySelector('.row__marks');
    if (oldMarks) oldMarks.remove();
    const marks = marksFor(item, state);
    if (marks.length) {
      const wrap = el('span', 'row__marks');
      for (const m of marks) wrap.appendChild(el('span', 'mark' + (m.accent ? ' is-accent' : ''), m.text));
      node.appendChild(wrap);
    }

    if (prev) {
      if (prev.rank !== rank) deltas += 1;
      if (prev.above !== above) {
        (above ? up : down).push(item.manuscript_id);
        markCrossing(node, above);
      }
      tweenScore(node.querySelector('[data-score]'), prev.score, item.composite);
    }
  });

  paintTie(list, table, acceptSlots);

  /* ---- INVERT and PLAY ---- */
  const moved = [];
  for (const node of existing) {
    const prev = before.get(node.getAttribute('data-manuscript-id'));
    if (!prev) continue;
    const dy = prev.top - node.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) continue;
    if (REDUCED_MOTION) continue;
    node.style.transition = 'none';
    node.style.transform = 'translateY(' + dy + 'px)';
    moved.push(node);
  }

  if (moved.length) {
    list.setAttribute('aria-busy', 'true');
    let played = false;
    const play = () => {
      if (played) return;
      played = true;
      moved.forEach((node, i) => {
        node.style.transition = 'transform 260ms cubic-bezier(.22,.61,.36,1) '
          + (Math.min(i, 5) * 14) + 'ms';
        node.style.transform = '';
      });
    };
    requestAnimationFrame(() => requestAnimationFrame(play));
    // rAF is suspended in a backgrounded tab; without this the rows would keep
    // their inverted transforms and the slate would sit visibly wrong.
    setTimeout(play, 80);
    setTimeout(() => {
      for (const node of moved) { node.style.transition = ''; node.style.transform = ''; }
      list.setAttribute('aria-busy', 'false');
    }, 760);
  }

  return { deltas, up, down };
}

function markCrossing(node, up) {
  node.classList.remove('crossed-up', 'crossed-down');
  void node.offsetWidth;
  node.classList.add(up ? 'crossed-up' : 'crossed-down');
  setTimeout(() => node.classList.remove('crossed-up', 'crossed-down'), 950);
}

/** The score climbs while the row slides — worth more together than apart. */
function tweenScore(node, from, to) {
  if (!node) return;
  const token = (node._tk = (node._tk || 0) + 1);
  clearTimeout(node._settle);
  node._settle = setTimeout(() => { if (node._tk === token) node.textContent = to.toFixed(2); }, 320);
  if (REDUCED_MOTION || !Number.isFinite(from) || Math.abs(to - from) < 0.005) {
    node.textContent = to.toFixed(2);
    return;
  }
  const t0 = performance.now();
  const step = (now) => {
    if (node._tk !== token) return;
    const k = Math.min(1, (now - t0) / 260);
    node.textContent = (from + (to - from) * k).toFixed(2);
    if (k < 1) requestAnimationFrame(step); else node.textContent = to.toFixed(2);
  };
  requestAnimationFrame(step);
}

/**
 * slate.status. The CONSEQUENCE of the reorder, not the cause: how many moved
 * and which crossed the cut. Never announced per drag frame — the host debounces
 * this 500ms after the last input.
 */
export function renderSlateStatus(node, result) {
  if (!result || (!result.deltas && !result.up.length && !result.down.length)) return;
  const parts = [result.deltas + ' manuscript' + (result.deltas === 1 ? '' : 's') + ' re-ranked.'];
  if (result.up.length) parts.push(result.up.join(', ') + ' crossed above the accept cut.');
  if (result.down.length) parts.push(result.down.join(', ') + ' dropped below the accept cut.');
  node.textContent = parts.join(' ');
}

/**
 * Constant-sum rebalance, lifted from the design: dragging one criterion
 * redistributes the remaining 100 across the other three in proportion to their
 * current ratios, snapped to the 5-point grid. Core does NOT require the weights
 * to total 100 — composite() divides by the sum — so this is a UI affordance,
 * and the well says so rather than calling it a rule.
 */
export function rebalance(weights, criterion, value) {
  const next = { ...weights };
  const target = Math.max(0, Math.min(100, Math.round(value / 5) * 5));
  const others = CRITERIA.filter((c) => c !== criterion);
  const rest = 100 - target;
  const currentSum = others.reduce((n, c) => n + (next[c] ?? 0), 0);
  const raw = others.map((c) => (currentSum > 0 ? (next[c] ?? 0) * rest / currentSum : rest / others.length));
  const snap = raw.map((v) => Math.round(v / 5) * 5);

  let diff = rest - snap.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => ({ i, r: v - snap[i] })).sort((a, b) => b.r - a.r);
  let guard = 0;
  while (diff !== 0 && guard++ < 80) {
    if (diff > 0) { snap[order[guard % order.length].i] += 5; diff -= 5; }
    else {
      const dn = order[order.length - 1 - (guard % order.length)].i;
      if (snap[dn] >= 5) { snap[dn] -= 5; diff += 5; }
    }
  }
  next[criterion] = target;
  others.forEach((c, i) => { next[c] = Math.max(0, snap[i]); });
  return next;
}
