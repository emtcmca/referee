#!/usr/bin/env node
/**
 * check-acceptance.mjs — the acceptance criteria of 01 §4 (AC-1 … AC-39) as a runnable table.
 *
 * ============================ THE RULE THIS FILE OBEYS ============================
 * A row prints PASS only when something was actually executed that could have printed FAIL.
 * Every other row prints MANUAL, and says why. A PASS that tested nothing is worse than a
 * MANUAL, because MANUAL sends a human to look while a false PASS tells them not to bother —
 * it launders an unverified claim into a green result, which is precisely the failure mode
 * this whole project is arguing against.
 *
 * Most of §4 is observable only on the deployed URL, in Chrome 149+ with the WebMCP flag or in
 * the ChatGPT desktop in-app browser, with an agent driving seven tools. A static Node script
 * cannot see any of that, and pretending otherwise would be the exact defect the submission is
 * built to expose. Those rows are MANUAL and they stay MANUAL.
 *
 * Some rows have a real STATIC SUBSET — a constant, a frozen enum, a file that must exist, a
 * string that must not appear. Those are implemented, and each one prints its narrowed scope
 * beside the verdict so nobody reads the subset as the whole criterion. The residual is named
 * in the row's `residual` field and printed in the manual checklist too, so a criterion that is
 * half-automated still shows up on the human's list for the half that is not.
 * =================================================================================
 *
 * VERDICTS
 *   PASS     the implemented check ran and succeeded (see `scope` for what it covered)
 *   FAIL     the implemented check ran and failed
 *   BLOCKED  the check could not run — the file or export it needs is not on disk yet.
 *            Counted separately and never treated as a pass. Another lane is still building.
 *   MANUAL   no mechanical check exists; a human must observe it
 *
 * EXIT CODES
 *   0  no FAIL rows
 *   1  at least one FAIL row
 *   1  with --strict, also when any row is BLOCKED (use once the build is complete)
 *
 * USAGE
 *   node scripts/check-acceptance.mjs
 *   node scripts/check-acceptance.mjs --strict
 *   node scripts/check-acceptance.mjs --manual     # print only the human checklist
 *   node scripts/check-acceptance.mjs --json
 *
 * Zero dependencies. Node 20+.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, '..');

function parseArgs(argv) {
  const out = { root: null, strict: false, manual: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') out.root = argv[++i];
    else if (argv[i] === '--strict') out.strict = true;
    else if (argv[i] === '--manual') out.manual = true;
    else if (argv[i] === '--json') out.json = true;
  }
  return out;
}

const ARGS = parseArgs(process.argv.slice(2));
const ROOT = resolve(ARGS.root ?? DEFAULT_ROOT);

// ---------------------------------------------------------------------------
// Small helpers. Every one of them degrades to BLOCKED rather than guessing.
// ---------------------------------------------------------------------------

const P = (relPath) => join(ROOT, relPath);
const rel = (absPath) => relative(ROOT, absPath).split('\\').join('/');

function pass(detail, extra = {}) { return { verdict: 'PASS', detail, ...extra }; }
function bad(detail, extra = {}) { return { verdict: 'FAIL', detail, ...extra }; }
function blocked(detail) { return { verdict: 'BLOCKED', detail }; }

function readIfExists(relPath) {
  const p = P(relPath);
  if (!existsSync(p)) return null;
  try { return readFileSync(p, 'utf8'); } catch { return null; }
}

/** First existing path from a candidate list — the tree in flight deviates from 02 §2.1 in
 *  places, and a check that only knows one path silently BLOCKs on a file that does exist. */
function firstExisting(candidates) {
  for (const c of candidates) if (existsSync(P(c))) return c;
  return null;
}

async function importFirst(candidates) {
  const found = firstExisting(candidates);
  if (!found) return { mod: null, path: null, error: `none of ${candidates.join(', ')} exists` };
  try {
    const mod = await import(pathToFileURL(P(found)).href);
    return { mod, path: found, error: null };
  } catch (err) {
    return { mod: null, path: found, error: err?.message ?? String(err) };
  }
}

function walkFiles(relRoot, filterFn) {
  const out = [];
  const start = P(relRoot);
  if (!existsSync(start)) return out;
  const stack = [start];
  const skip = new Set(['node_modules', '.git', 'dist', 'build', 'coverage']);
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (!skip.has(e.name)) stack.push(p); }
      else if (e.isFile() && filterFn(rel(p))) out.push(rel(p));
    }
  }
  return out.sort();
}

function sameSet(actual, expected) {
  const a = [...actual].sort();
  const b = [...expected].sort();
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function lineNumberOf(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === '\n') line++;
  return line;
}

// ---------------------------------------------------------------------------
// Shared expected values, taken from 01 and 02. These are the frozen enums.
// ---------------------------------------------------------------------------

const SEVEN_TOOLS = [
  'get_review_state', 'read_manuscript', 'assert_finding',
  'check_claim', 'request_unblind', 'flag_for_editor', 'submit_recommendation',
];

const NINE_BLINDED_FIELD_NAMES = [
  'authors', 'affiliations', 'funding', 'acknowledgements', 'author_notes',
  'correspondence_email', 'external_links', 'prior_submission_history', 'conflict_of_interest',
];

const EIGHT_SECTION_IDS = [
  'abstract', 'introduction', 'related_work', 'methods',
  'results', 'discussion', 'limitations', 'data_availability',
];

const FOUR_CRITERIA = ['novelty', 'rigor', 'clarity', 'reproducibility'];

const ELEVEN_REFUSAL_CODES = [
  'INVALID_ARGUMENT', 'UNKNOWN_MANUSCRIPT', 'SECTION_NOT_FOUND', 'QUOTE_TOO_SHORT',
  'EVIDENCE_NOT_FOUND', 'INVALID_CRITERION', 'OUT_OF_ORDER', 'ALREADY_COMMITTED',
  'REQUIRES_HUMAN', 'HUMAN_ONLY', 'INTERNAL',
];

