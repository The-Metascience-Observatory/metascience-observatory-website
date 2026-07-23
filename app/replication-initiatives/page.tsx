import fs from "fs";
import path from "path";
import { csvParse } from "d3-dsv";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { InitiativesList } from "./InitiativesList";
import type { FieldGroup, Project } from "./types";

type CsvRow = Record<string, string>;

// Map project names to their database initiative tags
const PROJECT_TO_TAG: Record<string, string> = {
  "Reproducibility Project: Psychology": "RP:P",
  "Camerer et al. – Experimental Economics Replication Project": "ExECON",
  "Camerer et al. – Nature/Science Social Science Replication Project": "SSRP",
  "Many Labs 1": "ML1",
  "Many Labs 2": "ML2",
  "Many Labs 5": "ML5",
  "Experimental Philosophy – Reproducibility Project": "XPHIR",
  "Brazilian Reproducibility Initiative": "BRI",
  "Reproducibility Project: Cancer Biology": "RP:CB",
  "Boyce et al. – Student Replication Projects": "SRP",
  "Motoki and Iseki – Sensory Marketing Replication": "SMR",
  "Soto – Life Outcomes of Personality Replication Project": "Soto et al LOPPRP",
  "Estimating the Replicability of Sports and Exercise Science Research": "RSESR",
  "Examining Replicability of Online Experiments (Holzmeister et al.)": "EROE",
  "Social Psychology Special Issue on Registered Replication Reports": "SPRRR",
  "Clearer Thinking's Transparent Replication Project": "TRs",
  "Tyner et al. – DARPA SCORE Social & Behavioural Sciences Replication Project": "socsci_2026",
  "International Initiative for Impact Evaluation Replication Paper Series": "3ie",
  "Sobkow et al. – Fifteen JDM Effects Conceptual Replication (Polish Sample)": "JDM:PL",
};

/** Stable, human-readable URL anchor derived from the initiative name. */
function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferColumn(headers: string[], patterns: RegExp[]): string | undefined {
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  for (const pattern of patterns) {
    const idx = lowerHeaders.findIndex((h) => pattern.test(h));
    if (idx !== -1) return headers[idx];
  }
  return undefined;
}

function loadProjects(): FieldGroup[] {
  const csvPath = path.join(
    process.cwd(),
    "data",
    "previous_replication_initiatives.csv"
  );

  if (!fs.existsSync(csvPath)) {
    return [];
  }

  const raw = fs.readFileSync(csvPath, "utf8");
  const rows = csvParse(raw) as unknown as CsvRow[];
  if (!rows.length) return [];

  const headers = Object.keys(rows[0]);

  const fieldKey =
    inferColumn(headers, [/field/, /discipline/]) ?? headers[0] ?? "field";
  const yearKey = inferColumn(headers, [/year/]);
  const nameKey =
    inferColumn(headers, [/project/, /name/, /title/]) ?? headers[1] ?? "name";
  // Use N_successful (or similar) as the replicated count (X)
  const replicatedKey = inferColumn(headers, [/n[_ ]?successful/, /successful/, /replicated/]);
  // Use N_original_experimental_effects (or similar) as the total count (Y)
  const totalKey = inferColumn(
    headers,
    [/n[_ ]?original/, /original/, /total/, /experiment/]
  );
  const replicationRateKey = inferColumn(headers, [/replication[_ ]?rate/, /replication.*rate/]);
  const effectSizeDeclineKey = inferColumn(headers, [
    /effect[_ ]?size[_ ]?decline/,
    /decline.*effect[_ ]?size/,
  ]);
  const descKey = inferColumn(headers, [/description/, /summary/]);
  const authorsKey = inferColumn(headers, [/author/]);
  const projectUrlKey = inferColumn(headers, [/info.*url/, /project.*url/, /website/]);
  const paperUrlKey = inferColumn(headers, [/paper/, /doi/, /publication/]);

  const slugCounts = new Map<string, number>();

  const projects: Project[] = rows.map((row, index) => {
    const name = row[nameKey] || `Project ${index + 1}`;
    const baseSlug = slugify(name) || `initiative-${index + 1}`;
    const seen = (slugCounts.get(baseSlug) ?? 0) + 1;
    slugCounts.set(baseSlug, seen);
    return {
      id: `${index}`,
      slug: seen === 1 ? baseSlug : `${baseSlug}-${seen}`,
      field: row[fieldKey] || "Uncategorized",
      year: yearKey ? row[yearKey] : undefined,
      name,
      replicatedCount: replicatedKey ? row[replicatedKey] : undefined,
      totalCount: totalKey ? row[totalKey] : undefined,
      replicationRate: replicationRateKey ? row[replicationRateKey] : undefined,
      effectSizeDecline: effectSizeDeclineKey ? row[effectSizeDeclineKey] : undefined,
      description: descKey ? row[descKey] : undefined,
      authors: authorsKey ? row[authorsKey] : undefined,
      projectUrl: projectUrlKey ? row[projectUrlKey] : undefined,
      paperUrl: paperUrlKey ? row[paperUrlKey] : undefined,
      tag: PROJECT_TO_TAG[name],
    };
  });

  const groupsMap = new Map<string, Project[]>();
  for (const project of projects) {
    const key = project.field || "Uncategorized";
    if (!groupsMap.has(key)) {
      groupsMap.set(key, []);
    }
    groupsMap.get(key)!.push(project);
  }

  const preferredOrder = ["Psychology", "Social Science"];

  const groups: FieldGroup[] = Array.from(groupsMap.entries())
    .map(([field, fieldProjects]) => ({
      field,
      projects: fieldProjects.sort((a, b) => {
        const ay = a.year ? parseInt(a.year, 10) || 0 : 0;
        const by = b.year ? parseInt(b.year, 10) || 0 : 0;
        if (ay && by && ay !== by) {
          // sort from oldest to newest
          return ay - by;
        }
        return a.name.localeCompare(b.name);
      }),
    }))
    .sort((a, b) => {
      const aIndex = preferredOrder.findIndex(
        (f) => f.toLowerCase() === a.field.toLowerCase()
      );
      const bIndex = preferredOrder.findIndex(
        (f) => f.toLowerCase() === b.field.toLowerCase()
      );

      const aPreferred = aIndex !== -1;
      const bPreferred = bIndex !== -1;

      if (aPreferred && bPreferred) {
        return aIndex - bIndex;
      }
      if (aPreferred && !bPreferred) return -1;
      if (!aPreferred && bPreferred) return 1;

      return a.field.localeCompare(b.field);
    });

  return groups;
}

export default function ReplicationProjectsPage() {
  const fieldGroups = loadProjects();

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-4 py-12 max-w-5xl">
          <h1 className="text-4xl font-bold mb-4 text-foreground">
            Replication initiatives
          </h1>
          <p className="text-foreground/70 leading-relaxed mb-8">
          </p>

          {fieldGroups.length === 0 ? (
            <p className="text-foreground/60">
              No data found. Make sure{" "}
              <code className="font-mono">
                public/assets/previous_replication_initiatives.csv
              </code>{" "}
              exists and has at least one row.
            </p>
          ) : (
            <InitiativesList fieldGroups={fieldGroups} />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}


