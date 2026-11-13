import { describe, expect, it } from "vitest";
import { getExtractionQuality } from "../lib/extraction-quality";
import type { Candidate } from "../lib/types";

function qualityInput(overrides: Partial<Candidate> = {}) {
  return {
    extractedText: "Resume text",
    extractionStatus: "success",
    extractionConfidence: 40,
    education: [],
    experience: [],
    projects: [],
    certifications: [],
    ...overrides,
  } as Candidate;
}

describe("extraction quality presentation data", () => {
  it("labels missing structured fields as unknown rather than absent", () => {
    const quality = getExtractionQuality(qualityInput());
    expect(quality.notes.join(" ")).toMatch(/unknown, not confirmed absence/i);
    expect(quality.textLength).toBe("Resume text".length);
  });

  it("reports blank extraction without assigning a fit score", () => {
    const quality = getExtractionQuality(qualityInput({ extractedText: "", extractionStatus: "failed" }));
    expect(quality.notes).toContain("No usable text was extracted; scores are unscored.");
    expect(quality.textLength).toBe(0);
  });
});
