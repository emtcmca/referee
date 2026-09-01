#!/usr/bin/env node
/**
 * selftest-blinding.mjs — proves that check-blinding.mjs can fail.
 *
 * WHY THIS FILE EXISTS
 *   check-blinding.mjs is the evidence for Referee's central claim. A guard that has only ever
 *   been observed passing is indistinguishable from a guard that cannot fail — a regex that
 *   never matches, a walk that visits nothing, a directory list that went stale. This file
 *   builds deliberately-broken trees in a temp directory, runs the real guard against each one,
 *   and asserts the verdict it must produce. If a broken fixture passes, the selftest fails and
 *   the guard's green result on the real tree means nothing.
 *
 *   The clean fixture matters just as much as the broken ones: a guard that fails on everything
 *   is also useless. Falsifiable in both directions or it is not a check.
 *
 * FIXTURES
 *   clean ............................ must PASS (exit 0)
 *   direct-identity-import ........... guarded file imports identity directly       -> exit 1
 *   transitive-identity-import ....... guarded file reaches identity two hops deep  -> exit 1
 *   dynamic-import ................... guarded file uses import( ), benign target   -> exit 1
 *   bare-identity-token .............. author name hardcoded in a string literal    -> exit 1
 *   composition-root-caps-leak ....... identity passed to createCapabilities( )     -> exit 1
 *   composition-root-register-leak ... identity passed to registerAll( )            -> exit 1
 *   no-identity-store ................ nothing to reach; must NOT report a pass     -> exit 2
 *   missing-src ...................... no tree at all; must NOT report a pass       -> exit 2
 *
 * USAGE
 *   node scripts/selftest-blinding.mjs          # build, run, assert, clean up
 *   node scripts/selftest-blinding.mjs --keep   # leave the fixture tree on disk for inspection
 *   node scripts/selftest-blinding.mjs --verbose
 *
 * Zero dependencies. Node 20+. Exits non-zero if any fixture behaves wrongly.
 */

import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const GUARD = join(HERE, 'check-blinding.mjs');
const KEEP = process.argv.includes('--keep');
const VERBOSE = process.argv.includes('--verbose');
const BASE = join(tmpdir(), `referee-blinding-selftest-${process.pid}`);

// ---------------------------------------------------------------------------
// Fixture content. The clean tree is the baseline; each broken case is a patch.
// ---------------------------------------------------------------------------

