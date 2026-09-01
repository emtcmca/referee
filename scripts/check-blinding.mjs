#!/usr/bin/env node
/**
 * check-blinding.mjs — the import-graph guard for Referee's structural-blinding claim.
 *
 * WHAT IT CHECKS (02 §2.4, 01 AC-6)
 *   1. Roots: every .js/.mjs file under src/, EXCLUDING src/ui/, src/identity/ and src/main.js,
 *      and excluding the identity modules themselves (they are the target, not a root).
 *   2. Walks each root's transitive STATIC import graph.
 *   3. FAIL if any reachable module is part of the identity store. Reports the offending root
 *      AND the full import chain, because a guard whose failure output does not tell you where
 *      to look is half a guard.
 *   4. FAIL if any guarded file contains a dynamic `import(` — any target. A dynamic import
 *      defeats a static walk, so the walk is only worth anything if dynamic import is banned.
 *   5. FAIL if any guarded file's source (comments stripped, STRING LITERALS KEPT) matches the
 *      identity token set. This catches the shape a graph walk cannot see: an author name or an
 *      affiliation hardcoded into a string.
 *   6. Tree-wide: every static importer of the identity layer is inside src/ui/ or is the
 *      composition root. Where the 02 §2.1 layout is present, the stricter form applies —
 *      data/identity-access.js has exactly one importer and it is src/ui/identity-panel.js.
 *   7. THE COMPOSITION ROOT (src/main.js) — see the exception below.
 *
 * THE COMPOSITION-ROOT EXCEPTION — a deliberate hole, checked by a narrower rule
 *   src/main.js wires the UI (which legitimately imports identity, because the human is allowed
 *   to see authors) to core and tools (which must never reach it). Something has to see both
 *   sides in order to keep them apart, so the composition root cannot obey the rule it exists to
 *   enforce. It is therefore excluded from checks 1-5, including the dynamic-import ban — it
 *   loads late-landing modules with import() on purpose, and that ban exists to protect the
 *   static walk INSIDE the guarded subtree, which main.js is not in.
 *
 *   In place of the general rule it gets a narrower and stricter one:
 *
 *       Identity must never be passed into the capability object handed to the tool layer.
 *
 *   Check 7 collects every binding in main.js that holds an identity module — static import,
 *   dynamic import, or a one-hop alias of either — and fails if any of them appears in the
 *   arguments to createCapabilities(...) or registerAll(...).
 *
 *   Limit of check 7, stated plainly: it is a scoped pattern match over two named call sites,
 *   not a proof. It reads the argument text of those calls and looks for identity bindings by
 *   name. It does not track a binding through a helper function, an object built several
 *   statements earlier and mutated, a computed property, or a rename it cannot see. It catches
 *   the obvious regression — someone adding `identity` to the capabilities call — which is the
 *   regression that would actually happen. It does not certify the composition root.
 *
 * ============================ HONEST LIMIT — READ THIS ============================
 * JavaScript has no module-level access control. There is no `private`, no sealed package, no
 * capability the language withholds. A handler under src/tools/ CAN reach the identity store —
 * nothing in the runtime stops it. What this script enforces is a SEAM BY CONVENTION PLUS CHECK:
 * the convention is "no module outside src/ui/ and the composition root names the identity
 * store", and this file is the check that fails the build when the convention is broken. That is
 * enforcement at the boundary, NOT a language guarantee, and the write-up must say so in those
 * words.
 *
 * The check is also only as good as its parser. Specific things it does not see:
 *   - A specifier assembled at runtime. Dynamic import is banned outright in the guarded subtree
 *     precisely because of this, but the ban is itself a regex, not a semantic analysis.
 *   - Identity data arriving by any path other than a static ES import — a global, an inline
 *     literal that does not match the token set, a fetch (banned elsewhere by 01 AC-38).
 *   - src/ui/, src/identity/ and src/main.js are not walked. The claim is "identity is reachable
 *     only from the UI layer and the composition root", not "the UI is blind".
 *   - Import specifiers are matched with regexes, not an AST. A pathological formatting of an
 *     import statement could be missed.
 * A guard that overstates its reach is worse than no guard, so: this proves the import graph is
 * clean, the guarded source carries no identity vocabulary, and the two named composition-root
 * call sites do not receive identity. It proves nothing else.
 * =================================================================================
 *
 * EXIT CODES — note that 2 exists so the guard cannot pass vacuously.
 *   0  PASS       — preconditions met, every check ran, no violation.
 *   1  FAIL       — at least one violation. Offending file:line and import chain are printed.
 *   2  INCOMPLETE — preconditions absent (no src/, no guarded files, or no identity store on
 *                   disk yet). Nothing was proved. AC-6 requires exit 0, so a half-built tree
 *                   can never be reported as a pass.
 *
 * USAGE
 *   node scripts/check-blinding.mjs                # project root inferred from this file
 *   node scripts/check-blinding.mjs --root <dir>   # point at any tree containing src/
 *   node scripts/check-blinding.mjs --json         # machine-readable report on stdout
 *
 * Zero dependencies. Node 20+. Never needs npm install.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Configuration — every path is repo-relative and posix-separated for display.
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, '..');

/** The composition root: excluded from checks 1-5, subject to check 7 instead. */
const COMPOSITION_ROOT = 'src/main.js';

