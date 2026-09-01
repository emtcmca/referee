/**
 * src/ui/clipboard.js — export the ledger as text (AC-24, MUST).
 *
 * Three tiers, tried in order, and the caller is told which one fired so the
 * UI can tell the truth instead of showing "Copied" over a failure:
 *
 *   1. navigator.clipboard.writeText — needs a secure context and a user
 *      gesture, and is absent in several environments a judge may use.
 *   2. a detached textarea + document.execCommand('copy') — deprecated, still
 *      the most widely working path, and needs no permission.
 *   3. select-and-copy — the text is placed in a node and SELECTED for the
 *      user, who presses the copy key themselves. This tier cannot fail for
 *      permission reasons because the user performs the copy.
 *
 * Nothing here throws into the page. Every function returns a settled result.
 *
 * ============================================================================
 * ASSUMED SEAM WITH LANE CORE
 * ----------------------------------------------------------------------------
 * Imports: none. `formatLedger` takes the LedgerEntry array from
 * `SessionState.ledger` (02 sec 1.9 field names: seq, ts, actor, action,
 * manuscript_id, args_digest, outcome, code, visible_fields_at_time, note).
 * The plain-language line is produced by `toRow` from ./activity.js, which is
 * the only import this file would ever want and is injected instead.
 * ============================================================================
 */

export const COPY_MODE = Object.freeze({
  ASYNC_API: 'clipboard-api',
  EXEC_COMMAND: 'exec-command',
  MANUAL_SELECT: 'manual-select',
  UNAVAILABLE: 'unavailable',
});

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

