import fs from "fs";
import path from "path";
import { csvParse } from "d3-dsv";

export type SourceType = "primary" | "secondary";

export interface SourcedValue {
  value: number;
  /** Range where sources disagree; equal to value when they agree. */
  low: number;
  high: number;
  source: string;
  sourceType: SourceType;
  url: string;
}

export interface NsfOigYearDatum {
  year: number;
  /** "fiscal" when the source says so; "unclear" when it could be a calendar year. */
  yearBasis: string;
  allegations: SourcedValue | null;
  findings: SourcedValue | null;
  note: string;
}

export function getNsfOigMisconduct(): NsfOigYearDatum[] {
  const csvPath = path.join(process.cwd(), "data/nsf_oig_misconduct_by_year.csv");
  const rows = csvParse(fs.readFileSync(csvPath, "utf-8"));
  return rows.map((r) => {
    const allegations = r.allegations
      ? {
          value: Number(r.allegations),
          low: Number(r.allegations),
          high: Number(r.allegations),
          source: r.allegations_source ?? "",
          sourceType: r.allegations_source_type as SourceType,
          url: r.allegations_url ?? "",
        }
      : null;
    const findings = r.findings
      ? {
          value: Number(r.findings),
          low: Number(r.findings_low || r.findings),
          high: Number(r.findings_high || r.findings),
          source: r.findings_source ?? "",
          sourceType: r.findings_source_type as SourceType,
          url: r.findings_url ?? "",
        }
      : null;
    return {
      year: Number(r.year),
      yearBasis: r.year_basis ?? "",
      allegations,
      findings,
      note: r.note ?? "",
    };
  });
}
