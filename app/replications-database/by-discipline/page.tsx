"use client";

import { useEffect, useMemo, useState } from "react";
import { ReplicationsNavbar } from "@/components/ReplicationsNavbar";
import { Footer } from "@/components/Footer";

type AnyRecord = Record<string, unknown>;

type FredResponse = {
  columns: string[];
  rows: AnyRecord[];
};

type DisciplineRow = {
  discipline: string;
  success: number;
  failure: number;
  inconclusive: number;
  total: number;
  successPct: number;
  failurePct: number;
  inconclusivePct: number;
};

export default function ByDisciplinePage() {
  const [data, setData] = useState<FredResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/fred", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as FredResponse;
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const byDiscipline: DisciplineRow[] = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, { success: number; failure: number; inconclusive: number }>();

    for (const r of data.rows) {
      const raw = String(r.discipline ?? "");
      const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
      const disciplines = parts.length > 0 ? parts : ["Unspecified"];
      const res = String(r.result ?? "").toLowerCase();

      for (const d of disciplines) {
        const entry = counts.get(d) || { success: 0, failure: 0, inconclusive: 0 };
        if (res.includes("success")) entry.success++;
        else if (res.includes("failure")) entry.failure++;
        else entry.inconclusive++;
        counts.set(d, entry);
      }
    }

    return Array.from(counts.entries())
      .map(([discipline, v]) => {
        const total = v.success + v.failure + v.inconclusive;
        return {
          discipline,
          ...v,
          total,
          successPct: total > 0 ? (v.success / total) * 100 : 0,
          failurePct: total > 0 ? (v.failure / total) * 100 : 0,
          inconclusivePct: total > 0 ? (v.inconclusive / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const totalRows = data?.rows.length ?? 0;

  if (loading) return <main className="min-h-screen px-6 py-10">Loading…</main>;
  if (error || !data) return <main className="min-h-screen px-6 py-10">Failed to load: {error || "No data"}</main>;

  return (
    <div className="min-h-screen flex flex-col">
      <ReplicationsNavbar />
      <main className="pt-24 px-6 sm:px-8 md:px-12 lg:px-16 xl:px-24 py-10 flex-1">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Replication Success by Discipline
            </h1>
          </div>

          {/* Legend */}
          <div className="flex gap-6 text-sm">
            <span className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded" style={{ background: "#10b981" }} /> Success
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded" style={{ background: "#f87171" }} /> Failure
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded" style={{ background: "#9ca3af" }} /> Inconclusive
            </span>
          </div>

          {/* Bars */}
          <div className="space-y-3">
            {byDiscipline.map((d) => (
              <div key={d.discipline} className="flex items-center gap-3">
                <span className="w-48 text-sm text-right truncate shrink-0" title={d.discipline}>
                  {d.discipline}
                </span>
                <div className="flex-1 h-7 flex rounded overflow-hidden bg-gray-100 dark:bg-gray-800 text-xs font-medium text-white">
                  {d.successPct > 0 && (
                    <div
                      className="h-full transition-all flex items-center justify-center overflow-hidden"
                      style={{ width: `${d.successPct}%`, background: "#10b981" }}
                      title={`Success: ${d.success} (${d.successPct.toFixed(1)}%)`}
                    >
                      {d.successPct >= 10 && `${d.successPct.toFixed(0)}%`}
                    </div>
                  )}
                  {d.failurePct > 0 && (
                    <div
                      className="h-full transition-all flex items-center justify-center overflow-hidden"
                      style={{ width: `${d.failurePct}%`, background: "#f87171" }}
                      title={`Failure: ${d.failure} (${d.failurePct.toFixed(1)}%)`}
                    >
                      {d.failurePct >= 10 && `${d.failurePct.toFixed(0)}%`}
                    </div>
                  )}
                  {d.inconclusivePct > 0 && (
                    <div
                      className="h-full transition-all flex items-center justify-center overflow-hidden"
                      style={{ width: `${d.inconclusivePct}%`, background: "#9ca3af" }}
                      title={`Inconclusive: ${d.inconclusive} (${d.inconclusivePct.toFixed(1)}%)`}
                    >
                      {d.inconclusivePct >= 10 && `${d.inconclusivePct.toFixed(0)}%`}
                    </div>
                  )}
                </div>
                <span className="w-28 text-sm text-right tabular-nums shrink-0">
                  {d.total} ({totalRows > 0 ? (d.total / totalRows * 100).toFixed(0) : 0}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
