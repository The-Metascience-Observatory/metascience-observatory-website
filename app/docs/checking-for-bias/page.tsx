import fs from "fs";
import path from "path";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MarkdownContent } from "@/components/MarkdownContent";
import { DocsBackLink } from "@/components/DocsBackLink";

export const metadata = {
  title: "Checking for bias | The Metascience Observatory",
  description:
    "Testing whether our literature-harvested replications are biased by comparing them against replication initiatives that defined a sampling frame in advance.",
};

function getMarkdownContent(): string {
  const filePath = path.join(process.cwd(), "content/docs/checking-for-bias.md");
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "# Checking for bias\n\nContent coming soon.";
  }
}

export default function CheckingForBiasPage() {
  const content = getMarkdownContent();

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-4 py-12 max-w-3xl">
          <DocsBackLink href="/articles" label="return to articles" />
          <div
            role="alert"
            className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-800 dark:text-red-200"
          >
            <strong>Alert</strong> &mdash; the content in this page was written by AI (Opus 5).
            The data in the tables have been checked and stress-tested by a human working with
            the Opus 5 model.
          </div>
          <MarkdownContent content={content} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
