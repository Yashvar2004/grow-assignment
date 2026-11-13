import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Candidate } from "../lib/types";
import { evaluatePhase5, rankShadow, type ShadowResult } from "../lib/phase5-shadow";

type BaselineRecord = {
  id: string; source: string; sourceSha256: string | null;
  lcaScore: number | null; uiuxScore: number | null; lcaCoverage: number; uiuxCoverage: number;
  classification: Candidate["classification"]; lcaRank: number | null; uiuxRank: number | null;
  extractionStatus: Candidate["extractionStatus"];
};
type Baseline = { recordCount: number; records: BaselineRecord[] };
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async <T>(path: string): Promise<T> => JSON.parse(await readFile(resolve(root, path), "utf8")) as T;
const round = (n: number | null) => n === null ? null : Math.round(n * 100) / 100;

function compare(candidate: Candidate, shadow: ShadowResult, old: BaselineRecord) {
  const criteria = [...shadow.lca.criteria, ...shadow.uiux.criteria];
  const gained = criteria.filter((c) => c.status === "demonstrated").map((c) => `${c.id}: demonstrated`);
  const uncertain = criteria.filter((c) => c.status === "partial" || c.status === "list_only" || c.status === "unknown").map((c) => `${c.id}: ${c.status}`);
  const reasons = [
    `LCA: Phase 4 ${old.lcaScore ?? "unscored"} (rank ${old.lcaRank ?? "unranked"}, coverage ${old.lcaCoverage}%) → Phase 5 ${shadow.lca.score ?? "unscored"} (rank ${shadow.lca.rank ?? "unranked"}, coverage ${shadow.lca.coverage}%, interval ${shadow.lca.interval ? `${shadow.lca.interval.lower}–${shadow.lca.interval.upper}` : "unavailable"}).`,
    `UI/UX: Phase 4 ${old.uiuxScore ?? "unscored"} (rank ${old.uiuxRank ?? "unranked"}, coverage ${old.uiuxCoverage}%) → Phase 5 ${shadow.uiux.score ?? "unscored"} (rank ${shadow.uiux.rank ?? "unranked"}, coverage ${shadow.uiux.coverage}%, interval ${shadow.uiux.interval ? `${shadow.uiux.interval.lower}–${shadow.uiux.interval.upper}` : "unavailable"}).`,
    `Classification: ${old.classification} → proposed ${shadow.proposedClassification}.`,
    ...shadow.humanReviewReasons,
  ];
  return {
    candidateId: candidate.id, source: candidate.source, sourceSha256: candidate.sourceSha256 ?? null,
    phase4: { lcaScore: old.lcaScore, uiuxScore: old.uiuxScore, lcaCoverage: old.lcaCoverage, uiuxCoverage: old.uiuxCoverage, lcaRank: old.lcaRank, uiuxRank: old.uiuxRank, classification: old.classification, extractionStatus: old.extractionStatus },
    phase5: { lcaScore: shadow.lca.score, uiuxScore: shadow.uiux.score, lcaCoverage: shadow.lca.coverage, uiuxCoverage: shadow.uiux.coverage, lcaInterval: shadow.lca.interval, uiuxInterval: shadow.uiux.interval, lcaRank: shadow.lca.rank, uiuxRank: shadow.uiux.rank, proposedClassification: shadow.proposedClassification, eligibility: { lca: shadow.lca.eligibility, uiux: shadow.uiux.eligibility } },
    evidenceGained: gained, evidencePartialOrUnknown: uncertain,
    criterionChanges: { lca: shadow.lca.criteria.map((c) => ({ id: c.id, label: c.label, status: c.status, strength: c.strength, weightedPoints: round(c.strength === null ? null : c.weight * c.strength), explanation: c.explanation, evidence: c.evidence })), uiux: shadow.uiux.criteria.map((c) => ({ id: c.id, label: c.label, status: c.status, strength: c.strength, weightedPoints: round(c.strength === null ? null : c.weight * c.strength), explanation: c.explanation, evidence: c.evidence })) },
    reasonsForDifferences: reasons,
  };
}

