"use client";

import { useState, useMemo } from "react";
import { StudyTypeChart } from "./StudyTypeChart";
import { DrugChart } from "./DrugChart";
import { BreakdownChart } from "./BreakdownChart";
import { ScreeningTable, ScreeningRow, PHASE_LABELS } from "./ScreeningTable";

const PHASE_COLORS: Record<string, string> = {
  phase_1: "#7cb5ec",
  phase_1_2: "#5fa8e0",
  phase_2: "#2e86c1",
  phase_2_3: "#1f6fa8",
  phase_3: "#1a5276",
  phase_4: "#16a085",
  unclear: "#94a3b8",
};

const ORGANISM_LABELS: Record<string, string> = {
  human: "Human",
  animal: "Animal (in vivo)",
  in_vitro: "In vitro (cell/virucidal)",
  ex_vivo: "Ex vivo / tissue",
  in_silico: "In silico / modeling",
  mixed: "Mixed (multiple systems)",
  unclear: "Unclear",
  unclassified: "Unclassified",
};
const ORGANISM_COLORS: Record<string, string> = {
  human: "#1a5276",
  animal: "#2e86c1",
  in_vitro: "#7cb5ec",
  ex_vivo: "#a9cce3",
  in_silico: "#d4e6f1",
  mixed: "#16a085",
};
const INDICATION_LABELS: Record<string, string> = {
  prevention: "Prevention (prophylaxis)",
  treatment: "Treatment (therapeutic)",
  both: "Both prevention & treatment",
  not_applicable: "Not applicable (lab / mechanism)",
  unclear: "Unclear",
  unclassified: "Unclassified",
};
const INDICATION_COLORS: Record<string, string> = {
  prevention: "#1e8449",
  treatment: "#d68910",
  both: "#7d3c98",
  not_applicable: "#94a3b8",
};

interface DrugChartData {
  agents: { agent: string; count: number }[];
  singletons: string[];
  namedTotal: number;
  distinct: number;
}

interface StudyTypeData {
  breakdown: Record<string, number>;
  groups: { clinical: string[]; preclinical: string[] };
}

export function ScreeningClientWrapper({
  rows,
  sprayTypes,
  studyType,
  drug,
  organismBreakdown,
  indicationBreakdown,
}: {
  rows: ScreeningRow[];
  sprayTypes: string[];
  studyType?: StudyTypeData;
  drug?: DrugChartData;
  organismBreakdown?: Record<string, number>;
  indicationBreakdown?: Record<string, number>;
}) {
  // Use a counter to force re-trigger even if the same bar is clicked twice
  const [sprayFilter, setSprayFilter] = useState<string | undefined>(undefined);
  const [agentFilter, setAgentFilter] = useState<string | undefined>(undefined);
  const [designFilter, setDesignFilter] = useState<string | undefined>(undefined);
  const [organismFilter, setOrganismFilter] = useState<string | undefined>(undefined);
  const [indicationFilter, setIndicationFilter] = useState<string | undefined>(undefined);
  const [phaseFilter, setPhaseFilter] = useState<string | undefined>(undefined);
  const [filterKey, setFilterKey] = useState(0);

  const clearAll = () => {
    setSprayFilter(undefined);
    setAgentFilter(undefined);
    setDesignFilter(undefined);
    setOrganismFilter(undefined);
    setIndicationFilter(undefined);
    setPhaseFilter(undefined);
  };

  // "Trials by Phase" — computed from the rows (interventional trials only;
  // not_applicable/blank rows are observational/preclinical and excluded so the
  // chart shows the phase distribution of actual clinical trials). Counts here
  // match the table's Phase filter (both read row.phase).
  const phaseBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rows) {
      const p = r.phase;
      if (!p || p === "not_applicable") continue;
      m[p] = (m[p] ?? 0) + 1;
    }
    return m;
  }, [rows]);

  // Each chart drives a single-dimension filter; clicking one bar clears the
  // others so the table shows exactly the papers that bar represents. (The
  // table already only contains treatment studies, so no treatment pinning.)
  const handleDesignClick = (designKey: string) => {
    clearAll();
    setDesignFilter(designKey);
    setFilterKey((k) => k + 1);
  };

  const handleDrugClick = (agent: string) => {
    clearAll();
    setAgentFilter(agent);
    setFilterKey((k) => k + 1);
  };

  const handleOrganismClick = (organism: string) => {
    clearAll();
    setOrganismFilter(organism);
    setFilterKey((k) => k + 1);
  };

  const handleIndicationClick = (indication: string) => {
    clearAll();
    setIndicationFilter(indication);
    setFilterKey((k) => k + 1);
  };

  const handlePhaseClick = (phase: string) => {
    clearAll();
    setPhaseFilter(phase);
    setFilterKey((k) => k + 1);
  };

  return (
    <>
      {studyType && <StudyTypeChart {...studyType} onBarClick={handleDesignClick} />}
      {organismBreakdown && (
        <BreakdownChart
          title="Treatment Studies by Organism / System"
          breakdown={organismBreakdown}
          labels={ORGANISM_LABELS}
          colors={ORGANISM_COLORS}
          onBarClick={handleOrganismClick}
          clickHint="Click a bar to filter the table below to that organism."
        />
      )}
      {indicationBreakdown && (
        <BreakdownChart
          title="Treatment Studies by Prevention vs Treatment"
          breakdown={indicationBreakdown}
          labels={INDICATION_LABELS}
          colors={INDICATION_COLORS}
          onBarClick={handleIndicationClick}
          clickHint="Click a bar to filter the table below to that indication."
        />
      )}
      {drug && <DrugChart {...drug} onBarClick={handleDrugClick} />}
      {Object.keys(phaseBreakdown).length > 0 && (
        <BreakdownChart
          title="Clinical Trials by Phase"
          breakdown={phaseBreakdown}
          labels={PHASE_LABELS}
          colors={PHASE_COLORS}
          onBarClick={handlePhaseClick}
          clickHint="Interventional trials only (observational / preclinical excluded). Click a bar to filter the table below to that phase."
        />
      )}

      <ScreeningTable
        key={filterKey}
        rows={rows}
        externalSprayFilter={sprayFilter}
        externalAgentFilter={agentFilter}
        externalDesignFilter={designFilter}
        externalOrganismFilter={organismFilter}
        externalIndicationFilter={indicationFilter}
        externalPhaseFilter={phaseFilter}
        sprayTypes={sprayTypes}
        compounds={drug?.agents.map((a) => a.agent)}
      />
    </>
  );
}
