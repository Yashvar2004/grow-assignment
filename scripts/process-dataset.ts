import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { parseResume } from "../lib/parse-resume";
import { scoreText } from "../lib/scoring";
import type { Candidate } from "../lib/types";

const directory = resolve("data/resumes");
const files = (await readdir(directory, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name !== ".gitkeep" && !entry.name.startsWith("."))
  .map((entry) => join(entry.parentPath, entry.name))
  .sort((a, b) => a.localeCompare(b));

const records: Candidate[] = [];
const failures: { file: string; error: string }[] = [];
for (const filePath of files) {
  const filename = relative(directory, filePath).replaceAll("\\", "/");
  try {
    const candidate = await parseResume(await readFile(filePath), filename);
    candidate.source = `data/resumes/${filename}`;
    if (records.some((item) => item.normalizedText.length > 0 && item.normalizedText.trim().toLowerCase() === candidate.normalizedText.trim().toLowerCase())) {
      candidate.reviewFlags.push("Duplicate resume content detected; record retained for audit");
    }
    records.push(candidate);
    if (candidate.extractionStatus === "failed") failures.push({ file: filename, error: candidate.reviewFlags[0] ?? "No text extracted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown extraction error";
    const score = scoreText("");
    records.push({
      id: `C-${createHash("sha256").update(`${filename}:${message}`).digest("hex").slice(0, 8).toUpperCase()}`,
      filename, source: `data/resumes/${filename}`, createdAt: new Date().toISOString(), extractedText: "", normalizedText: "", education: [], experience: [], projects: [], certifications: [], skills: [], tools: [], portfolioLinks: [], classification: "Neither / Uncertain", lcaScore: null, uiuxScore: null, lcaCoverage: 0, uiuxCoverage: 0, lcaCriteria: score.lcaCriteria, uiuxCriteria: score.uiuxCriteria, extractionStatus: "failed", extractionConfidence: 0, reviewFlags: [message], yearsExperience: null,
    });
    failures.push({ file: filename, error: message });
  }
}
await writeFile(resolve("data/candidates.json"), `${JSON.stringify(records, null, 2)}\n`, "utf8");
const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const columns: (keyof Candidate)[] = ["id", "filename", "source", "classification", "lcaScore", "lcaCoverage", "uiuxScore", "uiuxCoverage", "yearsExperience", "extractionStatus", "extractionConfidence", "skills", "tools", "reviewFlags"];
const rows = [columns.join(","), ...records.map((item) => columns.map((column) => csvCell(Array.isArray(item[column]) ? (item[column] as string[]).join("; ") : item[column])).join(","))];
await writeFile(resolve("data/candidates.csv"), `${rows.join("\n")}\n`, "utf8");
await writeFile(resolve("data/processing-report.json"), `${JSON.stringify({ expectedFiles: files.length, processedRecords: records.length, successful: records.filter((item) => item.extractionStatus === "success").length, failed: failures.length, failures }, null, 2)}\n`, "utf8");
console.log(`Processed ${records.length} of ${files.length} resume files; ${failures.length} extraction issue(s).`);
if (records.length !== files.length) process.exitCode = 1;
