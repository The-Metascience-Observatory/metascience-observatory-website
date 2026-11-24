"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuditTrial, MapCluster, MapDomain, SeverityLevel } from "./types";

/** A map of studies clustered by the treatment they test.
 *
 *  Positions are computed by the pipeline (scripts/build_trial_map.py): each
 *  treatment is a disc of dots with its oldest study at the centre, so a disc
 *  grows outward as the year slider advances. Shape carries design (circle =
 *  randomized, square = not), so no reading of the map depends on colour alone. */

export type ColourMode = "domain" | "result" | "rigor" | "issues";

// Okabe-Ito first, then extras that stay distinguishable beside them.
const DOMAIN_COLOURS = ["#0072B2", "#E69F00", "#009E73", "#CC79A7", "#56B4E9", "#D55E00",
  "#7A5195", "#8C6D31", "#00796B", "#B0457B", "#5F6B7A", "#9C9A00"];
export const RESULT_COLOURS: Record<string, { label: string; color: string }> = {
  favors_treatment: { label: "Favors treatment", color: "#16a34a" },
  mixed: { label: "Mixed", color: "#f59e0b" },
  no_difference: { label: "No significant difference", color: "#64748b" },
  favors_control: { label: "Favors control", color: "#dc2626" },
  inconclusive: { label: "No directional verdict", color: "#b6c2d1" },
  unknown: { label: "Result unknown", color: "#dbe2ea" },
};
const RIGOR_STOPS = ["#e8eef7", "#bcd0ea", "#86abd9", "#4d82c3", "#1f5aa6", "#0b2f6b"];
const NOT_AUDITED = "#ffffff";

export const rigorColour = (score: number | null) =>
  score == null ? NOT_AUDITED : RIGOR_STOPS[Math.min(RIGOR_STOPS.length - 1, Math.floor(score / (100 / RIGOR_STOPS.length)))];

