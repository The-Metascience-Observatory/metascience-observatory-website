/** Evidence rows (with verbatim quotes) for the post-viral symptoms page.
 *
 *  GET ?rows=<id>,<id>     the rows behind a chart point or pooled study
 *                          (derived-pair ids expand to both estimates)
 *  GET ?kind=estimate|contrast&exp=&fam=&bin=&ctrl=with|without&status=usable|excluded&q=&page=
 *                          one page of the evidence table, plus filter facets
 *
 *  Quotes stay out of the page payload; the table and point details fetch
 *  them here on demand. */
import { NextResponse } from "next/server";
import { evidenceRows, loadEvidence } from "../data";
import type { EvidenceRow } from "../types";

const PAGE_SIZE = 25;
const MAX_IDS = 40;

/** Columns the table renders; everything else stays in the CSV download. */
const TABLE_COLUMNS = [
  "row_id", "paper_id", "key", "cohort_id", "group_label", "comparator_group_label", "role",
  "exposure_class", "severity_class", "subgroup_label", "outcome_label", "outcome_family",
  "definition_class", "baseline_handling", "estimand_family", "time_label", "time_months",
  "time_bin", "numerator", "denominator", "percent_value", "value_operator", "ci_low", "ci_high",
  "measure", "value", "adjusted", "model_label", "quote", "location", "confidence",
  "verification_status", "value_source", "data_source", "excluded_reason", "_kind",
];

const pick = (r: EvidenceRow) =>
  Object.fromEntries(TABLE_COLUMNS.filter((c) => r[c] !== undefined && r[c] !== "").map((c) => [c, r[c]]));

const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;

  const ids = params.get("rows");
  if (ids != null) {
    const list = ids.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_IDS);
    return NextResponse.json({ rows: evidenceRows(list).map(pick) });
  }

  const { rows, papersWithControl } = loadEvidence();
  const kind = params.get("kind") === "contrast" ? "contrast" : "estimate";
  const exp = params.get("exp") ?? "";
  const fam = params.get("fam") ?? "";
  const bin = params.get("bin") ?? "";
  const ctrl = params.get("ctrl") ?? "";
  const status = params.get("status") ?? "";
  const q = (params.get("q") ?? "").trim().toLowerCase().slice(0, 100);
  const page = Math.max(0, Number.parseInt(params.get("page") ?? "0", 10) || 0);

  const ofKind = rows.filter((r) => r._kind === kind);
  const hits = ofKind.filter((r) =>
    (!exp || r.exposure_class === exp) &&
    (!fam || r.outcome_family === fam) &&
    (!bin || r.time_bin === bin) &&
    (!ctrl || (ctrl === "with") === papersWithControl.has(r.paper_id)) &&
    (!status || (status === "usable") === !r.excluded_reason) &&
    (!q || `${r.key} ${r.paper_id} ${r.outcome_label} ${r.group_label} ${r.comparator_group_label ?? ""} ${r.quote}`
      .toLowerCase().includes(q)),
  );

  return NextResponse.json({
    total: hits.length,
    totalOfKind: ofKind.length,
    page,
    pageSize: PAGE_SIZE,
    rows: hits.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(pick),
    facets: {
      exp: uniq(ofKind.map((r) => r.exposure_class)),
      fam: uniq(ofKind.map((r) => r.outcome_family)),
      bin: uniq(ofKind.map((r) => r.time_bin)),
    },
  });
}
