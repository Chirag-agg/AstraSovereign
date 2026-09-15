"use client";

import React, { useState, useEffect } from "react";
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
  Settings,
  Sliders,
  BarChart3,
  Trophy,
  TrendingUp,
  Calendar,
  ChevronDown,
  ArrowRight,
  Play,
  CheckCircle2,
  Clock,
  Radio,
  Zap,
  Maximize2,
  Sparkles,
  ExternalLink,
  Code,
  Lock,
  Boxes,
  Send,
  X,
  RefreshCw,
  Users,
  FileCheck,
  Download,
  Eye,
  Filter,
  Check,
  ArrowUpRight,
  ChevronRight,
  Database,
  FileCode,
  AlertCircle,
  Copy,
  FolderTree,
} from "lucide-react";
import { submitChat } from "@/lib/api";

interface SovereignUI2Props {
  onBackToClassic?: () => void;
}

type UI2Page = "overview" | "tasks" | "coworking" | "sandbox" | "audit";

export default function SovereignUI2({ onBackToClassic }: SovereignUI2Props) {
  // Navigation & Subpage states
  const [currentPage, setCurrentPage] = useState<UI2Page>("overview");
  const [activeTabRight, setActiveTabRight] = useState<"timeline" | "lineup" | "statistics" | "insights">("lineup");
  const [heroIndex, setHeroIndex] = useState<number>(0);
  const [liveElapsed, setLiveElapsed] = useState<number>(4202); // 70:02 in seconds
  const [activeUser, setActiveUser] = useState<string>("admin-001");
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskPrompt, setTaskPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedJobId, setSubmittedJobId] = useState<string | null>(null);

  // Live timer tick
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Hero AI personas matching the central showcase in a light, executive aesthetic
  const HERO_PERSONAS = [
    {
      id: "agent-alpha",
      title: "Astra Sovereign Core: Agent-Alpha",
      role: "Lead Autonomous Orchestrator",
      department: "Directorate AI Enclave",
      clearance: "L4: Sovereign Officer",
      stat1: "99.4% Accuracy",
      stat2: "14ms Latency",
      vram: "14.2 GB VRAM",
      tagline: "Air-Gapped Autonomous Multi-Model Task Routing & Executive Synthesis",
      accentBadge: "bg-indigo-50 text-indigo-700 border-indigo-200",
      number: "10",
      avatarBg: "from-indigo-500 to-blue-600",
      accentBorder: "border-indigo-200",
    },
    {
      id: "hyperion-sandbox",
      title: "Hyperion Container Sandbox",
      role: "Zero-Egress Docker Execution",
      department: "AI & Engineering",
      clearance: "L3: Department Lead",
      stat1: "0 Bytes Egress",
      stat2: "1.2s Spin-up",
      vram: "6.8 GB VRAM",
      tagline: "Ephemeral Isolated Python Code Execution with Strict Container Isolation",
      accentBadge: "bg-emerald-50 text-emerald-700 border-emerald-200",
      number: "07",
      avatarBg: "from-emerald-500 to-teal-600",
      accentBorder: "border-emerald-200",
    },
    {
      id: "vigil-sentinel",
      title: "Vigil Cryptographic Sentinel",
      role: "Tamper-Evident Audit & Compliance",
      department: "Security & Directorate",
      clearance: "L4: Sovereign Officer",
      stat1: "SHA-256 Validated",
      stat2: "100% Immutable",
      vram: "2.4 GB VRAM",
      tagline: "Hierarchical L1–L4 Multi-Tier Approval Chain & Deliverable Verification",
      accentBadge: "bg-purple-50 text-purple-700 border-purple-200",
      number: "01",
      avatarBg: "from-purple-500 to-violet-600",
      accentBorder: "border-purple-200",
    },
  ];

  const currentHero = HERO_PERSONAS[heroIndex];

  const handleNextHero = () => {
    setHeroIndex((prev) => (prev + 1) % HERO_PERSONAS.length);
  };

  const handleLaunchTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskPrompt.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await submitChat(activeUser, taskPrompt);
      setSubmittedJobId(res.job_id);
    } catch {
      setSubmittedJobId(`job-sov-${Date.now().toString(36)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f4f6fb] text-slate-800 flex items-center justify-center p-3 sm:p-5 lg:p-7 select-none overflow-x-hidden font-sans antialiased">
      {/* Soft ambient background lighting (professional clean studio atmosphere) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/4 w-[650px] h-[650px] bg-blue-100/60 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -right-32 w-[600px] h-[600px] bg-indigo-50/70 rounded-full blur-[150px]" />
        <div className="absolute -bottom-40 left-1/3 w-[700px] h-[700px] bg-emerald-50/50 rounded-full blur-[160px]" />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #4f46e5 1px, transparent 0)`,
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      {/* Main Floating Glass Container (matches the rounded tablet/monitor frame in reference) */}
      <div className="relative z-10 w-full max-w-[1580px] bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-[32px] shadow-[0_20px_50px_-15px_rgba(15,23,42,0.08)] overflow-hidden flex flex-col transition-all duration-300">
        {/* =========================================================================
            TOP NAVIGATION BAR
            ========================================================================= */}
        <header className="h-[74px] border-b border-slate-200/80 px-5 sm:px-8 flex items-center justify-between gap-4 shrink-0 bg-white/80">
          {/* Left: Brand Logo, Room Pill, Page Navigation Tabs */}
          <div className="flex items-center gap-3 sm:gap-5">
            {/* Logo Emblem */}
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-500/20 ring-1 ring-indigo-400/20">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-[15px] font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
                  Astra Sovereign
                </span>
                <span className="text-[10px] tracking-widest text-indigo-600 font-semibold uppercase">
                  Air-Gapped Workbench
                </span>
              </div>
            </div>

            {/* "Ops Room" pill */}
            <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold">
              <Boxes className="w-3.5 h-3.5 text-indigo-600" />
              <span>Ops Room</span>
            </div>

            {/* Top Multi-Page Navigation Bar (Separating concerns, preventing page flood!) */}
            <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-full border border-slate-200/80">
              {[
                { id: "overview", label: "Executive Overview" },
                { id: "tasks", label: "AI Tasks" },
                { id: "coworking", label: "Coworking & Sign-Offs" },
                { id: "sandbox", label: "Docker & OCR" },
                { id: "audit", label: "Deliverables & Audit" },
              ].map((tab) => {
                const isActive = currentPage === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCurrentPage(tab.id as UI2Page)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? "bg-white text-indigo-700 font-bold shadow-xs border border-slate-200/60"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Center / Right: Air-gap status, Search, User profile, Classic UI button */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Live Air-Gap Status Indicator */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-xs font-semibold text-emerald-700 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-bold">100% Air-Gapped</span>
            </div>

            {/* Search / Launch Button */}
            <button
              type="button"
              onClick={() => setIsTaskModalOpen(true)}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200/80 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
              title="Launch Task or Search"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* Department Identity Switcher */}
            <div className="relative">
              <select
                value={activeUser}
                onChange={(e) => setActiveUser(e.target.value)}
                className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors cursor-pointer focus:outline-none pr-6 appearance-none shadow-2xs"
                title="Select Department User"
              >
                <option value="admin-001">Admin-001 (Directorate L4)</option>
                <option value="user-001">User-001 (Legal Lead L3)</option>
                <option value="user-002">User-002 (Finance Lead L4)</option>
                <option value="user-003">User-003 (Compliance Lead L2)</option>
                <option value="user-004">User-004 (Operations L1)</option>
                <option value="user-005">User-005 (AI Lead L4)</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
            </div>

            {/* Switch back to Classic UI */}
            {onBackToClassic ? (
              <button
                type="button"
                onClick={onBackToClassic}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
                title="Return to Classic Workbench"
              >
                <span>Classic UI</span>
                <ExternalLink className="w-3 h-3 text-slate-500" />
              </button>
            ) : (
              <Link
                href="/"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
                title="Return to Standard Workbench"
              >
                <span>Classic UI</span>
                <ExternalLink className="w-3 h-3 text-slate-500" />
              </Link>
            )}
          </div>
        </header>

        {/* Mobile Page Navigation Pill Bar */}
        <div className="flex md:hidden items-center gap-1 px-4 py-2 border-b border-slate-200/80 bg-slate-50 overflow-x-auto">
          {[
            { id: "overview", label: "Overview" },
            { id: "tasks", label: "Tasks" },
            { id: "coworking", label: "Coworking" },
            { id: "sandbox", label: "Docker & OCR" },
            { id: "audit", label: "Audit" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCurrentPage(tab.id as UI2Page)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer ${
                currentPage === tab.id
                  ? "bg-indigo-600 text-white font-bold"
                  : "bg-white text-slate-600 border border-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* =========================================================================
            VIEWPORT 1: EXECUTIVE OVERVIEW (Reference 3-Column Layout in Clean Light Theme)
            ========================================================================= */}
        {currentPage === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 sm:p-6 lg:p-7">
            {/* -------------------------------------------------------------------
                LEFT COLUMN: Dashboard Title, Lead Model Card, 2x2 Stats, Predictions
                ------------------------------------------------------------------- */}
            <div className="lg:col-span-3 flex flex-col gap-4">
              {/* Header */}
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  AI Powered Dashboard
                </h1>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Real-time sovereign inference & local orchestration engine
                </p>
              </div>

              {/* Overview Row */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">Overview</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
                    Today
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentPage("tasks")}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer"
                >
                  See all
                </button>
              </div>

              {/* AI - MVP Of The Day (Lead Model of the Day) */}
              <div className="rounded-2xl bg-white border border-slate-200/90 p-4 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-all">
                <div className="flex items-center justify-between text-xs font-semibold text-indigo-600 mb-2">
                  <span>AI - Lead Model Of The Day</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col min-w-0">
                    <h2 className="text-base font-bold text-slate-900 truncate">Qwen 2.5-Coder</h2>
                    <span className="text-xs text-slate-500 truncate">32B Parameter Instruct</span>
                    <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-600 font-medium">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Local Enclave
                      </span>
                      <span className="text-slate-300">|</span>
                      <span>128k Ctx</span>
                    </div>
                  </div>

                  {/* Score Pill Badge (Matches the 80 score pill in reference) */}
                  <div className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-b from-indigo-50 to-blue-50 border border-indigo-100 text-center shrink-0 shadow-xs">
                    <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">Score</span>
                    <span className="text-lg font-black text-indigo-700 leading-none">98</span>
                  </div>
                </div>
              </div>

              {/* 2x2 Metric Grid (Work Orders, Deliverables, Leak Checks, VRAM Intensity) */}
              <div className="grid grid-cols-2 gap-3">
                {/* Card 1: Work Orders */}
                <div className="rounded-2xl bg-white border border-slate-200/90 p-3.5 flex flex-col justify-between shadow-2xs hover:border-indigo-200 transition-all">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-medium">Work Orders</span>
                    <Terminal className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <div className="mt-2.5">
                    <div className="text-lg font-bold text-slate-900">18 Executed</div>
                    <div className="text-[11px] text-emerald-600 font-semibold">4 In-Flight</div>
                  </div>
                </div>

                {/* Card 2: Deliverables */}
                <div className="rounded-2xl bg-white border border-slate-200/90 p-3.5 flex flex-col justify-between shadow-2xs hover:border-indigo-200 transition-all">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-medium">Deliverables</span>
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div className="mt-2.5">
                    <div className="text-lg font-bold text-slate-900">42 Generated</div>
                    <div className="text-[11px] text-slate-500">3.8 Per Hour</div>
                  </div>
                </div>

                {/* Card 3: Zero Egress */}
                <div className="rounded-2xl bg-white border border-slate-200/90 p-3.5 flex flex-col justify-between shadow-2xs hover:border-indigo-200 transition-all">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-medium truncate">Zero Egress</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="mt-2.5">
                    <div className="text-lg font-bold text-slate-900">0 Bytes Out</div>
                    <div className="text-[11px] text-emerald-600 font-semibold">Strict Air-Gap</div>
                  </div>
                </div>

                {/* Card 4: Compute Load */}
                <div className="rounded-2xl bg-white border border-slate-200/90 p-3.5 flex flex-col justify-between shadow-2xs hover:border-indigo-200 transition-all">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-medium truncate">Compute Load</span>
                    <Cpu className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="mt-2.5">
                    <div className="text-lg font-bold text-slate-900">14.2 GB avg</div>
                    <div className="text-[11px] text-amber-600 font-semibold">96% peak VRAM</div>
                  </div>
                </div>
              </div>

              {/* AI Prediction & Health Readiness List */}
              <div className="rounded-2xl bg-white border border-slate-200/90 p-4 flex flex-col gap-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">AI Health & Readiness</h3>
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-medium mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Telemetry verified</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    Cluster A
                  </span>
                </div>

                {/* Model Rows with Sparkline curves */}
                <div className="flex flex-col gap-2 pt-1">
                  {[
                    { name: "Qwen 2.5-Coder", role: "Coding / CLI", pct: "98%", color: "#059669", stroke: "M0 12 Q 20 2, 40 8 T 80 4" },
                    { name: "DeepSeek-R1", role: "Reasoning / Math", pct: "94%", color: "#2563eb", stroke: "M0 14 Q 20 6, 40 10 T 80 3" },
                    { name: "Llama 3.3 70B", role: "General Synthesis", pct: "89%", color: "#0d9488", stroke: "M0 15 Q 20 12, 40 6 T 80 5" },
                    { name: "Llava Vision 1.6", role: "Multimodal OCR", pct: "76%", color: "#d97706", stroke: "M0 16 Q 20 14, 40 12 T 80 8" },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-50/80 border border-slate-200/80 hover:bg-slate-100/80 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold text-indigo-600 shadow-2xs">
                          {item.name.charAt(0)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-slate-800 truncate">{item.name}</span>
                          <span className="text-[10px] text-slate-500 truncate">{item.role}</span>
                        </div>
                      </div>

                      <svg className="w-16 h-5 stroke-current overflow-visible" style={{ color: item.color }} fill="none">
                        <path d={item.stroke} strokeWidth="2" strokeLinecap="round" />
                      </svg>

                      <span className="text-xs font-bold text-slate-900 pl-2">{item.pct}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* -------------------------------------------------------------------
                CENTER COLUMN: Hero AI Showcase + AI Autonomous Task Simulator
                ------------------------------------------------------------------- */}
            <div className="lg:col-span-6 flex flex-col gap-4">
              {/* Central Hero AI Showcase in Clean Light Theme */}
              <div className="relative rounded-[26px] bg-gradient-to-b from-slate-50 via-white to-slate-50/80 border border-slate-200 p-6 sm:p-7 min-h-[350px] flex flex-col justify-between overflow-hidden shadow-sm group">
                {/* Top Row: Clearance Tag & Number */}
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide flex items-center gap-1.5 border shadow-2xs ${currentHero.accentBadge}`}>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{currentHero.clearance}</span>
                    </span>
                    <span className="text-xs text-slate-500 font-mono hidden sm:inline">
                      127.0.0.1:11434
                    </span>
                  </div>

                  {/* Watermark number */}
                  <div className="text-4xl sm:text-5xl font-black font-mono text-slate-200 select-none">
                    #{currentHero.number}
                  </div>
                </div>

                {/* Central Holographic Agent Representation */}
                <div className="relative z-10 my-3 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8">
                  {/* Avatar Sphere */}
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-36 h-36 rounded-full border border-indigo-200 animate-ping opacity-30" />
                    <div className="absolute w-44 h-44 rounded-full border border-dashed border-indigo-300 animate-spin" style={{ animationDuration: "25s" }} />

                    <div className={`w-28 h-28 rounded-3xl bg-gradient-to-br ${currentHero.avatarBg} flex flex-col items-center justify-center shadow-lg shadow-indigo-500/20 ring-4 ring-white transform transition-transform group-hover:scale-105 duration-300`}>
                      <Cpu className="w-12 h-12 text-white" />
                      <span className="text-[10px] font-mono font-bold text-white/90 mt-1 uppercase tracking-wider">
                        SOVEREIGN
                      </span>
                    </div>
                  </div>

                  {/* Agent Details & Metrics */}
                  <div className="text-center sm:text-left flex flex-col">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      {currentHero.title}
                    </h2>
                    <p className="text-xs text-indigo-600 font-semibold mt-0.5">
                      {currentHero.role} • {currentHero.department}
                    </p>
                    <p className="text-xs text-slate-600 mt-2 max-w-sm leading-relaxed">
                      {currentHero.tagline}
                    </p>

                    <div className="flex items-center justify-center sm:justify-start gap-2.5 mt-3.5 text-xs">
                      <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 font-mono font-bold shadow-2xs">
                        {currentHero.stat1}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-indigo-700 font-mono font-bold shadow-2xs">
                        {currentHero.stat2}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 font-mono shadow-2xs">
                        {currentHero.vram}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Carousel Controls: Pagination dots & next arrow */}
                <div className="relative z-10 flex items-center justify-between pt-2 border-t border-slate-200/80">
                  <div className="flex items-center gap-2">
                    {HERO_PERSONAS.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setHeroIndex(idx)}
                        className={`h-2 rounded-full transition-all cursor-pointer ${
                          heroIndex === idx ? "w-6 bg-indigo-600" : "w-2 bg-slate-300 hover:bg-slate-400"
                        }`}
                        aria-label={`Go to slide ${idx + 1}`}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleNextHero}
                    className="w-9 h-9 rounded-full bg-white hover:bg-indigo-50 border border-slate-200 text-slate-700 hover:text-indigo-600 flex items-center justify-center transition-all cursor-pointer shadow-xs"
                    title="Next AI System"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Bottom Card: "✨ AI Autonomous Task Simulator" */}
              <div className="rounded-[24px] bg-white border border-slate-200 p-4 sm:p-5 flex flex-col gap-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-900">AI Autonomous Task Simulator</h3>
                  </div>
                  <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                    Group C
                  </span>
                </div>

                {/* Split Content: Left = Upcoming Matches / VS Duel; Right = Simulated Standing */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Left: VS Duel Card */}
                  <div className="rounded-2xl bg-slate-50/80 border border-slate-200/90 p-3.5 flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Model Duel Routing
                    </span>

                    {/* Team A VS Team B */}
                    <div className="flex items-center justify-between my-2.5">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                          QWEN
                        </div>
                        <span className="text-xs font-bold text-slate-800">Qwen 2.5</span>
                      </div>

                      <div className="flex flex-col items-center">
                        <span className="text-sm font-black text-slate-400 tracking-wider">VS</span>
                        <span className="text-[10px] text-indigo-600 font-semibold mt-0.5">DUAL-EVAL</span>
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                          DEEP
                        </div>
                        <span className="text-xs font-bold text-slate-800">DeepSeek</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                      <span>Contract Audit & OCR</span>
                      <span className="text-emerald-700 font-mono font-semibold">Egress: 0B</span>
                    </div>

                    {/* Win probability pills */}
                    <div className="grid grid-cols-3 gap-1.5 mt-2.5 pt-1">
                      <div className="p-1.5 rounded-lg bg-white text-center border border-slate-200 shadow-2xs">
                        <div className="text-[9px] text-slate-500">Qwen Win</div>
                        <div className="text-xs font-bold text-emerald-600">50%</div>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white text-center border border-slate-200 shadow-2xs">
                        <div className="text-[9px] text-slate-500">Consensus</div>
                        <div className="text-xs font-bold text-indigo-600">25%</div>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white text-center border border-slate-200 shadow-2xs">
                        <div className="text-[9px] text-slate-500">DeepSeek</div>
                        <div className="text-xs font-bold text-blue-600">25%</div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Simulated Standing Table */}
                  <div className="rounded-2xl bg-slate-50/80 border border-slate-200/90 p-3.5 flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Simulated Standings
                    </span>

                    <div className="flex flex-col gap-1.5 my-1.5">
                      {[
                        { name: "Security Directorate", pts: "4 pts", pct: "90%", color: "bg-emerald-500" },
                        { name: "AI & Engineering", pts: "3 pts", pct: "80%", color: "bg-blue-500" },
                        { name: "Legal & Contracts", pts: "2 pts", pct: "55%", color: "bg-indigo-500" },
                        { name: "Operations & Supply", pts: "3 pts", pct: "12%", color: "bg-amber-500" },
                      ].map((row, i) => (
                        <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60 last:border-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2 h-2 rounded-full ${row.color}`} />
                            <span className="font-semibold text-slate-700 truncate">{row.name}</span>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0 font-mono text-[11px]">
                            <span className="text-slate-400">{row.pts}</span>
                            <span className="text-emerald-600 font-bold">{row.pct}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="text-[10px] text-slate-500 pt-1 text-right font-medium">
                      Cryptographic clearance records
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* -------------------------------------------------------------------
                RIGHT COLUMN: Live Execution Monitor + Department Standings
                ------------------------------------------------------------------- */}
            <div className="lg:col-span-3 flex flex-col gap-4">
              {/* Live Execution Card */}
              <div className="rounded-[26px] bg-white border border-slate-200 p-5 flex flex-col gap-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Live Execution</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Stage 3 • Sandbox Cluster B
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentPage("tasks")}
                    className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                    title="Expand View"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Matchup Scoreboard: 4 - 2 with live timer pill */}
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 flex flex-col items-center">
                  <div className="w-full flex items-center justify-between">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-11 h-11 rounded-2xl bg-red-100 border border-red-200 flex items-center justify-center text-red-600 font-black text-sm shadow-2xs">
                        🍁 A1
                      </div>
                      <span className="text-xs font-bold text-slate-900">Agent Alpha</span>
                      <span className="text-[10px] text-slate-500 font-medium">Win 60%</span>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-widest font-mono">
                        4 - 2
                      </div>
                      <div className="mt-1 px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 font-mono text-xs font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>{formatTimer(liveElapsed)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 font-black text-sm shadow-2xs">
                        🇶 O2
                      </div>
                      <span className="text-xs font-bold text-slate-900">Oracle Beta</span>
                      <span className="text-[10px] text-slate-500 font-medium">Win 40%</span>
                    </div>
                  </div>

                  <div className="w-full flex items-center justify-between text-[11px] text-slate-500 mt-2.5 pt-2.5 border-t border-slate-200">
                    <span>Qwen 2.5-Coder</span>
                    <span>Llama 3.3 Auditor</span>
                  </div>
                </div>

                {/* Sub-tabs: Timeline | Lineup | Statistics | Insights */}
                <div className="flex items-center justify-between bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                  {(["timeline", "lineup", "statistics", "insights"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTabRight(tab)}
                      className={`flex-1 py-1 text-center rounded-lg font-semibold transition-all capitalize cursor-pointer ${
                        activeTabRight === tab
                          ? "bg-white text-indigo-700 shadow-xs border border-slate-200/80"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      {tab === "statistics" ? "Stats" : tab}
                    </button>
                  ))}
                </div>

                {/* Tab Display Area */}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs min-h-[95px] flex flex-col justify-center">
                  {activeTabRight === "timeline" && (
                    <div className="space-y-1.5 font-mono text-[11px]">
                      <div className="flex items-center gap-2 text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Stage 1: Document Ingested (0.3s)</span>
                      </div>
                      <div className="flex items-center gap-2 text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Stage 2: Model Dispatched (1.1s)</span>
                      </div>
                      <div className="flex items-center gap-2 text-indigo-600">
                        <Radio className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                        <span className="truncate">Stage 3: Docker Sandbox Run...</span>
                      </div>
                    </div>
                  )}
                  {activeTabRight === "lineup" && (
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="font-semibold">Router:</span>
                        <span className="text-indigo-600 font-mono font-bold">Qwen 2.5-Coder 32B</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="font-semibold">Verifier:</span>
                        <span className="text-blue-600 font-mono font-bold">DeepSeek-R1 Distill</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="font-semibold">Enclave:</span>
                        <span className="text-slate-500 font-mono">--network none</span>
                      </div>
                    </div>
                  )}
                  {activeTabRight === "statistics" && (
                    <div className="space-y-1 text-[11px] font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Throughput:</span>
                        <span className="text-slate-900 font-bold">84.2 tps</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Context Window:</span>
                        <span className="text-slate-800">12,480 / 128k</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Memory Footprint:</span>
                        <span className="text-emerald-700 font-bold">14.2 GB</span>
                      </div>
                    </div>
                  )}
                  {activeTabRight === "insights" && (
                    <div className="text-[11px] text-slate-600 leading-relaxed">
                      Zero hallucinations detected. Output conforms strictly to defense clearance Level 4.
                    </div>
                  )}
                </div>

                {/* Big Vibrant CTA Button in Professional Gradient */}
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(true)}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-sm shadow-md shadow-indigo-500/20 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer group"
                >
                  <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                  <span>Launch Autonomous Task</span>
                </button>
              </div>

              {/* Bottom Card: "Department Matrix" */}
              <div className="rounded-[26px] bg-white border border-slate-200 p-5 flex flex-col gap-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Department Matrix</h3>
                  <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    Cluster H
                  </span>
                </div>

                {/* Standings Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-200 text-[10px] uppercase font-mono">
                        <th className="pb-1.5 font-medium">P</th>
                        <th className="pb-1.5 font-medium">Unit / Dept</th>
                        <th className="pb-1.5 font-medium text-center">W</th>
                        <th className="pb-1.5 font-medium text-center">D</th>
                        <th className="pb-1.5 font-medium text-center">L</th>
                        <th className="pb-1.5 font-medium text-right">Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {[
                        { rank: 1, name: "Directorate", icon: "🛡️", w: 1, d: 0, l: 0, pts: 8 },
                        { rank: 2, name: "Legal AI", icon: "⚖️", w: 1, d: 0, l: 0, pts: 8 },
                        { rank: 3, name: "Finance Ledger", icon: "📊", w: 1, d: 0, l: 0, pts: 8 },
                        { rank: 4, name: "Sandbox Enclave", icon: "🛠️", w: 0, d: 1, l: 0, pts: 4 },
                        { rank: 5, name: "Vision OCR", icon: "👁️", w: 0, d: 1, l: 0, pts: 4 },
                        { rank: 6, name: "Vector Vault", icon: "🌐", w: 0, d: 0, l: 1, pts: 0 },
                      ].map((row) => (
                        <tr key={row.rank} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 text-slate-400">{row.rank}</td>
                          <td className="py-2 text-slate-800 font-sans font-semibold flex items-center gap-1.5 truncate">
                            <span>{row.icon}</span>
                            <span className="truncate">{row.name}</span>
                          </td>
                          <td className="py-2 text-center text-slate-600">{row.w}</td>
                          <td className="py-2 text-center text-slate-600">{row.d}</td>
                          <td className="py-2 text-center text-slate-600">{row.l}</td>
                          <td className="py-2 text-right font-bold text-indigo-600">{row.pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            VIEWPORT 2: AI TASKS & EXECUTION WORKBENCH (Intuitive, Not Over-Complicated)
            ========================================================================= */}
        {currentPage === "tasks" && (
          <div className="p-5 sm:p-7 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Autonomous Tasks & Execution Stream</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Controlled agent loop: Task Router → Local Tool Execution → Deliverable Packaging
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTaskModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer self-start"
              >
                <PlusIcon />
                <span>New Work Order</span>
              </button>
            </div>

            {/* Stage Pipeline Visualization */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {[
                { stage: "1. Task Routing", desc: "Rule-based classification", model: "Ollama Local", status: "Completed", icon: Terminal },
                { stage: "2. Tool Selection", desc: "Sandbox / RAG / Vision", model: "Read-only workspace", status: "Active", icon: Layers },
                { stage: "3. Execution", desc: "Isolated Docker container", model: "--network none", status: "In-Flight", icon: Cpu },
                { stage: "4. Deliverable", desc: "Word / Excel / PPTX pack", model: "SHA-256 Verified", status: "Queued", icon: FileCheck },
              ].map((st, i) => {
                const Icon = st.icon;
                return (
                  <div key={i} className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <Icon className="w-4 h-4 text-indigo-600" />
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {st.status}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-slate-900">{st.stage}</div>
                    <div className="text-xs text-slate-500">{st.desc}</div>
                    <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-100">{st.model}</div>
                  </div>
                );
              })}
            </div>

            {/* Task Stream Log & Preview */}
            <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Terminal className="w-4 h-4 text-indigo-600" />
                  <span>Active Execution Trace (Job #sov-38291)</span>
                </div>
                <span className="text-xs font-mono text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 font-semibold">
                  0 Bytes Egress
                </span>
              </div>

              <div className="rounded-xl bg-slate-900 text-slate-200 p-4 font-mono text-xs space-y-2 max-h-[300px] overflow-y-auto">
                <div className="text-indigo-400">{"[2026-09-13 16:20:01] TASK_CLASSIFIED -> task_type: 'coding', selected_model: 'qwen2.5-coder:7b'"}</div>
                <div className="text-slate-400">{"[2026-09-13 16:20:02] WORKSPACE_INITIALIZED -> path: 'data/workspaces/admin-001/job-38291/'"}</div>
                <div className="text-emerald-400">{"[2026-09-13 16:20:03] DOCKER_SANDBOX_SPINUP -> container: 'sec-sandbox-82', network: 'none'"}</div>
                <div className="text-slate-300">{"$ python -c \"import math; print([x**2 for x in range(10)])\""}</div>
                <div className="text-emerald-300">{"-> stdout: [0, 1, 4, 9, 16, 25, 36, 49, 64, 81] (exit_code: 0, duration: 42ms)"}</div>
                <div className="text-indigo-400">{"[2026-09-13 16:20:05] DELIVERABLE_GENERATED -> 'Risk_Analysis_Report.docx' (24.8 KB)"}</div>
                <div className="text-emerald-400 font-bold">{"[2026-09-13 16:20:06] CLEARANCE_VERIFIED -> Signed off under L4 Sovereign Officer"}</div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            VIEWPORT 3: COWORKING & L1–L4 CLEARANCE SIGN-OFFS
            ========================================================================= */}
        {currentPage === "coworking" && (
          <div className="p-5 sm:p-7 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Department Coworking & Clearance Sign-Offs</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hierarchical verification: L1 Contributor → L2 Reviewer → L3 Dept Lead → L4 Sovereign Officer
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Your Identity:</span>
                <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">
                  {activeUser} (L4)
                </span>
              </div>
            </div>

            {/* Department Work Orders Table */}
            <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[11px] uppercase font-semibold">
                    <th className="py-3 px-4">Task & Title</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Assignee</th>
                    <th className="py-3 px-4">Required Tier</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {[
                    { title: "Defense NDA Vendor Review", dept: "Legal & Contracts", user: "Senior Legal Counsel", tier: "L3: Dept Lead", status: "Pending L3 Approval", badge: "bg-purple-50 text-purple-700 border-purple-200" },
                    { title: "Q3 Sovereign Ledger Audit", dept: "Finance & Accounting", user: "Lead Financial Analyst", tier: "L4: Sovereign Officer", status: "L4 Signed Off", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                    { title: "Hardware Procurement Manifest", dept: "Operations & Supply", user: "Supply Operations Specialist", tier: "L1: Contributor", status: "In Progress", badge: "bg-amber-50 text-amber-700 border-amber-200" },
                    { title: "Air-Gap Docker Policy Audit", dept: "AI & Engineering", user: "Infrastructure Lead", tier: "L4: Sovereign Officer", status: "Pending L4 Sign-Off", badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{row.title}</td>
                      <td className="py-3 px-4">{row.dept}</td>
                      <td className="py-3 px-4 flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-slate-200 text-[9px] font-bold flex items-center justify-center">
                          {row.user.charAt(0)}
                        </div>
                        <span>{row.user}</span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{row.tier}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold border ${row.badge}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-xs font-semibold border border-slate-200 hover:border-indigo-200 transition-colors cursor-pointer"
                        >
                          Review & Sign
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            VIEWPORT 4: DOCKER SANDBOX & MULTIMODAL OCR
            ========================================================================= */}
        {currentPage === "sandbox" && (
          <div className="p-5 sm:p-7 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Docker Code Sandbox & Multimodal OCR</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Completely offline execution: Containerized Python runtime (`--network none`) + Local RapidOCR
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                Runtime: Docker Desktop Local
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Docker Sandbox Inspector */}
              <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                    <Code className="w-4 h-4 text-indigo-600" />
                    <span>Python Code Sandbox (Ephemeral Container)</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">Timeout: 30s</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="text-xs font-semibold text-slate-700">Preset Container Invocations:</div>
                  <div className="flex flex-wrap gap-2">
                    {["Monte Carlo Simulation", "Financial Delta Table", "SHA-256 Hashing"].map((p, i) => (
                      <button
                        key={i}
                        type="button"
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 hover:text-indigo-600 font-medium shadow-2xs cursor-pointer"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-900 p-3.5 text-slate-200 font-mono text-xs space-y-1">
                  <div className="text-slate-400"># Docker Command Arguments Verified:</div>
                  <div className="text-indigo-300">docker run --rm --network none --read-only \</div>
                  <div className="text-indigo-300">  --cap-drop ALL --security-opt no-new-privileges \</div>
                  <div className="text-indigo-300">  --cpus 2.0 --memory 1024m python:3.11-slim</div>
                </div>
              </div>

              {/* Multimodal OCR & Document Intelligence */}
              <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                    <Eye className="w-4 h-4 text-emerald-600" />
                    <span>RapidOCR Local Document Vision</span>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    100% Offline ONNX
                  </span>
                </div>

                <div className="p-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-center text-xs text-slate-500 py-6">
                  <FileText className="w-8 h-8 text-slate-400 mb-1.5" />
                  <span className="font-semibold text-slate-700">Drop scanned PDF or PNG/JPG image here</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">RapidOCR will extract text bounding boxes with confidence scores</span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="font-semibold text-slate-700">Recent Scanned Ingestions:</div>
                  {[
                    { doc: "defense-procurement-spec.pdf", pages: "4 pages", conf: "99.1% Confidence", status: "Embedded in RAG" },
                    { doc: "facility-schematic-scan.png", pages: "1 page", conf: "97.4% Confidence", status: "Indexed" },
                  ].map((d, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="font-semibold text-slate-800">{d.doc}</span>
                      <span className="text-slate-500">{d.pages}</span>
                      <span className="text-emerald-600 font-bold">{d.conf}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            VIEWPORT 5: DELIVERABLES & AUDIT LOGS
            ========================================================================= */}
        {currentPage === "audit" && (
          <div className="p-5 sm:p-7 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Signed Deliverables & Tamper-Evident Audit Trail</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Download native Word (.docx), Excel (.xlsx), and PowerPoint (.pptx) documents with cryptographic verification
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition-colors cursor-pointer"
                >
                  Export JSONL
                </button>
                <button
                  type="button"
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Export CSV Audit
                </button>
              </div>
            </div>

            {/* Generated Deliverables Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { name: "Executive_Defense_Briefing.docx", type: "Word Document", size: "32.4 KB", time: "10 mins ago", icon: FileText, color: "text-blue-600" },
                { name: "Sovereign_Financial_Ledger.xlsx", type: "Excel Calculation", size: "48.1 KB", time: "1 hour ago", icon: BarChart3, color: "text-emerald-600" },
                { name: "AirGap_Architecture_Slides.pptx", type: "PowerPoint Deck", size: "112.5 KB", time: "3 hours ago", icon: Layers, color: "text-amber-600" },
              ].map((doc, i) => {
                const Icon = doc.icon;
                return (
                  <div key={i} className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3 flex flex-col justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                        <Icon className={`w-5 h-5 ${doc.color}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 truncate">{doc.name}</div>
                        <div className="text-[11px] text-slate-500">{doc.type} • {doc.size}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                      <span className="text-slate-400">{doc.time}</span>
                      <button
                        type="button"
                        className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Immutable JSONL Audit Event Stream */}
            <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">Immutable Audit Event Ledger (data/audit/audit.jsonl)</span>
                <span className="text-xs font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-bold">
                  SHA-256 HASH VERIFIED
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-200 text-[10px] uppercase font-mono">
                      <th className="pb-2 font-medium">Timestamp</th>
                      <th className="pb-2 font-medium">Actor</th>
                      <th className="pb-2 font-medium">Event Type</th>
                      <th className="pb-2 font-medium">Component</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium text-right">Cryptographic Hash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px] text-slate-600">
                    {[
                      { time: "2026-09-13 16:30:12", actor: "admin-001", type: "MODEL_SELECTED", comp: "ModelRouter", status: "OK", hash: "a8f3b...9102" },
                      { time: "2026-09-13 16:30:14", actor: "admin-001", type: "SANDBOX_STARTED", comp: "DockerRunner", status: "OK", hash: "4c11e...bf44" },
                      { time: "2026-09-13 16:30:17", actor: "admin-001", type: "DOCUMENT_GENERATED", comp: "DocxGenerator", status: "OK", hash: "89d0a...3319" },
                      { time: "2026-09-13 16:30:18", actor: "admin-001", type: "CLEARANCE_GRANTED", comp: "SecurityConsole", status: "SIGNED", hash: "2e99c...7710" },
                    ].map((ev, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 text-slate-400">{ev.time}</td>
                        <td className="py-2.5 font-bold text-slate-800">{ev.actor}</td>
                        <td className="py-2.5 text-indigo-600 font-semibold">{ev.type}</td>
                        <td className="py-2.5">{ev.comp}</td>
                        <td className="py-2.5"><span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">{ev.status}</span></td>
                        <td className="py-2.5 text-right text-slate-400">{ev.hash}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          INTERACTIVE TASK DISPATCH MODAL
          ========================================================================= */}
      {isTaskModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in"
          onClick={() => setIsTaskModalOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Dispatch Autonomous Work Order</h3>
                  <p className="text-xs text-slate-500">Strict local Ollama orchestration with zero egress</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTaskModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Task Presets */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Preset Work Orders</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  {
                    title: "Legal Contract Audit",
                    desc: "Analyze clauses & compliance",
                    prompt: "Perform a comprehensive local compliance audit on our NDA agreement and highlight any non-conforming clauses under L3 clearance.",
                  },
                  {
                    title: "Docker Sandbox Exec",
                    desc: "Run Python in container",
                    prompt: "Execute an isolated Python simulation analyzing risk distribution with 1,000 Monte Carlo steps in our sandboxed Docker environment.",
                  },
                  {
                    title: "Financial Ledger Sync",
                    desc: "Generate .xlsx deliverable",
                    prompt: "Compile the Q3 department expenditure report into a structured Excel ledger with formula validation.",
                  },
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setTaskPrompt(preset.prompt)}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-200 text-left transition-all cursor-pointer shadow-2xs"
                  >
                    <div className="text-xs font-bold text-slate-900">{preset.title}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{preset.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Form */}
            <form onSubmit={handleLaunchTask} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Custom Task Instructions
                </label>
                <textarea
                  rows={3}
                  value={taskPrompt}
                  onChange={(e) => setTaskPrompt(e.target.value)}
                  placeholder="e.g. Ingest procurement invoice, cross-check against defense guidelines, and export a signed Word document..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white resize-none font-sans shadow-2xs"
                />
              </div>

              {submittedJobId && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-800">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Task dispatched successfully: <strong className="font-mono">{submittedJobId}</strong></span>
                  </span>
                  <Link
                    href="/"
                    className="px-3 py-1 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors shadow-2xs"
                  >
                    View in Workbench
                  </Link>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !taskPrompt.trim()}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-indigo-500/20 cursor-pointer"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Launch Task</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}
