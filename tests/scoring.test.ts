import { describe, expect, it } from "vitest";
import { classify, LCA_CRITERIA, rankCandidates, rankPositions, scoreText, UIUX_CRITERIA, yearsFromText } from "../lib/scoring";
import { insertCandidate, isDuplicateCandidate } from "../lib/pool";
import type { Candidate } from "../lib/types";

const lcaResume = `Life Cycle Assessment Analyst · 3 years of independent LCA experience\nConducted a cradle-to-gate product life cycle assessment for a packaging project using GaBi, ISO 14040 and ISO 14044.\nBuilt the life cycle inventory and modelled impact assessment categories.\nMSc Environmental Sustainability.`;
const uiResume = `UI/UX Design Intern\nDesigned a mobile banking case study in Figma, creating wireframes and interactive prototypes.\nConducted user interviews and usability testing to improve navigation and visual hierarchy.\nPortfolio: https://portfolio.example/work`;
const unrelatedResume = `Operations coordinator with experience scheduling teams and preparing monthly reports.\nManaged invoices, payroll, and office supplies.`;

function candidate(id: string, text: string): Candidate {
  const scored = scoreText(text);
  return { id, filename: `${id}.txt`, source: `test:${id}`, createdAt: "2026-01-01T00:00:00.000Z", extractedText: text, normalizedText: text, education: [], experience: [], projects: [], certifications: [], skills: [], tools: [], portfolioLinks: [], classification: classify(scored.lca.score, scored.uiux.score, scored.lcaCriteria, scored.uiuxCriteria), lcaScore: scored.lca.score, uiuxScore: scored.uiux.score, lcaCoverage: scored.lca.coverage, uiuxCoverage: scored.uiux.coverage, lcaCriteria: scored.lcaCriteria, uiuxCriteria: scored.uiuxCriteria, extractionStatus: "success", extractionConfidence: 80, reviewFlags: [], yearsExperience: yearsFromText(text) };
}

describe("TalentRank deterministic scoring", () => {
  it("uses the configured weights which total 100 per role", () => {
    expect(LCA_CRITERIA.reduce((total, item) => total + item.weight, 0)).toBe(100);
    expect(UIUX_CRITERIA.reduce((total, item) => total + item.weight, 0)).toBe(100);
  });
  it("applies configurable weights while keeping role totals normalized", () => {
    const defaultScore = scoreText(lcaResume).lca.score;
    const custom = scoreText(lcaResume, { lca: { experience: 30, tools: 10, projects: 10, iso: 10, methods: 20, education: 20 }, uiux: { principles: 20, figma: 20, portfolio: 20, research: 15, visual: 15, collaboration: 10 } });
    expect(custom.lca.score).not.toBe(defaultScore);
    expect(custom.lcaCriteria.reduce((sum, item) => sum + item.weight, 0)).toBe(100);
  });
  it("classifies contextual LCA and UI/UX evidence", () => {
    expect(candidate("LCA-1", lcaResume).classification).toBe("LCA");
    expect(candidate("UX-1", uiResume).classification).toBe("UI/UX");
    expect(scoreText(uiResume).uiux.score).toBeGreaterThan(0);
    expect(scoreText(uiResume).uiux.score).toBeLessThanOrEqual(100);
  });
  it("recognizes evidence for both roles and leaves unrelated profiles uncertain", () => {
    expect(candidate("BOTH-1", `${lcaResume}\n${uiResume}`).classification).toBe("Both");
    expect(candidate("NONE-1", unrelatedResume).classification).toBe("Neither / Uncertain");
  });
  it("does not classify a bare skill keyword as qualification", () => {
    expect(candidate("KEYWORD-1", "Skills: LCA, Figma, sustainability.").classification).toBe("Neither / Uncertain");
  });
  it("does not give missing evidence positive points and reports coverage separately", () => {
    const empty = scoreText("");
    expect(empty.lca.score).toBeNull();
    expect(empty.lca.coverage).toBe(0);
    const partial = scoreText("Conducted an LCA project.");
    expect(partial.lcaCriteria.find((item) => item.id === "tools")?.score).toBeNull();
    expect(partial.lca.coverage).toBeLessThan(100);
    expect(partial.lcaCriteria.find((item) => item.id === "experience")?.missing.join(" ")).toMatch(/2-3 years of independent LCA/i);
  });
  it("extracts explicit experience durations and preserves unknown as null", () => {
    expect(yearsFromText("3 years of relevant experience")).toBe(3);
    expect(yearsFromText("Work experience in design")).toBeNull();
    expect(yearsFromText("100 years of experience" )).toBeNull();
  });
  it("assigns numeric positions only to candidates with a known role score", () => {
    const scored = candidate("C-1", lcaResume);
    const noEvidence = candidate("C-2", "");
    const failed = { ...scored, id: "C-3", extractionStatus: "failed" as const };
    expect([...rankPositions([noEvidence, failed, scored], "lca")]).toEqual([["C-1", 1]]);
  });
  it("ranks by role score deterministically and breaks ties by ID", () => {
    const pool = [candidate("C-2", lcaResume), candidate("C-1", lcaResume), candidate("C-3", unrelatedResume)];
    expect(rankCandidates(pool, "lca").map((item) => item.id)).toEqual(["C-1", "C-2", "C-3"]);
  });
  it("detects duplicate candidates and inserts a newly processed record once", () => {
    const first = candidate("C-1", uiResume);
    const duplicate = candidate("C-2", uiResume);
    expect(isDuplicateCandidate([first], duplicate)).toBe(true);
    const result = insertCandidate([first], candidate("C-3", lcaResume));
    expect(result.duplicate).toBe(false);
    expect(result.candidates).toHaveLength(2);
    expect(insertCandidate(result.candidates, duplicate).candidates).toHaveLength(2);
  });
});
