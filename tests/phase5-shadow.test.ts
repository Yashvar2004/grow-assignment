import { describe, expect, it } from "vitest";
import { evaluatePhase5, LCA_WEIGHTS, UIUX_WEIGHTS, rankShadow } from "../lib/phase5-shadow";
import type { Candidate } from "../lib/types";

function candidate(id: string, text: string, status: Candidate["extractionStatus"] = "success"): Candidate {
  return {
    id, filename: `${id}.txt`, source: `data/resumes/${id}.txt`, sourceSha256: "abc", createdAt: "2026-01-01T00:00:00.000Z",
    extractedText: text, normalizedText: text, education: [], experience: [], projects: [], certifications: [], skills: [], tools: [], portfolioLinks: [],
    classification: "Neither / Uncertain", lcaScore: null, uiuxScore: null, lcaCoverage: 0, uiuxCoverage: 0, lcaCriteria: [], uiuxCriteria: [],
    extractionStatus: status, extractionConfidence: 0, reviewFlags: [], yearsExperience: null,
  };
}

describe("Phase 5 shadow evaluator", () => {
  it("uses provisional weights totaling 100 without touching the legacy model", () => {
    expect(LCA_WEIGHTS.reduce((a, b) => a + b, 0)).toBe(100);
    expect(UIUX_WEIGHTS.reduce((a, b) => a + b, 0)).toBe(100);
  });
  it("does not treat generic portfolio, engineering case study, stakeholder coordination or general impact assessment as role proof", () => {
    const result = evaluatePhase5(candidate("FALSE-POS", "Engineering case study for a business portfolio. Coordinated stakeholders. Conducted general impact assessment."));
    expect(result.proposedClassification).toBe("Neither / Uncertain");
    expect(result.uiux.criteria.find((c) => c.id === "design_work")?.status).toBe("unknown");
    expect(result.lca.criteria.find((c) => c.id === "modelling_operations")?.status).toBe("unknown");
    expect(result.humanReview).toBe(true);
  });
  it("keeps skill-list-only tools and standards below demonstrated application", () => {
    const result = evaluatePhase5(candidate("LIST", "Core Skills\nGaBi, SimaPro, ISO 14040, ISO 14044, LCA"));
    expect(result.lca.criteria.find((c) => c.id === "software")?.status).toBe("list_only");
    expect(result.lca.criteria.find((c) => c.id === "iso14040")?.status).toBe("list_only");
    expect(result.lca.eligibility.tool).toBe("needs_verification");
  });
  it("normalizes known evidence and exposes coverage and uncertainty separately", () => {
    const result = evaluatePhase5(candidate("KNOWN", "Projects\nDesigned a responsive website interface in Figma and built high-fidelity prototypes."));
    expect(result.uiux.score).not.toBeNull();
    expect(result.uiux.coverage).toBeGreaterThan(0);
    expect(result.uiux.interval?.lower).toBeLessThanOrEqual(result.uiux.score!);
    expect(result.uiux.interval?.upper).toBeGreaterThanOrEqual(result.uiux.score!);
  });
  it("leaves failed and evidence-free records unscored and unranked", () => {
    const failed = evaluatePhase5(candidate("FAILED", "", "failed"));
    const empty = evaluatePhase5(candidate("EMPTY", ""));
    expect(failed.lca.score).toBeNull(); expect(failed.uiux.score).toBeNull(); expect(failed.proposedClassification).toBe("Unscored");
    expect(empty.lca.score).toBeNull(); expect(empty.uiux.score).toBeNull();
    rankShadow([failed, empty], "lca");
    expect(failed.lca.rank).toBeNull(); expect(empty.lca.rank).toBeNull();
  });
  it("keeps portfolio URLs uninspected and operational answers pending", () => {
    const c = candidate("URL", "Designed a mobile interface using Figma."); c.portfolioLinks = ["https://example.test"];
    const result = evaluatePhase5(c);
    expect(result.portfolioReview.status).toBe("provided_not_inspected");
    expect(Object.values(result.operationalQuestions).every((v) => v === "pending")).toBe(true);
  });
  it("flags a UI/UX portfolio case study only as audit context, without converting an engineering case study into UX evidence", () => {
    const result = evaluatePhase5(candidate("ENGINE", "Engineering Experience\nBronze IC Engine Design Case Study\nBusiness portfolio prepared for stakeholders."));
    expect(result.proposedClassification).toBe("Neither / Uncertain");
    expect(result.humanReviewReasons).toContain("Engineering case study is not established as a UX case study.");
    expect(result.humanReviewReasons).toContain("Portfolio mention may be non-design or business portfolio evidence.");
  });
  it("does not use general employment duration to flag UI/UX experience", () => {
    const c = candidate("GENERAL-YEARS", "Environmental engineer with 5 years of experience in compliance."); c.yearsExperience = 5;
    expect(evaluatePhase5(c).uiux.eligibility.experienceRange).toBe("no_penalty_fresher_or_transition_candidate");
  });
});
