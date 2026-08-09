/**
 * Verify the effect-size metric-compatibility guard on the CI-based outcome
 * definitions, using the SHIPPED lib rather than a reimplementation.
 *
 * "Before" is obtained by calling computeOriginalInReplicationCI /
 * computeReplicationInOriginalCI with skipPrecomputedCI left at its default of
 * false — i.e. the pre-guard behavior. "After" goes through getOutcomeForRow,
 * which now computes the guard from the two es_type columns.
 *
 * Run from the repo root with:
 *
 *     npx tsx scripts/check_outcome_metric_guard.cts
 *
 * (Never plain `node` — jstat's named export breaks under raw Node ESM.)
 *
 * Cross-check the printed table against the independent Python oracle.
 */

import fs from "fs";
import path from "path";
import { csvParse } from "d3-dsv";
import {
  getOutcomeForRow,
  computeOriginalInReplicationCI,
  computeReplicationInOriginalCI,
  metricsComparable,
  esTypeFamily,
  toNumber,
  toValidR,
  type AnyRecord,
} from "../lib/replicationOutcome";

// Resolve the master the same way /api/fred does: last non-comment line of version_history.txt
const dataDir = path.join(process.cwd(), "data");
const historyLines = fs
  .readFileSync(path.join(dataDir, "version_history.txt"), "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));
const csvName = historyLines[historyLines.length - 1].split(/\s+/)[0];
const rows = csvParse(fs.readFileSync(path.join(dataDir, csvName), "utf8")) as unknown as AnyRecord[];

console.log(`csv: ${csvName}`);
console.log(`rows: ${rows.length}`);

function before(row: AnyRecord, method: "orig_in_rep_ci" | "rep_in_orig_ci") {
  const eO_r = toValidR(row.original_es_r);
  const eR_r = toValidR(row.replication_es_r);
  const nO = toNumber(row.original_n);
  const nR = toNumber(row.replication_n);
  const eO_raw = toNumber(row.original_es);
  const eR_raw = toNumber(row.replication_es);
  return method === "orig_in_rep_ci"
    ? computeOriginalInReplicationCI(eO_raw, eO_r, eR_r, nR, row.replication_es_95_CI as string)
    : computeReplicationInOriginalCI(eR_raw, eR_r, eO_r, nO, row.original_es_95_CI as string);
}

const METHODS = ["orig_in_rep_ci", "rep_in_orig_ci"] as const;
const changed: {
  line: number;
  ot: string;
  rt: string;
  famO: string | null;
  famR: string | null;
  method: string;
  from: string;
  to: string;
}[] = [];

let rerouted = 0;
for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  const comparable = metricsComparable(row.original_es_type, row.replication_es_type);
  if (!comparable) rerouted++;
  for (const m of METHODS) {
    const b = before(row, m);
    const a = getOutcomeForRow(row, m);
    if (b !== a) {
      changed.push({
        line: i + 2,
        ot: String(row.original_es_type ?? ""),
        rt: String(row.replication_es_type ?? ""),
        famO: esTypeFamily(row.original_es_type),
        famR: esTypeFamily(row.replication_es_type),
        method: m,
        from: b,
        to: a,
      });
    }
  }
}

console.log(`rows the guard reroutes to Strategy 2: ${rerouted}`);
console.log(`(row, method) verdicts that changed: ${changed.length}`);
console.log();
for (const c of changed) {
  console.log(
    `  line ${String(c.line).padStart(5)}  ${c.ot.padEnd(14)} -> ${c.rt.padEnd(8)} ` +
      `[${String(c.famO).padEnd(22)} -> ${String(c.famR).padEnd(22)}]  ` +
      `${c.method.padEnd(15)} ${c.from} -> ${c.to}`,
  );
}

// ---- assertions ----
const distinctLines = Array.from(new Set(changed.map((c) => c.line))).sort((x, y) => x - y);
console.log();
console.log(`distinct rows affected: ${distinctLines.length} -> ${JSON.stringify(distinctLines)}`);

const problems: string[] = [];

// Same-family mismatched labels must NOT be rerouted (g vs d).
for (const line of [2567, 5432]) {
  if (distinctLines.includes(line)) {
    problems.push(`line ${line} (g vs d, same family) was rerouted but must not be`);
  }
}
if (!metricsComparable("g", "d")) problems.push("metricsComparable('g','d') should be true");
if (!metricsComparable("", "dz")) problems.push("blank label must be treated as comparable");
if (!metricsComparable("f²", "f²")) problems.push("identical unrecognized labels must be comparable");
if (metricsComparable("d", "dz")) problems.push("metricsComparable('d','dz') should be false");
if (metricsComparable("omega-squared", "r")) problems.push("omega-squared vs r should be false");

// The new ACX row must now read success on both CI definitions.
const acx = rows.find((r) => String(r.original_url ?? "").includes("bhac426"));
if (!acx) {
  problems.push("ACX row (bhac426) not found");
} else {
  for (const m of METHODS) {
    const v = getOutcomeForRow(acx, m);
    if (v !== "success") problems.push(`ACX row ${m} is "${v}", expected "success"`);
  }
  console.log(
    `ACX row: orig_in_rep_ci=${getOutcomeForRow(acx, "orig_in_rep_ci")} ` +
      `rep_in_orig_ci=${getOutcomeForRow(acx, "rep_in_orig_ci")} ` +
      `(result column still "${acx.result}")`,
  );
}

// Aggregate movement should be negligible.
console.log();
for (const m of METHODS) {
  let sB = 0, fB = 0, sA = 0, fA = 0;
  for (const row of rows) {
    const b = before(row, m);
    const a = getOutcomeForRow(row, m);
    if (b === "success") sB++; else if (b === "failure") fB++;
    if (a === "success") sA++; else if (a === "failure") fA++;
  }
  const pB = (100 * sB) / (sB + fB);
  const pA = (100 * sA) / (sA + fA);
  console.log(
    `${m.padEnd(15)} before ${sB}/${sB + fB} = ${pB.toFixed(3)}%   ` +
      `after ${sA}/${sA + fA} = ${pA.toFixed(3)}%   delta ${(pA - pB).toFixed(4)} pp`,
  );
}

console.log();
if (problems.length) {
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("ALL ASSERTIONS PASSED");
