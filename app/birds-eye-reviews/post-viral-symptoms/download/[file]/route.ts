/** Downloads of the post-viral symptoms evidence: the two CSVs (every
 *  extracted estimate and contrast, kept or not, with quotes) and the release
 *  metadata. Only these named files are served. */
import fs from "fs";
import { NextResponse } from "next/server";
import { dataPath } from "../../data";

const FILES: Record<string, { name: string; type: string }> = {
  "estimates.csv": { name: "post_viral_symptoms_estimates.csv", type: "text/csv; charset=utf-8" },
  "contrasts.csv": { name: "post_viral_symptoms_contrasts.csv", type: "text/csv; charset=utf-8" },
  "last_updated.json": { name: "post_viral_symptoms_last_updated.json", type: "application/json" },
};

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const entry = FILES[file];
  if (!entry) return new NextResponse("Not found", { status: 404 });
  const data = fs.readFileSync(dataPath(file));
  return new NextResponse(data, {
    headers: {
      "Content-Type": entry.type,
      "Content-Disposition": `attachment; filename="${entry.name}"`,
    },
  });
}
