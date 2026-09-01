/**
 * src/ui/render/tools.js — the seven tools, and the honesty boundary.
 *
 * The tool names come from activity.js TOOL_NAMES rather than from a literal
 * list here, so the table cannot drift from the vocabulary the ledger renders.
 * The descriptions and the two hint columns are the design's, unchanged.
 *
 * The honesty boundary is stated in full, in the app, and it says what the build
 * does NOT solve. It is not a disclaimer to be trimmed for space.
 */

import { el, attrs, append, clear, mach, DOT } from './dom.js';
import { TOOL_NAMES } from '../activity.js';

const TOOL_COPY = {
  get_review_state: ['Hands back the queue, the ranks and the current weights.', 'true', '—'],
  read_manuscript: ['Hands back the manuscript text, with hidden passages already removed.', 'true', 'true'],
  check_claim: ['Checks a quote against the text the assistant was actually given.', 'true', 'true'],
  assert_finding: ['Records a finding, but only if its quote verifies.', 'false', '—'],
  request_unblind: ['Asks to see the authors. Always refused.', 'false', '—'],
  flag_for_editor: ['Raises something to a human editor.', 'false', '—'],
  submit_recommendation: ['Would file the verdict. Always refused.', 'false', '—'],
};

const ORDER = [
  'get_review_state', 'read_manuscript', 'check_claim', 'assert_finding',
  'request_unblind', 'flag_for_editor', 'submit_recommendation',
];

const HONESTY = 'Referee’s injection detector is a small set of pattern families tuned against '
  + 'fixtures we wrote ourselves. It catches the payloads in this corpus and a determined author '
  + 'could evade it in an afternoon. Prompt injection is not solved here and we make no claim that '
  + 'it is. The architectural claim is narrower and does not depend on the detector: the page does '
  + 'not promise the agent clean text, it promises a declared boundary with a known location. Both '
  + 'tools that return author-derived text carry the WebMCP standard’s own untrustedContentHint, '
  + 'which stays true no matter how good or bad our detection is; author identity is absent from '
  + 'every tool return rather than filtered out of it; a finding is refused unless its evidence '
  + 'quote verifies against the text the agent was actually given; and the final recommendation is '
  + 'not a tool the agent can call. If the detector misses a payload, the agent can still be argued '
  + 'into a bad review, and it still cannot learn who wrote the paper, cite text that is not there, '
  + 'or decide the outcome.';

export function buildTools(root) {
  clear(root);

  const section = el('section', 'doc-sec');
  section.id = 'sec-tools';
  attrs(section, { 'aria-labelledby': 'h-tools' });

  const head = el('div', 'pair pair-h');
  const h = el('h2', 'say', 'The seven tools the page handed the assistant');
  h.id = 'h-tools';
  append(head, h, mach(['document.modelContext', DOT, 'registerTool() ×' + TOOL_NAMES.length,
    DOT, 'readOnlyHint', DOT, 'untrustedContentHint']));

  const table = el('table', 'tools');
  const thead = el('thead');
  const hr = el('tr');
  for (const [label, second] of [['tool'], ['what it does'], ['readOnly', 'Hint'], ['untrusted', 'ContentHint']]) {
    const th = el('th');
    attrs(th, { scope: 'col' });
    th.appendChild(document.createTextNode(label));
    if (second) { th.appendChild(el('br')); th.appendChild(document.createTextNode(second)); }
    hr.appendChild(th);
  }
  thead.appendChild(hr);

  const tbody = el('tbody');
  for (const name of ORDER) {
    if (!TOOL_NAMES.includes(name)) continue;
    const [what, readOnly, untrusted] = TOOL_COPY[name];
    const tr = el('tr');
    append(tr,
      el('td', null, name),
      el('td', null, what),
      el('td', readOnly === 'true' ? 'hint' : 'hint', readOnly),
      el('td', untrusted === 'true' ? 'yes' : 'hint', untrusted));
    tbody.appendChild(tr);
  }
  append(table, thead, tbody);

  const note = el('div', 'pair');
  note.style.marginTop = '15px';
  append(note,
    el('p', 'say', 'The two tools that hand back author-written text came from the submitted '
      + 'document, so the browser is told to treat them as untrusted.'),
    mach(['untrustedContentHint stays true no matter how good or bad our detection is — '
      + 'it is a declaration, not a claim about the text']));

  append(section, head, table, note);

  const honestySection = el('section', 'doc-sec');
  honestySection.id = 'sec-honesty';
  attrs(honestySection, { 'aria-labelledby': 'h-honesty' });
  const hh = el('h2', 'say', 'What this does not solve');
  hh.id = 'h-honesty';
  const honestyHead = el('div', 'pair pair-h');
  append(honestyHead, hh, mach(['honesty boundary', DOT,
    'stated in full, in the app, in the README and in the description']));
  const honestyBody = el('div', 'honesty');
  honestyBody.appendChild(el('p', null, HONESTY));
  append(honestySection, honestyHead, honestyBody);

  append(root, section, honestySection);
  return root;
}

export { HONESTY };
