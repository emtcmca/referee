import test from 'node:test';
import assert from 'node:assert/strict';

import {
  attrForPhase,
  canRegionTransition,
  canTransition,
  copyForNotice,
  createNoticeQueue,
  createRegionMachine,
  createWebMcpMachine,
  detectModelContext,
  scheduleSkeleton,
  EMPTY_COPY,
  ERROR_COPY,
  MIN_REGISTERING_MS,
  REGION_STATES,
  WEBMCP_ATTR_VALUES,
  WEBMCP_COPY,
  WEBMCP_FLAG_URL,
  WEBMCP_PHASES,
} from './states.js';

/* -- the five phases and the three attribute values ----------------------- */

test('there are exactly five phases and exactly three attribute values', () => {
  assert.deepEqual(WEBMCP_PHASES, ['probing', 'registering', 'live', 'partial', 'unavailable']);
  assert.deepEqual(WEBMCP_ATTR_VALUES, ['connecting', 'active', 'absent']);
});

test('every phase maps onto one of the three written attribute values', () => {
  for (const phase of WEBMCP_PHASES) {
    assert.ok(
      WEBMCP_ATTR_VALUES.includes(attrForPhase(phase, 1)),
      phase + ' produced an attribute value outside the written set',
    );
  }
});

test('the default with no phase at all renders absent, not live', () => {
  assert.equal(attrForPhase(undefined, 0), 'absent');
  assert.equal(attrForPhase('nonsense', 7), 'absent');
});

test('partial with zero registered is absent; partial with some is active', () => {
  assert.equal(attrForPhase('partial', 0), 'absent');
  assert.equal(attrForPhase('partial', 5), 'active');
});

test('the pill never skips ahead: probing cannot jump straight to live', () => {
  assert.equal(canTransition('probing', 'live'), false);
  assert.equal(canTransition('probing', 'registering'), true);
  assert.equal(canTransition('registering', 'live'), true);
  assert.equal(canTransition('live', 'partial'), false, 'live is terminal');
});

test('an illegal transition is reported, not thrown, and keeps the current phase', () => {
  const m = createWebMcpMachine();
  const result = m.apply({ phase: 'live', registered: 7, total: 7 });
  assert.equal(m.phase, 'probing');
  assert.equal(result.changed, false);
  assert.deepEqual(result.rejected, { from: 'probing', to: 'live', reason: 'illegal-transition' });
});

test('the happy path walks probing to registering to live and tracks the counter', () => {
  const seen = [];
  const m = createWebMcpMachine({ onChange: (s) => seen.push(s.phase + ' ' + s.registered) });
  m.apply({ phase: 'registering', registered: 1, total: 7 });
  m.apply({ phase: 'registering', registered: 3, total: 7 });
  m.apply({ phase: 'live', registered: 7, total: 7 });
  assert.deepEqual(seen, ['registering 1', 'registering 3', 'live 7']);
  assert.equal(m.attr, 'active');
});

test('registering is held a minimum 500ms even when registration resolves instantly', () => {
  let clock = 1000;
  const m = createWebMcpMachine({ now: () => clock });
  m.apply({ phase: 'registering', registered: 0, total: 7 });
  assert.equal(m.holdBeforeLive(), MIN_REGISTERING_MS);
  clock += 200;
  assert.equal(m.holdBeforeLive(), 300);
  clock += 400;
  assert.equal(m.holdBeforeLive(), 0);
});

test('partial keeps its failure list and never rounds to unavailable or live', () => {
  const m = createWebMcpMachine();
  m.apply({ phase: 'registering', registered: 5, total: 7 });
  const s = m.apply({ phase: 'partial', registered: 5, total: 7, failed: ['check_claim', 'flag_for_editor'] });
  assert.equal(s.phase, 'partial');
  assert.deepEqual(s.failed, ['check_claim', 'flag_for_editor']);
  assert.equal(s.attr, 'active');
});

