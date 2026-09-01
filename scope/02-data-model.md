# 02 — Data Model & Seeded Corpus

**Scope owner:** data model, corpus design, derived state, persistence.
**Not in this file:** tool input/output schemas (03), sanitizer + payload authoring (04), UI (05), schedule (01).
**Status:** LOCKED. Codex builds from this verbatim. No open decisions below.

Engine: browser only. No database, no backend, no npm build step. "Schema" here means frozen JS
object shapes in static ES modules plus one `localStorage` key. Every constant named in ALL_CAPS
is a real exported binding Codex must create at the path given.

---

## 0. Constants (single source, `src/core/constants.js`)

```js
export const STATE_KEY        = 'referee.state.v1';
export const STATE_VERSION    = 1;
export const SCORE_MIN        = 0;
export const SCORE_MAX        = 10;          // integers only
export const WEIGHT_MIN       = 0;
export const WEIGHT_MAX       = 100;         // integers only, NOT required to sum to 100
export const NEAR_TIE_EPSILON = 0.15;        // composite points, 0-10 scale
export const DECISION_BOUNDARY= 6.0;         // composite points
export const CONFLICT_SPREAD  = 6;           // raw score points
export const MIN_QUOTE_CHARS  = 40;          // post-normalization
export const FUZZY_THRESHOLD  = 0.92;        // token-subsequence similarity
export const FICTION_LABEL    = 'FICTIONAL — written for the Referee demo. Not a real study, dataset, institution, or person.';
```

`MIN_QUOTE_CHARS` and `FUZZY_THRESHOLD` are restated here for Codex's convenience; **03 owns the
matching algorithm**, this file owns only the fact that `Finding` records the result.

---

## 1. Entities

All records are frozen at module load (deep freeze via `src/core/deep-freeze.js`). Corpus records
are immutable for the life of the page; only `SessionState` mutates.

### 1.1 `Manuscript` — the public store

`src/corpus/manuscripts.public.js` → `export const MANUSCRIPTS = [ ... ]`

```js
{
  id:            'MS-102',          // string, /^MS-1\d{2}$/, unique, stable
  version:       1,                 // integer, corpus record revision
  title:         'A Replication Protocol for ...',   // string
  venue_track:   'Instruments & Methods',            // string, fictional track
  field:         'Atmospheric Science',              // string
  subfield:      'Radiometric Instrumentation',      // string
  keywords:      ['split-window', 'calibration'],    // string[], 3-6 entries
  sections:      [ Section, ... ],  // 4-6 entries, ordered; sections[0].id === 'abstract'
  figures:       [ Figure, ... ],   // 0-3 entries
  word_count:    1180,              // integer, precomputed by scripts/check-corpus.mjs
  fiction:       true,              // literal true on every record
  fiction_label: FICTION_LABEL,     // the constant, not a per-record string
  blinded_fields: BLINDED_FIELD_NAMES  // the shared frozen array, see 1.9.1
}
```

**`abstract` is a Section, not a separate field.** Every manuscript's `sections[0]` is
`{ id: 'abstract', order: 1, ... }`. It was a top-level string until MS-102 needed a payload slot
there (§6.1): a payload has to live in something the sanitizer walks and something
`integrity.sections_affected` can name, and a top-level field is neither. `read_manuscript` still
surfaces `abstract` at the top of its return (§4), projected from that section — one stored copy,
one source of truth, no risk of the projection and the section drifting apart. Its word budget stays
90–140 (§7.1); the 180–320 budget applies to the other sections.

There is **no `has_injection` field, and there must never be one.** A flag would let the agent
shortcut detection and would make the split-screen a staged result rather than a measured one.
Injection payloads are ordinary characters inside `Section.text`; the sanitizer finds them at
return-build time or it does not.

### 1.2 `Section`

```js
{
  id:         'discussion',   // string, one of SECTION_IDS (below). Unique within a manuscript.
  label:      'Discussion',   // string, display name
  order:      4,              // integer, 1-based, dense, matches array index + 1
  text:       '...',          // string, 180-320 words. See §7 for authoring rules.
  word_count: 268             // integer, precomputed
}
```

**`SECTION_IDS` — the legal set, and `03` §4's `inputSchema` enums import it from here:**

```js
// src/core/constants.js
export const SECTION_IDS = Object.freeze([
  'abstract', 'introduction', 'related_work', 'methods',
  'results', 'discussion', 'limitations', 'data_availability'
]);
```

Eight ids. **Not every manuscript carries every id** — `data_availability` appears only on the
manuscripts that publish one, and `related_work` and `limitations` are likewise per-manuscript. A
request for a legal id a given manuscript does not have refuses with `SECTION_NOT_FOUND` on the same
code path as a nonsense id (`03` §7 rule 3), so the section set is not an oracle.

**There is no `title` section id.** A title is a manuscript field, not a section; `03` carried one
until this pass and it produced a section that could never host a 40-character quote. **There is no
`references`, `acknowledgements`, `funding`, `affiliations`, `author_note`, or `correspondence`
section id either** — those live in `manuscripts.identity.js`, which no handler imports.

### 1.3 `Figure`

```js
{
  id:         'F1',            // string, unique within a manuscript
  section_id: 'results',       // string, must match a Section.id in the same manuscript
  caption:    '...',           // string, 15-40 words
  alt_text:   '...'            // string, 10-25 words
}
```

No image binaries. The site ships zero media assets; figures exist as caption + alt text so the
agent has structured non-prose surface to reason over and so a caption can host a payload.

### 1.4 `ManuscriptIdentity` — the disjoint store

`src/corpus/manuscripts.identity.js` → `export const IDENTITIES = [ ... ]`

```js
{
  manuscript_id: 'MS-102',
  authors: [
    { name: 'R. Halloway', affiliation: 'Zembla Polytechnic', is_corresponding: true,  orcid_like: '0000-0000-0000-0102' },
    { name: 'T. Bek',      affiliation: 'Erewhon Station',     is_corresponding: false, orcid_like: '0000-0000-0000-0103' }
  ],
  affiliations:             ['Zembla Polytechnic', 'Erewhon Station'],   // string[]
  funding:                  ['Fenwick Trust grant GF-1180'],             // string[]
  acknowledgements:         '...',                                       // string
  author_notes:             '...',                                       // string
  correspondence_email:     'r.halloway@zembla-poly.invalid',            // .invalid TLD, always
  external_links:           ['https://osf.invalid/ms102'],               // string[], .invalid only
  prior_submission_history: ['Desk-rejected at Laputa Review, 2023'],    // string[]
  conflict_of_interest:     'None declared.'                             // string
}
```

Every identity value is as fictional as the manuscript. Emails and links use `.invalid`,
ORCID-shaped ids use the all-zero reserved block, and the field is named `orcid_like` — the field
name itself says it is not a real registry id.

### 1.5 `RubricCriterion`

`src/corpus/rubric.js` → `export const CRITERIA = [ ... ]` (exactly 4, this order)

```js
{ id: 'novelty',         label: 'Novelty & Contribution',  description: '...', default_weight: 30 }
{ id: 'rigor',           label: 'Methodological Rigor',    description: '...', default_weight: 35 }
{ id: 'clarity',         label: 'Clarity & Presentation',  description: '...', default_weight: 15 }
{ id: 'reproducibility', label: 'Reproducibility',         description: '...', default_weight: 20 }
```

Weights live in `SessionState.rubricWeights`, never in the corpus. `default_weight` is the reset
target only.

### 1.6 `Score`

Stored in `SessionState.scores` as a nested map, not an array (O(1) update, trivial to persist):

```js
scores = {
  'MS-102': {
    novelty:         { value: 8, set_by: 'seed',  updated_at: '2026-09-01T00:00:00.000Z' },
    rigor:           { value: 9, set_by: 'human', updated_at: '2026-09-01T14:03:11.207Z' },
    clarity:         { value: 9, set_by: 'seed',  updated_at: '...' },
    reproducibility: { value: 9, set_by: 'seed',  updated_at: '...' }
  },
  ...
}
```

- `value`: integer, `SCORE_MIN..SCORE_MAX` inclusive. Non-integer or out-of-range on load → the
  whole persisted blob is discarded (§5.4).
- `set_by`: `'seed' | 'human'`. **Never `'agent'`.** No tool writes a score. The agent influences
  scores only by asserting findings a human reads. `assert_finding` carries a `score` argument
  (`03` §4.3); it is recorded in the ledger row as the agent's *proposed* score for that criterion
  and it does not enter `state.scores`. The tool's return reports the criterion's current value and
  the manuscript's composite so the agent can see what the human's rubric currently says — reading
  the outcome, never authoring it.
- Every manuscript has all 4 criteria present at all times. Seed values come from
  `src/corpus/seed-scores.js` (§6.2). A missing pair is a corruption condition, not a default.

