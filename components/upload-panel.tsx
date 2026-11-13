"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Check, FileText, LoaderCircle, Plus, ShieldCheck, Upload, X } from "lucide-react";
import type { Candidate } from "@/lib/types";
import { useCandidates } from "./candidate-store";

type ProcessLog = { id: string; file: string; status: "success" | "failed" | "duplicate"; message: string; at: string };
const allowed = ["pdf", "docx", "txt"];
const maxBytes = 4 * 1024 * 1024;

export function UploadPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { addCandidate, candidates } = useCandidates();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [logs, setLogs] = useState<ProcessLog[]>([]);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const addFiles = (selected: FileList | File[]) => {
    setDone(false); setError("");
    const next = [...selected];
    const invalid = next.filter((file) => !allowed.includes(file.name.split(".").pop()?.toLowerCase() ?? "") || file.size > maxBytes || file.size === 0);
    if (invalid.length) setError(`${invalid.map((file) => file.name).join(", ")}: file must be PDF, DOCX, or TXT, non-empty, and no larger than 4 MB.`);
    setFiles((current) => [...current, ...next.filter((file) => !invalid.includes(file) && !current.some((item) => item.name === file.name && item.size === file.size))]);
  };
  const process = async () => {
    if (!files.length) { setError("Choose at least one resume file."); return; }
    setBusy(true); setProgress(0); setLogs([]); setError("");
    const results: ProcessLog[] = [];
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      try {
        const body = new FormData(); body.set("file", file);
        const response = await fetch("/api/upload", { method: "POST", body });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Processing failed");
        const candidate = result.candidate as Candidate;
        const { duplicate } = addCandidate(candidate);
        results.push({ id: candidate.id, file: file.name, status: duplicate ? "duplicate" : candidate.extractionStatus === "failed" ? "failed" : "success", message: duplicate ? "Duplicate content detected; existing candidate retained." : candidate.reviewFlags.join(" · ") || (candidate.extractionStatus === "failed" ? "No text extracted. OCR may be required." : "Extracted and scored for both roles."), at: new Date().toISOString() });
      } catch (reason) {
        results.push({ id: `ERR-${index + 1}`, file: file.name, status: "failed", message: reason instanceof Error ? reason.message : "Processing failed", at: new Date().toISOString() });
      }
      setProgress(index + 1);
      setLogs([...results]);
    }
    try {
      const existing = JSON.parse(sessionStorage.getItem("talentrank.logs.v1") ?? "[]") as ProcessLog[];
      sessionStorage.setItem("talentrank.logs.v1", JSON.stringify([...results.reverse(), ...existing].slice(0, 200)));
    } catch { /* Visible in-page results remain available if session storage is full. */ }
    setBusy(false); setDone(true); setFiles([]);
  };
  return <div className="upload-page"><div className="page-intro"><div className="eyebrow">CANDIDATE INGESTION</div><h1>Compare new resumes</h1><p>Upload a resume or a batch to extract evidence and score candidates against both roles using the same ranking rules.</p></div>
    <div className="upload-layout"><section className="card upload-card"><div className="upload-card-heading"><div><h2>Resume files</h2><p>PDF, DOCX, or TXT · Up to 4 MB per file</p></div><span className="secure-label"><ShieldCheck size={15} /> Processed server-side</span></div>
      <div className={`drop-zone ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}><div className="drop-icon"><Upload size={22} /></div><strong>Drag and drop your resume files</strong><span>or choose files from your device</span><button className="secondary-button" onClick={() => inputRef.current?.click()}><Plus size={15} /> Browse files</button><small>PDF, DOCX, TXT · 4 MB max each</small><input ref={inputRef} type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" multiple hidden onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} /></div>
      {error && <div className="form-error" role="alert"><AlertCircle size={16} />{error}</div>}
      {files.length > 0 && <div className="queued-files"><div className="queued-heading"><strong>{files.length} file{files.length === 1 ? "" : "s"} ready</strong><button onClick={() => setFiles([])} disabled={busy}>Clear all</button></div>{files.map((file, index) => <div className="file-item" key={`${file.name}-${file.size}-${index}`}><span className="file-type-icon"><FileText size={16} /></span><span className="file-name"><strong>{file.name}</strong><small>{(file.size / 1024).toFixed(0)} KB · {file.name.split(".").pop()?.toUpperCase()}</small></span><button className="icon-button remove-file" disabled={busy} aria-label={`Remove ${file.name}`} onClick={() => setFiles(files.filter((_, i) => i !== index))}><X size={15} /></button></div>)}</div>}
      {busy && <div className="progress-panel"><div className="progress-caption"><span>Processing {progress} of {progress + files.length - progress} selected files</span><b>{Math.round((progress / (progress + files.length - progress)) * 100)}%</b></div><div className="progress-track"><span style={{ width: `${(progress / (progress + files.length - progress)) * 100}%` }} /></div><small>Extracting text, normalizing evidence, and calculating both role scores.</small></div>}
      <div className="upload-actions"><button className="primary-button" onClick={process} disabled={busy || files.length === 0}>{busy ? <><LoaderCircle size={16} className="spin" /> Processing batch…</> : <><Upload size={16} /> Process {files.length ? `${files.length} resume${files.length === 1 ? "" : "s"}` : "resumes"} <ArrowRight size={14} /></>}</button><span>Current pool: <b>{candidates.length}</b> candidates</span></div>
      {done && <div className="upload-complete" role="status"><Check size={16} /> Batch complete. {logs.filter((item) => item.status === "success").length} new candidate(s) added; {logs.filter((item) => item.status === "failed").length} extraction error(s); {logs.filter((item) => item.status === "duplicate").length} duplicate(s) skipped. <Link href="/candidates/all">View pool <ArrowRight size={12} /></Link></div>}
      {logs.length > 0 && <div className="batch-results"><h3>Batch results</h3>{logs.map((log, index) => <div className="batch-result" key={`${log.file}-${index}`}><span className={`result-icon result-${log.status}`}>{log.status === "success" ? <Check size={13} /> : log.status === "duplicate" ? <AlertCircle size={13} /> : <X size={13} />}</span><span><strong>{log.file}</strong><small>{log.id} · {log.message}</small></span></div>)}</div>}
    </section><aside className="upload-aside"><section className="card upload-guide"><div className="eyebrow">WHAT HAPPENS NEXT</div><h3>Every candidate goes through the same reviewable process.</h3>{[["01", "Extract", "Read text from PDFs and Word documents."], ["02", "Normalize", "Separate evidence from the original extracted text."], ["03", "Score", "Apply the same weighted criteria for each role."], ["04", "Review", "Inspect evidence, missing signals, and uncertainty." ]].map(([number, title, text]) => <div className="guide-step" key={number}><span>{number}</span><div><strong>{title}</strong><small>{text}</small></div></div>)}<Link className="text-link" href="/methodology">Read scoring methodology <ArrowRight size={13} /></Link></section><div className="ocr-note"><AlertCircle size={15} /><p><strong>Scanned PDF?</strong> If a PDF has no embedded text, the application flags it for OCR. OCR is not configured in this prototype, so the original file should be reviewed.</p></div><div className="storage-note"><ShieldCheck size={15} /><p>Uploaded records are kept in this browser session. They are not saved to shared or production storage.</p></div></aside></div>
  </div>;
}
