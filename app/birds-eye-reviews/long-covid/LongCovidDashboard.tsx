"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { matchesPublication, preferPublished, metadataCounts } from "@/lib/long-covid/publications";
import { PublicationFilters, PublicationDetails, usePublicationFilters } from "./PublicationFilters";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  CartesianGrid,
} from "recharts";
import { ChevronDown, ChevronRight, ExternalLink, Link2, Check } from "lucide-react";
import type { DashboardProps, InterventionBar, TrialTableRow, HoverTrial } from "./types";
import { aggregateFromMetas, interventionVerdictsFromRows, getPromiseScoreColors, LC_WEEKS_BINS, LC_BIN_LABELS, LC_WHO_BIN_LABELS, VERDICT_SEGMENTS, INTERVENTION_WIDE_MIN_TRIALS } from "./constants";
import { TrialRectList } from "@/components/TrialRectList";
import { CountryMap } from "@/components/CountryMap";
import { trialHasFacet, countDistinctTrials, type FacetInput } from "./facets";

// ── Color constants ──────────────────────────────────────────────────
const ROB_COLORS = {
  low: "#22c55e",
  some_concerns: "#f59e0b",
  high: "#ef4444",
};

const ROB_LABELS: Record<string, string> = {
  low: "Low",
  some_concerns: "Some concerns",
  high: "High",
};

const formatCategory = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Format a p-value with enough digits so it doesn't show as 0.00 */
const formatPValue = (p: number): string => {
  if (p < 0.001) return "<0.001";
  if (p < 0.01) return p.toFixed(3);
  return p.toFixed(2);
};

// Keys must match normDesignType() output (lowercased, hyphens → underscores),
// otherwise the lookup misses and formatCategory turns "rct" into "Rct".
const DESIGN_TYPE_LABELS: Record<string, string> = {
  rct: "RCT",
  crossover: "Crossover RCT",
  quasi_experimental: "Quasi-Experimental",
  prospective_cohort: "Prospective Cohort",
  retrospective_cohort: "Retrospective Cohort",
  before_after: "Before–After",
  case_series: "Case Series",
  cross_sectional: "Cross-Sectional",
  case_control: "Case–Control",
  interrupted_time_series: "Interrupted Time Series",
};
const formatDesignType = (s: string) => DESIGN_TYPE_LABELS[s] ?? formatCategory(s);