### 1.7 `Finding`

Derived in memory, **not persisted.** Rebuilt on load by replaying `SessionState.ledger` for
entries with `action === 'assert_finding' && outcome === 'accepted'`, in `seq` order. The finding
fields are read straight back off the row's `args_digest`, which `03` §4.3's `digest` override puts
there for exactly this purpose.

**This record is `03` §5's emitted shape, transcribed. `03` is the writer; this file does not get a
second opinion about it.** The replay above is `03` §3's `deriveFindings(state)`.

```js
{
  finding_id:    'f_3b91ce04',            // 'f_' + 8 hex, deterministic within a session
  ledger_seq:    7,                       // integer, the row this was derived from
  manuscript_id: 'MS-102',
  criterion:     'rigor',                 // one of CRITERIA[].id
  section:       'discussion',            // one of SECTION_IDS
  evidence_quote:'...',                   // string, exactly as supplied (raw)
  normalized_quote: '...',                // string, what actually verified (04 §3.1's seven steps)
  verification: {
    method:      'exact',                 // 'exact' | 'fuzzy'
    score:       1,                       // number 0..1; 1 on exact. 04's field name, NOT `similarity`
    char_offset: 412,                     // integer | null, offset into the NORMALIZED section text
    verified_against: 'agent_visible_text' // CONSTANT on every accepting path (03 §5, per 04 §5).
                                          // The quote was checked against the neutralized text the
                                          // agent received, never the raw manuscript. A second
                                          // value would mean a second substrate exists.
  },
  claim:         '...',                   // string, agent's assertion, <= 400 chars
  polarity:      'weakness',              // 'strength' | 'weakness'  — 03 §4.3's enum has no third value
  severity:      'major',                 // 'minor' | 'major' | 'blocking'
  score:         9,                       // 0..10, the agent's PROPOSED criterion score. NOT state.scores.
  status:        'active',                // 'active' | 'superseded'  — computed during replay, never written
  superseded_by: null,                    // string | null, a finding_id
  asserted_at:   '2026-09-01T14:07:52.118Z'
}
```

`status` and `superseded_by` are ordering facts about an append-only log, computed by the replay:
for one `(manuscript_id, criterion)` the highest-`seq` accepted row is `active` and every earlier
one is `superseded`. Nothing is ever edited. `05` §11.3's findings board filters on
`f.status === 'active'`, which is why the field exists.

**A refused assertion never becomes a `Finding`.** Refusals exist only as ledger entries with
`outcome: 'refused'`. There is no rejected-findings list to browse, because a browsable refusal log
keyed to quote text is an oracle surface.

### 1.8 `HumanEvidence`

The human's own notes. Not stored separately — it is a ledger entry, and the view derives from it.

```js
{
  id:            'he_4f81c30d',    // 'he_' + 8 hex, parallel to Finding's 'f_' + 8 hex
                                   // (03 §5) and EditorFlag's 'flag_' + 8 hex (03 §4.6).
                                   // The 'HE-000012' counter form is dead: all three
                                   // ledger-derived records now share one id grammar.
  ledger_seq:    12,
  manuscript_id: 'MS-103',
  section_id:    'methods',        // string | null
  note:          '...',            // string, <= 800 chars
  saw_identity:  true,             // boolean: was this manuscript unblinded for the human at write time?
  created_at:    '...'
}
```

`saw_identity` is the honest counterpart to the agent's blinding. The human is *allowed* to
unblind; the record shows when a human note was written with identity in view. That asymmetry —
agent structurally blind, human unblinded but logged — is the demo.

### 1.9 `LedgerEntry`

`SessionState.ledger` is the only append-only persisted array. Append-only in session: entries are
never edited or removed; the array is only ever pushed to. The single writer is
`src/core/ledger.js → appendLedger(state, partial)`.

**This record is `03` §0.4's `appendLedger` shape, transcribed.** `03` is the only writer for agent
rows and the UI writes human rows through the same function; this file does not get a second
opinion about the field names.

```js
{
  seq:        7,                       // integer, = ledger.length + 1 at append time. Monotonic, dense.
  ts:         '2026-09-01T14:07:52.118Z',
  actor:      'agent',                 // 'agent' | 'human'  (no third value; see §5.4 note)
  action:     'assert_finding',        // a tool name, or a human verb: 'set_weights'
                                       // | 'unblind' | 'add_note' | 'commit_recommendation'
                                       // | 'session_reset'   — bare, never prefixed
                                       // FIVE human verbs. 'set_score' was declared here and
                                       // written by nothing: no tool writes a score (§1.6) and
                                       // the human's four moves are the four below. Dead value.
  manuscript_id: 'MS-102',             // string | null
  args_digest: { ... },                // object, the redacted arg echo built by defineTool (03 §3)
  outcome:    'accepted',              // 'accepted' | 'refused'
  code:       null,                    // null when accepted; otherwise a member of REFUSAL_CODES
  visible_fields_at_time: [ ... ],     // string[], see §1.9.1
  note:       'rigor / weakness / discussion / exact match'    // string | null, from a frozen template
}
```

**Three field names moved and the old ones are dead.** This file previously declared `outcome: 'ok'`,
a `detail` string and an `integrity` object. `03`'s writer stamps `outcome: "accepted"` (`03` §3),
carries the per-call payload on `args_digest`, and names the human-readable string `note`. `'ok'`,
`detail` and `integrity` are **dead** on this record — `'ok'` is the one that mattered, because
§1.11's findings replay selected on it and therefore matched zero rows. `integrity` never reached a
ledger row at all: `read_manuscript`'s `digest` override (`03` §4.1) puts only `manuscript_id`,
`sections_requested` and `sections_returned` on `args_digest`, and the integrity counts live on the
tool's *return*, not on the log.

`note` is assembled from a frozen template table in `src/core/refusals.js`. **A handler may never
interpolate manuscript content, quote text, or a near-miss offset into `note`.** Only enumerated
tokens (criterion id, section id, polarity, match method) may be substituted. This is the concrete
form of the oracle-leakage rule at the data layer: an attacker probing refusal strings learns
nothing that varies with hidden content. The same rule governs `args_digest`, which is why it is
built by `safeDigest` or a named per-tool override and never by echoing raw args.

`REFUSAL_CODES` is **`03` §1.3's frozen set, imported, not re-declared here**
(`src/core/refusals.js` re-exports `CODES` from `src/tools/envelope.js`): `INVALID_ARGUMENT`,
`UNKNOWN_MANUSCRIPT`, `SECTION_NOT_FOUND`, `QUOTE_TOO_SHORT`, `EVIDENCE_NOT_FOUND`,
`INVALID_CRITERION`, `OUT_OF_ORDER`, `ALREADY_COMMITTED`, `REQUIRES_HUMAN`, `HUMAN_ONLY`,
`INTERNAL`.

This file previously declared a second set naming four of the same concepts differently —
`UNKNOWN_SECTION`, `UNKNOWN_CRITERION`, `SESSION_COMMITTED`, `MALFORMED_INPUT` — and omitted
`OUT_OF_ORDER` and `INTERNAL`. Those four spellings are **dead**. A code name is a wire value; two
files cannot both own it.

#### 1.9.1 `visible_fields_at_time` — exact definition

It records **the field-path names the acting party was entitled to read for `manuscript_id` at the
instant of the call.** Names only. It never contains a value, and computing it never reads the
identity store.

```js
// src/core/visibility.js — imports ONLY src/corpus/field-paths.js (names, zero data)
import { PUBLIC_FIELD_PATHS, IDENTITY_FIELD_PATHS, QUEUE_FIELD_PATHS } from '../corpus/field-paths.js';

export function visibleFieldsAtTime(actor, manuscriptId, state) {
  if (manuscriptId === null) return [...QUEUE_FIELD_PATHS];
  if (actor === 'agent')     return [...PUBLIC_FIELD_PATHS];               // constant. always.
  return state.unblinded.some((u) => u.id === manuscriptId)   // §5.1: {id, reason, at}
    ? [...PUBLIC_FIELD_PATHS, ...IDENTITY_FIELD_PATHS]
    : [...PUBLIC_FIELD_PATHS];
}
```

Three properties this buys, all checkable by eye in the ledger view:

1. **The agent branch takes no input but `actor`.** It cannot widen. Not "does not" — cannot; there
   is no expression in that branch that consults `state`, the manuscript, or the unblind list. A
   reviewer scrolling the ledger sees the identical array on every agent row in the session,
   including rows that come *after* a human unblind.
2. **The human branch widens visibly, and only after `unblind`.** The widening is the point of the
   record, not a leak.
3. **Recording identity paths costs nothing.** `IDENTITY_FIELD_PATHS` is a frozen list of strings
   in a module that contains no author data at all. Logging "the human could see
   `identity.authors[].name`" does not require knowing any author's name.

