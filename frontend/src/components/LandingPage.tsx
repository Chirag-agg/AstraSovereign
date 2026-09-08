"use client";

import React, { useState } from "react";
import { AstraLogo } from "./core/AstraLogo";
import {
  ShieldCheck,
  WifiOff,
  Cpu,
  Terminal,
  FileText,
  Users2,
  Lock,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Layers,
  Archive,
  Workflow,
  ScrollText,
  Server,
  Download,
  Building2,
  Zap,
  Code,
  Activity,
  Check,
  Play,
  RotateCcw,
} from "lucide-react";

interface LandingPageProps {
  onEnter: () => void;
}

type SubsystemTab = "sentinel" | "sandbox" | "router" | "audit";
type PromptScenario = "audit" | "contract" | "code";

interface SimResult {
  route: string;
  latency: string;
  egress: string;
  badge: string;
  text: string;
}

const SIM_SCENARIOS: Record<PromptScenario, SimResult> = {
  audit: {
    route: "Deterministic Rule ──► llama3:8b (SecOps Policy Model)",
    latency: "118 ms",
    egress: "0 bytes (blocked)",
    badge: "VERIFIED LOCAL",
    text: "[SECURITY CLEARANCE CONFIRMED] Container runtime inspection complete. Network sockets bound exclusively to local loopback 127.0.0.1. Zero external egress detected across all active worker threads. SHA-256 audit ledger signed.",
  },
  contract: {
    route: "RapidOCR Local Vision ──► llama3:8b + Encrypted Vector RAG",
    latency: "240 ms",
    egress: "0 bytes (blocked)",
    badge: "OFFLINE RAG",
    text: "[LEGAL LIABILITY ANALYSIS] Identified limitation of liability in Section 14.2 capped at 100% of annual fees. Intellectual property rights remain sovereign with no third-party sub-licensing or telemetry clauses.",
  },
  code: {
    route: "qwen2.5-coder:7b ──► Isolated Docker Container (--network none)",
    latency: "164 ms",
    egress: "0 bytes (blocked)",
    badge: "SANDBOX SECURE",
    text: "[SANDBOX RUN OK] Executed Python simulation inside ephemeral container c-9817e94f. 4/4 automated tests passed. Root filesystem mounted read-only, ephemeral storage automatically sanitized on exit.",
  },
};

