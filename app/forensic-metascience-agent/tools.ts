// The public catalogue of the forensic metascience agent's toolkit.
//
// Seeded from `registry.SPECS` in the agent repo (`ToolSpec.integrity_card()`
// supplies purpose, evidence class, severity ceiling, assumptions and the typed
// input list), then rewritten for a human audience -- the registry's own prose is
// written imperatively at the model and reads badly in public.
//
// TWO RULES THIS FILE EXISTS TO KEEP:
//
//  1. `ceiling` is the EFFECTIVE worst verdict a tool can deliver, not the one its
//     evidence class nominally allows. `check_ratio` is registered `absolute` but
//     both its description and its own assumptions cap it at `suspicious`; printing
//     "can return: impossible" for a tool that never does would be exactly the kind
//     of overstated claim this project exists to catch.
//  2. `quarantined` tools always deliver `indeterminate` in the pipeline, whatever
//     their detector scored. Listing them without that caveat would advertise
//     verdicts the pipeline deliberately withholds.
//
// Every `reference` below was resolved through the DOI metadata fetcher in
// `data_ingestor/fetch_metadata_from_doi.py`. Methods whose primary source could
// not be verified (DEBIT, GRIM-U, the Jane et al. within-subjects identity) cite
// Heathers 2025 -- the text the implementation actually works from -- rather than
// an approximated citation.

export type EvidenceClass = "exact" | "probabilistic" | "descriptive";

export type Ceiling = "impossible" | "highly suspicious" | "suspicious" | "indeterminate";

/** Which part of the pipeline can call the tool. */
export type Reach = "sweep" | "editorial" | "both" | "deterministic-track";

export interface ToolInput {
  name: string;
  /** Human type: "integer", "list of numbers", "table of numbers", "PDF file", ... */
  type: string;
  required: boolean;
  /** Only where the guard genuinely changes the verdict. */
  note?: string;
}

export interface ToolReference {
  authors: string;
  title: string;
  /** Rendered in italics. */
  journal?: string;
  /** Rendered in bold. */
  volume?: string;
  issue?: string;
  pages?: string;
  /** Rendered last, after the pagination. */
  year: string;
  /** Not displayed: it is the link target on the title. */
  doi?: string;
}

export interface Tool {
  slug: string;
  name: string;
  /**
   * The name this tool carries in the agent's registry. Absent for the
   * individual stages of the two deterministic screens: those run as a fixed
   * sequence inside one registered tool rather than being separately
   * invocable, and giving them a registry name they do not have would be a
   * claim about the interface that is not true.
   */
  registryName?: string;
  /** For a pipeline stage: the registry name of the tool it runs inside. */
  partOf?: string;
  /** Position in that pipeline, 1-based. */
  step?: number;
  cli?: string;
  /** The tile face in the stack display. */
  monogram: string;
  /**
   * ONE verb-first sentence saying what the tool DOES. This is the tooltip
   * text, and it is a different sentence from `whenToApply`: a reader hovering
   * a tile is asking "what is this", not "when would I reach for it".
   * Seeded from each registered tool's `purpose` in the agent registry.
   */
  does: string;
  whenToApply: string;
  howItWorks: string;
  inputs: ToolInput[];
  output: string;
  evidence: EvidenceClass;
  ceiling: Ceiling;
  reach: Reach;
  quarantined?: boolean;
  references?: ToolReference[];
}

export interface ToolFamily {
  slug: string;
  title: string;
  /** Two or three words for the stack caption. */
  shortTitle: string;
  blurb: string;
  tools: Tool[];
  /**
   * When set, this family's pipeline STAGES (the tools carrying `partOf`) are
   * documented on their own page at this path rather than inline in the main
   * toolkit list, which would otherwise be dominated by one tool's internals.
   * The registered tool itself still appears in the main list.
   */
  pipelinePath?: string;
  /**
   * Kept in the data but not shown on either public surface. Extraction and
   * parsing are how the numbers are READ, not checks on them, and listing them
   * beside the forensic tools made the toolkit look a third larger than the set
   * of things that can actually find a problem.
   */
  unlisted?: boolean;
}

// ---------------------------------------------------------------------------
// References (all verified against Crossref / DataCite)
// ---------------------------------------------------------------------------

const REF = {
  grim: {
    authors: "Brown, N. J. L., & Heathers, J. A. J.",
    title:
      "The GRIM Test: A Simple Technique Detects Numerous Anomalies in the Reporting of Results in Psychology",
    journal: "Social Psychological and Personality Science",
    volume: "8",
    issue: "4",
    pages: "363–369",
    year: "2017",
    doi: "10.1177/1948550616673876",
  },
  grimmer: {
    authors: "Anaya, J.",
    title:
      "The GRIMMER test: A method for testing the validity of reported measures of variability",
    journal: "PeerJ Preprints",
    volume: "4",
    pages: "e2400v1",
    year: "2016",
    doi: "10.7287/peerj.preprints.2400v1",
  },
  sprite: {
    authors: "Heathers, J. A., Anaya, J., van der Zee, T., & Brown, N. J. L.",
    title:
      "Recovering data from summary statistics: Sample Parameter Reconstruction via Iterative TEchniques (SPRITE)",
    journal: "PeerJ Preprints",
    volume: "6",
    pages: "e26968v1",
    year: "2018",
    doi: "10.7287/peerj.preprints.26968v1",
  },
  rivets: {
    authors: "Brown, N. J. L., & Heathers, J.",
    title:
      "Rounded Input Variables, Exact Test Statistics (RIVETS)",
    journal: "PsyArXiv",
    year: "2019",
    doi: "10.31234/osf.io/ctu9z",
  },
  statcheck: {
    authors: "Nuijten, M. B., Hartgerink, C. H. J., van Assen, M. A. L. M., Epskamp, S., & Wicherts, J. M.",
    title:
      "The prevalence of statistical reporting errors in psychology (1985–2013)",
    journal: "Behavior Research Methods",
    volume: "48",
    issue: "4",
    pages: "1205–1226",
    year: "2016",
    doi: "10.3758/s13428-015-0664-2",
  },
  carlisle2017: {
    authors: "Carlisle, J. B.",
    title:
      "Data fabrication and other reasons for non‐random sampling in 5087 randomised, controlled trials in anaesthetic and general medical journals",
    journal: "Anaesthesia",
    volume: "72",
    issue: "8",
    pages: "944–952",
    year: "2017",
    doi: "10.1111/anae.13938",
  },
  carlisle2021: {
    authors: "Carlisle, J. B.",
    title:
      "False individual patient data and zombie randomised controlled trials submitted to Anaesthesia",
    journal: "Anaesthesia",
    volume: "76",
    issue: "4",
    pages: "472–479",
    year: "2021",
    doi: "10.1111/anae.15263",
  },
  simonsohn: {
    authors: "Simonsohn, U.",
    title:
      "Just Post It: The Lesson From Two Cases of Fabricated Data Detected by Statistics Alone",
    journal: "Psychological Science",
    volume: "24",
    issue: "10",
    pages: "1875–1888",
    year: "2013",
    doi: "10.1177/0956797613480366",
  },
  hartgerink: {
    authors: "Hartgerink, C. H. J., Voelkel, J. G., Wicherts, J. M., & van Assen, M. A. L. M.",
    title:
      "Detection of data fabrication using statistical tools",
    journal: "PsyArXiv",
    year: "2019",
    doi: "10.31234/osf.io/jkws4",
  },
  bolland: {
    authors: "Bolland, M. J., Gamble, G. D., Avenell, A., Grey, A., & Lumley, T.",
    title:
      "Baseline P value distributions in randomized trials were uniform for continuous but not categorical variables",
    journal: "Journal of Clinical Epidemiology",
    volume: "112",
    pages: "67–76",
    year: "2019",
    doi: "10.1016/j.jclinepi.2019.05.006",
  },
  olsen: {
    authors: "Olsen, C. H.",
    title:
      "Review of the Use of Statistics in Infection andImmunity",
    journal: "Infection and Immunity",
    volume: "71",
    issue: "12",
    pages: "6689–6692",
    year: "2003",
    doi: "10.1128/iai.71.12.6689-6692.2003",
  },
  benjaminiHochberg: {
    authors: "Benjamini, Y., & Hochberg, Y.",
    title:
      "Controlling the False Discovery Rate: A Practical and Powerful Approach to Multiple Testing",
    journal: "Journal of the Royal Statistical Society Series B",
    volume: "57",
    issue: "1",
    pages: "289–300",
    year: "1995",
    doi: "10.1111/j.2517-6161.1995.tb02031.x",
  },
  benjaminiYekutieli: {
    authors: "Benjamini, Y., & Yekutieli, D.",
    title:
      "The control of the false discovery rate in multiple testing under dependency",
    journal: "The Annals of Statistics",
    volume: "29",
    issue: "4",
    pages: "1165–1188",
    year: "2001",
    doi: "10.1214/aos/1013699998",
  },
  lovakov: {
    authors: "Lovakov, A., & Agadullina, E. R.",
    title:
      "Empirically derived guidelines for effect size interpretation in social psychology",
    journal: "European Journal of Social Psychology",
    volume: "51",
    issue: "3",
    pages: "485–504",
    year: "2021",
    doi: "10.1002/ejsp.2752",
  },
  bik: {
    authors: "Bik, E. M., Casadevall, A., & Fang, F. C.",
    title:
      "The Prevalence of Inappropriate Image Duplication in Biomedical Research Publications",
    journal: "mBio",
    volume: "7",
    issue: "3",
    pages: "e00809–16",
    year: "2016",
    doi: "10.1128/mBio.00809-16",
  },
  bakker: {
    authors: "Bakker, M., Veldkamp, C. L. S., van Assen, M. A. L. M., Crompvoets, E. A. V., Ong, H. H., Nosek, B. A., Soderberg, C. K., Mellor, D., & Wicherts, J. M.",
    title:
      "Ensuring the quality and specificity of preregistrations",
    journal: "PLOS Biology",
    volume: "18",
    issue: "12",
    pages: "e3000937",
    year: "2020",
    doi: "10.1371/journal.pbio.3000937",
  },
  heathers: {
    authors: "Heathers, James",
    title:
      "An Introduction to Forensic Metascience",
    journal: "forensicmetascience.com",
    year: "2025",
    doi: "10.5281/zenodo.14871843",
  },
} satisfies Record<string, ToolReference>;

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