`field-paths.js` (data-free, importable from anywhere):

```js
export const PUBLIC_FIELD_PATHS = Object.freeze([
  'manuscript.id','manuscript.title','manuscript.venue_track','manuscript.field',
  'manuscript.subfield','manuscript.keywords','manuscript.abstract','manuscript.word_count',
  'manuscript.sections[].id','manuscript.sections[].label','manuscript.sections[].text',
  'manuscript.figures[].caption','manuscript.figures[].alt_text','manuscript.blinded_fields'
]);

export const IDENTITY_FIELD_PATHS = Object.freeze([
  'identity.authors[].name','identity.authors[].affiliation','identity.authors[].is_corresponding',
  'identity.authors[].orcid_like','identity.affiliations','identity.funding',
  'identity.acknowledgements','identity.author_notes','identity.correspondence_email',
  'identity.external_links','identity.prior_submission_history','identity.conflict_of_interest'
]);

export const QUEUE_FIELD_PATHS = Object.freeze([
  'session.queue[].id','session.queue[].title','session.queue[].composite',
  'session.queue[].rank','session.queue[].flags','session.rubric_weights'
]);

// The `blinded_fields` array shipped in every tool return is a pure string transform of
// IDENTITY_FIELD_PATHS. It reads no data; it renames names.
export const BLINDED_FIELD_NAMES = Object.freeze(
  [...new Set(IDENTITY_FIELD_PATHS.map(p => p.replace(/^identity\./, '').replace(/\[\]\..*$/, '')))]
);
// => ['authors','affiliations','funding','acknowledgements','author_notes',
//     'correspondence_email','external_links','prior_submission_history','conflict_of_interest']
```

### 1.10 `IntegrityEvent`

Derived in memory, **not persisted**, because it is fully re-derivable: the sanitizer is
deterministic and the corpus is static, so running it over `MANUSCRIPTS` at load reproduces the
identical event set every time. Built once at boot by `src/core/sanitize.js` (module 04 owns the
detector; this file owns the record shape).

```js
{
  id:                  'MS-110:methods:1',   // `${manuscript_id}:${section_id}:${span_index}`
  manuscript_id:       'MS-110',
  section_id:          'methods',
  detected_at:         '...',            // boot time; informational only, not an ordering key
  raw_excerpt:         '...'             // untouched payload text — HUMAN SPLIT-SCREEN ONLY
}
```

**Five fields were declared here and written by nothing, and they are deleted:** `pattern_id`,
`neutralized_excerpt`, `char_start`, `char_end`, `surfaced_to_agent`. `04` §3.3's
`sanitizeSection` is the only emitter of this record and writes none of them. A field an entity
declares and no writer fills is a trap for the implementer, who builds a reader for it and gets
`undefined`. The emitter additionally writes `span_index`, `families`, `technique`, `raw_offset`,
`replacement_token` and `detector_version`, and `05` §11's split-screen positions both panes off
`raw_offset` and `replacement_token`; **`04` §3.3 is the record's authority for anything beyond the
five keys above.** **The `id` form is no longer divergent:** this file adopts `04` §3.3's
`` `${manuscript_id}:${section_id}:${span_index}` ``, ruled 2026-09-01. `'IE-003'` is dead. These
ids reach the agent through `03` §4.1's `integrity.event_ids`, and the section name inside them is a
**deliberate** disclosure alongside `sections_affected` — reasoning at the end of this file.

The invariant `surfaced_to_agent` used to assert survives without it, and is stronger without it,
because it is enforced rather than recorded: the runtime guard in §2.5 throws in dev on any tool
return whose serialized body contains an `IntegrityEvent.raw_excerpt` substring. A boolean on the
record could only ever have described what the guard already prevents. The agent's channel gets the
aggregate `integrity: { injection_attempts, sections_affected, event_ids, note }` and nothing else.

### 1.11 `SessionState`

The in-memory object. Its persisted subset is exactly the seven keys of §5.

```js
{
  // ---- persisted (§5) ----
  version:       1,
  seedHash:      'fnv1a32-3b7c19d0',
  scores:        { [manuscript_id]: { [criterion_id]: Score } },
  ledger:        [ LedgerEntry, ... ],
  rubricWeights: { novelty: 30, rigor: 35, clarity: 15, reproducibility: 20, acceptSlots: 4 },
  unblinded:     [ { id: 'MS-103', reason: '...', at: '...' } ],
  committed:     null | Commitment,

  // ---- derived, rebuilt on every load and after every mutation ----
  findings:        [ Finding, ... ],         // replayed from ledger
  humanEvidence:   [ HumanEvidence, ... ],   // replayed from ledger
  editorFlags:     [ EditorFlag, ... ],      // replayed from ledger
  integrityEvents: [ IntegrityEvent, ... ],  // recomputed from corpus
  ranking:         [ RankedItem, ... ]       // recomputed from scores + weights (§3)
}
```

```js
// Commitment — human-only, one per session (see CONTESTED)
{ manuscript_id: 'MS-102',
  recommendation: 'accept',   // 'accept' | 'minor_revision' | 'major_revision' | 'reject'
                              // SINGULAR. 03 s4.7's inputSchema enum is the executed gate and
                              // 01 P1 agrees; the plural spellings are dead wire values.
  rationale: '...',           // string, <= 1200 chars, required, non-empty
  committed_at: '...', by: 'human', ledger_seq: 41 }

// EditorFlag — derived from ledger action 'flag_for_editor'
{ id: 'flag_9c2ab740', ledger_seq: 19, manuscript_id: 'MS-110', actor: 'agent',
  concern_type: 'prompt_injection',
  // 'prompt_injection' | 'identity_leak_attempt' | 'ethics' | 'methodology'
  // | 'plagiarism_suspicion' | 'other'
  // Field name and enum are 03 s4.6's inputSchema, which is the executed gate.
  // 'category' and 'suspected_prompt_injection'/'scope'/'dual_submission' are dead.
  note: '...', created_at: '...' }
```

**Deriving `findings`, `editorFlags`, and `humanEvidence` from the ledger rather than persisting
them separately is deliberate.** It honors the locked seven-key shape exactly, and it removes the
possibility of a finding existing that the ledger does not show — the append-only log becomes the
only way a finding can come into being, so the log cannot be incomplete.

---

## 2. Structural separation — file layout and the guard

### 2.1 Layout

```
src/
  corpus/
    manuscripts.public.js     MANUSCRIPTS (12)   — imports: constants.js, deep-freeze.js. NOTHING ELSE.
    manuscripts.identity.js   IDENTITIES  (12)   — imports: deep-freeze.js. NOTHING ELSE.
    seed-scores.js            SEED_SCORES        — imports: nothing.
    rubric.js                 CRITERIA           — imports: nothing.
    field-paths.js            path name arrays   — imports: nothing. CONTAINS NO DATA.
  data/
    public-access.js          listManuscripts / getManuscript / getSection / getSectionText
                              — imports: manuscripts.public.js ONLY
    identity-access.js        getIdentity(manuscriptId)
                              — imports: manuscripts.identity.js ONLY
  core/
    constants.js  deep-freeze.js  normalize.js  hash.js  visibility.js  refusals.js
    ledger.js  ranking.js  state.js  sanitize.js
  tools/
    index.js                  registers the 7 tools via document.modelContext.registerTool
    get-review-state.js  read-manuscript.js  assert-finding.js  check-claim.js
    request-unblind.js   flag-for-editor.js  submit-recommendation.js
  ui/
    app.js  queue-view.js  manuscript-view.js  split-screen.js  ledger-view.js
    identity-panel.js         <-- THE ONLY MODULE IN THE ENTIRE TREE THAT IMPORTS identity-access.js
scripts/
  check-blinding.mjs          the guard (§2.4)
  check-corpus.mjs            corpus invariants + word counts + seedHash printer (§7.3)
```

**Sibling slices add directories under `src/`** — `03` adds `src/tools/handlers/`, `04` adds
`src/adversarial/`. That is fine and expected. What is not fine is a guard that walks a hand-written
list of directories, because a directory added later is then silently unguarded. §2.4 therefore
walks **everything under `src/` except `src/ui/`**, which is the only claim this file actually
makes: identity has one importer and it is in the UI layer.

### 2.2 The four structural facts

1. **The public corpus module never imports the identity module.** `manuscripts.public.js` has no
   author fields to omit; there is nothing to strip, because nothing was ever joined.
2. **Identity data has exactly one importer, which has exactly one importer.**
   `manuscripts.identity.js` ← `data/identity-access.js` ← `ui/identity-panel.js`. Three files, one
   chain, and the chain terminates in the UI layer. Nothing under `src/tools/` or `src/core/`
   appears anywhere in it.
