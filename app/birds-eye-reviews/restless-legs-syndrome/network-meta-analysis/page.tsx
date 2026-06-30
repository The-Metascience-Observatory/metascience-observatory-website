import fs from "fs";
import path from "path";
import Link from "next/link";
import { BirdsEyeNavbar } from "@/components/BirdsEyeNavbar";
import { Footer } from "@/components/Footer";

export const metadata = {
  title: "Network Meta-Analysis | Restless Legs Syndrome | Bird's Eye Reviews | The Metascience Observatory",
  description:
    "Automated network meta-analysis of restless legs syndrome drug trials (IRLS symptom severity), reproducing the design of Zhou et al. 2021.",
};

const DATA_DIR = "data/birds_eye_reviews/restless_legs_syndrome";
const dataPath = (f: string) => path.join(process.cwd(), DATA_DIR, f);

interface RankRow { treat: string; MD: number; ci_low: number; ci_high: number; pscore: number; n_trials: number; }
interface NodeRow { treat: string; n_trials: number; n_participants: number; pscore: number; }
interface EdgeRow { treat1: string; treat2: string; n_studies: number; }
interface NMA {
  meta: { scale: string; measure: string; reference: string; model: string; engine: string;
    n_studies: number; n_treatments: number; n_pairwise: number; tau: number; tau2: number; I2: number; };
  ranking: RankRow[];
  nodes: NodeRow[];
  edges: EdgeRow[];
  league: { treatments: string[]; MD: number[][]; ci_low: number[][]; ci_high: number[][] };
  inconsistency: { available: boolean; n_comparisons_tested?: number; n_significant?: number; min_p?: number };
}

function loadNMA(): NMA | null {
  const fp = dataPath("network_meta_analysis.json");
  if (!fs.existsSync(fp)) return null;
  try { return JSON.parse(fs.readFileSync(fp, "utf-8")) as NMA; }
  catch (e) { console.error("Failed to load network_meta_analysis.json:", e); return null; }
}

const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const f2 = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(2);

/** Circular network diagram of the core (≥2-trial) treatments + placebo. Nodes
 *  sized by trial count; edges (direct comparisons) weighted by number of studies. */
