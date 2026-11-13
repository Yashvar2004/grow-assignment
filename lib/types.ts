export type Role = "lca" | "uiux";
export type Criterion = {
  id: string;
  label: string;
  weight: number;
  score: number | null;
  evidence: string[];
  missing: string[];
};
export type EvidenceField = { value: string; excerpt: string; verified: boolean };
export type Candidate = {
  id: string;
  filename: string;
  source: string;
  sourceSha256?: string | null;
  createdAt: string;
  extractedText: string;
  normalizedText: string;
  education: EvidenceField[];
  experience: EvidenceField[];
  projects: EvidenceField[];
  certifications: EvidenceField[];
  skills: string[];
  tools: string[];
  portfolioLinks: string[];
  classification: "LCA" | "UI/UX" | "Both" | "Neither / Uncertain";
  lcaScore: number | null;
  uiuxScore: number | null;
  lcaCoverage: number;
  uiuxCoverage: number;
  lcaCriteria: Criterion[];
  uiuxCriteria: Criterion[];
  extractionStatus: "success" | "partial" | "failed";
  extractionConfidence: number;
  reviewFlags: string[];
  yearsExperience: number | null;
};

export type CriterionDefinition = { id: string; label: string; weight: number; terms: string[] };