export default function LandingPage({ onEnter }: LandingPageProps) {
  const [activeTab, setActiveTab] = useState<SubsystemTab>("sentinel");
  const [activePrompt, setActivePrompt] = useState<PromptScenario>("audit");
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const activeResult = SIM_SCENARIOS[activePrompt];

  return (
    <div className="min-h-screen w-full bg-[#eef1f6] text-slate-900 font-sans relative selection:bg-[#2563eb] selection:text-white pb-20">
      {/* Luminous Ambient Studio Lighting Blooms */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] bg-blue-200/50 rounded-full blur-[130px] pointer-events-none -translate-y-1/2" />
      <div className="fixed top-1/3 right-10 w-[550px] h-[550px] bg-indigo-200/40 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-0 left-1/3 w-[500px] h-[500px] bg-emerald-100/40 rounded-full blur-[130px] pointer-events-none" />

      {/* Background Cyber Matrix Grid */}
      <div
        className="fixed inset-0 opacity-70 pointer-events-none z-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(112, 71, 235, 0.10) 1.2px, transparent 1.2px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Real-Time Defense Vitals Monospace Strip */}
      <div className="relative z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-8 py-2 text-[11px] font-mono flex items-center justify-between overflow-x-auto gap-4 scrollbar-none shadow-2xs">
        <div className="flex items-center gap-3 shrink-0">
          <span className="inline-flex items-center gap-1.5 text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            AIR-GAP ACTIVE
          </span>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <span className="text-slate-600 hidden sm:inline">
            EGRESS: <strong className="text-emerald-700">0.00 BYTES (BLOCKED)</strong>
          </span>
        </div>

        <div className="flex items-center gap-4 shrink-0 text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">GPU:</span>
            <span className="text-slate-800 font-semibold">NVIDIA RTX 4090</span>
            <span className="text-[#2563eb] font-semibold bg-blue-50 border border-blue-200 px-2 py-0.2 rounded-md text-[10px]">
              14.2 / 24 GB VRAM
            </span>
          </div>
          <span className="text-slate-300 hidden md:inline">·</span>
          <div className="hidden md:flex items-center gap-1.5">
            <span className="text-slate-400">LOOPBACK:</span>
            <span className="text-emerald-700 font-semibold">0.08 ms</span>
          </div>
          <span className="text-slate-300 hidden lg:inline">·</span>
          <div className="hidden lg:flex items-center gap-1.5">
            <span className="text-slate-400">DOCKER:</span>
            <span className="text-blue-700 font-semibold font-mono bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
              --network none
            </span>
          </div>
        </div>
      </div>

      {/* Primary Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 px-6 sm:px-12 h-16 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <AstraLogo size={36} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-poster text-2xl tracking-[0.08em] uppercase text-slate-900 leading-none">
                AstraSovereign
              </span>
              <span className="text-[10px] font-mono font-bold text-[#2563eb] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                v2.4 AIR-GAP
              </span>
            </div>
            <span className="block text-[10px] font-mono font-bold text-slate-500 tracking-wider uppercase mt-0.5">
              Sovereign AI Workbench
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="#architecture"
            className="hidden md:inline-flex text-xs font-semibold text-slate-600 hover:text-[#2563eb] transition-colors px-3 py-1.5"
          >
            Capabilities
          </a>
          <a
            href="#interactive-terminal"
            className="hidden md:inline-flex text-xs font-semibold text-slate-600 hover:text-[#2563eb] transition-colors px-3 py-1.5"
          >
            Terminal Trace
          </a>
          <button
            type="button"
            onClick={onEnter}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] active:bg-[#1e40af] text-white text-xs font-bold shadow-md hover:shadow-blue-500/25 transition-all cursor-pointer transform hover:-translate-y-0.5"
          >
            <span>Sign In to Portal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-12 space-y-16">
        {/* Hero Section */}
        <div className="text-center space-y-6 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-blue-200 text-blue-900 text-xs font-bold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#2563eb] animate-ping" />
            <span>100% ON-PREMISE AIR-GAPPED WORKBENCH</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-600 font-semibold">STRICT ZERO EGRESS</span>
          </div>

          <h1 className="font-poster text-5xl sm:text-6xl lg:text-7xl tracking-[0.04em] uppercase leading-[0.93] text-slate-900">
            The Sovereign AI Workbench for{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-700 to-slate-900">
              Confidential Enterprise
            </span>{" "}
            Operations
          </h1>

          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto font-medium leading-relaxed">
            Multi-model agent pipelines, Docker-isolated code execution sandboxes, offline RapidOCR, and
            L1–L4 clearance sign-offs running entirely on bare-metal hardware.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            <button
              type="button"
              onClick={onEnter}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-extrabold text-sm shadow-xl hover:shadow-2xl hover:shadow-blue-500/30 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-blue-200" />
              <span>Launch Sovereign Workbench</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <a
              href="#interactive-terminal"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-sm shadow-xs transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Explore Subsystems</span>
            </a>
          </div>

          {/* Supported Local Models Strip */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs font-mono text-slate-600">
            <span className="text-slate-400 font-semibold mr-1">OFFLINE ROSTER:</span>
            <span className="px-3 py-1 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold shadow-2xs">
              Llama 3.3 (8B/70B)
            </span>
            <span className="px-3 py-1 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 font-bold shadow-2xs">
              Qwen 2.5 Coder
            </span>
            <span className="px-3 py-1 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold shadow-2xs">
              DeepSeek R1
            </span>
            <span className="px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold shadow-2xs">
              Docker Sandbox
            </span>
            <span className="px-3 py-1 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold shadow-2xs">
              RapidOCR Engine
            </span>
          </div>
        </div>

        {/* Live "Try a Sovereign Prompt" Simulator */}
        <div className="max-w-3xl mx-auto bg-white/95 backdrop-blur-md rounded-3xl p-6 border border-slate-200/90 shadow-xl space-y-4">
          <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <div className="w-6 h-6 rounded-lg bg-blue-100 text-[#2563eb] flex items-center justify-center font-bold">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <span>Interactive Sovereign Prompt Simulator</span>
            </div>
            <span className="text-[11px] font-mono text-[#2563eb] bg-blue-50 px-2.5 py-0.5 rounded-full font-bold border border-blue-200">
              Live GPU Simulation
            </span>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => setActivePrompt("audit")}
              className={`px-3.5 py-2 rounded-xl text-left transition-all cursor-pointer font-medium border ${
                activePrompt === "audit"
                  ? "bg-blue-100/80 border-[#2563eb] text-blue-950 font-bold shadow-xs"
                  : "bg-slate-50 hover:bg-blue-50 border-slate-200 text-slate-700"
              }`}
            >
              📜 Audit container network isolation
            </button>
            <button
              type="button"
              onClick={() => setActivePrompt("contract")}
              className={`px-3.5 py-2 rounded-xl text-left transition-all cursor-pointer font-medium border ${
                activePrompt === "contract"
                  ? "bg-blue-100/80 border-[#2563eb] text-blue-950 font-bold shadow-xs"
                  : "bg-slate-50 hover:bg-blue-50 border-slate-200 text-slate-700"
              }`}
            >
              ⚖️ Review defense contract liabilities
            </button>
            <button
              type="button"
              onClick={() => setActivePrompt("code")}
              className={`px-3.5 py-2 rounded-xl text-left transition-all cursor-pointer font-medium border ${
                activePrompt === "code"
                  ? "bg-blue-100/80 border-[#2563eb] text-blue-950 font-bold shadow-xs"
                  : "bg-slate-50 hover:bg-blue-50 border-slate-200 text-slate-700"
              }`}
            >
              ⚡ Execute Python sandbox benchmark
            </button>
          </div>

          {/* Output Display Box */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs space-y-2.5 text-slate-200 shadow-inner">
            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pb-2 border-b border-slate-800/80 gap-2">
              <span className="text-blue-300 font-semibold">{activeResult.route}</span>
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 font-semibold">{activeResult.latency}</span>
                <span className="text-slate-500 font-semibold">|</span>
                <span className="text-cyan-300 font-semibold">{activeResult.egress}</span>
              </div>
            </div>
            <div className="text-slate-300 leading-relaxed text-[11.5px]">
              <span className="inline-block px-1.5 py-0.2 mr-2 rounded bg-emerald-950 border border-emerald-800 text-emerald-400 font-bold text-[10px]">
                {activeResult.badge}
              </span>
              {activeResult.text}
            </div>
          </div>
        </div>

        {/* Interactive Mission Control Terminal */}
        <div
          id="interactive-terminal"
          className="max-w-4xl mx-auto rounded-3xl border border-slate-800 bg-[#0a0e17] shadow-2xl overflow-hidden font-mono text-xs"
        >
          {/* Top Window Title Bar */}
          <div className="flex flex-wrap items-center justify-between px-5 py-3.5 bg-[#0f1422] border-b border-slate-800 gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500/90 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-400/90 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-400/90 inline-block" />
              </div>
              <span className="text-slate-300 font-bold tracking-tight">
                astra-sovereign://subsystem-trace
              </span>
            </div>

            {/* Subsystem Tabs */}
            <div className="flex items-center gap-1 bg-[#06080e] p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab("sentinel")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  activeTab === "sentinel"
                    ? "bg-blue-900/60 text-blue-200 border border-blue-500/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                🛡️ Air-Gap Sentinel
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("sandbox")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  activeTab === "sandbox"
                    ? "bg-blue-900/60 text-blue-200 border border-blue-500/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                ⚡ Docker Sandbox
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("router")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  activeTab === "router"
                    ? "bg-blue-900/60 text-blue-200 border border-blue-500/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                🧠 Neural Router
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("audit")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  activeTab === "audit"
                    ? "bg-blue-900/60 text-blue-200 border border-blue-500/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                📜 Audit Chain
              </button>
            </div>
          </div>

          {/* Tab 1: Sentinel */}
          {activeTab === "sentinel" && (
            <div className="p-6 space-y-2.5 text-slate-300 leading-relaxed bg-[#070b12] animate-fade-in">
              <div className="text-blue-400 font-bold">
                ┌── [AIR-GAP-SENTINEL] :: PHYSICAL ISOLATION VERIFICATION
              </div>
              <div className="pl-4 text-emerald-400">
                ✓ [NET_POLICY] STRICT_LOCAL_ONLY enforced (iptables DROP 0.0.0.0/0)
              </div>
              <div className="pl-4 text-emerald-400">
                ✓ [SOCKET_INSPECT] Outbound external connections: 0 (Loopback 127.0.0.1 only)
              </div>
              <div className="pl-4 text-emerald-400">
                ✓ [DNS_CHECK] No external nameservers mapped; Cloud ping rejected with code ENETUNREACH
              </div>
              <div className="pl-4 text-emerald-400">
                ✓ [HARDWARE_BIND] Model inference locked to local PCIe NVLink bus
              </div>
              <div className="pl-4 text-blue-300">
                ✓ [ENCRYPTION] Ephemeral scratch vectors AES-256 encrypted at rest
              </div>
              <div className="text-blue-400 font-bold pt-1">
                └── CONCLUSION: VERIFIED IMMUNE TO CLOUD EXFILTRATION (0 BYTES EGRESS)
              </div>
            </div>
          )}

          {/* Tab 2: Sandbox */}
          {activeTab === "sandbox" && (
            <div className="p-6 space-y-2.5 text-slate-300 leading-relaxed bg-[#070b12] animate-fade-in">
              <div className="text-amber-400 font-bold">
                ┌── [SANDBOX-ENGINE] :: DOCKER CONTAINER RUNTIME INVOCATION
              </div>
              <div className="pl-4 text-slate-400">
                $ docker run --rm -i --network none --memory 512m --cpus 2.0 alpine:sovereign-python
              </div>
              <div className="pl-4 text-cyan-400">
                &gt; Container initialized: c-9817e94f (Network: DISABLED)
              </div>
              <div className="pl-4 text-emerald-400">
                &gt; Executing untrusted user payload: script_variance_calc.py ...
              </div>
              <div className="pl-4 text-slate-200">
                &gt; [STDOUT] Calculation complete. Variance index: 0.0412. Execution time: 184ms.
              </div>
              <div className="pl-4 text-emerald-400">
                &gt; Process exited with code 0. Container ephemeral storage wiped automatically.
              </div>
              <div className="text-amber-400 font-bold pt-1">
                └── STATUS: 100% CONTAINER ISOLATION VERIFIED (READ-ONLY HOST FS)
              </div>
            </div>
          )}

          {/* Tab 3: Router */}
          {activeTab === "router" && (
            <div className="p-6 space-y-2.5 text-slate-300 leading-relaxed bg-[#070b12] animate-fade-in">
              <div className="text-cyan-400 font-bold">
                ┌── [DYNAMIC-ROUTER] :: DETERMINISTIC WORKLOAD ROUTING MATRIX
              </div>
              <div className="pl-4 text-slate-300">
                • Reasoning / Complex Logic ──►{" "}
                <span className="text-blue-300 font-bold">llama3:8b-instruct-q4_K_M</span> (VRAM: 5.6 GB)
              </div>
              <div className="pl-4 text-slate-300">
                • Software Engineering / SQL ──►{" "}
                <span className="text-cyan-300 font-bold">qwen2.5-coder:7b</span> (VRAM: 4.8 GB)
              </div>
              <div className="pl-4 text-slate-300">
                • Scanned Document / OCR ───►{" "}
                <span className="text-amber-300 font-bold">llava:7b + RapidOCR Engine</span> (VRAM: 5.1 GB)
              </div>
              <div className="pl-4 text-slate-300">
                • Deep Chain-of-Thought ────►{" "}
                <span className="text-emerald-300 font-bold">deepseek-r1:8b</span> (Deterministic quant)
              </div>
              <div className="text-cyan-400 font-bold pt-1">
                └── AVERAGE LOCAL DISPATCH LATENCY: 0.42ms (NO CLOUD TRIPS)
              </div>
            </div>
          )}

          {/* Tab 4: Audit */}
          {activeTab === "audit" && (
            <div className="p-6 space-y-2.5 text-slate-300 leading-relaxed bg-[#070b12] animate-fade-in">
              <div className="text-emerald-400 font-bold">
                ┌── [AUDIT-CHAIN] :: TAMPER-EVIDENT CRYPTOGRAPHIC LOG RECORD
              </div>
              <div className="pl-4 text-slate-400">
                {`{"timestamp": "2026-09-08T22:30:00Z", "actor": "user-001 (Legal Lead)", "action": "JOB_CREATED"}`}
              </div>
              <div className="pl-4 text-slate-400">
                {`{"timestamp": "2026-09-08T22:30:01Z", "model": "llama3:8b", "hash": "sha256:7f83b165...e92"}`}
              </div>
              <div className="pl-4 text-slate-400">
                {`{"timestamp": "2026-09-08T22:30:04Z", "clearance": "L3_DEPT_LEAD_SIGNOFF", "verified": true}`}
              </div>
              <div className="pl-4 text-emerald-400">
                ✓ Cryptographic hash chain validation: ALL 1,492 RECORDS INTACT
              </div>
              <div className="text-emerald-400 font-bold pt-1">
                └── EXPORT FORMATS READY: CSV (COMPLIANCE) &amp; CRYPTO-JSONL
              </div>
            </div>
          )}
        </div>

        {/* Feature Pillars */}
        <div id="architecture" className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Defense-Grade Architecture Stack
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Engineered for strict confidentiality and air-gapped sovereign execution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-3xl p-7 border border-slate-200/80 shadow-xs hover:-translate-y-1 hover:shadow-md transition-all space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#2563eb] flex items-center justify-center font-bold text-xl">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Multi-Model Local Routing</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Deterministic rule-based task classifier that instantly allocates coding, reasoning, and
                document OCR tasks to your dedicated on-premise models without external calls.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-7 border border-slate-200/80 shadow-xs hover:-translate-y-1 hover:shadow-md transition-all space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xl">
                <Users2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">L1–L4 Clearance Hierarchy</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Multi-tier sign-off protocol. Admins dispatch cross-department tasks, managers delegate to
                juniors, and deliverables require L1 to L4 authorization sign-offs.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-7 border border-slate-200/80 shadow-xs hover:-translate-y-1 hover:shadow-md transition-all space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xl">
                <Terminal className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Isolated Docker Sandbox</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Generated code executes inside ephemeral Docker containers with disabled networking (
                <code className="text-emerald-700 font-bold">--network none</code>), 512MB RAM ceiling,
                and auto-cleanup.
              </p>
            </div>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="rounded-3xl bg-white border border-slate-200/80 p-8 shadow-xs">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center divide-y md:divide-y-0 md:divide-x divide-slate-100">
            <div className="space-y-1">
              <span className="text-3xl sm:text-4xl font-black text-slate-900">0 BYTES</span>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Cloud Data Egress
              </p>
            </div>
            <div className="space-y-1 pt-4 md:pt-0">
              <span className="text-3xl sm:text-4xl font-black text-[#2563eb]">100%</span>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Air-Gapped Local
              </p>
            </div>
            <div className="space-y-1 pt-4 md:pt-0">
              <span className="text-3xl sm:text-4xl font-black text-slate-900">L1–L4</span>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Clearance Tiers
              </p>
            </div>
            <div className="space-y-1 pt-4 md:pt-0">
              <span className="text-3xl sm:text-4xl font-black text-emerald-600">Local RAG</span>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Encrypted Vectors
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Launch Banner */}
        <div className="rounded-3xl bg-gradient-to-r from-[#2563eb] to-[#3b82f6] p-8 sm:p-12 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center sm:text-left">
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Ready to enter the Sovereign Workbench?
            </h3>
            <p className="text-sm text-blue-100 max-w-xl">
              Authenticate with your department credentials to access the local AI Assistant, Code
              Sandbox, and Coworking space.
            </p>
          </div>

          <button
            type="button"
            onClick={onEnter}
            className="px-8 py-4 rounded-2xl bg-white text-[#2563eb] font-extrabold text-sm hover:bg-blue-50 shadow-xl transition-all cursor-pointer shrink-0 transform hover:-translate-y-0.5"
          >
            Authenticate &amp; Enter
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-200/80 bg-white/70 py-6 px-6 text-center text-xs text-slate-500">
        <p>
          AstraSovereign On-Premise Operating System · Verified Air-Gap Execution · Strict Zero-Telemetry Protocol
        </p>
      </footer>
    </div>
  );
}
