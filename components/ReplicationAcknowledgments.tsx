// Count from replications_database_2026_10_01_120611.csv: rows with FORRT/FReD/FLoRA
// in source or validated_person, or a fred: upstream_effect_id (each row counted once).
// Refresh this count when the master dataset changes.
export function FredAcknowledgment({ expanded = false }: { expanded?: boolean }) {
  const Section = expanded ? "p" : "span";
  const referenceCardClass = "w-fit max-w-full rounded border border-primary bg-card px-2 py-1.5";

  return (
    <>
      <Section>Our Replications Database incorporates 2,018 rows from FORRT’s <a className="underline" href="https://forrt.org/apps/fred_explorer.html" target="_blank" rel="noreferrer">FReD</a> and <a className="underline" href="https://forrt.org/replication-hub/flora/" target="_blank" rel="noreferrer">FLoRA</a> projects. If you use FORRT-derived data, please cite:</Section>{" "}
      {/* Refresh this citation from FORRT's CITATION.cff when updating the imported data. */}
      <Section className={expanded ? referenceCardClass : undefined}>L. Wallrich, L. Röseler, et al., <a className="underline" href="https://doi.org/10.17605/OSF.IO/9R62X" target="_blank" rel="noreferrer">“FORRT Library of Replication Attempts (FLoRA)”</a> [Data set], <em>OSF</em>, 2026.</Section>{" "}
      <Section>See <a className="underline" href="https://forrt.org/about/cite_us/" target="_blank" rel="noreferrer">FORRT’s citation guidance</a> for the full author list and current citation, or their <a className="underline" href="https://github.com/forrtproject/fred-data/blob/main/CITATION.cff" target="_blank" rel="noreferrer">maintained citation metadata</a>.{expanded && " Also, we recommend citing these background references:"}</Section>{" "}
      {expanded ? (
        <div className="space-y-3">
          <p className={referenceCardClass}>
            L. Röseler et al., <a className="underline" href="https://openpsychologydata.metajnl.com/articles/10.5334/jopd.101" target="_blank" rel="noreferrer">“The Replication Database: Documenting the Replicability of Psychological Science”</a>, <em>Journal of Open Psychology Data</em>, <strong>12</strong>(1), Article 8, pp. 1–23, 2024.
          </p>
          <p className={referenceCardClass}>
            L. Röseler and A. Kühberger, <a className="underline" href="https://osf.io/preprints/metaarxiv/me2ub_v1" target="_blank" rel="noreferrer">“FReD: The Framework for Replication Databases”</a>, <em>MetaArXiv</em> [Preprint], 2025.
          </p>
        </div>
      ) : (
        <Section>Background references include <a className="underline" href="https://openpsychologydata.metajnl.com/articles/10.5334/jopd.101" target="_blank" rel="noreferrer">Röseler et al. (2024), <em>Journal of Open Psychology Data</em>, <strong>12</strong>: 8, pp. 1–23</a> and <a className="underline" href="https://osf.io/preprints/metaarxiv/me2ub_v1" target="_blank" rel="noreferrer">Röseler and Kühberger (2025), <em>FReD: The Framework for Replication Databases</em></a>.</Section>
      )}{" "}
      <Section>FReD data is © 2024 The Author(s) and licensed under <a className="underline" href="https://creativecommons.org/licenses/by/4.0/">CC-BY 4.0</a>. Data imported from <a className="underline" href="https://forrt.org/replication-hub/flora/" target="_blank" rel="noreferrer">FORRT FLoRA</a> is licensed under <a className="underline" href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Data that comes from FORRT FReD has a source column value that starts with &quot;FORRT FReD&quot;.{expanded && <> <FloraAcknowledgment /></>}</Section>
    </>
  );
}

export function FloraAcknowledgment() {
  return (
    <>
      Rows from FLoRA have &quot;FLoRA&quot; in the Source column.
    </>
  );
}

export function PerryAcknowledgment({ expanded = false }: { expanded?: boolean }) {
  const Section = expanded ? "p" : "span";

  return (
    <>
      <Section>We thank Tom Perry for providing the replication data from this paper:</Section>{" "}
      <Section className={expanded ? "w-fit max-w-full rounded border border-primary bg-card px-2 py-1.5" : undefined}>T. Perry, R. Morris, and R. Lea, <a className="underline" href="https://www.tandfonline.com/doi/full/10.1080/13803611.2021.2022315" target="_blank" rel="noreferrer">“A decade of replication study in education? A mapping review (2011–2020)”</a>, <em>Educational Research and Evaluation</em>, <strong>27</strong>(1–2), pp. 12–34, 2022.</Section>
    </>
  );
}
