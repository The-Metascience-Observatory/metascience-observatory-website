import { ReactNode } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";

export interface PrismaCounts {
  sources: string[];
  identified: number;
  excluded_not_relevant: number;
  relevant: number;
  not_retrieved: number;
  retrieved: number;
  excluded_not_treatment: number;
  treatment_studies: number;
  clinical: number;
  preclinical: number;
  study_design_breakdown: Record<string, number>;
  study_design_groups: { clinical: string[]; preclinical: string[] };
  agent_breakdown: { agent: string; count: number }[];
  agent_singletons: string[];
  agent_named_total: number;
  agent_distinct: number;
  organism_breakdown?: Record<string, number>;
  indication_breakdown?: Record<string, number>;
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

function ExcludedBox({ title, n }: { title: string; n: number }) {
  return (
    <div className="flex items-center">
      {/* horizontal connector arrow from the main box into the excluded box */}
      <div className="hidden md:flex items-center shrink-0 text-foreground/30">
        <div className="h-px w-8 bg-foreground/25" />
        <ArrowRight size={16} className="-ml-1" />
      </div>
      <div className="border border-dashed border-border rounded-lg bg-foreground/[0.03] px-3 py-2 text-left flex-1 md:ml-1">
        <span className="font-semibold text-foreground/70">{n.toLocaleString()}</span>
        <span className="text-xs text-foreground/55"> — {title}</span>
      </div>
    </div>
  );
}

function DownArrow() {
  // Render inside a 2-col grid so the arrow centers under the left (main) column,
  // matching the main boxes rather than drifting into the excluded column. A tall
  // vertical rule + arrowhead visually connects the box above to the box below.
  return (
    <div className="grid md:grid-cols-2">
      <SpineArrow />
    </div>
  );
}

/** Vertical connector (rule + arrowhead). Placed directly between two stacked
 *  boxes in a flex column so both ends touch the adjacent boxes. */
function SpineArrow() {
  return (
    <div className="flex flex-col items-center text-foreground/30">
      <div className="w-px h-8 bg-foreground/25" />
      <ArrowDown size={18} className="-mt-2" />
    </div>
  );
}

/** A stage row: main box on the left, optional excluded box on the right.
 *  align="start" tops-aligns columns (use when right slot is much taller than
 *  the main box); default "center" vertically centers them. */
function StageRow({
  stage,
  title,
  n,
  sub,
  excluded,
  rightSlot,
  align = "center",
}: {
  stage?: string;
  title: string;
  n: number;
  sub?: string;
  excluded?: { title: string; n: number };
  rightSlot?: ReactNode;
  align?: "center" | "start";
}) {
  return (
    <div className={`grid md:grid-cols-2 gap-3 md:gap-0 ${align === "start" ? "items-start" : "items-center"}`}>
      <MainBox stage={stage} title={title} n={n} sub={sub} />
      <div className="md:pr-2">
        {excluded ? <ExcludedBox title={excluded.title} n={excluded.n} /> : (rightSlot ?? null)}
      </div>
    </div>
  );
}

const DESIGN_LABELS: Record<string, string> = {
  animal_in_vivo: "Animal (in vivo)",
  in_vitro: "In vitro",
  ex_vivo: "Ex vivo / tissue",
  formulation_pk: "Formulation / PK",
  in_silico: "In silico",
  rct: "Randomized controlled trial",
  non_randomized_trial: "Non-randomized trial",
  human_challenge: "Human challenge trial",
  observational: "Observational",
  case_series: "Case series / report",
  other: "Other",
  unclear: "Unclear",
};

/** One branch of the terminal tree: a parent total box with its study-design
 *  leaf boxes listed beneath, connected by a vertical rule. */
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
              <span className="text-sm text-foreground/75">{DESIGN_LABELS[it.key] ?? it.key}</span>
              <span className="font-semibold" style={{ color: accent }}>{it.n.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A branch rendered as EXCLUDED: dashed/muted parent box + dashed leaf list.
 *  Includes its own horizontal connector arrow (like ExcludedBox), top-aligned
 *  so the arrow points at the tree header rather than the middle of the list. */
function ExcludedTreeBranch({
  label,
  n,
  items,
}: {
  label: string;
  n: number;
  items: { key: string; n: number }[];
}) {
  return (
    <div className="flex items-start">
      <div className="hidden md:flex items-center shrink-0 text-foreground/30 mt-3">
        <div className="h-px w-8 bg-foreground/25" />
        <ArrowRight size={16} className="-ml-1" />
      </div>
      <div className="flex-1 md:ml-1 border border-dashed border-border rounded-lg bg-foreground/[0.03] px-3 py-2 text-left">
        <div>
          <span className="font-semibold text-foreground/70">{n.toLocaleString()}</span>
          <span className="text-xs text-foreground/55"> — excluded — {label.toLowerCase()}</span>
        </div>
        <div className="mt-2 pt-2 border-t border-dashed border-foreground/20 space-y-1">
          {items.map((it) => (
            <div key={it.key} className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-foreground/55">{DESIGN_LABELS[it.key] ?? it.key}</span>
              <span className="font-semibold text-foreground/55">{it.n.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PrismaDiagram({ counts }: { counts: PrismaCounts }) {
  const sb = counts.study_design_breakdown ?? {};
  const toItems = (keys: string[]) =>
    keys
      .map((k) => ({ key: k, n: sb[k] ?? 0 }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n);
  const preItems = toItems(counts.study_design_groups.preclinical);
  // "Human studies" (incl. case series) is the upper neutral box; the case series /
  // case reports branch off it, leaving the controlled "Human clinical trials" box
  // below, whose tree shows the four trial designs this page analyzes.
  const caseSeriesN = sb["case_series"] ?? 0;
  const trialItems = toItems(
    counts.study_design_groups.clinical.filter((k) => k !== "case_series")
  );
  const clinicalStudies = counts.clinical;
  const clinicalTrials = counts.clinical - caseSeriesN;
  const otherN = counts.treatment_studies - counts.clinical - counts.preclinical;

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
          title="Full-text articles determined as eligible after AI screening"
          n={counts.relevant}
          excluded={counts.not_retrieved > 0 ? { title: "not retrieved", n: counts.not_retrieved } : undefined}
        />
        <DownArrow />
        <StageRow
          title="Full-text articles retrieved and screened"
          n={counts.retrieved}
          excluded={{ title: "excluded — not a treatment study", n: counts.excluded_not_treatment }}
        />
        <DownArrow />
        {/* Three separate rows so each right-column excluded box aligns with
            exactly its left-column counterpart, regardless of height differences.
              Treatment studies ──▶ preclinical excluded (tall tree)
                     ↓
              Human studies     ──▶ case series excluded
                     ↓
              Human clinical trials (tree of trial designs)

            The left column of the first row holds both the Treatment studies box
            AND a flex-1 spine so the arrow stretches from the bottom of that box
            all the way to the Human studies box below, regardless of how tall the
            preclinical tree is on the right.                                      */}
        <div className="grid md:grid-cols-2 gap-3 md:gap-0">
          <div className="flex flex-col">
            <MainBox
              title="Treatment studies (human + preclinical) (displayed on this page)"
              n={counts.treatment_studies}
            />
            <div className="flex flex-col items-center flex-1 text-foreground/30">
              <div className="w-px flex-1 bg-foreground/25 min-h-8" />
              <ArrowDown size={18} className="-mt-2" />
            </div>
          </div>
          <div className="md:pr-2">
            <ExcludedTreeBranch
              label="Preclinical studies"
              n={counts.preclinical}
              items={preItems}
            />
          </div>
        </div>
        <StageRow
          title="Human studies"
          n={clinicalStudies}
          excluded={caseSeriesN > 0 ? { title: "excluded — case series / case reports", n: caseSeriesN } : undefined}
        />
        <DownArrow />
        <div className="grid md:grid-cols-2">
          <TreeBranch
            label="Human clinical trials"
            n={clinicalTrials}
            accent="#2563eb"
            tint="rgba(96,165,250,0.15)"
            items={trialItems}
          />
        </div>

        {otherN > 0 && (
          <div className="mt-3 text-center text-xs text-foreground/50">
            + {otherN.toLocaleString()} other / unclear study design
          </div>
        )}
      </div>
    </div>
  );
}
