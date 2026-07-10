"use client";

import { ReactNode } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { GetPrisma } from "./types";

/** Bespoke PRISMA 2020 flow for the GET-for-ME/CFS meta-analysis, built from
 *  get_prisma.json. Self-contained HTML/SVG (lucide arrows only) — no chart libs.
 *  Runs identified → screened → excluded (with reason breakdown) → 12 studies
 *  included → the three quantitative-synthesis pools. */

function MainBox({ stage, title, n, sub }: { stage?: string; title: ReactNode; n: number; sub?: string }) {
  return (
    <div className="border border-border rounded-lg bg-card px-4 py-3 text-center shadow-sm">
      {stage && <div className="text-[10px] uppercase tracking-wide text-foreground/40 mb-1">{stage}</div>}
      <div className="text-2xl font-bold text-foreground leading-none">{n.toLocaleString()}</div>
      <div className="text-sm text-foreground/80 mt-1">{title}</div>
      {sub && <div className="text-xs text-foreground/50 mt-1">{sub}</div>}
    </div>
  );
}

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
      <div className="flex flex-col items-center text-foreground/30">
        <div className="w-px h-8 bg-foreground/25" />
        <ArrowDown size={18} className="-mt-2" />
      </div>
    </div>
  );
}

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
      {/* The excluded box can be tall (reason breakdown). On desktop it is taken
          OUT OF FLOW (absolute) so it does not stretch this grid row and detach
          the connecting down-arrow from the box above. On mobile it stacks below. */}
      <div className="md:relative md:pr-2">
        {excluded ? (
          <div className="md:absolute md:top-0 md:left-0 md:right-2">
            <ExcludedBox {...excluded} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Terminal tree: coloured parent box with the three synthesis pools beneath. */
function TreeBranch({
  label,
  n,
  items,
}: {
  label: string;
  n: number;
  items: { key: string; n: number }[];
}) {
  return (
    <div>
      <div
        className="border border-border rounded-lg px-4 py-3 text-center"
        style={{ backgroundColor: "rgba(96,165,250,0.15)" }}
      >
        <div className="text-2xl font-bold leading-none text-blue-600 dark:text-blue-400">{n.toLocaleString()}</div>
        <div className="text-sm text-foreground/80 mt-1">{label}</div>
      </div>
      <div className="ml-5 mt-2 border-l border-foreground/20 pl-4 space-y-2">
        {items.map((it) => (
          <div key={it.key} className="flex items-center">
            <div className="hidden md:block h-px w-4 bg-foreground/20 -ml-4 mr-2 shrink-0" />
            <div className="flex-1 border border-border rounded-md bg-card px-3 py-1.5 flex items-baseline justify-between gap-2">
              <span className="text-sm text-foreground/75">{it.key}</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">{it.n.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Human-readable labels for the exclusion-reason keys in get_prisma.json. */
const REASON_LABELS: Record<string, string> = {
  review_or_editorial: "Review / editorial",
  not_graded_exercise_intervention: "Not a graded-exercise intervention",
  not_an_RCT: "Not an RCT",
  mechanistic_or_physiology_only: "Mechanistic / physiology only",
  protocol_no_results: "Protocol (no results)",
  wrong_population: "Wrong population",
  conference_abstract: "Conference abstract",
};

export function GetPrismaDiagram({ prisma }: { prisma: GetPrisma }) {
  const reasons = Object.entries(prisma.exclusion_reasons ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([key, n]) => ({ label: REASON_LABELS[key] ?? key.replace(/_/g, " "), n }));

  const q = prisma.trials_in_quantitative_synthesis ?? { fatigue: 0, physical_function: 0, harms: 0 };
  const pools = [
    { key: "Fatigue (SMD)", n: q.fatigue },
    { key: "Physical function (SMD)", n: q.physical_function },
    { key: "Harms (risk ratio)", n: q.harms },
  ].filter((x) => x.n > 0);

  const sourcesSub = prisma.sources?.length ? prisma.sources.join(" · ") : undefined;

  return (
    <div className="border border-border rounded-lg bg-card p-6 mb-8 shadow-sm">
      <h2 className="text-lg font-semibold mb-5">PRISMA 2020 flow</h2>

      <div className="max-w-3xl mx-auto">
        <StageRow
          stage="Identification"
          title="Records identified from database searches"
          n={prisma.records_identified}
          sub={sourcesSub}
        />
        <DownArrow />
        <StageRow
          stage="Screening"
          title="Records screened at full-text / PICO level"
          n={prisma.records_screened}
          align="start"
          excluded={{ title: "records excluded", n: prisma.records_excluded, reasons }}
        />
        <DownArrow />
        <StageRow
          stage="Included"
          title="Studies (trials) included"
          n={prisma.studies_included_trials}
          sub={`${prisma.reports_included_papers} reports`}
        />
        <DownArrow />
        <div className="grid md:grid-cols-2">
          <TreeBranch label="Trials in quantitative synthesis" n={prisma.studies_included_trials} items={pools} />
        </div>
      </div>

      {prisma.trials_excluded_from_primary_pool?.length > 0 && (
        <div className="mt-6 border-t border-border pt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-foreground/50 mb-2">
            Included studies held out of the primary pools
          </div>
          <ul className="space-y-1.5">
            {prisma.trials_excluded_from_primary_pool.map((x) => (
              <li key={x.trial} className="text-sm text-foreground/70">
                <span className="font-medium text-foreground/85">{x.trial}</span>
                <span className="text-foreground/55"> — {x.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
