import fs from "fs";
import path from "path";
import { csvParse } from "d3-dsv";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

type CsvRow = Record<string, string>;

interface Project {
  id: string;
  field: string;
  year?: string;
  name: string;
  replicatedCount?: string;
  totalCount?: string;
  replicationRate?: string;
  effectSizeDecline?: string;
  description?: string;
  authors?: string;
  projectUrl?: string;
  paperUrl?: string;
}

interface FieldGroup {
  field: string;
  projects: Project[];
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
    "public",
    "assets",
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

  const projects: Project[] = rows.map((row, index) => {
    return {
      id: `${index}`,
      field: row[fieldKey] || "Uncategorized",
      year: yearKey ? row[yearKey] : undefined,
      name: row[nameKey] || `Project ${index + 1}`,
      replicatedCount: replicatedKey ? row[replicatedKey] : undefined,
      totalCount: totalKey ? row[totalKey] : undefined,
      replicationRate: replicationRateKey ? row[replicationRateKey] : undefined,
      effectSizeDecline: effectSizeDeclineKey ? row[effectSizeDeclineKey] : undefined,
      description: descKey ? row[descKey] : undefined,
      authors: authorsKey ? row[authorsKey] : undefined,
      projectUrl: projectUrlKey ? row[projectUrlKey] : undefined,
      paperUrl: paperUrlKey ? row[paperUrlKey] : undefined,
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
            Previous replication initiatives
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
            <div className="space-y-10">
              {fieldGroups.map((group) => (
                <section key={group.field} className="space-y-4">
                  <h2 className="text-2xl font-semibold text-foreground border-b border-border pb-1">
                    {group.field}
                  </h2>
                  <div className="space-y-3">
                    {group.projects.map((project, index) => {
                      const colorSchemes = [
                        { main: "bg-sky-200", detail: "bg-sky-50" },
                        { main: "bg-emerald-200", detail: "bg-emerald-50" },
                        { main: "bg-amber-200", detail: "bg-amber-50" },
                        { main: "bg-rose-200", detail: "bg-rose-50" },
                        { main: "bg-indigo-200", detail: "bg-indigo-50" },
                      ];

                      const scheme =
                        colorSchemes[index % colorSchemes.length];
                      return (
                        <details
                          key={project.id}
                          className={`group border border-border rounded-none ${scheme.main}`}
                        >
                          <summary className="flex items-center justify-between px-3 py-2 cursor-pointer list-none">
                            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                              <span className="text-sm text-foreground w-16">
                                {project.year || "—"}
                              </span>
                              <span className="font-medium text-foreground">
                                {project.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 ml-auto">
                              {project.replicationRate && (
                                <span className="text-sm text-foreground text-right">
                                  <span className="font-semibold">
                                    Replication rate ~ {project.replicationRate}%
                                  </span>
                                  {project.replicatedCount &&
                                    project.totalCount && (
                                      <> ({project.replicatedCount}/{project.totalCount})</>
                                    )}
                                </span>
                              )}
                              <span className="text-foreground/60 transform transition-transform group-open:rotate-180">
                                ▼
                              </span>
                            </div>
                          </summary>
                          <div
                            className={`px-3 pb-3 pt-2 border-t border-border text-sm text-foreground/80 space-y-2 ${scheme.detail}`}
                          >
                            {project.description && (
                              <div
                                className="leading-relaxed"
                                // Description may contain basic HTML (e.g., <i>, <b>, <a>).
                                // It is sourced from our own CSV content.
                                dangerouslySetInnerHTML={{
                                  __html: project.description,
                                }}
                              />
                            )}
                            {project.effectSizeDecline && (
                              <p className="leading-relaxed">
                                <span className="font-semibold">
                                  Observed effects were {project.effectSizeDecline}% smaller on
                                  average (i.e., {100 - Number(project.effectSizeDecline)}% the
                                  size of the original effect size, on average).
                                </span>
                              </p>
                            )}
                            {project.authors && (
                              <p>
                                <span className="font-semibold text-foreground">
                                  Authors:
                                </span>{" "}
                                {project.authors}
                              </p>
                            )}
                            {(project.projectUrl || project.paperUrl) && (
                              <p className="flex flex-wrap gap-4">
                                {project.projectUrl && (
                                  <a
                                    href={project.projectUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                  >
                                    Project page
                                  </a>
                                )}
                                {project.paperUrl && (
                                  <a
                                    href={project.paperUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                  >
                                    Paper
                                  </a>
                                )}
                              </p>
                            )}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}