export const toolFamilies: ToolFamily[] = [
  {
    slug: "ingestion",
    title: "Ingestion & table parsing",
    shortTitle: "Ingestion",
    unlisted: true,
    blurb:
      "Nothing can be checked until the numbers have been read correctly, and most of the ways an audit goes wrong happen here. These tools pull text and tables out of PDFs, publisher XML, HTML and supplementary files, and classify each cell before any arithmetic touches it. They render no verdict — and they distinguish “we could not read this” from “there was nothing to read”, which is the difference between an honest gap and a paper falsely reported clean.",
    tools: [
      {
        slug: "extract-pdf",
        name: "PDF extraction",
        registryName: "extract_pdf",
        cli: "metascience extract",
        monogram: "PDF",
        does:
          "Extracts text and resolvable tables from a PDF; renders no verdict.",
        whenToApply:
          "The default reader for any paper or supplement that arrives as a PDF.",
        howItWorks:
          "Reads text and resolvable table grids page by page with pdfplumber, capped in length and windowable by page range. Each table records whether its column boundaries were read from rules the PDF actually drew or inferred from text alignment — an inferred grid is marked alignment_uncertain, because a shifted column label hands the arithmetic checks a triple the paper never reported.",
        inputs: [
          { name: "pdf_path", type: "PDF file", required: true },
          { name: "first_page / last_page", type: "integers", required: false, note: "Window a long document instead of truncating it." },
          { name: "max_chars", type: "integer", required: false },
        ],
        output:
          "Body text, a list of resolved tables with their cells, and a count of candidates rejected as prose. An empty tables list does not mean the paper has no tables — unresolvable grids stay in the text, and the result says so rather than implying absence.",
        evidence: "descriptive",
        ceiling: "indeterminate",
        reach: "both",
      },
      {
        slug: "extract-xml",
        name: "XML extraction (JATS / PMC / Elsevier)",
        registryName: "extract_xml",
        cli: "metascience extract-xml",
        monogram: "XML",
        does:
          "Indexes body text and tables from publisher XML; renders no verdict.",
        whenToApply:
          "Whenever a paper ships publisher XML — this is the primary source, ahead of the PDF.",
        howItWorks:
          "Parses JATS <article>, PMC article sets and Elsevier full-text responses (whose CALS tables carry no <table-wrap> at all) into body text plus an index of every table: number, label, caption, section, shape and footnote count. Merged cells are placed once at their anchor rather than repeated, because repeating a merged (mean, SD) cell would manufacture duplicate pairs out of the parser alone.",
        inputs: [
          { name: "xml_path", type: "XML file", required: true },
          { name: "first_section / last_section", type: "integers", required: false },
          { name: "max_chars", type: "integer", required: false },
        ],
        output:
          "Body text and a table index — not the grids themselves; fetch those with “One table in full”. Tables flagged alignment_uncertain or image_only are marked as needing reconciliation against the PDF before use. On real clinical tables this route yields roughly 86 usable cells per table against about 7 via the PDF.",
        evidence: "descriptive",
        ceiling: "indeterminate",
        reach: "both",
      },
      {
        slug: "extract-html",
        name: "HTML extraction",
        registryName: "extract_html",
        cli: "metascience extract-html",
        monogram: "HTML",
        does:
          "Extracts full text from a publisher HTML article; renders no verdict.",
        whenToApply:
          "The fallback for fetched publisher full text when no XML is available.",
        howItWorks:
          "Extracts sections and tables from a saved publisher page into the same cell contract the XML route uses. Before parsing anything it runs a landing-page check: publishers serve abstract-only stubs at article URLs, and treating a stub as the full text turns every “not reported” finding into an artefact of what we failed to fetch.",
        inputs: [
          { name: "html_path", type: "HTML file", required: true },
          { name: "first_section / last_section", type: "integers", required: false },
          { name: "max_chars", type: "integer", required: false },
        ],
        output:
          "Body text plus tables with cells and spans. A detected stub returns a structured refusal — that refusal is the result, and it is a different fact from “zero tables found”.",
        evidence: "descriptive",
        ceiling: "indeterminate",
        reach: "both",
      },
      {
        slug: "extract-supplement",
        name: "Supplementary file reader",
        registryName: "extract_supplement",
        cli: "metascience extract-supplement",
        monogram: "Supp",
        does:
          "Reads supplementary .docx/.xlsx/.csv tables into checkable cells; renders no verdict.",
        whenToApply:
          "Any supplementary file — the participant-level data that makes the strongest checks possible usually lives here.",
        howItWorks:
          "One reader for every format the literature actually ships: .pdf, .docx, .xlsx, .csv/.tsv, .html, .epub, .xml, .txt/.md and images through an OCR seam. All of them return the same table shape, so downstream checks do not care where a grid came from.",
        inputs: [{ name: "path", type: "file of any supported type", required: true }],
        output:
          "A grid plus typed cells, or one of four distinct refusals that must not be conflated: no OCR engine on this machine, a PDF whose pages are pictures, an unreadable format, or a file that was read and genuinely holds no tables. “Present but unreadable” is itself the result — such a supplement must never be reported as absent. Oversized files return an index rather than contents.",
        evidence: "descriptive",
        ceiling: "indeterminate",
        reach: "both",
      },
      {
        slug: "extract-figures",
        name: "Figure extraction",
        registryName: "extract_figures",
        cli: "metascience extract-figures",
        monogram: "Figures",
        does:
          "Locates, crops and captions the figures in a PDF; renders no verdict.",
        whenToApply:
          "When a paper's outcome appears only in a chart — common, and the group means and SDs needed for an effect size often appear nowhere else.",
        howItWorks:
          "Locates each figure by anchoring on its caption and crops to the artwork, rather than pulling embedded image streams, because most journal charts are vector linework that stream extraction cannot see. It also reads the error-bar meaning out of the caption.",
        inputs: [
          { name: "pdf_path", type: "PDF file", required: true },
          { name: "out_dir", type: "directory", required: false },
          { name: "dpi", type: "integer", required: false },
        ],
        output:
          "Per figure: label, page, caption, crop path, a crop_confidence of high / partial / low / none, and the error-bar meaning (SD, SEM, CI, IQR, range — or null). A null there matters: unlabelled error bars cannot yield an effect size at all, and the tool says so instead of assuming SEM. Anything later read off the marks carries measured provenance and is barred from the exact-arithmetic checks.",
        evidence: "descriptive",
        ceiling: "indeterminate",
        reach: "sweep",
      },
      {
        slug: "get-table",
        name: "One table, in full",
        registryName: "get_table",
        cli: "metascience get-table",
        monogram: "Table",
        does:
          "Fetches one XML table in full with its label, caption and footnotes; renders no verdict.",
        whenToApply:
          "After the XML index has told you which table you want.",
        howItWorks:
          "Returns a single XML table complete with its label, caption and footnotes, either whole or by row window, as both a grid and a list of typed-cell candidates. Footnotes are returned because they define cell semantics — whether a column is “n (%)” or “mean (SD)” is decided there, not by the numbers.",
        inputs: [
          { name: "xml_path", type: "XML file", required: true },
          { name: "table_num", type: "integer", required: true },
          { name: "first_row / last_row", type: "integers", required: false },
        ],
        output:
          "Cells, grid, headers, caption, footnotes, an explicit data_is_complete flag and instructions for fetching the rest. The completeness flag exists because a windowed table once reported itself complete while delivering 61% of its rows.",
        evidence: "descriptive",
        ceiling: "indeterminate",
        reach: "both",
      },
      {
        slug: "get-supplement-table",
        name: "One supplement sheet",
        registryName: "get_supplement_table",
        cli: "metascience get-supplement-table",
        monogram: "Sheet",
        does:
          "Fetches ONE sheet of a supplement, whole or by row window; renders no verdict.",
        whenToApply:
          "The counterpart to the supplement reader when a file was large enough to return only an index.",
        howItWorks:
          "Fetches one worksheet by number or name, whole or by row window. The header row comes back with every window — a grid of numbers without its column names is not checkable — and row numbering is shared with the cell view so both window on one coordinate.",
        inputs: [
          { name: "path", type: "supplement file", required: true },
          { name: "table", type: "sheet number or name", required: true },
          { name: "first_row / last_row", type: "integers", required: false },
        ],
        output:
          "The sheet's cells and grid, plus a note stating its own window. Rows outside the window were not returned and are evidence of nothing — treating an index as the contents is the error this pair exists to prevent.",
        evidence: "descriptive",
        ceiling: "indeterminate",
        reach: "both",
      },
      {
        slug: "parse-cells-typed",
        name: "Typed cell parsing",
        registryName: "parse_cells_typed",
        cli: "metascience parse-cells",
        monogram: "Typed cells",
        does:
          "Classifies table cells by kind before any check runs; renders no verdict.",
        whenToApply:
          "First, on any table, before a single forensic check runs.",
        howItWorks:
          "Classifies each cell by kind — mean (SD), n (%), median (IQR), median (range), estimate (CI), mean (SE), plain numeric, count, ambiguous or non-numeric — using the row and column labels as context. Which checks are then applicable follows from cell kind and variable family; it is not a choice.",
        inputs: [
          { name: "cells", type: "list of cells (raw text, row label, column label)", required: true },
        ],
        output:
          "A typed cell per input, a coverage figure, and the unparsed cells clustered by shape so a systematic miss is visible. Cells returned ambiguous carry their candidate readings and must not be fed to any forensic tool — “142 (71.0)” is a valid mean (SD) and a valid n (%), and the numbers cannot choose.",
        evidence: "descriptive",
        ceiling: "indeterminate",
        reach: "both",
      },
      {
        slug: "parse-cells-as-declared",
        name: "Declared-format cell parsing",
        registryName: "parse_cells_as_declared",
        cli: "metascience parse-cells-as",
        monogram: "Declared",
        does:
          "Parses cells under a model-declared format from a closed vocabulary; renders no verdict.",
        whenToApply:
          "When typed parsing left cells unread and the table's header, caption or footnotes say what the format is.",
        howItWorks:
          "Re-parses under a format named from a closed vocabulary — six pairings crossed with seven delimiters. The format name comes from the reader; every character of the matching is existing code, because a regex generated at run time is a generated statistic, and a wrong capture becomes a plausible mean nothing downstream can recognise as wrong.",
        inputs: [
          { name: "cells", type: "list of cells", required: true },
          { name: "declared", type: "format name, e.g. mean_sd:paren", required: true, note: "From a closed vocabulary — arbitrary patterns are not accepted." },
          { name: "min_fit", type: "number 0–1", required: false, note: "Below this share of cells fitting, the whole declaration is refused." },
        ],
        output:
          "Newly-read cells, the misfits, and a count of cells where the declaration overrode the automatic reading. The declaration is a hypothesis that gets tested, not an instruction that gets obeyed: it is refused wholesale if it fits too few cells.",
        evidence: "descriptive",
        ceiling: "indeterminate",
        reach: "both",
      },
      {
        slug: "parse-table",
        name: "Table parsing & reconciliation",
        registryName: "parse_table",
        cli: "metascience parse-table",
        monogram: "Reconcile",
        does:
          "Parses a summary table into normalised cells, and can reconcile two renderings of it.",
        whenToApply:
          "To normalise a loose table, or to compare two independent renderings of the same one.",
        howItWorks:
          "Parses markdown, an extracted grid or raw text into normalised cells. Given a second rendering it reconciles the two and reports every cell where they disagree. It drops cells it cannot reduce to a scalar, so estimate-plus-CI columns should go through the XML cell route instead.",
        inputs: [
          { name: "source", type: "a table as markdown, grid or text", required: true },
          { name: "cross_check", type: "a second rendering of the same table", required: false, note: "Without this the tool renders no verdict at all." },
          { name: "header_row / label_col", type: "integers", required: false },
        ],
        output:
          "Normalised cells and parse warnings. A cross-check disagreement is evidence about OUR extraction, not about the paper — by far the likeliest cause is that one of the two parsers misread the table — so it must be confirmed against the source before it is cited.",
        evidence: "probabilistic",
        ceiling: "highly suspicious",
        reach: "both",
      },
    ],
  },
  {
    slug: "granularity",
    title: "Granularity — the GRIM family",
    shortTitle: "Granularity",
    blurb:
      "Integer data cannot produce just any summary statistic. Whole-number responses — Likert items, counts, binary outcomes — force means, percentages and standard deviations onto a discrete lattice fixed by the sample size and the reported precision. A value off that lattice was not computed from the data described. These are the toolkit's strongest checks: they need nothing but the numbers already printed, and a failure is arithmetic rather than opinion.",
    tools: [
      {
        slug: "grim",
        name: "GRIM",
        registryName: "grim_check",
        cli: "metascience grim",
        monogram: "GRIM",
        does:
          "Checks whether a reported mean is reachable at all for its sample size and printed precision.",
        whenToApply:
          "A reported mean of data where every subject contributed a whole number, with the sample size known.",
        howItWorks:
          "The mean of n integers must be some integer total divided by n. GRIM asks whether any integer total rounds to the mean exactly as printed. The tolerance scales with n rather than being a fixed half-unit, and both the round-half and truncation reporting conventions are tried before anything is flagged.",
        inputs: [
          { name: "mean", type: "number", required: true, note: "As printed, not recomputed." },
          { name: "n", type: "integer", required: true },
          { name: "decimals", type: "integer", required: true, note: "Printed decimals of the mean — “5.9” is 1, “5.90” is 2. There is no default: a wrong value accuses, so a missing one is refused." },
          { name: "scale_min / scale_max", type: "integers", required: false },
          { name: "data_type", type: "integer / continuous / unknown", required: false, note: "Continuous data is refused outright rather than judged." },
          { name: "discreteness_source", type: "stated / logically_necessary / assumed", required: false, note: "Who says each subject contributed a whole number. On an assumed premise a granularity failure caps at suspicious." },
        ],
        output:
          "Consistent, or a failure naming its mode — granularity or range violation, reported separately rather than fused. Only a failure resting on a stated or logically necessary premise reaches impossible; assumed bounds, assumed discreteness and truncation-only passes all cap at suspicious. Values read off a figure are refused, not judged.",
        evidence: "exact",
        ceiling: "impossible",
        reach: "both",
        references: [REF.grim],
      },
      {
        slug: "grim-percentage",
        name: "GRIM for percentages",
        registryName: "grim_percentage",
        monogram: "GRIM %",
        does:
          "Checks whether a reported percentage can be an integer count's share of the sample.",
        whenToApply:
          "A percentage that is a count's share of the sample — considerably more powerful than GRIM on a mean, because percentages carry more precision.",
        howItWorks:
          "A share of a sample must be 100·k/n for some integer k, so at a given n only a finite set of percentages exists. Both round-half and truncation conventions are tried: SPSS and several journal styles truncate, and 9/93 = 9.6774 printed as “9.6%” is a truncating reporter rather than an impossibility.",
        inputs: [
          { name: "percentage", type: "number", required: true },
          { name: "n", type: "integer", required: true, note: "Must be the true denominator of THIS percentage, not the study total." },
          { name: "decimals", type: "integer", required: false },
          { name: "data_type", type: "string", required: false, note: "Defaults to unknown deliberately, so an omission refuses rather than assumes." },
        ],
        output:
          "Whether the percentage is achievable at that sample size. Means, concentrations and ratios are refused — they are not constrained to multiples of 100/n. A truncation-only pass caps at suspicious.",
        evidence: "exact",
        ceiling: "impossible",
        reach: "sweep",
        references: [REF.grim],
      },
      {
        slug: "grim-sweep",
        name: "GRIM sweep",
        registryName: "grim_sweep",
        cli: "metascience grim-sweep",
        monogram: "GRIM sweep",
        does:
          "Finds every sample size at which several percentages could share one denominator.",
        whenToApply:
          "Several percentages that are supposed to share one denominator — a subgroup breakdown, or a row of a demographics table.",
        howItWorks:
          "GRIM normally needs the sample size. Here the sample size is what is missing or disputed, so the logic runs backwards: for each reported value, enumerate every candidate n at which that value is achievable, then intersect those sets across all the values. What survives is the set of sample sizes that could have produced the whole row at once. An empty intersection is repeated under the truncation convention before any verdict is formed.",
        inputs: [
          { name: "values", type: "list of numbers", required: true },
          { name: "n_max", type: "integer", required: true },
          { name: "n_max_source", type: "stated / logically_necessary / assumed", required: false, note: "Load-bearing, and it gates the verdict together with n_min: only a stated n_max plus an n_min reaching the floor licenses impossible." },
          { name: "n_min", type: "integer", required: false },
          { name: "decimals", type: "integer", required: false },
        ],
        output:
          "The viable sample sizes per value and the joint intersection. A single surviving n is the recovered denominator; several mean the row does not pin it down. An empty intersection is NOT automatically a finding, and three outcomes are distinguished. If the values do share an n under TRUNCATION — which SPSS and several journal styles use — the verdict is consistent and it is recorded as a reporting convention, because a truncating reporter is not an impossibility. If no convention rescues them, impossible requires that the searched range provably bracket the true n: n_max must be the paper's own stated total and n_min must reach the floor. Otherwise the result is indeterminate, and says so — an empty intersection inside a range WE chose is a fact about the search, not about the paper.",
        evidence: "exact",
        ceiling: "impossible",
        reach: "sweep",
        references: [REF.grim],
      },
      {
        slug: "grimmer",
        name: "GRIMMER",
        registryName: "grimmer_check",
        cli: "metascience grimmer",
        monogram: "GRIMMER",
        does:
          "Checks whether a reported SD is reachable for integer data with that mean and sample size.",
        whenToApply:
          "A standard deviation reported beside a mean and sample size for integer data.",
        howItWorks:
          "Standard deviations are granular for the same reason means are. GRIMMER enumerates the achievable pairs of sum and sum-of-squares behind the reported mean, subject to the parity constraint that the two must agree modulo 2, and asks whether any of them produces the reported SD at its printed precision.",
        inputs: [
          { name: "mean", type: "number", required: true },
          { name: "sd", type: "number", required: true },
          { name: "n", type: "integer", required: true },
          { name: "decimals / decimals_sd", type: "integers", required: false, note: "Printed precision of each. A wrong assumed precision accuses." },
          { name: "scale_min / scale_max", type: "integers", required: false },
          { name: "discreteness_source", type: "stated / logically_necessary / assumed", required: false },
        ],
        output:
          "Consistent, or the constraint that failed. Only integer and parity failures license impossible; range-dependent failures on assumed bounds cap at suspicious, as do granularity modes on assumed discreteness. Both the sample and population SD conventions are tried, and a population-only match caps at suspicious.",
        evidence: "exact",
        ceiling: "impossible",
        reach: "both",
        references: [REF.grimmer],
      },
      {
        slug: "debit",
        name: "DEBIT",
        registryName: "debit_check",
        cli: "metascience debit",
        monogram: "DEBIT",
        does:
          "Checks a binary variable's SD against the value its mean and sample size force.",
        whenToApply:
          "A binary (0/1) variable reported as a mean and an SD — very common in Table 1 of a clinical paper.",
        howItWorks:
          "For binary data the SD is not free: the mean fixes it exactly. DEBIT checks the reported SD against the value the mean and n force, testing both the sample (n−1) and population conventions before saying anything.",
        inputs: [
          { name: "mean", type: "number (a proportion)", required: true },
          { name: "sd", type: "number", required: true },
          { name: "n", type: "integer", required: true },
          { name: "decimals_mean", type: "integer", required: true, note: "Printed decimals. A defaulted 2 dp falsely accused 73.6% of 1 dp rows in testing." },
          { name: "decimals_sd", type: "integer", required: true },
          { name: "data_type", type: "binary / proportion", required: false, note: "Anything else is refused rather than judged — a tool pointed at the wrong data must refuse, not accuse." },
        ],
        output:
          "Consistent, or an inconsistency with the SD the data would have to have. A row consistent under the population-SD convention is suspicious, never impossible — that convention is legitimate, and treating it as fraud produced 66 false accusations in a 450-case validation grid.",
        evidence: "exact",
        ceiling: "impossible",
        reach: "both",
        references: [REF.heathers],
      },
      {
        slug: "debit-batch",
        name: "DEBIT (whole table)",
        registryName: "debit_check_batch",
        monogram: "DEBIT+",
        does:
          "Runs DEBIT over many binary rows; escalates only on a pattern of impossible rows.",
        whenToApply:
          "An entire demographics table of binary variables, screened in one pass.",
        howItWorks:
          "Runs the same arithmetic over every row, then judges the table rather than the row. Escalation requires a pattern of impossible rows; a lone hit stays suspicious.",
        inputs: [
          { name: "rows", type: "table of rows (mean, SD, n, printed decimals)", required: true },
          { name: "data_type", type: "binary / proportion", required: false, note: "Required in practice — omitting it refuses the whole batch." },
          { name: "decimals_mean / decimals_sd", type: "integers", required: false, note: "Supply per row; the batch default of 2 dp falsely accuses 1 dp proportions." },
        ],
        output:
          "Every non-consistent row plus an aggregate verdict, and always the denominator — three suspicious rows out of 140 checks and three out of four are very different papers. A batch in which no row could be evaluated is indeterminate, never consistent.",
        evidence: "exact",
        ceiling: "impossible",
        reach: "sweep",
        references: [REF.heathers],
      },
      {
        slug: "reconstruct-2x2",
        name: "2×2 reconstruction",
        registryName: "reconstruct_2x2",
        cli: "metascience reconstruct-2x2",
        monogram: "2×2",
        does:
          "Reconstructs the 2x2 tables consistent with two column percentages and a total N.",
        whenToApply:
          "A contingency result reported only as two column percentages and a total N, with the underlying counts withheld.",
        howItWorks:
          "Enumerates every column split of the total and keeps the 2×2 tables whose cell counts round to both printed percentages. If a reported χ² is supplied, the candidate set is filtered by it as well.",
        inputs: [
          { name: "pct_col1 / pct_col2", type: "numbers", required: true },
          { name: "n_total", type: "integer", required: true },
          { name: "decimals", type: "integer", required: false },
          { name: "reported_chi2", type: "number", required: false },
        ],
        output:
          "The set of reconstructable tables, ordered by group-balance plausibility, or a proof that none exists. Impossibility is decided over every column split — the balance ratio only orders the survivors. A non-matching χ² yields indeterminate, never an accusation.",
        evidence: "exact",
        ceiling: "impossible",
        reach: "both",
      },
      {
        slug: "grimu",
        name: "GRIM-U",
        registryName: "grimu_check",
        cli: "metascience grimu",
        monogram: "GRIM-U",
        does:
          "Checks a Mann-Whitney p against the finite set achievable at these group sizes.",
        whenToApply:
          "A p-value attributed to a Mann–Whitney U or Wilcoxon rank-sum test, with both group sizes known. Nothing else — t, F and χ² p-values are refused.",
        howItWorks:
          "The U statistic takes only (half-)integer values between 0 and n₁·n₂, so at given group sizes only a finite set of p-values is achievable. The modelled set spans the normal approximation with and without continuity correction, plus the exact permutation p.",
        inputs: [
          { name: "n1 / n2", type: "integers", required: true },
          { name: "reported_p", type: "text, e.g. “0.043” or “<0.001”", required: true, note: "Passed as text so a threshold keeps its “<” — stripping it has turned an indeterminate result into a headline accusation." },
          { name: "test_type", type: "mann_whitney / wilcoxon", required: false, note: "Any other test is refused, not scored." },
          { name: "one_sided", type: "true / false", required: false },
        ],
        output:
          "Impossible below the U = 0 floor under every convention; suspicious inside a granularity gap; otherwise consistent. Known limitation, stated in the result: the tie-corrected variance that R and scipy use on tied data is not in the modelled set, so an impossible verdict on heavily tied data is unproven until checked again by hand.",
        evidence: "exact",
        ceiling: "impossible",
        reach: "both",
        references: [REF.heathers],
      },
      {
        slug: "grimu-coexistence",
        name: "GRIM-U coexistence",
        registryName: "grimu_coexistence",
        cli: "metascience grimu-coexist",
        monogram: "GRIM-U ≈",
        does:
          "Flags near-identical Mann-Whitney p-values that cannot all arise at these group sizes.",
        whenToApply:
          "Two or more nearly identical rank-sum p-values reported at the same group sizes — say 0.171 and 0.172.",
        howItWorks:
          "Because the achievable p-values are a finite, unevenly spaced set, two p-values differing by less than the local spacing cannot both be real. This maps each reported value to the achievable U's and asks whether they can coexist.",
        inputs: [
          { name: "n1 / n2", type: "integers", required: true },
          { name: "p_values", type: "list of numbers", required: true },
          { name: "one_sided", type: "true / false", required: false, note: "Forcing the two-sided set on one-tailed reports manufactures accusations." },
        ],
        output:
          "Whether the reported values can all arise at these group sizes. Carries the same tie-correction limitation as GRIM-U.",
        evidence: "exact",
        ceiling: "impossible",
        reach: "both",
        references: [REF.heathers],
      },
      {
        slug: "sprite",
        name: "SPRITE",
        registryName: "sprite_reconstruct",
        cli: "metascience sprite",
        monogram: "SPRITE",
        does:
          "Searches for integer samples matching a reported mean and SD, and proves when none exists.",
        whenToApply:
          "A mean and SD on a bounded integer scale, when you want to see what the underlying data could have looked like — or prove it could not have existed.",
        howItWorks:
          "Searches for integer samples on the stated scale whose mean and SD round to the reported values, matching the SD at its reported precision rather than on exact variance. Alongside the search runs an analytic integer-and-parity screen that can prove no sample exists.",
        inputs: [
          { name: "mean", type: "number", required: true },
          { name: "sd", type: "number", required: true },
          { name: "n", type: "integer", required: true },
          { name: "scale_min / scale_max", type: "integers", required: false },
          { name: "decimals_mean / decimals_sd", type: "integers", required: false },
          { name: "discreteness_source", type: "stated / logically_necessary / assumed", required: false },
        ],
        output:
          "One of four outcomes, and only one of them is evidence: solutions found, no solution proven (from the analytic constraint), GRIM failure, or search exhausted. An exhausted search is a failed search, never an anomaly — conflating the two is how a reconstruction tool becomes an accusation generator. Recovered distributions with implausible shapes are returned for a human to judge.",
        evidence: "exact",
        ceiling: "impossible",
        reach: "both",
        references: [REF.sprite],
      },
    ],
  },
  {
    slug: "recomputation",
    title: "Test-statistic recomputation",
    shortTitle: "Recomputation",
    blurb:
      "A test statistic, its degrees of freedom and its p-value are redundant with one another and with the group summaries they came from. Any one can be recomputed from the others, and the recomputed value has to agree with what was printed. These tools do that arithmetic — always against the interval the printed rounding allows, never against a point value, because matching a rounded input to an exact expectation is how a recomputation tool starts accusing honest papers.",
    tools: [
      {
        slug: "statcheck",
        name: "statcheck",
        registryName: "statcheck",
        cli: "metascience statcheck",
        monogram: "Statcheck",
        does:
          "Extracts APA-style results and recomputes their p-values for internal consistency.",
        whenToApply:
          "Any paper reporting results in APA format — a free, broad first pass over the whole text.",
        howItWorks:
          "Extracts APA-formatted test statistics from the prose and recomputes each p-value from its statistic and degrees of freedom, flagging inconsistencies and, separately, decision errors where the recomputed p falls on the other side of the significance threshold.",
        inputs: [
          { name: "text", type: "the paper's text", required: true, note: "A PDF path is accepted as a fallback route." },
        ],
        output:
          "Every extracted result with its reported and recomputed p, marked consistent, inconsistent or a decision error. Each p is recomputed assuming a two-tailed unadjusted test, and only APA grammar is visible to it — everything else is invisible, so a clean run is not a clean paper. Reporting inconsistencies are near-universal in honest work and must never support a misconduct verdict alone.",
        evidence: "probabilistic",
        ceiling: "highly suspicious",
        reach: "both",
        references: [REF.statcheck],
      },
      {
        slug: "recalc-independent-t",
        name: "Independent-samples t-test",
        registryName: "recalc_independent_t",
        cli: "metascience ttest",
        monogram: "t",
        does:
          "Recomputes an independent-samples t-test, under both Welch and Student readings.",
        whenToApply:
          "Two groups' means, SDs and sizes reported alongside a t or a p.",
        howItWorks:
          "Recomputes t and p from the six group statistics and compares them against the interval the printed precision allows. Both Welch's and Student's pooled readings are accepted, and both tail conventions, unless the paper states which it ran.",
        inputs: [
          { name: "mean1, sd1, n1", type: "numbers and an integer", required: true },
          { name: "mean2, sd2, n2", type: "numbers and an integer", required: true },
          { name: "reported_t / reported_p", type: "numbers", required: false },
          { name: "use_welch", type: "true / false", required: false, note: "Omit when the paper does not say; both standard tests are then accepted." },
          { name: "p_tail", type: "one / two / unknown", required: false },
          { name: "decimals_mean / decimals_sd / decimals_p", type: "integers", required: false },
        ],
        output:
          "The recomputed t and p with the achievable interval, and a verdict on the reported values. Convicting a pooled t against a Welch recomputation is a false accusation, which is why neither reading is assumed.",
        evidence: "probabilistic",
        ceiling: "highly suspicious",
        reach: "both",
      },
      {
        slug: "recalc-within-subjects-t",
        name: "Within-subjects t-test",
        registryName: "recalc_within_subjects_t",
        monogram: "t↔",
        does:
          "Recovers the hidden pre/post correlation a paired t-test report implies.",
        whenToApply:
          "A paired (pre/post) design reporting both timepoints' means and SDs plus a t or p, where the correlation between them is not stated.",
        howItWorks:
          "A paired t implies a specific pre/post correlation, which can be recovered algebraically from the summary statistics. A recovered correlation outside [−1, 1] describes data that cannot exist. Because a thresholded p only lower-bounds t, the recovered r is then a lower bound too.",
        inputs: [
          { name: "mean_pre, sd_pre, mean_post, sd_post", type: "numbers", required: true },
          { name: "n", type: "integer", required: true },
          { name: "reported_p", type: "text, e.g. “0.03” or “<.05”", required: true, note: "Passed as text so a threshold keeps its “<”. Stripping it once turned an indeterminate interval into a headline finding against a real paper." },
          { name: "p_is_threshold", type: "true / false", required: false },
          { name: "p_tail", type: "one / two", required: false },
        ],
        output:
          "The recovered correlation and the whole interval attainable across the inputs' rounding box. Flagged only when that entire interval lies outside [−1, 1]; an exact-p impossibility caps at highly suspicious, because a reporting convention rather than fabrication is the usual cause.",
        evidence: "probabilistic",
        ceiling: "highly suspicious",
        reach: "both",
        references: [REF.heathers],
      },
      {
        slug: "recalc-anova",
        name: "One-way ANOVA",
        registryName: "recalc_anova",
        cli: "metascience anova",
        monogram: "F",
        does:
          "Recomputes a one-way ANOVA F and p from group summaries and compares them to the report.",
        whenToApply:
          "A one-way ANOVA reported with its group means, SDs and sizes.",
        howItWorks:
          "Rebuilds the between- and within-group mean squares from the group summaries, recomputes F and p, and compares them against the interval the printed rounding allows — rounding propagates multiplicatively into F, so a point comparison would be wrong.",
        inputs: [
          { name: "means / sds / ns", type: "lists of numbers", required: true },
          { name: "reported_f / reported_p", type: "numbers", required: false },
          { name: "decimals_mean / decimals_sd / decimals_p", type: "integers", required: false },
        ],
        output:
          "Recomputed F and p with their achievable intervals. Assumes a classical fixed-effects one-way ANOVA rather than Welch's, with homogeneous variances and independent observations — all of which are stated in the result.",
        evidence: "probabilistic",
        ceiling: "highly suspicious",
        reach: "both",
      },
      {
        slug: "recalc-chi-squared",
        name: "Chi-squared",
        registryName: "recalc_chi_squared",
        cli: "metascience chi2",
        monogram: "χ²",
        does:
          "Recomputes chi-squared under both 2x2 conventions, plus Fisher's exact p.",
        whenToApply:
          "A contingency table whose counts are printed alongside a χ² or a p.",
        howItWorks:
          "Recomputes χ² from the observed counts under both the Pearson and Yates conventions, and also computes Fisher's exact p for 2×2 tables. All three are tried before anything is flagged.",
        inputs: [
          { name: "observed", type: "table of counts (rows × columns)", required: true },
          { name: "reported_chi2 / reported_p", type: "numbers", required: false },
          { name: "use_yates", type: "true / false", required: false },
        ],
        output:
          "Each convention's statistic and p against the reported values. The likelihood-ratio (G-test) convention is deliberately not tried and the result says so — a paper reporting G can mismatch entirely innocently.",
        evidence: "probabilistic",
        ceiling: "highly suspicious",
        reach: "both",
      },
      {
        slug: "recalc-f-to-p",
        name: "F → p",
        registryName: "recalc_f_to_p",
        cli: "metascience f-to-p",
        monogram: "F→p",
        does:
          "Verifies a reported p against the range its rounded F and df imply.",
        whenToApply:
          "Any reported F with both degrees of freedom and a p — usable on ANOVAs of any shape, not just one-way.",
        howItWorks:
          "The printed F is rounded, so it asserts a range of p rather than a value. This computes that range from the F's printed precision and its degrees of freedom, and checks the reported p against it.",
        inputs: [
          { name: "f_value", type: "number", required: true },
          { name: "df1 / df2", type: "integers", required: true },
          { name: "reported_p", type: "number", required: false },
          { name: "decimals_f / decimals_p", type: "integers", required: false },
        ],
        output:
          "The implied p-range and a verdict. Directional: only a p below the achievable range is flagged, since an under-claimed p is conservative reporting rather than an error.",
        evidence: "probabilistic",
        ceiling: "highly suspicious",
        reach: "both",
      },
      {
        slug: "recalc-stat-to-p",
        name: "Any statistic → its p-value",
        registryName: "recalc_stat_to_p",
        cli: "metascience stat-to-p",
        monogram: "→p",
        does:
          "Recomputes a p-value from one printed test statistic and compares it to the reported p.",
        whenToApply:
          "A single printed t, χ², z, r or F with a p beside it — the general-purpose version of the checks above.",
        howItWorks:
          "Recomputes the p from the named distribution and degrees of freedom. Because the statistic is rounded it implies a p-interval, and the reported p is judged against that interval rather than a point.",
        inputs: [
          { name: "statistic", type: "number", required: true },
          { name: "kind", type: "t / chi2 / z / r / F", required: true },
          { name: "df / df2 / n", type: "integers", required: false, note: "Whichever the named test needs; a missing one is named in the refusal." },
          { name: "reported_p", type: "number", required: false },
          { name: "tails", type: "1 or 2", required: false, note: "Ignored for χ² and F." },
        ],
        output:
          "The implied p-interval and a directional verdict — only an over-claim is flagged. Capped at suspicious, tighter than its class allows: a one-tailed test, a different df convention or an unshown correction would each explain a disagreement. A missing df or n is reported as an incompletely reported test, which is a property of the paper.",
        evidence: "probabilistic",
        ceiling: "suspicious",
        reach: "both",
      },
      {
        slug: "check-regression",
        name: "Regression coefficient",
        registryName: "check_regression",
        monogram: "B/SE",
        does:
          "Checks a regression coefficient's t = B/SE and its p within printed rounding.",
        whenToApply:
          "A regression table printing a coefficient, its standard error, and a t or p.",
        howItWorks:
          "Checks that the reported t equals B divided by SE, judged against the interval reachable from the printed precision of B and SE, and that the p is that t's tail probability at the given degrees of freedom. Both sign conventions (signed t and |t|) and both tail conventions are accepted first.",
        inputs: [
          { name: "b", type: "number", required: true },
          { name: "se", type: "number", required: true },
          { name: "reported_t / reported_p", type: "numbers", required: false },
          { name: "df", type: "integer", required: false, note: "Without it only the p check is skipped; t = B/SE still runs." },
          { name: "p_is_threshold", type: "true / false", required: false, note: "True when the paper printed a bound such as “P < .001” — a float cannot carry that difference." },
        ],
        output:
          "The implied t, its achievable interval, and verdicts on the reported t and p separately.",
        evidence: "probabilistic",
        ceiling: "highly suspicious",
        reach: "sweep",
      },
      {
        slug: "check-regression-batch",
        name: "Regression table (whole)",
        registryName: "check_regression_batch",
        cli: "metascience regression-batch",
        monogram: "B/SE+",
        does:
          "Runs the t = B/SE coefficient check over every row of a regression table in one call.",
        whenToApply:
          "Every coefficient in a regression table, in one call.",
        howItWorks:
          "Runs the coefficient check per row. Where the degrees of freedom were not reported it re-runs at df of 10, 30, 100 and 100,000; a verdict that changes across that range is returned as indeterminate rather than resolved by a guess.",
        inputs: [
          { name: "rows", type: "table of rows (b, se, reported t/p, df, printed decimals, label)", required: true },
        ],
        output:
          "Per-row results plus an aggregate set by the worst row. A batch in which no row could be evaluated is indeterminate, never consistent — and the denominator is always reported alongside the hits.",
        evidence: "probabilistic",
        ceiling: "highly suspicious",
        reach: "sweep",
      },
      {
        slug: "stalt",
        name: "STALT — hidden p-values",
        registryName: "stalt_check",
        cli: "metascience stalt",
        monogram: "p<",
        does:
          "Checks a recomputed p against the threshold the paper printed for it.",
        whenToApply:
          "A paper reporting only “p < 0.05” where the group statistics permit an exact recalculation.",
        howItWorks:
          "Compares the recomputed exact p against the threshold the paper printed. The threshold is read as an upper-bound claim, so any p at or below it is consistent; what the check surfaces is a p many orders of magnitude below the stated bound — information the paper had and did not report.",
        inputs: [
          { name: "calculated_p", type: "number", required: true, note: "Must come from the same test the printed threshold describes." },
          { name: "reported_threshold", type: "text, e.g. “<0.05”", required: false },
        ],
        output:
          "The size of the overshoot and a severity that scales with it. A factor-of-two overshoot is tolerated as a one- versus two-tailed artefact rather than flagged.",
        evidence: "probabilistic",
        ceiling: "highly suspicious",
        reach: "both",
        references: [REF.heathers],
      },
    ],
  },
  {
    slug: "table-arithmetic",
    title: "Table arithmetic & internal consistency",
    shortTitle: "Table arithmetic",
    blurb:
      "Papers state the same quantity more than once, in different forms, and the forms have to agree. A count and its percentage share a denominator; subgroups sum to their total; an estimate sits at the centre of its own confidence interval; a standard deviation cannot exceed what the variable's range permits. None of this needs raw data — only that the numbers printed in one table be consistent with the numbers printed beside them.",
    tools: [
      {
        slug: "check-table",
        name: "Whole-table check",
        registryName: "check_table",
        cli: "metascience check-table",
        monogram: "ALL",
        does:
          "Runs every applicable check on a typed table in one call; the worst row wins.",
        whenToApply:
          "Any table — this is the entry point, and it replaces calling the per-cell tools one at a time.",
        howItWorks:
          "A router. Given typed cells, the variables you declared and a binding from row labels to variables, it determines which checks apply from cell kind crossed with variable family and runs all of them. Which checks apply is derived, not chosen. Declaring a variable also resolves cells that syntax alone must refuse: “48.90 (14.46)” under a bare label is ambiguous until the variable is declared continuous.",
        inputs: [
          { name: "cells", type: "typed table cells", required: true },
          { name: "variables", type: "list of variable declarations", required: false, note: "Declare from the paper, never from a guess — a fabricated bound inverts a check rather than weakening it." },
          { name: "bindings", type: "map of row label → variable", required: false },
          { name: "provenance", type: "printed_table / measured_raster / ocr_table / …", required: false, note: "Figure-read and OCR'd values make the exact-arithmetic checks refuse automatically." },
        ],
        output:
          "Every non-consistent row in full, a count of the consistent ones, and a machine-generated list giving the reason each check was refused — so coverage does not depend on anyone remembering. It also returns a declaration template naming exactly which variables are blocking checks it could otherwise run. The impossible ceiling is the router's, not every row's: read each row's own tool to know what its verdict rests on.",
        evidence: "exact",
        ceiling: "impossible",
        reach: "sweep",
      },
      {
        slug: "check-count-percent",
        name: "Count against percentage",
        registryName: "check_count_percent",
        cli: "metascience check-count-percent",
        monogram: "n/%",
        does:
          "Checks the printed count over the printed denominator against the printed percentage.",
        whenToApply:
          "Any “n (%)” cell — which is most of Table 1 in a clinical paper. Use it whenever the count is printed; it is strictly stronger than GRIM on a percentage.",
        howItWorks:
          "Divides the printed count by the printed denominator and checks the result against the printed percentage, at the rounding interval the percentage's own precision asserts.",
        inputs: [
          { name: "count", type: "integer", required: true },
          { name: "percentage", type: "number", required: true },
          { name: "n", type: "integer", required: true },
          { name: "decimals", type: "integer", required: false, note: "Without it the check returns indeterminate rather than assuming a precision." },
        ],
        output:
          "A verdict plus the implied denominator — and across a table the implied denominators are the real evidence, because a quantity that can only have one value should not imply several. Capped at suspicious, tighter than its class allows: row, column and subgroup bases legitimately coexist in one table, and no arithmetic disagreement rules that out. A count exceeding its denominator is reported as a wrong pairing on our side, not a defect in the paper.",
        evidence: "probabilistic",
        ceiling: "suspicious",
        reach: "both",
      },
      {
        slug: "check-ratio",
        name: "Ratio check",
        registryName: "check_ratio",
        cli: "metascience check-ratio",
        monogram: "÷",
        does:
          "Checks that a printed ratio follows from the numerator and denominator printed with it.",
        whenToApply:
          "A printed ratio shown with its own numerator and denominator — cost-effectiveness ratios, rates, “X per Y”.",
        howItWorks:
          "Computes the quotient at the corners of the rounding box implied by all three printed precisions, and asks whether the printed ratio falls inside it.",
        inputs: [
          { name: "numerator", type: "number", required: true },
          { name: "denominator", type: "number", required: true },
          { name: "reported_ratio", type: "number", required: true },
          { name: "decimals_numerator / decimals_denominator / decimals_ratio", type: "integers", required: false, note: "All three are needed; without them the check refuses, because a guessed precision either clears every ratio or accuses on rounding alone." },
        ],
        output:
          "A verdict plus the implied numerator and denominator. Capped at suspicious despite testing exact arithmetic: papers routinely divide unrounded intermediates they never show, or a discounted or subgroup quantity. Across a table, several rows implying different values for a quantity that can only have one is the finding — not any single row. A denominator whose rounding interval spans zero makes the quotient unbounded, and the check refuses rather than compares.",
        evidence: "exact",
        ceiling: "suspicious",
        reach: "both",
      },
      {
        slug: "check-summation",
        name: "Summation check",
        registryName: "check_summation",
        cli: "metascience summation",
        monogram: "Σ",
        does:
          "Checks that printed values sum to their stated total within accumulated rounding.",
        whenToApply:
          "Values that should add to a stated total — subgroup counts to N, percentages to 100, cost components to a total cost.",
        howItWorks:
          "Sums the addends and compares against the stated total within a window derived from the printed decimals of every addend and of the total, so rounding is accounted for rather than assumed away.",
        inputs: [
          { name: "values", type: "list of numbers", required: true },
          { name: "expected_sum", type: "number", required: true },
          { name: "decimals", type: "list of integers", required: false, note: "Printed decimals per addend. With neither this nor an explicit tolerance the check refuses rather than guessing." },
          { name: "tolerance", type: "number", required: false, note: "Count columns that must hold exactly take 0; percentage columns legitimately misbalance by rounding." },
        ],
        output:
          "The computed sum, the permitted window and the discrepancy. The values are assumed to be exhaustive, non-overlapping addends — an omitted row or an overlapping category mimics a mismatch, and the result says so.",
        evidence: "probabilistic",
        ceiling: "highly suspicious",
        reach: "sweep",
      },
      {
        slug: "check-summation-batch",
        name: "Summation (whole table)",
        registryName: "check_summation_batch",
        cli: "metascience summation-batch",
        monogram: "Σ+",
        does:
          "Runs every summation check in one call; the worst row sets the verdict.",
        whenToApply:
          "Every summation in a table, in one call.",
        howItWorks:
          "Runs the same check per row, with per-row printed decimals, and sets the aggregate verdict from the worst row.",
        inputs: [
          { name: "rows", type: "table of rows (values, expected total, printed decimals)", required: true },
          { name: "tolerance", type: "number", required: false, note: "A batch-wide override." },
        ],
        output:
          "Per-row results and an aggregate. A row with no printed precision is refused rather than guessed, and a batch in which nothing could be evaluated is indeterminate, never consistent.",
        evidence: "probabilistic",
        ceiling: "highly suspicious",
        reach: "sweep",
      },
      {
        slug: "check-statistic-bounds",
        name: "Value against its logical range",
        registryName: "check_statistic_bounds",
        cli: "metascience check-bounds",
        monogram: "⟦⟧",
        does:
          "Checks a value against the range its measure permits BY DEFINITION -- and treats a violation as evidence about our extraction before evidence about the paper.",
        whenToApply:
          "A value that appears to fall outside what its measure permits by definition — a correlation above 1, a p-value above 1, a percentage above 100.",
        howItWorks:
          "Only bounds that follow from a measure's definition are known to it — a correlation is bounded by Cauchy–Schwarz, a p-value by the definition of a probability. A merely expected range is an assumption, so unknown measures are refused rather than judged against our expectations. Crucially, it treats a violation as evidence about our extraction before evidence about the paper.",
        inputs: [
          { name: "value", type: "number", required: true },
          { name: "measure", type: "correlation / p_value / percentage / …", required: true, note: "Anything without a definitional bound is refused, not guessed at." },
          { name: "extraction_verified", type: "true / false", required: false, note: "Set only after re-reading the value in the paper and confirming both the digits and the column. This is what lifts the refusal to impossible." },
        ],
        output:
          "By default, indeterminate with the failure mode “extraction suspect”, naming the decimal-point slip or wrong-column read that would explain it — because gross violations are uncommon even in fraudulent papers, since fabricators produce plausible numbers. Verification is the price of the accusation. Even when verified, the tool names the innocent readings, because a confirmed impossible value still does not establish who produced it.",
        evidence: "exact",
        ceiling: "impossible",
        reach: "both",
      },
      {
        slug: "check-sd-range",
        name: "SD range check",
        registryName: "check_sd_range",
        cli: "metascience sd-range",
        monogram: "SD≤",
        does:
          "Checks a reported SD against the hard ceiling implied by the variable's range.",
        whenToApply:
          "A standard deviation for a variable whose attainable range is known.",
        howItWorks:
          "The largest SD a bounded sample can have is fixed by its range — (range/2)·√(n/(n−1)) for the sample SD. A reported SD above that ceiling describes data that cannot exist. With n unknown the ceiling is taken at its weakest over all n; supplying n tightens it.",
        inputs: [
          { name: "sd", type: "number", required: true },
          { name: "min_val / max_val", type: "numbers", required: true, note: "Must be the variable's true attainable bounds." },
          { name: "n", type: "integer", required: false },
          { name: "bound_source", type: "stated / logically_necessary / assumed", required: false, note: "Load-bearing: only a range the paper states, or one that is logically necessary, licenses impossible. An assumed range caps at highly suspicious." },
        ],
        output:
          "The ceiling, the reported SD and the verdict. A negative SD is bound-free and impossible whatever else is unknown.",
        evidence: "exact",
        ceiling: "impossible",
        reach: "sweep",
      },
      {
        slug: "check-sd-or-se",
        name: "SD-or-SE adjudication",
        registryName: "check_sd_or_se",
        cli: "metascience sd-or-se",
        monogram: "SD?SE",
        does:
          "Adjudicates whether a reported dispersion value is an SD or a mislabelled SE.",
        whenToApply:
          "A dispersion value where it is unclear whether the paper reported a standard deviation or a standard error.",
        howItWorks:
          "SD and SE are linked by SE = SD/√n, so both readings can be tested against a plausibility ceiling implied by the variable's range and the reading that fits adjudicated. Under the SE reading the rounding interval stretches by √n, which is accounted for.",
        inputs: [
          { name: "reported_value", type: "number", required: true },
          { name: "n", type: "integer", required: true, note: "Must be the cell's true denominator." },
          { name: "reported_as", type: "sd / se / unknown", required: false },
          { name: "variable_range_min / variable_range_max", type: "numbers", required: false },
          { name: "bound_source", type: "stated / logically_necessary / assumed", required: false },
        ],
        output:
          "Which reading the value must be, or that neither fits. A “neither fits” verdict rests entirely on the plausibility ceiling, so on an assumed bound it caps at suspicious. The result carries the base rate: mislabelling SE as SD is the norm rather than an outlier — Olsen found 35 of 88 studies in one journal doing it — and it is usually a statistical error, not a sign of misconduct.",
        evidence: "probabilistic",
        ceiling: "highly suspicious",
        reach: "sweep",
        references: [REF.olsen],
      },
      {
        slug: "check-estimate-ci",
        name: "Estimate against its own interval",
        registryName: "check_estimate_ci",
        cli: "metascience check-ci",
        monogram: "CI",
        does:
          "Reconciles a point estimate with its own CI and reported p on the correct scale.",
        whenToApply:
          "A point estimate printed with a confidence interval, and often a p-value too — odds ratios, hazard ratios, mean differences.",
        howItWorks:
          "Checks ordering, containment and the midpoint on the correct scale — linear for a difference, logarithmic for a ratio measure — and recovers the p implied by the interval to compare against the reported one. Alternative confidence levels are tried before any “wrong p” is reported.",
        inputs: [
          { name: "estimate", type: "number", required: true },
          { name: "ci_low / ci_high", type: "numbers", required: true },
          { name: "measure", type: "OR / RR / HR / IRR / difference", required: false, note: "Decides whether symmetry is checked on the linear or the log scale." },
          { name: "reported_p", type: "number", required: false },
          { name: "reported_p_operator", type: "=, <, ≤, >, ≥", required: false, note: "Pass “<” for “P < .001” — a threshold is an interval claim, not a value." },
        ],
        output:
          "Each sub-check separately with its verdict. Exact, profile and bootstrap intervals are legitimately asymmetric and can fail the midpoint check innocently, which the result states. A p that cannot be placed against alpha at its own printed precision is left unclassified rather than judged.",
        evidence: "probabilistic",
        ceiling: "highly suspicious",
        reach: "both",
      },
      {
        slug: "check-proportion-from-normal",
        name: "Continuous → categorical plausibility",
        registryName: "check_proportion_from_normal",
        cli: "metascience prop-from-normal",
        monogram: "%|μσ",
        does:
          "Tests a categorical proportion against the reported continuous mean and SD.",
        whenToApply:
          "A paper reporting both a continuous variable's mean and SD and the proportion of participants above or below some threshold on it.",
        howItWorks:
          "Given the mean, SD and n, the share of the sample past a threshold is constrained. The headline test assumes the raw variable is normal and uses a binomial test on the count at the threshold; a second, distribution-free test uses Cantelli's inequality, which holds for every distribution.",
        inputs: [
          { name: "reported_proportion", type: "number", required: true },
          { name: "mean / sd", type: "numbers", required: true },
          { name: "n", type: "integer", required: true },
          { name: "threshold", type: "number", required: true },
          { name: "direction", type: "above / below", required: false },
        ],
        output:
          "Both tests separately. The normal-assumption result caps at suspicious, because skew explains a mismatch innocently; only a violation of the distribution-free Cantelli bound reaches highly suspicious. The proportion and the mean/SD/n must describe the same sample.",
        evidence: "probabilistic",
        ceiling: "highly suspicious",
        reach: "editorial",
      },
    ],
  },
  {
    slug: "similarity",
    title: "Similarity & duplication",
    shortTitle: "Similarity",
    blurb:
      "Real data is noisy in ways people reliably fail to imitate, and it is never noisy twice in the same way. Randomised groups differ at baseline by chance; sample standard deviations scatter by a knowable amount; two independent samples do not produce the same mean and SD. Fabricators add noise to the means, because everyone knows means vary, and forget that the dispersion measures need their own — and when a table or a spreadsheet is filled by copying, the duplicate values survive in the published numbers. The first three tools here test for data that is too tidy; the last two are copy-paste detectors, working on printed summary statistics and on participant-level raw data respectively. None of them can ever return “impossible”: no arrangement of numbers is forbidden by arithmetic, only improbable.",
    tools: [
      {
        slug: "csf",
        name: "Carlisle–Stouffer–Fisher test",
        registryName: "csf_test",
        cli: "metascience csf",
        monogram: "CSF",
        does:
          "Combines baseline p-values to detect arms more similar than randomisation allows.",
        whenToApply:
          "A randomised trial's Table 1, where baseline characteristics are compared between arms.",
        howItWorks:
          "Under simple randomisation, baseline p-values are uniform and independent. Combining them by Stouffer's or Fisher's method gives a one-sided test for EXCESS similarity. A very small result means the arms are more alike than randomisation can plausibly produce — the signature of a trial whose allocation never happened.",
        inputs: [
          { name: "p_values", type: "list of numbers", required: true, note: "At least three usable values are needed." },
          { name: "design", type: "simple / cluster / stratified / crossover / …", required: false, note: "Cluster, multi-site, stepped-wedge, crossover, matched, stratified and minimised designs force baseline balance by construction and are refused outright. An unstated design caps the verdict." },
          { name: "correlation", type: "number", required: false, note: "Baseline rows are correlated; with none supplied an equicorrelated null is read at a conservative ρ = 0.5." },
        ],
        output:
          "A one-sided similarity p-value with a sensitivity profile across correlation assumptions. High baseline p-values are the red flag here, never reassurance — a Table 1 where every p is 0.93, 0.99, 0.99 is the thing this test exists to catch.",
        evidence: "probabilistic",
        ceiling: "highly suspicious",
        reach: "both",
        references: [REF.carlisle2017, REF.carlisle2021],
      },
      {
        slug: "table1-dispersion",
        name: "Bayesian Table-1 dispersion",
        registryName: "bayesian_table1_dispersion",
        cli: "metascience table1-dispersion",
        monogram: "Table 1 dispersion",
        does:
          "Estimates Table 1 baseline dispersion (tau) to flag under- or over-dispersion versus chance.",
        whenToApply:
          "The same Table 1 as the CSF test — complementary to it, not preferred over it, and handling mixed continuous and categorical rows.",
        howItWorks:
          "Turns each baseline row into a p-value and then a z-score, and estimates a precision multiplier τ̂ = √(1/mean(z²)). Above 1 indicates under-dispersion — differences systematically smaller than chance allows; below 1, over-dispersion and possible randomisation failure. Rows are treated as equicorrelated, discounting a table of any size to about two effective degrees of freedom, so a large table is not thereby more accusable.",
        inputs: [
          { name: "rows", type: "list of baseline rows — means/SDs/ns, or categorical counts", required: true },
          { name: "design", type: "string", required: false, note: "Same refusals as the CSF test; an unstated design caps the verdict below highly suspicious." },
          { name: "correlation", type: "number", required: false, note: "Pass only if genuinely known or estimable." },
        ],
        output:
          "τ̂ with a confidence interval that inverts the exact chi-square null, plus a sensitivity profile. An elevated τ̂ whose interval does not exclude 1 is reported indeterminate, never consistent — too few effective degrees of freedom to convict OR to clear. Escalation additionally requires the CSF test on the same p-values to corroborate; CSF finding nothing vetoes it.",
        evidence: "probabilistic",
        ceiling: "highly suspicious",
        reach: "both",
        references: [REF.bolland],
      },
      {
        slug: "variance-dispersion",
        name: "Variance dispersion",
        registryName: "check_variance_dispersion",
        cli: "metascience variance-dispersion",
        monogram: "σ≈σ",
        does:
          "Tests whether reported SDs across groups are more similar to one another than sampling error allows.",
        whenToApply:
          "Three or more groups whose standard deviations are reported — are the SDs too similar to one another?",
        howItWorks:
          "Sample variances are themselves random: run the same experiment on several groups and the SDs scatter by a knowable amount. Standardising by the within-group mean square leaves only relative spread, whose null is bootstrapped from the chi-square distribution. Dispersion is measured as the range of the z-scores rather than their SD, which the source study found more robust to heterogeneity.",
        inputs: [
          { name: "sds / ns", type: "lists of numbers", required: true, note: "At least three groups." },
          { name: "sd_texts", type: "list of the SDs as printed", required: true, note: "Precision is read from the literal; rounding coarser than a quarter of the SD is refused, because coarse rounding drives honest SDs onto identical values." },
          { name: "homogeneous_variances", type: "true / false", required: false, note: "Required — a violated assumption blinds the test rather than making it accusatory, so it gates the consistent verdict too." },
          { name: "design", type: "string", required: false, note: "Designs that constrain variances by construction are refused." },
        ],
        output:
          "The observed dispersion against its bootstrapped null, capped at suspicious — over-similar SDs are improbable, never impossible. Every result sets a reference-required flag: the validating study's near-perfect discrimination came from comparing genuine against fabricated sets, while both looked significant against the theoretical null in absolute terms. This is a relative verdict, and the result says so.",
        evidence: "probabilistic",
        ceiling: "suspicious",
        reach: "both",
        references: [REF.hartgerink, REF.simonsohn],
      },
      {
        slug: "duplication",
        name: "Summary-statistic copy-paste",
        registryName: "detect_duplication",
        cli: "metascience duplication-detect",
        monogram: "Copy-paste",
        does:
          "Finds copy-pasted summary statistics: identical (mean, SD) pairs recurring where they should not.",
        whenToApply:
          "Across a paper's tables and studies, wherever summary statistics are supposed to describe independent samples — and within a single table, where a filled-down row or column leaves the same values behind.",
        howItWorks:
          "Hashes every (mean, SD) cell at its PRINTED precision and looks for three signatures. Across blocks the paper calls independent samples, it counts identical pairs and prices them against a Poisson chance model whose value spans are inferred from the data itself rather than assumed. Within a single table, it looks for a whole row or column of cells repeated under a different label — the fill-down signature. And it reports pairs identical after a single digit transposition, as a weak pointer only.",
        inputs: [
          { name: "blocks", type: "labelled blocks of cells, each with a sample identity", required: true, note: "Blocks are assumed independent unless they share a sample id — Tables 1, 2 and 3 of a cohort paper are usually subsets of each other." },
          { name: "decimals_mean / decimals_sd", type: "integers", required: false, note: "The printed precision cells are hashed at. Cells may override per-cell." },
          { name: "near_match", type: "true / false", required: false, note: "Also report pairs identical after a digit transposition. Always indeterminate — a pointer, never a finding." },
        ],
        output:
          "Each duplicate group with its kind, the matched values, and a multiplicity-corrected chance probability. Severity keys on the number of identical pairs — three escalates — and several guards pull it back down. Blocks sharing a sample id, or declared non-independent, drop two tiers. Round values (integers, halves, multiples of 0.05) collide far more often and drop one. A lone match is re-checked against its own chance probability and demoted if a coincidence was likely. Within a table, integer count cells with no SD never count toward severity at all: blocked allocation and zero attrition make arm sizes identical BY DESIGN. Capped at highly suspicious — duplication is improbable, never impossible.",
        evidence: "probabilistic",
        ceiling: "highly suspicious",
        reach: "both",
        references: [REF.heathers],
      },
      {
        slug: "raw-duplication",
        name: "Raw-data copy-paste",
        registryName: "detect_raw_duplication",
        cli: "metascience raw-duplication-detect",
        monogram: "Raw copy-paste",
        does:
          "Finds copy-pasted rows, runs and values inside a participant-level data file.",
        whenToApply:
          "A participant-level supplement — a spreadsheet of rows, one per subject. The strongest evidence available, when the data exists.",
        howItWorks:
          "Takes a file path and loads the grid itself — a raw sheet is thousands of values and no model can retype it — then looks for three signatures: duplicated participant rows within and across sheets, vertical runs of values reappearing in order, and improbably specific recurring numbers. Matching is exact after float canonicalisation; there is no tolerance anywhere, because a tolerance manufactures matches between genuinely different measurements. Evidence is weighted by the INFORMATION CONTENT of each number rather than by match count: 123.46 recurring means something, 100 recurring means nothing, and a value shared by twenty rows is a site-level covariate rather than twenty copy-pastes.",
        inputs: [
          { name: "path", type: "spreadsheet file (.xlsx, .csv, .tsv, .docx)", required: true },
          { name: "sheet", type: "worksheet name", required: false },
          { name: "exclude_columns", type: "list of column names", required: false, note: "Columns shared by design — IDs, site codes, coordinates, plot-level covariates — must be excluded by the caller or they duplicate legitimately." },
          { name: "data_context", type: "raw_participant_level / pooled_or_meta_analysis / unknown", required: false, note: "A pooled or meta-analytic file duplicates rows by construction; findings are then capped at indeterminate. That is a refusal, not a finding." },
        ],
        output:
          "Each signature with its own chance model — a Poisson null over same-precision bins for repeated values, an empirical collision null for matching runs — so a large sheet is not flagged merely for being large. Row-pair evidence has no chance model and the result says so plainly; it rests on information content alone and is the weaker limb. Capped at highly suspicious.",
        evidence: "probabilistic",
        ceiling: "highly suspicious",
        reach: "both",
        references: [REF.heathers],
      },
    ],
  },
  {
    slug: "design-and-inference",
    title: "Design, power & inference",
    shortTitle: "Design & power",
    blurb:
      "Not every problem in a paper is a wrong number. A stated power analysis can be recomputed against the sample actually recruited; a family of tests has an arithmetic false-positive rate whatever the paper says about it; a “no difference” conclusion can be checked against the effect its own confidence interval still permits. These tools audit the inferences rather than the arithmetic — and several of them are calculators that render no verdict at all.",
    tools: [
      {
        slug: "verify-power-analysis",
        name: "Power-analysis verification",
        registryName: "verify_power_analysis",
        cli: "metascience power-check",
        monogram: "1−β",
        does:
          "Recomputes a stated a-priori power analysis and compares it to the N actually recruited.",
        whenToApply:
          "A paper stating an a-priori power analysis — the effect size, alpha and target power it planned around.",
        howItWorks:
          "Recomputes the required sample size using exact noncentral distributions and compares it against the N actually recruited, with a small tolerance absorbing documented differences between G*Power, pwr and PASS.",
        inputs: [
          { name: "test_type", type: "string", required: true },
          { name: "effect_size / alpha / target_power", type: "numbers", required: false },
          { name: "n_reported", type: "integer", required: false },
          { name: "tails", type: "1 or 2", required: false, note: "As stated by the paper. Left unset, both readings are tried and no accusation is made when the one-tailed reading reconciles." },
          { name: "allocation_ratio", type: "number", required: false, note: "Anything other than 1.0 is refused — the recomputation is 1:1, and grading a k:1 design against it can accuse a correct calculation." },
        ],
        output:
          "The required N against the recruited N. Indeterminate unless every input was stated — which is the modal honest outcome and is itself worth reporting: roughly 80% of published power analyses cannot be checked at all, because the inputs are not there. Over-recruiting is treated as correct practice, never a discrepancy. It cannot detect an analysis that reproduces but powers the wrong hypothesis.",
        evidence: "probabilistic",
        ceiling: "highly suspicious",
        reach: "sweep",
        references: [REF.bakker],
      },
      {
        slug: "required-n",
        name: "Required sample size",
        registryName: "required_n",
        cli: "metascience required-n",
        monogram: "N?",
        does:
          "Computes the sample size a design needs for a target power; a pure calculator.",
        whenToApply:
          "To ask what sample a design would have needed — as context for a study, not as a charge against it.",
        howItWorks:
          "A pure calculator: the smallest n reaching a target power for a named test at a given effect size and alpha, via exact noncentral distributions. Supplying the sample actually used adds a design-sensitivity comparison — the effect the study could have detected.",
        inputs: [
          { name: "test_type", type: "string", required: true },
          { name: "effect_size", type: "number", required: true },
          { name: "alpha / power", type: "numbers", required: false },
          { name: "actual_n", type: "integer", required: false, note: "Adds the design-sensitivity block; without it the answer is a bare sample-size calculation." },
        ],
        output:
          "The required n, and optionally the minimum detectable effect. It renders no verdict about any paper: a small study is a fact about sensitivity, not a defect.",
        evidence: "descriptive",
        ceiling: "indeterminate",
        reach: "both",
      },
      {
        slug: "multiplicity",
        name: "Multiple-comparisons arithmetic",
        registryName: "multiplicity_report",
        cli: "metascience multiplicity",
        monogram: "α×k",
        does:
          "Reports the family-wise error rate and four correction thresholds for a declared family.",
        whenToApply:
          "A paper running many tests and treating each at α = 0.05 — or claiming a correction that can be checked.",
        howItWorks:
          "For a declared family of tests, computes the family-wise error rate and the thresholds four standard corrections would impose: Bonferroni, Holm, Benjamini–Hochberg and Benjamini–Yekutieli. It then counts how many reported claims survive each.",
        inputs: [
          { name: "tests", type: "list of tests (p-value, whether a correction was applied)", required: true },
          { name: "family_label", type: "text", required: true, note: "Describe the family you chose. Family definition is a judgement the tool cannot make, so there is no default — an omitted label is refused, not filled in." },
          { name: "alpha", type: "number", required: false },
        ],
        output:
          "The family-wise error rate, the four thresholds, and floor and ceiling counts of surviving claims. Everything is conditional on the declared family — the same p-values give different answers under different families — and the survivor count is a floor, because undisclosed analytic flexibility means the true comparison count can exceed the reported one. Deterministic arithmetic; it accuses no one.",
        evidence: "descriptive",
        ceiling: "indeterminate",
        reach: "both",
        references: [REF.benjaminiHochberg, REF.benjaminiYekutieli],
      },
      {
        slug: "absence-of-evidence",
        name: "Absence of evidence",
        registryName: "absence_of_evidence",
        cli: "metascience absence-of-evidence",
        monogram: "∅",
        does:
          "Tests whether a stated 'no effect' conclusion survives its own confidence interval.",
        whenToApply:
          "A paper concluding “no effect” or “no difference” from a non-significant result.",
        howItWorks:
          "“Not significant” is not “no effect”. This reports the largest effect the paper's own confidence interval still permits, and judges the CLAIM made about the interval rather than the data. If no interval is printed, one is derived from the coefficient and standard error and marked as derived so it never passes as the paper's.",
        inputs: [
          { name: "ci_low / ci_high", type: "numbers", required: false, note: "Or pass b and se instead and an interval is derived." },
          { name: "measure", type: "OR / RR / HR / IRR / difference", required: false, note: "Required in practice: the null is 1 for a ratio measure and 0 for a difference, and without it the tool declines. Omitting it once inverted a verdict — the interval [0.85, 1.42] was reported as excluding the null." },
          { name: "sesoi", type: "number", required: false, note: "Smallest effect size of interest. Without one, equivalence is described but not judged — that cannot be claimed against an unstated threshold." },
          { name: "df", type: "integer", required: false, note: "Without it the normal distribution is used and the result says so." },
        ],
        output:
          "The interval, the largest effect it still admits, and whether the stated conclusion survives it. Declines rather than guesses when the null cannot be located or no threshold was supplied.",
        evidence: "probabilistic",
        ceiling: "highly suspicious",
        reach: "sweep",
      },
      {
        slug: "effect-size",
        name: "Effect-size plausibility",
        registryName: "check_effect_plausibility",
        cli: "metascience effect-size",
        monogram: "d",
        does:
          "Places an effect size against cited field benchmarks; flags unusual, never impossible.",
        whenToApply:
          "Any two-group comparison — and notably the one check that still works on figure-derived data, so a paper reporting its outcome only as a bar chart becomes checkable here.",
        howItWorks:
          "Computes Cohen's d and Hedges' g with a confidence interval from the six group statistics. Passing the paper's own reported d alongside them checks internal consistency instead: does the printed effect size match the one its own means, SDs and ns imply? That needs no comparison class and is what catches a mistyped effect size.",
        inputs: [
          { name: "mean1, sd1, n1, mean2, sd2, n2", type: "numbers and integers", required: false, note: "Or pass d directly." },
          { name: "reported_d", type: "number", required: false, note: "Triggers the internal-consistency check." },
          { name: "field", type: "string", required: false, note: "Usually omitted. Adds field benchmarks — but only social psychology's percentiles trace to a published table; the rest are uncited estimates and say so." },
          { name: "provenance", type: "printed_text / figure_pixels", required: false },
        ],
        output:
          "The effect size with its interval — reporting the value is the deliverable. Capped at suspicious: an effect can be improbable but never arithmetically impossible, and an unusually large one is informative, not evidence of misconduct. Before treating a large effect as a finding, three ordinary causes are named in the result: SEM read as SD (which inflates d by √n), a waitlist rather than active comparator, and a units mismatch. Field benchmarks are distributions of published effects, themselves inflated by publication bias.",
        evidence: "probabilistic",
        ceiling: "suspicious",
        reach: "both",
        references: [REF.lovakov],
      },
    ],
  },
  {
    slug: "heuristics",
    title: "Hand-calculation signatures & heuristics",
    shortTitle: "Heuristics",
    blurb:
      "Some anomalies are not impossible numbers but improbable patterns: a test statistic that exactly equals the value you would get by hand from the rounded table, sample sizes too round to be real recruitment, or a comparison reported so coarsely that no one can tell what was computed. These are triage signals. They escalate alongside stronger findings and are capped so they cannot convict on their own.",
    tools: [
      {
        slug: "rivets-t",
        name: "RIVETS (t-test)",
        registryName: "rivets_independent_t",
        cli: "metascience rivets-t",
        monogram: "RIVETS t",
        does:
          "Maps the t and p reachable from rounded inputs, and flags hand-calculation signatures.",
        whenToApply:
          "A t-test reported beside the group summaries it supposedly came from — the precision-aware replacement for a plain recomputation.",
        howItWorks:
          "Real data has more precision than the table prints, so a t computed from actual data almost never lands exactly on the value you get from the rounded summaries. RIVETS maps the t and p reachable across the inputs' rounding intervals by Monte Carlo, and measures how often an exact match occurs. A point match plus a rare hit rate is the signature of a statistic computed from the table rather than from data.",
        inputs: [
          { name: "mean1, sd1, n1, mean2, sd2, n2", type: "numbers and integers", required: true },
          { name: "reported_t / reported_p", type: "numbers", required: false },
          { name: "decimals_mean / decimals_sd / decimals_t / decimals_p", type: "integers", required: false, note: "Must be supplied; the defaults assume more precision than most papers report." },
          { name: "p_is_threshold", type: "true / false", required: false, note: "Pass a bound p as text, never as a float, or it reads as an unreachable exact value." },
        ],
        output:
          "The achievable t and p intervals, the exact-match hit rate, and a verdict. Both Welch and Student readings and both tail conventions are accepted unless the paper states them.",
        evidence: "probabilistic",
        ceiling: "highly suspicious",
        reach: "sweep",
        references: [REF.rivets],
      },
      {
        slug: "rivets-anova",
        name: "RIVETS (ANOVA)",
        registryName: "rivets_anova",
        cli: "metascience rivets-anova",
        monogram: "RIVETS F",
        does:
          "Maps the F and p reachable from rounded inputs, and flags hand-calculation signatures.",
        whenToApply:
          "The same detector applied to a reported F. Preferred over the plain ANOVA recomputation, which is precision-blind.",
        howItWorks:
          "Monte Carlo over the truncation interval of every printed input, producing the reachable F and p ranges plus the exact-match hit rates.",
        inputs: [
          { name: "means / sds / ns", type: "lists of numbers", required: true },
          { name: "reported_f / reported_p", type: "numbers", required: false },
          { name: "decimals_mean / decimals_sd / decimals_f / decimals_p", type: "integers", required: false },
          { name: "p_is_threshold", type: "true / false", required: false },
        ],
        output:
          "Reachable ranges, hit rates and a verdict. A reported p outside the achievable range is flagged at the same severity as an out-of-range F. This tool owns the accusation-grade reported-p check for ANOVAs.",
        evidence: "probabilistic",
        ceiling: "highly suspicious",
        reach: "sweep",
        references: [REF.rivets],
      },
      {
        slug: "flag-round-n",
        name: "Round-N flag",
        registryName: "flag_round_n",
        cli: "metascience flag-round-n",
        monogram: "100",
        does:
          "Triage flag for several distinct sample sizes that are all suspiciously round.",
        whenToApply:
          "A study reporting several distinct sample sizes that are all suspiciously round.",
        howItWorks:
          "A base-rate heuristic. Fabricated papers over-represent round Ns — but so do honest recruitment targets, which is why it needs at least three reported sizes with at least two distinct before it says anything at all.",
        inputs: [
          { name: "ns", type: "list of integers", required: true },
          { name: "moderate_modulus / strong_modulus", type: "integers", required: false },
        ],
        output:
          "A triage flag capped at suspicious — a weak signal that escalates only alongside stronger findings, and never a finding on its own.",
        evidence: "probabilistic",
        ceiling: "suspicious",
        reach: "sweep",
      },
      {
        slug: "flag-uninformative",
        name: "Uninformative-statistic flag",
        registryName: "flag_uninformative_stat",
        cli: "metascience flag-uninformative",
        monogram: "≈p",
        does:
          "Flags comparisons whose printed precision cannot pin down the test outcome.",
        whenToApply:
          "A comparison reported so coarsely that the printed precision cannot pin down the test outcome.",
        howItWorks:
          "Models the comparison as a one-way ANOVA over the group summaries and computes the whole p-range the printed precision permits — by Monte Carlo plus an exact corner search, because the extreme of F lives on a vertex that interior sampling reaches with probability zero. It then asks whether that range straddles the significance threshold.",
        inputs: [
          { name: "means / sds / ns", type: "lists of numbers", required: true },
          { name: "reported_p", type: "number", required: false },
          { name: "decimals_mean / decimals_sd / decimals_p", type: "integers", required: false },
          { name: "significance_threshold", type: "number", required: false },
        ],
        output:
          "The analytic p-range, with flags for a range straddling alpha, an implausibly wide range, or a reported p outside it. Capped at suspicious with the one-way-ANOVA assumption disclosed; the RIVETS ANOVA check owns anything accusation-grade.",
        evidence: "probabilistic",
        ceiling: "suspicious",
        reach: "sweep",
      },
    ],
  },
  {
    slug: "image-integrity",
    title: "Image integrity",
    shortTitle: "Image integrity",
    pipelinePath: "/forensic-metascience-agent/tools/image-analysis",
    blurb:
      "One registered tool, but internally a fixed sequence of discrete checks: harvest the panels, screen out the publisher's own furniture, then four detection tiers ordered from strongest evidence to weakest, each handing the next only the pairs it did not already claim. Between them sit the gates that decide what a match is allowed to mean — and those gates are most of the engineering, because the failure mode here is not missing a duplication, it is calling a shared axis label one. The whole module is QUARANTINED: it runs, its statistics are reported, and its verdict is withheld until the calibration criteria pass.",
    tools: [
      {
        slug: "image-duplication",
        name: "Panel duplication (the pipeline)",
        registryName: "analyze_paper_images",
        cli: "metascience image-analysis",
        monogram: "IMG",
        does:
          "Detects the same image panel presented more than once within a paper's embedded figures and supplements.",
        whenToApply:
          "A paper with embedded raster figures — micrographs, blots, gels, photographs — and its supplements.",
        howItWorks:
          "Runs the twelve stages below in a fixed order and merges their output into one result. It is a deterministic subprocess running alongside the statistical sweep, never called by the model: a language model mid-analysis must not be launching a computer-vision pipeline, and its findings reach the editorial stage by injection, already quarantined.",
        inputs: [
          { name: "pdf_path", type: "PDF file", required: true },
          { name: "si_pdfs / paper_dir", type: "supplement paths", required: false, note: "Omitting them is recorded explicitly — a main-PDF-only run that found nothing is not “we checked the supplement and it was clean”." },
          { name: "captions", type: "list of figure captions", required: false },
          { name: "stated_reuse", type: "true / false", required: false, note: "The paper says these panels re-show earlier ones; the result is then capped at indeterminate." },
          { name: "furniture_sha256", type: "set of content hashes", required: false, note: "From the corpus furniture screen. Empty hashes are filtered out — an empty hash is the harvest's “unknown”, not a value, and testing membership naively would withhold the entire pool whenever the image library is absent." },
          { name: "segment_montages", type: "true / false", required: false, note: "Off by default: segmentation triples the corpus fire rate, mostly via sub-panels sharing a plot template." },
        ],
        output:
          "Duplicate groups ordered strongest tier first, each with its match geometry and the reason it survived every gate — plus panel and skip counts per document, and per-document truncation flags. Coverage is embedded rasters only: vector-drawn charts and flattened page scans are invisible, so zero groups on a vector-figure paper is coverage absence, not cleanliness. Within-paper only; nothing is compared against other papers or any external index. QUARANTINED — delivered severity is always indeterminate, with the uncalibrated grade preserved separately.",
        evidence: "probabilistic",
        ceiling: "indeterminate",
        reach: "deterministic-track",
        quarantined: true,
        references: [REF.bik],
      },
      {
        slug: "panel-harvest",
        name: "Panel harvest",
        partOf: "analyze_paper_images",
        step: 1,
        monogram: "Harvest",
        does:
          "Pulls every embedded image panel out of the paper and its supplements.",
        whenToApply: "First, on the paper and every supplement that will be compared.",
        howItWorks:
          "Pulls every embedded image stream out of the PDF, recording for each panel its source document, page, placement rectangle, content hash and a perceptual hash. A pdfplumber fallback covers documents the primary extractor cannot open; it keys panels by stream hash rather than by PDF object number. Supplement containers (.docx and .epub zips, loose image files) are harvested into the same pool.",
        inputs: [
          { name: "pdf_path", type: "PDF file", required: true },
          { name: "max_panels", type: "integer", required: false, note: "A per-document budget. Truncation is announced per document, because a truncated supplement and a truncated main PDF bound different claims." },
        ],
        output:
          "The panel pool, plus counts of what was harvested, skipped and truncated. The supplement scan reads an allowlist of subdirectories rather than walking the tree: the harvest writes its own PNGs into the paper directory, and a general recursion would re-ingest them and manufacture a byte-identical match on every paper in the corpus.",
        evidence: "descriptive",
        ceiling: "indeterminate",
        reach: "deterministic-track",
      },
      {
        slug: "montage-segmentation",
        name: "Montage segmentation",
        partOf: "analyze_paper_images",
        step: 2,
        monogram: "Segment",
        does:
          "Splits a multi-panel composite figure into its sub-panels on the gutters.",
        whenToApply:
          "Opt-in. A six-panel composite figure is a single embedded stream, so duplication between its own sub-panels is invisible unless the composite is split.",
        howItWorks:
          "Finds the gutters — whole rows and columns of near-white pixels — and splits on them, but only when the bands form a REGULAR grid. Regularity, not the mere presence of white lines, is what licenses the split. Columns are measured inside the row bands, because a full-width coloured banner otherwise stops any column reaching the purity threshold. A fallback path exists for montages whose border ring is coloured, which defeats the primary background estimate.",
        inputs: [
          { name: "segment_montages", type: "true / false", required: false, note: "Default off." },
        ],
        output:
          "Sub-panel crops added to the pool, each recorded as a crop of its parent so later stages can tell a crop from an independently embedded image. Measured: turning this on raises the corpus fire rate from 5.0% to 15.1% of papers, mostly through sub-panels that share a plot template rather than content — which is why it is opt-in and why the clique demotion below exists.",
        evidence: "descriptive",
        ceiling: "indeterminate",
        reach: "deterministic-track",
      },
      {
        slug: "corpus-furniture-screen",
        name: "Corpus furniture screen",
        partOf: "analyze_paper_images",
        step: 3,
        monogram: "Furniture",
        does:
          "Excludes image streams that recur across many papers as publisher furniture.",
        whenToApply:
          "Across a whole corpus, before the per-paper tiers run. Necessarily two-pass — the set is only knowable corpus-wide.",
        howItWorks:
          "An image stream that appears in three or more DISTINCT papers is a journal template, society mark or advert, not a result. No within-paper rule can see this: five Bentham papers in the reference corpus each place one full-page advert twice, via two separate PDF objects — which is exactly the shape of a paper reusing an image as two results.",
        inputs: [
          { name: "corpus panel index", type: "panel records across many papers", required: true },
          { name: "minimum papers", type: "integer", required: false, note: "Three. Below that, a repeat is not yet evidence of a template." },
        ],
        output:
          "The excluded hash set plus a report of exactly what was excluded and why, so the exclusion is auditable rather than a quiet absence. Panels carrying an excluded hash are withheld from every tier with a named reason.",
        evidence: "descriptive",
        ceiling: "indeterminate",
        reach: "deterministic-track",
      },
      {
        slug: "tier1-repeated-placement",
        name: "Tier 1 — repeated placement of one stream",
        partOf: "analyze_paper_images",
        step: 4,
        monogram: "T1",
        does:
          "Finds streams the PDF itself places more than once.",
        whenToApply:
          "Always. The strongest tier, because the assertion of sameness is the PDF's own.",
        howItWorks:
          "Finds streams the document itself places more than once. This is not a similarity judgement: the file says these two pictures are one object. Either the PDF object number or the stream hash supplies the identity — requiring the object number made this tier silent on exactly the documents the fallback harvest exists to cover.",
        inputs: [
          { name: "panel pool", type: "harvested panels", required: true },
        ],
        output:
          "Groups of repeated placements. Placements inside captioned figure regions are evidence; reuse living entirely outside figure regions is separated out and capped at indeterminate — page decorations that survived the corpus screen (which needs three or more papers) land there rather than in a finding. Four or more placements of one stream is itself treated as a furniture signature.",
        evidence: "probabilistic",
        ceiling: "indeterminate",
        reach: "deterministic-track",
        quarantined: true,
      },
      {
        slug: "tier2-identical-bytes",
        name: "Tier 2 — identical original bytes",
        partOf: "analyze_paper_images",
        step: 5,
        monogram: "T2",
        does:
          "Finds distinct panels whose original stored bytes are identical.",
        whenToApply:
          "Distinct panels whose stored bytes hash identically — the same picture embedded twice as two separate objects.",
        howItWorks:
          "Compares content hashes of the ORIGINAL embedded bytes. The provenance gate acts here and is the point of the tier: a panel whose pixels we re-rendered ourselves never enters, however its hash falls, and the exclusion is recorded by name. Byte identity is a statement about the authors' files; a re-render is a statement about our renderer.",
        inputs: [
          { name: "panel pool", type: "harvested panels", required: true },
        ],
        output:
          "Groups of byte-identical panels, and a named list of panels excluded for carrying re-rendered rather than original pixels.",
        evidence: "probabilistic",
        ceiling: "indeterminate",
        reach: "deterministic-track",
        quarantined: true,
      },
      {
        slug: "tier3-perceptual-hash",
        name: "Tier 3 — perceptual hash clustering",
        partOf: "analyze_paper_images",
        step: 6,
        monogram: "T3",
        does:
          "Clusters panels that are the same picture after resizing or recompression.",
        whenToApply:
          "Panels that are visually the same picture but not byte-identical — recompressed, resized, or re-exported.",
        howItWorks:
          "Computes a perceptual hash per panel and takes connected components of panels within a Hamming distance of 4. Pairs already sharing a non-empty content hash are skipped, because byte identity owns them. That emptiness test is load-bearing: a montage sub-panel carries an empty content hash by contract, so a naive equality check read every pair of crops as “the same bytes” and skipped the entire tier for them.",
        inputs: [
          { name: "eligible panels", type: "panels passing the texture and glyph gate", required: true },
        ],
        output:
          "Clusters of perceptually near-identical panels. A panel needs only a perceptual hash to enter, not a saved image file — demanding a file made every montage crop inert, excluded from the perceptual tiers and structurally barred from the byte-identity ones, i.e. compared by nothing while the record claimed otherwise.",
        evidence: "probabilistic",
        ceiling: "indeterminate",
        reach: "deterministic-track",
        quarantined: true,
      },
      {
        slug: "tier4-keypoint-geometry",
        name: "Tier 4 — keypoint match and geometric verification",
        partOf: "analyze_paper_images",
        step: 7,
        monogram: "T4",
        does:
          "Finds regions carried between panels under rotation, rescaling or cropping.",
        whenToApply:
          "Pairs the first three tiers did not claim — the tier that catches a region rotated, rescaled, mirrored or cropped out of one panel and into another.",
        howItWorks:
          "Detects up to 2,000 keypoints per panel, matches descriptors under a 0.6 ratio test, then fits a partial-affine transform with RANSAC at a 3-pixel reprojection tolerance. A match must survive on geometry, not on match count alone: at least 30 inliers, an inlier ratio of 0.25, a recovered scale between 0.2× and 5×, shear under 15°, and keypoints spread over at least 15% of the panel rather than piled in one corner.",
        inputs: [
          { name: "candidate pairs", type: "panel pairs with loadable pixels", required: true },
        ],
        output:
          "Verified matches with their recovered geometry — scale, rotation, shear, translation and the inlier bounding box — which the classifier and grain stages then interrogate. A panel whose pixels cannot be loaded loses THIS tier only; its perceptual hash still took part in tier 3, and the record says so rather than implying it was never compared.",
        evidence: "probabilistic",
        ceiling: "indeterminate",
        reach: "deterministic-track",
        quarantined: true,
      },
      {
        slug: "texture-glyph-gate",
        name: "Texture and glyph gate",
        partOf: "analyze_paper_images",
        step: 8,
        monogram: "Texture",
        does:
          "Refuses panels too small or too flat for perceptual matching to mean anything.",
        whenToApply:
          "Before the perceptual tiers, on every panel, deciding which are eligible at all.",
        howItWorks:
          "Two refusals with different reasons. A panel under 128 pixels on its longest side is treated as a rendered letter or glyph — a panel label, not a result. A panel whose grey-level entropy falls below 3.5 bits, or whose top two intensity bins hold more than 90% of its pixels, has too little texture for perceptual matching to mean anything; western blots live here and wait on a separately calibrated channel. Order matters: the glyph trap is judged first, so a rendered letter is named as what it is rather than as a low-texture blot.",
        inputs: [
          { name: "panel", type: "a harvested panel", required: true },
        ],
        output:
          "Eligible, or a named exclusion reason carried into the result. This is why a null result must be read alongside the skip counts: panels excluded here were not examined and cleared, they were not examined.",
        evidence: "descriptive",
        ceiling: "indeterminate",
        reach: "deterministic-track",
      },
      {
        slug: "match-geometry-classifier",
        name: "Match geometry classifier",
        partOf: "analyze_paper_images",
        step: 9,
        monogram: "Geometry",
        does:
          "Decides from the geometry whether a match is page furniture or a partial region.",
        whenToApply:
          "On every keypoint match, before it is allowed to count as a duplication.",
        howItWorks:
          "Answers two independent questions from the recovered geometry. Is it FURNITURE — a long thin band (a caption strip, running header, axis or scale bar), at aspect ratio 10 or more wherever it sits; or an elongated element at aspect 5 or more that has not MOVED between the two panels, which makes it part of the frame rather than content carried across. Is it PARTIAL — a region duplication covering under half of BOTH panels, in which case the grain test is disqualified. Furniture is never decided by area: the areas of the real and spurious cases overlap and these two signals do not. A 2% area floor is only a backstop for a match too small to be anything at all.",
        inputs: [
          { name: "match geometry", type: "recovered transform and inlier statistics", required: true },
        ],
        output:
          "A furniture flag and a partial-region flag. Measured: the static-element rule alone reclassified all 45 groups of one paper, a TEM instrument info bar recovering a translation of exactly 0 px at aspect 7.6, where every real duplication in the corpus moved between 278 and 1,057 px. The partial exemption additionally demands 80 inliers, well clear of the 30 a match needs to exist — because the exemption disqualifies grain, and geometry must then carry the finding alone.",
        evidence: "descriptive",
        ceiling: "indeterminate",
        reach: "deterministic-track",
      },
      {
        slug: "grain-residual",
        name: "Grain residual test",
        partOf: "analyze_paper_images",
        step: 10,
        monogram: "Grain",
        does:
          "Separates the same pixels from the same subject photographed twice.",
        whenToApply:
          "On whole-panel matches, to separate the same pixels from the same subject photographed twice.",
        howItWorks:
          "Aligns one panel onto the other using the recovered transform, subtracts the low frequencies, and correlates what is left — the sensor grain. Genuinely identical pixels carry identical grain; two photographs of the same specimen do not. The measurement is restricted to the bounding box of the matched keypoints rather than the whole warped overlap.",
        inputs: [
          { name: "aligned panel pair", type: "two panels plus their transform", required: true },
        ],
        output:
          "A correlation coefficient, or null WITH the reason it could not be computed — a discriminator failing silently would leave a group looking merely unclassified, which reads as “we checked and could not say” when nothing was checked. Restricting to the matched region is measured, not cosmetic: on one real case the same pair scores 0.506 over the whole overlap and 0.718 over the matched region, because averaging across surrounding non-duplicated tissue dilutes the statistic. Grain answers “are these the same pixels”; asking it about pixels the match never claimed is the wrong question, which is why the partial-region exemption exists.",
        evidence: "probabilistic",
        ceiling: "indeterminate",
        reach: "deterministic-track",
      },
      {
        slug: "sibling-clique-demotion",
        name: "Sibling-clique demotion",
        partOf: "analyze_paper_images",
        step: 11,
        monogram: "Clique",
        does:
          "Demotes a complete match-clique among sub-panels to a shared plot template.",
        whenToApply:
          "When montage segmentation is on and sub-panels of one figure match each other.",
        howItWorks:
          "If every pair among a figure's sub-panels matches, that is a shared plot template, not duplication. Completeness is the signal: real reuse between two condition panels of one figure is a sparse pair, not a complete graph.",
        inputs: [
          { name: "match groups and sibling sets", type: "groups plus each figure's sub-panels", required: true },
        ],
        output:
          "Demoted groups, named as template matches. Measured on one paper: 66 groups, exactly the 66 pairs of 12 sub-panels. That is the template. Sparse matches among the same siblings are left standing.",
        evidence: "descriptive",
        ceiling: "indeterminate",
        reach: "deterministic-track",
      },
      {
        slug: "hidden-panel-triage",
        name: "Hidden-panel triage",
        partOf: "analyze_paper_images",
        step: 12,
        monogram: "Hidden",
        does:
          "Separates a typesetting ghost from an image present but shown nowhere.",
        whenToApply:
          "On images present in the file that the reader never sees — placed off-page, or never placed at all.",
        howItWorks:
          "Separates two facts that wear the same shape in the file. A GHOST is a hidden image that also appears somewhere visible: a float moved pages and the layout engine left a copy behind, so nothing happened. An image present in the file and shown NOWHERE is different — a panel removed late, an earlier version of a figure, something staged and forgotten.",
        inputs: [
          { name: "hidden and shown panels", type: "panel pool partitioned by visibility", required: true },
        ],
        output:
          "Ghosts recorded as context, so the exclusion is not silent; shown-nowhere images flagged for a human. Neither carries duplication severity, and neither makes a claim about the authors. Reported honestly: measured over 263 corpus papers, 2 papers (0.8%) carry any off-page placement and ZERO carry an image shown nowhere — so the second branch ships as a prospective check with a synthetic control only, rather than implying a yield it has not demonstrated.",
        evidence: "descriptive",
        ceiling: "indeterminate",
        reach: "deterministic-track",
      },
    ],
  },
  {
    slug: "r-ground-truth",
    title: "Cross-checks against R",
    shortTitle: "R cross-checks",
    blurb:
      "Two tools exist only to check our own arithmetic against the canonical R implementations. They render no verdict about any paper: a disagreement between engines means OUR tooling is wrong, and the finding is withheld rather than reported. An engine that cannot run is never a disagreement — the wrappers distinguish “package missing”, “R absent” and “R errored”, because a missing package once silently capped every GRIM finding in a whole corpus.",
    tools: [
      {
        slug: "r-grim",
        name: "GRIM ground truth (R scrutiny)",
        registryName: "r_grim_ground_truth",
        monogram: "R:G",
        does:
          "Cross-checks our GRIM against R's canonical scrutiny package.",
        whenToApply:
          "Before publishing any GRIM result at impossible — the prompts require this cross-check first.",
        howItWorks:
          "Shells out to R and runs the same test through the scrutiny package, then compares verdicts.",
        inputs: [
          { name: "mean", type: "number", required: true },
          { name: "n", type: "integer", required: true },
          { name: "items", type: "integer", required: false },
          { name: "decimals", type: "integer", required: false },
        ],
        output:
          "R's verdict beside ours. A disagreement is a bug on our side and is never evidence about the paper. If R or the package is unavailable the result says which — it does not report a disagreement.",
        evidence: "descriptive",
        ceiling: "indeterminate",
        reach: "editorial",
      },
      {
        slug: "r-sprite",
        name: "SPRITE ground truth (R rsprite2)",
        registryName: "r_sprite_ground_truth",
        monogram: "R:S",
        does:
          "Cross-checks our SPRITE against R's canonical rsprite2 package.",
        whenToApply:
          "To confirm a SPRITE no-solution result before it is relied on.",
        howItWorks:
          "Runs the reconstruction through R's rsprite2 and reports whether it proves infeasibility. Note that rsprite2 infers decimal precision from the literal it is passed, so the precision must be pinned explicitly or the two engines are silently answering different questions.",
        inputs: [
          { name: "mean / sd", type: "numbers", required: true },
          { name: "n", type: "integer", required: true },
          { name: "scale_min / scale_max", type: "integers", required: false },
          { name: "decimals", type: "integer", required: false, note: "Pin this explicitly — rsprite2 reads “4.0” as zero decimals." },
          { name: "seed", type: "integer", required: false, note: "Vary it to test whether a no-solution result is robust." },
        ],
        output:
          "rsprite2's samples, or its proof that none exists. A disagreement with our implementation is a bug in our tooling and the finding must not be reported.",
        evidence: "descriptive",
        ceiling: "indeterminate",
        reach: "both",
        references: [REF.sprite],
      },
    ],
  },
];