const FIVE_HUMAN_VERBS = [
  'set_weights', 'unblind', 'add_note', 'commit_recommendation', 'session_reset',
];

const FOUR_RECOMMENDATIONS = ['accept', 'minor_revision', 'major_revision', 'reject'];

/** 01 §1, marked "verbatim, never reworded". */
const THESIS = 'When a page mediates between an agent and untrusted content, it can enforce things the agent cannot enforce for itself: what it may see, what it may claim, and what it may decide.';

/** 01 §7 build constraint: these verbs may not be used about prompt injection in general. */
const OVERCLAIM_VERBS = /\b(prevents?|prevented|blocks?|blocked|stops?|stopped|solves?|solved)\b/gi;

const CONSTANTS_CANDIDATES = ['src/core/constants.js'];
const FIELD_PATHS_CANDIDATES = ['src/corpus/field-paths.js', 'src/core/field-paths.js'];
const RUBRIC_CANDIDATES = ['src/corpus/rubric.js', 'src/core/rubric.js', 'src/core/constants.js'];
const ENVELOPE_CANDIDATES = ['src/tools/envelope.js', 'src/core/refusals.js', 'src/core/constants.js'];
const PUBLIC_CORPUS_CANDIDATES = ['src/corpus/manuscripts.public.js', 'src/core/corpus.stub.js'];

// ---------------------------------------------------------------------------
// Implemented checks
// ---------------------------------------------------------------------------

/**
 * AC-1's annotation table, restated here on purpose. Reading it out of src/tools/specs.js
 * would compare the build against itself and pass for any table the build happened to hold.
 * These values come from 00 §D3.
 */
const TOOL_ANNOTATIONS = Object.freeze({
  get_review_state:      { readOnlyHint: true,  untrustedContentHint: false },
  read_manuscript:       { readOnlyHint: true,  untrustedContentHint: true  },
  assert_finding:        { readOnlyHint: false, untrustedContentHint: false },
  check_claim:           { readOnlyHint: true,  untrustedContentHint: true  },
  request_unblind:       { readOnlyHint: true,  untrustedContentHint: false },
  flag_for_editor:       { readOnlyHint: false, untrustedContentHint: false },
  submit_recommendation: { readOnlyHint: false, untrustedContentHint: false },
});

/**
 * AC-1, RUNTIME. This was a grep for the seven names as string literals in src/tools/index.js,
 * and it reported FAIL on a correct build: the tool lane split the definitions across
 * src/tools/specs.js and src/tools/handlers/*.js, and index.js composes them, so not one of
 * the seven names appears in it. The check was measuring a file layout, not registration —
 * and the criterion says "register".
 *
 * It is not repaired by widening the grep. It is repaired by doing what the criterion says:
 * boot the same sequence src/main.js boots (corpus installed, adversarial layer wired,
 * capabilities built), hand registerAll a stub modelContext that records every definition it
 * is given, and measure what actually registered. That proves the tools register; a grep only
 * ever proved that a string was in a file.
 *
 * The seven annotation pairs are asserted here too, off the definitions the stub received.
 * They are direct evidence for the WebMCP Leverage criterion and they cost nothing extra
 * once the definitions are in hand.
 *
 * FAILURE MODE, deliberately: a throw, a wrong count, a missing name, an eighth registration,
 * or a wrong annotation is a FAIL naming the specific reason. A module that is not on disk is
 * BLOCKED, which is counted separately and is never a pass. There is no static fallback —
 * degrading to a grep is what produced the false failure this replaced.
 *
 * STILL NOT COVERED, and it stays on the manual checklist: a real Chrome 149+ modelContext.
 * A Node stub is not a browser.
 */
