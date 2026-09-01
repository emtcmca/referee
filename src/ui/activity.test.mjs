import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createActivityFeed,
  createPulse,
  humanToRowInput,
  isError,
  isRefusal,
  settledToRowInput,
  toRow,
  ACTION_PHRASES,
  ACTORS,
  HUMAN_VERBS,
  OUTCOMES,
  PULSE_HOLD_OK_MS,
  PULSE_HOLD_REFUSED_MS,
  REFUSAL_CODES,
  REFUSAL_PHRASES,
  TOOL_NAMES,
} from './activity.js';

// The termination tests at the bottom wire this module to the REAL bus and the
// REAL single writer, because the recursion this file was rewritten for was
// invisible to every test that used a fake one.
import { refereeBus, EVENTS } from '../core/bus.js';
import { appendLedger, bindLedger } from '../core/ledger.js';

/* -- a refusal is a settled outcome, not an error ------------------------- */

test('the outcome enum has exactly two values and neither is an error', () => {
  assert.deepEqual(OUTCOMES, ['accepted', 'refused']);
  assert.equal(OUTCOMES.includes('error'), false);
  assert.equal(OUTCOMES.includes('ok'), false, "'ok' is dead vocabulary on this record");
});

test('the actor domain is closed at agent and human, with no system', () => {
  assert.deepEqual(ACTORS, ['agent', 'human']);
});

test('a refusal is never classified as an error', () => {
  const refused = { ok: false, code: 'EVIDENCE_NOT_FOUND', tool: 'assert_finding', actor: 'agent' };
  assert.equal(isRefusal(refused), true);
  assert.equal(isError(refused), false);
  assert.equal(toRow(settledToRowInput(refused)).refused, true);
});

test('a refused settle renders a row with outcome refused and a code', () => {
  const input = settledToRowInput({
    tool: 'assert_finding',
    actor: 'agent',
    ok: false,
    code: 'EVIDENCE_NOT_FOUND',
    manuscript_id: 'MS-102',
    visible_fields_at_time: ['manuscript.id'],
  });
  assert.equal(input.outcome, 'refused');
  assert.equal(input.code, 'EVIDENCE_NOT_FOUND');
  assert.equal(input.actor, 'agent');
  assert.equal(input.action, 'assert_finding');
  assert.equal('ok' in input, false);
  assert.equal('detail' in input, false);
  assert.equal('integrity' in input, false);
});

test('an accepted settle carries a null code, never an empty string', () => {
  const input = settledToRowInput({ tool: 'read_manuscript', actor: 'agent', ok: true });
  assert.equal(input.outcome, 'accepted');
  assert.equal(input.code, null);
});

test('the feed echoes the seq the ledger stamped and invents none of its own', () => {
  const echoed = settledToRowInput({ name: 'get_review_state', outcome: 'accepted', seq: 99, at: 'T' });
  assert.equal(echoed.seq, 99, 'the row shows the number the writer assigned');
  assert.equal(echoed.ts, 'T');

  const unnumbered = settledToRowInput({ name: 'get_review_state', outcome: 'accepted' });
  assert.equal(unnumbered.seq, null, 'a payload with no seq renders null, never a fabricated one');
  assert.equal(unnumbered.ts, null);
});

test('the settle payload core actually emits renders a named action', () => {
  // core/ledger.js emits {name, call_id, outcome, code, manuscript_id, seq, at}.
  // Reading only the older tool/ok spelling silently produced action: null.
  const input = settledToRowInput({
    name: 'request_unblind',
    call_id: 'seq-4',
    outcome: 'refused',
    code: 'HUMAN_ONLY',
    manuscript_id: 'MS-103',
    seq: 4,
    at: '2026-09-01T14:07:52.118Z',
  });
  assert.equal(input.action, 'request_unblind');
  assert.equal(input.outcome, 'refused');
  assert.equal(input.code, 'HUMAN_ONLY');
  assert.match(toRow(input).plain, /That decision is yours/);
});

/* -- two registers, every event ------------------------------------------- */

test('every row carries a plain line and a machine record together', () => {
  const row = toRow({
    seq: 7,
    ts: '2026-09-01T14:07:52.118Z',
    actor: 'agent',
    action: 'assert_finding',
    outcome: 'refused',
    code: 'EVIDENCE_NOT_FOUND',
    manuscript_id: 'MS-102',
    visible_fields_at_time: ['manuscript.id', 'manuscript.title'],
  });
  assert.ok(row.plain.length > 0);
  assert.equal(row.machine.seq, 7);
  assert.equal(row.machine.code, 'EVIDENCE_NOT_FOUND');
  assert.match(row.plain, /refused/i);
  assert.match(row.plain, /does not appear in the manuscript/);
});

