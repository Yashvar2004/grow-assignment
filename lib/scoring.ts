import type { Candidate, Criterion, CriterionDefinition, Role } from "./types";

export type WeightSettings = { lca: Record<string, number>; uiux: Record<string, number> };

export const LCA_CRITERIA: CriterionDefinition[] = [
  { id: "experience", label: "Relevant LCA experience (linked JD: 2-3 years independent)", weight: 25, terms: ["life cycle assessment", "lca", "independent lca"] },
  { id: "tools", label: "GaBi / SimaPro", weight: 20, terms: ["gabi", "sima pro", "simapro"] },
  { id: "projects", label: "Relevant LCA projects", weight: 15, terms: ["life cycle assessment", "lca study", "product footprint"] },
  { id: "iso", label: "ISO 14040 / ISO 14044", weight: 15, terms: ["iso 14040", "iso 14044"] },
  { id: "methods", label: "LCI, impact assessment & modelling", weight: 15, terms: ["life cycle inventory", "lci", "impact assessment", "modelling", "modeling"] },
  { id: "education", label: "Education & sustainability", weight: 10, terms: ["sustainability", "environmental science", "environmental engineering"] },
];
export const UIUX_CRITERIA: CriterionDefinition[] = [
  { id: "principles", label: "UI/UX principles & methodology", weight: 20, terms: ["user experience", "ux design", "ui/ux", "user-centered"] },
  { id: "figma", label: "Figma & prototyping", weight: 20, terms: ["figma", "prototyping", "prototype"] },
  { id: "portfolio", label: "Portfolio & design projects", weight: 20, terms: ["portfolio", "case study", "design project"] },
  { id: "research", label: "User research & psychology", weight: 15, terms: ["user research", "usability testing", "user psychology", "user interviews"] },
  { id: "visual", label: "Visual design", weight: 15, terms: ["visual design", "wireframe", "wireframing", "visual hierarchy"] },
  { id: "collaboration", label: "Collaboration & communication", weight: 10, terms: ["collaborat", "stakeholder", "communication", "cross-functional"] },
];
export const DEFAULT_WEIGHTS: WeightSettings = {
  lca: Object.fromEntries(LCA_CRITERIA.map(({ id, weight }) => [id, weight])),
  uiux: Object.fromEntries(UIUX_CRITERIA.map(({ id, weight }) => [id, weight])),
};

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, " ");
function evidenceFor(text: string, terms: string[]): string[] {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return lines.filter((line) => terms.some((term) => normalize(line).includes(term))).slice(0, 3);
}
function criterion(text: string, def: CriterionDefinition, context?: string): Criterion {
  const matches = evidenceFor(text, def.terms);
  const substantial = matches.filter((item) => item.length > 35 || /project|study|designed|conducted|developed|analy[sz]ed|years/i.test(item));
  const strong = matches.filter((item) => /project|study|designed|conducted|developed|analy[sz]ed|modelled|modeled|tested|researched|built/i.test(item));
  const score = matches.length === 0 ? null : strong.length > 0 ? Math.min(100, 70 + strong.length * 10) : substantial.length > 0 ? 55 : 35;
  const missing = score === null ? [`No evidence found for ${def.label.toLowerCase()}`] : [];
  return { id: def.id, label: def.label, weight: def.weight, score, evidence: matches, missing };
}
function aggregate(items: Criterion[]): { score: number | null; coverage: number } {
  const known = items.filter((item) => item.score !== null);
  const coverage = Math.round(known.reduce((sum, item) => sum + item.weight, 0));
  if (!known.length) return { score: null, coverage };
  // The reported fit score is a weighted total against all criteria. Unknown criteria contribute
  // zero; coverage makes that distinction explicit instead of treating unknown as absent.
  return { score: Math.round(known.reduce((sum, item) => sum + (item.score! * item.weight) / 100, 0)), coverage };
}
export function scoreText(text: string, weights: WeightSettings = DEFAULT_WEIGHTS) {
  const lcaCriteria = LCA_CRITERIA.map((def) => criterion(text, { ...def, weight: weights.lca[def.id] ?? def.weight }));
  const uiuxCriteria = UIUX_CRITERIA.map((def) => criterion(text, { ...def, weight: weights.uiux[def.id] ?? def.weight }));
  const independentLcaLines = text.split(/\n+/).filter((line) => /\bindependent\b/i.test(line) && /\b(?:lca|life\s*cycle\s+assessment)\b/i.test(line));
  const independentLcaYears = yearsFromText(independentLcaLines.join("\n"));
  const lcaExperience = lcaCriteria.find((item) => item.id === "experience");
  if (lcaExperience && lcaExperience.score !== null && independentLcaYears === null) {
    lcaExperience.missing.push("Linked JD asks for 2-3 years of independent LCA experience; this was not verified in the resume.");
  }
  const lca = aggregate(lcaCriteria);
  const uiux = aggregate(uiuxCriteria);
  return { lcaCriteria, uiuxCriteria, lca, uiux };
}
export function rescoreCandidate(candidate: Candidate, weights: WeightSettings): Candidate {
  const scored = scoreText(candidate.normalizedText || candidate.extractedText, weights);
  return {
    ...candidate,
    lcaScore: scored.lca.score,
    uiuxScore: scored.uiux.score,
    lcaCoverage: scored.lca.coverage,
    uiuxCoverage: scored.uiux.coverage,
    lcaCriteria: scored.lcaCriteria,
    uiuxCriteria: scored.uiuxCriteria,
    classification: classify(scored.lca.score, scored.uiux.score, scored.lcaCriteria, scored.uiuxCriteria),
  };
}
export function classify(lcaScore: number | null, uiuxScore: number | null, lcaCriteria?: Criterion[], uiuxCriteria?: Criterion[]): Candidate["classification"] {
  const criterionScore = (items: Criterion[] | undefined, id: string) => items?.find((item) => item.id === id)?.score ?? null;
  // Classification requires contextual, role-related experience/project evidence and a corroborating signal.
  // A lone keyword can contribute a criterion score, but cannot establish a role match by itself.
  const lcaMain = Math.max(criterionScore(lcaCriteria, "experience") ?? 0, criterionScore(lcaCriteria, "projects") ?? 0);
  const lcaCorroboration = ["tools", "iso", "methods", "education"].some((id) => criterionScore(lcaCriteria, id) !== null);
  const uiuxMain = Math.max(criterionScore(uiuxCriteria, "principles") ?? 0, criterionScore(uiuxCriteria, "portfolio") ?? 0);
  const uiuxCorroboration = ["figma", "research", "visual", "collaboration"].some((id) => criterionScore(uiuxCriteria, id) !== null);
  const lcaMatch = lcaScore !== null && lcaMain >= 55 && lcaCorroboration;
  const uiuxMatch = uiuxScore !== null && uiuxMain >= 55 && uiuxCorroboration;
  if (lcaMatch && uiuxMatch) return "Both";
  if (lcaMatch) return "LCA";
  if (uiuxMatch) return "UI/UX";
  return "Neither / Uncertain";
}
export function rankCandidates(candidates: Candidate[], role: Role): Candidate[] {
  const field = role === "lca" ? "lcaScore" : "uiuxScore";
  return [...candidates].sort((a, b) => (b[field] ?? -1) - (a[field] ?? -1) || a.id.localeCompare(b.id));
}

export function yearsFromText(text: string): number | null {
  const values = [...text.matchAll(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)(?:\s+(?:of\s+)?(?:relevant\s+)?experience)?/gi)].map((m) => Number(m[1]));
  const valid = values.filter((value) => value >= 0 && value <= 60);
  return valid.length ? Math.max(...valid) : null;
}
