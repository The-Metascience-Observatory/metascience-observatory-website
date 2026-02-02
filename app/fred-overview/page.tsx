"use client";

import { useEffect, useMemo, useState } from "react";

type AnyRecord = Record<string, unknown>;

type FredResponse = {
  columns: string[];
  rows: AnyRecord[];
};

export default function FredOverviewPage() {
  const [data, setData] = useState<FredResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<
    "discipline" | "success" | "failure" | "inconclusive" | "total" | "successPct" | "failurePct"
  >("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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

  const byDiscipline = useMemo(() => {
    const counts = new Map<string, { success: number; failure: number; inconclusive: number }>();
    if (!data) return [] as Array<{ discipline: string; success: number; failure: number; inconclusive: number; successPct: number; failurePct: number; total: number }>;
    for (const r of data.rows) {
      const raw = String(r.discipline ?? "");
      const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
      const disciplines = parts.length > 0 ? parts : [""];
      const res = String(r.result ?? "").toLowerCase();
      for (const d of disciplines) {
        const entry = counts.get(d) || { success: 0, failure: 0, inconclusive: 0 };
        if (res.includes("success")) entry.success++;
        else if (res.includes("failure")) entry.failure++;
        else entry.inconclusive++;
        counts.set(d, entry);
      }
    }
    const list = Array.from(counts.entries()).map(([discipline, v]) => {
      const total = v.success + v.failure + v.inconclusive;
      const failurePct = total > 0 ? Math.round((v.failure / total) * 1000) / 10 : 0;
      const successPct = total > 0 ? Math.round((v.success / total) * 1000) / 10 : 0;
      return { discipline, ...v, successPct, failurePct, total };
    });
    list.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "discipline") return dir * a.discipline.localeCompare(b.discipline);
      const aa = a as unknown as Record<string, number | string>;
      const bb = b as unknown as Record<string, number | string>;
      const av = (aa[sortKey] ?? 0) as number;
      const bv = (bb[sortKey] ?? 0) as number;
      return dir * (bv - av);
    });
    return list;
  }, [data, sortKey, sortDir]);

  function header(label: string, key: typeof sortKey) {
    const isActive = sortKey === key;
    const arrow = isActive ? (sortDir === "asc" ? "▲" : "▼") : "";
    return (
      <button
        type="button"
        className="underline decoration-dotted underline-offset-4"
        onClick={() => {
          if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
          else {
            setSortKey(key);
            setSortDir(key === "discipline" ? "asc" : "desc");
          }
        }}
      >
        {label} {arrow}
      </button>
    );
  }

  if (loading) return <main className="min-h-screen px-6 py-10">Loading…</main>;
  if (error || !data) return <main className="min-h-screen px-6 py-10">Failed to load: {error || "No data"}</main>;

  return (
    <main className="min-h-screen px-6 sm:px-8 md:px-12 lg:px-16 xl:px-24 py-10 space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Fields Overview</h1>
        <p className="mt-2 text-sm opacity-70">Summary statistics from the FORRT Replication Database (<a className="underline" href="https://forrt.org/apps/fred_explorer.html" target="_blank" rel="noreferrer">link</a>).</p>
      </div>

      <section className="border rounded p-4">
        <div className="font-medium">Outcomes by discipline</div>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-black/5 dark:bg-white/5">
                <th className="text-left p-2">{header("Discipline", "discipline")}</th>
                <th className="text-right p-2">{header("Success", "success")}</th>
                <th className="text-right p-2">{header("Failure", "failure")}</th>
                <th className="text-right p-2">{header("Inconcl.", "inconclusive")}</th>
                <th className="text-right p-2">{header("Total", "total")}</th>
                <th className="text-right p-2">{header("Success %", "successPct")}</th>
                <th className="text-right p-2">{header("Failure %", "failurePct")}</th>
              </tr>
            </thead>
            <tbody>
              {byDiscipline.map((d) => (
                <tr key={d.discipline} className="border-b">
                  <td className="p-2">{d.discipline || "Unspecified"}</td>
                  <td className="p-2 text-right">{d.success}</td>
                  <td className="p-2 text-right">{d.failure}</td>
                  <td className="p-2 text-right">{d.inconclusive}</td>
                  <td className="p-2 text-right">{d.total}</td>
                  <td className="p-2 text-right">{d.successPct}%</td>
                  <td className="p-2 text-right">{d.failurePct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border rounded p-4 text-sm space-y-2">
        <div className="font-medium">Attribution and License</div>
        <p className="opacity-80">
          Data shown here are derived from the FReD replication dataset as described in Röseler et al., Journal of Open Psychology Data, 12: 8, pp. 1–23. DOI: https://doi.org/10.5334/jopd.101. Repository link: https://osf.io/9r62x (DOI: https://doi.org/10.17605/OSF.IO/9R62X).
        </p>
        <p className="opacity-80">
          © 2024 The Author(s). Licensed under Creative Commons Attribution 4.0 International (CC‑BY 4.0). You must credit the original author(s) and source if you use these data.
        </p>
      </section>
    </main>
  );
}