test('a malformed webmcp payload is absorbed without throwing', () => {
  const m = createWebMcpMachine();
  assert.doesNotThrow(() => m.apply(null));
  assert.doesNotThrow(() => m.apply({ phase: 42, registered: 'seven' }));
  assert.equal(m.phase, 'probing');
});

test('detectModelContext requires an actual registerTool function', () => {
  assert.equal(detectModelContext(undefined), false);
  assert.equal(detectModelContext({}), false);
  assert.equal(detectModelContext({ modelContext: {} }), false);
  assert.equal(detectModelContext({ modelContext: { registerTool: 'yes' } }), false);
  assert.equal(detectModelContext({ modelContext: { registerTool() {} } }), true);
});

/* -- region states -------------------------------------------------------- */

test('region states are the four this app has', () => {
  assert.deepEqual(REGION_STATES, ['loading', 'empty', 'ready', 'error']);
});

test('a region leaves error only by reloading', () => {
  assert.equal(canRegionTransition('error', 'ready'), false);
  assert.equal(canRegionTransition('error', 'loading'), true);
});

test('one region failing does not move any other region', () => {
  const m = createRegionMachine(['desk.body', 'ledger.log', 'slate.list'], { initial: 'ready' });
  m.fail('ledger.log', new Error('render blew up'));
  assert.equal(m.get('ledger.log'), 'error');
  assert.equal(m.get('desk.body'), 'ready');
  assert.equal(m.get('slate.list'), 'ready');
});

test('an unknown region or state is refused rather than silently accepted', () => {
  const m = createRegionMachine(['desk.body']);
  assert.deepEqual(m.set('nope', 'ready'), { ok: false, reason: 'unknown-region', id: 'nope' });
  assert.equal(m.set('desk.body', 'sideways').reason, 'unknown-state');
});

test('a same-state set is a no-op, not a re-render', () => {
  let changes = 0;
  const m = createRegionMachine(['desk.body'], { initial: 'ready', onChange: () => { changes += 1; } });
  const r = m.set('desk.body', 'ready');
  assert.equal(r.changed, false);
  assert.equal(changes, 0);
});

/* -- copy ----------------------------------------------------------------- */

test('no empty state says nothing here yet, and each one teaches the thesis', () => {
  for (const [key, copy] of Object.entries(EMPTY_COPY)) {
    assert.ok(copy.lead && copy.lead.length > 0, key + ' has no lead line');
    assert.ok(copy.sub && copy.sub.length > 0, key + ' has no second register');
    assert.doesNotMatch(copy.lead, /nothing here yet/i);
    assert.doesNotMatch(copy.sub, /nothing here yet/i);
  }
});

test('the ledger empty state promises that refusals land there too', () => {
  assert.match(EMPTY_COPY.ledger.sub, /accepted or refused/);
});

test('the refused-only findings state keeps its link to the ledger', () => {
  assert.notEqual(EMPTY_COPY['findings.refusedOnly'].action, null);
});

test('storage failure copy tells the reader the page still works', () => {
  assert.match(ERROR_COPY.STORAGE_UNAVAILABLE.sub, /Everything still works/);
  assert.equal(ERROR_COPY.STORAGE_UNAVAILABLE.dismissible, true);
});

test('the region error plate is scoped and offers a way out', () => {
  const plate = ERROR_COPY.REGION_RENDER_FAILED;
  assert.match(plate.sub, /rest of the page is unaffected/);
  assert.deepEqual(plate.actions.map((a) => a.id), ['region.reload', 'region.copyDiagnostics']);
});

/* -- the WebMCP-absent surface -------------------------------------------- */

test('the absent band carries exactly one control, and it copies rather than navigates', () => {
  const band = WEBMCP_COPY.unavailable.band;
  assert.equal(band.action.value, WEBMCP_FLAG_URL);
  assert.equal(band.action.id, 'webmcp.copyFlagUrl');
  assert.equal(Array.isArray(band.action), false);
  assert.equal(band.tone, 'neutral', 'a browser without a flag is not an error');
});