const CLEAN_TREE = {
  'src/core/constants.js': `
export const SCORE_MIN = 0;
export const SCORE_MAX = 10;
export const MIN_QUOTE_CHARS = 40;
`,
  'src/core/ranking.js': `
import { SCORE_MAX } from './constants.js';
export function composite(scores, weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  let sum = 0;
  for (const [k, w] of Object.entries(weights)) sum += w * (scores[k] ?? SCORE_MAX);
  return sum / total;
}
`,
  'src/core/field-paths.js': `
export const PUBLIC_FIELD_PATHS = Object.freeze(['manuscript.id', 'manuscript.title']);
export const IDENTITY_FIELD_PATHS = Object.freeze(['identity.authors[].name', 'identity.funding']);
export const BLINDED_FIELD_NAMES = Object.freeze(
  [...new Set(IDENTITY_FIELD_PATHS.map((p) => p.replace(/^identity\\./, '').replace(/\\[\\]\\..*$/, '')))]
);
`,
  'src/core/key-belt.js': `
/* 02 §2.5's runtime belt. It checks KEYS, never values — so it has to spell the blinded field
   NAMES, and the guard must permit a bare name string while still catching a name in use. */
export function assertNoIdentityKeys(payload) {
  for (const forbidden of ['authors', 'affiliations', 'funding', 'correspondence_email']) {
    if (Object.prototype.hasOwnProperty.call(payload, forbidden)) {
      throw new Error(\`payload carries key "\${forbidden}"\`);
    }
  }
  return true;
}
`,
  'src/core/key-belt.test.mjs': `
/* A test asserting identity's ABSENCE has to spell the vocabulary to forbid it. Test files are
   excluded from the guard for exactly this reason; this fixture locks that behaviour in. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertNoIdentityKeys } from './key-belt.js';
test('a payload carrying authors, affiliation or orcid_like is rejected', () => {
  assert.throws(() => assertNoIdentityKeys({ authors: [{ affiliation: 'Zembla Polytechnic' }] }));
  assert.equal(typeof assertNoIdentityKeys, 'function');
});
`,
  'src/corpus/manuscripts.public.js': `
/* A content module. Scholarly prose contains the word "authors"; the public STORE must contain
   no authors FIELD. The guard checks the second and permits the first. */
export const MANUSCRIPTS = Object.freeze([
  {
    id: 'MS-101',
    title: 'Tidal Lattice Reconstruction',
    fiction: true,
    sections: [{ id: 'discussion', text: 'A careful reviewer can distinguish what this section measures directly from what the authors merely propose as a mechanism for later study.' }]
  }
]);
`,
  'src/data/public-access.js': `
import { MANUSCRIPTS } from '../corpus/manuscripts.public.js';
export function listManuscripts() { return MANUSCRIPTS; }
`,
  'src/tools/index.js': `
import { listManuscripts } from '../data/public-access.js';
import { composite } from '../core/ranking.js';
export function registerAll(mc, capabilities, options) {
  return listManuscripts().length + (composite({}, {}) * 0) + (options ? 0 : 0) + (capabilities ? 0 : 0);
}
`,
  'src/identity/index.js': `
export const IDENTITIES = Object.freeze([
  { manuscript_id: 'MS-101', authors: [{ name: 'R. Halloway', affiliation: 'Zembla Polytechnic' }] }
]);
export function getIdentity(id) { return IDENTITIES.find((i) => i.manuscript_id === id) ?? null; }
`,
  'src/ui/identity-panel.js': `
import { getIdentity } from '../identity/index.js';
export function renderIdentity(id) { return getIdentity(id); }
`,
  'src/core/capabilities.js': `
export function createCapabilities({ state }) {
  return Object.freeze({ state });
}
`,
  'src/main.js': `
async function optional(path) {
  try { return await import(path); } catch { return null; }
}
async function boot() {
  const state = null;
  const identity = await optional('./identity/index.js');
  const ui = await optional('./ui/identity-panel.js');
  if (ui) ui.renderIdentity('MS-101', identity);
  const tools = await optional('./tools/index.js');
  const caps = await optional('./core/capabilities.js');
  const capabilities = caps?.createCapabilities?.({ state }) ?? null;
  await tools?.registerAll?.(null, capabilities, { signal: null });
}
boot();
`,
};

