import fs from "fs";
import path from "path";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MarkdownContent } from "@/components/MarkdownContent";
import { HeadingAnchor } from "@/components/HeadingAnchor";
import { ToolStacks } from "./ToolStacks";
import { PipelineDiagram } from "./PipelineDiagram";
import { FitMatrix } from "./FitMatrix";
import { TOOLS_PATH, overviewFamilies, overviewTools } from "./tools";

export const metadata = {
  title: "The Forensic Metascience AI toolkit | The Metascience Observatory",
  description:
    "An AI toolkit for forensic auditing of scientific papers, looking for statistical inconsistencies, data-integrity anomalies, improper image duplication, tortured phrases, and more using 58 tools.",
};

// React sections are rendered between the markdown segments these markers delimit,
// in this order. A missing marker simply yields an empty segment.
const MARKERS = [
  "<!-- HOW_IT_WORKS -->",
  "<!-- TOOL_LOGOS -->",
  "<!-- TOOLKIT -->",
] as const;

function getMarkdownSegments(): string[] {
  const filePath = path.join(process.cwd(), "content/docs/forensic-metascience-ai-toolkit.md");
  let rest: string;
  try {
    rest = fs.readFileSync(filePath, "utf-8");
  } catch {
    rest = "# The Forensic Metascience AI toolkit\n\nContent coming soon.";
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

export default function ForensicToolkitPage() {
  const [beforeHowItWorks, beforeToolLogos, afterToolLogos, afterToolkit] = getMarkdownSegments();

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-4 py-12">
          <MarkdownContent content={beforeHowItWorks} anchorHeadings />

          <section>
            <h2
              id="how-it-works"
              className="group text-2xl font-semibold mb-4 mt-10 text-foreground border-b border-border pb-2 scroll-mt-20"
            >
              How it works
              <HeadingAnchor id="how-it-works" />
            </h2>
            <PipelineDiagram />
          </section>

          <MarkdownContent content={beforeToolLogos} anchorHeadings />
          <FitMatrix compact boxedLabels={false} />
          <MarkdownContent content={afterToolLogos} anchorHeadings />

          <section>
            <h2
              id="the-toolkit"
              className="group text-2xl font-semibold mb-4 mt-10 text-foreground border-b border-border pb-2 scroll-mt-20"
            >
              The toolkit
              <HeadingAnchor id="the-toolkit" />
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
              <MarkdownContent content={afterToolkit} anchorHeadings />
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
