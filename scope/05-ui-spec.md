# 05 — UI / UX SPEC

**Project:** Referee — double-blind peer-review room (OpenAI WebMCP Challenge)
**Slice owner:** UI/UX. **Not owned here:** data model, tool schemas, sanitizer, corpus authoring, schedule.
**Assumed available:** a `refereeBus` event emitter and a state object matching seam 7
(`referee.state.v1` = `{version, seedHash, scores, ledger, rubricWeights, unblinded:[], committed:null}`).
**Constraints inherited:** vanilla ES modules, no bundler, no framework, no npm build step, no backend,
no network calls, no LLM calls from the page. Therefore: **no web fonts, no icon package, no CSS
framework, no animation library.** Everything below is buildable with plain HTML/CSS/JS.

Every value in this document is a decision, not a suggestion. Where a decision could reasonably have
gone another way and the alternative is cheap, that is noted inline as `ALT:`. The builder should implement
the stated value and ignore the `ALT` unless blocked.

---

## 0. VISUAL DIRECTION — one committed mode

**Direction: THE MARKED-UP GALLEY PROOF.** The page is a typeset proof sheet that a careful reader
has been annotating. Warm paper ground, ink-black type, a serif for anything a human wrote and a
monospace for anything a machine did. Hairline rules instead of shadows. Marginal annotations instead
of tooltips. Tabular figures. Near-square corners. One accent.

**Hold the line against this reference set** (name it in review; if a screen does not belong in this
company, it is wrong): a journal galley proof with correction marks; a bound lab notebook; a court
docket sheet; Tufte's printed page — high data density, no chartjunk, annotation living in the margin
rather than in a floating bubble.

**Banned outright, because they are the tells:** rounded-everything (nothing exceeds 4px radius);
any gradient, anywhere, including the "subtle" ones; glassmorphism and backdrop blur; drop shadows on
cards; shimmer or pulse skeletons; Inter (or any single sans) at 16px doing every job; emoji as
iconography; a card grid floating on light grey; purple-to-blue anything; full-width hero type; icon
buttons without labels. **If a value could have come from a default template, change it.**

**Why, in two lines.** (1) The product's claim is *adjudication*, and adjudication surfaces in the real
world are printed instruments — journal proofs, docket sheets, audit logs — so the register earns
trust the demo has no time to argue for. (2) A warm-paper light UI is the single highest-contrast
choice against a ~500-submission field that will be almost entirely dark-mode-purple-gradient, and it
reads better in a compressed 3-minute video and in a Devpost thumbnail.

**One mode only: light.** No theme toggle, no `prefers-color-scheme` branch. Rationale: two days of
build, and a toggle doubles the contrast-verification surface for zero judged value. This is a
deliberate commitment, not an omission — say so in the About panel's one-line design note.

### 0.1 Palette (exact)

```css
:root{
  /* grounds */
  --paper:        #FBF9F4;  /* app ground */
  --paper-2:      #F3EFE6;  /* recessed: rails, code panes, below-cut cards, verdict bar */
  --card:         #FFFFFF;  /* raised: slate cards above cut, modals, desk panel */
  --rule:         #E2DCCF;  /* hairline border, 1px, everywhere */
  --rule-strong:  #C9C1AE;  /* dividers that must survive video compression */

  /* ink */
  --ink:          #14140F;  /* primary text            17.86:1 on --paper */
  --ink-2:        #4A4A40;  /* secondary text           8.52:1 on --paper */
  --ink-3:        #6B6B60;  /* meta, 11px mono          5.12:1 on --paper */

  /* semantic */
  --accent:       #1B4D8F;  /* links, focus ring, active control   7.98:1 */
  --agent:        #2E2A6E;  /* actor = agent                      11.95:1 */
  --human:        #14140F;  /* actor = human (same as ink, by design) */
  --accept:       #1F6B4A;  /* above cut, accepted outcome         6.12:1 */
  --refuse:       #A3231E;  /* refusal — a first-class event       7.10:1 */
  --caution:      #8A5B00;  /* human-only, unblinded, integrity     5.59:1 */

  /* tints (backgrounds only, never text) */
  --refuse-tint:  #FDF2F1;
  --refuse-flash: #F9DCD9;
  --caution-tint: #FFF6E8;
  --accept-tint:  #EEF5F1;
  --agent-tint:   #F0EFF7;
}
```

