import type { ReactNode } from "react";
import fs from "fs";
import path from "path";
import Link from "next/link";
import { csvParse } from "d3-dsv";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { DocsBackLink } from "@/components/DocsBackLink";
import { MarkdownContent } from "@/components/MarkdownContent";
import { OriFindingsChart, OriYearDatum } from "./OriFindingsChart";
import { NhanesFormulaicCharts, NhanesFormulaicData } from "./NhanesFormulaicCharts";

export const metadata = {
  title: "The Forensic Metascience Agent | The Metascience Observatory",
  description:
    "An AI agent that does forensic auditing of scientific papers, looking for statistical inconsistencies, data-integrity anomalies, improper image duplication, tortured phrases, and more using 30+ tools.",
};

// React sections are rendered between the markdown segments these markers delimit,
// in this order. A missing marker simply yields an empty segment.
const MARKERS = [
  "<!-- FINDINGS_CTA -->",
  "<!-- INTRO_END -->",
  "<!-- FRAUD_STATS -->",
  "<!-- ERROR_STATS -->",
  "<!-- NHANES_CHARTS -->",
  "<!-- ORI_CHART -->",
  "<!-- TOOL_LOGOS -->",
  "<!-- TOOLKIT -->",
] as const;

function getMarkdownSegments(): string[] {
  const filePath = path.join(process.cwd(), "content/docs/forensic-metascience-agent.md");
  let rest: string;
  try {
    rest = fs.readFileSync(filePath, "utf-8");
  } catch {
    rest = "# The Forensic Metascience Agent\n\nContent coming soon.";
  }
  const segments: string[] = [];
  for (const marker of MARKERS) {
    const [before, after = ""] = rest.split(marker);
    segments.push(before);
    rest = after;
  }
  segments.push(rest);
  return segments;
}

function getOriFindings(): OriYearDatum[] {
  const csvPath = path.join(process.cwd(), "data/ori_findings_by_year.csv");
  const rows = csvParse(fs.readFileSync(csvPath, "utf-8"));
  return rows.map((r) => ({
    year: Number(r.year),
    findings: Number(r.ori_misconduct_findings),
    partial: (r.note ?? "").includes("PARTIAL"),
  }));
}

function getNhanesFormulaic(): NhanesFormulaicData {
  const jsonPath = path.join(process.cwd(), "data/nhanes_formulaic.json");
  return JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as NhanesFormulaicData;
}

interface Stat {
  value: string;
  claim: ReactNode;
  source: string;
  href?: string;
}

const fraudStats: Stat[] = [
  {
    value: "2%",
    claim: "of researchers admit to fabricating or falsifying data.",
    source: "Fanelli 2009 meta-analysis of surveys",
    href: "https://doi.org/10.1371/journal.pone.0005738",
  },
  {
    value: "3.8%",
    claim: "of biomedical papers contain inappropriate image duplication.",
    source: "Bik et al. 2016",
    href: "https://doi.org/10.1128/mBio.00809-16",
  },
  {
    value: "14%",
    claim: (
      <>
        of 521 trials submitted to the journal <i>Anaesthesia</i> contained false data.
      </>
    ),
    source: "Carlisle 2021",
    href: "https://doi.org/10.1111/anae.15263",
  },
  {
    value: "~14%",
    claim: "papers contain some form of fabricated data.",
    source: "James Heather's 2024 'non-systematic' review",
    href: "https://metaror.org/kotahi/articles/18/index.html",
  },
];

const errorStats: Stat[] = [
  {
    value: "50%",
    claim: "of psychology papers report a p-value that contradicts its own test statistic",
    source: "statcheck; 250,000 p-values across eight journals (Nuijten et al. 2016)",
    href: "https://doi.org/10.3758/s13428-015-0664-2",
  },
  {
    value: "1 in 8",
    claim: "psychology papers contain an error that flips the significance conclusion",
    source: "Nuijten et al. 2016",
    href: "https://doi.org/10.3758/s13428-015-0664-2",
  },
  {
    value: "~50%",
    claim: "of GRIM-testable psychology papers contained an impossible mean",
    source: "Brown & Heathers 2017; 36 of 71 testable papers",
    href: "https://doi.org/10.1177/1948550616673876",
  },
  {
    value: "63%",
    claim: "of meta-analyses had a data-extraction error; 37% enough to change the result",
    source: "Gøtzsche et al., JAMA 2007",
    href: "https://doi.org/10.1001/jama.298.4.430",
  },
];

