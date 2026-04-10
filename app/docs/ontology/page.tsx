"use client";

import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DocsBackLink } from "@/components/DocsBackLink";
import MSO_ONTOLOGY from "@/data/metascience_observatory_topic_ontology.json";
import OPENALEX_ONTOLOGY from "@/data/open_alex_topic_classification_ontology.json";

type Ontology = Record<string, Record<string, string[]>>;

function countOntology(data: Ontology) {
  const fields = Object.keys(data).length;
  let disciplines = 0;
  let subdisciplines = 0;
  for (const discs of Object.values(data)) {
    disciplines += Object.keys(discs).length;
    for (const subs of Object.values(discs)) {
      subdisciplines += subs.length;
    }
  }
  return { fields, disciplines, subdisciplines };
}

const msoCounts = countOntology(MSO_ONTOLOGY as Ontology);

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

function OntologyTree({ data }: { data: Ontology }) {
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [expandedDiscs, setExpandedDiscs] = useState<Set<string>>(new Set());

  const toggleField = (field: string) => {
    setExpandedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const toggleDisc = (key: string) => {
    setExpandedDiscs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    const fields = new Set(Object.keys(data));
    const discs = new Set<string>();
    for (const [field, disciplines] of Object.entries(data)) {
      for (const disc of Object.keys(disciplines)) {
        discs.add(`${field}::${disc}`);
      }
    }
    setExpandedFields(fields);
    setExpandedDiscs(discs);
  };

  const collapseAll = () => {
    setExpandedFields(new Set());
    setExpandedDiscs(new Set());
  };

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <button onClick={expandAll} className="text-xs text-blue-600 hover:text-blue-700 underline">
          Expand all
        </button>
        <button onClick={collapseAll} className="text-xs text-blue-600 hover:text-blue-700 underline">
          Collapse all
        </button>
      </div>
      <div className="space-y-1">
        {Object.entries(data).map(([field, disciplines]) => {
          const discCount = Object.keys(disciplines).length;
          const fieldOpen = expandedFields.has(field);
          return (
            <div key={field}>
              <button
                onClick={() => toggleField(field)}
                className="flex items-center gap-1.5 w-full text-left py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
              >
                <ChevronRight className={`shrink-0 opacity-60 transition-transform duration-150 ${fieldOpen ? "rotate-90" : ""}`} />
                <span className="font-semibold text-foreground">{field}</span>
                <span className="text-xs text-foreground/50 ml-1">({discCount} discipline{discCount !== 1 ? "s" : ""})</span>
              </button>
              {fieldOpen && (
                <div className="ml-6 border-l border-border/50 pl-2">
                  {Object.entries(disciplines).map(([disc, subs]) => {
                    const discKey = `${field}::${disc}`;
                    const discOpen = expandedDiscs.has(discKey);
                    const hasSubs = subs.length > 0;
                    return (
                      <div key={discKey}>
                        {hasSubs ? (
                          <button
                            onClick={() => toggleDisc(discKey)}
                            className="flex items-center gap-1.5 w-full text-left py-1 px-2 rounded hover:bg-muted/50 transition-colors"
                          >
                            <ChevronRight className={`shrink-0 opacity-50 transition-transform duration-150 ${discOpen ? "rotate-90" : ""}`} />
                            <span className="text-foreground/90">{disc}</span>
                            <span className="text-xs text-foreground/40 ml-1">({subs.length})</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5 py-1 px-2">
                            <span className="w-4 shrink-0" />
                            <span className="text-foreground/90">{disc}</span>
                          </div>
                        )}
                        {discOpen && hasSubs && (
                          <div className="ml-6 border-l border-border/30 pl-2 pb-1">
                            {subs.map((sub) => (
                              <div key={sub} className="py-0.5 px-2 text-sm text-foreground/70">
                                {sub}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function OntologyPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="mx-auto px-6 sm:px-8 md:px-12 lg:px-16 xl:px-24 py-12">
          <div className="max-w-3xl mx-auto">
            <DocsBackLink />
            <h1 className="text-4xl font-bold mb-2 text-foreground leading-tight">Our Ontology for Classifying Paper Subjects</h1>
            <p className="text-foreground/70 mb-8 leading-relaxed">
              The Metascience Observatory uses a custom three-level hierarchy to classify scientific work: <strong className="text-foreground/90">field</strong>, <strong className="text-foreground/90">discipline</strong>, and <strong className="text-foreground/90">subdiscipline</strong>. The system takes some inspiration from the way that universities usually organize science into schools and majors. Below you can explore our ontology alongside the first three layers of the OpenAlex ontology. As of 2026, <a href="https://help.openalex.org/hc/en-us/articles/24736129405719-Topics" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 underline">OpenAlex classifies</a> scientific work into 4 domains, 26 fields, 252 subfields, and 4,516 topics. Currently, the Metascience Observatory classifies papers into {msoCounts.fields} fields, {msoCounts.disciplines} disciplines, and {msoCounts.subdisciplines} subdisciplines.  We are constantly refining and updating our ontology, with this page always showing the current version. Our system is admittadly somewhat ad-hoc, and is not intended to be systematically comprehensive like OpenAlex is. A few fields where we don't expect many replication studies are currently not included (like mathematics). OpenAlex's system also contains areas of research that are largely non-scientific in our view (like history, art).
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            <div>
              <h2 className="text-xl font-semibold mb-4 text-foreground">Metascience Observatory</h2>
              <OntologyTree data={MSO_ONTOLOGY as Ontology} />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-4 text-foreground">OpenAlex</h2>
              <OntologyTree data={OPENALEX_ONTOLOGY as Ontology} />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
