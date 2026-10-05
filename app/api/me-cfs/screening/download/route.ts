import fs from "node:fs";
import {NextResponse} from "next/server";
import {reviewDataPath} from "@/lib/birds-eye-reviews/data";
export function GET(){return new NextResponse(fs.readFileSync(reviewDataPath("me-cfs","trial_screening.csv")),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="me_cfs_screening.csv"'}});}
