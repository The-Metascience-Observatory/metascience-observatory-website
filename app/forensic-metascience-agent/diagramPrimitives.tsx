import type { ReactNode } from "react";

/**
 * Shared building blocks for the pipeline diagrams.
 *
 * HTML boxes + small SVG connector strips, rather than one big SVG: SVG text
 * does not wrap, so every label would have to be hand-broken and would break
 * again at a different width. Boxes wrap and reflow; only the connectors need
 * drawing.
 */

export type Tone = "neutral" | "ink" | "accent" | "warn" | "muted" | "dark";

const TONE: Record<Tone, string> = {
  neutral: "border-foreground/75 bg-white text-foreground",
  ink: "border-black bg-white text-foreground",
  accent: "border-primary bg-primary/10 text-foreground",
  warn: "border-amber-600 bg-amber-50 text-foreground",
  muted: "border-foreground/45 bg-muted/50 text-foreground/85",
  dark: "border-cyan-900 bg-cyan-900 text-white",
};

export function Node({
  title,
  sub,
  badge,
  tone = "neutral",
  mono = false,
  href,
  icon,
  center = false,
  className = "",
}: {
  /** Omit for a compact text-only node. */
  title?: ReactNode;
  /** Small mark rendered after the title — see `AgentIcon`. */
  icon?: ReactNode;
  sub?: ReactNode;
  badge?: string;
  tone?: Tone;
  mono?: boolean;
  /** Makes the node title a link — used for components that live elsewhere. */
  href?: string;
  /** Centres title and sub — for the narrow fixed-width nodes at the top of a diagram. */
  center?: boolean;
  className?: string;
}) {
  const titleClass = `text-sm font-semibold leading-snug ${
    mono ? "font-mono text-[13px]" : "font-clarendon"
  }`;
  return (
    <div className={`rounded-lg border-2 px-3 py-2.5 ${TONE[tone]} ${className}`}>
      {(title || badge || icon) && (
      <div
        className={`flex items-start gap-2 ${center ? "justify-center" : "justify-between"}`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
        {!title ? null : href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={`${titleClass} group inline-flex items-center gap-1 underline decoration-current/30 underline-offset-2 hover:decoration-current`}
          >
            {title}
            <svg
              aria-hidden
              viewBox="0 0 12 12"
              className="h-2.5 w-2.5 shrink-0 opacity-50 transition-opacity group-hover:opacity-90"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4.5 1.5h6v6" />
              <path d="M10.5 1.5L5 7" />
              <path d="M9 7.5v3h-8v-8h3" />
            </svg>
          </a>
        ) : (
          <p className={titleClass}>{title}</p>
        )}
        {icon && <span className="shrink-0">{icon}</span>}
        </div>
        {badge && (
          <span
            className={`shrink-0 rounded border px-1 py-0.5 text-[9px] font-medium uppercase leading-none tracking-wide ${
              tone === "dark"
                ? "border-white/40 text-white/80"
                : "border-current/30 text-current opacity-60"
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      )}
      {sub && (
        <p
          className={`${title || badge ? "mt-1" : ""} text-[11px] leading-snug ${
            center ? "text-center" : ""
          } ${tone === "dark" ? "text-white/75" : "text-foreground/65"}`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

/**
 * Marks a box whose work is done by a language model rather than by
 * deterministic code. One shape for all four agents, so the reader learns it
 * once — the tone already carries the same meaning, and this repeats it for
 * anyone who cannot rely on colour.
 */
export function AgentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] text-primary"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="AI agent"
    >
      <path d="M12 2v3" />
      <rect x="3" y="8" width="18" height="12" rx="3" />
      <circle cx="8.5" cy="13" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="13" r="1.2" fill="currentColor" stroke="none" />
      <path d="M9 17h6" />
      <path d="M1 12v3" />
      <path d="M23 12v3" />
    </svg>
  );
}

/** Where the run's output lands. Same size and weight as `AgentIcon`. */
export function DatabaseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] text-foreground/70"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Database"
    >
      <ellipse cx="12" cy="5.5" rx="8" ry="3.2" />
      <path d="M4 5.5v6c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2v-6" />
      <path d="M4 11.5v6c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2v-6" />
    </svg>
  );
}

/** A step a person does, not the machine. */
export function HumanIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] text-foreground/70"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Human"
    >
      <circle cx="12" cy="7.5" r="3.8" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

/** A straight vertical arrow between two stacked rows. */
export function Down({ label, h = 38 }: { label?: string; h?: number }) {
  return (
    <div className="relative flex justify-center" style={{ height: h }}>
      <svg width="24" height={h} viewBox={`0 0 24 ${h}`} aria-hidden className="overflow-visible">
        <line
          x1="12"
          y1="0"
          x2="12"
          y2={h - 9}
          stroke="currentColor"
          className="text-foreground/70"
          strokeWidth="3"
        />
        <path d={`M12 ${h} l-7 -11 h14 z`} fill="currentColor" className="text-foreground/70" />
      </svg>
      {label && (
        <span className="absolute left-1/2 top-1/2 ml-4 -translate-y-1/2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-foreground/55">
          {label}
        </span>
      )}
    </div>
  );
}

/**
 * Filler line that carries a short column down to the fan-in, so every box in a
 * row has a connector leaving its base rather than a floating gap beneath it.
 * Grows to whatever height the tallest column leaves over — zero for that column.
 */
export function Stem() {
  return (
    <div className="flex grow justify-center" aria-hidden>
      <div className="w-[3px] bg-foreground/70" />
    </div>
  );
}

/**
 * Fan connector: one point above spreading to `n` columns below (`dir="out"`),
 * or `n` columns converging to one point (`dir="in"`).
 */
export function Fan({ n, dir, h = 46 }: { n: number; dir: "out" | "in"; h?: number }) {
  const W = 1000;
  const cols = Array.from({ length: n }, (_, i) => ((i + 0.5) / n) * W);
  return (
    <svg
      viewBox={`0 0 ${W} ${h}`}
      preserveAspectRatio="none"
      className="h-[46px] w-full text-foreground/70"
      aria-hidden
    >
      {cols.map((x, i) => (
        <path
          key={i}
          d={
            dir === "out"
              ? `M ${W / 2} 0 C ${W / 2} ${h * 0.55}, ${x} ${h * 0.45}, ${x} ${h - 6}`
              : `M ${x} 0 C ${x} ${h * 0.55}, ${W / 2} ${h * 0.45}, ${W / 2} ${h - 6}`
          }
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {dir === "out"
        ? cols.map((x, i) => <ArrowAt key={i} x={x} y={h} />)
        : <ArrowAt x={W / 2} y={h} />}
    </svg>
  );
}

function ArrowAt({ x, y }: { x: number; y: number }) {
  return <path d={`M ${x} ${y} l -11 -12 h 22 z`} fill="currentColor" />;
}

/** A labelled band wrapping a group of nodes — used for "these run concurrently". */
export function Band({
  label,
  note,
  children,
  tone = "muted",
}: {
  label: string;
  note?: string;
  children: ReactNode;
  tone?: "muted" | "warn";
}) {
  return (
    <div
      className={`rounded-xl border-2 border-dashed p-3 ${
        tone === "warn" ? "border-amber-500 bg-amber-50/40" : "border-foreground/40 bg-muted/25"
      }`}
    >
      <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground/55">
          {label}
        </p>
        {note && <p className="text-[10px] text-foreground/45">{note}</p>}
      </div>
      {children}
    </div>
  );
}

/** Caption under a diagram. */
export function Legend({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-foreground/60">
      {children}
    </p>
  );
}
