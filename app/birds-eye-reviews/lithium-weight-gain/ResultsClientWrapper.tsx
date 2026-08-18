"use client";

import { ReactNode, useState } from "react";
import { CountryFilterCard, countriesOf } from "@/components/CountryFilterCard";
import { ResultsTable, TrialRow } from "./ResultsTable";
import { ArmRateCharts } from "./ArmRateCharts";
import { ArmRatePoint } from "./arm-points";
import { formatLabel } from "./utils";

/** Selection-set semantics, shared by every card (and CountryFilterCard):
 *  - empty set        = no filter; every box renders checked
 *  - set of values    = only those pass; exactly those boxes render checked
 *  - { NONE } sentinel = the Clear state; nothing passes, no box checked
 *  A click ALWAYS toggles just the clicked box: from all-checked it unchecks
 *  that one (selection becomes "all others"), from cleared it checks that one,
 *  and re-completing the full set collapses back to "no filter". */
const NONE = "__none__";

function isChecked(sel: Set<string>, k: string): boolean {
  return sel.size === 0 || sel.has(k);
}

function toggleValue(sel: Set<string>, k: string, all: string[]): Set<string> {
  if (sel.has(NONE)) return new Set([k]);
  if (sel.size === 0) return new Set(all.filter((x) => x !== k));
  const next = new Set(sel);
  if (next.has(k)) next.delete(k);
  else {
    next.add(k);
    if (all.length > 0 && all.every((x) => next.has(x))) return new Set();
  }
  return next;
}

/** Risk-of-bias vocabularies differ by design: RCTs are assessed with RoB 2
 *  and observational studies with ROBINS-I; both land in one column, ordered
 *  worst-last. */
const ROB_ORDER = [
  "low", "some_concerns", "moderate", "high", "serious", "critical", "no_information",
];
function robRank(v: string): number {
  const i = ROB_ORDER.indexOf(v);
  return i === -1 ? ROB_ORDER.length : i;
}

/** Intervention buckets, in display order. "Lithium carbonate" includes arms
 *  whose salt is unstated — the review-wide bipolar-population convention
 *  reads those as carbonate (the table's "~" marker). */
const INTERVENTION_ORDER = ["lithium_carbonate", "lithium_combo", "lithium_other_salt", "unclear"];
const INTERVENTION_LABELS: Record<string, string> = {
  lithium_carbonate: "Lithium carbonate",
  lithium_combo: "Lithium + another drug",
  lithium_other_salt: "Other lithium salt",
  unclear: "Unclear / not stated",
};

const SETTING_ORDER = ["inpatient", "outpatient", "mixed", "community", "other"];
const SETTING_LABELS: Record<string, string> = {
  inpatient: "Inpatient",
  outpatient: "Outpatient",
  mixed: "In- and outpatient",
  community: "Community / population",
  other: "Other / unspecified",
};

const DIAGNOSIS_ORDER = ["bipolar", "mixed_mood", "mdd", "schizoaffective", "healthy", "other"];
const DIAGNOSIS_LABELS: Record<string, string> = {
  bipolar: "Bipolar disorder",
  mixed_mood: "Mixed mood disorders",
  mdd: "Unipolar depression",
  schizoaffective: "Schizophrenia / schizoaffective",
  healthy: "Healthy volunteers",
  other: "Other / not stated",
};