test('the blocked recommendation reads as the human decision it is', () => {
  const row = toRow({ actor: 'agent', action: 'submit_recommendation', outcome: 'refused', code: 'REQUIRES_HUMAN' });
  assert.match(row.plain, /This decision is yours/);
});

test('the blocked unblind reads as the human decision it is', () => {
  const row = toRow({ actor: 'agent', action: 'request_unblind', outcome: 'refused', code: 'HUMAN_ONLY' });
  assert.match(row.plain, /That decision is yours/);
});

test('the screen-reader line is one flat sentence, not the three visible lines', () => {
  const row = toRow({
    seq: 7, ts: '2026-09-01T14:07:52.118Z', actor: 'agent', action: 'assert_finding',
    outcome: 'refused', code: 'EVIDENCE_NOT_FOUND',
    visible_fields_at_time: ['manuscript.id', 'manuscript.title', 'manuscript.abstract'],
  });
  assert.equal(row.sr, 'Agent, assert finding, refused, evidence not found.');
  assert.equal(row.sr.includes('2026-09-01'), false, 'no timestamp in the announcement');
  assert.equal(row.sr.includes('manuscript.abstract'), false, 'no field list in the announcement');
});

test('an accepted row announces without a code', () => {
  assert.equal(
    toRow({ actor: 'human', action: 'unblind', outcome: 'accepted' }).sr,
    'You, unblind, accepted.',
  );
});

test('every tool and every human verb has plain-language phrasing', () => {
  for (const name of [...TOOL_NAMES, ...HUMAN_VERBS]) {
    assert.ok(ACTION_PHRASES[name], 'no phrasing for ' + name);
    assert.ok(ACTION_PHRASES[name].accepted.length > 0);
    assert.ok(ACTION_PHRASES[name].refused.length > 0);
  }
});

test('every refusal code has a plain-language reason', () => {
  for (const code of REFUSAL_CODES) {
    assert.ok(REFUSAL_PHRASES[code], 'no plain-language reason for ' + code);
  }
  assert.deepEqual(Object.keys(REFUSAL_PHRASES).sort(), [...REFUSAL_CODES].sort());
});

