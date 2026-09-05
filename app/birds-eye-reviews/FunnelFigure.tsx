import type { CSSProperties } from "react";

import styles from "./funnel.module.css";

/* The pipeline diagram at the top of the overview page — one review end to end:
 * papers stream out of five literature databases, pass a screen where the
 * excluded ones fall away in red, fill an evidence table cell by cell, and
 * render as a live dashboard.
 *
 * Ported from the Bird's Eye Review Studio's landing page. Styling and the
 * animation live in ./funnel.module.css.
 *
 * All "random" scatter (paper positions, sizes, timing offsets) comes from a
 * seeded LCG evaluated once at module scope, so the flock is identical on every
 * render. Keep the seed: Math.random() here would make the figure churn between
 * builds and would be a hydration mismatch if this ever becomes a client
 * component.
 */

function lcg(seed: number) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}
const rnd = lcg(42);

/** Vertical centers of the five database nodes papers spawn from. */
const DB_Y = [87, 135, 183, 231, 279];

const PAPERS = Array.from({ length: 34 }, (_, i) => ({
  excluded: rnd() < 0.62, // most papers screen out
  y0: DB_Y[i % DB_Y.length] - 14 + (rnd() * 16 - 8),
  lane: 120 + rnd() * 120, // converge band before the gates
  delay: -(rnd() * 15), // negative: loop already in motion
  staticX: 150 + rnd() * 210, // reduced-motion resting spot
  lines: [0, 1, 2].map(() => 9 + rnd() * 6),
}));

/** Evidence-table cells that pop in one by one as papers are absorbed.
 *  kind picks the fill; co is the resting opacity the animation returns to. */
const TABLE_CELLS: Array<{
  cd: number;
  x: number;
  y: number;
  w: number;
  kind: "label" | "val" | "valSoft" | "inc" | "pend";
  co?: number;
}> = [
  { cd: 0.3, x: 686, y: 159, w: 34, kind: "label" },
  { cd: 1.1, x: 726, y: 159, w: 20, kind: "val", co: 0.6 },
  { cd: 2.0, x: 752, y: 159, w: 28, kind: "valSoft", co: 0.35 },
  { cd: 2.8, x: 786, y: 159, w: 22, kind: "inc", co: 0.55 },
  { cd: 3.9, x: 686, y: 177, w: 30, kind: "label" },
  { cd: 4.8, x: 726, y: 177, w: 26, kind: "val", co: 0.6 },
  { cd: 5.7, x: 758, y: 177, w: 18, kind: "pend", co: 0.6 },
  { cd: 6.5, x: 782, y: 177, w: 26, kind: "valSoft", co: 0.35 },
  { cd: 7.6, x: 686, y: 195, w: 38, kind: "label" },
  { cd: 8.5, x: 730, y: 195, w: 16, kind: "val", co: 0.6 },
  { cd: 9.3, x: 752, y: 195, w: 30, kind: "valSoft", co: 0.35 },
  { cd: 10.6, x: 686, y: 213, w: 28, kind: "label" },
  { cd: 11.4, x: 720, y: 213, w: 24, kind: "val", co: 0.6 },
  { cd: 12.2, x: 750, y: 213, w: 20, kind: "inc", co: 0.55 },
  { cd: 12.9, x: 776, y: 213, w: 30, kind: "valSoft", co: 0.35 },
];
const TABLE_DOTS: Array<{ cd: number; cy: number; fill: "inc" | "pend" }> = [
  { cd: 3.4, cy: 163.5, fill: "inc" },
  { cd: 7.0, cy: 181.5, fill: "inc" },
  { cd: 10.0, cy: 199.5, fill: "pend" },
  { cd: 13.5, cy: 217.5, fill: "inc" },
];
const CELL_FILL: Record<string, string> = {
  label: "var(--card-line)",
  val: "hsl(var(--primary))",
  valSoft: "hsl(var(--primary))",
  inc: "var(--inc)",
  pend: "var(--pend)",
};

const DATABASES = [
  "PubMed",
  "OpenAlex",
  "Europe PMC",
  "Semantic Scholar",
  "CyberLeninka",
];

/** Dashboard bars: x, y (top), height, opacity, animation delay. */
const DASH_BARS = [
  { x: 910, y: 158, h: 44, o: 0.9, d: 0 },
  { x: 926, y: 170, h: 32, o: 0.65, d: 0.3 },
  { x: 942, y: 150, h: 52, o: 0.8, d: 0.6 },
  { x: 958, y: 178, h: 24, o: 0.5, d: 0.9 },
  { x: 974, y: 164, h: 38, o: 0.75, d: 1.2 },
];

