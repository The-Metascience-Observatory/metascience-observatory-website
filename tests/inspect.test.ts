import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { baseDoi } from "../lib/long-covid/publications";
import { inspectCounts, inspectLabel, matchesInspect, parseInspectFilter, type InspectSnapshot } from "../lib/long-covid/inspect";

const snapshot = JSON.parse(readFileSync("data/birds_eye_reviews/long_covid/inspect_sr.json", "utf8")) as InspectSnapshot;
const reports = Object.values(snapshot.papers);

test("missing assessments remain visible but cannot pass any synthesis filter", () => {
  assert(matchesInspect(undefined, "all"));
  assert(matchesInspect(undefined, "held"));
  for (const key of ["synthesis", "rct_primary", "rct_sensitivity", "excluded"] as const) assert(!matchesInspect(undefined, key));
  assert.equal(parseInspectFilter("bad"), "all");
  assert.equal(parseInspectFilter(null), "all");
  assert.equal(parseInspectFilter("synthesis"), "synthesis");
});

test("every saved analysis set matches exactly, including the empty sensitivity set", () => {
  for (const [filter, set] of [["synthesis", "all_provisional_reports"], ["rct_primary", "rct_primary_no_or_some_concerns"], ["rct_sensitivity", "rct_sensitivity_no_concerns"]] as const) {
    assert.deepEqual(reports.filter(r => matchesInspect(r, filter)).map(r => r.paperId), reports.filter(r => r.analysisSets.includes(set)).map(r => r.paperId));
  }
  const counts = inspectCounts(reports.map(inspectAssessment => ({ inspectAssessment })));
  assert.equal(counts.all, counts.synthesis + counts.held + counts.excluded);
});

test("a confirmed retraction and provisional serious concerns are distinct dispositions", () => {
  const retracted = snapshot.papers["10.1016/j.eclinm.2025.103681"];
  assert(retracted.retractionConfirmed);
  assert(matchesInspect(retracted, "excluded"));
  assert(!matchesInspect(retracted, "synthesis"));
  const flagged = reports.find(r => r.disposition === "serious_concerns_awaiting_resolution")!;
  assert(flagged);
  assert(matchesInspect(flagged, "held"));
  assert(!matchesInspect(flagged, "excluded"));
  assert.match(inspectLabel(flagged), /awaiting review/);
});

test("analysis membership cannot override a retraction or a held disposition", () => {
  const original = reports.find(r => matchesInspect(r, "rct_primary"))!;
  assert(original);
  assert(!matchesInspect({ ...original, retractionFlag: true }, "rct_primary"));
  assert(!matchesInspect({ ...original, disposition: "scope_awaiting_resolution" }, "synthesis"));
});

test("some concerns are eligible for primary synthesis, while missing or nonrandomized ratings are not clearance", () => {
  const primary = reports.filter(r => matchesInspect(r, "rct_primary"));
  assert(primary.some(r => r.judgment === "some concerns"));
  assert(primary.every(r => r.eligibility === "randomized_trial" && r.disagreementCount === 0));
  const cohort = reports.find(r => r.eligibility === "nonrandomized_trial" && matchesInspect(r, "synthesis"))!;
  assert(cohort && !matchesInspect(cohort, "rct_primary"));
});

test("the actual website corpus joins by base DOI, including arm suffixes", () => {
  const records = readFileSync("data/birds_eye_reviews/long_covid/trial_extractions.jsonl", "utf8").trim().split("\n").map(line => JSON.parse(line));
  // This tests the stored join independently of display filters and outcome data.
  const joined = records.filter(r => snapshot.papers[baseDoi(r.paper_id)]);
  assert(joined.length >= 775);
  const doi = joined[0].paper_id;
  assert.equal(snapshot.papers[baseDoi(doi)], snapshot.papers[baseDoi(`https://doi.org/${doi.toUpperCase()}#arm1`)]);
  assert.equal(snapshot.version, 1);
  assert.match(snapshot.decisionsSha256, /^[a-f0-9]{64}$/);
  for (const report of reports) assert(!("sources" in report) && !("assessment" in report));
});
