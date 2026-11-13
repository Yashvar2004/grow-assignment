import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { processDataset } from "../scripts/process-dataset";
import { makePdf } from "./helpers";

describe("dataset processor audit", () => {
  it("accounts for successes, failures, duplicates, and OCR files with source references", async () => {
    const root = await mkdtemp(join(tmpdir(), "talentrank-ingestion-"));
    const input = join(root, "resumes");
    const output = join(root, "output");
    await mkdir(input, { recursive: true });
    const nestedBatch = join(input, "Batch A");
    await mkdir(nestedBatch);
    const resumeText = "UI/UX Design Intern\nDesigned a mobile app case study in Figma and conducted usability testing.";
    await writeFile(join(nestedBatch, "Candidate 01.txt"), resumeText);
    await writeFile(join(input, "candidate-02.txt"), resumeText);
    await writeFile(join(input, "unsupported.rtf"), "Unsupported resume format");
    await writeFile(join(input, "scanned.pdf"), makePdf(""));
    await writeFile(join(input, "corrupt.docx"), "not a valid DOCX archive");
    await writeFile(join(input, "blank.txt"), " ");
    await writeFile(join(input, ".hidden-resume.txt"), resumeText.replace("mobile app", "career portal"));
    await writeFile(join(input, ".gitkeep"), "");

    try {
      const report = await processDataset(input, output, 47);
      expect(report.totalFiles).toBe(7);
      expect(report.filesAccountedFor).toBe(7);
      expect(report.fileCountDifferenceFromTarget).toBe(-40);
      expect(report.countMatchesAssignmentTarget).toBe(false);
      expect(report.successfullyProcessedFiles).toBe(3);
      expect(report.failedFiles).toBe(4);
      expect(report.duplicateFiles).toBe(1);
      expect(report.filesNeedingOcr).toBe(1);
      expect(report.unsupportedFormatFiles).toBe(1);
      expect(report.files.find((file) => file.filename === "blank.txt")?.failureReason).toBeTruthy();
      expect(report.files.find((file) => file.filename === "blank.txt")).toMatchObject({ extractionStatus: "failed", lcaScore: null, uiuxScore: null, unscored: true });

      const duplicate = report.files.find((file) => file.filename === "candidate-02.txt");
      if (!duplicate) throw new Error("Expected duplicate file audit entry");
      expect(duplicate?.duplicate).toBe(true);
      expect(duplicate?.duplicateOf).toMatch(/^C-/);
      expect(duplicate?.source).toBe("data/resumes/candidate-02.txt");
      expect(duplicate?.evidenceReference).toContain(duplicate.candidateId);
      expect(report.files.find((file) => file.filename === "scanned.pdf")?.needsOcr).toBe(true);
      expect(report.files.find((file) => file.filename === "unsupported.rtf")?.failureReason).toMatch(/unsupported file type/i);

      const records = JSON.parse(await readFile(join(output, "candidates.json"), "utf8"));
      expect(records).toHaveLength(7);
      for (const record of records) {
        const audit = report.files.find((file) => file.candidateId === record.id);
        expect(record.sourceSha256).toBe(audit?.sourceSha256);
        expect(record.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
      }
      const blankRecord = records.find((candidate: { filename: string }) => candidate.filename === "blank.txt");
      expect(blankRecord).toMatchObject({ extractionStatus: "failed", lcaScore: null, uiuxScore: null, source: "data/resumes/blank.txt" });
      expect(blankRecord.lcaCriteria).toHaveLength(6);
      expect(blankRecord.uiuxCriteria).toHaveLength(6);
      expect(records.some((candidate: { filename: string }) => candidate.filename === ".hidden-resume.txt")).toBe(true);
      const csv = await readFile(join(output, "candidates.csv"), "utf8");
      expect(csv).toContain("Batch A/Candidate 01.txt");
      expect(csv.split("\n").find((line) => line.includes("blank.txt"))).toContain('"true"');
      expect(JSON.parse(await readFile(join(output, "processing-report.json"), "utf8"))).toMatchObject({
        totalFiles: 7,
        filesAccountedFor: 7,
        successfullyProcessedFiles: 3,
        failedFiles: 4,
        duplicateFiles: 1,
        filesNeedingOcr: 1,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
