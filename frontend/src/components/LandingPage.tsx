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
    accent: "#7047eb",
    bg: "from-violet-950 to-violet-900",
    label: "AIR-GAP VERIFIED",
    title: "Zero Cloud Egress",
    body: "Every byte stays on your hardware. Strict iptables rules drop all outbound traffic — no telemetry, no cloud calls, ever.",
    stat: "0 bytes out",
  },
  {
    icon: <Terminal className="w-8 h-8" />,
    accent: "#f59e0b",
    bg: "from-amber-950 to-amber-900",
    label: "SANDBOX SECURE",
    title: "Docker Isolation",
    body: "Untrusted code runs inside ephemeral containers with --network none, 512 MB RAM cap and auto-wiped storage on exit.",
    stat: "--network none",
  },
  {
    icon: <Users2 className="w-8 h-8" />,
    accent: "#10b981",
    bg: "from-emerald-950 to-emerald-900",
    label: "MULTI-TIER",
    title: "L1–L4 Clearance",
    body: "Department-grade sign-off hierarchy. Admins dispatch, managers delegate, deliverables require clearance before release.",
    stat: "L1 → L4",
  },
  {
    icon: <Cpu className="w-8 h-8" />,
    accent: "#38bdf8",
    bg: "from-sky-950 to-sky-900",
    label: "LOCAL MODELS",
    title: "On-Prem Inference",
    body: "Llama 3, Qwen 2.5 Coder, DeepSeek R1 and RapidOCR all run on bare-metal GPU — no SaaS API keys required.",
    stat: "24 GB VRAM",
  },
  {
    icon: <Lock className="w-8 h-8" />,
    accent: "#f43f5e",
    bg: "from-rose-950 to-rose-900",
    label: "ENCRYPTED",
    title: "AES-256 Vectors",
    body: "All RAG embeddings and ephemeral scratch vectors are encrypted at rest. Hash-chained audit logs cannot be tampered with.",
    stat: "AES-256",
  },
  {
    icon: <Server className="w-8 h-8" />,
    accent: "#a78bfa",
    bg: "from-purple-950 to-purple-900",
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
    bg: "bg-[#0a0a14]",
    accent: "#7047eb",
  },
  {
    tag: "DOCKER SANDBOX",
    headline: "Code Runs\nIn Isolation.",
    sub: "Ephemeral containers. Network disabled. Auto-cleaned. No blast radius, no data escape.",
    cta: "See the Sandbox",
    bg: "bg-[#0c0a06]",
    accent: "#f59e0b",
  },
  {
    tag: "CLEARANCE SYSTEM",
    headline: "L1 to L4\nChain of Trust.",
    sub: "Every deliverable passes through department-grade sign-offs. Immutable cryptographic audit logs.",
    cta: "Explore Clearance",
    bg: "bg-[#060f0a]",
    accent: "#10b981",
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
      className="min-h-screen w-full bg-[#0A0E17] text-white font-sans overflow-x-hidden"
      style={{
        backgroundImage: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(112, 71, 235, 0.22), transparent 70%), radial-gradient(circle at 50% 25%, rgba(99, 102, 241, 0.10), transparent 60%)",
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
            className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm"
            style={{ background: "linear-gradient(135deg,#7047eb,#9d7cfc)" }}
          >
            AS
          </div>
          <span className="text-base font-extrabold tracking-tight text-white">AstraSovereign</span>
          <span className="hidden sm:inline text-[10px] font-mono font-bold text-[#7047eb] bg-violet-950/60 border border-violet-700/40 px-2 py-0.5 rounded-md">
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
          <a
            href="/sovereign"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-purple-200 bg-purple-900/60 border border-purple-500/40 hover:bg-purple-800/80 transition-all shadow-sm cursor-pointer"
          >
            <span>✨ Sovereign UI</span>
          </a>
          <button
            type="button"
            onClick={onEnter}
            aria-label="Sign In to Portal"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer transition-all hover:scale-105 active:scale-95"
            style={{ background: "linear-gradient(135deg,#7047eb,#9d7cfc)", boxShadow: "0 0 24px #7047eb55" }}
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
            style={{ background: "linear-gradient(135deg,#7047eb,#9d7cfc)" }}
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

          {/* 3D Perspective Floating Dashboard Preview Card (Linear & SaaS Pro Aesthetic) */}
          <div className="mt-12 w-full max-w-5xl mx-auto px-4 [perspective:1400px]">
            <div
              onClick={onEnter}
              className="relative rounded-2xl bg-white border border-slate-200/80 p-4 sm:p-6 text-slate-900 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7),0_0_50px_rgba(112,71,235,0.25)] transition-all duration-700 ease-out hover:scale-[1.01] cursor-pointer group text-left"
              style={{
                transform: "rotateX(14deg) scale(0.98)",
                transformStyle: "preserve-3d",
              }}
            >
              {/* Preview Header Bar */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center font-black text-xs text-white shadow-xs">
                    AS
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">AstraSovereign Console</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold text-purple-700 bg-purple-50 border border-purple-200">
                        v2.4 AIR-GAP
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Zero-Egress Host • 127.0.0.1:11434 • Pure On-Premise GPU
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    NetworkGuard Active • 100% Offline Loopback
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200">
                    <Shield className="w-3.5 h-3.5" />
                    L4 Admin Clearance
                  </span>
                </div>
              </div>

              {/* 4 Standardized Preview Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
                <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/70">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-amber-500" /> Pending</span>
                    <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">Active</span>
                  </div>
                  <div className="text-xl font-black text-slate-900">18 Pending</div>
                </div>

                <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/70">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
                    <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> P0 Priority</span>
                    <span className="text-[10px] text-rose-700 font-bold bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">Critical</span>
                  </div>
                  <div className="text-xl font-black text-rose-600">3 High Attention</div>
                </div>

                <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/70">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
                    <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-purple-500" /> Dispatched</span>
                    <span className="text-[10px] text-purple-700 font-bold bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">+4/hr</span>
                  </div>
                  <div className="text-xl font-black text-slate-900">46 Today</div>
                </div>

                <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/70">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
                    <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Deliverables</span>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">Signed</span>
                  </div>
                  <div className="text-xl font-black text-slate-900">29 Ready</div>
                </div>
              </div>

              {/* Mini Telemetry Bar Chart Preview */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <Activity className="w-3.5 h-3.5 text-purple-600" />
                    <span>Local Model Inference Telemetry (02:00 – 22:00)</span>
                  </div>
                  <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
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
                        className="w-full max-w-[28px] bg-purple-600 rounded-t-sm transition-all group-hover:brightness-110"
                      />
                      <span className="text-[10px] font-bold text-slate-500 font-mono">{bar.t}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Click to enter overlay badge */}
              <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-500 pt-2 border-t border-slate-100">
                <span className="flex items-center gap-1.5 text-purple-700 font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  Live Light-Mode Workspace Telemetry Active
                </span>
                <span className="text-purple-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
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
      <div className="bg-[#0d0d1a] border-y border-white/5 py-6 overflow-hidden">
        <div className="flex items-stretch gap-0 max-w-5xl mx-auto divide-x divide-white/10 flex-wrap justify-center">
          {[
            ["0 BYTES", "Cloud Egress — ever"],
            ["100%", "Air-Gapped Local Execution"],
            ["L1–L4", "Dept. Clearance Tiers"],
            ["<1ms", "Local Dispatch Latency"],
          ].map(([val, label], i) => (
            <div key={i} className="flex-1 min-w-[160px] text-center px-6 py-2">
              <div className="text-2xl sm:text-3xl font-black text-white">{val}</div>
              <div className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mt-1">{label}</div>
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
            <span className="text-[11px] font-mono font-bold tracking-[0.2em] text-violet-400 uppercase">
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
                className={`group relative bg-gradient-to-br ${p.bg} rounded-3xl p-7 border border-white/5 cursor-default overflow-hidden transition-all duration-300 hover:scale-[1.03] hover:border-white/20`}
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
                <p className="text-sm text-white/50 leading-relaxed mb-5">{p.body}</p>

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
        className="py-24 px-6 sm:px-12 bg-[#08080f]"
      >
        <div
          ref={s2.ref}
          className={`max-w-5xl mx-auto transition-all duration-700 ${
            s2.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
          }`}
        >
          <div className="mb-14 text-center">
            <span className="text-[11px] font-mono font-bold tracking-[0.2em] text-emerald-400 uppercase">
              How It Works
            </span>
            <h2 className="mt-3 text-4xl sm:text-5xl font-black tracking-tight">
              Data never leaves the perimeter.
            </h2>
            <p className="mt-4 text-white/50 max-w-xl mx-auto font-medium">
              A chain of strictly local subsystems handles every stage — from prompt routing to signed audit delivery.
            </p>
          </div>

          {/* flow steps */}
          <div className="relative flex flex-col md:flex-row items-stretch gap-0 md:gap-0">
            {[
              { n: "01", color: "#7047eb", title: "Prompt Received", sub: "User sends task via local workbench — no internet required." },
              { n: "02", color: "#f59e0b", title: "Model Router", sub: "Deterministic classifier selects the right local model instantly." },
              { n: "03", color: "#10b981", title: "Sandbox Exec", sub: "Any code runs in an ephemeral Docker container, network off." },
              { n: "04", color: "#38bdf8", title: "Signed Output", sub: "Result is hash-signed and appended to the tamper-proof audit chain." },
            ].map((step, i, arr) => (
              <div key={i} className="flex-1 flex flex-col md:flex-row items-stretch">
                <div className="flex-1 relative rounded-2xl border border-white/8 bg-white/[0.03] p-7 flex flex-col gap-3 hover:bg-white/[0.06] transition-colors">
                  <div
                    className="text-4xl font-black"
                    style={{ color: `${step.color}55` }}
                  >
                    {step.n}
                  </div>
                  <div className="text-lg font-bold text-white">{step.title}</div>
                  <div className="text-sm text-white/45 leading-relaxed">{step.sub}</div>
                  <div
                    className="absolute bottom-0 left-6 right-6 h-0.5 rounded-full"
                    style={{ background: step.color }}
                  />
                </div>
                {/* connector arrow */}
                {i < arr.length - 1 && (
                  <div className="hidden md:flex items-center justify-center px-2 text-white/20">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CLEARANCE SECTION ────────────────────────────────── */}
      <section id="clearance" className="py-24 px-6 sm:px-12">
        <div
          ref={s3.ref}
          className={`max-w-5xl mx-auto transition-all duration-700 ${
            s3.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
          }`}
        >
          <div className="mb-14 text-center">
            <span className="text-[11px] font-mono font-bold tracking-[0.2em] text-rose-400 uppercase">
              Access Control
            </span>
            <h2 className="mt-3 text-4xl sm:text-5xl font-black tracking-tight">
              Chain of Trust
            </h2>
          </div>

          <div className="flex flex-col gap-4">
            {[
              { tier: "L4", label: "System Administrator", color: "#7047eb", rights: ["Deploy infrastructure", "Manage all users", "Full audit access", "Override clearances"] },
              { tier: "L3", label: "Department Lead", color: "#f59e0b", rights: ["Dispatch cross-dept tasks", "Approve L2 deliverables", "Review audit logs"] },
              { tier: "L2", label: "Senior Analyst", color: "#10b981", rights: ["Assign tasks to juniors", "Sign off on L1 output", "Access knowledge base"] },
              { tier: "L1", label: "Junior Analyst", color: "#38bdf8", rights: ["Submit tasks", "View own outputs", "Request file access"] },
            ].map((tier, i) => (
              <div
                key={i}
                className="flex flex-col sm:flex-row items-start sm:items-center gap-5 rounded-2xl border border-white/8 bg-white/[0.03] p-6 hover:bg-white/[0.06] transition-colors group"
                style={{ transitionDelay: `${i * 50}ms` }}
              >
                <div
                  className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black"
                  style={{ background: `${tier.color}20`, color: tier.color, border: `2px solid ${tier.color}44` }}
                >
                  {tier.tier}
                </div>
                <div className="flex-1">
                  <div className="text-base font-bold text-white mb-2">{tier.label}</div>
                  <div className="flex flex-wrap gap-2">
                    {tier.rights.map((r, j) => (
                      <span
                        key={j}
                        className="text-xs font-semibold px-3 py-1 rounded-lg"
                        style={{ background: `${tier.color}15`, color: tier.color, border: `1px solid ${tier.color}25` }}
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
      <section className="py-24 px-6 relative overflow-hidden bg-[#08080f]">
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{ background: "radial-gradient(ellipse 60% 60% at 50% 50%, #7047eb, transparent 70%)" }}
        />
        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <h2 className="text-5xl sm:text-6xl font-black tracking-tight mb-6">
            Ready to go<br />
            <span style={{ color: "#7047eb" }}>sovereign?</span>
          </h2>
          <p className="text-white/50 text-lg mb-10 font-medium">
            Authenticate with your department credentials and take full control of your AI pipeline — completely offline.
          </p>
          <button
            type="button"
            onClick={onEnter}
            className="group inline-flex items-center gap-4 px-12 py-6 rounded-2xl text-xl font-extrabold text-white cursor-pointer transition-all hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(135deg,#7047eb,#9d7cfc)",
              boxShadow: "0 0 60px #7047eb66, 0 20px 60px #7047eb33",
            }}
          >
            Enter the Workbench
            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="border-t border-white/5 bg-[#06070d] py-8 px-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs"
            style={{ background: "linear-gradient(135deg,#7047eb,#9d7cfc)" }}
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