/** Directories under src/ that are not walked as roots. */
const EXCLUDED_PREFIXES = ['src/ui/', 'src/identity/'];
const EXCLUDED_FILES = new Set([COMPOSITION_ROOT]);

/**
 * Test files are excluded, and the reason is not convenience.
 *
 * A *.test.mjs file is never loaded by the page — it is not in the shipped import graph, so
 * excluding it removes nothing from the coverage of code the agent can reach. And the tests
 * that matter most here are the ones asserting identity's ABSENCE: src/core/state.test.mjs
 * asserts `CAPABILITIES.getIdentity === undefined` and that no capability key matches
 * /author|affiliation|orcid|funding/. Those tests have to spell the vocabulary in order to
 * forbid it. A guard that fails them would make the anti-identity assertions untestable, which
 * is a worse outcome than the vocabulary appearing in a file that never ships.
 *
 * The count of excluded test files is printed on every run, so this exemption is visible in the
 * output rather than silent.
 */
const TEST_FILE_RE = /\.test\.m?js$/;

/** The identity layer. Two shapes are recognised because the tree in flight uses a directory
 *  (src/identity/) while 02 §2.1 names two specific modules. Both are treated as identity. */
const IDENTITY_DIR_PREFIXES = ['src/identity/'];
const IDENTITY_STORE = 'src/corpus/manuscripts.identity.js';
const IDENTITY_ACCESSOR = 'src/data/identity-access.js';
const IDENTITY_NAMED_MODULES = [IDENTITY_STORE, IDENTITY_ACCESSOR];

/** 02 §2.2's chain, when that layout is present. */
const SOLE_ACCESSOR_IMPORTER = 'src/ui/identity-panel.js';

/** Who may name identity at all: the UI layer and the composition root. */
function isPermittedIdentityImporter(relPath) {
  return relPath.startsWith('src/ui/') || relPath === COMPOSITION_ROOT;
}

/** 02 §2.4 step 5's token set, widened from exact words to word-prefixes so that
 *  `acknowledgements`, `author_notes`, `affiliations`, `correspondence_email` and `orcid_like`
 *  are all caught. A guard should over-reach on vocabulary, not under-reach. */
const IDENTITY_TOKEN_RE = /\b(getIdentity|IDENTITIES|author|affiliation|acknowledg|funding|correspond|orcid)\w*/gi;

/** A field-paths module is a list of field-path NAMES with no values, and it necessarily spells
 *  `identity.authors[].name`. It is exempt from the token scan — but the exemption is narrowed
 *  rather than blanket: every string literal in it must be a field path, so a value smuggled in
 *  fails a different check. Both the 02 §2.1 path and the in-flight path are recognised. */
const TOKEN_EXEMPT_FILES = new Set(['src/corpus/field-paths.js', 'src/core/field-paths.js']);
const FIELD_PATH_PREFIX_RE = /^(manuscript|identity|session)\./;

/**
 * A string literal whose ENTIRE content is a known identity field NAME is permitted, because
 * naming a blinded field is not reading one — 02 §2.5's runtime belt is a list of forbidden KEYS
 * (`['authors','affiliations','funding','correspondence_email']`) and it has to spell them to
 * check for them. A token anywhere else still fails: as a property access (`doc.authors`), as an
 * identifier, or inside a longer string (`'corresponding author: R. Halloway'`), which is the
 * hardcoded-value shape check 5 exists to catch.
 *
 * The hole this leaves, stated: `doc['authors']` would pass. It reads a key that does not exist
 * on a public record, and any module that actually holds identity is caught by check 3, so the
 * hole is narrow — but it is a hole, not an absence of one.
 */
