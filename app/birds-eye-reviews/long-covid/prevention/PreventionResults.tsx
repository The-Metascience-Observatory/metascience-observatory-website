"use client";
import { useMemo } from 'react';
import Link from 'next/link';
import { BirdsEyeNavbar } from '@/components/BirdsEyeNavbar';
import { Footer } from '@/components/Footer';
import { BreakdownChart } from '@/components/BreakdownChart';
import { VERDICT_SEGMENTS, interventionVerdictsFromRows } from '../constants';
import type { TrialTableRow } from '../types';
import type { PrevRow } from './page';
import { matchesPublication, preferPublished, metadataCounts } from '@/lib/long-covid/publications';
import { PublicationFilters, PublicationDetails, usePublicationFilters } from '../PublicationFilters';
const VERDICT_COLOR: Record<string,string> = Object.fromEntries(VERDICT_SEGMENTS.map(s=>[s.key,s.color]));
const VERDICT_LABEL: Record<string,string> = Object.fromEntries(VERDICT_SEGMENTS.map(s=>[s.key,s.label]));
function citationTail(r: PrevRow): string {
  let s = r.journal || "";
  if (r.year) s += `${s ? " " : ""}${r.year}`;
  if (r.volume) s += `;${r.volume}`;
  if (r.issue) s += `(${r.issue})`;
  if (r.pages) s += `:${r.pages}`;
  return s ? s + "." : "";
}
export function PreventionResults({initialData}:{initialData: {rows:PrevRow[];chartRows:TrialTableRow[]} | null}) {
  const filters=usePublicationFilters();
  const baseRows=useMemo(()=>preferPublished(initialData?.rows ?? []),[initialData]);
  const rows=useMemo(()=>baseRows.filter(r=>matchesPublication(r.publicationMetadata,filters.medline,filters.publication)),[baseRows,filters.medline,filters.publication]);
  const ids=new Set(rows.map(r=>r.paper_id));
  const data=initialData ? {...interventionVerdictsFromRows(initialData.chartRows.filter(r=>ids.has(r.paper_id))),rows} : null;

  return (
    <div className="min-h-screen">
      <BirdsEyeNavbar subtitle="Long Covid" />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-2 py-8 max-w-7xl">
          <Link href="/birds-eye-reviews/long-covid" className="text-sm text-blue-600 hover:text-blue-700 mb-3 inline-block">
            &larr; Long Covid treatment trials
          </Link>

          <h1 className="font-clarendon font-bold text-3xl mb-1">Long Covid — Prevention Trials</h1>
          <p className="text-sm text-foreground/70 max-w-3xl mb-6">
            Note: this listing covers many trials we picked up while searching for Long COVID research, but is
            not comprehensive.
          </p>

          <PublicationFilters {...filters} counts={metadataCounts(baseRows,filters.medline,filters.publication)} checkedAt={baseRows.find(r=>r.publicationMetadata?.medlineCheckedAt)?.publicationMetadata?.medlineCheckedAt}/>
          {!data || data.rows.length === 0 ? (
            <div className="border border-border rounded-lg bg-white p-8 text-center text-foreground/60">
              No prevention reports match these filters. Reset the publication filters or adjust your selection.
            </div>
          ) : (
            <>
              {Object.keys(data.byNameVerdicts).length > 0 && (
                <BreakdownChart
                  title="Prevention trials by intervention"
                  breakdown={data.byNameVerdicts}
                  segments={VERDICT_SEGMENTS}
                  hoverTrials={data.trialsByName}
                  collapseSingletons
                  collapseMaxTrials={2}
                />
              )}

              {/* Trials table */}
              <div className="border border-border rounded-lg bg-white p-3 sm:p-4 mt-2 overflow-x-auto">
                <h2 className="text-lg font-semibold mb-3">Matching prevention reports ({data.rows.length})</h2>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border text-left text-foreground/60">
                      <th className="p-2">Reference</th>
                      <th className="p-2">Intervention(s)</th>
                      <th className="p-2">Design</th>
                      <th className="p-2 text-right">N</th>
                      <th className="p-2">Primary outcome</th>
                      <th className="p-2">Result</th>
                      <th className="p-2">Countries</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr key={r.paper_id} className="border-b border-border/50 align-top">
                        <td className="p-2 align-top">
                          <div className="max-w-[30rem] min-w-[18rem] leading-snug">
                            <a href={r.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-700 hover:underline font-medium">
                              {r.title || r.paper_id}
                            </a>
                            <PublicationDetails meta={r.publicationMetadata}/>
                            {r.authors && (
                              <div className="text-xs text-foreground/60 mt-0.5">{r.authors}</div>
                            )}
                            {(citationTail(r) || r.year) && (
                              <div className="text-xs text-foreground/45 italic mt-0.5">{citationTail(r) || String(r.year)}</div>
                            )}
                          </div>
                        </td>
                        <td className="p-2">{r.interventionNames.join(", ") || "—"}</td>
                        <td className="p-2 whitespace-nowrap">{r.design}</td>
                        <td className="p-2 text-right tabular-nums">{r.n != null ? r.n.toLocaleString() : "—"}</td>
                        <td className="p-2 max-w-[20rem]">{r.primaryOutcome || "—"}</td>
                        <td className="p-2 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: VERDICT_COLOR[r.verdict] ?? "#e2e8f0" }} />
                            <span className="text-xs text-foreground/70">{VERDICT_LABEL[r.verdict] ?? "Result unknown"}</span>
                          </span>
                        </td>
                        <td className="p-2 text-xs text-foreground/60 max-w-[12rem]">{r.countries.join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