function NetworkDiagram({ nodes, edges }: { nodes: NodeRow[]; edges: EdgeRow[] }) {
  const core = nodes.filter((n) => n.n_trials >= 2 || n.treat === "placebo");
  const names = new Set(core.map((n) => n.treat));
  const W = 760, H = 560, cx = W / 2, cy = H / 2, R = 215;
  // placebo at center, the rest evenly on a circle
  const ring = core.filter((n) => n.treat !== "placebo")
    .sort((a, b) => b.n_trials - a.n_trials);
  const pos: Record<string, { x: number; y: number }> = { placebo: { x: cx, y: cy } };
  ring.forEach((n, i) => {
    const a = (i / ring.length) * 2 * Math.PI - Math.PI / 2;
    pos[n.treat] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  const maxN = Math.max(...core.map((n) => n.n_trials), 1);
  const rad = (n: number) => 7 + 17 * Math.sqrt(n / maxN);
  const maxStud = Math.max(...edges.map((e) => e.n_studies), 1);
  const shown = edges.filter((e) => names.has(e.treat1) && names.has(e.treat2));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {shown.map((e, i) => {
        const a = pos[e.treat1], b = pos[e.treat2];
        if (!a || !b) return null;
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#cbd5e1"
          strokeWidth={1 + 3 * (e.n_studies / maxStud)} />;
      })}
      {core.map((n) => {
        const p = pos[n.treat]; if (!p) return null;
        const isPbo = n.treat === "placebo";
        const lab = isPbo ? "Placebo" : cap(n.treat);
        const short = lab.length > 22 ? lab.slice(0, 21) + "…" : lab;
        const right = p.x >= cx;
        return (
          <g key={n.treat}>
            <circle cx={p.x} cy={p.y} r={rad(n.n_trials)} fill={isPbo ? "#94a3b8" : "#1d4ed8"}
              fillOpacity={isPbo ? 0.9 : 0.85} stroke="#fff" strokeWidth={1.5} />
            <text x={isPbo ? p.x : p.x + (right ? rad(n.n_trials) + 4 : -(rad(n.n_trials) + 4))}
              y={isPbo ? p.y + 4 : p.y + 3} fontSize={11}
              textAnchor={isPbo ? "middle" : right ? "start" : "end"}
              className="fill-foreground/80" style={{ fontWeight: isPbo ? 700 : 500 }}>
              {short}{!isPbo ? ` (${n.n_trials})` : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Forest of core treatments vs placebo (negative MD = symptom improvement). */
function VsPlaceboForest({ rows }: { rows: RankRow[] }) {
  const data = rows.filter((r) => r.treat !== "placebo").sort((a, b) => a.MD - b.MD);
  const vals = data.flatMap((r) => [r.ci_low, r.ci_high]).concat(0);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const LABEL = 210, PLOT = 360, VAL = 150, W = LABEL + PLOT + VAL, ROW = 26, H = data.length * ROW + 46;
  const X = (v: number) => LABEL + ((v - lo) / (hi - lo)) * PLOT;
  const ticks = [lo, lo + (hi - lo) / 2, hi];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto text-foreground">
      <text x={0} y={14} fontSize={11} fontWeight={600}>Treatment</text>
      <text x={W} y={14} fontSize={11} fontWeight={600} textAnchor="end">MD vs placebo (95% CI)</text>
      <line x1={X(0)} y1={24} x2={X(0)} y2={24 + data.length * ROW} stroke="#9ca3af" strokeDasharray="3 3" />
      {data.map((r, i) => {
        const cy = 24 + i * ROW + ROW / 2;
        const sig = r.ci_high < 0 || r.ci_low > 0;
        const lab = cap(r.treat); const short = lab.length > 30 ? lab.slice(0, 29) + "…" : lab;
        return (
          <g key={r.treat}>
            <text x={0} y={cy + 3} fontSize={11} className="fill-foreground/80">{short} ({r.n_trials})</text>
            <line x1={X(r.ci_low)} y1={cy} x2={X(r.ci_high)} y2={cy} stroke={sig ? "#16a34a" : "#94a3b8"} strokeWidth={1.5} />
            <rect x={X(r.MD) - 4} y={cy - 4} width={8} height={8} fill={sig ? "#16a34a" : "#94a3b8"} />
            <text x={W} y={cy + 3} fontSize={11} textAnchor="end" className="fill-foreground/70 tabular-nums">
              {r.MD.toFixed(2)} ({r.ci_low.toFixed(2)}, {r.ci_high.toFixed(2)})
            </text>
          </g>
        );
      })}
      {ticks.map((t, i) => (
        <g key={i}>
          <text x={X(t)} y={H - 16} fontSize={10} textAnchor="middle" className="fill-foreground/60">{t.toFixed(1)}</text>
        </g>
      ))}
      <text x={X(0)} y={H - 3} fontSize={9} textAnchor="middle" className="fill-foreground/45">
        ← favors treatment (lower IRLS)   ·   no effect = 0   ·   favors placebo →
      </text>
    </svg>
  );
}

/** Compact league heatmap over the core treatments (row vs column MD). */
function LeagueTable({ nma, core }: { nma: NMA; core: string[] }) {
  const idx = (t: string) => nma.league.treatments.indexOf(t);
  const order = ["placebo", ...core.filter((t) => t !== "placebo")];
  const color = (v: number) => {
    if (!isFinite(v) || v === 0) return "transparent";
    const m = Math.min(Math.abs(v) / 12, 1);
    return v < 0 ? `rgba(22,163,74,${0.12 + 0.5 * m})` : `rgba(220,38,38,${0.12 + 0.5 * m})`;
  };
  return (
    <div className="overflow-x-auto">
      <table className="text-[10px] border-collapse">
        <thead><tr><th className="p-1"></th>{order.map((c) => (
          <th key={c} className="p-1 font-medium text-foreground/60 whitespace-nowrap" style={{ writingMode: "vertical-rl" }}>{cap(c)}</th>
        ))}</tr></thead>
        <tbody>
          {order.map((r) => (
            <tr key={r}>
              <td className="p-1 font-medium text-foreground/70 whitespace-nowrap text-right pr-2">{cap(r)}</td>
              {order.map((c) => {
                if (r === c) return <td key={c} className="p-1 text-center text-foreground/30 bg-foreground/5">—</td>;
                const v = nma.league.MD[idx(r)]?.[idx(c)];
                return <td key={c} className="p-1 text-center tabular-nums" style={{ background: color(v) }}
                  title={`${cap(r)} vs ${cap(c)}: ${f2(v)}`}>{isFinite(v) ? f2(v) : ""}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-foreground/55">Cell = row treatment vs column treatment, IRLS mean difference
        (green/negative favors the <em>row</em>; red/positive favors the <em>column</em>).</p>
    </div>
  );
}

export default function NetworkMetaAnalysisPage() {
  const nma = loadNMA();
  return (
    <>
      <BirdsEyeNavbar />
      <main className="container mx-auto px-4 pt-24 pb-16 min-h-screen max-w-5xl">
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/birds-eye-reviews" className="text-sm text-blue-600 hover:text-blue-700">&larr; Back to Bird&apos;s Eye Reviews</Link>
          <Link href="/birds-eye-reviews/restless-legs-syndrome" className="text-sm text-blue-600 hover:text-blue-700">&larr; Back to clinical trial results</Link>
        </div>
        <h1 className="font-clarendon font-bold text-3xl mb-2">Restless Legs Syndrome — Network Meta-Analysis</h1>

        {!nma ? (
          <p className="text-sm text-foreground/60 mt-4">No network meta-analysis has been generated for this review.</p>
        ) : (() => {
          const core = nma.nodes.filter((n) => n.n_trials >= 2).map((n) => n.treat);
          const coreRank = nma.ranking.filter((r) => r.n_trials >= 2);
          const singles = nma.ranking.filter((r) => r.n_trials === 1).sort((a, b) => b.pscore - a.pscore);
          const by = Object.fromEntries(nma.ranking.map((r) => [r.treat, r]));
          const ppx = by["pramipexole"], rop = by["ropinirole"], cab = by["cabergoline"], lev = by["levodopa/benserazide"];
          return (
            <>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-6 text-sm text-amber-900">
                <strong>Automated analysis.</strong> This network meta-analysis is computed from machine-extracted trial
                data and reproduces the design of the published Zhou et al. 2021 RLS NMA (Front. Neurosci. 15:751643) as a
                validation target. It is a research artifact, not a substitute for a hand-curated review — see caveats below.
              </div>

              <p className="text-sm text-foreground/70 mb-1">
                Comparing all randomized RLS treatments on one scale ({nma.meta.scale}) by combining direct and indirect
                evidence. Reference = {nma.meta.reference}; {nma.meta.model} via {nma.meta.engine}.
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-foreground/60 mb-6">
                <span><strong className="text-foreground/80">{nma.meta.n_studies}</strong> studies</span>
                <span><strong className="text-foreground/80">{nma.meta.n_treatments}</strong> treatments</span>
                <span>τ = {nma.meta.tau}, I² = {nma.meta.I2}%</span>
                {nma.inconsistency.available && (
                  <span>inconsistency: {nma.inconsistency.n_significant}/{nma.inconsistency.n_comparisons_tested} significant
                    {nma.inconsistency.n_significant === 0 ? " (consistent)" : ""}</span>
                )}
              </div>

              <section className="mb-10">
                <h2 className="text-lg font-semibold mb-1">Evidence network</h2>
                <p className="text-sm text-foreground/60 mb-3">Core treatments (≥2 trials) + placebo. Node size ∝ number
                  of trials; line thickness ∝ number of direct head-to-head studies.</p>
                <div className="border border-border rounded-lg bg-white p-3"><NetworkDiagram nodes={nma.nodes} edges={nma.edges} /></div>
              </section>

              <section className="mb-10">
                <h2 className="text-lg font-semibold mb-1">Effect vs placebo (core drugs)</h2>
                <div className="border border-border rounded-lg bg-white p-4"><VsPlaceboForest rows={coreRank} /></div>
              </section>

              <section className="mb-10">
                <h2 className="text-lg font-semibold mb-1">Ranking (core drugs, ≥2 trials)</h2>
                <p className="text-sm text-foreground/60 mb-3">P-score is the frequentist analogue of SUCRA (higher = better).</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-foreground/60 border-b border-border">
                      <th className="py-1 pr-3">Treatment</th><th className="py-1 pr-3 text-right">Trials</th>
                      <th className="py-1 pr-3">MD vs placebo (95% CI)</th><th className="py-1 pr-3 w-40">P-score</th>
                    </tr></thead>
                    <tbody>
                      {coreRank.filter((r) => r.treat !== "placebo").map((r) => {
                        const sig = r.ci_high < 0 || r.ci_low > 0;
                        return (
                          <tr key={r.treat} className="border-b border-border/50">
                            <td className="py-1 pr-3 capitalize font-medium">{r.treat}</td>
                            <td className="py-1 pr-3 text-right tabular-nums">{r.n_trials}</td>
                            <td className={`py-1 pr-3 tabular-nums ${sig ? "text-green-700" : "text-foreground/60"}`}>
                              {r.MD.toFixed(2)} ({r.ci_low.toFixed(2)}, {r.ci_high.toFixed(2)})</td>
                            <td className="py-1 pr-3">
                              <div className="flex items-center gap-2">
                                <div className="h-2 rounded bg-blue-500" style={{ width: `${Math.round(r.pscore * 100)}%` }} />
                                <span className="tabular-nums text-foreground/60">{r.pscore.toFixed(2)}</span>
                              </div></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="mb-10">
                <h2 className="text-lg font-semibold mb-3">League table (core treatments)</h2>
                <LeagueTable nma={nma} core={core} />
              </section>

              <section className="mb-10">
                <h2 className="text-lg font-semibold mb-2">Validation vs Zhou et al. 2021</h2>
                <ul className="text-sm text-foreground/75 space-y-1 list-disc pl-5">
                  {cab && <li><strong>Cabergoline largest effect</strong> (Zhou MD −11.98) — our MD {cab.MD.toFixed(2)}. {Math.abs(cab.MD + 11.98) < 6 ? "✅" : "⚠️"}</li>}
                  {ppx && rop && <li><strong>Pramipexole superior to ropinirole</strong> (Zhou MD −2.52) — our difference {(ppx.MD - rop.MD).toFixed(2)}. {ppx.MD < rop.MD ? "✅" : "⚠️"}</li>}
                  {lev && <li><strong>Levodopa not significantly better than placebo</strong> — our CI {(lev.ci_high < 0 || lev.ci_low > 0) ? "excludes 0 ⚠️" : "crosses 0 ✅"}.</li>}
                </ul>
              </section>

              {singles.length > 0 && (
                <section className="mb-10">
                  <h2 className="text-lg font-semibold mb-1">Single-trial treatments (low evidence)</h2>
                  <p className="text-sm text-foreground/60 mb-3">These can top the P-score ranking but rest on one small
                    trial each ({singles.length} total) — shown for completeness, not as recommendations.</p>
                  <div className="flex flex-wrap gap-2">
                    {singles.slice(0, 12).map((r) => (
                      <span key={r.treat} className="text-xs rounded-full border border-border px-2 py-0.5 text-foreground/70 capitalize">
                        {r.treat} ({r.MD.toFixed(1)})</span>
                    ))}
                  </div>
                </section>
              )}

              <section className="mb-6">
                <h2 className="text-lg font-semibold mb-2">Caveats</h2>
                <ul className="text-sm text-foreground/65 space-y-1 list-disc pl-5">
                  <li><strong>Automated extraction.</strong> Effect signs, SDs (often derived from SE/CI), arm drug identity
                    and timepoints were machine-extracted; an NMA propagates such errors through indirect links.</li>
                  <li><strong>Heterogeneity is high</strong> (I² = {nma.meta.I2}%): a broad 2004–present pull mixes
                    severities, primary/secondary RLS, doses and trial lengths, weakening transitivity.</li>
                  <li><strong>Scope.</strong> One IRLS 0–40 scale only; endpoint scores preferred; crossover handled
                    approximately; non-randomized designs excluded.</li>
                  <li><strong>Sparse nodes.</strong> Most compounds have a single trial; the credible signal is the
                    ≥2-trial core above.</li>
                </ul>
              </section>
            </>
          );
        })()}
      </main>
      <Footer />
    </>
  );
}
