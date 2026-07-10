import { ReactNode } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";

/** Bespoke long-covid screening-flow counts (see regen_long_covid_screening_data.py).
 *  Unlike the RLS / antiviral reviews, this funnel runs all the way down to the set
 *  of studies the primary dashboard actually displays (RCT + observational). */
export interface PrismaCounts {
  sources: string[];
  identified: number;
  excluded_not_relevant: number;
  relevant: number;
  not_retrieved: number;
  retrieved: number;
  excluded_at_eligibility: number;
  eligibility_exclusion_reasons: Record<string, number>;
  eligible: number;
  extracted_total: number;
  extracted_rct: number;
  extracted_observational: number;
  displayed_total: number;
  displayed_rct: number;
  displayed_observational: number;
}

function MainBox({
  stage,
  title,
  n,
  sub,
}: {
  stage?: string;
  title: ReactNode;
  n: number;
  sub?: string;
}) {
  return (
    <div className="border border-border rounded-lg bg-white px-4 py-3 text-center shadow-sm">
      {stage && <div className="text-[10px] uppercase tracking-wide text-foreground/40 mb-1">{stage}</div>}
      <div className="text-2xl font-bold text-foreground leading-none">{n.toLocaleString()}</div>
      <div className="text-sm text-foreground/80 mt-1">{title}</div>
      {sub && <div className="text-xs text-foreground/50 mt-1">{sub}</div>}
    </div>
  );
}

/** Dashed exclusion box on the right column, with a horizontal connector arrow.
 *  Optional `reasons` renders a small breakdown beneath the headline count. */
