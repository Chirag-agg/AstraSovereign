"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  Server,
  Cpu,
  Users2,
  Terminal,
  ChevronDown,
  Menu,
  X,
  Activity,
  Sparkles,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Shield,
} from "lucide-react";

interface LandingPageProps {
  onEnter: () => void;
}

/* ─── tiny hook: fires once when element enters viewport ─── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/* ─── card data ─── */
const PILLARS = [
  {
    icon: <ShieldCheck className="w-8 h-8" />,
    accent: "#ef4444",
    bg: "from-red-950/90 to-zinc-950",
    label: "AIR-GAP VERIFIED",
    title: "Zero Cloud Egress",
    body: "Every byte stays on your hardware. Strict iptables rules drop all outbound traffic — no telemetry, no cloud calls, ever.",
    stat: "0 bytes out",
  },
  {
    icon: <Terminal className="w-8 h-8" />,
    accent: "#f87171",
    bg: "from-[#200707] to-zinc-950",
    label: "SANDBOX SECURE",
    title: "Docker Isolation",
    body: "Untrusted code runs inside ephemeral containers with --network none, 512 MB RAM cap and auto-wiped storage on exit.",
    stat: "--network none",
  },
  {
    icon: <Users2 className="w-8 h-8" />,
    accent: "#dc2626",
    bg: "from-red-950/70 to-zinc-950",
    label: "MULTI-TIER",
    title: "L1–L4 Clearance",
    body: "Department-grade sign-off hierarchy. Admins dispatch, managers delegate, deliverables require clearance before release.",
    stat: "L1 → L4",
  },
  {
    icon: <Cpu className="w-8 h-8" />,
    accent: "#ef4444",
    bg: "from-[#2a0808] to-zinc-950",
    label: "LOCAL MODELS",
    title: "On-Prem Inference",
    body: "Llama 3, Qwen 2.5 Coder, DeepSeek R1 and RapidOCR all run on bare-metal GPU — no SaaS API keys required.",
    stat: "24 GB VRAM",
  },
  {
    icon: <Lock className="w-8 h-8" />,
    accent: "#fca5a5",
    bg: "from-red-950/80 to-zinc-950",
    label: "ENCRYPTED",
    title: "AES-256 Vectors",
    body: "All RAG embeddings and ephemeral scratch vectors are encrypted at rest. Hash-chained audit logs cannot be tampered with.",
    stat: "AES-256",
  },
  {
    icon: <Server className="w-8 h-8" />,
    accent: "#ef4444",
    bg: "from-red-950/90 to-zinc-950",
    label: "BARE-METAL",
    title: "Sovereign Stack",
    body: "Runs entirely offline on your own infrastructure. No subscriptions, no vendor lock-in, no hidden data flows.",
    stat: "100% local",
  },
];

/* ─── slide data ─── */
const SLIDES = [
  {
    tag: "SOVEREIGN WORKBENCH",
    headline: "Your Data.\nNever Leaves.",
    sub: "Full multi-model AI execution with zero cloud egress — on your hardware, under your rules.",
    cta: "Enter the Workbench",
    bg: "bg-[#09090b]",
    accent: "#ef4444",
  },
  {
    tag: "DOCKER SANDBOX",
    headline: "Code Runs\nIn Isolation.",
    sub: "Ephemeral containers. Network disabled. Auto-cleaned. No blast radius, no data escape.",
    cta: "See the Sandbox",
    bg: "bg-[#0a0505]",
    accent: "#dc2626",
  },
  {
    tag: "CLEARANCE SYSTEM",
    headline: "L1 to L4\nChain of Trust.",
    sub: "Every deliverable passes through department-grade sign-offs. Immutable cryptographic audit logs.",
    cta: "Explore Clearance",
    bg: "bg-[#0c0505]",
    accent: "#f87171",
  },
];

