import fs from "fs";
import path from "path";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MarkdownContent } from "@/components/MarkdownContent";
import { DocsBackLink } from "@/components/DocsBackLink";

function getMarkdownContent(): string {
  const filePath = path.join(process.cwd(), "content/docs/what-weve-learned.md");
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "# What we've learned so far\n\nContent coming soon.";
  }
}

export default function WhatWeveLearnedPage() {
  const content = getMarkdownContent();

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-4 py-12 max-w-3xl">
          <DocsBackLink />
          <MarkdownContent content={content} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
