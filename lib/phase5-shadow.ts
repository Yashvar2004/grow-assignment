import type { Candidate } from "./types";

export type EvidenceStatus = "demonstrated" | "partial" | "list_only" | "unknown" | "conflicting";
export type ProjectContext = "professional" | "internship" | "freelance_client" | "academic" | "research" | "coursework" | "personal" | "unknown";
export type ShadowCriterion = {
  id: string; label: string; weight: number; status: EvidenceStatus; strength: number | null;
  evidence: { excerpt: string; reference: string; source: string; context: ProjectContext }[];
  explanation: string;
};
export type ProjectRecord = {
  id: string; title: string; role: "lca" | "uiux" | "other"; context: ProjectContext;
  completion: "completed" | "not_established"; evidence: { excerpt: string; reference: string; source: string }[];
  duplicateOf: string | null;
};
export type ShadowResult = {
  candidateId: string; source: string; sourceSha256: string | null; extractionStatus: Candidate["extractionStatus"];
  filename: string;
  lca: { score: number | null; rank: number | null; coverage: number; interval: { lower: number; upper: number } | null; scored: boolean; criteria: ShadowCriterion[]; eligibility: Record<string, string> };
  uiux: { score: number | null; rank: number | null; coverage: number; interval: { lower: number; upper: number } | null; scored: boolean; criteria: ShadowCriterion[]; eligibility: Record<string, string> };
  proposedClassification: "LCA" | "UI/UX" | "Both" | "Neither / Uncertain" | "Unscored";
  projects: ProjectRecord[]; operationalQuestions: Record<string, "pending" | "provided_not_verified">;
  portfolioReview: { urls: string[]; status: "not_provided" | "provided_not_inspected" };
  humanReview: boolean; lcaHumanReviewReasons: string[]; uiuxHumanReviewReasons: string[]; humanReviewReasons: string[];
};

// Provisional Phase 5 weights; shadow-only and not validated hiring weights.
export const LCA_WEIGHTS = [25, 20, 15, 7.5, 7.5, 10, 10, 5] as const;
export const UIUX_WEIGHTS = [15, 20, 20, 15, 15, 5, 10] as const;
if (LCA_WEIGHTS.reduce((a, b) => a + b, 0) !== 100 || UIUX_WEIGHTS.reduce((a, b) => a + b, 0) !== 100) throw new Error("Phase 5 weights must total 100");

