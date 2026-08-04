/**
 * Print the correlates-of-reproducibility page's statistics from the shipped
 * TypeScript code, for cross-checking against the independent Python oracle
 * (scripts/check_logit.py).
 *
 * Run from the repo root with:
 *
 *     npx tsx scripts/check_logit_lib.ts
 *
 * (Never plain `node` — jstat's named export breaks under raw Node ESM.)
 */

import { buildDataset } from "../app/replications-database/correlates-of-reproducibility/data";
import {
  buildCorrelationTable,
  fitModel,
} from "../app/replications-database/correlates-of-reproducibility/stats";

const { rows, meta } = buildDataset();

console.log(`csv: ${meta.csvName}`);
console.log(
  `rows: total=${meta.totalRows} usable=${meta.usableRows} ` +
    `droppedBlank=${meta.droppedBlankResult} droppedIfZero=${meta.droppedIfZero} papers=${meta.papers}`,
);
console.log("coverage:", JSON.stringify(meta.coverage));

console.log("\n== correlation table ==");
for (const row of buildCorrelationTable(rows)) {
  console.log(
    `${row.key.padEnd(13)} n=${String(row.n).padStart(5)} papers=${String(row.nClusters).padStart(5)} ` +
      `pearson=${row.pearsonR.toFixed(6)} [${row.pearsonLo.toFixed(4)}, ${row.pearsonHi.toFixed(4)}] ` +
      `spearman=${row.spearmanR.toFixed(6)} [${row.spearmanLo.toFixed(4)}, ${row.spearmanHi.toFixed(4)}]`,
  );
}

for (const withP of [false, true]) {
  const model = fitModel(rows, withP);
  console.log(`\n== model ${withP ? "B (with log10 p)" : "A (no p-value)"} ==`);
  console.log(`n=${model.nObs} clusters=${model.nClusters}`);
  if (!model.fit) {
    console.log("fit: null");
    continue;
  }
  console.log(`iterations=${model.fit.iterations} intercept=${model.fit.beta[0].toFixed(6)}`);
  for (const t of model.fit.terms) {
    console.log(
      `${t.name.padEnd(26)} beta=${t.beta.toFixed(6)} se=${t.se.toFixed(6)} ` +
        `z=${t.z.toFixed(4)} p=${t.p.toExponential(4)} ame=${t.ame.toFixed(6)} ameSe=${t.ameSe.toFixed(6)}`,
    );
  }
  for (const s of model.scales) {
    console.log(`scale ${s.key.padEnd(13)} mean=${s.mean.toFixed(6)} sd=${s.sd.toFixed(6)}`);
  }
}