export const TOOLS_PATH = "/forensic-metascience-agent/tools";

/**
 * Where a tool's card actually lives. A pipeline stage of a family with its own
 * page is documented there, not in the main list, so a link built from
 * TOOLS_PATH alone would land on a page that does not contain it.
 *
 * Keyed on SLUG, never on object identity: `ToolTile` is a client component, so
 * the tool it receives is a structural copy serialized across the boundary and
 * an `includes(tool)` test silently returns false for every stage — which sent
 * all twelve image-pipeline tiles to a page that no longer contains them.
 */
const HREF_BY_SLUG: Map<string, string> = new Map(
  toolFamilies.flatMap((f) =>
    f.tools.map((t) => [
      t.slug,
      t.partOf && f.pipelinePath
        ? `${f.pipelinePath}#${t.slug}`
        : `${TOOLS_PATH}#${t.slug}`,
    ]),
  ),
);

export function toolHref(tool: Tool): string {
  return HREF_BY_SLUG.get(tool.slug) ?? `${TOOLS_PATH}#${tool.slug}`;
}

/** Where a family's section heading lives. */
export function familyHref(family: ToolFamily): string {
  return `${TOOLS_PATH}#${family.slug}`;
}

/**
 * The main toolkit list. Families with their own pipeline page are excluded
 * entirely -- the image screen is documented at `pipelinePath`, and listing a
 * stub for it here would put the same tool in two places.
 */