function ExcludedBox({
  title,
  n,
  reasons,
}: {
  title: string;
  n: number;
  reasons?: { label: string; n: number }[];
}) {
  return (
    <div className="flex items-start">
      <div className="hidden md:flex items-center shrink-0 text-foreground/30 mt-3">
        <div className="h-px w-8 bg-foreground/25" />
        <ArrowRight size={16} className="-ml-1" />
      </div>
      <div className="border border-dashed border-border rounded-lg bg-foreground/[0.03] px-3 py-2 text-left flex-1 md:ml-1">
        <div>
          <span className="font-semibold text-foreground/70">{n.toLocaleString()}</span>
          <span className="text-xs text-foreground/55"> — {title}</span>
        </div>
        {reasons && reasons.length > 0 && (
          <div className="mt-2 pt-2 border-t border-dashed border-foreground/20 space-y-1">
            {reasons.map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-foreground/55">{r.label}</span>
                <span className="text-xs font-semibold text-foreground/55">{r.n.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DownArrow() {
  return (
    <div className="grid md:grid-cols-2">
      <SpineArrow />
    </div>
  );
}

function SpineArrow() {
  return (
    <div className="flex flex-col items-center text-foreground/30">
      <div className="w-px h-8 bg-foreground/25" />
      <ArrowDown size={18} className="-mt-2" />
    </div>
  );
}

/** A stage row: main box on the left, optional excluded box on the right. */
function StageRow({
  stage,
  title,
  n,
  sub,
  excluded,
  align = "center",
}: {
  stage?: string;
  title: string;
  n: number;
  sub?: string;
  excluded?: { title: string; n: number; reasons?: { label: string; n: number }[] };
  align?: "center" | "start";
}) {
  return (
    <div className={`grid md:grid-cols-2 gap-3 md:gap-0 ${align === "start" ? "items-start" : "items-center"}`}>
      <MainBox stage={stage} title={title} n={n} sub={sub} />
      <div className="md:pr-2">
        {excluded ? (
          <ExcludedBox title={excluded.title} n={excluded.n} reasons={excluded.reasons} />
        ) : null}
      </div>
    </div>
  );
}

/** Terminal tree: a coloured parent total box with its leaf boxes beneath. */
function TreeBranch({
  label,
  n,
  accent,
  tint,
  items,
}: {
  label: string;
  n: number;
  accent: string;
  tint: string;
  items: { key: string; n: number }[];
}) {
  return (
    <div>
      <div className="border border-border rounded-lg px-4 py-3 text-center" style={{ backgroundColor: tint }}>
        <div className="text-2xl font-bold leading-none" style={{ color: accent }}>{n.toLocaleString()}</div>
        <div className="text-sm text-foreground/80 mt-1">{label}</div>
      </div>
      <div className="ml-5 mt-2 border-l border-foreground/20 pl-4 space-y-2">
        {items.map((it) => (
          <div key={it.key} className="flex items-center">
            <div className="hidden md:block h-px w-4 bg-foreground/20 -ml-4 mr-2 shrink-0" />
            <div className="flex-1 border border-border rounded-md bg-white px-3 py-1.5 flex items-baseline justify-between gap-2">
              <span className="text-sm text-foreground/75">{it.key}</span>
              <span className="font-semibold" style={{ color: accent }}>{it.n.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Human-readable labels for the top eligibility-exclusion reasons. */
const REASON_LABELS: Record<string, string> = {
  unspecified: "Not a treatment trial / unspecified",
  secondary_analysis: "Secondary analysis",
  review: "Review",
  editorial: "Editorial / commentary",
  protocol: "Study protocol",
  case_series: "Case series",
  case_report: "Case report",
  "not a treatment study": "Not a treatment study",
  guideline: "Guideline",
  observational: "Observational (no intervention)",
  "study protocol": "Study protocol",
  other: "Other",
};

export function PrismaDiagram({ counts }: { counts: PrismaCounts }) {
  // Top exclusion reasons for the eligibility dashed box (cap to keep it readable).
  const reasons = Object.entries(counts.eligibility_exclusion_reasons ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([key, n]) => ({ label: REASON_LABELS[key] ?? key.replace(/_/g, " "), n }));

  const terminalItems = [
    { key: "Randomized controlled trials", n: counts.displayed_rct },
    { key: "Observational studies", n: counts.displayed_observational },
  ].filter((x) => x.n > 0);

  return (
    <div className="border border-border rounded-lg bg-white p-6 mb-8">
      <h2 className="text-lg font-semibold mb-5">Screening flow</h2>

      <div className="max-w-3xl mx-auto">
        <StageRow
          title="Records identified from database searches"
          n={counts.identified}
          sub={counts.sources.join(" · ")}
          excluded={{ title: "excluded on title/abstract — not relevant", n: counts.excluded_not_relevant }}
        />
        <DownArrow />
        <StageRow
          title="Relevant to Long Covid after title/abstract screening"
          n={counts.relevant}
          excluded={counts.not_retrieved > 0 ? { title: "not retrieved", n: counts.not_retrieved } : undefined}
        />
        <DownArrow />
        <StageRow
          title="Full-text articles retrieved and screened"
          n={counts.retrieved}
          align="start"
          excluded={{
            title: "excluded at eligibility screening",
            n: counts.excluded_at_eligibility,
            reasons,
          }}
        />
        <DownArrow />
        <StageRow
          title="Eligible — treatment studies assessed for extraction"
          n={counts.eligible}
          excluded={
            counts.eligible - counts.extracted_total > 0
              ? { title: "not extracted (no usable full text / failed extraction)", n: counts.eligible - counts.extracted_total }
              : undefined
          }
        />
        <DownArrow />
        <StageRow
          title="Full-text data extracted"
          n={counts.extracted_total}
          sub={`${counts.extracted_rct.toLocaleString()} RCT · ${counts.extracted_observational.toLocaleString()} observational`}
          excluded={
            counts.extracted_total - counts.displayed_total > 0
              ? { title: "merged duplicates, non-clinical-trial records, and papers excluded at eligibility (e.g. reviews, protocols, secondary analyses, preclinical/modelling studies) removed", n: counts.extracted_total - counts.displayed_total }
              : undefined
          }
        />
        <DownArrow />
        <div className="grid md:grid-cols-2">
          <TreeBranch
            label="Studies shown on the dashboard"
            n={counts.displayed_total}
            accent="#2563eb"
            tint="rgba(96,165,250,0.15)"
            items={terminalItems}
          />
        </div>
      </div>
    </div>
  );
}
