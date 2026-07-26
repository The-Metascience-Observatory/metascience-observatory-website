import fs from "fs";
import path from "path";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MarkdownContent } from "@/components/MarkdownContent";
import { DocsBackLink } from "@/components/DocsBackLink";

export const metadata = {
  title: "The Replications Database | The Metascience Observatory",
  description:
    "A public database of experimental replications across all of science, enabling research on how reproducibility varies across fields.",
};

function getMarkdownContent(): string {
  const filePath = path.join(process.cwd(), "content/docs/overview-replication-database.md");
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "# The Replications Database\n\nContent coming soon.";
  }
}

export default function ReplicationDatabaseOverviewPage() {
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
