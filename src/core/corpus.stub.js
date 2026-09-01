/**
 * src/core/corpus.stub.js — THREE manuscripts in the exact frozen shape of 02 §1.1/§1.2,
 * plus the full twelve-row SEED_SCORES table of 02 §6.2.
 *
 * WHY THIS EXISTS: the real corpus is written by another agent at src/corpus/manuscripts.public.js.
 * Core must be importable and testable before that file lands, and a static import of a
 * missing module makes every downstream file unloadable. So corpus-access.js defaults to
 * this stub and the app installs the real corpus over it (see installCorpus there).
 *
 * FICTIONAL — written for the Referee demo. Not a real study, dataset, institution, or person.
 * This file holds NO identity data of any kind. It never has and never will: the public
 * store has no fields to strip, because nothing was ever joined (02 §2.2 fact 1).
 */
import { deepFreeze } from './deep-freeze.js';
import { FICTION_LABEL } from './constants.js';
import { BLINDED_FIELD_NAMES } from './field-paths.js';

const countWords = (t) => t.trim().split(/\s+/).length;

function section(id, label, order, text) {
  return { id, label, order, text, word_count: countWords(text) };
}

const MS101_SECTIONS = [
  section('abstract', 'Abstract', 1,
    'We reconstruct subsurface brine channel geometry beneath the Erewhon Station ice shelf using a tidal lattice inversion applied to four seasons of ground-penetrating survey returns. The method resolves channel widths to within eleven centimetres against an independent borehole control set, a factor of three improvement over the standing inversion. We report validation across two hundred and six control points and release the inversion weights in full.'),
  section('introduction', 'Introduction', 2,
    'Brine channel networks govern basal melt rates beneath floating ice, and their geometry has resisted direct measurement because boreholes sample points rather than structures. Prior work at Erewhon Station relied on a single-season inversion that assumed channel walls were locally parallel, an assumption the borehole record does not support. We take the tidal signal itself as the lattice, treating each tidal cycle as an independent illumination of the same subsurface volume, and invert across cycles rather than within one.'),
  section('methods', 'Methods', 3,
    'Survey returns were collected on a fixed one hundred metre grid across four austral seasons, yielding eleven thousand four hundred traces. Each trace was corrected for firn density using the station core record and then binned by tidal phase into sixteen phase windows. The lattice inversion solves for channel wall position jointly across all sixteen windows under a smoothness prior tuned by cross validation on a held-out quarter of the grid. Borehole control points were withheld entirely from tuning and used once, at the end, for validation.'),
  section('results', 'Results', 4,
    'Against the two hundred and six withheld borehole control points the inversion recovers channel width with a root mean square error of eleven centimetres. The standing single-season inversion returns thirty-four centimetres on the same control set. Residuals show no phase dependence, which is the property the lattice construction was intended to produce. Three control points fall outside the ninety-five percent interval and all three sit within twenty metres of the shelf front, where the firn correction is least reliable.'),
  section('discussion', 'Discussion', 5,
    'The improvement comes from treating tidal phase as an illumination axis rather than as noise to be averaged out. This is not a new idea in seismic imaging, and we make no claim to having invented it; the contribution is showing that it survives the low signal-to-noise regime of shelf radar. The obvious limitation is that the method needs four seasons of data before it beats the single-season alternative, which restricts it to long-running stations. We are explicit that the eleven centimetre figure is a validation result at one site and not a general accuracy claim.')
];