// ── Main Dashboard ───────────────────────────────────────────────────
export function LongCovidDashboard(props: DashboardProps) {
  const publicationFilters = usePublicationFilters(false);
  const {medline, publication} = publicationFilters;
  const representativeMetas = useMemo(()=>preferPublished(props.trialMetas),[props.trialMetas]);
  const publicationMetas = useMemo(()=>representativeMetas.filter(m=>matchesPublication(m.publicationMetadata,medline,publication)),[representativeMetas,medline,publication]);
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [landscapeCategory, setLandscapeCategory] = useState<string | null>(null);
  const [landscapeSymptom, setLandscapeSymptom] = useState<string | null>(null);
  const [interventionCategoryFilter, setInterventionCategoryFilter] = useState<string | null>(null);
  const [interventionNameFilter, setInterventionNameFilter] = useState<string | null>(null);
  const [lcDefFilter, setLcDefFilter] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [blindingFilter, setBlindingFilter] = useState<string | null>(null);
  const [symptomDomainFilter, setSymptomDomainFilter] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const clearAllFilters = () => {
    setYearFilter(null);
    setLandscapeCategory(null);
    setLandscapeSymptom(null);
    setInterventionCategoryFilter(null);
    setInterventionNameFilter(null);
    setLcDefFilter(null);
    setCountryFilter(null);
    setBlindingFilter(null);
    setSymptomDomainFilter(null);
  };

  const scrollToTable = () => {
    if (tableRef.current) {
      tableRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const makeFilterHandler = <T,>(setter: (v: T) => void) => (value: T) => {
    clearAllFilters();
    setInterventionCategoryFilter(interventionCategoryFilter);
    setter(value);
    scrollToTable();
  };

  const handleYearClick = makeFilterHandler(setYearFilter);
  const handleInterventionClick = makeFilterHandler(setInterventionNameFilter);
  const handleLcDefClick = makeFilterHandler(setLcDefFilter);
  const handleCountryClick = makeFilterHandler(setCountryFilter);
  const handleBlindingClick = makeFilterHandler(setBlindingFilter);
  const handleSymptomDomainClick = makeFilterHandler(setSymptomDomainFilter);

  const handleCellClick = (category: string, symptom: string) => {
    clearAllFilters();
    setLandscapeCategory(category);
    setLandscapeSymptom(symptom);
    scrollToTable();
  };

  // Long Covid definition filter (top-level dashboard filter). Default to showing
  // only trials that meet the WHO definition (≥12 weeks since infection).
  const [lcDefWho, setLcDefWho] = useState(true);
  const [lcDefBelow, setLcDefBelow] = useState(false);

  const lcDefFilteredMetas = useMemo(() => {
    if (lcDefWho && lcDefBelow) return publicationMetas;
    if (lcDefWho) return publicationMetas.filter((m) => m.min_weeks != null && m.min_weeks >= 12);
    if (lcDefBelow) return publicationMetas.filter((m) => m.min_weeks != null && m.min_weeks < 12);
    return [];
  }, [lcDefWho, lcDefBelow, publicationMetas]);

  const whoCount = useMemo(
    () => publicationMetas.filter((m) => m.min_weeks != null && m.min_weeks >= 12).length,
    [publicationMetas]
  );
  const belowCount = useMemo(
    () => publicationMetas.filter((m) => m.min_weeks != null && m.min_weeks < 12).length,
    [publicationMetas]
  );

  // Design type checkboxes — compute counts and default to all selected
  const designTypeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of lcDefFilteredMetas) {
      const dt = m.design_type || "unknown";
      counts.set(dt, (counts.get(dt) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [lcDefFilteredMetas]);

  const allDesignTypes = useMemo(
    () => new Set(designTypeCounts.map(([dt]) => dt)),
    [designTypeCounts]
  );

  // Default to the two randomized designs only (values match normDesignType output).
  const [selectedDesignTypes, setSelectedDesignTypes] = useState<Set<string>>(
    () => new Set(["rct", "crossover"])
  );

  const toggleDesignType = (dt: string) => {
    setSelectedDesignTypes((prev) => {
      const next = new Set(prev);
      if (next.has(dt)) next.delete(dt);
      else next.add(dt);
      return next;
    });
  };

  const selectAll = () => setSelectedDesignTypes(new Set(allDesignTypes));
  const selectNone = () => setSelectedDesignTypes(new Set());

  // Recompute aggregated data when filters change
  const filteredMetas = useMemo(
    () => lcDefFilteredMetas.filter((m) => selectedDesignTypes.has(m.design_type || "unknown")),
    [selectedDesignTypes, lcDefFilteredMetas]
  );

  // Symptom domain checkboxes (top-level filter). A trial matches a checked domain
  // if ANY of its outcomes is tagged with it; the "primary only" toggle restricts
  // matching to primary outcomes. Both go through facets.ts so counts and rows agree.
  const [domainPrimaryOnly, setDomainPrimaryOnly] = useState(false);
  const domainKey = domainPrimaryOnly ? "symptomDomain" : "outcomeDomain";
  // Stable checkbox list: every domain any trial studied, in a fixed order (by
  // overall trial count) so boxes don't jump when the toggle or upstream filters change.
  const domainOrder = useMemo(
    () => [...countDistinctTrials(props.trialMetas, "outcomeDomain").entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d),
    [props.trialMetas]
  );
  const allDomains = useMemo(() => new Set(domainOrder), [domainOrder]);
  const domainCounts = useMemo(() => {
    const counts = countDistinctTrials(filteredMetas, domainKey);
    return domainOrder.map((d) => [d, counts.get(d) ?? 0] as [string, number]);
  }, [filteredMetas, domainKey, domainOrder]);
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(
    () => new Set(countDistinctTrials(props.trialMetas, "outcomeDomain").keys())
  );
  const toggleDomain = (d: string) => {
    setSelectedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  };
  const selectAllDomains = () => setSelectedDomains(new Set(allDomains));
  const selectNoDomains = () => setSelectedDomains(new Set());
  const allDomainsSelected = useMemo(
    () => [...allDomains].every((d) => selectedDomains.has(d)),
    [allDomains, selectedDomains]
  );
  // With every domain checked the filter is a no-op (so trials with no domain
  // tags, or no tagged primary outcome under the toggle, are not silently dropped).
  const domainMatches = (m: { facets: FacetInput }) =>
    allDomainsSelected ||
    [...selectedDomains].some((d) => trialHasFacet(m.facets, domainKey, d));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const domainFilteredMetas = useMemo(() => filteredMetas.filter(domainMatches), [filteredMetas, selectedDomains, domainKey, allDomainsSelected]);

  const categoryFilteredMetas = useMemo(
    () => interventionCategoryFilter ? domainFilteredMetas.filter(m=>trialHasFacet(m.facets,'interventionCategory',interventionCategoryFilter)) : domainFilteredMetas,
    [domainFilteredMetas,interventionCategoryFilter]
  );
  const interventionCategories = useMemo(()=>[...countDistinctTrials(domainFilteredMetas,'interventionCategory')].sort((a,b)=>a[0].localeCompare(b[0])),[domainFilteredMetas]);
  const interventionChoices = useMemo(()=>aggregateFromMetas(categoryFilteredMetas).byIntervention.filter(iv=>!interventionCategoryFilter || iv.category===interventionCategoryFilter),[categoryFilteredMetas,interventionCategoryFilter]);
  // Intervention name filter is the outermost filter — it narrows both the charts
  // and the table. Filter metas directly so aggregateFromMetas produces correct counts.
  const interventionFilteredMetas = useMemo(
    () =>
      interventionNameFilter
        ? categoryFilteredMetas.filter((m) => trialHasFacet(m.facets, "intervention", interventionNameFilter))
        : categoryFilteredMetas,
    [categoryFilteredMetas, interventionNameFilter]
  );
  const recomputed = useMemo(() => aggregateFromMetas(interventionFilteredMetas), [interventionFilteredMetas]);

  const effectiveProps: DashboardProps = useMemo(() => {
    const selectedIds = new Set(interventionFilteredMetas.map(m=>m.paper_id));
    const filteredRows = props.tableRows.filter(r=>selectedIds.has(r.paper_id));
    // The "Trials by Intervention" chart/tail reads byNameVerdicts/trialsByName/
    // interventionCategoryOf — recompute them from the filtered rows so the chart
    // reacts to the top-level filters (it otherwise showed the full dataset).
    const iv = interventionVerdictsFromRows(filteredRows);
    return {
      ...props,
      summaryStats: recomputed.summaryStats,
      byIntervention: recomputed.byIntervention,
      bySymptom: recomputed.bySymptom,
      heatmapData: recomputed.heatmapData,
      allCountries: recomputed.allCountries,
      byYear: recomputed.byYear,
      blindingBySignificance: recomputed.blindingBySignificance,
      byDesignType: recomputed.byDesignType,
      lcDefinitionHist: recomputed.lcDefinitionHist,
      lcDefPct12Plus: recomputed.lcDefPct12Plus,
      byNameVerdicts: iv.byNameVerdicts,
      trialsByName: iv.trialsByName,
      interventionCategoryOf: iv.interventionCategoryOf,
      tableRows: filteredRows,
    };
  }, [props, recomputed, interventionFilteredMetas]);

  // ── Shareable links: sync filter state ⇄ URL query string ──────────
  // We use window.history rather than next/navigation so updating the URL
  // never triggers a server re-render (the 21 MB JSONL is only parsed once).
  const didInitFromUrl = useRef(false);

  // On mount, hydrate filter state from the URL so a shared link opens
  // straight into the intended selection.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const year = sp.get("year");
    if (year && Number.isFinite(Number(year))) setYearFilter(Number(year));
    const intCat = sp.get("intCat");
    if (intCat) setInterventionCategoryFilter(intCat);
    const intName = sp.get("intName");
    if (intName) setInterventionNameFilter(intName);
    const lcat = sp.get("lcat");
    if (lcat) setLandscapeCategory(lcat);
    const lsym = sp.get("lsym");
    if (lsym) setLandscapeSymptom(lsym);
    const lcDef = sp.get("lcDef");
    if (lcDef) setLcDefFilter(lcDef);
    const country = sp.get("country");
    if (country) setCountryFilter(country);
    const blinding = sp.get("blinding");
    if (blinding) setBlindingFilter(blinding);
    const symptom = sp.get("symptom");
    if (symptom) setSymptomDomainFilter(symptom);
    // Top-level filters
    if (sp.get("who") === "0") setLcDefWho(false);
    if (sp.get("below") === "1") setLcDefBelow(true);
    const types = sp.get("types");
    if (types !== null) {
      const known = new Set(props.trialMetas.map(m=>m.design_type || 'unknown'));
      const selected=types.split(',').filter(v=>known.has(v));
      if(types==='' || selected.length) setSelectedDesignTypes(new Set(selected));
    }
    const domains = sp.get("domains");
    if (domains !== null) {
      const known = new Set(countDistinctTrials(props.trialMetas, "outcomeDomain").keys());
      const selected = domains.split(',').filter(v => known.has(v));
      if (domains === '' || selected.length) setSelectedDomains(new Set(selected));
    }
    if (sp.get("domPrimary") === "1") setDomainPrimaryOnly(true);

    didInitFromUrl.current = true;

    // If a shared link targets a specific drill-down, bring the table into view.
    const hasDrilldown = year || intCat || intName || lcat || lsym || lcDef || country || blinding || symptom;
    if (hasDrilldown) setTimeout(scrollToTable, 150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect the current filter state back into the URL (no navigation/refetch).
  useEffect(() => {
    if (!didInitFromUrl.current) return;
    if (!publicationFilters.ready) return;
    const params = new URLSearchParams();
    if (medline !== "all") params.set("medline",medline);
    if (publication !== "all") params.set("publication",publication);
    if (yearFilter !== null) params.set("year", String(yearFilter));
    if (interventionCategoryFilter) params.set("intCat", interventionCategoryFilter);
    if (interventionNameFilter) params.set("intName", interventionNameFilter);
    if (landscapeCategory) params.set("lcat", landscapeCategory);
    if (landscapeSymptom) params.set("lsym", landscapeSymptom);
    if (lcDefFilter) params.set("lcDef", lcDefFilter);
    if (countryFilter) params.set("country", countryFilter);
    if (blindingFilter) params.set("blinding", blindingFilter);
    if (symptomDomainFilter) params.set("symptom", symptomDomainFilter);
    if (!lcDefWho) params.set("who", "0");
    if (lcDefBelow) params.set("below", "1");
    const typesArr = [...selectedDesignTypes].sort();
    if (!(typesArr.length===2 && typesArr.includes('rct') && typesArr.includes('crossover'))) {
      params.set("types", typesArr.join(","));
    }
    if (!allDomainsSelected) params.set("domains", [...selectedDomains].sort().join(","));
    if (domainPrimaryOnly) params.set("domPrimary", "1");
    const qs = params.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(window.history.state, "", newUrl);
  }, [
    medline, publication, publicationFilters.ready,
    yearFilter,
    interventionCategoryFilter,
    interventionNameFilter,
    landscapeCategory,
    landscapeSymptom,
    lcDefFilter,
    countryFilter,
    blindingFilter,
    symptomDomainFilter,
    lcDefWho,
    lcDefBelow,
    selectedDesignTypes,
    selectedDomains,
    allDomainsSelected,
    domainPrimaryOnly,
  ]);


  return (
    <div data-testid="treatment-dashboard" data-selected-reports={interventionFilteredMetas.length}>
      {/* Hero */}
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
        <Link href="/birds-eye-reviews" className="text-sm text-blue-600 hover:text-blue-700">
          &larr; Bird&apos;s Eye Reviews
        </Link>
      </div>
      <h1 className="font-clarendon font-bold text-3xl mb-2">Long Covid Clinical Trials</h1>
      {props.lastUpdated && (
        <p className="text-sm text-foreground/50 mb-3">Last updated: {props.lastUpdated}</p>
      )}
      <div className="flex flex-wrap gap-2 mb-4">
        <Link
          href="/birds-eye-reviews/long-covid/screening"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-sm font-medium"
        >
          View breakdown of all Long COVID articles &rarr;
        </Link>
        <Link
          href="/birds-eye-reviews/long-covid/prevention"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-sm font-medium"
        >
          View prevention trials &rarr;
        </Link>
      </div>

      {/* Long Covid definition filter */}
      <div className={`mb-3 border border-border rounded-lg p-4 ${!(lcDefWho && lcDefBelow) ? "bg-foreground/[0.07]" : "bg-foreground/[0.02]"}`}>
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <span className="text-sm font-medium text-foreground">Filter by Long Covid definition</span>
          <button
            type="button"
            onClick={() => { setLcDefWho(true); setLcDefBelow(true); }}
            className="text-xs text-blue-600 hover:text-blue-700 ml-auto"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => { setLcDefWho(false); setLcDefBelow(false); }}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            Clear all
          </button>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          <label className={`inline-flex items-center gap-1.5 cursor-pointer text-sm rounded px-1.5 py-0.5 ${lcDefWho ? "" : "bg-foreground/[0.08]"}`}>
            <input
              type="checkbox"
              checked={lcDefWho}
              onChange={() => setLcDefWho((v) => !v)}
              className="rounded border-foreground/30 text-blue-600 focus:ring-blue-500"
            />
            <span className={lcDefWho ? "text-foreground" : "text-foreground/50"}>
              Meets WHO definition (≥12 weeks)
            </span>
            <span className="text-xs text-foreground/40">({whoCount})</span>
          </label>
          <label className={`inline-flex items-center gap-1.5 cursor-pointer text-sm rounded px-1.5 py-0.5 ${lcDefBelow ? "" : "bg-foreground/[0.08]"}`}>
            <input
              type="checkbox"
              checked={lcDefBelow}
              onChange={() => setLcDefBelow((v) => !v)}
              className="rounded border-foreground/30 text-blue-600 focus:ring-blue-500"
            />
            <span className={lcDefBelow ? "text-foreground" : "text-foreground/50"}>
              Below WHO threshold
            </span>
            <span className="text-xs text-foreground/40">({belowCount})</span>
          </label>
        </div>
      </div>

      {/* Design type filter checkboxes */}
      <div className={`mb-4 border border-border rounded-lg p-4 ${selectedDesignTypes.size < allDesignTypes.size ? "bg-foreground/[0.07]" : "bg-foreground/[0.02]"}`}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-medium text-foreground">Filter by trial type</span>
          <span className="text-xs text-foreground/50">
            ({filteredMetas.length} of {props.summaryStats.totalTrials} trials selected)
          </span>
          <button onClick={selectAll} className="text-xs text-blue-600 hover:text-blue-700 ml-auto">Select all</button>
          <button onClick={selectNone} className="text-xs text-blue-600 hover:text-blue-700">Clear all</button>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {designTypeCounts.map(([dt, count]) => {
            const checked = selectedDesignTypes.has(dt);
            return (
              <label key={dt} className={`inline-flex items-center gap-1.5 cursor-pointer text-sm rounded px-1.5 py-0.5 ${checked ? "" : "bg-foreground/[0.08]"}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleDesignType(dt)}
                  className="rounded border-foreground/30 text-blue-600 focus:ring-blue-500"
                />
                <span className={checked ? "text-foreground" : "text-foreground/50"}>
                  {formatDesignType(dt)}
                </span>
                <span className="text-xs text-foreground/40">({count})</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Symptom domain filter checkboxes */}
      <div className={`mb-4 border border-border rounded-lg p-4 ${!allDomainsSelected || domainPrimaryOnly ? "bg-foreground/[0.07]" : "bg-foreground/[0.02]"}`}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-medium text-foreground">Filter by symptom domain</span>
          <span className="text-xs text-foreground/50">
            ({domainFilteredMetas.length} of {props.summaryStats.totalTrials} trials selected)
          </span>
          <button onClick={selectAllDomains} className="text-xs text-blue-600 hover:text-blue-700 ml-auto">Select all</button>
          <button onClick={selectNoDomains} className="text-xs text-blue-600 hover:text-blue-700">Clear all</button>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {domainCounts.map(([d, count]) => {
            const checked = selectedDomains.has(d);
            return (
              <label key={d} className={`inline-flex items-center gap-1.5 cursor-pointer text-sm rounded px-1.5 py-0.5 ${checked ? "" : "bg-foreground/[0.08]"}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleDomain(d)}
                  className="rounded border-foreground/30 text-blue-600 focus:ring-blue-500"
                />
                <span className={checked ? "text-foreground" : "text-foreground/50"}>
                  {formatCategory(d)}
                </span>
                <span className="text-xs text-foreground/40">({count})</span>
              </label>
            );
          })}
        </div>
        <div className="mt-2 pt-2 border-t border-border/60 flex flex-wrap items-center gap-x-3 gap-y-1">
          <label className="inline-flex items-center gap-1.5 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={domainPrimaryOnly}
              onChange={() => setDomainPrimaryOnly((v) => !v)}
              className="rounded border-foreground/30 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-foreground">Match primary outcomes only</span>
          </label>
          <span className="text-xs text-foreground/50">
            By default a trial matches if any of its outcomes, primary or secondary, is tagged with a checked domain.
          </span>
        </div>
      </div>

      <PublicationFilters {...publicationFilters} checkedAt={props.trialMetas.find(m=>m.publicationMetadata?.medlineCheckedAt)?.publicationMetadata?.medlineCheckedAt}
        counts={metadataCounts(representativeMetas.filter(m=>selectedDesignTypes.has(m.design_type || 'unknown') && ((lcDefWho && lcDefBelow) || (m.min_weeks!=null && (m.min_weeks>=12 ? lcDefWho : lcDefBelow))) && domainMatches(m) && (!interventionCategoryFilter || trialHasFacet(m.facets,'interventionCategory',interventionCategoryFilter)) && (!interventionNameFilter || trialHasFacet(m.facets,'intervention',interventionNameFilter))),medline,publication)} />
      {interventionFilteredMetas.length===0 && <p role="status" className="mb-4">No reports match these filters. Adjust the selections or reset publication filters.</p>}

      {/* Intervention filters */}
      <div className={`mb-6 border border-border rounded-lg p-4 ${interventionNameFilter || interventionCategoryFilter ? "bg-foreground/[0.07]" : "bg-foreground/[0.02]"}`}>
        <div className="flex items-end gap-4 flex-wrap">
          <label className="text-sm font-medium text-foreground min-w-0 max-w-full">Filter by intervention category
            <select aria-label="Filter by intervention category" value={interventionCategoryFilter ?? 'all'}
              onChange={e=>{setInterventionCategoryFilter(e.target.value==='all'?null:e.target.value);setInterventionNameFilter(null);}}
              className="block mt-1 border border-border rounded px-3 py-1.5 text-sm max-w-full bg-background">
              <option value="all">All categories</option>
              {interventionCategoryFilter && !interventionCategories.some(([c])=>c===interventionCategoryFilter) && <option value={interventionCategoryFilter}>{formatCategory(interventionCategoryFilter)} (0)</option>}
              {interventionCategories.map(([category,count])=><option key={category} value={category}>{formatCategory(category)} ({count})</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-foreground min-w-0 max-w-full">Filter by intervention
            <select aria-label="Filter by intervention" value={interventionNameFilter ?? 'all'}
              onChange={e=>setInterventionNameFilter(e.target.value==='all'?null:e.target.value)}
              className="block mt-1 border border-border rounded px-3 py-1.5 text-sm w-full sm:max-w-[22rem] bg-background">
              <option value="all">All interventions</option>
              {interventionNameFilter && !interventionChoices.some(iv=>iv.name===interventionNameFilter) && <option value={interventionNameFilter}>{formatCategory(interventionNameFilter)} (0)</option>}
              {interventionChoices.map(iv=><option key={iv.name} value={iv.name}>{formatCategory(iv.name)} ({iv.count})</option>)}
            </select>
          </label>
          {(interventionNameFilter || interventionCategoryFilter) && <button onClick={()=>{setInterventionNameFilter(null);setInterventionCategoryFilter(null);}} className="text-xs text-blue-600 hover:text-blue-700 ml-auto">Clear intervention filters</button>}
        </div>
      </div>

      <OverviewTab {...effectiveProps} onYearClick={handleYearClick} onCellClick={handleCellClick} onInterventionClick={handleInterventionClick} onLcDefClick={handleLcDefClick} onCountryClick={handleCountryClick} onBlindingClick={handleBlindingClick} onSymptomDomainClick={handleSymptomDomainClick} />
      {/* Trial table — always visible at the bottom */}
      <div className="mt-12 border-t border-border pt-8" ref={tableRef}>
        <h2 className="font-clarendon font-bold text-2xl mb-4">All Trials</h2>
        <TrialTableTab
          tableRows={effectiveProps.tableRows}
          yearFilter={yearFilter}
          onYearClear={() => setYearFilter(null)}
          interventionCategoryFilter={interventionCategoryFilter}
          onInterventionCategoryClear={() => setInterventionCategoryFilter(null)}
          interventionNameFilter={interventionNameFilter}
          onInterventionNameClear={() => setInterventionNameFilter(null)}
          lcDefFilter={lcDefFilter}
          onLcDefClear={() => setLcDefFilter(null)}
          countryFilter={countryFilter}
          onCountryClear={() => setCountryFilter(null)}
          blindingFilter={blindingFilter}
          onBlindingClear={() => setBlindingFilter(null)}
          landscapeCategory={landscapeCategory}
          landscapeSymptom={landscapeSymptom}
          onLandscapeCategoryClear={() => setLandscapeCategory(null)}
          onLandscapeSymptomClear={() => setLandscapeSymptom(null)}
          symptomDomainFilter={symptomDomainFilter}
          onSymptomDomainClear={() => setSymptomDomainFilter(null)}
        />
      </div>
    </div>
  );
}

// ── Interventions by type ────────────────────────────────────────────
/** Every intervention, grouped under its category header. Each intervention
 *  shows one rectangle per trial coloured by result, with a shared hover tooltip;
 *  clicking filters the table. Interventions with more than `wideMinTrials` trials
 *  span all columns so their (long) row of rectangles has room to lay out flat. */
function InterventionsByTypeList({
  byNameVerdicts, trialsByName, interventionCategoryOf, wideMinTrials, onInterventionClick,
}: {
  byNameVerdicts: Record<string, Record<string, number>>;
  trialsByName: Record<string, HoverTrial[]>;
  interventionCategoryOf: Record<string, string>;
  wideMinTrials: number;
  onInterventionClick?: (name: string) => void;
}) {
  const groups = useMemo(() => {
    const g: Record<string, { key: string; label: string; counts: Record<string, number>; total: number; wide: boolean }[]> = {};
    for (const [name, v] of Object.entries(byNameVerdicts)) {
      const total = Object.values(v).reduce((a, b) => a + b, 0);
      if (total === 0) continue;
      const cat = interventionCategoryOf[name] ?? "unknown";
      (g[cat] ??= []).push({ key: name, label: name, counts: v, total, wide: total > wideMinTrials });
    }
    // Wide (most-studied) interventions first within each category, then by count.
    for (const k in g) g[k].sort((a, b) => Number(b.wide) - Number(a.wide) || b.total - a.total || a.label.localeCompare(b.label));
    return Object.entries(g)
      .map(([cat, items]) => ({ cat, items, trials: items.reduce((s, i) => s + i.total, 0) }))
      .sort((a, b) => b.trials - a.trials || b.items.length - a.items.length);
  }, [byNameVerdicts, interventionCategoryOf, wideMinTrials]);

  if (groups.length === 0) return null;

  return (
    <div className="border border-border rounded-lg bg-white p-3 sm:p-4 mb-6">
      <h2 className="text-lg font-semibold mb-1">Trials by Intervention</h2>
      <p className="text-sm text-foreground/60 mb-2">
        Grouped by intervention type. Each rectangle is one trial coloured by result —
        hover for study details, click an intervention to filter the table below.
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4">
        {VERDICT_SEGMENTS.map((seg) => (
          <span key={seg.key} className="inline-flex items-center gap-1.5 text-xs text-foreground/70">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: seg.color }} />
            {seg.label}
          </span>
        ))}
      </div>
      <div className="space-y-5">
        {groups.map(({ cat, items, trials }) => (
          <div key={cat}>
            <div className="flex items-baseline gap-2 mb-1.5 pb-1 border-b border-border">
              <span className="font-semibold text-lg">{formatCategory(cat)}</span>
              <span className="text-sm text-foreground/70">{items.length} interventions · {trials} trials</span>
            </div>
            <TrialRectList
              items={items}
              segments={VERDICT_SEGMENTS}
              hoverTrials={trialsByName}
              onItemClick={onInterventionClick}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── OVERVIEW TAB ─────────────────────────────────────────────────────
function OverviewTab(props: DashboardProps & { onYearClick?: (year: number) => void; onCellClick?: (category: string, symptom: string) => void; onInterventionClick?: (interventionName: string) => void; onLcDefClick?: (binLabel: string) => void; onCountryClick?: (country: string) => void; onBlindingClick?: (blinding: string) => void; onSymptomDomainClick?: (domain: string) => void }) {
  return (
    <div className="space-y-10">
      {/* Trials by Intervention — every intervention grouped by category; the most-
          studied ones (> INTERVENTION_WIDE_MIN_TRIALS trials) span all columns. */}
      <InterventionsByTypeList
        byNameVerdicts={props.byNameVerdicts}
        trialsByName={props.trialsByName}
        interventionCategoryOf={props.interventionCategoryOf}
        wideMinTrials={INTERVENTION_WIDE_MIN_TRIALS}
        onInterventionClick={props.onInterventionClick}
      />

      {/* Timeline + LC definition side by side */}
      <div className="grid md:grid-cols-2 gap-8">
        <ChartSection title="Trials by publication year">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={props.byYear} margin={{ left: 25, right: 20, top: 5, bottom: 25 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="year" label={{ value: "Year", position: "bottom", offset: 0, fontSize: 12 }} />
              <YAxis label={{ value: "# Trials", angle: -90, position: "insideLeft", fontSize: 12 }} />
              <Tooltip cursor={{ fill: 'transparent' }} />
              <Bar
                dataKey="count"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                style={{ cursor: "pointer" }}
                onClick={(data) => {
                  if (data && data.year && props.onYearClick) {
                    props.onYearClick(data.year);
                  }
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        <ChartSection title="Trials by Long Covid definition">
          <div className="relative">
            <div className="absolute top-2 right-2 z-10 text-xs text-foreground/50 flex flex-col gap-1">
              <div
                className="flex items-center cursor-pointer hover:text-foreground transition-colors"
                onClick={() => props.onLcDefClick?.("≥12")}
              >
                <span className="inline-block w-3 h-3 rounded-sm mr-1" style={{ backgroundColor: "#22c55e" }} />
                Meets WHO definition (≥12 weeks) ({props.lcDefPct12Plus}%)
              </div>
              <div
                className="flex items-center cursor-pointer hover:text-foreground transition-colors"
                onClick={() => props.onLcDefClick?.("<12")}
              >
                <span className="inline-block w-3 h-3 rounded-sm mr-1" style={{ backgroundColor: "#ef4444" }} />
                Below WHO threshold ({props.lcDefinitionHist.some(b=>b.count>0) ? 100 - props.lcDefPct12Plus : 0}%)
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={props.lcDefinitionHist}
                margin={{ left: 25, right: 20, top: 5, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="label"
                  label={{ value: "Min weeks since infection", position: "bottom", offset: 0, fontSize: 12 }}
                />
                <YAxis label={{ value: "# Trials", angle: -90, position: "insideLeft", fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar
                  dataKey="count"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                  style={{ cursor: "pointer" }}
                  onClick={(data) => {
                    if (data && data.label && props.onLcDefClick) {
                      props.onLcDefClick(data.label);
                    }
                  }}
                >
                  {props.lcDefinitionHist.map((entry, i) => {
                    const meetsWho = LC_WHO_BIN_LABELS.includes(entry.label);
                    return (
                      <Cell
                        key={i}
                        fill={meetsWho ? "#22c55e" : "#ef4444"}
                        opacity={0.8}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartSection>
      </div>

      {/* Trial type + Country map side by side */}
      <div className="grid md:grid-cols-2 gap-8">
        <ChartSection title="Trial type">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={props.byDesignType} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis type="number" label={{ value: "# Trials", position: "insideBottom", offset: -2, fontSize: 12 }} />
              <YAxis type="category" dataKey="design_type" tickFormatter={formatDesignType} width={140} fontSize={12} interval={0} />
              <Tooltip formatter={(value: number) => [value, "Trials"]} labelFormatter={formatDesignType} />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        <ChartSection title="Trials by country">
          <CountryMap allCountries={props.allCountries} onCountryClick={props.onCountryClick} />
        </ChartSection>
      </div>

      {/* Symptom domain + Blinding side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartSection title="Trials by primary symptom domain">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={props.bySymptom}
              layout="vertical"
              margin={{ left: 120, right: 20, top: 5, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis type="number" />
              <YAxis type="category" dataKey="domain" tickFormatter={formatCategory} width={115} fontSize={12} />
              <Tooltip labelFormatter={formatCategory} />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(data: { domain: string }) => props.onSymptomDomainClick?.(data.domain)} />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        <ChartSection
          title="Blinding type vs. statistical significance"
          subtitle="Open-label trials tend to report more positive results"
        >
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={props.blindingBySignificance}
              stackOffset="expand"
              margin={{ left: 20, right: 20, top: 5, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="blinding"
                interval={0}
                fontSize={12}
                tickFormatter={(blinding: string) => {
                  const group = props.blindingBySignificance.find((row) => row.blinding === blinding);
                  const total = group ? group.significant + group.not_significant + group.unknown : 0;
                  return `${formatCategory(blinding)} (N=${total})`;
                }}
              />
              <YAxis
                domain={[0, 1]}
                ticks={[0, 0.25, 0.5, 0.75, 1]}
                tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
                label={{ value: "% of trials", angle: -90, position: "insideLeft", fontSize: 12 }}
              />
              <Tooltip
                labelFormatter={formatCategory}
                formatter={(val: number, name: string, item) => {
                  const label = name === "significant" ? "Significant (p < 0.05)"
                    : name === "not_significant" ? "Not significant"
                    : "No p-value reported";
                  const row = item.payload;
                  const total = row.significant + row.not_significant + row.unknown;
                  const percent = total > 0 ? (val / total) * 100 : 0;
                  return [`${percent.toFixed(1)}% (${val} trials)`, label];
                }}
              />
              <Legend
                formatter={(v) =>
                  v === "significant" ? "Significant (p < 0.05)"
                    : v === "not_significant" ? "Not significant"
                    : "No p-value reported"
                }
              />
              {/* Each blinding group sums to 100%, including trials without a
                  reported p-value. Clicking still selects all trials in that group. */}
              <Bar dataKey="significant" stackId="a" fill="#ef4444" style={{ cursor: "pointer" }} onClick={(data) => { if (data && data.blinding && props.onBlindingClick) props.onBlindingClick(data.blinding); }} />
              <Bar dataKey="not_significant" stackId="a" fill="#94a3b8" style={{ cursor: "pointer" }} onClick={(data) => { if (data && data.blinding && props.onBlindingClick) props.onBlindingClick(data.blinding); }} />
              <Bar dataKey="unknown" stackId="a" fill="#d1d5db" style={{ cursor: "pointer" }} onClick={(data) => { if (data && data.blinding && props.onBlindingClick) props.onBlindingClick(data.blinding); }} />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>
      </div>

      {/* Heatmap */}
      <ChartSection
        title="Trial landscape"
        subtitle="Intervention category × symptom domain (cell = number of trials)"
      >
        <Heatmap data={props.heatmapData} onCellClick={props.onCellClick} />
      </ChartSection>
    </div>
  );
}

// ── Heatmap ──────────────────────────────────────────────────────────
function Heatmap({ data, onCellClick }: { data: DashboardProps["heatmapData"]; onCellClick?: (category: string, symptom: string) => void }) {
  const interventions = useMemo(
    () => [...new Set(data.map((d) => d.intervention))].sort(),
    [data]
  );
  const symptoms = useMemo(
    () => [...new Set(data.map((d) => d.symptom))].sort(),
    [data]
  );
  const lookup = useMemo(() => {
    const m = new Map<string, (typeof data)[0]>();
    for (const d of data) m.set(`${d.intervention}|||${d.symptom}`, d);
    return m;
  }, [data]);
  const maxCount = useMemo(() => Math.max(...data.map((d) => d.count), 1), [data]);

  return (
    <div className="overflow-x-auto flex justify-center">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="p-2 text-left font-medium text-foreground/60 min-w-[120px]" />
            {symptoms.map((s) => (
              <th
                key={s}
                className="p-2 text-center font-medium text-foreground/60 min-w-[70px]"
                style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
              >
                {formatCategory(s)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {interventions.map((intv) => (
            <tr key={intv}>
              <td className="p-2 font-medium text-foreground/80 whitespace-nowrap">
                {formatCategory(intv)}
              </td>
              {symptoms.map((sym) => {
                const cell = lookup.get(`${intv}|||${sym}`);
                const count = cell?.count ?? 0;
                const opacity = count > 0 ? 0.15 + (count / maxCount) * 0.85 : 0;
                const highPct =
                  cell && cell.count > 0
                    ? Math.round((cell.high / cell.count) * 100)
                    : 0;
                return (
                  <td
                    key={sym}
                    className={`p-2 text-center border border-border/30${count > 0 && onCellClick ? " cursor-pointer hover:ring-2 hover:ring-blue-400 hover:ring-inset" : ""}`}
                    style={{
                      backgroundColor: count > 0 ? `rgba(59, 130, 246, ${opacity})` : undefined,
                    }}
                    title={
                      count > 0
                        ? `${count} trials, ${highPct}% high RoB — click to filter table`
                        : "No trials"
                    }
                    onClick={() => {
                      if (count > 0 && onCellClick) onCellClick(intv, sym);
                    }}
                  >
                    {count > 0 ? (
                      <span className="font-semibold text-foreground">
                        {count}
                      </span>
                    ) : (
                      <span className="text-foreground/20">&ndash;</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Copies the current URL (which encodes the active selection) to the clipboard. */
function CopyLinkButton() {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Link to this view copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 transition-colors"
      title="Copy a shareable link that reproduces the current filters and selection"
    >
      {copied ? <Check size={13} /> : <Link2 size={13} />}
      {copied ? "Copied!" : "Copy link to this view"}
    </button>
  );
}

// ── TRIAL TABLE TAB ──────────────────────────────────────────────────
function TrialTableTab({
  tableRows,
  yearFilter,
  onYearClear,
  interventionCategoryFilter,
  onInterventionCategoryClear,
  interventionNameFilter,
  onInterventionNameClear,
  lcDefFilter,
  onLcDefClear,
  countryFilter,
  onCountryClear,
  blindingFilter,
  onBlindingClear,
  landscapeCategory,
  landscapeSymptom,
  onLandscapeCategoryClear,
  onLandscapeSymptomClear,
  symptomDomainFilter,
  onSymptomDomainClear,
}: {
  tableRows: TrialTableRow[];
  yearFilter: number | null;
  onYearClear: () => void;
  interventionCategoryFilter: string | null;
  onInterventionCategoryClear: () => void;
  interventionNameFilter: string | null;
  onInterventionNameClear: () => void;
  lcDefFilter: string | null;
  onLcDefClear: () => void;
  countryFilter: string | null;
  onCountryClear: () => void;
  blindingFilter: string | null;
  onBlindingClear: () => void;
  landscapeCategory: string | null;
  landscapeSymptom: string | null;
  onLandscapeCategoryClear: () => void;
  onLandscapeSymptomClear: () => void;
  symptomDomainFilter: string | null;
  onSymptomDomainClear: () => void;
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [symptomFilter, setSymptomFilter] = useState("all");
  const [robFilter, setRobFilter] = useState("all");
  const [blindingDropdown, setBlindingDropdown] = useState("all");
  const [sortField, setSortField] = useState<"n_randomized" | "paper_id" | "intervention_name" | "pct_positive" | "outcome" | "promise_score">(
    "promise_score"
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showCount, setShowCount] = useState(50);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShowCount((c) => c + 50);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const categories = useMemo(
    () => [...new Set(tableRows.map((r) => r.intervention_category))].sort(),
    [tableRows]
  );
  const symptoms = useMemo(
    () => [...new Set(tableRows.map((r) => r.primary_symptom_domain).filter(Boolean))].sort(),
    [tableRows]
  );
  const blindingValues = useMemo(
    () => [...new Set(tableRows.map((r) => r.blinding).filter(Boolean))].sort(),
    [tableRows]
  );

  const filtered = useMemo(() => {
    let rows = tableRows;
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.intervention_name.toLowerCase().includes(s) ||
          r.paper_id.toLowerCase().includes(s) ||
          r.countries.some((c) => c.toLowerCase().includes(s))
      );
    }
    if (categoryFilter !== "all") rows = rows.filter((r) => r.intervention_category === categoryFilter);
    if (symptomFilter !== "all") rows = rows.filter((r) => r.primary_symptom_domain === symptomFilter);
    if (robFilter !== "all") rows = rows.filter((r) => r.rob_overall === robFilter);
    if (blindingDropdown !== "all") rows = rows.filter((r) => r.blinding === blindingDropdown);
    if (yearFilter !== null) rows = rows.filter((r) => r.year === yearFilter);
    // Intervention click-filters use the SAME structured list the chart counts,
    // so a bar's number always equals the rows shown when it's clicked.
    if (interventionCategoryFilter !== null) rows = rows.filter((r) => trialHasFacet(r.facets, "interventionCategory", interventionCategoryFilter));
    if (interventionNameFilter !== null) rows = rows.filter((r) => trialHasFacet(r.facets, "intervention", interventionNameFilter));
    if (lcDefFilter !== null) {
      if (lcDefFilter === "≥12") {
        rows = rows.filter((r) => r.min_weeks != null && r.min_weeks >= 12);
      } else if (lcDefFilter === "<12") {
        rows = rows.filter((r) => r.min_weeks != null && r.min_weeks < 12);
      } else {
        const binIdx = LC_BIN_LABELS.indexOf(lcDefFilter);
        if (binIdx >= 0) {
          const low = LC_WEEKS_BINS[binIdx];
          const high = LC_WEEKS_BINS[binIdx + 1];
          rows = rows.filter((r) => r.min_weeks != null && r.min_weeks >= low && r.min_weeks < high);
        }
      }
    }
    if (countryFilter !== null) rows = rows.filter((r) => trialHasFacet(r.facets, "country", countryFilter));
    if (blindingFilter !== null) rows = rows.filter((r) => trialHasFacet(r.facets, "blinding", blindingFilter));
    if (landscapeCategory !== null) rows = rows.filter((r) => trialHasFacet(r.facets, "interventionCategory", landscapeCategory));
    if (landscapeSymptom !== null) rows = rows.filter((r) => trialHasFacet(r.facets, "symptomDomain", landscapeSymptom));
    if (symptomDomainFilter !== null) rows = rows.filter((r) => trialHasFacet(r.facets, "symptomDomain", symptomDomainFilter));
    const outcomeRank = (r: typeof rows[0]): number => {
      const { primary_effect_value: ev, primary_p_value: p, primary_higher_is_better: hib } = r;
      if (ev == null && p == null) return -1;
      const sig = p != null ? p < 0.05 : null;
      let favors: boolean | null = null;
      if (ev != null && hib != null) favors = hib ? ev > 0 : ev < 0;
      if (sig === true && favors === true) return 3;   // Favors intervention
      if (sig === true && favors == null) return 2;    // Significant, direction unknown
      if (sig === false || sig === null) return 1;     // No sig. diff.
      if (sig === true && favors === false) return 0;  // Favors control
      return -1;
    };
    rows = [...rows].sort((a, b) => {
      if (sortField === "pct_positive") {
        const va = a.n_outcomes > 0 ? a.n_positive / a.n_outcomes : -1;
        const vb = b.n_outcomes > 0 ? b.n_positive / b.n_outcomes : -1;
        return sortDir === "asc" ? va - vb : vb - va;
      }
      if (sortField === "outcome") {
        const va = outcomeRank(a);
        const vb = outcomeRank(b);
        return sortDir === "asc" ? va - vb : vb - va;
      }
      const va = a[sortField] ?? 0;
      const vb = b[sortField] ?? 0;
      if (typeof va === "string" && typeof vb === "string")
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return rows;
  }, [tableRows, search, categoryFilter, symptomFilter, robFilter, blindingDropdown, yearFilter, interventionCategoryFilter, interventionNameFilter, lcDefFilter, countryFilter, blindingFilter, landscapeCategory, landscapeSymptom, symptomDomainFilter, sortField, sortDir]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const visible = filtered.slice(0, showCount);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="text-xs text-foreground/50 block mb-1">Search</label>
          <input
            type="text"
            placeholder="Intervention, DOI, country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-border rounded px-3 py-1.5 text-sm bg-background w-56"
          />
        </div>
        <FilterSelect
          label="Category"
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[{ value: "all", label: "All" }, ...categories.map((c) => ({ value: c, label: formatCategory(c) }))]}
        />
        <FilterSelect
          label="Symptom"
          value={symptomFilter}
          onChange={setSymptomFilter}
          options={[{ value: "all", label: "All" }, ...symptoms.map((s) => ({ value: s, label: formatCategory(s) }))]}
        />
        <FilterSelect
          label="Risk of bias"
          value={robFilter}
          onChange={setRobFilter}
          options={[
            { value: "all", label: "All" },
            { value: "low", label: "Low" },
            { value: "some_concerns", label: "Some concerns" },
            { value: "high", label: "High" },
          ]}
        />
        <FilterSelect
          label="Blinding"
          value={blindingDropdown}
          onChange={setBlindingDropdown}
          options={[{ value: "all", label: "All" }, ...blindingValues.map((b) => ({ value: b, label: formatCategory(b) }))]}
        />
        <FilterBadge label="Year" value={yearFilter} onClear={onYearClear} />
        <FilterBadge label="LC definition (weeks)" value={lcDefFilter} onClear={onLcDefClear} />
        <FilterBadge label="Country" value={countryFilter} onClear={onCountryClear} />
        <FilterBadge label="Blinding" value={blindingFilter} onClear={onBlindingClear} format={formatCategory} />
        <FilterBadge label="Intervention category" value={interventionCategoryFilter} onClear={onInterventionCategoryClear} format={formatCategory} />
        <FilterBadge label="Intervention" value={interventionNameFilter} onClear={onInterventionNameClear} format={formatCategory} />
        <FilterBadge label="Intervention (landscape)" value={landscapeCategory} onClear={onLandscapeCategoryClear} format={formatCategory} />
        <FilterBadge label="Symptom (landscape)" value={landscapeSymptom} onClear={onLandscapeSymptomClear} format={formatCategory} />
        <FilterBadge label="Symptom domain" value={symptomDomainFilter} onClear={onSymptomDomainClear} format={formatCategory} />
      </div>

      <div className="flex items-center gap-4 text-sm text-foreground/50">
        <p>{filtered.length} trials match</p>
        <CopyLinkButton />
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={expanded.size > 0 && expanded.size === filtered.length}
            onChange={(e) => {
              if (e.target.checked) {
                setExpanded(new Set(filtered.map((r) => r.paper_id)));
              } else {
                setExpanded(new Set());
              }
            }}
            className="accent-blue-600"
          />
          Expand all
        </label>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-foreground border-collapse">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="p-2 w-8" />
              <th
                className="p-2 cursor-pointer hover:text-foreground"
                onClick={() => handleSort("paper_id")}
              >
                Reference {sortField === "paper_id" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </th>
              <th
                className="p-2 cursor-pointer hover:text-foreground"
                onClick={() => handleSort("intervention_name")}
              >
                Intervention {sortField === "intervention_name" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </th>
              <th
                className="p-2 cursor-pointer hover:text-foreground text-right"
                onClick={() => handleSort("n_randomized")}
              >
                N {sortField === "n_randomized" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </th>
              <th
                className="p-2 cursor-pointer hover:text-foreground"
                onClick={() => handleSort("outcome")}
              >
                Primary Outcome {sortField === "outcome" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </th>
              <th className="p-2 text-right" title="# Outcomes"># Out</th>
              <th className="p-2 text-right" title="Significant, favours treatment">+ Sig</th>
              <th className="p-2 text-right" title="Significant, favours control">− Ctrl</th>
              <th className="p-2 text-right" title="Not significant (no difference)">NS</th>
              <th className="p-2 text-right" title="Unknown / not assessable">Unk</th>
              <th
                className="p-2 cursor-pointer hover:text-foreground text-right"
                onClick={() => handleSort("promise_score")}
                title="AI-generated promise score (0–1) based on effect strength, study quality, and source credibility"
              >
                Promise Score {sortField === "promise_score" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </th>
              <th className="p-2" title="Risk of Bias — assessed using the Cochrane RoB 2 tool, which evaluates potential biases in randomization, deviations from interventions, missing data, outcome measurement, and selective reporting">Risk of Bias</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const isExpanded = expanded.has(row.paper_id);
              return (
                <TrialRow
                  key={row.paper_id}
                  row={row}
                  isExpanded={isExpanded}
                  onToggle={() => toggleExpand(row.paper_id)}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      <div ref={sentinelRef} aria-hidden>
        {showCount < filtered.length && (
          <div className="py-4 text-center text-sm text-foreground/40">
            Loading more… ({filtered.length - showCount} remaining)
          </div>
        )}
      </div>
    </div>
  );
}

function TrialRow({
  row,
  isExpanded,
  onToggle,
}: {
  row: TrialTableRow;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        data-paper-id={row.paper_id} data-medline={row.publicationMetadata?.medline ?? "unknown"} data-publication={row.publicationMetadata?.publication ?? "unknown"}
        className="border-b border-border/50 hover:bg-foreground/5 cursor-pointer"
        onClick={onToggle}
      >
        <td className="p-2">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </td>
        <td className="p-2">
          <a
            href={row.doi_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            {row.first_author ? (
              <span>
                {row.first_author} et al.
                {(row.journal || row.year) && ", "}
                {row.journal && <em>{row.journal}</em>}
                {row.journal && row.year ? ", " : ""}
                {row.year && row.year}
              </span>
            ) : (
              <span>{row.paper_id}</span>
            )}
            {" "}<ExternalLink size={10} className="inline align-baseline ml-0.5" />
          </a>
        </td>
        <td className="p-2 max-w-[180px]" title={row.intervention_name}>
          <span className="text-xs leading-tight line-clamp-3">{row.intervention_name}</span>
        </td>
        <td className="p-2 text-right tabular-nums">{row.n_randomized ?? "—"}</td>
        <td className="p-2">
          <div className="flex flex-col gap-0.5 items-start">
            <span className="text-xs text-foreground leading-tight">{row.primary_outcome_name || "—"}</span>
            <OutcomeBadge row={row} />
          </div>
        </td>
        <td className="p-2 text-right tabular-nums text-xs">{row.n_outcomes}</td>
        <td className="p-2 text-right tabular-nums text-xs text-green-600">{row.n_positive || "—"}</td>
        <td className="p-2 text-right tabular-nums text-xs text-red-600">{row.n_favors_control || "—"}</td>
        <td className="p-2 text-right tabular-nums text-xs">{row.n_null || "—"}</td>
        <td className="p-2 text-right tabular-nums text-xs">{row.n_unknown || "—"}</td>
        <td className="p-2 text-right tabular-nums text-xs">
          {row.promise_score != null ? (() => {
            const psc = getPromiseScoreColors(row.promise_score);
            return (
              <span
                className="inline-block px-2 py-0.5 rounded font-medium"
                style={{ backgroundColor: psc.bg, color: psc.text }}
              >
                {row.promise_score.toFixed(1)}
              </span>
            );
          })() : "—"}
        </td>
        <td className="p-2">
          <RobBadge rob={row.rob_overall} />
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-border/50">
          <td colSpan={12} className="p-4 bg-foreground/[0.02]">
            <div className="grid md:grid-cols-2 gap-4 text-xs">
              {/* Reference */}
              <div className="md:col-span-2">
                <p className="text-foreground leading-snug">
                  {row.first_author && (
                    <span className="font-medium">
                      {row.first_author}
                      {row.authors && row.authors.includes(";") ? " et al." : ""}
                      {". "}
                    </span>
                  )}
                  {row.title ? (
                    <a href={row.doi_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 hover:underline">
                      {row.title}
                    </a>
                  ) : (
                    <a href={row.doi_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 hover:underline">
                      {row.paper_id}
                    </a>
                  )}
                  {row.journal && <>{". "}<em>{row.journal.replace(/&amp;/g, "&")}</em></>}
                  {row.volume && <>{" "}{row.volume}</>}
                  {row.issue && <>({row.issue})</>}
                  {row.pages && <>, {row.pages}</>}
                  {row.year && <> ({row.year})</>}
                  .
                </p>
                <PublicationDetails meta={row.publicationMetadata} />
                <a
                  href={`https://explore.metascienceobservatory.org/doi/${row.paper_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-600 hover:text-violet-700 hover:underline text-[11px] mt-1 inline-block"
                >
                  View in Metascience Observatory Explorer →
                </a>
              </div>
              <div className="md:col-span-2">
                <DetailLabel>Long Covid definition</DetailLabel>
                <p className="text-foreground/70">{row.long_covid_definition || "Not specified"}</p>
              </div>
              {row.summary && (
                <div className="md:col-span-2">
                  <DetailLabel>AI Summary (Sonnet 4.6)</DetailLabel>
                  <p className="text-foreground leading-relaxed">{row.summary}</p>
                </div>
              )}
              <div>
                <DetailLabel>Primary outcome</DetailLabel>
                <p>{row.primary_outcome_name || "Not specified"}</p>
                {row.primary_effect_value != null && (
                  <p className="mt-1">
                    {row.primary_effect_measure
                      ? row.primary_effect_measure === "smd" ? "SMD"
                      : formatCategory(row.primary_effect_measure)
                      : "Effect"}: <strong>{row.primary_effect_value.toFixed(2)}</strong>
                    {row.primary_ci_low != null && row.primary_ci_high != null && (
                      <> [95% CI: {row.primary_ci_low.toFixed(2)}, {row.primary_ci_high.toFixed(2)}]</>
                    )}
                    {row.primary_p_value != null && (
                      <>, p = {formatPValue(row.primary_p_value)}</>
                    )}
                  </p>
                )}
              </div>
              <div className="flex gap-6 flex-wrap">
                <div>
                  <DetailLabel>Blinding</DetailLabel>
                  <p>{formatCategory(row.blinding)}</p>
                </div>
                <div>
                  <DetailLabel>Follow-up</DetailLabel>
                  <p>{row.follow_up_weeks != null ? `${row.follow_up_weeks} weeks` : "Not reported"}</p>
                </div>
                {(() => {
                  const treatment = row.arm_samples.filter((a) => !a.is_control);
                  const control = row.arm_samples.filter((a) => a.is_control);
                  return (
                    <>
                      {treatment.length > 0 && (
                        <div className="flex gap-4">
                          {treatment.map((a, i) => (
                            <div key={i}>
                              <DetailLabel>N {treatment.length > 1 ? a.label : "Treatment"}</DetailLabel>
                              <p>{a.n_randomized ?? "—"}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {control.length > 0 && (
                        <div>
                          <DetailLabel>N Control</DetailLabel>
                          <p>{control.map((a) => a.n_randomized ?? "—").join(" + ")}</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              {row.outcomes_summary.length > 1 && (
                <div className="md:col-span-2">
                  <DetailLabel>All outcomes ({row.outcomes_summary.length})</DetailLabel>
                  <div className="space-y-1 mt-1">
                    {row.outcomes_summary.map((o, i) => {
                      const pStr = o.p_value != null ? (o.p_value < 0.001 ? "p<0.001" : `p=${formatPValue(o.p_value)}`) : null;
                      let direction = "";
                      if (o.effect_value != null && o.higher_is_better != null) {
                        const favors = o.higher_is_better ? o.effect_value > 0 : o.effect_value < 0;
                        direction = favors ? "↑" : "↓";
                      }
                      const sig = o.p_value != null ? o.p_value < 0.05 : null;
                      const color = sig === true && direction === "↑" ? "#16a34a" : sig === true && direction === "↓" ? "#dc2626" : sig === true ? "#d97706" : "#64748b";
                      return (
                        <div key={i} className="flex items-baseline gap-2">
                          <span className="text-foreground">{o.name}</span>
                          {o.symptom_domain && <span className="text-foreground/40">({formatCategory(o.symptom_domain)})</span>}
                          {(pStr || o.effect_value != null) && (
                            <span style={{ color }} className="whitespace-nowrap font-medium">
                              {direction}
                              {o.effect_value != null && (
                                <>{" "}{o.effect_measure ? (o.effect_measure === "smd" ? "SMD" : formatCategory(o.effect_measure)) + " " : ""}{o.effect_value.toFixed(2)}</>
                              )}
                              {pStr ? ` ${pStr}` : ""}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Intervention stacked bar (custom) ────────────────────────────────
const INTERVENTION_PALETTE = [
  "#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#3b82f6", "#60a5fa",
  "#93c5fd", "#2dd4bf", "#34d399", "#4ade80", "#a3e635", "#facc15",
  "#fbbf24", "#f59e0b", "#fb923c", "#f87171", "#e879f9", "#c084fc",
  "#7dd3fc", "#5eead4", "#86efac", "#d9f99d", "#fde68a", "#fed7aa",
  "#fca5a5", "#f0abfc", "#a5b4fc", "#67e8f9", "#6ee7b7", "#bef264",
];

function hashColor(_name: string, index: number): string {
  return INTERVENTION_PALETTE[index % INTERVENTION_PALETTE.length];
}
const INTERVENTION_BAR_LIMIT = 30;

function InterventionStackedBar({ data, onInterventionClick }: { data: InterventionBar[]; onInterventionClick?: (interventionName: string) => void }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string; count: number; category: string } | null>(null);
  // One bar per intervention name (counts already merged across categories &
  // distinct-trial-counted in aggregateFromMetas), most-studied first. The long
  // tail of single-trial interventions is left to the table.
  const shown = data.slice(0, INTERVENTION_BAR_LIMIT);
  const maxCount = shown.length ? Math.max(...shown.map((d) => d.count)) : 0;
  const barHeight = 24;
  const labelWidth = 240;
  const chartWidth = 480;
  const rightPad = 44;
  const truncate = (s: string) => (s.length > 38 ? s.slice(0, 37) + "…" : s);

  return (
    <div className="relative">
      <svg width="100%" viewBox={`0 0 ${labelWidth + chartWidth + rightPad} ${shown.length * (barHeight + 6) + 10}`}>
        {shown.map((iv, rowIdx) => {
          const y = rowIdx * (barHeight + 6) + 4;
          const barWidth = maxCount ? (iv.count / maxCount) * chartWidth : 0;
          return (
            <g key={iv.name} className="cursor-pointer" onClick={() => onInterventionClick?.(iv.name)}>
              <title>{iv.name}</title>
              <text
                x={labelWidth - 8}
                y={y + barHeight / 2}
                textAnchor="end"
                dominantBaseline="central"
                fontSize={12}
                fill="currentColor"
                opacity={0.85}
                className="hover:underline"
              >
                {truncate(iv.name)}
              </text>
              <rect
                x={labelWidth}
                y={y}
                width={Math.max(barWidth, 1)}
                height={barHeight}
                fill={hashColor(iv.category, rowIdx)}
                opacity={0.85}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const parent = e.currentTarget.closest(".relative")!.getBoundingClientRect();
                  setTooltip({
                    x: rect.left - parent.left + rect.width / 2,
                    y: rect.top - parent.top - 8,
                    name: iv.name,
                    count: iv.count,
                    category: formatCategory(iv.category),
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              />
              <text
                x={labelWidth + Math.max(barWidth, 1) + 4}
                y={y + barHeight / 2}
                dominantBaseline="central"
                fontSize={11}
                fill="currentColor"
                opacity={0.6}
              >
                {iv.count}
              </text>
            </g>
          );
        })}
      </svg>
      {tooltip && (
        <div
          className="absolute bg-background border border-border rounded px-2 py-1 text-xs shadow-lg pointer-events-none z-10"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="font-semibold">{tooltip.name}</div>
          <div className="text-foreground/60">{tooltip.category} — {tooltip.count} trial{tooltip.count !== 1 ? "s" : ""}</div>
        </div>
      )}
    </div>
  );
}

// ── Shared UI helpers ────────────────────────────────────────────────
function ChartSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="font-semibold text-lg text-foreground">{title}</h3>
      {subtitle && <p className="text-sm text-foreground/50 mb-3">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-xs text-foreground/50 block mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-border rounded px-3 py-1.5 text-sm bg-background"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function FilterBadge({
  label,
  value,
  onClear,
  format,
}: {
  label: string;
  value: string | number | null;
  onClear: () => void;
  format?: (v: string) => string;
}) {
  if (value === null) return null;
  return (
    <div className="flex flex-col justify-end">
      <span className="text-xs text-foreground/50 block mb-1">{label}</span>
      <button
        onClick={onClear}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded border border-blue-100 text-sm hover:bg-blue-100 transition-colors"
      >
        {format ? format(String(value)) : String(value)}
        <span className="text-blue-400 font-bold">&times;</span>
      </button>
    </div>
  );
}

function OutcomeBadge({ row }: { row: TrialTableRow }) {
  const { primary_effect_value: ev, primary_p_value: p, primary_higher_is_better: hib } = row;

  // Can't determine anything
  if (ev == null && p == null) {
    return <span className="text-xs text-foreground/30">—</span>;
  }

  // Determine direction if possible
  let favorsIntervention: boolean | null = null;
  if (ev != null && hib != null) {
    favorsIntervention = hib ? ev > 0 : ev < 0;
  }

  const sig = p != null ? p < 0.05 : null;
  const pStr = p != null ? (p < 0.001 ? "<0.001" : `=${formatPValue(p)}`) : "";

  if (sig === true && favorsIntervention === true) {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap" style={{ backgroundColor: "#22c55e20", color: "#16a34a" }}>
        Favors intervention{pStr && <span className="opacity-70"> (p{pStr})</span>}
      </span>
    );
  }
  if (sig === true && favorsIntervention === false) {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap" style={{ backgroundColor: "#ef444420", color: "#dc2626" }}>
        Favors control{pStr && <span className="opacity-70"> (p{pStr})</span>}
      </span>
    );
  }
  if (sig === true && favorsIntervention == null) {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap" style={{ backgroundColor: "#f59e0b20", color: "#d97706" }}>
        Significant{pStr && <span className="opacity-70"> (p{pStr})</span>}
      </span>
    );
  }
  // Not significant
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap" style={{ backgroundColor: "#94a3b840", color: "#64748b" }}>
      No sig. diff.{pStr && <span className="opacity-70"> (p{pStr})</span>}
    </span>
  );
}

function RobBadge({ rob }: { rob: string }) {
  const color = ROB_COLORS[rob as keyof typeof ROB_COLORS] ?? "#888";
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: color + "20", color }}
    >
      {ROB_LABELS[rob] ?? rob}
    </span>
  );
}

function DetailLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-foreground font-medium uppercase tracking-wide text-[10px] mb-0.5 ${className}`}>
      {children}
    </div>
  );
}