/** Each case: files to overwrite or add on top of the clean tree, plus files to delete. */
const CASES = [
  {
    name: 'clean',
    expectExit: 0,
    mustContain: ['PASS'],
    mustNotContain: ['FAIL', 'dynamic-import', 'identity-reachable'],
    why: 'the guard must clear a correct tree, including a composition root that uses import( ) on purpose',
    patch: {},
  },
  {
    name: 'direct-identity-import',
    expectExit: 1,
    mustContain: ['FAIL', 'identity-reachable', 'src/tools/index.js', 'src/identity/index.js'],
    why: 'a handler that imports the identity store directly',
    patch: {
      'src/tools/index.js': `
import { listManuscripts } from '../data/public-access.js';
import * as store from '../identity/index.js';
export function registerAll(mc, capabilities) {
  return listManuscripts().length + Object.keys(store).length + (capabilities ? 0 : 0);
}
`,
    },
  },
  {
    name: 'transitive-identity-import',
    expectExit: 1,
    mustContain: [
      'FAIL',
      'identity-reachable',
      'src/tools/index.js  ->  src/core/lookup.js  ->  src/identity/index.js',
    ],
    why: 'identity reached two hops deep — the case a shallow one-file grep would miss',
    patch: {
      'src/core/lookup.js': `
import * as store from '../identity/index.js';
export function lookup(id) { return Object.keys(store).length + id.length; }
`,
      'src/tools/index.js': `
import { listManuscripts } from '../data/public-access.js';
import { lookup } from '../core/lookup.js';
export function registerAll() { return listManuscripts().length + lookup('MS-101'); }
`,
    },
  },
  {
    name: 'dynamic-import',
    expectExit: 1,
    mustContain: ['FAIL', 'dynamic-import', 'src/tools/index.js'],
    why: 'a dynamic import inside the guarded subtree defeats the static walk, whatever it targets',
    patch: {
      'src/tools/index.js': `
import { listManuscripts } from '../data/public-access.js';
export async function registerAll() {
  const mod = await import('../core/ranking.js');
  return listManuscripts().length + (mod ? 1 : 0);
}
`,
    },
  },
  {
    name: 'bare-identity-token',
    expectExit: 1,
    mustContain: ['FAIL', 'identity-token', 'src/core/notes.js'],
    why: 'an author name hardcoded into a string — invisible to a graph walk, which is why check 5 exists',
    patch: {
      'src/core/notes.js': `
export const FOOTER = 'corresponding author: R. Halloway, Zembla Polytechnic';
`,
    },
  },
  {
    name: 'identity-property-access',
    expectExit: 1,
    mustContain: ['FAIL', 'identity-token', 'src/core/leak.js'],
    why: 'a bare field NAME string is permitted, so the permission must not swallow a field name in USE',
    patch: {
      'src/core/leak.js': `
export function names(doc) {
  return doc.authors.map((a) => a.affiliation);
}
`,
    },
  },
  {
    name: 'identity-field-in-public-store',
    expectExit: 1,
    mustContain: ['FAIL', 'identity-field-in-public-store', 'src/corpus/manuscripts.public.js'],
    why: 'prose may say "the authors"; the public store may not carry an authors FIELD (02 §2.2 fact 1)',
    patch: {
      'src/corpus/manuscripts.public.js': `
export const MANUSCRIPTS = Object.freeze([
  {
    id: 'MS-101',
    title: 'Tidal Lattice Reconstruction',
    fiction: true,
    authors: [{ name: 'R. Halloway', affiliation: 'Zembla Polytechnic' }]
  }
]);
`,
    },
  },
  {
    name: 'composition-root-caps-leak',
    expectExit: 1,
    mustContain: ['FAIL', 'identity-in-capabilities', 'src/main.js', 'createCapabilities'],
    why: 'the composition root is exempt from the import rules, so its own rule must be able to fail',
    patch: {
      'src/main.js': `
async function optional(path) {
  try { return await import(path); } catch { return null; }
}
async function boot() {
  const state = null;
  const identity = await optional('./identity/index.js');
  const tools = await optional('./tools/index.js');
  const caps = await optional('./core/capabilities.js');
  const capabilities = caps?.createCapabilities?.({ state, identity }) ?? null;
  await tools?.registerAll?.(null, capabilities, { signal: null });
}
boot();
`,
    },
  },
  {
    name: 'composition-root-register-leak',
    expectExit: 1,
    mustContain: ['FAIL', 'identity-in-capabilities', 'registerAll'],
    why: 'the same leak through the other named call site, reached by a one-hop alias',
    patch: {
      'src/main.js': `
async function optional(path) {
  try { return await import(path); } catch { return null; }
}
async function boot() {
  const state = null;
  const identity = await optional('./identity/index.js');
  const idStore = identity;
  const tools = await optional('./tools/index.js');
  const caps = await optional('./core/capabilities.js');
  const capabilities = caps?.createCapabilities?.({ state }) ?? null;
  await tools?.registerAll?.(null, capabilities, { signal: null, idStore });
}
boot();
`,
    },
  },
  {
    name: 'unresolved-import',
    expectExit: 2,
    mustContain: ['INCOMPLETE', 'resolve to nothing on disk', 'src/tools/index.js'],
    mustNotContain: ['PASS —'],
    why: 'an import the walk cannot follow is a subgraph never inspected, so it must not report a pass',
    patch: {
      'src/tools/index.js': `
import { listManuscripts } from '../data/public-access.js';
import { helper } from './does-not-exist.js';
export function registerAll() { return listManuscripts().length + helper(); }
`,
    },
  },
  {
    name: 'no-identity-store',
    expectExit: 2,
    mustContain: ['INCOMPLETE', 'not measuring anything'],
    mustNotContain: ['PASS —'],
    why: 'with no identity module on disk the reachability check cannot fail, so it must not report a pass',
    patch: {},
    remove: ['src/identity/index.js', 'src/ui/identity-panel.js'],
  },
  {
    name: 'missing-src',
    expectExit: 2,
    mustContain: ['INCOMPLETE', 'src/ does not exist'],
    mustNotContain: ['PASS —'],
    why: 'an empty tree proves nothing and must never be green',
    patch: {},
    removeAll: true,
  },
];

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function writeTree(dir, files) {
  for (const [relPath, content] of Object.entries(files)) {
    const full = join(dir, relPath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content.trimStart(), 'utf8');
  }
}

