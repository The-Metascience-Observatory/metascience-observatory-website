import type { CSSProperties } from "react";

/** Shared formatting helpers usable from both server and client components. */

/**
 * Sign-and-magnitude color for a correlation: positive → green, negative →
 * red, with saturation/brightness scaling with |r| so stronger correlations
 * read stronger. |r| = MAX_ABS (≈ the largest value in the table) is fully
 * saturated; near-zero values are almost gray.
 */
const MAX_ABS = 0.3;

export function signStyle(v: number): CSSProperties {
  if (!Number.isFinite(v) || v === 0) return {};
  const t = Math.min(1, Math.abs(v) / MAX_ABS);
  // Reds run brighter/more saturated than greens so they don't read muddy.
  const [hue, sat, light] =
    v > 0
      ? [140, 12 + 68 * t, 48 - 16 * t]
      : [2, 25 + 75 * t, 52 - 8 * t];
  return { color: `hsl(${hue} ${Math.round(sat)}% ${Math.round(light)}%)` };
}
