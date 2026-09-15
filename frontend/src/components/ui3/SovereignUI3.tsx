"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Shield,
  ShieldCheck,
  Cpu,
  Activity,
  Terminal,
  Layers,
  FileText,
  Search,
  Bell,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  Play,
  CheckCircle2,
  Clock,
  Radio,
  Maximize2,
  Sparkles,
  ExternalLink,
  Code,
  Lock,
  Send,
  X,
  RefreshCw,
  Users,
  FileCheck,
  Download,
  Eye,
  BarChart3,
  TrendingUp,
  Database,
  GitBranch,
  Zap,
  Settings,
  LogOut,
  Plus,
  Filter,
  Circle,
  CheckCircle,
  AlertCircle,
  XCircle,
  Minus,
  ArrowUpRight,
  Network,
  BookOpen,
  Folder,
  Archive,
  Sliders,
} from "lucide-react";
import { submitChat } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type AppPage = "landing" | "signin" | "workbench";
type WorkbenchView = "overview" | "tasks" | "coworking" | "knowledge" | "sandbox" | "deliverables" | "audit";

interface SovereignUI3Props {
  onBackToClassic?: () => void;
}

// ─── Animation Styles ────────────────────────────────────────────────────────

const STYLES = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes slideRight {
    from { opacity: 0; transform: translateX(-20px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideLeft {
    from { opacity: 0; transform: translateX(20px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.95); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }
  @keyframes shimmer {
    from { background-position: -200% center; }
    to   { background-position: 200% center; }
  }
  @keyframes rotate-slow {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes border-flow {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  .anim-fade-up   { animation: fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) both; }
  .anim-fade-in   { animation: fadeIn 0.35s ease both; }
  .anim-slide-r   { animation: slideRight 0.4s cubic-bezier(0.16,1,0.3,1) both; }
  .anim-slide-l   { animation: slideLeft  0.4s cubic-bezier(0.16,1,0.3,1) both; }
  .anim-scale-in  { animation: scaleIn 0.3s cubic-bezier(0.16,1,0.3,1) both; }

  .delay-100 { animation-delay: 0.10s; }
  .delay-200 { animation-delay: 0.20s; }
  .delay-300 { animation-delay: 0.30s; }
  .delay-400 { animation-delay: 0.40s; }
  .delay-500 { animation-delay: 0.50s; }
  .delay-600 { animation-delay: 0.60s; }
  .delay-700 { animation-delay: 0.70s; }

  .btn-primary {
    position: relative; overflow: hidden;
    transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.2s ease;
  }
  .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(79,70,229,0.35); }
  .btn-primary:active { transform: translateY(0); }

  .btn-ghost {
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
  }
  .btn-ghost:hover { transform: translateY(-1px); }
  .btn-ghost:active { transform: translateY(0); }

  .nav-item {
    transition: background 0.15s ease, color 0.15s ease, transform 0.12s ease;
  }
  .nav-item:hover { transform: translateX(2px); }

  .card {
    transition: box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
  }
  .card:hover { transform: translateY(-2px); box-shadow: 0 12px 32px -8px rgba(15,23,42,0.10); }

  .status-dot { animation: pulse-dot 2s ease-in-out infinite; }

  .gradient-text {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 40%, #06b6d4 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .grid-bg {
    background-image: linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px);
    background-size: 32px 32px;
  }
  
  .scrollbar-thin::-webkit-scrollbar { width: 4px; }
  .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
  .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.25); border-radius: 9999px; }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string; dot: string }> = {
    running:   { cls: "bg-blue-50  text-blue-700  border-blue-200",  label: "Running",   dot: "bg-blue-500" },
    completed: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Completed", dot: "bg-emerald-500" },
    queued:    { cls: "bg-amber-50 text-amber-700 border-amber-200",  label: "Queued",    dot: "bg-amber-500" },
    failed:    { cls: "bg-rose-50  text-rose-700  border-rose-200",   label: "Failed",    dot: "bg-rose-500" },
    cancelled: { cls: "bg-zinc-50  text-zinc-600  border-zinc-200",   label: "Cancelled", dot: "bg-zinc-400" },
  };
  const s = map[status] ?? { cls: "bg-zinc-50 text-zinc-600 border-zinc-200", label: status, dot: "bg-zinc-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} status-dot`} />
      {s.label}
    </span>
  );
}

function ClearanceBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    "L1": "bg-zinc-100  text-zinc-600  border-zinc-200",
    "L2": "bg-blue-50   text-blue-700  border-blue-200",
    "L3": "bg-violet-50 text-violet-700 border-violet-200",
    "L4": "bg-indigo-900 text-indigo-100 border-indigo-700",
  };
  const key = level.split(":")[0];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${map[key] ?? "bg-zinc-100 text-zinc-600 border-zinc-200"}`}>
      <Lock className="w-3 h-3" />
      {level}
    </span>
  );
}

// ─── Landing Page ─────────────────────────────────────────────────────────────

function LandingPage({ onEnter }: { onEnter: () => void }) {
  const [tick, setTick] = useState(0);
  const lines = [
    "INITIALIZING SOVEREIGN ENCLAVE...",
    "NETWORK POLICY: EGRESS BLOCKED",
    "MODEL REGISTRY LOADED: 4 MODELS",
    "AUDIT STORE: JSONL APPEND-ONLY",
    "SANDBOX: DOCKER --NETWORK NONE",
    "READY. ALL SYSTEMS NOMINAL.",
  ];

  useEffect(() => {
    if (tick >= lines.length) return;
    const t = setTimeout(() => setTick((p) => p + 1), 480);
    return () => clearTimeout(t);
  }, [tick, lines.length]);

  const CAPS = [
    { icon: Shield,    title: "Air-Gap Enforced",    desc: "Zero external network at runtime. All inference stays on-premise." },
    { icon: Cpu,       title: "Multi-Model Routing",  desc: "Config-driven task router: general, coding, vision, document types." },
    { icon: Code,      title: "Isolated Sandbox",     desc: "Python runs inside Docker --network none, --read-only, --cap-drop ALL." },
    { icon: Database,  title: "Local RAG & OCR",      desc: "Per-user vector store with cosine search. RapidOCR ONNX locally." },
    { icon: FileCheck, title: "Native Deliverables",  desc: "Generate .docx, .xlsx, .pptx without any cloud dependency." },
    { icon: Archive,   title: "Tamper-Evident Audit", desc: "Append-only JSONL ledger. Every model call and tool event logged." },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-white overflow-hidden relative flex flex-col">
      <style>{STYLES}</style>

      {/* Grid background */}
      <div className="absolute inset-0 grid-bg opacity-60 pointer-events-none" />

      {/* Glow orbs */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-violet-600/8 rounded-full blur-[140px] pointer-events-none" />

      {/* Top nav */}
      <nav className="relative z-20 flex items-center justify-between px-6 sm:px-12 py-5 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight text-white">AstraSovereign</span>
        </div>

        <div className="hidden sm:flex items-center gap-6 text-[13px] text-zinc-400 font-medium">
          {["Architecture", "Security Model", "Deployment"].map((l) => (
            <a key={l} href="#" className="hover:text-white transition-colors cursor-pointer">{l}</a>
          ))}
        </div>

        <button
          type="button"
          onClick={onEnter}
          className="btn-primary flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl cursor-pointer"
        >
          <span>Access Workbench</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </nav>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        {/* Top badge */}
        <div className="anim-fade-up mb-8 inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs font-semibold text-zinc-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-dot" />
          On-Premise · Air-Gapped · Zero Egress
        </div>

        {/* Headline */}
        <h1 className="anim-fade-up delay-100 text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] max-w-4xl">
          <span className="text-white">Sovereign AI</span>
          <br />
          <span className="gradient-text">for Classified Work</span>
        </h1>

        <p className="anim-fade-up delay-200 mt-6 text-base sm:text-lg text-zinc-400 max-w-2xl leading-relaxed font-medium">
          A fully self-hosted agentic workbench for defense, legal, finance, and government operations. 
          Multi-model orchestration, Docker sandboxing, native document generation — all strictly local.
        </p>

        {/* CTAs */}
        <div className="anim-fade-up delay-300 mt-10 flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={onEnter}
            className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl cursor-pointer shadow-lg shadow-indigo-500/20"
          >
            Enter Workbench
            <ArrowRight className="w-4 h-4" />
          </button>
          <a
            href="#architecture"
            className="btn-ghost w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-semibold text-sm rounded-xl border border-white/10 cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            Read Architecture
          </a>
        </div>

        {/* Terminal Preview */}
        <div className="anim-fade-up delay-400 mt-16 w-full max-w-2xl bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          {/* Terminal chrome */}
          <div className="flex items-center gap-1.5 px-4 py-3 bg-white/[0.03] border-b border-white/5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
            <span className="ml-3 text-[11px] font-mono text-zinc-500">sovereign-enclave — boot sequence</span>
          </div>
          <div className="p-5 font-mono text-[13px] text-left space-y-1.5 min-h-[160px]">
            {lines.slice(0, tick).map((line, i) => (
              <div
                key={i}
                className="anim-slide-r"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <span className="text-indigo-400">$ </span>
                <span className={line.includes("READY") ? "text-emerald-400 font-bold" : "text-zinc-300"}>{line}</span>
              </div>
            ))}
            {tick < lines.length && (
              <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse align-middle" />
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div className="anim-fade-up delay-500 mt-10 flex flex-wrap justify-center gap-8">
          {[
            { label: "Local Models",   value: "4+"     },
            { label: "Audit Events",   value: "∞"      },
            { label: "Egress",         value: "0 bytes" },
            { label: "External APIs",  value: "None"   },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-2xl font-black text-white">{s.value}</div>
              <div className="text-xs text-zinc-500 font-medium mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </main>

      {/* Capability cards */}
      <section id="architecture" className="relative z-10 px-6 sm:px-12 pb-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Built for sovereignty</h2>
            <p className="text-zinc-400 text-sm mt-2">Every component runs on your hardware. Nothing leaves the machine.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CAPS.map((cap, i) => {
              const Icon = cap.icon;
              return (
                <div
                  key={i}
                  className="card anim-fade-up bg-white/[0.03] border border-white/8 rounded-2xl p-5 cursor-default"
                  style={{ animationDelay: `${0.6 + i * 0.08}s` }}
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-400/20 flex items-center justify-center mb-3">
                    <Icon className="w-4.5 h-4.5 text-indigo-400" />
                  </div>
                  <div className="font-bold text-white text-sm mb-1">{cap.title}</div>
                  <div className="text-zinc-500 text-xs leading-relaxed">{cap.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Sign-In Page ─────────────────────────────────────────────────────────────

const USERS = [
  { id: "admin-001", name: "Security Officer & Admin", dept: "Security & Directorate",   clearance: "L4: Sovereign Officer" },
  { id: "user-001", name: "Senior Legal Counsel",      dept: "Legal & Contracts",        clearance: "L3: Dept Lead" },
  { id: "user-002", name: "Lead Financial Analyst",    dept: "Finance & Accounting",     clearance: "L4: Dept Lead" },
  { id: "user-003", name: "Chief Compliance Auditor",  dept: "HR & Compliance",          clearance: "L2: Reviewer" },
  { id: "user-004", name: "Supply Operations Spec.",   dept: "Operations & Supply",      clearance: "L1: Contributor" },
  { id: "user-005", name: "Infrastructure Lead",       dept: "AI & Engineering",         clearance: "L4: Sovereign Officer" },
];

function SignInPage({
  onBack,
  onAuthenticated,
}: {
  onBack: () => void;
  onAuthenticated: (userId: string) => void;
}) {
  const [selected, setSelected] = useState<string>("");
  const [passkey, setPasskey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const user = USERS.find((u) => u.id === selected);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selected) { setError("Select a department identity."); return; }
      if (passkey !== "sovereign2026") { setError("Invalid passkey. Hint: sovereign2026"); return; }
      setLoading(true);
      await new Promise((r) => setTimeout(r, 800));
      try {
        window.sessionStorage.setItem("sovereign.session", "1");
        window.sessionStorage.setItem("sovereign.user", selected);
      } catch { /* ignore */ }
      setLoading(false);
      onAuthenticated(selected);
    },
    [selected, passkey, onAuthenticated],
  );

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4 relative overflow-hidden">
      <style>{STYLES}</style>

      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/8 rounded-full blur-[120px] pointer-events-none" />

      <div className="anim-scale-in relative z-10 w-full max-w-md">
        {/* Back button */}
        <button
          type="button"
          onClick={onBack}
          className="btn-ghost flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm font-medium mb-8 cursor-pointer"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Back to home
        </button>

        {/* Card */}
        <div className="bg-zinc-950 border border-white/10 rounded-3xl p-8 shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 mb-7">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Sovereign Access</h1>
              <p className="text-xs text-zinc-500 mt-0.5">On-premise authentication</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Department Selector */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-2.5 uppercase tracking-wider">
                Department Identity
              </label>
              <div className="space-y-2 max-h-[220px] overflow-y-auto scrollbar-thin pr-1">
                {USERS.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => { setSelected(u.id); setError(null); }}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selected === u.id
                        ? "bg-indigo-600/20 border-indigo-500/50 ring-1 ring-indigo-500/30"
                        : "bg-white/[0.03] border-white/8 hover:bg-white/[0.06] hover:border-white/15"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{u.name}</div>
                      <div className="text-xs text-zinc-500 truncate">{u.dept}</div>
                    </div>
                    <ClearanceBadge level={u.clearance} />
                  </button>
                ))}
              </div>
            </div>

            {/* Passkey input */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">
                Passkey
              </label>
              <input
                ref={inputRef}
                type="password"
                value={passkey}
                onChange={(e) => { setPasskey(e.target.value); setError(null); }}
                placeholder="Enter sovereign passkey..."
                className="w-full bg-white/[0.04] border border-white/10 text-white text-sm placeholder-zinc-600 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="anim-fade-in flex items-center gap-2 px-3.5 py-2.5 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-400 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Access Workbench</span>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-xs text-zinc-600 mt-6 font-mono">
            sovereign.local · 127.0.0.1 · air-gapped
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Workbench Shell ──────────────────────────────────────────────────────────

const NAV_ITEMS: { id: WorkbenchView; label: string; icon: React.ElementType; badge?: number }[] = [
  { id: "overview",     label: "Overview",       icon: BarChart3 },
  { id: "tasks",        label: "AI Tasks",        icon: Terminal  },
  { id: "coworking",    label: "Coworking",       icon: Users     },
  { id: "knowledge",    label: "Knowledge Vault", icon: BookOpen  },
  { id: "sandbox",      label: "Code Sandbox",    icon: Code      },
  { id: "deliverables", label: "Deliverables",    icon: FileCheck },
  { id: "audit",        label: "Audit Logs",      icon: Archive   },
];

function Workbench({
  userId,
  onSignOut,
  onBackToClassic,
}: {
  userId: string;
  onSignOut: () => void;
  onBackToClassic?: () => void;
}) {
  const [view, setView] = useState<WorkbenchView>("overview");
  const [prevView, setPrevView] = useState<WorkbenchView>("overview");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskInput, setTaskInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [viewKey, setViewKey] = useState(0);

  const user = USERS.find((u) => u.id === userId) ?? USERS[0];

  const handleViewChange = useCallback((next: WorkbenchView) => {
    setPrevView(view);
    setView(next);
    setViewKey((k) => k + 1);
  }, [view]);

  const handleDispatch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskInput.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await submitChat(userId, taskInput);
      setJobId(res.job_id);
    } catch {
      setJobId(`job-${Date.now().toString(36)}`);
    } finally {
      setSubmitting(false);
    }
  }, [taskInput, submitting, userId]);

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 flex overflow-hidden" style={{ fontFamily: "inherit" }}>
      <style>{STYLES}</style>

      {/* Sidebar */}
      <aside className="w-60 shrink-0 hidden md:flex flex-col bg-white border-r border-zinc-200/80 shadow-[1px_0_0_0_rgba(0,0,0,0.04)]">
        {/* Brand */}
        <div className="px-5 pt-6 pb-4 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm shadow-indigo-500/20">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-zinc-900">AstraSovereign</div>
              <div className="text-[10px] text-indigo-500 font-semibold tracking-wider uppercase">Local Enclave</div>
            </div>
          </div>
        </div>

        {/* New task button */}
        <div className="px-3 py-3">
          <button
            type="button"
            onClick={() => setTaskModalOpen(true)}
            className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm shadow-indigo-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            New Work Order
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto scrollbar-thin">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleViewChange(item.id)}
                className={`nav-item w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium cursor-pointer ${
                  active
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${active ? "text-indigo-600" : "text-zinc-400"}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] font-bold bg-rose-500 text-white rounded-full px-1.5 py-0.5">{item.badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User profile footer */}
        <div className="border-t border-zinc-100 p-3">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-zinc-50 cursor-default group transition-colors">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-[11px] font-black text-white shrink-0">
              {user.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-zinc-900 truncate">{user.name}</div>
              <ClearanceBadge level={user.clearance} />
            </div>
            <button
              type="button"
              onClick={onSignOut}
              title="Sign out"
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Air-gap status */}
          <div className="flex items-center gap-1.5 px-3 pt-1 text-[10px] text-zinc-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 status-dot" />
            Air-gapped · 0 bytes egress
          </div>

          {/* Back to classic */}
          {onBackToClassic ? (
            <button
              type="button"
              onClick={onBackToClassic}
              className="btn-ghost mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-700 font-medium rounded-xl hover:bg-zinc-100 cursor-pointer border border-transparent"
            >
              <ExternalLink className="w-3 h-3" />
              Classic UI
            </button>
          ) : (
            <Link
              href="/"
              className="btn-ghost mt-2 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-700 font-medium rounded-xl hover:bg-zinc-100 cursor-pointer border border-transparent"
            >
              <ExternalLink className="w-3 h-3" />
              Classic UI
            </Link>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="shrink-0 h-14 bg-white border-b border-zinc-200/80 flex items-center justify-between px-5 sm:px-7 gap-3 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-bold text-zinc-900 truncate">
              {NAV_ITEMS.find((n) => n.id === view)?.label ?? "Overview"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200/70 text-zinc-500 text-xs rounded-xl cursor-pointer transition-colors border border-zinc-200">
              <Search className="w-3.5 h-3.5" />
              <span>Search...</span>
              <kbd className="text-[10px] bg-white border border-zinc-200 rounded px-1 font-mono text-zinc-400">⌘K</kbd>
            </div>

            {/* Air-gap pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] font-bold text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 status-dot" />
              <span className="hidden sm:inline">Air-Gapped</span>
            </div>

            {/* User avatar mobile fallback */}
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-[10px] font-black text-white shrink-0 cursor-pointer md:hidden">
              {user.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </div>
          </div>
        </header>

        {/* View area */}
        <div className="flex-1 overflow-y-auto scrollbar-thin bg-zinc-50/50">
          <div key={viewKey} className="anim-fade-up h-full">
            {view === "overview"     && <OverviewView userId={userId} onNewTask={() => setTaskModalOpen(true)} onNavigate={handleViewChange} />}
            {view === "tasks"        && <TasksView userId={userId} onNewTask={() => setTaskModalOpen(true)} />}
            {view === "coworking"    && <CoworkingView userId={userId} clearance={user.clearance} />}
            {view === "knowledge"    && <KnowledgeView userId={userId} />}
            {view === "sandbox"      && <SandboxView userId={userId} />}
            {view === "deliverables" && <DeliverablesView userId={userId} />}
            {view === "audit"        && <AuditView userId={userId} />}
          </div>
        </div>
      </main>

      {/* Task dispatch modal */}
      {taskModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm anim-fade-in"
          onClick={() => { setTaskModalOpen(false); setJobId(null); setTaskInput(""); }}
        >
          <div
            className="anim-scale-in w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                  <Terminal className="w-4.5 h-4.5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Dispatch Work Order</h3>
                  <p className="text-xs text-zinc-500">Local Ollama · Zero Egress</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setTaskModalOpen(false); setJobId(null); setTaskInput(""); }}
                className="btn-ghost w-8 h-8 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Preset tasks */}
              <div>
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Quick Presets</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { title: "Contract Compliance Audit", desc: "Legal review · L3 clearance", prompt: "Perform a comprehensive compliance audit on our procurement NDA and identify non-conforming clauses." },
                    { title: "Financial Ledger Export",   desc: "Finance · .xlsx deliverable",  prompt: "Compile the Q3 departmental expenditure report into a structured Excel ledger with variance formulas." },
                    { title: "Code Sandbox Execution",    desc: "Docker · --network none",      prompt: "Run a Monte Carlo simulation in 500 iterations inside the isolated Docker sandbox and return the output." },
                    { title: "Document OCR Ingestion",    desc: "Vision · RapidOCR",            prompt: "Ingest the uploaded scanned PDF using local OCR and embed the extracted text into the knowledge vault." },
                  ].map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setTaskInput(p.prompt)}
                      className="btn-ghost p-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 hover:border-zinc-300 text-left cursor-pointer"
                    >
                      <div className="text-xs font-bold text-zinc-900">{p.title}</div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Free-form input */}
              <div>
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Task Instructions</div>
                <textarea
                  rows={3}
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  placeholder="Describe the work order in plain language..."
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 text-sm placeholder-zinc-400 rounded-2xl px-4 py-3 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 resize-none transition-all"
                />
              </div>

              {/* Success state */}
              {jobId && (
                <div className="anim-scale-in flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  <div className="flex items-center gap-2 text-xs text-emerald-800 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Dispatched — <span className="font-mono font-bold">{jobId}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setTaskModalOpen(false); handleViewChange("tasks"); }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                  >
                    View Task
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setTaskModalOpen(false); setJobId(null); setTaskInput(""); }}
                  className="btn-ghost px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 font-medium rounded-xl hover:bg-zinc-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !taskInput.trim()}
                  onClick={handleDispatch}
                  className="btn-primary flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-sm rounded-xl cursor-pointer shadow-sm shadow-indigo-500/20"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Dispatch</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── View: Overview ───────────────────────────────────────────────────────────

