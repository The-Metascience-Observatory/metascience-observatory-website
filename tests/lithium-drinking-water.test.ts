import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { correlations, filterCounties, pearson, ranks, toCsv } from "../app/birds-eye-reviews/lithium-drinking-water/stats";
import type { County, Snapshot } from "../app/birds-eye-reviews/lithium-drinking-water/types";

const root = path.join(process.cwd(), "data/birds_eye_reviews/lithium_drinking_water");
const snapshot = JSON.parse(readFileSync(path.join(root, "snapshot.v1.json"), "utf8")) as Snapshot;
const references = JSON.parse(readFileSync(path.join(root, "statistics-reference.v1.json"), "utf8")) as { name: string; states: string[] | null; minCount: number; exposure: string; countColumn: string; outcome: string; weighted: boolean; n: number; pearson: number | null; spearman: number | null }[];
const states = [...new Set(snapshot.counties.map(row => row.state))];

for (const ref of references) test(`Python parity: ${ref.name}, ${ref.outcome}, weighted=${ref.weighted}`, () => {
  const rows = filterCounties(snapshot.counties, ref.states ?? states, ref.countColumn, ref.minCount);
  const actual = correlations(rows, ref.exposure, ref.outcome, ref.weighted);
  assert.equal(actual.n, ref.n);
  for (const stat of ["pearson", "spearman"] as const) {
    if (ref[stat] === null) assert.equal(actual[stat], null);
    else assert.ok(actual[stat] !== null && Math.abs(actual[stat]! - ref[stat]!) < 1e-11);
  }
});

test("All saved obesity correlations match the interactive calculation", () => {
  for (const [file, selectedStates] of [["correlations_main", states], ["texas_obesity", ["TX"]]] as const) {
    const rows = snapshot.counties.filter(row => selectedStates.includes(row.state));
    for (const saved of snapshot.results[file]) {
      const result = correlations(rows, String(saved.column), "obesity_adjprev");
      assert.equal(result.n, saved.n);
      assert.ok(Math.abs(result.spearman! - Number(saved.spearman)) < 1e-11);
    }
  }
});

test("Identifiers, missingness, and coverage survive import", () => {
  assert.equal(snapshot.counties.length, 3143);
  assert.equal(new Set(snapshot.counties.map(row => row.fips)).size, 3143);
  assert.ok(snapshot.counties.every(row => /^\d{5}$/.test(row.fips)));
  assert.equal(snapshot.counties.filter(row => row.ucmr5_all_li_detfrac !== null).length, 2659);
  const missing = filterCounties(snapshot.counties, ["KY", "PA"], "ucmr5_all_n", 0);
  assert.equal(missing.length, 187);
  assert.equal(correlations(missing, "ucmr5_all_li_detfrac", "obesity_adjprev").n, 0);
});

test("Ties, constants, insufficient observations, and empty coverage", () => {
  assert.deepEqual(ranks([7, 3, 3, 10, 7]), [3.5, 1.5, 1.5, 5, 3.5]);
  assert.ok(Math.abs(pearson(ranks([1, 1, 3, 4]), ranks([9, 5, 5, 2]), [1, 2, 3, 4])! + 0.8520358512520175) < 1e-12);
  assert.equal(pearson([1, 1, 1], [1, 2, 3]), null);
  assert.equal(pearson([1, 2], [1, 2]), null);
  assert.equal(pearson([], []), null);
  assert.equal(filterCounties(snapshot.counties, states, "ucmr5_all_n", 1e9).length, 0);
});

test("CSV escapes county names and retains FIPS and missing values", () => {
  const row: County = { fips: "01001", countyname: 'A, "B"', state: "AL", totalpopulation: 1, value: null };
  assert.equal(toCsv([row], ["fips", "countyname", "value"]), '"fips","countyname","value"\r\n"01001","A, ""B""",""');
});
