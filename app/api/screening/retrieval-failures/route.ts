import failures from "@/data/birds_eye_reviews/long_covid/retrieval_failures_2026-03-08.json";

export function GET() {
  return Response.json(failures, {
    headers: { "Content-Disposition": 'attachment; filename="long-covid-retrieval-failures-2026-03-08.json"' },
  });
}
