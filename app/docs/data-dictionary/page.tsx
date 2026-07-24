import fs from "fs";
import path from "path";
import { csvParse } from "d3-dsv";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MarkdownContent } from "@/components/MarkdownContent";
import { DocsBackLink } from "@/components/DocsBackLink";

function escapeMarkdown(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function buildMarkdownFromCSV(): string {
  const csvPath = path.join(process.cwd(), "data/data_dictionary.csv");
  const raw = fs.readFileSync(csvPath, "utf-8");
  const rows = csvParse(raw);

  const header = `# Data Dictionary

This page documents the columns in the [Replications Database](/replications-database). Each row in the database represents a single effect from an original study paired with a replication attempt of that effect.

| Column Name | Type | Required? | Description |
|-------------|------|-----------|-------------|`;

  const tableRows = rows
    .map((row) => {
      const name = row["column_name"] ?? "";
      const type = row["type"] ?? "";
      const required = row["required?"] ?? "";
      const description = row["description"] ?? "";
      return `| \`${escapeMarkdown(name)}\` | ${escapeMarkdown(type)} | ${escapeMarkdown(required)} | ${escapeMarkdown(description)} |`;
    })
    .join("\n");

  return `${header}\n${tableRows}`;
}

export default function DataDictionaryPage() {
  const content = buildMarkdownFromCSV();

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-6 py-12 max-w-6xl">
          <DocsBackLink href="/articles" label="return to articles" />
          <MarkdownContent content={content} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