export const catalogueFamilies: ToolFamily[] = toolFamilies.filter(
  (f) => !f.pipelinePath && !f.unlisted,
);

/**
 * Tools listed on the toolkit page. Smaller than the agent's registry, which
 * holds 58: the image-integrity screen is documented on its own page, and the
 * tortured-phrases screen is not published while it remains quarantined behind
 * a seed dictionary. Both omissions are deliberate and asserted by
 * `scripts/check-tool-catalog.mjs`, so neither can become a silent gap.
 */
export const listedTools = catalogueFamilies.reduce((n, f) => n + f.tools.length, 0);

/** Tools the agent's registry exposes in total, listed here or not. */
export const REGISTRY_TOOL_COUNT = 58;



/**
 * What the overview page's toolkit grid shows. The R cross-checks are held back
 * there: they render no verdict about any paper -- they check our own
 * arithmetic against R's canonical packages -- so counting them among "tools
 * the agent has access to" alongside the real checks overstates the grid. They
 * stay documented in full on the tools page, which is why this is a separate
 * derivation rather than an `unlisted` flag on the family.
 */
export const overviewFamilies: ToolFamily[] = catalogueFamilies.filter(
  (f) => f.slug !== "r-ground-truth",
);

/** Tools shown on the overview page's toolkit grid -- keep the two in step. */
export const overviewTools = overviewFamilies.reduce((n, f) => n + f.tools.length, 0);
