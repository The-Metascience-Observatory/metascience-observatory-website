import fs from "fs";
import path from "path";
import { toCsv } from "@/app/birds-eye-reviews/lithium-drinking-water/stats";
import { numberValue, type Snapshot } from "@/app/birds-eye-reviews/lithium-drinking-water/types";

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const state = params.get("state") ?? "ALL";
  const minimums = { samples: 0, sites: 0, wells: 0 };
  for (const unit of Object.keys(minimums) as (keyof typeof minimums)[]) {
    const value = Number(params.get(unit) ?? 0);
    if (!Number.isFinite(value) || value < 0) return new Response("Coverage minimums must be nonnegative numbers.", { status: 400 });
    minimums[unit] = value;
  }
  const snapshot = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/birds_eye_reviews/lithium_drinking_water/snapshot.v1.json"), "utf8")) as Snapshot;
  if (state !== "ALL" && !snapshot.counties.some(row => row.state === state)) return new Response("Unknown state.", { status: 400 });
  const exposures = snapshot.exposures.filter(exposure => exposure.column !== "log10_usgs_all");
  const columns = ["fips", "countyname", "state", "totalpopulation", "obesity_adjprev", ...new Set(exposures.flatMap(exposure => [exposure.raw, exposure.column, exposure.count, `${exposure.column}_meets_minimum`]))];
  const rows = snapshot.counties.filter(row => state === "ALL" || row.state === state).map(row => ({ ...row, ...Object.fromEntries(exposures.map(exposure => {
    const minimum = minimums[exposure.countLabel as keyof typeof minimums];
    return [`${exposure.column}_meets_minimum`, minimum <= 0 || (numberValue(row[exposure.count]) ?? -1) >= minimum];
  })) }));
  return new Response("\uFEFF" + toCsv(rows, columns), { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="lithium-obesity-${state.toLowerCase()}-counties.csv"`,
    "Cache-Control": "no-store",
  } });
}
