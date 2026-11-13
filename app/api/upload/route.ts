import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { parseResume } from "../../../lib/parse-resume";
import { scoreText } from "../../../lib/scoring";
import type { Candidate } from "../../../lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a resume file to upload." }, { status: 400 });
    if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "File exceeds the 4 MB upload limit." }, { status: 413 });
    if (!/\.(pdf|docx|txt)$/i.test(file.name)) return NextResponse.json({ error: "Unsupported file type. Upload a PDF, DOCX, or TXT resume." }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    try {
      const candidate = await parseResume(bytes, file.name);
      return NextResponse.json({ candidate });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Resume extraction failed.";
      const score = scoreText("");
      const candidate: Candidate = {
        id: `C-${createHash("sha256").update(file.name).update(bytes).digest("hex").slice(0, 8).toUpperCase()}`,
        filename: file.name, source: `upload:${file.name}`, createdAt: new Date().toISOString(), extractedText: "", normalizedText: "", education: [], experience: [], projects: [], certifications: [], skills: [], tools: [], portfolioLinks: [], classification: "Neither / Uncertain", lcaScore: null, uiuxScore: null, lcaCoverage: 0, uiuxCoverage: 0, lcaCriteria: score.lcaCriteria, uiuxCriteria: score.uiuxCriteria, extractionStatus: "failed", extractionConfidence: 0, reviewFlags: [message], yearsExperience: null,
      };
      return NextResponse.json({ candidate });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Resume processing failed." }, { status: 400 });
  }
}
