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
          <MarkdownContent content={content} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
