/** Shared formatting helpers usable from both server and client components. */

/** Positive correlations dull green, negative dull red. */
export const signClass = (v: number) =>
  !Number.isFinite(v) || v === 0
    ? ""
    : v > 0
      ? "text-green-800/80 dark:text-green-500/70"
      : "text-red-800/80 dark:text-red-400/70";
