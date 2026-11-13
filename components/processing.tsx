"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Check, CircleAlert, FileText, RefreshCw, X } from "lucide-react";
import { useCandidates } from "./candidate-store";

type ProcessLog = { id: string; file: string; status: "success" | "failed" | "duplicate"; message: string; at: string };
export function Processing() {
  const { candidates } = useCandidates();
  const [logs, setLogs] = useState<ProcessLog[]>([]);
  useEffect(() => { try { setLogs(JSON.parse(sessionStorage.getItem("talentrank.logs.v1") ?? "[]")); } catch { setLogs([]); } }, []);
  const failed = candidates.filter((item) => item.extractionStatus === "failed").length + logs.filter((item) => item.status === "failed" && !candidates.some((candidate) => candidate.id === item.id)).length;
  const partial = candidates.filter((item) => item.extractionStatus === "partial").length;
  const review = candidates.filter((item) => item.reviewFlags.length > 0).length;
  return <div className="processing-page"><div className="page-intro"><div className="eyebrow">AUDIT TRAIL</div><h1>Processing & errors</h1><p>Review extraction quality, incomplete records, and recent upload results.</p></div>
    <div className="processing-stats"><div className="card process-stat"><span className="stat-icon green"><Check size={17} /></span><span><small>Successfully extracted</small><strong>{candidates.filter((item) => item.extractionStatus === "success").length}</strong></span></div><div className="card process-stat"><span className="stat-icon orange"><AlertCircle size={17} /></span><span><small>Partial or flagged</small><strong>{partial + review}</strong></span></div><div className="card process-stat"><span className="stat-icon red"><CircleAlert size={17} /></span><span><small>Extraction failures</small><strong>{failed}</strong></span></div></div>
    <section className="card process-card"><div className="section-heading"><div><div className="eyebrow">CURRENT RECORDS</div><h2>Quality overview</h2></div><span className="table-total">{candidates.length} records</span></div>{candidates.length === 0 ? <div className="processing-empty"><div className="empty-icon"><FileText size={19} /></div><div><strong>No resume processing records yet</strong><p>Place the provided resume files in <code>data/resumes/</code> and upload them through the app, or add a resume now.</p><Link className="text-link" href="/upload">Upload resume files <ArrowRight size={13} /></Link></div></div> : <div className="table-wrap"><table className="candidate-table process-table"><thead><tr><th>Candidate ID</th><th>Source file</th><th>Extraction</th><th>Confidence</th><th>Review flags</th></tr></thead><tbody>{candidates.map((item) => <tr key={item.id}><td><strong>{item.id}</strong></td><td>{item.filename}</td><td><span className={`table-status ${item.extractionStatus === "success" ? "status-ready" : "status-error"}`}>{item.extractionStatus}</span></td><td>{item.extractionConfidence}%</td><td>{item.reviewFlags.join(" · ") || "No flags"}</td></tr>)}</tbody></table></div>}</section>
    <section className="card process-card"><div className="section-heading"><div><div className="eyebrow">RECENT UPLOAD EVENTS</div><h2>Processing log</h2></div><RefreshCw size={16} className="muted" /></div>{logs.length === 0 ? <div className="processing-empty compact-empty"><div className="empty-icon"><RefreshCw size={18} /></div><div><strong>No upload events in this browser session</strong><p>Successful, duplicate, and failed upload outcomes will appear here.</p></div></div> : <div className="log-list">{logs.map((log, index) => <div className="log-row" key={`${log.file}-${index}`}><span className={`result-icon result-${log.status}`}>{log.status === "success" ? <Check size={13} /> : log.status === "duplicate" ? <AlertCircle size={13} /> : <X size={13} />}</span><span className="log-name"><strong>{log.file}</strong><small>{log.id} · {log.message}</small></span><time>{new Date(log.at).toLocaleString()}</time></div>)}</div>}</section>
  </div>;
}