async function checkSevenToolsRegister() {
  // ---- 1. The modules the boot sequence loads. Missing file -> BLOCKED, not a verdict. ---
  const tools = await importFirst(['src/tools/index.js']);
  if (!tools.mod) return blocked(`registration not runnable: ${tools.error}`);
  const caps = await importFirst(['src/core/capabilities.js']);
  if (!caps.mod) return blocked(`registration not runnable: ${caps.error}`);
  const corpusAccess = await importFirst(['src/core/corpus-access.js']);
  if (!corpusAccess.mod) return blocked(`registration not runnable: ${corpusAccess.error}`);
  const publicCorpus = await importFirst(PUBLIC_CORPUS_CANDIDATES);
  if (!publicCorpus.mod) return blocked(`registration not runnable: ${publicCorpus.error}`);
  const verify = await importFirst(['src/verify/index.js']);
  if (!verify.mod) return blocked(`registration not runnable: ${verify.error}`);
  const sanitize = await importFirst(['src/sanitize/index.js']);
  if (!sanitize.mod) return blocked(`registration not runnable: ${sanitize.error}`);

  if (typeof tools.mod.registerAll !== 'function') {
    return bad(`${tools.path} exports no registerAll function — nothing can register`);
  }
  if (typeof caps.mod.createCapabilities !== 'function') {
    return bad(`${caps.path} exports no createCapabilities function — registration has no capability object`);
  }

  // ---- 2. Boot it the way src/main.js does. --------------------------------------------
  const records = publicCorpus.mod.MANUSCRIPTS ?? publicCorpus.mod.CORPUS ?? null;
  let installedCount = null;
  try {
    if (typeof corpusAccess.mod.installCorpus === 'function') {
      installedCount = corpusAccess.mod.installCorpus(records);
    }
  } catch (err) {
    return bad(`installCorpus threw, so registration could not be measured: ${err?.message ?? String(err)}`);
  }

  let adversarialWired = false;
  try {
    adversarialWired = caps.mod.installAdversarialLayer?.({
      verifyQuote: verify.mod.verifyQuote,
      sanitizeManuscript: sanitize.mod.sanitizeManuscript,
      getAgentText: sanitize.mod.getAgentText,
    }) === true;
  } catch (err) {
    return bad(`installAdversarialLayer threw, so registration could not be measured: ${err?.message ?? String(err)}`);
  }

  // ---- 3. A stub modelContext that records every definition it is handed. ---------------
  const seen = [];
  const stub = {
    async registerTool(definition, options) { seen.push({ definition, options }); },
    async getTools() { return seen.map((c) => c?.definition?.name); },
  };

  // registerAll holds module-level "already registered" state; start from a known point so
  // this measures a registration rather than a replay of one.
  if (typeof tools.mod.__resetRegistrationForTests === 'function') {
    tools.mod.__resetRegistrationForTests();
  }

  let count;
  try {
    count = await tools.mod.registerAll(stub, caps.mod.createCapabilities(), {
      normalizeText: sanitize.mod.normalizeText,
    });
  } catch (err) {
    return bad(`registerAll threw: ${err?.message ?? String(err)}`);
  }

  // ---- 4. Measure. Every branch below names the specific reason. ------------------------
  const problems = [];
  const names = seen.map((c) => (typeof c?.definition?.name === 'string' ? c.definition.name : '(unnamed)'));

  if (typeof count !== 'number') {
    problems.push(`registerAll resolved to ${typeof count}, not the registered count`);
  } else if (count !== SEVEN_TOOLS.length) {
    problems.push(`registerAll reports ${count} tool(s) registered, AC-1 requires exactly ${SEVEN_TOOLS.length}`);
  }

  if (seen.length > SEVEN_TOOLS.length) {
    problems.push(`the model context received ${seen.length} registerTool call(s) for ${SEVEN_TOOLS.length} tools — an eighth tool, a duplicate, or an annotation-drop retry`);
  } else if (seen.length < SEVEN_TOOLS.length) {
    problems.push(`the model context received only ${seen.length} registerTool call(s); AC-1 requires all ${SEVEN_TOOLS.length} to be offered`);
  }

  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  if (dupes.length) problems.push(`name(s) registered more than once: ${[...new Set(dupes)].join(', ')}`);

  const missing = SEVEN_TOOLS.filter((t) => !names.includes(t));
  if (missing.length) problems.push(`tool(s) never registered: ${missing.join(', ')}`);

  const extras = names.filter((n) => !SEVEN_TOOLS.includes(n));
  if (extras.length) problems.push(`eighth tool name(s) registered: ${[...new Set(extras)].join(', ')}`);

  const last = typeof tools.mod.getLastRegistration === 'function' ? tools.mod.getLastRegistration() : null;
  if (last && Array.isArray(last.failed) && last.failed.length) {
    problems.push(`registerAll recorded failure(s): ${last.failed.map((f) => `${f.tool} (${f.message})`).join('; ')}`);
  }

  // The annotations pair, read off the definitions the host was actually handed.
  for (const { definition } of seen) {
    const name = definition?.name;
    const want = TOOL_ANNOTATIONS[name];
    if (!want) continue;                    // an unexpected name is already a problem above
    const got = definition?.annotations;
    if (!got || typeof got !== 'object') {
      problems.push(`${name} registered with no annotations object (00 §D3 requires the pair on all seven)`);
      continue;
    }
    if (got.readOnlyHint !== want.readOnlyHint) {
      problems.push(`${name}: readOnlyHint is ${JSON.stringify(got.readOnlyHint)}, 00 §D3 requires ${want.readOnlyHint}`);
    }
    if (got.untrustedContentHint !== want.untrustedContentHint) {
      problems.push(`${name}: untrustedContentHint is ${JSON.stringify(got.untrustedContentHint)}, 00 §D3 requires ${want.untrustedContentHint}`);
    }
  }

  if (problems.length) return bad(problems.join('; '), { extraLines: problems });

  const untrusted = seen
    .filter((c) => c.definition?.annotations?.untrustedContentHint === true)
    .map((c) => c.definition.name)
    .sort();
  return pass(
    `registerAll resolved to ${count} against a stub model context that recorded ${seen.length} ` +
    `registerTool call(s): ${names.join(', ')}. No eighth. All seven carry the D3 annotations ` +
    `pair; untrustedContentHint is true on exactly [${untrusted.join(', ')}]. Booted as main.js ` +
    `does — corpus installed (${installedCount ?? 'n/a'} manuscripts), adversarial layer wired: ${adversarialWired}.`
  );
}

async function checkBlindedFieldNames() {
  const { mod, path, error } = await importFirst(FIELD_PATHS_CANDIDATES);
  if (!mod) return blocked(error);
  const names = mod.BLINDED_FIELD_NAMES;
  if (!Array.isArray(names)) return bad(`${path} exports no BLINDED_FIELD_NAMES array`);
  if (!Object.isFrozen(names)) return bad(`${path}: BLINDED_FIELD_NAMES is not frozen`);
  if (!sameSet(names, NINE_BLINDED_FIELD_NAMES)) {
    return bad(`${path}: BLINDED_FIELD_NAMES is [${names.join(', ')}]; 02 §1.9.1 requires the nine [${NINE_BLINDED_FIELD_NAMES.join(', ')}]`);
  }
  return pass(`${path}: BLINDED_FIELD_NAMES is the frozen nine-name array`);
}

function checkBlindingGuard() {
  const guard = P('scripts/check-blinding.mjs');
  if (!existsSync(guard)) return bad('scripts/check-blinding.mjs does not exist');
  const res = spawnSync(process.execPath, [guard, '--root', ROOT, '--quiet'], { encoding: 'utf8' });
  const out = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim();
  if (res.status === 0) return pass('scripts/check-blinding.mjs exits 0');
  if (res.status === 2) return blocked(`guard reports INCOMPLETE (exit 2): ${out.split('\n').slice(-4).join(' / ')}`);
  return bad(`guard exits ${res.status}`, { extraLines: out.split('\n') });
}