3. **Tool handlers receive a frozen capability object, not module scope.** `tools/index.js` builds
   one context and passes it to every handler:
   ```js
   const toolCtx = Object.freeze({
     listManuscripts, getManuscript, getSection, getSectionText,  // from public-access.js
     appendLedger, visibleFieldsAtTime, deriveRanking, buildAgentPayload, now
   });
   ```
   There is no `getIdentity` on it. A handler cannot reach identity through its arguments; it would
   have to author a new static import, which is what the guard catches.
4. **`blinded_fields` is a constant, not a computed diff.** Computing "which fields did we remove"
   by comparing against the identity record would be a read of identity. `BLINDED_FIELD_NAMES` is
   derived from a list of *field names* that contains no values.

**Honest statement of the limit:** JavaScript has no module-level access control. A determined
handler could call dynamic `import('../corpus/manuscripts.identity.js')`. The separation is
enforced by (a) an import-graph guard that fails the build, and (b) a runtime key check on every
return. That is enforcement at the seam, not a language guarantee, and the write-up must say so.

### 2.3 What the tool layer may import

Allowed under `src/tools/**`: `data/public-access.js`, anything in `src/core/`, `corpus/rubric.js`,
`corpus/field-paths.js`, `core/constants.js`.
Forbidden under `src/tools/**` and `src/core/**`: `data/identity-access.js`,
`corpus/manuscripts.identity.js`, and any dynamic `import(`.

### 2.4 THE GUARD — `scripts/check-blinding.mjs`

One guard, and it is the named regression detector for this whole slice. Node, zero deps, run in CI
on every push and by `npm run check` before deploy.

```
For every file under src/, EXCLUDING src/ui/:
  1. Parse static import specifiers with /^\s*import[\s\S]*?from\s+['"](.+?)['"]/gm
     plus /^\s*export\s+.*?from\s+['"](.+?)['"]/gm.
  2. Resolve to real paths; walk transitively; build the closure.
  3. FAIL if the closure contains manuscripts.identity.js or identity-access.js.
  4. FAIL if the file source matches /\bimport\s*\(/  (dynamic import, any target).
  5. FAIL if the file source matches the identity token set, case-insensitive, outside comments:
     /\b(getIdentity|IDENTITIES|authors|affiliation|acknowledge|funding|corresponding|orcid)\b/
     Allowlist: the exact strings 'IDENTITY_FIELD_PATHS' and 'BLINDED_FIELD_NAMES', which are
     name lists, not data.
Also assert, tree-wide:
  6. exactly one file imports identity-access.js, and its path is src/ui/identity-panel.js.
Exit 1 with the offending file:line on any failure.
```

Step 5 catches the shape a graph walk misses: a handler that hardcodes an author name into a
string. Step 6 catches the drift where a second UI view starts pulling identity and nobody notices
the surface has doubled.

**The walk is defined by exclusion, deliberately.** It named `src/tools/` and `src/core/` until this
pass, which meant it did not walk `src/adversarial/`, `src/tools/handlers/`, or anything else a
sibling slice added — the structural-blinding proof covered a directory set the build does not use,
and passed vacuously. `01` AC-6 is the observable form of this rule and now states it the same way.

### 2.5 Runtime belt — `assertNoIdentityKeys(payload)`

Runs on every tool return when `location.hostname === 'localhost'` or `?debug=1`. Deep-walks the
object; throws if any key matches the identity key set (names taken from `IDENTITY_FIELD_PATHS`);
throws if the JSON serialization contains any `IntegrityEvent.raw_excerpt` substring.

**It checks keys and known payload substrings, never values against identity strings.** Comparing a
return against real author names would require the tool layer to read the identity store — the
verifier would become the leak. Say this out loud in the write-up; it is the sharpest single point
in the architecture.

---

## 3. Derived state — score to ranking, exactly

`src/core/ranking.js`. Pure functions. No `Date`, no `Math.random`, no ledger read in the composite
path.

### 3.1 Composite

```
composite(m) = round4( Σ_c (w_c · s_{m,c}) / Σ_c w_c )

round4(x) = Math.round((x + Number.EPSILON) * 10000) / 10000
```

- `c` ranges over the 4 `CRITERIA` in declaration order (fixed, so float summation order is fixed
  and the result is bit-identical across runs).
- `w_c` = `state.rubricWeights[c.id]`, integer 0..100.
- `s_{m,c}` = `state.scores[m.id][c.id].value`, integer 0..10.
- Because the formula divides by `Σw`, weights are **not** required to sum to 100. The UI may show
  a normalized percentage; the math does not depend on it. This deletes an entire class of
  "weights must total 100" validation bugs.
- **Degenerate case:** if `Σw === 0`, `composite = 0` for every manuscript, every item gets flag
  `WEIGHTS_DEGENERATE`, `requires_human_judgment = true` for all, and the commit control is
  disabled with an inline explanation. No division by zero, no NaN reaches state.

### 3.2 Ranking

```js
items.sort((a, b) => (b.composite - a.composite) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
// rank = index + 1
```

Composite descending, then manuscript id ascending. The id tiebreak makes the order independent of
input array order and of engine sort stability. Re-running `deriveRanking` on the same
`(scores, weights)` always produces the identical array.

### 3.3 `RankedItem`

```js
{
  manuscript_id: 'MS-102',
  title:         '...',
  rank:          1,
  composite:     8.7,
  per_criterion: { novelty: 8, rigor: 9, clarity: 9, reproducibility: 9 },
  spread:        1,                     // max(s) - min(s)
  flags:         ['NEAR_TIE','INTEGRITY_EVENTS_PRESENT'],   // blocking, fixed order
  advisory:      ['NO_VERIFIED_EVIDENCE'],                  // non-blocking
  requires_human_judgment: true         // === flags.length > 0
}
```

### 3.4 Flags — evaluated after sorting, appended in this fixed order

| # | Flag | Condition | Class |
|---|---|---|---|
| 1 | `NEAR_TIE` | `abs(composite − composite(rank±1)) <= NEAR_TIE_EPSILON` for either adjacent rank | blocking |
| 2 | `AT_DECISION_BOUNDARY` | `abs(composite − DECISION_BOUNDARY) <= NEAR_TIE_EPSILON` | blocking |
| 3 | `CRITERION_CONFLICT` | `max(per_criterion) − min(per_criterion) >= CONFLICT_SPREAD` | blocking |
| 4 | `INTEGRITY_EVENTS_PRESENT` | this manuscript has ≥1 `IntegrityEvent` | blocking |
| 5 | `WEIGHTS_DEGENERATE` | `Σw === 0` | blocking |
| 6 | `NO_VERIFIED_EVIDENCE` | zero accepted `Finding` records for this manuscript | advisory |

`requires_human_judgment` is set by **blocking flags only.** `NO_VERIFIED_EVIDENCE` is advisory
because at session start it is true of all twelve, and a badge that lights on everything measures
nothing.

**Determinism split, stated plainly:** `composite` and `rank` are pure over `(scores, weights)`.
`flags` are pure over `(ranking table, integrityEvents, findings)`. Both are re-derived from scratch
on every weight change — nothing is cached, nothing is incrementally patched. A weight slider move
calls `deriveRanking(state)` and re-renders. At 12 items × 4 criteria this is free.

### 3.5 Seed ranking (proof the numbers behave)

At default weights `{30,35,15,20}`, the seed scores of §6.2 produce:

| Rank | Id | Composite | Blocking flags |
|---|---|---|---|
| 1 | MS-102 | 8.70 | NEAR_TIE, INTEGRITY_EVENTS_PRESENT |
| 2 | MS-101 | 8.65 | NEAR_TIE |
| 3 | MS-104 | 7.25 | — |
| 4 | MS-106 | 6.90 | NEAR_TIE |
| 5 | MS-105 | 6.85 | NEAR_TIE |
| 6 | MS-108 | 6.25 | — |
| 7 | MS-103 | 5.90 | AT_DECISION_BOUNDARY, CRITERION_CONFLICT |
| 8 | MS-107 | 5.60 | INTEGRITY_EVENTS_PRESENT |
| 9 | MS-109 | 5.10 | — |
| 10 | MS-110 | 4.70 | INTEGRITY_EVENTS_PRESENT |
| 11 | MS-111 | 4.20 | — |
| 12 | MS-112 | 2.50 | — |

Adjacent gaps: 0.05, 1.40, 0.35, 0.05, 0.60, 0.35, 0.30, 0.50, 0.40, 0.50, 1.70. Exactly two pairs
fall inside `NEAR_TIE_EPSILON`, both by 0.05 — comfortably inside, not knife-edge on the constant.

**The weight-change demo (scripted, and it works):** set weights to
`{ novelty: 50, rigor: 25, clarity: 10, reproducibility: 15 }`. Recomputed in full so that nothing
downstream has to describe this event from memory — **this table is the event, and `05` §11.3 and
`07` §1 both film it from here:**

