/** Full CSV parser that handles quoted fields with commas and newlines */
export function parseCSV(text: string): string[][] {
  const records: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) && !inQuotes) {
      if (ch === "\r") i++; // skip \n in \r\n
      row.push(current);
      current = "";
      if (row.some((v) => v.trim())) records.push(row);
      row = [];
    } else {
      current += ch;
    }
  }
  // Last row
  row.push(current);
  if (row.some((v) => v.trim())) records.push(row);

  return records;
}

export const stripTags = (s: string) => s.replace(/<[^>]*>/g, "");

// Domain acronyms to keep uppercased when sentence-casing an ALL-CAPS title.
const TITLE_ACRONYMS = new Set([
  "COVID", "COVID-19", "SARS", "SARS-COV-2", "MERS", "RSV", "HIV", "DNA", "RNA",
  "PCR", "RT-PCR", "ARVI", "URTI", "URI", "ENT", "ICU", "IFN", "NO", "NONS",
  "PVP-I", "IGG", "IGM", "IGA", "IGY", "UK", "USA", "US", "WHO", "HSV",
]);

/** Normalize a journal-article title for display:
 *  1. strip a leading "[" / trailing "]" (PubMed translated-title convention),
 *  2. if the title is ALL-CAPS, convert to sentence case (first word capitalized),
 *     restoring common acronyms so e.g. SARS / COVID-19 don't become Sars / Covid-19. */
export function normalizeTitle(s: string): string {
  let t = s.trim();
  t = t.replace(/^\[/, "").replace(/\]\.?$/, "").trim();

  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters.length > 0 && letters === letters.toUpperCase()) {
    const lower = t.toLowerCase();
    t = (lower.charAt(0).toUpperCase() + lower.slice(1)).replace(
      /[A-Za-z][\w-]*/g,
      (w) => (TITLE_ACRONYMS.has(w.toUpperCase()) ? w.toUpperCase() : w)
    );
  }
  return t;
}
