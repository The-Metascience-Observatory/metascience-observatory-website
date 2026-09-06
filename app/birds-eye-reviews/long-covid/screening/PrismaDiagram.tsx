import { ArrowDown, ArrowRight } from "lucide-react";
import type { ScreeningCounts } from "./screening-counts";

function Box({ title, n, sub }: { title: string; n: number; sub?: string }) {
  return (
    <div className="border border-border rounded-lg bg-white px-4 py-3 text-center shadow-sm">
      <div className="text-2xl font-bold leading-none">{n.toLocaleString()}</div>
      <div className="text-sm mt-1">{title}</div>
      {sub && <div className="text-xs text-foreground/70 mt-2">{sub}</div>}
    </div>
  );
}
function Stage({ title, n, sub, excluded }: {
  title: string; n: number; sub?: string; excluded?: { title: string; n: number };
}) {
  return (
    <div className="grid md:grid-cols-2 gap-3 md:gap-0 items-center">
      <Box title={title} n={n} sub={sub} />
      {excluded && <div className="flex items-center md:pr-2">
        <ArrowRight aria-hidden="true" className="hidden md:block shrink-0 mx-2 text-foreground/40" size={22} />
        <div className="border border-dashed border-border rounded-lg bg-foreground/[0.03] px-3 py-3 text-sm flex-1">
          <strong>{excluded.n.toLocaleString()}</strong> — {excluded.title}
        </div>
      </div>}
    </div>
  );
}
function DownArrow() {
  return <div className="grid md:grid-cols-2"><div className="flex justify-center py-2 text-foreground/40"><ArrowDown aria-hidden="true" size={22} /></div></div>;
}

/** Auditable snapshot accounting; the legacy artifacts do not support a full PRISMA flow. */
export function PrismaDiagram({ counts: c }: { counts: ScreeningCounts }) {
  const allReasons = Object.entries(c.reasons).sort((a, b) => b[1] - a[1]);
  const reasons = allReasons.slice(0, 6);
  const remaining = allReasons.slice(6).reduce((sum, [, n]) => sum + n, 0);
  return (
    <section className="border border-border rounded-lg bg-white p-4 md:p-6 mb-8" aria-labelledby="screening-flow-title">
      <h2 id="screening-flow-title" className="text-lg font-semibold mb-2">Screening flow</h2>
      <p className="text-sm text-foreground/70 mb-5">
        Counts below use the currently exported screening and extraction files. Legacy trial screening used abstracts,
        with a PDF excerpt fallback; a screening record does not establish full-text retrieval or confirmed eligibility.
        Search, retrieval and extraction records have not been reconciled into a complete PRISMA flow.
      </p>

      <aside className="border border-amber-300 rounded-lg bg-amber-50 p-4 mb-6" aria-labelledby="retrieval-title">
        <h3 id="retrieval-title" className="font-semibold">Full text not obtained automatically — historical retrieval failures</h3>
        <div className="text-3xl font-bold mt-2">{c.historicalFailures.toLocaleString()}</div>
        <p className="text-sm mt-2">
          Reports listed in the retrieval-failure log dated {c.retrievalDate}.
          Of these, {c.historicalNowExported.toLocaleString()} now have exported extractions;
          {" "}{c.historicalWithoutExtraction.toLocaleString()} have no matching exported extraction.
        </p>
        <p className="text-sm text-foreground/75 mt-2">
          This historical list is not a current count of eligible studies excluded solely because full text was unavailable.
          Later retrieval, eligibility decisions and extraction progress may differ. The current total excluded for unavailable full text is not established.
        </p>
        <a className="inline-block text-sm text-blue-700 underline mt-2" href="/api/screening/retrieval-failures">Download dated DOI list and provenance (JSON)</a>
      </aside>

      <div className="max-w-3xl mx-auto">
        <h3 className="font-semibold mb-3">Screening records</h3>
        <Stage title="Reports with a screening record" n={c.screened} excluded={{ title: "flagged excluded in screening", n: c.excluded }} />
        <DownArrow />
        <Stage title="Reports not flagged excluded" n={c.retained}
          sub={`${c.explicitNo.toLocaleString()} explicitly marked not excluded; ${c.unresolved.toLocaleString()} have an unresolved exclusion flag. Neither establishes eligibility.`}
          excluded={{ title: "without a matching exported extraction; the reason is not established", n: c.retainedWithoutExtraction }} />
        <DownArrow />
        <Stage title="Reports not flagged excluded with an exported extraction" n={c.retainedWithExtraction} />
        <details className="text-sm mt-4 mb-6">
          <summary className="cursor-pointer">Recorded screening exclusion reasons ({c.excluded.toLocaleString()})</summary>
          <ul className="mt-2 space-y-1">
            {reasons.map(([reason, n]) => <li key={reason}>{reason.replace(/_/g, " ")}: {n.toLocaleString()}</li>)}
            {remaining > 0 && <li>Remaining recorded reasons: {remaining.toLocaleString()}</li>}
          </ul>
          <p className="mt-2 text-foreground/70">Reasons are automated screening labels. “Unspecified” means no reason was recorded.</p>
        </details>

        <h3 className="font-semibold mb-2">Exported extraction records and dashboard availability</h3>
        <p className="text-sm text-foreground/70 mb-3">
          This separate accounting includes all exported extraction rows, including any previously excluded reports.
          A report can have multiple extraction rows; reports are not necessarily independent studies.
        </p>
        <Stage title="Exported extraction records" n={c.exported}
          excluded={{ title: "removed by dashboard filters", n: c.exportedExcluded + c.exportedInvalid }} />
        <p className="text-xs text-foreground/70 mt-2 mb-2">
          Removed: {c.exportedExcluded.toLocaleString()} flagged excluded in screening;
          {" "}{c.exportedInvalid.toLocaleString()} additional records with missing study design or a non-clinical-trial label.
          {" "}{c.exportedUnscreened.toLocaleString()} exported records lack a matching screening record.
        </p>
        <DownArrow />
        <Stage title="Extraction records available to the dashboard" n={c.dashboardRecords}
          sub={`${c.dashboardReports.toLocaleString()} distinct report DOIs; before publication-version preference and interactive filters.`} />
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <Box title="Flagged randomized" n={c.randomized} />
          <Box title="Other / not flagged randomized" n={c.other} />
        </div>
        <p className="text-xs text-foreground/70 mt-3">
          Design flags are inherited from extraction and require validation; “not flagged randomized” does not establish an observational design.
          Dashboard filters can reduce the number shown. Counts follow the distinction between records, reports and studies in the
          {" "}<a href="https://www.prisma-statement.org/prisma-2020-flow-diagram" className="text-blue-700 underline">PRISMA 2020 guidance</a>.
        </p>
      </div>
    </section>
  );
}