/* ═══════════════════════════════════════════════════ COMPONENT */
export default function LandingPage({ onEnter }: LandingPageProps) {
  const [slide, setSlide] = useState(0);
  const [slideOut, setSlideOut] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  /* auto-cycle hero slides */
  useEffect(() => {
    const id = setInterval(() => {
      setSlideOut(true);
      setTimeout(() => {
        setSlide((s) => (s + 1) % SLIDES.length);
        setSlideOut(false);
      }, 400);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  /* nav shadow on scroll */
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const goSlide = (i: number) => {
    setSlideOut(true);
    setTimeout(() => { setSlide(i); setSlideOut(false); }, 350);
  };

  const cur = SLIDES[slide];

  /* section hooks */
  const s1 = useInView();
  const s2 = useInView();
  const s3 = useInView();

  return (
    <div
      className="min-h-screen w-full bg-[#09090b] text-white font-sans overflow-x-hidden"
      style={{
        backgroundImage: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(239, 68, 68, 0.20), transparent 70%), radial-gradient(circle at 50% 25%, rgba(185, 28, 28, 0.10), transparent 60%)",
      }}
    >

      {/* ── NAVBAR ───────────────────────────────────────────── */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 sm:px-12 h-16 transition-all duration-300 ${
          scrolled ? "bg-black/80 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.06)]" : "bg-transparent"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm bg-gradient-to-tr from-red-600 to-red-700 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]"
          >
            AS
          </div>
          <span className="text-base font-extrabold tracking-tight text-white">AstraSovereign</span>
          <span className="hidden sm:inline text-[10px] font-mono font-bold text-red-400 bg-red-950/60 border border-red-800/60 px-2 py-0.5 rounded-md">
            v2.4 AIR-GAP
          </span>
        </div>

        {/* desktop links */}
        <div className="hidden md:flex items-center gap-6">
          {["#capabilities", "#architecture", "#clearance"].map((href, i) => (
            <a
              key={i}
              href={href}
              className="text-xs font-semibold text-white/50 hover:text-white transition-colors"
            >
              {["Capabilities", "Architecture", "Clearance"][i]}
            </a>
          ))}
          <button
            type="button"
            onClick={onEnter}
            aria-label="Sign In to Portal"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer transition-all hover:scale-105 active:scale-95 bg-gradient-to-r from-red-600 to-red-700 shadow-[0_0_24px_rgba(239,68,68,0.35)]"
          >
            <span>Sign In to Portal</span> <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* mobile burger */}
        <button
          type="button"
          className="md:hidden text-white/70 hover:text-white cursor-pointer"
          onClick={() => setNavOpen(!navOpen)}
        >
          {navOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* mobile nav drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-40 bg-black/95 flex flex-col items-center justify-center gap-8 text-xl font-bold">
          {["Capabilities", "Architecture", "Clearance"].map((label, i) => (
            <a
              key={i}
              href={["#capabilities", "#architecture", "#clearance"][i]}
              className="text-white/70 hover:text-white transition-colors"
              onClick={() => setNavOpen(false)}
            >
              {label}
            </a>
          ))}
          <button
            type="button"
            onClick={() => { setNavOpen(false); onEnter(); }}
            className="mt-4 px-10 py-4 rounded-2xl text-white font-extrabold cursor-pointer"
            style={{ background: "linear-gradient(135deg,#ef4444,#b91c1c)" }}
          >
            Enter Workbench
          </button>
        </div>
      )}

      {/* ── HERO SLIDES ──────────────────────────────────────── */}
      <section
        className={`relative min-h-screen flex flex-col items-center justify-center overflow-hidden ${cur.bg} transition-colors duration-700`}
      >
        {/* ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none opacity-30 transition-all duration-700"
          style={{
            background: `radial-gradient(ellipse 60% 50% at 50% 40%, ${cur.accent}55, transparent 70%)`,
          }}
        />

        {/* grid lines */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.06]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* slide content */}
        <div
          className={`relative z-10 text-center px-6 max-w-4xl mx-auto transition-all duration-400 ${
            slideOut ? "opacity-0 translate-y-6" : "opacity-100 translate-y-0"
          }`}
          style={{ transitionTimingFunction: "cubic-bezier(0.4,0,0.2,1)" }}
        >
          <span
            className="inline-block mb-6 text-[11px] font-mono font-bold tracking-[0.25em] px-4 py-1.5 rounded-full border"
            style={{ color: cur.accent, borderColor: `${cur.accent}55`, background: `${cur.accent}15` }}
          >
            {cur.tag}
          </span>

          <h1
            className="text-5xl sm:text-6xl lg:text-8xl font-black tracking-tight leading-[1.02] whitespace-pre-line mb-6"
            style={{ textShadow: `0 0 80px ${cur.accent}50` }}
          >
            {cur.headline}
          </h1>

          <p className="text-base sm:text-xl text-white/60 max-w-xl mx-auto mb-10 leading-relaxed font-medium">
            {cur.sub}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={onEnter}
              className="group flex items-center gap-3 px-10 py-5 rounded-2xl text-lg font-extrabold text-white cursor-pointer transition-all hover:scale-105 active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${cur.accent}, ${cur.accent}cc)`,
                boxShadow: `0 0 40px ${cur.accent}66`,
              }}
            >
              {cur.cta}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>

            <a
              href="#capabilities"
              className="flex items-center gap-2 px-8 py-5 rounded-2xl text-base font-bold text-white/70 hover:text-white border border-white/10 hover:border-white/30 cursor-pointer transition-all"
            >
              Explore <ChevronDown className="w-4 h-4" />
            </a>
          </div>

          {/* 3D Perspective Floating Dashboard Preview Card (Technical Obsidian & Red Aesthetic) */}
          <div className="mt-12 w-full max-w-5xl mx-auto px-4 [perspective:1400px]">
            <div
              onClick={onEnter}
              className="relative rounded-2xl bg-[#0d0d12] border border-zinc-800 p-4 sm:p-6 text-zinc-200 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8),0_0_50px_rgba(239,68,68,0.15)] transition-all duration-700 ease-out hover:scale-[1.01] cursor-pointer group text-left"
              style={{
                transform: "rotateX(14deg) scale(0.98)",
                transformStyle: "preserve-3d",
              }}
            >
              {/* Preview Header Bar */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-red-600 to-red-700 flex items-center justify-center font-black text-xs text-white shadow-[0_0_12px_rgba(239,68,68,0.3)]">
                    AS
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">AstraSovereign Console</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold text-red-400 bg-red-950/60 border border-red-800/60">
                        v2.4 AIR-GAP
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-400 font-mono">
                      Zero-Egress Host • 127.0.0.1:11434 • Pure On-Premise GPU
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    NetworkGuard Active • 100% Offline Loopback
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-red-300 bg-red-950/40 border border-red-800/50 font-mono">
                    <Shield className="w-3.5 h-3.5 text-red-400" />
                    L4 Admin Clearance
                  </span>
                </div>
              </div>

              {/* 4 Standardized Preview Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
                <div className="bg-[#141419] rounded-xl p-3 border border-zinc-800">
                  <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold mb-1">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-amber-500" /> Pending</span>
                    <span className="text-[10px] text-amber-400 font-bold bg-amber-950/50 px-1.5 py-0.2 rounded border border-amber-800/50 font-mono">Active</span>
                  </div>
                  <div className="text-xl font-black text-white">18 Pending</div>
                </div>

                <div className="bg-[#141419] rounded-xl p-3 border border-zinc-800">
                  <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold mb-1">
                    <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-red-500" /> P0 Priority</span>
                    <span className="text-[10px] text-red-400 font-bold bg-red-950/50 px-1.5 py-0.2 rounded border border-red-800/50 font-mono">Critical</span>
                  </div>
                  <div className="text-xl font-black text-red-500">3 High Attention</div>
                </div>

                <div className="bg-[#141419] rounded-xl p-3 border border-zinc-800">
                  <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold mb-1">
                    <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-red-400" /> Dispatched</span>
                    <span className="text-[10px] text-red-400 font-bold bg-red-950/50 px-1.5 py-0.2 rounded border border-red-800/50 font-mono">+4/hr</span>
                  </div>
                  <div className="text-xl font-black text-white">46 Today</div>
                </div>

                <div className="bg-[#141419] rounded-xl p-3 border border-zinc-800">
                  <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold mb-1">
                    <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Deliverables</span>
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/50 px-1.5 py-0.2 rounded border border-emerald-800/50 font-mono">Signed</span>
                  </div>
                  <div className="text-xl font-black text-white">29 Ready</div>
                </div>
              </div>

              {/* Mini Telemetry Bar Chart Preview */}
              <div className="bg-[#141419] rounded-xl p-4 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                    <Activity className="w-3.5 h-3.5 text-red-500" />
                    <span>Local Model Inference Telemetry (02:00 – 22:00)</span>
                  </div>
                  <span className="text-xs font-bold text-red-300 bg-red-950/50 px-2 py-0.5 rounded-md border border-red-800/50 font-mono">
                    74.2 tokens/s (PCIe NVLink)
                  </span>
                </div>

                <div className="grid grid-cols-6 gap-2 pt-2 items-end h-20">
                  {[
                    { t: "02:00", h: 55 },
                    { t: "06:00", h: 48 },
                    { t: "10:00", h: 78 },
                    { t: "14:00", h: 92 },
                    { t: "18:00", h: 68 },
                    { t: "22:00", h: 62 },
                  ].map((bar) => (
                    <div key={bar.t} className="flex flex-col items-center gap-1 h-full justify-end">
                      <div
                        style={{ height: `${bar.h}%` }}
                        className="w-full max-w-[28px] bg-red-600 rounded-t-sm transition-all group-hover:brightness-125"
                      />
                      <span className="text-[10px] font-bold text-zinc-500 font-mono">{bar.t}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Click to enter overlay badge */}
              <div className="mt-3 flex items-center justify-between text-xs font-bold text-zinc-400 pt-2 border-t border-zinc-800/80">
                <span className="flex items-center gap-1.5 text-red-400 font-bold font-mono">
                  <Sparkles className="w-3.5 h-3.5" />
                  Live Sovereign Workspace Telemetry Active
                </span>
                <span className="text-red-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                  Click to launch sovereign session <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* slide dots */}
        <div className="absolute bottom-10 flex items-center gap-3 z-20">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goSlide(i)}
              className="cursor-pointer transition-all duration-300 rounded-full"
              style={{
                width: i === slide ? 28 : 8,
                height: 8,
                background: i === slide ? cur.accent : "rgba(255,255,255,0.25)",
              }}
            />
          ))}
        </div>

        {/* scroll indicator */}
        <div className="absolute bottom-10 right-10 hidden md:flex flex-col items-center gap-1 opacity-30">
          <div className="w-px h-12 bg-white" />
          <span className="text-[10px] font-mono tracking-widest rotate-90 origin-center mt-6">SCROLL</span>
        </div>
      </section>

      {/* ── STAT STRIP ───────────────────────────────────────── */}
      <div className="bg-[#0e0e12] border-y border-red-950/40 py-6 overflow-hidden">
        <div className="flex items-stretch gap-0 max-w-5xl mx-auto divide-x divide-zinc-800 flex-wrap justify-center">
          {[
            ["0 BYTES", "Cloud Egress — ever"],
            ["100%", "Air-Gapped Local Execution"],
            ["L1–L4", "Dept. Clearance Tiers"],
            ["<1ms", "Local Dispatch Latency"],
          ].map(([val, label], i) => (
            <div key={i} className="flex-1 min-w-[160px] text-center px-6 py-2">
              <div className="text-2xl sm:text-3xl font-black text-white">{val}</div>
              <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CAPABILITY CARDS ─────────────────────────────────── */}
      <section id="capabilities" className="py-24 px-6 sm:px-12">
        <div
          ref={s1.ref}
          className={`max-w-6xl mx-auto transition-all duration-700 ${
            s1.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
          }`}
        >
          <div className="mb-14 text-center">
            <span className="text-[11px] font-mono font-bold tracking-[0.2em] text-red-400 uppercase">
              Platform Capabilities
            </span>
            <h2 className="mt-3 text-4xl sm:text-5xl font-black tracking-tight">
              Every module. On your hardware.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PILLARS.map((p, i) => (
              <div
                key={i}
                className={`group relative bg-gradient-to-br ${p.bg} rounded-3xl p-7 border border-zinc-800/80 cursor-default overflow-hidden transition-all duration-300 hover:scale-[1.03] hover:border-red-800/50 shadow-lg`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {/* glow on hover */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-20 rounded-3xl transition-opacity duration-300 pointer-events-none"
                  style={{ background: `radial-gradient(circle at 50% 0%, ${p.accent}, transparent 70%)` }}
                />

                <div
                  className="inline-flex p-3 rounded-2xl mb-5"
                  style={{ background: `${p.accent}20`, color: p.accent }}
                >
                  {p.icon}
                </div>

                <span
                  className="block text-[10px] font-mono font-black tracking-[0.2em] mb-2"
                  style={{ color: p.accent }}
                >
                  {p.label}
                </span>

                <h3 className="text-xl font-black text-white mb-3">{p.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed mb-5">{p.body}</p>

                <div
                  className="inline-block text-xs font-mono font-bold px-3 py-1 rounded-lg"
                  style={{ background: `${p.accent}18`, color: p.accent, border: `1px solid ${p.accent}33` }}
                >
                  {p.stat}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ARCHITECTURE VISUAL ──────────────────────────────── */}
      <section
        id="architecture"
        className="py-24 px-6 sm:px-12 bg-[#09090b] border-t border-red-950/30"
      >
        <div
          ref={s2.ref}
          className={`max-w-5xl mx-auto transition-all duration-700 ${
            s2.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
          }`}
        >
          <div className="mb-14 text-center">
            <span className="text-[11px] font-mono font-bold tracking-[0.2em] text-red-400 uppercase">
              How It Works
            </span>
            <h2 className="mt-3 text-4xl sm:text-5xl font-black tracking-tight">
              Data never leaves the perimeter.
            </h2>
            <p className="mt-4 text-zinc-400 max-w-xl mx-auto font-medium">
              A chain of strictly local subsystems handles every stage — from prompt routing to signed audit delivery.
            </p>
          </div>

          {/* flow steps */}
          <div className="relative flex flex-col md:flex-row items-stretch gap-0 md:gap-0">
            {[
              { n: "01", color: "#ef4444", title: "Prompt Received", sub: "User sends task via local workbench — no internet required." },
              { n: "02", color: "#f87171", title: "Model Router", sub: "Deterministic classifier selects the right local model instantly." },
              { n: "03", color: "#dc2626", title: "Sandbox Exec", sub: "Any code runs in an ephemeral Docker container, network off." },
              { n: "04", color: "#b91c1c", title: "Signed Output", sub: "Result is hash-signed and appended to the tamper-proof audit chain." },
            ].map((step, i, arr) => (
              <div key={i} className="flex-1 flex flex-col md:flex-row items-stretch">
                <div className="flex-1 relative rounded-2xl border border-zinc-800 bg-[#111115] p-7 flex flex-col gap-3 hover:border-red-800/40 transition-colors">
                  <div
                    className="text-4xl font-black"
                    style={{ color: `${step.color}88` }}
                  >
                    {step.n}
                  </div>
                  <div className="text-lg font-bold text-white">{step.title}</div>
                  <div className="text-sm text-zinc-400 leading-relaxed">{step.sub}</div>
                  <div
                    className="absolute bottom-0 left-6 right-6 h-0.5 rounded-full"
                    style={{ background: step.color }}
                  />
                </div>
                {/* connector arrow */}
                {i < arr.length - 1 && (
                  <div className="hidden md:flex items-center justify-center px-2 text-zinc-600">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CLEARANCE SECTION ────────────────────────────────── */}
      <section id="clearance" className="py-24 px-6 sm:px-12 bg-[#0c0c10] border-t border-red-950/30">
        <div
          ref={s3.ref}
          className={`max-w-5xl mx-auto transition-all duration-700 ${
            s3.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
          }`}
        >
          <div className="mb-14 text-center">
            <span className="text-[11px] font-mono font-bold tracking-[0.2em] text-red-400 uppercase">
              Access Control
            </span>
            <h2 className="mt-3 text-4xl sm:text-5xl font-black tracking-tight">
              Chain of Trust
            </h2>
          </div>

          <div className="flex flex-col gap-4">
            {[
              { tier: "L4", label: "System Administrator", color: "#ef4444", rights: ["Deploy infrastructure", "Manage all users", "Full audit access", "Override clearances"] },
              { tier: "L3", label: "Department Lead", color: "#f87171", rights: ["Dispatch cross-dept tasks", "Approve L2 deliverables", "Review audit logs"] },
              { tier: "L2", label: "Senior Analyst", color: "#dc2626", rights: ["Assign tasks to juniors", "Sign off on L1 output", "Access knowledge base"] },
              { tier: "L1", label: "Junior Analyst", color: "#e11d48", rights: ["Submit tasks", "View own outputs", "Request file access"] },
            ].map((tier, i) => (
              <div
                key={i}
                className="flex flex-col sm:flex-row items-start sm:items-center gap-5 rounded-2xl border border-zinc-800 bg-[#111115] p-6 hover:border-red-900/40 transition-colors group"
                style={{ transitionDelay: `${i * 50}ms` }}
              >
                <div
                  className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-xs"
                  style={{ background: `${tier.color}20`, color: tier.color, border: `2px solid ${tier.color}55` }}
                >
                  {tier.tier}
                </div>
                <div className="flex-1">
                  <div className="text-base font-bold text-white mb-2">{tier.label}</div>
                  <div className="flex flex-wrap gap-2">
                    {tier.rights.map((r, j) => (
                      <span
                        key={j}
                        className="text-xs font-semibold px-3 py-1 rounded-lg font-mono"
                        style={{ background: `${tier.color}15`, color: tier.color, border: `1px solid ${tier.color}35` }}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────── */}
      <section className="py-24 px-6 relative overflow-hidden bg-[#09090b] border-t border-red-950/30">
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{ background: "radial-gradient(ellipse 60% 60% at 50% 50%, #ef4444, transparent 70%)" }}
        />
        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <h2 className="text-5xl sm:text-6xl font-black tracking-tight mb-6">
            Ready to go<br />
            <span style={{ color: "#ef4444" }}>sovereign?</span>
          </h2>
          <p className="text-zinc-400 text-lg mb-10 font-medium">
            Authenticate with your department credentials and take full control of your AI pipeline — completely offline.
          </p>
          <button
            type="button"
            onClick={onEnter}
            className="group inline-flex items-center gap-4 px-12 py-6 rounded-2xl text-xl font-extrabold text-white cursor-pointer transition-all hover:scale-105 active:scale-95 bg-gradient-to-r from-red-600 to-red-700 shadow-[0_0_60px_rgba(239,68,68,0.4),0_20px_60px_rgba(239,68,68,0.2)]"
          >
            Enter the Workbench
            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800 bg-[#09090b] py-8 px-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs bg-gradient-to-tr from-red-600 to-red-700 text-white shadow-[0_0_12px_rgba(239,68,68,0.3)]"
          >
            AS
          </div>
          <span className="text-sm font-bold text-white/60">AstraSovereign</span>
        </div>
        <p className="text-xs text-white/25 font-medium">
          On-Premise · Air-Gapped · Zero Telemetry · Cryptographic Audit Chain
        </p>
      </footer>

      {/* ── GLOBAL KEYFRAME STYLES ───────────────────────────── */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        section {
          animation: fadeSlideUp 0.6s ease both;
        }
        button:active {
          transition: transform 0.08s cubic-bezier(0.4,0,0.2,1);
        }
      `}</style>
    </div>
  );
}
