import fs from "fs";
import path from "path";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MarkdownContent } from "@/components/MarkdownContent";
import { DocsBackLink } from "@/components/DocsBackLink";

export const metadata = {
  title: "About the Explorer | The Metascience Observatory",
  description:
    "The data sources used to construct the Metascience Observatory Explorer, including SciSciNet-V2, OpenAlex, Scopus, DOAJ, Retraction Watch, and MeSH.",
};

function getMarkdownContent(): string {
  const filePath = path.join(process.cwd(), "content/docs/overview-explorer.md");
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "# About the Metascience Observatory Explorer\n\nContent coming soon.";
  }
}

export default function ExplorerOverviewPage() {
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
