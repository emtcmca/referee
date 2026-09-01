/**
 * src/tools/register.test.mjs — the WebMCP surface itself: registration, annotations, and
 * the contingencies 00 §D3–D5 name.
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  registerAll, buildToolDefinitions, detectModelContext, getLastRegistration,
  __resetRegistrationForTests, TOOL_NAMES, ANNOTATION_TABLE
} from './index.js';
import { makeState, makeCaps, fakeNormalize } from './__fixtures__/harness.js';

/** A host double that records exactly how registerTool was called. */
function fakeHost(behaviour = () => {}) {
  const calls = [];
  return {
    calls,
    async registerTool(def, options) {
      calls.push({ def, options });
      behaviour(def, options, calls.length);
    },
    async getTools() { return calls.map((c) => c.def.name); }
  };
}

function rig() {
  const state = makeState();
  const caps = makeCaps(state);
  return { state, caps };
}

beforeEach(() => __resetRegistrationForTests());

// =========================================================================================
describe('the seven definitions', () => {
// =========================================================================================
  test('exactly seven, in 03 §6.1’s order', () => {
    const { state, caps } = rig();
    const defs = buildToolDefinitions(caps, { state });
    assert.deepEqual(defs.map((d) => d.name), [...TOOL_NAMES]);
    assert.equal(defs.length, 7);
  });

  test('every definition carries the four WebMCP keys', () => {
    const { state, caps } = rig();
    for (const def of buildToolDefinitions(caps, { state })) {
      assert.equal(typeof def.name, 'string');
      assert.equal(typeof def.description, 'string');
      assert.equal(def.inputSchema.type, 'object');
      assert.equal(typeof def.execute, 'function');
      assert.equal(def.execute.constructor.name, 'AsyncFunction');
    }
  });

  test('ANNOTATIONS MATCH 00 §D3’s TABLE EXACTLY, on all seven', () => {
    const { state, caps } = rig();
    for (const def of buildToolDefinitions(caps, { state })) {
      assert.ok(def.annotations, `${def.name} has no annotations — D3 says all seven`);
      assert.deepEqual(def.annotations, ANNOTATION_TABLE[def.name], `${def.name}`);
      assert.equal(typeof def.annotations.readOnlyHint, 'boolean');
      assert.equal(typeof def.annotations.untrustedContentHint, 'boolean');
    }
  });

  test('untrustedContentHint is true on exactly the two manuscript-derived returns', () => {
    const { state, caps } = rig();
    const flagged = buildToolDefinitions(caps, { state })
      .filter((d) => d.annotations.untrustedContentHint)
      .map((d) => d.name)
      .sort();
    assert.deepEqual(flagged, ['check_claim', 'read_manuscript']);
  });

  test('every description is under 1024 characters, so a truncating host keeps the constraint',
    () => {
      const { state, caps } = rig();
      for (const def of buildToolDefinitions(caps, { state })) {
        assert.ok(def.description.length < 1024,
          `${def.name} description is ${def.description.length} chars`);
        assert.ok(def.description.length > 200, `${def.name} description is too thin to steer`);
      }
    });

  test('the load-bearing constraint sits in the first two sentences', () => {
    const { state, caps } = rig();
    const opener = (d) => d.description.split(/(?<=\.)\s+/).slice(0, 2).join(' ');
    const defs = buildToolDefinitions(caps, { state });
    const byName = Object.fromEntries(defs.map((d) => [d.name, opener(d)]));
    assert.match(byName.submit_recommendation, /Do not call this expecting it to work/);
    assert.match(byName.request_unblind, /will not\s+succeed/);
    assert.match(byName.read_manuscript, /before making any claim/);
    assert.match(byName.assert_finding, /evidence-backed finding/);
    assert.match(byName.check_claim, /WITHOUT recording anything/);
  });

  test('the schemas are built from the frozen vocabulary, never re-declared', () => {
    const { state, caps } = rig();
    const defs = buildToolDefinitions(caps, { state });
    const af = defs.find((d) => d.name === 'assert_finding');
    assert.deepEqual(af.inputSchema.properties.criterion.enum, [...caps.CRITERIA]);
    assert.deepEqual(af.inputSchema.properties.section.enum, [...caps.SECTION_IDS]);
    assert.deepEqual(af.inputSchema.properties.manuscript_id.enum, [...caps.MANUSCRIPT_IDS]);
    assert.equal(af.inputSchema.properties.score.maximum, 10, 'the scale is 0–10 (02 §3.1)');
    assert.equal(af.inputSchema.properties.evidence_quote.minLength, 40);
  });
});