const ALLOWED_IDENTITY_NAME_STRINGS = new Set([
  'authors', 'affiliations', 'funding', 'acknowledgements', 'author_notes',
  'correspondence_email', 'external_links', 'prior_submission_history', 'conflict_of_interest',
  'affiliation', 'is_corresponding', 'orcid_like',
]);

/**
 * CONTENT MODULES get a sharper rule than the token scan, not a weaker one.
 *
 * 02 §2.4 aims check 5 at "a handler that hardcodes an author name into a string". A handler.
 * The public corpus module is not a handler — it is twelve fictional papers, and scholarly prose
 * contains the word "authors" the way it contains the word "results" ("...what the authors
 * merely propose as a mechanism for later study"). Failing on that would make the corpus
 * unwritable, and exempting the file outright would drop the check that matters most for it.
 *
 * So for a content module the rule becomes 02 §2.2 fact 1 directly: THE PUBLIC STORE HAS NO
 * IDENTITY FIELDS. Identity vocabulary in property-key position fails; `IDENTITIES` and
 * `getIdentity` fail anywhere; the same words in prose do not.
 *
 * Limit: a fictional author name written into prose ("by R. Halloway") is not caught here, and
 * would not have been caught by the token scan either — neither rule matches names. What the
 * import graph guarantees is that the public store never JOINS to the identity record; that a
 * corpus author does not paste a name into the body text is 02 §7's authoring discipline and
 * scripts/check-corpus.mjs's business, not this file's.
 */
const CONTENT_MODULES = new Set(['src/corpus/manuscripts.public.js']);
const IDENTITY_FIELD_KEY_RE = /\b(authors|affiliations?|funding|acknowledgements|author_notes|correspondence_email|external_links|prior_submission_history|conflict_of_interest|orcid_like|is_corresponding)\s*:/gi;
const IDENTITY_HARD_TOKEN_RE = /\b(getIdentity|IDENTITIES)\b/g;

/** Check 7's two call sites and the argument shape it inspects. */
const CAPABILITY_CALL_SITES = ['createCapabilities', 'registerAll'];

const SOURCE_EXT_RE = /\.m?js$/;
const SKIP_DIR_NAMES = new Set(['node_modules', '.git', 'dist', 'build', 'coverage']);

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { root: null, json: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') out.root = argv[++i];
    else if (argv[i] === '--json') out.json = true;
    else if (argv[i] === '--quiet') out.quiet = true;
  }
  return out;
}

const ARGS = parseArgs(process.argv.slice(2));
const ROOT = resolve(ARGS.root ?? DEFAULT_ROOT);
const SRC = join(ROOT, 'src');

function rel(absPath) {
  return relative(ROOT, absPath).split('\\').join('/');
}
function abs(relPath) {
  return join(ROOT, relPath);
}
function isIdentityModule(relPath) {
  return IDENTITY_DIR_PREFIXES.some((p) => relPath.startsWith(p)) || IDENTITY_NAMED_MODULES.includes(relPath);
}

// ---------------------------------------------------------------------------
// Source scanning helpers
// ---------------------------------------------------------------------------

function listSourceFiles(dirAbs) {
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
        if (!SKIP_DIR_NAMES.has(e.name)) stack.push(p);
      } else if (e.isFile() && SOURCE_EXT_RE.test(e.name)) {
        found.push(p);
      }
    }
  }
  return found.sort();
}

/**
 * Blanks out comments while preserving every byte offset and every newline, so a match offset
 * still maps to the right line. STRING AND TEMPLATE LITERALS ARE PRESERVED — a hardcoded author
 * name lives in a string, and check 5 exists to find exactly that.
 *
 * Regex literals are detected heuristically (by the previous significant character) only so a
 * `/` inside one is not mistaken for a comment start. Not an AST; documented as such above.
 */
function stripComments(src) {
  const out = src.split('');
  let i = 0;
  let prev = '';
  const regexStartChars = '(,=:[!&|?{};+-*%~^<>';
  while (i < src.length) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === '/' && c2 === '/') {
      while (i < src.length && src[i] !== '\n') { out[i] = ' '; i++; }
      continue;
    }
    if (c === '/' && c2 === '*') {
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] !== '\n') out[i] = ' ';
        i++;
      }
      if (i < src.length) { out[i] = ' '; out[i + 1] = ' '; i += 2; }
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      i++;
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === c) { i++; break; }
        i++;
      }
      prev = c;
      continue;
    }
    if (c === '/' && (prev === '' || regexStartChars.includes(prev))) {
      i++;
      let inClass = false;
      while (i < src.length && src[i] !== '\n') {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '[') inClass = true;
        else if (src[i] === ']') inClass = false;
        else if (src[i] === '/' && !inClass) { i++; break; }
        i++;
      }
      prev = '/';
      continue;
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out.join('');
}