async function main() {
  const candidates = await readJson<Candidate[]>("data/candidates.json");
  const baseline = await readJson<Baseline>("data/phase4-baseline.json");
  if (candidates.length !== 47 || baseline.recordCount !== 47 || baseline.records.length !== 47) throw new Error("Expected exactly 47 candidates and 47 Phase 4 baseline records.");
  const oldById = new Map(baseline.records.map((r) => [r.id, r]));
  if (oldById.size !== 47) throw new Error("Phase 4 baseline has duplicate or missing candidate IDs.");
  for (const c of candidates) {
    const old = oldById.get(c.id);
    if (!old) throw new Error(`Candidate ${c.id} missing from Phase 4 baseline.`);
    if (old.sourceSha256 !== c.sourceSha256) throw new Error(`Candidate hash differs from baseline: ${c.id}`);
    const bytes = await readFile(resolve(root, old.source));
    if (createHash("sha256").update(bytes).digest("hex") !== old.sourceSha256) throw new Error(`Source file hash differs from baseline: ${c.id}`);
  }
  const results = candidates.map(evaluatePhase5);
  rankShadow(results, "lca"); rankShadow(results, "uiux");
  const comparisons = candidates.map((c) => compare(c, results.find((r) => r.candidateId === c.id)!, oldById.get(c.id)!));
  const summary = {
    candidateCount: results.length,
    extraction: { success: results.filter((r) => r.extractionStatus === "success").length, partial: results.filter((r) => r.extractionStatus === "partial").length, failed: results.filter((r) => r.extractionStatus === "failed").length },
    lca: { scored: results.filter((r) => r.lca.scored).length, unscored: results.filter((r) => !r.lca.scored).length, humanReview: results.filter((r) => r.lca.eligibility.independentExperience !== "meets" || r.lca.eligibility.completedProfessionalProjects !== "meets").length, top10: results.filter((r) => r.lca.score !== null).sort((a, b) => b.lca.score! - a.lca.score! || a.candidateId.localeCompare(b.candidateId)).slice(0, 10).map((r) => ({ candidateId: r.candidateId, score: r.lca.score, rank: r.lca.rank, coverage: r.lca.coverage, interval: r.lca.interval })) },
    uiux: { scored: results.filter((r) => r.uiux.scored).length, unscored: results.filter((r) => !r.uiux.scored).length, humanReview: results.filter((r) => r.uiuxHumanReviewReasons.length > 0).length, top10: results.filter((r) => r.uiux.score !== null).sort((a, b) => b.uiux.score! - a.uiux.score! || a.candidateId.localeCompare(b.candidateId)).slice(0, 10).map((r) => ({ candidateId: r.candidateId, score: r.uiux.score, rank: r.uiux.rank, coverage: r.uiux.coverage, interval: r.uiux.interval })) },
    proposedClassifications: Object.fromEntries(["LCA", "UI/UX", "Both", "Neither / Uncertain", "Unscored"].map((x) => [x, results.filter((r) => r.proposedClassification === x).length])),
    mandatoryLca: Object.fromEntries(["independentExperience", "completedProfessionalProjects", "tool", "iso14040", "iso14044"].map((requirement) => [requirement, Object.fromEntries(["meets", "not_established", "needs_verification", "potentially_qualifying_review"].map((status) => [status, results.filter((r) => r.lca.eligibility[requirement] === status).length]))])),
    warnings: { portfolio: results.filter((r) => r.humanReviewReasons.some((x) => x.includes("Portfolio mention"))).map((r) => r.candidateId), engineeringCaseStudy: results.filter((r) => r.humanReviewReasons.some((x) => x.includes("Engineering case study"))).map((r) => r.candidateId), generalImpactAssessment: results.filter((r) => r.humanReviewReasons.some((x) => x.includes("General impact assessment"))).map((r) => r.candidateId) },
  };
  await writeFile(resolve(root, "data/phase5-shadow-candidates.json"), JSON.stringify({ model: "phase5-shadow-v1", mode: "shadow_only", note: "Provisional experimental rubric; not validated hiring weights. Legacy Phase 4 results remain authoritative.", weights: { lca: [25, 20, 15, 7.5, 7.5, 10, 10, 5], uiux: [15, 20, 20, 15, 15, 5, 10] }, summary, results }, null, 2) + "\n");
  await writeFile(resolve(root, "data/phase5-shadow-comparison.json"), JSON.stringify({ model: "phase5-shadow-v1", comparedTo: "data/phase4-baseline.json", candidateCount: comparisons.length, comparisons }, null, 2) + "\n");
  console.log(JSON.stringify(summary, null, 2));
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
