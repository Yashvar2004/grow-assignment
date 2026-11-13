import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseResume } from "../lib/parse-resume";
import { scoreText } from "../lib/scoring";
import type { Candidate } from "../lib/types";

const ASSIGNMENT_FILE_TARGET = 47;

type FileAudit = {
  filename: string;
  source: string;
  sourceSha256: string | null;
  candidateId: string;
  extractionStatus: Candidate["extractionStatus"];
  lcaScore: number | null;
  uiuxScore: number | null;
  unscored: boolean;
  failureReason: string | null;
  needsOcr: boolean;
  duplicate: boolean;
  duplicateOf: string | null;
  evidenceReference: string;
};

export type DatasetReport = {
  assignmentFileTarget: number;
  totalFiles: number;
  filesAccountedFor: number;
  fileCountDifferenceFromTarget: number;
  countMatchesAssignmentTarget: boolean;
  successfullyProcessedFiles: number;
  failedFiles: number;
  partialFiles: number;
  duplicateFiles: number;
  filesNeedingOcr: number;
  unsupportedFormatFiles: number;
  files: FileAudit[];
  failures: { filename: string; source: string; candidateId: string; reason: string }[];
};

function failureCandidate(filename: string, source: string, bytes: Buffer, message: string): Candidate {
  const scores = scoreText("");
  const id = `C-${createHash("sha256").update(filename).update(bytes).update(message).digest("hex").slice(0, 8).toUpperCase()}`;
  return {
    id, filename, source, createdAt: new Date().toISOString(), extractedText: "", normalizedText: "",
    education: [], experience: [], projects: [], certifications: [], skills: [], tools: [], portfolioLinks: [],
    sourceSha256: bytes.length ? createHash("sha256").update(bytes).digest("hex") : null,
    classification: "Neither / Uncertain", lcaScore: null, uiuxScore: null, lcaCoverage: 0, uiuxCoverage: 0,
    lcaCriteria: scores.lcaCriteria, uiuxCriteria: scores.uiuxCriteria,
    extractionStatus: "failed", extractionConfidence: 0, reviewFlags: [message], yearsExperience: null,
  };
}

