"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpDown, BriefcaseBusiness, ChevronDown, ChevronRight, CircleAlert, FileSearch, Files, FlaskConical, Search, ShieldAlert, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { matchesSkillQuery } from "@/lib/candidate-filters";
import { auditEvidenceContext } from "@/lib/evidence-audit";
import { getExtractionQuality } from "@/lib/extraction-quality";
import { rankCandidates, rankPositions } from "@/lib/scoring";
import type { Candidate, Role } from "@/lib/types";
import { useCandidates } from "./candidate-store";

type ViewRole = Role | "all";
function Score({ value, coverage, failed }: { value: number | null; coverage: number; failed: boolean }) {
  if (value === null) return <div className="score-cell"><span className="score-unknown">-</span><small>{failed ? "Extraction failed - unscored" : "Unscored - no criterion evidence"}</small><small>{coverage}% evidence coverage</small></div>;
  return <div className="score-cell"><span className={`score-number ${value >= 65 ? "score-good" : value >= 40 ? "score-mid" : "score-low"}`}>{value}</span><small>{coverage}% evidence</small></div>;
}
function Badge({ value }: { value: Candidate["classification"] }) {
  const className = value === "LCA" ? "badge-lca" : value === "UI/UX" ? "badge-uiux" : value === "Both" ? "badge-both" : "badge-uncertain";
  return <span className={`classification-badge ${className}`}><i />{value}</span>;
}
function Status({ candidate }: { candidate: Candidate }) {
  if (candidate.extractionStatus === "failed") return <span className="table-status status-error"><CircleAlert size={12} /> Failed</span>;
  if (candidate.reviewFlags.length) return <span className="table-status status-review"><ShieldAlert size={12} /> Review</span>;
  return <span className="table-status status-ready"><i /> Ready</span>;
}
function CandidateDetail({ candidate, role, close }: { candidate: Candidate; role: ViewRole; close: () => void }) {
  const showLca = role !== "uiux";
  const showUiux = role !== "lca";
  const groups = [
    ...(showLca ? [{ name: "Life Cycle Assessment score", score: candidate.lcaScore, coverage: candidate.lcaCoverage, criteria: candidate.lcaCriteria, color: "green" }] : []),
    ...(showUiux ? [{ name: "UI/UX Design score", score: candidate.uiuxScore, coverage: candidate.uiuxCoverage, criteria: candidate.uiuxCriteria, color: "blue" }] : []),
  ];
  const quality = getExtractionQuality(candidate);
  const auditWarnings = auditEvidenceContext(candidate);
  const unscoredRoles = groups.filter((group) => group.score === null).map((group) => group.name);
  return <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><aside className="candidate-drawer" role="dialog" aria-modal="true" aria-label={`Candidate ${candidate.id} details`}><div className="drawer-head"><div><div className="eyebrow">CANDIDATE PROFILE</div><h2>{candidate.id}</h2><p className="drawer-file">{candidate.filename}</p></div><button className="icon-button" onClick={close} aria-label="Close details"><X size={18} /></button></div><div className="drawer-scroll"><div className="detail-flags"><Badge value={candidate.classification} /><Status candidate={candidate} /><span className="confidence-label">Text-volume signal <b>{candidate.extractionConfidence}/100</b><small>Not an extraction or qualification probability</small></span></div>
    {candidate.reviewFlags.length > 0 && <div className="review-note"><ShieldAlert size={15} /><div><strong>Human review recommended</strong><ul>{candidate.reviewFlags.map((flag) => <li key={flag}>{flag}</li>)}</ul></div></div>}
    <section className="source-reference" aria-label="Source resume reference"><strong>Original source</strong><span>{candidate.filename}</span><small>Relative reference: <code>{candidate.source}</code></small><small>SHA-256: <code>{candidate.sourceSha256 ?? "Not available"}</code></small></section>
    <section className="quality-summary" aria-label="Extraction quality"><div><strong>Extraction quality checks</strong><small>{quality.textLength.toLocaleString()} extracted characters; {quality.capturedSections} of {quality.totalSections} structured sections captured</small></div><small>The displayed text-volume signal is a legacy length-based indicator. It does not verify extraction correctness, qualification, or fit.</small><div className="quality-section-counts">{quality.sectionCounts.map((section) => <span key={section.label}>{section.label}: {section.count}</span>)}</div>{quality.notes.length > 0 && <ul>{quality.notes.map((note) => <li key={note}>{note}</li>)}</ul>}</section>
    {candidate.lcaScore === null && candidate.uiuxScore === null && <div className="unscored-note"><CircleAlert size={15} /><span>{candidate.extractionStatus === "failed" ? "Unscored: extraction failed. This record remains in the dataset and has no numeric rank." : "Unscored: no role criterion evidence was found. Missing evidence is unknown, not a confirmed absence."}</span></div>}
    {unscoredRoles.length > 0 && (candidate.lcaScore !== null || candidate.uiuxScore !== null) && <div className="unscored-note"><CircleAlert size={15} /><span>No numeric score or rank for {unscoredRoles.join(" and ")}; no criterion evidence was found.</span></div>}
    {auditWarnings.length > 0 && <section className="audit-warning-list" aria-label="Audit-only evidence warnings"><strong>Context review warnings</strong><small>These warnings do not change scores or classification.</small>{auditWarnings.map((warning) => <article key={warning.id}><b>{warning.title}</b><p>{warning.message}</p>{warning.evidence.map((line, index) => <blockquote key={index}>{line}</blockquote>)}</article>)}</section>}
    <div className="detail-summary"><div><small>Experience mentioned</small><strong>{candidate.yearsExperience === null ? "Not verified" : `${candidate.yearsExperience} years`}</strong></div><div><small>Role classification</small><strong>{candidate.classification}</strong></div></div>
    {groups.map((group) => <section className="criterion-group" key={group.name}><div className="criterion-group-head"><div><h3>{group.name}</h3><small>{group.coverage}% criteria supported by evidence</small></div><span className={`detail-score ${group.color}`}>{group.score ?? "—"}<small>/100</small></span></div>{group.criteria.map((item) => <div className="criterion-row" key={item.id}><div className="criterion-label"><strong>{item.label}</strong><span>{item.weight}% weight</span><b>{item.score === null ? "Unknown" : `${item.score}/100`}</b></div>{item.score !== null && item.missing.length > 0 && <p className="unknown-evidence">{item.missing.join(" / ")}</p>}{item.evidence.length ? <ul className="evidence-list">{item.evidence.map((line, index) => <li key={index}><span className="evidence-quote">“{line}”</span><small>Resume evidence</small></li>)}</ul> : <p className="unknown-evidence">{item.missing[0]} · This is unverified, not a confirmed absence.</p>}</div>)}</section>)}
    <section className="criterion-group"><h3>Extracted information</h3><div className="extracted-grid">{[["Education", candidate.education], ["Experience", candidate.experience], ["Projects", candidate.projects], ["Certifications", candidate.certifications]].map(([name, values]) => <div key={String(name)} className="extract-section"><strong>{String(name)}</strong>{(values as Candidate["education"]).length ? <ul>{(values as Candidate["education"]).slice(0, 4).map((item, index) => <li key={index}>{item.value}</li>)}</ul> : <p>Not found in extracted text</p>}</div>)}</div>{candidate.portfolioLinks.length > 0 && <div className="portfolio-links"><strong>Portfolio links</strong>{candidate.portfolioLinks.map((url) => <a href={url} key={url} target="_blank" rel="noreferrer">{url}</a>)}</div>}</section>
    <details className="raw-extract"><summary>View redacted extracted text</summary><pre>{candidate.extractedText || "No text was extracted."}</pre></details></div><div className="drawer-foot"><span>Source file · {candidate.filename}</span><span>Processed {new Date(candidate.createdAt).toLocaleDateString()}</span></div></aside></div>;
}

