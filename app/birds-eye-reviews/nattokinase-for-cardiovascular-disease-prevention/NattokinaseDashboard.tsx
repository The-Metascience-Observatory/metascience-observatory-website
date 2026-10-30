"use client";

import { DashboardShell, adaptForestGroups } from "@/components/birds-eye-dashboard";
import type { DashboardSummary, DashboardManifest, TrialRow, PrismaData } from "@/components/birds-eye-dashboard";
import type { ScientificComparison } from "@/components/birds-eye-dashboard/summary";

export function NattokinaseDashboard({ summary, manifest, rows, prisma, meta }: {
  summary: DashboardSummary;
  manifest: DashboardManifest;
  rows: TrialRow[];
  prisma: PrismaData;
  meta: { groups: unknown[]; withheld: ScientificComparison[]; min_trials: number };
}) {
  // These panels are hidden on this page; filtering here (not in the bundle)
  // keeps them hidden when the data is republished.
  const hidden = new Set(["feasibility", "outcome_domains"]);
  const shown = { ...manifest, panels_rendered: manifest.panels_rendered?.filter(p => !hidden.has(p.key)) };
  return <DashboardShell
    summary={summary}
    manifest={shown}
    rows={rows}
    prisma={prisma}
    metaGroups={adaptForestGroups(meta.groups)}
    metaMinTrials={meta.min_trials}
    withheldComparisons={meta.withheld}
    audit={false}
    compactInterventions
  />;
}