type CriterionDef = { id: string; label: string; weight: number; regex: RegExp; action?: RegExp; sections?: RegExp; list?: boolean };
const lcaDefs: CriterionDef[] = [
  { id: "independent_work", label: "Independent professional LCA execution", weight: 25, regex: /\b(independent(?:ly)?|led|owned|executed|managed)\b.{0,70}\bLCA\b|\bLCA\b.{0,70}\b(independent(?:ly)?|led|owned|executed|managed)\b/i, action: /\b(independent(?:ly)?|led|owned|executed|managed|delivered)\b/i, sections: /experience|employment|professional/i },
  { id: "completed_projects", label: "Distinct completed professional LCA projects", weight: 20, regex: /\bLCA\b|life.?cycle assessment/i, action: /\b(completed|delivered|published|finali[sz]ed|commissioned)\b/i },
  { id: "software", label: "GaBi or SimaPro applied in project work", weight: 15, regex: /\b(GaBi|SimaPro)\b/i, action: /\b(used|modelled|modeled|built|analysed|analyzed|applied|ran|executed|developed)\b/i },
  { id: "iso14040", label: "ISO 14040 applied in project work", weight: 7.5, regex: /ISO\s*14040/i, action: /\b(applied|followed|conducted|performed|compliant|according to|in accordance)\b/i },
  { id: "iso14044", label: "ISO 14044 applied in project work", weight: 7.5, regex: /ISO\s*14044/i, action: /\b(applied|followed|conducted|performed|compliant|according to|in accordance)\b/i },
  { id: "lci_quality", label: "LCI collection, validation, quality and traceability", weight: 10, regex: /\b(LCI|life cycle inventory|inventory data|traceab(?:ility|le)|audit.ready|data quality|missing data|standardiz\w+|validation)\b/i, action: /\b(collected|validated|standardiz\w+|documented|tracked|audited|quality.control|traceab\w+)\b/i },
  { id: "modelling_operations", label: "LCA modelling, assumptions and operational/logistics data", weight: 10, regex: /\b(LCA|life.?cycle assessment)\b.{0,100}\b(model\w*|assumption\w*|plant|logistics|transport|energy|materials|benchmark\w*)\b|\b(model\w*|assumption\w*|plant|logistics|transport|energy|materials|benchmark\w*)\b.{0,100}\b(LCA|life.?cycle assessment)\b/i, action: /\b(model\w*|documented|collected|assessed|analysed|analyzed|validated|benchmark\w*)\b/i },
  { id: "preferred", label: "Preferred LCA qualifications", weight: 5, regex: /\b(EPD|environmental product declaration|environmental engineering|environmental science|finance|accounting|stakeholder management|problem.solving)\b/i },
];
const uiDefs: CriterionDef[] = [
  { id: "principles_hcd", label: "UI/UX principles and human-centered design", weight: 15, regex: /\b(user.centered|human.centered|design thinking|usability|interaction design|UX principles|UI\/UX)\b/i, action: /\b(applied|designed|improved|tested|conducted|created|mapped)\b/i },
  { id: "figma_prototype", label: "Figma and high-fidelity prototyping", weight: 20, regex: /\b(Figma|prototype|prototyp\w*|high.fidelity)\b/i, action: /\b(created|built|designed|prototyp\w*|developed|delivered|interactive)\b/i },
  { id: "responsive_visual", label: "Responsive interface and visual design", weight: 20, regex: /\b(responsive|mobile interface|website interface|visual hierarchy|visual design|design system|UI design)\b/i, action: /\b(designed|built|created|improved|developed|maintained)\b/i },
  { id: "research_testing", label: "User research, psychology and usability testing", weight: 15, regex: /\b(user research|usability testing|user interview|user testing|user psychology|user behavior|user behaviour)\b/i, action: /\b(conducted|interviewed|tested|analysed|analyzed|synthesi[sz]ed|observed|documented)\b/i },
  { id: "design_work", label: "Practical UI/UX design work and case studies", weight: 15, regex: /\b(UI|UX|user interface|user experience|wireframe|design case study|job board|website redesign|mobile app design)\b/i, action: /\b(designed|created|built|redesigned|prototyp\w*|tested|iterated)\b/i },
  { id: "handoff", label: "Specifications, handoff and design systems", weight: 5, regex: /\b(handoff|design specification|design specs|component library|design system)\b/i, action: /\b(prepared|documented|handed off|maintained|created)\b/i },
  { id: "collaboration", label: "Design critique, feedback and cross-functional iteration", weight: 10, regex: /\b(design critique|design feedback|design review|cross.functional)\b/i, action: /\b(incorporated|iterated|presented|collaborated|revised|responded)\b/i },
];

const contextFor = (section: string, line: string): ProjectContext => {
  const t = `${section} ${line}`.toLowerCase();
  if (/coursework|course project|class project/.test(t)) return "coursework";
  if (/academic|university|college|semester|student project/.test(t)) return "academic";
  if (/research|thesis|dissertation|paper|publication/.test(t)) return "research";
  if (/personal project|self.initiated|personal portfolio/.test(t)) return "personal";
  if (/freelanc|client project|client work/.test(t)) return "freelance_client";
  if (/intern|trainee/.test(t)) return "internship";
  if (/experience|employment|professional/.test(section.toLowerCase())) return "professional";
  return "unknown";
};
const sectionFor = (line: string, current: string): string => {
  const s = line.trim().toLowerCase().replace(/[^a-z /]/g, "");
  if (/^(experience|work experience|employment|professional experience)$/.test(s)) return "experience";
  if (/^(projects?|projects and deliverables|selected projects)$/.test(s)) return "projects";
  if (/^(education|academic background)$/.test(s)) return "education";
  if (/^(skills|technical skills|core skills|tools|platforms|methods)$/.test(s)) return "skills";
  if (/^(certifications?|certifications and licenses|training)$/.test(s)) return "certifications";
  return current;
};
const lineRef = (candidate: Candidate, index: number) => `${candidate.source}#line=${index + 1}`;