/** One filter card: title, count line, Select all / Clear, checkbox chips. */
function FacetCard({
  title, values, counts, labelOf, selected, onChange, filteredCount, totalCount, note,
}: {
  title: string;
  values: string[];
  counts: Record<string, number>;
  labelOf: (k: string) => string;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  filteredCount: number;
  totalCount: number;
  note?: ReactNode;
}) {
  const active = selected.size > 0;
  return (
    <div
      className={`mb-4 border border-border rounded-lg p-3 ${
        active ? "bg-foreground/[0.07]" : "bg-foreground/[0.02]"
      }`}
    >
      <div className="mb-2 flex items-center gap-3">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-xs text-foreground/50">
          ({filteredCount} of {totalCount} studies selected)
        </span>
        <button
          onClick={() => onChange(new Set())}
          className="ml-auto text-xs text-blue-600 hover:text-blue-700"
        >
          Select all
        </button>
        <button
          onClick={() => onChange(new Set([NONE]))}
          className="text-xs text-blue-600 hover:text-blue-700"
        >
          Clear
        </button>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {values.map((k) => {
          const checked = isChecked(selected, k);
          return (
            <label
              key={k}
              className={`inline-flex items-center gap-1.5 cursor-pointer text-sm rounded px-1.5 py-0.5 ${
                checked ? "" : "bg-foreground/[0.08]"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onChange(toggleValue(selected, k, values))}
                className="rounded border-foreground/30 text-blue-600 focus:ring-blue-500"
              />
              <span className={checked ? "text-foreground" : "text-foreground/50"}>
                {labelOf(k)}
              </span>
              <span className="text-xs text-foreground/40">({counts[k] ?? 0})</span>
            </label>
          );
        })}
      </div>
      {note && <p className="mt-2 text-xs text-foreground/45">{note}</p>}
    </div>
  );
}

function countBy(rows: TrialRow[], key: (r: TrialRow) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = key(r) || "unknown";
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function countByMulti(rows: TrialRow[], key: (r: TrialRow) => string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) for (const k of key(r)) out[k] = (out[k] ?? 0) + 1;
  return out;
}

export function ResultsClientWrapper({
  trials,
  armPoints = [],
}: {
  trials: TrialRow[];
  armPoints?: ArmRatePoint[];
}) {
  // NB the data's design values are not normalized: "RCT" is uppercase and
  // "quasi-experimental" is hyphenated. Defaults must match t.design verbatim.
  const [selDesign, setSelDesign] = useState<Set<string>>(
    () => new Set(["cross_sectional", "retrospective_cohort", "prospective_cohort", "RCT"]),
  );
  const [selRob, setSelRob] = useState<Set<string>>(new Set());
  const [selIntervention, setSelIntervention] = useState<Set<string>>(new Set());
  const [selSetting, setSelSetting] = useState<Set<string>>(new Set());
  const [selDiagnosis, setSelDiagnosis] = useState<Set<string>>(new Set());
  const [selCountries, setSelCountries] = useState<Set<string>>(new Set());

  const pass = (sel: Set<string>, v: string) => sel.size === 0 || sel.has(v || "unknown");
  const passAny = (sel: Set<string>, vs: string[]) =>
    sel.size === 0 || vs.some((v) => sel.has(v));

  // Facet predicates, keyed so each card can be costed against "every filter
  // but mine" — that keeps a card's own counts stable while it is being used.
  const preds: Record<string, (t: TrialRow) => boolean> = {
    design: (t) => pass(selDesign, t.design),
    rob: (t) => pass(selRob, t.rob),
    intervention: (t) => passAny(selIntervention, t.interventions),
    setting: (t) => pass(selSetting, t.setting),
    diagnosis: (t) => pass(selDiagnosis, t.diagnosis),
    country: (t) => passAny(selCountries, t.countries),
  };
  const except = (skip: string) =>
    trials.filter((t) => Object.entries(preds).every(([k, f]) => k === skip || f(t)));

  const exceptDesign = except("design");
  const exceptRob = except("rob");
  const exceptIntervention = except("intervention");
  const exceptSetting = except("setting");
  const exceptDiagnosis = except("diagnosis");
  const exceptCountry = except("country");
  const filtered = trials.filter((t) => Object.values(preds).every((f) => f(t)));
  const filteredDois = new Set(filtered.map((t) => t.doi.split("#")[0]));

  const designCounts = countBy(exceptDesign, (r) => r.design);
  const allDesigns = Object.keys(countBy(trials, (r) => r.design)).sort(
    (a, b) => (designCounts[b] ?? 0) - (designCounts[a] ?? 0),
  );
  const robCounts = countBy(exceptRob, (r) => r.rob);
  const allRobs = Object.keys(countBy(trials, (r) => r.rob)).sort(
    (a, b) => robRank(a) - robRank(b),
  );
  const interventionCounts = countByMulti(exceptIntervention, (r) => r.interventions);
  const settingCounts = countBy(exceptSetting, (r) => r.setting);
  const diagnosisCounts = countBy(exceptDiagnosis, (r) => r.diagnosis);

  return (
    <div>
      <FacetCard
        title="Filter by study design"
        values={allDesigns}
        counts={designCounts}
        labelOf={formatLabel}
        selected={selDesign}
        onChange={setSelDesign}
        filteredCount={filtered.length}
        totalCount={exceptDesign.length}
      />

      <FacetCard
        title="Filter by risk of bias"
        values={allRobs}
        counts={robCounts}
        labelOf={formatLabel}
        selected={selRob}
        onChange={setSelRob}
        filteredCount={filtered.length}
        totalCount={exceptRob.length}
      />

      <FacetCard
        title="Filter by intervention"
        values={INTERVENTION_ORDER.filter((k) => trials.some((t) => t.interventions.includes(k)))}
        counts={interventionCounts}
        labelOf={(k) => INTERVENTION_LABELS[k] ?? formatLabel(k)}
        selected={selIntervention}
        onChange={setSelIntervention}
        filteredCount={filtered.length}
        totalCount={exceptIntervention.length}
        note={
          <>
            &ldquo;Lithium carbonate&rdquo; includes studies that never state the salt —
            in bipolar populations an unstated salt is read as carbonate. A study with
            both a monotherapy and an adjunctive arm appears under both buckets.
          </>
        }
      />

      <FacetCard
        title="Filter by setting"
        values={SETTING_ORDER.filter((k) => trials.some((t) => t.setting === k))}
        counts={settingCounts}
        labelOf={(k) => SETTING_LABELS[k] ?? formatLabel(k)}
        selected={selSetting}
        onChange={setSelSetting}
        filteredCount={filtered.length}
        totalCount={exceptSetting.length}
      />

      <FacetCard
        title="Filter by psychiatric diagnosis"
        values={DIAGNOSIS_ORDER.filter((k) => trials.some((t) => t.diagnosis === k))}
        counts={diagnosisCounts}
        labelOf={(k) => DIAGNOSIS_LABELS[k] ?? formatLabel(k)}
        selected={selDiagnosis}
        onChange={setSelDiagnosis}
        filteredCount={filtered.length}
        totalCount={exceptDiagnosis.length}
        note={
          <>
            The population the study enrolled — &ldquo;healthy volunteers&rdquo; are
            mostly small physiology and pharmacokinetic studies.
          </>
        }
      />

      {/* Country — always last, per house convention */}
      <CountryFilterCard
        allCountries={countriesOf(exceptCountry)}
        allCountryNames={[...new Set(trials.flatMap((t) => t.countries))]}
        selectedCountries={selCountries}
        onSelectionChange={setSelCountries}
        filteredCount={filtered.length}
        totalCount={exceptCountry.length}
      />

      {/* Arm-level charts obey the same filters: a point survives only when
          its parent study is in the current table selection. */}
      <ArmRateCharts
        points={armPoints.filter((p) => filteredDois.has(p.doi.split("#")[0]))}
      />

      <ResultsTable rows={filtered} />
    </div>
  );
}
