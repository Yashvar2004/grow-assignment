import type { Candidate } from "./types";

export function isDuplicateCandidate(candidates: Candidate[], candidate: Candidate): boolean {
  const text = candidate.normalizedText.trim().toLowerCase();
  return candidates.some((item) => item.id === candidate.id || (text.length > 0 && item.normalizedText.trim().toLowerCase() === text));
}

export function insertCandidate(candidates: Candidate[], candidate: Candidate): { candidates: Candidate[]; duplicate: boolean } {
  if (isDuplicateCandidate(candidates, candidate)) return { candidates, duplicate: true };
  return { candidates: [...candidates, candidate], duplicate: false };
}
