/**
 * src/identity/index.js — THE DISJOINT STORE. 02 §1.4.
 *
 * =====================================================================================
 * READ THIS BEFORE IMPORTING THIS FILE
 * =====================================================================================
 * This module exists to be imported by EXACTLY ONE MODULE IN THE TREE, and that module is
 * in the UI layer (src/ui/identity-panel.js). The blinding guard asserts that fact
 * tree-wide: `scripts/check-blinding.mjs` step 6 fails the build if the number of importers
 * is anything but one, or if that one importer's path is anything but the identity panel.
 *
 * NOTHING UNDER src/core/ MAY IMPORT THIS FILE. Nothing under src/tools/ may either. The
 * guard walks everything under src/ EXCEPT src/ui/, resolves the transitive import closure
 * of every file, and exits 1 if this module appears anywhere in it (02 §2.4 rules 3 and 6).
 * That exclusion-based walk is deliberate: naming the directories to walk meant a directory
 * a sibling slice added later went unguarded, and the blinding proof passed vacuously.
 *
 * WHY A SEPARATE FILE RATHER THAN OMITTED FIELDS: blinding here is structural, not
 * cosmetic. The public manuscript records have no author fields to strip because the two
 * stores were never joined. A tool handler is not shown a filtered view of a record that
 * contains identity — it is handed a record that never had it. The difference matters
 * because a filter can be misconfigured and a join that does not exist cannot be.
 *
 * The human reviewer IS allowed to unblind, and every unblind is logged with a typed
 * reason. That asymmetry — agent structurally blind, human unblinded but on the record —
 * is the demo. See visibility.js, where the human branch widens and the agent branch
 * provably cannot.
 *
 * HONEST LIMIT: JavaScript has no module-level access control. A determined module could
 * reach this file with a dynamic import. Enforcement is (a) the import-graph guard, which
 * also fails on any dynamic import expression under src/, and (b) a runtime key check on every tool return.
 * That is enforcement at the seam, not a language guarantee, and the write-up says so.
 *
 * FICTIONAL — every value below is fabricated for the Referee demo. Emails and links use
 * the reserved .invalid TLD; ORCID-shaped ids use the all-zero reserved block and the field
 * is named `orcid_like` because it is not a real registry id. No real person, institution,
 * grant, or identifier appears here.
 *
 * CORPUS DATA OWNERSHIP: the twelve real identity records are authored by the corpus agent.
 * This module ships the same three demo records the core corpus stub covers, so the UI has
 * something to render standalone, and takes the real set through installIdentities().
 */

/** @type {Array<object>} */
let identities = [
  {
    manuscript_id: 'MS-101',
    authors: [
      { name: 'A. Pnin', affiliation: 'Erewhon Station Glaciology Unit', is_corresponding: true, orcid_like: '0000-0000-0000-0101' },
      { name: 'M. Sorel', affiliation: 'Erewhon Station Glaciology Unit', is_corresponding: false, orcid_like: '0000-0000-0000-0102' }
    ],
    affiliations: ['Erewhon Station Glaciology Unit'],
    funding: ['Fenwick Trust grant GF-0914'],
    acknowledgements: 'We thank the Erewhon Station winter crew for four seasons of survey support.',
    author_notes: 'A. Pnin and M. Sorel contributed equally to the inversion design.',
    correspondence_email: 'a.pnin@erewhon-station.invalid',
    external_links: ['https://osf.invalid/ms101'],
    prior_submission_history: [],
    conflict_of_interest: 'None declared.'
  },
  {
    manuscript_id: 'MS-102',
    authors: [
      { name: 'R. Halloway', affiliation: 'Zembla Polytechnic', is_corresponding: true, orcid_like: '0000-0000-0000-0103' },
      { name: 'T. Bek', affiliation: 'Erewhon Station', is_corresponding: false, orcid_like: '0000-0000-0000-0104' }
    ],
    affiliations: ['Zembla Polytechnic', 'Erewhon Station'],
    funding: ['Fenwick Trust grant GF-1180'],
    acknowledgements: 'The calibration archive was maintained by the Zembla Polytechnic instrument shop.',
    author_notes: 'R. Halloway maintained the original first-generation calibration tables.',
    correspondence_email: 'r.halloway@zembla-poly.invalid',
    external_links: ['https://osf.invalid/ms102'],
    prior_submission_history: ['Desk-rejected at Laputa Review, 2023'],
    conflict_of_interest: 'None declared.'
  },
  {
    manuscript_id: 'MS-103',
    authors: [
      { name: 'V. Castel', affiliation: 'Laputa Institute of Applied Optics', is_corresponding: true, orcid_like: '0000-0000-0000-0105' }
    ],
    affiliations: ['Laputa Institute of Applied Optics'],
    funding: ['Costaguana Cellar Archive Fellowship'],
    acknowledgements: 'Spectra were provided by the Laputan cellar archive under its open access terms.',
    author_notes: 'Sole author.',
    correspondence_email: 'v.castel@laputa-optics.invalid',
    external_links: ['https://osf.invalid/ms103'],
    prior_submission_history: ['Withdrawn from Brobdingnag Letters, 2024'],
    conflict_of_interest: 'The author holds no interest in the Laputan cellar archive.'
  }
];

let byManuscript = new Map(identities.map((r) => [r.manuscript_id, r]));

/**
 * Install the real identity records. Called by the UI composition root only.
 * @param {Array<object>} list
 */
export function installIdentities(list) {
  if (!Array.isArray(list)) throw new TypeError('installIdentities: expected an array');
  identities = list;
  byManuscript = new Map(identities.map((r) => [r.manuscript_id, r]));
  return identities.length;
}

/**
 * THE ONLY READER. Every call site must be inside src/ui/.
 * @param {string} manuscriptId
 * @returns {object|null}
 */
export function getIdentity(manuscriptId) {
  return byManuscript.get(manuscriptId) ?? null;
}

/**
 * Which manuscripts have an identity record at all. Returns IDS ONLY — no names, no
 * affiliations — so a caller can size a UI without reading anyone's identity.
 */
export function identityManuscriptIds() {
  return identities.map((r) => r.manuscript_id);
}