async function checkQuoteFloorAndCode() {
  const { mod, path, error } = await importFirst(CONSTANTS_CANDIDATES);
  if (!mod) return blocked(error);
  const problems = [];
  if (mod.MIN_QUOTE_CHARS !== 40) problems.push(`${path}: MIN_QUOTE_CHARS is ${mod.MIN_QUOTE_CHARS}, 02 §0 requires 40`);
  const env = await importFirst(ENVELOPE_CANDIDATES);
  if (!env.mod) {
    problems.push(`refusal codes not checkable: ${env.error}`);
  } else {
    const codes = env.mod.CODES ?? env.mod.REFUSAL_CODES ?? null;
    const values = codes ? (Array.isArray(codes) ? codes : Object.values(codes)) : [];
    if (!values.includes('QUOTE_TOO_SHORT')) problems.push(`${env.path}: QUOTE_TOO_SHORT missing from the refusal codes`);
    if (values.includes('EVIDENCE_TOO_SHORT')) problems.push(`${env.path}: EVIDENCE_TOO_SHORT is a dead spelling (01 AC-12) and is present`);
  }
  return problems.length ? bad(problems.join('; ')) : pass(`MIN_QUOTE_CHARS === 40 and QUOTE_TOO_SHORT is the live code spelling`);
}

async function checkFuzzyThreshold() {
  const { mod, path, error } = await importFirst(CONSTANTS_CANDIDATES);
  if (!mod) return blocked(error);
  if (mod.FUZZY_THRESHOLD !== 0.92) return bad(`${path}: FUZZY_THRESHOLD is ${mod.FUZZY_THRESHOLD}, 01 AC-13 requires 0.92`);
  return pass(`${path}: FUZZY_THRESHOLD === 0.92`);
}

async function checkRefusalCodeSet() {
  const { mod, path, error } = await importFirst(ENVELOPE_CANDIDATES);
  if (!mod) return blocked(error);
  const codes = mod.CODES ?? mod.REFUSAL_CODES ?? null;
  if (!codes) return bad(`${path} exports neither CODES nor REFUSAL_CODES`);
  const values = Array.isArray(codes) ? codes : Object.values(codes);
  if (!sameSet(values, ELEVEN_REFUSAL_CODES)) {
    const missing = ELEVEN_REFUSAL_CODES.filter((c) => !values.includes(c));
    const extra = values.filter((c) => !ELEVEN_REFUSAL_CODES.includes(c));
    return bad(`${path}: refusal code set differs — missing [${missing.join(', ')}] extra [${extra.join(', ')}]`);
  }
  return pass(`${path}: the frozen eleven refusal codes, exactly`);
}

async function checkHumanOnlyCodes(which) {
  const { mod, path, error } = await importFirst(ENVELOPE_CANDIDATES);
  if (!mod) return blocked(error);
  const codes = mod.CODES ?? mod.REFUSAL_CODES ?? null;
  const values = codes ? (Array.isArray(codes) ? codes : Object.values(codes)) : [];
  if (!values.includes(which)) return bad(`${path}: ${which} is not in the refusal code set`);
  return pass(`${path}: ${which} exists as a refusal code`);
}

/**
 * AC-22's static half. This was first written as a grep for the string 'set_score' anywhere
 * under src/, and it failed on five files — every one of them a comment or an error message
 * SAYING the verb is dead. A dead-vocabulary rule enforced by substring cannot tell a use from
 * a warning about the use, so it is enforced against the enum instead: the closed five-verb
 * list is the executed gate, and that is the thing worth checking.
 */
async function checkHumanVerbEnum() {
  const { mod, path, error } = await importFirst(CONSTANTS_CANDIDATES);
  if (!mod) return blocked(error);
  const verbs = mod.HUMAN_ACTIONS ?? mod.HUMAN_VERBS ?? null;
  if (verbs === undefined || verbs === null) return blocked(`${path} exports no HUMAN_ACTIONS yet`);
  if (!Object.isFrozen(verbs)) return bad(`${path}: HUMAN_ACTIONS is not frozen`);
  const values = Array.isArray(verbs) ? verbs : Object.values(verbs);
  if (values.includes('set_score')) return bad(`${path}: 'set_score' is a live value in HUMAN_ACTIONS; 02 §1.9 E5 declares it dead`);
  if (!sameSet(values, FIVE_HUMAN_VERBS)) {
    return bad(`${path}: HUMAN_ACTIONS is [${values.join(', ')}]; 01 AC-22 requires exactly [${FIVE_HUMAN_VERBS.join(', ')}]`);
  }
  return pass(`${path}: HUMAN_ACTIONS is frozen and holds exactly the five live verbs; 'set_score' is absent`);
}

function checkLedgerAppendOnly() {
  const files = walkFiles('src', (p) => /\.m?js$/.test(p));
  if (files.length === 0) return blocked('src/ holds no JavaScript yet');
  const mutators = [
    /\bledger\s*\.\s*(splice|pop|shift|reverse|sort|fill|copyWithin)\s*\(/,
    /\bledger\s*\[[^\]]+\]\s*=/,
    /\.\s*ledger\s*=\s*(?!\[\s*\]|state|seed|parsed|persisted)/,
  ];
  const hits = [];
  for (const f of files) {
    const src = readIfExists(f) ?? '';
    for (const re of mutators) {
      const m = src.match(re);
      if (m) hits.push(`${f}:${lineNumberOf(src, src.indexOf(m[0]))} (${m[0].trim()})`);
    }
  }
  if (hits.length) return bad(`ledger mutation pattern(s) found: ${hits.join(', ')}`);
  return pass(`no in-place ledger mutation pattern under src/ (${files.length} file(s) scanned)`);
}

async function checkFictionFlags() {
  const { mod, path, error } = await importFirst(PUBLIC_CORPUS_CANDIDATES);
  if (!mod) return blocked(error);
  const records = mod.MANUSCRIPTS ?? mod.CORPUS ?? null;
  if (!Array.isArray(records) || records.length === 0) return blocked(`${path} exports no non-empty MANUSCRIPTS array yet`);
  const badOnes = records.filter((r) => r?.fiction !== true || typeof r?.fiction_label !== 'string' || r.fiction_label.length === 0);
  if (badOnes.length) return bad(`${path}: ${badOnes.length} record(s) lack fiction:true + a fiction_label`);
  return pass(`${path}: all ${records.length} record(s) carry fiction:true and a fiction_label`);
}

