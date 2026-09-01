/**
 * src/ui/render/dom.js — the smallest possible builder.
 *
 * EVERY string that reaches the page goes through textContent. There is no
 * innerHTML in this render layer at all, and that is not fastidiousness: two of
 * the seven tools hand back author-written text, the manuscript corpus is
 * seeded with prompt-injection payloads on purpose, and the split-screen exists
 * to display those payloads verbatim. A single innerHTML on that path would let
 * a manuscript author write markup into the reviewer's page.
 *
 * The machine register needs emphasis inside a line (design: `.sub b`, `.sub
 * .hot`), so `mach()` takes an ARRAY OF PARTS rather than a string of markup.
 * A part is a plain string, or {b}, or {hot}. Nothing else is expressible, so
 * nothing else can be injected.
 */

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
export function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== null && text !== undefined) node.textContent = String(text);
  return node;
}

/** Set attributes from a plain object. Skips null/undefined values. */
export function attrs(node, map) {
  for (const [k, v] of Object.entries(map || {})) {
    if (v === null || v === undefined) continue;
    if (v === false) { node.removeAttribute(k); continue; }
    node.setAttribute(k, v === true ? '' : String(v));
  }
  return node;
}

export function append(parent, ...children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return parent;
}

export function clear(node) {
  if (node) node.textContent = '';
  return node;
}

/**
 * The machine line. `parts` is a list of strings and {b}/{hot} objects; they are
 * joined with the design's middot separator only where the caller asks for one,
 * so the caller keeps control of the sentence.
 */
export function mach(parts, cls) {
  const p = el('p', cls || 'sub');
  writeMach(p, parts);
  return p;
}

/** Rewrite an existing machine line in place, so a re-render keeps the node. */
export function writeMach(node, parts) {
  clear(node);
  for (const part of parts || []) {
    if (part === null || part === undefined || part === false) continue;
    if (typeof part === 'string') { node.appendChild(document.createTextNode(part)); continue; }
    if (part.b !== undefined) { node.appendChild(el('b', null, part.b)); continue; }
    if (part.hot !== undefined) { node.appendChild(el('span', 'hot', part.hot)); continue; }
    if (part.node) { node.appendChild(part.node); }
  }
  return node;
}

/** The design's separator between machine clauses. */
export const DOT = ' · ';
export const ARROW = ' → ';

/** A two-line coupled block: the human sentence, its machine record beneath. */
export function pair(sayText, machParts, opts) {
  const o = opts || {};
  const wrap = el('div', 'pair' + (o.head ? ' pair-h' : '') + (o.refused ? ' is-refused' : ''));
  const say = el(o.heading ? 'h2' : 'p', 'say');
  if (o.refused) say.appendChild(stamp());
  if (o.id) say.id = o.id;
  say.appendChild(document.createTextNode(sayText));
  wrap.appendChild(say);
  if (machParts) wrap.appendChild(mach(machParts));
  return wrap;
}

/**
 * THE STAMP. A refusal is the page doing its job, so it is marked the way a
 * clerk marks a document that has been ruled on — never with the error
 * vocabulary. The wording is fixed by the design.
 */
export function stamp(label) {
  return el('span', 'stamp', label || 'Refused by the page');
}

/** The human-only key, with the design's inline symbol. */
export function humanKey(label) {
  const span = el('span', 'human-key');
  span.appendChild(icon('i-key'));
  span.appendChild(document.createTextNode(label || 'Human only'));
  return span;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A <use> reference into the sprite sheet the page renders once. */
export function icon(symbolId, viewBox) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  if (viewBox) svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', '#' + symbolId);
  svg.appendChild(use);
  return svg;
}

/** The sprite sheet, lifted from the design. Injected once at boot. */
export function spriteSheet() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('style', 'position:absolute;width:0;height:0');
  const defs = document.createElementNS(SVG_NS, 'defs');
  const symbols = [
    ['i-key', '0 0 12 12', [
      ['circle', { cx: '4', cy: '4', r: '2.4' }],
      ['path', { d: 'M5.7 5.7 10 10M8 8l1.4-1.4M9.4 9.4 10.6 8.2' }],
    ]],
    ['i-sq', '0 0 10 10', [['rect', { x: '1.5', y: '1.5', width: '7', height: '7' }]]],
    ['i-dia', '0 0 10 10', [['path', { d: 'M5 1.2 8.8 5 5 8.8 1.2 5Z' }]]],
  ];
  for (const [id, viewBox, shapes] of symbols) {
    const sym = document.createElementNS(SVG_NS, 'symbol');
    sym.setAttribute('id', id);
    sym.setAttribute('viewBox', viewBox);
    for (const [tag, map] of shapes) {
      const shape = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(map)) shape.setAttribute(k, v);
      sym.appendChild(shape);
    }
    defs.appendChild(sym);
  }
  svg.appendChild(defs);
  return svg;
}

/** Screen-reader-only text, using the design's own utility class. */
export function srOnly(text) {
  return el('span', 'sr-only', text);
}

/** hh:mm:ss from an ISO stamp, for the machine line. Never a locale string. */
export function clockOf(iso) {
  if (!iso) return '';
  const at = String(iso);
  const t = at.indexOf('T');
  return t === -1 ? at : at.slice(t + 1, t + 9);
}

export const REDUCED_MOTION = typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
