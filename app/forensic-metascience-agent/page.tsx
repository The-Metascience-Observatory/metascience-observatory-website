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
import { ToolStacks } from "./ToolStacks";
import { PipelineDiagram } from "./PipelineDiagram";
import { TOOLS_PATH, overviewFamilies, overviewTools } from "./tools";

export const metadata = {
  title: "The Forensic Metascience Agent | The Metascience Observatory",
  description:
    "An AI agent that does forensic auditing of scientific papers, looking for statistical inconsistencies, data-integrity anomalies, improper image duplication, tortured phrases, and more using 58 tools.",
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
    source: "James Heathers' 2024 'non-systematic' review",
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
    claim: "of GRIM-testable psychology papers contain an impossible mean",
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

// One tone for both grids: the fraud and rigor statistics are the same kind of
// claim and were reading as two unrelated sections. `text-cyan-900` is the
// darker teal already used by this page's CTAs, so the numbers now match the
// rest of the page's accent rather than introducing a third colour.
const STAT_CARD = "bg-sky-50";
const STAT_VALUE = "text-cyan-900";

function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
      {stats.map((stat) => (
        <Card key={stat.value + stat.source} className={`p-5 border-black ${STAT_CARD}`}>
          <div className="flex items-center gap-4">
            <p
              className={`font-clarendon text-4xl font-bold leading-none shrink-0 ${STAT_VALUE}`}
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
    capabilities: ["phrases"],
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
          <StatGrid stats={fraudStats} />
          <MarkdownContent content={afterFraudStats} />
          <StatGrid stats={errorStats} />
          <MarkdownContent content={afterErrorStats} />
          <NhanesFormulaicCharts data={nhanesData} />
          <MarkdownContent content={afterNhanesCharts} />
          <OriFindingsChart data={oriData} />
          <MarkdownContent content={afterOriChart} />
          <FitMatrix />
          <MarkdownContent content={afterToolLogos} />

          <section>
            <h2 className="text-2xl font-semibold mb-4 mt-10 text-foreground border-b border-border pb-2">
              How it works
            </h2>
            <PipelineDiagram />
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 mt-10 text-foreground border-b border-border pb-2">
              The toolkit
            </h2>
            <p className="mb-6 leading-relaxed text-foreground/90">
              There are {overviewTools} tools that the tools agent has access to via MCP. Each tool is
              Python code which implements a particular check. View detailed information on each
              tool on{" "}
              <Link href={TOOLS_PATH} className="text-blue-600 hover:text-blue-700 underline">
                this page
              </Link>
              .
            </p>

            <ToolStacks
              variant="boxed"
              iconStyle="monogram"
              families={overviewFamilies}
            />
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
