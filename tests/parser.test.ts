import { describe, expect, it } from "vitest";
import { extractText, parseResume } from "../lib/parse-resume";
import { makeDocx, makePdf } from "./helpers";

const evidenceText = "Life Cycle Assessment Analyst\nConducted a product life cycle assessment project using GaBi and ISO 14044.\nBuilt an LCI model and evaluated impact assessment.";

describe("resume extraction and validation", () => {
  it("extracts embedded PDF text", async () => {
    const result = await extractText(makePdf(evidenceText), "candidate.pdf");
    expect(result.status).toBe("success");
    expect(result.text).toContain("GaBi");
  });
  it("extracts DOCX text", async () => {
    const result = await extractText(await makeDocx(evidenceText), "candidate.docx");
    expect(result.status).toBe("success");
    expect(result.text).toContain("ISO 14044");
  });
  it("reports scanned PDFs that need OCR", async () => {
    const result = await extractText(makePdf(""), "scanned.pdf");
    expect(result.status).toBe("failed");
    expect(result.message).toMatch(/OCR/i);
  });
  it("rejects invalid file types, empty uploads, and oversized resumes", async () => {
    await expect(parseResume(Buffer.from("text"), "resume.exe")).rejects.toThrow(/Unsupported file type/i);
    await expect(parseResume(Buffer.alloc(0), "empty.txt")).rejects.toThrow(/empty/i);
    await expect(parseResume(Buffer.alloc(4 * 1024 * 1024 + 1), "large.txt")).rejects.toThrow(/4 MB/i);
  });
  it("creates a useful record when experience is not stated", async () => {
    const result = await parseResume(Buffer.from("Conducted an LCA inventory project using GaBi."), "no-duration.txt");
    expect(result.yearsExperience).toBeNull();
    expect(result.reviewFlags).toContain("Experience duration not verified");
  });
  it("marks the linked JD’s independent LCA experience as verified when stated", async () => {
    const result = await parseResume(Buffer.from("3 years of independent LCA experience. Conducted an LCA project using GaBi."), "lca-experience.txt");
    expect(result.reviewFlags).not.toContain("Linked JD requirement for independent LCA experience needs review");
  });
  it("preserves reference names, redacts contact details, and reports extraction errors", async () => {
    const result = await parseResume(Buffer.from("Designed a Figma portfolio case study. Contact me at private@example.com"), "anonymous-17.txt");
    expect(result.filename).toBe("anonymous-17.txt");
    expect(result.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.extractedText).not.toContain("private@example.com");
    expect(result.extractedText).toContain("[contact redacted]");
    const emptyText = await parseResume(Buffer.from(" \n "), "blank.txt");
    expect(emptyText.extractionStatus).toBe("failed");
    expect(emptyText.reviewFlags).toContain("No text could be extracted from this file.");
  });
});