/** Process every non-marker file recursively and retain one record per input file. */
export async function processDataset(
  inputDirectory = resolve("data/resumes"),
  outputDirectory = resolve("data"),
  assignmentTarget = ASSIGNMENT_FILE_TARGET,
): Promise<DatasetReport> {
  const entries = await readdir(inputDirectory, { recursive: true, withFileTypes: true });
  const filePaths = entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((filePath) => relative(inputDirectory, filePath).replaceAll("\\", "/") !== ".gitkeep")
    .sort((a, b) => a.localeCompare(b));

  const candidates: Candidate[] = [];
  const fileAudits: FileAudit[] = [];
  const firstSeen = new Map<string, string>();

  for (const filePath of filePaths) {
    const filename = relative(inputDirectory, filePath).replaceAll("\\", "/");
    const source = `data/resumes/${filename}`;
    let bytes = Buffer.alloc(0);
    let sourceSha256: string | null = null;
    let readFailure: string | null = null;
    try {
      bytes = await readFile(filePath);
      sourceSha256 = createHash("sha256").update(bytes).digest("hex");
    } catch (error) {
      readFailure = error instanceof Error ? `Could not read source file: ${error.message}` : "Could not read source file";
    }
    let candidate: Candidate;

    if (readFailure) {
      candidate = failureCandidate(filename, source, bytes, readFailure);
    } else {
      try {
        candidate = await parseResume(bytes, filename);
        candidate.source = source;
        candidate.sourceSha256 = sourceSha256;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown extraction error";
        candidate = failureCandidate(filename, source, bytes, message);
      }
    }

    // Compare normalized text where available; use the source hash for unreadable/empty files.
    const normalizedText = candidate.normalizedText.trim().toLowerCase();
    const duplicateKey = normalizedText
      ? `text:${normalizedText}`
      : sourceSha256
        ? `binary:${sourceSha256}`
        : `unreadable:${filename}`;
    const duplicateOf = firstSeen.get(duplicateKey) ?? null;
    if (duplicateOf) candidate.reviewFlags.push(`Duplicate content of candidate ${duplicateOf}; record retained for audit`);
    else firstSeen.set(duplicateKey, candidate.id);

    const needsOcr = candidate.reviewFlags.some((flag) => /ocr/i.test(flag));
    const failureReason = candidate.extractionStatus === "failed"
      ? candidate.reviewFlags.find((flag) => flag.trim().length > 0 && !/^duplicate content/i.test(flag)) ?? "Extraction failed"
      : null;
    const audit: FileAudit = {
      filename,
      source,
      sourceSha256,
      candidateId: candidate.id,
      extractionStatus: candidate.extractionStatus,
      lcaScore: candidate.lcaScore,
      uiuxScore: candidate.uiuxScore,
      unscored: candidate.lcaScore === null && candidate.uiuxScore === null,
      failureReason,
      needsOcr,
      duplicate: duplicateOf !== null,
      duplicateOf,
      evidenceReference: `candidateId:${candidate.id}`,
    };
    candidates.push(candidate);
    fileAudits.push(audit);
  }

  const failures = fileAudits
    .filter((file) => file.extractionStatus === "failed")
    .map((file) => ({ filename: file.filename, source: file.source, candidateId: file.candidateId, reason: file.failureReason ?? "Extraction failed" }));
  const report: DatasetReport = {
    assignmentFileTarget: assignmentTarget,
    totalFiles: filePaths.length,
    filesAccountedFor: fileAudits.length,
    fileCountDifferenceFromTarget: filePaths.length - assignmentTarget,
    countMatchesAssignmentTarget: filePaths.length === assignmentTarget,
    successfullyProcessedFiles: fileAudits.filter((file) => file.extractionStatus === "success").length,
    failedFiles: fileAudits.filter((file) => file.extractionStatus === "failed").length,
    partialFiles: fileAudits.filter((file) => file.extractionStatus === "partial").length,
    duplicateFiles: fileAudits.filter((file) => file.duplicate).length,
    filesNeedingOcr: fileAudits.filter((file) => file.needsOcr).length,
    unsupportedFormatFiles: fileAudits.filter((file) => /unsupported file type/i.test(file.failureReason ?? "")).length,
    files: fileAudits,
    failures,
  };

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(join(outputDirectory, "candidates.json"), `${JSON.stringify(candidates, null, 2)}\n`, "utf8");
  const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const columns: ((keyof Candidate) | "unscored")[] = ["id", "filename", "source", "classification", "lcaScore", "lcaCoverage", "uiuxScore", "uiuxCoverage", "yearsExperience", "extractionStatus", "extractionConfidence", "skills", "tools", "reviewFlags", "unscored", "sourceSha256"];
  const rows = [columns.join(","), ...candidates.map((candidate) => columns.map((column) => {
    const value = column === "unscored" ? candidate.lcaScore === null && candidate.uiuxScore === null : candidate[column];
    return csvCell(Array.isArray(value) ? value.join("; ") : value);
  }).join(","))];
  await writeFile(join(outputDirectory, "candidates.csv"), `${rows.join("\n")}\n`, "utf8");
  await writeFile(join(outputDirectory, "processing-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  const report = await processDataset();
  console.log(`Dataset audit: ${report.totalFiles} files found; ${report.filesAccountedFor} accounted for; ${report.successfullyProcessedFiles} successful; ${report.failedFiles} failed; ${report.duplicateFiles} duplicates; ${report.filesNeedingOcr} need OCR.`);
  if (report.filesAccountedFor !== report.totalFiles || !report.countMatchesAssignmentTarget) process.exitCode = 1;
}
