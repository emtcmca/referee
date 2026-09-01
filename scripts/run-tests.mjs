#!/usr/bin/env node
/**
 * run-tests.mjs — zero-dependency test runner for Referee.
 *
 * ===================== DISCOVERY CONVENTION — WRITE TESTS TO THIS =====================
 * Other lanes are writing tests against this runner right now, so the contract is fixed here
 * and will not move.
 *
 *   1. WHERE.  Two roots are scanned, recursively, at any depth:  src/  and  scripts/
 *              A test may live beside the module it tests. There is no separate tests/ tree.
 *
 *   2. WHAT.   A file is a test file if and only if its name ends in  .test.mjs
 *              Exactly that suffix. Not .test.js, not .spec.mjs, not __tests__/anything.
 *              Examples that ARE discovered:
 *                  src/core/ranking.test.mjs
 *                  src/tools/handlers/assert-finding.test.mjs
 *                  scripts/check-acceptance.test.mjs
 *
 *   3. SKIPPED. These directories are never descended into, at any depth:
 *                  node_modules  .git  dist  build  coverage  fixtures  __fixtures__
 *              plus any directory whose name begins with an underscore. Put throwaway
 *              fixture modules in a fixtures/ directory and they will not be run as tests.
 *
 *   4. HOW.    Files are handed to Node's built-in runner:  node --test <files...>
 *              Write them with node:test and node:assert/strict. Both are in the standard
 *              library — this project has zero dependencies and will never run npm install.
 *
 *                  import { test, describe } from 'node:test';
 *                  import assert from 'node:assert/strict';
 *
 *   5. RULES.  A test file must import cleanly in plain Node with no DOM, no network, and no
 *              build step. If the module under test touches document/localStorage/fetch, the
 *              test supplies its own stub — there is no jsdom here and there will not be one.
 *              Import order is not guaranteed and files may run in the same process, so a test
 *              must not depend on another file having run first.
 *
 *   6. ORDER.  Discovered files are sorted by their posix-style relative path, so a run is
 *              deterministic and two machines list the same files in the same order.
 * =====================================================================================
 *
 * EXIT CODES
 *   0  every discovered test passed
 *   1  at least one test failed, or the runner child exited non-zero
 *   2  no test files were discovered — nothing was verified, so this is not reported as a
 *      pass. Use --allow-empty to make an empty run exit 0 (for a scaffolding commit).
 *
 * USAGE
 *   node scripts/run-tests.mjs                 # discover, run, summarise
 *   node scripts/run-tests.mjs --list          # print what would run and exit
 *   node scripts/run-tests.mjs --allow-empty   # empty discovery is not an error
 *   node scripts/run-tests.mjs --root <dir>    # scan a different project root
 *
 * Zero dependencies. Node 20+.
 */

import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, '..');

const TEST_SUFFIX = '.test.mjs';
const SCAN_ROOTS = ['src', 'scripts'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'fixtures', '__fixtures__']);

function parseArgs(argv) {
  const out = { root: null, list: false, allowEmpty: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') out.root = argv[++i];
    else if (argv[i] === '--list') out.list = true;
    else if (argv[i] === '--allow-empty') out.allowEmpty = true;
  }
  return out;
}

const ARGS = parseArgs(process.argv.slice(2));
const ROOT = resolve(ARGS.root ?? DEFAULT_ROOT);

function rel(absPath) {
  return relative(ROOT, absPath).split('\\').join('/');
}

/** The discovery convention, implemented. Keep this function and the header in step. */
function discover(dirAbs) {
  const found = [];
  if (!existsSync(dirAbs)) return found;
  const stack = [dirAbs];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name) || e.name.startsWith('_')) continue;
        stack.push(p);
      } else if (e.isFile() && e.name.endsWith(TEST_SUFFIX)) {
        found.push(p);
      }
    }
  }
  return found;
}

function main() {
  const files = SCAN_ROOTS
    .flatMap((r) => discover(join(ROOT, r)))
    .map(rel)
    .sort();

  console.log(`run-tests — root ${ROOT}`);
  console.log(`  scanned:    ${SCAN_ROOTS.map((r) => `${r}/`).join('  ')}`);
  console.log(`  convention: **/*${TEST_SUFFIX}  (node:test + node:assert/strict, zero deps)`);
  console.log(`  discovered: ${files.length} file(s)`);
  for (const f of files) console.log(`    - ${f}`);
  console.log('');

  if (ARGS.list) process.exit(0);

  if (files.length === 0) {
    console.log('NO TESTS DISCOVERED — nothing was verified.');
    console.log('A runner that reports success on an empty set launders "untested" into "green",');
    console.log(`so this exits ${ARGS.allowEmpty ? '0 (--allow-empty)' : '2'}. Name test files *${TEST_SUFFIX} under src/ or scripts/.`);
    process.exit(ARGS.allowEmpty ? 0 : 2);
  }

  // One child process for the whole batch. TAP is forced so the summary is parseable on every
  // platform — Node's default reporter switches on TTY, which would make this fragile in CI.
  const res = spawnSync(
    process.execPath,
    ['--test', '--test-reporter=tap', ...files],
    { cwd: ROOT, encoding: 'utf8' },
  );
  const output = `${res.stdout ?? ''}${res.stderr ?? ''}`;
  process.stdout.write(output);

  const readCount = (label) => {
    const m = output.match(new RegExp(`^# ${label} (\\d+)$`, 'm'));
    return m ? Number(m[1]) : null;
  };
  const tests = readCount('tests');
  const pass = readCount('pass');
  const failCount = readCount('fail');
  const skipped = readCount('skipped');

  console.log('');
  console.log('─'.repeat(64));
  console.log(`  files ${files.length}   tests ${tests ?? '?'}   pass ${pass ?? '?'}   fail ${failCount ?? '?'}   skipped ${skipped ?? 0}`);

  const failed = (failCount ?? 0) > 0 || res.status !== 0;
  if (failed) {
    console.log(`  RESULT: FAIL   (runner exit ${res.status})`);
    console.log('─'.repeat(64));
    process.exit(1);
  }
  console.log('  RESULT: PASS');
  console.log('─'.repeat(64));
  process.exit(0);
}

main();