// =========================================================================================
describe('registerAll — 00 §D4 and §D5', () => {
// =========================================================================================
  test('registers all seven, awaited, two arguments, one shared signal', async () => {
    const { state, caps } = rig();
    const host = fakeHost();
    const controller = new AbortController();

    const count = await registerAll(host, caps, {
      state, signal: controller.signal, normalizeText: fakeNormalize
    });

    assert.equal(count, 7);
    assert.equal(host.calls.length, 7);
    for (const c of host.calls) {
      assert.equal(c.options.signal, controller.signal, 'one AbortController for the whole set');
      assert.equal(c.options.exposedTo, undefined, 'D4: never use exposedTo — single origin');
      assert.equal(Object.keys(c.options).length, 1);
    }
    assert.deepEqual(host.calls.map((c) => c.def.name), [...TOOL_NAMES]);
  });

  test('returns a NUMBER, because the composition root prints it into the status band',
    async () => {
      const { state, caps } = rig();
      const n = await registerAll(fakeHost(), caps, { state });
      assert.equal(typeof n, 'number');
      assert.equal(`${n} agent tools registered.`, '7 agent tools registered.');
    });

  test('a second call is idempotent and reports what ACTUALLY registered', async () => {
    const { state, caps } = rig();
    const host = fakeHost();
    await registerAll(host, caps, { state });
    const again = await registerAll(host, caps, { state });
    assert.equal(again, 7);
    assert.equal(host.calls.length, 7, 'no phantom duplicate registration');
    assert.equal(getLastRegistration().already, true);
  });

  test('D3 contingency — a host that rejects `annotations` gets a retry WITHOUT them', async () => {
    const { state, caps } = rig();
    let firstTry = true;
    const host = fakeHost((def) => {
      if (def.annotations && firstTry) { firstTry = false; throw new Error('unknown key: annotations'); }
    });

    const count = await registerAll(host, caps, { state });

    assert.equal(count, 7, 'annotations are dropped, registration never fails');
    const retried = host.calls[1];
    assert.equal(retried.def.name, 'get_review_state');
    assert.equal(retried.def.annotations, undefined);
    assert.equal(getLastRegistration().annotationsAccepted, false);
  });

  test('one tool failing permanently does not take the other six down', async () => {
    const { state, caps } = rig();
    const host = fakeHost((def) => {
      if (def.name === 'check_claim') throw new Error('host refused this tool');
    });

    const count = await registerAll(host, caps, { state });

    assert.equal(count, 6);
    const last = getLastRegistration();
    assert.equal(last.failed.length, 1);
    assert.equal(last.failed[0].tool, 'check_claim');
    assert.ok(!last.tools.includes('check_claim'));
    assert.ok(last.tools.includes('assert_finding'), 'the evidence gate still registered');
  });

  test('zero registrations degrade to the absent surface rather than throwing', async () => {
    const { state, caps } = rig();
    const host = fakeHost(() => { throw new Error('no'); });
    const count = await registerAll(host, caps, { state });
    assert.equal(count, 0);
    assert.equal(getLastRegistration().registered, 0);
  });

  test('no model context at all returns 0 and reports absent', async () => {
    const { state, caps } = rig();
    assert.equal(await registerAll(null, caps, { state }), 0);
    assert.equal(getLastRegistration().present, false);
  });

  test('detectModelContext reports absent in Node, where neither surface exists', () => {
    const det = detectModelContext();
    assert.equal(det.present, false);
    assert.equal(det.ctx, null);
  });

  test('a registered definition is callable and returns a JSON string end to end', async () => {
    const { state, caps } = rig();
    const host = fakeHost();
    await registerAll(host, caps, { state, normalizeText: fakeNormalize });
    const def = host.calls.find((c) => c.def.name === 'get_review_state').def;
    const raw = await def.execute({}, { signal: new AbortController().signal });
    assert.equal(typeof raw, 'string');
    assert.equal(JSON.parse(raw).ok, true);
  });
});