| Rank | Id | Composite | Was |
|---|---|---|---|
| 1 | MS-101 | 8.75 | 2 |
| 2 | MS-102 | 8.50 | 1 |
| 3 | MS-103 | 7.05 | 7 |
| 4 | MS-104 | 6.90 | 3 |
| 5 | MS-105 | 6.90 | 5 |
| 6 | MS-106 | 6.35 | 4 |
| 7 | MS-107 | 5.70 | 8 |
| 8 | MS-108 | 5.60 | 6 |
| 9 | MS-110 | 5.35 | 10 |
| 10 | MS-109 | 4.50 | 9 |
| 11 | MS-111 | 3.55 | 11 |
| 12 | MS-112 | 2.35 | 12 |

**The top two swap.** MS-101 8.65 → 8.75 passes MS-102 8.70 → 8.50. And the conflicted manuscript
**climbs from rank 7 to rank 3** on a single slider move. That is the live re-ranking must-have
demonstrated in one gesture, and it makes the human-judgment argument better than any copy could.

Two details worth having in front of you before filming it. MS-104 and MS-105 both land on 6.90 and
are separated only by §3.2's id tiebreak, which is the determinism rule doing visible work. And the
cut at `acceptSlots: 4` moves *through* the pack rather than staying put: MS-106, above the cut at
seed, falls to rank 6 and crosses below it, while MS-103 crosses up. **Two crossings, in opposite
directions, from one gesture** — which is exactly what `05` §4.5's crossing treatment is built to
show.

---

## 4. `read_manuscript` return shape (data contract only; 03 owns the tool schema)

Listed here because it is the assembly point where the stores meet and identity does not.

```js
{
  ok: true,
  manuscript: {
    id, title, venue_track, field, subfield, keywords, word_count,
    abstract,                       // PROJECTED from sections[0], SANITIZED, never stored twice
    fiction: true, fiction_label: FICTION_LABEL,
    sections: [ { id, label, order, text /* SANITIZED */, word_count } ],
    figures:  [ { id, section_id, caption /* SANITIZED */, alt_text } ]
  },
  blinded_fields: BLINDED_FIELD_NAMES,
  integrity: { injection_attempts: 1, sections_affected: ['discussion'] }
}
```

Sanitization happens **while building this object**, not at render. The agent's copy and the
human's raw copy are two different strings produced at two different times by two different code
paths; the split-screen shows them side by side. Nothing in this payload is derived from
`manuscripts.identity.js`, and `assertNoIdentityKeys` proves it on every call in dev.

---

## 5. Persistence — `referee.state.v1`

### 5.1 Full persisted shape (exactly seven keys, no more)

```js
{
  version:       1,
  seedHash:      'fnv1a32-3b7c19d0',
  scores:        { 'MS-101': { novelty:{value,set_by,updated_at}, ... }, ... },  // 12 x 4
  ledger:        [ LedgerEntry, ... ],
  rubricWeights: { novelty:30, rigor:35, clarity:15, reproducibility:20, acceptSlots:4 },
  unblinded:     [],                 // Array<{ id, reason, at }>, order = unblind order
  committed:     null                // null | Commitment
}
```

Two shapes inside those seven keys are worth stating explicitly, because sibling slices read them:

- **`rubricWeights.acceptSlots`** is the cut-line position `05` §4.3 draws and `05` §4.1's stepper
  moves — an integer, 1..11, default 4. It lives inside `rubricWeights` rather than as an eighth
  top-level key because the locked key set is seven and this is a rubric setting. `05` §14.1 assumed
  exactly this home; it is now decided rather than assumed, and §5.4's validator admits it (it
  previously asserted `rubricWeights` had *exactly* the four criterion ids, which would have
  discarded the whole persisted blob on every load).
- **`unblinded` is an array of records, not of ids.** `01` §5 requires the reveal to carry a typed
  reason and requires that reason on the record verbatim, so the reason has to be stored where the
  unblind is stored. The ledger row carries it too; this array is what `visibleFieldsAtTime` reads
  (`.some(u => u.id === id)`, never `.includes(id)`).

Nothing else is written. `findings`, `humanEvidence`, `editorFlags`, `integrityEvents`, and
`ranking` are all derived (§1.11) and deliberately absent. **The corpus is never written to
localStorage** — it is a static module, and a copy in storage would be a second source of truth that
could silently diverge from the shipped text the evidence gate verifies against.

### 5.2 `seedHash`

```js
// src/core/hash.js — FNV-1a 32-bit over canonical JSON. Synchronous, zero deps, deterministic.
seedHash = 'fnv1a32-' + fnv1a32(canonicalJSON({
  manuscripts: MANUSCRIPTS,   // public only
  rubric:      CRITERIA,
  seedScores:  SEED_SCORES
})).toString(16).padStart(8, '0');
```

`canonicalJSON` sorts object keys recursively before serializing, so key order in the source modules
cannot change the hash. **The identity store is not hashed** — hashing it would require
`core/hash.js` to import identity, which the guard forbids. The hash's job is to detect that the
*text the evidence gate verifies against* has changed, and that text is entirely public.
`crypto.subtle` is not used because it is async and would make state load a promise for no benefit.

### 5.3 Write points

Exactly one writer: `src/core/state.js → persist(state)`. It serializes only the seven keys, then
`localStorage.setItem(STATE_KEY, json)`. Debounced 250 ms, with a `beforeunload` flush.

`persist` is called after, and only after:

| Trigger | Actor |
|---|---|
| score changed | human |
| rubric weight changed | human |
| ledger appended (every tool call, accepted or refused; every human action) | both |
| manuscript unblinded | human |
| recommendation committed | human |
| reset | human |

**No tool handler calls `persist` or `localStorage` directly.** Handlers return a result and hand a
partial ledger entry to `appendLedger`; the state layer persists. One writer, one place to audit.

### 5.4 Load, corruption, and absence

`loadState()` runs this ladder and takes the first hit:

1. Key absent → `seedState()`. Silent; this is a first visit.
2. `JSON.parse` throws → discard, `seedState()`, set `state.notice = 'STATE_DISCARDED_CORRUPT'`.
3. `parsed.version !== STATE_VERSION` → discard, `seedState()`, notice `'STATE_DISCARDED_VERSION'`.
4. `parsed.seedHash !== seedHash` → discard, `seedState()`, notice `'STATE_DISCARDED_SEED_CHANGED'`.
   The corpus moved under the saved scores; keeping them would mean scores pointing at text that no
   longer exists, and a ledger referencing character offsets into a different string.
5. `validatePersisted(parsed)` fails → discard, `seedState()`, notice `'STATE_DISCARDED_SCHEMA'`.
6. Otherwise adopt.

`validatePersisted` is a hand-written type check, ~40 lines, no schema library. It asserts: the
seven keys and no others; `scores` has all 12 manuscript ids each with all 4 criterion ids, each
`value` an integer in range; `ledger` is an array whose `seq` values are dense and 1-based;
`rubricWeights` has exactly the 4 criterion ids each an integer 0..100 **plus `acceptSlots`, an
integer 1..11, and nothing else**; `unblinded` is an array of `{id, reason, at}` records whose `id`
is a known manuscript id and whose `reason` is a non-empty string; `committed` is `null` or a
`Commitment` with a known `manuscript_id` and a `recommendation` in the enum.

**Partial recovery is not attempted.** With two days of build, half-restoring a malformed blob is
how a demo produces a ranking nobody can explain. Discard, reseed, tell the user in a dismissible
banner.

`state.notice` is UI-only and is **not** persisted. When a discard happens, `seedState()`'s ledger
starts with `seq: 1, actor: 'human', action: 'session_reset', outcome: 'accepted', code: null,
note: 'state discarded: <reason>'`. `actor` stays inside the locked two-value enum; the reason
lives in `note`, drawn from the frozen template table like every other note string.

### 5.5 Versioning and migration stance

**There are no migrations.** `STATE_VERSION` is a fence, not a ladder: an unrecognized version is
discarded (rule 3). If the shape ever changes, the key changes with it — `referee.state.v2` — so the
old key is simply never read again. For a two-day build with no user data of value and a reset
button on screen, migration code is pure risk. Stated so nobody writes one.

### 5.6 Reset

`resetSession()`:
1. `localStorage.removeItem(STATE_KEY)`
2. `state = seedState()` — scores rebuilt from `SEED_SCORES`, weights from `default_weight` with
   `acceptSlots` back to 4, `ledger = [ { seq:1, actor:'human', action:'session_reset', ... } ]`,
   `unblinded = []`, `committed = null`, and the adversarial memo caches cleared
   (`resetAdversarialCaches()`, `04` §3.3) so `integrityEvents` re-derives
3. re-derive everything (§1.11), re-render, `persist(state)`

