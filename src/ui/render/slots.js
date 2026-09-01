/**
 * src/ui/render/slots.js — the corpus's reserved injection slots.
 *
 * WHY THIS FILE EXISTS. src/corpus/manuscripts.public.js ships six RESERVED
 * markers — four `[[PAYLOAD_SLOT:…]]` and two `[[DECOY_SLOT:…]]` — sitting
 * inside the section prose, and its own header says so. The adversarial layer
 * that fills them, and the sanitizer that removes them again before the agent
 * sees a word, are lane 04's and are not built in this checkout.
 *
 * So the marker is a live corpus fact with no live payload behind it. Two things
 * follow, and both matter:
 *
 *   1. The raw token must NEVER reach the reader as prose. `[[PAYLOAD_SLOT:FX-1]]`
 *      rendered in the middle of an abstract reads as a bug in the manuscript.
 *   2. The page must not invent the payload text to fill the hole. It renders the
 *      slot in the design's own payload/void treatment and states that the text
 *      is unauthored, which is the true thing to say.
 *
 * A RESERVED SLOT IS NOT A DETECTED INJECTION. This module counts what the
 * corpus reserves; `state.integrityEvents` counts what the sanitizer actually
 * removed, and that is a different number (currently zero, because the sanitizer
 * does not exist). Nothing here is written into that count.
 */

import { el } from './dom.js';

const SLOT_RE = /\[\[(PAYLOAD|DECOY)_SLOT:([A-Za-z0-9-]+)\]\]/g;

/**
 * Split one section's text into prose runs and slot markers, in order.
 * @returns {Array<{kind:'text', text:string}|{kind:'slot', slot:'PAYLOAD'|'DECOY', id:string}>}
 */
export function splitSlots(text) {
  const source = String(text || '');
  const out = [];
  let cursor = 0;
  SLOT_RE.lastIndex = 0;
  let match = SLOT_RE.exec(source);
  while (match) {
    if (match.index > cursor) out.push({ kind: 'text', text: source.slice(cursor, match.index) });
    out.push({ kind: 'slot', slot: match[1], id: match[2] });
    cursor = match.index + match[0].length;
    match = SLOT_RE.exec(source);
  }
  if (cursor < source.length) out.push({ kind: 'text', text: source.slice(cursor) });
  return out;
}

/** Every reserved slot in a manuscript, with the section it sits in. */
export function slotsOf(doc) {
  if (!doc || !Array.isArray(doc.sections)) return [];
  const out = [];
  for (const section of doc.sections) {
    for (const part of splitSlots(section.text)) {
      if (part.kind === 'slot') {
        out.push({ ...part, section_id: section.id, section_label: section.label });
      }
    }
  }
  return out;
}

/** Paragraphs of a prose run, with the blank-line splitting the corpus uses. */
export function paragraphsOf(text) {
  return String(text || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}

export const SLOT_COPY = {
  PAYLOAD: {
    cap: (id, section) => 'Reserved injection slot ' + id + ' · ' + section,
    page: 'A prompt-injection payload is reserved for this position in the corpus. '
        + 'The payload text is authored by the adversarial layer, which is not built in this '
        + 'checkout, so there is nothing here to show you yet.',
    agent: 'reserved injection slot — nothing was removed, because nothing was placed here',
  },
  DECOY: {
    cap: (id, section) => 'Reserved decoy slot ' + id + ' · ' + section,
    page: 'A DECOY is reserved for this position: prose that looks like an injection and is '
        + 'not one. It exists so the detector can be shown over-flagging. It is unauthored '
        + 'in this checkout.',
    agent: 'reserved decoy slot — a decoy is meant to survive sanitising, not be removed',
  },
};

/**
 * One slot, in the design's OWN treatment: `.payload` on the copy the page holds
 * (accent wash, accent rule, the passage marked in place), `.void` on the copy
 * the agent receives (dashed outline, the shape of a deliberate absence).
 *
 * @param {'page'|'agent'} mode which copy of the text is being rendered
 */
export function slotNode(part, sectionLabel, mode) {
  const copy = SLOT_COPY[part.slot] || SLOT_COPY.PAYLOAD;
  if (mode === 'agent') {
    const node = el('p', 'void');
    node.setAttribute('data-slot', part.id);
    node.textContent = copy.agent;
    return node;
  }
  const node = el('p', 'payload');
  node.setAttribute('data-slot', part.id);
  node.appendChild(el('span', 'm-cap', copy.cap(part.id, sectionLabel)));
  node.appendChild(document.createTextNode(copy.page));
  return node;
}
