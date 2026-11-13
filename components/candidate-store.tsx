"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import seed from "@/data/candidates.json";
import type { Candidate } from "@/lib/types";
import { insertCandidate } from "@/lib/pool";
import { DEFAULT_WEIGHTS, rescoreCandidate, type WeightSettings } from "@/lib/scoring";

type Store = { candidates: Candidate[]; addCandidate: (candidate: Candidate) => { duplicate: boolean }; hydrated: boolean; weights: WeightSettings; updateWeights: (weights: WeightSettings) => boolean };
const Context = createContext<Store | null>(null);
const key = "talentrank.session.v1";
const weightKey = "talentrank.weights.v1";
const validWeights = (weights: WeightSettings) => Object.values(weights.lca).reduce((sum, value) => sum + value, 0) === 100 && Object.values(weights.uiux).reduce((sum, value) => sum + value, 0) === 100 && [...Object.values(weights.lca), ...Object.values(weights.uiux)].every((value) => Number.isInteger(value) && value >= 0 && value <= 100);

export function CandidateProvider({ children }: { children: React.ReactNode }) {
  const [candidates, setCandidates] = useState<Candidate[]>(seed as Candidate[]);
  const [weights, setWeights] = useState<WeightSettings>(DEFAULT_WEIGHTS);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let activeWeights = DEFAULT_WEIGHTS;
    try {
      const savedWeights = sessionStorage.getItem(weightKey);
      if (savedWeights) {
        const parsed = JSON.parse(savedWeights) as WeightSettings;
        if (validWeights(parsed)) activeWeights = parsed;
      }
      setWeights(activeWeights);
      const saved = sessionStorage.getItem(key);
      if (saved) {
        const uploads = JSON.parse(saved) as Candidate[];
        const known = new Set((seed as Candidate[]).map((item) => item.id));
        setCandidates([...(seed as Candidate[]), ...uploads.filter((item) => !known.has(item.id))].map((item) => rescoreCandidate(item, activeWeights)));
      } else {
        setCandidates((seed as Candidate[]).map((item) => rescoreCandidate(item, activeWeights)));
      }
    } catch { try { sessionStorage.removeItem(key); } catch { /* Session storage can be unavailable in restricted browser contexts. */ } }
    setHydrated(true);
  }, []);
  const updateWeights = (nextWeights: WeightSettings) => {
    if (!validWeights(nextWeights)) return false;
    setWeights(nextWeights);
    setCandidates((current) => current.map((candidate) => rescoreCandidate(candidate, nextWeights)));
    try { sessionStorage.setItem(weightKey, JSON.stringify(nextWeights)); } catch { /* Current session still uses the new weights in memory. */ }
    return true;
  };
  const addCandidate = (candidate: Candidate) => {
    const result = insertCandidate(candidates, rescoreCandidate(candidate, weights));
    if (!result.duplicate) {
      setCandidates(result.candidates);
      try { sessionStorage.setItem(key, JSON.stringify(result.candidates.filter((item) => item.source.startsWith("upload:")))); } catch { /* Session still works in memory if browser quota is reached. */ }
    }
    return { duplicate: result.duplicate };
  };
  const value = useMemo(() => ({ candidates, addCandidate, hydrated, weights, updateWeights }), [candidates, hydrated, weights]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useCandidates() {
  const value = useContext(Context);
  if (!value) throw new Error("useCandidates must be used inside CandidateProvider");
  return value;
}