test('the unavailable pill is not styled as a refusal', () => {
  assert.equal(WEBMCP_COPY.unavailable.tone, 'neutral');
  assert.equal(WEBMCP_COPY.partial.tone, 'refuse');
});

test('every phase has pill copy', () => {
  for (const phase of WEBMCP_PHASES) {
    assert.ok(WEBMCP_COPY[phase], 'no copy for phase ' + phase);
    assert.ok(WEBMCP_COPY[phase].pill.length > 0);
  }
});

/* -- boot ----------------------------------------------------------------- */

test('the skeleton is cancelled when boot beats the delay', () => {
  let queued = null;
  let shown = false;
  const cancel = scheduleSkeleton(() => { shown = true; }, {
    setTimer: (fn) => { queued = fn; return 1; },
    clearTimer: () => { queued = null; },
  });
  const result = cancel();
  assert.equal(result.fired, false);
  assert.equal(shown, false);
  assert.equal(queued, null);
});

test('the skeleton shows when boot genuinely has not completed', () => {
  let queued = null;
  let shown = false;
  scheduleSkeleton(() => { shown = true; }, {
    setTimer: (fn) => { queued = fn; return 1; },
    clearTimer: () => {},
  });
  queued();
  assert.equal(shown, true);
});

/* -- notices: what survived the move of persistence into core -------------- */

test('a known notice code from core resolves to reader-facing copy', () => {
  const copy = copyForNotice('STORAGE_UNAVAILABLE');
  assert.match(copy.sub, /Everything still works/);
  assert.equal(copy.unrecognized, undefined);
});

test('an unrecognized notice code still renders a band rather than a blank', () => {
  const copy = copyForNotice('STATE_DISCARDED_SOMETHING_NEW');
  assert.equal(copy.unrecognized, true);
  assert.ok(copy.lead.length > 0);
  assert.match(copy.sub, /STATE_DISCARDED_SOMETHING_NEW/);
  assert.doesNotThrow(() => copyForNotice(undefined));
});

test('a condition core reports twice does not stack two bands', () => {
  const seen = [];
  const q = createNoticeQueue({ onChange: (v) => seen.push(v.length) });
  assert.equal(q.add('STORAGE_UNAVAILABLE').changed, true);
  assert.equal(q.add('STORAGE_UNAVAILABLE').changed, false);
  assert.equal(q.visible().length, 1);
  assert.deepEqual(seen, [1]);
});

test('a dismissed notice stays dismissed for the tab', () => {
  const q = createNoticeQueue();
  q.add('STATE_DISCARDED_CORRUPT');
  assert.equal(q.dismiss('STATE_DISCARDED_CORRUPT').ok, true);
  assert.equal(q.visible().length, 0);
  assert.equal(q.isDismissed('STATE_DISCARDED_CORRUPT'), true);
  q.add('STATE_DISCARDED_CORRUPT');
  assert.equal(q.visible().length, 0, 'a re-report does not resurrect a dismissed band');
});

test('a non-dismissible notice cannot be hidden', () => {
  const q = createNoticeQueue();
  q.add('REGION_RENDER_FAILED');
  assert.deepEqual(q.dismiss('REGION_RENDER_FAILED'), {
    ok: false, reason: 'not-dismissible', code: 'REGION_RENDER_FAILED',
  });
  assert.equal(q.visible().length, 1, 'a silently broken panel is worse than a visible one');
});

test('dismissing a notice that was never raised is refused, not thrown', () => {
  const q = createNoticeQueue();
  assert.equal(q.dismiss('NOPE').reason, 'unknown-notice');
  assert.equal(q.add(null).ok, false);
});

test('two different conditions each get their own band', () => {
  const q = createNoticeQueue();
  q.add('STORAGE_UNAVAILABLE');
  q.add('STATE_DISCARDED_SEED_CHANGED');
  assert.deepEqual(q.visible().map((e) => e.code).sort(), [
    'STATE_DISCARDED_SEED_CHANGED', 'STORAGE_UNAVAILABLE',
  ]);
});
