import type { Candidate } from "./types";

type QualityInput = Pick<Candidate, "extractedText" | "extractionStatus" | "extractionConfidence" | "education" | "experience" | "projects" | "certifications">;

export type ExtractionQuality = {
  textLength: number;
  capturedSections: number;
  totalSections: number;
  sectionCounts: { label: string; count: number }[];
  notes: string[];
};

export function getExtractionQuality(candidate: QualityInput): ExtractionQuality {
  const sectionCounts = [
    { label: "Education", count: candidate.education.length },
    { label: "Experience", count: candidate.experience.length },
    { label: "Projects", count: candidate.projects.length },
    { label: "Certifications", count: candidate.certifications.length },
  ];
  const textLength = candidate.extractedText.trim().length;
  const notes: string[] = [];

  if (candidate.extractionStatus === "failed") notes.push("No usable text was extracted; scores are unscored.");
  else if (candidate.extractionStatus === "partial") notes.push("Extraction was partial; review the original source.");
  if (candidate.extractionStatus !== "failed" && textLength < 180) notes.push("Very short extracted text; structured fields may be incomplete.");
  const missingSections = sectionCounts.filter((section) => section.count === 0).map((section) => section.label);
  if (candidate.extractionStatus !== "failed" && missingSections.length) {
    notes.push(`No structured ${missingSections.join(", ")} fields were captured. This is unknown, not confirmed absence.`);
  }

  return {
    textLength,
    capturedSections: sectionCounts.filter((section) => section.count > 0).length,
    totalSections: sectionCounts.length,
    sectionCounts,
    notes,
  };
}
