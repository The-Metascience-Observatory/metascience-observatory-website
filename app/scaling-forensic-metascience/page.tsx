import type { ReactNode } from "react";
import fs from "fs";
import path from "path";
import Link from "next/link";
import { csvParse } from "d3-dsv";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { MarkdownContent } from "@/components/MarkdownContent";
// The charts stay with the toolkit route: its nsf-oig-data page uses them too.
import { OriFindingsChart, OriYearDatum } from "../forensic-metascience-ai-toolkit/OriFindingsChart";
import { NsfOigFindingsByTypeChart } from "../forensic-metascience-ai-toolkit/NsfOigFindingsByTypeChart";
import { getNsfOigFindingsByType } from "../forensic-metascience-ai-toolkit/nsfOigData";
import { NhanesFormulaicCharts, NhanesFormulaicData } from "../forensic-metascience-ai-toolkit/NhanesFormulaicCharts";

export const metadata = {
  title: "Scaling Forensic Metascience | The Metascience Observatory",
  description:
    "Why the scientific literature needs large-scale forensic checking: data integrity, rigor, slop and oversight problems, and how the Metascience Observatory's tools address them.",
};

// React sections are rendered between the markdown segments these markers delimit,
// in this order. A missing marker simply yields an empty segment.
const MARKERS = [
  "<!-- FINDINGS_CTA -->",
  "<!-- INTRO_END -->",
  "<!-- MAJOR_ISSUE_STATS -->",
  "<!-- ERROR_STATS -->",
  "<!-- NHANES_CHARTS -->",
  "<!-- ORI_CHART -->",
  "<!-- NSF_OIG_CHART -->",
] as const;

function getMarkdownSegments(): string[] {
  const filePath = path.join(process.cwd(), "content/docs/scaling-forensic-metascience.md");
  let rest: string;
  try {
    rest = fs.readFileSync(filePath, "utf-8");
  } catch {
    rest = "# Scaling Forensic Metascience\n\nContent coming soon.";
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

const majorIssueStats: Stat[] = [
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
    source: "Carlisle, 2021",
    href: "https://doi.org/10.1111/anae.15263",
  },
  {
    value: "~14%",
    claim: "of papers contain some form of anomalous / highly questionable data",
    source: "James Heathers' 2024 'highly non-systematic' review",
    href: "https://metaror.org/kotahi/articles/18/index.html",
  },
  {
    value: "53.7%",
    claim:
      "of 6,200 medical residents in China admit to having committed at least one form of research misconduct.",
    source: "Chen et al. 2024",
    href: "https://link.springer.com/article/10.1186/s12909-024-05277-6",
  },
  {
    value: "3%",
    claim:
      "of 600 biomedical datasets from well-cited publications have serious copy-paste issues (not yet proven as fraud but very suspicious).",
    source: "Englund, 2026",
    href: "https://www.science.org/content/blog-post/dupeless-reeducation",
  },
];

const errorStats: Stat[] = [
  {
    value: "50%",
    claim: "of psychology papers report a p-value that contradicts its own test statistic",
    source: "Nuijten et al. 2016",
    href: "https://doi.org/10.3758/s13428-015-0664-2",
  },
  {
    value: "1 in 8",
    claim: "psychology papers contain an error that flips the significance of a conclusion",
    source: "Nuijten et al. 2016",
    href: "https://doi.org/10.3758/s13428-015-0664-2",
  },
  {
    value: "~50%",
    claim: "of 71 GRIM-testable psychology papers contain an impossible mean",
    source: "Brown & Heathers 2017",
    href: "https://doi.org/10.1177/1948550616673876",
  },
  {
    value: "63%",
    claim: "of meta-analyses had a data-extraction error; 37% had an error large enough to change the result",
    source: "Gøtzsche et al., JAMA 2007",
    href: "https://doi.org/10.1001/jama.298.4.430",
  },
];

// One tone for both grids: the fraud and rigor statistics are the same kind of
// claim and were reading as two unrelated sections. They carry the site-primary
// teal so the numbers match the page's main accent; the findings CTA takes the
// contrasting blue instead, which keeps it distinct from the statistics.
const STAT_CARD = "bg-primary/5";
const STAT_VALUE = "text-cyan-900";

function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
      {stats.map((stat) => (
        <Card
          key={stat.value + stat.source}
          // `h-full` + centring: the grid already gives every card the same
          // height, but without these the content sits at the top of the taller
          // ones and the row reads as ragged.
          className={`flex h-full items-center p-5 border-black ${STAT_CARD}`}
        >
          <div className="flex w-full items-center gap-4">
            <p
              className={`font-clarendon text-4xl font-bold leading-none shrink-0 ${STAT_VALUE}`}
            >
              {stat.value}
            </p>
            {/*
              The citation runs on from the claim rather than starting its own
              line: on a two-line claim a block-level source pushed the card
              taller than its neighbours for no reading benefit.
            */}
            <p className="min-w-0 text-sm leading-relaxed text-foreground">
              {stat.claim}{" "}
              <span className="whitespace-nowrap text-xs text-black">
                {"("}
                {stat.href ? (
                  <a
                    href={stat.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-black underline underline-offset-2"
                  >
                    {stat.source}
                  </a>
                ) : (
                  stat.source
                )}
                {")"}
              </span>
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function ScalingForensicMetasciencePage() {
  const [
    beforeFindingsCta,
    intro,
    beforeMajorIssueStats,
    afterMajorIssueStats,
    afterErrorStats,
    afterNhanesCharts,
    afterOriChart,
    afterNsfOigChart,
  ] = getMarkdownSegments();
  const oriData = getOriFindings();
  const nsfOigData = getNsfOigFindingsByType();
  const nhanesData = getNhanesFormulaic();

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-4 py-12">
          <MarkdownContent content={beforeFindingsCta} anchorHeadings />
          <div className="grid grid-cols-1 md:grid-cols-[1fr_16rem] gap-6 items-start my-6">
            <MarkdownContent content={intro} anchorHeadings />
            <div className="flex flex-col gap-4">
              <Link
                href="/forensic-metascience-ai-toolkit/findings"
                className="group flex flex-col gap-2 rounded-lg border border-black bg-sky-50 p-5 hover:shadow-md transition-shadow"
              >
                <span className="font-clarendon font-semibold text-lg text-sky-900 leading-snug text-center">
                  See findings and 
                  <br />
                  PubPeer comments
                </span>
                <svg
                  aria-hidden
                  viewBox="0 0 32 24"
                  className="h-9 w-12 text-sky-900 self-center transition-transform group-hover:translate-x-1"
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
          </div>
          <MarkdownContent content={beforeMajorIssueStats} anchorHeadings />
          <StatGrid stats={majorIssueStats} />
          <MarkdownContent content={afterMajorIssueStats} anchorHeadings />
          <StatGrid stats={errorStats} />
          <MarkdownContent content={afterErrorStats} anchorHeadings />
          <NhanesFormulaicCharts data={nhanesData} />
          <MarkdownContent content={afterNhanesCharts} anchorHeadings />
          <OriFindingsChart data={oriData} />
          <MarkdownContent content={afterOriChart} anchorHeadings />
          <NsfOigFindingsByTypeChart data={nsfOigData} />
          <MarkdownContent content={afterNsfOigChart} anchorHeadings />
        </div>
      </main>
      <Footer />
    </div>
  );
}