No page reload required, and a reload is equivalent. Reset restores the seed exactly — same scores,
same ranking, same flags, same seedHash. The button is a must-have (locked item 11) because a judge
who breaks the demo must be able to hand it back in one click.

---

## 6. Corpus specification — 12 manuscripts

### 6.1 The twelve

Sections listed in order; every manuscript opens with `abstract` (§1.1). `[INJ]` marks a reserved
injection slot and `[DECOY]` a reserved near-miss slot; **04 authors the text for both, this file
only reserves the locations.**

Three manuscripts carry payloads, which is what `01` AC-15 and AC-16 count. **Four payload instances
exist**, because MS-102 carries two: `05` §11.2 requires the filmed manuscript to show two
neutralized marks, in two different sections, at visibly different lengths, and one slot cannot do
that. `04` §7.3 measures them at 232 and 251 characters.

**Two decoy slots are reserved here.** `04` ships two near-miss fixtures that must *not* flag, and
they need homes on clean manuscripts — a decoy that fires shows up as a `sections_affected` entry on
a paper this table calls clean, which is exactly the signal it exists to give. `§7.3`'s
`check-corpus.mjs` asserts both slots are present and both stay at `attempts === 0`.

| Id | Working title | Field / subfield | Sections | Intended verdict |
|---|---|---|---|---|
| MS-101 | *Tidal Lattice Reconstruction of Subsurface Brine Channels at Erewhon Station* | Geophysics / cryospheric remote sensing | abstract, introduction, methods, results, discussion | Strong and clean. Novel method, careful validation, well written. Clear accept; near-tie for the top slot. |
| MS-102 | *A Replication Protocol for Zemblan Split-Window Thermometry Across Four Instrument Generations* | Atmospheric science / radiometric instrumentation | **abstract [INJ]**, introduction, related_work, methods, results, **discussion [INJ]** | Exceptional rigor and reproducibility, modest novelty. Ranks #1 by 0.05 and loses the top slot the moment novelty is weighted up. |
| MS-103 | *Lattice Sommelier: Learned Vintage Attribution from Laputan Cellar Spectra* | Machine learning / applied spectroscopy | abstract, introduction, methods, results, discussion | **The conflict case.** Genuinely new idea (novelty 10) sitting on a leaking train/test split and n=14 (rigor 3). Lands 0.10 off the accept boundary and trips two flags at once. Deliberately carries no payload so the conflict demo is not confounded. |
| MS-104 | *Slow-Light Interferometry in the Vespucian Fog Belt: A Two-Season Field Study* | Optics / atmospheric propagation | abstract, introduction, methods, results, limitations | Solid, unexciting, competently executed field study. Accept with minor revisions. The uncontroversial control case mid-queue. |
| MS-105 | *Governance Load and Quorum Failure in the Grand Fenwick Housing Cooperatives* | Computational social science | abstract, introduction, related_work, methods, results, discussion | Average across all four criteria. Borderline accept. Near-tie partner. |
| MS-106 | *ZEMBLA-IMP: A Benchmark Suite for Sparse Tide-Gauge Imputation* | Machine learning / benchmarks | abstract, introduction, methods, results, discussion, **data_availability [DECOY]** | Unoriginal but careful and genuinely useful. Wins the near-tie against MS-105 by 0.05 on rigor and clarity, and loses it if novelty is weighted up. |
| MS-107 | *Olfactory Wayfinding in the Erewhon Cave Salamander* | Behavioral ecology | abstract, introduction, **related_work [INJ]**, methods, results | Good question, underpowered design, weak controls, overclaimed abstract. Major revisions. |
| MS-108 | *Teaching Statistical Power with the Laputa Simulation Kit: A Classroom Trial* | Education research | abstract, introduction, methods, results, discussion | Modest and unglamorous, but unusually clear and fully reproducible. Scores 6.25 on the strength of the two criteria reviewers habitually discount. |
| MS-109 | *A Survey of Provenance Formats in Digital Archives of the Ruritanian Record* | Information science | abstract, introduction, **related_work [DECOY]**, methods, discussion | Competent survey, almost nothing new. Weak reject at default weights. |
| MS-110 | *Consciousness-Adjacent Signal Compression in Zemblan Coral Colonies* | Marine biology / speculative | abstract, introduction, methods, results, discussion, **data_availability [INJ]** | Thrilling claim, unfalsifiable method, no data release. Reject — and the manuscript whose payload most plausibly *wants* a better outcome. |
| MS-111 | *Re-derivation of the Fenwick Constant by Elementary Means* | Mathematics / pedagogy | abstract, introduction, methods, results | Beautifully written, elegantly argued, and the result has been known since 1958. Reject. |
| MS-112 | *Ten Reasons the Laputan Grid Is About to Fail* | Energy policy | abstract, introduction, results, discussion | Assertion stacked on assertion, no method, no data. Clear reject and the queue's floor. |

**Injection slots — four, on three manuscripts:** **MS-102 / abstract**, **MS-102 / discussion**,
**MS-107 / related_work**, **MS-110 / data_availability**. Four different sections, and three
different positions in the ranking (rank 1, rank 8, rank 10). MS-102 sits on the top-ranked paper,
which is the case where a reviewer is least likely to be suspicious, and it is the manuscript the
video films — hence its two marks.

`05` §11.2 asked for the injected manuscripts at ranks 2, 6 and 9, on the argument that "an injected
manuscript ranking #1 would imply the payload worked." **This file is canonical on the ranking and
takes the opposite position deliberately**: the payloads move no score at all — the seed scores in
§6.2 are authored, the sanitizer never touches them, and a neutralized span cannot influence a
composite. Rank 1 therefore implies nothing about the payload, and putting a payload on the paper a
reviewer is least likely to question is the sharper demonstration. `05` §11.2 is corrected to 1, 8,
10 and carries this reasoning.

**Decoy slots: MS-106 / data_availability, MS-109 / related_work.** Both on clean manuscripts, both
in the section type that makes them a genuine near miss for a payload elsewhere in the corpus —
MS-106's against MS-110's `data_availability` payload, MS-109's against the citation-framed prose in
MS-107's `related_work`.

### 6.2 Seed scores — `src/corpus/seed-scores.js`

`SEED_SCORES = { [manuscript_id]: { novelty, rigor, clarity, reproducibility } }`, integers 0..10.

| Id | novelty | rigor | clarity | repro | composite @ default |
|---|---|---|---|---|---|
| MS-101 | 9 | 9 | 8 | 8 | 8.65 |
| MS-102 | 8 | 9 | 9 | 9 | 8.70 |
| MS-103 | 10 | 3 | 7 | 4 | 5.90 |
| MS-104 | 6 | 8 | 7 | 8 | 7.25 |
| MS-105 | 7 | 7 | 6 | 7 | 6.85 |
| MS-106 | 5 | 8 | 8 | 7 | 6.90 |
| MS-107 | 6 | 5 | 7 | 5 | 5.60 |
| MS-108 | 4 | 6 | 9 | 8 | 6.25 |
| MS-109 | 3 | 6 | 6 | 6 | 5.10 |
| MS-110 | 7 | 4 | 4 | 3 | 4.70 |
| MS-111 | 2 | 5 | 7 | 4 | 4.20 |
| MS-112 | 2 | 3 | 3 | 2 | 2.50 |

`scripts/check-corpus.mjs` recomputes this table at build time and fails if any composite drifts
from the value above, if the two near-tie pairs are not exactly `(MS-101, MS-102)` and
`(MS-105, MS-106)`, or if the count of blocking-flagged items at seed is not 7. The demo's central
claim is that the numbers behave a specific way; a guard should be able to say so.

Only MS-103 trips `CRITERION_CONFLICT` at `CONFLICT_SPREAD = 6` (spread 7). MS-108 and MS-111 are
the runners-up at spread 5, and both are deliberately left one point under the line so the conflict
badge points at a single manuscript. This is why the constant is 6 and not 5: at 5 it would fire on
three items and stop naming the case it exists to name.

Verified by direct computation of §3.1 over the §6.2 table: composites reproduce to the cent, the
two near-tie pairs are `(MS-102, MS-101)` and `(MS-106, MS-105)`, `AT_DECISION_BOUNDARY` and
`CRITERION_CONFLICT` each match MS-103 alone, blocking-flagged count is 7, and the novelty-heavy
weights `{50,25,10,15}` give `MS-101 8.75 / MS-102 8.50 / MS-103 7.05 / MS-104 6.90`.

### 6.3 Fictionality labeling convention — mandatory, no exceptions