function lineOf(src, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < src.length; i++) if (src[i] === '\n') line++;
  return line;
}

/** Static import/export specifiers: `import ... from 'x'`, `export ... from 'x'`, `import 'x'`. */
const SPECIFIER_PATTERNS = [
  /(?:^|\n)\s*import[^\n;]*?\sfrom\s*['"]([^'"]+)['"]/g,
  /(?:^|\n)\s*export[^\n;]*?\sfrom\s*['"]([^'"]+)['"]/g,
  /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g,
];

function staticSpecifiers(stripped) {
  const specs = [];
  for (const re of SPECIFIER_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(stripped)) !== null) specs.push({ spec: m[1], offset: m.index });
  }
  return specs;
}

/** Resolve a relative specifier. Bare specifiers are external (a zero-dependency browser build
 *  has none) and are ignored. */
function resolveSpecifier(fromAbs, spec) {
  if (!spec.startsWith('.') && !spec.startsWith('/')) return null;
  const base = spec.startsWith('/') ? join(ROOT, spec) : resolve(dirname(fromAbs), spec);
  const candidates = [base, `${base}.js`, `${base}.mjs`, join(base, 'index.js'), join(base, 'index.mjs')];
  for (const c of candidates) {
    try {
      if (statSync(c).isFile()) return c;
    } catch { /* not this candidate */ }
  }
  return base; // unresolvable: report by literal path so a typo is visible, not silent
}

const SOURCE_CACHE = new Map();
function readSource(absPath) {
  if (!SOURCE_CACHE.has(absPath)) {
    let raw = '';
    try { raw = readFileSync(absPath, 'utf8'); } catch { raw = ''; }
    SOURCE_CACHE.set(absPath, { raw, stripped: stripComments(raw) });
  }
  return SOURCE_CACHE.get(absPath);
}

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

const violations = [];
const notes = [];

/**
 * Static imports inside src/ that resolve to nothing on disk. These are not violations — a
 * missing module is a build defect, not a blinding breach — but they ARE holes in this guard's
 * proof: an edge the walk cannot follow is a subgraph it never inspected, so the closure is
 * incomplete and a PASS would be overclaiming. They downgrade the run to INCOMPLETE.
 *
 * Found the hard way: src/corpus/manuscripts.public.js imported './field-paths.js', which does
 * not exist (the module is at src/core/field-paths.js). The guard had been treating the missing
 * target as an empty file and reporting a clean note about it.
 */
const unresolved = [];

function fail(kind, file, line, message, extra = {}) {
  violations.push({ kind, file, line, message, ...extra });
}