function BirdGlyph({ variant, scale = 1 }: { variant: "raven" | "swallow"; scale?: number }) {
  return (
    <g className={styles.bird} transform={`scale(${scale})`}>
      {variant === "raven" ? (
        <>
          {/* Broad, feathered wings and a fan tail. */}
          <path className={styles.wingL} d="M-9,-2 C-15,-12 -18,-23 -12,-36 L-8,-28 L-7,-40 L-2,-30 L2,-41 L5,-29 L11,-37 L10,-23 C12,-14 11,-7 7,-2 Z" />
          <path className={styles.wingR} d="M-9,2 C-15,12 -18,23 -12,36 L-8,28 L-7,40 L-2,30 L2,41 L5,29 L11,37 L10,23 C12,14 11,7 7,2 Z" />
          <path d="M-18,0 C-9,-6 7,-6 17,-3 L20,0 L17,3 C7,6 -9,6 -18,0 Z" />
          <circle cx="18" cy="0" r="4.5" />
          <path d="M20,-2.5 L29,0 L20,2.5 Z M-12,-3 L-29,-9 Q-34,0 -29,9 L-12,3 Z" />
        </>
      ) : (
        <>
          {/* Swept, pointed wings and the swallow's long forked tail. */}
          <path className={styles.wingL} d="M-7,-2 Q-10,-18 -24,-39 Q-2,-29 9,-6 L10,-2 Z" />
          <path className={styles.wingR} d="M-7,2 Q-10,18 -24,39 Q-2,29 9,6 L10,2 Z" />
          <path d="M-18,0 Q-5,-5 14,-3 Q21,-3 23,0 Q21,3 14,3 Q-5,5 -18,0 Z" />
          <path d="M20,-1.5 L28,0 L20,1.5 Z M-12,-2 L-36,-13 L-25,0 L-36,13 L-12,2 Z" />
        </>
      )}
    </g>
  );
}

