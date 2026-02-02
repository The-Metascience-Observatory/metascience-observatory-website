/**
 * Generate a short citation HTML string from discrete metadata fields.
 * Format: "LastName I. et al. Journal Year" linked to the DOI/URL.
 *
 * This replaces the pre-computed `*_citation_html` CSV columns,
 * producing equivalent output from the structured fields.
 */
export function generateCitationHtml(
  authors: string | undefined | null,
  journal: string | undefined | null,
  year: string | number | undefined | null,
  url: string | undefined | null
): string {
  const authorStr = String(authors ?? "").trim();
  const journalStr = String(journal ?? "").trim();
  const yearStr = year != null ? String(year).replace(/\.0$/, "").trim() : "";

  // Nothing useful to display
  if (!authorStr && !journalStr && !yearStr) return "";

  // Extract first author: "Firstname Lastname" or "F. Lastname" etc.
  const firstAuthor = authorStr.split(";")[0]?.trim() ?? "";
  let shortAuthor = "";
  if (firstAuthor) {
    const parts = firstAuthor.split(/\s+/);
    if (parts.length >= 2) {
      // Last name is the last token, first initial from the first token
      const lastName = parts[parts.length - 1];
      const firstInitial = parts[0].charAt(0).toUpperCase();
      shortAuthor = `${lastName} ${firstInitial}.`;
    } else {
      shortAuthor = parts[0];
    }
    if (authorStr.includes(";")) {
      shortAuthor += " <i>et al.</i>";
    }
  }

  const journalPart = journalStr ? ` <i>${journalStr}</i>` : "";
  const yearPart = yearStr ? ` ${yearStr}` : "";
  const inner = `${shortAuthor}${journalPart}${yearPart}`.trim();

  if (!inner) return "";

  const normalizedUrl = normalizeDoiUrl(String(url ?? "").trim());
  if (normalizedUrl) {
    return `<a href="${normalizedUrl}" target="_blank" style="text-decoration:none; color:inherit;">${inner}</a>`;
  }
  return inner;
}

/**
 * Normalize a URL: ensure doi.org URLs use https.
 */
function normalizeDoiUrl(url: string): string {
  if (!url) return "";
  return url.replace(/^http:\/\/doi\.org\//, "https://doi.org/");
}

/**
 * Replace doi.org links in citation HTML with explorer links.
 */
export function transformCitationHtmlToExplorer(html: string): string {
  if (!html) return html;
  return html.replace(
    /href=["']https?:\/\/doi\.org\/([^"']+)["']/g,
    (_, doi) =>
      `href="http://explore.metascienceobservatory.org/doi/${doi}" target="_blank" rel="noopener noreferrer"`
  );
}

/**
 * Extract plain-text searchable content from citation fields
 * (replaces searching through HTML strings).
 */
export function citationSearchText(
  authors: string | undefined | null,
  journal: string | undefined | null,
  year: string | number | undefined | null
): string {
  return `${authors ?? ""} ${journal ?? ""} ${year ?? ""}`;
}
