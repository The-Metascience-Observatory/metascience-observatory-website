import {NextRequest,NextResponse} from "next/server";
import {loadRows} from "@/lib/birds-eye-reviews/mecfs-screening";
import {reviewDataPath} from "@/lib/birds-eye-reviews/data";
import {publicationFor} from "@/lib/long-covid/publications-server";
import {matchesPublication,metadataCounts,parseMedline,parsePublication} from "@/lib/long-covid/publications";
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") ?? "100", 10) || 100));
  const search = searchParams.get("search") ?? "";
  const source = searchParams.get("source") ?? "all";
  const treatment = searchParams.get("treatment") ?? "all";
  const trialType = searchParams.get("trialType") ?? "all";

  let rows = loadRows().map(r=>({...r, publicationMetadata:publicationFor(r.doi,reviewDataPath("me-cfs","publication_metadata.json"))}));

  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.doi.toLowerCase().includes(s) ||
        r.summary.toLowerCase().includes(s) ||
        r.title.toLowerCase().includes(s) ||
        r.authors.toLowerCase().includes(s) ||
        r.journal.toLowerCase().includes(s) ||
        r.topics.some((t) => t.toLowerCase().includes(s))
    );
  }
  if (source !== "all") rows = rows.filter((r) => r.source_folder === source);
  if (treatment !== "all") rows = rows.filter((r) => r.studies_treatment === treatment);
  if (trialType !== "all") rows = rows.filter((r) => r.trial_type === trialType);

  const medline=parseMedline(searchParams.get('medline'));
  const publication=parsePublication(searchParams.get('publication'));
  const counts=metadataCounts(rows,medline,publication);
  rows=rows.filter(r=>matchesPublication(r.publicationMetadata,medline,publication));
  return NextResponse.json({
    counts,
    total: rows.length,
    rows: rows.slice(offset, offset + limit),
  });
}
