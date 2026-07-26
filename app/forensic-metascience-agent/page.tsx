import fs from "fs";
import path from "path";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { DocsBackLink } from "@/components/DocsBackLink";
import { MarkdownContent } from "@/components/MarkdownContent";

export const metadata = {
  title: "The Forensic Metascience Agent | The Metascience Observatory",
  description:
    "An AI agent that checks scientific papers for statistical inconsistencies and data-integrity anomalies using 31 forensic metascience tools.",
};

const TOOLKIT_MARKER = "<!-- TOOLKIT -->";

function getMarkdownSections(): { intro: string; outro: string } {
  const filePath = path.join(process.cwd(), "content/docs/forensic-metascience-agent.md");
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const [intro, outro = ""] = content.split(TOOLKIT_MARKER);
    return { intro, outro };
  } catch {
    return { intro: "# The Forensic Metascience Agent\n\nContent coming soon.", outro: "" };
  }
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
  const { intro, outro } = getMarkdownSections();

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-4 py-12 max-w-3xl">
          <DocsBackLink href="/articles" label="return to articles" />
          <MarkdownContent content={intro} />

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
                      <Card key={tool.name} className="h-full p-5 border-border">
                        <h4 className="font-clarendon font-semibold text-lg text-foreground mb-2">
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

          {outro && (
            <div className="mt-4">
              <MarkdownContent content={outro} />
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
