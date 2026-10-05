export type Cell = string | number | boolean | null;
export interface County {
  fips: string;
  countyname: string;
  state: string;
  totalpopulation: number;
  [key: string]: Cell;
}
export interface Exposure {
  column: string;
  raw: string;
  label: string;
  short: string;
  source: string;
  count: string;
  countLabel: string;
  kind: "fraction" | "log";
  note: string;
}
export interface ResultRow { [key: string]: Cell }
export interface Snapshot {
  schemaVersion: number;
  exportedAt: string;
  fingerprint: string;
  inputs: { path: string; sha256: string }[];
  counties: County[];
  exposures: Exposure[];
  results: Record<string, ResultRow[]>;
  sources: { name: string; description: string; url: string; period: string }[];
}
export const numberValue = (value: Cell | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
