/**
 * src/tools/handlers/read-manuscript.js — 03 §4.2.
 *
 * The only path by which manuscript text reaches the agent, and it is the SANITIZED copy.
 * getSectionText() — the raw public text — is on the capability object for the human side;
 * this handler does not call it. It calls getAgentText(), which 04 §5 memoizes so that
 * read_manuscript and verifyQuote see byte-identical text for the life of the session. If
 * those two ever diverged, a quote the agent copied faithfully out of this return could fail
 * the evidence gate, and the gate's refusal would be a lie.
 *
 * FAIL CLOSED. capabilities.js ships getAgentText as `() => undefined` until 04 installs the
 * real one. Handing the agent raw text in that window would defeat the sanitizer on a wiring
 * mistake, so an unwired layer produces INTERNAL and no text at all.
 */
import { ok, refuse, CODES } from '../envelope.js';

/**
 * `integrity.event_ids` are `<manuscript_id>:<section_id>:<span_index>` (04 §3.3). The section
 * name inside them is a DELIBERATE disclosure — `sections_affected` already ships in the same
 * object, because the agent cannot reason about what it received otherwise (04 §6's disclosed
 * residual). What is never disclosed is IntegrityEvent.raw_excerpt, which is the payload text
 * itself. We therefore read `id` and nothing else off an event, and prefer a pre-built
 * `integrity.event_ids` when the sanitizer supplies one.
 */
function eventIdsFrom(san, sections) {
  const wanted = new Set(sections);
  const fromIntegrity = san && san.integrity ? san.integrity.event_ids : null;
  const raw = Array.isArray(fromIntegrity)
    ? fromIntegrity
    : (Array.isArray(san && san.events) ? san.events.map((e) => e && e.id) : []);
  return raw
    .filter((id) => typeof id === 'string')
    .filter((id) => {
      const parts = id.split(':');
      return parts.length < 2 || wanted.has(parts[1]);
    });
}

export function readManuscriptHandler({ args, state, ms, caps, next }) {
  const T = 'read_manuscript';
  const id = args.manuscript_id;
  const order = caps.getSectionOrder(id) || [];

  // The wrapper checks `args.section` (singular). `sections[]` is this tool's own array, and
  // an id that is legal in SECTION_IDS but absent from THIS manuscript takes the same
  // SECTION_NOT_FOUND path a nonsense id takes (03 §7 rule 3).
  const requested = Array.isArray(args.sections) && args.sections.length > 0
    ? args.sections
    : [...order];

  const unknown = requested.filter((s) => !order.includes(s));
  if (unknown.length > 0) {
    return { refusal: refuse(T, CODES.SECTION_NOT_FOUND,
      'This manuscript has no section with that id.',
      { possible: true,
        how: 'Choose a section id from available_sections and call again.',
        with: { manuscript_id: id, requested_unknown: unknown, available_sections: [...order] } },
      next()) };
  }

  // Preserve the manuscript's own section order regardless of the order the agent asked in,
  // so the text reads as a document rather than as a bag of paragraphs.
  const wanted = new Set(requested);
  const ordered = order.filter((s) => wanted.has(s));

  const sections = [];
  for (const section of ordered) {
    const text = caps.getAgentText(id, section);
    if (typeof text !== 'string') {
      return { refusal: refuse(T, CODES.INTERNAL,
        'The page could not produce the neutralized text for this manuscript.',
        { possible: false,
          how: 'Report this to the human reviewer and continue with another call.',
          with: { tool: T, manuscript_id: id, section } },
        next()) };
    }
    sections.push({ section, text, char_count: text.length });
  }

  let san = null;
  try { san = caps.sanitizeManuscript(id) || null; } catch { san = null; }
  const integrity = (san && san.integrity) || { injection_attempts: 0, sections_affected: [] };
  const affected = (integrity.sections_affected || []).filter((s) => wanted.has(s));
  const eventIds = eventIdsFrom(san, ordered);

  return { payload: ok(T, {
    manuscript_id: id,
    title: ms.title,
    word_count: ms.word_count,
    // Field CLASSES held in a store this tool cannot read. Identical on every manuscript.
    blinded_fields: [...caps.BLINDED_FIELD_NAMES],
    sections,
    integrity: {
      injection_attempts: typeof integrity.injection_attempts === 'number'
        ? integrity.injection_attempts : 0,
      sections_affected: affected,
      event_ids: eventIds,
      note: eventIds.length > 0 || affected.length > 0
        ? 'Instruction-like spans were neutralized before this payload was built. The raw spans are retained for the human reviewer only and are not retrievable through any tool.'
        : 'No instruction-like spans were detected in the sections returned.'
    }
  }, next()) };
}

/**
 * 03 §4.2: this digest is LOAD-BEARING, not cosmetic. `sections_returned` is what the wrapper
 * writes onto the ledger row, and hasRead() reads it straight back out to enforce P1 and P2.
 * The ordering protocol is therefore a fact about the append-only log rather than a flag.
 */
export function readManuscriptDigest(args, result) {
  return {
    manuscript_id: args.manuscript_id,
    sections_requested: args.sections || null,
    sections_returned: result && result.ok ? result.sections.map((s) => s.section) : []
  };
}
