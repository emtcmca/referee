/* ---------------------------------------------------------------------------
   Referee — composition root.

   This file is the ONLY place that is allowed to see every layer at once. It
   wires core (which must never reach identity) to the UI (which must), and it
   hands the tool layer a capability object with no path to identity at all.

   BLINDING BOUNDARY — read before editing.

     src/core/**      must NOT import src/identity/**   (enforced: scripts/check-blinding.mjs)
     src/tools/**     must NOT import src/identity/**   (enforced: same)
     src/ui/**        MAY import src/identity/**        (the human is allowed to see authors)
     src/main.js      MAY import both — it is the composition root

   The composition root is excluded from the import-graph guard by necessity:
   something has to know about both sides in order to keep them apart. What the
   guard checks here instead is narrower and stricter:

     identity must never be passed into the capability object handed to tools.

   If you add an import to this file, make sure it does not cross that line.

   Dynamic import is used deliberately below. Lanes land at different times and
   a missing static import is a hard page failure, whereas a missing dynamic one
   degrades. This is also why main.js sits outside the guard's dynamic-import
   ban: that ban exists so a static walk cannot be defeated inside the guarded
   subtree, and this file is not in it.
--------------------------------------------------------------------------- */

const el = (id) => document.getElementById(id);

/** Feature-detect the model context. `navigator.modelContext` is deprecated as
 *  of Chrome 150 in favour of `document.modelContext`; prefer document, keep the
 *  fallback only so an older build still works. */
function detectModelContext() {
  return document.modelContext ?? navigator.modelContext ?? null;
}

/** Load a module that may not exist yet. Returns null rather than throwing, so
 *  a half-built tree still renders a coherent page. */
async function optional(path) {
  try {
    return await import(path);
  } catch (err) {
    console.info(`[referee] ${path} not present yet:`, err?.message ?? err);
    return null;
  }
}

function setToolStatus(text) {
  const node = el('mount-tool-status');
  if (node) node.textContent = text;
}

async function boot() {
  /* ---- 1. The adversarial layer — first, and unconditionally -----------
     capabilities.js holds `verifyQuote` / `sanitizeManuscript` / `getAgentText`
     as injected slots that FAIL CLOSED when unwired: verifyQuote returns
     INTERNAL and no score, so an unwired build refuses every finding rather
     than accepting unverified ones. Failing closed is correct; shipping closed
     is not.

     ORDER IS LOAD-BEARING, twice over, and both were shipped bugs:

     (a) It must not sit behind the WebMCP check. An earlier version installed
         it inside the agent branch, after the early return for browsers with no
         model context — so in any browser without the flag the sanitizer never
         wired, "what was taken out" had nothing to show, and the split-screen
         reveal was dead. The sanitizer serves the HUMAN side too; whether an
         agent is present has nothing to do with whether the page can read its
         own corpus.

     (b) It must come before loadState(). The render layer paints its
         evidence-gate banner from adversarialLayerInstalled() and re-renders on
         state:loaded. Wiring after that event means the banner keeps reporting
         a gate that is, by then, actually wired. */
  const caps = await optional('./core/capabilities.js');
  const sanitize = await optional('./sanitize/index.js');
  const verify = await optional('./verify/index.js');
  const wired = caps?.installAdversarialLayer?.({
    verifyQuote: verify?.verifyQuote,
    sanitizeManuscript: sanitize?.sanitizeManuscript,
    getAgentText: sanitize?.getAgentText
  }) ?? false;
  if (!wired) {
    console.error('[referee] adversarial layer not installed — the evidence gate ' +
                  'is failing closed and every finding will refuse.');
  }

  /* ---- 2. State ------------------------------------------------------
     Persistence lives entirely in core/state.js. There is no ui/persist.js:
     src/ui/** may import identity, so a core module importing from there would
     reach identity transitively — and INVISIBLY, because the blinding guard
     excludes src/ui/ from its walk. Dependency direction is always ui -> core.

     loadState() emits state:loaded, which drives a full re-render. It runs
     AFTER the wiring above so that render sees the wired gate. */
  const stateMod = await optional('./core/state.js');
  const state = stateMod?.loadState?.() ?? null;

  /* ---- 3. The human side --------------------------------------------
     index.html loads src/ui/render/index.js BEFORE this file. That module owns
     all rendering and installs the shipped corpus, so loadState() above hashes
     the real text rather than corpus.stub.js.

     This file deliberately does NOT mount the UI. An earlier version called
     ui.mount() on src/ui/bindings.js, which exports no such function — it
     silently rendered nothing and nothing failed loudly. Identity is reached
     only from the render layer, which is allowed to see it. */

  /* ---- 4. The agent side -------------------------------------------- */
  const mc = detectModelContext();
  if (!mc) {
    const absent = el('webmcp-absent');
    if (absent) absent.hidden = false;
    setToolStatus('Agent tools not registered — no model context in this browser.');
    return;
  }

  const tools = await optional('./tools/index.js');
  if (!tools?.registerAll) {
    setToolStatus('Agent tools not registered — tool layer not built yet.');
    return;
  }

  /* ---- 4a. Capabilities ----------------------------------------------
     `createCapabilities(overrides)` takes OVERRIDES, not session state. An
     earlier version passed `{ state }`, which is not a capability key.
     The object has no path to identity, and that is what makes blinding
     structural rather than conventional. Never add one. */
  const capabilities = caps?.createCapabilities?.() ?? null;

  setToolStatus('Registering agent tools…');
  try {
    /* Registration is async. The indicator must not claim the tools are live
       until every one has resolved, or the indicator cannot be trusted.
       `normalizeText` is injected here because the capability set is closed and
       the normalizer belongs to the sanitize lane — without it `assert_finding`
       returns a null normalized_quote. */
    const registry = new AbortController();
    const count = await tools.registerAll(mc, capabilities, {
      signal: registry.signal,
      normalizeText: sanitize?.normalizeText
    });
    setToolStatus(`${count} agent tools registered.`);
  } catch (err) {
    setToolStatus('Agent tool registration failed — see console.');
    console.error('[referee] registerAll threw:', err);
  }
}

boot();