function findCriterion(candidate: Candidate, d: CriterionDef): ShadowCriterion {
  let section = "unknown";
  const evidence: ShadowCriterion["evidence"] = [];
  const lines = candidate.extractedText.split(/\r?\n/).map((v) => v.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]; section = sectionFor(line, section);
    if (!d.regex.test(line)) continue;
    const ctx = contextFor(section, line);
    const action = d.action?.test(line) ?? false;
    const listOnly = section === "skills" || section === "certifications" || /^(skills|tools|methods|platforms|certifications?)\s*:/i.test(line);
    const unrelated = d.id === "design_work" && /engineering|engine|thermal|mechanical|civil|business/i.test(line) && !/user interface|user experience|UX|UI|wireframe|Figma|usability/i.test(line);
    if (unrelated) continue;
    if (d.id === "responsive_visual" && /portfolio/i.test(line) && !/\b(UI|UX|user interface|user experience|wireframe|Figma|visual design|design system)\b/i.test(line)) continue;
    if (d.id === "responsive_visual" && /responsive/i.test(line) && !/\b(UI|UX|user interface|user experience|interface|visual design|wireframe|Figma|screen)\b/i.test(line)) continue;
    // Portfolio/case-study vocabulary alone is deliberately insufficient.
    if (d.id === "design_work" && /portfolio|case study/i.test(line) && !/UI|UX|user interface|user experience|wireframe|Figma|usability|redesign/i.test(line)) continue;
    if (d.id === "collaboration" && !/design|UX|UI|user|usability|prototype|product/i.test(line)) continue;
    if (d.id === "modelling_operations" && /impact assessment/i.test(line) && !/life.?cycle|LCA/i.test(line)) continue;
    if (evidence.length < 20) evidence.push({ excerpt: line, reference: lineRef(candidate, i), source: candidate.source, context: ctx });
  }
  // Tool and standard application require a practical action in project/employment context.
  const applied = evidence.filter((e) => {
    const idx = Number(e.reference.match(/line=(\d+)/)?.[1] ?? 0) - 1;
    const line = lines[idx] ?? "";
    const section = sectionFor(line, "unknown");
    return (d.action?.test(line) ?? false) && !["skills", "certifications"].includes(section) && e.context !== "coursework";
  });
  let status: EvidenceStatus = "unknown", strength: number | null = null;
  if (evidence.length) {
    if (applied.length) { status = "demonstrated"; strength = 1; }
    else if (evidence.some((e) => e.context === "professional" || e.context === "internship" || e.context === "freelance_client" || e.context === "academic" || e.context === "research" || e.context === "personal")) { status = "partial"; strength = 0.6; }
    else { status = "list_only"; strength = 0.25; }
  }
  if (d.id === "independent_work" && !evidence.some((e) => /independent(?:ly)?/.test(e.excerpt.toLowerCase()))) {
    if (evidence.length) { status = "partial"; strength = 0.3; }
  }
  return { id: d.id, label: d.label, weight: d.weight, status, strength, evidence, explanation: status === "demonstrated" ? "Resume excerpt contains a role-relevant action in a project or work context; human verification is still required." : status === "partial" ? "Relevant mention exists, but the resume does not establish the full practical requirement." : status === "list_only" ? "Mention appears only as a listed skill, tool, or credential; application is not established." : "No contextual resume evidence was found; this is unknown, not confirmed absence." };
}

