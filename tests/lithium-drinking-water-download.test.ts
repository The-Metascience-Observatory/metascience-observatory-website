import test from "node:test";
import assert from "node:assert/strict";
import { csvParse } from "d3-dsv";
import { GET } from "../app/api/lithium-drinking-water/download/route";

const request = (query = "") => GET(new Request(`http://localhost/api/lithium-drinking-water/download${query}`));

test("Default CSV contains 3,143 unique counties, six measures, and missing outcomes", async () => {
  const response = request();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Disposition")!, /attachment; filename="lithium-obesity-all-counties.csv"/);
  const rows = csvParse(await response.text());
  assert.equal(rows.length, 3143);
  assert.equal(new Set(rows.map(row => row.fips)).size, 3143);
  assert.ok(rows.every(row => /^\d{5}$/.test(row.fips)));
  assert.equal(rows.filter(row => row.obesity_adjprev === "").length, 187);
  assert.equal(rows.columns.filter(column => column.endsWith("_meets_minimum")).length, 6);
  assert.ok(!rows.columns.some(column => column.startsWith("usgs_all") || column.startsWith("log10_usgs_all")));
});

test("State selection and independent source thresholds reach the CSV", async () => {
  const rows = csvParse(await request("?state=TX&samples=200&sites=5&wells=3").text());
  assert.equal(rows.length, 253);
  assert.ok(rows.every(row => row.state === "TX"));
  const hidalgo = rows.find(row => row.fips === "48215")!;
  assert.equal(hidalgo.obesity_adjprev, "45");
  assert.equal(hidalgo.ucmr5_all_li_detfrac, "1");
  assert.equal(hidalgo.ucmr5_all_li_detfrac_meets_minimum, "false");
  const bexar = rows.find(row => row.fips === "48029")!;
  assert.equal(bexar.ucmr5_all_li_detfrac_meets_minimum, "true");
  assert.equal(hidalgo.log10_wqp_meets_minimum, "false");
});

test("Missing-outcome counties remain downloadable", async () => {
  const rows = csvParse(await request("?state=KY").text());
  assert.equal(rows.length, 120);
  assert.ok(rows.every(row => row.obesity_adjprev === ""));
});

test("Invalid geography and coverage parameters return 400", () => {
  for (const query of ["?state=ZZ", "?samples=-1", "?sites=NaN", "?wells=Infinity"]) assert.equal(request(query).status, 400);
});
