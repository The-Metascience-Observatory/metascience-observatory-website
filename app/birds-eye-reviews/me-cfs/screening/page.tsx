import {reviewDataPath} from "@/lib/birds-eye-reviews/data";
import {loadRows} from "@/lib/birds-eye-reviews/mecfs-screening";
import { publicationFor } from "@/lib/long-covid/publications-server";
import type { PublicationMetadata } from "@/lib/long-covid/publications";
import fs from "fs";
import path from "path";
import { BirdsEyeNavbar } from "@/components/BirdsEyeNavbar";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import { ArticleTypeBar } from "../../long-covid/screening/ScreeningFunnelChart";
import { ScreeningClientWrapper } from "../../long-covid/screening/ScreeningClientWrapper";
import {PrismaFlow,type PrismaData} from "@/components/birds-eye-dashboard/PrismaFlow";


export const metadata = {
  title: "Trial Screening | ME/CFS | Bird's Eye Reviews | The Metascience Observatory",
  description:
    "Screening decisions and pending work across the ME/CFS research corpus.",
};

function computeArticleTypeBars(rows: ReturnType<typeof loadRows>): { bars: ArticleTypeBar[]; totalTreatment: number } {
  const folderCounts = new Map<string, { total: number; treatment: number }>();
  for (const r of rows) {
    const folder = r.source_folder || "Unknown";
    const entry = folderCounts.get(folder) ?? { total: 0, treatment: 0 };
    entry.total++;
    if (r.studies_treatment === "yes") entry.treatment++;
    folderCounts.set(folder, entry);
  }

  const totalArticles = rows.length;
  const totalTreatment = rows.filter((r) => r.studies_treatment === "yes").length;

  const bars: ArticleTypeBar[] = [...folderCounts.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([label, { total, treatment }]) => ({
      label,
      total,
      treatment,
      pct: ((total / totalArticles) * 100).toFixed(1),
      totalLabel: treatment > 0
        ? `${total.toLocaleString()}  (${((total / totalArticles) * 100).toFixed(1)}%) \u2014 ${treatment.toLocaleString()} treatment`
        : `${total.toLocaleString()}  (${((total / totalArticles) * 100).toFixed(1)}%)`,
    }));

  return { bars, totalTreatment };
}

export default function ScreeningPage() {
  const allRows = loadRows();
  const initialRows = allRows.slice(0, 100);
  const { bars, totalTreatment } = computeArticleTypeBars(allRows);
  const prisma=JSON.parse(fs.readFileSync(reviewDataPath("me-cfs","prisma.json"),"utf8")) as PrismaData;

  return (
    <>
      <BirdsEyeNavbar />
      <main className="container mx-auto px-4 pt-24 pb-16 min-h-screen [--border:215_15%_76%]">
        <div className="mb-2">
          <Link
            href="/birds-eye-reviews/me-cfs"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            &larr; Back to ME/CFS Dashboard
          </Link>
        </div>

        <h1 className="font-clarendon font-bold text-3xl mb-6">
          ME/CFS Trial Screening
        </h1>

        <p className="mb-4 text-sm text-muted-foreground">All screened ME/CFS records remain available here. The treatment dashboard includes only explicitly classified treatment reports; pending decisions remain visible below.</p>
        <PrismaFlow data={prisma} />

        <ScreeningClientWrapper
          bars={bars}
          apiBase="/api/me-cfs/screening"
          reviewLabel="ME/CFS"
          totalArticles={allRows.length}
          totalTreatment={totalTreatment}
          initialRows={initialRows}
          sourceFolders={bars.map((b) => b.label)}
        />
      </main>
      <Footer />
    </>
  );
}
