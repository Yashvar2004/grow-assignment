import { describe, expect, it } from "vitest";
import candidates from "../data/candidates.json";
import { auditEvidenceContext } from "../lib/evidence-audit";
import type { Candidate, Criterion } from "../lib/types";

function criterion(id: string, evidence: string[]): Criterion {
  return { id, label: id, weight: 20, score: 55, evidence, missing: [] };
}

describe("audit-only evidence context warnings", () => {
  it("flags business portfolios without changing scores or classifications", () => {
    const candidate = {
      uiuxCriteria: [criterion("portfolio", ["LCA analysis across real estate and logistics portfolios."]), criterion("collaboration", ["Engaged client teams."])],
      lcaCriteria: [],
    };
    expect(auditEvidenceContext(candidate).map((warning) => warning.id)).toContain("business-portfolio");
    expect(candidate.uiuxCriteria[0].score).toBe(55);
  });

  it("flags engineering case studies as context to review", () => {
    const warnings = auditEvidenceContext({
      uiuxCriteria: [criterion("portfolio", ["Bronze - IC Engine Design Case Study"])],
      lcaCriteria: [],
    });
    expect(warnings.map((warning) => warning.id)).toContain("engineering-case-study");
  });

  it("flags general impact assessment when LCA impact assessment is not stated", () => {
    const warnings = auditEvidenceContext({
      uiuxCriteria: [],
      lcaCriteria: [criterion("methods", ["Socio-economic impact assessment across 14 countries."])],
    });
    expect(warnings.map((warning) => warning.id)).toContain("general-impact-assessment");
  });

  it("does not flag explicit life-cycle impact assessment wording", () => {
    const warnings = auditEvidenceContext({
      uiuxCriteria: [],
      lcaCriteria: [criterion("methods", ["Conducted life-cycle impact assessment using ReCiPe."])],
    });
    expect(warnings.map((warning) => warning.id)).not.toContain("general-impact-assessment");
  });

  it("flags the three audited Both records for human context review without reclassifying them", () => {
    const records = candidates as Candidate[];
    const cases: [string, string][] = [
      ["C-8DFDD844", "generic-portfolio"],
      ["C-31E693A9", "engineering-case-study"],
      ["C-BF5FFD64", "business-portfolio"],
    ];
    for (const [id, warningId] of cases) {
      const record = records.find((candidate) => candidate.id === id);
      expect(record?.classification).toBe("Both");
      expect(auditEvidenceContext(record!).map((warning) => warning.id)).toContain(warningId);
    }
  });
});