export function FunnelFigure() {
  return (
    <figure className={`${styles.funnel} my-10 mx-auto max-w-[80%]`}>
      {/* Let the SVG scale with its frame so the whole pipeline stays visible. */}
      <div>
        <div className={styles.funnelFrame}>
          <svg
            viewBox="0 -22 1080 396"
            role="img"
            aria-label="Diagram: papers stream out of five literature databases — PubMed, OpenAlex, Europe PMC, Semantic Scholar, CyberLeninka — through an AI screen where excluded papers fall away with logged reasons; included papers fill an evidence table cell by cell and render as a live dashboard. Two birds fly above the scene."
          >
            {/* gates */}
            <line className={styles.svGate} x1="400" y1="30" x2="400" y2="300" />
            <line className={styles.svGate} x1="660" y1="30" x2="660" y2="300" />

            {/* station labels */}
            <text className={`${styles.svLabel} ${styles.svLabelStrong}`} x="16" y="42">Search</text>
            <text className={styles.svLabel} x="16" y="58">every language</text>
            <text className={`${styles.svLabel} ${styles.svLabelStrong}`} x="412" y="42">Screen</text>
            <text className={styles.svLabel} x="412" y="58">verdict + reason, per paper</text>
            <text className={`${styles.svLabel} ${styles.svLabelStrong}`} x="672" y="42">Extract</text>
            <text className={styles.svLabel} x="672" y="58">customizable data extraction</text>
            <text className={`${styles.svLabel} ${styles.svLabelStrong}`} x="902" y="42">Publish</text>
            <text className={styles.svLabel} x="902" y="58">live user-customizable</text>
            <text className={styles.svLabel} x="902" y="74">dashboard</text>

            {/* database sources */}
            <g>
              {DATABASES.map((name, i) => (
                <g className={styles.db} key={name}>
                  <rect x="14" y={72 + i * 48} width="102" height="30" rx="6" />
                  <text
                    x="65"
                    y={91 + i * 48}
                    style={name.length > 12 ? { fontSize: "10px" } : undefined}
                  >
                    {name}
                  </text>
                </g>
              ))}
            </g>

            <text className={styles.svLabel} x="412" y="342" style={{ fill: "var(--exc)" }}>
              excluded
            </text>

            {/* flowing papers */}
            <g>
              {PAPERS.map((p, i) => (
                <g
                  key={i}
                  className={p.excluded ? `${styles.paper} ${styles.exc}` : styles.paper}
                  style={
                    {
                      "--y0": `${p.y0.toFixed(1)}px`,
                      "--lane": `${p.lane.toFixed(1)}px`,
                      "--d": `${p.delay.toFixed(2)}s`,
                      "--static-x": p.staticX.toFixed(0),
                    } as CSSProperties
                  }
                >
                  <rect className={styles.pCard} width="22" height="28" rx="2.5" />
                  {p.lines.map((w, l) => (
                    <rect
                      key={l}
                      className={styles.pLine}
                      x="4"
                      y={8 + l * 6}
                      width={w.toFixed(1)}
                      height="2.5"
                      rx="1.25"
                    />
                  ))}
                  <circle className={styles.pDot} cx="17" cy="6" r="2.5" />
                </g>
              ))}
            </g>

            {/* evidence table: cells pop in as papers are absorbed */}
            <g>
              <rect x="678" y="130" width="150" height="104" rx="6" fill="hsl(var(--card))" stroke="#000" strokeWidth="1" />
              <line x1="678" y1="152" x2="828" y2="152" className={styles.glyphLine} />
              <rect x="686" y="138" width="52" height="6" rx="3" className={styles.pLine} />
              {TABLE_CELLS.map((c, i) => (
                <rect
                  key={i}
                  className={styles.cell}
                  style={{ "--cd": `${c.cd}s`, "--co": c.co ?? 1 } as CSSProperties}
                  x={c.x}
                  y={c.y}
                  width={c.w}
                  height="9"
                  rx="2.5"
                  fill={CELL_FILL[c.kind]}
                />
              ))}
              {TABLE_DOTS.map((d, i) => (
                <circle
                  key={i}
                  className={styles.cell}
                  style={{ "--cd": `${d.cd}s` } as CSSProperties}
                  cx="817"
                  cy={d.cy}
                  r="3.5"
                  fill={d.fill === "inc" ? "var(--inc)" : "var(--pend)"}
                />
              ))}
            </g>

            {/* arrow table -> dashboard */}
            <path d="M852 182 h34" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" fill="none" />
            <path d="M886 182 l-6 -4 v8 z" fill="hsl(var(--muted-foreground))" />

            {/* dashboard */}
            <g>
              <rect x="900" y="122" width="118" height="148" rx="6" fill="hsl(var(--card))" stroke="#000" strokeWidth="1" />
              <rect x="908" y="130" width="40" height="6" rx="3" className={styles.pLine} />
              {/* Illustrative dashboard filters, toggling at staggered intervals. */}
              <g aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <g key={i} transform={`translate(${908 + i * 35}, 145)`}>
                    <rect width="10" height="10" rx="1.5" fill="hsl(var(--card))" stroke="#000" strokeWidth="1" />
                    <path
                      d="M2 5 L4 7 L8 2.5"
                      className={styles.dashboardCheck}
                      style={{ animationDelay: `${-i * 2}s`, "--checked": i === 1 ? 0 : 1 } as CSSProperties}
                    />
                    <rect x="14" y="4" width="13" height="3" rx="1.5" className={styles.pLine} />
                  </g>
                ))}
              </g>
              <g transform="translate(0, 26)">
                {DASH_BARS.map((b) => (
                  <rect
                    key={b.x}
                    className={styles.barGrow}
                    x={b.x}
                    y={b.y}
                    width="12"
                    height={b.h}
                    fill="hsl(var(--primary))"
                    opacity={b.o}
                    style={{ animationDelay: `${b.d}s` }}
                  />
                ))}
              <line x1="908" y1="203" x2="1010" y2="203" className={styles.glyphLine} />
              <circle cx="922" cy="222" r="4" fill="var(--inc)" />
              <circle cx="946" cy="216" r="3" fill="hsl(var(--primary))" />
              <circle cx="966" cy="226" r="5" fill="hsl(var(--primary))" opacity="0.6" />
              <circle cx="992" cy="218" r="3.5" fill="var(--pend)" />
              </g>
            </g>

            {/* the bird, surveying from above */}
            <g className={styles.birdFly} aria-hidden="true">
              <g className={styles.birdBob}>
                <BirdGlyph variant="raven" />
              </g>
            </g>

            {/* a smaller companion, circling the published dashboard */}
            <g className={styles.fnOrbit} aria-hidden="true">
              <g className={styles.birdBob}>
                <BirdGlyph variant="swallow" scale={0.65} />
              </g>
            </g>
          </svg>
        </div>
      </div>
    </figure>
  );
}