export function CandidateTable({ role, compact = false }: { role: ViewRole; compact?: boolean }) {
  const { candidates } = useCandidates();
  const [query, setQuery] = useState("");
  const [skill, setSkill] = useState("");
  const [classification, setClassification] = useState("all");
  const [sort, setSort] = useState("score");
  const [selected, setSelected] = useState<Candidate | null>(null);
  const roleRanks = useMemo(() => {
    if (role === "all") return new Map<string, number>();
    return rankPositions(candidates, role);
  }, [candidates, role]);
  const roleLabel = role === "lca" ? "LCA Specialist" : role === "uiux" ? "UI/UX Design Intern" : "All resumes";
  const scoredForRole = role === "lca" ? candidates.filter((candidate) => candidate.extractionStatus !== "failed" && candidate.lcaScore !== null).length : role === "uiux" ? candidates.filter((candidate) => candidate.extractionStatus !== "failed" && candidate.uiuxScore !== null).length : 0;
  const unscoredForRole = role === "all" ? 0 : candidates.length - scoredForRole;
  const records = useMemo(() => {
    let result = role === "all" ? [...candidates].sort((a, b) => a.id.localeCompare(b.id)) : rankCandidates(candidates, role);
    if (query.trim()) result = result.filter((item) => item.id.toLowerCase().includes(query.trim().toLowerCase()) || item.filename.toLowerCase().includes(query.trim().toLowerCase()));
    if (skill.trim()) result = result.filter((item) => matchesSkillQuery(item, skill));
    if (classification !== "all") result = result.filter((item) => item.classification === classification);
    if (sort === "experience") result = [...result].sort((a, b) => (b.yearsExperience ?? -1) - (a.yearsExperience ?? -1) || a.id.localeCompare(b.id));
    if (sort === "score" && role === "all") result = [...result].sort((a, b) => Math.max(b.lcaScore ?? -1, b.uiuxScore ?? -1) - Math.max(a.lcaScore ?? -1, a.uiuxScore ?? -1) || a.id.localeCompare(b.id));
    return result;
  }, [candidates, classification, query, role, skill, sort]);
  const title = compact ? "Highest-scoring in your resume pool" : `${roleLabel} candidates`;
  const RoleIcon = role === "lca" ? FlaskConical : role === "uiux" ? BriefcaseBusiness : FileSearch;
  return <section className={`card candidate-list-card ${compact ? "compact-table" : "full-table"}`}><div className="section-heading table-heading"><div><div className="eyebrow"><RoleIcon size={12} /> CANDIDATE PIPELINE</div><h2>{title}</h2><p>{records.length} {records.length === 1 ? "candidate" : "candidates"} ? sorted by {sort === "score" ? "fit score" : "relevant experience"}{role !== "all" && <small className="rank-coverage-note">{scoredForRole} scored; {unscoredForRole} unscored and shown without numeric rank</small>}</p></div>{compact ? <Link className="text-link" href="/candidates/all">View all <ArrowRightSmall /></Link> : <span className="table-total"><Files size={14} /> {candidates.length} total</span>}</div>
    {!compact && <div className="filter-row"><label className="search-box"><Search size={15} /><input aria-label="Search candidates" placeholder="Search candidate ID or file name" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="filter-select"><SlidersHorizontal size={14} /><select aria-label="Filter classification" value={classification} onChange={(event) => setClassification(event.target.value)}><option value="all">All classifications</option><option>LCA</option><option>UI/UX</option><option>Both</option><option>Neither / Uncertain</option></select><ChevronDown size={13} /></label><label className="filter-select"><Sparkles size={14} /><input aria-label="Filter by skill" placeholder="Filter by skill" value={skill} onChange={(event) => setSkill(event.target.value)} /></label><button className="sort-button" onClick={() => setSort(sort === "score" ? "experience" : "score")}><ArrowUpDown size={14} /> {sort === "score" ? "Sort: score" : "Sort: experience"}</button></div>}
    <div className="table-wrap"><table className="candidate-table"><thead><tr><th>{role === "all" ? "Candidate" : "Rank / candidate"}</th><th>Fit score</th><th>Experience evidence</th><th>Key evidence</th><th>Missing evidence</th><th>Classification</th><th>Status</th><th aria-label="Open candidate" /></tr></thead><tbody>{records.length > 0 ? records.slice(0, compact ? 5 : undefined).map((candidate, index) => { const value = role === "lca" ? candidate.lcaScore : role === "uiux" ? candidate.uiuxScore : Math.max(candidate.lcaScore ?? -1, candidate.uiuxScore ?? -1); const coverage = role === "lca" ? candidate.lcaCoverage : role === "uiux" ? candidate.uiuxCoverage : Math.max(candidate.lcaCoverage, candidate.uiuxCoverage); const criteria = role === "lca" ? candidate.lcaCriteria : role === "uiux" ? candidate.uiuxCriteria : [...candidate.lcaCriteria, ...candidate.uiuxCriteria]; const gaps = [...new Set([...criteria.flatMap((item) => item.missing), ...candidate.reviewFlags])].slice(0, 2); return <tr key={candidate.id} className="candidate-row"><td><div className="candidate-ident"><span className="rank-number">{role === "all" ? "" : roleRanks.get(candidate.id) ?? "-"}</span><span className={`candidate-avatar avatar-${index % 5}`}>{candidate.id.slice(2, 4)}</span><span><strong>{candidate.id}</strong><small>{candidate.filename}</small></span></div></td><td><Score value={value !== null && value < 0 ? null : value} coverage={coverage} failed={candidate.extractionStatus === "failed"} /></td><td>{candidate.yearsExperience === null ? <span className="muted-cell">Not stated</span> : <div><span className="experience-value">{candidate.yearsExperience} yrs</span>{candidate.experience[0] && <small className="experience-excerpt">{candidate.experience[0].value.slice(0, 54)}</small>}</div>}</td><td><div className="skill-chips">{candidate.skills.slice(0, 2).map((item) => <span key={item}>{item}</span>)}{candidate.skills.length === 0 && <span className="muted-cell">No evidence yet</span>}{candidate.skills.length > 2 && <small>+{candidate.skills.length - 2}</small>}</div></td><td>{gaps.length ? <span className="missing-chip" title={gaps.join(", ")}>{gaps.join(" · ")}</span> : <span className="verified-chip">All criteria have signals</span>}</td><td><Badge value={candidate.classification} /></td><td><Status candidate={candidate} /></td><td><button className="row-open" aria-label={`Open ${candidate.id} details`} onClick={() => setSelected(candidate)}><ChevronRight size={16} /></button></td></tr>; }) : <tr><td colSpan={8}><div className="empty-state"><div className="empty-icon"><FileSearch size={21} /></div><h3>{candidates.length === 0 ? "No resumes processed yet" : "No candidates match these filters"}</h3><p>{candidates.length === 0 ? "Upload the provided resume files or add a resume to see evidence-based rankings here." : "Adjust your search or filter to see more candidates."}</p>{candidates.length === 0 && <Link className="primary-button small-button" href="/upload">Upload a resume <ArrowRight size={14} /></Link>}</div></td></tr>}</tbody></table></div>{compact && records.length === 0 && <div className="table-empty-note">Resume counts and rankings will populate from real files as they are processed.</div>}{selected && <CandidateDetail candidate={selected} role={role} close={() => setSelected(null)} />}</section>;
}

function ArrowRightSmall() { return <ChevronRight size={14} />; }


