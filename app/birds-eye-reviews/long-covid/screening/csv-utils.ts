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