function projectRecords(candidate: Candidate): ProjectRecord[] {
  const lines = candidate.extractedText.split(/\r?\n/).map((v) => v.trim()).filter(Boolean);
  let section = "unknown", experienceContext: ProjectContext = "unknown", projectSectionContext: ProjectContext = "unknown"; const records: ProjectRecord[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], priorSection = section; section = sectionFor(line, section);
    if (section === "projects" && priorSection !== "projects") projectSectionContext = contextFor(line, line);
    if (section === "projects" && /\b(academic|coursework|research|personal|freelance|client)\b/i.test(line)) projectSectionContext = contextFor(line, line);
    if (section === "experience" && !/^[•\-*]/.test(line) && line.length < 180) {
      if (/\bintern(ship)?\b|\btrainee\b/i.test(line)) experienceContext = "internship";
      else if (/\bfreelanc|\bclient\b/i.test(line)) experienceContext = "freelance_client";
      else if (/\bresearch\b|\bdoctoral\b/i.test(line)) experienceContext = "research";
      else if (/\bprofessional|\bengineer|\banalyst|\bconsultant|\bdesigner|\bmanager|\bassociate|\bexecutive|\bspecialist/i.test(line)) experienceContext = "professional";
      else experienceContext = "unknown";
    }
    const lca = /\b(LCA|life.?cycle assessment|LCI|SimaPro|GaBi)\b/i.test(line);
    const ux = /\b(UI\/UX|user interface|user experience|wireframe|Figma|usability testing|UX design|UI design)\b/i.test(line);
    if (!lca && !ux) continue;
    const ctx = section === "experience" ? experienceContext : section === "projects" ? (contextFor(section, line) === "unknown" ? projectSectionContext : contextFor(section, line)) : contextFor(section, line);
    if (section === "skills" || section === "certifications") continue;
    const previous = i > 0 ? lines[i - 1] : "";
    const title = (previous && previous.length < 130 ? previous : line).replace(/^[•\-*\s]+/, "").slice(0, 180);
    const key = title.toLowerCase().replace(/[^a-z0-9]/g, "");
    const duplicate = records.find((p) => p.title.toLowerCase().replace(/[^a-z0-9]/g, "") === key);
    records.push({ id: `P-${candidate.id}-${records.length + 1}`, title, role: lca && ux ? "other" : lca ? "lca" : "uiux", context: ctx, completion: /\b(completed|delivered|published|finali[sz]ed|released)\b/i.test(line) ? "completed" : "not_established", evidence: [{ excerpt: line, reference: lineRef(candidate, i), source: candidate.source }], duplicateOf: duplicate?.id ?? null });
  }
  return records;
}

function score(criteria: ShadowCriterion[], extractionStatus: Candidate["extractionStatus"]) {
  const knownWeight = criteria.reduce((a, c) => a + (c.strength === null ? 0 : c.weight), 0);
  const numerator = criteria.reduce((a, c) => a + c.weight * (c.strength ?? 0), 0);
  if (!knownWeight || extractionStatus === "failed") return { score: null, rank: null, coverage: 0, interval: null, scored: false };
  const lower = Math.round(numerator * 100) / 100;
  const coverage = Math.round(knownWeight * 100) / 100;
  return { score: Math.round((numerator / knownWeight) * 100), rank: null, coverage, interval: { lower: Math.round(lower * 100) / 100, upper: Math.round((lower + 100 - knownWeight) * 100) / 100 }, scored: true };
}
const explicitUiuxYears = (text: string): number | null => {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!/\b(UI\/UX|UX|UI|user experience|user interface|product designer)\b/i.test(line)) continue;
    const match = line.match(/\b(\d+(?:\.\d+)?)\s*(?:\+\s*)?(?:years?|yrs?)\b/i);
    if (match) return Number(match[1]);
  }
  return null;
};
const contextualWarnings = (text: string): string[] => {
  const lines = text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const warnings = new Set<string>();
  if (lines.some((l) => /\bportfolio\b/i.test(l) && !/\b(UX|UI|user interface|user experience|wireframe|Figma|usability|visual design)\b/i.test(l))) warnings.add("Portfolio mention may be non-design or business portfolio evidence.");
  if (lines.some((l) => /\bcase stud(?:y|ies)\b/i.test(l) && /engineering|\bengine\b|mechanical|civil|thermal/i.test(l) && !/UX|UI|user experience|user interface|wireframe|Figma/i.test(l))) warnings.add("Engineering case study is not established as a UX case study.");
  if (lines.some((l) => /impact assessment/i.test(l) && !/life.?cycle impact assessment|\bLCA\b/i.test(l))) warnings.add("General impact assessment is not established as LCA impact assessment.");
  return [...warnings];
};

