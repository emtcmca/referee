/**
 * src/ui/render/header.js — masthead, the WebMCP band, and the notice band.
 *
 * Three binding points sit here that the design mockup had no live source for,
 * so their copy comes from states.js verbatim rather than from the mockup:
 * webmcp.band, webmcp.failures and notice.band. The mockup was authored with
 * the agent side live, which is exactly the case those three do not cover.
 */

import { el, attrs, append, clear, mach, writeMach, DOT } from './dom.js';
import { WEBMCP_COPY, WEBMCP_FLAG_URL, copyForNotice } from '../states.js';
import { ui } from './ui-state.js';

/** Build the masthead and the two bands into #mount-header. */
export function buildHeader(root, handlers) {
  clear(root);

  const mast = el('header');
  mast.id = 'masthead';

  const wordmark = el('div', 'wordmark');
  append(wordmark, el('b', null, 'Referee'), ' ', el('span', null, '· double-blind review room'));

  const fiction = el('p', null,
    'Demo corpus — all 12 manuscripts, authors, and institutions are fictional.');
  fiction.id = 'fiction-banner';

  const about = el('button', 'mast-act', 'About this build');
  about.type = 'button';
  about.addEventListener('click', () => handlers.openAbout());

  // app.reset — resets to the seed in one click.
  const reset = el('button', 'mast-act', 'Reset session');
  reset.type = 'button';
  attrs(reset, { 'data-action': 'reset-session' });
  reset.addEventListener('click', () => handlers.resetSession());

  append(mast, wordmark, fiction, about, reset);

  // ---- the WebMCP band. Authored VISIBLE; [data-webmcp="active"] hides it. ----
  const band = el('div');
  attrs(band, { 'data-bind': 'webmcp-band', role: 'region', 'aria-label': 'Agent tool status' });

  const copyFlag = el('button', null, WEBMCP_COPY.unavailable.band.action.label);
  copyFlag.type = 'button';
  attrs(copyFlag, { 'data-action': 'copy-flag-url', 'data-url': WEBMCP_FLAG_URL });
  copyFlag.addEventListener('click', () => handlers.copyFlagUrl(copyFlag));

  const failures = el('ul');
  attrs(failures, { 'data-bind': 'webmcp-failures', hidden: true });

  append(band,
    el('p', 'say', WEBMCP_COPY.unavailable.band.lead),
    mach([WEBMCP_COPY.unavailable.band.sub], 'm'),
    copyFlag,
    failures);

  // ---- the notice band. System conditions only; refusals never land here. ----
  const notices = el('div');
  attrs(notices, { 'data-bind': 'notice-band', role: 'region', 'aria-label': 'System notices' });

  append(root, mast, band, notices);
  return root;
}

/* -------------------------------------------------------------------------- */
/* Renderers                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * webmcp.root — documentElement.dataset.webmcp, one of exactly three values.
 * attrForPhase() owns the mapping; this renderer only writes what it returns.
 */
export function renderWebmcpRoot(rootEl) {
  rootEl.dataset.webmcp = ui.webmcp.attr || 'absent';
}

/** webmcp.pill — phase plus registered/total. Never skips ahead. */
export function renderWebmcpPill(node) {
  const snap = ui.webmcp;
  const copy = WEBMCP_COPY[snap.phase] || WEBMCP_COPY.unavailable;
  const parts = [{ b: copy.pill }];
  if (copy.count) parts.push(' ' + snap.registered + '/' + snap.total);
  writeMach(node, parts);
  node.setAttribute('data-phase', snap.phase);
  node.setAttribute('data-tone', copy.tone);
}

/**
 * webmcp.band — one line of copy and exactly one control. The band is hidden by
 * CSS on [data-webmcp="active"] rather than by a hidden attribute, so the copy
 * stays in the accessibility tree order the design authored.
 */
export function renderWebmcpBand(node) {
  const snap = ui.webmcp;
  const copy = WEBMCP_COPY[snap.phase] || WEBMCP_COPY.unavailable;
  const say = node.querySelector('.say');
  const sub = node.querySelector('.m');

  if (copy.band) {
    if (say) say.textContent = copy.band.lead;
    if (sub) writeMach(sub, [copy.band.sub]);
  } else if (snap.phase === 'partial') {
    // Do not silently degrade partial to unavailable, and do not claim live.
    if (say) say.textContent = 'Some agent tools did not register, so part of the agent side is inactive.';
    if (sub) writeMach(sub, [{ b: snap.registered + '/' + snap.total }, ' registered', DOT,
      'the tools below were rejected by the browser']);
  } else {
    if (say) say.textContent = 'Registering the agent-facing tools.';
    if (sub) writeMach(sub, [snap.registered + '/' + snap.total + ' settled so far']);
  }
}

/** webmcp.copyFlag — the control. Its label swap is handled by the host. */
export function renderCopyFlag(node) {
  if (!node.dataset.url) node.dataset.url = WEBMCP_FLAG_URL;
}

/** webmcp.failures — per-tool registration failures on the partial phase. */
export function renderWebmcpFailures(node) {
  const failed = Array.isArray(ui.webmcp.failed) ? ui.webmcp.failed : [];
  clear(node);
  node.hidden = failed.length === 0;
  for (const f of failed) {
    const name = typeof f === 'string' ? f : (f && f.name) || 'unknown tool';
    const why = typeof f === 'string' ? null : (f && f.error) || null;
    node.appendChild(el('li', null, why ? name + ' — ' + why : name));
  }
}

/**
 * notice.band — copyForNotice(code) resolves the code core hands over. An
 * unrecognized code still renders a band: the page must never go silent about
 * something that happened just because its vocabulary is behind.
 */
export function renderNoticeBand(node, codes, handlers) {
  clear(node);
  const list = Array.isArray(codes) ? codes : [];
  for (const code of list) {
    if (ui.dismissedNotices.has(code)) continue;
    const copy = copyForNotice(code);
    const row = el('div', 'notice');
    attrs(row, { 'data-severity': copy.severity || 'notice', 'data-code': code });
    append(row, el('p', 'say', copy.lead), mach([copy.sub], 'm'));
    if (copy.dismissible === true) {
      const dismiss = el('button', 'notice-dismiss', 'Dismiss');
      dismiss.type = 'button';
      dismiss.addEventListener('click', () => {
        ui.dismissedNotices.add(code);
        if (handlers && handlers.rerenderNotices) handlers.rerenderNotices();
      });
      row.appendChild(dismiss);
    }
    node.appendChild(row);
  }
}