/** Break a label into at most two balanced lines so neighbouring discs' labels do not collide. */
function wrapLabel(label: string, max = 20): string[] {
  if (label.length <= max) return [label];
  const words = label.split(" ");
  let best = 1, gap = Infinity;
  for (let i = 1; i < words.length; i++) {
    const diff = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
    if (diff < gap) { gap = diff; best = i; }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

function dotRadius(n: number | null) {
  if (!n || n <= 0) return 2.6;
  return Math.max(2.4, Math.min(4.6, 1.5 + Math.sqrt(n) / 7));
}

interface Props {
  trials: AuditTrial[];
  domains: MapDomain[];
  clusters: MapCluster[];
  width: number;
  height: number;
  ladder: SeverityLevel[];
  hasAudit: boolean;
  selectedCluster: string | null;
  onSelectCluster: (id: string | null) => void;
  selectedTrial: string | null;
  onSelectTrial: (id: string | null) => void;
}

interface View { x: number; y: number; w: number; h: number }

export function TreatmentMap(props: Props) {
  const { trials, domains, clusters, width, height, ladder, hasAudit } = props;
  const placed = useMemo(() => trials.filter((t) => t.x != null && t.y != null), [trials]);
  const years = useMemo(() => {
    const ys = placed.map((t) => t.year).filter((y): y is number => y != null);
    return ys.length ? { min: Math.min(...ys), max: Math.max(...ys) } : { min: 2020, max: 2026 };
  }, [placed]);
  const [mode, setMode] = useState<ColourMode>("domain");
  const [year, setYear] = useState(years.max);
  const [playing, setPlaying] = useState(false);
  const full: View = useMemo(() => ({ x: 0, y: 0, w: width, h: height }), [width, height]);
  const [view, setView] = useState<View>(full);
  useEffect(() => { setView(full); }, [full]); // the page re-packs the layout when the window changes shape
  const [hover, setHover] = useState<{ trial: AuditTrial; px: number; py: number } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(null);

  const domainColour = useMemo(
    () => new Map(domains.map((d, i) => [d.id, DOMAIN_COLOURS[i % DOMAIN_COLOURS.length]])), [domains]);
  const severityColour = useMemo(() => new Map(ladder.map((l) => [l.n, l.color])), [ladder]);

  useEffect(() => { setYear(years.max); }, [years.max]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setYear((y) => { if (y >= years.max) { setPlaying(false); return y; } return y + 1; });
    }, 900);
    return () => clearInterval(timer);
  }, [playing, years.max]);

  const fill = useCallback((t: AuditTrial) => {
    if (mode === "domain") return domainColour.get(t.domain ?? "") ?? "#94a3b8";
    if (mode === "result") return (RESULT_COLOURS[t.verdict] ?? RESULT_COLOURS.unknown).color;
    if (mode === "rigor") return rigorColour(t.stage ? t.rigor : null);
    if (!t.stage) return NOT_AUDITED;
    return t.maxSeverity >= 2 ? severityColour.get(t.maxSeverity) ?? "#f97316" : "#d7dee7";
  }, [mode, domainColour, severityColour]);

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    setView((v) => {
      const w = Math.max(width / 12, Math.min(width, v.w * factor));
      const h = w * (height / width);
      const px = cx ?? v.x + v.w / 2, py = cy ?? v.y + v.h / 2;
      const x = px - (px - v.x) * (w / v.w), y = py - (py - v.y) * (h / v.h);
      return { x: Math.max(-w * 0.2, Math.min(width - w * 0.8, x)), y: Math.max(-h * 0.2, Math.min(height - h * 0.8, y)), w, h };
    });
  }, [width, height]);

  const toMap = (clientX: number, clientY: number) => {
    const box = svg.current!.getBoundingClientRect();
    return { x: view.x + ((clientX - box.left) / box.width) * view.w, y: view.y + ((clientY - box.top) / box.height) * view.h, box };
  };

  // Non-passive wheel listener so the page does not scroll while zooming the map.
  useEffect(() => {
    const node = svg.current;
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 40) return; // let gentle scrolls pass
      e.preventDefault();
      const box = node.getBoundingClientRect();
      setView((v) => {
        const cx = v.x + ((e.clientX - box.left) / box.width) * v.w, cy = v.y + ((e.clientY - box.top) / box.height) * v.h;
        const factor = e.deltaY > 0 ? 1.18 : 1 / 1.18;
        const w = Math.max(width / 12, Math.min(width, v.w * factor)), h = w * (height / width);
        return { x: cx - (cx - v.x) * (w / v.w), y: cy - (cy - v.y) * (h / v.h), w, h };
      });
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [width, height]);

  const zoomedIn = view.w < width * 0.62;
  const scale = view.w / width; // <1 when zoomed in; keeps labels a readable size

  const legend = (() => {
    if (mode === "domain") return domains.map((d) => ({ label: d.label, color: domainColour.get(d.id)! }));
    if (mode === "result") return Object.values(RESULT_COLOURS);
    if (mode === "rigor") return [
      ...RIGOR_STOPS.map((color, i) => ({ label: i === 0 ? "Rigor 0" : i === RIGOR_STOPS.length - 1 ? "100" : "", color })),
      { label: "Not yet audited", color: NOT_AUDITED }];
    return [{ label: "No confirmed issue", color: "#d7dee7" },
      ...ladder.filter((l) => l.n >= 2).map((l) => ({ label: `${l.n} ${l.label}`, color: l.color })),
      { label: "Not yet audited", color: NOT_AUDITED }];
  })();

  const modes: [ColourMode, string][] = [["domain", "Kind of treatment"], ["result", "Result"],
    ...(hasAudit ? [["rigor", "Rigor score"], ["issues", "Most serious issue"]] as [ColourMode, string][] : [])];
  const shown = placed.filter((t) => t.year == null || t.year <= year).length;

  return (
    <div className="border border-border rounded-lg bg-white">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-3 py-2 text-sm">
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Colour the map by">
          <span className="text-foreground/60 mr-1">Colour by</span>
          {modes.map(([key, label]) => (
            <button key={key} type="button" onClick={() => setMode(key)} aria-pressed={mode === key}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${mode === key ? "border-blue-600 bg-blue-600 text-white" : "border-border bg-white hover:bg-muted"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { if (year >= years.max) setYear(years.min); setPlaying((p) => !p); }}
            className="rounded border border-border px-2 py-1 text-xs font-medium hover:bg-muted">
            {playing ? "Pause" : "Play the years"}
          </button>
          <label className="flex items-center gap-2 text-xs text-foreground/70">
            <span className="sr-only">Show studies published up to</span>
            <input type="range" min={years.min} max={years.max} step={1} value={year}
              onChange={(e) => { setPlaying(false); setYear(Number(e.target.value)); }} className="w-28 sm:w-40" />
            <span className="tabular-nums font-medium text-foreground">to {year}</span>
            <span className="tabular-nums">({shown} studies)</span>
          </label>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" aria-label="Zoom in" onClick={() => zoomAt(1 / 1.5)} className="h-7 w-7 rounded border border-border hover:bg-muted">+</button>
          <button type="button" aria-label="Zoom out" onClick={() => zoomAt(1.5)} className="h-7 w-7 rounded border border-border hover:bg-muted">&minus;</button>
          <button type="button" onClick={() => setView(full)} className="h-7 rounded border border-border px-2 text-xs hover:bg-muted">Reset</button>
        </div>
      </div>

      <div className="relative">
        <svg ref={svg} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} role="img"
          aria-label="Map of studies grouped by the treatment tested. The same information is in the treatments table below."
          className="block w-full touch-none select-none" style={{ aspectRatio: `${width} / ${height}`, maxHeight: "80vh", cursor: drag.current ? "grabbing" : "grab" }}
          onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, view, moved: false }; }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const box = svg.current!.getBoundingClientRect();
            const dx = e.clientX - d.x, dy = e.clientY - d.y;
            if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
            if (d.moved) { setHover(null); setView({ ...d.view, x: d.view.x - (dx / box.width) * d.view.w, y: d.view.y - (dy / box.height) * d.view.h }); }
          }}
          onPointerUp={() => { setTimeout(() => { drag.current = null; }, 0); }}
          onPointerLeave={() => { drag.current = null; setHover(null); }}
          onClick={() => { if (!drag.current?.moved) { props.onSelectCluster(null); props.onSelectTrial(null); } }}>
          {domains.map((d) => (
            <circle key={d.id} cx={d.x} cy={d.y} r={d.r + 10} fill={domainColour.get(d.id)} fillOpacity={0.06}
              stroke={domainColour.get(d.id)} strokeOpacity={0.35} strokeWidth={1.2 * scale} />
          ))}
          {clusters.map((c) => {
            const active = props.selectedCluster === c.id;
            return (
              <circle key={c.id} cx={c.x} cy={c.y} r={c.r} fill="#ffffff" fillOpacity={0.75}
                stroke={active ? "#111827" : "#cbd5e1"} strokeWidth={(active ? 2.2 : 0.8) * scale}
                className="cursor-pointer"
                onClick={(e) => { e.stopPropagation(); if (!drag.current?.moved) props.onSelectCluster(active ? null : c.id); }}>
                <title>{`${c.label}: ${c.n} studies. ${c.description}`}</title>
              </circle>
            );
          })}
          {placed.map((t) => {
            const visible = t.year == null || t.year <= year;
            const dim = props.selectedCluster != null && t.cluster !== props.selectedCluster;
            const r = dotRadius(t.n), chosen = props.selectedTrial === t.id;
            const common = {
              fill: fill(t), stroke: chosen ? "#111827" : "#334155", strokeWidth: (chosen ? 1.8 : 0.45),
              opacity: visible ? (dim ? 0.18 : 1) : 0, style: { transition: "opacity 400ms", pointerEvents: visible ? "auto" : "none" } as const,
              className: "cursor-pointer",
              onPointerEnter: (e: React.PointerEvent) => { if (drag.current?.moved) return; const p = toMap(e.clientX, e.clientY); setHover({ trial: t, px: e.clientX - p.box.left, py: e.clientY - p.box.top }); },
              onPointerLeave: () => setHover(null),
              onClick: (e: React.MouseEvent) => { e.stopPropagation(); if (!drag.current?.moved) props.onSelectTrial(chosen ? null : t.id); },
            };
            return t.randomized
              ? <circle key={t.id} cx={t.x} cy={t.y} r={r} {...common} />
              : <rect key={t.id} x={t.x! - r * 0.86} y={t.y! - r * 0.86} width={r * 1.72} height={r * 1.72} rx={0.6} {...common} />;
          })}
          {/* Labels last, with a halo, so they stay legible over the dots. */}
          {domains.map((d) => {
            const size = 16 * Math.max(scale, 0.45), lines = wrapLabel(d.label, 26);
            return (
              <text key={d.id} x={d.x} y={d.y - d.r - 16 * scale - (lines.length - 1) * size * 1.1} textAnchor="middle" fontSize={size}
                fontWeight={700} fill={domainColour.get(d.id)} stroke="#ffffff" strokeWidth={4 * scale} paintOrder="stroke" pointerEvents="none">
                {lines.map((line, i) => <tspan key={i} x={d.x} dy={i === 0 ? 0 : size * 1.1}>{line}</tspan>)}
              </text>
            );
          })}
          {clusters.filter((c) => zoomedIn || c.n >= 9 || props.selectedCluster === c.id).map((c) => {
            const size = 9.5 * Math.max(scale, 0.42), lines = wrapLabel(`${c.label} (${c.n})`);
            return (
              <text key={c.id} x={c.x} y={c.y + c.r + size * 1.05} textAnchor="middle" fontSize={size}
                fontWeight={600} fill="#1f2937" stroke="#ffffff" strokeWidth={3 * scale} paintOrder="stroke" pointerEvents="none">
                {lines.map((line, i) => <tspan key={i} x={c.x} dy={i === 0 ? 0 : size * 1.12}>{line}</tspan>)}
              </text>
            );
          })}
        </svg>
        {hover && (
          <div className="pointer-events-none absolute z-10 max-w-xs rounded-md border border-border bg-white p-2 text-xs shadow-lg"
            style={{ left: Math.min(hover.px + 12, (svg.current?.clientWidth ?? 600) - 260), top: hover.py + 12 }}>
            <p className="font-semibold leading-snug">{hover.trial.title}</p>
            <p className="mt-1 text-foreground/70">{[hover.trial.authors, hover.trial.year].filter(Boolean).join(", ")}</p>
            <p className="mt-1">{hover.trial.design}{hover.trial.n ? ` · N ${hover.trial.n}` : ""} · {(RESULT_COLOURS[hover.trial.verdict] ?? RESULT_COLOURS.unknown).label}</p>
            {hover.trial.treatments.length > 0 && <p className="mt-1 text-foreground/70">{hover.trial.treatments.join("; ")}</p>}
            {hover.trial.stage && <p className="mt-1">Rigor {hover.trial.rigor ?? "n/a"} · {hover.trial.issues.filter((i) => i.status === "confirmed").length} confirmed issue(s)</p>}
            <p className="mt-1 text-foreground/50">Click for details</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-3 py-2 text-xs text-foreground/80">
        {legend.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full border border-slate-500" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-3 text-foreground/60">
          <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full border border-slate-600" /> randomized</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 border border-slate-600" /> not randomized</span>
          <span>larger = more participants · oldest study at each centre</span>
        </span>
      </div>
    </div>
  );
}