function pad(value, width) {
  const s = String(value === null || value === undefined ? '' : value);
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

/**
 * One ledger row as text, in both registers. The plain line leads; the machine
 * record is indented beneath it, the same relationship the page shows.
 *
 * @param {object} entry     a LedgerEntry
 * @param {object} [options]
 * @param {function} [options.toRow]  activity.toRow, injected
 * @param {boolean}  [options.includeFields]  emit visible_fields_at_time
 */
export function formatLedgerEntry(entry, options) {
  const opts = options || {};
  const e = entry || {};
  const row = typeof opts.toRow === 'function' ? opts.toRow(e) : null;
  const outcome = e.outcome === 'refused' ? 'REFUSED' : 'ACCEPTED';
  const actor = e.actor === 'human' ? 'YOU' : 'AGENT';

  const lines = [];
  const head = '#' + pad(e.seq, 4) + pad(e.ts || '', 26) + pad(actor, 7)
    + pad(e.action || '', 24) + outcome + (e.code ? ' ' + e.code : '');
  lines.push(head.replace(/\s+$/, ''));
  if (row && row.plain) lines.push('      ' + row.plain);
  const detail = [];
  if (e.manuscript_id) detail.push('manuscript=' + e.manuscript_id);
  if (e.note) detail.push('note=' + e.note);
  if (detail.length) lines.push('      ' + detail.join('  '));
  if (opts.includeFields !== false && Array.isArray(e.visible_fields_at_time)) {
    lines.push('      visible_fields_at_time (' + e.visible_fields_at_time.length + '): '
      + e.visible_fields_at_time.join(', '));
  }
  return lines.join('\n');
}

/**
 * The whole ledger as one plain-text artifact. Append-only in, append-only out:
 * rows are emitted in `seq` order and nothing is filtered by default. If the
 * caller passes a filtered subset, the header says so, because an export that
 * silently omits refusals would misrepresent the one artifact the whole
 * submission rests on.
 */
export function formatLedger(entries, options) {
  const opts = options || {};
  const rows = Array.isArray(entries) ? entries.slice() : [];
  rows.sort((a, b) => (a.seq || 0) - (b.seq || 0));

  const accepted = rows.filter((r) => r.outcome !== 'refused').length;
  const refused = rows.length - accepted;
  const agent = rows.filter((r) => r.actor === 'agent').length;

  const header = [];
  header.push('REFEREE — SESSION LEDGER');
  header.push('Exported ' + (opts.exportedAt || new Date().toISOString()));
  if (opts.seedHash) header.push('Seed ' + opts.seedHash);
  header.push(rows.length + ' events — ' + accepted + ' accepted, ' + refused + ' refused'
    + ' — ' + agent + ' by the agent, ' + (rows.length - agent) + ' by the reviewer');
  header.push('A refusal is a settled outcome, not an error. Both are recorded here.');
  if (opts.filtered) {
    header.push('FILTERED VIEW — this is not the complete ledger'
      + (opts.filterLabel ? ' (' + opts.filterLabel + ')' : '') + '.');
  }
  header.push('-'.repeat(72));

  if (!rows.length) {
    header.push('No activity yet. Every tool call the agent makes — accepted or');
    header.push('refused — lands here, with the fields it could see at the time.');
    return header.join('\n') + '\n';
  }

  const body = rows.map((entry) => formatLedgerEntry(entry, opts));
  return header.join('\n') + '\n' + body.join('\n') + '\n';
}

/* -------------------------------------------------------------------------- */
/* Copying                                                                    */
/* -------------------------------------------------------------------------- */

function hasAsyncClipboard(nav) {
  return !!(nav && nav.clipboard && typeof nav.clipboard.writeText === 'function');
}

/**
 * Tier 2. Builds a detached textarea via the DOM API (no markup), selects it,
 * asks the document to copy, and removes it. Returns a boolean, never throws.
 */
export function copyViaExecCommand(text, doc) {
  const d = doc || (typeof document !== 'undefined' ? document : null);
  if (!d || typeof d.createElement !== 'function' || typeof d.execCommand !== 'function') {
    return false;
  }
  let node = null;
  try {
    node = d.createElement('textarea');
    node.value = text;
    node.setAttribute('readonly', 'readonly');
    node.setAttribute('aria-hidden', 'true');
    node.setAttribute('tabindex', '-1');
    // Off-viewport placement, not presentation: execCommand requires the node
    // to be in the document and selectable, and the node is never seen. This
    // is the only geometry this lane sets, and it carries no design decision.
    node.style.position = 'fixed';
    node.style.left = '-9999px';
    d.body.appendChild(node);
    node.select();
    if (typeof node.setSelectionRange === 'function') {
      node.setSelectionRange(0, text.length);
    }
    return d.execCommand('copy') === true;
  } catch (err) {
    return false;
  } finally {
    if (node && node.parentNode) {
      try { node.parentNode.removeChild(node); } catch (err) { void err; }
    }
  }
}

/**
 * Tier 3. Select the text inside an element the page already shows, so the
 * user can copy it with the keyboard. This is the fallback that always works:
 * the user performs the copy, so no permission is involved.
 */
export function selectElementText(el, host) {
  const scope = host || (typeof window !== 'undefined' ? window : null);
  const doc = (el && el.ownerDocument) || (typeof document !== 'undefined' ? document : null);
  if (!el || !doc || !scope || typeof scope.getSelection !== 'function') {
    return { ok: false, reason: 'selection-unavailable' };
  }
  try {
    const range = doc.createRange();
    range.selectNodeContents(el);
    const selection = scope.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    if (typeof el.focus === 'function') el.focus();
    return { ok: true, reason: null };
  } catch (err) {
    return { ok: false, reason: 'selection-threw', error: err };
  }
}

/**
 * Copy text, degrading through the three tiers.
 *
 * @param {string} text
 * @param {object} [options]
 * @param {object} [options.navigator]
 * @param {object} [options.document]
 * @param {object} [options.window]
 * @param {Element} [options.selectTarget]  node whose contents to select in tier 3
 * @returns {Promise<{ok:boolean, mode:string, manual:boolean, error?:Error}>}
 *          Always resolves. Never rejects.
 */
export async function copyText(text, options) {
  const opts = options || {};
  const nav = opts.navigator || (typeof navigator !== 'undefined' ? navigator : null);
  const doc = opts.document || (typeof document !== 'undefined' ? document : null);
  const win = opts.window || (typeof window !== 'undefined' ? window : null);
  const value = text === null || text === undefined ? '' : String(text);

  if (hasAsyncClipboard(nav)) {
    try {
      await nav.clipboard.writeText(value);
      return { ok: true, mode: COPY_MODE.ASYNC_API, manual: false };
    } catch (err) {
      // Denied permission, insecure context, or no user gesture. Fall through.
      void err;
    }
  }

  if (copyViaExecCommand(value, doc)) {
    return { ok: true, mode: COPY_MODE.EXEC_COMMAND, manual: false };
  }

  if (opts.selectTarget) {
    const selected = selectElementText(opts.selectTarget, win);
    if (selected.ok) {
      // Not copied yet — the user finishes the job. The UI must say so.
      return { ok: false, mode: COPY_MODE.MANUAL_SELECT, manual: true };
    }
  }

  return { ok: false, mode: COPY_MODE.UNAVAILABLE, manual: false };
}

/** What the button should say for each outcome. Copy, not markup. */
export const COPY_FEEDBACK = Object.freeze({
  [COPY_MODE.ASYNC_API]: 'Copied',
  [COPY_MODE.EXEC_COMMAND]: 'Copied',
  [COPY_MODE.MANUAL_SELECT]: 'Selected — press your copy key',
  [COPY_MODE.UNAVAILABLE]: "This browser wouldn't let the page copy. Select the text and copy it.",
});

export const FEEDBACK_HOLD_MS = 1600;

/**
 * The ledger export button, end to end. Returns a settled result plus the
 * label the caller should show and for how long.
 *
 * @param {object} options
 * @param {Array}  options.entries
 * @param {function} [options.toRow]
 * @param {Element}  [options.selectTarget]
 */
export async function copyLedger(options) {
  const opts = options || {};
  const text = formatLedger(opts.entries, opts);
  const result = await copyText(text, opts);
  return Object.assign({}, result, {
    text,
    label: COPY_FEEDBACK[result.mode],
    holdMs: FEEDBACK_HOLD_MS,
    bytes: text.length,
  });
}

/**
 * The WebMCP flag URL copy button (05 sec 8.4). chrome:// URLs cannot be
 * linked or opened by script, so this is a copy, not a navigation.
 */
export async function copyFlagUrl(flagUrl, options) {
  const result = await copyText(flagUrl, options);
  return Object.assign({}, result, {
    label: result.ok ? 'Copied' : COPY_FEEDBACK[result.mode],
    holdMs: FEEDBACK_HOLD_MS,
  });
}

/**
 * Region diagnostics (05 sec 8.3 "Copy diagnostics"). Deliberately carries no
 * manuscript text and no ledger content — a diagnostics blob is not an export
 * channel for anything the blinding removes.
 */
export function formatDiagnostics(info) {
  const i = info || {};
  const lines = [
    'REFEREE — PANEL DIAGNOSTICS',
    'at        ' + (i.at || new Date().toISOString()),
    'region    ' + (i.region || 'unknown'),
    'state     ' + (i.state || 'unknown'),
    'message   ' + (i.message || ''),
    'webmcp    ' + (i.webmcpPhase || 'unknown') + ' ' + (i.webmcpCount || ''),
    'storage   ' + (i.storageMode || 'unknown'),
    'ledger    ' + (i.ledgerLength === undefined ? 'unknown' : i.ledgerLength) + ' events',
    'seed      ' + (i.seedHash || 'unknown'),
  ];
  if (i.stack) lines.push('stack', String(i.stack));
  return lines.join('\n') + '\n';
}
