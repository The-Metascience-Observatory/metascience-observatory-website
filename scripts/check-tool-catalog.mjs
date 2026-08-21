// Guards the public tool catalogue against drift in the agent repo's registry.
//
// The site publishes a tool count and 58 descriptions sourced from
// `registry.SPECS` in agent_for_forensic_metascience. That repo keeps changing.
// Its own `prompts/tool_reference.md` header claimed "47 registered tools" while
// the real number was 58 -- this check exists so the website cannot repeat that.
//
// Refresh the snapshot with:
//   cd <agent repo> && python -c "..."  > data/forensic_tool_registry.json
// (the exact command is recorded in the file's `generated_from` field)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snapshot = JSON.parse(
  fs.readFileSync(path.join(root, "data/forensic_tool_registry.json"), "utf-8"),
);

// tools.ts is TypeScript; read the registryName / ceiling / quarantined literals
// out of the source rather than pulling in a TS loader for one check.
const src = fs.readFileSync(
  path.join(root, "app/forensic-metascience-agent/tools.ts"),
  "utf-8",
);
// Every registryName present in tools.ts -- including families the page does
// not render. The public count is computed separately, below.
const catalogued = [...src.matchAll(/registryName:\s*"([^"]+)"/g)].map((m) => m[1]);
// Pipeline stages carry `partOf` instead of a registryName: they run in a fixed
// sequence inside a registered tool and are not separately callable. They must
// still name a parent that genuinely exists in the registry.
const parents = [...src.matchAll(/partOf:\s*"([^"]+)"/g)].map((m) => m[1]);

// Registry tools deliberately NOT listed in tools.ts, each with its reason.
// The point of naming them is that an accidental omission and a considered one
// look identical in a diff -- this file is where the difference is recorded, and
// the check below fails if the set drifts in either direction.
const EXTRACTION_REASON =
  "extraction/parsing: how the numbers are read, not a check on them; kept in tools.ts, not listed";
const OMITTED = new Map([
  [
    "detect_tortured_phrases",
    "quarantined behind a 70-row seed dictionary; not described publicly as a working check yet",
  ],
  ["extract_pdf", EXTRACTION_REASON],
  ["extract_xml", EXTRACTION_REASON],
  ["extract_html", EXTRACTION_REASON],
  ["extract_supplement", EXTRACTION_REASON],
  ["extract_figures", EXTRACTION_REASON],
  ["get_table", EXTRACTION_REASON],
  ["get_supplement_table", EXTRACTION_REASON],
  ["parse_cells_typed", EXTRACTION_REASON],
  ["parse_cells_as_declared", EXTRACTION_REASON],
  ["parse_table", EXTRACTION_REASON],
]);

const errors = [];

const snapNames = new Set(snapshot.tools.map((t) => t.name));
const cataNames = new Set(catalogued);

if (cataNames.size !== catalogued.length) {
  const seen = new Set();
  const dupes = catalogued.filter((n) => (seen.has(n) ? true : (seen.add(n), false)));
  errors.push(`duplicate registryName in tools.ts: ${[...new Set(dupes)].join(", ")}`);
}
for (const n of cataNames) {
  if (!snapNames.has(n)) errors.push(`tools.ts lists "${n}", which is not in the registry`);
}
for (const n of snapNames) {
  if (!cataNames.has(n) && !OMITTED.has(n)) {
    errors.push(`registry has "${n}", which tools.ts neither lists nor records as a deliberate omission`);
  }
}
for (const n of OMITTED.keys()) {
  if (!snapNames.has(n)) {
    errors.push(`"${n}" is recorded as a deliberate omission but no longer exists in the registry`);
  }
}
if (catalogued.length !== snapshot.n - 1) {
  // -1: detect_tortured_phrases is the one registry tool with no entry at all.
  errors.push(
    `tools.ts carries ${catalogued.length} registryNames; expected ${snapshot.n - 1} ` +
      `(every registry tool except detect_tortured_phrases)`,
  );
}
for (const n of new Set(parents)) {
  if (!snapNames.has(n)) {
    errors.push(`a pipeline stage claims partOf "${n}", which is not a registered tool`);
  }
}

if (errors.length) {
  console.error("tool catalogue is out of sync with the agent registry:\n");
  for (const e of errors) console.error("  - " + e);
  console.error(
    "\nFix tools.ts, or regenerate data/forensic_tool_registry.json if the registry legitimately changed.",
  );
  process.exit(1);
}

console.log(
  `tool catalogue OK - ${snapshot.n} registry tools, ${catalogued.length} described in tools.ts, ` +
    `${OMITTED.size} deliberately unlisted (each with a recorded reason); ` +
    `${parents.length} pipeline stages across ${new Set(parents).size} pipeline(s)`,
);