function isExcludedRoot(relPath) {
  if (EXCLUDED_PREFIXES.some((p) => relPath.startsWith(p))) return true;
  if (EXCLUDED_FILES.has(relPath)) return true;
  if (TEST_FILE_RE.test(relPath)) return true;
  if (isIdentityModule(relPath)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Checks 2 + 3 — transitive static import closure
// ---------------------------------------------------------------------------

function checkImportClosure(rootAbs) {
  const rootRel = rel(rootAbs);
  const parent = new Map([[rootAbs, null]]);
  const queue = [rootAbs];
  const seen = new Set([rootAbs]);

  while (queue.length) {
    const cur = queue.shift();
    const { stripped } = readSource(cur);
    for (const { spec } of staticSpecifiers(stripped)) {
      const target = resolveSpecifier(cur, spec);
      if (!target || seen.has(target)) continue;

      if (!existsSync(target)) {
        const { stripped: importerStripped } = readSource(cur);
        const idx = importerStripped.indexOf(spec);
        const record = `${rel(cur)}:${idx >= 0 ? lineOf(importerStripped, idx) : 0} -> '${spec}' (resolves to ${rel(target)}, which does not exist)`;
        if (!unresolved.includes(record)) unresolved.push(record);
        continue;
      }

      seen.add(target);
      parent.set(target, cur);

      const targetRel = rel(target);
      if (isIdentityModule(targetRel)) {
        const chain = [];
        let node = target;
        while (node) { chain.unshift(rel(node)); node = parent.get(node); }
        const importerSrc = readSource(cur);
        const idx = importerSrc.stripped.indexOf(spec);
        fail('identity-reachable', rootRel, idx >= 0 ? lineOf(importerSrc.stripped, idx) : 0,
          'guarded module reaches the identity store',
          { chain, importer: rel(cur), specifier: spec });
        continue; // do not walk into the identity store itself
      }
      queue.push(target);
    }
  }
  return seen;
}

// ---------------------------------------------------------------------------
// Check 4 — dynamic import ban (guarded subtree only)
// ---------------------------------------------------------------------------

const DYNAMIC_IMPORT_RE = /\bimport\s*\(/g;
function checkDynamicImport(fileAbs) {
  const { stripped } = readSource(fileAbs);
  DYNAMIC_IMPORT_RE.lastIndex = 0;
  let m;
  while ((m = DYNAMIC_IMPORT_RE.exec(stripped)) !== null) {
    fail('dynamic-import', rel(fileAbs), lineOf(stripped, m.index),
      'dynamic import( ) in the guarded subtree — it defeats the static walk and is banned (02 §2.3)');
  }
}

// ---------------------------------------------------------------------------
// Check 5 — identity vocabulary in guarded source
// ---------------------------------------------------------------------------

/** Spans of every single- and double-quoted string literal in comment-stripped source. */
function stringLiteralSpans(stripped) {
  const spans = [];
  let i = 0;
  while (i < stripped.length) {
    const c = stripped[i];
    if (c === "'" || c === '"' || c === '`') {
      const start = i;
      i++;
      while (i < stripped.length) {
        if (stripped[i] === '\\') { i += 2; continue; }
        if (stripped[i] === c) break;
        i++;
      }
      spans.push({ start, end: i, value: stripped.slice(start + 1, i) });
      i++;
      continue;
    }
    i++;
  }
  return spans;
}

function checkIdentityTokens(fileAbs) {
  const relPath = rel(fileAbs);
  const { stripped } = readSource(fileAbs);
  if (TOKEN_EXEMPT_FILES.has(relPath)) {
    checkFieldPathsAreDataFree(fileAbs);
    return;
  }
  if (CONTENT_MODULES.has(relPath)) {
    checkContentModuleHasNoIdentityFields(fileAbs, stripped);
    return;
  }
  const spans = stringLiteralSpans(stripped);
  const nameOnly = (offset) => {
    const span = spans.find((s) => offset > s.start && offset < s.end);
    return span ? ALLOWED_IDENTITY_NAME_STRINGS.has(span.value) : false;
  };

  IDENTITY_TOKEN_RE.lastIndex = 0;
  let m;
  let permittedNames = 0;
  while ((m = IDENTITY_TOKEN_RE.exec(stripped)) !== null) {
    if (nameOnly(m.index)) { permittedNames++; continue; }
    fail('identity-token', relPath, lineOf(stripped, m.index),
      `identity token "${m[0]}" appears in guarded source (comments are stripped, so this is live code or a string literal that is not a bare field name)`);
  }
  if (permittedNames > 0) {
    notes.push(`${relPath}: ${permittedNames} identity field NAME string(s) permitted (naming a blinded field is not reading one)`);
  }
}

/** 02 §2.2 fact 1, checked directly: the public store carries no identity FIELD. */
function checkContentModuleHasNoIdentityFields(fileAbs, stripped) {
  const relPath = rel(fileAbs);
  const spans = stringLiteralSpans(stripped);
  const insideString = (offset) => spans.some((s) => offset > s.start && offset < s.end);

  let m;
  IDENTITY_FIELD_KEY_RE.lastIndex = 0;
  while ((m = IDENTITY_FIELD_KEY_RE.exec(stripped)) !== null) {
    if (insideString(m.index)) continue; // "...the authors: a fictional research group" is prose
    fail('identity-field-in-public-store', relPath, lineOf(stripped, m.index),
      `identity field "${m[0].trim()}" appears in property-key position — 02 §2.2 fact 1: the public store has no author fields, because nothing was ever joined`);
  }
  IDENTITY_HARD_TOKEN_RE.lastIndex = 0;
  while ((m = IDENTITY_HARD_TOKEN_RE.exec(stripped)) !== null) {
    fail('identity-token', relPath, lineOf(stripped, m.index),
      `"${m[0]}" appears in the public corpus module`);
  }
  notes.push(`${relPath}: content module — checked for identity fields and accessors, not for the word "authors" in prose`);
}

/** The narrowing that keeps the field-paths token exemption from being a hole. */
function checkFieldPathsAreDataFree(fileAbs) {
  const relPath = rel(fileAbs);
  // Scan the COMMENT-STRIPPED source. Reading raw made prose apostrophes ("the human's name")
  // look like string-literal delimiters and produced three false failures on the real tree.
  const { stripped } = readSource(fileAbs);
  let checked = 0;
  for (const { start, value } of stringLiteralSpans(stripped)) {
    if (value === '') continue;
    if (value.startsWith('./') || value.startsWith('../')) continue; // import specifier, not data
    checked++;
    if (!FIELD_PATH_PREFIX_RE.test(value)) {
      fail('field-paths-not-data-free', relPath, lineOf(stripped, start),
        `string literal "${value}" is not a field path — ${relPath} is token-exempt only because it holds names and no values`);
    }
  }
  notes.push(`${relPath}: token-exempt; ${checked} string literal(s) checked for being paths, not values`);
}

// ---------------------------------------------------------------------------
// Check 6 — who may name identity at all
// ---------------------------------------------------------------------------

function checkIdentityImporters(allSrcFiles) {
  const importersOf = new Map(); // identity module relPath -> Set of importer relPaths
  for (const fileAbs of allSrcFiles) {
    const fileRel = rel(fileAbs);
    if (isIdentityModule(fileRel)) continue;
    const { stripped } = readSource(fileAbs);
    for (const { spec } of staticSpecifiers(stripped)) {
      const resolved = resolveSpecifier(fileAbs, spec);
      if (!resolved) continue;
      const targetRel = rel(resolved);
      if (!isIdentityModule(targetRel)) continue;
      if (!importersOf.has(targetRel)) importersOf.set(targetRel, new Set());
      importersOf.get(targetRel).add(fileRel);
    }
  }

  for (const [targetRel, importerSet] of [...importersOf.entries()].sort()) {
    const importers = [...importerSet].sort();
    for (const imp of importers) {
      if (!isPermittedIdentityImporter(imp)) {
        fail('identity-importer-drift', imp, 0,
          `${imp} statically imports ${targetRel}; only src/ui/** and ${COMPOSITION_ROOT} may name identity`);
      }
    }
    notes.push(`${targetRel}: static importer(s) = ${importers.join(', ') || 'none'}`);
  }

  if (importersOf.size === 0) {
    notes.push('identity layer has zero STATIC importers tree-wide (it is reached only by the composition root\'s dynamic import)');
  }

  // The stricter 02 §2.2 form, applied only where that layout is actually on disk.
  if (existsSync(abs(IDENTITY_ACCESSOR))) {
    const importers = [...(importersOf.get(IDENTITY_ACCESSOR) ?? new Set())].sort();
    if (importers.length !== 1 || importers[0] !== SOLE_ACCESSOR_IMPORTER) {
      fail('identity-importer-drift', IDENTITY_ACCESSOR, 0,
        `${IDENTITY_ACCESSOR} must have exactly one importer, ${SOLE_ACCESSOR_IMPORTER}; found ${importers.length === 0 ? 'none' : importers.join(', ')}`);
    }
  }
  return importersOf;
}

// ---------------------------------------------------------------------------
// Check 7 — the composition root's narrower rule
// ---------------------------------------------------------------------------

/** Read a balanced argument list starting at the '(' that follows `openIdx`. Strings are
 *  respected so a paren inside a literal does not unbalance the scan. */
function readCallArgs(src, openParenIdx) {
  let depth = 0;
  let i = openParenIdx;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      i++;
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === q) { i++; break; }
        i++;
      }
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth === 0) return src.slice(openParenIdx + 1, i);
    }
    i++;
  }
  return src.slice(openParenIdx + 1);
}