function buildCase(c) {
  const dir = join(BASE, c.name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  if (!c.removeAll) {
    writeTree(dir, CLEAN_TREE);
    writeTree(dir, c.patch ?? {});
    for (const relPath of c.remove ?? []) rmSync(join(dir, relPath), { force: true });
  }
  return dir;
}

function runGuard(dir) {
  const res = spawnSync(process.execPath, [GUARD, '--root', dir], { encoding: 'utf8' });
  return {
    code: res.status,
    out: `${res.stdout ?? ''}${res.stderr ?? ''}`,
  };
}

function main() {
  if (!existsSync(GUARD)) {
    console.error(`selftest-blinding: guard not found at ${GUARD}`);
    process.exit(2);
  }

  console.log('selftest-blinding — proving check-blinding.mjs can fail');
  console.log(`  guard:    ${GUARD}`);
  console.log(`  fixtures: ${BASE}`);
  console.log('');

  const failures = [];

  for (const c of CASES) {
    const dir = buildCase(c);
    const { code, out } = runGuard(dir);
    const problems = [];

    if (code !== c.expectExit) problems.push(`expected exit ${c.expectExit}, got ${code}`);
    for (const needle of c.mustContain ?? []) {
      if (!out.includes(needle)) problems.push(`output missing required text: ${JSON.stringify(needle)}`);
    }
    for (const needle of c.mustNotContain ?? []) {
      if (out.includes(needle)) problems.push(`output contains forbidden text: ${JSON.stringify(needle)}`);
    }

    const ok = problems.length === 0;
    const label = ok ? 'ok  ' : 'FAIL';
    console.log(`  ${label} ${c.name.padEnd(32)} exit ${code} (expected ${c.expectExit})`);
    console.log(`       ${c.why}`);
    if (!ok) {
      for (const p of problems) console.log(`       -> ${p}`);
      console.log('       --- guard output ---');
      for (const line of out.split('\n')) console.log(`       | ${line}`);
      failures.push(c.name);
    } else if (VERBOSE) {
      for (const line of out.split('\n')) console.log(`       | ${line}`);
    }
  }

  if (!KEEP) rmSync(BASE, { recursive: true, force: true });
  else console.log(`\n  fixtures kept at ${BASE}`);

  console.log('');
  if (failures.length > 0) {
    console.log(`SELFTEST FAILED — ${failures.length} of ${CASES.length} fixture(s) behaved wrongly: ${failures.join(', ')}`);
    console.log('The guard cannot be trusted until this passes. Its green result on the real tree');
    console.log('means nothing while a deliberately-broken fixture slips past it.');
    process.exit(1);
  }
  console.log(`SELFTEST PASSED — ${CASES.length}/${CASES.length} fixtures behaved as required.`);
  console.log('The guard caught every broken tree and cleared the clean one, so it is falsifiable');
  console.log('in both directions.');
  process.exit(0);
}

main();