1. **Namespace.** Every proper noun in the corpus — place, institution, instrument, dataset,
   constant, journal, funding body — comes from a fixed literary-fictional list exported as
   `FICTIONAL_NAMESPACE` in `manuscripts.public.js`: *Erewhon, Zembla, Laputa, Vespucia, Grand
   Fenwick, Ruritania, Oceania, Brobdingnag, Kukuana, Costaguana*. `check-corpus.mjs` fails if a
   capitalized multi-word proper noun appears that is not on that list or on a small allowlist of
   generic terms.
2. **Record fields.** Every `Manuscript` carries `fiction: true` and
   `fiction_label: FICTION_LABEL`. Both are returned by `read_manuscript`, so the agent is told in
   band, on every call, that the content is fictional.
3. **No real identifiers anywhere.** No real DOI, URL, ORCID, email, person, or institution. DOIs
   use `10.0000/referee.demo.<id>`. Emails and links use the reserved `.invalid` TLD. ORCID-shaped
   ids use the all-zero block and the field is named `orcid_like`.
4. **In-app.** A persistent header banner: *"Demo corpus — all 12 manuscripts, authors, and
   institutions are fictional."* Plus a per-manuscript chip reading **FICTIONAL DEMO MANUSCRIPT** in
   the manuscript view, the queue row, and the split-screen header.
5. **Repo.** `corpus/README.md` states the same, and the top of both corpus modules carries the
   label as a file comment.

This convention is a safety property, not only an honesty one: injection payloads live in this
corpus, and every surface that renders them must be unambiguously marked as fabricated.

---

## 7. Section authoring rules (word counts and quote-ability)

### 7.1 Budgets

| Field | Target | Hard bounds |
|---|---|---|
| `abstract` section | ~115 words | 90–140 |
| `Section.text` (every other section) | ~250 words | 180–320 |
| Sections per manuscript | 5 | 4–6 (always including `abstract`) |
| Words per manuscript | ~1,100 | 800–1,500 |
| Corpus total | ~13,000 words | ≤ 16,000 |
| `manuscripts.public.js` on disk | ~90 KB | **≤ 250 KB** |

A single static module at that size parses in a few milliseconds and needs no splitting. If it ever
exceeds 250 KB, split by manuscript into `corpus/ms/MS-1xx.js` with a barrel — but do not
pre-optimize into that shape now, because more files means more places the guard must walk.

### 7.2 Quote-ability rules — these exist to make the evidence gate meaningful

1. Every section contains **at least four sentences of 70 characters or more**. `MIN_QUOTE_CHARS` is
   40 post-normalization, so a valid quote must always be available that is a *fragment* of a
   sentence rather than a whole short one. If the only 40-char spans were entire sentences, the gate
   would be testing sentence copying instead of span verification.
2. **No sentence of 40 or more normalized characters may repeat verbatim within a manuscript.**
   Quote matches are scoped to `(manuscript_id, section_id)`, so an intra-manuscript repeat would
   make the section attribution arbitrary. Cross-manuscript repetition is permitted and harmless.
3. Each section carries **at least two specific, quotable factual assertions** — a number, an
   instrument name, a sample size, a stated limitation. These are the spans a good finding will
   cite, and they are what makes the MS-103 conflict legible from the text rather than only from the
   score table.
4. Each of the **four** payload-bearing sections must read as normal prose before the payload span —
   at least 150 words for the four-hundred-word sections, and for MS-102's `abstract` the full 90–140
   word abstract, which is what a real hidden-instruction payload appends to. Neutralization has to
   look surgical in the split-screen rather than the section going dark.
5. **The two decoy sections must not be padded toward the payload shape.** They are ordinary
   scholarly prose that happens to contain the vocabulary a lazy detector keys on, and if they are
   written to look suspicious they stop being falsifiability tests and become decoration.
6. Prose is plain: no markdown, no HTML, no LaTeX, no tab characters, no non-breaking spaces
   *except* where 04 deliberately uses them inside a payload. Curly quotes and en/em dashes are
   permitted and encouraged in ordinary text — folding them is exactly the normalizer's job, and if
   the corpus contains none, that path is never exercised.

### 7.3 `scripts/check-corpus.mjs` asserts

12 unique ids matching `/^MS-1\d{2}$/`; 4–6 sections each with dense 1-based `order`, unique ids all
drawn from `SECTION_IDS`, and `sections[0].id === 'abstract'`; every `Figure.section_id` resolves;
all word counts within the §7.1 bounds and matching the stored `word_count`; rules 7.2.1 and 7.2.2
hold for every section; no character outside a stated allowlist; the §6.2 composite table reproduces
exactly; the two named near-tie pairs and the seed flag count hold; no proper noun outside
`FICTIONAL_NAMESPACE`.

It also asserts the adversarial layout, because §6.1 reserves it and nothing else checks it:
**exactly four `[INJ]` slots on exactly three manuscripts** (MS-102 ×2, MS-107, MS-110), **exactly
two `[DECOY]` slots** (MS-106, MS-109), and — by running `04`'s sanitizer over the built corpus —
`injection_attempts === 2` on MS-102 with `sections_affected === ['abstract','discussion']`,
`=== 1` on MS-107 and MS-110, and `=== 0` on the other nine including both decoy manuscripts. Prints the computed `seedHash` so it can be
pasted into a release note. Exit 1 on any failure.

---

## 8. Build order for this slice (dependency order, for 01's schedule)

1. `core/constants.js`, `core/deep-freeze.js`, `core/hash.js`, `corpus/field-paths.js` — no deps.
2. `corpus/rubric.js`, `corpus/seed-scores.js` — the numbers in §6.2, before any prose.
3. `core/ranking.js`, then verify §3.5 reproduces exactly. **Ranking is provable before a single
   word of manuscript prose exists.** Do this early; it is the demo's spine.
4. `core/state.js` (seed / load / persist / reset / validate), `core/ledger.js`,
   `core/visibility.js`, `core/refusals.js`.
5. `data/public-access.js`, `data/identity-access.js`.
6. `scripts/check-blinding.mjs` — **before** `tools/`, so the first handler written is written under
   the guard rather than retrofitted to it.
7. `corpus/manuscripts.public.js` prose (the long pole; 12 by ~1,100 words) and
   `corpus/manuscripts.identity.js`. The four injection slots and the two decoy slots (§6.1) are
   left as plain placeholder sentences for 04 to fill.
8. `scripts/check-corpus.mjs`.

---

## CONTESTED

Implemented exactly as locked. Three notes for the record; none change what Codex builds.