/** Every binding in the composition root that holds an identity module. */
function identityBindingsIn(stripped) {
  const bindings = new Set();

  // Static: import X from '<identity>' / import * as X / import { a, b as c }
  const staticRe = /(?:^|\n)\s*import\s+([^;\n]*?)\s+from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = staticRe.exec(stripped)) !== null) {
    if (!specifierLooksIdentity(m[2])) continue;
    for (const name of bindingNamesFromClause(m[1])) bindings.add(name);
  }

  // Dynamic: const X = await import('<identity>')  |  const X = await optional('<identity>')
  const dynRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:import|optional|loadOptional|importOptional)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = dynRe.exec(stripped)) !== null) {
    if (specifierLooksIdentity(m[2])) bindings.add(m[1]);
  }

  // One-hop aliases of anything already collected.
  const aliasRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*[;\n]/g;
  for (let pass = 0; pass < 2; pass++) {
    aliasRe.lastIndex = 0;
    while ((m = aliasRe.exec(stripped)) !== null) {
      if (bindings.has(m[2])) bindings.add(m[1]);
    }
  }
  return bindings;
}

function specifierLooksIdentity(spec) {
  const s = spec.replace(/\\/g, '/');
  return /(^|\/)identity(\/|\.|$)/i.test(s) || /manuscripts\.identity/i.test(s) || /identity-access/i.test(s);
}

