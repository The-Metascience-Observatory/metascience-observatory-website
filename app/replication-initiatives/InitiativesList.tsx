"use client";

import { useEffect, useRef, useState } from "react";
import { Link2 } from "lucide-react";
import type { FieldGroup } from "./types";

const COLOR_SCHEMES = [
  { main: "bg-sky-200", detail: "bg-sky-50" },
  { main: "bg-emerald-200", detail: "bg-emerald-50" },
  { main: "bg-amber-200", detail: "bg-amber-50" },
  { main: "bg-rose-200", detail: "bg-rose-50" },
  { main: "bg-indigo-200", detail: "bg-indigo-50" },
];

export function InitiativesList({ fieldGroups }: { fieldGroups: FieldGroup[] }) {
  const allSlugs = fieldGroups.flatMap((g) => g.projects.map((p) => p.slug));

  // Details are open by default; the toggle flips every panel at once.
  const [openSlugs, setOpenSlugs] = useState<Set<string>>(
    () => new Set(allSlugs)
  );
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allOpen = openSlugs.size === allSlugs.length;

  // Open + scroll to the initiative named in the URL hash (on load and on
  // subsequent hash changes, e.g. when someone clicks a copied link).
  useEffect(() => {
    const goToHash = () => {
      const slug = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      if (!slug || !allSlugs.includes(slug)) return;
      setOpenSlugs((prev) => new Set(prev).add(slug));
      // Wait for the details element to render open before scrolling.
      requestAnimationFrame(() => {
        document
          .getElementById(slug)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };

    goToHash();
    window.addEventListener("hashchange", goToHash);
    return () => window.removeEventListener("hashchange", goToHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const toggleAll = () => {
    setOpenSlugs(allOpen ? new Set() : new Set(allSlugs));
  };

  const setOpen = (slug: string, open: boolean) => {
    setOpenSlugs((prev) => {
      const next = new Set(prev);
      if (open) next.add(slug);
      else next.delete(slug);
      return next;
    });
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}${window.location.pathname}#${slug}`;
    history.replaceState(null, "", `#${slug}`);
    navigator.clipboard?.writeText(url).catch(() => {
      /* clipboard unavailable — the URL bar still shows the anchor */
    });
    setCopiedSlug(slug);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedSlug(null), 1500);
  };

  return (
    <>
      <div className="flex items-center justify-end mb-6">
        <button
          type="button"
          onClick={toggleAll}
          aria-pressed={allOpen}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
        >
          <span
            className={`inline-block h-4 w-7 rounded-full transition-colors ${
              allOpen ? "bg-primary" : "bg-foreground/25"
            }`}
          >
            <span
              className={`block h-3 w-3 mt-0.5 rounded-full bg-white transition-transform ${
                allOpen ? "translate-x-3.5" : "translate-x-0.5"
              }`}
            />
          </span>
          {allOpen ? "Hide all details" : "Show all details"}
        </button>
      </div>

      <div className="space-y-10">
        {fieldGroups.map((group) => (
          <section key={group.field} className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground border-b border-border pb-1">
              {group.field}
            </h2>
            <div className="space-y-3">
              {group.projects.map((project, index) => {
                const scheme = COLOR_SCHEMES[index % COLOR_SCHEMES.length];
                return (
                  <details
                    key={project.id}
                    id={project.slug}
                    open={openSlugs.has(project.slug)}
                    onToggle={(e) =>
                      setOpen(project.slug, e.currentTarget.open)
                    }
                    className={`group border border-border rounded-none scroll-mt-24 ${scheme.main}`}
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
                            {project.replicatedCount && project.totalCount && (
                              <>
                                {" "}
                                ({project.replicatedCount}/{project.totalCount})
                              </>
                            )}
                          </span>
                        )}
                        <button
                          type="button"
                          title="Copy link to this initiative"
                          aria-label={`Copy link to ${project.name}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            copyLink(project.slug);
                          }}
                          className="text-foreground/50 hover:text-foreground transition-colors shrink-0"
                        >
                          {copiedSlug === project.slug ? (
                            <span className="text-xs font-medium">Copied</span>
                          ) : (
                            <Link2 className="h-4 w-4" />
                          )}
                        </button>
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
                            Observed effects were {project.effectSizeDecline}%
                            smaller on average (i.e.,{" "}
                            {100 - Number(project.effectSizeDecline)}% the size
                            of the original effect size, on average).
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
                      {(project.projectUrl ||
                        project.paperUrl ||
                        project.tag) && (
                        <p className="flex flex-wrap gap-4">
                          {project.tag && (
                            <a
                              href={`/replications-database?initiative=${project.tag}`}
                              className="text-primary hover:underline"
                            >
                              View in replications database →
                            </a>
                          )}
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
    </>
  );
}
