import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createBinder,
  describeManifest,
  isLegalSelector,
  BINDING_INDEX,
  BINDING_POINTS,
  STABLE_IDS,
  SUBSCRIBED_EVENTS,
} from './bindings.js';
import { BUS_EVENTS } from './activity.js';

/* -- the selector contract ------------------------------------------------ */

test('class selectors and positional selectors are rejected', () => {
  assert.equal(isLegalSelector('.ledger-row'), false);
  assert.equal(isLegalSelector('div.card'), false);
  assert.equal(isLegalSelector('[data-bind="ledger-empty"] > span'), false);
  assert.equal(isLegalSelector('[data-bind="x"]:nth-child(2)'), false);
  assert.equal(isLegalSelector('section [data-bind="x"]'), false);
  assert.equal(isLegalSelector(''), false);
  assert.equal(isLegalSelector(null), false);
});

test('data attribute selectors and the named stable ids are accepted', () => {
  assert.equal(isLegalSelector('[data-bind="ledger-empty"]'), true);
  assert.equal(isLegalSelector('[data-manuscript-id]'), true);
  assert.equal(isLegalSelector('#ledger-log'), true);
  assert.equal(isLegalSelector('#desk-body'), true);
  assert.equal(isLegalSelector('#invented-id'), false, 'only the spec-named ids may be bound');
});

test('every manifest selector satisfies the contract it publishes', () => {
  for (const b of BINDING_POINTS) {
    if (b.selector === ':root') continue;
    assert.ok(isLegalSelector(b.selector), b.id + ' uses an illegal selector: ' + b.selector);
  }
});

test('every id-based binding uses a stable id the spec already names', () => {
  for (const b of BINDING_POINTS) {
    if (b.selector.startsWith('#')) {
      assert.ok(STABLE_IDS.includes(b.selector.slice(1)), b.id + ' binds an unlisted id');
    }
  }
});

/* -- manifest integrity --------------------------------------------------- */

test('binding ids are unique', () => {
  const ids = BINDING_POINTS.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every binding declares what it renders and which events re-render it', () => {
  for (const b of BINDING_POINTS) {
    assert.ok(b.renders && b.renders.length > 0, b.id + ' does not say what it renders');
    assert.ok(Array.isArray(b.events), b.id + ' has no event list');
    assert.ok(['region', 'node', 'list', 'live', 'root', 'control'].includes(b.kind), b.id);
    assert.equal(typeof b.required, 'boolean', b.id);
  }
});

test('every state:changed listener declares which dirty keys concern it', () => {
  for (const b of BINDING_POINTS) {
    if ((b.events || []).includes('state:changed')) {
      assert.ok(
        Array.isArray(b.stateKeys) && b.stateKeys.length > 0,
        b.id + ' listens to state:changed without declaring stateKeys, which is '
          + 'a blanket re-render in disguise',
      );
    }
  }
});

test('every subscribed event is a real name in the bus vocabulary', () => {
  const vocabulary = Object.values(BUS_EVENTS);
  for (const name of SUBSCRIBED_EVENTS) {
    assert.ok(vocabulary.includes(name), name + ' is not in the frozen bus vocabulary');
  }
});

test('the activity stream is a polite live region and the slate status is separate', () => {
  assert.equal(BINDING_INDEX['ledger.log'].aria['aria-live'], 'polite');
  assert.equal(BINDING_INDEX['ledger.log'].aria.role, 'log');
  assert.equal(BINDING_INDEX['ledger.log'].aria['aria-relevant'], 'additions');
  assert.equal(BINDING_INDEX['slate.status'].aria['aria-live'], 'polite');
  assert.equal(BINDING_INDEX['slate.status'].aria.role, 'status');
});

test('there are exactly two assertive live regions in the whole app', () => {
  const assertive = BINDING_POINTS.filter((b) => b.aria && b.aria['aria-live'] === 'assertive');
  assert.deepEqual(
    assertive.map((b) => b.id).sort(),
    ['unblind.announcement', 'verdict.blockedNotice'],
  );
});

test('both scroll regions are focusable so a keyboard user can scroll them', () => {
  assert.equal(BINDING_INDEX['desk.body'].aria.tabindex, '0');
  assert.equal(BINDING_INDEX['ledger.log'].aria.tabindex, '0');
});

test('the manifest describes itself as text for the design handoff', () => {
  const text = describeManifest();
  assert.match(text, /BINDING MANIFEST/);
  assert.match(text, /Never by class name or DOM position/);
  for (const b of BINDING_POINTS) assert.ok(text.includes(b.id), b.id + ' missing from the handoff');
});

/* -- the binder ----------------------------------------------------------- */

function fakeElement(attrs) {
  const store = new Map(Object.entries(attrs || {}));
  return {
    hasAttribute: (n) => store.has(n),
    setAttribute: (n, v) => store.set(n, v),
    getAttribute: (n) => (store.has(n) ? store.get(n) : null),
    attrs: store,
  };
}