const MS102_SECTIONS = [
  section('abstract', 'Abstract', 1,
    'We present a replication protocol for Zemblan split-window thermometry that transfers cleanly across four instrument generations spanning nineteen years. The protocol fixes calibration order, blackbody reference selection, and the atmospheric correction window, and we show that following it reduces inter-generation bias from one point four kelvin to zero point two kelvin. All calibration tables, raw counts, and processing code are released.'),
  section('introduction', 'Introduction', 2,
    'Split-window retrievals have been run at Zembla continuously since the first generation instrument, and the record is used as a climate reference. The difficulty is that each instrument generation shipped with its own calibration convention, and the conventions were never reconciled. Users of the record have therefore been comparing numbers that were produced by different procedures, and the resulting bias has been attributed to physical change more than once.'),
  section('related_work', 'Related Work', 3,
    'Two prior reconciliation attempts exist. The first adjusted post hoc by fitting an offset per generation, which absorbs real signal into the correction and cannot be audited. The second restricted analysis to the overlap periods between generations, which is defensible but discards eighty-one percent of the record. Neither published its calibration tables, so neither could be checked by a third party, and this is the specific gap the present protocol is written to close.'),
  section('methods', 'Methods', 4,
    'The protocol specifies calibration order explicitly: blackbody reference first, then detector nonlinearity, then the atmospheric correction window, and never in another order. Reference selection is fixed to the internal blackbody at the two temperatures common to all four generations. The correction window is fixed at ten point five to twelve point five micrometres. We applied the protocol to the full nineteen year record and to a held-out validation subset of eight hundred and forty overlap observations.'),
  section('results', 'Results', 5,
    'Inter-generation bias falls from one point four kelvin to zero point two kelvin across all six generation pairs. The residual zero point two kelvin is consistent across pairs, which suggests a common uncorrected term rather than a per-instrument defect. On the held-out overlap subset the protocol reproduces the same reduction, so the result is not an artifact of fitting on the full record.'),
  section('discussion', 'Discussion', 6,
    'The contribution here is procedural rather than conceptual, and we would rather say so plainly than dress it up. Nothing in the protocol is a new retrieval physics result. What is new is that the procedure is fully specified, fully released, and demonstrated to transfer across four instrument generations without a fitted per-generation offset. We regard the release of the calibration tables as the more important half of the paper.')
];

const MS103_SECTIONS = [
  section('abstract', 'Abstract', 1,
    'We introduce Lattice Sommelier, a learned attribution model that predicts vintage year from Laputan cellar spectra. On our evaluation set the model attains ninety-one percent top-one accuracy across fourteen vintages, substantially exceeding the expert baseline of sixty-two percent. We argue that spectral attribution is a tractable learning problem and release the model architecture.'),
  section('introduction', 'Introduction', 2,
    'Vintage attribution from cellar spectra has been treated as an expert task requiring years of training. The Laputan cellar archive contains spectra collected under a fixed protocol since the archive opened, which makes it an unusually clean substrate for a learning approach. We ask whether a modest convolutional model can recover vintage directly from the spectrum without hand-designed features.'),
  section('methods', 'Methods', 3,
    'The archive yielded fourteen vintages with between eleven and forty spectra each. Spectra were normalised to unit area and split into training and evaluation partitions. The model is a four layer one-dimensional convolutional network with sixty-four channels per layer trained for two hundred epochs. Hyperparameters were selected by evaluating on the evaluation partition and keeping the best configuration.'),
  section('results', 'Results', 4,
    'Top-one accuracy on the evaluation partition is ninety-one percent, against a sixty-two percent expert baseline measured on the same spectra. Accuracy is highest for the four vintages with the most spectra and falls to seventy percent for the three vintages with fewer than fifteen. The confusion matrix shows errors are concentrated between adjacent vintage years, which is the pattern an expert also produces.'),
  section('discussion', 'Discussion', 5,
    'We are aware that fourteen vintages is a small number of classes and that some vintages contribute only eleven spectra. We are also aware that hyperparameters were selected on the same partition used to report accuracy, and we report the number anyway because it is the number the pipeline produces. A properly held-out third partition would be the correct design and we did not have the sample size for one. The idea is sound; the evaluation is the weak part of this paper and we say so.')
];

function manuscript(id, title, venue_track, field, subfield, keywords, sections, figures = []) {
  return {
    id,
    version: 1,
    title,
    venue_track,
    field,
    subfield,
    keywords,
    sections,
    figures,
    word_count: sections.reduce((n, s) => n + s.word_count, 0),
    fiction: true,
    fiction_label: FICTION_LABEL,
    blinded_fields: BLINDED_FIELD_NAMES
  };
}

