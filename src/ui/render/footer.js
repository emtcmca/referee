/**
 * src/ui/render/footer.js — the status bar, and the agent pulse inside it.
 *
 * THE SWEEP NEVER FAKES COMPLETION. There is no timeout that pretends a call
 * finished; after ten seconds the label simply gains a "still running" suffix.
 * A refusal is held 900ms and a success 700ms — the refusal longer, on purpose,
 * because it is the beat the page exists to show.
 */

import { el, attrs, append, clear, writeMach, DOT } from './dom.js';
import { WEBMCP_TOOL_TOTAL } from '../states.js';
import { ui } from './ui-state.js';

export function buildFooter(root, toolStatus) {
  const bar = el('footer');
  bar.id = 'status';

  // agent.pulse — the live sweep.
  const pulse = el('span', 'm');
  attrs(pulse, { 'data-bind': 'agent-pulse' });
  pulse.appendChild(el('span', 'pulse-dot'));
  pulse.appendChild(el('span', null, 'AGENT IDLE'));

  // webmcp.pill — phase plus registered/total. Never skips ahead.
  const pill = el('span', 'm');
  attrs(pill, { 'data-bind': 'webmcp-pill' });

  const calls = el('span', 'm');
  attrs(calls, { 'data-bind-local': 'call-counts' });

  const seed = el('span', 'm');
  attrs(seed, { 'data-bind-local': 'seed' });

  const weights = el('span', 'm');
  attrs(weights, { 'data-bind-local': 'weights' });

  const sep = () => {
    const s = el('span', 'sep m', '·');
    attrs(s, { 'aria-hidden': 'true' });
    return s;
  };

  append(bar, pulse, sep(), pill, sep(), calls, sep(), seed, sep(), weights,
    el('span', 'm fict', 'Fictional corpus — 12 seeded manuscripts, no real authors'));

  clear(root);
  append(root, bar);
  // The shell's tool-status paragraph keeps its role=status live region and
  // moves into the bar, where main.js still writes to it by id.
  if (toolStatus) {
    toolStatus.className = 'm';
    bar.insertBefore(toolStatus, bar.firstChild);
  }
  return root;
}

/** agent.pulse — state, label, tool, outcome, code, stillRunning. */
export function renderPulse(node) {
  const p = ui.pulse;
  node.setAttribute('data-pulse', p.state);
  if (p.outcome) node.setAttribute('data-outcome', p.outcome);
  else node.removeAttribute('data-outcome');

  const text = node.querySelector('span:not(.pulse-dot)');
  if (!text) return;
  let label = p.label || 'AGENT IDLE';
  if (p.stillRunning) label += ' · still running';
  text.textContent = label;
  node.setAttribute('aria-label', 'Agent activity: ' + label);
}

/** The rest of the bar. Not a binding point — the honest session footprint. */
export function renderFooterStats(root, state) {
  const entries = (state && Array.isArray(state.ledger)) ? state.ledger : [];
  const refused = entries.filter((e) => e.outcome === 'refused').length;

  const calls = root.querySelector('[data-bind-local="call-counts"]');
  if (calls) {
    writeMach(calls, ['calls ', { b: String(entries.length) }, ', refused ', { b: String(refused) }]);
  }

  const seed = root.querySelector('[data-bind-local="seed"]');
  if (seed) writeMach(seed, ['seed ', { b: String((state && state.seedHash) || 'unknown') }]);

  const weights = root.querySelector('[data-bind-local="weights"]');
  if (weights) {
    const w = (state && state.rubricWeights) || {};
    writeMach(weights, ['weights ', {
      b: [w.novelty, w.rigor, w.clarity, w.reproducibility].join(' / '),
    }]);
  }
  void WEBMCP_TOOL_TOTAL;
  void DOT;
}
