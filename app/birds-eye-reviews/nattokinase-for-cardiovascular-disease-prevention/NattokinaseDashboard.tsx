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
  return <DashboardShell
    summary={summary}
    manifest={manifest}
    rows={rows}
    prisma={prisma}
    metaGroups={adaptForestGroups(meta.groups)}
    metaMinTrials={meta.min_trials}
    withheldComparisons={meta.withheld}
    audit={false}
  />;
}