export function evaluatePhase5(candidate: Candidate): ShadowResult {
  if (candidate.extractionStatus === "failed") return {
    candidateId: candidate.id, filename: candidate.filename, source: candidate.source, sourceSha256: candidate.sourceSha256 ?? null, extractionStatus: "failed",
    lca: { ...score([], "failed"), criteria: [], eligibility: { independentExperience: "needs_verification", completedProfessionalProjects: "needs_verification", tool: "needs_verification", iso14040: "needs_verification", iso14044: "needs_verification" } },
    uiux: { ...score([], "failed"), criteria: [], eligibility: { experienceRange: "needs_verification" } }, proposedClassification: "Unscored", projects: [],
    operationalQuestions: { chennaiRelocation: "pending", onsiteFullTime: "pending", indiaTravel: "pending", oneYearCommitment: "pending", englishProficiency: "pending", portfolioUrl: "pending", figmaPrototypeUrl: "pending", designWorkSamples: "pending", availability: "pending" },
    portfolioReview: { urls: candidate.portfolioLinks, status: candidate.portfolioLinks.length ? "provided_not_inspected" : "not_provided" }, humanReview: true, lcaHumanReviewReasons: ["Resume extraction failed; record retained and left unscored."], uiuxHumanReviewReasons: ["Resume extraction failed; record retained and left unscored."], humanReviewReasons: ["Resume extraction failed; record retained and left unscored."],
  };
  const lcaCriteria = lcaDefs.map((d) => findCriterion(candidate, d));
  const uiuxCriteria = uiDefs.map((d) => findCriterion(candidate, d));
  const lcaScore = score(lcaCriteria, candidate.extractionStatus), uiuxScore = score(uiuxCriteria, candidate.extractionStatus);
  const projects = projectRecords(candidate);
  const completedProfessionalProjects = projects.filter((p) => p.role === "lca" && p.context === "professional" && p.completion === "completed" && !p.duplicateOf).length;
  const tool = lcaCriteria.find((c) => c.id === "software");
  const iso40 = lcaCriteria.find((c) => c.id === "iso14040"), iso44 = lcaCriteria.find((c) => c.id === "iso14044");
  const independentMatch = candidate.extractedText.match(/\b(?:independently|independent)\b.{0,80}\bLCA\b.{0,30}\b(\d+(?:\.\d+)?)\s*(?:years|yrs)/i) ?? candidate.extractedText.match(/\b(\d+(?:\.\d+)?)\s*(?:years|yrs)\b.{0,80}\b(?:independently|independent)\b.{0,30}\bLCA\b/i);
  const independentYears = independentMatch ? Number(independentMatch[1]) : null;
  const experienceEligibility = independentYears === null ? "needs_verification" : independentYears > 3 ? "potentially_qualifying_review" : independentYears >= 2 ? "meets" : "not_established";
  const lcaEligibility = {
    independentExperience: experienceEligibility,
    completedProfessionalProjects: completedProfessionalProjects >= 3 ? "meets" : completedProfessionalProjects > 0 ? "not_established" : "needs_verification",
    tool: tool?.status === "demonstrated" ? "meets" : "needs_verification",
    iso14040: iso40?.status === "demonstrated" ? "meets" : "needs_verification",
    iso14044: iso44?.status === "demonstrated" ? "meets" : "needs_verification",
  };
  const reasons: string[] = [];
  if (lcaEligibility.independentExperience !== "meets") reasons.push("Independent LCA duration is not established as 2–3 years (more than 3 years requires review)." );
  if (lcaEligibility.completedProfessionalProjects !== "meets") reasons.push("Three completed distinct professional LCA projects are not established.");
  if ([lcaEligibility.tool, lcaEligibility.iso14040, lcaEligibility.iso14044].includes("needs_verification")) reasons.push("LCA tool or ISO application needs project-level human verification.");
  const warnings = contextualWarnings(candidate.extractedText);
  const explicitUiDesign = uiuxCriteria.some((c) => c.status === "demonstrated" && ["design_work", "figma_prototype", "research_testing", "responsive_visual"].includes(c.id));
  const explicitLca = lcaCriteria.some((c) => c.status === "demonstrated" && ["independent_work", "completed_projects", "software", "lci_quality", "modelling_operations"].includes(c.id));
  const proposedClassification = explicitLca && explicitUiDesign ? "Both" : explicitLca ? "LCA" : explicitUiDesign ? "UI/UX" : "Neither / Uncertain";
  if (warnings.length) reasons.push(...warnings);
  const classificationReview = proposedClassification === "Both" || (candidate.classification !== proposedClassification && (explicitLca || explicitUiDesign));
  if (classificationReview) reasons.push("Proposed classification differs from legacy result or has evidence for both roles; review the cited context.");
  if (candidate.extractionStatus === "partial") reasons.push("Partial extraction may omit evidence; review source document.");
  const uiuxYears = explicitUiuxYears(candidate.extractedText);
  const yearsOutside = uiuxYears !== null && uiuxYears > 1;
  const uiEligibility = { experienceRange: yearsOutside ? "outside_stated_range_human_review_only" : "no_penalty_fresher_or_transition_candidate", operationalConditions: "pending_questionnaire" };
  if (yearsOutside) reasons.push("Explicitly reported UI/UX experience exceeds the 0–1 year target; flag for review without score penalty.");
  const lcaReviewReasons = [...new Set([...reasons.filter((r) => r.startsWith("Independent LCA") || r.startsWith("Three completed") || r.startsWith("LCA tool") || r.includes("General impact assessment")), ...(candidate.extractionStatus === "partial" ? ["Partial extraction may omit LCA evidence; review source document."] : [])])];
  const uiuxReviewReasons = [...new Set([...warnings.filter((r) => r.includes("Portfolio") || r.includes("Engineering case")), ...(yearsOutside ? ["Explicitly reported UI/UX experience exceeds the 0–1 year target; human review only, without score penalty."] : []), ...(classificationReview ? ["Proposed classification differs from legacy result or has evidence for both roles; review the cited context."] : []), ...(candidate.extractionStatus === "partial" ? ["Partial extraction may omit UI/UX evidence; review source document."] : [])])];
  return {
    candidateId: candidate.id, filename: candidate.filename, source: candidate.source, sourceSha256: candidate.sourceSha256 ?? null, extractionStatus: candidate.extractionStatus,
    lca: { ...lcaScore, criteria: lcaCriteria, eligibility: lcaEligibility },
    uiux: { ...uiuxScore, criteria: uiuxCriteria, eligibility: uiEligibility }, proposedClassification,
    projects,
    operationalQuestions: { chennaiRelocation: "pending", onsiteFullTime: "pending", indiaTravel: "pending", oneYearCommitment: "pending", englishProficiency: "pending", portfolioUrl: "pending", figmaPrototypeUrl: "pending", designWorkSamples: "pending", availability: "pending" },
    portfolioReview: { urls: candidate.portfolioLinks, status: candidate.portfolioLinks.length ? "provided_not_inspected" : "not_provided" },
    humanReview: lcaReviewReasons.length > 0 || uiuxReviewReasons.length > 0, lcaHumanReviewReasons: lcaReviewReasons, uiuxHumanReviewReasons: uiuxReviewReasons, humanReviewReasons: [...new Set([...lcaReviewReasons, ...uiuxReviewReasons, ...warnings])],
  };
}

export function rankShadow(results: ShadowResult[], role: "lca" | "uiux"): void {
  const ranked = results.filter((r) => r[role].score !== null).sort((a, b) => (b[role].score! - a[role].score!) || a.candidateId.localeCompare(b.candidateId));
  ranked.forEach((r, i) => { r[role].rank = i + 1; });
  results.filter((r) => r[role].score === null).forEach((r) => { r[role].rank = null; });
}
