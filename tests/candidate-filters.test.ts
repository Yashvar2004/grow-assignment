import { describe, expect, it } from "vitest";
import { matchesSkillQuery } from "../lib/candidate-filters";
import type { Candidate } from "../lib/types";

describe("full-resume skill filtering", () => {
  it("finds terms after the first 50 extracted lines", () => {
    const lateEvidence = Array.from({ length: 60 }, (_, index) => `Resume section ${index + 1}`).join("\n") + "\nLate-term: GaBi";
    const candidate = { skills: [], tools: [], normalizedText: lateEvidence, extractedText: lateEvidence } as unknown as Candidate;
    expect(matchesSkillQuery(candidate, "gabi")).toBe(true);
  });

  it("matches normalized skills and tools regardless of case", () => {
    const candidate = { skills: ["UI/UX principles"], tools: ["Figma"], normalizedText: "", extractedText: "" } as unknown as Candidate;
    expect(matchesSkillQuery(candidate, "FIGMA")).toBe(true);
    expect(matchesSkillQuery(candidate, "principles")).toBe(true);
    expect(matchesSkillQuery(candidate, "   ")).toBe(true);
  });
});
