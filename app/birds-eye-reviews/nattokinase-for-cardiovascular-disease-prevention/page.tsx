import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { BirdsEyeNavbar } from "@/components/BirdsEyeNavbar";
import { Footer } from "@/components/Footer";
import { SCIENTIFIC_RULES_VERSION } from "@/components/birds-eye-dashboard/summary";
import type { DashboardSummary, DashboardManifest, TrialRow, PrismaData } from "@/components/birds-eye-dashboard";
import type { ScientificComparison } from "@/components/birds-eye-dashboard/summary";
import { NattokinaseDashboard } from "./NattokinaseDashboard";

export const metadata = {
  title: "Nattokinase | Bird’s Eye Reviews | The Metascience Observatory",
  description: "Explore 12 nattokinase studies, comparison-specific results, source validation, and the limitations preventing meta-analysis.",
};

export default function NattokinasePage() {
  const dir = path.join(process.cwd(), "data/birds_eye_reviews/nattokinase_for_cardiovascular_disease_prevention");
  const read = (name: string) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
  const summary = read("summary.json") as DashboardSummary;
  const manifest = read("dashboard.manifest.json") as DashboardManifest;
  const prisma = read("prisma.json") as PrismaData;
  const meta = read("meta_analysis.json") as {
    rules_version: string; groups: unknown[]; withheld: ScientificComparison[]; min_trials: number;
  };
  const rows = fs.readFileSync(path.join(dir, "dashboard_rows.jsonl"), "utf8")
    .trim().split("\n").filter(Boolean).map(line => JSON.parse(line) as TrialRow);
  if (summary.scientific_rules_version !== SCIENTIFIC_RULES_VERSION || meta.rules_version !== SCIENTIFIC_RULES_VERSION) {
    throw new Error("Nattokinase bundle requires scientific validation and rebuilding before publication");
  }
  const updated = read("last_updated.json") as { last_updated_display: string };

  return <div className="min-h-screen">
    <BirdsEyeNavbar />
    <main className="mx-auto max-w-[1440px] px-4 pt-24 pb-12 sm:px-8">
      <Link href="/birds-eye-reviews" className="text-sm text-primary hover:underline">← All Bird’s Eye Reviews</Link>
      <h1 className="mt-4 text-2xl sm:text-3xl font-bold font-clarendon">Nattokinase and cardiovascular outcomes</h1>
      <p className="mt-2 mb-4 text-sm text-muted-foreground">12 studies · Updated {updated.last_updated_display}</p>
      <p className="mb-6 max-w-4xl text-sm text-muted-foreground">
        This review retains individual studies while withholding invalid or unresolved estimates from pooling.
        The current evidence has no compatible multi-study pool. Historical screening records contain
        unresolved inconsistencies, detailed in the screening flow below.
      </p>
      <NattokinaseDashboard summary={summary} manifest={manifest} rows={rows} prisma={prisma} meta={meta} />
    </main>
    <Footer />
  </div>;
}