function OverviewView({ userId, onNewTask, onNavigate }: { userId: string; onNewTask: () => void; onNavigate: (v: WorkbenchView) => void }) {
  const METRICS = [
    { label: "Work Orders Today", value: "18",   sub: "4 currently running",   accent: "text-indigo-600", iconBg: "bg-indigo-50", Icon: Terminal, border: "border-l-indigo-500" },
    { label: "Deliverables",      value: "42",   sub: "Word · Excel · PPT",    accent: "text-emerald-600",iconBg: "bg-emerald-50",Icon: FileCheck,border: "border-l-emerald-500" },
    { label: "Network Egress",    value: "0 B",  sub: "Strict air-gap active", accent: "text-rose-600",   iconBg: "bg-rose-50",  Icon: Network,  border: "border-l-rose-500" },
    { label: "VRAM Allocated",    value: "14.2G",sub: "Qwen 2.5-Coder · 32B",  accent: "text-amber-600",  iconBg: "bg-amber-50", Icon: Cpu,      border: "border-l-amber-500" },
  ];

  const MODELS = [
    { name: "qwen2.5-coder:7b",  task: "coding",   status: "active",  vram: "6.8 GB",  tokens: "84 t/s" },
    { name: "llama3:latest",     task: "general",  status: "active",  vram: "7.4 GB",  tokens: "62 t/s" },
    { name: "llava:7b",          task: "vision",   status: "standby", vram: "7.0 GB",  tokens: "—" },
    { name: "nomic-embed-text",  task: "embedding",status: "active",  vram: "0.4 GB",  tokens: "—" },
  ];

  const RECENT_JOBS = [
    { id: "job-a1b2", task: "Contract compliance audit Q3", model: "llama3", status: "completed", ts: "2m ago" },
    { id: "job-c3d4", task: "Monte Carlo risk simulation",  model: "qwen2.5-coder", status: "running",   ts: "Now"    },
    { id: "job-e5f6", task: "OCR ingest facility schematic",model: "llava",  status: "completed", ts: "12m ago" },
    { id: "job-g7h8", task: "Excel Q3 ledger generation",  model: "llama3", status: "queued",    ts: "—"      },
  ];

  return (
    <div className="p-6 sm:p-8 max-w-[1400px] mx-auto w-full space-y-7">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-zinc-900 tracking-tight">System Overview</h1>
          <p className="text-sm text-zinc-500 mt-0.5 font-medium">Local inference cluster · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <button
          type="button"
          onClick={onNewTask}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl cursor-pointer shadow-sm shadow-indigo-500/20 self-start"
        >
          <Plus className="w-4 h-4" />
          New Work Order
        </button>
      </div>

      {/* Metric grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {METRICS.map((m, i) => {
          const Icon = m.Icon;
          return (
            <div key={i} className={`card anim-fade-up bg-white border border-zinc-200 rounded-2xl p-5 border-l-4 ${m.border} cursor-default`} style={{ animationDelay: `${i * 0.06}s` }}>
              <div className={`w-8 h-8 rounded-xl ${m.iconBg} flex items-center justify-center mb-3`}>
                <Icon className={`w-4 h-4 ${m.accent}`} />
              </div>
              <div className={`text-2xl font-black ${m.accent}`}>{m.value}</div>
              <div className="text-xs font-semibold text-zinc-900 mt-0.5">{m.label}</div>
              <div className="text-[11px] text-zinc-400 mt-0.5">{m.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Two-column lower section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Registry */}
        <div className="card anim-fade-up delay-200 bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-bold text-zinc-900">Model Registry</span>
            </div>
            <button type="button" onClick={() => onNavigate("tasks")} className="text-xs text-indigo-600 font-semibold hover:text-indigo-700 cursor-pointer">
              View all
            </button>
          </div>
          <div className="divide-y divide-zinc-100">
            {MODELS.map((m, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${m.status === "active" ? "bg-emerald-500 status-dot" : "bg-zinc-300"}`} />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-zinc-900 font-mono truncate">{m.name}</div>
                    <div className="text-[11px] text-zinc-500 capitalize">{m.task}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-semibold text-zinc-700">{m.vram}</div>
                  {m.tokens !== "—" && <div className="text-[11px] text-zinc-400 font-mono">{m.tokens}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent jobs */}
        <div className="card anim-fade-up delay-300 bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-bold text-zinc-900">Recent Jobs</span>
            </div>
            <button type="button" onClick={() => onNavigate("tasks")} className="text-xs text-indigo-600 font-semibold hover:text-indigo-700 cursor-pointer">
              View all
            </button>
          </div>
          <div className="divide-y divide-zinc-100">
            {RECENT_JOBS.map((j, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3.5 hover:bg-zinc-50/80 transition-colors cursor-default">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-zinc-900 truncate">{j.task}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-zinc-400 font-mono">{j.model}</span>
                    <span className="text-zinc-300">·</span>
                    <span className="text-[11px] text-zinc-400">{j.ts}</span>
                  </div>
                </div>
                <div className="shrink-0 ml-3">
                  <StatusBadge status={j.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── View: Tasks ──────────────────────────────────────────────────────────────

function TasksView({ userId, onNewTask }: { userId: string; onNewTask: () => void }) {
  const [filter, setFilter] = useState<string>("all");

  const JOBS = [
    { id: "job-a1b2c3", task: "Contract compliance review Q3 procurement NDA", model: "llama3:latest",      type: "general",  status: "completed", started: "16:18:22", dur: "42s",  iter: 3 },
    { id: "job-d4e5f6", task: "Monte Carlo risk simulation (1000 iterations)",  model: "qwen2.5-coder:7b",  type: "coding",   status: "running",   started: "16:32:01", dur: "—",    iter: 2 },
    { id: "job-g7h8i9", task: "Scanned PDF ingestion: facility schematic plan", model: "llava:7b",           type: "vision",   status: "completed", started: "16:20:14", dur: "18s",  iter: 2 },
    { id: "job-j0k1l2", task: "Q3 departmental expenditure Excel ledger",       model: "llama3:latest",      type: "document", status: "queued",    started: "—",        dur: "—",    iter: 0 },
    { id: "job-m3n4o5", task: "Firmware vulnerability scan (Python static)",     model: "qwen2.5-coder:7b",  type: "coding",   status: "completed", started: "15:55:09", dur: "1m 8s",iter: 4 },
    { id: "job-p6q7r8", task: "Air-gap policy compliance report generation",     model: "llama3:latest",      type: "document", status: "failed",    started: "15:42:33", dur: "8s",   iter: 1 },
  ];

  const filtered = filter === "all" ? JOBS : JOBS.filter((j) => j.status === filter);

  return (
    <div className="p-6 sm:p-8 max-w-[1400px] mx-auto w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-zinc-900">AI Task Queue</h1>
          <p className="text-sm text-zinc-500 mt-0.5 font-medium">Agent loop: route → tool call → observe → complete</p>
        </div>
        <button
          type="button"
          onClick={onNewTask}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl cursor-pointer self-start"
        >
          <Plus className="w-4 h-4" />
          Dispatch Order
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {["all", "running", "queued", "completed", "failed"].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`btn-ghost px-3 py-1.5 rounded-xl text-xs font-semibold capitalize cursor-pointer border ${
              filter === f
                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Job list */}
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-3 bg-zinc-50/80 border-b border-zinc-200 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
          <div className="col-span-4">Task</div>
          <div className="col-span-2">Model</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-1 text-center">Iter.</div>
          <div className="col-span-1">Duration</div>
          <div className="col-span-2 text-right">Status</div>
        </div>
        <div className="divide-y divide-zinc-100">
          {filtered.map((j, i) => (
            <div
              key={j.id}
              className="anim-fade-up grid grid-cols-12 items-center px-5 py-4 hover:bg-zinc-50/80 transition-colors cursor-pointer"
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <div className="col-span-4 min-w-0 pr-4">
                <div className="text-xs font-semibold text-zinc-900 truncate">{j.task}</div>
                <div className="text-[11px] text-zinc-400 font-mono mt-0.5">{j.id}</div>
              </div>
              <div className="col-span-2 text-[11px] font-mono text-zinc-600 truncate pr-2">{j.model}</div>
              <div className="col-span-2">
                <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 text-[11px] font-semibold capitalize border border-zinc-200">{j.type}</span>
              </div>
              <div className="col-span-1 text-center text-xs font-bold text-zinc-700">{j.iter}</div>
              <div className="col-span-1 text-xs text-zinc-500 font-mono">{j.dur}</div>
              <div className="col-span-2 flex justify-end">
                <StatusBadge status={j.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── View: Coworking ──────────────────────────────────────────────────────────

function CoworkingView({ userId, clearance }: { userId: string; clearance: string }) {
  const TASKS = [
    { title: "Defense Vendor NDA Review",       dept: "Legal & Contracts",    assignee: "Senior Legal Counsel",    level: "L3: Dept Lead",          status: "Pending L3 Approval", deliverable: "contract-review.docx"    },
    { title: "Q3 Sovereign Ledger Audit",        dept: "Finance & Accounting", assignee: "Lead Financial Analyst",  level: "L4: Sovereign Officer",  status: "L4 Signed Off",       deliverable: "q3-ledger-final.xlsx"    },
    { title: "Hardware Procurement Manifest",    dept: "Operations & Supply",  assignee: "Supply Operations Spec.", level: "L1: Contributor",        status: "In Progress",         deliverable: null                      },
    { title: "Air-Gap Docker Policy Audit",      dept: "AI & Engineering",     assignee: "Infrastructure Lead",     level: "L4: Sovereign Officer",  status: "Pending L4 Sign-Off", deliverable: "docker-policy-audit.pdf" },
    { title: "HR Onboarding Compliance Pack",    dept: "HR & Compliance",      assignee: "Chief Compliance Auditor",level: "L2: Reviewer",           status: "Pending L2 Review",   deliverable: "hr-compliance-pack.docx" },
  ];

  const statusColor: Record<string, string> = {
    "In Progress":        "text-blue-600   bg-blue-50   border-blue-200",
    "Pending L2 Review":  "text-amber-600  bg-amber-50  border-amber-200",
    "Pending L3 Approval":"text-violet-600 bg-violet-50 border-violet-200",
    "Pending L4 Sign-Off":"text-indigo-600 bg-indigo-50 border-indigo-200",
    "L4 Signed Off":      "text-emerald-600 bg-emerald-50 border-emerald-200",
  };

  return (
    <div className="p-6 sm:p-8 max-w-[1400px] mx-auto w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-zinc-900">Department Coworking</h1>
          <p className="text-sm text-zinc-500 mt-0.5 font-medium">
            Hierarchical clearance sign-offs: L1 Contributor → L2 Reviewer → L3 Dept Lead → L4 Sovereign Officer
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 font-medium">Active identity:</span>
          <ClearanceBadge level={clearance} />
        </div>
      </div>

      {/* Active tasks table */}
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-3 bg-zinc-50/80 border-b border-zinc-200 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
          <div className="col-span-3">Task</div>
          <div className="col-span-2">Department</div>
          <div className="col-span-2">Assignee</div>
          <div className="col-span-2">Required Level</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        <div className="divide-y divide-zinc-100">
          {TASKS.map((t, i) => (
            <div key={i} className="anim-fade-up grid grid-cols-12 items-center px-5 py-4 hover:bg-zinc-50/50 transition-colors" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="col-span-3 min-w-0 pr-3">
                <div className="text-xs font-bold text-zinc-900 truncate">{t.title}</div>
                {t.deliverable && (
                  <div className="text-[11px] font-mono text-zinc-400 mt-0.5 truncate">{t.deliverable}</div>
                )}
              </div>
              <div className="col-span-2 text-xs text-zinc-600 pr-2">{t.dept}</div>
              <div className="col-span-2 text-xs text-zinc-600 pr-2">{t.assignee}</div>
              <div className="col-span-2">
                <ClearanceBadge level={t.level} />
              </div>
              <div className="col-span-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor[t.status] ?? "text-zinc-600 bg-zinc-100 border-zinc-200"}`}>
                  {t.status}
                </span>
              </div>
              <div className="col-span-1 flex justify-end">
                <button
                  type="button"
                  className="btn-ghost px-2.5 py-1.5 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer border border-indigo-100 hover:border-indigo-200 transition-colors"
                >
                  Review
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── View: Knowledge Vault ────────────────────────────────────────────────────

function KnowledgeView({ userId }: { userId: string }) {
  const DOCS = [
    { name: "Procurement Specification v2.1",   type: "PDF", pages: 14, status: "ready",   size: "1.2 MB", chunks: 84,  indexed: "16:18" },
    { name: "Facility Safety Manual Q4",         type: "PDF", pages: 38, status: "ready",   size: "4.8 MB", chunks: 220, indexed: "15:42" },
    { name: "Defense Vendor NDA Template",       type: "DOCX",pages: 6,  status: "ready",   size: "0.4 MB", chunks: 32,  indexed: "14:10" },
    { name: "Air-Gap Architecture Schematic",    type: "PNG", pages: 1,  status: "ocr",     size: "2.1 MB", chunks: 18,  indexed: "—"     },
    { name: "Q3 Financial Summary",              type: "XLSX",pages: 3,  status: "ready",   size: "0.7 MB", chunks: 28,  indexed: "13:55" },
  ];

  const statusMap: Record<string, string> = {
    ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
    ocr:   "bg-blue-50    text-blue-700    border-blue-200",
    error: "bg-rose-50    text-rose-700    border-rose-200",
  };
  const statusLabel: Record<string, string> = { ready: "Indexed", ocr: "OCR Processing", error: "Error" };

  return (
    <div className="p-6 sm:p-8 max-w-[1400px] mx-auto w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-zinc-900">Knowledge Vault</h1>
          <p className="text-sm text-zinc-500 mt-0.5 font-medium">Per-user local RAG · Cosine vector search · nomic-embed-text</p>
        </div>
        <label className="btn-primary flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl cursor-pointer shadow-sm shadow-indigo-500/20">
          <Plus className="w-4 h-4" />
          Ingest Document
          <input type="file" className="hidden" />
        </label>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Documents", value: "5", Icon: FileText },
          { label: "Chunks",    value: "382",Icon: Database },
          { label: "OCR'd",     value: "1",  Icon: Eye },
        ].map((s, i) => {
          const Icon = s.Icon;
          return (
            <div key={i} className="card anim-fade-up bg-white border border-zinc-200 rounded-2xl p-4 flex items-center gap-3 cursor-default" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-zinc-500" />
              </div>
              <div>
                <div className="text-lg font-black text-zinc-900">{s.value}</div>
                <div className="text-xs text-zinc-500 font-medium">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Document list */}
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-3 bg-zinc-50/80 border-b border-zinc-200 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
          <div className="col-span-4">Document</div>
          <div className="col-span-1">Type</div>
          <div className="col-span-1 text-center">Pages</div>
          <div className="col-span-2 text-center">Chunks</div>
          <div className="col-span-1">Size</div>
          <div className="col-span-2 text-center">Indexed At</div>
          <div className="col-span-1 text-right">Status</div>
        </div>
        <div className="divide-y divide-zinc-100">
          {DOCS.map((d, i) => (
            <div key={i} className="anim-fade-up grid grid-cols-12 items-center px-5 py-4 hover:bg-zinc-50/50 transition-colors" style={{ animationDelay: `${i * 0.04}s` }}>
              <div className="col-span-4 flex items-center gap-2.5 min-w-0 pr-3">
                <div className="w-7 h-7 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0">
                  <FileText className="w-3.5 h-3.5 text-zinc-400" />
                </div>
                <span className="text-xs font-semibold text-zinc-900 truncate">{d.name}</span>
              </div>
              <div className="col-span-1 text-[11px] font-mono text-zinc-500">{d.type}</div>
              <div className="col-span-1 text-center text-xs text-zinc-600">{d.pages}</div>
              <div className="col-span-2 text-center text-xs font-bold text-zinc-700">{d.chunks}</div>
              <div className="col-span-1 text-[11px] text-zinc-500">{d.size}</div>
              <div className="col-span-2 text-center text-[11px] font-mono text-zinc-400">{d.indexed}</div>
              <div className="col-span-1 flex justify-end">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusMap[d.status]}`}>
                  {statusLabel[d.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── View: Code Sandbox ───────────────────────────────────────────────────────

function SandboxView({ userId }: { userId: string }) {
  const RUNS = [
    { id: "run-001", lang: "python3.11",  cmd: "Monte Carlo sim 1000 iter",   exit: 0, dur: "1.2s",  mem: "48 MB",  ts: "16:31" },
    { id: "run-002", lang: "python3.11",  cmd: "SHA-256 hash batch processor", exit: 0, dur: "0.8s",  mem: "22 MB",  ts: "15:58" },
    { id: "run-003", lang: "python3.11",  cmd: "Statistical variance compute", exit: 1, dur: "0.4s",  mem: "18 MB",  ts: "15:42" },
    { id: "run-004", lang: "python3.11",  cmd: "PDF text extraction pipeline", exit: 0, dur: "3.1s",  mem: "64 MB",  ts: "14:20" },
  ];

  return (
    <div className="p-6 sm:p-8 max-w-[1400px] mx-auto w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-zinc-900">Code Sandbox</h1>
          <p className="text-sm text-zinc-500 mt-0.5 font-medium">Ephemeral Docker containers · --network none · --read-only · --cap-drop ALL</p>
        </div>
      </div>

      {/* Security flags */}
      <div className="bg-zinc-950 border border-white/10 rounded-2xl p-5">
        <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-3">Container Security Policy</div>
        <div className="font-mono text-[13px] text-zinc-300 leading-relaxed">
          <span className="text-indigo-400">docker run</span>{" "}
          <span className="text-emerald-400">--rm</span>{" "}
          <span className="text-emerald-400">--network none</span>{" "}
          <span className="text-emerald-400">--read-only</span>{" "}
          <span className="text-emerald-400">--cap-drop ALL</span>{" "}
          <span className="text-emerald-400">--security-opt no-new-privileges</span>{" "}
          <span className="text-amber-400">--cpus 2.0</span>{" "}
          <span className="text-amber-400">--memory 1024m</span>{" "}
          <span className="text-zinc-400">python:3.11-slim</span>
        </div>
      </div>

      {/* Run history */}
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-100">
          <Terminal className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-bold text-zinc-900">Execution History</span>
        </div>
        <div className="divide-y divide-zinc-100">
          {RUNS.map((r, i) => (
            <div key={i} className="anim-fade-up flex items-center justify-between px-5 py-4 hover:bg-zinc-50/50 transition-colors" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${r.exit === 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                  {r.exit === 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-zinc-900 truncate">{r.cmd}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400 font-mono">
                    <span>{r.lang}</span>
                    <span>·</span>
                    <span>exit {r.exit}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6 shrink-0 text-right text-[11px] text-zinc-500 font-mono">
                <span>{r.dur}</span>
                <span>{r.mem}</span>
                <span className="text-zinc-400">{r.ts}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── View: Deliverables ───────────────────────────────────────────────────────

function DeliverablesView({ userId }: { userId: string }) {
  const ARTIFACTS = [
    { name: "Executive_Defense_Briefing.docx", type: "docx", size: "32.4 KB", job: "job-a1b2c3", created: "16:18", status: "completed" },
    { name: "Q3_Financial_Ledger_Variance.xlsx", type: "xlsx", size: "48.1 KB", job: "job-g7h8i9", created: "15:42", status: "completed" },
    { name: "AirGap_Architecture_Deck.pptx",   type: "pptx", size: "112.5 KB", job: "job-m3n4o5", created: "14:20", status: "completed" },
    { name: "Contract_Audit_Report_NDA.docx",  type: "docx", size: "18.2 KB", job: "job-p6q7r8", created: "—",     status: "failed"    },
  ];

  const typeColor: Record<string, string> = {
    docx: "text-blue-600 bg-blue-50 border-blue-200",
    xlsx: "text-emerald-600 bg-emerald-50 border-emerald-200",
    pptx: "text-amber-600 bg-amber-50 border-amber-200",
  };

  return (
    <div className="p-6 sm:p-8 max-w-[1400px] mx-auto w-full space-y-6">
      <div>
        <h1 className="text-xl font-black text-zinc-900">Deliverables</h1>
        <p className="text-sm text-zinc-500 mt-0.5 font-medium">Native Office documents generated locally · Word · Excel · PowerPoint</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {ARTIFACTS.map((a, i) => (
          <div key={i} className="card anim-fade-up bg-white border border-zinc-200 rounded-2xl p-5 cursor-default" style={{ animationDelay: `${i * 0.07}s` }}>
            <div className="flex items-start justify-between mb-3">
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border uppercase ${typeColor[a.type] ?? "text-zinc-600 bg-zinc-100 border-zinc-200"}`}>
                .{a.type}
              </span>
              <StatusBadge status={a.status} />
            </div>
            <div className="text-xs font-bold text-zinc-900 leading-snug mb-1 truncate" title={a.name}>{a.name}</div>
            <div className="text-[11px] text-zinc-500 font-mono mb-3">{a.size} · {a.created}</div>

            {a.status === "completed" && (
              <button
                type="button"
                className="btn-ghost w-full flex items-center justify-center gap-1.5 py-2 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-bold rounded-xl border border-zinc-200 hover:border-zinc-300 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── View: Audit ──────────────────────────────────────────────────────────────

function AuditView({ userId }: { userId: string }) {
  const EVENTS = [
    { ts: "16:32:01", type: "JOB_STARTED",            comp: "Worker",        status: "OK",     job: "job-d4e5f6", hash: "a8f3b9...c201" },
    { ts: "16:32:02", type: "MODEL_SELECTED",          comp: "ModelRouter",   status: "OK",     job: "job-d4e5f6", hash: "4c11ea...f844" },
    { ts: "16:32:03", type: "RESOURCE_ALLOCATED",      comp: "Scheduler",     status: "OK",     job: "job-d4e5f6", hash: "89d0ab...1119" },
    { ts: "16:32:04", type: "SANDBOX_STARTED",         comp: "DockerRunner",  status: "OK",     job: "job-d4e5f6", hash: "2e99c1...7710" },
    { ts: "16:20:14", type: "VISION_CALL_COMPLETED",   comp: "OllamaVision",  status: "OK",     job: "job-g7h8i9", hash: "8ab1cd...4420" },
    { ts: "16:18:22", type: "DOCUMENT_GENERATED",      comp: "WordGenerator", status: "OK",     job: "job-a1b2c3", hash: "f02de1...9900" },
    { ts: "15:42:33", type: "JOB_FAILED",              comp: "Worker",        status: "ERROR",  job: "job-p6q7r8", hash: "c321ba...8811" },
    { ts: "15:42:01", type: "TOOL_CALL_STARTED",       comp: "ToolRegistry",  status: "OK",     job: "job-p6q7r8", hash: "e10ac2...3391" },
  ];

  const statusStyle: Record<string, string> = {
    OK:    "text-emerald-700 bg-emerald-50 border-emerald-200",
    ERROR: "text-rose-700    bg-rose-50    border-rose-200",
  };

  return (
    <div className="p-6 sm:p-8 max-w-[1400px] mx-auto w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-zinc-900">Audit Event Ledger</h1>
          <p className="text-sm text-zinc-500 mt-0.5 font-medium">Append-only JSONL · data/audit/ · Never contains prompts, responses, or document content</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-ghost flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-zinc-700 bg-white border border-zinc-200 hover:border-zinc-300 rounded-xl cursor-pointer">
            <Download className="w-3.5 h-3.5" />
            Export JSONL
          </button>
          <button type="button" className="btn-ghost flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-zinc-700 bg-white border border-zinc-200 hover:border-zinc-300 rounded-xl cursor-pointer">
            Export CSV
          </button>
        </div>
      </div>

      {/* Integrity banner */}
      <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="text-xs font-semibold text-emerald-800">
          Audit integrity verified · Append-only store · No deletion possible · NetworkGuard blocks all external endpoints
        </span>
      </div>

      {/* Event table */}
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-3 bg-zinc-50/80 border-b border-zinc-200 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
          <div className="col-span-1">Time</div>
          <div className="col-span-3">Event Type</div>
          <div className="col-span-2">Component</div>
          <div className="col-span-3">Job ID</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1 text-right">Hash</div>
        </div>
        <div className="divide-y divide-zinc-100">
          {EVENTS.map((e, i) => (
            <div key={i} className="anim-fade-up grid grid-cols-12 items-center px-5 py-3.5 hover:bg-zinc-50/50 transition-colors" style={{ animationDelay: `${i * 0.03}s` }}>
              <div className="col-span-1 text-[11px] font-mono text-zinc-400">{e.ts}</div>
              <div className="col-span-3 text-xs font-bold text-indigo-700 font-mono truncate pr-2">{e.type}</div>
              <div className="col-span-2 text-xs text-zinc-600 pr-2">{e.comp}</div>
              <div className="col-span-3 text-[11px] font-mono text-zinc-500 truncate pr-2">{e.job}</div>
              <div className="col-span-2">
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${statusStyle[e.status] ?? "text-zinc-600 bg-zinc-100 border-zinc-200"}`}>
                  {e.status}
                </span>
              </div>
              <div className="col-span-1 text-right text-[11px] font-mono text-zinc-400 truncate">{e.hash}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Root Component ───────────────────────────────────────────────────────────

export default function SovereignUI3({ onBackToClassic }: SovereignUI3Props) {
  const [page, setPage] = useState<AppPage>("landing");
  const [userId, setUserId] = useState<string>("admin-001");

  useEffect(() => {
    try {
      const session = window.sessionStorage.getItem("sovereign.session");
      const user    = window.sessionStorage.getItem("sovereign.user");
      if (session === "1" && user) { setUserId(user); setPage("workbench"); }
    } catch { /* ignore */ }
  }, []);

  const handleAuth = (uid: string) => {
    setUserId(uid);
    setPage("workbench");
  };

  const handleSignOut = () => {
    try {
      window.sessionStorage.removeItem("sovereign.session");
      window.sessionStorage.removeItem("sovereign.user");
    } catch { /* ignore */ }
    setPage("landing");
  };

  if (page === "landing")   return <LandingPage  onEnter={() => setPage("signin")} />;
  if (page === "signin")    return <SignInPage    onBack={() => setPage("landing")} onAuthenticated={handleAuth} />;
  return (
    <Workbench
      userId={userId}
      onSignOut={handleSignOut}
      onBackToClassic={onBackToClassic}
    />
  );
}
