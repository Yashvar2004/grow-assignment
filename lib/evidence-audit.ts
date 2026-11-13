import type { Candidate, Criterion } from "./types";

export type EvidenceAuditWarning = {
  id: "business-portfolio" | "engineering-case-study" | "general-impact-assessment" | "generic-portfolio";
  title: string;
  message: string;
  evidence: string[];
};

type EvidenceAuditInput = Pick<Candidate, "lcaCriteria" | "uiuxCriteria">;

const evidenceFor = (criteria: Criterion[], id: string) => criteria.find((criterion) => criterion.id === id)?.evidence ?? [];
const UX_CONTEXT = /\b(?:ui\s*\/\s*ux|ux|user experience|wirefram(?:e|ing)|prototyp(?:e|ing)|usability|interaction design|figma|visual design)\b/i;

export function auditEvidenceContext(candidate: EvidenceAuditInput): EvidenceAuditWarning[] {
  const warnings: EvidenceAuditWarning[] = [];
  const portfolioEvidence = evidenceFor(candidate.uiuxCriteria, "portfolio");
  const relevantUxEvidence = candidate.uiuxCriteria
    .filter((criterion) => criterion.id !== "portfolio")
    .flatMap((criterion) => criterion.evidence);

  const businessPortfolio = portfolioEvidence.filter((line) =>
    /\bportfolios?\b/i.test(line) && /\b(?:business|real estate|logistics|investment|asset|supply chain|client|property|investment|project portfolio)\b/i.test(line),
  );
  if (businessPortfolio.length) {
    warnings.push({
      id: "business-portfolio",
      title: "Portfolio may refer to business assets",
      message: "Review whether this use of 'portfolio' describes design work or a business, client, or asset portfolio.",
      evidence: businessPortfolio,
    });
  }

  const engineeringCaseStudies = portfolioEvidence.filter((line) =>
    /\bcase stud(?:y|ies)\b/i.test(line) && /\b(?:engine|combustion|mechanical|automotive|vehicle|powertrain|manufacturing)\b/i.test(line) && !UX_CONTEXT.test(line),
  );
  if (engineeringCaseStudies.length) {
    warnings.push({
      id: "engineering-case-study",
      title: "Case study may be engineering work",
      message: "Review whether this case study documents UX or UI design work rather than an engineering subject.",
      evidence: engineeringCaseStudies,
    });
  }

  const genericPortfolio = portfolioEvidence.filter((line) => /\bportfolio\b/i.test(line) && !UX_CONTEXT.test(line));
  if (genericPortfolio.length && !relevantUxEvidence.some((line) => UX_CONTEXT.test(line))) {
    warnings.push({
      id: "generic-portfolio",
      title: "Design portfolio context is unclear",
      message: "A portfolio is mentioned, but other matched evidence does not clearly establish that it contains UX or UI design work.",
      evidence: genericPortfolio,
    });
  }

  const lcaMethodsEvidence = evidenceFor(candidate.lcaCriteria, "methods");
  const generalImpactEvidence = lcaMethodsEvidence.filter((line) =>
    /\bimpact assessment\b/i.test(line) &&
    /\b(?:environmental impact assessment|socio[- ]economic|social impact|biodiversity|community|economic impact)\b/i.test(line) &&
    !/\b(?:life[- ]cycle impact assessment|lcia|lca impact assessment)\b/i.test(line),
  );
  if (generalImpactEvidence.length) {
    warnings.push({
      id: "general-impact-assessment",
      title: "Impact assessment may not be LCA impact assessment",
      message: "Review whether this is life-cycle impact assessment or a broader environmental, social, or economic impact assessment.",
      evidence: generalImpactEvidence,
    });
  }

  return warnings;
}
