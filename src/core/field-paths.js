/**
 * src/core/field-paths.js — NAME LISTS ONLY. THIS FILE CONTAINS NO DATA.
 *
 * BOUNDARY COMMENT (read this one). Every string below is a field PATH, never a field
 * VALUE. Logging "the human could see identity.authors[].name" does not require knowing
 * any author's name, which is why `visible_fields_at_time` can record the human's widened
 * view without any module in src/core/ ever touching the identity store. 02 §1.9.1 point 3.
 *
 * DEVIATION FROM 02 §2.1, DECLARED: the data model puts this file at
 * src/corpus/field-paths.js. LANE CORE owns src/core/** exclusively and may not write into
 * src/corpus/. It is placed here so core is runnable standalone. If src/corpus/field-paths.js
 * later lands, it must `export * from '../core/field-paths.js'` — a second literal copy of
 * these arrays would be a second source of truth for the blinding record.
 */

export const PUBLIC_FIELD_PATHS = Object.freeze([
  'manuscript.id', 'manuscript.title', 'manuscript.venue_track', 'manuscript.field',
  'manuscript.subfield', 'manuscript.keywords', 'manuscript.abstract', 'manuscript.word_count',
  'manuscript.sections[].id', 'manuscript.sections[].label', 'manuscript.sections[].text',
  'manuscript.figures[].caption', 'manuscript.figures[].alt_text', 'manuscript.blinded_fields'
]);

export const IDENTITY_FIELD_PATHS = Object.freeze([
  'identity.authors[].name', 'identity.authors[].affiliation',
  'identity.authors[].is_corresponding', 'identity.authors[].orcid_like',
  'identity.affiliations', 'identity.funding', 'identity.acknowledgements',
  'identity.author_notes', 'identity.correspondence_email', 'identity.external_links',
  'identity.prior_submission_history', 'identity.conflict_of_interest'
]);

export const QUEUE_FIELD_PATHS = Object.freeze([
  'session.queue[].id', 'session.queue[].title', 'session.queue[].composite',
  'session.queue[].rank', 'session.queue[].flags', 'session.rubric_weights'
]);

/**
 * The `blinded_fields` array shipped in every tool return is a pure STRING TRANSFORM of
 * IDENTITY_FIELD_PATHS. It reads no data; it renames names. 02 §2.2 fact 4: computing
 * "which fields did we remove" by diffing against the identity record would itself be a
 * read of identity.
 */
export const BLINDED_FIELD_NAMES = Object.freeze([
  ...new Set(IDENTITY_FIELD_PATHS.map((p) =>
    p.replace(/^identity\./, '').replace(/\[\]\..*$/, '')))
]);
