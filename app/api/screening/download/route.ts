import fs from "fs";
import { longCovidDataPath } from "@/lib/long-covid/data-path";
import { NextResponse } from "next/server";

export async function GET() {
  const filePath = longCovidDataPath("trial_screening.csv");
  const data = fs.readFileSync(filePath);
  return new NextResponse(data, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="trial_screening.csv"',
    },
  });
}