function bindingNamesFromClause(clause) {
  const names = [];
  const c = clause.trim();
  const nsMatch = c.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
  if (nsMatch) names.push(nsMatch[1]);
  const braceMatch = c.match(/\{([^}]*)\}/);
  if (braceMatch) {
    for (const part of braceMatch[1].split(',')) {
      const t = part.trim();
      if (!t) continue;
      const asMatch = t.match(/\bas\s+([A-Za-z_$][\w$]*)/);
      names.push(asMatch ? asMatch[1] : t.split(/\s+/)[0]);
    }
  }
  const defMatch = c.match(/^([A-Za-z_$][\w$]*)\s*(?:,|$)/);
  if (defMatch) names.push(defMatch[1]);
  return names.filter(Boolean);
}

function checkCompositionRoot() {
  const rootAbs = abs(COMPOSITION_ROOT);
  if (!existsSync(rootAbs)) {
    notes.push(`${COMPOSITION_ROOT}: not present — the composition-root rule was not exercised`);
    return { present: false, unexercised: false, sitesFound: 0 };
  }
  const { stripped } = readSource(rootAbs);
  const bindings = identityBindingsIn(stripped);

  if (bindings.size === 0) {
    notes.push(`${COMPOSITION_ROOT}: no identity binding found; capability call sites checked anyway`);
  } else {
    notes.push(`${COMPOSITION_ROOT}: identity binding(s) tracked = ${[...bindings].sort().join(', ')}`);
  }

  let sitesFound = 0;
  for (const fnName of CAPABILITY_CALL_SITES) {
    // `?.` between the name and the paren is the shape the composition root actually uses
    // (`caps?.createCapabilities?.({ state })`). Omitting it made this check inspect zero call
    // sites and report a pass — caught by selftest-blinding.mjs, which is the whole point of it.
    const callRe = new RegExp(`\\b${fnName}\\s*(?:\\?\\.)?\\s*\\(`, 'g');
    let m;
    while ((m = callRe.exec(stripped)) !== null) {
      sitesFound++;
      const openIdx = stripped.indexOf('(', m.index);
      const argText = readCallArgs(stripped, openIdx);
      for (const b of bindings) {
        const nameRe = new RegExp(`\\b${b.replace(/[$]/g, '\\$')}\\b`);
        if (nameRe.test(argText)) {
          fail('identity-in-capabilities', COMPOSITION_ROOT, lineOf(stripped, m.index),
            `identity binding "${b}" is passed into ${fnName}( ) — identity must never reach the capability object handed to the tool layer`,
            { args: argText.replace(/\s+/g, ' ').trim().slice(0, 200) });
        }
      }
    }
  }
  notes.push(`${COMPOSITION_ROOT}: ${sitesFound} capability call site(s) inspected (${CAPABILITY_CALL_SITES.join(', ')})`);

  // If the composition root holds identity but no capability call site was found, check 7 could
  // not have fired. That is exactly the vacuous pass this script refuses to report anywhere else,
  // so it is surfaced the same way: INCOMPLETE, never PASS.
  return { present: true, unexercised: bindings.size > 0 && sitesFound === 0, sitesFound };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

function report(status, exitCode, summary) {
  if (ARGS.json) {
    process.stdout.write(JSON.stringify({ status, root: ROOT, summary, violations, notes }, null, 2) + '\n');
  } else if (!ARGS.quiet || exitCode !== 0) {
    process.stdout.write(summary + '\n');
  }
  process.exit(exitCode);
}

function main() {
  const lines = [];
  lines.push(`check-blinding — root ${ROOT}`);

  if (!existsSync(SRC)) {
    lines.push('');
    lines.push('INCOMPLETE: src/ does not exist. Nothing was walked, so nothing was proved.');
    report('INCOMPLETE', 2, lines.join('\n'));
  }

  const allSrcFiles = listSourceFiles(SRC);
  const guardedRoots = allSrcFiles.filter((f) => !isExcludedRoot(rel(f)));

  if (guardedRoots.length === 0) {
    lines.push('');
    lines.push(`INCOMPLETE: src/ holds ${allSrcFiles.length} file(s) but none is a guarded root`);
    lines.push('  (all excluded or identity). Nothing was proved.');
    report('INCOMPLETE', 2, lines.join('\n'));
  }

  const identityFiles = allSrcFiles.map(rel).filter(isIdentityModule);
  const identityPresent = identityFiles.length > 0;

  // Checks 2-5 over the guarded subtree.
  const guardedClosure = new Set();
  for (const rootAbs of guardedRoots) {
    for (const reached of checkImportClosure(rootAbs)) guardedClosure.add(reached);
  }
  const scanned = new Set(guardedRoots.map(rel));
  for (const reachedAbs of guardedClosure) {
    const r = rel(reachedAbs);
    if (r.startsWith('src/') && !isIdentityModule(r) && !EXCLUDED_FILES.has(r) && !TEST_FILE_RE.test(r)) scanned.add(r);
  }
  for (const r of [...scanned].sort()) {
    checkDynamicImport(abs(r));
    checkIdentityTokens(abs(r));
  }

  // Check 6 over the whole tree, src/ui/ and the composition root included.
  checkIdentityImporters(allSrcFiles);

  // Check 7 — the composition root's narrower rule.
  const compositionRoot = checkCompositionRoot();

  lines.push(`  files under src/            ${allSrcFiles.length}`);
  lines.push(`  guarded roots               ${guardedRoots.length}`);
  lines.push(`  guarded files scanned       ${scanned.size}`);
  const excludedTests = allSrcFiles.map(rel).filter((r) => TEST_FILE_RE.test(r));
  lines.push(`  excluded                    ${[...EXCLUDED_PREFIXES, COMPOSITION_ROOT].join(', ')}, *.test.mjs`);
  lines.push(`  test files excluded         ${excludedTests.length}${excludedTests.length ? ` (${excludedTests.join(', ')})` : ''}`);
  lines.push(`  identity modules on disk    ${identityPresent ? identityFiles.join(', ') : 'NONE'}`);
  lines.push(`  composition root            ${compositionRoot.present ? `${COMPOSITION_ROOT} (${compositionRoot.sitesFound} capability call site(s))` : 'absent'}`);

  if (violations.length > 0) {
    lines.push('');
    lines.push(`FAIL — ${violations.length} violation(s):`);
    for (const v of violations) {
      lines.push(`  [${v.kind}] ${v.file}:${v.line}`);
      lines.push(`      ${v.message}`);
      if (v.chain) lines.push(`      import chain: ${v.chain.join('  ->  ')}`);
      if (v.specifier) lines.push(`      offending specifier: '${v.specifier}' in ${v.importer}`);
      if (v.args) lines.push(`      call arguments: ${v.args}`);
    }
    report('FAIL', 1, lines.join('\n'));
  }

  for (const n of notes) lines.push(`  note: ${n}`);

  if (unresolved.length > 0) {
    lines.push('');
    lines.push(`INCOMPLETE: ${unresolved.length} static import(s) under src/ resolve to nothing on disk.`);
    lines.push('  No violation was found in what could be walked, but an edge the walk cannot follow');
    lines.push('  is a subgraph never inspected, so this is not a pass:');
    for (const u of unresolved) lines.push(`    ${u}`);
    report('INCOMPLETE', 2, lines.join('\n'));
  }

  if (compositionRoot.unexercised) {
    lines.push('');
    lines.push(`INCOMPLETE: ${COMPOSITION_ROOT} holds an identity binding but no createCapabilities( )`);
    lines.push('  or registerAll( ) call site was found, so check 7 could not have fired. Either the');
    lines.push('  wiring moved and this guard needs its call-site names updated, or the root is');
    lines.push('  half-built. Not a pass either way.');
    report('INCOMPLETE', 2, lines.join('\n'));
  }

  if (!identityPresent) {
    lines.push('');
    lines.push('INCOMPLETE: no identity module is on disk yet, so the reachability check (3) could');
    lines.push('  not have failed. No violations found, but this is NOT a pass — a guard that cannot');
    lines.push('  fail is not measuring anything. Re-run once the identity layer exists.');
    report('INCOMPLETE', 2, lines.join('\n'));
  }

  lines.push('');
  lines.push('PASS — no guarded module reaches identity, no dynamic import in the guarded subtree,');
  lines.push('       no identity vocabulary in guarded source, identity is named only by the UI');
  lines.push('       layer and the composition root, and no identity binding reaches the');
  lines.push('       capability object. Limit: convention plus this check, not a language');
  lines.push('       guarantee, and the composition root is covered by a pattern match rather');
  lines.push('       than a proof. See header.');
  report('PASS', 0, lines.join('\n'));
}

main();
