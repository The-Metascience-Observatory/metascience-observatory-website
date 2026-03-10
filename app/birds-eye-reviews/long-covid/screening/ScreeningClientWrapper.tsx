"use client";

import { useState } from "react";
import { ScreeningFunnelChart, ArticleTypeBar } from "./ScreeningFunnelChart";
import { ScreeningTable } from "./ScreeningTable";

interface ScreeningRow {
  doi: string;
  source_folder: string;
  is_long_covid: string;
  studies_treatment: string;
  trial_type: string;
  is_excluded: string;
  exclusion_reason: string;
  topics: string[];
  summary: string;
  title: string;
  authors: string;
  journal: string;
  volume: string;
  issue: string;
  pages: string;
  year: string;
}

export function ScreeningClientWrapper({
  bars,
  totalArticles,
  totalTreatment,
  initialRows,
  sourceFolders,
}: {
  bars: ArticleTypeBar[];
  totalArticles: number;
  totalTreatment: number;
  initialRows: ScreeningRow[];
  sourceFolders: string[];
}) {
  // Use a counter to force re-trigger even if same bar is clicked twice
  const [sourceFilter, setSourceFilter] = useState<string | undefined>(undefined);
  const [filterKey, setFilterKey] = useState(0);

  const handleBarClick = (sourceFolder: string) => {
    setSourceFilter(sourceFolder);
    setFilterKey((k) => k + 1);
  };

  return (
    <>
      <ScreeningFunnelChart
        data={bars}
        totalArticles={totalArticles}
        totalTreatment={totalTreatment}
        onBarClick={handleBarClick}
      />
      <ScreeningTable
        key={filterKey}
        initialRows={initialRows}
        totalCount={totalArticles}
        externalSourceFilter={sourceFilter}
        sourceFolders={sourceFolders}
      />
    </>
  );
}