1. **`committed` is a single nullable object (locked item 7), which forces one commitment per
   session** over a queue of twelve. I implemented it literally: the human commits a recommendation
   for one manuscript, and that commit locks the session until reset (further
   `submit_recommendation` calls refuse with `ALREADY_COMMITTED`, `03` §1.3's name for it). This is a
   clean, defensible demo — the reviewer works the queue, then commits the one decision. But if the
   intent was a decision per manuscript, the change is one line of shape (`committed: {}` keyed by
   `manuscript_id`) plus the matching `validatePersisted` branch, and it should be made before any
   ledger data exists rather than migrated later, because §5.5 rules out migrations by design.

   **Resolved 2026-09-01: singular stands.** `03` §0.8 had independently implemented the map, with
   its own written justification, which meant two mutually exclusive builds were both specified as
   locked. `03` now reads `committed` through `committedFor(state, id)` against this shape, and
   `05` §6.4's confirm copy ("this closes your review for this session") was already written to the
   singular reading.

2. **`NEAR_TIE_EPSILON = 0.15` on a 0–10 scale flags 7 of 12 items as `REQUIRES_HUMAN_JUDGMENT` at
   seed** once the other blocking flags are counted. I believe that is correct — it is the honest
   reading of a rubric this coarse, and a flag that fires rarely would undersell the argument. But a
   judge skimming the queue sees more than half of it flagged, which can read as a broken gate
   rather than a strict one. If that lands badly, the fix is UI, not data: group the badge by reason
   so `NEAR_TIE` and `INTEGRITY_EVENTS_PRESENT` are visually distinct rather than one
   undifferentiated warning. Do not fix it by loosening the constant — the seed scores were chosen
   against 0.15 and the §6.2 guard asserts the resulting pairs.

3. **`Finding`, `HumanEvidence`, and `EditorFlag` are derived from the ledger, not persisted.** This
   is a reading of locked item 7's seven-key list rather than an addition to it, and I think it is
   the better design: it makes the append-only log the only way a finding can come into being, so
   the log cannot be incomplete. The cost is that every load replays the ledger. At demo volumes
   that is irrelevant; it would not survive a long-lived session with tens of thousands of entries,
   which this is not.

   **Resolved 2026-09-01: derivation stands, and it was very nearly lost quietly.** `03` §0.8 had
   `findings: Finding[]` persisted inside `scores[manuscriptId]` and `03` §5 pushed to it directly,
   which would have made a finding that the ledger does not show representable. `03` now appends the
   finding fields to the ledger row and derives the list, the same way it already derived `hasRead`.
   The derivation is `src/core/ledger.js → deriveFindings(state)`; `05` §14.3's `getFindings(id)` is
   a filter over `state.findings`, not a storage accessor.

---

## RECONCILED 2026-09-01

Single-writer reconciliation pass against `99-verification.md`. Rulings applied in this file:

- **R2 · this file is canonical for corpus identity.** Manuscript ids, section ids, the criterion
  set and the 0–10 score scale are `02`'s; `03`, `04`, `05` and `07` were renumbered to them.
- **R3 · `data_availability`** added to `SECTION_IDS`, carried only by MS-106 and MS-110.
- **R4 · refusal codes.** The second frozen set declared here is deleted; `03` §1.3's set is
  imported. `UNKNOWN_SECTION`, `UNKNOWN_CRITERION`, `SESSION_COMMITTED` and `MALFORMED_INPUT` are
  dead spellings.
- **R6 · state shape is canonical here.** `acceptSlots` given a home at `rubricWeights.acceptSlots`
  and admitted by `validatePersisted`, which would otherwise have discarded the blob on every load.
  `unblinded` is now `{id, reason, at}` records. `committed` stays singular. `findings`,
  `editorFlags` and `humanEvidence` stay ledger-derived and `03` stops persisting them.
- **R7 · the re-ranking event is this file's.** §3.5's executed numbers are untouched; `05` §11.2
  and `07` §1 were corrected to them.
- **R13 · the guard walks all of `src/` except `src/ui/`.** It named two directories and therefore
  walked neither `src/adversarial/` nor `src/tools/handlers/`; `01` AC-6 now states the same rule.
- **Coordinator conflict A · two payloads on MS-102** (`abstract` + `discussion`), so `05` §11.2's
  two-marks composition is satisfiable. Four `[INJ]` slots on three manuscripts, two `[DECOY]` slots
  newly reserved on MS-106 and MS-109. `abstract` became a real Section to carry one, because a
  top-level string is not something the sanitizer walks or `sections_affected` can name.

**The §3 and §6.2 arithmetic is deliberately untouched.** Which manuscripts carry payloads did not
change, so every composite, both near-tie pairs, the flag set and the blocking count of 7 stand as
executed, and `05` and `07` were edited to match them rather than the reverse.

Escalated rather than decided: `01` AC-4 requires searching tool returns for real author names,
which §2.5 forbids in the same breath ("the verifier would become the leak"). Both texts left as
their owners wrote them.

---

## RECONCILED PASS 2 - 2026-09-01

Second single-writer pass, against `99-verification-delta.md`. This file was the site of the
regression the delta calls the worst defect in the set.

- **D1 · §1.7's findings replay matched zero ledger rows.** It selected
  `outcome === 'ok'`; `03` §3's wrapper — the only writer — stamps `outcome: "accepted"`, and
  `03`:354 reads it back as `"accepted"`. The findings board was permanently empty, on camera, in
  the beat that holds three seconds on the *absence* of a refused finding. **`03` is the writer, so
  `'accepted'` wins.** `'ok'` is dead on a ledger row. This was the same fail-closed shape as the
  `!v.verified` bug the first pass was convened to repair, relocated one layer down by that pass's
  own fix.
- **D2 · `Finding` rewritten to `03` §5's emitted shape.** It shared no field names with the record
  `03` actually derives. `finding_id` / `criterion` / `section` / `verification{method, score,
  char_offset}` / `severity` / `score` / `status` / `superseded_by` / `asserted_at` replace
  `id` / `criterion_id` / `section_id` / `match{}` / `actor` / `created_at`. `status` now exists for
  `05` §14.3's `f.status === 'active'` filter, which had nothing to read.
- **D3 · §1.7 was still carrying the vocabulary seam 4 killed.** `similarity` → `score` (`04`'s
  name; `03`:1313 declares `similarity` dead), `char_start`/`char_end` → `char_offset`. `polarity`
  loses `'neutral'`: `03` §4.3's `enum` permits two values, so the third could never be written.
- **D4 · `LedgerEntry` reconciled to `03` §0.4's `appendLedger`.** Added `args_digest` and `note`,
  which everything writes and this file never declared; removed `detail` and `integrity`, which this
  file declared and nothing writes. `integrity` never reached a ledger row at all —
  `read_manuscript`'s digest carries only `manuscript_id`, `sections_requested`, `sections_returned`.
  The frozen-template and no-interpolation rule moved with the string, onto `note`, and now also
  governs `args_digest`. §5.4's discard row updated to `outcome: 'accepted'` / `note:`.
- **D5 · `Commitment.recommendation` is SINGULAR.** `minor_revisions` / `major_revisions` are dead.
  `03` §4.7's `inputSchema` `enum` is the executed gate and `01` P1 agrees; the human commit path was
  writing a spelling the agent's validator rejects, on `05` §6.4's closing shot.

*(The two shape decisions this block named as still open were ruled and applied in PASS 3 below.)*

---

## RECONCILED PASS 3 - 2026-09-01

Third pass. The nine items the second pass declined as shape decisions were ruled by the
coordinator; these are the ones landing in this file. **Standing principle for the pass: `03` is the
writer, so `03`'s shape wins unless the coordinator says otherwise.**

- **E1 · §1.11 `EditorFlag` is `03` §4.6's shape.** `category` → **`concern_type`**, and the enum
  is `03`'s six values (`prompt_injection`, `identity_leak_attempt`, `ethics`, `methodology`,
  `plagiarism_suspicion`, `other`). The two sets overlapped on `ethics` and `other` only, so this
  was never a rename — `scope`, `dual_submission` and `suspected_prompt_injection` are **dead**.
  `03` §4.6's `inputSchema` `enum` is the executed gate; a value this file declared that the gate
  rejects could never have been written. The term was chased into `01`, `05` and `07`.
- **E2 · `EditorFlag.id` and `HumanEvidence.id` adopt `03`'s id grammar.** `'EF-000019'` →
  `'flag_9c2ab740'` (`"flag_" + 8 hex`) and `'HE-000012'` → `'he_4f81c30d'` (`'he_' + 8 hex`),
  parallel to `Finding`'s `'f_' + 8 hex`. Three ledger-derived records, one id grammar, all three
  produced by `03` §5's `hash8`. The zero-padded counter forms are dead.
- **E3 · §1.10 `IntegrityEvent` loses every field with no writer.** `pattern_id`,
  `neutralized_excerpt`, `char_start`, `char_end` and `surfaced_to_agent` are deleted. `04` §3.3's
  `sanitizeSection` is the only emitter and writes none of them. The invariant `surfaced_to_agent`
  described is enforced by §2.5's runtime guard and needed no field to sit in.
- **E4 · `Finding.verification` gains `verified_against: 'agent_visible_text'`.** `04` §5 specified
  it and nothing wrote it; `03` §5 now stamps it on **both** accepting paths and `digest` carries it
  onto the ledger row. It is the one-field encoding of the sanitize↔verify resolution, visible to a
  judge reading the copied ledger.
- **E5 · `action: 'set_score'` deleted from §1.9's verb list — five human verbs, not six.** No tool
  writes a score (§1.6 says so outright) and the human's four moves are `unblind`, `add_note`,
  `set_weights`, `commit_recommendation`. Chased into `01` AC-22 and `05` §6.2.

**RULED 2026-09-01 — `IntegrityEvent.id` adopts `04` §3.3's readable form. Settled; do not
re-open.** §1.10's id is `` `${manuscript_id}:${section_id}:${span_index}` `` — `'MS-110:methods:1'`
above, `'MS-102:abstract:1'` in `04` §3.3 and `03` §4.1's example. `'IE-003'` is dead.

The escalation was correct and its premise held: these ids **do** cross the boundary. `03` §4.1's
`read_manuscript` returns `integrity.event_ids: string[]` and its example payload ships
`["MS-102:abstract:1","MS-102:discussion:1"]` to the agent. So this is a disclosure question, and
the disclosure is **deliberate and already made by the same object**: that return also carries
`integrity.sections_affected: ["abstract","discussion"]`, because the agent has to know which parts
of the text were altered in order to reason about what it received (`04` §6 keeps that pair as a
disclosed residual, on the record). The id therefore carries no information the agent does not
already hold — manuscript id it supplied, section name it was just given, and an ordinal within the
section — so the readable handle costs nothing and buys a human reading the split-screen a legible
key. **The `span_index` ordinal is the only new byte, and it is bounded by
`integrity.injection_attempts`, which is disclosed in the same object.**

**What is not acceptable, and was the actual defect:** `03` described these ids as *opaque* while
shipping the section name inside them. That language is deleted at `03`:160 and `03`:1088. Calling a
value opaque when it is not is a false claim in a project whose entire premise is honest boundaries,
and it is worse than the disclosure it was covering. State the disclosure; do not dress it up.