// Muted-blue accent (the chart's bar color) for fraud; purple for rigor.
const STAT_TONES = {
  fraud: { card: "bg-sky-50", value: "text-[#1a5276]" },
  error: { card: "bg-purple-50", value: "text-purple-950" },
} as const;

function StatGrid({ stats, tone }: { stats: Stat[]; tone: keyof typeof STAT_TONES }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
      {stats.map((stat) => (
        <Card key={stat.value + stat.source} className={`p-5 border-black ${STAT_TONES[tone].card}`}>
          <div className="flex items-center gap-4">
            <p
              className={`font-clarendon text-4xl font-bold leading-none shrink-0 ${STAT_TONES[tone].value}`}
            >
              {stat.value}
            </p>
            <div className="min-w-0">
              <p className="text-sm text-foreground leading-relaxed">{stat.claim}</p>
              <p className="mt-2 text-xs text-foreground/60">
                {"("}
                {stat.href ? (
                  <a
                    href={stat.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground underline decoration-foreground/30 underline-offset-2"
                  >
                    {stat.source}
                  </a>
                ) : (
                  stat.source
                )}
                {")"}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// Capability columns of the fit matrix. Add a new column here and tick it in
// each company's `capabilities` list.
const CAPABILITIES = [
  { key: "image_within", label: "Within-paper image duplication and manipulation" },
  { key: "image_between", label: "Between-paper image duplication" },
  { key: "dataset_si", label: "SI/SM/Dataverse copy-paste errors" },
  { key: "dataset_repo", label: "Open Source Repo dataset copy-paste errors" },
  { key: "phrases", label: "Tortured phrases" },
  { key: "ai_text", label: "AI text generation" },
  { key: "plagiarism", label: "Plagiarism detection" },
  { key: "stats", label: "Check stats and arithmetic" },
  { key: "ai_review", label: "AI peer review" },
] as const;

type CapabilityKey = (typeof CAPABILITIES)[number]["key"];

interface ToolCompany {
  name: string;
  href?: string;
  /** Logo image; the name renders as text when absent. */
  src?: string;
  /** Render the name as text next to the logo. */
  showName?: boolean;
  /** This project's row — site-primary accent. */
  highlight?: boolean;
  capabilities: CapabilityKey[];
  /** Capabilities partially covered — rendered as a half-filled (diagonal) box. */
  partial?: CapabilityKey[];
}

const companies: ToolCompany[] = [
  {
    name: "Proofig AI",
    href: "https://www.proofig.com/",
    src: "/assets/forensic/proofig_logo.png",
    capabilities: ["image_within", "image_between"],
  },
  {
    name: "ImageTwin",
    href: "https://imagetwin.ai/",
    src: "/assets/forensic/imagetwin_logo.png",
    capabilities: ["image_within", "image_between"],
  },
  {
    name: "ReviewerZero",
    href: "https://www.reviewerzero.ai/",
    src: "/assets/forensic/reviewerzero_logo.png",
    capabilities: ["image_within", "image_between", "phrases", "ai_text", "plagiarism", "ai_review"],
    partial: ["stats"],
  },
  {
    name: "River Valley Technologies",
    href: "https://rivervalley.io/",
    src: "/assets/forensic/river_valley_tech_logo.png",
    showName: true,
    capabilities: ["image_within", "phrases"],
  },
  {
    name: "ScienceDetective.org",
    href: "https://www.sciencedetective.org/scientific-datasets-are-riddled-with-copy-paste-errors/",
    src: "/assets/forensic/science_detective_logo.png",
    showName: true,
    capabilities: ["dataset_repo"],
  },
  {
    name: "Refine",
    href: "https://refine.ink/",
    src: "/assets/forensic/refine_logo.png",
    capabilities: ["phrases", "ai_review"],
  },
  {
    name: "iThenticate",
    href: "https://www.ithenticate.com/",
    src: "/assets/forensic/ithenticate.png",
    capabilities: ["plagiarism"],
  },
  {
    name: "Forensic Metascience Agent",
    src: "/assets/globe.svg",
    showName: true,
    highlight: true,
    capabilities: ["stats", "dataset_si", "ai_review"],
    partial: ["phrases", "image_within"],
  },
];

type BoxFill = "full" | "half" | "none";

function CapabilityBox({ fill }: { fill: BoxFill }) {
  const label = fill === "full" ? "Covered" : fill === "half" ? "Partial" : "Not covered";
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex h-5 w-5 overflow-hidden rounded border ${
        fill === "none" ? "border-foreground/25 bg-white" : "border-primary bg-white"
      }`}
    >
      {fill === "full" && <span className="h-full w-full bg-primary" />}
      {fill === "half" && (
        <svg viewBox="0 0 16 16" className="h-full w-full text-primary" aria-hidden>
          <polygon points="0,0 16,16 0,16" fill="currentColor" />
        </svg>
      )}
    </span>
  );
}

function FitMatrix() {
  return (
    <div className="overflow-x-auto my-8">
      <table className="border-collapse">
        <thead>
          <tr>
            <th className="w-56" aria-label="Tool" />
            {CAPABILITIES.map((cap) => (
              <th key={cap.key} className="relative h-64 w-12 p-0 align-bottom" title={cap.label}>
                <div className="absolute bottom-1 left-1/2 origin-bottom-left -rotate-45 whitespace-nowrap text-xs font-medium text-foreground">
                  {cap.label}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr
              key={company.name}
              className={`border-t border-border ${company.highlight ? "bg-primary/5" : ""}`}
            >
              <td className="py-2 pr-4">
                {(() => {
                  const chipContent = (
                    <>
                      {company.src && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={company.src}
                          alt={`${company.name} logo`}
                          className="max-h-5 w-auto"
                        />
                      )}
                      {(!company.src || company.showName) && (
                        <span
                          className={`${
                            company.highlight ? "whitespace-normal leading-tight" : "truncate"
                          } text-xs font-medium text-foreground ${company.src ? "ml-2" : ""}`}
                        >
                          {company.name}
                        </span>
                      )}
                    </>
                  );
                  const chipClass = `flex ${
                    company.highlight ? "h-12" : "h-9"
                  } w-56 items-center rounded border border-border bg-white px-3`;
                  return company.href ? (
                    <a
                      href={company.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={company.name}
                      className={`${chipClass} hover:shadow-md transition-shadow`}
                    >
                      {chipContent}
                    </a>
                  ) : (
                    <div className={chipClass}>{chipContent}</div>
                  );
                })()}
              </td>
              {CAPABILITIES.map((cap) => (
                <td key={cap.key} className="px-2 py-2 text-center">
                  <CapabilityBox
                    fill={
                      company.capabilities.includes(cap.key)
                        ? "full"
                        : company.partial?.includes(cap.key)
                          ? "half"
                          : "none"
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ToolMeta {
  name: string;
  description: string;
  inputs?: string;
}

interface ToolGroup {
  title: string;
  blurb: string;
  tools: ToolMeta[];
}

const toolGroups: ToolGroup[] = [
  {
    title: "PDF & table ingestion",
    blurb:
      "Statistics are read directly from the typeset PDFs — tables survive far better there than in text conversions — and normalized into structured cells before any check runs.",
    tools: [
      {
        name: "PDF extraction",
        description:
          "Extracts text and tables from the main or supplementary PDF, page by page, so statistics can be read from the typeset tables rather than a lossy text conversion.",
        inputs: "PDF file, optional page range",
      },
      {
        name: "Table parser",
        description:
          "Normalizes a table — markdown, extracted PDF grid, or raw text — into structured cells (row label, column label, value, SD), and can reconcile two extractions of the same table, flagging cells that disagree.",
        inputs: "a table in any format; optional second extraction to cross-check",
      },
    ],
  },
  {
    title: "GRIM family",
    blurb:
      "Integer data — Likert scales, counts, whole-number responses — can only produce certain means and percentages at a given sample size. These granularity tests check whether reported values are achievable at all.",
    tools: [
      {
        name: "GRIM",
        description:
          "Tests whether a reported mean is possible for integer-scaled data: some integer sum must exist that rounds to the reported mean at the stated sample size and decimal precision.",
        inputs: "mean, sample size, scale bounds, decimal places",
      },
      {
        name: "GRIM for percentages",
        description:
          "The same granularity test applied to percentages, which carry more precision than means and therefore make the test considerably more powerful.",
        inputs: "percentage, sample size, decimal places",
      },
      {
        name: "GRIM sweep",
        description:
          "Given several percentages that supposedly share a denominator, finds every sample size at which all of them are simultaneously achievable. An empty result means the percentages cannot come from the same sample.",
        inputs: "list of percentages, maximum plausible sample size",
      },
      {
        name: "2×2 reconstruction",
        description:
          "Recovers the hidden cell counts of a 2×2 contingency table from two column percentages and the total N — optionally checking the reconstructed table against a reported χ².",
        inputs: "two column percentages, total N, optional reported χ²",
      },
    ],
  },
  {
    title: "GRIMMER & DEBIT",
    blurb:
      "Standard deviations are granular too: for integer or binary data, only certain SDs can exist behind a given mean and sample size.",
    tools: [
      {
        name: "GRIMMER",
        description:
          "Tests whether a reported SD is possible for integer data by enumerating the achievable sums and sums-of-squares (including a parity constraint between them) behind the reported mean.",
        inputs: "mean, SD, sample size, scale bounds",
      },
      {
        name: "DEBIT",
        description:
          "For binary (0/1) variables the SD is fully determined by the mean and sample size — this checks the reported SD against the only value it can be.",
        inputs: "mean, SD, sample size",
      },
      {
        name: "DEBIT batch",
        description:
          "Runs the DEBIT consistency check across every binary variable in a table at once, so entire demographic tables can be screened in one pass.",
        inputs: "a table of binary-variable means, SDs, and ns",
      },
    ],
  },
  {
    title: "Test-statistic recalculation",
    blurb:
      "A test statistic, its degrees of freedom, and its p-value are redundant: they can be recomputed from the group summaries, and the recomputed values must agree with what the paper reports.",
    tools: [
      {
        name: "Independent-samples t-test",
        description:
          "Recomputes t and p from two groups' means, SDs, and sizes (Student or Welch) and compares them with the reported values.",
        inputs: "each group's mean, SD, and n; reported t and/or p",
      },
      {
        name: "Within-subjects t-test",
        description:
          "For paired designs, recovers the pre/post correlation implied by the summary statistics and the reported result. An implied correlation greater than 1 in magnitude is mathematically impossible (Jané et al. 2024).",
        inputs: "pre/post means and SDs, sample size, reported t or p",
      },
      {
        name: "One-way ANOVA",
        description:
          "Recomputes the F statistic and p-value of a one-way ANOVA from the group means, SDs, and sizes.",
        inputs: "group means, SDs, and ns; reported F and/or p",
      },
      {
        name: "F → p",
        description:
          "Verifies that any reported F statistic and its degrees of freedom yield the reported p-value — usable for ANOVAs of any shape.",
        inputs: "F, both degrees of freedom, reported p",
      },
      {
        name: "Chi-squared",
        description:
          "Recomputes χ² and p from a contingency table's counts, with the Yates correction and Fisher's exact test for 2×2 tables.",
        inputs: "contingency-table counts; reported χ² and/or p",
      },
      {
        name: "Regression coefficient",
        description:
          "Verifies that a reported regression coefficient's t statistic equals B / SE and that its p-value matches the degrees of freedom.",
        inputs: "coefficient, standard error, degrees of freedom; reported t/p",
      },
    ],
  },
  {
    title: "Dispersion plausibility",
    blurb:
      "The spread of a sample is bounded by its range, and simple bookkeeping identities must hold. Violations are outright impossible, not merely unlikely.",
    tools: [
      {
        name: "SD range check",
        description:
          "The largest SD a sample can have is fixed by its range — approximately (range/2)·√(n/(n−1)). A reported SD above that maximum is impossible.",
        inputs: "SD, minimum and maximum possible values, sample size",
      },
      {
        name: "SD-or-SE adjudication",
        description:
          "When it is ambiguous whether a table reports standard deviations or standard errors, tests both readings (SE = SD/√n) against a plausibility ceiling and adjudicates which the value must be.",
        inputs: "reported value, sample size, a plausibility ceiling or range",
      },
      {
        name: "Summation check",
        description:
          "Verifies that values sum to their stated total — subgroup counts to N, percentages to 100 — within rounding tolerance.",
        inputs: "list of values, expected total, tolerance",
      },
    ],
  },
  {
    title: "Hidden information",
    blurb:
      "Papers often report less than their own numbers reveal. These tools recover what a thresholded p-value or a bare summary conceals.",
    tools: [
      {
        name: "STALT",
        description:
          "When a paper reports only “p < 0.05” but the group statistics allow exact recalculation, flags exact p-values many orders of magnitude below the stated threshold — information the paper concealed.",
        inputs: "recalculated exact p, reported threshold",
      },
      {
        name: "SPRITE",
        description:
          "Reconstructs the possible integer datasets behind a reported mean, SD, and sample size, surfacing distributions with implausible shapes — bimodal, or stacked at the scale boundaries — that suggest the summary statistics were invented.",
        inputs: "mean, SD, sample size, scale bounds",
      },
    ],
  },
  {
    title: "RCT baseline integrity",
    blurb:
      "In a properly randomized trial, baseline characteristics should differ somewhat between groups by chance. Groups that are too similar are the classic signature of failed — or faked — randomization: a Table 1 where every baseline p-value is 0.93, 0.99, 0.99 is a red flag, not reassurance.",
    tools: [
      {
        name: "Carlisle–Stouffer–Fisher test",
        description:
          "Combines a trial's baseline p-values into a one-sided test of excess similarity. A very small result means the groups are more alike than randomization can plausibly produce.",
        inputs: "the trial's baseline p-values",
      },
      {
        name: "Bayesian Table-1 dispersion",
        description:
          "Estimates a precision multiplier for the whole baseline table (in the style of Bolland 2022). Values well above 1 indicate under-dispersion: baseline differences systematically smaller than chance allows.",
        inputs: "every baseline row — means, SDs, and ns, or categorical counts",
      },
      {
        name: "Proportion-from-normal",
        description:
          "Tests whether a reported categorical proportion (e.g. “40% of participants above threshold X”) is consistent with the reported mean and SD of the underlying continuous variable.",
        inputs: "proportion, mean, SD, sample size, threshold and direction",
      },
    ],
  },
  {
    title: "Hand-calculation & heuristics",
    blurb:
      "Some anomalies are not impossible numbers but improbable patterns: statistics computed backwards from a table's rounded values, or sample sizes too round to be real recruitment.",
    tools: [
      {
        name: "RIVETS (t-test)",
        description:
          "Simulates data consistent with the printed, rounded summary statistics. A reported t that exactly equals the value hand-calculated from the rounded inputs — which almost no real underlying data reproduces — is the signature of statistics computed from the table rather than from data.",
        inputs: "group summaries; reported t and p",
      },
      {
        name: "RIVETS (ANOVA)",
        description: "The same hand-calculation detector applied to reported F statistics.",
        inputs: "group summaries; reported F and p",
      },
      {
        name: "Round-n flag",
        description:
          "Flags suspiciously round sample sizes (100, 200, 500…), which appear in fabricated studies far more often than real recruitment produces them.",
        inputs: "the study's sample sizes",
      },
      {
        name: "Uninformative-statistic flag",
        description:
          "Flags comparisons reported too coarsely — no test statistic, no exact p, no degrees of freedom — to pin down what was actually computed.",
        inputs: "whatever summary statistics the paper does report",
      },
    ],
  },
  {
    title: "Rank-sum granularity",
    blurb:
      "The Mann–Whitney U statistic takes only (half-)integer values between 0 and n₁·n₂, so for given group sizes only a finite set of p-values is achievable.",
    tools: [
      {
        name: "GRIM-U",
        description:
          "Checks whether a p-value attributed to a Mann–Whitney / Wilcoxon rank-sum test is achievable at the stated group sizes. A p-value below the U = 0 floor cannot be produced by any data and is a reporting error.",
        inputs: "both group sizes, reported p (exact or thresholded)",
      },
      {
        name: "GRIM-U coexistence",
        description:
          "Tests whether two nearly identical rank-sum p-values (say 0.171 and 0.172) can both be produced at the same group sizes, given the granularity of the achievable p-values.",
        inputs: "group sizes and the two reported p-values",
      },
    ],
  },
  {
    title: "Cross-table integrity",
    blurb:
      "Two records of the same facts should be identical; identical records of different facts should not exist.",
    tools: [
      {
        name: "Duplication detection",
        description:
          "Compares every (mean, SD) pair within and across a paper's tables and studies. Identical pairs recurring across supposedly independent samples are the signature of copy-pasted or recycled data — a place where duplication checks reach data that GRIM-style granularity tests cannot.",
        inputs: "labeled blocks of (mean, SD) cells, with sample identity per block",
      },
    ],
  },
  {
    title: "External tools",
    blurb: "Established third-party checkers, run as part of the sweep.",
    tools: [
      {
        name: "statcheck",
        description:
          "Runs the well-known statcheck tool: extracts APA-formatted test statistics from the text and recomputes their p-values, reporting inconsistencies and decision errors (where the recomputed p changes the significance conclusion).",
        inputs: "the paper's text or PDF",
      },
    ],
  },
];

const totalTools = toolGroups.reduce((sum, group) => sum + group.tools.length, 0);

export default function ForensicAgentToolkitPage() {
  const [
    beforeFindingsCta,
    intro,
    beforeFraudStats,
    afterFraudStats,
    afterErrorStats,
    afterNhanesCharts,
    afterOriChart,
    afterToolLogos,
    afterToolkit,
  ] = getMarkdownSegments();
  const oriData = getOriFindings();
  const nhanesData = getNhanesFormulaic();

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-4 py-12">
          <DocsBackLink href="/articles" label="return to articles" />
          <MarkdownContent content={beforeFindingsCta} />
          <div className="grid grid-cols-1 md:grid-cols-[1fr_16rem] gap-6 items-start my-6">
            <MarkdownContent content={intro} />
            <Link
              href="/forensic-metascience-agent/findings"
              className="group flex flex-col gap-2 rounded-lg border border-black bg-primary/5 p-5 hover:shadow-md transition-shadow"
            >
              <span className="font-clarendon font-semibold text-lg text-cyan-900 leading-snug text-center">
                See findings and 
                <br />
                PubPeer comments
              </span>
              <svg
                aria-hidden
                viewBox="0 0 32 24"
                className="h-9 w-12 text-cyan-900 self-center transition-transform group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 12h20" />
                <path d="M21 5.5l9 6.5-9 6.5z" fill="currentColor" stroke="none" />
              </svg>
            </Link>
          </div>
          <MarkdownContent content={beforeFraudStats} />
          <StatGrid stats={fraudStats} tone="fraud" />
          <MarkdownContent content={afterFraudStats} />
          <StatGrid stats={errorStats} tone="error" />
          <MarkdownContent content={afterErrorStats} />
          <NhanesFormulaicCharts data={nhanesData} />
          <MarkdownContent content={afterNhanesCharts} />
          <OriFindingsChart data={oriData} />
          <MarkdownContent content={afterOriChart} />
          <FitMatrix />
          <MarkdownContent content={afterToolLogos} />

          <section>
            <h2 className="text-2xl font-semibold mb-4 mt-10 text-foreground border-b border-border pb-2">
              The toolkit
            </h2>
            <p className="mb-8 leading-relaxed text-foreground/90">
              The {totalTools} tools fall into the following families. Each check needs only the
              numbers printed in the paper &mdash; no raw data.
            </p>

            <div className="space-y-10">
              {toolGroups.map((group) => (
                <section key={group.title}>
                  <h3 className="text-xl font-semibold text-foreground">{group.title}</h3>
                  <p className="text-foreground/70 leading-relaxed mt-2 mb-4">{group.blurb}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {group.tools.map((tool) => (
                      <Card key={tool.name} className="h-full p-5 border-black bg-primary/5">
                        <h4 className="font-clarendon font-semibold text-lg text-primary mb-2">
                          {tool.name}
                        </h4>
                        <p className="text-sm text-foreground/80 leading-relaxed">
                          {tool.description}
                        </p>
                        {tool.inputs && (
                          <p className="mt-3 text-xs text-foreground/60">
                            <span className="font-medium text-foreground/70">Inputs:</span>{" "}
                            {tool.inputs}
                          </p>
                        )}
                      </Card>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>

          {afterToolkit && (
            <div className="mt-4">
              <MarkdownContent content={afterToolkit} />
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
