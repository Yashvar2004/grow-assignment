"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Check, CircleAlert, FileText, RefreshCw, X } from "lucide-react";
import { auditEvidenceContext } from "@/lib/evidence-audit";
import { getExtractionQuality } from "@/lib/extraction-quality";
import { useCandidates } from "./candidate-store";

type ProcessLog = { id: string; file: string; status: "success" | "failed" | "duplicate"; message: string; at: string };

function scoreStatus(candidate: ReturnType<typeof useCandidates>["candidates"][number]) {
  const unscoredRoles = [candidate.lcaScore === null ? "LCA" : null, candidate.uiuxScore === null ? "UI/UX" : null].filter(Boolean);
  if (candidate.extractionStatus === "failed") return "Unscored - extraction failed";
  if (unscoredRoles.length === 2) return "Unscored - no criterion evidence";
  if (unscoredRoles.length) return `Scored for one role; unscored for ${unscoredRoles.join(", ")}`;
  return "Scores present for both roles";
}

export function Processing() {
  const { candidates } = useCandidates();
  const [logs, setLogs] = useState<ProcessLog[]>([]);
  useEffect(() => {
    try { setLogs(JSON.parse(sessionStorage.getItem("talentrank.logs.v1") ?? "[]")); }
    catch { setLogs([]); }
  }, []);

  const failed = candidates.filter((item) => item.extractionStatus === "failed").length + logs.filter((item) => item.status === "failed" && !candidates.some((candidate) => candidate.id === item.id)).length;
  const partial = candidates.filter((item) => item.extractionStatus === "partial").length;
  const review = candidates.filter((item) => item.reviewFlags.length > 0).length;

  return <div className="processing-page">
    <div className="page-intro"><div className="eyebrow">AUDIT TRAIL</div><h1>Processing & errors</h1><p>Review extraction quality, incomplete records, source references, and recent upload results.</p></div>
    <div className="processing-stats">
      <div className="card process-stat"><span className="stat-icon green"><Check size={17} /></span><span><small>Successfully extracted</small><strong>{candidates.filter((item) => item.extractionStatus === "success").length}</strong></span></div>
      <div className="card process-stat"><span className="stat-icon orange"><AlertCircle size={17} /></span><span><small>Partial or flagged</small><strong>{partial + review}</strong></span></div>
      <div className="card process-stat"><span className="stat-icon red"><CircleAlert size={17} /></span><span><small>Extraction failures</small><strong>{failed}</strong></span></div>
    </div>
    <p className="quality-disclaimer">The text-volume signal is a legacy length-based indicator. It does not measure extraction correctness, qualification, or fit. Missing structured fields are unknown, not confirmed absent.</p>
    <section className="card process-card">
      <div className="section-heading"><div><div className="eyebrow">CURRENT RECORDS</div><h2>Quality overview</h2></div><span className="table-total">{candidates.length} records</span></div>
      {candidates.length === 0 ? <div className="processing-empty"><div className="empty-icon"><FileText size={19} /></div><div><strong>No resume processing records yet</strong><p>Place the provided resume files in <code>data/resumes/</code> and upload them through the app, or add a resume now.</p><Link className="text-link" href="/upload">Upload resume files <ArrowRight size={13} /></Link></div></div> : <div className="table-wrap"><table className="candidate-table process-table">
        <thead><tr><th>Candidate</th><th>Original filename and relative source</th><th>Source SHA-256</th><th>Extraction</th><th>Text-volume signal</th><th>Structured sections</th><th>Score state</th><th>Review flags</th><th>Audit-only warnings</th></tr></thead>
        <tbody>{candidates.map((item) => {
          const quality = getExtractionQuality(item);
          const warnings = auditEvidenceContext(item);
          const statusClass = item.extractionStatus === "success" ? "status-ready" : item.extractionStatus === "partial" ? "status-review" : "status-error";
          return <tr key={item.id}>
            <td><strong>{item.id}</strong></td>
            <td><strong>{item.filename}</strong><small className="source-subref">{item.source}</small></td>
            <td><code className="hash-value">{item.sourceSha256 ?? "Not available"}</code></td>
            <td><span className={`table-status ${statusClass}`}>{item.extractionStatus}</span>{item.extractionStatus === "failed" && <small className="source-subref">No usable text; retained and unscored</small>}</td>
            <td title="Legacy text-length estimate, not a probability">{item.extractionConfidence}/100<small className="source-subref">{quality.textLength.toLocaleString()} characters</small></td>
            <td>{quality.capturedSections}/{quality.totalSections} captured<small className="source-subref">{quality.sectionCounts.map((section) => `${section.label}: ${section.count}`).join("; ")}</small></td>
            <td>{scoreStatus(item)}<small className="source-subref">LCA {item.lcaScore ?? "unscored"}; UI/UX {item.uiuxScore ?? "unscored"}</small></td>
            <td>{item.reviewFlags.length ? item.reviewFlags.join(" · ") : "No extraction flags"}{quality.notes.length > 0 && <small className="source-subref">{quality.notes.join("; ")}</small>}</td>
            <td>{warnings.length ? warnings.map((warning) => warning.title).join("; ") : "None detected"}</td>
          </tr>;
        })}</tbody>
      </table></div>}
    </section>
    <section className="card process-card"><div className="section-heading"><div><div className="eyebrow">RECENT UPLOAD EVENTS</div><h2>Processing log</h2></div><RefreshCw size={16} className="muted" /></div>{logs.length === 0 ? <div className="processing-empty compact-empty"><div className="empty-icon"><RefreshCw size={18} /></div><div><strong>No upload events in this browser session</strong><p>Successful, duplicate, and failed upload outcomes will appear here.</p></div></div> : <div className="log-list">{logs.map((log, index) => <div className="log-row" key={`${log.file}-${index}`}><span className={`result-icon result-${log.status}`}>{log.status === "success" ? <Check size={13} /> : log.status === "duplicate" ? <AlertCircle size={13} /> : <X size={13} />}</span><span className="log-name"><strong>{log.file}</strong><small>{log.id} · {log.message}</small></span><time>{new Date(log.at).toLocaleString()}</time></div>)}</div>}</section>
  </div>;
}