function fakeRoot(map) {
  return {
    querySelector: (sel) => (map[sel] === undefined ? null : map[sel]),
    querySelectorAll: () => [],
  };
}

function fakeBus() {
  const handlers = new Map();
  return {
    on(name, fn) {
      if (!handlers.has(name)) handlers.set(name, []);
      handlers.get(name).push(fn);
      return () => {
        const list = handlers.get(name);
        list.splice(list.indexOf(fn), 1);
      };
    },
    emit(name, payload) { for (const fn of (handlers.get(name) || []).slice()) fn(payload); },
    count(name) { return (handlers.get(name) || []).length; },
  };
}

test('the audit names every required binding a design is missing', () => {
  const binder = createBinder({ root: fakeRoot({}) });
  const report = binder.audit();
  assert.equal(report.ok, false);
  assert.equal(report.illegalSelectors.length, 0);
  assert.ok(report.missingRequired.includes('ledger.log'));
  assert.equal(report.total, BINDING_POINTS.length);
});

test('a design that supplies every required selector passes the audit', () => {
  const map = {};
  for (const b of BINDING_POINTS) {
    if (b.required && b.selector !== ':root') map[b.selector] = fakeElement();
  }
  const root = fakeRoot(map);
  root.ownerDocument = { documentElement: fakeElement() };
  const binder = createBinder({ root });
  const report = binder.audit();
  assert.deepEqual(report.missingRequired, []);
  assert.equal(report.ok, true);
});

test('the aria contract is applied programmatically and never overwrites the design', () => {
  const log = fakeElement();
  const status = fakeElement({ role: 'region' });
  const binder = createBinder({
    root: fakeRoot({ '#ledger-log': log, '[data-bind="slate-status"]': status }),
  });
  binder.mount();
  assert.equal(log.getAttribute('aria-live'), 'polite');
  assert.equal(log.getAttribute('role'), 'log');
  assert.equal(status.getAttribute('role'), 'region', 'an author-set attribute wins');
});

test('state:changed re-renders only the regions whose dirty keys match', () => {
  const bus = fakeBus();
  const rendered = [];
  const map = {};
  for (const b of BINDING_POINTS) if (b.selector !== ':root') map[b.selector] = fakeElement();
  const binder = createBinder({ root: fakeRoot(map), bus });
  for (const b of BINDING_POINTS) binder.register(b.id, () => rendered.push(b.id));
  binder.mount();

  bus.emit('state:changed', { keys: ['committed'] });
  // The desk gains its review-closed band and the verdict bar collapses.
  // Nothing else moves — a blanket re-render would clobber ledger scroll
  // position and any in-flight FLIP.
  assert.deepEqual(rendered.sort(), ['desk.body', 'verdict.bar']);
  assert.equal(rendered.includes('ledger.log'), false);
  assert.equal(rendered.includes('slate.list'), false);

  rendered.length = 0;
  bus.emit('state:changed', { keys: ['ledger'] });
  assert.ok(rendered.includes('ledger.log'));
  assert.ok(rendered.includes('findings.list'));
  assert.equal(rendered.includes('slate.list'), false);
});

test('a renderer that throws takes down only its own region', () => {
  const bus = fakeBus();
  const failures = [];
  const rendered = [];
  const map = {};
  for (const b of BINDING_POINTS) if (b.selector !== ':root') map[b.selector] = fakeElement();
  const binder = createBinder({
    root: fakeRoot(map), bus, onRegionError: (id) => failures.push(id),
  });
  binder.register('ledger.log', () => { throw new Error('render blew up'); });
  binder.register('findings.list', () => rendered.push('findings.list'));
  binder.mount();

  assert.doesNotThrow(() => bus.emit('state:changed', { keys: ['ledger'] }));
  assert.deepEqual(failures, ['ledger.log']);
  assert.deepEqual(rendered, ['findings.list'], 'the other region kept working');
});

test('a missing required element is reported, not thrown', () => {
  const binder = createBinder({ root: fakeRoot({}) });
  binder.register('ledger.log', () => {});
  assert.deepEqual(binder.renderOne('ledger.log'), {
    ok: false, reason: 'missing-required-element', id: 'ledger.log',
  });
});

test('registering an unknown binding id is refused', () => {
  const binder = createBinder({ root: fakeRoot({}) });
  assert.equal(binder.register('not.a.binding', () => {}).reason, 'unknown-binding');
});

test('unmount releases every subscription', () => {
  const bus = fakeBus();
  const binder = createBinder({ root: fakeRoot({}), bus });
  binder.mount();
  assert.equal(bus.count('state:changed'), 1);
  binder.unmount();
  assert.equal(bus.count('state:changed'), 0);
});
