"use client";

import { useEffect, useState } from "react";
import type { EvidenceRow } from "./types";
import { fmt, quoteText, verificationLabel } from "./labels";

export const EVIDENCE_URL = "/birds-eye-reviews/post-viral-symptoms/evidence";

const cache = new Map<string, Promise<EvidenceRow[]>>();

/** Fetch the CSV rows behind a set of row ids (memoised per id list). */
export function fetchRows(ids: string[]): Promise<EvidenceRow[]> {
  const key = ids.join(",");
  let p = cache.get(key);
  if (!p) {
    p = fetch(`${EVIDENCE_URL}?rows=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { rows: EvidenceRow[] }) => j.rows);
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

function RowQuote({ row }: { row: EvidenceRow }) {
  const isContrast = row._kind === "contrast";
  const n = row.numerator && row.denominator ? `${row.numerator}/${row.denominator}` : row.denominator ? `N = ${row.denominator}` : "";
  return (
    <div className="rounded border border-border bg-muted/30 p-2">
      <p className="text-[11px] text-muted-foreground">
        <span className="font-mono">{row.row_id?.split("#")[1]}</span>
        {" · "}
        {isContrast
          ? <>{row.group_label} <em>vs</em> {row.comparator_group_label}: {row.measure?.replace(/_/g, " ")} {row.value}{row.ci_low && row.ci_high ? ` (${row.ci_low} to ${row.ci_high})` : ""}{row.adjusted === "True" ? " · adjusted" : ""}</>
          : <>{row.group_label}: {row.value_operator === "<" ? "<" : ""}{fmt(Number(row.percent_value))}%{n ? ` (${n})` : ""}</>}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        <strong className="font-medium text-foreground/80">Outcome:</strong> {row.outcome_label}
        {row.time_label ? <> · <strong className="font-medium text-foreground/80">Time:</strong> {row.time_label}</> : null}
      </p>
      <blockquote className="mt-1 whitespace-pre-line border-l-2 border-foreground/30 pl-2 text-xs italic text-foreground">
        &ldquo;{quoteText(row.quote)}&rdquo;
      </blockquote>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {row.location ? <>Location: {row.location} · </> : null}
        Confidence {row.confidence || "—"} · {verificationLabel(row.verification_status)}
        {row.value_source ? <> · value {row.value_source}</> : null}
        {row.excluded_reason ? <> · <span className="text-red-800">excluded: {row.excluded_reason}</span></> : null}
      </p>
    </div>
  );
}

/** The verbatim quotes behind one number, fetched when first shown. */
export function EvidenceQuotes({ ids }: { ids: string[] }) {
  const key = ids.join(",");
  const [state, setState] = useState<{ key: string; rows?: EvidenceRow[]; error?: boolean }>({ key });

  useEffect(() => {
    let live = true;
    setState({ key });
    fetchRows(key.split(","))
      .then((rows) => live && setState({ key, rows }))
      .catch(() => live && setState({ key, error: true }));
    return () => {
      live = false;
    };
  }, [key]);

  if (state.error) return <p className="text-xs text-red-800">Could not load the source quote.</p>;
  if (!state.rows || state.key !== key) return <p className="text-xs text-muted-foreground">Loading source quote…</p>;
  if (state.rows.length === 0) return <p className="text-xs text-muted-foreground">No source row found for {key}.</p>;
  return (
    <div className="space-y-2">
      {state.rows.map((r) => <RowQuote key={r.row_id} row={r} />)}
    </div>
  );
}

/** A disclosure that loads the quotes only when opened. */
export function QuoteToggle({ ids, label = "Show source quote" }: { ids: string[]; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-xs text-blue-700 underline underline-offset-2 hover:text-blue-900"
      >
        {open ? "Hide source quote" : label}
      </button>
      {open && <div className="mt-1"><EvidenceQuotes ids={ids} /></div>}
    </div>
  );
}