test('no plain-language template interpolates content, only enumerated tokens', () => {
  const all = [
    ...Object.values(ACTION_PHRASES).flatMap((p) => [p.accepted, p.refused]),
    ...Object.values(REFUSAL_PHRASES),
  ];
  for (const phrase of all) {
    assert.doesNotMatch(phrase, /\$\{/, 'template literal placeholder in a frozen phrase');
    assert.doesNotMatch(phrase, /%[sd]/, 'printf placeholder in a frozen phrase');
  }
});

test('an unknown action still produces a row rather than throwing', () => {
  const row = toRow({ actor: 'agent', action: 'not_a_tool', outcome: 'refused', code: 'INTERNAL' });
  assert.ok(row.plain.length > 0);
  assert.equal(row.refused, true);
});

test('a human action row is always accepted and always actor human', () => {
  const input = humanToRowInput({ action: 'set_weights', note: 'novelty 30 to 35', seq: 3 });
  assert.equal(input.actor, 'human');
  assert.equal(input.outcome, 'accepted');
  assert.equal(input.code, null);
  assert.equal(input.seq, 3, 'echoed off the row the writer already wrote');
});

/* -- the feed ------------------------------------------------------------- */

function fakeBus() {
  const handlers = new Map();
  return {
    on(name, fn) {
      if (!handlers.has(name)) handlers.set(name, []);
      handlers.get(name).push(fn);
      return () => {
        const list = handlers.get(name) || [];
        const i = list.indexOf(fn);
        if (i !== -1) list.splice(i, 1);
      };
    },
    emit(name, payload) {
      for (const fn of (handlers.get(name) || []).slice()) fn(payload);
    },
    count(name) { return (handlers.get(name) || []).length; },
  };
}

function feedOn(bus, extra) {
  const rows = [];
  const feed = createActivityFeed(Object.assign({
    bus,
    onRow: (row) => rows.push(row),
    setTimer: () => 1,
    clearTimer: () => {},
  }, extra || {}));
  feed.start();
  return { feed, rows };
}

// WHOSE PROPERTY THIS IS NOW. The earlier version of this test asserted that a
// refused settle "reaches the ledger on the same path as a success". Reaching
// the ledger is the TOOL LAYER's job: it calls appendLedger for accepted and
// refused alike, and appendLedger is what emits the event this feed hears. What
// is left to the feed is rendering the two identically, which is what the next
// three tests hold it to.
test('a refusal and a success render the same row shape', () => {
  const bus = fakeBus();
  const { feed, rows } = feedOn(bus);

  bus.emit('tool:settled', {
    name: 'read_manuscript', outcome: 'accepted', code: null, manuscript_id: 'MS-101', seq: 1, at: 'T1',
  });
  bus.emit('tool:settled', {
    name: 'assert_finding', outcome: 'refused', code: 'EVIDENCE_NOT_FOUND', manuscript_id: 'MS-101', seq: 2, at: 'T2',
  });

  const [ok, refused] = rows;
  assert.deepEqual(Object.keys(ok), Object.keys(refused), 'same fields, in the same order');
  assert.deepEqual(Object.keys(ok.machine), Object.keys(refused.machine));
  assert.equal(typeof refused.plain, typeof ok.plain);
  assert.ok(refused.plain.length > 0 && refused.sr.length > 0);
  assert.equal(refused.actorLabel, ok.actorLabel, 'a refusal is still the agent acting');
  assert.equal(refused.manuscriptId, ok.manuscriptId);
  feed.stop();
});

test('a refusal is never styled or classified as an error', () => {
  const bus = fakeBus();
  const { feed, rows } = feedOn(bus);
  bus.emit('tool:settled', { name: 'request_unblind', outcome: 'refused', code: 'HUMAN_ONLY', seq: 1 });

  const row = rows[0];
  assert.equal(row.refused, true, 'refused is a settled-outcome flag, not an error flag');
  assert.equal(isError(row), false);
  assert.ok(OUTCOMES.includes(row.outcome), 'the outcome stays inside the closed enum');
  assert.equal(row.outcomeLabel, 'REFUSED');
  assert.equal('error' in row, false, 'no error field for a renderer to key styling off');
  assert.equal('level' in row, false);
  assert.doesNotMatch(
    JSON.stringify(row), /error|failed|failure/i,
    'no error vocabulary anywhere on the row a renderer could style from',
  );
  feed.stop();
});

test('neither a refusal nor a success is dropped, and the order is kept', () => {
  const bus = fakeBus();
  const { feed, rows } = feedOn(bus);

  bus.emit('tool:settled', { name: 'read_manuscript', outcome: 'accepted', seq: 1 });
  bus.emit('tool:settled', { name: 'assert_finding', outcome: 'refused', code: 'EVIDENCE_NOT_FOUND', seq: 2 });
  bus.emit('tool:settled', { name: 'request_unblind', outcome: 'refused', code: 'HUMAN_ONLY', seq: 3 });
  bus.emit('human:action', { action: 'add_note', seq: 4 });

  assert.equal(rows.length, 4, 'four events, four rows, none dropped');
  assert.deepEqual(rows.map((r) => r.refused), [false, true, true, false]);
  assert.deepEqual(rows.map((r) => r.seq), [1, 2, 3, 4]);
  assert.deepEqual(rows.map((r) => r.actor), ['agent', 'agent', 'agent', 'human']);
  feed.stop();
});

test('the feed holds no writer, and being handed one fails at wiring time', () => {
  assert.throws(
    () => createActivityFeed({ bus: fakeBus(), appendLedger: () => {} }),
    (err) => err instanceof TypeError && /does not write/.test(err.message),
    'a writer must be refused at construction, not suppressed at dispatch',
  );
  // Refused even when it is null: passing the option at all is the wrong model,
  // and the next reader copies what they find.
  assert.throws(() => createActivityFeed({ bus: fakeBus(), appendLedger: null }), TypeError);
});

test('refusal counts drive the findings link without creating a finding', () => {
  const bus = fakeBus();
  let counts = null;
  const { feed } = feedOn(bus, { onRefusalCounts: (c) => { counts = c; } });
  bus.emit('tool:settled', { name: 'assert_finding', outcome: 'refused', code: 'EVIDENCE_NOT_FOUND' });
  bus.emit('tool:settled', { name: 'assert_finding', outcome: 'refused', code: 'QUOTE_TOO_SHORT' });
  assert.deepEqual(counts, { total: 2, byTool: { assert_finding: 2 } });
  feed.stop();
});

test('stop unsubscribes everything it subscribed', () => {
  const bus = fakeBus();
  const { feed } = feedOn(bus);
  assert.equal(bus.count('tool:settled'), 1);
  assert.equal(bus.count('human:action'), 1);
  feed.stop();
  assert.equal(bus.count('tool:settled'), 0);
  assert.equal(bus.count('human:action'), 0);
});

test('a feed with no bus reports it rather than half-starting', () => {
  const feed = createActivityFeed({});
  assert.deepEqual(feed.start(), { ok: false, reason: 'bus-absent' });
});

/* -- termination at the seam ---------------------------------------------- */
/*
 * The regression tests for the defect this file was rewritten for. Everything
 * above uses a fake bus and, before the rewrite, a fake writer — and a fake
 * writer emits nothing, which is exactly why settle -> append -> settle ->
 * append was invisible until something ran. These two wire the REAL refereeBus
 * to the REAL appendLedger with the feed subscribed in between, and assert that
 * one write produces one event and one row.
 *
 * The guard listener is registered BEFORE the feed subscribes, so it sees each
 * emission first and can unsubscribe the feed once the count passes a small
 * threshold. Without it a reintroduced write recurses until the stack dies and
 * the failure reads as a crash somewhere else; with it the run terminates and
 * the assertion names the cause.
 */
const LOOP_THRESHOLD = 5;

function withRealBus(eventName, run) {
  const state = { ledger: [] };
  const rows = [];
  const feed = createActivityFeed({
    bus: refereeBus,
    onRow: (r) => rows.push(r),
    setTimer: () => 1,
    clearTimer: () => {},
  });

  let emissions = 0;
  let cut = false;
  const offGuard = refereeBus.on(eventName, () => {
    emissions += 1;
    if (emissions > LOOP_THRESHOLD && !cut) { cut = true; feed.stop(); }
  });

  feed.start();
  bindLedger(state);   // the boot-time binding the app does, so the one-argument
  try {                // writer form behaves here exactly as it does live
    run(state);
    return { state, rows, emissions: () => emissions, cut: () => cut };
  } finally {
    bindLedger(null);
    offGuard();
    feed.stop();
  }
}

test('a real settle through the real writer terminates: one append, one event, one row', () => {
  const r = withRealBus(EVENTS.TOOL_SETTLED, () => {
    appendLedger({
      actor: 'agent',
      action: 'assert_finding',
      outcome: 'refused',
      code: 'EVIDENCE_NOT_FOUND',
      manuscript_id: null,
    });
  });

  assert.equal(r.cut(), false,
    'the loop guard had to cut in: the feed is writing on the settle path again');
  assert.equal(r.emissions(), 1,
    'one append emitted ' + r.emissions() + ' tool:settled events; more than one is a write in the feed');
  assert.equal(r.state.ledger.length, 1,
    'one append left ' + r.state.ledger.length + ' rows on the log; more than one is a write in the feed');
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].refused, true);
  assert.equal(r.rows[0].seq, 1, 'the row shows the seq the writer assigned');
});

