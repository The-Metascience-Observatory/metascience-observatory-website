import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

export async function GET() {
  const filePath = path.join(
    process.cwd(),
    "data/birds_eye_reviews/long_covid/trial_screening.csv"
  );
  const data = fs.readFileSync(filePath);
  return new NextResponse(data, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="trial_screening.csv"',
    },
  });
}