/** Files a judge or a browser actually loads. Scope docs, mockups and probes are not shipped. */
function shippedTextFiles() {
  const out = [];
  for (const f of readdirSync(ROOT, { withFileTypes: true })) {
    if (f.isFile() && /\.(html|css|js|mjs)$/.test(f.name)) out.push(f.name);
  }
  out.push(...walkFiles('src', (p) => /\.(html|css|m?js)$/.test(p)));
  return out.sort();
}

const EXTERNAL_REF_RE = /(?:src|href)\s*=\s*["']((?:https?:)?\/\/[^"']+)["']|url\(\s*["']?((?:https?:)?\/\/[^)"']+)/gi;
const EXTERNAL_ALLOW = /(\.invalid(\/|$|["'])|(^|\/\/)(localhost|127\.0\.0\.1)|www\.w3\.org)/i;

function checkNoExternalRefs() {
  const files = shippedTextFiles();
  if (files.length === 0) return blocked('no shipped HTML/CSS/JS found');
  const hits = [];
  for (const f of files) {
    const src = readIfExists(f) ?? '';
    EXTERNAL_REF_RE.lastIndex = 0;
    let m;
    while ((m = EXTERNAL_REF_RE.exec(src)) !== null) {
      const url = m[1] ?? m[2];
      if (EXTERNAL_ALLOW.test(url)) continue;
      hits.push(`${f}:${lineNumberOf(src, m.index)} -> ${url}`);
    }
  }
  if (hits.length) return bad(`external reference(s) in shipped files: ${hits.join('; ')}`, { extraLines: hits });
  return pass(`${files.length} shipped file(s) carry no external src/href/url() reference (.invalid, localhost and w3.org namespaces allowed)`);
}

/**
 * Negations that flip an overclaim into the honesty boundary itself. Without this the check
 * fails on README.md's own rule — "Never claim prompt injection is solved" — which is the
 * sentence 01 §7 exists to require. A ban that fires on the disclaimer is a ban nobody can
 * satisfy.
 *
 * LIMIT, stated: this is a 90-character look-back for a negation word. It can be fooled in both
 * directions — a distant negation, or a sentence that negates something else. It catches the
 * blunt overclaim, which is the one that would actually get written. A human still reads the
 * copy before submission; 01 §8 item 9 makes that a separate gate.
 */
const NEGATION_RE = /\b(never|not|no|nor|cannot|can't|don't|doesn't|isn't|without|un\w+|neither|avoid|refus\w+|claim\w*\s+that)\b/i;

function checkNoOverclaim() {
  const targets = [...shippedTextFiles(), 'README.md'].filter((f) => existsSync(P(f)));
  if (targets.length === 0) return blocked('no shipped files or README to scan');
  const hits = [];
  let negated = 0;
  for (const f of targets) {
    const src = readIfExists(f) ?? '';
    OVERCLAIM_VERBS.lastIndex = 0;
    let m;
    while ((m = OVERCLAIM_VERBS.exec(src)) !== null) {
      const window = src.slice(Math.max(0, m.index - 140), m.index + 140);
      if (!/injection/i.test(window)) continue;
      const lookBack = src.slice(Math.max(0, m.index - 90), m.index);
      if (NEGATION_RE.test(lookBack)) { negated++; continue; }
      hits.push(`${f}:${lineNumberOf(src, m.index)} "${m[0]}" near "injection"`);
    }
  }
  if (hits.length) {
    return bad(`overclaim verb near "injection" (01 §7 bans prevents/blocks/stops/solves about injection in general): ${hits.join('; ')}`, { extraLines: hits });
  }
  return pass(`${targets.length} file(s) scanned; no un-negated prevents/blocks/stops/solves within 140 chars of "injection" (${negated} negated occurrence(s) allowed, e.g. "never claim injection is solved")`);
}

/**
 * Markdown normalization before the comparison: strip blockquote prefixes and bold markers,
 * collapse all whitespace to single spaces. A raw `includes` failed on a README that carries the
 * thesis correctly — hard-wrapped across two lines inside a `> **…**` blockquote. Line wrapping
 * is not a wording change, and a check that calls it one trains people to ignore the check.
 * Every word and its order still has to match exactly.
 */
function normalizeProse(text) {
  return text
    .replace(/^[ \t]*>[ \t]?/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function checkThesisVerbatim() {
  const readme = readIfExists('README.md');
  if (readme === null) return blocked('README.md does not exist');
  if (!normalizeProse(readme).includes(normalizeProse(THESIS))) {
    return bad("README.md does not carry 01 §1's thesis (01 §8 item 5 requires it verbatim; compared with blockquote markers, bold markers and line wrapping normalized away)");
  }
  return pass('README.md carries the thesis, word for word (markdown wrapping normalized)');
}

function checkLicense() {
  const lic = readIfExists('LICENSE');
  if (lic === null) return bad('LICENSE does not exist (01 §8 item 4 requires Apache-2.0)');
  if (!/Apache License/i.test(lic) || !/Version 2\.0/i.test(lic)) {
    return bad('LICENSE exists but does not read as Apache License Version 2.0');
  }
  return pass(`LICENSE present, Apache License Version 2.0 (${lic.length} bytes)`);
}

function checkNoBuildStep() {
  const problems = [];
  if (existsSync(P('node_modules'))) problems.push('node_modules/ is present (01 §8 item 4 forbids it)');
  const pkgRaw = readIfExists('package.json');
  if (pkgRaw !== null) {
    try {
      const pkg = JSON.parse(pkgRaw);
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      if (Object.keys(deps).length > 0) problems.push(`package.json declares ${Object.keys(deps).length} dependency/ies (W10: zero deps, no npm install)`);
    } catch {
      problems.push('package.json is not valid JSON');
    }
  }
  return problems.length ? bad(problems.join('; ')) : pass('no node_modules/, no declared dependencies — the tree runs on plain node');
}

function checkEnvVerificationNote() {
  const candidates = walkFiles('docs', (p) => /\.md$/.test(p))
    .concat(['README.md', 'ENVIRONMENT.md', 'docs/task-0.md', 'TASK-0.md'].filter((f) => existsSync(P(f))));
  const seen = new Set();
  for (const f of candidates) {
    if (seen.has(f)) continue;
    seen.add(f);
    const src = readIfExists(f) ?? '';
    const hasChrome = /Chrome\s*1\d{2}/i.test(src);
    const hasChatGPT = /ChatGPT/i.test(src);
    const hasDate = /\b20\d{2}-\d{2}-\d{2}\b/.test(src);
    const hasCount = /\b(7|seven)\s*tools?\b/i.test(src);
    if (hasChrome && hasChatGPT && hasDate && hasCount) {
      return pass(`${f} names both browsers, a dated entry, and an observed tool count`);
    }
  }
  return blocked('no file found carrying a Chrome version, ChatGPT, a YYYY-MM-DD date and a tool count (AC-39 / Task 0 is blocking)');
}

async function checkFrozenEnum(candidates, exportName, expected, label) {
  const { mod, path, error } = await importFirst(candidates);
  if (!mod) return blocked(error);
  const raw = mod[exportName];
  if (raw === undefined) return blocked(`${path} exports no ${exportName} yet`);
  const values = Array.isArray(raw)
    ? (typeof raw[0] === 'object' && raw[0] !== null ? raw.map((r) => r.id) : raw)
    : Object.values(raw);
  if (!Object.isFrozen(raw)) return bad(`${path}: ${exportName} is not frozen`);
  if (!sameSet(values, expected)) {
    return bad(`${path}: ${exportName} is [${values.join(', ')}]; expected the ${label} [${expected.join(', ')}]`);
  }
  return pass(`${path}: ${exportName} is frozen and holds exactly the ${label}`);
}

// ---------------------------------------------------------------------------
// The table. AC-1 … AC-39 in order, then the structural rows from 01 §8.
// ---------------------------------------------------------------------------

const CRITERIA = [
  { id: 'AC-1', description: 'Exactly seven tools register in Chrome 149+ with the WebMCP flag, with the exact names.',
    automatable: 'partial',
    scope: 'runtime: registerAll() is driven against a recording stub modelContext and must resolve to exactly seven, with exactly the seven names, no eighth registerTool call, and 00 §D3\'s annotations pair on each',
    residual: 'the same registration inside a real Chrome 149+ modelContext with the WebMCP flag, and the enumerated count the browser itself reports',
    check: checkSevenToolsRegister },

  { id: 'AC-2', description: 'The same seven appear in the ChatGPT desktop in-app browser; the F14 chip reads "WebMCP detected · 7 tools" in both.',
    automatable: false, residual: 'two live browsers on the deployed URL' },

  { id: 'AC-3', description: 'Every tool returns a JSON string that parses to an object carrying ok, on valid and invalid calls; nothing throws into the agent.',
    automatable: false, residual: 'requires executing the tools through a model context' },

  { id: 'AC-4', description: 'read_manuscript over all twelve returns zero matches for any identity value.',
    automatable: false, residual: 'requires a live agent surface. NOTE: 01 §4 records that AC-4 mandates the value comparison 02 §2.5 forbids ("the verifier would become the leak"); that conflict is escalated and unresolved, so this row is deliberately not automated.' },

  { id: 'AC-5', description: 'Every get_review_state and read_manuscript payload carries the nine-name BLINDED_FIELD_NAMES byte-identically; the F3 chip renders all nine.',
    automatable: 'partial', scope: 'static: the constant itself is frozen and is exactly the nine names',
    residual: 'that every payload and the rendered chip carry that same array',
    check: checkBlindedFieldNames },

  { id: 'AC-6', description: 'scripts/check-blinding.mjs exits 0 — no guarded module reaches identity, no dynamic import, identity has one importer.',
    automatable: true, scope: 'the whole criterion; this is the build-time check AC-6 names',
    check: checkBlindingGuard },

  { id: 'AC-7', description: 'read_manuscript(M) and get_review_state are byte-identical before and after a human unblind (P4).',
    automatable: false, residual: 'requires performing an unblind and diffing live returns' },

  { id: 'AC-8', description: 'A verbatim quote from the named section is accepted and appears on the findings board with the span highlighted.',
    automatable: false, residual: 'live tool call plus rendered board' },

  { id: 'AC-9', description: 'A fabricated quote is refused EVIDENCE_NOT_FOUND, creates no finding, moves no score.',
    automatable: false, residual: 'live tool call' },

  { id: 'AC-10', description: 'A real quote attributed to the wrong section is refused EVIDENCE_NOT_FOUND.',
    automatable: false, residual: 'live tool call' },

  { id: 'AC-11', description: 'Curly quotes, dashes, NBSP, doubled whitespace, case, and an embedded zero-width character all normalize to an accepted quote.',
    automatable: false, residual: 'exercises the normalizer through the tool; a unit test for it belongs in src/**/*.test.mjs' },

  { id: 'AC-12', description: 'A quote under 40 normalized characters is refused QUOTE_TOO_SHORT, distinguishable from EVIDENCE_NOT_FOUND.',
    automatable: 'partial', scope: 'static: MIN_QUOTE_CHARS === 40 and QUOTE_TOO_SHORT is the live spelling (EVIDENCE_TOO_SHORT absent)',
    residual: 'that the handler actually refuses with it',
    check: checkQuoteFloorAndCode },

  { id: 'AC-13', description: 'A one-or-two-word gap scoring >= 0.92 is accepted via the fuzzy path and badged FUZZY MATCH · score; a paraphrase below threshold is refused.',
    automatable: 'partial', scope: 'static: FUZZY_THRESHOLD === 0.92',
    residual: 'the fuzzy accept/refuse behaviour and the badge',
    check: checkFuzzyThreshold },

  { id: 'AC-14', description: 'Refusal payloads carry no manuscript text, no count derived from a blinded field, and no similarity score.',
    automatable: false, residual: 'inspection of live refusal payloads' },

  { id: 'AC-15', description: 'The three seeded manuscripts neutralize their payloads; MS-102 -> 2 [abstract, discussion], MS-107 -> 1 [related_work], MS-110 -> 1 [data_availability].',
    automatable: false, residual: 'needs the sanitizer over the built corpus — 02 §7.3 assigns this to scripts/check-corpus.mjs, which is not this file' },

  { id: 'AC-16', description: 'The nine clean manuscripts report injection_attempts 0 and empty sections_affected, including the two near-miss decoys.',
    automatable: false, residual: 'same as AC-15 — belongs to check-corpus.mjs' },

  { id: 'AC-17', description: 'No tool return across twelve manuscripts and seven tools contains the raw payload text.',
    automatable: false, residual: 'live tool returns' },

  { id: 'AC-18', description: 'The split-screen shows raw payload against neutralized text with each attempt marked in place.',
    automatable: false, residual: 'rendered UI' },

  { id: 'AC-19', description: 'Sanitization happens at return-assembly: a tool called with no UI mounted still returns cleaned text and a populated integrity block.',
    automatable: false, residual: 'live tool call with the UI unmounted' },

  { id: 'AC-20', description: 'Each of the seven tools, called once, produces exactly one ledger entry per call, refusals included.',
    automatable: false, residual: 'live tool calls' },

  { id: 'AC-21', description: 'Each entry carries actor, timestamp, outcome and visible_fields_at_time.',
    automatable: false, residual: 'live ledger rows' },

  { id: 'AC-22', description: 'Each human-only move appends actor:"human" with an action from the closed five-verb list; set_score is dead.',
    automatable: 'partial', scope: 'static: HUMAN_ACTIONS is frozen and is exactly the five live verbs',
    residual: 'that the four moves write the four live verbs at runtime',
    check: checkHumanVerbEnum },

  { id: 'AC-23', description: 'No code path mutates or deletes an existing ledger entry; ids strictly increase; only reset clears it.',
    automatable: 'partial', scope: 'static: no in-place ledger mutation pattern (splice/pop/shift/reverse/sort/index-assign) under src/',
    residual: 'monotonic ids and reset semantics at runtime',
    check: checkLedgerAppendOnly },

  { id: 'AC-24', description: 'The ledger view renders in call order and copies to the clipboard as text.',
    automatable: false, residual: 'rendered UI plus a clipboard action' },

  { id: 'AC-25', description: 'An agent call to submit_recommendation returns {ok:false, code:"REQUIRES_HUMAN"}, commits nothing, and ledgers actor:"agent".',
    automatable: 'partial', scope: 'static: REQUIRES_HUMAN exists in the frozen refusal code set',
    residual: 'the handler behaviour and the ledger row',
    check: () => checkHumanOnlyCodes('REQUIRES_HUMAN') },

  { id: 'AC-26', description: 'An agent call to request_unblind returns {ok:false, code:"HUMAN_ONLY"}, reveals nothing, and ledgers actor:"agent".',
    automatable: 'partial', scope: 'static: HUMAN_ONLY exists in the frozen refusal code set',
    residual: 'the handler behaviour and the ledger row',
    check: () => checkHumanOnlyCodes('HUMAN_ONLY') },

  { id: 'AC-27', description: 'The human commit control with a verdict and rationale sets committed, locks the control, and appends actor:"human".',
    automatable: false, residual: 'rendered UI plus persisted state' },

  { id: 'AC-28', description: 'After commit, get_review_state reports that manuscript as committed.',
    automatable: false, residual: 'live tool call after a human commit' },

  { id: 'AC-29', description: 'Moving a rubric weight slider re-orders the queue within the same frame, no reload, no recompute button.',
    automatable: false, residual: 'rendered UI' },

  { id: 'AC-30', description: 'Restoring a weight to its prior value restores the exact prior order (P3).',
    automatable: false, residual: 'rendered UI; the determinism of deriveRanking belongs in a unit test' },

  { id: 'AC-31', description: 'Setting one criterion weight to zero removes its contribution, verifiable against a hand-computed value.',
    automatable: false, residual: 'rendered UI; the arithmetic belongs in a unit test' },

  { id: 'AC-32', description: 'Weights survive reload from referee.state.v1.',
    automatable: false, residual: 'browser localStorage across a reload' },

  { id: 'AC-33', description: 'Reset clears referee.state.v1, empties ledger and findings, restores defaults and all twelve manuscripts.',
    automatable: false, residual: 'browser localStorage plus rendered UI' },

  { id: 'AC-34', description: 'After reset the corpus is byte-identical to first load — proof it never round-tripped through localStorage.',
    automatable: false, residual: 'browser state comparison' },

  { id: 'AC-35', description: 'Reset requires one confirmation step.',
    automatable: false, residual: 'rendered UI' },

  { id: 'AC-36', description: 'Every manuscript is visibly labeled fictional in the reader and the queue.',
    automatable: 'partial', scope: 'static: every corpus record carries fiction:true and a non-empty fiction_label',
    residual: 'that the reader and queue actually render the label',
    check: checkFictionFlags },

  { id: 'AC-37', description: 'About panel, README and Devpost carry the honesty boundary byte-identically (= 04 §8), and nothing anywhere claims injection is solved, prevented or blocked in general.',
    automatable: 'partial', scope: 'static: the negative half — no prevents/blocks/stops/solves within 140 chars of "injection" in shipped files or README',
    residual: 'the three-way byte-identical diff against 04 §8. Deliberately not automated: extracting §8 by heuristic and diffing it would produce a green row whose correctness depends on the extraction, and a wrong PASS here is the one failure 01 §6 says cannot be fixed after judging starts. Diff the three surfaces by hand.',
    check: checkNoOverclaim },

  { id: 'AC-38', description: 'A full review session issues zero network requests beyond the initial static assets.',
    automatable: 'partial', scope: 'static: no external src/href/url() reference in any shipped HTML/CSS/JS',
    residual: 'runtime fetch/XHR/WebSocket with the network panel open — a script cannot see those',
    check: checkNoExternalRefs },

  { id: 'AC-39', description: 'Task 0 environment verification is recorded: a dated note naming both browsers, their versions, the deployed URL and the observed tool count.',
    automatable: 'partial', scope: 'static: a repo file carries a Chrome version, ChatGPT, a YYYY-MM-DD date and a tool count',
    residual: 'that the recorded observation is true',
    check: checkEnvVerificationNote },
];

/** 01 §8's structural gates, plus the frozen enums. Not acceptance criteria — labelled so they
 *  are never mistaken for one. */
const STRUCTURAL = [
  { id: 'DOD-4-LICENSE', description: 'Apache-2.0 LICENSE file present (01 §8 item 4).', automatable: true, check: checkLicense },
  { id: 'DOD-4-NOBUILD', description: 'No node_modules, no declared dependencies, no build step (01 §8 item 4, W10).', automatable: true, check: checkNoBuildStep },
  { id: 'DOD-5-THESIS', description: 'README carries 01 §1\'s thesis verbatim (01 §8 item 5).', automatable: true, check: checkThesisVerbatim },
  { id: 'ENUM-SECTION_IDS', description: 'SECTION_IDS is the frozen eight (02 §1.2).', automatable: true,
    check: () => checkFrozenEnum(CONSTANTS_CANDIDATES, 'SECTION_IDS', EIGHT_SECTION_IDS, 'eight section ids') },
  { id: 'ENUM-CRITERIA', description: 'CRITERIA is the frozen four, in order (02 §1.5).', automatable: true,
    check: () => checkFrozenEnum(RUBRIC_CANDIDATES, 'CRITERIA', FOUR_CRITERIA, 'four criterion ids') },
  { id: 'ENUM-REFUSAL_CODES', description: 'The refusal code set is the frozen eleven (02 §1.9 / 03 §1.3).', automatable: true, check: checkRefusalCodeSet },
  { id: 'ENUM-RECOMMENDATION', description: `Recommendation values are the singular four: ${FOUR_RECOMMENDATIONS.join(', ')} (01 P1, 02 §1.11 D5).`,
    // Checked against the exported enum, not by grepping for the dead plural. The grep version
    // failed on src/core/state.test.mjs, whose whole job is to assert that 'minor_revisions' is
    // REJECTED — it has to write the dead spelling to prove the validator refuses it. Same
    // lesson as AC-22: enforce dead vocabulary against the gate, never against the text.
    automatable: 'partial', scope: 'static: the exported RECOMMENDATIONS enum is frozen and is exactly the singular four',
    residual: "that submit_recommendation's inputSchema uses that enum as the executed gate",
    check: () => checkFrozenEnum(CONSTANTS_CANDIDATES, 'RECOMMENDATIONS', FOUR_RECOMMENDATIONS, 'four singular recommendation values') },
];

// ---------------------------------------------------------------------------
// Run and print
// ---------------------------------------------------------------------------

const VERDICT_MARK = { PASS: 'PASS   ', FAIL: 'FAIL   ', BLOCKED: 'BLOCKED', MANUAL: 'MANUAL ' };

async function evaluate(row) {
  if (!row.check) return { ...row, verdict: 'MANUAL', detail: row.residual ?? 'no mechanical check' };
  try {
    const result = await row.check();
    return { ...row, ...result };
  } catch (err) {
    return { ...row, verdict: 'BLOCKED', detail: `check threw: ${err?.message ?? String(err)}` };
  }
}

async function main() {
  const rows = [];
  for (const row of [...CRITERIA, ...STRUCTURAL]) rows.push(await evaluate(row));

  const counts = { PASS: 0, FAIL: 0, BLOCKED: 0, MANUAL: 0 };
  for (const r of rows) counts[r.verdict]++;

  if (ARGS.json) {
    process.stdout.write(JSON.stringify({ root: ROOT, counts, rows: rows.map(({ check, ...r }) => r) }, null, 2) + '\n');
    process.exit(counts.FAIL > 0 || (ARGS.strict && counts.BLOCKED > 0) ? 1 : 0);
  }

  const width = 76;
  if (!ARGS.manual) {
    console.log(`check-acceptance — 01 §4, root ${ROOT}`);
    console.log('='.repeat(width));
    for (const r of rows) {
      if (r.verdict === 'MANUAL') continue;
      console.log(`${VERDICT_MARK[r.verdict]} ${r.id.padEnd(18)} ${r.description.slice(0, width - 28)}`);
      if (r.scope) console.log(`                           scope: ${r.scope}`);
      console.log(`                           ${r.detail}`);
      for (const line of r.extraLines ?? []) console.log(`                             ! ${line}`);
      if (r.residual && r.verdict === 'PASS') console.log(`                           still manual: ${r.residual}`);
      console.log('');
    }
  }

  console.log('MANUAL CHECKLIST — nothing below was verified by this script'.padEnd(width, ' '));
  console.log('-'.repeat(width));
  for (const r of rows) {
    if (r.verdict !== 'MANUAL') continue;
    console.log(`  [ ] ${r.id.padEnd(8)} ${r.description}`);
    console.log(`             why manual: ${r.detail}`);
  }
  console.log('');
  for (const r of rows) {
    if (r.verdict === 'PASS' && r.residual) {
      console.log(`  [ ] ${r.id.padEnd(8)} RESIDUAL — ${r.residual}`);
    }
  }

  console.log('');
  console.log('='.repeat(width));
  const automatable = rows.filter((r) => r.check).length;
  console.log(`  rows ${rows.length}  (AC-1..AC-39 = ${CRITERIA.length}, structural = ${STRUCTURAL.length})`);
  console.log(`  automated ${automatable}   manual-only ${rows.length - automatable}`);
  console.log(`  PASS ${counts.PASS}   FAIL ${counts.FAIL}   BLOCKED ${counts.BLOCKED}   MANUAL ${counts.MANUAL}`);
  console.log('  BLOCKED means the file the check needs is not on disk yet. It is not a pass.');
  console.log('='.repeat(width));

  const failing = counts.FAIL > 0 || (ARGS.strict && counts.BLOCKED > 0);
  process.exit(failing ? 1 : 0);
}

main();