test('a real human action through the real writer terminates the same way', () => {
  // The same cycle exists on the human path under a different event name:
  // appendLedger emits human:action for human rows, and the feed subscribes.
  const r = withRealBus(EVENTS.HUMAN_ACTION, () => {
    appendLedger({
      actor: 'human',
      action: 'add_note',
      outcome: 'accepted',
      code: null,
      manuscript_id: null,
    });
  });

  assert.equal(r.cut(), false,
    'the loop guard had to cut in: the feed is writing on the human:action path again');
  assert.equal(r.emissions(), 1,
    'one append emitted ' + r.emissions() + ' human:action events; more than one is a write in the feed');
  assert.equal(r.state.ledger.length, 1);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].actor, 'human');
});

/* -- the pulse ------------------------------------------------------------ */

test('the pulse holds a refusal longer than a success, deliberately', () => {
  assert.ok(PULSE_HOLD_REFUSED_MS > PULSE_HOLD_OK_MS);
});

test('the pulse never fakes completion while a call is outstanding', () => {
  const timers = [];
  const snapshots = [];
  const pulse = createPulse({
    onChange: (s) => snapshots.push(s),
    setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimer: () => {},
  });
  pulse.invoked({ tool: 'read_manuscript' });
  assert.equal(pulse.snapshot().state, 'invoked');

  // Fire only the still-running timer. Nothing settles it.
  const stillRunning = timers.find((t) => t.ms === 10000);
  assert.ok(stillRunning, 'a still-running notice is scheduled');
  stillRunning.fn();
  assert.equal(pulse.snapshot().state, 'invoked', 'the sweep continues');
  assert.equal(pulse.snapshot().stillRunning, true);
  assert.equal(pulse.snapshot().outcome, null, 'no fabricated outcome');
});

test('the pulse decays back to idle after a settle', () => {
  const timers = [];
  const pulse = createPulse({
    setTimer: (fn) => { timers.push(fn); return timers.length; },
    clearTimer: () => {},
  });
  pulse.invoked({ tool: 'assert_finding' });
  pulse.settled({ tool: 'assert_finding', ok: false, code: 'EVIDENCE_NOT_FOUND' });
  assert.equal(pulse.snapshot().state, 'settled');
  assert.equal(pulse.snapshot().outcome, 'refused');

  timers.pop()();
  assert.equal(pulse.snapshot().state, 'decay');
  timers.pop()();
  assert.equal(pulse.snapshot().state, 'idle');
  assert.equal(pulse.snapshot().label, 'AGENT IDLE');
});
