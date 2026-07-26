import fs from "fs";
import path from "path";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MarkdownContent } from "@/components/MarkdownContent";
import { DocsBackLink } from "@/components/DocsBackLink";

export const metadata = {
  title: "About Bird's Eye Reviews | The Metascience Observatory",
  description:
    "Bird's Eye Reviews are a new form of high-level literature review where results are displayed in an interactive dashboard with filtering options.",
};

function getMarkdownContent(): string {
  const filePath = path.join(process.cwd(), "content/docs/overview-birds-eye-reviews.md");
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "# About Bird's Eye Reviews\n\nContent coming soon.";
  }
}

export default function BirdsEyeReviewOverviewPage() {
  const content = getMarkdownContent();

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-4 py-12 max-w-3xl">
          <DocsBackLink href="/articles" label="return to articles" />
          <MarkdownContent content={content} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
