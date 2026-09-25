"use client";

import {
  inspectDescriptions, inspectLabel, inspectOptions, parseInspectFilter,
  type InspectAssessment, type InspectFilter,
} from "@/lib/long-covid/inspect";

export function InspectFilters({ value, onChange, counts, assessedAt, assessedCount, totalCount }: {
  value: InspectFilter;
  onChange: (value: InspectFilter) => void;
  counts: Record<InspectFilter, number>;
  assessedAt?: string;
  assessedCount: number;
  totalCount: number;
}) {
  return (
    <section aria-label="INSPECT-SR review selection" className="mb-4 rounded-lg border border-border bg-foreground/[0.02] p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 max-w-full flex-col gap-1 text-sm font-medium">
          INSPECT-SR review filter
          <select aria-label="INSPECT-SR review filter" aria-describedby="inspect-description" value={value} onChange={e => onChange(parseInspectFilter(e.target.value))}
            className="max-w-full rounded border border-border bg-background px-2 py-1.5 text-sm font-normal">
            {inspectOptions.map(([key, label]) => <option key={key} value={key}>{label} ({counts[key]})</option>)}
          </select>
        </label>
        <button type="button" onClick={() => onChange("all")} disabled={value === "all"}
          className="text-sm text-primary underline disabled:opacity-40">Reset review filter</button>
      </div>
      <p id="inspect-description" className="mt-2 text-sm text-foreground/80">{inspectDescriptions[value]}</p>
      <p className="mt-1 text-xs text-foreground/60">
        {assessedAt ? `Assessment snapshot: ${assessedAt.slice(0, 10)}. ` : "No assessment snapshot available. "}
        {assessedCount} of {totalCount} reports have saved review decisions. Option counts reflect the other dashboard filters.
        {" "}INSPECT-SR assesses randomized-trial trustworthiness; treatment eligibility and retraction checks are separate.
        {" "}Automated concerns require human review and do not establish misconduct.
        {" "}<a href="https://inspect-sr.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Method</a>
      </p>
    </section>
  );
}

/** Separate disclosure leaves the dashboard's article-detail navigation intact. */
export function InspectDetails({ meta }: { meta?: InspectAssessment }) {
  if (!meta) return <p className="mt-1 text-[11px] text-foreground/70">Review: not assessed</p>;
  const applicable = meta.eligibility === "randomized_trial";
  return (
    <details className="mt-1 text-xs" onClick={event => event.stopPropagation()} data-testid="inspect-details">
      <summary className="cursor-pointer text-[11px] text-foreground/70">Review: {inspectLabel(meta)}</summary>
      <div className="mt-2 min-w-[220px] max-w-lg rounded border border-border p-3">
        <p>{meta.humanReviewed ? "Human adjudication recorded." : `Provisional automated assessment (${meta.machineReviewers} machine review${meta.machineReviewers === 1 ? "" : "s"}); human adjudication pending.`}</p>
        {meta.selectionReason && <p className="mt-1">Screening reason: {meta.selectionReason.replace(/_/g, " ")}</p>}
        {meta.duplicateOf && <p className="mt-1">Duplicate of: {meta.duplicateOf}</p>}
        {meta.eligibilityReason && <p className="mt-1">Eligibility: {meta.eligibilityReason}</p>}
        {meta.scopeReason && <p className="mt-1">Treatment scope: {meta.scopeReason}</p>}
        <p className="mt-1">INSPECT-SR {meta.humanReviewed ? "adjudicated" : "first assessment"}: {applicable ? meta.judgment : "not applied to this report’s assessed design / eligibility"}.</p>
        {meta.judgmentReason && <p className="mt-1">{meta.judgmentReason}</p>}
        {meta.disagreementCount > 0 && <p className="mt-1">{meta.disagreementCount} differences between assessments remain unresolved; the first rating is not a consensus judgment.</p>}
        {meta.disposition === "serious_concerns_awaiting_resolution" && <p className="mt-1">At least one assessment raised serious concerns. The report is held pending review, including when the first assessment was less severe.</p>}
        {meta.withheldFindingCount > 0 && <p className="mt-1">{meta.withheldFindingCount} extracted findings were withheld from the review after source validation failed. Existing dashboard outcome values have not been revalidated by this filter.</p>}
        {meta.retractionFlag && <p className="mt-1">Retraction status: {meta.retractionConfirmed ? "publisher notice confirmed; excluded from effectiveness synthesis" : "flagged; notice verification pending"}.</p>}
        {meta.humanReason && <p className="mt-1">Human decision: {meta.humanReason}</p>}
      </div>
    </details>
  );
}
