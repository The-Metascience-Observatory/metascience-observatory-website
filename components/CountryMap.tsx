"use client";

/**
 * Shared "Trials by country" choropleth for birds-eye-review dashboards.
 *
 * STANDARD DASHBOARD FEATURE. To add it to a review dashboard:
 *   1. In page.tsx, aggregate one distinct-trial count per country from each
 *      record's `study_design.countries`, as `CountryCount[]` ({country, count}).
 *      Country names are already synonym-merged by the pipeline export step
 *      (constants.COUNTRY_SYNONYMS), so no normalization is needed here.
 *   2. Render `<CountryMap allCountries={allCountries} />`.
 *   3. (Optional) Pass `onCountryClick` to wire click-to-filter to your table/charts.
 *
 * Self-contained: depends only on react-simple-maps + d3-geo (installed repo-wide)
 * and the world-atlas polygon set fetched from GEO_URL.
 */

import { useState, useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  Marker,
} from "react-simple-maps";
import { geoCentroid } from "d3-geo";

export type CountryCount = { country: string; count: number };

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Canonical country name (as written by the export step, which already merges
// synonyms like "USA"/"US" -> "United States") → world-atlas polygon name. Only
// the few canonical names that differ from the map's polygon names need an entry.
// NOTE: country synonym-merging lives in the pipeline (constants.COUNTRY_SYNONYMS);
// this map is purely the data-name → geo-polygon-name step. `countByName` below
// MUST still accumulate (not overwrite) as defense in depth.
const COUNTRY_NAME_MAPPING: Record<string, string> = {
  "United States": "United States of America",
  "Czech Republic": "Czechia",
};

// Reverse: map geo name → data name (for click filtering). Safe to auto-derive:
// canonical names are 1:1 with polygons, so no two data names share a geo key.
const REVERSE_COUNTRY_MAPPING: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_NAME_MAPPING).map(([data, geo]) => [geo, data])
);

export function CountryMap({
  allCountries,
  onCountryClick,
}: {
  allCountries: CountryCount[];
  onCountryClick?: (country: string) => void;
}) {
  const [tooltip, setTooltip] = useState<{ name: string; count: number; x: number; y: number } | null>(null);

  const countByName = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of allCountries) {
      const mapName = COUNTRY_NAME_MAPPING[c.country] ?? c.country;
      // Accumulate: if two data names ever resolve to the same polygon, their
      // counts must SUM, not overwrite. (This is what made the US show "2" — a
      // stray "United States of America" record clobbered "United States".)
      m.set(mapName, (m.get(mapName) ?? 0) + c.count);
    }
    return m;
  }, [allCountries]);

  const maxCount = useMemo(() => Math.max(...countByName.values(), 1), [countByName]);

  const getColor = (count: number) => {
    if (count === 0) return "#e2e8f0";
    const t = Math.pow(count / maxCount, 0.5); // sqrt scale for better spread
    const r = Math.round(219 - t * (219 - 30));
    const g = Math.round(234 - t * (234 - 64));
    const b = Math.round(254 - t * (254 - 175));
    return `rgb(${r},${g},${b})`;
  };

  return (
    <div className="relative">
      <ComposableMap
        projectionConfig={{ scale: 150, center: [10, 5] }}
        width={800}
        height={400}
        style={{ width: "100%", height: "auto" }}
      >
        <ZoomableGroup center={[0, 0]} zoom={1} minZoom={0.5} maxZoom={5}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) => (
              <>
                {geographies.map((geo) => {
                  const name = geo.properties.name;
                  const count = countByName.get(name) ?? 0;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={getColor(count)}
                      stroke="#fff"
                      strokeWidth={0.5}
                      onMouseEnter={(e) => {
                        if (count > 0) {
                          const rect = (e.target as SVGElement).closest("svg")!.getBoundingClientRect();
                          setTooltip({
                            name: geo.properties.name,
                            count,
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top,
                          });
                        }
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      onClick={() => {
                        if (count > 0 && onCountryClick) {
                          const dataName = REVERSE_COUNTRY_MAPPING[name] ?? name;
                          onCountryClick(dataName);
                        }
                      }}
                      style={{
                        default: { outline: "none", cursor: count > 0 ? "pointer" : "default" },
                        hover: { outline: "none", fill: count > 0 ? "#2563eb" : "#e2e8f0", cursor: count > 0 ? "pointer" : "default" },
                        pressed: { outline: "none" },
                      }}
                    />
                  );
                })}
                {geographies.map((geo) => {
                  const name = geo.properties.name;
                  const count = countByName.get(name) ?? 0;
                  if (count === 0) return null;
                  const centroid = geoCentroid(geo);
                  return (
                    <Marker key={geo.rsmKey + "-label"} coordinates={centroid}>
                      <text
                        textAnchor="middle"
                        y={2}
                        style={{
                          fontFamily: "system-ui, sans-serif",
                          fill: "#fff",
                          fontSize: "8px",
                          fontWeight: "bold",
                          pointerEvents: "none",
                          stroke: "rgba(0,0,0,0.5)",
                          strokeWidth: "1.5px",
                          paintOrder: "stroke",
                        }}
                      >
                        {count}
                      </text>
                    </Marker>
                  );
                })}
              </>
            )}
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
      {tooltip && (
        <div
          className="absolute bg-background border border-border rounded px-2 py-1 text-xs shadow-lg pointer-events-none z-10"
          style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -120%)" }}
        >
          <div className="font-semibold">{tooltip.name}</div>
          <div className="text-foreground/60">{tooltip.count} trial{tooltip.count !== 1 ? "s" : ""}</div>
        </div>
      )}
    </div>
  );
}