/** Same export NAME the real module uses, so installCorpus takes either without adaptation. */
export const MANUSCRIPTS = deepFreeze([
  manuscript('MS-101',
    'Tidal Lattice Reconstruction of Subsurface Brine Channels at Erewhon Station',
    'Cryosphere & Ice Dynamics', 'Geophysics', 'Cryospheric remote sensing',
    ['tidal lattice', 'brine channels', 'ground-penetrating radar', 'inversion'],
    MS101_SECTIONS,
    [{ id: 'F1', section_id: 'results', caption: 'Recovered channel width against borehole control, two hundred and six points, with the ninety-five percent interval shaded.', alt_text: 'Scatter plot of recovered against measured channel width with a shaded interval band.' }]),
  manuscript('MS-102',
    'A Replication Protocol for Zemblan Split-Window Thermometry Across Four Instrument Generations',
    'Instruments & Methods', 'Atmospheric Science', 'Radiometric instrumentation',
    ['split-window', 'calibration', 'replication', 'blackbody reference'],
    MS102_SECTIONS,
    [{ id: 'F1', section_id: 'results', caption: 'Inter-generation bias before and after the protocol, all six generation pairs, in kelvin.', alt_text: 'Paired bar chart showing bias falling for every generation pair.' }]),
  manuscript('MS-103',
    'Lattice Sommelier: Learned Vintage Attribution from Laputan Cellar Spectra',
    'Applied Machine Learning', 'Machine Learning', 'Applied spectroscopy',
    ['vintage attribution', 'spectroscopy', 'convolutional networks'],
    MS103_SECTIONS)
]);

/** 02 §6.2, all twelve rows. Numbers only — this table is what ranking.js is proved against. */
export const SEED_SCORES = deepFreeze({
  'MS-101': { novelty: 9,  rigor: 9, clarity: 8, reproducibility: 8 },
  'MS-102': { novelty: 8,  rigor: 9, clarity: 9, reproducibility: 9 },
  'MS-103': { novelty: 10, rigor: 3, clarity: 7, reproducibility: 4 },
  'MS-104': { novelty: 6,  rigor: 8, clarity: 7, reproducibility: 8 },
  'MS-105': { novelty: 7,  rigor: 7, clarity: 6, reproducibility: 7 },
  'MS-106': { novelty: 5,  rigor: 8, clarity: 8, reproducibility: 7 },
  'MS-107': { novelty: 6,  rigor: 5, clarity: 7, reproducibility: 5 },
  'MS-108': { novelty: 4,  rigor: 6, clarity: 9, reproducibility: 8 },
  'MS-109': { novelty: 3,  rigor: 6, clarity: 6, reproducibility: 6 },
  'MS-110': { novelty: 7,  rigor: 4, clarity: 4, reproducibility: 3 },
  'MS-111': { novelty: 2,  rigor: 5, clarity: 7, reproducibility: 4 },
  'MS-112': { novelty: 2,  rigor: 3, clarity: 3, reproducibility: 2 }
});

/** Titles for the nine manuscripts the stub carries no prose for, so the queue still renders. */
export const STUB_TITLES = deepFreeze({
  'MS-104': 'Slow-Light Interferometry in the Vespucian Fog Belt: A Two-Season Field Study',
  'MS-105': 'Governance Load and Quorum Failure in the Grand Fenwick Housing Cooperatives',
  'MS-106': 'ZEMBLA-IMP: A Benchmark Suite for Sparse Tide-Gauge Imputation',
  'MS-107': 'Olfactory Wayfinding in the Erewhon Cave Salamander',
  'MS-108': 'Teaching Statistical Power with the Laputa Simulation Kit: A Classroom Trial',
  'MS-109': 'A Survey of Provenance Formats in Digital Archives of the Ruritanian Record',
  'MS-110': 'Consciousness-Adjacent Signal Compression in Zemblan Coral Colonies',
  'MS-111': 'Re-derivation of the Fenwick Constant by Elementary Means',
  'MS-112': 'Ten Reasons the Laputan Grid Is About to Fail'
});
