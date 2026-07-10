/** Shared formatting utilities for the ME/CFS dashboard. */

export function fmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  return a >= 100 ? n.toFixed(0) : a >= 10 ? n.toFixed(1) : n.toFixed(2);
}

export function formatLabel(s: string): string {
  return s.replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bRct\b/g, "RCT");
}
