"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ArrowUpRight, BriefcaseBusiness, ChartNoAxesCombined, CircleHelp, FileSearch, Files, FlaskConical, LayoutDashboard, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { CandidateProvider, useCandidates } from "./candidate-store";

const navigation = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "LCA Candidates", href: "/candidates/lca", icon: FlaskConical },
  { label: "UI/UX Candidates", href: "/candidates/uiux", icon: BriefcaseBusiness },
  { label: "All Resumes", href: "/candidates/all", icon: Files },
  { label: "Upload Resume", href: "/upload", icon: Plus },
  { label: "Methodology", href: "/methodology", icon: CircleHelp },
  { label: "Processing & Errors", href: "/processing", icon: Activity },
];

function ShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { candidates } = useCandidates();
  const title = navigation.find((item) => item.href === pathname)?.label ?? "Overview";
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand"><span className="brand-mark"><ChartNoAxesCombined size={19} strokeWidth={2.5} /></span><span>TalentRank<span className="brand-ai"> AI</span></span></Link>
      <div className="workspace-label">WORKSPACE</div>
      <nav aria-label="Main navigation" className="main-nav">{navigation.map(({ label, href, icon: Icon }) => <Link key={href} href={href} className={`nav-link ${pathname === href ? "active" : ""}`}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{label === "All Resumes" && <span className="nav-count">{candidates.length}</span>}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="privacy-card"><div className="privacy-icon"><ShieldCheck size={16} /></div><strong>Human-led decisions</strong><p>Scores help organize evidence. Every hiring decision stays with your team.</p><Link href="/methodology">How scoring works <ArrowUpRight size={12} /></Link></div><div className="sidebar-user"><div className="avatar">HR</div><div><strong>HR Workspace</strong><small>Recruiting team</small></div><span className="online-dot" title="Workspace ready" /></div></div>
    </aside>
    <main className="main-area"><header className="topbar"><div><div className="breadcrumbs">TalentRank <span>/</span> <b>{title}</b></div></div><div className="topbar-right"><span className="dataset-status"><span className="status-dot" /> Dataset ready</span><Link className="topbar-upload" href="/upload"><Plus size={15} /> Add resume</Link><div className="avatar top-avatar">HR</div></div></header><div className="page-content">{children}</div><footer className="app-footer"><span>TalentRank AI <span className="muted">· Resume evidence organizer</span></span><span><Sparkles size={13} /> Deterministic scoring · Human review required</span></footer></main>
  </div>;
}
export function AppShell({ children }: { children: React.ReactNode }) { return <CandidateProvider><ShellFrame>{children}</ShellFrame></CandidateProvider>; }
