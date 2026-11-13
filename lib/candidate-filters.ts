import type { Candidate } from "./types";

export function matchesSkillQuery(candidate: Candidate, query: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return true;
  const searchableText = [
    ...candidate.skills,
    ...candidate.tools,
    candidate.normalizedText,
    candidate.extractedText,
  ].join(" ").toLocaleLowerCase();
  return searchableText.includes(normalizedQuery);
}
