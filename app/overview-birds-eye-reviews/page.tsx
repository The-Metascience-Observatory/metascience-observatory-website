import fs from "fs";
import path from "path";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MarkdownContent } from "@/components/MarkdownContent";
import { DocsBackLink } from "@/components/DocsBackLink";
import { FunnelFigure } from "./FunnelFigure";

export const metadata = {
  title: "About Bird's Eye Reviews | The Metascience Observatory",
  description:
    "Bird's Eye Reviews are a new form of high-level literature review where results are displayed in an interactive dashboard with filtering options.",
};

// The figure is rendered between the two markdown segments this marker
// delimits: the H1 above it, the body prose below.
const FIGURE_MARKER = "<!-- FIGURE -->";

function getMarkdownSegments(): [string, string] {
  const filePath = path.join(process.cwd(), "content/docs/overview-birds-eye-reviews.md");
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    content = `# About Bird's Eye Reviews\n\n${FIGURE_MARKER}\n\nContent coming soon.`;
  }
  const [head, body = ""] = content.split(FIGURE_MARKER);
  return [head, body];
}

export default function BirdsEyeReviewOverviewPage() {
  const [head, body] = getMarkdownSegments();

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 pb-16">
        {/* The figure wants the full container width; the prose keeps its
            reading measure, so max-w-3xl moves onto the text blocks. */}
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto">
            <DocsBackLink href="/articles" label="return to articles" />
            <MarkdownContent content={head} />
          </div>
          <FunnelFigure />
          <div className="max-w-3xl mx-auto">
            <MarkdownContent content={body} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