Contrast ratios above were computed from these exact hex values against `--paper` (#FBF9F4) using the
WCAG 2.x relative-luminance formula. **They are computed, not tool-verified — run one contrast checker
over the built page before shipping and correct any value that lands under 4.5:1.** Do not claim AA
compliance in the README until that pass is done. Text on `--card` (#FFFFFF) is strictly higher
contrast than on `--paper`, so the paper figures are the floor.

Tints are background-only. No text is ever set in `--refuse-tint`, `--caution-tint`, etc.

### 0.2 Type

No web fonts. System stacks only.

```css
--font-serif: ui-serif, "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif;
--font-sans:  ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
--font-mono:  ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
```

**Scale: a 1.2 modular ratio anchored at 15px**, rounded to whole px — 10 / 12 / 15 / 18 / 22 / 26 —
plus two off-scale utility sizes (11, 13) that exist only because monospace sets wider than sans and
needs finer steps to stay in the same optical band. Authored in rem against `html{font-size:16px}`.

| Token | px | Weight | Tracking | Line-height | Use | Family |
|---|---|---|---|---|---|---|
| `--t-micro` | 10 | 600 | `.09em`, uppercase | 1.2 | actor tags, chip labels, `FICTIONAL`, eyebrows | mono |
| `--t-meta` | 11 | 400 | `.02em` | 1.45 | ledger timestamps, `visible_fields_at_time`, stat captions | mono |
| `--t-code` | 12 | 400 | `0` | 1.5 | expanded ledger payloads, envelope fragments | mono |
| `--t-ui-s` | 13 | 400 | `0` | 1.5 | tool names, form hints, split-screen pane text | mono / sans |
| `--t-body` | 15 | 400 / 600 | `0` | 1.5 | default UI text, buttons, labels | sans |
| `--t-read` | 18 | 400 | `.002em` | 1.62 | manuscript prose, findings quotes, the integrity sentence | serif |
| `--t-title` | 22 | 600 | `-.008em` | 1.28 | manuscript title, modal titles | serif |
| `--t-display` | 26 | 600 | `-.011em` | 1.22 | integrity overlay title, empty-state plate | serif |

**Only two weights: 400 and 600.** System stacks do not reliably ship anything between, and faking it
with `font-weight:500` renders as 400 on Windows and 600 on macOS — a real cross-platform trap for a
demo that must look identical in the ChatGPT desktop browser and in Chrome. Never use `font-style:
italic` on the mono face (many system monos have no true italic and synthesize a bad oblique);
findings quotes get italic **serif** only.

**Nothing renders below 10px, and 10px is used only for uppercase letterspaced mono tags.** Every
numeric readout — scores, weights, counts, timestamps — carries `font-variant-numeric: tabular-nums`
so digits do not jitter while animating. Manuscript prose is capped at **68ch measure**; interface
prose at **74ch**; the integrity sentence at **62ch**.

### 0.2b The three text registers — the actual design system

The product has no images and no illustrations. It is text, evidence, and state, so **the type system
is the design.** There are exactly three registers and they must never be confusable at a glance.

| | **A — Manuscript prose** | **B — Machine output** | **C — Interface chrome** |
|---|---|---|---|
| what it is | the untrusted artifact | what the page and the agent did | the instrument's own labels |
| family | serif | mono | sans |
| size / lh | 18 / 1.62 | 10–13 / 1.45 | 13–15 / 1.5 |
| color | `--ink` | `--ink-2`, codes in `--ink` | `--ink` label, `--ink-3` hint |
| ground | `--card` | `--paper-2` with hairline | `--paper` |
| case | sentence | UPPERCASE for codes and tags, lowercase for tool names | sentence |
| alignment | left, ragged right, **never justified** (no hyphenation in the stack = rivers) | left | left |
| marker | 1px `--rule-strong` left margin rule + `SOURCE TEXT` eyebrow in the margin | enclosed in a hairline pane | none |

**The confusion test:** at 50% zoom with the text illegible, a viewer must still be able to say which
register each block is. If the ledger ever renders serif, or the manuscript ever renders mono, it is
wrong. The one deliberate exception: injection marks and removal stubs are **Register B set inside
Register A** — a machine annotation intruding on the artifact. That intrusion is precisely the point,
so it is allowed and must look like an intrusion.

### 0.3 Space, radius, border, shadow, motion

```css
--s-1:2px; --s-2:4px; --s-3:8px; --s-4:12px; --s-5:16px; --s-6:24px; --s-7:32px; --s-8:48px; --s-9:64px;
--r-chip:2px; --r-card:3px; --r-modal:4px;   /* nothing is rounder than 4px, ever */
--border: 1px solid var(--rule);
--rail: 4px;                                  /* the left actor/status rail width */
--shadow-modal: 0 24px 60px -20px rgba(20,20,15,.35);
--dur-fast:120ms; --dur-base:180ms; --dur-move:260ms; --dur-hold:900ms;
--ease-out: cubic-bezier(.22,.61,.36,1);
--ease-in-out: cubic-bezier(.4,0,.2,1);
```

**Shadow is used in exactly two places:** modal/overlay surfaces, and the sticky Verdict Bar's 1px top
hairline plus `0 -8px 16px -12px rgba(20,20,15,.18)`. Cards get borders, never shadows.

### 0.4 Icons

Inline SVG `<symbol>` sprite, defined once at the top of `index.html`, exactly nine icons:
`lock`, `shield`, `chevron-down`, `close`, `arrow-up`, `arrow-down`, `check`, `cross`, `link`.
16×16 viewBox, `stroke="currentColor"`, `stroke-width:1.5`, `stroke-linecap:square`,
`stroke-linejoin:miter`, `fill:none`. Square caps and mitered joins are the instrument register — do
not use rounded caps. **No emoji anywhere in the UI.**

### 0.5 Hatch — the one texture

A single 3px diagonal hatch is the app's only texture, and it always means *"withheld, removed, or
refused — something is deliberately absent here."* Never decorative.

```css
.hatch{ background-image: repeating-linear-gradient(45deg,
        var(--hatch-ink,rgba(20,20,15,.22)) 0 1px, transparent 1px 4px); }
```

Used on: blind strips (identity withheld), removal stubs (payload removed), refused ledger rails
(claim refused), the WebMCP-unavailable pill. Four uses, one meaning.

---

## 1. LAYOUT — one screen, no routing

### 1.1 Full wireframe (>=1440px, the recording viewport)

```
+-------------------------------------------------------------------------------------------------+
| [A] MASTHEAD                                                                            56px     |
|  REFEREE  ·  double-blind review room          [A3 AGENT PULSE] [A4 WEBMCP o] [About] [Reset]    |
+--------------------+---------------------------------------------+----------------------------- +
| [B] SLATE   340px  | [C] DESK           minmax(560px, 1fr)        | [D] LEDGER           380px   |
| +----------------+ | +-------------------------------------------+| +--------------------------+|
| | B1 RUBRIC RAIL | | | C1 INTEGRITY BANNER  (conditional, 48px)  || | D1 HEADER+FILTERS   44px ||
| |  NOVELTY  ===o | | |  /!\ 2 injected instructions removed  [->]|| |  LEDGER · 41 events      ||
| |  RIGOR    ==o  | | +-------------------------------------------+| |  [All][Agent][You][X]    ||
| |  CLARITY  =o   | | | C2 MANUSCRIPT HEADER                      || +--------------------------+|
| | REPRO     ==o  | | |  MS-102 · FICTIONAL                       || | D2 EVENT STREAM          ||
| |  ACCEPT TOP[4] | | |  Serif title, two lines max               || |  role=log aria-live      ||
| +----------------+ | |  +- IDENTITY --------------+              || | +----------------------+ ||
| | B2 SLATE LIST  | | |  | AUTHORS     ########    |  [Unblind...]|| | | |<> AGENT read_manu..| ||
| | +------------+ | | |  | AFFILIATION ##########  |              || | | |  ACCEPTED 14:22:07 | ||
| | |01 ABOVE 8.70 | | |  | FUNDING     #####       |              || | | |  visible: title,+8 | ||
| | | Title...   | | | |  +-------------------------+              || | +----------------------+ ||
| | +------------+ | | +-------------------------------------------+| | +----------------------+ ||
| | +------------+ | | | C3 VIEW BAR                               || | | |<> AGENT assert_fin.| ||
| | |02 ABOVE 8.65 | | |  [Manuscript][Findings][Integrity /!\2]    || | |#| REFUSED            | ||
| | +------------+ | | |  RECEIVED BY: [ Page ][ Agent ]           || | | |  EVIDENCE_NOT_FOUND| ||
| |  03 ...        | | +-------------------------------------------+| | +----------------------+ ||
| |  04 ...        | | | C4 PANEL BODY                     scrolls || | +----------------------+ ||
| | ~~ ACCEPT CUT ~| | |                                           || | | |[] YOU  unblind     | ||
| |  05 BELOW 6.85 | | |                                           || | | |  RECORDED 14:31:44 | ||
| |  ...           | | |                                           || | +----------------------+ ||
| |  12 BELOW 2.50 | | +-------------------------------------------+| |            v autoscroll  ||
| |                | | | C5 VERDICT BAR   sticky, 72px             || |                          ||
| |                | | | [LOCK] HUMAN ONLY                         || |                          ||
| |                | | | [Accept][Minor][Major][Reject] rationale  || |                          ||
| |                | | |                            [Commit]       || |                          ||
| +----------------+ | +-------------------------------------------+| +--------------------------+|
+--------------------+---------------------------------------------+------------------------------+
| [E] STATUS BAR   webmcp chrome-149 · tools 7/7 · calls 41 (3 refused) · seed a91f... ·    28px   |
|                  FICTIONAL CORPUS - 12 seeded manuscripts, no real authors                       |
+-------------------------------------------------------------------------------------------------+

OVERLAYS (never routes; all are <dialog>):
  [F] INTEGRITY SPLIT-SCREEN   [G] UNBLIND MODAL     [H] OFF-PAPER EVIDENCE MODAL
  [I] ABOUT DRAWER             [J] COMMIT CONFIRM    [K] RESET CONFIRM
```

### 1.2 Region register

Every region has a stable id, an owner module, and a mount node. One module per region; modules
subscribe to `refereeBus` and render only their own subtree.

| Id | Region | DOM id | Module | Re-renders on |
|---|---|---|---|---|
| A | Masthead | `#masthead` | `ui/masthead.js` | `webmcp:changed` |
| A3 | Agent Pulse | `#agent-pulse` | `ui/pulse.js` | `tool:invoked`, `tool:settled` |
| A4 | WebMCP pill | `#webmcp-pill` | `ui/masthead.js` | `webmcp:changed` |
| B1 | Rubric Rail | `#rubric-rail` | `ui/rubric.js` | `state:changed{rubricWeights, acceptSlots}` |
| B2 | Slate List | `#slate-list` | `ui/slate.js` | `state:changed{scores, rubricWeights, selected, committed, unblinded}` |
| C1 | Integrity Banner | `#integrity-banner` | `ui/desk.js` | `integrity:detected`, `state:changed{selected}` |
| C2 | Manuscript Header + Identity | `#desk-header` | `ui/identity.js` | `state:changed{selected, unblinded}` |
| C3 | View Bar | `#desk-viewbar` | `ui/desk.js` | local |
| C4 | Panel Body | `#desk-body` | `ui/desk.js` | `state:changed{selected, findings}`, `tool:settled` |
| C5 | Verdict Bar | `#verdict-bar` | `ui/verdict.js` | `state:changed{selected, committed}`, `tool:settled` |
| D1 | Ledger header / filters | `#ledger-head` | `ui/ledger.js` | `tool:settled`, `human:action` |
| D2 | Event stream | `#ledger-log` | `ui/ledger.js` | append-only, never full re-render |
| E | Status bar | `#statusbar` | `ui/statusbar.js` | `tool:settled`, `webmcp:changed` |
| F–K | Overlays | `#dlg-integrity` … `#dlg-reset` | one module each | on open |

**Hard rule: D2 is append-only in the DOM as well as in state.** Never re-render the ledger list. A
full re-render destroys scroll position and kills the entrance animation mid-demo. Rows mutate only
to expand/collapse their own `<details>`, or to receive the one-shot refusal wash.

### 1.3 Grid

```css
.app{
  display:grid;
  height:100dvh;
  grid-template-columns: var(--col-slate) minmax(560px,1fr) var(--col-ledger);
  grid-template-rows: 56px minmax(0,1fr) 28px;
  grid-template-areas:
    "masthead masthead masthead"
    "slate    desk     ledger"
    "status   status   status";
  background: var(--paper);
  --col-slate: 340px;
  --col-ledger: 380px;
}
.app > *{ min-height:0; min-width:0; }        /* load-bearing: without it the panes blow the grid out */
#slate, #desk-body, #ledger-log{ overflow-y:auto; overscroll-behavior:contain; }
```

`min-height:0` on the grid children is not optional. Without it the three scroll panes push the grid
past the viewport and the whole page scrolls, which destroys the one-screen claim.

The Desk is a nested grid:

```css
#desk{ grid-area:desk; display:grid; background:var(--card);
       border-left:var(--border); border-right:var(--border);
       grid-template-rows: auto auto auto minmax(0,1fr) auto; }
/* C1 banner (auto, 0 when absent) · C2 header · C3 viewbar · C4 body (1fr, scrolls) · C5 verdict */
```

### 1.4 Breakpoints — desktop-first

**Minimum viewport that must not break: 1024 x 640.** Record the video at 1440 x 900.

| Range | Behavior |
|---|---|
| >=1440 | Reference layout. `--col-slate:340px; --col-ledger:380px`. |
| 1180–1439 | `--col-slate:300px; --col-ledger:340px`. Ledger rows move the `visible_fields_at_time` line into the `+ fields` disclosure. Slate titles clamp to 2 lines instead of 3. |
| 1024–1179 | **Ledger detaches** to a right-edge drawer: `position:fixed; inset:56px 0 28px auto; width:380px;` with `--shadow-modal`, toggled from the masthead by a button carrying an unread count (`LEDGER · 3`). Default open. `inert` when closed. Desk keeps `minmax(560px,1fr)`. |
| <1024 | **Not supported, by decision.** `01` W11 refuses "mobile-responsive layout below tablet width" outright: judges use desktop and the split-screen needs the pixels. The page renders its 1024 layout and the viewport scrolls. |

**1024 is the floor and it is a real floor.** This spec previously specified two full stacked tiers
below it — a 640–1023 tier with a `role="tablist"` nav, a fixed bottom Verdict Bar and a rotated
split-screen connector, and a sub-640 tier — which is precisely the work `01` W11 names and declines.
W11 is a WON'T, and `01` says of the WON'T list: do not build them, do not stub them, do not leave
TODOs for them. Two responsive tiers is not a stub. They are removed rather than deferred, and `§13`
no longer offers cutting a tier that no longer exists.

**What collapses, explicitly, at 1024–1179:** the Ledger (to the drawer above), the Rubric Rail (a
`<details>` collapsed by default, summary `RUBRIC WEIGHTS — 4 criteria`), the identity block's two
columns (to one column of nine rows, which is taller but this is not the recording viewport), and
the split-screen connector gutter (a 32px horizontal band). **Nothing is removed at any supported
width** — all four human affordances and all seven tool surfaces stay reachable at 1024.

200% browser zoom at 1440 renders as a 720px viewport, which is below the supported floor. That is
an accepted consequence of W11, not a regression to fix.

---

## 2. DEMO-CRITICAL SURFACE 1 — THE LEDGER

The ledger is the instrument's paper tape. It scrolls on camera and it closes the video, so it is
designed for legibility at video compression and for reading at a glance, not for density alone.

### 2.1 Refusal is not an error — the governing rule

Policy refusals arrive from the tool layer as **returned values** shaped `{ok:false, code, message}`.
They are never thrown, and nothing has gone wrong when one appears. A refusal is the system doing its
job, and it is the whole thesis. It must therefore be styled as a *first-class settled outcome*, in a
visual language deliberately kept separate from the app's actual error language.

| | **Refusal** (`ok:false`) | **Error** (page/browser fault) |
|---|---|---|
| where | the ledger, inline, permanent | the error band under the masthead, or an in-region error plate |
| color | `--refuse` #A3231E on `--refuse-tint` | `--ink` on `--paper-2`, no red at all |
| icon | none. A `REFUSED` word-chip plus a hatched rail | the `cross` glyph |
| tone | *"Page refused: quote not found in manuscript source."* | *"This panel failed to render."* |
| motion | a 1200ms settle wash — it is announced, not apologized for | none |
| ledger | always recorded | **never recorded** (see §8.3) |

Copy always names the actor and the act: **"Page refused"**, never "Error", "Failed", "Denied by
system", or "Oops". The page is the one refusing, and saying so out loud is the product.

### 2.2 Header and filters (D1, 44px)

```
LEDGER  41 events                                        [ ↓ ] [ ⧉ ]
[ All 41 ] [ Agent 33 ] [ You 8 ] [ Refused 3 ]
```

- Title `LEDGER` in `--t-micro`; count in `--t-meta`, tabular-nums, `--ink-3`.
- Filter chips: `role="group"`, each a toggle `<button aria-pressed>`. Height 26px, padding `0 10px`,
  radius `--r-chip`, `--t-micro`. Unselected: `--paper-2` ground, `--rule` border, `--ink-2` text.
  Selected: `--ink` ground, `--paper` text. `Refused` selected uses `--refuse` ground, `--paper` text.
  Filters are **view-only** — they never delete rows; hidden rows get `hidden` plus `aria-hidden`.
- `[ ↓ ]` = autoscroll pin toggle (`aria-pressed`, default **on**, label "Follow new events").
  Turns off automatically if the human scrolls up more than 40px; a small `↓ 3 new` button appears at
  the bottom edge to re-pin. This is what stops the ledger fighting the presenter mid-demo.
- `[ ⧉ ]` = "Copy ledger as JSON" (clipboard only — no network). Label on hover/focus.

### 2.3 Row anatomy

Comfortable density: three lines, 76px tall typical, 8px gap between rows, no zebra striping.

```
+--+---+------------------------------------------------------+
|▌ | ◇ | AGENT · assert_finding              ⌁untrusted  [›]  |   line 1
|▌ |   | REFUSED  EVIDENCE_NOT_FOUND                          |   line 2
|▌ |   | 14:22:07.412  visible: id, title, abstract, +3       |   line 3
+--+---+------------------------------------------------------+
```

Row grid: `grid-template-columns: 4px 20px minmax(0,1fr) auto; column-gap: var(--s-3);`

**The rail (column 1, 4px, full row height)** — the actor signal, readable at any size:

| actor / state | rail |
|---|---|
| human | solid `--human` (#14140F) |
| agent, accepted | solid `--agent` (#2E2A6E) |
| agent or human, **refused** | `--refuse` **plus the 3px hatch** — the only rail with texture |

**The glyph (column 2, 20px)** — `■` for human, `◇` for agent, drawn as inline SVG (`fill` for human,
`stroke` for agent), 12px, `aria-hidden="true"`. Filled = the person; hollow = the machine.

**Line 1** — `ACTOR · tool_name`. Actor in `--t-micro` (`AGENT` / `YOU`); separator a thin `·`;
tool name in `--t-ui-s` mono `--ink`. Right-aligned: the `untrusted` tag (2.4) and a `chevron-down`
disclosure glyph that rotates 180° over `--dur-fast` when expanded.

**Line 2** — the outcome chip plus a one-clause human summary in `--t-ui-s` `--ink-2`.

| chip | ground | text | when |
|---|---|---|---|
| `ACCEPTED` | transparent, 1px `--accept` | `--accept` | `ok:true` |
| `REFUSED` + ` ` + code | `--refuse` filled | `--paper` | `ok:false` — code appended in `--t-micro` |
| `RECORDED` | transparent, 1px `--ink-2` | `--ink-2` | any `human:action` |

Refused rows additionally get: `background: var(--refuse-tint)`, `border:1px solid var(--refuse)` on
all four sides, `border-radius: var(--r-card)`. They are the only bordered rows, so a refusal is
visible in peripheral vision while scrolling. Summary copy for the five refusal codes that reach a ledger row on camera:

- `EVIDENCE_NOT_FOUND` — "Page refused: that quote is not in the manuscript source."
- `QUOTE_TOO_SHORT` — "Page refused: the quote is under the 40-character floor."
- `REQUIRES_HUMAN` — "Page refused: the recommendation is the reviewer's to make."
- `HUMAN_ONLY` — "Page refused: unblinding is the reviewer's to do."
- `OUT_OF_ORDER` — "Page refused: the agent has not read that section yet."

**`REQUIRES_HUMAN` and `HUMAN_ONLY` were inverted here, and this is the copy a judge reads on
camera.** `03` §1.3 is canonical and the mapping is: `submit_recommendation` returns
`REQUIRES_HUMAN` (*the decision* is the human's), `request_unblind` returns `HUMAN_ONLY` (*the
visibility change* is the human's). This file had them the other way round in four places
(§2.3, §6.1, §6.4, §8.5), and `05` §11.3 beats 6 and 7 put both on screen.

**`BLINDED_FIELD` is deleted, not renamed.** No file defines it and `03` §7 rule 3 forbids the whole
family: *"There is no `BLINDED_SECTION` code and there must never be one."* A refusal code that
names a blinded field is an identity oracle — it tells the agent that the thing it asked for exists
and is being withheld, which is precisely the inference structural blinding is built to make
impossible. A request for a blinded field takes the same `SECTION_NOT_FOUND` path as a nonsense
name, so there is no distinct row for the ledger to style.


**Line 3 (meta)** — `--t-meta` `--ink-3`: `HH:MM:SS.mmm` tabular-nums, then two spaces, then
`visible:` followed by the `visible_fields_at_time` list, comma-separated, truncated at 4 entries with
a `+N` affordance. **This line is never omitted.** It is the quiet proof that the blinding is per-call
and recorded, and a judge who reads one row will read this one. Below 1180px it moves into the
disclosure.

**Expanded state** — `<details>` opens a `--paper-2` pane with `--border`, 12px padding, `--t-code`
`<pre>` showing `args` and the returned envelope, pretty-printed 2-space, with the `blinded_fields`
array and the `integrity` object highlighted by a 2px `--caution` left border. Full
`visible_fields_at_time` is listed here in full. Max-height 320px, `overflow:auto`.

### 2.4 The `untrustedContentHint` tag

`read_manuscript` and `check_claim` are registered with
`annotations:{ readOnlyHint:true, untrustedContentHint:true }`. Rows for those two tools carry a small
right-aligned tag on line 1: the `link`-style glyph `⌁` plus `untrusted` in `--t-micro` `--ink-3`,
inside a 1px dotted `--rule-strong` outline, 2px radius, no fill.

`title="Declared to the browser as untrustedContentHint — this tool returns text that came from the
manuscript, not from us."`

**This earns its pixels.** It is the standard's own vocabulary agreeing with the thesis, it costs a
span, and a judge who recognizes the annotation gets a small reward for looking closely. The same
annotation is spelled out in full in the About drawer's tool registry (§10.1) and cited once in the
integrity overlay footer (3.6).

### 2.5 Entrance, motion, and the refusal wash

- New row: `@keyframes ledger-in` — `opacity 0→1`, `translateY(-6px)→0`, `--dur-base` `--ease-out`.
- Accepted rows: entrance only, then a 900ms rail flash (`width: 4px → 7px → 4px`, `--ease-in-out`).
- **Refused rows: entrance, then a 1200ms settle wash** — `background` animates
  `--refuse-flash` (#F9DCD9) → `--refuse-tint` (#FDF2F1) with `--ease-out`. The row briefly reads
  about twice as saturated and then settles into its permanent state. It never fades to neutral: the
  refusal stays visibly marked forever. Simultaneously the Ledger column's left border flashes
  `--refuse` for 400ms.
- Autoscroll: only while pinned — `log.scrollTo({top: log.scrollHeight, behavior: reduced ? 'auto' :
  'smooth'})` after `requestAnimationFrame`.
- DOM cap: render at most **400** rows; beyond that, drop from the top of the DOM (state keeps all)
  and show a sticky top strip `— 62 earlier events not shown · Copy full ledger —`.
- `prefers-reduced-motion: reduce` — no translate, no wash animation; the refused row simply appears
  in its final `--refuse-tint` state, and the rail flash is replaced by a static 2px outline held for
  1200ms.

---

## 3. DEMO-CRITICAL SURFACE 2 — THE SPLIT-SCREEN INTEGRITY REVEAL

**This is the single most important frame in the submission.** It must be arresting on a still, with
no audio, to someone who has read nothing. Roughly 20 seconds of a 180-second video. Build it well or
build nothing else.

### 3.1 How it opens — three entry points, one overlay

1. **The Integrity Banner (C1).** When `read_manuscript` settles for a manuscript with
   `integrity.injection_attempts > 0`, a 48px banner slides down at the top of the Desk
   (`height 0→48px` plus `opacity`, `--dur-base` `--ease-out`). Ground `--caution-tint`, 4px hatched
   `--caution` left rail, `shield` glyph, copy in `--t-body`:
   **"This manuscript tried to instruct the agent. The page removed 2 injected passages before the
   agent read a word."** Right side: a primary-ghost button
   **`Show what the agent received →`**. Dismissible (`✕`), but the shield chip in the manuscript
   header persists for the session.
2. **The `Integrity` segment** in the View Bar (C3), badged with the count.
3. **Any integrity row in the ledger** — the row's summary text is a button that opens the overlay
   scrolled to that specific payload.

Opening the overlay **automatically appends a human ledger event**
`{actor:'human', action:'add_note', manuscript_id, note:'integrity panel inspected'}` — `02` §1.9's
closed verb list has no `integrity_inspected`, and the row's human-readable string is `note`, not
`detail` (`03` §0.4 is the writer; `detail` is dead on a ledger row). It comes from the frozen
template table, never from manuscript text. Inspection is itself a
reviewer act and belongs on the record; it also means the ledger has a fresh human row waiting when
the camera cuts back.

### 3.2 Overlay frame

Native `<dialog>` + `showModal()` (focus trap and Esc for free; both targets support it).

```css
#dlg-integrity{ inset:32px; width:auto; max-width:1360px; margin:auto;
  background:var(--card); border:1px solid var(--rule-strong); border-radius:var(--r-modal);
  box-shadow:var(--shadow-modal); padding:0; }
#dlg-integrity::backdrop{ background:rgba(20,20,15,.62); }
```

Entrance, 240ms `--ease-out`: dialog `opacity 0→1` and `scale(.985)→1`; backdrop `opacity 0→1` over
180ms. Reduced motion: opacity only, 1ms.

Vertical structure: header 64px · sentence band 92px · panes `1fr` · footer 76px.

### 3.3 Header (64px)

Left: eyebrow `INTEGRITY` (`--t-micro`, `--caution`) over `MS-102 — <serif title, truncated>`
(`--t-title`). Center-right: payload pager `‹ 1 of 2 ›` in `--t-meta` mono (only when >1); `←`/`→`
also drive it. Far right: `close` glyph button, 44×44. One `--rule` hairline underneath.

### 3.4 The sentence — the copy that does the work

Centered in a 92px band, `--t-read` serif, `--ink`, max-width **62ch**, `text-wrap:balance`:

> **The manuscript tried to give the agent instructions. The page removed them before the agent could read a single word.**

Nothing else in that band. Two sentences, 20 words, no jargon, no product name, no "leverages". A
judge who reads only this line understands the entire submission. Do not edit it, do not add to it,
and do not put a subtitle under it.

### 3.5 The two panes

```css
.integrity-body{ display:grid; grid-template-columns: 1fr 72px 1fr; }
```

Both panes: `--paper-2` ground, `--t-ui-s` mono 13/1.65, 24px padding, `overflow:auto`,
`overscroll-behavior:contain`, 1px `--rule` border. The center column is the connector gutter.

**Pane headers (36px, sticky within each pane):**

- Left: a 7px `--refuse` square, then `PAGE RECEIVED` (`--t-micro`), then in `--t-meta` `--ink-3`:
  `raw source · integrity_events[]`.
- Right: a 7px `--accept` square, then `AGENT RECEIVED` (`--t-micro`), then
  `read_manuscript() → text`.

Squares, not dots — round dots are the template tell; a 7px square reads as a printer's mark.

**Marking the payload (left pane).** Each injected span is wrapped:

```html
<mark class="payload" data-payload="1">…injected text…</mark>
```

```css
.payload{ background:#FBE3E0; color:var(--ink); border:1px solid var(--refuse);
          border-radius:2px; padding:1px 2px; box-decoration-break:clone; }
```

Plus three reinforcements, because a highlight alone dies at video bitrate:

1. A **superscript badge** immediately before the mark: `INJECTION 1` in `--t-micro`, `--paper` text
   on `--refuse` fill, 2px radius, `padding:1px 5px`, `vertical-align:2px`.
2. A **24px hatched gutter stripe** on the containing block: a `::before` absolutely positioned at
   `left:-24px`, full block height, `--refuse` hatch at 30% — visible from across a room and it
   survives compression when the inline highlight does not.
3. The containing block gets `border-left:3px solid var(--refuse)` and 12px extra left padding.

**Marking the absence (right pane) — the part everyone gets wrong.** At the exact document position
where the payload was removed, render a **removal stub**, never empty space:

```
    +- - - - - - - - - - - - - - - - - - - - - - - - - - -+
    |        232 CHARACTERS REMOVED BY THE PAGE            |
    +- - - - - - - - - - - - - - - - - - - - - - - - - - -+
```

`border:1px dashed var(--ink-3)`, radius 2px, `--paper` ground, min-height 34px, centered
`--t-micro` `--ink-3`, `margin:8px 0`, `data-payload="1"`. The stub is **per payload, not a total**: the art above is payload 1, FX-1 in `abstract`, measured at **232** characters in `04` §7.3; payload 2 (FX-2 in `discussion`) reads **251**. Only §3.6's footer carries the 483 total. **Absence must be a designed object.** A
gap reads as a rendering bug; a labelled stub reads as an enforcement action.

**The connector gutter (72px).** A 1px `--rule-strong` vertical hairline down the center. For each
payload/stub pair, a 26px circle centered on the gutter, vertically positioned at the midpoint of the
two elements' bounding boxes, `--card` fill, 1px `--refuse` border, containing an `arrow-right` glyph
in `--refuse`, plus 1px `--refuse` horizontal leader lines running to each pane edge. Recompute
positions on scroll and on resize via `ResizeObserver` + the scroll handler, throttled to `rAF`.

**Linked hover/focus.** Hovering or focusing either the mark or its stub adds `.is-linked` to both
(matched on `data-payload`): the mark's border goes 2px, the stub's dash goes solid `--refuse`, and
the connector circle fills `--refuse` with a `--paper` arrow. `--dur-fast`. This is what makes the
still frame legible — the eye is told which absence belongs to which intrusion.

**Synchronized scrolling.** On scroll of either pane, set the other's `scrollTop` proportionally
(`other.scrollTop = (this.scrollTop / (this.scrollHeight - this.clientHeight)) * (other.scrollHeight -
other.clientHeight)`), guarded by an `isSyncing` flag cleared on the next `rAF` to avoid a feedback
loop. Proportional rather than absolute, because the right pane is shorter by exactly the removed
characters — and that length difference is itself part of the point.

**Pager behavior.** `‹ ›` and `←`/`→` scroll both panes so the active pair is centered
(`behavior:'smooth'`, `'auto'` under reduced motion), set `.is-linked` on the pair, and hold a 1.4s
`--refuse` 2px outline on both. Focus moves to the mark (`tabindex="-1"`).

### 3.6 Footer (76px)

`--paper-2` ground, top hairline. Three stat tiles, then the envelope line, then one button.

```
INJECTION ATTEMPTS  2   |  SECTIONS AFFECTED  abstract, discussion  |  CHARACTERS REMOVED  483
The agent's tool return carried only this:            [ ⌁ untrusted ]  [ Close ]
integrity: { injection_attempts: 2, sections_affected: ["abstract","discussion"] }
```

Stat tiles: label `--t-micro` `--ink-3` above value `--t-title` mono tabular-nums `--ink`, separated
by 1px `--rule` verticals. The figures are MS-102's, measured in `04` §7.3: two spans, 232 + 251 =
**483** characters removed. `references` is not a section id in `02` §1.2 and never was — this
footer showed one until 2026-09-01, in the frame `05` §3 calls the most important in the submission. The envelope fragment is `--t-code` in a `--card` pane with `--border`.

One line under it, `--t-meta` `--ink-3`:
*"`read_manuscript` is registered with `untrustedContentHint: true`. The browser is told this text is
untrusted; the page is what actually does something about it."*

That sentence is where the standard's vocabulary and the thesis shake hands. Keep it.

### 3.7 The in-Desk echo — a second, cheaper angle

The overlay is not the only place this lives. The Desk's View Bar (C3) carries a two-state segmented
control, always visible on any manuscript:

```
RECEIVED BY:  [ Page ]  [ Agent ]
```

`Page` (default) renders the raw manuscript with the same `.payload` marks and gutter stripes.
`Agent` renders the cleaned text with the same removal stubs. Toggling is instant (`display` swap, no
crossfade — a crossfade would blur the diff). On a clean manuscript both views are identical and the
control shows a `--t-meta` note `no difference — nothing was removed from this manuscript`, which is
itself worth showing on camera right before switching to a dirty one.

---

## 4. DEMO-CRITICAL SURFACE 3 — LIVE RE-RANKING

Motion is the video's only source of kinetic energy. There are no charts, no images, no 3D. When the
reviewer drags a weight, twelve manuscripts must physically reorder on screen and two of them must
cross a line. That crossing is the thing the eye should be drawn to.

### 4.1 The Rubric Rail (B1)

Four criteria, `--paper-2` ground, `--border` bottom, 16px padding.

```
RUBRIC WEIGHTS                                    [ Reset to venue defaults ]
NOVELTY          ▄▄▄▄▄▄▄▄▄▄▄▄▄○─────────────      30
RIGOR            ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄○───────────      35
CLARITY          ▄▄▄▄▄▄○──────────────────────    15
REPRODUCIBILITY  ▄▄▄▄▄▄▄▄○────────────────────    20
                                   weights need not total 100
ACCEPT TOP  [ − ]  4  [ + ]   of 12
```

Each criterion is a 44px-tall row (touch floor) laid out
`grid-template-columns: 92px minmax(0,1fr) 34px; align-items:center; column-gap:12px`.

- Label: `--t-micro`, `--ink-2`.
- Control: `<input type="range" min="0" max="100" step="5">`. Track 3px, `--rule`, radius 0. Filled
  portion `--ink` (via a `background: linear-gradient` driven by a CSS custom property updated on
  input, since cross-browser `::-moz-range-progress` / `::-webkit-slider-runnable-track` differ —
  set `--fill: 35%` on the element and paint the track with it in one rule that works in both).
  Thumb: **10×18px vertical bar**, `--ink`, `--r-chip`, 1px `--paper` inner border. A rectangular
  thumb, not a circle — this is the galley-proof register, and circles are the template tell.
- Readout: `--t-body` mono tabular-nums, `--ink`, right-aligned, 34px fixed width so it never shifts.
- The four criteria are `02` §1.5's, in `02`'s declaration order, at `02`'s default weights
  `{novelty 30, rigor 35, clarity 15, reproducibility 20}`. **`IMPACT` is not a criterion** — this
  rail carried it, and `03` carried `significance`, against `02`'s `reproducibility`; three rubrics
  for one rubric. The label column widens to 116px to fit `REPRODUCIBILITY` in `--t-micro`.
- `weights need not total 100` note in `--t-meta` `--ink-3`. `02` §3.1 divides by `Σw`, so the
  weights are **not** required to sum to 100 and the UI must not normalize them, display a
  normalized percentage as if it were the value, or validate against a total. That was a deliberate
  data-model decision to delete a class of validation bug; a UI that re-imposes the constraint
  reintroduces it. Show the raw slider value, which is what the human moved and what persists.
- `ACCEPT TOP` stepper: two 32×32 buttons and a tabular readout, min 1, max 11.

### 4.2 The slate card

```
+---------------------------------------------------------------+
|▌ 01   ABOVE CUT                                     8.70      |
|                                                                |
|   A Replication Protocol for Zemblan Split-Window              |
|   Thermometry Across Four Instrument Generations               |
|                                                                |
|   WITHHELD FROM AGENT  ▨▨▨▨▨▨▨▨▨▨  9 fields   ⚠2   4 findings  |
+---------------------------------------------------------------+
```

- 112px tall (3-line title: 128px), `--card` ground above the cut, `--paper-2` below, `--border`,
  `--r-card`, 4px left rail.
- Rank number `--t-body` mono tabular-nums `--ink-3`; status word `ABOVE CUT` / `BELOW CUT` in
  `--t-micro` — **a word, never color alone**; composite `--t-title` mono tabular-nums,
  right-aligned, **two decimals on `02` §3.1's 0–10 scale** (8.70, not 78.2). The 0–100 figures this
  spec used to carry were a third scale against `02`'s 0–10 and `03`'s 0–5. Reserve 5 characters,
  not 4, so `10.00` cannot shift the row.
- Title `--t-read` serif, `-webkit-line-clamp:3` (2 below 1180px).
- Footer strip: the blind strip (§5.1), then the integrity chip `⚠ 2` in `--caution` when applicable,
  then finding count in `--t-meta`.
- Rail: `--accept` above the cut, `--rule-strong` below. Selected card: rail `--accent` 4px→6px,
  ground `--card`, `--border` becomes `--accent`.
- Hover: `--border` → `--rule-strong`, no lift, no shadow, no scale. Galley proofs do not levitate.
- The whole card is a `<button class="card-select">` in a `<li>`; the blind strip is a nested button
  (valid because the outer element is authored as `<div role="button" tabindex="0">` with keydown
  handling for Enter/Space — nested interactive content inside a real `<button>` is invalid HTML and
  breaks screen readers. Use the div+role form for the card, a real `<button>` for the strip).

### 4.3 The cut line

A real element in the list flow at index `acceptSlots`:

```html
<li class="cut-line" role="separator" aria-label="Accept cut line. 4 above, 8 below.">
```

2px dashed `--ink`, full width, with a centered inset label on `--paper` ground:
`— ACCEPT CUT —` in `--t-micro` `--ink`, `padding:0 10px`. 20px vertical margin. It participates in
the FLIP list but only moves when `acceptSlots` changes.

### 4.4 FLIP — exact implementation

Fires on the slider's `input` event (live during drag, not `change`).

```js
function reorder(listEl, sortedIds){
  const cards = [...listEl.querySelectorAll('[data-ms]')];
  const first = new Map(cards.map(el => [el.dataset.ms, el.getBoundingClientRect().top]));

  // LAST — mutate DOM order
  sortedIds.forEach(id => listEl.appendChild(listEl.querySelector(`[data-ms="${id}"]`)));
  placeCutLine(listEl);

  // INVERT
  const moved = [];
  cards.forEach(el => {
    const dy = first.get(el.dataset.ms) - el.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) return;
    el.style.transition = 'none';
    el.style.transform  = `translateY(${dy}px)`;
    moved.push(el);
  });

  // PLAY
  requestAnimationFrame(() => requestAnimationFrame(() => {
    moved.forEach((el, i) => {
      el.style.transition = `transform 260ms cubic-bezier(.22,.61,.36,1) ${Math.min(i,5)*14}ms`;
      el.style.transform  = '';
    });
  }));
}
```

- **Duration 260ms. Easing `cubic-bezier(.22,.61,.36,1)`** (decisive out-ease — starts fast, settles
  without bounce; bounce would read as playful and this is an instrument).
- **Stagger 14ms per card, capped at 5 cards (70ms max).** Enough to read as a cascade rather than a
  jump-cut; not enough to feel slow while dragging.
- Cleanup on `transitionend`: clear `transition` and `transform` inline styles.
- Mid-flight input: do not cancel. FLIP re-reads real rects every call, so a new invocation during an
  in-flight transition self-corrects. Coalesce calls to one per animation frame.
- The **score readout tweens** over the same 260ms via a `rAF` counter to one decimal — a card whose
  number is visibly climbing while it slides is worth more on camera than either alone.
- Rank badges cross-fade 120ms.

### 4.5 Crossing the cut line — the moment the eye should catch

When a card's above/below state flips, add `.crossed-up` or `.crossed-down` for 900ms:

**Crossing up (into accept):**
1. Rail animates `--rule-strong` → `--accept` over 200ms, starting at 260ms (after the slide lands —
   the color change must not compete with the movement).
2. Ground animates `--paper-2` → `--card` over 200ms.
3. A chip `↑ ENTERED ACCEPT` (`--t-micro`, `--paper` on `--accept`, `--r-chip`) fades in over 120ms
   at the card's top-right, holds 500ms, fades out over 180ms.
4. Status word changes `BELOW CUT` → `ABOVE CUT`.
5. A single 1px `--accept` horizontal leader briefly draws across the cut line at the crossing point,
   400ms, then fades — the visual sentence "this one came from the other side."

**Crossing down:** mirror, with `--ink-3` rail, `--card` → `--paper-2` ground, chip
`↓ FELL BELOW` (`--paper` on `--ink-2` — **not red**; falling below the cut is not a refusal and must
not borrow the refusal color).

Both directions also fire a debounced `aria-live` announcement (§9.4).

**Ledger writes are throttled to `change`, not `input`.** A slider drag fires `input` dozens of times;
writing a ledger row per frame would flood the tape and destroy the very artifact the video ends on.
One row per committed change: `{actor:'human', action:'set_weights', criterion, from, to,
rank_deltas: n, crossed: [ids]}`.

### 4.6 Reduced motion

`@media (prefers-reduced-motion: reduce)`: skip FLIP entirely — reorder the DOM directly. Any card
whose rank changed gets a static 2px `--accent` outline held 400ms; any card that crossed gets its
chip shown statically for 1200ms. The `aria-live` announcement is unchanged. Score readouts snap.

---

## 5. DEMO-CRITICAL SURFACE 4 — THE BLINDED MANUSCRIPT CARD

The design problem: show a human reader that identity **exists and is being withheld from the agent**,
without it reading as missing data, a loading state, or a bug. The solution is that the absence is
*labelled, measured, and interactive* — three things a bug never is.

### 5.1 The blind strip (compact form, on slate cards)

```html
<button class="blind-strip" aria-label="Author identity withheld from the agent. 9 fields. Activate to unblind for yourself.">
  <span class="blind-strip__label" aria-hidden="true">WITHHELD FROM AGENT</span>
  <span class="blind-strip__bar hatch" style="--w:104px" aria-hidden="true"></span>
  <span class="blind-strip__count" aria-hidden="true">9 fields</span>
</button>
```

**The count is nine, and it is `02`'s.** `BLINDED_FIELD_NAMES` (`02` §1.9.1) is a frozen array of
nine names, derived from `IDENTITY_FIELD_PATHS`, identical on every manuscript and on every tool
return. This spec said three, `03`'s examples said five. That is the same defect §15's C1 raised and
then withdrew: C1 verified the *mechanism* (a constant, not a computed diff — correct) and never
checked the *value*, which is exactly the failure mode C1 was written to catch. The card renders the
whole constant; a truncated display of a blinding constant reads as a bug on camera, and worse, it
would make the identity block disagree with the `blinded_fields` array printed two lines below it.

- Bar: `height:12px; width:var(--w); border-radius:1px;` `--paper-2` ground under the 3px hatch, 1px
  `--rule-strong` border. The compact strip shows **one** summary bar, not nine: its width derives
  from the longest withheld value on the human side (`Math.min(160, 6 + len * 5.6)`), so cards still
  have the ragged, plausible widths that stop a redaction reading as a placeholder, and the count
  chip carries the number. Nine bars do not fit a 112px card and would turn the slate into a barcode.
- The label `WITHHELD FROM AGENT` in `--t-micro` `--ink-3` sits immediately left of the bar. **The bar
  never appears without it.** This single line is the difference between "designed" and "broken".
- Button hit area 44px tall via padding; the visible bar stays 12px.
- Hover/focus: bar border → `--caution`, hatch opacity 22% → 34%, and a marginal note appears to the
  right in `--t-meta` `--ink-3`: `click to unblind — recorded`. Marginal note, not a floating tooltip:
  it is laid out in flow (`visibility` toggle on a reserved slot), because a galley proof annotates in
  the margin.

### 5.2 The identity block (expanded form, Desk header C2)

```
+- IDENTITY ------------------------------------------------------------------+
|  AUTHORS         ▨▨▨▨▨▨▨▨▨▨▨▨      ACKNOWLEDGEMENTS  ▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨       |
|  AFFILIATIONS    ▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨   AUTHOR NOTES      ▨▨▨▨▨▨▨▨▨              |
|  FUNDING         ▨▨▨▨▨▨▨▨▨         CORRESPONDENCE    ▨▨▨▨▨▨▨▨▨▨▨▨▨          |
|  EXTERNAL LINKS  ▨▨▨▨▨▨▨▨▨▨▨       PRIOR SUBMISSIONS ▨▨▨▨▨▨▨▨▨▨▨▨▨▨         |
|  CONFLICT OF INTEREST  ▨▨▨▨▨▨▨                                              |
|                                                                             |
|  blinded_fields: ["authors","affiliations","funding","acknowledgements",     |
|    "author_notes","correspondence_email","external_links",                   |
|    "prior_submission_history","conflict_of_interest"]                        |
|  absent from every agent tool return — not masked                            |
|                                                          [ Unblind… ]        |
+-----------------------------------------------------------------------------+
```

- `--paper-2` ground, `--border`, `--r-card`, 16px padding, **640px min-width** (was 320px). Legend
  `IDENTITY` in `--t-micro` `--ink-3` sitting on the border (a `<fieldset>`/`<legend>` pattern — the
  proof-sheet box, and it is semantically right).
- **Nine rows in two columns**, `grid-template-columns: repeat(2, 132px minmax(0,1fr));
  column-gap:20px; row-gap:6px`, filled column-major so the first column reads
  `AUTHORS · AFFILIATIONS · FUNDING · EXTERNAL LINKS · CONFLICT OF INTEREST` and the second reads
  the remaining four. Label `--t-micro` `--ink-3` in the 132px column, then the hatched bar.
- **Bar widths are re-derived for the narrower cell:** `Math.min(96, 6 + len * 3.2)`, down from
  `Math.min(160, 6 + len * 5.6)`. The ragged-width property survives — that is what the formula is
  for — inside a cell half as wide.
- **The block is now ~150px tall rather than ~110px.** Nine rows stacked in one column would have
  been ~320px and would have pushed the manuscript body out of the recording frame; two columns of
  five and four is what keeps `05` §11.3 beat 1 ("identity block fully visible") shootable at
  1440×900. See §14 note 9 — this is the one place the nine-name constant costs layout.
- The `blinded_fields` line in `--t-code` mono `--ink-2` — Register B, deliberately, because this is
  the machine's own record. The clause **"absent from every agent tool return — not masked"** in
  `--t-meta` `--ink-3` directly under it. That word *masked* is doing load-bearing work: it is the
  distinction between this build and the obvious version of this build. Do not cut it.
- `Unblind…` — secondary button, 32px, `--border`, `--t-body`, with the `lock` glyph.

### 5.3 The unblind interaction and the post-unblind state

Covered end-to-end in §6.1. The visual result:

- The nine hatched bars are replaced by the real values in `--t-read` serif `--ink`, each animating
  `opacity 0→1` over 200ms with a 60ms stagger, and each holding a 1px `--caution` bottom border for
  the session.
- A persistent chip appears in the block header and on the slate card:
  `UNBLINDED · 14:31 · reason on file` (`--t-micro`, `--caution` text, 1px `--caution` border,
  `--caution-tint` fill).
- **And one line appears under the block, in `--t-body` `--ink`:**

  > **The agent's view did not change.**

  Six words that state the entire architecture. It appears only after unblinding, it never disappears,
  and it is the second-best line in the product after the integrity sentence. Under it, in
  `--t-meta` `--ink-3`: `blinded_fields is still all nine names on every call
  the agent makes.`

- The ledger row for the unblind carries `visible_fields_at_time` for the **agent**, unchanged — which
  is the same claim, made in machine language, two feet to the right on screen.

---

## 6. THE FOUR HUMAN-ONLY AFFORDANCES

All four are reachable by keyboard alone (paths in §9.2). All four write to the ledger with
`actor:"human"`. None of them can be opened, prefilled, or dismissed by an agent tool call — a tool
call may only ever cause a *chip* to appear that the human then chooses to act on. **No agent action
opens a dialog. Ever.** That rule is the difference between a human gate and a human speed bump.

### 6.1 Unblind, with a required reason

**Trigger** — `Unblind…` in the identity block, or clicking a blind strip on a slate card (which
selects that manuscript first, then opens the modal).

**Modal `#dlg-unblind`** — `<dialog>`, 520px, `--r-modal`, `--card`, `--shadow-modal`, 24px padding.

1. Title `Unblind author identity` (`--t-title` serif) + `MS-102` eyebrow.
2. A caution block: `--caution-tint`, 4px `--caution` left rail, 12px padding, `--t-body`:
   *"Unblinding is recorded in the ledger with your reason and cannot be undone for this session.
   The agent's view will not change."*
3. `<label for="unblind-reason">Reason (required)</label>`, then three quick-reason chips that fill
   (not lock) the field: `Conflict-of-interest check` · `Suspected duplicate submission` ·
   `Desk-reject sanity check`. Then `<textarea id="unblind-reason" rows="3" minlength="12">`,
   `--t-body`, `--border`, `--r-chip`, focus ring `--accent`. Live counter `12 minimum · 0` in
   `--t-meta`, turning `--ink-2` once satisfied.
4. Buttons, right-aligned: `Cancel` (ghost) · `Unblind and record` (primary, `--ink` fill, `--paper`
   text, 40px). Primary is `aria-disabled="true"` below 12 chars with an inline hint
   `Add a reason to continue` — **not** a greyed-out button with no explanation.

**On submit:** append ledger `{actor:'human', action:'unblind', manuscript_id, reason,
visible_fields_at_time}` → push `{id, reason, at}` into `state.unblinded` (`02` §5.1: records, not
bare ids, because the reason has to live where the unblind lives) → persist → close → focus moves to
the revealed author line, which flashes a 1px `--caution` outline for 600ms. No toast; the identity
block is its own confirmation (§5.3).

The `action` verb is `02` §1.9's `unblind`, from its closed five-verb list
(`set_weights | unblind | add_note | commit_recommendation | session_reset`; `set_score` was a
declared sixth with no writer and is dead). This spec
had invented `request_unblind.approved`, `retune_rubric` and `integrity_inspected`; a ledger with
three vocabularies for one set of human moves is not an audit artifact. `retune_rubric` is
`set_weights`, and opening the integrity overlay appends `add_note` with a fixed `note` rather than
a fourth verb.

**When the AGENT calls `request_unblind`:** the tool returns `{ok:false, code:'HUMAN_ONLY'}`. The
ledger gets a refused row. The identity block gains a pending chip:
`Agent requested unblinding · 14:33  [ Review… ]` (`--caution-tint`, hatched rail). `Review…` opens
the same modal with the agent's stated reason quoted read-only above the human's own required reason
field, labelled `AGENT'S STATED REASON — not sufficient on its own`. **This is a strong 8-second video
beat: the agent asks, the page refuses, the human decides.**

`HUMAN_ONLY` is the code for the *visibility change*; `REQUIRES_HUMAN` is the code for the
*decision* (§6.4). This file had them inverted at all four sites. `03` §1.3 is canonical.

### 6.2 Add off-paper evidence

Reviewers know things the manuscript does not contain. That channel exists and is human-only.

**Trigger** — `+ Add off-paper note` in the Findings panel header (Desk, `Findings` view).

**Modal `#dlg-offpaper`** — 560px. Fields:

| Field | Control | Required |
|---|---|---|
| Claim | `<textarea rows="3">` | yes |
| Source | `<input type="text">`, placeholder `e.g. arXiv:2411.09912, or "reviewer's prior knowledge"` | yes |
| Criterion | `<select>` — the four rubric criteria + `unassigned` | no |
| Severity | segmented radio: `minor` · `major` · `blocking` | yes, default `major` |

**On save** the note joins the Findings list with a distinct treatment: `--caution` 4px left rail,
`OFF-PAPER · YOU` chip, **no** `VERIFIED QUOTE` badge (it is not from the manuscript and must never
borrow that badge's authority), and a small `◇✕` glyph with the marginal note
`not visible to the agent`.

**That lock is not a preference — it is seam 6.** An off-paper note can name the author, the venue, or
a competing submission. Returning it through `get_review_state` would hand the agent an oracle for a
blinded field. So off-paper notes are **never** included in any agent payload, there is no toggle, and
the UI says so on every note. State it in the modal too, in `--t-meta` under the buttons:
*"Off-paper notes stay on your side. Returning them to the agent could leak what the blinding
removes."*

### 6.3 Retune the rubric weights

Mechanics in §4. End-to-end:

- **Pointer:** drag the thumb. `input` → rescore → FLIP. `change` (pointerup) → one ledger row.
- **Keyboard:** `←`/`→` ±5, `↑`/`↓` ±5, `PageUp`/`PageDown` ±20, `Home` 0, `End` 100. Native range
  behavior; do not reimplement it.
- `aria-valuetext` is set on every change to e.g. `"Novelty, weight 35 of 100"` — without it a screen
  reader announces a bare number with no unit.
- `Reset to venue defaults` restores `02`'s `default_weight` values `{30, 35, 15, 20}` and
  `acceptSlots: 4`, runs one FLIP, and writes one ledger row.
- The ledger verb is `set_weights` (`02` §1.9), once per settle, never once per pixel of drag.
- The slate announces the consequence, not the cause (§9.4).

### 6.4 Commit the recommendation — the Verdict Bar (C5)

Sticky footer of the Desk, 72px, `--paper-2`, 1px `--rule-strong` top border,
`box-shadow:0 -8px 16px -12px rgba(20,20,15,.18)`, 4px `--caution` left rail, `lock` glyph, and the
label `HUMAN ONLY` in `--t-micro` `--caution`.

```
[LOCK] HUMAN ONLY   ( Accept )( Minor revision )( Major revision )( Reject )
                    Rationale to editor: [___________________________]  [ Commit ]
```

- Segmented `role="radiogroup"` `aria-label="Recommendation"`, four 40px buttons. Unselected:
  `--card`, 1px `--rule`, `--ink-2`. Selected: `--ink` fill, `--paper` text, `--t-body` 600. Arrow
  keys move and select; `Tab` enters and leaves the group as one stop.
- Rationale: single-line `<input>`, `minlength="20"`, flex-grow, `--t-body`.
- `Commit` — primary, 44px, `--ink` fill. Disabled until a radio is selected **and** rationale ≥20
  chars, with the live inline reason rendered beside it in `--t-meta`
  (`Choose a recommendation` → `20 characters minimum · 14`). Never a bare grey button.
- **Confirm step** (`#dlg-commit`, 480px), because seam 7 makes `committed` singular and final:
  *"Commit **Major revision** for MS-102? This closes your review for this session and is recorded in
  the ledger."* `Cancel` · `Commit recommendation`.

**On commit:** `state.committed = {manuscript_id, recommendation, rationale, committed_at, by:'human',
ledger_seq}` (`02` §1.11's `Commitment`; the field is `recommendation`, and its four values are
`accept | minor_revision | major_revision | reject` — **singular**, `03` §4.7's enum and `01` P1) →
ledger row `commit_recommendation` → the bar
collapses over 220ms into its committed state: `--accept` 4px solid rail, `--accept-tint` ground,
`check` glyph, `COMMITTED · Major revision · 14:41 · you` with a `View in ledger →` link that filters
and scrolls the ledger. The radios become inert (`aria-disabled`, `pointer-events:none`, `--ink-3`).
The Desk gains a 24px top band `REVIEW CLOSED` in `--t-micro` on `--accept-tint`.

**When the AGENT calls `submit_recommendation`:** returns `{ok:false, code:'REQUIRES_HUMAN'}` → refused
ledger row → **and the Verdict Bar reacts.** Its `--caution` rail flashes to 8px and back three times
over 700ms total, and a line appears directly beneath the bar on `--caution-tint`:

> **The agent tried to commit a recommendation at 14:39. The page refused. This decision is yours.**

Held 8s, then it collapses into a persistent `1 blocked attempt` chip in the bar that stays for the
session and is clickable (filters the ledger to that row). Reduced motion: no flash; a static 2px
`--caution` outline held 1.2s. `aria-live="assertive"` on the line — this is one of only two
assertive announcements in the app.

**This is the closing shot of the video.** Specify it, build it, and shoot it last.

---

## 7. AGENT-ACTIVITY FEEDBACK — the page must feel alive while the agent works

### 7.1 Bus contract (what the UI subscribes to)

The UI owns none of these emissions; the tool layer must emit them. This is the UI slice's required
interface — if a name changes, it changes here first.

| Event | Payload | Emitted |
|---|---|---|
| `webmcp:changed` | `{phase, registered, total:7, failed:[]}` | boot and each registration settle |
| `tool:invoked` | `{callId, tool, actor:'agent', argsSummary, ts}` | at handler entry |
| `tool:settled` | `{callId, tool, actor, ok, code?, summary, envelopeSummary, visible_fields_at_time, ts}` | at handler return, **for both `ok:true` and `ok:false`** |
| `human:action` | `{id, action, note, ts}` | every human affordance |
| `state:changed` | `{keys:[...]}` | after any persisted mutation |
| `integrity:detected` | `{manuscript_id, injection_attempts, sections_affected}` | when a manuscript with payloads is first read |

`tool:settled` **must fire for refusals.** They are returned values, not exceptions, so there is no
`catch` to hang this on — the handler returns `{ok:false,…}` and emits on the same path as success.
A refusal that never reaches the bus is a refusal the video cannot show.

`state:changed` carries dirty keys so regions re-render selectively. Nothing ever re-renders the whole
app; a blanket re-render would clobber ledger scroll position and any in-flight FLIP.

### 7.2 Registration lifecycle — `registerTool` is async

`document.modelContext.registerTool()` returns a promise. There is a real window in which the page is
painted and interactive but the tools are not yet callable. **That window is a designed state, not a
flicker.** The WebMCP pill (A4) has five phases and never skips ahead:

| phase | pill | detail |
|---|---|---|
| `probing` | `WEBMCP —` `--ink-3`, dotted 1px border | first paint, before feature detection resolves. It is also the pill's initial render before any event arrives. **`03` §6.1 emits it explicitly** as the first `webmcp:changed` of the session, ahead of `detectModelContext()` and therefore ahead of the first `registerTool` — so the state is driven and testable rather than inferred from the absence of an event. Typically one frame; it is not clamped, because a probe that takes longer is exactly what a judge should see. |
| `registering` | `REGISTERING 3/7` `--caution` on `--caution-tint`, hatched 3px left edge | tabular-nums counter increments as each promise resolves. |
| `live` | `WEBMCP LIVE 7/7` `--accept` on `--accept-tint`, solid 7px `--accept` square | **only after all seven resolve.** |
| `partial` | `WEBMCP PARTIAL 5/7` `--refuse` on `--refuse-tint` | one or more rejected; click opens a disclosure naming which and the rejection message. |
| `unavailable` | `WEBMCP UNAVAILABLE` `--ink-2` on `--paper-2`, hatched | no `document.modelContext` (§8.4). |

Registration is **sequential**, inside one awaited async function, per `00` §D5 — which is
authoritative on the API and says to register all seven in sequence and flip the indicator only
after the whole thing resolves. `03` §6.1 emits a `webmcp:changed` on each settle, which is what the
counter counts. (This spec said `Promise.allSettled`; a parallel registration would give the counter
nothing to count in order and contradicts a locked decision in `00`.) The counter animates by whole
numbers with no easing — a machine counter, not a progress bar. Minimum visible duration for `registering` is
**500ms** even if registration resolves instantly: a state that flashes past is a state a judge will
think is missing, and this one is worth seeing. During `registering`, the Agent Pulse reads
`AGENT — TOOLS REGISTERING` and the status bar reads `tools 3/7`.

Detection:
```js
const hasWebMCP = typeof document !== 'undefined'
  && document.modelContext
  && typeof document.modelContext.registerTool === 'function';
```

### 7.3 The Agent Pulse (A3, 28px, masthead)

A 28px ring plus a mono label. It is the only element in the app that moves without human input.

| state | ring | label |
|---|---|---|
| idle | 1.5px `--rule-strong` hairline ring | `AGENT IDLE` `--t-micro` `--ink-3` |
| invoked | conic-gradient sweep, `--agent`, 1.1s linear infinite rotation | `read_manuscript…` `--t-ui-s` mono `--ink` |
| settled, `ok:true` | ring snaps to solid 2px `--accept`, `check` glyph centered, held 700ms | `read_manuscript ✓` |
| settled, `ok:false` | ring 2px `--refuse`, `cross` glyph, held **900ms** (longer than success, deliberately) | `assert_finding ✕ EVIDENCE_NOT_FOUND` |
| decay | 300ms cross-fade back to idle | `AGENT IDLE` |

**The sweep never fakes completion.** If no `tool:settled` arrives within 4s the sweep simply
continues; there is no timeout that pretends the call finished. After 10s the label appends
`… still running`.

Reduced motion: no rotation. A static 8px square inside the ring that changes color and glyph, with a
300ms cross-fade between states.

### 7.4 Contextual echoes — the rest of the page reacts

A tool call should land somewhere other than the ledger, or the ledger reads as a log file next to a
static page.

- **`read_manuscript` settles for the open manuscript** → the Desk body gets a 2px `--agent` outline
  for 600ms, fading out. The agent just read what you are looking at.
- **`assert_finding` accepted** → the new finding row entrance-animates in the Findings panel
  (`--dur-base`, translateY(-6px)), **and the verified quote's span in the manuscript text gains a
  persistent 2px `--agent` underline** (`text-decoration-thickness:2px; text-underline-offset:3px;
  text-decoration-color:var(--agent)`), with a marginal `◇` in the left margin at that line. Clicking
  either scrolls to the other. This is the best quiet moment in the build: the agent's claim is
  visibly anchored in the source, in the margin, like a proof correction.
- **`assert_finding` refused** → **nothing appears in Findings.** The refused claim does not exist as
  a finding; it exists only in the ledger. Instead the Findings header shows
  `2 refused — see ledger →`, which filters the ledger to `Refused`. That the refused claim is absent
  from the findings list *is* the enforcement, and the absence is worth pointing at on camera.
- **`check_claim`** → the return's three-value `result` (`03` §4.4, `04` §6's fixed enum) gets three
  distinct treatments, because a boolean's worth of echo would hide the case that matters most:
  `SUPPORTED` → the checked span pulses a 1px `--accent` underline for 500ms; `NOT_SUPPORTED` → no
  span pulses (there is none) and the Pulse row reads `checked — not supported` in `--muted`;
  `INDETERMINATE` → the Pulse row reads `checked — indeterminate` in `--caution` and **no span is
  marked either way**, since the page does not know and must not imply a miss. All three are ledger
  rows with `outcome: 'accepted'` — the call succeeded in every case.
  **The pulsed span is located page-side, never from the return.** `check_claim`'s payload carries no
  `char_offset` and no `normalized_quote` (`03` §4.4, `04` §6 — stripped so an unlimited free tool
  cannot be walked as a positional oracle), so the human panel calls the verifier itself to place the
  underline. This is the split-screen's normal posture: the page may show the human anything, the
  return hands the agent an enum. Do **not** implement the pulse by reading an offset off the
  `check_claim` result — there is none, and adding one back reopens the leak. `§7.4`'s persistent
  accepted-finding underline is the different case: that one legitimately draws on `assert_finding`'s
  `char_offset`, which survives because the gate already verified the agent's own quote.
- **`get_review_state` / `flag_for_editor`** → ledger and Pulse only; no page echo. Not everything
  needs an echo, and echoing everything would make the page twitchy. The flag's ledger and Pulse
  rows read its **`concern_type`** verbatim — `03` §4.6's enum, so `prompt_injection`, never
  `suspected_prompt_injection`, and the field is not `category`.

---

## 8. EMPTY, LOADING, ERROR, AND WEBMCP-ABSENT STATES

### 8.1 Empty states

Every empty state teaches the thesis. None of them says "Nothing here yet."

| Region | Copy |
|---|---|
| Desk, no manuscript selected | `--t-display` serif **"Select a manuscript from the slate."** Under it, `--t-body` `--ink-2`, max 62ch: *"Twelve fictional submissions. The agent can read all of them. It cannot see who wrote any of them."* Then a ghost button `Open the top-ranked manuscript`. Above the plate, a 1px `--rule` box containing the hatch at 8% — the empty state carries the app's texture rather than a grey void. |
| Ledger, no events | `--t-body` `--ink-2`, centered, 74ch: *"No activity yet. Every tool call the agent makes — accepted or refused — lands here, with the fields it could see at the time."* |
| Findings, none | *"No findings yet. A finding is only accepted if the agent quotes the manuscript and the quote verifies against the source."* |
| Findings, agent has been refused but has none accepted | The above, plus the `2 refused — see ledger →` link. The absence is the story; do not hide the link behind a zero state. |
| Integrity view, clean manuscript | A 7px `--accept` square + *"Nothing was removed from this manuscript. The page and the agent received the same text."* Plus the `Page`/`Agent` toggle showing no difference. |
| Slate, filtered to nothing | Not possible — the slate has no filter. Do not build one. |

### 8.2 Loading

The corpus is a static ES module. First paint should beat a single frame, so a spinner would be a lie.

- **Skeletons are delayed 400ms** and only render if boot has genuinely not completed. Six slate-card
  skeletons: `--paper-2` blocks with the 3px hatch at 8%, exact card dimensions, no shimmer, no pulse.
  **Shimmer is a template tell and it is banned here** (§0).
- The Desk shows the empty plate immediately, never a skeleton.
- The Ledger shows its empty copy immediately.
- The one genuinely slow thing is tool registration, and it has its own designed state (§7.2). Do not
  conflate the two: the page is *loaded* long before the tools are *live*, and the UI says both.

### 8.3 Error states

**Refusals are not errors** (§2.1) and never appear here.

| Case | Treatment |
|---|---|
| `localStorage` unavailable, blocked, or over quota | A 40px band under the masthead, `--paper-2`, 1px `--rule-strong`, `--t-body`: *"This browser isn't saving session state. Everything still works — your review resets when you close the tab."* Dismissible. |
| `referee.state.v1` present but `version` mismatched or JSON-invalid | Same band: *"A saved session from an older version was found and reset to the seed."* Plus a `Details` `<details>` with the parse error in `--t-code`. Reset is automatic — never try to migrate a schema during a two-day build. |
| A region throws during render | An **error plate scoped to that region only**, never a whole-page crash: `--paper-2` ground, `--border`, `--t-body` *"This panel failed to render."* + `Reload panel` + `Copy diagnostics` (clipboard). Every region module wraps its render in try/catch and mounts its own plate. The other three regions keep working — a judge should never see a blank app. |
| Uncaught exception anywhere | `window.onerror` / `unhandledrejection` → the band, plus `console.error`. |

**System errors are never written to the ledger.** Seam 8 closes the `actor` domain at
`"agent" | "human"`, and a page fault has neither. Inventing `actor:"system"` would corrupt the one
artifact the whole submission rests on. Errors go to the band and the console. Called out again in
§15.

### 8.4 WebMCP-absent — the judge without the flag

Assume this is how a meaningful share of judges will first see the page.

**The app remains fully usable.** Nothing is disabled, nothing is greyed. A human can read all twelve
manuscripts, unblind, add off-paper notes, retune the rubric, watch the slate re-rank, open the
integrity split-screen, and commit a recommendation. Every human-only affordance is human-only
regardless of whether an agent exists.

1. **Pill:** `WEBMCP UNAVAILABLE`, `--ink-2` on `--paper-2`, hatched left edge. **Not red.** This is
   not an error; it is a browser without a flag.
2. **A 44px band** directly under the masthead, full width, `--paper-2`, 1px `--rule-strong` bottom,
   `--t-body`, one line, no scroll:

   > **This browser isn't exposing WebMCP, so the agent side is inactive. Open in the ChatGPT desktop app's browser, or Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled.** `[ Copy flag URL ]`

   `chrome://` URLs cannot be linked or opened by script, so the flag path is a **copy button**, not a
   link. `Copy flag URL` writes `chrome://flags/#enable-webmcp-testing` to the clipboard and the
   button label swaps to `Copied` for 1.6s.
3. **There is no second button.** A `Watch the agent side ▸` control used to sit here and start
   Replay Mode; Replay Mode is cut (CUT banner below), so the control is cut with it. The band is one
   line of copy and one copy button. The judge-without-the-flag path is this band plus
   `docs/environment-check.md`, and the video's insurance is the Checkpoint C backup take (`06` §6).

**Partial registration** (`registerTool` resolved for some, rejected for others) gets its own honest
treatment rather than being rounded to either extreme: pill `WEBMCP PARTIAL 5/7` in the refusal
palette, click opens a disclosure listing each failed tool name and its rejection message in
`--t-code`. Do not silently degrade to "unavailable" and do not claim "live".

#### 8.4.1 `[data-webmcp]` — the three written values, and their three rendered states

`03` §6.1 writes `document.documentElement.dataset.webmcp` and it takes **exactly three values**:
`connecting`, `active`, `absent` (`03` §6.2 states the same three). Until now this spec styled none
of them, so the attribute was written with no reader — a build instruction that produces a
DOM attribute nothing looks at. These selectors close it. **The written set and the styled set are
the same three strings; adding a fourth to either side without the other reopens the defect.**

The attribute drives layout-level, no-JS-needed state only. Per-phase *pill* copy stays with the
`webmcp:changed` bus event (§7.2), which carries the five phases and the counts the attribute
cannot; `probing`, `registering` and `partial` are phases, never attribute values.

```css
/* connecting — the page is painted and interactive; the tools are not callable yet.
   Nothing is disabled. The only cue is the pill, which §7.2 already owns, plus a
   non-interactive tick on the status band so the state is visible without the pill. */
:root[data-webmcp="connecting"] .band-status { border-bottom-color: var(--caution); }
:root[data-webmcp="connecting"] .agent-pulse::before { content: "— TOOLS REGISTERING"; }

/* active — at least one tool registered. The agent transcript pane is the live pane. */
:root[data-webmcp="active"]     .pane-agent-empty  { display: none; }
:root[data-webmcp="active"]     .band-webmcp-absent { display: none; }

/* absent — no document.modelContext, or every registerTool rejected. Show the 44px band
   and the transcript pane's empty state. NOT an error palette (see 1. above). */
:root[data-webmcp="absent"]     .pane-agent-live   { display: none; }
:root[data-webmcp="absent"]     .band-webmcp-absent { display: block; }
```

**The default, with no attribute set at all, must be the `absent` rendering**, because that is the
state at first paint before `registerReferee()` runs and it is the honest one: no tool is callable
yet. So author the band visible and `.pane-agent-live` hidden in the base rules, and let
`[data-webmcp="active"]` turn them over. A page that defaults to the live pane claims an agent it
does not have for one frame, on camera.

`dataset.webmcpTools` (`03`:2176) is a **count for the pill and for a judge reading the DOM**, not a
selector hook. Do not write CSS against it.

> ### CUT 2026-09-01 — REPLAY MODE IS RESCINDED. DO NOT BUILD IT.
> Ruled by the coordinator and recorded in `06` §0.3. This section and `03` §6.2's `runSimulation()`
> were two incompatible designs for one surface, neither in `01`'s F1–F15 or MUST/SHOULD tiers, and
> neither budgeted in `06`. **The whole of §8.5 below is dead vocabulary — do not implement it, do
> not stub it, do not leave a TODO.** The WebMCP-absent surface keeps only the status band and the
> registration pill. The video's insurance policy is now the Checkpoint C backup take (`06` §6), and
> the judge-without-the-flag path is the status band plus `docs/environment-check.md`.
> §12's build-order row 7 ("Replay Mode + the WebMCP-absent band") is void as to Replay Mode and
> has been struck below. This pointer formerly named `06` §1 table row 7; `06` rev 3 renumbered and
> the reference resolved to nothing, so it now names this file's own table — which is where the
> live build instruction actually was.

### 8.5 Replay Mode — the honest fallback, and the video's insurance policy

A pre-authored, deterministic transcript of the agent session, replayed into `refereeBus` so every
surface behaves exactly as it does live.

- **Source:** `data/replay.js` — an ordered array of `{delayMs, event, payload}` derived from the seed,
  covering **nine calls**: `get_review_state`, `read_manuscript` (clean), `read_manuscript` (dirty,
  fires `integrity:detected`), `assert_finding` accepted, `check_claim` accepted, `assert_finding`
  **refused `EVIDENCE_NOT_FOUND`**, `flag_for_editor`, `request_unblind` **refused `HUMAN_ONLY`**,
  `submit_recommendation` **refused `REQUIRES_HUMAN`**. Default gap 1200ms, with a 2200ms gap before each
  refusal so the camera can land on it.
- **It emits on the same bus as the live path.** No separate rendering code, no mock UI. If replay
  looks right, live looks right — which is also why this is worth building early.
- **It is never mistakable for live.** Three simultaneous markers: the Agent Pulse label is prefixed
  `REPLAY ·`; every ledger row carries the dotted `REPLAY` chip and a dotted rail; a persistent
  masthead strip reads `REPLAY — a recorded agent session, not a live one` with a `Stop` button.
  Replayed rows stay in the ledger after stopping, still marked. `Reset` clears them.
- **It writes nothing an agent could not write.** Replay drives only agent-actor events; the human
  affordances stay live and under the reviewer's hand throughout.

Honesty note for the About drawer and the README: Replay Mode is a recording, it is labelled as one
in three places on screen, and the live path is the same code. Say that plainly rather than hoping
nobody asks.

---

## 9. ACCESSIBILITY FLOOR

### 9.1 Landmarks and focus order

DOM order equals visual order, so focus order needs no `tabindex` above 0 anywhere. Positive
`tabindex` is banned.

```
skip links → <header role="banner"> [About] [Reset] [WebMCP pill] 
→ <aside aria-label="Rubric and slate"> 4 sliders → accept-slots stepper → slate cards (12)
→ <main aria-label="Manuscript desk"> view-bar tabs → received-by toggle → manuscript scroll region
   → findings list → verdict radios → rationale → Commit
→ <aside aria-label="Ledger"> filters → pin toggle → copy → log scroll region → rows
→ <footer role="contentinfo"> status bar (not focusable except the seed-hash copy button)
```

Skip links, visible on focus, top-left, `--ink` on `--paper`, 2px `--accent` ring:
`Skip to slate` · `Skip to manuscript` · `Skip to ledger` · `Skip to recommendation`.

Both scroll regions (`#desk-body`, `#ledger-log`) get `tabindex="0"` and an `aria-label`, because a
keyboard-only user must be able to scroll them without a pointer.

Slate cards: each card is one tab stop; `↑`/`↓` also move between cards and `Home`/`End` jump to the
ends, so twelve cards do not cost twelve tab presses. The nested blind-strip button is a second stop
within the card.

View Bar: `role="tablist"` with arrow-key selection, one tab stop for the group.
Verdict radios: `role="radiogroup"`, arrow-key selection, one tab stop for the group.

### 9.2 Keyboard path through each human-only affordance

| Affordance | Path, from page load, pointer never used |
|---|---|
| Unblind | `Tab`×4 to slate → `↓` to the manuscript → `Enter` (selects) → `Tab` to `Unblind…` → `Enter` → focus lands in the reason field (`autofocus`) → type ≥12 chars → `Tab` to `Unblind and record` → `Enter` → focus returns to the revealed author line |
| Off-paper evidence | select manuscript → `Tab` to view-bar → `→` to `Findings` → `Tab` to `+ Add off-paper note` → `Enter` → `autofocus` on Claim → `Tab` through Source, Criterion, Severity → `Enter` on `Save` → focus lands on the new note |
| Retune weights | `Tab`×4 from load to the Novelty slider → `←`/`→` adjusts by 5 → slate reorders → `Tab` to the next criterion. Change is announced (§9.4) |
| Commit | select manuscript → `Tab` to the verdict group → `←`/`→` to choose → `Tab` to rationale → type ≥20 chars → `Tab` to `Commit` → `Enter` → confirm dialog `autofocus`es `Cancel` (destructive-adjacent default) → `Tab` → `Enter` |

Every modal is a native `<dialog>` opened with `showModal()`: focus trap, `Esc`, and `::backdrop` come
free and correct. On close, focus returns to the opener element explicitly (`opener.focus()`), which
`<dialog>` does not guarantee across engines.

### 9.3 Contrast, color, and targets

- Every text/background pair in §0.1 is computed at ≥4.5:1 on both `--paper` and `--card`. **Computed,
  not yet tool-verified — run a checker over the built page before shipping** and treat any pair under
  4.5:1 as a build blocker. Do not write an AA claim into the README until that pass exists.
- Tints are background-only; no text is ever set in a tint color.
- **Nothing is conveyed by color alone.** Actor = color **+ glyph shape (filled vs hollow) + the word
  `AGENT`/`YOU`**. Outcome = color **+ a word-chip**. Cut position = color **+ `ABOVE CUT`/`BELOW
  CUT` + a labelled separator line**. Blinding = color **+ hatch texture + the label `WITHHELD FROM
  AGENT`**. Refusal = color **+ hatch on the rail + a border on all four sides**. Each of the five
  survives a greyscale print.
- Interactive targets ≥44×44 CSS px, achieved by padding rather than by inflating visible chrome: the
  12px blind strip sits in a 44px button, the 3px slider track in a 44px row, the 7px chips in 26px
  pills with 9px vertical padding inside a 44px row.
- `:focus-visible` everywhere: `outline:2px solid var(--accent); outline-offset:2px`. `outline:none`
  without a replacement is banned. On `--ink`-filled controls the ring switches to `--paper` with a
  1px `--ink` outer edge so it survives on dark fills.
- No text below 10px; 10px only for uppercase letterspaced mono.

### 9.4 Live regions — three of them, used sparingly

1. **The ledger** — `role="log" aria-live="polite" aria-relevant="additions"` on `#ledger-log`.
   **The three visible lines are `aria-hidden="true"`.** Each row's first child is a
   `<span class="sr-only">` carrying one flat sentence, and that is the only thing announced:
   *"Agent, assert finding, refused, evidence not found."* Letting a screen reader read the full
   three-line row — timestamp to the millisecond, then a comma-list of visible fields — would make the
   app unusable within ten events. This is the single most important a11y decision in the file.
2. **Slate status** — a separate `aria-live="polite"` `role="status"` region, debounced 500ms after
   the last `input`, announcing the *consequence*: *"Slate reordered. Manuscript 7 moved from rank 5
   to rank 3, now above the accept cut."* Never announced per-frame during a drag.
3. **Assertive, and only twice in the entire app:** the agent's blocked commit attempt (§6.4) and the
   unblind confirmation (§6.1). Nothing else is ever assertive. If a third assertive announcement
   appears in the build, one of them is wrong.

`aria-busy="true"` on `#slate-list` during a FLIP run, cleared on the last `transitionend`.

### 9.5 Motion

`@media (prefers-reduced-motion: reduce)` sets a global `--dur-*: 1ms` and additionally replaces, not
merely shortens: FLIP → direct reorder + static outline (§4.6); the refusal wash → its final state
immediately (§2.5); the Pulse sweep → a static state square (§7.3); the cut-line crossing chips →
statically held 1200ms (§4.5); dialog entrance → opacity only. Nothing in the app conveys information
*only* through motion, so reduced motion loses no meaning.

---

## 10. ABOUT DRAWER AND RESET

### 10.1 About (`#dlg-about`) — right drawer, 460px, full height

`<dialog>` styled to the right edge (`inset: 0 0 0 auto; height:100dvh; max-width:460px; border-radius:
4px 0 0 4px`), entrance `translateX(24px)→0` + opacity, 220ms `--ease-out`. `--card` ground, 28px
padding, sections separated by `--rule` hairlines.

| Section | Content owner |
|---|---|
| `WHAT THIS IS` | 3 sentences + the verbatim thesis, set in `--t-read` serif as a pull quote with a 2px `--ink` left rule |
| `THE CORPUS IS FICTIONAL` | seam 12 — twelve manuscripts written for this demo, no real authors, titles and abstracts invented |
| `WHAT THE PAGE ENFORCES` | the three enforcements as a numbered list, each with its refusal code in `--t-code` |
| `TOOL REGISTRY` | **all seven tools in a table**: name · one-line purpose · `readOnlyHint` · `untrustedContentHint`. This is where the annotation story is told in full (§2.4). Rows for `read_manuscript` and `check_claim` show `untrustedContentHint: true` in `--caution` |
| `HONESTY BOUNDARY` | seam 10. **Content owned by another slice — mount point `{{HONESTY_BOUNDARY}}`.** The UI reserves the section, its heading, and its styling (`--paper-2` pane, `--border`, `--t-body`); it does not author the words |
| `HOW IT WAS BUILT` | vanilla ES modules, no bundler, no backend, no network calls, no LLM calls from the page; one committed light mode by choice, stated as a decision |
| `LINKS` | repo, license (Apache-2.0), the WebMCP flag string as copyable text |

Trigger: `About` in the masthead. Also linked from the WebMCP-absent band and the status bar.

### 10.2 Reset

`Reset` in the masthead → `#dlg-reset`, 440px:
*"Reset the session? Your findings, ledger, unblindings, rubric weights, and recommendation return to
the seeded state. This cannot be undone."* → `Cancel` (autofocus) · `Reset session` (`--refuse` fill,
`--paper` text — the only destructive-styled button in the app).

On confirm: remove `referee.state.v1`, rebuild from seed, re-render every region, focus the first
slate card, and show a 3s `--t-meta` line in the status bar `session reset to seed a91f…`. The ledger
is emptied and shows its empty copy. Tool registration is **not** re-run — the tools are already
registered and re-registering mid-session is a needless failure mode.

---

## 11. THE FILMING STATE — compose the screen, do not discover it

Judges may score on the video alone, and a verdict forms in about four seconds of first sight. The
screen must therefore be *composed* at every beat: nothing empty by accident, nothing half-scrolled,
nothing truncated mid-word, no lorem, no `undefined`, no placeholder ellipsis.

### 11.1 Capture setup

1440 × 900 viewport, 100% zoom, browser chrome hidden or cropped, system cursor visible (the drag has
to be legible), OS text-scaling at 100%, `prefers-reduced-motion` **off**. Record at 60fps: the FLIP
is 260ms and 30fps loses half of it.

### 11.2 Seed composition requirements

These are requirements on the seed and corpus, authored by other slices, that the UI depends on to
look composed. Flag any that cannot be met.

- All twelve manuscripts have a **title that wraps to exactly 2 or 3 lines** at 340px column width.
  Nothing that fits on one line (looks thin) or clamps mid-word at four (looks broken).
- **The seed table is `02` §6.2's and it is not negotiable from here.** `02` executed the
  arithmetic; this section describes it. Composites run **8.70 at rank 1 down to 2.50 at rank 12**
  on the 0–10 scale. The earlier requirement here — "top score ≥76, bottom ≤35" — was written
  against a 0–100 scale this build does not have.
- The default `acceptSlots` is **4 of 12** — a cut line high enough to be on screen without
  scrolling. It sits between **MS-106 (6.90)** at rank 4 and **MS-105 (6.85)** at rank 5.
- **The cut gap is 0.05, and that is deliberate.** This section previously demanded "at least 3.0
  between adjacent ranks near the cut line," and two bullets later demanded "two specific
  manuscripts within 2.0 points on either side of the cut" — two requirements that contradict each
  other, against a seed that satisfies neither. `02` chose 6.90/6.85 as one of exactly two
  `NEAR_TIE` pairs, and `02` §7.3's guard asserts those pairs, so the gap cannot be widened without
  breaking the corpus check. **The reorder is legible because of motion, not because of distance:**
  §4.5's crossing treatment gives a card that crosses the cut a rail color change, an
  `↑ ENTERED ACCEPT` label and a leader line. A 0.05 gap that visibly *swaps* on camera is a better
  demonstration of a knife-edge judgment call than a 3.0 gap that never needed a human.
- The three manuscripts carrying injection payloads are at ranks **1, 8 and 10** — one above the
  cut, two below. This section previously required 2, 6 and 9, arguing that "an injected manuscript
  ranking #1 would imply the payload worked." **`02` §6.1 takes the opposite position deliberately
  and it is canonical:** the payloads move no score at all, because the seed scores are authored and
  a neutralized span cannot influence a composite. Rank 1 therefore implies nothing about the
  payload, and putting one on the paper a reviewer is least likely to question is the sharper
  demonstration.
- **The demo manuscript is `MS-102`**, at rank 1, and it carries **2** injection attempts across
  **2** distinct sections — `abstract` and `discussion` — with removed spans of **232 and 251
  characters**, so the two removal stubs cannot read as a repeated identical block. `02` §6.1
  reserves both slots and `04` §7.3 measures both lengths.
- Author strings differ enough in length that the **nine** blind strips in §5.2's identity block have
  visibly different widths. The count is `BLINDED_FIELD_NAMES` and it is nine (§5.1); the slate card's
  compact strip is one summary bar, so nine is the on-camera number in the Desk and one is the number
  per card.

### 11.3 Beat sheet — what is on screen, when

| Time | Beat | Exact screen state |
|---|---|---|
| 0:00–0:12 | **First sight** | Full layout. Slate ranked, cut line visible between ranks 4 and 5 with 8 cards below it. `MS-102` selected, Desk showing `Manuscript` view scrolled to top with the identity block (nine fields, two columns) fully visible. Pill: `WEBMCP LIVE 7/7`. Ledger: **empty, showing its empty copy** — deliberately, so the tape fills on camera. Status bar: `tools 7/7 · calls 0 · FICTIONAL CORPUS`. |
| 0:12–0:30 | **Blinding** | Cursor rests on the identity block; the nine hatched strips (two columns) and `absent from every agent tool return — not masked` are readable. Agent runs `get_review_state` then `read_manuscript`. Two ledger rows land; hold on the `visible:` line of the second. Pulse cycles indigo → green twice. |
| 0:30–0:50 | **Evidence gate** | `assert_finding` accepted → finding row appears, quote underlined in `--agent` in the manuscript with a `◇` in the margin. Then `assert_finding` **refused** → red-bordered ledger row lands with the 1200ms wash; Findings header reads `1 refused — see ledger →`; the Findings list visibly does **not** contain the refused claim. Hold 3s on that absence. |
| 0:50–1:20 | **The money shot** | Integrity banner slides in. Click `Show what the agent received →`. Split-screen opens: sentence band, `INJECTION 1` badge and hatched gutter left, removal stub right, connector arrow between. Hover the mark → both link. Pager to `2 of 2`. Cut to the footer: `INJECTION ATTEMPTS 2 · SECTIONS AFFECTED abstract, discussion · CHARACTERS REMOVED 483` (232 + 251, §3.6) and the `untrustedContentHint` line. Close. **This is 30 seconds; do not shorten it.** |
| 1:20–1:45 | **Live re-ranking** | Drag the four weights from `02`'s defaults `{30, 35, 15, 20}` to the scripted `{50, 25, 10, 15}` — `NOVELTY` 30 → 50 is the visible gesture. **The event `02` §3.5 executed:** MS-101 8.65 → **8.75** and MS-102 8.70 → **8.50**, so the **top two swap**; MS-103 7.05 and MS-104 6.90, so the conflicted manuscript **climbs from rank 7 to rank 3** — three cards moving, one of them four places. Slate reorders with the 14ms stagger and §4.5's crossing treatment. Scores tween. Release → one `set_weights` ledger row appears, not fifty. |
| 1:45–2:05 | **Unblinding** | Agent calls `request_unblind` → refused row carrying **`HUMAN_ONLY`** + `Agent requested unblinding` pending chip. Click `Review…`, type a real reason, confirm. The nine strips resolve into values; the amber `UNBLINDED` chip appears; hold 4s on **"The agent's view did not change."** |
| 2:05–2:30 | **The human gate** | Agent calls `submit_recommendation` → refused with **`REQUIRES_HUMAN`**. Verdict Bar rail flashes three times and the line appears: *"The agent tried to commit a recommendation at 14:39. The page refused. This decision is yours."* Then the reviewer selects `Major revision`, types a rationale, clicks `Commit`, confirms. Bar collapses to the green committed state. |
| 2:30–2:50 | **The tape** | Scroll the ledger from the top with the pin off. ~14 rows: agent and human rails alternating, three red-bordered refusals. Click the `Refused 3` filter — the tape reduces to three rows and holds. |
| 2:50–3:00 | **Close** | Open About, scroll to `HONESTY BOUNDARY`, hold. Cut to the thesis pull quote. |

**This sheet runs to 3:00 flat, against `01` §8's "under the Devpost limit" — zero margin.**
`07` §1 films ten *different* beats in a different order, ending at 2:44 with 16 seconds of margin,
and `06` Task 14 has Eric writing a third script. **Two shot lists are one too many and this one is
the riskier of the two**; `07` §1 is the submission kit's own deliverable and the one Task 14 should
edit. Treat this table as the *screen-state* specification — what must be composed, selected,
scrolled and visible at each beat — and `07` §1 as the running order and narration. Where they
disagree on timing, `07` wins, because it is the one with margin.

### 11.4 Standing composition rules while filming

- The Ledger is empty only in beat 1. From 0:30 onward it always has ≥3 rows in frame.
- The Desk is never in an empty state on camera after 0:00.
- Never film a partially-scrolled manuscript with a heading cut in half at the top edge.
- Never film with a modal open behind a hover tooltip.
- If a take shows `REGISTERING n/7` longer than ~1s, the tools are slow — reshoot rather than trim, so
  the pill's `LIVE 7/7` is what a paused frame shows.
- Optional `?film=1` boot parameter pre-plays six ledger events at 4× speed before recording starts,
  for takes that need the tape already populated. It is a convenience only; it must set no state the
  live path could not set, and it must be absent from the deployed default URL.

---

## 12. BUILD ORDER — earliest shootable frame wins

Ordered so that a usable 90 seconds of video exists by the end of day one even if everything after
step 5 slips.

| # | Build | Why here | Shootable after |
|---|---|---|---|
| 1 | Tokens (`tokens.css`), grid shell, masthead, status bar, empty region skeletons | The grid and the type system are load-bearing for every screen after. Everything downstream inherits them, so a token change on day two is a repaint of the whole build | a still of the layout |
| 2 | Slate cards + blind strip + identity block + Desk manuscript view (static seed, no tools) | The two "product looks finished" surfaces, and they need no tool layer at all | first sight, beat 1 |
| 3 | `refereeBus` subscription, ledger row component, Agent Pulse, registration lifecycle | The video's spine. Once this exists, every tool the tool-layer lands is immediately visible on camera with no further UI work | beats 2–3, the moment tools land |
| 4 | **Integrity split-screen + in-Desk `Page`/`Agent` toggle + removal stubs** | The single most important frame. Build it while there is still time to make it beautiful, not at 2am | **beat 4 — the money shot** |
| 5 | Rubric rail + FLIP + cut line + crossing treatment | The only kinetic energy. Independent of the tool layer, so it can be built while tools are still being debugged | beat 5 |
| 6 | Verdict Bar + commit confirm + the agent-refusal flash | The closing shot | beat 7 |
| 7 | The WebMCP-absent band (§8.4) — status band, copy-flag button, registration pill | The judge-without-the-flag path. **Do not promote it ahead of 6.** It is one band and one pill, not a mode: Replay Mode was struck from this row by the CUT banner above §8.5, and the video's insurance is now the Checkpoint C backup take (`06` §6) | any beat, without a working agent |
| 8 | Unblind modal, off-paper evidence modal, About drawer, Reset | Real must-haves, but each is a self-contained dialog and none blocks a camera setup | beat 6 |
| 9 | Empty/loading/error states, a11y sweep, contrast verification, reduced-motion pass | Correctness work that does not change any frame — do it once the frames are locked | — |

**Steps 1–5 are the video.** Steps 6–9 are the product. If the schedule forces a choice on day two,
finish 1–5 beautifully rather than 1–9 adequately.

---

## 13. IF TIME RUNS OUT — cut in this order

1. Off-paper evidence **modal** → a single-line inline composer in the Findings header (keeps the
   affordance and the agent-invisibility rule; loses the criterion/severity fields).
2. The connector gutter's leader lines in the split-screen (keep the circles and the linked hover).
3. Score tweening (keep the FLIP; the numbers can snap).
4. The pager in the integrity overlay (show both payloads inline; lose `‹ 1 of 2 ›`).
5. Ledger DOM windowing at 400 rows (a demo will not reach it).
6. The identity block's two-column layout → one column of nine rows (taller, still complete; only
   acceptable if the recording frame still holds §11.3 beat 1).

**`Copy ledger as JSON` was item 1 on this list and it is removed from it.** `01` AC-24 is a
**MUST** — "✚ Ledger copy-to-clipboard … the ledger is the evidence artifact, and unliftable
evidence persuades nobody. One clipboard call, minutes of work." A cut list may not open with a
MUST. It is also the cheapest item in this spec, which is what made cutting it first look free.

**The 640–1023px stacked layout is not on this list either, because it no longer exists** (§1.4).
`01` W11 refuses it; it was never buildable and so is not cuttable.

**Never cut, in any circumstance:** the `visible:` line on ledger rows; the removal stubs; the
`WITHHELD FROM AGENT` label above every blind strip; the word *masked* in the identity block; the
integrity sentence; **"The agent's view did not change."**; the refusal styling being distinct from
the error styling; **and the ledger's copy-to-clipboard, which is `01` AC-24, a MUST.**

**This list binds `06` as well as this file.** `06` Task 17 degraded the ledger to "a `<pre>` of the
JSON — the styled panel is dead" at 0.25h, which destroys two never-cut items at once: a `<pre>`
dump has no `visible:` line and no refusal styling distinct from error styling. The ledger is the
closing shot and the evidence artifact; it is not a debug dump. `06` Task 17 is re-priced against
this list rather than this list being relaxed against `06`.

---

## 14. ASSUMPTIONS AND GAPS — confirm before building

1. **`acceptSlots` — RESOLVED.** `02` §5.1 now gives it exactly the home this spec assumed,
   `rubricWeights.acceptSlots`, an integer 1..11 defaulting to 4, and `02` §5.4's `validatePersisted`
   admits it. That last part was the live defect: the validator asserted `rubricWeights` had
   *exactly* the four criterion ids, so writing `acceptSlots` there would have failed validation and
   **discarded the entire persisted blob on every load** — every session silently reset.
2. **`selected` is treated as in-memory only** and is deliberately not persisted — a reload should
   land on the empty Desk plate, which is a designed state, rather than restoring a half-context.
3. **Findings — RESOLVED, and there is no storage shape to assume.** `02` §1.11 derives
   `state.findings` by replaying the ledger; it is never persisted, and `03` §5 no longer writes a
   `state.scores[*].findings` array. `getFindings(manuscriptId)` is a filter over `state.findings`,
   not a storage accessor: `state.findings.filter(f => f.manuscript_id === id && f.status ===
   'active')`. Off-paper notes derive from `add_note` ledger rows and are distinguishable by their
   action, not by a flag on a record.
4. **Corpus fields the UI requires — UNRESOLVED, ESCALATED.** Per manuscript: `id`, `title`,
   `sections[]`, and, on the human side only, the *character length* of each of the nine blinded
   fields (not the value) so strip widths are plausible. **This collides with `02` §2.4 step 6**,
   which fails the build if any module other than `src/ui/identity-panel.js` imports
   `identity-access.js` — and `ui/slate.js` renders the compact strip. Two ways out, both cheap,
   neither chosen here because the boundary is not this pass's to move: route lengths through
   `identity-panel.js` as the single importer and have it hand a `{id: length}` map to the other UI
   modules, or take the fallback to fixed widths. **Length is human-side only and never enters an
   agent payload** either way. Flagged for the blinding-boundary owner.
5. **Per-payload offsets — RESOLVED, both kinds now exist.** The removal stub cannot be positioned
   and the connector cannot be drawn without character offsets on both sides. **Raw side:** `04`
   §3.3's `IntegrityEvent.raw_offset: [start, end]`, an offset into the raw section text, places the
   mark in the left pane. **Clean side:** the redaction token is a literal in the agent-visible
   string, so `clean.indexOf(replacement_token)` places the stub in the right pane exactly, with no
   new field needed. Separately, `04` §4's `verifyQuote` now returns `char_offset` into the
   agent-visible section text, which is what §7.4's accepted-finding underline draws from — it was
   never computed before this pass, and §7.4, `01` AC-8 and §14 note 5 all depended on it.
6. **Tool annotations — VERIFIED.** `untrustedContentHint: true` on `read_manuscript` and
   `check_claim` is confirmed at `00-api-reality.md:98-109`, and `03-tool-contracts.md:15` sets
   annotations deliberately on all seven. The UI still **reads the values back from the registry
   rather than hard-coding them**, so a later change in the tool slice cannot make the About table or
   the ledger tag lie.
7. **Contrast figures in §0.1 are computed, not tool-verified.** Verification is a §12 step 9 task and
   a shipping blocker for any AA claim in the README.
8. **Refusal copy strings** are authored here; if the tool slice returns its own `message`, the
   ledger prefers the tool's message and falls back to these. The strings must not diverge — one
   source.
9. **The identity block is the one place `02`'s nine-name constant costs layout.** Nine rows in one
   column is ~320px and pushes the manuscript body out of the 1440×900 recording frame; §5.2 solves
   it with two columns at ~150px and narrower bars. If a build finds two columns cramped, the
   correct trade is a taller block or a smaller type step — **never a shortened list**. A truncated
   display of a blinding constant reads as a bug on camera and makes the block disagree with the
   `blinded_fields` array printed directly below it.

---

## 15. CONTESTED

Three notes. All are **implemented exactly as the seams specify**; these are flags, not deviations.
C1 was raised against the seams and then withdrawn after checking the sibling scope documents — the
check and its result are both recorded, because a contested note that quietly disappears teaches
nobody anything.

**C1 — `blinded_fields` as an oracle: RAISED, THEN WITHDRAWN ON VERIFICATION.** The concern was
that seam 2 puts `blinded_fields: [...]` on every tool return while seam 6 forbids anything that lets
the agent infer a blinded field — so if the array's *contents* varied per manuscript (a submission
with no prior venue returning two entries while others return three), the agent could infer something
true about an author from the array's shape alone, never having seen a value. An inference channel
that looks like metadata is exactly the kind that survives review.

**The mechanism is closed, and closed for the right reason.** `02` §1.9.1 ships the shared frozen
`BLINDED_FIELD_NAMES` on every return, and `02` §2.2 states it outright: *"`blinded_fields` is a
constant, not a computed diff"* — computing which fields were removed is precisely the leak. `03`
§0.1 calls it a static declaration. No change requested there.

**But the withdrawal was wrong, and this is the correction.** C1 verified the *mechanism* and never
checked the *value*. The constant holds **nine** names; this spec rendered **three**, and `03`'s
worked examples showed **five**. Three files, three lengths, for a frozen array — which is the exact
failure mode C1 was written to catch, arriving through the door C1 did not look at. §5.2 now renders
all nine. **A contested note that verifies the mechanism and skips the value has not verified
anything**, and that is the lesson worth keeping from this entry, more than the finding itself.

It is recorded here because the UI renders that array verbatim in the identity block (§5.2), which
makes the UI the place the leak would become visible if the constant ever became a computation.
**If a future edit makes `blinded_fields` per-manuscript, this spec's identity block will faithfully
display the variation — treat that as the alarm, not as a rendering bug.**

**C2 — seam 8's actor domain leaves page faults unrepresentable.** `actor: "agent" | "human"` is
correct and should stay closed. The consequence, which is worth stating out loud rather than
discovering: a render fault, a storage failure, or a registration rejection has no actor and therefore
**cannot be recorded in the ledger at all.** This spec routes all of them to the error band and the
console (§8.3). The alternative — inventing `actor:"system"` — would put non-adjudicative noise into
the one artifact the submission's whole claim rests on, and a judge reading the exported ledger should
find only decisions and refusals in it. Implemented as stated; recorded here so nobody "fixes" it at
2am.

**C3 — live re-ranking (seam 11) is the most expensive UI work with the least WebMCP leverage.** It
is the only must-have that demonstrates nothing about the agent boundary: it is a rubric feature, and
a judge scoring *WebMCP Leverage* gets nothing from it. It is nonetheless correct to keep, for a
reason worth naming: it is the entire kinetic budget of a video that is otherwise static text, and
*Execution* is a full quarter of the score. Implemented as specified. If the tool layer slips on day
two, the honest trade is to keep the FLIP and cut §13 items 3–5 — not to cut the re-ranking, which
would leave a video with no motion in it at all.

---

## RECONCILED 2026-09-01

Single-writer reconciliation pass against `99-verification.md`. Rulings applied in this file:

- **R2 · corpus identity.** Criteria are `02`'s four (`IMPACT` is gone, `REPRODUCIBILITY` replaces
  it) at `02`'s default weights; the score scale is 0–10 with two decimals, not 0–100; manuscript
  ids are `MS-1xx`, and the filmed manuscript is MS-102.
- **R4 · `BLINDED_FIELD` deleted.** No file defined it and `03` §7.3 forbids the family as an
  identity oracle. §2.3's summary copy now covers the codes that actually exist.
- **R5 · `REQUIRES_HUMAN` / `HUMAN_ONLY` un-inverted at all four sites** — §2.3 copy, §6.1 unblind
  flow, §6.4 commit flow, §8.5 replay transcript — plus §11.3 beats 6 and 7, where both are on
  camera. `03` §1.3 is canonical.
- **R6 · state shape.** `acceptSlots` now has a home and a validator that admits it; `unblinded`
  stores `{id, reason, at}`; `committed` is singular with `02`'s field names; the human ledger verbs
  are `02` §1.9's closed six, so `retune_rubric`, `integrity_inspected` and
  `request_unblind.approved` are gone.
- **R7 · the re-ranking event is `02`'s executed one.** §11.2 and §11.3 now film the top-two swap
  and MS-103's rank 7 → 3 climb at `{50,25,10,15}`, against a 0.05 cut gap that `02`'s corpus guard
  asserts — not the invented 3.0 separation this file demanded in one bullet and contradicted two
  bullets later.
- **R10 · the cut line.** `Copy ledger as JSON` is off §13's cut list: `01` AC-24 is a MUST and it
  was item 1. The 640–1023 and sub-640 stacked layouts are removed from §1.4 rather than deferred —
  `01` W11 refuses them, and a WON'T is not something to stub.
- **Coordinator conflict A** · §11.2's two-marks requirement is now satisfiable: MS-102 carries two
  payloads at 232 and 251 characters in `abstract` and `discussion`.
- **Coordinator conflict B** · §5.2 renders all nine `BLINDED_FIELD_NAMES`, in two columns with
  re-derived bar widths. §15's C1 is corrected: it withdrew on the mechanism and never checked the
  value, which is the failure mode it existed to catch.

Also chased: `05` §7.2's `Promise.allSettled` contradicted `00` §D5's locked sequential
registration, so `00` wins and `03` §6.1 emits per settle instead; §14's eight "assumptions to
confirm" are resolved or escalated individually rather than left open.

**Escalated, not decided:** §14 note 4. The compact blind strip derives its width from real
identity-string lengths, and `ui/slate.js` reading those breaks `02` §2.4 step 6's single-importer
guard. Two cheap ways out are named there; choosing one moves the blinding boundary, which is not
this pass's call.

**RESOLVED 2026-09-01 — CUT, not chosen.** §8.5's Replay Mode and `03` §6.2's `runSimulation()` were two incompatible designs for
the same WebMCP-absent surface, neither in `01`'s feature list nor budgeted in `06`. Both are rescinded — see the CUT banner at §8.5 and `06` §0.3.

---

## RECONCILED PASS 2 - 2026-09-01

Second single-writer pass, against `99-verification-delta.md`. Four of the defects were on camera.

- **D9 · `CHARACTERS REMOVED 148` is gone.** `04` §7.3 measures MS-102's two removals at **232** and
  **251**. §3.5's removal-stub art is **per payload**, not a total, so it now reads **232** (payload 1,
  FX-1 in `abstract`) with a note naming 251 for payload 2 and pointing the 483 total at §3.6.
  §11.3's money-shot beat — the 30-second beat this file forbids shortening — now reads the footer as
  `CHARACTERS REMOVED 483`, matching §3.6, and its `SECTIONS AFFECTED` reads `abstract, discussion`
  rather than `2`, which is what §3.6 specifies. A judge can add 232 + 251 on screen.
- **D10 · "three hatched strips" is nine, in all three places.** §5.1 already ruled the count is nine
  and it is `02`'s `BLINDED_FIELD_NAMES`; §5.3, §11.2's composition rule and §11.3 beat 2 still said
  three, so the beat sheet contradicted itself between adjacent rows in the beat whose entire job is
  showing the blinding. §11.2 now also states the distinction the count depends on: **nine** strips in
  the Desk identity block, **one** summary bar per slate card (§5.1).
- **D11 · Replay Mode is excised from live text, not only bannered.** §8.4's band shipped a
  `[ Watch the agent side ]` button whose only job was starting a rescinded feature; the button and
  its bullet are gone. §12's build-order row 7 was an **active instruction to promote it ahead of the
  Verdict Bar** — it now specifies the band, the copy button and the pill, and says not to promote.
  The ledger-rail style row and the `REPLAY` badge row are deleted. The CUT banner's cleanup pointer
  named `06` §1 row 7, which `06` rev 3 renumbered into nothing; it now names this file's own table,
  which is where the live instruction actually was. §8.5 itself stays under its banner as dead
  vocabulary.
- **D12 · `detail` → `note` on ledger rows** (`03` §0.4 is the writer), in §4.4's integrity-overlay
  row, §6.2's prose and §10's `human:action` bus payload.
- **D13 · `Major revisions` → `Major revision`.** §6.4's confirm copy, its enum line and §11.3's
  closing beat carried the plural against `03` §4.7's `enum` and `01` P1 — and the confirm copy and
  the committed chip six lines apart disagreed with each other, both on camera.
- **D14 · "the four refusal codes" over five bullets** → five.

**Not fixed here:** §14 note 4's blind-strip width against `02` §2.4 step 6 is still
**UNRESOLVED, ESCALATED** and still has not reached `02`. AC-13's `FUZZY MATCH · 0.96` badge is
specified in `01` and appears nowhere in this file.
